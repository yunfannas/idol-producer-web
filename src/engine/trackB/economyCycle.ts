import type { GameSavePayload } from "../../save/gameSaveSchema";
import { getLetterTierFromGroup, getPrimaryGroup } from "../../save/gameSaveSchema";
import { addNotification } from "../../save/inbox";
import type { DailyBreakdown, Finances } from "../types";
import { applyDailyClose, normalizeFinances } from "../financeSystem";
import type { ExternalWorkOffer, MonthlyOperatingReport, TrackBState } from "./types";
import {
  buildStrategy,
  clamp,
  derivedWorkRate,
  ensureTrackB,
  isoDatePart,
  isSundayUtc,
  monthKey,
  num,
  strategyPresetForGroup,
  applyConditionCost,
  recoverCondition,
  settleColorMonth,
  syncCondition,
} from "./runtimeState";

function hash01(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10000) / 10000;
}

export function applyTrackBTrainingLoad(
  save: GameSavePayload,
  idol: Record<string, unknown>,
  blocks: number,
  intensity: { sing: number; dance: number; physical: number },
): void {
  const tb = ensureTrackB(save);
  const uid = String(idol.uid ?? "");
  const m = tb.members[uid];
  if (!m) return;
  const load = blocks * (1.1 * Math.max(0.4, intensity.sing / 5) + 1.4 * Math.max(0.4, (intensity.dance + intensity.physical) / 10));
  applyConditionCost(m, load);
  if (m.attributes.agility < 18 && intensity.dance >= 2) m.attributes.agility += hash01(`${uid}|ag|${blocks}`) > 0.92 ? 1 : 0;
  if (m.attributes.stamina < 18 && intensity.physical >= 2) m.attributes.stamina += hash01(`${uid}|st|${blocks}`) > 0.94 ? 1 : 0;
  if (m.attributes.breath < 18 && intensity.sing >= 2) m.attributes.breath += hash01(`${uid}|br|${blocks}`) > 0.93 ? 1 : 0;
  syncCondition(idol, m);
}

/** Apply a non-training workload (calendar media, an appearance, etc.) to the
 * same Condition pool. Callers provide an already-normalized workload amount;
 * this intentionally does not resurrect a separate media/fatigue counter. */
export function applyTrackBWorkload(
  save: GameSavePayload,
  idol: Record<string, unknown>,
  baseLoad: number,
): void {
  const tb = ensureTrackB(save);
  const m = tb.members[String(idol.uid ?? "")];
  if (!m) return;
  applyConditionCost(m, Math.max(0, baseLoad));
  syncCondition(idol, m);
}

export function applyTrackBRecovery(save: GameSavePayload, idol: Record<string, unknown>): void {
  const tb = ensureTrackB(save);
  const m = tb.members[String(idol.uid ?? "")];
  if (!m) return;
  recoverCondition(m, 8, 0.8 + tb.strategy.rest_protection * 0.06);
  for (const key of ["vocal_issue", "physical_issue"] as const) {
    const issue = m[key];
    if (!issue) continue;
    issue.recovery_days = m.condition >= 70 ? issue.recovery_days + 1 : 0;
    if (issue.recovery_days < 5) continue;
    if (issue.severity === "severe") issue.severity = "moderate";
    else if (issue.severity === "moderate") issue.severity = "mild";
    else m[key] = null;
    if (m[key]) m[key]!.recovery_days = 0;
  }
  syncCondition(idol, m);
}

function poisson(lambda: number, seed: string): number {
  const L = Math.exp(-Math.max(0.02, lambda));
  let k = 0;
  let p = 1;
  do {
    k += 1;
    p *= hash01(`${seed}|${k}`);
  } while (p > L && k < 8);
  return k - 1;
}

const WORK_TYPES: ExternalWorkOffer["type"][] = [
  "tv_variety",
  "radio_podcast",
  "magazine_web",
  "fashion_model",
  "acting",
  "commercial_promotion",
  "event_mc",
  "tv_music_show",
];

