# Idol Group Rank Table

This table sketches **typical** commercial and live footprint by letter rank. It is a design reference for balancing groups in simulation, not a strict real-world certification. Individual groups can diverge (e.g. strong taiban presence without matching CD sales).

**Taiban (対バン):** multi-bill or joint lives where several groups share one event—often the main discovery channel below headline-tour scale. **Ranks C–E** usually appear on **many** taiban and joint bills alongside peers, as own one-man capacity and marketing budget are still limited compared with A/S.

| Rank | Concert scale | Sales / publishing | Commercials | TV / media | Taiban & joint lives |
| --- | --- | --- | --- | --- | --- |
| S | Regular large stadium concerts, over 30,000 capacity | 500,000+ CD/digital sales with major CD publishers, usually twice a year | Famous brand commercial contracts | Regular TV variety and music program attendance | Own tours and festivals dominate; taiban or joint slots are occasional (guests, special bills), not the core schedule |
| A | Regular stadium concerts, 15,000–30,000 capacity | 200,000+ CD/digital sales with major CD publishers | Commercial contracts | TV variety and music program attendance | Strong one-man / hall cycle; taiban used for promotion or theme events, not the main income lever |
| B | Regular large hall concerts and seldom stadium concerts, 10,000–20,000 capacity; special rule: held a Nippon Budokan concert | 60,000+ CD/digital sales | Commercial contracts | TV variety attendance and seldom music program attendance | Mix of own hall dates and **regular** taiban / joint lives to fill halls and cross-fans |
| C | Regular large hall concerts, 5,000–15,000 capacity | 10,000+ CD/digital sales with major CD publishers | Small brand makeup/dress contracts | Rare TV variety attendance | **Heavy taiban / joint-live circuit:** many shared bills, event series, and festival side stages; own one-mans exist but taiban volume is high |
| D | Regular hall concerts, 1,000–5,000 capacity | Seldom CD publishing | Rare commercials | Minimal or occasional TV/music program attendance | **Very taiban-heavy:** constant multi-group lives, omnibus events, and small tours as support; few solo dates at scale |
| E | Regular small hall concerts, 200–1,000 capacity | Digital-only publishing | No regular commercial contracts | Little to no TV/music program attendance | **Mostly taiban and omnibus:** packed weekend bills, livehouse rotations, and festival micro-stages; own headline capacity stays small |
| F | Livehouse concerts, under 200 capacity | Very rare publishing | No commercial contracts | No regular TV/music program attendance | Almost entirely **taiban, open-mic style bills, and free/low-door events** to build a floor audience |

## Usage notes

- **C–E in practice:** treat high taiban frequency as normal for these tiers even when other columns (TV, CD) look weak—visibility is live-scene and peer-network driven.
- **Tier C finance template (`database/finance/typical_tier_c_group.json`):** models **no type 7** residency, **2 taiban/week**, **0.75 two-man/week**, **0.75 one-man/week**, **type S birthdays on type 6** (one-man host), and **3 type 3 festivals/year**—see `schedule` and `derived_monthly_event_counts` in that JSON.
- **Letter tier C and above (finance):** **full-group makeup and hair on every live** in the typical B/C JSONs, plus **four major-publisher MV-grade singles per year** (monthly amortization in those files and in `database/finance/group_finance.json`).
- **Do not over-read gaps:** a group can look “F” on sales but “C” on live hustle; decide which axis the game weights per mode.
- **E vs F:** both lean on taiban; F is tighter capacity and fewer paid headline opportunities, with more unpaid or token-door bills.

---

## Live types (design vocabulary)

Stable names for scheduling, economy, and UI. Durations are **typical set lengths** for the headlining group’s turn, not load-in or encore blocks.

**Disambiguation:** **Live type `S`** (below) is a **special / overlay** format (formerly **7a**). It is **not** the same token as **letter tier `S`** in the idol-tier table at the top of this file (stadium-scale **group** letter tier).

