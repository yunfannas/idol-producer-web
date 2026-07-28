#!/usr/bin/env node
/**
 * Export Scenario 6 group-tier interpolation sources to CSV.
 *
 * Outputs:
 *   support/docs/reference/scenario_6_group_tier_source_catalog.csv
 *   support/docs/reference/scenario_6_group_tier_interpolation_sources.csv
 *
 * Usage: node support/scripts/exportScenario6TierInterpolationSources.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const groups = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/scenarios/scenario_6/groups.json"), "utf8"),
);
const tiers = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/scenarios/scenario_6/group_tiers.json"), "utf8"),
);
const rankings = JSON.parse(
  fs.readFileSync(path.join(root, "public/data/reference/idol_group_rankings_2025_mapped.json"), "utf8"),
);
const listText = fs.readFileSync(path.join(root, "support/docs/scenario6_available_groups.txt"), "utf8");

const LINE_RE = /^\d+\.\s*(.+?)\s*\|\s*tier\s*=\s*([SABCDEFsabcdef])\s*\|\s*members\s*=\s*\d+\s*$/;
const TIER_BEST_TO_WORST = ["S", "A", "B", "C", "D", "E", "F"];
const DEFAULT_SCORE_ANCHOR = { S: 95, A: 77, B: 62, C: 48, D: 33, E: 18, F: 4 };
const ORD = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, I: 7 };

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  }
  // UTF-8 BOM so Excel (JP Windows) does not mojibake Japanese names
  fs.writeFileSync(filePath, `\ufeff${lines.join("\n")}\n`, "utf8");
}

const manualByName = new Map();
for (const line of listText.split(/\n/)) {
  const t = line.trim().replace(/\r$/, "");
  if (!t || t.startsWith("Scenario")) continue;
  const m = t.match(LINE_RE);
  if (!m) continue;
  manualByName.set(m[1].trim(), m[2].toUpperCase());
}

const authByUid = new Map();
const authByName = new Map();
for (const block of rankings.rankings || []) {
  for (const g of block.groups || []) {
    const row = {
      authoritative_rank: g.rank,
      authoritative_position: g.position,
      authoritative_source_name: g.source_name,
      authoritative_match_method: g.match_method,
    };
    if (g.group_uid) authByUid.set(String(g.group_uid), row);
    if (g.group_name) authByName.set(String(g.group_name), row);
  }
}

const tierByUid = new Map(tiers.map((t) => [String(t.uid), t]));

function groupScore(g) {
  const popularity = Number(g.popularity ?? 0) || 0;
  const fans = Number(g.fans ?? 0) || 0;
  const xFollowers = Number(g.x_followers ?? 0) || 0;
  return popularity + fans / 2000 + xFollowers / 5000;
}

function policyScore(g) {
  const popularity = Number(g.popularity ?? 0) || 0;
  let fans = Number(g.fans ?? 0) || 0;
  if (!fans) fans = Math.max(500, popularity * 500);
  return fans + popularity * 2000;
}

function inferLetterTier(score) {
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  if (score >= 25) return "D";
  if (score >= 12) return "E";
  return "F";
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function isotonicCapNonIncreasing(M) {
  const out = { ...M };
  for (let i = 1; i < TIER_BEST_TO_WORST.length; i++) {
    const prev = TIER_BEST_TO_WORST[i - 1];
    const cur = TIER_BEST_TO_WORST[i];
    if (out[cur] > out[prev]) out[cur] = out[prev];
  }
  return out;
}

function tierFromScore(s, M) {
  const bounds = [Number.POSITIVE_INFINITY];
  for (let i = 0; i < TIER_BEST_TO_WORST.length - 1; i++) {
    bounds.push((M[TIER_BEST_TO_WORST[i]] + M[TIER_BEST_TO_WORST[i + 1]]) / 2);
  }
  bounds.push(Number.NEGATIVE_INFINITY);
  for (let j = 0; j < TIER_BEST_TO_WORST.length; j++) {
    if (s <= bounds[j] && s > bounds[j + 1]) return TIER_BEST_TO_WORST[j];
  }
  return "F";
}

const byName = new Map(groups.map((g) => [String(g.name ?? "").trim(), g]));
const scoresByTier = Object.fromEntries(TIER_BEST_TO_WORST.map((t) => [t, []]));
let anchorScoreMax = 0;
for (const [name, tier] of manualByName) {
  const g = byName.get(name);
  if (!g) continue;
  const sc = groupScore(g);
  scoresByTier[tier].push(sc);
  anchorScoreMax = Math.max(anchorScoreMax, sc);
}
const M = {};
for (const t of TIER_BEST_TO_WORST) {
  const m = median(scoresByTier[t]);
  M[t] = m != null ? m : DEFAULT_SCORE_ANCHOR[t];
}
M.S = Math.max(M.S, anchorScoreMax + 1e-6);
const Mfit = isotonicCapNonIncreasing(M);

const detailHeaders = [
  "group_uid",
  "group_name",
  "group_name_romanji",
  "current_letter_tier",
  "group_tiers_letter_tier",
  "tier_assignment_mode",
  "manual_doc_tier",
  "manual_doc_source",
  "authoritative_rank",
  "authoritative_position",
  "authoritative_source_name",
  "authoritative_match_method",
  "authoritative_source_file",
  "fans",
  "popularity",
  "x_followers",
  "interp_score_finance",
  "interp_score_policy",
  "tier_if_finance_inferLetterTier",
  "tier_if_reinterpolate_script",
  "tier_if_policy_authoritative_else_max_D",
  "notes",
];

const detailRows = [];
for (const g of groups) {
  const uid = String(g.uid ?? "").trim();
  const name = String(g.name ?? "").trim();
  const romanji = String(g.name_romanji ?? "").trim();
  const current = String(g.letter_tier ?? "")
    .trim()
    .toUpperCase();
  const tr = tierByUid.get(uid);
  const fans = Number(g.fans ?? 0) || 0;
  const popularity = Number(g.popularity ?? 0) || 0;
  const xFollowers = Number(g.x_followers ?? 0) || 0;
  const financeScore = groupScore(g);
  const polScore = policyScore(g);
  const manual = manualByName.get(name) || "";
  const auth = authByUid.get(uid) || authByName.get(name) || null;
  const financeInfer = inferLetterTier(financeScore);
  const reinterp = manual || tierFromScore(financeScore, Mfit);
  let policyTier = "";
  if (auth) policyTier = auth.authoritative_rank;
  else {
    const t = inferLetterTier(financeScore);
    policyTier = ["S", "A", "B", "C"].includes(t) ? "D" : t;
  }

  let mode = "interpolated_score";
  if (current === "I") mode = "inactive_at_opening";
  else if (manual) mode = "manual_available_groups_doc";
  else if (auth && current === auth.authoritative_rank) mode = "authoritative_ranking_2025";
  else if (auth && current !== auth.authoritative_rank) mode = "mismatch_vs_authoritative";
  else if (["D", "E", "F"].includes(current)) mode = "inferred_spotify_fans";
  else if (current && current === financeInfer) mode = "finance_inferLetterTier";
  else if (current) mode = "stored_other_or_stale";

  const notes = [];
  if (current === "I") notes.push("inactive_at_opening_no_tier_eval");
  if (manual && auth && manual !== auth.authoritative_rank) notes.push("manual_doc_differs_from_authoritative");
  if (auth && current && current !== "I" && current !== auth.authoritative_rank) notes.push("current_differs_from_authoritative");
  if (manual && current && current !== "I" && current !== manual) notes.push("current_differs_from_manual_doc");
  if (!fans && !popularity) notes.push("missing_fans_and_popularity");
  if (g.notes) notes.push(String(g.notes).replace(/\s+/g, " ").slice(0, 120));

  detailRows.push({
    group_uid: uid,
    group_name: name,
    group_name_romanji: romanji,
    current_letter_tier: current,
    group_tiers_letter_tier: tr ? String(tr.letter_tier ?? "").toUpperCase() : "",
    tier_assignment_mode: mode,
    manual_doc_tier: manual,
    manual_doc_source: manual ? "support/docs/scenario6_available_groups.txt" : "",
    authoritative_rank: auth?.authoritative_rank || "",
    authoritative_position: auth?.authoritative_position ?? "",
    authoritative_source_name: auth?.authoritative_source_name || "",
    authoritative_match_method: auth?.authoritative_match_method || "",
    authoritative_source_file: auth ? "public/data/reference/idol_group_rankings_2025_mapped.json" : "",
    fans: fans || "",
    popularity: popularity || "",
    x_followers: xFollowers || "",
    interp_score_finance: Number(financeScore.toFixed(4)),
    interp_score_policy: Number(polScore.toFixed(4)),
    tier_if_finance_inferLetterTier: financeInfer,
    tier_if_reinterpolate_script: reinterp,
    tier_if_policy_authoritative_else_max_D: policyTier,
    notes: notes.join("; "),
  });
}

detailRows.sort((a, b) => {
  const da = ORD[a.current_letter_tier] ?? 9;
  const db = ORD[b.current_letter_tier] ?? 9;
  if (da !== db) return da - db;
  return (Number(b.fans) || 0) - (Number(a.fans) || 0) || a.group_name.localeCompare(b.group_name, "ja");
});

const catalogRows = [
  {
    source_id: "manual_available_groups",
    path: "support/docs/scenario6_available_groups.txt",
    role: "Manual letter_tier anchors for curated/playable groups (reinterpolate + backfill scripts)",
    used_for_tiers: "S-F as written in doc",
    group_count: manualByName.size,
  },
  {
    source_id: "authoritative_ranking_2025",
    path: "public/data/reference/idol_group_rankings_2025_mapped.json",
    role: "Authoritative Idol Ranking 2025; policy says S-C (and listed D) must come from here, not score interpolation",
    used_for_tiers: "S,A,B,C,(listed D)",
    group_count: authByUid.size,
  },
  {
    source_id: "group_tier_policy",
    path: "public/data/group_tier_policy.json",
    role: "Policy gate: S-C authoritative-only; inferred groups capped at D/E/F; inactive→I; score uses x_followers+popularity*2000",
    used_for_tiers: "policy gate + I",
    group_count: "",
  },
  {
    source_id: "scenario_groups_metrics",
    path: "public/data/scenarios/scenario_6/groups.json",
    role: "fans / popularity / x_followers / stored letter_tier (incl. I inactive) used as inputs and current assigned tier",
    used_for_tiers: "inputs + current_letter_tier",
    group_count: groups.length,
  },
  {
    source_id: "reeval_x_followers",
    path: "support/scripts/reevaluateScenario6TiersWithX.mjs",
    role: "Current assignment: inactive→I; auth S–C/listed D; manual list; else infer D/E/F from x_followers+popularity*2000",
    used_for_tiers: "S-F + I",
    group_count: groups.filter((g) => String(g.letter_tier ?? "").toUpperCase() === "I").length + " inactive I",
  },
  {
    source_id: "group_tiers_static",
    path: "public/data/scenarios/scenario_6/group_tiers.json",
    role: "Static sort/startup tier slice built from groups.json letter_tier",
    used_for_tiers: "startup/browse sort_key",
    group_count: tiers.length,
  },
  {
    source_id: "reinterpolate_script",
    path: "support/scripts/reinterpolate-scenario6-tiers.mjs",
    role: "Calibrates score medians from manual anchors then assigns interpolated tiers to non-manual groups",
    used_for_tiers: "interpolated S-F via score cutpoints",
    group_count: "",
  },
  {
    source_id: "finance_inferLetterTier",
    path: "src/engine/financeSystem.ts / support/scripts/build-scenario6-group-tiers.mjs",
    role: "Legacy fixed cutpoints: score=popularity+fans/2000+x_followers/5000",
    used_for_tiers: "fallback when letter_tier missing",
    group_count: "",
  },
];

const catalogPath = path.join(root, "support/docs/reference/scenario_6_group_tier_source_catalog.csv");
const detailPath = path.join(root, "support/docs/reference/scenario_6_group_tier_interpolation_sources.csv");

try {
  writeCsv(catalogPath, ["source_id", "path", "role", "used_for_tiers", "group_count"], catalogRows);
  writeCsv(detailPath, detailHeaders, detailRows);
} catch (err) {
  if (err && (err.code === "EBUSY" || err.code === "EPERM")) {
    const alt = detailPath.replace(/\.csv$/, `_updated.csv`);
    writeCsv(catalogPath.replace(/\.csv$/, `_updated.csv`), ["source_id", "path", "role", "used_for_tiers", "group_count"], catalogRows);
    writeCsv(alt, detailHeaders, detailRows);
    console.warn(`Primary CSV locked; wrote alternate: ${path.relative(root, alt)}`);
  } else {
    throw err;
  }
}

const mismatches = detailRows.filter(
  (r) =>
    r.authoritative_rank &&
    r.current_letter_tier &&
    r.current_letter_tier !== "I" &&
    r.authoritative_rank !== r.current_letter_tier,
);

const tierCounts = {};
for (const r of detailRows) {
  const t = r.current_letter_tier || "?";
  tierCounts[t] = (tierCounts[t] || 0) + 1;
}

console.log(
  JSON.stringify(
    {
      catalogPath: path.relative(root, catalogPath).replace(/\\/g, "/"),
      detailPath: path.relative(root, detailPath).replace(/\\/g, "/"),
      groups: detailRows.length,
      current_tier_counts: tierCounts,
      inactive_I: tierCounts.I || 0,
      manual_anchors: manualByName.size,
      authoritative_mapped: authByUid.size,
      current_vs_authoritative_mismatches: mismatches.length,
      calibrated_score_anchors: Mfit,
      mismatch_sample: mismatches.slice(0, 12).map((r) => ({
        name: r.group_name,
        current: r.current_letter_tier,
        auth: r.authoritative_rank,
        fans: r.fans,
      })),
    },
    null,
    2,
  ),
);
