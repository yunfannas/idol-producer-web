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

export interface OfficialScheduleEvent {
  date: string;
  event: string;
  event_raw?: string;
  site_category?: string;
  type?: string;
  venue?: string | null;
  venue_hint?: string | null;
  venue_uid?: string;
  members?: string[];
  is_live?: boolean;
  official_detail_id?: string;
  official_detail_url?: string;
  source?: string;
}

export interface OfficialScheduleBundle {
  source?: string;
  group_key: string;
  group_name: string;
  aliases?: string[];
  file?: string;
  range?: { from?: string; to?: string };
  generated_at?: string;
  event_count?: number;
  events: OfficialScheduleEvent[];
}

export interface OfficialScheduleManifestEntry {
  group_key: string;
  group_name: string;
  file: string;
  aliases?: string[];
}

export interface OfficialScheduleManifest {
  groups: OfficialScheduleManifestEntry[];
}

export interface SharedReleaseGroupEdition {
  group_uid?: string;
  group_name?: string;
  edition_label?: string;
  title_override?: string;
  catalog_number?: string;
  track_list?: string[];
  track_song_uids?: string[];
  tracks?: SharedReleaseTrackRow[];
}

export interface SharedReleaseTrackRow {
  title: string;
  title_romanji?: string;
  group_uid?: string;
  group_name?: string;
  song_uid?: string;
}

export interface SharedReleaseRow {
  uid: string;
  title: string;
  title_romanji?: string;
  disc_type?: string;
  release_date?: string;
  publisher?: string | null;
  publisher_uid?: string | null;
  catalog_number?: string;
  description?: string;
  cover_image_path?: string | null;
  group_uids?: string[];
  group_names?: string[];
  shared_track_list?: string[];
  shared_track_song_uids?: string[];
  shared_tracks?: SharedReleaseTrackRow[];
  group_editions?: SharedReleaseGroupEdition[];
}

export interface LoadedScenario {
  preset: ScenarioPreset;
  idols: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  songs: Record<string, unknown>[];
  shared_releases?: SharedReleaseRow[];
  /** Optional `public/data/lives.json` rows (filtered by group in UI). */
  lives?: Record<string, unknown>[];
  /** Optional `public/data/festivals.json` editions. */
  festivals?: Record<string, unknown>[];
  /** Optional static tiers beside `groups.json` (see `support/docs/WEB_PORT_PLAN.md` §1b). */
  group_tiers?: GroupTierRow[];
  /** When present (scenario 6), new-game picker is restricted to these `name` values in list order. */
  startup_allowlist?: ScenarioStartupAllowlist;
  /** Optional official group/member schedule bundles for Media and Schedule views. */
  official_schedules?: OfficialScheduleBundle[];
}
