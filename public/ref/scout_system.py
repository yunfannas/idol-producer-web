"""
Scout companies, recommendation logic, and audition candidate generation.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
import hashlib
import math
import random
from typing import Iterable, Optional

from idol import Idol
from idol_attributes import IdolAttributes


@dataclass(frozen=True)
class ScoutCompany:
    """A third-party scout company the player can hire for local talent search."""

    uid: str
    name: str
    city: str
    level: int
    specialty: str
    focus_note: str
    service_fee_yen: int


CITY_ALIASES: dict[str, list[str]] = {
    "Tokyo": ["tokyo", "東京", "東京都", "kanto", "関東"],
    "Osaka": ["osaka", "大阪", "大阪府", "kansai", "関西"],
    "Nagoya": ["nagoya", "名古屋", "愛知", "愛知県", "aichi", "中部"],
    "Fukuoka": ["fukuoka", "福岡", "福岡県", "kyushu", "九州"],
    "Sapporo": ["sapporo", "札幌", "北海道", "hokkaido"],
    "Sendai": ["sendai", "仙台", "宮城", "宮城県", "tohoku", "東北"],
    "Hiroshima": ["hiroshima", "広島", "広島県", "chugoku", "中国地方"],
    "Niigata": ["niigata", "新潟", "新潟県"],
}

CITY_NAME_JA: dict[str, str] = {
    "Tokyo": "東京",
    "Osaka": "大阪",
    "Nagoya": "名古屋",
    "Fukuoka": "福岡",
    "Sapporo": "札幌",
    "Sendai": "仙台",
    "Hiroshima": "広島",
    "Niigata": "新潟",
}

LEVEL_PROFILE_TARGET = {
    1: 24,
    2: 42,
    3: 60,
    4: 78,
}

LEVEL_PROFILE_BAND = {
    1: (0, 42),
    2: (22, 62),
    3: (40, 82),
    4: (55, 100),
}


def _norm_text(value: object) -> str:
    return str(value or "").strip().casefold()


def _city_matches_text(city: str, text: str) -> bool:
    norm = _norm_text(text)
    if not norm:
        return False
    return any(alias in norm for alias in CITY_ALIASES.get(city, []))


def birthplace_matches_company(city: str, birthplace: str) -> bool:
    """Return whether the birthplace text aligns with the scout company's territory."""
    return _city_matches_text(city, birthplace)


def _idol_followers(idol: Idol) -> int:
    return max(0, int(getattr(idol, "x_followers_count", 0) or getattr(idol, "x_followers", 0) or 0))


def idol_profile_score(idol: Idol) -> int:
    """Estimate how high-profile an idol is for scout-company targeting."""
    popularity = max(0, min(100, int(getattr(idol, "popularity", 0) or 0)))
    fans = max(0, int(getattr(idol, "fan_count", 0) or 0))
    followers = _idol_followers(idol)
    ability = max(0, min(100, int(getattr(idol, "ability", 0) or 0)))
    follower_score = min(24.0, math.log10(followers + 10) * 7.0)
    fan_score = min(18.0, math.log10(fans + 10) * 6.0)
    ability_score = min(16.0, ability / 4.0)
    total = (popularity * 0.58) + follower_score + fan_score + ability_score
    return max(0, min(100, int(round(total))))


