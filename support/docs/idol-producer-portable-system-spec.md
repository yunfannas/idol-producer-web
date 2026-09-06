# Idol Producer — Portable System Design Spec

> Portable design snapshot distilled from the current design discussion.  
> Simulation opening: **S6 = 2025-07-05**.  
> Updated: **2026-09-05**.  
> Status tags: **LOCKED** = current design truth; **PROVISIONAL** = direction agreed, constants tunable; **ILLUSTRATIVE** = calibration/example only; **REAL-WORLD ANCHOR** = observation used for calibration, not a forced future script.

---

## 1. Core philosophy

- Player is a **producer**, not an owner. **LOCKED**
- Producer can fail/be fired and continue career elsewhere. **LOCKED**
- Weekly state update is the core simulation cadence. **LOCKED**
- Real history supplies opening-state truth, calibration data, and soft priors; post-S6 future is not forced except already-committed facts. **LOCKED**
- Principle: **Randomize the unknown, preserve the observed.**
- Important hidden values should stay hidden/fuzzy when exact exposure would let the player reverse-engineer the system.

## 2. Tier system

Tier primarily means **sustainable one-man draw / operating scale**, not artistic quality alone.

| Tier | Meaning |
|---|---|
| S | phenomenon-scale |
| A | major-scale |
| B | elite underground / mid-major |
| C | strong underground / quasi-major |
| D | professional underground |
| E | small underground |

Tier affects opportunity access, venue scale, staff package, salary benchmark, pricing/merch opportunities, Public monetization, and long-run ARPU calibration. Tier does **not** directly grant profit margin.

S6 representative groups:
- **=LOVE — A**
- **iLiFE! — B**
- **高嶺のなでしこ — C**
- **アキシブproject — D**

Keeping iLiFE! as the B-tier representative at S6 is accepted even though Budokan later provided a clean real-world validation of that scale.

## 3. Historical event model

Event classes:
- `PAST_RESOLVED`
- `PENDING_COMMITTED`
- `CONDITIONAL_HISTORICAL`
- `SIMULATION`

`PENDING_COMMITTED`: causal fact is already committed at S6; player cannot erase occurrence, but can change response/consequences.

`CONDITIONAL_HISTORICAL`: historical outcome has pressure if conditions remain similar, but player can alter the causal chain.

Examples:
- AKSB 古賀みれい exit = Pending Committed.
- AKSB 美山ひな health exit = Conditional Historical, high pressure.
- AKSB 神崎かえ exit = Conditional Historical, medium/high pressure.

Historical prior: use roughly the preceding 52 weeks for player-relevant idols as a soft prior for Career Robustness, Physical Risk, and Crisis/Rule Risk. Do not convert history into speculative personality traits. Prior fades over about one game year and faster after major divergence.

## 4. Idol attributes V2

Final 17 attributes, 0–20. **LOCKED**

Physical: `agility`, `natural_fitness`, `stamina`  
Appearance: `cute`, `pretty`  
Performance: `pitch`, `tone`, `breath`, `rhythm`, `power`, `stage_presence`  
Communication / Creative: `wit`, `humor`, `talking`, `teamwork`, `fashion`, `creativity`

Definitions:
- wit = real-time verbal/social improvisation, not intelligence.
- humor = ability to produce entertaining/comedic effect.
- creativity = originate/develop content/concept ideas.
- teamwork = collaborative execution only, not personality niceness.
- talking = stable speaking/MC/interview/conversation competence.
- power = dance-only; never enters singing.

Removed hidden/personality-style stats include `determination`, `professionalism`, `injury_proneness`, `ambition`, `loyalty`, `work_rate`, `assertiveness`, `role_ambition`. Do not reintroduce them as disguised proxies.

Scale anchors:
- 0–5 insufficient
- 6–9 beginner/weak
- 10–12 basic professional usable
- 13–15 stable professional/strong
- 16 very strong
- 17 professional mastery threshold
- 18 exceptional
- 19 rare elite
- 20 scale-defining extreme

Most normal task requirements should cap at <=17. Potential is soft rather than a fixed PA ceiling.

## 5. Real-world attribute anchors

Every real-person anchor must include full display name + group affiliation/context so the document remains portable.

### 茉井良菜 / Rana（アキシブproject）
Typical working anchor: cute 13, pretty 16, pitch/tone/breath/rhythm 17, power 16–17, stage_presence 17–18, wit 14, humor 14, talking 17, teamwork 14, fashion 14, creativity 15. Physical anchor remains tunable. D-tier veteran performance/MC core.

