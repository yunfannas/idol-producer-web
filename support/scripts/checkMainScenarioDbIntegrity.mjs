#!/usr/bin/env node
/**
 * Integrity check for main catalog vs scenario snapshot databases.
 *
 * Scenario 6 is a time-locked snapshot at preset.opening_date — member lists must
 * match dated idol group_history active on that day, NOT main/public/data/groups.json
 * (which is "today").
 *
 * Usage:
 *   node support/scripts/checkMainScenarioDbIntegrity.mjs
 *   node support/scripts/checkMainScenarioDbIntegrity.mjs --scenario scenario_6
 *   node support/scripts/checkMainScenarioDbIntegrity.mjs --json
 *   node support/scripts/checkMainScenarioDbIntegrity.mjs --allowlist-only
 *
 * Exit 0 = pass, 1 = failures found.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const args = new Set(process.argv.slice(2));
const jsonOut = args.has("--json");
const allowlistOnly = args.has("--allowlist-only");
const scenarioArgIdx = process.argv.indexOf("--scenario");
const scenarioSubdir =
  scenarioArgIdx >= 0 && process.argv[scenarioArgIdx + 1]
    ? process.argv[scenarioArgIdx + 1]
    : "scenario_6";

const presetId = scenarioSubdir.replace(/^scenario_/, "scenario");
const presetPathCandidates = [
  path.join(root, "public/data/scenarios/presets", `${presetId}.json`),
  path.join(root, "public/data/scenarios/presets", "scenario6.json"),
];
const presetPath = presetPathCandidates.find((p) => fs.existsSync(p));
if (!presetPath) {
  console.error(`Preset not found for ${scenarioSubdir}`);
  process.exit(1);
}

const scenarioDir = path.join(root, "public/data/scenarios", scenarioSubdir);
const paths = {
  preset: presetPath,
  mainGroups: path.join(root, "public/data/groups.json"),
  mainIdols: path.join(root, "public/data/idols.json"),
  scenarioGroups: path.join(scenarioDir, "groups.json"),
  scenarioIdols: path.join(scenarioDir, "idols.json"),
  allowlist: path.join(scenarioDir, "startup_allowlist.json"),
  groupsUpdate: path.join(scenarioDir, "groups_update.json"),
  expectedDoc: path.join(root, "support/docs/scenario6_available_groups.txt"),
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

/** Active on opening only when start_date is present and brackets the day. */
function isActiveDated(history, openingDate) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (!start) return false;
  if (compareIso(start, openingDate) > 0) return false;
  if (end && compareIso(end, openingDate) < 0) return false;
  return true;
}

/** Legacy buggy rule: null dates count as active (reproduces refreshScenario6GroupMembers bug). */
function isActiveLegacyNullOk(history, openingDate) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (start && compareIso(start, openingDate) > 0) return false;
  if (end && compareIso(end, openingDate) < 0) return false;
  return true;
}

function matchesGroup(history, group) {
  if (!history || !group) return false;
  if (typeof history.group_uid === "string" && history.group_uid && history.group_uid === group.uid) {
    return true;
  }
  if (typeof history.group_name !== "string" || !history.group_name) return false;
  const historyName = history.group_name.trim();
  return historyName === group.name || historyName === group.name_romanji;
}

function idolDisplayName(idol) {
  const value = typeof idol?.name === "string" ? idol.name.trim() : "";
  if (value) return value;
  return typeof idol?.romaji === "string" ? idol.romaji : "";
}

function rebuildRoster(group, idols, openingDate, activeFn) {
  /** Prefer first-seen uid per display name (same semantics as refreshScenario6GroupMembers). */
  const byName = new Map();
  for (const idol of idols) {
    const histories = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const history of histories) {
      if (!matchesGroup(history, group)) continue;
      if (!activeFn(history, openingDate)) continue;
      const uid = typeof idol.uid === "string" ? idol.uid : "";
      const name = idolDisplayName(idol);
      if (!uid || !name) continue;
      if (byName.has(name)) continue;
      byName.set(name, uid);
    }
  }
  return byName;
}

function parseExpectedDoc(filePath) {
  /** @type {Map<string, number>} */
  const out = new Map();
  if (!fs.existsSync(filePath)) return out;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\d+\.\s*(.+?)\s*\|\s*tier=\S+\s*\|\s*members=(\d+)\s*$/);
    if (!m) continue;
    out.set(m[1].trim(), Number(m[2]));
  }
  return out;
}

function countNullDateAliases(idols, group, opening) {
  let nullAlias = 0;
  let datedActive = 0;
  for (const idol of idols) {
    for (const history of idol.group_history || []) {
      if (!matchesGroup(history, group)) continue;
      const start = isoDay(history.start_date);
      const end = isoDay(history.end_date ?? history.leave_date);
      if (!start && !end) nullAlias += 1;
      else if (isActiveDated(history, opening)) datedActive += 1;
    }
  }
  return { nullAlias, datedActive };
}

