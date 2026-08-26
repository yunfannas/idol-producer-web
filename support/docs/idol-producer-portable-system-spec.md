# Idol Producer — Portable System Design Spec

> Portable design snapshot for migration to a new thread/model/repo context.  
> Simulation opening: **S6 = 2025-07-05**.  
> Status tags: **LOCKED** = current design truth; **PROVISIONAL** = direction agreed, constants tunable; **ILLUSTRATIVE** = calibration/example only; **REAL-WORLD ANCHOR** = observation used for calibration, not a forced future script.

---

## 1. Core game philosophy

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
- =LOVE = A
- iLiFE! = B
- 高嶺のなでしこ = C
- アキシブproject = D

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
- AKSB Mirei exit = Pending Committed.
- AKSB Hina health exit = Conditional Historical, high pressure.
- AKSB Kae exit = Conditional Historical, medium/high pressure.

Historical prior: use roughly the preceding 52 weeks for player-relevant idols as a soft prior for Career Robustness, Physical Risk, and Crisis/Rule Risk. Do not convert history into speculative personality traits. Prior fades over about one game year and faster after major divergence.

## 4. Idol attributes V2

Final 17 attributes, 0–20. **LOCKED**

Physical:
- agility
- natural_fitness
- stamina

Appearance:
- cute
- pretty

Performance:
- pitch
- tone
- breath
- rhythm
- power
- stage_presence

Communication / Creative:
- wit
- humor
- talking
- teamwork
- fashion
- creativity

Definitions:
- wit = real-time verbal/social improvisation, not intelligence.
- humor = ability to produce entertaining/comedic effect.
- creativity = originate/develop content/concept ideas.
- teamwork = collaborative execution only, not personality niceness.
- talking = stable speaking/MC/interview/conversation competence.
- power = dance-only; never enters singing.

Removed hidden/personality-style stats include determination, professionalism, injury_proneness, ambition, loyalty, work_rate, assertiveness, role_ambition. Do not reintroduce them as disguised proxies.

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

Rana: vocal technical attributes around 17, stage_presence 17–18, talking 17; D-tier veteran performance/MC core. Physical anchor remains tunable.

Mirei: vocal bottleneck about 14, dance 14–15, stage 15–16, visual 16–17.

新居: singing about 13, talking 16–17, wit 19, humor 18, creativity 18–19.

Maika: vocal 18–19, tone potentially 19, stage about 18, dance >=16.

Iori: stage_presence about 19 candidate.

=LOVE dance anchors: Anna ~19, Emiri/Kiara ~17, Maika ~16.

Momona: singing 13–15, dance 15–16, stage 16–17, cute/pretty 18–19, fashion 17–18.

Aisu:
- dance ~17
- singing ~14–16
- talking/wit/humor ~17–18
- Fan-work Adaptation ~19
- **stamina = 19 LOCKED**

Haruka remains a historical/high-endurance archetype but is **not part of current iLiFE! roster calibration**.

## 6. Growth system

Physical:
- agility and stamina train slowly.
- natural_fitness is relatively stable.
- long inactivity can decondition physical capability.

Technical:
- no ordinary passive decay.
- requires training + relevant practice.
- strong saturation at high level.

Communication/creative:
- no ordinary decay.
- develops mainly through use, interest, and role exposure rather than direct specialty-training buttons.

Player controls broad Physical/Singing/Dance intensity, member adjustment, and Individual Development Freedom. Hidden growth-response domains exist only where useful. Fan-work Adaptation is current capability/state; its growth response stays hidden.

## 7. Fanwork policy

Group policy types:
- Admire
- Mixed
- Interactive

Anchors:
- 高猫 = Admire
- Jams = Mixed
- iLiFE! = Interactive

Fanwork style is orthogonal to Tier. It changes **where** spending occurs more than total ARPU:
- Interactive -> tokuten/release/birthday-heavy
- Admire -> concert/premium/merch/FC-heavy
- Mixed -> balanced

## 8. Song model

Static:
- `themes: SongTheme[]`
- `traits: SongTrait[]`
- `appeal`

Dynamic weekly:
- `popularity`
- `freshness`

Appeal = stable tendency to be liked when exposed.
Popularity mainly determines familiarity/KnownRate.
Freshness affects only listeners who already know the song.
Classicness is derived from age, durable popularity, historical peak, etc.

Lifecycle:
- new = high freshness, low classicness
- middle/nonclassic = low freshness, low classicness, most saturation-sensitive
- classic = freshness 0 but strong ritual/attachment payoff

