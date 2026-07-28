#!/usr/bin/env node
/**
 * Merge duplicate HEROINES Kenkyuusei (English name / stray uid) into
 * canonical ヒロインズ研究生 (9b937bbf-…).
 *
 * Usage: node support/scripts/mergeHeroinesKenkyuuseiDuplicate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const EN_NAME = "HEROINES Kenkyuusei";
const JA_NAME = "ヒロインズ研究生";
const EN_UID = "acdd5738-2636-426a-b896-b9435d4327a5";
const JA_UID = "9b937bbf-facf-437b-9815-94152bfe5805";

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, value) {
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function isEnHistory(h) {
  return h?.group_name === EN_NAME || h?.group_uid === EN_UID;
}

function isJaHistory(h) {
  return h?.group_name === JA_NAME || h?.group_uid === JA_UID;
}

function retargetHistory(h) {
  return {
    ...h,
    group_name: JA_NAME,
    group_uid: JA_UID,
  };
}

function mergeIdolHistories(idol) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  const jaRows = hist.filter(isJaHistory);
  const enRows = hist.filter(isEnHistory);
  const other = hist.filter((h) => !isEnHistory(h) && !isJaHistory(h));

  if (!enRows.length) return { idol, droppedEn: 0, retargetedEn: 0 };

  let droppedEn = 0;
  let retargetedEn = 0;
  /** @type {Record<string, unknown>[]} */
  const keptJa = jaRows.map((ja) => ({
    ...ja,
    group_name: JA_NAME,
    group_uid: JA_UID,
  }));

  for (const en of enRows) {
    const start = String(en.start_date ?? "").slice(0, 10);
    const sameStart = keptJa.some((ja) => String(ja.start_date ?? "").slice(0, 10) === start);
    if (sameStart) {
      droppedEn += 1;
      continue;
    }
    keptJa.push(retargetHistory(en));
    retargetedEn += 1;
  }

  idol.group_history = [...other, ...keptJa];

  // nickname / member maps that key by group display name
  if (idol.member_name_in_group && typeof idol.member_name_in_group === "object") {
    const map = { ...idol.member_name_in_group };
    if (EN_NAME in map) {
      if (!(JA_NAME in map)) map[JA_NAME] = map[EN_NAME];
      delete map[EN_NAME];
      idol.member_name_in_group = map;
    }
  }
  if (idol.member_colors && typeof idol.member_colors === "object") {
    const map = { ...idol.member_colors };
    if (EN_NAME in map) {
      if (!(JA_NAME in map)) map[JA_NAME] = map[EN_NAME];
      delete map[EN_NAME];
      idol.member_colors = map;
    }
  }

  return { idol, droppedEn, retargetedEn };
}

function stripEnGroup(groups) {
  const before = groups.length;
  const next = groups.filter((g) => g.uid !== EN_UID && g.name !== EN_NAME);
  return { groups: next, removed: before - next.length };
}

const report = {
  main_groups_removed: 0,
  s6_groups_removed: 0,
  main_idols: { droppedEn: 0, retargetedEn: 0, touched: 0 },
  s6_idols: { droppedEn: 0, retargetedEn: 0, touched: 0 },
  tiers_removed: 0,
};

// --- groups ---
{
  const p = path.join(root, "public/data/groups.json");
  const groups = readJson(p);
  const { groups: next, removed } = stripEnGroup(groups);
  report.main_groups_removed = removed;
  writeJson(p, next);
}
{
  const p = path.join(root, "public/data/scenarios/scenario_6/groups.json");
  const groups = readJson(p);
  const { groups: next, removed } = stripEnGroup(groups);
  report.s6_groups_removed = removed;
  writeJson(p, next);
}

// --- idols ---
function fixIdols(rel, bucket) {
  const p = path.join(root, rel);
  const idols = readJson(p);
  for (const idol of idols) {
    const r = mergeIdolHistories(idol);
    bucket.droppedEn += r.droppedEn;
    bucket.retargetedEn += r.retargetedEn;
    if (r.droppedEn || r.retargetedEn) bucket.touched += 1;
  }
  writeJson(p, idols);
}

fixIdols("public/data/idols.json", report.main_idols);
fixIdols("public/data/scenarios/scenario_6/idols.json", report.s6_idols);

// --- group_tiers ---
{
  const p = path.join(root, "public/data/scenarios/scenario_6/group_tiers.json");
  if (fs.existsSync(p)) {
    const tiers = readJson(p);
    if (Array.isArray(tiers)) {
      const before = tiers.length;
      const next = tiers.filter((t) => t.uid !== EN_UID);
      report.tiers_removed = before - next.length;
      writeJson(p, next);
    }
  }
}

// Ensure JA group has romanji alias for English search without a second row
{
  for (const rel of ["public/data/groups.json", "public/data/scenarios/scenario_6/groups.json"]) {
    const p = path.join(root, rel);
    const groups = readJson(p);
    const ja = groups.find((g) => g.uid === JA_UID);
    if (ja) {
      if (!ja.name_romanji || ja.name_romanji === "HEROINES_Kenkyuusei") {
        ja.name_romanji = "HEROINES Kenkyuusei";
      }
      if (!ja.nickname) ja.nickname = "ヒロ研";
      writeJson(p, groups);
    }
  }
}

console.log(JSON.stringify(report, null, 2));
