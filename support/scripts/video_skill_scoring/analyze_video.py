"""Analyze one annotated performance video into a versioned feature JSON."""

from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import tempfile
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


SCHEMA_VERSION = "0.1"
MODEL_VERSION = "spike-preprocess-0.1"


def _run(cmd: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(cmd, check=check, text=True, capture_output=True)


def require_ffmpeg() -> None:
    if shutil.which("ffmpeg") is None or shutil.which("ffprobe") is None:
        raise SystemExit("ffmpeg and ffprobe must be on PATH")


def probe_media(video_path: Path) -> dict[str, Any]:
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
    raw = _run(cmd).stdout
    data = json.loads(raw)
    duration = float(data.get("format", {}).get("duration") or 0.0)
    width = height = None
    for stream in data.get("streams", []):
        if stream.get("codec_type") == "video":
            width = stream.get("width")
            height = stream.get("height")
            break
    return {
        "durationSeconds": duration,
        "width": width,
        "height": height,
        "formatName": data.get("format", {}).get("format_name"),
    }


def extract_normalized_wav(video_path: Path, wav_path: Path) -> None:
    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(video_path),
        "-vn",
        "-ac",
        "1",
        "-ar",
        "22050",
        "-af",
        "loudnorm=I=-16:TP=-1.5:LRA=11",
        str(wav_path),
    ]
    proc = _run(cmd, check=False)
    if proc.returncode != 0:
        raise SystemExit(f"ffmpeg audio extract failed:\n{proc.stderr[-2000:]}")


def load_annotation(path: Path) -> dict[str, Any]:
    data = json.loads(path.read_text(encoding="utf-8-sig"))
    if not data.get("idolId"):
        raise SystemExit("annotation.idolId is required")
    return data


def segment_duration(segments: list[dict[str, Any]], segment_type: str) -> float:
    total = 0.0
    for seg in segments:
        if seg.get("segmentType") != segment_type:
            continue
        start = float(seg.get("startSeconds") or 0.0)
        end = float(seg.get("endSeconds") or 0.0)
        if end > start:
            total += end - start
    return total


def estimate_source_quality(probe: dict[str, Any], usable_seconds: float) -> float:
    height = int(probe.get("height") or 0)
    duration = float(probe.get("durationSeconds") or 0.0)
    res_score = 0.4
    if height >= 1080:
        res_score = 1.0
    elif height >= 720:
        res_score = 0.8
    elif height >= 480:
        res_score = 0.55
    coverage = 0.0 if duration <= 0 else min(1.0, usable_seconds / max(30.0, duration * 0.35))
    return round(0.55 * res_score + 0.45 * coverage, 3)


def try_librosa_features(wav_path: Path, annotation: dict[str, Any]) -> dict[str, float | None]:
    features: dict[str, float | None] = {
        "pitchAccuracy50Cents": None,
        "longNotePitchStdCents": None,
        "onsetErrorMs": None,
        "voicedFrameRatio": None,
        "loudnessStdDb": None,
    }
    try:
        import librosa  # type: ignore
        import numpy as np  # type: ignore
    except ImportError:
        return features

    y, sr = librosa.load(str(wav_path), sr=22050, mono=True)
    solo = [
        seg
        for seg in annotation.get("segments", [])
        if seg.get("segmentType") == "solo_vocal"
        and float(seg.get("endSeconds") or 0) > float(seg.get("startSeconds") or 0)
    ]
    if not solo:
        # Fall back to whole clip for smoke tests.
        solo = [{"startSeconds": 0.0, "endSeconds": len(y) / sr}]

    f0_chunks: list[Any] = []
    rms_chunks: list[Any] = []
    voiced_flags: list[Any] = []
    for seg in solo:
        start = int(float(seg["startSeconds"]) * sr)
        end = int(float(seg["endSeconds"]) * sr)
        chunk = y[max(0, start) : min(len(y), end)]
        if chunk.size < sr // 4:
            continue
        f0 = librosa.yin(chunk, fmin=80, fmax=1000, sr=sr)
        f0_chunks.append(f0)
        rms = librosa.feature.rms(y=chunk)[0]
        rms_chunks.append(rms)
        voiced_flags.append(np.isfinite(f0) & (f0 > 0))

    if not f0_chunks:
        return features

    f0_all = np.concatenate(f0_chunks)
    voiced = np.concatenate(voiced_flags)
    voiced_f0 = f0_all[voiced]
    features["voicedFrameRatio"] = float(voiced.mean()) if voiced.size else None

    if voiced_f0.size > 8:
        # Without a melody reference, use local median as a crude stability proxy
        # (not pitch "accuracy"). Real accuracy needs MIDI/studio alignment in Phase 1+.
        med = float(np.median(voiced_f0))
        cents = 1200.0 * np.log2(np.maximum(voiced_f0, 1e-6) / med)
        features["longNotePitchStdCents"] = float(np.std(cents))
        features["pitchAccuracy50Cents"] = float(np.mean(np.abs(cents) <= 50.0))

    if rms_chunks:
        rms_all = np.concatenate(rms_chunks)
        db = 20.0 * np.log10(np.maximum(rms_all, 1e-8))
        features["loudnessStdDb"] = float(np.std(db))

    # Onset timing vs beats — still reference-free; report mean abs residual to nearest beat.
    onset_env = librosa.onset.onset_strength(y=y, sr=sr)
    tempo, beats = librosa.beat.beat_track(onset_envelope=onset_env, sr=sr)
    onset_frames = librosa.onset.onset_detect(onset_envelope=onset_env, sr=sr)
    if beats.size and onset_frames.size:
        onset_times = librosa.frames_to_time(onset_frames, sr=sr)
        beat_times = librosa.frames_to_time(beats, sr=sr)
        errs = []
        for t in onset_times:
            errs.append(float(np.min(np.abs(beat_times - t)) * 1000.0))
        features["onsetErrorMs"] = float(np.mean(errs)) if errs else None
        _ = tempo  # retained for future export

    return features


