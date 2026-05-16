import type { GameSavePayload } from "../save/gameSaveSchema";
import {
  createGameSaveFromLoadedScenario,
  getActiveFinances,
  getLetterTierFromGroup,
  getPrimaryGroup,
} from "../save/gameSaveSchema";
import { addNotification, getBlockingNotification } from "../save/inbox";
import type { DailyBreakdown, Finances } from "./types";
import type { LoadedScenario } from "../data/scenarioTypes";
import {
  addCalendarDays,
  applyDailyClose,
  buildDailyBreakdown,
  estimateVenueFee,
  normalizeFinances,
  monthlyBaseSalaryYenForGroupLetterTier,
  isWeekendUtc,
} from "./financeSystem";
import {
  applyDailyStatusUpdateJson,
  buildDailyTrainingPlan,
  defaultAutopilotTrainingIntensity,
  ensureIdolSimulationDefaults,
  normalizeTrainingWeekLog,
  recordTrainingDay,
  safeTrainingRow,
} from "./idolStatusSystem";
import {
  applyLiveResultToSnapshot,
  estimateTokutenkaiRevenueYen,
  resolveGroupLiveResultWeb,
} from "./livePerformanceWeb";
import { formatLiveSlotLine } from "./liveScheduleWeb";
import { applyScenarioEventsForDate } from "./scenarioRuntimeWeb";
import { buildDefaultScoutCompanies } from "./scoutWeb";
import {
  autoBookMonthFromMonthEndPrompt,
  ensureAutoBookedLivesThroughEndOfNextMonth,
  maybeSeedMonthEndAutoBookPrompt,
} from "./monthlyLiveScheduler";

export { createGameSaveFromLoadedScenario };
export const SIMULATION_DAY_START_TIME = "08:00:00";

export function isoDatePart(isoLike: string | null | undefined): string {
  return String(isoLike ?? "").split("T")[0] || "2020-01-01";
}

export function isoTimePart(isoLike: string | null | undefined): string {
  const text = String(isoLike ?? "");
  const time = text.includes("T") ? text.split("T")[1] ?? "" : "";
  const m = /^(\d{2}:\d{2})(?::\d{2})?/.exec(time);
  return m?.[1] ?? "08:00";
}

export function combineIsoDateTime(dateIso: string, hhmmss: string): string {
  return `${isoDatePart(dateIso)}T${hhmmss}`;
}

function hhmmToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function isoTimeToMinutes(isoLike: string | null | undefined): number {
  return hhmmToMinutes(isoTimePart(isoLike));
}

function currentSimulationIso(save: GameSavePayload): string {
  const base = save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01";
  return String(base).includes("T") ? String(base) : combineIsoDateTime(String(base), SIMULATION_DAY_START_TIME);
}

/** Legacy weekly autopilot marker retained only for older UI references. */
export const AUTOPILOT_LIVE_WEEKDAY_INDEX = 3;

function deepSaveCopy(save: GameSavePayload): GameSavePayload {
  return JSON.parse(JSON.stringify(save)) as GameSavePayload;
}

/** New desktop-shaped save from a loaded scenario (full DB trio). */
export function createNewGameSaveFromScenario(
  loaded: LoadedScenario,
  opts: { playerName: string; managedGroupLabel: string; managedGroupUid?: string },
): GameSavePayload {
  const save = createGameSaveFromLoadedScenario(loaded, {
    playerName: opts.playerName,
    managedGroupLabel: opts.managedGroupLabel,
    managedGroupUid: opts.managedGroupUid ?? null,
  });
  ensureAutoBookedLivesThroughEndOfNextMonth(save);
  save.current_date = combineIsoDateTime(save.current_date ?? save.game_start_date ?? loaded.preset.opening_date ?? "2020-01-01", SIMULATION_DAY_START_TIME);
  seedTodaysLiveBlockingInbox(save, save.current_date ?? save.game_start_date ?? loaded.preset.opening_date ?? "2020-01-01");
  maybeSeedMonthEndAutoBookPrompt(save);
  return save;
}

function memberCountFromSave(save: GameSavePayload): number {
  const g = getPrimaryGroup(save);
  const uids = g?.member_uids;
  const names = g?.member_names;
  const n = Array.isArray(uids) ? uids.length : Array.isArray(names) ? names.length : 1;
  return Math.max(1, n);
}

function readPopFans(save: GameSavePayload): { popularity: number; fans: number; xFollowers: number } {
  const g = getPrimaryGroup(save);
  const popularity =
    typeof g?.popularity === "number" ? g.popularity : Number(g?.popularity ?? 0) || 0;
  const fans = typeof g?.fans === "number" ? g.fans : Number(g?.fans ?? 0) || 0;
  const xFollowers =
    typeof g?.x_followers === "number" ? g.x_followers : Number(g?.x_followers ?? 0) || 0;
  return { popularity, fans, xFollowers };
}

