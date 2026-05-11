/**
 * Ported from idol_producer/database/finance/finance_system.py (subset used by web daily close).
 * Data file is a copy of desktop `group_finance.json`.
 */

import groupFinanceJson from "./data/group_finance.json";
import type { DailyBreakdown, Finances, LetterTier } from "./types";

const GF = groupFinanceJson as {
  default_financial_constants?: Record<string, unknown>;
  member_compensation_by_letter_tier?: Record<string, unknown>;
};

const DEFAULT_CONST = GF.default_financial_constants ?? {};

export const LEDGER_LIMIT = 180;

export const SCENARIO_STARTING_CASH: Record<number, number> = {
  1: 2_000_000,
  2: 5_000_000,
  3: 10_000_000,
  4: 8_000_000,
  5: 12_000_000,
  6: 20_000_000,
};

export const DEFAULT_STARTING_CASH = 5_000_000;

/** Merged typical tier-D anchor (see desktop `typical_tier_d_group.json`). */
export const AVERAGE_MONTHLY_BASE_SALARY_YEN = 240_000;

export function scenarioStartingCash(scenarioNumber: number | null | undefined): number {
  if (scenarioNumber != null && scenarioNumber in SCENARIO_STARTING_CASH) {
    return SCENARIO_STARTING_CASH[scenarioNumber];
  }
  return DEFAULT_STARTING_CASH;
}

function intOr(v: unknown, fallback: number): number {
  try {
    return Math.trunc(Number(v));
  } catch {
    return fallback;
  }
}

export function loadDefaultFinancialConstants(): {
  tokutenkaiIdolShareRate: number;
  smallVenueCapacityThreshold: number;
  smallVenueEventFeeYen: number;
  smallVenueEventFeeWeekdayYen: number;
  smallVenueEventFeeWeekendHolidayYen: number;
} {
  return {
    tokutenkaiIdolShareRate: Number(DEFAULT_CONST.tokutenkai_idol_share_rate ?? 0.1),
    smallVenueCapacityThreshold: intOr(DEFAULT_CONST.small_venue_capacity_threshold, 300),
    smallVenueEventFeeYen: intOr(DEFAULT_CONST.small_venue_event_fee_yen, 1_200_000),
    smallVenueEventFeeWeekdayYen: intOr(
      DEFAULT_CONST.small_venue_event_fee_weekday_yen,
      intOr(DEFAULT_CONST.small_venue_event_fee_yen, 352_000),
    ),
    smallVenueEventFeeWeekendHolidayYen: intOr(
      DEFAULT_CONST.small_venue_event_fee_weekend_holiday_yen,
      intOr(DEFAULT_CONST.small_venue_event_fee_yen, 462_000),
    ),
  };
}

const FIN_CONST = loadDefaultFinancialConstants();

export function normalizeGroupLetterTier(t: string | null | undefined): LetterTier {
  const u = String(t ?? "")
    .trim()
    .toUpperCase();
  if (u === "S" || u === "A" || u === "B" || u === "C" || u === "D" || u === "E" || u === "F") {
    return u;
  }
  return "F";
}

/**
 * Heuristic until bundles export `group.letter_tier` from desktop.
 * Tune thresholds when comparing to real `idol_group_rank` data.
 */
export function inferLetterTier(popularity: number, fans: number, xFollowers = 0): LetterTier {
  const score = popularity + fans / 2000 + xFollowers / 5000;
  if (score >= 85) return "S";
  if (score >= 70) return "A";
  if (score >= 55) return "B";
  if (score >= 40) return "C";
  if (score >= 25) return "D";
  if (score >= 12) return "E";
  return "F";
}

/** Letter tier stored on JSON row, otherwise inferred (uses group x_followers when present). */
export function resolveGroupLetterTier(g: Record<string, unknown> | null | undefined): LetterTier {
  if (!g || typeof g !== "object") return "F";
  const raw = g.letter_tier;
  if (typeof raw === "string" && /^[SABCDEF]$/i.test(raw.trim())) {
    return raw.trim().toUpperCase() as LetterTier;
  }
  const popularity =
    typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const xFollowers =
    typeof g.x_followers === "number" ? g.x_followers : Number(g.x_followers ?? 0) || 0;
  return inferLetterTier(popularity, fans, xFollowers);
}

const LETTER_TIER_ORDER: Record<LetterTier, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
};

/** Lower = higher tier grade (S is 0). */
export function tierOrdinal(t: LetterTier): number {
  return LETTER_TIER_ORDER[t];
}

/** Best letter tier first, then descending fan count. */
export function compareGroupsTierBestFansDesc(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const da = tierOrdinal(resolveGroupLetterTier(a));
  const db = tierOrdinal(resolveGroupLetterTier(b));
  if (da !== db) return da - db;
  const fa = typeof a.fans === "number" ? a.fans : Number(a.fans ?? 0) || 0;
  const fb = typeof b.fans === "number" ? b.fans : Number(b.fans ?? 0) || 0;
  return fb - fa;
}

