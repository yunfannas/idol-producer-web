/**
 * Seed group `reputation` (1–5, fractional) onto main + scenario_6 groups.
 *
 * Model (same reasoning as curated Takane / =LOVE / ≠ME / ≒JOY / Akishibu anchors):
 *   base 3
 *   + tenure from ALL historical stints (current + past members), softened by churn
 *   + small clean-brand bonus when mid+ tenure and no past scandals
 *   − scandal dents (handling-aware; same family as runtime reputationModel)
 *
 * Curated overrides in `public/data/reference/group_reputation.json` always win
 * (manual anchors). Everyone else is interpolated.
 *
 * Run: node support/scripts/seedGroupReputation.mjs
 * Dry:  node support/scripts/seedGroupReputation.mjs --dry
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const dry = process.argv.includes("--dry");

const DEFAULT_REPUTATION = 3;
const SCENARIO6_OPENING = "2025-07-05";

/** Calibrated against curated anchors (SSE ≈ 0.12 on scenario_6 as-of opening). */
const KNOBS = {
  avgStintWeight: 0.4,
  groupAgeWeight: 0.02,
  ageCapYears: 8,
  churnWeight: 1.1,
  churnSoftStart: 0.2,
  tenureCap: 2.0,
  cleanBonus: 0.2,
  cleanMinAvgStintYears: 2.5,
};

const overridesPath = path.join(root, "public", "data", "reference", "group_reputation.json");
const overridesDoc = JSON.parse(readFileSync(overridesPath, "utf8"));
const byUid = new Map((overridesDoc.overrides || []).map((r) => [String(r.group_uid), r]));
const byName = new Map((overridesDoc.overrides || []).map((r) => [String(r.group_name), r]));

function clamp(n, lo, hi) {
  return Math.max(lo, Math.min(hi, n));
}

function iso(v) {
  return String(v ?? "").slice(0, 10);
}

function yearsBetween(a, b) {
  const A = Date.parse(`${a}T12:00:00Z`);
  const B = Date.parse(`${b}T12:00:00Z`);
  if (!Number.isFinite(A) || !Number.isFinite(B) || B < A) return 0;
  return (B - A) / (365.25 * 86400000);
}

function daysBetween(a, b) {
  return Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
}

function clampRep(n) {
  return Math.max(1, Math.min(5, Math.round((Number(n) || DEFAULT_REPUTATION) * 1000) / 1000));
}

/** Nearest 0.5 for interpolated starts (anchors keep exact curated floats). */
function roundHalf(n) {
  return Math.round(clampRep(n) * 2) / 2;
}

/**
 * Infer historical handling when status_history lacks `handling`.
 * Rapid exit after scandal ≈ firm terminate; 契約解除 text ≈ terminate; etc.
 */
function inferScandalAction(scandal, stintEndDate) {
  if (scandal.handling) {
    return {
      action: String(scandal.handling),
      indefiniteSuspend:
        typeof scandal.indefinite_suspend === "boolean" ? scandal.indefinite_suspend : null,
    };
  }
  const sum = String(scandal.summary_ja || scandal.summary || "");
  if (/契約解除|解雇|契約打ち切り|terminate/i.test(sum)) {
    return { action: "terminate_now", indefiniteSuspend: null };
  }
  if (/無期限/.test(sum) && /休止|活動/.test(sum)) {
    return { action: "suspend_activities", indefiniteSuspend: true };
  }
  if (/一時/.test(sum) && /休止|活動/.test(sum)) {
    return { action: "suspend_activities", indefiniteSuspend: false };
  }
  if (/活動休止|休養|休止/.test(sum)) {
    return { action: "suspend_activities", indefiniteSuspend: null };
  }
  if (/降格|リーダー解任|リーダーを解/.test(sum)) {
    return { action: "demote_leader", indefiniteSuspend: null };
  }
  const sd = iso(scandal.start_date);
  const end = iso(stintEndDate);
  if (sd && end && end >= sd && daysBetween(sd, end) <= 21) {
    return { action: "terminate_now", indefiniteSuspend: null };
  }
  return {
    action: Number(scandal.score) >= 4 ? "acknowledge" : "keep_with_penalty",
    indefiniteSuspend: null,
  };
}

