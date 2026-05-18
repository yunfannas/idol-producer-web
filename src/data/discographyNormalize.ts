/**
 * Normalize group.json discography rows: legacy flat {@link GroupDiscRelease.track_list},
 * or {@link GroupDiscRelease.shared_track_list} + {@link GroupDiscRelease.edition_track_lists} for CD/DVD variants.
 */

export interface EditionTrackList {
  label: string;
  track_list: string[];
}

export interface GroupDiscRelease {
  uid?: string;
  title?: string;
  title_romanji?: string;
  disc_type?: string;
  release_date?: string;
  /** Full listing when the release has no type variants (backwards compatible). */
  track_list?: string[];
  /** Tracks appearing on every edition; never repeat variant names in {@link GroupDiscRelease.title}. */
  shared_track_list?: string[];
  /**
   * Per-edition-exclusive tracks appended after shared order (DVD types, coupling-only differences, etc.).
   * Labels are display-only (“Type A CD”), not appended to {@link GroupDiscRelease.title}.
   */
  edition_track_lists?: EditionTrackList[];
  track_song_uids?: string[];
  duration?: unknown;
  publisher?: string;
}

function normalizeStrings(arr: unknown): string[] {
  if (!Array.isArray(arr)) return [];
  return arr.map((x) => String(x ?? "").trim()).filter(Boolean);
}

function normalizeEditionTrackLists(raw: unknown): EditionTrackList[] {
  if (!Array.isArray(raw)) return [];
  const out: EditionTrackList[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const label = String(o.label ?? "").trim() || "Edition";
    const tl = normalizeStrings(o.track_list);
    out.push({ label, track_list: tl });
  }
  return out;
}

/** True when the row stores shared + edition-specific track lists (any editions defined). */
export function discUsesEditionTrackLayout(d: Record<string, unknown>): boolean {
  return normalizeEditionTrackLists(d.edition_track_lists).length > 0;
}

/** Prefer legacy flat {@link GroupDiscRelease.track_list} unless edition layout overrides. */
export function effectiveSharedTracks(d: Record<string, unknown>): string[] {
  if (discUsesEditionTrackLayout(d)) return normalizeStrings(d.shared_track_list);
  return normalizeStrings(d.track_list);
}

export function effectiveEditionSlices(d: Record<string, unknown>): EditionTrackList[] {
  return normalizeEditionTrackLists(d.edition_track_lists);
}

/** Max track count among editions (shared + edition-only); legacy uses flat {@link GroupDiscRelease.track_list} length only. */
export function discMaxTrackSlotCount(d: Record<string, unknown>): number {
  const legacyFlat = normalizeStrings(d.track_list);
  if (!discUsesEditionTrackLayout(d)) return legacyFlat.length;

  const shared = normalizeStrings(d.shared_track_list);
  const eds = normalizeEditionTrackLists(d.edition_track_lists);
  if (!eds.length) return shared.length;
  const totals = eds.map((e) => shared.length + e.track_list.length);
  return Math.max(shared.length, ...totals);
}

/** True when the row exposes no playable track titles (counts gap reports / UI placeholders). */
export function discMissingTrackPayload(d: Record<string, unknown>): boolean {
  if (discMaxTrackSlotCount(d) > 0) return false;
  const tsu = d.track_song_uids;
  return !(Array.isArray(tsu) && tsu.some((x) => String(x ?? "").trim()));
}

export function summarizeEditionTrackTotals(d: Record<string, unknown>): string {
  const shared = normalizeStrings(d.shared_track_list);
  const eds = normalizeEditionTrackLists(d.edition_track_lists);
  if (!eds.length) return "";
  const parts = eds.map((e) => {
    const n = shared.length + e.track_list.length;
    return `${e.label}:${n}`;
  });
  return parts.join(" · ");
}
