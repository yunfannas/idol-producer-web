# Venue Capacity Model Expansion

## Purpose

The existing `venue_reference.json` mixes several different concepts in one `capacity_standing_about` field:

- official physical maximum;
- common concert layout capacity;
- fixed-seat hall capacity;
- standing livehouse capacity;
- artificial tier ceilings used by the simulation.

That creates distortions. For example, Yokohama Arena is currently represented around 12,000 although the venue officially supports 17,000 maximum and publishes standard concert layouts of 13,443 (A stage) and 12,477 (B stage). Makuhari Event Hall is similarly clipped to 7,000 in order to remain inside the current rank-B band despite the venue officially supporting about 9,000.

The simulation should stop changing real venue capacity to fit a rank boundary.

## Recommended Capacity Fields

Use separate physical and game-facing capacity values.

```ts
interface VenueCapacityModel {
  official_max_capacity: number;
  concert_standard_capacity?: number;
  concert_max_capacity?: number;
  game_concert_capacity: number;
  capacity_basis: "official_max" | "official_concert_layout" | "fixed_seat" | "standing" | "modeled";
}
```

Meanings:

- `official_max_capacity`: published physical maximum for the facility.
- `concert_standard_capacity`: a normal end-stage concert layout when the venue publishes one.
- `concert_max_capacity`: highest plausible concert inventory, including center-stage / special layouts when supported.
- `game_concert_capacity`: the default sellable capacity used by normal idol concerts in simulation.
- special event setup can override `game_concert_capacity`, but cannot normally exceed `concert_max_capacity`.

Do not use venue rank as a capacity clamp.

## Recommended Global Audience Ceiling

Set the normal simulation hard ceiling for a **single Japanese idol concert performance** to:

```text
70,000 attendees / show
```

Reasoning:

- Nissan Stadium has roughly 72,000 fixed seats and is an appropriate real-world upper reference for stadium concerts.
- Japan National Stadium has 67,750 fixed seats.
- Tokyo Dome and Kyocera Dome Osaka publish 55,000 maximum event capacity.
- Reaching 50,000+ already represents national-superstar scale; 70,000 leaves room for the rare stadium peak without turning temporary floor/production-layout arithmetic into unlimited capacity.

Recommended constants:

```ts
MAX_MODELED_AUDIENCE_PER_SHOW = 70_000;
DOME_STADIUM_MILESTONE = 45_000;
NATIONAL_STADIUM_MILESTONE = 60_000;
```

A venue may retain a larger official physical capacity in reference data, but ordinary simulated paid attendance should cap at 70,000 unless a future special-event system explicitly models a larger configuration.

## Expanded Major Venue Reference

The following values are intended for game calibration, not as a claim that every concert sells exactly this inventory.

| Venue | Official max | Standard / useful concert reference | Recommended `game_concert_capacity` | Suggested class |
|---|---:|---:|---:|---|
| Nissan Stadium | 72,327 | stadium concert; layout-dependent | 70,000 | national_stadium |
| Japan National Stadium | 67,750 fixed seats | stadium concert; stage blocks vary | 60,000 | national_stadium |
| Tokyo Dome | 55,000 | event maximum | 55,000 | dome |
| Kyocera Dome Osaka | 55,000 | event maximum | 55,000 | dome |
| Saitama Super Arena / GMO Arena Saitama | 37,000 stadium mode; 22,500 main-arena mode | 22,500 normal large-arena mode, 37,000 stadium mode | 22,500 default; 37,000 special setup | super_arena |
| K-Arena Yokohama | 20,033 | music-specialized fixed bowl | 20,000 | large_arena |
| Yokohama Arena | 17,000 maximum | A stage 13,443; B stage 12,477 | 13,500 | arena |
| Osaka-jō Hall | 16,000 maximum | layout B 10,500; center-stage layout C 16,000 | 10,500 | arena |
| Ariake Arena | about 15,000 | temporary arena seating included | 15,000 | arena |
| LaLa arena TOKYO-BAY | 14,174 maximum | official reference around 11,000 for basketball/concert | 11,000 | arena |
| Yoyogi National Gymnasium First Gymnasium | 12,934 maximum | 12,898 normal published total | 12,500 | arena |
| Pia Arena MM | 12,141 maximum | around 10,000 seated / 12,000 standing | 10,000 seated idol concert | arena |
| Nippon Budokan | about 11,000 usable-event reference | concert capacity is stage-layout dependent | 10,000 | budokan |
| Makuhari Event Hall | about 9,000 | official large-event maximum | 9,000 | large_hall / small_arena |
| Tokyo Garden Theater | about 8,000 | theater-style concert hall | 8,000 | large_hall |
| Kanadevia Hall / former TDC Hall | 3,190 standing; 2,471 seated event | common idol concert is seated/end-stage or mixed | 2,500 seated / 3,100 standing | hall_medium |

## Important Corrections To Current Reference Logic

### Yokohama Arena

Do not store `12,000` as if it were the venue's physical capacity. Store:

```json
{
  "official_max_capacity": 17000,
  "concert_standard_capacity": 13443,
  "game_concert_capacity": 13500
}
```

B-stage can be modeled as an alternate setup around 12,500.

### Makuhari Event Hall

Do not force the venue to 7,000 merely because `hall_large` currently ends at 7,000.

Use:

```json
{
  "official_max_capacity": 9000,
  "game_concert_capacity": 9000
}
```

Then either expand `hall_large` to 9,000 or introduce an overlap / `small_arena` class.

### Saitama Super Arena

This venue needs modes rather than one capacity:

```json
{
  "official_max_capacity": 37000,
  "concert_standard_capacity": 22500,
  "concert_max_capacity": 37000,
  "game_concert_capacity": 22500
}
```

A promoter must deliberately choose stadium mode to access the larger inventory and incur higher production/rent risk.

### Osaka-jō Hall

The venue demonstrates why `official_max_capacity` must not automatically equal normal concert inventory:

- layout A: 6,200;
- layout B: 10,500;
- layout C / center stage: 16,000.

The normal game default should be about 10,500, with 16,000 unlocked by a special center-stage configuration.

## Revised Venue Scale Proposal

The current S/A/B boundary is too coarse above 7,000. A better gameplay ladder is:

| Scale | Default game capacity band | Meaning |
|---|---:|---|
| `national_stadium` | 60,000–70,000 | absolute Japanese idol peak |
| `dome` | 40,000–59,999 | national-superstar commercial peak |
| `super_arena` | 20,000–39,999 | K-Arena / SSA-scale major event |
| `arena` | 10,000–19,999 | Yokohama Arena / Ariake / Yoyogi / Pia |
| `small_arena_large_hall` | 7,000–9,999 | Makuhari Event Hall / Garden Theater class |
| `hall_large` | 3,100–6,999 | large halls |
| `hall_medium` | 800–3,099 | TDC / Zepp-hall transition zone |
| `livehouse_club` | 301–799 | club-scale livehouse |
| `livehouse_small` | 181–300 | small livehouse |
| `livehouse_micro` | 50–180 | micro room / bar stage |

The player-facing prestige ladder can remain simpler:

```text
Livehouse -> Zepp / Hall -> Budokan -> Arena -> Repeatable Arena -> Dome / Stadium -> National Stadium
```

`Budokan` should remain a named prestige milestone rather than merely a capacity class. Its game importance is much larger than a generic 10,000-capacity room.

## Demand And Attendance Rules

Venue capacity should not directly define group tier.

Recommended event attendance calculation:

```text
potential_event_demand
  = natural_draw
  + event_premium
  + mobilized_latent_fans
  + ecosystem_spillover
  + price_induced_casuals

attendance
  = min(
      potential_event_demand,
      selected_layout_capacity,
      MAX_MODELED_AUDIENCE_PER_SHOW
    )
```

The important post-event metric is `natural_draw_after_event`, not the venue name.

This allows:

- a C-tier group to complete a heavily mobilized Project Budokan without becoming B tier automatically;
- a B-tier breakout group to sell Budokan and then naturally move into arenas;
- an A-tier group to run repeatable arena tours;
- an S-tier / national-superstar group to sustain dome or stadium demand.

## Data Sources Used For This Expansion

Prefer venue/operator sources over generic capacity aggregators.

- Japan National Stadium / Japan Sport Council: 67,750 fixed seats.
- Nissan Stadium official site: 72,327 seats.
- Tokyo Dome City: Tokyo Dome maximum 55,000.
- Kyocera Dome Osaka: maximum 55,000.
- Saitama Prefecture / arena operator: 22,500 main-arena mode; 37,000 stadium mode.
- K-Arena Yokohama / Yokohama convention information: 20,033 seats.
- Yokohama Arena official organizer guide: maximum 17,000; A-stage 13,443; B-stage 12,477.
- Osaka-jō Hall official organizer guide: layouts 6,200 / 10,500 / 16,000.
- Ariake Arena official organizer guide: about 15,000.
- Tokyo Dome City business guide: LaLa arena TOKYO-BAY maximum 14,174, reference 11,000 for basketball/concert.
- Japan Sport Council: Yoyogi First Gymnasium maximum 12,934.
- Pia / Pia Arena MM: maximum 12,141; approximately 10,000 seated / 12,000 standing reference.
- Makuhari Messe: Event Hall maximum about 9,000.
- Tokyo Garden Theater: maximum about 8,000.
- Tokyo Dome City: Kanadevia Hall 2,471 seated-event / 3,190 standing-event maximum.

## Implementation Recommendation

Do not immediately rewrite finance balancing around the new bands. First:

1. add the new capacity fields to reference data;
2. preserve current `venue_rank_letter` for compatibility;
3. stop clipping recorded real venues to rank boundaries;
4. make live-event setup choose a concert layout capacity;
5. only after that retune venue rent and ticket-revenue curves.

This avoids coupling an accuracy fix to a large finance rebalance in one change.
