/**
 * Build cross-group live catalog from TimeTree range JSON files.
 * Merges the same show on the same day across groups; propagates venue/time.
 *
 * Usage:
 *   node scripts/buildLiveEventsCatalog.mjs [--timetree-dir DIR] [--out PATH]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  liveMatchKey,
  liveUidFromMatchKey,
  lookupCatalogVenue,
  normalizeLiveName,
  parseLiveTimesFromNote,
  pickBestVenueFields,
} from "./liveCatalogMatch.mjs";
import { applyMultiVenueFestival } from "./multiVenueFestivals.mjs";
import {
  isCommercialPromoEvent,
  isPlaceholderLiveTitle,
  isVirtualLiveEvent,
  stripVenueFromTitle,
} from "./timetreeEventParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const args = process.argv.slice(2);
function flag(name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const timetreeDir = path.resolve(flag("--timetree-dir") ?? path.join(root, "public", "data", "timetree"));
const outPath = path.resolve(
  flag("--out") ?? path.join(root, "public", "data", "live_events_catalog.json"),
);
const slugMapPath = path.join(root, "public", "data", "reference", "timetree_group_slugs.json");

/** @type {Record<string, string>} */
const slugGroups = JSON.parse(fs.readFileSync(slugMapPath, "utf8")).slugs ?? {};

