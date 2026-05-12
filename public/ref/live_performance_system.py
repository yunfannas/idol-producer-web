"""
Live performance resolution for managed-group gameplay.

This module translates idol attributes and current status into a live result:

- group live performance
- audience satisfaction
- actual tokutenkai ticket sales
- fan and popularity growth
"""

from __future__ import annotations

import hashlib
import math
from datetime import date
from typing import Any

from group import Group
from idol import Idol


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def _avg(*values: float) -> float:
    return sum(values) / max(1, len(values))


def _parse_iso_date(value: Any) -> date | None:
    text = str(value or "").split("T")[0].strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _deterministic_noise(seed: str) -> float:
    """Small stable noise term so repeated runs stay deterministic per live."""
    digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    raw = int(digest[:8], 16) / 0xFFFFFFFF
    return (raw * 2.0) - 1.0


def _idol_age_on(idol: Idol, reference_date: date | None) -> int | None:
    birthday = getattr(idol, "birthday", None)
    if birthday is None or reference_date is None:
        return getattr(idol, "age", None)
    years = reference_date.year - birthday.year
    if (reference_date.month, reference_date.day) < (birthday.month, birthday.day):
        years -= 1
    return years


def _idol_tenure_years(idol: Idol, reference_date: date | None) -> float:
    if reference_date is None:
        reference_date = date.today()
    stored_tenure = getattr(idol, "scenario_tenure_years", None)
    if stored_tenure not in (None, ""):
        try:
            return max(0.0, float(stored_tenure))
        except (TypeError, ValueError):
            pass

    intervals: list[tuple[date, date]] = []
    for entry in list(getattr(idol, "group_history", []) or []):
        start_date = getattr(entry, "start_date", None)
        end_date = getattr(entry, "end_date", None)
        start_parsed = start_date if isinstance(start_date, date) else _parse_iso_date(start_date)
        end_parsed = end_date if isinstance(end_date, date) else _parse_iso_date(end_date)
        if start_parsed is None:
            continue
        if end_parsed is None or end_parsed > reference_date:
            end_parsed = reference_date
        if end_parsed < start_parsed:
            continue
        intervals.append((start_parsed, end_parsed))
    if not intervals:
        age = _idol_age_on(idol, reference_date)
        if age is None:
            return 1.0
        return _clamp(max(0.5, age - 15.0), 0.5, 16.0)
    intervals.sort(key=lambda item: (item[0], item[1]))
    merged: list[tuple[date, date]] = []
    for start_parsed, end_parsed in intervals:
        if not merged:
            merged.append((start_parsed, end_parsed))
            continue
        last_start, last_end = merged[-1]
        if start_parsed <= last_end:
            merged[-1] = (last_start, max(last_end, end_parsed))
        else:
            merged.append((start_parsed, end_parsed))
    tenure_days = sum(max(0, (end_parsed - start_parsed).days) for start_parsed, end_parsed in merged)
    return max(0.0, tenure_days / 365.25)


def _maturity_drive_bonus(idol: Idol, reference_date: date | None) -> float:
    """Return a small effective bonus to determination/professionalism from age and tenure."""
    age = _idol_age_on(idol, reference_date)
    tenure_years = _idol_tenure_years(idol, reference_date)

    age_bonus = 0.0
    if age is not None:
        age_bonus = max(0.0, age - 20.0) * 0.10
    tenure_bonus = min(1.2, max(0.0, tenure_years - 2.0) * 0.12)
    return _clamp(age_bonus + tenure_bonus, 0.0, 2.0)


def _sales_age_bonus(idol: Idol, reference_date: date | None) -> float:
    """Age near 20 tends to be strongest for tokutenkai conversion."""
    age = _idol_age_on(idol, reference_date)
    if age is None:
        return 0.0
    distance = abs(age - 20.0)
    bonus = 0.55 - (distance * 0.10)
    if age < 17:
        bonus -= 0.10
    elif age >= 25:
        bonus -= min(0.25, (age - 24.0) * 0.05)
    return _clamp(bonus, -0.40, 0.60)


