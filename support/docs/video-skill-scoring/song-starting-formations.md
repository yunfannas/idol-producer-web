# Song Starting Formations + Multi-Member Video Evaluation

Companion to [`../video-skill-scoring-plan.md`](../video-skill-scoring-plan.md) and [`phase0-dataset-audit.md`](./phase0-dataset-audit.md).

## 1. Problem

1. **Identity in live footage** is hard if we only score one idol at a time. Group lives show everyone; formation position at song start is a strong prior for “who is who,” especially with costume similarity and cuts.
2. **Live Mode today** (`src/ui/liveMode.ts`) builds one trapezoid formation from roster size + center role, and keeps it for the whole show. Real performances change opening positions per song.

## 2. Goal

Add **per-song starting formation** as shared catalog/game data that:

- seeds and validates member identity during video analysis of a full live song;
- drives the Live Mode stage layout when that song is the current program item;
- remains editable by the player/designer when a song has no authored formation yet.

Video evaluation should default to **all roster members present in the clip**, not a single target idol. Solo-focused jobs remain supported as a special case.

## 3. Data model

Store formations on the song (or a song×group overlay when the same track is shared). Prefer a compact slot list rather than free pixels in canonical data.

```ts
/** Normalized stage coords: x/y in 0–100, same space as Live Mode formationSlots. */
interface FormationSlot {
  slotIndex: number;       // stable left-to-right / back-to-front index in the layout template
  row: "front" | "back" | "mid";
  x: number;               // 0–100
  y: number;               // 0–100
  roleHint?: "center" | "left_end" | "right_end" | null;
}

interface SongStartingFormation {
  schemaVersion: "0.1";
  /** Layout template id, e.g. "trapezoid-n" matching formationSlots(n). */
  layoutId: string;
  memberCount: number;
  /**
   * Ordered assignment: index matches layout slot order from formationSlots(n).
   * Values are idol uids. Null = empty / understudy / unknown.
   */
  slotIdolUids: Array<string | null>;
  /** Optional overrides when a song uses non-default coordinates. */
  slotOverrides?: FormationSlot[];
  /** Provenance for video-derived or designer-authored layouts. */
  source: "manual" | "video_seed" | "imported" | "default_center";
  effectiveFrom?: string;  // ISO date if formation changed historically
  notes?: string;
}
```

Song row extension (conceptual):

```ts
interface SongRow {
  uid: string;
  // ...existing fields...
  /** Default starting formation for the owning group. */
  starting_formation?: SongStartingFormation | null;
  /**
   * Optional history when lineup/formation changed over time
   * (graduate, transfer, center change).
   */
  starting_formation_history?: SongStartingFormation[];
}
```

For Scenario 6 / managed play, unresolved songs fall back to today’s Live Mode logic: `orderMembersForFormation` + `formationSlots(n)`.

### Why slot indices, not only uids→xy

- Live Mode already thinks in discrete slots.
- Video ID can map “person standing at front-center at t=0” → `slotIndex` → `idolUid`.
- Player edits stay simple: drag members between slots.

## 4. Multi-member video evaluation

### Ideal source footage

For **starting-formation extract**, prefer **official dance practice / ダンス練習動画** over concert cams:

| Prefer | Why |
| --- | --- |
| Official dance practice (固定机位) | Full group in frame, stable camera, opening hold is readable |
| Same costume, front-facing | Easy member ID + stage-left/right mapping |
| Minimal cuts | One continuous opening formation |

