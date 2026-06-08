# Game Logic Model

This note summarizes the current gameplay model used by the web simulation.

It is a reference document for balancing work across:

- songs
- familiarity and rotation fatigue
- idol condition and morale
- live performance and fan conversion
- schedule-driven lives and media events
- finance

Primary engine files:

- `src/engine/songStatusSystem.ts`
- `src/engine/idolStatusSystem.ts`
- `src/engine/livePerformanceWeb.ts`
- `src/engine/financeSystem.ts`
- `src/engine/gameEngine.ts`
- `src/data/officialSchedule.ts`

## Songs

Managed-group songs track:

- `familiarity`
- `rotation_fatigue`
- `learned_member_count`
- `last_trained_date`
- `last_performed_date`
- `recent_performance_dates`

Current initialization:

- top 12 songs by popularity: `90`
- songs released within 5 years of the reference date: `80`
- all other available songs: `20`

Special unlock:

- `タイムレスメモリー` unlocks on `2026-01-01`

Training familiarity gain:

```ts
gain_per_song = max(1, round((blocksPerIdol * 6) / selectedSongCount))
```

Overnight song decay:

- `rotation_fatigue -= 5`
- `familiarity -= 1` for songs not selected and not trained that day

New-member dilution:

- when member count rises above `learned_member_count`, familiarity drops by `12` per added member

## Setlist effect

The live score receives a setlist modifier from managed-song status.

Current formula:

```ts
familiarityBonus = clamp((avgFamiliarity - 62) / 4.8, -10, 10)
fatiguePenalty = clamp(avgFatigue / 18, 0, 4)
lowFamPenalty = lowFamiliarityCount * 1.1
scoreDelta = familiarityBonus - fatiguePenalty - lowFamPenalty
```

Rotation update after performance:

```ts
rotation_fatigue += 10 + recentCount * 8
```

Auto-setlist direction:

- top 3 songs act as anchors
- rest of the setlist rotates harder
- duplicate song titles are not allowed in the same setlist

## Idol status

Default status:

- `condition = 90`
- `morale = 70`

Training structure:

- each level equals `4 hours / week`
- sessions are `4 hours`
- preferred blocks:
  - `08:00-12:00`
  - `13:00-17:00`

Condition constants:

- 4-hour training base cost: `10`
- 2-hour live base cost scaled from 120 minutes: `40`
- rehearsal costs `1/3` of live minutes

Current sleep recovery:

```ts
sleepRecovery = clamp(25 + lowConditionBonus + staminaBonus + fitnessBonus, 3, 25)
```

Daily condition update:

```ts
conditionDelta = sleepRecovery - round(liveCost + trainCost + overloadCost)
```

This recovery is currently generous and should be tuned together with fatigue.

## Live performance

Member performance depends on:

- technical attributes
- physical attributes
- mental attributes
- appearance attributes
- condition
- morale
- live-type fit
- maturity / tenure adjustments
- small deterministic noise

Status multiplier:

```ts
1 + (condition - 70) / 200 + (morale - 50) / 250
```

Group performance combines:

- roster score
- teamwork synergy
- novelty
- setlist effect
- deterministic noise

Audience satisfaction is primarily driven by:

- performance score
- group profile strength
- novelty

## Fan model

Limited-discovery live types:

- `Taiban`
- `Festival`
- `Joint`

These use attendance as the discovery pool rather than full exposure.

Current balance target:

- break-even around performance `60`
- average member rate around `6.0`
- upside capped relative to attendance

Tokutenkai:

- actual ticket count depends on satisfaction and member sales strength
- member allocation is weighted by tokutenkai sales score

## Lives and media

Concert and tour rules:

- true concerts, tours, festivals, and guest lives belong to `Lives`
- `Media` is for:
  - TV
  - Radio
  - Books
  - Online
  - release/public appearance style live events

Current slot-sizing rules:

- `20 min -> 4 songs`
- `25 min -> 5 songs`
- `30 min -> 6 songs`
- `80 min -> 16 songs + MC(2) + MC(6)`
- `95 min -> 18 songs + costume change + MC(2) + MC(6)`

## Finance

The daily base model currently includes:

Income:

- `digital_sales`
- `fan_meetings`
- `goods`
- `media`
- `live_tickets`
- `live_goods`
- `tokutenkai_revenue`

Expense:

- `staff`
- `office`
- `promotion`
- `live_cost`
- `salaries`
- `scout_retainers`
- `tokutenkai_cost`
- `tokutenkai_idol_share`

The current `media` line is still passive:

```ts
media = (800 + popularity * 90) * max(0.8, tierMult - 0.15)
```

## Media balancing direction

Official future-event schedule files are now available for some upper-tier groups.

Event-driven media logic is not yet fully integrated into the day-resolution engine, but the current balance direction is:

- media should be steadier than lives
- media-heavy groups should gain fans more reliably
- upper-tier groups can carry more admin, travel, making, and advertising cost
- those groups should still end up near break-even or slightly positive over a medium window on autopilot

Current probe:

- script: `scripts/simulateEqualLoveMedia6m.mjs`
- report: `reports/equal-love_media_sim_2025-07-05_to_2026-01-04.md`

First-pass result for `=LOVE` over 6 months:

- start cash `JPY 20,000,000`
- end cash `JPY 18,931,473`
- fan change `+33,959`
- popularity `68 -> 76.61`

This suggests the media-side model is close, with fixed overhead still slightly too high.