/** Mirror of runtime reputationDeltaForScandalHandling (seed-side copy). */
function scandalReputationDelta(action, score, indefiniteSuspend) {
  const s = clamp((Number(score) || 1) / 5, 0.2, 1);
  if (action === "suspend_activities" && indefiniteSuspend === false) return -0.5;
  let delta = -(0.12 + 0.28 * s);
  if (action === "terminate_now" || action === "terminate_after_live") delta += 0.12;
  else if (action === "suspend_activities" || action === "demote_leader") delta += 0.05;
  else if (action === "keep_with_penalty") delta -= 0.15 + 0.1 * s;
  else if (action === "acknowledge") delta -= 0.1 + 0.08 * s;
  return clamp(delta, -0.6, -0.02);
}

function collectSignals(group, idols, asOf) {
  const uid = String(group.uid ?? "");
  const name = String(group.name ?? "");
  const formed = iso(group.formed_date || group.debut_date || group.formation_date);
  const groupAgeYears = formed && formed <= asOf ? yearsBetween(formed, asOf) : 0;

  let memberYears = 0;
  let stints = 0;
  let pastStints = 0;
  let activeStints = 0;
  const scandalRows = [];

  for (const idol of idols) {
    const history = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const h of history) {
      if (String(h.group_uid ?? "") !== uid && String(h.group_name ?? "") !== name) continue;
      const start = iso(h.start_date);
      if (!start || start > asOf) continue;
      const endRaw = iso(h.end_date);
      const end = !endRaw || endRaw > asOf ? asOf : endRaw;
      if (endRaw && endRaw <= asOf) pastStints += 1;
      else activeStints += 1;
      memberYears += yearsBetween(start, end);
      stints += 1;

      const statusHistory = Array.isArray(h.status_history) ? h.status_history : [];
      for (const s of statusHistory) {
        if (String(s.kind ?? "").toLowerCase() !== "scandal") continue;
        const d = iso(s.start_date);
        if (!d || d > asOf) continue;
        const inferred = inferScandalAction(s, endRaw);
        let delta = scandalReputationDelta(
          inferred.action,
          s.score,
          inferred.indefiniteSuspend,
        );
        // Minor soft scandals where the member stayed: smaller brand hit.
        if (
          (inferred.action === "keep_with_penalty" || inferred.action === "acknowledge") &&
          Number(s.score) <= 3.5
        ) {
          delta *= 0.45;
        }
        scandalRows.push({
          idol: String(idol.name ?? ""),
          date: d,
          score: Number(s.score) || null,
          action: inferred.action,
          delta: Math.round(delta * 1000) / 1000,
        });
      }
    }
  }

  // Mass firings share one announcement day — count as one brand incident
  // (max dent that day), not N × per-member dents.
  const byDay = new Map();
  for (const row of scandalRows) {
    const key = String(row.date || "").slice(0, 10);
    if (!key) continue;
    const prev = byDay.get(key);
    if (!prev || Math.abs(row.delta) > Math.abs(prev.delta)) byDay.set(key, row);
  }
  let scandalPenalty = 0;
  for (const row of byDay.values()) scandalPenalty += -row.delta;

  const avgStintYears = stints ? memberYears / stints : 0;
  const churn = pastStints + activeStints > 0 ? pastStints / (pastStints + activeStints) : 0;
  return {
    avgStintYears,
    groupAgeYears,
    pastStints,
    activeStints,
    stints,
    churn,
    scandalPenalty,
    scandalRows,
    scandalIncidents: byDay.size,
  };
}

function interpolateReputation(signals) {
  const p = KNOBS;
  let tenure =
    p.avgStintWeight * signals.avgStintYears +
    p.groupAgeWeight * Math.min(signals.groupAgeYears, p.ageCapYears);
  const churnMul = 1 - p.churnWeight * Math.max(0, signals.churn - p.churnSoftStart);
  tenure *= clamp(churnMul, 0.35, 1);
  tenure = clamp(tenure, 0, p.tenureCap);
  const clean =
    signals.scandalPenalty < 0.01 && signals.avgStintYears >= p.cleanMinAvgStintYears
      ? p.cleanBonus
      : 0;
  return clamp(DEFAULT_REPUTATION + tenure + clean - signals.scandalPenalty, 1, 5);
}

