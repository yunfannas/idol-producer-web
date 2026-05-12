import type { LoadedScenario, ScenarioManifest, ScenarioPreset, ScenariosCatalogFile, GroupTierRow } from "./scenarioTypes";
import { applyAttributesToAllIdols } from "../engine/idolAttributes";

function base(): string {
  return import.meta.env.BASE_URL.endsWith("/")
    ? import.meta.env.BASE_URL
    : `${import.meta.env.BASE_URL}/`;
}

export async function loadManifest(): Promise<ScenarioManifest> {
  const url = `${base()}data/scenarios/manifest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load manifest: ${url} (${res.status})`);
  return res.json() as Promise<ScenarioManifest>;
}

/** All scenario slots (1–6) for UX copy; see `docs/WEB_PORT_PLAN.md` §1a. Optional — returns null if missing. */
export async function loadScenariosCatalog(): Promise<ScenariosCatalogFile | null> {
  const url = `${base()}data/scenarios.json`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data: unknown = await res.json();
  if (data && typeof data === "object" && Array.isArray((data as { scenarios?: unknown }).scenarios)) {
    return data as ScenariosCatalogFile;
  }
  return null;
}

export async function loadPreset(presetId: string): Promise<ScenarioPreset> {
  const url = `${base()}data/scenarios/presets/${presetId}.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load preset ${presetId}: ${res.status}`);
  return res.json() as Promise<ScenarioPreset>;
}

async function fetchJsonArray(url: string): Promise<Record<string, unknown>[]> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error(`Expected JSON array from ${url}`);
  return data as Record<string, unknown>[];
}

function songsForScenarioGroups(
  groups: Record<string, unknown>[],
  songsAll: Record<string, unknown>[],
): Record<string, unknown>[] {
  const groupUids = new Set(
    groups
      .map((g) => String((g as { uid?: unknown }).uid ?? "").trim())
      .filter((u) => u.length > 0),
  );
  if (!groupUids.size || !songsAll.length) return songsAll;
  return songsAll.filter((row) => groupUids.has(String((row as { group_uid?: unknown }).group_uid ?? "").trim()));
}

export async function loadScenarioDatabase(preset: ScenarioPreset): Promise<LoadedScenario> {
  const root = `${base()}data/scenarios/${preset.data_subdir}/`;
  const globalSongsUrl = `${base()}data/songs.json`;

  const [idols, groups] = await Promise.all([
    fetchJsonArray(`${root}idols.json`),
    fetchJsonArray(`${root}groups.json`),
  ]);

  let songsAll: Record<string, unknown>[];
  try {
    songsAll = await fetchJsonArray(globalSongsUrl);
  } catch (err) {
    console.error(
      "[idol-producer-web] Failed to load global data/songs.json (per-track catalog). Falling back to scenario songs.json (often release-level rows only).",
      err,
    );
    songsAll = await fetchJsonArray(`${root}songs.json`);
  }

  const songs = songsForScenarioGroups(groups, songsAll);

  const ref =
    preset.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(preset.opening_date)
      ? preset.opening_date
      : "2020-01-01";
  applyAttributesToAllIdols(idols, groups, ref);

  let lives: Record<string, unknown>[] = [];
  try {
    const res = await fetch(`${base()}data/lives.json`);
    if (res.ok) {
      const j: unknown = await res.json();
      if (Array.isArray(j)) lives = j as Record<string, unknown>[];
      else if (j && typeof j === "object" && Array.isArray((j as { lives?: unknown }).lives)) {
        lives = (j as { lives: Record<string, unknown>[] }).lives;
      }
    }
  } catch {
    /* optional catalog */
  }

  let group_tiers: GroupTierRow[] | undefined;
  try {
    const gtRes = await fetch(`${root}group_tiers.json`);
    if (gtRes.ok) {
      const gt: unknown = await gtRes.json();
      if (Array.isArray(gt)) group_tiers = gt as GroupTierRow[];
    }
  } catch {
    /* optional static tiers */
  }

  return { preset, idols, groups, songs, lives, group_tiers };
}

export async function loadDefaultScenario(): Promise<LoadedScenario> {
  const manifest = await loadManifest();
  const presetId = manifest.defaultPreset ?? manifest.presets[0];
  const preset = await loadPreset(presetId);
  return loadScenarioDatabase(preset);
}