export function getBlockingNotificationForSave(save: GameSavePayload) {
  const cur = save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01";
  return getBlockingNotification(save.inbox.notifications, String(cur).split("T")[0]);
}

function formatTodaysLiveScheduleBody(
  lives: Record<string, unknown>[],
  members: Record<string, unknown>[],
): string {
  if (!lives.length) return "";
  const lines: string[] = [];
  lines.push(`You have ${lives.length} managed-group live(s) today.`);
  lives.forEach((live, i) => {
    const title = String(live.title ?? live.live_type ?? "Live");
    const setlist = Array.isArray(live.setlist) ? (live.setlist as unknown[]).map((x) => String(x)) : [];
    const setText = setlist.length ? setlist.map((t, j) => `${j + 1}. ${t}`).join("\n") : "(no setlist)";
    const venue = String(live.venue ?? "TBA");
    const loc = String(live.location ?? "").trim();
    const cap = live.capacity != null ? String(live.capacity) : "—";
    const slot = formatLiveSlotLine(live);
    lines.push(`\n— ${i + 1}. ${title}`);
    lines.push(`  When: ${slot || String(live.start_date ?? "—")}`);
    lines.push(`  Venue: ${venue}${loc ? ` · ${loc}` : ""}`);
    lines.push(`  Capacity: ${cap}`);
    lines.push(`  Tokutenkai target tickets: ${String(live.tokutenkai_expected_tickets ?? "—")}`);
    lines.push(`  Setlist:\n${setText}`);
  });
  if (members.length) {
    lines.push("\nMembers (condition / morale):");
    for (const m of members) {
      const nm = String(m.name ?? "—");
      const c = typeof m.condition === "number" ? m.condition : Number(m.condition ?? 0) || 0;
      const mo = typeof m.morale === "number" ? m.morale : Number(m.morale ?? 0) || 0;
      lines.push(`  · ${nm}: ${Math.round(c)} / ${Math.round(mo)}`);
    }
  }
  lines.push("\nWhen you are ready, use Live Start in this message to run the show and receive the Operations report.");
  return lines.join("\n");
}

/** Compact body matching desktop `_build_live_report_notification_body`. */
export function buildLiveReportNotificationBody(live: Record<string, unknown>): string {
  const memberLines: string[] = [];
  const deltas = live.member_deltas;
  if (Array.isArray(deltas)) {
    for (const row of deltas.slice(0, 6)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const nm = String(r.name ?? "Member");
      const rate = r.performance_rating != null ? String(r.performance_rating) : "—";
      const fg = Number(r.fan_gain ?? 0) || 0;
      const mg = Number(r.morale_gain ?? r.morale_delta ?? 0) || 0;
      const tk = Number(r.tokutenkai_tickets ?? 0) || 0;
      memberLines.push(
        `${nm}: rate ${rate}, fans ${fg >= 0 ? "+" : ""}${fg}, morale ${mg >= 0 ? "+" : ""}${mg}, tokutenkai ${tk}`,
      );
    }
  }
  const titleSeed = String(live.title ?? live.live_type ?? "Live");
  const fanCh = Math.trunc(Number(live.group_fan_gain ?? live.fan_gain ?? 0) || 0);
  const venue = String(live.venue ?? "").trim();
  const loc = String(live.location ?? "").trim();
  const when = formatLiveSlotLine(live) || String(live.start_date ?? "").split("T")[0];
  const attendance = Number(live.attendance ?? 0) || 0;
  const capacity = Number(live.capacity ?? 0) || 0;
  const expectation = live.expectation_score != null ? String(live.expectation_score) : "—";
  const novelty = live.novelty_score != null ? String(live.novelty_score) : "—";
  const tokutenkaiActual = Number(live.tokutenkai_actual_tickets ?? 0) || 0;
  const tokutenkaiPlanned = Number(live.tokutenkai_expected_tickets ?? 0) || 0;
  const tokutenkaiGross =
    Number(live.tokutenkai_revenue_yen ?? estimateTokutenkaiRevenueYen(tokutenkaiActual)) || 0;
  const ticketGross = Number(live.ticket_gross_yen ?? 0) || 0;
  const goodsGross = Number(live.goods_gross_yen ?? 0) || 0;
  let body = `${titleSeed} finished with performance ${live.performance_score ?? "—"} and satisfaction ${live.audience_satisfaction ?? "—"}. `;
  body += `Attendance ${attendance}${capacity > 0 ? ` / ${capacity}` : ""}, fan change ${fanCh >= 0 ? "+" : ""}${fanCh}, expectation ${expectation}, novelty ${novelty}.`;
  if (venue) body += ` Venue: ${venue}${loc ? ` (${loc})` : ""}.`;
  if (when) body += ` Slot: ${when}.`;
  const setlist = Array.isArray(live.setlist) ? (live.setlist as unknown[]).map((x) => String(x)).filter(Boolean) : [];
  if (setlist.length) body += ` Setlist: ${setlist.join(" · ")}.`;
  if (tokutenkaiActual || tokutenkaiPlanned) {
    body += ` Tokutenkai ${tokutenkaiActual}/${tokutenkaiPlanned} tickets`;
    if (tokutenkaiGross > 0) body += ` (gross ¥${tokutenkaiGross.toLocaleString("ja-JP")})`;
    body += `.`;
  }
  if (ticketGross > 0 || goodsGross > 0) {
    const revenueBits: string[] = [];
    if (ticketGross > 0) revenueBits.push(`tickets ¥${ticketGross.toLocaleString("ja-JP")}`);
    if (goodsGross > 0) revenueBits.push(`goods ¥${goodsGross.toLocaleString("ja-JP")}`);
    body += ` Sales: ${revenueBits.join(" · ")}.`;
  }
  if (memberLines.length) body += " " + memberLines.join(" | ");
  return body;
}

