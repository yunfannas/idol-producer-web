/**
 * Standalone choreography player — play idol-producer-choreographic-compat JSON.
 * Side roster with portraits; stage animates holds + transitions.
 */

import {
  dancerIdolUid,
  parseChoreographicCompat,
  type ChoreographicCompatDocument,
  type ChoreographicDancer,
  type ChoreographicFormationFrame,
  type ChoreographicPosition,
} from "../data/choreographicCompat";
import { htmlEsc } from "./htmlEsc";
import { attrQuotedUrl, avatarPlaceholderDataUrl, idolPortraitPublicSrc } from "./portraitUrl";

export type ChoreoPlayerIdol = {
  uid: string;
  name: string;
  color: string;
  idol?: Record<string, unknown>;
};

export type ChoreoPlayerState = {
  doc: ChoreographicCompatDocument | null;
  /** Catalog idols for portraits (by uid). */
  idolsByUid: Map<string, ChoreoPlayerIdol>;
  asOfDate: string | null;
  /** Absolute playback clock (seconds from song start of timeline). */
  clockSec: number;
  playing: boolean;
  statusMessage: string;
  sourceLabel: string;
};

export type ChoreoPlayerCallbacks = {
  onChange: (state: ChoreoPlayerState) => void;
};

type TimelineSegment =
  | { kind: "hold"; setIndex: number; start: number; end: number }
  | { kind: "transition"; fromIndex: number; toIndex: number; start: number; end: number };

export function buildTimeline(doc: ChoreographicCompatDocument): {
  segments: TimelineSegment[];
  totalSec: number;
} {
  const segments: TimelineSegment[] = [];
  let t = 0;
  const startIdx = Math.max(0, Math.min(doc.formations.length - 1, doc.startingFormationIndex ?? 0));
  // Play formations in array order; startingFormationIndex is metadata for editors.
  void startIdx;
  for (let i = 0; i < doc.formations.length; i++) {
    const frame = doc.formations[i]!;
    const trans = i === 0 ? 0 : Math.max(0, Number(frame.transitionInSec) || 0);
    if (trans > 0 && i > 0) {
      segments.push({
        kind: "transition",
        fromIndex: i - 1,
        toIndex: i,
        start: t,
        end: t + trans,
      });
      t += trans;
    }
    const hold = Math.max(0.25, Number(frame.durationSec) || 8);
    segments.push({ kind: "hold", setIndex: i, start: t, end: t + hold });
    t += hold;
  }
  return { segments, totalSec: Math.max(0.25, t) };
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}

function easeInOut(u: number): number {
  const x = Math.max(0, Math.min(1, u));
  return x * x * (3 - 2 * x);
}

function posMap(frame: ChoreographicFormationFrame): Map<string, ChoreographicPosition> {
  return new Map(frame.positions.map((p) => [p.dancerId, p]));
}

/** Interpolated stage positions for current clock. */
export function positionsAtClock(
  doc: ChoreographicCompatDocument,
  clockSec: number,
): { positions: ChoreographicPosition[]; setLabel: string; phase: string; setIndex: number } {
  const { segments, totalSec } = buildTimeline(doc);
  const t = ((clockSec % totalSec) + totalSec) % totalSec;
  const seg =
    segments.find((s) => t >= s.start && t < s.end) ??
    segments[segments.length - 1] ??
    null;
  if (!seg) {
    const frame = doc.formations[0];
    return {
      positions: frame?.positions ?? [],
      setLabel: frame?.name ?? "—",
      phase: "hold",
      setIndex: 0,
    };
  }
  if (seg.kind === "hold") {
    const frame = doc.formations[seg.setIndex]!;
    return {
      positions: frame.positions,
      setLabel: frame.name,
      phase: "hold",
      setIndex: seg.setIndex,
    };
  }
  const from = doc.formations[seg.fromIndex]!;
  const to = doc.formations[seg.toIndex]!;
  const u = easeInOut((t - seg.start) / Math.max(0.001, seg.end - seg.start));
  const fromMap = posMap(from);
  const toMap = posMap(to);
  const ids = new Set([...fromMap.keys(), ...toMap.keys()]);
  const positions: ChoreographicPosition[] = [];
  for (const id of ids) {
    const a = fromMap.get(id);
    const b = toMap.get(id);
    if (a && b) {
      positions.push({
        dancerId: id,
        x: lerp(a.x, b.x, u),
        y: lerp(a.y, b.y, u),
        rotationDeg: lerp(a.rotationDeg ?? 0, b.rotationDeg ?? 0, u),
      });
    } else if (b) {
      positions.push({ ...b, x: lerp(50, b.x, u), y: lerp(20, b.y, u) });
    } else if (a) {
      positions.push({ ...a, x: lerp(a.x, 50, u), y: lerp(a.y, 20, u) });
    }
  }
  return {
    positions,
    setLabel: `${from.name} → ${to.name}`,
    phase: "transition",
    setIndex: seg.toIndex,
  };
}

