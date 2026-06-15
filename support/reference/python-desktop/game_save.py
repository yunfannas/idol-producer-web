"""
Game save file handling (JSON payloads stored under saves/, e.g. saves/test0.save).

Schema (version 11):
  - player_name: optional producer name entered on new game
  - managing_group: display name / romanji key for GroupManager.find_group
  - managing_group_uid: stable uid for the currently managed group
  - database_snapshot: in-save copies of idols.json, groups.json, and songs.json used as the mutable in-game database
  - scenario_context: active startup date + source paths used to validate scenario-bound saves
    and optional shared attribute overlay metadata
  - shortlist: idol uids in order
  - schedules: per-day agenda rows (calendar / Today view)
  - current_date, game_start_date: ISO date strings (YYYY-MM-DD)
  - turn_number: positive int (in-game day counter)
  - lives: upcoming/played lives and simple result records (extensible)
  - finances: cash, ledger history, and finance simulation state
  - training_intensity: { idol_uid: { sing, dance, physical, target: 0–5 } } (legacy key misc is migrated to target)
  - training_week_log: { idol_uid: [ { date, training, live_count, live_minutes, focus_skill } ] } rolling managed-idol workload log
  - training_focus_skill: { idol_uid: make-up | talking | model | host | variety | acting }
  - scout: selected scout company plus held audition boards
"""

from __future__ import annotations

import copy
import json
import os
from typing import Any, Dict, List, Optional


