"""Frame-to-frame multi-person tracking via Hungarian assignment on XY distance."""

from __future__ import annotations

from typing import Any

import numpy as np

try:
    from scipy.optimize import linear_sum_assignment
except Exception:  # pragma: no cover
    linear_sum_assignment = None  # type: ignore


def _greedy_assign(cost: np.ndarray, max_cost: float) -> list[tuple[int, int]]:
    pairs: list[tuple[int, int]] = []
    used_r: set[int] = set()
    used_c: set[int] = set()
    flat = [(cost[r, c], r, c) for r in range(cost.shape[0]) for c in range(cost.shape[1])]
    flat.sort()
    for d, r, c in flat:
        if d > max_cost:
            break
        if r in used_r or c in used_c:
            continue
        used_r.add(r)
        used_c.add(c)
        pairs.append((r, c))
    return pairs


def track_detections(
    sampled_frames: list[dict[str, Any]],
    *,
    max_match_dist: float = 18.0,
) -> list[dict[str, Any]]:
    """
    Attach trackId to each detection across frames.
    Returns frames with detections[{trackId,x,y}].
    """
    next_id = 1
    prev: list[dict[str, Any]] = []
    out_frames: list[dict[str, Any]] = []

    for fr in sampled_frames:
        dets = [{"x": float(d["x"]), "y": float(d["y"])} for d in fr.get("detections") or []]
        if not dets:
            out_frames.append({**fr, "detections": []})
            prev = []
            continue
        if not prev:
            assigned = []
            for d in dets:
                tid = next_id
                next_id += 1
                assigned.append({**d, "trackId": tid})
            out_frames.append({**fr, "detections": assigned})
            prev = assigned
            continue

        n, m = len(prev), len(dets)
        cost = np.full((n, m), 1e6, dtype=float)
        for i, p in enumerate(prev):
            for j, d in enumerate(dets):
                cost[i, j] = (p["x"] - d["x"]) ** 2 + (p["y"] - d["y"]) ** 2

        max_cost = max_match_dist**2
        if linear_sum_assignment is not None:
            ri, ci = linear_sum_assignment(cost)
            pairs = [(int(r), int(c)) for r, c in zip(ri, ci) if cost[r, c] <= max_cost]
        else:
            pairs = _greedy_assign(cost, max_cost)

        matched_prev = {r for r, _ in pairs}
        matched_det = {c for _, c in pairs}
        assigned: list[dict[str, Any]] = [None] * m  # type: ignore
        for r, c in pairs:
            assigned[c] = {**dets[c], "trackId": prev[r]["trackId"]}
        for j, d in enumerate(dets):
            if j in matched_det:
                continue
            tid = next_id
            next_id += 1
            assigned[j] = {**d, "trackId": tid}
        clean = [a for a in assigned if a is not None]
        out_frames.append({**fr, "detections": clean})
        prev = clean
        _ = matched_prev
    return out_frames
