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
import { applyAttributesToAllIdols, normalizePersistedAttributes } from "./engine/idolAttributes";
import {
  ensureBirthdayTeeInventoryRow,
  estimateLiveGoodsGrossYen,
  estimateVenueFee,
  isWeekendUtc,
  monthlyBaseSalaryYenForGroupLetterTier,
  resolveGroupLetterTier,
  sortGroupsForDirectory,
  type ProducedGoodsRow,
} from "./engine/financeSystem";
import type { CdReleaseProject, GameSavePayload } from "./save/gameSaveSchema";
import {
  renderDesktopShellI18n,
  isDesktopNavId,
  isManagementNav,
  isBrowseNav,
  type DesktopNavId,
  type FinanceTab,
  type FinanceHistoryRange,
  type LiveProgramItem,
  type LivesTab,
  type LeaguePanelTab,
  type MakingTab,
  type MediaTab,
  type NewLiveFormState,
  type ScoutTab,
  type SongsWorkspaceTab,
  type TrainingTab,
  type ScheduleTab,
  type RoleBenchmarkKey,
  type TrainingRosterSortKey,
  type FeedbackEntry,
  BROWSE_NAV_ITEMS,
} from "./ui/gameShell";
import {
  ensureGroupPolicy,
  getActiveFinances,
  getPrimaryGroup,
  hydrateSnapshotGroupsFromScenario,
  hydrateSnapshotSongsFromScenario,
} from "./save/gameSaveSchema";
import { addNotification, notificationRequiresAck, sortNotificationsInPlace } from "./save/inbox";
import {
  songsForDisplaySorted,
  buildDiscBuckets,
  buildGroupDiscographyReleaseRows,
  isSongAvailableOn,
  isSongHiddenFromDisplay,
  songPopularityNum,
} from "./data/songDisplayPolicy";
import { songCatalogDisplayLabel } from "./data/songCatalog";
import { addMinutesToHHMM, autoSetlistSongCountForLive, getVenuesCatalog, LIVE_TYPE_PRESETS } from "./engine/liveScheduleWeb";
import {
  auditionCandidateToIdolRow,
  buildAuditionStorageKey,
  buildDefaultScoutCompanies,
  generateAuditionCandidates,
  recommendScoutLeads,
} from "./engine/scoutWeb";
import { normalizeFestivalCatalog, syncManagedTif2025Lives } from "./engine/festivalWeb";
import {
  ensureAutoBookedLivesThroughEndOfNextMonth,
  maybeSeedMonthEndAutoBookPrompt,
  preloadManagedLiveSchedules,
} from "./engine/monthlyLiveScheduler";
import { preloadHeroinesLeague } from "./data/heroinesLeague";
import {
  preloadCareerDecisions,
  noteCareerRecruitSigned,
} from "./engine/careerDecision";
import { preloadScandalHandlings } from "./engine/scandalHandling";
import { resolveNotificationChoice } from "./engine/scenarioRuntimeWeb";
import { suggestManagedSetlistTitles, applyFormationChangeToSongFamiliarity } from "./engine/songStatusSystem";
import { scheduleIdolVacation, isIdolUnavailableForStage } from "./engine/idolStatusSystem";
import {
  type OpeningScreen,
  renderOpeningLogin,
  renderOpeningHome,
  renderNewGameScreen,
  buildNewGameRows,
} from "./ui/openingScreens";
import { AUTOSAVE_SLOT, clearSlot, listOccupiedSlots, listSlotSummaries, loadFromSlot, normalizeAccountName, saveToSlot } from "./persistence/saves";
import { htmlEsc } from "./ui/htmlEsc";
import {
  getSongPreviewMediaTime,
  mergePreviewInput,
  playSongPreview,
  prefetchSongPreviewsInRoot,
  previewInputFromControlsEl,
  setSongPreviewEndedListener,
  stopSongPreview,
  syncSongPreviewUi,
  toggleSongPreview,
  unlockSongPreviewAudio,
} from "./ui/songPreviewPlayer";
import {
  applyLiveModeFormationForCurrentItem,
  buildLiveModeSession,
  currentLiveModeItem,
  hydrateLiveModePortraits,
  liveModeItemDurationSec,
  liveModeReactionSnapshot,
  updateLiveModeProgressDom,
  updateLiveModeReactionDom,
  type LiveModeSession,
} from "./ui/liveMode";
import {
  bindFormationEditor,
  createFormationEditorState,
  formationEditorOverlayHtml,
  renderFormationEditor,
  type FormationEditorMember,
  type FormationEditorState,
} from "./ui/formationEditor";
import {
  loadSongFormationCatalog,
  resolveSongFormation,
  type SongFormationCatalog,
  type SongStartingFormation,
} from "./data/songStartingFormation";
import { wirePortraitFallbacks } from "./ui/portraitUrl";
import { groupsForDirectoryListing } from "./data/scenarioBrowse";
import { t, type UiLanguage } from "./ui/i18n";
import { showAppConfirm } from "./ui/appConfirm";
import { renderTutorialOverlay, tutorialSteps } from "./ui/tutorialOverlay";
import { annotateWikiTerms, defaultWikiEntryKey, normalizeWikiSelection, relatedWikiKeysForView } from "./ui/wiki";
import { roleAssignmentsFromHistoryEntry } from "./data/memberRoles";

const appRootElt = document.querySelector<HTMLDivElement>("#app");
if (!appRootElt) {
  throw new Error("#app missing");
}
const appRoot: HTMLDivElement = appRootElt;
const UI_LANG_STORAGE_KEY = "idol-producer-ui-lang";
const ACCOUNT_NAME_STORAGE_KEY = "idol-producer-account-name";
const TUTORIAL_AUTO_OPEN_STORAGE_KEY = "idol-producer-tutorial-auto-open";
const FEEDBACK_STORAGE_KEY = "idol-producer-feedback-log";

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

function readAccountName(): string {
  try {
    return normalizeAccountName(window.localStorage.getItem(ACCOUNT_NAME_STORAGE_KEY) ??  "");
  } catch {
    return "";
  }
}

function setAccountName(next: string): void {
  accountName = normalizeAccountName(next);
  try {
    if (accountName) window.localStorage.setItem(ACCOUNT_NAME_STORAGE_KEY, accountName);
    else window.localStorage.removeItem(ACCOUNT_NAME_STORAGE_KEY);
  } catch {
    /* ignore storage failures */
  }
}

function readTutorialAutoOpen(): boolean {
  try {
    const stored = window.localStorage.getItem(TUTORIAL_AUTO_OPEN_STORAGE_KEY);
    if (stored === "0") return false;
    if (stored === "1") return true;
  } catch {
    /* ignore storage failures */
  }
  return true;
}

function setTutorialAutoOpen(next: boolean): void {
  tutorialAutoOpen = next;
  try {
    window.localStorage.setItem(TUTORIAL_AUTO_OPEN_STORAGE_KEY, next ? "1" : "0");
  } catch {
    /* ignore storage failures */
  }
}

