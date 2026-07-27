/**
 * Optional refinements on `songs.json` rows after storefront import:
 * - {@link SongCatalogTitles.title_variant} — e.g. LIVE / remaster subtitles
 * - {@link SongCatalogTitles.title_listed} — original storefront title for fuzzy matching saves
 * - {@link SongCatalogTitles.solo_track} + {@link SongCatalogTitles.solo_member_*} — member solo under the group's catalog
 *
 * Streaming / preview links (pilot: アキシブproject; optional elsewhere):
 * - `apple_music_url`, `spotify_url` — open-in-app / storefront pages
 * - `apple_preview_url`, `spotify_preview_url` — ~30s audio clips for in-game preview
 */

export type SongCatalogTitles = {
  title_variant?: unknown;
  title_listed?: unknown;
  solo_track?: unknown;
  solo_member_uid?: unknown;
  solo_member_name?: unknown;
};

/** Optional storefront + preview URLs on a song row. */
export type SongStreamingLinks = {
  apple_music_url?: string | null;
  apple_preview_url?: string | null;
  spotify_url?: string | null;
  spotify_preview_url?: string | null;
  youtube_url?: string | null;
};

export function trimCatalogStr(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

/** Main song name after refinement (typically `title` in JSON). */
export function songCatalogPrimaryTitle(row: Record<string, unknown>): string {
  return trimCatalogStr(row.title ?? row.title_romanji ?? "");
}

/** Listed / picker label shown in browse UI and new live-program rows. */
export function songCatalogDisplayLabel(row: Record<string, unknown>): string {
  const base = songCatalogPrimaryTitle(row);
  if (!base) return trimCatalogStr(row.uid ?? "");
  const variant = trimCatalogStr(row.title_variant);
  const withVariant = variant ? `${base} (${variant})` : base;
  if (row.solo_track === true) {
    const whom = trimCatalogStr(row.solo_member_name);
    if (whom) return `${withVariant} · Solo (${whom})`;
  }
  return withVariant;
}

function addIf_nonempty(set: Set<string>, s: string): void {
  const t = s.trim();
  if (t) set.add(t);
}

/** Alternate strings saved in older presets / Apple-style titles; used for lookups. */
export function songCatalogPickAliases(row: Record<string, unknown>): string[] {
  const set = new Set<string>();
  const primary = songCatalogPrimaryTitle(row);
  addIf_nonempty(set, songCatalogDisplayLabel(row));
  addIf_nonempty(set, primary);

  const listed = trimCatalogStr(row.title_listed);
  addIf_nonempty(set, listed);

  const variant = trimCatalogStr(row.title_variant);
  if (primary && variant) addIf_nonempty(set, `${primary} (${variant})`);

  if (row.solo_track === true) {
    const whom = trimCatalogStr(row.solo_member_name);
    if (primary && whom) addIf_nonempty(set, `${primary} (${whom})`);
  }

  const rawTitle = trimCatalogStr(row.title);
  addIf_nonempty(set, rawTitle);

  const rawRomanji = trimCatalogStr(row.title_romanji);
  addIf_nonempty(set, rawRomanji);

  return [...set];
}

export function songCatalogMatchesPick(stored: string, row: Record<string, unknown>): boolean {
  const n = trimCatalogStr(stored);
  if (!n) return false;
  return songCatalogPickAliases(row).includes(n);
}