function dancerLookup(doc: ChoreographicCompatDocument): Map<string, ChoreographicDancer> {
  return new Map(doc.crew.map((c) => [c.id, c]));
}

function centerDancerIds(positions: ChoreographicPosition[]): Set<string> {
  if (!positions.length) return new Set();
  const frontY = Math.max(...positions.map((p) => p.y));
  const front = positions.filter((p) => Math.abs(p.y - frontY) < 8).sort((a, b) => a.x - b.x);
  const band = front.length ? front : [...positions].sort((a, b) => a.x - b.x);
  const mid = Math.floor((band.length - 1) / 2);
  const out = new Set<string>([band[mid]!.dancerId]);
  if (band.length >= 4) out.add(band[mid + 1]?.dancerId ?? band[mid]!.dancerId);
  return out;
}

function renderFace(
  member: ChoreoPlayerIdol | null,
  name: string,
  asOfDate: string | null,
): string {
  const ph = attrQuotedUrl(avatarPlaceholderDataUrl(name));
  const portrait =
    member?.idol != null ? idolPortraitPublicSrc(member.idol, asOfDate) : null;
  if (portrait) {
    return `<img class="choreo-player-face-img" src="${htmlEsc(portrait)}" alt="" data-fallback="${ph}" />`;
  }
  return `<span class="choreo-player-face-initial">${htmlEsc(name.slice(0, 1))}</span>`;
}

export function createChoreoPlayerState(opts?: {
  doc?: ChoreographicCompatDocument | null;
  idols?: ChoreoPlayerIdol[];
  asOfDate?: string | null;
  sourceLabel?: string;
}): ChoreoPlayerState {
  const idolsByUid = new Map<string, ChoreoPlayerIdol>();
  for (const m of opts?.idols ?? []) idolsByUid.set(m.uid, m);
  return {
    doc: opts?.doc ?? null,
    idolsByUid,
    asOfDate: opts?.asOfDate ?? null,
    clockSec: 0,
    playing: false,
    statusMessage: opts?.doc ? "Loaded choreography." : "Load a choreographic JSON file to play.",
    sourceLabel: opts?.sourceLabel ?? "",
  };
}

