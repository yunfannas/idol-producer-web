import fs from "node:fs";
import path from "node:path";

import { applyAttributesToAllIdols } from "../src/engine/idolAttributes";
import {
  acknowledgeInboxNotification,
  advanceOneDay,
  createNewGameSaveFromScenario,
} from "../src/engine/gameEngine";
import type { LoadedScenario, OfficialScheduleBundle, ScenarioPreset } from "../src/data/scenarioTypes";

type JsonRow = Record<string, unknown>;

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function addMonthsUtc(isoDate: string, months: number): string {
  const [year, month, day] = isoDate.split("-").map((part) => Number(part));
  const dt = new Date(Date.UTC(year, month - 1 + months, day));
  return dt.toISOString().slice(0, 10);
}

function isoDatePart(value: string | null | undefined): string {
  return String(value ?? "").split("T")[0] || "2020-01-01";
}

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function normalizeKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "");
}

function loadScenario6(root: string): LoadedScenario {
  const presetPath = path.join(root, "public/data/scenarios/presets/scenario6.json");
  const scenarioDir = path.join(root, "public/data/scenarios/scenario_6");
  const officialManifestPath = path.join(root, "public/data/official_schedules/manifest.json");
  const officialDir = path.join(root, "public/data/official_schedules");

  const preset = readJson<ScenarioPreset>(presetPath);
  const idols = readJson<JsonRow[]>(path.join(scenarioDir, "idols.json"));
  const groups = readJson<JsonRow[]>(path.join(scenarioDir, "groups.json"));
  const songsAll = readJson<JsonRow[]>(path.join(root, "public/data/songs.json"));
  const sharedReleases = readJson<JsonRow[]>(path.join(root, "public/data/shared_releases.json"));
  const lives = readJson<JsonRow[]>(path.join(root, "public/data/lives.json"));
  const festivals = readJson<JsonRow[]>(path.join(root, "public/data/festivals.json"));
  const groupTiers = readJson<JsonRow[]>(path.join(scenarioDir, "group_tiers.json"));
  const startupAllowlist = readJson<{ recommended_count: number; names_in_order: string[] }>(
    path.join(scenarioDir, "startup_allowlist.json"),
  );
  const officialManifest = readJson<{ groups: Array<{ group_key: string; group_name: string; file: string; aliases?: string[] }> }>(
    officialManifestPath,
  );

  const groupUidSet = new Set(groups.map((row) => String(row.uid ?? "")).filter(Boolean));
  const songs = songsAll.filter((row) => groupUidSet.has(String(row.group_uid ?? "")));
  const shared_releases = sharedReleases.filter((row) =>
    Array.isArray(row.group_uids)
      ? (row.group_uids as unknown[]).some((uid) => groupUidSet.has(String(uid ?? "")))
      : false,
  );

  const scenarioGroupNames = new Set(
    groups
      .flatMap((row) => [String(row.name ?? "").trim(), String(row.name_romanji ?? "").trim(), String(row.nickname ?? "").trim()])
      .filter(Boolean)
      .map((name) => name.toLocaleLowerCase()),
  );

  const official_schedules: OfficialScheduleBundle[] = officialManifest.groups
    .filter((entry) => {
      const names = [entry.group_name, entry.group_key, ...(entry.aliases ?? [])]
        .map((value) => String(value ?? "").trim().toLocaleLowerCase())
        .filter(Boolean);
      return names.some((name) => scenarioGroupNames.has(name));
    })
    .map((entry) => {
      const bundle = readJson<OfficialScheduleBundle>(path.join(officialDir, entry.file));
      return {
        ...bundle,
        group_key: String(bundle.group_key ?? entry.group_key ?? "").trim(),
        group_name: String(bundle.group_name ?? entry.group_name ?? "").trim(),
        aliases: entry.aliases ?? [],
        file: entry.file,
        events: Array.isArray(bundle.events) ? bundle.events : [],
      };
    });

  return {
    preset,
    idols,
    groups,
    songs,
    shared_releases,
    lives,
    festivals,
    group_tiers: groupTiers as never,
    startup_allowlist: startupAllowlist,
    official_schedules,
  };
}

