/** Scenario preset shipped under public/data/scenarios/presets/ */

export interface ScenarioPreset {
  id: string;
  name: string;
  scenario_number: number;
  opening_date: string;
  /** Folder under public/data/scenarios/ containing idols.json, groups.json, songs.json */
  data_subdir: string;
  startup_view?: string;
  startup_group?: string;
}

export interface ScenarioManifest {
  presets: string[];
  defaultPreset: string;
}

export interface LoadedScenario {
  preset: ScenarioPreset;
  idols: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  songs: Record<string, unknown>[];
}
