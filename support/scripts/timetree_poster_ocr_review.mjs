/**
 * OCR TimeTree poster images for events missing venue; write review file.
 *
 * Usage:
 *   node scripts/timetree_poster_ocr_review.mjs [timetree-range.json] [--out-dir DIR] [--all]
 *   npm run calendar:timetree-ocr-review -- public/data/timetree/akishibu-2025-07-2026-05.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createWorker } from "tesseract.js";
import { liveMatchKey } from "./liveCatalogMatch.mjs";
import {
  extractFromEvent,
  isImageOnlyLive,
  pickPrimaryVenue,
  posterUrlsFor,
} from "./timetreePosterExtract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const timetreeDir = path.join(root, "public", "data", "timetree");

const argv = process.argv.slice(2);
const processAll = argv.includes("--all");
const inputPaths = processAll
  ? fs
      .readdirSync(timetreeDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => path.join(timetreeDir, f))
  : [
      path.resolve(
        argv.find((a) => !a.startsWith("--")) ??
          path.join(timetreeDir, "akishibu-2025-07-2026-05.json"),
      ),
    ];
const outDir = path.resolve(
  argv.includes("--out-dir")
    ? argv[argv.indexOf("--out-dir") + 1]
    : path.join(root, "support", "docs", "reference", "timetree_poster_ocr"),
);

async function downloadImage(url, dest) {
  const res = await fetch(url, { headers: { "user-agent": "idol-producer-web/0.1 (poster OCR review)" } });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.writeFileSync(dest, buf);
  return dest;
}

/**
 * @param {string} inputPath
 * @param {import('tesseract.js').Worker} worker
 */
