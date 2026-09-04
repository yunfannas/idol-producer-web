---
name: idol-attribute-generation
description: >-
  Use when generating or reviewing idol member attributes and external-work traits
  from collected search evidence plus tier, full career history, historical group-tier
  exposure, age, height, training history, and group-specific performance floors.
  Consumes evidence produced by support/scripts/collectIdolAttributeEvidence.mjs.
---

# Idol attribute generation

Generate the 18 underlying idol attributes and 0-400 external-work traits from searchable evidence plus structured member context. The collector and generator are intentionally separate.

## Required inputs

Prefer, in order:

- evidence bundle from `support/data/idol-attribute-evidence/*.json`
- current group tier
- `career_history[]` from `support/data/idol-career-context.json`
- historical `tier_exposure` for each career segment from `support/data/group-tier-history.json`
- age and height
- training/sports/model background
- group-specific stamina/live floors
- curated/manual attribute constraints

`prior_group_months` is only a fallback summary. If `career_history[]` exists, use the segments and their historical context instead of treating all prior months as equivalent.

## Output attributes

Physical: `strength`, `agility`, `natural_fitness`, `stamina`

Appearance: `cute`, `pretty`

Technical/performance: `pitch`, `tone`, `breath`, `rhythm`, `power`, `stage_presence`

Mental: `wit`, `humor`, `talking`, `determination`, `teamwork`, `fashion`

External-work traits, 0-400: `singer`, `dancer`, `model`, `comedy`

Do not create a permanent archetype/role field. Profile shape is generation-time latent only.

## Hard generation rules

1. **Never target Ability.** Generate attributes first; derive Ability only at the end. Calibration Ability values are validation anchors, never optimization targets.
2. **Range is a hard clamp.** If a constraint says 16-18, output must be inside 16-18 unless a higher-authority curated override explicitly supersedes it.
3. **Floor is a hard minimum, not an attractor.** `stamina >= 17` does not mean “prefer 18”. Draw normally above the floor only when separate evidence supports it.
4. **Rank is roster-relative.** Satisfy the ordering without inventing an absolute elite value.
5. **Bias is probabilistic only.** A bias may influence a latent draw but cannot behave like a hidden hard bonus.
6. **Unknown is neither good nor bad.** Absence of searchable praise must not become a negative rating.

## Evidence constraints

Translate evidence into:

- `range`: plausible absolute interval
- `rank`: relative group placement
- `floor`: proven minimum
- `bias`: directional prior

Source hierarchy:

1. self statement / official profile / explicit training history
2. member or producer evaluation
3. professional media concrete description
4. repeated direct performance reporting
5. multi-source fan consensus
6. single fan source
7. procedural prior

Low-authority evidence should normally create a bias, not a narrow range.

## Search phrase semantics

### Vocal

- `歌唱力`, `歌が上手い`, `生歌`, `高音`, `安定感` -> singing technique
- `歌声`, `声が好き` -> mainly tone/timbre, not automatic pitch/breath
- repeated important vocal parts / `落ちサビ` -> vocal rank bias

### Dance / performance

- `ダンスが上手い` -> rhythm/power/agility
- `キレ` -> power/agility
- `表現力`, `ステージ映え`, `目を引く` -> stage_presence
- `振り覚えが早い` -> rhythm plus weak learning/wit bias

### Physical

- `体力`, `スタミナ`, `体力おばけ` -> stamina
- `運動神経` -> agility/natural_fitness
- ballet -> agility/rhythm/stage_presence bias
- cheer -> agility/rhythm/stamina bias
- gymnastics -> agility/strength/natural_fitness bias
- athletics/running -> stamina/natural_fitness bias

### Communication / mental

- MC/司会/進行 -> talking, sometimes wit
- 頭の回転が速い -> wit
- 面白い/ボケ/ツッコミ -> humor, sometimes wit
- ムードメーカー -> humor + teamwork bias
- 努力家/負けず嫌い -> determination
- long-term leader/まとめ役 -> teamwork + talking + determination floor/bias

Do not collapse wit, humor and talking.

## Full career-history inference

Each career segment may contain:

```yaml
group_uid: ...
group_name: ...
start_date/start_year: ...
end_date/end_year: ...
approximate_months: ...
tier_exposure:
  S3: {tier: C, status: active, confidence: curated}
  S4: {tier: C, status: active, confidence: curated}
```

### Why historical tier matters

Two idols with 60 prior-group months are not necessarily equivalent. Long service in a high-frequency, professionally demanding C/B group is stronger evidence of professional basics than the same duration in a small or lightly active E group.

Historical group tier is **context**, not an attribute bonus. It may regularize only abilities plausibly exercised by sustained professional idol work.

### Career-derived professional basics

Long active career, especially with C+ tier exposure, can reduce the chance of implausibly low values in:

- stamina
- breath
- rhythm
- stage_presence
- teamwork
- determination
- talking only when role/public evidence supports it

It does **not** automatically raise:

- pitch or tone
- cute or pretty
- humor or wit
- strength
- fashion
- raw dance power/agility without dance evidence

A veteran can remain a weak singer or dancer. Historical tier should prevent an experienced professional from being treated like an unevidenced rookie, not make her an all-rounder.

### Duration weighting

Use duration as a soft evidence weight, not a flat additive bonus. Rough interpretation:

- <6 months: little regularization
- 6-18 months: some professional-floor evidence
- 18-36 months: meaningful sustained-work evidence
- 36+ months: strong evidence that repeated professional basics were actually exercised

Multiple segments accumulate context, but do not double-count overlapping dates.

### Tier exposure weighting

Use broad strength only:

- E: weak professional-load evidence
- D: ordinary live-idol professional-load evidence
- C: established professional live-idol evidence
- B: strong sustained professional-load evidence
- A/S: very strong professional environment, but still not proof of every personal skill

Do not infer historical tier when the tier-history slot is `unknown`. Unknown must remain unknown.

### Group style and workload

If separate evidence says the group is unusually live-heavy, dance-heavy, or performs long one-man sets, that workload evidence may matter more than market tier. Tier and workload are separate concepts.

## Unknown-domain prior

Do not use either of these shortcuts:

```text
unknown -> 15-16 everywhere
unknown -> 12-14 everywhere
```

Instead derive an unknown-domain prior from:

1. current tier population
2. full career duration and historical tier exposure
3. training background
4. group workload floors
5. latent personal profile shape

Then draw correlated values. Strong known domains should not force all unknown domains downward merely to preserve a target Ability.

## Trait mapping

Traits represent externally usable specialization/career capital, not raw ability.

### singer
Strongly associated with pitch/tone and moderately breath/rhythm, but high trait requires repeated vocal-specific professional evidence.

### dancer
Strongly associated with agility/rhythm/power and moderately stage_presence/natural_fitness. Raise for dance projects, choreography, long dance history or repeated lead-dance duties.

### model
- fashion strong positive prior
- pretty medium/strong positive prior
- stage_presence weak positive prior
- no automatic cute increase

### comedy
- humor strong prior
- wit medium prior
- talking moderate prior

Being talkative alone is not high comedy trait.

## Appearance generation

Generate correlated `cute`/`pretty` from:

`visual_base + cute_pretty_axis + age + height + model trait + explicit evidence`

Age changes style more than total quality:
- <=16: stronger cute prior
- 17-21: both plausible
- 22-25: neutral / mild pretty
- 26+: stronger pretty/mature bias; no automatic APP penalty

Height:
- <153 cm: mild cute bias
- 153-158: neutral
- 159-164: mild pretty bias
- 165+: stronger pretty/model bias

## Stamina inference

General anchors:
- 20-24 full-participation songs in a large one-man -> floor 15
- 25-29 -> floor 16
- 30-34 -> floor 17
- 35+ high-intensity, high-quality completion -> 18 candidate

A live-heavy underground idol with regular shows, tokutenkai and proven large one-man experience should rarely have very low stamina.

S6 iLiFE calibration is **exactly a floor/profile example, not a group-wide 18 target**:
- stamina 18: あいす / 空詩かれん / 純嶺みき
- stamina 17: other S6 opening members unless separate evidence justifies higher

Large-live evidence does not automatically raise strength/agility/natural_fitness.

## Correlated profile generation

Use correlated clusters:
- singing: pitch/tone/breath/rhythm
- dance: agility/rhythm/power/stage_presence
- physical: natural_fitness/stamina/agility
- appearance: cute/pretty
- communication: wit/humor/talking

Allow real weak sides. A veteran/career floor should regularize professional basics, not erase specialization.

## Tier prior

Current rough member Ability centers are sanity checks only:
- E: 69-71
- D: 73-75
- C: 75-78
- B: 79-80
- A: 81-83
- S: 82-84

Never solve backwards from these values. Within rosters use few heads, many middle members, and a meaningful lower tail.

## Radar formulas

- PHY = `(strength + agility + natural_fitness + stamina) / 4`
- APP = `((max(cute, pretty) + min(cute, pretty) / 4) / 5) * 4`
- SNG = `(pitch + tone + breath + rhythm) / 4`
- DAN = `(rhythm + power + stage_presence) / 3`
- MEN = `(wit + humor + talking + determination + teamwork + fashion) / 6`

## Ability formula

```text
physicalPart = (strength + agility + natural_fitness + stamina) / 16 * 3
appearancePart = max(cute, pretty) + min(cute, pretty) / 4
technicalPart = (pitch + tone + breath + rhythm + power + stage_presence) / 3
mentalPart = (wit + humor + talking + determination + teamwork + fashion) / 6
ability = floor(physicalPart + appearancePart + technicalPart + mentalPart)
```

## Validation, not targeting

After generation:

1. validate every hard range and floor
2. validate roster-relative rank constraints
3. calculate Radar and Ability
4. compare Ability distribution with tier and known calibration anchors
5. report deviations without rewriting attributes to hit an anchor

If a result looks wrong, diagnose missing evidence, career context, workload floor or prior shape. Do not add +1 everywhere.

Known calibration anchors are test expectations, not inputs to the draw. In a blind/pilot run, hide them until generation is complete when possible.

## Output audit block

```yaml
attributes: {...18 values...}
traits: {singer, dancer, model, comedy}
radar: {PHY, APP, SNG, DAN, MEN}
ability: N
career_context_used:
  segments: [...]
  historical_tier_exposure: [...]
evidence_summary:
  high_confidence: [...]
  medium_confidence: [...]
  procedural_only: [...]
constraints_applied:
  ranges: [...]
  ranks: [...]
  floors: [...]
  biases: [...]
constraint_validation:
  passed: true|false
  violations: [...]
```

Keep the evidence, career context, constraints and final values auditable.