| # | Live type | Preparation & tickets | Venue scale | Typical slot | Fan format (after live) |
| --- | --- | --- | --- | --- | --- |
| **1** | **Premium concert** | High production; advance sales emphasis | Large hall, stadium, or large stadium | **About 2.5 hours or longer** (full show + encore) | **Premium after-party track** on **separate day(s)** from the main show (see below); not the same-night tokutenkai loop |
| **2** | **Roaming concert series** | Tour-grade prep; routed advance sales | Hall → large hall → stadium (rotating cities) | **About 2 hours or longer** per stop | Same class as **1**: **special after-party days** per city leg, off the main performance night |
| **3** | **Festival** | Festival promoter logistics; day passes / stages | **Large taiban:** multiple venues or stages across **2–3 full days** | **Roughly 30 minutes** per group per appearance (festival set) | **Varies by promoter:** compact goods / ticketed mini-meets or short lanes; not always full tokutenkai. Design as a flag, not a hard rule |
| **4** | **Taiban (対バン)** | Shared bill; split advance / door by promoter rules | **Same venue**, same night, **multiple groups**, **split time slots** | **Usually about 20–35 minutes** per group | **Tokutenkai (特典会)** usual: purchase-linked lanes, timed cheki/chu-shashin, etc., **same day** at or next to the venue — in-app defaults: **60 minutes** post-live window; **¥2,000 @ 15s** and **¥3,000 @ 20s** talk slots with a **50/50** ticket mix |
| **5** | **2 / 3 / 4-man live** | Co-head prep; joint ticketing or split | **Shared venue**; small groups rotate; often **song or costume exchange** segments | Per-group block often similar to taiban, with longer combined runtime | **Tokutenkai** usual—shared goods desk or per-group lanes after the joint set |
| **6** | **One-man live (routine tier)** | **More premium than a plain routine live**: longer set, stronger staging, still club/hall scale | Small hall up to mid hall depending on draw | **Extended performance** vs **7**; shorter than **1** / **2** arena-scale shows | **Tokutenkai** as **7**, sometimes expanded slots or add-on tiers |
| **7** | **Routine live** | Lightweight repeat format; recurring cadence | **Small venue** (livehouse / club); **daily, weekly, or monthly** residency style | **Usually about 1–1.5 hours** | **Tokutenkai** usual: high frequency, venue-default flow |
| **S** | **Special live** (e.g. **member birthday**, anniversary, graduation send-off) | **Not a standalone venue class:** implement as a **special form of type 4, type 6, or type 7**—same logistics tier as the host live, with list- or member-specific setlist, goods, and corners | Inherits **type 4** (shared bill), **type 6** (club one-man), or **type 7** (residency) venue | Same **order of length** as the host **4** / **6** / **7** slot, plus special segments | **Tokutenkai** inherits the host **4** / **6** / **7** lane model; add optional birthday / solo-lane **tiers** on top |

### How live types relate to taiban (from above)

- **3 Festivals** and **4 Taibans** are both “many groups, short sets,” but **festivals** are **multi-day / multi-venue** bills with **~30 min** turns; **taibans** are **one venue, one night**, **~20–35 min** turns.
- **5 (2/3/4-man)** is **co-head** intimacy: fewer acts, more collaboration (medleys, costume swap), not the anonymous festival conveyor.
- **6** and **7** are the **grassroots / club ladder**: **7** is the repeat residency, **6** is the **step-up one-man** (still club–hall scale) before tour-class **2** or flagship **1**. **Type S** is an **overlay** on **4**, **6**, or **7** (not a separate hall size)—use flags like `host_type ∈ {4,6,7}` + `special=S` in data.
- **Type S monthly rate (finance / scheduling):** not a fixed column in the live-count CSV—derive from **roster** (e.g. `member_count ×` birthdays per member per year `÷ 12`). Canonical wording: `database/finance/group_finance.json` → `documentation.type_S_overlay_monthly_rule` (and `documentation.monthly_live_counts_matrix` for the CSV layout, including **`type_6_venue_rank`**).

### Fan engagement: tokutenkai vs premium after-party

**Tokutenkai (特典会)** — purchase- or ticket-linked meet flow in or beside the live venue, usually **same day** as the performance: numbered tickets, parallel lanes, strict time caps.

