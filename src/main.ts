import "./style.css";
import { loadDefaultScenario } from "./data/loadScenario";
import type { LoadedScenario } from "./data/scenarioTypes";
import {
  advanceOneDay,
  acknowledgeInboxNotification,
  createNewGameSaveFromScenario,
  getBlockingNotificationForSave,
  hasPendingEventsToday,
  isoDatePart,
} from "./engine/gameEngine";
import {
  ensureBirthdayTeeInventoryRow,
  estimateLiveGoodsGrossYen,
  estimateVenueFee,
  isWeekendUtc,
  sortGroupsForDirectory,
  type ProducedGoodsRow,
} from "./engine/financeSystem";
import type { GameSavePayload } from "./save/gameSaveSchema";
import {
  renderDesktopShellI18n,
  isDesktopNavId,
  isManagementNav,
  isBrowseNav,
  type DesktopNavId,
  type FinanceHistoryRange,
  type LiveProgramItem,
  type LivesTab,
  type MakingTab,
  type NewLiveFormState,
  type ScoutTab,
  type SongsWorkspaceTab,
  type TrainingTab,
  type TrainingRosterSortKey,
  BROWSE_NAV_ITEMS,
} from "./ui/gameShell";
import { hydrateSnapshotSongsFromScenario } from "./save/gameSaveSchema";
import { addNotification, notificationRequiresAck, sortNotificationsInPlace } from "./save/inbox";
import { songsForDisplaySorted, buildDiscBuckets, isSongAvailableOn, songPopularityNum } from "./data/songDisplayPolicy";
import { songCatalogDisplayLabel } from "./data/songCatalog";
import { addMinutesToHHMM, autoSetlistSongCountForLive, getVenuesCatalog, LIVE_TYPE_PRESETS } from "./engine/liveScheduleWeb";
import {
  auditionCandidateToIdolRow,
  buildAuditionStorageKey,
  buildDefaultScoutCompanies,
  generateAuditionCandidates,
} from "./engine/scoutWeb";
import { normalizeFestivalCatalog, syncManagedTif2025Lives } from "./engine/festivalWeb";
import { ensureAutoBookedLivesThroughEndOfNextMonth, maybeSeedMonthEndAutoBookPrompt } from "./engine/monthlyLiveScheduler";
import { suggestManagedSetlistTitles } from "./engine/songStatusSystem";
import { scheduleIdolVacation } from "./engine/idolStatusSystem";
import {
  type OpeningScreen,
  renderOpeningHome,
  renderNewGameScreen,
  buildNewGameRows,
} from "./ui/openingScreens";
import { AUTOSAVE_SLOT, clearSlot, listOccupiedSlots, loadFromSlot, saveToSlot } from "./persistence/saves";
import { htmlEsc } from "./ui/htmlEsc";
import { wirePortraitFallbacks } from "./ui/portraitUrl";
import { groupsForDirectoryListing } from "./data/scenarioBrowse";
import { t, type UiLanguage } from "./ui/i18n";

const appRootElt = document.querySelector<HTMLDivElement>("#app");
if (!appRootElt) {
  throw new Error("#app missing");
}
const appRoot: HTMLDivElement = appRootElt;
const UI_LANG_STORAGE_KEY = "idol-producer-ui-lang";

function isUiLanguage(value: unknown): value is UiLanguage {
  return value === "en" || value === "zh-CN";
}

function readUiLanguage(): UiLanguage {
  try {
    const stored = window.localStorage.getItem(UI_LANG_STORAGE_KEY);
    return isUiLanguage(stored) ? stored : "en";
  } catch {
    return "en";
  }
}

function setUiLanguage(next: UiLanguage): void {
  uiLang = next;
  try {
    window.localStorage.setItem(UI_LANG_STORAGE_KEY, next);
  } catch {
    /* ignore storage failures */
  }
}

interface FocusSnapshot {
  selector: string;
  selectionStart: number | null;
  selectionEnd: number | null;
}

function cssAttr(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

function focusSelectorFor(el: Element): string | null {
  if (!(el instanceof HTMLElement)) return null;
  const id = el.getAttribute("id");
  if (id) return `#${cssAttr(id)}`;
  const liveField = el.getAttribute("data-live-form-field");
  if (liveField) return `[data-live-form-field="${cssAttr(liveField)}"]`;
  const liveDuration = el.getAttribute("data-live-program-duration");
  if (liveDuration) return `[data-live-program-duration="${cssAttr(liveDuration)}"]`;
  const trainingUid = el.getAttribute("data-idol-uid");
  const trainingField = el.getAttribute("data-field");
  if (trainingUid && trainingField) {
    return `[data-idol-uid="${cssAttr(trainingUid)}"][data-field="${cssAttr(trainingField)}"]`;
  }
  const liveToggle = el.getAttribute("data-live-toggle");
  if (liveToggle) return `[data-live-toggle="${cssAttr(liveToggle)}"]`;
  return null;
}

function captureFocus(root: ParentNode): FocusSnapshot | null {
  const active = document.activeElement;
  if (!(active instanceof HTMLElement)) return null;
  if (!root.contains(active)) return null;
  const selector = focusSelectorFor(active);
  if (!selector) return null;
  const textLike = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement;
  return {
    selector,
    selectionStart: textLike ? active.selectionStart : null,
    selectionEnd: textLike ? active.selectionEnd : null,
  };
}

function restoreFocus(root: ParentNode, snapshot: FocusSnapshot | null): void {
  if (!snapshot) return;
  const target = root.querySelector(snapshot.selector);
  if (!(target instanceof HTMLElement)) return;
  target.focus();
  if (
    (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) &&
    snapshot.selectionStart != null &&
    snapshot.selectionEnd != null
  ) {
    try {
      target.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd);
    } catch {
      /* selection API unsupported on some input types */
    }
  }
}

function addScheduleCalendarMonths(firstOfMonthIso: string, delta: number): string {
  const s = firstOfMonthIso.split("T")[0];
  const [y0, mo0] = s.split("-").map((x) => parseInt(x, 10));
  if (!Number.isFinite(y0) || !Number.isFinite(mo0)) return "2000-01-01";
  const idx = (y0 - 1970) * 12 + (mo0 - 1) + delta;
  const y = 1970 + Math.floor(idx / 12);
  const mo = (idx % 12) + 1;
  return `${String(y).padStart(4, "0")}-${String(mo).padStart(2, "0")}-01`;
}

function currentIsoForNewLive(): string {
  return isoDatePart(save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? "2020-01-01");
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${isoDatePart(fromIso)}T12:00:00Z`);
  const to = Date.parse(`${isoDatePart(toIso)}T12:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.floor((to - from) / 86400000);
}

function reservationFeeForNewLive(venueCapacity: number | null, startDateIso: string): {
  baseVenueFeeYen: number;
  reservationFeeYen: number;
  reservationRate: number;
  daysAhead: number | null;
  blocked: boolean;
} {
  const daysAhead = daysBetweenIso(currentIsoForNewLive(), startDateIso);
  const baseVenueFeeYen = estimateVenueFee(venueCapacity, {
    isWeekendOrHoliday: isWeekendUtc(startDateIso),
    bookingPlan: "full_day",
  });
  if (daysAhead != null && daysAhead < 7) {
    return { baseVenueFeeYen, reservationFeeYen: 0, reservationRate: 0, daysAhead, blocked: true };
  }
  const reservationRate = daysAhead != null && daysAhead <= 30 ? 0.2 : 0.1;
  return {
    baseVenueFeeYen,
    reservationFeeYen: Math.round(baseVenueFeeYen * reservationRate),
    reservationRate,
    daysAhead,
    blocked: false,
  };
}

function newLiveProgramId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSongProgramItem(title: string): LiveProgramItem {
  return {
    id: newLiveProgramId("song"),
    kind: "song",
    label: title,
    songTitle: title,
    durationMinutes: 0,
  };
}

function createBlockProgramItem(kind: "mc" | "break", durationMinutes: number): LiveProgramItem {
  return {
    id: newLiveProgramId(kind),
    kind,
    label: kind === "mc" ? "MC" : "Break",
    durationMinutes,
  };
}

function songTitlesFromProgram(items: LiveProgramItem[]): string[] {
  return items
    .filter((item) => item.kind === "song")
    .map((item) => String(item.songTitle ?? item.label ?? "").trim())
    .filter(Boolean);
}

function syncNewLiveFormSetlistFromProgram(): void {
  newLiveForm.setlist = songTitlesFromProgram(newLiveForm.program);
}

function insertProgramItem(targetIndex: number, item: LiveProgramItem): void {
  const next = [...newLiveForm.program];
  const index = Math.max(0, Math.min(targetIndex, next.length));
  next.splice(index, 0, item);
  newLiveForm.program = next;
  syncNewLiveFormSetlistFromProgram();
}

function moveProgramItem(fromIndex: number, toIndex: number): void {
  const items = [...newLiveForm.program];
  if (fromIndex < 0 || fromIndex >= items.length) return;
  const [item] = items.splice(fromIndex, 1);
  if (!item) return;
  const target = Math.max(0, Math.min(toIndex, items.length));
  items.splice(target > fromIndex ? target - 1 : target, 0, item);
  newLiveForm.program = items;
  syncNewLiveFormSetlistFromProgram();
}

