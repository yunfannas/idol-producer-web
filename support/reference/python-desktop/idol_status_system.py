"""
Managed-idol daily status system.

This module only models the playable/managed roster's day-to-day condition using:

- condition (0-100)
- morale (0-100)

Daily cost normalization:
- 2-hour live = 40 condition baseline
- stamina reduces that live cost by 1/40 per stamina point
- 4-hour training day = 10 condition baseline

Health/injury modifiers:
- active illness / injury statuses apply a temporary condition cap
- once the status ends, that cap gradually recovers toward 100
"""

from __future__ import annotations

from datetime import date
from hashlib import sha256
from typing import Any, Dict, Iterable, List, Optional

from idol import Idol

LIGHT_TRAINING_BLOCK_HOURS = 4.0
LIGHT_LIVE_EQ_MINUTES = 30
WEEKLY_TRAINING_LOG_LIMIT = 21
PHYSICAL_WEEKLY_MAINTENANCE_BLOCKS = 4.0
TECHNICAL_WEEKLY_MAINTENANCE_BLOCKS = 5.0
BASE_2H_LIVE_CONDITION_COST = 40.0
BASE_4H_TRAINING_CONDITION_COST = 10.0
MAX_TRAINING_LOAD = 20

_PHYSICAL_ATTRS = ("strength", "agility", "natural_fitness", "stamina")
_TECHNICAL_ATTRS = ("pitch", "tone", "breath", "rhythm", "power", "grace")
_SPECIAL_TRAINING_MAP = {
    "make-up": ("appearance", ("cute", "pretty")),
    "model": ("appearance", ("pretty", "cute")),
    "talking": ("mental", ("talking", "humor", "clever")),
    "host": ("mental", ("talking", "teamwork", "clever")),
    "variety": ("mental", ("humor", "talking", "teamwork")),
    "acting": ("mental", ("clever", "talking", "teamwork")),
}


def _clamp_100(value: int) -> int:
    return max(0, min(100, int(value)))


def _clamp_20(value: int) -> int:
    return max(0, min(20, int(value)))


def _avg(*values: int) -> float:
    return sum(values) / max(1, len(values))


def _parse_status_date(value: Any) -> date | None:
    if isinstance(value, date):
        return value
    text = str(value or "").split("T")[0].strip()
    if not text:
        return None
    try:
        return date.fromisoformat(text)
    except ValueError:
        return None


def _iter_status_entries(idol: Idol) -> Iterable[dict[str, Any]]:
    for entry in list(getattr(idol, "group_history", []) or []):
        for status in list(getattr(entry, "status_history", []) or []):
            if isinstance(status, dict):
                yield status
    for status in list(getattr(idol, "status_history", []) or []):
        if isinstance(status, dict):
            yield status


def _status_profile(status: dict[str, Any]) -> dict[str, Any] | None:
    kind = str(status.get("kind") or "").strip().lower()
    if kind not in {"injury", "illness", "health"}:
        return None

    status_type = str(status.get("injury_type") or status.get("illness_type") or "").strip().lower()
    summary = str(status.get("summary_ja") or status.get("summary") or "").strip().lower()
    text = f"{status_type} {summary}".strip()

    if kind == "injury":
        severe_keywords = (
            "fracture",
            "broken bone",
            "acl",
            "ligament",
            "tear",
            "rupture",
            "dislocation",
            "surgery",
            "operation",
            "concussion",
        )
        if any(keyword in text for keyword in severe_keywords):
            return {"kind": "injury", "label": "Major Injury", "cap": 55, "recovery_days": 45}
        return {"kind": "injury", "label": "Injury Recovery", "cap": 70, "recovery_days": 28}

    mental_keywords = (
        "adjustment disorder",
        "bipolar",
        "depression",
        "panic",
        "anxiety",
        "ptsd",
        "stress",
        "mental",
    )
    if any(keyword in text for keyword in mental_keywords):
        return {"kind": "illness", "label": "Mental Health Recovery", "cap": 65, "recovery_days": 60}

    surgery_keywords = ("tonsillectomy", "surgery", "operation", "post-op", "postoperative")
    if any(keyword in text for keyword in surgery_keywords):
        return {"kind": "illness", "label": "Post-Surgery Recovery", "cap": 68, "recovery_days": 30}

    infection_keywords = ("covid", "influenza", "flu", "fever", "virus", "viral", "infection")
    if any(keyword in text for keyword in infection_keywords):
        return {"kind": "illness", "label": "Illness Recovery", "cap": 80, "recovery_days": 14}

    return {"kind": "illness", "label": "Health Recovery", "cap": 75, "recovery_days": 21}


