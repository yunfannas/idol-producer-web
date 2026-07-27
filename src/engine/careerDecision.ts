/**
 * Career Decision catalog + effects.
 *
 * Initiation stays in the existing notification system:
 * - Outbound leaves/transfers: managed_group_leave (Departure decision)
 * - Recruits: Scout → shortlist → shortlist_signing_offer
 *
 * This module supplies catalog metadata, retain/suppress effects, and Scout pins.
 */

import type { GameSavePayload } from "../save/gameSaveSchema";
import { getPrimaryGroup } from "../save/gameSaveSchema";
import { addNotification } from "../save/inbox";

export type CareerDecisionKind = "graduation" | "outbound_transfer" | "contested_recruit";

export type CareerOutcomeStatus =
  | "pending"
  | "acknowledged"
  | "retained"
  | "released"
  | "recruited"
  | "expired"
  | "locked";

export type CareerDestination = {
  group_uid: string;
  group_name: string;
  join_date: string;
};

export type CareerDecisionDef = {
  id: string;
  kind: CareerDecisionKind;
  negotiable: boolean;
  idol_uid: string;
  idol_name: string;
  source_group_uid?: string;
  source_group_name?: string;
  announce_date: string;
  effective_date: string;
  window_start?: string;
  window_end?: string;
  destination?: CareerDestination;
  follow_on_join?: CareerDestination & { start_date?: string };
  previous_group_name?: string;
  lock_reason?: string;
  retain?: {
    salary_bump_yen?: number;
    morale_delta?: number;
    promise_core_role?: boolean;
  };
  note?: string;
};

export type CareerOutcomeRow = {
  decision_id: string;
  idol_uid: string;
  kind: CareerDecisionKind;
  status: CareerOutcomeStatus;
  decided_at?: string;
  effective_date?: string;
  suppressed_event_uids: string[];
  promises?: string[];
};

export type CareerDecisionsBlock = {
  outcomes: CareerOutcomeRow[];
  seeded_inbox_keys: string[];
};

type CareerCatalog = { decisions: CareerDecisionDef[] };

let catalog: CareerCatalog | null = null;
let loadPromise: Promise<void> | null = null;

