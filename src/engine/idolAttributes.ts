/**
 * Port of idol_producer/idol_attributes.py — visible + hidden attribute buckets, clamp 0–20,
 * overall rating, and official ability formula.
 *
 * When an idol row has no persisted stat block, attributes are synthesized from X followers +
 * current group popularity (same rules as `regenerate_scenario6_attributes_by_followers.ps1`).
 */

import { sha256BytesUtf8 } from "./sha256sync";

export interface PhysicalAttrs {
  strength: number;
  agility: number;
  natural_fitness: number;
  stamina: number;
}

export interface AppearanceAttrs {
  cute: number;
  pretty: number;
}

export interface TechnicalAttrs {
  pitch: number;
  tone: number;
  breath: number;
  rhythm: number;
  power: number;
  grace: number;
}

export interface MentalAttrs {
  clever: number;
  humor: number;
  talking: number;
  determination: number;
  teamwork: number;
  fashion: number;
}

export interface HiddenAttrs {
  professionalism: number;
  injury_proneness: number;
  ambition: number;
  loyalty: number;
}

export interface PersistedIdolAttributes {
  physical: PhysicalAttrs;
  appearance: AppearanceAttrs;
  technical: TechnicalAttrs;
  mental: MentalAttrs;
  hidden?: HiddenAttrs;
}

const clampStat = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

function clampPhysical(p: PhysicalAttrs): PhysicalAttrs {
  return {
    strength: clampStat(p.strength),
    agility: clampStat(p.agility),
    natural_fitness: clampStat(p.natural_fitness),
    stamina: clampStat(p.stamina),
  };
}

function clampAppearance(a: AppearanceAttrs): AppearanceAttrs {
  return { cute: clampStat(a.cute), pretty: clampStat(a.pretty) };
}

function clampTechnical(t: TechnicalAttrs): TechnicalAttrs {
  return {
    pitch: clampStat(t.pitch),
    tone: clampStat(t.tone),
    breath: clampStat(t.breath),
    rhythm: clampStat(t.rhythm),
    power: clampStat(t.power),
    grace: clampStat(t.grace),
  };
}

function clampMental(m: MentalAttrs): MentalAttrs {
  return {
    clever: clampStat(m.clever),
    humor: clampStat(m.humor),
    talking: clampStat(m.talking),
    determination: clampStat(m.determination),
    teamwork: clampStat(m.teamwork),
    fashion: clampStat(m.fashion),
  };
}

function clampHidden(h: HiddenAttrs): HiddenAttrs {
  return {
    professionalism: clampStat(h.professionalism),
    injury_proneness: clampStat(h.injury_proneness),
    ambition: clampStat(h.ambition),
    loyalty: clampStat(h.loyalty),
  };
}

