/**
 * Heuristic parse of TimeTree public-calendar event titles (JP idol scene).
 */

/** TBA placeholders on public calendars — not real shows; skip scrape/catalog/OCR. */
export function isPlaceholderLiveTitle(title) {
  const t = String(title ?? "").trim();
  if (!t) return true;
  if (t === "ライブ予定") return true;
  if (/^(?:名古屋|大阪)?LIVE予定$/.test(t)) return true;
  if (/イベント予定$/.test(t)) return true;
  return false;
}

/** Store campaigns, collab goods, PR windows — not a single live; skip catalog / managed schedules. */
export function isCommercialPromoEvent(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  const note = String(row?.note ?? "");
  const blob = `${title}\n${note}`;

  if (/ライブ[・･]特典会の実施はありません/.test(note)) return true;
  if (/全店で.*コラボを実施|round1\.co\.jp\/collaboration/i.test(blob)) return true;
  if (/[（(]\s*[〜~～]\s*\d{1,2}\/\d{1,2}\s*まで\s*[）)]/.test(title)) return true;
  if (/キャンペーン開始\s*[（(]?\s*[〜~～]/.test(title)) return true;
  if (/ラウンドワン\s*[×x]\s*/i.test(title) && /コラボ/i.test(title)) return true;
  if (/コラボ\s*[（(]\s*[〜~～]\d/.test(title)) return true;
  return false;
}

/** Online-only (streaming, オンラインサイン会, etc.) — no physical venue. */
export function isOnlineScheduleEvent(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  const note = String(row?.note ?? "");
  const blob = `${title}\n${note}`;
  if (/オンライン/i.test(blob)) return true;
  if (/\bonline\b/i.test(blob)) return true;
  return false;
}

/**
 * TV music-show open recording (1–2 songs on stage). Gameplay: pending → Making › TV show.
 * @param {{ event?: string, event_raw?: string, note?: string }} row
 */
export function isTvOpenRecordingEvent(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  const note = String(row?.note ?? "");
  return /公開収録/.test(`${title}\n${note}`);
}

/** Save / schedule field: future UI in Making › TV show (song pick, etc.). */
export const TV_SHOW_PENDING_FEATURE = "making_tv_show";

/** Offline appearance (no live set) — future UI in Making › offline event. */
export const OFFLINE_EVENT_PENDING_FEATURE = "making_offline_event";

/** Guest / invitation appearance with mini-live — future UI in Making › guest live. */
export const GUEST_LIVE_PENDING_FEATURE = "making_guest_live";

/** NPB / guest slot titles that imply a pro-baseball stadium guest set. */
const NPB_GAME_TITLE =
  /(?:プロ野球|カープ|タイガース|ファイターズ|マリーンズ|ベイスターズ|巨人|ドラゴンズ|スワローズ|イーグルス|バッファローズ|ホークス|ライオンズ).{0,24}戦/u;

/**
 * Guest invitation at a venue with a fixed song count (not general ticket sales).
 * @param {{ event?: string, event_raw?: string, note?: string }} row
 */
export function isGuestLiveEvent(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  const note = String(row?.note ?? "");
  const blob = `${title}\n${note}`;
  if (/始球式|ファーストピッチ|スペシャルミニライブ/.test(blob)) return true;
  if (NPB_GAME_TITLE.test(title)) return true;
  return false;
}

/** @type {{ test: RegExp, venue: string, venue_hint?: string, capacity?: number, city?: string }[]} */
const GUEST_LIVE_VENUE_RULES = [
  {
    test: /広島東洋カープ.*阪神タイガース|カープ.*タイガース.*始球式/u,
    venue: "Mazda Zoom-Zoom Stadium Hiroshima",
    venue_hint: "Mazda Zoom-Zoom Stadium Hiroshima（マツダスタジアム）",
    capacity: 33000,
    city: "Hiroshima",
  },
  {
    test: /日本ハムファイターズ.*ロッテマリーンズ|ファイターズ.*マリーンズ/u,
    venue: "エスコンフィールドHOKKAIDO",
    venue_hint: "エスコンフィールドHOKKAIDO（北海道北広島市）",
    capacity: 35000,
    city: "Hokkaido",
  },
];

/**
 * @param {{ event?: string, event_raw?: string }} row
 */
export function resolveGuestLiveVenue(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  for (const rule of GUEST_LIVE_VENUE_RULES) {
    if (rule.test.test(title)) {
      return {
        venue: rule.venue,
        venue_hint: rule.venue_hint ?? rule.venue,
        capacity: rule.capacity ?? null,
        city: rule.city ?? null,
      };
    }
  }
  return { venue: null, venue_hint: null, capacity: null, city: null };
}

/**
 * Physical appearance without a live performance (TV taping, obstacle qualifier, ceremony, etc.).
 * @param {{ event?: string, event_raw?: string, note?: string }} row
 */
export function isOfflineNonLiveEvent(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  const note = String(row?.note ?? "");
  const blob = `${title}\n${note}`;
  if (isGuestLiveEvent(row)) return false;
  if (/SASUKE\s*アイドル予選会/i.test(blob)) return true;
  if (/プロ野球大会議/.test(blob)) return true;
  if (/＋LIVE2|芸人\s*MUSIC\s*DAY/i.test(blob)) return true;
  if (/オープニングセレモニー/.test(blob)) return true;
  if (/舞台挨拶|先行上映会/.test(blob)) return true;
  if (/メギド.*XR\s*Live|XR\s*Live.*メギド/i.test(blob)) return true;
  if (/トークショー|機運醸成プロジェクト/.test(blob)) return true;
  return false;
}

/** @type {{ test: RegExp, venue: string, venue_hint?: string }[]} */
const OFFLINE_EVENT_VENUE_RULES = [
  {
    test: /SASUKE\s*アイドル予選会/i,
    venue: "LaLa arena TOKYO-BAY",
    venue_hint: "千葉県・LaLa arena TOKYO-BAY",
  },
];

/**
 * @param {{ event?: string, event_raw?: string }} row
 */
export function resolveOfflineEventVenue(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  for (const rule of OFFLINE_EVENT_VENUE_RULES) {
    if (rule.test.test(title)) {
      return { venue: rule.venue, venue_hint: rule.venue_hint ?? rule.venue };
    }
  }
  return { venue: null, venue_hint: null };
}

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
export function applyTvShowGameplayPending(row) {
  if (!isTvOpenRecordingEvent(row) && String(row?.type ?? "") !== "TvShow") return false;
  row.type = "TvShow";
  row.venue = null;
  row.venue_hint = null;
  delete row.venue_uid;
  row.gameplay_status = "pending";
  row.pending_feature = TV_SHOW_PENDING_FEATURE;
  row.performance_songs_min = 1;
  row.performance_songs_max = 2;
  return true;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
export function applyOfflineEventGameplayPending(row) {
  if (!isOfflineNonLiveEvent(row) && String(row?.type ?? "") !== "OfflineEvent") return false;
  row.type = "OfflineEvent";
  row.is_live = false;
  row.gameplay_status = "pending";
  row.pending_feature = OFFLINE_EVENT_PENDING_FEATURE;
  const { venue, venue_hint } = resolveOfflineEventVenue(row);
  if (venue) {
    row.venue = venue;
    row.venue_hint = venue_hint;
  }
  return true;
}

/**
 * @param {Record<string, unknown>} row
 * @returns {boolean}
 */
export function applyGuestLiveGameplayPending(row) {
  if (!isGuestLiveEvent(row) && String(row?.type ?? "") !== "GuestLive") return false;
  row.type = "GuestLive";
  row.is_live = true;
  row.gameplay_status = "pending";
  row.pending_feature = GUEST_LIVE_PENDING_FEATURE;
  row.performance_songs = 10;
  row.performance_songs_min = 10;
  row.performance_songs_max = 10;
  row.attendance_model = "invitation_fee";
  row.ticket_sale = false;
  const { venue, venue_hint } = resolveGuestLiveVenue(row);
  if (venue) {
    row.venue = venue;
    row.venue_hint = venue_hint;
  }
  return true;
}

/** Online / metaverse streams — no physical venue; skip catalog, managed schedules, OCR. */
export function isVirtualLiveEvent(row) {
  const title = String(row?.event_raw ?? row?.event ?? "").trim();
  const note = String(row?.note ?? "");
  const blob = `${title}\n${note}`;
  if (isOnlineScheduleEvent(row)) return true;
  if (/Life\s+Like\s+a\s+Live/i.test(blob)) return true;
  if (/zan-live\.com/i.test(blob)) return true;
  if (/バーチャル世界|バーチャル(?:限定)?ライブ|メタバース/.test(blob)) return true;
  return false;
}

const VENUE_AT = /[@＠]\s*([^【（\]]+)$/;
const NOTE_VENUE_LINE = /^[@＠]\s*(.+?)\s*$/;

function cleanVenueFragment(s) {
  let venue = String(s ?? "").trim();
  venue = venue.replace(/【[^】]*】.*$/, "").trim();
  venue = venue.replace(/\s*【[^】]*】\s*$/, "").trim();
  venue = venue.replace(/[🎙🎟📍🌟].*$/u, "").trim();
  return venue || null;
}

function normTitle(title) {
  return title
    .replace(/^[\s\p{Extended_Pictographic}\p{Emoji_Presentation}]+/u, "")
    .replace(/\uFE0F/g, "")
    .trim();
}

/** @returns {string | null} */
export function extractVenue(title) {
  const t = title.trim();
  if (!t) return null;
  // "@ JAM EXPO" — @ is part of the event name, not a venue marker.
  if (/^@\s*\S/.test(t) && (t.match(/[@＠]/g) ?? []).length === 1) return null;

  const m = t.match(VENUE_AT);
  if (!m) return null;
  return cleanVenueFragment(m[1]);
}

/** First `@ venue` line in TimeTree event notes. */
export function extractVenueFromNote(note) {
  const text = String(note ?? "").trim();
  if (!text) return null;
  for (const line of text.split(/\n+/)) {
    const trimmed = line.trim();
    const m = trimmed.match(NOTE_VENUE_LINE);
    if (m) {
      const v = cleanVenueFragment(m[1]);
      if (v && !/^stage\d*$/i.test(v)) return v;
    }
  }
  return null;
}

/** @returns {string} */
export function stripVenueFromTitle(title) {
  const venue = extractVenue(title);
  if (!venue) return title.trim();
  const idx = title.lastIndexOf(venue);
  if (idx < 0) return title.trim();
  let head = title.slice(0, idx).replace(/[@＠]\s*$/, "").trim();
  head = head.replace(/　+$/, "").trim();
  return head || title.trim();
}

/** @returns {string[]} */
export function extractWithGroups(title) {
  const out = [];
  const t = title.replace(/\s+/g, " ");
  // iLiFE! × のんふぃく！… / iLiFE!×高嶺のなでしこ…
  const cross = /iLiFE!\s*[×x]\s*([^@＠【「]+)/i.exec(t);
  if (cross) {
    const partner = cross[1]
      .replace(/Special\s+2MAN\s+LIVE.*/i, "")
      .replace(/2MAN\s+LIVE.*/i, "")
      .replace(/『[^』]*』.*/, "")
      .trim();
    if (partner) out.push(partner);
  }
  const nonfic = /のんふぃく\s*[×x]\s*TENRIN/i.test(t) ? ["TENRIN", "のんふぃく！"] : null;
  if (nonfic) return [...new Set([...out, ...nonfic])];
  return out;
}

/**
 * @param {string} title
 * @returns {"Concert"|"Birthday"|"Taiban"|"Festival"|"Tokutenkai"|"Meet"|"TvShow"|"OfflineEvent"|"GuestLive"|"Virtual"|"Promo"|"Media"|"Other"|"Cancelled"}
 */
export function classifyEventType(title) {
  const t = title.trim();
  const n = normTitle(t);
  const u = n.toUpperCase();

  if (/開催中止|※開催中止/.test(t)) return "Cancelled";
  if (isGuestLiveEvent({ event: t })) return "GuestLive";
  if (/SASUKE\s*アイドル予選会/i.test(t)) return "OfflineEvent";
  if (/プロ野球大会議|＋LIVE2|オープニングセレモニー|舞台挨拶|先行上映会|メギド.*XR\s*Live|機運醸成プロジェクト/i.test(t))
    return "OfflineEvent";
  if (/公開収録/.test(t)) return "TvShow";
  if (/Life\s+Like\s+a\s+Live/i.test(n)) return "Virtual";
  if (/ラウンドワン\s*[×x]\s*/i.test(t) && /コラボ/i.test(t)) return "Promo";
  if (/キャンペーン開始\s*[（(]?\s*[〜~～]/.test(t)) return "Promo";
  if (/コラボ\s*[（(]\s*[〜~～]\d/.test(t)) return "Promo";
  if (
    /^【TV】|ヒロインズTV|発売日|雑誌「|コナミデジタル|ゲームショウ|ニコニコ超会議|磁石祭|リリース記念|リリースイベント|初回放送|配信日|CDリリース|予約購入オンラインサイン会|サイン会$|放送$|出演$|出演（|特別番組|キャンペーン開始|ゲストアーティスト出演|アニメ「|TV「|テレ朝|logirl|天才てれびくん|心理テスト/.test(
      t,
    )
  ) {
    return "Media";
  }
  if (/RUNWAY|GAKUSEI RUNWAY/.test(u) && !/IDOL COLLECTION/i.test(n)) return "Media";
  /** Ticketed fan meet after a concert (often next day); separate from same-day handshake 特典会. */
  if (/翌日特典会|後日特典会/.test(t) && !/生誕祭/.test(t)) return "Tokutenkai";
  if (/大特典会|特典会|衣装大特典会|お誕生日前日/.test(t) && !/生誕祭/.test(t)) return "Meet";

  if (/2MAN\s*LIVE|2MANLIVE|ツーマン|対バン/i.test(n)) return "Taiban";
  if (/iLiFE!\s*[×x]\s*/i.test(n) && !/単独/.test(n)) return "Taiban";
  if (/のんふぃく\s*[×x]\s*/i.test(n)) return "Taiban";
  if (/IDOL\s+SUMMER\s+JUNGLE/i.test(n)) return "Taiban";
  if (/AVAM\s+presents.*D[eé]butante|D[eé]butante\s+vol\b/i.test(n)) return "Taiban";

  if (/HEROINES\s+(SUMMER|LEAGUE|HALLOWEEN|XMAS|COUNTDOWN|WHITEDAY|体育祭)/i.test(n)) return "Taiban";
  if (/^\+HEROINE\b/i.test(n)) return "Taiban";
  if (/HEROINES\s+/i.test(n) && /FES/i.test(n)) return "Festival";
  if (/HEROINES\s+/i.test(n)) return "Taiban";

  if (/NEO\s+KASSEN|KABUKILLING\s+CIRCUIT|UP\s+GATE|歌舞伎町UP\s+GATE/i.test(n)) return "Festival";
  if (
    /\bFES\b|FESTIVAL|フェス|合戦|EXPO\b|歌合戦|納涼祭|夏祭り|CIRCUS|SPARK\d|NATSUZOME|ZOME\s*\d|JAM\s+EXPO|JAM\s+202|TIF\b|IDORISE|MEGA\s+VEGAS|YANFES|FUURYUUFES|LARME\s+FES|LEGEND\s+FES|ROCK\s+FES|FAVE\s+IDOLS|FRONTIER|GROOVE\s+INNOVATION|舞闘会/i.test(
      u,
    ) ||
    /主催フェス|アイドルフェス|IDOL\s+COLLECTION/i.test(n)
  ) {
    return "Festival";
  }

  if (/学園祭|大学|桜凛祭|秋桜祭|St\.Paul/i.test(n)) return "Festival";
  if (/出演/.test(n) && /祭|FES|EXPO|合戦/.test(n)) return "Festival";

  if (
    /単独|ONELiFE|武道館公演|iLiVE!\s*vol|iLiVE!\s*SUMMER|iLiVE!\s*HALLOWEEN|超iLiVE!|^iii!|GO!LIFE!|GOLiFE!|GALLiFE|LiFESTART|JAPANLiFE|大感謝祭/i.test(
      n,
    )
  ) {
    return "Concert";
  }
  if (/生誕祭/.test(n)) return "Birthday";
  if (/研究生.*お披露目|お披露目/.test(n)) return "Concert";
  if (/Secret\s+Party|パーティ/i.test(n)) return "Concert";

  if (/LEAGUE|対バン|VS\b/i.test(u)) return "Taiban";

  if (/イベント予定/.test(n)) return "Other";

  return "Other";
}

/**
 * 「日本武道館公演『ONELiFE!』【SOLDOUT】」→ show ONELiFE!, venue 日本武道館
 * @returns {{ venue: string, event: string } | null}
 */
export function parseNipponBudokanKoen(raw) {
  const t = raw.trim();
  const m = /^日本武道館公演\s*『([^』]+)』/.exec(t);
  if (!m) return null;
  const show = m[1].trim();
  if (!show) return null;
  return { venue: "日本武道館", event: show };
}

/**
 * Post-concert 翌日/後日特典会 — venue often same hall as the main show.
 * @param {string} raw
 * @returns {{ venue: string } | null}
 */
export function parseFollowUpTokutenkaiVenue(raw) {
  const t = raw.trim();
  if (!/翌日特典会|後日特典会/.test(t)) return null;
  if (/日本武道館/.test(t)) return { venue: "日本武道館" };
  const m = /^(.+?)公演\s*(?:翌日|後日)特典会/.exec(t);
  if (m) {
    const fragment = m[1].trim();
    if (fragment.length >= 2) return { venue: fragment };
  }
  return null;
}

/** @param {{ date: string, event: string, event_raw?: string }} row */
export function enrichTimetreeEvent(row) {
  const rawInput = String(row.event_raw ?? row.event ?? "").trim();
  const budo = parseNipponBudokanKoen(rawInput);
  const followUp = parseFollowUpTokutenkaiVenue(rawInput);
  let event = rawInput;
  let venue =
    (row.venue_hint && String(row.venue_hint).trim()) ||
    (row.venue && String(row.venue).trim()) ||
    extractVenue(rawInput) ||
    extractVenueFromNote(String(row.note ?? "")) ||
    (String(row.location_name ?? "").trim() || null);
  if (budo) {
    event = budo.event;
    venue = venue ?? budo.venue;
  }
  if (followUp) venue = venue ?? followUp.venue;
  const enrichRow = { ...row, event: rawInput, event_raw: row.event_raw ?? rawInput };
  const type = isTvOpenRecordingEvent(enrichRow)
    ? "TvShow"
    : isGuestLiveEvent(enrichRow)
      ? "GuestLive"
      : isOfflineNonLiveEvent(enrichRow)
        ? "OfflineEvent"
        : isVirtualLiveEvent(enrichRow)
          ? "Virtual"
          : isCommercialPromoEvent(enrichRow)
            ? "Promo"
            : classifyEventType(rawInput);
  const withGroups = extractWithGroups(rawInput);
  const offlineVenue =
    type === "OfflineEvent" ? resolveOfflineEventVenue({ event: rawInput, event_raw: rawInput }) : null;
  const guestVenue =
    type === "GuestLive" ? resolveGuestLiveVenue({ event: rawInput, event_raw: rawInput }) : null;
  const out = {
    date: row.date,
    event,
    type,
    venue:
      type === "Virtual" || type === "Promo" || type === "TvShow"
        ? null
        : type === "OfflineEvent"
          ? offlineVenue?.venue ?? venue ?? null
          : type === "GuestLive"
            ? guestVenue?.venue ?? venue ?? null
            : venue ?? null,
  };
  if (type === "TvShow") {
    out.gameplay_status = "pending";
    out.pending_feature = TV_SHOW_PENDING_FEATURE;
    out.performance_songs_min = 1;
    out.performance_songs_max = 2;
  }
  if (type === "OfflineEvent") {
    out.is_live = false;
    out.gameplay_status = "pending";
    out.pending_feature = OFFLINE_EVENT_PENDING_FEATURE;
    if (offlineVenue?.venue_hint) out.venue_hint = offlineVenue.venue_hint;
  }
  if (type === "GuestLive") {
    out.is_live = true;
    out.gameplay_status = "pending";
    out.pending_feature = GUEST_LIVE_PENDING_FEATURE;
    out.performance_songs = 10;
    out.performance_songs_min = 10;
    out.performance_songs_max = 10;
    out.attendance_model = "invitation_fee";
    out.ticket_sale = false;
    if (guestVenue?.venue_hint) out.venue_hint = guestVenue.venue_hint;
  }
  if (event !== rawInput) out.event_raw = rawInput;
  if (withGroups.length > 0) out.with = withGroups;
  return out;
}
