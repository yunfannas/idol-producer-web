#!/usr/bin/env python3
"""Download a YouTube clip into gitignored video-skill-benchmark/clips/ via yt-dlp."""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import parse_qs, urlparse

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CLIPS = REPO_ROOT / "support" / "data" / "video-skill-benchmark" / "clips"


def extract_youtube_id(url: str) -> str | None:
    raw = url.strip()
    if re.fullmatch(r"[\w-]{11}", raw):
        return raw
    parsed = urlparse(raw)
    if parsed.hostname and "youtu.be" in parsed.hostname:
        return parsed.path.strip("/").split("/")[0] or None
    qs = parse_qs(parsed.query)
    if "v" in qs and qs["v"]:
        return qs["v"][0]
    m = re.search(r"/(?:shorts|embed|live)/([\w-]{11})", parsed.path or "")
    return m.group(1) if m else None


def bare_watch_url(youtube_id: str) -> str:
    return f"https://www.youtube.com/watch?v={youtube_id}"


def main() -> int:
    ap = argparse.ArgumentParser(description="Fetch YouTube dance-practice clip with yt-dlp")
    ap.add_argument("url", help="YouTube watch URL or 11-char video id")
    ap.add_argument(
        "--out-dir",
        type=Path,
        default=DEFAULT_CLIPS,
        help="Output directory (default: video-skill-benchmark/clips)",
    )
    ap.add_argument("--out-name", default=None, help="Basename without extension")
    ap.add_argument("--max-height", type=int, default=1080)
    args = ap.parse_args()

    if shutil.which("yt-dlp") is None:
        print("yt-dlp not found. Install: pip install -U yt-dlp", file=sys.stderr)
        return 1
    if shutil.which("ffmpeg") is None:
        print("ffmpeg not found on PATH (needed to merge YouTube streams).", file=sys.stderr)
        return 1

    yid = extract_youtube_id(args.url)
    if not yid:
        print("Could not parse YouTube video id from URL.", file=sys.stderr)
        return 1
    watch = bare_watch_url(yid)
    out_dir: Path = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    basename = args.out_name or f"yt_{yid}"
    out_tmpl = str(out_dir / f"{basename}.%(ext)s")
    fmt = (
        f"bv*[height<={args.max_height}][ext=mp4]+ba[ext=m4a]/"
        f"bv*[height<={args.max_height}]+ba/b"
    )
    cmd = [
        "yt-dlp",
        "-f",
        fmt,
        "--merge-output-format",
        "mp4",
        "-o",
        out_tmpl,
        "--no-playlist",
        watch,
    ]
    print("Running:", " ".join(cmd))
    proc = subprocess.run(cmd, text=True)
    if proc.returncode != 0:
        return proc.returncode

    mp4 = out_dir / f"{basename}.mp4"
    if not mp4.exists():
        # yt-dlp may choose another ext; pick newest matching basename.*
        candidates = sorted(out_dir.glob(f"{basename}.*"), key=lambda p: p.stat().st_mtime, reverse=True)
        candidates = [p for p in candidates if p.suffix.lower() in {".mp4", ".mkv", ".webm"}]
        if not candidates:
            print("Download finished but output file not found.", file=sys.stderr)
            return 1
        mp4 = candidates[0]

    sidecar = {
        "youtubeId": yid,
        "youtubeUrl": watch,
        "localPath": str(mp4.relative_to(REPO_ROOT)).replace("\\", "/"),
        "fetchedAt": datetime.now(timezone.utc).isoformat(),
        "tool": "yt-dlp",
        "formatSelector": fmt,
        "notes": "Local research/calibration only. Do not commit the media file.",
    }
    side_path = out_dir / f"{basename}.source.json"
    side_path.write_text(json.dumps(sidecar, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {mp4}")
    print(f"Wrote {side_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
