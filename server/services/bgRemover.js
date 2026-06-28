// ============================================================
// Hosted AI background removal (matting)
// ------------------------------------------------------------
// World-class cutout via a hosted API. Given a PNG buffer of the (already
// cropped) print, returns a transparent PNG buffer with the background matted
// out. Run on the TIGHT detected print crop so the printed graphic is the
// salient foreground and the fabric is background.
//
// Provider is chosen by BG_REMOVAL_PROVIDER, or auto-detected from whichever
// API key is present. Returns null when not configured or on any error, so the
// caller transparently falls back to the built-in color-key remover.
// ============================================================
import axios from 'axios';
import FormData from 'form-data';

/** Resolve the active provider from env (explicit override, else first key found). */
function resolveProvider() {
  const explicit = (process.env.BG_REMOVAL_PROVIDER || '').toLowerCase().trim();
  if (explicit === 'clipdrop' && process.env.CLIPDROP_API_KEY) return 'clipdrop';
  if (explicit === 'photoroom' && process.env.PHOTOROOM_API_KEY) return 'photoroom';
  if (explicit === 'removebg' && process.env.REMOVEBG_API_KEY) return 'removebg';
  // Auto-detect: cheapest first.
  if (process.env.CLIPDROP_API_KEY) return 'clipdrop';
  if (process.env.PHOTOROOM_API_KEY) return 'photoroom';
  if (process.env.REMOVEBG_API_KEY) return 'removebg';
  return null;
}

/** True when a hosted matting provider is configured. */
export function aiBgRemovalProvider() {
  return resolveProvider();
}

const ENDPOINTS = {
  clipdrop: {
    url: 'https://clipdrop-api.co/remove-background/v1',
    keyHeader: 'x-api-key',
    keyEnv: 'CLIPDROP_API_KEY',
  },
  photoroom: {
    url: 'https://sdk.photoroom.com/v1/segment',
    keyHeader: 'x-api-key',
    keyEnv: 'PHOTOROOM_API_KEY',
  },
  removebg: {
    url: 'https://api.remove.bg/v1.0/removebg',
    keyHeader: 'X-Api-Key',
    keyEnv: 'REMOVEBG_API_KEY',
  },
};

/**
 * Remove the background from a PNG buffer using the configured hosted API.
 * @param {Buffer} pngBuffer  source image (PNG) bytes
 * @returns {Promise<Buffer|null>} transparent PNG buffer, or null if unavailable
 */
export async function removeBackgroundAI(pngBuffer) {
  const provider = resolveProvider();
  if (!provider) return null;

  const cfg = ENDPOINTS[provider];
  try {
    const form = new FormData();
    form.append('image_file', pngBuffer, { filename: 'crop.png', contentType: 'image/png' });
    // remove.bg uses size=auto for full resolution; harmless for others.
    if (provider === 'removebg') form.append('size', 'auto');

    const res = await axios.post(cfg.url, form, {
      headers: {
        ...form.getHeaders(),
        [cfg.keyHeader]: process.env[cfg.keyEnv],
        accept: 'image/png',
      },
      responseType: 'arraybuffer',
      timeout: 30000,
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });

    const buf = Buffer.from(res.data);
    if (!buf || buf.length < 100) throw new Error('Empty response from matting API.');
    return buf;
  } catch (err) {
    const detail = err.response?.status
      ? `${err.response.status} ${err.response.statusText || ''}`.trim()
      : err.message;
    console.error(`[bgRemover] ${provider} failed (${detail}); falling back to color key.`);
    return null;
  }
}