def condition_cap_state(idol: Idol, reference_date: Optional[date] = None) -> dict[str, Any]:
    target_date = reference_date or date.today()
    active_profiles: list[dict[str, Any]] = []
    latest_ended: tuple[date, dict[str, Any]] | None = None

    for status in _iter_status_entries(idol):
        profile = _status_profile(status)
        if profile is None:
            continue
        start_date = _parse_status_date(status.get("start_date"))
        end_date = _parse_status_date(status.get("end_date"))
        if start_date and start_date > target_date:
            continue
        if end_date is None or end_date >= target_date:
            active_profiles.append(profile)
            continue
        if latest_ended is None or end_date > latest_ended[0]:
            latest_ended = (end_date, profile)

    if active_profiles:
        active_profiles.sort(key=lambda item: int(item["cap"]))
        chosen = active_profiles[0]
        return {
            "condition_cap": int(chosen["cap"]),
            "is_limited": True,
            "is_recovering": False,
            "reason": str(chosen["label"]),
        }

    if latest_ended is not None:
        end_date, profile = latest_ended
        recovery_days = max(1, int(profile["recovery_days"]))
        days_since_end = max(0, (target_date - end_date).days)
        progress = min(1.0, days_since_end / float(recovery_days))
        recovered_cap = int(round(int(profile["cap"]) + ((100 - int(profile["cap"])) * progress)))
        return {
            "condition_cap": max(int(profile["cap"]), min(100, recovered_cap)),
            "is_limited": recovered_cap < 100,
            "is_recovering": recovered_cap < 100,
            "reason": str(profile["label"]) if recovered_cap < 100 else "",
        }

    return {
        "condition_cap": 100,
        "is_limited": False,
        "is_recovering": False,
        "reason": "",
    }


def _live_condition_cost(idol: Idol, live_count: int, live_minutes: int) -> float:
    stamina = int(getattr(getattr(getattr(idol, "attributes", None), "physical", None), "stamina", 12) or 12)
    effective_minutes = max(live_minutes, live_count * 120 if live_count > 0 else 0)
    if effective_minutes <= 0:
        return 0.0
    baseline_cost = BASE_2H_LIVE_CONDITION_COST * (effective_minutes / 120.0)
    stamina_modifier = max(0.0, 1.0 - (max(0, stamina) / 40.0))
    return baseline_cost * stamina_modifier


def _training_condition_cost(training_load: int) -> float:
    if training_load <= 0:
        return 0.0
    return BASE_4H_TRAINING_CONDITION_COST * (min(MAX_TRAINING_LOAD, training_load) / float(MAX_TRAINING_LOAD))


def training_bear_index(idol: Idol) -> int:
    """Return how much day-to-day training load this idol can handle safely."""
    physical = getattr(idol, "attributes", None).physical if getattr(idol, "attributes", None) else None
    mental = getattr(idol, "attributes", None).mental if getattr(idol, "attributes", None) else None

    stamina = int(getattr(physical, "stamina", 12) or 12)
    fitness = int(getattr(physical, "natural_fitness", 12) or 12)
    determination = int(getattr(mental, "determination", 12) or 12)

    base = 8.0 + (_avg(stamina, fitness) - 10.0) * 0.45 + (determination - 10.0) * 0.15
    base += (int(getattr(idol, "condition", 90) or 90) - 50) / 22.0
    return max(6, min(18, int(round(base))))


