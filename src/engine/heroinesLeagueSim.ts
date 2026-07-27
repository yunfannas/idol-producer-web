/**
 * HEROINES League scoring + lightweight standings simulation.
 *
 * Real 25-26 regular season: each matchday ranks groups by
 *   (FC pre-vote points) + (on-site attendance / 目当て),
 * then awards fixed rank points. May 2025 Matchday 1 was attendance-only.
 * From 26-27 League I also adds ABEMA PPV vote weight.
 *
 * Gameplay goals (player arrangement → draw power → pts → standing):
 *   1. Best: stay clear of 入れ替え戦 (League I regular-season safety above bottom 4).
 *   2. Recovery: if drawn into promotion, finish top 4 to survive / return to League I.
 * Historical anchor: アキシブproject failed (1) on tiebreak, then failed (2) at 5th/255.
 *
 * Agency model (no SNS sim):
 *   setlist pickup + training + lineup/roster (core + new members)
 *   → long-term fan stock + short-term vote/draw proxy for matchday rank.
 *   New members can attract attention / fans immediately, not only "hurt now".
 */

export type LeagueDivision = "league_i" | "league_ii";

/** Player-facing League I objectives for sim / UI copy. */
export const LEAGUE_I_GAMEPLAY_GOALS = {
  primary: "avoid_promotion", // finish regular season above bottom 4
  recovery: "survive_promotion", // top 4 in 入れ替え戦 → stay/promote to I
  stretch: "championship", // 決勝リーグ
} as const;

/** 25-26 League I field: bottom 4 enter 入れ替え戦 (after attendance tiebreaks). */
export const LEAGUE_I_PROMOTION_CUTOFF_RANK = 7;

/** Official rank→points tables observed in 2025 regular season. */
export const LEAGUE_I_POINTS_BY_FIELD_SIZE: Record<number, number[]> = {
  // May 11 (attendance only): 9 groups
  9: [90, 70, 55, 40, 30, 20, 15, 10, 5],
  // Jul 14 used a slightly denser middle band while still at 9 ranked groups
  // (kept as optional override via matchday.points_table).
  // Aug–Sep (10 ranked groups, iON! included):
  10: [90, 70, 55, 40, 30, 25, 20, 15, 10, 5],
};

/** Jul 14 published table (9 groups) — denser middle than May. */
export const LEAGUE_I_POINTS_JUL14 = [90, 70, 55, 45, 40, 35, 30, 25, 20];

/** 入れ替え戦 (8 groups) rank→pts. */
export const PROMOTION_POINTS_8 = [100, 80, 65, 50, 40, 30, 20, 10];

/** 決勝リーグ (4 groups) — championship finals use a similar dense top band. */
export const CHAMPIONSHIP_POINTS_4 = [100, 70, 50, 40];

export type ScoringComponents = {
  attendance: boolean;
  fan_club_vote: boolean;
  venue_vote?: boolean;
  abema_vote?: boolean;
};

export const SCORING_BY_SEASON: Record<
  string,
  { components: ScoringComponents; note: string }
> = {
  "25-26": {
    components: { attendance: true, fan_club_vote: true, venue_vote: true },
    note: "Matchday rank = FC pre-vote + on-site attendance (目当て). May MD1 was attendance-only before FC voting started.",
  },
  "26-27": {
    components: { attendance: true, fan_club_vote: true, venue_vote: true, abema_vote: true },
    note: "League I adds ABEMA PPV ticket-linked votes on top of on-site + FC.",
  },
};

export type MatchdayResultRow = {
  rank: number;
  group_name: string;
  points: number;
  note?: string;
};

export type SimulatedEntrant = {
  group_name: string;
  /** Relative draw power (fans × condition × setlist/training quality). Higher → better rank. */
  strength: number;
};

