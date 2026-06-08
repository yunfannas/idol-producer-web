/**
 * Scrape Takane no Nadeshiko official schedule.
 *
 * Strategy:
 * 1. Try the official schedule page's navigable month calendar with Playwright.
 * 2. Fall back to event sitemap/category archives for detail URLs.
 * 3. Merge in structured schedule rows parsed from NEWS posts.
 *
 * Usage:
 *   node scripts/official_schedule_takanen_scrape.mjs [startYYYY-MM] [endYYYY-MM] [--create-venues]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyGuestLiveGameplayPending,
  applyOfflineEventGameplayPending,
  applyTvShowGameplayPending,
  resolveGuestLiveVenue,
} from "./timetreeEventParse.mjs";
import {
  applyTakanenEventOverrides,
  collectTakanenCalendarEventRows,
  collectTakanenEventPageUrls,
  dateInRange,
  fetchTakanenNewsScheduleRows,
  parseTakanenEventPageHtml,
  pickBetterTakanenRow,
  takanenRowDedupeKey,
} from "./takanenOfficialScheduleParse.mjs";
import {
  applyMeetGreetDefaultVenue,
  loadVenuesCatalog,
  resolveVenueInDatabase,
  saveVenuesCatalog,
} from "./timetreeVenueDb.mjs";
import { mergeIlifeGuestRowsIntoSchedule } from "./mergeTakanenIlifeGuestRows.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const groupKey = "takanenonadeshiko";
const startYm = process.argv[2] ?? "2025-07";
const endYm = process.argv[3] ?? "2026-07";
const createVenues = process.argv.includes("--create-venues");

const groupsPath = path.join(root, "public", "data", "reference", "official_schedule_groups.json");
const config = JSON.parse(fs.readFileSync(groupsPath, "utf8")).groups?.[groupKey];
if (!config) {
  console.error(`Missing ${groupKey} in ${groupsPath}`);
  process.exit(1);
}

const catalog = loadVenuesCatalog();
let venuesCreated = 0;

console.error(`Trying schedule page calendar navigation ${startYm} -> ${endYm}`);
const calendarResult = await collectTakanenCalendarEventRows(
  config.schedule_url ?? `${config.base_url.replace(/\/$/, "")}/schedule/`,
  startYm,
  endYm,
);
console.error(
  `  ${calendarResult.rows.length} calendar rows across ${calendarResult.attempted_months.length} month(s)` +
    (calendarResult.blocked ? `; blocked months: ${calendarResult.blocked_months.join(", ")}` : "") +
    (calendarResult.error ? `; note: ${calendarResult.error}` : ""),
);

console.error(`Collecting event pages (sitemap + category archives)`);
const urls = new Set(await collectTakanenEventPageUrls(config.base_url));
for (const row of calendarResult.rows) {
  if (row.official_detail_url) urls.add(String(row.official_detail_url));
}
console.error(`  ${urls.size} unique event URLs`);

console.error(`Fetching NEWS schedule posts ${startYm} -> ${endYm} (full archive since 2022-08)`);
const newsRows = await fetchTakanenNewsScheduleRows(config.base_url, startYm, endYm);
console.error(`  ${newsRows.length} schedule rows from news in range (before dedupe)`);

/** @type {Map<string, Record<string, unknown>>} */
const byKey = new Map();

function pushRow(row) {
  applyTakanenEventOverrides(row);
  const key = takanenRowDedupeKey(row);
  const prev = byKey.get(key);
  if (prev) {
    byKey.set(key, pickBetterTakanenRow(prev, row));
    return;
  }
  byKey.set(key, row);
}

for (const row of newsRows) {
  if (!row.date || !dateInRange(row.date, startYm, endYm)) continue;
  pushRow(row);
}

for (const row of calendarResult.rows) {
  if (!row.date || !dateInRange(String(row.date), startYm, endYm)) continue;
  pushRow(row);
}