## 9. Song themes

Locked 29 themes:

Season: spring, summer, autumn, winter.
Relation: romance, friendship, family, idol_otaku.
Setting: school, urban, beach, night.
Emotion: joy, sadness, loneliness, hope, nostalgia, anxiety.
Situation: separation, reunion, celebration, challenge.
Identity/Message: self_esteem, empowerment, aspiration, rebellion.
Aesthetic/Tone: cute, cool, dark, dreamy.

Typical song uses 2–4 themes. Composite labels such as graduation or heartbreak should be represented by combinations of atomic themes.

Theme trend per quarter is in {-2,-1,0,+1,+2}. Seasonal themes use deterministic seasonal patterns; other themes initialize around zero and evolve with inertia, successful high-profile content, SNS amplification, and saturation/crowding.

Trend modifies **Theme Coherence at setlist level**, not every song independently. Staff package affects next-quarter trend forecast quality.

## 10. Song difficulty / traits / leads

Default ordinary idol song:
- singDifficulty 12
- danceDifficulty 12

Difficulty tiers: 10 / 12 / 14 / 16.

Traits:
- easy_vocal -> 10
- difficult_vocal -> 14
- very_difficult_vocal -> 16
- low_dance -> 10
- difficult_dance -> 14
- very_difficult_dance -> 16
- sing_together
- complex_formation

No separate vocal_showcase/dance_showcase traits.

Arrangement fixes maximum lead slots:
- `vocalLeadSlots`
- `danceLeadSlots`

Player may assign fewer than max.

Lead requirement defaults to song difficulty +2.

Vocal Lead:
- extra downside/risk role
- failed higher check -> penalty
- strong pass -> no additional raw bonus

Dance Lead:
- extra upside role
- successful higher check -> bonus
- failed extra lead check -> no additional penalty beyond normal dance result

`sing_together`: no vocal lead; average participating members' relevant singing attributes and run the group kernel.

ToneFactor and PowerFactor come from themes. Tone is a singing pure bonus; Power is a dance pure bonus. Difficulty and Appeal may be weakly positively correlated in generation but never deterministic.

## 11. Performance kernel

Keep detailed attributes mathematically distinct; do not collapse them into one sing/dance stat.

Internal fatigue states:
- Vocal Fatigue 0–100
- Physical Fatigue 0–100

Exact values are hidden/fuzzy to player.

Singing:
- Breath + Rhythm determine continuous baseline vs difficulty.
- Breath/Rhythm are fatigue-sensitive.
- Pitch is not fatigue-sensitive; below difficulty creates probabilistic downside only.
- Positive Pitch margin gives no bonus.
- Tone is fatigue-insensitive and gives a theme-scaled positive bonus.
- Stage Presence is fatigue-insensitive and acts as final multiplier.
- Power never enters singing.

Dance:
- current Rhythm vs danceDifficulty gives continuous baseline.
- Agility below difficulty creates probabilistic downside; positive margin gives no bonus.
- Power gives a theme-scaled positive bonus.
- Stamina controls fatigue accumulation, not raw score.
- Stage Presence acts as final multiplier.

Critical checks use probabilistic failure. Current rough margin calibration: +3 <0.5%, +2 ~1%, +1 ~3%, 0 ~7%, -1 ~15%, -2 ~30%, -3 ~50%. **PROVISIONAL**

## 12. Per-segment live loop

For each song:
1. compute current effective Breath/Rhythm from fatigue
2. singing kernel
3. dance kernel
4. combine performance
5. audience response
6. update momentum
7. immediately apply vocal/physical load

Other segments:
- MC -> small recovery
- costume change -> recovery
- encore break -> larger recovery
- unit/offstage -> nonparticipants recover
- low-movement/float arrangements -> reduced load

Do not calculate the entire show before applying fatigue.

## 13. Fatigue / Stamina — current calibrated model

### 13.1 Stamina semantics

- Sta10: standard chika block of ~5-song taiban + ~20m rest + ~1h busy tokuten (~100 interactions), tired but functional.
- Sta14: ordinary professional ~15-song one-man.
- Sta16: strong professional endurance for ~20–25-song large live.
- Sta18: can finish a ~35–40-song ultra-long live with meaningful breaks, but should finish heavily fatigued (~70% in current iLiFE! anchor).
- Sta19: elite endurance; only ~5–10% lower total fatigue than Sta18 in the same ultra-long live and still >60 at the end.
- Sta20: extreme endurance outlier, not required for current iLiFE! calibration.

