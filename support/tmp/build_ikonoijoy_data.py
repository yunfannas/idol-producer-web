# -*- coding: utf-8 -*-
"""Build public/ikonoijoy/data.json for the IKONOIJOY top-10 song selector."""
from __future__ import annotations

import json
import re
from datetime import datetime
from pathlib import Path
from urllib.parse import quote

WEB = Path(r"H:/Qsync/Project/idol-producer-web")
DESK = Path(r"H:/Qsync/Project/idol_producer")

GROUP_ORDER = ["=LOVE", "≠ME", "≒JOY"]

THEMES = {
    "=LOVE": {
        "id": "equal-love",
        "accent": "#ff5ca8",
        "accent_deep": "#e91e8c",
        "accent_soft": "#ffc2de",
        "bg0": "#fff8fb",
        "bg1": "#ffe9f3",
        "ink": "#3a1630",
        "box_border": "#2a1a22",
        "title_fill": "#ff6eb4",
        "title_stroke": "#ffffff",
        "hashtag": "#わたしのイコラブベスト",
        "producer": "Produced by Rino Sashihara",
    },
    "≠ME": {
        "id": "not-equal-me",
        "accent": "#1db8a6",
        "accent_deep": "#0f8f82",
        "accent_soft": "#b8f0e8",
        "bg0": "#f5fffd",
        "bg1": "#dff8f3",
        "ink": "#0d2f2b",
        "box_border": "#1a2a28",
        "title_fill": "#12b39f",
        "title_stroke": "#ffffff",
        "hashtag": "#わたしのノイミーベスト",
        "producer": "Produced by Rino Sashihara",
    },
    "≒JOY": {
        "id": "nearly-equal-joy",
        "accent": "#f0b429",
        "accent_deep": "#d4920a",
        "accent_soft": "#ffe6a3",
        "bg0": "#fffdf5",
        "bg1": "#fff3cc",
        "ink": "#3a2a08",
        "box_border": "#2a2410",
        "title_fill": "#f0b429",
        "title_stroke": "#ffffff",
        "hashtag": "#わたしのニアジョイベスト",
        "producer": "Produced by Rino Sashihara",
    },
}

# Prefer motif marks (pink heart / mint diamond / yellow tiara), then ASCII-safe wordmarks.
# Vite's static middleware 404s `%3D…` (=LOVE), and ≒JOY_logo.jpg is SVG bytes (wrong Content-Type).
LOGO_CANDIDATES = {
    "=LOVE": [
        "EqualLove_motif.png",
        "EqualLove_logo.webp",
        "=LOVE_photo.webp",
        "=LOVE_logo.webp",
        "=LOVE_logo.png",
        "=LOVE_cover.webp",
    ],
    "≠ME": [
        "NotEqualMe_motif.png",
        "≠ME_photo.webp",
        "≠ME_logo.webp",
        "≠ME_logo.png",
        "≠ME_cover.webp",
    ],
    "≒JOY": [
        "NearlyEqualJoy_motif.png",
        "≒JOY_photo.webp",
        "NearlyEqualJoy_logo.svg",
        "≒JOY_logo.webp",
        "≒JOY_logo.png",
        "≒JOY_logo.svg",
        "≒JOY_cover.webp",
    ],
}

# Live / alt takes that should collapse to the original catalog title.
VARIANT_SUFFIX_RE = re.compile(
    r"""
    (?:
      \s*[\(\uff08].*                       # (concert / live / Full Size / …)
      | \s*\[\s*=LOVE.*                     # [ =LOVE … ] concert tags
      | \s+-\s+From\s+THE\s+FIRST\s+TAKE
      | \s+-\s+Instrumental
      | \s+-\s+Off\s+Vocal
    )
    \s*$
    """,
    re.IGNORECASE | re.VERBOSE | re.DOTALL,
)

UID_TO_NAME = {v: k for k, v in {
    "=LOVE": "PUxPVkU",
    "≠ME": "4omgTUU",
    "≒JOY": "4omSSk9Z",
}.items()}

LIVE_ALBUM_RE = re.compile(
    r"イコノイフェス|コンサート|ツアー|LIVE|ANNIVERSARY|フェス|アリーナ|卒業|Special Concert|全国ツアー|アリーナツアー",
    re.IGNORECASE,
)
STUDIO_ALBUM_RE = re.compile(r"Single| - EP|Special Edition", re.IGNORECASE)

# Joint releases that belong in more than one group's picker.
COLLAB_GROUPS: dict[str, set[str]] = {
    "次に会えた時 何を話そうかな": {"=LOVE", "≠ME"},
    "トリプルデート": {"=LOVE", "≠ME", "≒JOY"},
}

# Titles to omit from IKONOIJOY pickers (SE / non-song rows).
EXCLUDE_TITLES: set[str] = {
    "Overture",
}