function generateExternalOffers(save: GameSavePayload, tb: TrackBState, iso: string): void {
  const group = getPrimaryGroup(save);
  const tier = String(getLetterTierFromGroup(group) || "D");
  const hasPr = tb.staff.slots.length >= 3;
  const base: Record<string, number> = { S: 4, A: 2.5, B: 1.2, C: 0.5, D: 0.15, E: 0.08 };
  const lambda = (base[tier] ?? 0.1) * (hasPr ? 1 : 0.35) * (tb.strategy.media_ip_emphasis / 5 + 0.4);
  if (!["C", "B", "A", "S"].includes(tier) || !hasPr) {
    if (hash01(`${iso}|organic`) > 0.72) {
      const uids = Object.keys(tb.members);
      const uid = uids[Math.floor(hash01(`${iso}|who`) * uids.length)] ?? uids[0];
      if (uid) {
        tb.external_offers.push({
          uid: `xw-${iso}-${uid.slice(0, 8)}`,
          type: "radio_podcast",
          target: "personal",
          idol_uids: [uid],
          date: iso,
          income_yen: 18000,
          difficulty: 8,
          accepted: true,
          completed: false,
          result: null,
          reassignable: false,
        });
      }
    }
    return;
  }
  const n = poisson(lambda, `${iso}|offers`);
  const memberUids = Object.keys(tb.members);
  for (let i = 0; i < n; i++) {
    const type = WORK_TYPES[Math.floor(hash01(`${iso}|t|${i}`) * WORK_TYPES.length)] ?? "magazine_web";
    const personal = hash01(`${iso}|p|${i}`) > 0.7;
    const uid = memberUids[Math.floor(hash01(`${iso}|m|${i}`) * memberUids.length)];
    const tierMod: Record<string, number> = { E: 0.5, D: 0.7, C: 1, B: 1.5, A: 2.3, S: 3.5 };
    const income = Math.round(40000 * (tierMod[tier] ?? 1) * (0.9 + hash01(`${iso}|yen|${i}`) * 0.2));
    tb.external_offers.push({
      uid: `xw-${iso}-${i}`,
      type,
      target: personal ? "personal" : "group",
      idol_uids: personal && uid ? [uid] : memberUids.slice(0, 3),
      date: iso,
      income_yen: income,
      difficulty: 10 + Math.round(hash01(`${iso}|d|${i}`) * 6),
      accepted: true,
      completed: false,
      result: null,
      reassignable: !personal,
    });
  }
}

function completeDueOffers(_save: GameSavePayload, tb: TrackBState, iso: string): number {
  let income = 0;
  for (const offer of tb.external_offers) {
    if (!offer.accepted || offer.completed) continue;
    if (offer.date > iso) continue;
    const scores = offer.idol_uids.map((uid) => {
      const m = tb.members[uid];
      if (!m) return 0.6;
      return derivedWorkRate(m) * (0.85 + hash01(`${offer.uid}|job`) * 0.3);
    });
    const avg = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
    const result = avg >= 1.05 ? "great_success" : avg >= 0.75 ? "success" : "unsatisfactory";
    offer.completed = true;
    offer.result = result;
    income += offer.income_yen;
    for (const uid of offer.idol_uids) {
      const m = tb.members[uid];
      if (!m) continue;
      const share = offer.target === "personal" ? 1 : offer.target === "unit" ? 0.8 / Math.sqrt(Math.max(1, offer.idol_uids.length)) : 0.2 / Math.max(1, offer.idol_uids.length);
      const reach = offer.type === "tv_music_show" ? 18000 : offer.type === "tv_variety" ? 9000 : 2500;
      const resultMod = result === "great_success" ? 1.2 : result === "success" ? 1 : 0.7;
      m.personal_public = Math.max(0, Math.round(m.personal_public * 0.97 + reach * share * resultMod * 0.15));
      m.confidence = clamp(m.confidence + (result === "great_success" ? 3 : result === "success" ? 0.5 : -2), 0, 100);
      applyConditionCost(m, offer.type === "tv_music_show" ? 3 : 1.5);
    }
  }
  return income;
}

function advanceMaking(tb: TrackBState): void {
  const invest = tb.strategy.production_investment;
  for (const project of tb.making) {
    if (project.live_ready) continue;
    const bump = 6 + invest * 2;
    if (project.stage === 1) {
      project.concept = clamp(project.concept + bump, 0, 100);
      if (project.concept >= 70) project.stage = 2;
    } else if (project.stage === 2) {
      project.lyrics = clamp(project.lyrics + bump, 0, 100);
      project.music = clamp(project.music + bump * 0.9, 0, 100);
      if (project.lyrics >= 68 && project.music >= 68) project.stage = 3;
    } else if (project.stage === 3) {
      project.choreography = clamp(project.choreography + bump, 0, 100);
      if (project.choreography >= 68) project.stage = 4;
    } else if (project.stage === 4) {
      project.performance = clamp(project.performance + bump * 0.7, 0, 100);
      if (project.performance >= 60) project.stage = 5;
    } else {
      project.integration = clamp(project.integration + bump, 0, 100);
      if (project.integration >= 70) project.live_ready = true;
    }
  }
}

