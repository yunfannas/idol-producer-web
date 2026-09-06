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

Automatically enrich idol-song data for the game while keeping the final schema compact and auditable.

The authoritative schema is:

`support/docs/SONG_DATA_AND_EVALUATION_SYSTEM.md`

Do not invent extra permanent song stats. Internal analysis features may be used to reach a decision, but final game output must collapse to the approved fields.

## 1. Final output fields

```ts
interface SongEvaluation {
  appeal: number;              // integer 0..20
  themes: SongTheme[];         // normally 2..4

  singDifficulty: number;      // integer; odd values allowed
  danceDifficulty: number;     // integer; odd values allowed

  vocalLeadSlots: 0 | 1 | 2 | 3;
  danceLeadSlots: 0 | 1 | 2 | 3;

  traits: SongTrait[];

  // ONLY when traits contains `solo` or `unit`
  defaultMembers?: MemberId[];
}
```

Allowed functional song traits:

```text
sing_together
complex_formation
mix_heavy
viral_design
unit
solo
```

Never emit difficulty labels such as `easy_vocal`, `difficult_dance`, etc. as traits.

## 2. Core principles

1. **Scale to 10,000+ songs.** Do not perform expensive research on every song.
2. **Use staged enrichment.** Start from local/cheap evidence and escalate only when a field remains uncertain or the song is high priority.
3. **Recommended/playable groups may be manually reviewed.** Existing curated values are higher authority than automatic generation.
4. **Do not overwrite curated/manual values silently.** Report a proposed correction and reason instead.
5. **Unknown is not average by definition.** Use a calibrated prior only when evidence is genuinely insufficient; mark low confidence.
6. **Popularity is not appeal.** Sales, views, chart rank, TikTok usage, and group fame are validation/context signals, not direct quality scores.
7. **Technical difficulty is not quality.** Difficult songs do not automatically receive higher appeal.
8. **Odd difficulty values are valid.** 8/10/12/14/16 are anchors, not an enumeration.
9. **No Formation Difficulty.** `complex_formation` is a functional trait only.
10. **No universal liveValue or viralValue.** Exceptional live/viral structure is handled by traits and external systems.

## 3. Evidence stages

Use the cheapest sufficient stage. Stop escalating when all required fields are adequately supported.

### Stage A — local / catalog evidence

Use first:

- song title
- group / artist
- release date / era
- local lyrics
- existing metadata
- existing song record
- known member/unit credits
- known manual notes

This stage should be enough for most theme extraction and some solo/unit detection.

### Stage B — audio-preview evidence

Use an official or lawful preview/sample when available. A 30–90 second sample is useful for:

- melodic hook and structural memorability
- vocal tessitura / high-register exposure
- phrase density and breath demand
- rhythmic density
- obvious rap / fast syllabic passages
- arrangement density
- tempo/energy prior for dance

A preview may miss bridge, last chorus, key change, highest note, or difficult dance break. Do not claim full-song certainty from a partial sample.

### Stage C — targeted web search

Escalate when needed for:

- official/member statements about singing or choreography difficulty
- live/MV/choreography evidence
- solo/unit membership
- explicit MIX design
- explicit short-video / TikTok adaptation
- unusual song structure
- unclear lyrics/title ambiguity

Prefer targeted queries rather than generic broad search.

Examples:

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

### Stage D — full MV/live/choreography review

Use only for:

- recommended/playable groups
- calibration songs
- likely difficulty extremes
- low-confidence `complex_formation`
- ambiguous lead structure
- songs flagged for manual review

Do not require Stage D for ordinary background-catalog songs.

## 4. Priority / processing modes

### FAST mode

For bulk background catalog.

Use Stage A, plus Stage B only when already available cheaply.

Goal:
- themes
- rough appeal
- singDifficulty
- danceDifficulty prior
- obvious traits

Allow lower confidence and review flags.

### STANDARD mode

For C+ groups, important catalog songs, representative songs, or failed FAST confidence.

Use A + B + targeted C.

### REVIEW mode

For recommended/playable groups and calibration samples.

Use all relevant evidence, including full MV/live where available. Manual judgement may override automatic output.

## 5. Theme extraction

