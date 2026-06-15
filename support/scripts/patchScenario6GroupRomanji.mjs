/**
 * Set name_romanji on one scenario_6 group row (by uid or --group name).
 *
 * Usage:
 *   node scripts/patchScenario6GroupRomanji.mjs --group "点染テンセイ少女。" --romanji "Tensen Tensei Shoujo."
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const groupsPath = path.join(root, "public/data/scenarios/scenario_6/groups.json");

function crlfSerialize(obj) {
  return `${JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n")}\r\n`;
}

function parseArgs(argv) {
  let groupName = "";
  let groupUid = "";
  let romanji = "";
  for (let i = 2; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === "--group" && argv[i + 1]) groupName = argv[++i];
    else if (a === "--group-uid" && argv[i + 1]) groupUid = argv[++i];
    else if (a === "--romanji" && argv[i + 1]) romanji = argv[++i];
  }
  return { groupName, groupUid, romanji };
}

const { groupName, groupUid, romanji } = parseArgs(process.argv);
if (!romanji.trim()) {
  console.error("Requires --romanji");
  process.exit(1);
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const row = groupUid
  ? groups.find((g) => g?.uid === groupUid)
  : groups.find((g) => g?.name === groupName);
if (!row) {
  console.error("Group not found in scenario groups.json");
  process.exit(1);
}

row.name_romanji = romanji.trim();
const tmp = `${groupsPath}.tmp`;
fs.writeFileSync(tmp, crlfSerialize(groups));
JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.renameSync(tmp, groupsPath);
console.log(`[patch-scenario6-romanji] ${row.name}: name_romanji = ${row.name_romanji}`);
