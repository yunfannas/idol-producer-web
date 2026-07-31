/**
 * Sweep discography oricon_peak_rank + first_week_sales from public Oricon rank pages
 * and (when available) anosaka first-week sales tables.
 *
 *   node support/scripts/sweepDiscChartSales.mjs --phase playable --dry-run
 *   node support/scripts/sweepDiscChartSales.mjs --phase playable
 *   node support/scripts/sweepDiscChartSales.mjs --phase other
 *   node support/scripts/sweepDiscChartSales.mjs --phase all
 *   node support/scripts/sweepDiscChartSales.mjs --group "≠ME"
 *
 * Caches Oricon artist IDs in support/data/oricon_artist_ids.json
 * Caches scraped chart rows in support/tmp/oricon_chart_cache/
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const allowPath = path.join(root, "public/data/scenarios/scenario_6/startup_allowlist.json");
const mainGroupsPath = path.join(root, "public/data/groups.json");
const s6GroupsPath = path.join(root, "public/data/scenarios/scenario_6/groups.json");
const idCachePath = path.join(root, "support/data/oricon_artist_ids.json");
const chartCacheDir = path.join(root, "support/tmp/oricon_chart_cache");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const forceFetch = args.includes("--force-fetch");
const phaseIdx = args.indexOf("--phase");
const phase = phaseIdx >= 0 ? String(args[phaseIdx + 1] || "playable") : "playable";
const groupIdx = args.indexOf("--group");
const groupFilter = groupIdx >= 0 ? String(args[groupIdx + 1] || "").trim() : "";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

/** Seed IDs for allowlist acts (extend via resolve). */
const SEED_ORICON_IDS = {
  "=LOVE": "705208",
  "iLiFE!": "898935",
  高嶺のなでしこ: "898944",
  アキシブproject: "645602",
  "FRUITS ZIPPER": "893368",
  "≠ME": "769318",
  "≒JOY": "904109",
  "CUTIE STREET": "933074",
  "CANDY TUNE": "917449",
  "SWEET STEADY": "925601",
  私立恵比寿中学: "521078",
  Negicco: "486201",
  LinQ: "531805",
  CYNHN: "711235",
  ばってん少女隊: "650585",
  "Devil ANTHEM.": "693480",
  "Dorothy Little Happy": "494424",
  "ARCANA PROJECT": "773864",
  "Luce Twinkle Wink☆": "578482",
  "FES☆TIVE": "562398",
  "READY TO KISS": "569588",
  Appare!: "713589",
  "Broken By The Scream": "918883",
  いぎなり東北産: "701234",
  TENRIN: "866923",
  yosugala: "793215",
  JamsCollection: "793214",
  NANIMONO: "866924",
  "NEO JAPONISM": "793216",
  手羽先センセーション: "693481",
  STARMARIE: "521079",
  "BANZAI JAPAN": "645603",
  KRD8: "650586",
  "MyDearDarlin'": "866925",
  AVAM: "933075",
  GENIC: "866926",
  REIRIE: "933076",
};

/** Anosaka sales pages (万 units, prefer Oricon column). */
const ANOSAKA_SALES_URLS = {
  "=LOVE": "https://anosaka.com/equal-love-single-sales-ranking",
  "≠ME": "https://anosaka.com/not-equal-me-single-sales-ranking",
  "≒JOY": "https://anosaka.com/nearly-equal-joy-single-sales-ranking",
  "FRUITS ZIPPER": "https://anosaka.com/fruitszipper-single-sales",
  "CUTIE STREET": "https://anosaka.com/cutiestreet-single-sales",
  "CANDY TUNE": "https://anosaka.com/candytune-single-sales",
  "SWEET STEADY": "https://anosaka.com/sweetsteady-single-sales",
};

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function nfkc(s) {
  return String(s ?? "").normalize("NFKC");
}

