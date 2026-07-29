import monthlyLiveCountsCsv from "../../support/docs/reference/monthly_live_counts_by_letter_tier_template.csv?raw";
import type { GameSavePayload } from "../save/gameSaveSchema";
import { getPrimaryGroup, getLetterTierFromGroup } from "../save/gameSaveSchema";
import { addNotification } from "../save/inbox";
import {
  addMinutesToHHMM,
  autoSetlistSongCountForLive,
  buildAutoProgramForLive,
  durationMinutesBetweenHHMM,
  LIVE_TYPE_PRESETS,
  getVenuesCatalog,
  pickVenueForDesiredCapacity,
} from "./liveScheduleWeb";
import { songsForDisplaySorted, songPopularityNum } from "../data/songDisplayPolicy";
import { songCatalogDisplayLabel } from "../data/songCatalog";
import { suggestManagedSetlistTitles } from "./songStatusSystem";
import { findManagedOfficialScheduleBundleInRuntime } from "./mediaEventWeb";
import type { OfficialScheduleBundle, OfficialScheduleEvent } from "../data/scenarioTypes";

type LiveCountRow = {
  group_letter_tier: string;
  type_1: number;
  type_2: number;
  type_3: number;
  type_4: number;
  type_5: number;
  type_6: number;
  type_7: number;
  type_6_venue_rank: string;
};

type AutoLiveTypeKey = "type_1" | "type_2" | "type_3" | "type_4" | "type_5" | "type_6" | "type_7";

const AUTO_LIVE_TYPE_KEYS: AutoLiveTypeKey[] = ["type_1", "type_2", "type_3", "type_4", "type_5", "type_6", "type_7"];

type AutoLiveTemplate = {
  liveType: string;
  eventType: string;
  titleSuffix: string;
  defaultStart: string;
  defaultDurationMinutes: number;
  ticketPriceYen: number;
  tokutenkaiEnabled: boolean;
  tokutenkaiDurationMinutes: number;
  tokutenkaiTicketPrice: number;
  tokutenkaiSlotSeconds: number;
  tokutenkaiExpectedTickets: number;
  setlistCount: number;
  desiredCapacity: (tier: string, venueRank: string) => number;
  preferredWeekdays: number[];
};

type ManagedLiveScheduleEvent = {
  uid?: string;
  source_event_id?: string;
  date?: string;
  title?: string;
  template_key?: AutoLiveTypeKey;
  event_type?: string;
  live_type?: string;
  raw_type?: string;
  venue?: string;
  venue_uid?: string;
  start_time?: string;
  end_time?: string;
  tokutenkai_enabled?: boolean;
  tokutenkai_start?: string;
  tokutenkai_end?: string;
  poster_image_path?: string;
  source_url?: string;
};

type ManagedLiveScheduleFile = {
  source_key?: string;
  label?: string;
  event_count?: number;
  events?: ManagedLiveScheduleEvent[];
};

type ManagedLiveScheduleSource = {
  source_key?: string;
  label?: string;
  group_uid?: string;
  group_name?: string;
  group_name_romanji?: string;
  aliases?: string[];
  file?: string;
};

type ManagedLiveScheduleManifest = {
  generated_at?: string;
  sources?: ManagedLiveScheduleSource[];
};

const CAPACITY_BY_RANK: Record<string, number> = {
  S: 32000,
  A: 18000,
  B: 11000,
  C: 4000,
  D: 1300,
  E: 350,
  F: 180,
};

