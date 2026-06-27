# AI Print Extractor SaaS

Extract **only the printed artwork** from T-shirt / product images (uploads or
product URLs) and export it as a **high-resolution transparent PNG** suitable
for **DTF (direct-to-film) printing**.

Built with **React + Tailwind CSS** (frontend), **Node.js + Express** (backend),
**Multer** (uploads), **Sharp** (image processing), an **in-memory job queue**,
local `uploads/` + `outputs/` storage, and **OpenAI Vision** for print-area
detection (with a heuristic fallback when no API key is set).

---

## ✨ Features

- **Create Design (NEW)** — generate a brand-new print from a text prompt
  (text → transparent PNG) using OpenAI image generation (`gpt-image-1`,
  transparent background). Single or bulk (one design per prompt line), with
  square / portrait / landscape canvases. Falls back to a typographic
  placeholder when no API key is set, so the feature works end-to-end.
- **AI cutout (NEW)** — optional hosted AI matting (Clipdrop / Photoroom /
  remove.bg) for world-class clean edges. Runs on the detected print crop, so
  it isolates just the artwork and removes residual neck/edge junk. Falls back
  to the built-in color-key remover when no provider key is configured.
- **AI Recreate (NEW)** — upload an existing print image and have the model
  redraw the *same* design (image-to-image) clean on a transparent background.
  Faithful to the original layout/elements; requires an OpenAI API key. Note:
  very small text may be slightly altered by the redraw — use Extract mode when
  pixel-exact text is required.
- **Required session login** (username/password from environment variables).
- **6 input modes**
  1. Single image upload
  2. Bulk image upload
  3. ZIP image upload
  4. Single product URL
  5. Bulk product URLs (pasted line by line)
  6. CSV / Excel of product URLs
- **Product URL scraping** — Shopify (`product.json` + JSON-LD), WooCommerce /
  generic pages (OpenGraph + `<img>`), direct image links. Amazon/Flipkart/
  Myntra are best-effort and may block scraping; a clear message + manual
  upload fallback is shown.
- **AI print-area detection** via OpenAI Vision returning strict JSON, used to
  crop the print. Falls back to a center-chest heuristic without an API key.
- **5 AI modes** — Exact Crop, Clean PNG, AI Recreate (beta), Text/Logo,
  DTF Ready.
- **Sharp pipeline** — crop → background/fabric removal (chroma-key on the
  detected border color) → contrast + sharpen cleanup → edge feathering →
  transparent-margin trim → transparent PNG with 300 DPI metadata.
- **Quality checker** — transparent background, edge quality, low-resolution,
  blur, fabric-texture, shadow warnings, print-readiness score, and a
  similarity-score placeholder.
- **Bulk processing** — queued jobs with `pending / processing / completed /
  failed` status, progress bar, retry, **Download all as ZIP**, and a **CSV
  report** (`source, status, output file, error`).
- **Editor / viewer** — **functional manual crop** (draw a box and re-extract,
  overriding AI detection, with revert-to-AI), before/after slider, transparent
  checkerboard preview, zoom, export size options (2000 / 3000 / 4500 / 5000px),
  and placeholder tools (rotate, perspective, magic erase, restore, edge
  cleanup, undo/redo).
- **Auto file naming** — `original-name_print.png`.
- **Legal/safety checkbox** — processing is blocked until the user confirms
  ownership/permission.
- **Clean, dark, mobile-responsive SaaS dashboard.**

---

## 🗂 Project structure

```
ai-print-extractor-saas/
├── server/
│   ├── index.js              # Express app entry
│   ├── routes/               # auth, upload, url, jobs, download
│   ├── services/             # openai, imageProcessor, scraper, queue, jobStore
│   └── utils/                # auth middleware, file helpers
├── client/
│   ├── src/
│   │   ├── components/        # Layout, Dropzone, ModeSelect, JobList, ...
│   │   ├── pages/             # Login, Dashboard, uploads, URLs, history, output
│   │   ├── api.js            # axios API client
│   │   └── auth.jsx          # auth context
│   └── (vite + tailwind config)
├── uploads/                  # runtime: source images (gitignored)
├── outputs/                  # runtime: generated PNGs (gitignored)
├── .env.example
├── package.json
└── README.md
```

---

## 🔑 Environment setup

Copy `.env.example` to `.env` and fill in the values:

```bash
cp .env.example .env
```

```env
PORT=3001
OPENAI_API_KEY=          # optional — heuristic detection is used if empty
OPENAI_MODEL=gpt-4o-mini
OPENAI_IMAGE_MODEL=gpt-image-1
SESSION_SECRET=a-long-random-secret
APP_USERNAME=jagadeesh
APP_PASSWORD=12345
NODE_ENV=development

# Optional AI cutout (world-class background removal). Without a key the app
# falls back to the built-in color-key remover.
BG_REMOVAL_PROVIDER=     # clipdrop | photoroom | removebg (auto-detected if blank)
CLIPDROP_API_KEY=
PHOTOROOM_API_KEY=
REMOVEBG_API_KEY=
```

