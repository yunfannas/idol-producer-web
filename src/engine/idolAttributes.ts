/**
 * Port of idol_producer/idol_attributes.py — visible + hidden attribute buckets, clamp 0–20,
 * overall rating, and official ability formula.
 *
 * When an idol row has no persisted stat block, attributes are synthesized from X followers +
 * current group popularity (same rules as `regenerate_scenario6_attributes_by_followers.ps1`).
 */

import {
  MEMBER_ROLE_DEFINITIONS,
  activeRoleAssignmentsFromHistoryEntry,
  type MemberRoleAssignment,
} from "../data/memberRoles";
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

export interface RoleAttributeModel {
  version?: number;
  roles?: string[];
  age_features?: string[];
  feature_names?: string[];
  coefficients?: Record<string, Record<string, number>>;
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

/** Equal weight: individual X alone must not dominate a low-tier group's ability band. */
const IDOL_SIGNAL_WEIGHT = 0.5;
const GROUP_SIGNAL_WEIGHT = 0.5;

/**
 * Soft ceiling on the follower/group blend by letter tier.
 * Fitted so viral outliers in low-tier groups (e.g. #2i2 / D) stay near the
 * curated D/C manual bands (アキシブ / 高嶺のなでしこ), while A/S can still top out.
 */
const LETTER_TIER_COMBINED_CAP: Record<string, number> = {
  S: 1,
  A: 0.95,
  B: 0.86,
  C: 0.75,
  D: 0.55,
  E: 0.46,
  I: 0.34,
};

function combinedPopularitySignal(idolSignal: number, groupSignal: number, letterTier?: string | null): number {
  let combined = idolSignal * IDOL_SIGNAL_WEIGHT + groupSignal * GROUP_SIGNAL_WEIGHT;
  const tier = String(letterTier ?? "")
    .trim()
    .toUpperCase();
  const cap = LETTER_TIER_COMBINED_CAP[tier];
  if (typeof cap === "number") combined = Math.min(combined, cap);
  return Math.max(0, Math.min(1, combined));
}

/**
 * Within an active group, higher personal X should usually mean higher ability.
 * Returns a base-stat delta in about [-2, +2] from roster X percentile.
 */
export function buildWithinGroupXRankBoosts(
  idols: Record<string, unknown>[],
  groups: Record<string, unknown>[],
  openingIso: string,
): Map<string, number> {
  const boosts = new Map<string, number>();
  if (!Array.isArray(idols) || !Array.isArray(groups) || !/^\d{4}-\d{2}-\d{2}$/.test(openingIso)) {
    return boosts;
  }

  const idolsByUid = new Map<string, Record<string, unknown>>();
  for (const idol of idols) {
    const uid = String(idol?.uid ?? "").trim();
    if (uid) idolsByUid.set(uid, idol);
  }

  const applyRoster = (roster: { uid: string; x: number }[]) => {
    if (roster.length < 2) return;
    const sorted = [...roster].sort((a, b) => a.x - b.x || a.uid.localeCompare(b.uid));
    const denom = sorted.length - 1;
    for (let i = 0; i < sorted.length; i += 1) {
      const percentile = i / denom; // 0 = lowest X, 1 = highest X
      const delta = Math.round((percentile - 0.5) * 4); // -2 .. +2
      const prev = boosts.get(sorted[i].uid) ?? 0;
      if (Math.abs(delta) >= Math.abs(prev)) boosts.set(sorted[i].uid, delta);
    }
  };

  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    const memberUids = Array.isArray((group as { member_uids?: unknown }).member_uids)
      ? ((group as { member_uids: unknown[] }).member_uids as unknown[])
      : [];
    const roster: { uid: string; x: number }[] = [];
    for (const rawUid of memberUids) {
      const uid = String(rawUid ?? "").trim();
      const idol = idolsByUid.get(uid);
      if (!idol) continue;
      const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
      const groupUid = String((group as { uid?: unknown }).uid ?? "").trim();
      const groupName = String((group as { name?: unknown }).name ?? "").trim();
      const activeHere = hist.some((raw) => {
        if (!raw || typeof raw !== "object") return false;
        const e = raw as Record<string, unknown>;
        if (!membershipActiveAtOpening(e, openingIso)) return false;
        const eUid = String(e.group_uid ?? "").trim();
        const eName = String(e.group_name ?? "").trim();
        return (groupUid && eUid === groupUid) || (groupName && eName === groupName);
      });
      if (!activeHere) continue;
      roster.push({ uid, x: numericMax(idol, ["x_followers", "x_followers_count"]) });
    }
    applyRoster(roster);
  }