function base(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

function isoDay(value: unknown): string {
  return String(value ?? "").split("T")[0];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function norm(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
}

export function defaultCareerDecisionsBlock(): CareerDecisionsBlock {
  return { outcomes: [], seeded_inbox_keys: [] };
}

export function normalizeCareerDecisionsBlock(raw: unknown): CareerDecisionsBlock {
  const baseBlock = defaultCareerDecisionsBlock();
  if (!raw || typeof raw !== "object") return baseBlock;
  const row = raw as Record<string, unknown>;
  const outcomesRaw = Array.isArray(row.outcomes) ? row.outcomes : [];
  const seededRaw = Array.isArray(row.seeded_inbox_keys) ? row.seeded_inbox_keys : [];
  const outcomes: CareerOutcomeRow[] = [];
  for (const item of outcomesRaw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const decisionId = String(o.decision_id ?? "").trim();
    const idolUid = String(o.idol_uid ?? "").trim();
    const kind = String(o.kind ?? "").trim() as CareerDecisionKind;
    const status = String(o.status ?? "").trim() as CareerOutcomeStatus;
    if (!decisionId || !idolUid) continue;
    if (!["graduation", "outbound_transfer", "contested_recruit"].includes(kind)) continue;
    outcomes.push({
      decision_id: decisionId,
      idol_uid: idolUid,
      kind,
      status: status || "pending",
      decided_at: isoDay(o.decided_at) || undefined,
      effective_date: isoDay(o.effective_date) || undefined,
      suppressed_event_uids: Array.isArray(o.suppressed_event_uids)
        ? o.suppressed_event_uids.map((x) => String(x)).filter(Boolean)
        : [],
      promises: Array.isArray(o.promises) ? o.promises.map((x) => String(x)).filter(Boolean) : undefined,
    });
  }
  return {
    outcomes,
    seeded_inbox_keys: seededRaw.map((x) => String(x)).filter(Boolean),
  };
}

export function preloadCareerDecisions(): Promise<void> {
  if (catalog) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(`${base()}data/reference/career_decisions.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      catalog = (await res.json()) as CareerCatalog;
    } catch (err) {
      console.warn("[careerDecision] preload failed", err);
      catalog = { decisions: [] };
    }
  })();
  return loadPromise;
}

export function getCareerDecisionDefs(): CareerDecisionDef[] {
  return catalog?.decisions ?? [];
}

export function careerDecisionById(id: string): CareerDecisionDef | null {
  return getCareerDecisionDefs().find((d) => d.id === id) ?? null;
}

function ensureCareerBlock(save: GameSavePayload): CareerDecisionsBlock {
  const anySave = save as GameSavePayload & { career_decisions?: CareerDecisionsBlock };
  if (!anySave.career_decisions) anySave.career_decisions = defaultCareerDecisionsBlock();
  anySave.career_decisions = normalizeCareerDecisionsBlock(anySave.career_decisions);
  return anySave.career_decisions;
}

function outcomeFor(save: GameSavePayload, decisionId: string): CareerOutcomeRow | null {
  return ensureCareerBlock(save).outcomes.find((o) => o.decision_id === decisionId) ?? null;
}

function upsertOutcome(save: GameSavePayload, row: CareerOutcomeRow): void {
  const block = ensureCareerBlock(save);
  const idx = block.outcomes.findIndex((o) => o.decision_id === row.decision_id);
  if (idx >= 0) block.outcomes[idx] = row;
  else block.outcomes.push(row);
}

function managedMatchesSource(save: GameSavePayload, def: CareerDecisionDef): boolean {
  const group = getPrimaryGroup(save);
  if (!group) return false;
  const uid = String(group.uid ?? "").trim();
  const name = norm(group.name ?? save.managing_group ?? "");
  if (def.source_group_uid && uid === def.source_group_uid) return true;
  if (def.source_group_name && name === norm(def.source_group_name)) return true;
  return false;
}

function managedMatchesDestination(save: GameSavePayload, def: CareerDecisionDef): boolean {
  const dest = def.destination;
  if (!dest) return false;
  const group = getPrimaryGroup(save);
  if (!group) return false;
  const uid = String(group.uid ?? "").trim();
  const name = norm(group.name ?? save.managing_group ?? "");
  if (dest.group_uid && uid === dest.group_uid) return true;
  if (dest.group_name && name === norm(dest.group_name)) return true;
  return false;
}

function idolByUid(save: GameSavePayload, uid: string): Record<string, unknown> | null {
  return (
    (save.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid) as Record<string, unknown> | undefined) ??
    null
  );
}

function isIdolOnManagedRoster(save: GameSavePayload, idolUid: string): boolean {
  const group = getPrimaryGroup(save);
  const members = Array.isArray(group?.member_uids) ? group!.member_uids.map(String) : [];
  return members.includes(idolUid);
}

function suppressMatchingFutureEvents(
  save: GameSavePayload,
  matcher: (event: Record<string, unknown>) => boolean,
): string[] {
  const events = Array.isArray(save.scenario_runtime?.future_events) ? save.scenario_runtime.future_events : [];
  const kept: Record<string, unknown>[] = [];
  const suppressed: string[] = [];
  for (const raw of events) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as Record<string, unknown>;
    if (matcher(event)) {
      const uid = String(event.uid ?? `${event.type}|${event.idol_uid}|${event.effective_date}`);
      suppressed.push(uid);
      continue;
    }
    kept.push(event);
  }
  save.scenario_runtime.future_events = kept;
  return suppressed;
}

function clearOpenHistoryEnd(
  idol: Record<string, unknown>,
  groupUid: string,
  groupName?: string,
): void {
  const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
  for (const entry of history) {
    const uid = String(entry.group_uid ?? "").trim();
    const name = norm(entry.group_name ?? "");
    if ((groupUid && uid === groupUid) || (groupName && name === norm(groupName))) {
      if (entry.end_date) entry.end_date = "";
    }
  }
}

function removeDestinationHistoryJoin(
  idol: Record<string, unknown>,
  destination: CareerDestination,
): void {
  const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
  idol.group_history = history.filter((entry) => {
    const uid = String(entry.group_uid ?? "").trim();
    const name = norm(entry.group_name ?? "");
    const start = isoDay(entry.start_date);
    const matchesDest =
      (destination.group_uid && uid === destination.group_uid) ||
      (destination.group_name && name === norm(destination.group_name));
    if (!matchesDest) return true;
    if (start && destination.join_date && start === destination.join_date) return false;
    return true;
  });
}

/** Match a managed leave event to a career catalog row (graduation / outbound transfer). */
export function careerLeaveDecisionForEvent(
  save: GameSavePayload,
  event: Record<string, unknown>,
): CareerDecisionDef | null {
  const idolUid = String(event.idol_uid ?? "").trim();
  const effective = isoDay(event.effective_date);
  if (!idolUid || !effective) return null;
  for (const def of getCareerDecisionDefs()) {
    if (def.kind !== "graduation" && def.kind !== "outbound_transfer") continue;
    if (def.idol_uid !== idolUid) continue;
    if (!managedMatchesSource(save, def)) continue;
    if (def.effective_date && def.effective_date !== effective) continue;
    return def;
  }
  return null;
}

/** Active contested recruit windows visible in Scout. */
export function contestedRecruitWindowsForDate(
  save: GameSavePayload,
  currentIso: string,
): Array<CareerDecisionDef & { reason: string }> {
  const day = isoDay(currentIso);
  const out: Array<CareerDecisionDef & { reason: string }> = [];
  for (const def of getCareerDecisionDefs()) {
    if (def.kind !== "contested_recruit") continue;
    const start = isoDay(def.window_start ?? def.announce_date);
    const end = isoDay(def.window_end ?? def.effective_date);
    if (!start || !end || day < start || day > end) continue;
    const outcome = outcomeFor(save, def.id);
    if (outcome && ["recruited", "expired", "released"].includes(outcome.status)) continue;
    if (isIdolOnManagedRoster(save, def.idol_uid)) continue;
    const destName = def.destination?.group_name ?? "another group";
    const inbound = managedMatchesDestination(save, def);
    out.push({
      ...def,
      reason: inbound
        ? `Career window · historical inbound to ${destName}`
        : `Career window · contested vs ${destName}`,
    });
  }
  return out;
}

/**
 * Apply retain effects after a managed_group_leave "keep" choice.
 * Also used when catalog marks the leave as a negotiable outbound transfer.
 */
export function applyCareerKeepForLeaveEvent(
  save: GameSavePayload,
  event: Record<string, unknown>,
  decidedAt: string,
): { def: CareerDecisionDef | null; suppressedUids: string[] } {
  const def = careerLeaveDecisionForEvent(save, event);
  const idolUid = String(event.idol_uid ?? "").trim();
  const idol = idolByUid(save, idolUid);
  if (!idol) return { def: null, suppressedUids: [] };

  // Always clear the scheduled leave end on keep (desktop behavior + history hygiene).
  const groupUid = String(event.group_uid ?? "").trim();
  const groupName = String(event.group_name ?? "").trim();
  clearOpenHistoryEnd(idol, groupUid, groupName);

  if (!def || def.kind === "graduation" || !def.negotiable) {
    return { def, suppressedUids: [String(event.uid ?? "")].filter(Boolean) };
  }

  const suppressed = suppressMatchingFutureEvents(save, (future) => {
    if (String(future.idol_uid ?? "") !== def.idol_uid) return false;
    const type = String(future.type ?? "");
    const effective = isoDay(future.effective_date);
    const futureGroupUid = String(future.group_uid ?? "").trim();
    const futureGroupName = norm(future.group_name ?? "");
    if (type === "idol_leave_group") {
      const matchesSource =
        (def.source_group_uid && futureGroupUid === def.source_group_uid) ||
        (def.source_group_name && futureGroupName === norm(def.source_group_name)) ||
        (groupUid && futureGroupUid === groupUid);
      return Boolean(matchesSource && (!def.effective_date || effective === def.effective_date || !effective));
    }
    if (type === "idol_join_group" && def.destination) {
      const matchesDest =
        (def.destination.group_uid && futureGroupUid === def.destination.group_uid) ||
        (def.destination.group_name && futureGroupName === norm(def.destination.group_name));
      return Boolean(matchesDest);
    }
    return false;
  });

  if (def.destination) removeDestinationHistoryJoin(idol, def.destination);

  const bump = Number(def.retain?.salary_bump_yen ?? 0) || 0;
  if (bump > 0) {
    idol.contract_salary_yen = Math.max(0, Number(idol.contract_salary_yen ?? 0) || 0) + bump;
  }
  const moraleDelta = Number(def.retain?.morale_delta ?? 0) || 0;
  if (moraleDelta) {
    idol.morale = Math.round(clamp(Number(idol.morale ?? 70) + moraleDelta, 0, 100));
  }

  const promises: string[] = [];
  if (def.retain?.promise_core_role) promises.push("core_role");

  upsertOutcome(save, {
    decision_id: def.id,
    idol_uid: def.idol_uid,
    kind: def.kind,
    status: "retained",
    decided_at: isoDay(decidedAt),
    effective_date: def.effective_date,
    suppressed_event_uids: suppressed,
    promises,
  });
  return { def, suppressedUids: suppressed };
}

/** Mark catalog outcome when a managed leave is allowed to proceed. */
export function applyCareerReleaseForLeaveEvent(
  save: GameSavePayload,
  event: Record<string, unknown>,
  decidedAt: string,
): CareerDecisionDef | null {
  const def = careerLeaveDecisionForEvent(save, event);
  if (!def) return null;
  upsertOutcome(save, {
    decision_id: def.id,
    idol_uid: def.idol_uid,
    kind: def.kind,
    status: def.kind === "graduation" ? "acknowledged" : "released",
    decided_at: isoDay(decidedAt),
    effective_date: def.effective_date,
    suppressed_event_uids: [],
  });
  return def;
}

/**
 * Called after player signs an idol onto the managed group.
 * If she was a contested recruit, suppress the historical destination join.
 */
export function noteCareerRecruitSigned(save: GameSavePayload, idolUid: string, signedAt: string): string | null {
  const day = isoDay(signedAt);
  for (const def of getCareerDecisionDefs()) {
    if (def.kind !== "contested_recruit") continue;
    if (def.idol_uid !== idolUid) continue;
    const start = isoDay(def.window_start ?? def.announce_date);
    const end = isoDay(def.window_end ?? def.effective_date);
    if (start && day < start) continue;
    if (end && day > end) continue;
    const existing = outcomeFor(save, def.id);
    if (existing?.status === "recruited") return def.id;

    const suppressed = suppressMatchingFutureEvents(save, (event) => {
      if (String(event.idol_uid ?? "") !== idolUid) return false;
      if (String(event.type ?? "") !== "idol_join_group") return false;
      if (!def.destination) return false;
      const groupUid = String(event.group_uid ?? "").trim();
      const groupName = norm(event.group_name ?? "");
      const matchesDest =
        (def.destination.group_uid && groupUid === def.destination.group_uid) ||
        (def.destination.group_name && groupName === norm(def.destination.group_name));
      return Boolean(matchesDest);
    });

    const idol = idolByUid(save, idolUid);
    if (idol && def.destination && !managedMatchesDestination(save, def)) {
      removeDestinationHistoryJoin(idol, def.destination);
    }

    upsertOutcome(save, {
      decision_id: def.id,
      idol_uid: idolUid,
      kind: "contested_recruit",
      status: "recruited",
      decided_at: day,
      effective_date: def.effective_date,
      suppressed_event_uids: suppressed,
    });
    return def.id;
  }
  return null;
}

function seedInboxOnce(save: GameSavePayload, key: string, builder: () => void): void {
  const block = ensureCareerBlock(save);
  if (block.seeded_inbox_keys.includes(key)) return;
  builder();
  block.seeded_inbox_keys.push(key);
}

/** Early informational notice for locked graduations (actual gate is managed_group_leave). */
function seedGraduationNotice(save: GameSavePayload, def: CareerDecisionDef, day: string): void {
  if (!managedMatchesSource(save, def)) return;
  if (!isIdolOnManagedRoster(save, def.idol_uid)) return;
  const key = `career|grad|${def.id}|${def.announce_date}`;
  seedInboxOnce(save, key, () => {
    addNotification(save, {
      title: `Graduation announced: ${def.idol_name}`,
      body:
        `${def.idol_name}'s graduation is confirmed for ${def.effective_date}.\n` +
        `${def.lock_reason ?? "This decision is locked."}\n` +
        `The departure decision will appear on the leave date; retention is not available.`,
      sender: "Management",
      category: "news",
      level: "high",
      isoDate: day,
      unread: true,
      requiresConfirmation: false,
      dedupeKey: key,
      relatedEventUid: def.idol_uid,
      reportData: {
        kind: "career_graduation_notice",
        decision_id: def.id,
        idol_uid: def.idol_uid,
        idol_name: def.idol_name,
        effective_date: def.effective_date,
        negotiable: false,
      },
    });
  });
  if (!outcomeFor(save, def.id)) {
    upsertOutcome(save, {
      decision_id: def.id,
      idol_uid: def.idol_uid,
      kind: "graduation",
      status: "locked",
      effective_date: def.effective_date,
      suppressed_event_uids: [],
    });
  }
}

function expireOpenWindows(save: GameSavePayload, day: string): void {
  for (const def of getCareerDecisionDefs()) {
    const outcome = outcomeFor(save, def.id);
    if (!outcome || outcome.status !== "pending") continue;
    if (def.kind === "contested_recruit") {
      const end = isoDay(def.window_end ?? def.effective_date);
      if (end && day > end && !isIdolOnManagedRoster(save, def.idol_uid)) {
        upsertOutcome(save, { ...outcome, status: "expired", decided_at: day });
      }
    }
  }
}

/**
 * Day-advance hook: early graduation notice + expire recruit windows.
 * Transfer/recruit initiation uses managed_group_leave / shortlist signing.
 */
export function processCareerDecisionsForDate(save: GameSavePayload, targetIso: string): void {
  if (!catalog) return;
  const day = isoDay(targetIso);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return;
  ensureCareerBlock(save);

  for (const def of getCareerDecisionDefs()) {
    if (day < def.announce_date) continue;
    if (def.kind === "graduation") seedGraduationNotice(save, def, day);
  }
  expireOpenWindows(save, day);
}
