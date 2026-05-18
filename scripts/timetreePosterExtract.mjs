/**
 * Parse live info from TimeTree poster OCR text and calendar notes.
 */

import {
  extractVenueFromNote,
  isCommercialPromoEvent,
  isPlaceholderLiveTitle,
  isVirtualLiveEvent,
} from "./timetreeEventParse.mjs";
import { findVenueInCatalog, loadVenuesCatalog, normalizeVenueKey } from "./timetreeVenueDb.mjs";

/** @param {Record<string, unknown>} row */
export function posterUrlsFor(row) {
  const urls = [];
  if (row.poster_image_url) urls.push(String(row.poster_image_url));
  if (Array.isArray(row.poster_urls)) {
    for (const u of row.poster_urls) {
      if (u && !urls.includes(u)) urls.push(String(u));
    }
  }
  return urls;
}

/** Live events whose venue exists only on the poster (no resolved venue yet). */
export function isImageOnlyLive(row) {
  if (row.venue) return false;
  if (!posterUrlsFor(row).length) return false;
  const title = String(row.event ?? "").trim();
  if (isPlaceholderLiveTitle(title)) return false;
  const type = String(row.type ?? "");
  if (type === "Media" || type === "Cancelled" || type === "Virtual" || type === "Promo") return false;
  if (isVirtualLiveEvent(row) || isCommercialPromoEvent(row)) return false;
  return true;
}

/** @param {string | null | undefined} note */
export function noteVenueHints(note) {
  const hints = [];
  const fromAt = extractVenueFromNote(note);
  if (fromAt) hints.push({ source: "note @line", text: fromAt });
  const text = String(note ?? "");
  const loc = /📍\s*([^\n]+)/g;
  let m;
  while ((m = loc.exec(text)) !== null) {
    const t = m[1].trim();
    if (t && !/^STAGE/i.test(t)) hints.push({ source: "note 📍", text: t });
  }
  return hints;
}

/** Known JP venue phrases that survive noisy OCR when spaces are stripped. */
const COMPACT_VENUE_PHRASES = [
  ["幕張海浜公園", "幕張海浜公園"],
  ["イベントブロック特設会場", "幕張海浜公園 イベントブロック特設会場"],
  ["東急動物公園", "東急動物公園"],
  ["東武動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["東誌動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["東急動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["イベントステージHOLA", "東武動物公園 イベントステージ HOLA!"],
  ["イベントステージ", "東武動物公園 イベントステージ HOLA!"],
  ["関ケ原メモリアルホール", "関ケ原メモリアルホール"],
  ["関す原", "関ケ原メモリアルホール"],
];

const AT_VENUE =
  /(?:^|[\s、,])(?:[@＠②]|会場[:：]|venue[:：])\s*([A-Za-z0-9\u3040-\u30FF\u4E00-\u9FFF][A-Za-z0-9\u3040-\u30FF\u4E00-\u9FFF\s・.]{1,60})/gim;

const ROMAN_VENUE =
  /\b(SHIBUYA\s+(?:DIVE|VIDENT|PLEASURE\s+PLEASURE|RING)|Zepp\s+[\w\s]+|Spotify\s+O-(?:EAST|WEST|nest|Crest)|豊洲PIT|EX\s+THEATER\s+ROPPONGI|KABUKICHO\s+TOWER\s+STAGE)\b/gi;

const JP_VENUE_TOKEN =
  /([^、,\n]{2,40}(?:ホール|hall|PIT|シアター|theater|会館|ガーデン|ステージ|STAGE|ドーム|公園|ライブハウス|BOX|UNIT|WALLY|MARZ|motion|LOFT|Zepp))/gi;

/**
 * @param {string} text
 * @param {Map<string, unknown>} [venueIndex]
 */
export function parseLiveInfoFromText(text, venueIndex = null) {
  const raw = String(text ?? "");
  const compact = raw.replace(/\s+/g, "");

  /** @type {Set<string>} */
  const venue_strings = new Set();
  /** @type {{ name: string, uid: string }[]} */
  const catalog_venues = [];
  const dates = [];
  const times = [];
  const urls = [];

  for (const [needle, label] of COMPACT_VENUE_PHRASES) {
    if (compact.includes(needle.replace(/\s+/g, ""))) venue_strings.add(label);
  }

  let m;
  AT_VENUE.lastIndex = 0;
  while ((m = AT_VENUE.exec(raw)) !== null) {
    const v = m[1].replace(/\s+/g, " ").trim().replace(/[|｜].*$/, "");
    if (v.length >= 2 && v.length < 80) venue_strings.add(v);
  }

  ROMAN_VENUE.lastIndex = 0;
  while ((m = ROMAN_VENUE.exec(raw)) !== null) {
    venue_strings.add(m[1].replace(/\s+/g, " ").trim());
  }

  JP_VENUE_TOKEN.lastIndex = 0;
  while ((m = JP_VENUE_TOKEN.exec(raw)) !== null) {
    const v = m[1].replace(/\s+/g, " ").trim();
    if (v.length >= 3 && v.length < 60 && !/^DAY\d/i.test(v)) venue_strings.add(v);
  }

  for (const dm of raw.matchAll(/\b(20\d{2})[./年](\d{1,2})[./月](\d{1,2})/g)) {
    dates.push(`${dm[1]}-${dm[2].padStart(2, "0")}-${dm[3].padStart(2, "0")}`);
  }
  for (const dm of raw.matchAll(/(\d{1,2})月(\d{1,2})日/g)) {
    dates.push(`month-day:${dm[1]}-${dm[2]}`);
  }

  for (const tm of raw.matchAll(/(?:OPEN|開場)\s*(\d{1,2}:\d{2})/gi)) {
    times.push({ kind: "open", value: tm[1] });
  }
  for (const tm of raw.matchAll(/(?:START|開演)\s*(\d{1,2}:\d{2})/gi)) {
    times.push({ kind: "start", value: tm[1] });
  }

  for (const um of raw.matchAll(/https?:\/\/[^\s)\]】]+/g)) {
    urls.push(um[0].replace(/[.,;]+$/, ""));
  }

  if (venueIndex) {
    const seenUid = new Set();
    for (const name of venue_strings) {
      const hit = findVenueInCatalog(name, venueIndex);
      if (hit) {
        const uid = String(/** @type {Record<string, unknown>} */ (hit).uid ?? "");
        if (!seenUid.has(uid)) {
          seenUid.add(uid);
          catalog_venues.push({
            name: String(/** @type {Record<string, unknown>} */ (hit).name ?? name),
            uid,
          });
        }
      }
    }
    for (const row of venueIndex.values()) {
      const r = /** @type {Record<string, unknown>} */ (row);
      const name = String(r.name ?? "");
      if (name.length < 5) continue;
      const key = normalizeVenueKey(name);
      if (key.length < 5) continue;
      const compactKey = key.replace(/\s+/g, "");
      if (compact.includes(compactKey) || normalizeVenueKey(raw).includes(key)) {
        const uid = String(r.uid ?? "");
        if (!seenUid.has(uid)) {
          seenUid.add(uid);
          catalog_venues.push({ name, uid });
          venue_strings.add(name);
        }
      }
    }
  }

  return {
    venue_strings: [...venue_strings],
    catalog_venues,
    dates: [...new Set(dates)],
    times,
    ticket_urls: [...new Set(urls)],
  };
}

