/**
 * Copy formed_date + producers from canonical groups.json into scenario_6 rows
 * for startup_allowlist names (when canonical has a value).
 *
 * Usage: node scripts/syncScenario6GroupCatalogMeta.mjs [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioDir = path.join(root, "public/data/scenarios/scenario_6");
const allowPath = path.join(scenarioDir, "startup_allowlist.json");
const groupsPath = path.join(scenarioDir, "groups.json");
const canonPath = path.join(root, "public/data/groups.json");

function crlfSerialize(obj) {
  return `${JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n")}\r\n`;
}

const dryRun = process.argv.includes("--dry-run");
const allow = JSON.parse(fs.readFileSync(allowPath, "utf8"));
const names = allow.names_in_order ?? [];
const canonByName = new Map(JSON.parse(fs.readFileSync(canonPath, "utf8")).map((g) => [g.name, g]));
const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const scenByName = new Map(groups.map((g) => [g.name, g]));

let formed = 0;
let producers = 0;

for (const name of names) {
  const c = canonByName.get(name);
  const s = scenByName.get(name);
  if (!c || !s) continue;
  if (c.formed_date && s.formed_date !== c.formed_date) {
    s.formed_date = c.formed_date;
    formed += 1;
  }
  if (c.producers && s.producers !== c.producers) {
    s.producers = c.producers;
    producers += 1;
  }
}

console.log(JSON.stringify({ dry_run: dryRun, formed_date_updates: formed, producers_updates: producers }, null, 2));

if (dryRun) process.exit(0);

const tmp = `${groupsPath}.tmp`;
fs.writeFileSync(tmp, crlfSerialize(groups));
JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.renameSync(tmp, groupsPath);
console.log("[sync-scenario6-meta] written groups.json");