export function sortGroupsForDirectory(groups: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...groups].sort(compareGroupsTierBestFansDesc);
}

export function tierMultiplier(
  popularity: number,
  fans: number,
  xFollowers: number,
): { tierName: "high" | "mid" | "low"; tierMult: number } {
  const score = popularity + fans / 2000.0 + xFollowers / 5000.0;
  if (score >= 90) return { tierName: "high", tierMult: 3.0 };
  if (score >= 45) return { tierName: "mid", tierMult: 1.8 };
  return { tierName: "low", tierMult: 1.0 };
}

export function tokutenkaiIdolShare(revenue: number): number {
  const r = Math.max(0, intOr(revenue, 0));
  return intOr(r * FIN_CONST.tokutenkaiIdolShareRate, 0);
}

export function baseSalaryMultiplierForGroupLetterTier(letterTier: LetterTier): number {
  const mcp = GF.member_compensation_by_letter_tier;
  const block =
    mcp && typeof mcp === "object" && "base_salary_multiplier_vs_default_monthly_base_salary" in mcp
      ? (mcp as { base_salary_multiplier_vs_default_monthly_base_salary?: Record<string, unknown> })
          .base_salary_multiplier_vs_default_monthly_base_salary
      : undefined;
  if (!block || typeof block !== "object") return 1.0;
  const raw = block[letterTier];
  return Math.max(0, Number(raw ?? 1));
}

export function monthlyBaseSalaryYenForGroupLetterTier(
  letterTier: LetterTier,
  defaultMonthlyBaseSalaryYen: number = AVERAGE_MONTHLY_BASE_SALARY_YEN,
): number {
  const base = defaultMonthlyBaseSalaryYen;
  const mult = baseSalaryMultiplierForGroupLetterTier(letterTier);
  return Math.max(0, Math.round(base * mult));
}

export function estimateVenueFee(
  capacity: number | null,
  options: { isWeekendOrHoliday?: boolean; bookingPlan?: string | null } = {},
): number {
  if (capacity == null) return 0;
  const capacityInt = intOr(capacity, 0);
  if (capacityInt <= 0 || capacityInt > FIN_CONST.smallVenueCapacityThreshold) return 0;

  let planKey = String(options.bookingPlan ?? "full_day").trim().toLowerCase();
  if (["half_day_a", "half-a", "a", "halfday_a"].includes(planKey)) planKey = "half_day_a";
  else if (["half_day_b", "half-b", "b", "halfday_b"].includes(planKey)) planKey = "half_day_b";
  else planKey = "full_day";

  const isWeekend = Boolean(options.isWeekendOrHoliday);
  const anchors150 = isWeekend
    ? { half_day_a: 132_000, half_day_b: 187_000, full_day: 297_000 }
    : { half_day_a: 77_000, half_day_b: 154_000, full_day: 187_000 };
  const anchors200 = isWeekend
    ? { half_day_a: 187_000, half_day_b: 242_000, full_day: 352_000 }
    : { half_day_a: 132_000, half_day_b: 187_000, full_day: 242_000 };
  const fallback = isWeekend
    ? FIN_CONST.smallVenueEventFeeWeekendHolidayYen
    : FIN_CONST.smallVenueEventFeeWeekdayYen;

  const pk = planKey in anchors150 ? (planKey as keyof typeof anchors150) : "full_day";
  const base150 = anchors150[pk];
  const base200 = anchors200[pk];

  if (capacityInt < 150) return Math.max(0, base150);
  if (capacityInt > FIN_CONST.smallVenueCapacityThreshold) return Math.max(0, fallback);

  const slope = (base200 - base150) / 50.0;
  return Math.max(0, Math.round(base150 + (capacityInt - 150) * slope));
}

export function defaultFinances(startingCash?: number): Finances {
  const start = startingCash ?? DEFAULT_STARTING_CASH;
  return {
    status: "active",
    currency: "JPY",
    cash_yen: start,
    opening_cash_yen: start,
    last_processed_date: null,
    ledger: [],
    notes: "Daily cash flow simulation enabled.",
  };
}

export function normalizeFinances(payload: Partial<Finances> | null | undefined, startingCash?: number): Finances {
  const base = defaultFinances(startingCash);
  if (!payload || typeof payload !== "object") return base;
  const cashRaw = payload.cash_yen;
  const fallbackCash =
    typeof cashRaw === "number"
      ? cashRaw
      : cashRaw === null || cashRaw === undefined
        ? base.cash_yen
        : intOr(cashRaw, base.cash_yen);
  const merged: Finances = {
    ...base,
    ...payload,
    cash_yen: fallbackCash,
    opening_cash_yen: intOr(payload.opening_cash_yen ?? fallbackCash, base.cash_yen),
    ledger: Array.isArray(payload.ledger) ? payload.ledger.filter((r): r is DailyBreakdown => typeof r === "object") : [],
    status: "active",
    currency: "JPY",
  };
  return merged;
}