export function pointsForRank(fieldSize: number, rank: number, customTable?: number[]): number {
  const table = customTable ?? LEAGUE_I_POINTS_BY_FIELD_SIZE[fieldSize];
  if (!table) throw new Error(`No points table for field size ${fieldSize}`);
  const idx = Math.max(1, Math.min(rank, table.length)) - 1;
  return table[idx] ?? table[table.length - 1] ?? 0;
}

/** Deterministic rank from strengths (ties broken by name for stability). */
export function simulateMatchdayRanks(entrants: SimulatedEntrant[]): MatchdayResultRow[] {
  const sorted = [...entrants].sort((a, b) => {
    if (b.strength !== a.strength) return b.strength - a.strength;
    return a.group_name.localeCompare(b.group_name, "ja");
  });
  const field = sorted.length;
  return sorted.map((row, i) => ({
    rank: i + 1,
    group_name: row.group_name,
    points: pointsForRank(field, i + 1),
  }));
}

export function accumulateStandings(
  rounds: Array<{ results: MatchdayResultRow[] }>,
): MatchdayResultRow[] {
  const totals = new Map<string, number>();
  for (const round of rounds) {
    for (const row of round.results) {
      totals.set(row.group_name, (totals.get(row.group_name) ?? 0) + row.points);
    }
  }
  return [...totals.entries()]
    .map(([group_name, points]) => ({ group_name, points, rank: 0 }))
    .sort((a, b) => b.points - a.points || a.group_name.localeCompare(b.group_name, "ja"))
    .map((row, i) => ({ ...row, rank: i + 1 }));
}

/**
 * Late-joiner rule used for iON! in 2025:
 * per missed round ≈ avg(participated) * 0.7 truncated to 1 decimal,
 * then floor(per * missedCount). Matches published 123 / 135 totals.
 */
export function applyLateJoinerMakeup(params: {
  participatedPoints: number[];
  missedRounds: number;
}): number {
  const { participatedPoints, missedRounds } = params;
  if (!participatedPoints.length || missedRounds <= 0) return 0;
  const avg = participatedPoints.reduce((a, b) => a + b, 0) / participatedPoints.length;
  const perMissed = Math.floor(avg * 0.7 * 10) / 10;
  return Math.floor(perMissed * missedRounds);
}

/** Worked example: アキシブproject published path through regular season (before Oct playoffs). */
export const AKISHIBU_REGULAR_SEASON_PATH = [
  { date: "2025-05-11", round: 1, rank: 7, points: 15, cumulative: 15, note: "Attendance-only MD1; dropped from seeding #2" },
  { date: "2025-06-14", round: 2, rank: 2, points: 70, cumulative: 85, note: "Attendance 2nd; FC vote outside earning ranks" },
  { date: "2025-07-14", round: 3, rank: 9, points: 20, cumulative: 105, note: "Collapse to last among 9" },
  { date: "2025-08-04", round: 4, rank: 10, points: 5, cumulative: 110, note: "Last of 10 after iON! joined" },
  { date: "2025-09-23", round: 5, rank: 8, points: 15, cumulative: 125, note: "Slight recovery" },
  {
    date: "2025-09-24",
    round: 6,
    rank: 3,
    points: 55,
    cumulative: 180,
    note: "古賀みれい last League performance only (graduate special is separate) — bounce to 3rd/55; tied MEGAFON, lost attendance tiebreak → 入れ替え戦",
  },
] as const;

/** Worked example: アキシブproject through 入れ替え戦 (finished 5th → League II). */
export const AKISHIBU_PROMOTION_PATH = [
  { date: "2025-10-08", vol: 1, rank: 4, points: 50, cumulative: 50 },
  { date: "2025-11-25", vol: 2, rank: 2, points: 80, cumulative: 130 },
  { date: "2025-12-10", vol: 3, rank: 3, points: 65, cumulative: 195 },
  { date: "2026-01-13", vol: 4, rank: 6, points: 30, cumulative: 225 },
  {
    date: "2026-02-07",
    vol: 5,
    rank: 6,
    points: 30,
    cumulative: 255,
    note: "5th overall — 55pt behind chuLa's last League I slot",
  },
] as const;
