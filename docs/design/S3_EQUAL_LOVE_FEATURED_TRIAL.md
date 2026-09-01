# Idol Producer — S3 Featured Trial Design
## =LOVE Audition & Debut, 2017

Version: Draft 1.0
Status: Implementation baseline
Scenario date: 2017-04-03
Trial end milestone: 2017-08-05 TIF live debut + post-debut agency meeting

---

## 1. Purpose

This featured trial is the recommended entry point for Idol Producer.

It is not a separate minigame. It is a fast-entry mode into Scenario 3 and should later be able to continue directly into the full S3 world.

Core player experience:

- work with incomplete information
- rely on staff rather than personally observing everything
- select members from a large audition pool
- use limited producer time deliberately
- conduct direct interactions with a limited number of candidates/members
- build a new group under a fixed agency mandate
- train the selected roster toward a hard debut deadline
- experience live performance mainly as a spectator/presentation layer
- receive imperfect post-live staff evaluation
- complete the first management review after debut

Design principle:

> Historical convergence, not historical enforcement.

The player makes many local choices, but agency constraints, deadlines, candidate qualities, staff limitations and historical opportunities naturally pull the project toward a plausible result near reality.

---

## 2. Scenario / Entry Structure

Full S3 opening date:

**2017-04-03 (Monday)**

Featured Trial uses the same world identity:

- `scenario_id = S3`
- `entry_mode = featured_trial`
- `start_phase = equal_love_audition`

When full S3 is implemented, trial saves should continue without conversion loss.

Persistent state includes:

- roster
- alternate-history members
- attributes
- knowledge estimates
- traits / trait evidence
- staff
- finances
- condition/fatigue
- work familiarity
- formation familiarity
- fanbase
- TIF result
- agency feedback

---

## 3. Trial World Scope

The trial uses an isolated micro-world rather than simulating all idol groups in 2017.

Required entities:

- 指原莉乃 as player character
- =LOVE historical members
- known audition-related historical people
- about 15 additional real historical candidates prepared separately from database research
- generated candidates to fill the 103-person final audition pool
- necessary staff
- necessary songs and rehearsal content
- fixed/abstracted Sashihara schedule blocks
- HKT/AKB live snapshots only where needed
- TIF 2017 debut event
- major historical world events relevant to the player

Other groups exist as static context only. No full AI management simulation is required.

---

## 4. Player Character — 指原莉乃

This trial uses a special `historical_dual_role` mode.

The player is simultaneously:

- producer
- active HKT48 / AKB48 idol
- TV / media talent

This special role can continue until her 2019 idol graduation in full S3, but the demo only needs the first four months.

### 4.1 Dual-role tradeoff

Before graduation:

- Personal Schedule Load: High
- Producer Availability: Limited
- Industry Influence: Very High

After graduation in the future full scenario:

- Personal Schedule Load: Lower
- Producer Availability: Higher
- Industry Influence: remains High / Very High

### 4.2 Influence buff

Influence affects opportunities rather than member attributes.

Examples:

- festival access
- media exposure
- label credibility
- venue access
- composer/choreographer access
- press attention
- initial public awareness

It must not directly add to singing/dancing stats.

---

## 5. Agency Strategy

The trial shows a fixed, non-editable Agency Strategy / Project Mandate.

The player is a producer under constraints, not an owner.

Suggested fixed fields:

- Agency/Partner: 代々木アニメーション学院
- Producer: 指原莉乃
- Project Type: voice actress / idol project
- Target Roster: around 13
- Recommended Range: roughly 11–14
- Live Debut Window: summer 2017
- Commercial Debut Plan: autumn 2017
- Core Direction: mainstream idol + voice acting / 2D crossover
- Market Positioning: nationwide / major-backed
- Training Priorities: vocal, dance, communication, stage readiness
- Budget Level: above ordinary chika-idol startup
- Risk Tolerance: medium

Players may optimize inside this frame, but cannot rewrite the project into a fundamentally different concept.

---

## 6. Candidate Pool

Use the real final-audition scale:

**103 candidates**

The first large-scale document/interview stages happen before the player's main involvement.

The 103-person group is already the high-density final selection pool.

Pool composition:

- historical =LOVE members / known finalists
- known related historical people
- approximately 15 additional real historical candidates supplied by database research
- generated newcomers for the remainder

Historical identity should only be hidden when it was not already publicly known at the time.

---

## 7. Portrait / Identity Rules

Use three portrait types:

- `Portrait Type 1`
- `Portrait Type 2`
- `Generated`

### Type 1

Strong pre-=LOVE public identity. Use a real pre-=LOVE face reference strongly enough that fans can recognize the person.

### Type 2

Historical real person, but little or no strong prior public idol identity. Use weaker reference and allow noticeable facial deviation.

### Generated

Fully fictional candidate.

### AUDITION_PORTRAIT_V1

All audition portraits should look like they were shot on the same audition day:

- plain white background
- 4:5 ratio
- head-and-shoulders / chest-up
- straight-on or slight angle
- looking at camera
- natural slight smile
- soft even studio light
- natural/light makeup
- no stage costume
- no group logo or member color
- no large jewelry, hats, or oversized hair accessories
- simple age-appropriate casual top
- ordinary Japanese young-woman hairstyle variation

After official selection, historical matches can switch to historically appropriate early-group portraits; alternate-history members receive generated formal debut portraits.

---

## 8. Attribute System V2

All attributes use a 0–20 scale.

### Physical
- agility
- natural_fitness
- stamina

### Appearance
- cute
- pretty

### Performance
- pitch
- tone
- breath
- rhythm
- power
- stage_presence

### Communication / Creative
- wit
- humor
- talking
- teamwork
- fashion
- creativity

Total: 17 attributes.

### Long-term rule

Dance/vocal-related attributes change slowly over long periods.

Short audition camps should not cause dramatic attribute increases.

---

## 9. Work Familiarity System

Separate long-term attributes from short-term mastery.

### Individual Work Familiarity

Per-member familiarity with a specific song/choreography/part.

Represents:

- memorizing lyrics
- memorizing choreography
- position familiarity
- timing familiarity
- part familiarity

This can increase rapidly over days.

### Formation Familiarity

Per-song/per-lineup/per-formation group familiarity.

Represents:

- spacing
- transitions
- coordinated movement
- specific formation repetition
- group timing

Even if all individuals know the song well, a newly changed formation may still be weak.

### Learning rate

No special “Fast Learner” attribute is required.

Derived learning rates:

- `vocal_learning_rate = f(wit, stage_presence, vocal fundamentals)`
- `dance_learning_rate = f(wit, stage_presence, dance fundamentals)`

`wit` and `stage_presence` have large influence. Existing technical ability provides additional support.

This is how cases such as 髙松瞳 learning choreography unusually quickly can emerge naturally.

---

## 10. Traits

Traits are separate from attributes.

Examples:

- Center Aspiration
- Actress Aspiration
- Solo Aspiration
- Producer Mindset
- Variety Lover
- Idol Otaku
- Perfectionist
- Fan-Service Lover
- SNS Enthusiast
- Fashion-Conscious
- Conflict-Averse

Pure newcomers may have no traits at all.

### Trait evidence

Traits use hidden, reversible evidence.

Evidence may:

- increase
- decrease
- decay toward neutral
- be contradicted by later behavior

A confirmed trait may later weaken/disappear if evidence changes.

Do not use traits as replacement numerical personality attributes.

---

## 11. Knowledge / Staff Team Estimate

The attribute panel is not the player's omniscient knowledge.

It is the **staff team's collective estimate**.

Information layers:

1. True Attribute — hidden engine truth
2. Staff Team Estimate — fuzzy value/range shown on the panel
3. Individual Staff Opinion — report text from specific staff
4. Player Inference — what the human player personally concludes

These layers must not automatically synchronize.

A staff report saying “she learns choreography unusually fast” does not automatically narrow `wit` immediately.

### Observability

All attributes remain imperfectly observable. No 1.0 observability coefficient.

Relatively easier:

- pitch
- rhythm
- talking

Medium:

- tone
- power
- agility
- cute
- pretty
- humor
- fashion

Hard:

- breath
- stamina
- wit
- stage_presence
- creativity

Very hard:

- natural_fitness
- teamwork

Knowledge should converge more slowly than typical Football Manager scouting.

