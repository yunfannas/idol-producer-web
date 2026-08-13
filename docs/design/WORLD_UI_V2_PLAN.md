# Idol Producer — World UI / Session UI v2

Status: design specification / implementation plan

## 1. Design goals

The UI should stop behaving like a collection of management tabs. The player should always understand three things: **where the producer is, what is happening around them, and what they are currently focusing on**.

Core rules:

- **Top = global menu, date/time, phone notifications, and Next.**
- **Left = current physical world/location.**
- **Right = current focus.**
- **Pages show state; sessions change state.**
- Player decisions pause game time.
- Completed actions consume producer time by resolving and jumping the clock.
- Default playback is `1x`; do not add 2x/4x RTS-style speed controls.
- **Next means advance until the next meaningful phone notification.**
- The player may always move proactively instead of waiting for Next.
- Do not build an RTS or a free-form building game.
- Animation time is presentation time, not simulation time.

## 2. Standard viewport

Primary desktop reference: **1920×1080, 16:9**.

Mobile reference: **1080×1920, 9:16**. Mobile should stack Focus and World rather than squeeze the desktop columns.

Desktop skeleton:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ☰  Group Name       Oct 14 Mon · 15:32 ▼       📱 2      ▶ 1×      NEXT │
├────────────────────────────┬───────────────────────────────────────────────┤
│                            │                                               │
│       WORLD MAP            │                 FOCUS VIEW                    │
│        ~35–38%             │                  ~62–65%                      │
│                            │                                               │
│ current complex            │ producer room / member / rehearsal / live    │
│ producer presence          │ tokutenkai / meeting / recording / archive   │
│ members + staff            │                                               │
│ current activity           │                                               │
│                            │                                               │
└────────────────────────────┴───────────────────────────────────────────────┘
```

There is **no traditional HOME / MEMBERS / TRAINING / LIVE tab bar**.

## 3. Top bar and calendar

The top bar is persistent in every location. It contains only global context and time controls:

```text
☰   Group Name      OCT 14 MON · 15:32 ▼      📱 2      ▶ 1×      NEXT
```

Clicking the date/time expands the calendar directly from the top bar. Calendar is global and is **not a physical object on the office wall**.

Example compact calendar overlay:

```text
                    OCT 14 MON · 15:32
                           ▲
                 ┌──────────────────────┐
                 │ TODAY                │
                 │ 14:00 Rehearsal      │
                 │       Studio A       │
                 │ 18:30 Taiban         │
                 │       Shibuya        │
                 │ ──────────────────── │
                 │ Tomorrow             │
                 │ 13:00 Recording      │
                 │ [Full Calendar]      │
                 └──────────────────────┘
