"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const idolAttributes_1 = require("../src/engine/idolAttributes");
const gameEngine_1 = require("../src/engine/gameEngine");
function readJson(filePath) {
    return JSON.parse(node_fs_1.default.readFileSync(filePath, "utf8"));
}
function addMonthsUtc(isoDate, months) {
    const [year, month, day] = isoDate.split("-").map((part) => Number(part));
    const dt = new Date(Date.UTC(year, month - 1 + months, day));
    return dt.toISOString().slice(0, 10);
}
function isoDatePart(value) {
    return String(value ?? "").split("T")[0] || "2020-01-01";
}
function num(value, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
        return Number(value);
    return fallback;
}
function loadScenario6(root) {
    const presetPath = node_path_1.default.join(root, "public/data/scenarios/presets/scenario_6.json");
    const scenarioDir = node_path_1.default.join(root, "public/data/scenarios/scenario_6");
    const officialManifestPath = node_path_1.default.join(root, "public/data/official_schedules/manifest.json");
    const officialDir = node_path_1.default.join(root, "public/data/official_schedules");
    const preset = readJson(presetPath);
    const idols = readJson(node_path_1.default.join(scenarioDir, "idols.json"));
    const groups = readJson(node_path_1.default.join(scenarioDir, "groups.json"));
    const songsAll = readJson(node_path_1.default.join(root, "public/data/songs.json"));
    const sharedReleases = readJson(node_path_1.default.join(root, "public/data/shared_releases.json"));
    const lives = readJson(node_path_1.default.join(root, "public/data/lives.json"));
    const festivals = readJson(node_path_1.default.join(root, "public/data/festivals.json"));
    const groupTiers = readJson(node_path_1.default.join(scenarioDir, "group_tiers.json"));
    const startupAllowlist = readJson(node_path_1.default.join(scenarioDir, "startup_allowlist.json"));
    const officialManifest = readJson(officialManifestPath);
    const groupUidSet = new Set(groups.map((row) => String(row.uid ?? "")).filter(Boolean));
    const songs = songsAll.filter((row) => groupUidSet.has(String(row.group_uid ?? "")));
    const shared_releases = sharedReleases.filter((row) => Array.isArray(row.group_uids)
        ? row.group_uids.some((uid) => groupUidSet.has(String(uid ?? "")))
        : false);
    const scenarioGroupNames = new Set(groups
        .flatMap((row) => [String(row.name ?? "").trim(), String(row.name_romanji ?? "").trim(), String(row.nickname ?? "").trim()])
        .filter(Boolean)
        .map((name) => name.toLocaleLowerCase()));
    const official_schedules = officialManifest.groups
        .filter((entry) => {
        const names = [entry.group_name, entry.group_key, ...(entry.aliases ?? [])]
            .map((value) => String(value ?? "").trim().toLocaleLowerCase())
            .filter(Boolean);
        return names.some((name) => scenarioGroupNames.has(name));
    })
        .map((entry) => {
        const bundle = readJson(node_path_1.default.join(officialDir, entry.file));
        return {
            ...bundle,
            group_key: String(bundle.group_key ?? entry.group_key ?? "").trim(),
            group_name: String(bundle.group_name ?? entry.group_name ?? "").trim(),
            aliases: entry.aliases ?? [],
            file: entry.file,
            events: Array.isArray(bundle.events) ? bundle.events : [],
        };
    });
    (0, idolAttributes_1.applyAttributesToAllIdols)(idols, groups, preset.opening_date);
    return {
        preset,
        idols,
        groups,
        songs,
        shared_releases,
        lives,
        festivals,
        group_tiers: groupTiers,
        startup_allowlist: startupAllowlist,
        official_schedules,
    };
}
function runSimulationForGroup(loaded, managedGroupLabel) {
    const save = (0, gameEngine_1.createNewGameSaveFromScenario)(loaded, {
        playerName: "Codex Sim",
        managedGroupLabel,
    });
    const startDate = isoDatePart(save.current_date ?? save.game_start_date ?? loaded.preset.opening_date);
    const targetDate = addMonthsUtc(startDate, 6);
    const startGroup = save.database_snapshot.groups.find((row) => String(row.uid ?? "") === String(save.managing_group_uid ?? ""));
    const startFans = num(startGroup?.fans, 0);
    const startPopularity = num(startGroup?.popularity, 0);
    const startCash = num(save.finances?.cash_yen, 0);
    let guard = 0;
    while (isoDatePart(save.current_date) < targetDate && guard < 5000) {
        guard += 1;
        const blocker = save.inbox.notifications.find((row) => row.requires_confirmation && isoDatePart(row.iso_date) <= isoDatePart(save.current_date));
        if (blocker) {
            const next = (0, gameEngine_1.acknowledgeInboxNotification)(save, blocker.uid);
            Object.assign(save, next);
            continue;
        }
        const next = (0, gameEngine_1.advanceOneDay)(save);
        Object.assign(save, next);
    }
    if (guard >= 5000) {
        throw new Error(`Simulation guard exceeded for ${managedGroupLabel}`);
    }
    const endGroup = save.database_snapshot.groups.find((row) => String(row.uid ?? "") === String(save.managing_group_uid ?? ""));
    const endFans = num(endGroup?.fans, 0);
    const endPopularity = num(endGroup?.popularity, 0);
    const endCash = num(save.finances?.cash_yen, 0);
    const playedLives = save.lives.results.filter((row) => String(row.group_uid ?? "") === String(save.managing_group_uid ?? ""));
    const playedWithinWindow = playedLives.filter((row) => {
        const date = isoDatePart(String(row.date ?? row.start_date ?? ""));
        return date >= startDate && date <= targetDate;
    });
    const totals = playedWithinWindow.reduce((acc, row) => {
        acc.performance += num(row.performance_score, 0);
        acc.satisfaction += num(row.audience_satisfaction, 0);
        acc.attendance += num(row.attendance, 0);
        acc.capacity += num(row.capacity, 0);
        acc.fanGain += num(row.group_fan_gain, 0);
        acc.gross += num(row.gross_yen, 0);
        return acc;
    }, { performance: 0, satisfaction: 0, attendance: 0, capacity: 0, fanGain: 0, gross: 0 });
    const memberUids = Array.isArray(endGroup?.member_uids) ? endGroup.member_uids.map((uid) => String(uid)) : [];
    const members = save.database_snapshot.idols
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
function main() {
    const root = process.cwd();
    const loaded = loadScenario6(root);
    const targets = ["高嶺のなでしこ", "iLiFE!"];
    const report = targets.map((group) => runSimulationForGroup(loaded, group));
    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}
main();
