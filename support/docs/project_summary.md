# Project Summary

## 2026-07-26 — Scenario 6: corruption fix + landing copy update

- Fixed **major Scenario 6 roster corruption** (notably `iLiFE!` and `アキシブproject`) caused by undated `group_history` alias rows being treated as “active” during a scenario refresh.
- Hardened `support/scripts/refreshScenario6GroupMembers.mjs` to **require `start_date`** (undated aliases never count as active) and to rebuild rosters for the full Scenario 6 group set.
- Added/updated an automated integrity checker:
  - `support/scripts/checkMainScenarioDbIntegrity.mjs`
  - Cursor skill: `.cursor/skills/scenario-db-integrity/` (`SKILL.md` + `reference.md`)
- Removed scenario-idol pollution:
  - stub duplicate idols (same display name; not referenced by group rosters)
  - undated group-history aliases that match scenario group identity
- Verified with:
  - `node support/scripts/checkMainScenarioDbIntegrity.mjs` (PASS)

### User-facing copy

- Updated Scenario 6 landing copy:
  - `public/data/scenarios/presets/scenario6.json`
  - Title: `Scenario 6: Festivals and Challenges`
  - Background/description (EN + ZH) to match the new theme.
- Updated desktop reference landing label to match:
  - `support/reference/python-desktop/main_ui.py`

## 2026-07-27 — Group `x_followers` field (idolsdiagram / mid-2025)

- Added group-level `x_followers` (+ `x_followers_source`, `x_followers_as_of`) on main and scenario_6 groups.
- Backfilled from existing idolsdiagram follower counts stored in `fans` (idolsdiagram is always live/latest; this snapshot is treated as **mid-2025**, `as_of=2025-07-01`).
- Script: `support/scripts/backfillGroupXFollowersFromIdolsdiagram.mjs`.
- Group detail UI now shows X followers; `group_tier_policy.json` documents the vintage rule.

## 2026-07-27 — Re-evaluate scenario 6 tiers with X followers

- Separated metrics: **`fans` = Spotify followers** (idolsdiagram); **`x_followers` = sum of active members' X** (not a fans mirror).
- Inference **D/E/F** from **Spotify fans**. **d_floor = 2822** (ドラマチックレコード); e_floor = 15%. Manual exception: UtaGe! D.
- Inactive → **`I`** (80). Counts: S5 A4 B10 C25 D136 E205 F10 I80.
- Script: `support/scripts/separateGroupFansAndXFollowers.mjs`, `reevaluateScenario6TiersWithX.mjs`

## 2026-07-27 — Merge duplicate HEROINES Kenkyuusei

- Removed stray English group row `HEROINES Kenkyuusei` (`acdd5738-…`) from main + scenario_6 `groups.json`.
- Canonical unit kept: `ヒロインズ研究生` (`9b937bbf-…`), with `name_romanji` set to `HEROINES Kenkyuusei`.
- Retargeted / dropped duplicate idol `group_history` rows (main + scenario_6); removed EN uid from `group_tiers.json`.
- Script: `support/scripts/mergeHeroinesKenkyuuseiDuplicate.mjs`.

## Later

This file will be extended with additional summary entries as more items are discovered.