function resolveRowVenue(row) {
  if (row.type === "Meet") {
    applyMeetGreetDefaultVenue(row, catalog, { create: createVenues, source: `official ${groupKey}` });
  } else if (row.type === "TvShow") {
    applyTvShowGameplayPending(row);
  } else if (row.type === "OfflineEvent") {
    applyOfflineEventGameplayPending(row);
  } else if (row.type === "GuestLive") {
    applyGuestLiveGameplayPending(row);
    const spec = resolveGuestLiveVenue(row);
    if (row.venue) {
      const resolved = resolveVenueInDatabase(row.venue, catalog, {
        create: createVenues,
        source: `official ${groupKey}`,
        capacity: spec.capacity ?? undefined,
        setting: "outdoor",
        city: spec.city ?? undefined,
        venue_type: "Stadium",
      });
      if (resolved.created) venuesCreated += 1;
      if (resolved.venue_uid) {
        row.venue_uid = resolved.venue_uid;
        row.venue = resolved.venue_name ?? row.venue;
      }
    }
  } else if (row.venue && !row.venue_uid) {
    const resolved = resolveVenueInDatabase(row.venue, catalog, {
      create: createVenues,
      source: `official ${groupKey}`,
    });
    if (resolved.created) venuesCreated += 1;
    if (resolved.venue_uid) {
      row.venue_uid = resolved.venue_uid;
      row.venue = resolved.venue_name ?? row.venue;
    }
  }
}

async function fetchTextWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, {
        headers: { "user-agent": "idol-producer-web/0.1 (official schedule scrape)" },
      });
      if (!res.ok) {
        if (res.status >= 500 && i < tries - 1) {
          await new Promise((r) => setTimeout(r, 350 * (i + 1)));
          continue;
        }
        return { ok: false, status: res.status, text: "" };
      }
      return { ok: true, status: res.status, text: await res.text() };
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 350 * (i + 1)));
    }
  }
  return { ok: false, status: 0, text: "" };
}

for (const url of urls) {
  await new Promise((r) => setTimeout(r, 200));
  const res = await fetchTextWithRetry(url, 3);
  if (!res.ok) {
    console.error(`  skip ${url} HTTP ${res.status}`);
    continue;
  }
  const row = parseTakanenEventPageHtml(res.text, url);
  if (!row.date || !dateInRange(row.date, startYm, endYm)) continue;
  pushRow(row);
}

const allEvents = [...byKey.values()];

for (const row of allEvents) resolveRowVenue(row);

if (venuesCreated > 0) saveVenuesCatalog(catalog);

allEvents.sort((a, b) => `${a.date}\t${a.event}`.localeCompare(`${b.date}\t${b.event}`));

const { events: withGuests, added: guestRowsAdded } = mergeIlifeGuestRowsIntoSchedule(allEvents);
if (guestRowsAdded) console.error(`  +${guestRowsAdded} iLiFE TimeTree guest rows`);
withGuests.sort((a, b) => `${a.date}\t${a.event}`.localeCompare(`${b.date}\t${b.event}`));

const [fromY, fromM] = startYm.split("-");
const [toY, toM] = endYm.split("-");
const outDir = path.join(root, "public", "data", "official_schedules");
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${groupKey}-${fromY}-${fromM}-${toY}-${toM}.json`);

const payload = {
  source: "official",
  group_key: groupKey,
  group_name: config.group_name,
  base_url: config.base_url,
  scrape_method: "schedule_page_calendar+sitemap+news+ilife_cross_ref",
  range: { from: startYm, to: endYm },
  generated_at: new Date().toISOString(),
  event_count: withGuests.length,
  cross_ref_sources: ["ilife_timetree"],
  events: withGuests,
};

fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const byType = Object.groupBy(withGuests, (e) => e.type);
console.error(`\nWrote ${outPath} (${withGuests.length} events in range)`);
for (const [type, rows] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
  const withVenue = rows.filter((r) => r.venue).length;
  console.error(`  ${type}: ${rows.length} (${withVenue} with venue)`);
}
if (venuesCreated) console.error(`  created ${venuesCreated} venue stub(s)`);
