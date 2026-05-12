/**
 * One-off / CI helper: build `group_tiers.json` for scenario 6 from `groups.json`
 * using the same letter-tier heuristic as `src/engine/financeSystem.ts` (`inferLetterTier`).
 *
 * Run: node scripts/build-scenario6-group-tiers.mjs
 *
 * Desktop parity: replace this output with `build_scenario_group_tier_list.py` when available.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "public", "data", "scenarios", "scenario_6_2025-07-20");
const groupsPath = path.join(root, "groups.json");
const outPath = path.join(root, "group_tiers.json");

function inferLetterTier(popularity, fans, xFollowers = 0) {
  const score = popularity + fans / 2000 + xFollowers / 5000;
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  if (score >= 25) return "D";
  if (score >= 12) return "E";
  return "F";
}

const LETTER_TIER_ORDER = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6 };

function normalizeTier(t) {
  const u = String(t ?? "")
    .trim()
    .toUpperCase();
  if (/^[SABCDEF]$/.test(u)) return u;
  return "F";
}

function resolveTier(g) {
  const raw = g.letter_tier;
  if (typeof raw === "string" && /^[SABCDEF]$/i.test(raw.trim())) {
    return raw.trim().toUpperCase();
  }
  const popularity = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const xFollowers = typeof g.x_followers === "number" ? g.x_followers : Number(g.x_followers ?? 0) || 0;
  return inferLetterTier(popularity, fans, xFollowers);
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
if (!Array.isArray(groups)) throw new Error("groups.json must be an array");

const rows = [];
for (const g of groups) {
  const uid = String(g.uid ?? "").trim();
  if (!uid) continue;
  const popularity = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const xFollowers = typeof g.x_followers === "number" ? g.x_followers : Number(g.x_followers ?? 0) || 0;
  const letter_tier = resolveTier(g);
  const ord = LETTER_TIER_ORDER[normalizeTier(letter_tier)] ?? 6;
  /** Ascending = better tier first, then higher fans (subtract fans). */
  const sort_key = ord * 1e15 - fans;
  rows.push({
    uid,
    letter_tier,
    fans,
    popularity,
    sort_key,
  });
}

rows.sort((a, b) => a.sort_key - b.sort_key || a.uid.localeCompare(b.uid));
fs.writeFileSync(outPath, JSON.stringify(rows, null, 2), "utf8");
console.log(`Wrote ${rows.length} rows to ${path.relative(process.cwd(), outPath)}`);
