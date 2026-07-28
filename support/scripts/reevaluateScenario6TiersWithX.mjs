#!/usr/bin/env node
/**
 * Re-evaluate scenario 6 group letter tiers using:
 * 0) Inactive at opening → letter_tier "I" (no score eval)
 * 1) Authoritative Idol Ranking 2025 (S–C and listed D) — never score-promoted
 * 2) Manual anchors from support/docs/scenario6_available_groups.txt (when not in auth file)
 * 3) Inference for everyone else into D/E/F only, via:
 *      signal = Spotify fans (`fans` from idolsdiagram; impute max(500, popularity*500) if missing)
 *      d_floor = min fans among curated "bottom of D" anchors
 *          (群青の世界, ドラマチックレコード) — any inferred group below → E/F
 *      e_floor = 0.15 * d_floor
 *      `x_followers` is separate (member X sum) and is not used for the D cut.
 *
 * Inactive = ended/disbanded before opening, formed after opening, or no active members at opening.
 *
 * Also writes:
 *   support/docs/reference/scenario_6_tier_reeval_x_anchors.csv
 *   support/docs/reference/scenario_6_tier_reeval_changes.csv
 *
 * Then rebuilds group_tiers.json.
 *
 * Usage:
 *   node support/scripts/reevaluateScenario6TiersWithX.mjs
 *   node support/scripts/reevaluateScenario6TiersWithX.mjs --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dryRun = process.argv.includes("--dry-run");

const groupsPath = path.join(root, "public/data/scenarios/scenario_6/groups.json");
const idolsPath = path.join(root, "public/data/scenarios/scenario_6/idols.json");
const presetPath = path.join(root, "public/data/scenarios/presets/scenario6.json");
const rankingsPath = path.join(root, "public/data/reference/idol_group_rankings_2025_mapped.json");
const listPath = path.join(root, "support/docs/scenario6_available_groups.txt");
const anchorsOut = path.join(root, "support/docs/reference/scenario_6_tier_reeval_x_anchors.csv");
const changesOut = path.join(root, "support/docs/reference/scenario_6_tier_reeval_changes.csv");

const LINE_RE = /^\d+\.\s*(.+?)\s*\|\s*tier\s*=\s*([SABCDEFsabcdef])\s*\|\s*members\s*=\s*\d+\s*$/;
const ORD = { S: 0, A: 1, B: 2, C: 3, D: 4, E: 5, F: 6, I: 7 };
/** Curated bottom-of-D Spotify-fans anchors: inferred D requires fans >= min of these. */
const BOTTOM_D_ANCHOR_NAMES = ["群青の世界", "ドラマチックレコード"];
const E_FLOOR_FRACTION = 0.15;

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeJson(p, value) {
  fs.writeFileSync(p, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function csvEscape(v) {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function writeCsv(filePath, headers, rows) {
  const lines = [headers.join(",")];
  for (const row of rows) lines.push(headers.map((h) => csvEscape(row[h])).join(","));
  fs.writeFileSync(filePath, `\ufeff${lines.join("\n")}\n`, "utf8");
}

function num(v) {
  return typeof v === "number" && Number.isFinite(v) ? v : Number(v ?? 0) || 0;
}

/** Spotify fans used for D/E/F floors (impute if missing). */
function effectiveFans(g) {
  let fans = num(g.fans);
  if (!fans) {
    const popularity = num(g.popularity);
    fans = Math.max(500, popularity * 500);
  }
  return fans;
}

/** Member-sum X followers (diagnostic / finance; not the D cut). */
function effectiveX(g) {
  return num(g.x_followers);
}

/** Diagnostic composite. */
function effectiveScore(g) {
  return effectiveFans(g) + num(g.popularity) * 2000;
}

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

function pct(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const i = Math.min(s.length - 1, Math.max(0, Math.floor((s.length - 1) * p)));
  return s[i];
}

const groups = readJson(groupsPath);
const idols = readJson(idolsPath);
const preset = readJson(presetPath);
const openingDate = String(preset.opening_date ?? "2025-07-05").slice(0, 10);
const rankings = readJson(rankingsPath);
const listText = fs.readFileSync(listPath, "utf8");

function isoDay(value) {
  return typeof value === "string" && value ? value.slice(0, 10) : "";
}

function historyActiveOnOpening(history) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (!start) return false;
  if (start > openingDate) return false;
  if (end && end < openingDate) return false;
  return true;
}

function historyMatchesGroup(history, group) {
  if (typeof history.group_uid === "string" && history.group_uid && history.group_uid === group.uid) return true;
  const name = typeof history.group_name === "string" ? history.group_name.trim() : "";
  return Boolean(name) && (name === group.name || name === group.name_romanji);
}

function activeMemberCountAtOpening(group) {
  let n = 0;
  for (const idol of idols) {
    const histories = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const history of histories) {
      if (!historyMatchesGroup(history, group)) continue;
      if (historyActiveOnOpening(history)) {
        n += 1;
        break;
      }
    }
  }
  return n;
}

/** Inactive at opening: disbanded/ended before opening, formed after opening, or no active members. */
function inactiveReason(group) {
  const end = isoDay(group.ended_date ?? group.disband_date);
  if (end && end < openingDate) return "ended_before_opening";
  const formed = isoDay(group.formed_date);
  if (formed && formed > openingDate) return "formed_after_opening";
  if (activeMemberCountAtOpening(group) <= 0) return "no_active_members_at_opening";
  return "";
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
const authRows = [];
for (const block of rankings.rankings || []) {
  for (const row of block.groups || []) {
    const rec = {
      rank: String(row.rank || "").toUpperCase(),
      position: row.position,
      source_name: row.source_name,
      group_uid: row.group_uid ? String(row.group_uid) : "",
      group_name: row.group_name ? String(row.group_name) : "",
    };
    if (rec.group_uid) authByUid.set(rec.group_uid, rec);
    if (rec.group_name) authByName.set(rec.group_name, rec);
    authRows.push(rec);
  }
}

const byUid = new Map(groups.map((g) => [String(g.uid), g]));
const byName = new Map(groups.map((g) => [String(g.name), g]));

// --- X anchors from authoritative groups ---
const anchorRows = [];
for (const tier of ["S", "A", "B", "C", "D"]) {
  const matched = authRows
    .filter((r) => r.rank === tier)
    .map((r) => {
      const g = (r.group_uid && byUid.get(r.group_uid)) || (r.group_name && byName.get(r.group_name));
      return g
        ? {
            tier,
            name: g.name,
            uid: g.uid,
            x_followers: num(g.x_followers),
            fans: num(g.fans),
            popularity: num(g.popularity),
            score: effectiveScore(g),
            position: r.position,
            source_name: r.source_name,
          }
        : null;
    })
    .filter(Boolean);

  const xs = matched.map((m) => m.x_followers).filter((n) => n > 0);
  const scores = matched.map((m) => m.score);
  anchorRows.push({
    tier,
    auth_count: matched.length,
    with_x: xs.length,
    x_min: xs.length ? Math.min(...xs) : "",
    x_p25: pct(xs, 0.25) ?? "",
    x_median: median(xs) ?? "",
    x_p75: pct(xs, 0.75) ?? "",
    x_max: xs.length ? Math.max(...xs) : "",
    score_min: scores.length ? Math.min(...scores) : "",
    score_median: median(scores) ?? "",
    score_max: scores.length ? Math.max(...scores) : "",
    example_names: matched
      .slice()
      .sort((a, b) => b.x_followers - a.x_followers)
      .slice(0, 5)
      .map((m) => `${m.name}:${m.x_followers}`)
      .join(" | "),
  });
}

const bottomDAnchors = [];
for (const name of BOTTOM_D_ANCHOR_NAMES) {
  const g = byName.get(name);
  if (!g) throw new Error(`Bottom-D anchor missing from scenario_6 groups: ${name}`);
  if (inactiveReason(g)) throw new Error(`Bottom-D anchor is inactive at opening: ${name}`);
  bottomDAnchors.push({ name, fans: effectiveFans(g), x_followers: effectiveX(g) });
}
const dFloor = Math.min(...bottomDAnchors.map((a) => a.fans));
const eFloor = Math.round(dFloor * E_FLOOR_FRACTION);

function assignTier(g) {
  const inactive = inactiveReason(g);
  if (inactive) {
    return { tier: "I", mode: `inactive:${inactive}`, score: effectiveFans(g) };
  }
  const auth = authByUid.get(String(g.uid)) || authByName.get(String(g.name));
  if (auth) {
    return { tier: auth.rank, mode: "authoritative_ranking_2025", score: effectiveFans(g) };
  }
  const fans = effectiveFans(g);
  // Manual list wins even below d_floor (e.g. UtaGe! curated as D).
  const manual = manualByName.get(String(g.name));
  if (manual) {
    return { tier: manual, mode: "manual_available_groups_doc", score: fans };
  }
  let tier = "F";
  if (fans >= dFloor) tier = "D";
  else if (fans >= eFloor) tier = "E";
  return { tier, mode: "inferred_spotify_fans", score: fans };
}

const changes = [];
const counts = { S: 0, A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, I: 0 };
let inactiveSkipped = 0;
for (const g of groups) {
  const before = String(g.letter_tier ?? "")
    .trim()
    .toUpperCase();
  const { tier, mode, score } = assignTier(g);
  counts[tier] += 1;
  if (tier === "I") inactiveSkipped += 1;
  if (before !== tier) {
    changes.push({
      group_uid: g.uid,
      group_name: g.name,
      from_tier: before,
      to_tier: tier,
      direction:
        tier === "I"
          ? "inactive"
          : (ORD[tier] ?? 9) < (ORD[before] ?? 9)
            ? "upgrade"
            : "downgrade",
      assignment_mode: mode,
      fans_spotify: num(g.fans) || "",
      x_followers: num(g.x_followers) || "",
      popularity: num(g.popularity) || "",
      effective_score: Math.round(score),
      d_floor: dFloor,
      e_floor: eFloor,
    });
  }
  if (!dryRun) g.letter_tier = tier;
}

writeCsv(
  anchorsOut,
  [
    "tier",
    "auth_count",
    "with_x",
    "x_min",
    "x_p25",
    "x_median",
    "x_p75",
    "x_max",
    "score_min",
    "score_median",
    "score_max",
    "example_names",
  ],
  anchorRows,
);

changes.sort((a, b) => (ORD[a.to_tier] ?? 9) - (ORD[b.to_tier] ?? 9) || String(a.group_name).localeCompare(String(b.group_name), "ja"));
writeCsv(
  changesOut,
  [
    "group_uid",
    "group_name",
    "from_tier",
    "to_tier",
    "direction",
    "assignment_mode",
    "fans_spotify",
    "x_followers",
    "popularity",
    "effective_score",
    "d_floor",
    "e_floor",
  ],
  changes,
);

if (!dryRun) {
  writeJson(groupsPath, groups);
  const build = spawnSync(process.execPath, [path.join(root, "support/scripts/build-scenario6-group-tiers.mjs")], {
    cwd: root,
    encoding: "utf8",
  });
  if (build.status !== 0) {
    console.error(build.stdout || "");
    console.error(build.stderr || "");
    throw new Error("build-scenario6-group-tiers.mjs failed");
  }
}

console.log(
  JSON.stringify(
    {
      dry_run: dryRun,
      opening_date: openingDate,
      score_formula: "inferred D/E/F from Spotify fans (groups.fans); x_followers is member-sum and separate",
      d_floor: dFloor,
      e_floor: eFloor,
      e_floor_fraction_of_d_floor: E_FLOOR_FRACTION,
      bottom_d_anchors: bottomDAnchors,
      inactive_tier: "I",
      inactive_count: inactiveSkipped,
      new_tier_counts: counts,
      changes: changes.length,
      upgrades: changes.filter((c) => c.direction === "upgrade").length,
      downgrades: changes.filter((c) => c.direction === "downgrade").length,
      marked_inactive: changes.filter((c) => c.direction === "inactive").length,
      anchors_csv: path.relative(root, anchorsOut).replace(/\\/g, "/"),
      changes_csv: path.relative(root, changesOut).replace(/\\/g, "/"),
      notable: changes.filter((c) =>
        [
          "ファントムシータ",
          "AKB48",
          "日向坂46",
          "櫻坂46",
          "きゅるりんってしてみて",
          "BLK LiLiY",
          "でんぱ組.inc",
          "DIAVEL",
          "KRD8",
          "HIBANA",
          "群青の世界",
          "ドラマチックレコード",
        ].includes(c.group_name),
      ),
      x_anchor_medians: Object.fromEntries(anchorRows.map((r) => [r.tier, r.x_median])),
    },
    null,
    2,
  ),
);
