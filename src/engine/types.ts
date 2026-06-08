export type LetterTier = "S" | "A" | "B" | "C" | "D" | "E" | "F";

/** Mirrors `FinanceSystem.normalize_finances` / save `finances` block. */
export interface Finances {
  status: string;
  currency: string;
  cash_yen: number;
  opening_cash_yen: number;
  last_processed_date: string | null;
  ledger: DailyBreakdown[];
  notes: string;
}

/** One row from `FinanceSystem.build_daily_breakdown`. */
export interface DailyBreakdown {
  date: string;
  tier: string;
  income_total: number;
  expense_total: number;
  net_total: number;
  digital_sales: number;
  fan_meetings: number;
  goods: number;
  media: number;
  live_tickets: number;
  live_goods: number;
  tokutenkai_revenue: number;
  staff: number;
  office: number;
  promotion: number;
  live_cost: number;
  live_ops_cost: number;
  live_venue_fee: number;
  tokutenkai_cost: number;
  tokutenkai_idol_share: number;
  salaries: number;
  scout_retainers: number;
  media_passive_removed?: number;
  media_event_revenue?: number;
  media_operating_cost?: number;
  media_event_travel?: number;
  media_event_making?: number;
  media_event_advertising?: number;
  media_fixed_admin?: number;
  media_fixed_advertising?: number;
  media_event_count?: number;
  media_event_popularity_gain?: number;
  media_event_fan_gain?: number;
  cd_release_count?: number;
  cd_release_units?: number;
  cd_release_revenue?: number;
  cd_release_mv_cost?: number;
}
