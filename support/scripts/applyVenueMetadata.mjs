/**
 * Apply curated venue metadata from support/docs/reference/venues_capacity.csv
 * to both runtime venue catalogs.
 *
 * CSV columns: name,capacity,setting,city,venue_type
 *
 * Usage:
 *   node support/scripts/applyVenueMetadata.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { normalizeVenueKey } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const csvPath = path.join(root, "support", "docs", "reference", "venues_capacity.csv");
const venuePaths = [
  path.join(root, "public", "data", "venues.json"),
  path.join(root, "src", "engine", "data", "venues.json"),
];

const aliases = new Map([
  [normalizeVenueKey("白金高輪 セレネ スタジオ SELENE b2"), normalizeVenueKey("白金高輪SELENE b2")],
  [normalizeVenueKey("白金高輪SELENE STUDIO SELENE b2"), normalizeVenueKey("白金高輪SELENE b2")],
  [normalizeVenueKey("Ebisu Garden Hall"), normalizeVenueKey("恵比寿ガーデンホール")],
  [normalizeVenueKey("TACHIKAWA STAGE GARDEN"), normalizeVenueKey("立川ステージガーデン")],
  [normalizeVenueKey("歌舞伎町タワーステージ"), normalizeVenueKey("KABUKICHO TOWER STAGE")],
  [normalizeVenueKey("シティーホール五反田"), normalizeVenueKey("シティホール五反田")],
]);

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQuote) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQuote = false;
      } else cur += c;
    } else if (c === '"') inQuote = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function loadMetadata() {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  const header = parseCsvLine(lines[0]).map((x) => x.trim());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  for (const required of ["name", "capacity", "setting", "city", "venue_type"]) {
    if (idx[required] == null) throw new Error(`CSV missing column: ${required}`);
  }
  const rows = new Map();
  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const get = (k) => String(cells[idx[k]] ?? "").trim();
    const name = get("name");
    if (!name) continue;
    const capacity = Number(get("capacity"));
    rows.set(normalizeVenueKey(name), {
      name,
      capacity: Number.isFinite(capacity) && capacity > 0 ? capacity : null,
      setting: get("setting") || null,
      city: get("city") || null,
      venue_type: get("venue_type") || null,
    });
  }
  return rows;
}

const metadata = loadMetadata();

for (const venuePath of venuePaths) {
  const data = JSON.parse(fs.readFileSync(venuePath, "utf8"));
  if (!Array.isArray(data.venues)) throw new Error(`No venues[] in ${venuePath}`);

  let updated = 0;
  let unmatched = 0;
  for (const venue of data.venues) {
    const rawKey = normalizeVenueKey(venue.name ?? "");
    const canonicalKey = aliases.get(rawKey) ?? rawKey;
    const meta = metadata.get(rawKey) ?? metadata.get(canonicalKey);
    if (!meta) {
      unmatched++;
      continue;
    }
    if (meta.capacity != null) venue.capacity = meta.capacity;
    if (meta.setting) venue.setting = meta.setting;
    if (meta.city) {
      venue.city = meta.city;
      venue.location = meta.city;
    }
    if (meta.venue_type) venue.venue_type = meta.venue_type;
    updated++;
  }

  fs.writeFileSync(venuePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  console.log(`${path.relative(root, venuePath)}: updated ${updated}; unmatched existing rows ${unmatched}`);
}