def build_default_scout_companies() -> list[ScoutCompany]:
    """Seed the fixed scout-company roster requested for the game."""
    plan = [
        ("Tokyo", [1, 1, 1, 1, 2, 2, 2, 3, 3, 4]),
        ("Osaka", [1, 2, 3, 4]),
        ("Nagoya", [1, 3]),
        ("Fukuoka", [1]),
        ("Sapporo", [1]),
        ("Sendai", [1]),
        ("Hiroshima", [1]),
        ("Niigata", [1]),
    ]
    level_labels = {
        1: ("Local street teams and school circuits.", "Entry-level freelancers and raw audition hopefuls.", 80000),
        2: ("Regional live-house and trainee pipeline.", "Indie idols and promising transfer-ready names.", 140000),
        3: ("Major indie ecosystem and higher-visibility talent.", "Recognizable local acts and stronger transfer targets.", 240000),
        4: ("Premium network with headline-ready introductions.", "High-profile idols and premium-market auditions.", 420000),
    }
    city_prefix = {
        "Tokyo": "Hyper Scout",
        "Osaka": "Kansai Hyper Scout",
        "Nagoya": "Chubu Hyper Scout",
        "Fukuoka": "Kyushu Hyper Scout",
        "Sapporo": "North Hyper Scout",
        "Sendai": "Tohoku Hyper Scout",
        "Hiroshima": "Setouchi Hyper Scout",
        "Niigata": "Snowline Hyper Scout",
    }

    companies: list[ScoutCompany] = []
    for city, levels in plan:
        for index, level in enumerate(levels, start=1):
            specialty, focus_note, fee = level_labels[level]
            uid = f"scout-{city.lower()}-{level}-{index}"
            companies.append(
                ScoutCompany(
                    uid=uid,
                    name=f"{city_prefix[city]} {index}",
                    city=city,
                    level=level,
                    specialty=specialty,
                    focus_note=focus_note,
                    service_fee_yen=fee,
                )
            )
    return companies


