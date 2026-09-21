# L3 member-state audit — akishibu

Baseline: `4201332696cbe5db830669abcb1641656c4fd612` (Refresh AKSB member roles and colors)

Input audited: `public/data/l3-world-viewer/groups/akishibu/member-state-monthly.jsonl`

> Local source-of-truth should be re-run from
> `support/tmp/l3-branch-track/lab/data/l3-world/groups/akishibu/member-state-monthly.jsonl`
> with the committed audit runner. This smoke result audits the published viewer
> blob from the same baseline commit.

## Summary

- Range: 2012-10 → 2026-09
- Month rows: 168
- Unique members: 47
- Member-months: 1395
- ERROR: 0
- WARN: 0
- REVIEW: 9
- JSON/schema/range/member-lifecycle hard failures: none in smoke pass

## REVIEW

### 茉井良菜 — 2025-04 → 2025-05 multi-attribute jump

Eight attributes rise by +2 in one monthly transition:

- physical.agility 15 → 17
- physical.natural_fitness 15 → 17
- physical.stamina 14 → 16
- performance.pitch 14 → 16
- performance.breath 14 → 16
- performance.rhythm 15 → 17
- performance.power 14 → 16
- mental.teamwork 14 → 16

This is plausible as a curated rebase / verified-event adjustment, but should not be
accepted as ordinary monthly training growth without an explicit transition/event
explanation. Keep as REVIEW; do not auto-normalize.

### 美山ひな — 2025-08 → 2025-09 condition jump

- condition 100 → 45

A large health/condition move can be historically correct. Require the dated health
event / transition provenance to explain it. Keep as REVIEW; do not auto-smooth.

## Declared fallback coverage

Group-level fallback flags observed across the published timeline:

- `member_palette_phaseout_reactivation_not_yet_replayed`: 168 months
- `operating_exposure_baseline_for_missing_activity_coverage`: 168 months
- `team_palette_not_yet_defined_before_first_release`: 30 months
- `missing_assigned_member_color`: 141 months
- `historical_member_entry_profile_l3_fallback`: 126 months
- `venue_capacity_proxy_pending_l1_normalization`: 11 months

These are coverage debt, not automatic data corruption. The audit agent reports
their span/prevalence and escalates only when a field simultaneously claims
verified/final provenance.

## Next gate

Run locally:

```bash
node support/scripts/auditL3MemberStateMonthly.mjs --group akishibu
```

The runner prefers the local L3 source under `support/tmp/l3-branch-track/lab/`
and compares it with the public viewer mirror when both are available.
