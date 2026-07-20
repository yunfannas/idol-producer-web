# -*- coding: utf-8 -*-
"""Create ASCII-safe IKONOIJOY logo assets that Vite can serve reliably."""
from __future__ import annotations

import shutil
from pathlib import Path

GROUPS = Path(__file__).resolve().parents[2] / "public" / "data" / "pictures" / "groups"


def main() -> None:
    love_src = GROUPS / "=LOVE_logo.webp"
    love_dst = GROUPS / "EqualLove_logo.webp"
    shutil.copy2(love_src, love_dst)
    print(f"copied {love_dst.name} ({love_dst.stat().st_size} bytes)")

    joy_src = GROUPS / "≒JOY_logo.jpg"
    raw = joy_src.read_text(encoding="utf-8")
    if 'fill="' not in raw:
        raw = raw.replace('class="cls-1"', 'class="cls-1" fill="#000000"')
    joy_dst = GROUPS / "NearlyEqualJoy_logo.svg"
    joy_dst.write_text(raw, encoding="utf-8")
    print(f"wrote {joy_dst.name} ({joy_dst.stat().st_size} bytes)")


if __name__ == "__main__":
    main()
