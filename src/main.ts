import "./style.css";
import { loadDefaultScenario } from "./data/loadScenario";
import type { LoadedScenario } from "./data/scenarioTypes";
import { advanceOneDay, createNewGameSaveFromScenario } from "./engine/gameEngine";
import type { GameSavePayload } from "./save/gameSaveSchema";
import {
  renderDesktopShell,
  isDesktopNavId,
  isManagementNav,
  isBrowseNav,
  type DesktopNavId,
  BROWSE_NAV_ITEMS,
} from "./ui/gameShell";
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

  appRoot.innerHTML = renderDesktopShell({
    browseMode,
    browseData: loadedScenario,
    save,
    preview: null,
    currentView,
    idolDetailUid,
    groupDetailUid,
    idolListLayout: readIdolListLayout(),
    slot,
    occupiedSlots: listOccupiedSlots(),
  });

  wirePortraitFallbacks(appRoot);

  document.getElementById("main-content")?.addEventListener("click", (ev) => {
    const t = ev.target as HTMLElement;
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

  appRoot.querySelectorAll<HTMLButtonElement>("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const v = btn.dataset.nav;
      if (!v || !isDesktopNavId(v)) return;
      if (browseMode && !isBrowseNav(v)) return;
      if (!browseMode && save && !isManagementNav(v)) return;
      idolDetailUid = null;
      groupDetailUid = null;
      currentView = v;
      paintGame();
    });
  });

  document.getElementById("btn-next-day")?.addEventListener("click", () => {
    if (!save || browseMode) return;
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
    if (loaded && assertHydratedSave(loaded)) save = loaded;
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
    openingStatus = `Loaded ${ls.preset.data_subdir} (${ls.idols.length} idols).`;
    openingScreen = "home";
    paintOpening();
  })
  .catch((e: unknown) => {
    const msg = e instanceof Error ? e.message : String(e);
    appRoot.innerHTML = `<div class="fm-error" role="alert"><strong>Could not load scenario.</strong><br />${htmlEsc(msg)}</div>`;
  });