function durationMinutesFromLive(live: Record<string, unknown>): number {
  const start = String(live.start_time ?? "").slice(0, 5);
  const end = String(
    live.tokutenkai_enabled ? live.tokutenkai_end ?? live.end_time ?? "" : live.end_time ?? "",
  ).slice(0, 5);
  const parse = (value: string): number | null => {
    const m = /^(\d{1,2}):(\d{2})$/.exec(value);
    if (!m) return null;
    return Number(m[1]) * 60 + Number(m[2]);
  };
  const startMin = parse(start);
  const endMin = parse(end);
  if (startMin == null || endMin == null) return 0;
  const delta = endMin - startMin;
  return delta > 0 ? delta : 0;
}

interface SimulationEvent {
  kind: "training_end" | "live_start";
  iso: string;
  label: string;
  liveUid?: string;
  slotId?: string;
  idolUids?: string[];
  trainingBlocksByUid?: Record<string, number>;
}

function liveReportEndTime(live: Record<string, unknown>): string {
  if (live.tokutenkai_enabled) {
    const end = String(live.tokutenkai_end ?? "").trim();
    if (/^\d{2}:\d{2}$/.test(end)) return end;
  }
  const liveEnd = String(live.end_time ?? "").trim();
  if (/^\d{2}:\d{2}$/.test(liveEnd)) return liveEnd;
  return "21:00";
}

function todaysLiveScheduleNotificationTime(lives: Record<string, unknown>[]): string {
  let latest = "18:00";
  let latestMinutes = hhmmToMinutes(latest);
  for (const live of lives) {
    const start = String(live.start_time ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(start)) continue;
    const minutes = hhmmToMinutes(start);
    if (minutes >= latestMinutes) {
      latest = start;
      latestMinutes = minutes;
    }
  }
  return latest;
}

function tokutenkaiExtraMinutesForMember(live: Record<string, unknown>, ticketCount: number): number {
  const tickets = Math.max(0, Math.trunc(ticketCount));
  const slotSeconds = Math.max(0, Number(live.tokutenkai_slot_seconds ?? 0) || 0);
  if (tickets <= 0 || slotSeconds <= 0) return 0;
  return Math.ceil((tickets * slotSeconds) / 60);
}

function liveDaysInWeekForGroup(save: GameSavePayload, groupUid: string): Set<string> {
  return new Set(
    (save.lives?.schedules ?? [])
      .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
      .filter((live) => String(live.group_uid ?? "") === groupUid)
      .map((live) => isoDatePart(String(live.start_date ?? "")))
      .filter(Boolean),
  );
}

