/**
 * Scenario 3 =LOVE Featured Trial — save bootstrap, audition pool, opening week mail.
 */

import type { LoadedScenario, EqualLoveTrialState } from "../data/scenarioTypes";
import type { GameSavePayload } from "../save/gameSaveSchema";
import {
  createGameSaveFromLoadedScenario,
  findScenarioGroupByLabel,
  normalizeGameSavePayload,
} from "../save/gameSaveSchema";
import { addNotification } from "../save/inbox";
import { combineIsoDateTime, isoDatePart, SIMULATION_DAY_START_TIME } from "./gameEngine";
import { getAttributeV2Truth, attributeV2FromV1 } from "./attributeV2";
import { normalizePersistedAttributes } from "./idolAttributes";
import { applyInterviewKnowledgeBump, seedStaffKnowledgeForCandidate, type CandidateStaffKnowledge } from "./staffKnowledge";

export const S3_INTERVIEW_MINUTES = 45;

export type { EqualLoveTrialState } from "../data/scenarioTypes";
export type { EqualLoveTrialPhase } from "../data/scenarioTypes";

export function isEqualLoveFeaturedTrialPreset(loaded: LoadedScenario): boolean {
  return loaded.preset.entry_mode === "featured_trial" && loaded.preset.scenario_number === 3;
}

function candidateUidsFromScenario(loaded: LoadedScenario): string[] {
  return loaded.idols
    .filter((row) => Boolean((row as { audition_candidate?: unknown }).audition_candidate))
    .map((row) => String((row as { uid?: unknown }).uid ?? "").trim())
    .filter((uid) => uid.length > 0);
}

function tifSongUids(loaded: LoadedScenario): string[] {
  return loaded.songs
    .filter((row) => String((row as { rehearsal_priority?: unknown }).rehearsal_priority ?? "") === "tif_debut")
    .map((row) => String((row as { uid?: unknown }).uid ?? "").trim())
    .filter((uid) => uid.length > 0);
}

function seedOpeningNotifications(save: GameSavePayload, loaded: LoadedScenario, opening: string): void {
  const mandate = loaded.agency_mandate ?? {};
  const agency = String(mandate.agency_partner ?? "代々木アニメーション学院");
  const target = mandate.target_roster ?? 13;
  const range = Array.isArray(mandate.recommended_range) ? mandate.recommended_range.join("–") : "11–14";
  const playerName = String(loaded.preset.player_character ?? save.player_name ?? "Producer");

  addNotification(save, {
    title: "Agency project mandate — =LOVE",
    body:
      `From: ${agency}\nTo: ${playerName}\nSubject: =LOVE voice-idol project briefing\n\n` +
      `You are confirmed as producer under a fixed agency mandate. This frame cannot be rewritten.\n\n` +
      `Target roster: about ${target} (recommended ${range})\n` +
      `Live debut window: ${String(mandate.live_debut_window ?? "summer 2017")}\n` +
      `Commercial debut: ${String(mandate.commercial_debut_plan ?? "autumn 2017")}\n` +
      `Direction: ${String(mandate.core_direction ?? "mainstream idol + voice acting")}\n\n` +
      `103 finalists remain in the final audition pool. Staff will carry daily observation — you cannot personally watch every room.`,
    sender: "Agency",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:00:00",
    unread: true,
    requiresConfirmation: true,
    dedupeKey: `s3-mandate|${opening}`,
  });

  addNotification(save, {
    title: "Staff introductions",
    body:
      "Your core staff team is in place: vocal coach, dance coach, idol managers, and project coordinator.\n\n" +
      "Member attribute panels show staff-team estimates, not exact truth. Individual staff reports may disagree.\n\n" +
      "Use direct interaction deliberately — time is the only resource, and you still carry HKT48 / media obligations.",
    sender: "Assistant",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:05:00",
    unread: true,
    dedupeKey: `s3-staff|${opening}`,
  });

  addNotification(save, {
    title: "Opening week schedule",
    body:
      "Key anchors this week:\n" +
      "• Apr 7 — HKT48 Spring Kanto Tour (Matsudo): live presentation tutorial\n" +
      "• Apr 10 — Audition Camp Week 1 opens (103 candidates)\n" +
      "• Apr 15 — First cut decision\n\n" +
      "Apr 3–9 is your producer tutorial week. Review the candidate overview before camp intensity rises.",
    sender: "Assistant",
    category: "guidance",
    level: "normal",
    isoDate: opening,
    createdTime: "09:06:00",
    unread: true,
    dedupeKey: `s3-calendar|${opening}`,
  });

  addNotification(save, {
    title: "Dual role reminder",
    body:
      "Before your 2019 idol graduation you remain an active HKT48 / AKB48 member and media talent.\n\n" +
      "Schedule load: High · Producer availability: Limited · Industry influence: Very High\n\n" +
      "Influence opens doors (festivals, press, composers) — it does not raise member singing or dance stats.",
    sender: "Assistant",
    category: "background",
    level: "normal",
    isoDate: opening,
    createdTime: "09:07:00",
    unread: true,
    dedupeKey: `s3-dual-role|${opening}`,
  });
}

