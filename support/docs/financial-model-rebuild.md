# Financial Model Rebuild

## Purpose

The existing web finance model already has a useful daily ledger and several older desktop finance assumptions. The ecosystem rebuild should update the finance model rather than replace it.

The new financial model should connect:

```text
strategy policy
-> generated schedule
-> public / otaku / core audience
-> demographic segment fit
-> channel revenue
-> member workload
-> cash flow and sustainability
```

The player should feel that different idol businesses make money in different ways.

## Current Web Model

Current engine files:

- `src/engine/financeSystem.ts`
- `src/engine/gameEngine.ts`
- `src/engine/livePerformanceWeb.ts`
- `src/engine/mediaEventWeb.ts`
- `src/engine/data/group_finance.json`
- `support/docs/reference/game_logic_model.md`

Current `DailyBreakdown` income buckets:

- `digital_sales`
- `fan_meetings`
- `goods`
- `media`
- `live_tickets`
- `live_goods`
- `tokutenkai_revenue`

Current expense buckets:

- `staff`
- `office`
- `promotion`
- `live_cost`
- `live_ops_cost`
- `live_venue_fee`
- `tokutenkai_cost`
- `tokutenkai_idol_share`
- `salaries`
- `scout_retainers`

Media/event additions already exist:

- `media_event_revenue`
- `media_operating_cost`
- `media_event_travel`
- `media_event_making`
- `media_event_advertising`
- `media_event_staffing`
- `media_fixed_admin`
- `media_fixed_advertising`
- `cd_release_count`
- `cd_release_units`
- `cd_release_revenue`
- `cd_release_mv_cost`

## Current Weakness

The current model mixes several different revenue regimes into generic buckets:

- `fan_meetings` is too vague.
- `digital_sales` is passive and not tied to strategy or fan layers.
- `tokutenkai_revenue` only covers post-live tokutenkai, but the design now needs online benefits and shooting/handshake release events.
- `media` has an event-driven path, but the passive base still exists.
- `live_goods` and `goods` overlap conceptually.
- `cd_release_revenue` exists through media/release events, but online signing labor and fan conversion are not yet integrated.

## Updated Revenue Channels

Split income into explicit channels.

| Channel | Description | Main fan layer | Main strategy driver |
|---|---|---|---|
| `live_ticket_revenue` | Ticket gross from concerts, taiban, routine lives, festivals where applicable. | otaku/core | live frequency, event mix, venue scale |
| `live_goods_revenue` | Venue goods, concert goods, penlights, apparel. | otaku/core | production investment, goods policy, event type |
| `post_live_tokutenkai_revenue` | Cheki/talk tickets after live. | otaku -> core | post-live tokutenkai emphasis |
| `online_benefit_revenue` | Online signing, online talk, remote release-event benefits. | public/otaku/core | online benefit emphasis, release strategy |
| `shooting_handshake_revenue` | Physical release-event contact: handshake, individual/group shooting. | otaku/core | shooting/handshake emphasis |
| `release_sales_revenue` | Physical CD/album net, bundled release units. | public/core | major release/signing efficiency, public reach |
| `digital_streaming_revenue` | Downloads/streaming/YouTube/MV long-tail income. | public | viral music/content, catalog strength |
| `media_appearance_revenue` | TV/radio/books/online appearance fees and commercial jobs. | public | media/IP emphasis |
| `commercial_ip_revenue` | Sponsorship, CM, brand tie-ins, licensing, pooled IP income. | public | tier, media/IP, brand prestige |
| `fanclub_revenue` | Monthly fanclub and paid community/content. | core | member attachment, trust |
| `birthday_special_revenue` | Birthday live, birthday goods, member-specific plans. | core | direct relationship, member equity |

The ledger can keep legacy fields for compatibility, but the design target should separate these channels.

## Updated Expense Channels

| Channel | Description | Main driver |
|---|---|---|
| `member_base_compensation` | Salary/minimum guarantee. | tier, member count, contract type |
| `member_sales_share` | Tokutenkai/benefit/release-event commission. | benefit revenue, contract type |
| `staff_payroll` | Managers, live staff, back office. | tier, member count, schedule density |
| `venue_cost` | Rental/production settlement. | event type, venue scale, day type |
| `live_ops_cost` | Transport, staff, equipment, day-of operation. | live count, member count |
| `benefit_ops_cost` | Cheki film, payment fees, benefit staff, platform fees. | benefit channel volume |
| `media_ops_cost` | Travel, staffing, production, promo support. | media schedule |
| `production_cost` | Songs, choreography, recording, MV, costumes, photos. | production investment |
| `goods_cost` | Manufacturing cost of goods. | goods units/stock policy |
| `office_admin_cost` | Office, accounting, legal, software, general admin. | tier |
| `promotion_cost` | Ads, PR, release promotion, posters. | strategy |
| `scout_retainers` | Scout subscriptions/contracts. | scouting policy |
| `crisis_pr_cost` | Scandal, cancellation, refund and apology costs. | risk events |