Current iLiFE! calibration:
- **Aisu = Sta19**
- **other current iLiFE! members = Sta18** as roster-level endurance calibration
- Haruka excluded from current roster calibration

### 13.2 Stamina multipliers

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

18->19 lowers base load by only ~5.3%. Extra end-show difference emerges because Sta19 reaches the high-fatigue region later.

### 13.3 Smooth fatigue amplifier

**LOCKED**

```text
FatigueAmplifier(F)
= 0.62
+ 0.0025 * F
+ 0.75 / (1 + exp(-(F - 67) / 10))
```

Approx:

| F | Amplifier |
|---:|---:|
| 0 | ~0.62 |
| 20 | ~0.67 |
| 40 | ~0.75 |
| 50 | ~0.84 |
| 60 | ~0.99 |
| 70 | ~1.20 |
| 80 | ~1.39 |
| 90 | ~1.52 |
| 100 | ~1.61 |

Meaning: 0–30 is a stable work zone; 40–60 gradually gets more expensive; 60–75 becomes meaningfully self-reinforcing; 80+ is expensive but has no artificial discontinuity.

### 13.4 Physical fatigue

Dance load is comparatively even across participating members.

```text
PhysicalLoad
= BaseDanceLoad
* DanceParticipation
* StaminaMultiplier
* FatigueAmplifier(currentPhysicalFatigue)
```

DanceParticipation working examples:
- normal full choreography ~1.00
- somewhat simplified ~0.80–0.90
- 客降 / deliberate low movement ~0.50–0.70
- unit/partial = based on actual stage time
- offstage = no song load; recovery instead

### 13.5 Vocal fatigue

Vocal load is more individualized than dance load.

```text
VocalLoad
= BaseVocalLoad
* PerformerCountFactor
* IndividualVocalShare
* BreathEfficiency
* SingLeadFactor
* DanceCrossFactor
* StaminaMultiplier
* FatigueAmplifier(currentVocalFatigue)
```

Performer-count factor is mild rather than 1/N:

| Active vocal performers | Factor |
|---:|---:|
| 10 | 0.80 |
| 8 | 0.85 |
| 6 | 0.92 |
| 4 | 1.00 |
| 3 | 1.08 |
| 2 | 1.18 |
| solo | 1.35 |

`IndividualVocalShare` separately represents the member's actual line share.

Breath efficiency working coefficients:

| Breath | Multiplier |
|---:|---:|
| 10 | 1.15 |
| 12 | 1.08 |
| 14 | 1.00 |
| 16 | 0.93 |
| 18 | 0.87 |
| 20 | 0.82 |

Breath therefore affects both singing capability and physiological efficiency, while Stamina remains general endurance.

Sing-lead load:
- normal = 1.00
- sing lead = 1.10
- major lead ~1.15 optional/provisional

Dance cross-load into vocals:
- 客降 / low movement = 1.00
- normal dance = 1.05
- high dance = 1.10
- very high dance = 1.15

客降 mainly saves Physical Fatigue; it does not create free Vocal recovery, though it mildly protects vocals by reducing whole-body respiratory demand.

### 13.6 38-song iLiFE! anchor

**REAL-WORLD ANCHOR / LOCKED calibration target**

Scenario:
- 38 performed songs
- ~4 breaks of roughly 15 minutes, including costume changes
- some songs simplified choreography / 客降
- encore had no difficult songs

Target final Physical Fatigue:

```text
Sta18: ~68–72, center ~70
Sta19: ~63–67, clearly >60
```

The 18->19 benefit should therefore be only ~5–10% in expressed end fatigue.

Target Vocal Fatigue should vary more by member:
- low vocal share / strong Breath: ~55–60
- ordinary share: ~60–68
- heavy lead/major vocal share: ~68–75

These vocal ranges are calibration targets rather than exact locked outputs.

15-minute break working recovery target: about **3 fatigue points**, provisional. Ultimately use the common Natural Fitness/time-based recovery system rather than a concert-only heal.

Previous song base-load references D10 3.2 / D12 4.2 / D14 5.4 / D16 7.0 remain provisional. Physical and Vocal base loads should now be calibrated separately. Tune base loads and recovery to reality; do not widen Sta18/19/20 gaps just to force a fit.

### 13.7 Fatigue-to-attribute loss target

