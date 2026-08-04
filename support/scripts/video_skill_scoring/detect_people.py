"""Multi-person body-center detection in frame percent coords (audience/camera view)."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from choreo_common import clamp100


def _try_cv2():
    try:
        import cv2  # type: ignore
        import numpy as np  # type: ignore

        return cv2, np
    except Exception:
        return None, None


def _detect_hog(cv2, frame_bgr, max_people: int) -> list[dict[str, float]]:
    if not hasattr(cv2, "HOGDescriptor"):
        return []
    h, w = frame_bgr.shape[:2]
    hog = cv2.HOGDescriptor()
    hog.setSVMDetector(cv2.HOGDescriptor_getDefaultPeopleDetector())
    rects, weights = hog.detectMultiScale(frame_bgr, winStride=(8, 8), padding=(8, 8), scale=1.05)
    people: list[tuple[float, dict[str, float]]] = []
    for (x, y, bw, bh), wt in zip(rects, weights):
        cx = (x + bw / 2) / max(1, w) * 100
        cy = (y + bh * 0.55) / max(1, h) * 100
        people.append((float(wt) if hasattr(wt, "__float__") else 1.0, {"x": clamp100(cx), "y": clamp100(cy)}))
    people.sort(key=lambda t: t[0], reverse=True)
    out: list[dict[str, float]] = []
    for _, p in people:
        if any((p["x"] - q["x"]) ** 2 + (p["y"] - q["y"]) ** 2 < 6**2 for q in out):
            continue
        out.append(p)
        if len(out) >= max_people:
            break
    return out


def _detect_motion_blobs(cv2, np, frame_bgr, prev_gray, max_people: int):
    """Fallback for OpenCV builds without HOG: motion blobs vs previous frame."""
    h, w = frame_bgr.shape[:2]
    gray = cv2.cvtColor(frame_bgr, cv2.COLOR_BGR2GRAY)
    gray = cv2.GaussianBlur(gray, (9, 9), 0)
    if prev_gray is None:
        return [], gray
    diff = cv2.absdiff(prev_gray, gray)
    _, th = cv2.threshold(diff, 18, 255, cv2.THRESH_BINARY)
    th = cv2.dilate(th, None, iterations=2)
    contours, _ = cv2.findContours(th, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    blobs: list[tuple[float, dict[str, float]]] = []
    min_area = (w * h) * 0.002
    max_area = (w * h) * 0.25
    for cnt in contours:
        area = float(cv2.contourArea(cnt))
        if area < min_area or area > max_area:
            continue
        x, y, bw, bh = cv2.boundingRect(cnt)
        aspect = bw / max(1, bh)
        if aspect > 2.8 or aspect < 0.15:
            continue
        cx = (x + bw / 2) / max(1, w) * 100
        cy = (y + bh * 0.55) / max(1, h) * 100
        blobs.append((area, {"x": clamp100(cx), "y": clamp100(cy)}))
    blobs.sort(key=lambda t: t[0], reverse=True)
    out: list[dict[str, float]] = []
    for _, p in blobs:
        if any((p["x"] - q["x"]) ** 2 + (p["y"] - q["y"]) ** 2 < 5**2 for q in out):
            continue
        out.append(p)
        if len(out) >= max_people:
            break
    return out, gray


def _detect_mediapipe_single(mp, frame_bgr) -> list[dict[str, float]]:
    try:
        with mp.solutions.pose.Pose(
            static_image_mode=True,
            model_complexity=0,
            enable_segmentation=False,
            min_detection_confidence=0.4,
        ) as pose:
            rgb = frame_bgr[:, :, ::-1]
            res = pose.process(rgb)
            if not res.pose_landmarks:
                return []
            xs = [lm.x for lm in res.pose_landmarks.landmark]
            ys = [lm.y for lm in res.pose_landmarks.landmark]
            if len(xs) > 24:
                cx = (xs[23] + xs[24]) / 2
                cy = (ys[23] + ys[24]) / 2
            else:
                cx = sum(xs) / len(xs)
                cy = sum(ys) / len(ys)
            return [{"x": clamp100(cx * 100), "y": clamp100(cy * 100)}]
    except Exception:
        return []


def detect_people_in_frame_bgr(
    frame_bgr,
    *,
    max_people: int = 16,
    prev_gray=None,
):
    """
    Return (detections, next_prev_gray, backend).
    Coords 0–100; y increases downward in the frame.
    """
    try:
        import mediapipe as mp  # type: ignore

        single = _detect_mediapipe_single(mp, frame_bgr)
        if single and max_people <= 1:
            return single, prev_gray, "mediapipe-pose"
    except Exception:
        pass

    cv2, np = _try_cv2()
    if cv2 is None:
        return [], prev_gray, "none"

    hog = _detect_hog(cv2, frame_bgr, max_people)
    if hog:
        return hog, prev_gray, "hog"

    blobs, gray = _detect_motion_blobs(cv2, np, frame_bgr, prev_gray, max_people)
    return blobs, gray, "motion-blobs"


def sample_detections(
    video_path: Path,
    *,
    sample_fps: float = 2.0,
    max_seconds: float | None = None,
    max_people: int = 16,
) -> list[dict[str, Any]]:
    """Sample video and detect people each sample. Returns timeline frames."""
    cv2, _np = _try_cv2()
    if cv2 is None:
        return []

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return []
    fps = float(cap.get(cv2.CAP_PROP_FPS) or 30.0) or 30.0
    step = max(1, int(round(fps / max(0.1, sample_fps))))
    frames: list[dict[str, Any]] = []
    idx = 0
    prev_gray = None
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        t = idx / fps
        if max_seconds is not None and t > max_seconds:
            break
        if idx % step == 0:
            dets, prev_gray, backend = detect_people_in_frame_bgr(
                frame, max_people=max_people, prev_gray=prev_gray
            )
            frames.append(
                {
                    "t": round(t, 3),
                    "frameIndex": idx,
                    "detections": dets,
                    "backend": backend,
                }
            )
        idx += 1
    cap.release()
    return frames
