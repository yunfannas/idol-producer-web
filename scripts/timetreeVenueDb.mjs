/**
 * Match TimeTree venue strings to `venues.json`; optionally create stubs.
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VENUE_PATHS = [
  path.join(__dirname, "..", "public", "data", "venues.json"),
  path.join(__dirname, "..", "src", "engine", "data", "venues.json"),
];

/** Manual aliases: scraped label → catalog `name`. */
const VENUE_ALIASES = new Map([
  ["zepp fukuoka", "Zepp Fukuoka"],
  ["zepp divercity tokyo", "Zepp DiverCity"],
  ["zepp divercity", "Zepp DiverCity"],
  ["kt zepp yokohama", "KT Zepp Yokohama"],
  ["spotify o-east", "Spotify O-EAST"],
  ["spotify o-west", "Spotify O-WEST"],
  ["o-east", "Spotify O-EAST"],
  ["o-west", "Spotify O-WEST"],
  ["豊洲pit", "豊洲PIT"],
  ["toyosu pit", "豊洲PIT"],
  ["東武動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["東急動物公園", "東武動物公園 イベントステージ HOLA!"],
  ["東武動物公園イベントステージhola", "東武動物公園 イベントステージ HOLA!"],
  ["tobu zoo", "東武動物公園 イベントステージ HOLA!"],
  ["shibuya veats", "Veats SHIBUYA"],
  ["veats shibuya", "Veats SHIBUYA"],
  ["白金高輪seleneb2", "白金高輪SELENE b2"],
  ["白金高輪セレネスタジオseleneb2", "白金高輪SELENE b2"],
  ["桃配運動公園", "桃配運動公園"],
  ["幕張海浜公園", "幕張海浜公園 イベントブロック特設会場"],
  ["イベントブロック特設会場", "幕張海浜公園 イベントブロック特設会場"],
]);

export function normalizeVenueKey(name) {
  return String(name ?? "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[　\s]+/g, "")
    .replace(/[（）()【】[\]『』「」]/g, "")
    .replace(/^[@＠]+/, "")
    .trim();
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
  if (!trimmed) return null;

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
 * @param {{ create?: boolean, source?: string, dryRun?: boolean, capacity?: number | null }} opts
 */
export function resolveVenueInDatabase(rawName, catalog, opts = {}) {
  const index = buildVenueIndex(catalog);
  const hit = findVenueInCatalog(rawName, index);
  if (hit) {
    const row = /** @type {Record<string, unknown>} */ (hit);
    const cap = opts.capacity;
    if (cap != null && Number.isFinite(Number(cap)) && Number(cap) > 0) {
      row.capacity = Number(cap);
    }
    return {
      venue_uid: String(row.uid ?? ""),
      venue_name: String(row.name ?? rawName),
      created: false,
    };
  }
  if (!opts.create) {
    return { venue_uid: null, venue_name: rawName, created: false, missing: true };
  }
  const stub = createVenueStub(rawName, { source: opts.source, capacity: opts.capacity });
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
