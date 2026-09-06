---
name: song-auto-evaluation
description: >-
  Use when automatically evaluating or reviewing idol songs for the large song catalog.
  Produces only the compact gameplay song fields defined by
  support/docs/SONG_DATA_AND_EVALUATION_SYSTEM.md: appeal, themes,
  singDifficulty, danceDifficulty, lead slots, functional traits, and unit/solo
  defaultMembers when applicable. Uses staged evidence gathering so 10,000+ songs
  can be processed without deep-searching every song.
---

# Song auto evaluation

Automatically enrich idol-song data while keeping the final schema compact and auditable.

Authoritative schema: `support/docs/SONG_DATA_AND_EVALUATION_SYSTEM.md`.

Do not invent extra permanent song stats. Internal analysis features may be used, but final game output must collapse to the approved fields.

## 1. Final output

```ts
interface SongEvaluation {
  appeal: number;              // integer 0..20
  themes: SongTheme[];         // normally 2..4
  singDifficulty: number;      // integer; odd values allowed
  danceDifficulty: number;     // integer; odd values allowed
  vocalLeadSlots: 0 | 1 | 2 | 3;
  danceLeadSlots: 0 | 1 | 2 | 3;
  traits: SongTrait[];
  defaultMembers?: MemberId[]; // ONLY for solo/unit
}
```

Allowed traits only:

```text
sing_together
complex_formation
mix_heavy
viral_design
unit
solo
```

Difficulty labels are not traits.

## 2. Core rules

1. Scale to 10,000+ songs: use cheap evidence first and escalate only uncertain/high-priority songs.
2. Existing curated/manual values outrank automatic output; never overwrite them silently.
3. Unknown does not automatically mean average; use a calibrated prior and lower confidence.
4. Difficulty is independent from quality; difficult songs do not automatically get higher appeal.
5. Odd difficulty values are valid. 8/10/12/14/16 are anchors, not an enumeration.
6. There is no Formation Difficulty.
7. Do not create universal `liveValue` or `viralValue` fields.
8. Popularity is not identical to appeal, but **normalized streaming performance is valid direct evidence for appeal**.
9. Never compare raw Spotify/Apple streaming levels across groups as if group scale were song quality.
10. TikTok virality is mainly an SNS/event outcome; `viral_design` is about design intent/adaptation.

## 3. Evidence stages

### Stage A — local/catalog

Use first:
- title, group, release date/era
- local lyrics
- existing metadata/song record
- known member/unit credits
- known manual notes
- already-collected Spotify popularity
- already-collected Apple Music within-group relative listening/play indicators

Enough for most themes, some appeal prior, and obvious solo/unit detection.

### Stage B — audio preview

Use an official/lawful 30–90s preview when available for:
- hook/memorability
- vocal tessitura/high-register exposure
- phrase and breath demand
- rhythmic density
- obvious rap/fast articulation
- arrangement density
- tempo/energy prior for dance

A preview may miss bridge, last chorus, key change, highest note, or dance break. Do not claim full-song certainty from a partial sample.

### Stage C — targeted search

Escalate only when needed for:
- choreography or recording difficulty
- solo/unit membership
- MIX design
- short-video/TikTok adaptation
- unusual structure
- unresolved title/lyrics ambiguity
- streaming anomalies requiring promotion/tie-in context

Useful query patterns:

```text
"<song>" 歌詞
"<song>" 振付
"<song>" ダンス 難しい
"<song>" レコーディング 難しい
"<song>" 高音
"<song>" ライブ MIX
"<song>" TikTok 振付
"<song>" ユニット メンバー
"<song>" ソロ
```

### Stage D — full MV/live/choreography

Use for recommended/playable groups, calibration songs, likely extremes, ambiguous lead structure, and manual-review queue. Do not require it for ordinary background songs.

## 4. Processing modes

### FAST
Bulk catalog. Use Stage A, plus B if already cheap/available. Streaming-relative evidence is especially useful here for appeal.

### STANDARD
C+ groups, representative songs, or FAST failures. Use A+B and targeted C.

### REVIEW
Recommended/playable groups and calibration samples. Use all relevant evidence; manual judgement may override automatic output.

## 5. Themes

Use only the locked 29 themes:

Season: `spring summer autumn winter`
Relation: `romance friendship family idol_otaku`
Setting: `school urban beach night`
Emotion: `joy sadness loneliness hope nostalgia anxiety`
Situation: `separation reunion celebration challenge`
Identity/message: `self_esteem empowerment aspiration rebellion`
Aesthetic/tone: `cute cool dark dreamy`

Rules:
- normally 2–4 themes
- tag core content/aesthetic, not incidental lyric words
- composite ideas are combinations, e.g. heartbreak = romance + separation + sadness
- title alone is weak evidence
- cute/cool/dark/dreamy describe the work's dominant tone, not member visuals

