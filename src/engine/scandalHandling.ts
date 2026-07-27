import type { ScandalAction } from "./scandalConsequenceModel";

export type { ScandalAction } from "./scandalConsequenceModel";
export {
  evaluateScandalOption,
  evaluateScandalOptions,
  computeScandalConsequences,
  type ScandalConsequenceDeltas,
  type ScandalEvalAxes,
  type ScandalEvalContext,
  type ScandalOptionEvaluation,
} from "./scandalConsequenceModel";

/**
 * Scandal handling catalog + managed-group gameplay consequences.
 *
 * When the player manages the affected group, each inbox choice is a real
 * operational tradeoff (roster / roles / cash / fans / morale / live form),
 * not just flavor text. Catalog rows (e.g. iLiFE! Budokan) supply historical
 * defaults and option labels.
 *
 * Consequence math + option evaluation live in `scandalConsequenceModel.ts`.
 */

import type { GameSavePayload } from "../save/gameSaveSchema";
import { getPrimaryGroup } from "../save/gameSaveSchema";
import { addNotification } from "../save/inbox";
import type { Finances } from "./types";
import {
  normalizeMemberRoleAssignments,
  roleAssignmentsFromHistoryEntry,
} from "../data/memberRoles";
import {
  agencyHarshnessFromGroup,
  groupReputationFromGroup,
  preloadAgencies,
} from "./agencyProfile";
import { adjustGroupReputation, reputationDeltaForScandalHandling } from "./reputationModel";
import {
  computeScandalConsequences,
  daysBetweenIso,
  evaluateScandalOptions,
  livePrestigeFromTitle,
  type ScandalConsequenceDeltas,
  type ScandalEvalContext,
  type ScandalOptionEvaluation,
} from "./scandalConsequenceModel";

export type ScandalHandlingDef = {
  id: string;
  idol_uid: string;
  idol_name: string;
  group_uid?: string;
  group_name?: string;
  scandal_date: string;
  score?: number;
  summary_ja?: string;
  historical_action: ScandalAction;
  effective_date?: string;
  allow_perform_until?: string;
  suspension_end_date?: string;
  /** When false with suspension_end_date, this is timed (一時) not indefinite (無期限). */
  indefinite_suspend?: boolean;
  demote_roles?: string[];
  /**
   * When a member leaves while still on indefinite suspension (e.g. 春野莉々:
   * suspended May, left Jul 31 before any return date), gate that leave as a
   * major managed decision instead of a locked scandal exit.
   */
  follow_on_leave?: {
    leave_date: string;
    historical_action?: "let_go" | "keep_suspended" | "reinstate_with_penalty" | "terminate_now";
    decision_lead_days?: number;
    options?: Array<{ value: string; label: string }>;
    note?: string;
  };
  options: Array<{ value: string; label: string }>;
  note?: string;
};

export type ScandalPenaltyState = {
  action: ScandalAction;
  start_date: string;
  end_date: string;
  performance_mult: number;
  sales_mult: number;
  score: number;
};

export type ScandalConsequencePreview = ScandalConsequenceDeltas;

type ScandalCatalog = { handlings: ScandalHandlingDef[] };

let catalog: ScandalCatalog | null = null;
let loadPromise: Promise<void> | null = null;