### 古賀みれい / Mirei（アキシブproject）
Vocal bottleneck ~14, dance 14–15, stage 15–16, visual 16–17. Long exposure without large vocal movement may imply lower vocal growth response, not a hard ceiling.

### 新居歩美（元アキシブproject）
Singing ~13, visual ~12–14, dance/stage ~14–16, talking ~16–17, wit 19, humor 18, creativity 18–19. Communication/creative-development anchor.

### 佐々木舞香 / Maika（=LOVE）
Vocal 18–19, tone potentially 19, visual 18–19, stage ~18, dance >=16.

### 野口衣織 / Iori（=LOVE）
Stage_presence ~19 candidate.

### =LOVE dance anchors
- 山本杏奈 / Anna（=LOVE） ~19
- 大谷映美里 / Emiri（=LOVE） ~17
- 齋藤樹愛羅 / Kiara（=LOVE） ~17
- 佐々木舞香 / Maika（=LOVE） ~16

### 松本ももな / Momona（高嶺のなでしこ）
Singing 13–15, dance 15–16, stage 16–17, cute/pretty 18–19, fashion 17–18.

### あいす / Aisu（iLiFE!）
Dance ~17, singing ~14–16, talking/wit/humor ~17–18, Fan-work Adaptation ~19, **stamina = 19 LOCKED** for current ultra-long-live calibration.

### 恋星はるか / Haruka（のんふぃく！／GILTY×GILTY、元 iLiFE! support member）
Historical/high-endurance archetype only; not part of current iLiFE! roster calibration. Singing/dance ~16 average, high Natural Fitness/Stamina, very high Fan-work Adaptation.

## 6. Growth system

Physical: agility/stamina train slowly; natural_fitness relatively stable; long inactivity can decondition.  
Technical: no normal passive decay; requires training + relevant practice; strong saturation high-end.  
Communication/creative: no ordinary decay; develops through use, interest and role exposure rather than a direct specialty-training button.

Player controls broad Physical/Singing/Dance intensity, member adjustment, and Individual Development Freedom. Hidden growth-response domains exist only where useful. Fan-work Adaptation is current capability/state; its growth response stays hidden.

## 7. Idol Professional Trait System

**LOCKED concept; exact gain/decay constants PROVISIONAL.**

`Idol Trait` is a learned professional capability **outside the idol's core job of singing, dancing, visual presentation, and ordinary fan communication**. It is not a personality stat and must not recreate removed values such as `work_rate`, `professionalism`, `ambition`, or `loyalty`.

Initial trait domains:
- `mc`
- `acting`
- `lyric_writing`
- `composition`
- `choreography`
- `costume_design`
- `producer`

Additional professional domains may be added only when the game has meaningful activities that exercise them.

### 7.1 Hidden continuous meter, discrete visible level

```text
TraitXP[trait] >= 0

0–99     no displayed trait level / not yet established
100–199  入门 / beginner
200–299  普通 / established
300+     资深 / veteran
```

Player normally sees the discrete level, not exact XP.

### 7.2 Growth and decay

TraitXP grows only from actually performing relevant work:

```text
TraitXP gain
= relevant work amount
* completion quality
* learning/mentorship modifier
```

Examples: hosting -> MC; acting work -> acting; credited lyrics -> lyric_writing; composing -> composition; meaningful choreography work -> choreography; costume concept -> costume_design; real production responsibility -> producer.

Core attributes may affect learning/execution quality but do not directly grant the trait. Trait XP decays when unused, but crossing back below a displayed tier is deliberately slow; acquired professional experience should not vanish after a short inactive period.

## 8. Fanwork policy

Group policy types: Admire / Mixed / Interactive.

Anchors:
- 高嶺のなでしこ = Admire
- Jams Collection = Mixed
- iLiFE! = Interactive

Fanwork style is orthogonal to Tier. It changes **where** spending occurs more than total ARPU:
- Interactive -> tokuten/release/birthday-heavy
- Admire -> concert/premium/merch/FC-heavy
- Mixed -> balanced

## 9. Song model

Static: `themes`, `traits`, `appeal`.  
Dynamic weekly: `popularity`, `freshness`.

Appeal = stable tendency to be liked when exposed.  
Popularity mainly determines familiarity/KnownRate.  
Freshness affects only listeners who already know the song.  
Classicness is derived from age, durable popularity, historical peak, etc.

Lifecycle:
- new = high freshness, low classicness
- middle/nonclassic = low freshness, low classicness, most saturation-sensitive
- classic = freshness 0 but strong ritual/attachment payoff

