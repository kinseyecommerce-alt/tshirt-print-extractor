// ============================================================
// AI design generation (create a NEW print from a text prompt)
// ------------------------------------------------------------
// Uses OpenAI's image generation API (gpt-image-1) with a transparent
// background, which is ideal for DTF printing. When no API key is configured
// it falls back to a typographic SVG placeholder so the feature still produces
// a real transparent PNG end-to-end.
// ============================================================
import OpenAI from 'openai';
import sharp from 'sharp';

const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';

// Map UI size choices to the aspect ratios the model supports.
const SIZE_MAP = {
  square: '1024x1024',
  portrait: '1024x1536',
  landscape: '1536x1024',
};

/**
 * Wrap the user's prompt with guidance that yields clean, isolated print
 * artwork on a transparent background (no garment, no mockup, no scene).
 */
function buildPrompt(userPrompt, mode) {
  const styleHints = {
    dtf_ready: 'bold, high-contrast, crisp clean edges, vector-like',
    text_logo: 'typographic logo / lettering design, crisp vector style',
    clean_png: 'clean flat illustration, solid colors',
    ai_recreate: 'detailed illustrative artwork',
    exact_crop: 'graphic design artwork',
  };
  const hint = styleHints[mode] || styleHints.dtf_ready;
  return (
    `${userPrompt}. Standalone t-shirt print design artwork only — ${hint}. ` +
    `Centered composition, isolated on a fully transparent background, ` +
    `no garment, no t-shirt, no mockup, no human, no photo background, ` +
    `no border, suitable for direct-to-film (DTF) printing.`
  );
}

/**
 * Generate a new design.
 * @param {string} prompt    user's text description
 * @param {object} opts      { size:'square'|'portrait'|'landscape', mode }
 * @returns {Promise<{buffer:Buffer, source:'openai'|'placeholder', note?:string}>}
 */
export async function generateDesign(prompt, opts = {}) {
  const apiKey = process.env.OPENAI_API_KEY;
  const size = SIZE_MAP[opts.size] || SIZE_MAP.square;

  if (!apiKey) {
    const buffer = await placeholderDesign(prompt, size);
    return {
      buffer,
      source: 'placeholder',
      note: 'OPENAI_API_KEY not set - generated a typographic placeholder instead of AI art.',
    };
  }

  try {
    const client = new OpenAI({ apiKey });
    const result = await client.images.generate({
      model: IMAGE_MODEL,
      prompt: buildPrompt(prompt, opts.mode),
      size,
      background: 'transparent',
      n: 1,
    });
    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error('Image API returned no image data.');
    return { buffer: Buffer.from(b64, 'base64'), source: 'openai' };
  } catch (err) {
    console.error('[generate] image API failed, using placeholder:', err.message);
    const buffer = await placeholderDesign(prompt, size);
    return { buffer, source: 'placeholder', note: err.message };
  }
}

/**
 * No-key fallback: render the prompt text as a centered typographic design on a
 * transparent canvas. Produces a genuine transparent PNG so the whole pipeline
 * (quality check, download, sizing) works without an API key.
 */
async function placeholderDesign(prompt, size) {
  const [w, h] = size.split('x').map(Number);
  const words = String(prompt || 'YOUR DESIGN')
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 4);

  const cx = w / 2;
  const lineHeight = Math.round(h * 0.13);
  const startY = h / 2 - ((words.length - 1) * lineHeight) / 2;
  const fontSize = Math.round(Math.min(w / 6, lineHeight * 0.9));

  const lines = words
    .map((word, i) => {
      const y = Math.round(startY + i * lineHeight);
      return `<text x="${cx}" y="${y}" font-family="Arial Black, Arial, sans-serif" font-size="${fontSize}" font-weight="900" fill="#111111" text-anchor="middle" dominant-baseline="middle" stroke="#ffffff" stroke-width="${Math.round(
        fontSize * 0.04
      )}">${escapeXml(word)}</text>`;
    })
    .join('\n');

  const ring = Math.round(Math.min(w, h) * 0.42);
  const svg = `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${cx}" cy="${h / 2}" r="${ring}" fill="none" stroke="#111111" stroke-width="${Math.round(
    w * 0.012
  )}" stroke-dasharray="${Math.round(w * 0.05)} ${Math.round(w * 0.03)}"/>
    ${lines}
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

function escapeXml(s) {
  return s.replace(/[<>&'"]/g, (c) =>
    ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' }[c])
  );
}

export const GEN_SIZES = Object.keys(SIZE_MAP);
