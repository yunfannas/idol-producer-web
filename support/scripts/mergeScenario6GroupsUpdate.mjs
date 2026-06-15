#!/usr/bin/env node
/**
 * Merge scenario_6 `groups_update.json` into `groups.json` (same rules as mergeCatalogUpdates).
 *
 * Usage:
 *   node scripts/mergeScenario6GroupsUpdate.mjs
 *   node scripts/mergeScenario6GroupsUpdate.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const scenarioDir = path.join(root, "public/data/scenarios/scenario_6");
const groupsPath = path.join(scenarioDir, "groups.json");
const groupsUpdatePath = path.join(scenarioDir, "groups_update.json");

function crlfSerialize(obj) {
  return `${JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n")}\r\n`;
}

function stripMeta(obj) {
  if (!obj || typeof obj !== "object") return obj;
  const { _meta, _comment, ...rest } = obj;
  return rest;
}

function isPlain(o) {
  return o !== null && typeof o === "object" && !Array.isArray(o);
}

function deepMergePrimitivesAndObjects(a, b) {
  if (!isPlain(a) || !isPlain(b)) return structuredClone(b);
  const out = { ...structuredClone(a) };
  for (const [k, bv] of Object.entries(b)) {
    if (k.startsWith("_")) continue;
    if (bv === undefined) continue;
    const av = out[k];
    if (Array.isArray(bv)) out[k] = structuredClone(bv);
    else if (isPlain(bv) && isPlain(av)) out[k] = deepMergePrimitivesAndObjects(av, bv);
    else out[k] = structuredClone(bv);
  }
  return out;
}

function mergeSongUids(existing, patch) {
  if (!Array.isArray(patch)) return existing;
  const cur = Array.isArray(existing) ? [...existing] : [];
  const seen = new Set(cur.map(String));
  for (const uid of patch) {
    const s = String(uid);
    if (!seen.has(s)) {
      seen.add(s);
      cur.push(s);
    }
  }
  return cur;
}

function mergeDiscography(main, patch) {
  const mainArr = Array.isArray(main) ? [...main] : [];
  const patchArr = Array.isArray(patch) ? [...patch] : [];
  const patchMap = new Map(patchArr.filter((d) => d && d.uid).map((d) => [String(d.uid), structuredClone(d)]));

  const seen = new Set();
  const out = [];
  for (const row of mainArr) {
    if (!row?.uid) {
      out.push(structuredClone(row));
      continue;
    }
    const uid = String(row.uid);
    seen.add(uid);
    const pu = patchMap.get(uid);
    if (pu) out.push(deepMergePrimitivesAndObjects(row, pu));
    else out.push(structuredClone(row));
  }
  for (const [uid, row] of patchMap) {
    if (!seen.has(uid)) out.push(structuredClone(row));
  }
  return out;
}

function mergeGroupRow(existing, patch) {
  if (!existing) return structuredClone(patch);
  const ex = structuredClone(existing);
  for (const [k, bv] of Object.entries(patch)) {
    if (k.startsWith("_")) continue;
    if (bv === undefined) continue;
    if (k === "discography") {
      ex[k] = mergeDiscography(ex.discography, bv);
      continue;
    }
    if (k === "song_uids") {
      ex[k] = mergeSongUids(ex.song_uids, bv);
      continue;
    }
    if (Array.isArray(bv)) {
      ex[k] = structuredClone(bv);
      continue;
    }
    if (isPlain(bv) && isPlain(ex[k])) ex[k] = deepMergePrimitivesAndObjects(ex[k], bv);
    else ex[k] = structuredClone(bv);
  }
  return ex;
}

const dryRun = process.argv.includes("--dry-run");
const allowNew = process.argv.includes("--allow-new");

if (!fs.existsSync(groupsPath) || !fs.existsSync(groupsUpdatePath)) {
  console.error("Missing scenario groups.json or groups_update.json — run buildScenario6GroupsUpdate.mjs first");
  process.exit(1);
}

const groupsMain = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const rawUp = stripMeta(JSON.parse(fs.readFileSync(groupsUpdatePath, "utf8")));
const patchList = rawUp.groups;
if (!Array.isArray(patchList)) throw new Error("groups_update.json: `groups` must be an array");

const ix = new Map();
for (let i = 0; i < groupsMain.length; i++) {
  const g = groupsMain[i];
  if (isPlain(g) && typeof g.uid === "string") ix.set(g.uid, i);
}

let mergedCount = 0;
let skippedNew = 0;

for (const pg of patchList) {
  if (!isPlain(pg) || typeof pg.uid !== "string") throw new Error("groups_update entry requires string `uid`");
  const uid = pg.uid;
  const idx = ix.get(uid);
  if (idx === undefined) {
    if (allowNew) {
      groupsMain.push(mergeGroupRow(undefined, structuredClone(pg)));
      ix.set(uid, groupsMain.length - 1);
      mergedCount++;
    } else {
      skippedNew++;
      console.error(`[merge-scenario6] Skip unknown uid ${uid}`);
    }
    continue;
  }
  groupsMain[idx] = mergeGroupRow(groupsMain[idx], pg);
  mergedCount++;
}

console.log(`[merge-scenario6] merged ${mergedCount} row(s)` + (skippedNew ? `, skipped-unknown ${skippedNew}` : ""));

if (skippedNew) process.exit(1);

if (dryRun) {
  console.log("[merge-scenario6] --dry-run: not writing disk");
  process.exit(0);
}

const tmp = `${groupsPath}.tmp`;
fs.writeFileSync(tmp, crlfSerialize(groupsMain));
JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.renameSync(tmp, groupsPath);
console.log("[merge-scenario6] written groups.json (parse ok)");
