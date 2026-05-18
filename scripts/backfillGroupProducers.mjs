/**
 * Fill empty `producers` on groups.json from wiki sentence or idolsdiagram "Producer …" lines.
 * Skips rows that already have producers; does not overwrite overrides.
 *
 * Usage:
 *   node scripts/backfillGroupProducers.mjs
 *   node scripts/backfillGroupProducers.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const groupsPath = path.join(root, "public/data/groups.json");

/** @returns {string} */
export function extractProducerFromDescription(desc) {
  const d = String(desc ?? "");

  const wiki = d.match(/\bproduced by\s+([^.;]+(?:member,\s*[^.;]+)?)\./i);
  if (wiki) return wiki[1].trim();

  const diagram = d.match(
    /\bProducer\s+([A-Z][a-z]+(?:\s+[A-Z][a-z.']+){0,2})(?=\s+(?:Links|Former|Current|Years|Agency|Social|Wiki))/,
  );
  if (diagram) return diagram[1].trim();

  return "";
}

const dryRun = process.argv.includes("--dry-run");
const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const beforeLen = groups.length;
let filled = 0;
const samples = [];

for (const g of groups) {
  if (String(g.producers ?? "").trim()) continue;
  const next = extractProducerFromDescription(g.description);
  if (!next) continue;
  g.producers = next;
  filled += 1;
  if (samples.length < 8) samples.push({ name: g.name, producers: next });
}

console.log(JSON.stringify({ dry_run: dryRun, filled, samples }, null, 2));

if (dryRun) process.exit(0);

const tmp = `${groupsPath}.tmp`;
fs.writeFileSync(tmp, `${JSON.stringify(groups, null, 2)}\n`);
const parsed = JSON.parse(fs.readFileSync(tmp, "utf8"));
if (parsed.length !== beforeLen) throw new Error("groups.json length changed");
fs.renameSync(tmp, groupsPath);
console.log("[backfill-producers] wrote groups.json");
