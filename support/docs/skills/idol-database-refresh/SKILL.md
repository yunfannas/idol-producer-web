---
name: idol-database-refresh
description: >-
  Three-track refresh: update group catalog row, update songs, update group members
  (rostermates + idol profiles). Desktop: idol_producer fetchers for groups/idols.json.
  Web: stage groups_update.json / songs_update.json then merge; members and roster
  fields patch the group row plus idols.json; auto-fill romanji for group names
  and song titles (npm run data:fill-romaji). Use for fandom sync, discography,
  coupling songs, or safe batch refresh flows.
disable-model-invocation: true
---

# Idol database refresh (idol_producer)

Canonical file in this repo: `docs/skills/idol-database-refresh/SKILL.md` (referenced elsewhere as `skills/idol-database-refresh`).

## Three update tracks

Every refresh task maps to **one or more** of these (do only what was asked):

| Track | What changes | Idol producer (desktop) | idol-producer-web |
| ----- | ----------- | ------------------------ | ------------------ |
| **1. Update group** | Group row only: names, **`name_romanji`**, urls, discs (**`title_romanji`**), publishers, **`song_uids`**, aggregates, narratives—**not** day-to-day roster lines | `database/groups.json` via Step 2 workflows | `groups_update.json` → merge → `public/data/groups.json` · then **romanji fill** (below) |
| **2. Update songs** | Per-song rows: titles, **`title_romanji`**, `albums[]`, `disc_uid`, streaming ids, coupling metadata | Songs pipeline there (outside this repo) | `songs_update.json` → merge → `public/data/songs.json` · then **romanji fill** (below) |
| **3. Update group members** | Roster ordering, current/past **names**, **member_uids**/blank slots, counts; idol-level bio/history/color | **`idols.json`** + group roster fields via Fandom/consolidate flows | **`groups_update.json`** (roster slices of the group row) + edit **`public/data/idols.json`** for idol profiles |

Tracks can run in dependency order for one group: typically **members** first if UIDs churn, **songs**/discs second, **`song_uids` & group-only fields** last—or **discography-only** touches track 1 only.

## Default approach

Prefer a single-group refresh first. Only run all-groups or large batches when the user explicitly asks for it.

The current safest entry points are:

- `fetcher/run_database_refresh.py` for the overall orchestrated refresh flow.
- `fetcher/consolidate_fandom_scrape_workflow.py` for the current Fandom -> related groups -> idol enrichment flow.

Older scripts like `fetcher/update_specific_groups_from_fandom.py` are not the default unless you need their narrow legacy behavior.

## Step 1 - Inspect scope

- Confirm the target group name in `database/groups.json`.
- Check whether the task is:
  - one-group refresh
  - one-group refresh with a known explicit fandom URL
  - batch refresh from curated inferred fandom links
  - full database refresh
- Before edits, inspect `git status` and any existing diffs in `database/groups.json`, `database/idols.json`, and `database/updates/`.

## Step 2 - Pick the right workflow

Use **Three update tracks** (see table above) to decide whether you need group-only, songs-only, member/idol, or a combination. The commands below often cover **track 1 + 3** together (Fandom scrape updates group row and member links, then idol enrichment).

### A. Preferred for one group using the latest fandom workflow

Use this when the job is mainly Fandom-based roster/profile refresh:

```bash
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME"
```

Useful variants:

```bash
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME" --skip-related-check
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME" --skip-idol-refresh
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME" --dry-run
```

What it does:

- refreshes inferred fandom links
- applies known/manual/auto fandom links into `groups.json` and `idols.json`
- optionally discovers related groups from IDOLS DIAGRAM
- visits linked member pages from the refreshed group fandom page data
- enriches idol profiles from those stored group fandom member pages into `idols.json`

This is supported as one end-to-end workflow:

- first update the group record and member links from the group page
- then follow those member-page links and update idol records accordingly

The implementation is split across separate scripts, but this is the current intended workflow.

### B. Preferred for one group when Wikipedia should also be included

Use the top-level orchestrator, but skip portraits unless the user asked for them:

```bash
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-portraits
```

Useful variants:

```bash
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-portraits --dry-run
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-fandom --skip-portraits
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-related --skip-portraits
```

### C. When the fandom URL is already known and you want a direct targeted merge

Use the lower-level updater:

```bash
python fetcher/update_groups_from_jpop_fandom.py --group-name "GROUP_NAME" --fandom-url "FANDOM_URL" --merge
```

