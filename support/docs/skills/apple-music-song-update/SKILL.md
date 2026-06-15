---
name: apple-music-song-update
description: >-
  Runs the idol_producer Apple Music song refresh for one group: resolve the
  group, obtain the Japanese Apple Music artist top-songs URL, align
  database/songs.json and groups.json discography, then apply song popularity
  scores from chart rank and song_popularity_tier_rules.json. Use when updating
  songs from Apple Music JP, top songs charts, discography sync, or
  popularity_local for a group.
disable-model-invocation: true
---

# Apple Music song update (idol_producer)

Canonical file: `skills/apple-music-song-update/SKILL.md`. Cursor loads it when `skills` is linked at `.cursor/skills` (see `skills/README.md`).

## Process

target a group->find apple music top songs link in Japanese->update songs and discography->update song score

Expand that pipeline as follows (same order).

## Step 1 — Target a group

- Locate the group in `database/groups.json` and record `uid`, `name`, and any existing `wiki_url` / discography hints.
- Before bulk edits, check for duplicate `uid` rows for that group (see playbook validation).

## Step 2 — Find Apple Music top songs link (Japanese storefront)

- Prefer URLs shaped like `https://music.apple.com/jp/artist/{slug}/{artistId}/top-songs` (storefront `jp`).
- Search Apple Music (Japan) in browser if the link is not already documented; confirm the artist matches the group name.

## Step 3 — Update songs and discography

- Fetch catalog metadata from the CLI (iTunes Lookup; order is catalog order, not guaranteed to match browser Top Songs):

```bash
python fetcher/fetch_apple_music_artist_songs.py --url "APPLE_MUSIC_JP_TOP_SONGS_URL" --export-idol-producer-songs-json tmp_export.json --group-uid GROUP_UID --group-name "GROUP_NAME"
```

- For **browser Top Songs order** (when rank matters), capture order from the Apple Music page or screenshots; use the fetcher for exact titles, dates, and collection names.
- Merge into `database/songs.json` and `database/groups.json` (`discography`, `song_uids`, release rows) following project rules: songs are tracks, not release titles; keep versions as separate rows where appropriate; drop SE / instrumental-only rows per playbook.
- Refresh discography from Fandom when that is the project source of releases: `python fetcher/fetch_disc_data_for_all_groups.py --group "GROUP_NAME"` (see `docs/fetcher/README.md`).

**Full normalization, matching, and `song_uids` checklist:** read [docs/database_updates/apple_music_song_update_playbook.md](docs/database_updates/apple_music_song_update_playbook.md).

## Step 4 — Update song score

- Assign `popularity` / `popularity_local` (and notes with Apple rank and local ranked position) using **browser chart order**, not the fetcher’s default ordering.
- Apply tier buckets from `database/song_popularity_tier_rules.json` (scale, tier rules, unranked defaults).

## After edits

- Run playbook checks in `docs/database_updates/apple_music_song_update_playbook.md` (release-only titles, `song_uids`, duplicates, notes).

## Related paths

| Artifact | Path |
|----------|------|
| Songs table | `database/songs.json` |
| Groups + discography | `database/groups.json` |
| Popularity rules | `database/song_popularity_tier_rules.json` |
| Fetcher | `fetcher/fetch_apple_music_artist_songs.py` |
| Detailed playbook | `docs/database_updates/apple_music_song_update_playbook.md` |
