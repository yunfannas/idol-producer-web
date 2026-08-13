import type { GameSavePayload } from "../save/gameSaveSchema";
import { getPrimaryGroup } from "../save/gameSaveSchema";

export type HeroinesLeagueKind =
  | "league_i"
  | "league_ii"
  | "league"
  | "championship"
  | "promotion"
  | "promotion_final"
  | "additional_promotion"
  | "playoffs"
  | "fc_vote";

export type LeaguePanelTab = "current" | "history";

export type HeroinesLeagueSeason = {
  id: string;
  label: string;
  official_label: string;
  start_date: string;
  end_date: string | null;
  notes?: string;
};

export type HeroinesLeagueStandingRow = {
  rank: number;
  group_name: string;
  points: number;
  note?: string;
  active_members?: number;
  mobilization_context?: string;
};

export type HeroinesLeagueStandingSnapshot = {
  as_of: string;
  season_id: string;
  phase: string;
  source?: string;
  note?: string;
  tables: Partial<Record<"league_i" | "league_ii" | "promotion" | "championship", HeroinesLeagueStandingRow[]>>;
};

export type HeroinesLeagueScheduleRow = {
  date: string;
  season_id: string;
  kind: HeroinesLeagueKind;
  title: string;
  venue?: string | null;
  attending_groups?: string[];
};

export type HeroinesLeagueGroup = {
  name: string;
  uid: string | null;
};

export type HeroinesLeagueHistoryRecord = {
  season_id: string;
  date: string;
  title: string;
  venue?: string | null;
  source?: string;
  note?: string;
  tables: Partial<Record<"overall" | "league_i" | "league_ii" | "promotion" | "championship", HeroinesLeagueStandingRow[]>>;
};

export type HeroinesLeagueRoundResult = {
  date: string;
  round: number;
  venue?: string | null;
  field_size?: number;
  points_table?: number[];
  scoring?: string;
  source?: string;
  note?: string;
  results: HeroinesLeagueStandingRow[];
  cumulative: HeroinesLeagueStandingRow[];
};

export type HeroinesLeagueData = {
  seasons: HeroinesLeagueSeason[];
  groups: HeroinesLeagueGroup[];
  schedule: HeroinesLeagueScheduleRow[];
  standings_snapshots: HeroinesLeagueStandingSnapshot[];
  history_records?: HeroinesLeagueHistoryRecord[];
  scoring_rules?: Record<string, unknown>;
  regular_season_rounds?: {
    season_id: string;
    division: string;
    note?: string;
    worked_example_group?: string;
    rounds: HeroinesLeagueRoundResult[];
    akishibu_trajectory?: Array<{
      date: string;
      round: number;
      rank: number;
      points: number;
      cumulative: number;
      note?: string;
    }>;
  };
  promotion_rounds?: {
    season_id: string;
    series: string;
    note?: string;
    points_table?: number[];
    roster?: {
      from_league_i: Array<{ group_name: string; seed: string; note?: string }>;
      from_league_ii: Array<{ group_name: string; seed: string; note?: string }>;
    };
    worked_example_group?: string;
    rounds: Array<HeroinesLeagueRoundResult & { vol?: number }>;
    akishibu_trajectory?: Array<{
      date: string;
      vol: number;
      rank: number;
      points: number;
      cumulative: number;
      note?: string;
    }>;
  };
  design_notes?: {
    player_agency?: string;
    scoring?: string;
    akishibu_example?: string;
    akishibu_promotion?: string;
    live_causality?: string;
    mobilization_semantics?: string;
    gameplay_goals?: {
      primary?: string;
      recovery?: string;
      stretch?: string;
      reference_failure?: string;
    };
    agency_model?: {
      avoid?: string;
      long_term?: string;
      short_term?: string;
      lineup?: string;
      new_members?: string;
    };
  };
};

let leagueData: HeroinesLeagueData | null = null;
let loadPromise: Promise<void> | null = null;

function base(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

export function preloadHeroinesLeague(): Promise<void> {
  if (leagueData) return Promise.resolve();
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const res = await fetch(`${base()}data/reference/heroines_league.json`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      leagueData = (await res.json()) as HeroinesLeagueData;
    } catch (err) {
      console.warn("[heroinesLeague] preload failed", err);
      leagueData = { seasons: [], groups: [], schedule: [], standings_snapshots: [], history_records: [] };
    }
  })();
  return loadPromise;
}

