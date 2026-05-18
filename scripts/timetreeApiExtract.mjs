/**
 * TimeTree public_events API → normalized scrape rows.
 */

import { extractVenue, extractVenueFromNote, isPlaceholderLiveTitle } from "./timetreeEventParse.mjs";

/** @param {number} ms @param {string} [tz] */
export function isoDateInTimezone(ms, tz = "Asia/Tokyo") {
  if (!Number.isFinite(ms)) return null;
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return y && m && d ? `${y}-${m}-${d}` : null;
}

/** @param {Record<string, unknown>} pe */
export function posterUrlsFromPublicEvent(pe) {
  const images = pe.images;
  if (!images || typeof images !== "object") return [];
  const urls = [];
  for (const key of ["cover", "overview"]) {
    const arr = /** @type {Record<string, unknown>} */ (images)[key];
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (item && typeof item === "object") {
        const url = String(/** @type {Record<string, unknown>} */ (item).url ?? "").trim();
        if (url) urls.push(url);
      }
    }
  }
  return [...new Set(urls)];
}

/**
 * @param {Record<string, unknown>} pe
 * @returns {string | null}
 */
export function extractVenueFromPublicEvent(pe) {
  const loc = String(pe.location_name ?? "").trim();
  if (loc) return loc;
  const fromNote = extractVenueFromNote(String(pe.note ?? ""));
  if (fromNote) return fromNote;
  const title = String(pe.title ?? "").trim();
  return extractVenue(title);
}

/**
 * @param {Record<string, unknown>} pe
 * @param {string} slug
 */
export function publicEventToRow(pe, slug) {
  const title = String(pe.title ?? "").trim();
  if (isPlaceholderLiveTitle(title)) return null;

  const tz = String(pe.region_timezone ?? "Asia/Tokyo");
  const date =
    isoDateInTimezone(Number(pe.start_at), tz) ??
    isoDateInTimezone(Number(pe.start_at), "UTC");
  if (!date) return null;

  const id = String(pe.id ?? "").trim();
  const url =
    String(pe.url ?? "").trim() ||
    (id && slug ? `https://timetr.ee/p/${slug}/${id}` : "");

  const venueHint = extractVenueFromPublicEvent(pe);
  const posters = posterUrlsFromPublicEvent(pe);

  const row = {
    date,
    event: title,
    timetree_id: id || undefined,
    timetree_url: url || undefined,
    note: String(pe.note ?? "").trim() || undefined,
    location_name: String(pe.location_name ?? "").trim() || undefined,
    venue_hint: venueHint ?? undefined,
    poster_urls: posters.length ? posters : undefined,
  };
  return row;
}

/** @param {unknown} body */
export function publicEventsFromApiBody(body) {
  if (!body || typeof body !== "object") return [];
  const o = /** @type {Record<string, unknown>} */ (body);
  if (Array.isArray(o.public_events)) return o.public_events;
  if (o.public_event && typeof o.public_event === "object") {
    return [o.public_event];
  }
  return [];
}
