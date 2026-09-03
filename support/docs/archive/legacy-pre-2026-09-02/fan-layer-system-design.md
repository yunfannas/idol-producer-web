# Fan Layer System Design

## Purpose

The current game has group fan counts and member fan counts, but idol management needs a richer fan model. Fans are not only a population number. They are a conversion system, a revenue base, a source of trust or backlash, and a group of people attached to specific members.

This design separates:

- public awareness;
- casual interest;
- live attendance;
- repeat attendance;
- member-specific attachment;
- spending behavior;
- fan trust;
- fan migration after graduation or transfer.

The player should not directly control "core fan conversion." The player chooses concrete actions and policies. Fan movement emerges from those choices.

## Primary Fan Layers: Public / Otaku / Core

For gameplay, the main fan layer system should be simple:

```text
Public -> Otaku -> Core
```

These are not just popularity levels. They represent different audiences with different acquisition channels, spending patterns and reactions to policy.

| Layer | Meaning | What they care about | Main conversion path |
|---|---|---|---|
| `public_layer` | Broad public recognition: people who know the group, song, member, meme, TV appearance or brand. | Songs, visuals, media image, trendiness, celebrity value. | Media/content exposure -> casual following or first attendance. |
| `otaku_layer` | Idol-interested audience: people who attend festivals/taiban, compare groups, follow scene news, and can become repeat attendees. | Live quality, scene reputation, event access, member charm, social proof. | Idol-scene exposure -> repeat attendance -> member attachment. |
| `core_layer` | Deep supporters: oshi-attached fans, high-repeat attendees, benefit/release/goods/fanclub spenders. | Member relationship, trust, access, birthday/special events, management treatment. | Fan-contact and trust -> member-specific spending and loyalty. |

This should be the main simulation layer shown to the player.

Example:

```ts
interface GroupAudienceState {
  group_uid: string;
  public_fans: number;
  otaku_fans: number;
  core_fans: number;
  public_trust: number; // 0-100
  otaku_trust: number; // 0-100
  core_trust: number; // 0-100
  public_heat: number; // short-term trend / buzz
  otaku_heat: number; // scene momentum
  core_heat: number; // current spending/emotional intensity
}
```

Optional member-level split:

```ts
interface MemberAudienceState {
  idol_uid: string;
  group_uid: string;
  core_fans: number;
  otaku_attention: number;
  public_recognition: number;
  benefit_demand: number;
  benefit_utilization: number;
  oshi_loyalty: number;
}
```

## Layer Differences

### Public Layer

Public fans are broad and shallow.

They are gained through:

- viral songs;
- TikTok/YouTube/short video;
- TV and media;
- famous producers/IP;
- magazine/model/acting work;
- major concerts;
- public scandals, positively or negatively.

They do not automatically spend.

Good public strategy:

- high-quality songs/MVs;
- strong visuals;
- easy entry points;
- brand-safe media;
- clear route from awareness to next action.

Weakness:

- high decay if not followed up;
- can know the song but not the members;
- can be large while the business is still weak.

Best examples:

- `Nogizaka46`: huge public layer.
- `=LOVE`: strong public/IP and release-linked layer.
- `Takamine no Nadeshiko`: high public/content recognition relative to core conversion.

### Otaku Layer

Otaku fans are the idol-scene audience.

They are gained through:

- taiban/package lives;
- festivals;
- scene reputation;
- comparisons with other groups;
- live performance quality;
- word of mouth from core fans;
- accessible schedules and venues.

They may attend and test the group before choosing an oshi.

Good otaku strategy:

- frequent enough live appearances;
- strong setlists and MC;
- good event placement;
- visible momentum;
- member-specific hooks;
- clear benefit or release-event access.

Weakness:

- they compare many groups;
- they churn if the group feels stagnant;
- they may attend once without becoming core.

Best examples:

- `iLiFE!`: very strong otaku-to-core conversion through high-frequency lives and tokutenkai.
- `Jams Collection`: strong otaku/core direct economy.
- `Akishibu project`: needs otaku-layer recovery and repeat attendance.

### Core Layer

Core fans are the deep support base.

They are gained through:

- post-live tokutenkai;
- online talk/signing;
- shooting/handshake/release events;
- birthday events;
- fanclub content;
- documentary/member story;
- repeated live attendance;
- trust in management.

