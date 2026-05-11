# Database Refresh Playbook

## Why this exists

The Akishibu Project refresh exposed a few rules that should apply to the wider database instead of staying as one-off fixes. This playbook records those lessons and maps them to the scripts that now implement them.

## Source priority by job

- Group identity, group uid, and relationship discovery:
  use IDOLS DIAGRAM first.
- Group/member profile data for most indie groups:
  use J-Pop Wiki / JPop Fandom.
- AKB-family member profile pages and portraits:
  use AKB48 Wiki first: <https://akb48.fandom.com/wiki/AKB48_Wiki>
- Official current-member portraits:
  prefer the official group site when it exposes clean portrait assets.
- X handles and profile images:
  use X after wiki sources, especially when wiki pages are missing a current portrait.
- Japanese Wikipedia:
  use as a fallback for biography and portrait gaps.

## Akishibu lessons learned

- IDOLS DIAGRAM is the best anchor for related-group discovery, rename chains, and missing prior-group coverage.
- J-Pop Fandom idol pages are often easier to find by romaji page title than by Japanese search.
- Idol infobox pages can contain better member-color and birthday data than group pages.
- Fandom portrait extraction should not assume the first available image is the newest relevant one.
- When a proxy returns `403`, retrying once without inherited proxy settings can recover otherwise blocked fetches.
- New groups discovered from IDOLS DIAGRAM should have their uid and `/g/{uid}` URL written into both `groups.json` and `group_url.json` immediately.

## Scripts that now encode these rules

- `fetcher/enrich_related_groups_from_idolsdiagram.py`
  discovers missing related groups from IDOLS DIAGRAM and now persists group uid/url after merge.
- `fetcher/source_policy.py`
  centralizes source-selection rules, including the AKB48 Wiki preference for AKB-family members.
- `fetcher/scrape_fandom_portraits.py`
  now follows the shared source policy when choosing fandom portrait sources.
- `scrape_all_portraits.py`
  now passes the full idol row into portrait source selection so AKB-family members prefer AKB48 Wiki.
- `fetcher/run_database_refresh.py`
  orchestrates end-to-end refresh steps for either one group or the broader database.

## Recommended refresh workflow

### Single-group refresh

```powershell
python fetcher/run_database_refresh.py --group-name 'アキシブproject'
```

### Whole-database refresh preview

```powershell
python fetcher/run_database_refresh.py --dry-run
```

### Whole-database refresh in smaller slices

```powershell
python fetcher/run_database_refresh.py --limit-groups 20 --portrait-max-idols 200
```

## Operational notes

- For AKB-family members, portrait/profile fetches should prefer AKB48 Wiki even if J-Pop Wiki also has a page.
- Official-site portraits should override older fandom portraits when we can verify they are current.
- IDOLS DIAGRAM enrichment is especially valuable after a new group import because rename history and predecessor groups are often incomplete on first pass.
- A full-database run is best done in batches because fandom and X sources can be rate-limited or intermittently blocked.