Two weeks of audition should make selection possible, not make every candidate fully known.

---

## 12. Fatigue / Effective Attributes

### Player character

For Sashihara herself:

- fatigue is shown precisely
- current effective attributes after fatigue/condition modifiers are shown precisely

This makes the effect of schedule load immediately understandable.

### Candidates / members

For other idols:

- fatigue is fuzzy
- base attributes are fuzzy according to staff knowledge
- current effective attributes after fatigue are also fuzzy

The player may see a reliable directional indicator such as ↓ or ↓↓ even when the exact number is uncertain.

Long-term own-group members may eventually have exact base attributes, while daily fatigue/effective ability can remain mildly uncertain.

---

## 13. Direct Interaction

Direct interaction is a persistent time-consuming system from audition through normal career management.

Uses:

- improve staff-team knowledge through targeted assessment
- collect trait evidence
- build trust/relationship
- discover career goals or concerns
- discuss role/center/part expectations
- identify possible stress or dissatisfaction

Interactions consume actual in-game time.

There is no separate action-point currency.

The player cannot talk to everyone equally.

---

## 14. Time System

Use existing semi-real-time / time-as-resource design.

Examples:

- observe a rehearsal group: hours
- candidate interview: tens of minutes
- staff meeting: about an hour
- live participation: several hours plus travel/rehearsal
- rest: time passes

Game pauses for decisions and then advances by the action duration.

---

## 15. Live System Positioning

Live is primarily an immersion/presentation layer.

There are only two player viewing modes:

### Highlight

- about 30 seconds per song
- limited formation changes
- short member/part presentation
- light atmospheric audience response

### Skip / Instant Result

- no stage presentation
- calculate results immediately

Live itself should not pretend to simulate precise audience quality or exact “how good was the concert” scoring.

The player briefly becomes a spectator.

Detailed interpretation happens later in imperfect staff reports.

---

## 16. Sashihara Live Tutorial

Only the first player-performed live needs full Highlight presentation.

Suggested event:

**2017-04-07 — HKT48 Spring Kanto Tour, Matsudo**

Use roughly five real setlist songs as a tutorial slice.

Purpose:

- demonstrate live presentation
- demonstrate fatigue and effective attributes
- show how position/part/style can alter what the player sees

All later Sashihara lives are calendar/time/condition events by default and can resolve instantly.

---

## 17. Trial Timeline

### 2017-04-03 to 04-09 — Opening / Producer Tutorial Week

- project briefing
- fixed agency strategy
- staff introduction
- candidate overview
- calendar/time tutorial
- direct interaction tutorial
- 4/7 HKT live tutorial

### 2017-04-10 to 04-15 — Audition Camp Week 1

103 candidates participate.

Content:

- vocal trial
- dance trial
- fast-learning tasks
- basic stage trial
- short MC
- group cooperation
- rehearsal

Candidates are split into manageable groups.

Daily staff reports summarize:

- major updates
- standouts
- concerns
- staff disagreements
- group notes

No 103-person wall of text.

### End of Week 1 — First Cut

The player decides how many to keep.

System recommendation:

**20–30 candidates**

But the number is not fixed.

Tradeoff:

- fewer survivors = more observation depth, more risk of premature elimination
- more survivors = more optionality, less observation/training density

### 2017-04-16 — Rest / Intermediate Review

- staff summary
- health/family/contract checks
- direct interviews
- group reshuffle
- preparation for Week 2

### 2017-04-17 to 04-22 — Audition Camp Week 2

Deep evaluation:

- shuffled groups
- center rotation
- vocal units
- MC tasks
- camera tests
- complex group cooperation
- pressure tests
- final performance preparation

### 2017-04-22 — Final Showcase

Camp ends.

Do not force immediate final selection.

### 2017-04-23 to 04-28 — Final Review Week

Nature of play shifts from discovery to decision.

Actions:

- review videos
- direct interviews
- staff final meetings
- roster-role comparison
- legal/contract clearance
- family/school checks
- final selection

The player should have time to reconsider rather than selecting immediately after the showcase.

### 2017-04-29 — Final Selection / Project Announcement

Use the real milestone: 13 provisional successful candidates and =LOVE project announcement.

Game roster may differ from history.