```

Calendar means **known future**. It does not own time progression; the phone/notification pipeline does.

## 4. Landing page

After loading a save, the player enters the **Producer Room** directly.

Left: simplified dollhouse-style map of the current agency/base.

Right: front-facing Producer desk and computer. The computer occupies most of the usable focus area. Only corners/edges of the Current Member Wall and History Cabinet need to be visible in the room background; clicking either object zooms into it.

```text
┌──────── SMALL AGENCY ──────┬──────────────── PRODUCER ROOM ───────────────┐
│                            │                                              │
│ Producer Room              │ CURRENT MEMBER WALL          HISTORY CABINET│
│ ┌───────────────────────┐  │   [photo][photo]...             [files]...  │
│ │ P                     │  │       (partial)                  (partial)   │
│ └───────────────────────┘  │                                              │
│                            │             ┌──────────────────────┐         │
│ Staff Room                 │             │                      │         │
│ ┌───────────────┐          │             │       COMPUTER       │         │
│ │ □  □          │          │             │                      │         │
│ └───────────────┘          │             │  large icon launcher │         │
│                            │             └──────────────────────┘         │
│ Practice Studio            │                    keyboard                  │
│ ┌───────────────────────┐  │ ─────────────────── desk ──────────────────  │
│ │ ● ● ● ● ●            │  │                                              │
│ └───────────────────────┘  │                                              │
└────────────────────────────┴──────────────────────────────────────────────┘
```

Landing should be visually quiet. Do not dump fan counts, radar charts, finance charts, rank meters, etc. onto the room itself.

The Producer Room has **day and night background variants** with identical geometry/hitboxes. Other normal indoor rooms may remain visually unchanged across day/night if they have no windows.

## 5. Producer computer

The monitor is the primary entry point for database/administrative information that does not naturally belong to a physical session.

Large icon launcher, approximately 2 rows × 4 columns on desktop:

```text
┌─────────────────────────────────────────────────────────┐
│ IDOL PRODUCER                              mail / alerts │
│                                                         │
│ [ ALL GROUPS ] [ ALL IDOLS ] [ AUDITION ] [ SCHEDULE ] │
│                                                         │
│ [   STAFF    ] [  RELEASE  ] [ FINANCE  ] [ REPORTS  ] │
│                                                         │
│ Small contextual reminder / urgent item only            │
└─────────────────────────────────────────────────────────┘
```

Candidate functions:

- All Groups — browse every group in the simulation.
- All Idols — browse/search idols, including external idols where appropriate.
- Audition — recruitment/audition management.
- Schedule — detailed schedule/database view; global calendar remains accessible from the top bar.
- Staff — staff information/workload.
- Release — songs/releases/media information.
- Finance — finance and business information.
- Reports — simulation reports and historical operational data.

The computer is primarily an **information/work tool**, not a universal action menu. Actions that logically require a meeting, rehearsal, recording session, live venue, or member conversation should happen in that session.

## 6. Current Member Wall

Current members are represented visually in the Producer Room. From the normal landing camera only part of the wall needs to be visible.

Click wall → zoom to full wall. Click portrait → member focus.

```text
CURRENT MEMBERS

[portrait] [portrait] [portrait]
  name       name       name

[portrait] [portrait] [portrait]
  name       name       name
```

Member profile is mainly informational. Avoid global instant-edit buttons for formation, training plan, career role, etc.

AKB/theater-type organizations can place the same logical Member Wall at/near the theater rather than inside a conventional agency office. The component/data model remains the same; the physical representation changes.

## 7. History Cabinet and memorabilia

Past history uses files, not a former-member photo wall.

Three concepts must remain separate:

- **Current Member Wall** = people now; portraits.
- **History Cabinet** = complete past; files.
- **Memorabilia / Discography display** = selected achievements; physical objects.

### Former member files

The outside of each file shows **name only**.

```text
FORMER MEMBERS
│ RANA │ RIRI │ MIO │ YUNA │ AIRI │ MIKU │ ...
```

Clicking a name opens the historical member record with join/graduation dates, historical roles, releases, important lives, career timeline, etc.

### Year files

Every simulated year gets one archive file:

```text
YEAR ARCHIVE
│ 2026 │ 2027 │ 2028 │ 2029 │ 2030 │ ...
```

A Year File is a historical snapshot + index, not merely an event list. It should preserve that year's membership, releases, important performances, staff/organization changes, fan/business summary, and notable events.

Historical snapshots should be immutable: opening 2028 in 2035 should show the 2028 state, not current values with an old date attached.

### Memorabilia

Only meaningful milestones are physically displayed: debut release, important singles/albums, first one-man, major sold-out live, first/important TIF appearance, major debut, anniversary, major venue, award, etc. Routine taiban lives remain in the archive but do not occupy wall space.

## 8. Location complexes and movement

No free-form construction. Use standardized agency archetypes such as Micro / Small / Medium / Large / Major.

The left map is a readable dollhouse schematic, not an architectural simulator.

A **Location Complex** contains one or more freely selectable zones/rooms.

Examples:

```text
Agency Complex
├── Producer Room
├── Staff Room
├── Meeting Room
├── Practice Studio
└── Recording Room