class GameSave:
    """Load and persist JSON save files with versioned structure."""

    VERSION = 11

    @classmethod
    def _default_payload(cls) -> Dict[str, Any]:
        return {
            "version": cls.VERSION,
            "player_name": "",
            "managing_group": None,
            "managing_group_uid": None,
            "scenario_context": {
                "startup_date": None,
                "idols_path": None,
                "groups_path": None,
                "songs_path": None,
                "shared_attributes_path": None,
                "idols_signature": None,
                "groups_signature": None,
                "songs_signature": None,
                "shared_attributes_signature": None,
            },
            "database_snapshot": {
                "idols": [],
                "groups": [],
                "songs": [],
            },
            "scenario_runtime": {
                "future_events": [],
            },
            "shortlist": [],
            "inbox": {
                "notifications": [],
            },
            "schedules": {},
            "lives": {
                "schedules": [],
                "results": [],
            },
            "finances": cls.default_finances(),
            "training_week_log": {},
            "scout": {
                "selected_company_uid": None,
                "auditions": {},
            },
        }

    @staticmethod
    def default_finances() -> Dict[str, Any]:
        """Fallback finances block before the finance system fully initializes."""
        return {
            "status": "pending_init",
            "cash_yen": None,
            "currency": "JPY",
            "notes": "Waiting for finance initialization.",
        }

    def __init__(self, path: str):
        self.path = path

    @staticmethod
    def path_test0(repo_root: str) -> str:
        return os.path.join(repo_root, "saves", "test0.save")

    def ensure_exists(self) -> None:
        """Create parent dir and empty save if the file is missing."""
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
        except OSError:
            return
        if not os.path.isfile(self.path):
            # Minimal stub so "shortlist" / "managing_group" absent means "use runtime defaults"
            with open(self.path, "w", encoding="utf-8") as handle:
                json.dump({"version": self.VERSION, "schedules": {}}, handle, indent=2, ensure_ascii=False)

    def _backup_path(self) -> str:
        return f"{self.path}.bak"

    @staticmethod
    def _read_json_dict(path: str) -> Optional[Dict[str, Any]]:
        if not path or not os.path.isfile(path):
            return None
        try:
            with open(path, "r", encoding="utf-8-sig") as handle:
                payload = json.load(handle)
            return payload if isinstance(payload, dict) else None
        except (OSError, UnicodeDecodeError):
            return None
        except json.JSONDecodeError:
            try:
                with open(path, "r", encoding="utf-8-sig") as handle:
                    text = handle.read()
            except (OSError, UnicodeDecodeError):
                return None
            try:
                decoder = json.JSONDecoder()
                payload, _end = decoder.raw_decode(text)
            except json.JSONDecodeError:
                return None
            return payload if isinstance(payload, dict) else None

    @staticmethod
    def _notification_count(payload: Optional[Dict[str, Any]]) -> int:
        if not isinstance(payload, dict):
            return 0
        inbox = payload.get("inbox")
        if not isinstance(inbox, dict):
            return 0
        notifications = inbox.get("notifications")
        return len(notifications) if isinstance(notifications, list) else 0

    @staticmethod
    def _live_schedule_count(payload: Optional[Dict[str, Any]]) -> int:
        if not isinstance(payload, dict):
            return 0
        lives = payload.get("lives")
        if not isinstance(lives, dict):
            return 0
        schedules = lives.get("schedules")
        return len(schedules) if isinstance(schedules, list) else 0

    @classmethod
    def _looks_like_reset_shell(cls, payload: Optional[Dict[str, Any]]) -> bool:
        if not isinstance(payload, dict):
            return False
        managing_group = str(payload.get("managing_group") or "").strip()
        managing_group_uid = str(payload.get("managing_group_uid") or "").strip()
        shortlist = payload.get("shortlist")
        turn_number = payload.get("turn_number")
        try:
            turn_number = int(turn_number) if turn_number is not None else 0
        except (TypeError, ValueError):
            turn_number = 0
        return (
            not managing_group
            and not managing_group_uid
            and cls._notification_count(payload) == 0
            and cls._live_schedule_count(payload) == 0
            and (not isinstance(shortlist, list) or len(shortlist) == 0)
            and turn_number <= 1
        )

    @classmethod
    def _should_prefer_backup(cls, primary: Optional[Dict[str, Any]], backup: Optional[Dict[str, Any]]) -> bool:
        if not isinstance(backup, dict):
            return False
        if primary is None:
            return True
        backup_has_runtime = bool(str(backup.get("managing_group") or "").strip() or str(backup.get("managing_group_uid") or "").strip())
        backup_has_activity = cls._notification_count(backup) > 0 or cls._live_schedule_count(backup) > 0
        if not (backup_has_runtime or backup_has_activity):
            return False
        return cls._looks_like_reset_shell(primary)

    def load_raw(self) -> Dict[str, Any]:
        """Load the best available raw payload, preferring .bak over a reset-shell primary save."""
        self.ensure_exists()
        primary = self._read_json_dict(self.path)
        backup = self._read_json_dict(self._backup_path())
        if self._should_prefer_backup(primary, backup):
            return copy.deepcopy(backup)
        return copy.deepcopy(primary) if isinstance(primary, dict) else {}

    @classmethod
    def normalize_payload(cls, payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
        """Merge a loaded dict with defaults; tolerate v1-only saves."""
        base = copy.deepcopy(cls._default_payload())
        if not isinstance(payload, dict):
            return base

        if isinstance(payload.get("schedules"), dict):
            base["schedules"] = payload["schedules"]

        if "managing_group" in payload:
            base["managing_group"] = payload["managing_group"]
        if "managing_group_uid" in payload:
            base["managing_group_uid"] = payload["managing_group_uid"]

        if payload.get("player_name") is not None:
            base["player_name"] = str(payload.get("player_name") or "").strip()

        if "scenario_context" in payload and isinstance(payload["scenario_context"], dict):
            context = payload["scenario_context"]
            for key in (
                "startup_date",
                "idols_path",
                "groups_path",
                "songs_path",
                "shared_attributes_path",
                "idols_signature",
                "groups_signature",
                "songs_signature",
                "shared_attributes_signature",
            ):
                if context.get(key) is not None:
                    base["scenario_context"][key] = str(context.get(key))

        if "database_snapshot" in payload and isinstance(payload["database_snapshot"], dict):
            snapshot = payload["database_snapshot"]
            if isinstance(snapshot.get("idols"), list):
                base["database_snapshot"]["idols"] = copy.deepcopy(snapshot["idols"])
            if isinstance(snapshot.get("groups"), list):
                base["database_snapshot"]["groups"] = copy.deepcopy(snapshot["groups"])
            if isinstance(snapshot.get("songs"), list):
                base["database_snapshot"]["songs"] = copy.deepcopy(snapshot["songs"])

        if "scenario_runtime" in payload and isinstance(payload["scenario_runtime"], dict):
            runtime = payload["scenario_runtime"]
            future_events = runtime.get("future_events")
            if isinstance(future_events, list):
                base["scenario_runtime"]["future_events"] = [copy.deepcopy(item) for item in future_events if isinstance(item, dict)]

        if "shortlist" in payload and isinstance(payload["shortlist"], list):
            base["shortlist"] = [str(x) for x in payload["shortlist"] if x is not None]

        if "inbox" in payload and isinstance(payload["inbox"], dict):
            notifications = payload["inbox"].get("notifications")
            if isinstance(notifications, list):
                base["inbox"]["notifications"] = [copy.deepcopy(item) for item in notifications if isinstance(item, dict)]

        if "lives" in payload and isinstance(payload["lives"], dict):
            lives_in = payload["lives"]
            if isinstance(lives_in.get("schedules"), list):
                base["lives"]["schedules"] = list(lives_in["schedules"])
            if isinstance(lives_in.get("results"), list):
                base["lives"]["results"] = list(lives_in["results"])

        if "finances" in payload and isinstance(payload["finances"], dict):
            merged = {**base["finances"], **payload["finances"]}
            base["finances"] = merged

        if "scout" in payload and isinstance(payload["scout"], dict):
            scout_in = payload["scout"]
            if scout_in.get("selected_company_uid") is not None:
                base["scout"]["selected_company_uid"] = str(scout_in.get("selected_company_uid"))
            if isinstance(scout_in.get("auditions"), dict):
                base["scout"]["auditions"] = copy.deepcopy(scout_in["auditions"])

        if "current_date" in payload and payload["current_date"] is not None:
            base["current_date"] = str(payload["current_date"]).split("T")[0]
        if "game_start_date" in payload and payload["game_start_date"] is not None:
            base["game_start_date"] = str(payload["game_start_date"]).split("T")[0]
        if "turn_number" in payload and payload["turn_number"] is not None:
            try:
                base["turn_number"] = int(payload["turn_number"])
            except (TypeError, ValueError):
                pass

        if "training_intensity" in payload and isinstance(payload["training_intensity"], dict):
            base["training_intensity"] = copy.deepcopy(payload["training_intensity"])
            for _uid, cols in base["training_intensity"].items():
                if not isinstance(cols, dict) or "misc" not in cols:
                    continue
                if "target" not in cols:
                    try:
                        cols["target"] = max(0, min(5, int(cols["misc"])))
                    except (TypeError, ValueError):
                        cols["target"] = 0
                cols.pop("misc", None)

        if "training_week_log" in payload and isinstance(payload["training_week_log"], dict):
            base["training_week_log"] = copy.deepcopy(payload["training_week_log"])

        if "training_focus_skill" in payload and isinstance(payload["training_focus_skill"], dict):
            base["training_focus_skill"] = copy.deepcopy(payload["training_focus_skill"])

        base["version"] = cls.VERSION
        return base

    def load(self) -> Dict[str, Any]:
        """Load full JSON payload; on error or missing file, return defaults."""
        return self.normalize_payload(self.load_raw())

    def write(self, payload: Dict[str, Any]) -> None:
        """Write payload to disk (creates parent dirs)."""
        try:
            os.makedirs(os.path.dirname(self.path), exist_ok=True)
        except OSError:
            return
        out = self.normalize_payload(payload)
        # If caller omitted shortlist, do not emit a default [] (so next load keeps implicit seeding).
        if "shortlist" not in payload:
            out.pop("shortlist", None)
        with open(self.path, "w", encoding="utf-8") as handle:
            json.dump(out, handle, indent=2, ensure_ascii=False)

    @staticmethod
    def parse_schedules(payload: Dict[str, Any]) -> Dict[str, List[dict]]:
        """Return date -> list of raw schedule row dicts from payload['schedules']."""
        raw_schedules = payload.get("schedules")
        if not isinstance(raw_schedules, dict):
            return {}
        result: Dict[str, List[dict]] = {}
        for date_key, day_val in raw_schedules.items():
            key = str(date_key)
            rows: list = []
            if isinstance(day_val, list):
                rows = day_val
            elif isinstance(day_val, dict):
                for section in ("group", "members", "member", "items", "events"):
                    block = day_val.get(section)
                    if isinstance(block, list):
                        rows.extend(block)
            else:
                continue
            result[key] = [item for item in rows if isinstance(item, dict)]
        return result
