# Source policy

Use this source order unless the user asks for a different one.

## Source priority by job

- Group identity, canonical group uid, and related-group discovery:
  use IDOLS DIAGRAM first.
- Group/member profile data for most indie groups:
  use J-Pop Wiki / `jpop.fandom.com`.
- AKB-family member pages and portraits:
  prefer `akb48.fandom.com`.
- Hello! Project member pages and portraits:
  prefer `helloproject.fandom.com`.
- Official current-member portraits:
  prefer the official site when it exposes clearly current assets.
- X handles and profile images:
  use X after wiki sources, mainly for current social handles or portrait gaps.
- Japanese Wikipedia:
  use as fallback for biography or formed-date gaps, or when fandom coverage is thin.

## Fandom host selection

Choose the group-level Fandom host this way:

- AKB48 / Sakamichi / 48-family style groups:
  `akb48.fandom.com`
- Hello! Project groups:
  `helloproject.fandom.com`
- Most other groups:
  `jpop.fandom.com`

For idol-level page searches, the desktop policy prefers:

1. AKB48 Wiki first for AKB-family idols
2. Hello! Project Wiki first for Hello! Project idols
3. J-Pop Wiki first for most others
4. Other fandom variants only as fallback

## Durable workflow lessons

- IDOLS DIAGRAM is the best anchor for rename chains, predecessor groups, and missing related-group coverage.
- J-Pop Fandom idol pages are often easier to find by romanized page title than by Japanese search.
- Idol infobox pages can have cleaner birthday and member-color data than group pages.
- Fandom portrait extraction should not assume the first image is the newest or correct one.
- If a request path is blocked or proxied poorly, retrying without inherited proxy settings can recover the fetch.
- New groups discovered from IDOLS DIAGRAM should have uid and URL persisted immediately in the desktop database before downstream enrichment continues.

## Known cleanup rules after Fandom refreshes

- `HEROINES` is a union/family label, not a standalone canonical group row.
- If `HEROINES` appears in `group_history`, treat it as context only unless the user explicitly wants union metadata preserved.
- Do not keep placeholder `x_followers` values like `8000`; prefer `null` when unsourced.
- If a scraped `member_color` field mixes multiple groups in one string, split it so each group history row keeps only its own color.
- If a packed color string includes union labels or aliases, keep only the color that belongs to the canonical local group row being updated.
- Treat `Tenshi ni wa Narenai` as the prior-era name of `CAL&RES`, not as a separate duplicate active group row by default.
- When both names appear in refresh data, merge into canonical local handling for `CAL&RES` unless the user explicitly wants a historical snapshot.

## What to review in diffs

- placeholder or heading-like idol names
- broken or duplicated `group_history`
- alias blobs merged into `name`
- accidental large-scale churn outside the requested group
- roster expansion caused by newly discovered related groups