# Extra songs not present (or incomplete) in songs.json but needed in pickers.
EXTRA_SONGS: list[dict] = [
    {
        "title": "トリプルデート",
        "title_romanji": "Triple Date",
        "release_date": "2022-07-20",
        "popularity": 4,
        "is_a_side": True,
        "album_key": "トリプルデート",
        "groups": {"=LOVE", "≠ME", "≒JOY"},
    },
]

# Explicit overrides when album metadata is ambiguous.
OWNER_OVERRIDES: dict[str, str] = {
    "てゆーか、みるてんって何?": "≠ME",
    "まほろばアスタリスク": "≠ME",
    "P.I.C.": "≠ME",
    "薄明光線": "≠ME",
    "ワタシアクセント": "≠ME",
    "君はスパークル": "≠ME",
}


def load_list(path: Path, key: str) -> list:
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else raw.get(key, [])


def format_romanji(value: object) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    return re.sub(r"\s+", " ", text.replace("_", " ")).strip()


def index_picture_dir(folder: Path) -> dict[str, str]:
    out: dict[str, str] = {}
    if not folder.is_dir():
        return out
    for path in folder.iterdir():
        if path.is_file():
            out[path.name.lower()] = path.name
    return out


def public_url(filename: str) -> str:
    # Keep `=` unencoded — percent-encoded `%3D` is not found by Vite static serve.
    encoded = quote(filename, safe="/=()[]!'*")
    return f"../data/pictures/groups/{encoded}"


def pick_logo(group_name: str, group: dict, group_index: dict[str, str]) -> str | None:
    candidates = list(LOGO_CANDIDATES.get(group_name, []))
    for raw in group.get("pictures") or []:
        if not isinstance(raw, str):
            continue
        base = Path(raw.replace("\\", "/")).name
        # Skip mislabeled SVG-as-JPG for ≒JOY (broken as <img>).
        if base.lower() in {"≒joy_logo.jpg", "≒joy_logo.jpeg"}:
            continue
        if base and ("logo" in base.lower() or "_icon." in base.lower()):
            candidates.append(base)
    for cand in candidates:
        hit = group_index.get(cand.lower())
        if hit:
            return public_url(hit)
    return None


def canonical_song_title(title: str) -> str:
    """Collapse live / concert / alt takes to the original song title."""
    t = str(title or "").strip()
    if not t:
        return ""
    # e.g. 絶対アイドル辞めないで(Opening version) [=LOVE 7th …]
    t = re.sub(r"\(Opening version\)\s*", "", t, flags=re.IGNORECASE).strip()
    prev = None
    while prev != t:
        prev = t
        t = VARIANT_SUFFIX_RE.sub("", t).strip()
    t = re.sub(r"\s+", " ", t).strip(" -–—")
    # Catalog inconsistency: "手遅れ caution" vs "手遅れcaution"
    t = re.sub(r"(?<=[\u3040-\u30ff\u3400-\u9fff])\s+(?=[A-Za-z0-9])", "", t)
    t = re.sub(r"(?<=[A-Za-z0-9])\s+(?=[\u3040-\u30ff\u3400-\u9fff])", "", t)
    return t


def album_names(song: dict) -> list[str]:
    return [str(a.get("name") or "") for a in song.get("albums") or []]


def album_title_base(name: str) -> str:
    n = str(name or "")
    n = re.sub(r"\s*-\s*Single\s*$", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\s*-\s*EP\s*$", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\s*-\s*From\s+THE\s+FIRST\s+TAKE.*$", "", n, flags=re.IGNORECASE)
    n = re.sub(r"\s*Special Edition.*$", "", n, flags=re.IGNORECASE).strip()
    n = re.sub(r"\s*[<(【].*$", "", n).strip()
    return n.strip(" -–—")


def is_a_side_song(song: dict | None, canonical: str | None = None) -> bool:
    """True when the track is a single 表題曲 / A-side (incl. double A-side)."""
    if not song:
        return False
    title = canonical or canonical_song_title(song.get("title") or "")
    if not title:
        return False
    for album in song.get("albums") or []:
        name = str(album.get("name") or "")
        track_no = album.get("track_number")
        if LIVE_ALBUM_RE.search(name):
            continue
        base = album_title_base(name)
        parts = [p.strip() for p in re.split(r"\s*/\s*", base) if p.strip()]
        if re.search(r"-\s*Single\s*$", name, re.IGNORECASE):
            if title == base or title in parts:
                return True
            if any(title.startswith(p) or p.startswith(title) for p in parts):
                return True
        if track_no == 1 and re.search(r"-\s*(Single|EP)\s*$", name, re.IGNORECASE):
            if parts and (title == parts[0] or title.startswith(parts[0]) or parts[0].startswith(title)):
                return True
    return False


