/**
 * Sync the manual review CSV with:
 * - existing review rows already in the sheet
 * - refreshed rows for =LOVE (including former members)
 * - regenerated rows for ≠ME and ≒JOY
 *
 * Current JSON attributes are authoritative when present.
 * Missing attributes are regenerated from the follower model.
 * Former =LOVE members are blended toward the current =LOVE attribute average
 * so they stay in the same general talent band for manual review.
 *
 * Run:
 *   node scripts/syncScenario6ReviewCsv.mjs
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const groupsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "groups.json");
const idolsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json");
const presetPath = path.join(root, "public", "data", "scenarios", "presets", "scenario6.json");
const allowlistPath = path.join(root, "public", "data", "scenarios", "scenario_6", "startup_allowlist.json");
const csvPath = path.join(root, "support", "docs", "scenario_6_recommended_group_idols.csv");
const fallbackCsvPath = path.join(root, "support", "docs", "scenario_6_recommended_group_idols.generated.csv");

const TARGET_GROUPS = [
  { uid: "PUxPVkU", aliases: ["=LOVE", "イコラブ"] },
  { uid: "4omgTUU", aliases: ["≠ME", "ノイミー"] },
  { uid: "4omSSk9Z", aliases: ["≒JOY", "ニアジョイ"] },
];

const HEADERS = [
  "scenario_id",
  "scenario_opening_date",
  "startup_group_order",
  "group_uid",
  "group_name",
  "group_name_romanji",
  "idol_uid",
  "idol_name",
  "idol_romaji",
  "idol_hiragana",
  "nickname",
  "status_at_opening",
  "membership_start_dates",
  "membership_end_dates",
  "member_name_in_group",
  "member_colors",
  "member_color_codes",
  "membership_notes",
  "birthday",
  "age",
  "height_cm",
  "birthplace",
  "languages",
  "x_followers",
  "wiki_url",
  "portrait_photo_path",
  "attribute_source",
  "overall_rating",
  "ability",
  "strength",
  "agility",
  "natural_fitness",
  "stamina",
  "cute",
  "pretty",
  "pitch",
  "tone",
  "breath",
  "rhythm",
  "power",
  "grace",
  "clever",
  "humor",
  "talking",
  "determination",
  "teamwork",
  "fashion",
  "professionalism",
  "injury_proneness",
  "ambition",
  "loyalty",
  "manual_status_override",
  "manual_notes",
];

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeText(value) {
  return String(value ?? "").replace(/^\uFEFF/, "").replace(/^\u200B/, "").trim();
}

function parseCsvRecords(filePath) {
  if (!fs.existsSync(filePath)) return [];
  const rows = parseCsv(fs.readFileSync(filePath, "utf8")).filter((row) => row.some((cell) => normalizeText(cell)));
  if (!rows.length) return [];
  const headers = rows[0].map((cell) => normalizeText(cell));
  return rows.slice(1).map((row) => {
    const rec = {};
    for (let i = 0; i < headers.length; i++) rec[headers[i]] = row[i] ?? "";
    return rec;
  });
}

function protectExcelText(value) {
  const s = value == null ? "" : String(value);
  return /^[=+\-@]/.test(s) ? `\u200B${s}` : s;
}

function csvCell(value) {
  const s = protectExcelText(value);
  return `"${s.replace(/"/g, '""')}"`;
}

function pipeJoin(values) {
  if (!Array.isArray(values)) return "";
  return values.map((v) => String(v ?? "").trim()).filter(Boolean).join(" | ");
}

function parseIsoDay(value) {
  if (typeof value !== "string") return null;
  const s = value.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function membershipActiveAtOpening(entry, openingIso) {
  const start = parseIsoDay(entry?.start_date);
  if (!start || start > openingIso) return false;
  const endRaw = entry?.end_date;
  if (endRaw == null || endRaw === "") return true;
  const end = parseIsoDay(endRaw);
  if (!end) return false;
  return openingIso < end;
}

function membershipFutureAtOpening(entry, openingIso) {
  const start = parseIsoDay(entry?.start_date);
  return !!start && start > openingIso;
}

function membershipFormerAtOpening(entry, openingIso) {
  const start = parseIsoDay(entry?.start_date);
  if (!start || start > openingIso) return false;
  const end = parseIsoDay(entry?.end_date);
  return !!end && end <= openingIso;
}

function stableRoll(uid, label, low, high) {
  const digest = crypto.createHash("sha256").update(`${uid}:${label}`, "utf8").digest();
  const raw = digest.readUInt32BE(0);
  const span = high - low + 1;
  return low + (raw % span);
}

function clampStat(n) {
  return Math.max(0, Math.min(20, Math.round(n)));
}

function clampPhysical(p) {
  return {
    strength: clampStat(p.strength),
    agility: clampStat(p.agility),
    natural_fitness: clampStat(p.natural_fitness),
    stamina: clampStat(p.stamina),
  };
}

function clampAppearance(a) {
  return { cute: clampStat(a.cute), pretty: clampStat(a.pretty) };
}

function clampTechnical(t) {
  return {
    pitch: clampStat(t.pitch),
    tone: clampStat(t.tone),
    breath: clampStat(t.breath),
    rhythm: clampStat(t.rhythm),
    power: clampStat(t.power),
    grace: clampStat(t.grace),
  };
}

function clampMental(m) {
  return {
    clever: clampStat(m.clever),
    humor: clampStat(m.humor),
    talking: clampStat(m.talking),
    determination: clampStat(m.determination),
    teamwork: clampStat(m.teamwork),
    fashion: clampStat(m.fashion),
  };
}

function clampHidden(h) {
  return {
    professionalism: clampStat(h.professionalism),
    injury_proneness: clampStat(h.injury_proneness),
    ambition: clampStat(h.ambition),
    loyalty: clampStat(h.loyalty),
  };
}

function num(v, fallback = 0) {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function numericMax(record, keys) {
  let max = 0;
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value > max) max = value;
    else if (typeof value === "string" && value.trim() !== "") {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > max) max = parsed;
    }
  }
  return max;
}

function popularitySignal(value, floor = 1000, ceiling = 1_000_000) {
  if (value <= 0) return 0;
  const low = Math.log10(floor);
  const high = Math.log10(ceiling);
  const signal = (Math.log10(Math.max(value, 1)) - low) / (high - low);
  return Math.max(0, Math.min(1, signal));
}

function buildGroupPopularityIndex(groups) {
  const index = new Map();
  for (const row of groups) {
    const fans = numericMax(row, ["fans", "fan_count"]);
    const followerSignal = popularitySignal(fans);
    const pop = numericMax(row, ["popularity"]);
    const popSignal = pop > 0 ? Math.max(0, Math.min(1, pop / 100)) : 0;
    const signal = Math.max(followerSignal, popSignal);
    for (const key of [String(row.uid ?? "").trim(), String(row.name ?? "").trim()]) {
      if (!key) continue;
      const prev = index.get(key);
      if (prev == null || signal > prev) index.set(key, signal);
    }
  }
  return index;
}

function buildGroupLetterTierIndex(groups) {
  const index = new Map();
  for (const row of groups) {
    const tier = String(row.letter_tier ?? "").trim().toUpperCase();
    if (!tier) continue;
    for (const key of [String(row.uid ?? "").trim(), String(row.name ?? "").trim()]) {
      if (key) index.set(key, tier);
    }
  }
  return index;
}

function membershipEndedByOpening(entry, openingIso) {
  const start = parseIsoDay(entry?.start_date);
  if (!start || start > openingIso) return false;
  const end = parseIsoDay(entry?.end_date);
  if (!end) return false;
  return end <= openingIso;
}

function currentGroupContext(idol, openingIso, groupPopularity, groupLetterTiers) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  let hasActive = false;
  let bestActive = 0;
  let activeTier = null;
  let latestPast = null;
  for (const entry of hist) {
    if (!entry || typeof entry !== "object") continue;
    const keys = [String(entry.group_uid ?? "").trim(), String(entry.group_name ?? "").trim()].filter(Boolean);
    const resolve = () => {
      let signal = 0;
      let letterTier = null;
      for (const key of keys) {
        const next = groupPopularity.get(key);
        if (next == null || next < signal) continue;
        signal = next;
        letterTier = groupLetterTiers instanceof Map ? groupLetterTiers.get(key) ?? letterTier : letterTier;
      }
      return { signal, letterTier };
    };
    if (membershipActiveAtOpening(entry, openingIso)) {
      hasActive = true;
      const hit = resolve();
      if (hit.signal >= bestActive) {
        bestActive = hit.signal;
        activeTier = hit.letterTier ?? activeTier;
      }
      continue;
    }
    if (!membershipEndedByOpening(entry, openingIso)) continue;
    const end = parseIsoDay(entry.end_date);
    const start = parseIsoDay(entry.start_date);
    if (!end || !start) continue;
    const hit = resolve();
    if (!latestPast || end > latestPast.end || (end === latestPast.end && start > latestPast.start)) {
      latestPast = { end, start, signal: hit.signal, letterTier: hit.letterTier };
    }
  }
  if (hasActive) return { signal: bestActive, letterTier: activeTier };
  if (latestPast) return { signal: latestPast.signal, letterTier: latestPast.letterTier };
  return { signal: 0, letterTier: null };
}

function currentGroupSignal(idol, openingIso, groupPopularity, groupLetterTiers) {
  return currentGroupContext(idol, openingIso, groupPopularity, groupLetterTiers).signal;
}

function scandalHistoryCount(idol) {
  const history = Array.isArray(idol.status_history) ? idol.status_history : [];
  let count = 0;
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    if (String(raw.kind ?? "").trim().toLowerCase() === "scandal") count += 1;
  }
  return count;
}

function buildAttributesFromFollowerModel(idol, groupPopularity, openingIso, groupLetterTiers) {
  const uid = String(idol.uid ?? "unknown");
  const idolSignal = popularitySignal(numericMax(idol, ["x_followers", "x_followers_count"]));
  const { signal: groupSignal, letterTier } = currentGroupContext(
    idol,
    openingIso,
    groupPopularity,
    groupLetterTiers,
  );
  let combined = idolSignal * 0.5 + groupSignal * 0.5;
  const tierCap = { S: 1, A: 0.95, B: 0.86, C: 0.75, D: 0.55, E: 0.46, I: 0.34 }[String(letterTier ?? "").toUpperCase()];
  if (typeof tierCap === "number") combined = Math.min(combined, tierCap);
  combined = Math.max(0, Math.min(1, combined));
  // Fitted to curated manuals (=LOVE / iLiFE! / 高嶺のなでしこ / アキシブ).
  const base = Math.round(12.5 + combined * 5.2);
  const scandalCount = scandalHistoryCount(idol);
  const portraitPath = idol.portrait_photo_path;
  const portraitBonus = typeof portraitPath === "string" && portraitPath.trim().length > 0 ? 1 : 0;
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
  const age = ageAtOpening(idol, openingIso);
  let cuteSeed = appearanceBase;
  let prettySeed = appearanceBase;
  if (typeof age === "number" && Number.isFinite(age)) {
    if (age > 25) cuteSeed = Math.min(cuteSeed, 14);
    if (age < 20) prettySeed = Math.min(prettySeed, 14);
    if (age >= 26) prettySeed += 1;
    if (age <= 19) cuteSeed += 1;
  }

  const attrs = {
    physical: clampPhysical({
      strength: Math.round(base * 0.65 + danceCenter * 0.35) + stableRoll(uid, "strength", -2, 2),
      agility: Math.round(base * 0.55 + danceCenter * 0.45) + stableRoll(uid, "agility", -2, 3),
      natural_fitness: base + stableRoll(uid, "natural_fitness", -2, 4),
      stamina: base + stableRoll(uid, "stamina", -2, 4),
    }),
    appearance: clampAppearance({
      cute: cuteSeed + stableRoll(uid, "cute", -3, 4),
      pretty: prettySeed + stableRoll(uid, "pretty", -3, 4),
    }),
    technical: clampTechnical({
      pitch: vocalCenter + stableRoll(uid, "pitch", -2, 2),
      tone: vocalCenter + stableRoll(uid, "tone", -2, 2),
      breath: vocalCenter + stableRoll(uid, "breath", -2, 2),
      rhythm: danceCenter + stableRoll(uid, "rhythm", -2, 2),
      power: danceCenter + stableRoll(uid, "power", -2, 2),
      grace: danceCenter + stableRoll(uid, "grace", -2, 2),
    }),
    mental: clampMental({
      clever: base + stableRoll(uid, "clever", -3, 4),
      humor: base + stableRoll(uid, "humor", -3, 4),
      talking: base + stableRoll(uid, "talking", -3, 4),
      determination: base + stableRoll(uid, "determination", -2, 5),
      teamwork: base + stableRoll(uid, "teamwork", -2, 4),
      fashion: base + stableRoll(uid, "fashion", -3, 4),
    }),
    hidden: clampHidden({
      professionalism: professionalismBase + stableRoll(uid, "professionalism", -2, 3) - professionalismPenalty,
      injury_proneness: injuryBase + stableRoll(uid, "injury_proneness", -1, 4) + Math.min(2, scandalCount),
      ambition: base + stableRoll(uid, "ambition", -2, 5),
      loyalty: base + stableRoll(uid, "loyalty", -2, 5) - loyaltyPenalty,
    }),
  };
  return applyAgeAppearanceConstraints(attrs, age);
}

function ageAtOpening(idol, openingIso) {
  const birthday = typeof idol.birthday === "string" ? idol.birthday.trim().split("T")[0] : null;
  if (birthday && /^\d{4}-\d{2}-\d{2}$/.test(birthday)) {
    const [by, bm, bd] = birthday.split("-").map(Number);
    const [oy, om, od] = openingIso.split("-").map(Number);
    let age = oy - by;
    if (om < bm || (om === bm && od < bd)) age -= 1;
    if (Number.isFinite(age) && age >= 0 && age <= 80) return age;
  }
  const age = Number(idol.age);
  return Number.isFinite(age) && age >= 0 && age <= 80 ? age : null;
}

function applyAgeAppearanceConstraints(attrs, age) {
  if (typeof age !== "number" || !Number.isFinite(age)) return attrs;
  let cute = attrs.appearance.cute;
  let pretty = attrs.appearance.pretty;
  if (age > 25 && cute > 15) cute = Math.min(16, 15 + Math.max(0, Math.round((cute - 15) * 0.2)));
  if (age < 20 && pretty > 15) pretty = Math.min(16, 15 + Math.max(0, Math.round((pretty - 15) * 0.2)));
  if (cute === attrs.appearance.cute && pretty === attrs.appearance.pretty) return attrs;
  return {
    ...attrs,
    appearance: clampAppearance({ cute, pretty }),
  };
}

function normalizePersistedAttributes(raw) {
  const d = raw && typeof raw === "object" ? raw : {};
  const phys = d.physical ?? {};
  const app = d.appearance ?? {};
  const tech = d.technical ?? {};
  const ment = d.mental ?? {};
  const hid = d.hidden ?? {};
  return {
    physical: clampPhysical({
      strength: num(phys.strength, 12),
      agility: num(phys.agility, 12),
      natural_fitness: num(phys.natural_fitness, 12),
      stamina: num(phys.stamina, 12),
    }),
    appearance: clampAppearance({ cute: num(app.cute, 12), pretty: num(app.pretty, 12) }),
    technical: clampTechnical({
      pitch: num(tech.pitch, 12),
      tone: num(tech.tone, 12),
      breath: num(tech.breath, 12),
      rhythm: num(tech.rhythm, 12),
      power: num(tech.power, 12),
      grace: num(tech.grace, 12),
    }),
    mental: clampMental({
      clever: num(ment.clever, 12),
      humor: num(ment.humor, 12),
      talking: num(ment.talking, 12),
      determination: num(ment.determination, 12),
      teamwork: num(ment.teamwork, 12),
      fashion: num(ment.fashion, 12),
    }),
    hidden: clampHidden({
      professionalism: num(hid.professionalism, 12),
      injury_proneness: num(hid.injury_proneness, 4),
      ambition: num(hid.ambition, 12),
      loyalty: num(hid.loyalty, 12),
    }),
  };
}

function hasPersistedAttributeBlock(raw) {
  if (!raw || typeof raw !== "object") return false;
  for (const cat of ["physical", "appearance", "technical", "mental", "hidden"]) {
    const block = raw[cat];
    if (!block || typeof block !== "object") continue;
    for (const value of Object.values(block)) {
      if (typeof value === "number" && Number.isFinite(value)) return true;
      if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return true;
    }
  }
  return false;
}

function getOverallRating(a) {
  const phAvg = (a.physical.strength + a.physical.agility + a.physical.natural_fitness + a.physical.stamina) / 4;
  const apAvg = (a.appearance.cute + a.appearance.pretty) / 2;
  const techAvg = (a.technical.pitch + a.technical.tone + a.technical.breath + a.technical.rhythm + a.technical.power + a.technical.grace) / 6;
  const menAvg = (a.mental.clever + a.mental.humor + a.mental.talking + a.mental.determination + a.mental.teamwork + a.mental.fashion) / 6;
  return phAvg * 0.15 + apAvg * 0.2 + techAvg * 0.4 + menAvg * 0.25;
}

function getAbility(a) {
  const physicalSum = a.physical.strength + a.physical.agility + a.physical.natural_fitness + a.physical.stamina;
  const physicalPart = (physicalSum / 16) * 3;
  const appearanceMax = Math.max(a.appearance.cute, a.appearance.pretty);
  const appearanceMin = Math.min(a.appearance.cute, a.appearance.pretty);
  const appearancePart = appearanceMax + appearanceMin / 4;
  const technicalSum = a.technical.pitch + a.technical.tone + a.technical.breath + a.technical.rhythm + a.technical.power + a.technical.grace;
  const technicalPart = technicalSum / 3;
  const mentalSum = a.mental.clever + a.mental.humor + a.mental.talking + a.mental.determination + a.mental.teamwork + a.mental.fashion;
  const mentalPart = mentalSum / 6;
  return Math.floor(physicalPart + appearancePart + technicalPart + mentalPart);
}

function statusAtOpening(relevant, openingIso) {
  if (relevant.some((entry) => membershipActiveAtOpening(entry, openingIso))) return "current";
  if (relevant.some((entry) => membershipFutureAtOpening(entry, openingIso))) return "future";
  if (relevant.some((entry) => membershipFormerAtOpening(entry, openingIso))) return "former";
  return "";
}

function blendAttributesTowardReference(attrs, reference, blend = 0.7) {
  const out = JSON.parse(JSON.stringify(attrs));
  for (const cat of ["physical", "appearance", "technical", "mental", "hidden"]) {
    for (const key of Object.keys(out[cat] ?? {})) {
      const a = num(out[cat][key], 12);
      const r = num(reference?.[cat]?.[key], a);
      out[cat][key] = clampStat(Math.round(a * (1 - blend) + r * blend));
    }
  }
  return out;
}

function averageAttributes(rows) {
  const seed = {
    physical: { strength: 0, agility: 0, natural_fitness: 0, stamina: 0 },
    appearance: { cute: 0, pretty: 0 },
    technical: { pitch: 0, tone: 0, breath: 0, rhythm: 0, power: 0, grace: 0 },
    mental: { clever: 0, humor: 0, talking: 0, determination: 0, teamwork: 0, fashion: 0 },
    hidden: { professionalism: 0, injury_proneness: 0, ambition: 0, loyalty: 0 },
  };
  if (!rows.length) return seed;
  for (const attrs of rows) {
    for (const cat of Object.keys(seed)) {
      for (const key of Object.keys(seed[cat])) seed[cat][key] += num(attrs[cat]?.[key], 0);
    }
  }
  for (const cat of Object.keys(seed)) {
    for (const key of Object.keys(seed[cat])) seed[cat][key] = clampStat(seed[cat][key] / rows.length);
  }
  return seed;
}

function buildRow(record, preserved = {}) {
  const row = {};
  for (const header of HEADERS) row[header] = record[header] ?? preserved[header] ?? "";
  row.manual_status_override = preserved.manual_status_override ?? "";
  row.manual_notes = preserved.manual_notes ?? "";
  return row;
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
const preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));
const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
const existingRecords = parseCsvRecords(csvPath);

const openingDate = String(preset.opening_date ?? "").slice(0, 10);
const groupsByUid = new Map(groups.map((g) => [String(g.uid), g]));
const allowlistOrder = new Map(
  (Array.isArray(allowlist.names_in_order) ? allowlist.names_in_order : []).map((name, idx) => [String(name), idx + 1]),
);
const groupPopularity = buildGroupPopularityIndex(groups);
const groupLetterTiers = buildGroupLetterTierIndex(groups);
const existingByKey = new Map(existingRecords.map((row) => [`${normalizeText(row.group_uid)}|${normalizeText(row.idol_uid)}`, row]));
const idolsByUid = new Map(idols.map((idol) => [String(idol.uid ?? "").trim(), idol]));

function relevantEntriesForTarget(idol, target) {
  const aliases = new Set(target.aliases.map((x) => normalizeText(x)));
  return (Array.isArray(idol.group_history) ? idol.group_history : []).filter((entry) => {
    const guid = normalizeText(entry?.group_uid);
    const gname = normalizeText(entry?.group_name);
    return guid === target.uid || (gname && aliases.has(gname));
  });
}

function resolveGroupRow(target) {
  return (
    groupsByUid.get(target.uid) ??
    groups.find((g) => target.aliases.includes(normalizeText(g.name)) || target.aliases.includes(normalizeText(g.nickname))) ??
    null
  );
}

function groupRosterEntriesFromGroupRow(group, target) {
  const out = [];
  const pushUid = (uid, forcedStatus) => {
    const idol = idolsByUid.get(String(uid ?? "").trim());
    if (!idol) return;
    const relevant = relevantEntriesForTarget(idol, target).sort((a, b) => String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
    out.push({ idol, relevant, forcedStatus });
  };
  for (const uid of Array.isArray(group?.member_uids) ? group.member_uids : []) pushUid(uid, "current");
  for (const uid of Array.isArray(group?.past_member_uids) ? group.past_member_uids : []) pushUid(uid, "former");
  return out;
}

const equalLoveCurrentAttrs = idols
  .filter((idol) => relevantEntriesForTarget(idol, TARGET_GROUPS[0]).some((entry) => membershipActiveAtOpening(entry, openingDate)))
  .map((idol) => (hasPersistedAttributeBlock(idol.attributes) ? normalizePersistedAttributes(idol.attributes) : null))
  .filter(Boolean);
const equalLoveReference = averageAttributes(equalLoveCurrentAttrs);

const generatedRows = [];

for (const target of TARGET_GROUPS) {
  const group = resolveGroupRow(target);
  if (!group) continue;
  const useGroupRoster = target.uid === "4omgTUU" || target.uid === "4omSSk9Z";
  const groupRows = (useGroupRoster
    ? groupRosterEntriesFromGroupRow(group, target)
    : idols
        .map((idol) => {
          const relevant = relevantEntriesForTarget(idol, target)
            .sort((a, b) => String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
          return { idol, relevant, forcedStatus: "" };
        })
        .filter(({ relevant }) => relevant.length > 0))
    .sort((a, b) => {
      const sa = a.forcedStatus || statusAtOpening(a.relevant, openingDate);
      const sb = b.forcedStatus || statusAtOpening(b.relevant, openingDate);
      const rank = { current: 0, former: 1, future: 2, "": 3 };
      if (rank[sa] !== rank[sb]) return rank[sa] - rank[sb];
      return String(a.idol.name ?? "").localeCompare(String(b.idol.name ?? ""), "ja");
    });

  for (const { idol, relevant, forcedStatus } of groupRows) {
    const key = `${target.uid}|${idol.uid}`;
    const preserved = existingByKey.get(key) ?? {};
    const status = forcedStatus || statusAtOpening(relevant, openingDate);
    let attrs;
    let source;
    if (hasPersistedAttributeBlock(idol.attributes)) {
      attrs = normalizePersistedAttributes(idol.attributes);
      source = "persisted_from_scenario_json";
    } else {
      attrs = buildAttributesFromFollowerModel(idol, groupPopularity, openingDate, groupLetterTiers);
      source = "regenerated_from_follower_model_v2";
      if (target.uid === "PUxPVkU" && status === "former") {
        attrs = blendAttributesTowardReference(attrs, equalLoveReference, 0.7);
        source = "regenerated_equal_love_reference_blend";
      }
    }
    generatedRows.push(
      buildRow(
        {
          scenario_id: preset.id,
          scenario_opening_date: openingDate,
          startup_group_order: allowlistOrder.get(String(group.name ?? "")) ?? "",
          group_uid: target.uid,
          group_name: group.name,
          group_name_romanji: group.name_romanji,
          idol_uid: idol.uid,
          idol_name: idol.name,
          idol_romaji: idol.romaji,
          idol_hiragana: idol.hiragana,
          nickname: idol.nickname,
          status_at_opening: status,
          membership_start_dates: pipeJoin(relevant.map((entry) => parseIsoDay(entry.start_date) ?? "")),
          membership_end_dates: pipeJoin(relevant.map((entry) => parseIsoDay(entry.end_date) ?? "")),
          member_name_in_group: pipeJoin(relevant.map((entry) => normalizeText(entry.member_name))),
          member_colors: pipeJoin(relevant.map((entry) => normalizeText(entry.member_color))),
          member_color_codes: pipeJoin(relevant.map((entry) => normalizeText(entry.member_color_code))),
          membership_notes: pipeJoin(relevant.map((entry) => normalizeText(entry.notes))),
          birthday: idol.birthday,
          age: idol.age,
          height_cm: idol.height,
          birthplace: idol.birthplace,
          languages: pipeJoin(idol.languages),
          x_followers: idol.x_followers,
          wiki_url: idol.wiki_url,
          portrait_photo_path: idol.portrait_photo_path,
          attribute_source: source,
          overall_rating: getOverallRating(attrs).toFixed(2),
          ability: getAbility(attrs),
          strength: attrs.physical.strength,
          agility: attrs.physical.agility,
          natural_fitness: attrs.physical.natural_fitness,
          stamina: attrs.physical.stamina,
          cute: attrs.appearance.cute,
          pretty: attrs.appearance.pretty,
          pitch: attrs.technical.pitch,
          tone: attrs.technical.tone,
          breath: attrs.technical.breath,
          rhythm: attrs.technical.rhythm,
          power: attrs.technical.power,
          grace: attrs.technical.grace,
          clever: attrs.mental.clever,
          humor: attrs.mental.humor,
          talking: attrs.mental.talking,
          determination: attrs.mental.determination,
          teamwork: attrs.mental.teamwork,
          fashion: attrs.mental.fashion,
          professionalism: attrs.hidden.professionalism,
          injury_proneness: attrs.hidden.injury_proneness,
          ambition: attrs.hidden.ambition,
          loyalty: attrs.hidden.loyalty,
        },
        preserved,
      ),
    );
  }
}

const generatedByKey = new Map(generatedRows.map((row) => [`${normalizeText(row.group_uid)}|${normalizeText(row.idol_uid)}`, row]));
const merged = [];
for (const row of existingRecords) {
  const key = `${normalizeText(row.group_uid)}|${normalizeText(row.idol_uid)}`;
  if (generatedByKey.has(key)) merged.push(generatedByKey.get(key));
  else merged.push(buildRow(row, row));
  generatedByKey.delete(key);
}
for (const row of generatedByKey.values()) merged.push(row);

const lines = [HEADERS.join(",")];
for (const row of merged) lines.push(HEADERS.map((header) => csvCell(row[header] ?? "")).join(","));
const payload = `\uFEFF${lines.join("\r\n")}\r\n`;
let writtenPath = csvPath;
try {
  fs.writeFileSync(csvPath, payload, "utf8");
} catch (err) {
  if (err && typeof err === "object" && err.code === "EBUSY") {
    fs.writeFileSync(fallbackCsvPath, payload, "utf8");
    writtenPath = fallbackCsvPath;
  } else {
    throw err;
  }
}

console.log(
  `[sync-scenario6-review-csv] wrote ${merged.length} rows (${generatedRows.length} target-group rows refreshed) to ${path.relative(root, writtenPath)}`,
);
