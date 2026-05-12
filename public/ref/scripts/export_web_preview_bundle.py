#!/usr/bin/env python3
"""
Export a trimmed JSON bundle for idol-producer-web from a scenario preset.

Reads database/game_scenarios/<preset>.json (same shape as launch.py --test).
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _truncate(s: str, max_len: int) -> str:
    s = " ".join(str(s or "").split())
    if len(s) <= max_len:
        return s
    return s[: max_len - 1].rstrip() + "…"


def _find_group(groups: list[dict[str, Any]], label: str) -> dict[str, Any] | None:
    label_norm = label.strip().casefold()
    for g in groups:
        if str(g.get("name_romanji", "")).strip().casefold() == label_norm:
            return g
        if str(g.get("name", "")).strip().casefold() == label_norm:
            return g
    return None


def _trim_discography(discography: list[dict[str, Any]], max_albums: int = 2, max_tracks: int = 8) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for disc in discography[:max_albums]:
        row = {k: disc.get(k) for k in ("uid", "title", "title_romanji", "disc_type", "release_date", "publisher")}
        tl = disc.get("track_list") or []
        if isinstance(tl, list):
            row["track_list"] = [str(t) for t in tl[:max_tracks]]
        out.append(row)
    return out


def _member_uid_list(g: dict[str, Any]) -> list[str]:
    raw = g.get("member_uids")
    if isinstance(raw, list) and raw and isinstance(raw[0], str) and len(raw[0]) == 36 and raw[0].count("-") == 4:
        return [str(u) for u in raw]
    raw = g.get("members")
    if isinstance(raw, list) and raw and isinstance(raw[0], str) and len(raw[0]) == 36 and raw[0].count("-") == 4:
        return [str(u) for u in raw]
    return []


def _trim_group(g: dict[str, Any]) -> dict[str, Any]:
    pics = g.get("pictures") or []
    if isinstance(pics, list):
        pics = pics[:4]
    disc = g.get("discography") or []
    if not isinstance(disc, list):
        disc = []
    names = g.get("member_names")
    if not isinstance(names, list):
        names = []
    return {
        "uid": g.get("uid"),
        "name": g.get("name"),
        "name_romanji": g.get("name_romanji"),
        "nickname": g.get("nickname"),
        "formed_date": g.get("formed_date"),
        "popularity": g.get("popularity"),
        "fans": g.get("fans"),
        "description": _truncate(str(g.get("description") or ""), 480),
        "member_uids": _member_uid_list(g),
        "member_names": [str(n) for n in names],
        "pictures": pics,
        "discography": _trim_discography(disc),
    }


def _trim_idol(row: dict[str, Any], group_uid: str | None) -> dict[str, Any]:
    gh = row.get("group_history") or []
    filtered = []
    if isinstance(gh, list):
        for h in gh:
            if not isinstance(h, dict):
                continue
            if group_uid and str(h.get("group_uid") or "") == group_uid:
                filtered.append(
                    {
                        "group_name": h.get("group_name"),
                        "member_name": h.get("member_name"),
                        "member_color": h.get("member_color"),
                        "start_date": h.get("start_date"),
                    }
                )
    return {
        "uid": row.get("uid"),
        "name": row.get("name"),
        "romaji": row.get("romaji"),
        "birthday": row.get("birthday"),
        "age": row.get("age"),
        "portrait_photo_path": row.get("portrait_photo_path"),
        "group_history_in_group": filtered,
    }


def build_bundle(preset_name: str) -> dict[str, Any]:
    preset_path = ROOT / "database" / "game_scenarios" / f"{preset_name}.json"
    preset = _load_json(preset_path)
    startup = preset.get("startup_group")
    if not startup:
        raise SystemExit(f"Preset {preset_name!r} has no startup_group")

    idols_path = ROOT / preset["idols_path"]
    groups_path = ROOT / preset["groups_path"]
    groups = _load_json(groups_path)
    idols = _load_json(idols_path)
    if not isinstance(groups, list) or not isinstance(idols, list):
        raise SystemExit("idols.json and groups.json must be JSON arrays")

    g = _find_group(groups, str(startup))
    if not g:
        raise SystemExit(f"Group not found for startup_group={startup!r}")

    member_uids = _member_uid_list(g)
    uid_set = set(member_uids)
    idol_by_uid = {str(r.get("uid")): r for r in idols if isinstance(r, dict) and r.get("uid")}

    missing = [u for u in member_uids if u not in idol_by_uid]
    members_out = [_trim_idol(idol_by_uid[u], str(g.get("uid") or "")) for u in member_uids if u in idol_by_uid]

    return {
        "bundle_version": 1,
        "preset": preset_name,
        "scenario_number": preset.get("scenario_number"),
        "opening_date": preset.get("opening_date"),
        "group": _trim_group(g),
        "idols": members_out,
        "export_notes": {
            "missing_idol_rows": missing,
            "idol_count": len(members_out),
        },
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--preset", default="test0", help="Preset JSON name under database/game_scenarios (without .json)")
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "idol-producer-web" / "public" / "data" / "preview.json",
        help="Output path",
    )
    args = parser.parse_args()
    bundle = build_bundle(args.preset)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(bundle, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Wrote {args.out} ({args.out.stat().st_size // 1024} KiB)")


if __name__ == "__main__":
    main()