export function defaultAttributes(): PersistedIdolAttributes {
  return {
    physical: clampPhysical({ strength: 12, agility: 12, natural_fitness: 12, stamina: 12 }),
    appearance: clampAppearance({ cute: 12, pretty: 12 }),
    technical: clampTechnical({ pitch: 12, tone: 12, breath: 12, rhythm: 12, power: 12, grace: 12 }),
    mental: clampMental({
      clever: 12,
      humor: 12,
      talking: 12,
      determination: 12,
      teamwork: 12,
      fashion: 12,
    }),
    hidden: clampHidden({ professionalism: 12, injury_proneness: 4, ambition: 12, loyalty: 12 }),
  };
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

/** Merge partial nested dicts from JSON row into persisted shape. */
export function normalizePersistedAttributes(raw: unknown): PersistedIdolAttributes {
  const d = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const phys = (d.physical as Record<string, unknown>) ?? {};
  const app = (d.appearance as Record<string, unknown>) ?? {};
  const tech = (d.technical as Record<string, unknown>) ?? {};
  const ment = (d.mental as Record<string, unknown>) ?? {};
  const hid = (d.hidden as Record<string, unknown>) ?? {};

  return {
    physical: clampPhysical({
      strength: num(phys.strength, 12),
      agility: num(phys.agility, 12),
      natural_fitness: num(phys.natural_fitness, 12),
      stamina: num(phys.stamina, 12),
    }),
    appearance: clampAppearance({
      cute: num(app.cute, 12),
      pretty: num(app.pretty, 12),
    }),
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

/** True when JSON already carries at least one numeric stat (authoritative overlay). */
export function hasPersistedAttributeBlock(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  const d = raw as Record<string, unknown>;
  for (const cat of ["physical", "appearance", "technical", "mental", "hidden"] as const) {
    const block = d[cat];
    if (!block || typeof block !== "object") continue;
    for (const v of Object.values(block as Record<string, unknown>)) {
      if (typeof v === "number" && Number.isFinite(v)) return true;
      if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return true;
    }
  }
  return false;
}

/** Deterministic roll; matches PowerShell `SHA256(UTF8(uid:label))` first four bytes modulo span. */
export function stableRoll(uid: string, label: string, low: number, high: number): number {
  const digest = sha256BytesUtf8(`${uid}:${label}`);
  const raw = ((digest[0] << 24) | (digest[1] << 16) | (digest[2] << 8) | digest[3]) >>> 0;
  const span = high - low + 1;
  return low + (raw % span);
}

function numericMax(record: Record<string, unknown>, keys: string[]): number {
  let max = 0;
  for (const k of keys) {
    const v = record[k];
    if (typeof v === "number" && Number.isFinite(v) && v > max) max = v;
    else if (typeof v === "string" && v.trim() !== "") {
      const n = Number(v);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max;
}

function popularitySignal(value: number, floor = 1000, ceiling = 1_000_000): number {
  if (value <= 0) return 0;
  const low = Math.log10(floor);
  const high = Math.log10(ceiling);
  const signal = (Math.log10(Math.max(value, 1)) - low) / (high - low);
  return Math.max(0, Math.min(1, signal));
}

/** uid / name → max(follower signal, popularity/100) per group row. */
export function buildGroupPopularityIndex(groups: Record<string, unknown>[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const row = g as Record<string, unknown>;
    const followers = numericMax(row, ["x_followers", "x_followers_count", "fans", "fan_count"]);
    const followerSignal = popularitySignal(followers);
    const pop = numericMax(row, ["popularity"]);
    const popSignal = pop > 0 ? Math.max(0, Math.min(1, pop / 100)) : 0;
    const signal = Math.max(followerSignal, popSignal);
    const uid = String(row.uid ?? "").trim();
    const name = String(row.name ?? "").trim();
    for (const key of [uid, name]) {
      if (!key) continue;
      const prev = index.get(key);
      if (prev == null || signal > prev) index.set(key, signal);
    }
  }
  return index;
}

function parseIsoDay(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** Same membership test as desktop script `Test-MembershipActive`. */
function membershipActiveAtOpening(entry: Record<string, unknown>, openingIso: string): boolean {
  const start = parseIsoDay(entry.start_date);
  if (!start || start > openingIso) return false;
  const endRaw = entry.end_date;
  if (endRaw == null || endRaw === "") return true;
  const end = parseIsoDay(endRaw);
  if (!end) return false;
  return openingIso < end;
}

function currentGroupSignal(
  idol: Record<string, unknown>,
  openingIso: string,
  groupPopularity: Map<string, number>,
): number {
  const hist = idol.group_history;
  if (!Array.isArray(hist)) return 0;
  let best = 0;
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (!membershipActiveAtOpening(e, openingIso)) continue;
    for (const key of [String(e.group_uid ?? "").trim(), String(e.group_name ?? "").trim()]) {
      if (!key) continue;
      const s = groupPopularity.get(key);
      if (s != null && s > best) best = s;
    }
  }
  return best;
}

export function buildAttributesFromFollowerModel(
  idol: Record<string, unknown>,
  groupPopularity: Map<string, number>,
  openingIso: string,
): PersistedIdolAttributes {
  const uid = String(idol.uid ?? "unknown");
  const idolSignal = popularitySignal(numericMax(idol, ["x_followers", "x_followers_count"]));
  const groupSignal = currentGroupSignal(idol, openingIso, groupPopularity);
  const combined = Math.max(0, Math.min(1, idolSignal * 0.65 + groupSignal * 0.35));
  const base = 7 + Math.round(combined * 12);
  const portraitPath = idol.portrait_photo_path;
  const portraitBonus =
    typeof portraitPath === "string" && portraitPath.trim().length > 0 ? 1 : 0;
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

export interface AttributeAssignmentContext {
  groups: Record<string, unknown>[];
  referenceIso: string;
}

/** Ensure idol row has `attributes` for save + UI (mutates row). */
export function ensureIdolRowAttributes(
  row: Record<string, unknown>,
  ctx?: Partial<AttributeAssignmentContext>,
): PersistedIdolAttributes {
  if (hasPersistedAttributeBlock(row.attributes)) {
    const normalized = normalizePersistedAttributes(row.attributes);
    row.attributes = normalized;
    return normalized;
  }

  const ref = ctx?.referenceIso;
  const groups = ctx?.groups;
  if (ref && /^\d{4}-\d{2}-\d{2}$/.test(ref) && Array.isArray(groups) && groups.length) {
    const idx = buildGroupPopularityIndex(groups);
    const built = buildAttributesFromFollowerModel(row, idx, ref);
    row.attributes = built;
    return built;
  }

  const fallback = defaultAttributes();
  row.attributes = fallback;
  return fallback;
}

export function applyAttributesToAllIdols(
  idols: Record<string, unknown>[],
  groups?: Record<string, unknown>[],
  referenceIso?: string,
): void {
  const ctx: Partial<AttributeAssignmentContext> = {};
  if (Array.isArray(groups)) ctx.groups = groups;
  if (typeof referenceIso === "string" && referenceIso) ctx.referenceIso = referenceIso;

  for (const row of idols) {
    if (row && typeof row === "object") ensureIdolRowAttributes(row, ctx);
  }
}

export function getOverallRating(a: PersistedIdolAttributes): number {
  const p = a.physical;
  const phAvg = (p.strength + p.agility + p.natural_fitness + p.stamina) / 4;
  const apAvg = (a.appearance.cute + a.appearance.pretty) / 2;
  const t = a.technical;
  const techAvg = (t.pitch + t.tone + t.breath + t.rhythm + t.power + t.grace) / 6;
  const m = a.mental;
  const menAvg = (m.clever + m.humor + m.talking + m.determination + m.teamwork + m.fashion) / 6;
  return phAvg * 0.15 + apAvg * 0.2 + techAvg * 0.4 + menAvg * 0.25;
}

/** Desktop `idol_ui._calculate_radar_dimensions` workbook aggregates (0–20-ish). */
export function getWorkbookRadarDimensions(a: PersistedIdolAttributes): { key: string; value: number }[] {
  const physical = a.physical;
  const appearance = a.appearance;
  const technical = a.technical;
  const mental = a.mental;
  const appearanceHigh = Math.max(appearance.cute, appearance.pretty);
  const appearanceLow = Math.min(appearance.cute, appearance.pretty);
  return [
    { key: "PHY", value: (physical.strength + physical.agility + physical.natural_fitness + physical.stamina) / 4 },
    { key: "APP", value: ((appearanceHigh + appearanceLow / 4) / 5) * 4 },
    { key: "SNG", value: (technical.pitch + technical.tone + technical.breath + technical.rhythm) / 4 },
    { key: "DAN", value: (technical.rhythm + technical.power + technical.grace) / 3 },
    {
      key: "MEN",
      value:
        (mental.clever +
          mental.humor +
          mental.talking +
          mental.determination +
          mental.teamwork +
          mental.fashion) /
        6,
    },
  ];
}

/**
 * Official ability (Python `get_ability`) — note mental sum includes **fashion** in code despite comment.
 */
export function getAbility(a: PersistedIdolAttributes): number {
  const p = a.physical;
  const physicalSum = p.strength + p.agility + p.natural_fitness + p.stamina;
  const physicalPart = (physicalSum / 16) * 3;

  const appearanceMax = Math.max(a.appearance.cute, a.appearance.pretty);
  const appearanceMin = Math.min(a.appearance.cute, a.appearance.pretty);
  const appearancePart = appearanceMax + appearanceMin / 4;

  const t = a.technical;
  const technicalSum = t.pitch + t.tone + t.breath + t.rhythm + t.power + t.grace;
  const technicalPart = technicalSum / 3;

  const m = a.mental;
  const mentalSum = m.clever + m.humor + m.talking + m.determination + m.teamwork + m.fashion;
  const mentalPart = mentalSum / 6;

  return Math.floor(physicalPart + appearancePart + technicalPart + mentalPart);
}
