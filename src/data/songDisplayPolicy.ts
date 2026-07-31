/**
 * Which songs appear in lists / counts / live novelty, and how they sort for display.
 */

import {
  discUsesEditionTrackLayout,
  effectiveEditionSlices,
  effectiveSharedTracks,
} from "./discographyNormalize";
import { songCatalogPrimaryTitle } from "./songCatalog";


function normalizeSongTitleForMatch(title: string): string {
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
] as const;

function liveVariantBaseTitle(title: string): string | null {
  const trimmed = String(title ?? "").trim();
  if (!trimmed) return null;
  for (const [open, close] of [["(", ")"], ["（", "）"], ["[", "]"]] as const) {
    if (!trimmed.endsWith(close)) continue;
    const start = trimmed.lastIndexOf(open);
    if (start <= 0) continue;
    const suffix = trimmed.slice(start + open.length, trimmed.length - close.length).trim();
    const suffixNorm = normalizeSongTitleForMatch(suffix).toLowerCase();
    if (!suffixNorm) continue;
    if (!LIVE_VARIANT_SUFFIX_MARKERS.some((marker) => suffixNorm.includes(marker))) continue;
    const base = trimmed.slice(0, start).trim();
    if (base) return base;
  }
  return null;
}

function isManagedLivePerformanceDuplicate(
  row: Record<string, unknown>,
  allSongs: readonly Record<string, unknown>[] | null | undefined,
): boolean {
  const groupUid = String(row.group_uid ?? "").trim();
  if (groupUid !== "PUxPVkU") return false;
  if (!Array.isArray(allSongs) || !allSongs.length) return false;
  const base = liveVariantBaseTitle(songCatalogPrimaryTitle(row));
  if (!base) return false;
  const baseNorm = normalizeSongTitleForMatch(base);
  const rowUid = String(row.uid ?? "").trim();
  for (const candidate of allSongs) {
    if (!candidate || typeof candidate !== "object") continue;
    if (candidate.hidden === true) continue;
    const candidateUid = String(candidate.uid ?? "").trim();
    if (candidateUid === rowUid) continue;
    if (String(candidate.group_uid ?? "").trim() !== groupUid) continue;
    if (normalizeSongTitleForMatch(songCatalogPrimaryTitle(candidate)) === baseNorm) return true;
  }
  return false;
}

export function isSongHiddenFromDisplay(
  row: Record<string, unknown>,
  allSongs?: readonly Record<string, unknown>[] | null,
): boolean {
  if (row.hidden === true) return true;
  const title = String(row.title ?? "").trim();
  if (isManagedLivePerformanceDuplicate(row, allSongs)) return true;
  if (title.includes("三百六十五歩のマーチ")) return true;
  return false;
}

function specialSongAvailabilityIso(row: Record<string, unknown>): string | null {
  const uid = String(row.uid ?? "").trim();
  if (uid === "d3b51910-0f40-4e75-9413-4f3762fbf110") return "2026-01-01";
  return null;
}

export function songPopularityNum(row: Record<string, unknown>): number {
  for (const key of ["popularity", "popularity_local", "popularity_global"] as const) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return 0;
}

/** Parse `YYYY-MM-DD` (or ISO prefix) to UTC noon ms; invalid -> `null`. */
export function parseCatalogIsoToTime(iso: string | null | undefined): number | null {
  const s = String(iso ?? "").trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = new Date(`${s}T12:00:00Z`).getTime();
  return Number.isFinite(t) ? t : null;
}

function songAvailabilityTime(row: Record<string, unknown>): number {
  return parseCatalogIsoToTime(specialSongAvailabilityIso(row) ?? String(row.release_date ?? "")) ?? 0;
}

export function isSongAvailableOn(row: Record<string, unknown>, referenceIso: string | null | undefined): boolean {
  const refT = parseCatalogIsoToTime(referenceIso);
  if (refT == null) return true;
  return songAvailabilityTime(row) <= refT;
}