function seedFile(groupsPath, idolsPath, asOf, label) {
  const groups = JSON.parse(readFileSync(groupsPath, "utf8"));
  const idols = JSON.parse(readFileSync(idolsPath, "utf8"));
  if (!Array.isArray(groups) || !Array.isArray(idols)) {
    throw new Error(`Bad JSON arrays for ${label}`);
  }

  let overridden = 0;
  let interpolated = 0;
  const report = [];

  for (const g of groups) {
    const hit = byUid.get(String(g.uid ?? "")) || byName.get(String(g.name ?? ""));
    const signals = collectSignals(g, idols, asOf);
    const raw = interpolateReputation(signals);
    const interpolatedHalf = roundHalf(raw);
    let next;
    let source;
    if (hit) {
      next = clampRep(hit.reputation);
      source = "override";
      overridden += 1;
    } else {
      next = interpolatedHalf;
      source = "interpolated";
      interpolated += 1;
    }
    g.reputation = next;
    report.push({
      name: String(g.name ?? ""),
      uid: String(g.uid ?? ""),
      reputation: next,
      source,
      interpolated_raw: Math.round(raw * 1000) / 1000,
      avg_stint_years: Math.round(signals.avgStintYears * 100) / 100,
      group_age_years: Math.round(signals.groupAgeYears * 100) / 100,
      churn: Math.round(signals.churn * 100) / 100,
      past_stints: signals.pastStints,
      scandal_penalty: Math.round(signals.scandalPenalty * 1000) / 1000,
      scandal_count: signals.scandalRows.length,
      scandal_incidents: signals.scandalIncidents ?? 0,
    });
  }

  if (!dry) {
    writeFileSync(groupsPath, `${JSON.stringify(groups, null, 2)}\n`);
  }

  const dist = {};
  for (const row of report) {
    const key = String(row.reputation);
    dist[key] = (dist[key] || 0) + 1;
  }
  console.log(
    `${dry ? "[dry] " : ""}seeded ${label}: ${groups.length} groups ` +
      `(${overridden} overrides, ${interpolated} interpolated, as-of ${asOf})`,
  );
  console.log(`  reputation distribution: ${JSON.stringify(dist)}`);

  const reportPath = path.join(
    root,
    "support",
    "docs",
    "reference",
    label === "scenario_6"
      ? "scenario_6_group_reputation_interpolation.csv"
      : "main_group_reputation_interpolation.csv",
  );
  const headers = [
    "name",
    "uid",
    "reputation",
    "source",
    "interpolated_raw",
    "avg_stint_years",
    "group_age_years",
    "churn",
    "past_stints",
    "scandal_penalty",
    "scandal_count",
    "scandal_incidents",
  ];
  const csv = [
    headers.join(","),
    ...report.map((r) =>
      headers
        .map((h) => {
          const v = r[h];
          const s = v == null ? "" : String(v);
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    ),
  ].join("\n");
  if (!dry) writeFileSync(reportPath, `${csv}\n`);
  console.log(`  wrote ${path.relative(root, reportPath)}`);
}

// Update reference comment so the catalog documents the interpolation model.
overridesDoc._comment =
  "Group reputation (1-5, fractional allowed). Curated overrides are manual anchors. " +
  "All other groups are interpolated by support/scripts/seedGroupReputation.mjs from " +
  "historical tenure (current + past members, churn-softened) and pre-as-of scandals " +
  "(handling-aware dents; timed suspend-then-return = −0.5). Runtime then continues " +
  "to move reputation (tenure monthly up; scandals / unrecognized core exits / " +
  "post-suspension leave decisions down). Default base before interpolation is 3.";

if (!dry) {
  writeFileSync(overridesPath, `${JSON.stringify(overridesDoc, null, 2)}\n`);
}

seedFile(
  path.join(root, "public", "data", "scenarios", "scenario_6", "groups.json"),
  path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json"),
  SCENARIO6_OPENING,
  "scenario_6",
);

seedFile(
  path.join(root, "public", "data", "groups.json"),
  path.join(root, "public", "data", "idols.json"),
  new Date().toISOString().slice(0, 10),
  "main",
);
