# Song Data and Evaluation System

> Current design truth as of 2026-09-05.
> This document defines the compact song schema used by the simulation and the intended enrichment workflow for a 10,000+ song catalog.
> **Authoritative song-spec note:** where Sections 9–11 of `idol-producer-portable-system-spec.md` conflict with this file, this file takes precedence until the portable snapshot is regenerated.

## 1. Design principle

The song database must stay compact enough to scale to 10,000+ songs. Most musical/aesthetic analysis is evidence used to estimate a small number of gameplay fields rather than becoming permanent simulation stats.

For recommended/playable groups, songs may be manually reviewed in detail. For the broader catalog, title/lyrics/audio-preview/search evidence may be used to auto-enrich the same final fields.

## 2. Core song fields

```ts
interface SongData {
  themes: SongTheme[];
  appeal: number;

  singDifficulty: number;
  danceDifficulty: number;

  vocalLeadSlots: 0 | 1 | 2 | 3;
  danceLeadSlots: 0 | 1 | 2 | 3;

  traits: SongTrait[];

  // Present only for solo/unit songs.
  defaultMembers?: MemberId[];
}
```

Dynamic fields such as `popularity`, `freshness`, and derived `classicness` remain separate from intrinsic song data.

## 3. Appeal

`appeal` is the principal continuous intrinsic song-quality value.

It represents the song/work's underlying potential to be positively received and retained after adequate exposure. It is not the same as current popularity, sales, views, TikTok performance, or promotional reach.

Detailed aesthetic review may consider concept, lyrics, music, choreography, performance, integration, signature features, and other evidence, but those do not need to become separate permanent game stats. They primarily support the final `appeal` estimate.

Real-world success signals may be used as weak validation/correction evidence, not as a direct replacement for appeal.

## 4. Themes

Themes use the existing theme system. Theme values describe content, mood, setting, relation, and identity/message properties used by audience fit, seasonal context, setlist coherence, and trend systems.

Themes are not direct quality scores.

## 5. Vocal and dance difficulty

Difficulty is stored as integer continuous ratings. Odd numbers are valid.

Reference anchors:

| Difficulty | Meaning |
|---:|---|
| 8 | especially easy |
| 10 | relatively easy |
| 12 | ordinary / default professional song |
| 14 | somewhat difficult |
| 16 | very difficult |
| 18 | extreme high-end requirement |

The values `8/10/12/14/16` are calibration anchors, **not an allowed-value enumeration**. Examples such as 11, 13, 15, and 17 are valid when manual or automatic evaluation supports them.

Difficulty labels such as `easy_vocal`, `difficult_vocal`, etc. are **not song traits**.

### Lead requirement

A Sing Lead or Dance Lead uses the corresponding base difficulty +2 for that member's lead check and workload calculation.

Example:

```text
singDifficulty = 13
assigned Sing Lead requirement = 15
```

Lead slots remain 0–3 per channel.

There is no Formation Difficulty stat.

## 6. Final song traits

The functional song-trait set currently consists of:

```text
sing_together
complex_formation
mix_heavy
viral_design
unit
solo
```

Only traits that materially alter game behavior belong here.

### `sing_together`

The vocal arrangement is primarily group singing rather than ordinary lead assignment. Use the group-vocal aggregation path instead of normal Vocal Lead handling where appropriate.

### `complex_formation`

The choreography/formation arrangement is unusually complex. This may affect formation training, familiarity, and emergency adjustment handling, but it does **not** create a third technical difficulty score.

### `mix_heavy`

The song structure is explicitly designed for unusually strong MIX / shouted audience participation beyond normal idol-song clapping, calls, waving, and participation.

Its live benefit should depend on audience familiarity, Otaku/Core composition, venue/live context, and current atmosphere. Ordinary idol songs are already participatory by default and do not need a generic `call_song` trait.

### `viral_design`

The song, choreography, or promotional concept is clearly adapted for short-form viral distribution such as TikTok / Shorts / Reels.

