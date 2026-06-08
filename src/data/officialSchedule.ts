import type { OfficialScheduleBundle, OfficialScheduleEvent, LoadedScenario } from "./scenarioTypes";
import type { GameSavePayload } from "../save/gameSaveSchema";

export type MediaTab = "tv" | "live_events" | "radio" | "books" | "online";

function normalizeKey(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･·•"'`’]/g, "");
}

function textOfEvent(event: OfficialScheduleEvent): string {
  return [
    String(event.event ?? "").trim(),
    String(event.event_raw ?? "").trim(),
    String(event.site_category ?? "").trim(),
    String(event.type ?? "").trim(),
    String(event.venue ?? "").trim(),
    String(event.venue_hint ?? "").trim(),
  ]
    .filter(Boolean)
    .join(" ");
}

export function findManagedOfficialScheduleBundle(
  scenario: LoadedScenario | null,
  save: GameSavePayload | null,
): OfficialScheduleBundle | null {
  if (!scenario || !save || !Array.isArray(scenario.official_schedules) || !scenario.official_schedules.length) {
    return null;
  }
  const managedUid = String(save.managing_group_uid ?? "").trim();
  const managedGroup =
    scenario.groups.find((row) => String((row as { uid?: unknown }).uid ?? "").trim() === managedUid) ??
    save.database_snapshot.groups.find((row) => String((row as { uid?: unknown }).uid ?? "").trim() === managedUid) ??
    null;
  const candidates = new Set(
    [
      String((managedGroup as { name?: unknown } | null)?.name ?? "").trim(),
      String((managedGroup as { name_romanji?: unknown } | null)?.name_romanji ?? "").trim(),
      String(save.managing_group ?? "").trim(),
    ]
      .filter(Boolean)
      .map(normalizeKey),
  );
  if (!candidates.size) return null;
  return (
    scenario.official_schedules.find((bundle) => {
      const names = [bundle.group_name, bundle.group_key, ...(Array.isArray(bundle.aliases) ? bundle.aliases : [])]
        .map((value) => normalizeKey(String(value ?? "").trim()))
        .filter(Boolean);
      return names.some((name) => candidates.has(name));
    }) ?? null
  );
}

export function officialScheduleEvents(bundle: OfficialScheduleBundle | null | undefined): OfficialScheduleEvent[] {
  return Array.isArray(bundle?.events) ? bundle!.events : [];
}

export function officialScheduleDate(event: OfficialScheduleEvent): string {
  return String(event.date ?? "").split("T")[0];
}

export function officialScheduleMembers(event: OfficialScheduleEvent, bundle?: OfficialScheduleBundle | null): string[] {
  const rows = Array.isArray(event.members)
    ? event.members.map((member) => String(member ?? "").trim()).filter(Boolean)
    : [];
  if (!bundle) return rows;
  const groupNames = new Set(
    [bundle.group_name, bundle.group_key, ...(Array.isArray(bundle.aliases) ? bundle.aliases : [])]
      .map((value) => normalizeKey(String(value ?? "").trim()))
      .filter(Boolean),
  );
  return rows.filter((row) => !groupNames.has(normalizeKey(row)));
}

export function officialScheduleScopeLabel(event: OfficialScheduleEvent, bundle?: OfficialScheduleBundle | null): string {
  const members = officialScheduleMembers(event, bundle);
  return members.length ? members.join(", ") : "Group";
}

export function officialScheduleVenueLabel(event: OfficialScheduleEvent): string {
  return String(event.venue ?? event.venue_hint ?? "").trim() || "-";
}

export function officialScheduleLink(event: OfficialScheduleEvent): string {
  return String(event.official_detail_url ?? "").trim();
}

export function classifyOfficialMediaTab(event: OfficialScheduleEvent): MediaTab | null {
  const type = String(event.type ?? "").trim().toLocaleLowerCase();
  const text = textOfEvent(event).toLocaleLowerCase();
  const raw = text.normalize("NFKC");

  if (type === "concert" || type === "festival" || type === "guestlive" || type === "tvshow") {
    return null;
  }
  if (/\btour\b|premium tour|anniversary tour|concert|festival|ワンマン|ツアー|ライブ|コンサート/.test(raw)) {
    return null;
  }
  if (/\bonline\b|showroom|youtube live|instagram live|line live|配信|オンライン|webサイン|ネットサイン/.test(raw)) {
    return "online";
  }
  if (
    type === "offlineevent" ||
    type === "meet" ||
    /撮影会|握手会|特典会|お渡し会|お話し会|始球式|スポーツ|試合|登壇|リリースイベント|発売記念/.test(raw)
  ) {
    return "live_events";
  }
  if (/\bradio\b|radiko|ラジオ|放送|podcast|ポッドキャスト/.test(raw)) {
    return "radio";
  }
  if (
    /\bbook\b|magazine|photo\s*book|photobook|newspaper|calendar|brody|bubka|entame|雑誌|写真集|フォトブック|新聞|ムック|週刊|月刊|書籍|ブック|連載/.test(
      raw,
    )
  ) {
    return "books";
  }
  return "tv";
}

export function officialScheduleTabLabel(tab: MediaTab): string {
  switch (tab) {
    case "tv":
      return "TV";
    case "live_events":
      return "Live events";
    case "radio":
      return "Radio";
    case "books":
      return "Books";
    case "online":
      return "Online";
  }
}

export function sortOfficialScheduleEvents(events: OfficialScheduleEvent[]): OfficialScheduleEvent[] {
  return [...events].sort((a, b) => {
    const aDate = officialScheduleDate(a);
    const bDate = officialScheduleDate(b);
    if (aDate !== bDate) return aDate.localeCompare(bDate);
    return String(a.event ?? "").localeCompare(String(b.event ?? ""));
  });
}