def recommend_idols(
    idols: Iterable[Idol],
    player_group_name: str,
    company: ScoutCompany,
    target_type: str,
    current_date: Optional[date] = None,
    limit: int = 14,
) -> list[dict]:
    """Return recommended freelancer or transfer targets for a scout company."""
    player_norm = _norm_text(player_group_name)
    min_profile, max_profile = LEVEL_PROFILE_BAND[company.level]
    desired_profile = LEVEL_PROFILE_TARGET[company.level]
    rows: list[dict] = []

    for idol in idols:
        if current_date is not None and not bool(getattr(idol, "is_scout_discoverable", lambda _d=None: True)(current_date)):
            continue
        current_groups = [group for group in idol.get_current_groups() if _norm_text(group) != player_norm]
        if target_type == "freelancer":
            if current_groups:
                continue
            availability_bonus = 18
            pool_label = "Freelancer"
        elif target_type == "transfer":
            if not current_groups:
                continue
            availability_bonus = max(0, min(20, (int(getattr(idol, "jadedness", 0) or 0) // 4) + ((55 - int(getattr(idol, "morale", 50) or 50)) // 3)))
            pool_label = "Transfer"
        else:
            continue

        profile = idol_profile_score(idol)
        if target_type == "transfer" and profile < max(12, min_profile - 8):
            continue
        if target_type == "freelancer" and company.level >= 3 and profile < min_profile - 15:
            continue

        locality_bonus = 15 if birthplace_matches_company(company.city, getattr(idol, "birthplace", "")) else 0
        profile_fit = max(0, 34 - abs(profile - desired_profile))
        band_bonus = 12 if min_profile <= profile <= max_profile else 0
        followers = _idol_followers(idol)
        score = profile_fit + band_bonus + locality_bonus + availability_bonus + min(12, followers // 15000)
        if score <= 0:
            continue

        reason_parts = [pool_label]
        if locality_bonus:
            reason_parts.append(f"{CITY_NAME_JA.get(company.city, company.city)} area fit")
        if min_profile <= profile <= max_profile:
            reason_parts.append(f"level {company.level} profile band")
        if target_type == "transfer" and availability_bonus >= 8:
            reason_parts.append("open to a move")
        if target_type == "freelancer" and followers >= 10000:
            reason_parts.append("already drawing attention")

        rows.append(
            {
                "idol": idol,
                "score": score,
                "profile_score": profile,
                "current_groups": current_groups,
                "reason": ", ".join(reason_parts),
                "local_match": bool(locality_bonus),
            }
        )

    rows.sort(
        key=lambda row: (
            -row["score"],
            -row["profile_score"],
            row["idol"].name.casefold(),
        )
    )
    return rows[:limit]


def _random_for(company_uid: str, current_date: date, extra: str = "") -> random.Random:
    seed = hashlib.sha256(f"{company_uid}|{current_date.isoformat()}|{extra}".encode("utf-8")).hexdigest()
    return random.Random(seed)


def generate_audition_candidates(
    company: ScoutCompany,
    current_date: date,
    count: Optional[int] = None,
    idols: Optional[Iterable[Idol]] = None,
) -> list[dict]:
    """Generate stable audition candidates for a given company and day."""
    rng = _random_for(company.uid, current_date, "audition")
    candidate_count = count if count is not None else 5 + company.level * 2
    surname_pairs = [
        ("佐藤", "Sato"),
        ("鈴木", "Suzuki"),
        ("高橋", "Takahashi"),
        ("田中", "Tanaka"),
        ("伊藤", "Ito"),
        ("渡辺", "Watanabe"),
        ("山本", "Yamamoto"),
        ("中村", "Nakamura"),
        ("小林", "Kobayashi"),
        ("加藤", "Kato"),
        ("吉田", "Yoshida"),
        ("山田", "Yamada"),
        ("佐々木", "Sasaki"),
        ("山口", "Yamaguchi"),
        ("松本", "Matsumoto"),
        ("井上", "Inoue"),
        ("木村", "Kimura"),
        ("林", "Hayashi"),
        ("清水", "Shimizu"),
        ("阿部", "Abe"),
    ]
    given_pairs = [
        ("美咲", "Misaki"),
        ("彩花", "Ayaka"),
        ("結衣", "Yui"),
        ("七海", "Nanami"),
        ("遥", "Haruka"),
        ("真由", "Mayu"),
        ("玲奈", "Rena"),
        ("紗季", "Saki"),
        ("美月", "Mizuki"),
        ("花音", "Kanon"),
        ("琴葉", "Kotoha"),
        ("ひまり", "Himari"),
        ("凛", "Rin"),
        ("優奈", "Yuna"),
        ("杏奈", "Anna"),
        ("莉子", "Riko"),
        ("心愛", "Kokona"),
        ("詩織", "Shiori"),
        ("茉央", "Mao"),
        ("乃愛", "Noa"),
    ]
    backgrounds = [
        ("Local indie idol", "Has small live-house experience and knows fan-service basics."),
        ("Dance school standout", "Strong movement fundamentals but still raw on stage talk."),
        ("Cover singer", "Comfortable with vocal practice and short-form online clips."),
        ("College performer", "Built confidence through campus events and social media posting."),
        ("Model hopeful", "Photogenic and eager to cross into live performance work."),
        ("Former trainee", "Understands idol discipline and wants another chance."),
        ("Street performance regular", "Learns quickly and already has a tiny local following."),
        ("Open-call applicant", "No agency ties and plenty of room to shape."),
    ]

    city_label = CITY_NAME_JA.get(company.city, company.city)
    candidates: list[dict] = []
    used_uids: set[str] = set()
    min_attr = 5 + company.level
    max_attr = min(17, 10 + company.level * 2)
    min_popularity = max(0, 4 + company.level * 8)
    max_popularity = min(65, 18 + company.level * 12)

    if idols is not None:
        real_rows = recommend_idols(
            idols=idols,
            player_group_name="",
            company=company,
            target_type="freelancer",
            current_date=current_date,
            limit=max(2, candidate_count // 2),
        )
        for row in real_rows:
            idol = row["idol"]
            if bool(getattr(idol, "is_publicly_visible", lambda _d=None: True)(current_date)):
                continue
            if not bool(getattr(idol, "is_scout_discoverable", lambda _d=None: True)(current_date)):
                continue
            uid = str(getattr(idol, "uid", "") or "")
            if not uid or uid in used_uids:
                continue
            used_uids.add(uid)
            candidates.append(
                {
                    "uid": f"scenario-{uid}",
                    "existing_idol_uid": uid,
                    "name": idol.name,
                    "romaji": idol.romaji,
                    "birthplace": idol.birthplace,
                    "age": getattr(idol, "age_on", lambda _d=None: idol.age)(current_date),
                    "birthday": idol.birthday.isoformat() if getattr(idol, "birthday", None) else "",
                    "height": idol.height,
                    "background": "Pre-debut talent",
                    "note": "Introduced through scout access ahead of official debut.",
                    "source_company_uid": company.uid,
                    "source_company_name": company.name,
                    "popularity": max(0, int(getattr(idol, "popularity", 0) or 0)),
                    "fan_count": max(0, int(getattr(idol, "fan_count", 0) or 0)),
                    "x_followers": max(0, int(getattr(idol, "x_followers_count", 0) or getattr(idol, "x_followers", 0) or 0)),
                    "profile_score": row["profile_score"],
                    "attributes": idol.attributes.to_dict(include_hidden=True),
                }
            )
            if len(candidates) >= candidate_count:
                return candidates

    for index in range(candidate_count - len(candidates)):
        surname_ja, surname_ro = rng.choice(surname_pairs)
        given_ja, given_ro = rng.choice(given_pairs)
        background_label, background_note = rng.choice(backgrounds)
        age = rng.randint(15, 24 if company.level <= 2 else 27)
        height = rng.randint(148, 171)
        month = rng.randint(1, 12)
        day = rng.randint(1, 28)
        birth_year = current_date.year - age
        popularity = rng.randint(min_popularity, max_popularity)
        followers = rng.randint(0, 2000 + (company.level * 12000))
        fan_count = rng.randint(0, 800 + (company.level * 7000))
        attrs = IdolAttributes.random(min_val=min_attr, max_val=max_attr)
        candidate_uid = hashlib.sha256(f"{company.uid}|{current_date.isoformat()}|{index}".encode("utf-8")).hexdigest()[:18]
        candidates.append(
            {
                "uid": candidate_uid,
                "name": f"{surname_ja} {given_ja}",
                "romaji": f"{surname_ro} {given_ro}",
                "birthplace": f"{city_label}, Japan",
                "age": age,
                "birthday": f"{birth_year:04d}-{month:02d}-{day:02d}",
                "height": height,
                "background": background_label,
                "note": background_note,
                "source_company_uid": company.uid,
                "source_company_name": company.name,
                "popularity": popularity,
                "fan_count": fan_count,
                "x_followers": followers,
                "profile_score": max(popularity, int(attrs.get_overall_rating() * 3.5)),
                "attributes": attrs.to_dict(include_hidden=True),
            }
        )
    return candidates


def audition_candidate_to_idol(candidate: dict) -> Idol:
    """Convert an audition candidate payload into a runtime Idol object."""
    birthday_value = None
    raw_birthday = str(candidate.get("birthday") or "").strip()
    if raw_birthday:
        try:
            birthday_value = date.fromisoformat(raw_birthday)
        except ValueError:
            birthday_value = None

    attrs = IdolAttributes.create_from_dict(candidate.get("attributes", {}), include_hidden=True)
    idol = Idol(
        uid=str(candidate.get("uid") or ""),
        name=str(candidate.get("name") or "Unknown Applicant"),
        romaji=str(candidate.get("romaji") or ""),
        attributes=attrs,
        birthday=birthday_value,
        height=float(candidate.get("height") or 0) or None,
        birthplace=str(candidate.get("birthplace") or ""),
        popularity=max(0, int(candidate.get("popularity") or 0)),
        fan_count=max(0, int(candidate.get("fan_count") or 0)),
        x_followers=max(0, int(candidate.get("x_followers") or 0)),
        morale=56,
        jadedness=8,
        health=92,
    )
    idol.x_bio = str(candidate.get("background") or "")
    return idol
