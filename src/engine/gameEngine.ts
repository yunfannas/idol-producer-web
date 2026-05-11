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

export { createGameSaveFromLoadedScenario };

/** Autopilot: routine live mid-week when using a 7-day rolling index from game start */
const LIVE_DAY_INDEX = 3;

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
  return { popularity, fans, xFollowers: 0 };
}

/** Simulate one calendar day (desktop NEXT DAY analogue). */
export function advanceOneDay(save: GameSavePayload): GameSavePayload {
  const next = deepSaveCopy(save);
  const mc = memberCountFromSave(next);
  const group = getPrimaryGroup(next);
  const letterTier = getLetterTierFromGroup(group);
  const monthlySalaryTotal = mc * monthlyBaseSalaryYenForGroupLetterTier(letterTier);

  const { popularity, fans, xFollowers } = readPopFans(next);
  const gameStart = next.game_start_date ?? next.scenario_context.startup_date ?? "2020-01-01";
  const dayOffset =
    typeof next.turn_number === "number" ? next.turn_number : 0;

  let finances = normalizeFinances(getActiveFinances(next) as Parameters<typeof normalizeFinances>[0]);

  const targetIso = addCalendarDays(typeof gameStart === "string" ? gameStart : "2020-01-01", dayOffset);
  const liveCount = dayOffset % 7 === LIVE_DAY_INDEX ? 1 : 0;
  const liveVenueFeeTotal =
    liveCount > 0 ? estimateVenueFee(200, { isWeekendOrHoliday: isWeekendUtc(targetIso) }) : 0;

  const breakdown = buildDailyBreakdown({
    targetDateIso: targetIso,
    memberCount: mc,
    popularity,
    fans,
    xFollowers,
    monthlySalaryTotal,
    liveCount,
    tokutenkaiRevenue: 0,
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