## 10. Song themes

Locked 29 themes:

Season: spring, summer, autumn, winter.  
Relation: romance, friendship, family, idol_otaku.  
Setting: school, urban, beach, night.  
Emotion: joy, sadness, loneliness, hope, nostalgia, anxiety.  
Situation: separation, reunion, celebration, challenge.  
Identity/Message: self_esteem, empowerment, aspiration, rebellion.  
Aesthetic/Tone: cute, cool, dark, dreamy.

Typical song uses 2–4 themes. Composite labels such as graduation or heartbreak should be represented by combinations of atomic themes.

Theme trend per quarter is in {-2,-1,0,+1,+2}. Seasonal themes use deterministic seasonal patterns; other themes evolve with inertia, successful high-profile content, SNS amplification, and saturation/crowding.

Trend modifies **Theme Coherence at setlist level**, not every song independently. Staff package affects next-quarter trend forecast quality.

## 11. Song difficulty / traits / leads

Default ordinary idol song: `singDifficulty = 12`, `danceDifficulty = 12`.

Difficulty tiers are **8 / 10 / 12 / 14 / 16**:
- 8 = especially easy
- 10 = easy
- 12 = ordinary
- 14 = difficult
- 16 = especially difficult

Traits may map into those values:
- `very_easy_vocal` -> 8
- `easy_vocal` -> 10
- `difficult_vocal` -> 14
- `very_difficult_vocal` -> 16
- `very_low_dance` -> 8
- `low_dance` -> 10
- `difficult_dance` -> 14
- `very_difficult_dance` -> 16
- `sing_together`
- `complex_formation`

`complex_formation` is descriptive/arrangement information. **There is no separate Formation Difficulty score.**

Arrangement fixes 0–3 `vocalLeadSlots` and 0–3 `danceLeadSlots`; player may fill fewer where arrangement permits. Lead requirement defaults to corresponding song difficulty +2.

Vocal Lead: failed higher check -> penalty; strong pass gives no extra raw bonus.  
Dance Lead: successful higher check -> bonus; failed extra lead check gives no extra penalty beyond normal dance result.  
`sing_together`: no vocal lead; average participating members' relevant singing attributes and run the group kernel.

ToneFactor and PowerFactor come from themes. Tone is singing pure bonus; Power is dance pure bonus. Difficulty and Appeal may be weakly positively correlated in generation but never deterministic.

## 12. Performance kernel and dynamic condition

Keep detailed attributes mathematically distinct; do not collapse into one sing/dance stat.

### 12.1 Unified long-term body state

**LOCKED:** retire separate persistent Vocal Fatigue / Physical Fatigue.

```text
fitness_condition: 0..100
100 = best / fully recovered
0   = extreme depletion

exhaustion = 100 - fitness_condition   // internal helper only
```

Other dynamic member states remain separate:
- `morale`
- `confidence`

Temporary health states are discrete:

```text
vocal_condition:    none | mild | moderate | severe
physical_condition: none | mild | moderate | severe
```

Exact internal formula inputs may remain hidden/fuzzy to the player.

### 12.2 Fitness-condition attribute effect

Low fitness condition directly reduces current effective:
- Breath
- Rhythm
- Power

It does **not** directly subtract Pitch, Tone, or Agility.

Working smooth-loss anchors by exhaustion:
- E0 -> 0
- E30 -> ~0.2
- E50 -> ~1.0
- E70 -> ~2.5
- E100 -> ~7.0

Singing:
- current Breath + Rhythm determine continuous baseline vs difficulty.
- Pitch below difficulty creates probabilistic downside only; positive Pitch margin gives no bonus.
- Tone gives theme-scaled positive bonus and is not directly condition-subtracted.
- Stage Presence acts as final multiplier.
- Power never enters singing.

Dance:
- current Rhythm vs danceDifficulty gives continuous baseline.
- Agility below difficulty creates probabilistic downside; positive margin gives no bonus.
- current Power gives theme-scaled positive bonus and is condition-sensitive.
- Stamina controls workload accumulation, not raw score.
- Stage Presence acts as final multiplier.

Because singing and dance checks remain independent, D14/D14 intentionally creates pressure on both performance channels.

Critical-check rough calibration: +3 <0.5%, +2 ~1%, +1 ~3%, 0 ~7%, -1 ~15%, -2 ~30%, -3 ~50%. **PROVISIONAL**

## 13. Unified workload model and live loop

