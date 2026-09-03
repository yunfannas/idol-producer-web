# Idol Producer Ecosystem Rebuild Design

## Goal

Rebuild the game loop around a living idol-management ecosystem instead of an event-notification-driven admin simulator.

The current game already has useful realistic parts:

- detailed schedule;
- live results;
- finances;
- training;
- member status;
- inbox decisions;
- scenario events;
- group policy.

The weak point is that fun often arrives as individual notifications. The new design should make the main loop:

```text
Research / current state
-> draft strategy
-> staff/member/fan meeting feedback
-> finalize policy
-> schedule engine generates details
-> simulation produces fan/member/finance outcomes
-> player reviews dashboard and adjusts next plan
```

Keep important notifications:

- Monthly strategy meeting
- Today's live schedule
- Live report
- major blocking decisions: scandal, graduation, contract, cash crisis, venue commitment

Demote routine process messages:

- training ended;
- auto-booked lives;
- normal media processing;
- minor operational logs.

## Core Ecosystem

The game should have five interacting systems.

```text
Producer Strategy
  -> Schedule / Activity Mix
  -> Fan Layers and Demographics
  -> Member Workload / Trust / Growth
  -> Finance / Cash Flow
  -> Reputation / Risk
```

No system should be a single direct slider to an outcome.

Example:

```text
Player does not set "core fan conversion."
Player sets event mix, benefit-channel policy, member exposure, production investment and rest rules.
The fan system calculates public -> otaku -> core movement.
```

## 1. Producer Strategy Layer

Add a strategy state above detailed admin policy.

```ts
interface GroupStrategy {
  preset_id: string;
  visible_month: string;
  live_frequency: number; // 0-5
  online_benefit_emphasis: number; // 0-5
  shooting_handshake_emphasis: number; // 0-5
  post_live_tokutenkai_emphasis: number; // 0-5
  media_ip_emphasis: number; // 0-5
  viral_music_content: number; // 0-5
  production_investment: number; // 0-5
  rest_protection: number; // 0-5
  roster_renewal_system: number; // 0-5
  member_exposure_policy:
    | "stable_member_value"
    | "ace_plus_rotation"
    | "balanced"
    | "new_member_nurture"
    | "generation_integration"
    | "narrative_casting";
  finalized_month: string | null;
  locked_until_meeting_id: string | null;
}
```

Review source:

- `support/docs/group-strategy-points-review.csv`
- `support/docs/strategy-review-page-design.md`
- `support/docs/admin-job-shrink-design.md`

### Normal Gameplay Rule

During normal daily play, strategy is read-only.

The player should see the current strategy as the organization's operating doctrine, not as a set of always-editable sliders. Most days, the strategy panel should answer:

```text
What are we trying to do this month?
What schedule did that create?
What consequences are appearing?
```

Editable controls appear only during the monthly Strategy Meeting. Once finalized, the strategy is locked for the month and the detailed scheduler executes it.

Normal play can still show:

- current strategy preset and policy values;
- calendar summary generated from that strategy;
- fan, member and finance consequences;
- warnings that should be discussed next month;
- emergency exception buttons for true crisis cases.

Normal play should not allow casual day-by-day rebalance of strategy values. This prevents the strategy layer from becoming a trivial optimization panel.

### Monthly Strategy Lifecycle

```text
Month start
-> blocking Strategy Meeting notification appears
-> player enters dedicated Strategy Meeting page
-> player reviews last month's results
-> player drafts changes
-> staff / member / fan survey feedback updates
-> player finalizes
-> blocking notification clears
-> strategy locks
-> schedule generator builds the month
-> normal play shows results and reports
-> next month meeting reopens
```

Default strategies should be applied automatically for the starting group. The first meeting can either:

- ask the player to confirm the default strategy; or
- start with the strategy already finalized for the opening month and make the first editable meeting happen next month.

The second option is better for game start because it lets the player observe the group's identity before changing it.

### Strategy Change Restrictions

Strategy changes should be limited in frequency and magnitude.

Suggested rules:

| Rule | Purpose |
|---|---|
| One normal strategy meeting per month | Keeps planning meaningful and prevents daily slider play. |
| Large shifts trigger opposition | A group cannot instantly transform identity without staff/member/fan reaction. |
| Repeated reversals reduce trust | Fans and members dislike whiplash direction changes. |
| Some presets have hard plausibility caps | `=LOVE` cannot become a pure underground tokutenkai grind; `Nogizaka46` cannot ignore generational renewal. |
| Emergency meeting only for crises | Cash crisis, scandal, graduation, venue cancellation or member health crisis. |

