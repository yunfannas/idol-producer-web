/**
 * Which songs appear in lists / counts / live novelty, and how they sort for display.
 */

export function isSongHiddenFromDisplay(row: Record<string, unknown>): boolean {
  if (row.hidden === true) return true;
  const title = String(row.title ?? "").trim();
  if (title.includes("三百六十五歩のマーチ")) return true;
  return false;
}

export function songPopularityNum(row: Record<string, unknown>): number {
  for (const key of ["popularity", "popularity_local", "popularity_global"] as const) {
    const v = row[key];
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  }
  return 0;
}

/** Parse `YYYY-MM-DD` (or ISO prefix) to UTC noon ms; invalid → `null`. */
export function parseCatalogIsoToTime(iso: string | null | undefined): number | null {
  const s = String(iso ?? "").trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = new Date(`${s}T12:00:00Z`).getTime();
  return Number.isFinite(t) ? t : null;
}

function songReleaseTime(row: Record<string, unknown>): number {
  return parseCatalogIsoToTime(String(row.release_date ?? "")) ?? 0;
}

/** Row has no parseable `release_date`, or it is strictly after `referenceIso` (desktop “Making”). */
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
    const rowT = parseCatalogIsoToTime(String(row.release_date ?? ""));
    if (rowT == null || rowT > refT) making.push(row);
    else released.push(row);
  }
  return { released, making };
}

/** Drop display-hidden rows, then popularity descending (ties: newer release first). */
export function songsForDisplaySorted(all: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...all]
    .filter((r) => !isSongHiddenFromDisplay(r))
    .sort((a, b) => {
      const pa = songPopularityNum(a);
      const pb = songPopularityNum(b);
      if (pb !== pa) return pb - pa;
      return songReleaseTime(b) - songReleaseTime(a);
    });
}

/** Primary disc / album label for UI (first non-empty `albums[].name`, else disc_type / stub). */
export function primaryDiscLabel(row: Record<string, unknown>): string {
  const albums = Array.isArray(row.albums) ? row.albums : [];
  for (const raw of albums) {
    if (!raw || typeof raw !== "object") continue;
    const name = String((raw as Record<string, unknown>).name ?? "").trim();
    if (name) return name;
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