Detailed current formula spec: [`FITNESS_CONDITION_AND_WORKLOAD_SYSTEM.md`](./FITNESS_CONDITION_AND_WORKLOAD_SYSTEM.md).

Every activity emits:

```ts
interface ActivityLoad {
  general: number;   // only channel that directly lowers fitness_condition
  vocal: number;     // recent-load input for vocal abnormality only
  physical: number;  // recent-load input for physical abnormality only
}
```

Vocal/Physical recent load are **not** second fatigue bars and are not added to General load.

For each activity segment:

```text
E = 100 - fitness_condition

ConditionAmplifier(E)
= 0.62
+ 0.0025 * E
+ 0.75 / (1 + exp(-(E - 67) / 10))

DeltaExhaustion
= GeneralRaw
* StaminaMultiplier
* ConditionAmplifier(E)
```

Approx amplifier: E0 .62, 20 .67, 40 .75, 50 .84, 60 .99, 70 1.20, 80 1.39, 90 1.52, 100 1.61.

For each live song:

```text
Lv = 1.5 * (Dv' / 12)^1.5
Ld = 1.5 * (Dd' / 12)^1.5
Lsong = Lv + Ld
```

`Dv'`/`Dd'` add +2 only for the member actually assigned the corresponding Lead.

Equal-difficulty raw totals:
- 8/8 = 1.63
- 10/10 = 2.28
- 12/12 = 3.00
- 14/14 = 3.79
- 16/16 = 4.62

Working live setup overhead: General +2.

Per-song live loop:
1. derive current effective Breath/Rhythm/Power from fitness condition
2. singing kernel
3. dance kernel
4. combine performance
5. audience response
6. update momentum
7. immediately apply song General/Vocal/Physical workload

MC, costume change, encore break and unit/offstage time may recover condition. Do not calculate the entire show before updating condition.

## 14. Stamina and workload calibration

### 14.1 Stamina semantics

- Sta10: ~5-song taiban + ~20m rest + ~1h busy tokuten (~100 interactions), tired but functional.
- Sta14: ordinary professional ~15-song one-man.
- Sta16: strong professional endurance for ~20–25-song large live.
- Sta18: can finish ~35–40-song ultra-long live with meaningful breaks, but should finish heavily depleted.
- Sta19: elite endurance; only modestly better than Sta18 in the same ultra-long live.
- Sta20: extreme endurance outlier.

Current iLiFE! calibration:
- **あいす / Aisu（iLiFE!） = Sta19**
- **other current iLiFE! members = Sta18** as roster-level endurance calibration
- 恋星はるか is excluded from current roster calibration.

### 14.2 Stamina multipliers

| Stamina | Load multiplier |
|---:|---:|
| 10 | ~1.25–1.35 |
| 12 | ~1.16 |
| 14 | 1.00 |
| 15 | ~0.93 |
| 16 | ~0.87 |
| 17 | ~0.81 |
| 18 | **0.76** |
| 19 | **0.72** |
| 20 | **0.68** |

### 14.3 Live calibration targets

Working targets after unifying condition:
- Sta14, ~15 ordinary 12/12 songs -> about +31 exhaustion.
- Sta18, ~40 ordinary songs -> about +71 exhaustion before fine-grained break/low-movement tuning.

The older separate Vocal/Physical end-show targets are retired.

## 15. Natural Fitness and recovery

Natural Fitness governs off-stage/time-based recovery, not raw live output. NF14 recovery multiplier =1.00; NF18 =1.35 locked anchor.

Provisional interpolation:
- NF10 .75
- NF12 .87
- NF14 1.00
- NF16 1.17
- NF18 1.35
- NF20 1.50

Break recovery:

```text
R_break = 3 * sqrt(minutes / 15) * NFMultiplier
```

Sleep recovery:

```text
R_sleep = 22 * (sleepHours / 8)^0.8 * NFMultiplier
```

Working anchors:
- NF14, meaningful 15m break -> +3 fitness condition
- NF14, 8h sleep -> +22
- NF18, 8h sleep -> ~29.7

Recovery is continuous through schedule gaps, not a daily reset. Transport mostly adds modest workload and/or reduces sleep/recovery quality rather than acting as an enormous instant penalty.

## 16. Schedule activity workload

V1 hourly raw-load table:

| Activity | General | Vocal | Physical |
|---|---:|---:|---:|
| Vocal lesson | 2.0/h | 2.0/h | 0 |
| Dance lesson | 3.0/h | 0 | 3.5/h |
| Combined rehearsal | 3.0/h | 1.3/h | 2.2/h |
| Formation-only rehearsal | 2.0/h | 0 | 0 |
| Recording | 1.5/h | 2.5/h | 0 |
| MV shoot | 1.5/h | 0 | 0 |
| Photoshoot | 1.0/h | 0 | 0 |
| Normal livestream | 0.6/h | 0 | 0 |
| Talk / radio | 0.6/h | 0 | 0 |
| Variety / TV recording | 1.0/h | 0 | 0 |
| Standing external appearance | 1.5/h | 0 | 0 |

Music show = holding/recording workload + actual performed-song live workload.

Late-night streaming/external work should hurt primarily by crowding sleep/recovery.

Travel:
- ordinary local transit under ~1h may be ignored
- intercity rail/bus ~General 0.4/h
- long bus/economy flight ~0.7/h
- poor/overnight transport up to ~1.0/h, with reduced sleep recovery carrying much of the penalty
- genuine expedition day fixed overhead: General +1.5 **PROVISIONAL**

## 17. Tokuten, abnormality generation, worsening and recovery

### 17.1 Tokuten

**LOCKED principle:** only completed interactions consume tokuten workload; scheduled session duration adds no separate tax.

```text
GeneralRaw_tokuten = 0.08 * completedInteractions
```

Examples: 50 -> 4, 100 -> 8, 150 -> 12, 200 -> 16.

Default Vocal=0, Physical=0. Re-evaluate the condition amplifier about every 20 interactions in long sessions. Idle time naturally recovers.

Fan-work Adaptation does not erase body workload; it affects interaction quality/mental endurance.

### 17.2 New mild abnormality

A new abnormality requires **sustained low fitness condition plus recent corresponding load**. A single hard event does not directly roll a new moderate/severe state.

Use recency-weighted 7-day average `F7`:

```text
Rlow = clamp((60 - F7) / 30, 0, 1)
Wv = clamp(V7 / 25, 0, 1.5)
Wd = clamp(D7 / 25, 0, 1.5)

P(vocal none -> mild)    = 0.10 * Rlow^2 * Wv
P(physical none -> mild) = 0.10 * Rlow^2 * Wd
```

`V7`/`D7` are recent-work accumulators only, not player-facing fatigue states.

At W=1: F7>=60 -> 0; F55 ~0.3%/day; F50 ~1.1%; F45 ~2.5%; F40 ~4.4%; F30 ~10% per channel/day.

### 17.3 Worsening

Only continuing related work normally worsens the corresponding abnormality:

```text
X = clamp(RelatedLoadToday / 12, 0, 1.5)
U = clamp((50 - fitness_condition) / 30, 0, 1)

P(mild -> moderate)   = 0.06 * X * (1 + U)
P(moderate -> severe) = 0.035 * X * (1 + U)
```

### 17.4 Recovery

When related load is near zero:

```text
P(recover one tier)
= Pbase * NFMultiplier * (0.5 + 0.5 * fitness_condition / 100)
```

Pbase/day:
- mild .40
- moderate .25
- severe .12

Continuing related work reduces/blocks recovery and also rolls worsening.

### 17.5 Vocal abnormality semantics

- mild: throat discomfort; Vocal effective -1
- moderate: throat pain/hoarseness/significant voice limitation; Vocal effective -2
- severe: cannot normally execute assigned vocal parts

Severe Vocal does **not** automatically remove the idol from the live. She may still appear, dance, stand in formation and MC. Original parts must be reassigned, grouped, cut, or covered by backing/prerecorded vocal.

Vocal abnormality itself does not reduce formation familiarity while parts remain unchanged. Emergency part reassignment causes a **small temporary effective formation-familiarity penalty**; larger redistribution causes a larger one. Removing the affected member's actual vocal load reduces further worsening risk.

### 17.6 Physical abnormality semantics

- mild: waist/leg discomfort; Dance effective -1; **no formation-familiarity penalty** if original choreography/movement is still executed
- moderate: pain/movement limitation; Dance effective -2; formation penalty only if choreography/movement is actually modified
- severe: cannot normally stand/dance; may still appear seated and sing/MC; affected Dance/Physical load may approach zero

A seated/emergency arrangement necessarily causes a significant temporary effective formation-familiarity penalty.

Do not permanently erase trained familiarity:

```text
effectiveFormationFamiliarity
= trainedFormationFamiliarity
- emergencyAdjustmentPenalty
```

Emergency rehearsal time may reduce that temporary penalty.

## 18. Fan states

Long-term group fan states:
- Public
- Otaku
- Core

