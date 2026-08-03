# Choreographic compatibility

We align the formation editor with [Choreographic](https://www.choreographic.app/) concepts used by dance/idol choreographers:

| Choreographic concept | Our support |
| --- | --- |
| Free dancer placement on stage | Continuous `x/y` 0–100 positions |
| Audience orientation | Audience at **bottom** (downstage = higher `y`) |
| Multi-formation timeline | `formations[]` with duration + transition |
| Crew colors / names | `crew[]` linked to idol uids |
| Formation notes | `notes` per set |
| Stage size | `stage.widthMeters` / `depthMeters` (informational) |
| Share file | JSON interchange (see below) |

## Interchange format

Stable format id: `idol-producer-choreographic-compat` (`formatVersion` `0.1`).

- Schema / helpers: `src/data/choreographicCompat.ts`
- Example: `support/data/video-skill-benchmark/annotations/choreographic_compat_example.json`
- Editor: **Import JSON** / **Export Choreographic JSON**
- **Video → full timeline:** [`video-to-choreographic.md`](./video-to-choreographic.md) (dance-practice compile pipeline)

Coordinate system (audience at bottom):

- `x`: 0 = stage left, 100 = stage right (from audience view)
- `y`: 0 = upstage (back), 100 = downstage (front / near audience)

This matches Live Mode’s percentage stage layout.

## Native Choreographic app packages

The mobile/desktop app can share proprietary choreography packages (AirDrop / files). That binary/package layout is **not publicly documented**.

If you have an exported file from the app, send a sample (ideally without music) and we can add a decoder. Until then:

1. Recreate or approximate sets in our editor, or
2. Hand-convert into the compat JSON above, or
3. Export whatever JSON-like structure you can and try **Import JSON** (heuristic parser accepts `formations` / `crew` / `positions` shaped objects).

## Center seats

`centerMode`:

- `single` — one front-middle slot marked **C**
- `double` — two twin front-middle slots marked **C** (e.g. n=4 front pair, or middle two of a wider front row)

Who counts as center in Live Mode = idols currently sitting in those center slots (plus existing role history as a soft fallback).

Editor UX:

1. Select a member on the bench → empty slots glow as transparent drop targets.
2. Drag or click a ghost slot to place (swap if the slot is occupied).
3. Toggle **Single C / Double C** without moving the layout template.