  return boosts;
}

/** uid / name → max(fan signal, popularity/100) per group row.
 * Uses fans/popularity only — not group X. Official/group X accounts are often
 * far above true fan scale and were letting B-tier idols outrank A-tier tops.
 */
export function buildGroupPopularityIndex(groups: Record<string, unknown>[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const row = g as Record<string, unknown>;
    const fans = numericMax(row, ["fans", "fan_count"]);
    const followerSignal = popularitySignal(fans);
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

/** uid / name → letter_tier (S–I) from group rows. */
export function buildGroupLetterTierIndex(groups: Record<string, unknown>[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const row = g as Record<string, unknown>;
    const tier = String(row.letter_tier ?? "")
      .trim()
      .toUpperCase();
    if (!tier) continue;
    const uid = String(row.uid ?? "").trim();
    const name = String(row.name ?? "").trim();
    for (const key of [uid, name]) {
      if (!key) continue;
      index.set(key, tier);
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

/** Tenure that already ended on/before the reference date (eligible as "last group"). */
function membershipEndedByOpening(entry: Record<string, unknown>, openingIso: string): boolean {
  const start = parseIsoDay(entry.start_date);
  if (!start || start > openingIso) return false;
  const end = parseIsoDay(entry.end_date);
  if (!end) return false;
  return end <= openingIso;
}

function groupKeysFromEntry(entry: Record<string, unknown>): string[] {
  return [String(entry.group_uid ?? "").trim(), String(entry.group_name ?? "").trim()].filter(Boolean);
}

function signalFromEntry(
  entry: Record<string, unknown>,
  groupPopularity: Map<string, number>,
  groupLetterTiers?: Map<string, string>,
): { signal: number; letterTier: string | null } {
  let signal = 0;
  let letterTier: string | null = null;
  for (const key of groupKeysFromEntry(entry)) {
    const s = groupPopularity.get(key);
    if (s == null || s < signal) continue;
    signal = s;
    letterTier = groupLetterTiers?.get(key) ?? letterTier;
  }
  return { signal, letterTier };
}

/**
 * Active group at reference date, else most recently ended group.
 * Solo / between-groups idols keep a group-follower floor from their last unit.
 */
function currentGroupContext(
  idol: Record<string, unknown>,
  openingIso: string,
  groupPopularity: Map<string, number>,
  groupLetterTiers?: Map<string, string>,
): { signal: number; letterTier: string | null } {
  const hist = idol.group_history;
  if (!Array.isArray(hist)) return { signal: 0, letterTier: null };

  let hasActive = false;
  let bestActive = 0;
  let activeTier: string | null = null;
  let latestPast: { end: string; start: string; signal: number; letterTier: string | null } | null = null;

  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (membershipActiveAtOpening(e, openingIso)) {
      hasActive = true;
      const hit = signalFromEntry(e, groupPopularity, groupLetterTiers);
      if (hit.signal >= bestActive) {
        bestActive = hit.signal;
        activeTier = hit.letterTier ?? activeTier;
      }
      continue;
    }
    if (!membershipEndedByOpening(e, openingIso)) continue;
    const end = parseIsoDay(e.end_date);
    const start = parseIsoDay(e.start_date);
    if (!end || !start) continue;
    const hit = signalFromEntry(e, groupPopularity, groupLetterTiers);
    if (
      !latestPast ||
      end > latestPast.end ||
      (end === latestPast.end && start > latestPast.start)
    ) {
      latestPast = { end, start, signal: hit.signal, letterTier: hit.letterTier };
    }
  }

  if (hasActive) {
    return { signal: bestActive, letterTier: activeTier };
  }
  if (latestPast) {
    return { signal: latestPast.signal, letterTier: latestPast.letterTier };
  }
  return { signal: 0, letterTier: null };
}

function currentGroupSignal(
  idol: Record<string, unknown>,
  openingIso: string,
  groupPopularity: Map<string, number>,
): number {
  return currentGroupContext(idol, openingIso, groupPopularity).signal;
}

function scandalHistoryCount(idol: Record<string, unknown>): number {
  let count = 0;
  const top = Array.isArray(idol.status_history) ? idol.status_history : [];
  for (const raw of top) {
    if (!raw || typeof raw !== "object") continue;
    if (String((raw as Record<string, unknown>).kind ?? "").trim().toLowerCase() === "scandal") count += 1;
  }
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const statuses = (raw as Record<string, unknown>).status_history;
    if (!Array.isArray(statuses)) continue;
    for (const s of statuses) {
      if (!s || typeof s !== "object") continue;
      if (String((s as Record<string, unknown>).kind ?? "").trim().toLowerCase() === "scandal") count += 1;
    }
  }
  return count;
}

function numericValue(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))) return Number(raw);
  return null;
}

