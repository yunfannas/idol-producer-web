"use strict";
/**
 * Which songs appear in lists / counts / live novelty, and how they sort for display.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isSongHiddenFromDisplay = isSongHiddenFromDisplay;
exports.songPopularityNum = songPopularityNum;
exports.parseCatalogIsoToTime = parseCatalogIsoToTime;
exports.isSongAvailableOn = isSongAvailableOn;
exports.splitSongsReleasedVsMaking = splitSongsReleasedVsMaking;
exports.songsForDisplaySorted = songsForDisplaySorted;
exports.primaryDiscLabel = primaryDiscLabel;
exports.discBucketKey = discBucketKey;
exports.buildGroupDiscographyReleaseRows = buildGroupDiscographyReleaseRows;
exports.buildDiscBuckets = buildDiscBuckets;
const discographyNormalize_1 = require("./discographyNormalize");
const songCatalog_1 = require("./songCatalog");
function normalizeSongTitleForMatch(title) {
    return title
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim();
}
const LIVE_VARIANT_SUFFIX_MARKERS = [
    "anniversary",
    "premium concert",
    "concert",
    "arena tour",
    "tour",
    "live",
    "fes",
    "festival",
    "武道館",
    "コンサート",
    "ツアー",
    "公演",
    "卒業コンサート",
    "卒業",
    "アリーナ",
    "イコノイ",
    "24girls",
    "昼公演",
    "夜公演",
];
function liveVariantBaseTitle(title) {
    const trimmed = String(title ?? "").trim();
    if (!trimmed)
        return null;
    for (const [open, close] of [["(", ")"], ["（", "）"], ["[", "]"]]) {
        if (!trimmed.endsWith(close))
            continue;
        const start = trimmed.lastIndexOf(open);
        if (start <= 0)
            continue;
        const suffix = trimmed.slice(start + open.length, trimmed.length - close.length).trim();
        const suffixNorm = normalizeSongTitleForMatch(suffix).toLowerCase();
        if (!suffixNorm)
            continue;
        if (!LIVE_VARIANT_SUFFIX_MARKERS.some((marker) => suffixNorm.includes(marker)))
            continue;
        const base = trimmed.slice(0, start).trim();
        if (base)
            return base;
    }
    return null;
}
function isManagedLivePerformanceDuplicate(row, allSongs) {
    const groupUid = String(row.group_uid ?? "").trim();
    if (groupUid !== "PUxPVkU")
        return false;
    if (!Array.isArray(allSongs) || !allSongs.length)
        return false;
    const base = liveVariantBaseTitle((0, songCatalog_1.songCatalogPrimaryTitle)(row));
    if (!base)
        return false;
    const baseNorm = normalizeSongTitleForMatch(base);
    const rowUid = String(row.uid ?? "").trim();
    for (const candidate of allSongs) {
        if (!candidate || typeof candidate !== "object")
            continue;
        if (candidate.hidden === true)
            continue;
        const candidateUid = String(candidate.uid ?? "").trim();
        if (candidateUid === rowUid)
            continue;
        if (String(candidate.group_uid ?? "").trim() !== groupUid)
            continue;
        if (normalizeSongTitleForMatch((0, songCatalog_1.songCatalogPrimaryTitle)(candidate)) === baseNorm)
            return true;
    }
    return false;
}
function isSongHiddenFromDisplay(row, allSongs) {
    if (row.hidden === true)
        return true;
    const title = String(row.title ?? "").trim();
    if (isManagedLivePerformanceDuplicate(row, allSongs))
        return true;
    if (title.includes("三百六十五歩のマーチ"))
        return true;
    return false;
}
function specialSongAvailabilityIso(row) {
    const uid = String(row.uid ?? "").trim();
    if (uid === "d3b51910-0f40-4e75-9413-4f3762fbf110")
        return "2026-01-01";
    return null;
}
function songPopularityNum(row) {
    for (const key of ["popularity", "popularity_local", "popularity_global"]) {
        const v = row[key];
        if (typeof v === "number" && Number.isFinite(v))
            return v;
        if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)))
            return Number(v);
    }
    return 0;
}
/** Parse `YYYY-MM-DD` (or ISO prefix) to UTC noon ms; invalid -> `null`. */
function parseCatalogIsoToTime(iso) {
    const s = String(iso ?? "").trim().split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s))
        return null;
    const t = new Date(`${s}T12:00:00Z`).getTime();
    return Number.isFinite(t) ? t : null;
}
function songAvailabilityTime(row) {
    return parseCatalogIsoToTime(specialSongAvailabilityIso(row) ?? String(row.release_date ?? "")) ?? 0;
}
function isSongAvailableOn(row, referenceIso) {
    const refT = parseCatalogIsoToTime(referenceIso);
    if (refT == null)
        return true;
    return songAvailabilityTime(row) <= refT;
}
/** Row has no parseable availability date, or it is strictly after `referenceIso` (desktop "Making"). */
function splitSongsReleasedVsMaking(teamSongs, referenceIso) {
    const refT = parseCatalogIsoToTime(referenceIso);
    if (refT == null) {
        return { released: teamSongs, making: [] };
    }
    const released = [];
    const making = [];
    for (const row of teamSongs) {
        const rowT = songAvailabilityTime(row);
        if (rowT == null || rowT > refT)
            making.push(row);
        else
            released.push(row);
    }
    return { released, making };
}
/** Drop display-hidden rows, then popularity descending (ties: newer availability first). */
function songsForDisplaySorted(all) {
    return [...all]
        .filter((r) => !isSongHiddenFromDisplay(r, all))
        .sort((a, b) => {
        const pa = songPopularityNum(a);
        const pb = songPopularityNum(b);
        if (pb !== pa)
            return pb - pa;
        return songAvailabilityTime(b) - songAvailabilityTime(a);
    });
}
/** Primary disc / album label for UI (first non-empty `albums[].name`, else disc_type / stub). */
function primaryDiscLabel(row) {
    const albums = Array.isArray(row.albums) ? row.albums : [];
    for (const raw of albums) {
        if (!raw || typeof raw !== "object")
            continue;
        const name = String(raw.name ?? "").trim();
        if (name)
            return name;
    }
    const rdu = row.disc_uid;
    if (rdu != null && String(rdu).trim()) {
        const s = String(rdu).trim();
        return `Disc ${s.slice(0, 8)}…`;
    }
    const dt = String(row.disc_type ?? "").trim();
    if (dt)
        return dt;
    return "—";
}
/** Stable bucket id for grouping tracks onto disc tabs. */
function discBucketKey(row) {
    const albums = Array.isArray(row.albums) ? row.albums : [];
    for (const raw of albums) {
        if (!raw || typeof raw !== "object")
            continue;
        const du = raw.disc_uid;
        if (du != null && String(du).trim())
            return `u:${String(du).trim()}`;
    }
    const rootDu = row.disc_uid;
    if (rootDu != null && String(rootDu).trim())
        return `u:${String(rootDu).trim()}`;
    const lab = primaryDiscLabel(row);
    if (lab && lab !== "—")
        return `n:${lab}`;
    const rd = String(row.release_date ?? "").split("T")[0];
    const uid = String(row.uid ?? "");
    return `t:${rd}|${uid}`;
}
function effectiveSharedReleaseTrackCount(release, groupUid) {
    const sharedSongUids = Array.isArray(release.shared_track_song_uids)
        ? release.shared_track_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    const sharedTrackList = Array.isArray(release.shared_track_list)
        ? release.shared_track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    const sharedCount = Math.max(sharedSongUids.length, sharedTrackList.length);
    const editions = Array.isArray(release.group_editions)
        ? release.group_editions.filter((row) => Boolean(row && typeof row === "object"))
        : [];
    const edition = editions.find((row) => String(row.group_uid ?? "").trim() === groupUid) ?? null;
    if (!edition)
        return sharedCount;
    const editionSongUids = Array.isArray(edition.track_song_uids)
        ? edition.track_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    const editionTrackList = Array.isArray(edition.track_list)
        ? edition.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    return sharedCount + Math.max(editionSongUids.length, editionTrackList.length);
}
function trackSectionsFromLocalRelease(row) {
    if ((0, discographyNormalize_1.discUsesEditionTrackLayout)(row)) {
        const sections = [];
        const sharedTracks = (0, discographyNormalize_1.effectiveSharedTracks)(row);
        if (sharedTracks.length)
            sections.push({ label: "Shared tracks", tracks: sharedTracks });
        for (const edition of (0, discographyNormalize_1.effectiveEditionSlices)(row)) {
            if (edition.track_list.length)
                sections.push({ label: edition.label, tracks: edition.track_list });
        }
        return sections;
    }
    const trackList = Array.isArray(row.track_list)
        ? row.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    return trackList.length ? [{ label: "Tracks", tracks: trackList }] : [];
}
function trackSectionsFromSharedRelease(release, groupUid) {
    const sections = [];
    const sharedTracks = Array.isArray(release.shared_track_list)
        ? release.shared_track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    if (sharedTracks.length)
        sections.push({ label: "Shared tracks", tracks: sharedTracks });
    const editions = Array.isArray(release.group_editions)
        ? release.group_editions.filter((row) => Boolean(row && typeof row === "object"))
        : [];
    const edition = editions.find((row) => String(row.group_uid ?? "").trim() === groupUid) ?? null;
    if (!edition)
        return sections;
    const editionTracks = Array.isArray(edition.track_list)
        ? edition.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
        : [];
    if (!editionTracks.length)
        return sections;
    const label = String(edition.edition_label ?? edition.group_name ?? "Edition").trim() || "Edition";
    sections.push({ label, tracks: editionTracks });
    return sections;
}
function normalizeDiscographyTypeLabel(row) {
    const raw = String(row.disc_type ?? "").trim();
    const title = String(row.title ?? row.title_romanji ?? "").trim();
    if (/^dvd\/bd$/i.test(raw))
        return "DVD/BD";
    if (/^digital single$/i.test(raw))
        return "Digital Single";
    if (/^album$/i.test(raw))
        return "Album";
    if (/^single$/i.test(raw))
        return "Single";
    if (/^(best album|mini album|ep)$/i.test(raw))
        return raw;
    if (/^(cd|blu-ray|dvd)$/i.test(raw) && /(concert|tour|arena|anniversary|live|卒業コンサート|プレミアム|premium)/i.test(title)) {
        return "DVD/BD";
    }
    if (/^(cd|blu-ray|dvd)$/i.test(raw))
        return "CD";
    return raw || "—";
}
function buildGroupDiscographyReleaseRows(group, referenceIso, sharedReleases) {
    const rawDisc = Array.isArray(group?.discography)
        ? group.discography.filter((row) => Boolean(row && typeof row === "object"))
        : [];
    const groupUid = String(group?.uid ?? "").trim();
    const sharedReleaseUids = Array.isArray(group?.shared_release_uids)
        ? (group.shared_release_uids
            .map((uid) => String(uid ?? "").trim())
            .filter(Boolean))
        : [];
    const rawShared = Array.isArray(sharedReleases)
        ? sharedReleases.filter((row) => Boolean(row && typeof row === "object"))
        : [];
    const sharedDisc = rawShared.filter((row) => {
        const uid = String(row.uid ?? "").trim();
        const releaseGroupUids = Array.isArray(row.group_uids)
            ? row.group_uids.map((value) => String(value ?? "").trim()).filter(Boolean)
            : [];
        return (uid && sharedReleaseUids.includes(uid)) || (groupUid && releaseGroupUids.includes(groupUid));
    });
    const refT = parseCatalogIsoToTime(referenceIso);
    const localRows = rawDisc
        .filter((row) => {
        const rel = parseCatalogIsoToTime(String(row.release_date ?? ""));
        if (refT == null || rel == null)
            return true;
        return rel <= refT;
    })
        .map((row, index) => {
        const title = String(row.title ?? row.title_romanji ?? "").trim() || "—";
        const releaseDate = String(row.release_date ?? "").split("T")[0].trim() || "—";
        const trackSongUids = Array.isArray(row.track_song_uids)
            ? row.track_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
            : [];
        const trackList = Array.isArray(row.track_list)
            ? row.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
            : [];
        return {
            key: String(row.uid ?? "").trim() || `group-disc-${index + 1}`,
            title,
            discType: normalizeDiscographyTypeLabel(row),
            releaseDate,
            trackCount: Math.max(trackSongUids.length, trackList.length),
            trackSections: trackSectionsFromLocalRelease(row),
        };
    });
    const sharedRows = sharedDisc
        .filter((row) => {
        const rel = parseCatalogIsoToTime(String(row.release_date ?? ""));
        if (refT == null || rel == null)
            return true;
        return rel <= refT;
    })
        .map((row) => {
        const title = String(row.title ?? row.title_romanji ?? "").trim() || "—";
        const releaseDate = String(row.release_date ?? "").split("T")[0].trim() || "—";
        return {
            key: `shared:${String(row.uid ?? "").trim() || title}`,
            title,
            discType: normalizeDiscographyTypeLabel(row),
            releaseDate,
            trackCount: effectiveSharedReleaseTrackCount(row, groupUid),
            trackSections: trackSectionsFromSharedRelease(row, groupUid),
        };
    });
    return [...localRows, ...sharedRows]
        .sort((a, b) => {
        const ad = parseCatalogIsoToTime(a.releaseDate) ?? 0;
        const bd = parseCatalogIsoToTime(b.releaseDate) ?? 0;
        if (ad !== bd)
            return ad - bd;
        return a.title.localeCompare(b.title, "ja");
    });
}
/** One entry per disc bucket; songs sorted by popularity within bucket. */
function buildDiscBuckets(teamSongs) {
    const m = new Map();
    for (const row of teamSongs) {
        const key = discBucketKey(row);
        const label = primaryDiscLabel(row);
        if (!m.has(key))
            m.set(key, { label, songs: [] });
        m.get(key).songs.push(row);
    }
    for (const v of m.values()) {
        v.songs.sort((a, b) => songPopularityNum(b) - songPopularityNum(a));
    }
    return [...m.entries()]
        .map(([key, v]) => ({ key, label: v.label, songs: v.songs }))
        .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}
