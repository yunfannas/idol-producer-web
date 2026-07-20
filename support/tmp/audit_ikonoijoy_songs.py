# -*- coding: utf-8 -*-
"""Audit IKONOIJOY trio song ownership for cross-group contamination."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

WEB = Path(r"H:/Qsync/Project/idol-producer-web")
sys.stdout.reconfigure(encoding="utf-8")

GROUPS = {
    "=LOVE": "PUxPVkU",
    "≠ME": "4omgTUU",
    "≒JOY": "4omSSk9Z",
}
UID_TO_NAME = {v: k for k, v in GROUPS.items()}

VARIANT_SUFFIX_RE = re.compile(
    r"""
    (?:
      \s*[\(\uff08].*
      | \s*\[\s*=LOVE.*
      | \s+-\s+From\s+THE\s+FIRST\s+TAKE
      | \s+-\s+Instrumental
      | \s+-\s+Off\s+Vocal
    )
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE | re.DOTALL,
)


def canonical(title: str) -> str:
    t = str(title or "").strip()
    if not t:
        return ""
    t = re.sub(r"\(Opening version\)\s*", "", t, flags=re.IGNORECASE).strip()
    prev = None
    while prev != t:
        prev = t
        t = VARIANT_SUFFIX_RE.sub("", t).strip()
    return re.sub(r"\s+", " ", t).strip(" -–—")


def album_blob(song: dict) -> str:
    parts = [song.get("title") or "", song.get("notes") or ""]
    for a in song.get("albums") or []:
        parts.append(a.get("name") or "")
    return " ".join(parts)


def main() -> None:
    songs = json.loads((WEB / "public/data/songs.json").read_text(encoding="utf-8"))
    groups = json.loads((WEB / "public/data/groups.json").read_text(encoding="utf-8"))
    if isinstance(groups, dict):
        groups = groups["groups"]
    by_name = {g["name"]: g for g in groups}

    trio_songs = [s for s in songs if s.get("group_uid") in GROUPS.values()]

    # canonical title -> per-group song rows
    by_canon: dict[str, dict[str, list[dict]]] = defaultdict(lambda: defaultdict(list))
    for s in trio_songs:
        c = canonical(s.get("title") or "")
        if not c:
            continue
        by_canon[c][UID_TO_NAME[s["group_uid"]]].append(s)

    # Known ownership hints from album / title metadata.
    GROUP_HINTS = {
        "=LOVE": [r"=LOVE", r"イコラブ", r"equal.?love", r"equal-love"],
        "≠ME": [r"≠ME", r"ノイミー", r"not.?equal.?me", r"not-equal-me"],
        "≒JOY": [r"≒JOY", r"ニアジョイ", r"nearly.?equal.?joy", r"nearly-equal-joy"],
    }

    def hinted_owner(blob: str) -> set[str]:
        owners: set[str] = set()
        for gname, patterns in GROUP_HINTS.items():
            for pat in patterns:
                if re.search(pat, blob, re.IGNORECASE):
                    owners.add(gname)
        return owners

    suspicious: list[tuple[str, str, str, str]] = []
    for s in trio_songs:
        assigned = UID_TO_NAME[s["group_uid"]]
        blob = album_blob(s)
        owners = hinted_owner(blob)
        # Ignore IKONOIJOY collab / joint releases — all three may appear.
        if owners and assigned not in owners and len(owners) == 1:
            suspicious.append((assigned, owners.pop(), canonical(s.get("title") or ""), blob[:140]))

    print("=== Metadata mismatch (single-group hint, wrong assignment) ===")
    for assigned, likely, title, blob in sorted(suspicious, key=lambda x: (x[0], x[2])):
        print(f"{assigned} -> likely {likely}: {title}")
        print(f"    {blob}")

    print("\n=== Canonical overlaps (same title, multiple groups) ===")
    for c in sorted(by_canon):
        gs = by_canon[c]
        if len(gs) < 2:
            continue
        print(f"{c}:")
        for gname, rows in gs.items():
            s = rows[0]
            albums = [a.get("name", "") for a in (s.get("albums") or [])[:2]]
            print(f"  {gname}: rel={s.get('release_date')} pop={s.get('popularity')} albums={albums}")

    # Compare ikonoijoy output overlap
    data = json.loads((WEB / "public/ikonoijoy/data.json").read_text(encoding="utf-8"))
    ikono = {g["name"]: {s["title"] for s in g["songs"]} for g in data["groups"]}
    overlap_love_me = ikono["=LOVE"] & ikono["≠ME"]
    overlap_me_joy = ikono["≠ME"] & ikono["≒JOY"]
    overlap_love_joy = ikono["=LOVE"] & ikono["≒JOY"]
    print("\n=== IKONOIJOY overlaps after dedupe ===")
    print(f"=LOVE ∩ ≠ME: {len(overlap_love_me)}")
    for t in sorted(overlap_love_me):
        print(f"  {t}")
    print(f"≠ME ∩ ≒JOY: {len(overlap_me_joy)}")
    for t in sorted(overlap_me_joy):
        print(f"  {t}")
    print(f"=LOVE ∩ ≒JOY: {len(overlap_love_joy)}")
    for t in sorted(overlap_love_joy):
        print(f"  {t}")

    # Songs in =LOVE only in songs.json but canonical exists only under other group
    print("\n=== =LOVE rows whose canonical title only exists under ≠ME/≒JOY ===")
    for s in trio_songs:
        if s.get("group_uid") != GROUPS["=LOVE"]:
            continue
        c = canonical(s.get("title") or "")
        owners = set(by_canon.get(c, {}))
        if owners == {"≠ME"} or owners == {"≒JOY"}:
            print(f"  {c} owners={owners} assigned==LOVE")


if __name__ == "__main__":
    main()