function ageAtOpening(idol: Record<string, unknown>, openingIso: string): number | null {
  const birthday = parseIsoDay(idol.birthday);
  if (birthday) {
    const [by, bm, bd] = birthday.split("-").map(Number);
    const [oy, om, od] = openingIso.split("-").map(Number);
    let age = oy - by;
    if (om < bm || (om === bm && od < bd)) age -= 1;
    if (Number.isFinite(age) && age >= 0 && age <= 80) return age;
  }
  const age = numericValue(idol.age);
  return age != null && age >= 0 && age <= 80 ? age : null;
}

function ageFeatureVector(age: number | null): Record<string, number> {
  const safeAge = typeof age === "number" && Number.isFinite(age) ? age : 22;
  return {
    age_youth: Math.max(0, Math.min(1, (22 - safeAge) / 6)),
    age_experience: Math.max(0, Math.min(1, (safeAge - 18) / 10)),
    age_senior: Math.max(0, Math.min(1, (safeAge - 25) / 10)),
  };
}

function collectActiveRoleAssignments(
  idol: Record<string, unknown>,
  openingIso: string,
): MemberRoleAssignment[] {
  const hist = idol.group_history;
  if (!Array.isArray(hist)) return [];
  const byKey = new Map<string, MemberRoleAssignment>();
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (!membershipActiveAtOpening(entry, openingIso)) continue;
    for (const role of activeRoleAssignmentsFromHistoryEntry(entry, openingIso)) {
      if (!role.key) continue;
      const prev = byKey.get(role.key);
      if (!prev || role.focus > prev.focus) byKey.set(role.key, role);
    }
  }
  return [...byKey.values()].sort((a, b) => b.focus - a.focus || a.key.localeCompare(b.key));
}

function applyRoleBiasToAttributes(
  baseAttrs: PersistedIdolAttributes,
  roles: MemberRoleAssignment[],
  ageFeatures?: Record<string, number>,
  model?: RoleAttributeModel | null,
): PersistedIdolAttributes {
  if (!roles.length && !model?.coefficients) return baseAttrs;

  const next: PersistedIdolAttributes = {
    physical: { ...baseAttrs.physical },
    appearance: { ...baseAttrs.appearance },
    technical: { ...baseAttrs.technical },
    mental: { ...baseAttrs.mental },
    hidden: { ...(baseAttrs.hidden ?? defaultAttributes().hidden!) },
  };

  const roleBiasScalar = 3;

  if (model?.coefficients) {
    const features: Record<string, number> = { ...(ageFeatures ?? {}) };
    for (const role of roles) {
      features[role.key] = Math.max(features[role.key] ?? 0, Math.max(0, Math.min(1, role.focus)));
    }
    for (const [statPath, featureWeights] of Object.entries(model.coefficients)) {
      const [categoryKey, statKey] = statPath.split(".");
      const category = next[categoryKey as keyof PersistedIdolAttributes];
      if (!category || typeof category !== "object" || !statKey) continue;
      const stats = category as unknown as Record<string, unknown>;
      let value = typeof stats[statKey] === "number" && Number.isFinite(stats[statKey]) ? (stats[statKey] as number) : 12;
      for (const [featureKey, featureValue] of Object.entries(features)) {
        const weight = featureWeights?.[featureKey];
        if (!(typeof weight === "number" && Number.isFinite(weight))) continue;
        value += weight * featureValue;
      }
      stats[statKey] = value;
    }
  } else {
    for (const role of roles) {
      const focus = Math.max(0, Math.min(1, role.focus));
      const definition = MEMBER_ROLE_DEFINITIONS[role.key as keyof typeof MEMBER_ROLE_DEFINITIONS];
      if (!definition) continue;
      for (const [categoryKey, categoryBias] of Object.entries(definition.attributeBias)) {
        const category = next[categoryKey as keyof PersistedIdolAttributes];
        if (!category || typeof category !== "object") continue;
        const stats = category as unknown as Record<string, unknown>;
        for (const [statKey, weightRaw] of Object.entries(categoryBias as Record<string, unknown>)) {
          const weight = typeof weightRaw === "number" && Number.isFinite(weightRaw) ? weightRaw : 0;
          const prev = stats[statKey];
          const prevNum = typeof prev === "number" && Number.isFinite(prev) ? prev : 12;
          stats[statKey] = prevNum + weight * focus * roleBiasScalar;
        }
      }
    }
  }

  return {
    physical: clampPhysical(next.physical),
    appearance: clampAppearance(next.appearance),
    technical: clampTechnical(next.technical),
    mental: clampMental(next.mental),
    hidden: clampHidden(next.hidden ?? defaultAttributes().hidden!),
  };
}

