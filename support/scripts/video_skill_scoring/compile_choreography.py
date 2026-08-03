#!/usr/bin/env python3
"""Compile dance-practice video + choreo job → Choreographic compat JSON."""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from choreo_common import MODEL_VERSION, load_job, probe_media, write_json
from cluster_formations import cluster_formation_holds
from detect_people import sample_detections
from export_choreographic import export_choreographic_document
from probe_camera import probe_camera_stability
from seed_identities import seed_identities
from track_people import track_detections


def _stem(video: Path, job: dict) -> str:
    yid = ((job.get("sourceVideo") or {}) if isinstance(job.get("sourceVideo"), dict) else {}).get(
        "youtubeId"
    )
    if yid:
        return f"choreo_{yid}"
    return f"choreo_{video.stem}"


def compile_choreography(
    video_path: Path,
    job: dict,
    *,
    dry_run: bool = False,
    max_seconds: float | None = None,
    allow_unstable: bool = False,
) -> dict:
    media = probe_media(video_path)
    camera = probe_camera_stability(video_path)
    if not camera.get("acceptableForV1") and not allow_unstable and not dry_run:
        raise SystemExit(
            f"Camera probe marked clip as {camera.get('cameraMode')} — not suitable for v1. "
            "Use --allow-unstable to force, or --dry-run for a stub."
        )

    sample_fps = float(job.get("sampleFps") or 2.0)
    expected = job.get("expectedMemberCount")
    expected_n = int(expected) if expected else len(job.get("crew") or [])
    mirror_x = bool(job.get("mirrorX", True))

    if dry_run:
        tracked = []
        track_map: dict = {}
        holds = []
        backend = "dry-run"
    else:
        sampled = sample_detections(
            video_path,
            sample_fps=sample_fps,
            max_seconds=max_seconds,
            max_people=max(expected_n + 4, 12),
        )
        tracked = track_detections(sampled)
        tracked, track_map = seed_identities(
            tracked,
            list(job.get("openingMarks") or []),
            mirror_x=mirror_x,
        )
        holds = cluster_formation_holds(
            tracked,
            expected_member_count=expected_n or None,
        )
        backend = "opencv-hog+track" if tracked else "empty-detect"

    notes = (
        f"Compiled by {MODEL_VERSION}; camera={camera.get('cameraMode')}; "
        f"backend={backend}; mirrorX={mirror_x}."
    )
    doc = export_choreographic_document(job, holds, mirror_x=mirror_x, source_notes=notes)

    timeline = {
        "schemaVersion": "0.1",
        "modelVersion": MODEL_VERSION,
        "videoPath": str(video_path),
        "media": media,
        "camera": camera,
        "sampleFps": sample_fps,
        "maxSeconds": max_seconds,
        "dryRun": dry_run,
        "trackToIdol": {str(k): v for k, v in track_map.items()},
        "frames": tracked,
        "holds": holds,
    }
    return {"document": doc, "timeline": timeline, "camera": camera, "media": media}


def main() -> int:
    ap = argparse.ArgumentParser(description="Compile dance-practice video to Choreographic JSON")
    ap.add_argument("video", type=Path, help="Local MP4 path")
    ap.add_argument("job", type=Path, help="Choreo job JSON")
    ap.add_argument(
        "--out",
        type=Path,
        default=Path("support/reports/video-skill-scoring"),
        help="Output directory",
    )
    ap.add_argument("--dry-run", action="store_true", help="Skip detect/track; stub from openingMarks/crew")
    ap.add_argument("--max-seconds", type=float, default=None, help="Limit analysis window")
    ap.add_argument("--allow-unstable", action="store_true", help="Compile even if camera probe fails")
    args = ap.parse_args()

    if not args.video.exists():
        print(f"Video not found: {args.video}", file=sys.stderr)
        return 1
    job = load_job(args.job)
    result = compile_choreography(
        args.video,
        job,
        dry_run=args.dry_run,
        max_seconds=args.max_seconds,
        allow_unstable=args.allow_unstable,
    )
    stem = _stem(args.video, job)
    out: Path = args.out
    cam_path = out / f"{stem}_camera.json"
    tl_path = out / f"{stem}_timeline.json"
    doc_path = out / f"{stem}_choreographic.json"
    write_json(cam_path, result["camera"])
    write_json(tl_path, result["timeline"])
    write_json(doc_path, result["document"])
    print(f"camera:  {cam_path}")
    print(f"timeline:{tl_path}")
    print(f"choreo:  {doc_path}")
    print(
        f"formations={len(result['document'].get('formations') or [])} "
        f"cameraMode={result['camera'].get('cameraMode')} "
        f"dryRun={args.dry_run}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
