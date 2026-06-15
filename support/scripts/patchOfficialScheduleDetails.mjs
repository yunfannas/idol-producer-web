/**
 * Apply venue + type fixes from equal-love.jp schedule detail pages.
 *
 * Usage:
 *   node scripts/patchOfficialScheduleDetails.mjs [path-to-official-json]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  applyOfflineEventGameplayPending,
  applyTvShowGameplayPending,
} from "./timetreeEventParse.mjs";
import { loadVenuesCatalog, resolveVenueInDatabase, saveVenuesCatalog } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const defaultFile = path.join(root, "public", "data", "official_schedules", "equal-love-2025-07-2026-05.json");

/** @type {{ id: string, type: string, venue: string, venue_hint?: string, capacity?: number, setting?: "indoor"|"outdoor", city?: string, venue_type?: string, is_live?: boolean, note?: string, apply_pending?: boolean }[]} */
const DETAIL_PATCHES = [
  {
    id: "10042",
    type: "Festival",
    venue: "六本木ヒルズアリーナ",
    venue_hint: "コカ･コーラ SUMMER FES LIVEアリーナ（六本木ヒルズアリーナ）",
    capacity: 8000,
    setting: "indoor",
    city: "Tokyo",
    venue_type: "Arena",
  },
  {
    id: "9952",
    type: "Media",
    venue: "京セラドーム大阪",
    venue_hint: "京セラドーム大阪",
    capacity: 55000,
    setting: "indoor",
    city: "Osaka",
    venue_type: "Dome",
  },
  {
    id: "10029",
    type: "OfflineEvent",
    venue: "COOL JAPAN PARK OSAKA TTホール",
    venue_hint: "COOL JAPAN PARK OSAKA TTホール",
    capacity: 1500,
    setting: "indoor",
    city: "Osaka",
    is_live: false,
    note: "No singing or live performance (talk/comedy day).",
    apply_pending: true,
  },
  {
    id: "10156",
    type: "Festival",
    venue: "烏丸半島芝生広場",
    venue_hint: "滋賀県草津市 烏丸半島芝生広場（イナズマロック フェス）",
    capacity: 5000,
    setting: "outdoor",
    city: "Shiga",
    venue_type: "Outdoor Stage",
  },
  {
    id: "10330",
    type: "Media",
    venue: "幕張メッセ国際展示場9-11ホール",
    venue_hint: "幕張メッセ 9-11ホール",
    capacity: 9000,
    setting: "indoor",
    city: "Chiba",
  },
  {
    id: "10597",
    type: "OfflineEvent",
    venue: "県民共済みらいホール",
    venue_hint: "県民共済みらいホール（横浜）",
    capacity: 2500,
    setting: "indoor",
    city: "Yokohama",
    is_live: false,
    apply_pending: true,
  },
  {
    id: "10905",
    type: "OfflineEvent",
    venue: "芝公園（御成門駅前広場）",
    venue_hint: "東京クリスマスマーケット 2025 in 芝公園（御成門駅前広場）",
    capacity: 500,
    setting: "outdoor",
    city: "Tokyo",
    is_live: false,
    apply_pending: true,
  },
  {
    id: "10384",
    type: "Festival",
    venue: "銀座 BASE GRANBELL",
    venue_hint: "銀座 BASE GRANBELL",
    capacity: 500,
    setting: "indoor",
    city: "Tokyo",
    venue_type: "Live House",
  },
  {
    id: "11054",
    type: "OfflineEvent",
    venue: "東京国際フォーラム ホールA",
    venue_hint: "東京国際フォーラム ホールA",
    capacity: 5000,
    setting: "indoor",
    city: "Tokyo",
    is_live: false,
    note: "Voice role only; member does not appear on stage.",
    apply_pending: true,
  },
  {
    id: "10883",
    type: "OfflineEvent",
    venue: "ユナイテッド・シネマアクアシティお台場",
    venue_hint: "ユナイテッド・シネマアクアシティお台場 スクリーン1",
    capacity: 300,
    setting: "indoor",
    city: "Tokyo",
    is_live: false,
    apply_pending: true,
  },
  {
    id: "10308",
    type: "Concert",
    venue: "Kアリーナ横浜",
    venue_hint: "Kアリーナ横浜",
    capacity: 20000,
    setting: "indoor",
    city: "Yokohama",
    venue_type: "Arena",
  },
  {
    id: "11021",
    type: "Concert",
    venue: "Kアリーナ横浜",
    venue_hint: "Kアリーナ横浜（CDTVライブ！ライブ！春の大感謝祭2026）",
    capacity: 20000,
    setting: "indoor",
    city: "Yokohama",
    venue_type: "Arena",
  },
  {
    id: "11213",
    type: "OfflineEvent",
    venue: "広島国際会議場 ヒマワリ",
    venue_hint: "広島国際会議場 地下2階 ヒマワリ",
    capacity: 200,
    setting: "indoor",
    city: "Hiroshima",
    is_live: false,
    note: "Free talk event; advance registration required.",
    apply_pending: true,
  },
  {
    id: "11136",
    type: "Festival",
    venue: "Kアリーナ横浜",
    venue_hint: "Kアリーナ横浜（CENTRAL MUSIC & ENTERTAINMENT FESTIVAL 2026）",
    capacity: 20000,
    setting: "indoor",
    city: "Yokohama",
    venue_type: "Arena",
  },
];

const filePath = path.resolve(process.argv[2] ?? defaultFile);
const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
const catalog = loadVenuesCatalog();
const byId = new Map(DETAIL_PATCHES.map((p) => [p.id, p]));
let patched = 0;
let venuesCreated = 0;

for (const row of data.events ?? []) {
  const id = String(row.official_detail_id ?? "");
  const patch = byId.get(id);
  if (!patch) continue;

  row.type = patch.type;
  row.venue = patch.venue;
  row.venue_hint = patch.venue_hint ?? patch.venue;
  if (patch.note) row.note = patch.note;
  if (patch.is_live === false) row.is_live = false;

  if (patch.type === "OfflineEvent" && patch.apply_pending) {
    applyOfflineEventGameplayPending(row);
    row.venue = patch.venue;
    row.venue_hint = patch.venue_hint ?? patch.venue;
    if (patch.is_live === false) row.is_live = false;
    if (patch.note) row.note = patch.note;
  }

  const resolved = resolveVenueInDatabase(patch.venue, catalog, {
    create: true,
    source: `official detail ${id}`,
    capacity: patch.capacity,
    setting: patch.setting,
    city: patch.city,
    venue_type: patch.venue_type,
  });
  if (resolved.created) venuesCreated += 1;
  row.venue_uid = resolved.venue_uid;
  row.venue = resolved.venue_name ?? patch.venue;
  patched += 1;
}

saveVenuesCatalog(catalog);
fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`, "utf8");
console.error(`Patched ${patched} events (${venuesCreated} new venues) in ${filePath}`);
