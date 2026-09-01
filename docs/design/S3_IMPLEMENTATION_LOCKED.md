# S3 Featured Trial — Locked Implementation Spec

Status: **Approved by producer** (2026-08-31)

## Demo endpoint

**Stop after post-TIF agency review meeting** (~Aug 8–10, 2017).

Not a score screen. Narrative closure: audition outcome, roster, staff ops, budget, TIF debut, media response, next objectives (Sep 6 commercial debut, etc.).

## UI

- **Idols tab** with sub-filter: **Candidates** | **Selected members** (no separate Audition nav).
- S3-only; Scenario 6 unchanged.

## First cut (Apr 15)

**Hybrid C:**

1. Player chooses survivor **count** (staff recommend 20–30).
2. System auto-selects by staff composite scores.
3. Player may override **~5 borderline** keep/cut decisions before confirming.

## Knowledge

**Block April gameplay until Attribute V2 + staff estimates ship.**

- 17-attribute V2 model (master design).
- Panel shows **staff-team estimate** (range / fuzzy), not true values.
- Player character (指原): exact fatigue + effective attrs when relevant.

## Direct interaction v1

Single action: **Interview (45 min)**

- Advances game clock 45 minutes.
- Small knowledge convergence on 1–2 attributes for that candidate.
- Optional trait hint text (evidence, not confirmed trait).

## Dual-role schedule (demo + full S3)

**Model B:** Calendar blocks on HKT / AKB / media days limit producer actions (not full parallel sim).

- Example: Apr 7 HKT live → reduced producer time budget that day.
- Influence buff remains opportunity-side only.

## Historical candidate research

Public sources do **not** publish the 90 non-selected names from the 103-person final pool.

**Verified additions (Type 2 — real person, weak pre-idol identity):**

| Name | Notes | Source |
|------|-------|--------|
| 蒼乃爽 | Reached =LOVE 2017 final audition; did not pass | Entame NEXT interview 2026 |

**Type 1 (13 historical finalists):** unchanged from build script.

**Pool fill:** generated candidates for remainder to 103; `historical_related: true` only when sourced.

Research file: `public/data/scenarios/scenario_3/historical_candidates_research.json`

## Implementation sequence

1. Attribute V2 + staff knowledge + S3 idol data migration
2. Idols Candidates / Selected filter + estimate panels
3. Interview action + time clock
4. Dual-role day blocks
5. Apr 3–29 audition loop (reports, first cut, final selection)
6. Apr 7 HKT Highlight tutorial
7. May–Jul simplified training / delegation
8. Aug 5 TIF Highlight + imperfect staff report
9. Agency review meeting (demo end)
