/**
 * Upsert idol rows from support/tmp/heroines_idols_from_desktop.json into
 * public/data/idols.json and scenario_6/idols.json (by uid).
 *
 * Usage:
 *   node support/scripts/upsertHeroinesIdolsFromDesktop.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const stagingPath = path.join(root, "support", "tmp", "heroines_idols_from_desktop.json");

/** @param {string} filePath */
function loadIdols(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
  if (Array.isArray(raw)) return { wrapper: "array", idols: raw };
  if (Array.isArray(raw.idols)) return { wrapper: "object", root: raw, idols: raw.idols };
  throw new Error(`Unrecognized idols shape: ${filePath}`);
}

/** @param {string} filePath @param {{wrapper:string, root?:any, idols:any[]}} bag */
function writeIdols(filePath, bag) {
  const payload = bag.wrapper === "array" ? bag.idols : { ...bag.root, idols: bag.idols };
  fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

function upsert(filePath, incoming) {
  const bag = loadIdols(filePath);
  const byUid = new Map(bag.idols.map((idol) => [idol.uid, idol]));
  let updated = 0;
  let created = 0;
  for (const idol of incoming) {
    if (!idol?.uid) continue;
    if (byUid.has(idol.uid)) {
      byUid.set(idol.uid, idol);
      updated += 1;
    } else {
      byUid.set(idol.uid, idol);
      created += 1;
    }
  }
  // Preserve original order for existing; append new at end
  const seen = new Set();
  const next = [];
  for (const idol of bag.idols) {
    const uid = idol?.uid;
    if (!uid || seen.has(uid)) continue;
    next.push(byUid.get(uid) ?? idol);
    seen.add(uid);
  }
  for (const idol of incoming) {
    const uid = idol?.uid;
    if (!uid || seen.has(uid)) continue;
    next.push(idol);
    seen.add(uid);
  }
  bag.idols = next;
  writeIdols(filePath, bag);
  return { updated, created, total: next.length };
}

const staging = JSON.parse(fs.readFileSync(stagingPath, "utf8"));
const incoming = Array.isArray(staging.idols) ? staging.idols : [];

const targets = [
  path.join(root, "public", "data", "idols.json"),
  path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json"),
];

for (const target of targets) {
  if (!fs.existsSync(target)) {
    console.error(`missing ${target}`);
    continue;
  }
  const result = upsert(target, incoming);
  console.log(`${path.relative(root, target)} updated=${result.updated} created=${result.created} total=${result.total}`);
}
