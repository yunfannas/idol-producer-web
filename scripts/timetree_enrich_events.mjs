/**
 * Add type + venue (and optional with[]) to a merged TimeTree JSON file.
 * For venue detail pages + venues.json linking, run timetree_resolve_venues.mjs after this.
 *
 * Usage:
 *   node scripts/timetree_enrich_events.mjs [path-to-json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { enrichTimetreeEvent } from "./timetreeEventParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultPath = path.join(__dirname, "..", "public", "data", "timetree", "ilife_official-2025-07-2026-05.json");
const filePath = path.resolve(process.argv[2] ?? defaultPath);

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
if (!Array.isArray(data.events)) {
  console.error("No events array in", filePath);
  process.exit(1);
}

data.events = data.events.map((row) => ({ ...row, ...enrichTimetreeEvent(row) }));
data.event_count = data.events.length;
data.enriched_at = new Date().toISOString();

fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

const byType = Object.groupBy(data.events, (e) => e.type);
console.error(`Enriched ${filePath}`);
for (const [type, rows] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
  const withVenue = rows.filter((r) => r.venue).length;
  console.error(`  ${type}: ${rows.length} (${withVenue} with venue)`);
}
