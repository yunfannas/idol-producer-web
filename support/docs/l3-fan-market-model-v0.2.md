# Idol Fan Market Model v0.2

**Status:** authoritative fan-market model for Game Design / L3 world simulation  
**Date:** 2026-09-21

This document supersedes the former explicit `Public -> Otaku -> Core` fan model,
including persistent `Core`, `C_i`, independent member-retention weights, and
an independently stored BoxRate.

The new model keeps the smallest state that can be calibrated from real-world
observations while still explaining live attendance, benefit-event sales, CD
sales, member departures, lineup renewal and Brand persistence.

---

## 1. Persistent fan state

### 1.1 Team state

```yaml
public_count: P
otaku_count: O
```

**Public (P)** is a statistical stock of light consumers / recognizers around the
group at time `t`. It is not a fixed identity cohort. The people represented by
AKB Public in an earlier era need not be the same people represented by =LOVE
Public years later.

Public is primarily increased by:

- SNS reach / viral spread
- streaming / personal streams as reach
- CM / advertising
- TV / variety / music-show exposure
- acting / modeling / magazine / external work
- large external media events

Public can buy tickets and CDs and can make low-rate trial purchases at benefit
events, but does not require a persistent member affinity.

**Otaku (O)** is the stable active idol-consuming layer for the group. Low/mid
live-idol economics are primarily O-driven.

### 1.2 Member state

For each active member `i`:

```yaml
affinity_count: A_i
purchase_weight_kjpy: W_i
```

`A_i` is the number of current group Otaku who have a sufficiently strong
preference for member `i` that, when a normal-price member-specific purchase
opportunity exists, they are willing to pay for that member at least sometimes.

The same Otaku may have affinity to multiple members. Therefore:

```text
sum(A_i) may be greater than O
```

This represents box support, multi-oshi and DD behavior without introducing a
separate fan class.

`W_i` is the average member-specific purchase intensity of those affinity fans,
measured in **JPY 1,000 equivalent units**. Product price is converted into the
same unit. There is no member-level spending cap.

```text
member_purchase_power_kjpy_i = A_i * W_i
```

Examples:

- 1,000-yen benefit ticket = 1 unit
- 2,000-yen cheki = 2 units
- 1,200-yen CD = 1.2 units

A smaller affinity population with a high weight may have the same commercial
power as a much larger shallow-affinity population.

### 1.3 Removed persistent states

The following are deprecated and must not drive new simulation:

- explicit persistent `Core` layer
- `C_i`
- `C_team = sum(C_i)`
- member `retention_weight`
- independently stored BoxRate
- team-level Otaku spending cap
- a rule that one fan's support of multiple members must conserve to one member
  purchase unit

Heavy DD behavior is represented by higher member purchase weights and multiple
member affinities.

---

## 2. Derived box-support metric

Box support is derived from the current fan state:

```text
BoxRate = sum(A_i) / O
```

This is best interpreted as **average member-affinity relationships per Otaku**,
not as an independent fan category.

A value near 1 means mostly single-member support. Higher values mean stronger
box / multi-oshi / DD overlap.

Because it is derived, lineup changes naturally change BoxRate.

---

## 3. Temporary unassigned O

Normally, an active Otaku who consumes the group should have affinity to one or
more members.

`O_unassigned` exists only as a short-lived transition state after:

- member graduation
- multiple simultaneous departures
- lineup reset
- a new generation arriving before old fans choose a new member

It is not a stable fan class.

When a member graduates:

1. remove that member's affinity edges;
2. Otaku who still have another member affinity remain assigned;
3. Otaku with no surviving affinity temporarily enter `O_unassigned`;
4. if no replacement arrives, most of this pool eventually churns, with only
   limited natural reassignment to incumbents;
5. if new members arrive, part of the pool may assign to newcomers.

Replacement assignment should use fan-facing member fit (ability archetype,
palette/style, role identity, appearance, interaction style) as a lightweight
matching input. Palette is a modifier, not the main determinant.

---

## 4. New-member acquisition

A newcomer without a corresponding departure receives a small initial Otaku /
affinity seed based mainly on the current group tier and launch exposure.

The seed is deliberately small. Long-run member popularity must come from:

- live exposure and performance
- formation / role exposure
- benefit-event conversion
- external personal exposure where relevant

When a newcomer replaces a departed member, part of the departed member's
otherwise-lost temporary O may instead assign to the newcomer according to
replacement fit.

---

