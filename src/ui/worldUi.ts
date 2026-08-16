import type { GameSavePayload } from "../save/gameSaveSchema";
import { getPrimaryGroup } from "../save/gameSaveSchema";
import { getBlockingNotificationForSave, isoDatePart } from "../engine/gameEngine";
import { sortNotificationsInPlace, type NotificationRow } from "../save/inbox";
import type { DesktopNavId } from "./gameShell";
import { htmlEsc } from "./htmlEsc";
import { navLabel, type UiLanguage } from "./i18n";
import { attrQuotedUrl, avatarPlaceholderDataUrl, idolPortraitPublicSrc } from "./portraitUrl";

export type WorldRoomId = "producer" | "staff" | "meeting" | "studio" | "recording" | "studio2";
export type WorldZoomTarget = "members" | "history" | null;
export type WorldVenueFocus = "stage" | "tokutenkai" | "backstage" | "entry" | null;

export interface WorldShellRenderProps {
  lang: UiLanguage;
  browseMode: boolean;
  save: GameSavePayload | null;
  currentView: DesktopNavId;
  worldRoom: WorldRoomId;
  phoneOpen: boolean;
  phoneMessageUid?: string | null;
  calendarOpen: boolean;
  dateLabel: string;
  mainInner: string;
  nextDayBtn: string;
  cashPill: string;
  homeMenuHtml: string;
  canGoBack: boolean;
  canGoForward: boolean;
  liveModeSessionActive: boolean;
  wikiModalHtml: string;
  feedbackModalHtml: string;
  footerHtml: string;
  zoomTarget: WorldZoomTarget;
  zoomProfileInner?: string | null;
  worldVenueFocus?: WorldVenueFocus;
}

const WORLD_ROOMS: Array<{
  id: WorldRoomId;
  label: string;
  sub: string;
  nav: DesktopNavId;
  actors: number;
  furniture: string[];
}> = [
  { id: "producer", label: "Producer Room", sub: "desk / computer", nav: "Inbox", actors: 0, furniture: ["desk", "monitor", "wall"] },
  { id: "staff", label: "Staff Room", sub: "operations", nav: "Finances", actors: 3, furniture: ["tables", "files"] },
  { id: "meeting", label: "Meeting Room", sub: "decisions", nav: "Scout", actors: 2, furniture: ["meeting-table", "whiteboard"] },
  { id: "studio", label: "Practice Studio", sub: "rehearsal", nav: "Training", actors: 7, furniture: ["mirror", "barre"] },
  { id: "recording", label: "Recording Room", sub: "takes", nav: "Making", actors: 3, furniture: ["booth", "console"] },
  { id: "studio2", label: "Practice Studio 2", sub: "advanced rehearsal", nav: "Training", actors: 9, furniture: ["mirror", "barre"] },
];

const COMPUTER_APPS: Array<{ nav: DesktopNavId; label: string; glyph: string }> = [
  { nav: "Groups", label: "All Groups", glyph: "GRP" },
  { nav: "Idols", label: "All Idols", glyph: "ID" },
  { nav: "Scout", label: "Audition", glyph: "AUD" },
  { nav: "Schedule", label: "Schedule", glyph: "CAL" },
  { nav: "Lives", label: "Lives", glyph: "LIV" },
  { nav: "Training", label: "Rehearsal", glyph: "TRN" },
  { nav: "Making", label: "Release", glyph: "REL" },
  { nav: "Finances", label: "Finance", glyph: "JPY" },
  { nav: "Inbox", label: "Reports", glyph: "RPT" },
];

const DOLL_POSITIONS = [
  ["18%", "52%"],
  ["34%", "62%"],
  ["54%", "49%"],
  ["70%", "64%"],
  ["28%", "70%"],
  ["47%", "44%"],
  ["80%", "52%"],
] as const;

type OfficeTier = "E" | "D" | "C" | "B" | "A";

function officeTierFromSave(save: GameSavePayload | null): OfficeTier {
  const group = save ? getPrimaryGroup(save) : null;
  const raw = String(group?.letter_tier ?? group?.tier ?? "").trim().toUpperCase();
  if (raw === "E" || raw === "F") return "E";
  if (raw === "D") return "D";
  if (raw === "C") return "C";
  if (raw === "B") return "B";
  return "A";
}

function officeTierLabel(tier: OfficeTier): string {
  return tier === "A" ? "A+" : tier;
}

function officeTierAsset(tier: OfficeTier): string {
  return `/assets/world-ui-v2/agency-map-${tier.toLowerCase()}.png`;
}

