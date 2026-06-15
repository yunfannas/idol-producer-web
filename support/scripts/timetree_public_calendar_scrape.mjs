/**
 * Fetch a TimeTree *public* calendar month and write event JSON.
 * Uses the `public_events` API (captured after SPA load); falls back to DOM grid.
 * Ignores TBA placeholder titles (ライブ予定, LIVE予定, 大阪LIVE予定, 名古屋LIVE予定).
 *
 * Setup (once):
 *   npm install playwright
 *   npx playwright install chromium
 *
 * Usage:
 *   node scripts/timetree_public_calendar_scrape.mjs "https://timetreeapp.com/public_calendars/akishibu?monthly=2025-07-01"
 *   node scripts/timetree_public_calendar_scrape.mjs "<url>" ./out/akishibu-2025-07.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { publicEventToRow, publicEventsFromApiBody } from "./timetreeApiExtract.mjs";
import { isPlaceholderLiveTitle } from "./timetreeEventParse.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function defaultOutFilename(u) {
  try {
    const { pathname, searchParams } = new URL(u);
    const slug = pathname.split("/").filter(Boolean).pop() ?? "calendar";
    const m = searchParams.get("monthly") ?? "month";
    const month = m.slice(0, 7).replace(/[^\d-]/g, "") || "unknown";
    return `${slug}-${month}.json`;
  } catch {
    return "timetree-calendar.json";
  }
}

function parseSlugFromUrl(u) {
  try {
    const parts = new URL(u).pathname.split("/").filter(Boolean);
    const i = parts.indexOf("public_calendars");
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return parts.at(-1) ?? "calendar";
  } catch {
    return "calendar";
  }
}

const url = process.argv[2];

if (!url?.includes("timetreeapp.com/public_calendars/")) {
  console.error(
    "Pass a public calendar URL, e.g. https://timetreeapp.com/public_calendars/akishibu?monthly=2025-07-01 [optional-out.json]",
  );
  process.exit(1);
}

const slug = parseSlugFromUrl(url);
const outPath =
  process.argv[3] ?? path.join(__dirname, "..", "..", "public", "data", "timetree", defaultOutFilename(url));

let chromium;
try {
  ({ chromium } = await import("playwright"));
} catch {
  console.error("Install Playwright: npm install playwright && npx playwright install chromium");
  process.exit(1);
}

/** Walk unknown JSON for arrays of event-like objects (DOM fallback path). */
function flattenEventCandidates(node, depth = 0) {
  if (depth > 12 || node == null) return [];
  if (Array.isArray(node)) {
    const out = [];
    for (const item of node) {
      if (item && typeof item === "object" && looksLikeEventRow(item)) out.push(item);
      else out.push(...flattenEventCandidates(item, depth + 1));
    }
    return out;
  }
  if (typeof node === "object") {
    const out = [];
    for (const v of Object.values(node)) out.push(...flattenEventCandidates(v, depth + 1));
    return out;
  }
  return [];
}

function looksLikeEventRow(o) {
  if (!o || typeof o !== "object") return false;
  const title = o.title ?? o.name ?? o.summary ?? o.event_title;
  const start = o.start_at ?? o.startAt ?? o.starts_at ?? o.start_time ?? o.date ?? o.day;
  return typeof title === "string" && title.trim().length > 0 && (start != null || o.all_day != null);
}

