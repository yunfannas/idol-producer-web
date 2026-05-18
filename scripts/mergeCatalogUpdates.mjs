#!/usr/bin/env node
/**
 * Merge `public/data/groups_update.json` into `groups.json`
 * and `public/data/songs_update.json` into `songs.json`.
 *
 * - Group rows match by group `uid` (canonical row must exist unless --allow-new).
 * - Within a group patch, `discography[]` merges by release `uid` (deep-merge per release).
 * - Top-level object fields merge deeply (plain objects only); arrays on the patch replace
 *   the existing array except `song_uids` → union-append unique.
 *
 * Usage:
 *   node scripts/mergeCatalogUpdates.mjs
 *   node scripts/mergeCatalogUpdates.mjs --dry-run
 *   node scripts/mergeCatalogUpdates.mjs --allow-new
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const pd = (...p) => path.join(root, "public", "data", ...p);

const groupsPath = pd("groups.json");
const songsPath = pd("songs.json");
const groupsUpdatePath = pd("groups_update.json");
const songsUpdatePath = pd("songs_update.json");

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

/** @param {{ uid?: string }}[] main @param {{ uid?: string }}[] patch */
function mergeDiscography(main, patch) {
  const mainArr = Array.isArray(main) ? [...main] : [];
  const patchArr = Array.isArray(patch) ? [...patch] : [];
  const patchMap = new Map(patchArr.filter((d) => d && d.uid).map((d) => [String(d.uid), structuredClone(d)]));

  const seen = new Set();
  /** @type {Record<string, unknown>[]} */
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
      ex[k] = mergeDiscography(ex.discography, /** @type {unknown} */ (bv));
      continue;
    }
    if (k === "song_uids") {
      ex[k] = mergeSongUids(ex.song_uids, /** @type {unknown} */ (bv));
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

function mergeSongRow(existing, patch) {
  return deepMergePrimitivesAndObjects(existing, patch);
}

function main() {
  const dryRun = process.argv.includes("--dry-run");
  const allowNew = process.argv.includes("--allow-new");

  /** @type {string[]} */
  const log = [];

  if (!fs.existsSync(groupsPath)) {
    console.error("Missing:", groupsPath);
    process.exit(1);
  }
  if (!fs.existsSync(songsPath)) {
    console.error("Missing:", songsPath);
    process.exit(1);
  }

  /** @type {unknown[]} */
  const groupsMain = JSON.parse(fs.readFileSync(groupsPath, "utf8"));

  /** @type {unknown[]} */
  const songsMain = JSON.parse(fs.readFileSync(songsPath, "utf8"));

  let groupsDirty = false;
  let songsDirty = false;

  if (fs.existsSync(groupsUpdatePath)) {
    const rawUp = stripMeta(JSON.parse(fs.readFileSync(groupsUpdatePath, "utf8")));
    const patchList = rawUp.groups;
    if (!Array.isArray(patchList))
      throw new Error("groups_update.json: top-level `groups` must be an array");

    /** @type {Map<string, number>} */
    const ix = new Map();
    for (let i = 0; i < groupsMain.length; i++) {
      const g = groupsMain[i];
      if (isPlain(g) && typeof g.uid === "string") ix.set(g.uid, i);
    }

    let mergedCount = 0;
    let skippedNew = 0;

    if (patchList.length === 0) {
      log.push("groups_update: empty `groups[]` — skipping");
    }
    for (const pg of patchList) {
      if (!isPlain(pg) || typeof pg.uid !== "string")
        throw new Error("groups_update entry requires string `uid`");
      const uid = pg.uid;
      const idx = ix.get(uid);
      if (idx === undefined || idx < 0) {
        if (allowNew) {
          groupsMain.push(mergeGroupRow(undefined, structuredClone(pg)));
          ix.set(uid, groupsMain.length - 1);
          mergedCount++;
          groupsDirty = true;
        } else {
          skippedNew++;
          console.error(
            `[merge-groups] Skip unknown uid ${uid} (use --allow-new to append a full group row)`,
          );
        }
        continue;
      }
      const next = mergeGroupRow(/** @type {Record<string, unknown>} */ (groupsMain[idx]), pg);
      groupsMain[idx] = next;
      mergedCount++;
      groupsDirty = true;
    }

    if (patchList.length)
      log.push(
        `groups: merged ${mergedCount} row(s)` +
          (skippedNew ? `, skipped-unknown ${skippedNew}` : ""),
      );
  } else log.push("groups_update.json absent — skipping");

  if (fs.existsSync(songsUpdatePath)) {
    const rawUp = stripMeta(JSON.parse(fs.readFileSync(songsUpdatePath, "utf8")));
    const plist = rawUp.songs;
    if (!plist) log.push("songs_update: no `songs` key — skipping");
    else if (!Array.isArray(plist)) throw new Error("songs_update.json: `songs` must be an array");
    else if (plist.length === 0) log.push("songs_update: empty `songs[]` — skipping");
    else {
      /** @type {Map<string, number>} */
      const sx = new Map();
      for (let i = 0; i < songsMain.length; i++) {
        const s = songsMain[i];
        if (isPlain(s) && typeof s.uid === "string") sx.set(String(s.uid), i);
      }
      let inserts = 0;
      let updates = 0;
      for (const ps of plist) {
        if (!isPlain(ps) || typeof ps.uid !== "string")
          throw new Error("songs_update entry requires string `uid`");
        const uid = String(ps.uid);
        const i = sx.get(uid);
        if (i !== undefined) {
          songsMain[i] = mergeSongRow(
            /** @type {Record<string, unknown>} */ (songsMain[i]),
            structuredClone(ps),
          );
          updates++;
          songsDirty = true;
          continue;
        }
        sx.set(uid, songsMain.length);
        songsMain.push(structuredClone(ps));
        inserts++;
        songsDirty = true;
      }
      log.push(`songs: ${updates} update(s), ${inserts} insert(s)`);
    }
  } else log.push("songs_update.json absent — skipping");

  for (const line of log) console.log("[merge-catalog]", line);

  if (!groupsDirty && !songsDirty) {
    console.log("[merge-catalog] Nothing to write");
    process.exit(0);
  }

  if (dryRun) {
    console.log("[merge-catalog] --dry-run: not writing disk");
    process.exit(0);
  }

  if (groupsDirty) fs.writeFileSync(groupsPath, crlfSerialize(groupsMain), "utf8");
  if (songsDirty) fs.writeFileSync(songsPath, crlfSerialize(songsMain), "utf8");
  JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  JSON.parse(fs.readFileSync(songsPath, "utf8"));
  console.log("[merge-catalog] written groups.json / songs.json (parse ok)");
}

main();