/**
 * Soft age ceilings for appearance:
 * - over 25: cute above 15 is hard (generation soft-caps at 15)
 * - under 20: pretty above 15 is hard (generation soft-caps at 15)
 * Manual curated rows are not rewritten by this helper.
 */
export function applyAgeAppearanceConstraints(
  attrs: PersistedIdolAttributes,
  age: number | null,
): PersistedIdolAttributes {
  if (age == null || !Number.isFinite(age)) return attrs;
  let cute = attrs.appearance.cute;
  let pretty = attrs.appearance.pretty;
  if (age > 25 && cute > 15) {
    // Keep a tiny overflow so exceptional cases can still land at 16.
    cute = Math.min(16, 15 + Math.max(0, Math.round((cute - 15) * 0.2)));
  }
  if (age < 20 && pretty > 15) {
    pretty = Math.min(16, 15 + Math.max(0, Math.round((pretty - 15) * 0.2)));
  }
  if (cute === attrs.appearance.cute && pretty === attrs.appearance.pretty) return attrs;
  return {
    ...attrs,
    appearance: clampAppearance({ cute, pretty }),
  };
}

/**
 * Generated ability ceilings by letter tier.
 * Anchored to curated manuals (=LOVE tops stay above A-generated; iLiFE / 高嶺 / アキシブ maxima).
 */
const LETTER_TIER_ABILITY_CAP: Record<string, number> = {
  S: 93,
  A: 88,
  B: 85,
  C: 82,
  D: 77,
  E: 70,
  I: 65,
};

function scaleVisibleAttributes(attrs: PersistedIdolAttributes, scale: number): PersistedIdolAttributes {
  const scaleStat = (value: number) => clampStat(12 + (value - 12) * scale);
  return {
    physical: clampPhysical({
      strength: scaleStat(attrs.physical.strength),
      agility: scaleStat(attrs.physical.agility),
      natural_fitness: scaleStat(attrs.physical.natural_fitness),
      stamina: scaleStat(attrs.physical.stamina),
    }),
    appearance: clampAppearance({
      cute: scaleStat(attrs.appearance.cute),
      pretty: scaleStat(attrs.appearance.pretty),
    }),
    technical: clampTechnical({
      pitch: scaleStat(attrs.technical.pitch),
      tone: scaleStat(attrs.technical.tone),
      breath: scaleStat(attrs.technical.breath),
      rhythm: scaleStat(attrs.technical.rhythm),
      power: scaleStat(attrs.technical.power),
      grace: scaleStat(attrs.technical.grace),
    }),
    mental: clampMental({
      clever: scaleStat(attrs.mental.clever),
      humor: scaleStat(attrs.mental.humor),
      talking: scaleStat(attrs.mental.talking),
      determination: scaleStat(attrs.mental.determination),
      teamwork: scaleStat(attrs.mental.teamwork),
      fashion: scaleStat(attrs.mental.fashion),
    }),
    hidden: attrs.hidden ? clampHidden({ ...attrs.hidden }) : attrs.hidden,
  };
}

const VISIBLE_STAT_PATHS = [
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
] as const;

