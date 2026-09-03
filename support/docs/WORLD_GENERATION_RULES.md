# World Generation Rules

**Status:** current design authority  
**Effective:** 2026-09-03  
**Primary scenario calibration:** Scenario 6, opening date `2025-07-05`

## 1. Authority and precedence

This document defines the current world-generation rules for new saves. It replaces legacy fan/reach/bootstrap assumptions in archived design notes.

Active design authorities, in precedence order:

1. scenario-specific curated data and dated historical facts;
2. this document (`WORLD_GENERATION_RULES.md`);
3. `GROUP_TIER_EVALUATION.md`;
4. `idol-producer-portable-system-spec.md`;
5. `reference/finance/tier_financial_anchors_s6.md`;
6. deterministic fallback generation when curated data is missing.

Files under `support/docs/archive/` are historical references only. **Do not use archived values as current balance inputs.** Operational database guides, generated reports and CSV review files may remain outside the archive, but they are not design authorities unless an active design document explicitly cites them.

---

## 2. Scenario time lock and world snapshot

A scenario represents the world at its opening date, not the current-day catalog.

For Scenario 6:

- opening date: `2025-07-05`;
- roster membership is determined from dated `group_history.start_date/end_date` active on that date;
- future joins, graduations, suspensions and other dated scenario events remain future events;
- the main living database must not overwrite the opening roster.

Pinned S6 roster canaries remain:

- `=LOVE`: 10 members;
- `iLiFE!`: 9 members;
- `高嶺のなでしこ`: 10 members;
- `アキシブproject`: 8 members.

At new game, generate the **entire world snapshot once**, not only the player's group. The save then owns a mutable copy of the world and all groups may evolve after opening.

---

## 3. Curated data first, procedural generation second

Use the following rule for every generated field:

```text
scenario/date-specific curated override
> persisted manual value
> researched group/member archetype
> tier-based deterministic fallback
> neutral fallback
```

Never overwrite a valid curated/manual value merely to make it fit a procedural formula.

Procedural generation must be deterministic from stable identifiers and scenario date so repeated starts with the same scenario do not randomly rewrite the historical world. Randomness may be used only where the game explicitly wants controlled variation and must use stable seeds.

---

## 4. Tier, recognition and paid fanbase are different concepts

`letter_tier` represents the group's **organizational and market scale**. It includes the scale of public recognition, media access, TV opportunities, advertising/endorsement value, venue reach and organizational capability.

The group fanbase used by the simulation is narrower: it represents people inside the group's **paying audience ecosystem**.

The three mutually exclusive group layers are:

- `Public`: light paying audience; may buy a ticket/CD/merch or pay for content occasionally, but does not actively follow every activity;
- `Otaku`: active idol fans who deliberately follow the group and repeatedly attend/consume;
- `Core`: deepest repeat supporters, high attachment and usually highest ARPU.

```text
total_group_fanbase = public + otaku + core
```

Important boundaries:

- `Public` is **not general awareness**.
- Mass recognition of Nogizaka46 or another S-tier group is represented primarily by tier/brand/recognition, not by adding every person who knows the name to `Public`.
- Member-specific personal recognition/public audience is separate from group fanbase and can be produced by TV, modeling, acting, singing, dance or other outside work.
- Do not count personal Public one-for-one inside the group pool.

Lower tiers should generally have a larger `Otaku + Core` share; upper tiers gain a much thicker paying-Public layer.

---

## 5. Main group fanbase anchors

Use these as central letter-tier anchors for a healthy representative group at S6 scale:

| Tier | Reality anchor / archetype | Public | Otaku | Core | Total |
|---|---|---:|---:|---:|---:|
| E | small part-time underground idol | 600 | 215 | 85 | **900** |
| D | Akishibu-style professional underground | 1,800 | 540 | 180 | **2,520** |
| C | Jams Collection, S6 start | 5,200 | 1,700 | 550 | **7,450** |
| B | NMB48 2025 major-side archetype | 13,000 | 4,000 | 1,300 | **18,300** |
| A | =LOVE 2025 | 39,000 | 8,500 | 2,500 | **50,000** |
| S | Nogizaka46 2025 | 190,000 | 40,000 | 10,000 | **240,000** |

These are calibration anchors, not mandatory values for every group in the tier. Group-specific researched values may deviate substantially when supported by live attendance, CD/release behavior, benefit demand, FC/merch scale or other evidence.

`+` / `-` grades should be interpolated around the central anchors rather than treated as unrelated tables.

F/I tiers are not yet fully recalibrated by the current model. Keep them conservative and clearly marked fallback until separately reviewed.

---

## 6. Fanbase must pass three independent sanity checks

Do not generate fanbase from a single proxy such as X followers, Spotify listeners, CD sales or one concert.

A tier/group fanbase estimate should be broadly consistent with all three of the following when data exists.

### 6.1 Large-live planning audience

For an ordinary healthy group's **large live planning audience anchor**:

```text
large_live_planning_attendance_anchor ~= 20% of total paying fanbase
```

This is a planning/calibration anchor, not the definition of a flagship.

