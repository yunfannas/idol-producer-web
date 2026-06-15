"use strict";
/**
 * Game save shape aligned with idol_producer/game_save.py (schema version 11).
 * Normalization mirrors GameSave.normalize_payload where practical.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.GAME_SAVE_VERSION = void 0;
exports.findScenarioGroupByLabel = findScenarioGroupByLabel;
exports.createGameSaveFromLoadedScenario = createGameSaveFromLoadedScenario;
exports.ensureManagedContracts = ensureManagedContracts;
exports.refreshStartupUpcomingLivesNotification = refreshStartupUpcomingLivesNotification;
exports.defaultScenarioContext = defaultScenarioContext;
exports.defaultPendingFinances = defaultPendingFinances;
exports.defaultGameSavePayload = defaultGameSavePayload;
exports.normalizeGameSavePayload = normalizeGameSavePayload;
exports.hydrateSnapshotSongsFromScenario = hydrateSnapshotSongsFromScenario;
exports.hydrateSnapshotGroupsFromScenario = hydrateSnapshotGroupsFromScenario;
exports.getPrimaryGroup = getPrimaryGroup;
exports.getLetterTierFromGroup = getLetterTierFromGroup;
exports.getActiveFinances = getActiveFinances;
exports.createGameSaveFromPreviewBundle = createGameSaveFromPreviewBundle;
const financeSystem_1 = require("../engine/financeSystem");
const idolAttributes_1 = require("../engine/idolAttributes");
const idolStatusSystem_1 = require("../engine/idolStatusSystem");
const songStatusSystem_1 = require("../engine/songStatusSystem");
const scenarioRuntimeWeb_1 = require("../engine/scenarioRuntimeWeb");
const scoutWeb_1 = require("../engine/scoutWeb");
const inbox_1 = require("./inbox");
exports.GAME_SAVE_VERSION = 11;
function startOfMonthIso(isoDate) {
    const [y, m] = String(isoDate).split("T")[0].split("-");
    return `${y}-${m}-01`;
}
function addMonths(monthStartIso, delta) {
    const [y, m] = monthStartIso.split("-").map((part) => Number(part));
    const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
    return dt.toISOString().slice(0, 10);
}
function endOfMonthIso(monthStartIso) {
    const [y, m] = monthStartIso.split("-").map((part) => Number(part));
    const dt = new Date(Date.UTC(y, m, 0));
    return dt.toISOString().slice(0, 10);
}
function findScenarioGroupByLabel(groups, label) {
    const n = label.trim().toLowerCase();
    for (const g of groups) {
        const rj = String(g.name_romanji ?? "").trim().toLowerCase();
        const nm = String(g.name ?? "").trim().toLowerCase();
        if (rj === n || nm === n)
            return g;
    }
    return null;
}
function deepSnapshot(idols, groups, songs, shared_releases) {
    return {
        idols: JSON.parse(JSON.stringify(idols)),
        groups: JSON.parse(JSON.stringify(groups)),
        songs: JSON.parse(JSON.stringify(songs)),
        shared_releases: JSON.parse(JSON.stringify(shared_releases)),
    };
}
function num(v, fallback = 0) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
        return Number(v);
    return fallback;
}
function estimatedGroupFanReach(group) {
    const popularity = Math.max(0, num(group.popularity, 0));
    const fans = Math.max(0, num(group.fans, 0));
    const xFollowers = Math.max(0, num(group.x_followers, 0));
    const tier = (0, financeSystem_1.resolveGroupLetterTier)(group);
    const tierFloor = {
        S: 180000,
        A: 80000,
        B: 30000,
        C: 10000,
        D: 3500,
        E: 1200,
        F: 300,
    };
    const popularityFloor = Math.round(tierFloor[tier] * (0.35 + popularity / 100));
    const followerFloor = Math.round(xFollowers * (0.12 + popularity / 500));
    return Math.max(fans, popularityFloor, followerFloor);
}
function backfillGroupMemberFanCounts(idols, group) {
    if (!group)
        return;
    const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
    if (!memberUids.length)
        return;
    const members = memberUids
        .map((uid) => idols.find((idol) => String(idol.uid ?? "") === uid))
        .filter((idol) => Boolean(idol));
    if (!members.length)
        return;
    const groupReach = estimatedGroupFanReach(group);
    const totalX = members.reduce((sum, idol) => sum + Math.max(0, num(idol.x_followers, 0)), 0);
    const popularity = Math.max(0, num(group.popularity, 0));
    const memberCount = Math.max(1, members.length);
    for (const idol of members) {
        (0, idolStatusSystem_1.ensureIdolSimulationDefaults)(idol);
        const currentFans = Math.max(0, num(idol.fan_count, 0));
        if (currentFans > 0)
            continue;
        const idolX = Math.max(0, num(idol.x_followers, 0));
        const equalShare = 1 / memberCount;
        const xShare = totalX > 0 ? idolX / totalX : equalShare;
        const blendedShare = equalShare * 0.35 + xShare * 0.65;
        const groupPortion = groupReach * blendedShare;
        const personalPortion = idolX * (0.16 + popularity / 500);
        const seededFans = Math.max(idolX > 0 || groupReach > 0 ? 1 : 0, Math.round(groupPortion + personalPortion));
        idol.fan_count = seededFans;
    }
}
function managedGoodsMembers(saveLike) {
    const group = saveLike.database_snapshot.groups.find((row) => String(row.uid ?? "") === String(saveLike.managing_group_uid ?? "")) ?? null;
    const memberUids = Array.isArray(group?.member_uids) ? group.member_uids.map((x) => String(x)) : [];
    return memberUids
        .map((uid) => {
        const idol = saveLike.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid);
        return idol ? { uid, name: String(idol.name ?? idol.name_romanji ?? uid) } : null;
    })
        .filter((row) => Boolean(row));
}
/**
 * Fresh save with full idols / groups / songs (save-owned mutable DB), scenario metadata, and default attributes.
 */