Use this when a group is missing from normal routing, the page title differs sharply from the local group name, or you are repairing one specific fandom mapping.

### D. When working from curated inferred links in `database/updates/`

Use this after reviewing `database/updates/inferred_fandom_group_links.csv`:

```bash
python fetcher/apply_inferred_fandom_links.py --statuses manual,auto --group "GROUP_NAME"
python fetcher/enrich_idols_from_fandom_group_links.py --group "GROUP_NAME" --allowed-hosts "jpop.fandom.com,akb48.fandom.com"
```

This is the right path when the user is explicitly curating fandom link inference rows rather than asking for the full orchestrated workflow.

## Step 3 - Validate the database after refresh

Always review the resulting diff for:

- `database/groups.json`
- `database/idols.json`
- any touched files in `database/updates/`

Run idol validation after material idol changes:

```bash
python scripts/validate_idols_json.py --output logs/idols_validation_latest.json
```

Pay extra attention to:

- placeholder or heading-like idol names
- broken `group_history`
- accidental alias blobs in `name`
- packed `member_color` text that mixes multiple groups in one field
- unexpected large-scale churn outside the requested group

## Step 3.5 - Normalize known Fandom import artifacts

After a Fandom-based refresh, review the touched `group_history` rows for these known cleanup rules:

- `HEROINES` is a union/umbrella label, not a standalone idol group record. Do not create or preserve a real `groups.json` group for `HEROINES`.
- If `HEROINES` appears in idol `group_history`, treat it as context only. Do not use it as the source of a member color, member roster, or canonical group membership unless the user explicitly wants union metadata preserved.
- Do not assign placeholder `x_followers` values such as `8000`. If a real follower count was not sourced, leave `x_followers` as `null`.
- If a scraped `member_color` string packs multiple groups into one field, unpack it so each group row only keeps its own color.
- When the idol already has separate `group_history` rows for the mentioned groups, move the extra colors onto those rows instead of leaving a combined string like `Pink (Group A) Blue (Group B)` on one entry.
- If the packed color text mentions a union, label family, or historical alias rather than a true standalone group row, keep only the color that belongs to the actual row being updated and drop the non-group annotation.
- Treat `Tenshi ni wa Narenai` as the past name / previous era of `CAL&RES`, not as a separate duplicate active group to preserve alongside `CAL&RES` in `groups.json`.
- When refresh data mentions both `Tenshi ni wa Narenai` and `CAL&RES`, merge them into the single canonical local group `CAL&RES` unless the user explicitly asks for a historical-only snapshot workflow.
- For the `Tenshi ni wa Narenai` -> `CAL&RES` rename, avoid leaving old/new group colors concatenated in the same field. Keep the color that belongs to the row's canonical local group handling and only populate separate history rows when they are intentionally preserved for historical context.

If the refresh discovered related groups, confirm that this expansion was intended before treating the run as complete.

## Step 4 - Safe operating rules

- Prefer `--dry-run` before bulk or unfamiliar runs.
- Prefer one-group runs before `--all-groups`.
- Do not default to portrait refresh; it is outside the core `groups.json` / `idols.json` update goal.
- Treat `database/updates/inferred_fandom_group_links.csv` as a curated control surface. Review status and URL quality before batch applying.
- Keep the local canonical group name anchored to the repo database even when the fandom page title is English-only or slightly different.
- If the repo already has unrelated `groups.json` or `idols.json` edits, work with them carefully and avoid overwriting user changes.

## Special cases

- For groups added from IDOLS DIAGRAM sync, use:

```bash
python fetcher/run_added_idolsdiagram_groups_workflow.py --limit 25
```

- For a full database refresh, use:

```bash
python fetcher/run_database_refresh.py --skip-portraits
```

Only do this when the user explicitly asks for a broad refresh.

## Key files

- `fetcher/run_database_refresh.py`
- `fetcher/consolidate_fandom_scrape_workflow.py`
- `fetcher/update_groups_from_jpop_fandom.py`
- `fetcher/apply_inferred_fandom_links.py`
- `fetcher/enrich_idols_from_fandom_group_links.py`
- `fetcher/run_added_idolsdiagram_groups_workflow.py`
- `scripts/validate_idols_json.py`
- `fetcher/idol_record_validation.py`
- `database/groups.json`
- `database/idols.json`

### Web staging (idol-producer-web checkout)

