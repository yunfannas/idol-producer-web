import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const ROLE_KEYS = [
  "leader",
  "center",
  "lead_singer",
  "lead_dancer",
  "host",
  "content",
  "streaming",
  "style",
  "call_leader",
];
const AGE_FEATURE_KEYS = ["age_youth", "age_experience", "age_senior"];
const FEATURE_KEYS = [...ROLE_KEYS, ...AGE_FEATURE_KEYS];

const ROLE_ALIASES = {
  performance_center: "center",
  content_lead: "content",
  youtuber: "content",
  youtube: "content",
  sns: "content",
  sns_lead: "content",
  social_media: "content",
  snser: "content",
  x: "content",
  twitter: "content",
  instagram: "content",
  tiktok: "content",
  livestream: "streaming",
  streamer: "streaming",
  showroom: "streaming",
  tiktok_live: "streaming",
  instagram_live: "streaming",
  youtube_live: "streaming",
  style_lead: "style",
  hype: "call_leader",
  hype_lead: "call_leader",
};

const ROLE_ATTRIBUTE_PRIOR = {
  leader: {
    "mental.determination": 0.7,
    "mental.teamwork": 0.9,
    "mental.talking": 0.35,
  },
  center: {
    "appearance.cute": 0.75,
    "appearance.pretty": 0.75,
    "technical.grace": 0.35,
    "technical.rhythm": 0.25,
    "mental.talking": 0.25,
  },
  lead_singer: {
    "technical.pitch": 0.9,
    "technical.tone": 0.9,
    "technical.breath": 0.8,
    "technical.power": 0.55,
    "technical.rhythm": 0.2,
    "mental.determination": 0.35,
  },
  lead_dancer: {
    "physical.agility": 0.75,
    "physical.stamina": 0.55,
    "physical.natural_fitness": 0.45,
    "technical.rhythm": 0.95,
    "technical.grace": 0.8,
    "technical.power": 0.45,
    "mental.determination": 0.25,
  },
  host: {
    "mental.talking": 0.95,
    "mental.humor": 0.6,
    "mental.clever": 0.55,
    "mental.teamwork": 0.25,
  },
  content: {
    "appearance.cute": 0.2,
    "appearance.pretty": 0.2,
    "mental.talking": 0.8,
    "mental.humor": 0.7,
    "mental.clever": 0.45,
    "mental.fashion": 0.2,
  },
  streaming: {
    "mental.talking": 0.85,
    "mental.humor": 0.45,
    "mental.clever": 0.35,
    "mental.teamwork": 0.25,
  },
  style: {
    "appearance.cute": 0.8,
    "appearance.pretty": 0.8,
    "mental.fashion": 0.95,
    "mental.talking": 0.25,
  },
  call_leader: {
    "physical.stamina": 0.25,
    "technical.power": 0.4,
    "technical.rhythm": 0.25,
    "mental.talking": 0.85,
    "mental.humor": 0.35,
    "mental.determination": 0.5,
  },
  age_youth: {
    "appearance.cute": 0.25,
    "physical.agility": 0.15,
    "mental.teamwork": 0.1,
  },
  age_experience: {
    "technical.breath": 0.2,
    "technical.grace": 0.2,
    "mental.clever": 0.25,
    "mental.talking": 0.2,
    "mental.determination": 0.2,
    "mental.teamwork": 0.25,
  },
  age_senior: {
    "mental.clever": 0.3,
    "mental.talking": 0.25,
    "mental.determination": 0.25,
    "mental.teamwork": 0.35,
    "appearance.cute": -0.15,
    "physical.agility": -0.1,
  },
};

const STAT_PATHS = [
  ["physical", "strength"],
  ["physical", "agility"],
  ["physical", "natural_fitness"],
  ["physical", "stamina"],
  ["appearance", "cute"],
  ["appearance", "pretty"],
  ["technical", "pitch"],
  ["technical", "tone"],
  ["technical", "breath"],
  ["technical", "rhythm"],
  ["technical", "power"],
  ["technical", "grace"],
  ["mental", "clever"],
  ["mental", "humor"],
  ["mental", "talking"],
  ["mental", "determination"],
  ["mental", "teamwork"],
  ["mental", "fashion"],
  ["hidden", "professionalism"],
  ["hidden", "injury_proneness"],
  ["hidden", "ambition"],
  ["hidden", "loyalty"],
];