def _sales_tenure_adjustment(idol: Idol, reference_date: date | None) -> float:
    """Tenure helps until veteran fatigue starts to slightly hurt handshake sales."""
    tenure_years = _idol_tenure_years(idol, reference_date)
    early_bonus = min(0.28, tenure_years * 0.05)
    veteran_penalty = 0.0
    if tenure_years > 8.0:
        veteran_penalty = min(0.55, (tenure_years - 8.0) * 0.08)
    return _clamp(early_bonus - veteran_penalty, -0.55, 0.30)


def _group_identity_keys(group: Group | None) -> set[str]:
    keys: set[str] = set()
    if group is None:
        return keys
    for value in (
        getattr(group, "uid", None),
        getattr(group, "name", None),
        getattr(group, "name_romanji", None),
        getattr(group, "nickname", None),
    ):
        text = str(value or "").strip().lower()
        if text:
            keys.add(text)
    return keys


def _is_akishibu_group(group: Group | None) -> bool:
    keys = _group_identity_keys(group)
    return any("akishibu" in key or "アキシブ" in key for key in keys)


def _akishibu_role_bias(group: Group | None, idol: Idol) -> dict[str, float]:
    """Scenario 6 interpolation anchors for Akishibu roles."""
    if not _is_akishibu_group(group):
        return {"performance": 0.0, "sales": 0.0}

    names = {
        str(getattr(idol, "uid", "")).strip().lower(),
        str(getattr(idol, "name", "")).strip().lower(),
        str(getattr(idol, "romaji", "")).strip().lower(),
    }
    performance = 0.0
    sales = 0.0
    if "茉井良菜".lower() in names or "matsui rana" in names:
        performance += 0.40
        sales += 0.06
    if "古賀みれい".lower() in names or "koga mirei" in names:
        sales += 0.24
        performance += 0.04
    return {"performance": performance, "sales": sales}


def _member_live_component_scores(idol: Idol, reference_date: date | None = None) -> dict[str, float]:
    attrs = idol.attributes
    tech = attrs.technical
    phys = attrs.physical
    ment = attrs.mental
    app = attrs.appearance
    hidden = attrs.hidden
    maturity_bonus = _maturity_drive_bonus(idol, reference_date)
    effective_determination = ment.determination + maturity_bonus
    effective_professionalism = hidden.professionalism + maturity_bonus

    vocal = _avg(tech.pitch, tech.tone, tech.breath, tech.power)
    dance = _avg(phys.agility, phys.stamina, tech.rhythm, tech.grace, tech.power)
    stage = _avg(app.cute, app.pretty, ment.talking, ment.humor, tech.grace)
    teamwork = _avg(ment.teamwork, effective_determination, ment.clever, effective_professionalism)
    return {
        "vocal": vocal,
        "dance": dance,
        "stage": stage,
        "teamwork": teamwork,
    }


def _member_status_multiplier(idol: Idol) -> float:
    condition = int(getattr(idol, "condition", 90) or 90)
    morale = int(getattr(idol, "morale", 50) or 50)

    mult = 1.0
    mult += (condition - 70) / 200.0
    mult += (morale - 50) / 250.0
    return _clamp(mult, 0.50, 1.18)


def _member_mood_score(idol: Idol) -> float:
    """Return a lightweight 0-100 mood/condition score for one live."""
    condition = int(getattr(idol, "condition", 90) or 90)
    morale = int(getattr(idol, "morale", 50) or 50)
    score = (condition * 0.58) + (morale * 0.42)
    return _clamp(score, 0.0, 100.0)


def _member_condition_score(idol: Idol) -> float:
    condition = int(getattr(idol, "condition", 90) or 90)
    return _clamp(condition, 0.0, 100.0)


def _member_fatigue_score(idol: Idol) -> float:
    """Treat lower condition as the live-fatigue signal."""
    fatigue = 100 - int(getattr(idol, "condition", 90) or 90)
    return _clamp(fatigue, 0.0, 100.0)


def _estimate_group_fans(group: Group) -> int:
    direct = int(getattr(group, "fans", 0) or 0)
    member_total = sum(max(0, int(getattr(idol, "fan_count", 0) or 0)) for idol in group.members)
    return max(direct, member_total, 0)


def _estimate_group_x_followers(group: Group) -> int:
    return sum(max(0, int(getattr(idol, "x_followers", 0) or 0)) for idol in group.members)


