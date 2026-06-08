/**
 * Normalize Scenario 6 =LOVE membership start dates to a single canonical date.
 *
 * Updates:
 * - public/data/scenarios/scenario_6/idols.json
 * - docs/scenario_6_recommended_group_idols.csv (if present)
 *
 * Run:
 *   node scripts/patchScenario6EqualLoveStartDate.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const idolsPath = path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json");
const csvPath = path.join(root, "docs", "scenario_6_recommended_group_idols.csv");

const GROUP_UID = "PUxPVkU";
const TARGET_START = "2017-04-19";

function crlfJson(obj) {
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
          i += 1;
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

function csvCell(value) {
  const s = value == null ? "" : String(value);
  return `"${s.replace(/"/g, '""')}"`;
}

const idols = JSON.parse(fs.readFileSync(idolsPath, "utf8"));
let updatedHistoryEntries = 0;

for (const idol of idols) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const entry of hist) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.group_uid === GROUP_UID || entry.group_name === "=LOVE") {
      entry.start_date = TARGET_START;
      updatedHistoryEntries += 1;
    }
  }
}

fs.writeFileSync(idolsPath, crlfJson(idols), "utf8");

let updatedCsvRows = 0;
if (fs.existsSync(csvPath)) {
  const rows = parseCsv(fs.readFileSync(csvPath, "utf8"));
  if (rows.length > 1) {
    const headers = rows[0];
    const groupUidIdx = headers.indexOf("group_uid");
    const startIdx = headers.indexOf("membership_start_dates");
    if (groupUidIdx >= 0 && startIdx >= 0) {
      for (let i = 1; i < rows.length; i++) {
        if ((rows[i][groupUidIdx] ?? "") !== GROUP_UID) continue;
        rows[i][startIdx] = TARGET_START;
        updatedCsvRows += 1;
      }
      const out = rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
      fs.writeFileSync(csvPath, `\uFEFF${out}\r\n`, "utf8");
    }
  }
}

console.log(
  `[patch-scenario6-equal-love-start] updated ${updatedHistoryEntries} idol history row(s)` +
    (fs.existsSync(csvPath) ? `, csv rows ${updatedCsvRows}` : ""),
);
