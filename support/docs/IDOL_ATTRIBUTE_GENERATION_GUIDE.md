# Idol Attribute Generation Guide

Status: active design guide for world-generation member attributes and traits.

This guide defines a two-stage pipeline:

1. **Collector script**: reproducibly gathers search-friendly evidence candidates.
2. **Generator**: interprets those candidates together with tier, career, age, height, training history, and structured performance facts to produce the 17 visible attributes, optional hidden personality, and 0-400 external-work traits.

The collector intentionally does **not** score attributes. Search rules and generation rules must stay separable so that generation logic can evolve without re-running every web search.

## Files

- Search config: `support/config/idol-attribute-search.json`
- Catalog-to-input builder: `support/scripts/buildMemberAttributeInput.mjs`
- Collector: `support/scripts/collectIdolAttributeEvidence.mjs`
- Structured performance facts: `support/data/member-performance-evidence.json`
- Evidence-driven V2 generator: `support/scripts/generateIdolAttributesFromEvidence.mjs`
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

Build a batch from dated catalog history, then collect its evidence:

```bash
node support/scripts/buildMemberAttributeInput.mjs \
  --group "アキシブproject" \
  --idols public/data/scenarios/scenario_6/idols.json \
  --groups public/data/scenarios/scenario_6/groups.json \
  --reference-date 2025-07-05 \
  --out support/data/member-attribute-input.json

node support/scripts/collectIdolAttributeEvidence.mjs \
  --input support/data/member-attribute-input.json

node support/scripts/generateIdolAttributesFromEvidence.mjs \
  --input support/data/member-attribute-input.json \
  --evidence-dir support/data/idol-attribute-evidence \
  --performance-evidence support/data/member-performance-evidence.json \
  --group "アキシブproject" \
  --verify
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
    "career_reference_date": "2025-07-05",
    "prior_groups": [],
    "incomplete_prior_groups": [],
    "career_summary": "",
    "performance_evidence": [],
    "training_background": null
  }
]
```

The builder ignores null/null aliases, preserves end-dated rows with an unknown start in `incomplete_prior_groups`, merges overlapping dated memberships for career duration, and calculates age at the supplied reference date. An incomplete row never contributes guessed months. The collector writes one JSON evidence bundle per member, preserving the resulting career context for the `idol-attribute-generation` agent skill.

`performance_evidence` contains observations such as song difficulty, assigned part difficulty, and completion quality. It must never contain a target attribute, Radar, Ability, or trait score. This keeps evidence collection separate from score generation.

## Adaptive search strategy

The collector now uses **three broad searches first**, then only fills evidence gaps.

### Broad search 1: performance

Covers vocal + dance/performance in one query.

Typical query shape:

```text
"{name}" "{group}" 歌 歌唱力 ボーカル ダンス パフォーマンス 表現力
```

### Broad search 2: visual + personality

Covers appearance/model + MC/comedy.

```text
"{name}" "{group}" ビジュアル かわいい 美人 モデル ファッション MC トーク 面白い
```

### Broad search 3: background + physical

Covers stamina, sports/training background, professionalism and trait clues.

```text
"{name}" "{group}" インタビュー プロフィール 体力 スタミナ 運動神経 ダンス歴 バレエ チア 努力家 リーダー
```

After those three searches, the script computes coarse domain coverage from returned titles/snippets. Missing domains trigger targeted queries only within the tier budget.

Current maximum targeted follow-ups:

| Tier | Broad | Max follow-ups | Max total |
|---|---:|---:|---:|
| E | 3 | 0 | 3 |
| D | 3 | 0 | 3 |
| C | 3 | 1 | 4 |
| B | 3 | 2 | 5 |
| A | 3 | 3 | 6 |
| S | 3 | 3 | 6 |

This is a ceiling, not a required count. If the broad searches already expose useful evidence across domains, no extra query is needed.

The output records `initial_coverage`, `final_coverage`, and the number of broad/targeted searches so future tuning can be measured rather than guessed.

## Collector responsibility

The collector should answer only:

- What queries were run?
- What result titles/snippets/URLs were returned?
- Which configured keywords appeared?
- What rough source class does the result appear to belong to?
- Which evidence domains appear covered enough to skip follow-up searches?

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

## Evidence domains

### Vocal

Typical terms: 歌唱力, 歌が上手い, 歌声, ボーカル, 生歌, 高音, 安定感, 落ちサビ.

### Dance / performance

ダンス, キレ, 表現力, パフォーマンス, ステージ映え, 目を引く, 振り覚え.

### Physical / stamina

体力, スタミナ, 体力おばけ, 運動神経, スポーツ, バレエ, チア, 体操, 陸上.

