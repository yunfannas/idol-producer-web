/**
 * Suggest formed_date for groups missing it via ja.wikipedia.org, jpop.fandom.com,
 * and DuckDuckGo web search (when wiki confidence is not high).
 * Writes a review CSV; optionally writes high-confidence override JSON stubs.
 *
 * Usage:
 *   node scripts/suggestGroupFormedDates.mjs
 *   node scripts/suggestGroupFormedDates.mjs --scenario6
 *   node scripts/suggestGroupFormedDates.mjs --scenario6 --limit 20
 *   node scripts/suggestGroupFormedDates.mjs --scenario6 --write-overrides
 *   node scripts/suggestGroupFormedDates.mjs --delay-ms 2000
 *   node scripts/suggestGroupFormedDates.mjs --no-web-search
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const groupsPath = path.join(root, "public/data/groups.json");
const scenario6Path = path.join(root, "public/data/scenarios/scenario_6/groups.json");
const overridesDir = path.join(root, "public/data/reference/group_catalog_overrides");
const defaultOut = path.join(root, "support/docs/reference/group_formed_date_suggestions.csv");

const UA = "idol-producer-web/1.0 (formed-date enrichment; contact: local dev)";
const WIKI_API = "https://ja.wikipedia.org/w/api.php";
const DDG_HTML = "https://html.duckduckgo.com/html/";

const EN_MONTHS =
  "January|February|March|April|May|June|July|August|September|October|November|December";
const EN_MONTH_TO_NUM = {
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

function parseArgs() {
  const args = process.argv.slice(2);
  let limit = Infinity;
  let delayMs = 1500;
  let outPath = defaultOut;
  let groupNameFilter = "";
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--scenario6") continue;
    if (a === "--write-overrides") continue;
    if (a === "--force-overrides") continue;
    if (a === "--no-web-search") continue;
    if (a === "--limit" && args[i + 1]) limit = Number(args[++i]) || limit;
    else if (a === "--delay-ms" && args[i + 1]) delayMs = Number(args[++i]) || delayMs;
    else if (a === "--out" && args[i + 1]) outPath = path.resolve(root, args[++i]);
    else if (a === "--group-name" && args[i + 1]) groupNameFilter = String(args[++i]).trim();
  }
  return {
    scenario6: args.includes("--scenario6"),
    writeOverrides: args.includes("--write-overrides"),
    forceOverrides: args.includes("--force-overrides"),
    webSearch: !args.includes("--no-web-search"),
    limit,
    delayMs,
    outPath,
    groupNameFilter,
  };
}

function isValidFormedDate(v) {
  if (v == null) return false;
  const s = String(v).trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const y = Number(s.slice(0, 4));
  return y >= 1950 && y <= 2100;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** @returns {{ iso: string, precision: "day"|"month"|"year" } | null} */
