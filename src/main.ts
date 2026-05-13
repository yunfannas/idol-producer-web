import "./style.css";
import { loadDefaultScenario } from "./data/loadScenario";
import type { LoadedScenario } from "./data/scenarioTypes";
import {
  advanceOneDay,
  acknowledgeInboxNotification,
  createNewGameSaveFromScenario,
  getBlockingNotificationForSave,
} from "./engine/gameEngine";
import { sortGroupsForDirectory } from "./engine/financeSystem";
import type { GameSavePayload } from "./save/gameSaveSchema";
import {
  renderDesktopShell,
  isDesktopNavId,
  isManagementNav,
  isBrowseNav,
  type DesktopNavId,
  type LivesTab,
  type NewLiveFormState,
  type ScoutTab,
  type SongsWorkspaceTab,
  BROWSE_NAV_ITEMS,
} from "./ui/gameShell";
import { hydrateSnapshotSongsFromScenario } from "./save/gameSaveSchema";
import { addNotification, notificationRequiresAck } from "./save/inbox";
import { songsForDisplaySorted, buildDiscBuckets } from "./data/songDisplayPolicy";
import { addMinutesToHHMM, getVenuesCatalog, LIVE_TYPE_PRESETS } from "./engine/liveScheduleWeb";
import {
  auditionCandidateToIdolRow,
  buildAuditionStorageKey,
  buildDefaultScoutCompanies,
  generateAuditionCandidates,
} from "./engine/scoutWeb";
import { normalizeFestivalCatalog, syncManagedTif2025Lives } from "./engine/festivalWeb";
import {
  type OpeningScreen,
  renderOpeningHome,
  renderNewGameScreen,
  buildNewGameRows,
} from "./ui/openingScreens";
import { clearSlot, listOccupiedSlots, loadFromSlot, saveToSlot } from "./persistence/saves";
import { htmlEsc } from "./ui/htmlEsc";
import { wirePortraitFallbacks } from "./ui/portraitUrl";
import { groupsForDirectoryListing } from "./data/scenarioBrowse";

const appRootElt = document.querySelector<HTMLDivElement>("#app");
if (!appRootElt) {
  throw new Error("#app missing");
}
const appRoot: HTMLDivElement = appRootElt;

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
  return save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? "2020-01-01";
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
        .map((row) => String(row.title ?? row.title_romanji ?? "").trim())
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
}

function numberOrZero(value: string): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

let loadedScenario: LoadedScenario | null = null;
let save: GameSavePayload | null = null;
let slot = 0;
let browseMode = false;
let openingScreen: OpeningScreen = "home";
let selectedNewGameGroupUid: string | null = null;
let openingStatus = "";

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
let selectedScoutLeadUid: string | null = null;
let selectedScoutApplicantUid: string | null = null;
let trainingRepaintTimer: ReturnType<typeof setTimeout> | null = null;
let newLiveForm: NewLiveFormState = {
  liveType: "Routine",
  title: "",
  date: "2020-01-01",
  startTime: "18:00",
  endTime: "19:10",
  rehearsalStart: "",
  rehearsalEnd: "",
  venueName: "",
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
  const preset = loadedScenario?.preset ?? null;
  const dbReady = loadedScenario != null;
  appRoot.innerHTML =
    openingScreen === "home"
      ? renderOpeningHome(preset, dbReady, openingStatus, save != null && !browseMode, slot, listOccupiedSlots())
      : loadedScenario
        ? renderNewGameScreen(
            buildNewGameRows(loadedScenario),
            loadedScenario.preset,
            "Producer",
            loadedScenario.preset.scenario_number === 6,
          )
        : `<p class="fm-error" role="alert">No scenario loaded.</p>`;

  if (openingScreen === "home") {
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
        openingStatus = `Loaded slot ${slot}.`;
        paintGame();
      } else {
        openingStatus = `Slot ${slot} is empty or not a valid save.`;
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
      paintGame();
    });
  } else if (openingScreen === "new_game" && loadedScenario) {
    const rows = buildNewGameRows(loadedScenario);
    const startBtn = document.getElementById("new-game-start") as HTMLButtonElement | null;
    const nameInput = document.getElementById("producer-name") as HTMLInputElement | null;

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
        scheduleCalendarMonthStart = null;
        resetNewLiveFormDefaults();
        syncFestivalLivesIfPossible();
        browseMode = false;
        openingScreen = "home";
        selectedNewGameGroupUid = null;
        currentView = "Inbox";
        idolDetailUid = null;
        groupDetailUid = null;
        openingStatus = "New production started.";
        paintGame();
      } catch (e) {
        window.alert(e instanceof Error ? e.message : String(e));
      }
    });
  }
}