### Appearance / model

ビジュアル, かわいい / 可愛い, 美人, モデル, ファッション, おしゃれ, コーデ, ランウェイ, 雑誌.

### MC / comedy

MC, トーク, 面白い, バラエティ, ムードメーカー, 司会 / 進行, ツッコミ / ボケ.

### Mental / professionalism

努力家, 負けず嫌い, リーダー, メンバー思い, まとめ役.

### External-work traits

Look for repeated professional use:

- singer: solo songs, vocal projects, music shows, repeated main-vocal duties
- dancer: dance projects, choreography, long dance background, repeated lead-dance duties
- model: magazines, runway, brand work, styling/fashion work
- comedy: variety work, comedy formats, repeatable MC/comedic utility

Traits measure specialization progress, not job eligibility: an idol can accept the related work even with no trait score. Use 100-199 for novice progress and 200-249 for an early proven practitioner; reserve 250+ for repeated, reliable specialist evidence.

A well-completed vocal part that is materially harder than the song's average is direct evidence for singing attributes. It does not, on its own, establish a high singer trait.

## Structured performance facts

Use a fact when a performance observation is known with enough confidence to be reused. For vocal evidence, record the song's average difficulty, the member's assigned-part difficulty, and completion quality. The generic rule is then:

```text
completed well AND assigned part >= song average + 2
  -> singing-cluster floor = assigned part + 1
```

This is a floor for pitch, tone, breath, and rhythm—not an individual score. A separate direct vocal-performance claim may increase the cluster further. Thus two members with the same verified difficult part get the same minimum, while a third member with an independent `歌うま`-class claim can legitimately score higher without a name-specific rule.

When parsing search results, scope keyword matching to the passage around the target member's name. Group roundup pages often contain multiple members' bios; whole-result matching leaks one member's praise into another's profile.

## Evidence constraint model

The generator should convert evidence to four types of constraints: **range, rank, floor, bias**.

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

Do not transfer a stamina floor to agility or natural_fitness automatically.

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

Age and height primarily influence style, not total visual value.

### Age prior

- <=16: stronger cute prior
- 17-21: both cute and pretty plausible
- 22-25: neutral / mild pretty bias
- 26+: stronger mature/pretty bias

### Height prior

- <153 cm: mild cute bias
- 153-158: neutral
- 159-164: mild pretty bias
- 165+: stronger pretty/model bias

### Model trait

A model-specialized member should usually have clearly higher `fashion`, higher `pretty`, and sometimes mild `stage_presence`. Model trait does not automatically raise `cute`.

## Experience and newcomer handling

Do not apply a flat Ability modifier for career experience. Experience regularizes concrete attributes such as stamina, breath, rhythm, stage_presence, teamwork, talking, creativity, and hidden professionalism when role history supports it.

Newcomer status means uncertainty and less proven professional floor, not low skill.

## Correlated profile generation

Unknown attributes must not default to 15-16. Generate a latent personal profile shape, then correlated substats. Useful temporary shapes include balanced, vocal-leaning, dance-leaning, visual-leaning, communication-leaning, physical-leaning, multi-specialist, strongly uneven, and high-potential newcomer.

## Trait vs attribute distinction

Attributes describe what the idol can currently do. Traits describe externally usable specialization and accumulated career capital; they do not gate whether the idol may take an external-work assignment.

A member can have pitch/tone 18 but low singer trait if she has almost no vocal-specific external career. A high model trait normally implies repeat fashion/model work and should bias pretty/fashion upward. A talkative member is not automatically high comedy trait.

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

## Offline evaluation rosters

These cases are held out checks for the generator. They are not run-time member overrides, target Ability inputs, or per-member score tables. When an output drifts, identify the missing or overweighted evidence rule before changing the generator.

### 高嶺のなでしこ

Current useful anchors:

- 籾山ひめり ~82
- 松本ももな ~82
- 東山恵里沙 ~78
- 城月菜央 ~77-78, humor 17
- 星谷美来 ~77, stronger appearance
- 葉月紗蘭 ~72-74, vocal strength
- 春野莉々 ~72, vocal strength with weaker supporting domains

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

Mean is about 80. This is a useful strong-B-tier exemplar.

## Generation precedence

Use this order:

1. high-confidence direct evidence and structured performance facts
2. relative ranking constraints
3. career/group floors
4. trait priors
5. age/height/training priors
6. group/tier population prior
7. profile-shape randomness

After generation, derive Radar and Ability and run a sanity check. If the result appears wrong, fix the missing or overweighted domain evidence; never add +1 to every attribute merely to reach a desired Ability, and never add a member-name score rule to make an evaluation case pass.
