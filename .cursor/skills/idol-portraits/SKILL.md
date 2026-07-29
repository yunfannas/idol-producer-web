---
name: idol-portraits
description: >-
  Fill and date idol portraits for main and scenario catalogs. Prefer dated
  jpop.fandom gallery stills over X/unavatar avatars, wire group_portrait_history
  with effective_date for era switches (e.g. Akishibu → LAST SCENE), convert
  WebP-as-jpg via ffmpeg, and resolve portraits as-of the game/reference date.
  Use when fetching missing portraits, fixing wrong faces, or adding
  group-era portrait history.
---

# Idol portraits

## Source preference (do not skip)

| Priority | Source | When |
|----------|--------|------|
| **1 — preferred** | **Dated Fandom gallery still** on [jpop.fandom.com](https://jpop.fandom.com) (e.g. `Koga_Mirei_Dec_2024_(1).jpg`) | Group-era / scenario opening looks |
| 2 | Official group profile page still | If Fandom has no dated shot for that era |
| 3 | X profile photo (`pbs.twimg.com`, drop `_normal`) | Last resort / current-era only when no Fandom still exists |
| Avoid | Tiny unavatar placeholders, random handle guesses, undated stub WebP | Wrong person / useless thumbs |

**Prefer Fandom dated pictures** whenever the filename or caption encodes a month/year that matches the tenure you need (Akishibu-era → Dec 2024 Akishibu gallery shot, not the later LAST SCENE X avatar).

## Fetch Fandom images (Cloudflare)

Wiki HTML/`Special:FilePath` often returns **403**. Use the MediaWiki API instead:

```bash
# Resolve File:… → static.wikia.nocookie.net URL
https://jpop.fandom.com/api.php?action=query&titles=File:NAME.jpg&prop=imageinfo&iiprop=url|size|mime&format=json
```

Then `fetch` the `imageinfo[0].url`. Fandom often serves **WebP bytes** with a `.jpg` URL — always verify magic/`ffprobe` and convert:

```bash
ffmpeg -y -i input.bin -q:v 2 "public/data/pictures/idols/<basename>.jpg"
ffprobe -v error -select_streams v:0 -show_entries stream=codec_name,width,height -of csv=p=0 out.jpg
# Expect: mjpeg|jpeg, useful width (not 267×178 stubs)
```

## Storage & JSON

- Files live flat in `public/data/pictures/idols/` — **basename only** matters for the web loader (`src/ui/portraitUrl.ts`).
- JSON paths may keep desktop form: `fetcher\database\picture_fandom\<basename>`.
- Naming:
  - Primary / opening baseline: `<名前>_portrait.jpg`
  - Era shot: `<名前>__<GroupKey>_YYYY-MM-DD_fandom.jpg` (use `fandom` in the suffix when from Fandom)

Update **both** when Scenario 6 is in scope:

- `public/data/idols.json`
- `public/data/scenarios/scenario_6/idols.json`

## `group_portrait_history` (era switches)

Use `support/scripts/groupPortraitHistory.mjs` (`upsertGroupPortraitHistory`) or equivalent:

```json
"group_portrait_history": {
  "アキシブproject": [{
    "path": "fetcher\\database\\picture_fandom\\…_Akishibu_…_fandom.jpg",
    "effective_date": "2024-12-01",
    "source": "fandom",
    "label": "…",
    "note": "…"
  }],
  "ラストシーン": [{
    "path": "fetcher\\database\\picture_fandom\\…_LAST_SCENE_…jpg",
    "effective_date": "2025-12-13",
    "source": "x_profile",
    "label": "…",
    "note": "…"
  }]
}
```

- Key by **Japanese name**, `group_uid`, and common romanji/English aliases the history already uses.
- `effective_date` = when that look becomes valid (gallery month ≈ mid-month day is fine; join/debut day for transfers).
- Set `portrait_photo_path` to the **scenario-opening** still (usually the earlier Fandom shot), not the newest era.

Runtime: `idolPortraitPublicSrc(row, asOfIso)` picks the newest history entry with `effective_date <= asOfIso`. Always pass the browse/save reference date from UI call sites.

## Post-opening group switches (Scenario 6)

Opening date is **`2025-07-05`**. Idols who **leave or join** after that need the same era treatment as 古賀みれい:

1. **Audit** (scenario `idols.json`): allowlist members active @ opening with any `group_history.start_date > opening` or `end_date > opening`.
2. **Priority = true switches** (join a new group after opening), especially allowlist @ opening → later group. Pure graduates (leave only, no next group in DB) are lower priority unless the primary portrait is clearly the wrong era.
3. For each switch: Fandom **dated** still for the **opening-era group** (`effective_date` ≤ opening) + dated still for the **new group** (`effective_date` = join/debut).
4. Set `portrait_photo_path` to the opening-era file; never only the newest look.
5. Smoke: `asOf=2025-07-05` → early still; `asOf=switch date` → new still.

Known done examples: 古賀みれい (Akishibu→LAST SCENE), 高坂りん (ZUTTOMOTTO→ハルカエコー), 平沢かえ (Akishibu→ハルカエコー), 恋星はるか (のんふぃく！→iLiFE!), 恋春ねね (iON!→iLiFE!).

Helper scratch scripts (not product): `support/tmp/find_post_opening_transfers.mjs`, `support/tmp/probe_transfer_fandom.mjs`, `support/tmp/apply_transfer_era_portraits.mjs`.

## Checklist

1. Prefer a **dated Fandom** still for the target era; confirm person + outfit/group context.
2. Download via **API URL**, convert to real JPEG if WebP.
3. Write file(s) under `public/data/pictures/idols/`.
4. Patch main (+ scenario) idol row: `portrait_photo_path` + dated `group_portrait_history`.
5. Smoke: as-of opening date → early still; as-of transfer/debut → later still.
6. If you touched scenario rosters too, run scenario DB integrity (`scenario-db-integrity` skill).
7. After filling one transfer, re-scan for other post-`2025-07-05` switches still missing multi-date history.