Live Venue Complex
├── Stage
├── Backstage
├── Audience Area
├── Tokutenkai
└── Lobby / Merch
```

### Movement inside one complex

- **Zero simulation-time cost.**
- Click another room/zone → switch producer presence and focus immediately.
- A short visual transition is fine, but do not advance game time.
- No hallway/elevator/path micro-management.

This includes movement within a live venue: Stage ↔ Backstage ↔ Tokutenkai is free.

### Movement between complexes

- Travel time exists only between distinct external locations/complexes.
- `Go` / `Leave now` resolves travel and jumps directly to arrival.
- Do not play travel in real time.
- The player may proactively travel to any available destination, including a live where their own group is not performing.

When away from the office, the phone always offers a lightweight **Return to Office** action.

## 9. Unified notification / assistant phone system

All routine game notifications should be integrated into one **Assistant Phone** pipeline. Do not maintain separate popup systems for scandals, calendar blockers, staff issues, audition notices, etc.

Top-right example:

```text
Oct 14 Mon · 15:32      📱 3      ▶ 1×      NEXT
```

Clicking the phone expands a tray under the top bar:

```text
┌────────────────────────────────────┐
│ ASSISTANT                          │
│                                    │
│ 15:28 Rana's queue is still        │
│       growing.                     │
│       [Handle] [Go there]          │
│                                    │
│ 15:14 Casting offer for Mio        │
│       received.                    │
│       [Review]                     │
│                                    │
│ 14:52 Studio B rehearsal delayed.  │
│       [Reply] [Delegate]           │
└────────────────────────────────────┘
```

A notification may expose only the actions that make sense:

- **Reply** — answer a simple question directly on the phone.
- **Review** — open a related data/focus panel.
- **Delegate** — leave it to staff.
- **Go** — switch/travel to the relevant location.
- **Call Meeting** — create/enter a meeting session when the issue is too complex for a reply.

Simple problems should not force the player to travel. Examples: approve a minor appearance request, accept a studio substitution, confirm a small staff recommendation.

Replies should resolve inline and fade into notification history. Avoid extra “SUCCESS” result popups.

### Notification interruption levels

Internally distinguish at least:

- `SILENT` — log/history only.
- `INFO` — appears in phone history but does not stop Next.
- `ACTIONABLE` — stops Next and is presented to the player.
- `REQUIRED` — must be resolved/acknowledged before continuing.
- `URGENT` — immediately interrupts current flow and auto-pauses.

Do not stop the game for trivial simulation updates such as tiny stat changes or routine staff completion.

### Crisis / scandal integration

Major scandals are phone notifications first, not standalone AVG-style event screens.

Example:

```text
📱 Assistant · URGENT

A post involving Member A is spreading
rapidly on social media.

[Review]
[Call Emergency Meeting]
```

The phone provides the alert and routing. The actual crisis handling happens through review/investigation and one or more meeting sessions. Future crisis refactor should follow:

**Incident → applicable baseline/rule → evidence → phone alert → staff assessment → meeting → decision → follow-up notifications**.

## 10. Time model and Next

The normal controls are:

- `▶ 1×` — observe the current world/session.
- `NEXT` — advance simulation until the next meaningful phone notification.

Do not use 2x/4x speed controls as a core mechanic.

Internal engine states:

```text
FLOW
  ↓
DECISION_PAUSED
  ↓
RESOLVE
  ↓
FLOW
```

When a problem/decision is presented, simulation time freezes. The player can inspect information for any amount of real time. When an action is chosen, calculate its producer-time cost and jump the simulation clock to completion.

Example:

```text
15:43  formation problem → PAUSE
player chooses "change route — ~15 min"
15:43 → resolve simulation → 15:58
resume FLOW
```

`NEXT` still simulates the skipped interval. If an actionable/required/urgent notification is generated at 15:47, stop at 15:47. Silent/info changes do not stop Next.

Calendar events do not themselves have to be the stopping primitive. Instead, the notification system can generate useful prompts such as “time to leave for the venue,” “rehearsal is about to begin,” etc.

The player can always ignore Next and move proactively.

## 11. Daily loop and overnight reset

The office is the daily home anchor.

Typical loop:

```text
08:00 Producer Room
      │
      ├── NEXT → next meaningful phone notification
      ├── proactively move to another room/location
      ├── use computer / member wall / archive
      └── attend sessions
             ↓
          End Day
             ↓
      Overnight simulation
             ↓
