# Video-Based Idol Singing and Dancing Skill Scoring Plan

## 1. Purpose

Build a semi-automated pipeline that analyzes idol performance videos and produces evidence-backed estimates for game ability values.

The system should not attempt to produce an unquestionable objective score from a video. Instead, it should:

1. extract measurable vocal and movement features;
2. use existing manually entered idol ratings as calibration labels;
3. generate suggested game scores with confidence values;
4. preserve human review and manual override.

The primary product goal is to reduce repetitive data-entry work while keeping ratings consistent with the game's existing balance and the designer's judgment.

## 2. Proposed Ability Model

Keep static skill and live-performance stability separate. A useful initial set is:

- `singing`: baseline vocal ability under favorable conditions;
- `dancing`: choreography execution, timing, range, and body control;
- `stamina`: ability to maintain performance quality through a song or set;
- `sing_dance_stability`: resistance to vocal degradation during intensive movement;
- `stage_presence`: subjective performance impact, primarily human-reviewed;
- `score_confidence`: confidence in the automated estimate rather than an idol ability.

An idol may therefore have strong static singing but only average sing-and-dance stability, or moderate static singing but excellent live reliability.

## 3. Scope and Non-Goals

### Initial scope

The first version should support:

- one song per analysis job;
- fixed or mostly fixed camera footage;
- **preferred for formation extract:** official dance practice / ダンス練習動画 (full group, opening hold) — e.g. [Takane no Nadeshiko「可愛くてごめん」](https://www.youtube.com/watch?v=oB12TDu4dVE);
- at least 720p video where the target idol is visible for meaningful portions;
- **full-formation evaluation of all roster members in a live song** (preferred), plus single-idol jobs for static vocal clips;
- portrait gallery + manual identity seeds, optionally constrained by **song starting formation**;
- manually marked solo vocal segments (per member when attributing lines);
- an optional reference performance, studio track, MIDI file, or annotated melody;
- output of raw measurements, suggested scores, and confidence.

Song starting formations (shared with in-game Live Mode) are specified in [`video-skill-scoring/song-starting-formations.md`](./video-skill-scoring/song-starting-formations.md).

### Non-goals for the first version

Do not initially attempt to:

- identify every member automatically in arbitrary concert footage;
- separate several simultaneous singers reliably from a mixed live recording;
- determine whether backing vocals or prerecorded vocals are being used with certainty;
- judge beauty of vocal tone or stage charisma as fully objective quantities;
- replace manual ratings without review.

## 4. High-Level Pipeline

```text
Performance video
    |
    +-- Preprocessing
    |     +-- normalize video and audio
    |     +-- detect cuts and unusable sections
    |     +-- create analysis timeline
    |
    +-- Vocal analysis
    |     +-- isolate approximate vocal stem
    |     +-- use manually tagged solo segments
    |     +-- extract pitch, rhythm, stability, and degradation features
    |
    +-- Dance analysis
    |     +-- track selected performer
    |     +-- extract body pose landmarks
    |     +-- measure timing, range, control, and fatigue
    |
    +-- Feature aggregation
    |     +-- aggregate per phrase, song, and source video
    |     +-- calculate source-quality confidence
    |
    +-- Score calibration
    |     +-- train against existing manual ratings
    |     +-- produce suggested game scores
    |
    +-- Human review
          +-- inspect evidence and outliers
          +-- accept, edit, or reject suggestions
```

## 5. Vocal Analysis

### 5.1 Audio preprocessing

Use FFmpeg to extract a normalized audio stream. Optionally run source separation to obtain an approximate vocal stem.

Possible tools:

- FFmpeg for decoding, resampling, and loudness normalization;
- Demucs for vocal-versus-accompaniment separation;
- librosa or an equivalent library for pitch, onset, and beat analysis.

Source separation is only a helper. It will not reliably separate individual group members, audience noise, harmony tracks, and prerecorded vocals.

### 5.2 Singer attribution

Singer attribution is likely the largest accuracy bottleneck. For the first version, provide a timeline editor where a reviewer can label segments such as:

```text
00:14.2-00:19.7  Member A solo
00:19.7-00:23.1  Member B solo
00:23.1-00:28.6  Group vocal, excluded from individual scoring
```

The application may suggest segments using face visibility, mouth motion, or known line distribution, but human confirmation should remain authoritative.

### 5.3 Vocal features

Candidate raw features include:

- median absolute pitch error in cents;
- percentage of voiced notes within 25 and 50 cents of a reference;
- onset timing error in milliseconds;
- phrase-entry timing error;
- note-duration accuracy;
- long-note pitch variance;
- long-note loudness variance;
- unexpected voice-break or dropout rate;
- phrase-ending pitch drop;
- voiced-frame ratio;
- change in quality after jumps or high-motion sections;
- difference between static singing and live dancing performance.

Pitch comparison should operate on aligned note centers rather than treating every frame as an exact target. Vibrato, slides, spoken phrases, shouts, and expressive ornaments must be excluded or handled separately.

### 5.4 Vocal score groups

The feature layer can support several internal sub-scores:

- `pitch_accuracy`;
- `rhythm_accuracy`;
- `breath_and_phrase_control`;
- `long_note_stability`;
- `live_vocal_reliability`;
- `vocal_degradation_under_motion`.

The game-facing `singing` and `sing_dance_stability` scores should be calibrated from these features rather than calculated by a fixed universal formula.

## 6. Dance Analysis

### 6.1 Performer tracking and pose extraction

For full-formation jobs, assign every detected person at song start to a formation slot (position prior + face match to portraits), then track all members. For single-idol jobs, the reviewer selects the target in one or more key frames. Pose estimation should extract normalized landmarks for shoulders, elbows, wrists, hips, knees, ankles, and body center.

Possible tools:

- MediaPipe Pose for a simple first implementation;
- a multi-person pose model plus ByteTrack or a similar tracker when group footage becomes a priority.

When tracking confidence drops because of occlusion, camera cuts, crossing formations, or costume similarity, the segment should be flagged rather than silently scored.

### 6.2 Dance features

Candidate features include:

- arm and leg range of motion;
- joint-angle range;
- body expansion and contraction;
- knee-bend depth;
- estimated jump height;
- center-of-mass travel;
- motion peak alignment to musical beats;
- left-right timing consistency;
- landing stability;
- rotational control;
- trajectory smoothness;
- formation-position error when a reference is available;
- missing or shortened movements;
- late-song reduction in movement amplitude.

### 6.3 Reference choreography comparison

When a dance-practice video or trusted performance exists, align the target skeleton sequence with a reference sequence using time warping.

Comparison should use normalized joint angles and body-relative coordinates rather than raw pixels, reducing sensitivity to height, body proportions, camera zoom, and stage position.

Useful comparison outputs include:

- pose-angle error;
- movement timing error;
- amplitude ratio;
- omitted-action count;
- mirrored or wrong-direction action count;
- recovery time after turns and jumps.

### 6.4 Dance score groups

Internal sub-scores may include:

- `timing`;
- `precision`;
- `movement_range`;
- `body_control`;
- `choreography_completion`;
- `late_song_stability`.

These should feed the game-facing `dancing` and `stamina` ratings through a calibrated model.

## 7. Sing-and-Dance Stability

Treat simultaneous performance stability as its own ability rather than averaging singing and dancing.

Example measurements:

```text
static_pitch_accuracy - live_pitch_accuracy
static_long_note_stability - live_long_note_stability
early_song_motion_range - late_song_motion_range
early_song_timing_accuracy - late_song_timing_accuracy
```

A low degradation value indicates strong live stability. This supports meaningful distinctions such as:

- technically strong singer who loses control during choreography;
- average singer who remains highly reliable in live performance;
- strong dancer who reduces movement noticeably during solo lines;
- balanced all-rounder with little late-song decline.

## 8. Calibration with Existing Manual Ratings

The existing manually rated idols should be treated as labeled training data.

For each idol, aggregate features across several usable clips. Avoid training directly on individual frames or single clips because source quality and performance conditions vary too much.

A training record may contain:

```text
idol_id
pitch_accuracy_median
pitch_accuracy_low_percentile
rhythm_accuracy_median
long_note_stability
voice_break_rate
movement_range_median
beat_alignment
pose_precision
late_song_motion_decay
live_vocal_degradation
usable_duration_seconds
source_count
manual_singing_score
manual_dancing_score
manual_stamina_score
manual_sing_dance_stability_score
```

Start with interpretable small-data models:

- ridge regression as a baseline;
- random forest;
- gradient-boosted trees;
- a small multilayer perceptron only after the dataset grows.

Train separate models for singing, dancing, stamina, and sing-and-dance stability. Do not train one opaque model to produce every attribute.

Use cross-validation grouped by idol so clips from the same idol do not appear in both training and validation sets.

## 9. Confidence and Evidence

Every suggested score should carry evidence and confidence metadata.

Suggested fields:

```ts
interface SkillScoreEvidence {
  idolId: string;
  skill: "singing" | "dancing" | "stamina" | "sing_dance_stability";
  suggestedScore: number;
  confidence: number;
  sourceCount: number;
  usableDurationSeconds: number;
  sourceQuality: number;
  modelVersion: string;
  evaluatedAt: string;
  manualOverride?: number;
}
```

Confidence should decrease for:

- low-resolution or heavily compressed video;
- poor audio signal-to-noise ratio;
- frequent camera cuts;
- partial body visibility;
- overlapping singers;
- uncertain performer tracking;
- short usable duration;
- results outside the training-data distribution.

Low-confidence output should be presented as a review suggestion, not written directly into canonical idol data.

## 10. Data Model Proposal

Store raw observations separately from canonical game attributes.

### Analysis job

```ts
interface VideoAnalysisJob {
  id: string;
  sourceUrl?: string;
  localAssetId?: string;
  songId?: string;
  targetIdolId: string;
  status: "queued" | "processing" | "review" | "complete" | "failed";
  createdAt: string;
  modelVersion: string;
}
```

### Annotated segment

```ts
interface PerformanceSegment {
  id: string;
  jobId: string;
  startSeconds: number;
  endSeconds: number;
  performerId: string;
  segmentType: "solo_vocal" | "group_vocal" | "dance" | "excluded";
  attributionConfidence: number;
  reviewerConfirmed: boolean;
}
```

### Feature record

```ts
interface PerformanceFeatureRecord {
  jobId: string;
  segmentId?: string;
  featureName: string;
  value: number;
  confidence: number;
  unit?: string;
}
```

### Suggested rating

```ts
interface SuggestedIdolRating {
  idolId: string;
  skill: string;
  score: number;
  confidence: number;
  evidenceJobIds: string[];
  modelVersion: string;
  reviewStatus: "pending" | "accepted" | "edited" | "rejected";
  reviewedScore?: number;
}
```

## 11. Review UI Proposal

Add an internal review screen rather than immediately integrating scores into normal gameplay data.

The review screen should show:

- synchronized video and waveform;
- selected performer track;
- annotated solo and excluded segments;
- pose overlay toggle;
- reference-versus-observed pitch view;
- reference-versus-observed pose view;
- raw feature values;
- current manual game score;
- suggested score and confidence;
- accept, edit, and reject actions;
- reviewer notes.

Corrections should be retained as future calibration data.

## 12. Implementation Phases

### Phase 0: Dataset audit

- inventory existing manual ratings;
- identify which skills have enough labels;
- define rating scales and meanings;
- choose 10-20 representative idols for initial experiments;
- collect several static singing and live performance clips per idol.

Deliverable: a small benchmark dataset and written scoring definitions.

**Status (Phase 0):** completed audit + 13-idol benchmark shortlist — see [`video-skill-scoring/phase0-dataset-audit.md`](./video-skill-scoring/phase0-dataset-audit.md) and [`../data/video-skill-benchmark/manifest.json`](../data/video-skill-benchmark/manifest.json). Clip collection is still open.

### Phase 1: Offline feature extraction prototype

- normalize video and audio with FFmpeg;
- add manual JSON annotations for performer and solo segments;
- extract pose landmarks;
- extract pitch, onset, beat, and loudness features;
- export one analysis JSON file per video;
- create plots or CSV reports for manual inspection.

Deliverable: repeatable command-line analysis for controlled clips.

### Phase 2: Score calibration

- aggregate features by idol;
- train baseline regression models;
- evaluate grouped cross-validation error;
- inspect feature importance and systematic bias;
- define minimum evidence thresholds;
- version trained models and feature schemas.

Deliverable: suggested singing, dancing, stamina, and stability scores with confidence.

### Phase 3: Web review workflow

- add analysis-job storage;
- add video timeline and segment annotation UI;
- display feature evidence and confidence;
- support score acceptance, editing, and rejection;
- export approved ratings into the existing idol data workflow.

Deliverable: usable human-in-the-loop rating tool inside `idol-producer-web`.

### Phase 4: Assisted automation

- suggest likely active singer segments;
- improve multi-person tracking through formation changes;
- detect unusable footage automatically;
- recommend the next most informative video to review;
- retrain models from accepted reviewer corrections.

Deliverable: reduced annotation time without removing human control.

## 13. MVP Acceptance Criteria

The first useful MVP should:

- analyze a manually selected idol in one fixed-camera song video;
- allow manual marking of solo vocal segments;
- extract a stable pose track for most visible sections;
- output at least five vocal and five dance features;
- calculate early-versus-late performance degradation;
- generate suggested scores from existing manual labels;
- show confidence and usable evidence duration;
- allow a reviewer to accept or override each score;
- preserve raw measurements and model version for reproducibility.

A successful MVP does not need perfect automatic singer recognition.

## 14. Risks and Mitigations

### Mixed and prerecorded vocals

Risk: the system may score backing tracks rather than the performer.

Mitigation: prioritize solo segments, compare mouth motion and vocal activity, flag suspiciously invariant vocals, and require manual confirmation.

### Camera and editing bias

Risk: close-ups and cuts hide movement or exaggerate apparent motion.

Mitigation: estimate visibility quality, prefer fixed-camera sources, and exclude low-confidence intervals.

### Small training set

Risk: a complex model memorizes familiar idols and fails on new ones.

Mitigation: use simple models, grouped cross-validation, regularization, and explicit uncertainty.

### Rating bias in manual labels

Risk: existing ratings may reflect reputation, preference, or uneven evidence.

Mitigation: retain the designer's style as the target while exposing disagreements between measurable features and manual scores for review.

### False precision

Risk: a generated score such as 78 may appear more certain than the evidence supports.

Mitigation: display confidence bands, sample counts, and evidence summaries; round or bucket low-confidence scores.

## 15. Recommended First Technical Spike

Use five to ten idols that already have trusted manual ratings and collect:

- one relatively static singing clip;
- one fixed-camera live performance;
- one reference choreography source when available.

Implement a standalone Python analysis script that emits a versioned JSON result. Keep the web project responsible for review and data visualization rather than running expensive media models in the browser.

Recommended initial output:

```json
{
  "schemaVersion": "0.1",
  "idolId": "example-idol",
  "videoId": "example-video",
  "usableDurationSeconds": 143.2,
  "sourceQuality": 0.81,
  "features": {
    "pitchAccuracy50Cents": 0.87,
    "longNotePitchStdCents": 18.4,
    "onsetErrorMs": 74.0,
    "movementRange": 0.76,
    "beatAlignment": 0.83,
    "lateSongMotionDecay": 0.11,
    "liveVocalDegradation": 0.14
  },
  "suggestions": {
    "singing": { "score": 79, "confidence": 0.72 },
    "dancing": { "score": 83, "confidence": 0.78 },
    "stamina": { "score": 75, "confidence": 0.66 },
    "singDanceStability": { "score": 73, "confidence": 0.69 }
  }
}
```

This spike will test the most important assumption: whether objective features from controlled videos correlate well enough with the existing manual game ratings to justify a larger implementation.