const VISIBLE_STAT_PATHS = STAT_PATHS.filter(([category]) => category !== "hidden");

function argValue(name, fallback = "") {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? String(process.argv[idx + 1] ?? fallback) : fallback;
}

const scenario = argValue("--scenario", "scenario_6");
const groupName = argValue("--group", "=LOVE");
const groupNames = argValue("--groups", "");
const ridgeLambda = Number(argValue("--lambda", "6"));
const priorScalar = Number(argValue("--prior-scalar", "3"));
const outputTagRaw = argValue("--output-tag", "");
const outputTag = outputTagRaw
  .trim()
  .replace(/[<>:"/\\|?*\x00-\x1F]/g, "_")
  .replace(/\s+/g, "_");

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

function writeJson(relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2) + "\n", "utf8");
}

function writeText(relativePath, value) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function csvCell(value) {
  const text = value == null ? "" : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function writeCsv(relativePath, rows) {
  const filePath = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  if (!rows.length) {
    fs.writeFileSync(filePath, "", "utf8");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines = [headers.map(csvCell).join(",")];
  for (const row of rows) lines.push(headers.map((header) => csvCell(row[header])).join(","));
  fs.writeFileSync(filePath, "\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");
}

function num(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function clampStat(value) {
  return Math.max(0, Math.min(20, Math.round(value)));
}

function clampAttrs(attrs) {
  const out = {};
  for (const [category, stat] of STAT_PATHS) {
    if (!out[category]) out[category] = {};
    out[category][stat] = clampStat(attrs[category]?.[stat] ?? 12);
  }
  return out;
}

function statKey(category, stat) {
  return `${category}.${stat}`;
}

function getStat(attrs, key) {
  const [category, stat] = key.split(".");
  const value = attrs?.[category]?.[stat];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function setStat(attrs, key, value) {
  const [category, stat] = key.split(".");
  if (!attrs[category]) attrs[category] = {};
  attrs[category][stat] = value;
}

function stableRoll(uid, label, low, high) {
  const digest = crypto.createHash("sha256").update(`${uid}:${label}`, "utf8").digest();
  const raw = digest.readUInt32BE(0);
  const span = high - low + 1;
  return low + (raw % span);
}

function numericMax(record, keys) {
  let max = 0;
  for (const key of keys) {
    const value = num(record[key], 0);
    if (value > max) max = value;
  }
  return max;
}

function popularitySignal(value, floor = 1000, ceiling = 1_000_000) {
  if (value <= 0) return 0;
  const low = Math.log10(floor);
  const high = Math.log10(ceiling);
  return Math.max(0, Math.min(1, (Math.log10(Math.max(value, 1)) - low) / (high - low)));
}

function parseIsoDay(value) {
  if (typeof value !== "string") return null;
  const day = value.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
}

function membershipActiveAt(entry, referenceIso) {
  const start = parseIsoDay(entry.start_date);
  if (!start || start > referenceIso) return false;
  const end = parseIsoDay(entry.end_date);
  return !end || referenceIso < end;
}

function buildGroupPopularityIndex(groups) {
  const index = new Map();
  for (const group of groups) {
    const followers = numericMax(group, ["x_followers", "x_followers_count", "fans", "fan_count"]);
    const followerSignal = popularitySignal(followers);
    const popSignal = Math.max(0, Math.min(1, numericMax(group, ["popularity"]) / 100));
    const signal = Math.max(followerSignal, popSignal);
    for (const key of [group.uid, group.name]) {
      const normalized = String(key ?? "").trim();
      if (normalized) index.set(normalized, Math.max(index.get(normalized) ?? 0, signal));
    }
  }
  return index;
}

function currentGroupSignal(idol, referenceIso, groupPopularity) {
  let best = 0;
  for (const entry of Array.isArray(idol.group_history) ? idol.group_history : []) {
    if (!entry || typeof entry !== "object" || !membershipActiveAt(entry, referenceIso)) continue;
    for (const key of [entry.group_uid, entry.group_name]) {
      const signal = groupPopularity.get(String(key ?? "").trim());
      if (signal != null && signal > best) best = signal;
    }
  }
  return best;
}

function scandalHistoryCount(idol) {
  let count = 0;
  for (const raw of Array.isArray(idol.status_history) ? idol.status_history : []) {
    if (String(raw?.kind ?? "").trim().toLowerCase() === "scandal") count += 1;
  }
  for (const entry of Array.isArray(idol.group_history) ? idol.group_history : []) {
    for (const raw of Array.isArray(entry?.status_history) ? entry.status_history : []) {
      if (String(raw?.kind ?? "").trim().toLowerCase() === "scandal") count += 1;
    }
  }
  return count;
}

function baselineAttributes(idol, groupPopularity, referenceIso) {
  const uid = String(idol.uid ?? "unknown");
  const idolSignal = popularitySignal(numericMax(idol, ["x_followers", "x_followers_count"]));
  const groupSignal = currentGroupSignal(idol, referenceIso, groupPopularity);
  const combined = Math.max(0, Math.min(1, idolSignal * 0.65 + groupSignal * 0.35));
  const base = 7 + Math.round(combined * 12);
  const scandalCount = scandalHistoryCount(idol);
  const portraitBonus = typeof idol.portrait_photo_path === "string" && idol.portrait_photo_path.trim() ? 1 : 0;
  const groupBonus = groupSignal > 0 ? 1 : 0;
  const appearanceBase = base + portraitBonus;
  const technicalBase = base + groupBonus;
  const performanceCore = technicalBase + stableRoll(uid, "performance_core", -2, 3);
  const vocalCenter = performanceCore + stableRoll(uid, "vocal_center", -2, 2);
  const danceSeed = technicalBase + stableRoll(uid, "dance_seed", -2, 3);
  const danceCenter = Math.round(vocalCenter * 0.45 + danceSeed * 0.55);
  const professionalismPenalty = scandalCount > 0 ? 5 + Math.min(6, (scandalCount - 1) * 2) : 0;
  const professionalismBase = scandalCount > 0 ? 9 : base;
  const injuryBase = scandalCount > 0 ? 6 : 4;
  const loyaltyPenalty = scandalCount > 0 ? Math.min(4, scandalCount) : 0;

  return clampAttrs({
    physical: {
      strength: Math.round(base * 0.65 + danceCenter * 0.35) + stableRoll(uid, "strength", -2, 2),
      agility: Math.round(base * 0.55 + danceCenter * 0.45) + stableRoll(uid, "agility", -2, 3),
      natural_fitness: base + stableRoll(uid, "natural_fitness", -2, 4),
      stamina: base + stableRoll(uid, "stamina", -2, 4),
    },
    appearance: {
      cute: appearanceBase + stableRoll(uid, "cute", -3, 4),
      pretty: appearanceBase + stableRoll(uid, "pretty", -3, 4),
    },
    technical: {
      pitch: vocalCenter + stableRoll(uid, "pitch", -2, 2),
      tone: vocalCenter + stableRoll(uid, "tone", -2, 2),
      breath: vocalCenter + stableRoll(uid, "breath", -2, 2),
      rhythm: danceCenter + stableRoll(uid, "rhythm", -2, 2),
      power: danceCenter + stableRoll(uid, "power", -2, 2),
      grace: danceCenter + stableRoll(uid, "grace", -2, 2),
    },
    mental: {
      clever: base + stableRoll(uid, "clever", -3, 4),
      humor: base + stableRoll(uid, "humor", -3, 4),
      talking: base + stableRoll(uid, "talking", -3, 4),
      determination: base + stableRoll(uid, "determination", -2, 5),
      teamwork: base + stableRoll(uid, "teamwork", -2, 4),
      fashion: base + stableRoll(uid, "fashion", -3, 4),
    },
    hidden: {
      professionalism: professionalismBase + stableRoll(uid, "professionalism", -2, 3) - professionalismPenalty,
      injury_proneness: injuryBase + stableRoll(uid, "injury_proneness", -1, 4) + Math.min(2, scandalCount),
      ambition: base + stableRoll(uid, "ambition", -2, 5),
      loyalty: base + stableRoll(uid, "loyalty", -2, 5) - loyaltyPenalty,
    },
  });
}

function normalizeRoleKey(key) {
  const normalized = String(key ?? "").trim().toLowerCase().replace(/[ -]+/g, "_");
  return ROLE_ALIASES[normalized] ?? normalized;
}

function normalizeRoleFocus(value) {
  const n = num(value, 0);
  if (n <= 0) return 0;
  if (n <= 1) return n;
  if (n <= 5) return n / 5;
  if (n <= 100) return n / 100;
  return 1;
}

function roleVector(entry) {
  const vector = Object.fromEntries(ROLE_KEYS.map((key) => [key, 0]));
  const source = entry?.roles ?? entry?.member_roles ?? entry?.role_assignments;
  if (!source || typeof source !== "object") return vector;
  if (Array.isArray(source)) {
    for (const item of source) {
      if (typeof item === "string") {
        const key = normalizeRoleKey(item);
        if (key in vector) vector[key] = Math.max(vector[key], 1);
      } else if (item && typeof item === "object") {
        const key = normalizeRoleKey(item.key ?? item.role ?? item.id);
        if (key in vector) vector[key] = Math.max(vector[key], normalizeRoleFocus(item.focus ?? item.weight ?? item.scale ?? 1));
      }
    }
    return vector;
  }
  for (const [rawKey, value] of Object.entries(source)) {
    const key = normalizeRoleKey(rawKey);
    if (key in vector) vector[key] = Math.max(vector[key], normalizeRoleFocus(value));
  }
  return vector;
}

function findGroup(groups, label) {
  const needle = label.trim().toLowerCase();
  return groups.find((group) =>
    [group.uid, group.name, group.name_romanji, group.nickname]
      .map((value) => String(value ?? "").trim().toLowerCase())
      .includes(needle),
  );
}

function findMembershipEntry(idol, group) {
  return (Array.isArray(idol.group_history) ? idol.group_history : []).find(
    (entry) => String(entry.group_uid ?? "") === String(group.uid ?? "") || String(entry.group_name ?? "") === String(group.name ?? ""),
  );
}

function solveLinearSystem(matrix, rhs) {
  const n = rhs.length;
  const a = matrix.map((row, i) => [...row, rhs[i]]);
  for (let col = 0; col < n; col += 1) {
    let pivot = col;
    for (let row = col + 1; row < n; row += 1) {
      if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    }
    if (Math.abs(a[pivot][col]) < 1e-9) continue;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const div = a[col][col];
    for (let j = col; j <= n; j += 1) a[col][j] /= div;
    for (let row = 0; row < n; row += 1) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= n; j += 1) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row[n] || 0);
}

function fitRidge(features, targets, lambda, prior = []) {
  const p = features[0]?.length ?? 0;
  const xtx = Array.from({ length: p }, () => Array.from({ length: p }, () => 0));
  const xty = Array.from({ length: p }, () => 0);
  for (let i = 0; i < features.length; i += 1) {
    const row = features[i];
    for (let a = 0; a < p; a += 1) {
      xty[a] += row[a] * targets[i];
      for (let b = 0; b < p; b += 1) xtx[a][b] += row[a] * row[b];
    }
  }
  for (let i = 0; i < p; i += 1) {
    xtx[i][i] += lambda;
    xty[i] += lambda * (prior[i] ?? 0);
  }
  return solveLinearSystem(xtx, xty);
}

function priorCoefficientsForStat(key) {
  return FEATURE_KEYS.map((feature) => (ROLE_ATTRIBUTE_PRIOR[feature]?.[key] ?? 0) * priorScalar);
}

function mae(rows, statKeys, predictor) {
  let total = 0;
  let count = 0;
  for (const row of rows) {
    const pred = predictor(row);
    for (const key of statKeys) {
      const actual = getStat(row.manual, key);
      const predicted = getStat(pred, key);
      if (actual == null || predicted == null) continue;
      total += Math.abs(actual - predicted);
      count += 1;
    }
  }
  return count ? total / count : 0;
}

function applyLearnedModel(baseAttrs, features, coefficients) {
  const out = JSON.parse(JSON.stringify(baseAttrs));
  for (const key of Object.keys(coefficients)) {
    let value = getStat(out, key) ?? 12;
    for (const feature of FEATURE_KEYS) value += (coefficients[key][feature] ?? 0) * (features[feature] ?? 0);
    setStat(out, key, value);
  }
  return clampAttrs(out);
}

function ageAtReference(idol, referenceIso) {
  const birth = parseIsoDay(idol.birthday);
  if (birth) {
    const [by, bm, bd] = birth.split("-").map(Number);
    const [ry, rm, rd] = referenceIso.split("-").map(Number);
    let age = ry - by;
    if (rm < bm || (rm === bm && rd < bd)) age -= 1;
    if (Number.isFinite(age) && age >= 0 && age <= 80) return age;
  }
  const raw = num(idol.age, NaN);
  return Number.isFinite(raw) && raw >= 0 && raw <= 80 ? raw : null;
}

function ageFeatureVector(age) {
  const safeAge = typeof age === "number" && Number.isFinite(age) ? age : 22;
  return {
    age_youth: Math.max(0, Math.min(1, (22 - safeAge) / 6)),
    age_experience: Math.max(0, Math.min(1, (safeAge - 18) / 10)),
    age_senior: Math.max(0, Math.min(1, (safeAge - 25) / 10)),
  };
}

function statErrorRows(rows, statKeys, predictor) {
  return statKeys
    .map((key) => {
      let abs = 0;
      let signed = 0;
      let count = 0;
      for (const row of rows) {
        const actual = getStat(row.manual, key);
        const predicted = getStat(predictor(row), key);
        if (actual == null || predicted == null) continue;
        abs += Math.abs(predicted - actual);
        signed += predicted - actual;
        count += 1;
      }
      return { key, mae: count ? abs / count : 0, bias: count ? signed / count : 0 };
    })
    .sort((a, b) => b.mae - a.mae);
}

const preset = readJson(`public/data/scenarios/presets/scenario6.json`);
const referenceIso = /^\d{4}-\d{2}-\d{2}$/.test(String(preset.opening_date ?? ""))
  ? preset.opening_date
  : "2025-07-01";
const idols = readJson(`public/data/scenarios/${scenario}/idols.json`);
const groups = readJson(`public/data/scenarios/${scenario}/groups.json`);
const groupLabels = (groupNames || groupName)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const selectedGroups = groupLabels.map((label) => {
  const group = findGroup(groups, label);
  if (!group) throw new Error(`Group not found: ${label}`);
  return group;
});
const group = selectedGroups[0];

const groupPopularity = buildGroupPopularityIndex(groups);
const allRows = selectedGroups.flatMap((groupRow) =>
  (Array.isArray(groupRow.member_uids) ? groupRow.member_uids : []).map((uid) => {
    const idol = idols.find((row) => String(row.uid ?? "") === String(uid));
    if (!idol) return null;
    const entry = findMembershipEntry(idol, groupRow);
    const age = ageAtReference(idol, referenceIso);
    const roleFeatures = roleVector(entry);
    const ageFeatures = ageFeatureVector(age);
    return {
      uid: idol.uid,
      name: idol.name,
      group_uid: groupRow.uid,
      group_name: groupRow.name,
      age,
      roleFeatures,
      ageFeatures,
      features: { ...roleFeatures, ...ageFeatures },
      baseline: baselineAttributes(idol, groupPopularity, referenceIso),
      manual: idol.attributes ?? null,
      hasManualAttributes: Boolean(idol.attributes),
      idolSignal: popularitySignal(numericMax(idol, ["x_followers", "x_followers_count"])),
      groupSignal: currentGroupSignal(idol, referenceIso, groupPopularity),
    };
  })
).filter(Boolean);
const calibrationRows = allRows.filter((row) => row.hasManualAttributes);

if (!calibrationRows.length) throw new Error(`No calibration rows with attributes found for ${selectedGroups.map((g) => g.name).join(", ")}`);

const statKeys = VISIBLE_STAT_PATHS.map(([category, stat]) => statKey(category, stat));
const x = calibrationRows.map((row) => FEATURE_KEYS.map((feature) => row.features[feature] ?? 0));
const coefficients = {};
const priorCoefficients = {};
for (const key of statKeys) {
  const y = calibrationRows.map((row) => (getStat(row.manual, key) ?? 12) - (getStat(row.baseline, key) ?? 12));
  const prior = priorCoefficientsForStat(key);
  const weights = fitRidge(x, y, ridgeLambda, prior);
  coefficients[key] = Object.fromEntries(FEATURE_KEYS.map((feature, i) => [feature, Number(weights[i].toFixed(4))]));
  priorCoefficients[key] = Object.fromEntries(FEATURE_KEYS.map((feature, i) => [feature, Number(prior[i].toFixed(4))]));
}

const model = {
  version: 1,
  generated_at: new Date().toISOString(),
  source: {
    scenario,
    group_uid: selectedGroups.length === 1 ? group.uid : undefined,
    group_name: selectedGroups.length === 1 ? group.name : undefined,
    group_uids: selectedGroups.map((row) => row.uid),
    group_names: selectedGroups.map((row) => row.name),
    reference_date: referenceIso,
    rows: calibrationRows.length,
    skipped_member_uids: selectedGroups.flatMap((groupRow) => (Array.isArray(groupRow.member_uids) ? groupRow.member_uids : [])).filter((uid) => {
      const idol = idols.find((row) => String(row.uid ?? "") === String(uid));
      return !idol?.attributes;
    }),
    ridge_lambda: ridgeLambda,
    prior_scalar: priorScalar,
  },
  feature_scale: {
    role_weight: "manual 0-5 role weights are normalized to 0.0-1.0 before applying coefficients",
    popularity: "baseline uses idol follower signal * 0.65 + active group fan/popularity signal * 0.35",
  },
  roles: ROLE_KEYS,
  age_features: AGE_FEATURE_KEYS,
  feature_names: FEATURE_KEYS,
  prior_coefficients: priorCoefficients,
  coefficients,
};

const baselineMae = mae(calibrationRows, statKeys, (row) => row.baseline);
const priorMae = mae(calibrationRows, statKeys, (row) => applyLearnedModel(row.baseline, row.features, priorCoefficients));
const learnedMae = mae(calibrationRows, statKeys, (row) => applyLearnedModel(row.baseline, row.features, coefficients));
const statErrorsBaseline = statErrorRows(calibrationRows, statKeys, (row) => row.baseline);
const statErrorsPrior = statErrorRows(calibrationRows, statKeys, (row) =>
  applyLearnedModel(row.baseline, row.features, priorCoefficients),
);
const statErrorsLearned = statErrorRows(calibrationRows, statKeys, (row) =>
  applyLearnedModel(row.baseline, row.features, coefficients),
);

const memberRows = calibrationRows.map((row) => {
  const learned = applyLearnedModel(row.baseline, row.features, coefficients);
  const prior = applyLearnedModel(row.baseline, row.features, priorCoefficients);
  const memberBaselineMae = mae([row], statKeys, (r) => r.baseline);
  const memberPriorMae = mae([row], statKeys, () => prior);
  const memberLearnedMae = mae([row], statKeys, () => learned);
  return {
    name: row.name,
    roles: Object.fromEntries(Object.entries(row.roleFeatures).filter(([, value]) => value > 0)),
    baseline_mae: Number(memberBaselineMae.toFixed(3)),
    prior_mae: Number(memberPriorMae.toFixed(3)),
    learned_mae: Number(memberLearnedMae.toFixed(3)),
  };
});

const predictionRows = allRows.flatMap((row) => {
  const learned = applyLearnedModel(row.baseline, row.features, coefficients);
  const prior = applyLearnedModel(row.baseline, row.features, priorCoefficients);
  const roleWeights = Object.entries(row.roleFeatures)
    .filter(([, value]) => value > 0)
    .map(([role, value]) => `${role}:${Number((value * 5).toFixed(2))}`)
    .join(";");
  return statKeys.map((key) => {
    const manual = getStat(row.manual, key);
    const baseline = getStat(row.baseline, key);
    const semanticPrior = getStat(prior, key);
    const learnedValue = getStat(learned, key);
    return {
      member_uid: row.uid,
      member_name: row.name,
      group_uid: row.group_uid,
      group_name: row.group_name,
      age: row.age ?? "",
      age_youth: Number((row.ageFeatures.age_youth ?? 0).toFixed(4)),
      age_experience: Number((row.ageFeatures.age_experience ?? 0).toFixed(4)),
      age_senior: Number((row.ageFeatures.age_senior ?? 0).toFixed(4)),
      idol_signal: Number(row.idolSignal.toFixed(4)),
      group_signal: Number(row.groupSignal.toFixed(4)),
      role_weights_0_to_5: roleWeights,
      stat: key,
      manual: manual ?? "",
      baseline,
      semantic_prior: semanticPrior,
      learned: learnedValue,
      baseline_error: baseline == null || manual == null ? "" : baseline - manual,
      semantic_prior_error: semanticPrior == null || manual == null ? "" : semanticPrior - manual,
      learned_error: learnedValue == null || manual == null ? "" : learnedValue - manual,
      learned_abs_error: learnedValue == null || manual == null ? "" : Math.abs(learnedValue - manual),
    };
  });
});

const reportLines = [];
reportLines.push(`# Member Role Attribute Calibration`);
reportLines.push("");
reportLines.push(`Scenario: ${scenario}`);
reportLines.push(`Groups: ${selectedGroups.map((row) => `${row.name} (${row.uid})`).join(", ")}`);
reportLines.push(`Reference date: ${referenceIso}`);
reportLines.push(`Manual comparison rows: ${calibrationRows.length}`);
reportLines.push(`Prediction rows: ${allRows.length}`);
for (const groupRow of selectedGroups) {
  const groupRows = allRows.filter((row) => String(row.group_uid) === String(groupRow.uid));
  const manualCount = groupRows.filter((row) => row.hasManualAttributes).length;
  const roleCount = groupRows.filter((row) => Object.values(row.roleFeatures).some((value) => value > 0)).length;
  const skippedNames = groupRows.filter((row) => !row.hasManualAttributes).map((row) => String(row.name ?? row.uid));
  reportLines.push(`- ${groupRow.name}: manual ${manualCount}/${groupRows.length}, roles ${roleCount}/${groupRows.length}`);
  if (skippedNames.length) reportLines.push(`  Missing manual attributes: ${skippedNames.join(", ")}`);
}
reportLines.push(`Ridge lambda: ${ridgeLambda}`);
reportLines.push(`Prior scalar: ${priorScalar}`);
reportLines.push(`Age features: ${AGE_FEATURE_KEYS.join(", ")}`);
reportLines.push("");
reportLines.push(`Baseline MAE: ${baselineMae.toFixed(3)}`);
reportLines.push(`Semantic prior MAE: ${priorMae.toFixed(3)}`);
reportLines.push(`Prior-calibrated role model MAE: ${learnedMae.toFixed(3)}`);
reportLines.push("");
reportLines.push(`## Worst Stats After Learning`);
for (const row of statErrorsLearned.slice(0, 8)) {
  reportLines.push(`- ${row.key}: MAE ${row.mae.toFixed(2)}, bias ${row.bias >= 0 ? "+" : ""}${row.bias.toFixed(2)}`);
}
reportLines.push("");
reportLines.push(`## Member Fit`);
for (const row of memberRows.sort((a, b) => b.learned_mae - a.learned_mae)) {
  reportLines.push(`- ${row.name}: baseline ${row.baseline_mae.toFixed(2)} -> prior ${row.prior_mae.toFixed(2)} -> learned ${row.learned_mae.toFixed(2)}`);
}
reportLines.push("");
reportLines.push(`## Strongest Learned Role Coefficients`);
for (const role of FEATURE_KEYS) {
  const top = Object.entries(coefficients)
    .map(([key, roleWeights]) => [key, roleWeights[role]])
    .filter(([, value]) => Math.abs(value) >= 0.25)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, 6);
  if (!top.length) continue;
  reportLines.push(`### ${role}`);
  for (const [key, value] of top) reportLines.push(`- ${key}: ${value >= 0 ? "+" : ""}${value.toFixed(2)}`);
  reportLines.push("");
}

const outputSuffix = outputTag ? `_${outputTag}` : "";
const modelPath = `public/data/member_role_attribute_model${outputSuffix}.json`;
const reportPath = `support/reports/member_role_attribute_calibration${outputSuffix}.md`;
const detailPath = `support/reports/member_role_attribute_calibration_detail${outputSuffix}.json`;
const predictionsPath = `support/reports/member_role_attribute_predictions${outputSuffix}.csv`;
writeJson(modelPath, model);
writeText(reportPath, reportLines.join("\n") + "\n");
writeCsv(predictionsPath, predictionRows);
writeJson(detailPath, {
  model_path: modelPath,
  predictions_path: predictionsPath,
  baseline_mae: baselineMae,
  prior_mae: priorMae,
  learned_mae: learnedMae,
  stat_errors_baseline: statErrorsBaseline,
  stat_errors_prior: statErrorsPrior,
  stat_errors_learned: statErrorsLearned,
  members: memberRows,
  predictions: predictionRows,
});

console.log(`Wrote ${modelPath}`);
console.log(`Wrote ${reportPath}`);
console.log(`Wrote ${predictionsPath}`);
console.log(`Baseline MAE ${baselineMae.toFixed(3)} -> prior MAE ${priorMae.toFixed(3)} -> learned MAE ${learnedMae.toFixed(3)}`);
