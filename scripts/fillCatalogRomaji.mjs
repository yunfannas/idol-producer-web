/**
 * Fill empty romanji fields for one group in public/data/groups.json + songs.json.
 *
 * Order: per-uid overrides (public/data/reference/romaji_overrides/<group_uid>.json)
 *        → Latin-only title copy → leave blank for manual / wiki sourcing.
 *
 * Usage:
 *   node scripts/fillCatalogRomaji.mjs --group "アキシブproject"
 *   node scripts/fillCatalogRomaji.mjs --group-uid 44Ki44Kt44K344OWcHJvamVjdA --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const groupsPath = path.join(root, "public/data/groups.json");
const songsPath = path.join(root, "public/data/songs.json");
const overridesDir = path.join(root, "public/data/reference/romaji_overrides");

const hasCjk = (s) => /[\u3040-\u30ff\u4e00-\u9fff]/.test(String(s ?? ""));

/** When the display title is already Latin, use it as romanji. */
export function latinRomanjiFromTitle(title) {
  const t = String(title ?? "").trim();
  if (!t || hasCjk(t)) return "";
  return t;
}

function loadOverrides(groupUid) {
  const file = path.join(overridesDir, `${groupUid}.json`);
  if (!fs.existsSync(file)) {
    return { group: {}, discs: {}, songs: {} };
  }
  const raw = JSON.parse(fs.readFileSync(file, "utf8"));
  return {
    group: raw.group && typeof raw.group === "object" ? raw.group : {},
    discs: raw.discs && typeof raw.discs === "object" ? raw.discs : {},
    songs: raw.songs && typeof raw.songs === "object" ? raw.songs : {},
  };
}

function pickRomanji(current, title, override) {
  if (String(current ?? "").trim()) return null;
  if (override && String(override).trim()) return String(override).trim();
  const auto = latinRomanjiFromTitle(title);
  return auto || null;
}

function parseArgs(argv) {
  let groupName = "";
  let groupUid = "";
  let dryRun = false;
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--dry-run") dryRun = true;
    else if (a === "--group" && argv[i + 1]) {
      groupName = argv[++i];
    } else if (a === "--group-uid" && argv[i + 1]) {
      groupUid = argv[++i];
    }
  }
  return { groupName, groupUid, dryRun };
}

const { groupName, groupUid: argUid, dryRun } = parseArgs(process.argv);

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const group = argUid
  ? groups.find((g) => String(g.uid ?? "") === argUid)
  : groups.find((g) => String(g.name ?? "") === groupName);

if (!group) {
  console.error("Group not found. Use --group NAME or --group-uid UID");
  process.exit(1);
}

const groupUid = String(group.uid ?? "");
const overrides = loadOverrides(groupUid);

const stats = {
  group_name_romanji: 0,
  group_nickname_romanji: 0,
  disc_title_romanji: 0,
  song_title_romanji: 0,
  song_skipped_no_source: 0,
};

const groupPatches = {};

const nameR = pickRomanji(
  group.name_romanji,
  group.name,
  overrides.group?.name_romanji,
);
if (nameR) {
  groupPatches.name_romanji = nameR;
  stats.group_name_romanji += 1;
}

const nickR = pickRomanji(
  group.nickname_romanji,
  group.nickname,
  overrides.group?.nickname_romanji,
);
if (nickR) {
  groupPatches.nickname_romanji = nickR;
  stats.group_nickname_romanji += 1;
}

for (const disc of group.discography ?? []) {
  const uid = String(disc.uid ?? "");
  const next = pickRomanji(disc.title_romanji, disc.title, overrides.discs?.[uid]);
  if (!next) continue;
  disc.title_romanji = next;
  stats.disc_title_romanji += 1;
}

const songs = JSON.parse(fs.readFileSync(songsPath, "utf8"));
for (const row of songs) {
  if (String(row.group_uid ?? "") !== groupUid) continue;
  const uid = String(row.uid ?? "");
  const next = pickRomanji(row.title_romanji, row.title, overrides.songs?.[uid]);
  if (!next) {
    if (!String(row.title_romanji ?? "").trim()) stats.song_skipped_no_source += 1;
    continue;
  }
  row.title_romanji = next;
  stats.song_title_romanji += 1;
}

if (groupPatches.name_romanji) group.name_romanji = groupPatches.name_romanji;
if (groupPatches.nickname_romanji) group.nickname_romanji = groupPatches.nickname_romanji;

console.log(
  JSON.stringify(
    {
      group: group.name,
      group_uid: groupUid,
      dry_run: dryRun,
      ...stats,
    },
    null,
    2,
  ),
);

if (dryRun) process.exit(0);

const groupsTmp = `${groupsPath}.tmp`;
const songsTmp = `${songsPath}.tmp`;
const beforeLen = groups.length;

fs.writeFileSync(groupsTmp, `${JSON.stringify(groups, null, 2)}\n`);
fs.writeFileSync(songsTmp, `${JSON.stringify(songs, null, 2)}\n`);

const parsedGroups = JSON.parse(fs.readFileSync(groupsTmp, "utf8"));
const parsedSongs = JSON.parse(fs.readFileSync(songsTmp, "utf8"));
if (parsedGroups.length !== beforeLen) {
  throw new Error("groups.json group count changed after write");
}

fs.renameSync(groupsTmp, groupsPath);
fs.renameSync(songsTmp, songsPath);

console.log("Wrote public/data/groups.json and public/data/songs.json");
