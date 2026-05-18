/**
 * Copy canonical song_uids onto アキシブproject in scenario_6 groups.json.
 *
 * Usage:
 *   node scripts/patchScenario6AkishibuSongUids.mjs
 *   node scripts/patchScenario6AkishibuSongUids.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioDir = path.join(root, "public/data/scenarios/scenario_6_2025-07-20");
const groupsPath = path.join(scenarioDir, "groups.json");
const canonPath = path.join(root, "public/data/groups.json");

const GROUP_UID = "44Ki44Kt44K344OWcHJvamVjdA";
const GROUP_NAME = "アキシブproject";

function crlfSerialize(obj) {
  return `${JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n")}\r\n`;
}

const dryRun = process.argv.includes("--dry-run");

const canon = JSON.parse(fs.readFileSync(canonPath, "utf8"));
const canonGroup = canon.find((g) => g?.uid === GROUP_UID || g?.name === GROUP_NAME);
if (!canonGroup) {
  console.error("Canonical アキシブproject not found");
  process.exit(1);
}

const songUids = Array.isArray(canonGroup.song_uids)
  ? canonGroup.song_uids.map((u) => String(u).trim()).filter(Boolean)
  : [];
if (!songUids.length) {
  console.error("Canonical song_uids empty — aborting");
  process.exit(1);
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const idx = groups.findIndex((g) => g?.uid === GROUP_UID);
if (idx < 0) {
  console.error("Scenario group row not found for uid", GROUP_UID);
  process.exit(1);
}

const row = groups[idx];
if (row.name !== GROUP_NAME) {
  console.error(`UID ${GROUP_UID} is ${row.name}, expected ${GROUP_NAME}`);
  process.exit(1);
}

const before = Array.isArray(row.song_uids) ? row.song_uids.length : 0;
console.log(`[patch-scenario6-akishibu] ${GROUP_NAME}: song_uids ${before} -> ${songUids.length}`);

if (dryRun) {
  console.log("[patch-scenario6-akishibu] --dry-run: not writing");
  process.exit(0);
}

row.song_uids = structuredClone(songUids);

const tmp = `${groupsPath}.tmp`;
fs.writeFileSync(tmp, crlfSerialize(groups));
JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.renameSync(tmp, groupsPath);
console.log("[patch-scenario6-akishibu] written groups.json (parse ok)");
