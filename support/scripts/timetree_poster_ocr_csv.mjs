/**
 * Export / import poster OCR review as CSV for spreadsheet editing.
 *
 *   node scripts/timetree_poster_ocr_csv.mjs export [review.json] [--out path.csv]
 *   node scripts/timetree_poster_ocr_csv.mjs import [review.csv] [--review review.json]
 *
 * Edit reviewer_venue, reviewer_capacity, and reviewer_notes in Excel/Sheets, then import back and run:
 *   npm run calendar:timetree-ocr-import
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadVenuesCatalog } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const COLUMNS = [
  "match_key",
  "date",
  "event",
  "type",
  "reviewer_venue",
  "reviewer_capacity",
  "reviewer_notes",
  "agent_suggested_venue",
  "agent_confidence",
  "auto_venue",
  "auto_confidence",
  "catalog_venue",
  "catalog_capacity",
  "suggested_venues",
  "open_time",
  "start_time",
  "poster_dates",
  "ticket_urls",
  "timetree_url",
  "poster_image",
  "agent_notes",
];

/** @param {unknown} v */
function escCsv(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {string} line */
function parseCsvLine(line) {
  /** @type {string[]} */
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** @param {{ times?: { kind: string, value: string }[] }} extracted */
function timesFromExtracted(extracted) {
  const open = extracted?.times?.find((t) => t.kind === "open")?.value ?? "";
  const start = extracted?.times?.find((t) => t.kind === "start")?.value ?? "";
  return { open_time: open, start_time: start };
}

/** @param {Record<string, unknown>} r */
function rowToCsvRecord(r) {
  const extracted = /** @type {{ venue_strings?: string[], catalog_venues?: { name: string }[], dates?: string[], times?: unknown[], ticket_urls?: string[] }} */ (
    r.extracted ?? {}
  );
  const { open_time, start_time } = timesFromExtracted(extracted);
  const poster0 = Array.isArray(r.ocr_posters) ? r.ocr_posters[0] : null;
  const cat = extracted.catalog_venues?.[0];
  const catalogVenue = typeof cat === "string" ? cat : cat?.name ?? "";
  const catalogCap =
    r.catalog_capacity ??
    (typeof cat === "object" && cat && "capacity" in cat ? cat.capacity : "") ??
    "";

  return {
    match_key: r.match_key ?? "",
    date: r.date ?? "",
    event: r.event ?? "",
    type: r.type ?? "",
    reviewer_venue: r.reviewer_venue ?? "",
    reviewer_capacity: r.reviewer_capacity ?? "",
    reviewer_notes: r.reviewer_notes ?? "",
    agent_suggested_venue: r.agent_suggested_venue ?? "",
    agent_confidence: r.agent_confidence ?? "",
    auto_venue: r.auto_venue ?? "",
    auto_confidence: r.auto_confidence ?? "",
    catalog_venue: catalogVenue,
    catalog_capacity: catalogCap,
    suggested_venues: (r.suggested_venues ?? extracted.venue_strings ?? []).join("; "),
    open_time,
    start_time,
    poster_dates: (extracted.dates ?? []).join("; "),
    ticket_urls: (extracted.ticket_urls ?? []).join(" "),
    timetree_url: r.timetree_url ?? "",
    poster_image: poster0?.local_image ?? "",
    agent_notes: r.agent_notes ?? "",
  };
}

function catalogCapacityByUid() {
  const { venues } = loadVenuesCatalog();
  const m = new Map();
  for (const v of venues) {
    const r = /** @type {Record<string, unknown>} */ (v);
    const uid = String(r.uid ?? "");
    const cap = r.capacity;
    if (uid && cap != null && Number(cap) > 0) m.set(uid, Number(cap));
  }
  return m;
}

function exportReview(reviewPath, outPath) {
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  const capByUid = catalogCapacityByUid();
  const slug = review.slug ?? "review";
  const defaultOut = path.join(
    root,
    "docs",
    "reference",
    "timetree_poster_ocr",
    `${slug}-poster-ocr-review.csv`,
  );
  const csvPath = outPath ?? defaultOut;

  const lines = [COLUMNS.join(",")];
  for (const r of review.reviews ?? []) {
    const rec = rowToCsvRecord(r);
    const cat = r.extracted?.catalog_venues?.[0];
    if (cat && typeof cat === "object" && cat.uid) {
      const cap = capByUid.get(String(cat.uid));
      if (cap) rec.catalog_capacity = cap;
    }
    lines.push(COLUMNS.map((c) => escCsv(rec[c])).join(","));
  }

  fs.mkdirSync(path.dirname(csvPath), { recursive: true });
  const body = `${lines.join("\r\n")}\r\n`;
  fs.writeFileSync(csvPath, `\uFEFF${body}`, "utf8");
  console.log(`Wrote ${csvPath} (${review.reviews?.length ?? 0} rows)`);
  console.log("Edit reviewer_venue and reviewer_notes, then:");
  console.log(`  node scripts/timetree_poster_ocr_csv.mjs import ${path.relative(root, csvPath)}`);
  console.log("  npm run calendar:timetree-ocr-import");
}

function importCsv(csvPath, reviewPath) {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const header = parseCsvLine(lines[0]);
  const colIdx = Object.fromEntries(header.map((h, i) => [h.trim(), i]));

  if (!reviewPath) {
    const base = path.basename(csvPath, ".csv");
    reviewPath = path.join(root, "support", "docs", "reference", "timetree_poster_ocr", `${base}.json`);
    if (!fs.existsSync(reviewPath)) {
      reviewPath = path.join(
        root,
        "docs",
        "reference",
        "timetree_poster_ocr",
        base.replace(/-poster-ocr-review$/, "") + "-poster-ocr-review.json",
      );
    }
  }
  if (!fs.existsSync(reviewPath)) {
    throw new Error(`Review JSON not found: ${reviewPath}. Pass --review path`);
  }

  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map((review.reviews ?? []).map((r) => [String(r.match_key), r]));

  let merged = 0;
  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    const get = (name) => {
      const i = colIdx[name];
      return i == null ? "" : (cells[i] ?? "").trim();
    };
    const key = get("match_key");
    if (!key) continue;
    const row = byKey.get(key);
    if (!row) {
      console.warn(`  skip unknown match_key: ${key}`);
      continue;
    }

    const rv = get("reviewer_venue");
    const rn = get("reviewer_notes");
    if (rv) row.reviewer_venue = rv;
    else if (cells[colIdx.reviewer_venue] === "") row.reviewer_venue = null;

    row.reviewer_notes = rn;

    const capRaw = get("reviewer_capacity");
    if (capRaw) {
      const cap = Number(capRaw);
      if (Number.isFinite(cap) && cap > 0) row.reviewer_capacity = cap;
    }

    const open = get("open_time");
    const start = get("start_time");
    const dates = get("poster_dates")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);

    if (!row.extracted || typeof row.extracted !== "object") row.extracted = {};
    const ex = /** @type {Record<string, unknown>} */ (row.extracted);
    /** @type {{ kind: string, value: string }[]} */
    const times = [];
    if (open) times.push({ kind: "open", value: open });
    if (start) times.push({ kind: "start", value: start });
    if (times.length) ex.times = times;
    if (dates.length) ex.dates = dates;

    merged += 1;
  }

  review.csv_imported_at = new Date().toISOString();
  review.csv_source = path.relative(root, csvPath).replace(/\\/g, "/");
  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  console.log(`Merged ${merged} rows into ${reviewPath}`);
}

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "export";
const fileArg = argv.find((a) => !a.startsWith("--") && a !== cmd);
const outIdx = argv.indexOf("--out");
const reviewIdx = argv.indexOf("--review");

if (cmd === "export") {
  const reviewPath = path.resolve(
    fileArg ?? path.join(root, "support/docs/reference/timetree_poster_ocr/akishibu-poster-ocr-review.json"),
  );
  const outPath = outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : undefined;
  exportReview(reviewPath, outPath);
} else if (cmd === "import") {
  const csvPath = path.resolve(
    fileArg ?? path.join(root, "support/docs/reference/timetree_poster_ocr/akishibu-poster-ocr-review.csv"),
  );
  const reviewPath = reviewIdx >= 0 ? path.resolve(argv[reviewIdx + 1]) : undefined;
  importCsv(csvPath, reviewPath);
} else {
  console.error("Usage: export|import [file] [--out csv] [--review json]");
  process.exit(1);
}
