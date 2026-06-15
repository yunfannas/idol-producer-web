/**
 * Parse 高嶺のなでしこ official Event Organiser single-event pages.
 * Calendar AJAX is WAF-blocked; use wp-sitemap-posts-event-*.xml + /events/event/… URLs.
 */

import { classifyEventType, enrichTimetreeEvent } from "./timetreeEventParse.mjs";

function decodeHtmlText(s) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Decode entities on one line; keep internal spacing (no cross-line collapse). */
function decodeHtmlLine(s) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#8217;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

/** Block tags → newlines; inline tags removed without breaking date/venue lines. */
function htmlToNewsPlainText(contentHtml) {
  const lines = String(contentHtml)
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .split(/\r?\n/)
    .map((l) => decodeHtmlLine(l))
    .filter(Boolean);
  return lines.join("\n");
}

/** @param {string} html */
function extractEntryContentHtml(html) {
  const h = String(html);
  const m =
    h.match(/class="entry-content[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<div class="section-inner">/i) ||
    h.match(/class="entry-content[^"]*"[^>]*>([\s\S]*?)<nav class="pagination-single"/i);
  return m?.[1] ?? "";
}

/** @param {string} contentHtml */
function extractVenueFromContentHtml(contentHtml) {
  const block = String(contentHtml);
  const labeled =
    block.match(/▼会場\s*(?:<br[^>]*>)?\s*([^<\n]+)/i) ||
    block.match(/会場\s*(?:<br[^>]*>)?\s*([^<\n]+)/i);
  if (labeled) return decodeHtmlText(labeled[1]);
  const atVenue = decodeHtmlText(block.replace(/<[^>]+>/g, "\n")).match(/@\s*([^\n▼]+)/);
  return atVenue?.[1]?.trim() || null;
}

/** @param {string} html */
function extractSiteCategory(html) {
  const h = String(html);
  const meta =
    h.match(/class="eo-event-meta"[\s\S]*?events\/category\/([^/"']+)[^>]*>([^<]+)/i) ||
    h.match(/events\/category\/([^/"']+)[^>]*>([^<]+)/i);
  if (meta) {
    return decodeHtmlText(meta[2]) || categoryLabelFromSlug(meta[1]);
  }
  const slug = h.match(/events\/category\/([^/"']+)/i)?.[1] ?? "";
  return categoryLabelFromSlug(slug);
}

/** @param {string} html */
export function parseTakanenEventPageHtml(html, pageUrl) {
  const h = String(html);
  const title =
    decodeHtmlText(h.match(/<h1[^>]*class="[^"]*entry-title[^"]*"[^>]*>([\s\S]*?)<\/h1>/i)?.[1]) ||
    decodeHtmlText(h.match(/<title>([^<|]+)/i)?.[1]) ||
    "";

  const start =
    h.match(/itemprop="startDate"\s+datetime="(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    h.match(/<time[^>]+datetime="(\d{4}-\d{2}-\d{2})/i)?.[1] ||
    null;
  const end =
    h.match(/itemprop="endDate"\s+datetime="(\d{4}-\d{2}-\d{2})/i)?.[1] || start;

  const siteCategory = extractSiteCategory(h);
  const contentHtml = extractEntryContentHtml(h);
  const contentText = decodeHtmlText(contentHtml.replace(/<[^>]+>/g, "\n"));
  const venue = extractVenueFromContentHtml(contentHtml);
  const note = contentText.slice(0, 4000);
  const type = typeFromTakanenCategory(siteCategory, title, note);

  const slug = decodeURIComponent(new URL(pageUrl).pathname.replace(/\/$/, "").split("/").pop() ?? "");

  const enriched = enrichTimetreeEvent({
    date: start,
    event: title,
    note,
    venue_hint: venue,
    venue: type === "Media" || type === "Virtual" || type === "TvShow" ? null : venue,
  });

  const finalType = typeFromTakanenCategory(siteCategory, title, note) || enriched.type || type;

  return {
    date: start,
    end_date: end !== start ? end : undefined,
    event: title || enriched.event,
    event_raw: title,
    site_category: siteCategory,
    type: finalType,
    venue:
      finalType === "Media" || finalType === "Virtual" || finalType === "TvShow"
        ? null
        : enriched.venue ?? venue,
    venue_hint: venue,
    note: note.slice(0, 4000),
    official_detail_url: pageUrl,
    official_detail_slug: slug,
    source: "official",
    ...(enriched.gameplay_status ? { gameplay_status: enriched.gameplay_status } : {}),
    ...(enriched.pending_feature ? { pending_feature: enriched.pending_feature } : {}),
    ...(enriched.performance_songs_min != null ? { performance_songs_min: enriched.performance_songs_min } : {}),
    ...(enriched.performance_songs_max != null ? { performance_songs_max: enriched.performance_songs_max } : {}),
    ...(enriched.is_live != null ? { is_live: enriched.is_live } : {}),
  };
}

/** @param {string} slug */
function categoryLabelFromSlug(slug) {
  const s = String(slug ?? "").toLowerCase();
  if (s.includes("media") || s.includes("tv") || s.includes("radio")) return "メディア";
  if (s.includes("release")) return "リリース";
  if (s.includes("birthday")) return "誕生日";
  if (s.includes("meet") || s.includes("handshake")) return "握手会";
  return "ライブ/イベント";
}

/** @param {string} siteCategory @param {string} title @param {string} note */
function typeFromTakanenCategory(siteCategory, title, note) {
  const blob = `${title}\n${note}`;
  if (/NATSLIVE|natslive\.jp|配信が決定/.test(blob)) return "Virtual";
  if (/誕生日/.test(title)) return "Birthday";
  if (/ラジオ定期|毎週.*放送|\bFM\b.*放送/.test(blob)) return "Media";
  if (/KANSAI\s+COLLECTION|IDOL\s+COLLECTION|GirlsAward|RUNWAY/i.test(blob)) return "Media";
  if (/LuckyFes|Lucky\s*Fes/i.test(title)) return "Festival";
  const cat = String(siteCategory ?? "").trim();
  if (/メディア|リリース|放送/.test(cat)) return "Media";
  if (/握手会/.test(cat)) return "Meet";
  if (/誕生日/.test(cat)) return "Birthday";
  return classifyEventType(blob) || "Other";
}

/** Post-parse venue/type fixes for known festival patterns. */
export function applyTakanenEventOverrides(row) {
  const t = String(row.event ?? "");
  if (/3rd ANNIVERSARY/i.test(t) && row.venue) {
    row.type = "Concert";
  }
  if (/TOKYO\s+IDOL\s+FESTIVAL|TIF/i.test(t)) {
    row.venue = "お台場臨海公園（TIF・複数ステージ）";
    row.venue_hint = row.venue_hint ?? "TIF2026";
  }
  if (/LuckyFes/i.test(t) && !row.venue) {
    row.venue = "国営ひたち海浜公園";
    row.venue_hint = "国営ひたち海浜公園";
  }
  return row;
}

const NEWS_SKIP_TITLE =
  /欠席|振替|返金|感染症|当日販売|申込|キャンペーン|くじ|スタンプラリー|シェア|整列|引換|振替に関する|返品のお知らせ|座席割当て間違い|お詫び/i;

const NEWS_INCLUDE_TITLE =
  /スケジュール公開|開催決定|出演決定|公演決定|3rd ANNIVERSARY CONCERT|ANNIVERSARY CONCERT|Live Tour|LIVE TOUR|たかねこフェス|ハニフェス|年末大感謝祭|ソウル|ワンマン|リリースイベント|リリース記念|配信リリース|配信決定|クリスマスパーティ|東名阪ツアー|Spring Ride|Bouquet of 9 Flowers/i;

const NEWS_SEARCH_QUERIES = [
  "スケジュール公開",
  "開催決定",
  "Live Tour",
  "東名阪ツアー",
  "Bouquet",
  "3rd ANNIVERSARY",
  "たかねこフェス",
  "ハニフェス",
  "年末大感謝祭",
  "ソウル",
  "リリースイベント",
];

/** @param {string} url @param {Record<string, string>} headers @param {number} tries */
async function fetchJsonPosts(url, headers, tries = 3) {
  for (let i = 0; i < tries; i += 1) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) return null;
      const data = await res.json();
      return Array.isArray(data) ? data : null;
    } catch (err) {
      if (i === tries - 1) throw err;
      await new Promise((r) => setTimeout(r, 400 * (i + 1)));
    }
  }
  return null;
}

/** @param {string} postDateIso @param {number} month */
function inferEventYear(postDateIso, month) {
  const [py, pm] = String(postDateIso ?? "2025-01-01").slice(0, 10).split("-").map(Number);
  let y = py;
  if (month < pm - 1) y += 1;
  return y;
}

/** @param {string} postDateIso @param {number} month @param {number} day */
function inferEventYearMd(postDateIso, month, day) {
  const post = String(postDateIso ?? "2025-01-01").slice(0, 10);
  const [py, pm, pd] = post.split("-").map(Number);
  let y = py;
  if (month < pm || (month === pm && day < pd)) y += 1;
  return y;
}

/** @param {number} y @param {number} m @param {number} d */
function isoDate(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** @param {string} locationVenue */
function splitPrefectureVenue(locationVenue) {
  const t = String(locationVenue ?? "").trim();
  const m = /^([\u4e00-\u9fff]+[都道府県])・(.+)$/.exec(t);
  if (m) return { venue: m[2].trim(), venue_hint: t };
  if (/^WEB・|^オンライン|^WEB/i.test(t)) return { venue: null, venue_hint: t };
  return { venue: t.replace(/[：:].*$/, "").trim(), venue_hint: t };
}

/** @param {string} postTitle @param {string} activity */
function eventTitleFromNews(postTitle, activity) {
  const title = decodeHtmlText(postTitle.replace(/<[^>]+>/g, ""));
  const act = String(activity ?? "").trim();
  const album = /1st ALBUM「見上げるたびに、恋をする。」/.test(title)
    ? "1st ALBUM「見上げるたびに、恋をする。」"
    : null;
  if (/3rd ANNIVERSARY/i.test(title)) {
    return "3rd ANNIVERSARY CONCERT「A Wonderful Encounter」";
  }
  if (/Live Tour.*Bouquet of 9 Flowers|LIVE TOUR 2026|Bouquet of 9 Flowers/i.test(title)) {
    const base = "Live Tour – Bouquet of 9 Flowers –";
    if (/in Seoul|ソウル/i.test(title)) return `${base} in Seoul`;
    if (/in Taipei|台北/i.test(title)) return `${base} in Taipei`;
    if (/FINAL/i.test(title)) return `${base} FINAL`;
    if (/LIVE TOUR 2026/.test(title)) return base;
    return base;
  }
  if (/東名阪ツアー.*Spring Ride|Spring Ride/i.test(title)) {
    return "東名阪ツアー2025 – Spring Ride –";
  }
  if (/たかねこフェス/i.test(title)) {
    const m = /たかねこフェス\s*Vol\.?\s*(\d+)/i.exec(title);
    return m ? `たかねこフェス vol.${m[1]}` : "たかねこフェス";
  }
  if (/TAKANE NO NADESHIKO LIVE.*SEOUL|ソウルワンマン/i.test(title)) {
    return "TAKANE NO NADESHIKO LIVE 2025 SUMMER in SEOUL";
  }
  if (/年末大感謝祭/i.test(title)) return "高嶺のなでしこ 年末大感謝祭2025";
  if (/(\d{4})年(\d{1,2})月(\d{1,2})日.*幕張.*3周年|3周年.*幕張/i.test(title)) {
    return "3rd ANNIVERSARY CONCERT「A Wonderful Encounter」";
  }
  if (album) return `${album} リリースイベント`;
  if (act) return act.length > 80 ? `${title.slice(0, 60)}（${act.slice(0, 40)}）` : `${title.split("【")[0].trim()}（${act}）`;
  return title.split("【")[0].trim().slice(0, 120);
}

/** @param {number} m @param {number} d */
function isValidCalendarDate(m, d) {
  return m >= 1 && m <= 12 && d >= 1 && d <= 31;
}

/** @param {string} line */
function isTicketPeriodLine(line) {
  if (/(OPEN|START|公演|会場|ホール|Zepp|PIT|arena|会堂|イベントホール|フェス)/i.test(line)) return false;
  return /\d{1,2}:\d{2}|：\d{2}|～\s*\d{1,2}月|~\d{1,2}月|\d{1,2}～\d{1,2}月/.test(line);
}

/** @param {string} line */
function isLikelyEventScheduleLine(line) {
  if (isTicketPeriodLine(line)) return false;
  if (/受付|抽選|先行|決済|キャンセル|メールにご案内|販売開始/i.test(line)) return false;
  return true;
}

/** @param {Record<string, unknown>} row */
function isValidNewsScheduleRow(row) {
  const [y, m, d] = String(row.date ?? "").split("-").map(Number);
  if (!y || !isValidCalendarDate(m, d)) return false;
  const venue = String(row.venue ?? "");
  if (/^（[月火水木金土日]）\d{1,2}$/.test(venue)) return false;
  if (venue === "?" || venue === "12" || venue === "17") return false;
  const note = String(row.note ?? "");
  if (isTicketPeriodLine(note) && (!venue || venue.length < 5)) return false;
  return true;
}

/** @param {string} postTitle @param {string} activity @param {string} note */
function typeFromNews(postTitle, activity, note) {
  const blob = `${postTitle}\n${activity}\n${note}`;
  if (/個別.*(サイン|2ショット|撮影|握手)|開催記念.*(サイン|2ショット|撮影)/i.test(blob)) return "Meet";
  if (
    /3rd ANNIVERSARY|ANNIVERSARY CONCERT|ワンマン|Live Tour|ツアー|たかねこフェス|ハニフェス|年末大感謝祭/i.test(
      blob,
    ) &&
    /幕張|代々木|Zepp|会場|PIT|forum|ホール|arena|会堂|イベントホール/i.test(blob)
  ) {
    return "Concert";
  }
  if (/オンライン|WEB・|配信|natslive|ニコ生/i.test(blob)) return "Virtual";
  if (/握手会|サイン会|撮影会|お話し会|チェキ|2ショット/i.test(blob) && !/ミニライブ|ワンマン|CONCERT|Tour/i.test(postTitle)) {
    return "Meet";
  }
  if (/COLLECTION|RUNWAY|GirlsAward/i.test(blob)) return "Media";
  if (/TAKANE NO NADESHIKO LIVE.*SEOUL|ソウルワンマン|年末大感謝祭/i.test(blob)) return "Concert";
  if (/3rd ANNIVERSARY|ワンマン|ONEMAN|Live Tour|ツアー/i.test(blob)) return "Concert";
  if (/ハニフェス|フェス|FES|Festival/i.test(blob)) return "Festival";
  return classifyEventType(blob) || "Other";
}

/** @param {string} s */
function looksLikeVenueName(s) {
  return /ホール|PIT|Zepp|arena|forum|会堂|イベントホール|センター|プラザ|MOONDOG|WANDERLOCH/i.test(
    String(s ?? ""),
  );
}

/**
 * @param {string} text
 * @param {{ title: string, link: string, date: string }} post
 */
function newsRow(post, { date, event, activity, venueRaw, note, typeOverride }) {
  let venuePart = venueRaw ?? "";
  if (!venuePart && looksLikeVenueName(activity)) venuePart = String(activity).trim();
  const { venue, venue_hint } = splitPrefectureVenue(venuePart);
  const type = typeOverride ?? typeFromNews(post.title, activity ?? "", note ?? "");
  const eventTitle = event ?? eventTitleFromNews(post.title, activity ?? "");
  return {
    date,
    event: eventTitle,
    event_raw: eventTitle,
    site_category: "お知らせ",
    type,
    venue: type === "Virtual" || type === "Media" ? null : venue,
    venue_hint,
    note: (note ?? "").slice(0, 4000),
    official_detail_url: post.link,
    official_detail_slug: new URL(post.link).pathname.replace(/\/$/, "").split("/").pop() ?? "",
    source: "official_news",
  };
}

/** @param {string} titleText @param {{ title: string, link: string, date: string }} post */
function parseNewsTitleRows(titleText, post) {
  const rows = [];
  const title = decodeHtmlText(titleText.replace(/<[^>]+>/g, ""));

  const datedVenue = title.match(
    /^(\d{4})年(\d{1,2})月(\d{1,2})日[^　]*?(?:東京|大阪|名古屋|神奈川|愛知|埼玉|千葉|福岡|北海道|宮城|京都|兵庫)?[：:]\s*([^「]+?)(?:\s*「|$)/,
  );
  if (datedVenue) {
    const date = isoDate(Number(datedVenue[1]), Number(datedVenue[2]), Number(datedVenue[3]));
    rows.push(
      newsRow(post, {
        date,
        venueRaw: datedVenue[4].trim(),
        note: title,
      }),
    );
  }

  const titleDateVenue = title.match(
    /(?:at\s+|＠|@)?([^【]+?)?【(\d{1,2})月(\d{1,2})日[^】]*】/,
  );
  if (titleDateVenue && !datedVenue) {
    const y = inferEventYear(post.date, Number(titleDateVenue[2]));
    const date = isoDate(y, Number(titleDateVenue[2]), Number(titleDateVenue[3]));
    rows.push(
      newsRow(post, {
        date,
        venueRaw: titleDateVenue[1]?.replace(/^at\s+/i, "").trim(),
        note: title,
      }),
    );
  }

  const titleFull = title.match(
    /(\d{4})年(\d{1,2})月(\d{1,2})日[^　]*?(幕張[^\s]+|国立代々木[^\s]+)/,
  );
  if (titleFull && !rows.length) {
    rows.push(
      newsRow(post, {
        date: isoDate(Number(titleFull[1]), Number(titleFull[2]), Number(titleFull[3])),
        venueRaw: titleFull[4],
        note: title,
        typeOverride: "Concert",
      }),
    );
  }

  return rows;
}

/**
 * @param {string} text
 * @param {{ title: string, link: string, date: string }} post
 */
function parseNewsScheduleRows(text, post) {
  const rows = [];
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  // Block: 日付：YYYY年M月D日 / 会場：
  const dateBlock = text.match(/日付[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/i);
  const venueBlock = text.match(/会場[：:]\s*([^\n\[]+)/i);
  if (dateBlock) {
    const date = isoDate(Number(dateBlock[1]), Number(dateBlock[2]), Number(dateBlock[3]));
    rows.push(
      newsRow(post, {
        date,
        venueRaw: venueBlock ? decodeHtmlLine(venueBlock[1]) : null,
        note: text,
      }),
    );
  }

  // 日程：2026年4月11日(土) / 日 程：8月24日(日) + 会 場：
  for (let i = 0; i < lines.length; i += 1) {
    const withYear = lines[i].match(/日\s*程[：:]\s*(\d{4})年(\d{1,2})月(\d{1,2})日/i);
    const mdOnly = !withYear && lines[i].match(/日\s*程[：:]\s*(\d{1,2})月(\d{1,2})日/i);
    if (!withYear && !mdOnly) continue;
    const y = withYear ? Number(withYear[1]) : inferEventYear(post.date, Number(mdOnly[1]));
    const mo = withYear ? Number(withYear[2]) : Number(mdOnly[1]);
    const d = withYear ? Number(withYear[3]) : Number(mdOnly[2]);
    const vm =
      lines[i + 1]?.match(/会\s*場[：:]\s*(.+)/i) ||
      lines.slice(i, i + 4).join("\n").match(/会\s*場[：:]\s*(.+)/i);
    rows.push(
      newsRow(post, {
        date: isoDate(y, mo, d),
        venueRaw: vm ? decodeHtmlLine(vm[1]) : null,
        note: lines.slice(i, i + 4).join("\n"),
      }),
    );
  }

  // Lines: 11月1日(土) 神奈川県・横浜YTJホール：個別握手会
  for (const line of lines) {
    if (!isLikelyEventScheduleLine(line)) continue;
    const m =
      /^(\d{4}年)?(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?\s*(.+?)[：:]\s*(.+)$/.exec(line) ||
      /^(\d{4}年)?(\d{1,2})月(\d{1,2})日(?:\([^)]*\))?\s+(.+)$/.exec(line);
    if (!m) continue;
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (!isValidCalendarDate(mo, d)) continue;
    const y = m[1] ? Number(m[1].replace("年", "")) : inferEventYear(post.date, mo);
    const date = isoDate(y, mo, d);
    const tail = m[4] ?? "";
    const activity = m[5] ?? tail;
    const locVenue = m[5] ? tail : "";
    rows.push(
      newsRow(post, {
        date,
        activity: activity || locVenue,
        venueRaw: locVenue,
        note: line,
      }),
    );
  }

  // ■2025年5月6日(火祝) 岡谷鋼機名古屋公会堂 / ■2026年5月6日（水・祝）東京国際フォーラム ホールA
  for (const line of lines) {
    const m =
      /^■\s*(\d{4})年(\d{1,2})月(\d{1,2})日(?:\([^)]*\)|（[^）]*）)?\s*(.+)$/.exec(line);
    if (!m) continue;
    const venuePart = m[4].replace(/\s+OPEN\s.*/i, "").trim();
    rows.push(
      newsRow(post, {
        date: isoDate(Number(m[1]), Number(m[2]), Number(m[3])),
        venueRaw: venuePart,
        note: line,
      }),
    );
  }

  // ■2/14（土）＠Zepp Sapporo  (Bouquet tour legs)
  for (const line of lines) {
    const m = /^■\s*(\d{1,2})\s*\/\s*(\d{1,2})（[^）]*）\s*[＠@]\s*(.+)$/.exec(line);
    if (!m) continue;
    const y = inferEventYearMd(post.date, Number(m[1]), Number(m[2]));
    rows.push(
      newsRow(post, {
        date: isoDate(y, Number(m[1]), Number(m[2])),
        venueRaw: m[3],
        note: line,
      }),
    );
  }

  // ■2025年10月29日（水） + [会場] 豊洲PIT on next lines (skip if venue is on same line)
  for (let i = 0; i < lines.length; i += 1) {
    const m = /^■\s*(\d{4})年(\d{1,2})月(\d{1,2})日(?:（[^）]*）|\([^)]*\))?/.exec(lines[i]);
    if (!m) continue;
    if (/\d{1,2}月\d{1,2}日(?:（[^）]*）|\([^)]*\))?\s+\S/.test(lines[i])) continue;
    let venueRaw = null;
    for (let j = i + 1; j < Math.min(i + 5, lines.length); j += 1) {
      const venueInline = lines[j].match(/^\[会場\]\s*(.+)$/);
      if (venueInline) {
        venueRaw = venueInline[1].trim();
        break;
      }
      if (/^\[会場\]$/.test(lines[j]) && lines[j + 1]) {
        venueRaw = lines[j + 1];
        break;
      }
      const vm = lines[j].match(/^会場[：:]\s*(.+)/i);
      if (vm) {
        venueRaw = vm[1];
        break;
      }
    }
    rows.push(
      newsRow(post, {
        date: isoDate(Number(m[1]), Number(m[2]), Number(m[3])),
        venueRaw,
        note: lines.slice(i, i + 5).join("\n"),
      }),
    );
  }

  return rows.filter(isValidNewsScheduleRow);
}

/** @param {Record<string, unknown>} post WP REST post */
export function parseTakanenNewsPost(post) {
  const title = String(post.title?.rendered ?? post.title ?? "");
  const titlePlain = decodeHtmlText(title.replace(/<[^>]+>/g, ""));
  if (NEWS_SKIP_TITLE.test(titlePlain)) return [];

  const link = String(post.link ?? "");
  const date = String(post.date ?? "").slice(0, 10);
  const contentHtml = String(post.content?.rendered ?? "");
  const text = htmlToNewsPlainText(contentHtml);

  const include =
    NEWS_INCLUDE_TITLE.test(titlePlain) ||
    /日付[：:]\s*\d{4}年/.test(text) ||
    /^\d{1,2}月\d{1,2}日/m.test(text) ||
    /日程[：:]\s*\d{4}年/.test(text) ||
    /日\s*程[：:]\s*\d/.test(text) ||
    /^■\s*\d{4}年/m.test(text) ||
    /^■\s*\d{1,2}\s*\//m.test(text) ||
    /^\d{4}年\d{1,2}月\d{1,2}日[^　]*?[：:]/m.test(titlePlain);

  if (!include) return [];

  const postMeta = { title, link, date };
  const titleRows = parseNewsTitleRows(title, postMeta);

  if (/開催記念.*(サイン|2ショット|撮影)|キャラアニ・チャンス|当日販売のお知らせ/i.test(titlePlain)) {
    const seen = new Set();
    return titleRows.filter((row) => {
      if (!isValidNewsScheduleRow(row)) return false;
      const key = `${row.date}\t${row.event}\t${row.venue ?? ""}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const rows = [...titleRows, ...parseNewsScheduleRows(text, postMeta)];

  // Dedupe within post (same date+event)
  const seen = new Set();
  return rows.filter((row) => {
    if (!isValidNewsScheduleRow(row)) return false;
    const key = `${row.date}\t${row.event}\t${row.venue ?? ""}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Group launch; oldest WP post is 2022-08-01. */
const NEWS_POSTS_AFTER = "2022-08-01T00:00:00";

/**
 * @param {string} baseUrl
 * @param {Record<string, string>} headers
 * @returns {Promise<string[]>}
 */
async function collectTakanenNewsSlugsFromSitemap(baseUrl, headers) {
  const root = baseUrl.replace(/\/$/, "");
  const res = await fetch(`${root}/wp-sitemap-posts-post-1.xml`, { headers });
  if (!res.ok) return [];
  const xml = await res.text();
  return [
    ...new Set(
      [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => new URL(m[1]).pathname.replace(/\/$/, "").split("/").pop())
        .filter(Boolean),
    ),
  ];
}

/**
 * @param {string} root
 * @param {string[]} slugs
 * @param {Record<string, string>} headers
 * @param {Map<number, Record<string, unknown>>} postsById
 */
async function fetchPostsBySlugs(root, slugs, headers, postsById) {
  const batchSize = 50;
  for (let i = 0; i < slugs.length; i += batchSize) {
    const batch = slugs.slice(i, i + batchSize);
    const url = `${root}/wp-json/wp/v2/posts?slug=${batch.map(encodeURIComponent).join(",")}&per_page=100`;
    const posts = await fetchJsonPosts(url, headers);
    if (!posts?.length) continue;
    for (const post of posts) {
      if (post?.id) postsById.set(post.id, post);
    }
    await new Promise((r) => setTimeout(r, 120));
  }
}

/**
 * @param {string} baseUrl
 * @param {string} fromYm
 * @param {string} toYm
 */
export async function fetchTakanenNewsScheduleRows(baseUrl, fromYm, toYm) {
  const root = baseUrl.replace(/\/$/, "");
  const headers = { "user-agent": "idol-producer-web/0.1 (official schedule scrape)" };

  /** @type {Map<number, Record<string, unknown>>} */
  const postsById = new Map();

  async function addPostsFromUrl(url) {
    const posts = await fetchJsonPosts(url, headers);
    if (!posts) return;
    for (const post of posts) {
      if (post?.id) postsById.set(post.id, post);
    }
  }

  const slugs = await collectTakanenNewsSlugsFromSitemap(baseUrl, headers);
  if (slugs.length) {
    await fetchPostsBySlugs(root, slugs, headers, postsById);
  }

  for (let page = 1; page <= 15; page += 1) {
    const url = `${root}/wp-json/wp/v2/posts?per_page=100&page=${page}&after=${encodeURIComponent(NEWS_POSTS_AFTER)}&orderby=date&order=desc`;
    const posts = await fetchJsonPosts(url, headers);
    if (!posts?.length) break;
    for (const post of posts) {
      if (post?.id) postsById.set(post.id, post);
    }
    if (posts.length < 100) break;
    await new Promise((r) => setTimeout(r, 120));
  }

  for (const q of NEWS_SEARCH_QUERIES) {
    for (let page = 1; page <= 3; page += 1) {
      const url = `${root}/wp-json/wp/v2/posts?per_page=100&page=${page}&search=${encodeURIComponent(q)}&after=${encodeURIComponent(NEWS_POSTS_AFTER)}&orderby=date&order=desc`;
      await addPostsFromUrl(url);
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  /** @type {Record<string, unknown>[]} */
  const rows = [];
  for (const post of postsById.values()) {
    rows.push(...parseTakanenNewsPost(post));
  }

  return rows.filter((row) => row.date && dateInRange(String(row.date), fromYm, toYm));
}

/**
 * @param {string} baseUrl
 * @returns {Promise<string[]>}
 */
export async function collectTakanenEventPageUrls(baseUrl) {
  const root = baseUrl.replace(/\/$/, "");
  const urls = new Set();

  const sitemapUrl = `${root}/wp-sitemap-posts-event-1.xml`;
  const sitemapRes = await fetch(sitemapUrl, {
    headers: { "user-agent": "idol-producer-web/0.1 (official schedule scrape)" },
  });
  if (sitemapRes.ok) {
    for (const u of uniqueEventUrlsFromSitemap(await sitemapRes.text())) urls.add(u.split("#")[0]);
  }

  for (const cat of ["live", "media", "birthday", "other", "release"]) {
    for (let page = 1; page <= 10; page += 1) {
      const path = page === 1 ? `/events/category/${cat}/` : `/events/category/${cat}/page/${page}/`;
      const res = await fetch(`${root}${path}`, {
        headers: { "user-agent": "idol-producer-web/0.1 (official schedule scrape)" },
      });
      if (!res.ok) break;
      const html = await res.text();
      const found = [
        ...html.matchAll(/href=\"(https:\/\/takanenonadeshiko\.jp\/events\/event\/[^\"#?]+)/g),
      ].map((m) => m[1]);
      if (!found.length) break;
      const before = urls.size;
      for (const u of found) urls.add(u);
      if (urls.size === before) break;
      await new Promise((r) => setTimeout(r, 120));
    }
  }

  return [...urls];
}

/** @param {Record<string, unknown>} row */
export function takanenRowDedupeKey(row) {
  const date = String(row.date ?? "");
  const event = String(row.event ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const note = String(row.note ?? "")
    .normalize("NFKC")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  const blob = `${event}\n${note}`;
  if (/3rd anniversary|3周年/.test(blob)) return `${date}\t3rd anniversary`;
  if (/bouquet of 9 flowers|bouquet.*9 flowers/.test(blob)) {
    if (/final|東京国際フォーラム/.test(blob)) return `${date}\tbouquet final`;
    if (/taipei|台北|moondog/.test(blob)) return `${date}\tbouquet taipei`;
    if (/seoul|ソウル|wanderloch|yes24/.test(blob)) return `${date}\tbouquet seoul`;
    return `${date}\tbouquet tour`;
  }
  return `${date}\t${event}`;
}

/** Prefer the row with richer venue/note when dedupe keys collide. */
export function pickBetterTakanenRow(a, b) {
  const score = (row) =>
    (row.venue ? 4 : 0) +
    (row.venue_uid ? 2 : 0) +
    (/FINAL|in Seoul|in Taipei/i.test(String(row.event ?? "")) ? 1 : 0) +
    Math.min(String(row.note ?? "").length, 500) / 500;
  const aWins = score(a) >= score(b);
  const winner = { ...(aWins ? a : b) };
  const other = aWins ? b : a;
  if (!winner.venue && other.venue) {
    winner.venue = other.venue;
    winner.venue_hint = other.venue_hint;
    winner.venue_uid = other.venue_uid;
  }
  if (/FINAL|in Seoul|in Taipei/i.test(String(other.event ?? "")) && !/FINAL|in Seoul|in Taipei/i.test(String(winner.event ?? ""))) {
    winner.event = other.event;
    winner.event_raw = other.event_raw;
  }
  if (String(other.note ?? "").length > String(winner.note ?? "").length) {
    winner.note = other.note;
  }
  return winner;
}

/**
 * @param {string} sitemapXml
 * @returns {string[]}
 */
export function uniqueEventUrlsFromSitemap(sitemapXml) {
  return [
    ...new Set(
      [...String(sitemapXml).matchAll(/<loc>([^<]+)<\/loc>/g)]
        .map((m) => m[1].trim())
        .filter((u) => /\/events\/event\//i.test(u)),
    ),
  ];
}

function ymKeyFromIso(iso) {
  const m = /^(\d{4})-(\d{2})-\d{2}$/.exec(String(iso ?? "").trim());
  return m ? `${m[1]}-${m[2]}` : "";
}

function ymSerial(ym) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(ym ?? "").trim());
  if (!m) return null;
  return Number(m[1]) * 12 + (Number(m[2]) - 1);
}

function enumerateYmRange(fromYm, toYm) {
  const start = ymSerial(fromYm);
  const end = ymSerial(toYm);
  if (start == null || end == null || end < start) return [];
  const out = [];
  for (let serial = start; serial <= end; serial += 1) {
    const y = Math.floor(serial / 12);
    const mo = (serial % 12) + 1;
    out.push(`${y}-${String(mo).padStart(2, "0")}`);
  }
  return out;
}

/**
 * Best-effort scrape from the official schedule page's month calendar.
 * Uses the rendered FullCalendar instance and navigates month-by-month.
 *
 * @param {string} scheduleUrl
 * @param {string} fromYm
 * @param {string} toYm
 * @param {{ headless?: boolean, delayMs?: number }} [opts]
 */
export async function collectTakanenCalendarEventRows(scheduleUrl, fromYm, toYm, opts = {}) {
  let chromium;
  try {
    ({ chromium } = await import("playwright"));
  } catch {
    return {
      rows: [],
      attempted_months: enumerateYmRange(fromYm, toYm),
      blocked_months: [],
      blocked: false,
      error: "Playwright not installed",
    };
  }

  const attemptedMonths = enumerateYmRange(fromYm, toYm);
  const blockedMonths = new Set();
  /** @type {Map<string, Record<string, unknown>>} */
  const rowsByKey = new Map();

  const browser = await chromium
    .launch({ headless: opts.headless ?? true, channel: "chrome" })
    .catch(() => chromium.launch({ headless: opts.headless ?? true }));
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
    locale: "ja-JP",
    timezoneId: "Asia/Tokyo",
  });
  const page = await context.newPage();

  let currentMonthAttempt = attemptedMonths[0] ?? null;
  page.on("response", (res) => {
    if (!res.url().includes("eventorganiser-fullcal")) return;
    if (res.status() === 403 && currentMonthAttempt) blockedMonths.add(currentMonthAttempt);
  });

  try {
    await page.goto(scheduleUrl, { waitUntil: "networkidle", timeout: 120_000 });
    const hasCalendar = await page.evaluate(() => Boolean(window.jQuery?.fn?.fullCalendar && window.jQuery("#eo_fullcalendar_1").length));
    if (!hasCalendar) {
      return {
        rows: [],
        attempted_months: attemptedMonths,
        blocked_months: [],
        blocked: false,
        error: "FullCalendar not found on schedule page",
      };
    }

    for (const ym of attemptedMonths) {
      currentMonthAttempt = ym;
      await page.evaluate(
        async ({ iso, delayMs }) => {
          const $ = window.jQuery;
          const cal = $("#eo_fullcalendar_1");
          cal.fullCalendar("gotoDate", iso);
          cal.fullCalendar("changeView", "month");
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        },
        { iso: `${ym}-01`, delayMs: opts.delayMs ?? 1200 },
      );

      const rows = await page.evaluate(() => {
        const $ = window.jQuery;
        const cal = $("#eo_fullcalendar_1");
        return cal.fullCalendar("clientEvents").map((ev) => {
          const startIso = ev.start?.format ? ev.start.format("YYYY-MM-DD") : null;
          const endIso = ev.end?.format ? ev.end.format("YYYY-MM-DD") : null;
          return {
            date: startIso,
            end_date: endIso && endIso !== startIso ? endIso : undefined,
            event: String(ev.title ?? "").trim(),
            event_raw: String(ev.title ?? "").trim(),
            official_detail_url: typeof ev.url === "string" ? ev.url : null,
            source: "official-calendar",
          };
        });
      });

      for (const row of rows) {
        if (ymKeyFromIso(row.date) !== ym) continue;
        const key = `${String(row.date ?? "")}\t${String(row.event ?? "")}\t${String(row.official_detail_url ?? "")}`;
        if (!rowsByKey.has(key)) rowsByKey.set(key, row);
      }
    }
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
  }

  return {
    rows: [...rowsByKey.values()],
    attempted_months: attemptedMonths,
    blocked_months: [...blockedMonths],
    blocked: blockedMonths.size > 0,
  };
}

/**
 * @param {string} date YYYY-MM-DD
 * @param {string} from YYYY-MM
 * @param {string} to YYYY-MM
 */
export function dateInRange(date, from, to) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) return false;
  const d = String(date).slice(0, 7);
  return d >= from && d <= to;
}
