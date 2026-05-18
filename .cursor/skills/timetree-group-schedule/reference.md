# Group schedule collection — reference

## Source decision

```
Has official /schedule/list/YYYY/M/ ?
  ├─ YES → scrape lives + メディア from site (upper tier)
  │         └─ also check TimeTree if linked from SNS
  └─ NO  → TimeTree public calendar pipeline (HEROINES / indie)
```

## Official site schedules (upper tier)

### ＝LOVE (Equal Love)

| Item | Value |
|------|--------|
| Base | https://equal-love.jp/schedule/ |
| Month URL | `https://equal-love.jp/schedule/list/{year}/{month}/` |
| Filter example | `?cat=L_ALL,live02,live03,live04,live05,live06,live07` |
| July 2025 | [schedule/list/2025/7](https://equal-love.jp/schedule/list/2025/7/?cat=L_ALL,live02,live03,live04,live05,live06,live07) |

**Page structure:** one block per day; each line prefixed with category (`メディア`, `ライブ/イベント`, …), then title; member suffix `※名前` or `※＝LOVE`.

**Example rows (2025-07-12):**

- `ライブ/イベント` — ＝LOVE ARENA TOUR 2025「～Timeless Tales～」追加公演 **東京都・有明アリーナ** → `Concert`, venue `有明アリーナ`
- `メディア` — TBS「ラヴィット！」※佐々木舞香 → `Media`, no venue

**Sister groups:** ≠ME, ≒JOY — same site family; confirm each official domain and schedule path before scraping.

### Proposed normalized row (official)

```json
{
  "date": "2025-07-12",
  "event": "＝LOVE ARENA TOUR 2025「～Timeless Tales～」追加公演",
  "source": "official",
  "source_url": "https://equal-love.jp/schedule/list/2025/7/",
  "site_category": "ライブ/イベント",
  "type": "Concert",
  "venue": "有明アリーナ",
  "venue_hint": "東京都・有明アリーナ",
  "members": ["＝LOVE"]
}
```

```json
{
  "date": "2025-07-08",
  "event": "TBS「ラヴィット！」",
  "source": "official",
  "site_category": "メディア",
  "type": "Media",
  "venue": null,
  "members": ["佐々木舞香"]
}
```

**Storage:** `public/data/official_schedules/{group_key}-{from}-{to}.json`

```bash
npm run calendar:official-schedule -- equal-love 2025-07 2026-05 --create-venues
```

Config: `public/data/reference/official_schedule_groups.json`

**Live catalog:** ingest only physical types (`Concert`, `Festival`, `Taiban`, `Birthday`, `Tokutenkai`, `Meet` if needed). **Skip `Media`** (same as TimeTree).

---

## TimeTree — onboarding checklist (copy per group)

- [ ] Find `{slug}` on [timetreeapp.com/public_calendars](https://timetreeapp.com/public_calendars)
- [ ] Add slug → `groups.json` name in `public/data/reference/timetree_group_slugs.json`
- [ ] `npm run calendar:timetree-range -- {slug} {from} {to}`
- [ ] `calendar:timetree-enrich` → `calendar:timetree-venues --create-venues`
- [ ] `data:multi-venue-festivals` (add new circuits to `multiVenueFestivals.mjs` first if needed)
- [ ] Poster OCR only if gap report shows image-only rows
- [ ] `data:venues-csv` → edit capacities → `data:venues-csv-import`
- [ ] **`npm run data:live-catalog`** (after every group or batch)
- [ ] Optional: `SOURCE_CONFIGS` + `data:managed-live-schedules`
- [ ] Gap report → **0** physical lives without venue

## Groups collected (example range 2025-07 → 2026-05)

| Group | Source | Id / file |
|-------|--------|-----------|
| アキシブproject | TimeTree | `akishibu` → `timetree/akishibu-2025-07-2026-05.json` |
| iLiFE! | TimeTree | `ilife_official` → `timetree/ilife_official-2025-07-2026-05.json` |
| ＝LOVE | Official site | `equal-love` → *(planned)* `official_schedules/equal-love-2025.json` |
| *(next HEROINES)* | TimeTree | `{slug}` → `timetree/{slug}-2025-07-2026-05.json` |
| *(next major)* | Official | `{domain}` → `official_schedules/…` |

## Gap report (one group)

From project root — counts **physical lives** still missing `venue` (excludes Media, Cancelled, Virtual, Promo, placeholders):

```bash
node -e "
import { readFileSync } from 'fs';
import { isPlaceholderLiveTitle, isVirtualLiveEvent, isCommercialPromoEvent } from './scripts/timetreeEventParse.mjs';
import { isImageOnlyLive } from './scripts/timetreePosterExtract.mjs';
const file = process.argv[1];
const e = JSON.parse(readFileSync(file,'utf8')).events ?? [];
const skip = r => isPlaceholderLiveTitle(r.event) || isVirtualLiveEvent(r) || isCommercialPromoEvent(r) || ['Media','Cancelled'].includes(r.type);
const physical = e.filter(r => !skip(r));
const noVenue = physical.filter(r => !r.venue);
const ocr = e.filter(isImageOnlyLive);
console.log(file);
console.log('  physical lives:', physical.length);
console.log('  without venue:', noVenue.length);
noVenue.forEach(r => console.log('   -', r.date, r.type, r.event));
console.log('  poster-OCR queue:', ocr.length);
ocr.forEach(r => console.log('   -', r.date, r.event));
" public/data/timetree/ilife_official-2025-07-2026-05.json
```

Swap the file path for each group. **Done** when `without venue: 0` and `poster-OCR queue: 0`.

## Event types (`type` / `event_type`)

| Type | Meaning |
|------|---------|
| `Concert` | 単独・ワンマン・武道館公演など |
| `Taiban` | 対バン・2MAN・HEROINES 系 |
| `Festival` | フェス・合戦 · may be `multi_venue_festival` |
| `Birthday` | 生誕祭 |
| `Tokutenkai` | 翌日/後日特典会 (post-concert fan meet) |
| `Meet` | Same-day 特典会 after a live |
| `Media` | TV・配信・リリース |
| `Virtual` | Online-only (Life Like a Live!, zan-live, オンラインサイン会) |
| `Promo` | Store collab / campaign window (Round1, 〜まで) |
| `Other` / `Cancelled` | Misc / cancelled |

Classifier: `scripts/timetreeEventParse.mjs`.

## Skip rules (not live gaps)

| Helper | Catches |
|--------|---------|
| `isPlaceholderLiveTitle` | `LIVE予定`, `ライブ予定`, `…イベント予定` |
| `isVirtualLiveEvent` | オンライン / online, Life Like a Live!, zan-live.com, バーチャル |
| `isCommercialPromoEvent` | Round1×コラボ, キャンペーン開始（〜まで）, 全店コラボ, ライブ・特典会なし PR |

## Normalized event (range file)

```json
{
  "date": "2025-09-20",
  "event": "バンドじゃないもん！MAXX NAKAYOSH pre.「NAKAYOSHI FES.2025」",
  "timetree_id": "2790041378255903209",
  "timetree_url": "https://timetr.ee/p/ilife_official/2790041378255903209",
  "type": "Festival",
  "venue_mode": "multi_venue_festival",
  "venue_area": "渋谷",
  "venue": "渋谷（複数会場フェス）",
  "venues": ["Spotify O-EAST", "Spotify O-WEST", "Spotify O-nest", "duo MUSIC EXCHANGE", "WOMBLIVE", "clubasia"],
  "venue_uid": null,
  "poster_urls": ["https://attachments.timetreeapp.com/…"]
}
```

## Multi-venue festivals

Canonical halls: **`scripts/multiVenueFestivals.mjs`** (NEO KASSEN, UP GATE, SWEET SUMMER, NAKAYOSHI FES, …).

```bash
npm run data:multi-venue-festivals -- public/data/timetree/{slug}-{from}-{to}.json
```

When a **new** circuit fest appears, add a `liveMatchKey` entry (date + normalized title from `liveCatalogMatch.mjs`), then apply to every group range file that lists that show.

## Live events catalog

Built from **all** `public/data/timetree/*-{YYYY-MM}-{YYYY-MM}.json` files listed in `timetree_group_slugs.json`.

```json
{
  "match_key": "2025-07-14|heroines league i",
  "date": "2025-07-14",
  "venue": "豊洲PIT",
  "attending_groups": [
    { "group_name": "アキシブproject", "timetree_slug": "akishibu" },
    { "group_name": "iLiFE!", "timetree_slug": "ilife_official" }
  ]
}
```

Second group on the same show inherits venue if the first calendar already resolved it.

## Register slug (`timetree_group_slugs.json`)

```json
{
  "_comment": "TimeTree public_calendar slug → canonical group name in groups.json",
  "slugs": {
    "akishibu": "アキシブproject",
    "ilife_official": "iLiFE!",
    "example_slug": "Group Name Exactly As In groups.json"
  }
}
```

## Managed schedules (`buildManagedLiveScheduleDb.mjs`)

Add to `SOURCE_CONFIGS`:

```javascript
{
  sourceKey: "short-key",
  label: "Group TimeTree",
  rawFile: "slug-2025-07-2026-05.json",
  groupUid: "…from groups.json…",
  aliases: ["Display Name", "slug"],
},
```

Then `npm run data:managed-live-schedules`.

## Poster OCR files

| File | Purpose |
|------|---------|
| `docs/reference/timetree_poster_ocr/{slug}-poster-ocr-review.json` | Machine output |
| `…-review.csv` | Edit `reviewer_venue`, `reviewer_notes` |
| `…-review.md` | Human review with images |

Import uses **`reviewer_venue`** at review root (not nested `extracted`).

## npm commands

```bash
npm run calendar:timetree-range -- {slug} 2025-07 2026-05
npm run calendar:timetree-enrich -- public/data/timetree/{slug}-2025-07-2026-05.json
npm run calendar:timetree-venues -- public/data/timetree/{slug}-2025-07-2026-05.json --create-venues
npm run data:multi-venue-festivals -- public/data/timetree/{slug}-2025-07-2026-05.json
npm run data:live-catalog
npm run data:managed-live-schedules
npm run data:venues-csv
npm run data:venues-csv-import
```

Windows: quote months `"2025-07"` `"2026-05"`; chain with `;` not `&&`.
