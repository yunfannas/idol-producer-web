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
  defaultAutopilotTrainingIntensity,
  ensureIdolSimulationDefaults,
  normalizeTrainingWeekLog,
  recordTrainingDay,
  safeTrainingRow,
  trainingLoadFromRow,
} from "./idolStatusSystem";
import {
  applyLiveResultToSnapshot,
  estimateTokutenkaiRevenueYen,
  resolveGroupLiveResultWeb,
} from "./livePerformanceWeb";
import { isSongHiddenFromDisplay } from "../data/songDisplayPolicy";
import { buildAutopilotRoutineLive, formatLiveSlotLine } from "./liveScheduleWeb";

export { createGameSaveFromLoadedScenario };

/** Autopilot: routine live when `turn_number % 7` matches at day advance (same as advanceOneDay). */
export const AUTOPILOT_LIVE_WEEKDAY_INDEX = 3;

const LIVE_DAY_INDEX = AUTOPILOT_LIVE_WEEKDAY_INDEX;

function deepSaveCopy(save: GameSavePayload): GameSavePayload {
  return JSON.parse(JSON.stringify(save)) as GameSavePayload;
}

/** New desktop-shaped save from a loaded scenario (full DB trio). */
export function createNewGameSaveFromScenario(
  loaded: LoadedScenario,
  opts: { playerName: string; managedGroupLabel: string; managedGroupUid?: string },
): GameSavePayload {
  return createGameSaveFromLoadedScenario(loaded, {
    playerName: opts.playerName,
    managedGroupLabel: opts.managedGroupLabel,
    managedGroupUid: opts.managedGroupUid ?? null,
  });
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

function pickRecentSetlistTitles(
  songs: Record<string, unknown>[],
  groupUid: string,
  liveIso: string,
  maxN: number,
): string[] {
  const liveT = Date.parse(liveIso + "T12:00:00Z");
  if (Number.isNaN(liveT)) return [];
  const hits: { title: string; t: number }[] = [];
  for (const song of songs) {
    if (!song || typeof song !== "object") continue;
    const s = song as Record<string, unknown>;
    if (String(s.group_uid ?? "") !== groupUid) continue;
    if (s.hidden === true) continue;
    if (isSongHiddenFromDisplay(s)) continue;
    const rd = String(s.release_date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rd)) continue;
    const delta = Math.round((liveT - Date.parse(rd + "T12:00:00Z")) / 86400000);
    if (delta >= 0 && delta <= 60) {
      const title = String(s.title ?? s.title_romanji ?? "").trim();
      if (title) hits.push({ title, t: Date.parse(rd + "T12:00:00Z") });
    }
  }
  hits.sort((a, b) => b.t - a.t);
  const out: string[] = [];
  const seen = new Set<string>();
  for (const h of hits) {
    if (seen.has(h.title)) continue;
    seen.add(h.title);
    out.push(h.title);
    if (out.length >= maxN) break;
  }
  return out;
}

function buildRoutineLive(
  targetIso: string,
  group: Record<string, unknown>,
  songs: Record<string, unknown>[],
): Record<string, unknown> {
  const gUid = String(group.uid ?? "");
  const setlist = pickRecentSetlistTitles(songs, gUid, targetIso, 5);
  return buildAutopilotRoutineLive({ targetIso, group, setlist });
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
    for (const row of deltas.slice(0, 5)) {
      if (!row || typeof row !== "object") continue;
      const r = row as Record<string, unknown>;
      const nm = String(r.name ?? "Member");
      const rate = r.performance_rating != null ? String(r.performance_rating) : "—";
      const fg = Number(r.fan_gain ?? 0) || 0;
      const mg = Number(r.morale_gain ?? r.morale_delta ?? 0) || 0;
      memberLines.push(`${nm}: rate ${rate}, fans ${fg >= 0 ? "+" : ""}${fg}, morale ${mg >= 0 ? "+" : ""}${mg}`);
    }
  }
  const titleSeed = String(live.title ?? live.live_type ?? "Live");
  const fanCh = Math.trunc(Number(live.group_fan_gain ?? live.fan_gain ?? 0) || 0);
  const venue = String(live.venue ?? "").trim();
  const loc = String(live.location ?? "").trim();
  const when = formatLiveSlotLine(live) || String(live.start_date ?? "").split("T")[0];
  let body = `${titleSeed} finished with performance ${live.performance_score ?? "—"} and satisfaction ${live.audience_satisfaction ?? "—"}. `;
  body += `Attendance ${live.attendance ?? 0}, fan change ${fanCh >= 0 ? "+" : ""}${fanCh}.`;
  if (venue) body += ` Venue: ${venue}${loc ? ` (${loc})` : ""}.`;
  if (when) body += ` Slot: ${when}.`;
  const setlist = Array.isArray(live.setlist) ? (live.setlist as unknown[]).map((x) => String(x)).filter(Boolean) : [];
  if (setlist.length) body += ` Setlist: ${setlist.join(" · ")}.`;
  if (memberLines.length) body += " " + memberLines.join(" | ");
  return body;
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
    const played: Record<string, unknown> = {
      ...live,
      status: "played",
      ...resolution,
      ...applied,
      performance_score: resolution.performance_score,
      audience_satisfaction: resolution.audience_satisfaction,
      attendance: resolution.attendance,
      tokutenkai_actual_tickets: resolution.tokutenkai_actual_tickets,
    };
    save.lives.results.push({
      date: targetIso,
      live_uid: uid,
      ...played,
    });
    if (uid) resultUids.add(uid);

    const tokutenkaiRevenue = estimateTokutenkaiRevenueYen(resolution.tokutenkai_actual_tickets);
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
      unread: true,
      dedupeKey: `live-report-start|${uid}|${targetIso}`,
      relatedEventUid: uid,
    });
    played.report_generated_same_day = true;
  }
  save.lives.schedules = remaining;
  save.finances = finances;
}