const AUTO_LIVE_TEMPLATES: Record<AutoLiveTypeKey, AutoLiveTemplate> = {
  type_1: {
    liveType: "Concert",
    eventType: "Concert",
    titleSuffix: "Premium Concert",
    defaultStart: "18:00",
    defaultDurationMinutes: 150,
    ticketPriceYen: 10000,
    tokutenkaiEnabled: false,
    tokutenkaiDurationMinutes: 0,
    tokutenkaiTicketPrice: 0,
    tokutenkaiSlotSeconds: 0,
    tokutenkaiExpectedTickets: 0,
    setlistCount: 9,
    desiredCapacity: (tier) => {
      if (tier === "S") return 32000;
      if (tier === "A") return 18000;
      return 12000;
    },
    preferredWeekdays: [5, 6],
  },
  type_2: {
    liveType: "Roaming",
    eventType: "Concert",
    titleSuffix: "Roaming Concert",
    defaultStart: "18:00",
    defaultDurationMinutes: 130,
    ticketPriceYen: 9000,
    tokutenkaiEnabled: false,
    tokutenkaiDurationMinutes: 0,
    tokutenkaiTicketPrice: 0,
    tokutenkaiSlotSeconds: 0,
    tokutenkaiExpectedTickets: 0,
    setlistCount: 8,
    desiredCapacity: (tier) => {
      if (tier === "S") return 24000;
      if (tier === "A") return 15000;
      if (tier === "B") return 9000;
      return 4000;
    },
    preferredWeekdays: [5, 6],
  },
  type_3: {
    liveType: "Festival",
    eventType: "Festival",
    titleSuffix: "Festival Appearance",
    defaultStart: "12:00",
    defaultDurationMinutes: 30,
    ticketPriceYen: 0,
    tokutenkaiEnabled: false,
    tokutenkaiDurationMinutes: 0,
    tokutenkaiTicketPrice: 0,
    tokutenkaiSlotSeconds: 0,
    tokutenkaiExpectedTickets: 0,
    setlistCount: 3,
    desiredCapacity: (tier) => {
      if (tier === "S" || tier === "A") return 18000;
      if (tier === "B") return 8000;
      return 2500;
    },
    preferredWeekdays: [5, 6],
  },
  type_4: {
    liveType: "Taiban",
    eventType: "Taiban",
    titleSuffix: "Taiban",
    defaultStart: "18:30",
    defaultDurationMinutes: 30,
    ticketPriceYen: 2500,
    tokutenkaiEnabled: true,
    tokutenkaiDurationMinutes: 60,
    tokutenkaiTicketPrice: 2000,
    tokutenkaiSlotSeconds: 15,
    tokutenkaiExpectedTickets: 48,
    setlistCount: 3,
    desiredCapacity: (tier) => {
      if (tier === "C") return 900;
      if (tier === "D") return 500;
      if (tier === "E") return 300;
      if (tier === "F") return 180;
      return 1200;
    },
    preferredWeekdays: [4, 5, 6],
  },
  type_5: {
    liveType: "Joint",
    eventType: "Joint",
    titleSuffix: "2/3/4-man Live",
    defaultStart: "18:00",
    defaultDurationMinutes: 45,
    ticketPriceYen: 2800,
    tokutenkaiEnabled: true,
    tokutenkaiDurationMinutes: 60,
    tokutenkaiTicketPrice: 2000,
    tokutenkaiSlotSeconds: 20,
    tokutenkaiExpectedTickets: 56,
    setlistCount: 4,
    desiredCapacity: (tier) => {
      if (tier === "C") return 1200;
      if (tier === "D") return 650;
      if (tier === "E") return 350;
      if (tier === "F") return 200;
      return 1600;
    },
    preferredWeekdays: [5, 6],
  },
  type_6: {
    liveType: "OneMan",
    eventType: "Concert",
    titleSuffix: "One-man Live",
    defaultStart: "18:00",
    defaultDurationMinutes: 95,
    ticketPriceYen: 3800,
    tokutenkaiEnabled: true,
    tokutenkaiDurationMinutes: 90,
    tokutenkaiTicketPrice: 2000,
    tokutenkaiSlotSeconds: 20,
    tokutenkaiExpectedTickets: 80,
    setlistCount: 6,
    desiredCapacity: (_tier, venueRank) => CAPACITY_BY_RANK[venueRank] ?? CAPACITY_BY_RANK.C,
    preferredWeekdays: [5, 6],
  },
  type_7: {
    liveType: "Routine",
    eventType: LIVE_TYPE_PRESETS.Routine.event_type,
    titleSuffix: "Routine Live",
    defaultStart: LIVE_TYPE_PRESETS.Routine.default_start_time,
    defaultDurationMinutes: LIVE_TYPE_PRESETS.Routine.default_duration,
    ticketPriceYen: 2500,
    tokutenkaiEnabled: true,
    tokutenkaiDurationMinutes: LIVE_TYPE_PRESETS.Routine.tokutenkai_duration,
    tokutenkaiTicketPrice: LIVE_TYPE_PRESETS.Routine.tokutenkai_ticket_price,
    tokutenkaiSlotSeconds: LIVE_TYPE_PRESETS.Routine.tokutenkai_slot_seconds,
    tokutenkaiExpectedTickets: LIVE_TYPE_PRESETS.Routine.tokutenkai_expected_tickets,
    setlistCount: 5,
    desiredCapacity: (tier) => {
      if (tier === "D") return 280;
      if (tier === "E") return 220;
      if (tier === "F") return 150;
      return 420;
    },
    preferredWeekdays: [2, 5, 6],
  },
};

let matrixMemo: Map<string, LiveCountRow> | null = null;

let managedLiveScheduleManifest: ManagedLiveScheduleManifest = { sources: [] };
const MANAGED_LIVE_SCHEDULE_DB = new Map<string, ManagedLiveScheduleFile>();
let managedLiveScheduleLoadPromise: Promise<void> | null = null;

function publicDataBaseUrl(): string {
  return import.meta.env.BASE_URL.endsWith("/") ? import.meta.env.BASE_URL : `${import.meta.env.BASE_URL}/`;
}

