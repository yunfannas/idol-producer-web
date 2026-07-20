export interface WebPreviewBundle {
  bundle_version: number;
  preset: string;
  scenario_number?: number;
  opening_date?: string;
  group: {
    uid: string;
    name: string;
    name_romanji: string;
    nickname?: string;
    formed_date?: string;
    popularity?: number;
    fans?: number;
    description: string;
    member_uids: string[];
    member_names: string[];
    pictures: string[];
    picture_history?: Array<{
      path?: string;
      timestamp?: string;
      effective_date?: string;
      release_date?: string;
      label?: string;
      note?: string;
      source?: string;
      kind?: string;
    }>;
    discography: Array<{
      uid?: string;
      title?: string;
      title_romanji?: string;
      disc_type?: string;
      release_date?: string;
      publisher?: string;
      /** Flat listing when the release has no per-type variants. */
      track_list?: string[];
      /** Tracks shared by every edition; pair with edition_track_lists. */
      shared_track_list?: string[];
      /** Per-edition tail tracks (different couplings/exclusive tracks); labels are UI-only. */
      edition_track_lists?: Array<{ label?: string; track_list?: string[] }>;
      track_song_uids?: string[];
    }>;
  };
  idols: Array<{
    uid: string;
    name: string;
    romaji?: string;
    birthday?: string | null;
    age?: number | null;
    portrait_photo_path?: string | null;
    group_portrait_paths?: Record<string, string>;
    group_portrait_history?: Record<
      string,
      Array<{
        path?: string;
        portrait_photo_path?: string;
        timestamp?: string;
        effective_date?: string;
        release_date?: string;
        label?: string;
        note?: string;
        source?: string;
      }>
    >;
    group_history_in_group: Array<{
      group_name?: string;
      member_name?: string;
      member_color?: string;
      start_date?: string;
    }>;
  }>;
  export_notes: {
    missing_idol_rows: string[];
    idol_count: number;
  };
}
