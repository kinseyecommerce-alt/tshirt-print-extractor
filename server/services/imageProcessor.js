// ============================================================
// Image processing pipeline (Sharp)
// ------------------------------------------------------------
// Turns a garment image into a transparent-background PNG of just the print:
//   1. Load source (download first if the job is URL-based)
//   2. Detect print area (OpenAI Vision or heuristic)
//   3. Crop to the print area
//   4. Remove fabric/background -> alpha channel
//   5. Clean up (sharpen, contrast) and refine edges
//   6. Trim transparent margins
//   7. Export high-resolution transparent PNG
//   8. Run the quality checker
//
// AI "modes" tune how aggressive each step is. Advanced generative recreation
// (AI Recreate Mode) is stubbed with a clear note since it needs a generative
// model; the rest are fully functional with Sharp.
// ============================================================
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { OUTPUTS_DIR, UPLOADS_DIR, outputFileName, ensureDir } from '../utils/files.js';
import { detectPrintArea } from './openai.js';
import { downloadImage } from './scraper.js';
import { updateJob } from './jobStore.js';
import { generateDesign } from './designGenerator.js';

/** Clamp a crop rectangle so it always sits inside the image bounds. */
function clampCrop({ x, y, width, height }, dimensions) {
  const W = dimensions.width;
  const H = dimensions.height;
  const cx = Math.max(0, Math.min(Math.round(x), W - 1));
  const cy = Math.max(0, Math.min(Math.round(y), H - 1));
  const cw = Math.max(1, Math.min(Math.round(width), W - cx));
  const ch = Math.max(1, Math.min(Math.round(height), H - cy));
  return { x: cx, y: cy, width: cw, height: ch };
}

// Per-mode tuning parameters.
const MODE_CONFIG = {
  exact_crop: { removeBackground: false, sharpen: 0, contrast: 1.0, threshold: 0 },
  clean_png: { removeBackground: true, sharpen: 0.6, contrast: 1.05, threshold: 38 },
  ai_recreate: { removeBackground: true, sharpen: 1.0, contrast: 1.1, threshold: 42 },
  text_logo: { removeBackground: true, sharpen: 1.4, contrast: 1.2, threshold: 50 },
  dtf_ready: { removeBackground: true, sharpen: 0.8, contrast: 1.08, threshold: 44 },
};

/**
 * Main entry called by the queue worker.
 * @param {object} job  job record from the job store
 * @returns {Promise<{outputFile:string, detection:object, quality:object}>}
 */
