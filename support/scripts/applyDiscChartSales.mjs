/**
 * Apply oricon_peak_rank + first_week_sales onto recommended-group discography rows
 * in main and scenario_6 groups.json.
 *
 *   node support/scripts/applyDiscChartSales.mjs
 *   node support/scripts/applyDiscChartSales.mjs --dry-run
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const dryRun = process.argv.includes("--dry-run");

/** @typedef {"oricon" | "billboard"} SalesSource */
/**
 * @typedef {{
 *   group: string,
 *   match: (d: Record<string, unknown>) => boolean,
 *   oricon_peak_rank?: number,
 *   first_week_sales?: number,
 *   first_week_sales_source?: SalesSource,
 * }} DiscSalesPatch
 */

function normTitle(s) {
  return String(s ?? "")
    .normalize("NFKC")
    .replace(/[;／\/].*$/, "")
    .replace(/[“”"｢｣『』【】\[\]()（）]/g, "")
    .replace(/[、､,]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLowerCase();
}

function titleIncludes(d, ...needles) {
  const t = normTitle(d.title);
  return needles.some((n) => t.includes(normTitle(n)));
}

function dateIs(d, iso) {
  return String(d.release_date ?? "").slice(0, 10) === iso;
}

/** @type {DiscSalesPatch[]} */
const PATCHES = [
  // ——— =LOVE (Oricon weekly peaks from ORICON NEWS; first-week from anosaka/ORICON, 万→units) ———
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "=LOVE") && dateIs(d, "2017-09-06"),
    oricon_peak_rank: 8,
    first_week_sales: 19000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "僕らの制服クリスマス"),
    oricon_peak_rank: 3,
    first_week_sales: 40000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "手遅れcaution"),
    oricon_peak_rank: 3,
    first_week_sales: 63000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "Want you"),
    oricon_peak_rank: 2,
    first_week_sales: 81000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "探せ", "ダイヤモンドリリー"),
    oricon_peak_rank: 2,
    first_week_sales: 100000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "ズルいよ"),
    oricon_peak_rank: 1,
    first_week_sales: 143000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "CAMEO"),
    oricon_peak_rank: 2,
    first_week_sales: 155000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "サブリミナル"),
    oricon_peak_rank: 1,
    first_week_sales: 100000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "全部", "内緒"),
    oricon_peak_rank: 1,
    first_week_sales: 44000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "ウィークエンドシトロン"),
    oricon_peak_rank: 2,
    first_week_sales: 94000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "The 5th"),
    oricon_peak_rank: 2,
    first_week_sales: 114000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "あの子コンプレックス"),
    oricon_peak_rank: 2,
    first_week_sales: 148000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "Be Selfish"),
    oricon_peak_rank: 1,
    first_week_sales: 144000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "この空がトリガー"),
    oricon_peak_rank: 2,
    first_week_sales: 161000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "ナツマトペ", "ナツマトぺ"),
    oricon_peak_rank: 1,
    first_week_sales: 180000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "ラストノート"),
    oricon_peak_rank: 1,
    first_week_sales: 207000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "呪って呪って"),
    oricon_peak_rank: 2,
    first_week_sales: 180000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "絶対アイドル辞めないで"),
    oricon_peak_rank: 2,
    first_week_sales: 207000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "とくべチュ") || titleIncludes(d, "恋人以上"),
    oricon_peak_rank: 2,
    first_week_sales: 249000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "ラブソングに襲われる"),
    oricon_peak_rank: 1,
    first_week_sales: 330000,
    first_week_sales_source: "oricon",
  },
  {
    group: "=LOVE",
    match: (d) => titleIncludes(d, "劇薬中毒"),
    oricon_peak_rank: 1,
    first_week_sales: 360000,
    first_week_sales_source: "oricon",
  },

  // ——— iLiFE! ———
  {
    group: "iLiFE!",
    match: (d) => titleIncludes(d, "アイライフスターターパック"),
    oricon_peak_rank: 7,
    // free Oricon text does not publish unit count
  },
  {
    group: "iLiFE!",
    match: (d) => titleIncludes(d, "BRAVE GROOVE"),
    oricon_peak_rank: 2,
    first_week_sales: 30610,
    first_week_sales_source: "billboard",
  },

  // ——— 高嶺のなでしこ ———
  {
    group: "高嶺のなでしこ",
    match: (d) => titleIncludes(d, "アンチファン"),
    oricon_peak_rank: 18,
  },
  {
    group: "高嶺のなでしこ",
    match: (d) => titleIncludes(d, "美しく生きろ"),
    oricon_peak_rank: 4,
    first_week_sales: 46558,
    first_week_sales_source: "billboard",
  },
  {
    group: "高嶺のなでしこ",
    match: (d) => titleIncludes(d, "I'M YOUR IDOL", "I’M YOUR IDOL", "アドレナリンゲーム"),
    oricon_peak_rank: 3,
    first_week_sales: 55817,
    first_week_sales_source: "billboard",
  },
  {
    group: "高嶺のなでしこ",
    match: (d) => titleIncludes(d, "見上げるたびに"),
    oricon_peak_rank: 2,
  },

  // ——— アキシブproject ———
  {
    group: "アキシブproject",
    match: (d) => titleIncludes(d, "Summer Summer", "Summer☆Summer", "セツナツリ"),
    oricon_peak_rank: 9,
  },
  {
    group: "アキシブproject",
    match: (d) => titleIncludes(d, "アバンチュ"),
    oricon_peak_rank: 18,
  },
  {
    group: "アキシブproject",
    match: (d) => titleIncludes(d, "Hola"),
    oricon_peak_rank: 9,
  },
  {
    group: "アキシブproject",
    match: (d) => titleIncludes(d, "The First Summer"),
    oricon_peak_rank: 14,
  },
];

