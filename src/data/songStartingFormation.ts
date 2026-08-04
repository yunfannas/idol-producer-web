/**
 * Per-song starting formations — shared by Live Mode, in-game editor, and video eval.
 * Slot geometry is a row-based trapezoid (audience at bottom). Row count is editable.
 */

import type { ChoreographicCompatDocument } from "./choreographicCompat";

export type FormationRow = "front" | "back" | "mid";
export type FormationSource = "manual" | "video_seed" | "imported" | "default_center";
export type FormationCenterMode = "single" | "double";
/** Starting layout template; after apply, positions stay freely editable. */
export type FormationLayoutKind =
  | "rows"
  | "column"
  | "columns"
  | "crane_out"
  | "crane_in"
  | "pyramid"
  | "surround";

export interface FormationSlotDef {
  x: number;
  y: number;
  row: FormationRow;
  /** 0 = upstage/back, higher = closer to audience. */
  rowIndex: number;
  /** True when this slot is a designated center seat under the active center mode. */
  isCenter?: boolean;
}

export interface SongStartingFormation {
  schemaVersion: "0.1";
  songUid: string;
  groupUid?: string | null;
  layoutId: string;
  memberCount: number;
  /**
   * How many stage rows to use for row-kind templates (1–3 normally; up to 5 when memberCount ≥ 10).
   * Presets seed geometry once; free positions remain authoritative afterward.
   */
  rowCount?: number;
  /** Starting template kind (rows / columns / crane wing). */
  layoutKind?: FormationLayoutKind | null;
  /** Preset id from typicalFormationPresets (e.g. classic-r2-c1 / crane-out). */
  presetId?: string | null;
  /** Length = memberCount; null = empty. Index = position number: 0 = center, then outward. */
  slotIdolUids: Array<string | null>;
  /**
   * Center seating mode (single vs twin). Prefer `centerIdolUids` for who is C;
   * mode follows that list length when centers are toggled on the stage.
   */
  centerMode?: FormationCenterMode;
  /** Explicit center idol uids (0–2). Double-click on stage sets/unsets these. */
  centerIdolUids?: string[] | null;
  /** Ideal full-roster slots when some members are temporarily unavailable. */
  fullSlotIdolUids?: Array<string | null> | null;
  /** True when current slots are a reduced temporary lineup (hiatus/suspension). */
  isTemporary?: boolean;
  unavailableIdolUids?: string[];
  source: FormationSource;
  effectiveFrom?: string | null;
  notes?: string | null;
  /** Continuous stage positions (Choreographic-compatible 0–100). Preferred for Live Mode when present. */
  positions?: Array<{ idolUid: string; x: number; y: number }>;
  /** Full multi-formation choreography document when authored/imported. */
  choreography?: ChoreographicCompatDocument | null;
  /** Optional click marks from video extract (normalized 0–100). */
  videoMarks?: Array<{
    idolUid: string;
    x: number;
    y: number;
    frameSeconds?: number;
  }>;
  updatedAt?: string | null;
}

export type TypicalFormationPreset = {
  id: string;
  labelEn: string;
  labelZh: string;
  kind: FormationLayoutKind;
  /** Meaningful for kind === "rows"; otherwise a display/fallback row estimate. */
  rowCount: number;
  centerMode: FormationCenterMode;
};

export function resolveLayoutKind(raw: unknown): FormationLayoutKind {
  const s = String(raw ?? "").trim();
  if (
    s === "column" ||
    s === "columns" ||
    s === "crane_out" ||
    s === "crane_in" ||
    s === "pyramid" ||
    s === "surround"
  ) {
    return s;
  }
  return "rows";
}

/**
 * Default center mode for a start layout.
 * Even roster → double C for 2-row, 2-column, V out/in; surround-c2 is always double.
 * Everything else → single C.
 */
export function defaultCenterModeForLayout(
  kind: FormationLayoutKind,
  rowCount: number,
  memberCount: number,
  opts?: { surroundCenters?: FormationCenterMode },
): FormationCenterMode {
  const n = Math.max(0, Math.floor(memberCount));
  const resolved = resolveLayoutKind(kind);
  if (resolved === "surround") {
    return resolveCenterMode(opts?.surroundCenters ?? "single");
  }
  if (n >= 2 && n % 2 === 0) {
    if (resolved === "columns" || resolved === "crane_out" || resolved === "crane_in") return "double";
    if (resolved === "rows" && Math.floor(rowCount) === 2) return "double";
  }
  return "single";
}

/** Curated typical layouts for a roster size (startpoints — not locked geometry). */
export function typicalFormationPresets(memberCount: number): TypicalFormationPreset[] {
  const n = Math.max(1, Math.floor(memberCount));
  const out: TypicalFormationPreset[] = [];
  const add = (preset: TypicalFormationPreset) => {
    if (out.some((p) => p.id === preset.id)) return;
    if (preset.kind === "rows" && (preset.rowCount < 1 || preset.rowCount > maxFormationRowCount(n))) return;
    out.push(preset);
  };

  const classicRows = defaultFormationRowCount(n);
  // Flat 2-row is the managed-group default (even → double C, odd → single C).
  if (n >= 2) {
    add({
      id: "flat-r2-c1",
      labelEn: "Flat 2-row",
      labelZh: "双排",
      kind: "rows",
      rowCount: 2,
      centerMode: defaultCenterModeForLayout("rows", 2, n),
    });
  }
  // Classic N-row when it differs from the flat 2-row default.
  if (classicRows !== 2) {
    add({
      id: `classic-r${classicRows}-c1`,
      labelEn: `Classic ${classicRows}-row`,
      labelZh: `经典 ${classicRows} 排`,
      kind: "rows",
      rowCount: classicRows,
      centerMode: defaultCenterModeForLayout("rows", classicRows, n),
    });
  }

  if (n >= 3 && classicRows !== 1) {
    add({
      id: "line-r1-c1",
      labelEn: "Single line",
      labelZh: "一横排",
      kind: "rows",
      rowCount: 1,
      centerMode: "single",
    });
  }
  // Extra classic 3-row only when default classic is not already 3 (avoids duplicating deep/classic).
  if (n >= 6 && classicRows !== 3) {
    add({
      id: "classic-r3-c1",
      labelEn: "Classic 3-row",
      labelZh: "经典 3 排",
      kind: "rows",
      rowCount: 3,
      centerMode: "single",
    });
  }
  if (n >= 3) {
    add({
      id: "cols-1-c1",
      labelEn: "Single column",
      labelZh: "一纵列",
      kind: "column",
      rowCount: Math.min(maxFormationRowCount(n), n),
      centerMode: "single",
    });
  }
  if (n >= 4) {
    add({
      id: "cols-2-c1",
      labelEn: "2 columns",
      labelZh: "两列",
      kind: "columns",
      rowCount: Math.min(maxFormationRowCount(n), Math.ceil(n / 2)),
      centerMode: defaultCenterModeForLayout("columns", 2, n),
    });
  }
  if (n >= 5) {
    add({
      id: "crane-out-c1",
      labelEn: "V out",
      labelZh: "外V",
      kind: "crane_out",
      rowCount: 3,
      centerMode: defaultCenterModeForLayout("crane_out", 3, n),
    });
    add({
      id: "crane-in-c1",
      labelEn: "V in",
      labelZh: "内V",
      kind: "crane_in",
      rowCount: 3,
      centerMode: defaultCenterModeForLayout("crane_in", 3, n),
    });
  }
  if (n >= 6) {
    add({
      id: "pyramid-c1",
      labelEn: "Pyramid",
      labelZh: "金字塔",
      kind: "pyramid",
      rowCount: Math.min(maxFormationRowCount(n), Math.ceil((-1 + Math.sqrt(1 + 8 * n)) / 2)),
      centerMode: "single",
    });
  }
  if (n >= 5) {
    add({
      id: "surround-c1",
      labelEn: "Single C surrounded",
      labelZh: "单中心包围",
      kind: "surround",
      rowCount: 3,
      centerMode: "single",
    });
  }
  if (n >= 6) {
    add({
      id: "surround-c2",
      labelEn: "Double C surrounded",
      labelZh: "双中心包围",
      kind: "surround",
      rowCount: 3,
      centerMode: "double",
    });
  }
  if (n >= 10) {
    add({
      id: "wide-r4-c1",
      labelEn: "Wide 4-row",
      labelZh: "四排",
      kind: "rows",
      rowCount: 4,
      centerMode: "single",
    });
  }
  if (n >= 12) {
    add({
      id: "wide-r5-c1",
      labelEn: "Deep 5-row",
      labelZh: "五排",
      kind: "rows",
      rowCount: 5,
      centerMode: "single",
    });
  }
  return out;
}

