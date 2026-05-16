/**
 * Subset of idol_producer/idol_status_system.py for JSON idol rows in web saves:
 * training week log, training load, daily condition/morale from training + lives.
 */

import { normalizePersistedAttributes } from "./idolAttributes";

export const LIGHT_LIVE_EQ_MINUTES = 30;
export const WEEKLY_TRAINING_LOG_LIMIT = 21;
export const MAX_TRAINING_LOAD = 20;
export const BASE_2H_LIVE_CONDITION_COST = 40;
export const BASE_4H_TRAINING_CONDITION_COST = 10;
export const REHEARSAL_LIVE_COST_RATIO = 1 / 3;
export const TRAINING_LEVEL_HOURS_PER_WEEK = 4;
export const TRAINING_SESSION_HOURS = 4;

export interface TrainingIntensityRow {
  sing: number;
  dance: number;
  physical: number;
  target: number;
}

export interface TrainingLogRow {
  date: string;
  training: TrainingIntensityRow;
  training_hours?: number;
  training_sessions?: string[];
  live_count: number;
  live_minutes: number;
  focus_skill: string;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, Math.trunc(n)));
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

export function safeTrainingRow(raw: unknown): TrainingIntensityRow {
  const clean: TrainingIntensityRow = { sing: 0, dance: 0, physical: 0, target: 0 };
  if (!raw || typeof raw !== "object") return clean;
  const d = raw as Record<string, unknown>;
  for (const key of ["sing", "dance", "physical", "target"] as const) {
    try {
      clean[key] = clampInt(Number(d[key] ?? 0), 0, 5);
    } catch {
      clean[key] = 0;
    }
  }
  return clean;
}

export function trainingLoadFromRow(row: TrainingIntensityRow): number {
  return Math.min(MAX_TRAINING_LOAD, row.sing + row.dance + row.physical + row.target);
}

export function normalizeTrainingWeekLog(raw: unknown): Record<string, TrainingLogRow[]> {
  const out: Record<string, TrainingLogRow[]> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [uid, rows] of Object.entries(raw as Record<string, unknown>)) {
    if (!Array.isArray(rows)) continue;
    const cleanRows: TrainingLogRow[] = [];
    const slice = rows.slice(-WEEKLY_TRAINING_LOG_LIMIT);
    for (const row of slice) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      cleanRows.push({
        date: String(r.date ?? ""),
        training: safeTrainingRow(r.training),
        training_hours: Math.max(0, num(r.training_hours, 0)),
        training_sessions: Array.isArray(r.training_sessions) ? r.training_sessions.map((x) => String(x)) : [],
        live_count: Math.max(0, num(r.live_count, 0)),
        live_minutes: Math.max(0, num(r.live_minutes, 0)),
        focus_skill: String(r.focus_skill ?? ""),
      });
    }
    out[String(uid)] = cleanRows;
  }
  return out;
}

/** Ensure playable fields exist on an idol JSON row (mutates). */
export function ensureIdolSimulationDefaults(row: Record<string, unknown>): void {
  if (row.condition == null || row.condition === "") row.condition = 90;
  else row.condition = clampInt(num(row.condition, 90), 0, 100);
  if (row.morale == null || row.morale === "") row.morale = 70;
  else row.morale = clampInt(num(row.morale, 70), 0, 100);
  if (row.fan_count == null) row.fan_count = num(row.fans, 0);
}

