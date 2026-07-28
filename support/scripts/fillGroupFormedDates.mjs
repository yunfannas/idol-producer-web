#!/usr/bin/env node
/**
 * Fill missing group.formed_date from jpop.fandom + ja.wikipedia MediaWiki APIs.
 *
 * Confidence:
 *   high   = day-precision 結成 / 結成を発表
 *   medium = month-precision or debut day
 *   low    = year-only (|years= / 結成年)
 *
 * By default applies high+medium. Pass --include-low to also apply year-only.
 *
 * Usage:
 *   node support/scripts/fillGroupFormedDates.mjs
 *   node support/scripts/fillGroupFormedDates.mjs --include-low
 *   node support/scripts/fillGroupFormedDates.mjs --only=scenario_6 --dry-run
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dryRun = process.argv.includes("--dry-run");
const includeLow = process.argv.includes("--include-low");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyLabel = onlyArg ? onlyArg.slice("--only=".length) : null;

const targets = [
  { label: "scenario_6", groupsPath: path.join(root, "public/data/scenarios/scenario_6/groups.json") },
  { label: "main", groupsPath: path.join(root, "public/data/groups.json") },
].filter((t) => !onlyLabel || t.label === onlyLabel);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "idol-producer-web-formed-date/1.0 (local research)",
          Accept: "application/json",
        },
        timeout: 30000,
      },
      (res) => {
        if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          res.resume();
          fetchText(new URL(res.headers.location, url).toString()).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        const chunks = [];
        res.on("data", (c) => chunks.push(c));
        res.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("timeout"));
    });
  });
}

async function fetchTextWithRetry(url, retries = 5) {
  let last;
  for (let i = 0; i < retries; i++) {
    try {
      const body = await fetchText(url);
      if (/^You are making too many requests/i.test(body)) {
        last = new Error("rate limited");
        await sleep(2000 * (i + 1));
        continue;
      }
      return body;
    } catch (e) {
      last = e;
      await sleep(1000 * (i + 1));
    }
  }
  throw last;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isValidFormedDate(v) {
  if (v == null) return false;
  const s = String(v).trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  return y >= 1950 && y <= 2100;
}

function parseJaDateFragment(raw) {
  const s = String(raw ?? "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/\{\{[^}]*\}\}/g, " ")
    .replace(/<[^>]+>/g, "")
    .trim();
  const day = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (day) return { iso: `${day[1]}-${pad2(day[2])}-${pad2(day[3])}`, precision: "day" };
  const month = s.match(/(\d{4})年(\d{1,2})月/);
  if (month) return { iso: `${month[1]}-${pad2(month[2])}-01`, precision: "month" };
  const year = s.match(/(\d{4})年/);
  if (year) return { iso: `${year[1]}-01-01`, precision: "year" };
  const enDay = s.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),?\s+(\d{4})\b/i,
  );
  if (enDay) {
    const months = {
      january: "01",
      february: "02",
      march: "03",
      april: "04",
      may: "05",
      june: "06",
      july: "07",
      august: "08",
      september: "09",
      october: "10",
      november: "11",
      december: "12",
    };
    return {
      iso: `${enDay[3]}-${months[enDay[1].toLowerCase()]}-${pad2(enDay[2])}`,
      precision: "day",
    };
  }
  const iso = s.match(/\b(19|20)\d{2}-\d{2}-\d{2}\b/);
  if (iso) return { iso: iso[0], precision: "day" };
  const yOnly = s.match(/\b((?:19|20)\d{2})\b/);
  if (yOnly) return { iso: `${yOnly[1]}-01-01`, precision: "year" };
  return null;
}

function extractInfoboxField(wikitext, fieldNames) {
  const names = Array.isArray(fieldNames) ? fieldNames : [fieldNames];
  for (const name of names) {
    const startRe = new RegExp(`\\|\\s*${name}\\s*=\\s*`, "i");
    const sm = startRe.exec(wikitext);
    if (!sm) continue;
    let i = sm.index + sm[0].length;
    let depth = 0;
    let out = "";
    while (i < wikitext.length) {
      const next = wikitext.slice(i, i + 2);
      const ch = wikitext[i];
      if (next === "{{") {
        depth += 1;
        out += next;
        i += 2;
        continue;
      }
      if (next === "}}") {
        depth = Math.max(0, depth - 1);
        out += next;
        i += 2;
        continue;
      }
      if (depth === 0 && ch === "\n" && wikitext[i + 1] === "|") break;
      out += ch;
      i += 1;
    }
    const val = out.trim();
    if (val && !/^\|/.test(val)) return val;
  }
  return null;
}

function titleFromWikiUrl(url) {
  if (!url || typeof url !== "string") return null;
  const m = url.match(/jpop\.fandom\.com\/wiki\/([^?#]+)/i);
  if (!m) return null;
  try {
    return decodeURIComponent(m[1].replace(/_/g, " "));
  } catch {
    return m[1].replace(/_/g, " ");
  }
}

function parseFandomFormed(wt) {
  if (!wt) return null;
  for (const key of ["formation", "formed", "debut", "Formation", "Debut"]) {
    const raw = extractInfoboxField(wt, key);
    if (!raw) continue;
    const parsed = parseJaDateFragment(raw);
    if (!parsed) continue;
    const conf = parsed.precision === "day" ? "medium" : parsed.precision === "month" ? "medium" : "low";
    return { date: parsed.iso, confidence: conf, source: `jpop_fandom_${key}`, precision: parsed.precision };
  }
  const years = extractInfoboxField(wt, ["years", "Years"]);
  if (years) {
    const m = String(years).match(/(19|20)\d{2}/);
    if (m) {
      return {
        date: `${m[0]}-01-01`,
        confidence: "low",
        source: "jpop_fandom_years",
        precision: "year",
      };
    }
  }
  return null;
}

function parseJaWikiFormed(wt) {
  if (!wt) return null;
  for (const key of ["結成", "結成日", "活動期間", "デビュー"]) {
    const raw = extractInfoboxField(wt, key);
    if (!raw) continue;
    const parsed = parseJaDateFragment(raw);
    if (!parsed) continue;
    // 活動期間 often "2011年 - " → year start
    let conf = "low";
    if (key === "結成" || key === "結成日") {
      conf = parsed.precision === "day" ? "high" : parsed.precision === "month" ? "medium" : "low";
    } else if (key === "デビュー") {
      conf = parsed.precision === "day" ? "medium" : "low";
    } else {
      conf = "low";
    }
    return { date: parsed.iso, confidence: conf, source: `ja_wikipedia_${key}`, precision: parsed.precision };
  }
  // lead sentence 結成
  const lead = wt.match(/(\d{4})年(?:(\d{1,2})月(?:(\d{1,2})日)?)?[^\n]{0,30}結成/);
  if (lead) {
    const parsed = parseJaDateFragment(lead[0]);
    if (parsed) {
      const conf = parsed.precision === "day" ? "medium" : "low";
      return { date: parsed.iso, confidence: conf, source: "ja_wikipedia_lead_結成", precision: parsed.precision };
    }
  }
  return null;
}

function accept(result) {
  if (!result?.date) return false;
  if (result.confidence === "high" || result.confidence === "medium") return true;
  return includeLow && result.confidence === "low";
}

async function wikiSearch(apiBase, title) {
  const q = new URL(apiBase);
  q.searchParams.set("action", "opensearch");
  q.searchParams.set("search", title);
  q.searchParams.set("limit", "1");
  q.searchParams.set("namespace", "0");
  q.searchParams.set("format", "json");
  const data = JSON.parse(await fetchTextWithRetry(q.toString()));
  return data[1]?.[0] || null;
}

async function fetchWikitextBatch(apiBase, titles) {
  const map = new Map();
  const unique = [...new Set(titles.filter(Boolean))];
  for (let i = 0; i < unique.length; i += 40) {
    const batch = unique.slice(i, i + 40);
    const q = new URL(apiBase);
    q.searchParams.set("action", "query");
    q.searchParams.set("prop", "revisions");
    q.searchParams.set("rvprop", "content");
    q.searchParams.set("rvslots", "main");
    q.searchParams.set("format", "json");
    q.searchParams.set("redirects", "1");
    q.searchParams.set("titles", batch.join("|"));
    try {
      const data = JSON.parse(await fetchTextWithRetry(q.toString()));
      const redirects = new Map((data.query?.redirects || []).map((r) => [r.from, r.to]));
      const normalized = new Map((data.query?.normalized || []).map((n) => [n.from, n.to]));
      const byTitle = new Map();
      for (const page of Object.values(data.query?.pages || {})) {
        if (page.missing != null) continue;
        const wt = page.revisions?.[0]?.slots?.main?.["*"];
        if (wt) byTitle.set(page.title, wt);
      }
      for (const requested of batch) {
        let t = requested;
        if (normalized.has(t)) t = normalized.get(t);
        if (redirects.has(t)) t = redirects.get(t);
        if (byTitle.has(t)) map.set(requested, byTitle.get(t));
      }
    } catch (e) {
      console.error("batch error", e.message || e);
    }
    await sleep(250);
  }
  return map;
}

async function processFile(target) {
  const groups = JSON.parse(fs.readFileSync(target.groupsPath, "utf8"));
  const missing = groups.filter((g) => !isValidFormedDate(g.formed_date));
  const stats = {
    label: target.label,
    total: groups.length,
    missing_before: missing.length,
    filled_fandom: 0,
    filled_jawiki: 0,
    skipped_low: 0,
    still_missing: 0,
  };
  const report = [];

  // 1) Fandom batch via wiki_url titles + name search for gaps
  const titleByUid = new Map();
  for (const g of missing) {
    const t = titleFromWikiUrl(g.wiki_url);
    if (t) titleByUid.set(g.uid, t);
  }
  console.error(`[${target.label}] fandom titles from url: ${titleByUid.size}; searching ${missing.length - titleByUid.size}…`);
  for (const g of missing) {
    if (titleByUid.has(g.uid)) continue;
    try {
      const t = await wikiSearch("https://jpop.fandom.com/api.php", String(g.name || ""));
      if (t) titleByUid.set(g.uid, t);
    } catch {
      /* ignore */
    }
    await sleep(120);
  }
  const fandomMap = await fetchWikitextBatch("https://jpop.fandom.com/api.php", [...titleByUid.values()]);

  const still = [];
  for (const g of missing) {
    const title = titleByUid.get(g.uid);
    const wt = title ? fandomMap.get(title) : null;
    const result = parseFandomFormed(wt);
    if (result && accept(result)) {
      g.formed_date = result.date;
      g.formed_date_source = result.source;
      g.formed_date_precision = result.precision;
      stats.filled_fandom += 1;
      report.push({ name: g.name, uid: g.uid, ...result });
    } else {
      if (result && result.confidence === "low") stats.skipped_low += 1;
      still.push(g);
    }
  }

  // 2) ja.wikipedia for remaining
  console.error(`[${target.label}] ja.wikipedia for ${still.length} remaining…`);
  let i = 0;
  for (const g of still) {
    i += 1;
    if (i % 20 === 0) console.error(`  … ${i}/${still.length}`);
    try {
      const title = await wikiSearch("https://ja.wikipedia.org/w/api.php", String(g.name || ""));
      await sleep(800);
      if (!title) continue;
      const q = new URL("https://ja.wikipedia.org/w/api.php");
      q.searchParams.set("action", "query");
      q.searchParams.set("prop", "revisions");
      q.searchParams.set("rvprop", "content");
      q.searchParams.set("rvslots", "main");
      q.searchParams.set("format", "json");
      q.searchParams.set("redirects", "1");
      q.searchParams.set("titles", title);
      const data = JSON.parse(await fetchTextWithRetry(q.toString()));
      await sleep(800);
      const page = Object.values(data.query?.pages || {})[0];
      const wt = page?.revisions?.[0]?.slots?.main?.["*"];
      const result = parseJaWikiFormed(wt);
      if (result && accept(result)) {
        g.formed_date = result.date;
        g.formed_date_source = result.source;
        g.formed_date_precision = result.precision;
        stats.filled_jawiki += 1;
        report.push({ name: g.name, uid: g.uid, ...result });
      } else if (result && result.confidence === "low") {
        stats.skipped_low += 1;
        // stash suggestion on report only
        report.push({ name: g.name, uid: g.uid, ...result, applied: false });
      }
      if (!dryRun && stats.filled_jawiki > 0 && stats.filled_jawiki % 10 === 0) {
        fs.writeFileSync(target.groupsPath, `${JSON.stringify(groups, null, 2)}\n`, "utf8");
        console.error(`  checkpoint saved (${stats.filled_jawiki} ja fills)`);
      }
    } catch {
      await sleep(3000);
    }
  }

  stats.still_missing = groups.filter((g) => !isValidFormedDate(g.formed_date)).length;

  if (!dryRun) {
    fs.writeFileSync(target.groupsPath, `${JSON.stringify(groups, null, 2)}\n`, "utf8");
  }

  const reportPath = path.join(root, "support/reports", `group_formed_date_fill_${target.label}.json`);
  const missingNames = groups.filter((g) => !isValidFormedDate(g.formed_date)).map((g) => g.name);
  if (!dryRun) {
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify({ generated_at: new Date().toISOString(), stats, filled: report.filter((r) => r.applied !== false), low_suggestions: report.filter((r) => r.applied === false), still_missing: missingNames }, null, 2)}\n`,
      "utf8",
    );
  }

  // Full export CSV of all groups' formed dates
  const csvPath = path.join(root, "support/reports", `group_formed_dates_${target.label}.csv`);
  const csvLines = ["name,uid,formed_date,formed_date_source,formed_date_precision"];
  for (const g of groups) {
    csvLines.push(
      [
        `"${String(g.name).replace(/"/g, '""')}"`,
        g.uid,
        g.formed_date || "",
        g.formed_date_source || "",
        g.formed_date_precision || "",
      ].join(","),
    );
  }
  if (!dryRun) fs.writeFileSync(csvPath, `${csvLines.join("\n")}\n`, "utf8");

  return { ...stats, report: reportPath, csv: csvPath, still_missing_sample: missingNames.slice(0, 25) };
}

const results = [];
for (const t of targets) {
  console.error(`Processing ${t.label}…`);
  results.push(await processFile(t));
}
console.log(JSON.stringify({ dry_run: dryRun, include_low: includeLow, results }, null, 2));
