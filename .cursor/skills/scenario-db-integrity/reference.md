# Scenario DB integrity — reference

## File map

| Role | Path |
|------|------|
| Preset (`opening_date`) | `public/data/scenarios/presets/scenario6.json` |
| Scenario groups / idols | `public/data/scenarios/scenario_6/groups.json`, `idols.json` |
| Allowlist | `public/data/scenarios/scenario_6/startup_allowlist.json` |
| Staged main sync | `public/data/scenarios/scenario_6/groups_update.json` |
| Expected counts doc | `support/docs/scenario6_available_groups.txt` |
| Recommended roster CSV | `support/docs/scenario_6_recommended_group_idols.csv` |
| Integrity checker | `support/scripts/checkMainScenarioDbIntegrity.mjs` |
| Runtime load | `src/data/loadScenario.ts` |
| New-game filter | `src/engine/scenarioRuntimeWeb.ts` → `buildFilteredSnapshotWithFutureEvents` |
| Save bootstrap | `src/save/gameSaveSchema.ts` → `createNewGameSave` |

## Runtime behavior

`buildFilteredSnapshotWithFutureEvents(idols, groups, asOf)`:

- Filters idol `group_history` and schedules future join/leave events.
- Leaves stored `group.member_uids` as-is at snapshot build (join/leave helpers only mutate when events apply later).
- Therefore **corrupt stored rosters are playable as corrupt**.

## Refresh script (hardened)

`support/scripts/refreshScenario6GroupMembers.mjs`:

- Matches history via `group_uid` **or** `group_name === group.name|name_romanji`.
- **Requires `start_date`** — undated alias rows never count as active.
- Defaults to **all** scenario groups; `--allowlist-only` limits to startup allowlist.
- Syncs member fields into `groups_update.json` patches by uid.

```js
function isActiveOn(history) {
  const start = isoDay(history.start_date);
  const end = isoDay(history.end_date ?? history.leave_date);
  if (!start) return false; // undated aliases never count as active
  if (start > openingDate) return false;
  if (end && end < openingDate) return false;
  return true;
}
```

Pollution cleanup: `support/scripts/cleanupScenario6IdolPollution.mjs` removes stub duplicate idols and undated histories that match scenario group names.

## Incident timeline

| Commit | State |
|--------|--------|
| `807920e` | iLiFE! 9, Akishibu 8 in scenario_6 |
| `2a47dad` (“Refresh public data…”) | Null-date aliases appear; rosters inflate to 16 / 13 |

## Wider allowlist impact (observed)

Besides iLiFE! / Akishibu, dated rebuild also disagreed for (among others): TENRIN, のんふぃく！, 煌めき☆アンフォレント, iON!, パラディーク, ZUTTOMOTTO. Treat as systemic null-alias / refresh fallout, not one-off typos.

## Merge rules hazard

`mergeScenario6GroupsUpdate.mjs` replaces arrays from the patch. A `groups_update.json` built from main with today's members will overwrite opening-date `member_uids` for every allowlist group except the hard-excluded アキシブproject.

`sanityCheckScenario6GroupsUpdate.mjs` only checks allowlist coverage / Akishibu exclusion / whether member_count *changes* — it does **not** verify opening-date correctness. Always run `checkMainScenarioDbIntegrity.mjs` after merge.

## Correct opening canaries (2025-07-05)

**iLiFE! (9):** 心花りり, あいす, 福丸うさ, 若葉のあ, 那蘭のどか, 空詩かれん, 虹羽みに, 純嶺みき, 小熊まむ

**アキシブproject (8):** 古賀みれい, 如月なな, 平沢かえ, 水琴まなみ, 清見るん, 美山ひな, 茉井良菜, 葵ふう

Main-today may include later joins (e.g. 真守みゅう, 天川ほたる) — that is expected for main, forbidden for scenario_6 unless `opening_date` moves.