## 5. Acquisition funnel

The simplified persistent funnel is:

```text
external reach
  -> Public
  -> Otaku
  -> member affinity
  -> member purchase intensity
```

The main acquisition sources are intentionally separated.

### 5.1 Public acquisition

Primarily:

- SNS / viral
- livestream reach
- CM / advertising
- TV / variety / music show
- acting / model / magazine / other external work

### 5.2 Otaku and affinity acquisition

Primarily:

- member live performance
- member stage exposure
- MC / aori / formation visibility
- benefit-event interaction
- repeated positive fan engagement

A strong benefit-event member may increase both:

- conversion into member affinity;
- growth of `purchase_weight_kjpy`.

This should be inferred in L2 from evidence such as persistent sell-through,
added slots, lines, repeat purchase behavior, explicit `特典会が強い` /
`釣り師` comments, and rapid member-specific demand growth.

---

## 6. Multi-group events

Fans of other groups attending a festival / taiban are **temporary Public** from
the target group's perspective.

They may:

- leave with no persistent state;
- become target-group Public;
- become target-group Otaku and immediately form one or more member affinities.

Team-palette similarity is a light conversion modifier:

- very dissimilar palettes make cross-group conversion materially harder;
- moderate/high similarity makes conversion somewhat easier;
- very high similarity also increases long-run substitution risk if one group
  weakens.

Palette must not create fan supply by itself.

Group-union referral is an additional event-level source of temporary exposure.
The detailed union system is specified separately; this document only requires
the fan model to accept union-referred temporary Public without counting it as
owned O until conversion occurs.

---

## 7. Ecosystem soft limit

Member purchase intensity has no individual soft cap. The soft constraint lives
at the **idol ecosystem** level.

S6 working anchors for the Japanese female live-idol / underground market:

```text
active unique Otaku ecosystem: ~100,000
broader Public market:         ~500,000
```

Group-level O memberships overlap heavily, so:

```text
sum(group O) >> unique ecosystem O
```

A large live-idol such as iLiFE! can therefore change the distribution of
attention, event attendance and spend across the ecosystem without requiring
the ecosystem population itself to expand proportionally.

---

## 8. Public behavior: cross-group uniform anchor

Public behavior is intentionally modeled with a common market-rate anchor rather
than a separate per-group purchase policy.

First working annual anchor:

```text
1 Public fan-year
  ~= 2 physical CDs
  + 1 major-live attendance
```

This is a population-average expectation, not literal behavior by every person.

The same Public pool can be very different people at different dates. The anchor
exists to map statistical Public size to observed market outcomes.

For physical releases, annual Public CD demand is distributed across meaningful
release opportunities rather than multiplied by release count.

For large lives, annual Public attendance demand is distributed across the
group's meaningful major-live opportunities.

Public may also contribute a small trial rate to benefit events.

---

## 9. Otaku commercial model

Otaku member-specific commercial power is:

```text
member_purchase_power_i = A_i * W_i
group_member_purchase_power = sum(A_i * W_i)
```

There is no additional team-level Otaku purchase-rate multiplier.

### 9.1 Benefit events / paid fan events

For a normal benefit event:

```text
expected_member_paid_demand_i
  ~= A_i * W_i * event_factor
     + Public_trial_i
```

The `event_factor` describes the opportunity (duration, slot supply, importance,
access) rather than group-specific underlying purchasing culture.

Historical sell-through is an observation of latent demand, not an extra
multiplier.

Useful evidence:

- slots offered
- slots sold out
- sell-out timing
- added slots
- approximate capacity
- queue length
- repeated performance across events

Sell-through most directly constrains `A_i * W_i`; other evidence is used to
separate breadth (`A_i`) from intensity (`W_i`).

### 9.2 Physical CDs

Music owns final CD revenue/sales accounting.

Fan state provides a calibration expectation:

```text
public_implied_cd
  + otaku_implied_cd
```

where the Public component uses the global Public anchor and the Otaku component
is derived from member `A_i * W_i`, converted through the actual product price.

The fan model does not separately add CD revenue once Music has recorded it.

---

## 10. Live calibration

Live owns ticket and ordinary live-goods accounting.

Fan state supplies an expected attendance range when direct material is missing.

Conceptually:

```text
expected_live_demand
  = Public contribution
  + Otaku contribution
```

with event modifiers for:

- importance
- region / travel
- weekday / time
- price
- recent show frequency
- competing events

