/**
 * Merge monthly TimeTree JSON into one range file (monthly inputs are not kept).
 *
 * Usage:
 *   node scripts/timetree_merge_monthly_json.mjs --slug SLUG --from YYYY-MM --to YYYY-MM [--src-dir DIR]
 *
 * (--from / --to avoid PowerShell treating 2025-07 as flags.)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "..", "public", "data", "timetree");

function flag(args, name) {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : undefined;
}

const args = process.argv.slice(2);
const srcDir = path.resolve(flag(args, "--src-dir") ?? outDir);
const slug = flag(args, "--slug") ?? "akishibu";
const fromYm = flag(args, "--from");
const toYm = flag(args, "--to");

function parseYm(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]) };
}

function monthKey(y, mo) {
  return y * 12 + (mo - 1);
}

const start = parseYm(fromYm);
const end = parseYm(toYm);
if (!start || !end) {
  console.error(
    "Usage: node scripts/timetree_merge_monthly_json.mjs --slug SLUG --from YYYY-MM --to YYYY-MM [--src-dir DIR]",
  );
  process.exit(1);
}
if (monthKey(end.y, end.mo) < monthKey(start.y, start.mo)) {
  console.error("End month is before start month.");
  process.exit(1);
}

const months = [];
let cur = { y: start.y, mo: start.mo };
while (monthKey(cur.y, cur.mo) <= monthKey(end.y, end.mo)) {
  months.push(`${cur.y}-${String(cur.mo).padStart(2, "0")}`);
  cur.mo += 1;
  if (cur.mo > 12) {
    cur.mo = 1;
    cur.y += 1;
  }
}

const seen = new Set();
const events = [];
const monthlyPaths = [];

for (const ym of months) {
  const p = path.join(srcDir, `${slug}-${ym}.json`);
  if (!fs.existsSync(p)) {
    console.error(`Missing monthly file: ${p}`);
    process.exit(1);
  }
  monthlyPaths.push(p);
  const j = JSON.parse(fs.readFileSync(p, "utf8"));
  for (const e of j.events ?? []) {
    const key = e.timetree_id ? `id:${e.timetree_id}` : `${e.date}\0${e.event}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({ ...e });
  }
}

events.sort((a, b) => a.date.localeCompare(b.date) || a.event.localeCompare(b.event));

const from = months[0];
const to = months[months.length - 1];
const out = {
  source_url: `https://timetreeapp.com/public_calendars/${slug}`,
  slug,
  range: { from, to },
  generated_at: new Date().toISOString(),
  event_count: events.length,
  events,
};

fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, `${slug}-${from}-${to}.json`);
fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");

for (const p of monthlyPaths) {
  fs.unlinkSync(p);
}

const monthRe = new RegExp(`^${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-\\d{4}-\\d{2}\\.json$`);
for (const name of fs.readdirSync(outDir)) {
  if (monthRe.test(name)) fs.unlinkSync(path.join(outDir, name));
}

console.error(`Wrote ${outPath} (${events.length} events, ${months.length} months; monthly files removed)`);