/** Bootstrap a featured-trial save — fixed player, empty =LOVE roster, full audition pool. */
export function createEqualLoveFeaturedTrialSave(loaded: LoadedScenario, opts: { playerName: string }): GameSavePayload {
  const label = String(loaded.preset.managed_group_label ?? "=LOVE").trim();
  const uid = String(loaded.preset.managed_group_uid ?? "").trim();
  const group =
    (uid ? loaded.groups.find((g) => String(g.uid ?? "") === uid) : null) ??
    findScenarioGroupByLabel(loaded.groups, label);
  if (!group) throw new Error(`=LOVE project group missing for featured trial (${label})`);

  const playerName = opts.playerName.trim() || String(loaded.preset.player_character ?? "指原莉乃");
  const save = createGameSaveFromLoadedScenario(loaded, {
    playerName,
    managedGroupLabel: label,
    managedGroupUid: String(group.uid ?? uid),
  });

  const opening = String(loaded.preset.opening_date ?? "2017-04-03");
  const candidates = candidateUidsFromScenario(loaded);

  save.managing_group = label;
  save.managing_group_uid = String(group.uid ?? uid);
  save.player_name = playerName;
  save.account_name = playerName;
  save.game_start_date = opening;
  save.current_date = combineIsoDateTime(opening, SIMULATION_DAY_START_TIME);
  save.inbox.notifications = [];

  const mandate = { ...(loaded.agency_mandate ?? {}) };
  save.equal_love_trial = {
    phase: "opening_week",
    entry_mode: "featured_trial",
    start_phase: "equal_love_audition",
    pool_size: candidates.length,
    candidate_uids: [...candidates],
    active_candidate_uids: [...candidates],
    selected_member_uids: [],
    first_cut_done: false,
    final_selection_done: false,
    player_dual_role: {
      schedule_load: "high",
      producer_availability: "limited",
      industry_influence: "very_high",
    },
    agency_mandate: mandate,
    tif_setlist_uids: tifSongUids(loaded),
  } satisfies EqualLoveTrialState;

  if (Array.isArray(loaded.future_events) && loaded.future_events.length) {
    save.scenario_runtime.future_events = JSON.parse(JSON.stringify(loaded.future_events));
  }

  ensureAttributeV2OnSnapshot(save);
  save.equal_love_trial.staff_knowledge = seedStaffKnowledgePool(save, opening);
  save.equal_love_trial.idols_roster_filter = "candidates";
  save.equal_love_trial.producer_minutes_remaining_today = defaultProducerMinutesForDay(opening, save.equal_love_trial.dual_role_blocked_dates ?? []);
  save.equal_love_trial.dual_role_blocked_dates = buildDualRoleBlockedDates();

  seedOpeningNotifications(save, loaded, opening);
  return normalizeGameSavePayload(save);
}

function buildDualRoleBlockedDates(): string[] {
  return [
    "2017-04-07",
    "2017-04-14",
    "2017-04-16",
    "2017-04-22",
    "2017-04-23",
    "2017-05-06",
    "2017-05-13",
    "2017-05-14",
    "2017-05-28",
    "2017-06-17",
    "2017-06-24",
    "2017-06-25",
    "2017-07-08",
    "2017-07-16",
    "2017-07-17",
  ];
}

function ensureAttributeV2OnSnapshot(save: GameSavePayload): void {
  for (const row of save.database_snapshot.idols as Record<string, unknown>[]) {
    if (row.attributes_v2 && typeof row.attributes_v2 === "object") continue;
    const v1 = row.attributes ? normalizePersistedAttributes(row.attributes) : undefined;
    row.attributes_v2 = v1 ? attributeV2FromV1(v1) : getAttributeV2Truth(row);
  }
}

function seedStaffKnowledgePool(save: GameSavePayload, opening: string): Record<string, CandidateStaffKnowledge> {
  const out: Record<string, CandidateStaffKnowledge> = {};
  const trial = save.equal_love_trial;
  if (!trial) return out;
  for (const uid of trial.candidate_uids) {
    const row = (save.database_snapshot.idols as Record<string, unknown>[]).find((i) => String(i.uid ?? "") === uid);
    if (!row) continue;
    out[uid] = seedStaffKnowledgeForCandidate(uid, row, opening);
  }
  return out;
}

export function auditionCandidatesForSave(save: GameSavePayload): Record<string, unknown>[] {
  const trial = save.equal_love_trial;
  if (!trial) return [];
  const active = new Set(trial.active_candidate_uids ?? []);
  return (save.database_snapshot.idols as Record<string, unknown>[]).filter((row) =>
    active.has(String(row.uid ?? "")),
  );
}

export function activeAuditionPoolCount(save: GameSavePayload): number {
  return save.equal_love_trial?.active_candidate_uids?.length ?? 0;
}

export function isS3TrialSave(save: GameSavePayload | null | undefined): boolean {
  return Boolean(save?.equal_love_trial?.entry_mode === "featured_trial");
}

