import type { LoadedScenario, ScenarioManifest, ScenarioPreset } from "./scenarioTypes";
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

export async function loadScenarioDatabase(preset: ScenarioPreset): Promise<LoadedScenario> {
  const root = `${base()}data/scenarios/${preset.data_subdir}/`;
  const [idols, groups, songs] = await Promise.all([
    fetchJsonArray(`${root}idols.json`),
    fetchJsonArray(`${root}groups.json`),
    fetchJsonArray(`${root}songs.json`),
  ]);
  const ref =
    preset.opening_date && /^\d{4}-\d{2}-\d{2}$/.test(preset.opening_date)
      ? preset.opening_date
      : "2020-01-01";
  applyAttributesToAllIdols(idols, groups, ref);
  return { preset, idols, groups, songs };
}

export async function loadDefaultScenario(): Promise<LoadedScenario> {
  const manifest = await loadManifest();
  const presetId = manifest.defaultPreset ?? manifest.presets[0];
  const preset = await loadPreset(presetId);
  return loadScenarioDatabase(preset);
}
