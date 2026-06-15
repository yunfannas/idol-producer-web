/**
 * Export schedule rows missing venue (physical lives only) to CSV.
 *
 * Usage:
 *   node scripts/schedule_gaps_csv.mjs [--out path.csv] [--group equal-love]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  isCommercialPromoEvent,
  isPlaceholderLiveTitle,
  isVirtualLiveEvent,
} from "./timetreeEventParse.mjs";
import { isImageOnlyLive } from "./timetreePosterExtract.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");

const groupFilter = process.argv.includes("--group")
  ? process.argv[process.argv.indexOf("--group") + 1]
  : null;

const defaultOut = groupFilter
  ? path.join(root, "support", "docs", "reference", `${groupFilter}_schedule_gaps.csv`)
  : path.join(root, "support", "docs", "reference", "schedule_gaps.csv");

const outPath = path.resolve(
  process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : defaultOut,
);

function csvEscape(s) {
  const t = String(s ?? "");
  if (/[",\n\r]/.test(t)) return `"${t.replace(/"/g, '""')}"`;
  return t;
}

function rowToCsvLine(cols) {
  return cols.map(csvEscape).join(",");
}

function shouldSkip(row) {
  const type = String(row.type ?? "");
  if (["Media", "Cancelled", "Promo", "Virtual", "TvShow", "OfflineEvent", "GuestLive", "Birthday"].includes(type)) return true;
  if (isVirtualLiveEvent(row)) return true;
  if (isPlaceholderLiveTitle(row.event)) return true;
  if (isCommercialPromoEvent(row)) return true;
  return false;
}

/** @param {Record<string, unknown>} data @param {string} source @param {string} groupId */
function gapsFromFile(data, source, groupId) {
  const gaps = [];
  for (const row of data.events ?? []) {
    if (shouldSkip(row)) continue;
    const hasVenue = Boolean(String(row.venue ?? "").trim());
    const posterOnly = isImageOnlyLive(row);
    if (hasVenue && !posterOnly) continue;

    gaps.push({
      source,
      group: groupId,
      date: row.date ?? "",
      type: row.type ?? "",
      site_category: row.site_category ?? "",
      event: row.event ?? "",
      venue: row.venue ?? "",
      venue_hint: row.venue_hint ?? "",
      gap: hasVenue ? "poster_only" : "no_venue",
      has_poster: posterOnly || Boolean(row.poster_urls?.length || row.poster_image_url),
      timetree_url: row.timetree_url ?? "",
      official_detail_url: row.official_detail_url ?? "",
      note_preview: String(row.note ?? "")
        .replace(/\s+/g, " ")
        .slice(0, 120),
    });
  }
  return gaps;
}

/** @type {ReturnType<typeof gapsFromFile>} */
const allGaps = [];

const timetreeDir = path.join(root, "public", "data", "timetree");
if (fs.existsSync(timetreeDir)) {
  for (const name of fs.readdirSync(timetreeDir).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(timetreeDir, name), "utf8"));
    const slug = data.slug ?? name.replace(/-\d{4}-\d{2}-\d{4}-\d{2}\.json$/, "");
    allGaps.push(...gapsFromFile(data, "timetree", slug));
  }
}

const officialDir = path.join(root, "public", "data", "official_schedules");
if (fs.existsSync(officialDir)) {
  for (const name of fs.readdirSync(officialDir).filter((n) => n.endsWith(".json"))) {
    const data = JSON.parse(fs.readFileSync(path.join(officialDir, name), "utf8"));
    const key = data.group_key ?? name.replace(/-\d{4}-\d{2}-\d{4}-\d{2}\.json$/, "");
    allGaps.push(...gapsFromFile(data, "official", key));
  }
}

const header = [
  "source",
  "group",
  "date",
  "type",
  "site_category",
  "gap",
  "event",
  "venue",
  "venue_hint",
  "has_poster",
  "timetree_url",
  "official_detail_url",
  "note_preview",
];

const filteredGaps = groupFilter
  ? allGaps.filter((g) => g.group === groupFilter)
  : allGaps;

const lines = [rowToCsvLine(header)];
for (const g of filteredGaps.sort((a, b) =>
  `${a.source}\t${a.group}\t${a.date}\t${a.event}`.localeCompare(
    `${b.source}\t${b.group}\t${b.date}\t${b.event}`,
  ),
)) {
  lines.push(
    rowToCsvLine([
      g.source,
      g.group,
      g.date,
      g.type,
      g.site_category,
      g.gap,
      g.event,
      g.venue,
      g.venue_hint,
      g.has_poster ? "yes" : "",
      g.timetree_url,
      g.official_detail_url,
      g.note_preview,
    ]),
  );
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
// UTF-8 BOM + CRLF so Excel on Windows opens Japanese correctly
fs.writeFileSync(outPath, `\uFEFF${lines.join("\r\n")}\r\n`, "utf8");

const byGroup = Object.groupBy(filteredGaps, (g) => `${g.source}:${g.group}`);
console.error(`Wrote ${outPath} (${filteredGaps.length} gap rows)`);
for (const [key, rows] of Object.entries(byGroup).sort()) {
  const noVenue = rows.filter((r) => r.gap === "no_venue").length;
  const poster = rows.filter((r) => r.gap === "poster_only").length;
  console.error(`  ${key}: ${rows.length} (${noVenue} no_venue, ${poster} poster_only)`);
}
