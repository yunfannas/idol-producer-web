"""Export formation holds to idol-producer-choreographic-compat JSON."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from choreo_common import CHOREO_FORMAT, CHOREO_VERSION, MODEL_VERSION, clamp100


def _apply_mirror(x: float, mirror_x: bool) -> float:
    return clamp100(100.0 - x) if mirror_x else clamp100(x)


def export_choreographic_document(
    job: dict[str, Any],
    holds: list[dict[str, Any]],
    *,
    mirror_x: bool | None = None,
    source_notes: str | None = None,
) -> dict[str, Any]:
    mirror = bool(job.get("mirrorX") if mirror_x is None else mirror_x)
    crew_in = list(job.get("crew") or [])
    crew = []
    for i, c in enumerate(crew_in):
        uid = str(c.get("idolUid") or c.get("id") or f"dancer-{i + 1}")
        crew.append(
            {
                "id": uid,
                "name": str(c.get("name") or uid),
                "color": str(c.get("color") or "#94a3b8"),
                "idolUid": uid,
            }
        )
    crew_ids = {c["id"] for c in crew}

    def map_hold_positions(hold: dict[str, Any]) -> list[dict[str, Any]]:
        """Prefer idolUid; otherwise assign unlabeled tracks to unused crew by stage order."""
        raw = list(hold.get("positions") or [])
        used_crew: set[str] = set()
        out: list[dict[str, Any]] = []
        labeled = [p for p in raw if p.get("idolUid")]
        unlabeled = [p for p in raw if not p.get("idolUid")]
        for p in labeled:
            uid = str(p["idolUid"])
            used_crew.add(uid)
            out.append(
                {
                    "dancerId": uid,
                    "x": _apply_mirror(float(p["x"]), mirror),
                    "y": clamp100(float(p["y"])),
                    "rotationDeg": 0,
                }
            )
        # Spatial assign leftover detections → unused crew (left-to-right, front-ish first)
        unused = [c for c in crew if c["id"] not in used_crew]
        unlabeled_sorted = sorted(unlabeled, key=lambda p: (float(p["y"]), float(p["x"])))
        for p, c in zip(unlabeled_sorted, unused):
            out.append(
                {
                    "dancerId": c["id"],
                    "x": _apply_mirror(float(p["x"]), mirror),
                    "y": clamp100(float(p["y"])),
                    "rotationDeg": 0,
                }
            )
        return out

    formations = []
    expected_n = int(job.get("expectedMemberCount") or len(crew) or 0)
    for hi, hold in enumerate(holds):
        positions = map_hold_positions(hold)
        if not positions:
            continue
        if (
            expected_n
            and hi > 0
            and len(positions) < max(3, int(expected_n * 0.4))
            and float(hold.get("durationSec") or 0) < 4
        ):
            continue
        formations.append(
            {
                "id": f"formation-{hi + 1}",
                "name": "Opening" if hi == 0 else f"Set {hi + 1}",
                "durationSec": round(float(hold.get("durationSec") or 8.0), 2),
                "transitionInSec": round(float(hold.get("transitionInSec") or (0 if hi == 0 else 4)), 2),
                "notes": source_notes if hi == 0 else None,
                "positions": positions,
            }
        )

    if not formations:
        # Stub from opening marks or even crew line
        marks = list(job.get("openingMarks") or [])
        positions = []
        if marks:
            for m in marks:
                uid = str(m.get("idolUid") or "")
                if not uid:
                    continue
                positions.append(
                    {
                        "dancerId": uid,
                        "x": _apply_mirror(float(m.get("x") or 50), mirror),
                        "y": clamp100(float(m.get("y") or 50)),
                        "rotationDeg": 0,
                    }
                )
        if not positions:
            n = max(1, len(crew))
            for i, c in enumerate(crew):
                t = 0.5 if n == 1 else i / (n - 1)
                positions.append(
                    {
                        "dancerId": c["id"],
                        "x": clamp100(12 + t * 76),
                        "y": 58.0,
                        "rotationDeg": 0,
                    }
                )
        formations = [
            {
                "id": "formation-1",
                "name": "Opening",
                "durationSec": 8,
                "transitionInSec": 0,
                "notes": source_notes or "Stub formation (dry-run or no holds detected).",
                "positions": positions,
            }
        ]

    return {
        "format": CHOREO_FORMAT,
        "formatVersion": CHOREO_VERSION,
        "title": str(job.get("title") or "Compiled choreography"),
        "songUid": job.get("songUid"),
        "groupUid": job.get("groupUid"),
        "stage": {
            "widthMeters": 12,
            "depthMeters": 8,
            "audienceAt": job.get("audienceAt") or "bottom",
            "sideStageMeters": 2,
            "backStageMeters": 1.5,
        },
        "crew": crew,
        "formations": formations,
        "startingFormationIndex": 0,
        "updatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceApp": "video-choreo-compile",
        "modelVersion": MODEL_VERSION,
        "mirrorXApplied": mirror,
    }
