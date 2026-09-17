/**
 * Runtime palette model.
 *
 * L2B owns the lyric-derived `palette_direction` stored on catalog songs.  The
 * game only consumes that audited result: L3 derives an opening prior from the
 * songs available at the scenario date, then released player work gradually
 * evolves the developed Team Palette.
 */

export const PALETTE_COLORS = [
  "red",
  "orange",
  "yellow",
  "white",
  "green",
  "aqua",
  "blue",
  "purple",
  "black",
  "pink",
] as const;

export type PaletteColor = (typeof PALETTE_COLORS)[number];
export type PaletteVector = Record<PaletteColor, number>;

export interface TeamPaletteState {
  direction: PaletteVector;
  /** `l3_catalog_prior` is an opening aggregate; `developed` has player work. */
  source: "l3_catalog_prior" | "neutral_default" | "developed";
  released_song_uids: string[];
  updated_on: string | null;
}

const NEUTRAL_DEFAULT: PaletteVector = {
  red: 0.08,
  orange: 0.1,
  yellow: 0.1,
  green: 0.1,
  aqua: 0.1,
  blue: 0.1,
  purple: 0.1,
  pink: 0.12,
  white: 0.12,
  black: 0.08,
};

export const PALETTE_COLOR_HEX: Record<PaletteColor, string> = {
  red: "#e75b5b",
  orange: "#ef9b46",
  yellow: "#e5cf48",
  green: "#57b772",
  aqua: "#4fbfc2",
  blue: "#558bd8",
  purple: "#9866c9",
  pink: "#e77fae",
  white: "#e6e9ec",
  black: "#30343b",
};

function finiteNonnegative(value: unknown): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : 0;
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

export function normalizePalette(input: Partial<Record<PaletteColor, unknown>> | null | undefined): PaletteVector {
  const raw = Object.fromEntries(PALETTE_COLORS.map((color) => [color, finiteNonnegative(input?.[color])])) as PaletteVector;
  const total = PALETTE_COLORS.reduce((sum, color) => sum + raw[color], 0);
  if (total <= 0) return { ...NEUTRAL_DEFAULT };
  return Object.fromEntries(PALETTE_COLORS.map((color) => [color, raw[color] / total])) as PaletteVector;
}

export function paletteFromSong(song: Record<string, unknown>): PaletteVector | null {
  const candidate = song.palette_direction ?? song.song_palette_direction;
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Partial<Record<PaletteColor, unknown>>;
  const total = PALETTE_COLORS.reduce((sum, color) => sum + finiteNonnegative(raw[color]), 0);
  return total > 0 ? normalizePalette(raw) : null;
}

export function dominantPaletteColor(vector: PaletteVector): PaletteColor {
  return PALETTE_COLORS.reduce((best, color) => (vector[color] > vector[best] ? color : best), PALETTE_COLORS[0]);
}

export function blendPalettes(base: PaletteVector, incoming: PaletteVector, incomingShare: number): PaletteVector {
  const share = Math.max(0, Math.min(1, incomingShare));
  return normalizePalette(
    Object.fromEntries(PALETTE_COLORS.map((color) => [color, base[color] * (1 - share) + incoming[color] * share])) as PaletteVector,
  );
}

/** Sets one radial direction while proportionally preserving the other nine. */
export function setPaletteComponent(vector: PaletteVector, color: PaletteColor, nextShare: number): PaletteVector {
  const share = Math.max(0, Math.min(1, nextShare));
  const otherColors = PALETTE_COLORS.filter((item) => item !== color);
  const otherTotal = otherColors.reduce((sum, item) => sum + vector[item], 0);
  if (share >= 1 || otherTotal <= 0) {
    return normalizePalette({
      ...Object.fromEntries(otherColors.map((item) => [item, (1 - share) / otherColors.length])),
      [color]: share,
    } as PaletteVector);
  }
  return normalizePalette({
    ...Object.fromEntries(otherColors.map((item) => [item, (vector[item] / otherTotal) * (1 - share)])),
    [color]: share,
  } as PaletteVector);
}

/** L3 scenario-date filter over already-audited L2B song palette records. */
export function openingTeamPalette(
  songs: Record<string, unknown>[],
  groupUid: string,
  openingIso: string | null | undefined,
): TeamPaletteState {
  const cutoff = String(openingIso ?? "").split("T")[0];
  const totals = Object.fromEntries(PALETTE_COLORS.map((color) => [color, 0])) as PaletteVector;
  let totalWeight = 0;
  const included: string[] = [];

  for (const song of songs) {
    if (String(song.group_uid ?? "").trim() !== groupUid) continue;
    const releaseDate = String(song.release_date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseDate) || (cutoff && releaseDate > cutoff)) continue;
    const vector = paletteFromSong(song);
    // This field is the late-L2B rank-derived local score.  No group-level or
    // play-count fallback is permitted in the scenario initializer.
    const weight = finiteNonnegative(song.popularity_local);
    if (!vector || weight <= 0) continue;
    for (const color of PALETTE_COLORS) totals[color] += vector[color] * weight;
    totalWeight += weight;
    const uid = String(song.uid ?? "").trim();
    if (uid) included.push(uid);
  }

  if (totalWeight <= 0) {
    return { direction: { ...NEUTRAL_DEFAULT }, source: "neutral_default", released_song_uids: [], updated_on: null };
  }
  return {
    direction: normalizePalette(totals),
    source: "l3_catalog_prior",
    released_song_uids: included,
    updated_on: cutoff || null,
  };
}

export function normalizeTeamPalette(raw: unknown, fallback: TeamPaletteState): TeamPaletteState {
  if (!raw || typeof raw !== "object") return fallback;
  const row = raw as Record<string, unknown>;
  const source = row.source === "l3_catalog_prior" || row.source === "developed" || row.source === "neutral_default"
    ? row.source
    : fallback.source;
  return {
    direction: normalizePalette((row.direction ?? fallback.direction) as Partial<Record<PaletteColor, unknown>>),
    source,
    released_song_uids: Array.isArray(row.released_song_uids)
      ? row.released_song_uids.map((value) => String(value ?? "").trim()).filter(Boolean)
      : fallback.released_song_uids,
    updated_on: typeof row.updated_on === "string" ? row.updated_on.split("T")[0] : fallback.updated_on,
  };
}

export function evolveTeamPalette(state: TeamPaletteState, songUid: string, songPalette: PaletteVector, releasedOn: string): TeamPaletteState {
  if (state.released_song_uids.includes(songUid)) return state;
  return {
    direction: blendPalettes(state.direction, songPalette, 0.15),
    source: "developed",
    released_song_uids: [...state.released_song_uids, songUid],
    updated_on: releasedOn,
  };
}

export function paletteCssGradient(vector: PaletteVector): string {
  let cursor = 0;
  const stops = PALETTE_COLORS.map((color) => {
    const start = cursor;
    cursor += vector[color] * 100;
    return `${PALETTE_COLOR_HEX[color]} ${start.toFixed(1)}% ${cursor.toFixed(1)}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}