## 6. Appeal

`appeal` is the principal intrinsic continuous song-quality value: the work's underlying potential to be positively received and retained after adequate exposure.

It is not identical to current popularity, but observed replay/listening preference contains information about appeal and should be used when normalized correctly.

### 6.1 Aesthetic evidence

Internally use the project's six-part work framework as latent reasoning support:
- Concept
- Lyrics
- Music
- Choreography
- Performance
- Integration

Do not store these six as permanent sub-scores.

Ask:
- Is there a memorable/signature design?
- Is the melodic/rhythmic/lyrical identity strong?
- Do music, lyrics, choreography, and performance reinforce each other?
- Is the work generic but competent, or genuinely distinctive?
- Are there defects that materially cap it?

Work-rating calibration:

| Work Rating | Appeal |
|---|---:|
| S | 19–20 |
| S- | 18 |
| A+ | 17 |
| A | 16 |
| A- | 15 |
| B+ | 14 |
| B | 12–13 |
| C | 10–11 |
| D or below | <=9 |

Avoid inflation; most professional idol songs should not cluster at 16+.

### 6.2 Relative-streaming appeal evidence

Spotify popularity and Apple Music relative listening/play performance may directly inform appeal.

**Never use raw cross-group counts.** Preferred comparison set:

```text
same group
+ roughly comparable release era
+ enough time since release
+ similar release role when known
```

For each platform, estimate a within-group percentile or residual after controlling for age/promotion where possible.

Practical default correction:

| Within-group relative performance | appeal evidence |
|---|---:|
| top ~10% | +2 |
| 75–90% | +1 |
| 25–75% | 0 |
| 10–25% | -1 |
| bottom ~10% | -2 |

Rules:
- Spotify + Apple agreement raises confidence; full correction may be used.
- One platform only: usually cap at ±1 unless the gap is extreme and persistent.
- Very recent songs receive reduced weight until launch/promotion stabilizes.
- Main title tracks, tie-ins, graduation/anniversary songs, heavy playlisting, or major campaigns should be compared with similar release roles or promotion-adjusted downward.
- Known viral events may explain overperformance without the same increase in intrinsic appeal.
- Strong long-tail overperformance after promotion fades is especially strong appeal evidence.
- For FAST mode, normalized streaming can establish the main appeal prior even when only lyrics/short preview are available.
- A D-tier group's catalog leader can have high appeal even with far fewer absolute streams than an A-tier group's ordinary song.

Sales and chart rank are weaker appeal evidence because fandom purchasing and release mechanics dominate them more strongly. TikTok success is primarily treated in the SNS/viral layer.

### 6.3 Partial-audio caution

With only a preview:
- reduce confidence
- do not strongly judge missing bridge/last-sabi structure
- do not infer full choreography quality
- avoid extreme appeal unless streaming/other evidence is also strong

## 7. Vocal difficulty

Reference anchors:
- 8 especially easy
- 10 relatively easy
- 12 ordinary/default
- 14 somewhat difficult
- 16 very difficult
- 18 extreme high-end

Odd values are valid.

Evaluate primarily from tessitura, high-register duration, usable range, interval jumps, sustained notes, phrase length/breath demand, syllable density, fast articulation/rap, awkward rhythmic entrances, and repeated difficult passages.

Do not inflate difficulty because the original singer is excellent, the song sounds dramatic, it has many solo lines, or the arrangement is merely loud/dense.

Procedure:
1. start near 12
2. move down for narrow/repetitive/comfortable/low-density material
3. move up for multiple sustained demands, not one isolated note
4. use 11/13/15/17 naturally when between anchors
5. reserve 16+ for uncommon professional-idol demands
6. lyrics/title alone => low-confidence prior, not false precision

## 8. Dance difficulty

Evidence priority:
1. full choreography/dance shot/clear live
2. member/choreographer/official statement
3. repeated credible descriptions
4. audio-derived energy/tempo prior

Audio alone cannot establish choreography difficulty.

Evaluate movement density, continuous full-body activity, footwork, turns/direction changes, jumps/squats/level changes, synchronization precision, rapid transitions, sustained intensity, technical vocabulary, and recovery opportunities.

Do not inflate from BPM, camera cuts, formation-change count alone, or because the song is a strong live song.

Formation complexity is separate and may trigger `complex_formation`.

## 9. Leads

`vocalLeadSlots` and `danceLeadSlots` are 0..3.

Vocal Lead: one to three members carry materially more exposed/demanding vocal responsibility (important repeated solos, ochi/bridge/climax, substantial lead singing). Do not count every solo line.

Dance Lead: one to three members carry materially more demanding/featured dance responsibility (dance break, recurring feature, extra technical burden). Do not infer solely from center position.

Lead requirement = corresponding base difficulty +2 for the assigned member.

## 10. Functional traits

