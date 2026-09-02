/**
 * Game save shape aligned with idol_producer/game_save.py (schema version 11).
 * Normalization mirrors GameSave.normalize_payload where practical.
 */

import type { WebPreviewBundle } from "../types";
import type { LoadedScenario, OfficialScheduleBundle, SharedReleaseRow } from "../data/scenarioTypes";
import {
  scenarioStartingCash,
  defaultFinances,
  normalizeFinances,
  inferLetterTier,
  normalizeGroupLetterTier,
  resolveGroupLetterTier,
  monthlyBaseSalaryYenForGroupLetterTier,
  defaultGoodsInventory,
  normalizeGoodsInventory,
  type ProducedGoodsRow,
} from "../engine/financeSystem";
import type { Finances, LetterTier } from "../engine/types";
import { applyAttributesToAllIdols } from "../engine/idolAttributes";
import {
  defaultAutopilotTrainingIntensity,
  ensureIdolSimulationDefaults,
  normalizeTrainingWeekLog,
} from "../engine/idolStatusSystem";
import {
  normalizeManagedSongStatus,
  normalizeTrainingSongSelection,
  type ManagedSongStatusRow,
} from "../engine/songStatusSystem";
import { normalizeManagedSongFormations, type SongStartingFormation } from "../data/songStartingFormation";
import { buildFilteredSnapshotWithFutureEvents, applyScenarioEventsForDate } from "../engine/scenarioRuntimeWeb";
import { syncOpenHiatusToIdolTopLevel } from "../engine/scandalHandling";
import { buildDefaultScoutCompanies, normalizeScoutSubscriptions } from "../engine/scoutWeb";
import { addNotification, type NotificationRow } from "./inbox";

export const GAME_SAVE_VERSION = 11 as const;

function startOfMonthIso(isoDate: string): string {
  const [y, m] = String(isoDate).split("T")[0].split("-");
  return `${y}-${m}-01`;
}

function addMonths(monthStartIso: string, delta: number): string {
  const [y, m] = monthStartIso.split("-").map((part) => Number(part));
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return dt.toISOString().slice(0, 10);
}

function endOfMonthIso(monthStartIso: string): string {
  const [y, m] = monthStartIso.split("-").map((part) => Number(part));
  const dt = new Date(Date.UTC(y, m, 0));
  return dt.toISOString().slice(0, 10);
}

export interface ScenarioContext {
  startup_date: string | null;
  idols_path: string | null;
  groups_path: string | null;
  songs_path: string | null;
  shared_attributes_path: string | null;
  idols_signature: string | null;
  groups_signature: string | null;
  songs_signature: string | null;
  shared_attributes_signature: string | null;
}

export interface DatabaseSnapshot {
  idols: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  songs: Record<string, unknown>[];
  shared_releases: SharedReleaseRow[];
}

export function findScenarioGroupByLabel(
  groups: Record<string, unknown>[],
  label: string,
): Record<string, unknown> | null {
  const n = label.trim().toLowerCase();
  for (const g of groups) {
    const rj = String(g.name_romanji ?? "").trim().toLowerCase();
    const nm = String(g.name ?? "").trim().toLowerCase();
    if (rj === n || nm === n) return g;
  }
  return null;
}

