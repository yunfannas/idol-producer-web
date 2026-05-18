import type { GameSavePayload } from "../save/gameSaveSchema";
import { songCatalogDisplayLabel } from "../data/songCatalog";

export const TIMELESS_MEMORY_UID = "d3b51910-0f40-4e75-9413-4f3762fbf110";
export const TIMELESS_MEMORY_UNLOCK_DATE = "2026-01-01";

export interface ManagedSongStatusRow {
  song_uid: string;
  title: string;
  familiarity: number;
  rotation_fatigue: number;
  learned_member_count: number;
  last_trained_date: string | null;
  last_performed_date: string | null;
  recent_performance_dates: string[];
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function parseIsoDate(value: unknown): string | null {
  const text = String(value ?? "").split("T")[0].trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function isoDayIndex(value: string | null | undefined): number | null {
  const iso = parseIsoDate(value);
  if (!iso) return null;
  const ms = Date.parse(`${iso}T12:00:00Z`);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 86400000);
}

export function managedSongUnlockDate(row: Record<string, unknown>): string | null {
  const uid = String(row.uid ?? "").trim();
  if (uid === TIMELESS_MEMORY_UID) return TIMELESS_MEMORY_UNLOCK_DATE;
  return parseIsoDate(row.release_date);
}

export function isManagedSongAvailableOn(row: Record<string, unknown>, referenceIso: string | null | undefined): boolean {
  const availableIso = managedSongUnlockDate(row);
  const refIso = parseIsoDate(referenceIso);
  if (!availableIso) return true;
  if (!refIso) return true;
  return availableIso <= refIso;
}

function defaultSongStatusRow(
  song: Record<string, unknown>,
  currentIso: string | null | undefined,
  memberCount: number,
): ManagedSongStatusRow {
  const available = isManagedSongAvailableOn(song, currentIso);
  return {
    song_uid: String(song.uid ?? ""),
    title: songCatalogDisplayLabel(song),
    familiarity: available ? 72 : 0,
    rotation_fatigue: 0,
    learned_member_count: Math.max(0, memberCount),
    last_trained_date: null,
    last_performed_date: null,
    recent_performance_dates: [],
  };
}

export function normalizeManagedSongStatus(
  raw: unknown,
  songs: Record<string, unknown>[],
  groupUid: string,
  currentIso: string | null | undefined,
  memberCount: number,
): Record<string, ManagedSongStatusRow> {
  const out: Record<string, ManagedSongStatusRow> = {};
  const rawMap =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  for (const song of songs) {
    if (!song || typeof song !== "object") continue;
    if (String(song.group_uid ?? "") !== groupUid) continue;
    const uid = String(song.uid ?? "").trim();
    if (!uid) continue;
    const base = defaultSongStatusRow(song, currentIso, memberCount);
    const stored =
      rawMap[uid] && typeof rawMap[uid] === "object" && !Array.isArray(rawMap[uid])
        ? (rawMap[uid] as Record<string, unknown>)
        : null;
    const row: ManagedSongStatusRow = {
      song_uid: uid,
      title: stored ? String(stored.title ?? base.title) : base.title,
      familiarity: clamp(Math.round(stored ? num(stored.familiarity, base.familiarity) : base.familiarity), 0, 100),
      rotation_fatigue: clamp(
        Math.round(stored ? num(stored.rotation_fatigue, base.rotation_fatigue) : base.rotation_fatigue),
        0,
        100,
      ),
      learned_member_count: Math.max(
        0,
        Math.round(stored ? num(stored.learned_member_count, base.learned_member_count) : base.learned_member_count),
      ),
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

export function normalizeTrainingSongSelection(
  raw: unknown,
  statusMap: Record<string, ManagedSongStatusRow>,
): string[] {
  const valid = new Set(Object.keys(statusMap));
  if (!Array.isArray(raw)) return [];
  return raw.map((x) => String(x)).filter((uid, index, arr) => valid.has(uid) && arr.indexOf(uid) === index);
}

export function applyTrainingToManagedSongs(
  statusMap: Record<string, ManagedSongStatusRow>,
  selectedSongUids: string[],
  targetIso: string,
  blocksPerIdol: number,
): Array<{ title: string; familiarity_delta: number; familiarity_after: number }> {
  const selected = selectedSongUids
    .map((uid) => statusMap[uid])
    .filter((row): row is ManagedSongStatusRow => Boolean(row));
  const gain = Math.max(1, Math.round(Math.max(1, blocksPerIdol) * 4));
  const updates: Array<{ title: string; familiarity_delta: number; familiarity_after: number }> = [];
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

export function decayManagedSongsOvernight(
  statusMap: Record<string, ManagedSongStatusRow>,
  selectedSongUids: string[],
  targetIso: string,
): void {
  const selected = new Set(selectedSongUids);
  for (const row of Object.values(statusMap)) {
    row.rotation_fatigue = clamp(row.rotation_fatigue - 5, 0, 100);
    if (!selected.has(row.song_uid) && row.last_trained_date !== targetIso) {
      row.familiarity = clamp(row.familiarity - 1, 0, 100);
    }
    row.recent_performance_dates = row.recent_performance_dates.filter((iso) => {
      const dt = Date.parse(`${iso}T12:00:00Z`);
      const ref = Date.parse(`${targetIso}T12:00:00Z`);
      if (!Number.isFinite(dt) || !Number.isFinite(ref)) return false;
      return ref - dt <= 35 * 86400000;
    });
  }
}

export function registerManagedSetlistPerformance(
  statusMap: Record<string, ManagedSongStatusRow>,
  songs: Record<string, unknown>[],
  groupUid: string,
  setlistTitles: string[],
  targetIso: string,
): void {
  const titleToUid = new Map<string, string>();
  for (const song of songs) {
    if (!song || typeof song !== "object") continue;
    if (String(song.group_uid ?? "") !== groupUid) continue;
    titleToUid.set(songCatalogDisplayLabel(song), String(song.uid ?? ""));
  }
  const used = new Set<string>();
  for (const title of setlistTitles.map((x) => String(x).trim()).filter(Boolean)) {
    const uid = titleToUid.get(title);
    if (!uid || used.has(uid)) continue;
    used.add(uid);
    const row = statusMap[uid];
    if (!row) continue;
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

export function managedSetlistEffect(
  statusMap: Record<string, ManagedSongStatusRow>,
  songs: Record<string, unknown>[],
  groupUid: string,
  setlistTitles: string[],
): {
  score_delta: number;
  avg_familiarity: number;
  avg_rotation_fatigue: number;
  low_familiarity_count: number;
} {
  const titleToUid = new Map<string, string>();
  for (const song of songs) {
    if (!song || typeof song !== "object") continue;
    if (String(song.group_uid ?? "") !== groupUid) continue;
    titleToUid.set(songCatalogDisplayLabel(song), String(song.uid ?? ""));
  }
  const rows: ManagedSongStatusRow[] = [];
  for (const title of setlistTitles.map((x) => String(x).trim()).filter(Boolean)) {
    const uid = titleToUid.get(title);
    if (!uid) continue;
    const row = statusMap[uid];
    if (row) rows.push(row);
  }
  if (!rows.length) {
    return { score_delta: 0, avg_familiarity: 0, avg_rotation_fatigue: 0, low_familiarity_count: 0 };
  }
  const avgFamiliarity = rows.reduce((sum, row) => sum + row.familiarity, 0) / rows.length;
  const avgFatigue = rows.reduce((sum, row) => sum + row.rotation_fatigue, 0) / rows.length;
  const lowFamiliarityCount = rows.filter((row) => row.familiarity < 50).length;
  const familiarityBonus = clamp((avgFamiliarity - 68) / 5.5, -8, 6);
  const fatiguePenalty = clamp(avgFatigue / 7.5, 0, 10);
  const lowFamPenalty = lowFamiliarityCount * 1.4;
  return {
    score_delta: Math.round((familiarityBonus - fatiguePenalty - lowFamPenalty) * 100) / 100,
    avg_familiarity: Math.round(avgFamiliarity * 100) / 100,
    avg_rotation_fatigue: Math.round(avgFatigue * 100) / 100,
    low_familiarity_count: lowFamiliarityCount,
  };
}

export function suggestManagedSetlistTitles(
  statusMap: Record<string, ManagedSongStatusRow>,
  songs: Record<string, unknown>[],
  groupUid: string,
  referenceIso: string | null | undefined,
  maxN: number,
  songPopularity: (row: Record<string, unknown>) => number,
): string[] {
  const available = songs
    .filter((row) => String(row.group_uid ?? "") === groupUid)
    .filter((row) => isManagedSongAvailableOn(row, referenceIso));
  const popularitySorted = [...available].sort((a, b) => {
    const popDelta = songPopularity(b) - songPopularity(a);
    if (popDelta !== 0) return popDelta;
    return songCatalogDisplayLabel(a).localeCompare(songCatalogDisplayLabel(b), "ja");
  });
  const anchorRows = popularitySorted.slice(0, 3);
  const anchorUids = new Set(anchorRows.map((row) => String(row.uid ?? "")));
  const dayIndex = isoDayIndex(referenceIso);
  const targetAnchorCount = Math.min(maxN, anchorRows.length, maxN >= 4 ? 3 : maxN >= 2 ? 2 : 1);
  const anchorPicks = anchorRows
    .map((row, anchorIndex) => {
      const uid = String(row.uid ?? "");
      const status = statusMap[uid];
      const recent = Array.isArray(status?.recent_performance_dates) ? status!.recent_performance_dates.slice(-5) : [];
      const scheduledSkip = dayIndex != null ? (dayIndex + anchorIndex) % 7 === 0 : false;
      return {
        row,
        recentCount: recent.length,
        fatigue: status?.rotation_fatigue ?? 0,
        scheduledSkip,
      };
    })
    .sort((a, b) => {
      if (a.scheduledSkip !== b.scheduledSkip) return a.scheduledSkip ? 1 : -1;
      if (a.recentCount !== b.recentCount) return a.recentCount - b.recentCount;
      if (a.fatigue !== b.fatigue) return a.fatigue - b.fatigue;
      return songPopularity(b.row) - songPopularity(a.row);
    })
    .filter((entry) => !entry.scheduledSkip)
    .slice(0, targetAnchorCount)
    .map((entry) => songCatalogDisplayLabel(entry.row));

  const chosenTitles = new Set(anchorPicks);
  const fillPicks = available
    .map((row) => {
      const uid = String(row.uid ?? "");
      const status = statusMap[uid];
      const recent = Array.isArray(status?.recent_performance_dates) ? status!.recent_performance_dates.slice(-7) : [];
      const recentCount = recent.length;
      const mostRecentIso = recent.length ? recent[recent.length - 1] ?? null : null;
      const isAnchor = anchorUids.has(uid);
      const repeatPenalty = recentCount * 24 + (recentCount >= 3 ? 80 : 0);
      const immediateRepeatPenalty = mostRecentIso === referenceIso ? 40 : 0;
      const score =
        songPopularity(row) * 12 +
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
      if (b.score !== a.score) return b.score - a.score;
      if (a.isAnchor !== b.isAnchor) return a.isAnchor ? -1 : 1;
      return songCatalogDisplayLabel(a.row).localeCompare(songCatalogDisplayLabel(b.row), "ja");
    })
    .map((entry) => songCatalogDisplayLabel(entry.row))
    .filter(Boolean)
    .filter((title) => {
      if (chosenTitles.has(title)) return false;
      chosenTitles.add(title);
      return true;
    })
    .slice(0, Math.max(0, maxN - anchorPicks.length));
  return [...anchorPicks, ...fillPicks].slice(0, maxN);
}

export function maybeAddSongUnlockNotification(save: GameSavePayload, targetIso: string): void {
  const currentIso = parseIsoDate(targetIso);
  if (!currentIso) return;
  if (currentIso < TIMELESS_MEMORY_UNLOCK_DATE) return;
  const exists = save.inbox.notifications.some(
    (row) => String(row.dedupe_key ?? "") === `song-unlock|${TIMELESS_MEMORY_UID}|${TIMELESS_MEMORY_UNLOCK_DATE}`,
  );
  if (exists) return;
  save.inbox.notifications.push({
    uid: `song-unlock-${TIMELESS_MEMORY_UID}`,
    title: "New song prepared: タイムレスメモリー",
    body: "タイムレスメモリー is now available for training preparation, setlists, and scheduling.",
    sender: "Assistant",
    category: "general",
    created_at: `${TIMELESS_MEMORY_UNLOCK_DATE}T08:00:00`,
    unread: true,
    read: false,
    requires_confirmation: false,
    dedupe_key: `song-unlock|${TIMELESS_MEMORY_UID}|${TIMELESS_MEMORY_UNLOCK_DATE}`,
  });
}
