/**
 * Recompute every `letter_tier` in scenario 6 `groups.json`:
 * - Groups listed in `docs/scenario6_available_groups.txt` keep your manual tier (exact `name` match).
 * - All other groups get a tier from a score axis calibrated to anchor medians, then smoothed so
 *   S..F cutpoints stay monotonic (same score definition as `inferLetterTier` / financeSystem).
 *
 * Then run: node scripts/build-scenario6-group-tiers.mjs
 *
 * Run: node scripts/reinterpolate-scenario6-tiers.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const listPath = path.join(root, "docs", "scenario6_available_groups.txt");
const groupsPath = path.join(root, "public", "data", "scenarios", "scenario_6_2025-07-20", "groups.json");

const LINE_RE = /^\d+\.\s*(.+?)\s*\|\s*tier\s*=\s*([SABCDEFsabcdef])\s*\|\s*members\s*=\s*\d+\s*$/;

const TIER_BEST_TO_WORST = ["S", "A", "B", "C", "D", "E", "F"];

/** Mid-scores inside each legacy inferLetterTier band (when a tier has no anchors). */
const DEFAULT_SCORE_ANCHOR = {
  S: 95,
  A: 77,
  B: 62,
  C: 48,
  D: 33,
  E: 18,
  F: 4,
};

function groupScore(g) {
  const popularity = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const xFollowers = typeof g.x_followers === "number" ? g.x_followers : Number(g.x_followers ?? 0) || 0;
  return popularity + fans / 2000 + xFollowers / 5000;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function loadManualSpecs() {
  const text = fs.readFileSync(listPath, "utf8");
  const byName = new Map();
  for (const line of text.split(/\n/)) {
    const t = line.trim().replace(/\r$/, "");
    if (!t || t.startsWith("Scenario")) continue;
    const m = t.match(LINE_RE);
    if (!m) continue;
    const name = m[1].trim();
    const tier = m[2].toUpperCase();
    if (/^[SABCDEF]$/.test(tier)) byName.set(name, tier);
  }
  return byName;
}

/** Enforce M[best] >= M[next] ... along TIER_BEST_TO_WORST (higher score = better tier). */
function isotonicCapNonIncreasing(M) {
  const out = { ...M };
  for (let i = 1; i < TIER_BEST_TO_WORST.length; i++) {
    const prev = TIER_BEST_TO_WORST[i - 1];
    const cur = TIER_BEST_TO_WORST[i];
    if (out[cur] > out[prev]) out[cur] = out[prev];
  }
  return out;
}

/** Score s -> tier using cutpoints between consecutive tiers (best first). */
function tierFromScore(s, M) {
  const bounds = [];
  bounds.push(Number.POSITIVE_INFINITY);
  for (let i = 0; i < TIER_BEST_TO_WORST.length - 1; i++) {
    const a = TIER_BEST_TO_WORST[i];
    const b = TIER_BEST_TO_WORST[i + 1];
    bounds.push((M[a] + M[b]) / 2);
  }
  bounds.push(Number.NEGATIVE_INFINITY);
  for (let j = 0; j < TIER_BEST_TO_WORST.length; j++) {
    const hi = bounds[j];
    const lo = bounds[j + 1];
    if (s <= hi && s > lo) return TIER_BEST_TO_WORST[j];
  }
  return "F";
}

function main() {
  const manualByName = loadManualSpecs();
  const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  if (!Array.isArray(groups)) throw new Error("groups.json must be an array");

  const byName = new Map();
  for (const g of groups) {
    const n = String(g.name ?? "").trim();
    if (n) byName.set(n, g);
  }

  const scoresByTier = Object.fromEntries(TIER_BEST_TO_WORST.map((t) => [t, []]));
  let anchorHits = 0;
  let anchorMiss = 0;
  for (const [name, tier] of manualByName) {
    const g = byName.get(name);
    if (!g) {
      anchorMiss++;
      continue;
    }
    scoresByTier[tier].push(groupScore(g));
    anchorHits++;
  }

  let anchorScoreMax = 0;
  for (const name of manualByName.keys()) {
    const g = byName.get(name);
    if (g) anchorScoreMax = Math.max(anchorScoreMax, groupScore(g));
  }

  const M = {};
  for (const t of TIER_BEST_TO_WORST) {
    const m = median(scoresByTier[t]);
    M[t] = m != null ? m : DEFAULT_SCORE_ANCHOR[t];
  }
  /** Keep S above every curated anchor score so A/B medians are not collapsed into a low default S. */
  M.S = Math.max(M.S, anchorScoreMax + 1e-6);

  const Mfit = isotonicCapNonIncreasing(M);

  let manualSet = 0;
  let interp = 0;
  for (const g of groups) {
    const name = String(g.name ?? "").trim();
    const manual = manualByName.get(name);
    if (manual) {
      g.letter_tier = manual;
      manualSet++;
      continue;
    }
    g.letter_tier = tierFromScore(groupScore(g), Mfit);
    interp++;
  }

  fs.writeFileSync(groupsPath, JSON.stringify(groups, null, 2), "utf8");
  console.log(
    `Anchors: ${manualByName.size} names in doc, ${anchorHits} matched groups, ${anchorMiss} unmatched names.`,
  );
  console.log(`Calibrated score anchors (post-isotonic): ${JSON.stringify(Mfit)}`);
  console.log(`Wrote letter_tier: ${manualSet} manual, ${interp} interpolated → ${path.relative(root, groupsPath)}`);
}

main();
