/**
 * Export scenario 6 groups to CSV for offline editing.
 * Run: node scripts/export-scenario6-groups-csv.mjs
 * Output: docs/scenario_6_groups_detail.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const groupsPath = path.join(root, "public", "data", "scenarios", "scenario_6_2025-07-20", "groups.json");
const outPath = path.join(root, "docs", "scenario_6_groups_detail.csv");

function pipeJoin(arr) {
  if (!Array.isArray(arr)) return "";
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean).join(" | ");
}

function countArr(v) {
  return Array.isArray(v) ? v.length : "";
}

/** RFC 4180: always quote for maximum compatibility with Excel. */
function csvCell(v) {
  const s = v == null ? "" : String(v);
  return `"${s.replace(/"/g, '""')}"`;
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
if (!Array.isArray(groups)) throw new Error("groups.json must be an array");

const headers = [
  "uid",
  "name",
  "name_romanji",
  "nickname",
  "nickname_romanji",
  "member_count",
  "member_names",
  "member_uids",
  "past_member_count",
  "past_member_names",
  "past_member_uids",
  "color",
  "formed_date",
  "popularity",
  "fans",
  "union",
  "union_uid",
  "agencies",
  "agency_uids",
  "pictures_count",
  "pictures_paths",
  "wiki_url",
  "song_uids_count",
  "discography_count",
  "disc_uids_count",
  "songs_count",
  "description",
];

const lines = [headers.join(",")];

for (const g of groups) {
  const pics = Array.isArray(g.pictures) ? g.pictures : [];
  const row = [
    g.uid,
    g.name,
    g.name_romanji,
    g.nickname,
    g.nickname_romanji,
    g.member_count,
    pipeJoin(g.member_names),
    pipeJoin(g.member_uids),
    g.past_member_count,
    pipeJoin(g.past_member_names),
    pipeJoin(g.past_member_uids),
    g.color,
    g.formed_date,
    g.popularity,
    g.fans,
    g.union,
    g.union_uid,
    pipeJoin(g.agencies),
    pipeJoin(g.agency_uids),
    pics.length,
    pipeJoin(pics),
    g.wiki_url,
    countArr(g.song_uids),
    countArr(g.discography),
    countArr(g.disc_uids),
    countArr(g.songs),
    g.description,
  ];
  lines.push(row.map(csvCell).join(","));
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, "\uFEFF" + lines.join("\r\n"), "utf8");
console.log(`Wrote ${groups.length} rows to ${path.relative(root, outPath)}`);
