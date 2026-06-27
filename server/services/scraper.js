// ============================================================
// Product-page / image URL scraping
// ------------------------------------------------------------
// Given a URL, return candidate product image URLs. Supports:
//   - direct image URLs
//   - Shopify product pages (product.json + JSON-LD)
//   - WooCommerce / generic pages (OpenGraph + <img> heuristics)
//   - best-effort generic scraping
// Sites that block bots (Amazon/Flipkart/Myntra) may fail; callers should
// surface a clear message and offer manual upload.
// ============================================================
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { v4 as uuid } from 'uuid';
import { ensureDir } from '../utils/files.js';

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const IMAGE_EXT = /\.(png|jpe?g|webp|gif|bmp|tiff?)(\?|$)/i;

/** Quick check for a direct image URL by extension. */
function looksLikeImage(url) {
  return IMAGE_EXT.test(url);
}

/**
 * Resolve a URL into a list of candidate product image URLs.
 * @param {string} url
 * @returns {Promise<{images:string[], source:string, message?:string}>}
 */
export async function extractImagesFromUrl(url) {
  if (!/^https?:\/\//i.test(url)) {
    throw Object.assign(new Error('URL must start with http:// or https://'), {
      status: 400,
    });
  }

  // Case 1: direct image link.
  if (looksLikeImage(url)) {
    return { images: [url], source: 'direct-image' };
  }

  let html;
  try {
    const res = await axios.get(url, {
      headers: { 'User-Agent': UA, Accept: 'text/html' },
      timeout: 15000,
      maxRedirects: 5,
    });
    html = res.data;
  } catch (err) {
    throw Object.assign(
      new Error(
        `Could not fetch the page (${err.response?.status || err.code || 'network error'}). ` +
          'The site may block scraping - please upload the image manually.'
      ),
      { status: 422 }
    );
  }

  // Case 2: Shopify - try the product.json endpoint for clean image URLs.
  const shopify = await tryShopify(url);
  if (shopify.length) {
    return { images: shopify, source: 'shopify' };
  }

  // Case 3: parse HTML for OpenGraph, JSON-LD and <img> tags.
  const images = parseHtmlForImages(html, url);
  if (images.length) {
    return { images, source: 'html' };
  }

  return {
    images: [],
    source: 'none',
    message:
      'No product images were found on this page. The site may block scraping - please upload the image manually.',
  };
}

/** Attempt the Shopify `<product-url>.json` convenience endpoint. */
async function tryShopify(url) {
  try {
    const clean = url.split('?')[0].replace(/\/$/, '');
    if (!/\/products\//.test(clean)) return [];
    const res = await axios.get(`${clean}.json`, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      timeout: 12000,
    });
    const imgs = res.data?.product?.images || [];
    return imgs.map((i) => i.src).filter(Boolean);
  } catch {
    return [];
  }
}

/** Extract image URLs from raw HTML using several strategies. */
function parseHtmlForImages(html, baseUrl) {
  const $ = cheerio.load(html);
  const found = new Set();

  const add = (src) => {
    if (!src) return;
    try {
      const abs = new URL(src, baseUrl).href;
      if (looksLikeImage(abs) || /cdn|images?|media/i.test(abs)) found.add(abs);
    } catch {
      /* ignore malformed URLs */
    }
  };

  // OpenGraph / Twitter card images (most reliable for product pages).
  $('meta[property="og:image"], meta[name="twitter:image"]').each((_, el) =>
    add($(el).attr('content'))
  );

  // JSON-LD structured data (Product schema).
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const json = JSON.parse($(el).contents().text());
      const collect = (node) => {
        if (!node) return;
        if (Array.isArray(node)) return node.forEach(collect);
        if (node.image) {
          if (Array.isArray(node.image)) node.image.forEach(add);
          else add(node.image.url || node.image);
        }
      };
      collect(json);
    } catch {
      /* ignore invalid JSON-LD */
    }
  });

  // Fall back to prominent <img> tags.
  $('img').each((_, el) => {
    const $el = $(el);
    add($el.attr('src') || $el.attr('data-src') || $el.attr('data-srcset'));
  });

  return Array.from(found).slice(0, 24);
}

/**
 * Download a remote image to a local directory.
 * @param {string} url
 * @param {string} destDir
 * @returns {Promise<{path:string, filename:string}>}
 */
export async function downloadImage(url, destDir) {
  ensureDir(destDir);
  let res;
  try {
    res = await axios.get(url, {
      headers: { 'User-Agent': UA },
      responseType: 'arraybuffer',
      timeout: 20000,
      maxRedirects: 5,
    });
  } catch (err) {
    throw Object.assign(
      new Error(`Failed to download image: ${err.response?.status || err.code || 'error'}`),
      { status: 422 }
    );
  }

  const contentType = res.headers['content-type'] || '';
  if (!contentType.startsWith('image/')) {
    throw Object.assign(new Error('URL did not return an image.'), { status: 422 });
  }

  // Derive a reasonable filename from the URL path.
  let base = 'remote-image';
  try {
    const u = new URL(url);
    const last = path.basename(u.pathname);
    if (last) base = last.split('?')[0];
  } catch {
    /* keep default */
  }
  if (!IMAGE_EXT.test(base)) base += '.jpg';

  const filename = `${uuid().slice(0, 8)}-${base}`;
  const filePath = path.join(destDir, filename);
  fs.writeFileSync(filePath, Buffer.from(res.data));
  return { path: filePath, filename: base };
}
