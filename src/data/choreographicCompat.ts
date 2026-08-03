/**
 * Choreographic-compatible interchange format.
 *
 * Inspired by https://www.choreographic.app/ concepts:
 * free stage positions, multi-formation timeline, transition durations,
 * crew colors, formation notes, audience-oriented stage.
 *
 * Native proprietary Choreographic share packages are not publicly documented;
 * this JSON is our stable bridge. Heuristic import also accepts loose JSON
 * shaped like { dancers/crew, formations:[{ positions }] }.
 */

import {
  assignIdolToSlot,
  emptyFormation,
  formationSlots,
  nearestSlotIndex,
  type SongStartingFormation,
} from "./songStartingFormation";

export const CHOREOGRAPHIC_COMPAT_FORMAT = "idol-producer-choreographic-compat" as const;
export const CHOREOGRAPHIC_COMPAT_VERSION = "0.1" as const;

export type AudienceAt = "bottom" | "top";

export interface ChoreographicStage {
  /** Stage width in meters (informational). */
  widthMeters: number;
  /** Stage depth in meters (informational). */
  depthMeters: number;
  /**
   * Where the audience sits in the 2D editor.
   * Choreographic convention: audience at bottom → y increases toward audience (downstage).
   * Our Live Mode uses the same: higher y = closer to camera/audience.
   */
  audienceAt: AudienceAt;
  sideStageMeters?: number;
  backStageMeters?: number;
}

export interface ChoreographicDancer {
  id: string;
  name: string;
  color: string;
  /** Optional link into idol catalog. */
  idolUid?: string | null;
}

export interface ChoreographicPosition {
  dancerId: string;
  /** 0–100, stage-left → stage-right from audience view. */
  x: number;
  /** 0–100; with audienceAt=bottom, 0=upstage (back), 100=downstage (front). */
  y: number;
  /** Facing degrees; 0 = toward audience. */
  rotationDeg?: number;
}

export interface ChoreographicFormationFrame {
  id: string;
  name: string;
  /** Hold time on this set. */
  durationSec: number;
  /** Travel time into this formation from the previous one. */
  transitionInSec: number;
  notes?: string | null;
  positions: ChoreographicPosition[];
}

export interface ChoreographicCompatDocument {
  format: typeof CHOREOGRAPHIC_COMPAT_FORMAT;
  formatVersion: typeof CHOREOGRAPHIC_COMPAT_VERSION;
  title: string;
  songUid?: string | null;
  groupUid?: string | null;
  stage: ChoreographicStage;
  crew: ChoreographicDancer[];
  formations: ChoreographicFormationFrame[];
  /** Index of the starting/opening formation (default 0). */
  startingFormationIndex?: number;
  updatedAt?: string | null;
  sourceApp?: string | null;
}

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.max(0, Math.min(100, n));
}

function num(v: unknown, fallback: number): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function str(v: unknown, fallback = ""): string {
  return v == null ? fallback : String(v).trim() || fallback;
}

export function defaultChoreographicStage(): ChoreographicStage {
  return {
    widthMeters: 12,
    depthMeters: 8,
    audienceAt: "bottom",
    sideStageMeters: 2,
    backStageMeters: 1.5,
  };
}

export function emptyChoreographicDocument(opts: {
  title: string;
  songUid?: string | null;
  groupUid?: string | null;
  crew: ChoreographicDancer[];
}): ChoreographicCompatDocument {
  const slots = formationSlots(Math.max(1, opts.crew.length));
  const positions: ChoreographicPosition[] = opts.crew.map((d, i) => {
    const s = slots[i] ?? { x: 50, y: 50 };
    return { dancerId: d.id, x: s.x, y: s.y, rotationDeg: 0 };
  });
  return {
    format: CHOREOGRAPHIC_COMPAT_FORMAT,
    formatVersion: CHOREOGRAPHIC_COMPAT_VERSION,
    title: opts.title,
    songUid: opts.songUid ?? null,
    groupUid: opts.groupUid ?? null,
    stage: defaultChoreographicStage(),
    crew: opts.crew,
    formations: [
      {
        id: "formation-1",
        name: "Opening",
        durationSec: 8,
        transitionInSec: 0,
        notes: null,
        positions,
      },
    ],
    startingFormationIndex: 0,
    updatedAt: new Date().toISOString(),
    sourceApp: "idol-producer-web",
  };
}

