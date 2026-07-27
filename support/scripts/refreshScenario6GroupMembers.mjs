/**
 * Rebuild scenario 6 group member lists from scenario idols.json group_history
 * at the preset opening date, using Japanese idol names as the display key.
 *
 * This keeps scenario-local group membership aligned with the scenario database
 * instead of trusting stale copied text from canonical groups.json.
 *
 * Undated group_history rows (missing start_date) are NEVER treated as active —
 * that bug previously inflated iLiFE! / Akishibu / Paradeeq rosters.
 *
 * Usage:
 *   node support/scripts/refreshScenario6GroupMembers.mjs
 *   node support/scripts/refreshScenario6GroupMembers.mjs --allowlist-only
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scenarioDir = path.join(root, "public", "data", "scenarios", "scenario_6");
const presetPath = path.join(root, "public", "data", "scenarios", "presets", "scenario6.json");
const groupsPath = path.join(scenarioDir, "groups.json");
const idolsPath = path.join(scenarioDir, "idols.json");
const groupsUpdatePath = path.join(scenarioDir, "groups_update.json");
const allowlistPath = path.join(scenarioDir, "startup_allowlist.json");

const allowlistOnly = process.argv.includes("--allowlist-only");

const preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
const openingDate = String(preset.opening_date ?? "").slice(0, 10);
if (!openingDate) throw new Error("scenario6 preset is missing opening_date");

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
const groupsUpdate = JSON.parse(fs.readFileSync(groupsUpdatePath, "utf8"));
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const allowedNames = new Set(Array.isArray(allowlist.names_in_order) ? allowlist.names_in_order : []);

const openingStamp = `${openingDate}T00:00:00Z`;

function isoDay(value) {
  return typeof value === "string" && value ? value.slice(0, 10) : "";
}

function compareIso(a, b) {
  if (!a && !b) return 0;
  if (!a) return -1;
  if (!b) return 1;
  return a.localeCompare(b);
}

/** Require start_date; undated alias rows must not count as active. */
function isActiveOn(history) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (!start) return false;
  if (compareIso(start, openingDate) > 0) return false;
  if (end && compareIso(end, openingDate) < 0) return false;
  return true;
}

function endedBeforeOpening(history) {
  const end = isoDay(history.end_date ?? history.leave_date);
  return Boolean(end) && compareIso(end, openingDate) < 0;
}

function matchesGroup(history, group) {
  if (!history || !group) return false;
  if (typeof history.group_uid === "string" && history.group_uid && history.group_uid === group.uid) return true;
  if (typeof history.group_name !== "string" || !history.group_name) return false;
  const historyName = history.group_name.trim();
  return historyName === group.name || historyName === group.name_romanji;
}

function idolDisplayName(idol) {
  const value = typeof idol?.name === "string" ? idol.name.trim() : "";
  if (value) return value;
  return typeof idol?.romaji === "string" ? idol.romaji : "";
}

function buildGroupMembership(group) {
  /** @type {Map<string, {uid:string,name:string,sortDate:string}>} */
  const currentByUid = new Map();
  /** @type {Map<string, {uid:string,name:string,sortDate:string}>} */
  const pastByUid = new Map();

  for (const idol of idols) {
    const histories = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const history of histories) {
      if (!matchesGroup(history, group)) continue;
      const name = idolDisplayName(idol);
      if (!name) continue;
      const uid = typeof idol.uid === "string" ? idol.uid : "";
      if (!uid) continue;
      if (isActiveOn(history)) {
        currentByUid.set(uid, { uid, name, sortDate: isoDay(history.start_date) });
      } else if (endedBeforeOpening(history)) {
        pastByUid.set(uid, { uid, name, sortDate: isoDay(history.end_date ?? history.leave_date) });
      }
    }
  }

  const existingCurrent = Array.isArray(group.member_uids) ? group.member_uids : [];
  const existingPast = Array.isArray(group.past_member_uids) ? group.past_member_uids : [];

  const orderedCurrent = [];
  const seenCurrentNames = new Set();
  for (const uid of existingCurrent) {
    const candidate = currentByUid.get(uid);
    if (!candidate || seenCurrentNames.has(candidate.name)) continue;
    orderedCurrent.push(candidate);
    seenCurrentNames.add(candidate.name);
    currentByUid.delete(uid);
  }
  const remainingCurrent = [...currentByUid.values()]
    .sort((a, b) => compareIso(a.sortDate, b.sortDate) || a.name.localeCompare(b.name, "ja"));
  for (const candidate of remainingCurrent) {
    if (seenCurrentNames.has(candidate.name)) continue;
    orderedCurrent.push(candidate);
    seenCurrentNames.add(candidate.name);
  }

  const orderedPast = [];
  const seenPastNames = new Set();
  for (const uid of existingPast) {
    const candidate = pastByUid.get(uid);
    if (!candidate || seenPastNames.has(candidate.name) || seenCurrentNames.has(candidate.name)) continue;
    orderedPast.push(candidate);
    seenPastNames.add(candidate.name);
    pastByUid.delete(uid);
  }
  const remainingPast = [...pastByUid.values()]
    .sort((a, b) => compareIso(b.sortDate, a.sortDate) || a.name.localeCompare(b.name, "ja"));
  for (const candidate of remainingPast) {
    if (seenPastNames.has(candidate.name) || seenCurrentNames.has(candidate.name)) continue;
    orderedPast.push(candidate);
    seenPastNames.add(candidate.name);
  }

  group.member_uids = orderedCurrent.map((row) => row.uid);
  group.member_names = orderedCurrent.map((row) => row.name);
  group.member_count = orderedCurrent.length;
  group.past_member_uids = orderedPast.map((row) => row.uid);
  group.past_member_names = orderedPast.map((row) => row.name);
  group.past_member_count = orderedPast.length;
}

let refreshedCount = 0;
for (const group of groups) {
  if (allowlistOnly && !allowedNames.has(group.name)) continue;
  buildGroupMembership(group);
  refreshedCount += 1;
}

if (Array.isArray(groupsUpdate.groups)) {
  const scenarioByUid = new Map(groups.map((group) => [group.uid, group]));
  groupsUpdate.groups = groupsUpdate.groups.map((patch) => {
    const refreshed = scenarioByUid.get(patch.uid);
    if (!refreshed) return patch;
    return {
      ...patch,
      member_count: refreshed.member_count,
      member_names: refreshed.member_names,
      member_uids: refreshed.member_uids,
      past_member_count: refreshed.past_member_count,
      past_member_names: refreshed.past_member_names,
      past_member_uids: refreshed.past_member_uids,
    };
  });
}

fs.writeFileSync(groupsPath, `${JSON.stringify(groups, null, 2)}\n`, "utf8");
fs.writeFileSync(groupsUpdatePath, `${JSON.stringify(groupsUpdate, null, 2)}\n`, "utf8");

const iLife = groups.find((group) => group.name === "iLiFE!");
const akishibu = groups.find((group) => group.name === "アキシブproject");
console.log(
  JSON.stringify(
    {
      opening_date: openingStamp,
      scope: allowlistOnly ? "allowlist" : "all_groups",
      refreshed_groups: refreshedCount,
      ilife_member_count: iLife?.member_count ?? null,
      ilife_member_names: iLife?.member_names ?? [],
      akishibu_member_count: akishibu?.member_count ?? null,
      akishibu_member_names: akishibu?.member_names ?? [],
    },
    null,
    2,
  ),
);
