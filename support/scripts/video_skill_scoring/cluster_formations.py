"""Cluster tracked frames into formation holds vs transitions."""

from __future__ import annotations

from typing import Any

import numpy as np


def _formation_signature(dets: list[dict[str, Any]], n_expected: int | None) -> np.ndarray | None:
    if not dets:
        return None
    pts = sorted([(float(d["x"]), float(d["y"])) for d in dets], key=lambda p: (p[1], p[0]))
    if n_expected and len(pts) > n_expected:
        # keep n closest to centroid
        cx = sum(p[0] for p in pts) / len(pts)
        cy = sum(p[1] for p in pts) / len(pts)
        pts = sorted(pts, key=lambda p: (p[0] - cx) ** 2 + (p[1] - cy) ** 2)[:n_expected]
        pts = sorted(pts, key=lambda p: (p[1], p[0]))
    # Pad / truncate to fixed length for comparison
    target = n_expected or len(pts)
    if target <= 0:
        return None
    while len(pts) < target:
        pts.append((50.0, 50.0))
    pts = pts[:target]
    arr = np.array(pts, dtype=float).reshape(-1)
    # Center-normalize to reduce slight camera drift impact
    xs = arr[0::2]
    ys = arr[1::2]
    arr[0::2] = xs - xs.mean()
    arr[1::2] = ys - ys.mean()
    return arr


def _sig_dist(a: np.ndarray | None, b: np.ndarray | None) -> float:
    if a is None or b is None:
        return 1e9
    if a.shape != b.shape:
        n = min(a.size, b.size)
        if n == 0:
            return 1e9
        a = a[:n]
        b = b[:n]
    return float(np.linalg.norm(a - b) / max(1.0, np.sqrt(a.size)))


def cluster_formation_holds(
    tracked_frames: list[dict[str, Any]],
    *,
    expected_member_count: int | None = None,
    change_threshold: float = 5.5,
    min_hold_sec: float = 1.8,
    stable_frames: int = 2,
) -> list[dict[str, Any]]:
    """
    Emit holds: {startT, endT, positions:[{idolUid|trackId,x,y}], transitionInSec}.
    Positions are median over the hold window.
    """
    if not tracked_frames:
        return []

    sigs = [
        _formation_signature(list(fr.get("detections") or []), expected_member_count)
        for fr in tracked_frames
    ]
    # Label change points
    is_change = [False] * len(tracked_frames)
    for i in range(1, len(tracked_frames)):
        if _sig_dist(sigs[i], sigs[i - 1]) >= change_threshold:
            is_change[i] = True

    # Build segments between change runs
    segments: list[tuple[int, int]] = []
    start = 0
    for i in range(1, len(tracked_frames)):
        if is_change[i]:
            # require stability: look ahead
            ok = True
            for k in range(i, min(len(tracked_frames), i + stable_frames)):
                if _sig_dist(sigs[k], sigs[i]) > change_threshold * 0.85:
                    ok = False
                    break
            if ok:
                segments.append((start, i - 1))
                start = i
    segments.append((start, len(tracked_frames) - 1))

    holds: list[dict[str, Any]] = []
    prev_end_t = 0.0
    for si, (a, b) in enumerate(segments):
        t0 = float(tracked_frames[a]["t"])
        t1 = float(tracked_frames[b]["t"])
        dur = max(0.0, t1 - t0)
        if dur < min_hold_sec and si not in (0, len(segments) - 1) and len(segments) > 2:
            continue
        # Median positions by trackId (or idolUid); keep persistent tracks only.
        window = tracked_frames[a : b + 1]
        frame_n = max(1, len(window))
        buckets: dict[str, list[tuple[float, float]]] = {}
        id_key: dict[str, str] = {}
        for fr in window:
            for d in fr.get("detections") or []:
                key = str(d.get("idolUid") or f"track-{d.get('trackId')}")
                buckets.setdefault(key, []).append((float(d["x"]), float(d["y"])))
                if d.get("idolUid"):
                    id_key[key] = str(d["idolUid"])
        min_hits = max(3, min(40, int(frame_n * 0.06)))
        ranked_keys = sorted(buckets.keys(), key=lambda k: len(buckets[k]), reverse=True)
        persistent = [k for k in ranked_keys if len(buckets[k]) >= min_hits or id_key.get(k)]
        if expected_member_count:
            chosen = (persistent or ranked_keys)[: max(1, expected_member_count)]
        else:
            chosen = (persistent or ranked_keys)[:16]
        positions = []
        for key in chosen:
            pts = buckets[key]
            xs = sorted(p[0] for p in pts)
            ys = sorted(p[1] for p in pts)
            mid = len(pts) // 2
            tid = None
            if key.startswith("track-"):
                try:
                    tid = int(key.split("-", 1)[1])
                except Exception:
                    tid = None
            positions.append(
                {
                    "key": key,
                    "idolUid": id_key.get(key),
                    "trackId": tid,
                    "x": xs[mid],
                    "y": ys[mid],
                    "hits": len(pts),
                }
            )
        transition = 0.0 if not holds else max(0.0, t0 - prev_end_t)
        holds.append(
            {
                "startT": t0,
                "endT": t1,
                "durationSec": dur if dur > 0 else min_hold_sec,
                "transitionInSec": transition,
                "positions": positions,
            }
        )
        prev_end_t = t1
    return holds