| Step | Primary file |
| ---- | ----------- |
| 1 — group | `public/data/groups_update.json` |
| 2 — songs | `public/data/songs_update.json` |
| 3 — members (+ idols) | `groups_update.json` (roster fields) · `public/data/idols.json` (profiles) |
| Merge | `scripts/mergeCatalogUpdates.mjs` · `npm run data:merge-catalog` |
| Romanji fill | `scripts/fillCatalogRomaji.mjs` · `npm run data:fill-romaji` · `public/data/reference/romaji_overrides/*.json` |

---

## Web repo (`idol-producer-web`)

This skill’s desktop refresh commands stay in **idol_producer**; the browser build (`idol-producer-web`) ships **frozen JSON** under `public/data/`.

**Do not paste large catalog deltas straight into `public/data/groups.json` or `songs.json`.** Stage in the *_update*.json files, then merge (`npm run data:merge-catalog`). Afterward clear or trim staging files so intents do not linger.

Implementation: **`scripts/mergeCatalogUpdates.mjs`**; flags `--dry-run`, `--allow-new` (unknown **group** uids).

### Web Step 1 — Update group

**Goal:** Anything on the group row except live roster/editing idols as people—chiefly **`discography`**, publishers, **`song_uids`** (playlist index), **`disc_uids`**, URLs, **`formed_date`**, popularity/fans, narratives, **`agencies`** / **`union`**, **`wiki_url`**, cover paths, etc.

- **Stage** in **`public/data/groups_update.json`** under **`groups[]`**: one object with required **`uid`** (group uid) and only the keys you are changing.
- **Merge** (with Web Step 2 if you edited songs staging in the same pass):

```bash
npm run data:merge-catalog -- --dry-run
npm run data:merge-catalog
```

See **Merge semantics (groups)** below (`discography` merges by release `uid`, etc.). To add new **releases** (`discography`), include new objects with **`uid`**s; they append after existing discs.

### Web Step 2 — Update songs

**Goal:** New or corrected **song catalog rows**: title, **`group_uid`**, **`albums[]`**, **`disc_uid`**, duration, **`_apple_track_ids`**, `source_confidence`, coupling notes—not the group roster.

- **Stage** in **`public/data/songs_update.json`** under **`songs[]`**; each row must have **`uid`** (existing = update, unknown = append).
- **Merge** (`merge-catalog` merges both staging files each run):

```bash
npm run data:merge-catalog -- --dry-run
npm run data:merge-catalog
```

See **Merge semantics (songs)** below.

**After coupling songs**, often also run **Web Step 1**: append/link those song uids via **`song_uids`** on the group (merge unions `song_uids`).

### Web Step 2b — Auto-fill romanji (group name + song titles)

**Goal:** Populate empty romanji columns used in the web UI and exports:

| Object | Fields |
| ------ | ------ |
| **Group** | `name_romanji`, `nickname_romanji` |
| **Disc** (on group row) | each `discography[].title_romanji` |
| **Song** | `title_romanji` (canonical name; keep variants in `title_variant` / `title_listed` when used) |

**When to run:** After **Web Step 1–2** are merged into `public/data/groups.json` and `public/data/songs.json`, or after a catalog-only refresh that left Japanese titles without romanji.

**Command (one group):**

```bash
npm run data:fill-romaji -- --group "GROUP_NAME"
npm run data:fill-romaji -- --group "GROUP_NAME" --dry-run
npm run data:fill-romaji -- --group-uid "BASE64_GROUP_UID"
```

**How it fills (in order):**