def _condition_score(idol: Idol) -> float:
    condition = int(getattr(idol, "condition", 90) or 90)
    morale = int(getattr(idol, "morale", 50) or 50)
    return condition + ((morale - 50) * 0.35)


def summarize_status(idol: Idol, reference_date: Optional[date] = None) -> Dict[str, object]:
    """Return display-friendly managed-idol condition labels."""
    condition_value = int(getattr(idol, "condition", 90) or 90)
    morale = int(getattr(idol, "morale", 50) or 50)
    bear = training_bear_index(idol)
    score = _condition_score(idol)
    cap_state = condition_cap_state(idol, reference_date)
    condition_cap = int(cap_state["condition_cap"])

    if condition_cap <= 60 and condition_value >= max(1, condition_cap - 5):
        availability = "Restricted"
        availability_color = "#ff7043"
    elif condition_value < 25:
        availability = "Pause Activities"
        availability_color = "#f44336"
    elif condition_value < 40:
        availability = "Rest Recommended"
        availability_color = "#ff9800"
    elif condition_value < 55:
        availability = "Caution"
        availability_color = "#ffc107"
    else:
        availability = "Available"
        availability_color = "#4caf50"

    if score >= 70:
        condition = "Excellent"
        condition_color = "#4caf50"
    elif score >= 42:
        condition = "Good"
        condition_color = "#8bc34a"
    elif score >= 16:
        condition = "Stable"
        condition_color = "#ffc107"
    elif score >= -8:
        condition = "Fatigued"
        condition_color = "#ff9800"
    else:
        condition = "Exhausted"
        condition_color = "#f44336"

    return {
        "condition_value": condition_value,
        "condition_cap": condition_cap,
        "morale": morale,
        "bear_index": bear,
        "condition": condition,
        "condition_color": condition_color,
        "availability": availability,
        "availability_color": availability_color,
        "condition_limit_reason": str(cap_state["reason"] or ""),
        "condition_limited": bool(cap_state["is_limited"]),
        "condition_recovering": bool(cap_state["is_recovering"]),
        "score": round(score, 1),
    }


def _safe_training_row(row: Optional[dict[str, Any]]) -> dict[str, int]:
    clean = {"sing": 0, "dance": 0, "physical": 0, "target": 0}
    if not isinstance(row, dict):
        return clean
    for key in tuple(clean.keys()):
        try:
            clean[key] = max(0, min(5, int(row.get(key, 0) or 0)))
        except (TypeError, ValueError):
            clean[key] = 0
    return clean


def normalize_training_week_log(raw: Any) -> dict[str, list[dict[str, Any]]]:
    """Return a cleaned idol_uid -> rolling daily workload log map."""
    normalized: dict[str, list[dict[str, Any]]] = {}
    if not isinstance(raw, dict):
        return normalized

    for uid, rows in raw.items():
        if not isinstance(rows, list):
            continue
        clean_rows: list[dict[str, Any]] = []
        for row in rows[-WEEKLY_TRAINING_LOG_LIMIT:]:
            if not isinstance(row, dict):
                continue
            clean_rows.append(
                {
                    "date": str(row.get("date") or ""),
                    "training": _safe_training_row(row.get("training")),
                    "live_count": max(0, int(row.get("live_count", 0) or 0)),
                    "live_minutes": max(0, int(row.get("live_minutes", 0) or 0)),
                    "focus_skill": str(row.get("focus_skill") or ""),
                }
            )
        normalized[str(uid)] = clean_rows
    return normalized


def _training_day_blocks(row: dict[str, int]) -> float:
    total = sum(row.values())
    if total <= 0:
        return 0.0
    sessions = min(2.0, total / 5.0)
    active = max(1, sum(1 for value in row.values() if value > 0))
    avg_intensity = total / active
    if avg_intensity >= 4.25:
        tier_multiplier = 2.0
    elif avg_intensity >= 2.5:
        tier_multiplier = 1.5
    else:
        tier_multiplier = 1.0
    return sessions * tier_multiplier


