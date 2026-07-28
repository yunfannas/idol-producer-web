/**
 * Apply CSV attribute columns from scenario_6_recommended_group_idols.csv
 * into scenario_6/idols.json for curated startup groups, tagged as manual.
 *
 * Default targets: iLiFE!, 高嶺のなでしこ, アキシブproject
 *
 * Usage:
 *   node support/scripts/import-scenario6-recommended-idols-csv.mjs
 *   node support/scripts/import-scenario6-recommended-idols-csv.mjs --all
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const csvPath = path.join(root, "support", "docs", "scenario_6_recommended_group_idols.csv");
const idolsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json");

const DEFAULT_GROUP_UIDS = new Set([
  "aUxpRkUh", // iLiFE!
  "6auY5ba644Gu44Gq44Gn44GX44GT", // 高嶺のなでしこ
  "44Ki44Kt44K344OWcHJvamVjdA", // アキシブproject
]);

const DEFAULT_GROUP_NAMES = new Set(["iLiFE!", "高嶺のなでしこ", "アキシブproject"]);
const importAll = process.argv.includes("--all");

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

function rowInDefaultTargets(record) {
  const groupUid = normalizeText(record.group_uid);
  const groupName = normalizeText(record.group_name);
  return DEFAULT_GROUP_UIDS.has(groupUid) || DEFAULT_GROUP_NAMES.has(groupName);
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
let skipped = 0;
const byGroup = new Map();

for (const record of records) {
  const idolUid = normalizeText(record.idol_uid);
  const groupUid = normalizeText(record.group_uid);
  if (!idolUid || !groupUid) throw new Error(`Row ${record._row_number}: missing idol_uid or group_uid`);

  const statusOverride = normalizeText(record.manual_status_override).toLowerCase();
  if (statusOverride === "omit" || statusOverride === "remove" || statusOverride === "exclude") {
    skipped += 1;
    continue;
  }

  if (!importAll && !rowInDefaultTargets(record)) {
    skipped += 1;
    continue;
  }

  const idol = idolByUid.get(idolUid);
  if (!idol) throw new Error(`Row ${record._row_number}: unknown idol_uid ${idolUid}`);

  // Attributes only — do not rewrite roster/history/profile fields from the CSV.
  idol.attributes = buildAttributesFromCsv(record);
  idol.attributes_origin = "manual";
  updated += 1;

  const gName = normalizeText(record.group_name) || groupUid;
  byGroup.set(gName, (byGroup.get(gName) ?? 0) + 1);
}

fs.writeFileSync(idolsPath, `${JSON.stringify(idols, null, 2)}\n`, "utf8");
console.log(
  JSON.stringify(
    {
      updated,
      skipped,
      importAll,
      byGroup: Object.fromEntries(byGroup),
      path: path.relative(root, idolsPath),
    },
    null,
    2,
  ),
);
