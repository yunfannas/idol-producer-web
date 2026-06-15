# Apple Music Song Update Playbook

## Goal

Use Apple Music as a source for song titles, versions, release dates, and popularity ranking, while keeping:

- `database/songs.json` as a track-level table
- `database/groups.json` as the group/release table
- `song_uids` synced to actual song rows only
- release names stored in discography and album refs, not as fake song rows

## Core rule

- `songs.json` should contain songs, not releases.
- `groups.json -> discography` should contain releases.
- If a release title appears in Apple Music and there is no matching track with that same title, do not create a song row for the release name.

Example:

- `iLiFE! Starter Pack!` is a release name.
- `Idol Life Starter Pack` is the song.
- `songs.json` should keep the song and exclude the release-only title as a song row.

## Recommended source split

- Use the Apple Music browser page or screenshots for actual `Top Songs` ranking order.
- Use `fetcher/fetch_apple_music_artist_songs.py` for canonical track names, release dates, collection names, and SE/instrumental detection.
- Use `fetcher/fetch_apple_music_top_songs_playwright.py` when the raw HTML only exposes a small subset. It drives a real browser session, reads the rendered rows, and follows Apple's own `amp-api` ranking pagination.
- Use `scripts/update_apple_music_group_songs.py` when you want one command to combine catalog import, visible top-song ranking, dedupe, and `song_uids` sync.

The fetcher uses the iTunes Lookup API, so its order is catalog order, not guaranteed to match the browser `Top Songs` order.
The Playwright top-songs fetcher is the preferred ranking source when available because it can see more than the initial embedded HTML and can follow Apple's browser-side ranking API.

## Script usage

From the repo root:

```powershell
.\.venv\Scripts\python.exe fetcher\fetch_apple_music_artist_songs.py --url "https://music.apple.com/jp/artist/ilife/1578837625/top-songs" --pretty
```

Useful variants:

```powershell
.\.venv\Scripts\python.exe fetcher\fetch_apple_music_artist_songs.py --url "APPLE_URL" --names-only
```

```powershell
.\.venv\Scripts\python.exe fetcher\fetch_apple_music_artist_songs.py --url "APPLE_URL" --export-idol-producer-songs-json tmp_group_songs.json --group-uid GROUP_UID --group-name "GROUP_NAME"
```

```powershell
.\.venv\Scripts\python.exe fetcher\fetch_apple_music_top_songs_playwright.py --url "APPLE_URL" --pretty
```

```powershell
.\.venv\Scripts\python.exe scripts\update_apple_music_group_songs.py --url "APPLE_URL" --group-uid GROUP_UID --group-name "GROUP_NAME" --tier S --write
```

## Normalization rules

- Keep separately listed vocal versions as separate songs.
- Keep year/member-lineup versions such as `2023ver.`, `2025ver.`, `2026 support ver.` as separate rows.
- Keep solo-song versions as separate rows.
- Ignore `SE` intros.
- Ignore instrumental-only tracks.
- Ignore voice-stripped bonus tracks unless they are clearly treated as a full vocal song.
- If the same song appears across multiple releases, keep one song row for the canonical track title.

## Canonical row rules

- Prefer the earliest release that clearly represents the same vocal song.
- If Apple Music lists multiple collections for the same song, do not create duplicate song rows just because the collection changed.
- Store the collection name in `albums`.
- Use `disc_uid` to point at the release entry in group discography when known.
- If the Apple track title differs from an older local import title, rename the song row to the Apple track title instead of adding a duplicate.

## Clean update workflow

1. Identify the group uid in `groups.json`.
2. Fetch Apple catalog data with `fetcher/fetch_apple_music_artist_songs.py`.
3. Capture the browser `Top Songs` order separately if ranking matters.
4. Build a ranked working list:
   - exact Apple track title
   - release date
   - collection name
   - collection/disc uid if already known locally
   - Apple rank from browser order
5. Remove SE/instrumental rows from the ranked working list.
6. Match each ranked song against existing `songs.json` rows.
7. For existing rows:
   - rename track titles to canonical Apple track titles when needed
   - fix `title_romanji` if the old row used a release placeholder
   - fix `albums` and `disc_uid`
   - preserve separate vocal versions as separate rows
8. For missing tracks:
   - add new song rows to `songs.json`
   - do not add release-only rows as songs
9. Remove mistaken song rows that are actually release objects.
10. Rebuild `groups.json -> song_uids` from the cleaned set of group songs.
11. Check for duplicate group records with the same uid before writing final `song_uids`.

## Popularity workflow

- Use the ranking order from the browser page, not the fetcher output.
- Use the Apple fetcher output to resolve exact titles and release metadata.
- Apply tier rules from `database/song_popularity_tier_rules.json`.
- Ranked songs get bucketed popularity values.
- Unranked songs get the tier default from that same rule file.

## Validation checklist

- No release-only title exists as a song row in `songs.json`.
- `groups.json -> song_uids` contains actual song rows only.
- If a group uid appears more than once in `groups.json`, update all matching entries consistently or stop and resolve the duplicate.
- Every ranked Apple song has:
  - the intended title
  - the intended popularity
  - a note with Apple rank and local ranked position
- Every excluded SE/instrumental track is absent from ranked song rows.
- No duplicate song rows exist for the same exact title/version pair unless they are intentionally separate songs.

## Useful validation commands

Check group uid duplicates:

```powershell
$groups = Get-Content 'database\groups.json' -Raw -Encoding utf8 | ConvertFrom-Json
@($groups | Where-Object { $_.uid -eq 'GROUP_UID' }).Count
```

List current songs for one group:

```powershell
$songs = Get-Content 'database\songs.json' -Raw -Encoding utf8 | ConvertFrom-Json
$songs | Where-Object { $_.group_uid -eq 'GROUP_UID' } | Select-Object title,release_date,popularity
```

Check that a release title is not present as a song:

```powershell
rg -n 'RELEASE_TITLE' database/songs.json database/groups.json
```

## iLiFE! lessons

- The Apple browser ranking and the iTunes catalog feed complement each other well.
- `iLiFE! Starter Pack!` must stay a release entry only.
- Several earlier iLiFE! rows were release-shaped placeholders and needed renaming to actual Apple track titles.
- A full refresh should sync `song_uids` after song cleanup, not before.
- Duplicate group uid entries in `groups.json` should be checked before any batch write.