| Fatigue | Attribute loss |
|---:|---:|
| 0–20 | ~0 |
| 30 | ~0.2 |
| 40 | ~0.5 |
| 50 | ~1.0 |
| 60 | ~1.6 |
| 65 | ~2.0 |
| 70 | ~2.5 |
| 80 | ~4.0 |
| 90 | ~5.5 |
| 100 | ~7.0 |

Current Rhythm depends primarily on Physical Fatigue. Current Breath depends primarily on Vocal Fatigue plus a smaller Physical cross-effect; ~20–25% of physical-fatigue-derived loss remains a provisional direction. Fatigue does not directly reduce Pitch, Tone, Agility, or Power.

## 14. Natural Fitness / recovery

Natural Fitness governs off-stage/time-based recovery, not within-song endurance. **LOCKED**

Anchors:
- NF14 = 1.00 recovery multiplier
- NF18 = 1.35

Suggested interpolation: NF10 .75, NF12 .87, NF14 1.00, NF16 1.17, NF18 1.35, NF20 1.50.

Recovery runs continuously through schedule gaps. Travel mainly reduces recovery quality rather than creating huge direct fatigue. A first live can begin with residual fatigue from travel/rehearsal.

Lesson fatigue at Sta14 baseline:
- Light: Vocal +1.0/h, Physical +1.5/h
- Medium: +2.0/+2.5 per h
- Heavy: +3.0/+3.5 per h

## 15. Tokuten fatigue / fanwork

Tokuten fatigue depends only on **actual completed interactions**, linearly. **LOCKED**

No duration surcharge and no artificial diminishing interaction count. Idle time naturally recovers via time/NF.

Previous per-interaction provisional baseline:
- Vocal +0.115
- Physical +0.070

Recalibrate exact Aisu totals using the new Sta19 multiplier and smooth amplifier; old Sta18 examples are obsolete.

Fan-work Adaptation does not reduce Vocal/Physical fatigue. It protects mental/social quality over long interaction sessions.

## 16. Fan states

Long-term per-group states:
- Public
- Otaku
- Core

A person can conceptually be Core for one group, Otaku for another, Public for another; implementation can use cohort aggregates rather than individual cross-group identity.

Taiban audiences effectively contain the current group's Public/Otaku/Core rather than a permanent Neutral/general_otaku layer. Main acquisition is Public -> Otaku.

## 17. Live conversion

Normal path:

```text
Attendance
-> audience Public/Otaku/Core mix
-> per-song Audience Response
-> Group Live Interest + Member Affinity
-> end-live weekly momentum
-> Sunday settlement
Public -> Otaku
Otaku -> Core
Core -> retention/attachment
```

Song response:
- unfamiliar listener: Performance + Appeal + Audience Fit
- familiar listener: Performance + existing attachment/appeal + Freshness or Classicness - Saturation + Fit

Setlist-level factors include Continuity, Theme Coherence, Trend-through-Coherence, redundancy, and momentum.

Live should not directly do `attendance * flat conversion rate`.

Working channel-strength references for ordinary conversion momentum:
- Live 1.00
- Livestream .45
- SNS .35
- Media .25

Exact conversion sigmoid and weekly retention/decay remain provisional.

Otaku -> Core is much slower than Public -> Otaku; a prior rough calibration around 40% of the Public->Otaku speed is provisional.

## 18. Member affinity

Group interest and member affinity are separate.

Member affinity sources are deliberately limited to:
- center exposure
- sing lead
- dance lead
- appearance

Stage Presence is excluded to avoid double-counting performance.

Working appearance score:

```text
Appearance = 0.7*max(cute,pretty) + 0.3*min(cute,pretty)
```

Working role exposure:

```text
RoleExposure = 1
 +0.45 if center
 +0.25 if sing lead
 +0.20 if dance lead
```

`AffinityWeight = Appearance * RoleExposure`, accumulated across the setlist and normalized.

Allow `no_clear_oshimen`. If a sufficiently interested Public attends tokuten without a clear oshimen, choose among available members without reweighting by appearance again; successful interaction can establish initial oshimen.

## 19. Tokuten immediate conversion

Tokuten is a **special immediate path**, separate from normal weekly momentum:

```text
Strong Live
-> First-time Tokuten Demand
-> Member Affinity routing
-> Queue/capacity
-> Successful interaction
-> member-specific fanwork performance
-> immediate Public -> Otaku
```

Live quality mainly determines how many Public decide to try tokuten. Member interaction quality determines closing rate.

Aisu calibration: among genuinely interested first-time Public who actually complete an interaction, about **60% immediate conversion** is a working high-end anchor.

