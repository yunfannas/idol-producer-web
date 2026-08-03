# Idol Data Lab Extraction and Game Repository Slimming Plan

## 1. Objective

Split reality-derived research, scraping, media preparation, and performance-video analysis out of `idol-producer-web` into a separate repository named `idol-data-lab`.

The target architecture has two repositories:

```text
idol-data-lab
  Researches and curates real-world source material.
  Owns analysis schemas, scraping tools, video/audio analysis,
  source provenance, review workflows, and game-data suggestions.

idol-producer-web
  Contains only the game product, runtime data, game-facing assets,
  simulation rules, save systems, UI, build/deploy code, and narrow
  import/export adapters for reviewed data.
```

The game does not model parsed videos directly. It uses game-design attributes to randomly simulate performances under constraints. Attributes derived from the data lab are curated game estimates, not claims of objective real-world truth.

## 2. Product Boundary

### `idol-data-lab` owns

- public-source research and source provenance;
- group, member, song, release, chart, sales, and social-metric collection;
- portrait/logo discovery, candidate preparation, and source records;
- video and audio acquisition for local research;
- media probing and normalization;
- person detection, tracking, assisted identity assignment, pose extraction, and costume-color evidence;
- formation extraction and Choreographic-compatible export;
- song performance definitions;
- vocal arrangement authoring;
- canonical dance-reference authoring;
- live-performance alignment and evidence;
- singing and dance feature extraction;
- single-performance evaluations;
- multi-video ability assessments;
- reviewed game-attribute suggestions;
- reviewed game-data and asset patch generation;
- all internal and exchange schemas used by the data lab.

### `idol-producer-web` owns

- game runtime and simulation engine;
- game UI and presentation;
- scenario authoring and runtime catalogs;
- save schemas and migrations;
- game balance and fictionalized attributes;
- the final approved portraits, logos, audio previews, and other runtime assets;
- Choreographic playback used by Live Mode;
- optional lightweight formation preview/editing needed by game authors;
- game catalog export;
- validation, preview, and application of reviewed data-lab patches;
- tests, builds, deployment, and game-only developer skills.

### Explicitly out of scope for the game repository

After migration, the game repository should not require or contain:

- FFmpeg, OpenCV, MediaPipe, librosa, OCR, or scraping dependencies;
- raw videos or downloaded research media;
- source scraping scripts;
- social/streaming/chart research scripts;
- video skill-scoring scripts;
- raw pose, track, audio, or benchmark output;
- reality-research reports;
- skills that browse or scrape real-world information and directly edit game data.

## 3. High-Level Data Flow

```text
Real-world sources
  videos, dance practices, live footage, official audio,
  websites, social media, charts, public catalogs
                    |
                    v
             idol-data-lab
  raw evidence -> normalized research data -> curation
  -> performance analysis -> reviewed game suggestions
                    |
                    | reviewed exports only
                    v
            idol-producer-web
  validate -> preview diff -> apply approved patch
  -> runtime game database and assets
```

The reverse flow is intentionally narrow:

```text
idol-producer-web
  exports stable UIDs, current game values, group/song catalog,
  attribute scale metadata, and relevant runtime references
                    |
                    v
             idol-data-lab
```

The data lab must never directly rewrite game source files or game catalogs.

## 4. Data Semantics

Three data layers must remain distinct.

### Research data

Stored only in `idol-data-lab`:

- source facts and citations;
- conflicting or incomplete records;
- timestamps and collection dates;
- raw and normalized media observations;
- video timelines and performance evidence;
- confidence values and reviewer notes.

### Curated game candidates

Generated and reviewed in `idol-data-lab`:

- normalized names and memberships;
- selected final asset candidates;
- simplified timelines;
- Choreographic files;
- game attribute suggestions;
- proposed game-data patches.

### Runtime game data

Stored in `idol-producer-web`:

- approved game-facing entities and assets;
- fictionalized/balanced attributes;
- scenario-specific overrides;
- runtime Choreographic files;
- values actually used by simulation.

Game attributes are explicitly `curated_game_estimates`, not real-world measurements.

## 5. Repository Exchange Contracts

The data lab owns the schemas. The game implements only the small exchange surface it consumes.

### Game catalog export

Suggested format identifier:

```text
idol-producer-game-catalog / 0.1
```

Minimum contents:

- stable `idolUid`, `groupUid`, and `songUid` values;
- game-facing names;
- active and historical group memberships;
- member colors;
- references to approved portraits already in the game;
- current game attributes;
- attribute ranges and scale metadata;
- current catalog revision.

The export should state:

```json
{
  "attributeSemantics": "fictional_game_estimates"
}
```

### Reviewed game patch