def _training_effect_multiplier(idol: Idol) -> float:
    attrs = getattr(idol, "attributes", None)
    mental = getattr(attrs, "mental", None)
    hidden = getattr(attrs, "hidden", None)
    determination = int(getattr(mental, "determination", 10) or 10)
    professionalism = int(getattr(hidden, "professionalism", 10) or 10)
    return max(0.80, min(1.22, 1.0 + ((determination - 10) * 0.012) + ((professionalism - 10) * 0.012)))


def _trend_style(actual: float, maintenance: float) -> tuple[str, str]:
    delta = actual - maintenance
    if delta >= 2.5:
        return "Rising", "#4caf50"
    if delta >= 0.75:
        return "Improving", "#8bc34a"
    if delta >= -0.75:
        return "Maintained", "#ffc107"
    if delta >= -2.0:
        return "Fading", "#ff9800"
    return "Dropping", "#f44336"


def record_training_day(
    training_week_log: dict[str, list[dict[str, Any]]],
    idol: Idol,
    *,
    target_date: Any,
    training_row: Optional[dict[str, Any]],
    live_count: int,
    live_minutes: int,
    focus_skill: Optional[str] = None,
) -> list[dict[str, Any]]:
    """Append one daily managed-idol workload row to the rolling history."""
    uid = str(getattr(idol, "uid", "") or "")
    if not uid:
        return []
    rows = training_week_log.setdefault(uid, [])
    rows.append(
        {
            "date": str(target_date),
            "training": _safe_training_row(training_row),
            "live_count": max(0, int(live_count)),
            "live_minutes": max(0, int(live_minutes)),
            "focus_skill": str(focus_skill or ""),
        }
    )
    if len(rows) > WEEKLY_TRAINING_LOG_LIMIT:
        del rows[:-WEEKLY_TRAINING_LOG_LIMIT]
    return rows


def summarize_weekly_attribute_trend(
    idol: Idol,
    training_rows: Optional[Iterable[dict[str, Any]]],
) -> dict[str, Any]:
    """Summarize last-week training pressure for attribute maintenance and growth."""
    rows = list(training_rows or [])[-7:]
    effect_multiplier = _training_effect_multiplier(idol)
    days = len(rows)

    if days == 0:
        return {
            "days_tracked": 0,
            "window_label": "No training history yet",
            "training_effect_multiplier": round(effect_multiplier, 3),
            "light_block_hours": LIGHT_TRAINING_BLOCK_HOURS,
            "live_equivalent_minutes": LIGHT_LIVE_EQ_MINUTES,
            "weekly_maintenance": {
                "physical": 0.0,
                "technical": 0.0,
            },
            "blocks": {
                "training": 0.0,
                "live": 0.0,
                "physical": 0.0,
                "technical": 0.0,
                "special": 0.0,
            },
            "physical": {
                "trend": "No Data",
                "color": "#a0a0a0",
                "delta_vs_maintenance": 0.0,
            },
            "technical": {
                "trend": "No Data",
                "color": "#a0a0a0",
                "delta_vs_maintenance": 0.0,
            },
            "special_training": {
                "focus_skill": "",
                "effective_blocks": 0.0,
                "mental_appearance_note": "Mental and appearance attributes do not decay here and only rise through special training focus.",
            },
        }

    physical_blocks = 0.0
    technical_blocks = 0.0
    special_blocks = 0.0
    live_blocks = 0.0
    total_training_blocks = 0.0
    focus_skill = ""

    for row in rows:
        training = _safe_training_row(row.get("training"))
        day_blocks = _training_day_blocks(training)
        total_training_blocks += day_blocks
        total_weight = sum(training.values())
        if total_weight > 0 and day_blocks > 0:
            physical_blocks += day_blocks * (training["physical"] / total_weight)
            technical_blocks += day_blocks * ((training["sing"] + training["dance"]) / total_weight)
            special_blocks += day_blocks * (training["target"] / total_weight)

        day_live_blocks = max(0.0, float(row.get("live_minutes", 0) or 0) / LIGHT_LIVE_EQ_MINUTES)
        live_blocks += day_live_blocks
        physical_blocks += day_live_blocks * 0.40
        technical_blocks += day_live_blocks * 0.60

        if row.get("focus_skill"):
            focus_skill = str(row.get("focus_skill") or "")

    maintenance_scale = days / 7.0
    physical_maintenance = PHYSICAL_WEEKLY_MAINTENANCE_BLOCKS * maintenance_scale
    technical_maintenance = TECHNICAL_WEEKLY_MAINTENANCE_BLOCKS * maintenance_scale
    physical_effective = physical_blocks * effect_multiplier
    technical_effective = technical_blocks * effect_multiplier
    special_effective = special_blocks * effect_multiplier
    physical_trend, physical_color = _trend_style(physical_effective, physical_maintenance)
    technical_trend, technical_color = _trend_style(technical_effective, technical_maintenance)

    return {
        "days_tracked": days,
        "window_label": f"{days}-day window" if days != 7 else "Last 7 days",
        "training_effect_multiplier": round(effect_multiplier, 3),
        "light_block_hours": LIGHT_TRAINING_BLOCK_HOURS,
        "live_equivalent_minutes": LIGHT_LIVE_EQ_MINUTES,
        "weekly_maintenance": {
            "physical": round(physical_maintenance, 2),
            "technical": round(technical_maintenance, 2),
        },
        "blocks": {
            "training": round(total_training_blocks, 2),
            "live": round(live_blocks, 2),
            "physical": round(physical_effective, 2),
            "technical": round(technical_effective, 2),
            "special": round(special_effective, 2),
        },
        "physical": {
            "trend": physical_trend,
            "color": physical_color,
            "delta_vs_maintenance": round(physical_effective - physical_maintenance, 2),
        },
        "technical": {
            "trend": technical_trend,
            "color": technical_color,
            "delta_vs_maintenance": round(technical_effective - technical_maintenance, 2),
        },
        "special_training": {
            "focus_skill": focus_skill,
            "effective_blocks": round(special_effective, 2),
            "mental_appearance_note": "Mental and appearance attributes do not decay here and only rise through special training focus.",
        },
    }