function buildSlimScenarioForGroup(loaded: LoadedScenario, managedGroupLabel: string): LoadedScenario {
  const labelKey = normalizeKey(managedGroupLabel);
  const group =
    loaded.groups.find((row) => normalizeKey(row.name) === labelKey) ??
    loaded.groups.find((row) => normalizeKey(row.name_romanji) === labelKey) ??
    loaded.groups.find((row) => normalizeKey(row.nickname) === labelKey);

  if (!group) throw new Error(`Could not find group ${managedGroupLabel}`);

  const groupUid = String(group.uid ?? "");
  const memberUids = new Set(
    Array.isArray(group.member_uids) ? (group.member_uids as unknown[]).map((uid) => String(uid ?? "")) : [],
  );

  const groupNames = new Set(
    [group.name, group.name_romanji, group.nickname].map((value) => normalizeKey(value)).filter(Boolean),
  );

  const slim: LoadedScenario = {
    preset: loaded.preset,
    idols: structuredClone(
      loaded.idols.filter((idol) => memberUids.has(String(idol.uid ?? ""))),
    ),
    groups: [structuredClone(group)],
    songs: structuredClone(loaded.songs.filter((song) => String(song.group_uid ?? "") === groupUid)),
    shared_releases: structuredClone(
      (loaded.shared_releases ?? []).filter((release) =>
        Array.isArray(release.group_uids)
          ? release.group_uids.some((uid) => String(uid ?? "") === groupUid)
          : false,
      ),
    ),
    lives: [],
    festivals: [],
    group_tiers: structuredClone((loaded.group_tiers ?? []).filter((row) => String(row.uid ?? "") === groupUid)),
    startup_allowlist: undefined,
    official_schedules: structuredClone(
      (loaded.official_schedules ?? []).filter((bundle) =>
        [bundle.group_name, bundle.group_key, ...(Array.isArray(bundle.aliases) ? bundle.aliases : [])]
          .map((value) => normalizeKey(value))
          .some((key) => groupNames.has(key)),
      ),
    ),
  };

  applyAttributesToAllIdols(slim.idols, slim.groups, loaded.preset.opening_date);
  return slim;
}

