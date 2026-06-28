// ============================================================
// OpenAI Vision integration for print-area detection
// ------------------------------------------------------------
// Sends the garment image to an OpenAI vision model and asks for a strict
// JSON description of the printed design area. If no API key is configured
// (or the call fails) we fall back to a safe heuristic so the app keeps
// working end-to-end.
// ============================================================
import fs from 'fs';
import OpenAI from 'openai';

const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

// The exact JSON shape we ask the model to return.
const SYSTEM_PROMPT = `You are a computer-vision assistant for a DTF (direct-to-film) print extraction tool.
You are given a photo of a garment or product. Locate the PRINTED ARTWORK on the garment
(the design, logo, text, or graphic that is printed on the fabric) - NOT the garment itself.

Return ONLY valid JSON, no markdown, with this exact schema:
{
  "print_found": boolean,
  "print_area": { "x": number, "y": number, "width": number, "height": number },
  "garment_type": "tshirt" | "hoodie" | "shorts" | "trackpants" | "dress" | "other",
  "print_type": "text" | "logo" | "graphic" | "pattern" | "mixed",
  "confidence": number,
  "recommended_mode": "exact_crop" | "clean_png" | "ai_recreate" | "text_logo" | "dtf_ready"
}

Targeting rules - the print_area MUST tightly bound ONLY the printed artwork on the garment:
- INCLUDE: every part of the printed design (text, logos, graphics) as one bounding box.
- EXCLUDE everything that is not the print: the wearer's body (skin, neck, arms, hands),
  the background wall/floor, hangers or mannequins, and ANY app/phone UI chrome such as the
  status bar, buttons, color swatches, size/price labels, watermarks, ratings, and cart/share
  icons. If the image is a shopping-app screenshot, box ONLY the graphic printed on the shirt
  in the product photo, ignoring all surrounding interface elements.
- If multiple separate prints exist, return the bounding box around the primary/largest one.
- Make the box as tight as possible while still containing the whole design.

The print_area coordinates are pixel values relative to the provided image dimensions
(top-left origin). confidence is between 0 and 1. If there is no visible print,
set print_found to false and return a print_area covering the central region.`;

/**
 * Detect the printed-design bounding box for an image.
 *
 * @param {string} imagePath  absolute path to a local image file
 * @param {{width:number, height:number}} dimensions  source image size
 * @returns {Promise<object>} detection result matching the schema above
 */
export async function detectPrintArea(imagePath, dimensions) {
  const apiKey = process.env.OPENAI_API_KEY;

  // No key configured -> heuristic fallback.
  if (!apiKey) {
    return heuristicDetection(dimensions, 'OPENAI_API_KEY not configured');
  }

  try {
    const client = new OpenAI({ apiKey });
    const base64 = fs.readFileSync(imagePath).toString('base64');

    const completion = await client.chat.completions.create({
      model: MODEL,
      temperature: 0,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Image dimensions are ${dimensions.width}x${dimensions.height} pixels. Detect the printed design area.`,
            },
            {
              type: 'image_url',
              image_url: { url: `data:image/png;base64,${base64}` },
            },
          ],
        },
      ],
    });

    const raw = completion.choices?.[0]?.message?.content || '{}';
    const parsed = JSON.parse(raw);
    return normalizeDetection(parsed, dimensions);
  } catch (err) {
    console.error('[openai] detection failed, using heuristic:', err.message);
    return heuristicDetection(dimensions, err.message);
  }
}

/**
 * Clamp / sanitize a model response so downstream cropping never receives
 * out-of-bounds coordinates.
 */
function normalizeDetection(parsed, { width, height }) {
  const area = parsed.print_area || {};
  let x = Number.isFinite(area.x) ? area.x : width * 0.25;
  let y = Number.isFinite(area.y) ? area.y : height * 0.25;
  let w = Number.isFinite(area.width) ? area.width : width * 0.5;
  let h = Number.isFinite(area.height) ? area.height : height * 0.5;

  // Clamp into the image bounds.
  x = Math.max(0, Math.min(x, width - 1));
  y = Math.max(0, Math.min(y, height - 1));
  w = Math.max(1, Math.min(w, width - x));
  h = Math.max(1, Math.min(h, height - y));

  return {
    print_found: parsed.print_found !== false,
    print_area: {
      x: Math.round(x),
      y: Math.round(y),
      width: Math.round(w),
      height: Math.round(h),
    },
    garment_type: parsed.garment_type || 'other',
    print_type: parsed.print_type || 'graphic',
    confidence: Number.isFinite(parsed.confidence) ? parsed.confidence : 0.5,
    recommended_mode: parsed.recommended_mode || 'dtf_ready',
    source: 'openai',
  };
}

/**
 * Heuristic fallback: assume the print sits in the central chest area of the
 * garment (a sensible default for t-shirts). Used when no API key is set or
 * the API call fails.
 */
function heuristicDetection({ width, height }, reason) {
  const w = Math.round(width * 0.5);
  const h = Math.round(height * 0.45);
  const x = Math.round((width - w) / 2);
  const y = Math.round(height * 0.22);
  return {
    print_found: true,
    print_area: { x, y, width: w, height: h },
    garment_type: 'tshirt',
    print_type: 'graphic',
    confidence: 0.4,
    recommended_mode: 'dtf_ready',
    source: 'heuristic',
    note: reason,
  };
}
