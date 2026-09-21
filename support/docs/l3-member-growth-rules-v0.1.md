# L3 Member Growth Rules v0.1

Status: design baseline for `agent/l3-world-simulator`.

This document defines the member-growth abstraction used by the monthly L3 world
simulation. It is intentionally coarser than day-to-day reality: L3 samples
career growth at auditable historical events rather than simulating every
training session or ordinary joint live.

## 1. No personal ceiling

Member attributes use the game domain 0..20, but there is no hidden personal
potential ceiling and no soft-cap field.

High values are kept rare by:

1. increasing EXP cost from 16 upward;
2. limiting which monthly historical events generate attribute EXP;
3. assigning extra EXP according to actual team responsibilities;
4. requiring stronger career environment / breakthrough evidence for the highest
   levels.

Legacy `ceiling` fields are migration debt and must not control growth.

## 2. Newcomer / entry traits

Entry traits describe ability visible at or before entry. They modify opening
attributes only; they are not potential caps.

For skill families that support two levels:

- `good`: relevant opening attributes approximately +2.
- `excellent`: relevant opening attributes approximately +3.

Initial supported skill traits:

- `vocal_good`
- `vocal_excellent`
- `dance_good`
- `dance_excellent`
- `physical_good`
- `physical_excellent`
- `talk_good`
- `talk_excellent`

Appearance traits remain separate:

- `cute`
- `pretty`

Do not infer an entry trait solely from much later performance. L1/L2 must retain
dated evidence showing that the strength existed at entry or very early in the
career.

## 3. Performance assignments

Role language in sources is normalized to numeric assignment shares.

Core simulated performance assignments:

- `vocal`
- `dance`
- `mc`
- `aori`

Two normalization constraints apply:

### 3.1 Team normalization

For each role actually assigned by the team in that period:

```text
sum(member role share across active members) = 1.0
```

A role may remain assigned even when external conditions temporarily suppress its
gameplay effect. Assignment state and effect strength are separate:

```text
effective_role_share = assignment_share * role_effectiveness
```

If no member is assigned to a role, the team total may be 0. Do not invent an
assignment merely to satisfy normalization.

Examples:

- two equal vocal leads -> 0.5 + 0.5;
- main/sub vocal -> 0.7 + 0.3;
- three supported vocal members may normalize from raw weights such as
  1.0 / 1.0 / 0.5 into 0.4 / 0.4 / 0.2.

### 3.2 Member capacity

For one member:

```text
vocal + dance + mc + aori <= 1.0
```

This prevents one member from receiving multiple full role bonuses.

### 3.3 Center / ace semantics

Natural-language `center` and `ace` are ambiguous and must not be directly
treated as extra growth multipliers.

When the evidence means a performance center / all-round performance ace, the
default normalization is:

```text
vocal = 0.5
dance = 0.5
```

L2 may use a different split (for example 0.7/0.3) when evidence clearly shows a
vocal- or dance-heavy ace.

A formation center is positioning/exposure only and does not automatically grant
skill EXP.

## 4. Organizational and visual roles

These are recorded separately from the performance-capacity total:

- `captain`
- `visual_lead`
- `formation_center`

Effects:

- captain -> teamwork growth direction only; **no stage-presence bonus**.
- visual lead -> appearance/exposure effects, not vocal/dance skill EXP.
- formation center -> exposure/impression conversion, not an automatic ability
  bonus.

## 5. L3 EXP event abstraction

The monthly simulator does not attempt to replay routine training or every small
show.

Normal attribute EXP is sampled from:

1. qualifying large live events;
2. new physical CD releases.

Ignored as direct normal attribute-EXP sources:

- routine training;
- ordinary joint lives / small event volume;
- ordinary digital-only releases.

Streaming or digital performance may matter only when it crosses a documented
breakthrough milestone.

## 6. Event EXP = base + role bonus

Every member who actually participates in an eligible large live / physical CD
release receives the event base EXP.

```text
member_event_exp
  = base_event_exp
  + sum(role_bonus_pool * normalized_assignment_share)
```

The role bonus is an additional team-normalized pool. It does not replace base
EXP.