function runSimulationForGroup(loaded: LoadedScenario, managedGroupLabel: string) {
  const slim = buildSlimScenarioForGroup(loaded, managedGroupLabel);
  const save = createNewGameSaveFromScenario(slim, {
    playerName: "Codex Sim",
    managedGroupLabel,
  });
  const startDate = isoDatePart(save.current_date ?? save.game_start_date ?? slim.preset.opening_date);
  const targetDate = addMonthsUtc(startDate, 6);
  const startGroup = save.database_snapshot.groups.find((row) => String(row.uid ?? "") === String(save.managing_group_uid ?? ""));
  const startFans = num(startGroup?.fans, 0);
  const startPopularity = num(startGroup?.popularity, 0);
  const startCash = num(save.finances?.cash_yen, 0);

  let guard = 0;
  while (isoDatePart(save.current_date) < targetDate && guard < 5000) {
    guard += 1;
    const blocker = save.inbox.notifications.find(
      (row) => row.requires_confirmation && isoDatePart(row.iso_date) <= isoDatePart(save.current_date),
    );
    if (blocker) {
      const next = acknowledgeInboxNotification(save, blocker.uid);
      Object.assign(save, next);
      continue;
    }
    const next = advanceOneDay(save);
    Object.assign(save, next);
  }

  if (guard >= 5000) {
    throw new Error(`Simulation guard exceeded for ${managedGroupLabel}`);
  }

  const endGroup = save.database_snapshot.groups.find((row) => String(row.uid ?? "") === String(save.managing_group_uid ?? ""));
  const endFans = num(endGroup?.fans, 0);
  const endPopularity = num(endGroup?.popularity, 0);
  const endCash = num(save.finances?.cash_yen, 0);
  const playedLives = save.lives.results.filter(
    (row) => String((row as { group_uid?: unknown }).group_uid ?? "") === String(save.managing_group_uid ?? ""),
  ) as JsonRow[];
  const playedWithinWindow = playedLives.filter((row) => {
    const date = isoDatePart(String(row.date ?? row.start_date ?? ""));
    return date >= startDate && date <= targetDate;
  });

  const totals = playedWithinWindow.reduce(
    (acc, row) => {
      acc.performance += num(row.performance_score, 0);
      acc.satisfaction += num(row.audience_satisfaction, 0);
      acc.attendance += num(row.attendance, 0);
      acc.capacity += num(row.capacity, 0);
      acc.fanGain += num(row.group_fan_gain, 0);
      acc.gross += num(row.gross_yen, 0);
      return acc;
    },
    { performance: 0, satisfaction: 0, attendance: 0, capacity: 0, fanGain: 0, gross: 0 },
  );

  const ledger = Array.isArray(save.finances?.ledger)
    ? save.finances.ledger.filter((row) => row.date >= startDate && row.date <= targetDate)
    : [];
  const mediaTotals = ledger.reduce(
    (acc, row) => {
      acc.eventCount += num(row.media_event_count, 0);
      acc.revenue += num(row.media_event_revenue, 0);
      acc.cost +=
        num(row.media_operating_cost, 0) +
        num(row.media_fixed_admin, 0) +
        num(row.media_fixed_advertising, 0) +
        num(row.media_event_advertising, 0);
      acc.fanGain += num(row.media_event_fan_gain, 0);
      acc.popularityGain += num(row.media_event_popularity_gain, 0);
      acc.cdCount += num(row.cd_release_count, 0);
      acc.cdRevenue += num(row.cd_release_revenue, 0);
      return acc;
    },
    { eventCount: 0, revenue: 0, cost: 0, fanGain: 0, popularityGain: 0, cdCount: 0, cdRevenue: 0 },
  );
  const topMediaDay =
    [...ledger].sort((a, b) => num(b.media_event_revenue, 0) - num(a.media_event_revenue, 0))[0] ?? null;

  const memberUids = Array.isArray(endGroup?.member_uids) ? (endGroup.member_uids as unknown[]).map((uid) => String(uid)) : [];
  const members = (save.database_snapshot.idols as JsonRow[])
    .filter((idol) => memberUids.includes(String(idol.uid ?? "")))
    .map((idol) => ({
      name: String(idol.name ?? idol.uid ?? ""),
      fan_count: num(idol.fan_count, 0),
      condition: num(idol.condition, 0),
      morale: num(idol.morale, 0),
    }))
    .sort((a, b) => b.fan_count - a.fan_count);

  const topLive = [...playedWithinWindow]
    .sort((a, b) => num(b.group_fan_gain, 0) - num(a.group_fan_gain, 0) || num(b.performance_score, 0) - num(a.performance_score, 0))[0] ?? null;

  return {
    group: managedGroupLabel,
    start_date: startDate,
    end_date: targetDate,
    final_sim_date: isoDatePart(save.current_date),
    turns: save.turn_number,
    start: {
      fans: startFans,
      popularity: startPopularity,
      cash_yen: startCash,
    },
    end: {
      fans: endFans,
      popularity: endPopularity,
      cash_yen: endCash,
    },
    delta: {
      fans: endFans - startFans,
      popularity: Math.round((endPopularity - startPopularity) * 1000) / 1000,
      cash_yen: endCash - startCash,
    },
    live_summary: {
      live_count: playedWithinWindow.length,
      average_performance: playedWithinWindow.length ? totals.performance / playedWithinWindow.length : 0,
      average_satisfaction: playedWithinWindow.length ? totals.satisfaction / playedWithinWindow.length : 0,
      attendance_rate: totals.capacity > 0 ? totals.attendance / totals.capacity : 0,
      fan_gain_from_lives: totals.fanGain,
      gross_yen: totals.gross,
    },
    media_summary: {
      event_count: Math.round(mediaTotals.eventCount),
      revenue_yen: Math.round(mediaTotals.revenue),
      cost_yen: Math.round(mediaTotals.cost),
      net_yen: Math.round(mediaTotals.revenue - mediaTotals.cost),
      fan_gain: Math.round(mediaTotals.fanGain),
      popularity_gain: Math.round(mediaTotals.popularityGain * 1000) / 1000,
      cd_release_count: Math.round(mediaTotals.cdCount),
      cd_release_revenue_yen: Math.round(mediaTotals.cdRevenue),
    },
    top_media_day: topMediaDay
      ? {
          date: String(topMediaDay.date ?? ""),
          revenue_yen: Math.round(num(topMediaDay.media_event_revenue, 0)),
          media_event_count: Math.round(num(topMediaDay.media_event_count, 0)),
          media_event_fan_gain: Math.round(num(topMediaDay.media_event_fan_gain, 0)),
          media_event_popularity_gain: Math.round(num(topMediaDay.media_event_popularity_gain, 0) * 1000) / 1000,
          cd_release_count: Math.round(num(topMediaDay.cd_release_count, 0)),
          cd_release_revenue_yen: Math.round(num(topMediaDay.cd_release_revenue, 0)),
        }
      : null,
    top_live: topLive
      ? {
          date: isoDatePart(String(topLive.date ?? topLive.start_date ?? "")),
          title: String(topLive.title ?? topLive.live_type ?? "Live"),
          venue: String(topLive.venue ?? ""),
          performance_score: num(topLive.performance_score, 0),
          audience_satisfaction: num(topLive.audience_satisfaction, 0),
          attendance: num(topLive.attendance, 0),
          capacity: num(topLive.capacity, 0),
          group_fan_gain: num(topLive.group_fan_gain, 0),
          gross_yen: num(topLive.gross_yen, 0),
        }
      : null,
    top_members_by_fans: members.slice(0, 5),
  };
}

function main(): void {
  const root = process.cwd();
  const loaded = loadScenario6(root);
  const targets = ["高嶺のなでしこ", "iLiFE!"];
  const report = targets.map((group) => runSimulationForGroup(loaded, group));
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

main();
