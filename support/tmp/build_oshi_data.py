# -*- coding: utf-8 -*-
"""Build public/oshi/data.json for the HEROINES oshi picker site."""
from __future__ import annotations

import json
import re
from pathlib import Path

WEB = Path(r"H:/Qsync/Project/idol-producer-web")
DESK = Path(r"H:/Qsync/Project/idol_producer")


def format_romanji(value: object) -> str | None:
    """Display romaji with spaces instead of underscores (wiki-style slugs)."""
    if value is None:
        return None
    text = str(value).strip()
    if not text:
        return None
    text = text.replace("_", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text


COLOR_HEX = {
    "白": "#f5f5f5",
    "白色": "#f5f5f5",
    "ホワイト": "#f5f5f5",
    "White": "#f5f5f5",
    "黒": "#222222",
    "ブラック": "#222222",
    "Black": "#222222",
    "赤": "#e53935",
    "赤色": "#e53935",
    "レッド": "#e53935",
    "Red": "#e53935",
    "ピンク": "#ff5ca8",
    "ピンク色": "#ff5ca8",
    "Pink": "#ff5ca8",
    "青": "#1e88e5",
    "青色": "#1e88e5",
    "ブルー": "#1e88e5",
    "Blue": "#1e88e5",
    "水色": "#4fc3f7",
    "ライトブルー": "#4fc3f7",
    "Light Blue": "#4fc3f7",
    "緑": "#43a047",
    "緑色": "#43a047",
    "グリーン": "#43a047",
    "Green": "#43a047",
    "黄": "#fdd835",
    "黄色": "#fdd835",
    "イエロー": "#fdd835",
    "Yellow": "#fdd835",
    "オレンジ": "#fb8c00",
    "オレンジ色": "#fb8c00",
    "Orange": "#fb8c00",
    "紫": "#8e24aa",
    "紫色": "#8e24aa",
    "パープル": "#8e24aa",
    "Purple": "#8e24aa",
    "ラベンダー": "#b39ddb",
    "Lavender": "#b39ddb",
    "水色系": "#4fc3f7",
    "ゴールド": "#f9a825",
    "Gold": "#f9a825",
    "銀": "#b0bec5",
    "シルバー": "#b0bec5",
    "Silver": "#b0bec5",
    "茶": "#8d6e63",
    "ブラウン": "#8d6e63",
}


def load_groups(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else raw.get("groups", [])


def load_idols(path: Path):
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else raw.get("idols", [])


def load_songs(path: Path):
    if not path.exists():
        return []
    raw = json.loads(path.read_text(encoding="utf-8"))
    return raw if isinstance(raw, list) else raw.get("songs", [])


def color_to_hex(label: str | None) -> str | None:
    if not label:
        return None
    text = str(label).strip()
    if re.fullmatch(r"#?[0-9a-fA-F]{6}", text):
        return text if text.startswith("#") else f"#{text}"
    # take first token before (
    token = re.split(r"[（(+/]", text)[0].strip()
    return COLOR_HEX.get(token) or COLOR_HEX.get(text)


# English / descriptive labels → short Japanese color names (display only)
EN_COLOR_TO_JA = {
    "white": "白",
    "black": "黒",
    "red": "赤",
    "pink": "ピンク",
    "blue": "青",
    "light blue": "水色",
    "baby blue": "水色",
    "sky blue": "水色",
    "crybaby sky blue": "水色",
    "green": "緑",
    "mint green": "ミント",
    "yellow": "黄",
    "hungry yellow": "黄",
    "orange": "オレンジ",
    "mischievous orange": "オレンジ",
    "purple": "紫",
    "lavender": "ラベンダー",
    "brown": "茶",
    "gold": "ゴールド",
    "silver": "銀",
    "considerate white": "白",
    "powerful red": "赤",
    "strongest pink": "ピンク",
}

JA_COLOR_WORDS = (
    "ミントグリーン",
    "ライトブルー",
    "ラベンダー",
    "ゴールド",
    "シルバー",
    "ホワイト",
    "ブラック",
    "イエロー",
    "オレンジ",
    "パープル",
    "ピンク",
    "ミント",
    "水色",
    "赤色",
    "青色",
    "緑色",
    "黄色",
    "白色",
    "白",
    "黒",
    "赤",
    "青",
    "緑",
    "黄",
    "紫",
    "茶",
    "銀",
)


def color_label_ja(label: str | None) -> str | None:
    """Current-group color only: drop other-group notes, show Japanese name."""
    if not label:
        return None
    text = re.split(r"[（(]", str(label), maxsplit=1)[0].strip()
    if not text:
        return None

    katakana_norm = {
        "ホワイト": "白",
        "ブラック": "黒",
        "レッド": "赤",
        "ブルー": "青",
        "ライトブルー": "水色",
        "グリーン": "緑",
        "イエロー": "黄",
        "パープル": "紫",
        "ブラウン": "茶",
        "シルバー": "銀",
        "赤色": "赤",
        "青色": "青",
        "緑色": "緑",
        "黄色": "黄",
        "白色": "白",
        "ミントグリーン": "ミント",
    }
    if text in katakana_norm:
        return katakana_norm[text]
    if text in {
        "白",
        "黒",
        "赤",
        "ピンク",
        "青",
        "水色",
        "緑",
        "黄",
        "オレンジ",
        "紫",
        "茶",
        "ミント",
        "ラベンダー",
        "ゴールド",
        "銀",
    }:
        return text
    for word in JA_COLOR_WORDS:
        if text.endswith(word):
            return color_label_ja(word)

    low = text.lower().strip()
    if low in EN_COLOR_TO_JA:
        return EN_COLOR_TO_JA[low]
    for eng, ja in sorted(EN_COLOR_TO_JA.items(), key=lambda x: -len(x[0])):
        if eng in low:
            return ja
    return text


def index_picture_dir(dir_path: Path) -> dict[str, str]:
    """Map lowercased filename → on-disk filename."""
    out: dict[str, str] = {}
    if not dir_path.is_dir():
        return out
    for p in dir_path.iterdir():
        if p.is_file():
            out[p.name.lower()] = p.name
    return out


def basename_of(raw: str | None) -> str | None:
    if not isinstance(raw, str) or not raw.strip():
        return None
    return raw.replace("\\", "/").strip().split("/")[-1] or None


def portrait_history_date(entry: dict) -> str:
    for key in ("timestamp", "effective_date", "release_date", "start_date", "date"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return ""


def portrait_history_path(entry: dict) -> str | None:
    for key in ("path", "portrait_photo_path"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
    return None


def latest_group_portrait_path(idol: dict, group: dict | None) -> str | None:
    history_map = idol.get("group_portrait_history")
    if not isinstance(history_map, dict):
        return None

    group_name = str((group or {}).get("name") or "").strip()
    group_romanji = str((group or {}).get("name_romanji") or "").strip()
    group_uid = str((group or {}).get("uid") or "").strip()
    candidates = []
    for key in (group_name, group_uid, group_romanji):
        if not key:
            continue
        bucket = history_map.get(key)
        if isinstance(bucket, list):
            for item in bucket:
                if isinstance(item, dict):
                    path = portrait_history_path(item)
                    if path:
                        candidates.append((portrait_history_date(item), path))

    if not candidates:
        return None

    candidates.sort(key=lambda item: (item[0], item[1]), reverse=True)
    return candidates[0][1]


def public_url(kind: str, filename: str) -> str:
    """URL relative to public/oshi/index.html."""
    from urllib.parse import quote

    return f"../data/pictures/{kind}/{quote(filename)}"


def name_tokens(value: str | None) -> list[str]:
    if not isinstance(value, str):
        return []
    raw = value.strip()
    if not raw:
        return []
    compact = re.sub(r"\s+", " ", raw)
    collapsed = re.sub(r"[^0-9A-Za-zぁ-んァ-ン一-龥!+&-]+", "", raw)
    tokens = [raw, compact, raw.replace(" ", "_"), raw.replace(" ", ""), collapsed]
    out: list[str] = []
    seen: set[str] = set()
    for token in tokens:
        token = token.strip()
        if token and token not in seen:
            out.append(token)
            seen.add(token)
    return out


def resolve_file(index: dict[str, str], candidates: list[str]) -> str | None:
    for cand in candidates:
        if not cand:
            continue
        hit = index.get(cand.lower())
        if hit:
            return hit
        # tolerate space ↔ underscore
        alt = cand.replace(" ", "_")
        hit = index.get(alt.lower())
        if hit:
            return hit
        alt = cand.replace("_", " ")
        hit = index.get(alt.lower())
        if hit:
            return hit
    return None


# Explicit per-group overrides for idols with multiple current HEROINES rosters.
# Values are candidate filenames under public/data/pictures/idols/.
PORTRAIT_OVERRIDES: dict[tuple[str, str], list[str]] = {
    ("あいす", "iLiFE!"): [
        "あいす__iLiFE!_portrait.jpg",
        "あいす_iLiFE!_portrait.jpg",
    ],
    ("あいす", "i-COL"): [
        "あいす__i-COL_portrait.jpg",
        "あいす_i-COL_portrait.jpg",
    ],
}

NO_MEMBER_COLOR_GROUPS = {
    "GILTY × GILTY",
    "ヒロインズ研究生",
    "ヒロインズ研究生大阪",
}


def safe_print(text) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        print(str(text).encode("ascii", errors="backslashreplace").decode("ascii"))


def pick_group_logo(group: dict, group_index: dict[str, str]) -> str | None:
    pics = [p for p in (group.get("pictures") or []) if isinstance(p, str) and p.strip()]
    # Prefer square icons cropped from oshi charts
    icons = [p for p in pics if "_icon." in Path(p.replace("\\", "/")).name.lower()]
    logos = [p for p in pics if "logo" in p.lower()]
    for raw in icons + logos + pics:
        base = basename_of(raw)
        if not base:
            continue
        hit = resolve_file(group_index, [base])
        if hit:
            return public_url("groups", hit)
    # Soft match any *_icon on disk by group name token
    name = str(group.get("name") or "")
    token = re.sub(r"[^a-z0-9ぁ-んァ-ン一-龥]+", "", name.lower())
    for key, filename in group_index.items():
        if "_icon." not in key:
            continue
        stem = re.sub(r"[^a-z0-9ぁ-んァ-ン一-龥]+", "", key.split("_icon")[0])
        if token and stem and (token in stem or stem in token):
            return public_url("groups", filename)
    for key, filename in group_index.items():
        if "logo" not in key or "cover" in key:
            continue
        stem = re.sub(r"[^a-z0-9ぁ-んァ-ン一-龥]+", "", key.split("_logo")[0].split(" logo")[0])
        if token and stem and (token in stem or stem in token):
            return public_url("groups", filename)
    return None


def portrait_url_for(idol: dict | None, idol_index: dict[str, str]) -> str | None:
    if not idol:
        return None
    base = basename_of(idol.get("portrait_photo_path"))
    if base:
        hit = resolve_file(idol_index, [base])
        if hit:
            return public_url("idols", hit)
    # fallback: {name}_portrait.jpg/.webp/.png
    name = str(idol.get("name") or "").strip()
    if name:
        for ext in (".jpg", ".webp", ".png", ".jpeg"):
            hit = resolve_file(idol_index, [f"{name}_portrait{ext}"])
            if hit:
                return public_url("idols", hit)
    return None


def portrait_url_for_group(idol: dict | None, group: dict | None, idol_index: dict[str, str]) -> str | None:
    if not idol:
        return None

    idol_name = str(idol.get("name") or "").strip()
    group_name = str((group or {}).get("name") or "").strip()
    group_romanji = str((group or {}).get("name_romanji") or "").strip()
    group_uid = str((group or {}).get("uid") or "").strip()

    history_path = latest_group_portrait_path(idol, group)
    if history_path:
        base = basename_of(history_path)
        if base:
            hit = resolve_file(idol_index, [base])
            if hit:
                return public_url("idols", hit)

    portrait_map = idol.get("group_portrait_paths")
    if isinstance(portrait_map, dict):
        mapped = (
            portrait_map.get(group_name)
            or portrait_map.get(group_uid)
            or portrait_map.get(group_romanji)
        )
        if isinstance(mapped, str) and mapped.strip():
            base = basename_of(mapped)
            if base:
                hit = resolve_file(idol_index, [base])
                if hit:
                    return public_url("idols", hit)

    candidates: list[str] = []
    for token in PORTRAIT_OVERRIDES.get((idol_name, group_name), []):
        candidates.append(token)

    idol_tokens = name_tokens(idol_name)
    group_tokens = name_tokens(group_name) + name_tokens(group_romanji)
    for idol_token in idol_tokens:
        for group_token in group_tokens:
            for ext in (".jpg", ".webp", ".png", ".jpeg"):
                candidates.extend(
                    [
                        f"{idol_token}__{group_token}_portrait{ext}",
                        f"{idol_token}_{group_token}_portrait{ext}",
                        f"{group_token}__{idol_token}_portrait{ext}",
                        f"{group_token}_{idol_token}_portrait{ext}",
                    ]
                )

    hit = resolve_file(idol_index, candidates)
    if hit:
        return public_url("idols", hit)

    return portrait_url_for(idol, idol_index)


# Flattened chart order: former sheets 4 → 3 → 1 → 2 (user: "4312")
GROUP_ORDER = [
    # Chart 4 → 3 → 1 → 2, with placement tweaks
    "iLiFE!",
    "夜光性アミューズ",
    "のんふぃく！",
    "i-COL",
    "ドレスコード",
    "MEGAFON",
    "iON!",
    "GILTY × GILTY",
    "Ill",
    "TENRIN",
    "AdamLilith",
    "なう♡すとれーじ",
    "LADYBABY",
    "ハルカエコー",
    "CAL&RES",
    "ポンコツコンポ",
    "ZUTTOMOTTO",
    "パラレルサイダー",
    "アキシブproject",
    "chuLa",
    "パラディーク",
    "ナナコロビヤオキ",
    "テンシンランマン",
    "Pastel Closet",
    "ラストシーン",
    "フルコース",
    "ヒロインズ研究生",
    "ヒロインズ研究生大阪",
]

# Manual roster overrides for brand-new / incomplete Fandom groups
MANUAL = {
    "LADYBABY": {
        "uid": "72612662-7c13-4de8-b694-a800f9eb1dda",
        "name_romanji": "LADYBABY",
        "members": [
            {"name": "神黎ミア", "color": "白", "color_hex": "#f5f5f5"},
            {"name": "來崎せな", "color": "緑", "color_hex": "#43a047"},
            {"name": "月街えい", "color": "紫", "color_hex": "#8e24aa"},
            {"name": "越智きの", "color": "黄", "color_hex": "#fdd835"},
        ],
        "songs": [
            "Gotcha にっぽん！",
            "ダルマカルマ",
            "ジャパサマ",
            "メロメロメロイック",
            "Real eyes realize real lies",
            "花一匁",
            "KILLER KILLER IDOL",
            "ニッポン饅頭",
            "破天ニ雷鳴",
            "ダメダメ殿",
        ],
    },
    "フルコース": {
        "uid": "RnVsbCBDb3Vyc2U",
        "name_romanji": "Full Course",
        "members": [
            {"name": "中川心", "color": "赤", "color_hex": "#e53935"},
            {"name": "阿部菜々実", "color": "白", "color_hex": "#f5f5f5"},
            {"name": "鈴木遥夏", "color": "紫", "color_hex": "#8e24aa"},
            {"name": "小葉こな", "color": "緑", "color_hex": "#43a047"},
            {"name": "金城まき", "color": "黄", "color_hex": "#fdd835"},
            {"name": "桜咲みはね", "color": "ピンク", "color_hex": "#ff5ca8"},
            {"name": "水上凜巳花", "color": "水色", "color_hex": "#4fc3f7"},
        ],
        "songs": ["ターニングポイント", "White ROSE", "バンドワゴン"],
    },
    "ハルカエコー": {
        "uid": "82c6703f-0d5d-4b54-972d-232437a3b991",
        "name_romanji": "Haruka Echo",
        "members": [
            {"name": "雨宮るり", "color": "青", "color_hex": "#1e88e5"},
            {"name": "平沢かえ", "color": "黄", "color_hex": "#fdd835"},
            {"name": "神凪みふゆ", "color": "紫", "color_hex": "#8e24aa"},
            {"name": "常盤うた", "color": "ピンク", "color_hex": "#ff5ca8"},
            {"name": "芦名ゆい", "color": "白", "color_hex": "#f5f5f5"},
            {"name": "高坂りん", "color": "赤", "color_hex": "#e53935"},
        ],
        "songs": ["残響"],
    },
    # Final generation at 2025-02-07 現体制終了 (杏仁みる graduated 2025-01-27 but listed in disband era)
    "ガガピエロ": {
        "uid": "df3e70ea-93af-41a2-bc29-22f7087350d8",
        "name_romanji": "GAGAPIERO",
        "members": [
            {"name": "胡桃兎愛", "color": "ピンク", "color_hex": "#ffc0cb"},
            {"name": "波沫ひよ", "color": "青", "color_hex": "#0000ff"},
            {"name": "屑紫つみき", "color": "紫", "color_hex": "#8e24aa"},
            {"name": "紅守ある", "color": "赤", "color_hex": "#e53935"},
            {"name": "杏仁みる", "color": "白", "color_hex": "#f5f5f5"},
        ],
        "songs": [],
    },
}


def member_color_from_idol(
    idol: dict, group_name: str, group_uid: str | None, group_romanji: str | None = None
) -> tuple[str | None, str | None]:
    matches: list[dict] = []
    for hist in idol.get("group_history") or []:
        if not isinstance(hist, dict):
            continue
        if (
            hist.get("group_uid") == group_uid
            or hist.get("group_name") == group_name
            or (group_romanji and hist.get("group_name") == group_romanji)
        ):
            matches.append(hist)
    if not matches:
        return None, None

    def score(hist: dict) -> tuple[int, int]:
        raw_label = hist.get("member_color")
        raw = raw_label if isinstance(raw_label, str) else ""
        simple = "(" not in raw and ")" not in raw and " / " not in raw
        score = 0
        if group_romanji and hist.get("group_name") == group_romanji:
            score += 4
        if hist.get("group_name") == group_name:
            score += 3
        if hist.get("group_uid") == group_uid:
            score += 2
        if simple and raw:
            score += 4
        if hist.get("member_color_code"):
            score += 1
        return score, len(raw)

    hist = max(matches, key=score)
    raw_label = hist.get("member_color")
    label = color_label_ja(raw_label if isinstance(raw_label, str) else None)
    code = hist.get("member_color_code")
    if isinstance(code, str) and code.startswith("0x") and len(code) >= 8:
        return label, f"#{code[2:8]}"
    if isinstance(code, str) and code.startswith("#"):
        return label, code
    return label, color_to_hex(label) or color_to_hex(raw_label if isinstance(raw_label, str) else None)


def build_group(
    name: str,
    by_name: dict,
    idols_by_uid: dict,
    songs_by_group: dict,
    idol_index: dict[str, str],
    group_index: dict[str, str],
) -> dict:
    # Fully missing group stub (not in DB at all)
    if name not in by_name and name in MANUAL:
        m = MANUAL[name]
        members = []
        for mm in m["members"]:
            fake = {"name": mm["name"], "portrait_photo_path": None}
            for cand in idols_by_uid.values():
                if cand.get("name") == mm["name"]:
                    fake = cand
                    break
            members.append(
                {
                    **mm,
                    "portrait_url": portrait_url_for_group(fake, {"name": name, **m}, idol_index),
                }
            )
        return {
            "name": name,
            "name_romanji": m.get("name_romanji"),
            "uid": m.get("uid"),
            "logo_url": None,
            "members": members,
            "songs": [{"title": t} for t in m["songs"]],
        }

    g = by_name.get(name)
    if not g:
        return {"name": name, "missing": True, "logo_url": None, "members": [], "songs": []}

    members = []
    names = list(g.get("member_names") or [])
    uids = list(g.get("member_uids") or [])
    # Disbanded / empty current roster: use final (past) lineup for the picker
    if not names:
        names = list(g.get("past_member_names") or [])
        uids = list(g.get("past_member_uids") or [])
    # Prefer MANUAL disband order / colors when defined
    if name in MANUAL and MANUAL[name].get("members"):
        manual_members = MANUAL[name]["members"]
        names = [m["name"] for m in manual_members]
        name_to_uid = {}
        for past_name, past_uid in zip(g.get("past_member_names") or [], g.get("past_member_uids") or []):
            name_to_uid[past_name] = past_uid
        for cur_name, cur_uid in zip(g.get("member_names") or [], g.get("member_uids") or []):
            name_to_uid[cur_name] = cur_uid
        uids = [name_to_uid.get(nm) for nm in names]
    for i, nm in enumerate(names):
        uid = uids[i] if i < len(uids) else None
        idol = idols_by_uid.get(uid) if uid else None
        color_label, color_hex = (None, None)
        if idol:
            color_label, color_hex = member_color_from_idol(idol, name, g.get("uid"), g.get("name_romanji"))
        # Manual color override (official / disband roster colors)
        if name in MANUAL:
            for mm in MANUAL[name]["members"]:
                if mm["name"] == nm:
                    color_label, color_hex = mm["color"], mm["color_hex"]
                    break
        if not idol:
            idol = {"name": nm, "portrait_photo_path": None}
            # Prefer full idol row by display name when uid missing
            for cand in idols_by_uid.values():
                if cand.get("name") == nm:
                    idol = cand
                    break
        if name in NO_MEMBER_COLOR_GROUPS:
            color_label, color_hex = None, None
        members.append(
            {
                "uid": uid,
                "name": nm,
                "color": color_label,
                "color_hex": color_hex if color_label or color_hex else None,
                "portrait_url": portrait_url_for_group(idol, g, idol_index),
            }
        )

    songs = []
    for s in songs_by_group.get(g.get("uid"), []):
        title = s.get("title") or s.get("title_listed")
        if title:
            songs.append({"uid": s.get("uid"), "title": title, "popularity": s.get("popularity")})
    songs.sort(key=lambda x: (-(x.get("popularity") or 0), x["title"]))

    # Seed songs from manual if catalog empty
    if not songs and name in MANUAL:
        songs = [{"title": t} for t in MANUAL[name]["songs"]]

    # Disc tracklist fallback
    if not songs:
        for disc in g.get("discography") or []:
            for t in disc.get("track_list") or []:
                title = re.sub(r"\s*\(.*\)\s*$", "", str(t)).strip()
                if title and title not in {x["title"] for x in songs}:
                    songs.append({"title": title})

    return {
        "name": name,
        "name_romanji": format_romanji(g.get("name_romanji")),
        "uid": g.get("uid"),
        "logo_url": pick_group_logo(g, group_index),
        "members": members,
        "songs": songs,
    }

def main():
    web_groups = {g["name"]: g for g in load_groups(WEB / "public/data/groups.json")}
    desk_groups = {g["name"]: g for g in load_groups(DESK / "database/groups.json")}
    by_name = {**desk_groups, **web_groups}  # web overrides desk when present

    idols = load_idols(WEB / "public/data/idols.json")
    idols += load_idols(DESK / "database/idols.json")
    idols_by_uid = {}
    for idol in idols:
        uid = idol.get("uid")
        if uid and uid not in idols_by_uid:
            idols_by_uid[uid] = idol

    songs = load_songs(WEB / "public/data/songs.json")
    if not songs:
        songs = load_songs(DESK / "database/songs.json")
    songs_by_group: dict[str, list] = {}
    for s in songs:
        gu = s.get("group_uid")
        if gu:
            songs_by_group.setdefault(gu, []).append(s)

    # Ensure manual new groups exist even if only on desktop / none
    for name, meta in MANUAL.items():
        if name not in by_name:
            by_name[name] = {
                "name": name,
                "uid": meta["uid"],
                "name_romanji": meta.get("name_romanji"),
                "member_names": [m["name"] for m in meta["members"]],
                "member_uids": [""] * len(meta["members"]),
            }

    idol_index = index_picture_dir(WEB / "public/data/pictures/idols")
    group_index = index_picture_dir(WEB / "public/data/pictures/groups")

    groups_out = [
        build_group(n, by_name, idols_by_uid, songs_by_group, idol_index, group_index)
        for n in GROUP_ORDER
    ]

    out = {
        "title": "HEROINES 推しチャート",
        "subtitle": "各グループの推しメン＆推し曲を選ぼう",
        "generated_at": __import__("datetime").datetime.now().isoformat(timespec="seconds"),
        "groups": groups_out,
    }
    out_dir = WEB / "public/oshi"
    out_dir.mkdir(parents=True, exist_ok=True)
    (out_dir / "data.json").write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {out_dir / 'data.json'}")
    with_logo = sum(1 for g in groups_out if g.get("logo_url"))
    with_port = sum(1 for g in groups_out for m in g.get("members") or [] if m.get("portrait_url"))
    members = sum(len(g.get("members") or []) for g in groups_out)
    print(f"logos {with_logo}/{len(groups_out)}  portraits {with_port}/{members}")
    safe_print([(g["name"], len(g.get("members") or []), len(g.get("songs") or [])) for g in groups_out])
if __name__ == "__main__":
    main()
