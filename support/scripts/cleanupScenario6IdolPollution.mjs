#!/usr/bin/env node
/**
 * One-shot cleanup for scenario_6 idol pollution:
 * 1) Remove stub duplicate idols (same display name, not referenced in group rosters)
 * 2) Remove undated group_history rows that match a scenario group name/romanji/uid
 *
 * Usage: node support/scripts/cleanupScenario6IdolPollution.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scenarioDir = path.join(root, "public/data/scenarios/scenario_6");
const idolsPath = path.join(scenarioDir, "idols.json");
const groupsPath = path.join(scenarioDir, "groups.json");
const groupsUpdatePath = path.join(scenarioDir, "groups_update.json");

const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const groupsUpdate = JSON.parse(fs.readFileSync(groupsUpdatePath, "utf8"));

const referenced = new Set();
for (const g of [...groups, ...(groupsUpdate.groups || [])]) {
  for (const key of ["member_uids", "past_member_uids"]) {
    for (const uid of g[key] || []) referenced.add(String(uid));
  }
}

function score(idol) {
  let s = 0;
  if (referenced.has(idol.uid)) s += 1000;
  if (idol.wiki_url) s += 50;
  if (Array.isArray(idol.data_sources) && idol.data_sources.length) s += 20 * idol.data_sources.length;
  if (idol.attributes) s += 30;
  if (idol.romaji) s += 5;
  if (idol.hiragana) s += 5;
  if (idol.portrait_photo_path || idol.image_path) s += 10;
  const hist = idol.group_history || [];
  s += hist.length;
  for (const h of hist) {
    if (h.start_date) s += 2;
    if (h.group_uid) s += 1;
    if (Array.isArray(h.status_history)) s += h.status_history.length * 3;
  }
  return s;
}

const byName = new Map();
for (const idol of idols) {
  const name = typeof idol.name === "string" ? idol.name.trim() : "";
  if (!name) continue;
  if (!byName.has(name)) byName.set(name, []);
  byName.get(name).push(idol);
}

const removeUids = new Set();
const removed = [];
for (const [name, rows] of byName) {
  if (rows.length < 2) continue;
  const ranked = [...rows].sort(
    (a, b) => score(b) - score(a) || String(a.uid).localeCompare(String(b.uid)),
  );
  for (const loser of ranked.slice(1)) {
    if (referenced.has(loser.uid)) continue;
    removeUids.add(loser.uid);
    removed.push({ name, uid: loser.uid, score: score(loser), winner: ranked[0].uid });
  }
}

const nextIdols = idols.filter((idol) => !removeUids.has(idol.uid));

const groupKeys = new Set();
for (const g of groups) {
  if (g.uid) groupKeys.add(`uid:${g.uid}`);
  if (g.name) groupKeys.add(`name:${g.name}`);
  if (g.name_romanji) groupKeys.add(`name:${g.name_romanji}`);
}

let undatedRemoved = 0;
for (const idol of nextIdols) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  const keptHist = [];
  for (const h of hist) {
    const start = typeof h.start_date === "string" && h.start_date ? h.start_date : "";
    const endRaw = h.end_date ?? h.leave_date;
    const end = typeof endRaw === "string" && endRaw ? endRaw : "";
    if (start || end) {
      keptHist.push(h);
      continue;
    }
    const name = typeof h.group_name === "string" ? h.group_name.trim() : "";
    const uid = typeof h.group_uid === "string" ? h.group_uid : "";
    const matchesGroup =
      (uid && groupKeys.has(`uid:${uid}`)) || (name && groupKeys.has(`name:${name}`));
    if (matchesGroup) {
      undatedRemoved += 1;
      continue;
    }
    keptHist.push(h);
  }
  idol.group_history = keptHist;
}

fs.writeFileSync(idolsPath, `${JSON.stringify(nextIdols, null, 2)}\n`, "utf8");

console.log(
  JSON.stringify(
    {
      idols_before: idols.length,
      idols_after: nextIdols.length,
      duplicate_stubs_removed: removed.length,
      undated_group_matching_aliases_removed: undatedRemoved,
      removed_sample: removed.slice(0, 15),
    },
    null,
    2,
  ),
);