/** Move official ability by ~1 via single-stat steps (all-stat ±1 jumps ~5). */
function adjustAbilityToward(
  attrs: PersistedIdolAttributes,
  targetAbility: number,
  direction: 1 | -1,
): PersistedIdolAttributes {
  let current = normalizePersistedAttributes(attrs);
  const goal = Math.floor(targetAbility);
  for (let step = 0; step < 240; step += 1) {
    const ab = getAbility(current);
    if (direction > 0 && ab >= goal) return current;
    if (direction < 0 && ab <= goal) return current;

    const startRaw = getAbilityRaw(current);
    let moved = false;
    for (let i = 0; i < VISIBLE_STAT_PATHS.length; i += 1) {
      const [cat, key] = VISIBLE_STAT_PATHS[(step + i) % VISIBLE_STAT_PATHS.length];
      const block = { ...(current[cat] as Record<string, number>) };
      const nextVal = clampStat(block[key] + direction);
      if (nextVal === block[key]) continue;
      block[key] = nextVal;
      const candidate: PersistedIdolAttributes = {
        ...current,
        [cat]:
          cat === "physical"
            ? clampPhysical(block as PersistedIdolAttributes["physical"])
            : cat === "appearance"
              ? clampAppearance(block as PersistedIdolAttributes["appearance"])
              : cat === "technical"
                ? clampTechnical(block as PersistedIdolAttributes["technical"])
                : clampMental(block as PersistedIdolAttributes["mental"]),
      };
      const nextRaw = getAbilityRaw(candidate);
      if (direction > 0 && nextRaw > startRaw + 1e-9) {
        current = candidate;
        moved = true;
        break;
      }
      if (direction < 0 && nextRaw < startRaw - 1e-9) {
        current = candidate;
        moved = true;
        break;
      }
    }
    if (!moved) break;
  }
  return current;
}

/** Pull generated stats down so official ability does not exceed a tier soft-cap. */
export function fitAttributesToAbilityCap(
  attrs: PersistedIdolAttributes,
  letterTier?: string | null,
): PersistedIdolAttributes {
  const tier = String(letterTier ?? "")
    .trim()
    .toUpperCase();
  const cap = LETTER_TIER_ABILITY_CAP[tier];
  if (typeof cap !== "number") return attrs;
  if (getAbility(attrs) <= cap) return attrs;

  let lo = 0;
  let hi = 1;
  let best = scaleVisibleAttributes(attrs, 0.85);
  for (let i = 0; i < 24; i += 1) {
    const mid = (lo + hi) / 2;
    const scaled = scaleVisibleAttributes(attrs, mid);
    if (getAbility(scaled) > cap) {
      hi = mid;
    } else {
      lo = mid;
      best = scaled;
    }
  }
  return best;
}

export function buildAttributesFromFollowerModel(
  idol: Record<string, unknown>,
  groupPopularity: Map<string, number>,
  openingIso: string,
  roleAttributeModel?: RoleAttributeModel | null,
  groupLetterTiers?: Map<string, string>,
  withinGroupXBoosts?: Map<string, number>,
): PersistedIdolAttributes {
  const uid = String(idol.uid ?? "unknown");
  const idolSignal = popularitySignal(numericMax(idol, ["x_followers", "x_followers_count"]));
  const { signal: groupSignal, letterTier } = currentGroupContext(
    idol,
    openingIso,
    groupPopularity,
    groupLetterTiers,
  );
  const withinBoost = withinGroupXBoosts?.get(String(idol.uid ?? "").trim()) ?? 0;
  const combined = combinedPopularitySignal(idolSignal, groupSignal, letterTier);
  // OLS on curated manuals (=LOVE / iLiFE! / 高嶺のなでしこ / アキシブ):
  // ability ≈ 62.8 + 25.7 * combined ≈ 5 * (12.5 + 5.2 * combined).
  const base = Math.max(
    1,
    Math.min(19, Math.round(12.5 + combined * 5.2) + Math.round(withinBoost)),
  );
  const scandalCount = scandalHistoryCount(idol);
  const portraitPath = idol.portrait_photo_path;
  const portraitBonus =
    typeof portraitPath === "string" && portraitPath.trim().length > 0 ? 1 : 0;
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
  // Bias the appearance seed itself so younger idols lean cute and older lean pretty
  // before rolls / role model push values around.
  let cuteSeed = appearanceBase;
  let prettySeed = appearanceBase;
  if (age != null) {
    if (age > 25) cuteSeed = Math.min(cuteSeed, 14);
    if (age < 20) prettySeed = Math.min(prettySeed, 14);
    if (age >= 26) prettySeed += 1;
    if (age <= 19) cuteSeed += 1;
  }
  const baseline: PersistedIdolAttributes = {
    physical: clampPhysical({
      // Manual calibration set suggests dance-heavy idols tend to carry some extra physicality.
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
      // Use shared vocal / dance cores so singing and dancing usually move together,
      // matching the manually tuned reference rows more closely than six independent rolls.
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
      professionalism:
        professionalismBase + stableRoll(uid, "professionalism", -2, 3) - professionalismPenalty,
      injury_proneness: injuryBase + stableRoll(uid, "injury_proneness", -1, 4) + Math.min(2, scandalCount),
      ambition: base + stableRoll(uid, "ambition", -2, 5),
      loyalty: base + stableRoll(uid, "loyalty", -2, 5) - loyaltyPenalty,
    }),
  };
  const activeRoles = collectActiveRoleAssignments(idol, openingIso);
  const ageFeatures = ageFeatureVector(age);
  const withRoles = applyRoleBiasToAttributes(baseline, activeRoles, ageFeatures, roleAttributeModel);
  const withAge = applyAgeAppearanceConstraints(withRoles, age);
  return fitAttributesToAbilityCap(withAge, letterTier);
}

