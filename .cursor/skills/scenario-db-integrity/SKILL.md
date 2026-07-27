---
name: scenario-db-integrity
description: >-
  Validate main catalog vs scenario snapshot databases after data updates.
  Detects opening-date roster corruption, null-date group_history aliases,
  member_count desync, and unsafe main→scenario merges. Use when editing
  public/data/groups.json, idols.json, scenario_6 data, running refresh/merge
  scripts, or investigating wrong member counts (iLiFE!, Akishibu, etc.).
---

# Main vs scenario database integrity

## Mental model (do not skip)

| Database | Path | Meaning |
|----------|------|---------|
| **Main** | `public/data/{groups,idols,songs}.json` | Living catalog ≈ **today** |
| **Scenario 6** | `public/data/scenarios/scenario_6/` | **Time-locked** snapshot at preset `opening_date` (`2025-07-05`) |

Scenario 6 does **not** inherit main rosters at runtime. It ships its own full `groups.json` + `idols.json`. **Matching main member counts is not a success criterion** — matching **dated `group_history` active on `opening_date`** is.

Pinned startup canaries (must be correct @ opening):

| Group | Expected members @ `2025-07-05` |
|-------|----------------------------------|
| =LOVE | 10 |
| iLiFE! | **9** |
| 高嶺のなでしこ | 10 |
| アキシブproject | **8** |

Source: `support/docs/scenario6_available_groups.txt` and `support/docs/scenario_6_recommended_group_idols.csv`.

## Required check after every data update

Run before considering main or scenario JSON work done:

```bash
node support/scripts/checkMainScenarioDbIntegrity.mjs
node support/scripts/checkMainScenarioDbIntegrity.mjs --allowlist-only
node support/scripts/checkMainScenarioDbIntegrity.mjs --json
```

- Exit `0` = pass, `1` = fail.
- Prefer `--allowlist-only` for fast canary during iterative edits; run full check before finish.
- **Never** “fix” a scenario roster by copying main `member_uids` unless the user explicitly wants current-day counts (that breaks the time-lock).

## What the checker enforces

1. **Opening roster rebuild**: for each checked group, members = idols with a `group_history` row matching `group.uid` / `name` / `name_romanji` where **`start_date` is required** and brackets `opening_date`.
2. **`member_count` == `member_uids.length` == `member_names.length`**.
3. **Null-date alias detection**: undated `group_history` rows (`start_date` and `end_date` both empty) — these poisoned refreshes historically.
4. **`groups_update.json` hazard**: patch member lists that disagree with opening history (merge would corrupt).
5. **Canary report** for the four pinned groups vs main-today (informational).

## Known corruption pattern (Jul 2026)

**Symptom:** scenario_6 iLiFE! showed 16 members (`member_count` 17); Akishibu showed 13. Correct @ opening: **9** and **8**.

**Cause:** undated alias `group_history` rows (e.g. `group_name: "iLiFE!"` / `"Akishibu project"` with null dates) plus `support/scripts/refreshScenario6GroupMembers.mjs` treating null start/end as active:

```js
// BUG: missing start_date still returns true
function isActiveOn(history) {
  if (start && start > openingDate) return false;
  if (end && end < openingDate) return false;
  return true;
}
```

Introduced around commit `2a47dad` after `807920e` still had correct 9/8 lists. Runtime `buildFilteredSnapshotWithFutureEvents` does **not** rebuild `member_uids` from history at new-game start — bad JSON ships into saves.

**Safe rebuild rule:** require `start_date`; prefer `group_uid` match; ignore undated aliases when a dated tenure exists.

Details: [reference.md](reference.md).

## Update workflows (safe order)

### A. Editing main catalog only

1. Edit `public/data/groups.json` / `idols.json` as needed.
2. Run integrity checker (scenario may still fail if already corrupted — that is separate).
3. Do **not** auto-merge main members into scenario.

### B. Editing scenario snapshot (time-lock)

1. Edit `scenario_6/idols.json` histories with real ISO dates.
2. Rebuild members: `node support/scripts/refreshScenario6GroupMembers.mjs` (requires `start_date`; defaults to all groups).
3. Optional pollution cleanup after bad imports: `node support/scripts/cleanupScenario6IdolPollution.mjs` then refresh again.
4. Run `checkMainScenarioDbIntegrity.mjs` — must PASS for allowlist / canaries.
5. Only then touch `groups_update.json`.

### C. Main → scenario metadata sync

Allowed without roster rewrite: formed dates, producers, song uids (careful), tiers — via scripts that **exclude** member arrays, or strip them before merge.

**Dangerous (do not use for roster repair):**

| Script | Risk |
|--------|------|
| `buildScenario6GroupsUpdate.mjs` | Copies **full** main group rows (including members) for allowlist except Akishibu |
| `mergeScenario6GroupsUpdate.mjs` | Array fields on patch **replace** — overwrites opening rosters with today |
| `refreshScenario6GroupMembers.mjs` | Rebuilds from history; **hardened** to require `start_date`. Default: all groups. Use `--allowlist-only` to limit. |

If those scripts must run: run integrity check **immediately after**, and refuse to keep results that fail canaries.

### D. Scandal / history skill writes

`idol-scandal-history` writes main `idols.json` by default; scenario only when asked. After any scenario idol write, re-check opening rosters.

## Agent checklist (copy)

```
Scenario DB update checklist:
- [ ] Know which DB is in scope: main (today) vs scenario_6 (opening_date)
- [ ] Did not copy main member_uids into scenario to “make counts match”
- [ ] group_history rows have start_date (no undated aliases for active matching)
- [ ] node support/scripts/checkMainScenarioDbIntegrity.mjs  → PASS
- [ ] Canaries: iLiFE!=9, アキシブproject=8 @ 2025-07-05
```

## Fixing failures

1. Read failure `extra_members` / `missing_members` / `null_date_alias_histories`.
2. Remove or date undated alias histories in `scenario_6/idols.json`.
3. Set `member_uids` / `member_names` / `member_count` to the **dated** opening set (or harden + re-run refresh).
4. Align `groups_update.json` member fields with the scenario group (or strip members from the patch).
5. Re-run the checker until PASS.

Do not “fix” by syncing from main unless the opening date is intentionally moved to today.