export function renderChoreographyPlayer(state: ChoreoPlayerState): string {
  const doc = state.doc;
  if (!doc) {
    return `<div class="choreo-player" data-choreo-player>
      <header class="choreo-player-header">
        <div>
          <p class="choreo-player-eyebrow">Choreography player</p>
          <h1 class="choreo-player-title">No file loaded</h1>
        </div>
        <label class="fm-btn fm-btn-accent choreo-player-file-btn">Load JSON
          <input type="file" accept="application/json,.json" data-choreo-action="load-json" hidden />
        </label>
      </header>
      <p class="choreo-player-status">${htmlEsc(state.statusMessage)}</p>
      <p class="choreo-player-hint">Expects <code>idol-producer-choreographic-compat</code> format (multi-set timeline).</p>
      <p class="choreo-player-hint"><button type="button" class="fm-btn" data-choreo-action="load-sample">Load sample (可愛くてごめん)</button></p>
    </div>`;
  }

  const { totalSec } = buildTimeline(doc);
  const at = positionsAtClock(doc, state.clockSec);
  const centers = centerDancerIds(at.positions);
  const crewById = dancerLookup(doc);
  const placedIds = new Set(at.positions.map((p) => p.dancerId));

  const stageDots = stageDotsHtml(state, at.positions, centers, crewById);

  const roster = doc.crew
    .map((dancer) => {
      const idolUid = dancerIdolUid(dancer);
      const catalog = state.idolsByUid.get(idolUid);
      const name = catalog?.name ?? dancer.name;
      const color = catalog?.color ?? dancer.color;
      const onStage = placedIds.has(dancer.id);
      const isC = centers.has(dancer.id);
      return `<li class="choreo-player-member${onStage ? " is-onstage" : ""}${isC ? " is-center" : ""}" style="--idol-color:${htmlEsc(color)}">
        <span class="choreo-player-face">${renderFace(catalog ?? null, name, state.asOfDate)}</span>
        <span class="choreo-player-member-meta">
          <span class="choreo-player-member-name">${htmlEsc(name)}</span>
          <span class="choreo-player-member-sub">${htmlEsc(onStage ? (isC ? "On stage · C" : "On stage") : "Off")}</span>
        </span>
      </li>`;
    })
    .join("");

  const setChips = doc.formations
    .map((f, i) => {
      const active = at.phase === "hold" ? at.setIndex === i : at.setIndex === i;
      return `<button type="button" class="choreo-player-set-chip${active ? " is-active" : ""}" data-choreo-action="jump-set" data-set-index="${i}">${htmlEsc(f.name)}</button>`;
    })
    .join("");

  const pct = totalSec > 0 ? (state.clockSec % totalSec) / totalSec : 0;

  return `<div class="choreo-player" data-choreo-player>
    <header class="choreo-player-header">
      <div>
        <p class="choreo-player-eyebrow">Choreography player</p>
        <h1 class="choreo-player-title">${htmlEsc(doc.title)}</h1>
        <p class="choreo-player-meta">${htmlEsc(
          `${doc.formations.length} sets · ${doc.crew.length} dancers${state.sourceLabel ? ` · ${state.sourceLabel}` : ""}`,
        )}</p>
      </div>
      <div class="choreo-player-header-actions">
        <label class="fm-btn choreo-player-file-btn">Load JSON
          <input type="file" accept="application/json,.json" data-choreo-action="load-json" hidden />
        </label>
      </div>
    </header>

    <div class="choreo-player-body">
      <aside class="choreo-player-roster">
        <h2 class="choreo-player-side-title">Members</h2>
        <ul class="choreo-player-member-list">${roster}</ul>
      </aside>

      <section class="choreo-player-stage-wrap">
        <div class="choreo-player-stage" data-choreo-stage>
          <div class="choreo-player-audience" aria-hidden="true">AUDIENCE</div>
          <div class="choreo-player-upstage" aria-hidden="true">UPSTAGE</div>
          <div class="choreo-player-formation">${stageDots}</div>
        </div>
        <p class="choreo-player-now">${htmlEsc(`${at.setLabel} · ${at.phase}`)}</p>
      </section>
    </div>

    <footer class="choreo-player-transport">
      <div class="choreo-player-set-row">${setChips}</div>
      <div class="choreo-player-controls">
        <button type="button" class="fm-btn" data-choreo-action="prev">Prev</button>
        <button type="button" class="fm-btn fm-btn-accent" data-choreo-action="toggle-play">${htmlEsc(
          state.playing ? "Pause" : "Play",
        )}</button>
        <button type="button" class="fm-btn" data-choreo-action="next">Next</button>
        <input type="range" class="choreo-player-scrub" min="0" max="1000" value="${Math.round(pct * 1000)}" data-choreo-action="scrub" />
        <span class="choreo-player-time">${htmlEsc(
          `${(state.clockSec % totalSec).toFixed(1)}s / ${totalSec.toFixed(1)}s`,
        )}</span>
      </div>
      <p class="choreo-player-status">${htmlEsc(state.statusMessage)}</p>
    </footer>
  </div>`;
}

function setStartClock(doc: ChoreographicCompatDocument, setIndex: number): number {
  const { segments } = buildTimeline(doc);
  const hold = segments.find((s) => s.kind === "hold" && s.setIndex === setIndex);
  return hold?.start ?? 0;
}