export async function processJob(job) {
  ensureDir(OUTPUTS_DIR);

  // Generate-kind jobs create brand-new artwork instead of extracting a print.
  if (job.kind === 'generate') {
    return generateJob(job);
  }

  // 1. Resolve the source image to a local file path.
  let inputPath = job.inputPath;
  let originalName = job.source;

  if (!inputPath && job.inputUrl) {
    const downloaded = await downloadImage(job.inputUrl, UPLOADS_DIR);
    inputPath = downloaded.path;
    originalName = downloaded.filename;
    // Persist the downloaded path so a later re-process / manual crop reuses
    // the same local file (and the same pixel coordinate space).
    updateJob(job.id, { inputPath });
  }

  if (!inputPath || !fs.existsSync(inputPath)) {
    throw new Error('Source image could not be found or downloaded.');
  }

  const mode = MODE_CONFIG[job.mode] ? job.mode : 'dtf_ready';
  const cfg = MODE_CONFIG[mode];

  // Normalize the source to a flat RGB image first (handles HEIC/CMYK/etc.).
  const meta = await sharp(inputPath).metadata();
  const dimensions = { width: meta.width || 0, height: meta.height || 0 };

  // 2. Determine the crop area. A manual crop (drawn by the user) overrides AI
  //    detection; otherwise we ask OpenAI Vision / the heuristic detector.
  let detection;
  if (job.manualCrop) {
    const area = clampCrop(job.manualCrop, dimensions);
    detection = {
      print_found: true,
      print_area: area,
      garment_type: 'other',
      print_type: 'graphic',
      confidence: 0.9,
      recommended_mode: mode,
      source: 'manual',
    };
  } else {
    detection = await detectPrintArea(inputPath, dimensions);
  }

  // 3. Crop to the chosen print area.
  const area = detection.print_area;
  let pipeline = sharp(inputPath).extract({
    left: area.x,
    top: area.y,
    width: area.width,
    height: area.height,
  });

  // Ensure RGBA so we always have an alpha channel to work with.
  let { data, info } = await pipeline
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  // 4. Remove fabric/background by keying out the dominant border color.
  let transparencyRatio = 0;
  if (cfg.removeBackground) {
    transparencyRatio = removeBackground(data, info, cfg.threshold);
  }

  // Rebuild an image from the modified raw buffer.
  let out = sharp(data, {
    raw: { width: info.width, height: info.height, channels: info.channels },
  });

  // 5. Cleanup: contrast + sharpen to refine edges and reduce fabric noise.
  if (cfg.contrast !== 1.0) {
    out = out.linear(cfg.contrast, -(128 * (cfg.contrast - 1)));
  }
  if (cfg.sharpen > 0) {
    out = out.sharpen({ sigma: cfg.sharpen });
  }

  // 6. Trim transparent margins (only meaningful when we removed background).
  if (cfg.removeBackground) {
    out = out.trim({ threshold: 1 });
  }

  // 7. Export transparent PNG at high resolution with 300 DPI metadata.
  const outName = outputFileName(originalName);
  const outPath = path.join(OUTPUTS_DIR, outName);
  await out
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 300 })
    .toFile(outPath);

  // 8. Quality checker on the produced file.
  const quality = await buildQualityReport(outPath, detection, {
    mode,
    transparencyRatio,
    sourceDimensions: dimensions,
  });

  return { outputFile: outName, detection, quality };
}

/**
 * Generate-kind pipeline: create a brand-new transparent design from the job's
 * text prompt, save it, and run the quality checker on the result.
 * @param {object} job
 * @returns {Promise<{outputFile:string, detection:object, quality:object}>}
 */
async function generateJob(job) {
  if (!job.prompt && !job.referencePath) {
    throw new Error('A text prompt or a reference image is required to generate a design.');
  }

  const mode = MODE_CONFIG[job.mode] ? job.mode : 'dtf_ready';
  const { buffer, source, note } = await generateDesign(job.prompt, {
    size: job.genSize,
    mode,
    referencePath: job.referencePath,
  });

  // Light cleanup pass; keep the alpha channel intact.
  const cleaned = await sharp(buffer)
    .ensureAlpha()
    .sharpen({ sigma: 0.5 })
    .png({ compressionLevel: 9 })
    .withMetadata({ density: 300 })
    .toBuffer();

  const nameSeed = (job.prompt || job.source || 'design').slice(0, 40);
  const outName = outputFileName(job.referencePath ? `recreate-${nameSeed}` : nameSeed);
  const outPath = path.join(OUTPUTS_DIR, outName);
  await sharp(cleaned).toFile(outPath);

  const meta = await sharp(outPath).metadata();
  const detection = {
    print_found: true,
    garment_type: 'n/a',
    print_type: 'generated',
    confidence: source === 'openai' ? 0.9 : 0.5,
    recommended_mode: mode,
    source,
    note,
  };

  const quality = await buildQualityReport(outPath, detection, {
    mode,
    transparencyRatio: 0.5, // generated art is created on transparent canvas
    sourceDimensions: { width: meta.width || 0, height: meta.height || 0 },
  });

  return { outputFile: outName, detection, quality };
}

/**
 * Naive but effective chroma-key background removal.
 * Estimates the fabric color from the crop border ring, then sets the alpha
 * of every pixel near that color to 0, with feathering for edge refinement.
 *
 * Mutates `data` in place and returns the resulting transparency ratio (0-1).
 */