**Types 4, 5, 6, 7** (and **type S** when it is hosted on **4**, **6**, or **7**): treat **tokutenkai as the default** fan-service shell after the live, inheriting the **host** type’s lane rules. **Typical Tier D group** economics (`database/finance/typical_tier_d_group.json`) combine these live types on a monthly cadence with tokutenkai. Letter-tier **B** and **C** review sheets live in `database/finance/typical_tier_b_group.json` and `database/finance/typical_tier_c_group.json`; shared ladders (admin/training by letter tier, costume refresh by letter tier, etc.) are in `database/finance/group_finance.json`.

**Types 1 and 2 (premium + roaming):** the main show stays **performance-first**; deep fan contact is usually **not** a compressed same-night tokutenkai at stadium scale. Instead, groups schedule **special after-party programs on different calendar days** from the main concert, for example:

- **2-shot** still photography with members (cheki-style or staff-shot)
- **Short-form filming** blocks (e.g. **TikTok**-style scripted or challenge clips with fans)
- **Handshake**-style high-touch events (**largely obsolete or heavily restricted after COVID**; keep as legacy / historical mode or rare exception)
- **Online talking sessions** (video room, voice-only, or chat-moderated meet)

Design implication: **1 / 2** revenue and scheduling should model **extra fan-service days** as separate line items from the hall/stadium night; **4, 5, 6, 7** (and **S-on-4/6/7**) fold most fan ARPU into **same-day tokutenkai** per host type.

**Type 3 (festival):** see table—promoter-dependent; may mix on-site mini-meets, goods-only tiers, or no structured lane at all.

### Typical ticket yen (design defaults)

Round **JPY** anchors for simulation and UI copy—not market quotes. **s** = **seconds** of billed fan interaction per purchased slot where noted.

| Item | Typical price (JPY) | Notes |
| --- | ---: | --- |
| **Type 1 — Premium concert, full view** | **10,000** | Full-price house seat / standard advance |
| **Type 1 — Premium concert, partial / obstructed view** | **8,000** | Restricted sightline or side-block tier |
| **Type 2 — Roaming concert (one stop)** | **9,000** | Single-city tour leg; adjust per hall tier if needed |
| **After-party (types 1 & 2), per slot** | **2,000** for **15 s** | Separate-day premium fan-service block (2-shot, filming, talk, etc.); one ticket = one **15-second** unit unless you stack multiples |
| **Tokutenkai (types 4, 5, 6, 7; same for type S on 4/6/7), per slot** | **2,000** for **20 s** **or** **3,000** for **30 s** | **Type S** bills use the **same per-slot yen** as their host type; birthday tiers are add-ons, not a separate base grid |
| **Tokutenkai — non-VIP hall / venue entrance** | **+1,000** | **Non-VIP** attendees pay **¥1,000 entrance** in addition to per-slot tokutenkai tickets (VIP bundles may waive or embed this—model as a flag) |

**Venue ranks S & A** (`stadium` / `arena` in `database/finance/venue_reference.json`): for **type 1** house modeling, treat **70%** of sellable house as **full-view** at the **¥10,000** anchor and **10%** as **obstructed / partial** at the **¥8,000** anchor; the **remaining ~20%** is left for other tiers or holds (see `type_1_premium_concert_ticket_inventory` in that JSON).

Stacking: total fan spend = entrance (if applicable) + sum of slot tickets purchased. Premium **main show** tickets (¥8k/¥10k or ¥9k roaming) are **separate** from after-party **¥2k / 15s** units and from **same-day** tokutenkai stacks.

### Economics hook

For **routine / small-venue** money assumptions (tickets, tokutenkai, salaries), see `database/finance/typical_tier_d_group.json` (**Typical Tier D group**): **letter tier D** slice with **seven members**, **~600 cap** type-7 template in that file, plus numeric `derived_monthly_event_counts` and `event_net_per_occurrence_estimate_yen`. **Default live cadence** (`schedule`) and **shared ladders** (staff, costume, makeup baseline, song/MV anchors, admin+training) are in `database/finance/group_finance.json`. **Venue capacity, rent assumptions, live-ops multipliers, and real hall mappings** live in `database/finance/venue_reference.json`. Align or fork against the **tokutenkai** table above when harmonizing the finance module.