export function runSundayResolution(save: GameSavePayload, iso: string): void {
  const tb = ensureTrackB(save);
  if (tb.last_sunday_iso === iso) return;
  const group = getPrimaryGroup(save) as Record<string, unknown> | null;
  const events = tb.week_events.filter((e) => {
    const dt = Date.parse(`${e.date}T12:00:00Z`);
    const ref = Date.parse(`${iso}T12:00:00Z`);
    return Number.isFinite(dt) && Number.isFinite(ref) && ref - dt <= 7 * 86400000;
  });
  const liveSat =
    events.length > 0
      ? events.reduce((s, e) => s + e.live_satisfaction * (e.public_attendance + e.otaku_attendance + e.core_attendance), 0) /
        Math.max(1, events.reduce((s, e) => s + e.public_attendance + e.otaku_attendance + e.core_attendance, 0))
      : tb.satisfaction.live_week;
  const engageSat =
    events.length > 0
      ? events.reduce((s, e) => s + e.engage_satisfaction * (e.core_attendance + e.otaku_attendance), 0) /
        Math.max(1, events.reduce((s, e) => s + e.core_attendance + e.otaku_attendance, 0))
      : tb.satisfaction.engage_week;
  tb.satisfaction.live_week = liveSat;
  tb.satisfaction.engage_week = engageSat;
  tb.satisfaction.live_4w = [liveSat, ...tb.satisfaction.live_4w].slice(0, 4);
  tb.satisfaction.engage_4w = [engageSat, ...tb.satisfaction.engage_4w].slice(0, 4);

  const sns = events.reduce((s, e) => s + e.sns, 0) + tb.strategy.viral_music_content * 0.08;
  const streaming = events.reduce((s, e) => s + e.streaming, 0);
  const media = events.reduce((s, e) => s + e.media, 0) + tb.strategy.media_ip_emphasis * 0.05;
  tb.fans.momentum_po += sns * 0.35 + streaming * 0.45 + media * 0.25;
  tb.fans.momentum_oc += (engageSat / 100) * 0.15 + tb.strategy.post_live_tokutenkai_emphasis * 0.02;

  // Exposure has its own member path. It is not folded into group Satisfaction,
  // but it can build personal recognition and affinity before Sunday conversion.
  for (const member of Object.values(tb.members)) {
    const exposure = member.weekly_exposure_impression;
    member.personal_public = Math.max(0, Math.round(member.personal_public * 0.98 + exposure * 0.08));
    member.otaku_affinity = clamp(member.otaku_affinity + exposure / 20000, 0.02, 0.9);
  }

  // --- P→O→C conversion ---
  // kPo/kOc tuned so a D-tier group doing routine taibans barely converts.
  // Big events (one-man, release, media) would push momentum much higher.
  const kPo = 0.025;
  const kOc = 0.010;
  const pPo = 1 - Math.exp(-kPo * tb.fans.momentum_po);
  const pOc = 1 - Math.exp(-kOc * tb.fans.momentum_oc);
  const newOtaku = Math.round(tb.fans.public * pPo);
  const newCore = Math.round(tb.fans.otaku * pOc);
  tb.fans.public = Math.max(0, tb.fans.public - newOtaku);
  tb.fans.otaku = Math.max(0, tb.fans.otaku + newOtaku - newCore);
  tb.fans.core = Math.max(0, tb.fans.core + newCore);

  // --- Organic public inflow (SNS, streaming, scene discovery) ---
  // Three channels contribute new Public fans each week:
  // 1. SNS viral reach: weekly events SNS signals × member personal_public reach
  const memberList0 = Object.values(tb.members);
  const memberSnsReach = memberList0.reduce((s, m) => s + Math.sqrt(Math.max(0, m.personal_public)), 0);
  const snsNewPublic = Math.round(sns * 2.5 + memberSnsReach * 0.18);
  // 2. Streaming / digital exposure: scales with song catalog freshness and strategy emphasis
  const streamNewPublic = Math.round(streaming * 3.0 + tb.strategy.viral_music_content * 4);
  // 3. Scene discovery: baseline from being active in the idol scene (taiban exposure, venue
  //    foot traffic, lineup discovery). An active D-tier group doing 10 lives/week gets ~15-25
  //    new casual public fans per week just from being seen.
  const weeklyLiveCount = events.length;
  const popularity = num((save.database_snapshot.groups as Record<string, unknown>[])?.[0]?.popularity, 15);
  const sceneNewPublic = Math.round(3 + popularity * 0.2 + weeklyLiveCount * 1.0);
  const organicPublic = snsNewPublic + streamNewPublic + sceneNewPublic;
  tb.fans.public += organicPublic;

  // --- Natural churn ---
  tb.fans.public = Math.round(tb.fans.public * (1 - 0.01));    // 1%/week natural churn
  tb.fans.otaku = Math.round(tb.fans.otaku * (1 - 0.012));    // 1.2%/week — otaku churn without fresh content
  tb.fans.core = Math.round(tb.fans.core * (1 - 0.005 * (1 - tb.fans.box_rate * 0.3)));  // 0.3-0.5%/week
  tb.fans.momentum_po *= 0.25;   // faster decay so momentum doesn't accumulate across weeks
  tb.fans.momentum_oc *= 0.3;

  // --- Popularity regression toward baseline ---
  // Without exceptional activity, popularity slowly regresses toward a tier-based equilibrium
  const g0 = (save.database_snapshot.groups as Record<string, unknown>[])?.[0];
  const currentPop = num(g0?.popularity, 15);
  const basePop = num(g0?.popularity_baseline ?? g0?.popularity, currentPop); // baseline from initial snapshot
  const popDrift = (basePop - currentPop) * 0.02; // 2% regression toward baseline per week
  if (g0) g0.popularity = clamp(currentPop + popDrift, 0, 100);
  tb.fans.box_rate = clamp(tb.fans.box_rate + (engageSat - 60) * 0.0004, 0.05, 0.85);

  const memberList = Object.values(tb.members);
  const coreTotal = Math.max(1, memberList.reduce((s, m) => s + Math.max(0.01, m.core_share), 0));
  for (const m of memberList) {
    m.core_share = tb.fans.core * (Math.max(0.01, m.core_share) / coreTotal);
    m.personal_public = Math.round(m.personal_public * (1 - 0.03));
    const weeklyCondition = m.weekly_samples > 0 ? m.weekly_condition_sum / m.weekly_samples : m.condition;
    const policyAlign = (tb.strategy.rest_protection - 2.5) * 0.3;
    const idol = (save.database_snapshot.idols as Record<string, unknown>[]).find((row) => String(row.uid ?? "") === m.idol_uid);
    const morale = num(idol?.morale, 70);
    const deltaM = clamp(((weeklyCondition - 60) / 80 + policyAlign + (liveSat - 60) / 80) * 2.2, -5, 5);
    if (idol) idol.morale = clamp(morale + deltaM, 0, 100);
    m.confidence = clamp(m.confidence + clamp((liveSat - 60) / 40, -6, 6) * 0.4, 0, 100);
    m.weekly_condition_sum = 0;
    m.weekly_condition_min = m.condition;
    m.weekly_samples = 0;
    m.weekly_exposure_impression = 0;
    if (idol) syncCondition(idol, m);
  }

  const uids = Object.keys(tb.members);
  for (let i = 0; i < uids.length; i++) {
    for (let j = i + 1; j < uids.length; j++) {
      const a = uids[i]!;
      const b = uids[j]!;
      let bond = tb.bonds.find((row) => (row.a === a && row.b === b) || (row.a === b && row.b === a));
      if (!bond) {
        bond = { a, b, familiarity: 18, admire: 8 };
        tb.bonds.push(bond);
      }
      const contact = 4 * 0.5 + (events.length ? 3 : 0);
      bond.familiarity = clamp(bond.familiarity + 0.25 * contact * (1 - bond.familiarity / 100), 0, 100);
    }
  }

  generateExternalOffers(save, tb, iso);
  advanceMaking(tb);

  if (group) {
    group.public_fans = tb.fans.public;
    group.otaku_fans = tb.fans.otaku;
    group.core_fans = tb.fans.core;
    group.box_rate = tb.fans.box_rate;
    group.fans = tb.fans.public + tb.fans.otaku + tb.fans.core;
  }
  tb.last_sunday_iso = iso;
  addNotification(save, {
    title: "Weekly operations report",
    body: `Public ${tb.fans.public.toLocaleString("ja-JP")} · Otaku ${tb.fans.otaku.toLocaleString("ja-JP")} · Core ${tb.fans.core.toLocaleString("ja-JP")}. Live satisfaction ${Math.round(liveSat)}, fan-engagement ${Math.round(engageSat)}. Box rate ${(tb.fans.box_rate * 100).toFixed(1)}%.`,
    sender: "Staff",
    category: "report",
    level: "normal",
    isoDate: iso,
    createdTime: "21:00:00",
    unread: true,
    dedupeKey: `weekly-ops|${iso}`,
  });
}

