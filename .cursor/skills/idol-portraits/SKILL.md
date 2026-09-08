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
| **1 — preferred** | **Dated Fandom gallery still**, automatically resolved from Fandom filename group/date tags | Group-era / scenario opening looks |
| 2 | Official group profile page still | Normal fallback; required when Fandom cannot be resolved |
| 3 | X profile photo (`pbs.twimg.com`, drop `_normal`) | Last resort / current-era only when no Fandom still exists |
| Avoid | Tiny unavatar placeholders, random handle guesses, undated stub WebP | Wrong person / useless thumbs |

**Prefer Fandom dated pictures** whenever the filename or caption encodes a month/year that matches the tenure you need (Akishibu-era → Dec 2024 Akishibu gallery shot, not the later LAST SCENE X avatar).

## Fetch Fandom images automatically

This is an **automated resolver**, not a “paste a known static URL” workflow. Starting from the idol's Fandom page, load the gallery and extract every candidate's Fandom filename, static image URL, and displayed tag data.

Fandom gallery filenames already carry the decisive facts: **group label and image date**. Parse those tags first; they are the source evidence for `depicts_group_uid` and `fandom_date_label`. The page's group tabs are a useful browser affordance for locating the candidates, but the file-name tags—not a visual guess, current membership, face, or costume—bind the photo to a group. This makes concurrent memberships deterministic: emit one record for every requested group label, even if the two records eventually share identical image bytes.

The resolver must:

1. Open the rendered Fandom page in a browser context, enumerate gallery candidates (and group tabs when present).
2. Parse each file name/tag into a group label and date label; resolve that group label to the requested L1 group UID/alias.
3. Apply the scenario date policy below, including same-month and post-opening grace.
4. Normalize the selected static image URL to Fandom's standard 320px thumbnail, download it with redirects, inspect the bytes, then save and hash the asset.

Normalize a selected static URL as:

```text
<original-static-path-without-/revision/latest...>/revision/latest/scale-to-width-down/320
```

Save only real WebP output. The expected target is **320×213** (3:2); do not crop, stretch, upscale, or relabel a non-WebP payload. A candidate with other dimensions is rejected and the resolver continues with another filename-tagged candidate for the same group. If none qualifies, report `no_standard_ratio_candidate`.

If the runner cannot reach Fandom, return a machine-readable `source_access_blocked` result—do not silently switch to a manually supplied URL or claim no image exists. That is a runner transport defect, not a data conclusion.

The integration fixture is **[Aisu](https://jpop.fandom.com/wiki/Aisu)**. It must, without pre-downloaded files, discover her two group-labelled gallery records and produce one validated asset per group. Each output record must carry `depicts_group_uid` (or unresolved Fandom group label), `fandom_date_label`, `date_basis: "fandom_filename"`, `source_url`, `checksum_sha256`, and `320×213` dimensions.
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

1. Automatically resolve all requested Fandom gallery candidates and parse filename group/date tags.
2. Choose by group tag + scenario date; download, validate real WebP **320×213**, hash, and write one asset per group binding.
3. Write file(s) under `public/data/pictures/idols/`.
4. Patch main (+ scenario) idol row: `portrait_photo_path` + dated `group_portrait_history`.
5. Smoke: as-of opening date → correct group/era still; as-of transfer/debut → later still.
6. If the resolver reports `source_access_blocked`, fix the automated runner; do not replace the test with manually downloaded files.
7. If you touched scenario rosters too, run scenario DB integrity (`scenario-db-integrity` skill).