function resetNewLiveFormDefaults(liveType: NewLiveFormState["liveType"] = "Routine"): void {
  const preset = LIVE_TYPE_PRESETS[liveType] ?? LIVE_TYPE_PRESETS.Routine;
  const date = currentIsoForNewLive();
  const endTime = addMinutesToHHMM(preset.default_start_time, preset.default_duration);
  const suggestedCount = autoSetlistSongCountForLive(
    liveType,
    preset.default_duration,
    liveType === "Concert" ? 6 : liveType === "Taiban" ? 3 : 5,
  );
  const tokutenkaiStart = preset.tokutenkai_enabled ? endTime : "";
  const tokutenkaiEnd = preset.tokutenkai_enabled ? addMinutesToHHMM(endTime, preset.tokutenkai_duration) : "";
  const managedUid = save?.managing_group_uid ?? "";
  const suggestedSetlist = save
    ? suggestManagedSetlistTitles(
        save.managed_song_status,
        songsForDisplaySorted(save.database_snapshot.songs),
        managedUid,
        date,
        suggestedCount,
        songPopularityNum,
      )
    : [];
  const venue = getVenuesCatalog()[0]?.name ?? "";
  const initialGoodsUids = defaultGoodsSelectionForLive({
    title: save?.managing_group ? `${save.managing_group} ${liveType}` : `${liveType} Live`,
    liveType,
    date,
  });
  newLiveForm = {
    liveType,
    title: save?.managing_group ? `${save.managing_group} ${liveType}` : `${liveType} Live`,
    date,
    startTime: preset.default_start_time,
    endTime,
    rehearsalStart: preset.rehearsal_start,
    rehearsalEnd: preset.rehearsal_end,
    venueName: venue,
    program: suggestedSetlist.map((title) => createSongProgramItem(title)),
    setlist: suggestedSetlist,
    tokutenkaiEnabled: preset.tokutenkai_enabled,
    tokutenkaiStart,
    tokutenkaiEnd,
    tokutenkaiTicketPrice: preset.tokutenkai_ticket_price,
    tokutenkaiSlotSeconds: preset.tokutenkai_slot_seconds,
    tokutenkaiExpectedTickets: preset.tokutenkai_expected_tickets,
    goodsEnabled: true,
    goodsUids: initialGoodsUids,
    ticketPriceYen: liveType === "Concert" ? 3800 : liveType === "Festival" ? 0 : 2500,
    vipTicketPriceYen: 0,
    vipCapacity: 0,
  };
  reconcileNewLiveGoodsSelection();
  selectedLiveSongTitle = suggestedSetlist[0] ?? null;
  selectedSetlistSongIndex = suggestedSetlist.length ? 0 : null;
}

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function selectedScheduledLiveRecord(): Record<string, unknown> | null {
  if (!save) return null;
  const schedules = (save.lives?.schedules ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  if (!schedules.length) return null;
  if (scheduledLiveUid) {
    const matched = schedules.find((live) => String(live.uid ?? "") === scheduledLiveUid);
    if (matched) return matched;
  }
  return schedules[0] ?? null;
}

function goodsInventory(): ProducedGoodsRow[] {
  return Array.isArray(save?.goods_inventory) ? save!.goods_inventory : [];
}

function availableGoodsInventory(): ProducedGoodsRow[] {
  return goodsInventory().filter((item) => Math.max(0, Number(item.stock ?? 0) || 0) > 0);
}

function availableSongsForManagedGroup(referenceIso: string): Record<string, unknown>[] {
  const managedUid = String(save?.managing_group_uid ?? "").trim();
  return save
    ? songsForDisplaySorted(save.database_snapshot.songs)
        .filter((row) => String(row.group_uid ?? "") === managedUid)
        .filter((row) => isSongAvailableOn(row, referenceIso))
    : [];
}

function isBirthdayLiveTitle(title: string): boolean {
  return /生誕|birthday/i.test(String(title ?? ""));
}

function matchingBirthdayGoodsUid(title: string): string[] {
  if (!save || !isBirthdayLiveTitle(title)) return [];
  const group = save.database_snapshot.groups.find((row) => String((row as { uid?: unknown }).uid ?? "") === String(save.managing_group_uid ?? "")) as Record<string, unknown> | undefined;
  const memberUids = Array.isArray(group?.member_uids) ? group!.member_uids.map((x) => String(x)) : [];
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  for (const uid of memberUids) {
    const idol = idols.find((row) => String(row.uid ?? "") === uid);
    const name = String(idol?.name ?? "").trim();
    if (name && String(title).includes(name)) {
      const item = goodsInventory().find((row) => row.member_uid === uid && row.name === "Birthday T-shirt" && Math.max(0, Number(row.stock ?? 0) || 0) > 0);
      return item ? [item.uid] : [];
    }
  }
  return [];
}

function defaultGoodsSelectionForLive(params: { title: string; liveType: string; date: string }): string[] {
  const regular = availableGoodsInventory()
    .filter((item) => String(item.name ?? "") !== "Birthday T-shirt")
    .map((item) => item.uid);
  return [...regular, ...matchingBirthdayGoodsUid(params.title)];
}

function reconcileNewLiveGoodsSelection(): void {
  const defaults = defaultGoodsSelectionForLive({
    title: newLiveForm.title,
    liveType: newLiveForm.liveType,
    date: newLiveForm.date,
  });
  const allowed = new Set(defaults);
  const retained = newLiveForm.goodsUids.filter((uid) => allowed.has(uid));
  newLiveForm.goodsUids = retained.length > 0 ? retained : defaults;
}

function findGoodsByUid(uid: string | null | undefined): ProducedGoodsRow | null {
  const key = String(uid ?? "").trim();
  if (!key) return null;
  return goodsInventory().find((item) => item.uid === key) ?? null;
}

function goodsDisplayLabel(item: ProducedGoodsRow | null | undefined): string {
  if (!item) return "";
  return item.member_name ? `${item.member_name} / ${item.name}` : item.name;
}

function goodsMatrixKey(item: ProducedGoodsRow | null | undefined): string {
  if (!item) return "";
  return `${String(item.category ?? "").trim()}|${String(item.name ?? "").trim()}`;
}

function goodsRowsForMatrixKey(key: string): ProducedGoodsRow[] {
  return goodsInventory().filter((item) => goodsMatrixKey(item) === key);
}

function ensureBirthdayGoodsRowFromDataset(memberUid: string | null | undefined, memberName: string | null | undefined): ProducedGoodsRow | null {
  if (!save || !memberUid || !memberName) return null;
  const uid = String(memberUid).trim();
  const name = String(memberName).trim();
  if (!uid || !name) return null;
  return ensureBirthdayTeeInventoryRow(save.goods_inventory, { uid, name });
}

function estimateCurrentLiveGoodsGross(
  liveType: string,
  venueName: string,
  goodsUids: string[],
): number {
  const venue = getVenuesCatalog().find((row) => row.name === venueName) ?? null;
  const group = save ? sortGroupsForDirectory(save.database_snapshot.groups).find((row) => String(row.uid ?? "") === String(save.managing_group_uid ?? "")) ?? null : null;
  return goodsUids.reduce((sum, goodsUid) => {
    const goods = findGoodsByUid(goodsUid);
    return (
      sum +
      estimateLiveGoodsGrossYen(goods, {
        liveType,
        capacity: venue?.capacity ?? null,
        groupFans: Number(group?.fans ?? 0) || 0,
        groupPopularity: Number(group?.popularity ?? 0) || 0,
        groupTier: typeof group?.letter_tier === "string" ? group.letter_tier : null,
      })
    );
  }, 0);
}

function markInboxOpened(uid: string | null): void {
  if (!save || !uid) return;
  const row = save.inbox.notifications.find((n) => n.uid === uid);
  if (!row || row.read || notificationRequiresAck(row)) return;
  row.read = true;
}

function oldestUnreadInboxUid(rows: { uid: string; read: boolean }[]): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    if (!rows[i]?.read) return rows[i]?.uid ?? null;
  }
  return null;
}

