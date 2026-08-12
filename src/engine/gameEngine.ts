import type { GameSavePayload } from "../save/gameSaveSchema";
import {
  createGameSaveFromLoadedScenario,
  ensureGroupPolicy,
  getActiveFinances,
  getLetterTierFromGroup,
  getPrimaryGroup,
  refreshStartupUpcomingLivesNotification,
} from "../save/gameSaveSchema";
import { addNotification, getBlockingNotification } from "../save/inbox";
import type { DailyBreakdown, Finances } from "./types";
import type { LoadedScenario } from "../data/scenarioTypes";
import {
  addCalendarDays,
  applyDailyClose,
  buildDailyBreakdown,
  cdOnlineSigningMemberSeconds,
  estimateLiveGoodsUnits,
  estimateVenueFee,
  financeAudienceProfileForGroup,
  normalizeFinances,
  monthlyBaseSalaryYenForGroupLetterTier,
  isWeekendUtc,
  type FinanceAudienceProfile,
} from "./financeSystem";
import {
  applyDailyStatusUpdateJson,
  buildDailyTrainingPlan,
  ensureIdolSimulationDefaults,
  isIdolOnHiatus,
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
import { processCareerDecisionsForDate } from "./careerDecision";
import { accrueMonthlyTenureReputation } from "./reputationModel";
import { buildDefaultScoutCompanies } from "./scoutWeb";
import { totalMonthlyScoutRetainersYen } from "./scoutWeb";
import {
  applyTrainingToManagedSongs,
  decayManagedSongsOvernight,
  maybeAddSongUnlockNotification,
  registerManagedSetlistPerformance,
} from "./songStatusSystem";
import {
  autoBookMonthFromMonthEndPrompt,
  ensureAutoBookedLivesThroughEndOfNextMonth,
  maybeSeedMonthEndAutoBookPrompt,
} from "./monthlyLiveScheduler";
import {
  findManagedOfficialScheduleBundleInRuntime,
  resolveManagedMediaDay,
} from "./mediaEventWeb";

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

function isoToComparableMs(isoLike: string | null | undefined): number {
  const raw = String(isoLike ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes("T") ? raw : combineIsoDateTime(raw, SIMULATION_DAY_START_TIME);
  const parsed = Date.parse(`${normalized.endsWith("Z") ? normalized : `${normalized}Z`}`);
  return Number.isFinite(parsed) ? parsed : 0;
}

function keepCurrentDateMonotonic(
  save: GameSavePayload,
  previousIso: string | null | undefined,
  nextIso: string | null | undefined,
): void {
  const prevText = currentSimulationIso({ ...save, current_date: previousIso ?? save.current_date } as GameSavePayload);
  const nextText = String(nextIso ?? "").trim()
    ? (String(nextIso).includes("T") ? String(nextIso) : combineIsoDateTime(String(nextIso), SIMULATION_DAY_START_TIME))
    : prevText;
  save.current_date = isoToComparableMs(nextText) >= isoToComparableMs(prevText) ? nextText : prevText;
}

function hhmmToMinutes(value: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return 0;
  return Number(m[1]) * 60 + Number(m[2]);
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
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
  refreshStartupUpcomingLivesNotification(save, save.current_date ?? save.game_start_date ?? loaded.preset.opening_date ?? "2020-01-01");
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

function financeAudienceProfileForSave(
  save: GameSavePayload,
  group: Record<string, unknown> | null | undefined,
  letterTier: ReturnType<typeof getLetterTierFromGroup>,
  fans: number,
): FinanceAudienceProfile {
  const g = group ?? getPrimaryGroup(save);
  return financeAudienceProfileForGroup({
    groupName: g?.name ?? g?.group_name ?? g?.title,
    groupRomaji: g?.name_romanji ?? g?.name_romaji ?? g?.romaji ?? g?.romanized_name,
    letterTier,
    fans,
  });
}

export function getBlockingNotificationForSave(save: GameSavePayload) {
  const cur = save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01";
  return getBlockingNotification(save.inbox.notifications, String(cur));
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
  kind: "training_end" | "live_schedule_notice" | "live_start" | "live_report_notice";
  iso: string;
  label: string;
  liveUid?: string;
  slotId?: string;
  idolUids?: string[];
  trainingBlocksByUid?: Record<string, number>;
}

function minutesToHHMM(totalMinutes: number): string {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, Math.trunc(totalMinutes)));
  const hours = Math.floor(clamped / 60);
  const minutes = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
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
  let earliestMinutes = Number.POSITIVE_INFINITY;
  for (const live of lives) {
    const start = String(live.start_time ?? "").trim();
    if (!/^\d{2}:\d{2}$/.test(start)) continue;
    const minutes = hhmmToMinutes(start);
    if (minutes < earliestMinutes) earliestMinutes = minutes;
  }
  if (!Number.isFinite(earliestMinutes)) return "17:00";
  return minutesToHHMM(Math.max(hhmmToMinutes("08:00"), earliestMinutes - 60));
}

function liveReportNotificationTime(live: Record<string, unknown>): string {
  return minutesToHHMM(hhmmToMinutes(liveReportEndTime(live)) + 60);
}

function hasNotificationWithDedupe(save: GameSavePayload, dedupeKey: string): boolean {
  return save.inbox.notifications.some((row) => String(row.dedupe_key ?? "") === dedupeKey);
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

function availableManagedMemberUidsForDate(save: GameSavePayload, targetIso: string): string[] {
  const group = getPrimaryGroup(save) as Record<string, unknown> | null;
  const memberUids = Array.isArray(group?.member_uids)
    ? (group!.member_uids as unknown[]).map((x) => String(x))
    : [];
  const rosterUids = memberUids.length > 0 ? memberUids : save.shortlist.map((x) => String(x));
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  return rosterUids.filter((uid) => {
    const idol = idols.find((row) => String(row.uid ?? "") === uid);
    return idol ? !isIdolOnHiatus(idol, targetIso) : true;
  });
}

function activeManagedMembersForDate(save: GameSavePayload, targetIso: string): Record<string, unknown>[] {
  const rosterUids = new Set(availableManagedMemberUidsForDate(save, targetIso));
  return (save.database_snapshot.idols as Record<string, unknown>[]).filter((idol) => rosterUids.has(String(idol.uid ?? "")));
}

function collectTodaySimulationEvents(save: GameSavePayload): SimulationEvent[] {
  const nowIso = currentSimulationIso(save);
  const todayIso = isoDatePart(nowIso);
  const nowMin = isoTimeToMinutes(nowIso);
  const out: SimulationEvent[] = [];
  const group = getPrimaryGroup(save);
  const gid = String(group?.uid ?? "");
  const rosterUids = availableManagedMemberUidsForDate(save, todayIso);
  const liveDaysInWeek = liveDaysInWeekForGroup(save, gid);
  const todaysLives = (save.lives?.schedules ?? [])
    .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
    .filter((live) => isoDatePart(String(live.start_date ?? "")) === todayIso)
    .filter((live) => String(live.status ?? "") !== "played");

  const trainingBySlot = new Map<string, { iso: string; label: string; byUid: Record<string, number> }>();
  for (const uid of rosterUids) {
    let intensityRaw = save.training_intensity[uid];
    if (!intensityRaw || typeof intensityRaw !== "object") {
      intensityRaw = { ...ensureGroupPolicy(save).training.default_intensity };
    }
    const intensity = safeTrainingRow(intensityRaw);
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

  const noticeDedupe = `daily-lives|${gid}|${todayIso}`;
  if (todaysLives.length > 0 && !hasNotificationWithDedupe(save, noticeDedupe)) {
    const noticeTime = todaysLiveScheduleNotificationTime(todaysLives);
    const noticeIso = combineIsoDateTime(todayIso, `${noticeTime}:00`);
    if (isoTimeToMinutes(noticeIso) > nowMin) {
      out.push({
        kind: "live_schedule_notice",
        iso: noticeIso,
        label: "Today's live schedule",
      });
    }
  }

  for (const live of todaysLives) {
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

  for (const raw of save.lives.results) {
    if (!raw || typeof raw !== "object") continue;
    const live = raw as Record<string, unknown>;
    if (isoDatePart(String(live.start_date ?? live.date ?? "")) !== todayIso) continue;
    if (live.report_generated_same_day === true) continue;
    const reportIso = combineIsoDateTime(todayIso, `${liveReportNotificationTime(live)}:00`);
    if (isoTimeToMinutes(reportIso) <= nowMin) continue;
    out.push({
      kind: "live_report_notice",
      iso: reportIso,
      label: String(live.title ?? live.live_type ?? "Live report"),
      liveUid: String(live.live_uid ?? live.uid ?? ""),
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

function addLiveReportNotification(save: GameSavePayload, live: Record<string, unknown>, targetIso: string): void {
  const uid = String(live.live_uid ?? live.uid ?? "");
  const titleSeed = String(live.title ?? live.live_type ?? "Live");
  const isFest = String(live.live_type ?? live.event_type ?? "") === "Festival";
  const titlePrefix = isFest ? "Festival report" : "Live report";
  addNotification(save, {
    title: `${titlePrefix}: ${titleSeed}`,
    body: buildLiveReportNotificationBody(live),
    sender: "Operations",
    category: "internal",
    level: "normal",
    isoDate: targetIso,
    createdTime: `${liveReportNotificationTime(live)}:00`,
    unread: true,
    dedupeKey: `live-report-start|${uid}|${targetIso}`,
    relatedEventUid: uid,
    reportData: buildLiveReportData(live),
  });
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
    "scout_retainers",
    "live_ticket_revenue",
    "live_goods_revenue",
    "post_live_tokutenkai_revenue",
    "online_benefit_revenue",
    "shooting_handshake_revenue",
    "release_sales_revenue",
    "digital_streaming_revenue",
    "media_appearance_revenue",
    "commercial_ip_revenue",
    "fanclub_revenue",
    "birthday_special_revenue",
    "cheki_gross_revenue",
    "cheki_ops_cost",
    "cheki_member_share",
    "cheki_net_profit",
    "cd_net_profit",
    "member_base_compensation",
    "member_sales_share",
    "member_monthly_income_total",
    "staff_payroll",
    "office_admin_cost",
    "promotion_cost",
    "benefit_ops_cost",
    "production_cost",
    "goods_cost",
    "live_ticket_count_estimate",
    "fanclub_members_estimate",
    "cd_units_sold",
    "online_signing_member_seconds",
    "member_hours_live",
    "member_hours_benefit",
    "member_hours_media",
    "member_hours_training",
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
    letterTier: ReturnType<typeof getLetterTierFromGroup>;
    audienceProfile?: FinanceAudienceProfile;
    monthlySalaryTotal: number;
    liveTicketRevenue: number;
    liveGoodsRevenue: number;
    tokutenkaiRevenue: number;
    liveVenueFeeTotal: number;
    memberHoursLive: number;
  },
): Finances {
  const base = buildDailyBreakdown({
    targetDateIso: p.targetIso,
    memberCount: p.memberCount,
    popularity: p.popularity,
    fans: p.fans,
    xFollowers: p.xFollowers,
    letterTier: p.letterTier,
    audienceProfile: p.audienceProfile,
    monthlySalaryTotal: p.monthlySalaryTotal,
    scoutRetainersMonthlyTotal: 0,
    liveCount: 0,
    liveTicketRevenue: 0,
    liveGoodsRevenue: 0,
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
    letterTier: p.letterTier,
    audienceProfile: p.audienceProfile,
    monthlySalaryTotal: p.monthlySalaryTotal,
    scoutRetainersMonthlyTotal: 0,
    liveCount: 1,
    liveTicketRevenue: p.liveTicketRevenue,
    liveGoodsRevenue: p.liveGoodsRevenue,
    tokutenkaiRevenue: p.tokutenkaiRevenue,
    tokutenkaiCost: 0,
    liveVenueFeeTotal: p.liveVenueFeeTotal,
    memberHoursLive: p.memberHoursLive,
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
  const rosterUids = availableManagedMemberUidsForDate(save, targetIso);
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

    const resolution = resolveGroupLiveResultWeb(g, members, songs, live, save.managed_song_status);
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
    const managedGroup = getPrimaryGroup(save);
    const goodsUids = Array.isArray(live.goods_uids)
      ? (live.goods_uids as unknown[]).map((x) => String(x))
      : String(live.goods_uid ?? "").trim()
        ? [String(live.goods_uid ?? "").trim()]
        : [];
    const goodsGross = live.goods_enabled
      ? goodsUids.reduce((sum, goodsUid) => {
          const goods = Array.isArray(save.goods_inventory)
            ? save.goods_inventory.find((item) => item.uid === goodsUid) ?? null
            : null;
          if (!goods) return sum;
          const goodsUnits = estimateLiveGoodsUnits(goods, {
            liveType: String(live.live_type ?? ""),
            capacity: Number(live.capacity ?? 0) || 0,
            groupFans: Number(managedGroup?.fans ?? 0) || 0,
            groupPopularity: Number(managedGroup?.popularity ?? 0) || 0,
            groupTier: getLetterTierFromGroup(managedGroup),
            groupName: managedGroup?.name,
            groupRomaji: managedGroup?.name_romanji,
          });
          if (goodsUnits > 0) {
            goods.stock = Math.max(0, (Number(goods.stock ?? 0) || 0) - goodsUnits);
          }
          return sum + Math.max(0, goodsUnits * Math.max(0, Number(goods.unit_price_yen ?? 0) || 0));
        }, 0)
      : Math.max(0, Number(live.goods_gross_yen ?? live.goods_expected_revenue_yen ?? 0) || 0);
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
    registerManagedSetlistPerformance(
      save.managed_song_status,
      songs,
      String(g.uid ?? ""),
      Array.isArray(live.setlist) ? (live.setlist as unknown[]).map((x) => String(x)) : [],
      targetIso,
    );
    save.lives.results.push({
      date: targetIso,
      live_uid: uid,
      ...played,
    });
    if (uid) resultUids.add(uid);

    const cap = typeof live.capacity === "number" ? live.capacity : Number(live.capacity ?? 200) || 200;
    const liveVenueFeeTotal = estimateVenueFee(cap, { isWeekendOrHoliday: isWeekendUtc(targetIso) });
    const { popularity, fans, xFollowers } = readPopFans(save);
    const liveLetterTier = getLetterTierFromGroup(managedGroup);
    finances = applyLiveFinanceSettlement(finances, {
      targetIso,
      memberCount: mc,
      popularity,
      fans,
      xFollowers,
      letterTier: liveLetterTier,
      audienceProfile: financeAudienceProfileForSave(save, managedGroup, liveLetterTier, fans),
      monthlySalaryTotal,
      liveTicketRevenue: ticketGross,
      liveGoodsRevenue: goodsGross,
      tokutenkaiRevenue,
      liveVenueFeeTotal,
      memberHoursLive: Math.round((mc * liveMinutes) / 60 * 100) / 100,
    });

    played.report_generated_same_day = false;
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
  const memberUids = availableManagedMemberUidsForDate(save, dayIso);
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
  const beforeIso = currentSimulationIso(next);
  const item = next.inbox.notifications.find((n) => n.uid === notificationUid);
  if (!item) return next;

  const title = String(item.title ?? "");
  const dk = String(item.dedupe_key ?? "");
  if (title === "Today's live schedule" || dk.startsWith("daily-lives|")) {
    const cur = next.current_date ?? next.game_start_date ?? next.scenario_context.startup_date ?? "2020-01-01";
    const curIso = String(cur).split("T")[0];
    const todaysLives = scheduledManagedLivesForDate(next, curIso);
    if (todaysLives.length > 0) {
      const liveEndTime = todaysLives
        .map((live) => liveReportEndTime(live))
        .sort()
        .at(-1) ?? "21:00";
      next.current_date = combineIsoDateTime(curIso, `${liveEndTime}:00`);
    }
    archiveAndResolveManagedLivesForDate(next, curIso);
    const reportTime = publishPendingLiveReportsForDate(next, curIso);
    if (reportTime) {
      next.current_date = combineIsoDateTime(curIso, `${reportTime}:00`);
    }
  }
  if (dk.startsWith("auto-book-lives|")) {
    const monthStart = dk.split("|")[2] ?? "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(monthStart)) {
      autoBookMonthFromMonthEndPrompt(next, monthStart);
    }
  }

  item.read = true;
  item.requires_confirmation = false;
  keepCurrentDateMonotonic(next, beforeIso, next.current_date);

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
  decayManagedSongsOvernight(next.managed_song_status, next.training_song_uids, targetDateIso);
  maybeAddSongUnlockNotification(next, targetDateIso);
}

function processLiveReportEvent(next: GameSavePayload, event: SimulationEvent): void {
  const dayIso = isoDatePart(event.iso);
  publishPendingLiveReportsForDate(next, dayIso);
}

function publishPendingLiveReportsForDate(next: GameSavePayload, dayIso: string): string | null {
  let latestReportTime: string | null = null;
  for (const raw of next.lives.results) {
    if (!raw || typeof raw !== "object") continue;
    const live = raw as Record<string, unknown>;
    if (isoDatePart(String(live.start_date ?? live.date ?? "")) !== dayIso) continue;
    if (live.report_generated_same_day === true) continue;
    addLiveReportNotification(next, live, dayIso);
    live.report_generated_same_day = true;
    const reportTime = liveReportNotificationTime(live);
    if (!latestReportTime || reportTime > latestReportTime) latestReportTime = reportTime;
  }
  return latestReportTime;
}

function processTrainingEndEvent(next: GameSavePayload, event: SimulationEvent): void {
  const idols = next.database_snapshot.idols as Record<string, unknown>[];
  const affected: string[] = [];
  const conditionLines: string[] = [];
  let maxBlocks = 0;
  for (const uid of event.idolUids ?? []) {
    const idol = idols.find((r) => String(r.uid ?? "") === uid);
    if (!idol) continue;
    const blocks = Math.max(1, event.trainingBlocksByUid?.[uid] ?? 1);
    if (blocks > maxBlocks) maxBlocks = blocks;
    const beforeCondition = typeof idol.condition === "number" ? idol.condition : Number(idol.condition ?? 0) || 0;
    applyDailyStatusUpdateJson(idol, {
      trainingLoad: Math.min(20, blocks * 10),
      trainingHours: blocks * 4,
      liveCount: 0,
      liveMinutes: 0,
      rehearsalMinutes: 0,
      birthday: false,
      includeSleepRecovery: false,
    });
    const afterCondition = typeof idol.condition === "number" ? idol.condition : Number(idol.condition ?? 0) || 0;
    const delta = Math.round(afterCondition - beforeCondition);
    const name = String(idol.name ?? uid);
    affected.push(name);
    conditionLines.push(`- ${name}: ${Math.round(beforeCondition)} -> ${Math.round(afterCondition)} (${delta >= 0 ? "+" : ""}${delta})`);
  }
  const songUpdates = applyTrainingToManagedSongs(
    next.managed_song_status,
    next.training_song_uids,
    isoDatePart(event.iso),
    maxBlocks || 1,
  );
  addNotification(next, {
    title: `${event.label} ended`,
    body: `${isoDatePart(event.iso)} ${isoTimePart(event.iso)} ? ${affected.length} idol(s): ${affected.join(", ")}.

Condition changes:
${conditionLines.join("\n")}${songUpdates.length ? `\n\nSong preparation:\n${songUpdates
  .map((row) => `- ${row.title}: familiarity ${row.familiarity_after} (${row.familiarity_delta >= 0 ? "+" : ""}${row.familiarity_delta})`)
  .join("\n")}` : ""}`,
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
  const beforeIso = currentSimulationIso(next);
  ensureAutoBookedLivesThroughEndOfNextMonth(next);
  const mc = memberCountFromSave(next);
  const group = getPrimaryGroup(next);
  const letterTier = getLetterTierFromGroup(group);
  const monthlySalaryTotal = mc * monthlyBaseSalaryYenForGroupLetterTier(letterTier);

  const currentIso = currentSimulationIso(next);
  const currentDayIso = isoDatePart(currentIso);

  let finances = normalizeFinances(getActiveFinances(next) as Parameters<typeof normalizeFinances>[0]);
  const scoutRetainersMonthlyTotal = totalMonthlyScoutRetainersYen(next.scout.subscriptions, buildDefaultScoutCompanies());

  const targetIso = addCalendarDays(currentDayIso, 1);
  /** Live stress applies only after Live Start (desktop); day-of advance keeps training load lower. */
  const liveCount = 0;
  const liveMinutes = 0;
  const tokutenkaiRevenue = 0;
  const liveVenueFeeTotal = 0;
  let mediaSummary = resolveManagedMediaDay(null, targetIso, null, [], letterTier, 0);

  if (group && typeof group === "object") {
    const g = group as Record<string, unknown>;
    const rosterUids = availableManagedMemberUidsForDate(next, targetIso);
    const activeMembers = activeManagedMembersForDate(next, targetIso);
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
        const policy = ensureGroupPolicy(next);
        next.training_intensity[uid] = { ...policy.training.default_intensity };
        if (next.training_focus_skill[uid] == null || next.training_focus_skill[uid] === undefined) {
          next.training_focus_skill[uid] = policy.training.default_focus;
        }
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
    const mediaBundle = findManagedOfficialScheduleBundleInRuntime(
      next.scenario_runtime.official_schedules,
      g,
      next.managing_group,
    );
    mediaSummary = resolveManagedMediaDay(mediaBundle, targetIso, g, activeMembers, letterTier, 0);
  }

  const { popularity, fans, xFollowers } = readPopFans(next);
  const audienceProfile = financeAudienceProfileForSave(next, group as Record<string, unknown> | null, letterTier, fans);

  const breakdown: DailyBreakdown = buildDailyBreakdown({
    targetDateIso: targetIso,
    memberCount: mc,
    popularity,
    fans,
    xFollowers,
    letterTier,
    audienceProfile,
    monthlySalaryTotal,
    scoutRetainersMonthlyTotal,
    liveCount,
    tokutenkaiRevenue,
    tokutenkaiCost: 0,
    liveVenueFeeTotal,
  });

  const passiveMedia = Math.max(0, Number(breakdown.media_appearance_revenue ?? breakdown.media ?? 0) || 0);
  breakdown.media_passive_removed = passiveMedia;
  breakdown.media_event_revenue = mediaSummary.revenue;
  breakdown.media_operating_cost = mediaSummary.expense;
  breakdown.media_event_travel = mediaSummary.travel_cost;
  breakdown.media_event_making = mediaSummary.making_cost;
  breakdown.media_event_advertising = mediaSummary.event_advertising_cost;
  breakdown.media_event_staffing = mediaSummary.event_staffing_cost;
  breakdown.media_fixed_admin = mediaSummary.fixed_admin_cost;
  breakdown.media_fixed_advertising = mediaSummary.fixed_advertising_cost;
  breakdown.media_event_count = mediaSummary.event_count;
  breakdown.media_event_popularity_gain = mediaSummary.popularity_gain;
  breakdown.media_event_fan_gain = mediaSummary.fan_gain;
  breakdown.cd_release_count = mediaSummary.cd_release_count;
  breakdown.cd_release_units = mediaSummary.cd_release_units;
  breakdown.cd_release_revenue = mediaSummary.cd_release_revenue;
  breakdown.cd_release_mv_cost = mediaSummary.cd_release_mv_cost;
  breakdown.release_sales_revenue = mediaSummary.cd_release_revenue;
  breakdown.cd_net_profit = mediaSummary.cd_release_revenue;
  breakdown.cd_units_sold = mediaSummary.cd_release_units;
  breakdown.online_signing_member_seconds = cdOnlineSigningMemberSeconds(mediaSummary.cd_release_units);
  breakdown.member_hours_benefit =
    Math.round((Number(breakdown.member_hours_benefit ?? 0) + (breakdown.online_signing_member_seconds ?? 0) / 3600) * 100) / 100;
  breakdown.media_appearance_revenue = Math.max(0, mediaSummary.revenue - mediaSummary.cd_release_revenue);
  breakdown.production_cost = mediaSummary.expense;

  breakdown.media = (breakdown.commercial_ip_revenue ?? 0) + mediaSummary.revenue;
  breakdown.staff += mediaSummary.event_staffing_cost;
  breakdown.staff_payroll = breakdown.staff;
  breakdown.office += mediaSummary.fixed_admin_cost;
  breakdown.office_admin_cost = breakdown.office;
  breakdown.promotion += mediaSummary.fixed_advertising_cost + mediaSummary.event_advertising_cost;
  breakdown.promotion_cost = breakdown.promotion;
  breakdown.expense_total += mediaSummary.expense;
  breakdown.income_total += mediaSummary.revenue - passiveMedia;
  breakdown.net_total = breakdown.income_total - breakdown.expense_total;
  {
    const totalMemberHours =
      Number(breakdown.member_hours_live ?? 0) +
      Number(breakdown.member_hours_benefit ?? 0) +
      Number(breakdown.member_hours_media ?? 0) +
      Number(breakdown.member_hours_training ?? 0);
    breakdown.revenue_per_member_hour =
      totalMemberHours > 0 ? Math.round(breakdown.income_total / totalMemberHours) : undefined;
  }

  if (group && typeof group === "object") {
    const g = group as Record<string, unknown>;
    g.fans = Math.max(0, Math.round(num(g.fans, 0) + mediaSummary.fan_gain));
    g.popularity = Math.round(clamp(num(g.popularity, 0) + mediaSummary.popularity_gain, 0, 100) * 1000) / 1000;

    const idols = next.database_snapshot.idols as Record<string, unknown>[];
    for (const idol of idols) {
      const uid = String(idol.uid ?? "");
      const conditionDelta = mediaSummary.member_condition_changes[uid] ?? 0;
      const fanDelta = mediaSummary.member_fan_changes[uid] ?? 0;
      const moraleDelta = mediaSummary.member_morale_changes[uid] ?? 0;
      if (!conditionDelta && !fanDelta && !moraleDelta) continue;
      ensureIdolSimulationDefaults(idol);
      idol.condition = Math.round(clamp(num(idol.condition, 90) + conditionDelta, 0, 100));
      idol.fan_count = Math.max(0, Math.round(num(idol.fan_count, 0) + fanDelta));
      idol.morale = Math.round(clamp(num(idol.morale, 70) + moraleDelta, 0, 100));
    }
  }

  finances = applyDailyClose(finances, breakdown);

  next.finances = finances;
  next.turn_number = (typeof next.turn_number === "number" ? next.turn_number : 0) + 1;
  next.current_date = combineIsoDateTime(targetIso, SIMULATION_DAY_START_TIME);
  processCareerDecisionsForDate(next, targetIso);
  accrueMonthlyTenureReputation(
    getPrimaryGroup(next) as Record<string, unknown> | null,
    next.database_snapshot.idols as Record<string, unknown>[],
    targetIso,
  );
  applyScenarioEventsForDate(next, targetIso);
  ensureAutoBookedLivesThroughEndOfNextMonth(next);
  refreshStartupUpcomingLivesNotification(next, targetIso);
  maybeSeedMonthEndAutoBookPrompt(next);
  if (!next.scout.selected_company_uid) {
    next.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
  }

  if (next.inbox.notifications.length > 500) {
    next.inbox.notifications = next.inbox.notifications.slice(-500);
  }

  keepCurrentDateMonotonic(next, beforeIso, next.current_date);

  return next;
}

/** Advance simulation to the next event today, otherwise to the next day 08:00. */
export function advanceOneDay(save: GameSavePayload): GameSavePayload {
  const next = deepSaveCopy(save);
  const beforeIso = currentSimulationIso(next);
  ensureAutoBookedLivesThroughEndOfNextMonth(next);
  const nowIso = currentSimulationIso(next);
  const todayIso = isoDatePart(nowIso);
  const events = collectTodaySimulationEvents(next);
  if (events.length > 0) {
    const event = events[0]!;
    next.current_date = event.iso;
    if (event.kind === "training_end") {
      processTrainingEndEvent(next, event);
    } else if (event.kind === "live_schedule_notice") {
      seedTodaysLiveBlockingInbox(next, event.iso);
    } else if (event.kind === "live_start") {
      seedTodaysLiveBlockingInbox(next, event.iso);
    } else if (event.kind === "live_report_notice") {
      processLiveReportEvent(next, event);
    }
    if (!next.scout.selected_company_uid) {
      next.scout.selected_company_uid = buildDefaultScoutCompanies()[0]?.uid ?? null;
    }
    keepCurrentDateMonotonic(next, beforeIso, next.current_date);
    return next;
  }

  const dayAdvanced = advanceOneDayLegacy(next);
  const targetIso = isoDatePart(dayAdvanced.current_date ?? currentSimulationIso(dayAdvanced));
  dayAdvanced.current_date = combineIsoDateTime(targetIso, SIMULATION_DAY_START_TIME);
  applyMorningRecovery(dayAdvanced, targetIso);
  keepCurrentDateMonotonic(dayAdvanced, beforeIso, dayAdvanced.current_date);
  return dayAdvanced;
}

export { getBlockingNotification };
