/**
 * Scan public/data/groups.json for catalog gaps and write docs/reference/group_catalog_gaps.csv
 *
 * Run: node scripts/exportGroupGapsCsv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const groupsPath = path.join(root, "public", "data", "groups.json");
const outPath = path.join(root, "support", "docs", "reference", "group_catalog_gaps.csv");

function normStrArr(a) {
  if (!Array.isArray(a)) return [];
  return a.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function normalizeEditions(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const label = String(item.label ?? "").trim() || "Edition";
    const tl = normStrArr(item.track_list);
    out.push({ label, track_list: tl });
  }
  return out;
}

function discUsesEditionTrackLayout(d) {
  return normalizeEditions(d.edition_track_lists).length > 0;
}

function discMaxTrackSlotCount(d) {
  const legacyFlat = normStrArr(d.track_list);
  if (!discUsesEditionTrackLayout(d)) return legacyFlat.length;
  const shared = normStrArr(d.shared_track_list);
  const eds = normalizeEditions(d.edition_track_lists);
  if (!eds.length) return shared.length;
  const totals = eds.map((e) => shared.length + e.track_list.length);
  return Math.max(shared.length, ...totals);
}

/** No track titles inferred and no fallback song UID links on this discography row */
function discMissingTitlePayload(d) {
  if (discMaxTrackSlotCount(d) > 0) return false;
  const ts = d?.track_song_uids;
  return !(Array.isArray(ts) && ts.some((x) => String(x ?? "").trim()));
}

function csvCell(v) {
  const t = String(v ?? "");
  if (/[",\r\n]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function isValidFormedDate(v) {
  if (v == null) return false;
  const s = String(v).trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  return y >= 1950 && y <= 2100;
}

function main() {
  const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  if (!Array.isArray(groups)) {
    console.error("groups.json root must be array");
    process.exit(1);
  }

  const header = [
    "group_uid",
    "group_name",
    "name_romanji",
    "formed_date_raw",
    "gap_missing_or_invalid_formed_date",
    "gap_empty_song_uids",
    "gap_empty_discography",
    "discography_row_count",
    "disc_rows_empty_track_list",
    "disc_rows_empty_track_song_uids",
    "member_count_field",
    "member_names_count",
    "member_uids_nonempty_count",
    "gap_roster_no_nonempty_uids",
    "gap_roster_uids_short_of_names",
    "wiki_url_missing_or_blank",
    "agencies_missing_or_empty",
    "all_disc_rows_missing_track_list",
    "all_disc_rows_missing_track_song_uids",
    "gap_flags_summary",
  ];

  const rows = [];

  for (const g of groups) {
    if (!g || typeof g !== "object") continue;

    const uid = String(g.uid ?? "").trim();
    const name = String(g.name ?? "").trim();
    const ro = String(g.name_romanji ?? "").trim();

    const formedRaw = g.formed_date == null ? "" : String(g.formed_date).trim();
    const gapFormed = !isValidFormedDate(g.formed_date);

    const songUids = Array.isArray(g.song_uids) ? g.song_uids.filter((x) => String(x ?? "").trim()) : [];
    const gapEmptySongs = songUids.length === 0;

    const discs = Array.isArray(g.discography) ? g.discography : [];
    const gapEmptyDisc = discs.length === 0;

    let emptyTrack = 0;
    let emptyTrackSongUids = 0;
    for (const d of discs) {
      if (discMissingTitlePayload(d)) emptyTrack++;
      const ts = d.track_song_uids;
      if (!Array.isArray(ts) || ts.length === 0) emptyTrackSongUids++;
    }

    const memberCount = typeof g.member_count === "number" && Number.isFinite(g.member_count) ? g.member_count : 0;
    const names = Array.isArray(g.member_names) ? g.member_names.map((n) => String(n ?? "").trim()).filter(Boolean) : [];
    const uids = Array.isArray(g.member_uids) ? g.member_uids.map((u) => String(u ?? "").trim()).filter(Boolean) : [];

    const gapRosterNoUids = memberCount > 0 && uids.length === 0;
    const gapRosterShort = names.length > 0 && uids.length < names.length;

    const wiki = String(g.wiki_url ?? "").trim();
    const gapWiki = !wiki;

    const ag = g.agencies;
    const gapAg =
      ag == null ||
      (Array.isArray(ag) && ag.map((a) => String(a ?? "").trim()).filter(Boolean).length === 0);

    const allDiscsMissingTrackList =
      discs.length > 0 && emptyTrack === discs.length;
    const allDiscsMissingTrackSongUids =
      discs.length > 0 && emptyTrackSongUids === discs.length;

    /** Row appears when at least one “catalog hygiene” gap matches (not mere missing photos). */
    const includeRow =
      gapFormed ||
      gapEmptySongs ||
      gapEmptyDisc ||
      gapRosterNoUids ||
      gapRosterShort ||
      gapWiki ||
      gapAg ||
      allDiscsMissingTrackList ||
      (discs.length > 0 && emptyTrack > 0);

    if (!includeRow) continue;

    const flags = [];
    if (gapFormed) flags.push("formed_date");
    if (gapEmptySongs) flags.push("empty_song_uids");
    if (gapEmptyDisc) flags.push("empty_discography");
    if (discs.length > 0 && emptyTrack > 0) flags.push(`disc_empty_track_list×${emptyTrack}`);
    if (discs.length > 0 && emptyTrackSongUids > 0) flags.push(`disc_empty_track_song_uids×${emptyTrackSongUids}`);
    if (gapRosterNoUids) flags.push("roster_no_uids");
    if (gapRosterShort) flags.push("roster_uids_short");
    if (gapWiki) flags.push("no_wiki_url");
    if (gapAg) flags.push("no_agencies");

    rows.push([
      uid,
      name,
      ro,
      formedRaw,
      gapFormed ? "1" : "0",
      gapEmptySongs ? "1" : "0",
      gapEmptyDisc ? "1" : "0",
      String(discs.length),
      String(emptyTrack),
      String(emptyTrackSongUids),
      String(memberCount),
      String(names.length),
      String(uids.length),
      gapRosterNoUids ? "1" : "0",
      gapRosterShort ? "1" : "0",
      gapWiki ? "1" : "0",
      gapAg ? "1" : "0",
      allDiscsMissingTrackList ? "1" : "0",
      allDiscsMissingTrackSongUids ? "1" : "0",
      flags.join(";"),
    ]);
  }

  const lines = [header.map(csvCell).join(",")];
  for (const r of rows) {
    lines.push(r.map(csvCell).join(","));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, "\uFEFF" + lines.join("\n") + "\n", "utf8");
  console.log(`Wrote ${rows.length} groups with gaps -> ${path.relative(root, outPath)}`);
}

main();