def _collect_recent_release_signal(group: Group, live: dict[str, Any]) -> dict[str, float]:
    """Estimate promotion freshness from recent songs/disc releases and explicit live flags."""
    live_date = _parse_iso_date(live.get("start_date"))
    if live_date is None:
        return {
            "novelty_score": 0.0,
            "recent_song_count": 0,
            "recent_disc_count": 0,
            "setlist_fresh_count": 0,
            "costume_refresh_bonus": 0.0,
        }

    recent_titles: set[str] = set()
    recent_song_count = 0
    for song in list(getattr(group, "songs", []) or []):
        if bool(getattr(song, "hidden", False)):
            continue
        release_date = getattr(song, "release_date", None)
        if release_date is None:
            continue
        delta_days = (live_date - release_date).days
        if 0 <= delta_days <= 60:
            recent_song_count += 1
            title = str(getattr(song, "title", None) or getattr(song, "title_romanji", None) or "").strip()
            if title:
                recent_titles.add(title)

    recent_disc_count = 0
    for disc in list(getattr(group, "discography", []) or []):
        release_date = getattr(disc, "release_date", None)
        if release_date is None:
            continue
        delta_days = (live_date - release_date).days
        if 0 <= delta_days <= 120:
            recent_disc_count += 1

    setlist = {str(title).strip() for title in (live.get("setlist") or []) if str(title).strip()}
    setlist_fresh_count = sum(1 for title in setlist if title in recent_titles)

    costume_refresh_bonus = 0.0
    if bool(live.get("costume_refresh")):
        costume_refresh_bonus += 3.0
    try:
        costume_refresh_bonus += max(0.0, min(4.0, float(live.get("costume_refresh_level") or 0)))
    except (TypeError, ValueError):
        pass
    if recent_disc_count > 0:
        costume_refresh_bonus += 1.0

    novelty_score = min(
        12.0,
        (min(recent_song_count, 3) * 1.5)
        + (min(setlist_fresh_count, 2) * 1.5)
        + (min(recent_disc_count, 2) * 1.0)
        + costume_refresh_bonus
        + (2.0 if bool(live.get("new_song_showcase")) else 0.0),
    )
    return {
        "novelty_score": round(novelty_score, 2),
        "recent_song_count": recent_song_count,
        "recent_disc_count": recent_disc_count,
        "setlist_fresh_count": setlist_fresh_count,
        "costume_refresh_bonus": round(costume_refresh_bonus, 2),
    }


def _expectation_score(group: Group, live_type: str, profile_strength: float, novelty_score: float) -> float:
    group_fans = _estimate_group_fans(group)
    x_followers = _estimate_group_x_followers(group)
    fan_scale = min(18.0, math.log10(group_fans + 10.0) * 4.1)
    social_scale = min(12.0, math.log10(x_followers + 10.0) * 2.6)
    type_bonus = {
        "Festival": 12.0,
        "Concert": 8.0,
        "Routine": 4.0,
        "Taiban": 2.0,
    }.get(str(live_type or "Routine"), 3.0)
    score = (profile_strength * 0.56) + fan_scale + social_scale + type_bonus + (novelty_score * 0.45)
    return _clamp(score, 18.0, 96.0)


def idol_live_readiness_score(idol: Idol, live_type: str, reference_date: date | None = None) -> float:
    """Return a 0-100 readiness score for one idol on one live."""
    comp = _member_live_component_scores(idol, reference_date)
    type_key = str(live_type or "Routine")
    if type_key == "Concert":
        base = comp["vocal"] * 0.33 + comp["dance"] * 0.27 + comp["stage"] * 0.22 + comp["teamwork"] * 0.18
    elif type_key == "Festival":
        base = comp["stage"] * 0.36 + comp["dance"] * 0.24 + comp["vocal"] * 0.22 + comp["teamwork"] * 0.18
    elif type_key == "Taiban":
        base = comp["stage"] * 0.34 + comp["dance"] * 0.28 + comp["vocal"] * 0.20 + comp["teamwork"] * 0.18
    else:
        base = comp["vocal"] * 0.28 + comp["dance"] * 0.24 + comp["stage"] * 0.28 + comp["teamwork"] * 0.20

    score = (base / 20.0) * 100.0
    score *= _member_status_multiplier(idol)
    return _clamp(score, 20.0, 100.0)