This can estimate attendance for a documented non-sold-out live where exact
sales are unknown. The result must remain labeled as inferred, preferably with a
range and confidence.

Fan-implied attendance is a soft calibration anchor; direct observed attendance
or ticket-gross evidence wins.

---

## 11. Economic layer separation

To avoid double counting:

- **Live layer:** tickets + ordinary live goods
- **Fan layer:** benefit events + paid fan events
- **Music layer:** physical CD + streaming
- **External-work layer:** CM / TV / acting / modeling / other paid work

These streams can approximately reconstruct group economics before operating
costs.

---

## 12. Brand support

Brand means persistent status within the idol market, not only mass-media name
recognition.

Brand has two support layers:

### Layer 1: external industry recognition

Examples:

- major festivals / upper billing
- important multi-group events
- TV music shows
- major media milestones
- large-venue milestones

These events create discrete Brand gains.

### Layer 2: structural maintenance

Brand is maintained by:

- operator / producer / agency support;
- actual fan-market structure.

Fan support should use both O and P.

At low tiers, O dominates. Public is small and has little commercial / Brand
effect.

At stable-major tiers, Public becomes increasingly important.

Working fan anchors:

| Calibration | O | P | Interpretation |
|---|---:|---:|---|
| strong D+ / brief C- | ~1.5k-2.5k | usually < O | strong live-idol, mainly O-driven |
| AKSB 2019-type brief C- | ~2k+ | ~1k-3k | event-driven C- without a durable Public market |
| stable C- / Jams anchor | ~3k | ~5k | stable major lower edge |
| typical C | ~4k | ~20k | Public is a meaningful Brand/Music pillar |
| Takane-style C with unusually broad Public | ~3.5k | ~50k | O near C scale, Public closer to C+ breadth |

These are calibration anchors, not hard tier gates.

For D+/D/D- live idols, physical releases may exist, but sales are expected to be
predominantly O-driven.

For E tiers, stable O itself may not yet exist. E-tier classification is mainly
production / operational maturity:

- E-: amateur/newborn; no originals or very few originals
- E: originals exist but mix with covers
- E+: original identity and operation exist, but frequency is low / semi-pro
- D-: professional continuity begins and stable O becomes a primary market signal

---

## 13. Public/O shape by tier

The Public/O ratio is not constant.

- underground D/D+/D- groups usually have `P/O < 1`;
- the smaller the group, the lower the ratio tends to be;
- around stable C- the Public market begins to become economically meaningful;
- at major C and above, P can grow much faster than O;
- top major groups may have Public far larger than O.

This is a market-shape observation, not a hard rule that groups below a ranking
cutoff have zero Public. `public_count` is always maintained as a number.

---

## 14. Historical backcast / reconciliation

Real-world fan observations are sparse. A known later node must not be injected
as an instantaneous earlier state.

When L2 supplies a dated observation such as:

- member sell-through
- added slots
- member demand ranking
- known fan distribution
- observed live attendance
- physical sales

L3 may reconcile hidden P/O/A/W state gradually across prior months, subject to:

- plausible monthly growth/churn;
- dated live / release / media / benefit-event opportunities;
- no unlimited rewriting of remote history;
- observed data remaining soft constraints unless directly measured.

Store raw and reconciled values separately when practical.

---

## 15. Cross-layer calibration

Fan state is not itself a fourth Tier dimension. It is a hidden market state used
to cross-check the observable dimensions.

It may:

- estimate missing non-sold-out live attendance;
- explain Public vs Otaku portions of physical CD sales;
- support or challenge Brand maintenance;
- replace guessed graduation Brand penalties with fan-state consequences.

Likewise, observed Live / Music / Brand evidence can reconcile fan state.

The intended causal loop is:

```text
Public / Otaku / member affinity
        <-> Live
        <-> Music
        -> Brand maintenance
```

Member graduation should affect Brand through actual fan loss, spending loss and
subsequent market outcomes rather than a fixed direct Brand penalty.

---

## 16. Deprecated legacy model

The following legacy rules are superseded by this document and must be removed or
ignored in new runtime work:

```text
Public -> Otaku -> Core
C_team = sum(C_i)
Retained Core_i ~= C_i * BoxRate * event_modifier
OwnAttendance = P*rP + O*rO + C*rC
Otaku -> Core momentum
Core-specific palette / satisfaction / retention
member CD allocation by O_i / C_i
```

Where older Game Design text still contains these rules, this v0.2 document takes
precedence until the old sections are physically removed.
