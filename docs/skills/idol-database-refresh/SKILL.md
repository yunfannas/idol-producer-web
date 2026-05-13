---
name: idol-database-refresh
description: >-
  Updates idol_producer database/groups.json and database/idols.json using the
  current repo workflow for Wikipedia, jpop.fandom/AKB48 Fandom, inferred
  fandom links, and idol-profile enrichment. Use when refreshing one group,
  reconciling member rosters, merging fandom-based updates, or running the
  latest safe database refresh flow instead of older one-off scripts.
disable-model-invocation: true
---

# Idol database refresh (idol_producer)

Canonical file: `skills/idol-database-refresh/SKILL.md`.

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

---

## Web repo (`idol-producer-web`)

This skill’s commands run in the **idol_producer** (desktop) checkout, not inside `idol-producer-web`. The web app ships **frozen JSON** under `public/data/`.

**After** you refresh `database/groups.json` / `database/idols.json` (and any songs pipeline) in idol_producer:

1. **Scenario 6 bundle** — Copy or export the slice the web preset uses into:
   - `public/data/scenarios/scenario_6_2025-07-20/groups.json`
   - `public/data/scenarios/scenario_6_2025-07-20/idols.json`
   - (and `songs.json` if that slice changed)
2. **Global catalog** (optional, for browse / large `songs.json`) — Update `public/data/groups.json`, `public/data/idols.json`, `public/data/songs.json` when you intentionally sync the full tree.
3. **Static tiers** — Regenerate `public/data/scenarios/scenario_6_2025-07-20/group_tiers.json` from desktop `build_scenario_group_tier_list.py` when available; otherwise `npm run data:group-tiers` in this repo (heuristic stub).
4. **Group table CSV** — `npm run data:export-scenario6-groups-csv` → `docs/scenario_6_groups_detail.csv` (close the file in the editor if Windows reports `EBUSY`).
5. **Port plan** — See `docs/WEB_PORT_PLAN.md` for versioning, manifests, and parity milestones.

Apply **Step 3.5** (Fandom import cleanup rules) in idol_producer **before** copying rows into the web bundle so bad `group_history` / packed colors do not ship to players.
