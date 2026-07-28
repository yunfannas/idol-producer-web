---
name: game-logic-balance
description: >-
  Use when changing or reviewing the simulation model: songs, familiarity,
  rotation fatigue, idol condition/morale, live performance, fan gain, media
  events, schedule-driven lives, and finance balance. This skill points to the
  code and current balancing rules that must stay aligned.
---

# Game logic balance

Use this skill when changing the gameplay equations or doing balance passes.

## Primary source files

| Area | File |
|---|---|
| Song status / setlist logic | `src/engine/songStatusSystem.ts` |
| Idol condition / morale / training | `src/engine/idolStatusSystem.ts` |
| Live performance / fans / tokutenkai | `src/engine/livePerformanceWeb.ts` |
| Scandal consequence evaluation | `src/engine/scandalConsequenceModel.ts` |
| Scandal handling (apply + inbox) | `src/engine/scandalHandling.ts` |
| Daily finance model | `src/engine/financeSystem.ts` |
| Day progression / event application | `src/engine/gameEngine.ts` |
| Official schedule media classification | `src/data/officialSchedule.ts` |
| Live slot presets / planner defaults | `src/engine/liveScheduleWeb.ts` |
| Balance probes / offline reports | `reports/`, `scripts/` |

## Working rules

1. Read the relevant engine files first. Do not balance from UI text alone.
2. Keep coupled systems aligned:
   - song familiarity and setlist scoring
   - live fan conversion and finance yield
   - media event gain and media-side operating cost
   - condition recovery and live/training fatigue
3. If you change equations, run at least one offline probe or scenario check.
4. Prefer a small number of global knobs over many narrow exceptions.
5. Preserve the design split:
   - real concerts and tours belong to `Lives`
   - `Media` is for TV, radio, books, online, release/public events

## Current model snapshot

### 1. Songs

File: `src/engine/songStatusSystem.ts`

- Locked song example:
  - `TIMELESS_MEMORY_UID` unlocks on `2026-01-01`
- Initial familiarity:
  - top 12 songs by popularity: `90`
  - songs released within 5 years of reference date: `80`
  - all other available songs: `20`
- Training familiarity gain:
  - selected songs split a fixed prep budget evenly
  - `gain_per_song = max(1, round((blocksPerIdol * 6) / selectedSongCount))`
- Training also reduces rotation fatigue on selected songs.
- Overnight decay:
  - `rotation_fatigue -= 5`
  - `familiarity -= 1` for songs not selected and not trained that day
- New member dilution:
  - if member count exceeds learned member count, familiarity drops by `12` per added member

### 2. Setlist and rotation

File: `src/engine/songStatusSystem.ts`

- Per-song live overuse is tracked as `rotation_fatigue`
- Per performance:
  - `rotation_fatigue += 10 + recentCount * 8`
  - recent window for this increment uses the last `21` days
- Setlist effect on live score:
  - `familiarityBonus = clamp((avgFamiliarity - 62) / 4.8, -10, 10)`
  - `fatiguePenalty = clamp(avgFatigue / 18, 0, 4)`
  - `lowFamPenalty = lowFamiliarityCount * 1.1`
  - `score_delta = familiarityBonus - fatiguePenalty - lowFamPenalty`
- Auto setlist selection:
  - top 3 songs are treated as anchors
  - recent-use penalty is strong
  - duplicate titles are not allowed inside one setlist
  - current target behavior is "anchors often, rest rotate"

### 3. Idol status

File: `src/engine/idolStatusSystem.ts`

- Defaults:
  - `condition = 90`
  - `morale = 70`
- Training constants:
  - `TRAINING_LEVEL_HOURS_PER_WEEK = 4`
  - `TRAINING_SESSION_HOURS = 4`
  - morning block `08:00-12:00`
  - afternoon block `13:00-17:00`
- Condition cost:
  - 4h training base cost: `10`
  - 2h live base cost scaled to 120 minutes: `40`
  - rehearsal counts as `1/3` of live minutes
- Sleep recovery:
  - currently very generous
  - `sleepRecovery = clamp(25 + lowConditionBonus + staminaBonus + fitnessBonus, 3, 25)`