function stageDotsHtml(
  state: ChoreoPlayerState,
  positions: ChoreographicPosition[],
  centers: Set<string>,
  crewById: Map<string, ChoreographicDancer>,
): string {
  return positions
    .map((p) => {
      const dancer = crewById.get(p.dancerId);
      const idolUid = dancer ? dancerIdolUid(dancer) : p.dancerId;
      const catalog = state.idolsByUid.get(idolUid);
      const name = catalog?.name ?? dancer?.name ?? p.dancerId;
      const color = catalog?.color ?? dancer?.color ?? "#94a3b8";
      const isC = centers.has(p.dancerId);
      return `<div class="choreo-player-dot${isC ? " is-center" : ""}" style="left:${p.x}%;top:${p.y}%;--idol-color:${htmlEsc(color)}" title="${htmlEsc(name)}">
        <span class="choreo-player-face">${renderFace(catalog ?? null, name, state.asOfDate)}</span>
        ${isC ? `<span class="choreo-player-c">C</span>` : ""}
      </div>`;
    })
    .join("");
}

/** Lightweight frame update during playback (avoids full rebind). */
export function patchChoreoPlayerFrame(root: ParentNode, state: ChoreoPlayerState): void {
  const doc = state.doc;
  if (!doc) return;
  const { totalSec } = buildTimeline(doc);
  const at = positionsAtClock(doc, state.clockSec);
  const centers = centerDancerIds(at.positions);
  const crewById = dancerLookup(doc);
  const formation = root.querySelector(".choreo-player-formation");
  if (formation) formation.innerHTML = stageDotsHtml(state, at.positions, centers, crewById);
  const now = root.querySelector(".choreo-player-now");
  if (now) now.textContent = `${at.setLabel} · ${at.phase}`;
  const time = root.querySelector(".choreo-player-time");
  if (time) time.textContent = `${(state.clockSec % totalSec).toFixed(1)}s / ${totalSec.toFixed(1)}s`;
  const scrub = root.querySelector<HTMLInputElement>(".choreo-player-scrub");
  if (scrub && document.activeElement !== scrub) {
    scrub.value = String(Math.round(((state.clockSec % totalSec) / totalSec) * 1000));
  }
  const status = root.querySelector(".choreo-player-status");
  if (status) status.textContent = state.statusMessage;
  root.querySelectorAll<HTMLElement>(".choreo-player-set-chip").forEach((chip) => {
    const idx = Number(chip.getAttribute("data-set-index"));
    chip.classList.toggle("is-active", idx === at.setIndex);
  });
  const placedIds = new Set(at.positions.map((p) => p.dancerId));
  root.querySelectorAll<HTMLElement>(".choreo-player-member").forEach((li, i) => {
    const dancer = doc.crew[i];
    if (!dancer) return;
    const onStage = placedIds.has(dancer.id);
    const isC = centers.has(dancer.id);
    li.classList.toggle("is-onstage", onStage);
    li.classList.toggle("is-center", isC);
    const sub = li.querySelector(".choreo-player-member-sub");
    if (sub) sub.textContent = onStage ? (isC ? "On stage · C" : "On stage") : "Off";
  });
  root.querySelectorAll<HTMLImageElement>("img.choreo-player-face-img").forEach((img) => {
    const fb = img.dataset.fallback;
    if (!fb || img.dataset.fbBound) return;
    img.dataset.fbBound = "1";
    img.addEventListener(
      "error",
      () => {
        if (img.src !== fb) img.src = fb;
      },
      { once: true },
    );
  });
}

