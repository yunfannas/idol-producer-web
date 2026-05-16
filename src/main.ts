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
import { sortGroupsForDirectory } from "./engine/financeSystem";
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
  type NewLiveFormState,
  type ScoutTab,
  type SongsWorkspaceTab,
  type TrainingTab,
  BROWSE_NAV_ITEMS,
} from "./ui/gameShell";
import { hydrateSnapshotSongsFromScenario } from "./save/gameSaveSchema";
import { addNotification, notificationRequiresAck, sortNotificationsInPlace } from "./save/inbox";
import { songsForDisplaySorted, buildDiscBuckets } from "./data/songDisplayPolicy";
import { songCatalogDisplayLabel } from "./data/songCatalog";
import { addMinutesToHHMM, getVenuesCatalog, LIVE_TYPE_PRESETS } from "./engine/liveScheduleWeb";
import {
  auditionCandidateToIdolRow,
  buildAuditionStorageKey,
  buildDefaultScoutCompanies,
  generateAuditionCandidates,
} from "./engine/scoutWeb";
import { normalizeFestivalCatalog, syncManagedTif2025Lives } from "./engine/festivalWeb";
import { ensureAutoBookedLivesThroughEndOfNextMonth, maybeSeedMonthEndAutoBookPrompt } from "./engine/monthlyLiveScheduler";
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
  const tokutenkaiStart = preset.tokutenkai_enabled ? endTime : "";
  const tokutenkaiEnd = preset.tokutenkai_enabled ? addMinutesToHHMM(endTime, preset.tokutenkai_duration) : "";
  const managedUid = save?.managing_group_uid ?? "";
  const suggestedSetlist = save
    ? songsForDisplaySorted(save.database_snapshot.songs)
        .filter((row) => String(row.group_uid ?? "") === managedUid)
        .slice(0, liveType === "Concert" ? 6 : liveType === "Taiban" ? 3 : 5)
        .map((row) => songCatalogDisplayLabel(row))
        .filter(Boolean)
    : [];
  const venue = getVenuesCatalog()[0]?.name ?? "";
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
    goodsLine: liveType === "Concert" ? "Tour shirt + cheki" : "Cheki + random bromide",
    goodsExpectedRevenueYen: liveType === "Concert" ? 90000 : liveType === "Taiban" ? 25000 : 45000,
    ticketPriceYen: liveType === "Concert" ? 3800 : liveType === "Festival" ? 0 : 2500,
  };
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

let loadedScenario: LoadedScenario | null = null;
let save: GameSavePayload | null = null;
let slot = 0;
let browseMode = false;
let openingScreen: OpeningScreen = "home";
let selectedNewGameGroupUid: string | null = null;
let openingStatus = "";
let uiLang: UiLanguage = readUiLanguage();

