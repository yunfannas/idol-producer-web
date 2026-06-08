/**
 * Fix a previous bad update that mixed four 鳴ル神 members into ≠ME
 * in the canonical main database under `public/data/`.
 *
 * This script:
 * - removes bogus ≠ME history rows from the four affected idols
 * - ensures they have 鳴ル神 history rows starting 2024-11-01
 * - rebuilds ≠ME and 鳴ル神 membership lists in `groups.json`
 *
 * Run:
 *   node scripts/fixMainDatabaseNeqmeNarukami.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const idolsPath = path.join(root, "public", "data", "idols.json");
const groupsPath = path.join(root, "public", "data", "groups.json");

const NEQME_UID = "4omgTUU";
const NARUKAMI_UID = "6bO044Or56We";
const NARUKAMI_NAME = "鳴ル神";
const NARUKAMI_ROMAJI = "Narukami";
const NARUKAMI_START = "2024-11-01";

const AFFECTED = [
  { uid: "85dcb295-c757-4cb8-8b9e-f9b63bcfb518", name: "卯莎ゆあ" },
  { uid: "352606bc-461c-490a-81d9-14ae91ca3c24", name: "恩辰たわ" },
  { uid: "7205a0c0-a352-4fab-ae6f-88ba8aff6787", name: "鬼寅みがき" },
  { uid: "e7c9c01e-9277-42b8-b815-2bbdabbf2fab", name: "戌井ありさ" },
];

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isoDay(value) {
  return typeof value === "string" && value ? value.slice(0, 10) : "";
}

function compareIso(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

function matchesGroup(history, group) {
  if (!history || !group) return false;
  if (typeof history.group_uid === "string" && history.group_uid && history.group_uid === group.uid) return true;
  const historyName = typeof history.group_name === "string" ? history.group_name.trim() : "";
  return historyName === group.name || historyName === group.name_romanji;
}

function idolDisplayName(idol) {
  const name = typeof idol?.name === "string" ? idol.name.trim() : "";
  if (name) return name;
  return typeof idol?.romaji === "string" ? idol.romaji.trim() : "";
}

function rebuildMembership(group, idols) {
  const currentByUid = new Map();
  const pastByUid = new Map();

  for (const idol of idols) {
    const histories = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const history of histories) {
      if (!matchesGroup(history, group)) continue;
      const uid = typeof idol.uid === "string" ? idol.uid : "";
      const name = idolDisplayName(idol);
      if (!uid || !name) continue;
      const start = isoDay(history.start_date);
      const end = isoDay(history.end_date ?? history.leave_date);
      if (!end) currentByUid.set(uid, { uid, name, sortDate: start });
      else pastByUid.set(uid, { uid, name, sortDate: end });
    }
  }

  const current = [...currentByUid.values()].sort((a, b) => compareIso(a.sortDate, b.sortDate) || a.name.localeCompare(b.name, "ja"));
  const past = [...pastByUid.values()].sort((a, b) => compareIso(b.sortDate, a.sortDate) || a.name.localeCompare(b.name, "ja"));

  group.member_uids = current.map((row) => row.uid);
  group.member_names = current.map((row) => row.name);
  group.member_count = current.length;
  group.past_member_uids = past.map((row) => row.uid);
  group.past_member_names = past.map((row) => row.name);
  group.past_member_count = past.length;
}

const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));

const neqme = groups.find((group) => String(group.uid ?? "") === NEQME_UID);
const narukami = groups.find((group) => String(group.uid ?? "") === NARUKAMI_UID);
if (!neqme) throw new Error("Missing ≠ME group in public/data/groups.json");
if (!narukami) throw new Error("Missing 鳴ル神 group in public/data/groups.json");

let removedBadHistoryRows = 0;
let addedNarukamiRows = 0;

for (const target of AFFECTED) {
  const idol = idols.find((row) => String(row.uid ?? "") === target.uid);
  if (!idol) throw new Error(`Missing idol ${target.uid} (${target.name}) in public/data/idols.json`);
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];

  idol.group_history = history.filter((entry) => {
    const groupUid = typeof entry?.group_uid === "string" ? entry.group_uid.trim() : "";
    const groupName = typeof entry?.group_name === "string" ? entry.group_name.trim() : "";
    const isBadNeqme = groupUid === NEQME_UID || (groupName === "≠ME" && !groupUid);
    if (isBadNeqme) removedBadHistoryRows += 1;
    return !isBadNeqme;
  });

  const hasNarukami = Array.isArray(idol.group_history)
    && idol.group_history.some((entry) => {
      const groupUid = typeof entry?.group_uid === "string" ? entry.group_uid.trim() : "";
      const groupName = typeof entry?.group_name === "string" ? entry.group_name.trim() : "";
      return groupUid === NARUKAMI_UID || groupName === NARUKAMI_NAME;
    });

  if (!hasNarukami) {
    idol.group_history = Array.isArray(idol.group_history) ? idol.group_history : [];
    idol.group_history.push({
      group_name: NARUKAMI_NAME,
      group_uid: NARUKAMI_UID,
      start_date: NARUKAMI_START,
      end_date: null,
      member_color: null,
      member_color_code: null,
    });
    addedNarukamiRows += 1;
  }
}

rebuildMembership(neqme, idols);
rebuildMembership(narukami, idols);

writeJson(idolsPath, idols);
writeJson(groupsPath, groups);

console.log(
  JSON.stringify(
    {
      removed_bad_history_rows: removedBadHistoryRows,
      added_narukami_rows: addedNarukamiRows,
      neqme_member_count: neqme.member_count,
      neqme_member_names: neqme.member_names,
      narukami_member_count: narukami.member_count,
      narukami_member_names: narukami.member_names,
    },
    null,
    2,
  ),
);
