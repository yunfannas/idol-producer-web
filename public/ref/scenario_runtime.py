"""
Scenario runtime helpers for turning future-dated scenario data into day-by-day events.
"""

from __future__ import annotations

import copy
import hashlib
from datetime import date, timedelta
from typing import Any, Optional


def _parse_iso_date(value: Any) -> Optional[date]:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value).split("T")[0])
    except ValueError:
        return None


def _event_uid(
    event_type: str,
    effective_date: str,
    *,
    idol_uid: str = "",
    group_uid: str = "",
    group_name: str = "",
    start_date: str = "",
    end_date: str = "",
    detail_key: str = "",
) -> str:
    seed = "|".join(
        [
            event_type,
            effective_date,
            idol_uid,
            group_uid,
            group_name,
            start_date,
            end_date,
            detail_key,
        ]
    )
    return hashlib.sha1(seed.encode("utf-8")).hexdigest()[:24]


def _detail_key(detail: Optional[dict[str, Any]]) -> str:
    if not isinstance(detail, dict):
        return ""
    return "|".join(
        [
            str(detail.get("kind") or ""),
            str(detail.get("start_date") or ""),
            str(detail.get("member_color") or ""),
            str(detail.get("summary_ja") or detail.get("summary") or ""),
        ]
    )


def _build_event(
    event_type: str,
    effective_date: date,
    *,
    idol_row: Optional[dict[str, Any]] = None,
    group_row: Optional[dict[str, Any]] = None,
    entry: Optional[dict[str, Any]] = None,
    detail: Optional[dict[str, Any]] = None,
) -> dict[str, Any]:
    idol_uid = str((idol_row or {}).get("uid") or "")
    idol_name = str((idol_row or {}).get("name") or "")
    group_uid = str((group_row or {}).get("uid") or (entry or {}).get("group_uid") or "")
    group_name = str((group_row or {}).get("name") or (entry or {}).get("group_name") or "")
    start_date = str((entry or {}).get("start_date") or "")
    end_date = str((entry or {}).get("end_date") or "")
    detail_seed = _detail_key(detail)
    return {
        "uid": _event_uid(
            event_type,
            effective_date.isoformat(),
            idol_uid=idol_uid,
            group_uid=group_uid,
            group_name=group_name,
            start_date=start_date,
            end_date=end_date,
            detail_key=detail_seed,
        ),
        "type": event_type,
        "effective_date": effective_date.isoformat(),
        "idol_uid": idol_uid,
        "idol_name": idol_name,
        "group_uid": group_uid,
        "group_name": group_name,
        "entry": copy.deepcopy(entry) if isinstance(entry, dict) else None,
        "group_row": copy.deepcopy(group_row) if isinstance(group_row, dict) else None,
        "detail": copy.deepcopy(detail) if isinstance(detail, dict) else None,
    }


def _status_matches(existing: dict[str, Any], incoming: dict[str, Any]) -> bool:
    return (
        str(existing.get("kind") or "") == str(incoming.get("kind") or "")
        and str(existing.get("start_date") or "") == str(incoming.get("start_date") or "")
        and str(existing.get("summary_ja") or existing.get("summary") or "")
        == str(incoming.get("summary_ja") or incoming.get("summary") or "")
    )


def _member_color_change_matches(existing: dict[str, Any], incoming: dict[str, Any]) -> bool:
    return (
        str(existing.get("start_date") or "") == str(incoming.get("start_date") or "")
        and str(existing.get("member_color") or "") == str(incoming.get("member_color") or "")
        and str(existing.get("member_color_code") or "") == str(incoming.get("member_color_code") or "")
    )


def _entry_has_future_scandal_before(
    entry: dict[str, Any],
    *,
    window_start: date,
    leave_date: date,
) -> bool:
    for raw_status in entry.get("status_history", []) or []:
        if not isinstance(raw_status, dict):
            continue
        if str(raw_status.get("kind") or "") != "scandal":
            continue
        status_date = _parse_iso_date(raw_status.get("start_date"))
        if status_date is None:
            continue
        if window_start <= status_date < leave_date:
            return True
    return False


