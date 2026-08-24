# Game Database Index

**Purpose:** Single entry point for agents working on **data collection**, **game design**, and **catalog maintenance** in `idol-producer-web`. Read this before editing JSON under `public/data/`.

**Machine-readable index:** Run `node support/scripts/buildGameDatabaseIndex.mjs` → `support/docs/generated/game_database_index.json` (group lookup, allowlist, counts, script routing).

**Last consolidated:** 2026-08-23 — restored truncated `groups.json` / `songs.json`; integrity checker PASS.

---

## 1. Two databases (do not confuse them)

| Database | Paths | Meaning |
|----------|-------|---------|
| **Main (living catalog)** | `public/data/{groups,idols,songs}.json` | Roster and metadata ≈ **today** |
| **Scenario 6 (time-lock)** | `public/data/scenarios/scenario_6/{groups,idols,songs}.json` | Snapshot at **`opening_date = 2025-07-05`** |

Scenario 6 **does not inherit** main rosters at runtime. Matching main `member_count` is **not** success — matching **dated `group_history` active on opening date** is.

**Pinned canaries @ 2025-07-05:**

| Group | Expected members |
|-------|------------------|
| =LOVE | 10 |
| iLiFE! | 9 |
| 高嶺のなでしこ | 10 |
| アキシブproject | 8 |

Main catalog today may differ (e.g. Akishibu 7 today vs 8 @ opening).

---

## 2. Current counts

| | Main | Scenario 6 |
|---|-----:|----------:|
| Groups | 688 | 475 |
| Idols | 7,033 | 6,653 |
| Songs | 16,081 | (scenario copy) |
| Playable @ new game | — | **86** (allowlist) |

Scenario 6 tier distribution (475 groups): S5 · A4 · B10 · C25 · D137 · E204 · F10 · I80.

Regenerate stats: `node support/scripts/buildGameDatabaseIndex.mjs`

---

## 3. File map

### Core catalog

| File | Role |
|------|------|
| `public/data/groups.json` | Group rows: roster, `song_uids`, fans, agencies, discography refs, pictures |
| `public/data/idols.json` | Idol profiles: `group_history[]`, portraits, birthday, scandal `status_history` |
| `public/data/songs.json` | Song/disc rows: `group_uid`, popularity, albums, streaming refs |
| `public/data/groups_update.json` | **Staging** — merge into main via scripts (currently empty) |
| `public/data/songs_update.json` | **Staging** for song patches |

### Scenario 6 bundle

| File | Role |
|------|------|
| `public/data/scenarios/presets/scenario6.json` | Preset metadata, `opening_date`, landing copy |
| `public/data/scenarios/scenario_6/startup_allowlist.json` | 86 playable groups (`names_in_order`) |
| `public/data/scenarios/scenario_6/group_tiers.json` | Letter tier, fans, popularity per group uid |
| `public/data/scenarios/scenario_6/groups_update.json` | Scenario metadata patches (**dangerous** if members copied from main) |
| `public/data/scenarios/manifest.json` | Default preset routing |

### Reference & rules

| File | Role |
|------|------|
| `public/data/reference/agencies.json` | Agency harshness (contracts) |
| `public/data/reference/group_reputation.json` | Reputation seeds |
| `public/data/reference/scandal_handlings.json` | Scandal response templates |
| `public/data/group_tier_policy.json` | Tier inference rules (fans, x_followers vintage) |
| `public/data/group_union.json` | Union keys → group UIDs (HEROINES ecosystem) |
| `public/data/shared_releases.json` | Multi-group album editions |
| `public/data/member_role_attribute_model.json` | Role → attribute calibration |
| `public/data/song_popularity_tier_rules.json` | Song popularity scoring |
| `public/data/song_starting_formations.json` | Choreography / formation presets |

### Schedules & lives

| Location | Role |
|----------|------|
| `public/data/timetree/*.json` | TimeTree calendar scrapes (HEROINES-tier) |
| `public/data/official_schedules/*.json` | Official site schedules (=LOVE, 高嶺, etc.) |
| `public/data/managed-live-schedules/groups/*.json` | Curated live schedule DB |
| `public/data/live_events_catalog.json` | Festival / live event catalog |
| `public/data/venues.json` | Venue capacities |
| `public/data/festival_series.json` | TIF and festival series metadata |

### Assets

| Location | Role |
|----------|------|
| `public/data/pictures/idols/` | Flat idol portraits (basename of `portrait_photo_path`) |
| `public/data/pictures/groups/` | Group logos / photos |

---

## 4. Key schemas (query patterns)

### Group (`groups.json`)

```json
{
  "uid": "base64-ish stable id",
  "name": "Japanese display name",
  "name_romanji": "Akishibu_project",
  "member_count": 7,
  "member_names": ["..."],
  "member_uids": ["uuid..."],
  "past_member_names": ["..."],
  "past_member_uids": ["..."],
  "formed_date": "2012-10-05",
  "fans": 5166,
  "x_followers": 12345,
  "agencies": ["LIVE PLANET"],
  "song_uids": ["uuid..."],
  "description": "..."
}
```

**Find group:** grep `"name": "=LOVE"` or use `game_database_index.json` → `main_group_lookup`.

### Idol (`idols.json`)