function base(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

function isoDay(value: unknown): string {
  return String(value ?? "").split("T")[0];
}

function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function addUtcDays(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function preloadScandalHandlings(): Promise<void> {
  if (catalog) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      await preloadAgencies();
      const res = await fetch(`${base()}data/reference/scandal_handlings.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog = (await res.json()) as ScandalCatalog;
    } catch (err) {
      console.warn("[scandalHandling] preload failed", err);
      catalog = { handlings: [] };
    }
  })();
  return loadPromise;
}

export function getScandalHandlingDefs(): ScandalHandlingDef[] {
  return catalog?.handlings ?? [];
}

export function scandalScoreFromDetail(detail: Record<string, unknown> | null | undefined): number {
  if (!detail) return 0;
  const raw = Number(detail.score ?? detail.level ?? detail.severity ?? detail.rank ?? 0);
  return Number.isFinite(raw) ? raw : 0;
}

export function findScandalHandlingForEvent(event: Record<string, unknown>): ScandalHandlingDef | null {
  const idolUid = String(event.idol_uid ?? "").trim();
  const day = isoDay(event.effective_date);
  const detail =
    event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
  const groupUid = String(event.group_uid ?? "").trim();
  const groupName = norm(event.group_name ?? "");

  for (const row of getScandalHandlingDefs()) {
    if (idolUid && row.idol_uid !== idolUid) continue;
    if (row.scandal_date && day && row.scandal_date !== day) continue;
    if (row.group_uid && groupUid && row.group_uid !== groupUid) continue;
    if (row.group_name && groupName && norm(row.group_name) !== groupName) continue;
    return row;
  }

  if (detail) {
    const handlingId = String(detail.handling_id ?? "").trim();
    if (handlingId) {
      return getScandalHandlingDefs().find((row) => row.id === handlingId) ?? null;
    }
  }
  return null;
}

/** Match a leave event to a catalog follow-on leave (post-indefinite-suspension exit). */
export function findPostSuspensionLeaveHandling(
  event: Record<string, unknown>,
): { catalog: ScandalHandlingDef; followOn: NonNullable<ScandalHandlingDef["follow_on_leave"]> } | null {
  if (String(event.type ?? "") !== "idol_leave_group") return null;
  const idolUid = String(event.idol_uid ?? "").trim();
  const leaveDay = isoDay(event.effective_date);
  const groupUid = String(event.group_uid ?? "").trim();
  if (!idolUid || !leaveDay) return null;
  for (const row of getScandalHandlingDefs()) {
    const follow = row.follow_on_leave;
    if (!follow) continue;
    if (row.idol_uid !== idolUid) continue;
    if (isoDay(follow.leave_date) !== leaveDay) continue;
    if (row.group_uid && groupUid && row.group_uid !== groupUid) continue;
    return { catalog: row, followOn: follow };
  }
  return null;
}

/**
 * Fallback when catalog is not yet loaded: a scandal-linked leave while the idol
 * is already on indefinite hiatus (no return_date) is treated as a post-suspension
 * leave decision (春野莉々 pattern).
 */
export function inferPostSuspensionLeaveHandling(
  save: GameSavePayload,
  event: Record<string, unknown>,
): { catalog: ScandalHandlingDef; followOn: NonNullable<ScandalHandlingDef["follow_on_leave"]> } | null {
  const matched = findPostSuspensionLeaveHandling(event);
  if (matched) return matched;
  if (String(event.type ?? "") !== "idol_leave_group") return null;
  const idol = findIdol(save, String(event.idol_uid ?? ""));
  if (!idol) return null;
  const day = isoDay(event.effective_date) || isoDay(save.current_date);
  const history = Array.isArray(idol.status_history) ? idol.status_history : [];
  let openIndefinite = false;
  let scandalDate = "";
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const kind = String(entry.kind ?? entry.status ?? "").toLowerCase();
    if (!/\bhiatus\b|\bvacation\b|\bpaused\b|\bon hold\b/.test(kind)) continue;
    const start = isoDay(entry.start_date) || day;
    const ret = isoDay(entry.return_date ?? "");
    if (start <= day && !ret) {
      openIndefinite = true;
      scandalDate = start;
      break;
    }
  }
  // Also accept nested scandal+hiatus still only on the leave entry.
  const entry = event.entry && typeof event.entry === "object" ? (event.entry as Record<string, unknown>) : null;
  if (!openIndefinite && entry) {
    const nested = Array.isArray(entry.status_history) ? entry.status_history : [];
    for (const raw of nested) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const kind = String(row.kind ?? "").toLowerCase();
      if (kind === "scandal" && !scandalDate) scandalDate = isoDay(row.start_date);
      if (kind === "hiatus" || kind === "vacation") {
        const start = isoDay(row.start_date) || day;
        const ret = isoDay(row.return_date ?? "");
        if (start <= day && !ret) {
          openIndefinite = true;
          if (!scandalDate) scandalDate = start;
        }
      }
    }
  }
  // Require either an explicit scandal_before_leave flag or open indefinite hiatus.
  if (!openIndefinite) return null;
  if (!event.scandal_before_leave && String((history[0] as Record<string, unknown> | undefined)?.reason ?? "") !== "scandal_suspend") {
    // Still allow when nested scandal exists before leave.
    const nestedScandal = entry
      ? (Array.isArray(entry.status_history) ? entry.status_history : []).some((raw) => {
          if (!raw || typeof raw !== "object") return false;
          const row = raw as Record<string, unknown>;
          return String(row.kind ?? "").toLowerCase() === "scandal" && isoDay(row.start_date) < day;
        })
      : false;
    if (!nestedScandal && !event.scandal_before_leave) return null;
  }
  const leaveDay = isoDay(event.effective_date);
  const synthetic: ScandalHandlingDef = {
    id: `inferred-post-suspend|${String(event.idol_uid ?? "")}|${leaveDay}`,
    idol_uid: String(event.idol_uid ?? ""),
    idol_name: String(event.idol_name ?? ""),
    group_uid: String(event.group_uid ?? ""),
    group_name: String(event.group_name ?? ""),
    scandal_date: scandalDate || leaveDay,
    score: 4,
    historical_action: "suspend_activities",
    indefinite_suspend: true,
    options: [],
    follow_on_leave: {
      leave_date: leaveDay,
      historical_action: "let_go",
      decision_lead_days: 56,
      options: [
        { value: "let_go", label: "Accept her leave (historical)" },
        { value: "keep_suspended", label: "Keep under indefinite suspension" },
        { value: "reinstate_with_penalty", label: "Reinstate with heavy penalty" },
        { value: "terminate_now", label: "Terminate now" },
      ],
      note: "Indefinite suspension with no return date; leave decided before reinstatement.",
    },
  };
  return { catalog: synthetic, followOn: synthetic.follow_on_leave! };
}

/**
 * Promote open nested hiatus rows onto idol.status_history so live roster
 * filters see suspended members at scenario start (春野莉々).
 */
export function syncOpenHiatusToIdolTopLevel(
  idol: Record<string, unknown>,
  asOf: string,
): boolean {
  const day = isoDay(asOf);
  const top = Array.isArray(idol.status_history) ? (idol.status_history as Record<string, unknown>[]) : [];
  const hasOpenTop = top.some((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const entry = raw as Record<string, unknown>;
    const kind = String(entry.kind ?? entry.status ?? "").toLowerCase();
    if (!/\bhiatus\b|\bvacation\b|\bpaused\b|\bon hold\b/.test(kind)) return false;
    const start = isoDay(entry.start_date) || day;
    const ret = isoDay(entry.return_date ?? "");
    return start <= day && (!ret || ret > day);
  });
  if (hasOpenTop) return false;
  const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
  for (const stint of history) {
    const statuses = Array.isArray(stint.status_history) ? (stint.status_history as Record<string, unknown>[]) : [];
    for (const raw of statuses) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const kind = String(entry.kind ?? "").toLowerCase();
      if (!/\bhiatus\b|\bvacation\b|\bpaused\b|\bon hold\b/.test(kind)) continue;
      const start = isoDay(entry.start_date) || day;
      const ret = isoDay(entry.return_date ?? "");
      if (start > day) continue;
      if (ret && ret <= day) continue;
      ensureTopLevelScandalSuspendHiatus(idol, start, {
        indefinite: !ret,
        returnDate: ret || null,
        summary: String(entry.summary ?? entry.summary_ja ?? "Activity suspension after scandal."),
      });
      return true;
    }
  }
  return false;
}

/**
 * Ensure an indefinite / open hiatus is visible on the idol top-level status_history
 * so live roster filters (`isIdolOnHiatus`) see it. Nested group_history hiatus alone
 * is not enough.
 */
export function ensureTopLevelScandalSuspendHiatus(
  idol: Record<string, unknown>,
  day: string,
  opts?: { indefinite?: boolean; returnDate?: string | null; summary?: string },
): void {
  const preview = computeScandalConsequences("suspend_activities", {
    score: 4,
    groupFans: 0,
    idolFans: 0,
    suspensionDays: opts?.returnDate ? daysBetweenIso(day, opts.returnDate) : opts?.indefinite === false ? 42 : null,
    daysToNextLive: null,
    nextLivePrestige: 0.55,
  });
  if (opts?.indefinite !== false && !opts?.returnDate) {
    preview.indefinite_suspend = true;
  }
  if (opts?.summary) {
    // applyActivitySuspension uses preview blurb fields indirectly via summary in row
  }
  applyActivitySuspension(idol, day, {
    ...preview,
    indefinite_suspend: opts?.indefinite !== false && !opts?.returnDate,
    penalty_days: opts?.returnDate ? Math.max(1, daysBetweenIso(day, opts.returnDate) ?? preview.penalty_days) : preview.penalty_days,
  });
}

/** Clear open scandal-suspend / hiatus rows on the idol (reinstate path). */
export function clearOpenActivitySuspension(idol: Record<string, unknown>, day: string): void {
  const history = Array.isArray(idol.status_history) ? [...idol.status_history] : [];
  const next: Record<string, unknown>[] = [];
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const kind = String(entry.kind ?? entry.status ?? "").toLowerCase();
    if (!/\bhiatus\b|\bvacation\b|\bpaused\b|\bon hold\b/.test(kind)) {
      next.push(entry);
      continue;
    }
    const start = isoDay(entry.start_date) || day;
    const ret = isoDay(entry.return_date ?? "");
    if (start <= day && (!ret || ret > day)) {
      entry.return_date = day;
      entry.summary = String(entry.summary ?? "Activity suspension ended.");
      next.push(entry);
      continue;
    }
    next.push(entry);
  }
  idol.status_history = next;
}

/**
 * Apply a post-suspension leave decision (春野莉々 path): accept leave, keep
 * suspended, reinstate with heavy penalty, or terminate now.
 */
export function applyPostSuspensionLeaveChoice(
  save: GameSavePayload,
  event: Record<string, unknown>,
  action: string,
  day: string,
): { suppressedUids: string[]; summary: string } {
  const idolUid = String(event.idol_uid ?? "");
  const idol = findIdol(save, idolUid);
  const idolName = String(event.idol_name ?? idol?.name ?? "Member");
  const group = getPrimaryGroup(save);
  const groupName = String(event.group_name ?? group?.name ?? "the group");
  const leaveUid = String(event.uid ?? "");
  const suppressedUids: string[] = [];
  if (!idol) return { suppressedUids, summary: `${idolName}: idol not found.` };

  const match = findPostSuspensionLeaveHandling(event);
  const score = Number(match?.catalog.score ?? 4) || 4;

  if (action === "let_go") {
    return {
      suppressedUids,
      summary: `${idolName} remains on indefinite suspension and will leave ${groupName} on ${isoDay(event.effective_date) || day} (historical path).`,
    };
  }

  if (action === "keep_suspended") {
    ensureTopLevelScandalSuspendHiatus(idol, day, { indefinite: true });
    if (leaveUid) suppressedUids.push(leaveUid);
    return {
      suppressedUids,
      summary: `${idolName} stays signed under indefinite suspension. The ${isoDay(event.effective_date)} leave was cancelled.`,
    };
  }

  if (action === "reinstate_with_penalty") {
    clearOpenActivitySuspension(idol, day);
    const preview = computeScandalConsequences("keep_with_penalty", {
      score,
      groupFans: Number(group?.fans ?? 0) || 0,
      idolFans: Number(idol.fan_count ?? 0) || 0,
      daysToNextLive: null,
      nextLivePrestige: 0.55,
      groupReputation: groupReputationFromGroup(group as Record<string, unknown> | null),
      agencyHarshness: agencyHarshnessFromGroup(group as Record<string, unknown> | null),
    });
    applyMoraleDelta(idol, preview.morale_self);
    applyTeammateMorale(save, idolUid, preview.morale_team);
    applyFanAndPopularity(save, idol, preview);
    applyCashDelta(save, preview.cash_delta_yen);
    applySalaryCut(idol, preview.salary_cut_pct);
    setScandalPenalty(idol, preview, day, score);
    if (leaveUid) suppressedUids.push(leaveUid);
    return {
      suppressedUids,
      summary: `${idolName} was reinstated into ${groupName} under heavy penalty. Leave cancelled.\n${preview.blurb}`,
    };
  }

  if (action === "terminate_now") {
    const preview = computeScandalConsequences("terminate_now", {
      score,
      groupFans: Number(group?.fans ?? 0) || 0,
      idolFans: Number(idol.fan_count ?? 0) || 0,
      daysToNextLive: null,
      nextLivePrestige: 0.55,
      groupReputation: groupReputationFromGroup(group as Record<string, unknown> | null),
      agencyHarshness: agencyHarshnessFromGroup(group as Record<string, unknown> | null),
    });
    applyMoraleDelta(idol, preview.morale_self);
    applyTeammateMorale(save, idolUid, preview.morale_team);
    applyFanAndPopularity(save, idol, preview);
    applyCashDelta(save, preview.cash_delta_yen);
    clearOpenActivitySuspension(idol, day);
    ensurePastMembership(save, idol, day);
    if (leaveUid) suppressedUids.push(leaveUid);
    return {
      suppressedUids,
      summary: `${idolName} was terminated from ${groupName} effective ${day}.\n${preview.blurb}`,
    };
  }

  return { suppressedUids, summary: `${idolName}: unknown post-suspension action ${action}.` };
}

export function entryHasScandalBeforeLeave(
  entry: Record<string, unknown>,
  leaveDate: string,
  windowStart?: string,
): boolean {
  const leave = isoDay(leaveDate);
  const start = isoDay(windowStart) || "0000-01-01";
  const history = Array.isArray(entry.status_history) ? entry.status_history : [];
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (String(row.kind ?? "").toLowerCase() !== "scandal") continue;
    const d = isoDay(row.start_date);
    if (!d) continue;
    if (d >= start && d < leave) return true;
  }
  return false;
}

export function defaultScandalOptions(args: {
  score: number;
  hasLeaderRole: boolean;
  historical?: ScandalAction | null;
  /** Timed (一時) vs indefinite (無期限) when historical/default is suspend. */
  indefiniteSuspend?: boolean | null;
}): Array<{ value: string; label: string }> {
  const { score, hasLeaderRole, historical, indefiniteSuspend } = args;
  if (historical === "terminate_after_live") {
    return [
      { value: "terminate_after_live", label: "Terminate after live" },
      { value: "terminate_now", label: "Terminate immediately" },
      { value: "suspend_activities", label: "Suspend from activities" },
      { value: "keep_with_penalty", label: "Keep with heavy penalty" },
    ];
  }
  if (historical === "suspend_activities") {
    const suspendLabel =
      indefiniteSuspend === false
        ? "Suspend for some time"
        : indefiniteSuspend === true
          ? "Suspend indefinitely"
          : "Suspend from activities";
    return [
      { value: "suspend_activities", label: suspendLabel },
      { value: "terminate_now", label: "Terminate" },
      { value: "keep_with_penalty", label: "Keep with heavy penalty" },
    ];
  }
  if (historical === "demote_leader" || (score >= 4 && hasLeaderRole)) {
    return [
      { value: "demote_leader", label: "Keep with heavy penalty (demote leader)" },
      { value: "suspend_activities", label: "Suspend from activities" },
      { value: "terminate_now", label: "Terminate" },
      { value: "keep_with_penalty", label: "Keep with heavy penalty (no demotion)" },
    ];
  }
  if (score >= 5) {
    return [
      { value: "terminate_now", label: "Terminate" },
      { value: "suspend_activities", label: "Suspend from activities" },
      { value: "keep_with_penalty", label: "Keep with heavy penalty" },
    ];
  }
  if (score >= 3) {
    return [
      { value: "suspend_activities", label: "Suspend from activities" },
      { value: "keep_with_penalty", label: "Keep with penalty" },
      { value: "acknowledge", label: "Issue warning only" },
    ];
  }
  return [{ value: "acknowledge", label: "Acknowledge" }];
}

function findIdol(save: GameSavePayload, idolUid: string): Record<string, unknown> | null {
  const idols = save.database_snapshot.idols;
  for (const raw of idols) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (String(row.uid ?? "") === idolUid) return row;
  }
  return null;
}

function findManagedStint(
  idol: Record<string, unknown>,
  save: GameSavePayload,
  event: Record<string, unknown>,
): Record<string, unknown> | null {
  const group = getPrimaryGroup(save);
  if (!group) return null;
  const groupUid = String(event.group_uid ?? group.uid ?? "").trim();
  const groupName = norm(event.group_name ?? group.name ?? "");
  const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
  for (const entry of history) {
    const uid = String(entry.group_uid ?? "").trim();
    const name = norm(entry.group_name ?? "");
    if (groupUid && uid && uid === groupUid) return entry;
    if (groupName && name && name === groupName) return entry;
  }
  return null;
}

function stintHasLeaderRole(entry: Record<string, unknown> | null): boolean {
  if (!entry) return false;
  return roleAssignmentsFromHistoryEntry(entry).some((r) => r.key === "leader");
}

export function buildScandalChoiceOptions(
  event: Record<string, unknown>,
  save: GameSavePayload,
): Array<{ value: string; label: string }> {
  const catalogRow = findScandalHandlingForEvent(event);
  if (catalogRow?.options?.length) return catalogRow.options.map((o) => ({ ...o }));
  const detail =
    event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
  const score = scandalScoreFromDetail(detail) || Number(catalogRow?.score ?? 0) || 0;
  const idol = findIdol(save, String(event.idol_uid ?? ""));
  const stint = idol ? findManagedStint(idol, save, event) : null;
  const historical =
    (String(detail?.handling ?? catalogRow?.historical_action ?? "") as ScandalAction) || null;
  const indefiniteFromCatalog =
    typeof catalogRow?.indefinite_suspend === "boolean"
      ? catalogRow.indefinite_suspend
      : catalogRow?.suspension_end_date
        ? false
        : historical === "suspend_activities"
          ? true
          : null;
  return defaultScandalOptions({
    score,
    hasLeaderRole: stintHasLeaderRole(stint),
    historical: historical || null,
    indefiniteSuspend: indefiniteFromCatalog,
  });
}

/**
 * Build evaluation context from the current managed-group save state.
 */
export function buildScandalEvalContext(
  event: Record<string, unknown>,
  save: GameSavePayload,
  day?: string,
): ScandalEvalContext {
  const catalogRow = findScandalHandlingForEvent(event);
  const detail =
    event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
  const score = scandalScoreFromDetail(detail) || Number(catalogRow?.score ?? 0) || 3;
  const group = getPrimaryGroup(save);
  const idol = findIdol(save, String(event.idol_uid ?? ""));
  const stint = idol ? findManagedStint(idol, save, event) : null;
  const refDay =
    isoDay(day) ||
    isoDay(save.current_date) ||
    isoDay(event.effective_date) ||
    isoDay(catalogRow?.scandal_date) ||
    "2025-01-01";

  let daysToNextLive: number | null = null;
  let nextLivePrestige = 0.55;
  const schedules = Array.isArray(save.lives?.schedules) ? save.lives.schedules : [];
  for (const raw of schedules) {
    if (!raw || typeof raw !== "object") continue;
    const live = raw as Record<string, unknown>;
    const liveDay = isoDay(live.start_date);
    if (!liveDay || liveDay < refDay) continue;
    const delta = daysBetweenIso(refDay, liveDay);
    if (delta == null || delta < 0) continue;
    if (daysToNextLive == null || delta < daysToNextLive) {
      daysToNextLive = delta;
      nextLivePrestige = livePrestigeFromTitle(
        String(live.title ?? live.name ?? ""),
        String(live.venue ?? live.venue_name ?? ""),
      );
    }
  }

  // Catalog allow_perform_until / effective_date acts as a known prestige live anchor
  // when schedules are missing (e.g. Budokan date in handling def).
  const anchor = isoDay(catalogRow?.allow_perform_until) || isoDay(catalogRow?.effective_date);
  if (anchor && anchor >= refDay) {
    const delta = daysBetweenIso(refDay, anchor);
    if (delta != null && (daysToNextLive == null || delta <= daysToNextLive)) {
      daysToNextLive = delta;
      nextLivePrestige = Math.max(nextLivePrestige, 1.35);
    }
  }

  const memberUids = Array.isArray(group?.member_uids) ? group!.member_uids.map((x) => String(x)) : [];
  let teamMoraleSum = 0;
  let teamMoraleN = 0;
  for (const uid of memberUids) {
    if (uid === String(event.idol_uid ?? "")) continue;
    const mate = findIdol(save, uid);
    if (!mate) continue;
    teamMoraleSum += Number(mate.morale ?? 70) || 70;
    teamMoraleN += 1;
  }

  const finances = save.finances as Finances & Record<string, unknown>;
  const suspensionEnd = isoDay(catalogRow?.suspension_end_date);
  const suspensionDays = suspensionEnd ? daysBetweenIso(refDay, suspensionEnd) : null;
  return {
    score,
    groupFans: Number(group?.fans ?? 0) || 0,
    idolFans: Number(idol?.fan_count ?? 0) || 0,
    cashYen: Number(finances?.cash_yen ?? 0) || 0,
    popularity: Number(group?.popularity ?? 0) || 0,
    groupReputation: groupReputationFromGroup(group as Record<string, unknown> | null),
    agencyHarshness: agencyHarshnessFromGroup(group as Record<string, unknown> | null),
    hasLeaderRole: stintHasLeaderRole(stint),
    suspensionDays: suspensionDays != null && suspensionDays > 0 ? suspensionDays : null,
    daysToNextLive,
    nextLivePrestige,
    historicalAction: (catalogRow?.historical_action as ScandalAction | undefined) || null,
    idolMorale: Number(idol?.morale ?? 70) || 70,
    teamAvgMorale: teamMoraleN ? teamMoraleSum / teamMoraleN : 70,
  };
}

/** Evaluate every available handling option (ranked by utility). */
export function evaluateScandalHandlingOptions(
  event: Record<string, unknown>,
  save: GameSavePayload,
  day?: string,
): ScandalOptionEvaluation[] {
  const options = buildScandalChoiceOptions(event, save);
  const actions = options.map((o) => String(o.value) as ScandalAction);
  const ctx = buildScandalEvalContext(event, save, day);
  return evaluateScandalOptions(actions, ctx);
}

/**
 * Score-scaled gameplay consequence preview for one action.
 * Delegates to the evaluation model so apply + UI stay aligned.
 */
export function previewScandalConsequences(args: {
  action: ScandalAction;
  score: number;
  groupFans: number;
  idolFans: number;
  cashYen?: number;
  daysToNextLive?: number | null;
  nextLivePrestige?: number;
  hasLeaderRole?: boolean;
  historicalAction?: ScandalAction | null;
}): ScandalConsequencePreview {
  return computeScandalConsequences(args.action, {
    score: args.score,
    groupFans: args.groupFans,
    idolFans: args.idolFans,
    daysToNextLive: args.daysToNextLive ?? null,
    nextLivePrestige: args.nextLivePrestige ?? 0.55,
  });
}

export function previewAllScandalOptions(
  event: Record<string, unknown>,
  save: GameSavePayload,
): ScandalConsequencePreview[] {
  return evaluateScandalHandlingOptions(event, save).map((row) => row.consequences);
}

/** Active live/sales multipliers from an idol's open scandal_penalty window. */
export function activeScandalPenaltyMults(
  idol: Record<string, unknown>,
  refDate: string,
): { performance: number; sales: number; active: boolean } {
  const raw = idol.scandal_penalty;
  if (!raw || typeof raw !== "object") return { performance: 1, sales: 1, active: false };
  const pen = raw as Record<string, unknown>;
  const day = isoDay(refDate);
  const start = isoDay(pen.start_date);
  const end = isoDay(pen.end_date);
  if (start && day < start) return { performance: 1, sales: 1, active: false };
  if (end && day > end) return { performance: 1, sales: 1, active: false };
  return {
    performance: clamp(Number(pen.performance_mult ?? 1) || 1, 0.5, 1),
    sales: clamp(Number(pen.sales_mult ?? 1) || 1, 0.5, 1),
    active: true,
  };
}

function removeRolesFromStint(entry: Record<string, unknown>, roleKeys: string[], day: string): string[] {
  const targets = new Set(roleKeys.map((k) => k.trim()).filter(Boolean));
  if (!targets.size) targets.add("leader");
  const before = roleAssignmentsFromHistoryEntry(entry);
  const removed = before.filter((r) => targets.has(r.key)).map((r) => r.key);
  if (!removed.length) return [];
  entry.roles = normalizeMemberRoleAssignments(before.filter((r) => !targets.has(r.key)));
  const hist = Array.isArray(entry.role_history) ? (entry.role_history as Record<string, unknown>[]) : [];
  for (const key of removed) {
    const open = hist.find(
      (row) =>
        String(row.key ?? "") === key &&
        (!row.end_date || String(row.end_date) === "" || isoDay(row.end_date) > day),
    );
    if (open) open.end_date = day;
    else {
      hist.push({ key, focus: 1, start_date: day, end_date: day, note: "Demoted after scandal handling." });
    }
  }
  entry.role_history = hist;
  return removed;
}

function ensurePastMembership(save: GameSavePayload, idol: Record<string, unknown>, day: string): void {
  const group = getPrimaryGroup(save);
  if (!group) return;
  const idolUid = String(idol.uid ?? "");
  const displayName = String(idol.name ?? "");
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  const memberNames = Array.isArray(group.member_names) ? group.member_names.map((x) => String(x)) : [];
  const pastUids = Array.isArray(group.past_member_uids) ? group.past_member_uids.map((x) => String(x)) : [];
  const pastNames = Array.isArray(group.past_member_names) ? group.past_member_names.map((x) => String(x)) : [];
  const live = memberUids
    .map((uid, i) => ({ uid, name: memberNames[i] ?? uid }))
    .filter((row) => row.uid !== idolUid);
  const past = pastUids
    .map((uid, i) => ({ uid, name: pastNames[i] ?? uid }))
    .filter((row) => row.uid !== idolUid);
  past.push({ uid: idolUid, name: displayName });
  group.member_uids = live.map((r) => r.uid);
  group.member_names = live.map((r) => r.name);
  group.past_member_uids = past.map((r) => r.uid);
  group.past_member_names = past.map((r) => r.name);
  group.member_count = live.length;
  group.past_member_count = past.length;

  const stint = findManagedStint(idol, save, { group_uid: group.uid, group_name: group.name });
  if (stint && !isoDay(stint.end_date)) stint.end_date = day;
}

function applyMoraleDelta(idol: Record<string, unknown>, delta: number): void {
  const current = Number(idol.morale ?? 70) || 70;
  idol.morale = clamp(current + delta, 0, 100);
}

function applyTeammateMorale(save: GameSavePayload, excludeUid: string, delta: number): void {
  const group = getPrimaryGroup(save);
  if (!group || !delta) return;
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  for (const uid of memberUids) {
    if (uid === excludeUid) continue;
    const idol = findIdol(save, uid);
    if (idol) applyMoraleDelta(idol, delta);
  }
}

function applyCashDelta(save: GameSavePayload, deltaYen: number): void {
  const finances = save.finances as Finances & Record<string, unknown>;
  const current = Number(finances.cash_yen ?? 0) || 0;
  finances.cash_yen = Math.round(current + deltaYen);
  const note = String(finances.notes ?? "");
  const line = `scandal_pr:${deltaYen}`;
  if (!note.includes(line)) {
    finances.notes = note ? `${note}\n${line}` : line;
  }
}

function applyFanAndPopularity(
  save: GameSavePayload,
  idol: Record<string, unknown>,
  preview: ScandalConsequencePreview,
): void {
  const group = getPrimaryGroup(save);
  if (group) {
    const fans = Math.max(0, Number(group.fans ?? 0) || 0);
    group.fans = Math.max(0, Math.round(fans + preview.fan_group_delta));
    const pop = Math.max(0, Number(group.popularity ?? 0) || 0);
    group.popularity = clamp(pop + preview.popularity_delta, 0, 100);
  }
  const idolFans = Math.max(0, Number(idol.fan_count ?? 0) || 0);
  idol.fan_count = Math.max(0, Math.round(idolFans + preview.fan_idol_delta));
}

function applySalaryCut(idol: Record<string, unknown>, cutPct: number): number {
  if (cutPct <= 0) return 0;
  const salary = Number(idol.contract_salary_yen ?? 0) || 0;
  if (salary <= 0) return 0;
  const next = Math.max(0, Math.round(salary * (1 - cutPct / 100)));
  idol.contract_salary_yen = next;
  return salary - next;
}

function setScandalPenalty(
  idol: Record<string, unknown>,
  preview: ScandalConsequencePreview,
  day: string,
  score: number,
): void {
  if (
    preview.penalty_days <= 0 ||
    preview.roster_effect === "immediate_exit" ||
    preview.roster_effect === "suspend"
  ) {
    // Suspend uses hiatus status instead of form mult (she is off-stage).
    if (preview.roster_effect !== "suspend") delete idol.scandal_penalty;
    return;
  }
  const penalty: ScandalPenaltyState = {
    action: preview.action,
    start_date: day,
    end_date: addUtcDays(day, preview.penalty_days),
    performance_mult: preview.performance_mult,
    sales_mult: preview.sales_mult,
    score,
  };
  idol.scandal_penalty = penalty;
}

function applyActivitySuspension(
  idol: Record<string, unknown>,
  day: string,
  preview: ScandalConsequencePreview,
): { start_date: string; return_date: string | null } {
  const history = Array.isArray(idol.status_history) ? [...idol.status_history] : [];
  const filtered = history.filter((raw) => {
    if (!raw || typeof raw !== "object") return true;
    const entry = raw as Record<string, unknown>;
    const kind = String(entry.kind ?? entry.status ?? "").toLowerCase();
    if (!/\bhiatus\b|\bvacation\b|\bpaused\b|\bon hold\b/.test(kind)) return true;
    const existingReturn = isoDay(entry.return_date ?? "");
    return Boolean(existingReturn && existingReturn <= day);
  });
  const row: Record<string, unknown> = {
    kind: "hiatus",
    start_date: day,
    summary: preview.indefinite_suspend
      ? "Indefinite activity suspension after scandal handling."
      : "Activity suspension after scandal handling.",
    reason: "scandal_suspend",
  };
  const returnDate =
    preview.indefinite_suspend || preview.penalty_days <= 0 ? null : addUtcDays(day, preview.penalty_days);
  if (returnDate) row.return_date = returnDate;
  filtered.push(row);
  idol.status_history = filtered;
  return { start_date: day, return_date: returnDate };
}

function formatYen(n: number): string {
  const sign = n < 0 ? "-" : n > 0 ? "+" : "";
  return `${sign}¥${Math.abs(Math.round(n)).toLocaleString("ja-JP")}`;
}

function formatDelta(n: number, suffix = ""): string {
  const rounded = Math.round(n);
  const sign = rounded > 0 ? "+" : "";
  return `${sign}${rounded.toLocaleString("ja-JP")}${suffix}`;
}

function linkedLeaveEventUid(save: GameSavePayload, event: Record<string, unknown>): string {
  const idolUid = String(event.idol_uid ?? "");
  const groupUid = String(event.group_uid ?? "").trim();
  const groupName = norm(event.group_name ?? "");
  const queue = Array.isArray(save.scenario_runtime?.future_events) ? save.scenario_runtime.future_events : [];
  for (const raw of queue) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (String(row.type ?? "") !== "idol_leave_group") continue;
    if (String(row.idol_uid ?? "") !== idolUid) continue;
    const uid = String(row.group_uid ?? "").trim();
    const name = norm(row.group_name ?? "");
    if (groupUid && uid && uid !== groupUid) continue;
    if (!groupUid && groupName && name && name !== groupName) continue;
    return String(row.uid ?? "");
  }
  return "";
}

/**
 * Apply a chosen scandal handling action with full gameplay consequences.
 */
export function applyScandalHandlingChoice(
  save: GameSavePayload,
  event: Record<string, unknown>,
  action: ScandalAction,
  day: string,
): { suppressedUids: string[]; summary: string; preview: ScandalConsequencePreview | null } {
  const catalogRow = findScandalHandlingForEvent(event);
  const idolUid = String(event.idol_uid ?? "");
  const idol = findIdol(save, idolUid);
  const idolName = String(event.idol_name ?? idol?.name ?? "Member");
  const group = getPrimaryGroup(save);
  const groupName = String(event.group_name ?? group?.name ?? "the group");
  const suppressedUids: string[] = [];
  if (!idol) return { suppressedUids, summary: `${idolName}: idol not found.`, preview: null };

  const ctx = buildScandalEvalContext(event, save, day);
  const evaluation = evaluateScandalOptions([action], ctx)[0]!;
  const preview = evaluation.consequences;
  const score = ctx.score;

  const stint = findManagedStint(idol, save, event);
  const leaveUid = linkedLeaveEventUid(save, event);
  const effective =
    isoDay(catalogRow?.effective_date) ||
    isoDay((event.detail as Record<string, unknown> | undefined)?.handling_effective_date) ||
    day;

  // Shared resource hits for every managed choice.
  applyMoraleDelta(idol, preview.morale_self);
  applyTeammateMorale(save, idolUid, preview.morale_team);
  applyFanAndPopularity(save, idol, preview);
  applyCashDelta(save, preview.cash_delta_yen);
  const salaryCutYen = applySalaryCut(idol, preview.salary_cut_pct);
  setScandalPenalty(idol, preview, day, score);

  // Reputation moves down with the scandal; firm handling limits the dent.
  adjustGroupReputation(
    group as Record<string, unknown> | null,
    reputationDeltaForScandalHandling({ action, score, agencyHarshness: ctx.agencyHarshness }),
    `scandal:${action}`,
    day,
  );

  if (action === "terminate_now") {
    ensurePastMembership(save, idol, day);
    if (leaveUid) suppressedUids.push(leaveUid);
    const notice = save.inbox.notifications.find(
      (n) => n.dedupe_key === `scenario-leave-choice|${leaveUid}` && String(n.choice_status) === "pending",
    );
    if (notice) {
      notice.choice_status = "let_go";
      notice.requires_confirmation = false;
      notice.read = true;
    }
    return {
      suppressedUids,
      preview,
      summary: buildConsequenceSummary(idolName, groupName, preview, {
        effective,
        salaryCutYen,
        extra: `Terminated effective ${day}.`,
        evaluation,
      }),
    };
  }

  if (action === "terminate_after_live") {
    if (leaveUid) {
      const notice = save.inbox.notifications.find((n) => n.dedupe_key === `scenario-leave-choice|${leaveUid}`);
      if (notice) {
        notice.choice_status = "let_go";
        notice.requires_confirmation = false;
        notice.read = true;
      } else {
        addNotification(save, {
          title: `Departure decision: ${idolName}`,
          body: `${idolName} will leave ${groupName} on ${effective} after the scheduled live (scandal termination).`,
          sender: "Management",
          category: "decision",
          level: "critical",
          isoDate: day,
          unread: false,
          requiresConfirmation: false,
          dedupeKey: `scenario-leave-choice|${leaveUid}`,
          relatedEventUid: leaveUid,
          choiceKind: "managed_group_leave",
          choiceStatus: "let_go",
          choiceOptions: [{ value: "let_go", label: "Acknowledge departure" }],
          reportData: {
            kind: "managed_group_leave",
            event_uid: leaveUid,
            idol_uid: idolUid,
            idol_name: idolName,
            group_name: groupName,
            effective_date: effective,
            negotiable: false,
            from_scandal: true,
          },
        });
      }
    }
    // Until the final live, she performs under the short penalty window.
    return {
      suppressedUids,
      preview,
      summary: buildConsequenceSummary(idolName, groupName, preview, {
        effective,
        salaryCutYen,
        extra: `Scheduled exit after the live on ${effective}.`,
        evaluation,
      }),
    };
  }

  if (action === "demote_leader") {
    const roles = catalogRow?.demote_roles?.length
      ? catalogRow.demote_roles
      : ((event.detail as Record<string, unknown> | undefined)?.demote_roles as string[] | undefined) || [
          "leader",
        ];
    const removed = stint ? removeRolesFromStint(stint, roles, day) : [];
    return {
      suppressedUids,
      preview,
      summary: buildConsequenceSummary(idolName, groupName, preview, {
        effective,
        salaryCutYen,
        extra: removed.length
          ? `Kept with heavy penalty; demoted from ${removed.join(", ")}.`
          : `Kept with heavy penalty (no active leader role found to strip).`,
        evaluation,
      }),
    };
  }

  if (action === "suspend_activities") {
    const period = applyActivitySuspension(idol, day, preview);
    return {
      suppressedUids,
      preview,
      summary: buildConsequenceSummary(idolName, groupName, preview, {
        effective,
        salaryCutYen,
        extra: period.return_date
          ? `Suspended for some time until ${period.return_date}.`
          : `Indefinite activity suspension started ${period.start_date}.`,
        evaluation,
      }),
    };
  }

  if (action === "keep_with_penalty") {
    if (leaveUid) {
      suppressedUids.push(leaveUid);
      const notice = save.inbox.notifications.find((n) => n.dedupe_key === `scenario-leave-choice|${leaveUid}`);
      if (notice) {
        notice.choice_status = "keep";
        notice.requires_confirmation = false;
        notice.read = true;
      }
    }
    return {
      suppressedUids,
      preview,
      summary: buildConsequenceSummary(idolName, groupName, preview, {
        effective,
        salaryCutYen,
        extra: `Kept in ${groupName} under heavy penalty.`,
        evaluation,
      }),
    };
  }

  return {
    suppressedUids,
    preview,
    summary: buildConsequenceSummary(idolName, groupName, preview, {
      effective,
      salaryCutYen,
      extra: `Warning issued to ${idolName}.`,
      evaluation,
    }),
  };
}

function buildConsequenceSummary(
  idolName: string,
  groupName: string,
  preview: ScandalConsequencePreview,
  opts: {
    effective: string;
    salaryCutYen: number;
    extra: string;
    evaluation?: ScandalOptionEvaluation;
  },
): string {
  const lines = [
    opts.extra,
    preview.blurb,
    `Cash ${formatYen(preview.cash_delta_yen)} · Group fans ${formatDelta(preview.fan_group_delta)} · ${idolName} fans ${formatDelta(preview.fan_idol_delta)}`,
    `Morale ${idolName} ${formatDelta(preview.morale_self)} · teammates ${formatDelta(preview.morale_team)} · popularity ${formatDelta(preview.popularity_delta, "")}`,
  ];
  if (preview.salary_cut_pct > 0) {
    lines.push(
      `Salary -${preview.salary_cut_pct}%` +
        (opts.salaryCutYen > 0 ? ` (−¥${opts.salaryCutYen.toLocaleString("ja-JP")}/mo)` : ""),
    );
  }
  if (preview.penalty_days > 0) {
    lines.push(
      `Live form ×${preview.performance_mult.toFixed(2)}, sales ×${preview.sales_mult.toFixed(2)} for ${preview.penalty_days} days.`,
    );
  }
  if (preview.roster_effect === "exit_after_live") {
    lines.push(`Exit date locked to ${opts.effective}.`);
  }
  if (preview.roster_effect === "suspend") {
    lines.push(
      preview.indefinite_suspend
        ? "Off-stage indefinitely (hiatus); skipped from managed lives until reinstated."
        : `Suspended for some time (${preview.penalty_days} days off-stage); skipped from managed lives.`,
    );
  }
  if (opts.evaluation) {
    const a = opts.evaluation.axes;
    lines.push(
      `Eval utility ${opts.evaluation.utility.toFixed(0)}/100 (${opts.evaluation.risk} risk) · brand ${a.brand.toFixed(0)} · fans ${a.fans.toFixed(0)} · finance ${a.finance.toFixed(0)} · roster ${a.roster.toFixed(0)} · live ${a.live.toFixed(0)} · team ${a.team.toFixed(0)}`,
    );
  }
  void groupName;
  return lines.join("\n");
}

/**
 * Auto-apply historical handling when a scandal status is applied for a
 * non-decision path (NPC group).
 */
export function autoApplyHistoricalScandalHandling(
  save: GameSavePayload,
  event: Record<string, unknown>,
  day: string,
): void {
  if (scenarioEventTargetsManagedGroupLocal(save, event)) return;
  const catalogRow = findScandalHandlingForEvent(event);
  const action = (catalogRow?.historical_action ||
    String((event.detail as Record<string, unknown> | undefined)?.handling ?? "")) as ScandalAction;
  const idol = findIdol(save, String(event.idol_uid ?? ""));
  if (!idol) return;

  if (action === "suspend_activities") {
    const score =
      scandalScoreFromDetail(event.detail as Record<string, unknown> | undefined) ||
      Number(catalogRow?.score ?? 0) ||
      3;
    const endDate = isoDay(catalogRow?.suspension_end_date);
    const suspensionDays = endDate ? daysBetweenIso(day, endDate) : null;
    const preview = computeScandalConsequences("suspend_activities", {
      score,
      groupFans: 0,
      idolFans: 0,
      suspensionDays: suspensionDays != null && suspensionDays > 0 ? suspensionDays : null,
      daysToNextLive: null,
      nextLivePrestige: 0.55,
    });
    applyActivitySuspension(idol, day, preview);
    return;
  }

  if (action !== "demote_leader") return;
  const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
  const entry = history.find((row) => {
    const uid = String(row.group_uid ?? "").trim();
    const name = norm(row.group_name ?? "");
    return (
      (uid && uid === String(event.group_uid ?? "")) || (name && name === norm(event.group_name ?? ""))
    );
  });
  if (entry) removeRolesFromStint(entry, catalogRow?.demote_roles || ["leader"], day);
}

function scenarioEventTargetsManagedGroupLocal(save: GameSavePayload, event: Record<string, unknown>): boolean {
  const group = getPrimaryGroup(save);
  if (!group) return false;
  const eventUid = String(event.group_uid ?? "").trim();
  const playerUid = String(group.uid ?? "").trim();
  if (eventUid) return eventUid === playerUid;
  const eventName = String(event.group_name ?? "").trim();
  const playerName = String(group.name ?? save.managing_group ?? "").trim();
  return Boolean(eventName) && eventName === playerName;
}

/** Collect nested scandal rows for severity / attribute readers. */
export function collectIdolScandalRows(idol: Record<string, unknown>): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = [];
  const top = Array.isArray(idol.status_history) ? idol.status_history : [];
  for (const raw of top) {
    if (raw && typeof raw === "object") out.push(raw as Record<string, unknown>);
  }
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const statuses = Array.isArray(entry.status_history) ? entry.status_history : [];
    for (const s of statuses) {
      if (s && typeof s === "object") out.push(s as Record<string, unknown>);
    }
  }
  return out;
}

export function maxActiveScandalScore(idol: Record<string, unknown>, refDate: string): number {
  const day = isoDay(refDate);
  let max = 0;
  for (const row of collectIdolScandalRows(idol)) {
    if (String(row.kind ?? "").trim().toLowerCase() !== "scandal") continue;
    const start = isoDay(row.start_date);
    const end = isoDay(row.end_date);
    if (start && start > day) continue;
    if (end && end < day) continue;
    const score = scandalScoreFromDetail(row);
    if (score > max) max = score;
  }
  return max;
}