Use only the locked 29 themes.

### Season

```text
spring
summer
autumn
winter
```

### Relation

```text
romance
friendship
family
idol_otaku
```

### Setting

```text
school
urban
beach
night
```

### Emotion

```text
joy
sadness
loneliness
hope
nostalgia
anxiety
```

### Situation

```text
separation
reunion
celebration
challenge
```

### Identity / message

```text
self_esteem
empowerment
aspiration
rebellion
```

### Aesthetic / tone

```text
cute
cool
dark
dreamy
```

Rules:

- Typical song: 2–4 themes.
- Do not tag every incidental lyric word.
- Select themes that materially describe the song's core content or aesthetic.
- Composite concepts are represented by combinations: e.g. heartbreak may be `romance + separation + sadness`; graduation may be `school + separation + nostalgia/hope` depending on text.
- Title alone is weak evidence unless lyrics/audio/official framing support it.
- `cute`, `cool`, `dark`, `dreamy` describe dominant aesthetic tone, not member visuals.

## 6. Appeal evaluation

`appeal` is the principal intrinsic continuous song-quality value.

It means:

> the work's underlying potential to be positively received and retained after adequate exposure.

Do not equate it with current popularity.

### Internal evaluation framework

Use the project's idol-work aesthetic framework as latent reasoning support:

1. Concept
2. Lyrics
3. Music
4. Choreography
5. Performance
6. Integration

Only the final `appeal` is stored. Do not emit six permanent sub-scores.

Ask internally:

- Is there a memorable / necessary core design or signature feature?
- Does the song have a strong hook, melodic identity, rhythmic identity, lyrical identity, or integrated concept?
- Do lyrics/music/choreography/performance reinforce each other or merely coexist?
- Is the work generic but competent, or genuinely distinctive?
- Are there defects that materially cap the work?
- Would the work still be strong after controlling for group fame and promotion?

### Work-rating to appeal calibration

Use this as the default mapping unless a project calibration file supersedes it:

| Work Rating | Appeal anchor |
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

Avoid rating inflation. Most professional idol songs should not cluster at 16+.

### Evidence weighting for appeal

Strongest:

- full song/audio
- full MV/live/choreography for works where visual realization is central
- lyrics
- production/creator/member statements that clarify intent

Weak validation only:

- long-term live usage
- enduring fan recognition
- cover frequency
- sustained platform performance relative to group/era baseline

Do not directly convert streaming counts or sales into appeal.

### Partial-audio caution

When only a preview is available:

- lower appeal confidence
- do not heavily reward or punish missing bridge/last-sabi structure
- do not infer full choreography quality
- avoid extreme appeal values unless other evidence is strong

## 7. Vocal difficulty

Difficulty reflects the performance requirement for an ordinary assigned member, not the quality of the original singer.

Reference anchors:

| Value | Meaning |
|---:|---|
| 8 | especially easy |
| 10 | relatively easy |
| 12 | ordinary/default professional idol song |
| 14 | somewhat difficult |
| 16 | very difficult |
| 18 | extreme high-end requirement |

Odd values are valid.

Evaluate primarily from:

- tessitura, not just one highest note
- duration spent in high register
- total usable range
- large interval jumps
- sustained notes and pitch exposure
- phrase length / breath requirement
- syllable/note density
- fast articulation / rap-like sections
- rhythmically awkward entrances
- repeated difficult passages across the whole song
- simultaneous singing while choreography is demanding, only when evidence clearly shows it materially affects execution

Do not inflate difficulty because:

- the original singer is excellent
- the song sounds dramatic
- it has many solo lines
- it is emotionally intense
- the arrangement is loud/dense but the melody itself is easy

### Vocal difficulty estimation procedure

1. Start at 12.
2. Move down for clearly narrow, repetitive, comfortable-range, low-density material.
3. Move up for multiple independent sustained demands, not one isolated note.
4. Use 13/15/17 when evidence falls between anchors.
5. Reserve 16+ for genuinely uncommon professional-idol demands.
6. If only lyrics/title exist, use a low-confidence prior rather than pretending to know melodic difficulty.

## 8. Dance difficulty