1. **Per-group override file** — `public/data/reference/romaji_overrides/<group_uid>.json` with optional `group`, `discs`, and `songs` maps (uid → romanji string). Use for Japanese titles after checking [jpop.fandom.com](https://jpop.fandom.com) or Apple Music JP.
2. **Latin copy rule** — If `title` / `name` / `nickname` has **no CJK** characters, copy that string into the empty romanji field (e.g. `Candid Love`, `NEW WORLD`).
3. **Leave blank** — Rows still empty need manual overrides or a new entry in the override JSON; the script prints `song_skipped_no_source` in its summary.

**Override file shape** (example: `public/data/reference/romaji_overrides/44Ki44Kt44K344OWcHJvamVjdA.json` for アキシブproject):

```json
{
  "_meta": { "group_name": "アキシブproject", "sources": ["jpop.fandom", "Apple Music JP"] },
  "group": { "name_romanji": "Akishibu project" },
  "discs": { "<disc-uid>": "Midaregami Fighting Girl" },
  "songs": { "<song-uid>": "Manatsu no Serenade" }
}
```

Only include keys you are setting; omitted uids are unchanged. Existing non-empty romanji is **never overwritten**.

**Safety:** Writes via `JSON.parse` → patch → **`.tmp` file** → validate → rename for both `groups.json` and `songs.json`. Expect a **large diff** on `songs.json` when many rows change. Do **not** use `apply_patch` on full `groups.json`.

**Optional CSV check:** `node scripts/exportAkishibuCatalogCsv.mjs` (アキシブproject) or re-export your reference sheet after fill.

**Desktop handoff:** If `database/groups.json` in idol_producer already has `name_romanji` / song romanizations, copy those into the override file or staging JSON instead of re-deriving.

### Web Step 3 — Update group members

**Goal:** Current/past roster as represented on **the group object** **`member_names`**, **`member_uids`**, **`member_count`**, **`past_member_names`**, **`past_member_uids`**, **`past_member_count`**—plus **individual idol bios** elsewhere.

- **Stage roster fields** in **`public/data/groups_update.json`** (`groups[].member_*` / **`past_*`**). Remember: **`member_uids` / `past_member_uids` arrays REPLACE** canon when present on the patch (see semantics); **`song_uids` is union-only**.
- **Edit idol profiles** directly in **`public/data/idols.json`** (same `group_uid`; names, **`group_history`**, colors, refs). No `idols_update.json` shim yet—use small diffs or copy from idol_producer after **`Step 3.5`** cleanup.

**Desktop analogue:** `consolidate_fandom_scrape_workflow.py` (+ optional `enrich_idols_*`) updates both roster hints and **`idols.json`**.

---

**Merge semantics (groups_update)**

- Match group by **`uid`**. Unknown group uid omitted unless **`--allow-new`**.
- **`discography[]`**: merge **by release `uid`**; nested plain objects deep-merge; **arrays on the patch replace** the stored array at that nested key; new discs append at end.
- **`song_uids`**: **union** (existing order kept; new ids from patch appended).
- Other arrays on patch (**`member_names`**, **`member_uids`**, **`past_*`**, …): **replace** canonical arrays when those keys appear.
- Nested plain objects: deep-merge recursively.

**Merge semantics (songs_update)**

- Match by **`uid`**; upsert or append trailing row if new.
- **Arrays on patch**: replace canon at that property.
- **Plain objects**: deep-merge.

**Caveats**

- Merge **rewrites whole** output files (~normalized JSON + CRLF); expect possible wide diffs (e.g. **`5`** vs **`5.0`**). For single-row churn on **`groups.json`**, use a splice script (**`patchAkishibuDiscographyNode.mjs`**) or **`apply_patch`**, then optionally mirror results into **`groups_update.json`** for documentation.

Desktop → web handoff still flows through idol_producer’s `database/groups.json` / `database/idols.json` when refreshed there.

### Web bundle checklist (scenario + global catalog)

**After** you refresh `database/groups.json` / `database/idols.json` (and any songs pipeline) in idol_producer:

1. **Scenario 6 bundle** — Copy or export the slice the web preset uses into:
   - `public/data/scenarios/scenario_6_2025-07-20/groups.json`
   - `public/data/scenarios/scenario_6_2025-07-20/idols.json`
   - (and `songs.json` if that slice changed)
2. **Global catalog** (optional, for browse / large `songs.json`) — Prefer **`groups_update.json` / `songs_update.json` + merge** above for `public/data/groups.json` and `public/data/songs.json`; update `public/data/idols.json` when idols change.
3. **Static tiers** — Regenerate `public/data/scenarios/scenario_6_2025-07-20/group_tiers.json` from desktop `build_scenario_group_tier_list.py` when available; otherwise `npm run data:group-tiers` in this repo (heuristic stub).
4. **Group table CSV** — `npm run data:export-scenario6-groups-csv` → `docs/scenario_6_groups_detail.csv` (close the file in the editor if Windows reports `EBUSY`).
5. **Port plan** — See `docs/WEB_PORT_PLAN.md` for versioning, manifests, and parity milestones.

Apply **Step 3.5** (Fandom import cleanup rules) in idol_producer **before** copying rows into the web bundle so bad `group_history` / packed colors do not ship to players.
