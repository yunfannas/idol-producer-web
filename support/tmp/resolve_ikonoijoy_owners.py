# -*- coding: utf-8 -*-
"""Resolve canonical song ownership across =LOVE / ≠ME / ≒JOY."""
from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

WEB = Path(r"H:/Qsync/Project/idol-producer-web")
sys.stdout.reconfigure(encoding="utf-8")

GROUPS = {"=LOVE": "PUxPVkU", "≠ME": "4omgTUU", "≒JOY": "4omSSk9Z"}
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

LIVE_ALBUM_RE = re.compile(
    r"イコノイフェス|コンサート|ツアー|LIVE|ANNIVERSARY|フェス|アリーナ|卒業|Special Concert|全国ツアー|アリーナツアー",
    re.IGNORECASE,
)
STUDIO_ALBUM_RE = re.compile(r"Single| - EP|Special Edition", re.IGNORECASE)

# Explicit overrides when metadata is ambiguous (live rows, collab singles, etc.).
OWNER_OVERRIDES: dict[str, str] = {
    # ≠ME originals that also appear on =LOVE festival/live albums.
    "てゆーか、みるてんって何?": "≠ME",
    "まほろばアスタリスク": "≠ME",
    "P.I.C.": "≠ME",
    "薄明光線": "≠ME",
    "ワタシアクセント": "≠ME",
    "君はスパークル": "≠ME",
    "Overture": "≠ME",
    # IKONOIJOY collab — omit from per-group lists (not a solo group song).
    "トリプルデート": "__COLLAB__",
}


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


def album_names(song: dict) -> list[str]:
    return [str(a.get("name") or "") for a in song.get("albums") or []]


def song_profile(song: dict) -> dict:
    albums = album_names(song)
    joined = " ".join(albums)
    studio_hits = [a for a in albums if STUDIO_ALBUM_RE.search(a) and not LIVE_ALBUM_RE.search(a)]
    live_hits = [a for a in albums if LIVE_ALBUM_RE.search(a)]
    return {
        "group": UID_TO_NAME[song["group_uid"]],
        "title": song.get("title"),
        "release_date": song.get("release_date") or "9999-99-99",
        "popularity": float(song.get("popularity") or 0),
        "studio_albums": studio_hits,
        "live_albums": live_hits,
        "studio_primary": bool(studio_hits),
        "live_only": bool(live_hits) and not studio_hits,
        "album_blob": joined,
    }


def pick_owner(canonical_title: str, profiles: list[dict]) -> str | None:
    override = OWNER_OVERRIDES.get(canonical_title)
    if override == "__COLLAB__":
        return None
    if override:
        return override

    groups_present = {p["group"] for p in profiles}
    if len(groups_present) == 1:
        return next(iter(groups_present))

    # Group-level best profile.
    best_by_group: dict[str, dict] = {}
    for group in groups_present:
        rows = [p for p in profiles if p["group"] == group]
        best_by_group[group] = max(
            rows,
            key=lambda p: (p["studio_primary"], p["popularity"], -len(p["release_date"])),
        )

    studio_groups = [g for g, p in best_by_group.items() if p["studio_primary"]]
    if len(studio_groups) == 1:
        return studio_groups[0]
    if len(studio_groups) > 1:
        return min(studio_groups, key=lambda g: best_by_group[g]["release_date"])

    # Only live/festival rows left — keep the earliest dated group, drop others.
    return min(best_by_group, key=lambda g: best_by_group[g]["release_date"])


def build_owner_map(songs: list[dict]) -> dict[str, str | None]:
    by_canon: dict[str, list[dict]] = defaultdict(list)
    for song in songs:
        if song.get("group_uid") not in GROUPS.values():
            continue
        c = canonical(song.get("title") or "")
        if c:
            by_canon[c].append(song_profile(song))

    owners: dict[str, str | None] = {}
    for c, profiles in by_canon.items():
        owners[c] = pick_owner(c, profiles)
    return owners


def main() -> None:
    songs = json.loads((WEB / "public/data/songs.json").read_text(encoding="utf-8"))
    owners = build_owner_map(songs)

    data = json.loads((WEB / "public/ikonoijoy/data.json").read_text(encoding="utf-8"))
    ikono = {g["name"]: {s["title"] for s in g["songs"]} for g in data["groups"]}
    overlap = (ikono["=LOVE"] & ikono["≠ME"]) | (ikono["=LOVE"] & ikono["≒JOY"]) | (ikono["≠ME"] & ikono["≒JOY"])
    print("Current overlaps:", len(overlap))
    for t in sorted(overlap):
        print(f"  {t} -> owner {owners.get(t)}")

    # simulate filtering
    for gname, uid in GROUPS.items():
        kept = []
        dropped = []
        for song in songs:
            if song.get("group_uid") != uid:
                continue
            c = canonical(song.get("title") or "")
            owner = owners.get(c)
            if owner is None or owner == gname:
                kept.append(c)
            else:
                dropped.append((c, owner))
        print(f"\n{gname}: keep {len(set(kept))} drop {len(set(dropped))}")
        for c, owner in sorted(set(dropped))[:20]:
            print(f"  DROP {c} (owner {owner})")


if __name__ == "__main__":
    main()