const preset = readJson(paths.preset);
const openingDate = String(preset.opening_date ?? "").slice(0, 10);
if (!/^\d{4}-\d{2}-\d{2}$/.test(openingDate)) {
  console.error(`Invalid opening_date in ${paths.preset}`);
  process.exit(1);
}

const mainGroups = readJson(paths.mainGroups);
const mainIdols = readJson(paths.mainIdols);
const scenarioGroups = readJson(paths.scenarioGroups);
const scenarioIdols = readJson(paths.scenarioIdols);
const allowlist = fs.existsSync(paths.allowlist) ? readJson(paths.allowlist) : { names_in_order: [] };
const groupsUpdate = fs.existsSync(paths.groupsUpdate) ? readJson(paths.groupsUpdate) : { groups: [] };
const expectedDoc = parseExpectedDoc(paths.expectedDoc);

const allowNames = Array.isArray(allowlist.names_in_order) ? allowlist.names_in_order : [];
const allowSet = new Set(allowNames);
const scenarioByName = new Map(scenarioGroups.map((g) => [g.name, g]));
const mainByName = new Map(mainGroups.map((g) => [g.name, g]));

/** @type {object[]} */
const failures = [];
/** @type {object[]} */
const warnings = [];

function fail(code, message, detail = {}) {
  failures.push({ severity: "error", code, message, ...detail });
}

function warn(code, message, detail = {}) {
  warnings.push({ severity: "warning", code, message, ...detail });
}

// --- A. Structural consistency on scenario groups ---
const groupsToCheck = allowlistOnly
  ? allowNames.map((n) => scenarioByName.get(n)).filter(Boolean)
  : scenarioGroups;

for (const group of groupsToCheck) {
  const uids = Array.isArray(group.member_uids) ? group.member_uids : [];
  const names = Array.isArray(group.member_names) ? group.member_names : [];
  const count = Number(group.member_count ?? NaN);
  if (uids.length !== names.length) {
    fail("member_array_mismatch", `${group.name}: member_uids(${uids.length}) != member_names(${names.length})`, {
      group: group.name,
    });
  }
  if (Number.isFinite(count) && count !== uids.length) {
    fail("member_count_desync", `${group.name}: member_count=${count} but member_uids.length=${uids.length}`, {
      group: group.name,
      member_count: count,
      uid_len: uids.length,
    });
  }
}

// --- B. Opening-date roster rebuild (strict dated history) ---
const rosterMismatches = [];
for (const group of groupsToCheck) {
  if (allowlistOnly && !allowSet.has(group.name)) continue;
  const expected = rebuildRoster(group, scenarioIdols, openingDate, isActiveDated);
  const storedUids = Array.isArray(group.member_uids) ? group.member_uids.map(String) : [];
  const storedNames = Array.isArray(group.member_names) ? group.member_names.map(String) : [];
  const expectedNames = new Set([...expected.keys()]);
  const storedNameSet = new Set(storedNames);
  const extra = storedNames.filter((n) => !expectedNames.has(n));
  const missing = [...expectedNames].filter((n) => !storedNameSet.has(n));
  const legacy = rebuildRoster(group, scenarioIdols, openingDate, isActiveLegacyNullOk);
  const nullPollution = countNullDateAliases(scenarioIdols, group, openingDate);

  if (extra.length || missing.length || expected.size !== storedUids.length) {
    const row = {
      group: group.name,
      opening_date: openingDate,
      expected_count: expected.size,
      stored_count: storedUids.length,
      member_count_field: group.member_count,
      extra_members: extra,
      missing_members: missing,
      null_date_alias_histories: nullPollution.nullAlias,
      legacy_null_ok_count: legacy.size,
      doc_expected: expectedDoc.get(group.name) ?? null,
    };
    rosterMismatches.push(row);
    fail(
      "opening_roster_mismatch",
      `${group.name}: stored ${storedUids.length} members, dated history @ ${openingDate} expects ${expected.size}`,
      row,
    );
  } else if (nullPollution.nullAlias > 0) {
    warn(
      "null_date_alias_histories",
      `${group.name}: ${nullPollution.nullAlias} undated group_history alias rows (safe today only because roster already matches dated rebuild)`,
      { group: group.name, ...nullPollution },
    );
  }

  const docCount = expectedDoc.get(group.name);
  if (docCount != null && expected.size !== docCount) {
    warn(
      "doc_vs_history",
      `${group.name}: dated history expects ${expected.size} but scenario6_available_groups.txt says ${docCount}`,
      { group: group.name, history: expected.size, doc: docCount },
    );
  }
}

// --- C. Main vs scenario: expect DIFFERENT member counts for living groups ---
// Flag only when scenario looks accidentally equal to main AND diverges from opening rebuild.
for (const name of allowNames) {
  const sg = scenarioByName.get(name);
  const mg = mainByName.get(name);
  if (!sg || !mg) continue;
  const sCount = Array.isArray(sg.member_uids) ? sg.member_uids.length : 0;
  const mCount = Array.isArray(mg.member_uids) ? mg.member_uids.length : 0;
  const expected = rebuildRoster(sg, scenarioIdols, openingDate, isActiveDated);
  if (sCount === mCount && expected.size !== sCount) {
    warn(
      "scenario_matches_main_not_opening",
      `${name}: scenario member count (${sCount}) equals main ("today") but not opening-date history (${expected.size}) — likely bad main→scenario sync`,
      { group: name, main: mCount, scenario: sCount, opening_expected: expected.size },
    );
  }
}

