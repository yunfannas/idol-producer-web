"""Export a CSV summary of manual labels for the video-skill benchmark set."""

from __future__ import annotations

import argparse
import csv
import json
from pathlib import Path


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--manifest",
        type=Path,
        default=Path("support/data/video-skill-benchmark/manifest.json"),
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=Path("support/reports/video-skill-scoring/benchmark_manual_labels.csv"),
    )
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows = []
    for idol in manifest.get("idols", []):
        m = idol.get("manual") or {}
        rows.append(
            {
                "uid": idol.get("uid"),
                "name": idol.get("name"),
                "group": idol.get("group"),
                "archetype": idol.get("archetype"),
                "spike": bool(idol.get("spike")),
                "pitch": m.get("pitch"),
                "tone": m.get("tone"),
                "breath": m.get("breath"),
                "rhythm": m.get("rhythm"),
                "power": m.get("power"),
                "grace": m.get("grace"),
                "stamina": m.get("stamina"),
                "agility": m.get("agility"),
                "singingMean": m.get("singingMean"),
                "dancingMean": m.get("dancingMean"),
                "hasStaticVocal": idol.get("clips", {}).get("staticVocal") is not None,
                "hasLiveFixed": idol.get("clips", {}).get("liveFixed") is not None,
            }
        )

    args.out.parent.mkdir(parents=True, exist_ok=True)
    fieldnames = list(rows[0].keys()) if rows else []
    with args.out.open("w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
    print(f"Wrote {args.out} ({len(rows)} idols)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