export function seedStrategyMeetingIfNeeded(save: GameSavePayload, iso: string): void {
  const tb = ensureTrackB(save);
  const day = isoDatePart(iso);
  if (day.slice(-2) !== "01") return;
  const month = monthKey(day);
  if (tb.strategy_month_seeded === month) return;
  // Policy is persistent and staff continues to apply it by default.  The
  // former mandatory monthly strategy meeting conflicted with the current
  // non-blocking model: a review can be useful, but it must not halt time.
  tb.strategy.visible_month = month;
  tb.strategy.locked = true;
  tb.strategy_month_seeded = month;
  addNotification(save, {
    title: "Monthly operating review",
    body: `Staff is continuing the current policy defaults for ${month}. Review Policy only if you want to change long-run direction.`,
    sender: "Staff",
    category: "report",
    level: "normal",
    isoDate: day,
    createdTime: "09:00:00",
    unread: true,
    dedupeKey: `monthly-policy-review|${month}`,
  });
}

export function lockStrategyMeeting(save: GameSavePayload, iso: string): void {
  const tb = ensureTrackB(save);
  const group = getPrimaryGroup(save);
  const month = monthKey(iso);
  tb.strategy = buildStrategy(strategyPresetForGroup(group as Record<string, unknown> | null), month);
  tb.strategy.locked = true;
  tb.strategy_month_seeded = month;
  addNotification(save, {
    title: "Strategy locked",
    body: `${tb.strategy.preset_id} is locked for ${month}. Staff will execute the mix; handle exceptions only.`,
    sender: "Staff",
    category: "report",
    level: "normal",
    isoDate: isoDatePart(iso),
    createdTime: "09:30:00",
    unread: true,
    dedupeKey: `strategy-locked|${month}`,
  });
}

