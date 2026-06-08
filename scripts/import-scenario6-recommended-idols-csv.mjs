/**
 * Import manually edited Scenario 6 recommended-group idol CSV rows back into
 * `public/data/scenarios/scenario_6/idols.json`.
 *
 * Run: node scripts/import-scenario6-recommended-idols-csv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const csvPath = path.join(root, "docs", "scenario_6_recommended_group_idols.csv");
const idolsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json");

function crlfSerialize(obj) {
  return `${JSON.stringify(obj, null, 2).replace(/\n/g, "\r\n")}\r\n`;
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
      continue;
    }
    if (ch === ",") {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\r") continue;
    if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += ch;
  }

  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function normalizeText(value) {
  if (value == null) return "";
  return String(value).replace(/^\uFEFF/, "").replace(/^\u200B/, "").trim();
}

function parseNumber(value) {
  const s = normalizeText(value);
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseIntLike(value) {
  const n = parseNumber(value);
  return n == null ? null : Math.round(n);
}

function parseDateish(value) {
  const s = normalizeText(value);
  if (!s) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s);
  if (m) {
    const mm = m[1].padStart(2, "0");
    const dd = m[2].padStart(2, "0");
    return `${m[3]}-${mm}-${dd}`;
  }
  return s;
}

function splitPipe(value) {
  const s = normalizeText(value);
  if (!s) return [];
  return s.split("|").map((part) => part.trim()).filter(Boolean);
}

function maybeNullString(value) {
  const s = normalizeText(value);
  return s ? s : null;
}

function ensureHistoryEntry(idol, groupUid) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  let entry = hist.find((row) => row && row.group_uid === groupUid);
  if (!entry) {
    entry = { group_uid: groupUid };
    hist.push(entry);
  }
  idol.group_history = hist;
  return entry;
}

function buildAttributesFromCsv(record) {
  return {
    physical: {
      strength: parseIntLike(record.strength) ?? 12,
      agility: parseIntLike(record.agility) ?? 12,
      natural_fitness: parseIntLike(record.natural_fitness) ?? 12,
      stamina: parseIntLike(record.stamina) ?? 12,
    },
    appearance: {
      cute: parseIntLike(record.cute) ?? 12,
      pretty: parseIntLike(record.pretty) ?? 12,
    },
    technical: {
      pitch: parseIntLike(record.pitch) ?? 12,
      tone: parseIntLike(record.tone) ?? 12,
      breath: parseIntLike(record.breath) ?? 12,
      rhythm: parseIntLike(record.rhythm) ?? 12,
      power: parseIntLike(record.power) ?? 12,
      grace: parseIntLike(record.grace) ?? 12,
    },
    mental: {
      clever: parseIntLike(record.clever) ?? 12,
      humor: parseIntLike(record.humor) ?? 12,
      talking: parseIntLike(record.talking) ?? 12,
      determination: parseIntLike(record.determination) ?? 12,
      teamwork: parseIntLike(record.teamwork) ?? 12,
      fashion: parseIntLike(record.fashion) ?? 12,
    },
    hidden: {
      professionalism: parseIntLike(record.professionalism) ?? 12,
      injury_proneness: parseIntLike(record.injury_proneness) ?? 4,
      ambition: parseIntLike(record.ambition) ?? 12,
      loyalty: parseIntLike(record.loyalty) ?? 12,
    },
  };
}

if (!fs.existsSync(csvPath)) {
  throw new Error(`Missing CSV: ${path.relative(root, csvPath)}`);
}
if (!fs.existsSync(idolsPath)) {
  throw new Error(`Missing idols.json: ${path.relative(root, idolsPath)}`);
}

const csvText = fs.readFileSync(csvPath, "utf8");
const rows = parseCsv(csvText).filter((row) => row.some((cell) => normalizeText(cell) !== ""));
if (rows.length < 2) throw new Error("CSV has no data rows");

const headers = rows[0].map((cell) => normalizeText(cell));
const records = rows.slice(1).map((row, index) => {
  const out = {};
  for (let i = 0; i < headers.length; i++) out[headers[i]] = row[i] ?? "";
  out._row_number = index + 2;
  return out;
});

const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
if (!Array.isArray(idols)) throw new Error("idols.json must be an array");

const idolByUid = new Map(idols.map((idol) => [String(idol.uid), idol]));
let updated = 0;

for (const record of records) {
  const idolUid = normalizeText(record.idol_uid);
  const groupUid = normalizeText(record.group_uid);
  if (!idolUid || !groupUid) throw new Error(`Row ${record._row_number}: missing idol_uid or group_uid`);

  const statusOverride = normalizeText(record.manual_status_override).toLowerCase();
  if (statusOverride === "omit" || statusOverride === "remove" || statusOverride === "exclude") continue;

  const idol = idolByUid.get(idolUid);
  if (!idol) throw new Error(`Row ${record._row_number}: unknown idol_uid ${idolUid}`);

  idol.name = normalizeText(record.idol_name) || idol.name;
  idol.romaji = normalizeText(record.idol_romaji);
  idol.hiragana = normalizeText(record.idol_hiragana);
  idol.nickname = normalizeText(record.nickname);
  idol.birthday = parseDateish(record.birthday);
  const age = parseIntLike(record.age);
  idol.age = age == null ? null : age;
  const height = parseNumber(record.height_cm);
  idol.height = height == null ? null : height;
  idol.birthplace = normalizeText(record.birthplace);
  idol.languages = splitPipe(record.languages);
  const followers = parseIntLike(record.x_followers);
  idol.x_followers = followers == null ? null : followers;
  idol.wiki_url = normalizeText(record.wiki_url);
  idol.portrait_photo_path = normalizeText(record.portrait_photo_path);
  idol.attributes = buildAttributesFromCsv(record);

  const entry = ensureHistoryEntry(idol, groupUid);
  entry.group_uid = groupUid;
  entry.group_name = normalizeText(record.group_name) && normalizeText(record.group_name) !== "#NAME?"
    ? normalizeText(record.group_name)
    : entry.group_name ?? "";
  entry.start_date = parseDateish(splitPipe(record.membership_start_dates)[0] ?? record.membership_start_dates);
  entry.end_date = parseDateish(splitPipe(record.membership_end_dates)[0] ?? record.membership_end_dates);
  entry.member_name = maybeNullString(splitPipe(record.member_name_in_group)[0] ?? record.member_name_in_group);
  entry.member_color = maybeNullString(splitPipe(record.member_colors)[0] ?? record.member_colors);
  entry.member_color_code = maybeNullString(splitPipe(record.member_color_codes)[0] ?? record.member_color_codes);

  const noteParts = splitPipe(record.membership_notes);
  const manualNotes = normalizeText(record.manual_notes);
  if (manualNotes) noteParts.push(`[manual] ${manualNotes}`);
  entry.notes = noteParts.length ? noteParts.join("; ") : undefined;

  updated += 1;
}

fs.writeFileSync(idolsPath, crlfSerialize(idols), "utf8");
console.log(`[import-scenario6-recommended-idols] updated ${updated} idol row(s) in ${path.relative(root, idolsPath)}`);
