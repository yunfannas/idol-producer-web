/**
 * Extend existing TimeTree range JSON files by scraping only the new months,
 * then merging into a longer range file (old file removed).
 *
 * Usage:
 *   node support/scripts/timetree_extend_range.mjs [newEndYYYY-MM] [options]
 *
 * Options:
 *   --from-end YYYY-MM   Current range end to match (default: 2026-05)
 *   --create-venues
 *   --no-venues
 *   --no-festivals
 *   --no-catalog
 *   --slug SLUG          Limit to one slug (repeatable)
 *
 * Example:
 *   npm run calendar:timetree-extend -- 2026-07 --create-venues
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const timetreeDir = path.join(root, "public", "data", "timetree");

const argv = process.argv.slice(2);
const createVenues = argv.includes("--create-venues");
const noVenues = argv.includes("--no-venues");
const noFestivals = argv.includes("--no-festivals");
const noCatalog = argv.includes("--no-catalog");

function flagValue(name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const values = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j += 1) values.push(argv[j]);
  return values.length ? values : undefined;
}

function parseYm(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return { y: Number(m[1]), mo: Number(m[2]), label: `${m[1]}-${m[2]}` };
}

function monthKey(y, mo) {
  return y * 12 + (mo - 1);
}

function nextMonth(y, mo) {
  return mo === 12 ? { y: y + 1, mo: 1 } : { y, mo: mo + 1 };
}

const positional = argv.filter((a) => !a.startsWith("--"));
const newEnd = parseYm(positional[0] ?? "2026-07");
const fromEnd = parseYm(flagValue("--from-end")?.[0] ?? "2026-05");
if (!newEnd || !fromEnd) {
  console.error("Invalid YYYY-MM");
  process.exit(1);
}
if (monthKey(newEnd.y, newEnd.mo) <= monthKey(fromEnd.y, fromEnd.mo)) {
  console.error(`new end ${newEnd.label} must be after current end ${fromEnd.label}`);
  process.exit(1);
}

const slugFilter = new Set(flagValue("--slug") ?? []);

const rangeRe = /^(.+)-(\d{4}-\d{2})-(\d{4}-\d{2})\.json$/;
const files = fs
  .readdirSync(timetreeDir)
  .map((name) => {
    const m = rangeRe.exec(name);
    if (!m) return null;
    return { name, slug: m[1], from: m[2], to: m[3], path: path.join(timetreeDir, name) };
  })
  .filter((row) => row && row.to === fromEnd.label)
  .filter((row) => !slugFilter.size || slugFilter.has(row.slug));

if (!files.length) {
  console.error(`No range files ending in ${fromEnd.label}`);
  process.exit(1);
}

function runNode(scriptRel, args, label) {
  console.error(`\n>>> ${label}`);
  const r = spawnSync(process.execPath, [path.join(__dirname, scriptRel), ...args], {
    cwd: root,
    stdio: "inherit",
  });
  if (r.status !== 0) throw new Error(`${label} failed (exit ${r.status ?? 1})`);
}

function scrapeMonths(slug, startYm, endYm, outDir) {
  let cur = { y: startYm.y, mo: startYm.mo };
  while (monthKey(cur.y, cur.mo) <= monthKey(endYm.y, endYm.mo)) {
    const monthly = `${cur.y}-${String(cur.mo).padStart(2, "0")}-01`;
    const url = `https://timetreeapp.com/public_calendars/${slug}?monthly=${monthly}`;
    const outFile = path.join(outDir, `${slug}-${monthly.slice(0, 7)}.json`);
    console.error(`\n=== ${url} ===`);
    const r = spawnSync(
      process.execPath,
      [path.join(__dirname, "timetree_public_calendar_scrape.mjs"), url, outFile],
      { cwd: root, stdio: "inherit" },
    );
    if (r.status !== 0) throw new Error(`scrape ${slug} ${monthly.slice(0, 7)} failed`);
    cur = nextMonth(cur.y, cur.mo);
  }
}

const firstNew = nextMonth(fromEnd.y, fromEnd.mo);
/** @type {{ slug: string, events: number, added: number, status: string, error?: string }[]} */
const report = [];

for (const file of files) {
  console.error(`\n========== extend ${file.slug} ${file.from}..${fromEnd.label} → ${newEnd.label} ==========`);
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), `idol-timetree-ext-${file.slug}-`));
  try {
    const existing = JSON.parse(fs.readFileSync(file.path, "utf8"));
    const oldEvents = Array.isArray(existing.events) ? existing.events : [];

    scrapeMonths(file.slug, firstNew, newEnd, tmpDir);

    const seen = new Set();
    const merged = [];
    for (const e of oldEvents) {
      const key = e.timetree_id ? `id:${e.timetree_id}` : `${e.date}\0${e.event}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push({ ...e });
    }

    let added = 0;
    for (const ym of (() => {
      const months = [];
      let c = { y: firstNew.y, mo: firstNew.mo };
      while (monthKey(c.y, c.mo) <= monthKey(newEnd.y, newEnd.mo)) {
        months.push(`${c.y}-${String(c.mo).padStart(2, "0")}`);
        c = nextMonth(c.y, c.mo);
      }
      return months;
    })()) {
      const monthlyPath = path.join(tmpDir, `${file.slug}-${ym}.json`);
      if (!fs.existsSync(monthlyPath)) continue;
      const j = JSON.parse(fs.readFileSync(monthlyPath, "utf8"));
      for (const e of j.events ?? []) {
        const key = e.timetree_id ? `id:${e.timetree_id}` : `${e.date}\0${e.event}`;
        if (seen.has(key)) continue;
        seen.add(key);
        merged.push({ ...e });
        added += 1;
      }
    }

    merged.sort((a, b) => a.date.localeCompare(b.date) || a.event.localeCompare(b.event));

    const outPath = path.join(timetreeDir, `${file.slug}-${file.from}-${newEnd.label}.json`);
    const payload = {
      source_url: existing.source_url ?? `https://timetreeapp.com/public_calendars/${file.slug}`,
      slug: file.slug,
      range: { from: file.from, to: newEnd.label },
      generated_at: new Date().toISOString(),
      event_count: merged.length,
      events: merged,
    };
    fs.writeFileSync(outPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    if (path.resolve(outPath) !== path.resolve(file.path)) fs.unlinkSync(file.path);

    runNode("timetree_enrich_events.mjs", [outPath], `enrich ${file.slug}`);
    if (!noVenues) {
      const venueArgs = [outPath];
      if (createVenues) venueArgs.push("--create-venues");
      runNode("timetree_resolve_venues.mjs", venueArgs, `venues ${file.slug}`);
    }
    if (!noFestivals) {
      runNode("applyMultiVenueFestivals.mjs", [outPath], `multi-venue ${file.slug}`);
    }

    report.push({ slug: file.slug, events: merged.length, added, status: "ok" });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ERROR: ${message}`);
    report.push({ slug: file.slug, events: 0, added: 0, status: "error", error: message });
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}

if (!noCatalog) {
  try {
    runNode("buildLiveEventsCatalog.mjs", [], "live catalog merge");
  } catch (err) {
    console.error(`Catalog merge failed: ${err instanceof Error ? err.message : err}`);
  }
}

console.error("\n========== EXTEND SUMMARY ==========");
for (const row of report) {
  if (row.status === "ok") {
    console.error(`  OK  ${row.slug.padEnd(24)} +${String(row.added).padStart(3)} → ${row.events} events`);
  } else {
    console.error(`  ERR ${row.slug.padEnd(24)} ${row.error}`);
  }
}
if (report.some((r) => r.status === "error")) process.exit(1);
