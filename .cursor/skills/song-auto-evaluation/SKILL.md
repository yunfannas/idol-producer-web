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
11. Appeal is primarily a work-quality judgement. Group tier and group production type are weak priors, not substitutes for evaluating the song itself.
12. The six-part work framework is not a simple arithmetic average or a weakest-link test. A song may have one ordinary/weak dimension and still have high overall appeal if stronger dimensions support the work.

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
- group tier at the scenario/evaluation date when available
- lightweight group production-type notes when already known from project data/manual research

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
- music/arrangement quality evidence for appeal

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
- production-role context when group-type prior would otherwise be speculative

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
Bulk catalog. Use Stage A, plus B if already cheap/available. Streaming-relative evidence is especially useful here for appeal. Tier/group-type priors may be used conservatively when project data already contains them.

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

### 6.1 Six-part work evaluation is the main signal

Internally use the project's six-part work framework as latent reasoning support:
- Concept
- Lyrics
- Music
- Choreography
- Performance
- Integration

Do not store these six as permanent sub-scores.

The six dimensions are the **main work-level evidence** for appeal. Tier and group type are only weak calibration priors layered around this analysis.

Important scoring rules:
- Do **not** calculate appeal as a simple average of six dimension scores.
- Do **not** use a weakest-link/minimum rule.
- A merely ordinary dimension is not automatically a defect.
- Lyrics may score low for a simple hype/cute/live-oriented song without capping the whole work if Music, Performance and Integration are strong.
- Conversely, a lyric-rich thematic song may earn high appeal through Concept/Lyrics/Integration even if choreography is ordinary.
- Judge whether the work succeeds as a whole, then use the six dimensions to explain why.

Ask:
- Is there a memorable/signature design?
- Is the melodic/rhythmic/lyrical identity strong?
- Do music, lyrics, choreography, and performance reinforce each other?
- Is the work generic but competent, or genuinely distinctive?
- Are there defects that materially cap it?
- Which dimensions actually carry the song's appeal, and which are merely functional/adequate?

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

Avoid inflation. Most professional idol songs should cluster around the B region, with B+/A- common for strong professional work and C-/D reserved for relatively rare failures or materially weak works.

### 6.2 Tier prior: weak and bounded

Group tier may inform expected production-resource floor, but must not directly determine song quality.

Use tier only as a **small prior**, normally no more than about one appeal point in either direction before song-specific evidence.

Practical default prior band:

| Group tier | Typical prior tendency |
|---|---|
| S / A | slight positive floor prior, usually +0 to +1 |
| B / C | near-neutral, usually 0 to +0.5 |
| D | neutral baseline |
| E | slight negative floor prior, usually 0 to -0.5 |

Rules:
- Never add a large bonus because a group is famous/high-tier.
- A D-tier catalog leader may legitimately be A/A- quality.
- A high-tier group may still have ordinary B or weaker songs, especially in large functional catalogs.
- Tier is a resource/stability prior, not a ceiling or ranking constraint.
- Use the tier at the relevant scenario/date, not current fame when evaluating a historical song.

### 6.3 Group-type / production-style prior: adjust expectations, not schema

When the project's existing research already identifies a group's broad production pattern, use it as a lightweight prior on the six dimensions. Do **not** create a permanent song field for this.

Useful conceptual patterns include:

- `works-driven`: stronger song selection/creative filtering; Concept/Lyrics/Music/Integration may have a somewhat stronger upper tail.
- `live-driven` / `template-driven`: stable rhythmic/arrangement identity and reliable performance fit can raise the Music/Performance/Integration floor even when Lyrics are simple; catalogs may show high consistency and low variance.
- `selection-driven`: large catalogs contain many functional songs for roster/unit/generation/release-package needs; high group tier does not imply every song should receive a high appeal prior.

Rules:
- Group type should modify **priors for relevant six-part dimensions**, not give a blind fixed bonus to final appeal.
- Keep the practical final impact small: normally around ±0.5 to ±1 appeal point unless strong song-specific evidence agrees.
- Do not infer group type from one song.
- Do not penalize a live/template-driven song merely because lyrical depth is low; score Lyrics honestly, then allow Music/Performance/Integration to carry the overall work if warranted.
- Do not assume stylistic consistency means every song has the same appeal; lyrics/concept/hook and execution can still differentiate works within a narrow sonic template.

