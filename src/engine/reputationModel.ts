/**
 * Dynamic group reputation (1-5).
 *
 * Reputation is stored as a float on the group row (`group.reputation`,
 * default 3.0) and moves with gameplay:
 *   UP   — accrued member tenure; graduations / departures handled with a proper
 *          sendoff (special live near the leave date).
 *   DOWN — scandals and how they are handled (soft keeps hurt most); a core
 *          member leaving without recognition.
 *
 * Display remains the 1-5 integer (round). The finer float lets small nudges
 * accumulate before the visible tier moves.
 */

import type { ScandalAction } from "./scandalConsequenceModel";

export const REPUTATION_MIN = 1;
export const REPUTATION_MAX = 5;
export const REPUTATION_DEFAULT = 3;

export type ReputationLogRow = {
  date: string;
  delta: number;
  reason: string;
  value: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function isoDay(value: unknown): string {
  return String(value ?? "").split("T")[0];
}

/** Current reputation as a float; falls back to tier/popularity, then default 3. */
export function currentGroupReputation(group: Record<string, unknown> | null | undefined): number {
  if (!group) return REPUTATION_DEFAULT;
  const stored = Number(group.reputation);
  if (Number.isFinite(stored) && stored > 0) return clamp(stored, REPUTATION_MIN, REPUTATION_MAX);
  return REPUTATION_DEFAULT;
}

/** Rounded 1-5 value for display / evaluation weights. */
export function displayReputation(group: Record<string, unknown> | null | undefined): number {
  return clamp(Math.round(currentGroupReputation(group)), REPUTATION_MIN, REPUTATION_MAX);
}

/**
 * Apply a reputation delta to a group row, clamped and logged.
 * Returns the new float value.
 */
export function adjustGroupReputation(
  group: Record<string, unknown> | null | undefined,
  delta: number,
  reason: string,
  day: string,
): number {
  if (!group || !Number.isFinite(delta) || delta === 0) {
    return currentGroupReputation(group);
  }
  const before = currentGroupReputation(group);
  const after = clamp(before + delta, REPUTATION_MIN, REPUTATION_MAX);
  group.reputation = Math.round(after * 1000) / 1000;

  const log = Array.isArray(group.reputation_log) ? (group.reputation_log as ReputationLogRow[]) : [];
  log.push({
    date: isoDay(day),
    delta: Math.round((after - before) * 1000) / 1000,
    reason,
    value: group.reputation as number,
  });
  // Keep the log bounded.
  group.reputation_log = log.slice(-40);
  return after;
}

/**
 * Reputation hit for a scandal + its handling.
 * A scandal always dents reputation; firm, agency-appropriate handling limits the
 * damage, while soft keeps deepen it. Returns a (usually negative) delta.
 */
export function reputationDeltaForScandalHandling(args: {
  action: ScandalAction;
  score: number;
  agencyHarshness?: number;
}): number {
  const score = clamp(Number(args.score) || 1, 1, 5);
  const s = score / 5;
  const harsh = clamp(Number(args.agencyHarshness) || 3, 1, 5);

  // Base scandal dent scales with severity.
  let delta = -(0.12 + 0.28 * s);

  switch (args.action) {
    case "terminate_now":
    case "terminate_after_live":
      // Decisive cut recovers part of the dent, more so at strict agencies.
      delta += 0.12 + 0.05 * ((harsh - 3) / 2);
      break;
    case "suspend_activities":
    case "demote_leader":
      delta += 0.05;
      break;
    case "keep_with_penalty":
      // Overriding a hard exit and keeping a tainted member reads as brand-soft.
      delta -= 0.15 + 0.1 * s;
      break;
    case "acknowledge":
      delta -= 0.1 + 0.08 * s;
      break;
  }
  // Never positive from a scandal; clamp the per-event swing.
  return clamp(delta, -0.6, -0.02);
}

/**
 * Reputation delta for a member departure.
 * - Proper sendoff (special live near the leave) is a small brand positive.
 * - A core member leaving with no recognition is a notable negative.
 */
export function reputationDeltaForDeparture(args: {
  isCore: boolean;
  recognized: boolean;
  isGraduation?: boolean;
}): number {
  const { isCore, recognized } = args;
  if (recognized) {
    // Well-handled sendoff; core farewells resonate more.
    return isCore ? 0.28 : 0.12;
  }
  // No recognition: losing a core member quietly hurts the brand.
  return isCore ? -0.5 : -0.16;
}

/**
 * Monthly tenure accrual: long-tenured, stable rosters slowly build reputation
 * toward a tenure ceiling. Only nudges upward. `avgTenureYears` is the mean
 * active-member tenure in years; `memberCount` gates tiny/unstable rosters.
 */
export function reputationTenureMonthlyDelta(args: {
  avgTenureYears: number;
  memberCount: number;
  current: number;
}): number {
  const years = Math.max(0, Number(args.avgTenureYears) || 0);
  const members = Math.max(0, Number(args.memberCount) || 0);
  if (members < 3) return 0;
  // Tenure ceiling: 1yr→3.3, 2yr→3.7, 3yr→4.1, 4yr+→~4.5.
  const ceiling = clamp(3.0 + 0.38 * years, 3.0, 4.5);
  const current = clamp(Number(args.current) || REPUTATION_DEFAULT, REPUTATION_MIN, REPUTATION_MAX);
  if (current >= ceiling) return 0;
  // Small monthly step, faster the further below ceiling.
  const gap = ceiling - current;
  return Math.min(gap, 0.03 + 0.05 * clamp(years - 1, 0, 4) * 0.25);
}

/** Average active-member tenure in years at a reference date. */
export function averageRosterTenureYears(
  group: Record<string, unknown> | null | undefined,
  idols: Record<string, unknown>[],
  asOf: string,
): { avgYears: number; memberCount: number } {
  if (!group) return { avgYears: 0, memberCount: 0 };
  const day = isoDay(asOf);
  const refMs = Date.parse(`${day || "2020-01-01"}T12:00:00Z`);
  const groupUid = String(group.uid ?? "").trim();
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  const byUid = new Map(idols.map((i) => [String(i.uid ?? ""), i]));
  let sum = 0;
  let n = 0;
  for (const uid of memberUids) {
    const idol = byUid.get(uid);
    if (!idol) continue;
    const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
    const stint = history.find((h) => String(h.group_uid ?? "").trim() === groupUid);
    const start = isoDay(stint?.start_date);
    if (!start) continue;
    const startMs = Date.parse(`${start}T12:00:00Z`);
    if (!Number.isFinite(startMs) || !Number.isFinite(refMs)) continue;
    const years = Math.max(0, (refMs - startMs) / (365.25 * 86_400_000));
    sum += years;
    n += 1;
  }
  return { avgYears: n ? sum / n : 0, memberCount: memberUids.length };
}

/**
 * Once-per-month tenure accrual for a managed group. Idempotent within a month
 * via a stored `reputation_tenure_month` marker on the group row.
 */
export function accrueMonthlyTenureReputation(
  group: Record<string, unknown> | null | undefined,
  idols: Record<string, unknown>[],
  day: string,
): void {
  if (!group) return;
  const month = isoDay(day).slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) return;
  if (String(group.reputation_tenure_month ?? "") === month) return;
  group.reputation_tenure_month = month;

  const { avgYears, memberCount } = averageRosterTenureYears(group, idols, day);
  const delta = reputationTenureMonthlyDelta({
    avgTenureYears: avgYears,
    memberCount,
    current: currentGroupReputation(group),
  });
  if (delta > 0) {
    adjustGroupReputation(group, delta, "tenure:monthly", day);
  }
}