/** Row has no parseable availability date, or it is strictly after `referenceIso` (desktop "Making"). */
export function splitSongsReleasedVsMaking(
  teamSongs: Record<string, unknown>[],
  referenceIso: string | null | undefined,
): { released: Record<string, unknown>[]; making: Record<string, unknown>[] } {
  const refT = parseCatalogIsoToTime(referenceIso);
  if (refT == null) {
    return { released: teamSongs, making: [] };
  }
  const released: Record<string, unknown>[] = [];
  const making: Record<string, unknown>[] = [];
  for (const row of teamSongs) {
    const rowT = songAvailabilityTime(row);
    if (rowT == null || rowT > refT) making.push(row);
    else released.push(row);
  }
  return { released, making };
}

/** Drop display-hidden rows, then popularity descending (ties: newer availability first). */
export function songsForDisplaySorted(all: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...all]
    .filter((r) => !isSongHiddenFromDisplay(r, all))
    .sort((a, b) => {
      const pa = songPopularityNum(a);
      const pb = songPopularityNum(b);
      if (pb !== pa) return pb - pa;
      return songAvailabilityTime(b) - songAvailabilityTime(a);
    });
}

/** Strip Apple packaging / CD type-variant suffixes so A/B/C editions share one disc bucket. */
export function packagingDiscReleaseLabel(name: string): string {
  let s = String(name ?? "")
    .normalize("NFKC")
    .trim();
  if (!s) return "";
  s = s.replace(/\s*[-–—]\s*(Single|EP|Album|Mini Album|Best Album|Digital Single)\s*$/i, "");
  s = s.replace(/\s*[\(（][^）)]*(TYPE|Type|タイプ)[-‐\s]?[A-Z0-9]+[^）)]*[\)）]\s*/gi, " ");
  s = s.replace(/\s*[\(（]\s*[A-E]\s*[\)）]\s*/gi, " ");
  s = s.replace(/\s+[ABCDE]-?Types?\b/gi, " ");
  s = s.replace(/\s+(初回盤|通常盤|限定盤|期間限定盤)\b/gi, " ");
  s = s.replace(/\s*(Special Edition|Deluxe Edition)\s*/gi, " ");
  return s.replace(/\s+/g, " ").trim();
}

/** Base title for matching — also strips group compilation edition suffixes like "(アキシブproject ver.)". */
export function baseDiscReleaseLabel(name: string): string {
  let s = packagingDiscReleaseLabel(name);
  if (!s) return "";
  s = s.replace(/\s*[\(（][^）)]*?ver\.?\s*[\)）]\s*$/i, "");
  return s.replace(/\s+/g, " ").trim();
}

/** Match a song-list Disc label to a curated / inferred discography row key. */
export function findDiscographyKeyForDiscLabel(
  discLabel: string,
  curatedRows?: GroupDiscographyReleaseRow[] | null,
  buckets?: DiscBucket[] | null,
): string | null {
  const raw = String(discLabel ?? "").trim();
  if (!raw || raw === "—") return null;
  const target = baseDiscReleaseLabel(raw).toLowerCase();
  if (!target) return null;
  for (const row of curatedRows ?? []) {
    if (row.selectable === false) continue;
    const titleBase = baseDiscReleaseLabel(row.title).toLowerCase();
    if (titleBase === target || row.title.trim().toLowerCase() === raw.toLowerCase()) return row.key;
  }
  for (const bucket of buckets ?? []) {
    const labelBase = baseDiscReleaseLabel(bucket.label).toLowerCase();
    if (labelBase === target || bucket.label.trim().toLowerCase() === raw.toLowerCase() || bucket.key === raw) {
      return bucket.key;
    }
  }
  return null;
}

/** Primary disc / album label for UI (first non-empty `albums[].name`, else disc_type / stub). */
export function primaryDiscLabel(row: Record<string, unknown>): string {
  const albums = Array.isArray(row.albums) ? row.albums : [];
  for (const raw of albums) {
    if (!raw || typeof raw !== "object") continue;
    const name = String((raw as Record<string, unknown>).name ?? "").trim();
    if (name) return packagingDiscReleaseLabel(name) || name;
  }
  const rdu = row.disc_uid;
  if (rdu != null && String(rdu).trim()) {
    const s = String(rdu).trim();
    return `Disc ${s.slice(0, 8)}…`;
  }
  const dt = String(row.disc_type ?? "").trim();
  if (dt) return dt;
  return "—";
}

