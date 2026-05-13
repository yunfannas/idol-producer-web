/**
 * Game save shape aligned with idol_producer/game_save.py (schema version 11).
 * Normalization mirrors GameSave.normalize_payload where practical.
 */

import type { WebPreviewBundle } from "../types";
import type { LoadedScenario } from "../data/scenarioTypes";
import {
  scenarioStartingCash,
  defaultFinances,
  normalizeFinances,
  inferLetterTier,
  normalizeGroupLetterTier,
  resolveGroupLetterTier,
} from "../engine/financeSystem";
import type { Finances, LetterTier } from "../engine/types";
import { applyAttributesToAllIdols } from "../engine/idolAttributes";
import {
  defaultAutopilotTrainingIntensity,
  ensureIdolSimulationDefaults,
  normalizeTrainingWeekLog,
} from "../engine/idolStatusSystem";
import { buildFilteredSnapshotWithFutureEvents } from "../engine/scenarioRuntimeWeb";
import { buildDefaultScoutCompanies } from "../engine/scoutWeb";
import { addNotification, type NotificationRow } from "./inbox";

export const GAME_SAVE_VERSION = 11 as const;

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
): DatabaseSnapshot {
  return {
    idols: JSON.parse(JSON.stringify(idols)),
    groups: JSON.parse(JSON.stringify(groups)),
    songs: JSON.parse(JSON.stringify(songs)),
  };
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
  const snap = deepSnapshot(filtered.idols, filtered.groups, loaded.songs);
  applyAttributesToAllIdols(snap.idols, snap.groups, opening);

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
        `Managed group "${resolvedJa}" is not in this scenario's curated new-game allowlist (startup_allowlist.json / docs/scenario6_available_groups.txt).`,
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
    if (row) ensureIdolSimulationDefaults(row as Record<string, unknown>);
  }

  const save = defaultGameSavePayload();
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
  save.shortlist = [...memberUids];
  for (const uid of memberUids) {
    save.training_intensity[uid] = { ...defaultAutopilotTrainingIntensity() };
    save.training_focus_skill[uid] = "talking";
  }
  save.game_start_date = opening;
  save.current_date = opening;
  save.turn_number = 0;
  save.finances = defaultFinances(cash);
  save.inbox.notifications = [];
  save.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
  const gid = String(g.uid);

  const memberLines = memberUids
    .map((uid) => {
      const row = snap.idols.find((i) => String(i.uid ?? "") === uid) as Record<string, unknown> | undefined;
      const ja = row && typeof row.name === "string" ? row.name : uid.slice(0, 8);
      const ro =
        row && typeof row.romaji === "string" && String(row.romaji).trim()
          ? ` · ${String(row.romaji).trim()}`
          : "";
      return `· ${ja}${ro}`;
    })
    .join("\n");

  addNotification(save, {
    title: "Welcome to your managed roster",
    body: `You are producing ${String(g.name_romanji ?? g.name ?? "this group")}.\n\nCurrent lineup:\n${memberLines || "· (no members resolved)"}`,
    sender: "Assistant",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:01:00",
    unread: true,
    dedupeKey: `startup-roster|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Training defaults need review",
    body:
      "Autopilot training sliders start at a balanced mix (sing / dance / physical / target). Open Training to tune load per member before the first heavy live stretch.",
    sender: "Assistant",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:02:00",
    unread: true,
    dedupeKey: `startup-training|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Upcoming lives (autopilot)",
    body:
      "Routine one-man lives are inserted on the web schedule when calendar offset from opening satisfies offset mod 7 === 3 (same rule as NEXT DAY). You will get a blocking Today's live schedule inbox item on those mornings — confirm with Live Start before advancing again.",
    sender: "Assistant",
    category: "guidance",
    level: "high",
    isoDate: opening,
    createdTime: "09:03:00",
    unread: true,
    dedupeKey: `startup-lives|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Morning atmosphere in the room",
    body: `The practice room feels tense but hopeful this morning. ${String(g.name ?? g.name_romanji ?? "The group")} are waiting for direction, and the early mood suggests they want a plan they can trust.`,
    sender: "News",
    category: "background",
    level: "normal",
    isoDate: opening,
    createdTime: "09:04:00",
    unread: true,
    dedupeKey: `startup-room|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Staff briefing before opening week",
    body: "Staff note: focus the first week on stability, punctual rehearsals, and visible small wins. If the members feel the routine is clear, morale should settle before the first heavy stretch of lives.",
    sender: "Assistant",
    category: "background",
    level: "normal",
    isoDate: opening,
    createdTime: "09:05:00",
    unread: true,
    dedupeKey: `startup-staff|${gid}|${opening}`,
  });

  addNotification(save, {
    title: "Production started",
    body: `${save.player_name ? `Producer ${save.player_name} · ` : ""}Scenario ${loaded.preset.scenario_number}: ${loaded.preset.name}. ${String(g.name_romanji ?? g.name)} · ¥${cash.toLocaleString("ja-JP")} opening cash.`,
    sender: "Assistant",
    category: "general",
    isoDate: opening,
    createdTime: "09:06:00",
    unread: true,
    dedupeKey: `production-started|${gid}|${opening}`,
  });

  return normalizeGameSavePayload(save);
}