export interface BuildDailyBreakdownInput {
  targetDateIso: string;
  memberCount: number;
  popularity: number;
  fans: number;
  xFollowers: number;
  monthlySalaryTotal: number;
  liveCount?: number;
  tokutenkaiRevenue?: number;
  tokutenkaiCost?: number;
  liveVenueFeeTotal?: number;
}

export function buildDailyBreakdown(input: BuildDailyBreakdownInput): DailyBreakdown {
  const {
    targetDateIso,
    memberCount,
    popularity,
    fans,
    xFollowers,
    monthlySalaryTotal,
    liveCount = 0,
    tokutenkaiRevenue = 0,
    tokutenkaiCost = 0,
    liveVenueFeeTotal = 0,
  } = input;

  const { tierName, tierMult } = tierMultiplier(popularity, fans, xFollowers);

  const digitalSales = intOr((2_500 + fans * 0.1 + xFollowers * 0.02 + popularity * 180) * tierMult, 0);
  const fanMeetings = intOr((1_800 + fans * 0.08 + popularity * 120) * tierMult, 0);
  const goods = intOr((1_500 + fans * 0.12 + memberCount * 1_800) * tierMult, 0);
  const media = intOr((800 + popularity * 90) * Math.max(0.8, tierMult - 0.15), 0);
  const lc = liveCount;
  const liveTickets = intOr(lc * (25_000 + fans * 0.22 + memberCount * 6_000) * tierMult, 0);
  const liveGoods = intOr(lc * (9_000 + fans * 0.08 + memberCount * 2_000) * tierMult, 0);

  const staff = intOr(22_000 + memberCount * 7_500, 0);
  const office = intOr(12_000 + Math.max(0, memberCount - 4) * 1_800, 0);
  const promotion = intOr(
    (7_500 + popularity * 140) * (tierName === "low" ? 1.0 : tierName === "mid" ? 1.25 : 1.6),
    0,
  );
  const liveOpsCost = intOr(lc * (18_000 + memberCount * 4_500), 0);
  const venueFee = Math.max(0, intOr(liveVenueFeeTotal, 0));
  const liveCost = liveOpsCost + venueFee;

  const dayOfMonth = parseIsoDayOfMonth(targetDateIso);
  const salaries = dayOfMonth === 1 ? intOr(monthlySalaryTotal, 0) : 0;

  const tkr = Math.max(0, intOr(tokutenkaiRevenue, 0));
  const tkc = Math.max(0, intOr(tokutenkaiCost, 0));
  const tokutenkaiIdolShareVal = tokutenkaiIdolShare(tkr);

  const income = digitalSales + fanMeetings + goods + media + liveTickets + liveGoods + tkr;
  const expense =
    staff + office + promotion + liveCost + salaries + tkc + tokutenkaiIdolShareVal;
  const net = income - expense;

  return {
    date: targetDateIso,
    tier: tierName,
    income_total: income,
    expense_total: expense,
    net_total: net,
    digital_sales: digitalSales,
    fan_meetings: fanMeetings,
    goods,
    media,
    live_tickets: liveTickets,
    live_goods: liveGoods,
    tokutenkai_revenue: tkr,
    staff,
    office,
    promotion,
    live_cost: liveCost,
    live_ops_cost: liveOpsCost,
    live_venue_fee: venueFee,
    tokutenkai_cost: tkc,
    tokutenkai_idol_share: tokutenkaiIdolShareVal,
    salaries,
  };
}

function parseIsoDayOfMonth(iso: string): number {
  const s = String(iso).split("T")[0].trim();
  const parts = s.split("-");
  if (parts.length >= 3) {
    const d = Number(parts[2]);
    if (Number.isFinite(d)) return d;
  }
  const t = Date.parse(s + "T12:00:00Z");
  if (Number.isNaN(t)) return 1;
  return new Date(t).getUTCDate();
}

export function addCalendarDays(isoDate: string, days: number): string {
  const t = Date.parse(isoDate.split("T")[0] + "T12:00:00Z");
  if (Number.isNaN(t)) throw new Error(`Invalid ISO date: ${isoDate}`);
  const d = new Date(t);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isWeekendUtc(isoDate: string): boolean {
  const t = Date.parse(isoDate.split("T")[0] + "T12:00:00Z");
  if (Number.isNaN(t)) return false;
  const w = new Date(t).getUTCDay();
  return w === 0 || w === 6;
}

export function applyDailyClose(finances: Finances, breakdown: DailyBreakdown): Finances {
  const out = normalizeFinances(finances);
  out.cash_yen = intOr(out.cash_yen, 0) + intOr(breakdown.net_total, 0);
  out.last_processed_date = breakdown.date;
  const ledger = [...out.ledger, { ...breakdown }];
  if (ledger.length > LEDGER_LIMIT) {
    out.ledger = ledger.slice(-LEDGER_LIMIT);
  } else {
    out.ledger = ledger;
  }
  return out;
}
