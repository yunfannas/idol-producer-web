/** Scenario preset shipped under public/data/scenarios/presets/ */

/** One row from `public/data/scenarios/<subdir>/group_tiers.json` (static desktop export or generated stub). */
export interface GroupTierRow {
  uid: string;
  letter_tier: string;
  fans: number;
  popularity: number;
  /** Lower = earlier in startup “recommended” ordering (tier S first, then fans). */
  sort_key: number;
}

/** `public/data/scenarios.json` — all scenarios for UX / routing; `data_available` flags shipped bundles. */
export interface ScenarioCatalogEntry {
  scenario_number: number;
  name: string;
  opening_date: string;
  /** Folder under `public/data/scenarios/` when `data_available`. */
  data_subdir: string | null;
  data_available: boolean;
  design_ref?: string;
}

export interface ScenariosCatalogFile {
  document?: string;
  scenarios: ScenarioCatalogEntry[];
}

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

/** Curated new-game group list (`startup_allowlist.json`); `names_in_order` matches `groups[].name`. */
export interface ScenarioStartupAllowlist {
  /** First N entries in `names_in_order` are highlighted as recommended (default 4). */
  recommended_count: number;
  names_in_order: string[];
}

export interface LoadedScenario {
  preset: ScenarioPreset;
  idols: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  songs: Record<string, unknown>[];
  /** Optional `public/data/lives.json` rows (filtered by group in UI). */
  lives?: Record<string, unknown>[];
  /** Optional `public/data/festivals.json` editions. */
  festivals?: Record<string, unknown>[];
  /** Optional static tiers beside `groups.json` (see `docs/WEB_PORT_PLAN.md` §1b). */
  group_tiers?: GroupTierRow[];
  /** When present (scenario 6), new-game picker is restricted to these `name` values in list order. */
  startup_allowlist?: ScenarioStartupAllowlist;
}