function roomsForTier(tier: OfficeTier): typeof WORLD_ROOMS {
  const allowed: WorldRoomId[] =
    tier === "E"
      ? ["producer", "studio"]
      : tier === "D"
        ? ["producer", "meeting", "studio"]
        : tier === "C"
          ? ["producer", "meeting", "studio", "staff"]
          : tier === "B"
            ? ["producer", "meeting", "studio", "staff", "recording"]
            : ["producer", "meeting", "studio", "staff", "recording", "studio2"];
  return WORLD_ROOMS.filter((room) => allowed.includes(room.id));
}

function managedMembers(save: GameSavePayload | null): Array<{ uid: string; name: string; row: Record<string, unknown> }> {
  if (!save) return [];
  const group = getPrimaryGroup(save);
  const memberUids = Array.isArray(group?.member_uids) ? group.member_uids.map((uid) => String(uid)) : [];
  return memberUids
    .map((uid) => {
      const idol = save.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid);
      const name = String(idol?.name ?? idol?.name_romanji ?? "").trim();
      return name && idol ? { uid, name, row: idol } : null;
    })
    .filter((row): row is { uid: string; name: string; row: Record<string, unknown> } => Boolean(row))
    .slice(0, 12);
}

function historyStats(save: GameSavePayload | null): {
  pastMembers: number;
  yearFiles: number;
  souvenirs: number;
  years: string[];
  pastNames: string[];
} {
  const group = save ? getPrimaryGroup(save) : null;
  const pastUids = Array.isArray(group?.past_member_uids) ? group.past_member_uids.map((uid) => String(uid)).filter(Boolean) : [];
  const pastNames = Array.isArray(group?.past_member_names)
    ? group.past_member_names.map((name) => String(name).trim()).filter(Boolean)
    : [];
  const start = String(group?.formed_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? "").slice(0, 4);
  const current = String(save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? "").slice(0, 4);
  const startYear = /^\d{4}$/.test(start) ? Number(start) : /^\d{4}$/.test(current) ? Number(current) : 2025;
  const currentYear = /^\d{4}$/.test(current) ? Number(current) : startYear;
  const years = Array.from({ length: Math.max(1, currentYear - startYear + 1) }, (_, i) => String(startYear + i));
  const discography = Array.isArray(group?.discography) ? group.discography : [];
  const milestoneDiscs = discography.filter((raw) => {
    if (!raw || typeof raw !== "object") return false;
    const row = raw as Record<string, unknown>;
    const type = String(row.disc_type ?? "").toLowerCase();
    return /single|album|ep|debut|major|anniversary/.test(type);
  });
  return {
    pastMembers: Math.max(pastUids.length, pastNames.length, Number(group?.past_member_count ?? 0) || 0),
    yearFiles: years.length,
    souvenirs: Math.max(0, Math.min(24, milestoneDiscs.length || discography.length)),
    years,
    pastNames: pastNames.slice(0, 30),
  };
}

function hourFromSave(save: GameSavePayload | null): number {
  const raw = String(save?.current_date ?? save?.game_start_date ?? "").trim();
  const match = /T(\d{2})/.exec(raw);
  return match ? Number(match[1]) : 8;
}

function renderCalendarOverlay(save: GameSavePayload | null, dateLabel: string): string {
  const today = isoDatePart(save?.current_date ?? save?.game_start_date ?? "");
  const schedules = Object.values(save?.schedules ?? {}).filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"));
  const rows = schedules
    .filter((row) => String(row.start_date ?? row.date ?? "").slice(0, 10) >= today)
    .sort((a, b) => String(a.start_date ?? a.date ?? "").localeCompare(String(b.start_date ?? b.date ?? "")))
    .slice(0, 4)
    .map((row) => {
      const date = String(row.start_date ?? row.date ?? "").slice(0, 10);
      const time = String(row.start_time ?? "").slice(0, 5);
      const title = String(row.title ?? row.live_type ?? row.event_type ?? "Scheduled work");
      const venue = String(row.venue ?? "");
      return `<li><span>${htmlEsc([date === today ? "Today" : date, time].filter(Boolean).join(" "))}</span><strong>${htmlEsc(title)}</strong>${venue ? `<em>${htmlEsc(venue)}</em>` : ""}</li>`;
    })
    .join("");
  return `<section class="world-popover world-calendar-popover" aria-label="Calendar">
    <h2>${htmlEsc(dateLabel)}</h2>
    <ul>${rows || `<li><span>Today</span><strong>No fixed events</strong><em>Use Next or move proactively.</em></li>`}</ul>
    <button type="button" class="world-link-btn" data-nav="Schedule">Full Calendar</button>
  </section>`;
}