def _deterministic_week_index(idol: Idol, week_key: str, size: int, salt: str) -> int:
    token = f"{getattr(idol, 'uid', '')}|{week_key}|{salt}".encode("utf-8", errors="ignore")
    return int(sha256(token).hexdigest()[:8], 16) % max(1, size)


def _mutate_category_attr(idol: Idol, category_name: str, attr_names: tuple[str, ...], delta: int, week_key: str, salt: str) -> dict[str, int]:
    category = getattr(getattr(idol, "attributes", None), category_name, None)
    if category is None or delta == 0:
        return {}
    attr_name = attr_names[_deterministic_week_index(idol, week_key, len(attr_names), salt)]
    current_value = int(getattr(category, attr_name, 0) or 0)
    new_value = _clamp_20(current_value + delta)
    if new_value == current_value:
        return {}
    setattr(category, attr_name, new_value)
    return {attr_name: new_value - current_value}


def apply_weekly_attribute_maintenance(
    idol: Idol,
    training_rows: Optional[Iterable[dict[str, Any]]],
    *,
    week_key: Optional[str] = None,
) -> dict[str, Any]:
    """Apply one weekly physical/technical maintenance pass from the last 7 days."""
    summary = summarize_weekly_attribute_trend(idol, training_rows)
    resolved_week_key = str(week_key or "")
    if not resolved_week_key:
        rows = list(training_rows or [])
        resolved_week_key = str(rows[-1].get("date") or "week") if rows else "week"

    deltas: dict[str, dict[str, int]] = {}

    physical_gap = float(summary["physical"]["delta_vs_maintenance"])
    if physical_gap <= -1.5:
        deltas["physical"] = _mutate_category_attr(idol, "physical", _PHYSICAL_ATTRS, -1, resolved_week_key, "physical_down")
    elif physical_gap >= 3.0:
        deltas["physical"] = _mutate_category_attr(idol, "physical", _PHYSICAL_ATTRS, 1, resolved_week_key, "physical_up")

    technical_gap = float(summary["technical"]["delta_vs_maintenance"])
    if technical_gap <= -1.5:
        deltas["technical"] = _mutate_category_attr(idol, "technical", _TECHNICAL_ATTRS, -1, resolved_week_key, "technical_down")
    elif technical_gap >= 3.25:
        deltas["technical"] = _mutate_category_attr(idol, "technical", _TECHNICAL_ATTRS, 1, resolved_week_key, "technical_up")

    special = summary["special_training"]
    focus_skill = str(special.get("focus_skill") or "")
    effect_blocks = float(special.get("effective_blocks", 0.0) or 0.0)
    if focus_skill in _SPECIAL_TRAINING_MAP and effect_blocks >= 2.75:
        category_name, attr_names = _SPECIAL_TRAINING_MAP[focus_skill]
        changed = _mutate_category_attr(idol, category_name, attr_names, 1, resolved_week_key, f"special_{focus_skill}")
        if changed:
            deltas[category_name] = changed

    summary["applied_deltas"] = deltas
    return summary