def _member_tokutenkai_sales_score(idol: Idol, live: dict[str, Any], group: Group | None = None) -> float:
    live_date = _parse_iso_date(live.get("start_date")) or date.today()
    comp = _member_live_component_scores(idol, live_date)
    attrs = idol.attributes
    ment = attrs.mental
    app = attrs.appearance
    hidden = attrs.hidden
    maturity_bonus = _maturity_drive_bonus(idol, live_date)
    age_bonus = _sales_age_bonus(idol, live_date)
    tenure_adj = _sales_tenure_adjustment(idol, live_date)
    role_bias = _akishibu_role_bias(group, idol)

    charm = _avg(app.cute, app.pretty, ment.talking, ment.humor, ment.fashion)
    reliability = _avg(hidden.professionalism + maturity_bonus, ment.determination + maturity_bonus, ment.teamwork)
    popularity_signal = _avg(float(getattr(idol, "popularity", 0) or 0), min(20.0, math.log10(max(10, int(getattr(idol, "fan_count", 0) or 0))) * 4.8))

    score = 5.9
    score += ((charm - 10.0) / 10.0) * 0.95
    score += ((comp["stage"] - 10.0) / 10.0) * 0.45
    score += ((reliability - 10.0) / 10.0) * 0.38
    score += ((popularity_signal - 10.0) / 10.0) * 0.55
    score += age_bonus
    score += tenure_adj
    score += role_bias["sales"]
    score += _deterministic_noise(f"tokuten:{live.get('uid')}|{live.get('start_date')}|{idol.uid}") * 0.22
    return _clamp(score, 3.8, 9.9)


def idol_live_performance_rating(idol: Idol, live_type: str, live: dict[str, Any], group: Group | None = None) -> dict[str, float]:
    """
    Return a per-live idol performance rating on a 10-point scale.

    The scale is tuned so an average managed idol lands near 6.8, while stronger
    attributes and better mood/condition push the score higher.
    """
    live_date = _parse_iso_date(live.get("start_date")) or date.today()
    comp = _member_live_component_scores(idol, live_date)
    readiness = idol_live_readiness_score(idol, live_type, live_date)
    mood_score = _member_mood_score(idol)
    condition_score = _member_condition_score(idol)
    fatigue_score = _member_fatigue_score(idol)
    status_mult = _member_status_multiplier(idol)
    attribute_strength = _avg(comp["vocal"], comp["dance"], comp["stage"], comp["teamwork"])
    maturity_bonus = _maturity_drive_bonus(idol, live_date)
    role_bias = _akishibu_role_bias(group, idol)

    type_key = str(live_type or "Routine")
    if type_key == "Concert":
        fit_strength = comp["vocal"]
    elif type_key == "Festival":
        fit_strength = comp["stage"]
    elif type_key == "Taiban":
        fit_strength = _avg(comp["stage"], comp["dance"])
    else:
        fit_strength = _avg(comp["vocal"], comp["stage"])

    # Center the rating around 6.8 for an average idol while preserving
    # meaningful spread from both attributes and current condition.
    rating = 6.0
    rating += ((attribute_strength - 10.0) / 10.0) * 1.05
    rating += ((mood_score - 70.0) / 30.0) * 0.75
    rating += ((fit_strength - 10.0) / 10.0) * 0.35
    rating += ((readiness - 55.0) / 45.0) * 0.40
    rating += (status_mult - 1.0) * 0.35
    rating += ((condition_score - 75.0) / 25.0) * 0.32
    rating -= (fatigue_score / 100.0) * 0.85
    rating += min(0.18, maturity_bonus * 0.06)
    rating += role_bias["performance"]
    rating += _deterministic_noise(f"member:{live.get('uid')}|{live.get('start_date')}|{idol.uid}") * 0.34
    rating = _clamp(rating, 3.8, 9.9)

    return {
        "rating": round(rating, 2),
        "readiness": round(readiness, 2),
        "mood_score": round(mood_score, 2),
        "condition_score": round(condition_score, 2),
        "fatigue_score": round(fatigue_score, 2),
        "attribute_strength": round(attribute_strength, 2),
        "type_fit_strength": round(fit_strength, 2),
        "tokutenkai_sales_score": round(_member_tokutenkai_sales_score(idol, live, group), 2),
        "maturity_bonus": round(maturity_bonus, 2),
    }