08:00 Producer Room
```

When the day is over, **regardless of the producer's current location**, overnight transition jumps directly to the next day at **08:00 in the Producer Room**.

Do not simulate home, sleep, commute, or the trip back from the previous venue.

Overnight can resolve daily aggregation, fatigue recovery, finances, SNS/media developments, external-group simulation, staff progress, and next-day preparation. Any important overnight developments should appear as morning phone notifications rather than separate popups.

## 12. Rehearsal session

Rehearsal should be the first full vertical slice because it validates location + session + focus without venue/fan complexity.

Left map shows producer and members in Practice Studio. Right focus shows current song/section and a simplified front formation/performance view.

```text
LEFT / PRACTICE STUDIO           RIGHT / REHEARSAL

MIRROR                            Song A — Chorus
────────────────────              ●     ●
 ●       ●                           ● ●
    ● ●                           ●     ●
 ●       ●
 □ Choreographer                  Current focus:
 P Producer                       Formation transition
```

Formation changes and detailed training planning belong here (or in an appropriate meeting), not as global instant edits on a Training page.

Small groups should normally make producer presence at rehearsal useful: members can raise issues directly and problems can be resolved on the spot. Producer attendance should not be a flat buff; its value is access to immediate observation and decision opportunities.

One-man rehearsal uses the **same Rehearsal Session** at the live venue rather than a separate system.

## 13. Venue system

All live maps share one renderer/data model. Four baseline venue archetypes:

1. **Small Indoor Venue**
2. **Hall**
3. **Stadium / Arena**
4. **Outdoor Venue**

These are not four separate gameplay systems. They differ mainly in layout template, crowd rendering LOD, backstage structure, booth arrangement, and visual assets.

Common conceptual model:

```text
VenueComplex
├── archetype
├── zones[]
├── stages[]
├── booths[]
├── crowdAreas[]
└── occupants / sessions
```

### 13.1 Small Indoor Venue

Primary live-idol/taiban archetype. Compact, low ceiling, small backstage, audience close to stage, tokutenkai/merch nearby or reusing the audience floor after the live.

```text
┌──────────────────────────────┐
│ BACKSTAGE                    │
│  A      OUR      C           │
│          │                   │
│       ┌──▼───┐               │
│       │STAGE │               │
│       └──────┘               │
│     ○○○○○○○○○○               │
│     ○○○○○○○○○○               │
│        AUDIENCE              │
│                              │
│ TOKUTENKAI / MERCH           │
│ [A] [B] [OUR] [C]            │
└──────────────────────────────┘
```

This is the first venue archetype to implement because it validates Stage + Backstage + Crowd + Tokutenkai + Other Groups.

### 13.2 Hall

Formal theater/concert-hall archetype with clear seated audience sections, larger backstage corridors/dressing rooms, FOH, and lobby/merch. Empty seats should visually communicate attendance without requiring a large dashboard number.

### 13.3 Stadium / Arena

Large-scale archetype with highly aggregated crowd rendering, audience blocks, floor audience, main stage, optional runway/B-stage, large backstage/production areas, concourse/merch.

Do not attempt one visual sprite per attendee; use density rendering/representative sprites.

### 13.4 Outdoor Venue

**Single outdoor venue by default**, not a festival container. One primary outdoor stage, audience field, backstage tents/containers, and optional tokutenkai/merch area.

Outdoor should visibly support day/night/weather presentation where useful.

```text
┌──────────────────────────────┐
│ BACKSTAGE / TENTS            │
│                              │
│       ┌──────────┐           │
│       │  STAGE   │           │
│       └──────────┘           │
│                              │
│      ○ ○ ○ ○ ○ ○             │
│    ○ ○ ○ ○ ○ ○ ○ ○           │
│       AUDIENCE FIELD         │
│                              │
│ TOKUTENKAI / MERCH           │
│ [A] [B] [OUR] [C]            │
└──────────────────────────────┘
```

## 14. Festival container

Festival is **not a fifth venue archetype**. It is a thin event container holding multiple ordinary venues, potentially mixing types (for example outdoor stages plus indoor venues/halls).

Festival UI should remain extremely simple:

```text
             TIF 2026

        ‹   HOT STAGE ▼   ›

