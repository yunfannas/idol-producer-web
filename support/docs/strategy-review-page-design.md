# Strategy Review Dedicated Page

## Purpose

Strategy should have a dedicated review page, similar to the Lives workspace.

The page is not a daily slider panel. During normal gameplay it is mainly a read-only review surface. It shows the current finalized strategy, why it was chosen, what calendar it generated and what consequences are appearing.

Strategy becomes editable only during the monthly Strategy Meeting.

The monthly Strategy Meeting should be opened by a blocking inbox event, similar to Today's live schedule. The player should not casually navigate into editing mode; the event is the formal invitation into the meeting scene.

## Navigation

Add a main navigation item:

```text
Strategy
```

Alternative labels:

```text
Strategy Review
Plan
Monthly Plan
```

Recommended label: `Strategy`.

Reason: it is short, high-level and distinct from detailed `Schedule`.

## Page Tabs

Mirror the dedicated structure of the Lives page.

```text
Current
Meeting
Projection
History
```

### Current

Read-only during normal play.

Shows:

- finalized strategy preset;
- policy values;
- lock status;
- next meeting date;
- current month schedule summary;
- latest staff/member/fan meeting minutes;
- current drift warnings;
- key fan, member and finance consequences.

This is the default tab during normal gameplay.

### Meeting

Editable only when the monthly meeting is open.

Shows:

- last month review;
- draft strategy controls;
- delta from current strategy;
- staff attitude;
- member attitude;
- fan survey attitude;
- schedule projection;
- finalization button.

When the meeting is locked, this tab shows:

```text
Next Strategy Meeting: YYYY-MM-DD
Current strategy is finalized for this month.
```

Emergency meeting access appears only when a crisis flag exists.

## Blocking Event Entry

Strategy Meeting should use the same player rhythm as live events:

```text
blocking inbox event appears
-> player clicks Enter Meeting
-> dedicated Strategy page opens on Meeting tab
-> player reviews / drafts / checks feedback
-> player finalizes
-> blocking event clears
-> normal advance resumes
```

Suggested inbox item:

```text
title: Monthly strategy meeting
category: strategy
sender: Staff Office
requires_ack: true
blocking: true
dedupe_key: strategy-meeting|group_uid|YYYY-MM
action_label: Enter Meeting
target_route: Strategy/Meeting
```

The notification should be generated once per month, preferably on the first playable day of the month. If the opening month starts mid-month, either skip the first meeting or schedule it for the next day after onboarding.

The blocking event should remain unresolved until the strategy is finalized. Merely opening the page should not clear it.

### Meeting Page State From Notification

When entered from the notification:

```text
nav = Strategy
strategy_tab = Meeting
meeting_id = strategy-meeting|group_uid|YYYY-MM
meeting_status = open
draft_strategy = copy(current_strategy)
```

If the player leaves the page before finalizing, the blocker remains active and the top-bar advance button should continue pointing back to the meeting.

After finalization:

```text
meeting_status = finalized
current_strategy = finalized draft
strategy_history append row
monthly projection generated
notification marked read / acknowledged
advance resumes
```

This mirrors live flow:

```text
Today's live schedule -> Start Live -> Live Mode -> End Live -> Live report
Monthly strategy meeting -> Enter Meeting -> Strategy Meeting page -> Finalize -> Strategy review/history
```

### Projection

Read-only preview of what the finalized strategy is producing.

Shows:

- expected live count;
- expected media/content blocks;
- expected benefit-channel mix;
- expected rest days;
- member workload pressure;
- revenue mix estimate;
- public / otaku / core movement estimate;
- risks.

This tab should be useful even after the meeting, because it tells the player what the strategy is supposed to do.

### History

Shows past strategy decisions.

Rows:

```text
month
preset
major policy changes
staff/member/fan attitude
actual result
notes
```

This makes strategy feel like an evolving producer record, not disposable monthly settings.

## Current Tab Layout

Top band:

```text
Group
Current month
Strategy preset
Lock state
Next meeting
```

Main review grid:

```text
Strategy Doctrine
Generated Schedule
Audience Movement
Finance Pressure
Member Condition
Warnings
```

Strategy Doctrine:

- live frequency;
- online benefit emphasis;
- shooting/handshake emphasis;
- post-live tokutenkai emphasis;
- media/IP emphasis;
- viral music/content emphasis;
- production investment;
- rest protection;
- roster renewal;
- member exposure policy.

Generated Schedule:

- lives this month;
- high-impact lives;
- benefit sessions by channel;
- media/content blocks;
- rehearsal/training blocks;
- rest days.

Audience Movement:

- public / otaku / core changes;
- demographic movement;
- trust and heat by layer;
- conversion leaks.

Finance Pressure:

- projected revenue;
- projected expense;
- revenue per member-hour;
- cash runway;
- dominant revenue channel.

Member Condition:

- average condition;
- fatigue risk;
- morale/trust;
- overused members;
- underexposed members.

Warnings:

- strategy mismatch;
- fan demand underutilized;
- member overload;
- cash pressure;
- schedule conflict;
- archetype plausibility warning.

## Meeting Tab Flow

```text
1. Review
2. Draft
3. Feedback
4. Finalize
```

Review:

- last month's intended strategy;
- actual results;
- what overperformed;
- what failed;
- what changed in audience/member/finance state.

Draft:

- choose preset or keep current;
- adjust allowed policy items;
- show delta badges beside each changed value.

Feedback:

- staff sees feasibility and cost;
- members see workload, fairness and exposure;
- fans see demand, trust and demographic reaction.

Finalize:

- confirms strategy;
- locks page until next month;
- triggers schedule generation.

## Controls

During Meeting only:

| Policy | Control |
|---|---|
| Preset | Select menu |
| Live frequency | Stepper or segmented scale 0-5 |
| Benefit channel emphasis | Three separate 0-5 steppers |
| Media/IP emphasis | Stepper 0-5 |
| Viral music/content | Stepper 0-5 |
| Production investment | Stepper 0-5 |
| Rest protection | Stepper 0-5 |
| Roster renewal | Stepper 0-5, disabled for groups where not plausible |
| Member exposure policy | Select menu |

Avoid free dragging sliders for normal strategy values. Steppers or segmented scales feel more deliberate and reduce min-max fiddling.

## Lock Rules

Normal state:

```text
current_strategy.status = finalized
controls disabled
current tab default
meeting tab locked
```

Meeting open:

```text
current_strategy.status = draft
controls enabled
feedback recalculates
finalize button enabled after required review
```

After finalization:

```text
current_strategy.status = finalized
strategy_history row added
monthly schedule projection generated
normal play resumes
```

Emergency meeting:

```text
requires crisis flag
limits editable controls to relevant areas
adds trust/cost penalty unless crisis justification applies
```

## Relationship To Notifications

Keep these as notifications:

- Monthly strategy meeting;
- Today's live schedule;
- Live report;
- major crisis decision.

Do not create daily strategy notifications.

Instead, strategy drift appears on the Strategy page as warnings:

```text
Core fans want more direct access than current strategy provides.
Members are tiring faster than the rest policy expected.
Public awareness is rising but otaku conversion is weak.
Cash result is below projection because benefit utilization is low.
```

## Minimal Implementation

First implementation can be mostly read-only:

1. Add `Strategy` nav item.
2. Render Current tab using group default strategy CSV data.
3. Seed a monthly blocking inbox event for Strategy Meeting.
4. Make `Enter Meeting` route to `Strategy > Meeting`.
5. Render Meeting tab as locked unless the monthly event is open.
6. Show placeholder feedback from meeting signal CSV.
7. Clear the blocker only after finalization.
8. Add History tab with empty state.
9. Do not yet wire full schedule generation.

This gives the player a dedicated mental home for strategy before the full ecosystem simulation is rebuilt.