function deepSnapshot(
  idols: Record<string, unknown>[],
  groups: Record<string, unknown>[],
  songs: Record<string, unknown>[],
  shared_releases: SharedReleaseRow[],
): DatabaseSnapshot {
  return {
    idols: JSON.parse(JSON.stringify(idols)),
    groups: JSON.parse(JSON.stringify(groups)),
    songs: JSON.parse(JSON.stringify(songs)),
    shared_releases: JSON.parse(JSON.stringify(shared_releases)),
  };
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function estimatedGroupFanReach(group: Record<string, unknown>): number {
  const popularity = Math.max(0, num(group.popularity, 0));
  const fans = Math.max(0, num(group.fans, 0));
  const xFollowers = Math.max(0, num(group.x_followers, 0));
  const tier = resolveGroupLetterTier(group);
  const tierFloor: Record<LetterTier, number> = {
    S: 180000,
    A: 80000,
    B: 30000,
    C: 10000,
    D: 3500,
    E: 1200,
    F: 300,
    I: 0,
  };
  const popularityFloor = Math.round(tierFloor[tier] * (0.35 + popularity / 100));
  const followerFloor = Math.round(xFollowers * (0.12 + popularity / 500));
  return Math.max(fans, popularityFloor, followerFloor);
}

function backfillGroupMemberFanCounts(
  idols: Record<string, unknown>[],
  group: Record<string, unknown> | null | undefined,
): void {
  if (!group) return;
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  if (!memberUids.length) return;
  const members = memberUids
    .map((uid) => idols.find((idol) => String(idol.uid ?? "") === uid))
    .filter((idol): idol is Record<string, unknown> => Boolean(idol));
  if (!members.length) return;

  const groupReach = estimatedGroupFanReach(group);
  const totalX = members.reduce((sum, idol) => sum + Math.max(0, num(idol.x_followers, 0)), 0);
  const popularity = Math.max(0, num(group.popularity, 0));
  const memberCount = Math.max(1, members.length);

  for (const idol of members) {
    ensureIdolSimulationDefaults(idol);
    const currentFans = Math.max(0, num(idol.fan_count, 0));
    if (currentFans > 0) continue;
    const idolX = Math.max(0, num(idol.x_followers, 0));
    const equalShare = 1 / memberCount;
    const xShare = totalX > 0 ? idolX / totalX : equalShare;
    const blendedShare = equalShare * 0.35 + xShare * 0.65;
    const groupPortion = groupReach * blendedShare;
    const personalPortion = idolX * (0.16 + popularity / 500);
    const seededFans = Math.max(idolX > 0 || groupReach > 0 ? 1 : 0, Math.round(groupPortion + personalPortion));
    idol.fan_count = seededFans;
  }
}

function managedGoodsMembers(saveLike: {
  managing_group_uid: string | null;
  database_snapshot: DatabaseSnapshot;
}): Array<{ uid: string; name: string }> {
  const group =
    saveLike.database_snapshot.groups.find((row) => String(row.uid ?? "") === String(saveLike.managing_group_uid ?? "")) ?? null;
  const memberUids = Array.isArray(group?.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  return memberUids
    .map((uid) => {
      const idol = saveLike.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid);
      return idol ? { uid, name: String(idol.name ?? idol.name_romanji ?? uid) } : null;
    })
    .filter((row): row is { uid: string; name: string } => Boolean(row));
}

/**
 * Fresh save with full idols / groups / songs (save-owned mutable DB), scenario metadata, and default attributes.
 */
export function createGameSaveFromLoadedScenario(
  loaded: LoadedScenario,
  opts: { playerName: string; managedGroupLabel: string; managedGroupUid?: string | null },
): GameSavePayload {
  const opening =
    loaded.preset.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(loaded.preset.opening_date)
      ? loaded.preset.opening_date
      : "2020-01-01";
  const filtered = buildFilteredSnapshotWithFutureEvents(loaded.idols, loaded.groups, opening);
  const snap = deepSnapshot(filtered.idols, filtered.groups, loaded.songs, loaded.shared_releases ?? []);
  applyAttributesToAllIdols(snap.idols, snap.groups, opening, loaded.role_attribute_model);

  const g =
    (opts.managedGroupUid
      ? snap.groups.find((row) => String(row.uid ?? "") === opts.managedGroupUid)
      : null) ??
    findScenarioGroupByLabel(snap.groups, opts.managedGroupLabel) ??
    findScenarioGroupByLabel(snap.groups, loaded.preset.startup_group ?? "") ??
    null;

  if (!g || !g.uid) {
    throw new Error(`Could not resolve managed group for label ${opts.managedGroupLabel}`);
  }

  const allowNames = loaded.startup_allowlist?.names_in_order;
  if (allowNames?.length) {
    const allowed = new Set(allowNames.map((n) => String(n ?? "").trim()).filter((n) => n.length > 0));
    const resolvedJa = String(g.name ?? "").trim();
    if (!allowed.has(resolvedJa)) {
      throw new Error(
        `Managed group "${resolvedJa}" is not in this scenario's curated new-game allowlist (startup_allowlist.json / support/docs/scenario6_available_groups.txt).`,
      );
    }
  }

  const popularity = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const staticT = loaded.group_tiers?.find((r) => String(r.uid ?? "") === String(g.uid ?? ""));
  const tier =
    staticT && typeof staticT.letter_tier === "string" && /^[SABCDEF]$/i.test(staticT.letter_tier.trim())
      ? normalizeGroupLetterTier(staticT.letter_tier)
      : inferLetterTier(popularity, fans, 0);
  g.letter_tier = tier;
  g.web_scenario_number = loaded.preset.scenario_number;

  const memberUids = Array.isArray(g.member_uids) ? g.member_uids.map((x) => String(x)) : [];
  const subdir = loaded.preset.data_subdir;
  const cash = scenarioStartingCash(loaded.preset.scenario_number);

  for (const uid of memberUids) {
    const row = snap.idols.find((i) => String(i.uid ?? "") === uid);
    if (row) {
      ensureIdolSimulationDefaults(row as Record<string, unknown>);
      syncOpenHiatusToIdolTopLevel(row as Record<string, unknown>, opening);
    }
  }
  backfillGroupMemberFanCounts(snap.idols, g);

  const save = defaultGameSavePayload();
  save.account_name = opts.playerName.trim();
  save.player_name = opts.playerName.trim();
  save.managing_group = String(g.name_romanji ?? g.name ?? "");
  save.managing_group_uid = String(g.uid);
  save.scenario_context = {
    ...defaultScenarioContext(),
    startup_date: opening,
    idols_path: `web://scenarios/${subdir}/idols.json`,
    groups_path: `web://scenarios/${subdir}/groups.json`,
    songs_path: `web://scenarios/${subdir}/songs.json`,
  };
  save.database_snapshot = snap;
  save.scenario_runtime.future_events = filtered.futureEvents;
  save.scenario_runtime.official_schedules = deepCopy(loaded.official_schedules ?? []);
  save.shortlist = [];
  save.goods_inventory = defaultGoodsInventory(managedGoodsMembers(save));
  {
    const policy = ensureGroupPolicy(save);
    for (const uid of memberUids) {
      save.training_intensity[uid] = { ...policy.training.default_intensity };
      save.training_focus_skill[uid] = policy.training.default_focus;
    }
  }
  save.game_start_date = opening;
  save.current_date = opening;
  save.managed_song_status = normalizeManagedSongStatus(
    {},
    save.database_snapshot.songs,
    String(g.uid),
    opening,
    memberUids.length,
  );
  save.training_song_uids = [];
  save.turn_number = 0;
  save.finances = defaultFinances(cash);
  ensureManagedContracts(save);
  save.inbox.notifications = [];
  save.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
  const gid = String(g.uid);

  addNotification(save, {
    title: "Roster overview",
    body: `Current roster for ${String(g.name_romanji ?? g.name ?? "this group")} is attached below. Open any idol profile from this mail to review history before planning the first week.`,
    sender: "Assistant",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:02:00",
    unread: true,
    dedupeKey: `startup-roster|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Upcoming lives",
    body: startupUpcomingLivesBody(save, opening),
    sender: "Assistant",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:04:00",
    unread: true,
    dedupeKey: `startup-lives|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Staff briefing before opening week",
    body:
      "Assistant briefing:\n\nTraining sessions run in fixed blocks: morning 08:00-12:00 and afternoon 13:00-17:00.\nPlease review the weekly assignments schedule and the idol status table before the first heavy stretch.\n\nThe default sliders are balanced for now, but each member's workload and focus should be confirmed before the weekend.",
    sender: "Assistant",
    category: "background",
    level: "normal",
    isoDate: opening,
    createdTime: "09:03:00",
    unread: true,
    dedupeKey: `startup-staff|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Production started",
    body:
      `From: Assistant\nTo: ${save.player_name ? `Producer ${save.player_name}` : "Producer"}\nSubject: Management handoff for ${String(g.name_romanji ?? g.name)}\n\nYou are now in charge of ${String(g.name_romanji ?? g.name)} for scenario ${loaded.preset.scenario_number}: ${loaded.preset.name}.\nOpening cash on hand: \u00A5${cash.toLocaleString("ja-JP")}.\n\nPlease review the roster, the training plan, and the upcoming live calendar, including TIF appearances where they are already booked.`,
    sender: "Assistant",
    category: "general",
    isoDate: opening,
    createdTime: "09:01:00",
    unread: true,
    dedupeKey: `production-started|${gid}|${opening}`,
  });

  // Open due scenario gates (e.g. 春野莉々 post-suspension leave) on day one.
  applyScenarioEventsForDate(save, opening);

  return normalizeGameSavePayload(save);
}

export interface LivesBlock {
  schedules: unknown[];
  results: unknown[];
}

export interface ScoutBlock {
  selected_company_uid: string | null;
  auditions: Record<string, unknown>;
  subscriptions: Record<string, { company_uid: string; subscribed_at: string }>;
}

export type CareerOutcomeStatus =
  | "pending"
  | "acknowledged"
  | "retained"
  | "released"
  | "recruited"
  | "expired"
  | "locked";

export type CareerDecisionKind = "graduation" | "outbound_transfer" | "contested_recruit";

export interface CareerOutcomeRow {
  decision_id: string;
  idol_uid: string;
  kind: CareerDecisionKind;
  status: CareerOutcomeStatus;
  decided_at?: string;
  effective_date?: string;
  suppressed_event_uids: string[];
  promises?: string[];
}

export interface CareerDecisionsBlock {
  outcomes: CareerOutcomeRow[];
  seeded_inbox_keys: string[];
}

export interface CdReleaseProject {
  uid: string;
  title: string;
  release_kind: "single" | "album";
  song_uids: string[];
  released_digital_song_uids?: string[];
}

export interface SaveTutorialState {
  completed: boolean;
  disabled: boolean;
}

const DEFAULT_TRAINING_ROLE_BENCHMARK_PREFERENCES = ["singing", "dancing", "teamwork", "content", "streaming", "fashion"] as const;
const TRAINING_ROLE_BENCHMARK_PREFERENCE_SET = new Set<string>(DEFAULT_TRAINING_ROLE_BENCHMARK_PREFERENCES);
const POLICY_FOCUS_SKILL_SET = new Set(["", "talking", "host", "variety", "acting", "make-up", "model"]);

export interface GroupPolicySnsFlags {
  x: boolean;
  tiktok: boolean;
  instagram: boolean;
  youtube: boolean;
}

export interface GroupPolicyTrainingDefaults {
  default_intensity: { sing: number; dance: number; physical: number; target: number };
  default_focus: string;
}

export interface GroupPolicy {
  live: {
    prerecorded_vocals_by_member: Record<string, boolean>;
    tokutenkai_enabled: boolean;
    goods_enabled: boolean;
    /** null = off; otherwise target stock per SKU when auto-refill exists */
    auto_goods_refill: number | null;
  };
  sns: {
    by_member: Record<string, GroupPolicySnsFlags>;
  };
  stream: {
    showroom_hours_per_week: number;
    tiktok_hours_per_week: number;
    instagram_hours_per_week: number;
  };
  training: GroupPolicyTrainingDefaults;
}

function clampPolicyLevel(v: unknown, fallback: number): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function clampPolicyHours(v: unknown, fallback = 0): number {
  const n = typeof v === "number" && Number.isFinite(v) ? v : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(168, Math.round(n)));
}

export function defaultGroupPolicy(): GroupPolicy {
  const intensity = defaultAutopilotTrainingIntensity();
  return {
    live: {
      prerecorded_vocals_by_member: {},
      tokutenkai_enabled: true,
      goods_enabled: true,
      auto_goods_refill: null,
    },
    sns: { by_member: {} },
    stream: {
      showroom_hours_per_week: 0,
      tiktok_hours_per_week: 0,
      instagram_hours_per_week: 0,
    },
    training: {
      default_intensity: { ...intensity },
      default_focus: "talking",
    },
  };
}

export function normalizeGroupPolicy(raw: unknown): GroupPolicy {
  const base = defaultGroupPolicy();
  if (!raw || typeof raw !== "object") return base;
  const p = raw as Record<string, unknown>;

  if (p.live && typeof p.live === "object") {
    const live = p.live as Record<string, unknown>;
    if (typeof live.tokutenkai_enabled === "boolean") base.live.tokutenkai_enabled = live.tokutenkai_enabled;
    if (typeof live.goods_enabled === "boolean") base.live.goods_enabled = live.goods_enabled;
    if (live.auto_goods_refill == null) {
      base.live.auto_goods_refill = null;
    } else {
      const n = Number(live.auto_goods_refill);
      base.live.auto_goods_refill = Number.isFinite(n) && n > 0 ? Math.round(n) : null;
    }
    if (live.prerecorded_vocals_by_member && typeof live.prerecorded_vocals_by_member === "object") {
      const map: Record<string, boolean> = {};
      for (const [uid, on] of Object.entries(live.prerecorded_vocals_by_member as Record<string, unknown>)) {
        const key = String(uid ?? "").trim();
        if (!key) continue;
        map[key] = on === true;
      }
      base.live.prerecorded_vocals_by_member = map;
    }
  }

  if (p.sns && typeof p.sns === "object") {
    const sns = p.sns as Record<string, unknown>;
    if (sns.by_member && typeof sns.by_member === "object") {
      const map: Record<string, GroupPolicySnsFlags> = {};
      for (const [uid, flags] of Object.entries(sns.by_member as Record<string, unknown>)) {
        const key = String(uid ?? "").trim();
        if (!key || !flags || typeof flags !== "object") continue;
        const f = flags as Record<string, unknown>;
        map[key] = {
          x: f.x === true,
          tiktok: f.tiktok === true,
          instagram: f.instagram === true,
          youtube: f.youtube === true,
        };
      }
      base.sns.by_member = map;
    }
  }

  if (p.stream && typeof p.stream === "object") {
    const stream = p.stream as Record<string, unknown>;
    base.stream.showroom_hours_per_week = clampPolicyHours(stream.showroom_hours_per_week, 0);
    base.stream.tiktok_hours_per_week = clampPolicyHours(stream.tiktok_hours_per_week, 0);
    base.stream.instagram_hours_per_week = clampPolicyHours(stream.instagram_hours_per_week, 0);
  }

  if (p.training && typeof p.training === "object") {
    const training = p.training as Record<string, unknown>;
    const intensity =
      training.default_intensity && typeof training.default_intensity === "object"
        ? (training.default_intensity as Record<string, unknown>)
        : {};
    const fallback = defaultAutopilotTrainingIntensity();
    base.training.default_intensity = {
      sing: clampPolicyLevel(intensity.sing, fallback.sing),
      dance: clampPolicyLevel(intensity.dance, fallback.dance),
      physical: clampPolicyLevel(intensity.physical, fallback.physical),
      target: clampPolicyLevel(intensity.target, fallback.target),
    };
    const focus = String(training.default_focus ?? "talking");
    base.training.default_focus = POLICY_FOCUS_SKILL_SET.has(focus) ? focus : "talking";
  }

  return base;
}

export function ensureGroupPolicy(save: GameSavePayload): GroupPolicy {
  save.group_policy = normalizeGroupPolicy(save.group_policy);
  return save.group_policy;
}

export interface GameSavePayload {
  version: typeof GAME_SAVE_VERSION;
  account_name?: string;
  player_name: string;
  managing_group: string | null;
  managing_group_uid: string | null;
  scenario_context: ScenarioContext;
  database_snapshot: DatabaseSnapshot;
  scenario_runtime: {
    future_events: Record<string, unknown>[];
    official_schedules?: OfficialScheduleBundle[];
  };
  shortlist: string[];
  cd_projects: CdReleaseProject[];
  goods_inventory: ProducedGoodsRow[];
  inbox: { notifications: NotificationRow[] };
  schedules: Record<string, unknown>;
  lives: LivesBlock;
  finances: Finances | Record<string, unknown>;
  training_intensity: Record<string, Record<string, unknown>>;
  training_week_log: Record<string, unknown>;
  training_focus_skill: Record<string, string>;
  training_role_benchmark_preferences: string[];
  managed_song_status: Record<string, ManagedSongStatusRow>;
  /** Player-authored starting formations keyed by song uid (overrides catalog). */
  managed_song_formations: Record<string, SongStartingFormation>;
  training_song_uids: string[];
  /** Group default ops policy (live / SNS / stream / training). */
  group_policy: GroupPolicy;
  tutorial: SaveTutorialState;
  scout: ScoutBlock;
  career_decisions: CareerDecisionsBlock;
  /** ISO date · optional until first simulated day settles in desktop; web sets at new game */
  game_start_date?: string;
  current_date?: string;
  turn_number?: number;
}

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}

function managedContractDefaultEndDate(startIso: string): string {
  const datePart = String(startIso ?? "").split("T")[0];
  const match = /^(\d{4})-\d{2}-\d{2}$/.exec(datePart);
  const year = match ? Number(match[1]) : 2020;
  return `${String(year + 1).padStart(4, "0")}-12-31`;
}

function managedContractJoinDate(
  idol: Record<string, unknown>,
  groupUid: string,
  groupNames: Set<string>,
  fallbackIso: string,
): string {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const uid = String(row.group_uid ?? "").trim();
    const name = String(row.group_name ?? "").trim();
    if (uid === groupUid || (name && groupNames.has(name))) {
      const start = String(row.start_date ?? "").split("T")[0];
      if (/^\d{4}-\d{2}-\d{2}$/.test(start)) return start;
    }
  }
  return String(fallbackIso ?? "").split("T")[0] || "2020-01-01";
}

export function ensureManagedContracts(save: GameSavePayload): void {
  const group = getPrimaryGroup(save);
  if (!group) return;
  const groupUid = String(group.uid ?? "").trim();
  const groupNames = new Set(
    [String(group.name ?? "").trim(), String(group.name_romanji ?? "").trim()].filter(Boolean),
  );
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  const baseSalary = monthlyBaseSalaryYenForGroupLetterTier(resolveGroupLetterTier(group));
  const fallbackStart = String(save.game_start_date ?? save.current_date ?? save.scenario_context.startup_date ?? "2020-01-01");
  const defaultEnd = managedContractDefaultEndDate(fallbackStart);
  for (const uid of memberUids) {
    const idol = save.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid);
    if (!idol || typeof idol !== "object") continue;
    const row = idol as Record<string, unknown>;
    if (!(typeof row.contract_salary_yen === "number" && Number.isFinite(row.contract_salary_yen))) {
      row.contract_salary_yen = baseSalary;
    }
    if (typeof row.contract_start_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.contract_start_date))) {
      row.contract_start_date = managedContractJoinDate(row, groupUid, groupNames, fallbackStart);
    }
    if (typeof row.contract_end_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.contract_end_date))) {
      row.contract_end_date = defaultEnd;
    }
  }
}

function startupUpcomingLivesBody(save: GameSavePayload, openingIso: string): string {
  const startIso = String(openingIso).split("T")[0];
  const thisMonth = startOfMonthIso(startIso);
  const nextMonth = addMonths(thisMonth, 1);
  const endIso = endOfMonthIso(nextMonth);
  const seen = new Set<string>();
  const rows = save.lives.schedules
    .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
    .filter((live) => {
      const d = String(live.start_date ?? "").split("T")[0];
      return d >= startIso && d <= endIso;
    })
    .filter((live) => {
      const uid = String(live.uid ?? "").trim();
      const key =
        uid ||
        [
          String(live.start_date ?? "").split("T")[0],
          String(live.start_time ?? "").trim(),
          String(live.title ?? live.live_type ?? "Live").trim(),
          String(live.venue ?? "TBA").trim(),
        ].join("|");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  return rows.length ? "" : "No booked lives.";
}

export function refreshStartupUpcomingLivesNotification(save: GameSavePayload, openingIso?: string): void {
  const opening = String(openingIso ?? save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01").split("T")[0];
  const row = save.inbox.notifications.find((item) => String(item.dedupe_key ?? "").startsWith("startup-lives|"));
  if (!row) return;
  row.body = startupUpcomingLivesBody(save, opening);
}

export function defaultScenarioContext(): ScenarioContext {
  return {
    startup_date: null,
    idols_path: null,
    groups_path: null,
    songs_path: null,
    shared_attributes_path: null,
    idols_signature: null,
    groups_signature: null,
    songs_signature: null,
    shared_attributes_signature: null,
  };
}

/** Desktop `pending_init` finances (GameSave.default_finances) — replaced when sim runs. */
export function defaultPendingFinances(): Record<string, unknown> {
  return {
    status: "pending_init",
    cash_yen: null,
    currency: "JPY",
    notes: "Waiting for finance initialization.",
  };
}

export function defaultGameSavePayload(): GameSavePayload {
  return {
    version: GAME_SAVE_VERSION,
    account_name: "",
    player_name: "",
    managing_group: null,
    managing_group_uid: null,
    scenario_context: defaultScenarioContext(),
    database_snapshot: { idols: [], groups: [], songs: [], shared_releases: [] },
    scenario_runtime: { future_events: [], official_schedules: [] },
    shortlist: [],
    cd_projects: [],
    goods_inventory: [],
    inbox: { notifications: [] },
    schedules: {},
    lives: { schedules: [], results: [] },
    finances: defaultPendingFinances() as unknown as Finances,
    training_intensity: {},
    training_week_log: {},
    training_focus_skill: {},
    training_role_benchmark_preferences: [...DEFAULT_TRAINING_ROLE_BENCHMARK_PREFERENCES],
    managed_song_status: {},
    managed_song_formations: {},
    training_song_uids: [],
    group_policy: defaultGroupPolicy(),
    tutorial: { completed: false, disabled: false },
    scout: { selected_company_uid: null, auditions: {}, subscriptions: {} },
    career_decisions: { outcomes: [], seeded_inbox_keys: [] },
  };
}

/** Merge loaded JSON toward v11 defaults (subset of desktop normalize_payload). */
export function normalizeGameSavePayload(raw: unknown): GameSavePayload {
  const base = defaultGameSavePayload();
  if (!raw || typeof raw !== "object") return base;

  const p = raw as Record<string, unknown>;
  const out = deepCopy(base);

  if (typeof p.version === "number") out.version = GAME_SAVE_VERSION;

  if (p.account_name != null) out.account_name = String(p.account_name ?? "").trim();
  if (p.player_name != null) out.player_name = String(p.player_name ?? "").trim();
  if (!out.account_name && out.player_name) out.account_name = out.player_name;
  if ("managing_group" in p) out.managing_group = p.managing_group == null ? null : String(p.managing_group);
  if ("managing_group_uid" in p) {
    out.managing_group_uid = p.managing_group_uid == null ? null : String(p.managing_group_uid);
  }
  if (Array.isArray(p.cd_projects)) {
    out.cd_projects = p.cd_projects
      .map((rawRow, index) => {
        if (!rawRow || typeof rawRow !== "object") return null;
        const row = rawRow as Record<string, unknown>;
        const uid = String(row.uid ?? "").trim() || `cd-project-${index + 1}`;
        const release_kind = String(row.release_kind ?? "").trim() === "album" ? "album" : "single";
        const title = String(row.title ?? "").trim() || (release_kind === "album" ? "New album" : "New single");
        const song_uids = Array.isArray(row.song_uids)
          ? row.song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
          : [];
        const released_digital_song_uids = Array.isArray(row.released_digital_song_uids)
          ? row.released_digital_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
          : [];
        return {
          uid,
          title,
          release_kind,
          song_uids: song_uids.filter((value, valueIndex, arr) => arr.indexOf(value) === valueIndex),
          released_digital_song_uids: released_digital_song_uids.filter(
            (value, valueIndex, arr) => arr.indexOf(value) === valueIndex,
          ),
        } as CdReleaseProject;
      })
      .filter((row): row is CdReleaseProject => row != null);
  }

  if (p.scenario_context && typeof p.scenario_context === "object") {
    const c = p.scenario_context as Record<string, unknown>;
    const keys: (keyof ScenarioContext)[] = [
      "startup_date",
      "idols_path",
      "groups_path",
      "songs_path",
      "shared_attributes_path",
      "idols_signature",
      "groups_signature",
      "songs_signature",
      "shared_attributes_signature",
    ];
    for (const k of keys) {
      if (c[k] != null && c[k] !== undefined) {
        out.scenario_context[k] = String(c[k]);
      }
    }
  }

  if (p.database_snapshot && typeof p.database_snapshot === "object") {
    const snap = p.database_snapshot as DatabaseSnapshot;
    if (Array.isArray(snap.idols)) out.database_snapshot.idols = deepCopy(snap.idols);
    if (Array.isArray(snap.groups)) out.database_snapshot.groups = deepCopy(snap.groups);
    if (Array.isArray(snap.songs)) out.database_snapshot.songs = deepCopy(snap.songs);
    if (Array.isArray((snap as { shared_releases?: unknown }).shared_releases)) {
      out.database_snapshot.shared_releases = deepCopy(
        (snap as { shared_releases: SharedReleaseRow[] }).shared_releases,
      );
    }
  }

  if (p.scenario_runtime && typeof p.scenario_runtime === "object") {
    const runtime = p.scenario_runtime as { future_events?: unknown; official_schedules?: unknown };
    const fe = runtime.future_events;
    if (Array.isArray(fe)) {
      out.scenario_runtime.future_events = fe.filter((x): x is Record<string, unknown> => typeof x === "object");
    }
    const officialSchedules = runtime.official_schedules;
    if (Array.isArray(officialSchedules)) {
      out.scenario_runtime.official_schedules = officialSchedules.filter(
        (x): x is OfficialScheduleBundle => Boolean(x && typeof x === "object" && Array.isArray((x as { events?: unknown }).events)),
      );
    }
  }

  if (Array.isArray(p.shortlist)) {
    out.shortlist = (p.shortlist as unknown[]).map((x) => String(x));
  }

  if (p.inbox && typeof p.inbox === "object") {
    const rows = (p.inbox as { notifications?: unknown }).notifications;
    if (Array.isArray(rows)) {
      out.inbox.notifications = rows.filter((x): x is NotificationRow => typeof x === "object" && x !== null) as NotificationRow[];
    }
  }

  if (p.schedules && typeof p.schedules === "object" && !Array.isArray(p.schedules)) {
    out.schedules = deepCopy(p.schedules as Record<string, unknown>);
  }

  if (p.lives && typeof p.lives === "object") {
    const L = p.lives as LivesBlock;
    if (Array.isArray(L.schedules)) out.lives.schedules = [...L.schedules];
    if (Array.isArray(L.results)) out.lives.results = [...L.results];
  }

  if (p.finances && typeof p.finances === "object") {
    Object.assign(out.finances as Record<string, unknown>, p.finances as Record<string, unknown>);
  }

  if (p.scout && typeof p.scout === "object") {
    const sc = p.scout as ScoutBlock;
    if (sc.selected_company_uid != null) out.scout.selected_company_uid = String(sc.selected_company_uid);
    if (sc.auditions && typeof sc.auditions === "object") out.scout.auditions = deepCopy(sc.auditions);
    if (sc.subscriptions && typeof sc.subscriptions === "object") {
      out.scout.subscriptions = normalizeScoutSubscriptions(sc.subscriptions);
    }
  }

  if (p.current_date != null) out.current_date = String(p.current_date);
  if (p.game_start_date != null) out.game_start_date = String(p.game_start_date).split("T")[0];
  if (p.turn_number != null) {
    const t = Number(p.turn_number);
    if (!Number.isNaN(t)) out.turn_number = t;
  }

  if (p.training_intensity && typeof p.training_intensity === "object") {
    out.training_intensity = deepCopy(p.training_intensity as Record<string, Record<string, unknown>>);
    for (const cols of Object.values(out.training_intensity)) {
      if (typeof cols !== "object" || cols === null) continue;
      if ("misc" in cols && !("target" in cols)) {
        const misc = cols.misc;
        cols.target =
          typeof misc === "number" ? Math.max(0, Math.min(5, misc)) : Number(misc ?? 0) || 0;
        delete cols.misc;
      }
    }
  }

  if (p.training_week_log && typeof p.training_week_log === "object") {
    out.training_week_log = normalizeTrainingWeekLog(p.training_week_log) as unknown as Record<string, unknown>;
  }
  if (p.training_focus_skill && typeof p.training_focus_skill === "object") {
    out.training_focus_skill = deepCopy(p.training_focus_skill as Record<string, string>);
  }
  if (Array.isArray((p as { training_role_benchmark_preferences?: unknown }).training_role_benchmark_preferences)) {
    const seen = new Set<string>();
    out.training_role_benchmark_preferences = [];
    for (const raw of (p as { training_role_benchmark_preferences: unknown[] }).training_role_benchmark_preferences) {
      const key = String(raw ?? "").trim();
      if (!TRAINING_ROLE_BENCHMARK_PREFERENCE_SET.has(key) || seen.has(key)) continue;
      seen.add(key);
      out.training_role_benchmark_preferences.push(key);
    }
  }
  if (p.tutorial && typeof p.tutorial === "object") {
    const tutorial = p.tutorial as Record<string, unknown>;
    out.tutorial.completed = tutorial.completed === true;
    out.tutorial.disabled = tutorial.disabled === true;
  }

  for (const idol of out.database_snapshot.idols) {
    ensureIdolSimulationDefaults(idol);
  }
  for (const group of out.database_snapshot.groups) {
    backfillGroupMemberFanCounts(out.database_snapshot.idols, group);
  }
  out.goods_inventory = normalizeGoodsInventory(
    (p as { goods_inventory?: unknown }).goods_inventory,
    managedGoodsMembers(out),
  );
  const primaryGroup = getPrimaryGroup(out);
  const primaryGroupUid = String(primaryGroup?.uid ?? "").trim();
  const primaryMemberCount = Array.isArray(primaryGroup?.member_uids) ? primaryGroup!.member_uids.length : 0;
  out.managed_song_status = normalizeManagedSongStatus(
    (p as { managed_song_status?: unknown }).managed_song_status,
    out.database_snapshot.songs,
    primaryGroupUid,
    out.current_date ?? out.game_start_date ?? out.scenario_context.startup_date ?? null,
    primaryMemberCount,
  );
  out.managed_song_formations = normalizeManagedSongFormations(
    (p as { managed_song_formations?: unknown }).managed_song_formations,
  );
  out.training_song_uids = normalizeTrainingSongSelection(
    (p as { training_song_uids?: unknown }).training_song_uids,
    out.managed_song_status,
  );
  out.group_policy = normalizeGroupPolicy((p as { group_policy?: unknown }).group_policy);
  ensureManagedContracts(out);

  {
    const rawCareer = (p as { career_decisions?: unknown }).career_decisions;
    const outcomes: CareerOutcomeRow[] = [];
    const seeded: string[] = [];
    if (rawCareer && typeof rawCareer === "object") {
      const block = rawCareer as Record<string, unknown>;
      if (Array.isArray(block.outcomes)) {
        for (const item of block.outcomes) {
          if (!item || typeof item !== "object") continue;
          const row = item as Record<string, unknown>;
          const decisionId = String(row.decision_id ?? "").trim();
          const idolUid = String(row.idol_uid ?? "").trim();
          const kind = String(row.kind ?? "").trim() as CareerDecisionKind;
          const status = String(row.status ?? "").trim() as CareerOutcomeStatus;
          if (!decisionId || !idolUid) continue;
          if (!["graduation", "outbound_transfer", "contested_recruit"].includes(kind)) continue;
          outcomes.push({
            decision_id: decisionId,
            idol_uid: idolUid,
            kind,
            status: status || "pending",
            decided_at: String(row.decided_at ?? "").split("T")[0] || undefined,
            effective_date: String(row.effective_date ?? "").split("T")[0] || undefined,
            suppressed_event_uids: Array.isArray(row.suppressed_event_uids)
              ? row.suppressed_event_uids.map((x) => String(x)).filter(Boolean)
              : [],
            promises: Array.isArray(row.promises) ? row.promises.map((x) => String(x)).filter(Boolean) : undefined,
          });
        }
      }
      if (Array.isArray(block.seeded_inbox_keys)) {
        for (const key of block.seeded_inbox_keys) {
          const text = String(key ?? "").trim();
          if (text) seeded.push(text);
        }
      }
    }
    out.career_decisions = { outcomes, seeded_inbox_keys: seeded };
  }

  out.version = GAME_SAVE_VERSION;
  return out;
}

/**
 * Replace save snapshot songs with the in-memory scenario catalog when the save still
 * has the old disc-only `songs.json` (few rows per group) but catalog has per-track rows.
 * Also overlay streaming/preview URL fields onto existing rows when the catalog is richer.
 */
export function hydrateSnapshotSongsFromScenario(
  save: GameSavePayload,
  catalog: Record<string, unknown>[] | null | undefined,
  scenarioDataSubdir?: string | null,
): boolean {
  if (!catalog?.length) return false;
  if (scenarioDataSubdir) {
    const hint = `${save.scenario_context?.songs_path ?? ""}${save.scenario_context?.groups_path ?? ""}`;
    if (!hint.includes(scenarioDataSubdir)) return false;
  }
  const groupUids = new Set(
    save.database_snapshot.groups
      .map((g) => String((g as { uid?: unknown }).uid ?? "").trim())
      .filter((u) => u.length > 0),
  );
  if (!groupUids.size) return false;
  const merged = catalog.filter((s) =>
    groupUids.has(String((s as { group_uid?: unknown }).group_uid ?? "").trim()),
  );
  if (merged.length > save.database_snapshot.songs.length) {
    save.database_snapshot.songs = merged;
    return true;
  }

  // Same row count: still copy streaming / Apple id fields so previews keep working.
  const byUid = new Map(
    merged
      .map((row) => [String((row as { uid?: unknown }).uid ?? "").trim(), row] as const)
      .filter(([uid]) => Boolean(uid)),
  );
  let patched = 0;
  const STREAM_KEYS = [
    "apple_music_url",
    "apple_preview_url",
    "spotify_url",
    "spotify_preview_url",
    "_apple_track_ids",
  ] as const;
  for (const row of save.database_snapshot.songs) {
    const uid = String((row as { uid?: unknown }).uid ?? "").trim();
    const fresh = uid ? byUid.get(uid) : undefined;
    if (!fresh) continue;
    for (const key of STREAM_KEYS) {
      const next = (fresh as Record<string, unknown>)[key];
      if (next == null || next === "") continue;
      const cur = (row as Record<string, unknown>)[key];
      if (cur == null || cur === "" || JSON.stringify(cur) !== JSON.stringify(next)) {
        (row as Record<string, unknown>)[key] = next;
        patched += 1;
      }
    }
  }
  return patched > 0;
}

/**
 * Refresh save snapshot groups from the in-memory scenario catalog when group metadata
 * has been improved in shipped data (for example discography track lists or shared-release links).
 */
export function hydrateSnapshotGroupsFromScenario(
  save: GameSavePayload,
  catalog: Record<string, unknown>[] | null | undefined,
  scenarioDataSubdir?: string | null,
): boolean {
  if (!catalog?.length) return false;
  if (scenarioDataSubdir) {
    const hint = `${save.scenario_context?.songs_path ?? ""}${save.scenario_context?.groups_path ?? ""}`;
    if (!hint.includes(scenarioDataSubdir)) return false;
  }
  const groupUids = new Set(
    save.database_snapshot.groups
      .map((g) => String((g as { uid?: unknown }).uid ?? "").trim())
      .filter((u) => u.length > 0),
  );
  if (!groupUids.size) return false;
  const merged = catalog.filter((g) =>
    groupUids.has(String((g as { uid?: unknown }).uid ?? "").trim()),
  );
  if (merged.length !== save.database_snapshot.groups.length) return false;
  save.database_snapshot.groups = deepCopy(merged);
  return true;
}

export function getPrimaryGroup(save: GameSavePayload): Record<string, unknown> | null {
  const groups = save.database_snapshot.groups;
  if (!groups.length) return null;
  const uid = save.managing_group_uid;
  if (uid) {
    const hit = groups.find((g) => String(g.uid ?? "") === uid);
    if (hit) return hit;
  }
  return groups[0] ?? null;
}

export function getLetterTierFromGroup(group: Record<string, unknown> | null): LetterTier {
  return resolveGroupLetterTier(group ?? undefined);
}

export function getActiveFinances(save: GameSavePayload): Finances {
  const raw = save.finances as Partial<Finances> & Record<string, unknown>;
  const g = getPrimaryGroup(save);
  const scenarioRaw = g?.web_scenario_number ?? g?.scenario_number;
  const scenarioNum = typeof scenarioRaw === "number" ? scenarioRaw : Number(scenarioRaw ?? NaN);
  const fallbackStart = scenarioStartingCash(Number.isNaN(scenarioNum) ? null : scenarioNum);

  let startCash = fallbackStart;
  if (typeof raw.opening_cash_yen === "number") startCash = raw.opening_cash_yen;
  else if (typeof raw.cash_yen === "number") startCash = raw.cash_yen;

  return normalizeFinances(raw as Partial<Finances>, startCash);
}

/**
 * Bootstrap a desktop-shaped save from the static web preview bundle (seed content).
 */
export function createGameSaveFromPreviewBundle(bundle: WebPreviewBundle): GameSavePayload {
  const opening =
    bundle.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(bundle.opening_date) ? bundle.opening_date : "2020-01-01";
  const g = bundle.group;
  const popularity = typeof g.popularity === "number" ? g.popularity : 0;
  const fans = typeof g.fans === "number" ? g.fans : 0;
  const tier = inferLetterTier(popularity, fans, 0);

  const groupRow = {
    ...(g as unknown as Record<string, unknown>),
    letter_tier: tier,
    web_scenario_number: bundle.scenario_number ?? null,
  };

  const cash = scenarioStartingCash(bundle.scenario_number ?? null);

  const save = defaultGameSavePayload();
  save.managing_group = g.name_romanji ?? g.name ?? null;
  save.managing_group_uid = typeof g.uid === "string" ? g.uid : null;
  save.scenario_context.startup_date = opening;
  save.database_snapshot.groups = [groupRow];
  save.database_snapshot.idols = bundle.idols.map((i) => ({ ...(i as object) }));
  save.database_snapshot.songs = [];
  save.shortlist = [];
  save.goods_inventory = defaultGoodsInventory(managedGoodsMembers(save));
  save.managed_song_status = {};
  save.training_song_uids = [];
  applyAttributesToAllIdols(save.database_snapshot.idols, save.database_snapshot.groups, opening);
  {
    const policy = ensureGroupPolicy(save);
    for (const uid of g.member_uids?.map(String) ?? []) {
      save.training_intensity[uid] = { ...policy.training.default_intensity };
      save.training_focus_skill[uid] = policy.training.default_focus;
      const row = save.database_snapshot.idols.find((r) => String(r.uid ?? "") === uid);
      if (row) ensureIdolSimulationDefaults(row as Record<string, unknown>);
    }
  }
  backfillGroupMemberFanCounts(save.database_snapshot.idols, groupRow);
  save.game_start_date = opening;
  save.current_date = opening;
  save.turn_number = 0;
  save.finances = defaultFinances(cash);
  save.inbox.notifications = [];

  save.scenario_runtime = { future_events: [], official_schedules: [] };
  save.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
  save.scout.subscriptions = {};

  addNotification(save, {
    title: "Production started",
    body: `Scenario ${bundle.scenario_number ?? "?"} · ${g.name_romanji} · opening cash ¥${cash.toLocaleString("ja-JP")}`,
    sender: "Assistant",
    category: "general",
    isoDate: opening,
    unread: false,
  });

  return normalizeGameSavePayload(save);
}