State is per group. Same conceptual person may be Core for A, Otaku for B, Public for C; simulation uses aggregate cohorts rather than explicit overlap individuals.

Taiban has essentially no Neutral Public for the current group; audience is current-group Public/Otaku/Core. Main acquisition is Public->Otaku, not creating Public.

## 19. Live audience response and conversion

For each song:

```text
Song Response
= Performance
+ Song Appeal
+ Audience Fit
+ Familiarity/Lifecycle effects
```

Unfamiliar listener: Performance + Appeal + Fit; Freshness no effect.  
Familiar listener: add Freshness or Classicness minus Saturation.  
Popularity primarily controls KnownRate.

Setlist-level response includes Continuity, Theme Coherence, Momentum and redundancy handling. Theme Trend modifies Theme Coherence rather than buffing each song independently.

Live creates Group Live Interest and Member Affinity. At live end:
- Public interest -> weekly Public->Otaku momentum
- Otaku satisfaction -> weekly Otaku->Core momentum
- Core satisfaction -> retention/attachment

Normal conversion settles at weekly update rather than immediately. Momentum persists partially across weeks; exact sigmoid/retention constants remain provisional.

Working ordinary channel weights: Live 1.00, Livestream .45, SNS .35, Media .25. Otaku->Core normal speed ~40% of Public->Otaku was a working calibration, not final.

## 20. Member affinity

Group interest and member affinity are separate.

Member affinity sources only:
- center
- sing lead
- dance lead
- appearance

Stage Presence excluded to avoid double-counting performance.

Working appearance score:

```text
Appearance = 0.7*max(cute,pretty) + 0.3*min(cute,pretty)
```

Working role exposure:

```text
RoleExposure = 1
+ .45 center
+ .25 sing lead
+ .20 dance lead
```

`AffinityWeight = Appearance * RoleExposure`, accumulated across setlist and normalized. `no_clear_oshimen` is allowed.

## 21. Tokuten immediate conversion

Tokuten is a special immediate path, separate from normal weekly momentum:

```text
Strong Live
-> First-time Tokuten Demand
-> Member Affinity routing
-> Queue / capacity
-> Successful Interaction
-> Member-specific Fanwork Performance
-> Immediate Public -> Otaku
```

Live quality mainly determines how many Public try tokuten; member interaction quality determines closing once they arrive.

Aisu calibration: among genuinely interested first-time Public who successfully interact, ~60% immediate conversion is a high-end anchor.

500-person taiban working benchmark:
- poor ~0–2 new Otaku
- average ~2–5
- strong ~5–10
- ~10 = very good

Immediate converts are removed from Public before Sunday settlement to prevent double-counting.

## 22. Special conversion paths

Normal watching/exposure -> weekly cumulative path. Explicit relationship/participation activities may use separate Special Paths.

Potential special types:
- tokuten
- birthday
- new_member_debut
- new_song_first_reveal
- release_event
- fan_meeting
- anniversary/important one-man where justified

Graduation is explicitly **not** a special conversion path.

## 23. Fan economics and ARPU

ARPU is an annual calibration target, not direct per-person income generation. Actual money comes from activities.

Working annual direct-spending targets:

| Tier | Public | Otaku | Core |
|---|---:|---:|---:|
| E | ~¥0–1k | ¥70k | ¥300k |
| D | ~¥1–2k | ¥80k | ¥350k |
| C | ~¥3–5k | ¥90k | ¥400k |
| B | ~¥8–12k | ¥95k | ¥425k |
| A | ~¥15–25k | ¥100k | ¥450k |
| S | higher | ~¥105k | ~¥475k |

High-profile mainstream groups monetize Public meaningfully; underground groups derive little revenue from Public. Fanwork style changes spending mix more than total ARPU.

## 24. Salary and member compensation

Working monthly fixed salary benchmark:
- E ~¥120k
- D ~¥160k
- C ~¥200k
- B ~¥240k
- A ~¥300k
- S ~¥360k+

Mature D-tier model: fixed salary + ~15% tokuten back.  
E-tier may have low fixed pay and ~25–30% cheki back.  
F-tier often part-time / cheki-only but is outside current game scope due poor data.

## 25. Finance architecture

Do not use fan count * ARPU as weekly free money.

```text
Fan Stock
Public / Otaku / Core
-> activity opportunities + Tier pricing + Fanwork Style
-> actual spending by live / tokuten / merch / release / FC / etc.
-> channel-specific capture rate
-> recognized project revenue
-> member + staff + production + event + overhead costs
-> operating profit
```