function readFeedbackEntries(): FeedbackEntry[] {
  try {
    const raw = window.localStorage.getItem(FEEDBACK_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((row): row is Record<string, unknown> => Boolean(row && typeof row === "object"))
      .map((row) => ({
        id: String(row.id ?? ""),
        createdAt: String(row.createdAt ?? ""),
        type: (row.type === "question" || row.type === "suggestion" ? row.type : "bug") as FeedbackEntry["type"],
        title: String(row.title ?? ""),
        details: String(row.details ?? ""),
        view: String(row.view ?? "Inbox"),
        simDate: String(row.simDate ?? ""),
        accountName: String(row.accountName ?? ""),
        uiLanguage: (row.uiLanguage === "zh-CN" ? "zh-CN" : "en") as FeedbackEntry["uiLanguage"],
      }))
      .filter((row) => row.id);
  } catch {
    return [];
  }
}

function writeFeedbackEntries(entries: FeedbackEntry[]): void {
  try {
    window.localStorage.setItem(FEEDBACK_STORAGE_KEY, JSON.stringify(entries.slice(-200)));
  } catch {
    /* ignore storage failures */
  }
}

function exportFeedbackEntries(entries: FeedbackEntry[]): void {
  const blob = new Blob([JSON.stringify(entries, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `idol-producer-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
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
  const roleUid = el.getAttribute("data-training-role");
  const roleKey = el.getAttribute("data-role-key");
  if (roleUid && roleKey) {
    return `[data-training-role="${cssAttr(roleUid)}"][data-role-key="${cssAttr(roleKey)}"]`;
  }
  const announcedLeaderUid = el.getAttribute("data-training-announced-leader");
  if (announcedLeaderUid) return `[data-training-announced-leader="${cssAttr(announcedLeaderUid)}"]`;
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
  return isoDatePart(save?.current_date ??  save?.game_start_date ??  save?.scenario_context?.startup_date ??  "2020-01-01");
}

function daysBetweenIso(fromIso: string, toIso: string): number | null {
  const from = Date.parse(`${isoDatePart(fromIso)}T12:00:00Z`);
  const to = Date.parse(`${isoDatePart(toIso)}T12:00:00Z`);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return null;
  return Math.floor((to - from) / 86400000);
}

function addYearsToIsoDate(iso: string, years: number): string {
  const datePart = isoDatePart(iso);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
  if (!match) return datePart;
  return `${String(Number(match[1]) + years).padStart(4, "0")}-${match[2]}-${match[3]}`;
}

function addDaysToIsoDate(iso: string, days: number): string {
  const datePart = isoDatePart(iso);
  const parsed = Date.parse(`${datePart}T12:00:00Z`);
  if (!Number.isFinite(parsed)) return datePart;
  return new Date(parsed + days * 86400000).toISOString().slice(0, 10);
}

function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function monthsBetweenIsoCeil(fromIso: string, toIso: string): number {
  const fromMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDatePart(fromIso));
  const toMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDatePart(toIso));
  if (!fromMatch || !toMatch) return 0;
  let months = (Number(toMatch[1]) - Number(fromMatch[1])) * 12 + (Number(toMatch[2]) - Number(fromMatch[2]));
  if (Number(toMatch[3]) > Number(fromMatch[3])) months += 1;
  return Math.max(0, months);
}

function managedIdolByUid(uid: string): Record<string, unknown> | null {
  if (!save) return null;
  return (
    save.database_snapshot.idols.find(
      (row) => String(row.uid ??  "") === uid,
    ) as Record<string, unknown> | undefined
  ) ??  null;
}

function activeScandalLevel(idol: Record<string, unknown>): number {
  const refIso = save?.current_date ??  save?.game_start_date ??  save?.scenario_context?.startup_date ??  currentIsoForNewLive();
  const refDate = isoDatePart(refIso);
  const history: Record<string, unknown>[] = [];
  if (Array.isArray(idol.status_history)) {
    for (const raw of idol.status_history) {
      if (raw && typeof raw === "object") history.push(raw as Record<string, unknown>);
    }
  }
  if (Array.isArray(idol.group_history)) {
    for (const raw of idol.group_history) {
      if (!raw || typeof raw !== "object") continue;
      const statuses = (raw as Record<string, unknown>).status_history;
      if (!Array.isArray(statuses)) continue;
      for (const s of statuses) {
        if (s && typeof s === "object") history.push(s as Record<string, unknown>);
      }
    }
  }
  let maxLevel = 0;
  for (const row of history) {
    if (String(row.kind ??  "").trim().toLowerCase() !== "scandal") continue;
    const start = String(row.start_date ??  "").split("T")[0];
    const end = String(row.end_date ??  "").split("T")[0];
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && start > refDate) continue;
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && end < refDate) continue;
    const score = Number(row.score ?? 0) || 0;
    if (score >= 5) maxLevel = Math.max(maxLevel, 3);
    else if (score >= 4) maxLevel = Math.max(maxLevel, 2);
    else if (score >= 1) maxLevel = Math.max(maxLevel, 1);
    const explicit = Number(row.level ??  row.severity ??  row.rank ??  0) || 0;
    if (explicit > maxLevel) maxLevel = explicit;
    const text = `${String(row.status ??  "")} ${String(row.summary ??  "")} ${String(row.title ??  "")}`.toLowerCase();
    if (/\blevel\s*3\b|\bmajor\b|\bsevere\b/.test(text)) maxLevel = Math.max(maxLevel, 3);
    else if (/\blevel\s*2\b|\bmoderate\b/.test(text)) maxLevel = Math.max(maxLevel, 2);
    else if (/\blevel\s*1\b|\bminor\b/.test(text)) maxLevel = Math.max(maxLevel, 1);
  }
  return maxLevel;
}

function contractRenewLikelihoodLabel(idol: Record<string, unknown>, currentSalary: number, proposedSalary: number, currentEndDate: string, proposedEndDate: string): string {
  const morale = Number(idol.morale ??  70) || 70;
  const raiseRatio = currentSalary > 0 ? proposedSalary / currentSalary : 1;
  const extensionMonths = monthsBetweenIsoCeil(currentEndDate, proposedEndDate);
  if (raiseRatio >= 1 && extensionMonths <= 12 && morale >= 45) return t(uiLang, "likelihood_highly_likely");
  if (raiseRatio >= 0.98 && extensionMonths <= 12 && morale >= 35) return t(uiLang, "likelihood_likely");
  if (raiseRatio >= 0.9 && extensionMonths <= 18) return t(uiLang, "likelihood_uncertain");
  return t(uiLang, "likelihood_unlikely");
}

function terminationFeeYen(idol: Record<string, unknown>, salaryYen: number, contractEndDate: string): { feeYen: number; scandalLevel: number } {
  const scandalLevel = activeScandalLevel(idol);
  if (scandalLevel >= 3) return { feeYen: 0, scandalLevel };
  const monthsRemaining = monthsBetweenIsoCeil(currentIsoForNewLive(), contractEndDate);
  const base = Math.max(salaryYen, salaryYen * monthsRemaining);
  const multiplier = scandalLevel >= 2 ? 0.15 : scandalLevel >= 1 ? 0.35 : 0.6;
  return {
    feeYen: Math.round(base * multiplier),
    scandalLevel,
  };
}

function removeIdolFromManagedGroup(idolUid: string): void {
  if (!save) return;
  const group = getPrimaryGroup(save);
  if (!group) return;
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  group.member_uids = memberUids.filter((uid) => uid !== idolUid);
  group.member_count = Array.isArray(group.member_uids) ? group.member_uids.length : 0;
  const idol = managedIdolByUid(idolUid);
  if (!idol) return;
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  const today = currentIsoForNewLive();
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const row = raw as Record<string, unknown>;
    if (String(row.group_uid ??  "") === String(group.uid ??  "")) {
      if (!row.end_date || String(row.end_date).split("T")[0] >= today) {
        row.end_date = today;
      }
    }
  }
}

function addIdolToManagedGroup(idolUid: string, startDateIso: string, endDateIso: string, salaryYen: number): void {
  if (!save) return;
  const group = getPrimaryGroup(save);
  const idol = managedIdolByUid(idolUid);
  if (!group || !idol) return;
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map((x) => String(x)) : [];
  if (!memberUids.includes(idolUid)) {
    memberUids.push(idolUid);
    group.member_uids = memberUids;
    group.member_count = memberUids.length;
  }
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  const existing = history.find(
    (raw) => raw && typeof raw === "object" && String((raw as Record<string, unknown>).group_uid ?? "") === String(group.uid ?? ""),
  ) as Record<string, unknown> | undefined;
  if (existing) {
    existing.start_date = startDateIso;
    existing.end_date = "";
  } else {
    history.push({
      group_uid: String(group.uid ?? ""),
      group_name: String(group.name ?? group.name_romanji ?? save.managing_group ?? ""),
      start_date: startDateIso,
      end_date: "",
    });
    idol.group_history = history;
  }
  idol.contract_salary_yen = salaryYen;
  idol.contract_start_date = startDateIso;
  idol.contract_end_date = endDateIso;
  noteCareerRecruitSigned(save, idolUid, startDateIso);
}

function shortlistSigningTerms(idol: Record<string, unknown>): { startDate: string; endDate: string; salaryYen: number } {
  if (!save) {
    const startDate = addDaysToIsoDate(currentIsoForNewLive(), 14);
    return { startDate, endDate: addYearsToIsoDate(startDate, 1), salaryYen: 0 };
  }
  const group = getPrimaryGroup(save);
  const baseSalary = monthlyBaseSalaryYenForGroupLetterTier(resolveGroupLetterTier(group));
  const popularity = Number(idol.popularity ?? 0) || 0;
  const xFollowers = Number(idol.x_followers ?? 0) || 0;
  const fanCount = Number(idol.fan_count ?? 0) || 0;
  const profile = popularity + Math.min(30, xFollowers / 4000) + Math.min(20, fanCount / 5000);
  const years = profile >= 85 ? 5 : profile >= 70 ? 4 : profile >= 55 ? 3 : profile >= 40 ? 2 : 1;
  const uid = String(idol.uid ?? idol.name ?? Math.random().toString(36));
  const daysOut = 7 + (stableHash(uid) % 78);
  const startDate = addDaysToIsoDate(currentIsoForNewLive(), daysOut);
  const endDate = addYearsToIsoDate(startDate, years);
  const multiplier = profile >= 85 ? 1.55 : profile >= 70 ? 1.35 : profile >= 55 ? 1.18 : profile >= 40 ? 1.0 : 0.88;
  const salaryYen = Math.round(baseSalary * multiplier);
  return { startDate, endDate, salaryYen };
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
    .map((item) => String(item.songTitle ??  item.label ??  "").trim())
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
  const preset = LIVE_TYPE_PRESETS[liveType] ??  LIVE_TYPE_PRESETS.Routine;
  const date = currentIsoForNewLive();
  const endTime = addMinutesToHHMM(preset.default_start_time, preset.default_duration);
  const suggestedCount = autoSetlistSongCountForLive(
    liveType,
    preset.default_duration,
    liveType === "Concert" ? 6 : liveType === "Taiban" ? 3 : 5,
  );
  const policy = save ? ensureGroupPolicy(save) : null;
  const tokutenkaiOn = policy ? policy.live.tokutenkai_enabled : preset.tokutenkai_enabled;
  const goodsOn = policy ? policy.live.goods_enabled : true;
  const tokutenkaiStart = tokutenkaiOn ? endTime : "";
  const tokutenkaiEnd = tokutenkaiOn ? addMinutesToHHMM(endTime, preset.tokutenkai_duration) : "";
  const managedUid = save?.managing_group_uid ??  "";
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
  const venue = getVenuesCatalog()[0]?.name ??  "";
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
    tokutenkaiEnabled: tokutenkaiOn,
    tokutenkaiStart,
    tokutenkaiEnd,
    tokutenkaiTicketPrice: preset.tokutenkai_ticket_price,
    tokutenkaiSlotSeconds: preset.tokutenkai_slot_seconds,
    tokutenkaiExpectedTickets: tokutenkaiOn ? preset.tokutenkai_expected_tickets : 0,
    goodsEnabled: goodsOn,
    goodsUids: goodsOn ? initialGoodsUids : [],
    ticketPriceYen: liveType === "Concert" ? 3800 : liveType === "Festival" ? 0 : 2500,
    vipTicketPriceYen: 0,
    vipCapacity: 0,
  };
  reconcileNewLiveGoodsSelection();
  selectedLiveSongTitle = suggestedSetlist[0] ??  null;
  selectedSetlistSongIndex = suggestedSetlist.length ? 0 : null;
}

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function selectedScheduledLiveRecord(): Record<string, unknown> | null {
  if (!save) return null;
  const schedules = (save.lives?.schedules ??  []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  if (!schedules.length) return null;
  if (scheduledLiveUid) {
    const matched = schedules.find((live) => String(live.uid ??  "") === scheduledLiveUid);
    if (matched) return matched;
  }
  return schedules[0] ??  null;
}

function normalizeLiveTypeForForm(value: unknown): NewLiveFormState["liveType"] {
  const raw = String(value ?? "").trim();
  return raw === "Concert" || raw === "Taiban" || raw === "Festival" ? raw : "Routine";
}

function programItemsFromLive(live: Record<string, unknown>): LiveProgramItem[] {
  const rawProgram = Array.isArray(live.program)
    ? (live.program as unknown[]).filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"))
    : [];
  if (rawProgram.length) {
    return rawProgram.map((item) => {
      const kind = item.kind === "mc" || item.kind === "break" ? item.kind : "song";
      const label = String(item.label ?? item.songTitle ?? (kind === "mc" ? "MC" : kind === "break" ? "Break" : "")).trim();
      return {
        id: String(item.id ?? newLiveProgramId(kind)),
        kind,
        label: label || (kind === "song" ? "Song" : kind === "mc" ? "MC" : "Break"),
        durationMinutes: Math.max(0, Number(item.durationMinutes ?? 0) || 0),
        songTitle: kind === "song" ? String(item.songTitle ?? label).trim() : undefined,
      };
    });
  }
  const setlist = Array.isArray(live.setlist)
    ? (live.setlist as unknown[]).map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];
  return setlist.map((title) => createSongProgramItem(title));
}

function loadScheduledLiveIntoArrangeForm(uid: string): boolean {
  if (!save) return false;
  scheduledLiveUid = uid;
  const live = selectedScheduledLiveRecord();
  if (!live) return false;
  const liveType = normalizeLiveTypeForForm(live.live_type ?? live.event_type);
  const program = programItemsFromLive(live);
  newLiveForm = {
    liveType,
    title: String(live.title ?? live.live_type ?? "Live"),
    date: String(live.start_date ?? live.date ?? currentIsoForNewLive()).split("T")[0],
    startTime: String(live.start_time ?? ""),
    endTime: String(live.end_time ?? ""),
    rehearsalStart: String(live.rehearsal_start ?? ""),
    rehearsalEnd: String(live.rehearsal_end ?? ""),
    venueName: String(live.venue ?? ""),
    program,
    setlist: songTitlesFromProgram(program),
    tokutenkaiEnabled: Boolean(live.tokutenkai_enabled),
    tokutenkaiStart: String(live.tokutenkai_start ?? ""),
    tokutenkaiEnd: String(live.tokutenkai_end ?? ""),
    tokutenkaiTicketPrice: Math.max(0, Number(live.tokutenkai_ticket_price ?? 0) || 0),
    tokutenkaiSlotSeconds: Math.max(0, Number(live.tokutenkai_slot_seconds ?? 0) || 0),
    tokutenkaiExpectedTickets: Math.max(0, Number(live.tokutenkai_expected_tickets ?? 0) || 0),
    goodsEnabled: Boolean(live.goods_enabled),
    goodsUids: Array.isArray(live.goods_uids)
      ? (live.goods_uids as unknown[]).map((item) => String(item)).filter(Boolean)
      : String(live.goods_uid ?? "").trim()
        ? [String(live.goods_uid ?? "").trim()]
        : [],
    ticketPriceYen: Math.max(0, Number(live.ticket_price ?? 0) || 0),
    vipTicketPriceYen: Math.max(0, Number(live.vip_ticket_price ?? 0) || 0),
    vipCapacity: Math.max(0, Number(live.vip_capacity ?? 0) || 0),
  };
  selectedLiveSongTitle = newLiveForm.setlist[0] ?? null;
  selectedSetlistSongIndex = newLiveForm.program.length ? 0 : null;
  return true;
}

function goodsInventory(): ProducedGoodsRow[] {
  return Array.isArray(save?.goods_inventory) ? save!.goods_inventory : [];
}

function availableGoodsInventory(): ProducedGoodsRow[] {
  return goodsInventory().filter((item) => Math.max(0, Number(item.stock ??  0) || 0) > 0);
}

function isBirthdayLiveTitle(title: string): boolean {
  return /生誕|birthday/i.test(String(title ??  ""));
}

function matchingBirthdayGoodsUid(title: string): string[] {
  if (!save || !isBirthdayLiveTitle(title)) return [];
  const managedUid = String(save.managing_group_uid ?? "").trim();
  const group = save.database_snapshot.groups.find(
    (row) => String((row as { uid?: unknown }).uid ?? "") === managedUid,
  ) as Record<string, unknown> | undefined;
  const memberUids = Array.isArray(group?.member_uids) ? group!.member_uids.map((x) => String(x)) : [];
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  for (const uid of memberUids) {
    const idol = idols.find((row) => String(row.uid ??  "") === uid);
    const name = String(idol?.name ??  "").trim();
    if (name && String(title).includes(name)) {
      const item = goodsInventory().find((row) => row.member_uid === uid && row.name === "Birthday T-shirt" && Math.max(0, Number(row.stock ??  0) || 0) > 0);
      return item ? [item.uid] : [];
    }
  }
  return [];
}

function defaultGoodsSelectionForLive(params: { title: string; liveType: string; date: string }): string[] {
  const regular = availableGoodsInventory()
    .filter((item) => String(item.name ??  "") !== "Birthday T-shirt")
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
  const key = String(uid ??  "").trim();
  if (!key) return null;
  return goodsInventory().find((item) => item.uid === key) ??  null;
}

function goodsDisplayLabel(item: ProducedGoodsRow | null | undefined): string {
  if (!item) return "";
  return item.member_name ? `${item.member_name} / ${item.name}` : item.name;
}

function goodsMatrixKey(item: ProducedGoodsRow | null | undefined): string {
  if (!item) return "";
  return `${String(item.category ??  "").trim()}|${String(item.name ??  "").trim()}`;
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
  const venue = getVenuesCatalog().find((row) => row.name === venueName) ??  null;
  const group = save
    ? sortGroupsForDirectory(save.database_snapshot.groups).find(
        (row) => String(row.uid ?? "") === String(save!.managing_group_uid ?? ""),
      ) ?? null
    : null;
  return goodsUids.reduce((sum, goodsUid) => {
    const goods = findGoodsByUid(goodsUid);
    return (
      sum +
      estimateLiveGoodsGrossYen(goods, {
        liveType,
        capacity: venue?.capacity ??  null,
        groupFans: Number(group?.fans ??  0) || 0,
        groupPopularity: Number(group?.popularity ??  0) || 0,
        groupTier: resolveGroupLetterTier(group),
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
    if (!rows[i]?.read) return rows[i]?.uid ??  null;
  }
  return null;
}

function notificationTimestampMs(row: { created_at?: string; date?: string }): number {
  const created = String(row.created_at ??  "").trim();
  if (created) {
    const parsed = Date.parse(`${created.endsWith("Z") ? created : `${created}Z`}`);
    if (Number.isFinite(parsed)) return parsed;
  }
  const day = String(row.date ??  "").split("T")[0].trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const parsed = Date.parse(`${day}T00:00:00Z`);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}

function newestVisibleLiveReportUid(currentSave: GameSavePayload): string | null {
  const currentMs = notificationTimestampMs({ created_at: String(currentSave.current_date ??  "") });
  const rows = [...currentSave.inbox.notifications];
  sortNotificationsInPlace(rows);
  for (const row of rows) {
    const title = String(row.title ??  "");
    if (!title.startsWith("Live report:") && !title.startsWith("Festival report:")) continue;
    if (notificationTimestampMs(row) > currentMs) continue;
    return row.uid;
  }
  return null;
}

function clearLiveModeTimers(): void {
  if (liveModeProgressTimer != null) {
    window.clearInterval(liveModeProgressTimer);
    liveModeProgressTimer = null;
  }
  if (liveModeBlockTimer != null) {
    window.clearTimeout(liveModeBlockTimer);
    liveModeBlockTimer = null;
  }
}

function stopLiveModeProgressLoop(): void {
  if (liveModeProgressTimer != null) {
    window.clearInterval(liveModeProgressTimer);
    liveModeProgressTimer = null;
  }
}

function syncLiveModeProgressUi(): void {
  if (!liveModeSession) return;
  const item = currentLiveModeItem(liveModeSession);
  if (!item) {
    updateLiveModeProgressDom(appRoot, 0, 1);
    updateLiveModeReactionDom(appRoot, liveModeReactionSnapshot(liveModeSession, uiLang, 0));
    return;
  }
  let current = liveModeSession.itemElapsedSec;
  let duration = liveModeItemDurationSec(liveModeSession);
  if (item.kind === "song" && item.hasPreview) {
    const media = getSongPreviewMediaTime();
    duration = liveModeItemDurationSec(liveModeSession, media?.duration ?? null);
    current = media?.currentTime ?? liveModeSession.itemElapsedSec;
  } else if (liveModeSession.transport === "playing" && liveModeSession.itemStartedAtMs != null) {
    current = liveModeSession.itemElapsedSec + (performance.now() - liveModeSession.itemStartedAtMs) / 1000;
  }
  updateLiveModeProgressDom(appRoot, current, duration);
  const progress01 = duration > 0 ? clamp01(current / duration) : 0;
  updateLiveModeReactionDom(appRoot, liveModeReactionSnapshot(liveModeSession, uiLang, progress01));
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function startLiveModeProgressLoop(): void {
  stopLiveModeProgressLoop();
  if (!liveModeSession || liveModeSession.transport !== "playing") return;
  liveModeProgressTimer = window.setInterval(() => {
    syncLiveModeProgressUi();
  }, 200);
}

function exitLiveModeSession(opts?: { stopAudio?: boolean }): void {
  clearLiveModeTimers();
  setSongPreviewEndedListener(null);
  if (opts?.stopAudio !== false) stopSongPreview();
  liveModeSession = null;
  formationEditorState = null;
  liveModeAdvanceLock = false;
}

function liveModeRosterMembers(): FormationEditorMember[] {
  if (!save || !liveModeSession) return [];
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const byUid = new Map(idols.map((row) => [String(row.uid ?? ""), row] as const));
  return liveModeSession.defaultMembers.map((m) => ({
    uid: m.uid,
    name: m.name,
    color: m.color,
    idol: byUid.get(m.uid),
  }));
}

function managedTrainingSongs(): Record<string, unknown>[] {
  if (!save) return [];
  const payload = save;
  const grp = getPrimaryGroup(payload);
  const groupUidStr = String(grp?.uid ?? "").trim();
  const ref =
    payload.current_date ?? payload.game_start_date ?? payload.scenario_context?.startup_date ?? null;
  const allSongs = payload.database_snapshot.songs;
  return songsForDisplaySorted(allSongs)
    .filter((row) => String(row.group_uid ?? "") === groupUidStr)
    .filter((row) => !isSongHiddenFromDisplay(row, allSongs))
    .filter((row) => isSongAvailableOn(row, ref));
}

function trainingFormationAllMembers(): FormationEditorMember[] {
  if (!save) return [];
  const grp = getPrimaryGroup(save);
  const memberUids = Array.isArray(grp?.member_uids)
    ? (grp!.member_uids as unknown[]).map((x) => String(x))
    : [];
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const byUid = new Map(idols.map((row) => [String(row.uid ?? ""), row] as const));
  const ref =
    save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null;
  const out: FormationEditorMember[] = [];
  for (const uid of memberUids) {
    const idol = byUid.get(uid);
    if (!idol) continue;
    const name = String(idol.name ?? idol.name_romanji ?? uid).trim() || uid;
    const rawColor = String(idol.color_code ?? idol.color ?? "").trim();
    const color = /^#[0-9a-fA-F]{3,8}$/.test(rawColor) ? rawColor : "#94a3b8";
    out.push({
      uid,
      name,
      color,
      idol,
      unavailable: isIdolUnavailableForStage(idol, ref),
    });
  }
  return out;
}

function syncTrainingFormationEditorState(): void {
  if (!save || browseMode || currentView !== "Training" || trainingTab !== "formation") {
    return;
  }
  if (liveModeSession) return;
  const songs = managedTrainingSongs();
  if (!trainingFormationSongUid || !songs.some((row) => String(row.uid ?? "") === trainingFormationSongUid)) {
    trainingFormationSongUid = songs.length ? String(songs[0]!.uid ?? "").trim() || null : null;
  }
  if (!trainingFormationSongUid) {
    if (!liveModeSession) formationEditorState = null;
    return;
  }
  if (formationEditorState?.songUid === trainingFormationSongUid) return;
  const song = songs.find((row) => String(row.uid ?? "") === trainingFormationSongUid) ?? null;
  const grp = getPrimaryGroup(save);
  const existing =
    resolveSongFormation({
      songUid: trainingFormationSongUid,
      catalog: formationCatalog,
      saveOverrides: save.managed_song_formations,
    }) ?? null;
  const allMembers = trainingFormationAllMembers();
  const familiarity = save.managed_song_status?.[trainingFormationSongUid]?.familiarity ?? null;
  formationEditorState = createFormationEditorState({
    songUid: trainingFormationSongUid,
    songTitle: song ? songCatalogDisplayLabel(song) : trainingFormationSongUid,
    groupUid: String(grp?.uid ?? "").trim() || null,
    asOfDate: save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null,
    members: allMembers.filter((m) => !m.unavailable),
    allMembers,
    formation: existing,
    familiarity,
  });
}

function openTrainingFormationForSong(songUid: string): void {
  const uid = songUid.trim();
  if (!uid || !save || browseMode) return;
  navigate(() => {
    currentView = "Training";
    trainingTab = "formation";
    trainingFormationSongUid = uid;
    if (!liveModeSession) {
      formationEditorState = null;
    }
  });
}

function persistFormationFromEditor(formation: SongStartingFormation): void {
  if (!save) return;
  if (!save.managed_song_formations) save.managed_song_formations = {};
  save.managed_song_formations[formation.songUid] = formation;
  const famChange = applyFormationChangeToSongFamiliarity(save.managed_song_status, formation.songUid, formation);
  if (liveModeSession) {
    applyLiveModeFormationForCurrentItem(liveModeSession, {
      catalog: formationCatalog,
      saveOverrides: save.managed_song_formations,
      idols: save.database_snapshot.idols as Record<string, unknown>[],
    });
  }
  if (formationEditorState?.songUid === formation.songUid) {
    formationEditorState = {
      ...formationEditorState,
      formation,
      familiarity: save.managed_song_status?.[formation.songUid]?.familiarity ?? formationEditorState.familiarity,
      statusMessage: famChange?.changed
        ? `Saved. Familiarity ${famChange.before} → ${famChange.after} (formation changed).`
        : formationEditorState.statusMessage || "Formation saved.",
    };
  }
  void saveToSlot(accountName, slot, save).catch(() => undefined);
}

function openLiveModeFormationEditor(): void {
  if (!save || !liveModeSession) return;
  const item = currentLiveModeItem(liveModeSession);
  const songUid = item?.kind === "song" ? String(item.songUid ?? "").trim() : "";
  if (!songUid) {
    return;
  }
  void pauseLiveModeItem();
  const existing =
    resolveSongFormation({
      songUid,
      catalog: formationCatalog,
      saveOverrides: save.managed_song_formations,
    }) ?? null;
  formationEditorState = createFormationEditorState({
    songUid,
    songTitle: item?.songTitle || item?.label || songUid,
    groupUid: liveModeSession.groupUid,
    asOfDate: liveModeSession.dateIso,
    members: liveModeRosterMembers(),
    formation: existing,
    familiarity: save.managed_song_status?.[songUid]?.familiarity ?? null,
  });
  paintGame();
}

function mountFormationEditorIfNeeded(): void {
  if (!formationEditorState) return;

  const bindCallbacks = {
    onChange: (next: FormationEditorState) => {
      formationEditorState = next;
      if (liveModeSession) {
        mountFormationEditorIfNeeded();
      } else {
        paintGame();
      }
    },
    onSave: (formation: SongStartingFormation) => {
      persistFormationFromEditor(formation);
      if (liveModeSession) {
        formationEditorState = null;
        paintGame();
        return;
      }
      if (formationEditorState) {
        formationEditorState = {
          ...formationEditorState,
          formation,
          statusMessage: uiLang === "zh-CN" ? "已保存站位" : "Formation saved",
        };
      }
      paintGame();
    },
    onClose: () => {
      formationEditorState = null;
      paintGame();
    },
  };

  if (liveModeSession) {
    const existing = appRoot.querySelector("[data-formation-overlay]");
    existing?.remove();
    const wrap = document.createElement("div");
    wrap.innerHTML = formationEditorOverlayHtml(formationEditorState, uiLang);
    const overlay = wrap.firstElementChild;
    if (!overlay) return;
    appRoot.appendChild(overlay);
    bindFormationEditor(overlay, formationEditorState, uiLang, bindCallbacks, { allowVideo: false });
    return;
  }

  if (currentView === "Training" && trainingTab === "formation") {
    const host = appRoot.querySelector("[data-formation-editor]");
    if (!host) return;
    bindFormationEditor(host, formationEditorState, uiLang, {
      onChange: bindCallbacks.onChange,
      onSave: bindCallbacks.onSave,
    }, { allowVideo: false });
  }
}

function refreshLiveModeFormation(): void {
  if (!liveModeSession || !save) return;
  applyLiveModeFormationForCurrentItem(liveModeSession, {
    catalog: formationCatalog,
    saveOverrides: save.managed_song_formations,
    idols: save.database_snapshot.idols as Record<string, unknown>[],
  });
}

async function playCurrentLiveModeItem(): Promise<void> {
  if (!liveModeSession) return;
  const item = currentLiveModeItem(liveModeSession);
  if (!item) return;
  clearLiveModeTimers();
  liveModeSession.itemElapsedSec = 0;
  liveModeSession.itemStartedAtMs = performance.now();
  liveModeSession.transport = "playing";
  unlockSongPreviewAudio();

  if (item.kind === "song" && item.hasPreview && item.preview) {
    const state = await playSongPreview(item.preview);
    if (!liveModeSession) return;
    if (state === "unavailable" || state === "idle") {
      // No audible preview — treat as a short silent beat then advance.
      liveModeSession.itemStartedAtMs = performance.now();
      const waitMs = Math.round(liveModeItemDurationSec(liveModeSession) * 1000);
      liveModeBlockTimer = window.setTimeout(() => {
        void advanceLiveModeItem();
      }, waitMs);
    }
  } else {
    const waitMs = Math.round(liveModeItemDurationSec(liveModeSession) * 1000);
    liveModeBlockTimer = window.setTimeout(() => {
      void advanceLiveModeItem();
    }, waitMs);
  }
  startLiveModeProgressLoop();
  paintGame();
}

async function pauseLiveModeItem(): Promise<void> {
  if (!liveModeSession || liveModeSession.transport !== "playing") return;
  if (liveModeSession.itemStartedAtMs != null) {
    liveModeSession.itemElapsedSec += (performance.now() - liveModeSession.itemStartedAtMs) / 1000;
    liveModeSession.itemStartedAtMs = null;
  }
  liveModeSession.transport = "paused";
  clearLiveModeTimers();
  const item = currentLiveModeItem(liveModeSession);
  if (item?.kind === "song" && item.hasPreview && item.preview) {
    await toggleSongPreview(item.preview);
  }
  paintGame();
}

async function resumeLiveModeItem(): Promise<void> {
  if (!liveModeSession || liveModeSession.transport !== "paused") return;
  const item = currentLiveModeItem(liveModeSession);
  if (!item) return;
  liveModeSession.transport = "playing";
  liveModeSession.itemStartedAtMs = performance.now();
  unlockSongPreviewAudio();
  if (item.kind === "song" && item.hasPreview && item.preview) {
    await toggleSongPreview(item.preview);
  } else {
    const remaining = Math.max(0.2, liveModeItemDurationSec(liveModeSession) - liveModeSession.itemElapsedSec);
    liveModeBlockTimer = window.setTimeout(() => {
      void advanceLiveModeItem();
    }, Math.round(remaining * 1000));
  }
  startLiveModeProgressLoop();
  paintGame();
}

async function advanceLiveModeItem(): Promise<void> {
  if (!liveModeSession || liveModeAdvanceLock) return;
  liveModeAdvanceLock = true;
  try {
    clearLiveModeTimers();
    stopSongPreview();
    if (liveModeSession.currentIndex >= liveModeSession.items.length - 1) {
      await finishLiveModeSession();
      return;
    }
    liveModeSession.currentIndex += 1;
    liveModeSession.itemElapsedSec = 0;
    liveModeSession.itemStartedAtMs = null;
    liveModeSession.transport = "idle";
    refreshLiveModeFormation();
    paintGame();
    await playCurrentLiveModeItem();
  } finally {
    liveModeAdvanceLock = false;
  }
}

async function finishLiveModeSession(): Promise<void> {
  if (!liveModeSession || !save) return;
  const uid = liveModeSession.notificationUid;
  clearLiveModeTimers();
  setSongPreviewEndedListener(null);
  stopSongPreview();
  liveModeSession = null;
  formationEditorState = null;
  runSimulationTask(() => {
    if (!save) return;
    attentionActionUid = null;
    save = acknowledgeInboxNotification(save, uid);
    currentView = "Inbox";
    inboxSelectedUid =
      newestVisibleLiveReportUid(save) ??
      save.inbox.notifications.find((row) => !notificationRequiresAck(row) || !row.read)?.uid ??
      save.inbox.notifications[0]?.uid ??
      null;
  });
}

function enterLiveModeFromInbox(notificationUid: string): void {
  if (!save) return;
  const dateIso = isoDatePart(save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "");
  const open = () => {
    if (!save) return;
    const session = buildLiveModeSession({
      save,
      notificationUid,
      dateIso,
      formationCatalog,
    });
    if (!session) {
      runSimulationTask(() => {
        if (!save) return;
        attentionActionUid = null;
        save = acknowledgeInboxNotification(save, notificationUid);
        currentView = "Inbox";
        inboxSelectedUid =
          newestVisibleLiveReportUid(save) ??
          save.inbox.notifications.find((row) => !notificationRequiresAck(row) || !row.read)?.uid ??
          save.inbox.notifications[0]?.uid ??
          null;
      });
      return;
    }
    liveModeSession = session;
    setSongPreviewEndedListener(() => {
      void advanceLiveModeItem();
    });
    paintGame();
    void playCurrentLiveModeItem();
  };
  if (formationCatalog) open();
  else {
    void loadSongFormationCatalog().then((cat) => {
      formationCatalog = cat;
      open();
    });
  }
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
let uiLang: UiLanguage = readUiLanguage();
let accountName = readAccountName();
let openingScreen: OpeningScreen = "login";
let selectedNewGameGroupUid: string | null = null;
let openingStatus = "";
let simulationBusy = false;
let attentionActionUid: string | null = null;
let tutorialAutoOpen = readTutorialAutoOpen();
let tutorialOverlayOpen = false;
let tutorialStepIndex = 0;
let selectedWikiKey: string | null = defaultWikiEntryKey(uiLang);
let feedbackEntries: FeedbackEntry[] = readFeedbackEntries();
let feedbackStatusMessage: string | null = null;
let wikiModalOpen = false;
let feedbackModalOpen = false;

let currentView: DesktopNavId = "Inbox";
let idolDetailUid: string | null = null;
let groupDetailUid: string | null = null;
/** Songs view: selected `group_uid` from snapshot (browse or save). */
let songsGroupUid: string | null = null;
/** Songs view: `group_songs` = track list, `disc` = discography (desktop `main_ui.py`). */
let songsWorkspaceTab: SongsWorkspaceTab = "group_songs";
let makingTab: MakingTab = "songs";
let selectedCdProjectUid: string | null = null;
/** Selected release bucket in Discography tab; invalid keys cleared in `ensureSongsDiscographyKey`. */
let songsDiscographyKey: string | null = null;
/** Selected song for Songs detail panel (from track list or discography link). */
let songsDetailUid: string | null = null;

/** Inbox message selection (management mode). */
let inboxSelectedUid: string | null = null;
/** Schedule: visible month (`YYYY-MM-01`); null = month of next simulation day. */
let scheduleCalendarMonthStart: string | null = null;
/** Schedule: selected day used to drive the week strip; null = current week of next simulation day. */
let scheduleWeekAnchorIso: string | null = null;
let scheduleTab: ScheduleTab = "calendar";
let livesTab: LivesTab = "new";
let leaguePanelTab: LeaguePanelTab = "current";
let scheduledLiveUid: string | null = null;
/** Immersive live performance overlay session (null = normal shell). */
let liveModeSession: LiveModeSession | null = null;
let liveModeProgressTimer: number | null = null;
let liveModeBlockTimer: number | null = null;
let liveModeAdvanceLock = false;
let formationCatalog: SongFormationCatalog | null = null;
let formationEditorState: FormationEditorState | null = null;

function tutorialStepCount(): number {
  return tutorialSteps(uiLang).length;
}

function shouldShowTutorialOverlay(): boolean {
  return Boolean(save && !browseMode && tutorialOverlayOpen);
}

function openTutorialOverlay(stepIndex = 0): void {
  if (!save || browseMode) return;
  tutorialStepIndex = Math.max(0, Math.min(stepIndex, tutorialStepCount() - 1));
  tutorialOverlayOpen = true;
}

function closeTutorialOverlay(markCompleted = true): void {
  tutorialOverlayOpen = false;
  if (save && markCompleted) {
    save.tutorial.completed = true;
  }
}
let scoutTab: ScoutTab = "freelancer";
let trainingTab: TrainingTab = "roster";
let trainingFormationSongUid: string | null = null;
let trainingRosterSortKey: TrainingRosterSortKey = "started";
let trainingRosterSortDir: "asc" | "desc" = "asc";
let trainingRoleBenchmarkPreferences: RoleBenchmarkKey[] = ["singing", "dancing", "teamwork", "content", "streaming", "fashion"];
let mediaTab: MediaTab = "tv";
let financeTab: FinanceTab = "finance";
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
  vipTicketPriceYen: 0,
  vipCapacity: 0,
};

interface NavigationSnapshot {
  browseMode: boolean;
  currentView: DesktopNavId;
  idolDetailUid: string | null;
  groupDetailUid: string | null;
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
  scoutTab: ScoutTab;
  trainingTab: TrainingTab;
  trainingFormationSongUid: string | null;
  trainingRosterSortKey: TrainingRosterSortKey;
  trainingRosterSortDir: "asc" | "desc";
  roleBenchmarkPreferences: RoleBenchmarkKey[];
  mediaTab: MediaTab;
  financeTab: FinanceTab;
  financeHistoryRange: FinanceHistoryRange;
  selectedScoutLeadUid: string | null;
  selectedScoutApplicantUid: string | null;
  scheduleCalendarMonthStart: string | null;
  scheduleWeekAnchorIso: string | null;
  scheduleTab: ScheduleTab;
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
    songsDetailUid,
    makingTab,
    selectedCdProjectUid,
    inboxSelectedUid,
    livesTab,
    leaguePanelTab,
    scheduledLiveUid,
    scoutTab,
    trainingTab,
    trainingFormationSongUid,
    trainingRosterSortKey,
    trainingRosterSortDir,
    roleBenchmarkPreferences: trainingRoleBenchmarkPreferences,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    scheduleWeekAnchorIso,
    scheduleTab,
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
    a.songsDetailUid === b.songsDetailUid &&
    a.makingTab === b.makingTab &&
    a.selectedCdProjectUid === b.selectedCdProjectUid &&
    a.inboxSelectedUid === b.inboxSelectedUid &&
    a.livesTab === b.livesTab &&
    a.leaguePanelTab === b.leaguePanelTab &&
    a.scheduledLiveUid === b.scheduledLiveUid &&
    a.scoutTab === b.scoutTab &&
    a.trainingTab === b.trainingTab &&
    a.trainingFormationSongUid === b.trainingFormationSongUid &&
    a.trainingRosterSortKey === b.trainingRosterSortKey &&
    a.trainingRosterSortDir === b.trainingRosterSortDir &&
    a.roleBenchmarkPreferences.join("|") === b.roleBenchmarkPreferences.join("|") &&
    a.mediaTab === b.mediaTab &&
    a.financeTab === b.financeTab &&
    a.financeHistoryRange === b.financeHistoryRange &&
    a.selectedScoutLeadUid === b.selectedScoutLeadUid &&
    a.selectedScoutApplicantUid === b.selectedScoutApplicantUid &&
    a.scheduleCalendarMonthStart === b.scheduleCalendarMonthStart &&
    a.scheduleWeekAnchorIso === b.scheduleWeekAnchorIso &&
    a.scheduleTab === b.scheduleTab
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
  songsDetailUid = snapshot.songsDetailUid;
  makingTab = snapshot.makingTab;
  selectedCdProjectUid = snapshot.selectedCdProjectUid;
  inboxSelectedUid = snapshot.inboxSelectedUid;
  {
    const restored = String(snapshot.livesTab ?? "new");
    livesTab =
      restored === "new" ||
      restored === "scheduled" ||
      restored === "past" ||
      restored === "festival" ||
      restored === "league"
        ? restored
        : "scheduled";
  }
  leaguePanelTab = snapshot.leaguePanelTab ?? "current";
  scheduledLiveUid = snapshot.scheduledLiveUid;
  scoutTab = snapshot.scoutTab;
  trainingTab = snapshot.trainingTab;
  trainingFormationSongUid = snapshot.trainingFormationSongUid;
  trainingRosterSortKey = snapshot.trainingRosterSortKey;
  trainingRosterSortDir = snapshot.trainingRosterSortDir;
  trainingRoleBenchmarkPreferences = [...snapshot.roleBenchmarkPreferences];
  mediaTab = snapshot.mediaTab;
  financeTab = snapshot.financeTab;
  financeHistoryRange = snapshot.financeHistoryRange;
  selectedScoutLeadUid = snapshot.selectedScoutLeadUid;
  selectedScoutApplicantUid = snapshot.selectedScoutApplicantUid;
  scheduleCalendarMonthStart = snapshot.scheduleCalendarMonthStart;
  scheduleWeekAnchorIso = snapshot.scheduleWeekAnchorIso;
  {
    const restored = String(snapshot.scheduleTab ?? "calendar");
    scheduleTab = restored === "policy" ? "policy" : "calendar";
  }
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
  const validUids = new Set(listed.map((g) => String((g as { uid?: unknown }).uid ??  "").trim()).filter(Boolean));
  if (songsGroupUid && validUids.has(songsGroupUid)) return;
  const mg = save?.managing_group_uid?.trim();
  if (mg && validUids.has(mg)) {
    songsGroupUid = mg;
    return;
  }
  const sorted = sortGroupsForDirectory(listed);
  const first = sorted[0];
  songsGroupUid = String((first as { uid?: unknown }).uid ??  "").trim() || null;
}

function songsListForDiscographyCheck(): Record<string, unknown>[] | null {
  if (browseMode && loadedScenario?.songs) return loadedScenario.songs;
  if (save?.database_snapshot?.songs) return save.database_snapshot.songs;
  return null;
}

/** Prefer live catalog (with preview URLs), then save snapshot. */
function findSongRowByUid(uid: string): Record<string, unknown> | null {
  const needle = uid.trim();
  if (!needle) return null;
  const pools: Array<Record<string, unknown>[] | null | undefined> = [
    loadedScenario?.songs,
    save?.database_snapshot?.songs,
  ];
  for (const pool of pools) {
    if (!pool?.length) continue;
    const hit = pool.find((row) => String(row.uid ?? "").trim() === needle);
    if (hit) return hit;
  }
  return null;
}

function managedIdolHistoryEntryForRoleEdit(idol: Record<string, unknown>): Record<string, unknown> | null {
  if (!save) return null;
  const group = getPrimaryGroup(save);
  const groupUid = String(group?.uid ?? "").trim();
  const groupNames = new Set(
    [String(group?.name ?? "").trim(), String(group?.name_romanji ?? "").trim()].filter(Boolean),
  );
  const ref = isoDatePart(save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "");
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  const matches = history
    .filter((raw): raw is Record<string, unknown> => Boolean(raw && typeof raw === "object"))
    .filter((entry) => {
      const uid = String(entry.group_uid ?? "").trim();
      const name = String(entry.group_name ?? "").trim();
      return uid === groupUid || (name && groupNames.has(name));
    });
  const active = matches.find((entry) => {
    const start = String(entry.start_date ?? "").split("T")[0];
    const end = String(entry.end_date ?? "").split("T")[0];
    if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && ref && start > ref) return false;
    if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && ref && end <= ref) return false;
    return true;
  });
  return active ?? matches[0] ?? null;
}

function refreshRoleGeneratedAttributes(idol: Record<string, unknown>): void {
  if (!save) return;
  delete idol.attributes;
  const ref = isoDatePart(save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "");
  applyAttributesToAllIdols(
    [idol],
    save.database_snapshot.groups,
    ref || undefined,
    loadedScenario?.role_attribute_model as Parameters<typeof applyAttributesToAllIdols>[3],
  );
}

function setManagedMemberRoleFocus(idolUid: string, roleKey: string, scaleValue: number): void {
  if (!save) return;
  const idol = save.database_snapshot.idols.find((row) => String((row as { uid?: unknown }).uid ?? "") === idolUid) as
    | Record<string, unknown>
    | undefined;
  if (!idol) return;
  const entry = managedIdolHistoryEntryForRoleEdit(idol);
  if (!entry) return;
  const roleMap: Record<string, number> = {};
  for (const role of roleAssignmentsFromHistoryEntry(entry)) {
    if (role.key) roleMap[role.key] = Math.max(0, Math.min(1, Number(role.focus) || 0));
  }
  const scale = Math.max(0, Math.min(5, Math.round(scaleValue)));
  if (scale > 0) roleMap[roleKey] = scale / 5;
  else delete roleMap[roleKey];
  if (Object.keys(roleMap).length) entry.roles = roleMap;
  else delete entry.roles;
  refreshRoleGeneratedAttributes(idol);
}

function setManagedMemberAnnouncedLeader(idolUid: string, checked: boolean): void {
  if (!save) return;
  const idol = save.database_snapshot.idols.find((row) => String((row as { uid?: unknown }).uid ?? "") === idolUid) as
    | Record<string, unknown>
    | undefined;
  if (!idol) return;
  const entry = managedIdolHistoryEntryForRoleEdit(idol);
  if (!entry) return;
  if (checked) entry.announced_leader = true;
  else delete entry.announced_leader;
}

const ROLE_BENCHMARK_KEYS: RoleBenchmarkKey[] = ["singing", "dancing", "teamwork", "content", "streaming", "fashion"];

function roleBenchmarkPreferencesFromSave(currentSave: GameSavePayload): RoleBenchmarkKey[] {
  const raw = Array.isArray(currentSave.training_role_benchmark_preferences)
    ? currentSave.training_role_benchmark_preferences
    : ROLE_BENCHMARK_KEYS;
  const set = new Set(raw.map((item) => String(item)));
  return ROLE_BENCHMARK_KEYS.filter((key) => set.has(key));
}

function writeRoleBenchmarkPreferencesToSave(currentSave: GameSavePayload, preferences: RoleBenchmarkKey[]): void {
  currentSave.training_role_benchmark_preferences = ROLE_BENCHMARK_KEYS.filter((key) => preferences.includes(key));
}

const AUTO_ROLE_PLANS: Array<{
  role: string;
  slots: number[];
  weights: Partial<Record<RoleBenchmarkKey, number>>;
}> = [
  { role: "leader", slots: [5, 3, 1], weights: { teamwork: 1 } },
  { role: "center", slots: [5, 3], weights: { singing: 0.45, dancing: 0.45, fashion: 0.1 } },
  { role: "lead_singer", slots: [5, 4, 2], weights: { singing: 1 } },
  { role: "lead_dancer", slots: [5, 4, 2], weights: { dancing: 1 } },
  { role: "host", slots: [5, 3, 2], weights: { teamwork: 0.35, content: 0.3, streaming: 0.35 } },
  { role: "content", slots: [5, 3, 2], weights: { content: 0.75, fashion: 0.25 } },
  { role: "streaming", slots: [5, 3, 2], weights: { streaming: 0.85, teamwork: 0.15 } },
  { role: "style", slots: [5, 3, 2], weights: { fashion: 1 } },
  { role: "call_leader", slots: [5, 3], weights: { teamwork: 0.55, dancing: 0.25, streaming: 0.2 } },
];

function roleBenchmarkStatScore(idol: Record<string, unknown>, key: RoleBenchmarkKey): number {
  const a = normalizePersistedAttributes(idol.attributes);
  const avg = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  switch (key) {
    case "singing":
      return avg([a.technical.pitch, a.technical.tone, a.technical.breath, a.technical.power]);
    case "dancing":
      return avg([a.technical.rhythm, a.technical.grace, a.physical.agility, a.physical.stamina]);
    case "teamwork":
      return avg([a.mental.teamwork, a.mental.determination, a.hidden?.professionalism ?? 12]);
    case "content":
      return avg([a.mental.talking, a.mental.humor, a.mental.clever]);
    case "streaming":
      return avg([a.mental.talking, a.mental.humor, a.mental.teamwork]);
    case "fashion":
      return avg([a.mental.fashion, a.appearance.cute, a.appearance.pretty]);
    default:
      return 0;
  }
}

function benchmarkPreferenceWeight(key: RoleBenchmarkKey, preferences: RoleBenchmarkKey[]): number {
  if (!preferences.length) return 1;
  return preferences.includes(key) ? 2.4 : 0.65;
}

function autoAssignManagedRoles(preferences: RoleBenchmarkKey[]): void {
  if (!save) return;
  const group = getPrimaryGroup(save);
  const memberUids = Array.isArray(group?.member_uids)
    ? (group!.member_uids as unknown[]).map((uid) => String(uid))
    : [...save.shortlist];
  const members = memberUids
    .map((uid) => {
      const idol = save?.database_snapshot.idols.find((row) => String((row as { uid?: unknown }).uid ?? "") === uid) as
        | Record<string, unknown>
        | undefined;
      if (!idol) return null;
      const entry = managedIdolHistoryEntryForRoleEdit(idol);
      if (!entry) return null;
      return { uid, idol, entry, assignedCount: 0, roles: {} as Record<string, number> };
    })
    .filter((row): row is NonNullable<typeof row> => Boolean(row));
  if (!members.length) return;

  for (const plan of AUTO_ROLE_PLANS) {
    const ranked = members
      .map((member) => {
        const rawScore = ROLE_BENCHMARK_KEYS.reduce((sum, key) => {
          const roleNeed = Number(plan.weights[key] ?? 0);
          if (roleNeed <= 0) return sum;
          return sum + roleBenchmarkStatScore(member.idol, key) * roleNeed * benchmarkPreferenceWeight(key, preferences);
        }, 0);
        return {
          member,
          score: rawScore - member.assignedCount * 1.15,
        };
      })
      .sort((a, b) => b.score - a.score || a.member.uid.localeCompare(b.member.uid));
    plan.slots.forEach((scale, index) => {
      const pick = ranked[index]?.member;
      if (!pick) return;
      pick.roles[plan.role] = Math.max(0, Math.min(1, scale / 5));
      pick.assignedCount += 1;
    });
  }

  for (const member of members) {
    if (Object.keys(member.roles).length) member.entry.roles = member.roles;
    else delete member.entry.roles;
    delete member.idol.attributes;
  }
  const ref = isoDatePart(save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? "");
  applyAttributesToAllIdols(
    members.map((member) => member.idol),
    save.database_snapshot.groups,
    ref || undefined,
    loadedScenario?.role_attribute_model as Parameters<typeof applyAttributesToAllIdols>[3],
  );
}

/** Stable song-preview click binding (not recreated each paintGame). */
function bindSongPreviewControlsOnce(): void {
  const handle = (ev: Event) => {
    const t = ev.target as HTMLElement | null;
    if (!t) return;
    const songPreviewBtn = t.closest<HTMLElement>("[data-song-preview-action]");
    if (!songPreviewBtn) return;
    // Unlock Web Audio as early as possible in the gesture.
    if (ev.type === "pointerdown" && songPreviewBtn.getAttribute("data-song-preview-action") === "play") {
      unlockSongPreviewAudio();
      return;
    }
    if (ev.type !== "click") return;
    if (currentView !== "Songs" && currentView !== "Making") return;
    ev.preventDefault();
    ev.stopPropagation();
    const action = songPreviewBtn.getAttribute("data-song-preview-action");
    const controls = songPreviewBtn.closest<HTMLElement>(".song-preview-controls");
    if (action === "stop") {
      stopSongPreview();
      return;
    }
    if (action === "play" && controls) {
      const fromDom = previewInputFromControlsEl(controls);
      const row = findSongRowByUid(String(fromDom.uid ?? ""));
      const input = mergePreviewInput(fromDom, row);
      void toggleSongPreview(input);
    }
  };
  appRoot.addEventListener("pointerdown", handle, true);
  appRoot.addEventListener("click", handle, true);
}

bindSongPreviewControlsOnce();

/** Drop stale discography selection when bucket keys change (group / data). */
function ensureSongsDiscographyKey(): void {
  const songs = songsListForDiscographyCheck();
  const gid = songsGroupUid?.trim();
  const groups = groupsForSongsPicker();
  if (!songs?.length || !gid) {
    songsDiscographyKey = null;
    return;
  }
  const groupRow = groups?.find((row) => String((row as { uid?: unknown }).uid ?? "").trim() === gid) ?? null;
  const groupDiscographyRows = buildGroupDiscographyReleaseRows(
    groupRow,
    browseMode
      ? loadedScenario?.preset?.opening_date ?? null
      : save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? null,
    (browseMode
      ? (loadedScenario?.shared_releases ?? [])
      : (save?.database_snapshot.shared_releases ?? [])) as unknown as Record<string, unknown>[],
    songs,
  );
  if (groupDiscographyRows.length) {
    if (songsDiscographyKey && !groupDiscographyRows.some((row) => row.key === songsDiscographyKey)) {
      songsDiscographyKey = null;
    }
    return;
  }
  const team = songsForDisplaySorted(songs).filter((row) => String(row.group_uid ??  "") === gid);
  const buckets = buildDiscBuckets(team);
  if (songsDiscographyKey && !buckets.some((b) => b.key === songsDiscographyKey)) {
    songsDiscographyKey = null;
  }
}

function cdProjectTitleForKind(kind: CdReleaseProject["release_kind"], count: number): string {
  return kind === "album" ? `New album ${count}` : `New single ${count}`;
}

function ensureSelectedCdProjectUid(): void {
  const projects = Array.isArray(save?.cd_projects) ? save!.cd_projects : [];
  if (!projects.length) {
    selectedCdProjectUid = null;
    return;
  }
  if (selectedCdProjectUid && projects.some((row) => row.uid === selectedCdProjectUid)) return;
  selectedCdProjectUid = projects[0]?.uid ?? null;
}

function createCdProject(kind: CdReleaseProject["release_kind"]): void {
  if (!save) return;
  const nextCount = (save.cd_projects?.length ?? 0) + 1;
  const project: CdReleaseProject = {
    uid: `cd-project-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: cdProjectTitleForKind(kind, nextCount),
    release_kind: kind,
    song_uids: [],
    released_digital_song_uids: [],
  };
  if (!Array.isArray(save.cd_projects)) save.cd_projects = [];
  save.cd_projects.unshift(project);
  selectedCdProjectUid = project.uid;
}

function selectedCdProject(): CdReleaseProject | null {
  if (!save || !Array.isArray(save.cd_projects)) return null;
  return save.cd_projects.find((row) => row.uid === selectedCdProjectUid) ?? save.cd_projects[0] ?? null;
}

function syncFestivalLivesIfPossible(): void {
  if (!save || !loadedScenario?.festivals?.length) return;
  const festivals = normalizeFestivalCatalog(loadedScenario.festivals);
  syncManagedTif2025Lives(save, festivals);
}

function paintOpening(): void {
  tutorialOverlayOpen = false;
  const focus = captureFocus(appRoot);
  const preset = loadedScenario?.preset ??  null;
  const dbReady = loadedScenario != null;
  appRoot.innerHTML =
    openingScreen === "login"
      ? renderOpeningLogin(dbReady, openingStatus, accountName, uiLang, preset)
      : openingScreen === "home"
        ? renderOpeningHome(
            preset,
            dbReady,
            openingStatus,
            save != null && !browseMode,
            slot,
            listOccupiedSlots(accountName),
            listSlotSummaries(accountName),
            uiLang,
          )
      : loadedScenario
        ? renderNewGameScreen(
            buildNewGameRows(loadedScenario),
            accountName,
            loadedScenario.preset,
            uiLang,
          )
        : `<p class="fm-error" role="alert">${htmlEsc(t(uiLang, "opening_no_scenario_loaded"))}</p>`;
  restoreFocus(appRoot, focus);

  if (openingScreen === "login") {
    const accountInput = document.getElementById("account-name") as HTMLInputElement | null;
    const loginBtn = document.getElementById("opening-login") as HTMLButtonElement | null;
    const syncLoginEnabled = () => {
      if (loginBtn) loginBtn.disabled = !(loadedScenario != null && accountName.trim());
    };
    accountInput?.addEventListener("input", (ev) => {
      setAccountName((ev.target as HTMLInputElement).value);
      // Update button state in-place — do not re-render (breaks IME / caret).
      syncLoginEnabled();
    });

    document.getElementById("lang-select-opening")?.addEventListener("change", (ev) => {
      const value = (ev.target as HTMLSelectElement).value;
      if (!isUiLanguage(value)) return;
      setUiLanguage(value);
      paintOpening();
    });

    document.getElementById("opening-login")?.addEventListener("click", () => {
      if (!accountName.trim()) return;
      openingScreen = "home";
      paintOpening();
    });
  } else if (openingScreen === "home") {
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

    document.getElementById("opening-new-game")?.addEventListener("click", async () => {
      if (!loadedScenario) return;
      openingStatus = t(uiLang, "opening_db_loading");
      paintOpening();
      try {
        loadedScenario = await loadDefaultScenario();
      } catch (e) {
        console.error("opening-new-game reload failed", e);
      }
      openingScreen = "new_game";
      selectedNewGameGroupUid = null;
      paintOpening();
    });
    document.getElementById("opening-load-slot")?.addEventListener("click", async () => {
      if (!accountName) return;
      const loaded = await loadFromSlot(accountName, slot);
      if (loaded && assertHydratedSave(loaded)) {
        save = loaded;
        if (!save.tutorial) save.tutorial = { completed: true, disabled: false };
        setAccountName(String(save.account_name ??  save.player_name ??  accountName));
        save.account_name = accountName;
        save.player_name = accountName;
        ensureAutoBookedLivesThroughEndOfNextMonth(save);
        maybeSeedMonthEndAutoBookPrompt(save);
        scheduleCalendarMonthStart = null;
        resetNewLiveFormDefaults();
        if (loadedScenario) {
          hydrateSnapshotGroupsFromScenario(save, loadedScenario.groups, loadedScenario.preset.data_subdir);
          hydrateSnapshotSongsFromScenario(save, loadedScenario.songs, loadedScenario.preset.data_subdir);
          syncFestivalLivesIfPossible();
        }
        browseMode = false;
        tutorialOverlayOpen = false;
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
      tutorialOverlayOpen = false;
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

    nameInput?.addEventListener("input", (ev) => {
      setAccountName((ev.target as HTMLInputElement).value);
      if (startBtn) startBtn.disabled = !selectedNewGameGroupUid || !accountName.trim();
    });

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
        if (startBtn) startBtn.disabled = !selectedNewGameGroupUid || !accountName.trim();
      });
    });

    document.getElementById("new-game-back")?.addEventListener("click", () => {
      openingScreen = "home";
      selectedNewGameGroupUid = null;
      paintOpening();
    });

    document.getElementById("new-game-start")?.addEventListener("click", () => {
      if (!loadedScenario || !selectedNewGameGroupUid || !nameInput || !accountName.trim()) return;
      const row = rows.find((r) => r.uid === selectedNewGameGroupUid);
      const label =
        row?.nameRomanji && row.nameRomanji !== "—" && row.nameRomanji.trim()
          ? row.nameRomanji
          : (row?.name ??  "");
      try {
        save = createNewGameSaveFromScenario(loadedScenario, {
          playerName: accountName,
          managedGroupLabel: label,
          managedGroupUid: selectedNewGameGroupUid,
        });
        hydrateSnapshotGroupsFromScenario(save, loadedScenario.groups, loadedScenario.preset.data_subdir);
        hydrateSnapshotSongsFromScenario(save, loadedScenario.songs, loadedScenario.preset.data_subdir);
        save.tutorial = {
          completed: false,
          disabled: !tutorialAutoOpen,
        };
        save.account_name = accountName;
        save.player_name = accountName;
        ensureAutoBookedLivesThroughEndOfNextMonth(save);
        maybeSeedMonthEndAutoBookPrompt(save);
        scheduleCalendarMonthStart = null;
        resetNewLiveFormDefaults();
        syncFestivalLivesIfPossible();
        browseMode = false;
        tutorialStepIndex = 0;
        tutorialOverlayOpen = tutorialAutoOpen;
        openingScreen = "home";
        selectedNewGameGroupUid = null;
        currentView = "Inbox";
        idolDetailUid = null;
        groupDetailUid = null;
        openingStatus = t(uiLang, "opening_new_production_started");
        resetNavigationHistory();
        paintGame();
      } catch (e) {
        console.error("new-game-start failed", e);
        window.alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
}

function paintGame(): void {
  const focus = captureFocus(appRoot);
  coerceNavForMode();
  selectedWikiKey = normalizeWikiSelection(uiLang, currentView, browseMode, selectedWikiKey);

  if (browseMode) {
    if (!loadedScenario) {
      appRoot.innerHTML = `<p class="fm-error" role="alert">${htmlEsc(t(uiLang, "shell_browse_requires_data"))}</p>`;
      return;
    }
  } else if (!save) {
    appRoot.innerHTML = `<p class="fm-error" role="alert">${htmlEsc(t(uiLang, "shell_no_save_loaded"))}</p>`;
    return;
  }

  ensureSongsGroupUid();
  ensureSongsDiscographyKey();
  if (!browseMode && save) {
    trainingRoleBenchmarkPreferences = roleBenchmarkPreferencesFromSave(save);
    writeRoleBenchmarkPreferencesToSave(save, trainingRoleBenchmarkPreferences);
  }
  if (!browseMode) syncFestivalLivesIfPossible();
  if (!browseMode && save && currentView === "Making") {
    const m = save.managing_group_uid?.trim();
    if (m) songsGroupUid = m;
    ensureSelectedCdProjectUid();
  }

  syncTrainingFormationEditorState();
  const formationEditorHtml =
    !browseMode &&
    save &&
    currentView === "Training" &&
    trainingTab === "formation" &&
    formationEditorState &&
    !liveModeSession
      ? renderFormationEditor(formationEditorState, uiLang, { showClose: false, allowVideo: false })
      : "";

  if (!browseMode && save && currentView === "Inbox" && save.inbox.notifications.length) {
    sortNotificationsInPlace(save.inbox.notifications);
    const rows = save.inbox.notifications;
    if (!inboxSelectedUid || !rows.some((r) => r.uid === inboxSelectedUid)) {
      inboxSelectedUid = rows[rows.length - 1]?.uid ??  null;
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
    roleBenchmarkPreferences: trainingRoleBenchmarkPreferences,
    trainingFormationSongUid,
    formationEditorHtml,
    mediaTab,
    financeTab,
    financeHistoryRange,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    scheduleWeekAnchorIso,
    scheduleTab,
    attentionActionUid,
    canGoBack: backHistory.length > 0,
    canGoForward: forwardHistory.length > 0,
    simulationBusy,
    slot,
    occupiedSlots: listOccupiedSlots(accountName),
    slotSummaries: listSlotSummaries(accountName),
    tutorialOverlayHtml: shouldShowTutorialOverlay()
      ? renderTutorialOverlay({
          lang: uiLang,
          stepIndex: tutorialStepIndex,
          autoOpenEnabled: tutorialAutoOpen,
        })
      : "",
    selectedWikiKey,
    feedbackEntries,
    feedbackStatusMessage,
    wikiModalOpen,
    feedbackModalOpen,
    liveModeSession,
  });
  restoreFocus(appRoot, focus);
  syncSongPreviewUi(appRoot);
  if (liveModeSession && save) {
    hydrateLiveModePortraits(appRoot, save);
    syncLiveModeProgressUi();
    if (liveModeSession.transport === "playing") startLiveModeProgressLoop();
  }
  mountFormationEditorIfNeeded();
  if (currentView === "Songs" || currentView === "Making") {
    prefetchSongPreviewsInRoot(appRoot);
  }

  wirePortraitFallbacks(appRoot);
  const mainContent = document.getElementById("main-content");
  if (mainContent && !liveModeSession) annotateWikiTerms(mainContent, uiLang, relatedWikiKeysForView(currentView, browseMode));

  if (save && !browseMode) {
    const nextBtn = document.getElementById("btn-next-day") as HTMLButtonElement | null;
    const nextBtnLabel = document.getElementById("btn-next-day-label");
    if (nextBtn) {
      const hasTodayEvents = hasPendingEventsToday(save);
      if (nextBtnLabel) nextBtnLabel.textContent = hasTodayEvents ? t(uiLang, "shell_next") : t(uiLang, "shell_next_day");
      nextBtn.title = hasTodayEvents
        ? t(uiLang, "shell_next_event_today")
        : t(uiLang, "shell_next_day_morning");
    }
  }

  document.getElementById("lang-select-shell")?.addEventListener("change", (ev) => {
    const value = (ev.target as HTMLSelectElement).value;
    if (!isUiLanguage(value)) return;
    setUiLanguage(value);
    paintGame();
  });
  document.getElementById("btn-open-tutorial")?.addEventListener("click", () => {
    if (!save || browseMode) return;
    openTutorialOverlay(0);
    paintGame();
  });
  appRoot.querySelectorAll<HTMLElement>("[data-open-wiki-modal]").forEach((elt) => {
    elt.addEventListener("click", () => {
      wikiModalOpen = true;
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-open-feedback-modal]").forEach((elt) => {
    elt.addEventListener("click", () => {
      feedbackModalOpen = true;
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-wiki-modal-close]").forEach((elt) => {
    elt.addEventListener("click", () => {
      wikiModalOpen = false;
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-feedback-modal-close]").forEach((elt) => {
    elt.addEventListener("click", () => {
      feedbackModalOpen = false;
      paintGame();
    });
  });
  document.getElementById("btn-feedback-save")?.addEventListener("click", () => {
    const typeEl = document.getElementById("feedback-type");
    const titleEl = document.getElementById("feedback-title");
    const detailsEl = document.getElementById("feedback-details");
    if (!(typeEl instanceof HTMLSelectElement) || !(titleEl instanceof HTMLInputElement) || !(detailsEl instanceof HTMLTextAreaElement)) {
      return;
    }
    const type = typeEl.value === "question" || typeEl.value === "suggestion" ? typeEl.value : "bug";
    const title = titleEl.value.trim();
    const details = detailsEl.value.trim();
    if (!title && !details) {
      feedbackStatusMessage = t(uiLang, "feedback_missing_details");
      paintGame();
      return;
    }
    const simDate =
      isoDatePart(save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? "") || "";
    feedbackEntries = [
      ...feedbackEntries,
      {
        id: `feedback-${Date.now().toString(36)}`,
        createdAt: new Date().toISOString(),
        type,
        title,
        details,
        view: currentView,
        simDate,
        accountName,
        uiLanguage: uiLang,
      },
    ];
    writeFeedbackEntries(feedbackEntries);
    feedbackStatusMessage = t(uiLang, "feedback_saved_status");
    feedbackModalOpen = true;
    paintGame();
  });
  document.getElementById("btn-feedback-export")?.addEventListener("click", () => {
    exportFeedbackEntries(feedbackEntries);
    feedbackStatusMessage = t(uiLang, "feedback_exported_status");
    feedbackModalOpen = true;
    paintGame();
  });
  document.getElementById("tutorial-auto-open-toggle")?.addEventListener("change", (ev) => {
    const checked = (ev.target as HTMLInputElement).checked;
    setTutorialAutoOpen(checked);
    if (save) save.tutorial.disabled = !checked;
  });
  appRoot.querySelectorAll<HTMLElement>("[data-tutorial-close]").forEach((elt) => {
    elt.addEventListener("click", () => {
      closeTutorialOverlay(true);
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-tutorial-back]").forEach((elt) => {
    elt.addEventListener("click", () => {
      tutorialStepIndex = Math.max(0, tutorialStepIndex - 1);
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-tutorial-next]").forEach((elt) => {
    elt.addEventListener("click", () => {
      const lastStepIndex = tutorialStepCount() - 1;
      if (tutorialStepIndex >= lastStepIndex) {
        closeTutorialOverlay(true);
      } else {
        tutorialStepIndex = Math.min(lastStepIndex, tutorialStepIndex + 1);
      }
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-tutorial-nav]").forEach((elt) => {
    elt.addEventListener("click", () => {
      const nav = elt.getAttribute("data-tutorial-nav");
      if (!nav || !isDesktopNavId(nav) || browseMode) return;
      currentView = nav;
      paintGame();
    });
  });
  appRoot.querySelectorAll<HTMLElement>("[data-wiki-term]").forEach((elt) => {
    elt.addEventListener("click", () => {
      const key = elt.getAttribute("data-wiki-term");
      if (!key) return;
      selectedWikiKey = key;
      paintGame();
    });
  });

  document.getElementById("main-content")?.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
    const calNav = t.closest<HTMLElement>("[data-sched-cal-delta]");
    if (calNav && save && !browseMode && currentView === "Schedule") {
      const root = appRoot.querySelector("[data-sched-cal-root]");
      const curMonth = root?.getAttribute("data-sched-cal-root") ??  "2000-01-01";
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
      scheduleWeekAnchorIso = null;
      paintGame();
      return;
    }
    const scheduleTabPick = t.closest<HTMLElement>("[data-schedule-tab]");
    if (scheduleTabPick && save && !browseMode && currentView === "Schedule") {
      const tab = scheduleTabPick.getAttribute("data-schedule-tab");
      if (tab === "calendar" || tab === "policy") {
        navigate(() => {
          scheduleTab = tab;
        });
      }
      return;
    }
    const policyPrerecordAll = t.closest<HTMLElement>("[data-policy-prerecord-all]");
    if (policyPrerecordAll && save && !browseMode && currentView === "Schedule") {
      const mode = policyPrerecordAll.getAttribute("data-policy-prerecord-all");
      const policy = ensureGroupPolicy(save);
      const grp = getPrimaryGroup(save);
      const memberUids = Array.isArray(grp?.member_uids) ? grp!.member_uids.map((x) => String(x)) : [];
      const next: Record<string, boolean> = { ...policy.live.prerecorded_vocals_by_member };
      for (const uid of memberUids) {
        if (mode === "on") next[uid] = true;
        else delete next[uid];
      }
      policy.live.prerecorded_vocals_by_member = next;
      paintGame();
      return;
    }
    const policyTrainingApply = t.closest<HTMLElement>("[data-policy-training-apply-all]");
    if (policyTrainingApply && save && !browseMode && currentView === "Schedule") {
      const policy = ensureGroupPolicy(save);
      const grp = getPrimaryGroup(save);
      const memberUids = Array.isArray(grp?.member_uids) ? grp!.member_uids.map((x) => String(x)) : [];
      for (const uid of memberUids) {
        save.training_intensity[uid] = { ...policy.training.default_intensity };
        save.training_focus_skill[uid] = policy.training.default_focus;
      }
      paintGame();
      return;
    }
    const liveOpenBtn = t.closest<HTMLElement>("[data-live-open-uid]");
    if (liveOpenBtn && save && !browseMode) {
      const uid = liveOpenBtn.getAttribute("data-live-open-uid");
      if (uid) {
        navigate(() => {
          currentView = "Lives";
          livesTab = "new";
          loadScheduledLiveIntoArrangeForm(uid);
        });
      }
      return;
    }
    const livesTabPick = t.closest<HTMLElement>("[data-lives-tab]");
    if (livesTabPick && save && !browseMode && currentView === "Lives") {
      const tab = livesTabPick.getAttribute("data-lives-tab");
      if (tab === "new" || tab === "scheduled" || tab === "past" || tab === "festival" || tab === "league") {
        navigate(() => {
          livesTab = tab;
          if (tab === "new") {
            scheduledLiveUid = null;
            resetNewLiveFormDefaults(newLiveForm.liveType);
          }
        });
      }
      return;
    }
    const leaguePanelPick = t.closest<HTMLElement>("[data-league-panel-tab]");
    if (leaguePanelPick && save && !browseMode && currentView === "Lives" && livesTab === "league") {
      const tab = leaguePanelPick.getAttribute("data-league-panel-tab");
      if (tab === "current" || tab === "history") {
        navigate(() => {
          leaguePanelTab = tab;
        });
      }
      return;
    }
    const scheduledPick = t.closest<HTMLElement>("[data-scheduled-live]");
    if (scheduledPick && save && !browseMode && currentView === "Lives") {
      navigate(() => {
        scheduledLiveUid = scheduledPick.getAttribute("data-scheduled-live");
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
      const raw = addSongBtn.getAttribute("data-live-add-song") ??  "";
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
      const token = String(addTemplateBtn.getAttribute("data-live-add-template") ??  "");
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
      const venue = getVenuesCatalog().find((row) => row.name === newLiveForm.venueName) ??  null;
      const goodsUids = [...newLiveForm.goodsUids];
      const goodsNames = goodsUids.map((uid) => goodsDisplayLabel(findGoodsByUid(uid))).filter(Boolean);
      const goodsGross = estimateCurrentLiveGoodsGross(newLiveForm.liveType, newLiveForm.venueName, goodsUids);
      const editingLive = scheduledLiveUid ? selectedScheduledLiveRecord() : null;
      if (editingLive) {
        editingLive.title = newLiveForm.title.trim() || `${save.managing_group ??  "Managed group"} ${newLiveForm.liveType}`;
        editingLive.event_type = LIVE_TYPE_PRESETS[newLiveForm.liveType].event_type;
        editingLive.live_type = newLiveForm.liveType;
        editingLive.start_date = newLiveForm.date;
        editingLive.end_date = newLiveForm.date;
        editingLive.start_time = newLiveForm.startTime;
        editingLive.end_time = newLiveForm.endTime;
        editingLive.rehearsal_start = newLiveForm.rehearsalStart;
        editingLive.rehearsal_end = newLiveForm.rehearsalEnd;
        editingLive.venue = newLiveForm.venueName || null;
        editingLive.venue_uid = venue?.uid ?? null;
        editingLive.location = venue?.location ?? "";
        editingLive.capacity = venue?.capacity ?? null;
        editingLive.ticket_price = newLiveForm.ticketPriceYen;
        editingLive.vip_ticket_price = newLiveForm.vipTicketPriceYen;
        editingLive.vip_capacity = newLiveForm.vipCapacity;
        editingLive.setlist = [...newLiveForm.setlist];
        editingLive.program = newLiveForm.program.map((item) => ({ ...item }));
        editingLive.tokutenkai_enabled = newLiveForm.tokutenkaiEnabled;
        editingLive.tokutenkai_start = newLiveForm.tokutenkaiStart;
        editingLive.tokutenkai_end = newLiveForm.tokutenkaiEnd;
        editingLive.tokutenkai_ticket_price = newLiveForm.tokutenkaiTicketPrice;
        editingLive.tokutenkai_slot_seconds = newLiveForm.tokutenkaiSlotSeconds;
        editingLive.tokutenkai_expected_tickets = newLiveForm.tokutenkaiExpectedTickets;
        editingLive.goods_enabled = newLiveForm.goodsEnabled;
        editingLive.goods_uids = goodsUids;
        editingLive.goods_uid = goodsUids[0] ?? "";
        editingLive.goods_line = goodsNames.join(", ");
        editingLive.goods_expected_revenue_yen = goodsGross;
        paintGame();
        return;
      }
      const reservation = reservationFeeForNewLive(venue?.capacity ??  null, newLiveForm.date);
      if (reservation.blocked) {
        addNotification(save, {
          title: `Live scheduling blocked: ${newLiveForm.title.trim() || `${save.managing_group ??  "Managed group"} ${newLiveForm.liveType}`}`,
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
      const currentCash = Math.max(0, Number(finances.cash_yen ??  0) || 0);
      if (reservation.reservationFeeYen > currentCash) {
        addNotification(save, {
          title: `Live scheduling blocked: ${newLiveForm.title.trim() || `${save.managing_group ??  "Managed group"} ${newLiveForm.liveType}`}`,
          body: `Need ?? ${reservation.reservationFeeYen.toLocaleString("ja-JP")} for the venue reservation fee, but current cash is ?? ${currentCash.toLocaleString("ja-JP")}.`,
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
      const uid = `manual-live-${Date.now().toString(36)}`;
      const live = {
        uid,
        title: newLiveForm.title.trim() || `${save.managing_group ??  "Managed group"} ${newLiveForm.liveType}`,
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
        venue_uid: venue?.uid ??  null,
        location: venue?.location ??  "",
        description: `Managed ${newLiveForm.liveType.toLowerCase()} for ${save.managing_group ??  "managed group"}.`,
        performance_count: 1,
        capacity: venue?.capacity ??  null,
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
        goods_uid: goodsUids[0] ??  "",
        goods_line: goodsNames.join(", "),
        goods_expected_revenue_yen: goodsGross,
        group: [save.managing_group ??  ""].filter(Boolean),
        group_uid: save.managing_group_uid ??  "",
        status: "scheduled",
      };
      finances.cash_yen = currentCash - reservation.reservationFeeYen;
      save.lives.schedules.push(live);
      addNotification(save, {
        title: `Live scheduled: ${live.title}`,
        body: `${live.start_date} ${live.start_time}-${live.end_time} · ${live.venue ??  "TBA"} · ${newLiveForm.setlist.length} song(s) · tokutenkai ${newLiveForm.tokutenkaiEnabled ? "on" : "off"} · goods ${newLiveForm.goodsEnabled ? "on" : "off"} · venue reservation fee ?? ${reservation.reservationFeeYen.toLocaleString("ja-JP")} (${Math.round(reservation.reservationRate * 100)}% of ?? ${reservation.baseVenueFeeYen.toLocaleString("ja-JP")}).`,
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
        save.lives.schedules = save.lives.schedules.filter((row) => String((row as { uid?: unknown }).uid ??  "") !== uid);
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
      if (
        tab === "assignments" ||
        tab === "roster" ||
        tab === "roles" ||
        tab === "songs" ||
        tab === "formation"
      ) {
        navigate(() => {
          if (trainingTab === "formation" && tab !== "formation" && !liveModeSession) {
            formationEditorState = null;
          }
          trainingTab = tab;
        });
      }
      return;
    }
    const trainingFormationSongPick = t.closest<HTMLElement>("[data-training-formation-song]");
    if (trainingFormationSongPick && save && !browseMode && currentView === "Training") {
      const uid = trainingFormationSongPick.getAttribute("data-training-formation-song");
      if (uid) {
        navigate(() => {
          trainingTab = "formation";
          trainingFormationSongUid = uid;
          if (!liveModeSession) formationEditorState = null;
        });
      }
      return;
    }
    const openTrainingFormation = t.closest<HTMLElement>("[data-open-training-formation]");
    if (openTrainingFormation && save && !browseMode) {
      const uid = openTrainingFormation.getAttribute("data-open-training-formation");
      if (uid) openTrainingFormationForSong(uid);
      return;
    }
    const autoAssignRolesBtn = t.closest<HTMLElement>("[data-training-roles-autoassign]");
    if (autoAssignRolesBtn && save && !browseMode && currentView === "Training") {
      autoAssignManagedRoles(trainingRoleBenchmarkPreferences);
      paintGame();
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
    const mediaTabPick = t.closest<HTMLElement>("[data-media-tab]");
    if (mediaTabPick && save && !browseMode && currentView === "Media") {
      const tab = mediaTabPick.getAttribute("data-media-tab");
      if (tab === "tv" || tab === "live_events" || tab === "radio" || tab === "books" || tab === "online") {
        navigate(() => {
          mediaTab = tab;
        });
      }
      return;
    }
    const financeTabPick = t.closest<HTMLElement>("[data-finance-tab]");
    if (financeTabPick && save && !browseMode && currentView === "Finances") {
      const tab = financeTabPick.getAttribute("data-finance-tab");
      if (tab === "finance" || tab === "contract") {
        navigate(() => {
          financeTab = tab;
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
    const contractRenewBtn = t.closest<HTMLElement>("[data-contract-renew]");
    if (contractRenewBtn && save && !browseMode && currentView === "Finances") {
      const uid = String(contractRenewBtn.getAttribute("data-contract-renew") ??  "").trim();
      const idol = managedIdolByUid(uid);
      if (idol) {
        const name = String(idol.name ??  uid);
        const currentSalary = Number(idol.contract_salary_yen ??  0) || 0;
        const currentEndDate = String(idol.contract_end_date ??  currentIsoForNewLive()).split("T")[0];
        const proposedSalary = currentSalary;
        const proposedEndDate = addYearsToIsoDate(currentEndDate, 1);
        const likelihood = contractRenewLikelihoodLabel(idol, currentSalary, proposedSalary, currentEndDate, proposedEndDate);
        const created = addNotification(save, {
          title: `Contract renewal review: ${name}`,
          body: `Review the renewal terms for ${name}. Update the salary and end date, then propose the renewal when the outlook is acceptable.`,
          sender: "Management",
          category: "confirmation",
          level: "high",
          isoDate: currentIsoForNewLive(),
          unread: true,
          requiresConfirmation: true,
          relatedEventUid: uid,
          reportData: {
            kind: "contract_renew_review",
            idol_uid: uid,
            current_salary_yen: currentSalary,
            proposed_salary_yen: proposedSalary,
            current_end_date: currentEndDate,
            proposed_end_date: proposedEndDate,
            likelihood,
          },
        });
        currentView = "Inbox";
        inboxSelectedUid = created.uid;
        paintGame();
      }
      return;
    }
    const contractTerminateBtn = t.closest<HTMLElement>("[data-contract-terminate]");
    if (contractTerminateBtn && save && !browseMode && currentView === "Finances") {
      const uid = String(contractTerminateBtn.getAttribute("data-contract-terminate") ??  "").trim();
      const idol = managedIdolByUid(uid);
      if (idol) {
        const name = String(idol.name ??  uid);
        const salary = Number(idol.contract_salary_yen ??  0) || 0;
        const contractEndDate = String(idol.contract_end_date ??  currentIsoForNewLive()).split("T")[0];
        const fee = terminationFeeYen(idol, salary, contractEndDate);
        const created = addNotification(save, {
          title: `Termination review: ${name}`,
          body: fee.feeYen <= 0
            ? `${name} can be terminated without fee because the active scandal severity is level ${fee.scandalLevel}.`
            : `Review the termination fee and confirm if you want to release ${name} from the group.`,
          sender: "Management",
          category: "confirmation",
          level: "high",
          isoDate: currentIsoForNewLive(),
          unread: true,
          requiresConfirmation: true,
          relatedEventUid: uid,
          reportData: {
            kind: "contract_terminate_review",
            idol_uid: uid,
            salary_yen: salary,
            contract_end_date: contractEndDate,
            scandal_level: fee.scandalLevel,
            termination_fee_yen: fee.feeYen,
          },
        });
        currentView = "Inbox";
        inboxSelectedUid = created.uid;
        paintGame();
      }
      return;
    }
    const contractCancelBtn = t.closest<HTMLElement>("[data-contract-cancel]");
    if (contractCancelBtn && save && !browseMode && currentView === "Inbox") {
      const uid = String(contractCancelBtn.getAttribute("data-contract-cancel") ??  "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      if (row) {
        row.requires_confirmation = false;
        row.read = true;
        row.choice_status = "cancelled";
        paintGame();
      }
      return;
    }
    const contractProposeBtn = t.closest<HTMLElement>("[data-contract-propose-renew]");
    if (contractProposeBtn && save && !browseMode && currentView === "Inbox") {
      const uid = String(contractProposeBtn.getAttribute("data-contract-propose-renew") ??  "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      const report = row?.report_data && typeof row.report_data === "object" ? (row.report_data as Record<string, unknown>) : null;
      const idol = report ? managedIdolByUid(String(report.idol_uid ??  "")) : null;
      if (row && report && idol) {
        const name = String(idol.name ??  report.idol_uid ??  "Idol");
        const currentSalary = Number(report.current_salary_yen ??  0) || 0;
        const proposedSalary = Number(report.proposed_salary_yen ??  currentSalary) || currentSalary;
        const currentEndDate = String(report.current_end_date ??  currentIsoForNewLive()).split("T")[0];
        const proposedEndDate = String(report.proposed_end_date ??  currentEndDate).split("T")[0];
        const likelihood = contractRenewLikelihoodLabel(idol, currentSalary, proposedSalary, currentEndDate, proposedEndDate);
        report.likelihood = likelihood;
        if (likelihood === "Highly likely to agree") {
          row.requires_confirmation = false;
          row.read = true;
          row.choice_status = "processed";
          const created = addNotification(save, {
            title: `Contract renewal confirmation: ${name}`,
            body: `New salary: ?? ${proposedSalary.toLocaleString("ja-JP")}\nNew end date: ${proposedEndDate}\nConfirm the new contract to finalize it.`,
            sender: "Management",
            category: "confirmation",
            level: "high",
            isoDate: currentIsoForNewLive(),
            unread: true,
            requiresConfirmation: true,
            relatedEventUid: String(report.idol_uid ??  ""),
            reportData: {
              kind: "contract_renew_confirm",
              idol_uid: String(report.idol_uid ??  ""),
              proposed_salary_yen: proposedSalary,
              proposed_end_date: proposedEndDate,
            },
          });
          inboxSelectedUid = created.uid;
        } else {
          addNotification(save, {
            title: `Renewal outlook updated: ${name}`,
            body: `Current likelihood is "${likelihood}". Adjust the proposed salary or end date before sending this renewal forward.`,
            sender: "Assistant",
            category: "guidance",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
          });
        }
        paintGame();
      }
      return;
    }
    const contractConfirmRenewBtn = t.closest<HTMLElement>("[data-contract-confirm-renew]");
    if (contractConfirmRenewBtn && save && !browseMode && currentView === "Inbox") {
      const uid = String(contractConfirmRenewBtn.getAttribute("data-contract-confirm-renew") ??  "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      const report = row?.report_data && typeof row.report_data === "object" ? (row.report_data as Record<string, unknown>) : null;
      const idol = report ? managedIdolByUid(String(report.idol_uid ??  "")) : null;
      if (row && report && idol) {
        idol.contract_salary_yen = Number(report.proposed_salary_yen ??  idol.contract_salary_yen ??  0) || 0;
        idol.contract_end_date = String(report.proposed_end_date ??  idol.contract_end_date ??  currentIsoForNewLive()).split("T")[0];
        row.requires_confirmation = false;
        row.read = true;
        row.choice_status = "completed";
        addNotification(save, {
          title: `Contract renewed: ${String(idol.name ??  report.idol_uid ??  "Idol")}`,
          body: `New monthly salary is ?? ${Number(idol.contract_salary_yen ??  0).toLocaleString("ja-JP")} through ${String(idol.contract_end_date ??  "-")}.`,
          sender: "Management",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
        });
        paintGame();
      }
      return;
    }
    const contractConfirmTerminateBtn = t.closest<HTMLElement>("[data-contract-confirm-terminate]");
    if (contractConfirmTerminateBtn && save && !browseMode && currentView === "Inbox") {
      const uid = String(contractConfirmTerminateBtn.getAttribute("data-contract-confirm-terminate") ??  "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      const report = row?.report_data && typeof row.report_data === "object" ? (row.report_data as Record<string, unknown>) : null;
      const idolUid = String(report?.idol_uid ??  "").trim();
      const idol = idolUid ? managedIdolByUid(idolUid) : null;
      if (row && report && idol) {
        const feeYen = Number(report.termination_fee_yen ??  0) || 0;
        const finances = save.finances as Record<string, unknown>;
        const currentCash = Math.max(0, Number(finances.cash_yen ??  0) || 0);
        if (feeYen > currentCash) {
          addNotification(save, {
            title: `Termination blocked: ${String(idol.name ??  idolUid)}`,
            body: `Need ?? ${feeYen.toLocaleString("ja-JP")} to terminate this contract, but current cash is only ?? ${currentCash.toLocaleString("ja-JP")}.`,
            sender: "Management",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
          });
          paintGame();
          return;
        }
        finances.cash_yen = currentCash - feeYen;
        removeIdolFromManagedGroup(idolUid);
        row.requires_confirmation = false;
        row.read = true;
        row.choice_status = "completed";
        addNotification(save, {
          title: `Contract terminated: ${String(idol.name ??  idolUid)}`,
          body: feeYen > 0
            ? `Termination completed with a fee of ?? ${feeYen.toLocaleString("ja-JP")}.`
            : `Termination completed without fee.`,
          sender: "Management",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
        });
        paintGame();
      }
      return;
    }
    const shortlistConfirmSignBtn = t.closest<HTMLElement>("[data-shortlist-confirm-sign]");
    if (shortlistConfirmSignBtn && save && !browseMode && currentView === "Inbox") {
      const uid = String(shortlistConfirmSignBtn.getAttribute("data-shortlist-confirm-sign") ?? "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      const report = row?.report_data && typeof row.report_data === "object" ? (row.report_data as Record<string, unknown>) : null;
      const idolUid = String(report?.idol_uid ?? "").trim();
      if (row && report && idolUid) {
        addIdolToManagedGroup(
          idolUid,
          String(report.start_date ?? currentIsoForNewLive()).split("T")[0],
          String(report.end_date ?? addYearsToIsoDate(currentIsoForNewLive(), 1)).split("T")[0],
          Number(report.salary_yen ?? 0) || 0,
        );
        save.shortlist = save.shortlist.filter((entry) => entry !== idolUid);
        row.requires_confirmation = false;
        row.read = true;
        row.choice_status = "completed";
        const careerId = noteCareerRecruitSigned(save, idolUid, currentIsoForNewLive());
        addNotification(save, {
          title: `Signing completed: ${String(report.idol_name ?? idolUid)}`,
          body:
            `Contract starts ${String(report.start_date ?? "-")} and runs through ${String(report.end_date ?? "-")} at JPY ${Number(report.salary_yen ?? 0).toLocaleString("ja-JP")} per month.` +
            (careerId ? `\nCareer window resolved (${careerId}): historical destination join suppressed.` : ""),
          sender: "Management",
          category: "internal",
          level: "normal",
          isoDate: currentIsoForNewLive(),
          unread: true,
        });
        paintGame();
      }
      return;
    }
    const notificationChoiceBtn = t.closest<HTMLElement>("[data-notification-choice]");
    if (notificationChoiceBtn && save && !browseMode && currentView === "Inbox") {
      const uid = String(notificationChoiceBtn.getAttribute("data-notification-uid") ?? "").trim();
      const value = String(notificationChoiceBtn.getAttribute("data-notification-choice") ?? "").trim();
      if (uid && value && resolveNotificationChoice(save, uid, value, currentIsoForNewLive())) {
        paintGame();
      }
      return;
    }
    const scoutCompanyPick = t.closest<HTMLElement>("[data-scout-company]");
    if (scoutCompanyPick && save && !browseMode && currentView === "Scout") {
      const uid = scoutCompanyPick.getAttribute("data-scout-company");
      if (uid) {
        navigate(() => {
          if (!save) return;
          save.scout.selected_company_uid = uid;
          selectedScoutLeadUid = null;
          selectedScoutApplicantUid = null;
        });
      }
      return;
    }
    const scoutSubscribeBtn = t.closest<HTMLElement>("[data-scout-subscribe]");
    if (scoutSubscribeBtn && save && !browseMode && currentView === "Scout") {
      const uid = scoutSubscribeBtn.getAttribute("data-scout-subscribe");
      const company = buildDefaultScoutCompanies().find((row) => row.uid === uid);
      if (uid && company && !save.scout.subscriptions[uid]) {
        const finances = getActiveFinances(save);
        const currentCash = Math.max(0, Number(finances.cash_yen ??  0) || 0);
        const fee = Math.max(0, Number(company.service_fee_yen ??  0) || 0);
        if (currentCash < fee) {
          addNotification(save, {
            title: `Scout subscription blocked: ${company.name}`,
            body: `You need ¥${fee.toLocaleString("ja-JP")} cash to activate this monthly scout retainer.`,
            sender: "Scout",
            category: "internal",
            level: "high",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `scout-subscribe-blocked|${uid}|${currentIsoForNewLive()}`,
          });
        } else {
          finances.cash_yen = currentCash - fee;
          save.scout.subscriptions[uid] = {
            company_uid: uid,
            subscribed_at: currentIsoForNewLive().split("T")[0],
          };
          selectedScoutLeadUid = null;
          selectedScoutApplicantUid = null;
          const managedGroupName = String(getPrimaryGroup(save)?.name ??  save.managing_group ??  "");
          const targetType = scoutTab === "transfer" ? "transfer" : "freelancer";
          const firstLead =
            recommendScoutLeads({
              idols: save.database_snapshot.idols,
              managedGroupName,
              company,
              targetType,
              currentIso: currentIsoForNewLive(),
              limit: 1,
              companies: buildDefaultScoutCompanies(),
            })[0] ?? 
            (targetType === "freelancer"
              ? recommendScoutLeads({
                  idols: save.database_snapshot.idols,
                  managedGroupName,
                  company,
                  targetType,
                  currentIso: currentIsoForNewLive(),
                  limit: 1,
                })[0] ??  null
              : null);
          const created = addNotification(save, {
            title: `Scout subscription active: ${company.name}`,
            body: `${company.name} is now on retainer for ¥${fee.toLocaleString("ja-JP")} per month. 1 lead is available immediately, and 1 more will surface each month.`,
            sender: "Scout",
            category: "internal",
            level: "normal",
            isoDate: currentIsoForNewLive(),
            unread: true,
            dedupeKey: `scout-subscribe|${uid}|${currentIsoForNewLive()}`,
            reportData: {
              kind: "scout_subscription",
              company_uid: company.uid,
              company_name: company.name,
              service_fee_yen: fee,
              first_lead_uid: firstLead?.idol_uid ??  "",
              first_lead_profile_score: firstLead?.profile_score ??  null,
              first_lead_reason: firstLead?.reason ??  "",
            },
          });
          currentView = "Inbox";
          inboxSelectedUid = created.uid;
        }
      }
      paintGame();
      return;
    }
    const shortlistLeadBtn = t.closest<HTMLElement>("[data-scout-shortlist]");
    if (shortlistLeadBtn && save && !browseMode && currentView === "Scout") {
      const uid = shortlistLeadBtn.getAttribute("data-scout-shortlist");
      if (uid && !save.shortlist.includes(uid)) {
        save.shortlist.push(uid);
      }
      paintGame();
      return;
    }
    const shortlistSignBtn = t.closest<HTMLElement>("[data-shortlist-sign]");
    if (shortlistSignBtn && save && !browseMode) {
      const uid = String(shortlistSignBtn.getAttribute("data-shortlist-sign") ?? "").trim();
      const idol =
        uid
          ? ((save.database_snapshot.idols.find((row) => String(row.uid ?? "") === uid) as Record<string, unknown> | undefined) ?? null)
          : null;
      if (idol && uid) {
        const terms = shortlistSigningTerms(idol);
        const name = String(idol.name ?? idol.name_romanji ?? uid);
        const created = addNotification(save, {
          title: `Signing offer: ${name}`,
          body: `Start date: ${terms.startDate}\nEnd date: ${terms.endDate}\nSalary: JPY ${terms.salaryYen.toLocaleString("ja-JP")}\n\nConfirm to sign this idol to your managed group.`,
          sender: "Management",
          category: "decision",
          level: "high",
          isoDate: currentIsoForNewLive(),
          unread: true,
          requiresConfirmation: true,
          dedupeKey: `shortlist-sign|${uid}|${terms.startDate}|${terms.endDate}|${terms.salaryYen}`,
          relatedEventUid: uid,
          reportData: {
            kind: "shortlist_signing_offer",
            idol_uid: uid,
            idol_name: name,
            start_date: terms.startDate,
            end_date: terms.endDate,
            salary_yen: terms.salaryYen,
          },
        });
        currentView = "Inbox";
        inboxSelectedUid = created.uid;
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
        const row = rows.find((item) => String(item.uid ??  "") === applicantUid);
        if (row) {
          let signedUid = String(row.signed_idol_uid ??  "");
          if (!signedUid) {
            const idolRow = auditionCandidateToIdolRow(row as never);
            signedUid = String(idolRow.uid ??  applicantUid);
            row.signed_idol_uid = signedUid;
            if (!currentSave.database_snapshot.idols.some((idol) => String(idol.uid ??  "") === signedUid)) {
              currentSave.database_snapshot.idols.push(idolRow);
            }
          }
          if (!currentSave.shortlist.includes(signedUid)) currentSave.shortlist.push(signedUid);
          addNotification(currentSave, {
            title: `Signing confirmation: ${String(row.name ??  signedUid)}`,
            body: `${String(row.name ??  signedUid)} joined your scout shortlist as a new freelancer candidate.`,
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
        attentionActionUid = null;
        enterLiveModeFromInbox(uid);
      }
      return;
    }
    const liveModeAction = t.closest<HTMLElement>("[data-live-mode-action]");
    if (liveModeAction && liveModeSession && save && !browseMode) {
      const action = liveModeAction.getAttribute("data-live-mode-action");
      unlockSongPreviewAudio();
      if (action === "play") {
        if (liveModeSession.transport === "playing") void pauseLiveModeItem();
        else if (liveModeSession.transport === "paused") void resumeLiveModeItem();
        else void playCurrentLiveModeItem();
      } else if (action === "next") {
        void advanceLiveModeItem();
      } else if (action === "end") {
        void finishLiveModeSession();
      } else if (action === "edit-formation") {
        openLiveModeFormationEditor();
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
    const openTrainingView = t.closest<HTMLElement>("[data-open-training-view]");
    if (openTrainingView && save && !browseMode) {
      const tab = openTrainingView.getAttribute("data-open-training-view");
      if (tab === "assignments" || tab === "roster" || tab === "formation") {
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
        const songEnc = openSongs.getAttribute("data-open-songs-song");
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
          if (songEnc) {
            try {
              songsDetailUid = decodeURIComponent(songEnc);
            } catch {
              songsDetailUid = songEnc;
            }
          } else {
            songsDetailUid = null;
          }
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
      if (tab === "songs" || tab === "cd" || tab === "goods") {
        navigate(() => {
          makingTab = tab;
        });
      }
      return;
    }
    const cdCreateBtn = t.closest<HTMLElement>("[data-cd-project-create]");
    if (cdCreateBtn && save && !browseMode && currentView === "Making") {
      const kind = cdCreateBtn.getAttribute("data-cd-project-create") === "album" ? "album" : "single";
      navigate(() => {
        createCdProject(kind);
      });
      return;
    }
    const cdPickBtn = t.closest<HTMLElement>("[data-cd-project-pick]");
    if (cdPickBtn && save && !browseMode && currentView === "Making") {
      const uid = cdPickBtn.getAttribute("data-cd-project-pick");
      if (uid) {
        navigate(() => {
          selectedCdProjectUid = uid;
        });
      }
      return;
    }
    const cdAddSongBtn = t.closest<HTMLElement>("[data-cd-project-add-song]");
    if (cdAddSongBtn && save && !browseMode && currentView === "Making") {
      const songUid = cdAddSongBtn.getAttribute("data-cd-project-add-song");
      const project = selectedCdProject();
      if (songUid && project && !project.song_uids.includes(songUid)) {
        navigate(() => {
          project.song_uids = [...project.song_uids, songUid];
        });
      }
      return;
    }
    const cdRemoveSongBtn = t.closest<HTMLElement>("[data-cd-project-remove-song]");
    if (cdRemoveSongBtn && save && !browseMode && currentView === "Making") {
      const songUid = cdRemoveSongBtn.getAttribute("data-cd-project-remove-song");
      const project = selectedCdProject();
      if (songUid && project) {
        navigate(() => {
          project.song_uids = project.song_uids.filter((uid) => uid !== songUid);
        });
      }
      return;
    }
    const cdDeleteBtn = t.closest<HTMLElement>("[data-cd-project-delete]");
    if (cdDeleteBtn && save && !browseMode && currentView === "Making") {
      const uid = cdDeleteBtn.getAttribute("data-cd-project-delete");
      if (uid) {
        navigate(() => {
          if (!save) return;
          save.cd_projects = save.cd_projects.filter((row) => row.uid !== uid);
          ensureSelectedCdProjectUid();
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
            Math.max(0, Number(item.desired_amount ??  0) || 0) * Math.max(0, Number(item.unit_cost_yen ??  0) || 0),
          0,
        );
        const totalAmount = items.reduce((sum, item) => sum + Math.max(0, Number(item.desired_amount ??  0) || 0), 0);
        const finances = save.finances as Record<string, unknown>;
        const currentCash = Math.max(0, Number(finances.cash_yen ??  0) || 0);
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
            body: `Need ?? ${totalCost.toLocaleString("ja-JP")} to make ${totalAmount} units, but current cash is ?? ${currentCash.toLocaleString("ja-JP")}.`,
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
          const amount = Math.max(0, Number(item.desired_amount ??  0) || 0);
          item.stock = Math.max(0, Number(item.stock ??  0) || 0) + amount;
        }
        addNotification(save, {
          title: `Goods made: ${rowLabel}`,
          body: `${totalAmount} units completed across ${items.length} member slot(s). Production cost ?? ${totalCost.toLocaleString("ja-JP")}.`,
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
    const scoutIdolOpen = t.closest<HTMLElement>("[data-idol-detail]");
    if (scoutIdolOpen && save && !browseMode && currentView === "Scout") {
      const uid = scoutIdolOpen.getAttribute("data-idol-detail");
      if (uid) {
        navigate(() => {
          idolDetailUid = uid;
          groupDetailUid = null;
          currentView = "Idols";
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
    const birthdayGoodsOrderBtn = t.closest<HTMLElement>("[data-birthday-goods-order-uid]");
    if (birthdayGoodsOrderBtn && save && !browseMode && currentView === "Making") {
      const memberUid = birthdayGoodsOrderBtn.getAttribute("data-birthday-goods-order-uid");
      const memberName = birthdayGoodsOrderBtn.getAttribute("data-goods-member-name");
      const item = ensureBirthdayGoodsRowFromDataset(memberUid, memberName);
      if (item) {
        const amount = Math.max(0, Number(item.desired_amount ??  0) || 0);
        const totalCost = amount * Math.max(0, Number(item.unit_cost_yen ??  0) || 0);
        const finances = save.finances as Record<string, unknown>;
        const currentCash = Math.max(0, Number(finances.cash_yen ??  0) || 0);
        if (amount <= 0) {
          addNotification(save, {
            title: `Birthday tee order skipped: ${memberName ??  item.member_name ??  item.name}`,
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
            title: `Birthday tee order blocked: ${memberName ??  item.member_name ??  item.name}`,
            body: `Need ?? ${totalCost.toLocaleString("ja-JP")} to make ${amount} units, but current cash is ?? ${currentCash.toLocaleString("ja-JP")}.`,
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
        item.stock = Math.max(0, Number(item.stock ??  0) || 0) + amount;
        addNotification(save, {
          title: `Birthday tees made: ${memberName ??  item.member_name ??  item.name}`,
          body: `${amount} units completed. Production cost ?? ${totalCost.toLocaleString("ja-JP")}.`,
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
    const discOpen = t.closest<HTMLElement>("[data-songs-open-disc]");
    if (discOpen && currentView === "Songs") {
      const raw = discOpen.getAttribute("data-songs-open-disc");
      if (raw) {
        navigate(() => {
          songsWorkspaceTab = "disc";
          songsDiscographyKey = raw;
        });
      }
      return;
    }
    const songDetailClose = t.closest<HTMLElement>("[data-song-detail-close]");
    if (songDetailClose) {
      navigate(() => {
        songsDetailUid = null;
      });
      return;
    }
    const songDetailOpen = t.closest<HTMLElement>("[data-song-detail]");
    if (songDetailOpen && (currentView === "Songs" || currentView === "Making")) {
      const uid = songDetailOpen.getAttribute("data-song-detail");
      if (uid) {
        navigate(() => {
          songsDetailUid = uid;
          if (currentView === "Songs") songsWorkspaceTab = "group_songs";
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
    if (!tile) return;
    // Nested group jump already handled above via [data-group-detail].
    const uid = tile.getAttribute("data-idol-detail");
    if (uid) {
      navigate(() => {
        idolDetailUid = uid;
        groupDetailUid = null;
        currentView = "Idols";
      });
    }
  });

  document.getElementById("main-content")?.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    const t = ev.target as HTMLElement;
    if (t.closest("[data-group-detail]")) return;
    const tile = t.closest<HTMLElement>("[data-idol-detail][role='button']");
    if (!tile || tile.tagName === "BUTTON") return;
    ev.preventDefault();
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
    const cdTitleInput = t.closest<HTMLInputElement>("[data-cd-project-title]");
    if (cdTitleInput && save && !browseMode && currentView === "Making") {
      const uid = cdTitleInput.getAttribute("data-cd-project-title");
      const row = save.cd_projects.find((project) => project.uid === uid);
      if (row) row.title = cdTitleInput.value.trim() || row.title;
      return;
    }
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
    const cdKindSelect = t.closest<HTMLSelectElement>("[data-cd-project-kind]");
    if (cdKindSelect && save && !browseMode && currentView === "Making") {
      const uid = cdKindSelect.getAttribute("data-cd-project-kind");
      const row = save.cd_projects.find((project) => project.uid === uid);
      if (row) row.release_kind = cdKindSelect.value === "album" ? "album" : "single";
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
          const venue = getVenuesCatalog().find((row) => row.name === value) ??  null;
          live.venue_uid = venue?.uid ??  null;
          live.location = venue?.location ??  "";
          live.capacity = venue?.capacity ??  live.capacity ??  null;
        }
        if (field === "venue" || field === "live_type") {
          const goodsUids = Array.isArray(live.goods_uids)
            ? (live.goods_uids as unknown[]).map((x) => String(x))
            : String(live.goods_uid ??  "").trim()
              ? [String(live.goods_uid ??  "").trim()]
              : [];
          live.goods_line = goodsUids
            .map((uid) => goodsDisplayLabel(findGoodsByUid(uid)))
            .filter(Boolean)
            .join(", ");
          live.goods_expected_revenue_yen = estimateCurrentLiveGoodsGross(
            String(live.live_type ??  "Routine"),
            String(live.venue ??  ""),
            goodsUids,
          );
        }
        paintGame();
      }
      return;
    }
    const sl = t.closest<HTMLInputElement>("[data-training-slider]");
    if (sl && save && !browseMode && currentView === "Training") {
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
      return;
    }
    const policySl = t.closest<HTMLInputElement>("[data-policy-training-slider]");
    if (policySl && save && !browseMode && currentView === "Schedule" && scheduleTab === "policy") {
      const field = String(policySl.getAttribute("data-field") ?? "").trim();
      const v = Math.max(0, Math.min(5, Number(policySl.value) || 0));
      if (field === "sing" || field === "dance" || field === "physical" || field === "target") {
        const policy = ensureGroupPolicy(save);
        policy.training.default_intensity[field] = v;
        const valEl = appRoot.querySelector(`[data-policy-training-val="${field}"]`);
        if (valEl) valEl.textContent = String(v);
      }
      return;
    }
  });

  document.getElementById("main-content")?.addEventListener("change", (ev) => {
    const t = ev.target as HTMLElement;
    if (save && !browseMode && currentView === "Schedule" && scheduleTab === "policy") {
      const policy = ensureGroupPolicy(save);
      const prerecord = t.closest<HTMLInputElement>("[data-policy-prerecord-uid]");
      if (prerecord) {
        const uid = String(prerecord.getAttribute("data-policy-prerecord-uid") ?? "").trim();
        if (uid) {
          if (prerecord.checked) policy.live.prerecorded_vocals_by_member[uid] = true;
          else delete policy.live.prerecorded_vocals_by_member[uid];
        }
        return;
      }
      const tokutenkai = t.closest<HTMLInputElement>("[data-policy-tokutenkai]");
      if (tokutenkai) {
        policy.live.tokutenkai_enabled = tokutenkai.checked;
        return;
      }
      const goods = t.closest<HTMLInputElement>("[data-policy-goods]");
      if (goods) {
        policy.live.goods_enabled = goods.checked;
        return;
      }
      const refillOff = t.closest<HTMLInputElement>("[data-policy-refill-off]");
      if (refillOff) {
        if (refillOff.checked) {
          policy.live.auto_goods_refill = null;
        } else {
          const qtyInput = appRoot.querySelector<HTMLInputElement>("[data-policy-refill-qty]");
          const n = Math.max(1, Math.round(Number(qtyInput?.value) || 50));
          policy.live.auto_goods_refill = n;
        }
        paintGame();
        return;
      }
      const refillQty = t.closest<HTMLInputElement>("[data-policy-refill-qty]");
      if (refillQty) {
        const n = Math.round(Number(refillQty.value) || 0);
        policy.live.auto_goods_refill = n > 0 ? n : null;
        paintGame();
        return;
      }
      const sns = t.closest<HTMLInputElement>("[data-policy-sns-uid]");
      if (sns) {
        const uid = String(sns.getAttribute("data-policy-sns-uid") ?? "").trim();
        const platform = String(sns.getAttribute("data-policy-sns-platform") ?? "").trim();
        if (uid && (platform === "x" || platform === "tiktok" || platform === "instagram" || platform === "youtube")) {
          const flags = policy.sns.by_member[uid] ?? { x: false, tiktok: false, instagram: false, youtube: false };
          flags[platform] = sns.checked;
          policy.sns.by_member[uid] = flags;
        }
        return;
      }
      const stream = t.closest<HTMLInputElement>("[data-policy-stream]");
      if (stream) {
        const key = String(stream.getAttribute("data-policy-stream") ?? "").trim();
        const hours = Math.max(0, Math.min(168, Math.round(Number(stream.value) || 0)));
        if (
          key === "showroom_hours_per_week" ||
          key === "tiktok_hours_per_week" ||
          key === "instagram_hours_per_week"
        ) {
          policy.stream[key] = hours;
          stream.value = String(hours);
        }
        return;
      }
      const trainingSlider = t.closest<HTMLInputElement>("[data-policy-training-slider]");
      if (trainingSlider) {
        const field = String(trainingSlider.getAttribute("data-field") ?? "").trim();
        const v = Math.max(0, Math.min(5, Number(trainingSlider.value) || 0));
        if (field === "sing" || field === "dance" || field === "physical" || field === "target") {
          policy.training.default_intensity[field] = v;
          const valEl = appRoot.querySelector(`[data-policy-training-val="${field}"]`);
          if (valEl) valEl.textContent = String(v);
        }
        return;
      }
      const trainingFocus = t.closest<HTMLSelectElement>("[data-policy-training-focus]");
      if (trainingFocus) {
        policy.training.default_focus = String(trainingFocus.value ?? "talking");
        return;
      }
    }
    const contractSalaryInput = t.closest<HTMLInputElement>("[data-contract-draft-salary]");
    if (contractSalaryInput && save && !browseMode && currentView === "Inbox") {
      const uid = String(contractSalaryInput.getAttribute("data-contract-draft-salary") ??  "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      const report = row?.report_data && typeof row.report_data === "object" ? (row.report_data as Record<string, unknown>) : null;
      const idol = report ? managedIdolByUid(String(report.idol_uid ??  "")) : null;
      if (report && idol) {
        report.proposed_salary_yen = Math.max(0, numberOrZero(contractSalaryInput.value));
        report.likelihood = contractRenewLikelihoodLabel(
          idol,
          Number(report.current_salary_yen ??  0) || 0,
          Number(report.proposed_salary_yen ??  0) || 0,
          String(report.current_end_date ??  currentIsoForNewLive()),
          String(report.proposed_end_date ??  report.current_end_date ??  currentIsoForNewLive()),
        );
        paintGame();
      }
      return;
    }
    const contractEndInput = t.closest<HTMLInputElement>("[data-contract-draft-end]");
    if (contractEndInput && save && !browseMode && currentView === "Inbox") {
      const uid = String(contractEndInput.getAttribute("data-contract-draft-end") ??  "").trim();
      const row = save.inbox.notifications.find((item) => item.uid === uid);
      const report = row?.report_data && typeof row.report_data === "object" ? (row.report_data as Record<string, unknown>) : null;
      const idol = report ? managedIdolByUid(String(report.idol_uid ??  "")) : null;
      if (report && idol) {
        report.proposed_end_date = String(contractEndInput.value ??  "").split("T")[0];
        report.likelihood = contractRenewLikelihoodLabel(
          idol,
          Number(report.current_salary_yen ??  0) || 0,
          Number(report.proposed_salary_yen ??  report.current_salary_yen ??  0) || 0,
          String(report.current_end_date ??  currentIsoForNewLive()),
          String(report.proposed_end_date ??  report.current_end_date ??  currentIsoForNewLive()),
        );
        paintGame();
      }
      return;
    }
    const trainingSongPick = t.closest<HTMLInputElement>("[data-training-song-pick]");
    if (trainingSongPick && save && !browseMode && currentView === "Training") {
      const uid = String(trainingSongPick.getAttribute("data-training-song-pick") ??  "").trim();
      if (uid) {
        const set = new Set(save.training_song_uids.map((x) => String(x)));
        if (trainingSongPick.checked) set.add(uid);
        else set.delete(uid);
        save.training_song_uids = [...set];
        paintGame();
      }
      return;
    }
    const roleSelect = t.closest<HTMLSelectElement>("[data-training-role]");
    if (roleSelect && save && !browseMode && currentView === "Training") {
      const uid = String(roleSelect.getAttribute("data-training-role") ?? "").trim();
      const roleKey = String(roleSelect.getAttribute("data-role-key") ?? "").trim();
      if (uid && roleKey) {
        setManagedMemberRoleFocus(uid, roleKey, Number(roleSelect.value) || 0);
        paintGame();
      }
      return;
    }
    const announcedLeaderPick = t.closest<HTMLInputElement>("[data-training-announced-leader]");
    if (announcedLeaderPick && save && !browseMode && currentView === "Training") {
      const uid = String(announcedLeaderPick.getAttribute("data-training-announced-leader") ?? "").trim();
      if (uid) {
        setManagedMemberAnnouncedLeader(uid, announcedLeaderPick.checked);
        paintGame();
      }
      return;
    }
    const benchmarkPreferencePick = t.closest<HTMLInputElement>("[data-role-benchmark-preference]");
    if (benchmarkPreferencePick && save && !browseMode && currentView === "Training") {
      const key = String(benchmarkPreferencePick.getAttribute("data-role-benchmark-preference") ?? "").trim();
      if (ROLE_BENCHMARK_KEYS.includes(key as RoleBenchmarkKey)) {
        const set = new Set(trainingRoleBenchmarkPreferences);
        if (benchmarkPreferencePick.checked) set.add(key as RoleBenchmarkKey);
        else set.delete(key as RoleBenchmarkKey);
        trainingRoleBenchmarkPreferences = ROLE_BENCHMARK_KEYS.filter((item) => set.has(item));
        writeRoleBenchmarkPreferencesToSave(save, trainingRoleBenchmarkPreferences);
        autoAssignManagedRoles(trainingRoleBenchmarkPreferences);
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
      const uid = String(liveGoodsPick.getAttribute("data-live-goods-pick") ??  "").trim();
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
      const uid = String(liveDetailGoodsPick.getAttribute("data-live-detail-goods-pick") ??  "").trim();
      if (live && uid) {
        const current = Array.isArray(live.goods_uids)
          ? (live.goods_uids as unknown[]).map((x) => String(x))
          : String(live.goods_uid ??  "").trim()
            ? [String(live.goods_uid ??  "").trim()]
            : [];
        const set = new Set(current);
        if (liveDetailGoodsPick.checked) set.add(uid);
        else set.delete(uid);
        const goodsUids = [...set];
        live.goods_uids = goodsUids;
        live.goods_uid = goodsUids[0] ??  "";
        live.goods_line = goodsUids
          .map((goodsUid) => goodsDisplayLabel(findGoodsByUid(goodsUid)))
          .filter(Boolean)
          .join(", ");
        live.goods_expected_revenue_yen = estimateCurrentLiveGoodsGross(
          String(live.live_type ??  "Routine"),
          String(live.venue ??  ""),
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
        const idol = save.database_snapshot.idols.find((row) => String(row.uid ??  "") === uid);
        if (idol && typeof idol === "object") {
          const root = vacationBtn.closest("tr, .training-vacation-controls, td, article") ??  document;
          const daysInput = root.querySelector<HTMLInputElement>(`[data-training-vacation-days="${uid}"]`);
          const rawDays = Number(daysInput?.value ??  1);
          const hiatusDays = Number.isFinite(rawDays) ? Math.max(1, Math.min(365, Math.trunc(rawDays))) : 1;
          const period = scheduleIdolVacation(
            idol as Record<string, unknown>,
            save.current_date ??  save.game_start_date ??  save.scenario_context?.startup_date ??  currentIsoForNewLive(),
            hiatusDays,
          );
          const name = String((idol as Record<string, unknown>).name ??  uid);
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
      songsDetailUid = null;
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
        title: song.getAttribute("data-live-palette-song") ??  "",
      });
      ev.dataTransfer?.setData("text/plain", liveProgramDragData);
      return;
    }
    const template = t.closest<HTMLElement>("[data-live-template]");
    if (template) {
      liveProgramDragData = JSON.stringify({
        source: "template",
        token: template.getAttribute("data-live-template") ??  "",
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
        let title = String(payload.title ??  "");
        try {
          title = decodeURIComponent(title);
        } catch {
          /* keep raw */
        }
        insertProgramItem(targetIndex, createSongProgramItem(title));
      } else if (payload.source === "template") {
        const [kindRaw, durationRaw] = String(payload.token ??  "").split(":");
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
      const beforeDate = isoDatePart(save.current_date ??  save.game_start_date ??  "");
      save = advanceOneDay(save);
      const afterDate = isoDatePart(save.current_date ??  save.game_start_date ??  "");
      if (afterDate !== beforeDate) {
        void saveToSlot(accountName || String(save.account_name ??  save.player_name ??  "default"), AUTOSAVE_SLOT, save);
      }
      currentView = "Inbox";
      inboxSelectedUid = save.inbox.notifications[0]?.uid ??  null;
      resetNewLiveFormDefaults(newLiveForm.liveType);
    });
  });
  document.getElementById("btn-save")?.addEventListener("click", async () => {
    if (!save || browseMode || !accountName) return;
    const occupied = listOccupiedSlots(accountName).includes(slot);
    if (occupied) {
      const existingLabel =
        listSlotSummaries(accountName).find((row) => row.slot === slot)?.label?.trim() ||
        t(uiLang, "opening_slot_saved");
      const ok = await showAppConfirm({
        title: t(uiLang, "shell_overwrite_slot_title"),
        message: t(uiLang, "shell_overwrite_slot_confirm", { slot, label: existingLabel }),
        confirmLabel: t(uiLang, "shell_overwrite_confirm"),
        cancelLabel: t(uiLang, "common_cancel"),
        danger: true,
      });
      if (!ok) return;
    }
    save.account_name = accountName;
    save.player_name = accountName;
    await saveToSlot(accountName, slot, save);
    paintGame();
  });

  document.getElementById("main-content")?.addEventListener("dblclick", (ev) => {
    const t = ev.target as HTMLElement;
    const liveOpen = t.closest<HTMLElement>("[data-live-open-uid]");
    if (liveOpen && save && !browseMode && currentView === "Schedule") {
      const uid = String(liveOpen.getAttribute("data-live-open-uid") ?? "").trim();
      if (uid) {
        navigate(() => {
          currentView = "Lives";
          livesTab = "new";
          loadScheduledLiveIntoArrangeForm(uid);
        });
      }
      return;
    }
    const calDay = t.closest<HTMLElement>("[data-sched-date]");
    if (calDay && save && !browseMode && currentView === "Schedule") {
      const iso = String(calDay.getAttribute("data-sched-date") ?? "").trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
        scheduleWeekAnchorIso = iso;
        paintGame();
      }
    }
  });
  document.getElementById("btn-load")?.addEventListener("click", async () => {
    if (browseMode || !accountName) return;
    const loaded = await loadFromSlot(accountName, slot);
    if (loaded && assertHydratedSave(loaded)) {
      save = loaded;
      if (!save.tutorial) save.tutorial = { completed: true, disabled: false };
      setAccountName(String(save.account_name ??  save.player_name ??  accountName));
      save.account_name = accountName;
      save.player_name = accountName;
      scheduleCalendarMonthStart = null;
      resetNewLiveFormDefaults();
      if (loadedScenario) {
        hydrateSnapshotGroupsFromScenario(save, loadedScenario.groups, loadedScenario.preset.data_subdir);
        hydrateSnapshotSongsFromScenario(save, loadedScenario.songs, loadedScenario.preset.data_subdir);
      }
      tutorialOverlayOpen = false;
      resetNavigationHistory();
    }
    paintGame();
  });
  document.getElementById("btn-new")?.addEventListener("click", () => {
    if (!loadedScenario) return;
    browseMode = false;
    tutorialOverlayOpen = false;
    idolDetailUid = null;
    groupDetailUid = null;
    openingScreen = "new_game";
    selectedNewGameGroupUid = null;
    paintOpening();
  });
  document.getElementById("btn-clear")?.addEventListener("click", async () => {
    if (!accountName) return;
    const occupied = listOccupiedSlots(accountName).includes(slot);
    if (occupied) {
      const existingLabel =
        listSlotSummaries(accountName).find((row) => row.slot === slot)?.label?.trim() ||
        t(uiLang, "opening_slot_saved");
      const ok = await showAppConfirm({
        title: t(uiLang, "shell_clear_slot_title"),
        message: t(uiLang, "shell_clear_slot_confirm", { slot, label: existingLabel }),
        confirmLabel: t(uiLang, "shell_clear_confirm"),
        cancelLabel: t(uiLang, "common_cancel"),
        danger: true,
      });
      if (!ok) return;
    }
    await clearSlot(accountName, slot);
    scheduleCalendarMonthStart = null;
    paintGame();
  });
  document.getElementById("slot-select")?.addEventListener("change", (ev) => {
    const v = Number((ev.target as HTMLSelectElement).value);
    if (!Number.isNaN(v)) slot = v;
  });
  document.getElementById("btn-main-menu")?.addEventListener("click", () => {
    exitLiveModeSession();
    browseMode = false;
    tutorialOverlayOpen = false;
    idolDetailUid = null;
    groupDetailUid = null;
    openingScreen = "home";
    resetNavigationHistory();
    paintOpening();
  });
}

appRoot.innerHTML = `<p class="fm-loading">Loading scenario…</p>`;

Promise.all([loadDefaultScenario(), preloadManagedLiveSchedules(), preloadHeroinesLeague(), preloadCareerDecisions(), preloadScandalHandlings()])
  .then(([ls]) => {
    loadedScenario = ls;
    openingStatus = `Loaded ${ls.preset.data_subdir} (${ls.idols.length} idols, ${ls.songs.length.toLocaleString()} song rows).`;
    openingScreen = "login";
    paintOpening();
  })
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    appRoot.innerHTML = `<div class="fm-error" role="alert"><strong>Could not load scenario.</strong><br />${htmlEsc(msg)}</div>`;
  });

