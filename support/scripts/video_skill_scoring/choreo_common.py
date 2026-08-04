"""Shared helpers for choreography compile from dance-practice video."""

from __future__ import annotations

import json
import shutil
import subprocess
from pathlib import Path
from typing import Any

CHOREO_FORMAT = "idol-producer-choreographic-compat"
CHOREO_VERSION = "0.1"
MODEL_VERSION = "choreo-compile-0.1"


def clamp100(n: float) -> float:
    if not isinstance(n, (int, float)) or n != n:  # NaN
        return 50.0
    return max(0.0, min(100.0, float(n)))


def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise SystemExit("ffmpeg and ffprobe must be on PATH")


def probe_media(video_path: Path) -> dict[str, Any]:
    require_ffmpeg()
    cmd = [
        "ffprobe",
        "-v",
        "error",
        "-print_format",
        "json",
        "-show_format",
        "-show_streams",
        str(video_path),
    ]
    raw = subprocess.run(cmd, check=True, text=True, capture_output=True).stdout
    data = json.loads(raw)
    duration = float(data.get("format", {}).get("duration") or 0.0)
    width = height = fps = None
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = stream.get("width")
            height = stream.get("height")
            rate = stream.get("avg_frame_rate") or stream.get("r_frame_rate") or "0/1"
            try:
                a, b = rate.split("/")
                fps = float(a) / float(b) if float(b) else None
            except Exception:
                fps = None
            break
    return {
        "durationSeconds": duration,
        "width": width,
        "height": height,
        "fps": fps,
        "formatName": data.get("format", {}).get("format_name"),
    }


def load_job(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not isinstance(data, dict):
        raise SystemExit("job JSON must be an object")
    if not data.get("crew"):
        raise SystemExit("job.crew is required")
    return data


def write_json(path: Path, data: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
