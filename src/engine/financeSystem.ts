/**
 * Ported from idol_producer/database/finance/finance_system.py (subset used by web daily close).
 * Data file is a copy of desktop `group_finance.json`.
 */

import groupFinanceJson from "./data/group_finance.json";
import type { DailyBreakdown, Finances, LetterTier } from "./types";

const GF = groupFinanceJson as {
  default_financial_constants?: Record<string, unknown>;
  member_compensation_by_letter_tier?: Record<string, unknown>;
  additional_cost_assumptions?: Record<string, unknown>;
  cd_sales_model?: Record<string, unknown>;
  commercial_income_guess_letter_tier_s_through_b?: Record<string, unknown>;
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

export interface ProducedGoodsRow {
  uid: string;
  name: string;
  category: string;
  member_uid: string | null;
  member_name: string | null;
  unit_price_yen: number;
  unit_cost_yen: number;
  desired_amount: number;
  stock: number;
}

const DEFAULT_GOODS_OPTIONS: ReadonlyArray<{
  key: string;
  name: string;
  category: string;
  unit_price_yen: number;
  unit_cost_yen: number;
  default_desired_amount: number;
}> = [
  { key: "signed-cheki", name: "Signed cheki", category: "Photo", unit_price_yen: 1500, unit_cost_yen: 180, default_desired_amount: 80 },
  { key: "penlight", name: "Penlight", category: "Concert", unit_price_yen: 3000, unit_cost_yen: 1100, default_desired_amount: 24 },
  { key: "uchiwa", name: "Uchiwa", category: "Concert", unit_price_yen: 1800, unit_cost_yen: 420, default_desired_amount: 30 },
];

export const BIRTHDAY_TEE_TEMPLATE = {
  key: "birthday-tee",
  name: "Birthday T-shirt",
  category: "Apparel",
  unit_price_yen: 4500,
  unit_cost_yen: 1800,
  default_desired_amount: 16,
} as const;

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
  if (u === "S" || u === "A" || u === "B" || u === "C" || u === "D" || u === "E" || u === "F" || u === "I") {
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
  if (typeof raw === "string" && /^[SABCDEFI]$/i.test(raw.trim())) {
    return raw.trim().toUpperCase() as LetterTier;
  }
  const popularity =
    typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const xFollowers =
    typeof g.x_followers === "number" ? g.x_followers : Number(g.x_followers ?? 0) || 0;
  return inferLetterTier(popularity, fans, xFollowers);
}

/** Active commercial tier used by finance (inactive `I` maps to `F`). */
export function financeLetterTier(t: LetterTier): Exclude<LetterTier, "I"> {
  return t === "I" ? "F" : t;
}

const LETTER_TIER_ORDER: Record<LetterTier, number> = {
  S: 0,
  A: 1,
  B: 2,
  C: 3,
  D: 4,
  E: 5,
  F: 6,
  I: 7,
};

/** Lower = higher tier grade (S is 0). */
export function tierOrdinal(t: LetterTier): number {
  return LETTER_TIER_ORDER[t];
}

/** Best letter tier first, then descending fans, then descending popularity (stable uid tiebreak). */
export function compareGroupsTierBestFansDesc(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): number {
  const da = tierOrdinal(resolveGroupLetterTier(a));
  const db = tierOrdinal(resolveGroupLetterTier(b));
  if (da !== db) return da - db;
  const fa = typeof a.fans === "number" ? a.fans : Number(a.fans ?? 0) || 0;
  const fb = typeof b.fans === "number" ? b.fans : Number(b.fans ?? 0) || 0;
  if (fa !== fb) return fb - fa;
  const pa = typeof a.popularity === "number" ? a.popularity : Number(a.popularity ?? 0) || 0;
  const pb = typeof b.popularity === "number" ? b.popularity : Number(b.popularity ?? 0) || 0;
  if (pa !== pb) return pb - pa;
  const ua = String(a.uid ?? "").trim();
  const ub = String(b.uid ?? "").trim();
  return ua.localeCompare(ub);
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

export function cdSalesNetIncomeYen(cdUnitsSold: number): number {
  const units = Math.max(0, intOr(cdUnitsSold, 0));
  const netPerCd = Math.max(0, intOr(GF.cd_sales_model?.average_net_income_yen_per_cd_sold, 500));
  return units * netPerCd;
}

export function cdOnlineSigningMemberSeconds(cdUnitsSold: number): number {
  const units = Math.max(0, intOr(cdUnitsSold, 0));
  const ev = GF.cd_sales_model?.online_signing_event;
  const secondsPerCd =
    ev && typeof ev === "object"
      ? Math.max(0, intOr((ev as Record<string, unknown>).seconds_per_cd_allocating_member, 15))
      : 15;
  return units * secondsPerCd;
}

export type AudienceLayer = "public" | "otaku" | "core";
export type AudienceAgeSegment = "youth" | "young_adult" | "middle_plus";
export type AudienceGenderSegment = "male" | "female";
export type PurchaseChannel = "live_ticket" | "live_goods" | "post_live_cheki" | "premium_ticket" | "online_signing";

export interface AudienceDemographicMix {
  malePct: number;
  femalePct: number;
  youthPct: number;
  youngAdultPct: number;
  middlePlusPct: number;
}

export interface FinanceAudienceProfile {
  publicFans: number;
  otakuFans: number;
  coreFans: number;
  publicDemographics: AudienceDemographicMix;
  otakuDemographics: AudienceDemographicMix;
  coreDemographics: AudienceDemographicMix;
}

export type PurchasePropensityRow = Record<PurchaseChannel, number>;

export function baseSalaryMultiplierForGroupLetterTier(letterTier: LetterTier): number {
  const mcp = GF.member_compensation_by_letter_tier;
  const block =
    mcp && typeof mcp === "object" && "base_salary_multiplier_vs_default_monthly_base_salary" in mcp
      ? (mcp as { base_salary_multiplier_vs_default_monthly_base_salary?: Record<string, unknown> })
          .base_salary_multiplier_vs_default_monthly_base_salary
      : undefined;
  if (!block || typeof block !== "object") return 1.0;
  const raw = block[financeLetterTier(letterTier)];
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

function commercialIpMonthlyRevenue(letterTier: LetterTier): number {
  const tier = financeLetterTier(letterTier);
  const block = GF.commercial_income_guess_letter_tier_s_through_b;
  const net =
    block && typeof block === "object"
      ? (block as { estimated_group_net_commercial_yen_per_month?: Record<string, unknown> })
          .estimated_group_net_commercial_yen_per_month
      : undefined;
  if (!net || typeof net !== "object") return 0;
  return Math.max(0, intOr(net[tier], 0));
}

function fanclubJoinRate(letterTier: LetterTier): number {
  const tier = financeLetterTier(letterTier);
  const rates: Record<Exclude<LetterTier, "I">, number> = {
    S: 0.055,
    A: 0.045,
    B: 0.035,
    C: 0.026,
    D: 0.018,
    E: 0.011,
    F: 0.006,
  };
  return rates[tier];
}

function tierRevenueMultiplier(letterTier: LetterTier): number {
  const tier = financeLetterTier(letterTier);
  const mult: Record<Exclude<LetterTier, "I">, number> = {
    S: 2.6,
    A: 2.1,
    B: 1.65,
    C: 1.25,
    D: 1.0,
    E: 0.72,
    F: 0.45,
  };
  return mult[tier];
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function layerMix(malePct: number, femalePct: number, youthPct: number, youngAdultPct: number, middlePlusPct: number): AudienceDemographicMix {
  return { malePct, femalePct, youthPct, youngAdultPct, middlePlusPct };
}

const TIER_LAYER_SHARES: Record<Exclude<LetterTier, "I">, Record<AudienceLayer, number>> = {
  S: { public: 0.72, otaku: 0.2, core: 0.08 },
  A: { public: 0.68, otaku: 0.22, core: 0.1 },
  B: { public: 0.62, otaku: 0.26, core: 0.12 },
  C: { public: 0.55, otaku: 0.3, core: 0.15 },
  D: { public: 0.45, otaku: 0.33, core: 0.22 },
  E: { public: 0.38, otaku: 0.34, core: 0.28 },
  F: { public: 0.3, otaku: 0.35, core: 0.35 },
};

const TIER_DEMOGRAPHIC_DEFAULTS: Record<Exclude<LetterTier, "I">, Record<AudienceLayer, AudienceDemographicMix>> = {
  S: {
    public: layerMix(70, 30, 15, 45, 40),
    otaku: layerMix(82, 18, 10, 35, 55),
    core: layerMix(88, 12, 7, 30, 63),
  },
  A: {
    public: layerMix(55, 45, 25, 50, 25),
    otaku: layerMix(55, 45, 20, 50, 30),
    core: layerMix(60, 40, 15, 50, 35),
  },
  B: {
    public: layerMix(50, 50, 35, 50, 15),
    otaku: layerMix(60, 40, 25, 55, 20),
    core: layerMix(68, 32, 15, 50, 35),
  },
  C: {
    public: layerMix(60, 40, 25, 50, 25),
    otaku: layerMix(72, 28, 18, 52, 30),
    core: layerMix(78, 22, 10, 50, 40),
  },
  D: {
    public: layerMix(70, 30, 15, 45, 40),
    otaku: layerMix(80, 20, 10, 45, 45),
    core: layerMix(85, 15, 7, 38, 55),
  },
  E: {
    public: layerMix(75, 25, 20, 45, 35),
    otaku: layerMix(82, 18, 12, 48, 40),
    core: layerMix(88, 12, 8, 42, 50),
  },
  F: {
    public: layerMix(80, 20, 20, 45, 35),
    otaku: layerMix(85, 15, 12, 48, 40),
    core: layerMix(90, 10, 8, 42, 50),
  },
};

const PURCHASE_PROPENSITY_TABLE: Record<
  AudienceLayer,
  Record<AudienceAgeSegment, Record<AudienceGenderSegment, PurchasePropensityRow>>
> = {
  public: {
    youth: {
      male: { live_ticket: 0.006, live_goods: 0.025, post_live_cheki: 0.008, premium_ticket: 0.001, online_signing: 0.002 },
      female: { live_ticket: 0.007, live_goods: 0.04, post_live_cheki: 0.006, premium_ticket: 0.001, online_signing: 0.003 },
    },
    young_adult: {
      male: { live_ticket: 0.01, live_goods: 0.035, post_live_cheki: 0.014, premium_ticket: 0.002, online_signing: 0.004 },
      female: { live_ticket: 0.011, live_goods: 0.055, post_live_cheki: 0.011, premium_ticket: 0.002, online_signing: 0.005 },
    },
    middle_plus: {
      male: { live_ticket: 0.009, live_goods: 0.03, post_live_cheki: 0.018, premium_ticket: 0.004, online_signing: 0.005 },
      female: { live_ticket: 0.008, live_goods: 0.045, post_live_cheki: 0.012, premium_ticket: 0.003, online_signing: 0.004 },
    },
  },
  otaku: {
    youth: {
      male: { live_ticket: 0.05, live_goods: 0.12, post_live_cheki: 0.08, premium_ticket: 0.006, online_signing: 0.018 },
      female: { live_ticket: 0.055, live_goods: 0.18, post_live_cheki: 0.06, premium_ticket: 0.005, online_signing: 0.02 },
    },
    young_adult: {
      male: { live_ticket: 0.08, live_goods: 0.17, post_live_cheki: 0.16, premium_ticket: 0.014, online_signing: 0.028 },
      female: { live_ticket: 0.082, live_goods: 0.23, post_live_cheki: 0.11, premium_ticket: 0.012, online_signing: 0.03 },
    },
    middle_plus: {
      male: { live_ticket: 0.075, live_goods: 0.16, post_live_cheki: 0.2, premium_ticket: 0.026, online_signing: 0.035 },
      female: { live_ticket: 0.065, live_goods: 0.2, post_live_cheki: 0.13, premium_ticket: 0.018, online_signing: 0.028 },
    },
  },
  core: {
    youth: {
      male: { live_ticket: 0.16, live_goods: 0.22, post_live_cheki: 0.28, premium_ticket: 0.018, online_signing: 0.055 },
      female: { live_ticket: 0.15, live_goods: 0.3, post_live_cheki: 0.2, premium_ticket: 0.014, online_signing: 0.06 },
    },
    young_adult: {
      male: { live_ticket: 0.24, live_goods: 0.31, post_live_cheki: 0.55, premium_ticket: 0.045, online_signing: 0.09 },
      female: { live_ticket: 0.22, live_goods: 0.38, post_live_cheki: 0.38, premium_ticket: 0.036, online_signing: 0.095 },
    },
    middle_plus: {
      male: { live_ticket: 0.25, live_goods: 0.34, post_live_cheki: 0.72, premium_ticket: 0.08, online_signing: 0.11 },
      female: { live_ticket: 0.2, live_goods: 0.36, post_live_cheki: 0.45, premium_ticket: 0.055, online_signing: 0.09 },
    },
  },
};

const GROUP_DEMOGRAPHIC_OVERRIDES: Record<string, Record<AudienceLayer, AudienceDemographicMix>> = {
  "nogizaka46": {
    public: layerMix(78, 22, 15, 45, 40),
    otaku: layerMix(88, 12, 8, 32, 60),
    core: layerMix(90, 10, 5, 30, 65),
  },
  "乃木坂46": {
    public: layerMix(78, 22, 15, 45, 40),
    otaku: layerMix(88, 12, 8, 32, 60),
    core: layerMix(90, 10, 5, 30, 65),
  },
  "=love": {
    public: layerMix(50, 50, 30, 55, 15),
    otaku: layerMix(40, 60, 25, 60, 15),
    core: layerMix(40, 60, 20, 55, 25),
  },
  "ilife!": {
    public: layerMix(35, 65, 40, 50, 10),
    otaku: layerMix(40, 60, 25, 60, 15),
    core: layerMix(45, 55, 15, 55, 30),
  },
  "takamine no nadeshiko": {
    public: layerMix(35, 65, 45, 45, 10),
    otaku: layerMix(70, 30, 20, 55, 25),
    core: layerMix(75, 25, 15, 50, 35),
  },
  "高嶺のなでしこ": {
    public: layerMix(35, 65, 45, 45, 10),
    otaku: layerMix(70, 30, 20, 55, 25),
    core: layerMix(75, 25, 15, 50, 35),
  },
  "akishibu project": {
    public: layerMix(70, 30, 10, 35, 55),
    otaku: layerMix(80, 20, 8, 37, 55),
    core: layerMix(85, 15, 5, 35, 60),
  },
  "jams collection": {
    public: layerMix(65, 35, 15, 50, 35),
    otaku: layerMix(80, 20, 10, 55, 35),
    core: layerMix(80, 20, 5, 50, 45),
  },
  "jamscollection": {
    public: layerMix(65, 35, 15, 50, 35),
    otaku: layerMix(80, 20, 10, 55, 35),
    core: layerMix(80, 20, 5, 50, 45),
  },
  "kirameki unforent": {
    public: layerMix(65, 35, 15, 45, 40),
    otaku: layerMix(75, 25, 10, 45, 45),
    core: layerMix(80, 20, 5, 40, 55),
  },
  "kirameki☆unforent": {
    public: layerMix(65, 35, 15, 45, 40),
    otaku: layerMix(75, 25, 10, 45, 45),
    core: layerMix(80, 20, 5, 40, 55),
  },
  "煌めき☆アンフォレント": {
    public: layerMix(65, 35, 15, 45, 40),
    otaku: layerMix(75, 25, 10, 45, 45),
    core: layerMix(80, 20, 5, 40, 55),
  },
};

function normalizeAudienceLookupName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function demographicOverrideForNames(names: Array<unknown>): Record<AudienceLayer, AudienceDemographicMix> | null {
  for (const raw of names) {
    const name = normalizeAudienceLookupName(raw);
    if (!name) continue;
    if (GROUP_DEMOGRAPHIC_OVERRIDES[name]) return GROUP_DEMOGRAPHIC_OVERRIDES[name];
    const compact = name.replace(/[_\s]/g, "");
    if (GROUP_DEMOGRAPHIC_OVERRIDES[compact]) return GROUP_DEMOGRAPHIC_OVERRIDES[compact];
  }
  return null;
}

export function financeAudienceProfileForGroup(opts: {
  groupName?: unknown;
  groupRomaji?: unknown;
  letterTier: LetterTier;
  fans: number;
}): FinanceAudienceProfile {
  const tier = financeLetterTier(opts.letterTier);
  const totalFans = Math.max(0, intOr(opts.fans, 0));
  const shares = TIER_LAYER_SHARES[tier];
  const coreFans = Math.max(0, Math.round(totalFans * shares.core));
  const otakuFans = Math.max(0, Math.round(totalFans * shares.otaku));
  const publicFans = Math.max(0, totalFans - coreFans - otakuFans);
  const demographics = demographicOverrideForNames([opts.groupName, opts.groupRomaji]) ?? TIER_DEMOGRAPHIC_DEFAULTS[tier];
  return {
    publicFans,
    otakuFans,
    coreFans,
    publicDemographics: demographics.public,
    otakuDemographics: demographics.otaku,
    coreDemographics: demographics.core,
  };
}

function weightedAudiencePct(profile: FinanceAudienceProfile, key: keyof AudienceDemographicMix): number {
  const total = Math.max(1, profile.publicFans + profile.otakuFans + profile.coreFans);
  return (
    profile.publicFans * profile.publicDemographics[key] +
    profile.otakuFans * profile.otakuDemographics[key] +
    profile.coreFans * profile.coreDemographics[key]
  ) / total;
}

function ageShares(mix: AudienceDemographicMix): Record<AudienceAgeSegment, number> {
  return {
    youth: Math.max(0, mix.youthPct) / 100,
    young_adult: Math.max(0, mix.youngAdultPct) / 100,
    middle_plus: Math.max(0, mix.middlePlusPct) / 100,
  };
}

function genderShares(mix: AudienceDemographicMix): Record<AudienceGenderSegment, number> {
  return {
    male: Math.max(0, mix.malePct) / 100,
    female: Math.max(0, mix.femalePct) / 100,
  };
}

function profileLayerFans(profile: FinanceAudienceProfile, layer: AudienceLayer): number {
  if (layer === "public") return profile.publicFans;
  if (layer === "otaku") return profile.otakuFans;
  return profile.coreFans;
}

function profileLayerMix(profile: FinanceAudienceProfile, layer: AudienceLayer): AudienceDemographicMix {
  if (layer === "public") return profile.publicDemographics;
  if (layer === "otaku") return profile.otakuDemographics;
  return profile.coreDemographics;
}

function liveAudienceLayerWeights(liveType: string): Record<AudienceLayer, number> {
  const key = String(liveType ?? "").trim().toLowerCase();
  if (key === "festival") return { public: 0.55, otaku: 0.35, core: 0.1 };
  if (key === "concert") return { public: 0.25, otaku: 0.45, core: 0.3 };
  if (key === "taiban" || key === "joint") return { public: 0.1, otaku: 0.5, core: 0.4 };
  if (key === "tokutenkai") return { public: 0.02, otaku: 0.28, core: 0.7 };
  return { public: 0.15, otaku: 0.45, core: 0.4 };
}

function liveTypePurchaseModifier(liveType: string, channel: PurchaseChannel): number {
  const key = String(liveType ?? "").trim().toLowerCase();
  if (channel === "live_ticket") {
    if (key === "festival") return 0.55;
    if (key === "concert") return 1.15;
    if (key === "taiban" || key === "joint") return 0.95;
    return 1.0;
  }
  if (channel === "live_goods") {
    if (key === "concert") return 1.45;
    if (key === "festival") return 0.85;
    if (key === "taiban" || key === "joint") return 0.75;
    if (key === "tokutenkai") return 0.65;
    return 0.9;
  }
  if (channel === "post_live_cheki") {
    if (key === "concert") return 0.7;
    if (key === "festival") return 0.45;
    if (key === "taiban" || key === "joint") return 1.2;
    if (key === "tokutenkai") return 1.45;
    return 1.0;
  }
  if (channel === "premium_ticket") {
    if (key === "concert") return 1.35;
    if (key === "festival") return 0.35;
    return 0.85;
  }
  return key === "concert" ? 1.15 : 1.0;
}

export function estimateAudiencePurchaseUnits(
  profile: FinanceAudienceProfile,
  channel: PurchaseChannel,
  options: { liveType?: string; audienceSize?: number | null; intensity?: number | null } = {},
): number {
  const liveType = options.liveType ?? "Routine";
  const audienceSize = options.audienceSize == null ? null : Math.max(0, intOr(options.audienceSize, 0));
  const layerWeights = liveAudienceLayerWeights(liveType);
  const totalFans = Math.max(1, profile.publicFans + profile.otakuFans + profile.coreFans);
  const intensity = clampNumber(Number(options.intensity ?? 1) || 1, 0.25, 2.5);
  let units = 0;
  for (const layer of ["public", "otaku", "core"] as const) {
    const mix = profileLayerMix(profile, layer);
    const layerBase =
      audienceSize != null
        ? audienceSize * layerWeights[layer]
        : profileLayerFans(profile, layer);
    const ages = ageShares(mix);
    const genders = genderShares(mix);
    for (const age of ["youth", "young_adult", "middle_plus"] as const) {
      for (const gender of ["male", "female"] as const) {
        units += layerBase * ages[age] * genders[gender] * PURCHASE_PROPENSITY_TABLE[layer][age][gender][channel];
      }
    }
  }
  const fanbaseScale = audienceSize == null ? clampNumber(Math.sqrt(totalFans / 50_000), 0.55, 2.2) : 1;
  return Math.max(0, Math.round(units * liveTypePurchaseModifier(liveType, channel) * intensity * fanbaseScale));
}

function audienceDemandMultipliers(profile: FinanceAudienceProfile): {
  fanclub: number;
  cheki: number;
  goods: number;
  digital: number;
  release: number;
  live: number;
} {
  const pub = profile.publicDemographics;
  const ota = profile.otakuDemographics;
  const core = profile.coreDemographics;
  return {
    fanclub: clampNumber(0.85 + core.middlePlusPct * 0.0025 + core.youngAdultPct * 0.0012 + core.femalePct * 0.0008 - core.youthPct * 0.0008, 0.75, 1.25),
    cheki: clampNumber(0.82 + core.malePct * 0.0018 + core.middlePlusPct * 0.0022 + core.youngAdultPct * 0.0008 - core.youthPct * 0.0008, 0.75, 1.3),
    goods: clampNumber(0.85 + ota.femalePct * 0.0014 + ota.youthPct * 0.0012 + ota.youngAdultPct * 0.0008, 0.75, 1.25),
    digital: clampNumber(0.8 + pub.youthPct * 0.0025 + pub.femalePct * 0.0015 + pub.youngAdultPct * 0.0008, 0.75, 1.3),
    release: clampNumber(0.85 + core.middlePlusPct * 0.0025 + core.malePct * 0.001 + ota.youngAdultPct * 0.0008, 0.75, 1.35),
    live: clampNumber(0.85 + ota.youngAdultPct * 0.0015 + ota.middlePlusPct * 0.0008 + ota.malePct * 0.0005, 0.75, 1.2),
  };
}

export function defaultGoodsInventory(
  members?: Array<{ uid: string; name: string }>,
): ProducedGoodsRow[] {
  const roster = (members ?? []).filter((member) => member.uid && member.name);
  const fallbackRoster = roster.length ? roster : [{ uid: "shared", name: "Group" }];
  return fallbackRoster.flatMap((member) =>
    DEFAULT_GOODS_OPTIONS.map((row) => ({
      uid: `goods-${member.uid}-${row.key}`,
      name: row.name,
      category: row.category,
      member_uid: member.uid === "shared" ? null : member.uid,
      member_name: member.uid === "shared" ? null : member.name,
      unit_price_yen: row.unit_price_yen,
      unit_cost_yen: row.unit_cost_yen,
      desired_amount: row.default_desired_amount,
      stock: 0,
    })),
  );
}

export function normalizeGoodsInventory(
  raw: unknown,
  members?: Array<{ uid: string; name: string }>,
): ProducedGoodsRow[] {
  const defaults = defaultGoodsInventory(members);
  const byUid = new Map(defaults.map((row) => [row.uid, { ...row }] as const));
  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      const uid = String(row.uid ?? "").trim();
      if (!uid) continue;
      const base = byUid.get(uid) ?? {
        uid,
        name: String(row.name ?? uid),
        category: String(row.category ?? "Goods"),
        member_uid: row.member_uid == null ? null : String(row.member_uid),
        member_name: row.member_name == null ? null : String(row.member_name),
        unit_price_yen: Math.max(0, intOr(row.unit_price_yen, 0)),
        unit_cost_yen: Math.max(0, intOr(row.unit_cost_yen, 0)),
        desired_amount: 0,
        stock: 0,
      };
      byUid.set(uid, {
        uid,
        name: String(row.name ?? base.name).trim() || base.name,
        category: String(row.category ?? base.category).trim() || base.category,
        member_uid: row.member_uid == null ? base.member_uid : String(row.member_uid),
        member_name: row.member_name == null ? base.member_name : String(row.member_name),
        unit_price_yen: Math.max(0, intOr(row.unit_price_yen, base.unit_price_yen)),
        unit_cost_yen: Math.max(0, intOr(row.unit_cost_yen, base.unit_cost_yen)),
        desired_amount: Math.max(0, intOr(row.desired_amount, base.desired_amount)),
        stock: Math.max(0, intOr(row.stock, base.stock)),
      });
    }
  }
  return [...byUid.values()];
}

export function birthdayTeeUidForMember(memberUid: string): string {
  return `goods-${memberUid}-${BIRTHDAY_TEE_TEMPLATE.key}`;
}

export function ensureBirthdayTeeInventoryRow(
  goods: ProducedGoodsRow[],
  member: { uid: string; name: string },
): ProducedGoodsRow {
  const uid = birthdayTeeUidForMember(member.uid);
  const existing = goods.find((row) => row.uid === uid);
  if (existing) {
    existing.name = BIRTHDAY_TEE_TEMPLATE.name;
    existing.category = BIRTHDAY_TEE_TEMPLATE.category;
    existing.member_uid = member.uid;
    existing.member_name = member.name;
    existing.unit_price_yen = Math.max(0, intOr(existing.unit_price_yen, BIRTHDAY_TEE_TEMPLATE.unit_price_yen));
    existing.unit_cost_yen = Math.max(0, intOr(existing.unit_cost_yen, BIRTHDAY_TEE_TEMPLATE.unit_cost_yen));
    return existing;
  }
  const created: ProducedGoodsRow = {
    uid,
    name: BIRTHDAY_TEE_TEMPLATE.name,
    category: BIRTHDAY_TEE_TEMPLATE.category,
    member_uid: member.uid,
    member_name: member.name,
    unit_price_yen: BIRTHDAY_TEE_TEMPLATE.unit_price_yen,
    unit_cost_yen: BIRTHDAY_TEE_TEMPLATE.unit_cost_yen,
    desired_amount: BIRTHDAY_TEE_TEMPLATE.default_desired_amount,
    stock: 0,
  };
  goods.push(created);
  return created;
}

function goodsDemandRateByLiveType(liveType: string): number {
  const key = String(liveType ?? "").trim().toLowerCase();
  if (key === "concert") return 0.3;
  if (key === "festival") return 0.2;
  if (key === "taiban") return 0.14;
  if (key === "tokutenkai") return 0.12;
  return 0.18;
}

export function estimateLiveGoodsUnits(
  goods: ProducedGoodsRow | null | undefined,
  opts: {
    liveType: string;
    capacity?: number | null;
    groupFans?: number | null;
    groupPopularity?: number | null;
    groupTier?: LetterTier | null;
    groupName?: unknown;
    groupRomaji?: unknown;
    audienceProfile?: FinanceAudienceProfile | null;
  },
): number {
  if (!goods) return 0;
  const stock = Math.max(0, intOr(goods.stock, 0));
  if (stock <= 0) return 0;
  const capacity = Math.max(0, intOr(opts.capacity, 0));
  const fans = Math.max(0, intOr(opts.groupFans, 0));
  const popularity = Math.max(0, Number(opts.groupPopularity ?? 0) || 0);
  const tier = financeLetterTier(normalizeGroupLetterTier(opts.groupTier ?? "F"));
  const tierBoost: Record<Exclude<LetterTier, "I">, number> = { S: 1.25, A: 1.18, B: 1.1, C: 1.03, D: 0.96, E: 0.88, F: 0.8 };
  const baseAudience = Math.max(capacity, Math.round(Math.min(fans, Math.max(40, capacity || 0) * 1.2)));
  const legacyDemand = Math.round(baseAudience * goodsDemandRateByLiveType(opts.liveType) * (0.75 + popularity / 200) * tierBoost[tier]);
  const audience =
    opts.audienceProfile ??
    financeAudienceProfileForGroup({
      groupName: opts.groupName,
      groupRomaji: opts.groupRomaji,
      letterTier: tier,
      fans,
    });
  const tableDemand = estimateAudiencePurchaseUnits(audience, "live_goods", {
    liveType: opts.liveType,
    audienceSize: baseAudience,
    intensity: (0.75 + popularity / 200) * tierBoost[tier],
  });
  const demand = Math.round(legacyDemand * 0.45 + tableDemand * 0.55);
  return Math.max(0, Math.min(stock, demand));
}

export function estimateLiveGoodsGrossYen(
  goods: ProducedGoodsRow | null | undefined,
  opts: Parameters<typeof estimateLiveGoodsUnits>[1],
): number {
  if (!goods) return 0;
  const units = estimateLiveGoodsUnits(goods, opts);
  return Math.max(0, units * Math.max(0, intOr(goods.unit_price_yen, 0)));
}

export function monthlyStaffSalaryYen(): number {
  const addl = GF.additional_cost_assumptions;
  const staffBlock =
    addl && typeof addl === "object" && "staff_salary" in addl
      ? (addl as { staff_salary?: Record<string, unknown> }).staff_salary
      : undefined;
  if (!staffBlock || typeof staffBlock !== "object") return 600_000;
  return Math.max(0, intOr(staffBlock.monthly_staff_salary_total_yen, 600_000));
}

export function monthlyAdminTrainingCostYenForGroupLetterTier(letterTier: LetterTier): number {
  const addl = GF.additional_cost_assumptions;
  const monthlyBlock =
    addl && typeof addl === "object" && "monthly_admin_training_costs_per_tier_yen" in addl
      ? (addl as { monthly_admin_training_costs_per_tier_yen?: Record<string, unknown> })
          .monthly_admin_training_costs_per_tier_yen
      : undefined;
  if (!monthlyBlock || typeof monthlyBlock !== "object") {
    return 300_000;
  }
  const adminBlock =
    "admin" in monthlyBlock
      ? (monthlyBlock as { admin?: Record<string, unknown> }).admin
      : undefined;
  const trainingBlock =
    "training" in monthlyBlock
      ? (monthlyBlock as { training?: Record<string, unknown> }).training
      : undefined;
  const key = financeLetterTier(letterTier);
  const admin = adminBlock && typeof adminBlock === "object" ? intOr(adminBlock[key], 0) : 0;
  const training =
    trainingBlock && typeof trainingBlock === "object" ? intOr(trainingBlock[key], 0) : 0;
  return Math.max(0, admin + training);
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
  letterTier?: LetterTier;
  audienceProfile?: FinanceAudienceProfile;
  monthlySalaryTotal: number;
  scoutRetainersMonthlyTotal?: number;
  liveCount?: number;
  liveTicketRevenue?: number;
  liveGoodsRevenue?: number;
  tokutenkaiRevenue?: number;
  tokutenkaiCost?: number;
  liveVenueFeeTotal?: number;
  cdReleaseUnits?: number;
  cdReleaseRevenue?: number;
  mediaAppearanceRevenue?: number;
  mediaOperatingCost?: number;
  memberHoursLive?: number;
  memberHoursMedia?: number;
  memberHoursTraining?: number;
}

export function buildDailyBreakdown(input: BuildDailyBreakdownInput): DailyBreakdown {
  const {
    targetDateIso,
    memberCount,
    popularity,
    fans,
    xFollowers,
    letterTier,
    audienceProfile,
    monthlySalaryTotal,
    scoutRetainersMonthlyTotal = 0,
    liveCount = 0,
    liveTicketRevenue,
    liveGoodsRevenue,
    tokutenkaiRevenue = 0,
    tokutenkaiCost = 0,
    liveVenueFeeTotal = 0,
    cdReleaseUnits = 0,
    cdReleaseRevenue,
    mediaAppearanceRevenue,
    mediaOperatingCost = 0,
    memberHoursLive = 0,
    memberHoursMedia = 0,
    memberHoursTraining = 0,
  } = input;

  const { tierName, tierMult } = tierMultiplier(popularity, fans, xFollowers);
  const financeTier = letterTier ?? inferLetterTier(popularity, fans, xFollowers);
  const revenueMult = tierRevenueMultiplier(financeTier);
  const dayOfMonth = parseIsoDayOfMonth(targetDateIso);
  const audience =
    audienceProfile ??
    financeAudienceProfileForGroup({
      letterTier: financeTier,
      fans,
    });
  const demand = audienceDemandMultipliers(audience);
  const publicFans = audience.publicFans;
  const otakuFans = audience.otakuFans;
  const coreFans = audience.coreFans;

  const digitalStreamingRevenue = intOr(
    (900 + publicFans * 0.014 + otakuFans * 0.018 + xFollowers * 0.006 + popularity * 45) * revenueMult * demand.digital,
    0,
  );
  const fanclubMembersEstimate = Math.max(0, Math.round(coreFans * fanclubJoinRate(financeTier) * demand.fanclub));
  const fanclubRevenue = dayOfMonth === 1 ? Math.round(fanclubMembersEstimate * 550 * 0.75) : 0;
  const onlineBenefitRevenue = intOr((450 + coreFans * 0.04 + otakuFans * 0.015 + popularity * 35) * revenueMult * demand.release, 0);
  const shootingHandshakeRevenue =
    dayOfMonth === 15 ? intOr((coreFans * 0.08 + otakuFans * 0.025 + memberCount * 900 + popularity * 120) * revenueMult * demand.release, 0) : 0;
  const releaseSalesRevenue =
    cdReleaseRevenue != null
      ? Math.max(0, intOr(cdReleaseRevenue, 0))
      : cdReleaseUnits > 0
        ? cdSalesNetIncomeYen(cdReleaseUnits)
        : 0;
  const commercialIpRevenue = dayOfMonth === 1 ? commercialIpMonthlyRevenue(financeTier) : 0;
  const mediaAppearanceRevenueFinal =
    mediaAppearanceRevenue != null
      ? Math.max(0, intOr(mediaAppearanceRevenue, 0))
      : intOr((600 + popularity * 55) * Math.max(0.65, tierMult - 0.25), 0);
  const media = mediaAppearanceRevenueFinal + commercialIpRevenue;
  const digitalSales = digitalStreamingRevenue + releaseSalesRevenue;
  const fanMeetings = onlineBenefitRevenue + shootingHandshakeRevenue + fanclubRevenue;
  const goods = 0;
  const lc = liveCount;
  const liveTickets =
    liveTicketRevenue != null
      ? Math.max(0, intOr(liveTicketRevenue, 0))
      : intOr(lc * (18_000 + otakuFans * 0.1 + coreFans * 0.18 + memberCount * 4_500) * revenueMult * demand.live, 0);
  const liveGoods =
    liveGoodsRevenue != null
      ? Math.max(0, intOr(liveGoodsRevenue, 0))
      : intOr(lc * (4_500 + otakuFans * 0.03 + coreFans * 0.07 + memberCount * 1_300) * revenueMult * demand.goods, 0);

  const staff = intOr((monthlyStaffSalaryYen() / 30) + memberCount * 900, 0);
  const office = intOr((monthlyAdminTrainingCostYenForGroupLetterTier(financeTier) / 30) + Math.max(0, memberCount - 4) * 700, 0);
  const promotion = intOr(
    (4_000 + popularity * 95) * (tierName === "low" ? 1.0 : tierName === "mid" ? 1.2 : 1.45),
    0,
  );
  const liveOpsCost = intOr(lc * (18_000 + memberCount * 4_500), 0);
  const venueFee = Math.max(0, intOr(liveVenueFeeTotal, 0));
  const liveCost = liveOpsCost + venueFee;

  const salaries = dayOfMonth === 1 ? intOr(monthlySalaryTotal, 0) : 0;
  const scoutRetainers = dayOfMonth === 1 ? intOr(scoutRetainersMonthlyTotal, 0) : 0;

  const tkr = Math.max(0, intOr(tokutenkaiRevenue, 0));
  const tkc = Math.max(0, intOr(tokutenkaiCost, 0));
  const tokutenkaiIdolShareVal = tokutenkaiIdolShare(tkr);
  const chekiNetProfit = tkr - tkc - tokutenkaiIdolShareVal;
  const benefitOpsCost = tkc + Math.round((onlineBenefitRevenue + shootingHandshakeRevenue) * 0.08);
  const productionCost = Math.max(0, intOr(mediaOperatingCost, 0));

  const income = digitalSales + fanMeetings + goods + media + liveTickets + liveGoods + tkr;
  const expense =
    staff + office + promotion + liveCost + salaries + scoutRetainers + benefitOpsCost + tokutenkaiIdolShareVal + productionCost;
  const net = income - expense;
  const cdUnits = Math.max(0, intOr(cdReleaseUnits, 0));
  const memberHoursBenefit = Math.round(((tkr > 0 ? tkr / Math.max(1, 2_000) * 20 : 0) + cdOnlineSigningMemberSeconds(cdUnits)) / 36) / 100;
  const totalMemberHours = Math.max(0, memberHoursLive + memberHoursBenefit + memberHoursMedia + memberHoursTraining);

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
    scout_retainers: scoutRetainers,
    live_ticket_revenue: liveTickets,
    live_goods_revenue: liveGoods,
    post_live_tokutenkai_revenue: tkr,
    online_benefit_revenue: onlineBenefitRevenue,
    shooting_handshake_revenue: shootingHandshakeRevenue,
    release_sales_revenue: releaseSalesRevenue,
    digital_streaming_revenue: digitalStreamingRevenue,
    media_appearance_revenue: mediaAppearanceRevenueFinal,
    commercial_ip_revenue: commercialIpRevenue,
    fanclub_revenue: fanclubRevenue,
    birthday_special_revenue: 0,
    cheki_gross_revenue: tkr,
    cheki_ops_cost: tkc,
    cheki_member_share: tokutenkaiIdolShareVal,
    cheki_net_profit: chekiNetProfit,
    cd_net_profit: releaseSalesRevenue,
    member_base_compensation: salaries,
    member_sales_share: tokutenkaiIdolShareVal,
    member_monthly_income_total: salaries + tokutenkaiIdolShareVal,
    staff_payroll: staff,
    office_admin_cost: office,
    promotion_cost: promotion,
    benefit_ops_cost: benefitOpsCost,
    production_cost: productionCost,
    goods_cost: 0,
    live_ticket_count_estimate: liveTickets > 0 ? Math.round(liveTickets / Math.max(1, 3_500)) : 0,
    fanclub_members_estimate: fanclubMembersEstimate,
    cd_units_sold: cdUnits,
    online_signing_member_seconds: cdOnlineSigningMemberSeconds(cdUnits),
    public_fans_estimate: publicFans,
    otaku_fans_estimate: otakuFans,
    core_fans_estimate: coreFans,
    female_fan_share_estimate: Math.round(weightedAudiencePct(audience, "femalePct")),
    youth_fan_share_estimate: Math.round(weightedAudiencePct(audience, "youthPct")),
    middle_plus_fan_share_estimate: Math.round(weightedAudiencePct(audience, "middlePlusPct")),
    fanclub_demand_multiplier: Math.round(demand.fanclub * 100) / 100,
    cheki_demand_multiplier: Math.round(demand.cheki * 100) / 100,
    goods_demand_multiplier: Math.round(demand.goods * 100) / 100,
    digital_demand_multiplier: Math.round(demand.digital * 100) / 100,
    release_demand_multiplier: Math.round(demand.release * 100) / 100,
    member_hours_live: memberHoursLive,
    member_hours_benefit: memberHoursBenefit,
    member_hours_media: memberHoursMedia,
    member_hours_training: memberHoursTraining,
    revenue_per_member_hour: totalMemberHours > 0 ? Math.round(income / totalMemberHours) : undefined,
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