function notificationLevel(item: NotificationRow): "silent" | "info" | "actionable" | "required" | "urgent" {
  const level = String(item.level ?? "").toLowerCase();
  if (level.includes("urgent") || level.includes("critical")) return "urgent";
  if (item.requires_confirmation || String(item.choice_status ?? "") === "pending") return "required";
  if (!item.read) return "actionable";
  if (level.includes("silent")) return "silent";
  return "info";
}

function notificationBodyText(item: NotificationRow): string {
  const body = String(item.body ?? "").trim();
  if (body) return body;
  const report = item.report_data && typeof item.report_data === "object" ? item.report_data : null;
  if (!report) return "No plain-text message body. Open Inbox for the full detail view.";
  const summary = Object.entries(report)
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .slice(0, 8)
    .map(([key, value]) => {
      const label = key.replaceAll("_", " ");
      if (Array.isArray(value)) return `${label}: ${value.length} item(s)`;
      if (typeof value === "object") return `${label}: details attached`;
      return `${label}: ${String(value)}`;
    })
    .join("\n");
  return summary ? `${summary}\n\nOpen Inbox for the full action view.` : "Open Inbox for the full detail view.";
}

function notificationHasLiveShortcut(item: NotificationRow): boolean {
  const text = [item.title, item.category, item.related_event_uid, item.dedupe_key]
    .map((value) => String(value ?? "").toLowerCase())
    .join(" ");
  return /upcoming lives|today'?s live|live schedule|live report|booked lives|scheduled live|concert|venue|setlist|tokutenkai|festival/.test(text);
}

function renderPhoneTray(save: GameSavePayload | null): string {
  const notifications = save?.inbox?.notifications ? [...save.inbox.notifications] : [];
  sortNotificationsInPlace(notifications);
  const rows = notifications.slice(0, 6).map((item) => {
    const time = String(item.created_at ?? "").split("T")[1]?.slice(0, 5) || "";
    const level = notificationLevel(item);
    const shortcut = notificationHasLiveShortcut(item)
      ? `<button type="button" class="world-phone-shortcut world-phone-shortcut--row" data-world-live-shortcut>Move to venue</button>`
      : "";
    return `<article class="world-phone-row is-${level}">
      <time>${htmlEsc(time || String(item.date ?? "").slice(5, 10))}</time>
      <button type="button" class="world-phone-message" data-world-phone-message="${htmlEsc(item.uid)}"><strong>${htmlEsc(item.title || "Assistant note")}</strong></button>
      ${shortcut}
    </article>`;
  }).join("");
  return `<section class="world-popover world-phone-tray" aria-label="Assistant phone">
    <div class="world-phone-tray-head">
      <h2>Assistant</h2>
    </div>
    <div class="world-phone-list">
      ${rows || `<div class="world-phone-row is-info"><time>--:--</time><strong>No pending calls</strong></div>`}
    </div>
    <button type="button" class="world-link-btn" data-nav="Inbox">Open Inbox</button>
  </section>`;
}

function renderQDoll(className: string, label: string, i: number, actor = true): string {
  const data = actor ? " data-world-actor" : "";
  const [left, top] = DOLL_POSITIONS[i % DOLL_POSITIONS.length] ?? DOLL_POSITIONS[0];
  return `<span class="${className}"${data} style="--actor-index:${i};--doll-left:${left};--doll-top:${top}" title="${htmlEsc(label)}"><i></i><b></b></span>`;
}

type RoomWorkflowCard = {
  title: string;
  body: string;
  tag: string;
  nav: DesktopNavId;
};

type RoomWorkflow = {
  eyebrow: string;
  mode: string;
  objective: string;
  metrics: Array<[string, string]>;
  cards: RoomWorkflowCard[];
  timeline: Array<{ time: string; title: string; sub: string }>;
};

function upcomingLiveSummary(save: GameSavePayload | null): { title: string; meta: string } {
  const today = isoDatePart(save?.current_date ?? save?.game_start_date ?? "");
  const schedules = Array.isArray(save?.lives?.schedules) ? save.lives.schedules : [];
  const upcoming = schedules
    .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
    .sort((a, b) => String(a.start_date ?? a.date ?? "").localeCompare(String(b.start_date ?? b.date ?? "")));
  const next = upcoming.find((row) => String(row.start_date ?? row.date ?? "").slice(0, 10) >= today) ?? upcoming[0] ?? null;
  if (!next) return { title: "Next event not fixed", meta: "Open the schedule or live planner" };
  const title = String(next.title ?? next.live_type ?? next.event_type ?? "Scheduled live");
  const date = String(next.start_date ?? next.date ?? "").slice(0, 10);
  const time = String(next.start_time ?? "").slice(0, 5);
  const venue = String(next.venue ?? next.venue_name ?? "").trim();
  return { title, meta: [date, time, venue].filter(Boolean).join(" / ") || "Scheduled live" };
}

