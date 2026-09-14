export type VisibleAttributeV2 =
  | "agility" | "natural_fitness" | "stamina" | "cute" | "pretty"
  | "pitch" | "tone" | "breath" | "rhythm" | "power" | "stage_presence"
  | "wit" | "humor" | "talking" | "teamwork" | "fashion" | "creativity";

export type AttributesV2 = Record<VisibleAttributeV2, number>;
export type ThemeTag = string;
export type IssueSeverity = "mild" | "moderate" | "severe";

export interface ActiveIssue { severity: IssueSeverity; started_on: string; recovery_days: number; }

export type ExternalWorkType =
  | "tv_variety" | "radio_podcast" | "magazine_web" | "fashion_model"
  | "acting" | "commercial_promotion" | "event_mc" | "tv_music_show";

export interface SongWorkProfile {
  song_uid: string;
  /** Empty is a valid, deliberately neutral fallback for unresearched songs. */
  themes: ThemeTag[];
  appeal: number;
  vocal_difficulty: number;
  dance_difficulty: number;
  sing_lead_count: number;
  dance_lead_count: number;
  vocal_lead_requirement: number;
  dance_lead_requirement: number;
  bpm: number | null;
  vocal_range: { low: number | null; high: number | null } | null;
  formation: string | null;
  provenance: "evidence" | "default";
}

export interface SongRuntimeFamiliarity { vocal: number; dance: number; }

export interface MemberRuntimeState {
  idol_uid: string;
  attributes: AttributesV2;
  /** The only continuous short-term workload state: 100 fresh, 0 exhausted. */
  condition: number;
  vocal_issue: ActiveIssue | null;
  physical_issue: ActiveIssue | null;
  confidence: number;
  personal_public: number;
  otaku_affinity: number;
  core_share: number;
  sell_out_rate: number;
  theme_skill: Record<ThemeTag, number>;
  theme_xp: Record<ThemeTag, number>;
  theme_last_used: Record<ThemeTag, string>;
  weekly_condition_sum: number;
  weekly_condition_min: number;
  weekly_samples: number;
  weekly_exposure_impression: number;
}

export interface FanLayerState {
  public: number; otaku: number; core: number; box_rate: number; momentum_po: number; momentum_oc: number;
}

export interface SatisfactionWindow { live_week: number; engage_week: number; live_4w: number[]; engage_4w: number[]; }

export interface GroupStrategyState {
  preset_id: string; visible_month: string; locked: boolean;
  live_frequency: number; online_benefit_emphasis: number; shooting_handshake_emphasis: number;
  post_live_tokutenkai_emphasis: number; media_ip_emphasis: number; viral_music_content: number;
  production_investment: number; rest_protection: number; roster_renewal_system: number; member_exposure_policy: string;
}

export interface StaffSlot { grade: "junior" | "standard" | "senior"; ability: number; }
export interface StaffPackageState { team_tier: string; slots: StaffSlot[]; }

export interface MakingProject {
  uid: string; title: string; stage: 1 | 2 | 3 | 4 | 5;
  concept: number; lyrics: number; music: number; choreography: number;
  performance: number; integration: number; live_ready: boolean;
}

export interface ExternalWorkOffer {
  uid: string; type: ExternalWorkType; target: "group" | "personal" | "unit";
  idol_uids: string[]; date: string; income_yen: number; difficulty: number;
  accepted: boolean; completed: boolean; result: "great_success" | "success" | "unsatisfactory" | null;
  reassignable: boolean;
}

export interface PairBond { a: string; b: string; familiarity: number; admire: number; }

export interface WeeklyLiveMomentum {
  date: string;
  public_attendance: number; otaku_attendance: number; core_attendance: number;
  live_satisfaction: number; engage_satisfaction: number; effectiveness: number;
  public_impression: number; otaku_impression: number; core_impression: number;
  sns: number; streaming: number; media: number;
}

export interface WorldThemeState { score: number; momentum: number; saturation: number; }

export interface MonthlyOperatingReport {
  month: string; cash_start: number; cash_end: number; income_total: number; expense_total: number; net_total: number;
  live_ticket_revenue: number; live_goods_revenue: number; tokutenkai_revenue: number;
  digital_streaming_revenue: number; fanclub_revenue: number; media_appearance_revenue: number;
  staff_payroll: number; salaries: number; member_hours: number; revenue_per_member_hour: number;
  public: number; otaku: number; core: number; box_rate: number;
  live_satisfaction_4w: number; engage_satisfaction_4w: number; career_score_preview: number;
  members: Array<{ idol_uid: string; core_share: number; otaku_affinity: number; personal_public: number; condition: number; confidence: number; vocal_issue: IssueSeverity | null; physical_issue: IssueSeverity | null }>;
}

export interface TrackBState {
  schema: "track_b_v2";
  members: Record<string, MemberRuntimeState>;
  fans: FanLayerState;
  satisfaction: SatisfactionWindow;
  strategy: GroupStrategyState;
  staff: StaffPackageState;
  song_profiles: Record<string, SongWorkProfile>;
  song_familiarity: Record<string, SongRuntimeFamiliarity>;
  world_themes: Record<ThemeTag, WorldThemeState>;
  making: MakingProject[];
  external_offers: ExternalWorkOffer[];
  bonds: PairBond[];
  week_events: WeeklyLiveMomentum[];
  monthly_reports: MonthlyOperatingReport[];
  last_sunday_iso: string | null;
  last_month_closed: string | null;
  strategy_month_seeded: string | null;
}