function slugFromTimetreeFile(name, data) {
  if (data.slug) return data.slug;
  const m = /^(.+)-\d{4}-\d{2}-\d{4}-\d{2}\.json$/.exec(name);
  if (m) return m[1];
  const url = String(data.source_url ?? "");
  const um = /public_calendars\/([^/?#]+)/.exec(url);
  return um?.[1] ?? name.replace(/\.json$/, "");
}

function groupNameForSlug(slug) {
  if (slugGroups[slug]) return slugGroups[slug];
  return slug;
}

/** @param {string} dir */
function listTimetreeRangeFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((n) => /-\d{4}-\d{2}-\d{4}-\d{2}\.json$/.test(n))
    .map((n) => path.join(dir, n));
}

/**
 * @param {Record<string, unknown>} row
 * @param {string} slug
 * @param {string} groupName
 */
function rowToOccurrence(row, slug, groupName) {
  const rawTitle = String(row.event_raw ?? row.event ?? "").trim();
  const displayName = stripVenueFromTitle(rawTitle) || rawTitle;
  const date = String(row.date ?? "").trim();
  if (!date || !displayName) return null;

  const match_key = liveMatchKey({ date, name: displayName });
  const times = parseLiveTimesFromNote(String(row.note ?? ""));

  /** @type {string[]} */
  const withGroups = Array.isArray(row.with) ? row.with.map((g) => String(g).trim()).filter(Boolean) : [];

  const occ = {
    match_key,
    name: normalizeLiveName(displayName),
    date,
    start_time: times.start_time,
    end_time: times.end_time,
    event_type: String(row.type ?? "Other"),
    venue: row.venue ? String(row.venue) : null,
    venue_uid: row.venue_uid ? String(row.venue_uid) : null,
    poster_image_url: row.poster_image_url ? String(row.poster_image_url) : null,
    venue_mode: row.venue_mode ? String(row.venue_mode) : undefined,
    venue_area: row.venue_area ? String(row.venue_area) : undefined,
    venues: Array.isArray(row.venues) ? row.venues.map(String) : undefined,
    with_groups: withGroups,
    attendee: {
      group_name: groupName,
      timetree_slug: slug,
      timetree_event_id: row.timetree_id ? String(row.timetree_id) : undefined,
      timetree_url: row.timetree_url ? String(row.timetree_url) : undefined,
      calendar_title: rawTitle,
    },
  };
  return occ;
}

const files = listTimetreeRangeFiles(timetreeDir);
if (!files.length) {
  console.error(`No TimeTree range JSON in ${timetreeDir}`);
  process.exit(1);
}

/** @type {Map<string, { occurrences: ReturnType<typeof rowToOccurrence>[], merged: Record<string, unknown> }>} */
const buckets = new Map();

for (const filePath of files) {
  const base = path.basename(filePath);
  const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
  const slug = slugFromTimetreeFile(base, data);
  const groupName = groupNameForSlug(slug);

  for (const row of data.events ?? []) {
    const rawTitle = String(row.event_raw ?? row.event ?? "").trim();
    if (isPlaceholderLiveTitle(rawTitle)) continue;
    if (isVirtualLiveEvent(row) || isCommercialPromoEvent(row)) continue;
    const occ = rowToOccurrence(row, slug, groupName);
    if (!occ) continue;
    if (!buckets.has(occ.match_key)) {
      buckets.set(occ.match_key, { occurrences: [], merged: {} });
    }
    buckets.get(occ.match_key).occurrences.push(occ);
  }
}

/** @type {import('./liveCatalogMatch.mjs').LiveCatalogEvent[]} */
const events = [];

let multiGroupCount = 0;
let venuePropagated = 0;

for (const [match_key, bucket] of buckets) {
  const occs = bucket.occurrences.filter(Boolean);
  if (!occs.length) continue;

  const venuePick = pickBestVenueFields(occs);
  if (venuePick.venue && occs.some((o) => !o.venue) && occs.some((o) => o.venue)) {
    venuePropagated += 1;
  }

  const attendeeMap = new Map();
  for (const o of occs) {
    const key = `${o.attendee.timetree_slug}\0${o.attendee.timetree_event_id ?? o.attendee.calendar_title}`;
    if (!attendeeMap.has(key)) attendeeMap.set(key, o.attendee);
  }
  const attending_groups = [...attendeeMap.values()];
  if (attending_groups.length > 1) multiGroupCount += 1;

  const withSet = new Set();
  for (const o of occs) for (const g of o.with_groups) withSet.add(g);

  let start_time = null;
  let end_time = null;
  for (const o of occs) {
    if (!start_time && o.start_time) start_time = o.start_time;
    if (!end_time && o.end_time) end_time = o.end_time;
  }

  let event_type = "Other";
  const typeCounts = new Map();
  for (const o of occs) {
    const t = o.event_type || "Other";
    typeCounts.set(t, (typeCounts.get(t) ?? 0) + 1);
  }
  const ranked = [...typeCounts.entries()].sort((a, b) => {
    if (a[0] === "Other") return 1;
    if (b[0] === "Other") return -1;
    return b[1] - a[1];
  });
  event_type = ranked[0]?.[0] ?? "Other";

  /** @type {Record<string, unknown>} */
  const catalogRow = {
    uid: liveUidFromMatchKey(match_key),
    match_key,
    name: occs[0].name,
    date: occs[0].date,
    start_time,
    end_time,
    event_type,
    venue: venuePick.venue,
    venue_uid: venuePick.venue_uid,
    poster_image_url: venuePick.poster_image_url,
    with_groups: [...withSet].sort(),
    attending_groups,
  };

  const srcWithVenues = occs.find((o) => o.venue_mode === "multi_venue_festival" && Array.isArray(o.venues));
  if (srcWithVenues) {
    catalogRow.venue_mode = "multi_venue_festival";
    catalogRow.venue_area = srcWithVenues.venue_area ?? null;
    catalogRow.venues = srcWithVenues.venues;
    catalogRow.venue = srcWithVenues.venue ?? catalogRow.venue;
    catalogRow.venue_uid = null;
    catalogRow.event_type = "Festival";
  } else {
    applyMultiVenueFestival(catalogRow, match_key);
  }

  events.push(catalogRow);
}

events.sort((a, b) => a.date.localeCompare(b.date) || a.name.localeCompare(b.name));

const catalog = {
  version: 1,
  generated_at: new Date().toISOString(),
  source_files: files.map((f) => path.relative(root, f).replace(/\\/g, "/")),
  slug_groups: slugGroups,
  event_count: events.length,
  stats: {
    timetree_source_rows: [...buckets.values()].reduce((n, b) => n + b.occurrences.length, 0),
    multi_group_events: multiGroupCount,
    venue_propagated_across_groups: venuePropagated,
  },
  events,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");

console.error(`Wrote ${outPath}`);
console.error(`  catalog events: ${events.length}`);
console.error(`  multi-group: ${multiGroupCount}`);
console.error(`  venue propagated merges: ${venuePropagated}`);

const sample = events.find((e) => e.attending_groups.length > 1 && e.venue);
if (sample) {
  console.error(`  example: ${sample.date} ${sample.name} @ ${sample.venue}`);
  console.error(`    groups: ${sample.attending_groups.map((g) => g.group_name).join(", ")}`);
}
