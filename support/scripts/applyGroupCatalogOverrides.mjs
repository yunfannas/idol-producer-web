/**
 * Apply per-group overrides from public/data/reference/group_catalog_overrides/*.json
 * onto public/data/groups.json (formed_date, producers, …).
 *
 * Usage:
 *   node scripts/applyGroupCatalogOverrides.mjs
 *   node scripts/applyGroupCatalogOverrides.mjs --dry-run
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const groupsPath = path.join(root, "public/data/groups.json");
const overridesDir = path.join(root, "public/data/reference/group_catalog_overrides");

const ALLOWED_KEYS = new Set(["formed_date", "producers"]);

function loadOverrides() {
  if (!fs.existsSync(overridesDir)) return new Map();
  const byUid = new Map();
  for (const file of fs.readdirSync(overridesDir).filter((f) => f.endsWith(".json"))) {
    const raw = JSON.parse(fs.readFileSync(path.join(overridesDir, file), "utf8"));
    const uid = file.replace(/\.json$/i, "");
    const patch = {};
    for (const key of ALLOWED_KEYS) {
      if (raw[key] != null && String(raw[key]).trim()) patch[key] = String(raw[key]).trim();
    }
    if (Object.keys(patch).length) byUid.set(uid, patch);
  }
  return byUid;
}

const dryRun = process.argv.includes("--dry-run");
const overrides = loadOverrides();
if (!overrides.size) {
  console.log("[apply-group-overrides] no override files");
  process.exit(0);
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const beforeLen = groups.length;
const stats = { formed_date: 0, producers: 0, missing_uid: [] };

for (const [uid, patch] of overrides) {
  const row = groups.find((g) => String(g?.uid ?? "") === uid);
  if (!row) {
    stats.missing_uid.push(uid);
    continue;
  }
  for (const [k, v] of Object.entries(patch)) {
    if (row[k] !== v) {
      row[k] = v;
      stats[k] += 1;
    }
  }
}

console.log(JSON.stringify({ dry_run: dryRun, override_files: overrides.size, ...stats }, null, 2));
if (stats.missing_uid.length) {
  console.error("Unknown uids:", stats.missing_uid);
  process.exit(1);
}

if (dryRun) process.exit(0);

const tmp = `${groupsPath}.tmp`;
fs.writeFileSync(tmp, `${JSON.stringify(groups, null, 2)}\n`);
const parsed = JSON.parse(fs.readFileSync(tmp, "utf8"));
if (parsed.length !== beforeLen) throw new Error("groups.json length changed");
fs.renameSync(tmp, groupsPath);
console.log("[apply-group-overrides] wrote groups.json");