async function processFile(inputPath, worker) {
  const data = JSON.parse(fs.readFileSync(inputPath, "utf8"));
  const slug = data.slug ?? path.basename(inputPath, ".json").split("-")[0] ?? "calendar";
  const targets = (data.events ?? []).filter(isImageOnlyLive);

  fs.mkdirSync(outDir, { recursive: true });
  const imagesDir = path.join(outDir, slug);

  console.error(`\n[${slug}] OCR ${targets.length} image-only lives → ${outDir}`);

  /** @type {unknown[]} */
  const reviews = [];

  for (let i = 0; i < targets.length; i++) {
    const row = targets[i];
    const urls = posterUrlsFor(row);
    const title = String(row.event ?? "");
    const date = String(row.date ?? "");
    const match_key = liveMatchKey({ date, name: title });

    console.error(`  [${i + 1}/${targets.length}] ${date} ${title}`);

    /** @type {unknown[]} */
    const ocrResults = [];
    let combinedOcr = "";

    for (let pi = 0; pi < urls.length; pi++) {
      const url = urls[pi];
      const ext = path.extname(new URL(url).pathname) || ".jpg";
      const safeKey = match_key.replace(/[|]/g, "_").slice(0, 48);
      const localName = `${date}_${safeKey}_${pi}${ext}`;
      const localPath = path.join(imagesDir, localName);

      try {
        await downloadImage(url, localPath);
        const { data: ocrData } = await worker.recognize(localPath);
        const text = (ocrData.text ?? "").trim();
        combinedOcr += `${text}\n`;
        const parsed = extractFromEvent(row, text);
        ocrResults.push({
          poster_index: pi,
          source_url: url,
          local_image: path.relative(root, localPath).replace(/\\/g, "/"),
          ocr_text: text,
          extracted: parsed.extracted,
          ocr_confidence: ocrData.confidence ?? null,
        });
      } catch (err) {
        ocrResults.push({
          poster_index: pi,
          source_url: url,
          error: String(err?.message ?? err),
        });
      }
    }

    const merged = extractFromEvent(row, combinedOcr);
    const auto = pickPrimaryVenue(merged.extracted);

    reviews.push({
      date,
      event: title,
      type: row.type ?? null,
      match_key,
      timetree_id: row.timetree_id ?? null,
      timetree_url: row.timetree_url ?? null,
      note: row.note ?? null,
      note_venue_hints: merged.note_venue_hints,
      ocr_posters: ocrResults,
      extracted: merged.extracted,
      suggested_venues: merged.extracted.venue_strings,
      auto_venue: auto.venue,
      auto_venue_uid: auto.venue_uid,
      auto_confidence: auto.confidence,
      reviewer_venue: null,
      reviewer_notes: "",
    });
  }

  const generated_at = new Date().toISOString();
  const jsonOut = {
    source_file: path.relative(root, inputPath).replace(/\\/g, "/"),
    slug,
    generated_at,
    event_count: reviews.length,
    instructions:
      "Set reviewer_venue to the correct catalog name (or null). Use extracted.* and auto_venue as hints. Re-import with timetree_poster_import_review.mjs when ready.",
    reviews,
  };

  const jsonPath = path.join(outDir, `${slug}-poster-ocr-review.json`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(jsonOut, null, 2)}\n`, "utf8");

  let md = `# TimeTree poster OCR review — ${slug}\n\n`;
  md += `Generated: ${generated_at}\n\n`;
  md += `Source: \`${jsonOut.source_file}\` — **${reviews.length}** image-only lives\n\n`;
  md += `Edit \`${path.basename(jsonPath)}\` → \`reviewer_venue\` / \`reviewer_notes\`.\n\n`;
  md += `| Date | Event | Auto venue | Catalog hits | OCR conf. |\n`;
  md += `|------|-------|------------|--------------|----------|\n`;
  for (const r of reviews) {
    const esc = (s) => String(s ?? "—").replace(/\|/g, "\\|");
    const cats = r.extracted?.catalog_venues?.map((v) => v.name).join(", ") || "—";
    const conf =
      r.ocr_posters?.find((p) => p.ocr_confidence != null)?.ocr_confidence?.toFixed(0) ?? "—";
    md += `| ${esc(r.date)} | ${esc(r.event)} | ${esc(r.auto_venue)} | ${esc(cats)} | ${conf}% |\n`;
  }
  md += `\n---\n\n`;

  for (const r of reviews) {
    md += `## ${r.date} — ${r.event}\n\n`;
    md += `- **Type:** ${r.type ?? "—"} | **Auto:** ${r.auto_venue ?? "—"} (${r.auto_confidence})\n`;
    md += `- **TimeTree:** ${r.timetree_url ?? "—"}\n`;
    if (r.note) md += `- **Note:**\n\n\`\`\`\n${r.note}\n\`\`\`\n`;
    if (r.extracted?.dates?.length) md += `- **Dates in poster:** ${r.extracted.dates.join(", ")}\n`;
    if (r.extracted?.times?.length) {
      md += `- **Times:** ${r.extracted.times.map((t) => `${t.kind} ${t.value}`).join("; ")}\n`;
    }
    if (r.extracted?.ticket_urls?.length) {
      md += `- **URLs:** ${r.extracted.ticket_urls.join(" ")}\n`;
    }
    md += `\n### Venue candidates\n\n`;
    if (r.suggested_venues?.length) {
      for (const v of r.suggested_venues) md += `- ${v}\n`;
    } else md += `_none_\n`;
    if (r.extracted?.catalog_venues?.length) {
      md += `\n**Catalog matches:** ${r.extracted.catalog_venues.map((v) => `${v.name} (\`${v.uid.slice(0, 8)}…\`)`).join(", ")}\n`;
    }
    md += `\n### Posters\n\n`;
    for (const p of r.ocr_posters ?? []) {
      if (p.error) {
        md += `- Poster ${p.poster_index}: **error** — ${p.error}\n`;
        continue;
      }
      md += `- ![poster ${p.poster_index}](${p.local_image})\n`;
      if (p.ocr_confidence != null) md += `  - OCR confidence: ${p.ocr_confidence.toFixed(1)}%\n`;
      md += `\n<details><summary>OCR raw text</summary>\n\n\`\`\`\n${p.ocr_text}\n\`\`\`\n\n</details>\n\n`;
    }
    md += `\n---\n\n`;
  }

  const mdPath = path.join(outDir, `${slug}-poster-ocr-review.md`);
  fs.writeFileSync(mdPath, md, "utf8");

  console.error(`  Wrote ${jsonPath}`);
  console.error(`  Wrote ${mdPath}`);
  return { slug, count: reviews.length, jsonPath };
}

console.error(`Poster OCR extract — ${inputPaths.length} file(s)`);
const worker = await createWorker("jpn", 1, {
  logger: (m) => {
    if (m.status === "recognizing text") process.stderr.write(`\r  OCR ${(m.progress * 100) | 0}%`);
  },
});
process.stderr.write("\n");

const summary = [];
for (const inputPath of inputPaths) {
  if (!fs.existsSync(inputPath)) {
    console.error(`Skip missing: ${inputPath}`);
    continue;
  }
  summary.push(await processFile(inputPath, worker));
}

await worker.terminate();

const indexPath = path.join(outDir, "index.json");
fs.writeFileSync(
  indexPath,
  `${JSON.stringify({ generated_at: new Date().toISOString(), files: summary }, null, 2)}\n`,
);
console.error(`\nDone. Index: ${indexPath}`);
for (const s of summary) console.error(`  ${s.slug}: ${s.count} events`);
