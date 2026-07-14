# Desktop workflows

These notes are cherry-picked from the sibling `idol_producer` repo so this skill stays usable even when that repo is not open in context.

## `run_database_refresh.py`

Purpose:

- orchestrates Wikipedia refresh
- orchestrates Fandom refresh
- orchestrates IDOLS DIAGRAM related-group enrichment
- optionally runs portrait refresh

Typical command:

```bash
python fetcher/run_database_refresh.py --group-name "GROUP_NAME" --skip-portraits
```

Important flags:

- `--group-name NAME`: scope to one group
- `--limit-groups N`: batch only the first N groups
- `--skip-wikipedia`
- `--skip-fandom`
- `--skip-related`
- `--skip-portraits`
- `--portrait-batch-size N`
- `--portrait-max-idols N`
- `--fail-fast`
- `--dry-run`

Behavior:

- If `--group-name` is set and Fandom or related enrichment is enabled, it prefers the consolidated workflow instead of calling lower-level per-group scripts independently.
- If `--dry-run` is set, it prints the exact commands it would execute.
- If `--fail-fast` is not set, it continues after a failed step and reports failures at the end.

## `consolidate_fandom_scrape_workflow.py`

Purpose:

- refresh inferred/manual Fandom links
- apply those links to group rows
- optionally discover related groups from IDOLS DIAGRAM
- enrich idol profiles from stored member-page links

Typical command:

```bash
python fetcher/consolidate_fandom_scrape_workflow.py --group "GROUP_NAME"
```

Important flags:

- `--group NAME`: repeatable one-group or small-batch targeting
- `--all-groups`
- `--statuses manual,auto`: statuses accepted from inferred-link CSV
- `--skip-infer-links`
- `--skip-group-refresh`
- `--skip-related-check`
- `--skip-idol-refresh`
- `--allowed-hosts jpop.fandom.com,akb48.fandom.com`
- `--idol-limit-groups N`
- `--fail-fast`
- `--dry-run`

Execution order:

1. `infer_fandom_group_links.py` unless skipped
2. `apply_inferred_fandom_links.py`
3. `enrich_related_groups_from_idolsdiagram.py` for each requested group unless skipped
4. `enrich_idols_from_fandom_group_links.py`

Important nuance:

- After the related-group step, the workflow compares `groups.json` before and after the run and adds newly discovered groups into the idol-refresh scope.

## `update_groups_from_jpop_fandom.py`

Purpose:

- parse a single group page or a selected batch of group pages
- create update files
- optionally merge those update files into the desktop database immediately

Targeted repair form:

```bash
python fetcher/update_groups_from_jpop_fandom.py --group-name "GROUP_NAME" --fandom-url "FANDOM_URL" --merge
```

Important flags:

- `--group-name NAME`
- `--fandom-url URL`
- `--groups-file PATH`
- `--start-from NAME`
- `--limit N`
- `--delay SECONDS`
- `--merge`

Important behavior:

- The script selects the Fandom host using the source policy.
- With `--merge`, it merges generated group/idol/venue/live/publisher update files into the main desktop database.
- If an explicit `--fandom-url` is supplied, it also syncs that URL back into the group row.

## `apply_inferred_fandom_links.py`

Purpose:

- read `database/updates/inferred_fandom_group_links.csv`
- process only selected statuses and fandom-host links
- parse group pages
- create update files
- merge them directly into the desktop database

Typical command:

```bash
python fetcher/apply_inferred_fandom_links.py --statuses manual,auto --group "GROUP_NAME"
```

Important flags:

- `--csv PATH`
- `--statuses LIST`
- `--group NAME` repeatable
- `--limit N`
- `--delay SECONDS`
- `--skip-cached`

Important behavior:

- Keeps the canonical local group name anchored to the repo database even when the page title is English-only.
- If the parsed Fandom display name differs from the local name and `name_romanji` is empty, it stores the parsed display name as romanji instead of replacing the canonical local name.

## `enrich_idols_from_fandom_group_links.py`

Purpose:

- use only stored `wiki_url` values already present in `database/groups.json`
- fetch group pages from the MediaWiki parse API
- extract current/former member page links
- parse member pages and merge idol profile fields

Typical command:

```bash
python fetcher/enrich_idols_from_fandom_group_links.py --group "GROUP_NAME" --allowed-hosts "jpop.fandom.com,akb48.fandom.com"
```

Important flags:

- `--group NAME` repeatable
- `--allowed-hosts HOSTS`
- `--limit-groups N`

Important behavior:

- This script does not search the web. It trusts already curated `wiki_url` values in `groups.json`.
- It tries infobox member sections first, then article-body member lists.
- It follows redirects on member pages before parsing infobox data.

## Validation

After material idol changes:

```bash
python scripts/validate_idols_json.py --output logs/idols_validation_latest.json
```

Review:

- `database/groups.json`
- `database/idols.json`
- touched files under `database/updates/`
