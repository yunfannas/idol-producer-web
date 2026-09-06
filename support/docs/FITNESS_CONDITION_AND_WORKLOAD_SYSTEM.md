# Fitness Condition, Workload, and Abnormality System

> Current design truth as of 2026-09-05.  
> Status tags: **LOCKED** = structural design truth; **PROVISIONAL** = v1 constants to tune by simulation; **CALIBRATION** = target behavior rather than a hard real-world claim.

## 1. Purpose

Replace separate long-term Vocal Fatigue / Physical Fatigue with one shared body-state resource while preserving distinct vocal and physical health failures.

Core causal chains:

```text
Difficulty / Schedule
-> Activity Workload
-> Fitness Condition
-> Effective Ability
-> Performance
```

and, over multiple days:

```text
Sustained Low Fitness Condition + Recent Related Load
-> Mild Abnormality
-> Continue Relevant Work
-> Worsening
-> Emergency Live Adjustment
```

A single hard song or hard day must not directly roll a new moderate/severe abnormality.

## 2. State model

### 2.1 Long-term dynamic state

```text
fitness_condition: 0..100
100 = best physical state / fully recovered
0   = extreme depletion
```

Internal helper only:

```text
exhaustion = 100 - fitness_condition
```

Do not expose a second persistent Vocal/Physical fatigue bar.

Other long-term dynamic states remain independent:

```text
morale: 0..100
confidence: 0..100
```

### 2.2 Temporary abnormalities

```text
vocal_condition:    none | mild | moderate | severe
physical_condition: none | mild | moderate | severe
```

New abnormalities can only start at `mild`. Existing abnormalities may worsen one tier when the member continues related work.

## 3. Fitness-condition effect on attributes

Low fitness condition directly lowers current effective:

- `breath`
- `rhythm`
- `power`

It does **not** directly subtract:

- `pitch`
- `tone`
- `agility`

Use a smooth interpolation with these v1 anchors:

| Exhaustion | Breath/Rhythm/Power loss |
|---:|---:|
| 0 | 0 |
| 30 | ~0.2 |
| 50 | ~1.0 |
| 70 | ~2.5 |
| 100 | ~7.0 |

Vocal and Dance performance checks remain separate. Therefore a D14/D14 song is intentionally stressful on both sides; there is no hidden rule that collapses it back to one check.

## 4. Unified activity-load contract

Every scheduled activity emits the same three-channel workload object:

```ts
interface ActivityLoad {
  general: number;   // only channel that directly lowers fitness_condition
  vocal: number;     // only used for vocal-abnormality risk/worsening
  physical: number;  // only used for physical-abnormality risk/worsening
}
```

`vocal` and `physical` are recent-load statistics, not additional fatigue bars and are not added to `general`.

Let `E = 100 - fitness_condition`.

```text
ConditionAmplifier(E)
= 0.62
+ 0.0025 * E
+ 0.75 / (1 + exp(-(E - 67) / 10))
```

Approximate values:

| E | Amplifier |
|---:|---:|
| 0 | .62 |
| 20 | .67 |
| 40 | .75 |
| 50 | .84 |
| 60 | .99 |
| 70 | 1.20 |
| 80 | 1.39 |
| 90 | 1.52 |
| 100 | 1.61 |

Actual condition cost:

```text
DeltaExhaustion
= GeneralRaw
* StaminaMultiplier
* ConditionAmplifier(currentExhaustion)
```

Long activities must be processed in segments so a depleted member pays more later in the same day/show.

## 5. Stamina

Stamina controls workload accumulation, not raw singing/dance score.

Current anchors:

| Stamina | Load multiplier |
|---:|---:|
| 10 | ~1.25-1.35 |
| 12 | ~1.16 |
| 14 | 1.00 |
| 15 | ~0.93 |
| 16 | ~0.87 |
| 17 | ~0.81 |
| 18 | 0.76 |
| 19 | 0.72 |
| 20 | 0.68 |

The 14/15/18 anchors are the minimum locked calibration points; intermediate values remain tunable.

## 6. Live workload

Song difficulty remains two independent values:

```text
Vocal Difficulty: 8 / 10 / 12 / 14 / 16
Dance Difficulty: 8 / 10 / 12 / 14 / 16
```

Meaning:
- 8 especially easy
- 10 easy
- 12 ordinary
- 14 difficult
- 16 especially difficult

A song may define 0-3 Sing Lead slots and 0-3 Dance Lead slots. Lead requirement is corresponding base difficulty +2. There is no Formation Difficulty stat.

For each participating member/song:

```text
Lv = 1.5 * (Dv' / 12)^1.5
Ld = 1.5 * (Dd' / 12)^1.5
Lsong = Lv + Ld
```

`Dv' = Dv + 2` only for an assigned Sing Lead.  
`Dd' = Dd + 2` only for an assigned Dance Lead.

Equal-difficulty total raw-load anchors:

| Song | Raw general |
|---|---:|
| 8/8 | 1.63 |
| 10/10 | 2.28 |
| 12/12 | 3.00 |
| 14/14 | 3.79 |
| 16/16 | 4.62 |

Also record `Lv` into recent Vocal Load and `Ld` into recent Physical Load.

Working live setup overhead: `general +2` per live.

Process setlists song by song. Breaks, costume changes, unit/offstage periods and deliberate low-movement arrangements can reduce load or allow recovery; do not calculate the whole show before condition changes.

### Calibration targets

- Stamina 14, roughly 15 ordinary 12/12 songs -> about +31 exhaustion.
- Stamina 18, roughly 40 ordinary songs -> about +71 exhaustion before fine-grained break/arrangement tuning.

These are gameplay calibration targets.

## 7. Tokuten workload

**LOCKED principle:** only actually completed interactions consume tokuten workload. Scheduled session duration itself does not add a separate tax.

```text
GeneralRaw_tokuten = 0.08 * completedInteractions
```

Examples:

| Completed interactions | Raw general |
|---:|---:|
| 50 | 4 |
| 100 | 8 |
| 150 | 12 |
| 200 | 16 |

Default:

```text
vocal = 0
physical = 0
```

For long sessions, re-evaluate the condition amplifier about every 20 completed interactions. Idle gaps can recover naturally.

Fan-work Adaptation may preserve interaction quality/mental performance but does not erase this body workload.

## 8. Lesson, rehearsal, media, and streaming workload

V1 calibration table:

| Activity | General | Vocal | Physical |
|---|---:|---:|---:|
| Vocal lesson | 2.0/h | 2.0/h | 0 |
| Dance lesson | 3.0/h | 0 | 3.5/h |
| Combined sing+dance rehearsal | 3.0/h | 1.3/h | 2.2/h |
| Formation-only rehearsal | 2.0/h | 0 | 0 |
| Recording | 1.5/h | 2.5/h | 0 |
| MV shoot | 1.5/h | 0 | 0 |
| Photoshoot | 1.0/h | 0 | 0 |
| Normal livestream | 0.6/h | 0 | 0 |
| Talk / radio | 0.6/h | 0 | 0 |
| Variety / TV recording | 1.0/h | 0 | 0 |
| Standing external appearance / meet-and-greet | 1.5/h | 0 | 0 |

A music-show appearance combines holding/recording workload with actual performed-song live workload.

Late-night streaming/external work should hurt mainly by reducing available sleep/recovery rather than by assigning artificial vocal/physical injury load.

## 9. Travel and expedition workload

- Ordinary local transit under about one hour may be ignored.
- Intercity rail/bus: `general ~0.4/h`.
- Long-distance bus/economy flight: `general ~0.7/h`.
- Poor/overnight transport: up to `general ~1.0/h`, but reduced sleep quality/recovery should carry much of the real penalty.
- A genuine expedition day has a provisional fixed overhead of `general +1.5` for gathering, luggage, hotel/environment disruption, etc.

Travel normally adds no Vocal/Physical recent-load channel by itself.

## 10. Natural Fitness and recovery

Natural Fitness controls off-stage/time-based recovery, not raw live output.

Locked anchors:

```text
NF14 = 1.00
NF18 = 1.35
```

Provisional interpolation:

| NF | Recovery multiplier |
|---:|---:|
| 10 | .75 |
| 12 | .87 |
| 14 | 1.00 |
| 16 | 1.17 |
| 18 | 1.35 |
| 20 | 1.50 |

Break recovery:

```text
R_break
= 3 * sqrt(minutes / 15) * NFMultiplier
```

Sleep recovery:

```text
R_sleep
= 22 * (sleepHours / 8)^0.8 * NFMultiplier
```

Working anchors:
- NF14, 15-minute meaningful break -> +3 fitness condition.
- NF14, 8h sleep -> +22.
- NF18, 8h sleep -> about +29.7.

Recovery cannot raise `fitness_condition` above 100.

## 11. New mild abnormality generation

A new abnormality requires **sustained low fitness condition plus recent corresponding work**.

Use a recency-weighted seven-day average `F7`, with more recent days weighted more heavily.

