/**
 * Apply reviewer_venue (or auto_venue when --use-auto) from poster OCR review → timetree JSON.
 *
 * Usage:
 *   node scripts/timetree_poster_import_review.mjs [review.json] [--use-auto] [--min-confidence high]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { liveMatchKey } from "./liveCatalogMatch.mjs";
import { stripVenueFromTitle } from "./timetreeEventParse.mjs";
import { loadVenuesCatalog, resolveVenueInDatabase, saveVenuesCatalog } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const argv = process.argv.slice(2);
const useAuto = argv.includes("--use-auto");
const minConf = argv.includes("--min-confidence")
  ? argv[argv.indexOf("--min-confidence") + 1]
  : "high";
const reviewPath = path.resolve(
  argv.find((a) => !a.startsWith("--")) ??
    path.join(root, "docs/reference/timetree_poster_ocr/akishibu-poster-ocr-review.json"),
);

const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
const timetreePath = path.join(root, review.source_file);
const data = JSON.parse(fs.readFileSync(timetreePath, "utf8"));
const catalog = loadVenuesCatalog();
const createVenues = argv.includes("--create-venues");

/** @type {Map<string, typeof review.reviews[0]>} */
const byKey = new Map(review.reviews.map((r) => [r.match_key, r]));

let updated = 0;
for (const row of data.events ?? []) {
  const displayName = stripVenueFromTitle(String(row.event_raw ?? row.event ?? "")) || String(row.event ?? "");
  const key = liveMatchKey({ date: row.date, name: displayName });
  const rev = byKey.get(key);
  if (!rev) continue;

  let venueName = rev.reviewer_venue;
  if (!venueName && useAuto && rev.auto_venue) {
    const ok =
      rev.auto_confidence === "high" ||
      (minConf === "medium" && (rev.auto_confidence === "high" || rev.auto_confidence === "medium"));
    if (ok) venueName = rev.auto_venue;
  }
  if (!venueName) continue;

  const cap =
    rev.reviewer_capacity != null && Number(rev.reviewer_capacity) > 0
      ? Number(rev.reviewer_capacity)
      : null;

  const resolved = resolveVenueInDatabase(venueName, catalog, {
    create: createVenues,
    source: "poster OCR review",
    capacity: cap,
  });
  row.venue = resolved.venue_name;
  row.venue_uid = resolved.venue_uid;
  if (rev.reviewer_notes) row.venue_source_note = rev.reviewer_notes;
  updated += 1;
}

fs.writeFileSync(timetreePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
if (createVenues) saveVenuesCatalog(catalog);

console.log(`Updated ${updated} events in ${timetreePath}`);