function collectTodaySimulationEvents(save: GameSavePayload): SimulationEvent[] {
  const nowIso = currentSimulationIso(save);
  const todayIso = isoDatePart(nowIso);
  const nowMin = isoTimeToMinutes(nowIso);
  const out: SimulationEvent[] = [];
  const group = getPrimaryGroup(save);
  const gid = String(group?.uid ?? "");
  const memberUids = Array.isArray(group?.member_uids)
    ? (group!.member_uids as unknown[]).map((x) => String(x))
    : [];
  const rosterUids = memberUids.length > 0 ? memberUids : save.shortlist.map((x) => String(x));
  const liveDaysInWeek = liveDaysInWeekForGroup(save, gid);

  const trainingBySlot = new Map<string, { iso: string; label: string; byUid: Record<string, number> }>();
  for (const uid of rosterUids) {
    const intensity = safeTrainingRow(save.training_intensity[uid] ?? defaultAutopilotTrainingIntensity());
    const plan = buildDailyTrainingPlan(intensity, todayIso, liveDaysInWeek);
    for (const session of plan.sessions) {
      const eventMin = isoTimeToMinutes(session.endTime);
      if (eventMin <= nowMin) continue;
      const existing = trainingBySlot.get(session.slotId) ?? {
        iso: session.endTime,
        label: session.label,
        byUid: {},
      };
      existing.byUid[uid] = session.blocks;
      trainingBySlot.set(session.slotId, existing);
    }
  }
  for (const [slotId, row] of trainingBySlot.entries()) {
    out.push({
      kind: "training_end",
      iso: row.iso,
      label: row.label,
      slotId,
      idolUids: Object.keys(row.byUid),
      trainingBlocksByUid: row.byUid,
    });
  }

  for (const raw of save.lives.schedules) {
    if (!raw || typeof raw !== "object") continue;
    const live = raw as Record<string, unknown>;
    if (isoDatePart(String(live.start_date ?? "")) !== todayIso) continue;
    if (String(live.status ?? "") === "played") continue;
    const startTime = String(live.start_time ?? "").trim();
    const eventIso = combineIsoDateTime(todayIso, `${startTime || "18:00"}:00`.replace(/^(\d{2}:\d{2})$/, "$1:00"));
    if (isoTimeToMinutes(eventIso) <= nowMin) continue;
    out.push({
      kind: "live_start",
      iso: eventIso,
      label: String(live.title ?? live.live_type ?? "Today's live schedule"),
      liveUid: String(live.uid ?? ""),
    });
  }

  out.sort((a, b) => a.iso.localeCompare(b.iso) || a.kind.localeCompare(b.kind));
  return out;
}

export function hasPendingEventsToday(save: GameSavePayload): boolean {
  return collectTodaySimulationEvents(save).length > 0;
}

function buildLiveReportData(live: Record<string, unknown>): Record<string, unknown> {
  const ticketGross = Number(live.ticket_gross_yen ?? 0) || 0;
  const goodsGross = Number(live.goods_gross_yen ?? 0) || 0;
  const tokutenkaiRevenue =
    Number(live.tokutenkai_revenue_yen ?? estimateTokutenkaiRevenueYen(Number(live.tokutenkai_actual_tickets ?? 0) || 0)) || 0;
  return {
    kind: "live_report",
    title: String(live.title ?? live.live_type ?? "Live"),
    live_type: String(live.live_type ?? live.event_type ?? "Live"),
    date: String(live.date ?? live.start_date ?? "").split("T")[0],
    slot: formatLiveSlotLine(live) || String(live.start_date ?? "").split("T")[0],
    venue: String(live.venue ?? "—"),
    location: String(live.location ?? "").trim(),
    attendance: Number(live.attendance ?? 0) || 0,
    capacity: Number(live.capacity ?? 0) || 0,
    expectation_score: live.expectation_score ?? "—",
    novelty_score: live.novelty_score ?? "—",
    performance_score: live.performance_score ?? "—",
    audience_satisfaction: live.audience_satisfaction ?? "—",
    group_fan_gain: Number(live.group_fan_gain ?? live.fan_gain ?? 0) || 0,
    group_fan_count: Number(live.group_fan_count ?? live.fans ?? 0) || 0,
    gross_yen: ticketGross + goodsGross + tokutenkaiRevenue,
    ticket_gross_yen: ticketGross,
    goods_gross_yen: goodsGross,
    tokutenkai_actual_tickets: Number(live.tokutenkai_actual_tickets ?? 0) || 0,
    tokutenkai_expected_tickets: Number(live.tokutenkai_expected_tickets ?? 0) || 0,
    tokutenkai_revenue_yen: tokutenkaiRevenue,
    setlist: Array.isArray(live.setlist) ? live.setlist : [],
    member_deltas: Array.isArray(live.member_deltas)
      ? live.member_deltas.map((row) => {
          if (!row || typeof row !== "object") return row;
          const r = row as Record<string, unknown>;
          const tk = Number(r.tokutenkai_tickets ?? 0) || 0;
          return {
            ...r,
            cheki_sale_money_yen: estimateTokutenkaiRevenueYen(tk),
          };
        })
      : [],
  };
}

function subtractBreakdowns(a: DailyBreakdown, b: DailyBreakdown): DailyBreakdown {
  const keys: (keyof DailyBreakdown)[] = [
    "income_total",
    "expense_total",
    "net_total",
    "digital_sales",
    "fan_meetings",
    "goods",
    "media",
    "live_tickets",
    "live_goods",
    "tokutenkai_revenue",
    "staff",
    "office",
    "promotion",
    "live_cost",
    "live_ops_cost",
    "live_venue_fee",
    "tokutenkai_cost",
    "tokutenkai_idol_share",
    "salaries",
  ];
  const out = { ...a } as DailyBreakdown;
  const outNum = out as unknown as Record<string, number>;
  for (const k of keys) {
    outNum[k] = Math.trunc(Number(a[k] ?? 0) - Number(b[k] ?? 0));
  }
  out.date = a.date;
  out.tier = a.tier;
  out.net_total = out.income_total - out.expense_total;
  return out;
}