500-person normal taiban direct tokuten conversion rough benchmark:
- poor 0–2
- average 2–5
- strong 5–10
- ~10 = very good

Fans converted immediately are removed from Public before weekly settlement to avoid double counting.

Other special paths can include birthday, new-member debut, new-song first reveal, release event, fan meeting, anniversary/important one-man. Graduation is **not** a special conversion path.

## 20. Fan economics / ARPU

ARPU is a long-run calibration target, not a direct per-head weekly payout.

Working annual direct-spending centers:

| Tier | Public | Otaku | Core |
|---|---:|---:|---:|
| E | ~¥0–1k | ¥70k | ¥300k |
| D | ~¥1–2k | ¥80k | ¥350k |
| C | ~¥3–5k | ¥90k | ¥400k |
| B | ~¥8–12k | ¥95k | ¥425k |
| A | ~¥15–25k | ¥100k | ¥450k |
| S | higher | ~¥105k | ~¥475k |

Tier raises Otaku/Core spending only mildly. High-tier revenue growth mainly comes from a much larger fan stock, stronger Public monetization, and more valuable products/opportunities.

## 21. Member salary / back

Simple fixed-salary benchmark:
- E ~¥120k/month
- D ~¥160k/month
- C ~¥200k/month
- B ~¥240k/month
- A ~¥300k/month
- S ~¥360k+/month

Mature D-tier model: fixed salary + about **15% tokuten back**.

E-tier often has much lower fixed pay and may rely more on ~25–30% cheki back. F-tier all-part-time / cheki-only economics is intentionally not modeled because evidence is sparse.

## 22. Finance engine

Do not calculate `fan_count * ARPU` as direct weekly revenue. Actual activities generate spending; annual simulation should converge around ARPU calibration.

Pipeline:

```text
Fan Stock
-> activity/channel spending
-> channel-specific capture
-> project recognized revenue
-> direct/operating costs
-> operating profit
```

Channel capture differs:
- high: tokuten, direct merch, own premium events
- medium: own one-man, FC, some direct goods
- lower: taiban tickets, distributed CD/music retail, external event tickets

Merch has COGS. Crowdfunding can carry large production/fulfillment obligations.

Costs include member compensation, staff package, lessons/studio, venue/event production, travel/hotel, songs/recording/choreo, MV, costume/styling, cheki/merch COGS, marketing/ticketing/IT, agency/shared overhead.

Song production is not the largest ongoing cost for a mature group; members, staff, continuous operations, fanwork/merch execution, and event logistics are larger.

## 23. D-tier AKSB financial calibration

Illustrative working model:
- ~49.5k annual tokuten interactions
- ~¥2,000 each
- tokuten gross ~¥99M
- 15% member back ~¥14.85M
- 9 * ¥160k * 12 fixed salary ~¥17.28M
- base + tokuten back ~¥32.1M
- with external work/allowances, member compensation ~¥34–36M/year

Working scale:
- fan-side spending ~¥170–180M
- recognized project revenue ~¥140–150M
- healthy margin target ~10–20%

Exact fan counts/member sales split are illustrative.

## 24. C-tier 高嶺のなでしこ financial calibration

2025 working project estimate:
- recognized revenue ~¥550–700M, center ~¥620M
- costs center ~¥510–520M
- operating profit center ~¥100M
- margin ~12–20%, center ~17%

Revenue mix shifts toward own live/tour tickets, merch, CD/album/release, FC/online goods, festivals, media/tie-up/sponsorship, streaming/licensing.

Gameplay: main tension is reinvestment vs current profit, not basic survival.

## 25. B-tier iLiFE! financial/fan calibration

S6 game representation: B-tier.

ARPU:
- Otaku ~¥95k
- Core ~¥425k

Interactive structure means fanwork/tokuten is unusually important, while concert/merch/Public monetization becomes more important as profile rises.

Aisu anchors:
- S6 personal Otaku+Core ~5,000 working user estimate
- 2025 birthday CF: 543 supporters / ¥11.965M
- 2026 birthday CF: 867 supporters / ¥16.903M
- CAMPFIRE supporters are roughly the same **order of magnitude** as Personal Core

## 26. A-tier =LOVE financial calibration

ARPU:
- Otaku ~¥100k
- Core ~¥450k
- Public aggregate ~¥15–25k

High-profile mainstream difference: the large Public pool contributes meaningful revenue.