## Old Finance Assumptions To Keep

`src/engine/data/group_finance.json` already contains useful assumptions. Keep and reuse them:

- scenario starting cash by scenario;
- monthly base salary multipliers by tier;
- E-tier part-time salary and F-tier no-base model;
- tokutenkai sales bonus rate by tier;
- CD net income per unit, currently `¥500`;
- online signing time, currently `15 seconds per CD`;
- commercial income guesses for S/A/B;
- tier-based staff count formulas;
- small venue fee anchors;
- monthly admin/training cost by tier;
- production/MV/publishing anchors;
- live goods eligibility and average price/pieces by tier.

## Benefit Channel Economics

### Post-Live Tokutenkai

Best fit:

- `iLiFE!`
- `Akishibu project`
- `Jams Collection`
- `Kirameki Unforent`

Basic formula:

```text
member_capacity_tickets =
  tokutenkai_minutes * 60 / slot_seconds

member_demand_tickets =
  member_core_fans * demand_rate
  + live_heat
  + new_fan_conversion_demand

actual_tickets =
  min(total_capacity, total_demand)

post_live_tokutenkai_revenue =
  actual_tickets * ticket_price
```

Costs:

```text
film_and_consumables = actual_tickets * unit_consumable_cost
member_sales_share = actual_tickets * ticket_price * member_share_rate
benefit_staff_cost = session_count * staff_anchor
```

Research anchor:

- Professional underground signed cheki/benefit price: around `¥2,000`.
- Safer throughput baseline: `75-90` transactions per fully utilized member-hour.
- Current code uses `estimateTokutenkaiRevenueYen(actualTickets) = actualTickets * ¥2,800`; this should be reviewed because it is higher than the research baseline and may represent blended ticket tiers.

### Online Benefits

Best fit:

- `=LOVE`
- `Nogizaka46`
- some `Takamine no Nadeshiko`

Basic formula:

```text
online_benefit_units =
  release_buyers
  * online_access_rate
  * member_demand_modifier
  * capacity_modifier

online_benefit_revenue =
  online_benefit_units * net_per_unit
```

Member time:

```text
online_member_seconds =
  online_benefit_units_allocated_to_member
  * seconds_per_unit
```

Old finance anchor:

- CD net to group: `¥500` per unit.
- Online signing labor: `15 seconds` per CD handled by the allocating member.

Design meaning:

- high revenue per member-hour compared with post-live cheki;
- lower physical strain;
- still creates schedule occupancy and voice/mental fatigue;
- strong fit for major/IP systems.

### Shooting / Handshake Release Events

Best fit:

- `Nogizaka46`
- major release-event systems

Basic formula:

```text
physical_release_event_units =
  release_buyers
  * physical_access_rate
  * lane_capacity_modifier

shooting_handshake_revenue =
  physical_release_event_units * net_per_unit
```

Costs:

- venue/hall rental;
- staff/security;
- lane operations;
- member fatigue;
- travel;
- platform/ticketing.

Design meaning:

- strong otaku/core conversion;
- high physical and logistical burden;
- less appropriate for `=LOVE` if online signing is the main efficient channel;
- not post-live tokutenkai.

## Release Economy

Separate physical release economics from generic digital sales.

### Physical Release

```text
release_units =
  public_fans * public_purchase_rate
  + otaku_fans * otaku_purchase_rate
  + core_fans * core_purchase_rate
  + benefit_channel_boost

release_sales_revenue =
  release_units * net_income_per_unit
```

Modifiers:

- public heat;
- production investment;
- media/IP emphasis;
- online benefit emphasis;
- shooting/handshake emphasis;
- member popularity distribution;
- trust;
- recent release fatigue.

### Digital / Streaming

```text
digital_streaming_revenue =
  public_fans
  * content_consumption_rate
  * catalog_strength
  * platform_net_rate
```