Suggested format identifier:

```text
idol-producer-game-data-patch / 0.1
```

Supported changes may include:

- idol game attribute update;
- curated idol/group/song metadata update;
- approved portrait or logo asset import;
- Choreographic import/update;
- approved song-performance metadata needed by the game.

Every patch should include:

- base game catalog revision;
- stable entity UID;
- old value when relevant;
- proposed value;
- approved value when manually edited;
- review status;
- compact provenance summary;
- data-lab export version.

The game importer applies only `approved` changes.

### Choreographic files

Choreographic compatibility remains an independent exchange path.

The data lab owns video-to-Choreographic extraction and detailed authoring. The game may retain playback and a lightweight editor. Choreographic files must stay pure and must not absorb vocal, pose, evaluation, or live-evidence fields.

## 6. Performance Analysis Scope in `idol-data-lab`

### Inputs

- live and dance-practice videos;
- fixed-camera and selected multi-camera footage;
- official audio, instrumentals, MIDI, scores, lyrics, and beat data;
- game catalog exports for stable UIDs, portraits, colors, memberships, and current game estimates;
- existing Choreographic files;
- manual annotations and reviewer corrections.

### Core internal objects

- `SongPerformanceDefinition`
  - pure Choreographic-compatible choreography;
  - independent vocal arrangement;
  - independent canonical dance reference;
  - reference-source metadata.
- `SourceVideoAnalysis`
  - media metadata;
  - camera analysis;
  - audio observations;
  - detections, tracks, pose, costume-color features;
  - identity hypotheses;
  - model versions.
- `LivePerformanceEvidence`
  - roster and alignment;
  - member vocal timelines;
  - member dance timelines;
  - live-only interaction events;
  - exclusions and simple restriction records;
  - per-performance singing and dance evaluation.
- `IdolAbilityAssessment`
  - multi-video evidence aggregation;
  - curated game-attribute suggestions;
  - confidence and reviewer decision.

### Required outputs

- full-song Choreographic-compatible formation timeline;
- each member's vocal timeline;
- each member's dance/position/pose/movement timeline;
- raw and normalized observations sufficient for later recomputation;
- single-performance singing and dance evaluations;
- reviewed multi-video game-attribute suggestions.

### Important evaluation rules

- dance-practice footage defines canonical choreography but usually does not provide live vocal evidence;
- live footage is separate performance evidence aligned to the canonical definition;
- lead singers may intentionally have reduced movement while other members continue full supporting choreography;
- handheld microphone choreography differs from full two-hand practice choreography;
- melodic singing is separated from rap, spoken lines, chants, and planned shouts;
- live-only ad-lib shouts, crowd calls, and hype speech are recorded but excluded from singing scores;
- known temporary vocal or movement restrictions are recorded and normally exclude affected evidence;
- long-term exceptional cases default to manual review rather than a complex adapted scoring system;
- unavailable or unsuitable evidence produces `N/A` or low confidence, never an automatic low score.

## 7. Initial Migration Inventory

The current `agent/video-skill-scoring-plan` branch already contains a coherent first migration unit.

### Move to `idol-data-lab`

```text
support/scripts/video_skill_scoring/
support/data/video-skill-benchmark/
support/reports/video-skill-scoring/
support/docs/video-skill-scoring-plan.md
support/docs/video-skill-scoring/
```

Also migrate reality-research skills and scripts discovered during the repository audit, including tools that:

- fetch or verify member/group data;
- maintain discographies, chart/sales data, or social metrics;
- search or prepare idol portraits and group assets;
- scrape public sources and generate game catalog edits;
- retain source citations or research reports.

### Initially retain in `idol-producer-web`

```text
src/data/choreographicCompat.ts
src/ui/choreographyPlayer.ts
src/choreographyPlayerApp.ts
public/choreography-player/
choreography-player.html
```

The formation editor can remain temporarily because it is already integrated with game authoring. During review, decide whether the full editor belongs in the data lab and the game should retain only playback and a lightweight adjustment surface.

### Keep game-facing generated assets

Approved runtime files remain in the game repository, including:

- final game catalog JSON;
- final portrait/logo assets;
- game-used audio previews;
- final Choreographic files used by Live Mode.

Only their research, candidate generation, and source-preparation workflows move.

## 8. Migration Procedure

### Phase A: Freeze and inventory

1. Record the source branch and commit.
2. Inventory all scripts, skills, docs, reports, caches, dependencies, and generated outputs.
3. Classify every item as:
   - game runtime;
   - game authoring;
   - reality research/data-lab;
   - generated runtime asset;
   - obsolete/temporary.
4. Identify imports and commands that cross these boundaries.
5. Do not delete source material until the destination repository has been validated.

