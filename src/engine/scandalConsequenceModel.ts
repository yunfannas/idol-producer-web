/**
 * Scandal consequence evaluation model.
 *
 * Two layers:
 * 1. Raw consequences — cash / fans / morale / salary / form deltas applied to the save.
 * 2. Evaluation axes — 0–100 scores for brand, fans, finance, roster, live, team,
 *    plus a weighted utility used to rank options for the player.
 *
 * Severity (`score` 1–5) and near-term live pressure reshape both layers.
 */

export type ScandalAction =
  | "terminate_after_live"
  | "terminate_now"
  | "demote_leader"
  | "suspend_activities"
  | "keep_with_penalty"
  | "acknowledge";

export type ScandalEvalContext = {
  score: number;
  groupFans: number;
  idolFans: number;
  cashYen: number;
  popularity: number;
  /** Group public-trust reputation 1-5 (iLiFE! low ≈ 2; =LOVE high ≈ 5). */
  groupReputation: number;
  /** Agency discipline harshness 1-5 (Imaginate ≈ 5). */
  agencyHarshness: number;
  hasLeaderRole: boolean;
  /** Catalog-defined suspension length; null/undefined falls back to severity policy. */
  suspensionDays?: number | null;
  /** Days until next managed live; null if none in the near window. */
  daysToNextLive: number | null;
  /** Capacity / prestige hint for that live (Budokan-scale → higher). */
  nextLivePrestige: number;
  historicalAction: ScandalAction | null;
  idolMorale: number;
  teamAvgMorale: number;
};

export type ScandalConsequenceDeltas = {
  action: ScandalAction;
  label: string;
  morale_self: number;
  morale_team: number;
  fan_group_delta: number;
  fan_idol_delta: number;
  popularity_delta: number;
  cash_delta_yen: number;
  salary_cut_pct: number;
  penalty_days: number;
  performance_mult: number;
  sales_mult: number;
  roster_effect: "immediate_exit" | "exit_after_live" | "demote" | "suspend" | "keep" | "warn";
  /** When true, hiatus has no return_date (無期限活動休止). */
  indefinite_suspend?: boolean;
  blurb: string;
};

/** Axis scores are 0–100 (higher = healthier for that dimension). */
export type ScandalEvalAxes = {
  brand: number;
  fans: number;
  finance: number;
  roster: number;
  live: number;
  team: number;
};

export type ScandalOptionEvaluation = {
  action: ScandalAction;
  label: string;
  consequences: ScandalConsequenceDeltas;
  axes: ScandalEvalAxes;
  /** Weighted composite 0–100. */
  utility: number;
  risk: "low" | "medium" | "high" | "extreme";
  verdict: string;
  matches_history: boolean;
  /** Weight vector used for this evaluation (for UI / debug). */
  weights: ScandalEvalWeights;
};