export function s3IdolsRosterFilter(save: GameSavePayload): "candidates" | "selected" {
  return save.equal_love_trial?.idols_roster_filter === "selected" ? "selected" : "candidates";
}

/** Filter idol rows for S3 Candidates vs Selected members tab. */
export function filterIdolsForS3Roster(save: GameSavePayload, idols: Record<string, unknown>[]): Record<string, unknown>[] {
  const trial = save.equal_love_trial;
  if (!trial) return idols;
  const filter = s3IdolsRosterFilter(save);
  if (filter === "selected") {
    const selected = new Set(trial.selected_member_uids ?? []);
    return idols.filter((row) => selected.has(String(row.uid ?? "")));
  }
  const active = new Set(trial.active_candidate_uids ?? trial.candidate_uids ?? []);
  return idols.filter((row) => active.has(String(row.uid ?? "")));
}

export function staffKnowledgeForIdol(save: GameSavePayload, idolUid: string): CandidateStaffKnowledge | null {
  const map = save.equal_love_trial?.staff_knowledge;
  if (!map) return null;
  return map[idolUid] ?? null;
}

export function producerMinutesRemainingToday(save: GameSavePayload): number {
  return save.equal_love_trial?.producer_minutes_remaining_today ?? 480;
}

export function defaultProducerMinutesForDay(isoDate: string, blockedDates: string[] = []): number {
  return blockedDates.includes(isoDate.split("T")[0]) ? 120 : 480;
}

function addMinutesToSimulationIso(iso: string, minutes: number): string {
  const normalized = iso.includes("T") ? iso : combineIsoDateTime(iso, "08:00:00");
  const ms = Date.parse(normalized.endsWith("Z") ? normalized : `${normalized}Z`);
  const next = new Date(ms + minutes * 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${next.getUTCFullYear()}-${pad(next.getUTCMonth() + 1)}-${pad(next.getUTCDate())}T${pad(next.getUTCHours())}:${pad(next.getUTCMinutes())}:00`;
}

export function syncProducerDayBudget(save: GameSavePayload): void {
  const trial = save.equal_love_trial;
  if (!trial) return;
  const day = isoDatePart(save.current_date ?? save.game_start_date);
  const blocked = trial.dual_role_blocked_dates ?? [];
  if (trial.producer_minutes_remaining_today == null) {
    trial.producer_minutes_remaining_today = defaultProducerMinutesForDay(day, blocked);
  }
}

/** Run a 45-minute candidate interview — time pass + staff knowledge bump. */
export function runS3CandidateInterview(
  save: GameSavePayload,
  idolUid: string,
): { ok: true; traitHint: string | null } | { ok: false; reason: string } {
  const trial = save.equal_love_trial;
  if (!trial) return { ok: false, reason: "Not an S3 featured trial save." };
  syncProducerDayBudget(save);

  const uid = idolUid.trim();
  const active = new Set(trial.active_candidate_uids ?? []);
  if (!active.has(uid)) return { ok: false, reason: "Candidate is not in the active audition pool." };

  const minutesLeft = trial.producer_minutes_remaining_today ?? defaultProducerMinutesForDay(isoDatePart(save.current_date), trial.dual_role_blocked_dates ?? []);
  if (minutesLeft < S3_INTERVIEW_MINUTES) {
    return { ok: false, reason: "Not enough producer time left today (45 min required)." };
  }

  const row = (save.database_snapshot.idols as Record<string, unknown>[]).find((i) => String(i.uid ?? "") === uid);
  if (!row) return { ok: false, reason: "Idol not found." };

  const knowledge = trial.staff_knowledge?.[uid] ?? seedStaffKnowledgeForCandidate(uid, row, isoDatePart(save.current_date));
  const v1 = row.attributes ? normalizePersistedAttributes(row.attributes) : undefined;
  const truth = getAttributeV2Truth(row, v1);
  const interviewIso = isoDatePart(save.current_date ?? save.game_start_date);
  const { knowledge: nextKnowledge, traitHint } = applyInterviewKnowledgeBump(knowledge, truth, interviewIso);

  if (!trial.staff_knowledge) trial.staff_knowledge = {};
  trial.staff_knowledge[uid] = nextKnowledge;
  trial.producer_minutes_remaining_today = minutesLeft - S3_INTERVIEW_MINUTES;

  const beforeIso = String(save.current_date ?? save.game_start_date ?? interviewIso);
  const afterIso = addMinutesToSimulationIso(beforeIso, S3_INTERVIEW_MINUTES);
  save.current_date = afterIso;

  return { ok: true, traitHint };
}

export function setS3IdolsRosterFilter(save: GameSavePayload, filter: "candidates" | "selected"): void {
  if (!save.equal_love_trial) return;
  save.equal_love_trial.idols_roster_filter = filter;
}

export function isDualRoleHeavyDay(save: GameSavePayload, isoDate: string): boolean {
  const dates = save.equal_love_trial?.dual_role_blocked_dates ?? [];
  return dates.includes(isoDate.split("T")[0]);
}
