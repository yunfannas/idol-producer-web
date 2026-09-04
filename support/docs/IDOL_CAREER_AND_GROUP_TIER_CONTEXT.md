# Idol career history and historical group-tier context

Status: active input layer for idol attribute generation.

## Purpose

`prior_group_months` is not enough. Attribute generation must know **where** an idol accumulated experience and what professional environment that group represented at the time.

Pipeline:

```text
scenario_6/groups.json + scenario_6/group_tiers.json
+ curated historical tier overrides
-> support/data/group-tier-history.json

scenario_6/idols.json
+ curated missing career-history overrides
+ group-tier-history.json
-> support/data/idol-career-context.json

idol-career-context.json
+ searchable evidence collector
-> evidence bundle with career_history[]
-> idol-attribute-generation agent skill
```

Build both derived files with:

```bash
node support/scripts/buildIdolAttributeContext.mjs
```

## Group tier history

Canonical config:

- `support/config/group-tier-history-overrides.json`

Generated output:

- `support/data/group-tier-history.json`

Every group in the S6 group database receives explicit slots for S1-S6.

Each slot has:

```json
{
  "tier": "C",
  "status": "active",
  "confidence": "curated",
  "source": "..."
}
```

Allowed states:

- `active`: active at the scenario date and tier is known
- `inactive`: database group exists but is inactive at the scenario opening
- `not_active`: group had not yet formed at that scenario date
- `unknown`: group existed, but historical tier has not yet been researched

`unknown` is intentional. Never copy the S6 tier backward merely to fill the matrix.

## Scenario dates

The current historical grid uses:

- S1: 2010-01-01 working early-era anchor
- S2: 2013-07-01
- S3: 2017-04-01
- S4: 2019-12-01
- S5: 2021-01-01
- S6: 2025-07-05

If a scenario opening date is later refined, change it in `group-tier-history-overrides.json` and rebuild.

## Career history

Canonical missing-history config:

- `support/config/idol-career-history-overrides.json`

Generated output:

- `support/data/idol-career-context.json`

Each member receives:

```json
{
  "career_history": [
    {
      "group_uid": "...",
      "group_name": "...",
      "start_date": "...",
      "end_date": "...",
      "approximate_months": 36,
      "tier_exposure": {
        "S3": {"tier": "C", "status": "active", "confidence": "curated"}
      }
    }
  ]
}
```

The builder preserves all `group_history_in_group` rows found in scenario idols and supplements them with curated overrides when upstream scenario exports omit old groups.

Do not invent exact dates. Year-only historical knowledge stays year precision.

## Rana canary

茉井良菜 is the initial canary because the S6 preview only exposes her current アキシブproject membership even though project research has established earlier Le Siana and 煌めき☆アンフォレント career segments.

The career override therefore restores:

- Le Siana: 2012-2016, year precision
- 煌めき☆アンフォレント: 2016-2020, year precision
- アキシブproject: from 2023-12-29

Historical tier slots for those former groups should be curated independently. The generator may use known duration immediately, but must not invent a tier where the matrix says `unknown`.

## Attribute-generation semantics

Historical tier is not a skill bonus.

Long tenure in an established C/B+ professional environment may regularize:

- stamina
- breath
- rhythm
- stage_presence
- teamwork
- determination

when that work would repeatedly exercise those basics.

It does not automatically raise vocal quality, appearance, humor, fashion, strength, or raw dance skill.

Group workload evidence (long one-mans, high live frequency, tokutenkai load) remains separate and can be more informative than market tier.

## Curation rule for S1-S5

When adding a historical tier:

1. use the group's scale near the scenario opening date, not its lifetime peak;
2. preserve `confidence` and a source/note;
3. do not back-project current popularity;
4. if evidence only supports a range/borderline, keep that uncertainty in the note and choose a working tier only when needed for game generation;
5. inactive or not-yet-formed groups must not receive active tier exposure.
