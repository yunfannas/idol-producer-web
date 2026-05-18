/**
 * Fetch TimeTree event detail pages for venue text; attach poster URLs when missing;
 * match or create rows in venues.json.
 *
 * Usage:
 *   node scripts/timetree_resolve_venues.mjs [path-to-range.json] [--create-venues] [--no-fetch]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  extractVenueFromPublicEvent,
  posterUrlsFromPublicEvent,
  publicEventsFromApiBody,
} from "./timetreeApiExtract.mjs";
import { liveMatchKey, lookupCatalogVenue } from "./liveCatalogMatch.mjs";
import { enrichTimetreeEvent, stripVenueFromTitle } from "./timetreeEventParse.mjs";
import { loadVenuesCatalog, resolveVenueInDatabase, saveVenuesCatalog } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultPath = path.join(root, "public", "data", "timetree", "akishibu-2025-07-2026-05.json");
const liveCatalogPath = path.join(root, "public", "data", "live_events_catalog.json");

const argv = process.argv.slice(2);
const createVenues = argv.includes("--create-venues");
const noFetch = argv.includes("--no-fetch");
const filePath = path.resolve(argv.find((a) => !a.startsWith("--")) ?? defaultPath);

const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
if (!Array.isArray(data.events)) {
  console.error("No events array in", filePath);
  process.exit(1);
}

const slugMatch = /public_calendars\/([^/?#]+)/.exec(String(data.source_url ?? ""));
const slug = data.slug ?? slugMatch?.[1] ?? "akishibu";

function needsDetailFetch(row) {
  if (row.venue) return false;
  if (row.venue_hint) return false;
  return Boolean(row.timetree_url || row.timetree_id);
}

/** @param {import('playwright').Page} page @param {string} eventUrl @param {string} id */
async function fetchPublicEventDetail(page, eventUrl, id) {
  let detail = null;
  const handler = async (response) => {
    try {
      const u = response.url();
      if (!u.includes(`/public_events/${id}`)) return;
      const ct = (response.headers()["content-type"] ?? "").toLowerCase();
      if (!ct.includes("json")) return;
      detail = await response.json();
    } catch {
      /* ignore */
    }
  };
  page.on("response", handler);
  try {
    await page.goto(eventUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    await page.waitForTimeout(2500);
  } finally {
    page.off("response", handler);
  }
  const list = publicEventsFromApiBody(detail);
  return list[0] ?? null;
}

let chromium;
if (!noFetch) {
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    console.error("Install Playwright for detail fetch, or pass --no-fetch");
    process.exit(1);
  }
}

const venueCatalog = loadVenuesCatalog();
/** @type {import('./liveCatalogMatch.mjs').LiveEventsCatalog | null} */
let liveCatalog = null;
if (fs.existsSync(liveCatalogPath)) {
  liveCatalog = JSON.parse(fs.readFileSync(liveCatalogPath, "utf8"));
}

let browser = null;
let page = null;
if (chromium) {
  browser = await chromium.launch({ headless: true });
  page = await browser.newPage();
  await page.goto(`https://timetreeapp.com/public_calendars/${slug}?monthly=2025-07-01`, {
    waitUntil: "domcontentloaded",
    timeout: 60_000,
  });
  await page.waitForTimeout(2000);
}

let fetched = 0;
let venuesCreated = 0;
let postersAttached = 0;
let catalogHits = 0;

for (const raw of data.events) {
  let row = { ...raw };

  if (!row.venue && !row.venue_hint && liveCatalog) {
    const title = stripVenueFromTitle(String(row.event_raw ?? row.event ?? ""));
    const key = liveMatchKey({ date: String(row.date ?? ""), name: title });
    const known = lookupCatalogVenue(liveCatalog, key);
    if (known?.venue) {
      row.venue = known.venue;
      row.venue_uid = known.venue_uid ?? undefined;
      if (!row.poster_image_url && known.poster_image_url) {
        row.poster_image_url = known.poster_image_url;
      }
      row.live_catalog_match_key = key;
      catalogHits += 1;
    }
  }

  if (!noFetch && page && needsDetailFetch(row)) {
    const id = String(row.timetree_id ?? "").trim();
    const eventUrl =
      String(row.timetree_url ?? "").trim() ||
      (id ? `https://timetr.ee/p/${slug}/${id}` : "");
    if (eventUrl && id) {
      const pe = await fetchPublicEventDetail(page, eventUrl, id);
      fetched += 1;
      if (pe && typeof pe === "object") {
        const o = /** @type {Record<string, unknown>} */ (pe);
        if (!row.note && o.note) row.note = String(o.note);
        if (!row.location_name && o.location_name) row.location_name = String(o.location_name);
        const hint = extractVenueFromPublicEvent(o);
        if (hint) row.venue_hint = hint;
        const posters = posterUrlsFromPublicEvent(o);
        if (posters.length) row.poster_urls = posters;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
  }

  const enriched = enrichTimetreeEvent(row);
  row = { ...row, ...enriched };

  if (!row.venue) {
    const posters = row.poster_urls ?? [];
    if (posters.length) {
      row.poster_image_url = posters[0];
      row.poster_urls = posters;
      postersAttached += 1;
    }
  }

  if (row.venue) {
    const resolved = resolveVenueInDatabase(row.venue, venueCatalog, {
      create: createVenues,
      source: `TimeTree ${slug}`,
    });
    if (resolved.venue_uid) row.venue_uid = resolved.venue_uid;
    if (resolved.venue_name) row.venue = resolved.venue_name;
    if (resolved.created) venuesCreated += 1;
  }

  // Preserve scrape metadata; enriched fields overwrite in place.
  for (const key of Object.keys(row)) {
    if (row[key] === undefined) delete row[key];
    else raw[key] = row[key];
  }
}

if (browser) await browser.close();

if (venuesCreated > 0) {
  saveVenuesCatalog(venueCatalog);
  console.error(`Created ${venuesCreated} venue(s) in venues.json`);
}

data.event_count = data.events.length;
data.venues_resolved_at = new Date().toISOString();
data.venue_stats = {
  with_venue: data.events.filter((e) => e.venue).length,
  with_poster_only: data.events.filter((e) => !e.venue && e.poster_image_url).length,
  with_venue_uid: data.events.filter((e) => e.venue_uid).length,
};

fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");

console.error(`Updated ${filePath}`);
console.error(`  live catalog venue hits: ${catalogHits}`);
console.error(`  detail pages fetched: ${fetched}`);
console.error(`  with venue: ${data.venue_stats.with_venue}`);
console.error(`  poster only (no venue text): ${data.venue_stats.with_poster_only}`);
console.error(`  linked venue_uid: ${data.venue_stats.with_venue_uid}`);
