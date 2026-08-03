# Video → full-length Choreographic record

Companion to [`choreographic-compatibility.md`](./choreographic-compatibility.md) and [`song-starting-formations.md`](./song-starting-formations.md).

## Goal

Turn an **official dance practice** MP4 (fixed or slightly moving camera) into `idol-producer-choreographic-compat` JSON: `crew` + multi-set `formations[]` with hold / transition times.

Starting formation = `formations[startingFormationIndex]` (usually `0`). Import in the Formation editor via **Import JSON**.

## Camera contract (v1)

| Mode | Supported |
| --- | --- |
| `fixed` | Tripod / locked-off practice room |
| `slight_pan` | Slow continuous pan/zoom; stage frame mostly stable |
| Unstable / hard cuts / multi-cam | **Out of scope** — probe warns or soft-fails |

Ideal source: [高嶺のなでしこ「可愛くてごめん」dance practice](https://www.youtube.com/watch?v=oB12TDu4dVE). Many practice videos are **左右反転** — jobs default `mirrorX: true`.

## Job annotation

See [`../data/video-skill-benchmark/annotations/_choreo_job_example.json`](../data/video-skill-benchmark/annotations/_choreo_job_example.json) and the Takane pilot job [`takane_kawaikute_gomen_choreo_job.json`](../data/video-skill-benchmark/annotations/takane_kawaikute_gomen_choreo_job.json).

Fields: `crew`, `openingMarks` (optional; from editor **Export choreo job**), `mirrorX`, `cameraMode`, `sampleFps`, `sourceVideo`.

Dense intermediate timeline (per-frame tracks) is written next to the export under `support/reports/video-skill-scoring/`.

## YouTube → local MP4

Clips are **gitignored** under `support/data/video-skill-benchmark/clips/`. For local research only; do not commit binaries.

Requires [yt-dlp](https://github.com/yt-dlp/yt-dlp) and **ffmpeg** on `PATH`.

```bash
pip install -U yt-dlp

python support/scripts/video_skill_scoring/fetch_youtube_clip.py ^
  "https://www.youtube.com/watch?v=oB12TDu4dVE" ^
  --out-name takane_kawaikute_gomen_practice
```

Or raw yt-dlp:

```bash
yt-dlp ^
  -f "bv*[height<=1080][ext=mp4]+ba[ext=m4a]/bv*[height<=1080]+ba/b" ^
  --merge-output-format mp4 ^
  -o "support/data/video-skill-benchmark/clips/takane_kawaikute_gomen_practice.%(ext)s" ^
  "https://www.youtube.com/watch?v=oB12TDu4dVE"
```

## Compile

```bash
cd support/scripts/video_skill_scoring
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt

# From repo root:
python support/scripts/video_skill_scoring/compile_choreography.py ^
  support\data\video-skill-benchmark\clips\takane_kawaikute_gomen_practice.mp4 ^
  support\data\video-skill-benchmark\annotations\takane_kawaikute_gomen_choreo_job.json ^
  --out support\reports\video-skill-scoring
```

Flags:

- `--dry-run` — no ML; emit one formation from `openingMarks` (or evenly spaced stub crew positions)
- `--max-seconds N` — limit analysis window (useful for first pilots)

Without MediaPipe/OpenCV, the compiler still produces a valid one-set stub so wiring stays testable.

## Pipeline

```text
MP4 → camera probe → sample @ sampleFps
    → detect people → track → seed IDs from openingMarks
    → cluster holds / transitions → choreographic compat JSON
```

## Editor workflow

1. Formation editor → **From video** → mark opening members (optional but recommended).
2. **Export choreo job** → save next to the annotation folder / merge into the job JSON.
3. Run `compile_choreography.py`.
4. **Import JSON** the `*_choreographic.json` result (full timeline stored on `formation.choreography`).

## Outputs

Under `--out` (default `support/reports/video-skill-scoring`):

| File | Content |
| --- | --- |
| `*_camera.json` | Stability probe (`fixed` / `slight_pan` / `unstable`) |
| `*_timeline.json` | Dense tracked positions |
| `*_choreographic.json` | Compat document for Import JSON |

## Pilot: 高嶺のなでしこ「可愛くてごめん」

Commands used:

```bash
pip install -U yt-dlp numpy scipy opencv-python-headless

python support/scripts/video_skill_scoring/fetch_youtube_clip.py ^
  "https://www.youtube.com/watch?v=oB12TDu4dVE" ^
  --out-name takane_kawaikute_gomen_practice

python support/scripts/video_skill_scoring/compile_choreography.py ^
  support\data\video-skill-benchmark\clips\takane_kawaikute_gomen_practice.mp4 ^
  support\data\video-skill-benchmark\annotations\takane_kawaikute_gomen_choreo_job.json ^
  --out support\reports\video-skill-scoring
```

Observed on this machine (OpenCV 5 without HOG → **motion-blob** backend):

- Media: 1920×1080, ~224s, 29.97 fps
- Camera probe: **`slight_pan`** (acceptable for v1; cut-like rate 0)
- Output: `choreo_oB12TDu4dVE_choreographic.json` — multi-set timeline; Import JSON parses in the web app
- Without `openingMarks`, unlabeled tracks are spatially assigned onto the 10-member crew (identity is approximate until marks are exported from the editor)

Improve identity next: mark opening members in **From video** → **Export choreo job** → re-compile.