/** Stable bucket id for grouping tracks onto disc tabs. */
export function discBucketKey(row: Record<string, unknown>): string {
  const albums = Array.isArray(row.albums) ? row.albums : [];
  for (const raw of albums) {
    if (!raw || typeof raw !== "object") continue;
    const du = (raw as Record<string, unknown>).disc_uid;
    if (du != null && String(du).trim()) return `u:${String(du).trim()}`;
  }
  const rootDu = row.disc_uid;
  if (rootDu != null && String(rootDu).trim()) return `u:${String(rootDu).trim()}`;
  const lab = primaryDiscLabel(row);
  if (lab && lab !== "—") return `n:${lab}`;
  const rd = String(row.release_date ?? "").split("T")[0];
  const uid = String(row.uid ?? "");
  return `t:${rd}|${uid}`;
}

export interface DiscBucket {
  key: string;
  label: string;
  songs: Record<string, unknown>[];
}

/** One discography track line: always has a display title; `songUid` when linked to `songs.json`. */
export interface GroupDiscographyTrackRef {
  title: string;
  songUid: string | null;
  /** Owning group when this track appears on another group's shared/compilation edition. */
  originGroupUid?: string | null;
  originGroupName?: string | null;
}

export interface GroupDiscographyTrackSection {
  label: string;
  tracks: GroupDiscographyTrackRef[];
}

export interface GroupDiscographyReleaseRow {
  key: string;
  title: string;
  discType: string;
  releaseDate: string;
  trackCount: number;
  trackSections: GroupDiscographyTrackSection[];
  /** False for video discs (DVD/BD): listed in discography but not selectable for track detail. */
  selectable: boolean;
}

