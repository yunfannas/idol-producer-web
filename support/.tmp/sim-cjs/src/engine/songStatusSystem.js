"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TIMELESS_MEMORY_UNLOCK_DATE = exports.TIMELESS_MEMORY_UID = void 0;
exports.managedSongUnlockDate = managedSongUnlockDate;
exports.isManagedSongAvailableOn = isManagedSongAvailableOn;
exports.normalizeManagedSongStatus = normalizeManagedSongStatus;
exports.normalizeTrainingSongSelection = normalizeTrainingSongSelection;
exports.applyTrainingToManagedSongs = applyTrainingToManagedSongs;
exports.decayManagedSongsOvernight = decayManagedSongsOvernight;
exports.registerManagedSetlistPerformance = registerManagedSetlistPerformance;
exports.managedSetlistEffect = managedSetlistEffect;
exports.suggestManagedSetlistTitles = suggestManagedSetlistTitles;
exports.maybeAddSongUnlockNotification = maybeAddSongUnlockNotification;
const songCatalog_1 = require("../data/songCatalog");
exports.TIMELESS_MEMORY_UID = "d3b51910-0f40-4e75-9413-4f3762fbf110";
exports.TIMELESS_MEMORY_UNLOCK_DATE = "2026-01-01";
function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
}
function num(v, fallback = 0) {
    if (typeof v === "number" && Number.isFinite(v))
        return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
        return Number(v);
    return fallback;
}
function parseIsoDate(value) {
    const text = String(value ?? "").split("T")[0].trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}