This should be low direct revenue compared with CDs/benefits, but useful for public heat and conversion.

## Live Economy

### Ticket Revenue

```text
attendance =
  min(capacity, demand)

live_ticket_revenue =
  attendance * average_ticket_price
```

Demand should come from:

- otaku fans;
- core fans;
- public heat for major concerts/festivals;
- event type;
- venue ambition;
- ticket price fit;
- trust;
- recent live saturation.

### Live Goods

Use old live-goods model but align with new channel names.

```text
live_goods_units =
  effective_buyers
  * average_buying_pieces
  * goods_fit

live_goods_revenue =
  live_goods_units * average_price

live_goods_cost =
  live_goods_units * unit_cost
```

Design correction:

- Package/taiban/routine lives may have no or limited goods, depending on policy and venue.
- Concerts, one-mans, birthday events and major shows are stronger goods opportunities.
- Stockouts should reduce revenue and fan satisfaction.

## Fanclub and Member Plans

Fanclub should monetize core fans.

```text
fanclub_revenue =
  core_fans
  * fanclub_join_rate
  * monthly_fee
```

Member-specific plans:

```text
member_plan_revenue =
  member_core_fans
  * member_plan_join_rate
  * member_plan_fee
```

Jams Collection official FC is a useful reference pattern:

- group plan;
- member-specific higher plan;
- member-specific cheki ticket benefits.

## Commercial / IP Revenue

Use the old S/A/B commercial assumptions, but make them strategy-sensitive.

```text
commercial_ip_revenue =
  tier_commercial_base
  * media_ip_strategy_modifier
  * public_trust_modifier
  * brand_safety_modifier
```

Old assumption:

- Most gross is not directly group operating budget.
- Group operating budget receives only a small share.

Keep this because it prevents S/A groups from printing unrealistic cash.

## Member-Hour Efficiency

Finance must track not only:

```text
revenue / member
```

but:

```text
revenue / member-hour
```

Approximate channel order:

| Channel | Revenue efficiency | Fatigue pattern |
|---|---|---|
| Online signing / online talk | High | seated but repetitive |
| Physical release event | Medium-high | long logistics/physical strain |
| Post-live tokutenkai | Medium | high after-performance fatigue |
| Package live only | Low-medium | schedule fragmentation |
| One-man concert | Strategic, not same-day-max | high prep burden |
| Media/IP | Variable | can be efficient for group, hard for selected members |

This is essential for distinguishing:

- `=LOVE`: high revenue/member-hour through release/online systems.
- `iLiFE!`: high cash temptation through frequent live/tokutenkai windows, but high fatigue.
- `Takamine no Nadeshiko`: public reach but weak conversion efficiency.
- `Jams Collection`: direct fan monetization can compensate for weak CD sales.

## Tier Defaults

Use tier as a fallback, but strategy archetype should override.

| Tier | Default finance regime |
|---|---|
| S | Major/IP, commercial, releases, large concerts, generational or brand system. |
| A | Major/IP or high-efficiency release/online system. |
| B | Strong underground or mid-major hybrid; can use direct fan monetization and venue ambition. |
| C | Strong underground/quasi-major; benefit, goods, one-mans and releases all matter. |
| D | Professional underground; live/tokutenkai/direct fan economy central. |
| E | Small underground; low fixed cost, part-time compensation, survival cash flow. |
| F | Tiny/local/early; mostly variable pay and small core supporters. |

## Strategy Effects On Finance

| Strategy policy | Finance effect |
|---|---|
| `live_frequency` | More ticket/tokutenkai opportunities, more venue/live ops cost, fatigue risk. |
| `online_benefit_emphasis` | More release/online benefit revenue, member-hour efficient, requires public/core demand. |
| `shooting_handshake_emphasis` | More physical release-event sales, higher ops/fatigue. |
| `post_live_tokutenkai_emphasis` | More immediate core conversion and cash, high fatigue/session capacity risk. |
| `media_ip_emphasis` | More media/commercial revenue and public growth, more fixed support cost. |
| `viral_music_content` | More public heat and long-tail digital revenue, indirect conversion. |
| `production_investment` | Higher upfront cost, better public/otaku/core conversion and merch/release demand. |
| `rest_protection` | Fewer marginal events, lower short-term revenue, lower absence/turnover loss. |
| `roster_renewal_system` | Audition/training/onboarding cost, long-term continuity. |

## Proposed Ledger Evolution

Keep old fields for compatibility, but add new optional fields.