export function getHeroinesLeagueData(): HeroinesLeagueData | null {
  return leagueData;
}

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･·•×x✕✖"'`’']/g, "");
}

/** Map historical aliases onto current group names for highlight matching. */
function standingAliasKeys(groupName: string): string[] {
  const key = normalizeKey(groupName);
  const aliases: Record<string, string[]> = {
    [normalizeKey("twinpale")]: [normalizeKey("Ill"), normalizeKey("twinpale")],
    [normalizeKey("Ill")]: [normalizeKey("Ill"), normalizeKey("twinpale")],
    [normalizeKey("ガガピエロ")]: [normalizeKey("ガガピエロ"), normalizeKey("GAGAPIERO")],
  };
  return aliases[key] ?? [key];
}

export function isHeroinesManagedGroup(save: GameSavePayload | null | undefined): boolean {
  if (!save || !leagueData?.groups?.length) return false;
  const grp = getPrimaryGroup(save);
  const candidates = [
    String(grp?.name ?? "").trim(),
    String(grp?.name_romanji ?? "").trim(),
    String(save.managing_group ?? "").trim(),
    String(save.managing_group_uid ?? "").trim(),
  ].filter(Boolean);
  if (!candidates.length) return false;
  const nameKeys = new Set(candidates.map(normalizeKey));
  const uidKeys = new Set(candidates);
  return leagueData.groups.some((row) => {
    if (row.uid && uidKeys.has(row.uid)) return true;
    return Boolean(row.name) && nameKeys.has(normalizeKey(row.name));
  });
}

export function seasonById(seasonId: string): HeroinesLeagueSeason | null {
  return (leagueData?.seasons ?? []).find((s) => s.id === seasonId) ?? null;
}

export function seasonForDate(isoDate: string): HeroinesLeagueSeason | null {
  if (!leagueData?.seasons?.length) return null;
  const d = String(isoDate ?? "").split("T")[0];
  if (!d) return leagueData.seasons[0] ?? null;
  const hit = leagueData.seasons.find((season) => {
    if (d < season.start_date) return false;
    if (season.end_date && d > season.end_date) return false;
    return true;
  });
  return hit ?? leagueData.seasons[leagueData.seasons.length - 1] ?? null;
}

/** 26-27 regular season opens the day after 25-26 昇格戦 (2026-04-24). */
export const LEAGUE_26_27_SCHEDULE_VISIBLE_FROM = "2026-04-25";

/** Regular-season kinds where roster membership is known without assuming playoff outcomes. */
export function isRegularLeagueKind(kind: HeroinesLeagueKind): boolean {
  return kind === "league_i" || kind === "league_ii" || kind === "league";
}

export function upcomingLeagueSchedule(isoDate: string, limit = 24): HeroinesLeagueScheduleRow[] {
  const d = String(isoDate ?? "").split("T")[0];
  return (leagueData?.schedule ?? [])
    .filter((row) => {
      if (row.date < d || row.kind === "fc_vote") return false;
      // Hide next-season dates until 昇格戦 closes 25-26 (2026-04-24).
      if (row.season_id === "26-27" && d < LEAGUE_26_27_SCHEDULE_VISIBLE_FROM) return false;
      return true;
    })
    .slice(0, limit);
}

export type LeagueTableView = {
  key: "league_i" | "league_ii" | "promotion" | "championship" | "overall";
  label: string;
  as_of: string;
  note?: string;
  rows: HeroinesLeagueStandingRow[];
};

/** Standings zone for FINAL / 入れ替え visual cues on League I / II tables. */
export type LeagueStandingZone = "championship" | "promotion" | "promotion_danger" | null;

/**
 * League I: top 4 → 決勝リーグ; bottom 4 → 入れ替え戦.
 * League II: top 4 → 入れ替え戦.
 */
export function standingZoneForRow(
  tableKey: LeagueTableView["key"],
  rank: number,
  fieldSize: number,
): LeagueStandingZone {
  const r = Number(rank);
  const n = Math.max(1, Number(fieldSize) || 0);
  if (!Number.isFinite(r) || r < 1) return null;
  if (tableKey === "league_i") {
    if (r <= Math.min(4, n)) return "championship";
    const promotionStart = Math.max(1, n - 3);
    if (r >= promotionStart) return "promotion_danger";
    return null;
  }
  if (tableKey === "league_ii") {
    if (r <= Math.min(4, n)) return "promotion";
    return null;
  }
  return null;
}