They generate:

- repeat attendance;
- benefit/release/goods spending;
- birthday event revenue;
- social proof;
- member-specific stability.

Good core strategy:

- reliable access;
- fair member exposure;
- trust-preserving graduation handling;
- member birthday/special events;
- good merch operations;
- visible member growth.

Weakness:

- core fans are sensitive to member treatment;
- graduation removes portable fan equity;
- overwork and absences can hurt trust;
- bad scandal handling can cause backlash.

Best examples:

- `iLiFE!`: core monetization through tokutenkai.
- `=LOVE`: core monetization through release/online signing and stable member attachment.
- `Akishibu project`: core fan equity has weakened after member departures and must be rebuilt.

## Demographic Segments

Public / Otaku / Core should be the main engagement-depth model. Gender and age should be a second axis: audience composition inside each layer.

Recommended segments:

```text
gender: male / female / mixed-unknown
age: youth / young_adult / middle_plus
```

Practical game shape:

```ts
type AudienceLayerKey = "public" | "otaku" | "core";
type AudienceGenderKey = "male" | "female" | "unknown";
type AudienceAgeKey = "youth" | "young_adult" | "middle_plus";

interface AudienceSegmentState {
  layer: AudienceLayerKey;
  gender: AudienceGenderKey;
  age: AudienceAgeKey;
  count: number;
  trust: number; // 0-100
  heat: number; // 0-100
  price_tolerance: number; // 0-100
}
```

Simpler first implementation:

```ts
interface GroupAudienceState {
  group_uid: string;
  public_fans: number;
  otaku_fans: number;
  core_fans: number;
  gender_share: { male: number; female: number; unknown: number };
  age_share: { youth: number; young_adult: number; middle_plus: number };
  public_trust: number;
  otaku_trust: number;
  core_trust: number;
}
```

The detailed segment table is more powerful, but the simpler share model is easier to balance first.

## Segment Meaning

### Gender

`male`

- Often stronger in traditional underground tokutenkai/cheki spending.
- May respond strongly to member-specific access, birthday events and oshi relationship.
- Can be sensitive to benefit queue fairness and scandal/member-treatment issues.

`female`

- Often important for fashion, visuals, aspiration, TikTok, pair/group identity and mainstream legitimacy.
- Can strengthen public image and social-media spread.
- May respond better to styling, choreography, member personality content, women-friendly venues/events and merch design.

`unknown`

- Use for broad public awareness where composition is not yet known.
- Can be gradually resolved into male/female as fans move from public into otaku/core.

### Age

`youth`

- Students and younger fans.
- Strong for trends, TikTok, school/peer spread, low-price entry and visual identity.
- Lower spending power, higher social-media amplification.
- Sensitive to accessibility and pricing.

`young_adult`

- Strong event attendance and balanced spending.
- Often the most flexible segment for live attendance, goods and online access.
- Useful bridge from public/otaku to core.

`middle_plus`

- Higher spending power and stable support potential.
- Strong for expensive releases, premium tickets, birthday events and repeated purchases.
- More sensitive to scheduling convenience, trust, and management reliability.

## Segment Effects By Action

| Action / Policy | Segment effect |
|---|---|
| TikTok / short-video push | Strong youth/public and female/public effect if styling/content fits. |
| Fashion/model work | Female/public and young-adult/public growth. |
| TV/general media | Public growth across unknown/mixed segments; age depends on program. |
| Taiban/package lives | Otaku growth, often young-adult/male leaning unless venue/event is women-friendly. |
| Post-live tokutenkai | Core growth and spending, often male/core and middle-plus/core leaning. |
| Online signing/talk | Core and spender growth across wider geography; can reach young adult and middle-plus efficiently. |
| Shooting/handshake/release events | Core growth, strong spending, high physical/logistics load. |
| Birthday events | Core heat and spending, especially middle-plus/core and high-loyalty oshi fans. |
| Cute/aspirational styling | Female/youth public growth and social spread. |
| Performance-heavy positioning | Otaku credibility and young-adult live conversion. |
| Lower-priced first-timer tickets | Youth/public -> otaku conversion. |
| Premium tickets/VIP | Middle-plus/core monetization. |
| Protected rest | Trust preservation across all segments; strongest among fans worried about member treatment. |

## Segment Fit Examples

