import type { GameSavePayload } from "../save/gameSaveSchema";
import { addNotification } from "../save/inbox";

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
    const title = String(perf.title ?? perf.artist_name ?? festivalName).trim() || festivalName;
    const stageLoc = stageLocations.get(stage) ?? "";
    out.push({
      uid: buildFestivalLiveUid(festival, perf, managedGroupUid, index++),
      title,
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
      venue: stage ? `${festivalName} - ${stage}` : festivalName,
      venue_uid: null,
      location: stageLoc || String(festival.location ?? ""),
      description: [String(perf.subtitle ?? "").trim(), String(perf.notes ?? "").trim()].filter(Boolean).join(" · "),
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
  const seen = new Set<string>();
  for (const row of save.lives.schedules) {
    if (!row || typeof row !== "object") continue;
    seen.add(String((row as Record<string, unknown>).uid ?? ""));
  }
  for (const row of save.lives.results) {
    if (!row || typeof row !== "object") continue;
    seen.add(String((row as Record<string, unknown>).live_uid ?? (row as Record<string, unknown>).uid ?? ""));
  }
  let added = 0;
  for (const live of incoming) {
    const uid = String(live.uid ?? "");
    if (!uid || seen.has(uid)) continue;
    save.lives.schedules.push(live);
    seen.add(uid);
    added += 1;
  }
  if (added > 0) {
    addNotification(save, {
      title: "Festival schedule imported: TIF 2025",
      body: `${added} TOKYO IDOL FESTIVAL 2025 appearance(s) were added to your live schedule for the managed group.`,
      sender: "Operations",
      category: "internal",
      level: "high",
      isoDate: save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2025-07-20",
      unread: true,
      dedupeKey: `festival-sync|tif2025|${managedGroupUid}`,
      relatedEventUid: String(tif2025.uid ?? ""),
    });
  }
  return added;
}
