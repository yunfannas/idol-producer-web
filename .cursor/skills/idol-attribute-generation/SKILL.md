---
name: idol-attribute-generation
description: >-
  Use when generating or reviewing idol member attributes and external-work traits
  from collected search evidence plus tier, career, age, height, training history,
  and group-specific performance floors. Consumes evidence produced by
  support/scripts/collectIdolAttributeEvidence.mjs.
---

# Idol attribute generation

Use this skill to convert collected evidence into the 18 underlying idol attributes and the external-work traits. Do not search ad hoc inside the generator unless the evidence bundle is clearly insufficient; the collector and generator are intentionally separate.

## Inputs

Required or preferred inputs per member:

- evidence bundle from `support/data/idol-attribute-evidence/*.json`
- group tier
- age
- height
- career months and prior-group months when known
- training/sports/model background when known
- group-specific floors or known performance requirements
- curated/manual overrides, if any

Collector configuration lives at `support/config/idol-attribute-search.json`.

## Output attributes

Physical:
- strength
- agility
- natural_fitness
- stamina

Appearance:
- cute
- pretty

Technical/performance:
- pitch
- tone
- breath
- rhythm
- power
- stage_presence

Mental:
- wit
- humor
- talking
- determination
- teamwork
- fashion

External-work traits, 0-400:
- singer
- dancer
- model
- comedy

Do not create a permanent archetype/role field. Profile shape is a generation-time latent only.

## Evidence interpretation

Translate evidence into one or more of four constraint types:

1. `range`: plausible absolute range, e.g. vocal 16-18.
2. `rank`: relative placement in the group, e.g. top 1-2 in dance.
3. `floor`: proven minimum, e.g. stamina >= 15 after a full large one-man.
4. `bias`: directional prior only, e.g. model trait raises pretty/fashion probability.

Prefer constraints over point values. Preserve uncertainty.

### Source hierarchy

1. direct self statement, official profile, explicit training history
2. member/producer evaluation
3. professional media with concrete description
4. repeated direct performance reporting
5. multi-source fan consensus
6. single fan source
7. procedural prior

A low-authority source should normally create only a bias, not a narrow range.

## Search phrase semantics

### Vocal

- `歌唱力`, `歌が上手い`, `生歌`, `高音`, `安定感` -> singing technique evidence
- `歌声`, `声が好き` -> mostly tone/timbre; do not automatically raise pitch or breath
- repeated important vocal parts / `落ちサビ` -> vocal rank bias, not proof by itself

### Dance/performance

- `ダンスが上手い` -> rhythm/power/agility
- `キレ` -> power/agility
- `表現力`, `ステージ映え`, `目を引く` -> stage_presence
- `振り覚えが早い` -> rhythm plus a weak wit/learning bias

### Physical

- `体力`, `スタミナ`, `体力おばけ` -> stamina
- `運動神経` -> agility/natural_fitness
- ballet -> agility/rhythm/stage_presence bias
- cheer -> agility/rhythm/stamina bias
- gymnastics -> agility/strength/natural_fitness bias
- athletics/running -> stamina/natural_fitness bias

### Communication/mental

- MC/司会/進行 -> talking, sometimes wit
- 頭の回転が速い -> wit
- 面白い/ボケ/ツッコミ -> humor, sometimes wit
- ムードメーカー -> humor + teamwork bias
- 努力家/負けず嫌い -> determination
- 長期leader/まとめ役 -> teamwork + talking + determination floor/bias

Do not collapse wit, humor, and talking into one score.

## Trait mapping

Traits represent externally usable specialization, not raw ability.

### singer

Strongly associated with pitch/tone, moderately with breath/rhythm, but requires repeated professional evidence such as solo songs, vocal projects, music-show work, or sustained main-vocal duties.

### dancer

Strongly associated with agility/rhythm/power, moderately with stage_presence/natural_fitness. Raise trait for dance projects, choreography work, long dance history, or repeated lead-dance duties.

### model

- strong positive prior on fashion
- medium/strong positive prior on pretty
- weak positive prior on stage_presence
- no automatic increase to cute

Repeated magazine, runway, brand, styling, or fashion work is the strongest evidence.

### comedy

- strong prior on humor
- medium prior on wit
- moderate prior on talking

Requires repeatable variety/comedy utility. Being talkative alone is not enough.