Annual flagship / milestone events are different. Examples include Budokan challenges, the year's largest iLiFE! venue, major anniversary concerts, arena challenges and important graduation concerts. These deliberately concentrate dormant Public, old fans, travelers and special-event demand and can reach roughly `1.5-2.5x` the normal large-live planning anchor, sometimes more.

Do not infer the permanent fanbase by simply dividing a once-a-year exceptional flagship attendance by 20%.

### 6.2 Physical CD / release sales

CD sales may substantially exceed unique fanbase because of repeat buying and benefit-event attachment.

Expected pattern:

- lower/mid-tier direct-contact or release-event groups may have high copies per active buyer;
- NMB-type handshake systems can have especially high repeat multipliers;
- =LOVE can have strong release-event repeat buying;
- S-tier groups have much larger paying-Public layers, so average copies per unique paying fan can be lower even when total sales are huge.

Therefore **tier must not monotonically increase CD copies per fan**.

### 6.3 Benefit / tokutenkai capacity

For E/D/C and benefit-heavy B archetypes, generated `Otaku/Core`, member benefit demand, session duration, price, member count and utilization must jointly support observed/plausible session sales.

Member count is economically important because each member is also a parallel benefit-session sales lane. More members increase both fixed cost and possible direct-contact capacity.

If live, CD and benefit observations imply materially different fanbase sizes, mark the group for manual review rather than forcing one proxy to win automatically.

---

## 7. X followers and other public metrics are evidence, not fanbase

X followers, YouTube/TikTok views, Spotify listeners, search interest and other public metrics may be used as secondary signals for:

- recognition;
- relative member visibility;
- possible personal Public;
- missing-data ranking within a tier;
- identifying unusual outliers for manual review.

They must **not** directly define group paid fanbase.

The current legacy bootstrap functions in `src/save/gameSaveSchema.ts`:

- `estimatedGroupFanReach()`;
- `backfillGroupMemberFanCounts()`;

are **deprecated as design logic**. In particular, the old tier reach floors and the rule that divides group reach among members are not current design truth and should be replaced when the fan-layer bootstrap is implemented.

---

## 8. Member audience is not a partition of group audience

Do not split group `Public/Otaku/Core` into member `fan_count` shares.

A member has separate audience/equity concepts, for example:

- `personal_public_recognition` / personal paying-public potential;
- `otaku_attention`;
- member-attached `core_fans` / oshi equity;
- `benefit_demand`;
- `benefit_utilization`;
- `oshi_loyalty`;
- `migration_likelihood` on graduation/transfer.

A fan can be a group Public/Otaku/Core while also having a preferred member. Member oshi equity is therefore an attachment dimension over the group audience, not another mutually exclusive copy of the entire fan pool.

### Data collection priority

For world generation:

- C-tier and above members: prioritize researched personal fan equity, major outside-work traits and meaningful personal Public where evidence exists;
- D/E ordinary members: use lighter deterministic generation unless individually important or unusually visible;
- historically important outliers may always receive manual overrides regardless of tier.

This avoids requiring exhaustive manual research for thousands of low-tier members while preserving differentiation where it matters economically and narratively.

---

## 9. Idol attributes and traits

Persisted/manual attributes are authoritative. Missing values may be generated deterministically.

Current core ability scale remains `0-20` for physical, appearance, technical, mental and hidden idol attributes unless the active portable system spec explicitly supersedes a field.

Generation may use:

- researched role history;
- age/career stage;
- group tier and performance standard;
- group context;
- individual visibility signals;
- within-group relative evidence;
- stable UID-based variation.

Personal X followers should be a **secondary** signal. They must not make a viral low-tier member automatically receive top-tier singing/dancing ability.

Existing tier-based soft ceilings can remain as an implementation guard while recalibration is pending, but the important design rule is:

```text
manual assessment > role/evidence model > tier-constrained deterministic fallback
```

### Traits / outside-work capability

Use the active trait system in `idol-producer-portable-system-spec.md`. Singer, dancer, comedy, model and similar outside-work traits are separate from ordinary 0-20 stage attributes. Personal external work should be the main route to increasing personal Public/recognition.

Long-term high-tier lead singer / lead dancer duty may slowly accumulate corresponding professional traits when the active system allows it.

---

## 10. Songs and performance requirements at world generation

Scenario songs are time-locked to what is available by the opening date, with future releases retained as future content when modeled.

For songs missing curated performance requirements:

- normal professional-idol song baseline singing difficulty: `12`;
- normal professional-idol song baseline dancing difficulty: `12`;
- required sing-lead / dance-lead roles are song-specific;
- lead ability requirement defaults to the corresponding base difficulty `+2` where the current performance system uses that relation;
- formation remains a staging/immersion/exposure/familiarity object, but **has no independent formation-difficulty stat**.

Use the current S6 song enrichment guide for evidence collection and bulk assessment. Do not let an older archived performance document override that guide.

---

## 11. Group archetype and strategy seed

Tier is not a business model. Groups of the same tier may monetize and schedule very differently.

Examples:

- NMB-type B: theater + physical releases + handshake/online talk;
- iLiFE!-type B: high-frequency live + strong post-live benefit economy;
- ≠ME-type B: release-event + hall/arena touring;
- =LOVE-type A: release/online benefit + arena/IP model;
- Nogizaka-type S: mass release + arena/stadium + media/commercial ecosystem.

At world generation, a researched group should receive an archetype/strategy seed. Unresearched groups receive a tier-appropriate deterministic fallback, modified by known traits such as roster size, agency, release activity and event history.

The archetype determines **revenue mix and schedule behavior**, not the letter tier itself.

---

## 12. Schedule and venue bootstrap

The initial calendar should combine:

1. known official/curated future events already in the scenario database;
2. archetype/tier normal activity pattern;
3. member availability, condition and external load;
4. staff/agency capacity;
5. fan demand and financial feasibility.

Do not use one universal live frequency for all groups.

Large-live venue planning should use the paid-fanbase sanity check in §6.1. A milestone venue can deliberately exceed normal sustainable attendance and may be a strategic investment rather than a same-day profit maximizer.

---

## 13. Finance bootstrap

Use `support/docs/reference/finance/tier_financial_anchors_s6.md` as the current rough financial reference.

Current broad monthly operating ranges are intentionally approximate:

| Tier | Operating contribution | Operating cost | Rough surplus |
|---|---:|---:|---:|
| E | ¥3-3.5M | ¥2-3M | ¥0-1M |
| D | ¥7.5-9M | ¥6-8M | ¥1-2M |
| C | ¥12.5-15M | ¥8-10M | ¥4-6M |
| B | ¥30-40M | ¥22-32M | ¥6-12M |
| A | ¥65-85M | ¥35-55M | ¥25-40M |
| S | ¥230-320M | ¥150-220M | ¥60-100M |

These finance ranges are less mature than the fanbase anchors. Do not force a group's revenue to match the midpoint if its business archetype is materially different.

Major/release-event contact events that exist to sell CDs should normally be modeled as release fulfillment cost rather than counted again as fully independent benefit revenue.

---

## 14. Dynamics after opening

World generation creates the opening state; it must not bake short-term heat into permanent fan counts.

### Slow state

- Public/Otaku/Core fanbase;
- trust;
- member oshi equity;
- structural brand/tier capability.

### Fast state

- heat;
- attendance rate;
- spending rate;
- benefit utilization;
- current release/live demand.

Ordinary monthly fan acquisition and churn should generally each stay within roughly `5%` of the relevant fan pool. Healthy groups can have large gross movement that nearly cancels. A persistent small negative net flow over six to twelve months can still cause serious decline.

Major events may exceed ordinary monthly movement.

### Graduation

Graduation should be modeled in phases:

1. announcement can temporarily raise the departing member's demand;
2. final events may reach very high utilization;
3. departure removes part of member-attached oshi equity;
4. only a minority transfers to another member when box-oshi behavior is weak;
5. group attendance/spending can fall immediately before total group fanbase fully decays;
6. prolonged lack of songs/content then causes slower Public/Otaku/Core churn.

This distinction is required to reproduce cases such as an AKSB-style top-member departure causing an immediate benefit-sales cliff without pretending that every casual group fan vanished on the same date.

---

## 15. Implementation migration checklist

When replacing the legacy new-game bootstrap, use this order:

1. keep scenario date-lock / roster filtering unchanged;
2. attach static/manual `letter_tier` and group archetype;
3. initialize group `Public/Otaku/Core` from curated values or current tier anchors;
4. apply limited evidence-based group adjustments, cross-checked against live/CD/benefit observations;
5. initialize separate member audience/equity state; **do not divide group fanbase into member fan counts**;
6. apply persisted idol abilities/traits, then deterministic fallback for missing fields;
7. initialize songs available at opening and their requirements/familiarity;
8. initialize finance/staff/strategy from tier + archetype;
9. merge known future schedule/scenario events;
10. validate canary rosters and economic sanity checks;
11. only then create the mutable save-owned world snapshot.

### Required validation report

A world-generation test should report at least:

- group count and tier distribution;
- roster canaries;
- Public/Otaku/Core totals by tier;
- large-live planning attendance implied by fanbase;
- CD/release and benefit-demand sanity warnings for researched anchors;
- C+ member personal-audience/trait coverage;
- number of manual vs generated idol attribute blocks;
- any use of legacy fan backfill logic.

---

## 16. Current calibration anchors to protect

Until explicitly revised, protect these cross-system anchors:

```text
E  =    600 Public /   215 Otaku /    85 Core =     900
D  =  1,800 Public /   540 Otaku /   180 Core =   2,520
C  =  5,200 Public / 1,700 Otaku /   550 Core =   7,450
B  = 13,000 Public / 4,000 Otaku / 1,300 Core =  18,300
A  = 39,000 Public / 8,500 Otaku / 2,500 Core =  50,000
S  =190,000 Public /40,000 Otaku /10,000 Core = 240,000
```

These numbers should be changed only through a new calibration pass that checks **large-live attendance, CD/release sales and benefit-session demand together**.