┌──────────────────────────────┐
│      CURRENT VENUE MAP       │
└──────────────────────────────┘
```

- Left arrow: previous venue.
- Right arrow: next venue.
- Click venue name: dropdown to jump directly to a selected venue.
- Switching venues inside the same festival is **0 simulation-time cost**.

The dropdown should show **each venue's current and next scheduled act** plus venue type, but not hidden scouting data such as real-time crowd size.

Example:

```text
SELECT VENUE

HOT STAGE · Outdoor
NOW   Group A
NEXT  Group B · 16:20

SKY STAGE · Outdoor
NOW   Group C
NEXT  Group D · 16:15

DOLL FACTORY · Small Indoor
NOW   Group E
NEXT  OUR GROUP · 16:35

HEAT GARAGE · Hall
NOW   Changeover
NEXT  Group F · 16:25
```

Use stable venue order so left/right navigation and dropdown order agree.

Festival tells the player **where something is happening**; the actual venue map tells them **what it looks like there**.

## 15. Taiban observation

At a taiban, other groups should be visible in the venue. This is a core onboarding tool for players unfamiliar with idol culture.

The map and live focus should let the player observe:

- different groups rotating through the stage;
- audience density changing by act;
- fan flow after a performance;
- other groups' tokutenkai booths/queues;
- backstage presence where appropriate.

Do not immediately expose precise hidden values for other groups. Observation should provide the world first; detailed knowledge can improve internally over time.

## 16. Tokutenkai LOD

Do not attempt to show 3–4 groups × 7–9 member queues simultaneously.

Use three levels:

1. Venue overview — group booths and approximate crowd density.
2. Booth focus — 7–9 member queues for one group.
3. Member focus — cheki/sign/talk loop and member-specific condition.

```text
VENUE OVERVIEW
[Group A ●●●●] [Group B ●●]
[OUR     ●●●●●●●] [Group D ●●●]

        ↓ click OUR

OUR GROUP
Rana  ●●●●●●●▓▓→
Riri  ●●●
Mio   ●●●●●
...

        ↓ click Rana

