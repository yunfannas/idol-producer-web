/**
 * Merge 高嶺のなでしこ guest appearances from iLiFE TimeTree into official schedule JSON.
 *
 * Usage:
 *   node scripts/mergeTakanenIlifeGuestRows.mjs [scheduleJsonPath]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { pickBetterTakanenRow, takanenRowDedupeKey } from "./takanenOfficialScheduleParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const schedulePath =
  process.argv[2] ??
  path.join(root, "public", "data", "official_schedules", "takanenonadeshiko-2025-07-2026-07.json");
const ilifePath = path.join(root, "public", "data", "timetree", "ilife_official-2025-07-2026-05.json");

/** @param {string} raw */
function stripDecorations(raw) {
  return String(raw ?? "")
    .replace(/^[\p{Extended_Pictographic}\u2600-\u27BF]+\s*/gu, "")
    .replace(/【サポメン:[^】]+】/g, "")
    .replace(/\s*@[^@]+$/u, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** @param {Record<string, unknown>} ev */
function takanenTitleFromIlife(ev) {
  const raw = stripDecorations(ev.event);
  if (/たかねこLiFE/i.test(String(ev.event))) return "iLiFE!×高嶺のなでしこ『たかねこLiFE!』";
  if (/FAVE IDOLS/i.test(raw)) return "FAVE IDOLS FES";
  if (/iLiVE! SUMMER/i.test(raw)) return "iLiVE! SUMMER -いくぞッ！武道館SP-";
  if (/IDOL SUMMER JUNGLE/i.test(raw)) return "IDOL SUMMER JUNGLE";
  if (/iLiVE! HALLOWEEN/i.test(raw)) return "iLiVE! HALLOWEEN";
  if (/LARME FES/i.test(raw)) return "LARME FES'25";
  if (/HEROINES HALLOWEEN/i.test(raw)) return "HEROINES HALLOWEEN DAY2";
  if (/HEROINES Xmas DAY1/i.test(raw)) return "HEROINES Xmas DAY1";
  if (/LEGEND FES/i.test(raw)) return "LEGEND FES";
  if (/Idol Valentine Fes/i.test(raw)) return "Idol Valentine Fes 2026";
  if (/HEROINES WHITEDAY/i.test(raw)) return "HEROINES WHITEDAY -DAY2-";
  return raw;
}

/** @param {Record<string, unknown>} ev */
function takanenTypeFromIlife(ev) {
  const title = takanenTitleFromIlife(ev);
  if (/たかねこLiFE!|iLiVE! HALLOWEEN|HEROINES HALLOWEEN|HEROINES Xmas|HEROINES WHITEDAY|iLiVE! SUMMER/i.test(title)) {
    return "Taiban";
  }
  return "Festival";
}

/** @param {Record<string, unknown>} ev */
function venueFieldsFromIlife(ev) {
  const title = takanenTitleFromIlife(ev);
  /** @type {Record<string, { venue: string, venue_hint?: string, venue_uid?: string, end_date?: string }>} */
  const overrides = {
    "FAVE IDOLS FES": {
      venue: "恵比寿ガーデンホール",
      venue_hint: "恵比寿ガーデンホール",
      venue_uid: "4dd55fd1-f208-44dd-a93a-3b323c7eb68e",
    },
    "IDOL SUMMER JUNGLE": {
      venue: "お台場R地区",
      venue_hint: "お台場R地区",
      venue_uid: "c6da72fa-6d7e-4230-a967-cfa74bf55331",
      end_date: "2025-08-11",
    },
    "iLiFE!×高嶺のなでしこ『たかねこLiFE!』": {
      venue: "Zepp Haneda",
      venue_hint: "Zepp Haneda (TOKYO)",
      venue_uid: "42537f27-f835-4121-b820-acdb79ac7bab",
    },
    "Zepp DiverCity": {
      venue: "Zepp DiverCity",
      venue_hint: "Zepp DiverCity(TOKYO)",
      venue_uid: "9cf0f843-3170-4d82-b32f-d13c9793fb44",
    },
  };
  if (overrides[title]) return overrides[title];
  if (/HEROINES HALLOWEEN DAY2/.test(title)) return overrides["Zepp DiverCity"];

  const venue = String(ev.venue ?? "").trim();
  const venue_hint = String(ev.venue_hint ?? ev.location_name ?? venue).trim();
  /** @type {{ venue: string, venue_hint: string, venue_uid?: string }} */
  const out = { venue, venue_hint: venue_hint || venue };
  if (ev.venue_uid) out.venue_uid = String(ev.venue_uid);
  if (/Zepp Haneda/i.test(venue)) {
    out.venue = "Zepp Haneda";
    out.venue_uid = out.venue_uid ?? "42537f27-f835-4121-b820-acdb79ac7bab";
  }
  return out;
}

/** @param {Record<string, unknown>} ev */
function rowFromIlifeGuest(ev) {
  const title = takanenTitleFromIlife(ev);
  const venueFields = venueFieldsFromIlife(ev);
  const type = takanenTypeFromIlife(ev);
  return {
    date: String(ev.date ?? "").slice(0, 10),
    end_date: venueFields.end_date,
    event: title,
    event_raw: title,
    site_category: "出演（iLiFE TimeTree）",
    type,
    venue: venueFields.venue || null,
    venue_hint: venueFields.venue_hint || null,
    note: String(ev.note ?? "").slice(0, 4000),
    official_detail_url: String(ev.timetree_url ?? ""),
    official_detail_slug: String(ev.timetree_id ?? ""),
    source: "ilife_timetree_cross_ref",
    ...(venueFields.venue_uid ? { venue_uid: venueFields.venue_uid } : {}),
  };
}

/** @param {Record<string, unknown>[]} events */
export function mergeIlifeGuestRowsIntoSchedule(events) {
  const ilife = JSON.parse(fs.readFileSync(ilifePath, "utf8"));
  /** @type {Map<string, Record<string, unknown>>} */
  const byKey = new Map();
  for (const row of events) {
    byKey.set(takanenRowDedupeKey(row), row);
  }
  let added = 0;
  for (const ev of ilife.events ?? []) {
    const note = String(ev.note ?? "");
    if (!/高嶺のなでしこ|たかねこ/i.test(note)) continue;
    const row = rowFromIlifeGuest(ev);
    if (!row.date) continue;
    const key = takanenRowDedupeKey(row);
    const prev = byKey.get(key);
    if (prev) byKey.set(key, pickBetterTakanenRow(prev, row));
    else {
      byKey.set(key, row);
      added += 1;
    }
  }
  return { events: [...byKey.values()], added };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const schedulePath =
    process.argv[2] ??
    path.join(root, "public", "data", "official_schedules", "takanenonadeshiko-2025-07-2026-07.json");
  const schedule = JSON.parse(fs.readFileSync(schedulePath, "utf8"));
  const { events, added } = mergeIlifeGuestRowsIntoSchedule(schedule.events ?? []);
  schedule.events = events.sort((a, b) => `${a.date}\t${a.event}`.localeCompare(`${b.date}\t${b.event}`));
  schedule.event_count = schedule.events.length;
  schedule.generated_at = new Date().toISOString();
  schedule.cross_ref_sources = [...new Set([...(schedule.cross_ref_sources ?? []), "ilife_timetree"])];
  fs.writeFileSync(schedulePath, `${JSON.stringify(schedule, null, 2)}\n`, "utf8");
  console.error(`Updated ${schedulePath}`);
  console.error(`  +${added} new guest rows (${schedule.event_count} total)`);
}