function normalizeDiscTrackTitleKey(title: string): string {
  return String(title ?? "")
    .normalize("NFKC")
    .replace(/[！]/g, "!")
    .replace(/[☆★]/g, "☆")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactDiscTrackTitleKey(title: string): string {
  return normalizeDiscTrackTitleKey(title).replace(/[\s☆・．.。、,!！？?～~―\-－_/／()（）「」『』[\]【】"'`]/g, "");
}

/** Build title→song lookup for a group's catalog (exact + compact keys). */
export function buildSongTitleLookup(
  songs: readonly Record<string, unknown>[] | null | undefined,
  groupUid?: string | null,
): Map<string, Record<string, unknown>> {
  const lookup = new Map<string, Record<string, unknown>>();
  const gid = String(groupUid ?? "").trim();
  for (const row of songs ?? []) {
    if (!row || typeof row !== "object") continue;
    if (gid && String(row.group_uid ?? "").trim() !== gid) continue;
    const uid = String(row.uid ?? "").trim();
    if (!uid) continue;
    const titles = [
      String(row.title ?? "").trim(),
      String(row.title_romanji ?? "").trim(),
      songCatalogPrimaryTitle(row),
    ].filter(Boolean);
    for (const title of titles) {
      const exact = normalizeDiscTrackTitleKey(title);
      const compact = compactDiscTrackTitleKey(title);
      if (exact && !lookup.has(`e:${exact}`)) lookup.set(`e:${exact}`, row);
      if (compact && !lookup.has(`c:${compact}`)) lookup.set(`c:${compact}`, row);
    }
  }
  return lookup;
}

function matchSongForDiscTrackTitle(
  title: string,
  lookup: Map<string, Record<string, unknown>>,
  songByUid: Map<string, Record<string, unknown>>,
  preferredUid?: string | null,
): Record<string, unknown> | null {
  const pref = String(preferredUid ?? "").trim();
  if (pref && songByUid.has(pref)) {
    // Curated track_song_uids are authoritative (compilations often point at other groups' songs).
    return songByUid.get(pref) ?? null;
  }
  const exact = normalizeDiscTrackTitleKey(title);
  const compact = compactDiscTrackTitleKey(title);
  if (exact && lookup.has(`e:${exact}`)) return lookup.get(`e:${exact}`) ?? null;
  if (compact && lookup.has(`c:${compact}`)) return lookup.get(`c:${compact}`) ?? null;
  // Soft prefix: disc title "Creaction" ↔ catalog "Creaction (2019 ver.)"
  if (compact) {
    for (const [key, row] of lookup) {
      if (!key.startsWith("c:")) continue;
      const cand = key.slice(2);
      if (cand.startsWith(compact) || compact.startsWith(cand)) return row;
    }
  }
  return null;
}

function resolveTrackRefs(
  titles: string[],
  lookup: Map<string, Record<string, unknown>>,
  songByUid: Map<string, Record<string, unknown>>,
  preferredUids?: string[] | null,
): GroupDiscographyTrackRef[] {
  const prefs = Array.isArray(preferredUids) ? preferredUids : [];
  return titles.map((title, index) => {
    const preferred = prefs[index] ?? null;
    const matched = matchSongForDiscTrackTitle(title, lookup, songByUid, preferred);
    const songUid = matched ? String(matched.uid ?? "").trim() || null : null;
    const display =
      songUid && matched
        ? songCatalogPrimaryTitle(matched) || title
        : title;
    return { title: display, songUid };
  });
}

function resolveTrackRefsFromUids(
  uids: string[],
  songByUid: Map<string, Record<string, unknown>>,
): GroupDiscographyTrackRef[] {
  const out: GroupDiscographyTrackRef[] = [];
  for (const raw of uids) {
    const uid = String(raw ?? "").trim();
    if (!uid) continue;
    const matched = songByUid.get(uid);
    if (matched) {
      out.push({
        title: songCatalogPrimaryTitle(matched) || uid,
        songUid: uid,
      });
    }
  }
  return out;
}

function effectiveSharedReleaseTrackCount(
  release: Record<string, unknown>,
  groupUid: string,
): number {
  const sharedSongUids = Array.isArray(release.shared_track_song_uids)
    ? release.shared_track_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const sharedTrackList = Array.isArray(release.shared_track_list)
    ? release.shared_track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const sharedCount = Math.max(sharedSongUids.length, sharedTrackList.length);
  const editions = Array.isArray(release.group_editions)
    ? release.group_editions.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
  const edition = editions.find((row) => String(row.group_uid ?? "").trim() === groupUid) ?? null;
  if (!edition) return sharedCount;
  const editionSongUids = Array.isArray(edition.track_song_uids)
    ? edition.track_song_uids.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const editionTrackList = Array.isArray(edition.track_list)
    ? edition.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  return sharedCount + Math.max(editionSongUids.length, editionTrackList.length);
}

function trackSectionsFromLocalRelease(
  row: Record<string, unknown>,
  lookup: Map<string, Record<string, unknown>>,
  songByUid: Map<string, Record<string, unknown>>,
  viewingGroupUid: string,
): GroupDiscographyTrackSection[] {
  const releaseTitle = String(row.title ?? row.title_romanji ?? "").trim();
  const showOrigins = isSharedCompilationAlbumTitle(releaseTitle);
  const annotate = (tracks: GroupDiscographyTrackRef[]) =>
    withTrackOriginGroups(tracks, songByUid, viewingGroupUid, showOrigins);

  if (discUsesEditionTrackLayout(row)) {
    const sections: GroupDiscographyTrackSection[] = [];
    const sharedTracks = effectiveSharedTracks(row);
    const sharedUids = Array.isArray(row.shared_track_song_uids)
      ? row.shared_track_song_uids.map((x) => String(x ?? "").trim())
      : [];
    if (sharedTracks.length) {
      sections.push({
        label: "Shared tracks",
        tracks: annotate(resolveTrackRefs(sharedTracks, lookup, songByUid, sharedUids)),
      });
    }
    for (const edition of effectiveEditionSlices(row)) {
      if (!edition.track_list.length) continue;
      sections.push({
        label: edition.label,
        tracks: annotate(resolveTrackRefs(edition.track_list, lookup, songByUid)),
      });
    }
    return sections;
  }
  const trackList = Array.isArray(row.track_list)
    ? row.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const trackSongUids = Array.isArray(row.track_song_uids)
    ? row.track_song_uids.map((x) => String(x ?? "").trim())
    : [];
  if (trackList.length) {
    return [{ label: "Tracks", tracks: annotate(resolveTrackRefs(trackList, lookup, songByUid, trackSongUids)) }];
  }
  if (trackSongUids.some(Boolean)) {
    return [{ label: "Tracks", tracks: annotate(resolveTrackRefsFromUids(trackSongUids.filter(Boolean), songByUid)) }];
  }
  return [];
}

function trackSectionsFromSharedRelease(
  release: Record<string, unknown>,
  groupUid: string,
  lookup: Map<string, Record<string, unknown>>,
  songByUid: Map<string, Record<string, unknown>>,
): GroupDiscographyTrackSection[] {
  const releaseTitle = String(release.title ?? release.title_romanji ?? "").trim();
  const showOrigins = isSharedCompilationAlbumTitle(releaseTitle);
  const annotate = (tracks: GroupDiscographyTrackRef[]) =>
    withTrackOriginGroups(tracks, songByUid, groupUid, showOrigins);

  const sections: GroupDiscographyTrackSection[] = [];
  const sharedTracks = Array.isArray(release.shared_track_list)
    ? release.shared_track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const sharedUids = Array.isArray(release.shared_track_song_uids)
    ? release.shared_track_song_uids.map((x) => String(x ?? "").trim())
    : [];
  if (sharedTracks.length) {
    sections.push({
      label: "Shared tracks",
      tracks: annotate(resolveTrackRefs(sharedTracks, lookup, songByUid, sharedUids)),
    });
  }
  const editions = Array.isArray(release.group_editions)
    ? release.group_editions.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
  const edition = editions.find((row) => String(row.group_uid ?? "").trim() === groupUid) ?? null;
  if (!edition) return sections;
  const editionTracks = Array.isArray(edition.track_list)
    ? edition.track_list.map((x) => String(x ?? "").trim()).filter(Boolean)
    : [];
  const editionUids = Array.isArray(edition.track_song_uids)
    ? edition.track_song_uids.map((x) => String(x ?? "").trim())
    : [];
  if (!editionTracks.length) {
    if (editionUids.some(Boolean)) {
      const label = String(edition.edition_label ?? edition.group_name ?? "Edition").trim() || "Edition";
      sections.push({ label, tracks: annotate(resolveTrackRefsFromUids(editionUids.filter(Boolean), songByUid)) });
    }
    return sections;
  }
  const label = String(edition.edition_label ?? edition.group_name ?? "Edition").trim() || "Edition";
  sections.push({ label, tracks: annotate(resolveTrackRefs(editionTracks, lookup, songByUid, editionUids)) });
  return sections;
}

function sectionTrackCount(sections: GroupDiscographyTrackSection[]): number {
  return sections.reduce((sum, section) => sum + section.tracks.length, 0);
}

/** Live / concert video products — catalog footnotes, not the main single/album structure. */
export function isVideoDiscRelease(row: Record<string, unknown> | null | undefined): boolean {
  if (!row || typeof row !== "object") return false;
  const raw = String(row.disc_type ?? "").trim();
  if (/^(video|dvd\/bd|dvd|blu-?ray|bd)$/i.test(raw)) return true;
  const title = String(row.title ?? row.title_romanji ?? "").trim();
  if (
    /^(cd|blu-ray|dvd)$/i.test(raw) &&
    /(concert|tour|arena|anniversary|live|卒業コンサート|プレミアム|premium|武道館)/i.test(title)
  ) {
    return true;
  }
  return false;
}

function normalizeDiscographyTypeLabel(row: Record<string, unknown>): string {
  if (isVideoDiscRelease(row)) return "Video";
  const raw = String(row.disc_type ?? "").trim();
  if (/^digital single$/i.test(raw)) return "Digital Single";
  if (/^album$/i.test(raw)) return "Album";
  if (/^single$/i.test(raw)) return "Single";
  if (/^(best album|mini album|ep)$/i.test(raw)) return raw;
  if (/^(cd)$/i.test(raw)) return "CD";
  return raw || "—";
}

/** Shared multi-group compilations (e.g. HEROINES ALBUM 2025 editions). */
export function isSharedCompilationAlbumTitle(title: string): boolean {
  const base = baseDiscReleaseLabel(title);
  return /heroines\s+album\s+2025/i.test(base);
}

function withTrackOriginGroups(
  tracks: GroupDiscographyTrackRef[],
  songByUid: Map<string, Record<string, unknown>>,
  viewingGroupUid: string,
  enabled: boolean,
): GroupDiscographyTrackRef[] {
  if (!enabled) return tracks;
  const gid = String(viewingGroupUid ?? "").trim();
  return tracks.map((track) => {
    const song = track.songUid ? songByUid.get(track.songUid) : null;
    if (!song) return { ...track, originGroupUid: null, originGroupName: null };
    const originGroupUid = String(song.group_uid ?? "").trim() || null;
    const originGroupName = String(song.group_name ?? "").trim() || null;
    if (!originGroupUid || (gid && originGroupUid === gid)) {
      return { ...track, originGroupUid: null, originGroupName: null };
    }
    return {
      ...track,
      originGroupUid,
      originGroupName: originGroupName || originGroupUid,
    };
  });
}

export function buildGroupDiscographyReleaseRows(
  group: Record<string, unknown> | null | undefined,
  referenceIso: string | null | undefined,
  sharedReleases?: Record<string, unknown>[] | null,
  catalogSongs?: readonly Record<string, unknown>[] | null,
): GroupDiscographyReleaseRow[] {
  const rawDisc = Array.isArray(group?.discography)
    ? (group!.discography as unknown[]).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    : [];
  const groupUid = String(group?.uid ?? "").trim();
  const lookup = buildSongTitleLookup(catalogSongs, groupUid);
  const songByUid = new Map<string, Record<string, unknown>>();
  for (const row of catalogSongs ?? []) {
    const uid = String(row?.uid ?? "").trim();
    if (uid) songByUid.set(uid, row);
  }
  const sharedReleaseUids = Array.isArray((group as { shared_release_uids?: unknown } | null)?.shared_release_uids)
    ? ((group as { shared_release_uids: unknown[] }).shared_release_uids
        .map((uid) => String(uid ?? "").trim())
        .filter(Boolean))
    : [];
  const rawShared = Array.isArray(sharedReleases)
    ? sharedReleases.filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
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
      if (refT == null || rel == null) return true;
      return rel <= refT;
    })
    .map((row, index) => {
      const title = String(row.title ?? row.title_romanji ?? "").trim() || "—";
      const releaseDate = String(row.release_date ?? "").split("T")[0].trim() || "—";
      const trackSections = trackSectionsFromLocalRelease(row, lookup, songByUid, groupUid);
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
        trackCount: Math.max(sectionTrackCount(trackSections), trackSongUids.length, trackList.length),
        trackSections,
        selectable: !isVideoDiscRelease(row),
      } satisfies GroupDiscographyReleaseRow;
    });
  const sharedRows = sharedDisc
    .filter((row) => {
      const rel = parseCatalogIsoToTime(String(row.release_date ?? ""));
      if (refT == null || rel == null) return true;
      return rel <= refT;
    })
    .map((row) => {
      const title = String(row.title ?? row.title_romanji ?? "").trim() || "—";
      const releaseDate = String(row.release_date ?? "").split("T")[0].trim() || "—";
      const trackSections = trackSectionsFromSharedRelease(row, groupUid, lookup, songByUid);
      return {
        key: `shared:${String(row.uid ?? "").trim() || title}`,
        title,
        discType: normalizeDiscographyTypeLabel(row),
        releaseDate,
        trackCount: Math.max(sectionTrackCount(trackSections), effectiveSharedReleaseTrackCount(row, groupUid)),
        trackSections,
        selectable: !isVideoDiscRelease(row),
      } satisfies GroupDiscographyReleaseRow;
    });
  return dedupeDiscographyReleaseRows([...localRows, ...sharedRows]).sort((a, b) => {
    // Singles/albums first; video discs listed after as additional catalog rows.
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
    const ad = parseCatalogIsoToTime(a.releaseDate) ?? 0;
    const bd = parseCatalogIsoToTime(b.releaseDate) ?? 0;
    if (ad !== bd) return ad - bd;
    return a.title.localeCompare(b.title, "ja");
  });
}

