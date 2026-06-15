# Idol Producer Web

Static preview for the [Idol Producer](../) desktop game. The full game uses Python and Tkinter; this package is a **Vite + TypeScript** site that reads a small JSON bundle from `public/data/preview.json`.

## Regenerate data (from the main repo)

From the **parent** `idol_producer` repository root:

```bash
python support/reference/python-desktop/scripts/export_web_preview_bundle.py
```

Optional: `--preset test0` and `--out path/to/preview.json`.

## Local dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

Optional strict TypeScript check (not run in CI):

```bash
npm run typecheck
```

Output is `dist/`, suitable for GitHub Pages.

## Repo layout

Game/runtime files stay in `src/`, `public/data/`, and the root Vite config files.

Support material now lives under `support/`:

- `support/scripts/` for scraping and data-maintenance scripts
- `support/docs/` for plans, reference notes, and generated review CSVs
- `support/reports/` for simulation/report outputs
- `support/tmp/` and `support/.tmp/` for scratch/test artifacts
- `support/reference/python-desktop/` for mirrored desktop Python reference files
- `support/ocr/` for OCR language data

## Deploy on GitHub Pages (this monorepo)

The parent repository includes `.github/workflows/idol-producer-web-pages.yml`.

**One-time setup (required):** in the GitHub repo, open **Settings → Pages**. Under **Build and deployment**, set **Source** to **GitHub Actions** (not “Deploy from a branch”). Until this is done, the deploy job cannot publish the site.

After that, pushes under `idol-producer-web/` on `main` run the workflow; you can also run it manually from the **Actions** tab.

## Deploy as its **own** GitHub repository

1. Copy only the `idol-producer-web/` directory to a new repo root (or use `git subtree split`).
2. Move `.github/workflows/idol-producer-web-pages.yml` from the parent into this repo as `.github/workflows/pages.yml`, and change artifact `path` from `idol-producer-web/dist` to `dist`.
3. Push to GitHub and enable Pages (GitHub Actions source).
