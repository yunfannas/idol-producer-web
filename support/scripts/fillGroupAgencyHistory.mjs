#!/usr/bin/env node
/**
 * Fill missing group agencies and build agency_history with start/end dates.
 *
 * Schema:
 *   agencies: string[]              // current agencies (end_date null), or last known if group ended
 *   agency_history: Array<{
 *     agency: string,
 *     start_date: string|null,      // ISO yyyy-mm-dd
 *     end_date: string|null,        // null = current
 *     source?: string
 *   }>
 *
 * Sources (priority):
 *   1. Existing agencies[] → seed history if missing
 *   2. Parse "Agency …" from group.description
 *   3. HEROINES union → imaginate
 *   4. Optional: --wiki MediaWiki API (jpop.fandom) |agency= / dated segments
 *   5. Optional: --wiki-ja ja.wikipedia 事務所 (dated Plainlist bullets)
 *
 * Usage:
 *   node support/scripts/fillGroupAgencyHistory.mjs
 *   node support/scripts/fillGroupAgencyHistory.mjs --wiki
 *   node support/scripts/fillGroupAgencyHistory.mjs --wiki-ja
 *   node support/scripts/fillGroupAgencyHistory.mjs --wiki --wiki-ja --dry-run
 *   node support/scripts/fillGroupAgencyHistory.mjs --wiki-ja --only=scenario_6
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import https from "node:https";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const dryRun = process.argv.includes("--dry-run");
const useWiki = process.argv.includes("--wiki");
const useWikiJa = process.argv.includes("--wiki-ja");
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyLabel = onlyArg ? onlyArg.slice("--only=".length) : null;

const targets = [
  {
    label: "scenario_6",
    groupsPath: path.join(root, "public/data/scenarios/scenario_6/groups.json"),
  },
  {
    label: "main",
    groupsPath: path.join(root, "public/data/groups.json"),
  },
].filter((t) => !onlyLabel || t.label === onlyLabel);

const union = JSON.parse(fs.readFileSync(path.join(root, "public/data/group_union.json"), "utf8"));
const heroUids = new Set((union.HEROINES && union.HEROINES.group_uids) || []);

const overridesPath = path.join(root, "public/data/reference/group_agency_overrides.json");
const overridesDoc = fs.existsSync(overridesPath)
  ? JSON.parse(fs.readFileSync(overridesPath, "utf8"))
  : { by_name: {} };
const overridesByName = overridesDoc.by_name || {};

function isoDay(v) {
  if (typeof v !== "string" || !v) return null;
  const m = v.match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
}

function yearStart(y) {
  const n = Number(y);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
  return `${n}-01-01`;
}

function yearEnd(y) {
  const n = Number(y);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
  return `${n}-12-31`;
}

function cleanAgencyName(raw) {
  if (!raw) return "";
  let s = String(raw)
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  s = s.replace(
    /\s+(Associated Acts|Current Members|Former Members|Final Line-?Up|Producer|Label|Links|Years|Origin|Genre|Also Known|Native title|English|Released|Members|Debut|Website|Social Media)\b.*$/i,
    "",
  );
  s = s.replace(/\s*[|｜].*$/, "").trim();
  s = s.replace(/^\[\[|\]\]$/g, "").trim();
  // drop pipe display text leftovers: "w:c:foo:LDH|LDH" → last segment
  if (s.includes("|")) {
    const parts = s.split("|");
    s = parts[parts.length - 1].trim();
  }
  if (!s || /^(unknown|n\/?a|none|-|—|–)$/i.test(s)) return "";
  return s;
}

/** Extract current Agency from idolsdiagram / fandom-style description blobs. */
function parseAgencyFromDescription(desc) {
  const d = String(desc || "");
  if (!d) return null;
  const idx = d.search(/\bAgency\b/i);
  if (idx < 0) return null;
  let rest = d.slice(idx + "Agency".length).trim();
  const cut = rest.search(
    /\s(?:Associated Acts|Current Members|Former Members|Final Line-?Up|Producer|Label|Links|Years|Origin|Genre|Also Known|Native title|English Translation|Released|Members|Debut|Website|Social Media)\b/i,
  );
  if (cut >= 0) rest = rest.slice(0, cut);
  return cleanAgencyName(rest);
}