function notificationTimestampMs(row: { created_at?: string; date?: string }): number {
  const created = String(row.created_at ?? "").trim();
  if (created) {
    const parsed = Date.parse(`${created.endsWith("Z") ? created : `${created}Z`}`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const day = String(row.date ?? "").split("T")[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const parsed = Date.parse(`${day}T00:00:00Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function newestVisibleLiveReportUid(currentSave: GameSavePayload): string | null {
  const currentMs = notificationTimestampMs({ created_at: String(currentSave.current_date ?? "") });
  const rows = [...currentSave.inbox.notifications];
  sortNotificationsInPlace(rows);
  for (const row of rows) {
    const title = String(row.title ?? "");
    if (!title.startsWith("Live report:") && !title.startsWith("Festival report:")) continue;
    if (notificationTimestampMs(row) > currentMs) continue;
    return row.uid;
  }
  return null;
}

function runSimulationTask(task: () => void): void {
  if (simulationBusy) return;
  simulationBusy = true;
  paintGame();
  window.setTimeout(() => {
    try {
      task();
    } finally {
      simulationBusy = false;
      paintGame();
    }
  }, 0);
}

let loadedScenario: LoadedScenario | null = null;
let save: GameSavePayload | null = null;
let slot = 0;
let browseMode = false;
let openingScreen: OpeningScreen = "home";
let selectedNewGameGroupUid: string | null = null;
let openingStatus = "";
let uiLang: UiLanguage = readUiLanguage();
let simulationBusy = false;
let attentionActionUid: string | null = null;

let currentView: DesktopNavId = "Inbox";
let idolDetailUid: string | null = null;
let groupDetailUid: string | null = null;
/** Songs view: selected `group_uid` from snapshot (browse or save). */
let songsGroupUid: string | null = null;
/** Songs view: `group_songs` = track list, `disc` = discography (desktop `main_ui.py`). */
let songsWorkspaceTab: SongsWorkspaceTab = "group_songs";
let makingTab: MakingTab = "songs";
/** Selected release bucket in Discography tab; invalid keys cleared in `ensureSongsDiscographyKey`. */
let songsDiscographyKey: string | null = null;

/** Inbox message selection (management mode). */
let inboxSelectedUid: string | null = null;
/** Schedule: visible month (`YYYY-MM-01`); null = month of next simulation day. */
let scheduleCalendarMonthStart: string | null = null;
let livesTab: LivesTab = "new";
let scheduledLiveUid: string | null = null;
let scoutTab: ScoutTab = "freelancer";
let trainingTab: TrainingTab = "roster";
let trainingRosterSortKey: TrainingRosterSortKey = "started";
let trainingRosterSortDir: "asc" | "desc" = "asc";
let financeHistoryRange: FinanceHistoryRange = "month";
let selectedScoutLeadUid: string | null = null;
let selectedScoutApplicantUid: string | null = null;
let trainingRepaintTimer: ReturnType<typeof setTimeout> | null = null;
let liveProgramDragData = "";
let selectedLiveSongTitle: string | null = null;
let selectedSetlistSongIndex: number | null = null;
let newLiveForm: NewLiveFormState = {
  liveType: "Routine",
  title: "",
  date: "2020-01-01",
  startTime: "18:00",
  endTime: "19:10",
  rehearsalStart: "",
  rehearsalEnd: "",
  venueName: "",
  program: [],
  setlist: [],
  tokutenkaiEnabled: true,
  tokutenkaiStart: "19:10",
  tokutenkaiEnd: "20:40",
  tokutenkaiTicketPrice: 2000,
  tokutenkaiSlotSeconds: 40,
  tokutenkaiExpectedTickets: 90,
  goodsEnabled: true,
  goodsUids: [],
  ticketPriceYen: 2500,
};

interface NavigationSnapshot {
  browseMode: boolean;
  currentView: DesktopNavId;
  idolDetailUid: string | null;
  groupDetailUid: string | null;
  songsGroupUid: string | null;
  songsWorkspaceTab: SongsWorkspaceTab;
  songsDiscographyKey: string | null;
  makingTab: MakingTab;
  inboxSelectedUid: string | null;
  livesTab: LivesTab;
  scheduledLiveUid: string | null;
  scoutTab: ScoutTab;
  trainingTab: TrainingTab;
  trainingRosterSortKey: TrainingRosterSortKey;
  trainingRosterSortDir: "asc" | "desc";
  financeHistoryRange: FinanceHistoryRange;
  selectedScoutLeadUid: string | null;
  selectedScoutApplicantUid: string | null;
  scheduleCalendarMonthStart: string | null;
}

const backHistory: NavigationSnapshot[] = [];
const forwardHistory: NavigationSnapshot[] = [];

function captureNavigationSnapshot(): NavigationSnapshot {
  return {
    browseMode,
    currentView,
    idolDetailUid,
    groupDetailUid,
    songsGroupUid,
    songsWorkspaceTab,
    songsDiscographyKey,
    makingTab,
    inboxSelectedUid,
    livesTab,
    scheduledLiveUid,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
  };
}

function sameNavigationSnapshot(a: NavigationSnapshot, b: NavigationSnapshot): boolean {
  return (
    a.browseMode === b.browseMode &&
    a.currentView === b.currentView &&
    a.idolDetailUid === b.idolDetailUid &&
    a.groupDetailUid === b.groupDetailUid &&
    a.songsGroupUid === b.songsGroupUid &&
    a.songsWorkspaceTab === b.songsWorkspaceTab &&
    a.songsDiscographyKey === b.songsDiscographyKey &&
    a.makingTab === b.makingTab &&
    a.inboxSelectedUid === b.inboxSelectedUid &&
    a.livesTab === b.livesTab &&
    a.scheduledLiveUid === b.scheduledLiveUid &&
    a.scoutTab === b.scoutTab &&
    a.trainingTab === b.trainingTab &&
    a.trainingRosterSortKey === b.trainingRosterSortKey &&
    a.trainingRosterSortDir === b.trainingRosterSortDir &&
    a.financeHistoryRange === b.financeHistoryRange &&
    a.selectedScoutLeadUid === b.selectedScoutLeadUid &&
    a.selectedScoutApplicantUid === b.selectedScoutApplicantUid &&
    a.scheduleCalendarMonthStart === b.scheduleCalendarMonthStart
  );
}

function applyNavigationSnapshot(snapshot: NavigationSnapshot): void {
  browseMode = snapshot.browseMode;
  currentView = snapshot.currentView;
  idolDetailUid = snapshot.idolDetailUid;
  groupDetailUid = snapshot.groupDetailUid;
  songsGroupUid = snapshot.songsGroupUid;
  songsWorkspaceTab = snapshot.songsWorkspaceTab;
  songsDiscographyKey = snapshot.songsDiscographyKey;
  makingTab = snapshot.makingTab;
  inboxSelectedUid = snapshot.inboxSelectedUid;
  livesTab = snapshot.livesTab;
  scheduledLiveUid = snapshot.scheduledLiveUid;
  scoutTab = snapshot.scoutTab;
  trainingTab = snapshot.trainingTab;
  trainingRosterSortKey = snapshot.trainingRosterSortKey;
  trainingRosterSortDir = snapshot.trainingRosterSortDir;
  financeHistoryRange = snapshot.financeHistoryRange;
  selectedScoutLeadUid = snapshot.selectedScoutLeadUid;
  selectedScoutApplicantUid = snapshot.selectedScoutApplicantUid;
  scheduleCalendarMonthStart = snapshot.scheduleCalendarMonthStart;
}

function clearNavigationHistory(): void {
  backHistory.length = 0;
  forwardHistory.length = 0;
}

function resetNavigationHistory(): void {
  clearNavigationHistory();
}

function navigate(mutator: () => void): void {
  const before = captureNavigationSnapshot();
  mutator();
  const after = captureNavigationSnapshot();
  if (!sameNavigationSnapshot(before, after)) {
    backHistory.push(before);
    forwardHistory.length = 0;
  }
  paintGame();
}

function goHistory(direction: "back" | "forward"): void {
  const from = direction === "back" ? backHistory : forwardHistory;
  const to = direction === "back" ? forwardHistory : backHistory;
  const target = from.pop();
  if (!target) return;
  to.push(captureNavigationSnapshot());
  applyNavigationSnapshot(target);
  paintGame();
}

const IDOL_LIST_LAYOUT_KEY = "idol-producer-idol-list-layout";

function readIdolListLayout(): "cards" | "list" {
  try {
    const v = localStorage.getItem(IDOL_LIST_LAYOUT_KEY);
    if (v === "list" || v === "cards") return v;
  } catch {
    /* ignore */
  }
  return "cards";
}

function assertHydratedSave(raw: GameSavePayload | null): raw is GameSavePayload {
  return (
    raw != null &&
    typeof raw.database_snapshot === "object" &&
    Array.isArray(raw.database_snapshot.groups) &&
    Array.isArray(raw.database_snapshot.idols)
  );
}

function coerceNavForMode(): void {
  if (browseMode) {
    if (!isBrowseNav(currentView)) currentView = BROWSE_NAV_ITEMS[0];
  } else if (save && !isManagementNav(currentView)) {
    currentView = "Inbox";
  }
}

function groupsForSongsPicker(): Record<string, unknown>[] | null {
  if (browseMode && loadedScenario?.groups) return loadedScenario.groups;
  if (save?.database_snapshot?.groups) return save.database_snapshot.groups;
  return null;
}

/** Keep `songsGroupUid` valid for the current snapshot (managed group preferred in play mode). */
function ensureSongsGroupUid(): void {
  const groups = groupsForSongsPicker();
  if (!groups?.length) {
    songsGroupUid = null;
    return;
  }
  const listed = groupsForDirectoryListing(groups);
  const validUids = new Set(listed.map((g) => String((g as { uid?: unknown }).uid ?? "").trim()).filter(Boolean));
  if (songsGroupUid && validUids.has(songsGroupUid)) return;
  const mg = save?.managing_group_uid?.trim();
  if (mg && validUids.has(mg)) {
    songsGroupUid = mg;
    return;
  }
  const sorted = sortGroupsForDirectory(listed);
  const first = sorted[0];
  songsGroupUid = String((first as { uid?: unknown }).uid ?? "").trim() || null;
}

function songsListForDiscographyCheck(): Record<string, unknown>[] | null {
  if (browseMode && loadedScenario?.songs) return loadedScenario.songs;
  if (save?.database_snapshot?.songs) return save.database_snapshot.songs;
  return null;
}

/** Drop stale discography selection when bucket keys change (group / data). */
function ensureSongsDiscographyKey(): void {
  const songs = songsListForDiscographyCheck();
  const gid = songsGroupUid?.trim();
  if (!songs?.length || !gid) {
    songsDiscographyKey = null;
    return;
  }
  const team = songsForDisplaySorted(songs).filter((row) => String(row.group_uid ?? "") === gid);
  const buckets = buildDiscBuckets(team);
  if (songsDiscographyKey && !buckets.some((b) => b.key === songsDiscographyKey)) {
    songsDiscographyKey = null;
  }
}

function syncFestivalLivesIfPossible(): void {
  if (!save || !loadedScenario?.festivals?.length) return;
  const festivals = normalizeFestivalCatalog(loadedScenario.festivals);
  syncManagedTif2025Lives(save, festivals);
}

function paintOpening(): void {
  const focus = captureFocus(appRoot);
  const preset = loadedScenario?.preset ?? null;
  const dbReady = loadedScenario != null;
  appRoot.innerHTML =
    openingScreen === "home"
      ? renderOpeningHome(preset, dbReady, openingStatus, save != null && !browseMode, slot, listOccupiedSlots(), uiLang)
      : loadedScenario
        ? renderNewGameScreen(
            buildNewGameRows(loadedScenario),
            "Producer",
            loadedScenario.preset,
            uiLang,
          )
        : `<p class="fm-error" role="alert">${htmlEsc(t(uiLang, "opening_no_scenario_loaded"))}</p>`;
  restoreFocus(appRoot, focus);

  if (openingScreen === "home") {
    document.getElementById("lang-select-opening")?.addEventListener("change", (ev) => {
      const value = (ev.target as HTMLSelectElement).value;
      if (!isUiLanguage(value)) return;
      setUiLanguage(value);
      paintOpening();
    });

    document.getElementById("opening-slot-select")?.addEventListener("change", (ev) => {
      const v = Number((ev.target as HTMLSelectElement).value);
      if (!Number.isNaN(v)) slot = v;
    });

    document.getElementById("opening-resume")?.addEventListener("click", () => {
      if (!save || browseMode) return;
      browseMode = false;
      idolDetailUid = null;
      groupDetailUid = null;
      currentView = "Inbox";
      resetNavigationHistory();
      paintGame();
    });

    document.getElementById("opening-new-game")?.addEventListener("click", () => {
      if (!loadedScenario) return;
      openingScreen = "new_game";
      selectedNewGameGroupUid = null;
      paintOpening();
    });
    document.getElementById("opening-load-slot")?.addEventListener("click", () => {
      const loaded = loadFromSlot(slot);
      if (loaded && assertHydratedSave(loaded)) {
        save = loaded;
        ensureAutoBookedLivesThroughEndOfNextMonth(save);
        maybeSeedMonthEndAutoBookPrompt(save);
        scheduleCalendarMonthStart = null;
        resetNewLiveFormDefaults();
        if (loadedScenario) {
          hydrateSnapshotSongsFromScenario(save, loadedScenario.songs, loadedScenario.preset.data_subdir);
          syncFestivalLivesIfPossible();
        }
        browseMode = false;
        openingScreen = "home";
        currentView = "Inbox";
        idolDetailUid = null;
        groupDetailUid = null;
        openingStatus = t(uiLang, "opening_loaded_slot", { slot });
        resetNavigationHistory();
        paintGame();
      } else {
        openingStatus = t(uiLang, "opening_slot_invalid", { slot });
        paintOpening();
      }
    });
    document.getElementById("opening-browse")?.addEventListener("click", () => {
      if (!loadedScenario) return;
      browseMode = true;
      save = null;
      idolDetailUid = null;
      groupDetailUid = null;
      currentView = "Idols";
      openingScreen = "home";
      resetNavigationHistory();
      paintGame();
    });
  } else if (openingScreen === "new_game" && loadedScenario) {
    const rows = buildNewGameRows(loadedScenario);
    const startBtn = document.getElementById("new-game-start") as HTMLButtonElement | null;
    const nameInput = document.getElementById("producer-name") as HTMLInputElement | null;

    document.getElementById("lang-select-opening")?.addEventListener("change", (ev) => {
      const value = (ev.target as HTMLSelectElement).value;
      if (!isUiLanguage(value)) return;
      setUiLanguage(value);
      paintOpening();
    });

    document.querySelectorAll(".group-picker-row").forEach((tr) => {
      tr.addEventListener("click", () => {
        document.querySelectorAll(".group-picker-row").forEach((r) => r.classList.remove("is-selected"));
        tr.classList.add("is-selected");
        const uid = tr.getAttribute("data-group-uid");
        selectedNewGameGroupUid = uid && uid.length ? uid : null;
        if (startBtn) startBtn.disabled = !selectedNewGameGroupUid;
      });
    });

    document.getElementById("new-game-back")?.addEventListener("click", () => {
      openingScreen = "home";
      selectedNewGameGroupUid = null;
      paintOpening();
    });

    document.getElementById("new-game-start")?.addEventListener("click", () => {
      if (!loadedScenario || !selectedNewGameGroupUid || !nameInput) return;
      const row = rows.find((r) => r.uid === selectedNewGameGroupUid);
      const label =
        row?.nameRomanji && row.nameRomanji !== "—" && row.nameRomanji.trim()
          ? row.nameRomanji
          : (row?.name ?? "");
      try {
        save = createNewGameSaveFromScenario(loadedScenario, {
          playerName: nameInput.value.trim() || "Producer",
          managedGroupLabel: label,
          managedGroupUid: selectedNewGameGroupUid,
        });
        ensureAutoBookedLivesThroughEndOfNextMonth(save);
        maybeSeedMonthEndAutoBookPrompt(save);
        scheduleCalendarMonthStart = null;
        resetNewLiveFormDefaults();
        syncFestivalLivesIfPossible();
        browseMode = false;
        openingScreen = "home";
        selectedNewGameGroupUid = null;
        currentView = "Inbox";
        idolDetailUid = null;
        groupDetailUid = null;
        openingStatus = t(uiLang, "opening_new_production_started");
        resetNavigationHistory();
        paintGame();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
}

function paintGame(): void {
  const focus = captureFocus(appRoot);
  coerceNavForMode();

  if (browseMode) {
    if (!loadedScenario) {
      appRoot.innerHTML = `<p class="fm-error" role="alert">${htmlEsc(t(uiLang, "shell_browse_requires_data"))}</p>`;
      return;
    }
  } else if (!save) {
    appRoot.innerHTML = `<p class="fm-error" role="alert">No save loaded.</p>`;
    return;
  }

  ensureSongsGroupUid();
  ensureSongsDiscographyKey();
  if (!browseMode) syncFestivalLivesIfPossible();
  if (!browseMode && save && currentView === "Making") {
    const m = save.managing_group_uid?.trim();
    if (m) songsGroupUid = m;
  }

  if (!browseMode && save && currentView === "Inbox" && save.inbox.notifications.length) {
    sortNotificationsInPlace(save.inbox.notifications);
    const rows = save.inbox.notifications;
    if (!inboxSelectedUid || !rows.some((r) => r.uid === inboxSelectedUid)) {
      inboxSelectedUid = rows[rows.length - 1]?.uid ?? null;
    }
    markInboxOpened(inboxSelectedUid);
  } else if (currentView !== "Inbox") {
    inboxSelectedUid = null;
  }

  appRoot.innerHTML = renderDesktopShellI18n({
    lang: uiLang,
    browseMode,
    browseData: loadedScenario,
    save,
    preview: null,
    currentView,
    idolDetailUid,
    groupDetailUid,
    idolListLayout: readIdolListLayout(),
    songsGroupUid,
    songsWorkspaceTab,
    songsDiscographyKey,
    makingTab,
    inboxSelectedUid,
    livesTab,
    scheduledLiveUid,
    newLiveForm,
    selectedLiveSongTitle,
    selectedSetlistSongIndex,
    scoutTab,
    trainingTab,
    trainingRosterSortKey,
    trainingRosterSortDir,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    attentionActionUid,
    canGoBack: backHistory.length > 0,
    canGoForward: forwardHistory.length > 0,
    simulationBusy,
    slot,
    occupiedSlots: listOccupiedSlots(),
  });
  restoreFocus(appRoot, focus);

  wirePortraitFallbacks(appRoot);

  if (save && !browseMode) {
    const nextBtn = document.getElementById("btn-next-day") as HTMLButtonElement | null;
    const nextBtnLabel = document.getElementById("btn-next-day-label");
    if (nextBtn) {
      const hasTodayEvents = hasPendingEventsToday(save);
      if (nextBtnLabel) nextBtnLabel.textContent = hasTodayEvents ? "Next" : "Next Day";
      nextBtn.title = hasTodayEvents
        ? "Advance to the next scheduled event today"
        : "Advance to the next day at 08:00";
    }
  }

  document.getElementById("lang-select-shell")?.addEventListener("change", (ev) => {
    const value = (ev.target as HTMLSelectElement).value;
    if (!isUiLanguage(value)) return;
    setUiLanguage(value);
    paintGame();
  });

  document.getElementById("main-content")?.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const calNav = t.closest<HTMLElement>("[data-sched-cal-delta]");
    if (calNav && save && !browseMode && currentView === "Schedule") {
      const root = appRoot.querySelector("[data-sched-cal-root]");
      const curMonth = root?.getAttribute("data-sched-cal-root") ?? "2000-01-01";
      const d = Number(calNav.getAttribute("data-sched-cal-delta"));
      if (Number.isFinite(d)) {
        scheduleCalendarMonthStart = addScheduleCalendarMonths(curMonth, d);
        paintGame();
      }
      return;
    }
    const calToday = t.closest<HTMLElement>("[data-sched-cal-today]");
    if (calToday && save && !browseMode && currentView === "Schedule") {
      scheduleCalendarMonthStart = null;
      paintGame();
      return;
    }
    const livesTabPick = t.closest<HTMLElement>("[data-lives-tab]");
    if (livesTabPick && save && !browseMode && currentView === "Lives") {
      const tab = livesTabPick.getAttribute("data-lives-tab");
      if (tab === "new" || tab === "scheduled" || tab === "live" || tab === "past" || tab === "festival") {
        navigate(() => {
          livesTab = tab;
          if (tab === "live" && !scheduledLiveUid) {
            scheduledLiveUid = selectedScheduledLiveRecord()?.uid ? String(selectedScheduledLiveRecord()!.uid) : null;
          }
        });
      }
      return;
    }
    const scheduledPick = t.closest<HTMLElement>("[data-scheduled-live]");
    if (scheduledPick && save && !browseMode && currentView === "Lives") {
      navigate(() => {
        scheduledLiveUid = scheduledPick.getAttribute("data-scheduled-live");
        if (livesTab === "live") return;
      });
      return;
    }
    const liveSongPick = t.closest<HTMLElement>("[data-live-song-pick]");
    if (liveSongPick && save && !browseMode && currentView === "Lives") {
      selectedLiveSongTitle = liveSongPick.getAttribute("data-live-song-pick");
      paintGame();
      return;
    }
    const setlistSongPick = t.closest<HTMLElement>("[data-live-setlist-pick]");
    if (setlistSongPick && save && !browseMode && currentView === "Lives") {
      const idx = Number(setlistSongPick.getAttribute("data-live-setlist-pick"));
      selectedSetlistSongIndex = Number.isFinite(idx) ? idx : null;
      paintGame();
      return;
    }
    const addSelectedSongBtn = t.closest<HTMLElement>("[data-live-setlist-add-selected]");
    if (addSelectedSongBtn && save && !browseMode && currentView === "Lives") {
      const title = selectedLiveSongTitle?.trim();
      if (title) {
        const targetIndex = newLiveForm.program.length;
        insertProgramItem(newLiveForm.program.length, createSongProgramItem(title));
        selectedSetlistSongIndex = targetIndex;
      }
      paintGame();
      return;
    }
    const addSongBtn = t.closest<HTMLElement>("[data-live-add-song]");
    if (addSongBtn && save && !browseMode && currentView === "Lives") {
      const raw = addSongBtn.getAttribute("data-live-add-song") ?? "";
      let title = raw;
      try {
        title = decodeURIComponent(raw);
      } catch {
        title = raw;
      }
      const targetIndex = newLiveForm.program.length;
      insertProgramItem(newLiveForm.program.length, createSongProgramItem(title));
      selectedSetlistSongIndex = targetIndex;
      paintGame();
      return;
    }
    const addTemplateBtn = t.closest<HTMLElement>("[data-live-add-template]");
    if (addTemplateBtn && save && !browseMode && currentView === "Lives") {
      const token = String(addTemplateBtn.getAttribute("data-live-add-template") ?? "");
      const [kindRaw, durationRaw] = token.split(":");
      const kind = kindRaw === "mc" || kindRaw === "break" ? kindRaw : null;
      const duration = Math.max(1, Number(durationRaw) || 0);
      if (kind) {
        const targetIndex = newLiveForm.program.length;
        insertProgramItem(newLiveForm.program.length, createBlockProgramItem(kind, duration));
        selectedSetlistSongIndex = targetIndex;
        paintGame();
      }
      return;
    }
    const removeProgramBtn = t.closest<HTMLElement>("[data-live-program-remove]");
    if (removeProgramBtn && save && !browseMode && currentView === "Lives") {
      const index = Number(removeProgramBtn.getAttribute("data-live-program-remove"));
      if (Number.isFinite(index)) {
        newLiveForm.program = newLiveForm.program.filter((_, idx) => idx !== index);
        syncNewLiveFormSetlistFromProgram();
        if (selectedSetlistSongIndex != null) {
          selectedSetlistSongIndex =
            newLiveForm.program.length > 0 ? Math.min(selectedSetlistSongIndex, newLiveForm.program.length - 1) : null;
        }
        paintGame();
      }
      return;
    }
    const scheduleLiveBtn = t.closest<HTMLElement>("[data-live-schedule]");
    if (scheduleLiveBtn && save && !browseMode && currentView === "Lives") {
      const venue = getVenuesCatalog().find((row) => row.name === newLiveForm.venueName) ?? null;
      const reservation = reservationFeeForNewLive(venue?.capacity ?? null, newLiveForm.date);
      if (reservation.blocked) {
        addNotification(save, {
          title: `Live scheduling blocked: ${newLiveForm.title.trim() || `${save.managing_group ?? "Managed group"} ${newLiveForm.liveType}`}`,
          body: `Lives cannot be scheduled within 7 days. Pick a date at least 7 days after ${currentIsoForNewLive()}.`,
          sender: "Operations",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
          dedupeKey: `live-schedule-blocked|${newLiveForm.date}|${newLiveForm.venueName}|${newLiveForm.title}`,
        });
        paintGame();
        return;
      }
      const finances = save.finances as Record<string, unknown>;
      const currentCash = Math.max(0, Number(finances.cash_yen ?? 0) || 0);
      if (reservation.reservationFeeYen > currentCash) {
        addNotification(save, {
          title: `Live scheduling blocked: ${newLiveForm.title.trim() || `${save.managing_group ?? "Managed group"} ${newLiveForm.liveType}`}`,
          body: `Need JPY ${reservation.reservationFeeYen.toLocaleString("ja-JP")} for the venue reservation fee, but current cash is JPY ${currentCash.toLocaleString("ja-JP")}.`,
          sender: "Operations",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
          dedupeKey: `live-schedule-cash-blocked|${newLiveForm.date}|${newLiveForm.venueName}|${newLiveForm.title}`,
        });
        paintGame();
        return;
      }
      const goodsUids = [...newLiveForm.goodsUids];
      const goodsNames = goodsUids.map((uid) => goodsDisplayLabel(findGoodsByUid(uid))).filter(Boolean);
      const goodsGross = estimateCurrentLiveGoodsGross(newLiveForm.liveType, newLiveForm.venueName, goodsUids);
      const uid = `manual-live-${Date.now().toString(36)}`;
      const live = {
        uid,
        title: newLiveForm.title.trim() || `${save.managing_group ?? "Managed group"} ${newLiveForm.liveType}`,
        title_romanji: "",
        event_type: LIVE_TYPE_PRESETS[newLiveForm.liveType].event_type,
        live_type: newLiveForm.liveType,
        start_date: newLiveForm.date,
        end_date: newLiveForm.date,
        start_time: newLiveForm.startTime,
        end_time: newLiveForm.endTime,
        duration: 0,
        rehearsal_start: newLiveForm.rehearsalStart,
        rehearsal_end: newLiveForm.rehearsalEnd,
        venue: newLiveForm.venueName || null,
        venue_uid: venue?.uid ?? null,
        location: venue?.location ?? "",
        description: `Managed ${newLiveForm.liveType.toLowerCase()} for ${save.managing_group ?? "managed group"}.`,
        performance_count: 1,
        capacity: venue?.capacity ?? null,
        attendance: null,
        ticket_price: newLiveForm.ticketPriceYen,
        vip_ticket_price: newLiveForm.vipTicketPriceYen,
        vip_capacity: newLiveForm.vipCapacity,
        poster_image_path: null,
        setlist: [...newLiveForm.setlist],
        program: newLiveForm.program.map((item) => ({ ...item })),
        tokutenkai_enabled: newLiveForm.tokutenkaiEnabled,
        tokutenkai_start: newLiveForm.tokutenkaiStart,
        tokutenkai_end: newLiveForm.tokutenkaiEnd,
        tokutenkai_duration: 0,
        tokutenkai_ticket_price: newLiveForm.tokutenkaiTicketPrice,
        tokutenkai_slot_seconds: newLiveForm.tokutenkaiSlotSeconds,
        tokutenkai_expected_tickets: newLiveForm.tokutenkaiExpectedTickets,
        goods_enabled: newLiveForm.goodsEnabled,
        goods_uids: goodsUids,
        goods_uid: goodsUids[0] ?? "",
        goods_line: goodsNames.join(", "),
        goods_expected_revenue_yen: goodsGross,
        group: [save.managing_group ?? ""].filter(Boolean),
        group_uid: save.managing_group_uid ?? "",
        status: "scheduled",
      };
      finances.cash_yen = currentCash - reservation.reservationFeeYen;
      save.lives.schedules.push(live);
      addNotification(save, {
        title: `Live scheduled: ${live.title}`,
        body: `${live.start_date} ${live.start_time}-${live.end_time} · ${live.venue ?? "TBA"} · ${newLiveForm.setlist.length} song(s) · tokutenkai ${newLiveForm.tokutenkaiEnabled ? "on" : "off"} · goods ${newLiveForm.goodsEnabled ? "on" : "off"} · venue reservation fee JPY ${reservation.reservationFeeYen.toLocaleString("ja-JP")} (${Math.round(reservation.reservationRate * 100)}% of JPY ${reservation.baseVenueFeeYen.toLocaleString("ja-JP")}).`,
        sender: "Operations",
        category: "internal",
        level: "normal",
        isoDate: currentIsoForNewLive(),
        unread: true,
        dedupeKey: `live-scheduled|${uid}`,
        relatedEventUid: uid,
      });
      scheduledLiveUid = uid;
      livesTab = "scheduled";
      resetNewLiveFormDefaults(newLiveForm.liveType);
      paintGame();
      return;
    }
    const cancelLiveBtn = t.closest<HTMLElement>("[data-live-cancel]");
    if (cancelLiveBtn && save && !browseMode && currentView === "Lives") {
      const uid = cancelLiveBtn.getAttribute("data-live-cancel");
      if (uid) {
        save.lives.schedules = save.lives.schedules.filter((row) => String((row as { uid?: unknown }).uid ?? "") !== uid);
        scheduledLiveUid = null;
        paintGame();
      }
      return;
    }
    const scoutTabPick = t.closest<HTMLElement>("[data-scout-tab]");
    if (scoutTabPick && save && !browseMode && currentView === "Scout") {
      const tab = scoutTabPick.getAttribute("data-scout-tab");
      if (tab === "freelancer" || tab === "transfer" || tab === "audition") {
        navigate(() => {
          scoutTab = tab;
        });
      }
      return;
    }
    const trainingTabPick = t.closest<HTMLElement>("[data-training-tab]");
    if (trainingTabPick && save && !browseMode && currentView === "Training") {
      const tab = trainingTabPick.getAttribute("data-training-tab");
      if (tab === "assignments" || tab === "roster" || tab === "songs") {
        navigate(() => {
          trainingTab = tab;
        });
      }
      return;
    }
    const trainingSortPick = t.closest<HTMLElement>("[data-training-roster-sort]");
    if (trainingSortPick && save && !browseMode && currentView === "Training") {
      const key = trainingSortPick.getAttribute("data-training-roster-sort");
      if (
        key === "romaji" ||
        key === "age" ||
        key === "ability" ||
        key === "condition" ||
        key === "morale" ||
        key === "started"
      ) {
        if (trainingRosterSortKey === key) {
          trainingRosterSortDir = trainingRosterSortDir === "asc" ? "desc" : "asc";
        } else {
          trainingRosterSortKey = key;
          trainingRosterSortDir = "asc";
        }
        paintGame();
      }
      return;
    }
    const financeRangePick = t.closest<HTMLElement>("[data-finance-history-range]");
    if (financeRangePick && save && !browseMode && currentView === "Finances") {
      const range = financeRangePick.getAttribute("data-finance-history-range");
      if (range === "day" || range === "week" || range === "month" || range === "year" || range === "all") {
        navigate(() => {
          financeHistoryRange = range;
        });
      }
      return;
    }
    const scoutCompanyPick = t.closest<HTMLElement>("[data-scout-company]");
    if (scoutCompanyPick && save && !browseMode && currentView === "Scout") {
      const uid = scoutCompanyPick.getAttribute("data-scout-company");
      if (uid) {
        navigate(() => {
          save.scout.selected_company_uid = uid;
          selectedScoutLeadUid = null;
          selectedScoutApplicantUid = null;
        });
      }
      return;
    }
    const scoutLeadPick = t.closest<HTMLElement>("[data-scout-lead]");
    if (scoutLeadPick && save && !browseMode && currentView === "Scout") {
      navigate(() => {
        selectedScoutLeadUid = scoutLeadPick.getAttribute("data-scout-lead");
      });
      return;
    }
    const shortlistLeadBtn = t.closest<HTMLElement>("[data-scout-shortlist]");
    if (shortlistLeadBtn && save && !browseMode && currentView === "Scout") {
      const uid = shortlistLeadBtn.getAttribute("data-scout-shortlist");
      if (uid && !save.shortlist.includes(uid)) {
        save.shortlist.push(uid);
        addNotification(save, {
          title: `Shortlist updated: ${uid}`,
          body: `A scout lead was added to your shortlist for follow-up.`,
          sender: "Scout",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
          dedupeKey: `scout-shortlist|${uid}|${currentIsoForNewLive()}`,
          relatedEventUid: uid,
        });
      }
      paintGame();
      return;
    }
    const holdAuditionBtn = t.closest<HTMLElement>("[data-scout-hold-audition]");
    if (holdAuditionBtn && save && !browseMode && currentView === "Scout") {
      const currentSave = save;
      const company = buildDefaultScoutCompanies().find((row) => row.uid === currentSave.scout.selected_company_uid);
      if (company) {
        const key = buildAuditionStorageKey(company.uid, currentIsoForNewLive());
        if (!Array.isArray(currentSave.scout.auditions[key]) || currentSave.scout.auditions[key].length === 0) {
          currentSave.scout.auditions[key] = generateAuditionCandidates(company, currentIsoForNewLive());
        }
      }
      paintGame();
      return;
    }
    const scoutApplicantPick = t.closest<HTMLElement>("[data-scout-applicant]");
    if (scoutApplicantPick && save && !browseMode && currentView === "Scout") {
      navigate(() => {
        selectedScoutApplicantUid = scoutApplicantPick.getAttribute("data-scout-applicant");
      });
      return;
    }
    const signApplicantBtn = t.closest<HTMLElement>("[data-scout-sign-applicant]");
    if (signApplicantBtn && save && !browseMode && currentView === "Scout") {
      const applicantUid = signApplicantBtn.getAttribute("data-scout-sign-applicant");
      const currentSave = save;
      const company = buildDefaultScoutCompanies().find((row) => row.uid === currentSave.scout.selected_company_uid);
      if (applicantUid && company) {
        const key = buildAuditionStorageKey(company.uid, currentIsoForNewLive());
        const rows = Array.isArray(currentSave.scout.auditions[key]) ? (currentSave.scout.auditions[key] as Record<string, unknown>[]) : [];
        const row = rows.find((item) => String(item.uid ?? "") === applicantUid);
        if (row) {
          let signedUid = String(row.signed_idol_uid ?? "");
          if (!signedUid) {
            const idolRow = auditionCandidateToIdolRow(row as never);
            signedUid = String(idolRow.uid ?? applicantUid);
            row.signed_idol_uid = signedUid;
            if (!currentSave.database_snapshot.idols.some((idol) => String(idol.uid ?? "") === signedUid)) {
              currentSave.database_snapshot.idols.push(idolRow);
            }
          }
          if (!currentSave.shortlist.includes(signedUid)) currentSave.shortlist.push(signedUid);
          addNotification(currentSave, {
            title: `Signing confirmation: ${String(row.name ?? signedUid)}`,
            body: `${String(row.name ?? signedUid)} joined your scout shortlist as a new freelancer candidate.`,
            sender: "Scout",
            category: "decision",
            level: "high",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `scout-sign|${signedUid}|${currentIsoForNewLive()}`,
            relatedEventUid: signedUid,
          });
        }
      }
      paintGame();
      return;
    }
    if (t.id === "btn-inbox-mark-all" && save && !browseMode) {
      for (const n of save.inbox.notifications) {
        if (!notificationRequiresAck(n)) n.read = true;
      }
      paintGame();
      return;
    }
    const liveStartBtn = t.closest<HTMLElement>("[data-inbox-live-start]");
    if (liveStartBtn && save && !browseMode) {
      const uid = liveStartBtn.getAttribute("data-inbox-live-start");
      if (uid) {
        runSimulationTask(() => {
          if (!save) return;
          attentionActionUid = null;
          save = acknowledgeInboxNotification(save, uid);
          currentView = "Inbox";
          inboxSelectedUid = newestVisibleLiveReportUid(save) ?? save.inbox.notifications[0]?.uid ?? null;
        });
      }
      return;
    }
    const inboxPick = t.closest<HTMLButtonElement>(".inbox-row-btn");
    if (inboxPick && save && !browseMode && currentView === "Inbox") {
      const u = inboxPick.getAttribute("data-inbox-uid");
      if (u) {
        navigate(() => {
          attentionActionUid = null;
          inboxSelectedUid = u;
          markInboxOpened(u);
        });
      }
      return;
    }
    const liveOpenBtn = t.closest<HTMLElement>("[data-live-open-uid]");
    if (liveOpenBtn && save && !browseMode) {
      const uid = liveOpenBtn.getAttribute("data-live-open-uid");
      if (uid) {
        navigate(() => {
          currentView = "Lives";
          livesTab = "live";
          scheduledLiveUid = uid;
        });
      }
      return;
    }
    const openTrainingView = t.closest<HTMLElement>("[data-open-training-view]");
    if (openTrainingView && save && !browseMode) {
      const tab = openTrainingView.getAttribute("data-open-training-view");
      if (tab === "assignments" || tab === "roster") {
        navigate(() => {
          currentView = "Training";
          trainingTab = tab;
        });
      }
      return;
    }
    const openSongs = t.closest<HTMLElement>("[data-open-songs-for-group]");
    if (openSongs) {
      const enc = openSongs.getAttribute("data-open-songs-for-group");
      if (enc != null && enc.length) {
        navigate(() => {
          try {
            songsGroupUid = decodeURIComponent(enc);
          } catch {
            songsGroupUid = enc;
          }
          groupDetailUid = null;
          idolDetailUid = null;
          currentView = "Songs";
          songsWorkspaceTab = "group_songs";
          songsDiscographyKey = null;
        });
      }
      return;
    }
    if (t.closest("[data-making-arrange]") && currentView === "Making") {
      ev.preventDefault();
      return;
    }
    if (t.closest("[data-making-release]") && currentView === "Making") {
      ev.preventDefault();
      return;
    }
    const makingTabPick = t.closest<HTMLElement>("[data-making-tab]");
    if (makingTabPick && currentView === "Making") {
      const tab = makingTabPick.getAttribute("data-making-tab");
      if (tab === "songs" || tab === "goods") {
        navigate(() => {
          makingTab = tab;
        });
      }
      return;
    }
    const goodsOrderBtn = t.closest<HTMLElement>("[data-goods-order-key]");
    if (goodsOrderBtn && save && !browseMode && currentView === "Making") {
      const rowKeyRaw = goodsOrderBtn.getAttribute("data-goods-order-key");
      const rowKey = rowKeyRaw ? decodeURIComponent(rowKeyRaw) : "";
      const items = save.goods_inventory.filter((row) => goodsMatrixKey(row) === rowKey);
      if (items.length) {
        const totalCost = items.reduce(
          (sum, item) =>
            sum +
            Math.max(0, Number(item.desired_amount ?? 0) || 0) * Math.max(0, Number(item.unit_cost_yen ?? 0) || 0),
          0,
        );
        const totalAmount = items.reduce((sum, item) => sum + Math.max(0, Number(item.desired_amount ?? 0) || 0), 0);
        const finances = save.finances as Record<string, unknown>;
        const currentCash = Math.max(0, Number(finances.cash_yen ?? 0) || 0);
        const rowLabel = items[0]!.name;
        if (totalAmount <= 0) {
          addNotification(save, {
            title: `Goods order skipped: ${rowLabel}`,
            body: `Enter at least one unit in the member cells before ordering ${rowLabel}.`,
            sender: "Operations",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `goods-order-empty|${rowKey}|${currentIsoForNewLive()}`,
          });
          paintGame();
          return;
        }
        if (totalCost > currentCash) {
          addNotification(save, {
            title: `Goods order blocked: ${rowLabel}`,
            body: `Need JPY ${totalCost.toLocaleString("ja-JP")} to make ${totalAmount} units, but current cash is JPY ${currentCash.toLocaleString("ja-JP")}.`,
            sender: "Operations",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `goods-order-blocked|${rowKey}|${currentIsoForNewLive()}`,
          });
          paintGame();
          return;
        }
        finances.cash_yen = currentCash - totalCost;
        for (const item of items) {
          const amount = Math.max(0, Number(item.desired_amount ?? 0) || 0);
          item.stock = Math.max(0, Number(item.stock ?? 0) || 0) + amount;
        }
        addNotification(save, {
          title: `Goods made: ${rowLabel}`,
          body: `${totalAmount} units completed across ${items.length} member slot(s). Production cost JPY ${totalCost.toLocaleString("ja-JP")}.`,
          sender: "Operations",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
          dedupeKey: `goods-order|${rowKey}|${currentIsoForNewLive()}|${totalAmount}`,
        });
        paintGame();
      }
      return;
    }
    const birthdayGoodsOrderBtn = t.closest<HTMLElement>("[data-birthday-goods-order-uid]");
    if (birthdayGoodsOrderBtn && save && !browseMode && currentView === "Making") {
      const memberUid = birthdayGoodsOrderBtn.getAttribute("data-birthday-goods-order-uid");
      const memberName = birthdayGoodsOrderBtn.getAttribute("data-goods-member-name");
      const item = ensureBirthdayGoodsRowFromDataset(memberUid, memberName);
      if (item) {
        const amount = Math.max(0, Number(item.desired_amount ?? 0) || 0);
        const totalCost = amount * Math.max(0, Number(item.unit_cost_yen ?? 0) || 0);
        const finances = save.finances as Record<string, unknown>;
        const currentCash = Math.max(0, Number(finances.cash_yen ?? 0) || 0);
        if (amount <= 0) {
          addNotification(save, {
            title: `Birthday tee order skipped: ${memberName ?? item.member_name ?? item.name}`,
            body: `Enter at least one unit before queueing this birthday T-shirt order.`,
            sender: "Operations",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `birthday-goods-order-empty|${item.uid}|${currentIsoForNewLive()}`,
          });
          paintGame();
          return;
        }
        if (totalCost > currentCash) {
          addNotification(save, {
            title: `Birthday tee order blocked: ${memberName ?? item.member_name ?? item.name}`,
            body: `Need JPY ${totalCost.toLocaleString("ja-JP")} to make ${amount} units, but current cash is JPY ${currentCash.toLocaleString("ja-JP")}.`,
            sender: "Operations",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `birthday-goods-order-blocked|${item.uid}|${currentIsoForNewLive()}`,
          });
          paintGame();
          return;
        }
        finances.cash_yen = currentCash - totalCost;
        item.stock = Math.max(0, Number(item.stock ?? 0) || 0) + amount;
        addNotification(save, {
          title: `Birthday tees made: ${memberName ?? item.member_name ?? item.name}`,
          body: `${amount} units completed. Production cost JPY ${totalCost.toLocaleString("ja-JP")}.`,
          sender: "Operations",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
          dedupeKey: `birthday-goods-order|${item.uid}|${currentIsoForNewLive()}|${amount}`,
        });
        paintGame();
      }
      return;
    }
    const workspacePick = t.closest<HTMLElement>("[data-songs-workspace-tab]");
    if (workspacePick && currentView === "Songs") {
      const tab = workspacePick.getAttribute("data-songs-workspace-tab");
      if (tab === "group_songs" || tab === "disc") {
        navigate(() => {
          songsWorkspaceTab = tab;
        });
      }
      return;
    }
    const discRow = t.closest<HTMLElement>("[data-songs-discography-key]");
    if (discRow && currentView === "Songs" && songsWorkspaceTab === "disc") {
      const raw = discRow.getAttribute("data-songs-discography-key");
      if (raw != null && raw.length) {
        navigate(() => {
          try {
            songsDiscographyKey = decodeURIComponent(raw);
          } catch {
            songsDiscographyKey = raw;
          }
        });
      }
      return;
    }
    const layoutPick = t.closest<HTMLElement>("[data-idol-layout]");
    if (layoutPick && currentView === "Idols" && !idolDetailUid) {
      const mode = layoutPick.dataset.idolLayout;
      if (mode === "cards" || mode === "list") {
        try {
          localStorage.setItem(IDOL_LIST_LAYOUT_KEY, mode);
        } catch {
          /* ignore */
        }
        paintGame();
      }
      return;
    }
    if (t.closest("#btn-group-detail-back")) {
      navigate(() => {
        groupDetailUid = null;
      });
      return;
    }
    const groupOpen = t.closest<HTMLElement>("[data-group-detail]");
    if (groupOpen) {
      const guid = groupOpen.getAttribute("data-group-detail");
      if (guid) {
        navigate(() => {
          groupDetailUid = guid;
          idolDetailUid = null;
          currentView = "Groups";
        });
      }
      return;
    }
    if (t.closest("#btn-idol-detail-back")) {
      navigate(() => {
        idolDetailUid = null;
      });
      return;
    }
    const tile = t.closest<HTMLElement>("[data-idol-detail]");
    if (!tile || browseMode) return;
    const uid = tile.getAttribute("data-idol-detail");
    if (uid) {
      navigate(() => {
        idolDetailUid = uid;
        groupDetailUid = null;
        currentView = "Idols";
      });
    }
  });

  document.getElementById("main-content")?.addEventListener("input", (ev) => {
    const t = ev.target as HTMLElement;
    const goodsPriceInput = t.closest<HTMLInputElement>("[data-goods-price-key]");
    if (goodsPriceInput && save && !browseMode && currentView === "Making") {
      const rowKeyRaw = goodsPriceInput.getAttribute("data-goods-price-key");
      const rowKey = rowKeyRaw ? decodeURIComponent(rowKeyRaw) : "";
      const nextPrice = Math.max(0, numberOrZero(goodsPriceInput.value));
      const memberUid = goodsPriceInput.getAttribute("data-goods-member-uid");
      const memberName = goodsPriceInput.getAttribute("data-goods-member-name");
      if (rowKey.startsWith("birthday-queue|")) {
        const item = ensureBirthdayGoodsRowFromDataset(memberUid, memberName);
        if (item) item.unit_price_yen = nextPrice;
      } else {
        for (const item of save.goods_inventory) {
          if (goodsMatrixKey(item) === rowKey) item.unit_price_yen = nextPrice;
        }
      }
      return;
    }
    const goodsDesiredInput = t.closest<HTMLInputElement>("[data-goods-desired-uid]");
    if (goodsDesiredInput && save && !browseMode && currentView === "Making") {
      const uid = goodsDesiredInput.getAttribute("data-goods-desired-uid");
      const item =
        save.goods_inventory.find((row) => row.uid === uid) ??
        ensureBirthdayGoodsRowFromDataset(
          goodsDesiredInput.getAttribute("data-goods-member-uid"),
          goodsDesiredInput.getAttribute("data-goods-member-name"),
        );
      if (item) {
        item.desired_amount = Math.max(0, numberOrZero(goodsDesiredInput.value));
      }
      return;
    }
    const programDurationInput = t.closest<HTMLInputElement>("[data-live-program-duration]");
    if (programDurationInput && save && !browseMode && currentView === "Lives") {
      const index = Number(programDurationInput.getAttribute("data-live-program-duration"));
      const duration = Math.max(1, numberOrZero(programDurationInput.value));
      if (Number.isFinite(index) && newLiveForm.program[index]) {
        newLiveForm.program = newLiveForm.program.map((item, idx) =>
          idx === index ? { ...item, durationMinutes: duration } : item,
        );
        syncNewLiveFormSetlistFromProgram();
        paintGame();
      }
      return;
    }
    const liveInput = t.closest<HTMLInputElement | HTMLSelectElement>("[data-live-form-field]");
    if (liveInput && save && !browseMode && currentView === "Lives") {
      const field = liveInput.getAttribute("data-live-form-field");
      if (field) {
        const value = liveInput.value;
        switch (field) {
          case "liveType":
            resetNewLiveFormDefaults(value as NewLiveFormState["liveType"]);
            break;
          case "title":
            newLiveForm.title = value;
            reconcileNewLiveGoodsSelection();
            break;
          case "date":
            newLiveForm.date = value;
            break;
          case "startTime":
            newLiveForm.startTime = value;
            break;
          case "endTime":
            newLiveForm.endTime = value;
            break;
          case "rehearsalStart":
            newLiveForm.rehearsalStart = value;
            break;
          case "rehearsalEnd":
            newLiveForm.rehearsalEnd = value;
            break;
          case "venueName":
            newLiveForm.venueName = value;
            break;
          case "tokutenkaiStart":
            newLiveForm.tokutenkaiStart = value;
            break;
          case "tokutenkaiEnd":
            newLiveForm.tokutenkaiEnd = value;
            break;
          case "tokutenkaiTicketPrice":
            newLiveForm.tokutenkaiTicketPrice = numberOrZero(value);
            break;
          case "tokutenkaiSlotSeconds":
            newLiveForm.tokutenkaiSlotSeconds = numberOrZero(value);
            break;
          case "tokutenkaiExpectedTickets":
            newLiveForm.tokutenkaiExpectedTickets = numberOrZero(value);
            break;
          case "ticketPriceYen":
            newLiveForm.ticketPriceYen = numberOrZero(value);
            break;
          case "vipTicketPriceYen":
            newLiveForm.vipTicketPriceYen = numberOrZero(value);
            break;
          case "vipCapacity":
            newLiveForm.vipCapacity = numberOrZero(value);
            break;
          default:
            break;
        }
        paintGame();
      }
      return;
    }
    const liveDetailInput = t.closest<HTMLInputElement | HTMLSelectElement>("[data-live-detail-field]");
    if (liveDetailInput && save && !browseMode && currentView === "Lives") {
      const live = selectedScheduledLiveRecord();
      const field = liveDetailInput.getAttribute("data-live-detail-field");
      if (live && field) {
        const value = liveDetailInput.value;
        switch (field) {
          case "live_type":
            live.live_type = value;
            break;
          case "title":
            live.title = value;
            break;
          case "start_date":
            live.start_date = value;
            live.end_date = value;
            break;
          case "start_time":
            live.start_time = value;
            break;
          case "end_time":
            live.end_time = value;
            break;
          case "rehearsal_start":
            live.rehearsal_start = value;
            break;
          case "rehearsal_end":
            live.rehearsal_end = value;
            break;
          case "venue":
            live.venue = value;
            break;
          case "tokutenkai_start":
            live.tokutenkai_start = value;
            break;
          case "tokutenkai_end":
            live.tokutenkai_end = value;
            break;
          case "ticket_price":
            live.ticket_price = numberOrZero(value);
            break;
          case "vip_ticket_price":
            live.vip_ticket_price = numberOrZero(value);
            break;
          case "vip_capacity":
            live.vip_capacity = numberOrZero(value);
            break;
          case "tokutenkai_ticket_price":
            live.tokutenkai_ticket_price = numberOrZero(value);
            break;
          case "tokutenkai_slot_seconds":
            live.tokutenkai_slot_seconds = numberOrZero(value);
            break;
          case "tokutenkai_expected_tickets":
            live.tokutenkai_expected_tickets = numberOrZero(value);
            break;
          default:
            break;
        }
        if (field === "venue") {
          const venue = getVenuesCatalog().find((row) => row.name === value) ?? null;
          live.venue_uid = venue?.uid ?? null;
          live.location = venue?.location ?? "";
          live.capacity = venue?.capacity ?? live.capacity ?? null;
        }
        if (field === "venue" || field === "live_type") {
          const goodsUids = Array.isArray(live.goods_uids)
            ? (live.goods_uids as unknown[]).map((x) => String(x))
            : String(live.goods_uid ?? "").trim()
              ? [String(live.goods_uid ?? "").trim()]
              : [];
          live.goods_line = goodsUids
            .map((uid) => goodsDisplayLabel(findGoodsByUid(uid)))
            .filter(Boolean)
            .join(", ");
          live.goods_expected_revenue_yen = estimateCurrentLiveGoodsGross(
            String(live.live_type ?? "Routine"),
            String(live.venue ?? ""),
            goodsUids,
          );
        }
        paintGame();
      }
      return;
    }
    const sl = t.closest<HTMLInputElement>("[data-training-slider]");
    if (!sl || !save || browseMode || currentView !== "Training") return;
    const uid = sl.getAttribute("data-idol-uid");
    const field = sl.getAttribute("data-field");
    if (!uid || !field) return;
    if (!["sing", "dance", "physical", "target"].includes(field)) return;
    const v = Math.max(0, Math.min(5, Number(sl.value) || 0));
    if (!save.training_intensity[uid]) {
      save.training_intensity[uid] = { sing: 0, dance: 0, physical: 0, target: 0 };
    }
    (save.training_intensity[uid] as Record<string, number>)[field] = v;
    if (trainingRepaintTimer) clearTimeout(trainingRepaintTimer);
    trainingRepaintTimer = window.setTimeout(() => {
      trainingRepaintTimer = null;
      paintGame();
    }, 140);
  });

document.getElementById("main-content")?.addEventListener("change", (ev) => {
    const t = ev.target as HTMLElement;
    const trainingSongPick = t.closest<HTMLInputElement>("[data-training-song-pick]");
    if (trainingSongPick && save && !browseMode && currentView === "Training") {
      const uid = String(trainingSongPick.getAttribute("data-training-song-pick") ?? "").trim();
      if (uid) {
        const set = new Set(save.training_song_uids.map((x) => String(x)));
        if (trainingSongPick.checked) set.add(uid);
        else set.delete(uid);
        save.training_song_uids = [...set];
        paintGame();
      }
      return;
    }
    const focusSel = t.closest<HTMLSelectElement>("[data-training-focus]");
    if (focusSel && save && !browseMode && currentView === "Training") {
      const uid = focusSel.getAttribute("data-idol-uid");
      if (uid) {
        save.training_focus_skill[uid] = focusSel.value;
        paintGame();
      }
      return;
    }
    const liveGoodsPick = t.closest<HTMLInputElement>("[data-live-goods-pick]");
    if (liveGoodsPick && save && !browseMode && currentView === "Lives") {
      const uid = String(liveGoodsPick.getAttribute("data-live-goods-pick") ?? "").trim();
      if (uid) {
        const set = new Set(newLiveForm.goodsUids);
        if (liveGoodsPick.checked) set.add(uid);
        else set.delete(uid);
        newLiveForm.goodsUids = [...set];
        paintGame();
      }
      return;
    }
    const liveDetailGoodsPick = t.closest<HTMLInputElement>("[data-live-detail-goods-pick]");
    if (liveDetailGoodsPick && save && !browseMode && currentView === "Lives") {
      const live = selectedScheduledLiveRecord();
      const uid = String(liveDetailGoodsPick.getAttribute("data-live-detail-goods-pick") ?? "").trim();
      if (live && uid) {
        const current = Array.isArray(live.goods_uids)
          ? (live.goods_uids as unknown[]).map((x) => String(x))
          : String(live.goods_uid ?? "").trim()
            ? [String(live.goods_uid ?? "").trim()]
            : [];
        const set = new Set(current);
        if (liveDetailGoodsPick.checked) set.add(uid);
        else set.delete(uid);
        const goodsUids = [...set];
        live.goods_uids = goodsUids;
        live.goods_uid = goodsUids[0] ?? "";
        live.goods_line = goodsUids
          .map((goodsUid) => goodsDisplayLabel(findGoodsByUid(goodsUid)))
          .filter(Boolean)
          .join(", ");
        live.goods_expected_revenue_yen = estimateCurrentLiveGoodsGross(
          String(live.live_type ?? "Routine"),
          String(live.venue ?? ""),
          goodsUids,
        );
        paintGame();
      }
      return;
    }
    const liveToggle = t.closest<HTMLInputElement>("[data-live-toggle]");
    if (liveToggle && save && !browseMode && currentView === "Lives") {
      const field = liveToggle.getAttribute("data-live-toggle");
      if (field === "tokutenkaiEnabled") newLiveForm.tokutenkaiEnabled = liveToggle.checked;
      else if (field === "goodsEnabled") newLiveForm.goodsEnabled = liveToggle.checked;
      paintGame();
      return;
    }
    const liveDetailToggle = t.closest<HTMLInputElement>("[data-live-detail-toggle]");
    if (liveDetailToggle && save && !browseMode && currentView === "Lives") {
      const live = selectedScheduledLiveRecord();
      const field = liveDetailToggle.getAttribute("data-live-detail-toggle");
      if (live && field) {
        live[field] = liveDetailToggle.checked;
        paintGame();
      }
      return;
    }
    const vacationBtn = t.closest<HTMLElement>("[data-training-vacation]");
    if (vacationBtn && save && !browseMode && currentView === "Training") {
      const uid = vacationBtn.getAttribute("data-training-vacation");
      if (uid) {
        const idol = save.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid);
        if (idol && typeof idol === "object") {
          const root = vacationBtn.closest("tr, .training-vacation-controls, td, article") ?? document;
          const daysInput = root.querySelector<HTMLInputElement>(`[data-training-vacation-days="${uid}"]`);
          const rawDays = Number(daysInput?.value ?? 1);
          const hiatusDays = Number.isFinite(rawDays) ? Math.max(1, Math.min(365, Math.trunc(rawDays))) : 1;
          const period = scheduleIdolVacation(
            idol as Record<string, unknown>,
            save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? currentIsoForNewLive(),
            hiatusDays,
          );
          const name = String((idol as Record<string, unknown>).name ?? uid);
          addNotification(save, {
            title: `Hiatus scheduled: ${name}`,
            body: `${name} is on vacation from ${period.start_date} and will return on ${period.return_date}. Training and managed live participation are paused during this period.`,
            sender: "Assistant",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `hiatus|${uid}|${period.start_date}|${period.return_date}`,
          });
        }
        paintGame();
      }
      return;
    }
    const sel = ev.target as HTMLSelectElement;
    if (sel.id !== "songs-group-select" || currentView !== "Songs") return;
    const v = sel.value;
    navigate(() => {
      try {
        songsGroupUid = decodeURIComponent(v);
      } catch {
        songsGroupUid = v;
      }
      songsDiscographyKey = null;
      songsWorkspaceTab = "group_songs";
    });
  });

  document.getElementById("main-content")?.addEventListener("dragstart", (ev) => {
    const t = ev.target as HTMLElement;
    if (!save || browseMode || currentView !== "Lives") return;
    const song = t.closest<HTMLElement>("[data-live-palette-song]");
    if (song) {
      liveProgramDragData = JSON.stringify({
        source: "song",
        title: song.getAttribute("data-live-palette-song") ?? "",
      });
      ev.dataTransfer?.setData("text/plain", liveProgramDragData);
      return;
    }
    const template = t.closest<HTMLElement>("[data-live-template]");
    if (template) {
      liveProgramDragData = JSON.stringify({
        source: "template",
        token: template.getAttribute("data-live-template") ?? "",
      });
      ev.dataTransfer?.setData("text/plain", liveProgramDragData);
      return;
    }
    const programItem = t.closest<HTMLElement>("[data-live-program-index]");
    if (programItem) {
      liveProgramDragData = JSON.stringify({
        source: "program",
        index: Number(programItem.getAttribute("data-live-program-index")),
      });
      ev.dataTransfer?.setData("text/plain", liveProgramDragData);
    }
  });

  document.getElementById("main-content")?.addEventListener("dragover", (ev) => {
    const t = ev.target as HTMLElement;
    if (!save || browseMode || currentView !== "Lives") return;
    if (t.closest("[data-live-drop-index]")) ev.preventDefault();
  });

  document.getElementById("main-content")?.addEventListener("drop", (ev) => {
    const t = ev.target as HTMLElement;
    if (!save || browseMode || currentView !== "Lives") return;
    const dropTarget = t.closest<HTMLElement>("[data-live-drop-index]");
    if (!dropTarget) return;
    ev.preventDefault();
    const targetIndex = Number(dropTarget.getAttribute("data-live-drop-index"));
    const raw = ev.dataTransfer?.getData("text/plain") || liveProgramDragData;
    if (!raw || !Number.isFinite(targetIndex)) return;
    try {
      const payload = JSON.parse(raw) as Record<string, unknown>;
      if (payload.source === "song") {
        let title = String(payload.title ?? "");
        try {
          title = decodeURIComponent(title);
        } catch {
          /* keep raw */
        }
        insertProgramItem(targetIndex, createSongProgramItem(title));
      } else if (payload.source === "template") {
        const [kindRaw, durationRaw] = String(payload.token ?? "").split(":");
        const kind = kindRaw === "mc" || kindRaw === "break" ? kindRaw : null;
        const duration = Math.max(1, Number(durationRaw) || 0);
        if (kind) insertProgramItem(targetIndex, createBlockProgramItem(kind, duration));
      } else if (payload.source === "program") {
        const fromIndex = Number(payload.index);
        if (Number.isFinite(fromIndex)) moveProgramItem(fromIndex, targetIndex);
      }
      paintGame();
    } catch {
      /* ignore malformed drag payload */
    } finally {
      liveProgramDragData = "";
    }
  });

  appRoot.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.nav;
      if (!v || !isDesktopNavId(v)) return;
      if (browseMode && !isBrowseNav(v)) return;
      if (!browseMode && save && !isManagementNav(v)) return;
      navigate(() => {
        if (currentView === "Schedule" && v !== "Schedule") {
          scheduleCalendarMonthStart = null;
        }
        idolDetailUid = null;
        groupDetailUid = null;
        if (v !== "Inbox") inboxSelectedUid = null;
        currentView = v;
      });
    });
  });

  appRoot.querySelectorAll<HTMLButtonElement>("[data-history]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = btn.getAttribute("data-history");
      if (dir === "back") goHistory("back");
      else if (dir === "fwd") goHistory("forward");
    });
  });

  appRoot.querySelectorAll<HTMLButtonElement>("[data-training-roster-sort]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (!save || browseMode || currentView !== "Training") return;
      const key = btn.getAttribute("data-training-roster-sort");
      if (
        key !== "romaji" &&
        key !== "age" &&
        key !== "ability" &&
        key !== "condition" &&
        key !== "morale" &&
        key !== "started"
      ) {
        return;
      }
      if (trainingRosterSortKey === key) {
        trainingRosterSortDir = trainingRosterSortDir === "asc" ? "desc" : "asc";
      } else {
        trainingRosterSortKey = key;
        trainingRosterSortDir = "asc";
      }
      paintGame();
    });
  });

  document.getElementById("btn-next-day")?.addEventListener("click", () => {
    if (!save || browseMode || simulationBusy) return;
    sortNotificationsInPlace(save.inbox.notifications);
    const unreadUid = oldestUnreadInboxUid(save.inbox.notifications);
    if (unreadUid) {
      attentionActionUid = null;
      currentView = "Inbox";
      inboxSelectedUid = unreadUid;
      paintGame();
      return;
    }
    const blocker = getBlockingNotificationForSave(save);
    if (blocker) {
      attentionActionUid = blocker.uid;
      currentView = "Inbox";
      inboxSelectedUid = blocker.uid;
      paintGame();
      return;
    }
    runSimulationTask(() => {
      if (!save) return;
      attentionActionUid = null;
      const beforeDate = isoDatePart(save.current_date ?? save.game_start_date ?? "");
      save = advanceOneDay(save);
      const afterDate = isoDatePart(save.current_date ?? save.game_start_date ?? "");
      if (afterDate !== beforeDate) {
        saveToSlot(AUTOSAVE_SLOT, save);
      }
      currentView = "Inbox";
      inboxSelectedUid = save.inbox.notifications[0]?.uid ?? null;
      resetNewLiveFormDefaults(newLiveForm.liveType);
    });
  });
  document.getElementById("btn-save")?.addEventListener("click", () => {
    if (!save || browseMode) return;
    saveToSlot(slot, save);
    paintGame();
  });
  document.getElementById("btn-load")?.addEventListener("click", () => {
    if (browseMode) return;
    const loaded = loadFromSlot(slot);
    if (loaded && assertHydratedSave(loaded)) {
      save = loaded;
      scheduleCalendarMonthStart = null;
      resetNewLiveFormDefaults();
      if (loadedScenario) {
        hydrateSnapshotSongsFromScenario(save, loadedScenario.songs, loadedScenario.preset.data_subdir);
      }
      resetNavigationHistory();
    }
    paintGame();
  });
  document.getElementById("btn-new")?.addEventListener("click", () => {
    if (!loadedScenario) return;
    browseMode = false;
    idolDetailUid = null;
    groupDetailUid = null;
    openingScreen = "new_game";
    selectedNewGameGroupUid = null;
    paintOpening();
  });
  document.getElementById("btn-clear")?.addEventListener("click", () => {
    clearSlot(slot);
    scheduleCalendarMonthStart = null;
    paintGame();
  });
  document.getElementById("slot-select")?.addEventListener("change", (ev) => {
    const v = Number((ev.target as HTMLSelectElement).value);
    if (!Number.isNaN(v)) slot = v;
  });
  document.getElementById("btn-main-menu")?.addEventListener("click", () => {
    browseMode = false;
    idolDetailUid = null;
    groupDetailUid = null;
    openingScreen = "home";
    resetNavigationHistory();
    paintOpening();
  });
}

appRoot.innerHTML = `<p class="fm-loading">Loading scenario…</p>`;

loadDefaultScenario()
  .then((ls) => {
    loadedScenario = ls;
    openingStatus = `Loaded ${ls.preset.data_subdir} (${ls.idols.length} idols, ${ls.songs.length.toLocaleString()} song rows).`;
    openingScreen = "home";
    paintOpening();
  })
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    appRoot.innerHTML = `<div class="fm-error" role="alert"><strong>Could not load scenario.</strong><br />${htmlEsc(msg)}</div>`;
  });

