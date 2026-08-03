"""Probe whether a clip is fixed / slight_pan / unstable for v1 choreo compile."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from choreo_common import probe_media


def _try_cv2():
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        return cv2, np
    except Exception:
        return None, None


def probe_camera_stability(
    video_path: Path,
    *,
    sample_every_sec: float = 0.5,
    max_samples: int = 240,
) -> dict[str, Any]:
    """
    Classify camera motion using frame-to-frame grayscale difference.
    fixed: low continuous motion
    slight_pan: moderate continuous motion
    unstable: spikes / high mean (cuts or handheld)
    """
    media = probe_media(video_path)
    cv2, np = _try_cv2()
    result: dict[str, Any] = {
        "schemaVersion": "0.1",
        "videoPath": str(video_path),
        "media": media,
        "cameraMode": "fixed",
        "acceptableForV1": True,
        "metrics": {},
        "backend": "ffprobe-only",
        "notes": None,
    }
    if cv2 is None or np is None:
        result["notes"] = "OpenCV not installed; assumed fixed (install opencv-python-headless for real probe)."
        return result

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        result["cameraMode"] = "unstable"
        result["acceptableForV1"] = False
        result["notes"] = "Could not open video."
        return result

    fps = float(media.get("fps") or cap.get(cv2.CAP_PROP_FPS) or 30.0) or 30.0
    step = max(1, int(round(fps * sample_every_sec)))
    diffs: list[float] = []
    cut_flags = 0
    prev = None
    idx = 0
    samples = 0
    while samples < max_samples:
        ok, frame = cap.read()
        if not ok:
            break
        if idx % step == 0:
            gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
            gray = cv2.resize(gray, (160, 90))
            if prev is not None:
                d = float(np.mean(cv2.absdiff(gray, prev)))
                diffs.append(d)
                if d > 28.0:
                    cut_flags += 1
            prev = gray
            samples += 1
        idx += 1
    cap.release()

    if not diffs:
        result["notes"] = "No frame diffs computed."
        return result

    mean_d = float(np.mean(diffs))
    p95 = float(np.percentile(diffs, 95))
    cut_rate = cut_flags / max(1, len(diffs))
    result["backend"] = "opencv-frame-diff"
    result["metrics"] = {
        "meanAbsDiff": round(mean_d, 3),
        "p95AbsDiff": round(p95, 3),
        "cutLikeRate": round(cut_rate, 4),
        "samples": len(diffs),
    }

    if cut_rate > 0.12 or p95 > 45 or mean_d > 18:
        result["cameraMode"] = "unstable"
        result["acceptableForV1"] = False
        result["notes"] = "High motion or cut-like spikes — not suitable for v1 fixed/slight_pan compile."
    elif mean_d > 6.5 or p95 > 18:
        result["cameraMode"] = "slight_pan"
        result["acceptableForV1"] = True
        result["notes"] = "Moderate continuous motion — treat as slight_pan."
    else:
        result["cameraMode"] = "fixed"
        result["acceptableForV1"] = True
        result["notes"] = "Low global motion — fixed camera."
    return result