function roomWorkflow(roomId: WorldRoomId, p: WorldShellRenderProps): RoomWorkflow {
  const live = upcomingLiveSummary(p.save);
  const members = managedMembers(p.save);
  const blocker = p.save ? getBlockingNotificationForSave(p.save) : null;
  const sharedMetrics: Array<[string, string]> = [
    ["Next event", live.meta],
    ["Member pool", `${members.length || 0} active`],
    ["Assistant", blocker?.title ?? "No blocking decision"],
  ];
  if (roomId === "meeting") {
    return {
      eyebrow: "Meeting Room",
      mode: "event decision board",
      objective: live.title,
      metrics: sharedMetrics,
      cards: [
        { tag: "EVENT", title: "Event objective", body: "Set target draw, fan segment, and acceptable risk before the team spends time.", nav: "Lives" },
        { tag: "ROLES", title: "Member roles", body: "Lock center, featured members, and development notes as decisions tied to this event.", nav: "Idols" },
        { tag: "PROMO", title: "Fan appreciation angle", body: "Choose the story, benefit, or talk theme that gives attendance a reason to repeat.", nav: "Media" },
      ],
      timeline: [
        { time: "Brief", title: "Confirm event purpose", sub: "growth, retention, prestige, or cash" },
        { time: "Decide", title: "Assign owners", sub: "producer, staff, and member responsibilities" },
        { time: "Follow-up", title: "Send work to rooms", sub: "practice, staff ops, recording, or venue" },
      ],
    };
  }
  if (roomId === "staff") {
    return {
      eyebrow: "Staff Room",
      mode: "event operations board",
      objective: live.title,
      metrics: sharedMetrics,
      cards: [
        { tag: "ENTRY", title: "Ticketing and entry", body: "Match venue size, expected walk-up, and queue pressure to the event goal.", nav: "Schedule" },
        { tag: "GOODS", title: "Fan appreciation stock", body: "Prepare goods, perks, and post-live touchpoints for acquisition and return visits.", nav: "Lives" },
        { tag: "BUDGET", title: "Staffing guardrail", body: "Keep cash, staff load, and failure points visible before committing.", nav: "Finances" },
      ],
      timeline: [
        { time: "Ops", title: "Confirm venue packet", sub: "entry, backstage, goods, tokutenkai" },
        { time: "Comms", title: "Fan mobilization check", sub: "message timing and segment fit" },
        { time: "Close", title: "Prepare report", sub: "attendance, sales, retention signal" },
      ],
    };
  }
  if (roomId === "recording") {
    return {
      eyebrow: "Recording Room",
      mode: "production pipeline",
      objective: live.title,
      metrics: sharedMetrics,
      cards: [
        { tag: "SONG", title: "Song brief", body: "Tie the recording target to the next event, release window, or fan activity.", nav: "Making" },
        { tag: "PARTS", title: "Part map", body: "Assign lines and confidence risk by member condition instead of raw sliders.", nav: "Songs" },
        { tag: "TAKES", title: "Take queue", body: "Prioritize polish where the audience will notice it most.", nav: "Media" },
      ],
      timeline: [
        { time: "Booth", title: "Warm-up and guide", sub: "member readiness and vocal target" },
        { time: "Take", title: "Record priority parts", sub: "center, hooks, chorus, adlibs" },
        { time: "Control", title: "Approve package", sub: "mix notes and release readiness" },
      ],
    };
  }
  const advanced = roomId === "studio2";
  return {
    eyebrow: advanced ? "Practice Studio 2" : "Practice Studio",
    mode: advanced ? "advanced arrangement rehearsal" : "event arrangement rehearsal",
    objective: live.title,
    metrics: sharedMetrics,
    cards: [
      { tag: "SET", title: "Setlist block", body: "Arrange songs, MC, and transitions around the event purpose.", nav: "Lives" },
      { tag: "FORM", title: advanced ? "Advanced formation pass" : "Formation pass", body: "Place members by role, stamina, and fan-facing moments on the floor.", nav: "Training" },
      { tag: "CARE", title: "Condition and appreciation", body: "Balance practice load with the fan activity that follows the performance.", nav: "Schedule" },
    ],
    timeline: [
      { time: "Block", title: "Map the stage", sub: "entrance, center swaps, exit path" },
      { time: "Run", title: "Rehearse event flow", sub: "songs, MC, transitions, fan service" },
      { time: "Review", title: "Record fixes", sub: "who needs support before venue day" },
    ],
  };
}

