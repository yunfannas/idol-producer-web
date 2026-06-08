"use strict";
/**
 * Optional refinements on `songs.json` rows after storefront import:
 * - {@link SongCatalogTitles.title_variant} — e.g. LIVE / remaster subtitles
 * - {@link SongCatalogTitles.title_listed} — original storefront title for fuzzy matching saves
 * - {@link SongCatalogTitles.solo_track} + {@link SongCatalogTitles.solo_member_*} — member solo under the group's catalog
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.trimCatalogStr = trimCatalogStr;
exports.songCatalogPrimaryTitle = songCatalogPrimaryTitle;
exports.songCatalogDisplayLabel = songCatalogDisplayLabel;
exports.songCatalogPickAliases = songCatalogPickAliases;
exports.songCatalogMatchesPick = songCatalogMatchesPick;
function trimCatalogStr(x) {
    return typeof x === "string" ? x.trim() : "";
}
/** Main song name after refinement (typically `title` in JSON). */
function songCatalogPrimaryTitle(row) {
    return trimCatalogStr(row.title ?? row.title_romanji ?? "");
}
/** Listed / picker label shown in browse UI and new live-program rows. */
function songCatalogDisplayLabel(row) {
    const base = songCatalogPrimaryTitle(row);
    if (!base)
        return trimCatalogStr(row.uid ?? "");
    const variant = trimCatalogStr(row.title_variant);
    const withVariant = variant ? `${base} (${variant})` : base;
    if (row.solo_track === true) {
        const whom = trimCatalogStr(row.solo_member_name);
        if (whom)
            return `${withVariant} · Solo (${whom})`;
    }
    return withVariant;
}
function addIf_nonempty(set, s) {
    const t = s.trim();
    if (t)
        set.add(t);
}
/** Alternate strings saved in older presets / Apple-style titles; used for lookups. */
function songCatalogPickAliases(row) {
    const set = new Set();
    const primary = songCatalogPrimaryTitle(row);
    addIf_nonempty(set, songCatalogDisplayLabel(row));
    addIf_nonempty(set, primary);
    const listed = trimCatalogStr(row.title_listed);
    addIf_nonempty(set, listed);
    const variant = trimCatalogStr(row.title_variant);
    if (primary && variant)
        addIf_nonempty(set, `${primary} (${variant})`);
    if (row.solo_track === true) {
        const whom = trimCatalogStr(row.solo_member_name);
        if (primary && whom)
            addIf_nonempty(set, `${primary} (${whom})`);
    }
    const rawTitle = trimCatalogStr(row.title);
    addIf_nonempty(set, rawTitle);
    const rawRomanji = trimCatalogStr(row.title_romanji);
    addIf_nonempty(set, rawRomanji);
    return [...set];
}
function songCatalogMatchesPick(stored, row) {
    const n = trimCatalogStr(stored);
    if (!n)
        return false;
    return songCatalogPickAliases(row).includes(n);
}