/** Load optional managed live schedule JSON from `public/data/` (runtime fetch, not bundled). */
export function preloadManagedLiveSchedules(): Promise<void> {
  if (MANAGED_LIVE_SCHEDULE_DB.size > 0) return Promise.resolve();
  if (managedLiveScheduleLoadPromise) return managedLiveScheduleLoadPromise;
  managedLiveScheduleLoadPromise = (async () => {
    try {
      const manifestRes = await fetch(`${publicDataBaseUrl()}data/managed-live-schedules/manifest.json`);
      if (!manifestRes.ok) return;
      managedLiveScheduleManifest = (await manifestRes.json()) as ManagedLiveScheduleManifest;
      const sources = Array.isArray(managedLiveScheduleManifest.sources)
        ? managedLiveScheduleManifest.sources
        : [];
      await Promise.all(
        sources.map(async (source) => {
          const relFile = String(source?.file ?? "").trim();
          if (!relFile || MANAGED_LIVE_SCHEDULE_DB.has(relFile)) return;
          const fileRes = await fetch(`${publicDataBaseUrl()}data/managed-live-schedules/${relFile}`);
          if (!fileRes.ok) return;
          MANAGED_LIVE_SCHEDULE_DB.set(relFile, (await fileRes.json()) as ManagedLiveScheduleFile);
        }),
      );
    } catch (err) {
      console.warn("[monthlyLiveScheduler] managed schedule preload failed", err);
    }
  })();
  return managedLiveScheduleLoadPromise;
}

function parseMonthlyLiveMatrix(): Map<string, LiveCountRow> {
  const rows = monthlyLiveCountsCsv
    .trim()
    .split(/\r?\n/g)
    .map((line) => line.trim())
    .filter(Boolean);
  const [header, ...body] = rows;
  const cols = header.split(",");
  const out = new Map<string, LiveCountRow>();
  for (const line of body) {
    const cells = line.split(",");
    const row: Record<string, unknown> = {};
    cols.forEach((col, idx) => {
      row[col] = cells[idx] ?? "";
    });
    const tier = String(row.group_letter_tier ?? "").trim().toUpperCase();
    if (!tier) continue;
    out.set(tier, {
      group_letter_tier: tier,
      type_1: Number(row.type_1 ?? 0) || 0,
      type_2: Number(row.type_2 ?? 0) || 0,
      type_3: Number(row.type_3 ?? 0) || 0,
      type_4: Number(row.type_4 ?? 0) || 0,
      type_5: Number(row.type_5 ?? 0) || 0,
      type_6: Number(row.type_6 ?? 0) || 0,
      type_7: Number(row.type_7 ?? 0) || 0,
      type_6_venue_rank: String(row.type_6_venue_rank ?? "").trim().toUpperCase() || tier,
    });
  }
  return out;
}

function liveMatrix(): Map<string, LiveCountRow> {
  if (!matrixMemo) matrixMemo = parseMonthlyLiveMatrix();
  return matrixMemo;
}

function startOfMonthIso(isoDate: string): string {
  const [y, m] = String(isoDate).split("T")[0].split("-");
  return `${y}-${m}-01`;
}

function endOfMonthIso(monthStartIso: string): string {
  const [y, m] = monthStartIso.split("-").map((part) => Number(part));
  const dt = new Date(Date.UTC(y, m, 0));
  return dt.toISOString().slice(0, 10);
}

function addMonths(monthStartIso: string, delta: number): string {
  const [y, m] = monthStartIso.split("-").map((part) => Number(part));
  const dt = new Date(Date.UTC(y, m - 1 + delta, 1));
  return dt.toISOString().slice(0, 10);
}

function monthSerial(monthStartIso: string): number {
  const [y, m] = monthStartIso.split("-").map((part) => Number(part));
  return y * 12 + (m - 1);
}

function countForMonth(rate: number, monthStartIso: string): number {
  if (rate <= 0) return 0;
  const serial = monthSerial(monthStartIso);
  return Math.max(0, Math.floor((serial + 1) * rate) - Math.floor(serial * rate));
}

