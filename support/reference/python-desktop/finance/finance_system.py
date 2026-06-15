"""
Simple finance simulation for Idol Producer.

Provides scenario-based starting cash, daily revenue/expense settlement,
and a compact ledger structure that can be persisted into the save file.
"""

from __future__ import annotations

import json
import math
from copy import deepcopy
from datetime import date, timedelta
from pathlib import Path
from typing import Any, Dict, Iterable, List


FINANCE_DIR = Path(__file__).resolve().parent
TYPICAL_SETTINGS_PATH = FINANCE_DIR / "typical_tier_d_group.json"
GROUP_FINANCE_PATH = FINANCE_DIR / "group_finance.json"


def _load_group_finance() -> Dict[str, Any]:
    try:
        with GROUP_FINANCE_PATH.open("r", encoding="utf-8") as handle:
            payload = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return {}
    return payload if isinstance(payload, dict) else {}


_GROUP_FINANCE = _load_group_finance()
_lgm = _GROUP_FINANCE.get("live_goods_model")
_LIVE_GOODS_MODEL: Dict[str, Any] = _lgm if isinstance(_lgm, dict) else {}
_scm = _GROUP_FINANCE.get("staff_count_by_group_letter_tier")
_STAFF_COUNT_MODEL: Dict[str, Any] = _scm if isinstance(_scm, dict) else {}
_com = _GROUP_FINANCE.get("commercial_income_guess_letter_tier_s_through_b")
_COMMERCIAL_INCOME_GUESS: Dict[str, Any] = _com if isinstance(_com, dict) else {}
_cdm = _GROUP_FINANCE.get("cd_sales_model")
_CD_SALES_MODEL: Dict[str, Any] = _cdm if isinstance(_cdm, dict) else {}
_mcp = _GROUP_FINANCE.get("member_compensation_by_letter_tier")
_MEMBER_COMPENSATION_MODEL: Dict[str, Any] = _mcp if isinstance(_mcp, dict) else {}


def _default_financial_constants_flat() -> Dict[str, Any]:
    """Keys merged into tier-D scenario; defined in group_finance.json → default_financial_constants."""
    block = _GROUP_FINANCE.get("default_financial_constants")
    if not isinstance(block, dict):
        return {}
    return {k: v for k, v in block.items() if not str(k).startswith("_")}


def _load_typical_settings() -> Dict[str, Any]:
    base = _default_financial_constants_flat()
    try:
        with TYPICAL_SETTINGS_PATH.open("r", encoding="utf-8") as handle:
            typical = json.load(handle)
    except (OSError, json.JSONDecodeError):
        return base
    if not isinstance(typical, dict):
        return base
    merged = {**base, **typical}
    return merged


_TYPICAL_SETTINGS = _load_typical_settings()


