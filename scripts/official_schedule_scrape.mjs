/**
 * Scrape official group schedule list pages (month view).
 *
 * Usage:
 *   node scripts/official_schedule_scrape.mjs [groupKey] [startYYYY-MM] [endYYYY-MM]
 *
 * Example:
 *   node scripts/official_schedule_scrape.mjs equal-love 2025-07 2026-05
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseOfficialScheduleListHtml } from "./officialScheduleParse.mjs";
import { loadVenuesCatalog, resolveVenueInDatabase, saveVenuesCatalog } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const groupKey = process.argv[2] ?? "equal-love";
const startYm = parseYm(process.argv[3] ?? "2025-07");
const endYm = parseYm(process.argv[4] ?? "2026-05");
const createVenues = process.argv.includes("--create-venues");

const groupsPath = path.join(root, "public", "data", "reference", "official_schedule_groups.json");
const config = JSON.parse(fs.readFileSync(groupsPath, "utf8")).groups?.[groupKey];
if (!config) {
  console.error(`Unknown group key: ${groupKey}. See ${groupsPath}`);
  process.exit(1);
}

function parseYm(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) };
}

function monthKey(y, mo) {
  return y * 12 + (mo - 1);
}

function listUrl(cfg, y, mo) {
  const base = cfg.base_url.replace(/\/$/, "");
  const pathPart = cfg.list_path
    .replace("{year}", String(y))
    .replace("{month}", String(mo));
  const q = cfg.list_query ? `?${cfg.list_query}` : "";
  return `${base}${pathPart}${q}`;
}

if (!startYm || !endYm || monthKey(endYm.y, endYm.mo) < monthKey(startYm.y, startYm.mo)) {
  console.error("Invalid month range");
  process.exit(1);
}

const catalog = loadVenuesCatalog();
let venuesCreated = 0;

/** @type {import('./officialScheduleParse.mjs').parseOfficialScheduleListHtml extends Function ? ReturnType<typeof parseOfficialScheduleListHtml> : never} */
const allEvents = [];

for (let k = monthKey(startYm.y, startYm.mo); k <= monthKey(endYm.y, endYm.mo); k++) {
  const y = Math.floor(k / 12);
  const mo = (k % 12) + 1;
  const url = listUrl(config, y, mo);
  console.error(`Fetching ${url}`);

  const res = await fetch(url, {
    headers: { "user-agent": "idol-producer-web/0.1 (official schedule scrape)" },
  });
  if (!res.ok) {
    console.error(`  HTTP ${res.status} — skip`);
    continue;
  }
  const html = await res.text();
  const rows = parseOfficialScheduleListHtml(html, y, mo, config.base_url);
  console.error(`  ${rows.length} events`);

  for (const row of rows) {
    if (row.venue && !row.venue_uid) {
      const resolved = resolveVenueInDatabase(row.venue, catalog, {
        create: createVenues,
        source: `official schedule ${groupKey}`,
      });
      if (resolved.created) venuesCreated += 1;
      if (resolved.venue_uid) {
        row.venue_uid = resolved.venue_uid;
        row.venue = resolved.venue_name ?? row.venue;
      }
    }
    allEvents.push(row);
  }

  await new Promise((r) => setTimeout(r, 350));
}

if (venuesCreated > 0) saveVenuesCatalog(catalog);

const outDir = path.join(root, "public", "data", "official_schedules");
fs.mkdirSync(outDir, { recursive: true });
const outName = `${groupKey}-${String(startYm.y).padStart(4, "0")}-${String(startYm.mo).padStart(2, "0")}-${String(endYm.y).padStart(4, "0")}-${String(endYm.mo).padStart(2, "0")}.json`;
const outPath = path.join(outDir, outName);

const payload = {
  source: "official",
  group_key: groupKey,
  group_name: config.group_name,
  base_url: config.base_url,
  range: { from: `${startYm.y}-${String(startYm.mo).padStart(2, "0")}`, to: `${endYm.y}-${String(endYm.mo).padStart(2, "0")}` },
  generated_at: new Date().toISOString(),
  event_count: allEvents.length,
  events: allEvents,
};

fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

const byType = Object.groupBy(allEvents, (e) => e.type);
console.error(`\nWrote ${outPath} (${allEvents.length} events)`);
for (const [type, rows] of Object.entries(byType).sort((a, b) => b[1].length - a[1].length)) {
  const withVenue = rows.filter((r) => r.venue).length;
  console.error(`  ${type}: ${rows.length} (${withVenue} with venue)`);
}
if (venuesCreated) console.error(`  created ${venuesCreated} venue stub(s)`);
