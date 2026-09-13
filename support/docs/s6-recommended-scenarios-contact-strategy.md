# Scenario 6 Recommended Groups: Producer Problems and Fan-Contact Strategy

## Purpose

Scenario 6 starts on **2025-07-05**. The recommended-group list should not be a simple ranking of famous or strong groups. Each recommendation should expose a different producer problem and teach a different part of the simulation.

This document defines four core recommended S6 experiences discussed during research:

- `=LOVE` — momentum / harvest;
- `iLiFE!` — breakout / scaling;
- `高嶺のなでしこ` — awareness-to-core conversion;
- `アキシブproject` — decline / turnaround.

The goal is for players to experience four different management jobs rather than four versions of the same growth curve.

This document extends `support/docs/fan-layer-system-design.md`. That document defines the audience funnel. This document focuses on **how contact strategy changes conversion**, and how those mechanics create scenario-specific gameplay.

---

## Design Principle: Recommended Groups Should Pose Different Questions

A recommended group should answer:

> "What is the producer being asked to solve here?"

The four scenarios should feel fundamentally different.

| Group | Scenario type | Difficulty intent | Main producer question |
|---|---|---:|---|
| `=LOVE` | Momentum / mature growth | Easy | Can you preserve and compound a system that is already working? |
| `iLiFE!` | Breakout / scaling | Medium | Can the organization keep up with rapidly increasing demand? |
| `高嶺のなでしこ` | Conversion | Medium-Hard | Can you turn huge awareness into member-specific core fandom? |
| `アキシブproject` | Turnaround | Hard | Can you stop decline, restore product momentum, and avoid relegation? |

Difficulty here is not just financial survival. A strong group can still have a difficult strategic problem, while a mature group can intentionally function as an easier learning scenario.

---

# 1. =LOVE — Momentum / Harvest Scenario

## Scenario fantasy

The player takes over a mature idol system just as accumulated advantages are beginning to compound.

This is the closest S6 has to a **successful-team / title-contender start** in Football Manager terms. The player is not expected to repair a broken funnel. The reward is being allowed to experience what healthy growth feels like.

### Starting strengths

- strong group identity;
- mature catalogue;
- strong member-specific fandom;
- established individual-sales/contact infrastructure;
- strong release buying power;
- growing public awareness;
- strong live demand;
- management processes that already fit the group.

### Main risks

The player can still damage the system through bad growth management:

- overworking key members;
- expanding venues too aggressively;
- concentrating opportunities too narrowly;
- mishandling center/media expectations;
- reducing individual fan access too quickly;
- allowing release quality to decline;
- failing to convert growth into durable group assets.

### Player experience

The player should receive frequent positive feedback early:

- releases outperform expectations;
- live demand rises;
- media opportunities improve;
- individual member demand grows;
- larger venues become feasible.

This is intentionally the easiest recommended scenario. It teaches the player what a functioning idol organization looks like before asking them to repair weaker systems.

### Design label

`Momentum / Harvest`

Suggested difficulty display: `★★`

---

# 2. iLiFE! — Breakout / Scaling Scenario

## Scenario fantasy

The group has already found product-market fit. The producer's job is no longer to discover what the group is. The problem is to **catch the explosion without breaking the organization**.

### Core strengths

- unusually clear product identity;
- strong participatory live culture;
- signature catalogue;
- strong crowd protocol familiarity;
- strong member appeal;
- strong live-to-core conversion;
- HEROINES ecosystem support;
- growing agency-level scene power.

### Main producer problem

Growth creates organizational pressure faster than creative pressure.

The player must scale:

- venue capacity;
- ticketing;
- tokuten operations;
- merchandise logistics;
- staff capacity;
- member workload management;
- media handling;
- release pipeline;
- crowd-culture continuity despite many newcomers.

### Failure modes

A breakout can be wasted even when popularity remains high:

- sold-out events with poor operations;
- excessively long tokuten queues;
- member exhaustion;
- weak follow-up releases;
- crowd culture becoming inaccessible to newcomers;
- growth outrunning staff capacity;
- roster shock during rapid expansion.

### Design label

`Breakout / Scaling`

Suggested difficulty display: `★★★`

---

# 3. 高嶺のなでしこ — Awareness-to-Core Conversion Scenario

## Scenario fantasy

This group does not primarily suffer from lack of awareness.

The producer inherits a group with substantial public/SNS/song recognition, strong visual branding and major-market positioning, but a weaker path from:

```text
"I know this group/song"
        ↓
"I went to see them"
        ↓
"I have a specific oshi"
        ↓
"I repeatedly spend and return for that member"
```

The player's job is to repair the middle of that funnel.

## Important distinction: contact frequency is not enough

Research initially risked describing the group as simply "low contact." That is too crude.