Canonical example: [高嶺のなでしこ「可愛くてごめん」dance practice](https://www.youtube.com/watch?v=oB12TDu4dVE&list=PLwLByCxHoacSEug15PEVDZIRKdUPBg3fm&index=25).

Many practice videos are **mirrored (左右反転)** for learning — the in-game **From video** editor defaults Mirror X on when applying marks.

Concert / fan cams remain useful later for skill scoring, but are a poor first source for formation authoring.

### 4.1 Job scope

```ts
interface VideoAnalysisJob {
  // ...existing...
  mode: "single_idol" | "full_formation";
  songId?: string;
  groupUid?: string;
  /** Expected opening formation; required for full_formation when available. */
  startingFormation?: SongStartingFormation;
  /** Gallery: portraits for every slot idol + optional full roster. */
  rosterIdolIds: string[];
}
```

For `full_formation`:

1. Load song starting formation (or ask reviewer to place members once).
2. Build face gallery from portraits for all assigned uids (era-correct stills).
3. At `selectFrameSeconds` near song start / first chorus hold, detect people and match each detection to a formation slot by **position prior** (strong) + **face match** (confirm).
4. Manual fix: drag a wrong face onto the correct slot; that becomes an identity seed for the track.
5. Track all members through the song; emit per-idol feature records from the same clip.
6. Aggregate → suggested scores for every member with enough usable evidence.

### 4.2 Identity pipeline (formation-aware)

```text
Song starting formation + portraits
        |
        v
Keyframe near song start
        |
        +-- detect N bodies/faces
        +-- assign detections to slots by stage position
        +-- confirm / correct with face↔match + manual drag
        |
        v
Per-idol track IDs for the whole song
        |
        +-- vocal: solo segments attributed by mouth/line map when possible
        +-- dance: pose features per track
        |
        v
Per-idol analysis JSON (+ shared job metadata)
```

Position prior reduces lookalike errors: even if face confidence is mediocre, “front-center slot is center idol” is usually right at opening.

### 4.3 Output shape

One job → many idol results:

```json
{
  "schemaVersion": "0.1",
  "jobId": "…",
  "songId": "…",
  "formationUsed": { "layoutId": "trapezoid-9", "slotIdolUids": ["…"] },
  "members": [
    {
      "idolId": "…",
      "slotIndex": 4,
      "identityConfidence": 0.91,
      "usableDurationSeconds": 118.4,
      "features": { },
      "suggestions": { "singing": null, "dancing": null, "stamina": null, "singDanceStability": null }
    }
  ]
}
```

## 5. In-game Live Mode

### Current behavior

`buildLiveModeSession` assigns one `members: LiveModeMember[]` for the whole live.

### Proposed behavior

- Keep a **default show formation** (today’s algorithm) for MC/break and songs without data.
- When the current program item is a song with `starting_formation` (or a player override in the save), remap `members[].x/y` (and center flag from slot role) for that item.
- On song change, animate or snap to the new starting positions (simple lerp is enough for v1).
- Optional later: mid-song formation changes — **out of scope**; starting formation only.

Player override (save-side, not catalog):

```ts
save.managed_song_formations?: Record<songUid, SongStartingFormation>;
```

Catalog formation is the default; managed override wins during play.

### UI

- Live Mode stage already renders portraits on slots — reuse it.
- Add a lightweight “Formation” editor later (Songs / Making): assign roster members to slots for the selected song.
- Video review UI can write back a suggested formation when the reviewer accepts opening IDs.

## 6. How this helps video ID vs portraits alone

| Signal | Role |
| --- | --- |
| Portrait embedding | Confirm who a face is |
| Manual click/drag | Authoritative seed / correction |
| Starting formation | Prior on *where* each uid should appear at t≈0 |
| Tracking | Carry identity through motion and cuts |
| Roster constraint | Only match faces among expected members |

Formation does not replace portraits; it narrows candidates per region of the frame.

## 7. Implementation phases (formation track)

### F0 — Spec freeze

- Finalize `SongStartingFormation` schema.
- Document slot order convention for `formationSlots(n)` (must match Live Mode).
- Decide storage: song JSON field vs sidecar `song_formations.json` for bulk authoring.

**Done:** sidecar `public/data/song_starting_formations.json`; schema in `src/data/songStartingFormation.ts`.

### F1 — Live Mode consume + editor

- Resolve formation for current song item.
- Fall back to default layout when missing.
- In-game Formation button opens editor (manual + video mark).
- Standalone page at `/formation-editor` (or `formation-editor.html`).

**Status:** implemented (manual assign, video click marks → snap to slots, save to `managed_song_formations` / JSON download).

### F2 — Video job: full formation

- Accept formation + roster portraits.
- Opening-frame slot assignment + manual correction.
- Emit per-member features from one live URL/clip.

### F3 — Editor + writeback

- In-app slot editor. *(partially in F1)*
- Video review “accept opening IDs → save formation.”
- Optional history when roster changes.
- Auto face-match from portraits (future).

## 8. Open decisions

1. **Canonical storage:** sidecar vs inline on song rows?
2. **Understudy / absent members:** null slots vs separate `absentIdolUids`?
3. **Unit vs group songs / shuffle lives:** formation tied to `song_uid` only, or `song_uid + lineup_fingerprint`?
4. **Should auto-generated default formations be persisted** when the player never edits, or only computed at runtime?

## 9. Relation to idol identification plan

Portrait gallery + manual mark remain required. Starting formation is the third pillar:

1. portraits → who faces look like  
2. manual mark → ground truth when automation is unsure  
3. starting formation → where each member should be at song start (game + eval)

Evaluating **all members** on one live song is then the default path; single-idol jobs are for static vocal clips and edge cases.

## 10. Choreographic compatibility

The editor follows [Choreographic](https://www.choreographic.app/) conventions (free positions, multi-set timeline, audience at bottom). See [`choreographic-compatibility.md`](./choreographic-compatibility.md).

Full-length dance-practice compile (fixed / slight-pan camera → multi-set JSON): [`video-to-choreographic.md`](./video-to-choreographic.md).