function applyFile(relPath) {
  const full = path.join(root, relPath);
  const groups = JSON.parse(fs.readFileSync(full, "utf8"));
  const hits = [];
  const misses = [...PATCHES];

  for (const grp of groups) {
    const name = String(grp.name ?? "");
    const discography = Array.isArray(grp.discography) ? grp.discography : [];
    for (const d of discography) {
      if (!d || typeof d !== "object") continue;
      for (let i = 0; i < misses.length; i++) {
        const patch = misses[i];
        if (patch.group !== name) continue;
        if (!patch.match(d)) continue;
        if (patch.oricon_peak_rank != null) d.oricon_peak_rank = patch.oricon_peak_rank;
        if (patch.first_week_sales != null) {
          d.first_week_sales = patch.first_week_sales;
          d.first_week_sales_source = patch.first_week_sales_source ?? null;
        }
        hits.push({
          file: relPath,
          group: name,
          title: d.title,
          oricon_peak_rank: d.oricon_peak_rank ?? null,
          first_week_sales: d.first_week_sales ?? null,
          first_week_sales_source: d.first_week_sales_source ?? null,
        });
        misses.splice(i, 1);
        break;
      }
    }
  }

  if (!dryRun) {
    fs.writeFileSync(full, `${JSON.stringify(groups, null, 2)}\n`);
  }
  return { hits, misses };
}

const files = ["public/data/groups.json", "public/data/scenarios/scenario_6/groups.json"];
let allMisses = [];
for (const f of files) {
  const { hits, misses } = applyFile(f);
  console.log(`\n${f}: ${hits.length} patched`);
  for (const h of hits) {
    console.log(
      `  ${h.title} → peak=${h.oricon_peak_rank ?? "—"} sales=${h.first_week_sales ?? "—"} (${h.first_week_sales_source ?? "—"})`,
    );
  }
  allMisses = misses;
}
if (allMisses.length) {
  console.log("\nUnmatched patches:");
  for (const m of allMisses) console.log(`  [${m.group}] ${m.match}`);
  process.exitCode = 1;
} else {
  console.log(dryRun ? "\nDry run OK (no write)." : "\nWrite OK.");
}