高嶺のなでしこ has used:

- online 1:1 talk;
- scheduled individual handshake/talk events;
- release-event interaction;
- fan meetings;
- later individual shooting/video opportunities.

The more important weakness is historically lower **contact-live coupling**.

A fan can leave a concert highly interested in a member but have no immediate low-friction path to meet that member while the emotional response is still fresh.

### User observation to preserve as calibration evidence

`[USER OBSERVATION]`

In September 2025, after attending the 高嶺のなでしこ 3rd-anniversary live, the observer had no immediate way to approach or interact closely with a member after the concert. The next relevant opportunity was at least about a week later.

`[USER OBSERVATION]`

In 2026, the 4th-anniversary period was followed much more closely by a fan-meeting/contact opportunity, including close-range video interaction. This suggests the operating model may already be reducing conversion latency.

These observations should not be treated as universal claims about every event. They are valuable examples of the difference between **scheduled contact** and **event-coupled conversion**.

---

## The player-facing strategic branch

This group should allow a meaningful historical divergence:

### Route A — Preserve aspirational distance

```text
Major-style concert
→ scheduled release/fan events
→ online individual contact
→ slower member conversion
```

Benefits:

- lower immediate member workload;
- cleaner separation between concert and sales event;
- easier large-event logistics;
- preserves current brand expectations;
- scalable once the fandom is already mature.

Costs:

- longer conversion latency;
- more casual fans leave before choosing an oshi;
- public awareness may continue to exceed core-fan strength;
- weaker immediate monetization from live attendance.

### Route B — Hybrid high-touch conversion

```text
Concert / festival
→ same-day or next-day member contact
→ 2shot / short video / talk
→ member attachment
→ repeat attendance / goods / release buying
```

This is one of the main intended S6 experiments.

The player can choose to make 高嶺のなでしこ more aggressive about fan conversion without necessarily turning every appearance into a small-idol tokutenkai.

Possible actions:

- post-live individual talk;
- same-day 2shot;
- next-day fan meeting after major concerts;
- newcomer first-contact ticket;
- first-time discounted 2shot/video;
- tour-city individual contact day;
- event-coupled video shooting;
- higher-frequency scheduled individual events;
- member-specific SNS follow-up campaigns.

The strongest experimental choice is to adopt a genuinely underground-style pattern for selected events.

---

## Why "open tokutenkai" is not a free buff

The simulation should not implement:

```text
Tokutenkai = Core Fans +10
```

Instead contact produces both conversion benefits and operational costs.

### Benefits

- `otaku -> core` conversion increases;
- member-specific fandom forms faster;
- post-live emotional peaks are captured;
- repeat attendance increases;
- cheki/video/signing creates persistent fan artifacts;
- member goods and release demand can rise;
- weak group-level awareness can become durable member loyalty.

### Costs

- member time is finite;
- physical and emotional workload rises;
- revenue becomes more member-dependent;
- graduation shock can increase;
- high-spending fans can dominate relationship depth;
- the group can become dependent on tokuten revenue;
- large events eventually require separate/industrialized contact days;
- some audience/product identities may have lower compatibility with high-touch interaction.

The correct gameplay question is therefore:

> "How much contact, in what form, and at what point in the fan journey?"

not:

> "Do we allow contact: yes/no?"

### Design label

`Conversion`

Suggested difficulty display: `★★★★`

---

# 4. アキシブproject — Decline / Turnaround Scenario

## Scenario fantasy

The player takes over a veteran group whose historical brand and current organizational infrastructure are stronger than its current momentum.

The challenge is to stop a visible decline rather than build from zero.

### Historical S6 context

Scenario 6 begins **2025-07-05**.

Around this period the group had already started sliding in HEROINES League performance after being near the upper portion of the ranking earlier in 2025. The later real-world trajectory ended in relegation.

A key research hypothesis is that lack of fresh musical/product momentum contributed to the decline. The group went through an extended period without a new song.

The player should therefore have credible ways to alter history.

## Primary interventions

### 1. Release a new song

This should be one of the most straightforward historical divergences.

A good new song can improve:

- current fan heat;
- live freshness;
- SNS content supply;
- festival conversion;
- repeat attendance;
- member motivation;
- league mobilization indirectly.

A new song should not directly grant league votes. It changes the underlying fan state that later produces mobilization.

### 2. Rebuild live-product momentum

Possible actions:

- stronger setlist rotation;
- improve signature-song density;
- better event selection;
- self-hosted small festivals;
- more attractive pricing structure;
- stronger newcomer conversion;
- better member-specific hooks.

### 3. Improve fan mobilization

HEROINES League should not be simulated as "who performed best on that exact day."