## Appearance generation

Do not independently randomize cute and pretty.

Generate:

1. `visual_base`
2. `cute_pretty_axis`
3. age bias
4. height bias
5. model-trait bias
6. explicit evidence

Age changes style more than total visual quality:

- <=16: stronger cute prior
- 17-21: cute and pretty both plausible
- 22-25: neutral to mild pretty bias
- 26+: stronger pretty/mature bias; do not automatically lower APP

Height is also a style prior:

- <153 cm: mild cute bias
- 153-158: neutral
- 159-164: mild pretty bias
- 165+: stronger pretty/model bias

These are soft priors only. Direct evidence overrides them.

## Stamina inference

Stamina is unusually evidence-friendly and should use career/live floors.

General anchors:

- 20-24 full-participation songs in a large one-man -> stamina floor 15
- 25-29 -> floor 16
- 30-34 -> floor 17
- 35+ high-intensity, high-quality completion -> 18 candidate

A live-heavy underground idol with repeated multi-live days, tokutenkai after shows, and a proven large one-man should rarely generate very low stamina.

Group-specific floors may override generic floors. Example calibration: iLiFE! uses stamina 18 for あいす / 空詩かれん / 純嶺みき and 17 for the other S6 opening members.

Large-live evidence raises stamina, not automatically strength/agility/natural_fitness.

## Experience

Do not add flat Ability bonuses for experience.

Career experience should:

- reduce the probability of very low professional basics
- raise stamina/breath/stage_presence/rhythm where justified
- raise determination/teamwork/talking when duties justify it

A veteran may still have weak vocal or dance attributes if those are not strengths.

Newcomer status means higher uncertainty, not automatic weakness. Strong direct evidence overrides a newcomer prior.

## Correlated generation

Use correlated clusters rather than independent draws:

- singing: pitch/tone/breath/rhythm
- dance: agility/rhythm/power/stage_presence
- physical: natural_fitness/stamina/agility
- appearance: cute/pretty with a style axis
- communication: wit/humor/talking

Actively permit weak sides. Unknown must not default to 15-16 across every attribute.

## Tier prior

Tier is a population prior and sanity check, not an ability cap.

Current rough centers:

- E: 69-71
- D: 73-75
- C: 75-78
- B: 79-80
- A: 81-83
- S: 82-84

Within-group distributions should have few head members, many middle members, and a meaningful lower tail. Avoid symmetric Gaussian all-rounder rosters.

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

Ability is derived only. Never target an Ability value and raise all attributes together to hit it.

## Sanity-check workflow

After generation:

1. calculate Radar and Ability
2. compare with group tier distribution
3. inspect outliers
4. if an outlier looks wrong, identify the missing/overweighted domain evidence
5. change the relevant underlying attributes or evidence interpretation only

Do not normalize an entire roster into a narrow band.

## Calibration examples

### High-cat / 高嶺のなでしこ

Useful shape anchors include:
- 籾山ひめり ~82, song+dance strong
- 松本ももな ~82, exceptional visual/fashion with adequate performance
- 星谷美来 ~77, stronger appearance
- 葉月紗蘭 ~72-74, vocal strong but weaker elsewhere
- 春野莉々 ~72, vocal strong with multiple weak support domains
- 城月菜央 humor 17, visual/communication shape

### iLiFE! S6 opening

Working Ability anchors:
- あいす 85
- 空詩かれん 83
- 心花りり 82
- 若葉のあ 81
- 那蘭のどか 80
- 純嶺みき 79
- 福丸うさ 78
- 虹羽みに 77
- 小熊まむ 76

This roster is a useful B-tier calibration: mean ~80, one rare 85 head, most members 77-82.

## Output recommendation

Return both the generated values and an audit block:

```yaml
attributes: {...18 values...}
traits:
  singer: 0-400
  dancer: 0-400
  model: 0-400
  comedy: 0-400
radar: {PHY, APP, SNG, DAN, MEN}
ability: N
evidence_summary:
  high_confidence: [...]
  medium_confidence: [...]
  procedural_only: [...]
constraints_applied:
  ranges: [...]
  ranks: [...]
  floors: [...]
  biases: [...]
```

Keep evidence and generation logic auditable so manual corrections can replace procedural values without rewriting the entire model.