Target roster: about 13
Recommended range: about 11–14

Historical roster is not a correct-answer key.

### May — Formation Phase

- formal member onboarding
- basic training
- role observation
- early center/leader consideration
- first formal work preparation
- direct interaction continues

### June — Delegation Phase

Sashihara's election/media schedule is heavy.

Main lesson:

> The producer cannot personally supervise everything.

Staff carries more daily training and monitoring.

### July — TIF Preparation

Focus:

- original song preparation
- cover repertoire familiarity
- center/formation
- MC
- costume/profile
- condition/rest
- final rehearsals

### 2017-08-05 — TIF Live Debut

Use the real 5-song setlist:

1. 言い訳Maybe
2. メロンジュース
3. ガールズルール
4. 大声ダイヤモンド
5. =LOVE

This is the second major Highlight live after the Sashihara tutorial and the emotional payoff of the trial.

---

## 18. Live Result / Staff Report

Live presentation itself should not show precise scoring.

After the live, staff produces an imperfect report.

Possible report sections:

- vocal stability
- dance/formation execution
- fatigue/condition issues
- individual standouts
- visible mistakes
- MC notes
- staff disagreement
- rough audience/media impression

Use natural language, ranges or coarse descriptors, not fake precision.

Example structure:

- Vocal staff: overall stable, breathing dropped late in the set
- Dance staff: one transition was messy, but group cohesion was acceptable
- Manager: visible nervousness, no major failure

The player may disagree with the report.

---

## 19. Post-Debut Agency Management Meeting

Do not show a gamey “Demo Complete — Score 82” screen.

A few days after TIF, hold a fixed Agency Management Meeting.

Review:

- audition outcome
- roster structure
- staff operation
- training progress
- budget
- TIF debut
- public/media response
- member concerns
- weak areas

Then assign next objectives, such as:

- 9/6 commercial debut
- improve live stability
- establish member roles
- build early fanbase
- complete first-release promotion

If full S3 exists, continue directly.

If not, this is the natural stopping point for the Featured Trial.

---

## 20. Historical / Conditional Events

Historical events are conditional, not forced.

Example: 長南舞-style eligibility crisis.

If selected:

- contract/eligibility issue may trigger
- agency/legal negotiation occurs
- outcome may differ from reality
- possible removal or reserve replacement

If not selected, the event does not occur.

Historical future is used as:

- soft prior
- event source
- calibration

Never as deterministic enforcement.

---

## 21. Recommended Hard Calendar Anchors

Use confirmed physical events where possible. Treat unknown TV recording dates as abstract media blocks rather than falsely equating broadcast dates with recording dates.

Key anchors currently planned:

### April
- 4/3 trial start
- 4/7 HKT live — first live tutorial
- 4/10 Camp Week 1 start
- 4/14 HKT live
- 4/15 AKB photo event
- 4/16 HKT handshake + first-cut/review day
- 4/17 Camp Week 2 start
- 4/22 final showcase + AKB event conflict
- 4/23 AKB event
- 4/29 final selection / =LOVE announcement

### May
- 5/6 HKT event + real condition incident
- 5/13–14 AKB events
- 5/28 HKT nationwide handshake
- 5/30 election campaign start

### June
- 6/15 public member profile milestone
- 6/17 general election major event
- 6/24–25 AKB events

### July
- 7/8 HKT event
- 7/14 official profile photo milestone
- 7/16–17 AKB events
- 7/18 TIF appearance publicly announced
- 7/23 yukata event
- late July final TIF preparation

### August
- 8/5 TIF live debut
- same-day public recording / launch activity
- major debut announcement

---

## 22. What v1 Does Not Need

Do not block implementation on:

- complete 2017 idol-industry AI simulation
- full scouting market
- full song-production system
- full agency politics
- full media-industry simulation
- full staff hiring market
- exhaustive historical TV schedule reconstruction

The Featured Trial is a vertical slice focused on selection, training, time, knowledge, staff dependence and debut.

---

## 23. One-line Positioning

**=LOVE — The Audition, 2017**

> As active idol and producer 指原莉乃, choose a new group from a 103-person final audition pool, manage limited time and imperfect information, train your chosen members, and bring them to their first public stage at TIF.