let currentView: DesktopNavId = "Inbox";
let idolDetailUid: string | null = null;
let groupDetailUid: string | null = null;
/** Songs view: selected `group_uid` from snapshot (browse or save). */
let songsGroupUid: string | null = null;
/** Songs view: `group_songs` = track list, `disc` = discography (desktop `main_ui.py`). */
let songsWorkspaceTab: SongsWorkspaceTab = "group_songs";
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
  goodsLine: "Cheki + logo towel",
  goodsExpectedRevenueYen: 45000,
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
  inboxSelectedUid: string | null;
  livesTab: LivesTab;
  scheduledLiveUid: string | null;
  scoutTab: ScoutTab;
  trainingTab: TrainingTab;
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
    inboxSelectedUid,
    livesTab,
    scheduledLiveUid,
    scoutTab,
    trainingTab,
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
    a.inboxSelectedUid === b.inboxSelectedUid &&
    a.livesTab === b.livesTab &&
    a.scheduledLiveUid === b.scheduledLiveUid &&
    a.scoutTab === b.scoutTab &&
    a.trainingTab === b.trainingTab &&
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
  inboxSelectedUid = snapshot.inboxSelectedUid;
  livesTab = snapshot.livesTab;
  scheduledLiveUid = snapshot.scheduledLiveUid;
  scoutTab = snapshot.scoutTab;
  trainingTab = snapshot.trainingTab;
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
    inboxSelectedUid,
    livesTab,
    scheduledLiveUid,
    newLiveForm,
    selectedLiveSongTitle,
    selectedSetlistSongIndex,
    scoutTab,
    trainingTab,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    canGoBack: backHistory.length > 0,
    canGoForward: forwardHistory.length > 0,
    slot,
    occupiedSlots: listOccupiedSlots(),
  });
  restoreFocus(appRoot, focus);

  wirePortraitFallbacks(appRoot);

  if (save && !browseMode) {
    const nextBtn = document.getElementById("btn-next-day") as HTMLButtonElement | null;
    if (nextBtn) {
      const hasTodayEvents = hasPendingEventsToday(save);
      nextBtn.textContent = hasTodayEvents ? "Next" : "Next Day";
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
        goods_line: newLiveForm.goodsLine,
        goods_expected_revenue_yen: newLiveForm.goodsExpectedRevenueYen,
        group: [save.managing_group ?? ""].filter(Boolean),
        group_uid: save.managing_group_uid ?? "",
        status: "scheduled",
      };
      save.lives.schedules.push(live);
      addNotification(save, {
        title: `Live scheduled: ${live.title}`,
        body: `${live.start_date} ${live.start_time}-${live.end_time} · ${live.venue ?? "TBA"} · ${newLiveForm.setlist.length} song(s) · tokutenkai ${newLiveForm.tokutenkaiEnabled ? "on" : "off"} · goods ${newLiveForm.goodsEnabled ? "on" : "off"}.`,
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
      if (tab === "assignments" || tab === "roster") {
        navigate(() => {
          trainingTab = tab;
        });
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
        save = acknowledgeInboxNotification(save, uid);
        inboxSelectedUid = save.inbox.notifications[0]?.uid ?? null;
        paintGame();
      }
      return;
    }
    const inboxPick = t.closest<HTMLButtonElement>(".inbox-row-btn");
    if (inboxPick && save && !browseMode && currentView === "Inbox") {
      const u = inboxPick.getAttribute("data-inbox-uid");
      if (u) {
        navigate(() => {
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
          case "goodsLine":
            newLiveForm.goodsLine = value;
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
          case "goodsExpectedRevenueYen":
            newLiveForm.goodsExpectedRevenueYen = numberOrZero(value);
            break;
          case "ticketPriceYen":
            newLiveForm.ticketPriceYen = numberOrZero(value);
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
          case "title":
          case "start_date":
          case "start_time":
          case "end_time":
          case "rehearsal_start":
          case "rehearsal_end":
          case "venue":
          case "tokutenkai_start":
          case "tokutenkai_end":
          case "goods_line":
            live[field] = value;
            break;
          case "ticket_price":
          case "tokutenkai_ticket_price":
          case "tokutenkai_slot_seconds":
          case "tokutenkai_expected_tickets":
          case "goods_expected_revenue_yen":
            live[field] = numberOrZero(value);
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
    const focusSel = t.closest<HTMLSelectElement>("[data-training-focus]");
    if (focusSel && save && !browseMode && currentView === "Training") {
      const uid = focusSel.getAttribute("data-idol-uid");
      if (uid) {
        save.training_focus_skill[uid] = focusSel.value;
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

  document.getElementById("btn-next-day")?.addEventListener("click", () => {
    if (!save || browseMode) return;
    sortNotificationsInPlace(save.inbox.notifications);
    const unreadUid = oldestUnreadInboxUid(save.inbox.notifications);
    if (unreadUid) {
      currentView = "Inbox";
      inboxSelectedUid = unreadUid;
      paintGame();
      return;
    }
    const blocker = getBlockingNotificationForSave(save);
    if (blocker) {
      currentView = "Inbox";
      inboxSelectedUid = blocker.uid;
      paintGame();
      return;
    }
    const beforeDate = isoDatePart(save.current_date ?? save.game_start_date ?? "");
    save = advanceOneDay(save);
    const afterDate = isoDatePart(save.current_date ?? save.game_start_date ?? "");
    if (afterDate !== beforeDate) {
      saveToSlot(AUTOSAVE_SLOT, save);
    }
    currentView = "Inbox";
    inboxSelectedUid = save.inbox.notifications[0]?.uid ?? null;
    resetNewLiveFormDefaults(newLiveForm.liveType);
    paintGame();
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