```ts
interface DailyBreakdownVNext extends DailyBreakdown {
  live_ticket_revenue?: number;
  live_goods_revenue?: number;
  post_live_tokutenkai_revenue?: number;
  online_benefit_revenue?: number;
  shooting_handshake_revenue?: number;
  release_sales_revenue?: number;
  digital_streaming_revenue?: number;
  media_appearance_revenue?: number;
  commercial_ip_revenue?: number;
  fanclub_revenue?: number;
  birthday_special_revenue?: number;

  member_base_compensation?: number;
  member_sales_share?: number;
  benefit_ops_cost?: number;
  production_cost?: number;
  goods_cost?: number;
  crisis_pr_cost?: number;

  member_hours_live?: number;
  member_hours_benefit?: number;
  member_hours_media?: number;
  member_hours_training?: number;
  revenue_per_member_hour?: number;
}
```

Legacy mapping:

```text
live_tickets -> live_ticket_revenue
live_goods -> live_goods_revenue
tokutenkai_revenue -> post_live_tokutenkai_revenue
digital_sales -> digital_streaming_revenue + online_benefit_revenue where applicable
fan_meetings -> online_benefit_revenue + shooting_handshake_revenue + fanclub_revenue
media -> media_appearance_revenue + commercial_ip_revenue
goods -> fanclub/goods baseline or deprecated passive goods
```

## Implementation Phases

### Phase 1: Documentation and UI Labels

- Keep calculations unchanged.
- Rename/describe finance buckets in UI/tooltips to clarify current meaning.
- Add vNext fields as optional types only after code planning.

### Phase 2: Benefit Channel Split

- Split `tokutenkai_revenue` from new `online_benefit_revenue` and `shooting_handshake_revenue`.
- Keep `post_live_tokutenkai_revenue` as the legacy tokutenkai field.
- Connect benefit-channel policy to schedule generation and revenue.

### Phase 3: Fan-Layer Driven Revenue

- Use Public/Otaku/Core and demographics to calculate demand.
- Replace passive `digital_sales`, `fan_meetings`, and `goods` with channel-specific calculations.

### Phase 4: Production and Release Economy

- Use production investment to create costs and conversion boosts.
- Use physical release economics with online/physical benefit channels.
- Track release fatigue and member-hour load.

### Phase 5: Sustainability and Strategy Dashboard

- Show:
  - monthly burn;
  - channel revenue mix;
  - revenue/member-hour;
  - member sales dependence concentration;
  - cash runway;
  - short-term profit vs long-term risk.

## First Practical Update

First code implementation status:

- Added channel-specific optional ledger fields while preserving old `DailyBreakdown` totals.
- Replaced passive generic daily revenue with channelized estimates:
  - digital streaming;
  - online benefit;
  - shooting / handshake release-event baseline;
  - fanclub monthly revenue;
  - commercial / IP monthly revenue;
  - live ticket and live goods revenue;
  - post-live tokutenkai / cheki revenue.
- CD release revenue is exposed as `release_sales_revenue`, `cd_net_profit`, `cd_units_sold` and online-signing member workload.
- Online signing uses the corrected `15 seconds per CD` assumption.
- Cheki profit is tracked as gross revenue minus ops cost and member sales share.
- Member monthly income is tracked as base compensation plus sales share.
- Finance UI tables now show fanclub, CD net, cheki net and member pay.
- Finance now derives an audience profile from fan-base size:
  - public / otaku / core fan estimates;
  - tier-default demographic mixes;
  - sampled-group demographic overrides for Nogizaka46, =LOVE, iLiFE!, Takamine no Nadeshiko, Akishibu project, Jams Collection and Kirameki Unforent;
  - demand multipliers for fanclub, release/online benefit, digital, goods and live attendance.
- Ledger rows expose audience diagnostics such as public/otaku/core fans, female share, youth share, middle-plus share and demand multipliers.

Remaining next steps:

1. Let Strategy Meeting project revenue by channel.
2. Let the schedule generator choose whether benefit activity is:
   - none;
   - online;
   - shooting/handshake;
   - post-live tokutenkai.
3. Replace derived Public / Otaku / Core estimates with persistent fan-layer state once that system is in save data.
4. Split member-level sales share by actual member sales allocation instead of group-level share only.
5. Add finance dashboard warnings for revenue concentration, weak fanclub conversion and bad revenue/member-hour.

This keeps the old model alive while making the new ecosystem financially legible.