Real-world on-site voting is heavily influenced by pre-existing support and fan mobilization because voting occurs at entry. Players should therefore affect league outcomes through:

- active fanbase size;
- core-fan mobilization;
- event promotion;
- ticket purchasing intent;
- current group heat;
- member fan power;
- recent releases and story momentum.

Same-day performance can affect retention, satisfaction and future votes, but should have only limited direct influence on an entry-time vote already cast.

### Design label

`Turnaround`

Suggested difficulty display: `★★★★★`

---

# Fan Contact as a Simulation System

## Replace one-dimensional contact intensity

Do not represent fan contact with a single `contact_intensity` value.

Recommended dimensions:

```ts
interface FanContactStrategy {
  frequency: number;              // opportunities per month / normalized 0-100
  live_coupling: number;          // how often contact immediately follows live discovery
  member_specificity: number;     // ability to choose a specific member
  physical_proximity: number;     // online -> talk -> handshake -> 2shot/video
  conversion_latency: number;     // lower is better for discovery conversion
  purchase_friction: number;      // registration, lottery, preorder, scheduling friction
  artifact_value: number;         // persistent value: cheki, signed item, video, etc.
  repeatability: number;          // ability to loop/repeat purchase
  capacity: number;               // fans processed per member/event
  scalability: number;            // sustainability as group demand grows
  brand_compatibility: number;    // fit with product identity and audience expectation
}
```

The exact data shape can change during implementation, but the dimensions should remain conceptually separate.

---

## Contact functions at different funnel stages

Different contact formats are not substitutes for one another.

| Contact type | Main funnel function |
|---|---|
| Post-live individual tokuten | Discovery -> first member attachment |
| Scheduled individual talk/handshake | Existing member fan -> stronger relationship |
| Online talk/signing | Retention, geographic reach, repeat monetization |
| 2shot / short video | Conversion + high artifact value |
| Lottery/premium M&G | Scarcity, prestige, premium monetization |
| Fan meeting near major live | Captures major-live emotional peak without requiring every concert to become a tokuten event |

This distinction is important for 高嶺のなでしこ. A group can have substantial scheduled 1:1 contact while still losing many fans at the **discovery -> member** stage if conversion latency is high.

---

## Conversion latency

Add a hidden or diagnostic concept:

`conversion_latency`

Meaning:

> Time between a fan first becoming interested in a member and the first realistic opportunity for member-specific paid interaction.

Same-day contact has much stronger discovery-conversion value than an equivalent one-minute interaction weeks later.

A simple internal concept:

```text
member_conversion
≈ interest
× access
× temporal_proximity
× member_specificity
× low_friction
× interaction_quality
```

This does not need to be exposed as a literal formula to the player.

---

## Contact-live coupling

`live_coupling` should be distinct from `frequency`.

Examples:

### Underground high-coupling model

```text
Live
→ immediate member queue
→ cheki/talk
```

High:

- conversion efficiency;
- member attachment;
- artifact value.

Low:

- scalability;
- member free time.

### Scheduled-intimacy major model

```text
Concert
→ later dedicated individual-sales day
```

High:

- operational scalability;
- repeat monetization of existing core fans.

Lower:

- spontaneous conversion from first-time live attendance.

### Hybrid model

```text
Major concert
→ next-day fan meeting / individual shooting
```

This can preserve major-event logistics while capturing much of the emotional peak.

---

# Tokuten Trap

High-touch economics should have a possible long-term failure state.

If revenue becomes too dependent on repeated member contact:

```text
core fans keep spending
        ↓
revenue appears healthy
        ↓
less pressure to improve songs/product
        ↓
casual acquisition weakens
        ↓
fanbase becomes increasingly core-heavy
        ↓
management becomes even more dependent on tokuten revenue
```

Possible game metrics:

- `tokuten_revenue_share`;
- `member_revenue_concentration`;
- `whale_concentration`;
- `new_fan_conversion_rate`;
- `catalogue_momentum`;
- `group_product_strength`.

The player should be able to run a profitable small idol group for years through high-touch relationships, but that should not automatically produce tier growth.

---

# Member Dependence and Graduation Risk

High contact tends to move fan equity from the group toward individual members.

Potential hidden variables:

```ts
interface MemberFanEquity {
  group_first_share: number;
  member_first_share: number;
  relationship_depth: number;
  portable_fan_equity: number;
}
```

Higher `member_first_share` and `portable_fan_equity` should increase the number of fans who leave with a graduating member.

This creates a real trade-off:

```text
High-touch contact
→ faster core conversion
→ stronger member monetization
→ higher member-specific dependency
→ potentially larger graduation shock
```

Group-product-heavy acts with strong catalogue/crowd culture can offset this effect.

---

# Scaling Contact Instead of Removing It