function applyLiveFinanceSettlement(
  finances: Finances,
  p: {
    targetIso: string;
    memberCount: number;
    popularity: number;
    fans: number;
    xFollowers: number;
    monthlySalaryTotal: number;
    tokutenkaiRevenue: number;
    liveVenueFeeTotal: number;
  },
): Finances {
  const base = buildDailyBreakdown({
    targetDateIso: p.targetIso,
    memberCount: p.memberCount,
    popularity: p.popularity,
    fans: p.fans,
    xFollowers: p.xFollowers,
    monthlySalaryTotal: p.monthlySalaryTotal,
    liveCount: 0,
    tokutenkaiRevenue: 0,
    tokutenkaiCost: 0,
    liveVenueFeeTotal: 0,
  });
  const full = buildDailyBreakdown({
    targetDateIso: p.targetIso,
    memberCount: p.memberCount,
    popularity: p.popularity,
    fans: p.fans,
    xFollowers: p.xFollowers,
    monthlySalaryTotal: p.monthlySalaryTotal,
    liveCount: 1,
    tokutenkaiRevenue: p.tokutenkaiRevenue,
    tokutenkaiCost: 0,
    liveVenueFeeTotal: p.liveVenueFeeTotal,
  });
  const delta = subtractBreakdowns(full, base);
  return applyDailyClose(finances, delta);
}

/**
 * Move scheduled managed lives for `targetIso` to results, apply snapshot + finance + inbox reports
 * (desktop `_archive_completed_lives_for_date` + `_start_todays_lives` report pass).
 */
