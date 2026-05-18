/**
 * Parse equal-love.jp (and similar) official schedule list HTML.
 */

import { classifyEventType, isOnlineScheduleEvent } from "./timetreeEventParse.mjs";

function decodeHtmlText(s) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

const LIVE_CLASS_TO_SITE = {
  live02: "握手会",
  live03: "ライブ/イベント",
  live04: "メディア",
  live05: "リリース",
  live06: "誕生日",
  live07: "その他",
};

/** @param {string} classAttr e.g. "entry live03 cat12 " */
export function siteCategoryFromEntryClass(classAttr) {
  const m = /\blive(\d{2})\b/.exec(String(classAttr ?? ""));
  if (!m) return null;
  const key = `live${m[1]}`;
  return LIVE_CLASS_TO_SITE[key] ?? null;
}

/** @param {string} siteCategory */
export function typeFromSiteCategory(siteCategory, title) {
  const cat = String(siteCategory ?? "").trim();
  if (cat === "メディア") return "Media";
  if (cat === "リリース") return "Media";
  if (cat === "握手会") return "Meet";
  if (cat === "誕生日") return "Birthday";
  if (cat === "その他") return "Other";
  if (cat === "ライブ/イベント") {
    const t = classifyEventType(String(title ?? ""));
    if (t !== "Other" && t !== "Media" && t !== "Promo") return t;
    const titleS = String(title ?? "");
    if (/FES|フェス|合戦|EXPO|歌合戦|納涼祭/i.test(titleS)) return "Festival";
    if (/TOUR|ツアー|単独|ワンマン|武道館|ARENA|公演|コンサート|収録/i.test(titleS)) return "Concert";
    return "Concert";
  }
  return classifyEventType(String(title ?? "")) || "Other";
}

/** @param {string} title */
export function parseMembersFromTitle(title) {
  const t = String(title ?? "").trim();
  const idx = t.lastIndexOf("※");
  if (idx < 0) return { event: t, members: [] };
  const event = t.slice(0, idx).trim();
  const memberPart = t.slice(idx + 1).trim();
  if (!memberPart) return { event: t, members: [] };
  const members = memberPart
    .split(/[、,／/]/)
    .map((s) => s.trim())
    .filter(Boolean);
  return { event: event || t, members };
}

/** @param {string} title */
export function extractVenueFromOfficialTitle(title) {
  const t = String(title ?? "").trim();
  const prefVenue = /([\u4e00-\u9fff]+[都道府県])・(.+)$/u.exec(t);
  if (prefVenue) {
    return {
      venue: prefVenue[2].trim(),
      venue_hint: `${prefVenue[1]}・${prefVenue[2].trim()}`,
    };
  }
  const atVenue = /[@＠]\s*([^※【（]+?)\s*$/.exec(t);
  if (atVenue) {
    const v = atVenue[1].trim();
    return { venue: v, venue_hint: v };
  }
  return { venue: null, venue_hint: null };
}

/**
 * @param {string} html
 * @param {number} year
 * @param {number} month 1-12
 * @param {string} baseUrl
 */
export function parseOfficialScheduleListHtml(html, year, month, baseUrl = "https://equal-love.jp") {
  const events = [];
  const blocks = String(html).split(/<li class="schedule_entry_box/);

  for (const block of blocks.slice(1)) {
    const dayM = /<span class="md">(\d{1,2})<\/span>/.exec(block);
    if (!dayM) continue;
    const day = Number(dayM[1]);
    if (!Number.isFinite(day) || day < 1 || day > 31) continue;
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

    const rowRe =
      /<div class="entry\s+([^"]*)"[\s\S]*?<a href="([^"]+)"[\s\S]*?<span class="cat\d+">\s*([^<]*)<\/span>\s*<p class="tit">([\s\S]*?)<\/p>/g;

    let m;
    while ((m = rowRe.exec(block)) !== null) {
      const classAttr = m[1];
      const href = m[2];
      const siteCategory = m[3].trim() || siteCategoryFromEntryClass(classAttr);
      const rawTitle = decodeHtmlText(m[4]);
      const { event, members } = parseMembersFromTitle(rawTitle);
      let type = typeFromSiteCategory(siteCategory, event);
      if (isOnlineScheduleEvent({ event, note: "" })) type = "Virtual";
      const { venue, venue_hint } =
        type === "Media" || type === "Promo" || type === "Virtual"
          ? { venue: null, venue_hint: null }
          : extractVenueFromOfficialTitle(event);

      const detailId = /\/schedule\/detail\/(\d+)/.exec(href)?.[1] ?? null;
      const detail_url = href.startsWith("http") ? href : `${baseUrl.replace(/\/$/, "")}${href}`;

      events.push({
        date,
        event,
        event_raw: rawTitle,
        site_category: siteCategory,
        type,
        venue,
        venue_hint,
        members: members.length ? members : undefined,
        official_detail_id: detailId,
        official_detail_url: detail_url,
        source: "official",
      });
    }
  }

  return events;
}
