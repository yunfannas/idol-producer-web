/**
 * Patch TimeTree range JSON + OCR review for known multi-venue festivals.
 *
 * Usage:
 *   node scripts/applyMultiVenueFestivals.mjs [timetree-range.json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { liveMatchKey } from "./liveCatalogMatch.mjs";
import { applyMultiVenueFestival, MULTI_VENUE_FESTIVALS } from "./multiVenueFestivals.mjs";
import { stripVenueFromTitle } from "./timetreeEventParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const timetreePath = path.resolve(
  process.argv[2] ?? path.join(root, "public", "data", "timetree", "akishibu-2025-07-2026-05.json"),
);
const reviewPath = path.join(root, "docs/reference/timetree_poster_ocr/akishibu-poster-ocr-review.json");

const data = JSON.parse(fs.readFileSync(timetreePath, "utf8"));
let patched = 0;

for (const row of data.events ?? []) {
  const title = stripVenueFromTitle(String(row.event_raw ?? row.event ?? ""));
  const key = liveMatchKey({ date: String(row.date ?? ""), name: title });
  if (applyMultiVenueFestival(row, key)) patched += 1;
}

data.multi_venue_patched_at = new Date().toISOString();
fs.writeFileSync(timetreePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.error(`Patched ${patched} events in ${timetreePath}`);

if (fs.existsSync(reviewPath)) {
  const review = JSON.parse(fs.readFileSync(reviewPath, "utf8"));
  let reviewPatched = 0;
  for (const r of review.reviews ?? []) {
    const spec = MULTI_VENUE_FESTIVALS[r.match_key];
    if (!spec) continue;
    r.type = "Festival";
    r.venue_mode = "multi_venue_festival";
    r.venue_area = spec.venue_area;
    r.venues = spec.venues;
    r.reviewer_venue = spec.venue_summary;
    r.reviewer_notes =
      "Multi-venue festival — single `venue` is area summary; see `venues[]` for halls. Not one physical room.";
    r.agent_suggested_venue = spec.venue_summary;
    r.agent_confidence = "high";
    r.agent_notes = `Festival across ${spec.venues.length} venues in ${spec.venue_area ?? "area TBD"}`;
    reviewPatched += 1;
  }
  fs.writeFileSync(reviewPath, `${JSON.stringify(review, null, 2)}\n`, "utf8");
  console.error(`Updated ${reviewPatched} rows in ${reviewPath}`);
}
