import type { GameSavePayload } from "../save/gameSaveSchema";
import {
  createGameSaveFromLoadedScenario,
  getActiveFinances,
  getLetterTierFromGroup,
  getPrimaryGroup,
} from "../save/gameSaveSchema";
import { addNotification } from "../save/inbox";
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
  const uid = String(group.uid ?? "group");
  const gFans = typeof group.fans === "number" ? group.fans : Number(group.fans ?? 0) || 0;
  const cap = 200;
  const expected = Math.min(cap - 20, Math.max(30, Math.round(50 + gFans * 0.04)));
  const gUid = String(group.uid ?? "");
  return {
    uid: `autopilot-live-${uid}-${targetIso}`,
    live_type: "Routine",
    event_type: "Routine",
    start_date: targetIso,
    capacity: cap,
    tokutenkai_expected_tickets: expected,
    setlist: pickRecentSetlistTitles(songs, gUid, targetIso, 5),
  };
}

/** Simulate one calendar day (desktop NEXT DAY analogue). */
export function advanceOneDay(save: GameSavePayload): GameSavePayload {
  const next = deepSaveCopy(save);
  const mc = memberCountFromSave(next);
  const group = getPrimaryGroup(next);
  const letterTier = getLetterTierFromGroup(group);
  const monthlySalaryTotal = mc * monthlyBaseSalaryYenForGroupLetterTier(letterTier);

  const gameStart = next.game_start_date ?? next.scenario_context.startup_date ?? "2020-01-01";
  const dayOffset =
    typeof next.turn_number === "number" ? next.turn_number : 0;

  let finances = normalizeFinances(getActiveFinances(next) as Parameters<typeof normalizeFinances>[0]);

  const targetIso = addCalendarDays(typeof gameStart === "string" ? gameStart : "2020-01-01", dayOffset);
  const liveCount = dayOffset % 7 === LIVE_DAY_INDEX ? 1 : 0;
  const liveMinutes = liveCount > 0 ? 120 : 0;
  const liveVenueFeeTotal =
    liveCount > 0 ? estimateVenueFee(200, { isWeekendOrHoliday: isWeekendUtc(targetIso) }) : 0;

  let tokutenkaiRevenue = 0;

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

    if (liveCount > 0 && members.length > 0) {
      const songs = next.database_snapshot.songs as Record<string, unknown>[];
      const live = buildRoutineLive(targetIso, g, songs);
      const result = resolveGroupLiveResultWeb(g, members, songs, live);
      next.lives.schedules.push({ ...live });
      next.lives.results.push({
        date: targetIso,
        live_uid: live.uid,
        ...result,
      });
      applyLiveResultToSnapshot(g, members, result);
      tokutenkaiRevenue = estimateTokutenkaiRevenueYen(result.tokutenkai_actual_tickets);

      addNotification(next, {
        title: "Live resolved",
        body: `${targetIso} · ${String(live.live_type)} · perf ${result.performance_score} · fans +${result.fan_gain} · tokutenkai ${result.tokutenkai_actual_tickets} tickets`,
        sender: "Live desk",
        category: "general",
        isoDate: targetIso,
        unread: true,
      });
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