function seedTodaysLiveBlockingInbox(save: GameSavePayload, targetIso: string, live: Record<string, unknown>): void {
  const g = getPrimaryGroup(save) as Record<string, unknown> | null;
  const gid = g && String(g.uid ?? "");
  if (!gid) return;
  const memberUids = Array.isArray(g.member_uids)
    ? (g.member_uids as unknown[]).map((x) => String(x))
    : save.shortlist.map((x) => String(x));
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const uidSet = new Set(memberUids);
  const members = idols.filter((row) => row && uidSet.has(String(row.uid ?? "")));
  const body = formatTodaysLiveScheduleBody([live], members);
  addNotification(save, {
    title: "Today's live schedule",
    body,
    sender: "Assistant",
    category: "confirmation",
    level: "critical",
    isoDate: targetIso,
    unread: true,
    dedupeKey: `daily-lives|${gid}|${targetIso}`,
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
    archiveAndResolveManagedLivesForDate(next, curIso);
  }

  item.read = true;
  item.requires_confirmation = false;

  if (next.inbox.notifications.length > 500) {
    next.inbox.notifications = next.inbox.notifications.slice(-500);
  }
  return next;
}

/** Simulate one calendar day (desktop NEXT DAY analogue). */
export function advanceOneDay(save: GameSavePayload): GameSavePayload {
  const next = deepSaveCopy(save);
  const mc = memberCountFromSave(next);
  const group = getPrimaryGroup(next);
  const letterTier = getLetterTierFromGroup(group);
  const monthlySalaryTotal = mc * monthlyBaseSalaryYenForGroupLetterTier(letterTier);

  const gameStart = next.game_start_date ?? next.scenario_context.startup_date ?? "2020-01-01";
  const dayOffset = typeof next.turn_number === "number" ? next.turn_number : 0;

  let finances = normalizeFinances(getActiveFinances(next) as Parameters<typeof normalizeFinances>[0]);

  const targetIso = addCalendarDays(typeof gameStart === "string" ? gameStart : "2020-01-01", dayOffset);
  const isLiveDay = dayOffset % 7 === LIVE_DAY_INDEX;
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

    const idols = next.database_snapshot.idols as Record<string, unknown>[];
    const uidSet = new Set(rosterUids);
    const members = idols.filter((row) => row && uidSet.has(String(row.uid ?? "")));

    const weekLog = normalizeTrainingWeekLog(next.training_week_log);

    for (const uid of rosterUids) {
      const idol = idols.find((r) => String(r.uid ?? "") === uid);
      if (!idol) continue;
      ensureIdolSimulationDefaults(idol);
      const ti = next.training_intensity[uid];
      if (!ti || typeof ti !== "object") {
        next.training_intensity[uid] = { ...defaultAutopilotTrainingIntensity() };
      }
      const intensity = safeTrainingRow(next.training_intensity[uid]);
      const focus = String(next.training_focus_skill[uid] ?? "");
      recordTrainingDay(weekLog, uid, targetIso, intensity, liveCount, liveMinutes, focus);
      applyDailyStatusUpdateJson(idol, {
        trainingLoad: trainingLoadFromRow(intensity),
        liveCount,
        liveMinutes,
        birthday: false,
      });
    }

    next.training_week_log = weekLog as unknown as GameSavePayload["training_week_log"];

    if (isLiveDay && members.length > 0) {
      const songs = next.database_snapshot.songs as Record<string, unknown>[];
      const live = buildRoutineLive(targetIso, g, songs);
      const uid = String(live.uid ?? "");
      const dup = (next.lives.schedules as unknown[]).some((row) => {
        if (!row || typeof row !== "object") return false;
        return String((row as Record<string, unknown>).uid ?? "") === uid;
      });
      if (!dup) {
        next.lives.schedules.push({ ...live });
        seedTodaysLiveBlockingInbox(next, targetIso, live);
      }
    }
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

  addNotification(next, {
    title: "Day closed",
    body: `${targetIso} · net ¥${breakdown.net_total.toLocaleString("ja-JP")} · cash ¥${finances.cash_yen.toLocaleString("ja-JP")}`,
    sender: "Finance",
    category: "general",
    isoDate: targetIso,
    unread: true,
  });

  if (next.inbox.notifications.length > 500) {
    next.inbox.notifications = next.inbox.notifications.slice(-500);
  }

  return next;
}

export { getBlockingNotification };
