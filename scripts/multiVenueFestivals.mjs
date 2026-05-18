/**
 * Multi-venue idol festivals (circuit / gate style): one event, many halls.
 */

/** @typedef {{ venue_area: string, venues: string[], venue_summary?: string }} MultiVenueFest */

/** Canonical venue lists keyed by liveMatchKey date|name */
export const MULTI_VENUE_FESTIVALS = {
  "2025-08-13|neo kassen 2025": {
    venue_area: "渋谷",
    venue_summary: "渋谷（複数会場フェス）",
    venues: [
      "Spotify O-EAST",
      "Spotify O-WEST",
      "Spotify O-nest",
      "Spotify O-Crest",
      "clubasia",
      "duo MUSIC EXCHANGE",
      "WOMB",
      "SHIBUYA RING",
      "SHIBUYA DESEO",
    ],
  },
  "2026-05-05|歌舞伎町up gate↑↑2026": {
    venue_area: "新宿",
    venue_summary: "新宿（複数会場フェス）",
    venues: [
      "Zepp Shinjuku",
      "APEXIA",
      "新宿LOFT",
      "SHINJUKU WALLY",
      "新宿MARZ",
      "Zirco TOKYO",
      "新宿DHNoA",
      "新宿Biske",
      "シアターマーキュリー新宿",
      "新宿motion",
      "歌舞伎町タワーステージ",
    ],
  },
  "2025-10-11|kabukilling circuit!! 2025": {
    venue_area: "歌舞伎町",
    venue_summary: "歌舞伎町（複数会場フェス）",
    venues: [
      "KABUKICHO TOWER STAGE",
      "JAM17 SPACE WEST",
      "Zirco Tokyo",
      "東急歌舞伎町タワー FIRST STAGE",
    ],
  },
  "2025-08-03|tokyo idol festival": {
    venue_area: "お台場",
    venue_summary: "お台場臨海公園（TIF・複数ステージ）",
    venues: ["浮き島ステージ", "DOLL FACTORY"],
  },
  "2025-07-30|sweet summer 2025": {
    venue_area: "渋谷",
    venue_summary: "渋谷（複数会場フェス）",
    venues: ["WWW X", "Veats SHIBUYA", "SHIBUYA VIDENT"],
  },
  "2025-09-20|バンドじゃないもん!maxx nakayosh pre. nakayoshi fes.2025": {
    venue_area: "渋谷",
    venue_summary: "渋谷（複数会場フェス）",
    venues: [
      "Spotify O-EAST",
      "Spotify O-WEST",
      "Spotify O-nest",
      "duo MUSIC EXCHANGE",
      "WOMBLIVE",
      "clubasia",
    ],
  },
};

/**
 * Parse 📍 line with slash-separated venues from TimeTree note.
 * @param {string | null | undefined} note
 * @returns {string[]}
 */
export function parseSlashVenuesFromNote(note) {
  const text = String(note ?? "");
  const m = /📍\s*([^\n]+)/.exec(text);
  if (!m) return [];
  return m[1]
    .split(/[/／]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * @param {string} matchKey
 * @param {{ note?: string | null }} [row]
 * @returns {MultiVenueFest | null}
 */
export function multiVenueFestForMatchKey(matchKey, row = {}) {
  const known = MULTI_VENUE_FESTIVALS[matchKey];
  if (known) return known;
  const fromNote = parseSlashVenuesFromNote(row.note);
  if (fromNote.length >= 2) {
    return {
      venue_area: null,
      venue_summary: fromNote.join(" / "),
      venues: fromNote,
    };
  }
  return null;
}

/**
 * Apply multi-venue festival fields onto a timetree / catalog row (mutates).
 * @param {Record<string, unknown>} row
 * @param {string} matchKey
 */
export function applyMultiVenueFestival(row, matchKey) {
  const spec = multiVenueFestForMatchKey(matchKey, row);
  if (!spec) return false;
  row.type = "Festival";
  row.event_type = "Festival";
  row.venue_mode = "multi_venue_festival";
  row.venue_area = spec.venue_area ?? null;
  row.venues = spec.venues;
  row.venue = spec.venue_summary ?? (spec.venue_area ? `${spec.venue_area}（複数会場）` : spec.venues.join(" / "));
  row.venue_uid = null;
  return true;
}