export function standingZoneClass(zone: LeagueStandingZone): string {
  switch (zone) {
    case "championship":
      return "league-zone-championship";
    case "promotion":
      return "league-zone-promotion";
    case "promotion_danger":
      return "league-zone-promotion-danger";
    default:
      return "";
  }
}

/** Latest applicable standings tables for the current date (may merge I/II from nearby snapshots). */
export function standingsForDate(isoDate: string): LeagueTableView[] {
  const d = String(isoDate ?? "").split("T")[0];
  const snapshots = (leagueData?.standings_snapshots ?? [])
    .filter((snap) => snap.as_of <= d)
    .sort((a, b) => a.as_of.localeCompare(b.as_of));
  if (!snapshots.length) return [];

  const latestByTable = new Map<Exclude<LeagueTableView["key"], "overall">, LeagueTableView>();
  const labels: Record<Exclude<LeagueTableView["key"], "overall">, string> = {
    league_i: "League I",
    league_ii: "League II",
    promotion: "入れ替え戦",
    championship: "決勝リーグ",
  };

  for (const snap of snapshots) {
    for (const key of ["league_i", "league_ii", "promotion", "championship"] as const) {
      const rows = snap.tables?.[key];
      if (!rows?.length) continue;
      latestByTable.set(key, {
        key,
        label: labels[key],
        as_of: snap.as_of,
        note: snap.note,
        rows,
      });
    }
  }

  const order: Exclude<LeagueTableView["key"], "overall">[] = ["league_i", "league_ii", "championship", "promotion"];
  return order.map((key) => latestByTable.get(key)).filter((x): x is LeagueTableView => Boolean(x));
}

/**
 * Historical finals for seasons that have already ended relative to the current date.
 * Always includes 24-25 once the game date is past its finale.
 */
export function historyRecordsForDate(isoDate: string): HeroinesLeagueHistoryRecord[] {
  const d = String(isoDate ?? "").split("T")[0];
  const seasonsById = new Map((leagueData?.seasons ?? []).map((s) => [s.id, s] as const));
  return (leagueData?.history_records ?? [])
    .filter((rec) => {
      if (rec.date <= d) return true;
      const season = seasonsById.get(rec.season_id);
      return Boolean(season?.end_date && season.end_date < d);
    })
    .sort((a, b) => a.date.localeCompare(b.date));
}

export function historyTables(record: HeroinesLeagueHistoryRecord): LeagueTableView[] {
  const labels: Record<string, string> = {
    overall: "Overall",
    league_i: "League I",
    league_ii: "League II",
    promotion: "入れ替え戦",
    championship: "決勝リーグ",
  };
  const order = ["overall", "championship", "promotion", "league_i", "league_ii"] as const;
  const out: LeagueTableView[] = [];
  for (const key of order) {
    const rows = record.tables?.[key];
    if (!rows?.length) continue;
    out.push({
      key,
      label: labels[key] ?? key,
      as_of: record.date,
      note: record.note,
      rows,
    });
  }
  return out;
}

export function isManagedStandingRow(save: GameSavePayload, groupName: string): boolean {
  const grp = getPrimaryGroup(save);
  const managed = [String(grp?.name ?? "").trim(), String(save.managing_group ?? "").trim()].filter(Boolean);
  if (!managed.length) return false;
  const managedKeys = managed.flatMap((name) => standingAliasKeys(name));
  const targetKeys = standingAliasKeys(groupName);
  return managedKeys.some((mk) => targetKeys.includes(mk));
}

export function leagueKindLabel(kind: HeroinesLeagueKind, lang: "en" | "zh-CN"): string {
  if (lang === "zh-CN") {
    switch (kind) {
      case "league_i":
        return "联赛 I";
      case "league_ii":
        return "联赛 II";
      case "championship":
        return "决赛联赛";
      case "promotion":
        return "升降级";
      case "promotion_final":
        return "升降级决赛";
      case "additional_promotion":
        return "追加升格战";
      case "playoffs":
        return "决赛/升降级";
      default:
        return "联赛";
    }
  }
  switch (kind) {
    case "league_i":
      return "League I";
    case "league_ii":
      return "League II";
    case "championship":
      return "Championship";
    case "promotion":
      return "Promotion";
    case "promotion_final":
      return "Promotion final";
    case "additional_promotion":
      return "Additional promotion";
    case "playoffs":
      return "Playoffs";
    default:
      return "League";
  }
}
