/**
 * Attribute System V2 — 17 visible attributes (0–20), per master design S3–S6.
 * S3 featured trial uses V2 truth on idol rows; UI shows staff estimates separately.
 */

import type { PersistedIdolAttributes } from "./idolAttributes";
import { sha256BytesUtf8 } from "./sha256sync";

export interface AttributeV2Physical {
  agility: number;
  natural_fitness: number;
  stamina: number;
}

export interface AttributeV2Appearance {
  cute: number;
  pretty: number;
}

export interface AttributeV2Performance {
  pitch: number;
  tone: number;
  breath: number;
  rhythm: number;
  power: number;
  stage_presence: number;
}

export interface AttributeV2Communication {
  wit: number;
  humor: number;
  talking: number;
  teamwork: number;
  fashion: number;
  creativity: number;
}

export interface AttributeV2 {
  physical: AttributeV2Physical;
  appearance: AttributeV2Appearance;
  performance: AttributeV2Performance;
  communication: AttributeV2Communication;
}

export type AttributeV2Key =
  | "agility"
  | "natural_fitness"
  | "stamina"
  | "cute"
  | "pretty"
  | "pitch"
  | "tone"
  | "breath"
  | "rhythm"
  | "power"
  | "stage_presence"
  | "wit"
  | "humor"
  | "talking"
  | "teamwork"
  | "fashion"
  | "creativity";

/** How quickly staff-team estimates can converge (higher = easier to observe). */
export type AttributeObservability = "easy" | "medium" | "hard" | "very_hard";

const OBSERVABILITY: Record<AttributeV2Key, AttributeObservability> = {
  pitch: "easy",
  rhythm: "easy",
  talking: "easy",
  tone: "medium",
  power: "medium",
  agility: "medium",
  cute: "medium",
  pretty: "medium",
  humor: "medium",
  fashion: "medium",
  breath: "hard",
  stamina: "hard",
  wit: "hard",
  stage_presence: "hard",
  creativity: "hard",
  natural_fitness: "very_hard",
  teamwork: "very_hard",
};

const clampStat = (n: number) => Math.max(0, Math.min(20, Math.round(n)));

function stableRoll(seed: string, min: number, max: number): number {
  const bytes = sha256BytesUtf8(seed);
  const u = ((bytes[0] << 8) | bytes[1]) / 0xffff;
  return Math.round(min + u * (max - min));
}

function clampBlock<T extends Record<string, number>>(block: T): T {
  const out = { ...block };
  for (const k of Object.keys(out)) {
    (out as Record<string, number>)[k] = clampStat((out as Record<string, number>)[k]);
  }
  return out;
}

/** Migrate legacy V1 persisted attributes → V2 truth (for synthesis / import). */
export function attributeV2FromV1(v1: PersistedIdolAttributes): AttributeV2 {
  const p = v1.physical;
  const t = v1.technical;
  const m = v1.mental;
  const a = v1.appearance;
  const stage =
    clampStat(Math.round(t.grace * 0.55 + m.clever * 0.25 + t.rhythm * 0.2));
  const wit = clampStat(Math.round(m.clever * 0.7 + m.talking * 0.15 + t.tone * 0.15));
  const creativity = clampStat(Math.round(m.clever * 0.35 + m.fashion * 0.35 + wit * 0.3));
  const teamwork = clampStat(Math.round(m.teamwork * 0.75 + m.determination * 0.25));

  return {
    physical: clampBlock({
      agility: p.agility,
      natural_fitness: p.natural_fitness,
      stamina: p.stamina,
    }),
    appearance: clampBlock({ cute: a.cute, pretty: a.pretty }),
    performance: clampBlock({
      pitch: t.pitch,
      tone: t.tone,
      breath: t.breath,
      rhythm: t.rhythm,
      power: t.power,
      stage_presence: stage,
    }),
    communication: clampBlock({
      wit,
      humor: m.humor,
      talking: m.talking,
      teamwork,
      fashion: m.fashion,
      creativity,
    }),
  };
}

export function getAttributeV2Truth(row: Record<string, unknown>, v1Fallback?: PersistedIdolAttributes): AttributeV2 {
  const raw = row.attributes_v2;
  if (raw && typeof raw === "object") {
    return normalizeAttributeV2(raw as Partial<AttributeV2>);
  }
  if (v1Fallback) return attributeV2FromV1(v1Fallback);
  if (row.attributes && typeof row.attributes === "object") {
    return attributeV2FromV1(row.attributes as PersistedIdolAttributes);
  }
  return defaultAttributeV2(String(row.uid ?? "unknown"));
}