export interface LivesBlock {
  schedules: unknown[];
  results: unknown[];
}

export interface ScoutBlock {
  selected_company_uid: string | null;
  auditions: Record<string, unknown>;
}

export interface GameSavePayload {
  version: typeof GAME_SAVE_VERSION;
  player_name: string;
  managing_group: string | null;
  managing_group_uid: string | null;
  scenario_context: ScenarioContext;
  database_snapshot: DatabaseSnapshot;
  scenario_runtime: { future_events: Record<string, unknown>[] };
  shortlist: string[];
  inbox: { notifications: NotificationRow[] };
  schedules: Record<string, unknown>;
  lives: LivesBlock;
  finances: Finances | Record<string, unknown>;
  training_intensity: Record<string, Record<string, unknown>>;
  training_week_log: Record<string, unknown>;
  training_focus_skill: Record<string, string>;
  scout: ScoutBlock;
  /** ISO date · optional until first simulated day settles in desktop; web sets at new game */
  game_start_date?: string;
  current_date?: string;
  turn_number?: number;
}

function deepCopy<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
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
    player_name: "",
    managing_group: null,
    managing_group_uid: null,
    scenario_context: defaultScenarioContext(),
    database_snapshot: { idols: [], groups: [], songs: [] },
    scenario_runtime: { future_events: [] },
    shortlist: [],
    inbox: { notifications: [] },
    schedules: {},
    lives: { schedules: [], results: [] },
    finances: defaultPendingFinances() as unknown as Finances,
    training_intensity: {},
    training_week_log: {},
    training_focus_skill: {},
    scout: { selected_company_uid: null, auditions: {} },
  };
}

/** Merge loaded JSON toward v11 defaults (subset of desktop normalize_payload). */
export function normalizeGameSavePayload(raw: unknown): GameSavePayload {
  const base = defaultGameSavePayload();
  if (!raw || typeof raw !== "object") return base;

  const p = raw as Record<string, unknown>;
  const out = deepCopy(base);

  if (typeof p.version === "number") out.version = GAME_SAVE_VERSION;

  if (p.player_name != null) out.player_name = String(p.player_name ?? "").trim();
  if ("managing_group" in p) out.managing_group = p.managing_group == null ? null : String(p.managing_group);
  if ("managing_group_uid" in p) {
    out.managing_group_uid = p.managing_group_uid == null ? null : String(p.managing_group_uid);
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
  }

  if (p.scenario_runtime && typeof p.scenario_runtime === "object") {
    const fe = (p.scenario_runtime as { future_events?: unknown }).future_events;
    if (Array.isArray(fe)) {
      out.scenario_runtime.future_events = fe.filter((x): x is Record<string, unknown> => typeof x === "object");
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
  }

  if (p.current_date != null) out.current_date = String(p.current_date).split("T")[0];
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

  out.version = GAME_SAVE_VERSION;
  return out;
}

/**
 * Replace save snapshot songs with the in-memory scenario catalog when the save still
 * has the old disc-only `songs.json` (few rows per group) but catalog has per-track rows.
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
  if (merged.length <= save.database_snapshot.songs.length) return false;
  save.database_snapshot.songs = merged;
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
  save.shortlist = [...(g.member_uids?.map(String) ?? [])];
  applyAttributesToAllIdols(save.database_snapshot.idols, save.database_snapshot.groups, opening);
  for (const uid of save.shortlist) {
    save.training_intensity[uid] = { ...defaultAutopilotTrainingIntensity() };
    save.training_focus_skill[uid] = "talking";
    const row = save.database_snapshot.idols.find((r) => String(r.uid ?? "") === uid);
    if (row) ensureIdolSimulationDefaults(row as Record<string, unknown>);
  }
  save.game_start_date = opening;
  save.current_date = opening;
  save.turn_number = 0;
  save.finances = defaultFinances(cash);
  save.inbox.notifications = [];

  save.scenario_runtime = { future_events: [] };
  save.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;

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