```text
Rlow = clamp((60 - F7) / 30, 0, 1)

V7 = recent 7-day Vocal Load
D7 = recent 7-day Physical Load

Wv = clamp(V7 / 25, 0, 1.5)
Wd = clamp(D7 / 25, 0, 1.5)

P(vocal none -> mild)
= 0.10 * Rlow^2 * Wv

P(physical none -> mild)
= 0.10 * Rlow^2 * Wd
```

When W=1, approximate daily risk per channel:

| F7 | Risk |
|---:|---:|
| >=60 | 0 |
| 55 | .3% |
| 50 | 1.1% |
| 45 | 2.5% |
| 40 | 4.4% |
| 30 | 10% |

A healthy member does not jump directly from `none` to `moderate` or `severe` through this normal system.

## 12. Worsening an existing abnormality

Only related work can normally worsen the corresponding condition.

```text
X = clamp(RelatedLoadToday / 12, 0, 1.5)
U = clamp((50 - fitness_condition) / 30, 0, 1)

P(mild -> moderate)
= 0.06 * X * (1 + U)

P(moderate -> severe)
= 0.035 * X * (1 + U)
```

Reducing or removing the affected workload therefore has real value even if the idol still appears publicly.

## 13. Recovery from abnormalities

When related daily load is near zero, roll one-tier recovery:

```text
P(recover one tier)
= Pbase
* NFMultiplier
* (0.5 + 0.5 * fitness_condition / 100)
```

V1 base rates:

| Severity | Pbase/day |
|---|---:|
| mild | .40 |
| moderate | .25 |
| severe | .12 |

Continuing related work sharply reduces/blocks recovery and also triggers the worsening roll.

## 14. Vocal abnormality semantics

### Mild

- throat discomfort
- Vocal effective performance modifier: -1
- no formation-familiarity penalty if assigned parts remain unchanged

### Moderate

- throat pain / hoarseness / significant voice limitation
- Vocal effective modifier: -2
- no formation-familiarity penalty if assigned parts remain unchanged

### Severe

- effectively voiceless / cannot normally execute assigned vocal parts
- idol may still appear, dance, stand in formation, and MC
- original parts must be reassigned, converted to group lines, cut, or covered by backing/prerecorded vocal

Reassigning vocal parts causes a **small temporary effective formation-familiarity penalty** because cues/responsibilities change, even when spatial positions do not. Larger emergency redistribution causes a larger penalty.

If the affected member no longer carries actual Vocal Load, worsening risk is correspondingly reduced.

## 15. Physical abnormality semantics

### Mild

- waist/leg discomfort
- Dance effective modifier: -1
- **no formation-familiarity penalty** if the member still performs the original choreography and movement

### Moderate

- pain / movement limitation
- Dance effective modifier: -2
- formation familiarity is penalized only if choreography/movement is actually modified

### Severe

- cannot normally stand/dance
- idol may still appear seated and may still sing/MC
- affected member's Dance/Physical Load can approach zero
- seated appearance / emergency choreography necessarily causes a significant temporary effective formation-familiarity penalty

Do not permanently erase trained familiarity:

```text
effectiveFormationFamiliarity
= trainedFormationFamiliarity
- emergencyAdjustmentPenalty
```

Emergency rehearsal time may reduce this temporary penalty.

## 16. Daily processing order

1. Load current `fitness_condition`, morale/confidence, and abnormalities.
2. Each activity emits General/Vocal/Physical raw load.
3. Apply Stamina and current ConditionAmplifier to General load.
4. Reduce fitness condition; long activities update sequentially.
5. Live resolves song by song.
6. Tokuten resolves by completed-interaction segments.
7. Explicit breaks/gaps recover condition.
8. Sleep recovery applies through Natural Fitness.
9. Store end-of-day condition and update seven-day history.
10. `none` channels may roll `none -> mild` from sustained low F7 + recent related load.
11. Existing abnormalities with continued related work may roll worsening.
12. Existing abnormalities with sufficient related rest may roll one-tier recovery.

## 17. Implementation notes

- The game may display fuzzy condition bands rather than exact hidden formula inputs.
- `vocal_condition` / `physical_condition` are not aliases for the removed dual fatigue bars; they are discrete temporary health states.
- The recent `V7`/`D7` workload history is a risk accumulator only, not a player-facing resource.
- No separate Formation Difficulty stat is introduced.
- Formation familiarity changes here are temporary **effective** penalties caused by emergency deviations from the trained arrangement.
- All numerical constants in this document are v1 calibration values unless marked locked; simulation should test normal, busy, and extreme schedules before freezing them.