def _filter_entry_timeline(
    entry: dict[str, Any],
    idol_row: dict[str, Any],
    *,
    visible_as_of: date,
    future_events: list[dict[str, Any]],
) -> None:
    filtered_statuses: list[dict[str, Any]] = []
    for raw_status in entry.get("status_history", []) or []:
        if not isinstance(raw_status, dict):
            continue
        status = copy.deepcopy(raw_status)
        status_date = _parse_iso_date(status.get("start_date"))
        if status_date and status_date > visible_as_of:
            if str(status.get("kind") or "") == "scandal":
                future_events.append(
                    _build_event("idol_status_update", status_date, idol_row=idol_row, entry=entry, detail=status)
                )
            continue
        filtered_statuses.append(status)
    if filtered_statuses:
        entry["status_history"] = filtered_statuses
    else:
        entry.pop("status_history", None)

    filtered_color_history: list[dict[str, Any]] = []
    for raw_change in entry.get("member_color_history", []) or []:
        if not isinstance(raw_change, dict):
            continue
        change = copy.deepcopy(raw_change)
        change_date = _parse_iso_date(change.get("start_date"))
        if change_date and change_date > visible_as_of:
            continue
        filtered_color_history.append(change)
    if filtered_color_history:
        entry["member_color_history"] = filtered_color_history
    else:
        entry.pop("member_color_history", None)


