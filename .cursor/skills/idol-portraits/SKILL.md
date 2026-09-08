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
| **1 — preferred when URL is already resolved** | **Dated Fandom gallery still** via a known `static.wikia.nocookie.net` URL | Group-era / scenario opening looks |
| 2 | Official group profile page still | Normal fallback; required when Fandom cannot be resolved |
| 3 | X profile photo (`pbs.twimg.com`, drop `_normal`) | Last resort / current-era only when no Fandom still exists |
| Avoid | Tiny unavatar placeholders, random handle guesses, undated stub WebP | Wrong person / useless thumbs |

**Prefer Fandom dated pictures** whenever the filename or caption encodes a month/year that matches the tenure you need (Akishibu-era → Dec 2024 Akishibu gallery shot, not the later LAST SCENE X avatar).

## Fetch Fandom images (current access rule)

Do **not** depend on Fandom wiki HTML, `Special:FilePath`, or `api.php` to resolve a filename. They can return **402** (`Please contact the site owner for access`) in the current automated environment. Do not retry the same blocked endpoint or treat the missing result as evidence that the image does not exist.

A known dated `static.wikia.nocookie.net` image URL remains usable. Obtain it only from an existing source record, a previous reviewed catalog row, or a manually resolved gallery reference; otherwise use the official profile-page fallback.

If a stored URL contains `/revision/latest/scale-to-width-down/<n>`, it is an old thumbnail request. Strip the existing `/revision/latest/...` suffix, retain an optional `cb=` query, and request the standard **320px-wide** Fandom thumbnail directly. A valid 3:2 portrait source yields **WebP 320×213**; do not download the original or locally rescale it for this workflow.

```bash
# known_url may be either original or an old scale-to-width-down URL
path="${known_url%%\?*}"; query="${known_url#*\?}"
path="${path%%/revision/latest*}"
thumb="${path}/revision/latest/scale-to-width-down/320"
[ "${query}" = "${known_url}" ] || thumb="${thumb}?${query}"
curl --fail --location --retry 2 --output "public/data/pictures/idols/<basename>.webp" "${thumb}"
file "public/data/pictures/idols/<basename>.webp"
identify -format '%m %wx%h\n' "public/data/pictures/idols/<basename>.webp"
# expected: WEBP 320x213
```

Fandom may send WebP bytes under a `.jpg` pathname; the standardized thumbnail must be saved as `.webp`. Reject HTTP error/HTML/JSON bodies, dimensions other than 320×213, and any file whose identity or era cannot be confirmed. If a candidate is not a 3:2 portrait, choose another source or mark it for review; do not crop, stretch, upscale, or save it with a misleading `.jpg` suffix.

## Storage & JSON

- Files live flat in `public/data/pictures/idols/` — **basename only** matters for the web loader (`src/ui/portraitUrl.ts`).
- JSON paths may keep desktop form: `fetcher\database\picture_fandom\<basename>`.
- Naming:
  - Primary / opening baseline: `<名前>_portrait.webp`
  - Era shot: `<名前>__<GroupKey>_YYYY-MM-DD_fandom.webp` (use `fandom` in the suffix when from Fandom)

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

## Date and group-era binding

A Fandom filename/caption such as `Name_May_2024` is a source date label, not automatically an exact day. Preserve the raw label and record its basis and precision (`exact`, `month`, or `bounded`). A month-only photo is valid anywhere in that same scenario-opening month when its group membership is active at both the opening and the image date.

Visual selection defaults are `same_calendar_month_allowed: true`, `post_opening_window_days: 90`, and `stale_prior_days: 180` (scenario manifest may override them). Prefer the nearest same-group photo before/in the opening month. If no suitable earlier candidate exists or it is older than 180 days, choose the nearest suitable photo up to 90 days after opening and record `temporal_mode: post_opening_grace` plus day offset. A later transfer, join, or graduation photo never qualifies.

Every era entry for an idol must state the group it depicts and, where the L1 relation is available, the membership relation:

```json
{
  "group_uid": "g:...",
  "membership_relation_uid": "rel:...",
  "fandom_date_label": "May 2024",
  "date_basis": "fandom_filename",
  "source_date": { "precision": "month", "earliest": "2024-05-01", "latest": "2024-05-31" }
}
```

`group_portrait_history`'s Japanese-name key is legacy compatibility only. The L1/L3 association is `idol_uid + depicts_group_uid + membership_relation_uid`; do not allow a later image from another group to replace the opening-era image simply because it is newer. For concurrent memberships, retain one group-era history entry per active relation; it is valid for two records to share a binary checksum, but they must remain distinct group bindings. Call-site selection must pass the active group UID when known—an as-of date alone is insufficient to choose among concurrent group portraits.

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

1. Prefer a **dated Fandom static URL only when already resolved**; otherwise use the official-profile fallback. Confirm person + outfit/group context.
2. Download via the known static URL; reject a 402/non-image payload and normalize to real WebP.
3. Write file(s) under `public/data/pictures/idols/`.
4. Patch main (+ scenario) idol row: `portrait_photo_path` + dated `group_portrait_history`.
5. Smoke: as-of opening date → early still; as-of transfer/debut → later still.
6. If you touched scenario rosters too, run scenario DB integrity (`scenario-db-integrity` skill).
7. After filling one transfer, re-scan for other post-`2025-07-05` switches still missing multi-date history.