export function archiveAndResolveManagedLivesForDate(save: GameSavePayload, targetIso: string): void {
  const group = getPrimaryGroup(save);
  if (!group || typeof group !== "object") return;
  const g = group as Record<string, unknown>;
  const memberUids = Array.isArray(g.member_uids)
    ? (g.member_uids as unknown[]).map((x) => String(x))
    : [];
  const rosterUids = memberUids.length > 0 ? memberUids : save.shortlist.map((x) => String(x));
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const uidSet = new Set(rosterUids);
  const members = idols.filter((row) => row && uidSet.has(String(row.uid ?? "")));
  const songs = save.database_snapshot.songs as Record<string, unknown>[];
  const weekLog = normalizeTrainingWeekLog(save.training_week_log);

  const resultUids = new Set(
    save.lives.results
      .map((raw) => {
        if (!raw || typeof raw !== "object") return "";
        const r = raw as Record<string, unknown>;
        return String(r.live_uid ?? r.uid ?? "");
      })
      .filter(Boolean),
  );

  const remaining: unknown[] = [];
  let finances = normalizeFinances(getActiveFinances(save) as Parameters<typeof normalizeFinances>[0]);
  const mc = memberCountFromSave(save);
  const letterTier = getLetterTierFromGroup(group);
  const monthlySalaryTotal = mc * monthlyBaseSalaryYenForGroupLetterTier(letterTier);

  for (const raw of save.lives.schedules) {
    if (!raw || typeof raw !== "object") continue;
    const live = { ...(raw as Record<string, unknown>) };
    const sd = String(live.start_date ?? "").split("T")[0];
    if (sd !== targetIso) {
      remaining.push(raw);
      continue;
    }
    const uid = String(live.uid ?? "");
    if (uid && resultUids.has(uid)) {
      remaining.push(raw);
      continue;
    }

    const resolution = resolveGroupLiveResultWeb(g, members, songs, live);
    const applied = applyLiveResultToSnapshot(g, members, resolution);
    const liveMinutes = durationMinutesFromLive(live);
    const rehearsalStart = String(live.rehearsal_start ?? "").slice(0, 5);
    const rehearsalEnd = String(live.rehearsal_end ?? "").slice(0, 5);
    const rehearsalMinutes = (() => {
      const parse = (value: string): number | null => {
        const m = /^(\d{1,2}):(\d{2})$/.exec(value);
        if (!m) return null;
        return Number(m[1]) * 60 + Number(m[2]);
      };
      const startMin = parse(rehearsalStart);
      const endMin = parse(rehearsalEnd);
      if (startMin == null || endMin == null) return 0;
      const delta = endMin - startMin;
      return delta > 0 ? delta : 0;
    })();
    const memberDeltaByUid = new Map<string, Record<string, unknown>>();
    if (Array.isArray(applied.member_deltas)) {
      for (const row of applied.member_deltas) {
        if (!row || typeof row !== "object") continue;
        const uid = String((row as Record<string, unknown>).uid ?? "");
        if (uid) memberDeltaByUid.set(uid, row as Record<string, unknown>);
      }
    }
    for (const member of members) {
      const uid = String(member.uid ?? "");
      const reportRow = memberDeltaByUid.get(uid);
      const tickets = Number(reportRow?.tokutenkai_tickets ?? 0) || 0;
      const extraLiveMinutes = tokutenkaiExtraMinutesForMember(live, tickets);
      applyDailyStatusUpdateJson(member, {
        trainingLoad: 0,
        trainingHours: 0,
        liveCount: 1,
        liveMinutes,
        rehearsalMinutes,
        extraLiveMinutes,
        birthday: false,
        includeSleepRecovery: false,
      });
      if (reportRow) {
        const beforeCondition = Number(reportRow.condition_before ?? member.condition ?? 0) || 0;
        const beforeMorale = Number(reportRow.morale_before ?? member.morale ?? 0) || 0;
        const afterCondition = Math.round(Number(member.condition ?? 0) || 0);
        const afterMorale = Math.round(Number(member.morale ?? 0) || 0);
        reportRow.fan_count = Math.round(Number(member.fan_count ?? reportRow.fan_count ?? 0) || 0);
        reportRow.condition_after = afterCondition;
        reportRow.condition_delta = afterCondition - beforeCondition;
        reportRow.morale_after = afterMorale;
        reportRow.morale_delta = afterMorale - beforeMorale;
        reportRow.morale_gain = afterMorale - beforeMorale;
      }
    }
    const ticketPrice = Math.max(0, Number(live.ticket_price ?? 0) || 0);
    const goodsGross = Math.max(0, Number(live.goods_gross_yen ?? live.goods_expected_revenue_yen ?? 0) || 0);
    const ticketGross = ticketPrice > 0 ? resolution.attendance * ticketPrice : 0;
    const tokutenkaiRevenue = estimateTokutenkaiRevenueYen(resolution.tokutenkai_actual_tickets);
    const played: Record<string, unknown> = {
      ...live,
      status: "played",
      ...resolution,
      ...applied,
      performance_score: resolution.performance_score,
      audience_satisfaction: resolution.audience_satisfaction,
      attendance: resolution.attendance,
      tokutenkai_actual_tickets: resolution.tokutenkai_actual_tickets,
      ticket_gross_yen: ticketGross,
      goods_gross_yen: goodsGross,
      tokutenkai_revenue_yen: tokutenkaiRevenue,
    };
    save.lives.results.push({
      date: targetIso,
      live_uid: uid,
      ...played,
    });
    if (uid) resultUids.add(uid);

    const cap = typeof live.capacity === "number" ? live.capacity : Number(live.capacity ?? 200) || 200;
    const liveVenueFeeTotal = estimateVenueFee(cap, { isWeekendOrHoliday: isWeekendUtc(targetIso) });
    const { popularity, fans, xFollowers } = readPopFans(save);
    finances = applyLiveFinanceSettlement(finances, {
      targetIso,
      memberCount: mc,
      popularity,
      fans,
      xFollowers,
      monthlySalaryTotal,
      tokutenkaiRevenue,
      liveVenueFeeTotal,
    });

    const titleSeed = String(played.title ?? played.live_type ?? "Live");
    const isFest = String(played.live_type ?? played.event_type ?? "") === "Festival";
    const titlePrefix = isFest ? "Festival report" : "Live report";
    addNotification(save, {
      title: `${titlePrefix}: ${titleSeed}`,
      body: buildLiveReportNotificationBody(played),
      sender: "Operations",
      category: "internal",
      level: "normal",
      isoDate: targetIso,
      createdTime: `${liveReportEndTime(live)}:00`,
      unread: true,
      dedupeKey: `live-report-start|${uid}|${targetIso}`,
      relatedEventUid: uid,
      reportData: buildLiveReportData(played),
    });
    played.report_generated_same_day = true;
  }
  save.lives.schedules = remaining;
  save.finances = finances;
  save.training_week_log = weekLog as unknown as GameSavePayload["training_week_log"];
}

function scheduledManagedLivesForDate(save: GameSavePayload, targetIso: string): Record<string, unknown>[] {
  const g = getPrimaryGroup(save) as Record<string, unknown> | null;
  const gid = g && String(g.uid ?? "");
  if (!gid) return [];
  return save.lives.schedules.filter((raw): raw is Record<string, unknown> => {
    if (!raw || typeof raw !== "object") return false;
    const live = raw as Record<string, unknown>;
    const sd = String(live.start_date ?? "").split("T")[0];
    return sd === targetIso && String(live.group_uid ?? "") === gid && String(live.status ?? "") !== "played";
  });
}