function listAgencies(g) {
  if (!Array.isArray(g.agencies)) return [];
  return g.agencies.map((x) => cleanAgencyName(x)).filter(Boolean);
}

function normalizeHistory(rows) {
  const out = [];
  const seen = new Set();
  for (const row of rows || []) {
    const agency = cleanAgencyName(row.agency);
    if (!agency) continue;
    const start = isoDay(row.start_date) || null;
    const end = isoDay(row.end_date) || null;
    const key = `${agency.toLowerCase()}|${start || ""}|${end || ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      agency,
      start_date: start,
      end_date: end,
      ...(row.source ? { source: String(row.source) } : {}),
    });
  }
  out.sort((a, b) => {
    const ae = a.end_date ? 1 : 0;
    const be = b.end_date ? 1 : 0;
    if (ae !== be) return ae - be;
    return String(b.start_date || "").localeCompare(String(a.start_date || ""));
  });
  return out;
}

function currentFromHistory(history) {
  const cur = history.filter((h) => !h.end_date).map((h) => h.agency);
  if (cur.length) return [...new Set(cur)];
  if (!history.length) return [];
  const last = [...history].sort((a, b) => String(b.end_date || "").localeCompare(String(a.end_date || "")))[0];
  return last ? [last.agency] : [];
}

function fetchText(url) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: {
          "User-Agent": "idol-producer-web-agency-fill/1.0 (local research; agency backfill)",
          Accept: "application/json,text/plain,*/*",
        },
        timeout: 30000,
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const next = new URL(res.headers.location, url).toString();
          res.resume();
          fetchText(next).then(resolve, reject);
          return;
        }
        if (res.statusCode !== 200) {
          res.resume();
          reject(new Error(`HTTP ${res.statusCode} ${url}`));
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

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function fetchTextWithRetry(url, { retries = 5, baseSleep = 1500 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const body = await fetchText(url);
      if (/^You are making too many requests/i.test(body) || /rate limit/i.test(body.slice(0, 200))) {
        lastErr = new Error("rate limited");
        await sleep(baseSleep * (attempt + 1) * 2);
        continue;
      }
      return body;
    } catch (e) {
      lastErr = e;
      await sleep(baseSleep * (attempt + 1));
    }
  }
  throw lastErr || new Error("fetch failed");
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

/** Strip wiki markup enough to read agency names. */
function stripWikiMarkup(raw) {
  let s = String(raw || "");
  s = s.replace(/\{\{[^{}]*\}\}/g, " "); // simple templates
  s = s.replace(/<\/?br\s*\/?>/gi, "\n");
  s = s.replace(/<\/?small>/gi, "");
  s = s.replace(/<\/?[^>]+>/g, "");
  // [[Link|Display]] or [[Link]]
  s = s.replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, "$2");
  s = s.replace(/\[\[([^\]]+)\]\]/g, "$1");
  // external [url text]
  s = s.replace(/\[https?:\/\/[^\s\]]+\s+([^\]]+)\]/gi, "$1");
  s = s.replace(/\[https?:\/\/[^\s\]]+\]/gi, "");
  s = s.replace(/'{2,}/g, "");
  s = s.replace(/&nbsp;/g, " ");
  s = s.replace(/&amp;/g, "&");
  return s;
}

/**
 * Parse one agency segment like:
 *   "Fujiga Office (2009-present)"
 *   "LDH (2007-2008)"
 *   "KAWAII LAB."
 */
function parseDatedAgencySegment(segment, formedDate, source) {
  const cleaned = stripWikiMarkup(segment).replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const m = cleaned.match(
    /^(.+?)\s*\(\s*(\d{4})(?:\s*[-–—〜~]\s*(\d{4}|present|Present|now|Now|現在))?\s*\)\s*$/,
  );
  if (m) {
    const agency = cleanAgencyName(m[1]);
    if (!agency) return [];
    const start = yearStart(m[2]);
    const endRaw = m[3];
    const end =
      !endRaw || /present|now|現在/i.test(endRaw) ? null : yearEnd(endRaw);
    return [{ agency, start_date: start, end_date: end, source }];
  }
  // Parenthetical company without dates: "KAWAII LAB. (ASOBISYSTEM)" → two currents
  const nested = cleaned.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (nested) {
    const primary = cleanAgencyName(nested[1]);
    const secondary = cleanAgencyName(nested[2]);
    // If secondary looks like years only, already handled above
    if (primary && secondary && !/^\d{4}/.test(secondary)) {
      return [
        { agency: primary, start_date: formedDate, end_date: null, source },
        { agency: secondary, start_date: formedDate, end_date: null, source },
      ];
    }
  }
  const agency = cleanAgencyName(cleaned);
  if (!agency) return [];
  return [{ agency, start_date: formedDate, end_date: null, source }];
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
      const ch = wikitext[i];
      const next = wikitext.slice(i, i + 2);
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
      // next parameter at top level
      if (depth === 0 && ch === "\n" && wikitext[i + 1] === "|") break;
      // end of template
      if (depth === 0 && next === "}}") break;
      out += ch;
      i += 1;
    }
    const val = out.trim();
    if (!val || /^\|/.test(val)) continue;
    return val;
  }
  return null;
}

function parseWikiAgencyHistoryFromWikitext(wikitext, formedDate) {
  if (!wikitext) return [];
  const rows = [];
  const agencyRaw = extractInfoboxField(wikitext, ["agency", "Agency"]);
  const formerRaw = extractInfoboxField(wikitext, [
    "former_agency",
    "former agency",
    "formerAgency",
    "Former Agency",
  ]);

  if (agencyRaw) {
    const chunks = agencyRaw
      .split(/<br\s*\/?>|\n|;/i)
      .map((x) => x.trim())
      .filter(Boolean);
    // also split plain commas only when no date parens spanning? keep simple: br/newline first
    for (const chunk of chunks.length ? chunks : [agencyRaw]) {
      // further split "A (y-y), B (y-y)" if comma-separated dated list
      const sub =
        /\(\s*\d{4}/.test(chunk) && chunk.includes(",")
          ? chunk.split(/\s*,\s*(?=[^,]+\(\s*\d{4})/)
          : [chunk];
      for (const part of sub) {
        rows.push(...parseDatedAgencySegment(part, formedDate, "jpop_fandom_agency"));
      }
    }
  }

  if (formerRaw) {
    const chunks = formerRaw
      .split(/<br\s*\/?>|\n|;|,/i)
      .map((x) => x.trim())
      .filter(Boolean);
    for (const chunk of chunks) {
      const parsed = parseDatedAgencySegment(chunk, null, "jpop_fandom_former_agency");
      for (const row of parsed) {
        // former without end → mark ended at formed of current if known
        if (!row.end_date) {
          row.end_date = formedDate;
        }
        rows.push(row);
      }
    }
  }

  // If we have both dated former segments and undated current, leave as-is.
  // If all rows have end dates (fully historical listing in agency=), keep last as "current at end".
  return normalizeHistory(rows);
}

async function wikiApiSearchTitle(title) {
  const q = new URL("https://jpop.fandom.com/api.php");
  q.searchParams.set("action", "opensearch");
  q.searchParams.set("search", title);
  q.searchParams.set("limit", "1");
  q.searchParams.set("namespace", "0");
  q.searchParams.set("format", "json");
  const body = await fetchText(q.toString());
  try {
    const data = JSON.parse(body);
    const titles = data[1];
    if (Array.isArray(titles) && titles[0]) return titles[0];
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchWikitextByTitles(titles) {
  const unique = [...new Set(titles.filter(Boolean))];
  const map = new Map();
  const chunkSize = 40;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const batch = unique.slice(i, i + chunkSize);
    const q = new URL("https://jpop.fandom.com/api.php");
    q.searchParams.set("action", "query");
    q.searchParams.set("prop", "revisions");
    q.searchParams.set("rvprop", "content");
    q.searchParams.set("rvslots", "main");
    q.searchParams.set("format", "json");
    q.searchParams.set("redirects", "1");
    q.searchParams.set("titles", batch.join("|"));
    try {
      const body = await fetchText(q.toString());
      const data = JSON.parse(body);
      const redirects = new Map(
        (data.query?.redirects || []).map((r) => [r.from, r.to]),
      );
      const normalized = new Map(
        (data.query?.normalized || []).map((n) => [n.from, n.to]),
      );
      const pages = Object.values(data.query?.pages || {});
      const byTitle = new Map();
      for (const page of pages) {
        if (page.missing != null) continue;
        const wt = page.revisions?.[0]?.slots?.main?.["*"];
        if (wt) byTitle.set(page.title, wt);
      }
      for (const requested of batch) {
        let t = requested;
        if (normalized.has(t)) t = normalized.get(t);
        if (redirects.has(t)) t = redirects.get(t);
        if (byTitle.has(t)) map.set(requested, byTitle.get(t));
        else if (byTitle.has(requested)) map.set(requested, byTitle.get(requested));
      }
    } catch (e) {
      console.error("wiki batch error", e.message || e);
    }
    await sleep(200);
  }
  return map;
}

/** Parse JP date range: 2011年 - 2013年 / 2012年 - / 2013年 - 現在 */
function parseJapaneseYearRange(text) {
  const t = String(text || "").replace(/\s+/g, "");
  const m = t.match(/(\d{4})年(?:\s*[-–—〜~－]\s*(\d{4})年|\s*[-–—〜~－]\s*(現在|今)?|\s*[-–—〜~－])?/);
  if (!m) return { start: null, end: null, matched: false };
  const start = yearStart(m[1]);
  let end = null;
  if (m[2] && /^\d{4}$/.test(m[2])) end = yearEnd(m[2]);
  else if (m[3] || /現在|今/.test(t) || /年\s*[-–—〜~－]\s*$/.test(String(text || ""))) end = null;
  else if (/まで/.test(t) && m[1]) {
    // "2022年まで" alone → end that year, start unknown
    end = yearEnd(m[1]);
  }
  return { start, end, matched: true };
}

function cleanJaAgencyName(raw) {
  let s = stripWikiMarkup(raw);
  s = s.replace(/<ref[\s\S]*?(?:<\/ref>|\/?>)/gi, "");
  s = s.replace(/\(\s*\d{4}年[\s\S]*$/, ""); // drop trailing date paren if left
  s = s.replace(/（\s*\d{4}年[\s\S]*$/, "");
  s = s.replace(/^\*+\s*/, "").trim();
  // drop anchor links like #乃木坂46合同会社|乃木坂46合同会社 → already handled by strip
  s = cleanAgencyName(s);
  // ignore pure labels / empty
  if (!s || s.length > 80) return "";
  if (/^(レーベル|所属|事務所)$/.test(s)) return "";
  return s;
}

/**
 * Parse ja.wikipedia 事務所 / 所属事務所 field (often {{Plainlist|* [[A]]（2011年 - 2013年）}}).
 */
function parseJaWikiOfficeHistory(wikitext, formedDate) {
  if (!wikitext) return [];
  const field =
    extractInfoboxField(wikitext, ["事務所", "所属事務所", "所属"]) ||
    null;
  if (!field) return [];

  // Expand plainlist / bulleted lines; drop refs/comments that embed pipes
  let body = field;
  body = body.replace(/<!--[\s\S]*?-->/g, "");
  body = body.replace(/<ref[^>]*\/>/gi, "");
  body = body.replace(/<ref\b[^>]*>[\s\S]*?<\/ref>/gi, "");
  body = body.replace(/\{\{Plainlist\|/i, "");
  body = body.replace(/\}\}\s*$/g, "");
  const lines = body
    .split(/\n|\*/)
    .map((x) => x.trim())
    .filter((x) => x && !/^\{/.test(x) && x !== "|" && !/^Cite/i.test(x));

  const rows = [];
  const candidates = lines.length ? lines : [body];
  for (const line of candidates) {
    const stripped = stripWikiMarkup(line)
      .replace(/\{\{[^}]*\}\}/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!stripped) continue;
    // Name（2011年 - 2013年） or Name (2011年-2013年)
    const dm = stripped.match(
      /^(.+?)\s*[（(]\s*(\d{4})年\s*[-–—〜~－]?\s*(\d{4})?年?\s*(?:[-–—〜~－]\s*)?(現在|今)?.*?[）)]/,
    );
    if (dm) {
      const agency = cleanJaAgencyName(dm[1]);
      if (!agency) continue;
      const start = yearStart(dm[2]);
      const end = dm[4] || !dm[3] ? null : yearEnd(dm[3]);
      const openEnded = !dm[3] && !dm[4];
      rows.push({
        agency,
        start_date: start || formedDate,
        end_date: openEnded ? null : end,
        source: "ja_wikipedia_office",
      });
      continue;
    }
    const agency = cleanJaAgencyName(stripped);
    if (!agency) continue;
    if (/^Cite|引用|アクセス|archive/i.test(agency)) continue;
    // Split chained offices: A→B→C
    if (/[→⟶➡]/.test(agency)) {
      const parts = agency.split(/\s*[→⟶➡]\s*/).map((x) => cleanJaAgencyName(x)).filter(Boolean);
      for (let pi = 0; pi < parts.length; pi++) {
        rows.push({
          agency: parts[pi],
          start_date: formedDate,
          end_date: pi === parts.length - 1 ? null : formedDate,
          source: "ja_wikipedia_office",
        });
      }
      continue;
    }
    rows.push({
      agency,
      start_date: formedDate,
      end_date: null,
      source: "ja_wikipedia_office",
    });
  }
  return normalizeHistory(rows);
}

async function wikiApiSearchTitleOn(apiBase, title) {
  const q = new URL(apiBase);
  q.searchParams.set("action", "opensearch");
  q.searchParams.set("search", title);
  q.searchParams.set("limit", "1");
  q.searchParams.set("namespace", "0");
  q.searchParams.set("format", "json");
  const body = await fetchTextWithRetry(q.toString());
  try {
    const data = JSON.parse(body);
    const titles = data[1];
    if (Array.isArray(titles) && titles[0]) return titles[0];
  } catch {
    /* ignore */
  }
  return null;
}

async function fetchWikitextSingle(apiBase, title) {
  const q = new URL(apiBase);
  q.searchParams.set("action", "query");
  q.searchParams.set("prop", "revisions");
  q.searchParams.set("rvprop", "content");
  q.searchParams.set("rvslots", "main");
  q.searchParams.set("format", "json");
  q.searchParams.set("redirects", "1");
  q.searchParams.set("titles", title);
  const body = await fetchTextWithRetry(q.toString());
  const data = JSON.parse(body);
  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing != null) return null;
  return page.revisions?.[0]?.slots?.main?.["*"] || null;
}

function applyEndedGroup(history, agencies, ended) {
  if (!ended) return { history, agencies };
  let h = history.map((row) => (!row.end_date ? { ...row, end_date: ended } : row));
  h = normalizeHistory(h);
  let ag = currentFromHistory(h);
  if (!ag.length && h.length) {
    const last = [...h].sort((a, b) =>
      String(b.end_date || "").localeCompare(String(a.end_date || "")),
    )[0];
    ag = [last.agency];
  }
  return { history: h, agencies: ag };
}

async function processFile(target) {
  const groups = JSON.parse(fs.readFileSync(target.groupsPath, "utf8"));
  const stats = {
    label: target.label,
    total: groups.length,
    seeded_from_existing: 0,
    filled_from_description: 0,
    filled_from_heroines_union: 0,
    filled_from_wiki: 0,
    filled_from_wiki_ja: 0,
    filled_from_override: 0,
    history_built: 0,
    still_missing: 0,
    wiki_errors: 0,
    wiki_searched: 0,
    wiki_ja_searched: 0,
  };
  const stillMissing = [];

  for (const g of groups) {
    let history = normalizeHistory(Array.isArray(g.agency_history) ? g.agency_history : []);
    let agencies = listAgencies(g);
    const formed = isoDay(g.formed_date);
    const ended = isoDay(g.ended_date || g.disband_date);

    // 1) existing agencies → ensure history
    if (agencies.length && !history.length) {
      history = agencies.map((agency) => ({
        agency,
        start_date: formed,
        end_date: ended,
        source: "existing_agencies",
      }));
      stats.seeded_from_existing += 1;
    }

    // 2) description parse if still no current
    if (!agencies.length && !history.some((h) => !h.end_date) && !history.length) {
      const fromDesc = parseAgencyFromDescription(g.description);
      if (fromDesc) {
        history.push({
          agency: fromDesc,
          start_date: formed,
          end_date: ended,
          source: "description",
        });
        stats.filled_from_description += 1;
      }
    }

    // 3) HEROINES union default
    if (
      !history.length &&
      (heroUids.has(String(g.uid)) || String(g.union || "") === "HEROINES")
    ) {
      history.push({
        agency: "imaginate",
        start_date: formed,
        end_date: ended,
        source: "heroines_union_default",
      });
      stats.filled_from_heroines_union += 1;
    }

    history = normalizeHistory(history);
    agencies = agencies.length ? agencies : currentFromHistory(history);
    ({ history, agencies } = applyEndedGroup(history, agencies, ended));

    if (history.length) stats.history_built += 1;

    if (!agencies.length) {
      stats.still_missing += 1;
      stillMissing.push(g);
    }

    g.agencies = agencies.length ? agencies : Array.isArray(g.agencies) ? g.agencies : [];
    if (history.length) g.agency_history = history;
  }

  // 4) wiki pass for still missing
  if (useWiki && stillMissing.length) {
    // Prefer JP name search (wiki_url is often wrong/solo pages), fall back to URL title
    const titleByUid = new Map();
    for (const g of stillMissing) {
      try {
        const searched = await wikiApiSearchTitle(String(g.name || ""));
        stats.wiki_searched += 1;
        if (searched) titleByUid.set(g.uid, searched);
      } catch {
        stats.wiki_errors += 1;
      }
      if (!titleByUid.has(g.uid)) {
        const fromUrl = titleFromWikiUrl(g.wiki_url);
        if (fromUrl) titleByUid.set(g.uid, fromUrl);
      }
      await sleep(120);
    }

    const titles = [...new Set([...titleByUid.values()])];
    console.error(`[${target.label}] fetching wikitext for ${titles.length} titles…`);
    const wtMap = await fetchWikitextByTitles(titles);

    const remaining = [];
    for (const g of stillMissing) {
      const formed = isoDay(g.formed_date);
      const ended = isoDay(g.ended_date || g.disband_date);
      const title = titleByUid.get(g.uid);
      const wt = title ? wtMap.get(title) : null;

      if (!wt) {
        remaining.push(g);
        continue;
      }

      const rows = parseWikiAgencyHistoryFromWikitext(wt, formed);
      if (!rows.length) {
        remaining.push(g);
        continue;
      }

      let history = normalizeHistory([...(Array.isArray(g.agency_history) ? g.agency_history : []), ...rows]);
      let agencies = currentFromHistory(history);
      ({ history, agencies } = applyEndedGroup(history, agencies, ended));
      if (!agencies.length && history.length) {
        agencies = [history[0].agency];
      }

      g.agencies = agencies;
      g.agency_history = history;
      stats.filled_from_wiki += 1;
    }

    stillMissing.length = 0;
    stillMissing.push(
      ...groups.filter((g) => !(Array.isArray(g.agencies) && g.agencies.some(Boolean))),
    );
    stats.still_missing = stillMissing.length;
  }

  // 5) Japanese Wikipedia 事務所 pass for remaining
  if (useWikiJa) {
    const jaMissing = groups.filter((g) => !(Array.isArray(g.agencies) && g.agencies.some(Boolean)));
    console.error(`[${target.label}] ja.wikipedia pass for ${jaMissing.length} groups…`);
    let i = 0;
    for (const g of jaMissing) {
      i += 1;
      if (i % 25 === 0) console.error(`  … ${i}/${jaMissing.length}`);
      const formed = isoDay(g.formed_date);
      const ended = isoDay(g.ended_date || g.disband_date);
      try {
        const title = await wikiApiSearchTitleOn("https://ja.wikipedia.org/w/api.php", String(g.name || ""));
        stats.wiki_ja_searched += 1;
        await sleep(1200);
        if (!title) continue;
        const wt = await fetchWikitextSingle("https://ja.wikipedia.org/w/api.php", title);
        await sleep(1200);
        if (!wt) continue;
        const rows = parseJaWikiOfficeHistory(wt, formed);
        if (!rows.length) continue;
        let history = normalizeHistory([...(Array.isArray(g.agency_history) ? g.agency_history : []), ...rows]);
        let agencies = currentFromHistory(history);
        ({ history, agencies } = applyEndedGroup(history, agencies, ended));
        if (!agencies.length && history.length) agencies = [history[0].agency];
        g.agencies = agencies;
        g.agency_history = history;
        stats.filled_from_wiki_ja += 1;
        if (!dryRun && stats.filled_from_wiki_ja % 5 === 0) {
          fs.writeFileSync(target.groupsPath, `${JSON.stringify(groups, null, 2)}\n`, "utf8");
          console.error(`  saved checkpoint (${stats.filled_from_wiki_ja} ja fills)`);
        }
      } catch (e) {
        stats.wiki_errors += 1;
        // back off on rate limit
        await sleep(5000);
      }
    }
    stats.still_missing = groups.filter(
      (g) => !(Array.isArray(g.agencies) && g.agencies.some(Boolean)),
    ).length;
  }

  // 6) Manual overrides (by exact group.name) for remaining gaps
  {
    let filledOv = 0;
    for (const g of groups) {
      const rows = overridesByName[g.name];
      if (!Array.isArray(rows) || !rows.length) continue;
      const hasAgency = Array.isArray(g.agencies) && g.agencies.some(Boolean);
      const hasHist = Array.isArray(g.agency_history) && g.agency_history.length;
      // Fill if missing agency, or enrich history when override has more dated rows
      if (hasAgency && hasHist && g.agency_history.some((h) => h.source === "manual")) continue;
      if (hasAgency && hasHist && !overridesByName[g.name]) continue;
      if (hasAgency && hasHist) {
        // only apply if current history lacks dates and override has them
        const curDated = g.agency_history.some((h) => h.start_date || h.end_date);
        const ovDated = rows.some((h) => h.start_date || h.end_date);
        if (curDated || !ovDated) continue;
      }
      const formed = isoDay(g.formed_date);
      const ended = isoDay(g.ended_date || g.disband_date);
      let history = normalizeHistory(rows.map((r) => ({ ...r, source: r.source || "manual" })));
      let agencies = currentFromHistory(history);
      ({ history, agencies } = applyEndedGroup(history, agencies, ended));
      if (!agencies.length && history.length) agencies = [history[0].agency];
      if (!agencies.length) continue;
      g.agencies = agencies;
      g.agency_history = history;
      filledOv += 1;
    }
    stats.filled_from_override = filledOv;
    stats.still_missing = groups.filter(
      (g) => !(Array.isArray(g.agencies) && g.agencies.some(Boolean)),
    ).length;
  }

  if (!dryRun) {
    fs.writeFileSync(target.groupsPath, `${JSON.stringify(groups, null, 2)}\n`, "utf8");
  }

  const missingNames = groups
    .filter((g) => !(Array.isArray(g.agencies) && g.agencies.some(Boolean)))
    .map((g) => g.name);

  // Write report
  const reportPath = path.join(
    root,
    "support/reports",
    `group_agency_fill_${target.label}.json`,
  );
  if (!dryRun) {
    fs.writeFileSync(
      reportPath,
      `${JSON.stringify(
        {
          generated_at: new Date().toISOString(),
          stats,
          still_missing: missingNames,
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
  }

  return {
    ...stats,
    still_missing_count: missingNames.length,
    still_missing_sample: missingNames.slice(0, 30),
    report: dryRun ? null : reportPath,
  };
}

const results = [];
for (const t of targets) {
  console.error(`Processing ${t.label}…`);
  // eslint-disable-next-line no-await-in-loop
  results.push(await processFile(t));
}
console.log(JSON.stringify({ dry_run: dryRun, wiki: useWiki, wiki_ja: useWikiJa, results }, null, 2));