This ensures that members without a named responsibility still develop over a
long career, while clear vocal/dance/MC/aori responsibilities grow faster.

The same assignment multiplier must not be applied twice (for example once in EXP
generation and again at level-up).

## 7. Growth calibration

Target scale for ordinary D/C-level idol careers:

- ordinary newcomer, no clear assignment: growth is deliberately slow;
- after roughly three years in a D-level team, a pure ordinary newcomer without
  a clear role should usually be around 12-13 in the relevant broad V/D ability,
  not 13-14 across the board;
- a member with sustained vocal/dance responsibility should grow materially
  faster;
- after about six years, an ordinary long-running member may reach around 15 in
  some relevant attributes even without a formal role;
- after about six years of sustained clear responsibility, relevant mature
  attributes can stably reach about 16;
- a strong-entry member (`good`/`excellent`) who quickly becomes a main
  performer can reach 16-17 much earlier.

Levels 16+ use rising EXP costs. Levels 18+ should normally require repeated
high-quality opportunities, stronger team environment, and/or major documented
breakthroughs.

## 8. Career environment milestone buff queue

Career environment improvements grant one-time member-specific buff tokens.

General milestones:

### D- milestone

Full newcomer entry into D- or higher professional environment grants:

- 1 year x1.50
- 1 year x1.35
- 1 year x1.20

If the member already spent time in below-D- small-group activity before first
entering a D-level professional environment, use 66% of the bonus above 1.0:

- x1.33
- x1.23
- x1.13

approximately, using:

```text
effective = 1 + (full - 1) * 0.66
```

### C- milestone

First member exposure to a C- or higher team environment grants:

- 1 year x1.35
- 1 year x1.20

### A- milestone

A- is not automatic for every high-tier group.

Eligible performance-oriented groups receive:

- 1 year x1.20

Eligibility is maintained as an explicit reviewed group list
(`a_minus_growth_buff_eligible`) rather than inferred mechanically from tier.

Known design examples:

- =LOVE -> eligible
- ≠ME -> eligible
- Nogizaka46 -> not eligible
- Sakurazaka46 -> not eligible
- Hinatazaka46 -> not eligible

Other groups that have historically reached A- or above should be enumerated and
reviewed individually.

## 9. Buff queue ordering and downgrade semantics

Buff tokens do not stack multiplicatively in the same year.

The queue is automatically sorted by multiplier descending:

```text
1.50 > 1.35 > 1.20 > ...
```

The highest currently eligible token becomes the active buff. Equal multipliers
use earlier trigger order only for deterministic replay.

Example: a true newcomer directly entering C- or above exposes both D- and C-
tokens. While the team remains C- or above, priority order is:

```text
1.50 -> 1.35 -> 1.35 -> 1.20 -> 1.20
```

This creates up to a five-year accelerated window without multiplying D- and C-
buffs together.

### 9.1 Threshold buffs require the environment to remain valid

Pending tokens above the team's current tier are **not permanently banked**.

If the team drops below a milestone threshold:

- any not-yet-started tokens belonging to that lost threshold immediately become
  ineligible and disappear from the usable queue;
- a token that has already started remains active until its current one-year term
  finishes;
- finishing that active year does not preserve the rest of the lost-threshold
  queue.

Example: a member has begun a C- x1.35 year and the team falls to D+ halfway
through. The x1.35 continues to the end of that one-year term, but an unused C-
x1.20 token is removed unless the member later re-qualifies under the milestone
rules.

### 9.2 A higher-priority buff must not consume the buff it displaced

Only the **active** token consumes time.

If a higher multiplier wins the priority queue for a year, a lower eligible token
that would otherwise have been used that year remains unconsumed. Implementations
that advance all staged buffs by calendar year must explicitly restore / credit
back the displaced lower token.

For example, if a D- x1.20 token is pending and a C- x1.35 token becomes active:

```text
active this year: C- x1.35
D- x1.20: remains pending
```

The D- token is not lost merely because a stronger buff occupied that year.

This replacement rule is essential when a higher-tier environment later drops:
the member may lose unused C- tokens, while still retaining any lower-tier token
that was only postponed by the C- buff.