export function resolveTypicalPreset(
  memberCount: number,
  presetId?: string | null,
): TypicalFormationPreset {
  const presets = typicalFormationPresets(memberCount);
  const found = presets.find((p) => p.id === String(presetId ?? "").trim());
  return found ?? presets[0]!;
}

/**
 * Default start layout for the managed/playing group:
 * 2-row trapezoid; even roster → double C, odd → single C.
 */
export function defaultManagedCenterMode(memberCount: number): FormationCenterMode {
  const n = Math.max(0, Math.floor(memberCount));
  return n >= 2 && n % 2 === 0 ? "double" : "single";
}

export function defaultManagedRowCount(memberCount: number): number {
  const n = Math.max(1, Math.floor(memberCount));
  if (n <= 1) return 1;
  return Math.min(2, maxFormationRowCount(n));
}

/**
 * Order items into center-outward slots: higher score usually gets a better index (#0 first),
 * but additive noise keeps the lineup from being fixed.
 */
export function orderByScoreWithNoise<T>(
  items: readonly T[],
  scoreOf: (item: T) => number,
  opts?: { noiseRatio?: number; rng?: () => number },
): T[] {
  if (items.length <= 1) return [...items];
  const rng = opts?.rng ?? Math.random;
  const noiseRatio = opts?.noiseRatio ?? 0.3;
  const scored = items.map((item) => ({ item, score: Number(scoreOf(item)) || 0 }));
  let min = Infinity;
  let max = -Infinity;
  for (const row of scored) {
    if (row.score < min) min = row.score;
    if (row.score > max) max = row.score;
  }
  const spread = Math.max(10, max - min);
  const noiseAmp = spread * Math.max(0, noiseRatio);
  return scored
    .map((row) => ({
      item: row.item,
      key: row.score + (rng() * 2 - 1) * noiseAmp,
      tie: rng(),
    }))
    .sort((a, b) => b.key - a.key || a.tie - b.tie)
    .map((row) => row.item);
}

/** Build a filled default formation (center-outward slots; caller should pass score-ordered uids). */
export function buildDefaultManagedFormation(opts: {
  songUid: string;
  groupUid?: string | null;
  memberUids: string[];
  source?: FormationSource;
}): SongStartingFormation {
  const uids = opts.memberUids.map((u) => String(u ?? "").trim()).filter(Boolean);
  const n = Math.max(1, uids.length || 1);
  const rowCount = defaultManagedRowCount(n);
  const centerMode = defaultManagedCenterMode(n);
  const slots = formationSlotsForLayout(n, "rows", rowCount, centerMode);
  const slotIdolUids: Array<string | null> = Array.from({ length: n }, (_, i) => uids[i] ?? null);
  const positions = slotIdolUids
    .map((uid, i) => {
      if (!uid) return null;
      const s = slots[i];
      return s ? { idolUid: uid, x: s.x, y: s.y } : null;
    })
    .filter((p): p is { idolUid: string; x: number; y: number } => Boolean(p));
  const presetId = rowCount === 2 ? "flat-r2-c1" : `classic-r${rowCount}-c1`;
  return {
    schemaVersion: "0.1",
    songUid: opts.songUid,
    groupUid: opts.groupUid ?? null,
    layoutId: layoutIdForCount(n, rowCount, "rows"),
    memberCount: n,
    rowCount,
    layoutKind: "rows",
    presetId,
    slotIdolUids,
    centerMode,
    centerIdolUids: centerIdolUidsFromSlots(slotIdolUids, centerMode, n),
    fullSlotIdolUids: null,
    isTemporary: false,
    unavailableIdolUids: [],
    source: opts.source ?? "default_center",
    positions,
    updatedAt: new Date().toISOString(),
  };
}