This is a **design/adaptation trait**, not a statement that the song actually became viral.

Actual short-video success belongs to the SNS/history/event layer. The trait may provide a light song-fit bonus to short-video promotion or improve compatibility with a scripted/random viral-breakthrough event.

A normal cute lead song is not automatically `viral_design`; there should be clear evidence of short-video-specific adaptation.

### `solo`

A song with one canonical/default performer.

Requirements:

```text
traits includes `solo`
defaultMembers.length == 1
```

### `unit`

A song whose canonical/default performance is bound to a special subset of members rather than the normal full-group/standard-selection logic.

Requirements:

```text
traits includes `unit`
defaultMembers.length >= 2
```

`unit` and `solo` are mutually exclusive.

## 7. `defaultMembers` contract

`defaultMembers` is permitted **only** for `unit` and `solo` songs.

It means the canonical/default member assignment for that song, not permanent eligibility. The player may still use substitutes, reassignment, post-graduation versions, or special-live arrangements.

Do not populate `defaultMembers` for:

- ordinary full-group songs;
- normal songs of fixed small/mid-size groups where the default is simply the whole contemporary roster;
- ordinary ~16-member standard-selection songs;
- routine large selection-system title tracks whose membership can be reconstructed from the normal selection/history logic.

For selection-system groups, only special-number songs / special units should use `unit` + explicit `defaultMembers`.

Absence of `defaultMembers` means **derive the normal full-group/selection membership from the song-era/group rules**. It does not mean the member data is unknown.

## 8. TikTok / short-video handling

Do not add a universal continuous `viralValue` to every song.

Historical TikTok/short-video performance can be stored or reconstructed lightly where useful, especially for systems/groups whose growth materially depended on it. It should be normalized by group/era/platform context when used as historical evidence.

For simulation after the scenario start:

```text
short-video result
= normal group/member reach
× promotion effort
× light song-fit effect
× platform/system modifiers
× stochastic/event effects
```

`viral_design` may improve song fit, but actual breakout can also happen without it.

For rare ecosystem-defining cases such as KAWAII LAB-style viral growth, scenario/event buffs are acceptable and preferable to overengineering the generic song model.

## 9. Live value handling

Do not store a universal continuous `liveValue` field.

Most idol songs already have meaningful audience participation and stage use. Their normal live effect should emerge from:

- appeal;
- themes/context fit;
- familiarity/popularity/classicness;
- actual member performance;
- formation/lead assignment;
- setlist coherence and momentum;
- audience composition.

Only structurally exceptional live behavior is captured through traits such as `mix_heavy`, `sing_together`, or `complex_formation`.

## 10. Recommended-group manual evaluation vs broad auto-enrichment

### Recommended/playable groups

Manual review may directly assign or confirm:

```text
appeal
themes
singDifficulty
danceDifficulty
vocalLeadSlots
danceLeadSlots
traits
unit/solo defaultMembers when applicable
```

### Broader catalog

Automatic enrichment may use:

```text
title
lyrics
release metadata
audio preview
MV/live/choreography video when available
web evidence / interviews / official descriptions
historical platform signals when useful
```

The final database should still collapse those signals into the compact gameplay schema above rather than retaining many subjective sub-scores.

## 11. Current compact model

```text
Song
├── intrinsic
│   ├── appeal
│   ├── themes[]
│   └── traits[]
│       ├── sing_together
│       ├── complex_formation
│       ├── mix_heavy
│       ├── viral_design
│       ├── unit
│       └── solo
│
├── performance requirements
│   ├── singDifficulty       // integer; odd values allowed
│   ├── danceDifficulty      // integer; odd values allowed
│   ├── vocalLeadSlots       // 0..3
│   └── danceLeadSlots       // 0..3
│
├── special membership
│   └── defaultMembers[]     // only when unit/solo
│
└── dynamic
    ├── popularity
    ├── freshness
    └── classicness          // derived
```

This is the preferred v1 song model for the large catalog.