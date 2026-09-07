#!/usr/bin/env node
/**
 * Clean venue catalog duplicates created by TimeTree / schedule parsing.
 *
 * Safety rules:
 * - canonicalize aliases before deleting duplicate venue rows;
 * - remap every JSON `venue_uid` reference under public/data and src/engine/data;
 * - remove only labels rejected by isUsableVenueLabel() or rows resolved to another UID;
 * - keep raw venue/venue_hint text for rejected placeholders, but remove dangling venue_uid;
 * - dry-run by default. Pass --write to persist.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  findVenueInCatalog,
  isUsableVenueLabel,
  normalizeVenueKey,
} from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const WRITE = process.argv.includes("--write");

const venuePaths = [
  path.join(root, "public", "data", "venues.json"),
  path.join(root, "src", "engine", "data", "venues.json"),
];

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function buildIndex(venues) {
  const index = new Map();
  for (const venue of venues) {
    if (!venue || typeof venue !== "object") continue;
    const name = String(venue.name ?? "").trim();
    const romaji = String(venue.name_romanji ?? "").trim();
    if (name) index.set(normalizeVenueKey(name), venue);
    if (romaji) index.set(normalizeVenueKey(romaji), venue);
  }
  return index;
}

function walkJsonFiles(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsonFiles(p, out);
    else if (entry.isFile() && entry.name.endsWith(".json")) out.push(p);
  }
  return out;
}

const primary = readJson(venuePaths[0]);
if (!Array.isArray(primary.venues)) throw new Error("public/data/venues.json has no venues[]");

const index = buildIndex(primary.venues);
const uidRemap = new Map();
const invalidUids = new Set();
const aliasesFound = [];
const invalidFound = [];

for (const venue of primary.venues) {
  const uid = String(venue?.uid ?? "");
  const name = String(venue?.name ?? "").trim();
  if (!uid || !name) continue;

  if (!isUsableVenueLabel(name)) {
    invalidUids.add(uid);
    invalidFound.push(name);
    continue;
  }

  const resolved = findVenueInCatalog(name, index);
  const targetUid = String(resolved?.uid ?? "");
  if (resolved && targetUid && targetUid !== uid) {
    uidRemap.set(uid, targetUid);
    aliasesFound.push(`${name} -> ${resolved.name}`);
  }
}

// Collapse remap chains defensively.
for (const [from, initial] of [...uidRemap]) {
  let target = initial;
  const seen = new Set([from]);
  while (uidRemap.has(target) && !seen.has(target)) {
    seen.add(target);
    target = uidRemap.get(target);
  }
  uidRemap.set(from, target);
}

const kept = primary.venues.filter((venue) => {
  const uid = String(venue?.uid ?? "");
  return uid && !invalidUids.has(uid) && !uidRemap.has(uid);
});
const keptIndex = buildIndex(kept);

let filesChanged = 0;
let refsRemapped = 0;
let danglingRefsRemoved = 0;
let namesCanonicalized = 0;

function mutate(node) {
  let changed = false;
  if (Array.isArray(node)) {
    for (const item of node) changed = mutate(item) || changed;
    return changed;
  }
  if (!node || typeof node !== "object") return false;

  const oldUid = node.venue_uid != null ? String(node.venue_uid) : null;
  if (oldUid && uidRemap.has(oldUid)) {
    node.venue_uid = uidRemap.get(oldUid);
    refsRemapped++;
    changed = true;
  } else if (oldUid && invalidUids.has(oldUid)) {
    delete node.venue_uid;
    danglingRefsRemoved++;
    changed = true;
  }

  const venueLabel = typeof node.venue === "string" ? node.venue.trim() : "";
  if (venueLabel && isUsableVenueLabel(venueLabel)) {
    const hit = findVenueInCatalog(venueLabel, keptIndex);
    if (hit) {
      const canonicalName = String(hit.name ?? venueLabel);
      const canonicalUid = String(hit.uid ?? "");
      if (canonicalName && canonicalName !== node.venue) {
        node.venue = canonicalName;
        namesCanonicalized++;
        changed = true;
      }
      if (canonicalUid && node.venue_uid !== canonicalUid) {
        node.venue_uid = canonicalUid;
        refsRemapped++;
        changed = true;
      }
    }
  } else if (venueLabel && !isUsableVenueLabel(venueLabel) && node.venue_uid != null) {
    delete node.venue_uid;
    danglingRefsRemoved++;
    changed = true;
  }

  for (const value of Object.values(node)) changed = mutate(value) || changed;
  return changed;
}

const scanRoots = [path.join(root, "public", "data"), path.join(root, "src", "engine", "data")];
const venuePathSet = new Set(venuePaths.map((p) => path.resolve(p)));
const jsonFiles = scanRoots.flatMap((p) => walkJsonFiles(p));

for (const p of jsonFiles) {
  if (venuePathSet.has(path.resolve(p))) continue;
  let data;
  try {
    data = readJson(p);
  } catch {
    continue;
  }
  if (!mutate(data)) continue;
  filesChanged++;
  if (WRITE) fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

const cleanedPayload = { venues: kept };
if (WRITE) {
  for (const p of venuePaths) {
    fs.writeFileSync(p, `${JSON.stringify(cleanedPayload, null, 2)}\n`, "utf8");
  }
}

console.log(`Venue cleanup ${WRITE ? "WRITE" : "DRY RUN"}`);
console.log(`catalog rows: ${primary.venues.length} -> ${kept.length}`);
console.log(`alias duplicates removed: ${uidRemap.size}`);
console.log(`invalid/parser rows removed: ${invalidUids.size}`);
console.log(`JSON files changed: ${filesChanged}`);
console.log(`venue_uid remaps: ${refsRemapped}`);
console.log(`dangling venue_uid removed: ${danglingRefsRemoved}`);
console.log(`venue names canonicalized: ${namesCanonicalized}`);

if (aliasesFound.length) {
  console.log("\nAlias samples:");
  for (const x of aliasesFound.slice(0, 30)) console.log(`  ${x}`);
  if (aliasesFound.length > 30) console.log(`  ... +${aliasesFound.length - 30} more`);
}
if (invalidFound.length) {
  console.log("\nRejected parser/placeholder labels:");
  for (const x of invalidFound.sort()) console.log(`  ${x}`);
}

if (!WRITE) console.log("\nNo files written. Re-run with --write after reviewing this report.");
