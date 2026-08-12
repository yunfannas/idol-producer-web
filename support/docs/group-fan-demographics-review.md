# Group Fan Demographics Review

Editable sheet:

- `support/docs/group-fan-demographics-review.csv`
- `support/docs/tier-fan-demographics-defaults.csv`

## Purpose

This sheet estimates fan demographics by engagement layer:

- `public`
- `otaku`
- `core`

Each layer has:

- male/female share;
- age share: `youth`, `young_adult`, `middle_plus`;
- evidence label;
- confidence;
- source/model notes.

## Important Calibration Note

Demographic evidence is uneven.

`Nogizaka46` has relatively stronger public survey anchors, but even there the number depends on whether the audience is:

- broad public preference survey;
- "oshi fan" survey;
- concert/live attendance;
- core spender population.

For game modeling, use:

```text
public != otaku != core
```

The user's Nogizaka calibration, `90/10 male/female and majority middle age+`, is applied to the `core` layer rather than the broad public layer. Older public sources are retained in notes for comparison.

## Evidence Standard

Use the `evidence_label` and `confidence` fields carefully.

- `medium`: public survey or repeated visible source, still not audited fanclub data.
- `low_medium`: fan-side observations with some repetition or plausible public corroboration.
- `low`: model assumption or weak single-source estimate.

Do not treat these as audited demographics.

## Design Use

The demographic sheet should seed:

- fan survey messages in the Strategy Meeting;
- action effectiveness by segment;
- price tolerance;
- media/content targeting;
- benefit-channel fit;
- risk of alienating a group's current spending base.

## Fallback Order

Use demographics in this order:

1. Group-specific override from `group-fan-demographics-review.csv`.
2. Tier/layer default from `tier-fan-demographics-defaults.csv`.
3. Neutral placeholder only if tier is missing.

The tier defaults are not evidence claims about every group. They are starting values so the game can assign plausible public/otaku/core demographics to unresearched groups.

Example:

```text
Nogizaka46 core -> group override
Unknown D-tier underground core -> D/core tier default
Inactive/no-audience group -> I neutral placeholder
```

## Tier Default Logic

The tier defaults use broad assumptions:

- `S`: anchored toward Sakamichi/Nogizaka-style mass female-idol demographics: male-skewed and older, especially core.
- `A`: more balanced because modern major/idol-IP groups can include strong female/youth audiences, as seen with `=LOVE` and similar peers.
- `B`: allows viral/strong-underground youth reach, but core still shifts toward direct spenders.
- `C/D/E/F`: progressively more traditional underground assumptions, with otaku/core layers more male and older.
- `I`: neutral placeholder for inactive/no managed audience.

Examples:

- Raising `post_live_tokutenkai` may please `male/core/middle_plus` in underground groups.
- Raising TikTok/content investment may grow `female/public/youth`.
- Premium birthday events may monetize `middle_plus/core`.
- First-timer pricing may help `public/youth -> otaku` conversion.

## Sources Checked

The sheet was drafted from a mix of:

- GEM Standard 2026 H1 fan map, which groups Sakamichi as female share `25% or less` and average age `36-40`, while `=LOVE` and `FRUITS ZIPPER` are female share `40-50%` and average age `30 or below`.
- LINE Research / PR TIMES 2020 Nogizaka public survey reporting roughly male 70 / female 30 and strong 20s + 50+ shares.
- GEM Standard commentary placing Nogizaka toward the male-skew side among NHK Kohaku artists.
- Nikkei Entertainment X snippet reporting Nogizaka male ratio `83.1%` in a later fan chart.
- Real Sound article describing `=LOVE` / `≠ME` / `≒JOY` female popularity, citing about `60%` female fanclub and about `70%` female live audience.
- KAI-YOU article describing HoneyWorks as teenage-girl/youth culture, used as a public-layer clue for Takamine no Nadeshiko.
- HEROINES official news for iLiFE! women-only live `GALLiFE!`, used only as evidence that a meaningful female segment exists, not as a percentage.
- Yahoo Chiebukuro fan-side observations for `=LOVE`, `iLiFE!`, `Takamine no Nadeshiko`, and `Jams Collection`.
- Official Jams Collection fanclub description, including member-specific plan and cheki ticket mechanics.
- Model assumptions from the research notes for Akishibu project and Kirameki Unforent where direct demographic evidence was not found.

Future improvements should add source URLs, dates, sample definitions and field-observation notes per row.

## Current Research Conclusions

1. `Nogizaka46` is strongly male-skewed and older in current broad fan maps. The user's `90/10 male/female, majority middle age+` note is best used for the `core` layer, while public survey anchors are slightly less extreme.
2. `=LOVE` has a split evidence pattern: GEM's broad fan map is gender-balanced to mildly female (`40-50%` female, young average age), while live/FC discussion suggests a stronger female majority. Model it as gender-balanced public but female-majority otaku/core.
3. `iLiFE!` has credible signs of unusual female/youth strength for an underground/HEROINES group, but precise percentages are fan-side, not audited. Model public/otaku female-majority; keep core somewhat more balanced because tokutenkai spending can skew older/male.
4. `Takamine no Nadeshiko` should split sharply by layer: HoneyWorks gives youth/female public reach, while live/core observations still look male-skewed. This supports the awareness-conversion scenario.
5. `Jams Collection` has direct fan-side support for a traditional underground-like audience around male 80/female 20 and age 20-40s, plus official FC mechanics that reinforce member-specific core spending.
6. `Akishibu project` and `Kirameki Unforent` still need field evidence. Current values are model assumptions from veteran/rebuild underground patterns.