These are review assumptions, not hard facts.

| Group | Likely useful segment emphasis |
|---|---|
| `Nogizaka46` | Broad public across gender/age, strong female/public and mainstream legitimacy, large release-event spender base. |
| `=LOVE` | Broad public plus strong core; online/release access can monetize geographically wide fans. |
| `iLiFE!` | Strong otaku/core, likely strong young-adult and male core spending; youth/public can grow through viral/member content. |
| `Takamine no Nadeshiko` | Strong youth/public and female/public potential through HoneyWorks/cute content; challenge is moving them into otaku/core. |
| `Akishibu project` | Veteran core likely older and spending-capable; challenge is new otaku/core acquisition. |
| `Jams Collection` | Otaku/core live economy with spending from direct fan relationship. |
| `Kirameki Unforent` | Reboot story can appeal to older/core and narrative-driven fans; needs trust stabilization. |

## Segment-Specific Meeting Signals

Fan survey should sometimes report segment reactions, not only total fan attitude.

Examples:

```text
Female public: +2
"Styling and short-video content are spreading well, but many still do not know the members' names."
```

```text
Middle-plus core: +3
"Premium birthday tickets should sell, but they expect reliable benefit operations."
```

```text
Youth public: -2
"Ticket price is too high for first-time conversion."
```

```text
Male core: -2
"Reducing tokutenkai access will hurt the current spending base."
```

This lets the player see that one policy can be good for one audience and bad for another.

## Public / Otaku / Core Conversion

The game should model three directional conversions:

```text
public -> otaku
otaku -> core
core -> public/otaku influence
```

### Public -> Otaku

This means a person who knows the song or member starts following idol activities or attends an event.

Driven by:

- easy live entry points;
- good media-to-event promotion;
- clear calendar;
- accessible pricing;
- strong first visual impression;
- viral content with group/member identity attached.

Takamine no Nadeshiko's main issue belongs here and in `otaku -> core`.

### Otaku -> Core

This means an idol-scene attendee becomes a repeat, oshi-attached supporter.

Driven by:

- benefit access appropriate to group model;
- strong member charm;
- birthday/member events;
- repeated good live experiences;
- fanclub/community;
- management trust.

iLiFE!, Jams and Akishibu depend heavily on this.

### Core -> Public / Otaku Influence

Core fans help create social proof.

Driven by:

- fan posts;
- attendance energy;
- word of mouth;
- sold-out events;
- visible queues;
- birthday event spectacle.

This should be modeled as amplification, not just spending.

## Relationship To Detailed Funnel

The detailed funnel below can still be useful internally:

```text
public_awareness
  -> casual_interest
  -> first_time_attendees
  -> repeat_attendees
  -> member_attached_fans
  -> spenders
  -> evangelists
```

But the player-facing model should be:

```text
Public / Otaku / Core
```

The detailed funnel can be treated as sub-metrics or hidden calculations under the three main layers.

## Core Fan Layers

Use layered fan pools at group level.

| Layer | Meaning | Typical source | Main loss risk |
|---|---|---|---|
| `public_awareness` | People who recognize the group, song, member or brand. | Viral songs, media, ads, major concerts, festival exposure. | Forgetting, weak follow-up, brand confusion. |
| `casual_interest` | People who may watch videos, follow clips, or notice announcements. | Awareness plus repeated exposure. | No clear next action, weak content cadence. |
| `first_time_attendees` | People who attend one live/event for the first time. | Package lives, festivals, viral-to-live campaigns, invites. | Poor live quality, inconvenient access, unclear benefit path. |
| `repeat_attendees` | Fans who attend repeatedly but may not be strongly member-attached. | Good live experience, event rhythm, social proof. | Boring setlists, poor scheduling, weak trust. |
| `member_attached_fans` | Fans with an oshi/member relationship. | Tokutenkai, online talk/signing, documentary/story, birthday events. | Graduation, scandal, low member visibility, weak fan handling. |
| `spenders` | Fans who buy tickets, goods, releases, benefits or fanclub access. | Member attachment plus available products/access. | Stock problems, price fatigue, trust damage. |
| `evangelists` | Fans who recruit others and create social proof. | High satisfaction, identity, pride, good treatment. | Management distrust, repeated disappointment. |

Important: a person can be in multiple pools conceptually, but for game implementation it is easier to model these as weighted counts or indices rather than literal individuals.