### 6.4 Relative-streaming appeal evidence

Spotify popularity and Apple Music relative listening/play performance may directly inform appeal.

**Never use raw cross-group counts.** Preferred comparison set:

```text
same group
+ roughly comparable release era
+ enough time since release
+ similar release role when known
```

For each platform, estimate a within-group percentile or residual after controlling for age/promotion where possible.

Practical default correction for ordinary full-group songs:

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
- Prefer age-adjusted within-group comparisons; cumulative popularity alone systematically favors old songs.
- Main title tracks, tie-ins, graduation/anniversary songs, heavy playlisting, or major campaigns should be compared with similar release roles or promotion-adjusted downward.
- Known viral events may explain overperformance without the same increase in intrinsic appeal.
- Strong long-tail overperformance after promotion fades is especially strong appeal evidence.
- For FAST mode, normalized streaming can establish the main appeal prior even when only lyrics/short preview are available.
- A D-tier group's catalog leader can have high appeal even with far fewer absolute streams than an A-tier group's ordinary song.

#### Unit / solo streaming exclusion

Do not apply ordinary full-group negative streaming corrections to `unit` or `solo` songs.

Default behavior:

```text
ordinary full-group song:
  relative streaming -> [-2, +2] appeal evidence

unit / solo song against ordinary group catalog:
  relative streaming -> [0, +2] only
```

Rationale: unit/solo songs usually have a smaller addressable audience, lower playlist/main-track prominence, member-popularity effects, and less live usage. Low relative streaming is therefore not reliable evidence of low intrinsic appeal.

Exception: if the same group/era has a sufficiently large comparable unit/solo sample, compare within subtype; then normal [-2,+2] corrections may be used.

Sales and chart rank are weaker appeal evidence because fandom purchasing and release mechanics dominate them more strongly. TikTok success is primarily treated in the SNS/viral layer.

### 6.5 Appeal synthesis order

For automatic evaluation, use this order:

```text
1. Six-part work evaluation (main signal)
2. Tier prior (weak resource-floor calibration)
3. Group-type prior (weak production-style calibration)
4. Normalized streaming evidence (real-world reception correction/validation)
5. Promotion/age/unit-solo confounder adjustment
6. Final appeal + confidence
```

Do not let steps 2–4 erase clear song-level evidence from step 1.

### 6.6 Partial-audio caution

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
- tier/group-type prior contributes more than one appeal point without strong supporting evidence

## 14. Calibration

Use manually rated recommended/playable-group songs as calibration examples for project-specific appeal and difficulty scales.

Do not train toward group tier. Tier is only a weak prior. Streaming evidence must be normalized within group/era rather than using absolute group popularity.

When automatic output systematically differs from curated examples, adjust priors/rubric rather than patching songs one by one.

Useful calibration checks:
- Does a stable live/template-driven group produce a realistic high floor without forcing every song to B+/A-?
- Can a low-tier group still produce A/A- songs when six-part evidence supports it?
- Can a high-tier selection-driven catalog still contain many B songs without being artificially inflated by tier?
- Are simple-lyric hype songs allowed to score well through Music/Performance/Integration rather than being mechanically dragged down?

## 15. Batch workflow

1. preserve curated fields
2. evaluate missing fields first
3. batch Stage A for all songs, including available normalized streaming evidence
4. assign weak tier/group-type priors only where project data already supports them
5. create uncertainty/extreme/confounder queue
6. escalate only queued songs to B/C/D
7. write staging output first
8. validate schema/member IDs
9. merge after review policy passes

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
  group_tier_prior: D
  group_type_prior: live_driven
  choreography_video: false
appeal_components_summary:
  main_strengths: [music, integration]
  ordinary_or_weak_dimensions: [lyrics]
  tier_prior_effect: 0
  group_type_prior_effect: 0.5
  streaming_effect: 1
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
- six-part evaluation remains the main appeal signal
- tier prior remains weak/bounded
- group type modifies priors rather than becoming a permanent song field
- no raw cross-group streaming conversion into appeal
- unit/solo songs are not negatively corrected against ordinary full-group streaming baselines
- normalized Spotify/Apple evidence records its comparison context
- curated values never silently overwritten
