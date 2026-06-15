/**
 * Cross-group live dedupe keys, name normalization, and time parsing.
 */

import crypto from "node:crypto";
import { stripVenueFromTitle } from "./timetreeEventParse.mjs";

const ROMAN_MAP = new Map([
  ["Ⅰ", "I"],
  ["Ⅱ", "II"],
  ["Ⅲ", "III"],
  ["Ⅳ", "IV"],
  ["Ⅴ", "V"],
  ["Ⅵ", "VI"],
  ["Ⅶ", "VII"],
  ["Ⅷ", "VIII"],
  ["Ⅸ", "IX"],
  ["Ⅹ", "X"],
]);

/** @param {string} s */
export function normalizeLiveName(s) {
  let t = String(s ?? "")
    .normalize("NFKC")
    .replace(/[\uFE0F\u200B]/g, "")
    .replace(/^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}]+/u, "")
    .trim();
  t = stripVenueFromTitle(t);
  t = t.replace(/[「」『』【】[\]()（）]/g, " ").replace(/\s+/g, " ").trim();
  for (const [from, to] of ROMAN_MAP) {
    t = t.replaceAll(from, to);
  }
  return t;
}

/** @param {string} s */
function keyPart(s) {
  return normalizeLiveName(s).toLowerCase().replace(/\s+/g, " ");
}

/**
 * Stable dedupe key: same calendar day + normalized show name (venue excluded).
 * @param {{ date: string, name: string }} p
 */
export function liveMatchKey({ date, name }) {
  const d = String(date ?? "").trim();
  const n = keyPart(name);
  return `${d}|${n}`;
}

/** @param {string} matchKey */
export function liveUidFromMatchKey(matchKey) {
  const hex = crypto.createHash("sha256").update(matchKey).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

/**
 * @param {string | null | undefined} note
 * @returns {{ start_time: string | null, end_time: string | null }}
 */
export function parseLiveTimesFromNote(note) {
  const text = String(note ?? "");
  const liveSlot =
    /LIVE[：:]\s*(\d{1,2}:\d{2})\s*[-–—~〜]\s*(\d{1,2}:\d{2})/i.exec(text) ??
    /出演\s*(\d{1,2}:\d{2})\s*[-–—~〜]\s*(\d{1,2}:\d{2})/i.exec(text);
  if (liveSlot) {
    return { start_time: liveSlot[1], end_time: liveSlot[2] };
  }
  const startOnly = /開演\s*(\d{1,2}:\d{2})/.exec(text) ?? /START\s*(\d{1,2}:\d{2})/i.exec(text);
  if (startOnly) {
    return { start_time: startOnly[1], end_time: null };
  }
  return { start_time: null, end_time: null };
}

/**
 * @param {Array<{ venue?: string | null, venue_uid?: string | null, poster_image_url?: string | null }>} rows
 */
export function pickBestVenueFields(rows) {
  let venue = null;
  let venue_uid = null;
  let poster_image_url = null;
  for (const r of rows) {
    if (!venue_uid && r.venue_uid) {
      venue_uid = r.venue_uid;
      venue = r.venue ?? venue;
    }
  }
  if (!venue) {
    for (const r of rows) {
      if (r.venue) {
        venue = r.venue;
        venue_uid = r.venue_uid ?? venue_uid;
        break;
      }
    }
  }
  for (const r of rows) {
    if (!poster_image_url && r.poster_image_url) poster_image_url = r.poster_image_url;
  }
  return { venue, venue_uid, poster_image_url };
}

/**
 * @param {import('./liveCatalogMatch.mjs').LiveEventsCatalog | null | undefined} catalog
 * @param {string} matchKey
 */
export function lookupCatalogVenue(catalog, matchKey) {
  if (!catalog?.events?.length) return null;
  const hit = catalog.events.find((e) => e.match_key === matchKey);
  if (!hit?.venue) return null;
  return {
    venue: hit.venue,
    venue_uid: hit.venue_uid ?? null,
    poster_image_url: hit.poster_image_url ?? null,
  };
}

/**
 * @typedef {Object} LiveAttendee
 * @property {string} group_name
 * @property {string} timetree_slug
 * @property {string} [timetree_event_id]
 * @property {string} [timetree_url]
 * @property {string} [calendar_title]
 */

/**
 * @typedef {Object} LiveCatalogEvent
 * @property {string} uid
 * @property {string} match_key
 * @property {string} name
 * @property {string} date
 * @property {string | null} start_time
 * @property {string | null} end_time
 * @property {string} event_type
 * @property {string | null} venue
 * @property {string | null} venue_uid
 * @property {string | null} poster_image_url
 * @property {string[]} with_groups
 * @property {LiveAttendee[]} attending_groups
 */

/**
 * @typedef {Object} LiveEventsCatalog
 * @property {number} version
 * @property {string} generated_at
 * @property {string[]} source_files
 * @property {Record<string, string>} slug_groups
 * @property {number} event_count
 * @property {LiveCatalogEvent[]} events
 */