- Daily condition update:
  - `conditionDelta = sleepRecovery - round(liveCost + trainCost + overloadCost)`
  - small extra `+1` on light no-live days
- Morale:
  - rises slightly on healthy training/live days
  - falls from overwork, low condition, or weak live context

Important note:
- Sleep recovery is currently tuned high and should be reviewed alongside live fatigue, not in isolation.

### 4. Live performance and fans

File: `src/engine/livePerformanceWeb.ts`

- Member performance depends on:
  - technical / physical / mental / appearance attributes
  - condition and morale
  - live type fit
  - age / tenure maturity adjustments
  - small deterministic noise
- Status multiplier:
  - `1 + (condition - 70)/200 + (morale - 50)/250`
- Group performance:
  - roster score + teamwork synergy + novelty + setlist effect + noise
- Satisfaction:
  - roughly `performance * 0.74 + profile * 0.16 + novelty * 1.1 + noise`
- Tokutenkai:
  - expected tickets are modified by satisfaction and member sales strength
- Fan gain:
  - limited-discovery lives: `Taiban`, `Festival`, `Joint`
  - these use attendance as the discovery pool, not broadcast reach
  - current balancing target is break-even around performance `60` and average rate `6.0`
  - capped upside should stay modest relative to attendance

### 5. Lives and schedule-driven events

Files:
- `src/engine/liveScheduleWeb.ts`
- `src/engine/gameEngine.ts`
- `src/data/officialSchedule.ts`

- Slot sizing rules currently in use:
  - `20 min -> 4 songs`
  - `25 min -> 5 songs`
  - `30 min -> 6 songs`
  - `80 min -> 16 songs + MC(2) + MC(6)`
  - `95 min -> 18 songs + costume change + MC(2) + MC(6)`
- Imported schedule data can drive:
  - managed lives
  - future media events
- Real concerts/tours must remain `Lives`, not `Media`

### 6. Finance

File: `src/engine/financeSystem.ts`

- Current daily base income:
  - `digital_sales`
  - `fan_meetings`
  - `goods`
  - `media`
  - `live_tickets`
  - `live_goods`
  - `tokutenkai_revenue`
- Current daily base expense:
  - `staff`
  - `office`
  - `promotion`
  - `live_cost`
  - `salaries`
  - `scout_retainers`
  - `tokutenkai_cost`
  - `tokutenkai_idol_share`
- Current passive media line is still formula-based, not event-driven:
  - `media = (800 + popularity * 90) * max(0.8, tierMult - 0.15)`

## Media-event balancing direction

Status:
- Official schedule media is loaded for some upper-tier groups.
- Event-driven media finance is not yet fully integrated into `gameEngine.ts`.
- A balance probe exists for `=LOVE`.

Probe artifact:
- `scripts/simulateEqualLoveMedia6m.mjs`
- `reports/equal-love_media_sim_2025-07-05_to_2026-01-04.md`

First-pass `=LOVE` media-only probe result:
- 6 months from `2025-07-05`
- start cash `JPY 20,000,000`
- end cash `JPY 18,931,473`
- fan change `+33,959`
- popularity `68 -> 76.61`

Interpretation:
- the model is close to break-even already
- fixed media-side overhead is the main drag
- likely tuning knobs:
  - lower fixed admin/advertising burden slightly
  - increase event-driven media revenue slightly
  - soften `live_events` travel/making cost slightly

## Balance targets

Use these as design targets unless the user explicitly changes direction.

- Autopilot should survive.
- Manual play should improve outcomes, not merely prevent collapse.
- Dense-schedule upper-tier groups such as `=LOVE` should be near break-even or slightly positive over a medium window.
- Media-heavy groups should gain fans more steadily than live-heavy indie groups.
- Lives should remain the main spike source for performance drama and event-day revenue.
- Media should be lower-variance, steadier, and more reliable than lives.

## Scandal consequence evaluation

File: `src/engine/scandalConsequenceModel.ts`

Two layers stay aligned:

1. **Raw deltas** (`computeScandalConsequences`) — cash, fans, morale, salary cut, timed form/sales mult, roster effect.
2. **Axes + utility** (`evaluateScandalOption`) — brand / fans / finance / roster / live / team scored 0–100, then weighted into utility.

Weight rules:
- Higher scandal `score` raises **brand** weight and lowers **roster** soft-keep value.
- Imminent prestige lives (Budokan-scale) raise **live** weight and amplify terminate-now / keep shocks.

UI and apply path both call `evaluateScandalHandlingOptions` so the ranked preview matches the applied deltas.

`demote_leader` is a **keep-with-heavy-penalty** class action (心花りり historical path): same cost band as soft keep (PR / fans / long form penalty), plus stripping leader as the accountability signal. It is not a cheap mid option.

`suspend_activities` splits by catalog:
- **indefinite** (春野莉々): no return date until review / later leave
- **suspend for some time** (籾山ひめり): `suspension_end_date` drives a timed hiatus (e.g. 2025-12-22 → 2026-02-14)

When an indefinitely suspended member then schedules a leave **before** any return date
(春野莉々 → 2025-07-31), that leave is a **major post-suspension decision**
(`follow_on_leave` / `subtype: post_suspension_leave`): accept leave, keep suspended,
reinstate with heavy penalty, or terminate — not a locked auto-exit.

### Reputation + agency harshness

- Group **`reputation`** (1–5, **default 3**) on the group row, stored as a float.
  Starting values: default base **3**, then **interpolated** for every group from
  historical tenure (current + past members, churn-softened) and pre-as-of scandals
  (handling-aware; timed suspend-then-return = −0.5) via
  `support/scripts/seedGroupReputation.mjs`. Curated anchors in
  `public/data/reference/group_reputation.json` always win (e.g. iLiFE! = 2,
  アキシブ = 3, 高嶺のなでしこ = 4, =LOVE = 4.5, ≒JOY = 4.5, ≠ME = 5). Reports:
  `support/docs/reference/scenario_6_group_reputation_interpolation.csv`.
  Seed via `node support/scripts/seedGroupReputation.mjs`.
- Agency **`harshness`** (1–5) in `public/data/reference/agencies.json`
  (Imaginate = 5). Resolved from `group.agencies[]`.
- Scandal weights/axes: low reputation punishes soft keep; high harshness rewards
  firm terminate / suspend paths.
- **Dynamic reputation** (`src/engine/reputationModel.ts`): reputation moves during
  play and is logged to `group.reputation_log`.
  - **Down** — scandals + handling (`reputationDeltaForScandalHandling`, applied in
    `applyScandalHandlingChoice`): base dent scales with score; soft keep /
    acknowledge deepen it, firm cuts (esp. at harsh agencies) limit it. **Timed
    suspend-then-return** (籾山ひめり historical) is a flat **−0.5**.
    Post-indefinite-suspension leave decisions (春野莉々) use fixed deltas via
    `reputationDeltaForPostSuspensionLeave`: historical withdraw **−0.5**
    (4 → 3.5), reinstate/return **−1.0** (4 → 3). Also a **core member**
    (leader / dominant fan share / roster fan leader) leaving **without
    recognition**, or any scandal exit (`applyDepartureReputation` in
    `scenarioRuntimeWeb.ts`).
  - **Up** — accrued member tenure (`accrueMonthlyTenureReputation`, once/month in
    `gameEngine` daily close; ceiling ~3.0→4.5 by avg tenure years) and a
    **proper sendoff** on departure: a special/farewell live (`hasProperSendoffLive`)
    within ~30d before / 14d after the leave date.

## Recommended workflow for future changes

1. Adjust equations in the engine files, not only the UI.
2. Keep formulas legible and centralized when possible.
3. Re-run offline probes after each balance pass:
   - `Akishibu project`
   - `iLiFE!`
   - `=LOVE`
   - `高嶺のなでしこ`
4. Compare:
   - ending cash
   - weekly net
   - fan delta
   - popularity delta
   - condition / morale if the probe includes status
5. Prefer tuning 3 to 5 knobs, then retest, rather than rewriting every subsystem at once.