2025 working anchors:
- two singles combined ~700k+ physical copies
- fan-side retail spend ~¥0.9–1.0B
- annual major-tour admissions roughly ~265k
- standard ticket around ¥9,900; premium much higher
- ticket gross ~¥3.0–3.3B
- concert + venue merch ecosystem ~¥3.5–4.0B order of magnitude

Working project P&L:
- recognized revenue ~¥4.8–5.8B, center ~¥5.3B
- operating profit ~¥0.8–1.2B, center ~¥1.0B
- margin ~15–20%

High-tier margin need not be dramatically higher than D/C; absolute profit explodes because of scale and operating leverage.

## 27. Staff system

Use tier/package-based staff, not an FM-style individual staff hiring market. **LOCKED**

Package abstracts manager/road manager, booking/scheduling, production, merch/tokuten ops, admin/accounting allocation, and event staffing. Higher package also improves trend forecast quality.

## 28. Information visibility

Keep fuzzy/hidden where appropriate:
- producer rating
- other producers' ratings
- other groups' exact idol ability values
- exact Vocal/Physical Fatigue
- Natural Fitness inference
- hidden growth response
- historical pressure details

Player should make decisions under uncertainty.

## 29. AKSB sample setlist calibration

Example:
1. アキシブウェイ
2. 真夏のセレナーデ
3. Summer☆Summer
4. ユメハナビ
5. New World

Structure: identity bookends around a coherent summer middle block. Theme Coherence can reward contiguous blocks/bookends, not only exact repetition. Trend amplifies coherence rather than independently buffing each song.

## 30. Rare failure anchor

`探せ ダイヤモンドリリー` working calibration:
- singing D14 high-end
- dance D14
- three vocal lead slots
- no dance lead

Use as a rare late-show failure anchor. Fatigue around 60–70 should make D14 edge-sensitive, but failure remains a tail event rather than an expected result.

## 31. Recommended implementation order

1. Fan state cohorts: Public/Otaku/Core
2. Per-song live audience response
3. Setlist continuity/coherence/trend/saturation
4. Live conversion momentum and retention
5. Member affinity + tokuten immediate conversion
6. Activity-generated spending
7. Tier ARPU sanity checks
8. Channel-specific revenue capture
9. Cost model
10. Weekly financial + fan-state settlement
11. Historical priors and divergence decay

## 32. Lock-state summary

Strongly locked:
- player = producer, not owner
- weekly core update
- historical soft-prior/divergence philosophy
- event categories
- 17 attributes
- power dance-only
- Public/Otaku/Core
- taiban has no permanent Neutral/general_otaku layer
- normal conversion momentum vs tokuten immediate path
- member affinity separate from group interest
- affinity sources = center/sing lead/dance lead/appearance
- freshness irrelevant to unfamiliar listeners
- popularity primarily drives KnownRate
- 29 song themes
- trend acts through Theme Coherence
- two fatigue states Vocal/Physical
- Natural Fitness = recovery, Stamina = accumulation efficiency
- smooth FatigueAmplifier formula above
- current high-end stamina multipliers Sta18=.76 / Sta19=.72 / Sta20=.68
- current iLiFE! endurance calibration Aisu19 / other current members18
- 38-song anchor target Sta18 ~70, Sta19 mid-60s
- tokuten fatigue only per completed interaction
- staff package model
- salary anchors D160k/C200k/B240k/A300k
- mature D-tier back ~15%
- ARPU anchors D80/350, C90/400, B95/425, A100/450 (Otaku/Core, ¥k/year)

Still provisional:
- lower-end stamina curve
- BaseDanceLoad/BaseVocalLoad tables
- exact break/time recovery curve
- BreathEfficiency coefficients
- performer-count factors
- fatigue-to-attribute interpolation
- Pitch/Agility/Lead probability math
- group dance aggregation
- ordinary conversion sigmoid
- momentum retention/decay
- channel weights
- affinity coefficients
- exact Public ARPU by tier
- exact channel capture/cost rates
- exact AI producer model

Illustrative only:
- exact AKSB fan counts/member sales split
- exact 高猫 annual P&L
- exact =LOVE annual P&L
- exact iLiFE! group fan stock outside user-confirmed anchors

---

## One-sentence system summary

**Idol Producer models a group as a weekly system in which member capability + fatigue determine performance, performance + song/setlist fit create fan interest, interest converts Public -> Otaku -> Core through ordinary and special paths, those cohorts spend differently by Tier and Fanwork Style, and channel-specific revenue is consumed by members, staff, production, events, and overhead to produce a realistic operating business with strategic tradeoffs rather than deterministic growth.**