function parsePosition(raw: unknown): ChoreographicPosition | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const dancerId = str(row.dancerId ?? row.dancer_id ?? row.id ?? row.uid);
  if (!dancerId) return null;
  // Accept 0–1 normalized coords too
  let x = num(row.x ?? row.posX ?? row.left, NaN);
  let y = num(row.y ?? row.posY ?? row.top, NaN);
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  if (x >= 0 && x <= 1 && y >= 0 && y <= 1) {
    x *= 100;
    y *= 100;
  }
  return {
    dancerId,
    x: clamp01to100(x),
    y: clamp01to100(y),
    rotationDeg: row.rotationDeg == null && row.rotation == null ? 0 : num(row.rotationDeg ?? row.rotation, 0),
  };
}

function parseFormationFrame(raw: unknown, index: number): ChoreographicFormationFrame | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const positionsRaw = Array.isArray(row.positions)
    ? row.positions
    : Array.isArray(row.dancers)
      ? row.dancers
      : Array.isArray(row.placements)
        ? row.placements
        : null;
  if (!positionsRaw) return null;
  const positions = positionsRaw.map(parsePosition).filter((p): p is ChoreographicPosition => !!p);
  if (!positions.length) return null;
  return {
    id: str(row.id, `formation-${index + 1}`),
    name: str(row.name ?? row.title, `Formation ${index + 1}`),
    durationSec: Math.max(0, num(row.durationSec ?? row.duration ?? row.holdSeconds, 8)),
    transitionInSec: Math.max(0, num(row.transitionInSec ?? row.transitionSec ?? row.transition, index === 0 ? 0 : 4)),
    notes: row.notes == null ? null : str(row.notes),
    positions,
  };
}

function parseCrew(raw: unknown): ChoreographicDancer[] {
  if (!Array.isArray(raw)) return [];
  const out: ChoreographicDancer[] = [];
  raw.forEach((item, i) => {
    if (!item || typeof item !== "object") return;
    const row = item as Record<string, unknown>;
    const id = str(row.id ?? row.uid ?? row.dancerId, `dancer-${i + 1}`);
    const name = str(row.name ?? row.displayName, id);
    const color = str(row.color ?? row.color_code, "#94a3b8");
    const idolUid = row.idolUid == null && row.idol_uid == null ? null : str(row.idolUid ?? row.idol_uid);
    out.push({ id, name, color, idolUid });
  });
  return out;
}

