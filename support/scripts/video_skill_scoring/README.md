# Video skill scoring — offline analysis (Phase 1 spike)

Standalone Python tools for extracting vocal/dance features from annotated performance clips,
plus **dance-practice → Choreographic** compile (`compile_choreography.py`).
The web app stays responsible for review UI later; this package only produces versioned JSON.

## Setup

Requires:

- Python 3.11+
- FFmpeg on `PATH`
- For YouTube fetch: `yt-dlp` (`pip install -U yt-dlp`)
- For detect/track: `opencv-python-headless` (in requirements); optional MediaPipe later

```bash
cd support/scripts/video_skill_scoring
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
pip install -U yt-dlp
```

Full choreography docs: [`../../docs/video-skill-scoring/video-to-choreographic.md`](../../docs/video-skill-scoring/video-to-choreographic.md).

## Fetch dance-practice clip

```bash
python support/scripts/video_skill_scoring/fetch_youtube_clip.py ^
  "https://www.youtube.com/watch?v=oB12TDu4dVE" ^
  --out-name takane_kawaikute_gomen_practice
```

## Compile choreography

```bash
python support/scripts/video_skill_scoring/compile_choreography.py ^
  support\data\video-skill-benchmark\clips\takane_kawaikute_gomen_practice.mp4 ^
  support\data\video-skill-benchmark\annotations\takane_kawaikute_gomen_choreo_job.json ^
  --out support\reports\video-skill-scoring
```

Use `--dry-run` for a one-set stub without OpenCV detect. Use `--max-seconds 45` for faster pilots.

## Annotation (skill scoring)

Copy `support/data/video-skill-benchmark/annotations/_example.json` and fill:

- `idolId` — catalog uid
- `segments` — solo_vocal / group_vocal / dance / excluded
- `selectFrameSeconds` — frame used to pick the performer (pose tracking)

Choreo jobs: `_choreo_job_example.json` / `takane_kawaikute_gomen_choreo_job.json`.

Register clip paths in `support/data/video-skill-benchmark/manifest.json`.

## Run skill analysis

From repo root (with the package on `PYTHONPATH` or as a module path):

```bash
python support/scripts/video_skill_scoring/analyze_video.py ^
  path\to\clip.mp4 ^
  support\data\video-skill-benchmark\annotations\your_annotation.json ^
  --out support\reports\video-skill-scoring
```

Without optional scientific deps, the script still:

1. probes the video with FFmpeg/ffprobe;
2. extracts normalized mono WAV;
3. writes a schema-versioned analysis JSON with usable-duration heuristics and empty/placeholder features.

With `librosa` installed, pitch / onset / loudness features are computed on solo_vocal segments.
Pose features require MediaPipe and are skipped until installed.

## Outputs

One JSON per video under `--out`, matching the plan’s spike schema (`schemaVersion` `0.1`).
Suggestions stay `null` until Phase 2 calibration exists.

Choreo compile also writes `*_camera.json`, `*_timeline.json`, `*_choreographic.json`.