// --- D. groups_update.json time-lock hazards ---
const updateGroups = Array.isArray(groupsUpdate.groups) ? groupsUpdate.groups : [];
for (const patch of updateGroups) {
  const sg = scenarioByName.get(patch.name) || scenarioGroups.find((g) => g.uid === patch.uid);
  if (!sg) continue;
  const patchCount = Array.isArray(patch.member_uids) ? patch.member_uids.length : Number(patch.member_count ?? NaN);
  const expected = rebuildRoster(sg, scenarioIdols, openingDate, isActiveDated);
  if (Number.isFinite(patchCount) && patchCount !== expected.size) {
    warn(
      "groups_update_roster_vs_opening",
      `${patch.name}: groups_update has ${patchCount} members; opening-date history expects ${expected.size}. Merging this patch would corrupt the time-lock.`,
      { group: patch.name, patch_count: patchCount, opening_expected: expected.size },
    );
  }
}

// --- E. Catalog size sanity ---
if (scenarioGroups.length < 100) {
  warn("scenario_group_count_low", `scenario groups.json only has ${scenarioGroups.length} groups`);
}
if (scenarioIdols.length < 1000) {
  warn("scenario_idol_count_low", `scenario idols.json only has ${scenarioIdols.length} idols`);
}

const report = {
  ok: failures.length === 0,
  scenario: scenarioSubdir,
  opening_date: openingDate,
  scope: allowlistOnly ? "allowlist" : "all_scenario_groups",
  counts: {
    main_groups: mainGroups.length,
    main_idols: mainIdols.length,
    scenario_groups: scenarioGroups.length,
    scenario_idols: scenarioIdols.length,
    allowlist_groups: allowNames.length,
    groups_checked: groupsToCheck.length,
    opening_roster_mismatches: rosterMismatches.length,
    failures: failures.length,
    warnings: warnings.length,
  },
  failures,
  warnings,
  canary: {
    note: "Pinned startup groups — these must match opening-date dated history",
    groups: ["=LOVE", "iLiFE!", "高嶺のなでしこ", "アキシブproject"].map((name) => {
      const g = scenarioByName.get(name);
      if (!g) return { name, error: "missing" };
      const expected = rebuildRoster(g, scenarioIdols, openingDate, isActiveDated);
      const stored = Array.isArray(g.member_names) ? g.member_names : [];
      const main = mainByName.get(name);
      return {
        name,
        opening_expected: expected.size,
        scenario_stored: stored.length,
        member_count_field: g.member_count,
        main_today: main && Array.isArray(main.member_uids) ? main.member_uids.length : null,
        doc_expected: expectedDoc.get(name) ?? null,
        ok: expected.size === stored.length && [...expected.keys()].every((n) => stored.includes(n)),
      };
    }),
  },
};

if (jsonOut) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Scenario DB integrity: ${report.ok ? "PASS" : "FAIL"}`);
  console.log(`  scenario=${scenarioSubdir} opening_date=${openingDate} scope=${report.scope}`);
  console.log(
    `  main=${report.counts.main_groups}g/${report.counts.main_idols}i  scenario=${report.counts.scenario_groups}g/${report.counts.scenario_idols}i  checked=${report.counts.groups_checked}`,
  );
  console.log("\nCanary (startup pins):");
  for (const row of report.canary.groups) {
    if (row.error) {
      console.log(`  ✗ ${row.name}: ${row.error}`);
      continue;
    }
    const mark = row.ok ? "✓" : "✗";
    console.log(
      `  ${mark} ${row.name}: scenario=${row.scenario_stored} (count_field=${row.member_count_field}) opening_hist=${row.opening_expected} main_today=${row.main_today} doc=${row.doc_expected}`,
    );
  }
  if (failures.length) {
    console.log(`\nFailures (${failures.length}):`);
    for (const f of failures.slice(0, 40)) {
      console.log(`  ✗ [${f.code}] ${f.message}`);
      if (f.extra_members?.length) console.log(`      extra: ${f.extra_members.join(", ")}`);
      if (f.missing_members?.length) console.log(`      missing: ${f.missing_members.join(", ")}`);
      if (f.null_date_alias_histories) console.log(`      null-date aliases: ${f.null_date_alias_histories}`);
    }
    if (failures.length > 40) console.log(`  … ${failures.length - 40} more`);
  }
  if (warnings.length) {
    console.log(`\nWarnings (${warnings.length}):`);
    for (const w of warnings.slice(0, 30)) {
      console.log(`  ! [${w.code}] ${w.message}`);
    }
    if (warnings.length > 30) console.log(`  … ${warnings.length - 30} more`);
  }
  console.log("\nReminder: main DB is current-day catalog; scenario DB is time-locked. Equal member counts are NOT required.");
}

process.exit(report.ok ? 0 : 1);