function parseJaDateFragment(raw) {
  const s = String(raw ?? "")
    .replace(/\[\[|\]\]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
  const day = s.match(/(\d{4})年(\d{1,2})月(\d{1,2})日?/);
  if (day) {
    return {
      iso: `${day[1]}-${pad2(day[2])}-${pad2(day[3])}`,
      precision: "day",
    };
  }
  const month = s.match(/(\d{4})年(\d{1,2})月/);
  if (month) {
    return {
      iso: `${month[1]}-${pad2(month[2])}-01`,
      precision: "month",
    };
  }
  const year = s.match(/(\d{4})年/);
  if (year) {
    return { iso: `${year[1]}-01-01`, precision: "year" };
  }
  return null;
}

/** @returns {{ iso: string, precision: "day"|"month"|"year" } | null} */
function parseEnDateFragment(raw) {
  const s = String(raw ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const named = s.match(new RegExp(`(${EN_MONTHS})\\s+(\\d{1,2}),\\s+(\\d{4})`, "i"));
  if (named) {
    const mo = EN_MONTH_TO_NUM[named[1].toLowerCase()];
    if (mo) return { iso: `${named[3]}-${mo}-${pad2(named[2])}`, precision: "day" };
  }
  const iso = s.match(/\b(\d{4})-(\d{2})-(\d{2})\b/);
  if (iso) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}`, precision: "day" };
  return null;
}

function parseMonthDayInYear(month, day, year) {
  if (!year || !month || !day) return null;
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchJson(url, delayMs, retries = 5) {
  for (let attempt = 0; attempt < retries; attempt++) {
    await sleep(delayMs + attempt * 500);
    const res = await fetch(url, { headers: { "user-agent": UA } });
    const text = await res.text();
    if (res.status === 429 || text.startsWith("You are making too many requests")) {
      await sleep(delayMs * (attempt + 3));
      continue;
    }
    if (!text.trim().startsWith("{") && !text.trim().startsWith("[")) {
      throw new Error(`Non-JSON response (${res.status}): ${text.slice(0, 120)}`);
    }
    return JSON.parse(text);
  }
  throw new Error(`Rate limited after retries: ${url}`);
}

async function wikiSearch(query, delayMs) {
  const params = new URLSearchParams({
    action: "query",
    list: "search",
    srsearch: query,
    srlimit: "5",
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`${WIKI_API}?${params}`, delayMs);
  return data?.query?.search ?? [];
}

async function wikiWikitext(pageTitle, delayMs) {
  const params = new URLSearchParams({
    action: "parse",
    prop: "wikitext",
    page: pageTitle,
    format: "json",
    origin: "*",
  });
  const data = await fetchJson(`${WIKI_API}?${params}`, delayMs);
  return data?.parse?.wikitext?.["*"] ?? "";
}

function normTitle(s) {
  return String(s ?? "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[!！?？。]/g, "");
}

function scoreWikiHit(hit, groupName) {
  const title = String(hit?.title ?? "");
  const nTitle = normTitle(title);
  const nName = normTitle(groupName);
  if (!nTitle || !nName) return -999;
  let score = 0;
  if (nTitle === nName) score += 120;
  else if (nTitle.startsWith(nName) || nName.startsWith(nTitle)) score += 80;
  else if (nTitle.includes(nName) || nName.includes(nTitle)) score += 40;
  else score -= 40;
  if (/映画|ドラマ|アニメ|ゲーム|小説|単曲|アルバム|一覧/.test(title)) score -= 100;
  if (/\(バンド\)|\(アイドル\)|\(グループ\)/.test(title)) score += 10;
  return score;
}

function pickWikiHit(hits, groupName) {
  if (!hits.length) return null;
  const ranked = [...hits]
    .map((h) => ({ hit: h, score: scoreWikiHit(h, groupName) }))
    .sort((a, b) => b.score - a.score);
  if (ranked[0].score < 20) return null;
  return ranked[0].hit;
}

function isFormationNoise(line) {
  return /加入|脱退|参加|メンバー|ユニット|期間限定|コラボ|同名|再結成|復活|移籍|卒業|解散|リリース|デビュー/.test(line);
}

function lineMentionsGroup(line, groupName) {
  const n = normTitle(groupName);
  const nl = normTitle(line);
  if (!n || !nl) return false;
  if (nl.includes(n) || n.includes(nl)) return true;
  const core = n.replace(/project|official/g, "").slice(0, Math.min(4, n.length));
  return core.length >= 2 && nl.includes(core);
}

function yearAtPosition(wt, pos) {
  const before = wt.slice(Math.max(0, pos - 1200), pos);
  const years = [];
  for (const m of before.matchAll(/={2,4}\s*(\d{4})年\s*={2,4}/g)) years.push(Number(m[1]));
  for (const m of before.matchAll(/'''(\d{4})年'''/g)) years.push(Number(m[1]));
  for (const m of before.matchAll(/;(\d{4})年/g)) years.push(Number(m[1]));
  for (const m of before.matchAll(/!(\d{4})年/g)) years.push(Number(m[1]));
  for (const m of before.matchAll(/\n(\d{4})年\n/g)) years.push(Number(m[1]));
  return years.length ? years[years.length - 1] : null;
}

function parseStartDateTemplate(wt) {
  const m = wt.match(/\{\{Start date\|(\d{4})(?:\|(\d{1,2}))?(?:\|(\d{1,2}))?/);
  if (!m) return null;
  const y = m[1];
  const mo = m[2] ? pad2(m[2]) : "01";
  const d = m[3] ? pad2(m[3]) : "01";
  const precision = m[3] ? "day" : m[2] ? "month" : "year";
  return { iso: `${y}-${mo}-${d}`, precision };
}

/**
 * @returns {{ date: string, confidence: string, note: string } | null}
 */
function extractFromWikitext(wt, groupName) {
  const infoboxKeisei = wt.match(/\|\s*結成\s*=\s*([^\n|]+)/);
  if (infoboxKeisei) {
    const parsed = parseJaDateFragment(infoboxKeisei[1]);
    if (parsed) {
      const conf = parsed.precision === "day" ? "high" : parsed.precision === "month" ? "medium" : "low";
      return { date: parsed.iso, confidence: conf, note: `infobox 結成 (${parsed.precision})` };
    }
  }

  /** @type {{ iso: string, confidence: string, note: string, rank: number }[]} */
  const formationHits = [];
  const pushHit = (iso, confidence, note, rank) => {
    if (iso) formationHits.push({ iso, confidence, note, rank });
  };

  const bulletRe = /^[\*\-]\s*(\d{1,2})月(\d{1,2})日[^\n]*/gm;

  for (const hit of wt.matchAll(bulletRe)) {
    const line = hit[0];
    const year = yearAtPosition(wt, hit.index ?? 0);
    if (!year) continue;
    const iso = parseMonthDayInYear(Number(hit[1]), Number(hit[2]), year);
    if (!iso) continue;

    if (/結成を発表/.test(line)) {
      pushHit(iso, "high", `${year} history 結成を発表`, 85);
      continue;
    }

    if (/初(?:の)?劇場公演|初公演.*開始/.test(line) && lineMentionsGroup(line, groupName)) {
      pushHit(iso, "high", `${year} history 劇場デビュー`, 95);
      continue;
    }

    if (/(?:創設することを発表|プロジェクト発足|結成されることが発表)/.test(line)) {
      pushHit(iso, "medium", `${year} project announcement`, 40);
      continue;
    }

    if (/(?:始動|発足)/.test(line) && lineMentionsGroup(line, groupName)) {
      if (!/再始動|再結成|復活|ユニット|期間限定/.test(line)) {
        pushHit(iso, "medium", `${year} history 始動/発足`, 55);
      }
    }
  }

  const tableRe = /\|(\d{1,2})月(\d{1,2})日\|\|([^|\n]{0,120})/g;
  for (const hit of wt.matchAll(tableRe)) {
    const line = hit[0];
    const year = yearAtPosition(wt, hit.index ?? 0);
    if (!year) continue;
    const iso = parseMonthDayInYear(Number(hit[1]), Number(hit[2]), year);
    if (!iso) continue;
    if (/1st公演初日|1st公演/.test(line)) {
      pushHit(iso, "high", `${year} timeline 1st公演`, 92);
    }
  }

  const nameEsc = groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const fullAnnounceRe = new RegExp(
    `(\\d{4})年(\\d{1,2})月(\\d{1,2})日[^\\n]{0,100}(?:${nameEsc})?[^\\n]{0,60}結成を発表`,
    "g",
  );
  for (const hit of wt.matchAll(fullAnnounceRe)) {
    const line = hit[0];
    if (isFormationNoise(line) && !/結成を発表/.test(line)) continue;
    const iso = parseMonthDayInYear(Number(hit[2]), Number(hit[3]), Number(hit[1]));
    if (iso) formationHits.push({ iso, confidence: "high", note: "inline 結成を発表", rank: 85 });
  }

  if (formationHits.length) {
    formationHits.sort((a, b) => b.rank - a.rank || a.iso.localeCompare(b.iso));
    const best = formationHits[0];
    return { date: best.iso, confidence: best.confidence, note: best.note };
  }

  const startTpl = parseStartDateTemplate(wt);
  if (startTpl && /第1期|1期|初代|オリジナルメンバー/.test(wt.slice(0, 8000))) {
    const conf = startTpl.precision === "day" ? "medium" : "low";
    return { date: startTpl.iso, confidence: conf, note: `Start date template (${startTpl.precision})` };
  }

  const leadKeisei = wt.match(/(\d{4})年(?:\d{1,2}月(?:\d{1,2})日)?[^\n]{0,24}結成/);
  if (leadKeisei) {
    const parsed = parseJaDateFragment(leadKeisei[0]);
    if (parsed) {
      const conf = parsed.precision === "day" ? "medium" : "low";
      return { date: parsed.iso, confidence: conf, note: `lead 結成 (${parsed.precision})` };
    }
  }

  const infoboxDebut = wt.match(/\|\s*デビュー\s*=\s*([^\n|]+)/);
  if (infoboxDebut) {
    const parsed = parseJaDateFragment(infoboxDebut[1]);
    if (parsed) {
      const conf = parsed.precision === "day" ? "medium" : "low";
      return { date: parsed.iso, confidence: conf, note: `infobox デビュー (${parsed.precision})` };
    }
  }

  return null;
}

async function jpopFandomLookup(groupName, delayMs) {
  const slug = encodeURIComponent(groupName.replace(/\s+/g, "_"));
  const url = `https://jpop.fandom.com/wiki/${slug}`;
  await sleep(delayMs);
  const res = await fetch(url, {
    headers: { "user-agent": UA },
    redirect: "follow",
  });
  if (!res.ok) return null;
  const html = await res.text();
  if (/doesn't exist|存在しない|Page not found/i.test(html)) return null;

  const portable = html.match(/data-source="(?:formation|debut)"[^>]*>[\s\S]*?<div[^>]*>([^<]+)</i);
  if (portable) {
    const parsed = parseJaDateFragment(portable[1]) ?? parseJaDateFragment(portable[1].replace(/-/g, "/"));
    if (parsed) {
      const conf = parsed.precision === "day" ? "medium" : "low";
      return { date: parsed.iso, confidence: conf, note: `jpop.fandom ${parsed.precision}`, source: url };
    }
  }

  const formationRow = html.match(/Formation[^<]*<\/th>\s*<td[^>]*>([\s\S]*?)<\/td>/i);
  if (formationRow) {
    const text = formationRow[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    const parsed = parseJaDateFragment(text);
    if (parsed) {
      const conf = parsed.precision === "day" ? "medium" : "low";
      return { date: parsed.iso, confidence: conf, note: `jpop.fandom formation row (${parsed.precision})`, source: url };
    }
  }

  return null;
}

function stripHtml(html) {
  return String(html ?? "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#x27;|&amp;|&quot;|&lt;|&gt;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function duckDuckGoSearch(query, delayMs) {
  await sleep(delayMs);
  const res = await fetch(`${DDG_HTML}?q=${encodeURIComponent(query)}`, {
    headers: { "user-agent": UA },
  });
  if (!res.ok) return [];
  const html = await res.text();
  const chunks = [];
  for (const m of html.matchAll(/class="result__a"[^>]*>([\s\S]*?)<\/a>/g)) {
    chunks.push(stripHtml(m[1]));
  }
  for (const m of html.matchAll(/class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g)) {
    chunks.push(stripHtml(m[1]));
  }
  return chunks.filter(Boolean);
}

/**
 * @returns {{ date: string, confidence: string, note: string, score: number } | null}
 */
function extractDatesFromText(text, groupName) {
  const t = stripHtml(text);
  if (!t || !lineMentionsGroup(t, groupName)) return null;

  if (/周年|anniversary/i.test(t) && !/2008年10月5日|2008-10-05/.test(t)) return null;

  /** @type {{ iso: string, confidence: string, note: string, score: number }[]} */
  const hits = [];

  const push = (parsed, confidence, note, score) => {
    if (!parsed?.iso) return;
    hits.push({ date: parsed.iso, confidence, note, score });
  };

  for (const m of t.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日[^。]{0,80}(?:結成を発表|結成されることが発表|結成)/g)) {
    const iso = parseMonthDayInYear(Number(m[2]), Number(m[3]), Number(m[1]));
    if (iso) push({ iso, precision: "day" }, "high", "web 結成を発表", 90);
  }

  for (const m of t.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日[^。]{0,80}(?:創設することを発表|結成されることが発表|プロジェクト発足)/g)) {
    const iso = parseMonthDayInYear(Number(m[2]), Number(m[3]), Number(m[1]));
    if (iso) push({ iso, precision: "day" }, "medium", "web project announcement", 40);
  }

  for (const m of t.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日[^。]{0,100}(?:初(?:の)?劇場公演|1st公演|劇場デビュー|theater debut|debuted)/gi)) {
    const iso = parseMonthDayInYear(Number(m[2]), Number(m[3]), Number(m[1]));
    if (iso) push({ iso, precision: "day" }, "high", "web 劇場デビュー", 95);
  }

  for (const m of t.matchAll(/(\d{4})年(\d{1,2})月(\d{1,2})日[^。]{0,80}(?:デビュー|お披露目|始動|発足)/g)) {
    const iso = parseMonthDayInYear(Number(m[2]), Number(m[3]), Number(m[1]));
    if (iso) push({ iso, precision: "day" }, "medium", "web デビュー/始動", 70);
  }

  const enRe = new RegExp(
    `(?:debuted on|debuting on|formed on|debut)\\s+(?:on\\s+)?(${EN_MONTHS})\\s+(\\d{1,2}),\\s+(\\d{4})`,
    "i",
  );
  const en = t.match(enRe);
  if (en) {
    const parsed = parseEnDateFragment(en[0]);
    if (parsed) push(parsed, "medium", "web EN debut", 75);
  }

  const ja = parseJaDateFragment(t);
  if (ja && /結成|デビュー|劇場|始動|発足|debut|formed/i.test(t)) {
    const conf = ja.precision === "day" ? "medium" : "low";
    const score = ja.precision === "day" ? 55 : ja.precision === "month" ? 35 : 15;
    push(ja, conf, `web date near keyword (${ja.precision})`, score);
  }

  if (!hits.length) return null;
  hits.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  return hits[0];
}

async function webSearchLookup(groupName, delayMs) {
  const queries = [
    `${groupName} 結成 デビュー`,
    `${groupName} 劇場公演 初`,
    `${groupName} debut formed`,
  ];
  /** @type {{ date: string, confidence: string, note: string, score: number, source: string }[]} */
  const all = [];

  for (const q of queries) {
    const snippets = await duckDuckGoSearch(q, delayMs);
    for (const snippet of snippets.slice(0, 8)) {
      const hit = extractDatesFromText(snippet, groupName);
      if (hit) {
        all.push({ ...hit, source: `duckduckgo:${q}` });
      }
    }
  }

  if (!all.length) return null;
  all.sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
  const best = all[0];
  const agree = all.filter((h) => h.date === best.date).length;
  const confidence =
    best.score >= 90 && agree >= 1
      ? "high"
      : best.score >= 70
        ? "medium"
        : best.confidence;
  return {
    date: best.date,
    confidence,
    source: "https://duckduckgo.com/",
    notes: `${best.note}${agree > 1 ? ` (${agree} snippets agree)` : ""}`,
    score: best.score + (agree > 1 ? 10 : 0),
  };
}

function candidateScore(result) {
  if (!result?.date) return -1;
  let s = 0;
  if (result.confidence === "high") s += 100;
  else if (result.confidence === "medium") s += 60;
  else if (result.confidence === "low") s += 20;
  if (/^\d{4}-\d{2}-\d{2}$/.test(result.date) && !result.date.endsWith("-01-01")) s += 30;
  else if (/^\d{4}-\d{2}-01$/.test(result.date)) s += 10;
  if (/劇場デビュー|劇場公演|結成を発表/.test(result.notes ?? "")) s += 25;
  if (/始動\/発足|announcement|発表/.test(result.notes ?? "")) s -= 15;
  if (result.score != null) s += Math.min(result.score, 50);
  if (result.sourceKind === "web") s += 5;
  return s;
}

function pickBestResult(candidates) {
  const valid = candidates.filter((c) => c?.date);
  if (!valid.length) return candidates.find((c) => c) ?? null;
  valid.sort((a, b) => candidateScore(b) - candidateScore(a));
  return valid[0];
}

function escCsv(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function loadScenario6Uids() {
  const rows = JSON.parse(fs.readFileSync(scenario6Path, "utf8"));
  return new Set(rows.map((g) => String(g.uid ?? "")).filter(Boolean));
}

function overrideExists(uid) {
  return fs.existsSync(path.join(overridesDir, `${uid}.json`));
}

async function lookupGroup(group, delayMs, useWebSearch) {
  const queries = [group.name, `${group.name} アイドル`].filter(Boolean);
  let wikiTitle = "";
  let wikiResult = null;

  for (const q of queries) {
    const hits = await wikiSearch(q, delayMs);
    const hit = pickWikiHit(hits, group.name);
    if (!hit) continue;
    wikiTitle = hit.title;
    const wt = await wikiWikitext(hit.title, delayMs);
    if (!wt) continue;
    wikiResult = extractFromWikitext(wt, group.name);
    if (wikiResult) break;
  }

  /** @type {Array<{ date: string, confidence: string, source: string, wiki_title: string, notes: string, sourceKind?: string, score?: number }>} */
  const candidates = [];

  if (wikiResult) {
    candidates.push({
      date: wikiResult.date,
      confidence: wikiResult.confidence,
      source: `https://ja.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}`,
      wiki_title: wikiTitle,
      notes: wikiResult.note,
      sourceKind: "wiki",
    });
  }

  const jpop = await jpopFandomLookup(group.name, delayMs);
  if (jpop) {
    candidates.push({
      date: jpop.date,
      confidence: jpop.confidence,
      source: jpop.source,
      wiki_title: wikiTitle || "",
      notes: jpop.note,
      sourceKind: "jpop",
    });
  }

  if (useWebSearch && (!wikiResult || wikiResult.confidence !== "high")) {
    const web = await webSearchLookup(group.name, delayMs);
    if (web) {
      candidates.push({
        date: web.date,
        confidence: web.confidence,
        source: web.source,
        wiki_title: wikiTitle || "",
        notes: web.notes,
        sourceKind: "web",
        score: web.score,
      });
    }
  }

  const best = pickBestResult(candidates);
  if (best) {
    return {
      date: best.date,
      confidence: best.confidence,
      source: best.source,
      wiki_title: best.wiki_title,
      notes: best.notes,
    };
  }

  return {
    date: "",
    confidence: "none",
    source: wikiTitle ? `https://ja.wikipedia.org/wiki/${encodeURIComponent(wikiTitle)}` : "",
    wiki_title: wikiTitle,
    notes: wikiTitle ? "wiki page found, no 結成 date parsed" : "no wiki hit",
  };
}

async function main() {
  const opts = parseArgs();
  const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  let missing = groups.filter((g) => !isValidFormedDate(g.formed_date));

  if (opts.scenario6) {
    const s6 = loadScenario6Uids();
    missing = missing.filter((g) => s6.has(g.uid));
  }

  if (opts.groupNameFilter) {
    const f = normTitle(opts.groupNameFilter);
    missing = missing.filter((g) => normTitle(g.name) === f || normTitle(g.name).includes(f));
  }

  if (opts.limit < missing.length) missing = missing.slice(0, opts.limit);

  console.error(
    `[suggest-formed-dates] ${missing.length} group(s), delay ${opts.delayMs}ms, scenario6=${opts.scenario6}, web=${opts.webSearch}`,
  );

  const lines = [
    "group_uid,group_name,name_romanji,suggested_date,confidence,source,wiki_title,notes",
  ];
  let written = 0;
  let high = 0;

  for (let i = 0; i < missing.length; i++) {
    const g = missing[i];
    process.stderr.write(`[${i + 1}/${missing.length}] ${g.name}… `);
    try {
      const result = await lookupGroup(g, opts.delayMs, opts.webSearch);
      lines.push(
        [
          g.uid,
          escCsv(g.name),
          escCsv(g.name_romanji ?? ""),
          result.date,
          result.confidence,
          escCsv(result.source),
          escCsv(result.wiki_title),
          escCsv(result.notes),
        ].join(","),
      );
      console.error(result.date ? `${result.date} (${result.confidence})` : "—");

      if (
        opts.writeOverrides &&
        result.confidence === "high" &&
        result.date &&
        (opts.forceOverrides || !overrideExists(g.uid))
      ) {
        fs.mkdirSync(overridesDir, { recursive: true });
        const payload = {
          _meta: {
            group_name: g.name,
            sources: result.source ? [result.source] : [],
            suggested_by: "scripts/suggestGroupFormedDates.mjs",
            notes: result.notes,
          },
          formed_date: result.date,
        };
        fs.writeFileSync(
          path.join(overridesDir, `${g.uid}.json`),
          `${JSON.stringify(payload, null, 2)}\n`,
          "utf8",
        );
        written += 1;
      }
      if (result.confidence === "high") high += 1;
    } catch (err) {
      console.error(`ERR: ${err.message}`);
      lines.push(
        [
          g.uid,
          escCsv(g.name),
          escCsv(g.name_romanji ?? ""),
          "",
          "error",
          "",
          "",
          escCsv(String(err.message)),
        ].join(","),
      );
    }
  }

  fs.mkdirSync(path.dirname(opts.outPath), { recursive: true });
  fs.writeFileSync(opts.outPath, `${lines.join("\n")}\n`, "utf8");
  console.error(`Wrote ${opts.outPath}`);
  console.error(
    JSON.stringify({ total: missing.length, high_confidence: high, overrides_written: written }, null, 2),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
