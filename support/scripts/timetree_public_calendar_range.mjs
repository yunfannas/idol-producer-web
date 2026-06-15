/**
 * Scrape a TimeTree public calendar for each month in range, merge, keep only the range JSON.
 *
 * Usage:
 *   node scripts/timetree_public_calendar_range.mjs [slug] [startYYYY-MM] [endYYYY-MM]
 *
 * Writes: public/data/timetree/{slug}-{start}-{end}.json
 * Monthly JSON is written to a temp dir during the run and deleted after merge.
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const slug = process.argv[2] ?? "akishibu";

function parseYm(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) };
}

function monthKey(y, mo) {
  return y * 12 + (mo - 1);
}

const now = new Date();
const defaultEnd = { y: now.getFullYear(), mo: now.getMonth() + 1 };
const start = parseYm(process.argv[3]) ?? { y: 2025, mo: 9 };
const end = parseYm(process.argv[4]) ?? defaultEnd;

if (monthKey(end.y, end.mo) < monthKey(start.y, start.mo)) {
  console.error("End month is before start month; check YYYY-MM args and system date.");
  process.exit(1);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "idol-timetree-"));
const startLabel = `${start.y}-${String(start.mo).padStart(2, "0")}`;
const endLabel = `${end.y}-${String(end.mo).padStart(2, "0")}`;

let cur = { y: start.y, mo: start.mo };
while (monthKey(cur.y, cur.mo) <= monthKey(end.y, end.mo)) {
  const monthly = `${cur.y}-${String(cur.mo).padStart(2, "0")}-01`;
  const url = `https://timetreeapp.com/public_calendars/${slug}?monthly=${monthly}`;
  const outFile = path.join(tmpDir, `${slug}-${monthly.slice(0, 7)}.json`);
  console.error(`\n=== ${url} ===\n`);
  const r = spawnSync(
    process.execPath,
    [path.join(__dirname, "timetree_public_calendar_scrape.mjs"), url, outFile],
    { cwd: root, stdio: "inherit" },
  );
  if (r.status !== 0) {
    console.error(`Stopped: scrape exited with ${r.status}`);
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
    process.exit(r.status ?? 1);
  }
  cur.mo += 1;
  if (cur.mo > 12) {
    cur.mo = 1;
    cur.y += 1;
  }
}

const merge = spawnSync(
  process.execPath,
  [
    path.join(__dirname, "timetree_merge_monthly_json.mjs"),
    "--slug",
    slug,
    "--from",
    startLabel,
    "--to",
    endLabel,
    "--src-dir",
    tmpDir,
  ],
  { cwd: root, stdio: "inherit" },
);

try {
  fs.rmSync(tmpDir, { recursive: true, force: true });
} catch {
  /* ignore */
}

if (merge.status !== 0) {
  process.exit(merge.status ?? 1);
}

console.error(`\nDone: ${slug} ${startLabel} .. ${endLabel} → public/data/timetree/${slug}-${startLabel}-${endLabel}.json`);