def build_filtered_snapshot_with_future_events(
    idols_rows: list[dict[str, Any]],
    groups_rows: list[dict[str, Any]],
    *,
    as_of: date,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Return snapshot rows filtered to one day plus queued future events."""
    filtered_groups: list[dict[str, Any]] = []
    filtered_idols: list[dict[str, Any]] = []
    future_events: list[dict[str, Any]] = []

    for raw_group in groups_rows or []:
        if not isinstance(raw_group, dict):
            continue
        group_row = copy.deepcopy(raw_group)
        formed_date = _parse_iso_date(group_row.get("formed_date"))
        ended_date = _parse_iso_date(group_row.get("ended_date"))

        if formed_date and formed_date > as_of:
            future_events.append(_build_event("group_formed", formed_date, group_row=group_row))
            if ended_date and ended_date > formed_date:
                future_events.append(_build_event("group_disbanded", ended_date, group_row=group_row))
            continue

        if ended_date and ended_date > as_of:
            future_events.append(_build_event("group_disbanded", ended_date, group_row=group_row))
            group_row["ended_date"] = None

        filtered_groups.append(group_row)

    for raw_idol in idols_rows or []:
        if not isinstance(raw_idol, dict):
            continue
        idol_row = copy.deepcopy(raw_idol)
        filtered_history: list[dict[str, Any]] = []
        for raw_entry in idol_row.get("group_history", []) or []:
            if not isinstance(raw_entry, dict):
                continue
            entry = copy.deepcopy(raw_entry)
            start_date = _parse_iso_date(entry.get("start_date"))
            end_date = _parse_iso_date(entry.get("end_date"))

            if start_date and start_date > as_of:
                join_entry = copy.deepcopy(entry)
                _filter_entry_timeline(join_entry, idol_row, visible_as_of=start_date, future_events=future_events)
                if end_date and end_date > start_date:
                    notice_date = end_date - timedelta(days=30)
                    if notice_date > as_of and not _entry_has_future_scandal_before(entry, window_start=notice_date, leave_date=end_date):
                        future_events.append(_build_event("idol_leave_notice", notice_date, idol_row=idol_row, entry=entry))
                    join_entry["end_date"] = None
                    future_events.append(_build_event("idol_leave_group", end_date, idol_row=idol_row, entry=entry))
                future_events.append(_build_event("idol_join_group", start_date, idol_row=idol_row, entry=join_entry))
                continue

            _filter_entry_timeline(entry, idol_row, visible_as_of=as_of, future_events=future_events)
            if end_date and end_date > as_of:
                notice_date = end_date - timedelta(days=30)
                if notice_date > as_of and not _entry_has_future_scandal_before(raw_entry, window_start=notice_date, leave_date=end_date):
                    future_events.append(_build_event("idol_leave_notice", notice_date, idol_row=idol_row, entry=entry))
                future_events.append(_build_event("idol_leave_group", end_date, idol_row=idol_row, entry=entry))
                entry["end_date"] = None

            filtered_history.append(entry)

        idol_row["group_history"] = filtered_history
        filtered_idols.append(idol_row)

    deduped: dict[str, dict[str, Any]] = {}
    for event in future_events:
        deduped[str(event.get("uid") or "")] = event

    events = list(deduped.values())
    events.sort(key=lambda item: (str(item.get("effective_date") or ""), str(item.get("type") or ""), str(item.get("uid") or "")))
    return filtered_idols, filtered_groups, events


def _group_matches(row: dict[str, Any], event: dict[str, Any]) -> bool:
    group_uid = str(event.get("group_uid") or "")
    group_name = str(event.get("group_name") or "")
    return (group_uid and str(row.get("uid") or "") == group_uid) or (group_name and str(row.get("name") or "") == group_name)


def _history_entry_matches(existing: dict[str, Any], incoming: dict[str, Any]) -> bool:
    existing_group_uid = str(existing.get("group_uid") or "")
    incoming_group_uid = str(incoming.get("group_uid") or "")
    if existing_group_uid and incoming_group_uid and existing_group_uid == incoming_group_uid:
        pass
    elif str(existing.get("group_name") or "") != str(incoming.get("group_name") or ""):
        return False
    return (
        str(existing.get("start_date") or "") == str(incoming.get("start_date") or "")
        and str(existing.get("member_name") or "") == str(incoming.get("member_name") or "")
    )


def _idol_display_name_for_event(idol_row: dict[str, Any], event: dict[str, Any]) -> str:
    entry = event.get("entry") if isinstance(event.get("entry"), dict) else {}
    member_name = str(entry.get("member_name") or "").strip()
    if member_name:
        return member_name
    return str(idol_row.get("name") or event.get("idol_name") or "").strip()


def _remove_uid_name_pair(names: list[Any], uids: list[Any], target_uid: str) -> tuple[list[str], list[str]]:
    pairs = [(str(name), str(uid)) for name, uid in zip(names or [], uids or []) if str(uid) != target_uid]
    return [name for name, _ in pairs], [uid for _, uid in pairs]


def _ensure_member_membership(group_row: dict[str, Any], idol_row: dict[str, Any], event: dict[str, Any]) -> None:
    idol_uid = str(idol_row.get("uid") or event.get("idol_uid") or "")
    display_name = _idol_display_name_for_event(idol_row, event)
    member_names, member_uids = _remove_uid_name_pair(group_row.get("member_names", []), group_row.get("member_uids", []), idol_uid)
    past_names, past_uids = _remove_uid_name_pair(group_row.get("past_member_names", []), group_row.get("past_member_uids", []), idol_uid)
    member_names.append(display_name)
    member_uids.append(idol_uid)
    group_row["member_names"] = member_names
    group_row["member_uids"] = member_uids
    group_row["past_member_names"] = past_names
    group_row["past_member_uids"] = past_uids
    group_row["member_count"] = len(member_uids)
    group_row["past_member_count"] = len(past_uids)


def _ensure_past_member_membership(group_row: dict[str, Any], idol_row: dict[str, Any], event: dict[str, Any]) -> None:
    idol_uid = str(idol_row.get("uid") or event.get("idol_uid") or "")
    display_name = _idol_display_name_for_event(idol_row, event)
    member_names, member_uids = _remove_uid_name_pair(group_row.get("member_names", []), group_row.get("member_uids", []), idol_uid)
    past_names, past_uids = _remove_uid_name_pair(group_row.get("past_member_names", []), group_row.get("past_member_uids", []), idol_uid)
    past_names.append(display_name)
    past_uids.append(idol_uid)
    group_row["member_names"] = member_names
    group_row["member_uids"] = member_uids
    group_row["past_member_names"] = past_names
    group_row["past_member_uids"] = past_uids
    group_row["member_count"] = len(member_uids)
    group_row["past_member_count"] = len(past_uids)


def apply_due_future_events(
    idols_rows: list[dict[str, Any]],
    groups_rows: list[dict[str, Any]],
    future_events: list[dict[str, Any]],
    *,
    as_of: date,
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Apply queued events due on or before as_of to snapshot rows."""
    idols = copy.deepcopy(idols_rows or [])
    groups = copy.deepcopy(groups_rows or [])
    pending: list[dict[str, Any]] = []
    applied: list[dict[str, Any]] = []

    idols_by_uid = {str(row.get("uid") or ""): row for row in idols if isinstance(row, dict)}

    def _find_group(event: dict[str, Any]) -> Optional[dict[str, Any]]:
        for row in groups:
            if isinstance(row, dict) and _group_matches(row, event):
                return row
        return None

    type_order = {
        "group_formed": 0,
        "idol_join_group": 1,
        "idol_status_update": 2,
        "idol_leave_notice": 3,
        "idol_leave_group": 4,
        "group_disbanded": 5,
    }
    sorted_events = sorted(
        [event for event in future_events or [] if isinstance(event, dict)],
        key=lambda item: (
            str(item.get("effective_date") or ""),
            type_order.get(str(item.get("type") or ""), 99),
            str(item.get("uid") or ""),
        ),
    )

    for event in sorted_events:
        effective_date = _parse_iso_date(event.get("effective_date"))
        if effective_date is None or effective_date > as_of:
            pending.append(copy.deepcopy(event))
            continue

        event_type = str(event.get("type") or "")
        if event_type == "group_formed":
            if _find_group(event) is None and isinstance(event.get("group_row"), dict):
                groups.append(copy.deepcopy(event["group_row"]))
            applied.append(copy.deepcopy(event))
            continue

        if event_type == "group_disbanded":
            target_group = _find_group(event)
            if target_group is not None and isinstance(event.get("group_row"), dict):
                target_group["ended_date"] = event["group_row"].get("ended_date")
            applied.append(copy.deepcopy(event))
            continue

        if event_type == "idol_leave_notice":
            applied.append(copy.deepcopy(event))
            continue

        idol_uid = str(event.get("idol_uid") or "")
        idol_row = idols_by_uid.get(idol_uid)
        entry = event.get("entry") if isinstance(event.get("entry"), dict) else None
        if idol_row is None or entry is None:
            applied.append(copy.deepcopy(event))
            continue

        history = idol_row.get("group_history")
        if not isinstance(history, list):
            history = []
            idol_row["group_history"] = history

        if event_type == "idol_join_group":
            if not any(_history_entry_matches(existing, entry) for existing in history if isinstance(existing, dict)):
                history.append(copy.deepcopy(entry))
                history.sort(key=lambda item: str(item.get("start_date") or ""), reverse=True)
            target_group = _find_group(event)
            if target_group is not None:
                _ensure_member_membership(target_group, idol_row, event)
            applied.append(copy.deepcopy(event))
            continue

        if event_type == "idol_status_update":
            detail = event.get("detail") if isinstance(event.get("detail"), dict) else None
            if detail is None:
                applied.append(copy.deepcopy(event))
                continue
            target_entry = None
            for existing in history:
                if isinstance(existing, dict) and _history_entry_matches(existing, entry):
                    target_entry = existing
                    break
            if target_entry is not None:
                status_history = target_entry.get("status_history")
                if not isinstance(status_history, list):
                    status_history = []
                    target_entry["status_history"] = status_history
                if not any(_status_matches(existing, detail) for existing in status_history if isinstance(existing, dict)):
                    status_history.append(copy.deepcopy(detail))
                    status_history.sort(key=lambda item: str(item.get("start_date") or ""))
            applied.append(copy.deepcopy(event))
            continue

        if event_type == "idol_leave_group":
            for existing in history:
                if isinstance(existing, dict) and _history_entry_matches(existing, entry):
                    existing["end_date"] = entry.get("end_date")
                    break
            target_group = _find_group(event)
            if target_group is not None:
                _ensure_past_member_membership(target_group, idol_row, event)
            applied.append(copy.deepcopy(event))
            continue

        pending.append(copy.deepcopy(event))

    return idols, groups, pending, applied


def describe_applied_event(event: dict[str, Any]) -> tuple[str, str]:
    """Return a compact title/body pair for inbox/news generation."""
    idol_name = str(event.get("idol_name") or "A member").strip()
    group_name = str(event.get("group_name") or "a group").strip()
    event_type = str(event.get("type") or "")
    if event_type == "group_formed":
        return (f"Group formed: {group_name}", f"{group_name} has officially started activities.")
    if event_type == "group_disbanded":
        return (f"Group disbanded: {group_name}", f"{group_name} has ended activities.")
    if event_type == "idol_join_group":
        return (f"Member joined: {idol_name}", f"{idol_name} joined {group_name}.")
    if event_type == "idol_leave_notice":
        return (f"Advance notice: {idol_name}", f"{idol_name} is expected to leave {group_name} in about one month.")
    if event_type == "idol_leave_group":
        return (f"Member left: {idol_name}", f"{idol_name} left {group_name}.")
    if event_type == "idol_status_update":
        detail = event.get("detail") if isinstance(event.get("detail"), dict) else {}
        kind = str(detail.get("kind") or "")
        summary = str(detail.get("summary_ja") or detail.get("summary") or "").strip()
        if kind == "scandal":
            body = summary or f"A scandal involving {idol_name} has become public."
            return (f"Scandal revealed: {idol_name}", body)
        if summary:
            return (f"Member update: {idol_name}", summary)
        return (f"Member update: {idol_name}", f"A scheduled update was recorded for {idol_name} in {group_name}.")
    return ("Scenario update", f"A scheduled scenario event was applied for {group_name}.")
