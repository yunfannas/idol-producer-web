---
name: idol-database-refresh
description: >-
  Refresh idol/group catalog data using Fandom, IDOLS DIAGRAM, Wikipedia, official
  sites, and staged web merges. Use when updating one group, reconciling roster
  or idol profile changes, applying curated fandom links, syncing songs/group
  metadata, or running the safest current refresh flow across idol_producer and
  idol-producer-web.
disable-model-invocation: true
---

# Idol database refresh

This skill is self-contained in this folder. Read these local references when needed:

- `references/source-policy.md` for source priority, host selection, and known cleanup rules.
- `references/desktop-workflows.md` for the cherry-picked desktop commands and what each workflow actually does.

## Repo split

This project has two relevant checkouts:

- `idol_producer` at `H:\Qsync\Project\idol_producer`
  Use for upstream scraping, Fandom/Wikipedia enrichment, inferred-link application, and idol validation.
- `idol-producer-web` at `H:\Qsync\Project\idol-producer-web`
  Use for staged web catalog edits in `public/data/*`, merge steps, and romanji fill.

When the user asks for a real refresh from external sources, prefer running the desktop workflow first if that repo is available locally, then port only the intended results into the web JSON. If the desktop repo is unavailable, perform the equivalent scoped update directly in web staging files and cite the source choices from `references/source-policy.md`.

## Refresh tracks

Every request maps to one or more tracks:

| Track | Primary data | Typical files |
| --- | --- | --- |
| Group catalog | group row, URLs, formed date, agencies, union, producers, discography summary, `song_uids` | desktop: `database/groups.json`; web: `public/data/groups_update.json` |
| Songs | per-song rows, `disc_uid`, albums, streaming ids, coupling metadata | desktop songs pipeline; web: `public/data/songs_update.json` |
| Members / idols | roster ordering, `member_uids`, current/former members, idol bio/history/colors | desktop: `database/idols.json` + `database/groups.json`; web: `public/data/idols.json` + roster slices in `public/data/groups_update.json` |

Default sequencing for one group:

1. Members / idols first when UIDs, names, or lineup changed.
2. Songs second when new releases or coupling tracks were added.
3. Group row last for `song_uids`, producers, formed date, descriptions, and aggregate metadata.

## Default operating mode

Prefer one-group refreshes. Only do batch or full-database work when the user explicitly asks.

Before changing anything:

- inspect `git status`
- check for existing edits in touched JSON files
- confirm whether the task is desktop refresh, web merge, or both

## Workflow selection

### A. One-group Fandom-first refresh

Use this for the common case: roster/profile refresh from curated Fandom pages, optionally expanding via IDOLS DIAGRAM.

From `idol_producer`:

```bash
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME"
```

Useful variants:

```bash
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME" --skip-related-check
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME" --skip-idol-refresh
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME" --dry-run
```

Read `references/desktop-workflows.md` before using variants or explaining the exact step order.

### B. One-group orchestrated refresh including Wikipedia

Use when the user wants the broader "latest safe refresh flow" and not just Fandom.

From `idol_producer`:

```bash
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-portraits
```

Useful variants:

```bash
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-portraits --dry-run
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-fandom --skip-portraits
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-related --skip-portraits
```

Do not default to portrait refresh unless the user asked for portraits.

### C. Known Fandom URL, targeted repair

Use when the local group name and page title diverge sharply, or when a specific mapping needs repair.

From `idol_producer`:

```bash
python fetcher/update_groups_from_jpop_fandom.py --group-name "GROUP_NAME" --fandom-url "FANDOM_URL" --merge
```

### D. Curated inferred-link workflow

Use when the control surface is `database/updates/inferred_fandom_group_links.csv` and the user is reviewing manual/auto link rows.

From `idol_producer`:

```bash
python fetcher/apply_inferred_fandom_links.py --statuses manual,auto --group "GROUP_NAME"
python fetcher/enrich_idols_from_fandom_group_links.py --group "GROUP_NAME" --allowed-hosts "jpop.fandom.com,akb48.fandom.com"
```

### E. Web-only catalog staging

Use when the user wants changes only in this repo, or after a desktop refresh has already determined the intended deltas.

Edit only staged files first:

- group catalog: `public/data/groups_update.json`
- songs: `public/data/songs_update.json`
- idol profiles: `public/data/idols.json`

Then merge:

```bash
npm run data:merge-catalog -- --dry-run
npm run data:merge-catalog
```

Then fill romanji:

```bash
npm run data:fill-romaji
```

Do not paste large direct edits into `public/data/groups.json` or `public/data/songs.json` unless the task specifically requires bypassing staging and the user understands the risk.

## Validation

After material idol/member refreshes in `idol_producer`:

```bash
python scripts/validate_idols_json.py --output logs/idols_validation_latest.json
```

After web merges in `idol-producer-web`:

- review diffs in `public/data/groups.json`
- review diffs in `public/data/songs.json`
- review diffs in `public/data/idols.json`
- verify staging files do not retain stale intents after merge

## Safe rules

- Prefer `--dry-run` before bulk or unfamiliar runs.
- Prefer one-group runs before `--all-groups`.
- Keep the canonical local group name anchored to the repo database, even when a fandom page title differs.
- Treat inferred-link CSV rows as curated inputs, not ground truth.
- If the worktree already contains unrelated edits, do not overwrite them.
- Confirm with the user before treating newly discovered related groups as in-scope if the run expands beyond the requested group.

## Special cases

- For groups added from IDOLS DIAGRAM sync:

```bash
python fetcher/run_added_idolsdiagram_groups_workflow.py --limit 25
```

- For a broad database refresh:

```bash
python fetcher/run_database_refresh.py --skip-portraits
```

Only do this when the user explicitly asks for a large refresh.
