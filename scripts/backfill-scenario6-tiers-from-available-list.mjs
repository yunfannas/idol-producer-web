/**
 * Apply `letter_tier` from `docs/scenario6_available_groups.txt` onto matching
 * rows in `public/data/scenarios/scenario_6_2025-07-20/groups.json` only (no interpolation).
 *
 * For **full** scenario 6 passes (manual anchors + interpolated tiers for every other group), use
 * `scripts/reinterpolate-scenario6-tiers.mjs` instead, then `build-scenario6-group-tiers.mjs`.
 *
 * Lines must look like: `12. Group Name | tier=B | members=9`
 *
 * Run: node scripts/backfill-scenario6-tiers-from-available-list.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const listPath = path.join(root, "docs", "scenario6_available_groups.txt");
const groupsPath = path.join(root, "public", "data", "scenarios", "scenario_6_2025-07-20", "groups.json");

const LINE_RE = /^\d+\.\s*(.+?)\s*\|\s*tier\s*=\s*([SABCDEFsabcdef])\s*\|\s*members\s*=\s*\d+\s*$/;

function loadSpecs() {
  const text = fs.readFileSync(listPath, "utf8");
  const specs = [];
  for (const line of text.split(/\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("Scenario")) continue;
    const m = t.match(LINE_RE);
    if (!m) continue;
    specs.push({ name: m[1].trim(), tier: m[2].toUpperCase() });
  }
  return specs;
}

function main() {
  const specs = loadSpecs();
  if (specs.length === 0) {
    console.error("No tier lines parsed from", listPath);
    process.exit(1);
  }

  const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  if (!Array.isArray(groups)) throw new Error("groups.json must be an array");

  /** @type {Map<string, object[]>} */
  const byName = new Map();
  for (const g of groups) {
    const n = String(g.name ?? "").trim();
    if (!n) continue;
    if (!byName.has(n)) byName.set(n, []);
    byName.get(n).push(g);
  }

  const missing = [];
  const ambiguous = [];
  let changed = 0;
  let unchanged = 0;

  for (const { name, tier } of specs) {
    const hits = byName.get(name);
    if (!hits || hits.length === 0) {
      missing.push(name);
      continue;
    }
    if (hits.length > 1) {
      ambiguous.push({ name, count: hits.length });
      continue;
    }
    const g = hits[0];
    const prev = typeof g.letter_tier === "string" ? g.letter_tier.trim().toUpperCase() : "";
    g.letter_tier = tier;
    if (prev !== tier) changed++;
    else unchanged++;
  }

  if (missing.length || ambiguous.length) {
    if (missing.length) {
      console.error("No exact `name` match in groups.json for:");
      for (const n of missing) console.error("  -", JSON.stringify(n));
    }
    if (ambiguous.length) {
      console.error("Multiple groups with same `name`:");
      for (const x of ambiguous) console.error("  -", JSON.stringify(x.name), `(${x.count})`);
    }
    process.exit(1);
  }

  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), "utf8");
  console.log(
    `Updated letter_tier for ${specs.length} groups (${changed} changed, ${unchanged} already set): ${path.relative(root, groupsPath)}`,
  );
}

main();
