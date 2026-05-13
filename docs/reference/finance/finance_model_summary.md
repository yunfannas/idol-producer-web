# Finance Model Summary

## Scope

This document summarizes the current finance modeling inputs and outputs used in `database/finance/`.

Primary sources:
- `group_finance.json` (shared assumptions)
- `monthly_live_counts_by_letter_tier_template.csv` (live-count matrix)
- `typical_tier_*.json` (tier scenarios)
- `tier_survival_assessment_s_through_f.json` (current survival snapshot)

## Core Structure

- Shared assumptions are centralized in `group_finance.json`.
- Tier scenario files (`typical_tier_s_group.json` ... `typical_tier_f_group.json`) are derived from:
  - live-frequency matrix,
  - tier policy ladders (salary, staff, costume, admin/training, compensation),
  - selected per-live net assumptions.
- Type `S` is treated as an overlay live type, not an independent cadence axis.

## Live Frequency Model

Input matrix file:
- `monthly_live_counts_by_letter_tier_template.csv`

Columns:
- `type_1` ... `type_7` = average monthly occurrences
- `type_6_venue_rank` = venue rank reference for type 6 one-man by tier row

Type `S` rule:
- Not a standalone column in the matrix.
- Monthly `S` frequency is derived from roster size:
  - `member_count × S_events_per_member_per_year ÷ 12`
- Host type is scenario-specific (e.g., `S on 6` for C, `S on 7` in lower tiers).

## Compensation Policy by Tier

From `group_finance.json` -> `member_compensation_by_letter_tier`:

- Base salary multiplier vs default monthly base salary:
  - S: 1.6
  - A: 1.45
  - B: 1.3
  - C: 1.15
  - D: 1.0
  - E: 1/3
  - F: 0 (no base salary)

- Tokutenkai sales bonus rate:
  - S: 0.12
  - A: 0.12
  - B: 0.11
  - C: 0.11
  - D: 0.10
  - E: 0.10
  - F: 0.10

- Tier F override:
  - no base salary
  - 10% tokutenkai bonus
  - hair/make budget disabled

## Goods, CD, and Commercial Models

### Live goods
From `live_goods_model`:
- No goods sales on host live types 4, 5, 7
- Goods sales can exist on host types 1, 2, 3, 6
- Tier-based average price and buying pieces are defined in shared config

### CD model
From `cd_sales_model`:
- Average net income: `¥1,500` per CD sold
- Online signing load: `30s` per CD for the allocating member
- Digital sales and MV watch/stream revenue are intentionally excluded in this block

### Commercial income guess (S/A/B)
From `commercial_income_guess_letter_tier_s_through_b`:
- Includes gross and group-net estimates; assumes agencies retain most of the gross
- **Group-net commercial (JPY / month)**: S `¥5,000,000`; B `¥585,000`; A **linear-interpolated** between S and B → `¥2,792,500` (so the **typical S/A/B** scenarios keep the **final monthly** ladder S `+¥15M` / A `+¥9.5M` / B `+¥4M` with live-side scaling where needed)

## Staffing and Operating Ladders

- Staff count ladder by tier and member count (`staff_count_by_group_letter_tier`)
- Costume refresh ladder by tier
- Admin/training monthly ladder by tier
- Baseline tokutenkai assumptions for type 4 are shared

## Current Survival Snapshot (S-F)

Source:
- `tier_survival_assessment_s_through_f.json`

Current modeled monthly final balance (JPY):
- S: `+15,000,000`
- A: `+9,500,000`
- B: `+4,000,000`
- C: `+2,139,817`
- D: `+751,203`
- E: `+95,750`
- F: `+14,605`

All tiers are currently modeled as surviving under the latest assumptions, with E/F near break-even.

## Notes / Caveats

- These are model assumptions, not audited real-world unit economics.
- Per-live net anchors heavily influence survival outcomes.
- E/F outcomes are sensitive to small changes in:
  - per-live net,
  - staff/admin burden,
  - frequency mix.
- If assumptions change, regenerate all tier scenario files from a single pipeline for consistency.
