# Phase 0: Manual Rating Audit and Benchmark Set

Parent plan: [`../video-skill-scoring-plan.md`](../video-skill-scoring-plan.md)

Reference date for roster context: **2025-07-05** (Scenario 6 opening).
Label source: `public/data/scenarios/scenario_6/idols.json` where `attributes_origin === "manual"`.

## 1. Inventory

| Item | Value |
| --- | --- |
| Manual-labeled idols | **38** |
| Generated / synthetic attributes | ~6,615 |
| Attribute scale | integer **0–20** (clamped in `src/engine/idolAttributes.ts`) |
| Manual groups (as of 2025-07-05) | =LOVE (9), 高嶺のなでしこ (10), iLiFE! (8), アキシブproject (6), plus 4 singles elsewhere |

Manual labels are the only trustworthy calibration set. Do **not** train video models on `attributes_origin: "generated"` rows.

## 2. Game Attribute Mapping

The video plan names game-facing composites (`singing`, `dancing`, `stamina`, `sing_dance_stability`). The catalog stores fine-grained stats. Use these mappings for calibration targets:

| Video / plan target | Catalog fields | Notes |
| --- | --- | --- |
| `singing` | `technical.pitch`, `technical.tone`, `technical.breath` | Primary vocal ability. UI role benchmark also averages in `technical.power`; keep that separate for video calibration. |
| `dancing` | `technical.rhythm`, `technical.power`, `technical.grace`, `physical.agility` | Choreography execution and body control. |
| `stamina` | `physical.stamina` | Endurance / late-set maintenance proxy already present. |
| `sing_dance_stability` | **not persisted yet** | Phase 2 may derive a provisional target from early-vs-late video features, or add a reviewed field later. |
| `stage_presence` | none / human review | Out of scope for automated scoring. |

Internal vocal sub-features should prefer predicting **pitch / tone / breath** individually once enough clips exist; composites are fine for the spike.

### Rating meanings (working definitions)

Use these when collecting clips and reviewing suggestions:

- **0–8**: below playable idol floor for that skill in this catalog’s manual set (almost unused among manuals).
- **9–12**: weak / unreliable relative to peers.
- **13–15**: average competent member.
- **16–18**: strong specialist or above-average all-rounder.
- **19–20**: elite for the skill among labeled idols.

Manual set spread (n=38):

| Field | min | max | mean | sd |
| --- | ---: | ---: | ---: | ---: |
| pitch | 11 | 20 | 15.9 | 2.4 |
| tone | 11 | 20 | 15.9 | 2.2 |
| breath | 11 | 20 | 15.8 | 2.5 |
| rhythm | 11 | 20 | 16.3 | 2.0 |
| power | 13 | 20 | 16.1 | 1.7 |
| grace | 13 | 19 | 16.2 | 1.4 |
| stamina | 10 | 20 | 15.2 | 2.6 |
| agility | 11 | 19 | 15.4 | 2.2 |
| singing mean (pitch/tone/breath) | 11.0 | 20.0 | 15.9 | 2.2 |
| dancing mean (rhythm/power/grace) | 14.0 | 19.3 | 16.2 | 1.4 |

**Label sufficiency:** singing-related and dancing-related technical stats have enough labeled variance for a small ridge/forest spike. `stamina` also varies usefully. `sing_dance_stability` has **zero** labels — treat as derived / review-only until Phase 2+.

## 3. Benchmark idol set (13)

Selected for score contrast, group diversity, and known performance footage availability. Manifest: [`../../data/video-skill-benchmark/manifest.json`](../../data/video-skill-benchmark/manifest.json).

| Archetype | Idol | Group | Sing≈ | Dance≈ | Sta | Why |
| --- | --- | --- | ---: | ---: | ---: | --- |
| Elite vocal | 佐々木舞香 | =LOVE | 20.0 | 17.7 | 16 | Ceiling singer |
| Elite all-round | 野口衣織 | =LOVE | 19.0 | 19.3 | 19 | High both + stamina |
| Dance-forward | 山本杏奈 | =LOVE | 17.7 | 19.0 | 18 | Strong dance/power |
| Stamina peak | 瀧脇笙古 | =LOVE | 17.3 | 15.7 | 20 | Breath/stamina specialist |
| Balanced strong | あいす | iLiFE! | 17.3 | 18.0 | 18 | Cross-group mid-upper |
| Dance > sing | 純嶺みき | iLiFE! | 14.3 | 17.3 | 18 | Clear dance lean |
| Dance >> sing | 空詩かれん | iLiFE! | 13.7 | 17.3 | 17 | Extreme dance lean |
| Upper mid both | 籾山ひめり | 高嶺のなでしこ | 18.0 | 17.3 | 17 | High ceiling peer |
| Sing > dance | 春野莉々 | 高嶺のなでしこ | 17.7 | 14.3 | 12 | Vocal lean, lower physical |
| Lower vocal | 松本ももな | 高嶺のなでしこ | 13.3 | 15.3 | 14 | Manual floor-ish vocal |
| Dance lead | 大谷映美里 | アキシブproject | 14.7 | 18.0 | 16 | Grace/power lead |
| Low vocal | 古賀みれい | アキシブproject | 11.0 | 14.0 | 10 | Lowest singing in manuals |
| Vocal / low sta | 平沢かえ | アキシブproject | 18.3 | 16.3 | 12 | Strong vocal, weak stamina |

**Spike subset (start here):** 佐々木舞香, 野口衣織, 山本杏奈, あいす, 春野莉々, 古賀みれい, 大谷映美里, 空詩かれん (8 idols).

## 4. Clip collection checklist

For each benchmark idol, collect (local paths only; do not commit video binaries):

1. **Static / low-motion vocal** — solo or clear lead, camera mostly fixed, minimal choreography.
2. **Fixed-camera live** — full song preferred, target visible most of the time, ≥720p.
3. **Optional dance practice / reference** — for choreography alignment.

Store files under `support/data/video-skill-benchmark/clips/` (gitignored content) and register them in the manifest + annotation JSON.

Annotation requirements per video:

- `targetIdolId` (catalog uid)
- `songId` or free-text song title
- solo vocal segments with `[startSeconds, endSeconds]`
- optional excluded ranges (group vocals, MC, cuts)
- optional keyframe hint for performer selection (`selectFrameSeconds`)

## 5. Phase 0 status

| Deliverable | Status |
| --- | --- |
| Manual rating inventory | Done |
| Scale / meaning definitions | Done (working) |
| Skill label sufficiency | Done — singing/dancing/stamina OK; stability unlabeled |
| 10–20 idol shortlist | Done (13 + 8-idol spike) |
| Clip collection | **Open** — needs local media |
| Written scoring definitions | This document + parent plan |

## 6. Next step

Phase 1 spike scaffolding lives in `support/scripts/video_skill_scoring/`. After clips + annotations exist for the spike subset, run:

```bash
python -m support.scripts.video_skill_scoring.analyze_video path/to/clip.mp4 path/to/annotation.json
```

See that package’s README for dependencies and output schema.