function avgInts(...values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function trainingBearIndex(idol: Record<string, unknown>): number {
  const attrs = normalizePersistedAttributes(idol.attributes);
  const stamina = attrs.physical.stamina;
  const fitness = attrs.physical.natural_fitness;
  const determination = attrs.mental.determination;
  const condition = num(idol.condition, 90);
  const base =
    8.0 + (avgInts(stamina, fitness) - 10.0) * 0.45 + (determination - 10.0) * 0.15 + (condition - 50) / 22.0;
  return clampInt(Math.round(base), 6, 18);
}

function liveConditionCost(
  idol: Record<string, unknown>,
  liveCount: number,
  liveMinutes: number,
  rehearsalMinutes: number,
  extraLiveMinutes: number,
): number {
  const attrs = normalizePersistedAttributes(idol.attributes);
  const stamina = attrs.physical.stamina;
  const weightedMinutes = liveMinutes + rehearsalMinutes * REHEARSAL_LIVE_COST_RATIO + extraLiveMinutes;
  const effectiveMinutes = Math.max(weightedMinutes, liveCount > 0 ? liveCount * 120 : 0);
  if (effectiveMinutes <= 0) return 0;
  const baselineCost = BASE_2H_LIVE_CONDITION_COST * (effectiveMinutes / 120.0);
  const staminaModifier = Math.max(0, 1.0 - Math.max(0, stamina) / 40.0);
  return baselineCost * staminaModifier;
}

function trainingConditionCost(trainingLoad: number, trainingHours: number): number {
  if (trainingHours > 0) {
    return BASE_4H_TRAINING_CONDITION_COST * (trainingHours / TRAINING_SESSION_HOURS);
  }
  if (trainingLoad <= 0) return 0;
  return BASE_4H_TRAINING_CONDITION_COST * (Math.min(MAX_TRAINING_LOAD, trainingLoad) / MAX_TRAINING_LOAD);
}

function weekdayIndexUtc(isoDate: string): number {
  const day = new Date(`${String(isoDate).split("T")[0]}T12:00:00Z`).getUTCDay();
  return Number.isFinite(day) ? day : 0;
}

function isoWeekMonday(isoDate: string): string {
  const base = new Date(`${String(isoDate).split("T")[0]}T12:00:00Z`);
  const day = base.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  base.setUTCDate(base.getUTCDate() + diff);
  return base.toISOString().slice(0, 10);
}

function addUtcDays(isoDate: string, days: number): string {
  const base = new Date(`${String(isoDate).split("T")[0]}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + days);
  return base.toISOString().slice(0, 10);
}

export interface DailyTrainingPlan {
  trainingHours: number;
  sessionLabels: string[];
  sessionCount: number;
  trainingLoad: number;
  sessions: Array<{ slotId: string; endTime: string; label: string; blocks: number }>;
}

export function buildDailyTrainingPlan(
  trainingRow: TrainingIntensityRow,
  targetIso: string,
  liveDaysInWeek?: Set<string>,
): DailyTrainingPlan {
  const weeklyLevels = Math.max(0, trainingLoadFromRow(trainingRow));
  const desiredSessions = weeklyLevels * (TRAINING_LEVEL_HOURS_PER_WEEK / TRAINING_SESSION_HOURS);
  if (desiredSessions <= 0) {
    return { trainingHours: 0, sessionLabels: [], sessionCount: 0, trainingLoad: 0, sessions: [] };
  }

  type Slot = { date: string; period: "morning" | "afternoon"; assigned: number; weight: number };
  const monday = isoWeekMonday(targetIso);
  const slots: Slot[] = [];
  for (let offset = 0; offset < 7; offset++) {
    const date = addUtcDays(monday, offset);
    const wd = weekdayIndexUtc(date);
    const weekend = wd === 0 || wd === 6;
    const livePenalty = liveDaysInWeek?.has(date) ? 0.45 : 0;
    const weekdayBias = weekend ? 0.55 : 1.0;
    slots.push({ date, period: "morning", assigned: 0, weight: weekdayBias + 0.08 - livePenalty });
    slots.push({ date, period: "afternoon", assigned: 0, weight: weekdayBias - livePenalty });
  }

  for (let i = 0; i < desiredSessions; i++) {
    let best: Slot | null = null;
    let bestScore = -Infinity;
    for (const slot of slots) {
      const score = slot.weight / (1 + slot.assigned);
      if (score > bestScore) {
        bestScore = score;
        best = slot;
      }
    }
    if (!best) break;
    best.assigned += 1;
  }

  const daySlots = slots.filter((slot) => slot.date === String(targetIso).split("T")[0] && slot.assigned > 0);
  const sessionLabels = daySlots.map((slot) => {
    const label = slot.period === "morning" ? "08:00-12:00" : "13:00-17:00";
    return slot.assigned > 1 ? `${label} x${slot.assigned}` : label;
  });
  const sessions = daySlots.map((slot) => ({
    slotId: `${slot.date}|${slot.period}`,
    endTime: `${slot.date}T${slot.period === "morning" ? "12:00:00" : "17:00:00"}`,
    label: slot.period === "morning" ? "Morning training" : "Afternoon training",
    blocks: slot.assigned,
  }));
  const sessionCount = daySlots.reduce((sum, slot) => sum + slot.assigned, 0);
  const trainingHours = sessionCount * TRAINING_SESSION_HOURS;
  const trainingLoad = Math.min(MAX_TRAINING_LOAD, sessionCount * 10);
  return { trainingHours, sessionLabels, sessionCount, trainingLoad, sessions };
}

function sleepRecovery(idol: Record<string, unknown>, beforeCondition: number): number {
  const attrs = normalizePersistedAttributes(idol.attributes);
  const stamina = attrs.physical.stamina;
  const fitness = attrs.physical.natural_fitness;
  const lowConditionBonus = (beforeCondition < 50 ? 2 : 0) + (beforeCondition < 30 ? 2 : 0);
  const staminaBonus = (stamina - 10.0) * 0.15;
  const fitnessBonus = (fitness - 10.0) * 0.2;
  return Math.max(2, Math.min(10, 5 + lowConditionBonus + staminaBonus + fitnessBonus));
}

export interface DailyStatusApplyInput {
  trainingLoad: number;
  trainingHours?: number;
  liveCount: number;
  liveMinutes: number;
  rehearsalMinutes?: number;
  extraLiveMinutes?: number;
  birthday?: boolean;
  includeSleepRecovery?: boolean;
}

/** One closed day of condition/morale changes (mutates idol row). */
export function applyDailyStatusUpdateJson(
  idol: Record<string, unknown>,
  input: DailyStatusApplyInput,
): Record<string, unknown> {
  ensureIdolSimulationDefaults(idol);
  const trainingLoad = Math.max(0, Math.trunc(input.trainingLoad));
  const trainingHours = Math.max(0, Number(input.trainingHours ?? 0) || 0);
  const liveCount = Math.max(0, Math.trunc(input.liveCount));
  const liveMinutes = Math.max(0, Math.trunc(input.liveMinutes));
  const rehearsalMinutes = Math.max(0, Math.trunc(input.rehearsalMinutes ?? 0));
  const extraLiveMinutes = Math.max(0, Math.trunc(input.extraLiveMinutes ?? 0));
  const includeSleepRecovery = input.includeSleepRecovery !== false;

  const beforeCondition = num(idol.condition, 90);
  const beforeMorale = num(idol.morale, 70);

  const bear = trainingBearIndex(idol);
  const liveLoad = Math.max(
    0,
    Math.floor((liveMinutes + rehearsalMinutes * REHEARSAL_LIVE_COST_RATIO + extraLiveMinutes) / 30),
  );
  const totalLoad = trainingLoad + liveLoad;
  const overwork = Math.max(0, trainingLoad - bear);

  const liveCost = liveConditionCost(idol, liveCount, liveMinutes, rehearsalMinutes, extraLiveMinutes);
  const trainCost = trainingConditionCost(trainingLoad, trainingHours);
  const overloadCost = 0;
  const totalConditionCost = liveCost + trainCost + overloadCost;
  const sleepGain = sleepRecovery(idol, beforeCondition);

  let conditionDelta = includeSleepRecovery ? Math.round(sleepGain) : 0;
  let moraleDelta = 0;

  if (includeSleepRecovery && totalConditionCost <= 0) {
    moraleDelta += 1;
  } else {
    conditionDelta -= Math.round(totalConditionCost);
    if (includeSleepRecovery && liveCount === 0 && trainCost <= 0) conditionDelta += 1;

    if (overwork > 0) moraleDelta -= 1 + Math.floor(overwork / 4);
    else if (trainingLoad > 0) moraleDelta += 1;
  }

  if (liveCount > 0) {
    if (beforeCondition >= 60) moraleDelta += 1;
    else if (beforeCondition < 40) moraleDelta -= 1;
  }

  if (input.birthday) moraleDelta += 3;

  if (totalConditionCost >= 25.0) moraleDelta -= 1;
  if (beforeCondition < 35) moraleDelta -= 2;

  const cap = 100;
  const nextCondition = clampInt(beforeCondition + conditionDelta, 0, 100);
  idol.condition = Math.min(cap, nextCondition);
  idol.morale = clampInt(beforeMorale + moraleDelta, 0, 100);

  return {
    idol_uid: String(idol.uid ?? ""),
    training_load: trainingLoad,
    training_hours: trainingHours,
    live_count: liveCount,
    live_minutes: liveMinutes,
    rehearsal_minutes: rehearsalMinutes,
    total_load: totalLoad,
    sleep_recovery: Math.round(sleepGain * 100) / 100,
    condition_delta: num(idol.condition, 90) - beforeCondition,
    morale_delta: num(idol.morale, 70) - beforeMorale,
  };
}

/** Append one daily workload row (mutates `log` map). */
export function recordTrainingDay(
  log: Record<string, TrainingLogRow[]>,
  idolUid: string,
  targetDate: string,
  trainingRow: TrainingIntensityRow,
  trainingHours: number,
  trainingSessions: string[],
  liveCount: number,
  liveMinutes: number,
  focusSkill: string,
): void {
  const uid = String(idolUid || "").trim();
  if (!uid) return;
  const rows = log[uid] ?? (log[uid] = []);
  rows.push({
    date: targetDate,
    training: { ...trainingRow },
    training_hours: Math.max(0, trainingHours),
    training_sessions: [...trainingSessions],
    live_count: Math.max(0, liveCount),
    live_minutes: Math.max(0, liveMinutes),
    focus_skill: focusSkill,
  });
  if (rows.length > WEEKLY_TRAINING_LOG_LIMIT) rows.splice(0, rows.length - WEEKLY_TRAINING_LOG_LIMIT);
}

export function defaultAutopilotTrainingIntensity(): TrainingIntensityRow {
  return { sing: 2, dance: 2, physical: 1, target: 0 };
}