function compactTitle(s) {
  return nfkc(s)
    .replace(/[;／\/].*$/, "")
    .replace(/[“”"『』「」【】\[\]()（）!！?？☆★♪·・]/g, "")
    .replace(/[、､,.\s]/g, "")
    .toLowerCase();
}

function parseJpDate(s) {
  const m = String(s).match(/(\d{4})年\s*(\d{1,2})月\s*(\d{1,2})日/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

function manToUnits(v) {
  if (v == null || v === "" || v === "-" || v === "–" || v === "—" || /未確認/.test(String(v))) return null;
  const n = Number(String(v).replace(/[,，]/g, "").replace(/万.*$/, "").trim());
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 10000);
}

function loadJson(p, fallback) {
  if (!fs.existsSync(p)) return fallback;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function saveJson(p, obj) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, `${JSON.stringify(obj, null, 2)}\n`);
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": UA, Accept: "text/html,application/xhtml+xml" },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
  return await res.text();
}

async function resolveOriconId(groupName, idCache) {
  if (idCache[groupName]) return idCache[groupName];
  if (SEED_ORICON_IDS[groupName]) {
    idCache[groupName] = SEED_ORICON_IDS[groupName];
    return idCache[groupName];
  }
  // Oricon site search (artist)
  const q = encodeURIComponent(groupName);
  const url = `https://www.oricon.co.jp/search/?searchkey=${q}&type=artist`;
  try {
    const html = await fetchText(url);
    const re = /href="\/prof\/(\d+)\/"[^>]*>[\s\S]{0,200}?/gi;
    const hits = [];
    let m;
    while ((m = re.exec(html))) {
      hits.push(m[1]);
      if (hits.length > 8) break;
    }
    // Prefer exact name near link
    const exact = html.match(
      new RegExp(`href="/prof/(\\d+)/"[^>]*>\\s*${groupName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*<`, "i"),
    );
    const id = exact?.[1] || hits[0] || null;
    if (id) idCache[groupName] = id;
    await sleep(400);
    return id;
  } catch (e) {
    console.warn(`resolve fail ${groupName}: ${e.message}`);
    return null;
  }
}

/** Parse Oricon /rank/single|album pages → {title, date, peak}[] */
function parseOriconRankPage(html) {
  const out = [];
  // Split on ## Title sections from markdown-ish or h2 blocks
  const blocks = html.split(/<h2[^>]*>/i).slice(1);
  for (const block of blocks) {
    const titleEnd = block.indexOf("</h2>");
    if (titleEnd < 0) continue;
    const title = nfkc(block.slice(0, titleEnd).replace(/<[^>]+>/g, "")).trim();
    if (!title || /ランキング|求人|関連|シングル売上|アルバム売上|合算/.test(title)) continue;
    const peakM = block.match(/最高順位[\s\S]{0,80}?(\d+)\s*位/);
    const dateM = block.match(/発売日[\s\S]{0,40}?(\d{4}年\s*\d{1,2}月\s*\d{1,2}日)/);
    if (!peakM) continue;
    out.push({
      title,
      date: dateM ? parseJpDate(dateM[1]) : null,
      peak: Number(peakM[1]),
    });
  }
  // Fallback: table-ish markdown from WebFetch style not needed for raw HTML
  if (!out.length) {
    const re =
      /<h2[^>]*>\s*([^<]+?)\s*<\/h2>[\s\S]*?発売日[\s\S]*?(\d{4}年\s*\d{1,2}月\s*\d{1,2}日)[\s\S]*?最高順位[\s\S]*?(\d+)\s*位/gi;
    let m;
    while ((m = re.exec(html))) {
      out.push({ title: nfkc(m[1]).trim(), date: parseJpDate(m[2]), peak: Number(m[3]) });
    }
  }
  return out;
}

/** Also parse products list pages which embed peak per product. */
function parseOriconProductsPage(html) {
  const out = [];
  const re =
    /<h3[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]*?最高順位[\s\S]*?(\d+)\s*位[\s\S]*?発売日[\s\S]*?(\d{4}年\s*\d{1,2}月\s*\d{1,2}日)/gi;
  let m;
  while ((m = re.exec(html))) {
    out.push({ title: nfkc(m[1]).trim(), peak: Number(m[2]), date: parseJpDate(m[3]) });
  }
  // Alternate order: date then peak
  const re2 =
    /<h3[^>]*>[\s\S]*?<a[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]*?発売日[\s\S]*?(\d{4}年\s*\d{1,2}月\s*\d{1,2}日)[\s\S]*?最高順位[\s\S]*?(\d+)\s*位/gi;
  while ((m = re2.exec(html))) {
    out.push({ title: nfkc(m[1]).trim(), date: parseJpDate(m[2]), peak: Number(m[3]) });
  }
  return out;
}

async function fetchOriconCharts(artistId, kind) {
  const cachePath = path.join(chartCacheDir, `${artistId}_${kind}.json`);
  if (!forceFetch && fs.existsSync(cachePath)) {
    return loadJson(cachePath, []);
  }
  const url =
    kind === "single"
      ? `https://www.oricon.co.jp/prof/${artistId}/rank/single/`
      : kind === "album"
        ? `https://www.oricon.co.jp/prof/${artistId}/rank/album/`
        : `https://www.oricon.co.jp/prof/${artistId}/products/`;
  try {
    const html = await fetchText(url);
    const rows = kind === "products" ? parseOriconProductsPage(html) : parseOriconRankPage(html);
    saveJson(cachePath, rows);
    await sleep(500);
    return rows;
  } catch (e) {
    console.warn(`oricon ${artistId} ${kind}: ${e.message}`);
    return [];
  }
}

/** Parse anosaka markdown/HTML tables with タイトル + オリコン初週. */
function parseAnosakaSales(html) {
  const out = [];
  // Markdown tables
  const lines = html.split(/\n/);
  for (const line of lines) {
    if (!line.includes("|")) continue;
    const cols = line.split("|").map((c) => c.trim()).filter((c, i, a) => !(i === 0 && c === "") && !(i === a.length - 1 && c === ""));
    if (cols.length < 4) continue;
    if (/タイトル|#|---/.test(cols[0]) || cols[0] === "#") continue;
    // Expect: # | title | date | ... | oricon_fw | billboard_fw
    const titleIdx = cols.findIndex((c, i) => i > 0 && !/^\d{4}/.test(c) && !/^\d+(\.\d+)?$/.test(c) && c.length > 1);
    // Simpler: known layouts
    // | # | タイトル | リリース日 | オリコン初日 | オリコン初週 | Billboard初週 |
    // | # | タイトル | リリース日 | オリコン初週 | Billboard初週 |
    if (/^\d+$/.test(cols[0]) && cols[1]) {
      const title = cols[1];
      let oricon = null;
      let billboard = null;
      const dateCol = cols[2];
      const date = /^\d{4}\/\d{1,2}\/\d{1,2}/.test(dateCol)
        ? dateCol.replace(/\//g, "-").replace(/-(\d)(?=-)/g, "-0$1").replace(/-(\d)$/, "-0$1")
        : null;
      // find numeric 万 columns after date
      const nums = cols.slice(3).map((c) => c.replace(/万枚?/g, "").trim());
      if (nums.length >= 2 && cols.length >= 6) {
        // may have 初日 + 初週 + BB
        oricon = manToUnits(nums[nums.length >= 3 ? 1 : 0]);
        billboard = manToUnits(nums[nums.length >= 3 ? 2 : 1]);
      } else if (nums.length >= 1) {
        oricon = manToUnits(nums[0]);
        if (nums[1]) billboard = manToUnits(nums[1]);
      }
      if (title && (oricon != null || billboard != null)) {
        out.push({ title, date, oricon, billboard });
      }
    }
  }
  return out;
}

function normalizeAnosakaDate(d) {
  if (!d) return null;
  const m = String(d).match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
  if (!m) return null;
  return `${m[1]}-${String(m[2]).padStart(2, "0")}-${String(m[3]).padStart(2, "0")}`;
}

async function fetchAnosakaSales(groupName) {
  const url = ANOSAKA_SALES_URLS[groupName];
  if (!url) return [];
  const cachePath = path.join(chartCacheDir, `anosaka_${compactTitle(groupName) || "x"}.json`);
  if (!forceFetch && fs.existsSync(cachePath)) return loadJson(cachePath, []);
  try {
    const html = await fetchText(url);
    const rows = parseAnosakaSales(html).map((r) => ({
      ...r,
      date: normalizeAnosakaDate(r.date),
    }));
    saveJson(cachePath, rows);
    await sleep(400);
    return rows;
  } catch (e) {
    console.warn(`anosaka ${groupName}: ${e.message}`);
    return [];
  }
}

function isPhysicalAudioDisc(d) {
  const t = String(d.disc_type ?? "");
  if (/digital/i.test(t)) return false;
  if (/^video$/i.test(t) || /dvd|blu-?ray|\bbd\b/i.test(t)) return false;
  return true;
}

function scoreMatch(disc, chart) {
  const dt = compactTitle(disc.title);
  const ct = compactTitle(chart.title);
  if (!dt || !ct) return 0;
  let score = 0;
  if (dt === ct) score += 100;
  else if (dt.includes(ct) || ct.includes(dt)) score += 70;
  else {
    // token overlap
    const a = new Set(dt.match(/[\u3040-\u30ff\u4e00-\u9fff\w]+/g) || []);
    const b = new Set(ct.match(/[\u3040-\u30ff\u4e00-\u9fff\w]+/g) || []);
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    if (inter === 0) return 0;
    score += (inter / Math.max(a.size, b.size)) * 50;
  }
  const dd = String(disc.release_date ?? "").slice(0, 10);
  if (dd && chart.date && dd === chart.date) score += 40;
  else if (dd && chart.date && dd.slice(0, 7) === chart.date.slice(0, 7)) score += 15;
  return score;
}

function bestMatch(disc, charts, minScore = 70) {
  let best = null;
  let bestScore = 0;
  for (const c of charts) {
    const s = scoreMatch(disc, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore >= minScore ? best : null;
}

function targetGroupNames(allow, allGroupNames) {
  if (groupFilter) return [groupFilter];
  const names = allow.names_in_order || [];
  const recN = Number(allow.recommended_count) || 0;
  const playableRest = names.slice(recN);
  const playable = names;
  const other = allGroupNames.filter((n) => !playable.includes(n));
  if (phase === "recommended") return names.slice(0, recN);
  if (phase === "playable") return playableRest;
  if (phase === "other") return other;
  if (phase === "all") return [...playableRest, ...other];
  if (phase === "allowlist") return playable;
  return playableRest;
}

async function main() {
  fs.mkdirSync(chartCacheDir, { recursive: true });
  fs.mkdirSync(path.dirname(idCachePath), { recursive: true });

  const allow = loadJson(allowPath, { names_in_order: [], recommended_count: 0 });
  const mainGroups = loadJson(mainGroupsPath, []);
  const s6Groups = loadJson(s6GroupsPath, []);
  const idCache = { ...SEED_ORICON_IDS, ...loadJson(idCachePath, {}) };

  const allNames = [...new Set([...mainGroups, ...s6Groups].map((g) => g.name).filter(Boolean))];
  const targets = targetGroupNames(allow, allNames);
  console.log(`Phase=${phase} groups=${targets.length} dryRun=${dryRun}`);

  const stats = { groups: 0, discsTouched: 0, peaksSet: 0, salesSet: 0, noId: 0, unresolved: [] };

  for (const name of targets) {
    stats.groups++;
    const artistId = await resolveOriconId(name, idCache);
    if (!artistId) {
      stats.noId++;
      stats.unresolved.push(name);
      continue;
    }

    const singles = await fetchOriconCharts(artistId, "single");
    const albums = await fetchOriconCharts(artistId, "album");
    const peaks = [...singles, ...albums];
    // Dedup by compact title keeping best (lowest) peak
    const peakByKey = new Map();
    for (const row of peaks) {
      const k = compactTitle(row.title);
      const prev = peakByKey.get(k);
      if (!prev || row.peak < prev.peak) peakByKey.set(k, row);
    }
    const peakList = [...peakByKey.values()];
    const salesList = await fetchAnosakaSales(name);

    for (const groups of [mainGroups, s6Groups]) {
      const grp = groups.find((g) => g.name === name);
      if (!grp || !Array.isArray(grp.discography)) continue;
      for (const d of grp.discography) {
        if (!isPhysicalAudioDisc(d)) continue;
        let touched = false;
        const peakHit = bestMatch(d, peakList, 70);
        if (peakHit && (d.oricon_peak_rank == null || forceFetch)) {
          // Prefer better (lower) rank if both exist
          if (d.oricon_peak_rank == null || peakHit.peak < d.oricon_peak_rank) {
            d.oricon_peak_rank = peakHit.peak;
            stats.peaksSet++;
            touched = true;
          }
        }
        const salesHit = bestMatch(d, salesList, 70);
        if (salesHit && (d.first_week_sales == null || forceFetch)) {
          if (salesHit.oricon != null) {
            d.first_week_sales = salesHit.oricon;
            d.first_week_sales_source = "oricon";
            stats.salesSet++;
            touched = true;
          } else if (salesHit.billboard != null) {
            d.first_week_sales = salesHit.billboard;
            d.first_week_sales_source = "billboard";
            stats.salesSet++;
            touched = true;
          }
        }
        // If peak missing but sales page matched, still ok
        if (touched) stats.discsTouched++;
      }
    }
    console.log(
      `  ${name} id=${artistId} peaks=${peakList.length} salesRows=${salesList.length}`,
    );
  }

  saveJson(idCachePath, idCache);

  if (!dryRun) {
    fs.writeFileSync(mainGroupsPath, `${JSON.stringify(mainGroups, null, 2)}\n`);
    fs.writeFileSync(s6GroupsPath, `${JSON.stringify(s6Groups, null, 2)}\n`);
  }

  console.log("\nStats:", stats);
  if (stats.unresolved.length) {
    console.log(`Unresolved Oricon IDs (${stats.unresolved.length}):`, stats.unresolved.slice(0, 40).join(", "));
  }
  console.log(dryRun ? "Dry run — no write." : "Wrote main + scenario_6 groups.json");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
