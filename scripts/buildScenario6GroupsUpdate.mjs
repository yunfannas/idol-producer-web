/**
 * Build scenario_6 groups_update.json from canonical public/data/groups.json
 * for every name in startup_allowlist.json except アキシブproject.
 *
 * Usage: node scripts/buildScenario6GroupsUpdate.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioDir = path.join(root, "public/data/scenarios/scenario_6");
const allowPath = path.join(scenarioDir, "startup_allowlist.json");
const canonPath = path.join(root, "public/data/groups.json");
const scenarioPath = path.join(scenarioDir, "groups.json");
const outPath = path.join(scenarioDir, "groups_update.json");

const EXCLUDE_NAMES = new Set(["アキシブproject"]);

const allow = JSON.parse(fs.readFileSync(allowPath, "utf8"));
const names = (allow.names_in_order ?? []).filter((n) => !EXCLUDE_NAMES.has(n));

const canon = JSON.parse(fs.readFileSync(canonPath, "utf8"));
const scenario = JSON.parse(fs.readFileSync(scenarioPath, "utf8"));

const canonByName = new Map(canon.map((g) => [g.name, g]));
const scenByName = new Map(scenario.map((g) => [g.name, g]));

/** @type {Record<string, unknown>[]} */
const patches = [];
const report = {
  requested: names.length,
  patched: 0,
  missing_canon: [],
  missing_scenario: [],
  unchanged_uid: [],
};

for (const name of names) {
  const cg = canonByName.get(name);
  if (!cg) {
    report.missing_canon.push(name);
    continue;
  }
  if (!scenByName.has(name)) {
    report.missing_scenario.push(name);
  }
  const patch = structuredClone(cg);
  patches.push(patch);
  report.patched += 1;

  const sg = scenByName.get(name);
  if (sg && sg.uid === cg.uid && JSON.stringify(sg) === JSON.stringify(cg)) {
    report.unchanged_uid.push(name);
  }
}

if (report.missing_canon.length) {
  console.error("Missing from canonical groups.json:", report.missing_canon);
  process.exit(1);
}

const payload = {
  _meta: {
    purpose:
      "Stage sync from public/data/groups.json into scenario_6 groups.json (startup_allowlist names, excluding アキシブproject).",
    built_at: new Date().toISOString().slice(0, 10),
    merge_command: "node scripts/mergeScenario6GroupsUpdate.mjs",
    excluded_groups: [...EXCLUDE_NAMES],
    patch_count: patches.length,
    merge_rules_summary:
      "Same as mergeCatalogUpdates.mjs: discography by release uid; song_uids union; other arrays on patch replace.",
  },
  groups: patches,
};

fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

console.log(JSON.stringify(report, null, 2));
console.log(`Wrote ${outPath} (${patches.length} group rows)`);
