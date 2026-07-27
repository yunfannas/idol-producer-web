# neverless scandal scrape — reference

## `kind` / `score` classification heuristics

Order matters: the first matching rule wins. Ported from
`infer_kind_and_score()` in `scripts/sync_neverless_all_groups.py` (desktop repo).

| Japanese signal | `kind` | `score` | `illness_type` |
|-----------------|--------|---------|----------------|
| 新型コロナ / コロナウイルス / コロナに感染 | `health` | — | `COVID-19` |
| 適応障害 | `health` | — | `adjustment disorder` |
| 躁鬱 / 躁うつ | `health` | — | `bipolar disorder` |
| 扁桃腺 | `health` | — | `tonsillectomy` |
| 捻挫 / 骨折 / 転落 / 怪我 / 脱臼 / 打撲 | `injury` | — | set from the body part |
| 解雇 / 契約解除 / 契約解除処分 | `scandal` | **5.0** | — |
| 交際 / 熱愛 / 流出 / 私的交流 / 炎上 | `scandal` | **4.0** | — |
| 謝罪 / 注意 / 違反 (without 解雇·契約解除) | `scandal` | **2.5** → review | — |
| 精神的 / 肉体的…疲労 / 体調不良…活動 | `hiatus` | — | — |
| anything else | `other` | — | — |

The heuristic is a **seed, not a verdict**. Read the bullet and place the row on the
canonical 1.0-5.0 ladder in `SKILL.md`; in particular the `2.5` bucket is off-ladder
and should resolve to **1.0** (bad SNS post), **2.0** (teammate conflict), or **4.0**
(rules violation, not fired).

## Incident vs membership-chronology filter

Chunks that only describe 卒業/脱退/加入/移籍/兼任 are **membership noise** and must not
become `status_history` rows. A chunk is kept when it contains any of:

契約, 解雇, 感染, コロナ, 骨折, 捻挫, 交際, 熱愛, 流出, 炎上, 違反, 謝罪, 訴訟, 裁判,
逮捕, 暴力, いじめ, 入院, 手術, 診断, 適応障害, 躁鬱, うつ, 休止, 活動休止, 契約解除,
処分, スキャンダル

## Page structure

- Section heading matched: `h3`/`h4` containing 事件 **and** (スキャンダル or 事故).
- Skipped headings: 卒業後, 運営その他 (the latter only when the user wants group-level notes).
- Body text is split on `(\d{4})年(\d{1,2})月` anchors; each chunk runs to the next anchor.
- Encoding is **EUC-JP**; slugs are percent-encoded EUC-JP bytes, lowercase
  (`slug = "".join("%%%02x" % b for b in name.encode("euc_jp"))`).

## Duration resolution order (`health` / `injury`)

1. Explicit in the wiki — 全治X週間, 約X日, X週間の安静, 隔離期間, 〇月△日に活動再開.
   Prefer weeks for 7-56 day spans (14 days → `2 weeks`); keep `10 days` when not near a week.
2. Derive from `end_date` on the same row when a return date is recorded.
3. Open the cited official X / 公式サイト notice; keep `source_url` on neverless and add
   `evidence_url` for the official page.
4. Otherwise **omit `duration`** — never guess a default. Keep `illness_type` if the
   diagnosis is known.

## Current coverage (`public/data/idols.json`)

357 `status_history` rows across 7,034 idols.

| `kind` | Rows |
|--------|------|
| `scandal` | 181 (97 groups) |
| `health` | 113 |
| `injury` | 46 |
| `hiatus` | 17 |

Scandal `score` distribution — **entirely machine-seeded, none hand-reviewed yet**:

| Score | Rows |
|-------|------|
| 5.0 | 79 |
| 4.0 | 35 |
| 2.5 | 67 (off-ladder, needs review) |

Rows per year run 2014-2026, peaking at 39 in 2025 and 26 in 2024. Scenario snapshot
`public/data/scenarios/scenario_6/idols.json` carries 21 scandal rows.

Densest groups: JamsCollection (9), ナト☆カン (6), then CHICKEN BLOW THE IDOL, 星歴13夜,
じーくらむ！, STAiNY, ネコプラpixx., シュレーディンガーの犬 (4 each).

Of 689 groups in `public/data/groups.json`, **156** carry a `neverless_article:` note and
**68** of those have no scandal row yet — either a clean article or an unfinished pass.

## Gap report one-liners

Groups with a `neverless_article:` note but no scandal rows (candidates for a re-read):

```powershell
node --input-type=module -e "
import { readFileSync } from 'fs';
const groups = JSON.parse(readFileSync('public/data/groups.json','utf8'));
const idols = JSON.parse(readFileSync('public/data/idols.json','utf8'));
const withRows = new Set();
for (const i of idols) for (const g of (i.group_history||[])) for (const s of (g.status_history||[]))
  if (s.kind==='scandal') withRows.add(g.group_name);
const linked = groups.filter(g => String(g.notes||'').includes('neverless_article:'));
console.log('linked groups:', linked.length);
console.log('linked but no scandal row:', linked.filter(g => !withRows.has(g.name)).map(g => g.name).slice(0,40));
"
```

Off-ladder scores that need a human pass:

```powershell
node --input-type=module -e "
import { readFileSync } from 'fs';
const idols = JSON.parse(readFileSync('public/data/idols.json','utf8'));
for (const i of idols) for (const g of (i.group_history||[])) for (const s of (g.status_history||[]))
  if (s.kind==='scandal' && ![1,2,3,4,5].includes(Number(s.score)))
    console.log(Number(s.score), i.name, g.group_name, s.start_date, String(s.summary_ja||'').slice(0,60));
"
```

## Long-summary cleanup

Some scraped rows carry a truncated wall of wiki prose ending in `…` (the LEO /
CHICKEN BLOW THE IDOL row is ~400 chars). Rewrite those to one or two tight sentences;
the full text belongs on the wiki, not in the save data.