function renderRoomParticipants(save: GameSavePayload | null, count: number): string {
  const members = managedMembers(save);
  const rows = members.slice(0, Math.max(3, count)).map((member, i) => {
    const initials = member.name
      .split(/\s+/)
      .map((part) => part[0] ?? "")
      .join("")
      .slice(0, 2)
      .toUpperCase();
    return `<span class="world-room-person" style="--person-i:${i}" title="${htmlEsc(member.name)}"><b>${htmlEsc(initials || String(i + 1))}</b><em>${htmlEsc(member.name)}</em></span>`;
  }).join("");
  const fallback = Array.from({ length: Math.max(3, count) }, (_, i) => `<span class="world-room-person" style="--person-i:${i}"><b>${i + 1}</b><em>member</em></span>`).join("");
  return `<div class="world-room-participants">${rows || fallback}</div>`;
}

function renderRoomTimeline(items: RoomWorkflow["timeline"]): string {
  return `<ol class="world-room-timeline">${items
    .map((item) => `<li><span>${htmlEsc(item.time)}</span><strong>${htmlEsc(item.title)}</strong><em>${htmlEsc(item.sub)}</em></li>`)
    .join("")}</ol>`;
}

function renderAgencyMap(activeRoom: WorldRoomId, save: GameSavePayload | null): string {
  const tier = officeTierFromSave(save);
  const rooms = roomsForTier(tier);
  const active = rooms.some((room) => room.id === activeRoom) ? activeRoom : "producer";
  return `<section class="world-map-panel" aria-label="Agency complex">
    <div class="world-map-title"><span>Tier ${htmlEsc(officeTierLabel(tier))} Agency</span><strong data-world-activity-label>sorting overnight notes</strong></div>
    <div class="world-map-art world-map-art--tier-${htmlEsc(tier)}" data-office-tier="${htmlEsc(tier)}">
      <div class="world-map-stage">
        <img class="world-map-building" src="${htmlEsc(officeTierAsset(tier))}" alt="" aria-hidden="true" />
        ${rooms.map((room, i) => {
          const isActive = room.id === active;
          return `<button type="button" class="world-room-hotspot world-room-hotspot--${room.id}${isActive ? " is-active" : ""}" style="--room-i:${i};--room-count:${rooms.length}" data-world-room="${room.id}" data-nav="${room.nav}">
            <span class="world-room-copy"><strong>${htmlEsc(room.label)}</strong><em>${htmlEsc(room.sub)}</em></span>
            ${isActive ? `<span class="world-map-pin" aria-hidden="true"></span>` : ""}
          </button>`;
        }).join("")}
      </div>
    </div>
  </section>`;
}

function renderVenueMap(): string {
  return `<section class="world-venue-map-panel" aria-label="Venue map">
    <div class="world-map-title"><span>Venue</span><strong data-world-activity-label>live site check-in</strong></div>
    <div class="world-venue-map-art">
      <button type="button" class="world-venue-zone world-venue-zone--stage" data-world-venue-zone="stage" data-nav="Lives">
        <strong>Stage</strong><em>performance floor</em>
      </button>
      <button type="button" class="world-venue-zone world-venue-zone--backstage" data-world-venue-zone="backstage" data-nav="Lives">
        <strong>Backstage</strong><em>green room</em>
      </button>
      <button type="button" class="world-venue-zone world-venue-zone--audience" data-world-venue-zone="audience" data-nav="Lives">
        <strong>Audience</strong><em>fan response</em>
      </button>
      <button type="button" class="world-venue-zone world-venue-zone--tokutenkai" data-world-venue-zone="tokutenkai" data-nav="Lives">
        <strong>Tokutenkai</strong><em>post-live meet</em>
      </button>
      <button type="button" class="world-venue-zone world-venue-zone--goods" data-world-venue-zone="goods" data-nav="Lives">
        <strong>Goods</strong><em>sales table</em>
      </button>
      <button type="button" class="world-venue-zone world-venue-zone--entry" data-world-venue-zone="entry" data-nav="Lives">
        <strong>Entry</strong><em>schedule desk</em>
      </button>
    </div>
  </section>`;
}

function renderMemberWall(save: GameSavePayload | null): string {
  const members = managedMembers(save);
  return `<button type="button" class="producer-wall producer-wall--members" data-nav="Idols" aria-label="Current Member Wall">
    <span>Current Members</span>
    <span class="producer-photo-strip">${members.slice(0, 6).map((m) => `<i title="${htmlEsc(m.name)}">${htmlEsc(m.name.slice(0, 1))}</i>`).join("") || "<i></i><i></i><i></i>"}</span>
  </button>`;
}