/** Normalize a known compat doc or heuristically parse Choreographic-like JSON. */
export function parseChoreographicCompat(raw: unknown): ChoreographicCompatDocument | null {
  if (!raw || typeof raw !== "object") return null;
  const root = raw as Record<string, unknown>;

  // Wrapped: { choreography: {...} } or { data: {...} }
  const candidate =
    root.format === CHOREOGRAPHIC_COMPAT_FORMAT
      ? root
      : root.choreography && typeof root.choreography === "object"
        ? (root.choreography as Record<string, unknown>)
        : root.data && typeof root.data === "object"
          ? (root.data as Record<string, unknown>)
          : root;

  const formationsRaw = Array.isArray(candidate.formations)
    ? candidate.formations
    : Array.isArray(candidate.sets)
      ? candidate.sets
      : Array.isArray(candidate.scenes)
        ? candidate.scenes
        : null;
  if (!formationsRaw?.length) return null;

  const formations = formationsRaw
    .map((f, i) => parseFormationFrame(f, i))
    .filter((f): f is ChoreographicFormationFrame => !!f);
  if (!formations.length) return null;

  let crew = parseCrew(candidate.crew ?? candidate.dancers ?? candidate.members);
  if (!crew.length) {
    const ids = new Map<string, ChoreographicDancer>();
    for (const frame of formations) {
      for (const p of frame.positions) {
        if (!ids.has(p.dancerId)) {
          ids.set(p.dancerId, {
            id: p.dancerId,
            name: p.dancerId,
            color: "#94a3b8",
            idolUid: p.dancerId,
          });
        }
      }
    }
    crew = [...ids.values()];
  }

  const stageRaw =
    candidate.stage && typeof candidate.stage === "object"
      ? (candidate.stage as Record<string, unknown>)
      : {};
  const audienceAt: AudienceAt = str(stageRaw.audienceAt ?? stageRaw.audience_at, "bottom") === "top" ? "top" : "bottom";

  // If source uses audience-at-top / upstage-down coords, flip Y into our convention.
  const needsFlip =
    audienceAt === "top" ||
    str(stageRaw.yAxis ?? stageRaw.y_axis) === "downstage_zero" ||
    candidate.audienceAt === "top";
  const normalizedFormations = needsFlip
    ? formations.map((f) => ({
        ...f,
        positions: f.positions.map((p) => ({ ...p, y: 100 - p.y })),
      }))
    : formations;

  return {
    format: CHOREOGRAPHIC_COMPAT_FORMAT,
    formatVersion: CHOREOGRAPHIC_COMPAT_VERSION,
    title: str(candidate.title ?? candidate.name, "Untitled choreography"),
    songUid: candidate.songUid == null && candidate.song_uid == null ? null : str(candidate.songUid ?? candidate.song_uid),
    groupUid: candidate.groupUid == null && candidate.group_uid == null ? null : str(candidate.groupUid ?? candidate.group_uid),
    stage: {
      widthMeters: num(stageRaw.widthMeters ?? stageRaw.width, 12),
      depthMeters: num(stageRaw.depthMeters ?? stageRaw.depth, 8),
      audienceAt: "bottom",
      sideStageMeters: num(stageRaw.sideStageMeters ?? stageRaw.side, 2),
      backStageMeters: num(stageRaw.backStageMeters ?? stageRaw.back, 1.5),
    },
    crew,
    formations: normalizedFormations,
    startingFormationIndex: Math.max(0, Math.min(normalizedFormations.length - 1, Math.floor(num(candidate.startingFormationIndex, 0)))),
    updatedAt: candidate.updatedAt == null ? new Date().toISOString() : str(candidate.updatedAt),
    sourceApp: str(candidate.sourceApp ?? candidate.source, "imported"),
  };
}

export function startingFrame(doc: ChoreographicCompatDocument): ChoreographicFormationFrame {
  const idx = Math.max(0, Math.min(doc.formations.length - 1, doc.startingFormationIndex ?? 0));
  return doc.formations[idx]!;
}

/** Resolve dancer → idol uid (explicit link, else id match). */
export function dancerIdolUid(dancer: ChoreographicDancer): string {
  return str(dancer.idolUid) || dancer.id;
}

/**
 * Convert opening formation into game starting formation:
 * continuous positions + slot snap for Live Mode trapezoid.
 */
export function choreographicDocToSongStartingFormation(
  doc: ChoreographicCompatDocument,
  opts?: { songUid?: string; memberCount?: number },
): SongStartingFormation {
  const frame = startingFrame(doc);
  const songUid = str(opts?.songUid ?? doc.songUid, "unknown-song");
  const crewById = new Map(doc.crew.map((c) => [c.id, c] as const));
  const positions = frame.positions.map((p) => {
    const dancer = crewById.get(p.dancerId);
    const idolUid = dancer ? dancerIdolUid(dancer) : p.dancerId;
    return { idolUid, x: p.x, y: p.y };
  });
  const memberCount = Math.max(opts?.memberCount ?? positions.length, positions.length, 1);
  let formation = emptyFormation({
    songUid,
    memberCount,
    groupUid: doc.groupUid,
    source: "imported",
  });
  formation = {
    ...formation,
    notes: frame.notes ?? null,
    positions,
    choreography: doc,
  };
  const used = new Set<number>();
  const ranked = [...positions].sort((a, b) => a.x - b.x || a.y - b.y);
  for (const p of ranked) {
    const slot = nearestSlotIndex(p.x, p.y, memberCount, used, formation.rowCount);
    if (slot < 0) continue;
    used.add(slot);
    formation = assignIdolToSlot(formation, slot, p.idolUid);
  }
  // Keep continuous choreography positions (assignIdolToSlot seeds template coords).
  return {
    ...formation,
    positions,
    choreography: doc,
    source: "imported",
    updatedAt: new Date().toISOString(),
  };
}

