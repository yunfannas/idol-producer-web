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
    discography: Array<{
      uid?: string;
      title?: string;
      title_romanji?: string;
      disc_type?: string;
      release_date?: string;
      publisher?: string;
      track_list?: string[];
    }>;
  };
  idols: Array<{
    uid: string;
    name: string;
    romaji?: string;
    birthday?: string | null;
    age?: number | null;
    portrait_photo_path?: string | null;
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
