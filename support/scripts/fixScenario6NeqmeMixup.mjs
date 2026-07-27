/**
 * Remove the four mistaken ≠ME links introduced by a previous bad update.
 *
 * Affects:
 * - idols.json: drop bogus `group_history` rows for the four stray idols
 * - groups.json / groups_update.json: rebuild ≠ME member lists to 12
 *
 * Run:
 *   node scripts/fixScenario6NeqmeMixup.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const scenarioDir = path.join(root, "public", "data", "scenarios", "scenario_6");
const idolsPath = path.join(scenarioDir, "idols.json");
const groupsPath = path.join(scenarioDir, "groups.json");
const groupsUpdatePath = path.join(scenarioDir, "groups_update.json");
const presetPath = path.join(root, "public", "data", "scenarios", "presets", "scenario6.json");

const NEQME_UID = "4omgTUU";
const STRAY_UIDS = new Set([
  "85dcb295-c757-4cb8-8b9e-f9b63bcfb518", // 卯莎ゆあ
  "352606bc-461c-490a-81d9-14ae91ca3c24", // 恩辰たわ
  "7205a0c0-a352-4fab-ae6f-88ba8aff6787", // 鬼寅みがき
  "e7c9c01e-9277-42b8-b815-2bbdabbf2fab", // 戌井ありさ
]);

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

function isActiveOn(history, openingDate) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (!start) return false;
  if (compareIso(start, openingDate) > 0) return false;
  if (end && compareIso(end, openingDate) < 0) return false;
  return true;
}

function endedBeforeOpening(history, openingDate) {
  const end = isoDay(history.end_date ?? history.leave_date);
  return Boolean(end) && compareIso(end, openingDate) < 0;
}

function idolDisplayName(idol) {
  const value = typeof idol?.name === "string" ? idol.name.trim() : "";
  if (value) return value;
  return typeof idol?.romaji === "string" ? idol.romaji.trim() : "";
}

function rebuildGroupMembership(group, idols, openingDate) {
  const currentByUid = new Map();
  const pastByUid = new Map();

  for (const idol of idols) {
    const histories = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const history of histories) {
      if (!matchesGroup(history, group)) continue;
      const uid = typeof idol.uid === "string" ? idol.uid : "";
      const name = idolDisplayName(idol);
      if (!uid || !name) continue;
      if (isActiveOn(history, openingDate)) currentByUid.set(uid, { uid, name, sortDate: isoDay(history.start_date) });
      else if (endedBeforeOpening(history, openingDate)) pastByUid.set(uid, { uid, name, sortDate: isoDay(history.end_date ?? history.leave_date) });
    }
  }

  const orderedCurrent = [...currentByUid.values()].sort((a, b) => compareIso(a.sortDate, b.sortDate) || a.name.localeCompare(b.name, "ja"));
  const orderedPast = [...pastByUid.values()].sort((a, b) => compareIso(b.sortDate, a.sortDate) || a.name.localeCompare(b.name, "ja"));

  group.member_uids = orderedCurrent.map((row) => row.uid);
  group.member_names = orderedCurrent.map((row) => row.name);
  group.member_count = orderedCurrent.length;
  group.past_member_uids = orderedPast.map((row) => row.uid);
  group.past_member_names = orderedPast.map((row) => row.name);
  group.past_member_count = orderedPast.length;
}

const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const groupsUpdate = JSON.parse(fs.readFileSync(groupsUpdatePath, "utf8"));
const preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
const openingDate = String(preset.opening_date ?? "").slice(0, 10);

let removedHistoryRows = 0;
for (const idol of idols) {
  if (!STRAY_UIDS.has(String(idol.uid ?? ""))) continue;
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  idol.group_history = hist.filter((entry) => {
    const name = typeof entry?.group_name === "string" ? entry.group_name.trim() : "";
    const uid = typeof entry?.group_uid === "string" ? entry.group_uid.trim() : "";
    const isBad = uid === NEQME_UID || (name === "≠ME" && !uid);
    if (isBad) removedHistoryRows += 1;
    return !isBad;
  });
}

const neqme = groups.find((group) => String(group.uid ?? "") === NEQME_UID);
if (!neqme) throw new Error("Missing ≠ME group row");
rebuildGroupMembership(neqme, idols, openingDate);

if (Array.isArray(groupsUpdate.groups)) {
  const patch = groupsUpdate.groups.find((row) => row && row.uid === NEQME_UID);
  if (patch) {
    patch.member_uids = neqme.member_uids;
    patch.member_names = neqme.member_names;
    patch.member_count = neqme.member_count;
    patch.past_member_uids = neqme.past_member_uids;
    patch.past_member_names = neqme.past_member_names;
    patch.past_member_count = neqme.past_member_count;
  }
}

writeJson(idolsPath, idols);
writeJson(groupsPath, groups);
writeJson(groupsUpdatePath, groupsUpdate);

console.log(
  JSON.stringify(
    {
      removed_history_rows: removedHistoryRows,
      neqme_member_count: neqme.member_count,
      neqme_member_names: neqme.member_names,
    },
    null,
    2,
  ),
);