export function songStartingFormationToChoreographicDoc(
  formation: SongStartingFormation,
  opts: {
    title: string;
    members: Array<{ uid: string; name: string; color: string }>;
  },
): ChoreographicCompatDocument {
  if (formation.choreography?.format === CHOREOGRAPHIC_COMPAT_FORMAT) {
    return {
      ...formation.choreography,
      songUid: formation.songUid,
      groupUid: formation.groupUid ?? formation.choreography.groupUid,
      title: opts.title || formation.choreography.title,
      updatedAt: new Date().toISOString(),
    };
  }

  const crew: ChoreographicDancer[] = opts.members.map((m) => ({
    id: m.uid,
    name: m.name,
    color: m.color,
    idolUid: m.uid,
  }));

  const slots = formationSlots(formation.memberCount, formation.rowCount);
  const fromSlots: ChoreographicPosition[] = [];
  formation.slotIdolUids.forEach((uid, i) => {
    if (!uid) return;
    const s = slots[i] ?? { x: 50, y: 50 };
    fromSlots.push({ dancerId: uid, x: s.x, y: s.y, rotationDeg: 0 });
  });

  const fromPositions: ChoreographicPosition[] = (formation.positions ?? []).map((p) => ({
    dancerId: p.idolUid,
    x: p.x,
    y: p.y,
    rotationDeg: 0,
  }));

  const positions = fromPositions.length ? fromPositions : fromSlots;

  return {
    format: CHOREOGRAPHIC_COMPAT_FORMAT,
    formatVersion: CHOREOGRAPHIC_COMPAT_VERSION,
    title: opts.title,
    songUid: formation.songUid,
    groupUid: formation.groupUid ?? null,
    stage: defaultChoreographicStage(),
    crew,
    formations: [
      {
        id: "formation-1",
        name: "Opening",
        durationSec: 8,
        transitionInSec: 0,
        notes: formation.notes ?? null,
        positions,
      },
    ],
    startingFormationIndex: 0,
    updatedAt: new Date().toISOString(),
    sourceApp: "idol-producer-web",
  };
}

export function updateFramePosition(
  doc: ChoreographicCompatDocument,
  frameIndex: number,
  dancerId: string,
  x: number,
  y: number,
): ChoreographicCompatDocument {
  const formations = doc.formations.map((f, i) => {
    if (i !== frameIndex) return f;
    const others = f.positions.filter((p) => p.dancerId !== dancerId);
    return {
      ...f,
      positions: [...others, { dancerId, x: clamp01to100(x), y: clamp01to100(y), rotationDeg: 0 }],
    };
  });
  return { ...doc, formations, updatedAt: new Date().toISOString() };
}

export function addFormationFrame(
  doc: ChoreographicCompatDocument,
  duplicateFromIndex?: number,
): ChoreographicCompatDocument {
  const src = doc.formations[duplicateFromIndex ?? doc.formations.length - 1];
  const next: ChoreographicFormationFrame = {
    id: `formation-${doc.formations.length + 1}`,
    name: `Formation ${doc.formations.length + 1}`,
    durationSec: src?.durationSec ?? 8,
    transitionInSec: 4,
    notes: null,
    positions: src ? src.positions.map((p) => ({ ...p })) : [],
  };
  return {
    ...doc,
    formations: [...doc.formations, next],
    updatedAt: new Date().toISOString(),
  };
}
