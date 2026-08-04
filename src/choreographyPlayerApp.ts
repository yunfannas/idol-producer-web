/**
 * Standalone choreography player at `/choreography-player/`.
 * Loads Scenario 6 idols for portraits; plays choreographic-compat JSON.
 */

import "./style.css";
import {
  bindChoreographyPlayer,
  buildTimeline,
  createChoreoPlayerState,
  patchChoreoPlayerFrame,
  renderChoreographyPlayer,
  type ChoreoPlayerIdol,
  type ChoreoPlayerState,
} from "./ui/choreographyPlayer";
import { resolvePublicAssetUrl } from "./ui/portraitUrl";

const appElt = document.querySelector<HTMLDivElement>("#app");
if (!appElt) throw new Error("#app missing");
const app: HTMLDivElement = appElt;

const REF_DATE = "2025-07-05";

type IdolRow = Record<string, unknown>;

let playerState: ChoreoPlayerState = createChoreoPlayerState({ asOfDate: REF_DATE });
let binder: { destroy: () => void } | null = null;
let raf = 0;
let lastTs = 0;
let catalogStatus = "Loading idol portraits…";

function idolName(row: IdolRow): string {
  return String(row.name ?? row.name_romanji ?? row.uid ?? "—").trim() || "—";
}

function idolColor(row: IdolRow): string {
  const c = String(row.color_code ?? row.color ?? "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#94a3b8";
}

function stopPlayLoop(): void {
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  lastTs = 0;
}

function startPlayLoop(): void {
  stopPlayLoop();
  const loop = (ts: number) => {
    if (!playerState.playing || !playerState.doc) {
      stopPlayLoop();
      return;
    }
    if (!lastTs) lastTs = ts;
    const dt = Math.min(0.1, (ts - lastTs) / 1000);
    lastTs = ts;
    const { totalSec } = buildTimeline(playerState.doc);
    playerState = {
      ...playerState,
      clockSec: (playerState.clockSec + dt) % totalSec,
      statusMessage: "Playing…",
    };
    patchChoreoPlayerFrame(app, playerState);
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}

function paint(): void {
  binder?.destroy();
  binder = null;

  app.innerHTML = `
    <div class="choreo-player-standalone">
      <nav class="choreo-player-standalone-nav">
        <a href="./">← Game</a>
        <a href="./formation-editor.html">Formation editor</a>
        <strong>Choreography player</strong>
        <span class="choreo-player-nav-status">${catalogStatus}</span>
      </nav>
      <div class="choreo-player-standalone-shell">
        ${renderChoreographyPlayer(playerState)}
      </div>
    </div>
  `;

  binder = bindChoreographyPlayer(app, () => playerState, {
    onChange: (next) => {
      const wasPlaying = playerState.playing;
      playerState = next;
      if (next.playing && !wasPlaying) {
        paint();
        startPlayLoop();
        return;
      }
      if (!next.playing) stopPlayLoop();
      paint();
    },
  });
}

async function boot(): Promise<void> {
  paint();
  try {
    const url = resolvePublicAssetUrl("data/scenarios/scenario_6/idols.json");
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const rows = (await res.json()) as IdolRow[];
    const idols: ChoreoPlayerIdol[] = rows
      .filter((r) => String(r.uid ?? "").trim())
      .map((row) => ({
        uid: String(row.uid ?? ""),
        name: idolName(row),
        color: idolColor(row),
        idol: row,
      }));
    playerState = {
      ...playerState,
      idolsByUid: new Map(idols.map((m) => [m.uid, m])),
      asOfDate: REF_DATE,
    };
    catalogStatus = `${idols.length} idol portraits ready`;
  } catch (err) {
    catalogStatus = `Portraits unavailable (${err instanceof Error ? err.message : "error"})`;
  }
  paint();

  const params = new URLSearchParams(location.search);
  const sample = params.get("sample");
  if (sample) {
    try {
      const res = await fetch(resolvePublicAssetUrl(sample.replace(/^\//, "")));
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const { parseChoreographicCompat } = await import("./data/choreographicCompat");
      const doc = parseChoreographicCompat(json);
      if (doc) {
        playerState = {
          ...playerState,
          doc,
          clockSec: 0,
          playing: false,
          sourceLabel: sample,
          statusMessage: `Loaded sample · ${doc.formations.length} set(s).`,
        };
        paint();
      } else {
        playerState = { ...playerState, statusMessage: "Sample JSON is not choreographic-compat." };
        paint();
      }
    } catch (err) {
      playerState = {
        ...playerState,
        statusMessage: `Could not load sample: ${err instanceof Error ? err.message : "error"}`,
      };
      paint();
    }
  }
}

void boot();