export type ScandalEvalWeights = {
  brand: number;
  fans: number;
  finance: number;
  roster: number;
  live: number;
  team: number;
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function actionLabel(action: ScandalAction): string {
  switch (action) {
    case "terminate_after_live":
      return "Terminate after live";
    case "terminate_now":
      return "Terminate immediately";
    case "demote_leader":
      return "Keep with heavy penalty (demote leader)";
    case "suspend_activities":
      return "Suspend from activities";
    case "keep_with_penalty":
      return "Keep with heavy penalty";
    case "acknowledge":
      return "Issue warning only";
    default:
      return action;
  }
}

/** Severity scalar 0–1 from scandal score 1–5. */
export function severityUnit(score: number): number {
  return clamp(Number(score) || 1, 1, 5) / 5;
}

/**
 * Context-sensitive axis weights.
 * High-severity scandals prioritize brand; imminent big lives prioritize live continuity.
 */
export function scandalEvalWeights(ctx: ScandalEvalContext): ScandalEvalWeights {
  const s = severityUnit(ctx.score);
  const livePressure =
    ctx.daysToNextLive != null && ctx.daysToNextLive <= 7
      ? clamp(1 - ctx.daysToNextLive / 7, 0.15, 1) * clamp(ctx.nextLivePrestige, 0.4, 1.5)
      : 0;
  const rep = clamp(Number(ctx.groupReputation) || 3, 1, 5);
  const harsh = clamp(Number(ctx.agencyHarshness) || 3, 1, 5);
  // Low reputation → brand weight up (soft keep looks worse).
  // High harshness → brand weight up (firm cuts match agency culture).
  const repUnit = (6 - rep) / 5;
  const harshUnit = harsh / 5;

  let brand = 0.18 + 0.22 * s + 0.06 * repUnit + 0.05 * harshUnit;
  let fans = 0.2 + 0.04 * repUnit;
  let finance = 0.14;
  let roster = 0.18 - 0.08 * s - 0.04 * harshUnit;
  let live = 0.12 + 0.18 * livePressure;
  let team = 0.18 - 0.06 * s;

  const sum = brand + fans + finance + roster + live + team;
  return {
    brand: brand / sum,
    fans: fans / sum,
    finance: finance / sum,
    roster: roster / sum,
    live: live / sum,
    team: team / sum,
  };
}

/**
 * Layer 1 — raw gameplay deltas for one action.
 */
export function computeScandalConsequences(
  action: ScandalAction,
  ctx: Pick<
    ScandalEvalContext,
    "score" | "groupFans" | "idolFans" | "suspensionDays" | "daysToNextLive" | "nextLivePrestige"
  > &
    Partial<Pick<ScandalEvalContext, "groupReputation" | "agencyHarshness">>,
): ScandalConsequenceDeltas {
  const score = clamp(Number(ctx.score) || 1, 1, 5);
  const s = score / 5;
  const groupFans = Math.max(0, Math.round(ctx.groupFans));
  const idolFans = Math.max(0, Math.round(ctx.idolFans));
  const rep = clamp(Number(ctx.groupReputation) || 3, 1, 5);
  const harsh = clamp(Number(ctx.agencyHarshness) || 3, 1, 5);
  // Low reputation amplifies soft-keep fan/PR shock; high harshness slightly softens
  // firm-cut fan shock (fans already expect hard agency discipline).
  const softAmp = 1 + 0.12 * ((6 - rep) / 5);
  const firmFanRelief = 1 - 0.08 * ((harsh - 3) / 2);
  const liveSoon =
    ctx.daysToNextLive != null && ctx.daysToNextLive <= 3
      ? clamp(1 - ctx.daysToNextLive / 3, 0.25, 1) * clamp(ctx.nextLivePrestige, 0.5, 1.4)
      : 0;

  const pack = (
    partial: Omit<ScandalConsequenceDeltas, "action" | "label">,
  ): ScandalConsequenceDeltas => ({
    action,
    label: actionLabel(action),
    ...partial,
  });

  if (action === "terminate_now") {
    // Immediate cut before a prestige live amplifies fan/cash shock.
    const liveAmp = 1 + 0.55 * liveSoon;
    const fanGroup = -Math.max(
      80,
      Math.round(groupFans * (0.035 + 0.025 * s) * liveAmp * firmFanRelief),
    );
    const fanIdol = -Math.max(40, Math.round(idolFans * (0.12 + 0.08 * s) * firmFanRelief));
    const cash = -Math.round((450_000 + 350_000 * s) * (1 + 0.35 * liveSoon));
    return pack({
      morale_self: -8,
      morale_team: -4 - Math.round(2 * liveSoon),
      fan_group_delta: fanGroup,
      fan_idol_delta: fanIdol,
      popularity_delta: -(0.6 + 0.5 * s) * (1 + 0.25 * liveSoon) * firmFanRelief,
      cash_delta_yen: cash,
      salary_cut_pct: 0,
      penalty_days: 0,
      performance_mult: 1,
      sales_mult: 1,
      roster_effect: "immediate_exit",
      blurb:
        liveSoon > 0.4
          ? "Cut her before a major live. Firm brand signal, but ticket/fan backlash spikes."
          : "Cut her today. Protects brand firmness, but sheds fans fast.",
    });
  }

  if (action === "terminate_after_live") {
    const fanGroup = -Math.max(40, Math.round(groupFans * (0.015 + 0.015 * s)));
    const fanIdol = -Math.max(20, Math.round(idolFans * (0.06 + 0.04 * s)));
    const cash = -Math.round(300_000 + 200_000 * s);
    return pack({
      morale_self: -6,
      morale_team: -2,
      fan_group_delta: fanGroup,
      fan_idol_delta: fanIdol,
      popularity_delta: -(0.3 + 0.3 * s),
      cash_delta_yen: cash,
      salary_cut_pct: 0,
      penalty_days: Math.max(1, ctx.daysToNextLive ?? 2),
      performance_mult: 0.94,
      sales_mult: 0.9,
      roster_effect: "exit_after_live",
      blurb: "Let her finish the booked live, then exit. Softens ticket backlash; she still leaves.",
    });
  }

  if (action === "demote_leader") {
    // Demotion is a keep-with-heavy-penalty path: she stays, but leadership is stripped
    // as the public penalty (心花りり / Budokan eve historical response).
    const keepAmp = (1 + 0.4 * s + 0.35 * liveSoon) * softAmp;
    const fanGroup = -Math.max(100, Math.round(groupFans * (0.04 + 0.03 * s) * keepAmp));
    const fanIdol = -Math.max(50, Math.round(idolFans * (0.09 + 0.07 * s) * softAmp));
    const cash = -Math.round((650_000 + 450_000 * s) * (1 + 0.25 * liveSoon) * softAmp);
    return pack({
      morale_self: -18,
      morale_team: -6 - Math.round(2 * s),
      fan_group_delta: fanGroup,
      fan_idol_delta: fanIdol,
      popularity_delta: -(1.0 + 0.7 * s) * (1 + 0.2 * liveSoon),
      cash_delta_yen: cash,
      salary_cut_pct: 25,
      penalty_days: 56,
      performance_mult: 0.86,
      sales_mult: 0.8,
      roster_effect: "demote",
      blurb:
        "Keep her under heavy penalty and strip leader. Same keep cost class; demotion is the accountability signal.",
    });
  }

  if (action === "suspend_activities") {
    // Mid path: stay contracted, leave the stage. Brand firmer than keep; live continuity hurt.
    const fanGroup = -Math.max(50, Math.round(groupFans * (0.02 + 0.018 * s)));
    const fanIdol = -Math.max(30, Math.round(idolFans * (0.07 + 0.05 * s)));
    const cash = -Math.round(380_000 + 260_000 * s);
    const catalogDays =
      ctx.suspensionDays != null && Number.isFinite(ctx.suspensionDays)
        ? Math.max(1, Math.round(ctx.suspensionDays))
        : null;
    const indefinite = catalogDays == null && score >= 4;
    return pack({
      morale_self: -14,
      morale_team: -1,
      fan_group_delta: fanGroup,
      fan_idol_delta: fanIdol,
      popularity_delta: -(0.45 + 0.35 * s),
      cash_delta_yen: cash,
      salary_cut_pct: 40,
      penalty_days: catalogDays ?? (indefinite ? 90 : 42),
      performance_mult: 0.0,
      sales_mult: 0.0,
      roster_effect: "suspend",
      indefinite_suspend: indefinite,
      blurb: indefinite
        ? "Indefinite activity suspension. She stays signed but leaves lives/SNS until reviewed."
        : "Suspend for some time. She stays signed but sits out lives until the return window.",
    });
  }

  if (action === "keep_with_penalty") {
    // Keeping a score-5 scandal through a prestige weekend is especially costly.
    // Low-reputation groups (e.g. iLiFE!) take a heavier soft-keep hit.
    const keepAmp = (1 + 0.4 * s + 0.35 * liveSoon) * softAmp;
    const fanGroup = -Math.max(120, Math.round(groupFans * (0.045 + 0.035 * s) * keepAmp));
    const fanIdol = -Math.max(60, Math.round(idolFans * (0.1 + 0.08 * s) * softAmp));
    const cash = -Math.round((700_000 + 500_000 * s) * (1 + 0.25 * liveSoon) * softAmp);
    return pack({
      morale_self: -18,
      morale_team: -8 - Math.round(3 * s),
      fan_group_delta: fanGroup,
      fan_idol_delta: fanIdol,
      popularity_delta: -(1.2 + 0.8 * s) * (1 + 0.2 * liveSoon) * softAmp,
      cash_delta_yen: cash,
      salary_cut_pct: 25,
      penalty_days: 56,
      performance_mult: 0.86,
      sales_mult: 0.8,
      roster_effect: "keep",
      blurb: "Override a hard exit and keep her. Heavy PR cost, fan revolt, long form penalty.",
    });
  }

  // acknowledge
  const fanGroup = -Math.max(60, Math.round(groupFans * (0.02 + 0.025 * s) * (1 + 0.3 * s)));
  const fanIdol = -Math.max(25, Math.round(idolFans * (0.05 + 0.04 * s)));
  const cash = -Math.round(150_000 + 150_000 * s);
  return pack({
    morale_self: -8,
    morale_team: -6 - Math.round(2 * s),
    fan_group_delta: fanGroup,
    fan_idol_delta: fanIdol,
    popularity_delta: -(0.5 + 0.5 * s),
    cash_delta_yen: cash,
    salary_cut_pct: 0,
    penalty_days: 21,
    performance_mult: 0.95,
    sales_mult: 0.93,
    roster_effect: "warn",
    blurb: "Public warning only. Cheap short-term, but fans and teammates read it as soft.",
  });
}

function mapFanAxis(fanDelta: number, groupFans: number): number {
  const base = Math.max(groupFans, 1);
  // 0% loss → 100; 8% loss → ~20
  const lossPct = clamp((-fanDelta) / base, 0, 0.12);
  return clamp(100 - (lossPct / 0.08) * 80, 0, 100);
}

function mapCashAxis(cashDelta: number, cashYen: number): number {
  const burn = Math.max(0, -cashDelta);
  const ref = Math.max(cashYen * 0.08, 800_000);
  return clamp(100 - (burn / ref) * 100, 0, 100);
}

function mapPopAxis(popDelta: number): number {
  // 0 → 100; -2.0 → ~20
  return clamp(100 + popDelta * 40, 0, 100);
}

function mapTeamAxis(moraleTeam: number): number {
  // +4 → ~90; 0 → 70; -10 → ~30
  return clamp(70 + moraleTeam * 5, 0, 100);
}

function mapLiveAxis(c: ScandalConsequenceDeltas, ctx: ScandalEvalContext): number {
  if (c.roster_effect === "suspend") {
    // Suspended member: stage quality for remaining roster is OK, but lineup hole hurts.
    let score = 55;
    const liveSoon =
      ctx.daysToNextLive != null && ctx.daysToNextLive <= 7
        ? clamp(1 - ctx.daysToNextLive / 7, 0, 1) * clamp(ctx.nextLivePrestige, 0.5, 1.4)
        : 0;
    // Sitting out a prestige live protects brand optics more than form continuity.
    score -= 12 * liveSoon;
    score += 8 * severityUnit(ctx.score); // better than keeping a tainted performer on stage
    return clamp(score, 0, 100);
  }
  const form = clamp(c.performance_mult * 100, 40, 100);
  const sales = clamp(c.sales_mult * 100, 40, 100);
  let score = form * 0.55 + sales * 0.25 + (100 - clamp(c.penalty_days, 0, 60) * 0.7) * 0.2;

  const liveSoon =
    ctx.daysToNextLive != null && ctx.daysToNextLive <= 7
      ? clamp(1 - ctx.daysToNextLive / 7, 0, 1) * clamp(ctx.nextLivePrestige, 0.5, 1.4)
      : 0;

  if (liveSoon > 0) {
    if (c.roster_effect === "immediate_exit") score -= 28 * liveSoon;
    if (c.roster_effect === "exit_after_live") score += 18 * liveSoon;
    // Demote is a keep-class response: tainted performer still on stage.
    if (c.roster_effect === "keep" || c.roster_effect === "demote" || c.roster_effect === "warn") {
      score -= 10 * liveSoon * severityUnit(ctx.score);
    }
  }
  return clamp(score, 0, 100);
}

function mapBrandAxis(action: ScandalAction, ctx: ScandalEvalContext): number {
  const s = severityUnit(ctx.score);
  const rep = clamp(Number(ctx.groupReputation) || 3, 1, 5);
  const harsh = clamp(Number(ctx.agencyHarshness) || 3, 1, 5);
  // Baseline firmness by action
  let brand =
    action === "terminate_now"
      ? 88
      : action === "terminate_after_live"
        ? 78
        : action === "suspend_activities"
          ? 74
          : action === "demote_leader"
            ? 48 // keep-class; demotion buys a little accountability vs soft keep
            : action === "keep_with_penalty"
              ? 38
              : 45;

  // Soft keep / demote-as-keep collapse on high severity
  if (action === "keep_with_penalty" || action === "demote_leader" || action === "acknowledge") {
    brand -= 35 * s;
    // Low-reputation groups lose more brand credit on soft paths.
    brand -= 8 * ((6 - rep) / 5);
    // Harsh agencies treat soft keep as culture betrayal.
    brand -= 10 * ((harsh - 3) / 2);
  }
  // Firm cuts / suspension gain brand credit when severity is high
  if (action === "terminate_now" || action === "terminate_after_live" || action === "suspend_activities") {
    brand += 8 * s;
    brand += 6 * ((harsh - 3) / 2); // Imaginate-class offices are rewarded for firmness
  }
  // Demotion is only credible when she holds leader; otherwise it is just soft keep
  if (action === "demote_leader" && ctx.hasLeaderRole) brand += 10;
  if (action === "demote_leader" && !ctx.hasLeaderRole) brand -= 25;

  return clamp(brand, 0, 100);
}

function mapRosterAxis(action: ScandalAction, ctx: ScandalEvalContext): number {
  let roster =
    action === "keep_with_penalty"
      ? 82
      : action === "demote_leader"
        ? 78 // keep-class, slight culture credit for stripping title
        : action === "acknowledge"
          ? 78
          : action === "suspend_activities"
            ? 68
            : action === "terminate_after_live"
              ? 48
              : 35;

  // Soft keep / demote-as-keep / warn hurt culture on high severity
  if (action === "keep_with_penalty" || action === "demote_leader" || action === "acknowledge") {
    roster -= 25 * severityUnit(ctx.score);
  }
  if (action === "suspend_activities") {
    roster -= 8 * severityUnit(ctx.score);
  }
  if (action === "demote_leader" && !ctx.hasLeaderRole) roster -= 15;
  return clamp(roster, 0, 100);
}

/**
 * Layer 2 — convert deltas + context into evaluation axes.
 */
export function scoreScandalAxes(
  consequences: ScandalConsequenceDeltas,
  ctx: ScandalEvalContext,
): ScandalEvalAxes {
  return {
    brand: mapBrandAxis(consequences.action, ctx),
    fans: mapFanAxis(consequences.fan_group_delta, ctx.groupFans) * 0.7 + mapPopAxis(consequences.popularity_delta) * 0.3,
    finance: mapCashAxis(consequences.cash_delta_yen, ctx.cashYen) * 0.85 +
      clamp(100 - consequences.salary_cut_pct * 2.2, 40, 100) * 0.15,
    roster: mapRosterAxis(consequences.action, ctx),
    live: mapLiveAxis(consequences, ctx),
    team: mapTeamAxis(consequences.morale_team),
  };
}

export function utilityFromAxes(axes: ScandalEvalAxes, weights: ScandalEvalWeights): number {
  return clamp(
    axes.brand * weights.brand +
      axes.fans * weights.fans +
      axes.finance * weights.finance +
      axes.roster * weights.roster +
      axes.live * weights.live +
      axes.team * weights.team,
    0,
    100,
  );
}

export function riskFromUtilityAndAxes(utility: number, axes: ScandalEvalAxes): ScandalOptionEvaluation["risk"] {
  const worst = Math.min(axes.brand, axes.fans, axes.finance, axes.roster, axes.live, axes.team);
  if (utility < 35 || worst < 22) return "extreme";
  if (utility < 48 || worst < 35) return "high";
  if (utility < 62 || worst < 48) return "medium";
  return "low";
}

export function verdictForEvaluation(
  action: ScandalAction,
  axes: ScandalEvalAxes,
  utility: number,
  ctx: ScandalEvalContext,
): string {
  const weakest = (Object.entries(axes) as Array<[keyof ScandalEvalAxes, number]>).sort((a, b) => a[1] - b[1])[0];
  const strongest = (Object.entries(axes) as Array<[keyof ScandalEvalAxes, number]>).sort((a, b) => b[1] - a[1])[0];
  const hist =
    ctx.historicalAction && ctx.historicalAction === action ? " Matches the historical response." : "";
  return `Utility ${utility.toFixed(0)}/100 — strongest ${strongest[0]} (${strongest[1].toFixed(0)}), weakest ${weakest[0]} (${weakest[1].toFixed(0)}).${hist}`;
}

/**
 * Full evaluation for one option.
 */
export function evaluateScandalOption(action: ScandalAction, ctx: ScandalEvalContext): ScandalOptionEvaluation {
  const consequences = computeScandalConsequences(action, ctx);
  const weights = scandalEvalWeights(ctx);
  const axes = scoreScandalAxes(consequences, ctx);
  const utility = utilityFromAxes(axes, weights);
  return {
    action,
    label: consequences.label,
    consequences,
    axes,
    utility,
    risk: riskFromUtilityAndAxes(utility, axes),
    verdict: verdictForEvaluation(action, axes, utility, ctx),
    matches_history: Boolean(ctx.historicalAction && ctx.historicalAction === action),
    weights,
  };
}

/**
 * Evaluate and rank all candidate actions (best utility first).
 */
export function evaluateScandalOptions(
  actions: ScandalAction[],
  ctx: ScandalEvalContext,
): ScandalOptionEvaluation[] {
  return actions
    .map((action) => evaluateScandalOption(action, ctx))
    .sort((a, b) => b.utility - a.utility || a.label.localeCompare(b.label));
}

/** Prestige heuristic from venue/title (Budokan / arena / hall). */
export function livePrestigeFromTitle(title: string, venue: string): number {
  const text = `${title} ${venue}`.toLowerCase();
  if (/武道館|budokan|budoukan/.test(text)) return 1.4;
  if (/アリーナ|arena|ドーム|dome|横浜ぴあ|pia arena/.test(text)) return 1.15;
  if (/ホール|hall|劇場|theater|theatre/.test(text)) return 0.85;
  return 0.55;
}

export function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const a = String(fromIso).split("T")[0];
  const b = String(toIso).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null;
  const ms = Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.round(ms / 86_400_000);
}