function paintGame(): void {
  coerceNavForMode();

  if (browseMode) {
    if (!loadedScenario) {
      appRoot.innerHTML = `<p class="fm-error" role="alert">Browse mode requires scenario data.</p>`;
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
    const rev = [...save.inbox.notifications].reverse();
    if (!inboxSelectedUid || !rev.some((r) => r.uid === inboxSelectedUid)) {
      inboxSelectedUid = rev[rev.length - 1]?.uid ?? null;
    }
  } else if (currentView !== "Inbox") {
    inboxSelectedUid = null;
  }

  appRoot.innerHTML = renderDesktopShell({
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
    scoutTab,
    selectedScoutLeadUid,
    selectedScoutApplicantUid,
    scheduleCalendarMonthStart,
    slot,
    occupiedSlots: listOccupiedSlots(),
  });

  wirePortraitFallbacks(appRoot);

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
      if (tab === "new" || tab === "scheduled" || tab === "past" || tab === "festival") {
        livesTab = tab;
        paintGame();
      }
      return;
    }
    const scheduledPick = t.closest<HTMLElement>("[data-scheduled-live]");
    if (scheduledPick && save && !browseMode && currentView === "Lives") {
      scheduledLiveUid = scheduledPick.getAttribute("data-scheduled-live");
      paintGame();
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
        scoutTab = tab;
        paintGame();
      }
      return;
    }
    const scoutCompanyPick = t.closest<HTMLElement>("[data-scout-company]");
    if (scoutCompanyPick && save && !browseMode && currentView === "Scout") {
      const uid = scoutCompanyPick.getAttribute("data-scout-company");
      if (uid) {
        save.scout.selected_company_uid = uid;
        selectedScoutLeadUid = null;
        selectedScoutApplicantUid = null;
        paintGame();
      }
      return;
    }
    const scoutLeadPick = t.closest<HTMLElement>("[data-scout-lead]");
    if (scoutLeadPick && save && !browseMode && currentView === "Scout") {
      selectedScoutLeadUid = scoutLeadPick.getAttribute("data-scout-lead");
      paintGame();
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
      selectedScoutApplicantUid = scoutApplicantPick.getAttribute("data-scout-applicant");
      paintGame();
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
        paintGame();
      }
      return;
    }
    const markReadBtn = t.closest<HTMLElement>("[data-inbox-mark-read]");
    if (markReadBtn && save && !browseMode) {
      const uid = markReadBtn.getAttribute("data-inbox-mark-read");
      const row = uid ? save.inbox.notifications.find((n) => n.uid === uid) : undefined;
      if (row) row.read = true;
      paintGame();
      return;
    }
    const inboxPick = t.closest<HTMLButtonElement>(".inbox-row-btn");
    if (inboxPick && save && !browseMode && currentView === "Inbox") {
      const u = inboxPick.getAttribute("data-inbox-uid");
      if (u) {
        inboxSelectedUid = u;
        paintGame();
      }
      return;
    }
    const openSongs = t.closest<HTMLElement>("[data-open-songs-for-group]");
    if (openSongs) {
      const enc = openSongs.getAttribute("data-open-songs-for-group");
      if (enc != null && enc.length) {
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
        paintGame();
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
        songsWorkspaceTab = tab;
        paintGame();
      }
      return;
    }
    const discRow = t.closest<HTMLElement>("[data-songs-discography-key]");
    if (discRow && currentView === "Songs" && songsWorkspaceTab === "disc") {
      const raw = discRow.getAttribute("data-songs-discography-key");
      if (raw != null && raw.length) {
        try {
          songsDiscographyKey = decodeURIComponent(raw);
        } catch {
          songsDiscographyKey = raw;
        }
        paintGame();
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
      groupDetailUid = null;
      paintGame();
      return;
    }
    const groupOpen = t.closest<HTMLElement>("[data-group-detail]");
    if (groupOpen) {
      const guid = groupOpen.getAttribute("data-group-detail");
      if (guid) {
        groupDetailUid = guid;
        idolDetailUid = null;
        currentView = "Groups";
        paintGame();
      }
      return;
    }
    if (t.closest("#btn-idol-detail-back")) {
      idolDetailUid = null;
      paintGame();
      return;
    }
    const tile = t.closest<HTMLElement>("[data-idol-detail]");
    if (!tile || currentView !== "Idols") return;
    const uid = tile.getAttribute("data-idol-detail");
    if (uid) {
      idolDetailUid = uid;
      groupDetailUid = null;
      paintGame();
    }
  });

  document.getElementById("main-content")?.addEventListener("input", (ev) => {
    const t = ev.target as HTMLElement;
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
    const liveSong = t.closest<HTMLInputElement>("[data-live-song]");
    if (liveSong && save && !browseMode && currentView === "Lives") {
      const raw = liveSong.getAttribute("data-live-song") ?? "";
      let title = raw;
      try {
        title = decodeURIComponent(raw);
      } catch {
        title = raw;
      }
      if (liveSong.checked) {
        if (!newLiveForm.setlist.includes(title)) newLiveForm.setlist = [...newLiveForm.setlist, title];
      } else {
        newLiveForm.setlist = newLiveForm.setlist.filter((item) => item !== title);
      }
      paintGame();
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
    try {
      songsGroupUid = decodeURIComponent(v);
    } catch {
      songsGroupUid = v;
    }
    songsDiscographyKey = null;
    songsWorkspaceTab = "group_songs";
    paintGame();
  });

  appRoot.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.nav;
      if (!v || !isDesktopNavId(v)) return;
      if (browseMode && !isBrowseNav(v)) return;
      if (!browseMode && save && !isManagementNav(v)) return;
      if (currentView === "Schedule" && v !== "Schedule") {
        scheduleCalendarMonthStart = null;
      }
      idolDetailUid = null;
      groupDetailUid = null;
      if (v !== "Inbox") inboxSelectedUid = null;
      currentView = v;
      paintGame();
    });
  });

  document.getElementById("btn-next-day")?.addEventListener("click", () => {
    if (!save || browseMode) return;
    const blocker = getBlockingNotificationForSave(save);
    if (blocker) {
      currentView = "Inbox";
      inboxSelectedUid = blocker.uid;
      paintGame();
      return;
    }
    save = advanceOneDay(save);
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
