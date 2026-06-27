// ============================================================
// File-system helpers and shared path constants
// ============================================================
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, '..', '..');

// Local storage folders (as required for the Replit deployment).
export const UPLOADS_DIR = path.join(ROOT_DIR, 'uploads');
export const OUTPUTS_DIR = path.join(ROOT_DIR, 'outputs');

/** Create a directory (recursively) if it does not already exist. */
export function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Turn an arbitrary input name into a safe, predictable file base name.
 * Strips extension and unsafe characters.
 */
export function safeBaseName(name) {
  const base = path.basename(name || 'image', path.extname(name || ''));
  return (
    base
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9-_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
      .toLowerCase() || 'image'
  );
}

/** Build the standard output file name: original-name_print.png */
export function outputFileName(originalName) {
  return `${safeBaseName(originalName)}_print.png`;
}

/** Guard against path traversal when resolving a file inside a base dir. */
export function resolveInside(baseDir, filename) {
  const resolved = path.resolve(baseDir, filename);
  if (!resolved.startsWith(path.resolve(baseDir))) {
    throw Object.assign(new Error('Invalid file path'), { status: 400 });
  }
  return resolved;
}