Dance difficulty is harder to infer automatically than vocal difficulty.

Evidence priority:

1. full choreography / dance shot / clear live video
2. member/choreographer/official statement
3. repeated credible descriptions
4. audio-derived energy/tempo prior

Audio alone cannot establish choreography difficulty.

Evaluate from:

- movement density
- continuous full-body activity
- footwork complexity
- turns / direction changes
- jumps, squats, floor/level changes
- synchronization precision burden
- rapid transitions
- sustained intensity
- technically specific movement vocabulary
- recovery opportunities

Do not inflate because:

- BPM is high by itself
- the camera cuts quickly
- formation changes are frequent by themselves
- the song is a strong live song

Formation complexity is separate and may trigger `complex_formation`.

When choreography is unavailable, give a conservative dance prior with lower confidence. Do not routinely assign 14–16 from BPM alone.

## 9. Lead slots

Lead slots describe arrangement requirements, not who is currently the best member.

```text
vocalLeadSlots: 0..3
danceLeadSlots: 0..3
```

### Vocal Lead

Use when one to three members carry materially more demanding or exposed vocal responsibility than the group baseline.

Signals:

- repeated important solo passages
- difficult ochi / bridge / climactic vocal assigned to specific members
- substantial exposed lead singing

Do not count every member with one solo line as a Vocal Lead.

### Dance Lead

Use when one to three members carry materially more demanding / featured dance responsibility.

Signals:

- clear dance break
- recurring featured choreography
- designated dance-center role with extra technical burden

Do not infer Dance Lead solely from standing center.

Lead effective requirement is corresponding base difficulty +2 for that assigned member.

## 10. Functional trait rules

### `sing_together`

Apply when the vocal arrangement is primarily ensemble/group singing such that normal Vocal Lead handling is not appropriate.

Do not apply merely because the chorus is sung by everyone; that is normal idol-song structure.

### `complex_formation`

Apply only when formation/choreographic spatial structure is unusually complex relative to normal idol choreography and materially affects training/familiarity/emergency adjustment.

Possible evidence:

- unusually frequent spatial reconfiguration
- nontrivial subgroup/interlocking movement
- repeated difficult position swaps
- explicit choreographer/member comments about formation complexity

Do not create Formation Difficulty.

### `mix_heavy`

Apply when the song is explicitly structured for unusually strong MIX / shouted audience participation beyond ordinary idol clapping, calls, waving, and response.

iLiFE!-style songs are a calibration archetype.

Do not use a generic `call_song` trait. Ordinary idol songs are participatory by default.

### `viral_design`

Apply when there is clear short-form viral adaptation in songwriting, choreography, or promotional concept.

Strong evidence:

- official short-form challenge/dance designed around a repeatable hook
- simple signature gesture intentionally promoted for copying
- structure clearly engineered around a 15–30 second repeatable segment
- creator/official/member statement about TikTok/short-video intent
- launch strategy centered on repeated short-form replication

Weak evidence that is insufficient by itself:

- song is cute
- chorus is catchy
- official account posted it on TikTok
- song later became popular on TikTok

`viral_design` means design/adaptation, not actual success.

### `solo`

Apply only for a canonical/default one-member song.

Requirements:

```text
traits includes solo
defaultMembers.length == 1
```

### `unit`

Apply only when the canonical/default song is bound to a special subset of members rather than normal full-group/standard-selection logic.

Requirements:

```text
traits includes unit
defaultMembers.length >= 2
```

`unit` and `solo` are mutually exclusive.

## 11. defaultMembers contract

`defaultMembers` may appear **only** for `unit` or `solo`.

Use member IDs from the project database after identity resolution.

Do not populate it for:

- ordinary full-group songs
- fixed small/mid-size groups where the normal contemporary roster performs the song
- ordinary ~16-member standard-selection songs
- routine selection-system title tracks whose members can be reconstructed from normal history/selection data

For selection-system groups, use `unit + defaultMembers` only for genuinely special-number/special-unit songs.

Absence of `defaultMembers` means derive normal membership from group/song-era logic. It does not mean unknown.

## 12. Historical TikTok / viral evidence

Do not create a universal `viralValue`.

