/**
 * Desktop-style layout (Football Manager / idol_producer main_ui.py colors & structure).
 */

import type { LoadedScenario, OfficialScheduleBundle, OfficialScheduleEvent } from "../data/scenarioTypes";
import type { WebPreviewBundle } from "../types";
import type { CdReleaseProject, GameSavePayload } from "../save/gameSaveSchema";
import { AUTOSAVE_SLOT, type SlotSummary } from "../persistence/saves";
import { getActiveFinances, getPrimaryGroup } from "../save/gameSaveSchema";
import type { PersistedIdolAttributes } from "../engine/idolAttributes";
import {
  getAbility,
  getWorkbookRadarDimensions,
  normalizePersistedAttributes,
} from "../engine/idolAttributes";
import {
  resolveGroupLetterTier,
  sortGroupsForDirectory,
  addCalendarDays,
  monthlyBaseSalaryYenForGroupLetterTier,
  monthlyStaffSalaryYen,
  monthlyAdminTrainingCostYenForGroupLetterTier,
  estimateLiveGoodsGrossYen,
  estimateVenueFee,
  isWeekendUtc,
  BIRTHDAY_TEE_TEMPLATE,
  birthdayTeeUidForMember,
  type ProducedGoodsRow,
} from "../engine/financeSystem";
import {
  getBlockingNotificationForSave,
  isoDatePart,
} from "../engine/gameEngine";
import {
  addMinutesToHHMM,
  formatLiveSlotLine,
  getVenuesCatalog,
  LIVE_TYPE_PRESETS,
} from "../engine/liveScheduleWeb";
import {
  buildAuditionStorageKey,
  buildDefaultScoutCompanies,
  isScoutCompanySubscribed,
  recommendScoutLeads,
  scoutLeadRevealCount,
  type ScoutAuditionRow,
  type ScoutLeadRow,
} from "../engine/scoutWeb";
import { festivalPerformancesForManagedGroup, normalizeFestivalCatalog } from "../engine/festivalWeb";
import { MEMBER_ROLE_DEFINITIONS, memberRolesSummary, roleAssignmentsFromHistoryEntry } from "../data/memberRoles";
import { attrQuotedUrl, avatarPlaceholderDataUrl, idolPortraitPublicSrc } from "./portraitUrl";
import {
  activeGroupMembershipsAtReference,
  activeGroupRoleMembershipsAtReference,
  activeGroupsAtReference,
  ageLabel,
  displayReferenceIso,
  groupNamesByUid,
  lookupGroupUidByName,
  romajiFromRow,
} from "./idolRowMeta";
import { htmlEsc } from "./htmlEsc";
import { gameManualHref, ikonoijoyBest10Href, languageOptions, liveTypeLabel, navLabel, oshiChartHref, t, type UiLanguage } from "./i18n";
import { resolveMemberColorCss } from "./memberColor";
import { tutorialMenuLabel } from "./tutorialOverlay";
import { renderFullWikiPanel, renderWikiPanel } from "./wiki";
import { notificationRequiresAck, sortNotificationsInPlace } from "../save/inbox";
import { renderGroupDetailPage } from "./groupDetailPage";
import {
  isSongHiddenFromDisplay,
  isSongAvailableOn,
  songPopularityNum,
  songsForDisplaySorted,
  buildDiscBuckets,
  buildGroupDiscographyReleaseRows,
  findDiscographyKeyForDiscLabel,
  primaryDiscLabel,
  splitSongsReleasedVsMaking,
  type DiscBucket,
  type GroupDiscographyReleaseRow,
  type GroupDiscographyTrackRef,
} from "../data/songDisplayPolicy";
import {
  songCatalogDisplayLabel,
  songCatalogMatchesPick,
} from "../data/songCatalog";
import { renderSongPreviewControls } from "./songPreviewPlayer";
import { renderLiveModeView, type LiveModeSession } from "./liveMode";
import { groupsForDirectoryListing } from "../data/scenarioBrowse";
import {
  classifyOfficialMediaTab,
  findManagedOfficialScheduleBundle,
  officialScheduleDate,
  officialScheduleEvents,
  officialScheduleLink,
  officialScheduleMembers,
  officialScheduleScopeLabel,
  officialScheduleTabLabel,
  officialScheduleVenueLabel,
  sortOfficialScheduleEvents,
  type MediaTab,
} from "../data/officialSchedule";
import {
  historyRecordsForDate,
  historyTables,
  isHeroinesManagedGroup,
  isManagedStandingRow,
  isRegularLeagueKind,
  leagueKindLabel,
  seasonById,
  seasonForDate,
  standingZoneClass,
  standingZoneForRow,
  standingsForDate,
  upcomingLeagueSchedule,
  type LeaguePanelTab,
  type LeagueTableView,
} from "../data/heroinesLeague";
import { contestedRecruitWindowsForDate } from "../engine/careerDecision";
import {
  defaultAutopilotTrainingIntensity,
  hiatusDaysRemaining,
  hiatusReturnDate,
  isIdolOnHiatus,
  safeTrainingRow,
  trainingLoadFromRow,
  trainingBearIndex,
} from "../engine/idolStatusSystem";

const FOCUS_SKILL_OPTIONS = ["", "talking", "host", "variety", "acting", "make-up", "model"] as const;

function startOfUtcMonthIso(isoYmd: string): string {
  const s = String(isoYmd).split("T")[0].trim();
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return "2000-01-01";
  return `${m[1]}-${m[2]}-01`;
}

function daysInUtcMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function formatMonthYearTitleUtc(firstOfMonthIso: string): string {
  const y = parseInt(firstOfMonthIso.slice(0, 4), 10);
  const m1 = parseInt(firstOfMonthIso.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m1)) return firstOfMonthIso;
  const d = new Date(Date.UTC(y, m1 - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function buildScheduleMonthCalendarHtml(
  firstOfMonthIso: string,
  ctx: {
    gameStart: string;
    cur: string;
    nextIso: string;
    selectedWeekAnchorIso: string | null;
    schedules: Record<string, unknown>[];
    results: Record<string, unknown>[];
    mediaEvents: Array<{ date: string; event?: string }>;
    lang: UiLanguage;
  },
): string {
  const y = parseInt(firstOfMonthIso.slice(0, 4), 10);
  const m1 = parseInt(firstOfMonthIso.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m1) || m1 < 1 || m1 > 12) {
    return `<p class="content-muted">${htmlEsc(t(ctx.lang, "schedule_invalid_month"))}</p>`;
  }
  const dim = daysInUtcMonth(y, m1);
  const firstDow = new Date(Date.UTC(y, m1 - 1, 1)).getUTCDay();

  const scheduleByDate = new Map<string, Record<string, unknown>[]>();
  for (const s of ctx.schedules) {
    const d = String(s.start_date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!scheduleByDate.has(d)) scheduleByDate.set(d, []);
    scheduleByDate.get(d)!.push(s);
  }
  const resultDates = new Set<string>();
  for (const r of ctx.results) {
    const d = String(r.date ?? r.start_date ?? "").split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) resultDates.add(d);
  }
  const mediaByDate = new Map<string, number>();
  for (const event of ctx.mediaEvents) {
    const d = officialScheduleDate(event);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    mediaByDate.set(d, (mediaByDate.get(d) ?? 0) + 1);
  }
  const dowLabels = [
    t(ctx.lang, "schedule_dow_sun"),
    t(ctx.lang, "schedule_dow_mon"),
    t(ctx.lang, "schedule_dow_tue"),
    t(ctx.lang, "schedule_dow_wed"),
    t(ctx.lang, "schedule_dow_thu"),
    t(ctx.lang, "schedule_dow_fri"),
    t(ctx.lang, "schedule_dow_sat"),
  ];
  const head = dowLabels.map((lab) => `<div class="schedule-cal-dow">${htmlEsc(lab)}</div>`).join("");
  const selectedWeekStart = ctx.selectedWeekAnchorIso && /^\d{4}-\d{2}-\d{2}$/.test(ctx.selectedWeekAnchorIso)
    ? ctx.selectedWeekAnchorIso
    : null;
  const selectedWeekEnd = selectedWeekStart ? addCalendarDays(selectedWeekStart, 6) : null;

  const cells: string[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(`<div class="schedule-cal-cell schedule-cal-cell--pad" aria-hidden="true"></div>`);
  }
  for (let day = 1; day <= dim; day++) {
    const iso = `${String(y).padStart(4, "0")}-${String(m1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const booked = scheduleByDate.has(iso);
    const played = resultDates.has(iso);
    const mediaCount = mediaByDate.get(iso) ?? 0;
    const isNext = iso === ctx.nextIso;
    const isClosed = iso <= ctx.cur;
    const isInSelectedWeek = Boolean(selectedWeekStart && selectedWeekEnd && iso >= selectedWeekStart && iso <= selectedWeekEnd);
    const isSelectedWeekAnchor = iso === ctx.selectedWeekAnchorIso;
    const cls = [
      "schedule-cal-cell",
      isClosed ? "is-past" : "",
      isNext ? "is-next-day" : "",
      isInSelectedWeek ? "is-selected-week" : "",
      isSelectedWeekAnchor ? "is-selected-week-anchor" : "",
      booked ? "has-booking" : "",
      played ? "has-result" : "",
      mediaCount > 0 ? "has-media" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const extras = scheduleByDate.get(iso) ?? [];
    const tip: string[] = [];
    if (isClosed) tip.push(t(ctx.lang, "schedule_day_closed"));
    if (isNext) tip.push(t(ctx.lang, "schedule_next_sim_day"));
    if (booked) {
      for (const ex of extras.slice(0, 2)) {
        const vn = String((ex as Record<string, unknown>).venue ?? "").trim();
        const rawType = String((ex as Record<string, unknown>).live_type ?? (ex as Record<string, unknown>).event_type ?? "");
        const tt = String((ex as Record<string, unknown>).title ?? "").trim() || liveTypeLabel(ctx.lang, rawType) || t(ctx.lang, "schedule_live_fallback");
        tip.push(vn ? `${tt} @ ${vn}` : tt);
      }
      if (extras.length > 2) tip.push(t(ctx.lang, "schedule_more_count", { count: extras.length - 2 }));
    }
    if (played) tip.push(t(ctx.lang, "schedule_played_result"));
    if (mediaCount > 0) tip.push(t(ctx.lang, "schedule_media_items", { count: mediaCount }));
    const title = tip.join(" - ") || iso;

    cells.push(`<div class="${cls}" title="${htmlEsc(title)}" data-sched-date="${htmlEsc(iso)}">
      <span class="schedule-cal-daynum">${day}</span>
      <span class="schedule-cal-dots" aria-hidden="true">
        ${booked ? `<span class="schedule-cal-dot schedule-cal-dot--book"></span>` : ""}
        ${played ? `<span class="schedule-cal-dot schedule-cal-dot--done"></span>` : ""}
        ${mediaCount > 0 ? `<span class="schedule-cal-dot schedule-cal-dot--media"></span>` : ""}
      </span>
    </div>`);
  }

  const padTail = (7 - ((firstDow + dim) % 7)) % 7;
  for (let i = 0; i < padTail; i++) {
    cells.push(`<div class="schedule-cal-cell schedule-cal-cell--pad" aria-hidden="true"></div>`);
  }

  const legend = `<ul class="schedule-cal-legend">
    <li><span class="schedule-cal-dot schedule-cal-dot--book"></span> ${htmlEsc(t(ctx.lang, "schedule_legend_booked"))}</li>
    <li><span class="schedule-cal-dot schedule-cal-dot--done"></span> ${htmlEsc(t(ctx.lang, "schedule_legend_played"))}</li>
    <li><span class="schedule-cal-dot schedule-cal-dot--media"></span> ${htmlEsc(t(ctx.lang, "schedule_legend_media"))}</li>
    <li class="schedule-cal-legend-outline">${htmlEsc(t(ctx.lang, "schedule_legend_outline"))}</li>
  </ul>`;

  const monthTitle = formatMonthYearTitleUtc(firstOfMonthIso);

  return `<div class="schedule-cal" data-sched-cal-root="${htmlEsc(firstOfMonthIso)}">
    <div class="schedule-cal-toolbar">
      <button type="button" class="fm-btn" data-sched-cal-delta="-1" aria-label="${htmlEsc(t(ctx.lang, "schedule_prev_month"))}">${htmlEsc("<")}</button>
      <h3 class="schedule-cal-month-title content-h3">${htmlEsc(monthTitle)}</h3>
      <button type="button" class="fm-btn" data-sched-cal-delta="1" aria-label="${htmlEsc(t(ctx.lang, "schedule_next_month"))}">${htmlEsc(">")}</button>
      <button type="button" class="fm-btn fm-btn-accent schedule-cal-today" data-sched-cal-today="1">${htmlEsc(t(ctx.lang, "schedule_current_week"))}</button>
    </div>
    <div class="schedule-cal-grid" role="grid" aria-label="${htmlEsc(t(ctx.lang, "schedule_month_calendar"))}">${head}${cells.join("")}</div>
    ${legend}
  </div>`;
}

/** Primary Songs workspace tabs (matches `support/reference/python-desktop/main_ui.py` show_songs_view). */
export type SongsWorkspaceTab = "group_songs" | "disc";
export type MakingTab = "songs" | "cd" | "goods";
export type LivesTab = "new" | "scheduled" | "past" | "festival" | "league";
export type { LeaguePanelTab };
export type ScoutTab = "freelancer" | "transfer" | "audition";
export type TrainingTab = "assignments" | "roster" | "roles" | "songs";
export type RoleBenchmarkKey = "singing" | "dancing" | "teamwork" | "content" | "streaming" | "fashion";
export type FinanceHistoryRange = "day" | "week" | "month" | "year" | "all";
export type FinanceTab = "finance" | "contract";
export type TrainingRosterSortKey = "romaji" | "age" | "ability" | "condition" | "morale" | "started";
export type { MediaTab };
export interface FeedbackEntry {
  id: string;
  createdAt: string;
  type: "bug" | "question" | "suggestion";
  title: string;
  details: string;
  view: string;
  simDate: string;
  accountName: string;
  uiLanguage: UiLanguage;
}

export interface LiveProgramItem {
  id: string;
  kind: "song" | "mc" | "break";
  label: string;
  durationMinutes: number;
  songTitle?: string;
}

export interface NewLiveFormState {
  liveType: "Routine" | "Concert" | "Taiban" | "Festival";
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  rehearsalStart: string;
  rehearsalEnd: string;
  venueName: string;
  program: LiveProgramItem[];
  setlist: string[];
  tokutenkaiEnabled: boolean;
  tokutenkaiStart: string;
  tokutenkaiEnd: string;
  tokutenkaiTicketPrice: number;
  tokutenkaiSlotSeconds: number;
  tokutenkaiExpectedTickets: number;
  goodsEnabled: boolean;
  goodsUids: string[];
  ticketPriceYen: number;
  vipTicketPriceYen: number;
  vipCapacity: number;
}

/** Full management nav (browse mode restricts to Idol / Groups / Songs like desktop `_browse_mode`). */
export const MANAGEMENT_NAV_ITEMS = [
  "Inbox",
  "Idols",
  "Groups",
  "Training",
  "Schedule",
  "Lives",
  "Songs",
  "Making",
  "Media",
  "Scout",
  "Finances",
] as const;

export const BROWSE_NAV_ITEMS = ["Idols", "Groups", "Songs"] as const;

export type DesktopNavId = (typeof MANAGEMENT_NAV_ITEMS)[number] | (typeof BROWSE_NAV_ITEMS)[number];

export function isManagementNav(s: string): s is (typeof MANAGEMENT_NAV_ITEMS)[number] {
  return (MANAGEMENT_NAV_ITEMS as readonly string[]).includes(s);
}

export function isBrowseNav(s: string): s is (typeof BROWSE_NAV_ITEMS)[number] {
  return (BROWSE_NAV_ITEMS as readonly string[]).includes(s);
}

export function isDesktopNavId(s: string): s is DesktopNavId {
  return isManagementNav(s) || isBrowseNav(s);
}

/** Browse / expandable catalog caps (scenario JSON can list tens of thousands of songs). */
const SONG_EXPAND_ALL_LIMIT = 500;

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function xFollowersNum(row: Record<string, unknown>): number {
  const v = row.x_followers;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return Number.NEGATIVE_INFINITY;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function sortIdolsByXFollowersDesc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => xFollowersNum(b) - xFollowersNum(a));
}

function xFollowersLabel(row: Record<string, unknown>): string {
  const v = row.x_followers;
  if (typeof v === "number" && Number.isFinite(v)) return v.toLocaleString("ja-JP");
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ja-JP") : "—";
}

function heightCmLabel(row: Record<string, unknown>): string {
  const h = row.height;
  if (typeof h === "number" && Number.isFinite(h)) return String(Math.round(h));
  return "—";
}

function buildSongCountByGroupUid(songs: Record<string, unknown>[] | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!Array.isArray(songs)) return m;
  for (const s of songs) {
    if (isSongHiddenFromDisplay(s as Record<string, unknown>, songs)) continue;
    const g = String((s as { group_uid?: unknown }).group_uid ?? "").trim();
    if (!g) continue;
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function formatLongDate(iso: string | undefined): string {
  if (!iso) return "—";
  const datePart = String(iso).split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(datePart)) return "—";
  const d = new Date(datePart + "T12:00:00Z");
  const base = d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const timePart = String(iso).includes("T") ? String(iso).split("T")[1]?.slice(0, 5) ?? "" : "";
  return timePart ? `${base} ${timePart}` : base;
}

function shortlistRows(save: GameSavePayload): { uid: string; label: string; canSign: boolean }[] {
  const idols = save.database_snapshot.idols;
  const byUid = new Map<string, Record<string, unknown>>();
  for (const row of idols) {
    const uid = row && typeof row === "object" && "uid" in row ? String((row as { uid?: string }).uid) : "";
    if (uid) byUid.set(uid, row as Record<string, unknown>);
  }
  const primaryGroup = getPrimaryGroup(save);
  const memberSet = new Set(Array.isArray(primaryGroup?.member_uids) ? primaryGroup!.member_uids.map((x) => String(x)) : []);
  const pendingSigningUids = new Set(
    save.inbox.notifications
      .filter((row) => String((row.report_data as Record<string, unknown> | undefined)?.kind ?? "") === "shortlist_signing_offer")
      .filter((row) => row.requires_confirmation || String(row.choice_status ?? "").trim() === "pending")
      .map((row) => String(((row.report_data as Record<string, unknown> | undefined)?.idol_uid ?? "")).trim())
      .filter(Boolean),
  );
  return save.shortlist.map((uid) => {
    const row = byUid.get(uid);
    const name =
      row && typeof row.name === "string"
        ? row.name
        : row && typeof row.romaji === "string"
          ? row.romaji
          : uid.slice(0, 8) + "...";
    return { uid, label: name, canSign: !memberSet.has(uid) && !pendingSigningUids.has(uid) };
  });
}

function renderPlaceholder(view: string, blurb?: string): string {
  const text =
    blurb ??
    t("en", "placeholder_porting", { view: String(view) });
  return `<section class="content-panel" aria-label="${htmlEsc(view)}"><p class="content-lead">${text}</p></section>`;
}

function localizedLiteral(lang: UiLanguage, en: string, zh: string): string {
  return lang === "zh-CN" ? zh : en;
}

function currencyText(lang: UiLanguage, amount: number): string {
  const formatted = amount.toLocaleString("ja-JP");
  return lang === "zh-CN" ? `\u65e5\u5143 ${formatted}` : `JPY ${formatted}`;
}

function notificationSenderLabel(lang: UiLanguage, sender: string): string {
  if (lang !== "zh-CN") return sender;
  switch (sender) {
    case "Assistant":
      return "助理";
    case "Operations":
      return "运营";
    case "Management":
      return "管理层";
    case "Scout":
      return "星探";
    case "Training":
      return "训练";
    case "Scenario":
      return "剧情";
    case "News":
      return "新闻";
    default:
      return sender;
  }
}

function notificationCategoryLabel(lang: UiLanguage, category: string): string {
  if (lang !== "zh-CN") return category;
  switch (category) {
    case "internal":
      return "内部";
    case "guidance":
      return "指引";
    case "background":
      return "背景";
    case "general":
      return "一般";
    case "confirmation":
      return "确认";
    case "decision":
      return "决策";
    case "news":
      return "新闻";
    default:
      return category;
  }
}

function notificationLikelihoodLabelZh(label: string): string {
  switch (label.trim()) {
    case "Highly likely to agree":
      return "极有可能同意";
    case "Likely to agree":
      return "较可能同意";
    case "Uncertain":
      return "结果未定";
    case "Unlikely":
      return "不太可能同意";
    default:
      return label;
  }
}

function localizedNotificationText(
  row: {
    title?: string;
    body?: string;
    sender?: string;
    category?: string;
    date?: string;
    dedupe_key?: string;
    report_data?: unknown;
  },
  lang: UiLanguage,
): { title: string; body: string; sender: string; category: string } {
  const title = String(row.title ?? "");
  const body = String(row.body ?? "");
  const sender = String(row.sender ?? "");
  const category = String(row.category ?? "");
  if (lang !== "zh-CN") return { title, body, sender, category };

  const dedupeKey = String(row.dedupe_key ?? "");
  const report =
    row.report_data && typeof row.report_data === "object"
      ? (row.report_data as Record<string, unknown>)
      : null;
  const reportKind = String(report?.kind ?? "");

  const nameAfter = (prefix: string): string | null => (title.startsWith(prefix) ? title.slice(prefix.length).trim() : null);
  const yen = (value: unknown): string => `\u00A5${Number(value ?? 0).toLocaleString("ja-JP")}`;
  const senderZh = notificationSenderLabel(lang, sender);
  const categoryZh = notificationCategoryLabel(lang, category);

  if (dedupeKey.startsWith("startup-roster|")) {
    return { title: "初始阵容", body: "已整理开局可用成员名单。先检查成员状态，再决定训练和编组。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("startup-lives|")) {
    return { title: "演出安排", body: "本月可用演出档期已经更新。尽快确认排程，避免错过窗口。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("startup-staff|")) {
    return { title: "事务所简报", body: "开局营运说明已经送达。建议先看训练、财务和演出三个页面。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("production-started|")) {
    return { title: "制作启动", body: "新的制作项目已经开始。请留意后续进度与相关支出。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("daily-lives|")) {
    return { title: "今日演出摘要", body: "今天的演出安排已更新。打开详情可查看场次与时间。", sender: senderZh, category: categoryZh };
  }
  if (reportKind === "live_report" || dedupeKey.startsWith("live-report-start|")) {
    const liveTitle = String(report?.title ?? nameAfter("Live report: ") ?? nameAfter("Festival report: ") ?? "活动");
    const isFestival = title.startsWith("Festival report:");
    return {
      title: `${isFestival ? "活动报告" : "演出报告"}：${liveTitle}`,
      body: "本场活动已经结束，详情页可查看成绩、收入与成员表现。",
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (dedupeKey.startsWith("training-end|")) {
    return { title: `${title.replace(/ ended$/, "")} 已结束`, body: "训练项目已经结束，请查看成员状态并安排下一步。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("auto-booked-lives|")) {
    const month = dedupeKey.split("|")[2]?.slice(0, 7) ?? "";
    return { title: `自动排演出：${month}`, body: `${month} 的自动演出安排已经完成，请确认结果。`, sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("auto-book-lives|")) {
    const month = dedupeKey.split("|")[2]?.slice(0, 7) ?? "";
    return { title: `安排 ${month} 的演出`, body: `系统建议：为了避免档期空置，请为 ${month} 安排更多演出。`, sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("song-unlock|")) {
    return { title: "歌曲解锁：新曲可用", body: "有新的可用歌曲加入曲库，可以用于排练与节目单。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("live-schedule-blocked|")) {
    const subject = nameAfter("Live scheduling blocked: ") ?? "未命名演出";
    return { title: `演出排程受阻：${subject}`, body: "该演出无法安排。请检查前后 7 天的档期与成员可用状态。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("live-schedule-cash-blocked|")) {
    const subject = nameAfter("Live scheduling blocked: ") ?? "未命名演出";
    return { title: `演出排程受阻：${subject}`, body: "当前资金不足，无法确认该演出安排。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("live-scheduled|")) {
    const subject = nameAfter("Live scheduled: ") ?? "未命名演出";
    return { title: `已安排演出：${subject}`, body: "该演出已加入日程表，可以在演出页面查看详情。", sender: senderZh, category: categoryZh };
  }
  if (reportKind === "contract_renew_review") {
    const idolName = nameAfter("Contract renewal review: ") ?? String(report?.idol_uid ?? "成员");
    return { title: `续约审查：${idolName}`, body: `请审查 ${idolName} 的续约条件，并决定是否提出新合约。`, sender: senderZh, category: categoryZh };
  }
  if (reportKind === "contract_renew_confirm") {
    const idolName = nameAfter("Contract renewal confirmation: ") ?? String(report?.idol_uid ?? "成员");
    return {
      title: `续约确认：${idolName}`,
      body: `提议薪资：${yen(report?.proposed_salary_yen)}\n提议到期日：${String(report?.proposed_end_date ?? "-")}\n\n请确认是否接受这份续约方案。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (reportKind === "contract_terminate_review") {
    const idolName = nameAfter("Termination review: ") ?? String(report?.idol_uid ?? "成员");
    const fee = Number(report?.termination_fee_yen ?? 0) || 0;
    return {
      title: `解约审查：${idolName}`,
      body:
        fee <= 0
          ? `${idolName} 当前可无违约金解约。当前丑闻等级为 ${String(report?.scandal_level ?? 0)}。`
          : `请确认是否与 ${idolName} 解约，并承担相应费用。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Renewal outlook updated: ")) {
    const idolName = nameAfter("Renewal outlook updated: ") ?? "成员";
    const likelihood = body.match(/"(.+?)"/)?.[1] ?? "";
    return {
      title: `续约意向更新：${idolName}`,
      body: `最新续约倾向为“${notificationLikelihoodLabelZh(likelihood)}”。建议重新评估续约条件。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Contract renewed: ")) {
    const idolName = nameAfter("Contract renewed: ") ?? "成员";
    return {
      title: `续约完成：${idolName}`,
      body: body
        .replace(/^New monthly salary is /, "新月薪为 ")
        .replace(/^New monthly salary is/, "新月薪为")
        .replace(" through ", "，到期日为 ")
        .replace(/\.$/, "。"),
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Termination blocked: ")) {
    const idolName = nameAfter("Termination blocked: ") ?? "成员";
    return { title: `解约受阻：${idolName}`, body: "目前无法执行解约，请检查限制条件。", sender: senderZh, category: categoryZh };
  }
  if (title.startsWith("Contract terminated: ")) {
    const idolName = nameAfter("Contract terminated: ") ?? "成员";
    return {
      title: `解约完成：${idolName}`,
      body: body.includes("without fee") ? "已完成解约，且未产生违约金。" : "已完成解约，并支付了解约费用。",
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (reportKind === "scout_subscription" || dedupeKey.startsWith("scout-subscribe|")) {
    const companyName = String(report?.company_name ?? nameAfter("Scout subscription active: ") ?? "星探公司");
    return {
      title: `星探订阅已开通：${companyName}`,
      body: `${companyName} 已开始提供线索。可前往星探页面查看推荐人选。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (dedupeKey.startsWith("scout-subscribe-blocked|")) {
    const companyName = nameAfter("Scout subscription blocked: ") ?? "星探公司";
    return { title: `星探订阅受阻：${companyName}`, body: "目前无法开通该订阅，请检查资金或状态条件。", sender: senderZh, category: categoryZh };
  }
  if (reportKind === "shortlist_signing_offer" || dedupeKey.startsWith("shortlist-sign|")) {
    const idolName = String(report?.idol_name ?? nameAfter("Signing offer: ") ?? "成员");
    return {
      title: `签约提案：${idolName}`,
      body: `开始日期：${String(report?.start_date ?? "-")}\n结束日期：${String(report?.end_date ?? "-")}\n月薪：${yen(report?.salary_yen)}\n\n请确认是否向该人选发出签约。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (reportKind === "career_graduation_notice" || title.startsWith("Graduation announced: ")) {
    const idolName = String(report?.idol_name ?? nameAfter("Graduation announced: ") ?? "成员");
    return {
      title: `毕业公告：${idolName}`,
      body: `${idolName} 的毕业已确定，生效日：${String(report?.effective_date ?? "-")}。\n该决定不可推翻；离团日将出现正式离团确认。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (reportKind === "managed_group_leave" || title.startsWith("Departure decision: ") || title.startsWith("Suspended member decision: ")) {
    const idolName = String(
      report?.idol_name ?? nameAfter("Suspended member decision: ") ?? nameAfter("Departure decision: ") ?? "成员",
    );
    const negotiable = report?.negotiable !== false;
    const postSuspend = String(report?.subtype ?? "") === "post_suspension_leave";
    if (postSuspend) {
      return {
        title: `休止成员决定：${idolName}`,
        body:
          `${idolName} 自 ${String(report?.scandal_date ?? "-")} 起处于无期限活动休止，尚未设定复归日。\n` +
          `她拟于 ${String(report?.effective_date ?? "-")} 离开 ${String(report?.group_name ?? "组合")}（复归前离团）。\n` +
          `这是重大经营决策；史实路径是接受离团。`,
        sender: senderZh,
        category: categoryZh,
      };
    }
    return {
      title: `离团决定：${idolName}`,
      body: negotiable
        ? `${idolName} 预定于 ${String(report?.effective_date ?? "-")} 离开 ${String(report?.group_name ?? "组合")}。请选择挽留或允许离团。`
        : `${idolName} 预定于 ${String(report?.effective_date ?? "-")} 离开 ${String(report?.group_name ?? "组合")}。该离团已锁定，无法取消。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (reportKind === "managed_scandal_handling" || title.startsWith("Scandal handling: ")) {
    const idolName = String(report?.idol_name ?? nameAfter("Scandal handling: ") ?? "成员");
    const historical = String(report?.historical_action ?? "").replaceAll("_", " ");
    return {
      title: `丑闻处理：${idolName}`,
      body:
        `${String(report?.group_name ?? "组合")} 成员 ${idolName} 的丑闻已公开（评分 ${String(report?.score ?? "—")}）。这是经营决策：每个选项都会影响现金、粉丝、士气与演出状态。` +
        (historical ? `\n史实应对：${historical}。` : ""),
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Scandal response: ")) {
    const idolName = nameAfter("Scandal response: ") ?? "成员";
    return {
      title: `丑闻应对结果：${idolName}`,
      body: body
        .replace(/ was terminated from /, " 已从 ")
        .replace(/ effective /, " 解约，生效日 ")
        .replace(/ will leave /, " 将在演出后离开 ")
        .replace(/ after the live on /, "，日期 ")
        .replace(/ was demoted from /, " 已从职位降格：")
        .replace(/ remains in /, " 留在 ")
        .replace(/ under a heavy penalty\./, "，并接受严厉处分。")
        .replace(/^Management issued a warning to /, "运营已对 ")
        .replace(/\.$/, " 发出警告。"),
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Retention decision: ")) {
    const idolName = nameAfter("Retention decision: ") ?? "成员";
    return {
      title: `挽留决定：${idolName}`,
      body: body
        .replace(/^You chose to keep /, "你选择将 ")
        .replace(" in ", " 留在 ")
        .replace(", so the scheduled departure was cancelled.", "，已取消预定离团。")
        .replace("\nSalary increased by ¥", "\n月薪上调 ¥")
        .replace("/month.", "/月。")
        .replace("\nHistorical transfer path suppressed.", "\n历史转会路径已压制。"),
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Signing completed: ")) {
    const idolName = nameAfter("Signing completed: ") ?? "成员";
    return {
      title: `签约完成：${idolName}`,
      body: body
        .replace(/^Contract starts /, "合约开始于 ")
        .replace(" and runs through ", "，结束于 ")
        .replace(" at JPY ", "，月薪 ")
        .replace(" per month.", "。"),
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (dedupeKey.startsWith("scout-sign|")) {
    const idolName = nameAfter("Signing confirmation: ") ?? "成员";
    return { title: `签约确认：${idolName}`, body: `${idolName} 的签约条件已经确认，可继续完成签约。`, sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("goods-order-empty|")) {
    const label = nameAfter("Goods order skipped: ") ?? "周边";
    return { title: `周边下单已跳过：${label}`, body: `由于没有可生产数量，已跳过 ${label} 的周边下单。`, sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("goods-order-blocked|")) {
    const label = nameAfter("Goods order blocked: ") ?? "周边";
    return { title: `周边下单受阻：${label}`, body: "当前无法下达周边订单，请检查条件后重试。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("goods-order|")) {
    const label = nameAfter("Goods made: ") ?? "周边";
    return { title: `周边已完成：${label}`, body: `${label} 的周边已经制作完成，可投入销售。`, sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("birthday-goods-order-empty|")) {
    const label = nameAfter("Birthday tee order skipped: ") ?? "生日T恤";
    return { title: `生日T恤下单已跳过：${label}`, body: "当前没有可下单数量，已跳过生日T恤生产。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("birthday-goods-order-blocked|")) {
    const label = nameAfter("Birthday tee order blocked: ") ?? "生日T恤";
    return { title: `生日T恤下单受阻：${label}`, body: "目前无法下达生日T恤订单，请检查条件。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("birthday-goods-order|")) {
    const label = nameAfter("Birthday tees made: ") ?? "生日T恤";
    return { title: `生日T恤已完成：${label}`, body: "生日T恤已经制作完成，可投入销售。", sender: senderZh, category: categoryZh };
  }
  if (dedupeKey.startsWith("hiatus|")) {
    const idolName = nameAfter("Hiatus scheduled: ") ?? "成员";
    const parts = dedupeKey.split("|");
    return {
      title: `暂停活动：${idolName}`,
      body: `${idolName} 将于 ${parts[2] ?? "-"} 至 ${parts[3] ?? "-"} 期间暂停活动，请调整后续安排。`,
      sender: senderZh,
      category: categoryZh,
    };
  }
  if (title.startsWith("Group formed: ")) {
    const groupName = nameAfter("Group formed: ") ?? "组合";
    return { title: `组合成立：${groupName}`, body: `${groupName} 已正式成立。`, sender: senderZh, category: categoryZh };
  }
  if (title.startsWith("Group disbanded: ")) {
    const groupName = nameAfter("Group disbanded: ") ?? "组合";
    return { title: `组合解散：${groupName}`, body: `${groupName} 已经解散。`, sender: senderZh, category: categoryZh };
  }
  if (title.startsWith("Member joined: ")) {
    const idolName = nameAfter("Member joined: ") ?? "成员";
    return { title: `成员加入：${idolName}`, body: body.replace(/ joined /, " 加入了 ").replace(/\.$/, "。"), sender: senderZh, category: categoryZh };
  }
  if (title.startsWith("Member left: ")) {
    const idolName = nameAfter("Member left: ") ?? "成员";
    return { title: `成员离队：${idolName}`, body: body.replace(/ left /, " 离开了 ").replace(/\.$/, "。"), sender: senderZh, category: categoryZh };
  }
  if (title.startsWith("Scandal revealed: ")) {
    const idolName = nameAfter("Scandal revealed: ") ?? "成员";
    return { title: `丑闻曝光：${idolName}`, body, sender: senderZh, category: categoryZh };
  }
  if (title.startsWith("Member update: ")) {
    const idolName = nameAfter("Member update: ") ?? "成员";
    return { title: `成员更新：${idolName}`, body, sender: senderZh, category: categoryZh };
  }
  if (title === "Scenario update") {
    return { title: "剧本更新", body: "当前剧本状态已经更新。", sender: senderZh, category: categoryZh };
  }
  if (reportKind === "weekly_news_roundup" || title === "Weekly news roundup") {
    const windowStart = String(report?.window_start ?? "");
    const windowEnd = String(report?.window_end ?? row.date ?? "");
    return { title: "每周资讯汇总", body: `这里整理了 ${windowStart} 至 ${windowEnd} 的重要动态。`, sender: senderZh, category: categoryZh };
  }

  return { title, body, sender: senderZh, category: categoryZh };
}

function localizedMediaTabLabel(lang: UiLanguage, tab: MediaTab): string {
  switch (tab) {
    case "tv":
      return localizedLiteral(lang, "TV", "电视");
    case "live_events":
      return localizedLiteral(lang, "Live Events", "现场活动");
    case "radio":
      return localizedLiteral(lang, "Radio", "广播");
    case "books":
      return localizedLiteral(lang, "Books", "书刊");
    case "online":
      return localizedLiteral(lang, "Online", "网络");
    default:
      return officialScheduleTabLabel(tab);
  }
}

function attrsFromRow(row: Record<string, unknown>): PersistedIdolAttributes {
  return row.attributes ? normalizePersistedAttributes(row.attributes) : normalizePersistedAttributes(undefined);
}

function attrBarClass(v: number): string {
  if (v >= 15) return "is-high";
  if (v >= 10) return "is-mid";
  return "is-low";
}

function attrStatRow(key: string, v: number): string {
  const pct = Math.max(0, Math.min(100, (v / 20) * 100));
  const label = key.replace(/_/g, " ");
  return `<div class="attr-dl-row"><dt>${htmlEsc(label)}</dt><dd class="attr-dd-bar"><span class="attr-bar-track" aria-hidden="true"><span class="attr-bar-fill ${attrBarClass(v)}" style="width:${pct.toFixed(1)}%"></span></span><span class="attr-bar-val">${v}</span></dd></div>`;
}

/** Public X profile URL from `x_url`, or built from `x_account` / `x_handle`. */
function idolXProfileUrl(row: Record<string, unknown>): string | undefined {
  const raw = row.x_url;
  if (typeof raw === "string") {
    const u = raw.trim();
    if (/^https?:\/\//i.test(u)) return u;
  }
  const acctRaw =
    (typeof row.x_account === "string" && row.x_account.trim()) ||
    (typeof row.x_handle === "string" && row.x_handle.trim());
  if (!acctRaw) return undefined;
  const acct = acctRaw.replace(/^@+/, "").trim();
  if (!acct) return undefined;
  return `https://x.com/${encodeURIComponent(acct)}`;
}

function renderAttributePanels(a: PersistedIdolAttributes): string {
  const row = (
    keys: [string, number][],
    label: string,
  ) =>
    `<div class="attr-block"><span class="attr-block-label">${htmlEsc(label)}</span><dl class="attr-dl">${keys
      .map(([k, v]) => attrStatRow(k, v))
      .join("")}</dl></div>`;

  const p = a.physical;
  const ap = a.appearance;
  const t = a.technical;
  const m = a.mental;

  return `
    <div class="attr-panels">
      ${row(
        [
          ["strength", p.strength],
          ["agility", p.agility],
          ["natural_fitness", p.natural_fitness],
          ["stamina", p.stamina],
        ],
        "Physical",
      )}
      ${row(
        [
          ["cute", ap.cute],
          ["pretty", ap.pretty],
        ],
        "Appearance",
      )}
      ${row(
        [
          ["pitch", t.pitch],
          ["tone", t.tone],
          ["breath", t.breath],
          ["rhythm", t.rhythm],
          ["power", t.power],
          ["grace", t.grace],
        ],
        "Technical",
      )}
      ${row(
        [
          ["clever", m.clever],
          ["humor", m.humor],
          ["talking", m.talking],
          ["determination", m.determination],
          ["teamwork", m.teamwork],
          ["fashion", m.fashion],
        ],
        "Mental",
      )}
    </div>`;
}

function radarToneClass(v: number): string {
  const r = Math.round(v);
  if (r >= 15) return "attr-tone-high";
  if (r >= 10) return "attr-tone-mid";
  return "attr-tone-low";
}

function fmtHistoryDateCell(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim().split("T")[0];
  if (v == null || v === "") return "—";
  return String(v);
}

function refDayString(refIso: string | undefined): string | undefined {
  if (!refIso || typeof refIso !== "string") return undefined;
  const s = refIso.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function historyIsoDay(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** When JSON marks a future join/leave as not yet confirmed, suppress the date cell. */
function historyDateDetermined(entry: Record<string, unknown>, role: "start" | "end"): boolean {
  const keys =
    role === "start"
      ? (["start_date_determined", "start_determined", "join_date_determined"] as const)
      : (["end_date_determined", "end_determined", "leave_date_determined"] as const);
  for (const k of keys) {
    if (k in entry) return (entry as Record<string, unknown>)[k] !== false;
  }
  return true;
}

/**
 * Group history date cell vs scenario reference: past/present shows ISO day; future shows day + (planned)
 * only when the date is treated as determined. Otherwise blank (no placeholder date).
 */
function fmtHistoryDateDisplay(
  v: unknown,
  refIso: string | undefined,
  entry: Record<string, unknown>,
  role: "start" | "end",
): string {
  if (v == null || v === "") return "—";

  const day = historyIsoDay(v);
  const ref = refDayString(refIso);
  if (!day) return fmtHistoryDateCell(v);

  if (!ref) return day;

  const dMs = new Date(`${day}T12:00:00Z`).getTime();
  const rMs = new Date(`${ref}T12:00:00Z`).getTime();
  if (dMs > rMs) {
    if (!historyDateDetermined(entry, role)) return "";
    return `${day} (planned)`;
  }
  return day;
}

/** Five-axis workbook radar (desktop `idol_ui._create_attribute_radar` geometry, SVG). */
function renderRadarSvg(a: PersistedIdolAttributes): string {
  const dims = getWorkbookRadarDimensions(a);
  const n = dims.length;
  const cx = 100;
  const cy = 100;
  const rMax = 74;
  const rLabel = 86;
  const valOutset = 4;
  const start = -Math.PI / 2;
  const step = (2 * Math.PI) / n;

  const axisLines: string[] = [];
  const labelEls: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = start + i * step;
    const xe = cx + rMax * Math.cos(ang);
    const ye = cy + rMax * Math.sin(ang);
    axisLines.push(`<line x1="${cx}" y1="${cy}" x2="${xe.toFixed(2)}" y2="${ye.toFixed(2)}" class="idol-radar-axis"/>`);
    const xl = cx + rLabel * Math.cos(ang);
    const yl = cy + rLabel * Math.sin(ang);
    const ta = Math.abs(xl - cx) < 8 ? "middle" : xl < cx ? "end" : "start";
    const dy = yl < cy - 4 ? "0.3em" : yl > cy + 4 ? "-0.3em" : "0.25em";
    labelEls.push(
      `<text x="${xl.toFixed(1)}" y="${yl.toFixed(1)}" class="idol-radar-lbl" text-anchor="${ta}" dominant-baseline="middle" dy="${dy}">${htmlEsc(dims[i].key)}</text>`,
    );
  }

  const rings = [0.25, 0.5, 0.75, 1.0]
    .map((ratio) => {
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const ang = start + i * step;
        const r = rMax * ratio;
        pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(" ")}" class="idol-radar-ring"/>`;
    })
    .join("");

  const polyPts: string[] = [];
  const valueEls: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = start + i * step;
    const v = Math.max(0, Math.min(20, dims[i].value));
    const rad = (v / 20) * rMax;
    const x = cx + rad * Math.cos(ang);
    const y = cy + rad * Math.sin(ang);
    polyPts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    const xv = cx + (rad + valOutset) * Math.cos(ang);
    const yv = cy + (rad + valOutset) * Math.sin(ang);
    valueEls.push(
      `<text x="${xv.toFixed(1)}" y="${yv.toFixed(1)}" class="idol-radar-val ${radarToneClass(v)}" text-anchor="middle" dominant-baseline="middle">${htmlEsc(v.toFixed(1))}</text>`,
    );
  }

  return `<figure class="idol-radar-figure idol-radar-figure-detail">
  <svg class="idol-radar-svg idol-radar-svg-detail" viewBox="-10 -10 220 220" overflow="visible" role="img" aria-label="Five-axis attribute radar">
    ${rings}
    ${axisLines.join("")}
    <polygon points="${polyPts.join(" ")}" class="idol-radar-poly"/>
    ${valueEls.join("")}
    ${labelEls.join("")}
  </svg>
</figure>`;
}

function renderGroupHistoryTable(
  row: Record<string, unknown>,
  uidToName: Map<string, string>,
  groupsSnapshot: Record<string, unknown>[],
  referenceIso: string | undefined,
  lang: UiLanguage,
): string {
  const hist = row.group_history;
  if (!Array.isArray(hist) || !hist.length) {
    return `<p class="content-muted">${htmlEsc(t(lang, "idol_no_group_history"))}</p>`;
  }
  const tbody = hist
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    .map((e) => {
      const gname = String(e.group_name ?? "").trim();
      let guid = String(e.group_uid ?? "").trim();
      const label =
        gname ||
        (guid ? (uidToName.get(guid) ?? `${guid.slice(0, 10)}…`) : "—");
      if (!guid && label !== "—") guid = lookupGroupUidByName(groupsSnapshot, label) ?? "";
      const groupCell = guid
        ? `<button type="button" class="idol-history-group-link" data-group-detail="${htmlEsc(guid)}" data-wiki-skip="1">${htmlEsc(label)}</button>`
        : `<span data-wiki-skip="1">${htmlEsc(label)}</span>`;
      const col = typeof e.member_color === "string" && e.member_color ? e.member_color : "—";
      const mn = typeof e.member_name === "string" && e.member_name ? e.member_name : "—";
      const roles = memberRolesSummary(roleAssignmentsFromHistoryEntry(e));
      const startDisp = fmtHistoryDateDisplay(e.start_date, referenceIso, e, "start");
      const endDisp = fmtHistoryDateDisplay(e.end_date, referenceIso, e, "end");
      return `<tr><td>${groupCell}</td><td>${startDisp ? htmlEsc(startDisp) : ""}</td><td>${endDisp ? htmlEsc(endDisp) : ""}</td><td>${htmlEsc(col)}</td><td>${htmlEsc(mn)}</td><td>${htmlEsc(roles)}</td></tr>`;
    })
    .join("");
  return `
    <div class="table-scroll idol-history-scroll">
      <table class="fm-table">
        <thead><tr><th>${htmlEsc(t(lang, "idol_group"))}</th><th>${htmlEsc(localizedLiteral(lang, "Start", "开始"))}</th><th>${htmlEsc(localizedLiteral(lang, "End", "结束"))}</th><th>${htmlEsc(t(lang, "group_color"))}</th><th>${htmlEsc(localizedLiteral(lang, "Stage name", "艺名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Roles", "定位"))}</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function pastNamesSummary(row: Record<string, unknown>): string {
  const pn = row.past_names;
  if (!pn || typeof pn !== "object") return "-";
  const entries = Object.entries(pn as Record<string, unknown>)
    .map(([k, v]) => `${k}${v != null && String(v) ? ` (${String(v)})` : ""}`)
    .filter(Boolean);
  return entries.length ? entries.join(" - ") : "-";
}

/** Single-idol profile (mirrors desktop `IdolUIMixin._show_idol_profile`). */
function renderIdolDetailPage(
  row: Record<string, unknown>,
  groupsSnapshot: Record<string, unknown>[],
  referenceIso: string | undefined,
  lang: UiLanguage,
): string {
  const name = typeof row.name === "string" ? row.name : "-";
  const romaji = romajiFromRow(row);
  const nick = typeof row.nickname === "string" ? row.nickname.trim() : "";
  const hiragana = typeof row.hiragana === "string" ? row.hiragana.trim() : "";
  const attrs = attrsFromRow(row);
  const attrPanels = renderAttributePanels(attrs);

  const initial = [...(name.trim() || "?")][0] ?? "?";
  const portraitSrc = idolPortraitPublicSrc(row, referenceIso);
  const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
  const portraitBig = portraitSrc
    ? `<img class="idol-detail-portrait" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" width="220" height="220" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<div class="idol-detail-portrait-ph" aria-hidden="true">${htmlEsc(initial)}</div>`;

  const age = htmlEsc(ageLabel(row, referenceIso));
  const xLbl = htmlEsc(xFollowersLabel(row));
  const memberships = activeGroupMembershipsAtReference(row, referenceIso, groupsSnapshot);
  const roleMemberships = activeGroupRoleMembershipsAtReference(row, referenceIso, groupsSnapshot);
  const currentGroupsHtml =
    memberships.length > 0
      ? memberships
          .map((m) => {
            const guid = m.uid || lookupGroupUidByName(groupsSnapshot, m.name) || "";
            return guid
              ? `<button type="button" class="idol-detail-group-link" data-group-detail="${htmlEsc(guid)}" data-wiki-skip="1">${htmlEsc(m.name)}</button>`
              : `<span data-wiki-skip="1">${htmlEsc(m.name)}</span>`;
          })
          .join(", ")
      : htmlEsc("-");
  const currentRolesText = roleMemberships
    .filter((membership) => membership.roles.length > 0)
    .map((membership) => `${membership.name}: ${memberRolesSummary(membership.roles)}`)
    .join(" | ") || "-";

  const secLine = [
    romaji ? htmlEsc(romaji) : "",
    nick ? `${htmlEsc(t(lang, "idol_nickname"))}: ${htmlEsc(nick)}` : "",
    hiragana ? htmlEsc(hiragana) : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const facts: string[] = [];
  facts.push(`${htmlEsc(t(lang, "idol_age"))} ${age}`);
  const tenure = row.scenario_tenure_years;
  if (typeof tenure === "number" && Number.isFinite(tenure)) {
    facts.push(`${htmlEsc(t(lang, "idol_tenure"))} ${htmlEsc(`${tenure.toFixed(1)}y`)}`);
  }
  const h = row.height;
  if (typeof h === "number" && Number.isFinite(h)) facts.push(htmlEsc(`${Math.round(h)} cm`));
  const bp = typeof row.birthplace === "string" && row.birthplace.trim() ? row.birthplace.trim() : "";
  if (bp) facts.push(htmlEsc(bp));

  const uidToName = groupNamesByUid(groupsSnapshot);
  const birthdayDisplay =
    typeof row.birthday === "string" && row.birthday.trim()
      ? htmlEsc(row.birthday.trim().split("T")[0])
      : typeof row.birthday_partial === "string" && row.birthday_partial.trim()
        ? htmlEsc(row.birthday_partial.trim())
        : "-";
  const langs = Array.isArray(row.languages) ? row.languages.map((x) => String(x)).join(", ") : "";

  const xa = typeof row.x_account === "string" ? row.x_account.trim() : "";
  const xh = typeof row.x_handle === "string" ? row.x_handle.trim() : "";
  let xHandle = "-";
  if (xa) xHandle = `@${xa.replace(/^@/, "")}`;
  else if (xh) xHandle = xh.startsWith("@") ? xh : `@${xh}`;

  const wikiUrl =
    typeof row.wiki_url === "string" && row.wiki_url.trim().startsWith("http") ? row.wiki_url.trim() : "";
  const xProfileUrl = idolXProfileUrl(row);
  const xFollowersDisp = xFollowersLabel(row);

  const xHandleLink =
    xProfileUrl && xHandle !== "-"
      ? `<a class="idol-detail-x-strip-a" href="${attrQuotedUrl(xProfileUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc(xHandle)}</a>`
      : xHandle !== "-"
        ? `<span class="idol-detail-x-strip-plain">${htmlEsc(xHandle)}</span>`
        : "";

  const wikiPart = wikiUrl
    ? `<a class="idol-detail-wiki-inline" href="${attrQuotedUrl(wikiUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "common_wiki"))}</a>`
    : "";

  const ablPart = `<span class="idol-detail-inline-frame idol-detail-abl-frame">${htmlEsc(localizedLiteral(lang, "Ability", "能力"))} <strong>${getAbility(attrs)}</strong></span>`;

  const xPart = `<span class="idol-detail-inline-frame idol-detail-x-frame">
      <span class="idol-detail-x-prefix">${htmlEsc("X")}</span>
      ${xHandleLink}
      <span class="idol-detail-x-followers">${htmlEsc(xFollowersDisp)}</span>
    </span>`;

  const linksInline = `<div class="idol-detail-links-inline">${wikiPart}${ablPart}${xPart}</div>`;

  return `
<section class="content-panel idol-detail-view" aria-label="${htmlEsc(name)}">
  <header class="idol-detail-toolbar">
    <button type="button" class="fm-btn fm-btn-accent" id="btn-idol-detail-back">${htmlEsc(t(lang, "idol_back_list"))}</button>
  </header>

  <div class="idol-detail-head fm-card idol-detail-head-grid">
    <div class="idol-detail-portrait-wrap">${portraitBig}</div>
    <div class="idol-detail-head-main">
      <h2 class="idol-detail-name">${htmlEsc(name)}</h2>
      ${secLine ? `<p class="idol-detail-sub">${secLine}</p>` : ""}
      <p class="idol-detail-facts">${facts.join(" - ")}</p>
      <p class="idol-detail-current-groups" data-wiki-skip="1"><strong>${htmlEsc(t(lang, "idol_group"))}:</strong> ${currentGroupsHtml}</p>
      <p class="idol-detail-current-groups"><strong>${htmlEsc(localizedLiteral(lang, "Roles", "定位"))}:</strong> ${htmlEsc(currentRolesText)}</p>
      ${linksInline}
    </div>
    <aside class="idol-detail-radar-aside" aria-label="${htmlEsc(localizedLiteral(lang, "Radar", "雷达图"))}">
      ${renderRadarSvg(attrs)}
    </aside>
  </div>

  <section class="fm-card idol-detail-block">
    <h3 class="content-h3 idol-detail-h">${htmlEsc(t(lang, "idol_attributes"))}</h3>
    <div class="idol-detail-attrs">${attrPanels}</div>
  </section>

  <section class="fm-card idol-detail-block">
    <h3 class="content-h3 idol-detail-h">${htmlEsc(t(lang, "idol_basic_info"))}</h3>
    <dl class="basic-dl">
      <div><dt>${htmlEsc(t(lang, "idol_birthday"))}</dt><dd>${birthdayDisplay}</dd></div>
      <div><dt>${htmlEsc(t(lang, "idol_birthplace"))}</dt><dd>${bp ? htmlEsc(bp) : "-"}</dd></div>
      <div><dt>${htmlEsc(t(lang, "idol_languages"))}</dt><dd>${langs ? htmlEsc(langs) : htmlEsc(t(lang, "common_japanese"))}</dd></div>
      <div><dt>${htmlEsc(localizedLiteral(lang, "Current roles", "当前定位"))}</dt><dd>${htmlEsc(currentRolesText)}</dd></div>
      <div><dt>${htmlEsc(t(lang, "idol_past_names"))}</dt><dd>${htmlEsc(pastNamesSummary(row))}</dd></div>
      <div><dt>${htmlEsc(t(lang, "idol_x_handle"))}</dt><dd>${htmlEsc(xHandle)}</dd></div>
      <div><dt>${htmlEsc(t(lang, "idol_x_followers"))}</dt><dd>${xLbl}</dd></div>
    </dl>
  </section>

  <section class="fm-card idol-detail-block" data-wiki-skip="1">
    <h3 class="content-h3 idol-detail-h">${htmlEsc(t(lang, "idol_group_history"))}</h3>
    ${renderGroupHistoryTable(row, uidToName, groupsSnapshot, referenceIso, lang)}
  </section>
</section>`;
}

function renderInbox(
  save: GameSavePayload,
  selectedUid: string | null,
  simulationBusy: boolean,
  attentionActionUid: string | null,
  lang: UiLanguage,
): string {
  const rows = [...save.inbox.notifications];
  sortNotificationsInPlace(rows);
  if (!rows.length) {
    return `<section class="content-panel"><p class="content-muted">${htmlEsc(t(lang, "inbox_empty"))}</p></section>`;
  }
  const sel = selectedUid && rows.some((r) => r.uid === selectedUid) ? selectedUid : null;
  const selected = sel ? rows.find((r) => r.uid === sel) ?? null : null;

  const markAllDisabled = rows.every((r) => r.read || notificationRequiresAck(r));
  const notificationTimeLabel = (row: { created_at?: string }): string => {
    const created = String(row.created_at ?? "").trim();
    return created.includes("T") ? created.split("T")[1]?.slice(0, 5) ?? "00:00" : "00:00";
  };

  const list = rows
    .map((n) => {
      const localized = localizedNotificationText(n, lang);
      const unread = !n.read ? `<span class="badge-unread" aria-hidden="true">*</span> ` : "";
      const active = n.uid === sel ? " is-active" : "";
      const attention = attentionActionUid === n.uid ? `<span class="inbox-blocker-alert" aria-hidden="true">!</span>` : "";
      return `<button type="button" class="inbox-row-btn fm-card${active}" data-inbox-uid="${htmlEsc(n.uid)}">
        <span class="inbox-row-title">${unread}<span>${htmlEsc(localized.title)}</span>${attention}</span>
        <span class="inbox-row-meta">${htmlEsc(n.date)} - ${htmlEsc(localized.sender)}</span>
      </button>`;
    })
    .join("");

  const detail = selected
    ? (() => {
        const localizedSelected = localizedNotificationText(selected, lang);
        const liveReport =
          selected.report_data &&
          typeof selected.report_data === "object" &&
          String((selected.report_data as Record<string, unknown>).kind ?? "") === "live_report"
            ? (selected.report_data as Record<string, unknown>)
            : null;
        const specialReport =
          selected.report_data && typeof selected.report_data === "object"
            ? (selected.report_data as Record<string, unknown>)
            : null;
        const specialKind = String(specialReport?.kind ?? "");
        const isLiveSchedule =
          selected.title === "Today's live schedule" ||
          String(selected.dedupe_key ?? "").startsWith("daily-lives|");
        const primaryBtn = isLiveSchedule
          ? `<button type="button" class="fm-btn fm-btn-accent" data-inbox-live-start="${htmlEsc(selected.uid)}" ${simulationBusy ? "disabled" : ""}>${htmlEsc(t(lang, "inbox_live_start"))}${attentionActionUid === selected.uid ? ` <span class="inbox-blocker-alert" aria-hidden="true">!</span>` : ""}</button>`
          : ``;
        const liveScheduleLinks = isLiveSchedule
          ? (() => {
              const dateIso = String(selected.date ?? "").split("T")[0];
              const todaysLives = (save.lives?.schedules ?? [])
                .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
                .filter((live) => String(live.start_date ?? "").split("T")[0] === dateIso)
                .sort((a, b) => String(a.start_time ?? "").localeCompare(String(b.start_time ?? "")));
              if (!todaysLives.length) return "";
              const items = todaysLives
                .map((live) => {
                  const uid = String(live.uid ?? "");
                  const title = liveDisplayTitleText(live);
                  const when = liveTimeRangeText(live) || formatLiveSlotLine(live) || dateIso;
                  const venueText = liveVenueCompactText(live);
              return `<li><button type="button" class="text-action-btn" data-live-open-uid="${htmlEsc(uid)}">${htmlEsc(title)}</button><span class="content-muted"> ${htmlEsc(`${when} · ${venueText}`)}</span></li>`;
                })
                .join("");
              return `<div class="live-report-detail"><h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Today's lives", "今日演出"))}</h4><ul class="plain-list">${items}</ul></div>`;
            })()
          : "";
        const startupActions = (() => {
          const dedupeKey = String(selected.dedupe_key ?? "");
          if (dedupeKey.startsWith("startup-lives|")) {
            const upcomingItems = (save.lives?.schedules ?? [])
              .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
              .sort((a, b) => {
                const da = String(a.start_date ?? "");
                const db = String(b.start_date ?? "");
                if (da !== db) return da.localeCompare(db);
                return String(a.start_time ?? "").localeCompare(String(b.start_time ?? ""));
              })
              .slice(0, 24)
              .map((live) => {
                const uid = String(live.uid ?? "");
                const title = liveDisplayTitleText(live);
                const when = formatLiveSlotLine(live) || String(live.start_date ?? "").split("T")[0];
                const venueText = liveVenueCompactText(live);
                return `<li><button type="button" class="text-action-btn" data-live-open-uid="${htmlEsc(uid)}">${htmlEsc(title)}</button><span class="content-muted"> ${htmlEsc(`${when} · ${venueText}`)}</span></li>`;
              })
              .join("");
            if (upcomingItems) {
              return `<div class="live-report-detail"><h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Booked lives", "已排期演出"))}</h4><ul class="plain-list">${upcomingItems}</ul></div>`;
            }
          }
          if (dedupeKey.startsWith("startup-staff|")) {
            return `<div class="live-report-detail"><div class="inbox-action-row"><button type="button" class="fm-btn" data-open-training-view="assignments">${htmlEsc(localizedLiteral(lang, "Training schedule", "训练安排"))}</button><button type="button" class="fm-btn" data-open-training-view="roster">${htmlEsc(localizedLiteral(lang, "Idol status table", "成员状态表"))}</button></div></div>`;
          }
          if (dedupeKey.startsWith("startup-roster|")) {
            const groups = save.database_snapshot.groups as Record<string, unknown>[];
            const managedGroup = groups.find((row) => String(row.uid ?? "") === save.managing_group_uid) ?? null;
            const managedMemberUids = new Set(
              Array.isArray(managedGroup?.member_uids) ? managedGroup.member_uids.map((x) => String(x)) : [],
            );
            const matchGroupHistory = (row: Record<string, unknown>) => {
              const hist = Array.isArray(row.group_history) ? row.group_history : [];
              return hist
                .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
                .filter((entry) => String(entry.group_uid ?? "") === save.managing_group_uid);
            };
            const entryStartKey = (entry: Record<string, unknown>): string => String(entry.start_date ?? "").split("T")[0];
            const entryEndKey = (entry: Record<string, unknown>): string => String(entry.end_date ?? "").split("T")[0];
            const portraitCell = (row: Record<string, unknown>, name: string) => {
              const initial = [...(name.trim() || "?")][0] ?? "?";
              const portraitSrc = idolPortraitPublicSrc(row, save.current_date);
              const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
              return portraitSrc
                ? `<img class="idol-thumb" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
                : `<span class="idol-thumb-ph" aria-hidden="true">${htmlEsc(initial)}</span>`;
            };
            const colorCell = (color: string, colorCode?: unknown) => {
              const colorTrim = color.trim();
              const colorCss = resolveMemberColorCss(colorTrim, colorCode);
              const colorLabelStyle = colorCss ? ` style="color:${colorCss}"` : "";
              return colorCss
                ? `<span class="group-member-color-chip" style="background:${colorCss}" title="${htmlEsc(color)}"></span><span class="group-member-color-text"${colorLabelStyle}>${htmlEsc(color)}</span>`
                : `<span class="group-member-color-chip group-member-color-chip--default" title="${htmlEsc(color !== "—" ? color : "Default")}"></span> ${htmlEsc(color !== "—" ? color : "—")}`;
            };
            const currentRows = save.database_snapshot.idols
              .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
              .filter((row) => managedMemberUids.has(String(row.uid ?? "")))
              .map((row) => {
                const uid = String(row.uid ?? "");
                const name = String((row.name ?? uid) || "Idol");
                const currentEntry =
                  matchGroupHistory(row)
                    .find((entry) => {
                      const end = entryEndKey(entry);
                      return !end || end >= String(save.current_date ?? "").split("T")[0];
                    }) ?? null;
                const enterDate = currentEntry ? fmtHistoryDateDisplay(currentEntry.start_date, save.current_date, currentEntry, "start") : "—";
                const color =
                  currentEntry && typeof currentEntry.member_color === "string" && currentEntry.member_color.trim()
                    ? currentEntry.member_color.trim()
                    : typeof row.member_color === "string" && row.member_color.trim()
                      ? row.member_color.trim()
                      : "—";
                const colorCode = currentEntry?.member_color_code ?? row.member_color_code;
                return { uid, name, enterDate, color, colorCode, photo: portraitCell(row, name) };
              })
              .sort((a, b) => a.enterDate.localeCompare(b.enterDate));
            const pastRows = save.database_snapshot.idols
              .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
              .filter((row) => !managedMemberUids.has(String(row.uid ?? "")))
              .map((row) => {
                const uid = String(row.uid ?? "");
                const name = String((row.name ?? uid) || "Idol");
                const pastEntries = matchGroupHistory(row).filter((entry) => Boolean(entryEndKey(entry)));
                if (!pastEntries.length) return null;
                const latest = [...pastEntries].sort((a, b) => entryStartKey(b).localeCompare(entryStartKey(a)))[0];
                const leaveKey = entryEndKey(latest);
                const activeGroupUids = new Set(
                  activeGroupMembershipsAtReference(row, save.current_date, groups)
                    .map((m) => String(m.uid ?? "").trim())
                    .filter(Boolean),
                );
                const followingGroups = (Array.isArray(row.group_history) ? row.group_history : [])
                  .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
                  .filter((entry) => String(entry.group_uid ?? "") !== save.managing_group_uid)
                  .filter((entry) => {
                    const start = entryStartKey(entry);
                    return Boolean(start) && (!leaveKey || start >= leaveKey);
                  })
                  .map((entry) => {
                    const groupUid = String(entry.group_uid ?? "").trim();
                    const groupName = String(entry.group_name ?? "").trim() || groupUid || "—";
                    const linked = groupUid
                      ? `<button type="button" class="text-action-btn" data-group-detail="${htmlEsc(groupUid)}">${htmlEsc(groupName)}</button>`
                      : htmlEsc(groupName);
                    return activeGroupUids.has(groupUid) ? `<strong>${linked}</strong>` : linked;
                  })
                  .filter(Boolean);
                return {
                  uid,
                  name,
                  enterDate: fmtHistoryDateDisplay(latest.start_date, save.current_date, latest, "start"),
                  leaveDate: fmtHistoryDateDisplay(latest.end_date, save.current_date, latest, "end"),
                  followingGroups: followingGroups.join(", ") || "—",
                };
              })
              .filter((row): row is { uid: string; name: string; enterDate: string; leaveDate: string; followingGroups: string } => Boolean(row))
              .sort((a, b) => a.leaveDate.localeCompare(b.leaveDate));
            const currentTable = currentRows
              .map(
                (row) =>
                  `<tr><td class="idol-list-photo startup-roster-photo">${row.photo}</td><td><button type="button" class="text-action-btn" data-idol-detail="${htmlEsc(row.uid)}">${htmlEsc(row.name)}</button></td><td>${colorCell(row.color, row.colorCode)}</td><td>${htmlEsc(row.enterDate)}</td></tr>`,
              )
              .join("");
            const pastTable = pastRows
              .map(
                (row) =>
                  `<tr><td><button type="button" class="text-action-btn" data-idol-detail="${htmlEsc(row.uid)}">${htmlEsc(row.name)}</button></td><td>${htmlEsc(row.enterDate)}</td><td>${htmlEsc(row.leaveDate)}</td><td>${row.followingGroups}</td></tr>`,
              )
              .join("");
            return `<div class="live-report-detail">
              <div class="table-panel">
                <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Current members", "现役成员"))}</h4>
                <div class="table-scroll"><table class="fm-table"><thead><tr><th></th><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(t(lang, "group_color"))}</th><th>${htmlEsc(localizedLiteral(lang, "Enter group", "加入组合"))}</th></tr></thead><tbody>${currentTable || `<tr><td colspan="4" class="content-muted">${htmlEsc(localizedLiteral(lang, "No current members found.", "没有找到现役成员。"))}</td></tr>`}</tbody></table></div>
              </div>
              <div class="table-panel">
                <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Past members", "历代成员"))}</h4>
                <div class="table-scroll"><table class="fm-table"><thead><tr><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Enter group", "加入组合"))}</th><th>${htmlEsc(localizedLiteral(lang, "Leave group", "离开组合"))}</th><th>${htmlEsc(localizedLiteral(lang, "Following group", "后续组合"))}</th></tr></thead><tbody>${pastTable || `<tr><td colspan="4" class="content-muted">${htmlEsc(localizedLiteral(lang, "No past members found.", "没有找到历代成员。"))}</td></tr>`}</tbody></table></div>
              </div>
            </div>`;
          }
          if (specialKind === "weekly_news_roundup" && specialReport) {
            const renderGroupLink = (groupUid: string, groupName: string) =>
              groupUid
                ? `<button type="button" class="text-action-btn" data-group-detail="${htmlEsc(groupUid)}">${htmlEsc(groupName)}</button>`
                : htmlEsc(groupName);
            const renderIdolLink = (idolUid: string, idolName: string) =>
              idolUid
                ? `<button type="button" class="text-action-btn" data-idol-detail="${htmlEsc(idolUid)}">${htmlEsc(idolName)}</button>`
                : htmlEsc(idolName);
            const formedRows = Array.isArray(specialReport.formed_rows) ? (specialReport.formed_rows as Record<string, unknown>[]) : [];
            const joinRows = Array.isArray(specialReport.join_rows) ? (specialReport.join_rows as Record<string, unknown>[]) : [];
            const leftRows = Array.isArray(specialReport.left_rows) ? (specialReport.left_rows as Record<string, unknown>[]) : [];
            const formedItems = formedRows
              .map((row) => `<li>${htmlEsc(String(row.date ?? ""))}: ${renderGroupLink(String(row.groupUid ?? ""), String(row.group ?? localizedLiteral(lang, "Group", "组合")))} ${htmlEsc(localizedLiteral(lang, "formed.", "成立。"))}</li>`)
              .join("");
            const joinItems = joinRows
              .map((row) => `<li>${htmlEsc(String(row.date ?? ""))}: ${renderIdolLink(String(row.idolUid ?? ""), String(row.idol ?? localizedLiteral(lang, "Member", "成员")))} ${htmlEsc(localizedLiteral(lang, "joined", "加入"))} ${renderGroupLink(String(row.groupUid ?? ""), String(row.group ?? localizedLiteral(lang, "Group", "组合")))}?</li>`)
              .join("");
            const leftItems = leftRows
              .map((row) => `<li>${htmlEsc(String(row.date ?? ""))}: ${renderIdolLink(String(row.idolUid ?? ""), String(row.idol ?? localizedLiteral(lang, "Member", "成员")))} ${htmlEsc(localizedLiteral(lang, "left", "离开"))} ${renderGroupLink(String(row.groupUid ?? ""), String(row.group ?? localizedLiteral(lang, "Group", "组合")))}?</li>`)
              .join("");
            return `<div class="live-report-detail">
              <div class="table-panel">
                <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "New groups", "新组合"))}</h4>
                <ul class="plain-list">${formedItems || `<li class="content-muted">${htmlEsc(localizedLiteral(lang, "No new groups this week.", "本周没有新组合。"))}</li>`}</ul>
              </div>
              <div class="table-panel">
                <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Member joins", "成员加入"))}</h4>
                <ul class="plain-list">${joinItems || `<li class="content-muted">${htmlEsc(localizedLiteral(lang, "No member joins this week.", "本周没有成员加入。"))}</li>`}</ul>
              </div>
              <div class="table-panel">
                <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Member departures", "成员离队"))}</h4>
                <ul class="plain-list">${leftItems || `<li class="content-muted">${htmlEsc(localizedLiteral(lang, "No member departures this week.", "本周没有成员离队。"))}</li>`}</ul>
              </div>
            </div>`;
          }
          return "";
        })();
        const renderLiveReport = (): string => {
          if (specialKind === "contract_renew_review" && specialReport) {
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Current salary", "当前薪资"))}</span><strong>${htmlEsc(currencyText(lang, Number(specialReport.current_salary_yen ?? 0)))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Current end", "当前到期日"))}</span><strong>${htmlEsc(String(specialReport.current_end_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Likelihood", "续约倾向"))}</span><strong>${htmlEsc(String(specialReport.likelihood ?? "-"))}</strong></div>
              </div>
              <div class="form-grid live-form-grid">
                <label><span>${htmlEsc(localizedLiteral(lang, "New salary", "新薪资"))}</span><input type="number" class="fm-input" data-contract-draft-salary="${htmlEsc(selected.uid)}" value="${htmlEsc(String(Number(specialReport.proposed_salary_yen ?? 0) || 0))}" /></label>
                <label><span>${htmlEsc(localizedLiteral(lang, "New end date", "新到期日"))}</span><input type="date" class="fm-input" data-contract-draft-end="${htmlEsc(selected.uid)}" value="${htmlEsc(String(specialReport.proposed_end_date ?? ""))}" /></label>
              </div>
            </div>`;
          }
          if (specialKind === "contract_renew_confirm" && specialReport) {
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Proposed salary", "提议薪资"))}</span><strong>${htmlEsc(currencyText(lang, Number(specialReport.proposed_salary_yen ?? 0)))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Proposed end", "提议到期日"))}</span><strong>${htmlEsc(String(specialReport.proposed_end_date ?? "-"))}</strong></div>
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}</div>
            </div>`;
          }
          if (specialKind === "contract_terminate_review" && specialReport) {
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Salary", "薪资"))}</span><strong>${htmlEsc(currencyText(lang, Number(specialReport.salary_yen ?? 0)))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Contract end", "合约到期日"))}</span><strong>${htmlEsc(String(specialReport.contract_end_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Scandal", "丑闻"))}</span><strong>${htmlEsc(lang === "zh-CN" ? `等级 ${String(specialReport.scandal_level ?? 0)}` : `Level ${String(specialReport.scandal_level ?? 0)}`)}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Termination fee", "解约金"))}</span><strong>${htmlEsc(currencyText(lang, Number(specialReport.termination_fee_yen ?? 0)))}</strong></div>
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}</div>
            </div>`;
          }
          if (specialKind === "scout_subscription" && specialReport) {
            const leadUid = String(specialReport.first_lead_uid ?? "");
            const lead = leadUid
              ? (save.database_snapshot.idols.find((row) => String((row as Record<string, unknown>).uid ?? "") === leadUid) as Record<string, unknown> | undefined)
              : undefined;
            const leadName = String((lead?.name ?? leadUid) || localizedLiteral(lang, "No lead yet", "暂无人选"));
            const companyName = String(specialReport.company_name ?? selected.sender ?? localizedLiteral(lang, "Scout", "星探"));
            const profileScore = Number(specialReport.first_lead_profile_score ?? NaN);
            const reason = String(specialReport.first_lead_reason ?? "").trim();
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Scout firm", "星探公司"))}</span><strong>${htmlEsc(companyName)}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Monthly fee", "月费"))}</span><strong>${htmlEsc(`¥${Number(specialReport.service_fee_yen ?? 0).toLocaleString("ja-JP")}`)}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Immediate lead", "即时人选"))}</span><strong>${leadUid ? `<button type="button" class="text-action-btn" data-idol-detail="${htmlEsc(leadUid)}">${htmlEsc(leadName)}</button>` : htmlEsc(t(lang, "common_none"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Profile", "资料评分"))}</span><strong>${Number.isFinite(profileScore) ? htmlEsc(String(profileScore)) : "—"}</strong></div>
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}${reason ? `<br /><br /><strong>${htmlEsc(localizedLiteral(lang, "Scout read", "星探评价"))}:</strong> ${htmlEsc(reason)}` : ""}</div>
            </div>`;
          }
          if (specialKind === "shortlist_signing_offer" && specialReport) {
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Idol", "偶像"))}</span><strong>${htmlEsc(String(specialReport.idol_name ?? localizedLiteral(lang, "Idol", "偶像")))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Start date", "开始日期"))}</span><strong>${htmlEsc(String(specialReport.start_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "End date", "结束日期"))}</span><strong>${htmlEsc(String(specialReport.end_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Salary", "薪资"))}</span><strong>${htmlEsc(currencyText(lang, Number(specialReport.salary_yen ?? 0)))}</strong></div>
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}</div>
            </div>`;
          }
          if (specialKind === "career_graduation_notice" && specialReport) {
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Member", "成员"))}</span><strong>${htmlEsc(String(specialReport.idol_name ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Graduation date", "毕业日"))}</span><strong>${htmlEsc(String(specialReport.effective_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Negotiable", "可协商"))}</span><strong>${htmlEsc(localizedLiteral(lang, "No (locked)", "否（锁定）"))}</strong></div>
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}</div>
            </div>`;
          }
          if (specialKind === "managed_group_leave" && specialReport) {
            const negotiable = specialReport.negotiable !== false;
            const postSuspend = String(specialReport.subtype ?? "") === "post_suspension_leave";
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Member", "成员"))}</span><strong>${htmlEsc(String(specialReport.idol_name ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, postSuspend ? "Intended leave" : "Leave date", postSuspend ? "拟离团日" : "离团日"))}</span><strong>${htmlEsc(String(specialReport.effective_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Group", "组合"))}</span><strong>${htmlEsc(String(specialReport.group_name ?? "-"))}</strong></div>
                ${
                  postSuspend
                    ? `<div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Suspended since", "休止开始"))}</span><strong>${htmlEsc(String(specialReport.scandal_date ?? "-"))}</strong></div>`
                    : ""
                }
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Negotiable", "可协商"))}</span><strong>${htmlEsc(negotiable ? localizedLiteral(lang, "Yes (major)", "是（重大）") : localizedLiteral(lang, "No (locked)", "否（锁定）"))}</strong></div>
                ${
                  specialReport.destination_group_name
                    ? `<div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Destination", "去向"))}</span><strong>${htmlEsc(String(specialReport.destination_group_name))}</strong></div>`
                    : ""
                }
                ${
                  Number(specialReport.retain_salary_bump_yen ?? 0) > 0
                    ? `<div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Retain bump", "挽留加薪"))}</span><strong>${htmlEsc(currencyText(lang, Number(specialReport.retain_salary_bump_yen ?? 0)))}</strong></div>`
                    : ""
                }
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}</div>
            </div>`;
          }
          if (specialKind === "managed_scandal_handling" && specialReport) {
            const previews = Array.isArray(specialReport.consequence_previews)
              ? (specialReport.consequence_previews as Array<Record<string, unknown>>)
              : [];
            const recommended = String(specialReport.recommended_action ?? "");
            const previewHtml = previews.length
              ? `<div class="live-report-summary-grid" style="margin-top:0.75rem">
                  ${previews
                    .map((row) => {
                      const action = String(row.action ?? "");
                      const label = String(row.label ?? action);
                      const blurb = String(row.blurb ?? "");
                      const utility = Number(row.utility ?? 0) || 0;
                      const risk = String(row.risk ?? "");
                      const axes = row.axes && typeof row.axes === "object" ? (row.axes as Record<string, unknown>) : {};
                      const cash = Number(row.cash_delta_yen ?? 0) || 0;
                      const fans = Number(row.fan_group_delta ?? 0) || 0;
                      const days = Number(row.penalty_days ?? 0) || 0;
                      const salary = Number(row.salary_cut_pct ?? 0) || 0;
                      const isBest = recommended && action === recommended;
                      const hist = row.matches_history ? " · historical" : "";
                      const meta = [
                        `utility ${utility.toFixed(0)}`,
                        risk ? `risk ${risk}` : "",
                        `cash ${cash < 0 ? "-" : ""}¥${Math.abs(cash).toLocaleString("ja-JP")}`,
                        `fans ${fans}`,
                        salary > 0 ? `salary -${salary}%` : "",
                        days > 0 ? `form ${days}d` : "",
                      ]
                        .filter(Boolean)
                        .join(" · ");
                      const axisLine = `brand ${Number(axes.brand ?? 0).toFixed(0)} · fans ${Number(axes.fans ?? 0).toFixed(0)} · finance ${Number(axes.finance ?? 0).toFixed(0)} · roster ${Number(axes.roster ?? 0).toFixed(0)} · live ${Number(axes.live ?? 0).toFixed(0)} · team ${Number(axes.team ?? 0).toFixed(0)}`;
                      return `<div class="live-report-summary-item" style="grid-column:1/-1${isBest ? ";outline:1px solid var(--accent, #c45)" : ""}"><span class="label">${htmlEsc(label)}${isBest ? " ★" : ""}${htmlEsc(hist)}</span><strong>${htmlEsc(blurb)}</strong><div class="muted">${htmlEsc(meta)}</div><div class="muted">${htmlEsc(axisLine)}</div></div>`;
                    })
                    .join("")}
                </div>`
              : "";
            return `<div class="live-report-detail contract-event-detail">
              <div class="live-report-summary-grid">
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Member", "成员"))}</span><strong>${htmlEsc(String(specialReport.idol_name ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Group", "组合"))}</span><strong>${htmlEsc(String(specialReport.group_name ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Scandal date", "丑闻日"))}</span><strong>${htmlEsc(String(specialReport.scandal_date ?? "-"))}</strong></div>
                <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Score", "评分"))}</span><strong>${htmlEsc(String(specialReport.score ?? "-"))}</strong></div>
                ${
                  specialReport.historical_action
                    ? `<div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Historical", "史实应对"))}</span><strong>${htmlEsc(String(specialReport.historical_action).replaceAll("_", " "))}</strong></div>`
                    : ""
                }
                ${
                  specialReport.recommended_action
                    ? `<div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Model pick", "模型倾向"))}</span><strong>${htmlEsc(String(specialReport.recommended_action).replaceAll("_", " "))} (${htmlEsc(String(Number(specialReport.recommended_utility ?? 0).toFixed(0)))})</strong></div>`
                    : ""
                }
              </div>
              <div class="inbox-plain-body">${htmlEsc(localizedSelected.body).replaceAll("\n", "<br />")}</div>
              ${previewHtml}
            </div>`;
          }
          if (!liveReport) {
            const plainBody = htmlEsc(localizedSelected.body).replaceAll("\n", "<br />");
            if (startupActions) return `${liveScheduleLinks}${startupActions}`;
            return `${liveScheduleLinks}${startupActions}<div class="inbox-plain-body">${plainBody}</div>`;
          }
          const venue = String(liveReport.venue ?? "—");
          const ticketGross = Number(liveReport.ticket_gross_yen ?? 0) || 0;
          const goodsGross = Number(liveReport.goods_gross_yen ?? 0) || 0;
          const chekiGross = Number(liveReport.tokutenkai_revenue_yen ?? 0) || 0;
          const groupFanCount = Number(liveReport.group_fan_count ?? 0) || 0;
          const groupFanGain = Number(liveReport.group_fan_gain ?? 0) || 0;
          const liveTimeText = String(liveReport.slot ?? liveReport.date ?? "—");
          const liveTime = liveTimeText.replace(/^\d{4}-\d{2}-\d{2}\s+/, "");
          const memberRows = Array.isArray(liveReport.member_deltas)
            ? (liveReport.member_deltas as unknown[])
                .filter((row) => row && typeof row === "object")
                .map((row) => {
                  const r = row as Record<string, unknown>;
                  const fanGain = Number(r.fan_gain ?? 0) || 0;
                  const fanCount = Number(r.fan_count ?? 0) || 0;
                  const conditionAfter = Number(r.condition_after ?? 0) || 0;
                  const conditionDelta = Number(r.condition_delta ?? 0) || 0;
                  const moraleGain = Number(r.morale_gain ?? r.morale_delta ?? 0) || 0;
                  const moraleAfter = Number(r.morale_after ?? 0) || 0;
                  return `<tr>
                    <td>${htmlEsc(String(r.name ?? localizedLiteral(lang, "Member", "成员")))}</td>
                    <td class="num">${htmlEsc(String(r.performance_rating ?? "—"))}</td>
                    <td class="num">${htmlEsc(`${fanCount.toLocaleString("ja-JP")} (${fanGain >= 0 ? "+" : ""}${fanGain.toLocaleString("ja-JP")})`)}</td>
                    <td class="num">${htmlEsc(`${conditionAfter} (${conditionDelta >= 0 ? "+" : ""}${conditionDelta})`)}</td>
                    <td class="num">${htmlEsc(`${moraleAfter} (${moraleGain >= 0 ? "+" : ""}${moraleGain})`)}</td>
                    <td class="num">${htmlEsc(currencyText(lang, Number(r.cheki_sale_money_yen ?? 0)))}</td>
                  </tr>`;
                })
                .join("")
            : "";
          return `<div class="live-report-detail">
            <div class="live-report-summary-grid">
              <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Performance", "表现"))}</span><strong>${htmlEsc(String(liveReport.performance_score ?? "—"))}</strong></div>
              <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Satisfaction", "满意度"))}</span><strong>${htmlEsc(String(liveReport.audience_satisfaction ?? "—"))}</strong></div>
              <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Attendance", "到场"))}</span><strong>${htmlEsc(String(liveReport.attendance ?? 0))}${Number(liveReport.capacity ?? 0) > 0 ? htmlEsc(` / ${String(liveReport.capacity)}`) : ""}</strong></div>
              <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Fan", "粉丝"))}</span><strong>${htmlEsc(`${groupFanCount.toLocaleString("ja-JP")} (${groupFanGain >= 0 ? "+" : ""}${groupFanGain.toLocaleString("ja-JP")})`)}</strong></div>
              <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</span><strong>${htmlEsc(venue)}</strong></div>
              <div class="live-report-summary-item"><span class="label">${htmlEsc(localizedLiteral(lang, "Time", "时间"))}</span><strong>${htmlEsc(liveTime)}</strong></div>
              <div class="live-report-summary-item live-report-summary-item--wide"><span class="label">${htmlEsc(localizedLiteral(lang, "Gross", "总收入"))}</span><strong>${htmlEsc(`\u00A5${Number(liveReport.gross_yen ?? 0).toLocaleString("ja-JP")}`)}</strong><span class="live-report-breakdown">${htmlEsc(lang === "zh-CN" ? `门票 \u00A5${ticketGross.toLocaleString("ja-JP")} / 周边 \u00A5${goodsGross.toLocaleString("ja-JP")} / 特典会 \u00A5${chekiGross.toLocaleString("ja-JP")}` : `Tickets \u00A5${ticketGross.toLocaleString("ja-JP")} / Goods \u00A5${goodsGross.toLocaleString("ja-JP")} / Cheki \u00A5${chekiGross.toLocaleString("ja-JP")}`)}</span></div>
            </div>
            <div class="table-scroll">
              <table class="fm-table">
                <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Rate", "评分"))}</th><th>${htmlEsc(localizedLiteral(lang, "Fan Count", "粉丝数"))}</th><th>${htmlEsc(localizedLiteral(lang, "Condition", "状态"))}</th><th>${htmlEsc(localizedLiteral(lang, "Morale", "士气"))}</th><th>${htmlEsc(localizedLiteral(lang, "Cheki Sale", "特典会销售"))}</th></tr></thead>
                <tbody>${memberRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(localizedLiteral(lang, "No member breakdown recorded.", "没有记录成员明细。"))}</td></tr>`}</tbody>
              </table>
            </div>
          </div>`;
        };
        return `<article class="fm-card inbox-detail-card" aria-label="${htmlEsc(localizedLiteral(lang, "Message detail", "消息详情"))}">
        <header class="fm-card-head">
          <h3 class="content-h3 inbox-detail-h">${htmlEsc(localizedSelected.title)}${attentionActionUid === selected.uid ? ` <span class="inbox-blocker-alert" aria-hidden="true">!</span>` : ""}</h3>
          <p class="inbox-detail-meta"><time datetime="${htmlEsc(selected.created_at || selected.date)}">${htmlEsc(selected.date)} ${htmlEsc(notificationTimeLabel(selected))}</time> - ${htmlEsc(localizedSelected.sender)} - ${htmlEsc(localizedSelected.category)}</p>
        </header>
        <div class="inbox-detail-body">${renderLiveReport()}</div>
        ${
          selected.requires_confirmation
            ? `<p class="inbox-flag" role="note"><strong>${htmlEsc(localizedLiteral(lang, "Confirmation required", "需要确认"))}</strong> - ${htmlEsc(isLiveSchedule ? localizedLiteral(lang, "Start live to proceed.", "开始演出后即可继续。") : localizedLiteral(lang, "Acknowledge when you have decided.", "决定后请确认处理。"))}</p>`
            : ""
        }
        ${
          (() => {
            const pendingChoices =
              String(selected.choice_status ?? "") === "pending" && Array.isArray(selected.choice_options)
                ? selected.choice_options.filter((opt) => opt && String(opt.value ?? "").trim())
                : [];
            const choiceButtons = pendingChoices
              .map((opt, index) => {
                const value = String(opt.value ?? "").trim();
                const label = String(opt.label ?? value).trim() || value;
                const accent = index === 0 ? " fm-btn-accent" : "";
                return `<button type="button" class="fm-btn${accent}" data-notification-uid="${htmlEsc(selected.uid)}" data-notification-choice="${htmlEsc(value)}">${htmlEsc(label)}</button>`;
              })
              .join("");
            const specialButtons =
              primaryBtn ||
              (specialKind === "contract_renew_review"
                ? `<button type="button" class="fm-btn fm-btn-accent" data-contract-propose-renew="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Propose", "提交提案"))}</button><button type="button" class="fm-btn" data-contract-cancel="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Cancel", "取消"))}</button>`
                : specialKind === "contract_renew_confirm"
                  ? `<button type="button" class="fm-btn fm-btn-accent" data-contract-confirm-renew="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Confirm", "确认"))}</button><button type="button" class="fm-btn" data-contract-cancel="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Cancel", "取消"))}</button>`
                  : specialKind === "contract_terminate_review"
                    ? `<button type="button" class="fm-btn fm-btn-danger" data-contract-confirm-terminate="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Confirm terminate", "确认解约"))}</button><button type="button" class="fm-btn" data-contract-cancel="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Cancel", "取消"))}</button>`
                    : specialKind === "shortlist_signing_offer"
                      ? `<button type="button" class="fm-btn fm-btn-accent" data-shortlist-confirm-sign="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Confirm sign", "确认签约"))}</button><button type="button" class="fm-btn" data-contract-cancel="${htmlEsc(selected.uid)}">${htmlEsc(localizedLiteral(lang, "Cancel", "取消"))}</button>`
                      : "");
            const actionsHtml = choiceButtons || specialButtons;
            return actionsHtml ? `<div class="inbox-detail-actions">${actionsHtml}</div>` : "";
          })()
        }
      </article>`;
      })()
    : `<p class="content-muted">${htmlEsc(localizedLiteral(lang, "Select a message.", "请选择一条消息。"))}</p>`;

  return `<section class="content-panel inbox-view">
    <div class="inbox-toolbar">
      <h2 class="content-h2 inbox-h2">${htmlEsc(t(lang, "nav_inbox"))}</h2>
      <button type="button" class="fm-btn" id="btn-inbox-mark-all" ${markAllDisabled ? "disabled" : ""}>${htmlEsc(localizedLiteral(lang, "Mark all read", "全部标记已读"))}</button>
    </div>
    <div class="inbox-split">
      <div class="inbox-list-col fm-card" role="navigation" aria-label="${htmlEsc(localizedLiteral(lang, "Messages", "消息列表"))}">${list}</div>
      <div class="inbox-detail-col">${detail}</div>
    </div>
  </section>`;
}

function renderTraining(
  save: GameSavePayload,
  trainingTab: TrainingTab,
  rosterSortKey: TrainingRosterSortKey,
  rosterSortDir: "asc" | "desc",
  lang: UiLanguage,
  roleBenchmarkPreferences?: RoleBenchmarkKey[],
): string {
  const effectiveRoleBenchmarkPreferences =
    roleBenchmarkPreferences ?? (["singing", "dancing", "teamwork", "content", "streaming", "fashion"] as RoleBenchmarkKey[]);
  const sortHeader = (key: TrainingRosterSortKey, label: string) => {
    const active = rosterSortKey === key;
    const arrow = active ? (rosterSortDir === "asc" ? " ?" : " ?") : "";
    return `<button type="button" class="text-action-btn training-sort-btn${active ? " is-active" : ""}" data-training-roster-sort="${htmlEsc(key)}" aria-sort="${active ? (rosterSortDir === "asc" ? "ascending" : "descending") : "none"}">${htmlEsc(label + arrow)}</button>`;
  };
  const grp = getPrimaryGroup(save);
  const memberUidsRaw = Array.isArray(grp?.member_uids)
    ? (grp!.member_uids as unknown[]).map((x) => String(x))
    : [...save.shortlist];
  const idols = save.database_snapshot.idols;
  const ref =
    save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? undefined;

  const groupUidStr = String(grp?.uid ?? "").trim();
  const groupNames = new Set(
    [String(grp?.name ?? "").trim(), String(grp?.name_romanji ?? "").trim()].filter(Boolean),
  );

  const joinDateMsInGroup = (row: Record<string, unknown>): number => {
    const hist = row.group_history;
    if (!Array.isArray(hist)) return Number.POSITIVE_INFINITY;
    for (const raw of hist) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      const uid = String(e.group_uid ?? "").trim();
      const gn = String(e.group_name ?? "").trim();
      if (uid === groupUidStr || (gn && groupNames.has(gn))) {
        const sd = typeof e.start_date === "string" ? e.start_date.trim().split("T")[0] : "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(sd)) return new Date(`${sd}T12:00:00Z`).getTime();
        return Number.POSITIVE_INFINITY;
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  const joinDateInTrainingGroup = (row: Record<string, unknown>): string => {
    const hist = Array.isArray(row.group_history) ? row.group_history : [];
    for (const raw of hist) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const uid = String(entry.group_uid ?? "").trim();
      const gn = String(entry.group_name ?? "").trim();
      if (uid === groupUidStr || (gn && groupNames.has(gn))) {
        const sd = typeof entry.start_date === "string" ? entry.start_date.trim().split("T")[0] : "";
        return /^\d{4}-\d{2}-\d{2}$/.test(sd) ? sd : "—";
      }
    }
    return "—";
  };

  void joinDateInTrainingGroup;

  const memberColorInTrainingGroup = (row: Record<string, unknown>): string => {
    const hist = Array.isArray(row.group_history) ? row.group_history : [];
    for (const raw of hist) {
      if (!raw || typeof raw !== "object") continue;
      const entry = raw as Record<string, unknown>;
      const uid = String(entry.group_uid ?? "").trim();
      const gn = String(entry.group_name ?? "").trim();
      if (uid === groupUidStr || (gn && groupNames.has(gn))) {
        const color = typeof entry.member_color === "string" ? entry.member_color.trim() : "";
        return color || "—";
      }
    }
    return typeof row.member_color === "string" && row.member_color.trim() ? String(row.member_color).trim() : "—";
  };

  const trainingValueToneClass = (value: number): string => {
    if (value >= 90) return "training-value--green";
    if (value > 70) return "training-value--light-green";
    if (value > 50) return "training-value--yellow";
    if (value > 30) return "training-value--orange";
    return "training-value--red";
  };

  const trainingStatusBadges = (row: Record<string, unknown>): string => {
    const hiatusActive = isIdolOnHiatus(row, ref ?? null);
    const history = Array.isArray(row.status_history) ? row.status_history : [];
    const activeStatuses = history
      .filter((entry): entry is Record<string, unknown> => Boolean(entry && typeof entry === "object"))
      .filter((entry) => {
        const start = String(entry.start_date ?? "").split("T")[0];
        if (!ref || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return true;
        return start <= ref;
      });
    const normalized = activeStatuses.map((entry) =>
      `${String(entry.kind ?? "")} ${String(entry.status ?? "")} ${String(entry.summary ?? "")} ${String(entry.label ?? "")} ${String(entry.title ?? "")}`
        .toLowerCase()
        .replace(/[_-]+/g, " "),
    );

    let primary: "rdy" | "inj" | "ill" = "rdy";
    if (normalized.some((text) => /\binjur|\binjured\b|\bfracture\b|\bsprain\b/.test(text))) primary = "inj";
    else if (normalized.some((text) => /\bill\b|\billness\b|\bsick\b|\bfever\b|\bcovid\b/.test(text))) primary = "ill";

    const optionalBadges: string[] = [];
    if (normalized.some((text) => /\bdepress|\bmental\b|\bbreakdown\b/.test(text))) optionalBadges.push("dpr");
    if (hiatusActive || normalized.some((text) => /\bhiatus\b|\bpaused\b|\bon hold\b/.test(text))) optionalBadges.push("hia");
    if (normalized.some((text) => /\bsuspend|\bsuspension\b/.test(text))) optionalBadges.push("sus");

    const badge = (code: string, label: string, klass: string) =>
      `<span class="training-status-badge training-status-badge--${klass}" title="${htmlEsc(label)}">${htmlEsc(code)}</span>`;

    const primaryBadge =
      primary === "inj"
        ? badge(lang === "zh-CN" ? "伤" : "INJ", localizedLiteral(lang, "Injured", "受伤"), "inj")
        : primary === "ill"
          ? badge(lang === "zh-CN" ? "病" : "ILL", localizedLiteral(lang, "Illness", "生病"), "ill")
          : badge(lang === "zh-CN" ? "可" : "RDY", localizedLiteral(lang, "Ready", "可出勤"), "rdy");
    const extras = optionalBadges.map((code) => {
      if (code === "dpr") return badge(lang === "zh-CN" ? "低" : "DPR", localizedLiteral(lang, "Depressed", "低落"), "dpr");
      if (code === "hia") return badge(lang === "zh-CN" ? "休" : "HIA", localizedLiteral(lang, "Hiatus", "休假中"), "hia");
      return badge(lang === "zh-CN" ? "停" : "SUS", localizedLiteral(lang, "Suspended", "停演"), "sus");
    });
    return `<div class="training-status-badges">${[primaryBadge, ...extras].join("")}</div>`;
  };

  const memberUids = [...memberUidsRaw].sort((a, b) => {
    const ra = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === a) as Record<string, unknown> | undefined;
    const rb = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === b) as Record<string, unknown> | undefined;
    if (!ra) return 1;
    if (!rb) return -1;
    const da = joinDateMsInGroup(ra);
    const db = joinDateMsInGroup(rb);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });

  const ageSortValue = (label: string): number => {
    const m = /^(\d+)/.exec(label.trim());
    return m ? Number(m[1]) : Number.POSITIVE_INFINITY;
  };

  const trainingRosterRowsData = memberUids
    .map((uid) => {
      const row = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uid);
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : uid.slice(0, 8);
      const romaji = romajiFromRow(r);
      const age = ageLabel(r, ref);
      const ability = getAbility(normalizePersistedAttributes(r.attributes));
      const started = joinDateInTrainingGroup(r);
      const condition = typeof r.condition === "number" ? r.condition : Number(r.condition ?? 90) || 90;
      const morale = typeof r.morale === "number" ? r.morale : Number(r.morale ?? 70) || 70;
      return {
        uid,
        row: r,
        name,
        romaji,
        age,
        ageSort: ageSortValue(age),
        ability,
        started,
        condition,
        morale,
      };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));

  const rosterSorted = [...trainingRosterRowsData].sort((a, b) => {
    const dir = rosterSortDir === "desc" ? -1 : 1;
    switch (rosterSortKey) {
      case "romaji":
        return dir * (a.romaji || a.name).localeCompare(b.romaji || b.name, "ja");
      case "age":
        return dir * (a.ageSort - b.ageSort || a.name.localeCompare(b.name, "ja"));
      case "ability":
        return dir * (a.ability - b.ability || a.name.localeCompare(b.name, "ja"));
      case "condition":
        return dir * (a.condition - b.condition || a.name.localeCompare(b.name, "ja"));
      case "morale":
        return dir * (a.morale - b.morale || a.name.localeCompare(b.name, "ja"));
      case "started":
      default:
        return dir * (a.started.localeCompare(b.started) || a.name.localeCompare(b.name, "ja"));
    }
  });

  const cards = memberUids
    .map((uid) => {
      const row = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uid);
      if (!row || typeof row !== "object") return "";
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : uid.slice(0, 8);
      const romaji = romajiFromRow(r);
      if (!save.training_intensity[uid]) {
        save.training_intensity[uid] = { ...defaultAutopilotTrainingIntensity() };
      }
      if (save.training_focus_skill[uid] == null || save.training_focus_skill[uid] === undefined) {
        save.training_focus_skill[uid] = "talking";
      }
      const intensity = safeTrainingRow(save.training_intensity[uid]);
      const load = trainingLoadFromRow(intensity);
      const bear = trainingBearIndex(r);
      const over = Math.max(0, load - bear);
      const focus = String(save.training_focus_skill[uid] ?? "");

      const slider = (field: keyof typeof intensity, label: string) => {
        const v = intensity[field];
        return `<label class="training-slider"><span class="training-slider-l">${htmlEsc(label)}</span>
          <input type="range" min="0" max="5" step="1" value="${v}" data-training-slider data-idol-uid="${htmlEsc(uid)}" data-field="${field}" aria-valuemin="0" aria-valuemax="5" />
          <span class="training-slider-v" data-training-val="${htmlEsc(uid)}-${field}">${v}</span></label>`;
      };

      const focusOpts = FOCUS_SKILL_OPTIONS.map((opt) => {
        const lab =
          opt === ""
            ? localizedLiteral(lang, "- (none)", "无")
            : opt === "talking"
              ? localizedLiteral(lang, "talking", "谈话")
              : opt === "host"
                ? localizedLiteral(lang, "host", "主持")
                : opt === "variety"
                  ? localizedLiteral(lang, "variety", "综艺")
                  : opt === "acting"
                    ? localizedLiteral(lang, "acting", "演技")
                    : opt === "make-up"
                      ? localizedLiteral(lang, "make-up", "妆造")
                      : opt === "model"
                        ? localizedLiteral(lang, "model", "模特")
                        : opt;
        return `<option value="${htmlEsc(opt)}" ${focus === opt ? "selected" : ""}>${htmlEsc(lab)}</option>`;
      }).join("");

      const cond = typeof r.condition === "number" ? r.condition : Number(r.condition ?? 0) || 0;
      const mor = typeof r.morale === "number" ? r.morale : Number(r.morale ?? 70) || 70;

      const nameLine = romaji
        ? `<h3 class="content-h3 training-member-title"><span class="training-name-ja">${htmlEsc(name)}</span><span class="training-name-ro">${htmlEsc(romaji)}</span></h3>`
        : `<h3 class="content-h3 training-member-title"><span class="training-name-ja">${htmlEsc(name)}</span></h3>`;

      return `<article class="fm-card training-member-card" data-training-card="${htmlEsc(uid)}">
        <header class="training-member-head">
          <div class="training-member-nameblock">
            ${nameLine}
          </div>
          <div class="training-member-stats">
            <span title="${htmlEsc(localizedLiteral(lang, "Condition", "状态"))}">${htmlEsc(localizedLiteral(lang, "Cond", "状"))} ${htmlEsc(String(cond))}</span>
            <span title="${htmlEsc(localizedLiteral(lang, "Morale", "士气"))}">${htmlEsc(localizedLiteral(lang, "Mor", "气"))} ${htmlEsc(String(mor))}</span>
          </div>
        </header>
        <p class="content-muted training-bear-line" data-training-bear="${htmlEsc(uid)}">${htmlEsc(lang === "zh-CN" ? `训练负荷 ${load}/20 - 承受指数 ${bear}` : `Training load ${load}/20 - bear index ${bear}`)}${over > 0 ? htmlEsc(lang === "zh-CN" ? ` - 超负荷 +${over}` : ` - overwork +${over} vs bear`) : ""}</p>
        <div class="training-sliders">
          ${slider("sing", localizedLiteral(lang, "Sing", "唱功"))}
          ${slider("dance", localizedLiteral(lang, "Dance", "舞蹈"))}
          ${slider("physical", localizedLiteral(lang, "Physical", "体能"))}
          ${slider("target", localizedLiteral(lang, "Target / misc", "重点 / 其他"))}
          <label class="training-slider training-focus-slider-row">
            <span class="training-slider-l">${htmlEsc(localizedLiteral(lang, "Special focus", "特别重点"))}</span>
            <select class="fm-select training-focus-select" data-training-focus data-idol-uid="${htmlEsc(uid)}" aria-label="${htmlEsc(localizedLiteral(lang, "Special focus (weekly bonus track)", "特别重点（周额外加成）"))}">${focusOpts}</select>
            <span class="training-slider-v" aria-hidden="true"> </span>
          </label>
        </div>
      </article>`;
    })
    .filter(Boolean)
    .join("");

  const rosterRows = rosterSorted
    .map(({ uid, row: r, name, romaji, age, ability, started, condition, morale }) => {
      const initial = [...(name.trim() || "?")][0] ?? "?";
      const color = memberColorInTrainingGroup(r);
      const colorTrim = color.trim();
      const portraitSrc = idolPortraitPublicSrc(r, ref);
      const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
      const portraitCell = portraitSrc
        ? `<img class="idol-thumb" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
        : `<span class="idol-thumb-ph" aria-hidden="true">${htmlEsc(initial)}</span>`;
      const colorCss = resolveMemberColorCss(colorTrim, r.member_color_code);
      const colorLabelStyle = colorCss ? ` style="color:${colorCss}"` : "";
      const colorCell = colorCss
        ? `<span class="group-member-color-chip" style="background:${colorCss}" title="${htmlEsc(color)}"></span><span class="group-member-color-text"${colorLabelStyle}>${htmlEsc(color)}</span>`
        : `<span class="group-member-color-chip group-member-color-chip--default" title="${htmlEsc(color !== "-" ? color : "Default")}"></span> ${htmlEsc(color !== "-" ? color : "-")}`;
      const hiatusActive = isIdolOnHiatus(r, ref ?? null);
      const conditionTone = trainingValueToneClass(condition);
      const moraleTone = trainingValueToneClass(morale);
      const statusBadges = trainingStatusBadges(r);
      const actionButton = hiatusActive
        ? `<button type="button" class="fm-btn" disabled>${htmlEsc(localizedLiteral(lang, "Hiatus", "休假中"))}</button>`
        : `<button type="button" class="fm-btn fm-btn-danger" data-training-vacation="${htmlEsc(uid)}">${htmlEsc(localizedLiteral(lang, "Off", "休息"))}</button>`;
      const actionCell = hiatusActive
        ? actionButton
        : `<div class="training-vacation-controls"><input type="number" min="1" max="365" step="1" value="1" class="fm-input training-vacation-days" data-training-vacation-days="${htmlEsc(uid)}" aria-label="${htmlEsc(localizedLiteral(lang, "Off days", "休息天数"))}" />${actionButton}</div>`;
      const nameCell = `<span class="group-roster-name-wrap"><button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(name)}</button></span>`;
      return `<tr>
        <td class="idol-list-photo">${portraitCell}</td>
        <td>${nameCell}</td>
        <td>${romaji ? htmlEsc(romaji) : htmlEsc(localizedLiteral(lang, "-", "-"))}</td>
        <td>${colorCell}</td>
        <td class="group-roster-stat">${htmlEsc(age)}</td>
        <td class="group-roster-stat">${htmlEsc(String(ability))}</td>
        <td class="group-roster-stat"><span class="training-value ${conditionTone}">${htmlEsc(String(condition))}</span></td>
        <td class="group-roster-stat"><span class="training-value ${moraleTone}">${htmlEsc(String(morale))}</span></td>
        <td class="group-roster-stat">${htmlEsc(started || "-")}</td>
        <td>${statusBadges}</td>
        <td>${actionCell}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");

  const hiatusRows = memberUids
    .map((uid) => {
      const row = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uid);
      if (!row || typeof row !== "object") return "";
      const r = row as Record<string, unknown>;
      if (!isIdolOnHiatus(r, ref ?? null)) return "";
      const name = typeof r.name === "string" ? r.name : uid.slice(0, 8);
      const romaji = romajiFromRow(r);
      const returnDate = hiatusReturnDate(r, ref ?? null) ?? "-";
      const days = hiatusDaysRemaining(r, ref ?? null);
      return `<tr>
        <td><button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(name)}</button></td>
        <td>${romaji ? htmlEsc(romaji) : "-"}</td>
        <td>${htmlEsc(returnDate)}</td>
        <td class="group-roster-stat">${htmlEsc(lang === "zh-CN" ? `${days} 天` : `${days} day${days === 1 ? "" : "s"}`)}</td>
      </tr>`;
    })
    .filter(Boolean)
    .join("");

  const managedSongs = songsForDisplaySorted(save.database_snapshot.songs)
    .filter((row) => String(row.group_uid ?? "") === groupUidStr)
    .filter((row) => !isSongHiddenFromDisplay(row, save.database_snapshot.songs))
    .filter((row) => isSongAvailableOn(row, ref ?? null));
  const selectedSongUids = new Set(save.training_song_uids.map((uid) => String(uid)));
  const songRows = managedSongs
    .map((song) => {
      const uid = String(song.uid ?? "").trim();
      const title = songCatalogDisplayLabel(song);
      const availableOn = String((song.uid === "d3b51910-0f40-4e75-9413-4f3762fbf110" ? "2026-01-01" : song.release_date) ?? "")
        .split("T")[0];
      const status = save.managed_song_status[uid];
      const familiarity = Math.round(Number(status?.familiarity ?? 0) || 0);
      const fatigue = Math.round(Number(status?.rotation_fatigue ?? 0) || 0);
      return `<tr>
        <td><label class="check-pill"><input type="checkbox" data-training-song-pick="${htmlEsc(uid)}" ${selectedSongUids.has(uid) ? "checked" : ""} /> <span>${htmlEsc(localizedLiteral(lang, "Prepare", "练习"))}</span></label></td>
        <td>${htmlEsc(title)}</td>
        <td>${htmlEsc(availableOn || "-")}</td>
        <td class="num">${htmlEsc(songPopularityNum(song).toFixed(1))}</td>
        <td class="num">${htmlEsc(String(familiarity))}</td>
        <td class="num">${htmlEsc(String(fatigue))}</td>
      </tr>`;
    })
    .join("");

  const roleColumns = Object.entries(MEMBER_ROLE_DEFINITIONS).map(([key, definition]) => ({
    key,
    label: definition.label,
  }));
  const roleEntryForManagedGroup = (row: Record<string, unknown>): Record<string, unknown> | null => {
    const hist = Array.isArray(row.group_history) ? row.group_history : [];
    return (
      hist
        .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
        .find((e) => {
          const uidValue = String(e.group_uid ?? "").trim();
          const groupName = String(e.group_name ?? "").trim();
          return uidValue === groupUidStr || (groupName && groupNames.has(groupName));
        }) ?? null
    );
  };
  const roleRoster = memberUids
    .map((uid) => {
      const row = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uid);
      if (!row || typeof row !== "object") return null;
      const r = row as Record<string, unknown>;
      const entry = roleEntryForManagedGroup(r);
      const roles = roleAssignmentsFromHistoryEntry(entry ?? {});
      const roleMap = new Map(roles.map((role) => [role.key, Math.max(0, Math.min(1, Number(role.focus) || 0))] as const));
      return { uid, row: r, entry, roleMap, attrs: normalizePersistedAttributes(r.attributes) };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  const avg = (values: number[]) => {
    const clean = values.filter((v) => Number.isFinite(v));
    return clean.length ? clean.reduce((sum, value) => sum + value, 0) / clean.length : 0;
  };
  const topAvg = (values: number[], count: number) =>
    avg(values.filter((v) => Number.isFinite(v)).sort((a, b) => b - a).slice(0, Math.max(1, count)));
  const attrScore = (pick: (attrs: PersistedIdolAttributes) => number[]) =>
    Math.max(0, Math.min(5, (topAvg(roleRoster.map((member) => avg(pick(member.attrs))), 5) / 20) * 5));
  const roleScore = (keys: string[]) =>
    Math.max(
      0,
      Math.min(
        5,
        topAvg(
          roleRoster.map((member) =>
            Math.max(...keys.map((key) => Number(member.roleMap.get(key) ?? 0)), 0),
          ),
          3,
        ) * 5,
      ),
    );
  const blendStrength = (base: number, roles: number, roleWeight = 0.3) =>
    Math.max(0, Math.min(5, base * (1 - roleWeight) + roles * roleWeight));
  const benchmarkItems = [
    {
      key: "singing" as const,
      label: localizedLiteral(lang, "Singing", "唱功"),
      value: blendStrength(
        attrScore((a) => [a.technical.pitch, a.technical.tone, a.technical.breath, a.technical.power]),
        roleScore(["lead_singer", "center"]),
      ),
    },
    {
      key: "dancing" as const,
      label: localizedLiteral(lang, "Dancing", "舞蹈"),
      value: blendStrength(
        attrScore((a) => [a.technical.rhythm, a.technical.grace, a.physical.agility, a.physical.stamina]),
        roleScore(["lead_dancer", "center"]),
      ),
    },
    {
      key: "teamwork" as const,
      label: localizedLiteral(lang, "Teamwork", "团队协作"),
      value: blendStrength(
        attrScore((a) => [a.mental.teamwork, a.mental.determination, a.hidden?.professionalism ?? 12]),
        roleScore(["leader", "host", "call_leader"]),
        0.25,
      ),
    },
    {
      key: "content" as const,
      label: localizedLiteral(lang, "Content", "内容"),
      value: blendStrength(
        attrScore((a) => [a.mental.talking, a.mental.humor, a.mental.clever]),
        roleScore(["content"]),
      ),
    },
    {
      key: "streaming" as const,
      label: localizedLiteral(lang, "Streaming", "直播"),
      value: blendStrength(
        attrScore((a) => [a.mental.talking, a.mental.humor, a.mental.teamwork]),
        roleScore(["streaming", "host"]),
      ),
    },
    {
      key: "fashion" as const,
      label: localizedLiteral(lang, "Fashion", "时尚"),
      value: blendStrength(
        attrScore((a) => [a.mental.fashion, a.appearance.cute, a.appearance.pretty]),
        roleScore(["style", "content"]),
      ),
    },
  ];
  const preferredBenchmarks = new Set(effectiveRoleBenchmarkPreferences);
  const benchmarkCards = benchmarkItems
    .map((item) => {
      const value = Math.max(0, Math.min(5, item.value));
      const display = value.toFixed(1);
      const pct = Math.round((value / 5) * 100);
      const selected = preferredBenchmarks.has(item.key);
      const checked = selected ? "checked" : "";
      const selectedClass = selected ? " is-selected" : "";
      return `<label class="training-role-benchmark-card${selectedClass}">
        <span class="training-role-benchmark-pref"><input type="checkbox" data-role-benchmark-preference="${htmlEsc(item.key)}" ${checked} /> <span class="training-role-benchmark-check" aria-hidden="true"></span><span>${htmlEsc(localizedLiteral(lang, "Prefer", "偏重"))}</span></span>
        <span class="training-role-benchmark-label">${htmlEsc(item.label)}</span>
        <strong class="training-role-benchmark-score">${htmlEsc(display)}</strong>
        <span class="training-role-benchmark-meter" aria-hidden="true"><span style="width:${pct}%"></span></span>
      </label>`;
    })
    .join("");
  const roleScaleOptions = (value: number) =>
    Array.from({ length: 6 }, (_, n) => `<option value="${n}" ${n === value ? "selected" : ""}>${n}</option>`).join("");
  const roleRows = memberUids
    .map((uid) => {
      const roleMember = roleRoster.find((member) => member.uid === uid);
      if (!roleMember) return "";
      const r = roleMember.row;
      const name = typeof r.name === "string" ? r.name : uid.slice(0, 8);
      const romaji = romajiFromRow(r);
      const entry = roleMember.entry;
      const rolesByKey = roleMember.roleMap;
      const leaderChecked = entry?.announced_leader === true ? "checked" : "";
      const roleCells = roleColumns
        .map(({ key }) => {
          const focus = Math.max(0, Math.min(1, Number(rolesByKey.get(key) ?? 0) || 0));
          const scale = Math.round(focus * 5);
          return `<td><select class="fm-select training-role-select" data-training-role="${htmlEsc(uid)}" data-role-key="${htmlEsc(key)}" aria-label="${htmlEsc(`${name} ${key}`)}">${roleScaleOptions(scale)}</select></td>`;
        })
        .join("");
      return `<tr>
        <td><button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(name)}</button></td>
        <td>${romaji ? htmlEsc(romaji) : "-"}</td>
        <td><label class="check-pill"><input type="checkbox" data-training-announced-leader="${htmlEsc(uid)}" ${leaderChecked} /> <span>${htmlEsc(localizedLiteral(lang, "Official", "官方"))}</span></label></td>
        ${roleCells}
      </tr>`;
    })
    .filter(Boolean)
    .join("");
  const roleHeaderCells = roleColumns.map(({ label }) => `<th>${htmlEsc(label)}</th>`).join("");

  return `<section class="content-panel training-view">
    <h2 class="content-h2">${htmlEsc(navLabel(lang, "Training"))}</h2>
    ${renderTrainingTabs(trainingTab, lang)}
    ${
      trainingTab === "roster"
        ? `<section class="fm-card">
            <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Managed roster", "当前阵容"))}</h3>
            <div class="table-scroll">
              <table class="fm-table group-detail-roster-table training-roster-table">
                <thead><tr><th></th><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${sortHeader("romaji", localizedLiteral(lang, "Romaji", "罗马音"))}</th><th>${htmlEsc(localizedLiteral(lang, "Color", "代表色"))}</th><th>${sortHeader("age", localizedLiteral(lang, "Age", "年龄"))}</th><th>${sortHeader("ability", localizedLiteral(lang, "Ability", "能力"))}</th><th>${sortHeader("condition", localizedLiteral(lang, "Condition", "状态"))}</th><th>${sortHeader("morale", localizedLiteral(lang, "Morale", "士气"))}</th><th>${sortHeader("started", localizedLiteral(lang, "Started", "加入日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Status", "状态标记"))}</th><th>${htmlEsc(localizedLiteral(lang, "Action", "操作"))}</th></tr></thead>
                <tbody>${rosterRows || `<tr><td colspan="11" class="content-muted">${htmlEsc(localizedLiteral(lang, "No roster members.", "当前没有成员。"))}</td></tr>`}</tbody>
              </table>
            </div>
            <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Hiatus", "休假中"))}</h3>
            <div class="table-scroll">
              <table class="fm-table training-hiatus-table">
                <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romaji", "罗马音"))}</th><th>${htmlEsc(localizedLiteral(lang, "Return date", "回归日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Days", "天数"))}</th></tr></thead>
                <tbody>${hiatusRows || `<tr><td colspan="4" class="content-muted">${htmlEsc(localizedLiteral(lang, "No hiatus scheduled.", "暂无休假安排。"))}</td></tr>`}</tbody>
              </table>
            </div>
          </section>`
        : trainingTab === "songs"
          ? `<section class="fm-card">
              <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Song preparation", "歌曲准备"))}</h3>
              <p class="content-muted">${htmlEsc(localizedLiteral(lang, "Choose the songs the group is actively preparing in training. Each training session splits a fixed familiarity budget evenly across the selected songs, while rotation fatigue reflects recent overuse on stage.", "选择组合正在训练中重点准备的歌曲。每次训练会把固定熟练度预算均分给已选歌曲，轮换疲劳则反映近期舞台过度使用。"))}</p>
              <div class="table-scroll">
                <table class="fm-table">
                  <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Prepare", "练习"))}</th><th>${htmlEsc(localizedLiteral(lang, "Song", "歌曲"))}</th><th>${htmlEsc(localizedLiteral(lang, "Available on", "可用日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Popularity", "人气"))}</th><th>${htmlEsc(localizedLiteral(lang, "Familiarity", "熟练度"))}</th><th>${htmlEsc(localizedLiteral(lang, "Rotation fatigue", "轮换疲劳"))}</th></tr></thead>
                  <tbody>${songRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(localizedLiteral(lang, "No managed songs found.", "未找到当前经营组合的歌曲。"))}</td></tr>`}</tbody>
                </table>
              </div>
            </section>`
          : trainingTab === "roles"
            ? `<section class="fm-card">
                <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Member roles", "成员定位"))}</h3>
                <p class="content-muted">${htmlEsc(localizedLiteral(lang, "Assign each member's role focus on a 0-5 scale. These roles are saved into the current group membership and regenerate role-based attributes for that member.", "以 0-5 为每位成员设置定位权重。定位会保存到当前组合履历，并重新生成该成员基于定位的能力值。"))}</p>
                <section class="training-role-benchmark" aria-label="${htmlEsc(localizedLiteral(lang, "Team strength benchmark", "团队强度基准"))}">
                  <div class="training-role-benchmark-head">
                    <h4>${htmlEsc(localizedLiteral(lang, "Team strength benchmark", "团队强度基准"))}</h4>
                    <span>${htmlEsc(localizedLiteral(lang, "0-5 after current role assignment. All preferences are selected by default.", "当前定位后的 0-5 评分。默认选择全部偏重。"))}</span>
                  </div>
                  <div class="training-role-benchmark-grid">${benchmarkCards}</div>
                  <div class="training-role-benchmark-actions">
                    <button type="button" class="fm-btn fm-btn-accent" data-training-roles-autoassign="1">${htmlEsc(localizedLiteral(lang, "Auto-assign roles", "自动分配定位"))}</button>
                  </div>
                </section>
                <div class="table-scroll">
                  <table class="fm-table training-role-table">
                    <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romaji", "罗马音"))}</th><th>${htmlEsc(localizedLiteral(lang, "Announced leader", "公开队长"))}</th>${roleHeaderCells}</tr></thead>
                    <tbody>${roleRows || `<tr><td colspan="${3 + roleColumns.length}" class="content-muted">${htmlEsc(localizedLiteral(lang, "No roster members.", "当前没有成员。"))}</td></tr>`}</tbody>
                  </table>
                </div>
              </section>`
          : `<div class="training-grid">${cards || `<p class="content-muted">${htmlEsc(localizedLiteral(lang, "No roster members.", "当前没有成员。"))}</p>`}</div>`
    }
  </section>`;
}

function feedbackTypeLabel(lang: UiLanguage, type: FeedbackEntry["type"]): string {
  switch (type) {
    case "bug":
      return t(lang, "feedback_type_bug");
    case "question":
      return t(lang, "feedback_type_question");
    case "suggestion":
      return t(lang, "feedback_type_suggestion");
    default:
      return type;
  }
}

function renderSidebarUtilityPanel(lang: UiLanguage): string {
  return `<section class="fm-feedback" aria-labelledby="feedback-actions-heading">
    <h2 id="feedback-actions-heading" class="fm-wiki-label">${htmlEsc(lang === "zh-CN" ? "工具" : "Tools")}</h2>
    <div class="fm-feedback-card fm-feedback-card--compact">
      <div class="feedback-actions feedback-actions--stack">
        <button type="button" class="fm-btn" data-open-wiki-modal="1">${htmlEsc(lang === "zh-CN" ? "打开完整百科" : "Open Full Wiki")}</button>
        <button type="button" class="fm-btn fm-btn-accent" data-open-feedback-modal="1">${htmlEsc(lang === "zh-CN" ? "反馈问题" : "Report Bug")}</button>
      </div>
    </div>
  </section>`;
}

function renderFeedbackModal(
  lang: UiLanguage,
  currentView: DesktopNavId,
  simDate: string,
  entries: FeedbackEntry[],
  statusMessage: string | null,
): string {
  const recent = entries
    .slice(-3)
    .reverse()
    .map((entry) => {
      const title = entry.title.trim() || localizedLiteral(lang, "(No title)", "（无标题）");
      const meta = `${entry.createdAt.split("T")[0]} · ${feedbackTypeLabel(lang, entry.type)} · ${navLabel(lang, entry.view as DesktopNavId)}`;
      const preview = entry.details.trim();
      return `<article class="feedback-entry">
        <strong class="feedback-entry__title">${htmlEsc(title)}</strong>
        <span class="feedback-entry__meta">${htmlEsc(meta)}</span>
        ${preview ? `<p class="feedback-entry__body">${htmlEsc(preview)}</p>` : ""}
      </article>`;
    })
    .join("");

  return `<div class="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="feedback-heading">
    <div class="tutorial-overlay__backdrop" data-feedback-modal-close="1"></div>
    <section class="tutorial-overlay__panel wiki-modal__panel">
    <div class="fm-feedback-card">
      <div class="tutorial-overlay__header">
        <div>
          <p class="tutorial-overlay__eyebrow">${htmlEsc(t(lang, "feedback_heading"))}</p>
          <h2 id="feedback-heading" class="tutorial-overlay__title">${htmlEsc(t(lang, "feedback_heading"))}</h2>
        </div>
        <button type="button" class="tutorial-overlay__close" aria-label="${htmlEsc(lang === "zh-CN" ? "关闭反馈" : "Close feedback")}" data-feedback-modal-close="1">x</button>
      </div>
      <p class="feedback-panel__intro">${htmlEsc(t(lang, "feedback_intro"))}</p>
      <p class="feedback-panel__context">${htmlEsc(t(lang, "feedback_context", { view: navLabel(lang, currentView), date: simDate || "-" }))}</p>
      <label class="feedback-field">
        <span class="feedback-field__label">${htmlEsc(t(lang, "feedback_type"))}</span>
        <select id="feedback-type" class="fm-select">
          <option value="bug">${htmlEsc(t(lang, "feedback_type_bug"))}</option>
          <option value="question">${htmlEsc(t(lang, "feedback_type_question"))}</option>
          <option value="suggestion">${htmlEsc(t(lang, "feedback_type_suggestion"))}</option>
        </select>
      </label>
      <label class="feedback-field">
        <span class="feedback-field__label">${htmlEsc(t(lang, "feedback_title"))}</span>
        <input id="feedback-title" class="fm-input" type="text" placeholder="${htmlEsc(t(lang, "feedback_title_placeholder"))}" />
      </label>
      <label class="feedback-field">
        <span class="feedback-field__label">${htmlEsc(t(lang, "feedback_details"))}</span>
        <textarea id="feedback-details" class="fm-textarea feedback-textarea" rows="4" placeholder="${htmlEsc(t(lang, "feedback_details_placeholder"))}"></textarea>
      </label>
      <div class="feedback-actions">
        <button type="button" class="fm-btn fm-btn-accent" id="btn-feedback-save">${htmlEsc(t(lang, "feedback_save"))}</button>
        <button type="button" class="fm-btn" id="btn-feedback-export">${htmlEsc(t(lang, "feedback_export"))}</button>
      </div>
      <p class="feedback-panel__status">${htmlEsc(statusMessage || t(lang, "feedback_saved_local"))}</p>
      <div class="feedback-panel__recent">
        <h3 class="wiki-panel__topics-label">${htmlEsc(t(lang, "feedback_recent"))}</h3>
        <div class="feedback-entry-list">${recent || `<p class="wiki-panel__empty">${htmlEsc(t(lang, "feedback_empty"))}</p>`}</div>
      </div>
    </div>
    </section>
  </div>`;
}

function firstOfMonthIso(isoDate: string): string {
  const s = String(isoDate ?? "").split("T")[0].trim();
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(s);
  if (!m) return "2000-01-01";
  return `${m[1]}-${m[2]}-01`;
}

function addCalendarMonths(firstOfMonthIsoDate: string, deltaMonths: number): string {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(firstOfMonthIsoDate ?? "").trim());
  if (!m) return "2000-01-01";
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1 + deltaMonths, 1));
  return dt.toISOString().slice(0, 10);
}

function formatMonthTick(isoDate: string): string {
  const s = String(isoDate ?? "").split("T")[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dt = new Date(`${s}T12:00:00Z`);
  return dt.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function financeMoneyShort(value: number): string {
  const rounded = Math.round(value);
  const abs = Math.abs(rounded);
  if (abs >= 1_000_000_000) return `&yen;${(rounded / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `&yen;${(rounded / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `&yen;${(rounded / 1_000).toFixed(0)}K`;
  return `&yen;${rounded.toLocaleString("ja-JP")}`;
}

interface FinanceMonthPoint {
  monthIso: string;
  income: number;
  expense: number;
  net: number;
  closingBalance: number;
  projected: boolean;
}

function buildFinanceProjectionPoints(save: GameSavePayload): FinanceMonthPoint[] {
  const finances = getActiveFinances(save);
  const primaryGroup = getPrimaryGroup(save);
  const letterTier = resolveGroupLetterTier(primaryGroup);
  const memberCount = Array.isArray(primaryGroup?.member_uids) ? primaryGroup!.member_uids.length : 0;
  const idolSalaryExpense = memberCount * monthlyBaseSalaryYenForGroupLetterTier(letterTier);
  const staffSalaryExpense = monthlyStaffSalaryYen();
  const adminTrainingExpense = monthlyAdminTrainingCostYenForGroupLetterTier(letterTier);
  const conservativeMonthlyExpense = idolSalaryExpense + staffSalaryExpense + adminTrainingExpense;
  const ledger = [...finances.ledger]
    .filter((row) => typeof row?.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.date))
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const currentMonthIso = firstOfMonthIso(
    save.current_date ?? finances.last_processed_date ?? save.game_start_date ?? "2000-01-01",
  );

  if (!ledger.length) {
    return Array.from({ length: 24 }, (_, index) => ({
      monthIso: addCalendarMonths(currentMonthIso, index),
      income: 0,
      expense: conservativeMonthlyExpense,
      net: -conservativeMonthlyExpense,
      closingBalance: finances.cash_yen - conservativeMonthlyExpense * index,
      projected: index > 0,
    }));
  }

  const monthly = new Map<string, FinanceMonthPoint>();
  const totalNet = ledger.reduce((sum, row) => sum + num(row.net_total), 0);
  let runningBalance = finances.cash_yen - totalNet;
  for (const row of ledger) {
    runningBalance += num(row.net_total);
    const monthIso = firstOfMonthIso(row.date);
    const current = monthly.get(monthIso) ?? {
      monthIso,
      income: 0,
      expense: 0,
      net: 0,
      closingBalance: runningBalance,
      projected: false,
    };
    current.income += num(row.income_total);
    current.expense += num(row.expense_total);
    current.net += num(row.net_total);
    current.closingBalance = runningBalance;
    monthly.set(monthIso, current);
  }

  const actualMonths = [...monthly.values()].sort((a, b) => a.monthIso.localeCompare(b.monthIso));
  const currentIndex = actualMonths.findIndex((row) => row.monthIso === currentMonthIso);
  const points = (currentIndex >= 0 ? actualMonths.slice(currentIndex) : [actualMonths[actualMonths.length - 1]])
    .slice(0, 24)
    .map((row) => ({ ...row, projected: false }));

  let balance = points.length
    ? points[points.length - 1].closingBalance
    : actualMonths[actualMonths.length - 1]?.closingBalance ?? finances.cash_yen;
  let anchorMonth = points.length
    ? points[points.length - 1].monthIso
    : actualMonths[actualMonths.length - 1]?.monthIso ?? currentMonthIso;

  while (points.length < 24) {
    const income = 0;
    const expense = conservativeMonthlyExpense;
    const net = -expense;
    anchorMonth = addCalendarMonths(anchorMonth, 1);
    balance += net;
    points.push({
      monthIso: anchorMonth,
      income,
      expense,
      net,
      closingBalance: balance,
      projected: true,
    });
  }

  return points.sort((a, b) => a.monthIso.localeCompare(b.monthIso)).slice(0, 24);
}

function renderFinanceProjectionSvg(points: FinanceMonthPoint[]): string {
  const width = 1080;
  const height = 280;
  const padTop = 22;
  const padRight = 18;
  const padBottom = 42;
  const padLeft = 72;
  const innerW = width - padLeft - padRight;
  const innerH = height - padTop - padBottom;
  const values = points.map((row) => row.closingBalance);
  const minVal = Math.min(...values, 0);
  const maxVal = Math.max(...values, 0);
  const span = Math.max(1, maxVal - minVal);
  const paddedMin = minVal - span * 0.08;
  const paddedMax = maxVal + span * 0.08;
  const xFor = (index: number) => (points.length <= 1 ? padLeft : padLeft + (index / (points.length - 1)) * innerW);
  const yFor = (value: number) => {
    const ratio = (value - paddedMin) / Math.max(1, paddedMax - paddedMin);
    return padTop + innerH - ratio * innerH;
  };

  const linePoints = points.map((row, index) => `${xFor(index).toFixed(2)},${yFor(row.closingBalance).toFixed(2)}`);
  const areaPoints = [
    `${padLeft},${padTop + innerH}`,
    ...linePoints,
    `${xFor(points.length - 1).toFixed(2)},${padTop + innerH}`,
  ].join(" ");
  const firstProjectedIndex = points.findIndex((row) => row.projected);

  const yTicks = Array.from({ length: 5 }, (_, index) => paddedMin + ((paddedMax - paddedMin) * index) / 4)
    .map((value) => {
      const y = yFor(value);
      return `<g><line x1="${padLeft}" y1="${y.toFixed(2)}" x2="${width - padRight}" y2="${y.toFixed(2)}" class="finance-projection-grid" /><text x="${padLeft - 10}" y="${(y + 4).toFixed(2)}" class="finance-projection-y">${htmlEsc(financeMoneyShort(value))}</text></g>`;
    })
    .join("");

  const xTicks = points
    .map((row, index) => ({ row, index }))
    .filter(({ index }) => index === 0 || index === points.length - 1 || index % 3 === 0)
    .map(({ row, index }) => {
      const x = xFor(index);
      return `<g><line x1="${x.toFixed(2)}" y1="${padTop}" x2="${x.toFixed(2)}" y2="${padTop + innerH}" class="finance-projection-grid finance-projection-grid-x" /><text x="${x.toFixed(2)}" y="${height - 14}" text-anchor="middle" class="finance-projection-x">${htmlEsc(formatMonthTick(row.monthIso))}</text></g>`;
    })
    .join("");

  const futureBand =
    firstProjectedIndex > 0
      ? `<rect x="${xFor(firstProjectedIndex).toFixed(2)}" y="${padTop}" width="${(width - padRight - xFor(firstProjectedIndex)).toFixed(2)}" height="${innerH}" class="finance-projection-future-band" />`
      : "";
  const divider =
    firstProjectedIndex > 0
      ? `<line x1="${xFor(firstProjectedIndex).toFixed(2)}" y1="${padTop}" x2="${xFor(firstProjectedIndex).toFixed(2)}" y2="${padTop + innerH}" class="finance-projection-divider" />`
      : "";
  const markers = points
    .map((row, index) => {
      const x = xFor(index);
      const y = yFor(row.closingBalance);
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${row.projected ? 2.7 : 3.2}" class="finance-projection-dot ${row.projected ? "is-projected" : "is-actual"}" />`;
    })
    .join("");

  return `<svg class="finance-projection-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="24 month balance projection">
    <defs>
      <linearGradient id="financeProjectionFill" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="rgb(255 100 164 / 0.88)" />
        <stop offset="100%" stop-color="rgb(255 100 164 / 0.18)" />
      </linearGradient>
    </defs>
    ${futureBand}
    ${yTicks}
    ${xTicks}
    ${divider}
    <polygon points="${areaPoints}" class="finance-projection-area" fill="url(#financeProjectionFill)" />
    <polyline points="${linePoints.join(" ")}" class="finance-projection-line" />
    ${markers}
  </svg>`;
}

function renderFinances(save: GameSavePayload): string {
  const f = getActiveFinances(save);
  const ledger = [...f.ledger].slice(-20).reverse();
  const head = `
    <div class="stat-row" role="group" aria-label="Cash">
      <div class="stat-block"><span class="stat-label">Cash (JPY)</span><span class="stat-value">JPY ${f.cash_yen.toLocaleString("ja-JP")}</span></div>
      <div class="stat-block"><span class="stat-label">Last close</span><span class="stat-value stat-value-sm">${htmlEsc(f.last_processed_date ?? "—")}</span></div>
    </div>`;
  const tableRows = ledger
    .map(
      (row) =>
        `<tr><td>${htmlEsc(row.date)}</td><td class="num">${row.net_total.toLocaleString("ja-JP")}</td><td>${htmlEsc(row.tier)}</td><td class="num muted">${row.income_total.toLocaleString("ja-JP")}</td><td class="num muted">${row.expense_total.toLocaleString("ja-JP")}</td><td class="num muted">${num(row.scout_retainers).toLocaleString("ja-JP")}</td></tr>`,
    )
    .join("");
  return `
    <section class="content-panel finances-view">
      <h2 class="content-h2">Finances</h2>
      ${head}
      <div class="table-panel">
        <h3 class="content-h3">Daily ledger (recent)</h3>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Date</th><th>Net JPY</th><th>Tier</th><th>Income</th><th>Expense</th><th>Scout sub</th></tr></thead>
            <tbody>${tableRows || `<tr><td colspan="6" class="content-muted">No ledger rows yet.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

/** All idols · portrait · age / romaji / X / groups on reference date · open detail on click. */
function renderFinancesProjectionView(
  save: GameSavePayload,
  financeHistoryRange: FinanceHistoryRange,
  financeTab: FinanceTab,
  lang: UiLanguage,
): string {
  const f = getActiveFinances(save);
  const grp = getPrimaryGroup(save);
  const groupUidStr = String(grp?.uid ?? "").trim();
  const groupNames = new Set(
    [String(grp?.name ?? "").trim(), String(grp?.name_romanji ?? "").trim()].filter(Boolean),
  );
  const ledger = [...f.ledger].slice(-20).reverse();
  const projectionPoints = buildFinanceProjectionPoints(save);
  const projectedLast = projectionPoints[projectionPoints.length - 1] ?? null;
  const actualWindow = projectionPoints.filter((row) => !row.projected).slice(-6);
  const projectedWindow = projectionPoints.filter((row) => row.projected);
  const avgMonthlyNet =
    actualWindow.reduce((sum, row) => sum + row.net, 0) / Math.max(1, actualWindow.length);
  const projectedIncome =
    projectedWindow.reduce((sum, row) => sum + row.income, 0) / Math.max(1, projectedWindow.length);
  const projectedExpense =
    projectedWindow.reduce((sum, row) => sum + row.expense, 0) / Math.max(1, projectedWindow.length);
  const head = `
    <div class="stat-row" role="group" aria-label="Cash">
      <div class="stat-block"><span class="stat-label">${htmlEsc(localizedLiteral(lang, "Cash (JPY)", "现金（日元）"))}</span><span class="stat-value">&yen;${f.cash_yen.toLocaleString("ja-JP")}</span></div>
      <div class="stat-block"><span class="stat-label">${htmlEsc(localizedLiteral(lang, "Last close", "最近结算日"))}</span><span class="stat-value stat-value-sm">${htmlEsc(f.last_processed_date ?? "-")}</span></div>
    </div>`;
  const tableRows = ledger
    .map(
      (row) =>
        `<tr><td>${htmlEsc(row.date)}</td><td class="num">${row.net_total.toLocaleString("ja-JP")}</td><td>${htmlEsc(row.tier)}</td><td class="num muted">${row.income_total.toLocaleString("ja-JP")}</td><td class="num muted">${row.expense_total.toLocaleString("ja-JP")}</td><td class="num muted">${num(row.scout_retainers).toLocaleString("ja-JP")}</td></tr>`,
    )
    .join("");
  const historySource = [...f.ledger].reverse();
  const historyLimit = {
    day: 1,
    week: 7,
    month: 30,
    year: 365,
    all: Number.POSITIVE_INFINITY,
  }[financeHistoryRange];
  const historyRows = historySource.filter((_, index) => index < historyLimit);
  const historyTotals = historyRows.reduce(
    (acc, row) => {
      acc.income += num(row.income_total);
      acc.expense += num(row.expense_total);
      return acc;
    },
    { income: 0, expense: 0 },
  );
  const historyTableRows = historyRows
    .map(
      (row) =>
        `<tr><td>${htmlEsc(row.date)}</td><td>${htmlEsc(row.tier)}</td><td class="num">${num(row.income_total).toLocaleString("ja-JP")}</td><td class="num">${num(row.expense_total).toLocaleString("ja-JP")}</td><td class="num">${num(row.scout_retainers).toLocaleString("ja-JP")}</td><td class="num ${num(row.net_total) >= 0 ? "is-positive" : "is-negative"}">${num(row.net_total).toLocaleString("ja-JP")}</td></tr>`,
    )
    .join("");
  const historyRangeButtons: Array<[FinanceHistoryRange, string]> = [
    ["day", localizedLiteral(lang, "Day", "日")],
    ["week", localizedLiteral(lang, "Week", "周")],
    ["month", localizedLiteral(lang, "Month", "月")],
    ["year", localizedLiteral(lang, "Year", "年")],
    ["all", localizedLiteral(lang, "All", "全部")],
  ];
  const financeTabs: Array<[FinanceTab, string]> = [
    ["finance", localizedLiteral(lang, "Finance", "财务")],
    ["contract", localizedLiteral(lang, "Contract", "合同")],
  ];
  const memberUids = Array.isArray(grp?.member_uids) ? grp!.member_uids.map((x) => String(x)) : [];
  const contractRows = memberUids
    .map((uid) => {
      const row = save.database_snapshot.idols.find((idol) => String(idol.uid ?? "") === uid);
      if (!row || typeof row !== "object") return "";
      const idol = row as Record<string, unknown>;
      const name = String(idol.name ?? uid);
      const romaji = romajiFromRow(idol);
      const portraitSrc = idolPortraitPublicSrc(idol, save.current_date);
      const initial = [...(name.trim() || "?")][0] ?? "?";
      const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
      const portraitCell = portraitSrc
        ? `<img class="idol-thumb" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
        : `<span class="idol-thumb-ph" aria-hidden="true">${htmlEsc(initial)}</span>`;
      const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
      let started = "-";
      for (const raw of hist) {
        if (!raw || typeof raw !== "object") continue;
        const entry = raw as Record<string, unknown>;
        const guid = String(entry.group_uid ?? "").trim();
        const gname = String(entry.group_name ?? "").trim();
        if (guid === groupUidStr || (gname && groupNames.has(gname))) {
          const start = String(entry.start_date ?? "").split("T")[0];
          if (/^\d{4}-\d{2}-\d{2}$/.test(start)) started = start;
          break;
        }
      }
      const salary = Number(idol.contract_salary_yen ?? 0) || 0;
      const endDate = String(idol.contract_end_date ?? "-").split("T")[0] || "-";
      return `<tr>
        <td class="idol-list-photo contract-col-photo">${portraitCell}</td>
        <td class="contract-col-name"><span class="group-roster-name-wrap"><button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(name)}</button></span></td>
        <td class="contract-col-romaji">${romaji ? htmlEsc(romaji) : "-"}</td>
        <td class="group-roster-stat contract-col-salary">&yen;${salary.toLocaleString("ja-JP")}</td>
        <td class="group-roster-stat contract-col-started">${htmlEsc(started)}</td>
        <td class="group-roster-stat contract-col-end">${htmlEsc(endDate)}</td>
        <td class="contract-col-action"><div class="contract-actions"><button type="button" class="fm-btn" data-contract-renew="${htmlEsc(uid)}">${htmlEsc(localizedLiteral(lang, "Renew", "续约"))}</button><button type="button" class="fm-btn fm-btn-danger" data-contract-terminate="${htmlEsc(uid)}">${htmlEsc(localizedLiteral(lang, "Terminate", "解约"))}</button></div></td>
      </tr>`;
    })
    .join("");
  return `
    <section class="content-panel finances-view">
      <h2 class="content-h2">${htmlEsc(navLabel(lang, "Finances"))}</h2>
      <div class="workspace-tabs finance-tabs">${financeTabs
        .map(
          ([value, label]) =>
            `<button type="button" class="workspace-tab ${financeTab === value ? "is-active" : ""}" data-finance-tab="${value}">${htmlEsc(label)}</button>`,
        )
        .join("")}</div>
      ${
        financeTab === "contract"
          ? `
      <div class="table-panel">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Managed contracts", "当前合同"))}</h3>
        <p class="content-muted">${htmlEsc(localizedLiteral(lang, "Renewal and termination requests open as blocking inbox events for review and confirmation.", "续约与解约申请会作为需确认的收件箱事件打开，供审核与确认。"))}</p>
        <div class="table-scroll">
          <table class="fm-table group-detail-roster-table training-roster-table contract-roster-table">
            <colgroup>
              <col class="contract-col-photo" />
              <col class="contract-col-name" />
              <col class="contract-col-romaji" />
              <col class="contract-col-salary" />
              <col class="contract-col-started" />
              <col class="contract-col-end" />
              <col class="contract-col-action" />
            </colgroup>
            <thead><tr><th></th><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romaji", "罗马音"))}</th><th>${htmlEsc(localizedLiteral(lang, "Salary", "薪资"))}</th><th>${htmlEsc(localizedLiteral(lang, "Started", "加入日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Contract end", "合约到期日"))}</th><th>${htmlEsc(localizedLiteral(lang, "Action", "操作"))}</th></tr></thead>
            <tbody>${contractRows || `<tr><td colspan="7" class="content-muted">${htmlEsc(localizedLiteral(lang, "No managed members found.", "未找到当前经营成员。"))}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`
          : `
      ${head}
      <section class="fm-card finance-projection-card" aria-label="${htmlEsc(localizedLiteral(lang, "24 month projection", "24个月预测"))}">
        <div class="finance-projection-head">
          <div>
            <h3 class="content-h3 finance-projection-title">${htmlEsc(localizedLiteral(lang, "Overall Balance Projection", "整体余额预测"))}</h3>
            <p class="content-muted finance-projection-copy">${htmlEsc(localizedLiteral(lang, "24-month conservative runway. Fixed monthly burden is counted, but uncertain future live income is not assumed.", "保守的24个月资金跑道。已计入固定月度负担，但不假设不确定的未来公演收入。"))}</p>
          </div>
          <div class="finance-projection-kpis">
            <div class="finance-projection-kpi">
              <span class="finance-projection-kpi-label">${htmlEsc(localizedLiteral(lang, "Projected 24M close", "预计24个月结余"))}</span>
              <strong class="finance-projection-kpi-value">${htmlEsc(financeMoneyShort(projectedLast?.closingBalance ?? f.cash_yen))}</strong>
            </div>
            <div class="finance-projection-kpi">
              <span class="finance-projection-kpi-label">${htmlEsc(localizedLiteral(lang, "Avg monthly net", "月均净额"))}</span>
              <strong class="finance-projection-kpi-value ${avgMonthlyNet >= 0 ? "is-positive" : "is-negative"}">${htmlEsc(financeMoneyShort(avgMonthlyNet))}</strong>
            </div>
            <div class="finance-projection-kpi">
              <span class="finance-projection-kpi-label">${htmlEsc(localizedLiteral(lang, "Projected income / month", "预计月收入"))}</span>
              <strong class="finance-projection-kpi-value is-positive">${htmlEsc(financeMoneyShort(projectedIncome))}</strong>
            </div>
            <div class="finance-projection-kpi">
              <span class="finance-projection-kpi-label">${htmlEsc(localizedLiteral(lang, "Projected expense / month", "预计月支出"))}</span>
              <strong class="finance-projection-kpi-value is-negative">${htmlEsc(financeMoneyShort(projectedExpense))}</strong>
            </div>
          </div>
        </div>
        ${renderFinanceProjectionSvg(projectionPoints)}
      </section>
      <div class="table-panel">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Daily ledger (recent)", "每日账本（近期）"))}</h3>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Net", "净额"))}</th><th>${htmlEsc(localizedLiteral(lang, "Tier", "等级"))}</th><th>${htmlEsc(localizedLiteral(lang, "Income", "收入"))}</th><th>${htmlEsc(localizedLiteral(lang, "Expense", "支出"))}</th><th>${htmlEsc(localizedLiteral(lang, "Scout sub", "星探订阅"))}</th></tr></thead>
            <tbody>${tableRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(localizedLiteral(lang, "No ledger rows yet.", "暂无流水记录。"))}</td></tr>`}</tbody>
          </table>
        </div>
      </div>
      <div class="table-panel">
        <div class="finance-history-head">
          <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Income / expense history", "收支历史"))}</h3>
          <div class="finance-history-tabs">${historyRangeButtons
            .map(
              ([value, label]) =>
                `<button type="button" class="fm-btn ${financeHistoryRange === value ? "is-active" : ""}" data-finance-history-range="${value}">${htmlEsc(label)}</button>`,
            )
            .join("")}</div>
        </div>
        <p class="content-muted">${htmlEsc(localizedLiteral(lang, "Income", "收入"))} &yen;${historyTotals.income.toLocaleString("ja-JP")} / ${htmlEsc(localizedLiteral(lang, "Expense", "支出"))} &yen;${historyTotals.expense.toLocaleString("ja-JP")}</p>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Tier", "等级"))}</th><th>${htmlEsc(localizedLiteral(lang, "Income", "收入"))}</th><th>${htmlEsc(localizedLiteral(lang, "Expense", "支出"))}</th><th>${htmlEsc(localizedLiteral(lang, "Scout sub", "星探订阅"))}</th><th>${htmlEsc(localizedLiteral(lang, "Net", "净额"))}</th></tr></thead>
            <tbody>${historyTableRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(localizedLiteral(lang, "No ledger rows yet.", "暂无流水记录。"))}</td></tr>`}</tbody>
          </table>
        </div>
      </div>`
      }
    </section>`;
}

void renderFinances;

function idolListGroupLinksHtml(
  row: Record<string, unknown>,
  referenceIso: string | undefined,
  groupsSnapshot: Record<string, unknown>[],
): string {
  const memberships = activeGroupMembershipsAtReference(row, referenceIso, groupsSnapshot);
  if (!memberships.length) return htmlEsc("—");
  return memberships
    .map((m) => {
      const guid = m.uid || lookupGroupUidByName(groupsSnapshot, m.name) || "";
      return guid
        ? `<button type="button" class="idol-detail-group-link" data-group-detail="${htmlEsc(guid)}" data-wiki-skip="1">${htmlEsc(m.name)}</button>`
        : `<span data-wiki-skip="1">${htmlEsc(m.name)}</span>`;
    })
    .join(", ");
}

function renderIdolsList(
  idols: Record<string, unknown>[],
  referenceIso: string | undefined,
  headline: string,
  layout: "cards" | "list",
  lang: UiLanguage,
  groupsSnapshot: Record<string, unknown>[] = [],
  note?: string,
): string {
  if (!idols.length) return renderPlaceholder(navLabel(lang, "Idols"), localizedLiteral(lang, "No idols in database snapshot.", "数据库快照中没有偶像。"));

  const sorted = sortIdolsByXFollowersDesc(idols);
  const rows = sorted.filter((row) => typeof row.uid === "string" && row.uid.trim());

  const portraitThumbHtml = (row: Record<string, unknown>, name: string) => {
    const initial = [...(name.trim() || "?")][0] ?? "?";
    const portraitSrc = idolPortraitPublicSrc(row, referenceIso);
    const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
    return portraitSrc
      ? `<img class="idol-thumb" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="idol-thumb-ph" aria-hidden="true">${htmlEsc(initial)}</span>`;
  };

  const cards = rows
    .map((row) => {
      const name = typeof row.name === "string" ? row.name : "—";
      const uid = (row.uid as string).trim();
      const romaji = romajiFromRow(row);
      const attrs = attrsFromRow(row);
      const age = ageLabel(row, referenceIso);
      const groupsHtml = idolListGroupLinksHtml(row, referenceIso, groupsSnapshot);
      const portraitInner = portraitThumbHtml(row, name);

      // Use a div (not button) so nested group-jump controls stay valid HTML.
      return `
      <div class="fm-card idol-card-tile idol-card-with-photo idol-card-compact" data-idol-detail="${htmlEsc(uid)}" role="button" tabindex="0">
        <span class="idol-card-face" aria-hidden="true">${portraitInner}</span>
        <span class="idol-card-stack">
          <span class="idol-card-row1">
            <span class="idol-card-name">${htmlEsc(name)}</span>
            ${romaji ? `<span class="idol-card-romaji">${htmlEsc(romaji)}</span>` : ""}
          </span>
          <span class="idol-card-row2">${htmlEsc(lang === "zh-CN" ? `年龄 ${age}` : `Age ${age}`)} · ${htmlEsc("X")} ${htmlEsc(xFollowersLabel(row))} · ${htmlEsc(localizedLiteral(lang, "Ability", "能力"))} ${getAbility(attrs)}</span>
          <span class="idol-card-row3" data-wiki-skip="1"><strong>${htmlEsc(localizedLiteral(lang, "Group", "组合"))}:</strong> ${groupsHtml}</span>
        </span>
      </div>`;
    })
    .join("");

  const tableRows = rows
    .map((row) => {
      const name = typeof row.name === "string" ? row.name : "—";
      const uid = (row.uid as string).trim();
      const romaji = romajiFromRow(row);
      const attrs = attrsFromRow(row);
      const age = ageLabel(row, referenceIso);
      const groupsHtml = idolListGroupLinksHtml(row, referenceIso, groupsSnapshot);
      const ph = portraitThumbHtml(row, name);
      return `<tr class="idol-list-table-row" data-idol-detail="${htmlEsc(uid)}" tabindex="0" role="button">
        <td class="idol-list-photo">${ph}</td>
        <td>${htmlEsc(name)}</td>
        <td>${romaji ? htmlEsc(romaji) : "—"}</td>
        <td>${htmlEsc(age)}</td>
        <td class="num">${htmlEsc(heightCmLabel(row))}</td>
        <td class="num">${getAbility(attrs)}</td>
        <td class="num">${htmlEsc(xFollowersLabel(row))}</td>
        <td data-wiki-skip="1">${groupsHtml}</td>
      </tr>`;
    })
    .join("");

  const noteHtml = note ? `<p class="content-muted">${note}</p>` : "";
  const sortNote = `<p class="content-muted">${htmlEsc(
    lang === "zh-CN"
      ? "排序：X 关注数从高到低。头像读取自 public/data/pictures/idols/（portrait_photo_path 的文件名部分）。"
      : "Order: X followers (high → low). Portraits: public/data/pictures/idols/ (basename of portrait_photo_path).",
  )}</p>`;

  const toolbar = `<div class="idol-list-toolbar" role="toolbar" aria-label="${htmlEsc(localizedLiteral(lang, "Idol list layout", "偶像列表布局"))}">
    <span class="idol-list-toolbar-label">${htmlEsc(localizedLiteral(lang, "View", "视图"))}</span>
    <button type="button" class="fm-btn idol-list-mode-btn ${layout === "cards" ? "is-active" : ""}" data-idol-layout="cards">${htmlEsc(localizedLiteral(lang, "Cards", "卡片"))}</button>
    <button type="button" class="fm-btn idol-list-mode-btn ${layout === "list" ? "is-active" : ""}" data-idol-layout="list">${htmlEsc(localizedLiteral(lang, "List", "列表"))}</button>
  </div>`;

  const body =
    layout === "cards"
      ? `<div class="idol-grid idol-grid--cards">${cards}</div>`
      : `<div class="table-scroll">
      <table class="fm-table idol-list-table">
        <thead>
          <tr>
            <th></th>
            <th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th>
            <th>${htmlEsc(localizedLiteral(lang, "Romaji", "罗马音"))}</th>
            <th>${htmlEsc(localizedLiteral(lang, "Age", "年龄"))}</th>
            <th>${htmlEsc(localizedLiteral(lang, "Height cm", "身高 cm"))}</th>
            <th>${htmlEsc(localizedLiteral(lang, "Ability", "能力"))}</th>
            <th>${htmlEsc(localizedLiteral(lang, "X followers", "X 粉丝数"))}</th>
            <th data-wiki-skip="1">${htmlEsc(localizedLiteral(lang, "Current group(s)", "当前所属组合"))}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  return `
    <section class="content-panel idols-view">
      <h2 class="content-h2">${htmlEsc(headline)}</h2>
      <p class="content-muted">${htmlEsc(lang === "zh-CN" ? `${sorted.length.toLocaleString()} 名偶像 · 参考日 ${referenceIso ?? "—"}` : `${sorted.length.toLocaleString()} idols · reference ${referenceIso ?? "—"}`)}.</p>
      ${noteHtml}
      ${toolbar}
      ${sortNote}
      ${body}
    </section>`;
}

function isSongReleasedBy(referenceIso: string | null | undefined, row: Record<string, unknown>): boolean {
  const releaseIso = String(row.release_date ?? "").split("T")[0].trim();
  const refIso = String(referenceIso ?? "").split("T")[0].trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(releaseIso)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(refIso)) return true;
  return releaseIso <= refIso;
}

/** Making workshop: Title, Romanji, digital release status, Arrange / Release digital. */
function makingWorkshopRowsHtml(rows: Record<string, unknown>[], referenceIso: string | null | undefined): string {
  return rows
    .map((row) => {
      const title =
        typeof row.title === "string" || typeof row.title_romanji === "string"
          ? songCatalogDisplayLabel(row)
          : String(row.uid ?? "—");
      const romanji = typeof row.title_romanji === "string" ? row.title_romanji : "";
      const digitalStatus = isSongReleasedBy(referenceIso, row) ? "Released" : "Not released";
      const uid = String(row.uid ?? "").trim();
      const uidAttr = uid ? encodeURIComponent(uid) : "";
      const uidData = uidAttr ? ` data-song-uid="${uidAttr}"` : "";
      const actions = `<div class="making-track-actions">
        <button type="button" class="fm-btn making-arrange-btn" data-making-arrange${uidData}>${htmlEsc("Arrange")}</button>
        <button type="button" class="fm-btn fm-btn-accent making-release-btn" data-making-release${uidData}>${htmlEsc("Release digital")}</button>
      </div>`;
      return `<tr><td>${htmlEsc(title)}</td><td>${htmlEsc(romanji)}</td><td>${htmlEsc(digitalStatus)}</td><td class="making-actions-cell">${actions}</td></tr>`;
    })
    .join("");
}

function songRowsHtml(
  rows: Record<string, unknown>[],
  cols: "pair" | "full",
  rowKind: "released" | "making" = "released",
  lang: UiLanguage = "en",
  selectedSongUid: string | null = null,
  discLookup?: {
    curatedRows?: GroupDiscographyReleaseRow[] | null;
    buckets?: DiscBucket[] | null;
  } | null,
): string {
  const hideCatalogFields = rowKind === "making";
  return rows
    .map((row) => {
      const uid = String(row.uid ?? "").trim();
      const title =
        typeof row.title === "string" || typeof row.title_romanji === "string"
          ? songCatalogDisplayLabel(row)
          : String(row.uid ?? "—");
      const titleCell = uid
        ? `<td><button type="button" class="songs-title-link${selectedSongUid === uid ? " is-selected" : ""}" data-song-detail="${htmlEsc(uid)}">${htmlEsc(title)}</button></td>`
        : `<td>${htmlEsc(title)}</td>`;
      const romanji = typeof row.title_romanji === "string" ? row.title_romanji : "";
      const rel = hideCatalogFields ? "—" : typeof row.release_date === "string" ? row.release_date : "—";
      const gname = typeof row.group_name === "string" ? row.group_name : "";
      const dtype = typeof row.disc_type === "string" ? row.disc_type : "";
      const disc = primaryDiscLabel(row);
      const previewCell = `<td class="songs-preview-cell">${renderSongPreviewControls(row, lang)}</td>`;
      const popCell = hideCatalogFields
        ? `<td class="num songs-making-na">${htmlEsc("—")}</td>`
        : `<td class="num">${htmlEsc(String(songPopularityNum(row)))}</td>`;
      const relCellClass = hideCatalogFields ? " songs-making-na" : "";
      const discKey =
        !hideCatalogFields && disc && disc !== "—"
          ? findDiscographyKeyForDiscLabel(disc, discLookup?.curatedRows, discLookup?.buckets)
          : null;
      const discCell = discKey
        ? `<td class="songs-disc-cell"><button type="button" class="songs-disc-link" data-songs-open-disc="${htmlEsc(discKey)}" data-wiki-skip="1">${htmlEsc(disc)}</button></td>`
        : `<td class="songs-disc-cell" data-wiki-skip="1">${htmlEsc(disc)}</td>`;
      const typeCell = `<td>${htmlEsc(dtype)}</td>`;
      if (cols === "pair") {
        return `<tr class="${selectedSongUid && uid === selectedSongUid ? "is-selected-song" : ""}">${titleCell}<td>${htmlEsc(romanji)}</td>${previewCell}<td class="num${relCellClass}">${htmlEsc(rel)}</td>${typeCell}${discCell}${popCell}</tr>`;
      }
      return `<tr class="${selectedSongUid && uid === selectedSongUid ? "is-selected-song" : ""}">${titleCell}<td>${htmlEsc(romanji)}</td>${previewCell}<td class="num${relCellClass}">${htmlEsc(rel)}</td>${typeCell}${discCell}<td>${htmlEsc(gname)}</td>${popCell}</tr>`;
    })
    .join("");
}

/** Released rows first; optional second `tbody` for future / undated tracks (desktop Making). */
function renderSongsTrackTableBodies(
  released: Record<string, unknown>[],
  making: Record<string, unknown>[],
  asOfIso: string | null,
  cols: "pair" | "full",
  emptyReleasedMsg: string,
  lang: UiLanguage = "en",
  selectedSongUid: string | null = null,
  discLookup?: {
    curatedRows?: GroupDiscographyReleaseRow[] | null;
    buckets?: DiscBucket[] | null;
  } | null,
): string {
  const ncol = cols === "pair" ? 7 : 8;
  const refShort = asOfIso ? String(asOfIso).trim().split("T")[0] : "";
  const refPretty =
    refShort && /^\d{4}-\d{2}-\d{2}$/.test(refShort) ? formatLongDate(refShort) : refShort || "—";
  const releasedRows = songRowsHtml(released, cols, "released", lang, selectedSongUid, discLookup);
  const makingRows = songRowsHtml(making, cols, "making", lang, selectedSongUid, discLookup);
  const showMaking = making.length > 0;
  const tbReleased =
    released.length > 0
      ? releasedRows
      : `<tr><td colspan="${ncol}" class="content-muted">${htmlEsc(emptyReleasedMsg)}</td></tr>`;
  const makingHeader = `<tr class="songs-making-divider"><td colspan="${ncol}" class="songs-making-label"><span class="songs-making-title">${htmlEsc("Songs")}</span><span class="songs-making-sub">${htmlEsc(
    `${making.length.toLocaleString()} track(s) with no release date or scheduled after ${refPretty}`,
  )}</span></td></tr>`;
  const tbMaking = showMaking ? `${makingHeader}${makingRows}` : "";
  return `<tbody class="songs-released-tbody">${tbReleased}</tbody>${showMaking ? `<tbody class="songs-making-tbody">${tbMaking}</tbody>` : ""}`;
}

function renderSongsGroupDropdown(
  groups: Record<string, unknown>[],
  selectedUid: string,
  managedGroupUid?: string | null,
): string {
  const sorted = sortGroupsForDirectory(groupsForDirectoryListing(groups));
  const managedUid = String(managedGroupUid ?? "").trim();
  const ordered =
    managedUid
      ? [
          ...sorted.filter((g) => String((g as { uid?: unknown }).uid ?? "").trim() === managedUid),
          ...sorted.filter((g) => String((g as { uid?: unknown }).uid ?? "").trim() !== managedUid),
        ]
      : sorted;
  const opts = ordered
    .map((g) => {
      const uid = String((g as { uid?: unknown }).uid ?? "").trim();
      if (!uid) return "";
      const name = String((g as { name?: unknown }).name ?? (g as { name_romanji?: unknown }).name_romanji ?? uid.slice(0, 10));
      const sel = uid === selectedUid ? " selected" : "";
      return `<option value="${encodeURIComponent(uid)}"${sel}>${htmlEsc(name)}</option>`;
    })
    .filter(Boolean)
    .join("");
  return `<div class="songs-toolbar fm-card-inline">
    <label class="songs-toolbar-label"><span class="songs-toolbar-text">${htmlEsc("Group")}</span>
      <select id="songs-group-select" class="fm-select songs-group-select" aria-label="Current group for songs">${opts}</select>
    </label>
  </div>`;
}

/** Making view: managed group only (no picker). */
function renderMakingManagedGroupBar(groups: Record<string, unknown>[], managedUid: string): string {
  const sorted = sortGroupsForDirectory(groups);
  const row = sorted.find((g) => String((g as { uid?: unknown }).uid ?? "").trim() === managedUid);
  const name = row
    ? String((row as { name?: unknown }).name ?? (row as { name_romanji?: unknown }).name_romanji ?? managedUid)
    : managedUid;
  const rj = row ? String((row as { name_romanji?: unknown }).name_romanji ?? "").trim() : "";
  const label = rj && rj !== name ? `${name} (${rj})` : name;
  return `<div class="songs-toolbar fm-card-inline songs-making-managed-bar" role="group" aria-label="${htmlEsc("Managed group (Making)")}">
    <span class="songs-toolbar-label"><span class="songs-toolbar-text">${htmlEsc("Group")}</span>
    <strong class="songs-making-managed-name">${htmlEsc(label)}</strong>
    <span class="content-muted songs-making-managed-note">${htmlEsc("managed")}</span></span>
  </div>`;
}

function renderSongsWorkspaceTabs(active: SongsWorkspaceTab, lang: UiLanguage = "en"): string {
  const songsAct = active === "group_songs" ? " is-active" : "";
  const discAct = active === "disc" ? " is-active" : "";
  const b1 = `<button type="button" class="songs-workspace-tab${songsAct}" data-songs-workspace-tab="group_songs" role="tab">${htmlEsc(localizedLiteral(lang, "Songs", "歌曲"))}</button>`;
  const b2 = `<button type="button" class="songs-workspace-tab${discAct}" data-songs-workspace-tab="disc" role="tab">${htmlEsc(localizedLiteral(lang, "Discography", "作品目录"))}</button>`;
  return `<div class="songs-workspace-tabs" role="tablist">${b1}${b2}</div>`;
}

function renderMakingTabs(active: MakingTab, lang: UiLanguage = "en"): string {
  const songsAct = active === "songs" ? " is-active" : "";
  const cdAct = active === "cd" ? " is-active" : "";
  const goodsAct = active === "goods" ? " is-active" : "";
  return `<div class="songs-workspace-tabs" role="tablist">
    <button type="button" class="songs-workspace-tab${songsAct}" data-making-tab="songs" role="tab">${htmlEsc(localizedLiteral(lang, "Songs", "歌曲"))}</button>
    <button type="button" class="songs-workspace-tab${cdAct}" data-making-tab="cd" role="tab">${htmlEsc("CD")}</button>
    <button type="button" class="songs-workspace-tab${goodsAct}" data-making-tab="goods" role="tab">${htmlEsc(localizedLiteral(lang, "Goods", "周边"))}</button>
  </div>`;
}

function releaseStateLabel(song: Record<string, unknown>, referenceIso: string | null | undefined): string {
  return isSongReleasedBy(referenceIso, song) ? "Released" : "Unreleased";
}

function renderCdProjectsView(
  save: GameSavePayload,
  selectedProjectUid: string | null,
  referenceIso: string | null | undefined,
): string {
  const managedUid = String(save.managing_group_uid ?? "").trim();
  const projects = Array.isArray(save.cd_projects) ? save.cd_projects : [];
  const selectedProject =
    projects.find((row) => row.uid === selectedProjectUid) ??
    projects[0] ??
    null;
  const songs = songsForDisplaySorted(save.database_snapshot.songs).filter(
    (row) => String(row.group_uid ?? "").trim() === managedUid,
  );
  const projectRows = projects.length
    ? projects
        .map((project) => {
          const isSelected = project.uid === selectedProject?.uid ? " is-selected" : "";
          return `<tr class="songs-discography-row${isSelected}" data-cd-project-pick="${htmlEsc(project.uid)}" tabindex="0" role="button">
            <td>${htmlEsc(project.title)}</td>
            <td>${htmlEsc(project.release_kind === "album" ? "Album" : "Single")}</td>
            <td class="num">${project.song_uids.length.toLocaleString("ja-JP")}</td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="3" class="content-muted">${htmlEsc("No CD project yet. Create a single or album to start.")}</td></tr>`;
  const projectSongSet = new Set(selectedProject?.song_uids ?? []);
  const availableRows = songs
    .map((song) => {
      const uid = String(song.uid ?? "").trim();
      if (!uid) return "";
      const title = songCatalogDisplayLabel(song);
      const romanji = typeof song.title_romanji === "string" ? song.title_romanji : "";
      const status = releaseStateLabel(song, referenceIso);
      const action = selectedProject
        ? projectSongSet.has(uid)
          ? `<span class="content-muted">${htmlEsc("In project")}</span>`
          : `<button type="button" class="fm-btn" data-cd-project-add-song="${htmlEsc(uid)}">Add</button>`
        : `<span class="content-muted">${htmlEsc("Pick a project")}</span>`;
      return `<tr>
        <td>${htmlEsc(title)}</td>
        <td>${htmlEsc(romanji)}</td>
        <td>${htmlEsc(status)}</td>
        <td>${action}</td>
      </tr>`;
    })
    .join("");
  const projectTrackRows = selectedProject
    ? selectedProject.song_uids
        .map((uid) => songs.find((song) => String(song.uid ?? "").trim() === uid))
        .filter((song): song is Record<string, unknown> => Boolean(song))
        .map((song) => {
          const uid = String(song.uid ?? "").trim();
          const title = songCatalogDisplayLabel(song);
          const romanji = typeof song.title_romanji === "string" ? song.title_romanji : "";
          return `<tr>
            <td>${htmlEsc(title)}</td>
            <td>${htmlEsc(romanji)}</td>
            <td>${htmlEsc(releaseStateLabel(song, referenceIso))}</td>
            <td><button type="button" class="fm-btn" data-cd-project-remove-song="${htmlEsc(uid)}">Remove</button></td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="4" class="content-muted">${htmlEsc("Select a CD project first.")}</td></tr>`;

  return `<section class="content-panel songs-view making-track-view">
    <h2 class="content-h2">Making</h2>
    <p class="content-muted">${htmlEsc("Build physical releases here. CD projects can include unreleased or already released songs, while Making -> Songs stays focused on digital release work.")}</p>
    ${renderMakingTabs("cd")}
    <div class="songs-discography-layout">
      <div class="fm-card songs-discography-list">
        <h3 class="content-h3">${htmlEsc("CD projects")}</h3>
        <div class="making-cd-project-actions">
          <button type="button" class="fm-btn" data-cd-project-create="single">${htmlEsc("New single")}</button>
          <button type="button" class="fm-btn fm-btn-accent" data-cd-project-create="album">${htmlEsc("New album")}</button>
        </div>
        <div class="table-scroll">
          <table class="fm-table songs-discography-table">
            <thead><tr><th>Title</th><th>Type</th><th>Tracks</th></tr></thead>
            <tbody>${projectRows}</tbody>
          </table>
        </div>
      </div>
      <div class="fm-card songs-discography-tracks">
        <h3 class="content-h3">${htmlEsc(selectedProject?.title ?? "CD details")}</h3>
        ${
          selectedProject
            ? `<div class="making-cd-form">
                <label class="songs-toolbar-label"><span class="songs-toolbar-text">${htmlEsc("Title")}</span>
                  <input type="text" class="fm-input" data-cd-project-title="${htmlEsc(selectedProject.uid)}" value="${htmlEsc(selectedProject.title)}" />
                </label>
                <label class="songs-toolbar-label"><span class="songs-toolbar-text">${htmlEsc("Type")}</span>
                  <select class="fm-select" data-cd-project-kind="${htmlEsc(selectedProject.uid)}">
                    <option value="single"${selectedProject.release_kind === "single" ? " selected" : ""}>Single</option>
                    <option value="album"${selectedProject.release_kind === "album" ? " selected" : ""}>Album</option>
                  </select>
                </label>
                <button type="button" class="fm-btn" data-cd-project-delete="${htmlEsc(selectedProject.uid)}">${htmlEsc("Delete project")}</button>
              </div>`
            : `<p class="content-muted">${htmlEsc("Create a CD project to build a single or album tracklist.")}</p>`
        }
        <div class="making-cd-grid">
          <div>
            <h4 class="content-h3">${htmlEsc("Tracklist")}</h4>
            <div class="table-scroll">
              <table class="fm-table">
                <thead><tr><th>Title</th><th>Romanji</th><th>Status</th><th></th></tr></thead>
                <tbody>${projectTrackRows}</tbody>
              </table>
            </div>
          </div>
          <div>
            <h4 class="content-h3">${htmlEsc("Song pool")}</h4>
            <div class="table-scroll">
              <table class="fm-table">
                <thead><tr><th>Title</th><th>Romanji</th><th>Status</th><th></th></tr></thead>
                <tbody>${availableRows || `<tr><td colspan="4" class="content-muted">${htmlEsc("No songs for this group.")}</td></tr>`}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>`;
}

type GoodsInventoryMatrixRow = {
  name: string;
  category: string;
  unitPriceYen: number;
  unitCostYen: number;
  entriesByMemberUid: Map<string, ProducedGoodsRow>;
  sharedEntry: ProducedGoodsRow | null;
};

type BirthdayGoodsQueueRow = {
  memberUid: string;
  memberName: string;
  liveUid: string;
  liveTitle: string;
  liveDate: string;
  goodsUid: string;
  goods: ProducedGoodsRow | null;
};

function buildGoodsInventoryMatrix(goods: ProducedGoodsRow[]): {
  members: Array<{ uid: string; name: string }>;
  rows: GoodsInventoryMatrixRow[];
} {
  const members = new Map<string, { uid: string; name: string }>();
  const rowsByName = new Map<string, GoodsInventoryMatrixRow>();
  for (const item of goods) {
    const rowKey = `${String(item.category ?? "").trim()}|${String(item.name ?? "").trim()}`;
    let row = rowsByName.get(rowKey);
    if (!row) {
      row = {
        name: String(item.name ?? "").trim(),
        category: String(item.category ?? "").trim(),
        unitPriceYen: Math.max(0, Number(item.unit_price_yen ?? 0) || 0),
        unitCostYen: Math.max(0, Number(item.unit_cost_yen ?? 0) || 0),
        entriesByMemberUid: new Map<string, ProducedGoodsRow>(),
        sharedEntry: null,
      };
      rowsByName.set(rowKey, row);
    }
    row.unitPriceYen = Math.max(0, Number(item.unit_price_yen ?? row.unitPriceYen) || 0);
    row.unitCostYen = Math.max(0, Number(item.unit_cost_yen ?? row.unitCostYen) || 0);
    const memberUid = String(item.member_uid ?? "").trim();
    const memberName = String(item.member_name ?? "").trim();
    if (memberUid && memberName) {
      members.set(memberUid, { uid: memberUid, name: memberName });
      row.entriesByMemberUid.set(memberUid, item);
    } else {
      row.sharedEntry = item;
    }
  }
  const sortedMembers = [...members.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const rows = [...rowsByName.values()].sort((a, b) => {
    const cat = a.category.localeCompare(b.category, "en");
    return cat !== 0 ? cat : a.name.localeCompare(b.name, "en");
  });
  return { members: sortedMembers, rows };
}

function buildBirthdayGoodsQueue(save: GameSavePayload, goods: ProducedGoodsRow[]): BirthdayGoodsQueueRow[] {
  const group = getPrimaryGroup(save);
  if (!group || typeof group !== "object") return [];
  const currentIso = String(save.current_date ?? save.game_start_date ?? "").split("T")[0];
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((uid) => String(uid ?? "").trim()).filter(Boolean) : [];
  const idols = Array.isArray(save.database_snapshot.idols) ? save.database_snapshot.idols : [];
  const members = memberUids
    .map((uid) => {
      const row = idols.find((idol) => String((idol as { uid?: unknown }).uid ?? "").trim() === uid);
      const name = String((row as { name?: unknown })?.name ?? "").trim();
      return name ? { uid, name } : null;
    })
    .filter((row): row is { uid: string; name: string } => Boolean(row));
  const goodsByUidMap = goodsByUid(goods);
  const schedules = Array.isArray(save.lives?.schedules) ? save.lives.schedules : [];
  const out: BirthdayGoodsQueueRow[] = [];
  for (const live of schedules) {
    if (!live || typeof live !== "object") continue;
    const dateIso = String((live as { start_date?: unknown }).start_date ?? "").split("T")[0];
    if (currentIso && dateIso && dateIso < currentIso) continue;
    const title = String((live as { title?: unknown }).title ?? "").trim();
    if (!/生誕|birthday/i.test(title)) continue;
    const liveUid = String((live as { uid?: unknown }).uid ?? "").trim();
    for (const member of members) {
      if (!title.includes(member.name)) continue;
      const goodsUid = birthdayTeeUidForMember(member.uid);
      out.push({
        memberUid: member.uid,
        memberName: member.name,
        liveUid,
        liveTitle: title,
        liveDate: dateIso,
        goodsUid,
        goods: goodsByUidMap.get(goodsUid) ?? null,
      });
      break;
    }
  }
  return out.sort((a, b) => `${a.liveDate} ${a.memberName}`.localeCompare(`${b.liveDate} ${b.memberName}`, "ja"));
}

function renderGoodsInventoryTable(save: GameSavePayload, goods: ProducedGoodsRow[]): string {
  const regularGoods = goods.filter((item) => String(item.name ?? "").trim() !== BIRTHDAY_TEE_TEMPLATE.name);
  const { members, rows } = buildGoodsInventoryMatrix(regularGoods);
  const birthdayQueue = buildBirthdayGoodsQueue(save, goods);
  const regularHeaderCells = rows
    .map((row) => {
      const totalUnits = [...row.entriesByMemberUid.values()].reduce(
        (sum, entry) => sum + Math.max(0, Number(entry.desired_amount ?? 0) || 0),
        row.sharedEntry ? Math.max(0, Number(row.sharedEntry.desired_amount ?? 0) || 0) : 0,
      );
      const rowKey = encodeURIComponent(`${row.category}|${row.name}`);
      return `<th class="goods-transpose-head">
        <div class="goods-transpose-title">${htmlEsc(row.name)}</div>
        <label class="goods-transpose-price">
          <span>${htmlEsc("Price")}</span>
          <input class="fm-input goods-price-input" data-goods-price-key="${htmlEsc(rowKey)}" value="${htmlEsc(String(row.unitPriceYen))}" />
        </label>
        <div class="goods-transpose-meta">${htmlEsc(lang === "zh-CN" ? `成本 日元 ${row.unitCostYen.toLocaleString("ja-JP")}` : `Cost JPY ${row.unitCostYen.toLocaleString("ja-JP")}`)}</div>
        <div class="goods-transpose-meta">${htmlEsc(lang === "zh-CN" ? `合计 日元 ${(totalUnits * row.unitCostYen).toLocaleString("ja-JP")}` : `Total JPY ${(totalUnits * row.unitCostYen).toLocaleString("ja-JP")}`)}</div>
        <button type="button" class="fm-btn fm-btn-accent goods-transpose-order" data-goods-order-key="${htmlEsc(rowKey)}">Order</button>
      </th>`;
    })
    .join("");
  const bodyRows = members
    .map((member) => {
      const cells = rows
        .map((row) => {
          const entry = row.entriesByMemberUid.get(member.uid) ?? row.sharedEntry;
          if (!entry) return `<td class="goods-matrix-cell goods-matrix-cell--empty">-</td>`;
          const stock = Math.max(0, Number(entry.stock ?? 0) || 0);
          const desired = Math.max(0, Number(entry.desired_amount ?? 0) || 0);
          return `<td class="goods-matrix-cell">
            <div class="goods-matrix-stock">${htmlEsc(`Stock ${stock.toLocaleString("ja-JP")}`)}</div>
            <input class="fm-input goods-amount-input" data-goods-desired-uid="${htmlEsc(entry.uid)}" value="${htmlEsc(String(desired))}" />
          </td>`;
        })
        .join("");
      return `<tr><th scope="row">${htmlEsc(member.name)}</th>${cells}</tr>`;
    })
    .join("");
  const birthdayQueueRows = birthdayQueue.length
    ? birthdayQueue
        .map((row) => {
          const goods = row.goods;
          const stock = Math.max(0, Number(goods?.stock ?? 0) || 0);
          const desired = Math.max(0, Number(goods?.desired_amount ?? BIRTHDAY_TEE_TEMPLATE.default_desired_amount) || 0);
          const price = Math.max(0, Number(goods?.unit_price_yen ?? BIRTHDAY_TEE_TEMPLATE.unit_price_yen) || 0);
          const cost = Math.max(0, Number(goods?.unit_cost_yen ?? BIRTHDAY_TEE_TEMPLATE.unit_cost_yen) || 0);
          return `<tr>
            <td>${htmlEsc(row.memberName)}</td>
            <td>${htmlEsc(formatLongDate(row.liveDate))}</td>
            <td><button type="button" class="link-btn" data-live-open-uid="${htmlEsc(row.liveUid)}">${htmlEsc(row.liveTitle)}</button></td>
            <td class="num">${htmlEsc(String(stock))}</td>
            <td><input class="fm-input goods-amount-input" data-goods-desired-uid="${htmlEsc(row.goodsUid)}" data-goods-member-uid="${htmlEsc(row.memberUid)}" data-goods-member-name="${htmlEsc(row.memberName)}" value="${htmlEsc(String(desired))}" /></td>
            <td><input class="fm-input goods-price-input" data-goods-price-key="${htmlEsc(encodeURIComponent(`birthday-queue|${row.memberUid}`))}" data-goods-member-uid="${htmlEsc(row.memberUid)}" data-goods-member-name="${htmlEsc(row.memberName)}" value="${htmlEsc(String(price))}" /></td>
            <td class="num">${htmlEsc(currencyText(lang, cost))}</td>
            <td class="num">${htmlEsc(currencyText(lang, desired * cost))}</td>
            <td><button type="button" class="fm-btn fm-btn-accent" data-birthday-goods-order-uid="${htmlEsc(row.memberUid)}" data-goods-member-name="${htmlEsc(row.memberName)}">Queue order</button></td>
          </tr>`;
        })
        .join("")
    : `<tr><td colspan="9" class="content-muted">${htmlEsc("No upcoming birthday live for the current managed roster.")}</td></tr>`;
  return `<section class="content-panel songs-view making-track-view">
    <h2 class="content-h2">Making</h2>
    <p class="content-muted">${htmlEsc("Build stock here first. Each row orders one goods type across the member columns, and ordering consumes cash as production cost.")}</p>
    ${renderMakingTabs("goods")}
    <section class="fm-card">
      <h3 class="content-h3">Birthday T-shirt for upcoming birthday party</h3>
      <p class="content-muted">${htmlEsc("Prepare birthday T-shirts here for members with an upcoming birthday live.")}</p>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>Member</th><th>Birthday live date</th><th>Birthday live</th><th>Stock</th><th>Queue amount</th><th>Price</th><th>Cost</th><th>Total cost</th><th>Order</th></tr></thead>
          <tbody>${birthdayQueueRows}</tbody>
        </table>
      </div>
    </section>
    <section class="fm-card">
      <h3 class="content-h3">Goods workshop</h3>
      <p class="content-muted">${htmlEsc("Regular goods are shown as item columns, with one order button per goods type.")}</p>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>Member</th>${regularHeaderCells}</tr></thead>
          <tbody>${bodyRows}</tbody>
        </table>
      </div>
    </section>
  </section>`;
}

function bucketEarliestRelease(songs: Record<string, unknown>[]): string {
  const dates = songs
    .map((s) => String(s.release_date ?? "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d));
  if (!dates.length) return "—";
  dates.sort();
  return dates[0] ?? "—";
}

function bucketRepresentativeDiscType(songs: Record<string, unknown>[]): string {
  const t = songs.map((s) => String(s.disc_type ?? "").trim()).find(Boolean);
  return t || "—";
}

function resolveDiscographyBucketKey(buckets: DiscBucket[], selected: string | null): string {
  if (!buckets.length) return "";
  if (selected && buckets.some((b) => b.key === selected)) return selected;
  return buckets[0]!.key;
}

function resolveGroupDiscographyKey(rows: GroupDiscographyReleaseRow[], selected: string | null): string {
  const selectable = rows.filter((row) => row.selectable !== false);
  if (!selectable.length) return "";
  if (selected && selectable.some((row) => row.key === selected)) return selected;
  return selectable[0]!.key;
}

function songMapByUid(songs: readonly Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const map = new Map<string, Record<string, unknown>>();
  for (const row of songs) {
    const uid = String(row.uid ?? "").trim();
    if (uid) map.set(uid, row);
  }
  return map;
}

function renderDiscographyTrackItem(
  track: GroupDiscographyTrackRef,
  songByUid: Map<string, Record<string, unknown>>,
  lang: UiLanguage,
): string {
  const linked = Boolean(track.songUid && songByUid.has(track.songUid));
  const song = linked ? songByUid.get(track.songUid!)! : null;
  const preview = song
    ? renderSongPreviewControls(song, lang)
    : `<span class="song-preview-na content-muted" title="${htmlEsc(lang === "zh-CN" ? "曲库中无此曲" : "Not in song catalog")}">—</span>`;
  const originUid = String(track.originGroupUid ?? "").trim();
  const originName = String(track.originGroupName ?? "").trim();
  const showOrigin = Boolean(originUid && originName);
  const originOpenAttrs = showOrigin
    ? ` data-open-songs-for-group="${encodeURIComponent(originUid)}"${
        track.songUid ? ` data-open-songs-song="${htmlEsc(track.songUid)}"` : ""
      }`
    : "";
  const titleButton = linked
    ? showOrigin
      ? `<button type="button" class="songs-discography-track-link"${originOpenAttrs}>${htmlEsc(track.title)}</button>`
      : `<button type="button" class="songs-discography-track-link" data-song-detail="${htmlEsc(track.songUid!)}">${htmlEsc(track.title)}</button>`
    : `<span class="songs-discography-track-placeholder">${htmlEsc(track.title)}</span>`;
  const originHtml = showOrigin
    ? `<span class="songs-discography-track-origin"> - <button type="button" class="songs-discography-track-origin-link"${originOpenAttrs} data-wiki-skip="1">${htmlEsc(originName)}</button></span>`
    : "";
  const titleHtml = `${titleButton}${originHtml}`;
  return `<li class="songs-discography-track-item"><span class="songs-discography-track-preview">${preview}</span><span class="songs-discography-track-title">${titleHtml}</span></li>`;
}

function renderSongDetailPanel(
  song: Record<string, unknown> | null | undefined,
  lang: UiLanguage,
): string {
  if (!song) return "";
  const title = songCatalogDisplayLabel(song);
  const romanji = String(song.title_romanji ?? "").trim() || "—";
  const release = String(song.release_date ?? "").split("T")[0].trim() || "—";
  const genre = String(song.genre ?? "").trim() || "—";
  const composer = String(song.composer ?? "").trim() || "—";
  const lyricist = String(song.lyricist ?? "").trim() || "—";
  const arrangement = String(song.arrangement ?? "").trim() || "—";
  const version = String(song.version ?? "").trim() || "—";
  const description = String(song.description ?? "").trim() || "—";
  const pop = songPopularityNum(song);
  const albums = Array.isArray(song.albums) ? song.albums : [];
  const albumLines = albums.length
    ? albums
        .map((raw) => {
          if (!raw || typeof raw !== "object") return "";
          const o = raw as Record<string, unknown>;
          const name = String(o.name ?? "").trim() || "—";
          const tn = o.track_number;
          return tn != null && String(tn).trim() !== ""
            ? `<li>${htmlEsc(`${name} (Track ${tn})`)}</li>`
            : `<li>${htmlEsc(name)}</li>`;
        })
        .filter(Boolean)
        .join("")
    : `<li class="content-muted">${htmlEsc(lang === "zh-CN" ? "暂无关联发行" : "No linked releases")}</li>`;
  return `
    <div class="fm-card songs-song-detail">
      <div class="songs-song-detail-head">
        <div>
          <h3 class="content-h3">${htmlEsc(title)}</h3>
          <p class="content-muted songs-song-detail-meta">${htmlEsc(
            lang === "zh-CN" ? `人气 ${pop} · 发行 ${release}` : `Popularity ${pop} · Release ${release}`,
          )}</p>
        </div>
        <div class="songs-song-detail-actions">
          ${renderSongPreviewControls(song, lang)}
          <button type="button" class="fm-btn fm-btn-xs" data-song-detail-close="1">${htmlEsc(lang === "zh-CN" ? "关闭" : "Close")}</button>
        </div>
      </div>
      <dl class="songs-song-detail-facts">
        <div><dt>${htmlEsc(localizedLiteral(lang, "Romanji", "罗马字"))}</dt><dd>${htmlEsc(romanji)}</dd></div>
        <div><dt>${htmlEsc(localizedLiteral(lang, "Genre", "曲风"))}</dt><dd>${htmlEsc(genre)}</dd></div>
        <div><dt>${htmlEsc(localizedLiteral(lang, "Composer", "作曲"))}</dt><dd>${htmlEsc(composer)}</dd></div>
        <div><dt>${htmlEsc(localizedLiteral(lang, "Lyricist", "作词"))}</dt><dd>${htmlEsc(lyricist)}</dd></div>
        <div><dt>${htmlEsc(localizedLiteral(lang, "Arrangement", "编曲"))}</dt><dd>${htmlEsc(arrangement)}</dd></div>
        <div><dt>${htmlEsc(localizedLiteral(lang, "Version", "版本"))}</dt><dd>${htmlEsc(version)}</dd></div>
      </dl>
      <div class="songs-song-detail-albums">
        <h4 class="content-h4">${htmlEsc(lang === "zh-CN" ? "关联发行" : "Linked releases")}</h4>
        <ul>${albumLines}</ul>
      </div>
      <p class="content-muted songs-song-detail-desc">${htmlEsc(
        lang === "zh-CN" ? `简介：${description}` : `Description: ${description}`,
      )}</p>
    </div>`;
}

function renderDiscographyPanel(
  buckets: DiscBucket[],
  selectedKey: string | null,
  groupDiscographyRows?: GroupDiscographyReleaseRow[] | null,
  catalogSongs: readonly Record<string, unknown>[] = [],
  lang: UiLanguage = "en",
): string {
  const curatedRows = Array.isArray(groupDiscographyRows) ? groupDiscographyRows : [];
  const songByUid = songMapByUid(catalogSongs);
  if (curatedRows.length) {
    const eff = resolveGroupDiscographyKey(curatedRows, selectedKey);
    const rowsHtml = curatedRows
      .map((item) => {
        const isVideo = item.selectable === false;
        if (isVideo) {
          return `<tr class="songs-discography-row is-video" aria-disabled="true">
          <td>${htmlEsc(item.title)}</td><td class="num">${htmlEsc(item.releaseDate)}</td><td>${htmlEsc(item.discType)}</td><td class="num">${item.trackCount > 0 ? item.trackCount.toLocaleString("ja-JP") : "—"}</td>
        </tr>`;
        }
        const sel = item.key === eff ? " is-selected" : "";
        return `<tr class="songs-discography-row${sel}" data-songs-discography-key="${encodeURIComponent(item.key)}" tabindex="0" role="button">
          <td>${htmlEsc(item.title)}</td><td class="num">${htmlEsc(item.releaseDate)}</td><td>${htmlEsc(item.discType)}</td><td class="num">${item.trackCount.toLocaleString("ja-JP")}</td>
        </tr>`;
      })
      .join("");
    const selectedRow = curatedRows.find((item) => item.key === eff && item.selectable !== false) ?? null;
    const trackSectionHtml = selectedRow?.trackSections.length
      ? selectedRow.trackSections
          .map(
            (section) => `
              <section class="songs-discography-track-section">
                <h4 class="content-h4">${htmlEsc(section.label)}</h4>
                <ol class="songs-discography-track-list">
                  ${section.tracks.map((track) => renderDiscographyTrackItem(track, songByUid, lang)).join("")}
                </ol>
              </section>`,
          )
          .join("")
      : "";
    const detailTitle = selectedRow?.title ?? (lang === "zh-CN" ? "选择一张单曲或专辑" : "Select a single or album");
    const meta = selectedRow
      ? `<p class="content-muted songs-discography-meta">${htmlEsc(
          `Release: ${selectedRow.releaseDate} · Type: ${selectedRow.discType} · ${selectedRow.trackCount.toLocaleString()} track(s)`,
        )}</p>`
      : `<p class="content-muted songs-discography-meta">${htmlEsc(
          lang === "zh-CN"
            ? "单曲和专辑可点选查看曲目；影像盘仅作目录附加项，不可点选。"
            : "Singles and albums are selectable for track lists. Video discs are listed for catalog only and are not clickable.",
        )}</p>`;
    return `
      <div class="songs-discography-layout">
        <div class="fm-card songs-discography-list">
          <h3 class="content-h3">${htmlEsc("Discography")}</h3>
          <p class="content-muted">${htmlEsc(
            lang === "zh-CN"
              ? "单曲 / 专辑为主结构。影像盘列在目录中作为附加项，不可点选。"
              : "Singles and albums are the main structure. Video discs appear in the list as additional catalog rows and are not clickable.",
          )}</p>
          <div class="table-scroll">
            <table class="fm-table songs-discography-table">
              <thead><tr><th>Title</th><th>Release</th><th>Type</th><th>Tracks</th></tr></thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
        <div class="fm-card songs-discography-tracks">
          <h3 class="content-h3">${htmlEsc(detailTitle)}</h3>
          ${meta}
          ${
            selectedRow
              ? trackSectionHtml ||
                `<p class="content-muted">${htmlEsc(
                  selectedRow.trackCount > 0
                    ? "Track-count metadata is available for this release in the group catalog."
                    : "Track-level details are not stored on this release row yet, but the release is still kept in the catalog for scheduling and overview.",
                )}</p>`
              : `<p class="content-muted">${htmlEsc(
                  lang === "zh-CN" ? "没有可点选的单曲或专辑。" : "No selectable singles or albums in this catalog.",
                )}</p>`
          }
        </div>
      </div>`;
  }
  if (!buckets.length) {
    return `<p class="content-muted">${htmlEsc("No releases inferred from song rows for this group yet.")}</p>`;
  }
  const eff = resolveDiscographyBucketKey(buckets, selectedKey);
  const bucket = buckets.find((b) => b.key === eff) ?? buckets[0]!;
  const discRows = buckets
    .map((b) => {
      const sel = b.key === eff ? " is-selected" : "";
      const rel = bucketEarliestRelease(b.songs);
      const typ = bucketRepresentativeDiscType(b.songs);
      return `<tr class="songs-discography-row${sel}" data-songs-discography-key="${encodeURIComponent(b.key)}" tabindex="0" role="button">
        <td>${htmlEsc(b.label)}</td><td class="num">${htmlEsc(rel)}</td><td>${htmlEsc(typ)}</td><td class="num">${b.songs.length.toLocaleString("ja-JP")}</td>
      </tr>`;
    })
    .join("");
  const tracks = songRowsHtml(bucket.songs, "pair", "released", "en");
  const rel0 = bucketEarliestRelease(bucket.songs);
  const typ0 = bucketRepresentativeDiscType(bucket.songs);
  const meta = `<p class="content-muted songs-discography-meta">${htmlEsc(
    `Release: ${rel0} · Type: ${typ0} · ${bucket.songs.length.toLocaleString()} track(s)`,
  )}</p>`;
  return `
    <div class="songs-discography-layout">
      <div class="fm-card songs-discography-list">
        <h3 class="content-h3">${htmlEsc("Discography")}</h3>
        <p class="content-muted">${htmlEsc("Singles and albums from the catalog. Select a release to see tracks.")}</p>
        <div class="table-scroll">
          <table class="fm-table songs-discography-table">
            <thead><tr><th>Title</th><th>Release</th><th>Type</th><th>Tracks</th></tr></thead>
            <tbody>${discRows}</tbody>
          </table>
        </div>
      </div>
      <div class="fm-card songs-discography-tracks">
        <h3 class="content-h3">${htmlEsc(bucket.label)}</h3>
        ${meta}
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Title</th><th>Romanji</th><th>Preview</th><th>Release</th><th>Type</th><th>Disc</th><th>Pop</th></tr></thead>
            <tbody>${tracks || `<tr><td colspan="7" class="content-muted">—</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

interface SongsRenderOpts {
  lang?: UiLanguage;
  subtitle?: string;
  groups: Record<string, unknown>[];
  sharedReleases?: Record<string, unknown>[] | null;
  selectedGroupUid: string;
  selectedWorkspaceTab: SongsWorkspaceTab;
  selectedDiscographyKey: string | null;
  /** Selected song uid for the Songs detail panel (desktop song tab). */
  selectedSongUid?: string | null;
  /** Game / browse “today” for released vs future / undated (`YYYY-MM-DD`). */
  catalogReferenceIso: string | null;
  /**
   * `songs` = main Songs nav (released-only when catalog splits; in-production list under Making).
   * `making` = main Making nav (workshop table: no release/pop; disc text field; Arrange / Release).
   */
  trackSplitSurface?: "songs" | "making";
  /** When `trackSplitSurface` is `making`, lock catalog to this group (managed production). */
  managedGroupUid?: string | null;
}

/** Songs workspace: group picker, Songs | Discography tabs (desktop `main_ui.py`), tables. */
function renderSongsList(allSongs: Record<string, unknown>[], opts?: SongsRenderOpts): string {
  const surface = opts?.trackSplitSurface ?? "songs";
  const lang = opts?.lang ?? "en";
  const pageTitle = surface === "making" ? localizedLiteral(lang, "Making", "制作") : localizedLiteral(lang, "Songs", "歌曲");
  const managedUid = opts?.managedGroupUid?.trim() ?? "";

  if (!allSongs.length) return renderPlaceholder(pageTitle, localizedLiteral(lang, "No songs in <code>songs.json</code>.", "<code>songs.json</code> 中没有歌曲。"));
  if (!opts?.groups?.length) {
    return renderPlaceholder(pageTitle, localizedLiteral(lang, "No groups in snapshot for song directory.", "歌曲目录快照中没有组合数据。"));
  }
  if (surface === "making" && !managedUid) {
    return renderPlaceholder(pageTitle, localizedLiteral(lang, "No managed group on this save.", "该存档没有当前经营组合。"));
  }

  const effectiveGid = surface === "making" && managedUid ? managedUid : String(opts.selectedGroupUid ?? "").trim();
  if (!effectiveGid) {
    return renderPlaceholder(pageTitle, localizedLiteral(lang, "No groups in snapshot for song directory.", "歌曲目录快照中没有组合数据。"));
  }

  const ordered = songsForDisplaySorted(allSongs);
  const gid = effectiveGid;
  const groupRow =
    opts.groups.find((row) => String((row as { uid?: unknown }).uid ?? "").trim() === gid) ?? null;
  const teamSongs = ordered.filter((row) => String(row.group_uid ?? "") === gid);
  const { released: releasedTeam, making: makingTeam } = splitSongsReleasedVsMaking(
    teamSongs,
    opts.catalogReferenceIso,
  );
  const buckets = buildDiscBuckets(teamSongs);
  // Full catalog so compilation discs (e.g. HEROINES ALBUM) can resolve other groups' tracks + previews.
  const groupDiscographyRows = buildGroupDiscographyReleaseRows(
    groupRow,
    opts.catalogReferenceIso,
    opts.sharedReleases ?? [],
    ordered,
  );
  const selectedSongUid = String(opts.selectedSongUid ?? "").trim() || null;
  const selectedSong =
    selectedSongUid != null
      ? ordered.find((row) => String(row.uid ?? "").trim() === selectedSongUid) ?? null
      : null;
  const ws: SongsWorkspaceTab =
    surface === "making" ? "group_songs" : opts.selectedWorkspaceTab === "disc" ? "disc" : "group_songs";

  const refShort = opts.catalogReferenceIso ? String(opts.catalogReferenceIso).trim().split("T")[0] : "";
  const hasRef = Boolean(refShort && /^\d{4}-\d{2}-\d{2}$/.test(refShort));
  const catalogSplitsFuture = hasRef && makingTeam.length > 0;

  const sub = opts.subtitle ? `<p class="content-muted">${htmlEsc(opts.subtitle)}</p>` : "";
  const toolbar =
    surface === "making" && managedUid
      ? renderMakingManagedGroupBar(opts.groups, managedUid)
      : renderSongsGroupDropdown(opts.groups, gid, opts.managedGroupUid ?? null);

  if (surface === "making") {
    const workshopRows = hasRef ? makingTeam : teamSongs;
    let workshopTbody: string;
    if (!teamSongs.length) {
      workshopTbody = `<tr><td colspan="5" class="content-muted">${htmlEsc(localizedLiteral(lang, "No tracks for this group in snapshot.", "该组合在快照中没有歌曲。"))}</td></tr>`;
    } else if (hasRef && makingTeam.length === 0) {
      workshopTbody = `<tr><td colspan="5" class="content-muted">${htmlEsc(lang === "zh-CN" ? `截至 ${refShort} 没有未来或未定日期的歌曲，该日期下所有歌曲都已进入发行目录。已发行列表请到侧边栏的“歌曲”查看。` : `No future or undated tracks as of ${refShort} — everything is released in the catalog for this date. Use Songs in the sidebar for the released list.`)}</td></tr>`;
    } else {
      workshopTbody = makingWorkshopRowsHtml(workshopRows, opts.catalogReferenceIso);
    }

    const explMaking = `<p class="content-muted">${htmlEsc(
      !teamSongs.length
        ? localizedLiteral(lang, "No tracks for this group in snapshot.", "该组合在快照中没有歌曲。")
        : hasRef
          ? makingTeam.length > 0
            ? lang === "zh-CN"
              ? `${makingTeam.length.toLocaleString()} 首制作中的歌曲（未设发行日或发行日在 ${refShort} 之后）可在这里编排；需要数字发行时使用“数字发行”。实体单曲和专辑请在 CD 标签中制作。`
              : `${makingTeam.length.toLocaleString()} in-production track(s) (no release date or after ${refShort}) · arrange them here, and use Release digital when you want the song out digitally. Build physical singles and albums in the CD tab.`
            : lang === "zh-CN"
              ? `参考日期 ${refShort}：该组合没有制作中歌曲。`
              : `Reference ${refShort}: no in-production bucket for this group.`
          : lang === "zh-CN"
            ? `${teamSongs.length.toLocaleString()} 首歌曲；存档还没有参考日期，因此以数字制作工坊布局显示全组合列表。`
            : `${teamSongs.length.toLocaleString()} track(s) — no reference date on save yet; showing full group list in the digital workshop layout.`,
    )}</p>`;

    const songsPanel = `
      ${explMaking}
      <div class="table-scroll">
        <table class="fm-table songs-making-workshop-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romanji", "罗马字"))}</th><th>${htmlEsc(localizedLiteral(lang, "Digital", "数字发行"))}</th><th>${htmlEsc(localizedLiteral(lang, "Actions", "操作"))}</th></tr></thead>
          <tbody>${workshopTbody}</tbody>
        </table>
      </div>`;

    return `
    <section class="content-panel songs-view making-track-view">
      <h2 class="content-h2">${htmlEsc(pageTitle)}</h2>
      ${sub}
      ${toolbar}
      ${renderMakingTabs("songs", lang)}
      ${songsPanel}
    </section>`;
  }

  let mainTrackBodies: string;
  const discLookup = { curatedRows: groupDiscographyRows, buckets };
  if (!teamSongs.length) {
    mainTrackBodies = `<tbody><tr><td colspan="7" class="content-muted">${htmlEsc(localizedLiteral(lang, "No tracks for this group in snapshot.", "该组合在快照中没有歌曲。"))}</td></tr></tbody>`;
  } else if (!catalogSplitsFuture) {
    mainTrackBodies = `<tbody>${songRowsHtml(teamSongs, "pair", "released", lang, selectedSongUid, discLookup)}</tbody>`;
  } else {
    const inner =
      releasedTeam.length > 0
        ? songRowsHtml(releasedTeam, "pair", "released", lang, selectedSongUid, discLookup)
        : `<tr><td colspan="7" class="content-muted">${htmlEsc(localizedLiteral(lang, "No tracks released as of this date - open Making in the sidebar (between Songs and Media) for in-production tracks.", "该日期尚无已发行歌曲；请打开侧边栏“制作”（位于歌曲与媒体之间）查看制作中曲目。"))}</td></tr>`;
    mainTrackBodies = `<tbody>${inner}</tbody>`;
  }

  const workspaceTabs = renderSongsWorkspaceTabs(ws, lang);

  const explSongs = `<p class="content-muted">${htmlEsc(
    !teamSongs.length
      ? localizedLiteral(lang, "No tracks for this group in snapshot.", "该组合在快照中没有歌曲。")
      : catalogSplitsFuture
        ? lang === "zh-CN"
          ? `截至 ${refShort} 已发行 ${releasedTeam.length.toLocaleString()} 首，制作中 ${makingTeam.length.toLocaleString()} 首；制作中歌曲请到侧边栏的“制作”查看。`
          : `${releasedTeam.length.toLocaleString()} released (as of ${refShort}). ${makingTeam.length.toLocaleString()} in production - open Making in the sidebar (between Songs and Media).`
        : hasRef
          ? lang === "zh-CN"
            ? `截至 ${refShort} 已发行 ${releasedTeam.length.toLocaleString()} 首，没有制作中条目。`
            : `${releasedTeam.length.toLocaleString()} released (as of ${refShort}) — no in-production entries.`
          : lang === "zh-CN"
            ? `${teamSongs.length.toLocaleString()} 首歌曲，按人气从高到低排序（设置参考日期后可按发行日期拆分目录）。`
            : `${teamSongs.length.toLocaleString()} track(s) · popularity high → low (set a reference date to split catalog by release date).`,
  )}</p>`;
  const explDisc = `<p class="content-muted">${htmlEsc(
    groupDiscographyRows.length
      ? lang === "zh-CN"
        ? `组合目录中共有 ${groupDiscographyRows.length.toLocaleString()} 条发行记录。`
        : `${groupDiscographyRows.length.toLocaleString()} release row(s) from the group catalog.`
      : lang === "zh-CN"
        ? `根据歌曲记录推导出 ${buckets.length.toLocaleString()} 个发行分组。`
        : `${buckets.length.toLocaleString()} release bucket(s) · derived from song rows.`,
  )}</p>`;

  const budget = SONG_EXPAND_ALL_LIMIT;
  const expReleased = releasedTeam.slice(0, budget);
  const expMaking = makingTeam.slice(0, Math.max(0, budget - expReleased.length));
  const expBodies =
    teamSongs.length === 0
      ? `<tbody><tr><td colspan="8" class="content-muted">—</td></tr></tbody>`
      : renderSongsTrackTableBodies(
          expReleased,
          expMaking,
          opts.catalogReferenceIso,
          "full",
          "No released rows in this preview window.",
          lang,
          selectedSongUid,
          discLookup,
        );
  const truncated =
    releasedTeam.length > expReleased.length || makingTeam.length > expMaking.length
      ? `<p class="content-muted">${htmlEsc(
          lang === "zh-CN"
            ? `预览最多显示 ${SONG_EXPAND_ALL_LIMIT} 行（先已发行，再未来 / 制作中歌曲）。该组合共 ${teamSongs.length.toLocaleString()} 首歌曲。`
            : `Preview capped at ${SONG_EXPAND_ALL_LIMIT} rows (released first, then Songs / future). Full group has ${teamSongs.length.toLocaleString()} track(s).`,
        )}</p>`
      : "";

  const songDetailHtml = renderSongDetailPanel(selectedSong, lang);
  const songsPanel = `
      ${explSongs}
      ${songDetailHtml}
      <div class="table-scroll">
        <table class="fm-table songs-main-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romanji", "罗马字"))}</th><th>${htmlEsc(localizedLiteral(lang, "Preview", "试听"))}</th><th>${htmlEsc(localizedLiteral(lang, "Release", "发行日"))}</th><th>${htmlEsc(localizedLiteral(lang, "Type", "类型"))}</th><th>${htmlEsc(localizedLiteral(lang, "Disc", "载体"))}</th><th>${htmlEsc(localizedLiteral(lang, "Pop", "人气"))}</th></tr></thead>
          ${mainTrackBodies}
        </table>
      </div>
      <details class="fm-card songs-expand">
        <summary class="content-h3 songs-expand-sum">${htmlEsc(lang === "zh-CN" ? `本组合 · 全部歌曲（${teamSongs.length.toLocaleString()}）` : `This group — all tracks (${teamSongs.length.toLocaleString()})`)}</summary>
        ${truncated}
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romanji", "罗马字"))}</th><th>${htmlEsc(localizedLiteral(lang, "Preview", "试听"))}</th><th>${htmlEsc(localizedLiteral(lang, "Release", "发行日"))}</th><th>${htmlEsc(localizedLiteral(lang, "Type", "类型"))}</th><th>${htmlEsc(localizedLiteral(lang, "Disc", "载体"))}</th><th>${htmlEsc(localizedLiteral(lang, "Group", "组合"))}</th><th>${htmlEsc(localizedLiteral(lang, "Pop", "人气"))}</th></tr></thead>
            ${expBodies}
          </table>
        </div>
      </details>`;

  const discPanel = `${explDisc}${renderDiscographyPanel(
    buckets,
    opts.selectedDiscographyKey,
    groupDiscographyRows,
    ordered,
    lang,
  )}`;

  const body = ws === "disc" ? discPanel : songsPanel;

  return `
    <section class="content-panel songs-view">
      <h2 class="content-h2">${htmlEsc(pageTitle)}</h2>
      ${sub}
      ${toolbar}
      ${workspaceTabs}
      ${body}
    </section>`;
}

function groupFansNum(g: Record<string, unknown>): number {
  return typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
}

function groupPopNum(g: Record<string, unknown>): number {
  return typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
}

/** All groups sorted S→F, then descending fans (browse + management directory). */
function renderGroupsFullTable(
  groups: Record<string, unknown>[],
  subtitle: string,
  lang: UiLanguage,
  highlightUid?: string | null,
  songs?: Record<string, unknown>[] | null,
): string {
  const listed = groupsForDirectoryListing(groups);
  if (!listed.length) {
    return renderPlaceholder(
      localizedLiteral(lang, "Groups", "组合"),
      localizedLiteral(
        lang,
        "No groups in this list after filters (directory hides history-only slugs and groups with 0–1 current members). Full data remains in the snapshot for idol history.",
        "筛选后此列表中没有可显示的组合（目录会隐藏仅历史存在的组合，以及当前成员为 0 到 1 人的组合）。完整数据仍保留在快照中供偶像履历使用。",
      ),
    );
  }

  const songCount = buildSongCountByGroupUid(songs ?? undefined);
  const sorted = sortGroupsForDirectory(listed);
  const rows = sorted
    .map((g) => {
      const name = String(g.name ?? g.name_romanji ?? "—");
      const formed = typeof g.formed_date === "string" ? g.formed_date : "—";
      const tier = resolveGroupLetterTier(g);
      const fans = groupFansNum(g);
      const pop = groupPopNum(g);
      const uid = String(g.uid ?? "");
      const memNow =
        typeof g.member_count === "number" && Number.isFinite(g.member_count)
          ? g.member_count
          : Array.isArray(g.member_uids)
            ? g.member_uids.length
            : 0;
      const past =
        typeof g.past_member_count === "number" && Number.isFinite(g.past_member_count)
          ? g.past_member_count
          : Array.isArray(g.past_member_uids)
            ? g.past_member_uids.length
            : 0;
      const memPast = `${memNow} (${past})`;
      const songN = uid ? songCount.get(uid) ?? 0 : 0;
      const rowClass = [
        "group-dir-row",
        highlightUid && uid === highlightUid ? "is-managed-row" : "",
        uid ? "" : "group-dir-row-nolink",
      ]
        .filter(Boolean)
        .join(" ");
      const rowAttr = uid ? ` data-group-detail="${htmlEsc(uid)}"` : "";
      return `<tr class="${htmlEsc(rowClass)}"${rowAttr}><td>${htmlEsc(name)}</td><td class="num">${htmlEsc(memPast)}</td><td class="num">${songN.toLocaleString("ja-JP")}</td><td class="num">${fans.toLocaleString("ja-JP")}</td><td class="num">${pop}</td><td>${htmlEsc(tier)}</td><td>${htmlEsc(formed)}</td></tr>`;
    })
    .join("");

  return `
    <section class="content-panel groups-view">
      <h2 class="content-h2">${htmlEsc(localizedLiteral(lang, "Groups", "组合"))}</h2>
      <p class="content-muted">${htmlEsc(subtitle)}</p>
      <div class="table-scroll">
        <table class="fm-table groups-sort-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Group", "组合"))}</th><th>${htmlEsc(localizedLiteral(lang, "Members (past)", "成员（既往）"))}</th><th>${htmlEsc(localizedLiteral(lang, "Songs", "歌曲"))}</th><th>${htmlEsc(localizedLiteral(lang, "Fans", "粉丝"))}</th><th>${htmlEsc(localizedLiteral(lang, "Popularity", "人气"))}</th><th>${htmlEsc(localizedLiteral(lang, "Tier", "等级"))}</th><th>${htmlEsc(localizedLiteral(lang, "Formed", "成立时间"))}</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="content-muted">${htmlEsc(localizedLiteral(lang, "Songs = per-track rows from data/songs.json (filtered to scenario groups), by group_uid; display excludes hidden titles and sorts by popularity. Tier inferred when letter_tier missing.", "歌曲 = 来自 data/songs.json 的曲目行（已按剧本组合过滤），按 group_uid 归类；显示会排除隐藏曲名并按人气排序。若缺少 letter_tier 则推断档位。"))}</p>
    </section>`;
}

function renderGroupsManaged(save: GameSavePayload, lang: UiLanguage): string {
  const uid = save.managing_group_uid;
  const grp = getPrimaryGroup(save);
  const label =
    typeof grp?.name_romanji === "string"
      ? grp.name_romanji
      : typeof grp?.name === "string"
        ? grp.name
        : uid?.slice(0, 12) ?? "—";
  return renderGroupsFullTable(
    save.database_snapshot.groups,
    localizedLiteral(lang, `Managed: ${label}. Highlighted row = your roster.`, `当前经营：${label}。高亮行为你的阵容。`),
    lang,
    uid,
    save.database_snapshot.songs,
  );
}

/** Browse roster: all groups snapshot, tier then fans descending. */
function renderBrowseGroups(data: LoadedScenario, lang: UiLanguage): string {
  return renderGroupsFullTable(
    data.groups,
    localizedLiteral(
      lang,
      `Browse · scenario ${data.preset?.name ?? "?"}. Sorted best letter tier first, then descending fans.`,
      `浏览模式 · 剧本 ${data.preset?.name ?? "?"}。按等级从高到低、再按粉丝数从多到少排序。`,
    ),
    lang,
    null,
    data.songs,
  );
}

function renderLiveTypeSelectOptions(lang: UiLanguage, selected: string, types: readonly string[]): string {
  return types
    .map((type) => {
      const sel = type === selected ? "selected" : "";
      return `<option value="${htmlEsc(type)}" ${sel}>${htmlEsc(liveTypeLabel(lang, type))}</option>`;
    })
    .join("");
}

function renderMediaTabs(active: MediaTab, lang: UiLanguage): string {
  const tabs: MediaTab[] = ["tv", "live_events", "radio", "books", "online"];
  return `<div class="workspace-tabs media-tabs">${tabs
    .map(
      (tab) =>
        `<button type="button" class="workspace-tab ${active === tab ? "is-active" : ""}" data-media-tab="${htmlEsc(tab)}">${htmlEsc(localizedMediaTabLabel(lang, tab))}</button>`,
    )
    .join("")}</div>`;
}

function renderOfficialScheduleMembers(
  event: OfficialScheduleEvent,
  bundle: OfficialScheduleBundle | null,
  idols: Record<string, unknown>[],
  lang: UiLanguage,
): string {
  const members = officialScheduleMembers(event, bundle);
  if (!members.length) return htmlEsc(localizedLiteral(lang, "Group", "组合"));
  const idolMap = new Map<string, string>();
  for (const row of idols) {
    const uid = String((row as { uid?: unknown }).uid ?? "").trim();
    if (!uid) continue;
    for (const key of [
      String((row as { name?: unknown }).name ?? "").trim(),
      String((row as { name_romanji?: unknown }).name_romanji ?? "").trim(),
      String((row as { nickname?: unknown }).nickname ?? "").trim(),
    ]) {
      if (key) idolMap.set(key.normalize("NFKC"), uid);
    }
  }
  return members
    .map((name) => {
      const uid = idolMap.get(name.normalize("NFKC"));
      return uid
        ? `<button type="button" class="text-action-btn" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(name)}</button>`
        : htmlEsc(name);
    })
    .join(", ");
}

function renderOfficialScheduleLink(event: OfficialScheduleEvent): string {
  const url = officialScheduleLink(event);
  const label = String(event.event ?? "").trim() || "Detail";
  if (!url) return htmlEsc(label);
  return `<a class="text-action-link" href="${htmlEsc(url)}" target="_blank" rel="noopener noreferrer">${htmlEsc(label)}</a>`;
}

function renderSchedule(
  save: GameSavePayload | null,
  bundle: OfficialScheduleBundle | null,
  scheduleCalendarMonthStart: string | null,
  scheduleWeekAnchorIso: string | null,
  lang: UiLanguage,
): string {
  if (!save) {
    return `<section class="content-panel schedule-view"><p class="content-muted">${htmlEsc(localizedLiteral(lang, "No save loaded.", "未载入存档。"))}</p></section>`;
  }
  const gameStart = save.game_start_date ?? save.scenario_context?.startup_date ?? "2020-01-01";
  const cur = save.current_date ?? gameStart;
  const turn = typeof save.turn_number === "number" ? save.turn_number : 0;
  const nextIso = addCalendarDays(cur, 1);

  const schedulesList = (save.lives?.schedules ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  const resultsList = (save.lives?.results ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  const mediaEvents = sortOfficialScheduleEvents(officialScheduleEvents(bundle))
    .filter((event) => classifyOfficialMediaTab(event) !== null)
    .filter((event) => officialScheduleDate(event) >= String(cur).split("T")[0]);
  const gs = typeof gameStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(gameStart) ? gameStart : "2020-01-01";
  const anchor = scheduleCalendarMonthStart ?? startOfUtcMonthIso(nextIso);
  const calHtml = buildScheduleMonthCalendarHtml(anchor, {
    gameStart: gs,
    cur: String(cur).split("T")[0],
    nextIso,
    selectedWeekAnchorIso: scheduleWeekAnchorIso,
    schedules: schedulesList,
    results: resultsList,
    mediaEvents,
    lang,
  });

  const weekAnchorIso = scheduleWeekAnchorIso && /^\d{4}-\d{2}-\d{2}$/.test(scheduleWeekAnchorIso) ? scheduleWeekAnchorIso : nextIso;
  const weekDays = 7;
  const cells: string[] = [];
  for (let i = 0; i < weekDays; i++) {
    const iso = addCalendarDays(weekAnchorIso, i);
    const dow = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const isTodayish = iso === weekAnchorIso;
    const schedules = save.lives?.schedules;
    const liveItems = Array.isArray(schedules)
      ? schedules.filter((s) => {
          if (!s || typeof s !== "object") return false;
          const sd = String((s as { start_date?: unknown }).start_date ?? "").split("T")[0];
          return sd === iso;
        })
      : [];
    const dayMedia = mediaEvents.filter((event) => officialScheduleDate(event) === iso);
    const extraLbl =
      liveItems.length > 0
        ? liveItems
            .map((s) => {
              const o = s as Record<string, unknown>;
              const typ = liveTypeLabel(lang, String(o.live_type ?? o.event_type ?? "Event"));
              const vn = String(o.venue ?? "").trim();
              return vn ? `${typ} @ ${vn}` : typ;
            })
            .join(", ")
        : "";
    const mediaLbl =
      dayMedia.length > 0
        ? dayMedia
            .slice(0, 2)
            .map((event) => `${localizedMediaTabLabel(lang, classifyOfficialMediaTab(event)!)}: ${String(event.event ?? "").trim()}`)
            .join(", ")
        : "";

    cells.push(`<div class="schedule-cell ${isTodayish ? "is-next" : ""}${liveItems.length > 0 ? " has-live" : ""}${dayMedia.length > 0 ? " has-media" : ""}">
      <div class="schedule-cell-dow">${htmlEsc(dow)}</div>
      <div class="schedule-cell-date">${htmlEsc(iso)}</div>
      <div class="schedule-cell-body">
        ${
          liveItems.length > 0
            ? `<span class="schedule-pill schedule-pill-live">${htmlEsc(lang === "zh-CN" ? `${liveItems.length} 场已排期公演` : `${liveItems.length} scheduled live${liveItems.length === 1 ? "" : "s"}`)}</span>`
            : `<span class="schedule-pill">${htmlEsc("-")}</span>`
        }
        ${dayMedia.length > 0 ? `<span class="schedule-pill schedule-pill-media">${htmlEsc(lang === "zh-CN" ? `${dayMedia.length} 条媒体行程` : `${dayMedia.length} media item${dayMedia.length === 1 ? "" : "s"}`)}</span>` : ""}
        ${extraLbl ? `<div class="schedule-extra">${htmlEsc(extraLbl)}</div>` : ""}
        ${mediaLbl ? `<div class="schedule-extra schedule-extra-media">${htmlEsc(mediaLbl)}</div>` : ""}
      </div>
    </div>`);
  }

  const recentResults = [...(save.lives?.results ?? [])].slice(-5).reverse();
  const resRows = recentResults
    .map((raw) => {
      if (!raw || typeof raw !== "object") return "";
      const r = raw as Record<string, unknown>;
      const d = String(r.date ?? "").split("T")[0];
      const perf = r.performance_score != null ? String(r.performance_score) : "—";
      const aud = r.audience_satisfaction != null ? String(r.audience_satisfaction) : "—";
      const fans = r.fan_gain != null ? String(r.fan_gain) : "—";
      const att = r.attendance != null ? String(r.attendance) : "—";
      return `<tr><td>${htmlEsc(d)}</td><td class="num">${htmlEsc(perf)}</td><td class="num">${htmlEsc(aud)}</td><td class="num">${htmlEsc(fans)}</td><td class="num">${htmlEsc(att)}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  const mediaRows = mediaEvents
    .slice(0, 18)
    .map((event) => {
      const date = officialScheduleDate(event);
      const scope = officialScheduleScopeLabel(event, bundle);
      const venue = officialScheduleVenueLabel(event);
      const classified = classifyOfficialMediaTab(event);
      const tab = classified ? localizedMediaTabLabel(lang, classified) : "-";
      return `<tr>
        <td>${htmlEsc(date)}</td>
        <td>${htmlEsc(tab)}</td>
        <td>${renderOfficialScheduleLink(event)}</td>
        <td>${renderOfficialScheduleMembers(event, bundle, save.database_snapshot.idols, lang)}</td>
        <td>${htmlEsc(scope)}</td>
        <td>${htmlEsc(venue)}</td>
      </tr>`;
    })
    .join("");
  const hasOfficialFutureEvents = Boolean(bundle && officialScheduleEvents(bundle).length);
  const weekLead = hasOfficialFutureEvents
    ? localizedLiteral(lang, "Official future-event data is loaded for this group. Real concerts and festivals are seeded into Lives, and media / appearance items are listed below.", "已载入该组合的官方未来活动数据。真实演唱会与节日活动会写入公演，媒体 / 出演项目列于下方。")
    : localizedLiteral(lang, "Default lives are auto-booked from the monthly live-count reference for your letter tier. Use NEXT DAY in the top bar to progress, and confirm month-end Operations prompts when you want the following month after next booked automatically.", "默认公演会按你的字母档位的每月场次参考自动排期。用顶栏“下一步”推进，并在想自动预约再下个月时确认月末运营提示。");

  return `
    <section class="content-panel schedule-view">
      <h2 class="content-h2">${htmlEsc(localizedLiteral(lang, "Schedule", "日程"))}</h2>
      <p class="content-lead">${htmlEsc(localizedLiteral(lang, "Last closed day:", "最近结算日："))} <strong>${htmlEsc(String(cur))}</strong> - ${htmlEsc(localizedLiteral(lang, "Next simulation day:", "下一模拟日："))} <strong>${htmlEsc(nextIso)}</strong> - ${htmlEsc(localizedLiteral(lang, "Turn", "回合"))} <strong>${htmlEsc(String(turn))}</strong></p>
      <section class="fm-card schedule-calendar-card">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Calendar", "月历"))}</h3>
        <p class="content-muted">${htmlEsc(localizedLiteral(lang, "UTC month grid. Use arrows to change month; double-click a day to show that week below; Current Week jumps back to the week of your next simulation day.", "UTC 月历网格。用箭头切换月份；双击某一天可在下方显示该周；“本周”会跳回下一模拟日所在周。"))}</p>
        ${calHtml}
      </section>
      <section class="fm-card schedule-teaser">
        <h3 class="content-h3">${htmlEsc(lang === "zh-CN" ? `${weekAnchorIso} 当周` : `Week of ${weekAnchorIso}`)}</h3>
        <p class="content-muted">${htmlEsc(weekLead)}</p>
        <div class="schedule-week">${cells.join("")}</div>
      </section>
      <section class="fm-card">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Scheduled media", "已排期通告"))}</h3>
        <p class="content-muted">${htmlEsc(bundle ? localizedLiteral(lang, "Member-level future events are shown here when schedule data is available for the managed group.", "当经营组合有日程数据时，这里会显示成员级未来事件。") : localizedLiteral(lang, "No future-events database is loaded for this managed group yet.", "当前经营组合尚未载入未来行程数据库。"))}</p>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Tab", "分类"))}</th><th>${htmlEsc(localizedLiteral(lang, "Event", "活动"))}</th><th>${htmlEsc(localizedLiteral(lang, "Members", "成员"))}</th><th>${htmlEsc(localizedLiteral(lang, "Scope", "范围"))}</th><th>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</th></tr></thead>
            <tbody>${mediaRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(localizedLiteral(lang, "No scheduled media found.", "暂无已排期通告。"))}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="fm-card">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Recent live results", "最近公演结果"))}</h3>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Performance", "表现"))}</th><th>${htmlEsc(localizedLiteral(lang, "Audience", "观众满意度"))}</th><th>${htmlEsc(localizedLiteral(lang, "Fan Δ", "粉丝增减"))}</th><th>${htmlEsc(localizedLiteral(lang, "Attendance", "到场"))}</th></tr></thead>
            <tbody>${resRows || `<tr><td colspan="5" class="content-muted">${htmlEsc(localizedLiteral(lang, "No results yet.", "暂无结果。"))}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </section>`;
}

function renderMediaView(
  save: GameSavePayload,
  bundle: OfficialScheduleBundle | null,
  mediaTab: MediaTab,
  lang: UiLanguage,
): string {
  const managedGroup = getPrimaryGroup(save);
  const managedName = String(managedGroup?.name ?? save.managing_group ?? "Managed group");
  const events = sortOfficialScheduleEvents(officialScheduleEvents(bundle))
    .filter((event) => classifyOfficialMediaTab(event) === mediaTab);

  const rows = events
    .map((event) => {
      const date = officialScheduleDate(event);
      const venue = officialScheduleVenueLabel(event);
      const scope = officialScheduleScopeLabel(event, bundle);
      return `<tr>
        <td>${htmlEsc(date)}</td>
        <td>${renderOfficialScheduleLink(event)}</td>
        <td>${renderOfficialScheduleMembers(event, bundle, save.database_snapshot.idols, lang)}</td>
        <td>${htmlEsc(scope)}</td>
        <td>${htmlEsc(venue)}</td>
      </tr>`;
    })
    .join("");

  return `<section class="content-panel media-view">
    <h2 class="content-h2">${htmlEsc(localizedLiteral(lang, "Media", "通告"))}</h2>
    <p class="content-muted">${htmlEsc(bundle ? localizedLiteral(lang, `${managedName} future events are grouped here by media type when schedule data is available.`, `${managedName} 的未来通告会在有行程数据时按媒体类型归类显示在这里。`) : localizedLiteral(lang, `No future-events schedule data is loaded for ${managedName}.`, `${managedName} 尚未载入未来行程数据。`))}</p>
    ${renderMediaTabs(mediaTab, lang)}
    <section class="fm-card">
      <h3 class="content-h3">${htmlEsc(localizedMediaTabLabel(lang, mediaTab))}</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Event", "活动"))}</th><th>${htmlEsc(localizedLiteral(lang, "Members", "成员"))}</th><th>${htmlEsc(localizedLiteral(lang, "Scope", "范围"))}</th><th>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</th></tr></thead>
          <tbody>${rows || `<tr><td colspan="5" class="content-muted">${htmlEsc(lang === "zh-CN" ? `暂无已排期${localizedMediaTabLabel(lang, mediaTab)}项目。` : `No scheduled ${localizedMediaTabLabel(lang, mediaTab).toLowerCase()} items found.`)}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  </section>`;
}

function renderLiveTabs(active: LivesTab, lang: UiLanguage, showLeague: boolean): string {
  const tabs: Array<[LivesTab, string]> = [
    ["new", t(lang, "lives_tab_new")],
    ["scheduled", t(lang, "lives_tab_scheduled")],
    ["past", t(lang, "lives_tab_past")],
    ["festival", t(lang, "lives_tab_festival")],
  ];
  if (showLeague) tabs.push(["league", t(lang, "lives_tab_league")]);
  return `<div class="workspace-tabs lives-tabs">${tabs
    .map(
      ([key, label]) =>
        `<button type="button" class="workspace-tab ${active === key ? "is-active" : ""}" data-lives-tab="${htmlEsc(key)}">${htmlEsc(label)}</button>`,
    )
    .join("")}</div>`;
}

function renderScoutTabs(active: ScoutTab, lang: UiLanguage): string {
  const tabs: Array<[ScoutTab, string]> = [
    ["freelancer", t(lang, "scout_tab_freelancer")],
    ["transfer", t(lang, "scout_tab_transfer")],
    ["audition", t(lang, "scout_tab_audition")],
  ];
  return `<div class="workspace-tabs scout-tabs">${tabs
    .map(
      ([key, label]) =>
        `<button type="button" class="workspace-tab ${active === key ? "is-active" : ""}" data-scout-tab="${htmlEsc(key)}">${htmlEsc(label)}</button>`,
    )
    .join("")}</div>`;
}

function renderScoutCompanyTabs(companies: Array<{ uid: string; name: string }>, activeUid: string): string {
  return `<div class="workspace-tabs scout-company-tabs">${companies
    .map(
      (company) =>
        `<button type="button" class="workspace-tab ${company.uid === activeUid ? "is-active" : ""}" data-scout-company="${htmlEsc(company.uid)}">${htmlEsc(company.name)}</button>`,
    )
    .join("")}</div>`;
}

function renderTrainingTabs(active: TrainingTab, lang: UiLanguage): string {
  const tabs: Array<[TrainingTab, string]> = [
    ["roster", t(lang, "training_tab_roster")],
    ["assignments", t(lang, "training_tab_assignments")],
    ["roles", t(lang, "training_tab_roles")],
    ["songs", t(lang, "training_tab_songs")],
  ];
  return `<div class="workspace-tabs training-tabs">${tabs
    .map(
      ([key, label]) =>
        `<button type="button" class="workspace-tab ${active === key ? "is-active" : ""}" data-training-tab="${htmlEsc(key)}">${htmlEsc(label)}</button>`,
    )
    .join("")}</div>`;
}

function liveTimeRangeText(live: Record<string, unknown>): string {
  const start = String(live.start_time ?? "").slice(0, 5);
  const end = String(live.end_time ?? "").slice(0, 5);
  return [start, end].filter(Boolean).join("-");
}

function liveVenueCompactText(live: Record<string, unknown>): string {
  const festivalStage = String(live.festival_stage ?? "").trim();
  const festivalLocation = String(live.location ?? "").trim();
  if (festivalStage) return festivalLocation ? `${festivalStage}, ${festivalLocation}` : festivalStage;
  const venue = String(live.venue ?? "-").trim() || "-";
  const city = String(live.location ?? "").trim();
  return city ? `${venue}, ${city}` : venue;
}

function prettyFestivalDisplayName(name: string): string {
  const raw = String(name ?? "").trim();
  if (/tokyo\s*idol\s*festival/i.test(raw)) return "Tokyo Idol Festival";
  return raw;
}

function liveDisplayTitleText(live: Record<string, unknown>): string {
  const festivalName = String(live.festival_name ?? "").trim();
  const stage = String(live.festival_stage ?? "").trim();
  if (festivalName) {
    const pretty = prettyFestivalDisplayName(festivalName);
    return stage ? `${pretty} · ${stage}` : pretty;
  }
  return String(live.title ?? live.live_type ?? "Live");
}

function goodsByUid(goods: ProducedGoodsRow[]): Map<string, ProducedGoodsRow> {
  return new Map(goods.map((item) => [String(item.uid), item] as const));
}

function goodsDisplayLabel(item: ProducedGoodsRow | null | undefined): string {
  if (!item) return "";
  return item.member_name ? `${item.member_name} / ${item.name}` : item.name;
}

function renderLivesView(
  save: GameSavePayload,
  livesTab: LivesTab,
  scheduledLiveUid: string | null,
  newLiveForm: NewLiveFormState,
  selectedLiveSongTitle: string | null,
  selectedSetlistSongIndex: number | null,
  festivals: Record<string, unknown>[] | null | undefined,
  lang: UiLanguage,
  leaguePanelTab: LeaguePanelTab = "current",
): string {
  const schedules = (save.lives?.schedules ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  const results = (save.lives?.results ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );

  const byDate = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const da = String(a.start_date ?? a.date ?? "").split("T")[0];
    const db = String(b.start_date ?? b.date ?? "").split("T")[0];
    return da.localeCompare(db);
  };
  const grp = getPrimaryGroup(save);
  const label = String(grp?.name_romanji ?? grp?.name ?? save.managing_group ?? "Managed group");
  const todayIso =
    save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "2020-01-01";
  const venues = [...getVenuesCatalog()].sort((a, b) => {
    const capDiff = Number(a.capacity ?? 0) - Number(b.capacity ?? 0);
    if (capDiff !== 0) return capDiff;
    return String(a.name ?? "").localeCompare(String(b.name ?? ""));
  });
  const venueByName = new Map(venues.map((row) => [row.name, row] as const));
  const goodsInventory = Array.isArray(save.goods_inventory) ? save.goods_inventory : [];
  const availableGoodsForTitle = (title: string): ProducedGoodsRow[] =>
    goodsInventory.filter((item) => {
      const stock = Math.max(0, Number(item.stock ?? 0) || 0);
      if (stock <= 0) return false;
      if (String(item.name ?? "") !== BIRTHDAY_TEE_TEMPLATE.name) return true;
      return /生誕|birthday/i.test(title) && String(item.member_name ?? "").trim() && title.includes(String(item.member_name ?? "").trim());
    });
  const goodsLookup = goodsByUid(goodsInventory);
  const managedUid = String(grp?.uid ?? "");
  const groupSongs = songsForDisplaySorted(save.database_snapshot.songs)
    .filter((row) => String(row.group_uid ?? "") === managedUid)
    .filter((row) => isSongAvailableOn(row, todayIso))
    .slice(0, 40);
  const unplayedSchedules = [...schedules]
    .filter((live) => String(live.status ?? "") !== "played")
    .sort(byDate);
  const futureSchedules = unplayedSchedules.filter((live) => String(live.start_date ?? "").split("T")[0] >= todayIso);
  const upcoming = futureSchedules.length ? futureSchedules : unplayedSchedules;
  const selectedScheduled =
    (scheduledLiveUid ? upcoming.find((live) => String(live.uid ?? "") === scheduledLiveUid) : null) ?? upcoming[0] ?? null;
  const managedFestivalPerformances = festivals?.length
    ? festivalPerformancesForManagedGroup(normalizeFestivalCatalog(festivals), String(save.managing_group_uid ?? ""))
    : [];

  const upcomingRows = upcoming
    .map((live) => {
      const d = String(live.start_date ?? "").split("T")[0];
      const title = liveDisplayTitleText(live);
      const isFestival =
        String(live.live_type ?? live.event_type ?? "").toLowerCase() === "festival" ||
        Boolean(String(live.festival_uid ?? live.festival_name ?? "").trim());
      const cap =
        isFestival || live.capacity == null || live.capacity === ""
          ? "—"
          : String(live.capacity);
      const slot = liveTimeRangeText(live) || "—";
      const typ = liveTypeLabel(lang, String(live.live_type ?? live.event_type ?? ""));
      const where = liveVenueCompactText(live);
      const active = String(live.uid ?? "") === String(selectedScheduled?.uid ?? "") ? " class=\"is-selected-row\"" : "";
      return `<tr${active} data-scheduled-live="${htmlEsc(String(live.uid ?? ""))}"><td>${htmlEsc(d)}</td><td>${htmlEsc(slot)}</td><td><button type="button" class="text-action-btn" data-live-open-uid="${htmlEsc(String(live.uid ?? ""))}">${htmlEsc(title)}</button></td><td>${htmlEsc(typ)}</td><td>${htmlEsc(where)}</td><td class="num">${htmlEsc(cap)}</td></tr>`;
    })
    .join("");

  const recent = [...results].sort(byDate).reverse().slice(0, 30);
  const resultRows = recent
    .map((live) => {
      const d = String(live.date ?? live.start_date ?? "").split("T")[0];
      const venue = String(live.venue ?? "—");
      const perf = live.performance_score != null ? String(live.performance_score) : "—";
      const title = liveDisplayTitleText(live);
      const gross =
        (Number(live.ticket_gross_yen ?? 0) || 0) +
        (Number(live.goods_gross_yen ?? 0) || 0) +
        (Number(live.tokutenkai_revenue_yen ?? 0) || 0);
      return `<tr><td>${htmlEsc(d)}</td><td>${htmlEsc(title)}</td><td>${htmlEsc(venue)}</td><td class="num">${htmlEsc(perf)}</td><td class="num">${htmlEsc(currencyText(lang, gross))}</td></tr>`;
    })
    .join("");
  const selectedPreset = LIVE_TYPE_PRESETS[newLiveForm.liveType] ?? LIVE_TYPE_PRESETS.Routine;
  const selectedVenue = venueByName.get(newLiveForm.venueName);
  const selectedVenueFee =
    selectedVenue?.capacity != null
      ? estimateVenueFee(selectedVenue.capacity, {
          isWeekendOrHoliday: isWeekendUtc(newLiveForm.date || todayIso),
        })
      : 0;
  const selectedGoodsUids = newLiveForm.goodsUids.filter((uid) => goodsLookup.has(uid));
  const selectedGoodsNames = selectedGoodsUids.map((uid) => goodsDisplayLabel(goodsLookup.get(uid) ?? null)).filter(Boolean);
  const selectedGoodsGross = selectedGoodsUids.reduce((sum, uid) => {
    return (
      sum +
      estimateLiveGoodsGrossYen(goodsLookup.get(uid) ?? null, {
        liveType: newLiveForm.liveType,
        capacity: selectedVenue?.capacity ?? null,
        groupFans: Number(grp?.fans ?? 0) || 0,
        groupPopularity: Number(grp?.popularity ?? 0) || 0,
        groupTier: resolveGroupLetterTier(grp ?? undefined),
      })
    );
  }, 0);
  const tokutenkaiSummary = newLiveForm.tokutenkaiEnabled
    ? `${newLiveForm.tokutenkaiStart || newLiveForm.endTime}-${newLiveForm.tokutenkaiEnd || addMinutesToHHMM(newLiveForm.endTime, selectedPreset.tokutenkai_duration)} · ${currencyText(lang, newLiveForm.tokutenkaiTicketPrice)} · ${newLiveForm.tokutenkaiSlotSeconds}s · est ${newLiveForm.tokutenkaiExpectedTickets}`
    : t(lang, "lives_tokutenkai_none");
  const programSummary = newLiveForm.program.map((item) =>
    item.kind === "song" ? item.label : `${item.label} ${item.durationMinutes}m`,
  );
  const songListRows = groupSongs
    .map((song) => {
      const title = songCatalogDisplayLabel(song);
      const uid = String(song.uid ?? "").trim();
      const familiarity = Math.round(Number(save.managed_song_status[uid]?.familiarity ?? 0) || 0);
      const selected = songCatalogMatchesPick(String(selectedLiveSongTitle ?? "").trim(), song) ? " is-selected-row" : "";
      return `<tr class="live-song-row${selected}" data-live-song-pick="${htmlEsc(title)}">
        <td>${htmlEsc(title)}</td>
        <td class="num">${htmlEsc(songPopularityNum(song).toFixed(1))}</td>
        <td class="num">${htmlEsc(String(familiarity))}</td>
      </tr>`;
    })
    .join("");
  const programItems = newLiveForm.program
    .map((item, index) => {
      const durationField =
        item.kind === "song"
          ? ""
          : `<input class="fm-input live-program-duration" data-live-program-duration="${htmlEsc(String(index))}" value="${htmlEsc(String(item.durationMinutes))}" />`;
      const meta = item.kind === "song" ? t(lang, "lives_song_meta") : item.kind === "mc" ? t(lang, "lives_program_mc") : t(lang, "lives_program_break");
      const detail =
        item.kind === "song"
          ? (() => {
              const title = String(item.songTitle ?? item.label ?? "").trim();
              const source = groupSongs.find((song) => songCatalogMatchesPick(title, song));
              return lang === "zh-CN" ? `人气 ${songPopularityNum(source ?? {}).toFixed(1)}` : `Popularity ${songPopularityNum(source ?? {}).toFixed(1)}`;
            })()
          : lang === "zh-CN" ? `${item.durationMinutes} 分` : `${item.durationMinutes}m`;
      const selected = selectedSetlistSongIndex === index ? " is-selected-row" : "";
      return `<div class="live-program-dropzone" data-live-drop-index="${htmlEsc(String(index))}"></div>
        <div class="live-program-item${selected}" draggable="true" data-live-program-index="${htmlEsc(String(index))}" data-live-setlist-pick="${htmlEsc(String(index))}">
          <span class="live-program-grab" aria-hidden="true">::</span>
          <span class="live-program-kind live-program-kind--${htmlEsc(item.kind)}">${htmlEsc(meta)}</span>
          <span class="live-program-label">${htmlEsc(item.label)}</span>
          <span class="live-program-detail">${htmlEsc(detail)}</span>
          ${durationField}
          <button type="button" class="fm-btn live-program-remove" data-live-program-remove="${htmlEsc(String(index))}">${htmlEsc(t(lang, "lives_remove"))}</button>
        </div>`;
    })
    .join("");
  const venueOptions = [
    `<option value="">${htmlEsc(t(lang, "lives_select_venue"))}</option>`,
    ...venues.map((venue) => {
      const selected = venue.name === newLiveForm.venueName ? "selected" : "";
      return `<option value="${htmlEsc(venue.name)}" ${selected}>${htmlEsc(`${venue.name} (${venue.capacity})`)}</option>`;
    }),
  ].join("");
  const scheduledVenueOptions = [
    `<option value="">${htmlEsc(t(lang, "lives_select_venue"))}</option>`,
    ...venues.map((venue) => {
      const selected = venue.name === String(selectedScheduled?.venue ?? "") ? "selected" : "";
      return `<option value="${htmlEsc(venue.name)}" ${selected}>${htmlEsc(`${venue.name} (${venue.capacity})`)}</option>`;
    }),
  ].join("");
  const plannerLiveTypes = ["Routine", "Concert", "Taiban", "Festival"] as const;
  const summaryLines = [
    `${liveTypeLabel(lang, newLiveForm.liveType)} · ${newLiveForm.date || localizedLiteral(lang, "TBD", "待定")} · ${newLiveForm.startTime}-${newLiveForm.endTime}`,
    `${localizedLiteral(lang, "Venue", "场地")}:${newLiveForm.venueName || localizedLiteral(lang, "TBA", "待定")}${selectedVenue?.location ? ` · ${selectedVenue.location}` : ""}${selectedVenue?.capacity ? ` · ${lang === "zh-CN" ? `容纳 ${selectedVenue.capacity}` : `cap ${selectedVenue.capacity}`}` : ""}`,
    `${localizedLiteral(lang, "Venue fee", "场地费")}:${selectedVenue ? currencyText(lang, selectedVenueFee) : localizedLiteral(lang, "TBD", "待定")}`,
    `${localizedLiteral(lang, "Program", "节目内容")}:${programSummary.length ? programSummary.join(" · ") : localizedLiteral(lang, "Not set", "未设置")}`,
    `${localizedLiteral(lang, "Tokutenkai", "特典会")}:${newLiveForm.tokutenkaiEnabled ? `${newLiveForm.tokutenkaiStart || newLiveForm.endTime}-${newLiveForm.tokutenkaiEnd || addMinutesToHHMM(newLiveForm.endTime, selectedPreset.tokutenkai_duration)} · ${currencyText(lang, newLiveForm.tokutenkaiTicketPrice)} · ${newLiveForm.tokutenkaiSlotSeconds}${localizedLiteral(lang, "s", "秒")} · ${localizedLiteral(lang, "est", "预计")} ${newLiveForm.tokutenkaiExpectedTickets}` : localizedLiteral(lang, "Off", "休息")}`,
    `${localizedLiteral(lang, "Goods", "周边")}:${newLiveForm.goodsEnabled ? `${selectedGoodsNames.join(", ") || localizedLiteral(lang, "None selected", "未选择")} / ${localizedLiteral(lang, "est", "预计")} ${currencyText(lang, selectedGoodsGross)}` : localizedLiteral(lang, "Off", "休息")}`,
    `${localizedLiteral(lang, "Ticket price", "票价")}:${newLiveForm.ticketPriceYen > 0 ? currencyText(lang, newLiveForm.ticketPriceYen) : localizedLiteral(lang, "Not set", "未设置")}`,
  ];

  const scheduledDetail = selectedScheduled
    ? `<div class="content-muted">${[
        `${liveDisplayTitleText(selectedScheduled)}`,
        `${localizedLiteral(lang, "When", "时间")}:${formatLiveSlotLine(selectedScheduled)}`,
        `${localizedLiteral(lang, "Venue", "场地")}:${String(selectedScheduled.venue ?? localizedLiteral(lang, "TBA", "待定"))}${String(selectedScheduled.location ?? "").trim() ? ` · ${String(selectedScheduled.location ?? "").trim()}` : ""}`,
        `${localizedLiteral(lang, "Program", "节目内容")}:${Array.isArray(selectedScheduled.program) && selectedScheduled.program.length
          ? (selectedScheduled.program as unknown[])
              .map((raw) => {
                if (!raw || typeof raw !== "object") return "";
                const item = raw as Record<string, unknown>;
                const kind = String(item.kind ?? "song");
                const label = String(item.label ?? item.songTitle ?? "").trim();
                const duration = Number(item.durationMinutes ?? 0) || 0;
                return kind === "song" ? label : lang === "zh-CN" ? `${label} ${duration} 分` : `${label} ${duration}m`;
              })
              .filter(Boolean)
              .join(", ")
          : Array.isArray(selectedScheduled.setlist) && selectedScheduled.setlist.length
            ? (selectedScheduled.setlist as unknown[]).map((x) => String(x)).join(", ")
            : localizedLiteral(lang, "Not set", "未设置")}`,
        `${localizedLiteral(lang, "Tokutenkai", "特典会")}:${selectedScheduled.tokutenkai_enabled ? `${String(selectedScheduled.tokutenkai_start ?? "")}-${String(selectedScheduled.tokutenkai_end ?? "")} · ${localizedLiteral(lang, "est", "预计")} ${String(selectedScheduled.tokutenkai_expected_tickets ?? "0")}` : localizedLiteral(lang, "Off", "休息")}`,
        `${localizedLiteral(lang, "Goods", "周边")}:${selectedScheduled.goods_enabled ? `${String(selectedScheduled.goods_line ?? localizedLiteral(lang, "Goods", "周边"))} · ${localizedLiteral(lang, "est", "预计")} ${currencyText(lang, Number(selectedScheduled.goods_expected_revenue_yen ?? 0))}` : localizedLiteral(lang, "Off", "休息")}`,
      ].map((line) => htmlEsc(line)).join("<br />")}</div>`
    : `<p class="content-muted">${htmlEsc(t(lang, "lives_no_selected"))}</p>`;

  const scheduledProgramSummary = selectedScheduled
    ? Array.isArray(selectedScheduled.program) && selectedScheduled.program.length
      ? (selectedScheduled.program as unknown[])
          .map((raw) => {
            if (!raw || typeof raw !== "object") return "";
            const item = raw as Record<string, unknown>;
            const kind = String(item.kind ?? "song");
            const lineLabel = String(item.label ?? item.songTitle ?? "").trim();
            const duration = Number(item.durationMinutes ?? 0) || 0;
            return kind === "song" ? lineLabel : lang === "zh-CN" ? `${lineLabel} ${duration} 分` : `${lineLabel} ${duration}m`;
          })
          .filter(Boolean)
          .join(" · ")
      : Array.isArray(selectedScheduled.setlist) && selectedScheduled.setlist.length
        ? (selectedScheduled.setlist as unknown[]).map((x) => String(x)).join(" · ")
        : localizedLiteral(lang, "Not set", "未设置")
    : "";

  const scheduledAvailableGoods = availableGoodsForTitle(String(selectedScheduled?.title ?? ""));
  const scheduledSelectedGoodsUidsRaw = selectedScheduled
    ? Array.isArray(selectedScheduled.goods_uids)
      ? (selectedScheduled.goods_uids as unknown[]).map((x) => String(x))
      : String(selectedScheduled.goods_uid ?? "").trim()
        ? [String(selectedScheduled.goods_uid ?? "").trim()]
        : []
    : [];
  const scheduledSelectedGoodsUids =
    selectedScheduled?.goods_enabled && scheduledSelectedGoodsUidsRaw.length === 0
      ? scheduledAvailableGoods.map((item) => item.uid)
      : scheduledSelectedGoodsUidsRaw;
  const scheduledGoodsChecklist = scheduledAvailableGoods.length
    ? scheduledAvailableGoods
        .map((item) => {
          const checked = scheduledSelectedGoodsUids.includes(item.uid) ? "checked" : "";
          return `<label class="check-pill live-goods-pill"><input type="checkbox" data-live-detail-goods-pick="${htmlEsc(item.uid)}" ${checked} /> <span>${htmlEsc(lang === "zh-CN" ? `${goodsDisplayLabel(item)} / 库存 ${item.stock} / JPY ${item.unit_price_yen.toLocaleString("ja-JP")}` : `${goodsDisplayLabel(item)} / stock ${item.stock} / JPY  ${item.unit_price_yen.toLocaleString("ja-JP")}`)}</span></label>`;
        })
        .join("")
    : `<p class="content-muted">${htmlEsc(t(lang, "lives_stock_goods_hint"))}</p>`;
  const newLiveAvailableGoods = availableGoodsForTitle(newLiveForm.title);
  const newLiveGoodsChecklist = newLiveAvailableGoods.length
    ? newLiveAvailableGoods
        .map((item) => {
          const checked = selectedGoodsUids.includes(item.uid) ? "checked" : "";
          return `<label class="check-pill live-goods-pill"><input type="checkbox" data-live-goods-pick="${htmlEsc(item.uid)}" ${checked} /> <span>${htmlEsc(lang === "zh-CN" ? `${goodsDisplayLabel(item)} / 库存 ${item.stock} / JPY ${item.unit_price_yen.toLocaleString("ja-JP")}` : `${goodsDisplayLabel(item)} / stock ${item.stock} / JPY  ${item.unit_price_yen.toLocaleString("ja-JP")}`)}</span></label>`;
        })
        .join("")
    : `<p class="content-muted">${htmlEsc(t(lang, "lives_stock_goods_hint"))}</p>`;

  const liveDetailBody = selectedScheduled
    ? `<section class="fm-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_upcoming_detail"))}</h3>
      <div class="form-grid live-form-grid">
        <label><span>${htmlEsc(localizedLiteral(lang, "Type", "类型"))}</span><select class="fm-select" data-live-detail-field="live_type">${renderLiveTypeSelectOptions(lang, String(selectedScheduled.live_type ?? "Routine"), plannerLiveTypes)}</select></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</span><input class="fm-input" data-live-detail-field="title" value="${htmlEsc(String(selectedScheduled.title ?? ""))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</span><input type="date" class="fm-input" data-live-detail-field="start_date" value="${htmlEsc(String(selectedScheduled.start_date ?? "").split("T")[0])}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</span><select class="fm-select" data-live-detail-field="venue">${scheduledVenueOptions}</select></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Start", "开始"))}</span><input class="fm-input" data-live-detail-field="start_time" value="${htmlEsc(String(selectedScheduled.start_time ?? ""))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "End", "结束"))}</span><input class="fm-input" data-live-detail-field="end_time" value="${htmlEsc(String(selectedScheduled.end_time ?? ""))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Rehearsal start", "彩排开始"))}</span><input class="fm-input" data-live-detail-field="rehearsal_start" value="${htmlEsc(String(selectedScheduled.rehearsal_start ?? ""))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Rehearsal end", "彩排结束"))}</span><input class="fm-input" data-live-detail-field="rehearsal_end" value="${htmlEsc(String(selectedScheduled.rehearsal_end ?? ""))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "Ticket price", "票价"))}</span><input class="fm-input" data-live-detail-field="ticket_price" value="${htmlEsc(String(selectedScheduled.ticket_price ?? 0))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "VIP ticket price", "VIP票价"))}</span><input class="fm-input" data-live-detail-field="vip_ticket_price" value="${htmlEsc(String(selectedScheduled.vip_ticket_price ?? 0))}" /></label>
        <label><span>${htmlEsc(localizedLiteral(lang, "VIP numbers", "VIP人数"))}</span><input class="fm-input" data-live-detail-field="vip_capacity" value="${htmlEsc(String(selectedScheduled.vip_capacity ?? 0))}" /></label>
      </div>
      <div class="planner-subpanel live-tokutenkai-card">
        <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Post-live tokutenkai / cheki", "公演后特典会 / 拍立得"))}</h4>
        <label class="check-pill live-tokutenkai-toggle"><input type="checkbox" data-live-detail-toggle="tokutenkai_enabled" ${selectedScheduled.tokutenkai_enabled ? "checked" : ""} /> <span>${htmlEsc(localizedLiteral(lang, "Enable tokutenkai / cheki", "启用特典会 / 拍立得"))}</span></label>
        <div class="form-grid live-form-grid live-tokutenkai-grid">
          <label><span>${htmlEsc(localizedLiteral(lang, "Start", "开始"))}</span><input class="fm-input" data-live-detail-field="tokutenkai_start" value="${htmlEsc(String(selectedScheduled.tokutenkai_start ?? ""))}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "End", "结束"))}</span><input class="fm-input" data-live-detail-field="tokutenkai_end" value="${htmlEsc(String(selectedScheduled.tokutenkai_end ?? ""))}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Ticket price", "票价"))}</span><input class="fm-input" data-live-detail-field="tokutenkai_ticket_price" value="${htmlEsc(String(selectedScheduled.tokutenkai_ticket_price ?? 0))}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Talk slot seconds", "对谈时长（秒）"))}</span><input class="fm-input" data-live-detail-field="tokutenkai_slot_seconds" value="${htmlEsc(String(selectedScheduled.tokutenkai_slot_seconds ?? 0))}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Expected tickets", "预计张数"))}</span><input class="fm-input" data-live-detail-field="tokutenkai_expected_tickets" value="${htmlEsc(String(selectedScheduled.tokutenkai_expected_tickets ?? 0))}" /></label>
        </div>
      </div>
      <div class="planner-subpanel">
        <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Goods", "周边"))}</h4>
        <label class="check-pill"><input type="checkbox" data-live-detail-toggle="goods_enabled" ${selectedScheduled.goods_enabled ? "checked" : ""} /> <span>${htmlEsc(localizedLiteral(lang, "Run goods booth", "开设周边摊位"))}</span></label>
        <div class="live-goods-checklist">${scheduledGoodsChecklist}</div>
        <div class="form-grid live-form-grid">
          <label><span>${htmlEsc(localizedLiteral(lang, "Expected gross", "预计总收入"))}</span><input class="fm-input" value="${htmlEsc(currencyText(lang, Number(selectedScheduled.goods_expected_revenue_yen ?? 0)))}" readonly /></label>
        </div>
      </div>
      <div class="live-new-summary-grid">
      <div class="live-new-summary-item">${htmlEsc(lang === "zh-CN" ? `时间：${formatLiveSlotLine(selectedScheduled) || "待定"}` : `When: ${formatLiveSlotLine(selectedScheduled) || "TBA"}`)}</div>
        <div class="live-new-summary-item">${htmlEsc(lang === "zh-CN" ? `场地：${liveVenueCompactText(selectedScheduled)}` : `Venue: ${liveVenueCompactText(selectedScheduled)}`)}</div>
        <div class="live-new-summary-item">${htmlEsc(lang === "zh-CN" ? `节目内容：${scheduledProgramSummary}` : `Program: ${scheduledProgramSummary}`)}</div>
      </div>
      <div class="planner-actions"><button type="button" class="fm-btn" data-live-cancel="${htmlEsc(String(selectedScheduled.uid ?? ""))}">${htmlEsc(localizedLiteral(lang, "Cancel Live", "取消公演"))}</button></div>
    </section>`
    : `<section class="fm-card"><p class="content-muted">${htmlEsc(t(lang, "lives_no_upcoming_selected"))}</p></section>`;

  const newLiveBody = `<div class="live-new-layout">
      <section class="fm-card live-new-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_new_setup"))}</h3>
        <div class="form-grid live-form-grid">
          <label><span>${htmlEsc(localizedLiteral(lang, "Type", "类型"))}</span><select class="fm-select" data-live-form-field="liveType">${renderLiveTypeSelectOptions(lang, newLiveForm.liveType, plannerLiveTypes)}</select></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</span><input class="fm-input" data-live-form-field="title" value="${htmlEsc(newLiveForm.title)}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</span><input type="date" class="fm-input" data-live-form-field="date" value="${htmlEsc(newLiveForm.date)}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</span><select class="fm-select" data-live-form-field="venueName">${venueOptions}</select></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Venue fee", "场地费"))}</span><input class="fm-input" value="${htmlEsc(selectedVenue ? currencyText(lang, selectedVenueFee) : localizedLiteral(lang, "TBD", "待定"))}" readonly /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Start", "开始"))}</span><input class="fm-input" data-live-form-field="startTime" value="${htmlEsc(newLiveForm.startTime)}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "End", "结束"))}</span><input class="fm-input" data-live-form-field="endTime" value="${htmlEsc(newLiveForm.endTime)}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Rehearsal start", "彩排开始"))}</span><input class="fm-input" data-live-form-field="rehearsalStart" value="${htmlEsc(newLiveForm.rehearsalStart)}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Rehearsal end", "彩排结束"))}</span><input class="fm-input" data-live-form-field="rehearsalEnd" value="${htmlEsc(newLiveForm.rehearsalEnd)}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "Ticket price", "票价"))}</span><input class="fm-input" data-live-form-field="ticketPriceYen" value="${htmlEsc(String(newLiveForm.ticketPriceYen))}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "VIP ticket price", "VIP票价"))}</span><input class="fm-input" data-live-form-field="vipTicketPriceYen" value="${htmlEsc(String(newLiveForm.vipTicketPriceYen))}" /></label>
          <label><span>${htmlEsc(localizedLiteral(lang, "VIP numbers", "VIP人数"))}</span><input class="fm-input" data-live-form-field="vipCapacity" value="${htmlEsc(String(newLiveForm.vipCapacity))}" /></label>
        </div>
        <div class="planner-subpanel live-tokutenkai-card live-tokutenkai-card--newlive">
          <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Post-live tokutenkai / cheki", "公演后特典会 / 拍立得"))}</h4>
          <label class="check-pill live-tokutenkai-toggle"><input type="checkbox" data-live-toggle="tokutenkaiEnabled" ${newLiveForm.tokutenkaiEnabled ? "checked" : ""} /> <span>${htmlEsc(localizedLiteral(lang, "Enable tokutenkai / cheki", "启用特典会 / 拍立得"))}</span></label>
          <div class="form-grid live-form-grid live-tokutenkai-grid">
            <label><span>${htmlEsc(localizedLiteral(lang, "Start", "开始"))}</span><input class="fm-input" data-live-form-field="tokutenkaiStart" value="${htmlEsc(newLiveForm.tokutenkaiStart)}" /></label>
            <label><span>${htmlEsc(localizedLiteral(lang, "End", "结束"))}</span><input class="fm-input" data-live-form-field="tokutenkaiEnd" value="${htmlEsc(newLiveForm.tokutenkaiEnd)}" /></label>
            <label><span>${htmlEsc(localizedLiteral(lang, "Ticket price", "票价"))}</span><input class="fm-input" data-live-form-field="tokutenkaiTicketPrice" value="${htmlEsc(String(newLiveForm.tokutenkaiTicketPrice))}" /></label>
            <label><span>${htmlEsc(localizedLiteral(lang, "Talk slot seconds", "对谈时长（秒）"))}</span><input class="fm-input" data-live-form-field="tokutenkaiSlotSeconds" value="${htmlEsc(String(newLiveForm.tokutenkaiSlotSeconds))}" /></label>
            <label><span>${htmlEsc(localizedLiteral(lang, "Expected tickets", "预计张数"))}</span><input class="fm-input" data-live-form-field="tokutenkaiExpectedTickets" value="${htmlEsc(String(newLiveForm.tokutenkaiExpectedTickets))}" /></label>
          </div>
          <div class="live-tokutenkai-footer">
            <span>${htmlEsc(lang === "zh-CN" ? `人数:${typeof grp?.member_count === "number" ? grp.member_count : "—"}` : `Members: ${typeof grp?.member_count === "number" ? grp.member_count : "—"}`)}</span>
            <span>${htmlEsc(tokutenkaiSummary)}</span>
          </div>
        </div>
        <div class="planner-subpanel live-song-picker live-song-picker--newlive">
          <div class="live-song-picker-grid">
            <section class="live-song-table-card">
              <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Group Songs", "组合歌曲"))}</h4>
              <div class="table-scroll live-song-table-scroll">
                <table class="fm-table live-song-table">
                  <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Popularity", "人气"))}</th><th>${htmlEsc(localizedLiteral(lang, "Familiarity", "熟练度"))}</th></tr></thead>
                  <tbody>${songListRows || `<tr><td colspan="3" class="content-muted">${htmlEsc(t(lang, "lives_no_released_songs"))}</td></tr>`}</tbody>
                </table>
              </div>
            </section>
            <div class="live-song-picker-actions">
              <button type="button" class="fm-btn fm-btn-accent" data-live-setlist-add-selected ${selectedLiveSongTitle ? "" : "disabled"}>${htmlEsc(localizedLiteral(lang, "Add ->", "添加 ->"))}</button>
              <button type="button" class="live-program-template" draggable="true" data-live-template="mc:2" data-live-add-template="mc:2">${htmlEsc(localizedLiteral(lang, "MC 2m", "MC 2分"))}</button>
              <button type="button" class="live-program-template" draggable="true" data-live-template="mc:6" data-live-add-template="mc:6">${htmlEsc(localizedLiteral(lang, "MC 6m", "MC 6分"))}</button>
              <button type="button" class="live-program-template" draggable="true" data-live-template="break:2" data-live-add-template="break:2">${htmlEsc(localizedLiteral(lang, "Break 2m", "休息 2分"))}</button>
              <button type="button" class="live-program-template" draggable="true" data-live-template="break:6" data-live-add-template="break:6">${htmlEsc(localizedLiteral(lang, "Break 6m", "休息 6分"))}</button>
            </div>
            <section class="live-song-table-card">
              <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Setlist / running order", "曲目单 / 流程"))}</h4>
              <div class="live-program-list" data-live-drop-end="1">
                ${programItems || `<p class="content-muted">${htmlEsc(t(lang, "lives_no_program_items"))}</p>`}
                <div class="live-program-dropzone is-end" data-live-drop-index="${htmlEsc(String(newLiveForm.program.length))}"></div>
              </div>
            </section>
          </div>
        </div>
        <div class="planner-subpanel live-goods-panel--newlive">
          <h4 class="content-h3">${htmlEsc(localizedLiteral(lang, "Goods", "周边"))}</h4>
          <label class="check-pill"><input type="checkbox" data-live-toggle="goodsEnabled" ${newLiveForm.goodsEnabled ? "checked" : ""} /> <span>${htmlEsc(localizedLiteral(lang, "Run goods booth", "开设周边摊位"))}</span></label>
          <div class="live-goods-checklist">${newLiveGoodsChecklist}</div>
          <div class="form-grid live-form-grid">
            <label><span>${htmlEsc(localizedLiteral(lang, "Expected gross", "预计总收入"))}</span><input class="fm-input" value="${htmlEsc(currencyText(lang, selectedGoodsGross))}" readonly /></label>
          </div>
        </div>
        <div class="planner-actions"><button type="button" class="fm-btn fm-btn-accent" data-live-schedule="1">${htmlEsc(localizedLiteral(lang, "Schedule Live", "安排公演"))}</button></div>
      </section>
      <section class="fm-card live-new-summary-card">
        <h3 class="content-h3">${htmlEsc(t(lang, "lives_summary"))}</h3>
        <div class="live-new-summary-layout">
          <section class="live-new-summary-setlist">
            <h4 class="content-h3">${htmlEsc(t(lang, "lives_setlist"))}</h4>
            <div class="live-new-summary-setlist-body">
              ${programSummary.length ? programSummary.map((line) => `<div class="live-new-summary-item">${htmlEsc(line)}</div>`).join("") : `<div class="live-new-summary-item">${htmlEsc(localizedLiteral(lang, "Not set", "未设置"))}</div>`}
            </div>
          </section>
          <div class="live-new-summary-grid">
            ${summaryLines.filter((_, index) => index !== 2).map((line) => `<div class="live-new-summary-item">${htmlEsc(line)}</div>`).join("")}
          </div>
        </div>
      </section>
    </div>`;

  const scheduledBody = `<section class="fm-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_tab_scheduled"))}</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Time", "时间"))}</th><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Type", "类型"))}</th><th>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</th><th>${htmlEsc(localizedLiteral(lang, "Cap.", "容量"))}</th></tr></thead>
          <tbody>${upcomingRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(t(lang, "lives_no_scheduled"))}</td></tr>`}</tbody>
        </table>
      </div>
    </section>
    ${liveDetailBody}`;

  const pastBody = `<section class="fm-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_recent_results"))}</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</th><th>${htmlEsc(localizedLiteral(lang, "Perf.", "表现"))}</th><th>${htmlEsc(localizedLiteral(lang, "Gross", "总收入"))}</th></tr></thead>
          <tbody>${resultRows || `<tr><td colspan="5" class="content-muted">${htmlEsc(t(lang, "lives_no_played"))}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  const festivalRows = managedFestivalPerformances
    .map(({ festival, performance }) => {
      const date = String(performance.date ?? "").split("T")[0];
      const slot = [String(performance.start_time ?? "").slice(0, 5), String(performance.end_time ?? "").slice(0, 5)]
        .filter(Boolean)
        .join("-");
      const stage = String(performance.stage ?? localizedLiteral(lang, "Stage TBA", "舞台待定"));
      const subtitle = String(performance.subtitle ?? "").trim();
      const venue = String(festival.name ?? localizedLiteral(lang, "Festival", "音乐节"));
      return `<tr><td>${htmlEsc(date)}</td><td>${htmlEsc(slot)}</td><td>${htmlEsc(venue)}</td><td>${htmlEsc(stage)}</td><td>${htmlEsc(subtitle || String(performance.title ?? performance.artist_name ?? localizedLiteral(lang, "Appearance", "出演")))}</td></tr>`;
    })
    .join("");

  const festivalBody = `<section class="fm-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_managed_festival_appearances"))}</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(localizedLiteral(lang, "Slot", "时段"))}</th><th>${htmlEsc(localizedLiteral(lang, "Festival", "音乐节"))}</th><th>${htmlEsc(localizedLiteral(lang, "Stage", "舞台"))}</th><th>${htmlEsc(localizedLiteral(lang, "Appearance", "出演"))}</th></tr></thead>
          <tbody>${festivalRows || `<tr><td colspan="5" class="content-muted">${htmlEsc(t(lang, "lives_no_festival_rows"))}</td></tr>`}</tbody>
        </table>
      </div>
      <p class="content-muted">${htmlEsc(t(lang, "lives_tif_autoload"))}</p>
    </section>`;

  const showLeague = isHeroinesManagedGroup(save);
  const season = seasonForDate(todayIso);
  const standingTables = standingsForDate(todayIso);
  const upcomingLeague = upcomingLeagueSchedule(todayIso);
  const historyRecords = historyRecordsForDate(todayIso);

  const renderStandingTable = (table: LeagueTableView) => {
    const fieldSize = table.rows.length;
    const rows = table.rows
      .map((row) => {
        const managed = isManagedStandingRow(save, row.group_name);
        const zone = standingZoneForRow(table.key, row.rank, fieldSize);
        const zoneCls = standingZoneClass(zone);
        const classes = [managed ? "is-managed-row" : "", zoneCls].filter(Boolean).join(" ");
        const note = row.note ? ` (${row.note})` : "";
        return `<tr class="${classes}"><td>${htmlEsc(String(row.rank))}</td><td>${htmlEsc(row.group_name)}${htmlEsc(note)}${managed ? ` <span class="league-you-tag">${htmlEsc(t(lang, "lives_league_you"))}</span>` : ""}</td><td>${htmlEsc(String(row.points))}</td></tr>`;
      })
      .join("");
    const zoneLegend =
      table.key === "league_i"
        ? `<p class="content-muted league-zone-legend">${htmlEsc(t(lang, "lives_league_zone_legend_i"))}</p>`
        : table.key === "league_ii"
          ? `<p class="content-muted league-zone-legend">${htmlEsc(t(lang, "lives_league_zone_legend_ii"))}</p>`
          : "";
    return `<section class="fm-card league-table-card">
        <h3 class="content-h3">${htmlEsc(table.label)}</h3>
        <p class="content-muted">${htmlEsc(`${t(lang, "lives_league_as_of")} ${table.as_of}`)}${table.note ? ` — ${htmlEsc(table.note)}` : ""}</p>
        <div class="table-scroll">
          <table class="fm-table league-standings-table">
            <thead><tr><th>${htmlEsc(t(lang, "lives_league_rank"))}</th><th>${htmlEsc(t(lang, "lives_league_group"))}</th><th>${htmlEsc(t(lang, "lives_league_points"))}</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="3" class="content-muted">${htmlEsc(t(lang, "lives_league_no_standings"))}</td></tr>`}</tbody>
          </table>
        </div>
        ${zoneLegend}
      </section>`;
  };

  const standingSections = standingTables.map(renderStandingTable).join("");

  const upcomingLeagueRows = upcomingLeague
    .map((row) => {
      const kind = leagueKindLabel(row.kind, lang === "zh-CN" ? "zh-CN" : "en");
      // Regular season only: do not highlight FINAL / 入れ替え from historical attending_groups.
      const mine =
        isRegularLeagueKind(row.kind) &&
        (row.attending_groups ?? []).some((name) => isManagedStandingRow(save, name));
      return `<tr class="${mine ? "is-managed-row" : ""}"><td>${htmlEsc(row.date)}</td><td>${htmlEsc(kind)}</td><td>${htmlEsc(row.title)}</td><td>${htmlEsc(row.venue || "-")}</td></tr>`;
    })
    .join("");

  const seasonLine = season
    ? `${season.label}${season.official_label ? ` · ${season.official_label}` : ""}${
        season.end_date ? ` (${season.start_date} → ${season.end_date})` : ` (${season.start_date} → )`
      }`
    : t(lang, "lives_league_no_season");

  const leaguePanelTabs = `<div class="workspace-tabs league-panel-tabs" role="tablist">
      <button type="button" class="workspace-tab ${leaguePanelTab === "current" ? "is-active" : ""}" data-league-panel-tab="current">${htmlEsc(t(lang, "lives_league_panel_current"))}</button>
      <button type="button" class="workspace-tab ${leaguePanelTab === "history" ? "is-active" : ""}" data-league-panel-tab="history">${htmlEsc(t(lang, "lives_league_panel_history"))}</button>
    </div>`;

  const leagueCurrentBody = `${standingSections || `<section class="fm-card"><p class="content-muted">${htmlEsc(t(lang, "lives_league_no_standings"))}</p></section>`}
    <section class="fm-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_league_upcoming"))}</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Date", "日期"))}</th><th>${htmlEsc(t(lang, "lives_league_kind"))}</th><th>${htmlEsc(localizedLiteral(lang, "Title", "标题"))}</th><th>${htmlEsc(localizedLiteral(lang, "Venue", "场地"))}</th></tr></thead>
          <tbody>${upcomingLeagueRows || `<tr><td colspan="4" class="content-muted">${htmlEsc(t(lang, "lives_league_no_upcoming"))}</td></tr>`}</tbody>
        </table>
      </div>
    </section>`;

  const historyBody =
    historyRecords
      .map((rec) => {
        const seasonMeta = seasonById(rec.season_id);
        const seasonLabel = seasonMeta?.label ?? rec.season_id;
        const tables = historyTables(rec).map(renderStandingTable).join("");
        return `<section class="fm-card league-history-card">
          <h3 class="content-h3">${htmlEsc(`${seasonLabel} · ${rec.title}`)}</h3>
          <p class="content-muted">${htmlEsc(rec.date)}${rec.venue ? ` · ${htmlEsc(rec.venue)}` : ""}</p>
          <p class="content-muted">${htmlEsc(rec.note ?? "")}</p>
          ${tables}
        </section>`;
      })
      .join("") || `<section class="fm-card"><p class="content-muted">${htmlEsc(t(lang, "lives_league_no_history"))}</p></section>`;

  const leagueBody = `<section class="fm-card">
      <h3 class="content-h3">${htmlEsc(t(lang, "lives_league_title"))}</h3>
      <p class="content-muted">${htmlEsc(t(lang, "lives_league_season"))}: ${htmlEsc(seasonLine)}</p>
      <p class="content-muted">${htmlEsc(season?.notes ?? t(lang, "lives_league_blurb"))}</p>
      <p class="content-muted">${htmlEsc(t(lang, "lives_league_sim_note"))}</p>
    </section>
    ${leaguePanelTabs}
    ${leaguePanelTab === "history" ? historyBody : leagueCurrentBody}`;

  const effectiveLivesTab: LivesTab = livesTab === "league" && !showLeague ? "new" : livesTab;

  const body =
    effectiveLivesTab === "scheduled"
      ? scheduledBody
      : effectiveLivesTab === "past"
        ? pastBody
        : effectiveLivesTab === "festival"
          ? festivalBody
          : effectiveLivesTab === "league"
            ? leagueBody
            : newLiveBody;

  return `<section class="content-panel lives-view">
    <h2 class="content-h2">${htmlEsc(navLabel(lang, "Lives"))}</h2>
    <p class="content-muted">${htmlEsc(
      lang === "zh-CN"
        ? `当前经营组合：${label}。新建公演沿用桌面版排期流程，可先配置场地、节目单、特典会和周边，再正式安排。`
        : `Managed group: ${label}. New Live matches the desktop planner flow: venue, setlist, tokutenkai, and goods can all be staged before scheduling.`,
    )}</p>
    ${renderLiveTabs(effectiveLivesTab, lang, showLeague)}
    ${body}
  </section>`;
}

function renderScoutView(
  save: GameSavePayload,
  scoutTab: ScoutTab,
  selectedScoutLeadUid: string | null,
  selectedScoutApplicantUid: string | null,
  lang: UiLanguage,
): string {
  const companies = buildDefaultScoutCompanies();
  const selectedCompany =
    companies.find((company) => company.uid === save.scout.selected_company_uid) ?? companies[0] ?? null;
  if (!selectedCompany) return renderPlaceholder(navLabel(lang, "Scout"), localizedLiteral(lang, "No scout companies are configured.", "未配置星探公司。"));
  const currentIso =
    save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "2020-01-01";
  const selectedCompanySubscribed = isScoutCompanySubscribed(save.scout.subscriptions, selectedCompany.uid);
  const selectedCompanyLeadLimit = scoutLeadRevealCount(save.scout.subscriptions, selectedCompany.uid, currentIso);
  const managedGroupName = String(getPrimaryGroup(save)?.name ?? save.managing_group ?? "");
  const recommendVisibleLeads = (targetType: "freelancer" | "transfer", limit: number) => {
    const strictRows = recommendScoutLeads({
      idols: save.database_snapshot.idols,
      managedGroupName,
      company: selectedCompany,
      targetType,
      currentIso,
      limit,
      companies,
    });
    if (strictRows.length > 0 || targetType !== "freelancer") return strictRows;
    return recommendScoutLeads({
      idols: save.database_snapshot.idols,
      managedGroupName,
      company: selectedCompany,
      targetType,
      currentIso,
      limit,
    });
  };
  const auditionsKey = buildAuditionStorageKey(selectedCompany.uid, currentIso);
  const auditionRows = selectedCompanySubscribed && Array.isArray(save.scout.auditions[auditionsKey])
    ? (save.scout.auditions[auditionsKey] as ScoutAuditionRow[])
    : [];
  const leadRowsRaw =
    scoutTab === "audition" || !selectedCompanySubscribed
      ? []
      : recommendVisibleLeads(scoutTab, Math.max(0, selectedCompanyLeadLimit));
  const leadRows = (() => {
    if (scoutTab === "audition" || !selectedCompanySubscribed) return leadRowsRaw as ScoutLeadRow[];
    const windows = contestedRecruitWindowsForDate(save, currentIso);
    if (!windows.length) return leadRowsRaw;
    const playerNorm = managedGroupName.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "");
    const byUid = new Map<string, ScoutLeadRow>();
    for (const row of leadRowsRaw) byUid.set(row.idol_uid, { ...row });
    const pinnedOrder: string[] = [];
    for (const win of windows) {
      const idol = save.database_snapshot.idols.find((row) => String((row as Record<string, unknown>).uid ?? "") === win.idol_uid) as
        | Record<string, unknown>
        | undefined;
      if (!idol) continue;
      const groups = activeGroupsAtReference(idol, currentIso).filter(
        (name) => name.normalize("NFKC").toLocaleLowerCase().replace(/\s+/g, "") !== playerNorm,
      );
      const fitsFreelancer = scoutTab === "freelancer" && groups.length === 0;
      const fitsTransfer = scoutTab === "transfer" && groups.length > 0;
      if (!fitsFreelancer && !fitsTransfer) continue;
      const existing = byUid.get(win.idol_uid);
      if (existing) {
        byUid.set(win.idol_uid, { ...existing, score: Math.max(existing.score, 999), reason: win.reason });
        pinnedOrder.push(win.idol_uid);
        continue;
      }
      const profile =
        Number(idol.popularity ?? 0) +
        Math.min(30, Number(idol.x_followers ?? 0) / 4000) +
        Math.min(20, Number(idol.fan_count ?? 0) / 5000);
      byUid.set(win.idol_uid, {
        idol_uid: win.idol_uid,
        score: 999,
        profile_score: Math.round(Math.max(0, Math.min(100, profile))),
        current_groups: groups,
        reason: win.reason,
        local_match: false,
      });
      pinnedOrder.push(win.idol_uid);
    }
    const rest = [...byUid.values()]
      .filter((row) => !pinnedOrder.includes(row.idol_uid))
      .sort((a, b) => b.score - a.score || b.profile_score - a.profile_score || a.idol_uid.localeCompare(b.idol_uid));
    const pinned = pinnedOrder.map((uid) => byUid.get(uid)!).filter(Boolean);
    return [...pinned, ...rest].slice(0, Math.max(leadRowsRaw.length, pinned.length, selectedCompanyLeadLimit));
  })();
  const shortlist = new Set(save.shortlist.map((uid) => String(uid)));
  const idolsByUid = new Map(save.database_snapshot.idols.map((idol) => [String(idol.uid ?? ""), idol] as const));
  const selectedLead =
    leadRows.find((row) => row.idol_uid === selectedScoutLeadUid) ?? leadRows[0] ?? null;
  const selectedApplicant =
    auditionRows.find((row) => String(row.uid) === selectedScoutApplicantUid) ?? auditionRows[0] ?? null;

  const companyRows = companies
    .map((company) => {
      const active = company.uid === selectedCompany.uid ? " is-active" : "";
      const subscribed = isScoutCompanySubscribed(save.scout.subscriptions, company.uid);
      const leadCount = scoutLeadRevealCount(save.scout.subscriptions, company.uid, currentIso);
      return `<button type="button" class="inbox-row-btn fm-card${active}" data-scout-company="${htmlEsc(company.uid)}">
        <span class="inbox-row-title"><span>${htmlEsc(company.name)}</span></span>
        <span class="inbox-row-meta">${htmlEsc(lang === "zh-CN" ? `${company.city} · 等级${company.level} · ¥${company.service_fee_yen.toLocaleString("ja-JP")}/月${subscribed ? ` · ${leadCount} 条线索` : " · 未订阅"}` : `${company.city} · Lv${company.level} · ¥${company.service_fee_yen.toLocaleString("ja-JP")}/month${subscribed ? ` · ${leadCount} lead${leadCount === 1 ? "" : "s"}` : " · Unsubscribed"}`)}</span>
      </button>`;
    })
    .join("");

  const companyDetail = [
    selectedCompany.name,
    lang === "zh-CN" ? `据点：${selectedCompany.city}` : `Base: ${selectedCompany.city}`,
    lang === "zh-CN" ? `等级：${selectedCompany.level}` : `Level: ${selectedCompany.level}`,
    lang === "zh-CN" ? `顾问费：¥${selectedCompany.service_fee_yen.toLocaleString("ja-JP")} / 月` : `Retainer: ¥${selectedCompany.service_fee_yen.toLocaleString("ja-JP")} / month`,
    lang === "zh-CN" ? `专长：${selectedCompany.specialty}` : `Specialty: ${selectedCompany.specialty}`,
    lang === "zh-CN" ? `方向：${selectedCompany.focus_note}` : `Focus: ${selectedCompany.focus_note}`,
    selectedCompanySubscribed
      ? (lang === "zh-CN" ? `订阅：已启用 · 当前显示 ${selectedCompanyLeadLimit} 条线索` : `Subscription: Active · ${selectedCompanyLeadLimit} lead${selectedCompanyLeadLimit === 1 ? "" : "s"} currently surfaced`)
      : localizedLiteral(lang, "Subscription: Inactive · subscribe to receive 1 lead now and 1 more each month", "订阅：未开通 · 订阅后立即获得 1 名线索，之后每月再获得 1 名"),
  ]
    .map((line) => htmlEsc(line))
    .join("<br />");
  const subscribeBtn = selectedCompanySubscribed
    ? `<button type="button" class="fm-btn" disabled>${htmlEsc(localizedLiteral(lang, "Subscribed", "已订阅"))}</button>`
    : `<button type="button" class="fm-btn fm-btn-accent" data-scout-subscribe="${htmlEsc(selectedCompany.uid)}">${htmlEsc(lang === "zh-CN" ? `订阅 · ¥${selectedCompany.service_fee_yen.toLocaleString("ja-JP")}/月` : `Subscribe · ¥${selectedCompany.service_fee_yen.toLocaleString("ja-JP")}/month`)}</button>`;
  const companyTabs = renderScoutCompanyTabs(
    companies.map((company) => ({ uid: company.uid, name: company.name })),
    selectedCompany.uid,
  );
  const scoutPortraitCell = (idol: Record<string, unknown> | undefined, fallbackName: string) => {
    const name = typeof idol?.name === "string" ? idol.name : fallbackName;
    const initial = [...(name.trim() || "?")][0] ?? "?";
    const portraitSrc = idol ? idolPortraitPublicSrc(idol, currentIso) : undefined;
    const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
    return portraitSrc
      ? `<img class="idol-thumb" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="idol-thumb-ph" aria-hidden="true">${htmlEsc(initial)}</span>`;
  };

  let rightBody = "";
  if (scoutTab === "audition") {
    const rows = auditionRows
      .map((row) => {
        const active = String(row.uid) === String(selectedApplicant?.uid ?? "") ? ` class="is-selected-row"` : "";
        const status = row.signed_idol_uid ? localizedLiteral(lang, "Signed", "已签约") : localizedLiteral(lang, "Available", "可签约");
        return `<tr${active} data-scout-applicant="${htmlEsc(String(row.uid))}"><td>${htmlEsc(row.name)}</td><td>${htmlEsc(String(row.age))}</td><td>${htmlEsc(row.birthplace)}</td><td class="num">${htmlEsc(String(row.profile_score))}</td><td>${htmlEsc(row.background)}</td><td>${htmlEsc(status)}</td></tr>`;
      })
      .join("");
    const detail = selectedApplicant
      ? [
          selectedApplicant.name,
          lang === "zh-CN" ? `罗马音:${selectedApplicant.romaji || "—"}` : `Romaji: ${selectedApplicant.romaji || "—"}`,
          lang === "zh-CN" ? `年龄:${selectedApplicant.age} · 身高:${selectedApplicant.height} cm` : `Age: ${selectedApplicant.age} · Height: ${selectedApplicant.height} cm`,
          lang === "zh-CN" ? `出生地：${selectedApplicant.birthplace}` : `Birthplace: ${selectedApplicant.birthplace}`,
          lang === "zh-CN" ? `背景：${selectedApplicant.background}` : `Background: ${selectedApplicant.background}`,
          lang === "zh-CN" ? `星探备注：${selectedApplicant.note}` : `Scout note: ${selectedApplicant.note}`,
          lang === "zh-CN" ? `档案分：${selectedApplicant.profile_score}` : `Profile score: ${selectedApplicant.profile_score}`,
          lang === "zh-CN" ? `状态：${selectedApplicant.signed_idol_uid ? "已加入候选" : "未签约候选"}` : `Status: ${selectedApplicant.signed_idol_uid ? "Signed to shortlist" : "Unsigned applicant"}`,
        ]
          .map((line) => htmlEsc(line))
          .join("<br />")
      : selectedCompanySubscribed
        ? localizedLiteral(lang, "Hold today's audition to generate applicants.", "举行今天的试镜来生成候选人。")
        : localizedLiteral(lang, "Subscribe to this scout firm before viewing applicants.", "查看候选人前请先订阅该星探事务所。");
    rightBody = `<section class="fm-card">
        <div class="planner-actions">${selectedCompanySubscribed ? `<button type="button" class="fm-btn fm-btn-accent" data-scout-hold-audition="1">${htmlEsc(localizedLiteral(lang, "Hold Audition Today", "举行今日试镜"))}</button>` : subscribeBtn}</div>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Applicant", "候选人"))}</th><th>${htmlEsc(localizedLiteral(lang, "Age", "年龄"))}</th><th>${htmlEsc(localizedLiteral(lang, "Birthplace", "出生地"))}</th><th>${htmlEsc(localizedLiteral(lang, "Profile", "资料评分"))}</th><th>${htmlEsc(localizedLiteral(lang, "Background", "背景"))}</th><th>${htmlEsc(localizedLiteral(lang, "Status", "状态标记"))}</th></tr></thead>
            <tbody>${rows || `<tr><td colspan="6" class="content-muted">${htmlEsc(selectedCompanySubscribed ? (lang === "zh-CN" ? `${currentIso} 还没有试镜池。` : `No audition pool yet for ${currentIso}.`) : localizedLiteral(lang, "Subscribe to this agent to open the audition pool.", "订阅这家星探公司后才能开启试镜池。"))}</td></tr>`}</tbody>
          </table>
        </div>
      </section>
      <section class="fm-card">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Applicant detail", "候选人详情"))}</h3>
        <div class="content-muted">${detail}</div>
        ${
          selectedApplicant
            ? `<div class="planner-actions"><button type="button" class="fm-btn" data-scout-sign-applicant="${htmlEsc(String(selectedApplicant.uid))}">${htmlEsc(selectedApplicant.signed_idol_uid ? localizedLiteral(lang, "Already Signed", "已签约") : localizedLiteral(lang, "Sign Selected", "签下所选"))}</button></div>`
            : ""
        }
      </section>`;
  } else {
    const rows = leadRows
      .map((row) => {
        const idol = idolsByUid.get(row.idol_uid);
        const active = row.idol_uid === String(selectedLead?.idol_uid ?? "") ? ` class="is-selected-row"` : "";
        if (scoutTab === "freelancer") {
          const name = String(idol?.name ?? row.idol_uid);
          const romaji = idol ? romajiFromRow(idol) : "";
          const age = idol ? ageLabel(idol, currentIso) : "—";
          const height = idol ? heightCmLabel(idol) : "—";
          const abl = idol ? getAbility(attrsFromRow(idol)) : "—";
          const xFollowers = idol ? xFollowersLabel(idol) : "—";
          const groups = row.current_groups.length ? row.current_groups.join(", ") : localizedLiteral(lang, "Independent", "独立");
          const shortlistAction = shortlist.has(row.idol_uid)
            ? `<button type="button" class="fm-btn" data-scout-shortlist="${htmlEsc(row.idol_uid)}" disabled>${htmlEsc(localizedLiteral(lang, "Shortlisted", "已加入候选"))}</button>`
            : `<button type="button" class="fm-btn" data-scout-shortlist="${htmlEsc(row.idol_uid)}">${htmlEsc(localizedLiteral(lang, "Shortlist", "加入候选"))}</button>`;
          return `<tr class="idol-list-table-row${active ? " is-selected-row" : ""}" data-scout-lead="${htmlEsc(row.idol_uid)}" tabindex="0" role="button">
            <td class="idol-list-photo">${scoutPortraitCell(idol, name)}</td>
            <td><button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(row.idol_uid)}">${htmlEsc(name)}</button></td>
            <td>${romaji ? htmlEsc(romaji) : "—"}</td>
            <td>${htmlEsc(age)}</td>
            <td class="num">${htmlEsc(height)}</td>
            <td class="num">${htmlEsc(String(abl))}</td>
            <td class="num">${htmlEsc(xFollowers)}</td>
            <td>${htmlEsc(groups)}</td>
            <td class="num">${shortlistAction}</td>
          </tr>`;
        }
        const shortlistActionTransfer = shortlist.has(row.idol_uid)
          ? `<button type="button" class="fm-btn" data-scout-shortlist="${htmlEsc(row.idol_uid)}" disabled>${htmlEsc(localizedLiteral(lang, "Shortlisted", "已加入候选"))}</button>`
          : `<button type="button" class="fm-btn" data-scout-shortlist="${htmlEsc(row.idol_uid)}">${htmlEsc(localizedLiteral(lang, "Shortlist", "加入候选"))}</button>`;
        return `<tr${active} data-scout-lead="${htmlEsc(row.idol_uid)}"><td><button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(row.idol_uid)}">${htmlEsc(String(idol?.name ?? row.idol_uid))}</button></td><td class="num">${htmlEsc(String(row.profile_score))}</td><td>${htmlEsc(String(idol?.birthplace ?? "—"))}</td><td>${htmlEsc(row.current_groups.length ? row.current_groups.join(", ") : localizedLiteral(lang, "Independent", "独立"))}</td><td>${htmlEsc(row.reason)}</td><td class="num">${shortlistActionTransfer}</td></tr>`;
      })
      .join("");
    const leadIdol = selectedLead ? idolsByUid.get(selectedLead.idol_uid) : null;
    const detail = selectedLead && leadIdol
      ? [
          String(leadIdol.name ?? selectedLead.idol_uid),
          lang === "zh-CN" ? `档案分：${selectedLead.profile_score}/100` : `Profile score: ${selectedLead.profile_score}/100`,
          lang === "zh-CN" ? `出生地：${String(leadIdol.birthplace ?? "—")}` : `Birthplace: ${String(leadIdol.birthplace ?? "—")}`,
          lang === "zh-CN" ? `当前所属：${selectedLead.current_groups.length ? selectedLead.current_groups.join(", ") : "独立"}` : `Current groups: ${selectedLead.current_groups.length ? selectedLead.current_groups.join(", ") : "Independent"}`,
          lang === "zh-CN" ? `人气：${num(leadIdol.popularity, 0)} · 粉丝：${num(leadIdol.fan_count, 0).toLocaleString("ja-JP")} · X：${num(leadIdol.x_followers, 0).toLocaleString("ja-JP")}` : `Popularity: ${num(leadIdol.popularity, 0)} · Fans: ${num(leadIdol.fan_count, 0).toLocaleString("ja-JP")} · X: ${num(leadIdol.x_followers, 0).toLocaleString("ja-JP")}`,
          lang === "zh-CN" ? `星探备注：${selectedLead.reason}` : `Scout read: ${selectedLead.reason}`,
          lang === "zh-CN" ? `候选状态：${shortlist.has(selectedLead.idol_uid) ? "已追踪" : "尚未加入候选"}` : `Shortlist: ${shortlist.has(selectedLead.idol_uid) ? "Already tracked" : "Not yet shortlisted"}`,
        ]
          .map((line) => htmlEsc(line))
          .join("<br />")
      : localizedLiteral(lang, "Select a scout lead to review fit and shortlist status.", "选择一条星探线索以查看适配度和候选状态。");
    rightBody =
      scoutTab === "freelancer"
        ? `<section class="fm-card scout-fullwidth-card">
            <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Freelancer pool", "自由人池"))}</h3>
            <div class="planner-actions">${subscribeBtn}</div>
            <div class="table-scroll">
              <table class="fm-table idol-list-table scout-idol-list-table">
                <thead><tr><th></th><th>${htmlEsc(localizedLiteral(lang, "Name", "姓名"))}</th><th>${htmlEsc(localizedLiteral(lang, "Romaji", "罗马音"))}</th><th>${htmlEsc(localizedLiteral(lang, "Age", "年龄"))}</th><th>${htmlEsc(localizedLiteral(lang, "Height cm", "身高 cm"))}</th><th>${htmlEsc(localizedLiteral(lang, "Ability", "能力"))}</th><th>${htmlEsc(localizedLiteral(lang, "X followers", "X 粉丝数"))}</th><th>${htmlEsc(localizedLiteral(lang, "Current group(s)", "当前所属组合"))}</th><th>${htmlEsc(localizedLiteral(lang, "Shortlist", "加入候选"))}</th></tr></thead>
                <tbody>${rows || `<tr><td colspan="9" class="content-muted">${htmlEsc(selectedCompanySubscribed ? localizedLiteral(lang, "No freelancer leads in this pool yet.", "这个池子里暂时没有自由人线索。") : localizedLiteral(lang, "Subscribe to this agent to receive leads.", "订阅这家星探公司后即可获得线索。"))}</td></tr>`}</tbody>
              </table>
            </div>
          </section>
          <section class="fm-card scout-fullwidth-card">
            <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Lead detail", "线索详情"))}</h3>
            <div class="content-muted">${detail}</div>
            ${
              selectedLead
                ? `<div class="planner-actions"><button type="button" class="fm-btn" data-scout-shortlist="${htmlEsc(selectedLead.idol_uid)}">${htmlEsc(shortlist.has(selectedLead.idol_uid) ? localizedLiteral(lang, "Already Shortlisted", "已加入候选") : localizedLiteral(lang, "Shortlist Selected", "加入所选候选"))}</button></div>`
                : ""
            }
          </section>`
        : `<section class="fm-card">
            <div class="planner-actions">${subscribeBtn}</div>
            <div class="table-scroll">
              <table class="fm-table">
                <thead><tr><th>${htmlEsc(localizedLiteral(lang, "Idol", "偶像"))}</th><th>${htmlEsc(localizedLiteral(lang, "Profile", "资料评分"))}</th><th>${htmlEsc(localizedLiteral(lang, "Birthplace", "出生地"))}</th><th>${htmlEsc(localizedLiteral(lang, "Current groups", "当前所属"))}</th><th>${htmlEsc(localizedLiteral(lang, "Scout read", "星探评价"))}</th><th>${htmlEsc(localizedLiteral(lang, "Shortlist", "加入候选"))}</th></tr></thead>
                <tbody>${rows || `<tr><td colspan="6" class="content-muted">${htmlEsc(selectedCompanySubscribed ? localizedLiteral(lang, "No scout leads in this pool yet.", "这个池子里暂时没有星探线索。") : localizedLiteral(lang, "Subscribe to this agent to receive leads.", "订阅这家星探公司后即可获得线索。"))}</td></tr>`}</tbody>
              </table>
            </div>
          </section>
          <section class="fm-card">
            <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Lead detail", "线索详情"))}</h3>
            <div class="content-muted">${detail}</div>
            ${
              selectedLead
                ? `<div class="planner-actions"><button type="button" class="fm-btn" data-scout-shortlist="${htmlEsc(selectedLead.idol_uid)}">${htmlEsc(shortlist.has(selectedLead.idol_uid) ? localizedLiteral(lang, "Already Shortlisted", "已加入候选") : localizedLiteral(lang, "Shortlist Selected", "加入所选候选"))}</button></div>`
                : ""
            }
          </section>`;
  }

  if (scoutTab === "freelancer") {
    return `<section class="content-panel scout-view">
      <h2 class="content-h2">${htmlEsc(navLabel(lang, "Scout"))}</h2>
      <p class="content-muted">${htmlEsc(lang === "zh-CN" ? `当前经营组合：${managedGroupName || "当前组合"}。自由人公司现在主要提供规模较小、机构之间重叠较低的本地候选池。` : `Managed group: ${managedGroupName || "Managed group"}. Freelancer firms now surface smaller local pools with low overlap between agencies.`)}</p>
      ${renderScoutTabs(scoutTab, lang)}
      <section class="fm-card scout-fullwidth-card">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Scout firms", "星探公司"))}</h3>
        ${companyTabs}
        <div class="content-muted">${companyDetail}</div>
      </section>
      ${rightBody}
    </section>`;
  }

  return `<section class="content-panel scout-view">
    <h2 class="content-h2">${htmlEsc(navLabel(lang, "Scout"))}</h2>
    <p class="content-muted">${htmlEsc(lang === "zh-CN" ? `当前经营组合：${managedGroupName || "当前组合"}。自由人公司现在主要提供规模较小、机构之间重叠较低的本地候选池。` : `Managed group: ${managedGroupName || "Managed group"}. Freelancer firms now surface smaller local pools with low overlap between agencies.`)}</p>
    ${renderScoutTabs(scoutTab, lang)}
    <div class="lives-planner-grid">
      <section class="fm-card">
        <h3 class="content-h3">${htmlEsc(localizedLiteral(lang, "Scout firms", "星探公司"))}</h3>
        <div class="inbox-list-col scout-company-list">${companyRows}</div>
        <div class="content-muted">${companyDetail}</div>
      </section>
      <div class="scout-right-stack">${rightBody}</div>
    </div>
  </section>`;
}

export function renderMainContent(
  ctx: {
    browseMode: boolean;
    browseData: LoadedScenario | null;
    save: GameSavePayload | null;
    view: DesktopNavId;
    idolDetailUid: string | null;
    groupDetailUid: string | null;
    idolListLayout: "cards" | "list";
    songsGroupUid: string | null;
    songsWorkspaceTab: SongsWorkspaceTab;
    songsDiscographyKey: string | null;
    songsDetailUid: string | null;
    makingTab: MakingTab;
    selectedCdProjectUid: string | null;
    inboxSelectedUid: string | null;
    livesTab: LivesTab;
    leaguePanelTab: LeaguePanelTab;
    scheduledLiveUid: string | null;
    newLiveForm: NewLiveFormState;
    selectedLiveSongTitle: string | null;
    selectedSetlistSongIndex: number | null;
    scoutTab: ScoutTab;
    trainingTab: TrainingTab;
    trainingRosterSortKey: TrainingRosterSortKey;
    trainingRosterSortDir: "asc" | "desc";
    roleBenchmarkPreferences?: RoleBenchmarkKey[];
    mediaTab: MediaTab;
    financeTab: FinanceTab;
    financeHistoryRange: FinanceHistoryRange;
    selectedScoutLeadUid: string | null;
    selectedScoutApplicantUid: string | null;
    /** `YYYY-MM-01` for Schedule month calendar; null = month of next simulation day. */
    scheduleCalendarMonthStart: string | null;
    scheduleWeekAnchorIso: string | null;
    attentionActionUid?: string | null;
    lang: UiLanguage;
    simulationBusy: boolean;
  },
): string {
  const {
    browseMode,
    browseData,
    save,
    view,
    idolDetailUid,
    groupDetailUid,
    idolListLayout,
    songsGroupUid,
    songsWorkspaceTab,
    songsDiscographyKey,
    songsDetailUid,
    makingTab,
    selectedCdProjectUid,
    inboxSelectedUid,
    livesTab,
    leaguePanelTab,
    scheduledLiveUid,
    newLiveForm,
    selectedLiveSongTitle,
    selectedSetlistSongIndex,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    roleBenchmarkPreferences,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    scheduleWeekAnchorIso,
    attentionActionUid,
    lang,
    simulationBusy,
  } = ctx;

  if (browseMode && browseData) {
    const refIso = displayReferenceIso(null, browseData.preset?.opening_date);
    switch (view) {
      case "Idols": {
        const uidStr = idolDetailUid?.trim() ?? "";
        if (uidStr) {
          const row = browseData.idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uidStr);
          if (row) return renderIdolDetailPage(row, browseData.groups, refIso, lang);
          return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(`Idol '${uidStr}' not in snapshot.`)}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-idol-detail-back">${htmlEsc(t(lang, "idol_back_list"))}</button>
            </section>`;
        }
        return renderIdolsList(
          browseData.idols,
          refIso,
          lang === "zh-CN" ? "偶像（浏览）" : "Idols (browse)",
          idolListLayout,
          lang,
          browseData.groups,
          lang === "zh-CN"
            ? `快照中共有 ${browseData.idols.length.toLocaleString()} 条记录 · JSON 缺失属性时会使用默认值。`
            : `${browseData.idols.length.toLocaleString()} rows in snapshot · default attributes when missing in JSON.`,
        );
      }
      case "Groups": {
        const gUid = groupDetailUid?.trim() ?? "";
        if (gUid) {
          const grow = browseData.groups.find((r) => String((r as { uid?: unknown }).uid ?? "") === gUid);
          if (grow)
            return renderGroupDetailPage(
              grow,
              browseData.preset?.name ? `Browse · ${browseData.preset.name}` : "Browse",
              {
                idols: browseData.idols,
                songs: browseData.songs,
                groups: browseData.groups,
                lives: browseData.lives ?? null,
                referenceIso: browseData.preset.opening_date ?? null,
                sharedReleases: browseData.shared_releases ?? [],
                lang,
              },
            );
          return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(t(lang, "error_group_not_in_snapshot", { uid: gUid }))}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc(localizedLiteral(lang, "← Groups", "← 组合列表"))}</button>
            </section>`;
        }
        return renderBrowseGroups(browseData, lang);
      }
      case "Songs":
      return renderSongsList(browseData.songs, {
        lang,
        subtitle: browseData.preset?.name ?? undefined,
        groups: browseData.groups,
        sharedReleases: browseData.shared_releases ?? [],
        selectedGroupUid: songsGroupUid ?? "",
          selectedWorkspaceTab: songsWorkspaceTab,
          selectedDiscographyKey: songsDiscographyKey,
          selectedSongUid: songsDetailUid,
          catalogReferenceIso: browseData.preset?.opening_date ?? null,
          trackSplitSurface: "songs",
        });
      default:
        return renderPlaceholder(String(view));
    }
  }

  if (!save) return renderPlaceholder("", t(lang, "shell_no_save_loaded"));

  const officialScheduleBundle = findManagedOfficialScheduleBundle(browseData, save);

  switch (view) {
    case "Inbox":
      return renderInbox(save, inboxSelectedUid, simulationBusy, ctx.attentionActionUid ?? null, lang);
    case "Finances":
      return renderFinancesProjectionView(save, financeHistoryRange, financeTab, lang);
    case "Idols": {
      const refIso = displayReferenceIso(save, browseData?.preset?.opening_date);
      const uidStr = idolDetailUid?.trim() ?? "";
      if (uidStr) {
        const row = save.database_snapshot.idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uidStr);
        if (row) return renderIdolDetailPage(row, save.database_snapshot.groups, refIso, lang);
        return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(t(lang, "error_idol_not_in_save_snapshot", { uid: uidStr }))}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-idol-detail-back">${htmlEsc(t(lang, "idol_back_list"))}</button>
            </section>`;
      }
      return renderIdolsList(
        save.database_snapshot.idols,
        refIso,
        navLabel(lang, "Idols"),
        idolListLayout,
        lang,
        save.database_snapshot.groups,
        localizedLiteral(lang, "Attributes from save (defaults applied where missing).", "来自存档的属性（缺失项已套用默认值）。"),
      );
    }
    case "Groups": {
      const gUid = groupDetailUid?.trim() ?? "";
      if (gUid) {
        const grow = save.database_snapshot.groups.find((r) => String((r as { uid?: unknown }).uid ?? "") === gUid);
        if (grow) return renderGroupDetailPage(grow, "Management roster", {
          idols: save.database_snapshot.idols,
          songs: save.database_snapshot.songs,
          groups: save.database_snapshot.groups,
          lives: browseData?.lives ?? null,
          sharedReleases: save.database_snapshot.shared_releases,
          referenceIso:
            save.current_date ??
            save.game_start_date ??
            save.scenario_context?.startup_date ??
            browseData?.preset.opening_date ??
            null,
          lang,
        });
        return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(t(lang, "error_group_not_in_save_snapshot", { uid: gUid }))}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc(localizedLiteral(lang, "← Groups", "← 组合列表"))}</button>
            </section>`;
      }
      return renderGroupsManaged(save, lang);
    }
    case "Schedule":
      return renderSchedule(save, officialScheduleBundle, scheduleCalendarMonthStart, scheduleWeekAnchorIso, lang);
    case "Media":
      return renderMediaView(save, officialScheduleBundle, mediaTab, lang);
    case "Lives":
      return renderLivesView(
        save,
        livesTab,
        scheduledLiveUid,
        newLiveForm,
        selectedLiveSongTitle,
        selectedSetlistSongIndex,
        browseData?.festivals ?? null,
        lang,
        leaguePanelTab,
      );
    case "Training":
      return renderTraining(save, trainingTab, trainingRosterSortKey, trainingRosterSortDir, lang, roleBenchmarkPreferences ?? []);
    case "Making":
      if (makingTab === "goods") return renderGoodsInventoryTable(save, save.goods_inventory);
      if (makingTab === "cd") {
        return renderCdProjectsView(
          save,
          selectedCdProjectUid,
          save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null,
        );
      }
      return renderSongsList(save.database_snapshot.songs, {
        lang,
        subtitle: save.scenario_context?.startup_date
          ? localizedLiteral(lang, `Opening ${save.scenario_context.startup_date}`, `起始日期 ${save.scenario_context.startup_date}`)
          : undefined,
        groups: save.database_snapshot.groups,
        sharedReleases: save.database_snapshot.shared_releases,
        selectedGroupUid: songsGroupUid ?? "",
        selectedWorkspaceTab: "group_songs",
        selectedDiscographyKey: null,
        catalogReferenceIso:
          save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null,
        trackSplitSurface: "making",
        managedGroupUid: save.managing_group_uid ?? null,
      });
    case "Songs":
      return renderSongsList(save.database_snapshot.songs, {
        lang,
        subtitle: save.scenario_context?.startup_date
          ? localizedLiteral(lang, `Opening ${save.scenario_context.startup_date}`, `起始日期 ${save.scenario_context.startup_date}`)
          : undefined,
        groups: save.database_snapshot.groups,
        sharedReleases: save.database_snapshot.shared_releases,
        selectedGroupUid: songsGroupUid ?? "",
        selectedWorkspaceTab: songsWorkspaceTab,
        selectedDiscographyKey: songsDiscographyKey,
        selectedSongUid: songsDetailUid,
        catalogReferenceIso:
          save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null,
        trackSplitSurface: "songs",
        managedGroupUid: save.managing_group_uid ?? null,
      });
    case "Scout":
      return renderScoutView(save, scoutTab, selectedScoutLeadUid, selectedScoutApplicantUid, lang);
    default:
      return renderPlaceholder(view);
  }
}

export interface DesktopShellProps {
  lang: UiLanguage;
  browseMode: boolean;
  browseData: LoadedScenario | null;
  save: GameSavePayload | null;
  preview: WebPreviewBundle | null;
  currentView: DesktopNavId;
  /** When set and view is Idols, show profile instead of list. */
  idolDetailUid?: string | null;
  /** When set and view is Groups, show group profile instead of directory. */
  groupDetailUid?: string | null;
  /** Idols directory layout (cards vs table). */
  idolListLayout: "cards" | "list";
  /** Songs screen: selected group UID (snapshot). */
  songsGroupUid: string | null;
  /** Songs screen: `group_songs` (track list) or `disc` (discography), like desktop `main_ui.py`. */
  songsWorkspaceTab: SongsWorkspaceTab;
  /** Songs Discography tab: selected release bucket key. */
  songsDiscographyKey: string | null;
  /** Songs tab: selected song detail uid. */
  songsDetailUid: string | null;
  makingTab: MakingTab;
  selectedCdProjectUid: string | null;
  /** Selected inbox notification uid (management mode). */
  inboxSelectedUid: string | null;
  livesTab: LivesTab;
  leaguePanelTab: LeaguePanelTab;
  scheduledLiveUid: string | null;
  newLiveForm: NewLiveFormState;
  selectedLiveSongTitle: string | null;
  selectedSetlistSongIndex: number | null;
  scoutTab: ScoutTab;
  trainingTab: TrainingTab;
  trainingRosterSortKey: TrainingRosterSortKey;
  trainingRosterSortDir: "asc" | "desc";
  roleBenchmarkPreferences?: RoleBenchmarkKey[];
  mediaTab: MediaTab;
  financeTab: FinanceTab;
  financeHistoryRange: FinanceHistoryRange;
  selectedScoutLeadUid: string | null;
  selectedScoutApplicantUid: string | null;
  /** Selected month for Schedule calendar (`YYYY-MM-01`); null follows next simulation day. */
  scheduleCalendarMonthStart: string | null;
  /** Selected day for Schedule week strip; null follows next simulation week. */
  scheduleWeekAnchorIso: string | null;
  canGoBack: boolean;
  canGoForward: boolean;
  simulationBusy: boolean;
  slot: number;
  occupiedSlots: number[];
  slotSummaries: SlotSummary[];
  tutorialOverlayHtml?: string;
  selectedWikiKey?: string | null;
  feedbackEntries?: FeedbackEntry[];
  feedbackStatusMessage?: string | null;
  wikiModalOpen?: boolean;
  feedbackModalOpen?: boolean;
  attentionActionUid?: string | null;
  /** Immersive live performance session; when set, chrome collapses to top bar only. */
  liveModeSession?: LiveModeSession | null;
}

export function renderDesktopShell(p: DesktopShellProps): string {
  const {
    lang,
    browseMode,
    browseData,
    save,
    preview,
    currentView,
    idolDetailUid,
    groupDetailUid,
    idolListLayout,
    songsGroupUid,
    songsWorkspaceTab,
    songsDiscographyKey,
    songsDetailUid,
    makingTab,
    selectedCdProjectUid,
    inboxSelectedUid,
    livesTab,
    leaguePanelTab,
    scheduledLiveUid,
    newLiveForm,
    selectedLiveSongTitle,
    selectedSetlistSongIndex,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    roleBenchmarkPreferences,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    scheduleWeekAnchorIso,
    canGoBack,
    canGoForward,
    slot,
    occupiedSlots,
    slotSummaries,
    tutorialOverlayHtml,
    selectedWikiKey,
    feedbackEntries,
    feedbackStatusMessage,
    wikiModalOpen,
    feedbackModalOpen,
  } = p;
  const finances = save ? getActiveFinances(save) : null;
  const grp = save ? getPrimaryGroup(save) : null;
  const displayName =
    grp && typeof grp.name === "string" ? grp.name : browseData?.preset?.name ?? preview?.group?.name ?? "—";
  const titleClickable = htmlEsc(displayName);
  const dateStr =
    save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? browseData?.preset.opening_date ?? "";
  const dateLabel = formatLongDate(dateStr || undefined);

  const navSource = browseMode ? BROWSE_NAV_ITEMS : MANAGEMENT_NAV_ITEMS;
  const navButtons = navSource
    .map((item) => {
      const active = item === currentView ? 'aria-current="page"' : "";
      const cls = item === currentView ? "nav-item is-active" : "nav-item";
      return `<li role="none"><button type="button" class="${cls}" data-nav="${htmlEsc(item)}" ${active}>${htmlEsc(navLabel(lang, item))}</button></li>`;
    })
    .join("");

  const slotSummaryMap = new Map(slotSummaries.map((row) => [row.slot, row.label] as const));
  const slotOpts = Array.from({ length: AUTOSAVE_SLOT + 1 }, (_, s) => {
    const detail = slotSummaryMap.get(s);
    const label = detail ? detail : s === AUTOSAVE_SLOT ? "Autosave" : `Slot ${s}`;
    return `<option value="${s}" ${s === slot ? "selected" : ""}>${label}</option>`;
  }).join("");

  const mainInner = renderMainContent({
    browseMode,
    browseData,
    save,
    view: currentView,
    idolDetailUid: idolDetailUid ?? null,
    groupDetailUid: groupDetailUid ?? null,
    idolListLayout,
    songsGroupUid: songsGroupUid ?? null,
    songsWorkspaceTab,
    songsDiscographyKey,
    songsDetailUid: songsDetailUid ?? null,
    makingTab,
    selectedCdProjectUid,
    inboxSelectedUid: inboxSelectedUid ?? null,
    livesTab,
    leaguePanelTab,
    scheduledLiveUid: scheduledLiveUid ?? null,
    newLiveForm,
    selectedLiveSongTitle: selectedLiveSongTitle ?? null,
    selectedSetlistSongIndex: selectedSetlistSongIndex ?? null,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    roleBenchmarkPreferences,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid: selectedScoutLeadUid ?? null,
    selectedScoutApplicantUid: selectedScoutApplicantUid ?? null,
    scheduleCalendarMonthStart: scheduleCalendarMonthStart ?? null,
    scheduleWeekAnchorIso: scheduleWeekAnchorIso ?? null,
    lang: "en",
    simulationBusy: p.simulationBusy,
  });

  const cashPill = finances
    ? `<div class="fm-cash-pill" title="Cash on hand"><span class="fm-cash-label">JPY</span> ${finances.cash_yen.toLocaleString("ja-JP")}</div>`
    : `<div class="fm-cash-pill content-muted" title="Browse">Browse</div>`;

  const inboxBlock = save && !browseMode ? getBlockingNotificationForSave(save) : null;
  const nextHint =
    inboxBlock?.title === "Today's live schedule" ? "Start live to proceed" : inboxBlock ? `Inbox: ${inboxBlock.title}` : "Advance one simulated day";

  const nextDayBtn = browseMode
    ? `<div class="fm-next-cluster"><button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" disabled title="Not in browse mode"><span id="btn-next-day-label">${htmlEsc("NEXT DAY")}</span></button><span class="fm-next-spinner" aria-hidden="true"></span></div>`
    : `<div class="fm-next-cluster"><button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" ${p.simulationBusy ? "disabled" : ""} title="${htmlEsc(nextHint)}"><span id="btn-next-day-label">${htmlEsc("NEXT DAY")}</span></button><span class="fm-next-spinner${p.simulationBusy ? " is-active" : ""}" aria-hidden="true"></span></div>`;

  const ver = save ? String(save.version ?? "—") : browseData ? "browse" : "—";

  return `
<div class="fm-app">
  <header class="fm-top-bar" role="banner">
    <div class="fm-top-bar-left">
      <details class="fm-home-dropdown">
        <summary class="fm-btn fm-btn-accent">Home</summary>
        <div class="fm-home-menu" role="menu">
          <button type="button" class="fm-menu-action" id="btn-main-menu">Main menu</button>
          <label class="fm-menu-row">Slot <select id="slot-select" class="fm-select" aria-label="Save slot">${slotOpts}</select></label>
          <button type="button" class="fm-menu-action" id="btn-save" ${browseMode ? "disabled" : ""}>Save game</button>
          <button type="button" class="fm-menu-action" id="btn-load">Load game</button>
          <button type="button" class="fm-menu-action" id="btn-new">New game</button>
          <button type="button" class="fm-menu-action danger" id="btn-clear">Clear slot</button>
        </div>
      </details>
      <button type="button" class="fm-btn fm-btn-history" ${canGoBack ? "" : "disabled"} title="Back" aria-label="Back" data-history="back">&lsaquo;</button>
      <button type="button" class="fm-btn fm-btn-history" ${canGoForward ? "" : "disabled"} title="Forward" aria-label="Forward" data-history="fwd">&rsaquo;</button>
      <h1 class="fm-game-title"><span class="fm-game-title-main">IDOL PRODUCER</span><span class="fm-game-title-sub" title="Managed group">${browseMode ? htmlEsc("Browse database") : titleClickable}</span></h1>
    </div>
    <div class="fm-top-bar-center">
      <button type="button" class="fm-date-btn" id="btn-goto-schedule" data-nav="Schedule" title="Open Schedule" ${browseMode ? "" : ""}>${htmlEsc(dateLabel)}</button>
    </div>
    <div class="fm-top-bar-right">
      ${nextDayBtn}
      ${cashPill}
    </div>
  </header>

  <div class="fm-body">
    <aside class="fm-sidebar" aria-label="Main navigation">
      <nav class="fm-side-nav" aria-label="Sections">
        <ul class="fm-side-nav-list" role="list">${navButtons}</ul>
      </nav>
      ${renderWikiPanel(lang, selectedWikiKey ?? null, browseMode, currentView)}
      ${renderSidebarUtilityPanel(lang)}
    </aside>

    <main class="fm-content" id="main-content" role="main" aria-label="${htmlEsc(currentView)}">
      <div class="fm-content-inner">
        ${mainInner}
      </div>
    </main>
  </div>

  <footer class="fm-status-bar" role="contentinfo">
    <span class="fm-status-item">${browseMode ? "Browse" : `Save v${save?.version ?? "?"}`}</span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">View: <strong>${htmlEsc(currentView)}</strong></span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">Turn: <strong>${save?.turn_number ?? 0}</strong></span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">${htmlEsc(typeof ver === "string" ? ver : String(ver))}</span>
  </footer>
  ${wikiModalOpen ? `<div class="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="wiki-modal-title"><div class="tutorial-overlay__backdrop" data-wiki-modal-close="1"></div><section class="tutorial-overlay__panel wiki-modal__panel"><div class="tutorial-overlay__header"><div><p class="tutorial-overlay__eyebrow">${htmlEsc(lang === "zh-CN" ? "完整百科" : "Full Wiki")}</p><h2 class="tutorial-overlay__title" id="wiki-modal-title">${htmlEsc(lang === "zh-CN" ? "完整百科" : "Full Wiki")}</h2></div><button type="button" class="tutorial-overlay__close" aria-label="${htmlEsc(lang === "zh-CN" ? "关闭百科" : "Close wiki")}" data-wiki-modal-close="1">x</button></div><div class="wiki-modal__content">${renderFullWikiPanel(lang, selectedWikiKey ?? null)}</div></section></div>` : ""}
  ${feedbackModalOpen ? renderFeedbackModal(lang, currentView, isoDatePart(dateStr || ""), feedbackEntries ?? [], feedbackStatusMessage ?? null) : ""}
</div>`;
}

export function renderDesktopShellI18n(p: DesktopShellProps): string {
  const {
    lang,
    browseMode,
    browseData,
    save,
    preview,
    currentView,
    idolDetailUid,
    groupDetailUid,
    idolListLayout,
      songsGroupUid,
      songsWorkspaceTab,
      songsDiscographyKey,
      songsDetailUid,
      makingTab,
      inboxSelectedUid,
    livesTab,
    leaguePanelTab,
    scheduledLiveUid,
    newLiveForm,
    selectedLiveSongTitle,
    selectedSetlistSongIndex,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    roleBenchmarkPreferences,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    scheduleWeekAnchorIso,
    canGoBack,
    canGoForward,
    slot,
    occupiedSlots,
    slotSummaries,
    tutorialOverlayHtml,
    selectedWikiKey,
    feedbackEntries,
    feedbackStatusMessage,
    wikiModalOpen,
    feedbackModalOpen,
    liveModeSession,
  } = p;
  const finances = save ? getActiveFinances(save) : null;
  const grp = save ? getPrimaryGroup(save) : null;
  const displayName =
    grp && typeof grp.name === "string" ? grp.name : browseData?.preset?.name ?? preview?.group?.name ?? "-";
  const titleClickable = htmlEsc(displayName);
  const dateStr =
    save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? browseData?.preset.opening_date ?? "";
  const dateLabel = formatLongDate(dateStr || undefined);

  const navSource = browseMode ? BROWSE_NAV_ITEMS : MANAGEMENT_NAV_ITEMS;
  const navButtons = navSource
    .map((item) => {
      const active = item === currentView ? 'aria-current="page"' : "";
      const cls = item === currentView ? "nav-item is-active" : "nav-item";
      return `<li role="none"><button type="button" class="${cls}" data-nav="${htmlEsc(item)}" ${active}>${htmlEsc(navLabel(lang, item))}</button></li>`;
    })
    .join("");

  const slotSummaryMap = new Map(slotSummaries.map((row) => [row.slot, row.label] as const));
  const slotOpts = Array.from({ length: AUTOSAVE_SLOT + 1 }, (_, s) => {
    const detail = slotSummaryMap.get(s);
    const label = detail ? detail : s === AUTOSAVE_SLOT ? t(lang, "opening_autosave") : `${t(lang, "shell_slot")} ${s}`;
    return `<option value="${s}" ${s === slot ? "selected" : ""}>${htmlEsc(label)}</option>`;
  }).join("");

  const mainInner = liveModeSession
    ? renderLiveModeView(liveModeSession, lang)
    : renderMainContent({
    browseMode,
    browseData,
    save,
    view: currentView,
    idolDetailUid: idolDetailUid ?? null,
    groupDetailUid: groupDetailUid ?? null,
    idolListLayout,
    songsGroupUid: songsGroupUid ?? null,
    songsWorkspaceTab,
    songsDiscographyKey,
    songsDetailUid: songsDetailUid ?? null,
    makingTab,
    selectedCdProjectUid: p.selectedCdProjectUid ?? null,
    inboxSelectedUid: inboxSelectedUid ?? null,
    livesTab,
    leaguePanelTab,
    scheduledLiveUid: scheduledLiveUid ?? null,
    newLiveForm,
    selectedLiveSongTitle: selectedLiveSongTitle ?? null,
    selectedSetlistSongIndex: selectedSetlistSongIndex ?? null,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    roleBenchmarkPreferences,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid: selectedScoutLeadUid ?? null,
    selectedScoutApplicantUid: selectedScoutApplicantUid ?? null,
    scheduleCalendarMonthStart: scheduleCalendarMonthStart ?? null,
    scheduleWeekAnchorIso: scheduleWeekAnchorIso ?? null,
    lang,
    simulationBusy: p.simulationBusy,
    attentionActionUid: p.attentionActionUid ?? null,
  });

  const cashPill = finances
    ? `<div class="fm-cash-pill" title="${htmlEsc(t(lang, "shell_cash_on_hand"))}"><span class="fm-cash-label">JPY</span> ${finances.cash_yen.toLocaleString("ja-JP")}</div>`
    : `<div class="fm-cash-pill content-muted" title="${htmlEsc(t(lang, "shell_browse"))}">${htmlEsc(t(lang, "shell_browse"))}</div>`;

  const inboxBlock = save && !browseMode ? getBlockingNotificationForSave(save) : null;
  const nextHint =
    liveModeSession
      ? t(lang, "live_mode_title")
      : inboxBlock?.title === "Today's live schedule"
      ? localizedLiteral(lang, "Start live to proceed", "开始演出后即可继续")
      : inboxBlock
        ? `${navLabel(lang, "Inbox")}: ${inboxBlock.title}`
        : t(lang, "shell_advance_one_day");

  const nextDayBtn = browseMode
    ? `<div class="fm-next-cluster"><button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" disabled title="${htmlEsc(t(lang, "shell_not_in_browse"))}"><span id="btn-next-day-label">${htmlEsc(t(lang, "shell_next_day"))}</span></button><span class="fm-next-spinner" aria-hidden="true"></span></div>`
    : `<div class="fm-next-cluster"><button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" ${p.simulationBusy || liveModeSession ? "disabled" : ""} title="${htmlEsc(nextHint)}"><span id="btn-next-day-label">${htmlEsc(t(lang, "shell_next_day"))}</span></button><span class="fm-next-spinner${p.simulationBusy ? " is-active" : ""}" aria-hidden="true"></span></div>`;

  const ver = save ? String(save.version ?? "-") : browseData ? t(lang, "shell_browse") : "-";
  const statusLeft = browseMode ? t(lang, "shell_browse") : t(lang, "shell_save_version", { version: save?.version ?? "?" });
  const languageSelect = languageOptions()
    .map((opt) => `<option value="${opt.value}" ${opt.value === lang ? "selected" : ""}>${htmlEsc(opt.label)}</option>`)
    .join("");

  return `
<div class="fm-app${liveModeSession ? " is-live-mode" : ""}">
  <header class="fm-top-bar" role="banner">
    <div class="fm-top-bar-left">
      <details class="fm-home-dropdown">
        <summary class="fm-btn fm-btn-accent">${htmlEsc(t(lang, "shell_home"))}</summary>
        <div class="fm-home-menu" role="menu">
          <button type="button" class="fm-menu-action" id="btn-main-menu">${htmlEsc(t(lang, "shell_main_menu"))}</button>
          <a class="fm-menu-action fm-menu-link" href="${htmlEsc(gameManualHref(lang))}" target="_blank" rel="noopener noreferrer" role="menuitem">${htmlEsc(t(lang, "shell_game_manual"))}</a>
          <a class="fm-menu-action fm-menu-link" href="${htmlEsc(oshiChartHref())}" target="_blank" rel="noopener noreferrer" role="menuitem">${htmlEsc(t(lang, "shell_oshi_chart"))}</a>
          <a class="fm-menu-action fm-menu-link" href="${htmlEsc(ikonoijoyBest10Href())}" target="_blank" rel="noopener noreferrer" role="menuitem">${htmlEsc(t(lang, "shell_ikonoijoy_best10"))}</a>
          <button type="button" class="fm-menu-action" id="btn-open-tutorial" ${browseMode || liveModeSession ? "disabled" : ""}>${htmlEsc(tutorialMenuLabel(lang))}</button>
          <label class="fm-menu-row">${htmlEsc(t(lang, "shell_slot"))} <select id="slot-select" class="fm-select" aria-label="${htmlEsc(t(lang, "shell_slot"))}">${slotOpts}</select></label>
          <label class="fm-menu-row">${htmlEsc(t(lang, "language"))} <select id="lang-select-shell" class="fm-select" aria-label="${htmlEsc(t(lang, "language"))}">${languageSelect}</select></label>
          <button type="button" class="fm-menu-action" id="btn-save" ${browseMode ? "disabled" : ""}>${htmlEsc(t(lang, "shell_save_game"))}</button>
          <button type="button" class="fm-menu-action" id="btn-load">${htmlEsc(t(lang, "shell_load_game"))}</button>
          <button type="button" class="fm-menu-action" id="btn-new">${htmlEsc(t(lang, "shell_new_game"))}</button>
          <button type="button" class="fm-menu-action danger" id="btn-clear">${htmlEsc(t(lang, "shell_clear_slot"))}</button>
        </div>
      </details>
      <button type="button" class="fm-btn fm-btn-history" ${canGoBack && !liveModeSession ? "" : "disabled"} title="${htmlEsc(t(lang, "shell_back"))}" aria-label="${htmlEsc(t(lang, "shell_back"))}" data-history="back">&lsaquo;</button>
      <button type="button" class="fm-btn fm-btn-history" ${canGoForward && !liveModeSession ? "" : "disabled"} title="${htmlEsc(t(lang, "shell_forward"))}" aria-label="${htmlEsc(t(lang, "shell_forward"))}" data-history="fwd">&rsaquo;</button>
      <h1 class="fm-game-title"><span class="fm-game-title-main">IDOL PRODUCER</span><span class="fm-game-title-sub" title="${htmlEsc(t(lang, "shell_managed_group"))}">${browseMode ? htmlEsc(t(lang, "shell_browse_database")) : titleClickable}</span></h1>
    </div>
    <div class="fm-top-bar-center">
      <button type="button" class="fm-date-btn" id="btn-goto-schedule" data-nav="Schedule" title="${htmlEsc(t(lang, "shell_open_schedule"))}" ${liveModeSession ? "disabled" : ""}>${htmlEsc(dateLabel)}</button>
    </div>
    <div class="fm-top-bar-right">
      ${nextDayBtn}
      ${cashPill}
    </div>
  </header>

  <div class="fm-body">
    ${
      liveModeSession
        ? ""
        : `<aside class="fm-sidebar" aria-label="${htmlEsc(t(lang, "shell_main_navigation"))}">
      <nav class="fm-side-nav" aria-label="${htmlEsc(t(lang, "shell_sections"))}">
        <ul class="fm-side-nav-list" role="list">${navButtons}</ul>
      </nav>
      ${renderWikiPanel(lang, selectedWikiKey ?? null, browseMode, currentView)}
      ${renderSidebarUtilityPanel(lang)}
    </aside>`
    }

    <main class="fm-content" id="main-content" role="main" aria-label="${htmlEsc(liveModeSession ? t(lang, "live_mode_title") : navLabel(lang, currentView))}">
      <div class="fm-content-inner">
        ${mainInner}
      </div>
    </main>
  </div>

  ${
    liveModeSession
      ? ""
      : `<footer class="fm-status-bar" role="contentinfo">
    <span class="fm-status-item">${htmlEsc(statusLeft)}</span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">${htmlEsc(t(lang, "shell_view"))}: <strong>${htmlEsc(navLabel(lang, currentView))}</strong></span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">${htmlEsc(t(lang, "shell_turn"))}: <strong>${save?.turn_number ?? 0}</strong></span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">${htmlEsc(typeof ver === "string" ? ver : String(ver))}</span>
  </footer>`
  }
  ${wikiModalOpen ? `<div class="tutorial-overlay" role="dialog" aria-modal="true" aria-labelledby="wiki-modal-title"><div class="tutorial-overlay__backdrop" data-wiki-modal-close="1"></div><section class="tutorial-overlay__panel wiki-modal__panel"><div class="tutorial-overlay__header"><div><p class="tutorial-overlay__eyebrow">${htmlEsc(lang === "zh-CN" ? "完整百科" : "Full Wiki")}</p><h2 class="tutorial-overlay__title" id="wiki-modal-title">${htmlEsc(lang === "zh-CN" ? "完整百科" : "Full Wiki")}</h2></div><button type="button" class="tutorial-overlay__close" aria-label="${htmlEsc(lang === "zh-CN" ? "关闭百科" : "Close wiki")}" data-wiki-modal-close="1">x</button></div><div class="wiki-modal__content">${renderFullWikiPanel(lang, selectedWikiKey ?? null)}</div></section></div>` : ""}
  ${feedbackModalOpen ? renderFeedbackModal(lang, currentView, isoDatePart(dateStr || ""), feedbackEntries ?? [], feedbackStatusMessage ?? null) : ""}
  ${tutorialOverlayHtml ?? ""}
</div>`;
}