def resolve_group_live_result(group: Group, live: dict[str, Any]) -> dict[str, Any]:
    """Resolve a deterministic live result from group, live type, and member condition."""
    live_type = str(live.get("live_type") or live.get("event_type") or "Routine")
    member_scores = []
    for idol in group.members:
        rating_info = idol_live_performance_rating(idol, live_type, live, group)
        member_scores.append(
            {
                "uid": idol.uid,
                "name": idol.name,
                "score": rating_info["readiness"],
                "rating": rating_info["rating"],
                "mood_score": rating_info["mood_score"],
                "condition_score": rating_info["condition_score"],
                "fatigue_score": rating_info["fatigue_score"],
                "attribute_strength": rating_info["attribute_strength"],
                "type_fit_strength": rating_info["type_fit_strength"],
                "tokutenkai_sales_score": rating_info["tokutenkai_sales_score"],
                "maturity_bonus": rating_info["maturity_bonus"],
            }
        )

    roster_score = _avg(*[row["score"] for row in member_scores]) if member_scores else 45.0
    synergy = _avg(*[_member_live_component_scores(idol, _parse_iso_date(live.get("start_date")) or date.today())["teamwork"] for idol in group.members]) if group.members else 10.0
    synergy_bonus = max(-4.0, min(6.0, (synergy - 10.0) * 0.8))
    noise = _deterministic_noise(f"{live.get('uid')}|{live.get('start_date')}|{group.uid}") * 2.4
    performance_score = _clamp(roster_score + synergy_bonus + noise, 25.0, 100.0)

    base_popularity = int(getattr(group, "popularity", 0) or 0)
    member_popularity = _avg(*[int(getattr(idol, "popularity", 0) or 0) for idol in group.members]) if group.members else 0.0
    profile_strength = max(base_popularity, member_popularity)
    freshness = _collect_recent_release_signal(group, live)
    novelty_score = float(freshness.get("novelty_score", 0.0) or 0.0)
    expectation_score = _expectation_score(group, live_type, profile_strength, novelty_score)

    expected_tickets = max(0, int(live.get("tokutenkai_expected_tickets") or 0))
    capacity = max(0, int(live.get("capacity") or 0))
    broadcast_exposure = 0
    if capacity > 0:
        demand_anchor = _clamp(
            (profile_strength / 100.0) * 0.80
            + (performance_score / 100.0) * 0.42
            + (novelty_score / 100.0) * 0.15,
            0.12,
            1.0,
        )
        attendance = max(20, int(round(capacity * demand_anchor)))
        attendance = min(capacity, attendance)
    elif live_type == "Festival":
        group_fans = _estimate_group_fans(group)
        x_followers = _estimate_group_x_followers(group)
        attendance = max(
            800,
            int(round(900 + (group_fans * 0.015) + (x_followers * 0.0025) + (profile_strength * 18.0) + (novelty_score * 22.0))),
        )
        broadcast_exposure = max(
            500,
            int(round(attendance * (0.55 + (profile_strength / 180.0) + (novelty_score / 25.0)))),
        )
    else:
        attendance = max(0, expected_tickets)

    audience_satisfaction = _clamp(
        performance_score * 0.74
        + (profile_strength * 0.16)
        + (novelty_score * 1.1)
        + _deterministic_noise(f"audi:{live.get('uid')}") * 3.0,
        20.0,
        100.0,
    )

    tokutenkai_factor = _clamp(0.60 + (audience_satisfaction / 100.0) * 0.70, 0.45, 1.25)
    lineup_sales_strength = _avg(*[row.get("tokutenkai_sales_score", 6.0) for row in member_scores]) if member_scores else 6.0
    top_seller_strength = max([row.get("tokutenkai_sales_score", 6.0) for row in member_scores], default=6.0)
    tokutenkai_factor += ((lineup_sales_strength - 6.0) / 3.2) * 0.14
    tokutenkai_factor += ((top_seller_strength - 6.4) / 3.0) * 0.07
    tokutenkai_factor = _clamp(tokutenkai_factor, 0.42, 1.38)
    actual_tickets = int(round(expected_tickets * tokutenkai_factor))
    if expected_tickets > 0:
        actual_tickets = max(1, actual_tickets)

    exposure_pool = attendance + broadcast_exposure
    base_discovery = {
        "Festival": 0.015,
        "Concert": 0.012,
        "Routine": 0.018,
        "Taiban": 0.022,
    }.get(live_type, 0.016)
    expectation_gap = audience_satisfaction - expectation_score
    conversion_rate = base_discovery + (expectation_gap / 60.0) + (novelty_score / 180.0)
    if live_type == "Festival":
        conversion_rate = _clamp(conversion_rate, -0.18, 0.28)
    else:
        conversion_rate = _clamp(conversion_rate, -0.10, 0.22)
    fan_gain = int(round(exposure_pool * conversion_rate))
    popularity_gain = 0
    if expectation_gap >= 18 or audience_satisfaction >= 82:
        popularity_gain = 2
    elif expectation_gap >= 6 or audience_satisfaction >= 68:
        popularity_gain = 1
    elif expectation_gap <= -18 or audience_satisfaction < 38:
        popularity_gain = -2
    elif expectation_gap <= -8 or audience_satisfaction < 42:
        popularity_gain = -1

    return {
        "performance_score": round(performance_score, 2),
        "audience_satisfaction": round(audience_satisfaction, 2),
        "expectation_score": round(expectation_score, 2),
        "novelty_score": round(novelty_score, 2),
        "attendance": attendance,
        "broadcast_exposure": broadcast_exposure,
        "exposure_count": exposure_pool,
        "tokutenkai_actual_tickets": max(0, actual_tickets),
        "fan_gain": fan_gain,
        "popularity_gain": popularity_gain,
        "member_scores": member_scores,
        "recent_song_count": int(freshness.get("recent_song_count", 0) or 0),
        "recent_disc_count": int(freshness.get("recent_disc_count", 0) or 0),
        "setlist_fresh_count": int(freshness.get("setlist_fresh_count", 0) or 0),
        "costume_refresh_bonus": float(freshness.get("costume_refresh_bonus", 0.0) or 0.0),
        "lineup_tokutenkai_sales_strength": round(lineup_sales_strength, 2),
        "top_tokutenkai_sales_strength": round(top_seller_strength, 2),
    }


