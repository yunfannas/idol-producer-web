---
name: idol-scandal-history
description: >-
  Scrape and merge idol scandal / health / injury / hiatus history from Seesaa Wiki
  アイドル走り書き (neverless) into public/data/idols.json status_history rows, with
  canonical scandal scores (1.0-5.0), member-tenure matching, and provenance.
  Use for single-group wiki sync, full-corpus passes over every group, scandal score
  auditing, or wiring scandal data into the web engine (termination fee, attributes,
  scenario future events).
---

# Idol scandal history from アイドル走り書き (neverless)

Source of truth: **https://seesaawiki.jp/neverless/** — a Japanese indie-idol wiki that
documents 事件・事故・スキャンダル per group. Pages are **EUC-JP** encoded with
percent-encoded EUC-JP slugs.

Treat the wiki as a **secondary aggregator** (it cites 文春オンライン, official X, etc.).
Prefer neutral factual Japanese in `summary_ja`; never add unsourced allegations.

## Workflow (required order)

Always finish **Phase 1** before writing JSON. Never invent Phase 2 rows that were not
listed in Phase 1.

### Phase 1 — Extract the exact event list

1. Resolve and fetch the group's article URL (see **Resolving article URLs**).
2. Read **事件・事故・スキャンダル** (and **運営その他** only when it names identifiable members).
3. Produce a deterministic table, one row per `status_history` object you intend to write:

| `#` | `member_name` | `wiki_year_month` | `start_date` (ISO) | `kind` | `score` | `summary_ja` |
|-----|---------------|-------------------|--------------------|--------|---------|--------------|

For `kind: health` / `injury`, add **`illness_type`** and **`duration`** columns.

Date rules:
- Wiki gives **年月のみ** → `YYYY-MM-01`. Never fabricate a precise day.
- Ambiguous follow-ups (「翌日」「約1カ月後」) → earliest defensible anchor.

Grouping rules:
- Same incident across multiple bullets → **one row**.
- A later separate 処分 / 転機 → **separate row**.

4. Pause and flag any row that has no plausible `member_name` or overlaps no
   `group_history` stint (**skip**, **split**, or ask).

### Phase 2 — Merge into `public/data/idols.json`

1. Find the idol by `name` (or `past_names` / `group_history[].member_name`).
2. Pick the **`group_history` entry** whose `group_name` matches the article and whose
   `start_date` / `end_date` bracket the event date (empty `end_date` = current).
3. Append to that entry's **`status_history`** array. Dedupe on
   `(kind, start_date, summary_ja[:80])`.
4. Set `source_label` + `source_url` on every row.
5. Append `neverless_wiki` to `data_sources[]` and refresh `last_updated` on touched idols.
6. Run **Validation**.

Scenario snapshots (`public/data/scenarios/scenario_6/idols.json`) are regenerated
**only when asked** — see **Target files**.

## Where rows live (critical)

`status_history` is **nested inside `group_history[]`**, not top-level on the idol:

```json
{
  "name": "LEO",
  "group_history": [
    {
      "group_name": "CHICKEN BLOW THE IDOL",
      "start_date": "2017-04-01",
      "end_date": "2018-07-01",
      "status_history": [
        {
          "kind": "scandal",
          "start_date": "2018-07-01",
          "score": 5,
          "summary_ja": "2018年7月、LEOを解雇。",
          "source_label": "アイドル走り書き（CHICKEN BLOW THE IDOL）",
          "source_url": "https://seesaawiki.jp/neverless/d/%a4%bd%a4%ce61"
        }
      ]
    }
  ]
}
```

### Event object fields

| Field | Required | Meaning |
|-------|----------|---------|
| `kind` | yes | `scandal`, `health`, `injury`, `hiatus`, `other` |
| `start_date` | yes | `YYYY-MM-DD`, primary sort/display date |
| `end_date` | no | Hiatus/injury/health window end when stated |
| `score` | scandal only | Float **1.0-5.0**, see ladder below |
| `summary_ja` | yes | One or two tight factual Japanese sentences |
| `source_label` | yes | `アイドル走り書き（<group name>）` |
| `source_url` | yes | Full HTTPS article URL |
| `illness_type` | health/injury | Short canonical English label (`COVID-19`, `pneumothorax`, `leg fracture`) |
| `duration` | health/injury | `2 weeks`, `10 days` — match how the source states it |
| `evidence_url` | no | Official notice used for `duration` / `end_date` |

## Scandal score ladder (canonical)

| Score | Meaning |
|-------|---------|
| **1.0** | Inappropriate / ill-judged SNS post |
| **2.0** | Photo leak later confirmed **not** a scandal; conflict with teammates |
| **3.0** | Photo leak suggesting a **potential** scandal |
| **4.0** | Rules violation or past scandal revealed, **not** fired |
| **5.0** | Rules violation / major scandal, **fired** (incl. forced graduation, contract termination) |

Pick the **dominant outcome** — if they were not dismissed, cap at 4.0. Use half steps
only on explicit request. See [reference.md](reference.md) for the Japanese keyword
heuristics used to classify `kind` and seed `score`.

## Resolving article URLs

1. **Index harvest** — fetch `https://seesaawiki.jp/neverless/`, take every link whose
   path contains `/neverless/d/`, normalize to
   `https://seesaawiki.jp/neverless/d/<slug>`, and key it by normalized link text
   (NFKC, lowercase, strip spaces, `！`→`!`).
2. **Exact normalized match** against `groups.json` `name`; also try dropping `!` and
   swapping `project` ↔ `プロジェクト`.
3. **Slug probe** — EUC-JP percent-encode the name
   (アキシブproject → `%a5%a2%a5%ad%a5%b7%a5%d6project`), then `HEAD`/`GET` for 200.