function seedTodaysLiveBlockingInbox(save: GameSavePayload, targetIso: string): void {
  const dayIso = isoDatePart(targetIso);
  const todaysLives = scheduledManagedLivesForDate(save, dayIso);
  if (!todaysLives.length) return;
  const g = getPrimaryGroup(save) as Record<string, unknown> | null;
  const gid = g && String(g.uid ?? "");
  if (!gid) return;
  const memberUids = Array.isArray(g.member_uids)
    ? (g.member_uids as unknown[]).map((x) => String(x))
    : save.shortlist.map((x) => String(x));
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const uidSet = new Set(memberUids);
  const members = idols.filter((row) => row && uidSet.has(String(row.uid ?? "")));
  const body = formatTodaysLiveScheduleBody(todaysLives, members);
  addNotification(save, {
    title: "Today's live schedule",
    body,
    sender: "Assistant",
    category: "confirmation",
    level: "critical",
    isoDate: dayIso,
    createdTime: `${todaysLiveScheduleNotificationTime(todaysLives)}:00`,
    unread: true,
    dedupeKey: `daily-lives|${gid}|${dayIso}`,
    requiresConfirmation: true,
  });
}

/** Confirm inbox item: runs live start for Today's live schedule, otherwise marks read. */
export function acknowledgeInboxNotification(save: GameSavePayload, notificationUid: string): GameSavePayload {
  const next = deepSaveCopy(save);
  const item = next.inbox.notifications.find((n) => n.uid === notificationUid);
  if (!item) return next;

  const title = String(item.title ?? "");
  const dk = String(item.dedupe_key ?? "");
  if (title === "Today's live schedule" || dk.startsWith("daily-lives|")) {
    const cur = next.current_date ?? next.game_start_date ?? next.scenario_context.startup_date ?? "2020-01-01";
    const curIso = String(cur).split("T")[0];
    const todaysLives = scheduledManagedLivesForDate(next, curIso);
    if (todaysLives.length > 0) {
      const reportTime = todaysLives
        .map((live) => liveReportEndTime(live))
        .sort()
        .at(-1) ?? "21:00";
      next.current_date = combineIsoDateTime(curIso, `${reportTime}:00`);
    }
    archiveAndResolveManagedLivesForDate(next, curIso);
  }
  if (dk.startsWith("auto-book-lives|")) {
    const monthStart = dk.split("|")[2] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(monthStart)) {
      autoBookMonthFromMonthEndPrompt(next, monthStart);
    }
  }

  item.read = true;
  item.requires_confirmation = false;

  if (next.inbox.notifications.length > 500) {
    next.inbox.notifications = next.inbox.notifications.slice(-500);
  }
  return next;
}

function applyMorningRecovery(next: GameSavePayload, targetDateIso: string): void {
  const group = getPrimaryGroup(next);
  if (!group || typeof group !== "object") return;
  const g = group as Record<string, unknown>;
  const memberUids = Array.isArray(g.member_uids)
    ? (g.member_uids as unknown[]).map((x) => String(x))
    : [];
  const rosterUids = memberUids.length > 0 ? memberUids : next.shortlist.map((x) => String(x));
  const idols = next.database_snapshot.idols as Record<string, unknown>[];
  for (const uid of rosterUids) {
    const idol = idols.find((r) => String(r.uid ?? "") === uid);
    if (!idol) continue;
    applyDailyStatusUpdateJson(idol, {
      trainingLoad: 0,
      trainingHours: 0,
      liveCount: 0,
      liveMinutes: 0,
      rehearsalMinutes: 0,
      birthday: false,
      includeSleepRecovery: true,
    });
  }
}

function processTrainingEndEvent(next: GameSavePayload, event: SimulationEvent): void {
  const idols = next.database_snapshot.idols as Record<string, unknown>[];
  const affected: string[] = [];
  for (const uid of event.idolUids ?? []) {
    const idol = idols.find((r) => String(r.uid ?? "") === uid);
    if (!idol) continue;
    const blocks = Math.max(1, event.trainingBlocksByUid?.[uid] ?? 1);
    applyDailyStatusUpdateJson(idol, {
      trainingLoad: Math.min(20, blocks * 10),
      trainingHours: blocks * 4,
      liveCount: 0,
      liveMinutes: 0,
      rehearsalMinutes: 0,
      birthday: false,
      includeSleepRecovery: false,
    });
    affected.push(String(idol.name ?? uid));
  }
  addNotification(next, {
    title: `${event.label} ended`,
    body: `${isoDatePart(event.iso)} ${isoTimePart(event.iso)} · ${affected.length} idol(s): ${affected.join(", ")}.`,
    sender: "Training",
    category: "general",
    isoDate: isoDatePart(event.iso),
    createdTime: `${isoTimePart(event.iso)}:00`,
    unread: true,
    dedupeKey: `training-end|${event.slotId}|${isoDatePart(event.iso)}`,
  });
}

