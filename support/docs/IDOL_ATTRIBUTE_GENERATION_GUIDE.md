# Idol Attribute Generation Guide

Status: active design guide for world-generation member attributes and traits.

This guide defines a two-stage pipeline:

1. **Collector script**: reproducibly gathers search-friendly evidence candidates.
2. **Agent generator**: interprets those candidates together with tier, career, age, height, training history, and group constraints to produce the 18 attributes and 0-400 external-work traits.

The collector intentionally does **not** score attributes. Search rules and generation rules must stay separable so that generation logic can evolve without re-running every web search.

## Files

- Search config: `support/config/idol-attribute-search.json`
- Collector: `support/scripts/collectIdolAttributeEvidence.mjs`
- Generator skill: `.cursor/skills/idol-attribute-generation/SKILL.md`
- Default evidence output: `support/data/idol-attribute-evidence/`

## Quick start

Set a Brave Search API key:

```bash
export BRAVE_SEARCH_API_KEY=...
```

Collect one member:

```bash
node support/scripts/collectIdolAttributeEvidence.mjs \
  --member "虹羽みに" \
  --group "iLiFE!" \
  --tier B \
  --age 15 \
  --height 150
```

Collect a batch from JSON:

```bash
node support/scripts/collectIdolAttributeEvidence.mjs \
  --input support/data/member-attribute-input.json
```

Example batch input:

```json
[
  {
    "uid": "member-uid",
    "name": "虹羽みに",
    "group": "iLiFE!",
    "tier": "B",
    "age": 15,
    "height_cm": 150,
    "career_months": 2,
    "prior_group_months": 0,
    "training_background": null
  }
]
```

The collector writes one JSON evidence bundle per member. That bundle is the normal input to the `idol-attribute-generation` agent skill.

## Collector responsibility

The collector should answer only:

- What queries were run?
- What result titles/snippets/URLs were returned?
- Which configured keywords appeared?
- What rough source class does the result appear to belong to?

It must not answer:

- Is pitch 17 or 18?
- Is the member a vocal ace?
- What should Ability be?
- What should a trait value be?

Those are generator decisions.

## Search-friendly evidence principle

The world database may contain hundreds or thousands of idols. Therefore ordinary generation must rely primarily on evidence that can be found by predictable text searches.

High-value searchable evidence includes:

- official profiles
- member interviews
- producer/member evaluations
- professional media features
- live reports with explicit descriptions
- repeated fan consensus
- external work history
- explicit training/sports history

Observation-heavy evidence such as frame-by-frame live review is reserved for high-priority manual research and playable groups.

## Search domains

The collector config organizes searches into these semantic groups:

### Vocal

Typical terms:

- 歌唱力
- 歌が上手い
- 歌声
- ボーカル
- 生歌
- 高音
- 安定感
- 落ちサビ

### Dance / performance

- ダンス
- キレ
- 表現力
- パフォーマンス
- ステージ映え
- 目を引く
- 振り覚え

### Physical / stamina

- 体力
- スタミナ
- 体力おばけ
- 運動神経
- スポーツ
- バレエ
- チア
- 体操
- 陸上

### Appearance / model

- ビジュアル
- かわいい / 可愛い
- 美人
- モデル
- ファッション
- おしゃれ
- コーデ
- ランウェイ
- 雑誌

### MC / comedy

- MC
- トーク
- 面白い
- バラエティ
- ムードメーカー
- 司会 / 進行
- ツッコミ / ボケ

### Mental / professionalism

- 努力家
- 負けず嫌い
- リーダー
- メンバー思い
- まとめ役

### External-work traits

Look for repeated professional use:

- singer: solo songs, vocal projects, music shows, repeated main-vocal duties
- dancer: dance projects, choreography, long dance background, repeated lead-dance duties
- model: magazines, runway, brand work, styling/fashion work
- comedy: variety work, comedy formats, repeatable MC/comedic utility

## Evidence constraint model

The generator should convert evidence to four types of constraints.

### Range

An absolute plausible interval.

Example:

```yaml
vocal:
  range: [16, 18]
  confidence: high
```

### Rank

A relative group constraint.

Example:

```yaml
dance:
  rank: group_top_quartile
```

This is preferred when a source says “group's best dancer” but does not justify an exact score.

### Floor

A proven minimum.

Example:

```yaml
stamina:
  floor: 15
```

### Bias

A directional probability adjustment.

Example:

```yaml
appearance:
  pretty_bias: positive
```

Low-authority or ambiguous evidence should usually remain a bias rather than becoming a hard range.

## Stamina as a special case

Stamina has unusually useful real-world proxies.

Working anchors:

| Proven workload | Stamina inference |
|---|---:|
| 20-24 full-participation songs in a large one-man | floor 15 |
| 25-29 songs | floor 16 |
| 30-34 songs | floor 17 |
| 35+ high-intensity, high-quality completion | candidate 18 |

For underground idols, regular live frequency plus post-live tokutenkai is additional evidence. A mature live-idol member who has repeatedly completed large one-man shows and long benefit-event days should rarely generate stamina 11-13 without explicit contrary evidence.

Do not transfer a stamina floor to strength, agility, or natural_fitness automatically.

### iLiFE! calibration

S6 working stamina anchors:

- あいす: 18
- 空詩かれん: 18
- 純嶺みき: 18
- other S6 opening members: 17

The 38-song iLiFE! case is an extreme endurance example; a more ordinary large one-man around 22 songs corresponds well to stamina ~15.

## Appearance generation

`cute` and `pretty` are correlated and must not be generated independently.

Use:

```text
visual_base
+ cute/pretty style axis
+ age prior
+ height prior
+ model trait prior
+ explicit evidence
```

Age and height primarily influence **style**, not total visual value.

### Age prior

- <=16: stronger cute prior
- 17-21: both cute and pretty plausible
- 22-25: neutral / mild pretty bias
- 26+: stronger mature/pretty bias

Do not automatically reduce APP because a member is older.

### Height prior

- <153 cm: mild cute bias
- 153-158: neutral
- 159-164: mild pretty bias
- 165+: stronger pretty/model bias

### Model trait

A model-specialized member should usually have:

- clearly higher `fashion` prior
- higher `pretty` prior
- sometimes a mild `stage_presence` prior

Model trait does not automatically raise `cute`.

## Experience and newcomer handling

Do not apply a flat Ability modifier for career experience.

Experience is a regularizer that can support:

- stamina
- breath
- rhythm
- stage_presence
- determination
- teamwork
- talking when role history supports it

Newcomer status means uncertainty and less proven professional floor, not low skill. A selected newcomer can already have vocal/dance values around 14-16 or higher.

## Correlated profile generation

Unknown attributes must not default to 15-16.

Generate a latent personal profile shape, then correlated substats. Example shapes include:

- balanced
- vocal-leaning
- dance-leaning
- visual-leaning
- communication-leaning
- physical-leaning
- multi-specialist
- strongly uneven
- high-potential newcomer

The shape exists only during generation and is not stored as an old-style permanent role.

## Trait vs attribute distinction

Attributes describe what the idol can currently do.

Traits describe externally usable specialization and accumulated career capital.

Examples:

- A member can have pitch/tone 18 but low singer trait if she has almost no vocal-specific external career.
- A high model trait normally implies repeat fashion/model work and should bias pretty/fashion upward.
- A talkative member is not automatically high comedy trait.

## Ability distribution

Ability is derived, never directly generated.

Current rough population centers:

| Tier | Rough member center |
|---|---:|
| E | 69-71 |
| D | 73-75 |
| C | 75-78 |
| B | 79-80 |
| A | 81-83 |
| S | 82-84 |

These are priors, not hard ranges or caps. Within a group, use few head members, many middle members, and a meaningful lower tail rather than a symmetric Gaussian roster.

## Calibration rosters

### 高嶺のなでしこ

Current useful anchors:

- 籾山ひめり ~82
- 松本ももな ~82
- 東山恵里沙 ~78
- 城月菜央 ~77-78, humor 17
- 星谷美来 ~77, stronger appearance
- 葉月紗蘭 ~72-74, vocal strength
- 春野莉々 ~72, vocal strength with weaker supporting domains

This demonstrates that a C-tier roster can contain both 82-level heads and low-70 specialist members.

### iLiFE!

Current working Ability calibration:

| Member | Ability |
|---|---:|
| あいす | 85 |
| 空詩かれん | 83 |
| 心花りり | 82 |
| 若葉のあ | 81 |
| 那蘭のどか | 80 |
| 純嶺みき | 79 |
| 福丸うさ | 78 |
| 虹羽みに | 77 |
| 小熊まむ | 76 |

Mean is about 80. This is a useful strong-B-tier exemplar: one rare 85 head and most of the roster in 77-82.

## Generation precedence

Use this order:

1. curated/manual override
2. high-confidence direct evidence
3. relative ranking constraints
4. career/group floors
5. trait priors
6. age/height/training priors
7. group/tier population prior
8. profile-shape randomness

After generation, derive Radar and Ability and run a sanity check. If the result appears wrong, fix the missing or overweighted domain evidence; never add +1 to every attribute merely to reach a desired Ability.