def apply_live_result_to_group(group: Group, live_result: dict[str, Any]) -> dict[str, Any]:
    """Apply one live result to the group and member state."""
    fan_gain = int(live_result.get("fan_gain", 0) or 0)
    popularity_gain = int(live_result.get("popularity_gain", 0) or 0)
    performance_score = float(live_result.get("performance_score", 50.0) or 50.0)
    satisfaction = float(live_result.get("audience_satisfaction", 50.0) or 50.0)

    current_group_fans = int(getattr(group, "fans", 0) or 0)
    group.fans = max(0, current_group_fans + fan_gain)
    current_popularity = int(getattr(group, "popularity", 0) or 0)
    group.popularity = max(0, min(100, current_popularity + popularity_gain))

    total_weight = 0.0
    member_weights: list[tuple[Idol, float]] = []
    score_by_uid = {str(item.get("uid")): float(item.get("score", 50.0) or 50.0) for item in live_result.get("member_scores", []) if isinstance(item, dict)}
    sales_by_uid = {str(item.get("uid")): float(item.get("tokutenkai_sales_score", 6.0) or 6.0) for item in live_result.get("member_scores", []) if isinstance(item, dict)}
    total_tokutenkai_tickets = max(0, int(live_result.get("tokutenkai_actual_tickets", 0) or 0))

    group_morale_gain = 0
    if performance_score >= 86 or satisfaction >= 84:
        group_morale_gain = 3
    elif performance_score >= 74 or satisfaction >= 72:
        group_morale_gain = 2
    elif performance_score >= 62 or satisfaction >= 60:
        group_morale_gain = 1
    elif performance_score < 42 or satisfaction < 40:
        group_morale_gain = -2
    elif performance_score < 52 or satisfaction < 50:
        group_morale_gain = -1

    for idol in group.members:
        member_score = score_by_uid.get(str(idol.uid), performance_score)
        if fan_gain >= 0:
            weight = max(0.25, member_score / 100.0)
        else:
            weight = max(0.25, (120.0 - member_score) / 100.0)
        member_weights.append((idol, weight))
        total_weight += weight

    tokutenkai_ticket_allocations: dict[str, int] = {}
    if total_tokutenkai_tickets > 0 and group.members:
        sales_weights: list[tuple[str, float]] = []
        total_sales_weight = 0.0
        for idol in group.members:
            sales_weight = max(0.1, sales_by_uid.get(str(idol.uid), 6.0))
            sales_weights.append((str(idol.uid), sales_weight))
            total_sales_weight += sales_weight
        fractional: list[tuple[float, str]] = []
        assigned = 0
        for uid, sales_weight in sales_weights:
            exact = (total_tokutenkai_tickets * sales_weight / total_sales_weight) if total_sales_weight > 0 else 0.0
            base = int(math.floor(exact))
            tokutenkai_ticket_allocations[uid] = base
            assigned += base
            fractional.append((exact - base, uid))
        fractional.sort(key=lambda item: item[0], reverse=True)
        for _, uid in fractional[: max(0, total_tokutenkai_tickets - assigned)]:
            tokutenkai_ticket_allocations[uid] = tokutenkai_ticket_allocations.get(uid, 0) + 1

    applied_members = []
    for index, (idol, weight) in enumerate(member_weights):
        before_condition = int(getattr(idol, "condition", 90) or 90)
        before_morale = int(getattr(idol, "morale", 50) or 50)
        share = (weight / total_weight) if total_weight > 0 else (1.0 / max(1, len(member_weights)))
        member_fan_gain = int(round(fan_gain * share))
        if fan_gain > 0 and member_fan_gain <= 0:
            member_fan_gain = 1 if index == 0 else 0
        elif fan_gain < 0 and member_fan_gain >= 0:
            member_fan_gain = -1 if index == 0 else 0

        idol.fan_count = max(0, int(getattr(idol, "fan_count", 0) or 0) + member_fan_gain)

        member_pop_delta = 0
        if satisfaction >= 84 and score_by_uid.get(str(idol.uid), performance_score) >= performance_score:
            member_pop_delta = 1
        elif satisfaction < 40 and score_by_uid.get(str(idol.uid), performance_score) < 45:
            member_pop_delta = -1
        idol.popularity = max(0, min(100, int(getattr(idol, "popularity", 0) or 0) + member_pop_delta))

        member_score = score_by_uid.get(str(idol.uid), performance_score)
        member_morale_delta = group_morale_gain
        if member_score >= performance_score + 6:
            member_morale_delta += 1
        elif member_score <= performance_score - 8 and member_morale_delta > 0:
            member_morale_delta -= 1

        idol.morale = max(0, min(100, int(getattr(idol, "morale", 50) or 50) + member_morale_delta))
        if hasattr(idol, "condition"):
            idol.condition = max(0, min(100, int(getattr(idol, "condition", 90) or 90)))
            if hasattr(idol, "_sync_legacy_status_fields"):
                idol._sync_legacy_status_fields()
        after_condition = int(getattr(idol, "condition", 90) or 90)
        after_morale = int(getattr(idol, "morale", 50) or 50)

        live_rating = None
        for item in live_result.get("member_scores", []):
            if isinstance(item, dict) and str(item.get("uid")) == str(idol.uid):
                try:
                    live_rating = float(item.get("rating"))
                except (TypeError, ValueError):
                    live_rating = None
                break
        idol.add_performance_rating(round(live_rating if live_rating is not None else (member_score / 10.0), 2))
        applied_members.append(
            {
                "uid": idol.uid,
                "name": idol.name,
                "performance_rating": round(live_rating if live_rating is not None else (member_score / 10.0), 2),
                "performance_score": round(member_score, 2),
                "fan_gain": member_fan_gain,
                "popularity_gain": member_pop_delta,
                "morale_gain": member_morale_delta,
                "condition_before": before_condition,
                "condition_after": after_condition,
                "condition_delta": after_condition - before_condition,
                "morale_before": before_morale,
                "morale_after": after_morale,
                "morale_delta": after_morale - before_morale,
                "tokutenkai_tickets": tokutenkai_ticket_allocations.get(str(idol.uid), 0),
            }
        )

    return {
        "group_fan_gain": fan_gain,
        "group_popularity_gain": popularity_gain,
        "group_morale_gain": group_morale_gain,
        "member_deltas": applied_members,
    }
