"""Seed track identities from opening click-marks; propagate along tracks."""

from __future__ import annotations

from typing import Any


def seed_identities(
    tracked_frames: list[dict[str, Any]],
    opening_marks: list[dict[str, Any]],
    *,
    mirror_x: bool = False,
    match_radius: float = 16.0,
) -> tuple[list[dict[str, Any]], dict[int, str]]:
    """
    Returns (frames with idolUid on detections when known, trackId→idolUid map).
    Marks are in video-frame space; if mirror_x, stage apply flips later — marks stay as clicked.
    """
    if not opening_marks or not tracked_frames:
        return tracked_frames, {}

    # Prefer frame nearest to median mark time (or first frame).
    times = [float(m.get("frameSeconds") or 0.0) for m in opening_marks]
    target_t = sorted(times)[len(times) // 2] if times else 0.0
    seed_frame = min(tracked_frames, key=lambda f: abs(float(f.get("t") or 0.0) - target_t))
    dets = list(seed_frame.get("detections") or [])
    used: set[int] = set()
    track_to_idol: dict[int, str] = {}

    for mark in opening_marks:
        uid = str(mark.get("idolUid") or "").strip()
        if not uid:
            continue
        mx = float(mark.get("x") or 50.0)
        my = float(mark.get("y") or 50.0)
        # Marks stored as clicked on video; no extra flip here.
        best_i = -1
        best_d = match_radius**2
        for i, d in enumerate(dets):
            if i in used:
                continue
            dist = (float(d["x"]) - mx) ** 2 + (float(d["y"]) - my) ** 2
            if dist < best_d:
                best_d = dist
                best_i = i
        if best_i < 0:
            continue
        used.add(best_i)
        tid = int(dets[best_i]["trackId"])
        track_to_idol[tid] = uid

    out: list[dict[str, Any]] = []
    for fr in tracked_frames:
        ndets = []
        for d in fr.get("detections") or []:
            tid = int(d["trackId"])
            row = dict(d)
            if tid in track_to_idol:
                row["idolUid"] = track_to_idol[tid]
            ndets.append(row)
        out.append({**fr, "detections": ndets})
    _ = mirror_x  # documented for callers; stage flip happens at export
    return out, track_to_idol