export interface AttributeAssignmentContext {
  groups: Record<string, unknown>[];
  referenceIso: string;
  roleAttributeModel?: RoleAttributeModel | null;
  /** Full idol list — used to rank personal X within each active group. */
  idols?: Record<string, unknown>[];
  withinGroupXBoosts?: Map<string, number>;
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
    const tiers = buildGroupLetterTierIndex(groups);
    const withinBoosts =
      ctx?.withinGroupXBoosts ??
      (Array.isArray(ctx?.idols)
        ? buildWithinGroupXRankBoosts(ctx.idols, groups, ref)
        : undefined);
    const built = buildAttributesFromFollowerModel(
      row,
      idx,
      ref,
      ctx?.roleAttributeModel ?? null,
      tiers,
      withinBoosts,
    );
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
  roleAttributeModel?: RoleAttributeModel | null,
): void {
  const ctx: Partial<AttributeAssignmentContext> = {};
  if (Array.isArray(groups)) ctx.groups = groups;
  if (typeof referenceIso === "string" && referenceIso) ctx.referenceIso = referenceIso;
  if (roleAttributeModel) ctx.roleAttributeModel = roleAttributeModel;
  ctx.idols = idols;
  if (Array.isArray(groups) && typeof referenceIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceIso)) {
    ctx.withinGroupXBoosts = buildWithinGroupXRankBoosts(idols, groups, referenceIso);
  }

  for (const row of idols) {
    if (row && typeof row === "object") ensureIdolRowAttributes(row, ctx);
  }

  if (Array.isArray(groups) && typeof referenceIso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(referenceIso)) {
    reconcileGeneratedAbilityOrderByX(idols, groups, referenceIso);
  }
}

/**
 * Soft fix: among generated members of one group, higher personal X should not
 * end below a lower-X teammate after rolls / tier caps.
 *
 * Idols with concurrent memberships are only ordered in their primary group
 * (highest group popularity among active tenures) so multi-group reconcile
 * cannot tug the same ability both ways.
 */
export function reconcileGeneratedAbilityOrderByX(
  idols: Record<string, unknown>[],
  groups: Record<string, unknown>[],
  openingIso: string,
): void {
  const idolsByUid = new Map<string, Record<string, unknown>>();
  for (const idol of idols) {
    const uid = String(idol?.uid ?? "").trim();
    if (uid) idolsByUid.set(uid, idol);
  }

  const groupPopularity = buildGroupPopularityIndex(groups);
  const primaryByIdolUid = new Map<string, { uid: string; name: string }>();
  for (const idol of idols) {
    const uid = String(idol?.uid ?? "").trim();
    if (!uid) continue;
    const primary = primaryActiveGroup(idol, openingIso, groupPopularity);
    if (primary) primaryByIdolUid.set(uid, primary);
  }

  for (const group of groups) {
    if (!group || typeof group !== "object") continue;
    reconcileOneGroupAbilityByX(group, idolsByUid, openingIso, primaryByIdolUid);
  }
}