function renderMemberWallOverlay(save: GameSavePayload | null): string {
  const members = managedMembers(save);
  const asOf = save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? null;
  const cells = members.slice(0, 12).map((member) => {
    const src = idolPortraitPublicSrc(member.row, asOf);
    const fb = avatarPlaceholderDataUrl(member.name);
    const img = src
      ? `<img src="${htmlEsc(src)}" data-fallback="${attrQuotedUrl(fb)}" alt="${htmlEsc(member.name)}" />`
      : `<img src="${attrQuotedUrl(fb)}" alt="${htmlEsc(member.name)}" />`;
    return `<span class="producer-member-photo" title="${htmlEsc(member.name)}">${img}<em>${htmlEsc(member.name)}</em></span>`;
  }).join("");
  return `<button type="button" class="producer-member-wall-live" data-world-zoom="members" aria-label="Current Member Wall">
    <span class="producer-wall-live-title">Current Members <strong>${members.length}</strong></span>
    <span class="producer-member-photo-grid">${cells}</span>
  </button>`;
}

function renderHistoryCabinetOverlay(save: GameSavePayload | null): string {
  const stats = historyStats(save);
  return `<button type="button" class="producer-history-live" data-world-zoom="history" aria-label="History Cabinet">
    <span class="producer-history-live-title">History Cabinet</span>
    <span class="producer-history-shelf"><b>${stats.pastMembers}</b><em>former member files</em></span>
    <span class="producer-history-shelf"><b>${stats.yearFiles}</b><em>year files</em></span>
    <span class="producer-history-shelf"><b>${stats.souvenirs}</b><em>souvenirs</em></span>
  </button>`;
}

function renderProducerRoom(p: WorldShellRenderProps): string {
  const hour = hourFromSave(p.save);
  const isNight = hour < 6 || hour >= 18;
  const blocker = p.save ? getBlockingNotificationForSave(p.save) : null;
  const unreadCount = p.save?.inbox?.notifications?.filter((item) => !item.read).length ?? 0;
  const monitorInner =
    p.currentView === "Inbox"
      ? `<div class="producer-app-grid">
            ${COMPUTER_APPS.map((app) => `<button type="button" class="producer-app" data-nav="${app.nav}"><span>${htmlEsc(app.glyph)}</span>${htmlEsc(app.label)}</button>`).join("")}
          </div>
          <p>${htmlEsc(blocker?.title ?? (unreadCount ? `${unreadCount} assistant item(s) waiting on the phone.` : "Office systems online."))}</p>`
      : `<div class="producer-monitor-tab-content">${p.mainInner}</div>`;
  return `<section class="producer-room${isNight ? " is-night" : " is-day"}" aria-label="Producer Room">
    <div class="producer-room-bg">
      <div class="producer-room-stage">
        <button type="button" class="producer-photo-hotspot" data-world-zoom="members" aria-label="Current Member Wall"></button>
        <button type="button" class="producer-history-hotspot" data-world-zoom="history" aria-label="History Cabinet"></button>
        ${renderMemberWallOverlay(p.save)}
        ${renderHistoryCabinetOverlay(p.save)}
        <div class="producer-computer" role="group" aria-label="Producer computer">
          <div class="producer-monitor">
            <div class="producer-monitor-bar"><strong>IDOL PRODUCER</strong><span>${htmlEsc(navLabel(p.lang, p.currentView))}</span></div>
            ${monitorInner}
          </div>
          <div class="producer-keyboard"></div>
          <div class="producer-desk"></div>
        </div>
      </div>
    </div>
  </section>`;
}

function renderRoomFocus(p: WorldShellRenderProps): string {
  if (p.currentView === "Lives" && p.worldVenueFocus) {
    return `<section class="world-focus-venue-stage world-focus-venue-stage--${htmlEsc(p.worldVenueFocus)}" aria-label="Venue focus view">
      ${p.mainInner}
    </section>`;
  }
  if (p.worldRoom === "producer") return renderProducerRoom(p);
  const room = WORLD_ROOMS.find((item) => item.id === p.worldRoom) ?? WORLD_ROOMS[0];
  const workflow = roomWorkflow(room.id, p);
  const cardHtml = workflow.cards
    .map(
      (card, i) => `<button type="button" class="world-flow-card${i === 0 ? " world-flow-card--accent" : ""}" data-nav="${htmlEsc(card.nav)}">
        <span>${htmlEsc(card.tag)}</span>
        <strong>${htmlEsc(card.title)}</strong>
        <em>${htmlEsc(card.body)}</em>
      </button>`,
    )
    .join("");
  const metrics = workflow.metrics
    .map(([label, value]) => `<div><span>${htmlEsc(label)}</span><strong>${htmlEsc(value)}</strong></div>`)
    .join("");
  return `<section class="world-focus-room">
    <div class="world-focus-room-head">
      <span>${htmlEsc(workflow.eyebrow)}</span>
      <strong>${htmlEsc(workflow.mode)}</strong>
    </div>
    <div class="world-focus-room-body">
      <div class="world-room-stage-card">
        <div class="world-room-live-scene world-room-live-scene--${htmlEsc(room.id)}">
          <span class="world-room-scene-label">${htmlEsc(room.sub)}</span>
          ${renderRoomParticipants(p.save, room.actors)}
          ${renderQDoll("world-session-doll world-session-doll--producer", "Producer", 30)}
        </div>
        <div class="world-room-objective">
          <span>Current focus</span>
          <strong>${htmlEsc(workflow.objective)}</strong>
        </div>
        <div class="world-room-metrics">${metrics}</div>
      </div>
      <div class="world-room-workbench">
        <div class="world-room-card-grid">${cardHtml}</div>
        ${renderRoomTimeline(workflow.timeline)}
      </div>
    </div>
  </section>`;
}

