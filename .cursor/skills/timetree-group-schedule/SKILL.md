---
name: timetree-group-schedule
description: >-
  Collects idol group schedules from TimeTree public calendars (HEROINES-tier) or
  official site schedule pages (upper-tier, e.g. =LOVE equal-love.jp with メディア).
  Use for slug discovery, scrape, enrich, venues, multi-venue festivals, poster OCR,
  live catalog, and onboarding new groups.
---

# Group schedule collection

## Two sources (pick per group)

| Tier | Typical source | Lives + venues | Media / TV / radio |
|------|----------------|----------------|---------------------|
| **HEROINES / indie** | [TimeTree](https://timetreeapp.com/public_calendars) public calendar | Primary pipeline below | Often in same TimeTree feed (`type: Media`) |
| **Upper / major** | **Official site** monthly schedule | `ライブ/イベント` rows, venue in title | **`メディア`** category — dense TV/radio/web (see below) |

Do **not** expect every group to have TimeTree. Upper-tier groups (e.g. **＝LOVE**) publish a full calendar on their own site, including media that never appears on underground TimeTrees.

### Official site example: ＝LOVE

Monthly schedule (category filters in query string):

`https://equal-love.jp/schedule/list/{year}/{month}/?cat=L_ALL,live02,live03,live04,live05,live06,live07`

Example: [＝LOVE schedule — July 2025](https://equal-love.jp/schedule/list/2025/7/?cat=L_ALL,live02,live03,live04,live05,live06,live07)

On-page categories (map to our `type` when ingesting):

| Site label | Our `type` | In `live_events_catalog`? |
|------------|------------|---------------------------|
| ライブ/イベント | Concert / Festival / Taiban (parse title) | Yes (if venue resolved) |
| 握手会 | Meet | Optional / reference |
| メディア | **Media** | No — keep for reference / game media sim |
| リリース | Media or Promo | No |
| 誕生日 | Birthday | Yes if it is a 生誕祭 live |
| その他 | Other / Promo | Usually no |

Sister groups under the same agency often share this layout (≠ME, ≒JOY on [equal-love.jp](https://equal-love.jp/) navigation). Discover each group’s **`/schedule/list/YYYY/M/`** URL from their official domain.

**Scraper (implemented):**

```bash
npm run calendar:official-schedule -- equal-love 2025-07 2026-05 --create-venues
```

Writes **`public/data/official_schedules/equal-love-2025-07-2026-05.json`**. Config: `public/data/reference/official_schedule_groups.json`.

---

## TimeTree path — goal

Build **`public/data/timetree/{slug}-{from}-{to}.json`** per group, resolve venues, then merge **physical lives** into **`public/data/live_events_catalog.json`**. Repeat for each group in the same date range so shared festivals get one `attending_groups[]` row.

**Media on TimeTree** stays in the range JSON (`type: Media`) but is **excluded** from the live catalog and venue-gap counts — same rule as official-site メディア.

## Where data lives

| Layer | Path | Role |
|-------|------|------|
| **Per-group source** | `public/data/timetree/{slug}-{from}-{to}.json` | Source of truth per calendar |
| **Cross-group catalog** | `public/data/live_events_catalog.json` | All `*-{from}-{to}.json` merged |
| **Venues** | `public/data/venues.json` (+ `src/engine/data/venues.json`) | capacity, indoor/outdoor, city |
| **Slug map** | `public/data/reference/timetree_group_slugs.json` | slug → name in `groups.json` |
| **Managed schedules** | `public/data/managed-live-schedules/groups/*.json` | Optional; needs `SOURCE_CONFIGS` entry |

## Add a new group — which source?

1. Check **official site** → `/schedule/` or `/schedule/list/` monthly pages. If present, plan **official + TimeTree** (if any) separately.  
2. Else search **TimeTree** `site:timetreeapp.com/public_calendars {group}`.  
3. Register group name in **`timetree_group_slugs.json`** (TimeTree) and/or a future **`official_schedule_groups.json`**.

---

## TimeTree — add a group (checklist)

### 1. Find the TimeTree slug

Public URL shape:

`https://timetreeapp.com/public_calendars/{slug}?monthly=YYYY-MM-01`

Ways to find `{slug}`:

- Official site / X link to `timetreeapp.com/public_calendars/…` or `timetr.ee/p/…`
- Web search: `site:timetreeapp.com/public_calendars {group name}`
- HEROINES sister groups often use romanized or short ids (e.g. `akishibu`, `ilife_official`)

### 2. Register the slug

Edit **`public/data/reference/timetree_group_slugs.json`**:

```json
{
  "slugs": {
    "akishibu": "アキシブproject",
    "ilife_official": "iLiFE!",
    "new_slug": "Exact name from groups.json"
  }
}
```

The value must match **`public/data/groups.json`** `name` (used by live catalog and merges).

### 3. Run the pipeline

From project root (`npm install playwright` once, then `npx playwright install chromium`):

```bash
# Replace NEW_SLUG, FROM, TO (e.g. 2025-07 2026-05)
npm run calendar:timetree-range -- NEW_SLUG FROM TO

npm run calendar:timetree-enrich -- public/data/timetree/NEW_SLUG-FROM-TO.json

npm run calendar:timetree-venues -- public/data/timetree/NEW_SLUG-FROM-TO.json --create-venues

npm run data:multi-venue-festivals -- public/data/timetree/NEW_SLUG-FROM-TO.json

npm run data:live-catalog
```

**Always run `data:live-catalog` after each new group** so shared shows (NEO KASSEN, HEROINES LEAGUE, etc.) merge venues from calendars already ingested.

### 4. Close venue gaps

```bash
# Poster OCR only if image-only lives remain (see gap report below)
npm run calendar:timetree-ocr-review -- public/data/timetree/NEW_SLUG-FROM-TO.json

# Capacities for new venue stubs
npm run data:venues-csv
# edit docs/reference/venues_capacity.csv
npm run data:venues-csv-import
```

Add new **multi-hall festivals** to `scripts/multiVenueFestivals.mjs` when OCR or official site lists several halls (circuit style), then re-run `data:multi-venue-festivals` on affected range files.

### 5. Optional: managed live schedules

To export game-style schedule JSON under `public/data/managed-live-schedules/`, add an entry to **`SOURCE_CONFIGS`** in `scripts/buildManagedLiveScheduleDb.mjs` (group `uid`, aliases), then:

```bash
npm run data:managed-live-schedules
```

## Collect multiple groups (same range)

Use the **same `FROM` and `TO`** for every group in a season so the catalog aligns.

```bash
npm run calendar:timetree-range -- akishibu 2025-07 2026-05
npm run calendar:timetree-range -- ilife_official 2025-07 2026-05
# npm run calendar:timetree-range -- OTHER_SLUG 2025-07 2026-05

for each public/data/timetree/*-2025-07-2026-05.json:
  npm run calendar:timetree-enrich -- <file>
  npm run calendar:timetree-venues -- <file> --create-venues
  npm run data:multi-venue-festivals -- <file>

npm run data:live-catalog
```

On Windows PowerShell, run enrich/venues per file (no `for` loop), or use `;` between commands.

## What NOT to count as a live gap

Scrape, catalog, managed schedules, and poster OCR **skip**:

| Skip | Examples |
|------|----------|
| Placeholders | `ライブ予定`, `LIVE予定`, `大阪LIVE予定`, `…イベント予定` |
| Virtual / オンライン | Life Like a Live!, `zan-live.com`, **オンライン**サイン会 — no venue |
| Promo | `ラウンドワン×…コラボ(~6/7まで)`, キャンペーン開始（〜まで）, 全店コラボ |
| Media / Cancelled | TV, 配信, 発売日, 開催中止 — includes official-site **メディア** when ingested |

Helpers in `scripts/timetreeEventParse.mjs`: `isPlaceholderLiveTitle`, `isVirtualLiveEvent`, `isCommercialPromoEvent`.

**Media is still valuable** for upper-tier groups (workload, simulation flavor) — store it in the per-group schedule file, but do **not** treat missing venues on Media rows as live gaps.

## Event types (physical lives)

`Concert`, `Taiban`, `Festival`, `Birthday`, `Tokutenkai` (翌日/後日特典会), `Meet` (same-day 特典会). See [reference.md](reference.md) for full table.

## Venue resolution order

1. API — `location_name`, `@ venue` in `note` or title  
2. `calendar:timetree-venues` — detail page + `live_events_catalog.json` reuse  
3. `multiVenueFestivals.mjs` — known circuit fests  
4. Poster OCR — `reviewer_venue` in CSV → import  
5. `venues.json` — `--create-venues` stubs (`capacity: null` until CSV import)

## Poster OCR

```bash
npm run calendar:timetree-ocr-review -- public/data/timetree/{slug}-{from}-{to}.json
node scripts/timetree_poster_ocr_csv.mjs export docs/reference/timetree_poster_ocr/{slug}-poster-ocr-review.json
# edit reviewer_venue in CSV
npm run calendar:timetree-ocr-csv-import
npm run calendar:timetree-venues -- public/data/timetree/{slug}-{from}-{to}.json
npm run data:live-catalog
```

Tesseract: `createWorker("jpn")` only on Windows.

## Guardrails

- Public calendars only; ~400 ms between detail fetches.  
- Commit **`{slug}-{from}-{to}.json`**, not monthly shards.  
- Review new venue stubs and set capacity in `venues_capacity.csv`.  
- PowerShell: use `;` not `&&`.

## See also

- [reference.md](reference.md) — gap report one-liner, field shapes, commands