function discographyReleaseDedupeKey(row: GroupDiscographyReleaseRow): string {
  const base = baseDiscReleaseLabel(row.title) || row.title;
  return base.normalize("NFKC").trim().toLowerCase();
}

function discographyReleaseRichness(row: GroupDiscographyReleaseRow): number {
  const linked = row.trackSections.reduce(
    (n, section) => n + section.tracks.filter((track) => Boolean(track.songUid)).length,
    0,
  );
  // Prefer denser tracklists; break ties toward local (non-shared) rows.
  return linked * 1000 + row.trackCount * 10 + (row.key.startsWith("shared:") ? 0 : 1);
}

function preferredDiscographyTitle(a: string, b: string): string {
  if (a.toUpperCase() === b.toUpperCase()) {
    if (/ALBUM/.test(a)) return a;
    if (/ALBUM/.test(b)) return b;
  }
  return a;
}

/** Collapse local + shared duplicates that only differ by casing / edition suffix.
 * Prefer local group editions over incomplete shared stubs (e.g. HEROINES ALBUM). */
function dedupeDiscographyReleaseRows(rows: GroupDiscographyReleaseRow[]): GroupDiscographyReleaseRow[] {
  const localBases = new Set(
    rows.filter((row) => !row.key.startsWith("shared:")).map((row) => discographyReleaseDedupeKey(row)).filter(Boolean),
  );
  const filtered = rows.filter((row) => {
    if (!row.key.startsWith("shared:")) return true;
    const key = discographyReleaseDedupeKey(row);
    // Drop shared when this group already has a local edition of the same release.
    return !key || !localBases.has(key);
  });

  const best = new Map<string, GroupDiscographyReleaseRow>();
  for (const row of filtered) {
    const key = discographyReleaseDedupeKey(row);
    const mapKey = key || `__raw:${row.key}`;
    const prev = best.get(mapKey);
    if (!prev) {
      best.set(mapKey, row);
      continue;
    }
    // Never merge different group editions into one row — only case-only duplicates.
    const sameCaseFold = prev.title.toUpperCase() === row.title.toUpperCase();
    if (!sameCaseFold) {
      // Keep both when titles still differ after base key collision (shouldn't happen often).
      best.set(`${mapKey}::${row.key}`, row);
      continue;
    }
    const richer = discographyReleaseRichness(row) >= discographyReleaseRichness(prev) ? row : prev;
    const other = richer === row ? prev : row;
    best.set(mapKey, {
      ...richer,
      title: preferredDiscographyTitle(richer.title, other.title),
    });
  }
  return [...best.values()];
}

/** One entry per disc bucket; songs sorted by popularity within bucket. */
export function buildDiscBuckets(teamSongs: Record<string, unknown>[]): DiscBucket[] {
  const m = new Map<string, { label: string; songs: Record<string, unknown>[] }>();
  for (const row of teamSongs) {
    const key = discBucketKey(row);
    const label = primaryDiscLabel(row);
    if (!m.has(key)) m.set(key, { label, songs: [] });
    m.get(key)!.songs.push(row);
  }
  for (const v of m.values()) {
    v.songs.sort((a, b) => songPopularityNum(b) - songPopularityNum(a));
  }
  return [...m.entries()]
    .map(([key, v]) => ({ key, label: v.label, songs: v.songs }))
    .sort((a, b) => a.label.localeCompare(b.label, "ja"));
}