def release_family_key(song: dict | None, canonical: str | None = None) -> str:
    """Group couplings with their single/EP package for within-release ordering."""
    title = canonical or canonical_song_title((song or {}).get("title") or "")
    if not song:
        return title.casefold()
    ep_keys: list[str] = []
    single_keys: list[str] = []
    for album in song.get("albums") or []:
        name = str(album.get("name") or "")
        if LIVE_ALBUM_RE.search(name):
            continue
        base = album_title_base(name)
        if not base:
            continue
        key = base.casefold()
        if re.search(r"-\s*EP\s*$", name, re.IGNORECASE):
            ep_keys.append(key)
        elif re.search(r"-\s*Single\s*$", name, re.IGNORECASE):
            single_keys.append(key)
    if ep_keys:
        # Prefer multi-title EPs (A / B packages) so couplings share one family.
        ep_keys.sort(key=lambda k: (0 if "/" in k else 1, -len(k)))
        return ep_keys[0]
    if single_keys:
        return single_keys[0]
    return title.casefold()


def song_profile(song: dict) -> dict:
    albums = album_names(song)
    studio_hits = [a for a in albums if STUDIO_ALBUM_RE.search(a) and not LIVE_ALBUM_RE.search(a)]
    live_hits = [a for a in albums if LIVE_ALBUM_RE.search(a)]
    return {
        "group": UID_TO_NAME[song["group_uid"]],
        "release_date": song.get("release_date") or "9999-99-99",
        "popularity": float(song.get("popularity") or 0),
        "studio_primary": bool(studio_hits),
        "live_only": bool(live_hits) and not studio_hits,
    }


def pick_owner(canonical_title: str, profiles: list[dict]) -> str | None:
    if canonical_title in EXCLUDE_TITLES:
        return None
    if canonical_title in COLLAB_GROUPS:
        return None

    override = OWNER_OVERRIDES.get(canonical_title)
    if override:
        return override

    groups_present = {p["group"] for p in profiles}
    if len(groups_present) == 1:
        return next(iter(groups_present))

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

    return min(best_by_group, key=lambda g: best_by_group[g]["release_date"])


def build_owner_map(songs: list[dict]) -> dict[str, str | None]:
    trio_uids = set(UID_TO_NAME)
    by_canon: dict[str, list[dict]] = {}
    for song in songs:
        if song.get("group_uid") not in trio_uids:
            continue
        c = canonical_song_title(song.get("title") or "")
        if not c:
            continue
        by_canon.setdefault(c, []).append(song_profile(song))

    owners: dict[str, str | None] = {}
    for c, profiles in by_canon.items():
        owners[c] = pick_owner(c, profiles)
    return owners


def song_allowed(canonical_title: str, group_name: str, owners: dict[str, str | None]) -> bool:
    if canonical_title in EXCLUDE_TITLES:
        return False
    collab = COLLAB_GROUPS.get(canonical_title)
    if collab is not None:
        return group_name in collab
    owner = owners.get(canonical_title)
    if owner is None:
        return False
    return owner == group_name