/** Wire load / transport controls. Playback RAF lives in the host app. */
export function bindChoreographyPlayer(
  root: ParentNode,
  getState: () => ChoreoPlayerState,
  callbacks: ChoreoPlayerCallbacks,
): { destroy: () => void } {
  const emit = (next: ChoreoPlayerState) => callbacks.onChange(next);
  const abort = new AbortController();
  const { signal } = abort;

  root.querySelectorAll<HTMLImageElement>("img.choreo-player-face-img").forEach((img) => {
    const fb = img.dataset.fallback;
    if (!fb) return;
    img.addEventListener(
      "error",
      () => {
        if (img.src !== fb) img.src = fb;
      },
      { once: true, signal },
    );
  });

  root.querySelectorAll<HTMLElement>("[data-choreo-action]").forEach((el) => {
    const action = el.getAttribute("data-choreo-action");
    if (action === "load-json" && el instanceof HTMLInputElement) {
      el.addEventListener(
        "change",
        async () => {
          const state = getState();
          const file = el.files?.[0];
          if (!file) return;
          try {
            const json = JSON.parse(await file.text()) as unknown;
            const doc = parseChoreographicCompat(json);
            if (!doc) {
              emit({ ...state, playing: false, statusMessage: "Unrecognized choreographic JSON." });
              return;
            }
            emit({
              ...state,
              doc,
              clockSec: 0,
              playing: false,
              sourceLabel: file.name,
              statusMessage: `Loaded ${doc.formations.length} set(s).`,
            });
          } catch {
            emit({ ...state, playing: false, statusMessage: "Failed to parse JSON." });
          }
        },
        { signal },
      );
      return;
    }
    if (action === "scrub" && el instanceof HTMLInputElement) {
      el.addEventListener(
        "input",
        () => {
          const state = getState();
          if (!state.doc) return;
          const { totalSec } = buildTimeline(state.doc);
          const u = Number(el.value) / 1000;
          emit({
            ...state,
            playing: false,
            clockSec: u * totalSec,
            statusMessage: "Scrubbed.",
          });
        },
        { signal },
      );
      return;
    }
    el.addEventListener(
      "click",
      () => {
        const state = getState();
        if (action === "load-sample") {
          void (async () => {
            try {
              const url = new URL(
                "data/choreography/takane_kawaikute_gomen_sample.json",
                document.baseURI,
              ).href;
              const res = await fetch(url);
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              const doc = parseChoreographicCompat(await res.json());
              if (!doc) {
                emit({ ...state, statusMessage: "Sample JSON is not choreographic-compat." });
                return;
              }
              emit({
                ...state,
                doc,
                clockSec: 0,
                playing: false,
                sourceLabel: "takane_kawaikute_gomen_sample.json",
                statusMessage: `Loaded sample · ${doc.formations.length} set(s).`,
              });
            } catch (err) {
              emit({
                ...state,
                statusMessage: `Could not load sample: ${err instanceof Error ? err.message : "error"}`,
              });
            }
          })();
          return;
        }
        if (!state.doc && action !== "load-json") return;
        if (action === "toggle-play") {
          emit({
            ...state,
            playing: !state.playing,
            statusMessage: !state.playing ? "Playing…" : "Paused.",
          });
        } else if (action === "prev" && state.doc) {
          const { segments } = buildTimeline(state.doc);
          const t = state.clockSec;
          const holds = segments.filter(
            (s): s is Extract<TimelineSegment, { kind: "hold" }> => s.kind === "hold",
          );
          const cur = holds.findIndex((h) => t >= h.start && t < h.end);
          const prev = holds[Math.max(0, (cur < 0 ? 0 : cur) - 1)];
          emit({
            ...state,
            playing: false,
            clockSec: prev?.start ?? 0,
            statusMessage: prev
              ? `Jumped to ${state.doc.formations[prev.setIndex]?.name}`
              : "Start.",
          });
        } else if (action === "next" && state.doc) {
          const { segments } = buildTimeline(state.doc);
          const t = state.clockSec;
          const holds = segments.filter(
            (s): s is Extract<TimelineSegment, { kind: "hold" }> => s.kind === "hold",
          );
          const cur = holds.findIndex((h) => t >= h.start && t < h.end);
          const next = holds[Math.min(holds.length - 1, (cur < 0 ? -1 : cur) + 1)];
          emit({
            ...state,
            playing: false,
            clockSec: next?.start ?? t,
            statusMessage: next
              ? `Jumped to ${state.doc.formations[next.setIndex]?.name}`
              : "End.",
          });
        } else if (action === "jump-set" && state.doc) {
          const idx = Number(el.getAttribute("data-set-index"));
          if (!Number.isFinite(idx)) return;
          emit({
            ...state,
            playing: false,
            clockSec: setStartClock(state.doc, idx),
            statusMessage: `Jumped to ${state.doc.formations[idx]?.name ?? idx}.`,
          });
        }
      },
      { signal },
    );
  });

  return {
    destroy: () => abort.abort(),
  };
}
