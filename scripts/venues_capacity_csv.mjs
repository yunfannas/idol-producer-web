/**
 * Export / import venue catalog: name, capacity, setting (indoor/outdoor), city.
 *
 *   node scripts/venues_capacity_csv.mjs export [--out path.csv]
 *   node scripts/venues_capacity_csv.mjs import [path.csv] [--create]
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createVenueStub, loadVenuesCatalog, normalizeVenueKey, saveVenuesCatalog } from "./timetreeVenueDb.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const defaultCsv = path.join(root, "docs", "reference", "venues_capacity.csv");

const HEADER = ["name", "capacity", "setting", "city"];

/** Names that share one canonical row in the CSV. */
const NAME_ALIASES = new Map([
  [normalizeVenueKey("白金高輪 セレネ スタジオ SELENE b2"), "白金高輪SELENE b2"],
  [normalizeVenueKey("白金高輪SELENE STUDIO SELENE b2"), "白金高輪SELENE b2"],
]);

/** @param {unknown} v */
function escCsv(v) {
  if (v == null || v === "") return "";
  const s = String(v);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** @param {string} line */
function parseCsvLine(line) {
  /** @type {string[]} */
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (inQ) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out;
}

/** @param {string} raw */
function normSetting(raw) {
  const s = String(raw ?? "").trim().toLowerCase();
  if (!s) return null;
  if (s === "outdoor" || s === "屋外" || s === "野外") return "outdoor";
  if (s === "indoor" || s === "屋内" || s === "室内") return "indoor";
  return null;
}

/** @param {string} name */
export function guessCity(name) {
  const n = String(name ?? "");
  if (/桃配|関ケ原|岐阜/.test(n)) return "Gifu";
  if (/横浜|Yokohama|ぴあアリーナ|ランドマークホール/.test(n)) return "Yokohama";
  if (/大阪|osaka|Bayside|なんば|難波|americamura/.test(n)) return "Osaka";
  if (/名古屋|NAGOYA/.test(n)) return "Nagoya";
  if (/福岡|Fukuoka/.test(n)) return "Fukuoka";
  if (/札幌|Sapporo/.test(n)) return "Sapporo";
  if (/幕張|千葉|TOKYO-BAY|海の森/.test(n)) return "Chiba";
  if (/さいたま|埼玉|ベルーナ/.test(n)) return "Saitama";
  if (/東武動物|宮城|Minamisaitama/i.test(n)) return "Saitama";
  if (/ところざわ|所沢/.test(n)) return "Tokorozawa";
  if (/立川|Tachikawa/.test(n)) return "Tachikawa";
  if (/豊洲/.test(n)) return "Tokyo";
  return "Tokyo";
}

/** @param {string} name */
export function guessSetting(name) {
  const n = String(name ?? "");
  if (/野外|運動公園|公園|うみかぜ|海の森|お台場R|HOLA!|音楽堂$|野外ステージ|野外特設/.test(n)) return "outdoor";
  if (/ドーム|スタジアム|アリーナ|メッセ|ホール|PIT|Zepp|CLUB|BOX|livehouse/i.test(n)) return "indoor";
  return "indoor";
}

/** @param {Record<string, unknown>} v */
function rowFromVenue(v) {
  const name = String(v.name ?? "").trim();
  const cap = v.capacity != null && Number(v.capacity) > 0 ? Number(v.capacity) : "";
  const setting = v.setting ? String(v.setting) : guessSetting(name);
  const city = v.city ? String(v.city) : guessCity(name);
  return { name, capacity: cap, setting, city };
}

function exportCsv(outPath) {
  const catalog = loadVenuesCatalog();
  const seen = new Map();
  for (const v of catalog.venues) {
    const r = /** @type {Record<string, unknown>} */ (v);
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const key = normalizeVenueKey(name);
    const canonical = NAME_ALIASES.get(key) ?? name;
    if (seen.has(normalizeVenueKey(canonical))) continue;
    seen.set(normalizeVenueKey(canonical), rowFromVenue({ ...r, name: canonical }));
  }

  const rows = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
  const lines = [HEADER.join(",")];
  for (const r of rows) {
    lines.push(HEADER.map((h) => escCsv(r[h])).join(","));
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");
  console.log(`Wrote ${outPath} (${rows.length} venues)`);
}

function importCsv(csvPath, createNew) {
  const text = fs.readFileSync(csvPath, "utf8").replace(/^\uFEFF/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error("CSV has no data rows");

  const header = parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const idx = Object.fromEntries(header.map((h, i) => [h, i]));
  if (idx.name == null || idx.capacity == null) throw new Error("CSV needs: name, capacity, setting, city");

  const catalog = loadVenuesCatalog();
  const byKey = new Map();
  for (const v of catalog.venues) {
    const r = /** @type {Record<string, unknown>} */ (v);
    const name = String(r.name ?? "").trim();
    if (name) byKey.set(normalizeVenueKey(name), r);
  }

  let updated = 0;
  let created = 0;
  /** @type {string[]} */
  const missing = [];

  for (let li = 1; li < lines.length; li++) {
    const cells = parseCsvLine(lines[li]);
    const get = (col) => (idx[col] == null ? "" : (cells[idx[col]] ?? "").trim());
    const name = get("name");
    if (!name) continue;

    const capRaw = get("capacity");
    const cap = capRaw === "" ? null : Number(capRaw);
    if (cap != null && (!Number.isFinite(cap) || cap <= 0)) {
      console.warn(`  skip invalid capacity for ${name}: ${capRaw}`);
      continue;
    }
    const setting = normSetting(get("setting"));
    const city = get("city") || null;

    const keys = [normalizeVenueKey(name)];
    for (const [aliasKey, canonical] of NAME_ALIASES) {
      if (canonical === name || normalizeVenueKey(canonical) === normalizeVenueKey(name)) {
        keys.push(aliasKey);
      }
    }

    let hit = false;
    for (const key of keys) {
      const row = byKey.get(key);
      if (!row) continue;
      hit = true;
      if (cap != null) row.capacity = cap;
      if (setting) row.setting = setting;
      if (city) row.city = city;
      if (city) row.location = city;
      updated += 1;
    }

    if (!hit) {
      if (!createNew) {
        missing.push(name);
        continue;
      }
      const stub = createVenueStub(name, { capacity: cap, setting, city });
      catalog.venues.push(stub);
      byKey.set(normalizeVenueKey(name), stub);
      created += 1;
    }
  }

  saveVenuesCatalog(catalog);
  console.log(`Updated ${updated} venue row(s); created ${created} new`);
  if (missing.length) {
    console.warn(`Unknown (re-export with --create or add to CSV): ${missing.join(", ")}`);
  }
}

const argv = process.argv.slice(2);
const cmd = argv[0] ?? "export";
const fileArg = argv.find((a) => !a.startsWith("--") && a !== cmd);
const outIdx = argv.indexOf("--out");
const createNew = !argv.includes("--no-create");

if (cmd === "export") {
  exportCsv(outIdx >= 0 ? path.resolve(argv[outIdx + 1]) : defaultCsv);
} else if (cmd === "import") {
  importCsv(path.resolve(fileArg ?? defaultCsv), createNew);
} else {
  console.error("Usage: export|import [file.csv] [--out path] [--no-create]");
  process.exit(1);
}
