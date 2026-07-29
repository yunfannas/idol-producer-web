import type { GameSavePayload } from "../save/gameSaveSchema";

export interface FestivalEditionRow extends Record<string, unknown> {
  uid: string;
  name: string;
  festival_series?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  stages?: Record<string, unknown>[];
  performances?: Record<string, unknown>[];
}

function isoDay(value: unknown): string {
  return String(value ?? "").split("T")[0].trim();
}

function timeHm(value: unknown): string {
  const text = String(value ?? "").trim();
  return /^\d{2}:\d{2}(:\d{2})?$/.test(text) ? text.slice(0, 5) : "";
}

function stageLocationMap(festival: FestivalEditionRow): Map<string, string> {
  const map = new Map<string, string>();
  const stages = Array.isArray(festival.stages) ? festival.stages : [];
  for (const raw of stages) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    const name = String(row.name ?? "").trim();
    const location = String(row.location ?? "").trim();
    if (name) map.set(name, location);
  }
  return map;
}

export function normalizeFestivalCatalog(raw: unknown): FestivalEditionRow[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((row): row is FestivalEditionRow => Boolean(row && typeof row === "object" && String((row as { uid?: unknown }).uid ?? "")));
}

export function findFestivalEdition(
  festivals: FestivalEditionRow[],
  seriesName: string,
  year: number,
): FestivalEditionRow | null {
  const y = String(year);
  return (
    festivals.find((festival) => {
      const series = String(festival.festival_series ?? "").trim();
      const name = String(festival.name ?? "").trim();
      return series === seriesName && (name.endsWith(y) || isoDay(festival.start_date).startsWith(`${y}-`));
    }) ?? null
  );
}

export function festivalPerformancesForManagedGroup(
  festivals: FestivalEditionRow[],
  managedGroupUid: string,
): Array<{ festival: FestivalEditionRow; performance: Record<string, unknown> }> {
  const out: Array<{ festival: FestivalEditionRow; performance: Record<string, unknown> }> = [];
  for (const festival of festivals) {
    const performances = Array.isArray(festival.performances) ? festival.performances : [];
    for (const raw of performances) {
      if (!raw || typeof raw !== "object") continue;
      const perf = raw as Record<string, unknown>;
      if (String(perf.group_uid ?? "") !== managedGroupUid) continue;
      out.push({ festival, performance: perf });
    }
  }
  out.sort((a, b) => {
    const da = `${isoDay(a.performance.date)}|${timeHm(a.performance.start_time)}`;
    const db = `${isoDay(b.performance.date)}|${timeHm(b.performance.start_time)}`;
    return da.localeCompare(db);
  });
  return out;
}

function buildFestivalLiveUid(festival: FestivalEditionRow, perf: Record<string, unknown>, managedGroupUid: string, index: number): string {
  return [
    "festival",
    String(festival.uid ?? ""),
    isoDay(perf.date),
    timeHm(perf.start_time),
    managedGroupUid,
    String(index),
  ].join("|");
}

