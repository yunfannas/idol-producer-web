# Idol Producer — World UI / Session UI v2

Status: design specification / implementation plan

## 1. Design goals

The UI should stop behaving like a collection of management tabs. The player should always understand three things: **where the producer is, what is happening around them, and what they are currently focusing on**.

Core rules:

- **Top = global menu and time.**
- **Left = current physical world/location.**
- **Right = current focus.**
- **Pages show state; sessions change state.**
- Player decisions pause game time.
- Completed actions consume producer time by resolving and jumping the clock.
- Default playback is `1x`; the only fast-forward control is `Jump to...`.
- Do not build an RTS or a free-form building game.
- Animation time is presentation time, not simulation time.

## 2. Standard viewport

Primary desktop reference: **1920×1080, 16:9**.

Mobile reference: **1080×1920, 9:16**. Mobile should stack Focus and World rather than squeeze the desktop columns.

Desktop skeleton:

```text
┌────────────────────────────────────────────────────────────────────────────┐
│ ☰  Group Name              Oct 14 Mon · 15:32 ▼       ▶ 1×   ⏭ Jump... │
├────────────────────────────┬───────────────────────────────────────────────┤
│                            │                                               │
│       WORLD MAP            │                 FOCUS VIEW                    │
│        ~35–38%             │                  ~62–65%                      │
│                            │                                               │
│ current location           │ producer room / member / rehearsal / live    │
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
☰   Group Name          OCT 14 MON · 15:32 ▼          ▶ 1×   ⏭ Jump to...
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
                 │ Leave by 17:48       │
                 │ ──────────────────── │
                 │ Tomorrow             │
                 │ 13:00 Recording      │
                 │ [Full Calendar]      │
                 └──────────────────────┘
```

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

## 8. Base map and movement

No free-form construction. Use standardized agency archetypes such as Micro / Small / Medium / Large / Major.

The map is a readable dollhouse schematic, not an architectural simulator.

Internal movement:

- Click another room → producer moves automatically.
- No confirmation dialog.
- Resolve a small abstract time cost (roughly 1–3 game minutes).
- Do not require hallway/elevator/path micro-management.

External movement:

- Calendar/event shows destination, travel time, and useful leave-by time.
- `Go` / `Leave now` resolves travel and jumps to arrival.
- Do not play travel in real time.

## 9. Time model

Only two normal controls are needed:

- `▶ 1×` — observe the world.
- `⏭ Jump to...` — advance to a meaningful point.

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

Jump must still simulate the skipped interval. If a truly player-required decision occurs at 15:47 while jumping to 17:00, stop at 15:47. Routine simulation changes should not interrupt.

## 10. Rehearsal session

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

## 11. Venue / taiban

When traveling to a live, the left map changes from Base to Venue while the top bar and right-focus logic remain unchanged.

Venue zones:

```text
BACKSTAGE
    │
STAGE
    │
TOKUTENKAI
```

Render them as a simple cute venue map, not literal tabs.

Click Stage → right side shows the existing/front live presentation.

Other groups at a taiban should be visible so a non-idol-fan player can understand the ecosystem by observation.

## 12. Tokutenkai LOD

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

## 13. Backstage and conversation

Backstage visually shows members resting, drinking, using phones, talking with staff, etc. After live/tokutenkai, clicking a member creates a natural conversation opportunity.

Conversation topics are contextual: today's live, fan response, center/featured role, training, career, pending concern, general check-in.

Conversation freezes time while the player chooses; completion resolves an abstract duration and jumps the clock.

## 14. Recording and meeting

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

## 15. Loading/title background

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

## 16. Implementation milestones

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

### M2 — World Time

- FLOW / DECISION_PAUSED / RESOLVE
- internal movement
- external travel
- `1×` / `Jump to...`
- jump interruption for required decisions
- action duration resolution

### M3 — Rehearsal vertical slice

- Practice Studio
- placeholder chibi sprites
- simplified rehearsal/performance visualization
- formation integration
- contextual rehearsal issues
- post-rehearsal interactions

### M4 — Venue

- venue map
- stage
- taiban timeline
- other groups
- existing live presentation embedded in Focus
- backstage

### M5 — Tokutenkai / Fan World

- parallel group booths
- booth/member LOD
- queues
- fan aggregation/flow
- tokutenkai rule integration
- member interactions

### M6 — Management in Context

- Meeting
- Recording
- contextual conversation
- staff delegation
- migrate global instant-edit controls into sessions

### M7 — History and visual polish

- Year Files
- Former Member Files
- memorabilia/discography objects
- long-term office historical accumulation
- hair/costume system
- final chibi art and animation set

## 17. Implementation guardrails

- Do not implement a building game.
- Do not implement RTS controls.
- Do not make animation time equal simulation time.
- Do not remove an existing gameplay function until its replacement exists.
- Do not turn the World Map into a numerical dashboard.
- Do not make staff dialogue the primary tutorial mechanism.
- Do not use scripted AVG-style events as a substitute for routine simulation.
- The simulation creates situations; sessions expose them. Scripted events may dramatize exceptional situations but should not manufacture routine gameplay.

## 18. Reference mockups

The design branch should keep two visual references beside this document:

- `world-ui-v2-small-group-landing-preview.jpg` — target composition for the small-group landing page: top time bar, left agency map, right Producer Room with large computer launcher and partial Member Wall / History Cabinet.
- `title-rehearsal-room-background-preview.jpg` — fixed title/loading background: small rehearsal studio, one poster at left, long barre, mirror, chair at right with blank towel and straw bottle.

These are **composition references**, not final production assets. Exact text/logos generated inside concept art should not be treated as canonical UI assets; production UI should render real text and the repository's existing logo.