def placeholder_dance_features() -> dict[str, float | None]:
    return {
        "movementRange": None,
        "beatAlignment": None,
        "lateSongMotionDecay": None,
        "poseTrackCoverage": None,
    }


def degradation_placeholders() -> dict[str, float | None]:
    return {
        "liveVocalDegradation": None,
        "earlyLateLoudnessDeltaDb": None,
    }


def build_result(
    video_path: Path,
    annotation: dict[str, Any],
    probe: dict[str, Any],
    vocal_features: dict[str, float | None],
    dance_features: dict[str, float | None],
    degradation: dict[str, float | None],
) -> dict[str, Any]:
    segments = list(annotation.get("segments") or [])
    solo_seconds = segment_duration(segments, "solo_vocal")
    dance_seconds = segment_duration(segments, "dance")
    usable = max(solo_seconds, dance_seconds * 0.5, min(probe["durationSeconds"], 30.0) * 0.25)
    source_quality = estimate_source_quality(probe, usable)

    features = {
        **vocal_features,
        **dance_features,
        **degradation,
    }

    return {
        "schemaVersion": SCHEMA_VERSION,
        "modelVersion": MODEL_VERSION,
        "evaluatedAt": datetime.now(timezone.utc).isoformat(),
        "idolId": annotation["idolId"],
        "idolName": annotation.get("idolName"),
        "videoId": annotation.get("videoId") or video_path.stem,
        "videoPath": str(video_path),
        "clipKind": annotation.get("clipKind"),
        "usableDurationSeconds": round(usable, 2),
        "soloVocalSeconds": round(solo_seconds, 2),
        "danceSegmentSeconds": round(dance_seconds, 2),
        "sourceQuality": source_quality,
        "media": probe,
        "features": features,
        "suggestions": {
            "singing": None,
            "dancing": None,
            "stamina": None,
            "singDanceStability": None,
        },
        "notes": [
            "Suggestions remain null until Phase 2 calibration.",
            "pitchAccuracy50Cents without a melody reference is a stability proxy around local median F0.",
            "Pose / dance features require MediaPipe (not installed by default).",
        ],
    }


def analyze(video_path: Path, annotation_path: Path, out_dir: Path) -> Path:
    require_ffmpeg()
    annotation = load_annotation(annotation_path)
    if not video_path.is_file():
        raise SystemExit(f"video not found: {video_path}")

    probe = probe_media(video_path)
    out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory(prefix="video_skill_") as tmp:
        wav_path = Path(tmp) / "audio.wav"
        extract_normalized_wav(video_path, wav_path)
        vocal = try_librosa_features(wav_path, annotation)

    result = build_result(
        video_path=video_path,
        annotation=annotation,
        probe=probe,
        vocal_features=vocal,
        dance_features=placeholder_dance_features(),
        degradation=degradation_placeholders(),
    )

    out_name = f"{result['videoId']}__analysis.json"
    out_path = out_dir / out_name
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return out_path


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("video", type=Path, help="Path to performance video")
    parser.add_argument("annotation", type=Path, help="Path to annotation JSON")
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("support/reports/video-skill-scoring"),
        help="Output directory for analysis JSON",
    )
    args = parser.parse_args(argv)
    out_path = analyze(args.video.resolve(), args.annotation.resolve(), args.out.resolve())
    print(f"Wrote {out_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
