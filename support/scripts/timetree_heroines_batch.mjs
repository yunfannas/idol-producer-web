/**
 * Batch TimeTree pipeline for HEROINES roster groups.
 * Scrape range → enrich → venues → multi-venue festivals → live catalog merge.
 *
 * Usage:
 *   node support/scripts/timetree_heroines_batch.mjs [fromYYYY-MM] [toYYYY-MM] [options]
 *
 * Options:
 *   --allowlist-only     Only groups with in_startup_allowlist: true
 *   --slug SLUG          Single slug (repeatable)
 *   --skip-existing      Skip scrape when range JSON already exists
 *   --force              Re-scrape even if range file exists
 *   --no-venues          Skip venue resolution
 *   --no-festivals       Skip multi-venue festival pass
 *   --no-catalog         Skip live_events_catalog rebuild
 *   --create-venues      Pass --create-venues to venue resolver
 *
 * Example:
 *   npm run calendar:timetree-heroines -- 2025-07 2026-05 --allowlist-only --create-venues
 */

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const rosterPath = path.join(root, "public", "data", "reference", "timetree_heroines_roster.json");
const timetreeDir = path.join(root, "public", "data", "timetree");
const slugMapPath = path.join(root, "public", "data", "reference", "timetree_group_slugs.json");

const argv = process.argv.slice(2);
const allowlistOnly = argv.includes("--allowlist-only");
const skipExisting = argv.includes("--skip-existing");
const force = argv.includes("--force");
const noVenues = argv.includes("--no-venues");
const noFestivals = argv.includes("--no-festivals");
const noCatalog = argv.includes("--no-catalog");
const createVenues = argv.includes("--create-venues");

function flagValue(name) {
  const i = argv.indexOf(name);
  if (i < 0) return undefined;
  const values = [];
  for (let j = i + 1; j < argv.length && !argv[j].startsWith("--"); j += 1) {
    values.push(argv[j]);
  }
  return values.length ? values : undefined;
}

function parseYm(s) {
  const m = /^(\d{4})-(\d{2})$/.exec(String(s ?? "").trim());
  if (!m) return null;
  return `${m[1]}-${m[2]}`;
}

const positional = argv.filter((a) => !a.startsWith("--"));
const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
const fromYm = parseYm(positional[0] ?? roster.default_range?.from ?? "2025-07");
const toYm = parseYm(positional[1] ?? roster.default_range?.to ?? "2026-05");
if (!fromYm || !toYm) {
  console.error("Invalid month range. Use YYYY-MM YYYY-MM");
  process.exit(1);
}

const slugFilter = new Set(flagValue("--slug") ?? []);

/** @type {{ slug: string, group_name: string }[]} */
let groups = (roster.groups ?? [])
  .filter((g) => g.slug)
  .map((g) => ({ slug: String(g.slug), group_name: String(g.group_name) }));

if (allowlistOnly) {
  const allowed = new Set(
    (roster.groups ?? []).filter((g) => g.in_startup_allowlist && g.slug).map((g) => String(g.slug)),
  );
  groups = groups.filter((g) => allowed.has(g.slug));
}
if (slugFilter.size) {
  groups = groups.filter((g) => slugFilter.has(g.slug));
}
if (!groups.length) {
  console.error("No roster groups matched filters.");
  process.exit(1);
}

function rangeFile(slug) {
  return path.join(timetreeDir, `${slug}-${fromYm}-${toYm}.json`);
}

function runNode(scriptRel, args, label) {
  const script = path.join(__dirname, scriptRel);
  console.error(`\n>>> ${label}`);
  const r = spawnSync(process.execPath, [script, ...args], { cwd: root, stdio: "inherit" });
  if (r.status !== 0) {
    throw new Error(`${label} failed (exit ${r.status ?? 1})`);
  }
}

function syncSlugMap(entries) {
  const map = JSON.parse(fs.readFileSync(slugMapPath, "utf8"));
  map.slugs = map.slugs ?? {};
  for (const { slug, group_name } of entries) {
    map.slugs[slug] = group_name;
  }
  fs.writeFileSync(slugMapPath, `${JSON.stringify(map, null, 2)}\n`, "utf8");
}

syncSlugMap(groups);

/** @type {{ slug: string, group_name: string, status: string, events?: number, error?: string }[]} */
const report = [];

for (const { slug, group_name } of groups) {
  const outFile = rangeFile(slug);
  console.error(`\n========== ${group_name} (${slug}) ==========`);
  try {
    const exists = fs.existsSync(outFile);
    if (force || !exists || !skipExisting) {
      if (exists && skipExisting && !force) {
        console.error(`  scrape: skipped (exists ${path.basename(outFile)})`);
      } else {
        runNode("timetree_public_calendar_range.mjs", [slug, fromYm, toYm], `scrape ${slug}`);
      }
    } else {
      console.error(`  scrape: skipped (exists)`);
    }

    if (!fs.existsSync(outFile)) {
      throw new Error(`Missing output ${outFile}`);
    }

    runNode("timetree_enrich_events.mjs", [outFile], `enrich ${slug}`);

    if (!noVenues) {
      const venueArgs = [outFile];
      if (createVenues) venueArgs.push("--create-venues");
      runNode("timetree_resolve_venues.mjs", venueArgs, `venues ${slug}`);
    }

    if (!noFestivals) {
      runNode("applyMultiVenueFestivals.mjs", [outFile], `multi-venue ${slug}`);
    }

    const data = JSON.parse(fs.readFileSync(outFile, "utf8"));
    report.push({
      slug,
      group_name,
      status: "ok",
      events: Number(data.event_count ?? data.events?.length ?? 0),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`  ERROR: ${message}`);
    report.push({ slug, group_name, status: "error", error: message });
  }
}

if (!noCatalog) {
  try {
    runNode("buildLiveEventsCatalog.mjs", [], "live catalog merge");
  } catch (err) {
    console.error(`Catalog merge failed: ${err instanceof Error ? err.message : err}`);
  }
}

console.error("\n========== BATCH SUMMARY ==========");
let totalEvents = 0;
for (const row of report) {
  if (row.status === "ok") {
    totalEvents += row.events ?? 0;
    console.error(`  OK  ${row.slug.padEnd(24)} ${String(row.events).padStart(4)} events  (${row.group_name})`);
  } else {
    console.error(`  ERR ${row.slug.padEnd(24)}       —  ${row.error}`);
  }
}
console.error(`\n${report.filter((r) => r.status === "ok").length}/${report.length} groups OK, ${totalEvents} total events in range files`);
if (report.some((r) => r.status === "error")) process.exit(1);
