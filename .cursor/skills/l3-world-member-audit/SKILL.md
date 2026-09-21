---
name: l3-world-member-audit
description: >-
  Audit L3 world-simulator member-state-monthly timelines. Use after rebuilding
  data/l3-world/groups/*/member-state-monthly.jsonl, refreshing the public viewer,
  changing member attributes/palette/status/roles, or reviewing a historical
  replay for timeline leakage, roster errors, impossible transitions, or
  unexplained manual overrides.
---

# L3 World Member Timeline Audit

Use this skill for `member-state-monthly.jsonl` in the L3 world simulator.

## Scope and source-of-truth split

L3 is a **derived historical/world-simulation layer**. Do not silently rewrite
L1/L2 facts from L3 output.

Keep these layers separate:

- L1: identity, dated memberships, birthday, assigned member color, documented facts.
- L2: researched/derived historical evidence and evaluation.
- L3: month-end world state generated from L1/L2 + simulation rules.
- Viewer bundle: presentation mirror of L3 output, not a second source of truth.

Never use the current roster to repair a past month. Never use post-month evidence
to backfill a historical state unless the generator explicitly models a dated
fact whose effective date is <= that month.

Current game design also requires a three-layer opening/state model where
applicable: generated baseline -> manual adjustment -> final state. An audit must
be able to tell which layer caused a value, rather than flattening them into one
opaque number.

## Default target

For local branch-track work the preferred input is:

`support/tmp/l3-branch-track/lab/data/l3-world/groups/<slug>/member-state-monthly.jsonl`

The public viewer mirror is:

`public/data/l3-world-viewer/groups/<slug>/member-state-monthly.jsonl`

Audit source first; compare to viewer only as a mirror/parity check.

## Severity

- **ERROR**: structural or logically impossible data. The build should fail.
- **WARN**: suspicious invariant / parity problem that should be resolved before
  publishing.
- **REVIEW**: plausible historical/model transition that needs evidence or a
  generator explanation. Do not auto-fix.
- **INFO**: coverage/fallback debt that is already explicitly declared.

## Required checks

### 1. File and timeline integrity

- JSONL parses one object per month.
- unique `month`; no month gaps inside the produced interval.
- `snapshot_date` belongs to `month`.
- `group_uid` and `slug` are stable.
- source and viewer copies match when both are present.

### 2. Membership lifecycle

For every member-month:

- unique `member_uid` inside the month.
- `membership.start` is required.
- month is not before join month and not after leave month.
- first/last appearance is consistent with dated membership boundaries.
- re-entry or discontinuity must be explicit; do not treat a current member list
  as historical truth.
- flag orphan UIDs / identity drift / name changes without a stable UID.

Month boundary rule: a dated join/leave inside a month may legitimately appear in
that month-end snapshot according to the generator's documented boundary
semantics. The audit reports the boundary; it does not invent a different one.

### 3. Attribute state

Current attributes and ceilings are integers in the game domain (normally 0..20);
`current <= ceiling`.

Audit month-to-month transitions:

- ordinary growth > +1 on a single attribute => REVIEW unless explained by an
  explicit seed/rebase/manual override/event.
- any decrease => REVIEW unless the model explicitly allows it.
- multiple simultaneous +2/+3 changes => high-priority REVIEW.
- values above the documented ceiling or domain => ERROR.

Do not label a historically curated opening/re-entry seed as simulation growth.

### 4. Attribute EXP

For `member-attribute-exp/v0.1`:

- every per-attribute EXP and month gain is a non-negative integer.
- `total == sum(current)`.
- `month_gain_total == sum(month_gain)`.
- `next_level_cost` is positive.
- a level-up must be explainable by EXP cost / explicitly applied event IDs.
- large-live fact IDs must not apply twice to the same member transition.

### 5. Status / health

`morale`, `confidence`, `condition` are 0..100.

- jump > 25 month-to-month => REVIEW, not automatic ERROR.
- abnormality / health-state changes must have transition text and, when the
  record claims dated evidence, corresponding fact IDs.
- recovery after a dated event is checked for chronology, not diagnosed.

### 6. Developed palette

Required ten colors:

`red orange yellow white green aqua blue purple black pink`

- all values finite and non-negative.
- primary/secondary colors must be valid color keys.
- palette/color memory changes should be gradual unless join/re-entry/rebase or
  manual override explains a reset.
- assigned member color is an L1/curated direction, not a requirement that the
  developed palette peak must always match it.
- missing assigned colors are INFO when explicitly declared as a fallback, not a
  hard error.

### 7. Roles / policy / provenance

- active roles must have dated applicability for the month or a documented
  fallback.
- group policy intervals must cover the month where emitted.
- manual overrides require `manual_override=true` and non-empty
  `override_fields`.
- provenance/evidence IDs must not point to future-effective facts.
- changes caused by manual adjustment must remain distinguishable from generated
  baseline.

### 8. Fallback debt

Count fallback flags by month and member-month.

Known explicit fallback flags are **coverage debt**, not corruption. Report their
span and prevalence. Escalate only if a fallback contradicts a field presented as
verified/final.

### 9. Cross-layer leakage

Specifically look for:

- today roster copied backward;
- future member color/role/job evidence appearing before its effective date;
- future live achievements granting EXP before the live month;
- scenario opening facts leaking into earlier historical replay;
- viewer override/revision fields being mistaken for source L3 data.

## Outputs

Run:

```bash
node support/scripts/auditL3MemberStateMonthly.mjs --group akishibu
```

Optional:

```bash
node support/scripts/auditL3MemberStateMonthly.mjs \
  --group akishibu \
  --input support/tmp/l3-branch-track/lab/data/l3-world/groups/akishibu/member-state-monthly.jsonl \
  --out-dir support/reports/l3-world-audit/akishibu
```

The audit writes:

- `audit.json` — machine-readable summary/findings.
- `audit.md` — human review.
- `review-queue.jsonl` — only WARN/REVIEW items suitable for follow-up.

Do not auto-edit historical L3 data. Generate a patch suggestion / review queue
first. Automatic fixes are limited to mechanically safe formatting/parity work
and only when the user explicitly asks.

## Completion gate

Before calling a timeline audited:

- [ ] zero ERROR
- [ ] every WARN resolved or explicitly accepted
- [ ] REVIEW items have evidence/transition explanations or remain in queue
- [ ] fallback coverage summarized, not hidden
- [ ] source/viewer parity checked when both files exist
- [ ] no future-fact leakage
- [ ] no silent current-roster backfill