4. **Shared pages** — some articles cover several groups (the `=LOVE` page also hosts
   ≠ME / ≒JOY). Bind `source_url` to that page and restrict Phase 1 to the matching
   subsection.
5. **Failure** → log `SKIP: <group name>` with a reason. Never fabricate a URL.

Do **not** fuzzy substring-match; that maps many groups onto one composite page.

## Full-corpus pass (every group)

1. Load `public/data/groups.json`; per group collect `uid`, `name`, `member_names`,
   `past_member_names` as the candidate name set.
2. Harvest the index once (**Resolving article URLs** step 1).
3. Process groups in **user-approved batches of 25-50**, Phase 1 → Phase 2 per group.
4. Checkpoint **Validation** every ~10 groups so diffs stay reviewable.
5. Optionally append one idempotent provenance line to the group's `notes`:
   `neverless_article: <url>` (skip if that substring already exists; never strip notes).

Only accept a row when the member name appears in the same sentence block **and** is
plausibly in that group's roster (current or past).

## Automation

A working batch scraper exists in the sibling desktop repo:

```powershell
cd H:\Qsync\Project\idol_producer
python scripts\sync_neverless_all_groups.py --dry-run --delay 0.35
python scripts\sync_neverless_all_groups.py --delay 0.35
```

It harvests the index, resolves slugs, extracts 年月-anchored chunks, matches members
against rosters, classifies `kind` / `score`, and merges deduped rows into
`database/idols.json`. Cache and log land under `database/updates/`.

That script targets **desktop `database/*.json`**. For this repo, either port it to
`support/tmp/` writing `public/data/idols.json`, or run it there and re-export. Keep the
conservative heuristics — they exist to avoid attributing incidents to the wrong member.

## Target files

| Path | Role |
|------|------|
| `public/data/idols.json` | **Primary** output (7,034 idols; 181 scandal rows today) |
| `public/data/groups.json` | Optional `notes` provenance line |
| `public/data/scenarios/scenario_6/idols.json` | Startup snapshot — regenerate only on request (21 scandal rows) |

## How the web engine consumes this

| Consumer | File | Reads |
|----------|------|-------|
| Future scandal events | `src/engine/scenarioRuntimeWeb.ts` `filterEntryTimeline` | **nested** `group_history[].status_history`, `kind === "scandal"` → `idol_status_update` future event |
| Managed scandal decision | `src/engine/scandalHandling.ts` + `resolveManagedScandalChoices` | Catalog `public/data/reference/scandal_handlings.json`; inbox choice `managed_scandal_handling` |
| NPC auto handling | `autoApplyHistoricalScandalHandling` | e.g. demote leader when historical_action is `demote_leader` (keep-with-heavy-penalty class) |
| Termination fee | `src/main.ts` `terminationFeeYen` / `activeScandalLevel` | nested scandals + `score` → level (5→3 free terminate) |
| Attribute penalties | `src/engine/idolAttributes.ts` `scandalHistoryCount` | nested scandal count |

### Scandal handling as event triggers

When the player manages the affected group, a due scandal opens **Scandal handling**
instead of a passive news ack. Catalog rows encode real-life responses (iLiFE! Budokan
2025: 那蘭のどか `terminate_after_live`, 心花りり `demote_leader` (= keep with heavy
penalty via leader demotion); 高嶺のなでしこ:
春野莉々 indefinite `suspend_activities` then major `follow_on_leave` decision
on 2025-07-31 (leave before any return date); 籾山ひめり timed `suspend_activities`
(suspend for some time → return 2026-02-14)).
Scandal-linked leaves skip the parallel Departure negotiation (`scandal_before_leave`
on the leave event), except post-indefinite-suspension leaves which open a major
managed decision instead.

**Gameplay consequences (managed group only)** — each choice hits:
- cash (PR / crisis spend)
- group + idol fans, group popularity
- self + teammate morale
- optional salary cut and timed `scandal_penalty` (live form + tokutenkai sales mult)
- roster / role effects (immediate exit, exit after live, demote leader, timed or
  indefinite activity suspension, keep)

Example catalog: `public/data/reference/scandal_handlings.json`.

## Validation

```powershell
node -e "const d=require('./public/data/idols.json');console.log('OK',d.length)"
```

Coverage / shape audit:

```powershell
node --input-type=module -e "
import { readFileSync } from 'fs';
const idols = JSON.parse(readFileSync('public/data/idols.json','utf8'));
let rows=0, scandals=0, bad=[];
for (const i of idols) for (const g of (i.group_history||[])) for (const s of (g.status_history||[])) {
  rows++;
  if (s.kind==='scandal') {
    scandals++;
    if (s.score==null || s.score<1 || s.score>5) bad.push(i.name+' '+s.start_date);
    if (!s.source_url) bad.push(i.name+' missing source_url');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s.start_date||''))) bad.push(i.name+' bad date');
}
console.log({rows, scandals, problems: bad.slice(0,20)});
"
```

Check that every scandal row has `score` in range, a `source_url`, an ISO `start_date`,
and sits on a stint whose dates bracket the event.

## Guardrails

- Public wiki pages only; **~350 ms** delay between fetches.
- Decode as **EUC-JP**, not UTF-8.
- Never fabricate calendar days, durations, or dismissal outcomes.
- Never copy long paragraphs — one or two sentences.
- Never attach a row to the wrong `group_uid` / tenure slice.
- PowerShell: use `;` not `&&`.

## See also

- [reference.md](reference.md) — `kind` / `score` keyword heuristics, current coverage, field notes
- Original desktop skill: `H:\Qsync\Project\idol_producer\.cursor\skills\idol-neverless-history\SKILL.md`
- Batch scraper: `H:\Qsync\Project\idol_producer\scripts\sync_neverless_all_groups.py`