Represent large shifts as deltas from last finalized strategy:

```text
small change: 0-1 points in a policy item
medium change: 2 points
large change: 3+ points or preset change
```

Large changes should be allowed, but costly. That cost should be social and operational rather than a hard UI block:

```text
member trust loss
staff execution penalty
fan confusion
schedule inefficiency
cash risk
```

Hard blocks should only exist where the strategy is impossible for the group's scale, roster, contract situation or calendar.

### Strategy Presets

| Preset | Sample | Meaning |
|---|---|---|
| `mature_ip_sustain` | `=LOVE` | Stable fixed-roster IP, online/release monetization, media, concerts. |
| `generational_renewal` | `Nogizaka46` | Audition generations, selection balance, succession and brand continuity. |
| `high_frequency_growth` | `iLiFE!` | Frequent lives, post-live tokutenkai, rapid growth, fatigue risk. |
| `awareness_conversion_push` | `Takamine no Nadeshiko` | Convert public/content awareness into otaku/core support. |
| `veteran_rebuild` | `Akishibu project` | Rebuild lost core demand and member equity. |
| `direct_monetization_underground` | `Jams Collection` | Live, merch, birthday events, tokutenkai/direct core economy. |
| `emotional_reboot` | `Kirameki Unforent` | Reboot story, trust, protected off-days, narrative recruitment. |

Unresearched groups should receive presets by tier and known traits.

## 2. Fan Layer System

Use three main engagement layers:

```text
Public -> Otaku -> Core
```

| Layer | Meaning | Main value |
|---|---|---|
| Public | Broad recognition from songs, media, viral clips, brand image. | Reach and future conversion pool. |
| Otaku | Idol-scene audience that attends lives/festivals and compares groups. | Attendance and repeat potential. |
| Core | Oshi-attached repeat supporters and spenders. | Revenue, stability, social proof, member equity. |

Review source:

- `support/docs/fan-layer-system-design.md`

### Fan Demographics

Each layer should have demographic composition:

```text
gender: male / female / unknown
age: youth / young_adult / middle_plus
```

Use fallback order:

1. group-specific demographics override;
2. tier/layer default;
3. neutral placeholder.

Review sources:

- `support/docs/group-fan-demographics-review.csv`
- `support/docs/tier-fan-demographics-defaults.csv`

### Fan State

```ts
interface GroupAudienceState {
  group_uid: string;
  public_fans: number;
  otaku_fans: number;
  core_fans: number;
  public_trust: number;
  otaku_trust: number;
  core_trust: number;
  public_heat: number;
  otaku_heat: number;
  core_heat: number;
  gender_share: {
    male: number;
    female: number;
    unknown: number;
  };
  age_share: {
    youth: number;
    young_adult: number;
    middle_plus: number;
  };
}
```

Member-specific core state:

```ts
interface MemberAudienceState {
  idol_uid: string;
  group_uid: string;
  public_recognition: number;
  otaku_attention: number;
  core_fans: number;
  benefit_demand: number;
  benefit_utilization: number;
  oshi_loyalty: number;
  migration_likelihood: number;
}
```

## 3. Benefit Channel Model

Do not use one generic benefit-session value.

Separate:

| Channel | Best fit | Main effect |
|---|---|---|
| Online benefit | `=LOVE`, some `Takane`, major/release systems | Efficient revenue per member-hour, broad geographic access. |
| Shooting / handshake | `Nogizaka46`, major release-event systems | Physical release-event attachment and sales. |
| Post-live tokutenkai | `iLiFE!`, `Akishibu`, `Jams`, `Kirafore` | Immediate live -> oshi/core conversion and direct spending. |

Important corrections:

- `=LOVE` has `post_live_tokutenkai_emphasis = 0`.
- `Takamine no Nadeshiko` has `post_live_tokutenkai_emphasis = 0`.
- Their conversion should use online/release/content/member-identity channels, not underground post-live cheki.

## 4. Strategy Meeting System

The Strategy Meeting is the only normal place where strategy can be changed.

Before finalizing monthly strategy, show immediate stakeholder feedback. The meeting is a gameplay scene, not only a settings page.

Review source:

- `support/docs/group-strategy-meeting-signals-review.csv`
- `support/docs/financial-model-rebuild.md`

Each policy item receives:

```text
staff attitude
member attitude
fan attitude
comments
```

Scale:

```text
-3 strongly opposed
-2 opposed
-1 concerned
 0 neutral / mixed
+1 mildly supportive
+2 supportive
+3 strongly supportive
```

Example:

```text
iLiFE! post_live_tokutenkai_emphasis = 5
Staff: +3
Members: -3
Fans: +3
```

Meeting feedback should later become dynamic:

```text
base attitude from group strategy
+ delta from proposed change
+ current fatigue / cash / trust / fan demand / member condition
```

### Meeting Structure

The meeting should have four parts:

```text
1. Last month review
2. Draft strategy change
3. Stakeholder feedback
4. Final confirmation and lock
```

Last month review:

- audience movement: public / otaku / core;
- demographic movement;
- cash result and revenue mix;
- member fatigue, absences and morale;
- live report summary;
- strategy mismatch warnings.

Draft strategy change:

- edit strategy values;
- choose or keep preset;
- compare with last finalized strategy;
- show schedule projection.

Stakeholder feedback:

- staff attitude toward operational and financial feasibility;
- member attitude toward workload, fairness and exposure;
- fan survey attitude by public / otaku / core and demographics;
- warnings for large shifts and repeated reversals.

Final confirmation:

- lock the strategy for the month;
- generate or regenerate the detailed monthly calendar;
- preserve Today's live schedule and Live report notifications.

### Meeting Availability

Normal meeting:

```text
appears as blocking inbox event once per calendar month
recommended at month start
opens Strategy page directly on Meeting tab
blocks normal advance until finalization
locks again after finalization
```

Emergency meeting:

```text
available only when crisis flags exist
can change restricted policy items
creates trust / cost penalty unless justified by the crisis
```

Example emergency triggers:

- cash runway below threshold;
- major member injury or burnout;
- scandal / contract issue;
- graduation announcement;
- venue or release cancellation;
- sudden viral breakthrough requiring a campaign decision.

### Notification Entry Behavior

Strategy Meeting should mirror Today's live schedule:

```text
Today's live schedule
-> Start Live
-> Live Mode
-> End Live
-> Live report
```

Strategy equivalent:

```text
Monthly strategy meeting
-> Enter Meeting
-> Strategy page / Meeting tab
-> Finalize Strategy
-> Strategy Current / History update
```

The monthly meeting notification should not be cleared by opening it. It clears only when the player finalizes the strategy. If the player exits the page, the blocker remains active and the advance button continues to route back to the meeting.

### Fan Survey Should Be Segment Aware

Examples:

```text
Youth public: +2
"Short-video content is spreading, but many still do not know the members' names."
```

```text
Male core: -2
"Reducing tokutenkai access will hurt the current spending base."
```

```text
Female public: +2
"Styling and member content are attracting casual interest."
```

## 5. Schedule Generation

Detailed schedule should be generated from strategy, not hand-edited as the default loop.

The player can still override details, but the primary action is strategy.

```text
strategy values
-> frequency restrictions
-> event mix
-> benefit channel selection
-> rest blocks
-> training/rehearsal allocation
-> media/content blocks
-> generated calendar
```

### Frequency Restrictions

Live frequency should be capped by:

- tier;
- group archetype;
- member count;
- average condition;
- student/minor/external load;
- official schedule load;
- staff capacity;
- rest policy;
- current fan demand;
- cash.

Examples:

- `=LOVE`: cannot become underground taiban grind by default.
- `Nogizaka46`: frequency is release/tour/media driven, not post-live cheki driven.
- `iLiFE!`: can push aggressive frequency, but illness/absence risk rises sharply.
- `Takane`: adding lives alone should not solve conversion.
- `Akishibu`: can use moderate-high underground frequency, but weak utilization and member equity limit returns.

## 6. Finance Model

The finance model should be updated around revenue channels, not generic income buckets.

Design source:

- `support/docs/financial-model-rebuild.md`

### Revenue Channels

```text
live tickets
live goods
post-live tokutenkai
online benefits
shooting / handshake release events
physical release sales
digital / streaming
media appearances
commercial / IP
fanclub
birthday specials
```

### Expense Channels

```text
member compensation
member sales share
staff payroll
venue cost
live operations
benefit operations
media operations
production cost
goods cost
office/admin
promotion
scouting
crisis PR
```

The existing web model should remain compatible:

```text
live_tickets -> live ticket revenue
live_goods -> live goods revenue
tokutenkai_revenue -> post-live tokutenkai revenue
media -> media / commercial revenue
digital_sales, fan_meetings, goods -> legacy passive buckets to be phased into channel-specific revenue
```

The key new finance concept is:

```text
revenue / member-hour
```

This distinguishes:

- `=LOVE`: high-efficiency release/online benefit revenue.
- `Nogizaka46`: major release/physical-event/commercial system.
- `iLiFE!`: frequent live and post-live tokutenkai cash, high fatigue.
- `Takamine no Nadeshiko`: public reach that may not monetize unless conversion channels exist.
- `Akishibu project`: veteran direct fan economy rebuild.
- `Jams Collection`: strong direct monetization despite weaker CD proxy.

## 7. Fan Conversion Equations

Use simple first-pass formulas.

### Public Gain

Driven by:

- media/IP emphasis;
- viral music/content;
- production investment;
- public demographic fit;
- public heat.

```text
public_gain =
  media_reach
  + viral_reach
  + production_signal
  * public_demographic_fit
```

### Public -> Otaku

Driven by:

- accessible lives;
- event placement;
- clear calendar;
- price fit;
- member identity;
- trust.

```text
public_to_otaku =
  public_fans
  * entry_rate
  * event_access
  * trust_modifier
  * demographic_fit
```

### Otaku -> Core

Driven by:

- benefit-channel fit;
- member exposure;
- repeated live quality;
- birthday/member events;
- fanclub/member content;
- core trust.

```text
otaku_to_core =
  otaku_fans
  * relationship_access
  * member_charm
  * event_satisfaction
  * core_trust_modifier
```

### Core Monetization

Driven by:

- core fans;
- member-specific demand;
- benefit capacity;
- goods/release availability;
- price tolerance;
- trust.

```text
core_revenue =
  ticket_repeat_revenue
  + benefit_revenue
  + goods_revenue
  + release_event_revenue
  + fanclub_revenue
```

## 8. Member Equity and Graduation

Member core fans are portable.

When a member leaves:

```text
member_core_fans
  -> stay_with_group
  -> follow_member
  -> become_casual
  -> churn
```

Modifiers:

- farewell handling;
- group trust;
- oshi loyalty;
- member role;
- replacement exposure;
- scandal/termination context.

This is essential for:

- `Akishibu project`;
- `Nogizaka46` graduation waves;
- any group with strong member-specific benefit demand.

## 9. UI Rebuild

Strategy should become its own dedicated page, similar to the Lives workspace, rather than living inside Schedule > Policy.

Detailed page design:

- `support/docs/strategy-review-page-design.md`
- `support/docs/admin-job-shrink-design.md`

Recommended main navigation item:

```text
Strategy
```

Recommended tabs:

```text
Current
Meeting
Projection
History
```

### New Strategy Review Page

Add a dedicated Strategy page with tabs:

```text
Current
Meeting
Projection
History
```

Current tab:

```text
This Month's Strategy
Preset
Live Load
Benefit Channels
Promotion Focus
Production Investment
Rest Protection
Member Exposure
```

During normal play this tab is read-only. Show an `Edit at next Strategy Meeting` affordance, not live sliders.

Projection tab:

```text
Projected Calendar Summary
Lives
Media/content blocks
Benefit sessions
Rest days
Rehearsal/training load
Expected fan movement
Expected cash pressure
Risk warnings
```

Meeting tab:

```text
Staff
Members
Fan survey
```

During normal play, the Meeting tab shows the latest meeting minutes and lock state. During the monthly meeting, it becomes interactive feedback on the draft changes.

History tab:

```text
Past monthly strategies
Major changes
Stakeholder reactions
Actual outcome summary
```

Advanced Operations:

- existing per-member SNS checkboxes;
- stream hours;
- training defaults;
- goods refill;
- prerecorded vocals.

These should be demoted from normal gameplay. Strategy generates the default operating plan; advanced operations exist for exceptions, compatibility and players who want the administrator layer.

### Shrink Other Admin Jobs

Monthly strategy should absorb routine policy direction.

```text
Strategy
-> generated operations plan
-> detailed schedule / training / goods defaults
-> player handles only exceptions
```

Keep:

- live scheduling and live report review;
- member health/rest exceptions;
- focused member development;
- goods production/inventory decisions;
- scouting/audition and roster decisions;
- crisis decisions.

Shrink or hide:

- always-editable policy sliders;
- generic tokutenkai/goods on-off defaults;
- per-member SNS platform checkboxes;
- stream-hour weekly tuning;
- default training sliders;
- prerecorded vocal toggles;
- auto-refill quantity tuning.

Routine admin problems should become page warnings with focused actions, not frequent inbox notifications.

### Lives Page Simplification

Combine `New Live` and scheduled-live modification into one `Arrange` editor.

At the top of the editor, use a selector:

```text
New live
Duplicate from upcoming live
Upcoming live to modify
```

Duplicating an upcoming live should copy the useful template details but clear date/time fields so the player must intentionally choose a new slot.

Clear on duplicate:

- date;
- start/end time;
- rehearsal time;
- tokutenkai time;
- venue booking hold / external schedule uid;
- played/result state;
- notification dedupe state.

Keep on duplicate:

- live type;
- title template;
- venue preference;
- ticket/VIP settings;
- setlist/program;
- benefit/goods settings.

Recommended Lives tabs:

```text
Arrange
Upcoming
Reports
Festival
League
```

Schedule shortcut:

```text
double-click scheduled live on calendar
-> Lives / Arrange
-> selected live loaded for modification
```

Double-clicking empty calendar space can continue to focus the week. The direct modification shortcut should belong to the scheduled live item/pill.

### New Fans / Audience Panel

Show:

- Public / Otaku / Core counts;
- gender/age composition;
- trust by layer;
- heat by layer;
- member core fan table;
- benefit utilization;
- conversion leaks;
- fan survey diagnostics.

Example diagnostics:

```text
Public is growing, but otaku conversion is weak.
Core demand is concentrated in two members.
Middle-plus core has high price tolerance but low trust after recent absences.
Female youth public is responding to short videos, but live attendance remains low.
```

## 10. Implementation Phases

### Phase 1: Data and State

- Add `GroupStrategy`.
- Add `GroupAudienceState`.
- Add `MemberAudienceState`.
- Load group-specific strategy/demographic overrides from review data.
- Add tier fallback demographics.

### Phase 2: Strategy Meeting UI

- Add dedicated `Strategy` page with `Current`, `Meeting`, `Projection` and `History` tabs.
- Seed monthly Strategy Meeting as a blocking inbox event.
- Route the notification action to the dedicated Strategy page, Meeting tab.
- Show finalized current strategy as read-only during normal play.
- Open editable draft strategy only during the monthly Strategy Meeting.
- Show static meeting signals from review CSV.
- Show generated schedule summary.
- Finalize and lock strategy for month, then clear the blocking notification.
- Keep latest meeting minutes visible after the meeting.
- Demote Schedule > Policy controls into Advanced Operations.

### Phase 3: Schedule Generator

- Connect `GroupStrategy` to monthly live scheduler.
- Generate event mix from policy.
- Add rest blocks and benefit-channel defaults.
- Generate routine operations defaults from finalized strategy.
- Keep existing detailed schedule override.

### Phase 4: Fan Simulation

- Apply public/otaku/core movement after lives, media, releases and benefits.
- Add member benefit utilization.
- Add trust/heat decay.
- Update live reports with fan-layer changes.

### Phase 5: Finance Channel Split

- Preserve existing `DailyBreakdown` fields.
- Add optional channel-specific ledger fields.
- Split online benefit, shooting/handshake and post-live tokutenkai revenue.
- Add member-hour accounting.
- Show revenue mix and cash runway in strategy projections.

### Phase 6: Dynamic Meeting Signals

- Replace static attitude rows with computed feedback.
- Use current fatigue, cash, fan demand, demographic composition and trust.

## 11. Minimal Viable Rebuild

The smallest valuable version:

1. Add group/tier default demographics.
2. Add group strategy presets.
3. Add dedicated `Strategy` page with read-only `Current` tab.
4. Add monthly blocking Strategy Meeting notification.
5. Route `Enter Meeting` to `Strategy > Meeting`.
6. Let draft strategy be changed only inside that meeting.
7. Clear the blocker only after finalization.
8. Demote old policy/admin controls to Advanced Operations.
9. Do not yet rewrite all simulation.
10. Use finalized strategy to influence auto-booked live count, benefit-channel defaults and rest warnings.
11. Add a read-only Audience panel showing seeded public/otaku/core demographics.

This shifts the game feel immediately from:

```text
react to notification
```

to:

```text
set organizational direction and read consequences
```

without discarding the existing realistic calendar and live report system.