The game should permit contact systems to evolve as a group grows.

A useful progression pattern:

```text
Small group
post-live tokuten
        ↓
Growing group
selected post-live tokuten + scheduled event days
        ↓
Large group
large dedicated contact days + online systems
        ↓
Arena-scale group
concert separated from industrialized high-capacity contact events
```

This is preferable to a binary rule that major groups must abandon contact.

The key strategic distinction is:

> retain the **fan relationship strategy**, while replacing small-idol logistics when they stop scaling.

FRUITS ZIPPER is an important calibration example for this design principle: early high-coupling contact can coexist with later mainstream growth if contact infrastructure scales with demand.

---

# Brand-Contact Compatibility

Do not apply a universal mainstream-image penalty to tokutenkai.

The effect should depend on product identity and audience expectations.

Conceptual examples:

| Product identity | Typical high-touch compatibility |
|---|---|
| Participatory / festival idol | Very high |
| Relationship-focused live idol | Very high |
| Personality-led kawaii/pop idol | High |
| Traditional idol fandom | High |
| Aspirational royal-road idol | Medium / depends on format |
| Distance/prestige model | Lower |
| Premium scarcity model | Lower for open access, high for lottery access |

Therefore:

```text
brand_effect(contact)
=
contact_style
× product_identity
× audience_expectation
× existing_fan_culture
```

Do not implement `tokutenkai -> mainstream image penalty` as a constant.

---

# Recommended S6 Teaching Order

For a first-time player who wants to experience the recommended groups in increasing strategic difficulty:

```text
=LOVE
  ↓
iLiFE!
  ↓
高嶺のなでしこ
  ↓
アキシブproject
```

### =LOVE
Learn the normal systems while enjoying momentum.

### iLiFE!
Learn capacity planning and scaling.

### 高嶺のなでしこ
Learn funnel diagnosis and strategic operating-model changes.

### アキシブproject
Combine releases, fan mobilization, roster management and product rebuilding to alter a declining historical trajectory.

---

# Player-Facing Scenario Hooks

Suggested short recommendation text:

### =LOVE — Momentum

> The foundations are already strong. Ride the wave, protect the members, and see how far a mature idol system can grow.

### iLiFE! — Breakout

> The product has caught fire. Your challenge is no longer getting noticed — it is keeping the organization from falling behind the audience.

### 高嶺のなでしこ — Conversion

> Millions can know the song without becoming someone's fan. Build the missing bridge from awareness to oshi.

### アキシブproject — Turnaround

> A veteran group is losing momentum. Refresh the product, rebuild fan energy, and change the history that leads toward relegation.

---

# Implementation Priorities

## P0 — Required for scenario identity

1. Separate `public`, `otaku`, and `core` audience movement.
2. Track member-specific attachment separately from group awareness.
3. Add contact policies/actions with at least:
   - frequency;
   - live coupling;
   - conversion latency;
   - member specificity;
   - workload;
   - capacity.
4. Allow 高嶺のなでしこ to choose more aggressive post-live / adjacent-day contact strategies.
5. Make new-song/product momentum materially useful to アキシブproject.
6. Do not let same-day HEROINES League performance overwrite pre-existing mobilization.

## P1 — Strongly recommended

1. Artifact value for cheki/video/signing.
2. Member-specific fan equity and graduation migration.
3. Tokuten revenue concentration and Tokuten Trap.
4. Contact infrastructure scaling by group size.
5. Brand-contact compatibility.

## P2 — Later depth

1. Whale concentration and relationship competition.
2. Different member social-energy/tokuten aptitude.
3. Fan demographic differences in contact preference.
4. Queue/capacity simulation for very large events.
5. Contact-event staff and venue infrastructure.

---

# Non-Goals

- Do not make tokutenkai universally optimal.
- Do not make major status automatically reduce contact.
- Do not equate physical-CD sales with total fan monetization.
- Do not equate group awareness with member-core strength.
- Do not assume all 1:1 contact has the same conversion effect.
- Do not turn HEROINES League into a same-day performance contest if voting occurs before performances.
- Do not hard-code one operating model for all agencies or all major idols.

---

## Summary

Scenario 6 should present four different producer fantasies:

```text
=LOVE           : preserve and compound success
iLiFE!           : scale a breakout
高嶺のなでしこ   : repair awareness-to-member conversion
アキシブproject : reverse decline
```

The central system connecting these cases is the fan funnel. High-touch contact is not merely a revenue modifier. Its timing, format, friction, capacity and brand fit determine **which stage of the funnel it can actually repair**.

For 高嶺のなでしこ in particular, one of the most interesting player choices is deliberately using underground-idol conversion techniques inside a major-style brand — then dealing with the workload, scalability and member-dependence consequences if it succeeds.