function createGameSaveFromLoadedScenario(loaded, opts) {
    const opening = loaded.preset.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(loaded.preset.opening_date)
        ? loaded.preset.opening_date
        : "2020-01-01";
    const filtered = (0, scenarioRuntimeWeb_1.buildFilteredSnapshotWithFutureEvents)(loaded.idols, loaded.groups, opening);
    const snap = deepSnapshot(filtered.idols, filtered.groups, loaded.songs, loaded.shared_releases ?? []);
    (0, idolAttributes_1.applyAttributesToAllIdols)(snap.idols, snap.groups, opening);
    const g = (opts.managedGroupUid
        ? snap.groups.find((row) => String(row.uid ?? "") === opts.managedGroupUid)
        : null) ??
        findScenarioGroupByLabel(snap.groups, opts.managedGroupLabel) ??
        findScenarioGroupByLabel(snap.groups, loaded.preset.startup_group ?? "") ??
        null;
    if (!g || !g.uid) {
        throw new Error(`Could not resolve managed group for label ${opts.managedGroupLabel}`);
    }
    const allowNames = loaded.startup_allowlist?.names_in_order;
    if (allowNames?.length) {
        const allowed = new Set(allowNames.map((n) => String(n ?? "").trim()).filter((n) => n.length > 0));
        const resolvedJa = String(g.name ?? "").trim();
        if (!allowed.has(resolvedJa)) {
            throw new Error(`Managed group "${resolvedJa}" is not in this scenario's curated new-game allowlist (startup_allowlist.json / docs/scenario6_available_groups.txt).`);
        }
    }
    const popularity = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
    const fans = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
    const staticT = loaded.group_tiers?.find((r) => String(r.uid ?? "") === String(g.uid ?? ""));
    const tier = staticT && typeof staticT.letter_tier === "string" && /^[SABCDEF]$/i.test(staticT.letter_tier.trim())
        ? (0, financeSystem_1.normalizeGroupLetterTier)(staticT.letter_tier)
        : (0, financeSystem_1.inferLetterTier)(popularity, fans, 0);
    g.letter_tier = tier;
    g.web_scenario_number = loaded.preset.scenario_number;
    const memberUids = Array.isArray(g.member_uids) ? g.member_uids.map((x) => String(x)) : [];
    const subdir = loaded.preset.data_subdir;
    const cash = (0, financeSystem_1.scenarioStartingCash)(loaded.preset.scenario_number);
    for (const uid of memberUids) {
        const row = snap.idols.find((i) => String(i.uid ?? "") === uid);
        if (row)
            (0, idolStatusSystem_1.ensureIdolSimulationDefaults)(row);
    }
    backfillGroupMemberFanCounts(snap.idols, g);
    const save = defaultGameSavePayload();
    save.account_name = opts.playerName.trim();
    save.player_name = opts.playerName.trim();
    save.managing_group = String(g.name_romanji ?? g.name ?? "");
    save.managing_group_uid = String(g.uid);
    save.scenario_context = {
        ...defaultScenarioContext(),
        startup_date: opening,
        idols_path: `web://scenarios/${subdir}/idols.json`,
        groups_path: `web://scenarios/${subdir}/groups.json`,
        songs_path: `web://scenarios/${subdir}/songs.json`,
    };
    save.database_snapshot = snap;
    save.scenario_runtime.future_events = filtered.futureEvents;
    save.scenario_runtime.official_schedules = deepCopy(loaded.official_schedules ?? []);
    save.shortlist = [];
    save.goods_inventory = (0, financeSystem_1.defaultGoodsInventory)(managedGoodsMembers(save));
    for (const uid of memberUids) {
        save.training_intensity[uid] = { ...(0, idolStatusSystem_1.defaultAutopilotTrainingIntensity)() };
        save.training_focus_skill[uid] = "talking";
    }
    save.game_start_date = opening;
    save.current_date = opening;
    save.managed_song_status = (0, songStatusSystem_1.normalizeManagedSongStatus)({}, save.database_snapshot.songs, String(g.uid), opening, memberUids.length);
    save.training_song_uids = [];
    save.turn_number = 0;
    save.finances = (0, financeSystem_1.defaultFinances)(cash);
    ensureManagedContracts(save);
    save.inbox.notifications = [];
    save.scout.selected_company_uid = (0, scoutWeb_1.buildDefaultScoutCompanies)()[0]?.uid ?? null;
    const gid = String(g.uid);
    (0, inbox_1.addNotification)(save, {
        title: "Roster overview",
        body: `Current roster for ${String(g.name_romanji ?? g.name ?? "this group")} is attached below. Open any idol profile from this mail to review history before planning the first week.`,
        sender: "Assistant",
        category: "guidance",
        level: "high",
        isoDate: opening,
        createdTime: "09:02:00",
        unread: true,
        dedupeKey: `startup-roster|${gid}|${opening}`,
    });
    (0, inbox_1.addNotification)(save, {
        title: "Upcoming lives",
        body: startupUpcomingLivesBody(save, opening),
        sender: "Assistant",
        category: "guidance",
        level: "high",
        isoDate: opening,
        createdTime: "09:04:00",
        unread: true,
        dedupeKey: `startup-lives|${gid}|${opening}`,
    });
    (0, inbox_1.addNotification)(save, {
        title: "Staff briefing before opening week",
        body: "Assistant briefing:\n\nTraining sessions run in fixed blocks: morning 08:00-12:00 and afternoon 13:00-17:00.\nPlease review the weekly assignments schedule and the idol status table before the first heavy stretch.\n\nThe default sliders are balanced for now, but each member's workload and focus should be confirmed before the weekend.",
        sender: "Assistant",
        category: "background",
        level: "normal",
        isoDate: opening,
        createdTime: "09:03:00",
        unread: true,
        dedupeKey: `startup-staff|${gid}|${opening}`,
    });
    (0, inbox_1.addNotification)(save, {
        title: "Production started",
        body: `From: Assistant\nTo: ${save.player_name ? `Producer ${save.player_name}` : "Producer"}\nSubject: Management handoff for ${String(g.name_romanji ?? g.name)}\n\nYou are now in charge of ${String(g.name_romanji ?? g.name)} for scenario ${loaded.preset.scenario_number}: ${loaded.preset.name}.\nOpening cash on hand: \u00A5${cash.toLocaleString("ja-JP")}.\n\nPlease review the roster, the training plan, and the upcoming live calendar, including TIF appearances where they are already booked.`,
        sender: "Assistant",
        category: "general",
        isoDate: opening,
        createdTime: "09:01:00",
        unread: true,
        dedupeKey: `production-started|${gid}|${opening}`,
    });
    return normalizeGameSavePayload(save);
}
function deepCopy(v) {
    return JSON.parse(JSON.stringify(v));
}
function managedContractDefaultEndDate(startIso) {
    const datePart = String(startIso ?? "").split("T")[0];
    const match = /^(\d{4})-\d{2}-\d{2}$/.exec(datePart);
    const year = match ? Number(match[1]) : 2020;
    return `${String(year + 1).padStart(4, "0")}-12-31`;
}
function managedContractJoinDate(idol, groupUid, groupNames, fallbackIso) {
    const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const raw of hist) {
        if (!raw || typeof raw !== "object")
            continue;
        const row = raw;
        const uid = String(row.group_uid ?? "").trim();
        const name = String(row.group_name ?? "").trim();
        if (uid === groupUid || (name && groupNames.has(name))) {
            const start = String(row.start_date ?? "").split("T")[0];
            if (/^\d{4}-\d{2}-\d{2}$/.test(start))
                return start;
        }
    }
    return String(fallbackIso ?? "").split("T")[0] || "2020-01-01";
}
function ensureManagedContracts(save) {
    const group = getPrimaryGroup(save);
    if (!group)
        return;
    const groupUid = String(group.uid ?? "").trim();
    const groupNames = new Set([String(group.name ?? "").trim(), String(group.name_romanji ?? "").trim()].filter(Boolean));
    const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
    const baseSalary = (0, financeSystem_1.monthlyBaseSalaryYenForGroupLetterTier)((0, financeSystem_1.resolveGroupLetterTier)(group));
    const fallbackStart = String(save.game_start_date ?? save.current_date ?? save.scenario_context.startup_date ?? "2020-01-01");
    const defaultEnd = managedContractDefaultEndDate(fallbackStart);
    for (const uid of memberUids) {
        const idol = save.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid);
        if (!idol || typeof idol !== "object")
            continue;
        const row = idol;
        if (!(typeof row.contract_salary_yen === "number" && Number.isFinite(row.contract_salary_yen))) {
            row.contract_salary_yen = baseSalary;
        }
        if (typeof row.contract_start_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.contract_start_date))) {
            row.contract_start_date = managedContractJoinDate(row, groupUid, groupNames, fallbackStart);
        }
        if (typeof row.contract_end_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(String(row.contract_end_date))) {
            row.contract_end_date = defaultEnd;
        }
    }
}
function startupUpcomingLivesBody(save, openingIso) {
    const startIso = String(openingIso).split("T")[0];
    const thisMonth = startOfMonthIso(startIso);
    const nextMonth = addMonths(thisMonth, 1);
    const endIso = endOfMonthIso(nextMonth);
    const seen = new Set();
    const rows = save.lives.schedules
        .filter((raw) => Boolean(raw && typeof raw === "object"))
        .filter((live) => {
        const d = String(live.start_date ?? "").split("T")[0];
        return d >= startIso && d <= endIso;
    })
        .filter((live) => {
        const uid = String(live.uid ?? "").trim();
        const key = uid ||
            [
                String(live.start_date ?? "").split("T")[0],
                String(live.start_time ?? "").trim(),
                String(live.title ?? live.live_type ?? "Live").trim(),
                String(live.venue ?? "TBA").trim(),
            ].join("|");
        if (seen.has(key))
            return false;
        seen.add(key);
        return true;
    });
    return rows.length ? "" : "No booked lives.";
}
function refreshStartupUpcomingLivesNotification(save, openingIso) {
    const opening = String(openingIso ?? save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01").split("T")[0];
    const row = save.inbox.notifications.find((item) => String(item.dedupe_key ?? "").startsWith("startup-lives|"));
    if (!row)
        return;
    row.body = startupUpcomingLivesBody(save, opening);
}
function defaultScenarioContext() {
    return {
        startup_date: null,
        idols_path: null,
        groups_path: null,
        songs_path: null,
        shared_attributes_path: null,
        idols_signature: null,
        groups_signature: null,
        songs_signature: null,
        shared_attributes_signature: null,
    };
}
/** Desktop `pending_init` finances (GameSave.default_finances) — replaced when sim runs. */
function defaultPendingFinances() {
    return {
        status: "pending_init",
        cash_yen: null,
        currency: "JPY",
        notes: "Waiting for finance initialization.",
    };
}
function defaultGameSavePayload() {
    return {
        version: exports.GAME_SAVE_VERSION,
        account_name: "",
        player_name: "",
        managing_group: null,
        managing_group_uid: null,
        scenario_context: defaultScenarioContext(),
        database_snapshot: { idols: [], groups: [], songs: [], shared_releases: [] },
        scenario_runtime: { future_events: [], official_schedules: [] },
        shortlist: [],
        cd_projects: [],
        goods_inventory: [],
        inbox: { notifications: [] },
        schedules: {},
        lives: { schedules: [], results: [] },
        finances: defaultPendingFinances(),
        training_intensity: {},
        training_week_log: {},
        training_focus_skill: {},
        managed_song_status: {},
        training_song_uids: [],
        scout: { selected_company_uid: null, auditions: {}, subscriptions: {} },
    };
}
/** Merge loaded JSON toward v11 defaults (subset of desktop normalize_payload). */
function normalizeGameSavePayload(raw) {
    const base = defaultGameSavePayload();
    if (!raw || typeof raw !== "object")
        return base;
    const p = raw;
    const out = deepCopy(base);
    if (typeof p.version === "number")
        out.version = exports.GAME_SAVE_VERSION;
    if (p.account_name != null)
        out.account_name = String(p.account_name ?? "").trim();
    if (p.player_name != null)
        out.player_name = String(p.player_name ?? "").trim();
    if (!out.account_name && out.player_name)
        out.account_name = out.player_name;
    if ("managing_group" in p)
        out.managing_group = p.managing_group == null ? null : String(p.managing_group);
    if ("managing_group_uid" in p) {
        out.managing_group_uid = p.managing_group_uid == null ? null : String(p.managing_group_uid);
    }
    if (Array.isArray(p.cd_projects)) {
        out.cd_projects = p.cd_projects
            .map((rawRow, index) => {
            if (!rawRow || typeof rawRow !== "object")
                return null;
            const row = rawRow;
            const uid = String(row.uid ?? "").trim() || `cd-project-${index + 1}`;
            const release_kind = String(row.release_kind ?? "").trim() === "album" ? "album" : "single";
            const title = String(row.title ?? "").trim() || (release_kind === "album" ? "New album" : "New single");
            const song_uids = Array.isArray(row.song_uids)
                ? row.song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
                : [];
            const released_digital_song_uids = Array.isArray(row.released_digital_song_uids)
                ? row.released_digital_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
                : [];
            return {
                uid,
                title,
                release_kind,
                song_uids: song_uids.filter((value, valueIndex, arr) => arr.indexOf(value) === valueIndex),
                released_digital_song_uids: released_digital_song_uids.filter((value, valueIndex, arr) => arr.indexOf(value) === valueIndex),
            };
        })
            .filter((row) => Boolean(row));
    }
    if (p.scenario_context && typeof p.scenario_context === "object") {
        const c = p.scenario_context;
        const keys = [
            "startup_date",
            "idols_path",
            "groups_path",
            "songs_path",
            "shared_attributes_path",
            "idols_signature",
            "groups_signature",
            "songs_signature",
            "shared_attributes_signature",
        ];
        for (const k of keys) {
            if (c[k] != null && c[k] !== undefined) {
                out.scenario_context[k] = String(c[k]);
            }
        }
    }
    if (p.database_snapshot && typeof p.database_snapshot === "object") {
        const snap = p.database_snapshot;
        if (Array.isArray(snap.idols))
            out.database_snapshot.idols = deepCopy(snap.idols);
        if (Array.isArray(snap.groups))
            out.database_snapshot.groups = deepCopy(snap.groups);
        if (Array.isArray(snap.songs))
            out.database_snapshot.songs = deepCopy(snap.songs);
        if (Array.isArray(snap.shared_releases)) {
            out.database_snapshot.shared_releases = deepCopy(snap.shared_releases);
        }
    }
    if (p.scenario_runtime && typeof p.scenario_runtime === "object") {
        const runtime = p.scenario_runtime;
        const fe = runtime.future_events;
        if (Array.isArray(fe)) {
            out.scenario_runtime.future_events = fe.filter((x) => typeof x === "object");
        }
        const officialSchedules = runtime.official_schedules;
        if (Array.isArray(officialSchedules)) {
            out.scenario_runtime.official_schedules = officialSchedules.filter((x) => Boolean(x && typeof x === "object" && Array.isArray(x.events)));
        }
    }
    if (Array.isArray(p.shortlist)) {
        out.shortlist = p.shortlist.map((x) => String(x));
    }
    if (p.inbox && typeof p.inbox === "object") {
        const rows = p.inbox.notifications;
        if (Array.isArray(rows)) {
            out.inbox.notifications = rows.filter((x) => typeof x === "object" && x !== null);
        }
    }
    if (p.schedules && typeof p.schedules === "object" && !Array.isArray(p.schedules)) {
        out.schedules = deepCopy(p.schedules);
    }
    if (p.lives && typeof p.lives === "object") {
        const L = p.lives;
        if (Array.isArray(L.schedules))
            out.lives.schedules = [...L.schedules];
        if (Array.isArray(L.results))
            out.lives.results = [...L.results];
    }
    if (p.finances && typeof p.finances === "object") {
        Object.assign(out.finances, p.finances);
    }
    if (p.scout && typeof p.scout === "object") {
        const sc = p.scout;
        if (sc.selected_company_uid != null)
            out.scout.selected_company_uid = String(sc.selected_company_uid);
        if (sc.auditions && typeof sc.auditions === "object")
            out.scout.auditions = deepCopy(sc.auditions);
        if (sc.subscriptions && typeof sc.subscriptions === "object") {
            out.scout.subscriptions = (0, scoutWeb_1.normalizeScoutSubscriptions)(sc.subscriptions);
        }
    }
    if (p.current_date != null)
        out.current_date = String(p.current_date);
    if (p.game_start_date != null)
        out.game_start_date = String(p.game_start_date).split("T")[0];
    if (p.turn_number != null) {
        const t = Number(p.turn_number);
        if (!Number.isNaN(t))
            out.turn_number = t;
    }
    if (p.training_intensity && typeof p.training_intensity === "object") {
        out.training_intensity = deepCopy(p.training_intensity);
        for (const cols of Object.values(out.training_intensity)) {
            if (typeof cols !== "object" || cols === null)
                continue;
            if ("misc" in cols && !("target" in cols)) {
                const misc = cols.misc;
                cols.target =
                    typeof misc === "number" ? Math.max(0, Math.min(5, misc)) : Number(misc ?? 0) || 0;
                delete cols.misc;
            }
        }
    }
    if (p.training_week_log && typeof p.training_week_log === "object") {
        out.training_week_log = (0, idolStatusSystem_1.normalizeTrainingWeekLog)(p.training_week_log);
    }
    if (p.training_focus_skill && typeof p.training_focus_skill === "object") {
        out.training_focus_skill = deepCopy(p.training_focus_skill);
    }
    for (const idol of out.database_snapshot.idols) {
        (0, idolStatusSystem_1.ensureIdolSimulationDefaults)(idol);
    }
    for (const group of out.database_snapshot.groups) {
        backfillGroupMemberFanCounts(out.database_snapshot.idols, group);
    }
    out.goods_inventory = (0, financeSystem_1.normalizeGoodsInventory)(p.goods_inventory, managedGoodsMembers(out));
    const primaryGroup = getPrimaryGroup(out);
    const primaryGroupUid = String(primaryGroup?.uid ?? "").trim();
    const primaryMemberCount = Array.isArray(primaryGroup?.member_uids) ? primaryGroup.member_uids.length : 0;
    out.managed_song_status = (0, songStatusSystem_1.normalizeManagedSongStatus)(p.managed_song_status, out.database_snapshot.songs, primaryGroupUid, out.current_date ?? out.game_start_date ?? out.scenario_context.startup_date ?? null, primaryMemberCount);
    out.training_song_uids = (0, songStatusSystem_1.normalizeTrainingSongSelection)(p.training_song_uids, out.managed_song_status);
    ensureManagedContracts(out);
    out.version = exports.GAME_SAVE_VERSION;
    return out;
}
/**
 * Replace save snapshot songs with the in-memory scenario catalog when the save still
 * has the old disc-only `songs.json` (few rows per group) but catalog has per-track rows.
 */
function hydrateSnapshotSongsFromScenario(save, catalog, scenarioDataSubdir) {
    if (!catalog?.length)
        return false;
    if (scenarioDataSubdir) {
        const hint = `${save.scenario_context?.songs_path ?? ""}${save.scenario_context?.groups_path ?? ""}`;
        if (!hint.includes(scenarioDataSubdir))
            return false;
    }
    const groupUids = new Set(save.database_snapshot.groups
        .map((g) => String(g.uid ?? "").trim())
        .filter((u) => u.length > 0));
    if (!groupUids.size)
        return false;
    const merged = catalog.filter((s) => groupUids.has(String(s.group_uid ?? "").trim()));
    if (merged.length <= save.database_snapshot.songs.length)
        return false;
    save.database_snapshot.songs = merged;
    return true;
}
/**
 * Refresh save snapshot groups from the in-memory scenario catalog when group metadata
 * has been improved in shipped data (for example discography track lists or shared-release links).
 */
function hydrateSnapshotGroupsFromScenario(save, catalog, scenarioDataSubdir) {
    if (!catalog?.length)
        return false;
    if (scenarioDataSubdir) {
        const hint = `${save.scenario_context?.songs_path ?? ""}${save.scenario_context?.groups_path ?? ""}`;
        if (!hint.includes(scenarioDataSubdir))
            return false;
    }
    const groupUids = new Set(save.database_snapshot.groups
        .map((g) => String(g.uid ?? "").trim())
        .filter((u) => u.length > 0));
    if (!groupUids.size)
        return false;
    const merged = catalog.filter((g) => groupUids.has(String(g.uid ?? "").trim()));
    if (merged.length !== save.database_snapshot.groups.length)
        return false;
    save.database_snapshot.groups = deepCopy(merged);
    return true;
}
function getPrimaryGroup(save) {
    const groups = save.database_snapshot.groups;
    if (!groups.length)
        return null;
    const uid = save.managing_group_uid;
    if (uid) {
        const hit = groups.find((g) => String(g.uid ?? "") === uid);
        if (hit)
            return hit;
    }
    return groups[0] ?? null;
}
function getLetterTierFromGroup(group) {
    return (0, financeSystem_1.resolveGroupLetterTier)(group ?? undefined);
}
function getActiveFinances(save) {
    const raw = save.finances;
    const g = getPrimaryGroup(save);
    const scenarioRaw = g?.web_scenario_number ?? g?.scenario_number;
    const scenarioNum = typeof scenarioRaw === "number" ? scenarioRaw : Number(scenarioRaw ?? NaN);
    const fallbackStart = (0, financeSystem_1.scenarioStartingCash)(Number.isNaN(scenarioNum) ? null : scenarioNum);
    let startCash = fallbackStart;
    if (typeof raw.opening_cash_yen === "number")
        startCash = raw.opening_cash_yen;
    else if (typeof raw.cash_yen === "number")
        startCash = raw.cash_yen;
    return (0, financeSystem_1.normalizeFinances)(raw, startCash);
}
/**
 * Bootstrap a desktop-shaped save from the static web preview bundle (seed content).
 */
function createGameSaveFromPreviewBundle(bundle) {
    const opening = bundle.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(bundle.opening_date) ? bundle.opening_date : "2020-01-01";
    const g = bundle.group;
    const popularity = typeof g.popularity === "number" ? g.popularity : 0;
    const fans = typeof g.fans === "number" ? g.fans : 0;
    const tier = (0, financeSystem_1.inferLetterTier)(popularity, fans, 0);
    const groupRow = {
        ...g,
        letter_tier: tier,
        web_scenario_number: bundle.scenario_number ?? null,
    };
    const cash = (0, financeSystem_1.scenarioStartingCash)(bundle.scenario_number ?? null);
    const save = defaultGameSavePayload();
    save.managing_group = g.name_romanji ?? g.name ?? null;
    save.managing_group_uid = typeof g.uid === "string" ? g.uid : null;
    save.scenario_context.startup_date = opening;
    save.database_snapshot.groups = [groupRow];
    save.database_snapshot.idols = bundle.idols.map((i) => ({ ...i }));
    save.database_snapshot.songs = [];
    save.shortlist = [];
    save.goods_inventory = (0, financeSystem_1.defaultGoodsInventory)(managedGoodsMembers(save));
    save.managed_song_status = {};
    save.training_song_uids = [];
    (0, idolAttributes_1.applyAttributesToAllIdols)(save.database_snapshot.idols, save.database_snapshot.groups, opening);
    for (const uid of (g.member_uids?.map(String) ?? [])) {
        save.training_intensity[uid] = { ...(0, idolStatusSystem_1.defaultAutopilotTrainingIntensity)() };
        save.training_focus_skill[uid] = "talking";
        const row = save.database_snapshot.idols.find((r) => String(r.uid ?? "") === uid);
        if (row)
            (0, idolStatusSystem_1.ensureIdolSimulationDefaults)(row);
    }
    backfillGroupMemberFanCounts(save.database_snapshot.idols, groupRow);
    save.game_start_date = opening;
    save.current_date = opening;
    save.turn_number = 0;
    save.finances = (0, financeSystem_1.defaultFinances)(cash);
    save.inbox.notifications = [];
    save.scenario_runtime = { future_events: [], official_schedules: [] };
    save.scout.selected_company_uid = (0, scoutWeb_1.buildDefaultScoutCompanies)()[0]?.uid ?? null;
    save.scout.subscriptions = {};
    (0, inbox_1.addNotification)(save, {
        title: "Production started",
        body: `Scenario ${bundle.scenario_number ?? "?"} · ${g.name_romanji} · opening cash ¥${cash.toLocaleString("ja-JP")}`,
        sender: "Assistant",
        category: "general",
        isoDate: opening,
        unread: false,
    });
    return normalizeGameSavePayload(save);
}