Fan-side spending != project revenue. Capture is high for tokuten/direct merch, medium for own live/FC, lower for taiban tickets and distributed music retail. Merch has COGS.

## 26. AKSB — D-tier finance anchor

Working illustrative annual calibration for アキシブproject:
- ~49.5k tokuten interactions/year
- ~¥2,000 each -> ~¥99M tokuten gross
- 15% member back -> ~¥14.85M
- 9 members * ¥160k * 12 -> ~¥17.28M fixed salary
- total member compensation including minor extras ~¥34–36M
- fan-side annual spending ~¥170–180M
- recognized project revenue ~¥140–150M
- healthy operating margin roughly 10–20%

Song production is not the largest ongoing cost. Members, staff, continuous operations, merch/fanwork execution and event logistics dominate.

## 27. 高嶺のなでしこ — C-tier Admire finance anchor

2025 working estimate:
- recognized revenue ~¥550–700M, center ~¥620M
- operating profit ~¥70–130M, center ~¥100M
- margin ~12–20%, center ~17%

Typical income mix: own live/tour, merch, CD/album/release, FC/online goods, festival appearances, media/tie-up/sponsorship, streaming/licensing.

Typical costs include 10-member fixed salary ~¥24M, variable/external member comp ~¥10–15M, staff ~¥70M, lessons/rehearsal ~¥25M, concert/tour production ~¥110M, merch COGS ~¥55M, songs/choreo ~¥25M, MV/video ~¥30M, costume/styling ~¥20M, travel ~¥25M, marketing ~¥40M, shared overhead ~¥55M, ticketing/logistics/misc ~¥25M.

Gameplay interpretation: reinvestment vs present profit rather than simple survival.

## 28. iLiFE! — B-tier finance/fan anchor

S6 represented as B-tier. Annual ARPU calibration: Otaku ~¥95k, Core ~¥425k.

Interactive structure: tokuten/fanwork unusually important, but concert/merch/Public monetization become increasingly important as profile rises.

Aisu real-world calibration:
- S6 personal Otaku+Core ~5,000 working estimate
- 2025 birthday CF: 543 supporters, ¥11.965M
- 2026 birthday CF: 867 supporters, ¥16.903M
- CF supporter count is same order as Personal Core

## 29. =LOVE — A-tier finance anchor

Annual ARPU: Otaku ~¥100k, Core ~¥450k, Public aggregate average ~¥15–25k.

2025 working anchors:
- two singles combined ~700k+ physical copies
- fan-side retail spending ~¥0.9–1.0B
- major-tour attendance roughly ~265k admissions
- standard ticket ~¥9,900, premium much higher
- ticket gross ~¥3.0–3.3B
- concert + venue merch ecosystem ~¥3.5–4.0B order of magnitude
- recognized project revenue ~¥4.8–5.8B, center ~¥5.3B
- operating profit ~¥0.8–1.2B, center ~¥1.0B
- margin ~15–20%

Interpretation: margin need not explode with Tier; absolute profit explodes because fan-stock scale, Public monetization, premium products, and operating leverage grow.

## 30. Staff system

Keep staff **tier/package based**, not a Football Manager-style staff market. **LOCKED**

Package abstracts manager/road manager, booking/scheduling, production, merch/tokuten ops, admin/accounting allocation and event staffing. Higher staff package also improves next-quarter trend forecasting accuracy.

## 31. Information visibility

Recommended hidden/fuzzy:
- player producer rating
- other producers' ratings
- other groups' idol ability values except partial observation
- exact internal workload/risk formula inputs
- Natural Fitness inference
- hidden growth response
- historical pressure details
- exact TraitXP

Player may see `fitness_condition` as a readable condition band/value depending final UI choice, but should not receive direct V7/D7 risk meters or exact abnormality-roll probabilities.

## 32. AKSB sample setlist calibration

Sample 5-song set:
1. アキシブウェイ
2. 真夏のセレナーデ
3. Summer☆Summer
4. ユメハナビ
5. New World

Use identity bookends plus a coherent summer middle block. Theme Coherence can reward block structure and bookends without requiring all songs to share one theme. All D12/D12 values used here are illustrative only.

## 33. Real-world performance calibration

`探せ ダイヤモンドリリー` working calibration:
- singing D14 high-end
- dance D14 high-end
- three vocal lead slots
- no dance lead

Use as rare late-show failure anchor: low fitness condition makes D14 edge-sensitive, but failure must remain a tail event rather than expected behavior for an otherwise capable professional member.

## 34. Implementation order

