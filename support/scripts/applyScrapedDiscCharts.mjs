/**
 * Apply scraped Oricon peaks + anosaka sales onto main + scenario_6 discography.
 *
 *   node support/scripts/applyScrapedDiscCharts.mjs
 *   node support/scripts/applyScrapedDiscCharts.mjs --dry-run
 *   node support/scripts/applyScrapedDiscCharts.mjs --phase playable|other|all
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");
const phaseIdx = process.argv.indexOf("--phase");
const phase = phaseIdx >= 0 ? process.argv[phaseIdx + 1] : "all";

function load(p, fb) {
  if (!fs.existsSync(p)) return fb;
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function nfkc(s) {
  return String(s ?? "").normalize("NFKC");
}

function compactTitle(s) {
  return nfkc(s)
    .replace(/[;／\/].*$/, "")
    .replace(/[“”"『』「」【】\[\]()（）!！?？☆★♪·・♡♥■]/g, "")
    .replace(/[、､,.\s]/g, "")
    .toLowerCase();
}

function isPhysicalAudio(d) {
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
    const a = new Set(dt.match(/[\u3040-\u30ff\u4e00-\u9fffA-Za-z0-9]+/g) || []);
    const b = new Set(ct.match(/[\u3040-\u30ff\u4e00-\u9fffA-Za-z0-9]+/g) || []);
    let inter = 0;
    for (const x of a) if (b.has(x)) inter++;
    if (!inter) return 0;
    score += (inter / Math.max(a.size, b.size)) * 55;
  }
  const dd = String(disc.release_date ?? "").slice(0, 10);
  if (dd && chart.date && dd === chart.date) score += 40;
  else if (dd && chart.date && dd.slice(0, 7) === chart.date.slice(0, 7)) score += 15;
  return score;
}

function bestMatch(disc, charts, min = 70) {
  let best = null;
  let bestScore = 0;
  for (const c of charts) {
    const s = scoreMatch(disc, c);
    if (s > bestScore) {
      bestScore = s;
      best = c;
    }
  }
  return bestScore >= min ? best : null;
}

function flattenPeaks(byGroup) {
  /** @type {Map<string, any[]>} */
  const map = new Map();
  for (const [group, blob] of Object.entries(byGroup || {})) {
    const rows = [...(blob.singles || []), ...(blob.albums || [])];
    map.set(group, rows);
  }
  return map;
}

function mergePeakFiles(files) {
  const out = {};
  for (const f of files) {
    const obj = load(f, {});
    Object.assign(out, obj);
  }
  return out;
}

const allow = load(path.join(root, "public/data/scenarios/scenario_6/startup_allowlist.json"), {
  names_in_order: [],
  recommended_count: 0,
});
const playable = new Set(allow.names_in_order || []);
const recommended = new Set((allow.names_in_order || []).slice(0, Number(allow.recommended_count) || 0));

const peakFiles = [
  path.join(root, "support/data/disc_chart_peaks_playable_batch1.json"),
  path.join(root, "support/data/disc_chart_peaks_playable_batch2.json"),
  path.join(root, "support/data/disc_chart_peaks_playable_batch3.json"),
  path.join(root, "support/data/disc_chart_peaks_other.json"),
];
const peaksByGroup = flattenPeaks(mergePeakFiles(peakFiles));
const salesByGroup = load(path.join(root, "support/data/disc_chart_sales_anosaka.json"), {});

const mainGroups = load(path.join(root, "public/data/groups.json"), []);
const s6Groups = load(path.join(root, "public/data/scenarios/scenario_6/groups.json"), []);

const stats = { peaksSet: 0, salesSet: 0, discsTouched: 0, groupsTouched: 0 };

function shouldProcessGroup(name) {
  if (phase === "playable") return playable.has(name) && !recommended.has(name);
  if (phase === "other") return !playable.has(name);
  if (phase === "allowlist") return playable.has(name);
  if (phase === "recommended") return recommended.has(name);
  return true; // all
}

for (const groups of [mainGroups, s6Groups]) {
  for (const grp of groups) {
    const name = grp.name;
    if (!shouldProcessGroup(name)) continue;
    const peaks = peaksByGroup.get(name) || [];
    const sales = salesByGroup[name] || [];
    if (!peaks.length && !sales.length) continue;
    if (!Array.isArray(grp.discography)) continue;
    let groupTouched = false;
    for (const d of grp.discography) {
      if (!isPhysicalAudio(d)) continue;
      let touched = false;
      const peakHit = bestMatch(d, peaks, 68);
      if (peakHit) {
        if (d.oricon_peak_rank == null || peakHit.peak < d.oricon_peak_rank) {
          d.oricon_peak_rank = peakHit.peak;
          stats.peaksSet++;
          touched = true;
        }
      }
      const salesHit = bestMatch(d, sales, 68);
      if (salesHit && d.first_week_sales == null) {
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
      if (touched) {
        stats.discsTouched++;
        groupTouched = true;
      }
    }
    if (groupTouched) stats.groupsTouched++;
  }
}

// groupsTouched counted twice (main+s6) — report per-file instead
console.log(`phase=${phase} peakGroups=${peaksByGroup.size} salesGroups=${Object.keys(salesByGroup).length}`);
console.log(stats);

if (!dryRun) {
  fs.writeFileSync(path.join(root, "public/data/groups.json"), `${JSON.stringify(mainGroups, null, 2)}\n`);
  fs.writeFileSync(
    path.join(root, "public/data/scenarios/scenario_6/groups.json"),
    `${JSON.stringify(s6Groups, null, 2)}\n`,
  );
  console.log("Wrote main + scenario_6 groups.json");
} else {
  console.log("Dry run — no write");
}