Actual TikTok/short-video performance belongs to history/SNS/event systems.

When researching historical songs, platform signals may be collected separately if needed, especially for KAWAII LAB-like growth or early 高嶺のなでしこ calibration, but they do not directly raise appeal.

If generic simulation cannot reproduce a known ecosystem-defining viral breakout, prefer a scenario/event buff to overengineering every song.

## 13. Confidence and review flags

Confidence is audit metadata, not a permanent game stat unless the pipeline explicitly stores it outside gameplay data.

Use per-field confidence:

```text
high    = direct/full evidence
medium  = multiple indirect or partial sources
low     = prior/inference with important missing evidence
```

Flag manual review when any of the following is true:

- appeal <= 9 or >= 18 from automatic evaluation
- singDifficulty <= 8 or >= 16 without strong audio evidence
- danceDifficulty <= 8 or >= 15 without choreography evidence
- `complex_formation` inferred without clear choreography evidence
- `mix_heavy` inferred from fan comments only
- `viral_design` inferred from success rather than design intent
- solo/unit membership conflicts across sources
- output proposes changing an existing curated value by >=2 points
- recommended/playable group song has only FAST-mode evidence

## 14. Calibration behavior

Use manual ratings from recommended/playable groups as calibration examples.

Calibration should teach:

- what project-specific appeal 12/14/16/18 feels like
- what vocal/dance 10/12/14/16 mean in real idol repertoire
- when a song truly qualifies for `mix_heavy` or `viral_design`

Do not train toward group tier or popularity.

When automatic output systematically differs from curated examples, adjust the generation rubric/prior, not individual songs one by one.

## 15. Batch processing rules

For large runs:

1. preserve existing curated fields
2. evaluate missing fields first
3. batch Stage A extraction for all songs
4. identify uncertainty/extreme-value queue
5. escalate only queued songs to Stage B/C/D
6. write proposed values to enrichment/staging output first
7. validate schema and member IDs
8. merge only after review policy passes

Do not perform a web search per field per song. One targeted evidence bundle per escalated song is preferred.

Avoid repeated searches for songs from the same release when shared official material already answers multiple fields.

## 16. Source hierarchy

For factual claims such as unit membership, choreographer intent, recording difficulty, or viral design:

1. official release/artist/label material
2. member/producer/choreographer/creator statement
3. professional interview/media
4. direct MV/live/choreography evidence
5. repeated fan/community observations
6. single fan/community observation

For aesthetic appeal, sources do not vote on quality. They provide context/evidence; the agent performs the evaluation under the project framework.

## 17. Output audit block

For staging/review output, use:

```yaml
song_uid: ...
source_title: ...
group_uid: ...
mode: FAST | STANDARD | REVIEW

proposed:
  appeal: 14
  themes: [summer, romance, night]
  singDifficulty: 13
  danceDifficulty: 12
  vocalLeadSlots: 1
  danceLeadSlots: 0
  traits: []
  # defaultMembers only for unit/solo

confidence:
  appeal: medium
  themes: high
  singDifficulty: medium
  danceDifficulty: low
  leadSlots: medium
  traits: high
  defaultMembers: null

evidence_used:
  local_lyrics: true
  audio_preview: true
  choreography_video: false
  web_sources:
    - "..."

reasoning_summary:
  appeal: "..."
  difficulty: "..."
  traits: "..."

manual_review:
  required: false
  reasons: []

curated_conflicts: []
```

Keep reasoning summaries short and decision-oriented. Do not store chain-of-thought.

## 18. Final validation checklist

Before accepting output:

- `appeal` is integer 0..20
- themes are only from locked 29-theme vocabulary
- typical theme count is 2–4 unless clearly justified
- difficulties are integers; odd values are allowed
- no difficulty labels appear in traits
- lead slots are each 0..3
- no Formation Difficulty field exists
- traits are only from the locked functional set
- `solo` => exactly one `defaultMember`
- `unit` => at least two `defaultMembers`
- `unit` and `solo` never coexist
- `defaultMembers` absent unless unit/solo
- no universal liveValue/viralValue is emitted
- popularity/TikTok success has not been directly converted into appeal
- curated values have not been silently overwritten