```json
{
  "uid": "uuid",
  "name": "Display name",
  "romaji": "Romanized",
  "group_history": [{
    "group_uid": "preferred match key",
    "group_name": "fallback name match",
    "start_date": "2023-03-11",
    "end_date": null,
    "member_color": "Red",
    "member_color_code": "0xff0000"
  }],
  "portrait_photo_path": "fetcher\\database\\picture_fandom\\....jpg",
  "status_history": []
}
```

**Rules:** `start_date` is **required** for roster rebuilds. Undated alias rows poison scenario refreshes.

**Find idol:** grep uid, or grep name inside `group_history`.

### Song (`songs.json`)

```json
{
  "uid": "uuid",
  "title": "曲名",
  "group_uid": "...",
  "group_name": "...",
  "disc_type": "Single|Album|Mini Album|Digital Single",
  "release_date": "2025-01-01",
  "popularity": 85,
  "albums": [{ "name": "...", "track_number": 1 }]
}
```

**Find songs for group:** filter `group_uid` **or** resolve `group.song_uids`.

---

## 5. Agent routing (which skill / script?)

| Task | Start here |
|------|------------|
| Edit main roster / profiles | `support/docs/skills/idol-database-refresh/SKILL.md` |
| Edit scenario 6 opening rosters | `.cursor/skills/scenario-db-integrity/SKILL.md` |
| Validate after any DB edit | `node support/scripts/checkMainScenarioDbIntegrity.mjs` |
| Refresh songs from Apple Music JP | `support/docs/skills/apple-music-song-update/SKILL.md` |
| Portraits / era switches | `.cursor/skills/idol-portraits/SKILL.md` |
| Scandal / hiatus history | `.cursor/skills/idol-scandal-history/SKILL.md` |
| TimeTree / official schedules | `.cursor/skills/timetree-group-schedule/SKILL.md` |
| Simulation balance (fans, lives, finance) | `.cursor/skills/game-logic-balance/SKILL.md` |
| Rebuild scenario members from history | `node support/scripts/refreshScenario6GroupMembers.mjs` |
| Regenerate this index | `node support/scripts/buildGameDatabaseIndex.mjs` |

### Safe update order (one group)

1. **Idols** — `group_history` with real dates, portraits  
2. **Songs** — new releases, `song_uids`  
3. **Group row** — `member_uids`, `song_uids`, metadata last  

### Scenario 6 checklist

```
- [ ] Scope: main vs scenario_6?
- [ ] group_history rows have start_date
- [ ] Did NOT copy main member_uids into scenario
- [ ] checkMainScenarioDbIntegrity.mjs → PASS
- [ ] Canaries: iLiFE!=9, アキシブproject=8
```

---

## 6. Game design docs (simulation, not catalog)

| Doc | Contents |
|-----|----------|
| `support/docs/reference/game_logic_model.md` | Songs, familiarity, live scoring, idol condition, finance |
| `support/docs/WEB_GAME_PLAN.md` | Web port phases, save schema, engine file map |
| `support/docs/reference/finance/finance_model_summary.md` | Daily close, payroll, venue fees |
| `docs/design/WORLD_UI_V2_PLAN.md` | World UI v2 layout |
| `support/docs/reference/scout_system_design.md` | Scout desk (future) |
| `support/docs/fan-layer-system-design.md` | Fan demographics layers |

**Engine source of truth:** `src/engine/` — see `game-logic-balance` skill for file list.

**Runtime loader:** `src/data/loadScenario.ts` fetches scenario bundle + optional schedules.

---

## 7. Scenario 6 playable groups

Full list with tier / member / song counts: `support/docs/scenario6_available_groups.txt`

Recommended startup (first 4 in allowlist): =LOVE, iLiFE!, 高嶺のなでしこ, アキシブproject.

CSV exports: `support/docs/scenario_6_recommended_group_idols.csv`, `scenario_6_groups_detail.csv`

---

## 8. Dual-repo note

Upstream scraping lives in **`H:\Qsync\Project\idol_producer`** (Python). Web ships JSON only. Prefer desktop refresh → staged merge into `public/data/*_update.json` → merge scripts. See `support/docs/database_updates/database_refresh_playbook.md`.

---

## 9. Integrity & corruption patterns

**Always run after edits:**

```bash
node support/scripts/checkMainScenarioDbIntegrity.mjs
node support/scripts/checkMainScenarioDbIntegrity.mjs --allowlist-only   # fast
node support/scripts/checkMainScenarioDbIntegrity.mjs --json
```

**Known failure mode:** undated `group_history` aliases treated as active → inflated scenario rosters (iLiFE! 16, Akishibu 13). Fix: date or remove aliases; rebuild with `refreshScenario6GroupMembers.mjs`.

**Dangerous scripts** (can overwrite opening rosters with today): `buildScenario6GroupsUpdate.mjs`, `mergeScenario6GroupsUpdate.mjs` — run integrity check immediately after.

**JSON truncation:** Large files (`groups.json`, `songs.json`) must parse before commit. Quick check:

```bash
node -e "JSON.parse(require('fs').readFileSync('public/data/groups.json'))"
```

---

## 10. Related generated artifacts

| Output | Command |
|--------|---------|
| `support/docs/generated/game_database_index.json` | `node support/scripts/buildGameDatabaseIndex.mjs` |
| Scenario tier CSV | `node support/scripts/export-scenario6-groups-csv.mjs` |
| Group gap reports | `node support/scripts/exportGroupGapsCsv.mjs` |

---

*Maintainers: update §2 counts by re-running the index builder; append consolidation notes to `support/docs/project_summary.md`.*