function normalizeFestivalMatchText(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Day-level TimeTree / managed-schedule TIF placeholders (not festivals.json stage slots). */
function isCoarseTifPlaceholderLive(row: Record<string, unknown>): boolean {
  const uid = String(row.uid ?? "");
  if (uid.startsWith("festival|")) return false;
  const blob = normalizeFestivalMatchText(
    [row.title, row.festival_name, row.venue, row.description, row.live_type, row.event_type].join(" "),
  );
  return /\btif\b|tokyo idol festival/.test(blob);
}

export function buildFestivalLivesFromEdition(
  festival: FestivalEditionRow,
  managedGroupUid: string,
): Record<string, unknown>[] {
  const performances = Array.isArray(festival.performances) ? festival.performances : [];
  const stageLocations = stageLocationMap(festival);
  const out: Record<string, unknown>[] = [];
  let index = 0;
  for (const raw of performances) {
    if (!raw || typeof raw !== "object") continue;
    const perf = raw as Record<string, unknown>;
    if (String(perf.group_uid ?? "") !== managedGroupUid) continue;
    const date = isoDay(perf.date);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    const stage = String(perf.stage ?? "").trim();
    const festivalName = String(festival.name ?? "Festival").trim() || "Festival";
    // Timetable `title` / `artist_name` are the act — keep the live title as the festival + stage.
    const artist = String(perf.artist_name ?? perf.title ?? "").trim();
    const stageLoc = stageLocations.get(stage) ?? "";
    const subtitle = String(perf.subtitle ?? "").trim();
    const notes = String(perf.notes ?? "").trim();
    const displayTitle = stage ? `${festivalName} · ${stage}` : festivalName;
    out.push({
      uid: buildFestivalLiveUid(festival, perf, managedGroupUid, index++),
      title: displayTitle,
      title_romanji: "",
      event_type: "Festival",
      live_type: "Festival",
      start_date: date,
      end_date: date,
      start_time: timeHm(perf.start_time),
      end_time: timeHm(perf.end_time),
      duration: 0,
      rehearsal_start: "",
      rehearsal_end: "",
      venue: stage || festivalName,
      venue_uid: null,
      location: stageLoc || String(festival.location ?? ""),
      description: [artist && artist !== festivalName ? artist : "", subtitle, notes].filter(Boolean).join(" · "),
      performance_count: 1,
      capacity: null,
      attendance: null,
      ticket_price: 0,
      poster_image_path: null,
      setlist: [],
      tokutenkai_enabled: false,
      tokutenkai_start: "",
      tokutenkai_end: "",
      tokutenkai_duration: 0,
      tokutenkai_ticket_price: 0,
      tokutenkai_slot_seconds: 0,
      tokutenkai_expected_tickets: 0,
      goods_enabled: false,
      goods_line: "",
      goods_expected_revenue_yen: 0,
      festival_uid: String(festival.uid ?? ""),
      festival_series: String(festival.festival_series ?? ""),
      festival_name: festivalName,
      festival_stage: stage,
      group_uid: managedGroupUid,
      status: "scheduled",
    });
  }
  return out;
}

export function syncManagedTif2025Lives(
  save: GameSavePayload,
  festivals: FestivalEditionRow[],
): number {
  const managedGroupUid = String(save.managing_group_uid ?? "").trim();
  if (!managedGroupUid) return 0;
  const tif2025 = findFestivalEdition(festivals, "TOKYO IDOL FESTIVAL", 2025);
  if (!tif2025) return 0;
  const incoming = buildFestivalLivesFromEdition(tif2025, managedGroupUid);
  if (!incoming.length) return 0;

  const coveredDates = new Set(
    incoming.map((live) => isoDay(live.start_date)).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)),
  );
  const byUid = new Map(incoming.map((live) => [String(live.uid ?? ""), live] as const));

  // Drop day-level TimeTree TIF placeholders once stage slots exist for that date.
  save.lives.schedules = save.lives.schedules.filter((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const row = raw as Record<string, unknown>;
    const date = isoDay(row.start_date ?? row.date);
    if (coveredDates.has(date) && isCoarseTifPlaceholderLive(row)) return false;
    return true;
  });

  const seen = new Set<string>();
  let added = 0;
  for (const row of save.lives.schedules) {
    if (!row || typeof row !== "object") continue;
    const live = row as Record<string, unknown>;
    const uid = String(live.uid ?? "");
    if (uid) seen.add(uid);
    const incomingLive = byUid.get(uid);
    if (!incomingLive) continue;
    // Refresh titles/venues on already-imported festival slots (artist used to be stored as title).
    live.title = incomingLive.title;
    live.festival_name = incomingLive.festival_name;
    live.festival_stage = incomingLive.festival_stage;
    live.venue = incomingLive.venue;
    live.location = incomingLive.location;
    live.description = incomingLive.description;
    live.start_time = incomingLive.start_time;
    live.end_time = incomingLive.end_time;
    live.capacity = null;
    live.ticket_price = 0;
    live.venue_uid = null;
  }
  for (const row of save.lives.results) {
    if (!row || typeof row !== "object") continue;
    seen.add(String((row as Record<string, unknown>).live_uid ?? (row as Record<string, unknown>).uid ?? ""));
  }
  for (const live of incoming) {
    const uid = String(live.uid ?? "");
    if (!uid || seen.has(uid)) continue;
    save.lives.schedules.push(live);
    seen.add(uid);
    added += 1;
  }
  return added;
}