function renderWorldZoomOverlay(p: WorldShellRenderProps): string {
  if (!p.zoomTarget) return "";
  if (p.zoomTarget === "members") {
    const members = managedMembers(p.save);
    if (p.zoomProfileInner) {
      return `<div class="world-zoom" role="dialog" aria-modal="true" aria-label="Member Profile">
        <button type="button" class="world-zoom-backdrop" data-world-zoom-close></button>
        <section class="world-zoom-panel world-zoom-panel--profile">
          <header><button type="button" class="world-zoom-back" data-world-member-profile-back>Back</button><span>Member Profile</span><button type="button" data-world-zoom-close>Close</button></header>
          <div class="world-zoom-profile">${p.zoomProfileInner}</div>
        </section>
      </div>`;
    }
    const asOf = p.save?.current_date ?? p.save?.game_start_date ?? p.save?.scenario_context?.startup_date ?? null;
    const rows = members.map((member) => {
      const src = idolPortraitPublicSrc(member.row, asOf);
      const fb = avatarPlaceholderDataUrl(member.name);
      const img = src
        ? `<img src="${htmlEsc(src)}" data-fallback="${attrQuotedUrl(fb)}" alt="${htmlEsc(member.name)}" />`
        : `<img src="${attrQuotedUrl(fb)}" alt="${htmlEsc(member.name)}" />`;
      return `<button type="button" class="world-zoom-member" data-idol-detail="${htmlEsc(member.uid)}">${img}<span>${htmlEsc(member.name)}</span></button>`;
    }).join("");
    return `<div class="world-zoom" role="dialog" aria-modal="true" aria-label="Current Member Wall">
      <button type="button" class="world-zoom-backdrop" data-world-zoom-close></button>
      <section class="world-zoom-panel world-zoom-panel--members">
        <header><span>Current Member Wall</span><strong>${members.length} current members</strong><button type="button" data-world-zoom-close>Close</button></header>
        <div class="world-zoom-member-grid">${rows}</div>
      </section>
    </div>`;
  }
  const stats = historyStats(p.save);
  const past = stats.pastNames.length
    ? stats.pastNames.map((name) => `<button type="button" class="world-folder world-folder--member" data-world-history-open>${htmlEsc(name)}</button>`).join("")
    : Array.from({ length: Math.min(12, stats.pastMembers) }, (_, i) => `<button type="button" class="world-folder world-folder--member" data-world-history-open>Former ${i + 1}</button>`).join("");
  const years = stats.years.map((year) => `<button type="button" class="world-folder world-folder--year" data-world-history-open>${htmlEsc(year)}</button>`).join("");
  const souvenirs = Array.from({ length: Math.min(18, stats.souvenirs) }, (_, i) => `<button type="button" class="world-souvenir" data-world-history-open>#${i + 1}</button>`).join("");
  return `<div class="world-zoom" role="dialog" aria-modal="true" aria-label="History Cabinet">
    <button type="button" class="world-zoom-backdrop" data-world-zoom-close></button>
    <section class="world-zoom-panel world-zoom-panel--history">
      <header><span>History Cabinet</span><strong>${stats.pastMembers} former / ${stats.yearFiles} years / ${stats.souvenirs} souvenirs</strong><button type="button" data-world-zoom-close>Close</button></header>
      <div class="world-history-zoom-grid">
        <section><h3>Former Members</h3><div>${past || `<p>No former member files yet.</p>`}</div></section>
        <section><h3>Year Files</h3><div>${years}</div></section>
        <section><h3>Memorabilia</h3><div>${souvenirs || `<p>No milestone souvenirs yet.</p>`}</div></section>
      </div>
    </section>
  </div>`;
}