function isoDateOnly(v) {
  if (v == null) return null;
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  if (typeof v === "number" && Number.isFinite(v)) {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}

function rowFromLegacyApiObject(o, slug) {
  const pe = /** @type {Record<string, unknown>} */ (o);
  if (pe.id != null && pe.start_at != null) {
    return publicEventToRow(pe, slug);
  }
  const title = String(o.title ?? o.name ?? o.summary ?? o.event_title ?? "").trim();
  if (!title || title === "ライブ予定") return null;
  const date =
    isoDateOnly(o.start_at) ??
    isoDateOnly(o.startAt) ??
    isoDateOnly(o.starts_at) ??
    isoDateOnly(o.start_time) ??
    isoDateOnly(o.date) ??
    isoDateOnly(o.day);
  if (!date) return null;
  return { date, event: title };
}

const apiEventsById = new Map();

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();

page.on("response", async (response) => {
  try {
    const ct = (response.headers()["content-type"] ?? "").toLowerCase();
    if (!ct.includes("json")) return;
    const u = response.url();
    if (!/timetreeapp\.com\/api\/v2\/public_calendars\//i.test(u)) return;
    if (!/\/public_events/i.test(u)) return;
    const text = await response.text();
    let j;
    try {
      j = JSON.parse(text);
    } catch {
      return;
    }
    for (const pe of publicEventsFromApiBody(j)) {
      if (!pe || typeof pe !== "object") continue;
      const id = String(/** @type {Record<string, unknown>} */ (pe).id ?? "").trim();
      if (id) apiEventsById.set(id, pe);
    }
  } catch {
    /* ignore */
  }
});

await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60_000 });
await new Promise((r) => setTimeout(r, 3000));
await Promise.race([
  page.waitForLoadState("networkidle").catch(() => undefined),
  new Promise((r) => setTimeout(r, 15_000)),
]);

let rows = [];
for (const pe of apiEventsById.values()) {
  const r = publicEventToRow(/** @type {Record<string, unknown>} */ (pe), slug);
  if (r) rows.push(r);
}

if (rows.length === 0) {
  rows = await page.evaluate(() => {
    const { year, month } = (() => {
      try {
        const m = new URL(window.location.href).searchParams.get("monthly") ?? "";
        const mo = /^(\d{4})-(\d{2})-\d{2}$/.exec(m);
        if (!mo) return { year: null, month: null };
        return { year: Number(mo[1]), month: Number(mo[2]) };
      } catch {
        return { year: null, month: null };
      }
    })();
    if (!year || !month) return [];
    const root = document.getElementById("react-root");
    if (!root) return [];
    const grid = root.querySelector('[role="grid"]') ?? root.querySelector("main") ?? root;
    const out = [];
    const seen = new Set();

    for (const el of grid.querySelectorAll('[role="gridcell"], button, a')) {
      const txt = (el.innerText || "").trim();
      if (!txt || txt.length > 220) continue;
      const lines = txt.split(/\n+/).map((s) => s.trim()).filter(Boolean);
      if (lines.length < 2) continue;
      const dm = /^(\d{1,2})$/.exec(lines[0]);
      if (!dm) continue;
      const d = Number(dm[1]);
      if (d < 1 || d > 31) continue;
      const date = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      for (let i = 1; i < lines.length; i++) {
        const ev = lines[i];
        if (!ev || isPlaceholderLiveTitle(ev)) continue;
        if (/^(Mon|Tue|Wed|Thu|Fri|Sat|Sun)$/i.test(ev)) continue;
        if (/^(January|February|March|April|May|June|July|August|September|October|November|December)/i.test(ev))
          continue;
        if (/^(Today|Login|Sign up|Public Calendar)/i.test(ev)) continue;
        const key = `${date}|${ev}`;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ date, event: ev });
      }
    }
    return out;
  });
}

/** De-dupe: prefer timetree_id, else date+event */
const deduped = new Map();
for (const r of rows) {
  const key = r.timetree_id ? `id:${r.timetree_id}` : `${r.date}\t${r.event}`;
  if (!deduped.has(key)) deduped.set(key, r);
}
rows = [...deduped.values()].sort((a, b) =>
  a.date !== b.date ? a.date.localeCompare(b.date) : a.event.localeCompare(b.event),
);

const outDir = path.dirname(outPath);
fs.mkdirSync(outDir, { recursive: true });
const output = {
  source_url: url,
  slug,
  generated_at: new Date().toISOString(),
  event_count: rows.length,
  events: rows,
};
fs.writeFileSync(outPath, JSON.stringify(output, null, 2), "utf8");

const withVenueHint = rows.filter((r) => r.venue_hint).length;
const withPoster = rows.filter((r) => r.poster_urls?.length).length;
console.log(`Wrote ${rows.length} events to ${outPath} (${withVenueHint} venue hints, ${withPoster} with poster URLs)`);
await browser.close();