### Phase B: Create and scaffold `idol-data-lab`

Recommended initial layout:

```text
idol-data-lab/
  README.md
  pyproject.toml
  requirements/
  schemas/
    internal/
    exchange/
  python/
    idol_data_lab/
      catalog/
      scraping/
      sources/
      media/
      performance/
      assessment/
      export/
  apps/
    review-web/
  skills/
  data/
    imports/
    raw/
    annotations/
    curated/
  reports/
  exports/
    choreography/
    game-patches/
  tests/
```

The first migration may preserve the existing script paths under a compatibility directory, then progressively convert them into importable Python modules.

### Phase C: Import existing tools

1. Copy the video-analysis scripts and preserve behavior.
2. Copy benchmark annotations and small committed reports.
3. Copy related documentation.
4. Move real-world research skills and scripts in functional groups.
5. Update hard-coded repository-relative paths.
6. Add explicit import/export directories.
7. Add a data-lab README describing local-only media and licensing/source expectations.
8. Add `.gitignore` rules for downloaded media, model artifacts, caches, virtual environments, and large raw reports.

### Phase D: Validate the data lab

Minimum acceptance checks:

- Python files compile/import successfully;
- a dry-run choreography job produces a valid Choreographic-compatible document;
- the existing Takane no Nadeshiko pilot annotations parse;
- committed sample JSON files validate;
- the tool runs without access to the game runtime source tree when supplied a catalog export;
- all expected local-only media paths remain gitignored;
- no game save/runtime dependency is imported by analysis code.

### Phase E: Add narrow game exchange adapters

In `idol-producer-web`:

- add a game catalog exporter;
- add a reviewed patch validator/previewer;
- add a patch applier that requires approved changes;
- preserve stable UIDs;
- validate Choreographic imports independently;
- generate a human-readable diff before applying any patch.

The first patch implementation may support only idol attribute suggestions and Choreographic imports.

### Phase F: Slim `idol-producer-web`

Only after the data lab validation passes:

1. Remove migrated video-analysis scripts, benchmark data, reports, and research documentation.
2. Remove migrated reality-research skills and source-scraping scripts.
3. Remove analysis-only Python/ML/OCR dependencies and caches.
4. Update README and support-directory documentation.
5. Replace direct reality-data mutation workflows with patch import workflows.
6. Ensure final approved runtime assets remain present.
7. Ensure the game still builds and tests without the data-lab checkout.

## 9. Validation Matrix

### Data-lab checks

- `python -m compileall` for migrated Python modules;
- schema/sample validation;
- dry-run media pipeline;
- Choreographic export compatibility;
- benchmark manifest and annotation parsing;
- no imports from game runtime modules;
- local media and generated large outputs ignored.

### Game checks

- dependency install;
- TypeScript typecheck;
- production build;
- existing game tests;
- Choreographic player/editor smoke test;
- Live Mode smoke test;
- catalog export smoke test;
- patch validation and dry-run diff;
- repository scan confirming removed scraping/media-analysis dependencies.

### Cross-repository checks

- game catalog export validates in data lab;
- data-lab reviewed patch validates in game;
- stable UID round-trip;
- Choreographic export imports in game without loss of compatible fields;
- game can clone, install, build, and run without the data lab.

## 10. Review Gate Before New Features

After migration and slimming, stop before implementing new data-lab capabilities.

The review should cover:

- repository boundaries;
- migrated file inventory;
- deleted game-repository inventory;
- exchange formats;
- build/test results;
- remaining cross-repository coupling;
- whether the formation editor stays in the game or moves to the data lab;
- whether any reality-research skill remains in the game repository;
- whether game attributes and data-lab evidence are clearly described as different data layers.

Only after this review should development begin on new features such as:

- vocal arrangement editor;
- member-color-assisted identity reassociation;
- richer pose and dance timelines;
- live-to-canonical alignment;
- microphone-state and lead-focus dance variants;
- singing reference alignment and scoring;
- live ad-lib/crowd-interaction annotation;
- multi-video idol ability assessment.

## 11. Completion Criteria

The extraction is complete when:

- `idol-data-lab` contains and validates all migrated reality-research and performance-analysis tools;
- `idol-producer-web` no longer contains raw research workflows or video/audio analysis code;
- the game build does not require Python media/science dependencies, scraping tools, OCR data, or downloaded source material;
- approved runtime assets and Choreographic playback still work;
- game-to-lab catalog export works;
- lab-to-game reviewed patch validation and import work;
- game attributes are documented as fictionalized, curated gameplay estimates;
- both repositories pass their validation suites;
- no new data-lab feature development has begun before the joint architecture review.