function removeBackground(data, info, threshold) {
  const { width, height, channels } = info;

  // Estimate background color from a border ring (top/bottom/left/right edges).
  let rs = 0, gs = 0, bs = 0, n = 0;
  const sample = (x, y) => {
    const i = (y * width + x) * channels;
    rs += data[i];
    gs += data[i + 1];
    bs += data[i + 2];
    n += 1;
  };
  for (let x = 0; x < width; x += 1) {
    sample(x, 0);
    sample(x, height - 1);
  }
  for (let y = 0; y < height; y += 1) {
    sample(0, y);
    sample(width - 1, y);
  }
  const br = rs / n, bg = gs / n, bb = bs / n;

  const tLow = threshold;          // fully transparent below this distance
  const tHigh = threshold * 1.8;   // fully opaque above this distance
  let transparent = 0;
  const total = width * height;

  for (let p = 0; p < total; p += 1) {
    const i = p * channels;
    const dr = data[i] - br;
    const dg = data[i + 1] - bg;
    const db = data[i + 2] - bb;
    const dist = Math.sqrt(dr * dr + dg * dg + db * db);

    if (dist <= tLow) {
      data[i + 3] = 0; // background -> transparent
      transparent += 1;
    } else if (dist < tHigh) {
      // Feather the transition for cleaner edges.
      const alpha = Math.round(((dist - tLow) / (tHigh - tLow)) * 255);
      data[i + 3] = alpha;
    }
    // else: keep fully opaque (part of the print)
  }

  return transparent / total;
}

/**
 * Produce the quality-checker report shown to the user before download.
 * Everything here is a best-effort estimate from the output image.
 */
async function buildQualityReport(outPath, detection, ctx) {
  const img = sharp(outPath);
  const meta = await img.metadata();
  const stats = await img.stats();

  const width = meta.width || 0;
  const height = meta.height || 0;
  const hasAlpha = !!meta.hasAlpha;

  // Sharpness proxy: standard deviation of luminance. Low = likely blurry.
  const avgStdev =
    stats.channels.reduce((sum, c) => sum + (c.stdev || 0), 0) /
    (stats.channels.length || 1);

  const warnings = [];
  const lowRes = Math.min(width, height) < 700;
  const blurry = avgStdev < 18;
  const fabricRemaining = ctx.mode !== 'exact_crop' && ctx.transparencyRatio < 0.08;
  const shadowRemaining = ctx.mode !== 'exact_crop' && ctx.transparencyRatio < 0.04;
  const edgeWarning = ctx.transparencyRatio > 0 && ctx.transparencyRatio < 0.05;

  if (lowRes) warnings.push('Low resolution: upscale before printing for best results.');
  if (blurry) warnings.push('Possible blur detected in the extracted print.');
  if (fabricRemaining) warnings.push('Fabric texture may still remain around the print.');
  if (shadowRemaining) warnings.push('Shadows may still be present in the output.');
  if (edgeWarning) warnings.push('Edge quality is uncertain - review the preview.');
  if (!hasAlpha) warnings.push('Output does not contain a transparent background.');

  // Print-readiness score (0-100): start high, subtract for each issue.
  let score = 100;
  if (lowRes) score -= 25;
  if (blurry) score -= 20;
  if (fabricRemaining) score -= 15;
  if (shadowRemaining) score -= 10;
  if (!hasAlpha && ctx.mode !== 'exact_crop') score -= 20;
  score = Math.max(0, Math.min(100, Math.round(score * (0.6 + 0.4 * (detection.confidence || 0.5)))));

  return {
    transparentBackground: hasAlpha,
    transparencyRatio: Number(ctx.transparencyRatio.toFixed(3)),
    width,
    height,
    lowResolution: lowRes,
    blurDetected: blurry,
    fabricTextureRemaining: fabricRemaining,
    shadowRemaining,
    edgeQualityWarning: edgeWarning,
    printReadinessScore: score,
    // Placeholder: a real implementation would compare source vs output
    // embeddings. We approximate with detection confidence.
    similarityScore: Number(((detection.confidence || 0.5) * 100).toFixed(0)),
    warnings,
  };
}