function enumerateMonthDates(monthStartIso: string): string[] {
  const endIso = endOfMonthIso(monthStartIso);
  const out: string[] = [];
  let cursor = monthStartIso;
  while (cursor <= endIso) {
    out.push(cursor);
    const dt = new Date(`${cursor}T12:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    cursor = dt.toISOString().slice(0, 10);
  }
  return out;
}

function weekdayUtc(isoDate: string): number {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay();
}

function pickDistributedDates(
  monthStartIso: string,
  count: number,
  preferredWeekdays: number[],
  minIso?: string,
): string[] {
  if (count <= 0) return [];
  const all = enumerateMonthDates(monthStartIso).filter((iso) => !minIso || iso >= minIso);
  if (!all.length) return [];
  const preferred = all.filter((iso) => preferredWeekdays.includes(weekdayUtc(iso)));
  const pool = preferred.length >= count ? preferred : all;
  if (count >= pool.length) return pool;
  const out: string[] = [];
  const used = new Set<number>();
  for (let i = 0; i < count; i += 1) {
    const rawIndex = Math.round(((i + 0.5) * pool.length) / count - 0.5);
    let idx = Math.max(0, Math.min(pool.length - 1, rawIndex));
    while (used.has(idx) && idx < pool.length - 1) idx += 1;
    while (used.has(idx) && idx > 0) idx -= 1;
    used.add(idx);
    out.push(pool[idx]!);
  }
  return out.sort();
}

function songTitlesForAutoLive(
  save: GameSavePayload,
  groupUid: string,
  maxN: number,
): string[] {
  const referenceIso = save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? null;
  const suggested = suggestManagedSetlistTitles(
    save.managed_song_status,
    songsForDisplaySorted(save.database_snapshot.songs),
    groupUid,
    referenceIso,
    maxN,
    songPopularityNum,
  );
  if (suggested.length) return suggested;
  return songsForDisplaySorted(save.database_snapshot.songs)
    .filter((row) => String(row.group_uid ?? "") === groupUid)
    .slice(0, maxN)
    .map((row) => songCatalogDisplayLabel(row))
    .filter(Boolean);
}

function setlistCountForScheduledLive(
  liveType: string,
  startTime: string,
  endTime: string,
  fallbackDurationMinutes: number,
  fallbackCount: number,
): number {
  const duration =
    durationMinutesBetweenHHMM(startTime, endTime) ??
    Math.max(0, Math.trunc(fallbackDurationMinutes));
  return autoSetlistSongCountForLive(liveType, duration, fallbackCount);
}

function buildAutoLiveRow(params: {
  save: GameSavePayload;
  group: Record<string, unknown>;
  tier: string;
  venueRank: string;
  monthStartIso: string;
  dateIso: string;
  typeKey: AutoLiveTypeKey;
  ordinal: number;
}): Record<string, unknown> {
  const { save, group, tier, venueRank, monthStartIso, dateIso, typeKey, ordinal } = params;
  const template = AUTO_LIVE_TEMPLATES[typeKey];
  const groupUid = String(group.uid ?? "");
  const groupName = String(group.name ?? group.name_romanji ?? "Managed Group").trim();
  const romanji = String(group.name_romanji ?? "").trim();
  const desiredCapacity = template.desiredCapacity(tier, venueRank);
  const venuePick = pickVenueForDesiredCapacity(getVenuesCatalog(), desiredCapacity);
  const duration = template.defaultDurationMinutes;
  const endTime = addMinutesToHHMM(template.defaultStart, duration);
  const setlistCount = setlistCountForScheduledLive(template.liveType, template.defaultStart, endTime, duration, template.setlistCount);
  const setlist = songTitlesForAutoLive(
    save,
    groupUid,
    setlistCount,
  );
  const tokutenkaiStart = template.tokutenkaiEnabled ? endTime : "";
  const tokutenkaiEnd = template.tokutenkaiEnabled ? addMinutesToHHMM(endTime, template.tokutenkaiDurationMinutes) : "";
  return {
    uid: `monthly-auto-live-${groupUid}-${monthStartIso}-${typeKey}-${ordinal + 1}`,
    title: `${groupName} ${template.titleSuffix}`,
    title_romanji: romanji ? `${romanji} ${template.titleSuffix}` : "",
    event_type: template.eventType,
    live_type: template.liveType,
    start_date: dateIso,
    end_date: dateIso,
    start_time: template.defaultStart,
    end_time: endTime,
    duration,
    rehearsal_start: "",
    rehearsal_end: "",
    venue: venuePick.name,
    venue_uid: venuePick.uid,
    location: venuePick.location,
    description: `Auto-booked from monthly live count reference (${typeKey}, tier ${tier}).`,
    performance_count: 1,
    capacity: venuePick.capacity ?? desiredCapacity,
    attendance: null,
    ticket_price: template.ticketPriceYen,
    poster_image_path: null,
    setlist,
    program: buildAutoProgramForLive(template.liveType, duration, setlist, `auto-program-${typeKey}-${ordinal + 1}`),
    tokutenkai_enabled: template.tokutenkaiEnabled,
    tokutenkai_start: tokutenkaiStart,
    tokutenkai_end: tokutenkaiEnd,
    tokutenkai_duration: template.tokutenkaiDurationMinutes,
    tokutenkai_ticket_price: template.tokutenkaiTicketPrice,
    tokutenkai_slot_seconds: template.tokutenkaiSlotSeconds,
    tokutenkai_expected_tickets: template.tokutenkaiEnabled
      ? Math.min(Math.max(24, template.tokutenkaiExpectedTickets), Math.max(40, Math.trunc((venuePick.capacity ?? desiredCapacity) * 0.4)))
      : 0,
    goods_enabled: false,
    goods_uid: "",
    goods_line: "",
    goods_expected_revenue_yen: 0,
    group: [groupName].filter(Boolean),
    group_uid: groupUid,
    status: "scheduled",
    auto_booked_month: monthStartIso,
    auto_booked_type: typeKey,
  };
}

function normalizeManagedScheduleKey(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[!！]/g, "");
}

function getManagedScheduleSourceForGroup(group: Record<string, unknown> | null | undefined): ManagedLiveScheduleSource | null {
  if (!group || typeof group !== "object") return null;
  const uid = String(group.uid ?? "").trim();
  const candidates = new Set<string>();
  if (uid) candidates.add(`uid:${uid}`);
  const rawKeys = [group.name, group.name_romanji, group.nickname, group.nickname_romanji];
  for (const key of rawKeys) {
    const normalized = normalizeManagedScheduleKey(key);
    if (normalized) candidates.add(`alias:${normalized}`);
  }
  const sources = Array.isArray(managedLiveScheduleManifest.sources) ? managedLiveScheduleManifest.sources : [];
  for (const source of sources) {
    if (!source || typeof source !== "object") continue;
    const sourceUid = String(source.group_uid ?? "").trim();
    if (sourceUid && candidates.has(`uid:${sourceUid}`)) return source;
    const aliases = [
      source.group_name,
      source.group_name_romanji,
      ...(Array.isArray(source.aliases) ? source.aliases : []),
    ];
    for (const alias of aliases) {
      const normalizedAlias = normalizeManagedScheduleKey(alias);
      if (normalizedAlias && candidates.has(`alias:${normalizedAlias}`)) return source;
    }
  }
  return null;
}

function templateForManagedScheduleEvent(event: ManagedLiveScheduleEvent): AutoLiveTemplate {
  const key = String(event.template_key ?? "").trim() as AutoLiveTypeKey;
  return AUTO_LIVE_TEMPLATES[key] ?? AUTO_LIVE_TEMPLATES.type_4;
}

/** Day-level TimeTree TIF rows; precise stage slots come from festivals.json sync. */
function isManagedTifFestivalDayEvent(event: ManagedLiveScheduleEvent): boolean {
  const title = String(event.title ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  return /tokyo idol festival/.test(title) || /^tif(\s|$)/.test(title) || /\btif\b(?!\d*@)/.test(title);
}

function buildManagedScheduleLiveRow(
  save: GameSavePayload,
  group: Record<string, unknown>,
  source: ManagedLiveScheduleSource,
  event: ManagedLiveScheduleEvent,
): Record<string, unknown> | null {
  const dateIso = String(event.date ?? "").split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const template = templateForManagedScheduleEvent(event);
  const venueCatalog = getVenuesCatalog();
  const venue = venueCatalog.find((row) => row.uid === String(event.venue_uid ?? "").trim()) ?? null;
  const desiredStart = String(event.start_time ?? "").trim();
  const desiredEnd = String(event.end_time ?? "").trim();
  const startTime = /^\d{2}:\d{2}$/.test(desiredStart) ? desiredStart : template.defaultStart;
  const endTime = /^\d{2}:\d{2}$/.test(desiredEnd) ? desiredEnd : addMinutesToHHMM(startTime, template.defaultDurationMinutes);
  const liveType = String(event.live_type ?? template.liveType);
  const setlistCount = setlistCountForScheduledLive(
    liveType,
    startTime,
    endTime,
    template.defaultDurationMinutes,
    template.setlistCount,
  );
  const setlist = songTitlesForAutoLive(
    save,
    String(group.uid ?? ""),
    setlistCount,
  );
  const importedSource = String(source.source_key ?? "managed_schedule").trim() || "managed_schedule";
  const title = String(event.title ?? `${String(group.name ?? group.name_romanji ?? "Managed group")} ${template.titleSuffix}`).trim();
  return {
    uid: String(event.uid ?? `${importedSource}-${dateIso}-${title}`),
    title,
    title_romanji: "",
    event_type: String(event.event_type ?? template.eventType),
    live_type: liveType,
    start_date: dateIso,
    end_date: dateIso,
    start_time: startTime,
    end_time: endTime,
    duration: 0,
    rehearsal_start: "",
    rehearsal_end: "",
    venue: String(event.venue ?? venue?.name ?? "TBA"),
    venue_uid: String(event.venue_uid ?? venue?.uid ?? ""),
    location: String(venue?.location ?? ""),
    description: `Imported from ${String(source.label ?? "managed live schedule")}${event.source_url ? ` · ${event.source_url}` : ""}`,
    performance_count: 1,
    capacity: venue?.capacity ?? null,
    attendance: null,
    ticket_price: template.ticketPriceYen,
    poster_image_path: String(event.poster_image_path ?? ""),
    setlist,
    program: buildAutoProgramForLive(
      liveType,
      durationMinutesBetweenHHMM(startTime, endTime) ?? template.defaultDurationMinutes,
      setlist,
      `${importedSource}-program-${String(event.source_event_id ?? event.uid ?? "event")}`,
    ),
    tokutenkai_enabled: Boolean(event.tokutenkai_enabled ?? template.tokutenkaiEnabled),
    tokutenkai_start: String(
      event.tokutenkai_start ??
        ((event.tokutenkai_enabled ?? template.tokutenkaiEnabled) ? endTime : ""),
    ),
    tokutenkai_end: String(
      event.tokutenkai_end ??
        ((event.tokutenkai_enabled ?? template.tokutenkaiEnabled)
          ? addMinutesToHHMM(endTime, template.tokutenkaiDurationMinutes)
          : ""),
    ),
    tokutenkai_duration: template.tokutenkaiDurationMinutes,
    tokutenkai_ticket_price: template.tokutenkaiTicketPrice,
    tokutenkai_slot_seconds: template.tokutenkaiSlotSeconds,
    tokutenkai_expected_tickets: (event.tokutenkai_enabled ?? template.tokutenkaiEnabled) ? template.tokutenkaiExpectedTickets : 0,
    goods_enabled: false,
    goods_uid: "",
    goods_line: "",
    goods_expected_revenue_yen: 0,
    group: [String(group.name ?? group.name_romanji ?? "")].filter(Boolean),
    group_uid: String(group.uid ?? ""),
    status: "scheduled",
    imported_source: importedSource,
  };
}

function ensureManagedScheduleLivesInWindow(
  save: GameSavePayload,
  group: Record<string, unknown>,
  source: ManagedLiveScheduleSource,
  startIso: string,
  endIso: string,
): number {
  const relFile = String(source.file ?? "").trim();
  const file = relFile ? MANAGED_LIVE_SCHEDULE_DB.get(relFile) : null;
  const events = Array.isArray(file?.events) ? file.events : [];
  if (!events.length) return 0;
  const uidSet = existingUids(save);
  let added = 0;
  for (const event of events) {
    const dateIso = String(event.date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;
    if (dateIso < startIso || dateIso > endIso) continue;
    // Prefer festivals.json stage slots over a single TimeTree TIF day placeholder.
    if (isManagedTifFestivalDayEvent(event)) continue;
    const live = buildManagedScheduleLiveRow(save, group, source, event);
    if (!live) continue;
    const uid = String(live.uid ?? "");
    if (!uid || uidSet.has(uid)) continue;
    save.lives.schedules.push(live);
    uidSet.add(uid);
    added += 1;
  }
  return added;
}

function existingUids(save: GameSavePayload): Set<string> {
  const out = new Set<string>();
  for (const row of save.lives.schedules) {
    if (!row || typeof row !== "object") continue;
    const uid = String((row as Record<string, unknown>).uid ?? "");
    if (uid) out.add(uid);
  }
  return out;
}

function isOfficialScheduleGameplayLive(event: OfficialScheduleEvent): boolean {
  if (!event || typeof event !== "object") return false;
  if ((event as { is_live?: unknown }).is_live === false) return false;
  const type = String(event.type ?? "").trim();
  return type === "Concert" || type === "Festival" || type === "GuestLive" || type === "Taiban";
}

function officialScheduleLiveType(event: OfficialScheduleEvent): string {
  const type = String(event.type ?? "").trim();
  if (type === "Festival") return "Festival";
  if (type === "GuestLive" || type === "Taiban") return "Taiban";
  return "OneMan";
}

function officialScheduleTemplateForLiveType(liveType: string): AutoLiveTemplate {
  if (liveType === "Festival") return AUTO_LIVE_TEMPLATES.type_3;
  if (liveType === "Taiban") return AUTO_LIVE_TEMPLATES.type_4;
  return AUTO_LIVE_TEMPLATES.type_6;
}

function buildOfficialScheduleLiveRow(
  save: GameSavePayload,
  group: Record<string, unknown>,
  bundle: OfficialScheduleBundle,
  event: OfficialScheduleEvent,
): Record<string, unknown> | null {
  const dateIso = String(event.date ?? "").split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) return null;
  const liveType = officialScheduleLiveType(event);
  const template = officialScheduleTemplateForLiveType(liveType);
  const startTime = template.defaultStart;
  const endTime = addMinutesToHHMM(startTime, template.defaultDurationMinutes);
  const setlistCount = setlistCountForScheduledLive(
    liveType,
    startTime,
    endTime,
    template.defaultDurationMinutes,
    template.setlistCount,
  );
  const setlist = songTitlesForAutoLive(save, String(group.uid ?? ""), setlistCount);
  const title = String(event.event ?? event.event_raw ?? `${String(group.name ?? "Managed group")} ${template.titleSuffix}`).trim();
  const venue = String(event.venue ?? event.venue_hint ?? "TBA").trim() || "TBA";
  const detailUrl = String(event.official_detail_url ?? "").trim();
  const eventId = String(event.official_detail_id ?? "").trim();
  return {
    uid: `official-live-${String(bundle.group_key ?? "group")}-${dateIso}-${eventId || title}`,
    title,
    title_romanji: "",
    event_type: String(event.type ?? template.eventType),
    live_type: liveType,
    start_date: dateIso,
    end_date: dateIso,
    start_time: startTime,
    end_time: endTime,
    duration: template.defaultDurationMinutes,
    rehearsal_start: "",
    rehearsal_end: "",
    venue,
    venue_uid: String((event as { venue_uid?: unknown }).venue_uid ?? "").trim(),
    location: String(event.venue_hint ?? "").trim(),
    description: detailUrl ? `Imported from official future events - ${detailUrl}` : "Imported from official future events.",
    performance_count: 1,
    capacity: null,
    attendance: null,
    ticket_price: template.ticketPriceYen,
    poster_image_path: null,
    setlist,
    program: buildAutoProgramForLive(liveType, template.defaultDurationMinutes, setlist, `official-program-${eventId || dateIso}`),
    tokutenkai_enabled: false,
    tokutenkai_start: "",
    tokutenkai_end: "",
    tokutenkai_duration: 0,
    tokutenkai_ticket_price: 0,
    tokutenkai_slot_seconds: 0,
    tokutenkai_expected_tickets: 0,
    goods_enabled: false,
    goods_uid: "",
    goods_line: "",
    goods_expected_revenue_yen: 0,
    group: [String(group.name ?? group.name_romanji ?? "")].filter(Boolean),
    group_uid: String(group.uid ?? ""),
    status: "scheduled",
    imported_source: `official_schedule:${String(bundle.group_key ?? "group")}`,
    source_url: detailUrl,
  };
}

function ensureOfficialScheduleLivesInWindow(
  save: GameSavePayload,
  group: Record<string, unknown>,
  bundle: OfficialScheduleBundle,
  startIso: string,
  endIso: string,
): number {
  const uidSet = existingUids(save);
  let added = 0;
  for (const event of Array.isArray(bundle.events) ? bundle.events : []) {
    if (!isOfficialScheduleGameplayLive(event)) continue;
    const dateIso = String(event.date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) continue;
    if (dateIso < startIso || dateIso > endIso) continue;
    const live = buildOfficialScheduleLiveRow(save, group, bundle, event);
    if (!live) continue;
    const uid = String(live.uid ?? "");
    if (!uid || uidSet.has(uid)) continue;
    save.lives.schedules.push(live);
    uidSet.add(uid);
    added += 1;
  }
  return added;
}

export function purgeLegacyWeeklyAutopilotLives(save: GameSavePayload): void {
  save.lives.schedules = save.lives.schedules.filter((row) => {
    if (!row || typeof row !== "object") return false;
    const uid = String((row as Record<string, unknown>).uid ?? "");
    return !uid.startsWith("autopilot-live-");
  });
}

export function ensureAutoBookedLivesInWindow(
  save: GameSavePayload,
  startIso: string,
  endIso: string,
): number {
  const group = getPrimaryGroup(save);
  if (!group || typeof group !== "object") return 0;
  const officialBundle = findManagedOfficialScheduleBundleInRuntime(
    save.scenario_runtime?.official_schedules,
    group,
    save.managing_group ?? null,
  );
  if (officialBundle) {
    const added = ensureOfficialScheduleLivesInWindow(save, group, officialBundle, startIso, endIso);
    save.lives.schedules.sort((a, b) => {
      const da = String((a as Record<string, unknown>).start_date ?? "");
      const db = String((b as Record<string, unknown>).start_date ?? "");
      if (da !== db) return da.localeCompare(db);
      const ta = String((a as Record<string, unknown>).start_time ?? "");
      const tb = String((b as Record<string, unknown>).start_time ?? "");
      return ta.localeCompare(tb);
    });
    return added;
  }
  const managedSource = getManagedScheduleSourceForGroup(group);
  if (managedSource) {
    const added = ensureManagedScheduleLivesInWindow(save, group, managedSource, startIso, endIso);
    save.lives.schedules.sort((a, b) => {
      const da = String((a as Record<string, unknown>).start_date ?? "");
      const db = String((b as Record<string, unknown>).start_date ?? "");
      if (da !== db) return da.localeCompare(db);
      const ta = String((a as Record<string, unknown>).start_time ?? "");
      const tb = String((b as Record<string, unknown>).start_time ?? "");
      return ta.localeCompare(tb);
    });
    return added;
  }
  const tierRaw = String(getLetterTierFromGroup(group) ?? "D").trim().toUpperCase();
  if (tierRaw === "I") return 0;
  const tier = tierRaw;
  const row = liveMatrix().get(tier) ?? liveMatrix().get("D");
  if (!row) return 0;
  const uidSet = existingUids(save);
  let added = 0;
  let monthStart = startOfMonthIso(startIso);
  const endMonth = startOfMonthIso(endIso);
  while (monthStart <= endMonth) {
    const minIso = monthStart === startOfMonthIso(startIso) ? startIso : undefined;
    for (const typeKey of AUTO_LIVE_TYPE_KEYS) {
      const count = countForMonth(row[typeKey], monthStart);
      if (count <= 0) continue;
      const template = AUTO_LIVE_TEMPLATES[typeKey];
      const dates = pickDistributedDates(monthStart, count, template.preferredWeekdays, minIso);
      dates.forEach((dateIso, ordinal) => {
        const live = buildAutoLiveRow({
          save,
          group,
          tier,
          venueRank: row.type_6_venue_rank,
          monthStartIso: monthStart,
          dateIso,
          typeKey,
          ordinal,
        });
        const uid = String(live.uid ?? "");
        if (!uid || uidSet.has(uid)) return;
        save.lives.schedules.push(live);
        uidSet.add(uid);
        added += 1;
      });
    }
    monthStart = addMonths(monthStart, 1);
  }
  save.lives.schedules.sort((a, b) => {
    const da = String((a as Record<string, unknown>).start_date ?? "");
    const db = String((b as Record<string, unknown>).start_date ?? "");
    if (da !== db) return da.localeCompare(db);
    const ta = String((a as Record<string, unknown>).start_time ?? "");
    const tb = String((b as Record<string, unknown>).start_time ?? "");
    return ta.localeCompare(tb);
  });
  return added;
}

export function ensureAutoBookedLivesThroughEndOfNextMonth(save: GameSavePayload): number {
  purgeLegacyWeeklyAutopilotLives(save);
  const startIso = save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01";
  const endIso = endOfMonthIso(addMonths(startOfMonthIso(startIso), 1));
  return ensureAutoBookedLivesInWindow(save, startIso, endIso);
}

export function autoBookMonthFromMonthEndPrompt(save: GameSavePayload, monthStartIso: string): number {
  const endIso = endOfMonthIso(monthStartIso);
  const added = ensureAutoBookedLivesInWindow(save, monthStartIso, endIso);
  if (added > 0) {
    addNotification(save, {
      title: `Auto-booked lives: ${monthStartIso.slice(0, 7)}`,
      body: `${added} default live(s) were booked from the monthly live count reference for ${monthStartIso.slice(0, 7)}.`,
      sender: "Operations",
      category: "internal",
      level: "normal",
      isoDate: save.current_date ?? monthStartIso,
      unread: true,
      dedupeKey: `auto-booked-lives|${String(getPrimaryGroup(save)?.uid ?? "")}|${monthStartIso}`,
    });
  }
  return added;
}

export function maybeSeedMonthEndAutoBookPrompt(save: GameSavePayload): void {
  const currentIso = save.current_date ?? save.game_start_date ?? save.scenario_context.startup_date ?? "2020-01-01";
  if (currentIso !== endOfMonthIso(startOfMonthIso(currentIso))) return;
  const group = getPrimaryGroup(save);
  const officialBundle = findManagedOfficialScheduleBundleInRuntime(
    save.scenario_runtime?.official_schedules,
    group,
    save.managing_group ?? null,
  );
  if (officialBundle) return;
  if (getManagedScheduleSourceForGroup(group)) return;
  const gid = String(group?.uid ?? "");
  if (!gid) return;
  const targetMonth = addMonths(startOfMonthIso(currentIso), 2);
  const alreadyHas = save.lives.schedules.some((row) => {
    if (!row || typeof row !== "object") return false;
    const d = String((row as Record<string, unknown>).start_date ?? "").split("T")[0];
    return d >= targetMonth && d <= endOfMonthIso(targetMonth) && String((row as Record<string, unknown>).group_uid ?? "") === gid;
  });
  if (alreadyHas) return;
  addNotification(save, {
    title: `Auto-book lives for ${targetMonth.slice(0, 7)}?`,
    body: `Month-end booking reminder. Confirm to create default lives for ${targetMonth.slice(0, 7)} using the monthly live count reference for your letter tier.`,
    sender: "Operations",
    category: "confirmation",
    level: "high",
    isoDate: currentIso,
    unread: true,
    requiresConfirmation: true,
    dedupeKey: `auto-book-lives|${gid}|${targetMonth}`,
  });
}
