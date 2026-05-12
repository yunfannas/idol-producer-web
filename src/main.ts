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
  type SongsWorkspaceTab,
  BROWSE_NAV_ITEMS,
} from "./ui/gameShell";
import { hydrateSnapshotSongsFromScenario } from "./save/gameSaveSchema";
import { notificationRequiresAck } from "./save/inbox";
import { songsForDisplaySorted, buildDiscBuckets } from "./data/songDisplayPolicy";
import {
  type OpeningScreen,
  renderOpeningHome,
  renderNewGameScreen,
  buildNewGameRows,
} from "./ui/openingScreens";
import { clearSlot, listOccupiedSlots, loadFromSlot, saveToSlot } from "./persistence/saves";
import { htmlEsc } from "./ui/htmlEsc";
import { wirePortraitFallbacks } from "./ui/portraitUrl";

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
let trainingRepaintTimer: ReturnType<typeof setTimeout> | null = null;

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
  const validUids = new Set(
    groups.map((g) => String((g as { uid?: unknown }).uid ?? "").trim()).filter(Boolean),
  );
  if (songsGroupUid && validUids.has(songsGroupUid)) return;
  const mg = save?.managing_group_uid?.trim();
  if (mg && validUids.has(mg)) {
    songsGroupUid = mg;
    return;
  }
  const sorted = sortGroupsForDirectory(groups);
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

function paintOpening(): void {
  const preset = loadedScenario?.preset ?? null;
  const dbReady = loadedScenario != null;
  appRoot.innerHTML =
    openingScreen === "home"
      ? renderOpeningHome(preset, dbReady, openingStatus, save != null && !browseMode, slot, listOccupiedSlots())
      : loadedScenario
        ? renderNewGameScreen(buildNewGameRows(loadedScenario), loadedScenario.preset, "Producer")
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
        if (loadedScenario) {
          hydrateSnapshotSongsFromScenario(save, loadedScenario.songs, loadedScenario.preset.data_subdir);
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