RANA
fan → cheki → sign → talk → next fan
```

Fan simulation can use aggregate populations with representative sprites; do not require every fan to be a heavyweight individual agent.

## 17. Backstage and conversation

Backstage visually shows members resting, drinking, using phones, talking with staff, etc. After live/tokutenkai, clicking a member creates a natural conversation opportunity.

Conversation topics are contextual: today's live, fan response, center/featured role, training, career, pending concern, general check-in.

Conversation freezes time while the player chooses; completion resolves an abstract duration and jumps the clock.

For small groups, direct backstage/rehearsal interaction should be common. As organizations grow, more issues should reach the producer through staff/assistant phone notifications instead.

## 18. Recording and meeting

Both reuse the same World + Focus + Session architecture.

Recording left side: booth/control room/waiting area. Right side: song, member, part, take, lightweight recording visualization.

Meeting left side: meeting room and participants. Right side: agenda and decisions.

Long-term migration targets for Meeting/Session context include:

- training plan
- career role
- promotion plan
- new costume
- operating/group rules
- staff responsibility
- release planning
- crisis/scandal handling

## 19. Loading/title background

The title/loading visual is a **fixed background image**, not an interactive room.

Composition:

- small windowless rehearsal studio, side view;
- long barre;
- mirror;
- one generic idol poster on the left;
- black folding chair shifted to the right foreground;
- white towel draped over chair back;
- straw water bottle nearby;
- no other clutter.

The background itself should contain no title/menu text. The game overlays the real `idol-producer-logo.png` and menu options at runtime. The towel should remain blank in the generated background unless the real logo is composited deterministically in code/image editing rather than regenerated by an image model.

## 20. Implementation milestones

### M1 — World Shell

- persistent top bar
- 35/65-ish World/Focus shell
- simplified Base map
- ProducerPresence
- member/staff placement
- Producer Room landing
- computer icon launcher
- Current Member Wall entry
- History Cabinet entry
- top-bar calendar overlay
- keep existing gameplay available while migration begins

### M2 — Notification / Time / Movement Foundation

- unified Assistant Phone tray
- notification severity/interruption model
- direct Reply / Review / Delegate / Go / Call Meeting routing
- replace old notification/event-blocker paths gradually with unified phone pipeline
- `FLOW / DECISION_PAUSED / RESOLVE`
- zero-time movement within one Location Complex
- external travel between complexes
- `1× / NEXT`
- Next stops at next actionable/required/urgent notification
- proactive travel / Return to Office
- overnight reset to next day 08:00 Producer Room

### M3 — Rehearsal vertical slice

- Practice Studio
- placeholder chibi sprites
- simplified rehearsal/performance visualization
- formation integration
- contextual rehearsal issues
- post-rehearsal interactions

### M4 — Small Indoor Venue / Taiban

- Small Indoor Venue map
- stage
- taiban timeline
- other groups
- existing live presentation embedded in Focus
- backstage
- simple audience aggregation

### M5 — Tokutenkai / Fan World

- parallel group booths
- booth/member LOD
- queues
- fan aggregation/flow
- tokutenkai rule integration
- member interactions

### M6 — Additional Venue Archetypes / Festival

- Hall
- Stadium / Arena
- Outdoor Venue
- festival container
- previous/next venue arrows
- venue dropdown with NOW/NEXT schedule
- mixed venue archetypes inside one festival

### M7 — Management in Context

- Meeting
- Recording
- contextual conversation
- staff delegation
- crisis/scandal meeting flow
- migrate global instant-edit controls into sessions

### M8 — History and visual polish

- Year Files
- Former Member Files
- memorabilia/discography objects
- long-term office historical accumulation
- day/night Producer Room backgrounds
- hair/costume system
- final chibi art and animation set

## 21. Implementation guardrails

- Do not implement a building game.
- Do not implement RTS controls.
- Do not make animation time equal simulation time.
- Do not charge time for moving between rooms/zones inside one complex.
- Do not remove an existing gameplay function until its replacement exists.
- Do not turn the World Map into a numerical dashboard.
- Do not make staff dialogue the primary tutorial mechanism.
- Do not use scripted AVG-style events as a substitute for routine simulation.
- Do not create multiple competing notification systems; route notifications through the Assistant Phone.
- Do not force the player to travel for simple issues that can reasonably be answered remotely.
- The simulation creates situations; sessions expose them. Scripted events may dramatize exceptional situations but should not manufacture routine gameplay.

## 22. Reference mockups

The design branch should keep two visual references beside this document:

- `world-ui-v2-small-group-landing-preview.jpg` — target composition for the small-group landing page: top time bar, left agency map, right Producer Room with large computer launcher and partial Member Wall / History Cabinet.
- `title-rehearsal-room-background-preview.jpg` — fixed title/loading background: small rehearsal studio, one poster at left, long barre, mirror, chair at right with blank towel and straw bottle.

These are **composition references**, not final production assets. Exact text/logos generated inside concept art should not be treated as canonical UI assets; production UI should render real text and the repository's existing logo.