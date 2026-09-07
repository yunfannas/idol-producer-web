/**
 * Match TimeTree venue strings to `venues.json`; optionally create stubs.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENUE_PATHS = [
  path.join(__dirname, "..", "..", "public", "data", "venues.json"),
  path.join(__dirname, "..", "..", "src", "engine", "data", "venues.json"),
];

/** ~1000-cap hall used as placeholder for 握手会 / Meet rows (excluded from managed live finance). */
export const MEET_GREET_DEFAULT_VENUE_NAME = "神田スクエアホール";
export const MEET_GREET_DEFAULT_VENUE_HINT = "握手会・リリースイベント（代表会場）";

export function normalizeVenueKey(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[　\s]+/g, "")
    .replace(/[（）()【】[\]『』「」]/g, "")
    .replace(/^[@＠]+/, "")
    .trim();
}

/**
 * Manual aliases: scraped label → canonical catalog `name`.
 * Always normalize aliases here. The resolver also normalizes incoming venue strings,
 * so keeping raw strings as Map keys silently breaks aliases containing spaces/case variants.
 */
const VENUE_ALIAS_PAIRS = [
  ["zepp fukuoka", "Zepp Fukuoka"],
  ["zepp divercity tokyo", "Zepp DiverCity"],
  ["zepp divercity", "Zepp DiverCity"],
  ["kt zepp yokohama", "KT Zepp Yokohama"],
  ["spotify o-east", "Spotify O-EAST"],
  ["spotify o-west", "Spotify O-WEST"],
  ["spotify-o-west", "Spotify O-WEST"],
  ["o-east", "Spotify O-EAST"],
  ["o-west", "Spotify O-WEST"],
  ["o-crest", "Spotify O-Crest"],
  ["豊洲pit", "豊洲PIT"],
  ["toyosu pit", "豊洲PIT"],
  ["東武動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["東武動物公園🐯", "東武動物公園 イベントステージ HOLA!"],
  ["東急動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["東武動物公園イベントステージhola", "東武動物公園 イベントステージ HOLA!"],
  ["tobu zoo", "東武動物公園 イベントステージ HOLA!"],
  ["shibuya veats", "Veats SHIBUYA"],
  ["veats shibuya", "Veats SHIBUYA"],
  ["veath shibuya", "Veats SHIBUYA"],
  ["渋谷veats", "Veats SHIBUYA"],
  ["ビーツ・シブヤ", "Veats SHIBUYA"],
  ["白金高輪seleneb2", "白金高輪SELENE b2"],
  ["白金高輪セレネスタジオseleneb2", "白金高輪SELENE b2"],
  ["白金高輪selene studio selene b2", "白金高輪SELENE b2"],
  ["恵比寿リキッドルーム", "LIQUIDROOM"],
  ["ebisu garden hall", "恵比寿ガーデンホール"],
  ["恵比寿ザ・ガーデンルーム", "恵比寿ガーデンルーム"],
  ["ザ・ガーデンホール/ルーム", "The Garden Hall"],
  ["stellar ball", "ステラボール"],
  ["品川プリンスホテル ステラボール", "ステラボール"],
  ["品川インターシティーホール", "品川インターシティホール&貸会議室"],
  ["sendai pit", "仙台PIT"],
  ["kanadivia hall", "Kanadevia Hall"],
  ["tachdikawa stage garden", "立川ステージガーデン"],
  ["tachikawa stage garden", "立川ステージガーデン"],
  ["wobm live", "WOMB"],
  ["womb live", "WOMB"],
  ["shibuya womb", "WOMB"],
  ["shibuya duo", "duo MUSIC EXCHANGE"],
  ["duo music excange", "duo MUSIC EXCHANGE"],
  ["clube asia", "clubasia"],
  ["渋谷asia", "clubasia"],
  ["渋谷vident", "SHIBUYA VIDENT"],
  ["渋谷ring", "SHIBUYA RING"],
  ["渋谷rex", "SHIBUYA REX"],
  ["shibuya rex", "SHIBUYA REX"],
  ["渋谷the game", "SHIBUYA THE GAME"],
  ["shibuya the game", "SHIBUYA THE GAME"],
  ["shibuya dive", "SHIBUYA DIVE"],
  ["渋谷dive", "SHIBUYA DIVE"],
  ["原宿ruido", "HARAJUKU RUIDO"],
  ["osaka bigcat", "心斎橋BIG CAT"],
  ["big cat", "心斎橋BIG CAT"],
  ["バナナホール", "BANANA HALL"],
  ["osakamuse", "大阪MUSE"],
  ["大阪esaka muse", "ESAKA MUSE"],
  ["名古屋reny", "NAGOYA Reny Limited"],
  ["nagoya reny limited", "NAGOYA Reny Limited"],
  ["nagoya portbase", "COMTEC PORTBASE"],
  ["zepher hall", "zephyr hall"],
  ["梅田quattro", "梅田CLUB QUATTRO"],
  ["umeda club quattro", "梅田CLUB QUATTRO"],
  ["nagoya club quattro", "名古屋CLUB QUATTRO"],
  ["横浜ランドマークホール", "ランドマークホール (Landmark Hall)"],
  ["大阪城野音", "大阪城音楽堂"],
  ["幕張海浜公園", "幕張海浜公園 イベントブロック特設会場"],
  ["幕張海浜公演gブロック", "幕張海浜公園Ｇブロック芝生広場"],
  ["幕張海浜公園gブロック特設会場", "幕張海浜公園Ｇブロック芝生広場"],
  ["幕張海浜公園gブロック駐車場", "幕張海浜公園Ｇブロック芝生広場"],
  ["イベントブロック特設会場", "幕張海浜公園 イベントブロック特設会場"],
  ["お台場 青海周辺エリア", "お台場・青海周辺エリア"],
  ["お台場臨海公園", "お台場臨海公園（TIF・複数ステージ）"],
  ["ひたち海浜公園", "国営ひたち海浜公園"],
  ["マツダスタジアム", "Mazda Zoom-Zoom Stadium Hiroshima"],
  ["mazda zoom-zoom stadium", "Mazda Zoom-Zoom Stadium Hiroshima"],
  ["エスコンフィールド", "エスコンフィールドHOKKAIDO"],
  ["幕張メッセ 9-11ホール", "幕張メッセ国際展示場9-11ホール"],
  ["幕張メッセ9-11ホール", "幕張メッセ国際展示場9-11ホール"],
  ["ttホール", "COOL JAPAN PARK OSAKA TTホール"],
  ["東京カルチャーカルチャー", "東京カルチャーカルチャー"],
  ["渋谷カルチャーカルチャー", "東京カルチャーカルチャー"],
  ["viblueebisu", "ViblueEBISU"],
  ["ebisu viblue", "ViblueEBISU"],
  ["ebisu vblue", "ViblueEBISU"],
  ["恵比寿viblue", "ViblueEBISU"],
  ["恵比寿vblue", "ViblueEBISU"],
  ["viblue恵比寿", "ViblueEBISU"],
];

const VENUE_ALIASES = new Map(
  VENUE_ALIAS_PAIRS.map(([from, to]) => [normalizeVenueKey(from), to]),
);

/**
 * Labels known to be schedule placeholders, vague areas, parser artifacts, URLs,
 * or multi-venue circuit descriptions rather than one physical venue.
 */
const NON_VENUE_EXACT_KEYS = new Set(
  [
    "都内",
    "未定",
    "会場後日告知",
    "仙台会場",
    "品川会場",
    "新宿会場",
    "渋谷会場",
    "金沢会場",
    "渋谷近郊会場",
    "新宿2会場",
    "新宿4会場",
    "新宿6会場",
    "新宿8会場",
    "渋谷4会場",
    "渋谷5会場",
    "渋谷五会場",
    "渋谷6会場",
    "渋谷複数会場",
    "渋谷サーキット",
    "新宿サーキット",
    "渋谷3会場サーキット",
    "渋谷9会場サーキット",
    "歌舞伎町（複数会場フェス）",
    "新宿（複数会場フェス）",
    "渋谷（複数会場フェス）",
    "大阪・心斎橋エリアライブハウス8会場",
    "ベルサール渋谷ガーデン 他複数会場",
    "ベルサール渋谷ガーデン / 他",
    "渋谷ベルサールガーデン含む複数会場",
    "東京ドリームパーク ほか",
    "JAM EXPO 2025 supported by UP-T」",
    "JAM/ダイキサウンド",
    "名古屋(夜",
    "（月）17",
    "（火）17",
    "（水）17",
    "（木）17",
    "（土）10",
    "（日）東京",
    "12",
    "19",
  ].map(normalizeVenueKey),
);

export function isUsableVenueLabel(name) {
  const raw = String(name ?? "").trim();
  if (!raw) return false;
  const key = normalizeVenueKey(raw);
  if (!key || NON_VENUE_EXACT_KEYS.has(key)) return false;
  if (/^https?:\/\//i.test(raw)) return false;
  if (/^www\./i.test(raw)) return false;
  if (/^\d{1,2}$/.test(raw)) return false;
  if (/会場(?:後日)?(?:告知|未定)$/.test(raw)) return false;
  if (/(?:\d+|複数|数)会場(?:サーキット|フェス)?$/.test(raw)) return false;
  return true;
}

/** @param {string} p */
export function loadVenuesCatalog(p = VENUE_PATHS[0]) {
  const data = JSON.parse(fs.readFileSync(p, "utf8"));
  if (!Array.isArray(data.venues)) throw new Error(`No venues[] in ${p}`);
  return { path: p, venues: data.venues };
}

/** @param {{ venues: unknown[] }} catalog */
function buildVenueIndex(catalog) {
  const byKey = new Map();
  for (const row of catalog.venues) {
    if (!row || typeof row !== "object") continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    const name = String(r.name ?? "").trim();
    const romaji = String(r.name_romanji ?? "").trim();
    if (name) byKey.set(normalizeVenueKey(name), r);
    if (romaji) byKey.set(normalizeVenueKey(romaji), r);
  }
  return byKey;
}

/**
 * @param {string} rawName
 * @param {Map<string, unknown>} index
 */
export function findVenueInCatalog(rawName, index) {
  const trimmed = String(rawName ?? "").trim();
  if (!trimmed || !isUsableVenueLabel(trimmed)) return null;

  const key = normalizeVenueKey(trimmed);
  const alias = VENUE_ALIASES.get(key);
  if (alias) {
    const hit = index.get(normalizeVenueKey(alias));
    if (hit) return hit;
  }

  const exact = index.get(key);
  if (exact) return exact;

  let best = null;
  let bestLen = 0;
  for (const [k, row] of index) {
    if (k.length < 3) continue;
    if (key.includes(k) || k.includes(key)) {
      const len = Math.min(k.length, key.length);
      if (len > bestLen) {
        bestLen = len;
        best = row;
      }
    }
  }
  return best;
}

/**
 * Minimal venue row — only name and capacity affect gameplay; other fields are optional metadata.
 * @param {string} name
 * @param {{ source?: string, capacity?: number | null, setting?: string | null, city?: string | null }} [meta]
 */
export function createVenueStub(name, meta = {}) {
  const label = String(name).trim();
  const capRaw = meta.capacity;
  const capacity =
    capRaw != null && Number.isFinite(Number(capRaw)) && Number(capRaw) > 0 ? Number(capRaw) : null;
  const setting = meta.setting === "outdoor" || meta.setting === "indoor" ? meta.setting : null;
  const city = meta.city ? String(meta.city).trim() : null;
  return {
    uid: crypto.randomUUID(),
    name: label,
    name_romanji: label,
    venue_type: setting === "outdoor" ? "Outdoor Stage" : "Live House",
    location: city,
    city,
    setting,
    capacity,
    description: meta.source
      ? `Auto-created from ${meta.source}. Set capacity in venues_capacity.csv when known.`
      : null,
    website: null,
    opened_date: null,
    image_path: null,
  };
}

/**
 * @param {string} rawName
 * @param {{ venues: unknown[], path?: string }} catalog
 * @param {{ create?: boolean, source?: string, dryRun?: boolean, capacity?: number | null, setting?: string | null, city?: string | null, venue_type?: string | null }} opts
 */
export function resolveVenueInDatabase(rawName, catalog, opts = {}) {
  const label = String(rawName ?? "").trim();
  if (!isUsableVenueLabel(label)) {
    return {
      venue_uid: null,
      venue_name: label || null,
      created: false,
      missing: true,
      invalid: true,
    };
  }

  const index = buildVenueIndex(catalog);
  const hit = findVenueInCatalog(label, index);
  if (hit) {
    const row = /** @type {Record<string, unknown>} */ (hit);
    const cap = opts.capacity;
    if (cap != null && Number.isFinite(Number(cap)) && Number(cap) > 0) {
      row.capacity = Number(cap);
    }
    return {
      venue_uid: String(row.uid ?? ""),
      venue_name: String(row.name ?? label),
      created: false,
    };
  }
  if (!opts.create) {
    return { venue_uid: null, venue_name: label, created: false, missing: true };
  }
  const stub = createVenueStub(label, {
    source: opts.source,
    capacity: opts.capacity,
    setting: opts.setting,
    city: opts.city,
  });
  if (opts.venue_type) stub.venue_type = String(opts.venue_type);
  if (!opts.dryRun) {
    catalog.venues.push(stub);
    index.set(normalizeVenueKey(stub.name), stub);
  }
  return {
    venue_uid: stub.uid,
    venue_name: stub.name,
    created: true,
  };
}

/**
 * Assign default meet-and-greet hall when venue is unknown.
 * @param {Record<string, unknown>} row
 * @param {{ venues: unknown[] }} catalog
 * @param {{ create?: boolean, source?: string }} [opts]
 */
export function applyMeetGreetDefaultVenue(row, catalog, opts = {}) {
  const type = String(row.type ?? row.event_type ?? "").trim();
  if (type !== "Meet") return false;
  if (String(row.venue ?? "").trim() && row.venue_uid) return false;

  const resolved = resolveVenueInDatabase(MEET_GREET_DEFAULT_VENUE_NAME, catalog, {
    create: opts.create !== false,
    source: opts.source ?? "meet-greet default",
  });
  row.venue = resolved.venue_name ?? MEET_GREET_DEFAULT_VENUE_NAME;
  row.venue_hint = String(row.venue_hint ?? "").trim() || MEET_GREET_DEFAULT_VENUE_HINT;
  if (resolved.venue_uid) row.venue_uid = resolved.venue_uid;
  return true;
}

/** Persist catalog to all known venue.json paths (kept in sync). */
export function saveVenuesCatalog(catalog, primaryPath = VENUE_PATHS[0]) {
  const payload = { venues: catalog.venues };
  const text = `${JSON.stringify(payload, null, 2)}\n`;
  const paths = new Set([primaryPath, ...VENUE_PATHS]);
  for (const p of paths) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, text, "utf8");
  }
}