function sumLedger(rows: DailyBreakdown[], key: keyof DailyBreakdown): number {
  let s = 0;
  for (const row of rows) s += num(row[key], 0);
  return s;
}

export function computeCareerScorePreview(tb: TrackBState, letterTier: string): number {
  const tierScore = { S: 100, A: 82, B: 68, C: 54, D: 40, E: 28, F: 18, I: 10 }[letterTier] ?? 40;
  const live4 =
    tb.satisfaction.live_4w.reduce((a, b) => a + b, 0) / Math.max(1, tb.satisfaction.live_4w.length);
  const eng4 =
    tb.satisfaction.engage_4w.reduce((a, b) => a + b, 0) / Math.max(1, tb.satisfaction.engage_4w.length);
  return Math.round((0.5 * tierScore + 0.3 * live4 + 0.2 * eng4) * 10) / 10;
}

export function closeTrackBMonth(save: GameSavePayload, iso: string): void {
  const tb = ensureTrackB(save);
  const month = monthKey(iso);
  const day = isoDatePart(iso);
  if (tb.last_month_closed === month) return;
  settleColorMonth(tb, day);

  const finances = normalizeFinances(save.finances as Parameters<typeof normalizeFinances>[0]);
  const cashStart = tb.monthly_reports.at(-1)?.cash_end ?? num(finances.opening_cash_yen, finances.cash_yen);
  const xwIncome = completeDueOffers(save, tb, day);
  if (xwIncome > 0) {
    const extra: DailyBreakdown = {
      date: day,
      tier: String(getLetterTierFromGroup(getPrimaryGroup(save))),
      income_total: xwIncome,
      expense_total: 0,
      net_total: xwIncome,
      digital_sales: 0,
      fan_meetings: 0,
      goods: 0,
      media: 0,
      live_tickets: 0,
      live_goods: 0,
      tokutenkai_revenue: 0,
      staff: 0,
      office: 0,
      promotion: 0,
      live_cost: 0,
      live_ops_cost: 0,
      live_venue_fee: 0,
      tokutenkai_cost: 0,
      tokutenkai_idol_share: 0,
      salaries: 0,
      scout_retainers: 0,
      media_appearance_revenue: xwIncome,
      member_hours_media: 2,
    } as DailyBreakdown;
    extra.net_total = extra.income_total - extra.expense_total;
    save.finances = applyDailyClose(finances as Finances, extra);
  }
  const closed = normalizeFinances(save.finances as Parameters<typeof normalizeFinances>[0]);
  const monthLedger = (closed.ledger ?? []).filter((row) => String(row.date ?? "").startsWith(month));
  const income = sumLedger(monthLedger, "income_total");
  const expense = sumLedger(monthLedger, "expense_total");
  const hours =
    sumLedger(monthLedger, "member_hours_live") +
    sumLedger(monthLedger, "member_hours_benefit") +
    sumLedger(monthLedger, "member_hours_media") +
    sumLedger(monthLedger, "member_hours_training");
  const live4 =
    tb.satisfaction.live_4w.reduce((a, b) => a + b, 0) / Math.max(1, tb.satisfaction.live_4w.length);
  const eng4 =
    tb.satisfaction.engage_4w.reduce((a, b) => a + b, 0) / Math.max(1, tb.satisfaction.engage_4w.length);
  const report: MonthlyOperatingReport = {
    month,
    cash_start: cashStart,
    cash_end: closed.cash_yen,
    income_total: income,
    expense_total: expense,
    net_total: income - expense,
    live_ticket_revenue: sumLedger(monthLedger, "live_tickets"),
    live_goods_revenue: sumLedger(monthLedger, "live_goods"),
    tokutenkai_revenue: sumLedger(monthLedger, "tokutenkai_revenue"),
    digital_streaming_revenue: sumLedger(monthLedger, "digital_sales"),
    fanclub_revenue: sumLedger(monthLedger, "fan_meetings"),
    media_appearance_revenue: sumLedger(monthLedger, "media"),
    staff_payroll: sumLedger(monthLedger, "staff"),
    salaries: sumLedger(monthLedger, "salaries"),
    member_hours: hours,
    revenue_per_member_hour: hours > 0 ? Math.round(income / hours) : 0,
    public: tb.fans.public,
    otaku: tb.fans.otaku,
    core: tb.fans.core,
    box_rate: tb.fans.box_rate,
    live_satisfaction_4w: live4,
    engage_satisfaction_4w: eng4,
    career_score_preview: computeCareerScorePreview(tb, String(getLetterTierFromGroup(getPrimaryGroup(save)))),
    members: Object.values(tb.members).map((m) => ({
      idol_uid: m.idol_uid,
      core_share: m.core_share,
      otaku_affinity: m.otaku_affinity,
      personal_public: m.personal_public,
      condition: m.condition,
      confidence: m.confidence,
      vocal_issue: m.vocal_issue?.severity ?? null,
      physical_issue: m.physical_issue?.severity ?? null,
    })),
  };
  tb.monthly_reports.push(report);
  tb.last_month_closed = month;
  addNotification(save, {
    title: "Monthly finance report",
    body: `${month}: net ¥${report.net_total.toLocaleString("ja-JP")}, cash ¥${report.cash_end.toLocaleString("ja-JP")}, revenue/member-hour ¥${report.revenue_per_member_hour.toLocaleString("ja-JP")}. Fans P/O/C ${report.public}/${report.otaku}/${report.core}.`,
    sender: "Finance",
    category: "report",
    level: "normal",
    isoDate: day,
    createdTime: "22:00:00",
    unread: true,
    dedupeKey: `monthly-finance|${month}`,
    reportData: report as unknown as Record<string, unknown>,
  });
}

export function maybeRunTrackBCadence(save: GameSavePayload, iso: string): void {
  ensureTrackB(save);
  seedStrategyMeetingIfNeeded(save, iso);
  if (isSundayUtc(iso)) runSundayResolution(save, iso);
  const day = isoDatePart(iso);
  const [y, m] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y!, m!, 0)).toISOString().slice(0, 10);
  if (day === last) closeTrackBMonth(save, iso);
}