function primaryActiveGroup(
  idol: Record<string, unknown>,
  openingIso: string,
  groupPopularity: Map<string, number>,
): { uid: string; name: string } | null {
  let best: { uid: string; name: string; signal: number } | null = null;
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (!membershipActiveAtOpening(entry, openingIso)) continue;
    const uid = String(entry.group_uid ?? "").trim();
    const name = String(entry.group_name ?? "").trim();
    if (!uid && !name) continue;
    const { signal } = signalFromEntry(entry, groupPopularity);
    if (!best || signal > best.signal) best = { uid, name, signal };
  }
  return best ? { uid: best.uid, name: best.name } : null;
}

function reconcileOneGroupAbilityByX(
  group: Record<string, unknown>,
  idolsByUid: Map<string, Record<string, unknown>>,
  openingIso: string,
  primaryByIdolUid: Map<string, { uid: string; name: string }>,
): void {
  const memberUids = Array.isArray(group.member_uids) ? (group.member_uids as unknown[]) : [];
  const tier = String(group.letter_tier ?? "")
    .trim()
    .toUpperCase();
  const groupUid = String(group.uid ?? "").trim();
  const groupName = String(group.name ?? "").trim();
  const roster: Record<string, unknown>[] = [];
  for (const rawUid of memberUids) {
    const uid = String(rawUid ?? "").trim();
    const idol = idolsByUid.get(uid);
    if (!idol || !hasPersistedAttributeBlock(idol.attributes)) continue;
    const origin = String(idol.attributes_origin ?? "").trim();
    // Only reorder freshly generated rows; manuals stay authoritative.
    if (origin === "manual") continue;
    const primary = primaryByIdolUid.get(uid);
    if (primary) {
      const primaryHere =
        (groupUid && primary.uid === groupUid) || (groupName && primary.name === groupName);
      if (!primaryHere) continue;
    }
    const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
    const activeHere = hist.some((raw) => {
      if (!raw || typeof raw !== "object") return false;
      const e = raw as Record<string, unknown>;
      if (!membershipActiveAtOpening(e, openingIso)) return false;
      const eUid = String(e.group_uid ?? "").trim();
      const eName = String(e.group_name ?? "").trim();
      return (groupUid && eUid === groupUid) || (groupName && eName === groupName);
    });
    if (!activeHere) continue;
    roster.push(idol);
  }
  if (roster.length < 2) return;

  roster.sort((a, b) => {
    const dx =
      numericMax(b, ["x_followers", "x_followers_count"]) - numericMax(a, ["x_followers", "x_followers_count"]);
    if (dx !== 0) return dx;
    return String(a.uid ?? "").localeCompare(String(b.uid ?? ""));
  });

  // Left-to-right isotonic along X-desc (uid tiebreak): try raise the left
  // neighbor up to tier cap, otherwise lower the right idol. Enforce even on
  // equal-X ties so non-adjacent strict-X pairs cannot invert through a tie.
  const tierCap = LETTER_TIER_ABILITY_CAP[tier] ?? 88;
  for (let pass = 0; pass < 12; pass += 1) {
    let changed = false;
    for (let i = 1; i < roster.length; i += 1) {
      const higherX = roster[i - 1];
      const lowerX = roster[i];

      let hiAttrs = normalizePersistedAttributes(higherX.attributes);
      let loAttrs = normalizePersistedAttributes(lowerX.attributes);
      const loAb = getAbility(loAttrs);
      const hiAb = getAbility(hiAttrs);
      if (hiAb >= loAb) continue;

      const raiseTarget = Math.min(loAb, tierCap);
      if (hiAb < raiseTarget) {
        const raised = adjustAbilityToward(hiAttrs, raiseTarget, 1);
        if (getAbility(raised) > getAbility(hiAttrs)) {
          hiAttrs = raised;
          higherX.attributes = hiAttrs;
          changed = true;
        }
      }

      if (getAbility(hiAttrs) < getAbility(loAttrs)) {
        const lowered = adjustAbilityToward(loAttrs, getAbility(hiAttrs), -1);
        if (getAbility(lowered) < getAbility(loAttrs)) {
          lowerX.attributes = lowered;
          changed = true;
        }
      }
    }
    if (!changed) break;
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
export function getAbilityRaw(a: PersistedIdolAttributes): number {
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

  return physicalPart + appearancePart + technicalPart + mentalPart;
}

export function getAbility(a: PersistedIdolAttributes): number {
  return Math.floor(getAbilityRaw(a));
}