def songs_for_group(
    group_name: str,
    group: dict,
    songs_by_uid: dict[str, dict],
    songs_by_group: dict[str, list],
    owners: dict[str, str | None],
) -> list[dict]:
    # key -> best row (prefer exact original title, then higher popularity)
    best: dict[str, dict] = {}

    def score(row: dict, raw_title: str, canonical: str) -> tuple:
        is_original = raw_title.strip() == canonical
        pop = row.get("popularity")
        pop_n = float(pop) if isinstance(pop, (int, float)) else -1.0
        return (1 if is_original else 0, pop_n, -len(raw_title))

    def add(song: dict | None, title: str | None = None):
        raw = (title or (song or {}).get("title") or (song or {}).get("title_listed") or "").strip()
        if not raw:
            return
        canonical = canonical_song_title(raw)
        if not canonical or canonical in EXCLUDE_TITLES:
            return
        key = canonical.casefold()
        album_key = release_family_key(song, canonical)
        row = {
            "uid": (song or {}).get("uid"),
            "title": canonical,
            "title_romanji": (song or {}).get("title_romanji"),
            "popularity": (song or {}).get("popularity"),
            "release_date": (song or {}).get("release_date") or None,
            "is_a_side": is_a_side_song(song, canonical),
            "album_key": album_key,
            "_raw": raw,
        }
        prev = best.get(key)
        if prev is None or score(row, raw, canonical) > score(prev, prev.get("_raw") or "", canonical):
            # Keep A-side flag / richer album key if any variant carries them.
            row["is_a_side"] = bool(row["is_a_side"] or (prev or {}).get("is_a_side"))
            if prev and prev.get("album_key") and (
                "/" in prev["album_key"] or len(prev["album_key"]) > len(row["album_key"])
            ):
                row["album_key"] = prev["album_key"]
            best[key] = row
        else:
            if row["is_a_side"]:
                prev["is_a_side"] = True
            if album_key and (
                "/" in album_key
                or len(album_key) > len(prev.get("album_key") or "")
            ):
                prev["album_key"] = album_key

    for uid in group.get("song_uids") or []:
        add(songs_by_uid.get(uid))

    for song in songs_by_group.get(group.get("uid") or "", []):
        add(song)

    # Inline songs array on some group rows
    for item in group.get("songs") or []:
        if isinstance(item, str):
            add(None, item)
        elif isinstance(item, dict):
            add(item)

    if not best:
        for disc in group.get("discography") or []:
            for track in disc.get("track_list") or []:
                add(None, str(track))

    out = []
    for row in best.values():
        if not song_allowed(row["title"], group_name, owners):
            continue
        out.append(
            {
                "uid": row.get("uid"),
                "title": row["title"],
                "title_romanji": row.get("title_romanji"),
                "popularity": row.get("popularity"),
                "release_date": row.get("release_date"),
                "is_a_side": bool(row.get("is_a_side")),
                "album_key": row.get("album_key") or row["title"].casefold(),
            }
        )

    have = {s["title"].casefold() for s in out}
    for extra in EXTRA_SONGS:
        if group_name not in extra["groups"]:
            continue
        title = extra["title"]
        if title.casefold() in have:
            continue
        if not song_allowed(title, group_name, owners):
            continue
        out.append(
            {
                "uid": None,
                "title": title,
                "title_romanji": extra.get("title_romanji"),
                "popularity": extra.get("popularity"),
                "release_date": extra.get("release_date"),
                "is_a_side": bool(extra.get("is_a_side")),
                "album_key": extra.get("album_key") or title.casefold(),
            }
        )

    family_dates: dict[str, str] = {}
    for song in out:
        fam = song["album_key"]
        date = song.get("release_date") or "0000-00-00"
        family_dates[fam] = max(family_dates.get(fam, "0000-00-00"), date)
    for song in out:
        song["family_date"] = family_dates.get(song["album_key"], song.get("release_date") or "0000-00-00")

    # Oldest release families first; within a family, A-side then couplings.
    out.sort(key=lambda s: s["title"])
    out.sort(key=lambda s: s.get("release_date") or "0000-00-00")
    out.sort(key=lambda s: 0 if s.get("is_a_side") else 1)
    out.sort(key=lambda s: s.get("family_date") or "0000-00-00")
    return out


def main() -> None:
    web_groups = {g["name"]: g for g in load_list(WEB / "public/data/groups.json", "groups")}
    desk_groups = {g["name"]: g for g in load_list(DESK / "database/groups.json", "groups")}
    by_name = {**desk_groups, **web_groups}

    songs = load_list(WEB / "public/data/songs.json", "songs")
    if not songs:
        songs = load_list(DESK / "database/songs.json", "songs")

    songs_by_uid = {s["uid"]: s for s in songs if s.get("uid")}
    songs_by_group: dict[str, list] = {}
    for s in songs:
        gu = s.get("group_uid")
        if gu:
            songs_by_group.setdefault(gu, []).append(s)

    owners = build_owner_map(songs)

    group_index = index_picture_dir(WEB / "public/data/pictures/groups")
    groups_out = []
    for name in GROUP_ORDER:
        g = by_name.get(name)
        if not g:
            groups_out.append(
                {
                    "name": name,
                    "missing": True,
                    "theme": THEMES[name],
                    "logo_url": None,
                    "songs": [],
                }
            )
            continue
        groups_out.append(
            {
                "name": name,
                "name_romanji": format_romanji(g.get("name_romanji")) or name,
                "nickname": g.get("nickname"),
                "nickname_romanji": format_romanji(g.get("nickname_romanji")),
                "uid": g.get("uid"),
                "logo_url": pick_logo(name, g, group_index),
                "theme": THEMES[name],
                "songs": songs_for_group(name, g, songs_by_uid, songs_by_group, owners),
            }
        )

    out = {
        "title": "IKONOIJOY ベスト10",
        "subtitle": "=LOVE / ≠ME / ≒JOY の好きな曲 Top 10 を作ろう",
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "groups": groups_out,
    }

    out_dir = WEB / "public/ikonoijoy"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "data.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out_dir / 'data.json'}")
    for g in groups_out:
        name = g["name"].encode("ascii", "backslashreplace").decode("ascii")
        print(f"  {name}: songs={len(g.get('songs') or [])} logo={bool(g.get('logo_url'))}")


if __name__ == "__main__":
    main()