/** @param {Record<string, unknown>} row @param {string} ocrText */
export function extractFromEvent(row, ocrText) {
  const { venues: catalogRows } = loadVenuesCatalog();
  const venueIndex = new Map();
  for (const v of catalogRows) {
    const r = /** @type {Record<string, unknown>} */ (v);
    const name = String(r.name ?? "").trim();
    const romaji = String(r.name_romanji ?? "").trim();
    if (name) venueIndex.set(normalizeVenueKey(name), r);
    if (romaji) venueIndex.set(normalizeVenueKey(romaji), r);
  }

  const noteHints = noteVenueHints(row.note);
  const fromOcr = parseLiveInfoFromText(ocrText, venueIndex);
  const fromNote = parseLiveInfoFromText(
    [row.note, ...noteHints.map((h) => h.text)].filter(Boolean).join("\n"),
    venueIndex,
  );

  const mergedVenues = [...new Set([...fromOcr.venue_strings, ...fromNote.venue_strings, ...noteHints.map((h) => h.text)])];
  const mergedCatalog = [...fromOcr.catalog_venues, ...fromNote.catalog_venues];
  const byUid = new Map();
  for (const v of mergedCatalog) byUid.set(v.uid, v);

  return {
    note_venue_hints: noteHints,
    extracted: {
      venue_strings: mergedVenues,
      catalog_venues: [...byUid.values()],
      dates: [...new Set([...fromOcr.dates, ...fromNote.dates])],
      times: [...fromOcr.times, ...fromNote.times],
      ticket_urls: [...new Set([...fromOcr.ticket_urls, ...fromNote.ticket_urls])],
    },
  };
}

/** Pick best single venue for auto-apply when confidence is high. */
export function pickPrimaryVenue(extracted) {
  const cats = extracted.catalog_venues ?? [];
  if (cats.length === 1) {
    return { venue: cats[0].name, venue_uid: cats[0].uid, confidence: "high" };
  }
  const strings = extracted.venue_strings ?? [];
  const roman = strings.filter((s) => /^(SHIBUYA|Zepp|Spotify|豊洲)/i.test(s));
  if (roman.length === 1) {
    return { venue: roman[0], venue_uid: null, confidence: "medium" };
  }
  return { venue: null, venue_uid: null, confidence: "low" };
}