def apply_daily_status_update(
    idol: Idol,
    *,
    training_load: int,
    live_count: int,
    live_minutes: int = 0,
    birthday: bool = False,
    reference_date: Optional[date] = None,
) -> Dict[str, object]:
    """
    Apply one closed day of status changes to a managed idol.

    Args:
        idol: Managed idol to mutate.
        training_load: Day load from sliders / planned training.
        live_count: Number of managed-group lives on the day.
        live_minutes: Total live-performance minutes on the day.
        birthday: Whether the day is the idol's birthday.
    """
    training_load = max(0, int(training_load))
    live_count = max(0, int(live_count))
    live_minutes = max(0, int(live_minutes))

    before = summarize_status(idol, reference_date=reference_date)
    bear = int(before["bear_index"])
    live_load = max(0, live_minutes // 30)
    total_load = training_load + live_load
    overwork = max(0, training_load - bear)

    condition_delta = 0
    morale_delta = 0
    live_cost = _live_condition_cost(idol, live_count, live_minutes)
    training_cost = _training_condition_cost(training_load)
    overload_cost = 0.0
    total_condition_cost = live_cost + training_cost + overload_cost

    if total_condition_cost <= 0:
        condition_delta += 6
        morale_delta += 1
    else:
        condition_delta -= int(round(total_condition_cost))
        if live_count == 0 and training_cost <= 5.0:
            condition_delta += 2
        elif total_condition_cost <= 10.0:
            condition_delta += 1

        if overwork > 0:
            morale_delta -= 1 + (overwork // 4)
        elif training_load > 0:
            morale_delta += 1

    if live_count > 0:
        if int(before["condition_value"]) >= 60:
            morale_delta += 1
        elif int(before["condition_value"]) < 40:
            morale_delta -= 1

    if birthday:
        morale_delta += 3

    if float(total_condition_cost) >= 25.0:
        morale_delta -= 1
    if int(before["condition_value"]) < 35:
        morale_delta -= 2

    next_condition = _clamp_100(int(getattr(idol, "condition", 90) or 90) + condition_delta)
    idol.condition = min(int(before["condition_cap"]), next_condition)
    idol.morale = _clamp_100(int(getattr(idol, "morale", 50) or 50) + morale_delta)
    if hasattr(idol, "_sync_legacy_status_fields"):
        idol._sync_legacy_status_fields()

    after = summarize_status(idol, reference_date=reference_date)
    return {
        "idol_uid": getattr(idol, "uid", ""),
        "idol_name": getattr(idol, "name", ""),
        "training_load": training_load,
        "live_count": live_count,
        "live_minutes": live_minutes,
        "birthday": birthday,
        "total_load": total_load,
        "condition_costs": {
            "live": round(live_cost, 2),
            "training": round(training_cost, 2),
            "overload": round(overload_cost, 2),
            "total": round(total_condition_cost, 2),
        },
        "before": before,
        "after": after,
        "delta": {
            "condition": int(after["condition_value"]) - int(before["condition_value"]),
            "morale": int(after["morale"]) - int(before["morale"]),
        },
    }