function yearsBetweenIso(referenceIso, targetIso) {
    const ref = parseIsoDate(referenceIso);
    const target = parseIsoDate(targetIso);
    if (!ref || !target)
        return null;
    const refMs = Date.parse(`${ref}T12:00:00Z`);
    const targetMs = Date.parse(`${target}T12:00:00Z`);
    if (!Number.isFinite(refMs) || !Number.isFinite(targetMs))
        return null;
    return Math.abs(refMs - targetMs) / (365.25 * 86400000);
}
function isoDayIndex(value) {
    const iso = parseIsoDate(value);
    if (!iso)
        return null;
    const ms = Date.parse(`${iso}T12:00:00Z`);
    if (!Number.isFinite(ms))
        return null;
    return Math.floor(ms / 86400000);
}
function managedSongUnlockDate(row) {
    const uid = String(row.uid ?? "").trim();
    if (uid === exports.TIMELESS_MEMORY_UID)
        return exports.TIMELESS_MEMORY_UNLOCK_DATE;
    return parseIsoDate(row.release_date);
}
function isManagedSongAvailableOn(row, referenceIso) {
    const availableIso = managedSongUnlockDate(row);
    const refIso = parseIsoDate(referenceIso);
    if (!availableIso)
        return true;
    if (!refIso)
        return true;
    return availableIso <= refIso;
}
function defaultSongStatusRow(song, currentIso, memberCount, familiarity) {
    const available = isManagedSongAvailableOn(song, currentIso);
    return {
        song_uid: String(song.uid ?? ""),
        title: (0, songCatalog_1.songCatalogDisplayLabel)(song),
        familiarity: available ? familiarity : 0,
        rotation_fatigue: 0,
        learned_member_count: Math.max(0, memberCount),
        last_trained_date: null,
        last_performed_date: null,
        recent_performance_dates: [],
    };
}
function normalizeManagedSongStatus(raw, songs, groupUid, currentIso, memberCount) {
    const out = {};
    const rawMap = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
    const groupSongs = songs
        .filter((song) => song && typeof song === "object")
        .filter((song) => String(song.group_uid ?? "") === groupUid)
        .sort((a, b) => {
        const popDelta = num(b.popularity, 0) - num(a.popularity, 0);
        if (popDelta !== 0)
            return popDelta;
        const aRelease = parseIsoDate(a.release_date) ?? "";
        const bRelease = parseIsoDate(b.release_date) ?? "";
        if (bRelease !== aRelease)
            return bRelease.localeCompare(aRelease);
        return (0, songCatalog_1.songCatalogDisplayLabel)(a).localeCompare((0, songCatalog_1.songCatalogDisplayLabel)(b), "ja");
    });
    const topTwelve = new Set(groupSongs.slice(0, 12).map((song) => String(song.uid ?? "").trim()).filter(Boolean));
    for (const song of songs) {
        if (!song || typeof song !== "object")
            continue;
        if (String(song.group_uid ?? "") !== groupUid)
            continue;
        const uid = String(song.uid ?? "").trim();
        if (!uid)
            continue;
        const isTopTwelve = topTwelve.has(uid);
        const releaseAgeYears = yearsBetweenIso(currentIso, song.release_date);
        const isRecentSong = releaseAgeYears != null && releaseAgeYears <= 5;
        const initialFamiliarity = isTopTwelve ? 90 : isRecentSong ? 80 : 20;
        const base = defaultSongStatusRow(song, currentIso, memberCount, initialFamiliarity);
        const stored = rawMap[uid] && typeof rawMap[uid] === "object" && !Array.isArray(rawMap[uid])
            ? rawMap[uid]
            : null;
        const row = {
            song_uid: uid,
            title: stored ? String(stored.title ?? base.title) : base.title,
            familiarity: clamp(Math.round(stored ? num(stored.familiarity, base.familiarity) : base.familiarity), 0, 100),
            rotation_fatigue: clamp(Math.round(stored ? num(stored.rotation_fatigue, base.rotation_fatigue) : base.rotation_fatigue), 0, 100),
            learned_member_count: Math.max(0, Math.round(stored ? num(stored.learned_member_count, base.learned_member_count) : base.learned_member_count)),
            last_trained_date: stored ? parseIsoDate(stored.last_trained_date) : null,
            last_performed_date: stored ? parseIsoDate(stored.last_performed_date) : null,
            recent_performance_dates: stored && Array.isArray(stored.recent_performance_dates)
                ? stored.recent_performance_dates.map((x) => String(x)).filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x)).slice(-12)
                : [],
        };
        if (memberCount > row.learned_member_count) {
            row.familiarity = clamp(row.familiarity - (memberCount - row.learned_member_count) * 12, 0, 100);
            row.learned_member_count = memberCount;
        }
        out[uid] = row;
    }
    return out;
}
function normalizeTrainingSongSelection(raw, statusMap) {
    const valid = new Set(Object.keys(statusMap));
    if (!Array.isArray(raw))
        return [];
    return raw.map((x) => String(x)).filter((uid, index, arr) => valid.has(uid) && arr.indexOf(uid) === index);
}
function applyTrainingToManagedSongs(statusMap, selectedSongUids, targetIso, blocksPerIdol) {
    const selected = selectedSongUids
        .map((uid) => statusMap[uid])
        .filter((row) => Boolean(row));
    const gain = selected.length
        ? Math.max(1, Math.round((Math.max(1, blocksPerIdol) * 6) / selected.length))
        : 0;
    const updates = [];
    for (const row of selected) {
        const before = row.familiarity;
        row.familiarity = clamp(row.familiarity + gain, 0, 100);
        row.rotation_fatigue = clamp(row.rotation_fatigue - Math.max(1, Math.round(gain / 2)), 0, 100);
        row.last_trained_date = targetIso;
        updates.push({
            title: row.title,
            familiarity_delta: row.familiarity - before,
            familiarity_after: row.familiarity,
        });
    }
    return updates;
}
function decayManagedSongsOvernight(statusMap, selectedSongUids, targetIso) {
    const selected = new Set(selectedSongUids);
    for (const row of Object.values(statusMap)) {
        row.rotation_fatigue = clamp(row.rotation_fatigue - 5, 0, 100);
        if (!selected.has(row.song_uid) && row.last_trained_date !== targetIso) {
            row.familiarity = clamp(row.familiarity - 1, 0, 100);
        }
        row.recent_performance_dates = row.recent_performance_dates.filter((iso) => {
            const dt = Date.parse(`${iso}T12:00:00Z`);
            const ref = Date.parse(`${targetIso}T12:00:00Z`);
            if (!Number.isFinite(dt) || !Number.isFinite(ref))
                return false;
            return ref - dt <= 35 * 86400000;
        });
    }
}
function registerManagedSetlistPerformance(statusMap, songs, groupUid, setlistTitles, targetIso) {
    const titleToUid = new Map();
    for (const song of songs) {
        if (!song || typeof song !== "object")
            continue;
        if (String(song.group_uid ?? "") !== groupUid)
            continue;
        titleToUid.set((0, songCatalog_1.songCatalogDisplayLabel)(song), String(song.uid ?? ""));
    }
    const used = new Set();
    for (const title of setlistTitles.map((x) => String(x).trim()).filter(Boolean)) {
        const uid = titleToUid.get(title);
        if (!uid || used.has(uid))
            continue;
        used.add(uid);
        const row = statusMap[uid];
        if (!row)
            continue;
        const recentCount = row.recent_performance_dates.filter((iso) => {
            const dt = Date.parse(`${iso}T12:00:00Z`);
            const ref = Date.parse(`${targetIso}T12:00:00Z`);
            return Number.isFinite(dt) && Number.isFinite(ref) && ref - dt <= 21 * 86400000;
        }).length;
        row.rotation_fatigue = clamp(row.rotation_fatigue + 10 + recentCount * 8, 0, 100);
        row.recent_performance_dates = [...row.recent_performance_dates, targetIso].slice(-12);
        row.last_performed_date = targetIso;
    }
}
function managedSetlistEffect(statusMap, songs, groupUid, setlistTitles) {
    const titleToUid = new Map();
    for (const song of songs) {
        if (!song || typeof song !== "object")
            continue;
        if (String(song.group_uid ?? "") !== groupUid)
            continue;
        titleToUid.set((0, songCatalog_1.songCatalogDisplayLabel)(song), String(song.uid ?? ""));
    }
    const rows = [];
    for (const title of setlistTitles.map((x) => String(x).trim()).filter(Boolean)) {
        const uid = titleToUid.get(title);
        if (!uid)
            continue;
        const row = statusMap[uid];
        if (row)
            rows.push(row);
    }
    if (!rows.length) {
        return { score_delta: 0, avg_familiarity: 0, avg_rotation_fatigue: 0, low_familiarity_count: 0 };
    }
    const avgFamiliarity = rows.reduce((sum, row) => sum + row.familiarity, 0) / rows.length;
    const avgFatigue = rows.reduce((sum, row) => sum + row.rotation_fatigue, 0) / rows.length;
    const lowFamiliarityCount = rows.filter((row) => row.familiarity < 50).length;
    const familiarityBonus = clamp((avgFamiliarity - 62) / 4.8, -10, 10);
    const fatiguePenalty = clamp(avgFatigue / 18, 0, 4);
    const lowFamPenalty = lowFamiliarityCount * 1.1;
    return {
        score_delta: Math.round((familiarityBonus - fatiguePenalty - lowFamPenalty) * 100) / 100,
        avg_familiarity: Math.round(avgFamiliarity * 100) / 100,
        avg_rotation_fatigue: Math.round(avgFatigue * 100) / 100,
        low_familiarity_count: lowFamiliarityCount,
    };
}
function suggestManagedSetlistTitles(statusMap, songs, groupUid, referenceIso, maxN, songPopularity) {
    const available = songs
        .filter((row) => String(row.group_uid ?? "") === groupUid)
        .filter((row) => isManagedSongAvailableOn(row, referenceIso));
    const popularitySorted = [...available].sort((a, b) => {
        const popDelta = songPopularity(b) - songPopularity(a);
        if (popDelta !== 0)
            return popDelta;
        return (0, songCatalog_1.songCatalogDisplayLabel)(a).localeCompare((0, songCatalog_1.songCatalogDisplayLabel)(b), "ja");
    });
    const anchorRows = popularitySorted.slice(0, 3);
    const anchorUids = new Set(anchorRows.map((row) => String(row.uid ?? "")));
    const dayIndex = isoDayIndex(referenceIso);
    const targetAnchorCount = Math.min(maxN, anchorRows.length, maxN >= 4 ? 3 : maxN >= 2 ? 2 : 1);
    const anchorPicks = anchorRows
        .map((row, anchorIndex) => {
        const uid = String(row.uid ?? "");
        const status = statusMap[uid];
        const recent = Array.isArray(status?.recent_performance_dates) ? status.recent_performance_dates.slice(-5) : [];
        const scheduledSkip = dayIndex != null ? (dayIndex + anchorIndex) % 7 === 0 : false;
        return {
            row,
            recentCount: recent.length,
            fatigue: status?.rotation_fatigue ?? 0,
            scheduledSkip,
        };
    })
        .sort((a, b) => {
        if (a.scheduledSkip !== b.scheduledSkip)
            return a.scheduledSkip ? 1 : -1;
        if (a.recentCount !== b.recentCount)
            return a.recentCount - b.recentCount;
        if (a.fatigue !== b.fatigue)
            return a.fatigue - b.fatigue;
        return songPopularity(b.row) - songPopularity(a.row);
    })
        .filter((entry) => !entry.scheduledSkip)
        .slice(0, targetAnchorCount)
        .map((entry) => (0, songCatalog_1.songCatalogDisplayLabel)(entry.row));
    const chosenTitles = new Set(anchorPicks);
    const fillPicks = available
        .map((row) => {
        const uid = String(row.uid ?? "");
        const status = statusMap[uid];
        const recent = Array.isArray(status?.recent_performance_dates) ? status.recent_performance_dates.slice(-7) : [];
        const recentCount = recent.length;
        const mostRecentIso = recent.length ? recent[recent.length - 1] ?? null : null;
        const isAnchor = anchorUids.has(uid);
        const repeatPenalty = recentCount * 24 + (recentCount >= 3 ? 80 : 0);
        const immediateRepeatPenalty = mostRecentIso === referenceIso ? 40 : 0;
        const score = songPopularity(row) * 12 +
            (status?.familiarity ?? 60) * 0.85 -
            (status?.rotation_fatigue ?? 0) * 3.8 -
            repeatPenalty -
            immediateRepeatPenalty;
        return {
            row,
            score,
            isAnchor,
        };
    })
        .sort((a, b) => {
        if (b.score !== a.score)
            return b.score - a.score;
        if (a.isAnchor !== b.isAnchor)
            return a.isAnchor ? -1 : 1;
        return (0, songCatalog_1.songCatalogDisplayLabel)(a.row).localeCompare((0, songCatalog_1.songCatalogDisplayLabel)(b.row), "ja");
    })
        .map((entry) => (0, songCatalog_1.songCatalogDisplayLabel)(entry.row))
        .filter(Boolean)
        .filter((title) => {
        if (chosenTitles.has(title))
            return false;
        chosenTitles.add(title);
        return true;
    })
        .slice(0, Math.max(0, maxN - anchorPicks.length));
    return [...anchorPicks, ...fillPicks].slice(0, maxN);
}
function maybeAddSongUnlockNotification(save, targetIso) {
    const currentIso = parseIsoDate(targetIso);
    if (!currentIso)
        return;
    if (currentIso < exports.TIMELESS_MEMORY_UNLOCK_DATE)
        return;
    const exists = save.inbox.notifications.some((row) => String(row.dedupe_key ?? "") === `song-unlock|${exports.TIMELESS_MEMORY_UID}|${exports.TIMELESS_MEMORY_UNLOCK_DATE}`);
    if (exists)
        return;
    save.inbox.notifications.push({
        uid: `song-unlock-${exports.TIMELESS_MEMORY_UID}`,
        title: "New song prepared: タイムレスメモリー",
        body: "タイムレスメモリー is now available for training preparation, setlists, and scheduling.",
        sender: "Assistant",
        category: "general",
        created_at: `${exports.TIMELESS_MEMORY_UNLOCK_DATE}T08:00:00`,
        unread: true,
        read: false,
        requires_confirmation: false,
        dedupe_key: `song-unlock|${exports.TIMELESS_MEMORY_UID}|${exports.TIMELESS_MEMORY_UNLOCK_DATE}`,
    });
}