> **Never commit your real `.env`** — it is gitignored. API keys are read from
> the environment only.

**Default login:** `jagadeesh` / `12345` (override via `APP_USERNAME` /
`APP_PASSWORD`).

---

## 🚀 Install & run

### Install everything (root + client)

```bash
npm run install:all
```

### Development (two servers, hot reload)

Runs the Express API on `:3001` and the Vite React app on `:5173`
(the frontend proxies `/api` and `/files` to the backend):

```bash
npm run dev
```

Open <http://localhost:5173>.

### Production (single server)

Builds the React app and serves it from Express:

```bash
npm run build      # builds client/dist
npm run start      # serves API + built client on PORT (default 3001)
```

Open <http://localhost:3001>.

---

## ☁️ Notes for Replit deployment

1. **Import** this repo into a new Replit (Node.js).
2. Add **Secrets** (the lock icon) instead of a `.env` file:
   `OPENAI_API_KEY`, `SESSION_SECRET`, `APP_USERNAME`, `APP_PASSWORD`.
   (`PORT` is provided by Replit automatically.)
3. `replit.nix` already includes **`vips`**, the native library Sharp needs.
4. The included `.replit` runs:
   - **build:** `npm run install:all && npm run build`
   - **run:** `npm run start`
5. Press **Run**. Replit exposes the server port publicly; the built React app
   is served from the same origin (secure session cookies are enabled in
   production).

> **Storage note:** `uploads/` and `outputs/` are local folders. On Replit
> these persist within the repl but are not a durable object store — for a
> production SaaS, swap them for S3/GCS and replace the in-memory job store
> with a database (the code is structured to make this straightforward).

---

## 🔌 API reference

| Method | Route | Description |
| ------ | ----- | ----------- |
| POST | `/api/login` | Log in (sets session cookie) |
| POST | `/api/logout` | Log out |
| GET | `/api/me` | Current user |
| POST | `/api/upload/single` | Upload one image |
| POST | `/api/upload/bulk` | Upload many images |
| POST | `/api/upload/zip` | Upload a ZIP of images |
| POST | `/api/url/preview` | List candidate images for a URL |
| POST | `/api/url/single` | Job from a single URL/image |
| POST | `/api/url/bulk` | Jobs from pasted URLs |
| POST | `/api/url/csv` | Jobs from a CSV/Excel of URLs |
| POST | `/api/create/single` | Generate one design from a text prompt |
| POST | `/api/create/bulk` | Generate one design per prompt line |
| POST | `/api/create/recreate` | Recreate a print from an uploaded image (image-to-image) |
| GET | `/api/jobs` | List jobs (`?batchId=` filter) |
| GET | `/api/jobs/:id` | Get one job |
| POST | `/api/jobs/:id/retry` | Retry a job |
| POST | `/api/jobs/:id/reprocess` | Re-run with a manual crop / different mode |
| GET | `/api/jobs/:id/source` | Stream the original source image |
| GET | `/api/download/:filename` | Download a PNG (`?size=2000…5000`) |
| GET | `/api/download-zip/:batchId` | Download all batch outputs as ZIP |
| GET | `/api/report/:batchId` | CSV report for a batch |

All routes except `/api/login` and `/api/health` require an authenticated
session. Every processing request requires the legal ownership checkbox
(`confirmOwnership=true`).

---

## 🧠 OpenAI Vision detection

The garment image is sent to OpenAI Vision, which returns strict JSON:

```json
{
  "print_found": true,
  "print_area": { "x": 0, "y": 0, "width": 0, "height": 0 },
  "garment_type": "tshirt",
  "print_type": "graphic",
  "confidence": 0.0,
  "recommended_mode": "dtf_ready"
}
```

This bounding box drives the crop. If the API key is missing or the call
fails, a safe center-chest heuristic is used so the app stays fully functional,
and manual export still works.

---

## 🛣 Roadmap / placeholders

The MVP is fully functional for: login, single/bulk upload, single/bulk URL,
AI print-area detection, crop, transparent PNG export, ZIP download, and job
history. The following are intentional placeholders for a later version:

- Remaining editor tools (rotate, perspective correction, magic erase /
  restore brushes, undo/redo). Manual crop is already functional.
- **AI Recreate Mode** generative reconstruction (needs a generative model).
- Real source↔output **similarity score** (currently approximated from
  detection confidence).
- Optional **Replicate / segmentation models** for higher-quality background
  removal.
- Durable storage (S3/GCS) and a persistent queue (BullMQ + Redis).

---

## ⚖️ Legal

Users must confirm they own each design or have permission to extract and reuse
it before any processing runs. Respect the terms of service of any site you
scrape.