export function applyTypicalPreset(
  formation: SongStartingFormation,
  presetId: string,
  overrides?: { centerMode?: FormationCenterMode },
): SongStartingFormation {
  const preset = resolveTypicalPreset(formation.memberCount, presetId);
  const n = formation.memberCount;
  // Applying a start layout uses that layout's default center (even→double for 2-row/cols/V).
  const centerMode = resolveCenterMode(overrides?.centerMode ?? preset.centerMode);
  const slots = formationSlotsForLayout(n, preset.kind, preset.rowCount, centerMode);
  // Keep idols in center-outward order as much as possible.
  const orderedUids = [
    ...formation.slotIdolUids.filter(Boolean),
    ...placedFormationPositions(formation)
      .map((p) => p.idolUid)
      .filter((uid) => !formation.slotIdolUids.includes(uid)),
  ];
  const unique: string[] = [];
  for (const uid of orderedUids) {
    if (uid && !unique.includes(uid)) unique.push(uid);
  }
  const slotIdolUids: Array<string | null> = Array.from({ length: n }, () => null);
  unique.slice(0, n).forEach((uid, i) => {
    slotIdolUids[i] = uid;
  });
  const positions = slotIdolUids
    .map((uid, i) => {
      if (!uid) return null;
      const s = slots[i];
      return s ? { idolUid: uid, x: s.x, y: s.y } : null;
    })
    .filter((p): p is { idolUid: string; x: number; y: number } => Boolean(p));
  return {
    ...formation,
    presetId: preset.id,
    layoutKind: preset.kind,
    rowCount: preset.kind === "rows" ? preset.rowCount : detectRowCountFromPositions(positions, n),
    centerMode,
    centerIdolUids: centerIdolUidsFromSlots(slotIdolUids, centerMode, n),
    layoutId: layoutIdForCount(n, preset.rowCount, preset.kind),
    slotIdolUids,
    positions,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Build/suggest a temporary formation for currently available members.
 * Unavailable idols are dropped; remaining keep relative center-outward order when possible.
 */
export function suggestTemporaryFormation(
  formation: SongStartingFormation,
  availableUids: string[],
  opts?: { presetId?: string | null },
): SongStartingFormation {
  const available = availableUids.map((u) => String(u).trim()).filter(Boolean);
  const availableSet = new Set(available);
  const n = Math.max(1, available.length);
  const fullSlots =
    formation.fullSlotIdolUids?.length === formation.memberCount && !formation.isTemporary
      ? [...formation.slotIdolUids]
      : formation.fullSlotIdolUids?.length
        ? [...formation.fullSlotIdolUids]
        : [...formation.slotIdolUids];

  const keptOrder = [
    ...fullSlots.filter((uid): uid is string => !!uid && availableSet.has(uid)),
    ...available.filter((uid) => !fullSlots.includes(uid)),
  ];
  const unique: string[] = [];
  for (const uid of keptOrder) {
    if (!unique.includes(uid)) unique.push(uid);
  }

  const preset = resolveTypicalPreset(n, opts?.presetId ?? formation.presetId);
  const slots = formationSlotsForLayout(n, preset.kind, preset.rowCount, preset.centerMode);
  const slotIdolUids: Array<string | null> = Array.from({ length: n }, () => null);
  unique.slice(0, n).forEach((uid, i) => {
    slotIdolUids[i] = uid;
  });
  const positions = slotIdolUids
    .map((uid, i) => {
      if (!uid) return null;
      const s = slots[i];
      return s ? { idolUid: uid, x: s.x, y: s.y } : null;
    })
    .filter((p): p is { idolUid: string; x: number; y: number } => Boolean(p));

  const unavailable = [
    ...new Set(
      [
        ...(formation.unavailableIdolUids ?? []),
        ...fullSlots.filter((uid): uid is string => !!uid && !availableSet.has(uid)),
      ].filter(Boolean),
    ),
  ];

  return {
    ...formation,
    memberCount: n,
    presetId: preset.id,
    layoutKind: preset.kind,
    rowCount: preset.kind === "rows" ? preset.rowCount : detectRowCountFromPositions(positions, n),
    centerMode: preset.centerMode,
    layoutId: layoutIdForCount(n, preset.rowCount, preset.kind),
    slotIdolUids,
    positions,
    fullSlotIdolUids: fullSlots.length ? fullSlots : formation.fullSlotIdolUids ?? null,
    isTemporary: unavailable.length > 0,
    unavailableIdolUids: unavailable,
    notes: unavailable.length
      ? `Temporary formation (${unavailable.length} unavailable)`
      : formation.notes ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export interface SongFormationCatalog {
  schemaVersion: "0.1";
  formations: Record<string, SongStartingFormation>;
}

/** Max rows: 3 for smaller groups, 5 when roster is 10+. */
export function maxFormationRowCount(memberCount: number): number {
  const n = Math.max(0, Math.floor(memberCount));
  if (n <= 0) return 1;
  if (n >= 10) return Math.min(5, n);
  return Math.min(3, n);
}

export function allowedFormationRowCounts(memberCount: number): number[] {
  const max = maxFormationRowCount(memberCount);
  return Array.from({ length: max }, (_, i) => i + 1);
}

/** Default rows when none saved: compact trapezoid by roster size. */
export function defaultFormationRowCount(memberCount: number): number {
  const n = Math.max(0, Math.floor(memberCount));
  if (n <= 1) return 1;
  if (n <= 4) return Math.min(2, n);
  if (n <= 9) return 2;
  if (n <= 14) return 3;
  if (n <= 20) return 4;
  return Math.min(5, n);
}

export function resolveRowCount(memberCount: number, requested?: number | null): number {
  const n = Math.max(0, Math.floor(memberCount));
  const max = maxFormationRowCount(n);
  const raw = Number(requested);
  if (Number.isFinite(raw) && raw >= 1) {
    return Math.max(1, Math.min(max, Math.floor(raw)));
  }
  return Math.min(max, defaultFormationRowCount(n));
}

/** Even split; prefer an odd front row when possible so single-center sits on the axis. */
export function distributeFormationRowSizes(memberCount: number, rowCount: number): number[] {
  const n = Math.max(0, Math.floor(memberCount));
  const rows = Math.max(1, Math.floor(rowCount));
  if (n === 0) return Array.from({ length: rows }, () => 0);
  if (rows === 1) return [n];
  const base = Math.floor(n / rows);
  const rem = n % rows;
  // Index 0 = back/upstage gets extras first → classic trapezoid feel.
  const sizes = Array.from({ length: rows }, (_, i) => base + (i < rem ? 1 : 0));
  // If front is even and back can spare 1, move one forward for a clearer #0 center.
  const front = rows - 1;
  if (sizes[front]! > 0 && sizes[front]! % 2 === 0 && sizes[0]! > sizes[front]!) {
    sizes[0]! -= 1;
    sizes[front]! += 1;
  }
  return sizes;
}

function rowKind(rowIndex: number, rowCount: number): FormationRow {
  if (rowCount <= 1 || rowIndex === rowCount - 1) return "front";
  if (rowIndex === 0) return "back";
  return "mid";
}

/**
 * Row-based trapezoid slots, ordered center-outward:
 * index 0 = center (single) or left-of-twin / first center;
 * for double center, index 1 = second center;
 * then 2, 3, … increase as distance from center grows (right, left, right…).
 */
export function formationSlots(
  count: number,
  rowCount?: number,
  centerMode: FormationCenterMode = "single",
): FormationSlotDef[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const rows = resolveRowCount(n, rowCount);
  const sizes = distributeFormationRowSizes(n, rows);
  const raw: FormationSlotDef[] = [];

  const yBack = rows === 1 ? 58 : 18;
  const yFront = rows === 1 ? 58 : 78;

  for (let r = 0; r < rows; r++) {
    const size = sizes[r] ?? 0;
    if (size <= 0) continue;
    const tRow = rows === 1 ? 0.5 : r / (rows - 1);
    const y = yBack + tRow * (yFront - yBack);
    const inset = 8 + tRow * 14;
    const left = inset;
    const span = 100 - inset * 2;
    const kind = rowKind(r, rows);
    for (let i = 0; i < size; i++) {
      const t = size === 1 ? 0.5 : i / (size - 1);
      raw.push({
        x: left + t * span,
        y,
        row: kind,
        rowIndex: r,
      });
    }
  }
  return orderSlotsCenterOutward(raw, resolveCenterMode(centerMode));
}

/** Vertical column(s): one center file, or stage-left / stage-right pair. */
function buildColumnSlots(n: number, columnCount: 1 | 2 = 2): FormationSlotDef[] {
  const yBack = 18;
  const yFront = 78;
  const raw: FormationSlotDef[] = [];
  const placeCol = (count: number, x: number) => {
    for (let i = 0; i < count; i++) {
      const t = count === 1 ? 1 : i / Math.max(1, count - 1);
      const y = yBack + t * (yFront - yBack);
      const row: FormationRow = i === count - 1 ? "front" : i === 0 ? "back" : "mid";
      raw.push({
        x,
        y,
        row,
        rowIndex: Math.round(t * Math.max(1, count - 1)),
      });
    }
  };
  if (columnCount <= 1) {
    placeCol(n, 50);
    return raw;
  }
  const leftN = Math.ceil(n / 2);
  const rightN = n - leftN;
  placeCol(leftN, 34);
  placeCol(rightN, 66);
  return raw;
}

/**
 * V-formation startpoints (formerly 鹤翼).
 * - out / 外V: open toward audience (wider front; optional front-center in the gap).
 * - in / 内V: centers at back (upstage); wings go forward & out.
 */
function buildCraneSlots(n: number, dir: "out" | "in"): FormationSlotDef[] {
  if (n <= 0) return [];
  if (n === 1) return [{ x: 50, y: dir === "in" ? 32 : 58, row: dir === "in" ? "back" : "front", rowIndex: 0 }];
  if (n === 2) {
    if (dir === "in") {
      return [
        { x: 40, y: 34, row: "back", rowIndex: 0 },
        { x: 60, y: 34, row: "back", rowIndex: 0 },
      ];
    }
    return [
      { x: 38, y: 64, row: "front", rowIndex: 1 },
      { x: 62, y: 64, row: "front", rowIndex: 1 },
    ];
  }

  const raw: FormationSlotDef[] = [];
  const hasCenter = n % 2 === 1;
  const wingN = Math.floor(n / 2);

  if (dir === "out") {
    // Open to audience: optional front-center in the gap; wings go back & out.
    if (hasCenter) {
      raw.push({ x: 50, y: 66, row: "front", rowIndex: 2 });
    }
    for (let i = 0; i < wingN; i++) {
      const t = wingN === 1 ? 0.35 : i / Math.max(1, wingN - 1);
      const xOff = (hasCenter ? 14 : 12) + t * 30;
      const y = 64 - t * 34;
      const row: FormationRow = y >= 58 ? "front" : y <= 38 ? "back" : "mid";
      const rowIndex = y >= 58 ? 2 : y <= 38 ? 0 : 1;
      raw.push({ x: clampStageCoord(50 - xOff), y, row, rowIndex });
      raw.push({ x: clampStageCoord(50 + xOff), y, row, rowIndex });
    }
    return raw;
  }

  // V in: centers at back; wings go forward & out toward audience.
  if (hasCenter) {
    raw.push({ x: 50, y: 30, row: "back", rowIndex: 0 });
  }
  for (let i = 0; i < wingN; i++) {
    // i=0 nearest center (more back); i=last = front tip
    const t = wingN === 1 ? (hasCenter ? 0.55 : 0.2) : i / Math.max(1, wingN - 1);
    const xOff = (hasCenter ? 12 : 10) + (hasCenter ? (i + 1) / wingN : t) * 32;
    const y = hasCenter
      ? 36 + ((i + 1) / wingN) * 34
      : 32 + t * 38;
    const row: FormationRow = y >= 58 ? "front" : y <= 38 ? "back" : "mid";
    const rowIndex = y >= 58 ? 2 : y <= 38 ? 0 : 1;
    raw.push({ x: clampStageCoord(50 - xOff), y, row, rowIndex });
    raw.push({ x: clampStageCoord(50 + xOff), y, row, rowIndex });
  }
  return raw;
}

/**
 * Order slots center-outward, picking designated centers from the front (max y)
 * or back (min y) band — used for V in (centers upstage).
 */
export function orderSlotsCenterOutwardAt(
  slots: FormationSlotDef[],
  centerMode: FormationCenterMode = "single",
  centerAt: "front" | "back" = "front",
): FormationSlotDef[] {
  if (slots.length <= 1) {
    return slots.map((s) => ({ ...s, isCenter: true }));
  }
  const mode = resolveCenterMode(centerMode);
  const bandY =
    centerAt === "back" ? Math.min(...slots.map((s) => s.y)) : Math.max(...slots.map((s) => s.y));
  const bandRow: FormationRow = centerAt === "back" ? "back" : "front";
  const band = slots
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => Math.abs(s.y - bandY) < 0.75 || s.row === bandRow)
    .sort((a, b) => a.s.x - b.s.x);
  const bandList = band.length ? band : slots.map((s, i) => ({ s, i })).sort((a, b) => a.s.x - b.s.x);

  let centerLocal: number[] = [];
  if (mode === "double" && bandList.length >= 2) {
    const leftMid = Math.floor((bandList.length - 1) / 2);
    centerLocal = [leftMid, leftMid + 1];
  } else {
    centerLocal = [Math.floor((bandList.length - 1) / 2)];
  }

  const ordered: FormationSlotDef[] = [];
  const used = new Set<number>();
  for (const li of centerLocal) {
    const item = bandList[li];
    if (!item || used.has(item.i)) continue;
    used.add(item.i);
    ordered.push({ ...item.s, isCenter: true });
  }

  if (centerLocal.length) {
    const midLeft = Math.min(...centerLocal);
    const midRight = Math.max(...centerLocal);
    let r = midRight + 1;
    let l = midLeft - 1;
    while (r < bandList.length || l >= 0) {
      if (r < bandList.length) {
        const item = bandList[r++]!;
        if (!used.has(item.i)) {
          used.add(item.i);
          ordered.push({ ...item.s, isCenter: false });
        }
      }
      if (l >= 0) {
        const item = bandList[l--]!;
        if (!used.has(item.i)) {
          used.add(item.i);
          ordered.push({ ...item.s, isCenter: false });
        }
      }
    }
  }

  const cx = ordered.reduce((sum, s) => sum + s.x, 0) / Math.max(1, ordered.length);
  const cy = ordered.reduce((sum, s) => sum + s.y, 0) / Math.max(1, ordered.length);
  const rest = slots
    .map((s, i) => ({ s, i }))
    .filter(({ i }) => !used.has(i))
    .sort((a, b) => {
      const da = (a.s.x - cx) ** 2 + (a.s.y - cy) ** 2;
      const db = (b.s.x - cx) ** 2 + (b.s.y - cy) ** 2;
      if (Math.abs(da - db) > 0.01) return da - db;
      if (Math.abs(a.s.y - b.s.y) > 0.01) return centerAt === "back" ? a.s.y - b.s.y : b.s.y - a.s.y;
      return Math.abs(a.s.x - cx) - Math.abs(b.s.x - cx) || a.s.x - b.s.x;
    });
  for (const item of rest) {
    ordered.push({ ...item.s, isCenter: false });
  }
  return ordered;
}

/** Front→back row sizes: 1, 2, 3, … with remainder on the back. */
export function distributePyramidRowSizes(memberCount: number): number[] {
  const n = Math.max(0, Math.floor(memberCount));
  if (n <= 0) return [];
  if (n === 1) return [1];
  let r = 1;
  while ((r * (r + 1)) / 2 <= n) r += 1;
  r -= 1; // largest triangular ≤ n
  if (r < 1) r = 1;
  const sizes = Array.from({ length: r }, (_, i) => i + 1);
  const used = (r * (r + 1)) / 2;
  const rem = n - used;
  if (rem > 0) {
    if (rem >= r + 1) sizes.push(rem);
    else sizes[sizes.length - 1]! += rem;
  }
  return sizes;
}

/**
 * Surrounded center: one or two mid-stage centers, others on an ellipse around them.
 * Slot order is already center-first (#0 / #0+#1), then ring from front clockwise.
 */
function buildSurroundSlots(n: number, centerMode: FormationCenterMode = "single"): FormationSlotDef[] {
  const count = Math.max(0, Math.floor(n));
  if (count <= 0) return [];
  const mode = resolveCenterMode(centerMode);
  const isDouble = mode === "double" && count >= 2;
  const cx = 50;
  const cy = 48;

  if (count === 1) {
    return [{ x: cx, y: cy, row: "mid", rowIndex: 1, isCenter: true }];
  }
  if (count === 2 && isDouble) {
    return [
      { x: 42, y: cy, row: "mid", rowIndex: 1, isCenter: true },
      { x: 58, y: cy, row: "mid", rowIndex: 1, isCenter: true },
    ];
  }

  const raw: FormationSlotDef[] = [];
  if (isDouble) {
    raw.push({ x: 42, y: cy, row: "mid", rowIndex: 1, isCenter: true });
    raw.push({ x: 58, y: cy, row: "mid", rowIndex: 1, isCenter: true });
  } else {
    raw.push({ x: cx, y: cy, row: "mid", rowIndex: 1, isCenter: true });
  }

  const wingN = count - raw.length;
  if (wingN <= 0) return raw;

  const rx = Math.min(38, 22 + wingN * 1.8 + (isDouble ? 4 : 0));
  const ry = Math.min(30, 18 + wingN * 1.2);
  for (let i = 0; i < wingN; i++) {
    // Offset by half-step so nobody sits exactly on the front/back axis.
    const a = ((i + 0.5) / wingN) * Math.PI * 2;
    const x = clampStageCoord(cx + rx * Math.sin(a));
    const y = clampStageCoord(cy + ry * Math.cos(a));
    const row: FormationRow = y >= 58 ? "front" : y <= 38 ? "back" : "mid";
    const rowIndex = y >= 58 ? 2 : y <= 38 ? 0 : 1;
    raw.push({ x, y, row, rowIndex, isCenter: false });
  }
  return raw;
}

/**
 * Pyramid: front row = 1 (center), then 2, 3, … toward upstage.
 * Uses equal inter-person spacing from the widest row so rows read as
 * clear 1-2-3-4 stacks (bowling-pin), not nested full-width bands.
 */
function buildPyramidSlots(n: number): FormationSlotDef[] {
  const sizes = distributePyramidRowSizes(n);
  if (!sizes.length) return [];
  const raw: FormationSlotDef[] = [];
  const maxSize = Math.max(...sizes);
  const margin = 10;
  const usable = 100 - margin * 2;
  const step = maxSize <= 1 ? 0 : usable / (maxSize - 1);
  const yFront = 78;
  const yBack = sizes.length === 1 ? 58 : 18;
  for (let r = 0; r < sizes.length; r++) {
    const size = sizes[r] ?? 0;
    if (size <= 0) continue;
    const tRow = sizes.length === 1 ? 0 : r / (sizes.length - 1); // 0 = front, 1 = back
    const y = yFront + tRow * (yBack - yFront);
    const kind: FormationRow = r === 0 ? "front" : r === sizes.length - 1 ? "back" : "mid";
    const rowWidth = size <= 1 ? 0 : step * (size - 1);
    const left = 50 - rowWidth / 2;
    for (let i = 0; i < size; i++) {
      const x = size === 1 ? 50 : left + i * step;
      raw.push({
        x: clampStageCoord(x),
        y,
        row: kind,
        rowIndex: r,
      });
    }
  }
  return raw;
}

/** Slot geometry for a starting layout kind (then freely adjustable). */
export function formationSlotsForLayout(
  count: number,
  kind: FormationLayoutKind = "rows",
  rowCount?: number,
  centerMode: FormationCenterMode = "single",
): FormationSlotDef[] {
  const n = Math.max(0, Math.floor(count));
  if (n === 0) return [];
  const mode = resolveCenterMode(centerMode);
  const resolved = resolveLayoutKind(kind);
  if (resolved === "column") return orderSlotsCenterOutward(buildColumnSlots(n, 1), mode);
  if (resolved === "columns") return orderSlotsCenterOutward(buildColumnSlots(n, 2), mode);
  if (resolved === "crane_out") return orderSlotsCenterOutward(buildCraneSlots(n, "out"), mode);
  if (resolved === "crane_in") return orderSlotsCenterOutwardAt(buildCraneSlots(n, "in"), mode, "back");
  if (resolved === "pyramid") return orderSlotsCenterOutward(buildPyramidSlots(n), mode);
  // Surround slots are already ordered center-first (front-band reorder would steal the ring).
  if (resolved === "surround") return buildSurroundSlots(n, mode);
  return formationSlots(n, rowCount, mode);
}

/** Reorder spatial slots so array index = position number (0 = center). Centers from front band. */
export function orderSlotsCenterOutward(
  slots: FormationSlotDef[],
  centerMode: FormationCenterMode = "single",
): FormationSlotDef[] {
  return orderSlotsCenterOutwardAt(slots, centerMode, "front");
}

export function formationSlotsFor(
  formation: Pick<SongStartingFormation, "memberCount" | "rowCount" | "centerMode" | "layoutKind" | "presetId">,
): FormationSlotDef[] {
  const kind = formation.layoutKind
    ? resolveLayoutKind(formation.layoutKind)
    : resolveTypicalPreset(formation.memberCount, formation.presetId).kind;
  return formationSlotsForLayout(
    formation.memberCount,
    kind,
    formation.rowCount,
    resolveCenterMode(formation.centerMode),
  );
}

/**
 * Center seats are always the first indices after center-outward ordering:
 * single → [0], double → [0, 1].
 */
export function centerSlotIndices(
  count: number,
  mode: FormationCenterMode = "single",
  _rowCount?: number,
): number[] {
  const n = Math.max(0, Math.floor(count));
  if (n <= 0) return [];
  if (resolveCenterMode(mode) === "double" && n >= 2) return [0, 1];
  return [0];
}

/**
 * Max simultaneous C seats by roster size:
 * &lt;8 → 2, &lt;12 → 3, &lt;16 → 4, …
 * Zero C is always allowed.
 */
export function maxFormationCenters(memberCount: number): number {
  const n = Math.max(0, Math.floor(memberCount));
  if (n <= 0) return 0;
  if (n < 8) return Math.min(n, 2);
  return Math.min(n, Math.floor(n / 4) + 1);
}

/** Center uids from explicit list, else from center-outward slot seats. */
export function centerIdolUidsFromFormation(formation: SongStartingFormation): string[] {
  const placed = new Set(
    [
      ...formation.slotIdolUids.filter((u): u is string => !!u),
      ...(formation.positions ?? []).map((p) => p.idolUid),
    ]
      .map((u) => String(u).trim())
      .filter(Boolean),
  );
  const max = maxFormationCenters(formation.memberCount || placed.size);
  if (Array.isArray(formation.centerIdolUids)) {
    return formation.centerIdolUids
      .map((u) => String(u ?? "").trim())
      .filter((u) => u && placed.has(u))
      .slice(0, max);
  }
  const mode = resolveCenterMode(formation.centerMode);
  const indices = centerSlotIndices(formation.memberCount, mode, formation.rowCount);
  const out: string[] = [];
  for (const index of indices) {
    const uid = formation.slotIdolUids[index];
    if (uid && placed.has(uid)) out.push(uid);
    if (out.length >= max) break;
  }
  return out;
}

function centerIdolUidsFromSlots(
  slotIdolUids: Array<string | null>,
  centerMode: FormationCenterMode,
  memberCount = slotIdolUids.length,
): string[] {
  const mode = resolveCenterMode(centerMode);
  const max = maxFormationCenters(memberCount);
  const out: string[] = [];
  const first = slotIdolUids[0];
  if (first) out.push(first);
  if (mode === "double" && max >= 2) {
    const second = slotIdolUids[1];
    if (second) out.push(second);
  }
  return out.slice(0, max);
}

export type ToggleFormationCenterResult = {
  formation: SongStartingFormation;
  /** True when center list changed. */
  changed: boolean;
  /** True when set was blocked because the roster is already at max C. */
  blockedAtMax: boolean;
  maxCenters: number;
  centerCount: number;
};

/** Double-click toggle: set/unset C. No replace when at max — unset someone first. */
export function toggleFormationCenterIdol(
  formation: SongStartingFormation,
  idolUid: string,
): ToggleFormationCenterResult {
  const uid = String(idolUid ?? "").trim();
  const maxCenters = maxFormationCenters(formation.memberCount);
  if (!uid) {
    return {
      formation,
      changed: false,
      blockedAtMax: false,
      maxCenters,
      centerCount: centerIdolUidsFromFormation(formation).length,
    };
  }
  const placed = new Set(
    [
      ...formation.slotIdolUids.filter((u): u is string => !!u),
      ...(formation.positions ?? []).map((p) => p.idolUid),
    ]
      .map((u) => String(u).trim())
      .filter(Boolean),
  );
  if (!placed.has(uid)) {
    return {
      formation,
      changed: false,
      blockedAtMax: false,
      maxCenters,
      centerCount: centerIdolUidsFromFormation(formation).length,
    };
  }

  let centers = centerIdolUidsFromFormation(formation);
  const idx = centers.indexOf(uid);
  if (idx >= 0) {
    centers = centers.filter((c) => c !== uid);
  } else if (centers.length >= maxCenters) {
    return {
      formation,
      changed: false,
      blockedAtMax: true,
      maxCenters,
      centerCount: centers.length,
    };
  } else {
    centers = [...centers, uid];
  }
  const centerMode: FormationCenterMode = centers.length >= 2 ? "double" : "single";
  return {
    formation: {
      ...formation,
      centerIdolUids: centers,
      centerMode,
      updatedAt: new Date().toISOString(),
    },
    changed: true,
    blockedAtMax: false,
    maxCenters,
    centerCount: centers.length,
  };
}

export function formationSlotsWithCenter(
  count: number,
  mode: FormationCenterMode = "single",
  rowCount?: number,
  kind: FormationLayoutKind = "rows",
): FormationSlotDef[] {
  const centers = new Set(centerSlotIndices(count, mode, rowCount));
  return formationSlotsForLayout(count, kind, rowCount, mode).map((slot, index) => ({
    ...slot,
    isCenter: centers.has(index),
  }));
}

export function resolveCenterMode(raw: unknown): FormationCenterMode {
  return String(raw ?? "").trim() === "double" ? "double" : "single";
}

export type FormationPosition = { idolUid: string; x: number; y: number };

export function clampStageCoord(v: number, pad = 4): number {
  if (!Number.isFinite(v)) return 50;
  return Math.max(pad, Math.min(100 - pad, v));
}

/** Collect placed continuous positions (prefer `positions`, else slot geometry). */
export function placedFormationPositions(formation: SongStartingFormation): FormationPosition[] {
  if (formation.positions?.length) {
    return formation.positions
      .filter((p) => p.idolUid)
      .map((p) => ({ idolUid: p.idolUid, x: clampStageCoord(p.x), y: clampStageCoord(p.y) }));
  }
  const slots = formationSlotsFor(formation);
  const out: FormationPosition[] = [];
  formation.slotIdolUids.forEach((uid, i) => {
    if (!uid) return;
    const s = slots[i];
    if (!s) return;
    out.push({ idolUid: uid, x: s.x, y: s.y });
  });
  return out;
}

/** Infer row count from Y clustering (no manual row picker). */
export function detectRowCountFromPositions(
  positions: ReadonlyArray<{ x: number; y: number }>,
  memberCount?: number,
): number {
  const n = memberCount ?? positions.length;
  if (positions.length <= 1) return 1;
  const ys = positions.map((p) => p.y).sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < ys.length; i++) gaps.push(ys[i]! - ys[i - 1]!);
  const sortedGaps = [...gaps].sort((a, b) => a - b);
  const median = sortedGaps[Math.floor(sortedGaps.length / 2)] ?? 0;
  const threshold = Math.max(7, median * 2.2, 10);
  let rows = 1;
  for (const g of gaps) {
    if (g >= threshold) rows += 1;
  }
  return resolveRowCount(n, rows);
}

/**
 * Snap placed idols onto a symmetrical trapezoid.
 * Row count is auto-detected from current Y spread.
 * Slot index 0 = center (center-outward numbering).
 */
export function snapFormationSymmetrical(formation: SongStartingFormation): SongStartingFormation {
  const mode = resolveCenterMode(formation.centerMode);
  const placed = placedFormationPositions(formation);
  const n = Math.max(formation.memberCount, placed.length);
  if (!placed.length) {
    const rowCount = resolveRowCount(n, formation.rowCount);
    return {
      ...formation,
      memberCount: n,
      rowCount,
      layoutId: layoutIdForCount(n, rowCount),
      centerMode: mode,
      updatedAt: new Date().toISOString(),
    };
  }
  const rowCount = detectRowCountFromPositions(placed, n);
  const slots = formationSlots(n, rowCount, mode);
  const used = new Set<number>();
  const ranked = [...placed].sort((a, b) => a.y - b.y || a.x - b.x);
  const slotIdolUids: Array<string | null> = Array.from({ length: n }, () => null);
  const positions: FormationPosition[] = [];

  // Prefer mapping: nearest unused geometric slot (already center-outward ordered).
  const byDist = ranked
    .map((p) => {
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]!;
        const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      return { ...p, slot: best, dist: bestD };
    })
    .sort((a, b) => a.dist - b.dist);

  for (const p of byDist) {
    const slot = nearestSlotIndex(p.x, p.y, n, used, rowCount, mode);
    if (slot < 0) continue;
    used.add(slot);
    slotIdolUids[slot] = p.idolUid;
    const s = slots[slot]!;
    positions.push({ idolUid: p.idolUid, x: s.x, y: s.y });
  }

  // Keep center-outward position list order matching slot indices.
  positions.sort((a, b) => {
    const ia = slotIdolUids.indexOf(a.idolUid);
    const ib = slotIdolUids.indexOf(b.idolUid);
    return ia - ib;
  });

  return {
    ...formation,
    memberCount: n,
    rowCount,
    layoutId: layoutIdForCount(n, rowCount),
    centerMode: mode,
    slotIdolUids,
    positions,
    source: formation.source === "imported" ? "imported" : "manual",
    updatedAt: new Date().toISOString(),
  };
}

/** Place or move an idol to a free stage coordinate (keeps slot index stable). */
export function setIdolStagePosition(
  formation: SongStartingFormation,
  idolUid: string,
  x: number,
  y: number,
): SongStartingFormation {
  const uid = String(idolUid ?? "").trim();
  if (!uid) return formation;
  const nx = clampStageCoord(x);
  const ny = clampStageCoord(y);
  const positions = placedFormationPositions(formation).filter((p) => p.idolUid !== uid);
  positions.push({ idolUid: uid, x: nx, y: ny });

  const slotIdolUids = [...formation.slotIdolUids];
  while (slotIdolUids.length < formation.memberCount) slotIdolUids.push(null);
  if (!slotIdolUids.includes(uid)) {
    const empty = slotIdolUids.findIndex((u) => !u);
    if (empty >= 0) slotIdolUids[empty] = uid;
  }

  return {
    ...formation,
    slotIdolUids: slotIdolUids.slice(0, formation.memberCount),
    positions,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Swap two placed members: stage positions, slot numbers, and C flags.
 */
export function swapFormationMembers(
  formation: SongStartingFormation,
  idolUidA: string,
  idolUidB: string,
): SongStartingFormation {
  const a = String(idolUidA ?? "").trim();
  const b = String(idolUidB ?? "").trim();
  if (!a || !b || a === b) return formation;

  const slotIdolUids = [...formation.slotIdolUids];
  const ia = slotIdolUids.indexOf(a);
  const ib = slotIdolUids.indexOf(b);
  if (ia < 0 || ib < 0) return formation;
  slotIdolUids[ia] = b;
  slotIdolUids[ib] = a;

  const posMap = new Map(placedFormationPositions(formation).map((p) => [p.idolUid, p] as const));
  const pa = posMap.get(a);
  const pb = posMap.get(b);
  const positions = placedFormationPositions(formation).map((p) => {
    if (p.idolUid === a && pb) return { idolUid: a, x: pb.x, y: pb.y };
    if (p.idolUid === b && pa) return { idolUid: b, x: pa.x, y: pa.y };
    return p;
  });
  // If either lacked a free position, seed from the other's coords or leave as mapped.
  if (pa && !pb) {
    positions.push({ idolUid: b, x: pa.x, y: pa.y });
  } else if (pb && !pa) {
    positions.push({ idolUid: a, x: pb.x, y: pb.y });
  }

  const centers = centerIdolUidsFromFormation(formation);
  const aC = centers.includes(a);
  const bC = centers.includes(b);
  let centerIdolUids = centers;
  if (aC !== bC) {
    centerIdolUids = centers.filter((u) => u !== a && u !== b);
    if (aC) centerIdolUids.push(b);
    if (bC) centerIdolUids.push(a);
  }

  const centerMode: FormationCenterMode = centerIdolUids.length >= 2 ? "double" : "single";
  return {
    ...formation,
    slotIdolUids,
    positions,
    centerIdolUids,
    centerMode,
    source: "manual",
    updatedAt: new Date().toISOString(),
  };
}

export function removeIdolStagePosition(
  formation: SongStartingFormation,
  idolUid: string,
): SongStartingFormation {
  const uid = String(idolUid ?? "").trim();
  const positions = placedFormationPositions(formation).filter((p) => p.idolUid !== uid);
  const slotIdolUids = formation.slotIdolUids.map((u) => (u === uid ? null : u));
  return {
    ...formation,
    positions,
    slotIdolUids,
    updatedAt: new Date().toISOString(),
  };
}

export function clearFormationPositions(formation: SongStartingFormation): SongStartingFormation {
  return {
    ...formation,
    slotIdolUids: formation.slotIdolUids.map(() => null),
    positions: [],
    videoMarks: undefined,
    updatedAt: new Date().toISOString(),
  };
}

export function layoutIdForCount(
  count: number,
  rowCount?: number,
  kind: FormationLayoutKind = "rows",
): string {
  const n = Math.max(0, count);
  const resolved = resolveLayoutKind(kind);
  if (resolved === "column") return `cols-1-n-${n}`;
  if (resolved === "columns") return `cols-2-n-${n}`;
  if (resolved === "crane_out") return `crane-out-n-${n}`;
  if (resolved === "crane_in") return `crane-in-n-${n}`;
  if (resolved === "pyramid") return `pyramid-n-${n}`;
  if (resolved === "surround") return `surround-n-${n}`;
  const rows = resolveRowCount(n, rowCount);
  return `rows-${rows}-n-${n}`;
}

export function emptyFormation(opts: {
  songUid: string;
  memberCount: number;
  groupUid?: string | null;
  source?: FormationSource;
  rowCount?: number;
  centerMode?: FormationCenterMode;
  presetId?: string | null;
  layoutKind?: FormationLayoutKind | null;
}): SongStartingFormation {
  const memberCount = Math.max(0, Math.floor(opts.memberCount));
  const preset = resolveTypicalPreset(Math.max(1, memberCount), opts.presetId);
  const layoutKind = resolveLayoutKind(opts.layoutKind ?? preset.kind);
  const rowCount = resolveRowCount(memberCount, opts.rowCount ?? preset.rowCount);
  const centerMode = resolveCenterMode(opts.centerMode ?? preset.centerMode);
  const slotIdolUids = Array.from({ length: memberCount }, () => null);
  return {
    schemaVersion: "0.1",
    songUid: opts.songUid,
    groupUid: opts.groupUid ?? null,
    layoutId: layoutIdForCount(memberCount, rowCount, layoutKind),
    memberCount,
    rowCount,
    layoutKind,
    presetId: preset.id,
    slotIdolUids,
    centerMode,
    centerIdolUids: centerIdolUidsFromSlots(slotIdolUids, centerMode, memberCount),
    fullSlotIdolUids: null,
    isTemporary: false,
    unavailableIdolUids: [],
    source: opts.source ?? "manual",
    updatedAt: new Date().toISOString(),
  };
}

function parseRowCountFromLayoutId(layoutId: string, memberCount: number): number | null {
  const m = /^rows-(\d+)-n-(\d+)$/i.exec(String(layoutId ?? "").trim());
  if (m) return resolveRowCount(memberCount, Number(m[1]));
  return null;
}

function parseLayoutKindFromLayoutId(layoutId: string): FormationLayoutKind | null {
  const id = String(layoutId ?? "").trim();
  if (/^cols-1-n-\d+$/i.test(id)) return "column";
  if (/^cols-2-n-\d+$/i.test(id)) return "columns";
  if (/^crane-out-n-\d+$/i.test(id)) return "crane_out";
  if (/^crane-in-n-\d+$/i.test(id)) return "crane_in";
  if (/^pyramid-n-\d+$/i.test(id)) return "pyramid";
  if (/^surround-n-\d+$/i.test(id)) return "surround";
  if (/^rows-\d+-n-\d+$/i.test(id)) return "rows";
  return null;
}

export function normalizeSongStartingFormation(
  raw: unknown,
  fallbackSongUid = "",
): SongStartingFormation | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const songUid = String(row.songUid ?? row.song_uid ?? fallbackSongUid ?? "").trim();
  if (!songUid) return null;
  const slotsRaw = Array.isArray(row.slotIdolUids)
    ? row.slotIdolUids
    : Array.isArray(row.slot_idol_uids)
      ? row.slot_idol_uids
      : null;
  const positionsEarly = Array.isArray(row.positions) ? row.positions : null;
  if (!slotsRaw && !positionsEarly && !row.choreography) return null;
  const slotIdolUids = (slotsRaw ?? []).map((v) => {
    if (v == null || v === "") return null;
    const s = String(v).trim();
    return s || null;
  });
  const memberCount = Math.max(
    slotIdolUids.length,
    Number(row.memberCount) || 0,
    Array.isArray(positionsEarly) ? positionsEarly.length : 0,
  );
  while (slotIdolUids.length < memberCount) slotIdolUids.push(null);
  if (!songUid) return null;
  if (memberCount <= 0 && !row.choreography) return null;
  const sourceRaw = String(row.source ?? "manual");
  const source: FormationSource =
    sourceRaw === "video_seed" || sourceRaw === "imported" || sourceRaw === "default_center"
      ? sourceRaw
      : "manual";
  const videoMarks = Array.isArray(row.videoMarks)
    ? row.videoMarks
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => ({
          idolUid: String(m.idolUid ?? "").trim(),
          x: Number(m.x),
          y: Number(m.y),
          frameSeconds: m.frameSeconds == null ? undefined : Number(m.frameSeconds),
        }))
        .filter((m) => m.idolUid && Number.isFinite(m.x) && Number.isFinite(m.y))
    : undefined;
  const positions = Array.isArray(row.positions)
    ? row.positions
        .filter((m): m is Record<string, unknown> => !!m && typeof m === "object")
        .map((m) => ({
          idolUid: String(m.idolUid ?? m.dancerId ?? "").trim(),
          x: Number(m.x),
          y: Number(m.y),
        }))
        .filter((m) => m.idolUid && Number.isFinite(m.x) && Number.isFinite(m.y))
    : undefined;
  const choreography =
    row.choreography && typeof row.choreography === "object"
      ? (row.choreography as ChoreographicCompatDocument)
      : null;
  const layoutIdRaw = String(row.layoutId ?? "").trim();
  const rowCountRaw = row.rowCount ?? row.row_count;
  const rowCount = resolveRowCount(
    memberCount,
    typeof rowCountRaw === "number" || typeof rowCountRaw === "string"
      ? Number(rowCountRaw)
      : parseRowCountFromLayoutId(layoutIdRaw, memberCount),
  );
  const presetIdRaw = String(row.presetId ?? row.preset_id ?? "").trim();
  const layoutKind = resolveLayoutKind(
    row.layoutKind ??
      row.layout_kind ??
      parseLayoutKindFromLayoutId(layoutIdRaw) ??
      resolveTypicalPreset(Math.max(1, memberCount), presetIdRaw || null).kind,
  );
  const fullSlotsRaw = Array.isArray(row.fullSlotIdolUids)
    ? row.fullSlotIdolUids
    : Array.isArray(row.full_slot_idol_uids)
      ? row.full_slot_idol_uids
      : null;
  const fullSlotIdolUids = fullSlotsRaw
    ? fullSlotsRaw.map((v) => {
        if (v == null || v === "") return null;
        const s = String(v).trim();
        return s || null;
      })
    : null;
  const unavailableIdolUids = Array.isArray(row.unavailableIdolUids)
    ? row.unavailableIdolUids.map((x) => String(x).trim()).filter(Boolean)
    : Array.isArray(row.unavailable_idol_uids)
      ? row.unavailable_idol_uids.map((x) => String(x).trim()).filter(Boolean)
      : [];
  return {
    schemaVersion: "0.1",
    songUid,
    groupUid: row.groupUid == null && row.group_uid == null ? null : String(row.groupUid ?? row.group_uid ?? ""),
    layoutId: layoutIdRaw || layoutIdForCount(memberCount, rowCount, layoutKind),
    memberCount,
    rowCount,
    layoutKind,
    presetId: presetIdRaw || resolveTypicalPreset(Math.max(1, memberCount)).id,
    slotIdolUids: slotIdolUids.slice(0, memberCount),
    centerMode: resolveCenterMode(row.centerMode ?? row.center_mode),
    centerIdolUids: (() => {
      const raw = row.centerIdolUids ?? row.center_idol_uids;
      if (!Array.isArray(raw)) return null;
      const max = maxFormationCenters(memberCount);
      const list = raw.map((x) => String(x ?? "").trim()).filter(Boolean).slice(0, max);
      return list;
    })(),
    fullSlotIdolUids,
    isTemporary: row.isTemporary === true || row.is_temporary === true,
    unavailableIdolUids,
    source,
    effectiveFrom: row.effectiveFrom == null ? null : String(row.effectiveFrom),
    notes: row.notes == null ? null : String(row.notes),
    positions,
    choreography,
    videoMarks,
    updatedAt: row.updatedAt == null ? null : String(row.updatedAt),
  };
}

export function normalizeSongFormationCatalog(raw: unknown): SongFormationCatalog {
  const out: SongFormationCatalog = { schemaVersion: "0.1", formations: {} };
  if (!raw || typeof raw !== "object") return out;
  const root = raw as Record<string, unknown>;
  const map =
    root.formations && typeof root.formations === "object"
      ? (root.formations as Record<string, unknown>)
      : root;
  for (const [key, value] of Object.entries(map)) {
    if (key === "schemaVersion" || key === "formations") continue;
    const norm = normalizeSongStartingFormation(value, key);
    if (norm) out.formations[norm.songUid] = norm;
  }
  return out;
}

export function resizeFormationSlots(
  formation: SongStartingFormation,
  memberCount: number,
): SongStartingFormation {
  const n = Math.max(0, Math.floor(memberCount));
  const next = [...formation.slotIdolUids];
  while (next.length < n) next.push(null);
  const rowCount = resolveRowCount(n, formation.rowCount);
  return {
    ...formation,
    memberCount: n,
    rowCount,
    layoutId: layoutIdForCount(n, rowCount),
    slotIdolUids: next.slice(0, n),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Change row layout. Remaps placed idols onto the new slots by nearest old position
 * so switching 1↔2↔3 rows keeps relative stage order as much as possible.
 */
export function setFormationRowCount(
  formation: SongStartingFormation,
  rowCount: number,
): SongStartingFormation {
  const n = formation.memberCount;
  const nextRows = resolveRowCount(n, rowCount);
  const prevRows = resolveRowCount(n, formation.rowCount);
  if (nextRows === prevRows && formation.rowCount === nextRows) {
    return {
      ...formation,
      rowCount: nextRows,
      layoutId: layoutIdForCount(n, nextRows),
    };
  }

  const oldSlots = formationSlots(n, prevRows, resolveCenterMode(formation.centerMode));
  const placed: Array<{ idolUid: string; x: number; y: number }> = [];
  formation.slotIdolUids.forEach((uid, i) => {
    if (!uid) return;
    const slot = oldSlots[i];
    const fromPos = formation.positions?.find((p) => p.idolUid === uid);
    placed.push({
      idolUid: uid,
      x: fromPos?.x ?? slot?.x ?? 50,
      y: fromPos?.y ?? slot?.y ?? 50,
    });
  });

  let next: SongStartingFormation = {
    ...formation,
    rowCount: nextRows,
    layoutId: layoutIdForCount(n, nextRows),
    slotIdolUids: Array.from({ length: n }, () => null),
    updatedAt: new Date().toISOString(),
  };

  const mode = resolveCenterMode(formation.centerMode);
  const used = new Set<number>();
  const ranked = placed
    .map((p) => {
      const slot = nearestSlotIndex(p.x, p.y, n, undefined, nextRows, mode);
      const s = formationSlots(n, nextRows, mode)[slot];
      const dist = s ? (s.x - p.x) ** 2 + (s.y - p.y) ** 2 : Infinity;
      return { ...p, slot, dist };
    })
    .sort((a, b) => a.dist - b.dist);

  for (const p of ranked) {
    const slot = nearestSlotIndex(p.x, p.y, n, used, nextRows, mode);
    if (slot < 0) continue;
    used.add(slot);
    next = assignIdolToSlot(next, slot, p.idolUid);
  }
  return next;
}

/** Assign idol to a slot; removes them from any other slot first. Also seeds/updates free position. */
export function assignIdolToSlot(
  formation: SongStartingFormation,
  slotIndex: number,
  idolUid: string | null,
): SongStartingFormation {
  const slots = formation.slotIdolUids.map((uid) => {
    if (idolUid && uid === idolUid) return null;
    return uid;
  });
  if (slotIndex >= 0 && slotIndex < slots.length) {
    slots[slotIndex] = idolUid;
  }

  const template = formationSlotsFor(formation);
  let positions = placedFormationPositions({ ...formation, slotIdolUids: slots }).filter(
    (p) => slots.includes(p.idolUid),
  );
  if (idolUid) {
    positions = positions.filter((p) => p.idolUid !== idolUid);
    const s = template[slotIndex];
    if (s) positions.push({ idolUid, x: s.x, y: s.y });
  } else {
    // cleared slot — drop any orphan position already handled by filter
  }

  return {
    ...formation,
    slotIdolUids: slots,
    positions,
    updatedAt: new Date().toISOString(),
  };
}

export function clearFormationSlots(formation: SongStartingFormation): SongStartingFormation {
  return clearFormationPositions(formation);
}

export function nearestSlotIndex(
  x: number,
  y: number,
  count: number,
  occupied?: ReadonlySet<number>,
  rowCount?: number,
  centerMode: FormationCenterMode = "single",
): number {
  const slots = formationSlots(count, rowCount, centerMode);
  let best = -1;
  let bestDist = Infinity;
  for (let i = 0; i < slots.length; i++) {
    if (occupied?.has(i)) continue;
    const s = slots[i]!;
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  if (best >= 0) return best;
  bestDist = Infinity;
  for (let i = 0; i < slots.length; i++) {
    const s = slots[i]!;
    const d = (s.x - x) ** 2 + (s.y - y) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = i;
    }
  }
  return best;
}

/** Snap free video marks onto empty slots (greedy by distance to current layout template). */
export function snapVideoMarksToSlots(formation: SongStartingFormation): SongStartingFormation {
  const marks = [...(formation.videoMarks ?? [])];
  if (!marks.length) return formation;
  let next = clearFormationSlots(formation);
  next = { ...next, source: "video_seed", videoMarks: marks };
  const used = new Set<number>();
  const kind = next.layoutKind
    ? resolveLayoutKind(next.layoutKind)
    : resolveTypicalPreset(next.memberCount, next.presetId).kind;
  const rows = resolveRowCount(next.memberCount, next.rowCount);
  const mode = resolveCenterMode(next.centerMode);
  const slots = formationSlotsForLayout(next.memberCount, kind, rows, mode);
  const ranked = marks
    .map((m) => {
      let best = -1;
      let bestDist = Infinity;
      for (let i = 0; i < slots.length; i++) {
        const s = slots[i]!;
        const d = (s.x - m.x) ** 2 + (s.y - m.y) ** 2;
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      return { ...m, slot: best, dist: bestDist };
    })
    .sort((a, b) => a.dist - b.dist);
  for (const m of ranked) {
    let slot = -1;
    let bestDist = Infinity;
    for (let i = 0; i < slots.length; i++) {
      if (used.has(i)) continue;
      const s = slots[i]!;
      const d = (s.x - m.x) ** 2 + (s.y - m.y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        slot = i;
      }
    }
    if (slot < 0) continue;
    used.add(slot);
    next = assignIdolToSlot(next, slot, m.idolUid);
  }
  return next;
}

/**
 * Prefer for dance-practice extracts: keep click marks as free stage positions,
 * then number slots center-outward (#0 = center).
 */
export function applyVideoMarksToFormation(
  formation: SongStartingFormation,
  opts?: { mirrorX?: boolean },
): SongStartingFormation {
  const marks = (formation.videoMarks ?? [])
    .map((m) => ({
      idolUid: String(m.idolUid ?? "").trim(),
      x: opts?.mirrorX ? 100 - Number(m.x) : Number(m.x),
      y: Number(m.y),
      frameSeconds: m.frameSeconds,
    }))
    .filter((m) => m.idolUid && Number.isFinite(m.x) && Number.isFinite(m.y));
  if (!marks.length) return formation;

  const raw = marks.map((m) => ({
    x: clampStageCoord(m.x),
    y: clampStageCoord(m.y),
    row: (m.y >= 58 ? "front" : m.y <= 38 ? "back" : "mid") as FormationRow,
    rowIndex: m.y >= 58 ? 2 : m.y <= 38 ? 0 : 1,
    idolUid: m.idolUid,
  }));

  const mode = resolveCenterMode(formation.centerMode);
  const ordered = orderSlotsCenterOutward(
    raw.map(({ x, y, row, rowIndex }) => ({ x, y, row, rowIndex })),
    mode,
  );

  const used = new Set<number>();
  const n = formation.memberCount;
  const slotIdolUids: Array<string | null> = Array.from({ length: n }, () => null);
  const positions: Array<{ idolUid: string; x: number; y: number }> = [];

  for (let oi = 0; oi < ordered.length && oi < n; oi++) {
    const s = ordered[oi]!;
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < raw.length; i++) {
      if (used.has(i)) continue;
      const d = (raw[i]!.x - s.x) ** 2 + (raw[i]!.y - s.y) ** 2;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    if (best < 0) continue;
    used.add(best);
    const m = raw[best]!;
    slotIdolUids[oi] = m.idolUid;
    positions.push({ idolUid: m.idolUid, x: m.x, y: m.y });
  }

  const rowCount = detectRowCountFromPositions(positions, n);
  return {
    ...formation,
    source: "video_seed",
    slotIdolUids,
    positions,
    videoMarks: formation.videoMarks,
    rowCount,
    layoutId: layoutIdForCount(n, rowCount, resolveLayoutKind(formation.layoutKind)),
    updatedAt: new Date().toISOString(),
  };
}

export function placedIdolUids(formation: SongStartingFormation): string[] {
  return formation.slotIdolUids.filter((u): u is string => !!u);
}

export function unplacedIdolUids(formation: SongStartingFormation, rosterUids: string[]): string[] {
  const placed = new Set(placedIdolUids(formation));
  return rosterUids.filter((uid) => !placed.has(uid));
}

/** Resolve formation: save override → catalog → null. */
export function resolveSongFormation(opts: {
  songUid: string;
  catalog?: SongFormationCatalog | null;
  saveOverrides?: Record<string, SongStartingFormation> | null;
}): SongStartingFormation | null {
  const uid = String(opts.songUid ?? "").trim();
  if (!uid) return null;
  const fromSave = opts.saveOverrides?.[uid];
  if (fromSave) return fromSave;
  return opts.catalog?.formations?.[uid] ?? null;
}

let cachedCatalog: SongFormationCatalog | null = null;
let catalogLoad: Promise<SongFormationCatalog> | null = null;

export async function loadSongFormationCatalog(
  force = false,
): Promise<SongFormationCatalog> {
  if (!force && cachedCatalog) return cachedCatalog;
  if (!force && catalogLoad) return catalogLoad;
  catalogLoad = (async () => {
    try {
      const base = typeof document !== "undefined" && document.baseURI ? document.baseURI : "./";
      const url = new URL("data/song_starting_formations.json", base).href;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const json = await res.json();
      cachedCatalog = normalizeSongFormationCatalog(json);
    } catch {
      cachedCatalog = { schemaVersion: "0.1", formations: {} };
    }
    return cachedCatalog;
  })();
  return catalogLoad;
}

export function normalizeManagedSongFormations(raw: unknown): Record<string, SongStartingFormation> {
  const out: Record<string, SongStartingFormation> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const norm = normalizeSongStartingFormation(value, key);
    if (norm) out[norm.songUid] = norm;
  }
  return out;
}