export function defaultAttributeV2(seed: string): AttributeV2 {
  const base = 10 + stableRoll(`v2|${seed}|base`, -2, 4);
  return {
    physical: clampBlock({
      agility: base + stableRoll(`v2|${seed}|agility`, -3, 3),
      natural_fitness: base + stableRoll(`v2|${seed}|nf`, -2, 4),
      stamina: base + stableRoll(`v2|${seed}|stamina`, -3, 3),
    }),
    appearance: clampBlock({
      cute: base + stableRoll(`v2|${seed}|cute`, -2, 4),
      pretty: base + stableRoll(`v2|${seed}|pretty`, -2, 4),
    }),
    performance: clampBlock({
      pitch: base + stableRoll(`v2|${seed}|pitch`, -3, 4),
      tone: base + stableRoll(`v2|${seed}|tone`, -3, 3),
      breath: base + stableRoll(`v2|${seed}|breath`, -4, 3),
      rhythm: base + stableRoll(`v2|${seed}|rhythm`, -3, 4),
      power: base + stableRoll(`v2|${seed}|power`, -3, 3),
      stage_presence: base + stableRoll(`v2|${seed}|stage`, -4, 4),
    }),
    communication: clampBlock({
      wit: base + stableRoll(`v2|${seed}|wit`, -4, 3),
      humor: base + stableRoll(`v2|${seed}|humor`, -3, 4),
      talking: base + stableRoll(`v2|${seed}|talking`, -2, 4),
      teamwork: base + stableRoll(`v2|${seed}|team`, -4, 3),
      fashion: base + stableRoll(`v2|${seed}|fashion`, -3, 3),
      creativity: base + stableRoll(`v2|${seed}|creativity`, -4, 3),
    }),
  };
}

export function normalizeAttributeV2(raw: Partial<AttributeV2>): AttributeV2 {
  const num = (v: unknown, fb: number) =>
    typeof v === "number" && Number.isFinite(v) ? clampStat(v) : clampStat(fb);
  const p = raw.physical ?? {};
  const ap = raw.appearance ?? {};
  const perf = raw.performance ?? {};
  const comm = raw.communication ?? {};
  return {
    physical: clampBlock({
      agility: num(p.agility, 12),
      natural_fitness: num(p.natural_fitness, 12),
      stamina: num(p.stamina, 12),
    }),
    appearance: clampBlock({
      cute: num(ap.cute, 12),
      pretty: num(ap.pretty, 12),
    }),
    performance: clampBlock({
      pitch: num(perf.pitch, 12),
      tone: num(perf.tone, 12),
      breath: num(perf.breath, 12),
      rhythm: num(perf.rhythm, 12),
      power: num(perf.power, 12),
      stage_presence: num(perf.stage_presence, 12),
    }),
    communication: clampBlock({
      wit: num(comm.wit, 12),
      humor: num(comm.humor, 12),
      talking: num(comm.talking, 12),
      teamwork: num(comm.teamwork, 12),
      fashion: num(comm.fashion, 12),
      creativity: num(comm.creativity, 12),
    }),
  };
}

export function attributeV2Value(attrs: AttributeV2, key: AttributeV2Key): number {
  if (key === "agility" || key === "natural_fitness" || key === "stamina") return attrs.physical[key];
  if (key === "cute" || key === "pretty") return attrs.appearance[key];
  if (
    key === "pitch" ||
    key === "tone" ||
    key === "breath" ||
    key === "rhythm" ||
    key === "power" ||
    key === "stage_presence"
  ) {
    return attrs.performance[key];
  }
  return attrs.communication[key];
}

export function observabilityFor(key: AttributeV2Key): AttributeObservability {
  return OBSERVABILITY[key];
}

/** Initial estimate spread half-width from observability at confidence 0. */
export function baseSpreadFor(key: AttributeV2Key): number {
  switch (OBSERVABILITY[key]) {
    case "easy":
      return 2;
    case "medium":
      return 3;
    case "hard":
      return 4;
    case "very_hard":
      return 5;
  }
}

export function allAttributeV2Keys(): AttributeV2Key[] {
  return Object.keys(OBSERVABILITY) as AttributeV2Key[];
}