### sing_together
Primarily ensemble/group singing such that normal Vocal Lead handling is inappropriate. A normal all-member chorus is not enough.

### complex_formation
Unusually complex spatial/choreographic arrangement that materially affects training/familiarity/emergency adjustment. No Formation Difficulty field.

### mix_heavy
Explicitly structured for unusually strong MIX/shouted audience participation beyond ordinary idol clapping/calls/waving. iLiFE!-style songs are a calibration archetype.

### viral_design
Clear short-form viral adaptation in songwriting, choreography, or promotional concept: repeatable 15–30s hook, promoted signature gesture/challenge, or explicit creator/official intent. Cute/catchy/TikTok-posted/later-viral alone is insufficient.

### solo
Canonical/default one-member song. Requires exactly one `defaultMember`.

### unit
Canonical/default special subset of at least two members, outside normal full-group/standard-selection logic. Requires at least two `defaultMembers`.

`unit` and `solo` are mutually exclusive.

## 11. defaultMembers

Allowed only for `unit` or `solo`.

Do not populate for:
- ordinary full-group songs
- fixed small/mid-size groups where the contemporary roster is simply the default
- ordinary ~16-member standard-selection songs
- routine selection-system title tracks reconstructable from normal history/selection logic

Absence means derive normal membership from group/song-era logic; it does not mean unknown.

## 12. TikTok / viral history

Do not create universal `viralValue`.

Actual TikTok/short-video performance belongs to history/SNS/event systems. It can identify a known viral event or help detect `viral_design`, but actual viral success alone does not prove design intent.

For KAWAII LAB-like ecosystem-defining growth, scenario/event buffs are acceptable if the generic SNS simulation would not reproduce the historical breakout.

## 13. Confidence / review

Confidence is audit metadata, not a gameplay stat.

Use per-field `high / medium / low`.

Flag manual review when:
- automatic appeal <=9 or >=18
- singDifficulty <=8 or >=16 without strong audio evidence
- danceDifficulty <=8 or >=15 without choreography evidence
- complex_formation lacks clear choreography evidence
- mix_heavy rests only on fan comments
- viral_design is inferred only from success
- solo/unit membership conflicts
- proposed curated change >=2 points
- recommended/playable song only has FAST evidence
- streaming-based appeal is extreme but strongly confounded by promotion/tie-in/viral event

## 14. Calibration

Use manually rated recommended/playable-group songs as calibration examples for project-specific appeal and difficulty scales.

Do not train toward group tier. Streaming evidence must be normalized within group/era rather than using absolute group popularity.

When automatic output systematically differs from curated examples, adjust priors/rubric rather than patching songs one by one.

## 15. Batch workflow

1. preserve curated fields
2. evaluate missing fields first
3. batch Stage A for all songs, including available normalized streaming evidence
4. create uncertainty/extreme/confounder queue
5. escalate only queued songs to B/C/D
6. write staging output first
7. validate schema/member IDs
8. merge after review policy passes

Do not web-search every field of every song.

## 16. Source hierarchy

For factual claims (unit membership, choreographer intent, recording difficulty, viral design):
1. official artist/label/release material
2. member/producer/choreographer/creator statement
3. professional interview/media
4. direct MV/live/choreography evidence
5. repeated fan/community observations
6. single fan/community observation

For appeal, direct audio/aesthetic evidence and normalized behavioral evidence are complementary. Streaming listeners do not 'vote' a final score, but sustained within-group preference is valid evidence of the work's reception potential.

## 17. Audit output

```yaml
song_uid: ...
mode: FAST | STANDARD | REVIEW
proposed:
  appeal: 14
  themes: [summer, romance, night]
  singDifficulty: 13
  danceDifficulty: 12
  vocalLeadSlots: 1
  danceLeadSlots: 0
  traits: []
confidence:
  appeal: medium
  themes: high
  singDifficulty: medium
  danceDifficulty: low
evidence_used:
  local_lyrics: true
  audio_preview: true
  spotify_relative: 0.86
  apple_music_relative: 0.79
  choreography_video: false
streaming_context:
  comparison_group: same_group_same_era
  promotion_confounded: false
  age_adjusted: true
manual_review:
  required: false
  reasons: []
curated_conflicts: []
```

Keep reasoning summaries short and decision-oriented; do not store chain-of-thought.

## 18. Validation checklist

- appeal integer 0..20
- themes only from locked vocabulary
- typical themes 2–4
- difficulties integers; odd values allowed
- no difficulty labels in traits
- lead slots 0..3
- no Formation Difficulty
- traits only from locked set
- solo => exactly one defaultMember
- unit => at least two defaultMembers
- unit and solo never coexist
- defaultMembers absent unless unit/solo
- no universal liveValue/viralValue
- no raw cross-group streaming conversion into appeal
- normalized Spotify/Apple evidence records its comparison context
- curated values never silently overwritten