1. Fan cohorts: Public / Otaku / Core
2. Per-song audience response
3. Setlist continuity / theme coherence / trend / saturation
4. Live conversion momentum
5. Member affinity + tokuten immediate conversion
6. Activity-generated spending
7. Tier ARPU sanity checks
8. Channel-specific revenue capture
9. Cost model
10. Weekly financial + fan-state settlement
11. Idol professional traits: TraitXP, 100/200/300 thresholds, activity-driven gain, slow cross-tier decay
12. Historical priors and divergence decay
13. Unified `fitness_condition` state and ActivityLoad contract
14. Live/tokuten/lesson/media/travel workload processing
15. Vocal/Physical abnormality generation, worsening, recovery, and emergency live adjustment

## 35. Locked vs provisional summary

### Strongly LOCKED
- Player = producer, not owner.
- Weekly core update.
- Historical reality as initial condition / soft prior, not forced future script.
- Event categories: Past Resolved / Pending Committed / Conditional Historical / Simulation.
- Final 17 attributes.
- Removed personality stats stay removed, including `work_rate`.
- Idol professional traits are outside core idol duties, use hidden continuous TraitXP, and display levels at 100/200/300 thresholds.
- Trait growth comes from actually performing relevant professional work; cross-tier decay is deliberately slow.
- Real-person anchors in portable specs use full display name + group affiliation/context.
- Power affects dance only, but low fitness condition lowers current effective Power along with Breath and Rhythm.
- Song Vocal/Dance difficulty scale = 8/10/12/14/16; ordinary =12.
- 0–3 Sing Lead and 0–3 Dance Lead slots; Lead requirement = corresponding difficulty +2.
- There is no separate Formation Difficulty stat.
- Fan states = Public / Otaku / Core.
- Normal conversion accumulates momentum; tokuten is separate immediate path.
- Member affinity separate from group interest.
- Member affinity sources = center / sing lead / dance lead / appearance.
- Stage Presence excluded from member affinity.
- Freshness has no effect on unfamiliar listeners.
- Popularity primarily affects KnownRate.
- Theme list = 29.
- Trend modifies Theme Coherence, not each song directly.
- **One persistent `fitness_condition` replaces Vocal/Physical Fatigue.**
- Temporary `vocal_condition` and `physical_condition` remain distinct abnormalities.
- New normal abnormalities start only at mild after sustained low condition + corresponding recent load.
- Continuing related work may worsen abnormalities; rest can recover them.
- Physical mild does not affect formation familiarity if choreography/movement remains unchanged.
- Vocal abnormality does not affect formation familiarity unless parts are actually reassigned.
- Severe Vocal may still appear with replacement parts/backing; severe Physical may still appear seated.
- Natural Fitness = recovery; Stamina = workload accumulation.
- Smooth condition amplifier formula in Section 13.
- Aisu iLiFE! stamina anchor = 19; current iLiFE! roster-level others = 18 for ultra-long-live calibration.
- Tokuten condition cost depends only on completed interactions, not scheduled duration.
- Staff package model.
- D-tier salary ~¥160k, C ~¥200k, B ~¥240k, A ~¥300k benchmark.
- Mature D-tier tokuten back ~15%.
- ARPU anchors roughly D 80/350, C 90/400, B 95/425, A 100/450 (Otaku/Core, ¥k/year).

### PROVISIONAL / tune later
- exact TraitXP gain rates, mentorship modifiers, decay/hysteresis constants
- exact ActivityLoad constants
- exact Natural Fitness recovery interpolation
- fitness-condition -> attribute exact interpolation between anchors
- abnormality probability constants and seven-day weighting
- Pitch/Agility failure probabilities
- lead-check probability math
- group dance aggregation
- ordinary conversion sigmoid
- weekly momentum retention/decay
- exact channel weights
- member-affinity coefficients
- exact Public ARPU by Tier
- exact cost/revenue capture rates
- exact AI producer hidden model

### ILLUSTRATIVE only
- exact AKSB fan counts and member tokuten split
- exact 高猫 annual P&L
- exact =LOVE annual P&L
- exact iLiFE! group fan stock outside user-confirmed anchors

---

## One-sentence system summary

**Idol Producer models a group as a weekly system in which member capability + unified fitness condition + temporary vocal/physical abnormalities determine performance, performance + song/setlist fit create fan interest, interest converts Public->Otaku->Core through ordinary and special paths, those cohorts spend differently by Tier and Fanwork Style, and channel-specific revenue is consumed by members, staff, production, events, and overhead to produce a realistic operating business with strategic tradeoffs rather than deterministic growth.**
