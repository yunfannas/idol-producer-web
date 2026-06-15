"use strict";
/**
 * Normalize group.json discography rows: legacy flat {@link GroupDiscRelease.track_list},
 * or {@link GroupDiscRelease.shared_track_list} + {@link GroupDiscRelease.edition_track_lists} for CD/DVD variants.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.discUsesEditionTrackLayout = discUsesEditionTrackLayout;
exports.effectiveSharedTracks = effectiveSharedTracks;
exports.effectiveEditionSlices = effectiveEditionSlices;
exports.discMaxTrackSlotCount = discMaxTrackSlotCount;
exports.discMissingTrackPayload = discMissingTrackPayload;
exports.summarizeEditionTrackTotals = summarizeEditionTrackTotals;
function normalizeStrings(arr) {
    if (!Array.isArray(arr))
        return [];
    return arr.map((x) => String(x ?? "").trim()).filter(Boolean);
}
function normalizeEditionTrackLists(raw) {
    if (!Array.isArray(raw))
        return [];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== "object")
            continue;
        const o = item;
        const label = String(o.label ?? "").trim() || "Edition";
        const tl = normalizeStrings(o.track_list);
        out.push({ label, track_list: tl });
    }
    return out;
}
/** True when the row stores shared + edition-specific track lists (any editions defined). */
function discUsesEditionTrackLayout(d) {
    return normalizeEditionTrackLists(d.edition_track_lists).length > 0;
}
/** Prefer legacy flat {@link GroupDiscRelease.track_list} unless edition layout overrides. */
function effectiveSharedTracks(d) {
    if (discUsesEditionTrackLayout(d))
        return normalizeStrings(d.shared_track_list);
    return normalizeStrings(d.track_list);
}
function effectiveEditionSlices(d) {
    return normalizeEditionTrackLists(d.edition_track_lists);
}
/** Max track count among editions (shared + edition-only); legacy uses flat {@link GroupDiscRelease.track_list} length only. */
function discMaxTrackSlotCount(d) {
    const legacyFlat = normalizeStrings(d.track_list);
    if (!discUsesEditionTrackLayout(d))
        return legacyFlat.length;
    const shared = normalizeStrings(d.shared_track_list);
    const eds = normalizeEditionTrackLists(d.edition_track_lists);
    if (!eds.length)
        return shared.length;
    const totals = eds.map((e) => shared.length + e.track_list.length);
    return Math.max(shared.length, ...totals);
}
/** True when the row exposes no playable track titles (counts gap reports / UI placeholders). */
function discMissingTrackPayload(d) {
    if (discMaxTrackSlotCount(d) > 0)
        return false;
    const tsu = d.track_song_uids;
    return !(Array.isArray(tsu) && tsu.some((x) => String(x ?? "").trim()));
}
function summarizeEditionTrackTotals(d) {
    const shared = normalizeStrings(d.shared_track_list);
    const eds = normalizeEditionTrackLists(d.edition_track_lists);
    if (!eds.length)
        return "";
    const parts = eds.map((e) => {
        const n = shared.length + e.track_list.length;
        return `${e.label}:${n}`;
    });
    return parts.join(" · ");
}