class FinanceSystem:
    """Utility methods for managing the game's finance payload."""

    AVERAGE_MONTHLY_BASE_SALARY = int(_TYPICAL_SETTINGS.get("average_monthly_base_salary_yen", 240_000))
    TOKUTENKAI_IDOL_SHARE_RATE = float(_TYPICAL_SETTINGS.get("tokutenkai_idol_share_rate", 0.10))
    SMALL_VENUE_CAPACITY_THRESHOLD = int(_TYPICAL_SETTINGS.get("small_venue_capacity_threshold", 300))
    SMALL_VENUE_EVENT_FEE = int(_TYPICAL_SETTINGS.get("small_venue_event_fee_yen", 1_200_000))
    SMALL_VENUE_EVENT_FEE_WEEKDAY = int(_TYPICAL_SETTINGS.get("small_venue_event_fee_weekday_yen", SMALL_VENUE_EVENT_FEE))
    SMALL_VENUE_EVENT_FEE_WEEKEND_HOLIDAY = int(
        _TYPICAL_SETTINGS.get("small_venue_event_fee_weekend_holiday_yen", SMALL_VENUE_EVENT_FEE_WEEKDAY)
    )

    SCENARIO_STARTING_CASH = {
        1: 2_000_000,
        2: 5_000_000,
        3: 10_000_000,
        4: 8_000_000,
        5: 12_000_000,
        6: 20_000_000,
    }
    DEFAULT_STARTING_CASH = 5_000_000
    LEDGER_LIMIT = 180

    @classmethod
    def scenario_starting_cash(cls, scenario_number: int | None) -> int:
        if scenario_number in cls.SCENARIO_STARTING_CASH:
            return cls.SCENARIO_STARTING_CASH[int(scenario_number)]
        return cls.DEFAULT_STARTING_CASH

    @classmethod
    def default_finances(cls, starting_cash: int | None = None) -> Dict[str, Any]:
        start_cash = int(starting_cash if starting_cash is not None else cls.DEFAULT_STARTING_CASH)
        return {
            "status": "active",
            "currency": "JPY",
            "cash_yen": start_cash,
            "opening_cash_yen": start_cash,
            "last_processed_date": None,
            "ledger": [],
            "notes": "Daily cash flow simulation enabled.",
        }

    @classmethod
    def normalize_finances(cls, payload: Dict[str, Any] | None, starting_cash: int | None = None) -> Dict[str, Any]:
        base = cls.default_finances(starting_cash)
        if not isinstance(payload, dict):
            return base
        merged = deepcopy(base)
        merged.update(payload)
        try:
            merged["cash_yen"] = int(merged.get("cash_yen", base["cash_yen"]))
        except (TypeError, ValueError):
            merged["cash_yen"] = base["cash_yen"]
        try:
            merged["opening_cash_yen"] = int(merged.get("opening_cash_yen", merged["cash_yen"]))
        except (TypeError, ValueError):
            merged["opening_cash_yen"] = merged["cash_yen"]
        ledger = merged.get("ledger")
        merged["ledger"] = [row for row in ledger if isinstance(row, dict)] if isinstance(ledger, list) else []
        merged["status"] = "active"
        merged["currency"] = "JPY"
        return merged

    @staticmethod
    def _tier(popularity: int, fans: int, x_followers: int) -> tuple[str, float]:
        score = float(popularity) + (fans / 2000.0) + (x_followers / 5000.0)
        if score >= 90:
            return "high", 3.0
        if score >= 45:
            return "mid", 1.8
        return "low", 1.0

    @classmethod
    def tokutenkai_idol_share(cls, revenue: int) -> int:
        """Return the idol payout from tokutenkai ticket gross."""
        try:
            revenue_int = int(revenue or 0)
        except (TypeError, ValueError):
            revenue_int = 0
        return int(max(0, revenue_int) * cls.TOKUTENKAI_IDOL_SHARE_RATE)

    @classmethod
    def estimate_venue_fee(
        cls,
        capacity: int | None,
        *,
        is_weekend_or_holiday: bool = False,
        booking_plan: str | None = "full_day",
    ) -> int:
        """Return modeled venue fee; supports weekday/weekend and plan-specific small-venue pricing."""
        if capacity is None:
            return 0
        try:
            capacity_int = int(capacity)
        except (TypeError, ValueError):
            return 0
        if 0 < capacity_int <= cls.SMALL_VENUE_CAPACITY_THRESHOLD:
            plan_key = str(booking_plan or "full_day").strip().lower()
            if plan_key in ("half_day_a", "half-a", "a", "halfday_a"):
                plan_key = "half_day_a"
            elif plan_key in ("half_day_b", "half-b", "b", "halfday_b"):
                plan_key = "half_day_b"
            else:
                plan_key = "full_day"

            # TwinBox anchors by plan:
            # - GARAGE (150 cap): weekday A/B/full = 77k/154k/187k, weekend-holiday = 132k/187k/297k
            # - AKIHABARA (200 cap): weekday A/B/full = 132k/187k/242k, weekend-holiday = 187k/242k/352k
            if is_weekend_or_holiday:
                anchors_150 = {"half_day_a": 132_000, "half_day_b": 187_000, "full_day": 297_000}
                anchors_200 = {"half_day_a": 187_000, "half_day_b": 242_000, "full_day": 352_000}
                fallback = cls.SMALL_VENUE_EVENT_FEE_WEEKEND_HOLIDAY
            else:
                anchors_150 = {"half_day_a": 77_000, "half_day_b": 154_000, "full_day": 187_000}
                anchors_200 = {"half_day_a": 132_000, "half_day_b": 187_000, "full_day": 242_000}
                fallback = cls.SMALL_VENUE_EVENT_FEE_WEEKDAY

            base_150 = int(anchors_150.get(plan_key, anchors_150["full_day"]))
            base_200 = int(anchors_200.get(plan_key, anchors_200["full_day"]))
            if capacity_int <= 0:
                return 0
            if capacity_int < 150:
                return int(max(0, base_150))
            if capacity_int > cls.SMALL_VENUE_CAPACITY_THRESHOLD:
                return int(max(0, fallback))

            # Linear interpolation / extrapolation from the two known anchors.
            slope = (base_200 - base_150) / 50.0
            interpolated = int(round(base_150 + (capacity_int - 150) * slope))
            return int(max(0, interpolated))
        return 0

    @staticmethod
    def _live_goods_price_and_piece_maps() -> tuple[Dict[str, int], Dict[str, float]]:
        prices_raw = _LIVE_GOODS_MODEL.get("average_price_yen_by_group_letter_tier") or {}
        pieces_raw = _LIVE_GOODS_MODEL.get("average_buying_pieces_by_group_letter_tier") or {}
        prices: Dict[str, int] = {}
        pieces: Dict[str, float] = {}
        if isinstance(prices_raw, dict):
            for key, val in prices_raw.items():
                kk = str(key).strip().upper()
                try:
                    prices[kk] = int(val)
                except (TypeError, ValueError):
                    continue
        if isinstance(pieces_raw, dict):
            for key, val in pieces_raw.items():
                kk = str(key).strip().upper()
                try:
                    pieces[kk] = float(val)
                except (TypeError, ValueError):
                    continue
        return prices, pieces

    @staticmethod
    def _normalize_group_letter_tier(group_letter_tier: str | None) -> str:
        t = str(group_letter_tier or "").strip().upper()
        if t in ("S", "A", "B", "C", "D", "E", "F"):
            return t
        return "F"

    @classmethod
    def live_goods_average_price_yen(cls, group_letter_tier: str | None) -> int:
        """Anchor price per piece from `group_finance.json` → `live_goods_model` (letter tier S..F)."""
        prices, _ = cls._live_goods_price_and_piece_maps()
        key = cls._normalize_group_letter_tier(group_letter_tier)
        return int(prices.get(key, prices.get("F", 1500)))

    @classmethod
    def live_goods_average_buying_pieces(cls, group_letter_tier: str | None, *, is_type_s_overlay: bool) -> float:
        """Pieces before × price; type **S** overlay adds `type_S_buying_pieces_add` from live_goods_model."""
        _, pieces_map = cls._live_goods_price_and_piece_maps()
        key = cls._normalize_group_letter_tier(group_letter_tier)
        base = float(pieces_map.get(key, pieces_map.get("F", 0.4)))
        if is_type_s_overlay:
            try:
                add = float(_LIVE_GOODS_MODEL.get("type_S_buying_pieces_add", 1))
            except (TypeError, ValueError):
                add = 1.0
            return base + add
        return base

    @classmethod
    def live_goods_host_type_offers_goods(cls, host_live_type_num: str | int | None) -> bool:
        """False for host types 4, 5, 7 (no in-show goods); see `group_finance.json` → `live_goods_model.no_goods_host_live_types`."""
        digits = "".join(ch for ch in str(host_live_type_num if host_live_type_num is not None else "7") if ch.isdigit())
        k = digits[:1] if digits else "7"
        if k not in ("1", "2", "3", "4", "5", "6", "7"):
            k = "7"
        raw = _LIVE_GOODS_MODEL.get("no_goods_host_live_types") or ("4", "5", "7")
        blocked = {str(x).strip() for x in raw} if isinstance(raw, (list, tuple, set)) else {"4", "5", "7"}
        return k not in blocked

    @classmethod
    def live_goods_effective_buyers(
        cls,
        host_live_type_num: str | int | None,
        *,
        group_fans: int,
        event_attendance: int | None = None,
        groups_on_bill: int | None = None,
    ) -> float:
        """
        Headcount factor for one show's goods gross (before × price × pieces).

        Host types **4, 5, 7** do not offer goods in this model → **0** buyers.
        Types **1, 2, 3, 6** use ``group_fans`` (``event_attendance`` / ``groups_on_bill`` are ignored for those).
        """
        digits = "".join(ch for ch in str(host_live_type_num if host_live_type_num is not None else "7") if ch.isdigit())
        k = digits[:1] if digits else "7"
        if k not in ("1", "2", "3", "4", "5", "6", "7"):
            k = "7"
        if not cls.live_goods_host_type_offers_goods(k):
            return 0.0
        try:
            gf = max(0, int(group_fans))
        except (TypeError, ValueError):
            gf = 0
        return float(gf)

    @classmethod
    def estimate_live_goods_gross_yen(
        cls,
        host_live_type_num: str | int | None,
        group_letter_tier: str | None,
        *,
        group_fans: int,
        event_attendance: int | None = None,
        groups_on_bill: int | None = None,
        is_type_s_overlay: bool = False,
    ) -> int:
        """One-show goods table gross from `live_goods_model` (see `group_finance.json`)."""
        buyers = cls.live_goods_effective_buyers(
            host_live_type_num,
            group_fans=group_fans,
            event_attendance=event_attendance,
            groups_on_bill=groups_on_bill,
        )
        price = cls.live_goods_average_price_yen(group_letter_tier)
        pcs = cls.live_goods_average_buying_pieces(group_letter_tier, is_type_s_overlay=is_type_s_overlay)
        gross = buyers * float(price) * pcs
        return max(0, int(math.floor(gross)))

    @classmethod
    def staff_count_for_group_letter_tier(cls, member_count: int, group_letter_tier: str | None) -> int:
        """
        Staff headcount ladder vs roster size `n` and **group letter tier** S..F.

        Rules from `group_finance.json` → `staff_count_by_group_letter_tier`:
        **n ≤ 20:** S ``3+n``; A ``n``; B ``round(0.8n)``; C ``n//2`` (at least 1);
        D ``max(3, n//3)``; E ``max(2, n//4)``; F ``max(2, n//5)``.
        **n > 20:** S ``round(10+0.2n)``; A ``round(8+0.2n)``; B ``round(4+0.2n)``;
        **C–F** use the same expressions as the **n ≤ 20** branch at the actual ``n``.
        """
        try:
            n = max(0, int(member_count))
        except (TypeError, ValueError):
            n = 0
        t = cls._normalize_group_letter_tier(group_letter_tier)
        try:
            small_max = int(_STAFF_COUNT_MODEL.get("small_roster_n_max_inclusive", 20))
        except (TypeError, ValueError):
            small_max = 20

        def _small_branch(tier: str, nn: int) -> int:
            if tier == "S":
                return 3 + nn
            if tier == "A":
                return nn
            if tier == "B":
                return int(round(nn * 0.8))
            if tier == "C":
                return max(1, nn // 2)
            if tier == "D":
                return max(3, nn // 3)
            if tier == "E":
                return max(2, nn // 4)
            if tier == "F":
                return max(2, nn // 5)
            return max(2, nn // 5)

        if n <= small_max:
            return _small_branch(t, n)
        if t == "S":
            return int(round(10 + n * 0.2))
        if t == "A":
            return int(round(8 + n * 0.2))
        if t == "B":
            return int(round(4 + n * 0.2))
        return _small_branch(t, n)

    @classmethod
    def estimated_monthly_commercial_net_to_group_yen(cls, group_letter_tier: str | None) -> int:
        """
        Illustrative **monthly** commercial income hitting the **group** entity (S/A/B only).

        Source: `group_finance.json` → `commercial_income_guess_letter_tier_s_through_b`
        → `estimated_group_net_commercial_yen_per_month`. Other letter tiers: **0**.
        """
        t = cls._normalize_group_letter_tier(group_letter_tier)
        if t not in ("S", "A", "B"):
            return 0
        block = _COMMERCIAL_INCOME_GUESS.get("estimated_group_net_commercial_yen_per_month")
        if not isinstance(block, dict):
            return 0
        raw = block.get(t)
        try:
            return max(0, int(raw))
        except (TypeError, ValueError):
            return 0

    @classmethod
    def base_salary_multiplier_for_group_letter_tier(cls, group_letter_tier: str | None) -> float:
        """Base salary multiplier by tier from `group_finance.json` → `member_compensation_by_letter_tier`."""
        t = cls._normalize_group_letter_tier(group_letter_tier)
        block = _MEMBER_COMPENSATION_MODEL.get("base_salary_multiplier_vs_default_monthly_base_salary")
        if not isinstance(block, dict):
            return 1.0
        raw = block.get(t, 1.0)
        try:
            return max(0.0, float(raw))
        except (TypeError, ValueError):
            return 1.0

    @classmethod
    def monthly_base_salary_yen_for_group_letter_tier(
        cls,
        group_letter_tier: str | None,
        *,
        default_monthly_base_salary_yen: int | None = None,
    ) -> int:
        """Monthly base salary anchor × tier multiplier (E=1/3, F=0 by policy)."""
        try:
            base = int(default_monthly_base_salary_yen) if default_monthly_base_salary_yen is not None else int(cls.AVERAGE_MONTHLY_BASE_SALARY)
        except (TypeError, ValueError):
            base = int(cls.AVERAGE_MONTHLY_BASE_SALARY)
        mult = cls.base_salary_multiplier_for_group_letter_tier(group_letter_tier)
        return max(0, int(round(base * mult)))

    @classmethod
    def tokutenkai_sales_bonus_rate_for_group_letter_tier(cls, group_letter_tier: str | None) -> float:
        """Tokutenkai sales bonus rate by tier (F=0.2 override) from shared compensation policy."""
        t = cls._normalize_group_letter_tier(group_letter_tier)
        block = _MEMBER_COMPENSATION_MODEL.get("tokutenkai_sales_bonus_rate_by_group_letter_tier")
        if not isinstance(block, dict):
            return float(cls.TOKUTENKAI_IDOL_SHARE_RATE)
        raw = block.get(t, cls.TOKUTENKAI_IDOL_SHARE_RATE)
        try:
            return max(0.0, float(raw))
        except (TypeError, ValueError):
            return float(cls.TOKUTENKAI_IDOL_SHARE_RATE)

    @classmethod
    def cd_sales_net_income_yen(cls, cd_units_sold: int) -> int:
        """
        Group **net** from **physical CD** units (digital / MV streaming excluded).

        Source: `group_finance.json` → `cd_sales_model.average_net_income_yen_per_cd_sold` (default ¥1,500/unit).
        """
        try:
            u = max(0, int(cd_units_sold))
        except (TypeError, ValueError):
            u = 0
        try:
            per = int(_CD_SALES_MODEL.get("average_net_income_yen_per_cd_sold", 1500))
        except (TypeError, ValueError):
            per = 1500
        return max(0, u * per)

    @classmethod
    def cd_online_signing_member_seconds(cls, cd_units_sold: int) -> int:
        """
        **Online signing** wall-clock for the **allocating member**: ``30 s × units`` (per `cd_sales_model`).

        Does not split time across members unless you extend the model.
        """
        try:
            u = max(0, int(cd_units_sold))
        except (TypeError, ValueError):
            u = 0
        ev = _CD_SALES_MODEL.get("online_signing_event") if isinstance(_CD_SALES_MODEL.get("online_signing_event"), dict) else {}
        try:
            sec = int(ev.get("seconds_per_cd_allocating_member", 30))
        except (TypeError, ValueError):
            sec = 30
        return max(0, u * max(0, sec))

    @classmethod
    def build_daily_breakdown(
        cls,
        *,
        target_date: date,
        member_count: int,
        popularity: int,
        fans: int,
        x_followers: int,
        monthly_salary_total: int,
        live_count: int = 0,
        tokutenkai_revenue: int = 0,
        tokutenkai_cost: int = 0,
        live_venue_fee_total: int = 0,
    ) -> Dict[str, int | str]:
        tier_name, tier_mult = cls._tier(popularity, fans, x_followers)

        digital_sales = int((2_500 + (fans * 0.10) + (x_followers * 0.02) + (popularity * 180)) * tier_mult)
        fan_meetings = int((1_800 + (fans * 0.08) + (popularity * 120)) * tier_mult)
        goods = int((1_500 + (fans * 0.12) + (member_count * 1_800)) * tier_mult)
        media = int((800 + (popularity * 90)) * max(0.8, tier_mult - 0.15))
        live_tickets = int(live_count * (25_000 + (fans * 0.22) + (member_count * 6_000)) * tier_mult)
        live_goods = int(live_count * (9_000 + (fans * 0.08) + (member_count * 2_000)) * tier_mult)

        staff = int(22_000 + (member_count * 7_500))
        office = int(12_000 + max(0, member_count - 4) * 1_800)
        promotion = int((7_500 + popularity * 140) * (1.0 if tier_name == "low" else 1.25 if tier_name == "mid" else 1.6))
        live_ops_cost = int(live_count * (18_000 + member_count * 4_500))
        live_venue_fee_total = max(0, int(live_venue_fee_total or 0))
        live_cost = live_ops_cost + live_venue_fee_total
        salaries = monthly_salary_total if target_date.day == 1 else 0

        tokutenkai_revenue = max(0, int(tokutenkai_revenue or 0))
        tokutenkai_cost = max(0, int(tokutenkai_cost or 0))
        tokutenkai_idol_share = cls.tokutenkai_idol_share(tokutenkai_revenue)

        income = digital_sales + fan_meetings + goods + media + live_tickets + live_goods + tokutenkai_revenue
        expense = staff + office + promotion + live_cost + salaries + tokutenkai_cost + tokutenkai_idol_share
        net = income - expense

        return {
            "date": target_date.isoformat(),
            "tier": tier_name,
            "income_total": income,
            "expense_total": expense,
            "net_total": net,
            "digital_sales": digital_sales,
            "fan_meetings": fan_meetings,
            "goods": goods,
            "media": media,
            "live_tickets": live_tickets,
            "live_goods": live_goods,
            "tokutenkai_revenue": tokutenkai_revenue,
            "staff": staff,
            "office": office,
            "promotion": promotion,
            "live_cost": live_cost,
            "live_ops_cost": live_ops_cost,
            "live_venue_fee": live_venue_fee_total,
            "tokutenkai_cost": tokutenkai_cost,
            "tokutenkai_idol_share": tokutenkai_idol_share,
            "salaries": salaries,
        }

    @classmethod
    def apply_daily_close(cls, finances: Dict[str, Any], breakdown: Dict[str, Any]) -> Dict[str, Any]:
        out = cls.normalize_finances(finances)
        out["cash_yen"] = int(out.get("cash_yen", 0)) + int(breakdown.get("net_total", 0))
        out["last_processed_date"] = breakdown.get("date")
        ledger = list(out.get("ledger", []))
        ledger.append(deepcopy(breakdown))
        if len(ledger) > cls.LEDGER_LIMIT:
            ledger = ledger[-cls.LEDGER_LIMIT :]
        out["ledger"] = ledger
        return out

    @staticmethod
    def iter_unprocessed_dates(last_processed_date: str | None, current_date: date, game_start_date: date) -> Iterable[date]:
        if current_date <= game_start_date:
            return []
        if last_processed_date:
            try:
                start = date.fromisoformat(str(last_processed_date)) + timedelta(days=1)
            except ValueError:
                start = game_start_date
        else:
            start = game_start_date
        end = current_date
        if start >= end:
            return []
        days: List[date] = []
        cursor = start
        while cursor < end:
            days.append(cursor)
            cursor += timedelta(days=1)
        return days
