import {
  PALETTE_COLORS,
  normalizePalette,
  type PaletteColor,
  type PaletteVector,
} from "./paletteSystem";

export type MakingStage = "concept" | "writing" | "composition" | "arrangement" | "recording" | "mastering" | "ready" | "released";

export interface MakingProject {
  uid: string;
  title: string;
  group_uid: string;
  stage: MakingStage;
  target_color: PaletteColor;
  palette_direction: PaletteVector;
  started_on: string;
  last_advanced_on: string;
  source_song_uid?: string;
  released_song_uid?: string;
  spent_yen: number;
}

export const MAKING_STAGES: MakingStage[] = ["concept", "writing", "composition", "arrangement", "recording", "mastering", "ready", "released"];

const STAGE_COST: Record<MakingStage, number> = {
  concept: 0,
  writing: 50_000,
  composition: 80_000,
  arrangement: 120_000,
  recording: 200_000,
  mastering: 60_000,
  ready: 0,
  released: 0,
};

function stageAfter(stage: MakingStage): MakingStage {
  return MAKING_STAGES[Math.min(MAKING_STAGES.indexOf(stage) + 1, MAKING_STAGES.length - 2)]!;
}

function uniqueUid(seed: string): string {
  return `${seed}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function makeProject(
  groupUid: string,
  startedOn: string,
  teamPalette: PaletteVector,
  options: { title?: string; targetColor?: PaletteColor; sourceSongUid?: string; stage?: MakingStage; sourcePalette?: PaletteVector | null } = {},
): MakingProject {
  const base = options.sourcePalette ?? teamPalette;
  const paletteDirection = normalizePalette(base);
  const targetColor = PALETTE_COLORS.reduce((best, color) => paletteDirection[color] > paletteDirection[best] ? color : best, PALETTE_COLORS[0]);
  return {
    uid: uniqueUid("making"),
    title: options.title?.trim() || "Untitled original",
    group_uid: groupUid,
    stage: options.stage ?? "concept",
    target_color: targetColor,
    // The palette is a production outcome and becomes read-only to the player.
    // New work starts from the established Team Palette (or source work).
    palette_direction: paletteDirection,
    started_on: startedOn,
    last_advanced_on: startedOn,
    ...(options.sourceSongUid ? { source_song_uid: options.sourceSongUid } : {}),
    spent_yen: 0,
  };
}

export function normalizeMakingProjects(raw: unknown): MakingProject[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const row = item as Record<string, unknown>;
    const groupUid = String(row.group_uid ?? "").trim();
    if (!groupUid) return [];
    const stage = MAKING_STAGES.includes(row.stage as MakingStage) ? (row.stage as MakingStage) : "concept";
    const targetColor = PALETTE_COLORS.includes(row.target_color as PaletteColor) ? (row.target_color as PaletteColor) : "pink";
    return [{
      uid: String(row.uid ?? "").trim() || `making-${index + 1}`,
      title: String(row.title ?? "").trim() || "Untitled original",
      group_uid: groupUid,
      stage,
      target_color: targetColor,
      palette_direction: normalizePalette(row.palette_direction as Partial<Record<PaletteColor, unknown>>),
      started_on: String(row.started_on ?? "").split("T")[0] || "2020-01-01",
      last_advanced_on: String(row.last_advanced_on ?? "").split("T")[0] || "2020-01-01",
      ...(String(row.source_song_uid ?? "").trim() ? { source_song_uid: String(row.source_song_uid).trim() } : {}),
      ...(String(row.released_song_uid ?? "").trim() ? { released_song_uid: String(row.released_song_uid).trim() } : {}),
      spent_yen: Math.max(0, Number(row.spent_yen ?? 0) || 0),
    }];
  });
}

export function nextMakingStep(project: MakingProject): { stage: MakingStage; cost_yen: number } | null {
  if (project.stage === "ready" || project.stage === "released") return null;
  const stage = stageAfter(project.stage);
  return { stage, cost_yen: STAGE_COST[stage] };
}

export function advanceMakingProject(project: MakingProject, onDate: string): { project: MakingProject; cost_yen: number } | null {
  const next = nextMakingStep(project);
  if (!next) return null;
  return {
    cost_yen: next.cost_yen,
    project: { ...project, stage: next.stage, last_advanced_on: onDate, spent_yen: project.spent_yen + next.cost_yen },
  };
}

export function releaseSongFromProject(project: MakingProject, releaseDate: string): { project: MakingProject; song: Record<string, unknown> } | null {
  if (project.stage !== "ready") return null;
  const uid = uniqueUid("original-song");
  return {
    project: { ...project, stage: "released", released_song_uid: uid, last_advanced_on: releaseDate },
    song: {
      uid,
      group_uid: project.group_uid,
      title: project.title,
      title_romanji: project.title,
      release_date: releaseDate,
      disc_type: "Digital single",
      popularity: 0,
      palette_direction: project.palette_direction,
      making_project_uid: project.uid,
      generated_in_game: true,
    },
  };
}