/**
 * Whether a departing member got a proper sendoff: a special live (Concert / OneMan)
 * or an explicitly graduation/farewell-titled show scheduled near the leave date.
 */
export function hasProperSendoffLive(
  schedules: Record<string, unknown>[],
  leaveDay: string,
  windowDays = { before: 30, after: 14 },
): boolean {
  const leaveMs = Date.parse(`${isoDay(leaveDay) || "0000-01-01"}T12:00:00Z`);
  if (!Number.isFinite(leaveMs)) return false;
  const specialTypes = new Set(["concert", "oneman", "graduation", "anniversary", "tour"]);
  const titleRe = /graduation|farewell|sendoff|send-off|卒業|ラスト|last\s+(show|live|one)/i;
  for (const raw of schedules) {
    if (!raw || typeof raw !== "object") continue;
    const live = raw as Record<string, unknown>;
    if (String(live.status ?? "").toLowerCase() === "cancelled") continue;
    const dayMs = Date.parse(`${isoDay(live.start_date)}T12:00:00Z`);
    if (!Number.isFinite(dayMs)) continue;
    const deltaDays = Math.round((dayMs - leaveMs) / 86_400_000);
    if (deltaDays < -windowDays.before || deltaDays > windowDays.after) continue;
    const type = String(live.live_type ?? live.event_type ?? "").toLowerCase();
    const title = String(live.title ?? live.name ?? "");
    if (specialTypes.has(type) || titleRe.test(title)) return true;
  }
  return false;
}

/**
 * Is this idol a "core" member of the group? Leader role, or a dominant fan share,
 * or the top fan-count member of the roster.
 */
export function isCoreMember(
  group: Record<string, unknown> | null | undefined,
  idol: Record<string, unknown> | null | undefined,
  idols: Record<string, unknown>[],
  hasLeaderRole: boolean,
): boolean {
  if (!group || !idol) return false;
  if (hasLeaderRole) return true;
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  const byUid = new Map(idols.map((i) => [String(i.uid ?? ""), i]));
  const groupFans = Math.max(1, Number(group.fans ?? 0) || 0);
  const idolFans = Math.max(0, Number(idol.fan_count ?? 0) || 0);
  // Dominant personal fan share.
  if (idolFans / groupFans >= 0.22) return true;
  // Top fan-count member of the roster.
  let topUid = "";
  let topFans = -1;
  for (const uid of memberUids) {
    const m = byUid.get(uid);
    const f = Math.max(0, Number(m?.fan_count ?? 0) || 0);
    if (f > topFans) {
      topFans = f;
      topUid = uid;
    }
  }
  return topUid === String(idol.uid ?? "") && topFans > 0;
}