## Recommended Save Shape

Add a group-level fan funnel block. This can be stored under a future `group_fan_state` keyed by group UID.

```ts
interface GroupFanState {
  group_uid: string;
  public_awareness: number;
  casual_interest: number;
  first_time_attendees_30d: number;
  repeat_attendees: number;
  member_attached_fans: number;
  spenders: number;
  evangelists: number;
  trust: number; // 0-100
  price_tolerance: number; // 0-100
  event_satisfaction: number; // rolling 0-100
  conversion_health: number; // diagnostic 0-100
}
```

For member-specific fans:

```ts
interface MemberFanState {
  idol_uid: string;
  group_uid: string;
  attached_fans: number;
  benefit_demand: number;
  benefit_utilization: number; // 0-1+
  oshi_loyalty: number; // 0-100
  migration_likelihood: number; // 0-100 if she graduates/transfers
}
```

## Fan Movement

Fan movement should happen through concrete channels.

```text
public_awareness
  -> casual_interest
  -> first_time_attendees
  -> repeat_attendees
  -> member_attached_fans
  -> spenders
  -> evangelists
```

The funnel is not strictly linear. Major release campaigns can convert casuals directly into spenders. A birthday event can deepen existing member attachment. A scandal can reduce trust without immediately changing awareness.

## Action Effects

| Action / Policy | Primary fan movement |
|---|---|
| Viral MV / cover / TikTok push | awareness -> casual_interest |
| Media appearance | awareness and casual_interest |
| Package / taiban live | casual_interest -> first_time_attendees |
| Festival | awareness -> first_time_attendees |
| Routine self-produced live | repeat_attendees retention |
| One-man concert | repeat_attendees, trust, evangelists, prestige |
| Online signing / talk | casual_interest or release buyers -> member_attached_fans / spenders |
| Shooting / handshake release event | spenders -> member_attached_fans; casuals -> spenders |
| Post-live tokutenkai | first_time_attendees/repeat_attendees -> member_attached_fans / spenders |
| Birthday event | member_attached_fans -> spenders / evangelists |
| Fanclub content | repeat_attendees/member_attached_fans retention |
| Documentary/backstage content | casual_interest/repeat_attendees -> member_attached_fans |
| Goods drop | member_attached_fans/repeat_attendees -> spenders |
| Protected rest | trust stability and fewer absence-related trust losses |
| Poor merch availability | failed conversion from demand -> spending |
| Overbooking/fatigue | satisfaction and trust risk through absences/weak performance |

## Benefit Channel Differences

The fan system should distinguish benefit channels.

### Online Benefits

Examples: online signing, online talk, release-linked remote events.

Effects:

- high revenue per member-hour;
- good for major/IP systems;
- lower physical fatigue than long post-live sessions;
- converts release buyers and casual fans into member-attached fans;
- less effective at converting same-day live excitement.

Best fit:

- `=LOVE`
- `Nogizaka46`
- some `Takamine no Nadeshiko` conversion work

### Shooting / Handshake / Physical Release Events

Examples: akushu-style systems before COVID, group/individual shooting events, release-event physical access.

Effects:

- strong member attachment;
- high logistical load;
- can support physical release sales;
- tiring when scaled heavily;
- strongest where fans expect release-event access.

Best fit:

- `Nogizaka46`
- major/large systems using release-event structures
- selective conversion experiments for Takane-like groups

### Post-Live Tokutenkai

Examples: cheki, talk tickets, benefit sessions directly after lives.

Effects:

- strongest immediate conversion from live attendance to oshi attachment;
- central direct monetization engine for underground groups;
- limited by member queue capacity and session duration;
- high fatigue after performance;
- demand imbalance becomes visible member by member.

Best fit:

- `iLiFE!`
- `Akishibu project`
- `Jams Collection`
- `Kirameki Unforent`

Not default fit:

- `=LOVE`
- `Takamine no Nadeshiko`
- `Nogizaka46`

## Demand, Capacity, Utilization

Post-live and physical fan-contact channels need capacity modeling.

```text
available_member_minutes
slot_seconds
service_capacity = available_member_minutes * 60 / slot_seconds
benefit_demand = member_attached_fans * demand_rate + event_heat
utilization = demand / capacity
```

Interpretation:

- `0.30`: weak queue, idle time
- `0.60`: healthy but not full
- `0.85`: strong demand
- `1.00+`: demand exceeds capacity

This should feed:

- revenue;
- member fatigue;
- member morale;
- fan satisfaction;
- unmet demand.

Unmet demand is not always bad. It can signal popularity. But repeated unmet demand without alternative access can frustrate fans.

## Trust

Fan trust is separate from popularity.

Trust rises from:

- reliable schedules;
- good graduation handling;
- adequate rest/low absence chaos;
- honest communication;
- good event operations;
- visible production commitment;
- member growth and stable treatment.

Trust falls from:

- unexplained cancellations;
- chaotic benefit sessions;
- poor merch delivery;
- repeated illness absences;
- harsh or inconsistent scandal handling;
- mishandled graduations;
- overpromising venues or releases.

Trust modifies conversions:

```text
high trust -> better repeat attendance, better price tolerance, lower scandal damage
low trust -> weaker conversion, higher churn, stronger backlash
```

## Member Fan Equity

Each member needs portable fan equity.

When a member graduates or transfers:

```text
attached_fans split into:
  leave idol scene
  follow member
  stay with group
  become casual only
```

Suggested modifiers:

- high group trust -> more fans stay with group;
- high oshi loyalty -> more fans follow member;
- good farewell handling -> less total churn;
- strong replacement nurturing -> gradual transfer over months;
- scandal/termination -> trust loss and chaotic migration.

This is central for Akishibu-style rebuild scenarios.

## Group Archetype Calibration

| Group | Fan Layer Pattern |
|---|---|
| `=LOVE` | Strong awareness, strong member attachment, high online/release monetization efficiency, low post-live tokutenkai. |
| `Nogizaka46` | Massive awareness/IP, generation-based fan segmentation, release-event access, selection-sensitive fan trust. |
| `iLiFE!` | Strong live-to-tokutenkai conversion, high member-specific demand, high fatigue and absence sensitivity. |
| `Takamine no Nadeshiko` | High awareness and content reach, weaker conversion into repeat/member-attached/spender layers. |
| `Akishibu project` | Veteran residual trust/history, reduced demand pool, need to rebuild member-attached fans after graduations. |
| `Jams Collection` | Strong direct fan economy; live, birthday, merch and tokutenkai matter more than CD sales. |
| `Kirameki Unforent` | Reboot story can create emotional attention; trust and narrative coherence drive conversion. |

## Strategy Meeting Integration

The fan survey panel should read the current fan state and draft policy deltas.

Examples:

### iLiFE!, raising live frequency

```text
Fans: +2
"Fans want more chances to attend and meet members, but recent absences are starting to worry them."
```

### Takamine no Nadeshiko, adding post-live tokutenkai

```text
Fans: -1 / mixed
"Some core fans want more direct access, but a sudden underground-style post-live system may not fit current expectations."
```

### Takamine no Nadeshiko, adding online/release conversion

```text
Fans: +2
"Casual listeners need a clearer path from song recognition to member attachment."
```

### Akishibu, pushing new members

```text
Fans: -1
"Fans want to support the rebuild, but attachment to graduated veterans will not transfer automatically."
```

## UI Proposal

Add a `Fans` or `Audience` panel with:

- funnel bars;
- trust gauge;
- member benefit utilization table;
- recent conversion leaks;
- fan survey summary;
- oshi migration risk for graduation candidates.

Example diagnostic messages:

- `Awareness is high, but first-time attendance is not converting into repeat attendance.`
- `Member benefit demand is concentrated in two members; new-member queues are weak.`
- `Online signing demand is strong and more efficient than adding another live.`
- `Post-live tokutenkai demand exceeds capacity; unmet demand is starting to frustrate fans.`
- `Fan trust is falling because absences and schedule changes are becoming common.`

## Minimum First Implementation

Start with a lightweight version:

1. Add group fan state with `awareness`, `casual_interest`, `repeat_attendees`, `member_attached_fans`, `spenders`, `trust`.
2. Add member fan state with `attached_fans`, `benefit_demand`, `benefit_utilization`.
3. Update fan state after live reports and media/release events.
4. Show funnel and member utilization in a read-only panel.
5. Use the fan state in strategy meeting attitudes.

This gives the player a new strategic surface without requiring individual fan simulation.
