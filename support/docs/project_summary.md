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

## Later

This file will be extended with additional summary entries as more items are discovered.

