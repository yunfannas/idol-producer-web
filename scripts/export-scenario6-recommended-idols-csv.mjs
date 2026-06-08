/**
 * Export Scenario 6 current/future idols for the four recommended startup groups
 * into a CSV for manual review and adjustment.
 *
 * Run: node scripts/export-scenario6-recommended-idols-csv.mjs
 * Output: docs/scenario_6_recommended_group_idols.csv
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const groupsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "groups.json");
const idolsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json");
const presetPath = path.join(root, "public", "data", "scenarios", "presets", "scenario6.json");
const outPath = path.join(root, "docs", "scenario_6_recommended_group_idols.csv");

const TARGET_GROUPS = [
  { uid: "PUxPVkU", startup_name: "=LOVE" },
  { uid: "aUxpRkUh", startup_name: "iLiFE!" },
  { uid: "6auY5ba644Gu44Gq44Gn44GX44GT", startup_name: "高嶺のなでしこ" },
  { uid: "44Ki44Kt44K344OWcHJvamVjdA", startup_name: "アキシブproject" },
];

function protectExcelText(value) {
  const s = value == null ? "" : String(value);
  return /^[=+\-@]/.test(s) ? `\u200B${s}` : s;
}

function csvCell(v) {
  const s = protectExcelText(v);
  return `"${s.replace(/"/g, '""')}"`;
}

function pipeJoin(values) {
  if (!Array.isArray(values)) return "";
  return values.map((v) => String(v ?? "").trim()).filter(Boolean).join(" | ");
}

function parseIsoDay(value) {
  if (typeof value !== "string") return null;
  const day = value.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
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
  return {
    cute: clampStat(a.cute),
    pretty: clampStat(a.pretty),
  };
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

function num(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function numericMax(record, keys) {
  let max = 0;
  for (const key of keys) {
    const value = record?.[key];
    if (typeof value === "number" && Number.isFinite(value) && value > max) max = value;
    if (typeof value === "string" && value.trim() !== "") {
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
  for (const group of groups) {
    const followers = numericMax(group, ["x_followers", "x_followers_count", "fans", "fan_count"]);
    const followerSignal = popularitySignal(followers);
    const pop = numericMax(group, ["popularity"]);
    const popSignal = pop > 0 ? Math.max(0, Math.min(1, pop / 100)) : 0;
    const signal = Math.max(followerSignal, popSignal);
    for (const key of [String(group.uid ?? "").trim(), String(group.name ?? "").trim()]) {
      if (!key) continue;
      const prev = index.get(key);
      if (prev == null || signal > prev) index.set(key, signal);
    }
  }
  return index;
}

function stableRoll(uid, label, low, high) {
  const digest = crypto.createHash("sha256").update(`${uid}:${label}`, "utf8").digest();
  const raw = digest.readUInt32BE(0);
  const span = high - low + 1;
  return low + (raw % span);
}

function currentGroupSignal(idol, openingIso, groupPopularity) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  let best = 0;
  for (const entry of hist) {
    if (!membershipActiveAtOpening(entry, openingIso)) continue;
    for (const key of [String(entry.group_uid ?? "").trim(), String(entry.group_name ?? "").trim()]) {
      if (!key) continue;
      const score = groupPopularity.get(key);
      if (score != null && score > best) best = score;
    }
  }
  return best;
}

function buildAttributesFromFollowerModel(idol, groupPopularity, openingIso) {
  const uid = String(idol.uid ?? "unknown");
  const idolSignal = popularitySignal(numericMax(idol, ["x_followers", "x_followers_count"]));
  const groupSignal = currentGroupSignal(idol, openingIso, groupPopularity);
  const combined = Math.max(0, Math.min(1, idolSignal * 0.65 + groupSignal * 0.35));
  const base = 7 + Math.round(combined * 12);
  const portraitBonus =
    typeof idol.portrait_photo_path === "string" && idol.portrait_photo_path.trim() ? 1 : 0;
  const groupBonus = groupSignal > 0 ? 1 : 0;
  const appearanceBase = base + portraitBonus;
  const technicalBase = base + groupBonus;

  return {
    physical: clampPhysical({
      strength: base + stableRoll(uid, "strength", -3, 3),
      agility: base + stableRoll(uid, "agility", -3, 4),
      natural_fitness: base + stableRoll(uid, "natural_fitness", -2, 4),
      stamina: base + stableRoll(uid, "stamina", -2, 4),
    }),
    appearance: clampAppearance({
      cute: appearanceBase + stableRoll(uid, "cute", -3, 4),
      pretty: appearanceBase + stableRoll(uid, "pretty", -3, 4),
    }),
    technical: clampTechnical({
      pitch: technicalBase + stableRoll(uid, "pitch", -4, 4),
      tone: technicalBase + stableRoll(uid, "tone", -4, 4),
      breath: technicalBase + stableRoll(uid, "breath", -4, 4),
      rhythm: technicalBase + stableRoll(uid, "rhythm", -4, 4),
      power: technicalBase + stableRoll(uid, "power", -4, 4),
      grace: technicalBase + stableRoll(uid, "grace", -4, 4),
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
      professionalism: base + stableRoll(uid, "professionalism", -2, 5),
      injury_proneness: 4 + stableRoll(uid, "injury_proneness", -2, 4),
      ambition: base + stableRoll(uid, "ambition", -2, 5),
      loyalty: base + stableRoll(uid, "loyalty", -2, 5),
    }),
  };
}

function getOverallRating(attributes) {
  const p = attributes.physical;
  const physicalAvg = (p.strength + p.agility + p.natural_fitness + p.stamina) / 4;
  const appearanceAvg = (attributes.appearance.cute + attributes.appearance.pretty) / 2;
  const t = attributes.technical;
  const technicalAvg = (t.pitch + t.tone + t.breath + t.rhythm + t.power + t.grace) / 6;
  const m = attributes.mental;
  const mentalAvg =
    (m.clever + m.humor + m.talking + m.determination + m.teamwork + m.fashion) / 6;
  return physicalAvg * 0.15 + appearanceAvg * 0.2 + technicalAvg * 0.4 + mentalAvg * 0.25;
}

function getAbility(attributes) {
  const p = attributes.physical;
  const physicalSum = p.strength + p.agility + p.natural_fitness + p.stamina;
  const physicalPart = (physicalSum / 16) * 3;

  const appearanceMax = Math.max(attributes.appearance.cute, attributes.appearance.pretty);
  const appearanceMin = Math.min(attributes.appearance.cute, attributes.appearance.pretty);
  const appearancePart = appearanceMax + appearanceMin / 4;

  const t = attributes.technical;
  const technicalSum = t.pitch + t.tone + t.breath + t.rhythm + t.power + t.grace;
  const technicalPart = technicalSum / 3;

  const m = attributes.mental;
  const mentalSum = m.clever + m.humor + m.talking + m.determination + m.teamwork + m.fashion;
  const mentalPart = mentalSum / 6;

  return Math.floor(physicalPart + appearancePart + technicalPart + mentalPart);
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function pickRelevantMemberships(idol, groupUid, openingIso) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  return hist
    .filter((entry) => entry && entry.group_uid === groupUid)
    .filter((entry) => membershipActiveAtOpening(entry, openingIso) || membershipFutureAtOpening(entry, openingIso))
    .sort((a, b) => {
      const aStart = parseIsoDay(a.start_date) ?? "9999-99-99";
      const bStart = parseIsoDay(b.start_date) ?? "9999-99-99";
      return aStart.localeCompare(bStart);
    });
}

function membershipStatus(relevant, openingIso) {
  if (relevant.some((entry) => membershipActiveAtOpening(entry, openingIso))) return "current";
  if (relevant.some((entry) => membershipFutureAtOpening(entry, openingIso))) return "future";
  return "";
}

const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
const preset = JSON.parse(fs.readFileSync(presetPath, "utf8"));

if (!Array.isArray(groups)) throw new Error("groups.json must be an array");
if (!Array.isArray(idols)) throw new Error("idols.json must be an array");

const openingDate = parseIsoDay(preset.opening_date);
if (!openingDate) throw new Error("scenario6 opening_date is missing or invalid");

const groupsByUid = new Map(groups.map((group) => [group.uid, group]));
const groupPopularity = buildGroupPopularityIndex(groups);

const headers = [
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

const lines = [headers.join(",")];
let rowCount = 0;

TARGET_GROUPS.forEach((target, index) => {
  const group = groupsByUid.get(target.uid);
  if (!group) throw new Error(`Missing target group uid ${target.uid}`);

  const related = idols
    .map((idol) => ({ idol, relevant: pickRelevantMemberships(idol, target.uid, openingDate) }))
    .filter(({ relevant }) => relevant.length > 0)
    .sort((a, b) => {
      const statusA = membershipStatus(a.relevant, openingDate);
      const statusB = membershipStatus(b.relevant, openingDate);
      if (statusA !== statusB) return statusA === "current" ? -1 : 1;
      const firstA = parseIsoDay(a.relevant[0]?.start_date) ?? "9999-99-99";
      const firstB = parseIsoDay(b.relevant[0]?.start_date) ?? "9999-99-99";
      if (firstA !== firstB) return firstA.localeCompare(firstB);
      return String(a.idol.name ?? "").localeCompare(String(b.idol.name ?? ""), "ja");
    });

  for (const { idol, relevant } of related) {
    const attributes = buildAttributesFromFollowerModel(idol, groupPopularity, openingDate);
    const overall = getOverallRating(attributes);
    const ability = getAbility(attributes);
    const row = [
      preset.id,
      openingDate,
      index + 1,
      group.uid,
      group.name,
      group.name_romanji,
      idol.uid,
      idol.name,
      idol.romaji,
      idol.hiragana,
      idol.nickname,
      membershipStatus(relevant, openingDate),
      pipeJoin(relevant.map((entry) => parseIsoDay(entry.start_date) ?? "")),
      pipeJoin(relevant.map((entry) => parseIsoDay(entry.end_date) ?? "")),
      pipeJoin(relevant.map((entry) => normalizeString(entry.member_name))),
      pipeJoin(relevant.map((entry) => normalizeString(entry.member_color))),
      pipeJoin(relevant.map((entry) => normalizeString(entry.member_color_code))),
      pipeJoin(relevant.map((entry) => normalizeString(entry.notes))),
      idol.birthday,
      idol.age,
      idol.height,
      idol.birthplace,
      pipeJoin(idol.languages),
      idol.x_followers,
      idol.wiki_url,
      idol.portrait_photo_path,
      "synthesized_from_follower_model",
      overall.toFixed(2),
      ability,
      attributes.physical.strength,
      attributes.physical.agility,
      attributes.physical.natural_fitness,
      attributes.physical.stamina,
      attributes.appearance.cute,
      attributes.appearance.pretty,
      attributes.technical.pitch,
      attributes.technical.tone,
      attributes.technical.breath,
      attributes.technical.rhythm,
      attributes.technical.power,
      attributes.technical.grace,
      attributes.mental.clever,
      attributes.mental.humor,
      attributes.mental.talking,
      attributes.mental.determination,
      attributes.mental.teamwork,
      attributes.mental.fashion,
      attributes.hidden.professionalism,
      attributes.hidden.injury_proneness,
      attributes.hidden.ambition,
      attributes.hidden.loyalty,
      "",
      "",
    ];
    lines.push(row.map(csvCell).join(","));
    rowCount += 1;
  }
});

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, "\uFEFF" + lines.join("\r\n"), "utf8");
console.log(`Wrote ${rowCount} idol rows to ${path.relative(root, outPath)}`);
