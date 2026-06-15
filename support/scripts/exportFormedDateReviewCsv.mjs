/**
 * Build a human-review CSV from group_formed_date_suggestions_scenario6.csv
 *
 * Run: node scripts/exportFormedDateReviewCsv.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "support/docs/reference/group_formed_date_suggestions_scenario6.csv");
const out = path.join(root, "support/docs/reference/group_formed_date_review.csv");

function parseCsvLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line.charAt(i);
    if (inQ) {
      if (c === '"') {
        if (line.charAt(i + 1) === '"') {
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

function esc(v) {
  const s = String(v ?? "");
  return `"${s.replace(/"/g, '""')}"`;
}

const rank = { high: 0, medium: 1, low: 2, none: 3, error: 4 };
const lines = fs.readFileSync(src, "utf8").trim().split("\n");
const rows = lines.slice(1).map((line) => {
  const [uid, name, romanji, date, conf, source, wiki, notes] = parseCsvLine(line);
  return { uid, name, romanji, date, conf, source, wiki, notes, r: rank[conf] ?? 5 };
});
rows.sort((a, b) => a.r - b.r || a.name.localeCompare(b.name, "ja"));

const header =
  "group_uid,group_name,name_romanji,suggested_date,confidence,apply_yes_no,source,wiki_title,notes";
const body = rows.map((row) =>
  [
    row.uid,
    esc(row.name),
    esc(row.romanji),
    row.date,
    row.conf,
    row.conf === "high" ? "Y" : "",
    esc(row.source),
    esc(row.wiki),
    esc(row.notes),
  ].join(","),
);

fs.writeFileSync(out, `${header}\n${body.join("\n")}\n`, "utf8");

const counts = Object.fromEntries(
  ["high", "medium", "low", "none", "error"].map((k) => [k, rows.filter((r) => r.conf === k).length]),
);
console.log(`Wrote ${out} (${rows.length} rows)`);
console.log(counts);