/** Legacy full-day advance path retained while event-step mode wraps it. */
export function advanceOneDayLegacy(save: GameSavePayload): GameSavePayload {
  const next = deepSaveCopy(save);
  ensureAutoBookedLivesThroughEndOfNextMonth(next);
  const mc = memberCountFromSave(next);
  const group = getPrimaryGroup(next);
  const letterTier = getLetterTierFromGroup(group);
  const monthlySalaryTotal = mc * monthlyBaseSalaryYenForGroupLetterTier(letterTier);

  const gameStart = next.game_start_date ?? next.scenario_context.startup_date ?? "2020-01-01";
  const dayOffset = typeof next.turn_number === "number" ? next.turn_number : 0;

  let finances = normalizeFinances(getActiveFinances(next) as Parameters<typeof normalizeFinances>[0]);

  const targetIso = addCalendarDays(typeof gameStart === "string" ? gameStart : "2020-01-01", dayOffset);
  /** Live stress applies only after Live Start (desktop); day-of advance keeps training load lower. */
  const liveCount = 0;
  const liveMinutes = 0;
  const tokutenkaiRevenue = 0;
  const liveVenueFeeTotal = 0;

  if (group && typeof group === "object") {
    const g = group as Record<string, unknown>;
    const memberUids = Array.isArray(g.member_uids)
      ? (g.member_uids as unknown[]).map((x) => String(x))
      : [];
    const rosterUids = memberUids.length > 0 ? memberUids : next.shortlist.map((x) => String(x));
    const weekLog = normalizeTrainingWeekLog(next.training_week_log);
    const liveDaysInWeek = new Set(
      next.lives.schedules
        .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
        .filter((live) => String(live.group_uid ?? "") === String(g.uid ?? ""))
        .map((live) => String(live.start_date ?? "").split("T")[0])
        .filter(Boolean),
    );

    for (const uid of rosterUids) {
      const ti = next.training_intensity[uid];
      if (!ti || typeof ti !== "object") {
        next.training_intensity[uid] = { ...defaultAutopilotTrainingIntensity() };
      }
      const intensity = safeTrainingRow(next.training_intensity[uid]);
      const focus = String(next.training_focus_skill[uid] ?? "");
      const trainingPlan = buildDailyTrainingPlan(intensity, targetIso, liveDaysInWeek);
      recordTrainingDay(
        weekLog,
        uid,
        targetIso,
        intensity,
        trainingPlan.trainingHours,
        trainingPlan.sessionLabels,
        liveCount,
        liveMinutes,
        focus,
      );
    }

    next.training_week_log = weekLog as unknown as GameSavePayload["training_week_log"];

  }

  const { popularity, fans, xFollowers } = readPopFans(next);

  const breakdown = buildDailyBreakdown({
    targetDateIso: targetIso,
    memberCount: mc,
    popularity,
    fans,
    xFollowers,
    monthlySalaryTotal,
    liveCount,
    tokutenkaiRevenue,
    tokutenkaiCost: 0,
    liveVenueFeeTotal,
  });

  finances = applyDailyClose(finances, breakdown);

  next.finances = finances;
  next.turn_number = dayOffset + 1;
  next.current_date = targetIso;
  applyScenarioEventsForDate(next, targetIso);
  ensureAutoBookedLivesThroughEndOfNextMonth(next);
  seedTodaysLiveBlockingInbox(next, targetIso);
  maybeSeedMonthEndAutoBookPrompt(next);
  if (!next.scout.selected_company_uid) {
    next.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
  }

  if (next.inbox.notifications.length > 500) {
    next.inbox.notifications = next.inbox.notifications.slice(-500);
  }

  return next;
}

/** Advance simulation to the next event today, otherwise to the next day 08:00. */
export function advanceOneDay(save: GameSavePayload): GameSavePayload {
  const next = deepSaveCopy(save);
  ensureAutoBookedLivesThroughEndOfNextMonth(next);
  const nowIso = currentSimulationIso(next);
  const todayIso = isoDatePart(nowIso);
  const events = collectTodaySimulationEvents(next);
  if (events.length > 0) {
    const event = events[0]!;
    next.current_date = event.iso;
    if (event.kind === "training_end") {
      processTrainingEndEvent(next, event);
    } else if (event.kind === "live_start") {
      seedTodaysLiveBlockingInbox(next, event.iso);
    }
    if (!next.scout.selected_company_uid) {
      next.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
    }
    return next;
  }

  const dayAdvanced = advanceOneDayLegacy(next);
  const targetIso = isoDatePart(dayAdvanced.current_date ?? currentSimulationIso(dayAdvanced));
  dayAdvanced.current_date = combineIsoDateTime(targetIso, SIMULATION_DAY_START_TIME);
  applyMorningRecovery(dayAdvanced, targetIso);
  return dayAdvanced;
}

export { getBlockingNotification };