If an A- token becomes eligible while earlier higher tokens remain, it enters the
same priority system. It is usable only while the A- environment remains valid,
except that an already-started one-year A- token runs to completion.

## 10. Member-specific milestone exposure

Milestone eligibility belongs to the member, not permanently to the group name.

A member first becomes eligible for a threshold only if they are active while the
team is actually at or above that threshold.

Historical group achievement does not grant the buff to later members joining
after the team has fallen below the threshold.

Milestone history prevents farming, but eligibility is environment-dependent:

- crossing / entering a threshold exposes that threshold's token set;
- pending tokens require the team to remain at or above the threshold;
- downgrade removes unused tokens from the lost threshold;
- an already-active token is grandfathered only through the end of its one-year
  term;
- a lower-threshold token displaced by a stronger active buff stays pending and
  must not be accidentally consumed.

A leave/rejoin or tier down/up cycle must not create duplicate consumed years.
If a previously exposed threshold becomes valid again, replay logic must use the
member's token history to determine which threshold tokens were already consumed,
which were removed on downgrade, and which may legitimately become available
again. It must never grant more than the threshold's designed total entitlement.

## 11. AKSB calibration case

AKSB is a required calibration case for this rule.

Working historical tier model:

- before / around TIF 2019, AKSB reaches C- for the first time;
- members active during that C- environment expose their member-specific C-
  milestone tokens (x1.35, x1.20);
- the group later falls back to D+;
- when AKSB drops to D+, any unused C- token is no longer usable;
- if a C- token was already active when the downgrade happened, that one-year
  buff runs to completion;
- any lower D- token that was postponed because the C- token had higher priority
  remains pending / is credited back rather than being lost;
- 新居歩美 joining during the later D+ period does **not** inherit the historical
  2019 C- buff merely because AKSB once reached C-;
- if AKSB later genuinely returns to C-, member token history determines what
  C- entitlement remains possible; replay must not duplicate already-consumed
  C- years.

The careers of 福山, 藤木, Hiyo and similar earlier-generation AKSB members are
useful validation cases: time spent in the stronger C- environment, including any
C- buff year actually started before downgrade, plus their responsibilities and
ordinary event growth, can help explain why they later became core members in new
groups. The later AKSB tier decline removes future C- environment acceleration,
but it does not erase attributes already earned.

Later-career outcomes are calibration evidence only. They must not be used to
silently backfill unverified early attributes in L1/L2.

### AKSB / COVID aori effectiveness calibration

AKSB may still have an assigned aori responsibility during the COVID period.
Do **not** erase the role merely because ordinary live interaction was restricted.

Instead keep the dated assignment and apply a market-condition effectiveness
factor to the aori role bonus / aori-derived live effect:

- 2020-03 through 2020-12: `aori_effectiveness = 0.00`
- 2021-01 through 2021-12: `aori_effectiveness = 0.30`
- 2022-01 onward: `aori_effectiveness = 1.00`

Thus:

```text
effective_aori_share
  = assigned_aori_share * aori_effectiveness
```

The assignment may still sum to 1.0 across members, but the effective bonus pool
is multiplied by the period effectiveness. Large-live / CD base EXP remains
independent of this modifier.

This is a COVID-era performance-environment rule, not evidence that the member
stopped holding the role.

## 12. L1 / L2 evidence requirements

L1 should preserve dated facts and source language wherever possible:

- explicit captain/leader;
- main vocal / vocal member;
- dance leader / dance member;
- MC / talk role;
- aori role;
- center / ace wording;
- entry-stage audition comments, pre-debut performance history, or other dated
  evidence for `good` / `excellent` traits.

L2 performs normalization and inference:

1. decide whether ambiguous `center` / `ace` means formation positioning or
   performance responsibility;
2. assign raw role weights from evidence;
3. normalize each team role to 1.0;
4. enforce each member's performance-assignment sum <= 1.0;
5. carry confidence and evidence into L3.

Do not convert a keyword match alone into a confirmed role. Preserve confidence
and date ranges so historical assignment changes can be replayed.