function renderPhoneMessageOverlay(p: WorldShellRenderProps): string {
  const selectedUid = p.phoneMessageUid ?? null;
  if (!selectedUid) return "";
  const notifications = p.save?.inbox?.notifications ? [...p.save.inbox.notifications] : [];
  sortNotificationsInPlace(notifications);
  const index = notifications.findIndex((item) => item.uid === selectedUid);
  if (index < 0) return "";
  const item = notifications[index];
  const prev = notifications[index - 1] ?? null;
  const next = notifications[index + 1] ?? null;
  const time = String(item.created_at || item.date || "");
  const body = htmlEsc(notificationBodyText(item)).replaceAll("\n", "<br />");
  const shortcut = notificationHasLiveShortcut(item)
    ? `<button type="button" class="fm-btn fm-btn-accent" data-world-live-shortcut>Move to venue</button>`
    : "";
  return `<div class="world-phone-reader" role="dialog" aria-modal="true" aria-label="Phone message">
    <button type="button" class="world-zoom-backdrop" data-world-phone-message-close></button>
    <section class="world-phone-reader-panel">
      <header>
        <div>
          <span>Assistant</span>
          <h2>${htmlEsc(item.title || "Assistant note")}</h2>
          <p>${htmlEsc([time, item.sender].filter(Boolean).join(" - "))}</p>
        </div>
        <button type="button" data-world-phone-message-close>Close</button>
      </header>
      <div class="world-phone-reader-body">${body || `<p>No message body.</p>`}</div>
      <div class="world-phone-reader-actions">
        ${shortcut}
        <button type="button" class="fm-btn" data-nav="Inbox">Open Inbox</button>
      </div>
      <footer>
        <button type="button" class="fm-btn" data-world-phone-message="${htmlEsc(prev?.uid ?? "")}" ${prev ? "" : "disabled"}>Previous</button>
        <span>${index + 1} / ${notifications.length}</span>
        <button type="button" class="fm-btn" data-world-phone-message="${htmlEsc(next?.uid ?? "")}" ${next ? "" : "disabled"}>Next</button>
      </footer>
    </section>
  </div>`;
}

export function renderWorldShell(p: WorldShellRenderProps): string {
  const unreadCount = p.save?.inbox?.notifications?.filter((item) => !item.read).length ?? 0;
  const tierRooms = roomsForTier(officeTierFromSave(p.save));
  const effectiveRoom = tierRooms.some((room) => room.id === p.worldRoom) ? p.worldRoom : "producer";
  const effectiveProps = effectiveRoom === p.worldRoom ? p : { ...p, worldRoom: effectiveRoom };
  const focus = renderRoomFocus(effectiveProps);
  const groupName = p.save ? String(getPrimaryGroup(p.save)?.name ?? p.save.managing_group ?? "No group") : "Browse database";
  return `<div class="fm-app world-app" data-world-runtime>
    <header class="world-top-bar" role="banner">
      <div class="world-top-left">
        ${p.homeMenuHtml}
        <button type="button" class="fm-btn fm-btn-history" ${p.canGoBack ? "" : "disabled"} title="Back" aria-label="Back" data-history="back">&lsaquo;</button>
        <button type="button" class="fm-btn fm-btn-history" ${p.canGoForward ? "" : "disabled"} title="Forward" aria-label="Forward" data-history="fwd">&rsaquo;</button>
        <h1><span>IDOL PRODUCER</span><strong>${htmlEsc(p.browseMode ? "Browse database" : groupName)}</strong></h1>
      </div>
      <div class="world-top-center">
        <button type="button" class="world-date-btn" data-world-calendar-toggle>${htmlEsc(p.dateLabel)}</button>
        ${p.calendarOpen ? renderCalendarOverlay(p.save, p.dateLabel) : ""}
      </div>
      <div class="world-top-right">
        <button type="button" class="world-phone-btn" data-world-phone-toggle aria-pressed="${p.phoneOpen ? "true" : "false"}">Phone <strong>${unreadCount}</strong></button>
        <span class="world-speed">1x</span>
        ${p.nextDayBtn}
        ${p.cashPill}
        ${p.phoneOpen ? renderPhoneTray(p.save) : ""}
      </div>
    </header>
    <div class="world-body">
      <aside class="world-left">
        ${p.currentView === "Lives" ? renderVenueMap() : renderAgencyMap(effectiveRoom, p.save)}
      </aside>
      <main class="world-focus" id="main-content" role="main" aria-label="${htmlEsc(navLabel(p.lang, p.currentView))}">
        ${focus}
      </main>
    </div>
    ${p.footerHtml}
    ${p.wikiModalHtml}
    ${p.feedbackModalHtml}
    ${renderWorldZoomOverlay(p)}
    ${renderPhoneMessageOverlay(p)}
  </div>`;
}
