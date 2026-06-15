"""
Idol Producer UI - Football Manager style interface for displaying idol profiles.

Creates an Outlook-style UI similar to Football Manager for viewing and managing idols.
"""

import tkinter as tk
from tkinter import ttk, font, messagebox, filedialog
from typing import Any, Optional, List
from datetime import date, timedelta
import calendar
import hashlib
import json
import copy
import sys
import os
import uuid

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from idol import Idol
from songs.song import Song
from sample_idols import (
    configure_data_sources,
    get_sample_idols,
    get_group_manager,
    get_active_data_sources,
    get_active_song_source,
    configure_data_snapshot,
)
from scenario_shared_attributes import (
    apply_shared_attributes_to_rows,
    load_shared_attribute_map,
    shared_attributes_path_for_idols_path,
)
from game_save import GameSave
from database.finance.finance_system import FinanceSystem
from festival_live_bridge import iter_festival_slots, load_festival_live_entries, load_festivals_data
from idol_status_system import (
    PHYSICAL_WEEKLY_MAINTENANCE_BLOCKS,
    TECHNICAL_WEEKLY_MAINTENANCE_BLOCKS,
    apply_daily_status_update,
    apply_weekly_attribute_maintenance,
    normalize_training_week_log,
    record_training_day,
    summarize_status,
    summarize_weekly_attribute_trend,
    training_bear_index,
)
from live_performance_system import apply_live_result_to_group, resolve_group_live_result
from scenario_runtime import (
    apply_due_future_events,
    build_filtered_snapshot_with_future_events,
    describe_applied_event,
)
from scout_system import (
    ScoutCompany,
    audition_candidate_to_idol,
    build_default_scout_companies,
    generate_audition_candidates,
    recommend_idols,
)
from .idol_ui import IdolUIMixin
from .group_ui import GroupUIMixin


class IdolProfileUI(IdolUIMixin, GroupUIMixin):
    """Main UI window for displaying idol profiles."""

    STARTUP_SCENARIO_PRESET = "test0"
    
    def __init__(self, root: tk.Tk, debug: bool = False, startup_group: Optional[str] = None, startup_view: Optional[str] = None, startup_date: Optional[str] = None):
        self.root = root
        self.root.title("Idol Producer")
        self.debug_mode = debug  # Store debug flag
        self._debug = debug  # Cache for faster access (avoid hasattr checks)
        self.startup_group = startup_group
        self.startup_view = startup_view or "Inbox"
        self.startup_date = startup_date
        self.player_name = ""
        self._startup_enabled = not any([startup_group, startup_view, startup_date])
        self._startup_game_started = False
        self._startup_screen = "home"
        self._startup_status = "Loading scenario data..."
        self._browse_mode = False
        self._startup_selected_group_uid = ""
        self._startup_group_rows: list[dict[str, Any]] = []
        self._startup_scenario = self._load_startup_scenario_preset()
        self._startup_scenario_date = self._parse_startup_date(
            self._startup_scenario.get("opening_date") if isinstance(self._startup_scenario, dict) else None
        )
        self.player_group = None
        self._is_closing = False
        self._pending_after_ids: set[str] = set()
        self.root.protocol("WM_DELETE_WINDOW", self.close_app)
        self.root.bind("<Escape>", lambda e: self.close_app())
        
        # Set a larger default size and make it start maximized or near-fullscreen
        try:
            screen_width = root.winfo_screenwidth()
            screen_height = root.winfo_screenheight()
        except:
            # Fallback if screen size can't be determined
            screen_width = 1920
            screen_height = 1080
        
        # Use 90% of screen size for a good default, or at least 1600x1000
        window_width = max(int(screen_width * 0.9), 1600)
        window_height = max(int(screen_height * 0.9), 1000)
        
        # Center the window on screen
        x = (screen_width - window_width) // 2
        y = (screen_height - window_height) // 2
        
        # Set geometry with position
        self.root.geometry(f"{window_width}x{window_height}+{x}+{y}")
        self.root.minsize(1200, 800)  # Increased minimum size
        
        # Ensure window is not minimized and is visible
        self.root.state('normal')
        self.root.deiconify()  # Show window if it was iconified
        
        # Make sure window is on top initially
        self.root.lift()
        self.root.focus_force()
        
        self.root.configure(bg='#1a1a2e')
        
        # Allow window to expand properly
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        
        # Current idol and view
        self.current_idol: Optional[Idol] = None
        self.current_view: str = "Inbox"  # Default landing view
        self.idols: List[Idol] = []  # Start with empty list, load asynchronously
        self.shortlisted_idols: List[Idol] = []
        self.group_manager = None
        self._data_loaded = False  # Flag to track if data is loaded
        self.current_date = self._parse_startup_date(startup_date) or date.today()
        self.game_start_date = self.current_date
        self.selected_calendar_date = self.current_date
        self.calendar_month_anchor = self.current_date.replace(day=1)
        self.calendar_view_mode = "week"
        self.selected_calendar_sources: set[str] = set()
        self.turn_number = 1
        self._daily_todos_cache: dict[str, list[dict]] = {}
        self._lives_cache = None
        self._venues_cache = None
        self._canonical_groups_cache: list[dict] | None = None
        self._canonical_songs_cache: list[dict] | None = None
        self._scenario_future_events: list[dict[str, Any]] = []
        self._pending_scenario_notifications: list[dict[str, Any]] = []
        self._scenario_runtime_dirty = False
        self._schedule_save_overrides: dict[str, list[dict]] = {}
        self._lives_tab = "new"
        self._new_live_form_state: dict[str, object] = {
            "live_type": "Concert",
            "title": "",
            "date": self.current_date.isoformat(),
            "start_time": "18:00",
            "end_time": "20:00",
            "rehearsal_start": "12:00",
            "rehearsal_end": "16:00",
            "venue_name": "",
            "setlist": [],
            "tokutenkai_enabled": False,
            "tokutenkai_start": "20:00",
            "tokutenkai_end": "20:00",
            "tokutenkai_ticket_price": 2000,
            "tokutenkai_slot_seconds": 40,
            "tokutenkai_expected_tickets": 0,
        }
        self._songs_view_state: dict[str, object] = {
            "group_uid": "",
            "tab": "group_songs",
            "song_uid": "",
            "disc_uid": "",
        }
        self._scout_companies: list[ScoutCompany] = build_default_scout_companies()
        self._scout_company_lookup: dict[str, ScoutCompany] = {company.uid: company for company in self._scout_companies}
        self._scout_state: dict[str, object] = {
            "selected_company_uid": self._scout_companies[0].uid if self._scout_companies else "",
            "auditions": {},
        }
        self._scout_tab = "freelancer"

        # Navigation history for back/forward buttons
        self.nav_history_back: List[dict] = []  # Stack for back navigation
        self.nav_history_forward: List[dict] = []  # Stack for forward navigation
        self._navigating = False  # Flag to prevent adding to history during navigation
        
        # Track bindings for cleanup
        self._idols_grid_container = None  # Track the grid container widget
        self._resize_after_id = None  # Debounce timer for resize events (week schedule)
        
        # Colors (Football Manager style)
        self.colors = {
            'bg_main': '#1a1a2e',
            'bg_sidebar': '#16213e',
            'bg_content': '#0f3460',
            'bg_card': '#16213e',
            'bg_card_dim': '#0d1a2e',  # Dimmed background for past members
            'text_primary': '#ffffff',
            'text_secondary': '#a0a0a0',
            'accent': '#533483',
            'accent_light': '#6a4c93',
            'accent_dark': '#3d2560',  # Darker accent for past members header
            'green': '#4caf50',
            'yellow': '#ffc107',
            'red': '#f44336',
            'border': '#2a2a3e'
        }

        self._game_save = GameSave(
            GameSave.path_test0(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        )
        self._game_save.ensure_exists()
        self._raw_game_save = self._read_raw_save()
        self._game_save_payload = GameSave.normalize_payload(self._raw_game_save)
        if not self._save_payload_matches_active_context(self._game_save_payload):
            self._raw_game_save = {}
            self._game_save_payload = GameSave.normalize_payload({})
        if self._startup_enabled:
            self._configure_startup_default_data_sources()
        else:
            self._configure_runtime_data_snapshot_from_payload(self._game_save_payload)
        self._schedule_save_overrides = GameSave.parse_schedules(self._game_save_payload)
        self._live_schedules: list[dict] = []
        self._live_results: list[dict] = []
        self._finances: dict = {}
        self._scenario_report: dict = {}
        self._idol_info_lookup: dict[str, dict] = {}
        # Per-idol training intensity 0–5 by category (not base stats; used for upcoming training resolution).
        self._training_intensity: dict[str, dict[str, int]] = {}
        self._training_week_log: dict[str, list[dict[str, Any]]] = {}
        # Per-idol focus skill (make-up, talking, model, host, variety, acting).
        self._training_focus_skill: dict[str, str] = {}
        self._notifications: list[dict[str, Any]] = []
        self._selected_notification_uid: str = ""

        self.setup_ui()
        
        # Save initial state to history
        self._save_current_state_to_history()
        
        # Show loading screen first
        if self._startup_enabled:
            self.show_startup_screen()
        else:
            self.show_loading_screen()
        
        # Load data asynchronously (no need to force updates)
        self.call_after(100, self.load_data_async)

    def _parse_startup_date(self, value: Optional[str]) -> Optional[date]:
        """Parse an ISO startup date if one was provided."""
        if not value:
            return None
        try:
            return date.fromisoformat(str(value).split("T")[0])
        except ValueError:
            return None

    def _load_startup_scenario_preset(self) -> dict:
        """Load the default new-game scenario preset."""
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        preset_path = os.path.join(repo_root, "database", "game_scenarios", f"{self.STARTUP_SCENARIO_PRESET}.json")
        try:
            with open(preset_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return {}
        return payload if isinstance(payload, dict) else {}

    def _configure_startup_default_data_sources(self) -> None:
        """Point the loader at the default new-game scenario before data finishes loading."""
        preset = self._startup_scenario if isinstance(self._startup_scenario, dict) else {}
        idols_rel = str(preset.get("idols_path") or "").strip()
        groups_rel = str(preset.get("groups_path") or "").strip()
        if not idols_rel or not groups_rel:
            return
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        idols_path = os.path.join(repo_root, idols_rel.replace("/", os.sep))
        groups_path = os.path.join(repo_root, groups_rel.replace("/", os.sep))
        songs_path = os.path.join(os.path.dirname(groups_path), "songs.json")
        configure_data_sources(
            idols_path=idols_path,
            groups_path=groups_path,
            songs_path=songs_path if os.path.exists(songs_path) else None,
            reload=True,
        )

    def _load_startup_group_tier_lookup(self) -> dict[str, str]:
        """Load scenario group tiers keyed by uid and loose name aliases."""
        preset = self._startup_scenario if isinstance(self._startup_scenario, dict) else {}
        scenario_dir_rel = str(preset.get("scenario_dir") or "").strip()
        if not scenario_dir_rel:
            return {}

        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        scenario_dir = os.path.join(repo_root, scenario_dir_rel.replace("/", os.sep))
        lookup: dict[str, str] = {}

        def _register(key_value: object, tier: object) -> None:
            key_text = str(key_value or "").strip()
            tier_text = str(tier or "").strip().upper()
            if not key_text or not tier_text:
                return
            lookup.setdefault(key_text, tier_text)
            lookup.setdefault(key_text.casefold(), tier_text)

        ranked_path = os.path.join(scenario_dir, "idol_group_rankings_2025_mapped.json")
        inferred_path = os.path.join(scenario_dir, "idol_group_inferred_ranks_not_in_list.json")

        try:
            with open(ranked_path, "r", encoding="utf-8") as handle:
                ranked_payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            ranked_payload = {}
        if isinstance(ranked_payload, dict):
            for tier_block in ranked_payload.get("rankings", []) or []:
                if not isinstance(tier_block, dict):
                    continue
                block_rank = str(tier_block.get("rank") or "").strip().upper()
                for row in tier_block.get("groups", []) or []:
                    if not isinstance(row, dict):
                        continue
                    tier = str(row.get("rank") or block_rank or "").strip().upper()
                    for value in (row.get("group_uid"), row.get("group_name"), row.get("group_name_romanji"), row.get("source_name")):
                        _register(value, tier)

        try:
            with open(inferred_path, "r", encoding="utf-8") as handle:
                inferred_payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            inferred_payload = {}
        if isinstance(inferred_payload, dict):
            for row in inferred_payload.get("groups", []) or []:
                if not isinstance(row, dict):
                    continue
                tier = str(row.get("inferred_rank") or "").strip().upper()
                for value in (row.get("group_uid"), row.get("group_name"), row.get("group_name_romanji")):
                    _register(value, tier)

        return lookup

    def _load_startup_group_report_lookup(self) -> dict[str, dict[str, Any]]:
        """Load Scenario 6 startup-eligible groups keyed by uid and loose aliases."""
        preset = self._startup_scenario if isinstance(self._startup_scenario, dict) else {}
        scenario_dir_rel = str(preset.get("scenario_dir") or "").strip()
        if not scenario_dir_rel:
            return {}

        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        report_path = os.path.join(
            repo_root,
            scenario_dir_rel.replace("/", os.sep),
            "full_groups_as_of_start_report.json",
        )
        try:
            with open(report_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError):
            return {}

        groups = payload.get("groups", []) if isinstance(payload, dict) else []
        if not isinstance(groups, list):
            return {}

        lookup: dict[str, dict[str, Any]] = {}

        def _register(key_value: object, row: dict[str, Any]) -> None:
            key_text = str(key_value or "").strip()
            if not key_text:
                return
            lookup.setdefault(key_text, row)
            lookup.setdefault(key_text.casefold(), row)

        for row in groups:
            if not isinstance(row, dict):
                continue
            for value in (row.get("uid"), row.get("name"), row.get("name_romanji")):
                _register(value, row)

        return lookup

    def _startup_group_override_policy(self, group) -> dict[str, Any]:
        """Return scenario-specific startup overrides for availability and tier."""
        group_uid = str(getattr(group, "uid", "") or "")
        group_name = str(getattr(group, "name", "") or "")
        group_name_romanji = str(getattr(group, "name_romanji", "") or "")
        keys = {group_uid, group_name, group_name_romanji, group_name.casefold(), group_name_romanji.casefold()}

        if keys.intersection({"ドレスコード", "Dress Code", "Dress_Code", "dress code", "dress_code", "RHJlc3NfQ29kZQ", "RHJlc3MgQ29kZQ", "d231b9f2-f247-4cf5-8d57-35365fd73f16"}):
            return {"tier": "E"}
        if keys.intersection({"IzJpMg", "#2i2", "2i2"}):
            return {"available": False}
        if keys.intersection({"aS1DT0w", "i-COL", "I-COL", "i-col", "i-col".casefold()}):
            return {"available": False}
        if keys.intersection({"TkVDUk9OT01JRE9M", "NECRONOMIDOL", "necronomidol"}):
            return {"available": False}
        return {}

    def _infer_startup_group_tier(self, group, report_row: Optional[dict[str, Any]]) -> str:
        """Infer a stable startup tier for groups not present in the curated rank list."""
        override = self._startup_group_override_policy(group)
        override_tier = str(override.get("tier") or "").strip().upper()
        if override_tier:
            return override_tier
        group_uid = str(getattr(group, "uid", "") or "")
        group_name = str(getattr(group, "name", "") or "")
        group_name_romanji = str(getattr(group, "name_romanji", "") or "")

        # Scenario-specific overrides for noisy source data.
        ion_aliases = {
            "d698eb6b-e82f-48f1-a2df-6cf858315ad4",
            "ion!",
            "iON!".casefold(),
        }
        if (
            group_uid in ion_aliases
            or group_name.casefold() in ion_aliases
            or group_name_romanji.casefold() in ion_aliases
        ):
            return "E"

        fans_value = None
        popularity_value = None
        debut_value = None
        if isinstance(report_row, dict):
            fans_value = report_row.get("fan_count")
            popularity_value = report_row.get("popularity")
            debut_value = report_row.get("debut_date")
        if fans_value in (None, ""):
            fans_value = getattr(group, "fans", None)
        if popularity_value in (None, ""):
            popularity_value = getattr(group, "popularity", None)
        if debut_value in (None, ""):
            debut_value = getattr(group, "formed_date", None)

        try:
            fans = int(fans_value) if fans_value not in (None, "") else 0
        except (TypeError, ValueError):
            fans = 0
        try:
            popularity = int(popularity_value) if popularity_value not in (None, "") else 0
        except (TypeError, ValueError):
            popularity = 0

        debut_date = self._parse_startup_date(debut_value)
        opening_date = self._startup_scenario_date
        if opening_date and debut_date and debut_date >= opening_date - timedelta(days=180):
            if fans >= 12000:
                return "B"
            if fans >= 5000:
                return "C"
            if fans >= 3000:
                return "D"
            if fans >= 500 or popularity > 0:
                return "E"
            return "F"

        if fans >= 150000:
            return "S"
        if fans >= 40000:
            return "A"
        if fans >= 12000:
            return "B"
        if fans >= 4000:
            return "C"
        if fans >= 1500:
            return "D"
        if fans >= 500 or popularity > 0:
            return "E"
        return "F"

    def call_after(self, delay_ms: int, callback):
        """Schedule a Tk callback and track it for shutdown cleanup."""
        if self._is_closing:
            return None

        after_id = None

        def wrapped():
            self._pending_after_ids.discard(after_id)
            if self._is_closing:
                return
            callback()

        after_id = self.root.after(delay_ms, wrapped)
        self._pending_after_ids.add(after_id)
        return after_id

    def close_app(self):
        """Close the application cleanly."""
        if self._is_closing:
            return

        self._persist_game_save()

        self._is_closing = True

        for after_id in list(self._pending_after_ids):
            try:
                self.root.after_cancel(after_id)
            except Exception:
                pass
        self._pending_after_ids.clear()

        try:
            self.root.unbind_all("<MouseWheel>")
            self.root.unbind_all("<Button-4>")
            self.root.unbind_all("<Button-5>")
        except Exception:
            pass

        try:
            self.root.quit()
        except Exception:
            pass

        try:
            self.root.destroy()
        except Exception:
            pass
    
    def bind_mousewheel(self, widget, canvas=None, include_children: bool = True):
        """
        Bind mouse wheel scrolling to a widget (canvas or frame).
        Works on Windows, Linux, and Mac.
        
        Args:
            widget: The widget to bind mouse wheel events to
            canvas: Optional canvas to scroll (if widget is a frame inside a canvas)
        """
        # Find the canvas to scroll
        target_canvas = canvas
        if target_canvas is None:
            # If widget is a canvas, use it directly
            if isinstance(widget, tk.Canvas):
                target_canvas = widget
            else:
                # Try to find parent canvas
                parent = widget.master
                while parent:
                    if isinstance(parent, tk.Canvas):
                        target_canvas = parent
                        break
                    try:
                        parent = parent.master
                    except:
                        break
        
        if target_canvas is None:
            return  # Can't find canvas to scroll

        def _canvas_can_scroll_y(target) -> bool:
            try:
                first, last = target.yview()
                return float(first) > 0.0 or float(last) < 1.0
            except Exception:
                return False

        def _on_mousewheel(event):
            # For Windows and Linux
            if hasattr(event, 'delta') and event.delta:
                delta = -1 * (event.delta / 120)  # Normalize to -1 or 1
            # For Mac
            elif hasattr(event, 'num'):
                if event.num == 4:
                    delta = -1
                elif event.num == 5:
                    delta = 1
                else:
                    return
            else:
                return
            
            # Scroll the canvas
            if target_canvas and hasattr(target_canvas, 'yview_scroll'):
                if not _canvas_can_scroll_y(target_canvas):
                    return
                target_canvas.yview_scroll(int(delta), "units")
        
        # Bind for Windows and Linux
        widget.bind("<MouseWheel>", _on_mousewheel)
        # Bind for Mac
        widget.bind("<Button-4>", _on_mousewheel)
        widget.bind("<Button-5>", _on_mousewheel)
        
        # Also bind to child widgets for better coverage
        def bind_to_children(parent):
            for child in parent.winfo_children():
                try:
                    # Only bind to widgets that can receive events (not all widget types support bind)
                    if isinstance(child, (tk.Frame, tk.Label, tk.Button, tk.Canvas, tk.Text, tk.Listbox)):
                        child.bind("<MouseWheel>", _on_mousewheel)
                        child.bind("<Button-4>", _on_mousewheel)
                        child.bind("<Button-5>", _on_mousewheel)
                        # Recursively bind to children
                        bind_to_children(child)
                except:
                    pass
        
        # Bind to all child widgets when this widget owns the whole scroll context.
        # For the main content frame we keep this off so nested scroll areas can
        # preserve their own wheel handlers.
        if include_children:
            bind_to_children(widget)
        
        # Store the binding function so we can re-apply it when new widgets are added
        if not hasattr(widget, '_mousewheel_bound'):
            widget._mousewheel_bound = True
            widget._mousewheel_handler = _on_mousewheel
    
    def setup_ui(self):
        """Set up the main UI components."""
        # Top bar
        self.create_top_bar()
        
        # Main container - must expand to fill available space
        main_container = tk.Frame(self.root, bg=self.colors['bg_main'])
        main_container.pack(fill=tk.BOTH, expand=True, padx=0, pady=0)
        
        # Configure main container to allow expansion
        main_container.columnconfigure(1, weight=1)
        main_container.rowconfigure(0, weight=1)
        
        # Left sidebar
        self.create_sidebar(main_container)
        
        # Right content area
        self.create_content_area(main_container)
    
    def create_top_bar(self):
        """Create the top navigation bar."""
        top_bar = tk.Frame(self.root, bg=self.colors['bg_sidebar'], height=60)
        top_bar.pack(fill=tk.X, side=tk.TOP)
        top_bar.pack_propagate(False)
        top_bar.columnconfigure(0, weight=1)
        top_bar.columnconfigure(1, weight=1)
        top_bar.columnconfigure(2, weight=1)
        
        # Navigation buttons frame
        nav_frame = tk.Frame(top_bar, bg=self.colors['bg_sidebar'])
        nav_frame.grid(row=0, column=0, sticky="w", padx=10, pady=10)

        self.home_menu = tk.Menu(self.root, tearoff=0)
        self.home_menu.add_command(label="Save game", command=self._menu_save_game)
        self.home_menu.add_command(label="Save As...", command=self._menu_save_game_as)
        self.home_menu.add_command(label="Load game", command=self._menu_load_game)
        self.home_menu.add_command(label="Main Menu", command=self._menu_main_menu)
        self.home_menu.add_separator()
        self.home_menu.add_command(label="Exit", command=self.close_app)
        
        # Home button (leftmost)
        home_btn = tk.Button(nav_frame, text="Home", bg=self.colors['accent'], 
                            fg=self.colors['text_primary'], relief=tk.FLAT,
                            padx=15, pady=10, font=('Arial', 10, 'bold'),
                            command=self._open_home_menu, cursor='hand2')
        home_btn.pack(side=tk.LEFT, padx=2)
        
        # Back button (triangle left)
        self.back_btn = tk.Button(nav_frame, text="<", bg=self.colors['bg_sidebar'],
                                  fg=self.colors['text_primary'], relief=tk.FLAT,
                                  padx=10, pady=10, font=('Arial', 12, 'bold'),
                                  command=self.navigate_back, state=tk.DISABLED,
                                  cursor='hand2')
        self.back_btn.pack(side=tk.LEFT, padx=2)
        self.back_btn.bind('<Enter>', lambda e: self.back_btn.config(bg=self.colors['accent']) if self.back_btn['state'] != 'disabled' else None)
        self.back_btn.bind('<Leave>', lambda e: self.back_btn.config(bg=self.colors['bg_sidebar']) if self.back_btn['state'] != 'disabled' else None)
        
        # Forward button (triangle right)
        self.forward_btn = tk.Button(nav_frame, text=">", bg=self.colors['bg_sidebar'],
                                    fg=self.colors['text_primary'], relief=tk.FLAT,
                                    padx=10, pady=10, font=('Arial', 12, 'bold'),
                                    command=self.navigate_forward, state=tk.DISABLED,
                                    cursor='hand2')
        self.forward_btn.pack(side=tk.LEFT, padx=2)
        self.forward_btn.bind('<Enter>', lambda e: self.forward_btn.config(bg=self.colors['accent']) if self.forward_btn['state'] != 'disabled' else None)
        self.forward_btn.bind('<Leave>', lambda e: self.forward_btn.config(bg=self.colors['bg_sidebar']) if self.forward_btn['state'] != 'disabled' else None)
        
        self.title_label = tk.Label(
            nav_frame,
            text="IDOL PRODUCER",
            bg=self.colors['bg_sidebar'],
            fg=self.colors['text_primary'],
            font=('Arial', 16, 'bold'),
            cursor='arrow',
        )
        self.title_label.pack(side=tk.LEFT, padx=(18, 0))
        self.title_label.bind('<Button-1>', lambda e: self._open_player_group_detail())
        self.title_label.bind('<Enter>', lambda e: self._update_title_hover_state(True))
        self.title_label.bind('<Leave>', lambda e: self._update_title_hover_state(False))

        self.date_button = tk.Button(
            top_bar,
            text="",
            bg=self.colors['bg_sidebar'],
            fg=self.colors['text_primary'],
            activebackground=self.colors['accent'],
            activeforeground=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=18,
            pady=8,
            font=('Arial', 11, 'bold'),
            command=lambda: self.switch_view("Schedule"),
            cursor='hand2',
        )
        self.date_button.grid(row=0, column=1)

        self.continue_btn = tk.Button(
            top_bar,
            text="NEXT DAY",
            bg=self.colors['green'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=20,
            pady=10,
            font=('Arial', 10, 'bold'),
            command=self._handle_primary_continue_action,
            cursor='hand2',
        )
        self.continue_btn.grid(row=0, column=2, sticky="e", padx=10, pady=10)

        self.refresh_date_display()
        self._update_continue_button()

    def _open_home_menu(self):
        """Open the Home popup menu from the Home button area."""
        if not hasattr(self, "home_menu"):
            return
        try:
            x = self.root.winfo_pointerx()
            y = self.root.winfo_pointery()
            self.home_menu.tk_popup(x, y)
        finally:
            try:
                self.home_menu.grab_release()
            except Exception:
                pass

    def _menu_save_game(self):
        """Write current state to the save file."""
        if not getattr(self, "_data_loaded", False):
            messagebox.showinfo("Save game", "Please wait until the database has finished loading.")
            return
        if not self._persist_game_save():
            messagebox.showerror("Save game", "Could not write the save file.")
            return
        messagebox.showinfo("Save game", f"Game saved to:\n{self._game_save.path}")

    def _menu_save_game_as(self):
        """Write current state to a user-selected save file and switch the active save path."""
        if not getattr(self, "_data_loaded", False):
            messagebox.showinfo("Save As", "Please wait until the database has finished loading.")
            return

        current_path = os.path.abspath(str(getattr(self._game_save, "path", "") or ""))
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        default_dir = os.path.dirname(current_path) if current_path else os.path.join(repo_root, "saves")
        default_name = os.path.basename(current_path) if current_path else "save1.save"
        selected_path = filedialog.asksaveasfilename(
            parent=self.root,
            title="Save As",
            initialdir=default_dir,
            initialfile=default_name,
            defaultextension=".save",
            filetypes=[
                ("Idol Producer saves", "*.save"),
                ("JSON files", "*.json"),
                ("All files", "*.*"),
            ],
        )
        if not selected_path:
            return
        if not self._persist_game_save_to_path(selected_path, make_active=True):
            messagebox.showerror("Save As", "Could not write the save file.")
            return
        messagebox.showinfo("Save As", f"Game saved to:\n{self._game_save.path}")

    def _prompt_for_game_save_path(self) -> str:
        """Open a save picker dialog and return the selected path."""
        current_path = os.path.abspath(str(getattr(self._game_save, "path", "") or ""))
        repo_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        return filedialog.askopenfilename(
            parent=self.root,
            title="Load Game",
            initialdir=os.path.dirname(current_path) if current_path else os.path.join(repo_root, "saves"),
            filetypes=[
                ("Idol Producer saves", "*.save"),
                ("JSON files", "*.json"),
                ("All files", "*.*"),
            ],
        )

    def _load_game_from_path(self, selected_path: str) -> bool:
        """Switch the active save file and reload the current game state."""
        if not selected_path:
            return False
        self._game_save = GameSave(selected_path)
        self._browse_mode = False
        self._startup_enabled = False
        self._startup_game_started = True
        self._apply_navigation_mode()
        self._set_startup_navigation_enabled(True)
        self._reload_game_from_save_file()
        self.switch_view(self.current_view or "Inbox", skip_history=True)
        return True

    def _menu_load_game(self):
        """Open a save picker and load the selected save file."""
        if not getattr(self, "_data_loaded", False):
            messagebox.showinfo("Load game", "Please wait until the database has finished loading.")
            return
        selected_path = self._prompt_for_game_save_path()
        if not selected_path:
            return
        if self._load_game_from_path(selected_path):
            messagebox.showinfo("Load game", f"Save file loaded:\n{self._game_save.path}")

    def _menu_main_menu(self):
        """Return to the startup launcher without closing the app."""
        self._startup_enabled = True
        self._startup_game_started = False
        self._startup_screen = "home"
        self._browse_mode = False
        self.show_startup_screen()

    def _reload_game_from_save_file(self):
        """Re-read saves/test0.save and apply group, shortlist, schedules, lives, finances."""
        self._browse_mode = False
        self._apply_navigation_mode()
        self._raw_game_save = self._read_raw_save()
        self._game_save_payload = GameSave.normalize_payload(self._raw_game_save)
        if not self._save_payload_matches_active_context(self._game_save_payload):
            self._raw_game_save = {}
            self._game_save_payload = GameSave.normalize_payload({})
        used_snapshot = self._configure_runtime_data_snapshot_from_payload(self._game_save_payload, reload=True)
        if used_snapshot:
            self.idols = get_sample_idols(reload=True)
            reference_date = None
            if self._game_save_payload.get("current_date"):
                try:
                    reference_date = date.fromisoformat(str(self._game_save_payload["current_date"]).split("T")[0])
                except ValueError:
                    reference_date = None
            self.group_manager = get_group_manager(reload=True, reference_date=reference_date)
        self._schedule_save_overrides = GameSave.parse_schedules(self._game_save_payload)
        self._daily_todos_cache.clear()
        self._apply_save_game_state(from_disk_reload=True)
        if self._scenario_runtime_dirty:
            self._persist_game_save()
            self._scenario_runtime_dirty = False
        self.switch_view(self.current_view, skip_history=True)
    
    def create_sidebar(self, parent):
        """Create the left sidebar navigation."""
        sidebar = tk.Frame(parent, bg=self.colors['bg_sidebar'], width=220)
        sidebar.pack(side=tk.LEFT, fill=tk.Y, padx=0, pady=0)
        sidebar.pack_propagate(False)

        self.sidebar = sidebar
        self.nav_buttons = {}
        self.nav_button_container = tk.Frame(sidebar, bg=self.colors['bg_sidebar'])
        self.nav_button_container.pack(fill=tk.X, padx=0, pady=0)
        self._render_sidebar_nav_buttons()
        
        # Shortlist panel
        list_frame = tk.Frame(sidebar, bg=self.colors['bg_sidebar'])
        list_frame.pack(fill=tk.BOTH, expand=True, padx=5, pady=10)
        
        tk.Label(list_frame, text="SHORTLIST", bg=self.colors['bg_sidebar'],
                fg=self.colors['text_secondary'], font=('Arial', 9, 'bold')).pack(anchor=tk.W, padx=10, pady=5)
        
        # Scrollable list
        listbox_frame = tk.Frame(list_frame, bg=self.colors['bg_sidebar'])
        listbox_frame.pack(fill=tk.BOTH, expand=True)
        
        scrollbar = tk.Scrollbar(listbox_frame)
        scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        
        self.idol_listbox = tk.Listbox(listbox_frame, bg=self.colors['bg_card'],
                                      fg=self.colors['text_primary'],
                                      selectbackground=self.colors['accent'],
                                      selectforeground=self.colors['text_primary'],
                                      yscrollcommand=scrollbar.set,
                                      font=('Arial', 9), relief=tk.FLAT,
                                      borderwidth=0, highlightthickness=0)
        self.idol_listbox.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        scrollbar.config(command=self.idol_listbox.yview)
        
        # Enable mouse wheel scrolling for listbox
        def _on_listbox_mousewheel(event):
            if hasattr(event, 'delta') and event.delta:
                delta = -1 * (event.delta / 120)
            elif hasattr(event, 'num'):
                if event.num == 4:
                    delta = -1
                elif event.num == 5:
                    delta = 1
                else:
                    return
            else:
                return
            self.idol_listbox.yview_scroll(int(delta), "units")
        
        self.idol_listbox.bind("<MouseWheel>", _on_listbox_mousewheel)
        self.idol_listbox.bind("<Button-4>", _on_listbox_mousewheel)
        self.idol_listbox.bind("<Button-5>", _on_listbox_mousewheel)
        
        self.idol_listbox.bind('<<ListboxSelect>>', self.on_idol_select)

        self.shortlist_empty_label = tk.Label(
            listbox_frame,
            text="No shortlisted idols yet.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 9),
            anchor=tk.CENTER,
            justify=tk.CENTER,
        )

        self.refresh_shortlist_sidebar()

    def _visible_nav_items(self) -> list[str]:
        """Return the navigation list for the current mode."""
        if self._browse_mode:
            return ["Idols", "Groups", "Songs"]
        return [
            "Inbox", "Idols", "Groups", "Training", "Schedule",
            "Lives", "Songs", "Making", "Publish", "Scout", "Company Info", "Finances"
        ]

    def _render_sidebar_nav_buttons(self) -> None:
        """Rebuild sidebar buttons for the current mode."""
        container = getattr(self, "nav_button_container", None)
        if container is None:
            return
        for widget in container.winfo_children():
            widget.destroy()
        self.nav_buttons = {}
        for item in self._visible_nav_items():
            btn = tk.Button(
                container,
                text=item,
                bg=self.colors['bg_sidebar'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                anchor=tk.W,
                padx=20,
                pady=12,
                font=('Arial', 10),
                command=lambda v=item: self.switch_view(v),
            )
            btn.pack(fill=tk.X, padx=5, pady=2)
            btn.bind('<Enter>', lambda e, b=btn: b.config(bg=self.colors['accent']))
            btn.bind('<Leave>', lambda e, b=btn: self.update_nav_button_color(b))
            self.nav_buttons[item] = btn

    def _apply_navigation_mode(self) -> None:
        """Refresh sidebar buttons and top-bar state for the active mode."""
        self._render_sidebar_nav_buttons()
        self._update_continue_button()
        if self._browse_mode:
            self._reset_title_bar_default()
        if hasattr(self, "date_button"):
            self.date_button.config(state=tk.DISABLED if self._browse_mode else tk.NORMAL)
        if hasattr(self, "continue_btn") and not self._browse_mode:
            self.continue_btn.config(state=tk.NORMAL)

    def refresh_shortlist_sidebar(self):
        """Refresh the shortlist listbox and empty state."""
        if not hasattr(self, "idol_listbox"):
            return

        self.idol_listbox.delete(0, tk.END)
        for idol in self.shortlisted_idols:
            self.idol_listbox.insert(tk.END, idol.name)

        if self.shortlisted_idols:
            if hasattr(self, "shortlist_empty_label") and self.shortlist_empty_label.winfo_ismapped():
                self.shortlist_empty_label.pack_forget()
        else:
            if hasattr(self, "shortlist_empty_label") and not self.shortlist_empty_label.winfo_ismapped():
                self.shortlist_empty_label.pack(expand=True, fill=tk.BOTH, padx=8, pady=8)

    def _set_player_group(self, group):
        """Set the producer's managed group and seed its members into the shortlist."""
        if not self._is_group_playable_start(group):
            if group:
                messagebox.showinfo(
                    "Managed Group",
                    f"{group.name or group.name_romanji} is treated as a sub-unit and cannot be selected as a playable managed group.",
                )
            return False
        self.player_group = group
        self._daily_todos_cache.clear()
        if not group:
            return True

        for idol in group.members:
            if getattr(idol, "condition", None) in (None, ""):
                idol.condition = 90
            idol.condition = max(0, min(100, int(getattr(idol, "condition", 90) or 90)))
            idol.morale = max(0, min(100, int(getattr(idol, "morale", 50) or 50)))
            if hasattr(idol, "_sync_legacy_status_fields"):
                idol._sync_legacy_status_fields()

        seen_uids = {idol.uid for idol in self.shortlisted_idols if getattr(idol, "uid", None)}
        for idol in group.members:
            if idol.uid not in seen_uids:
                self.shortlisted_idols.append(idol)
                seen_uids.add(idol.uid)

        self.refresh_shortlist_sidebar()
        self.selected_calendar_sources = {source["id"] for source in self._get_calendar_sources()}
        if hasattr(self, "title_label"):
            self.title_label.config(text=f"IDOL PRODUCER  |  {group.name or group.name_romanji}")
        self._update_title_hover_state(False)
        if getattr(self, "_data_loaded", False):
            self._ensure_finances_ready()
        return True

    def _is_group_playable_start(self, group) -> bool:
        """Return whether a group should be eligible as the managed playable group."""
        if group is None:
            return False

        group_uid = str(getattr(group, "uid", "") or "")
        group_name = str(getattr(group, "name", "") or "")
        group_name_romanji = str(getattr(group, "name_romanji", "") or "")
        description = str(getattr(group, "description", "") or "").lower()

        if group_uid == "UGlLaQ" or group_name == "PiKi" or group_name_romanji == "PiKi":
            return False

        # Keep obvious cross-group units out of playable starts.
        if "unit made up of" in description or "sub-unit" in description or "sub unit" in description:
            return False

        return True

    def _open_player_group_detail(self):
        """Open the managed group's detail page from the title bar."""
        if not self.player_group:
            return
        self.show_group_detail_page(self.player_group)

    def _update_title_hover_state(self, is_hovered: bool):
        """Show clickable styling only when a managed group is available."""
        if not hasattr(self, "title_label"):
            return

        if not self.player_group:
            self.title_label.config(
                fg=self.colors['text_primary'],
                cursor='arrow',
                font=('Arial', 16, 'bold'),
            )
            return

        self.title_label.config(
            fg=self.colors['yellow'] if is_hovered else self.colors['text_primary'],
            cursor='hand2',
            font=('Arial', 16, 'bold', 'underline') if is_hovered else ('Arial', 16, 'bold'),
        )

    def _get_calendar_sources(self) -> list[dict]:
        """Return the group calendar and each current member calendar."""
        if not self.player_group:
            return []

        sources = [
            {
                "id": "group",
                "label": self.player_group.name_romanji or self.player_group.name,
                "type": "group",
                "color": self.colors["accent"],
            }
        ]
        palette = [
            "#4caf50",
            "#ff9800",
            "#03a9f4",
            "#e91e63",
            "#9c27b0",
            "#ffc107",
            "#00bcd4",
            "#8bc34a",
        ]
        for index, idol in enumerate(self.player_group.members):
            sources.append(
                {
                    "id": f"idol:{idol.uid}",
                    "label": idol.name,
                    "type": "idol",
                    "color": self._get_member_calendar_color(idol, fallback_index=index),
                    "idol": idol,
                }
            )
        return sources

    def _get_member_calendar_color(self, idol: Idol, fallback_index: int = 0) -> str:
        """Use the member's group color when available, otherwise a stable generated color."""
        raw_color, _, _ = self._get_idol_group_info(idol, self.player_group.name if self.player_group else "")
        resolved = self._normalize_member_color(raw_color)
        if resolved:
            return resolved
        return self._generate_fallback_color(getattr(idol, "uid", "") or idol.name or str(fallback_index))

    def _normalize_member_color(self, raw_color: Optional[str]) -> Optional[str]:
        """Convert member_color text into a usable Tk color."""
        if not raw_color:
            return None

        color_text = str(raw_color).strip()
        if not color_text:
            return None

        if color_text.startswith("#") and len(color_text) in {4, 7}:
            return color_text

        lower = color_text.casefold()
        named_colors = [
            ("light blue", "#81d4fa"),
            ("sky blue", "#4fc3f7"),
            ("blue", "#42a5f5"),
            ("light green", "#9ccc65"),
            ("green", "#66bb6a"),
            ("yellow", "#ffd54f"),
            ("orange", "#ffb74d"),
            ("pink", "#f48fb1"),
            ("purple", "#ba68c8"),
            ("red", "#ef5350"),
            ("white", "#cfd8dc"),
            ("black", "#212121"),
        ]
        for name, hex_color in named_colors:
            if name in lower:
                return hex_color

        return None

    def _generate_fallback_color(self, seed: str) -> str:
        """Generate a stable bright fallback color from a seed."""
        digest = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        value = int(digest[:6], 16)
        r = 80 + (value & 0x3F)
        g = 80 + ((value >> 6) & 0x3F)
        b = 80 + ((value >> 12) & 0x3F)
        return f"#{r:02x}{g:02x}{b:02x}"

    def _get_calendar_source_map(self) -> dict[str, dict]:
        """Map source ids to their calendar metadata."""
        return {source["id"]: source for source in self._get_calendar_sources()}

    def _get_filtered_todos_for_date(self, target_date: date) -> list[dict]:
        """Return todos filtered by the selected calendars."""
        todos = self._get_todos_for_date(target_date)
        if not self.selected_calendar_sources:
            return todos
        return [todo for todo in todos if todo.get("source_id") in self.selected_calendar_sources]

    def _toggle_calendar_source(self, source_id: str):
        """Toggle a calendar source in the schedule screen."""
        if source_id in self.selected_calendar_sources:
            self.selected_calendar_sources.remove(source_id)
        else:
            self.selected_calendar_sources.add(source_id)
        self.show_schedule_view()

    def _set_calendar_view_mode(self, mode: str):
        """Switch the schedule display mode."""
        self.calendar_view_mode = mode
        self.show_schedule_view()

    def _get_week_dates(self, anchor_date: date) -> list[date]:
        """Return the Monday-starting week containing the given date."""
        week_start = anchor_date - timedelta(days=anchor_date.weekday())
        return [week_start + timedelta(days=offset) for offset in range(7)]

    def _time_to_hour(self, time_value: str) -> int:
        """Parse the hour component from HH:MM text."""
        try:
            return int(str(time_value).split(":", 1)[0])
        except (TypeError, ValueError):
            return 0

    def _parse_time_block(self, time_value: str) -> tuple[int, int]:
        """Parse a time or time range into minutes from midnight."""
        text = str(time_value or "").strip()
        if "-" in text:
            start_text, end_text = text.split("-", 1)
        else:
            start_text, end_text = text, None

        def _parse_minutes(chunk: Optional[str]) -> Optional[int]:
            if not chunk:
                return None
            try:
                hour_text, minute_text = chunk.strip().split(":", 1)
                return (int(hour_text) * 60) + int(minute_text)
            except (TypeError, ValueError):
                return None

        start_minutes = _parse_minutes(start_text)
        end_minutes = _parse_minutes(end_text)
        if start_minutes is None:
            return 0, 60
        if end_minutes is None or end_minutes <= start_minutes:
            end_minutes = start_minutes + 60
        return start_minutes, end_minutes

    def _load_lives_data(self) -> list[dict]:
        """Load lives data once for schedule generation."""
        if self._lives_cache is not None:
            return self._lives_cache

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        lives_path = os.path.join(base_dir, "database", "lives.json")
        try:
            with open(lives_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            self._lives_cache = []
            return self._lives_cache

        lives = payload.get("lives", []) if isinstance(payload, dict) else []
        canonical_lives = lives if isinstance(lives, list) else []
        self._lives_cache = canonical_lives + load_festival_live_entries()
        return self._lives_cache

    def _load_venues_data(self) -> list[dict]:
        """Load venue metadata once for the Lives planner."""
        if self._venues_cache is not None:
            return self._venues_cache

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        venues_path = os.path.join(base_dir, "database", "venues.json")
        try:
            with open(venues_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            self._venues_cache = []
            return self._venues_cache

        venues = payload.get("venues", []) if isinstance(payload, dict) else []
        self._venues_cache = venues if isinstance(venues, list) else []
        return self._venues_cache

    def _load_festivals_data(self) -> list[dict]:
        """Load canonical festival records once for festival browsing."""
        if getattr(self, "_festivals_cache", None) is not None:
            return self._festivals_cache
        self._festivals_cache = load_festivals_data()
        return self._festivals_cache

    def _load_canonical_groups_data(self) -> list[dict]:
        """Load the main groups database for richer fallback metadata."""
        if self._canonical_groups_cache is not None:
            return self._canonical_groups_cache

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        groups_path = os.path.join(base_dir, "database", "groups.json")
        try:
            with open(groups_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            self._canonical_groups_cache = []
            return self._canonical_groups_cache

        self._canonical_groups_cache = payload if isinstance(payload, list) else []
        return self._canonical_groups_cache

    def _load_canonical_songs_data(self) -> list[dict]:
        """Load the main songs database for richer fallback metadata."""
        if self._canonical_songs_cache is not None:
            return self._canonical_songs_cache

        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        songs_path = os.path.join(base_dir, "database", "songs.json")
        try:
            with open(songs_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except Exception:
            self._canonical_songs_cache = []
            return self._canonical_songs_cache

        self._canonical_songs_cache = payload if isinstance(payload, list) else []
        return self._canonical_songs_cache

    def _find_canonical_group_payload(self, group) -> Optional[dict]:
        """Find the matching group from the main database by uid/name."""
        candidates = {
            str(value).strip().casefold()
            for value in (
                getattr(group, "uid", None),
                getattr(group, "name", None),
                getattr(group, "name_romanji", None),
                getattr(group, "nickname", None),
                getattr(group, "nickname_romanji", None),
            )
            if str(value or "").strip()
        }
        if not candidates:
            return None

        for row in self._load_canonical_groups_data():
            if not isinstance(row, dict):
                continue
            row_candidates = {
                str(value).strip().casefold()
                for value in (
                    row.get("uid"),
                    row.get("name"),
                    row.get("name_romanji"),
                    row.get("nickname"),
                    row.get("nickname_romanji"),
                )
                if str(value or "").strip()
            }
            if candidates & row_candidates:
                return row
        return None

    def _find_canonical_song_payloads(self, group) -> list[dict]:
        """Find canonical songs for the matching group from the main songs database."""
        candidates = {
            str(value).strip().casefold()
            for value in (
                getattr(group, "uid", None),
                getattr(group, "name", None),
                getattr(group, "name_romanji", None),
                getattr(group, "nickname", None),
                getattr(group, "nickname_romanji", None),
            )
            if str(value or "").strip()
        }
        if not candidates:
            return []

        matches: list[dict] = []
        for row in self._load_canonical_songs_data():
            if not isinstance(row, dict):
                continue
            row_candidates = {
                str(value).strip().casefold()
                for value in (
                    row.get("group_uid"),
                    row.get("group_name"),
                )
                if str(value or "").strip()
            }
            if candidates & row_candidates:
                matches.append(row)
        return matches

    def _resolve_disc_track_entries(self, group, songs: list[Song], disc) -> list[tuple[str, Optional[Song]]]:
        """Return best-known track rows for a disc, inferring from linked songs when needed."""
        song_by_uid = {
            str(getattr(song_obj, "uid", "") or ""): song_obj
            for song_obj in songs
            if str(getattr(song_obj, "uid", "") or "")
        }

        explicit_entries: list[tuple[str, Optional[Song]]] = []
        track_song_uids = list(getattr(disc, "track_song_uids", None) or [])
        if track_song_uids:
            for song_uid in track_song_uids:
                song_obj = song_by_uid.get(str(song_uid or ""))
                if song_obj is not None:
                    explicit_entries.append(
                        (
                            str(getattr(song_obj, "title", "") or getattr(song_obj, "title_romanji", "") or "Untitled Song"),
                            song_obj,
                        )
                    )
            if explicit_entries:
                return explicit_entries

        raw_track_list = [str(track or "").strip() for track in list(getattr(disc, "track_list", None) or []) if str(track or "").strip()]
        if raw_track_list:
            resolved_entries: list[tuple[str, Optional[Song]]] = []
            for track_title in raw_track_list:
                normalized_track = track_title.casefold()
                matched_song = next(
                    (
                        song_obj
                        for song_obj in songs
                        if str(getattr(song_obj, "title", "") or getattr(song_obj, "title_romanji", "") or "").strip().casefold() == normalized_track
                    ),
                    None,
                )
                resolved_entries.append((track_title, matched_song))
            return resolved_entries

        disc_uid = str(getattr(disc, "uid", "") or "")
        disc_title = str(getattr(disc, "title", "") or "").strip().casefold()
        candidate_rows: list[tuple[tuple[bool, int, str, str], tuple[str, Optional[Song]]]] = []
        seen_song_uids: set[str] = set()
        for song_obj in songs:
            song_uid = str(getattr(song_obj, "uid", "") or "")
            if not song_uid or song_uid in seen_song_uids:
                continue
            matched_track_number: Optional[int] = None
            matched = False
            if disc_uid and str(getattr(song_obj, "disc_uid", "") or "") == disc_uid:
                matched = True
            for album_ref in list(getattr(song_obj, "albums", None) or []):
                if not isinstance(album_ref, dict):
                    continue
                album_disc_uid = str(album_ref.get("disc_uid") or "")
                album_name = str(album_ref.get("name") or "").strip().casefold()
                if (disc_uid and album_disc_uid == disc_uid) or (disc_title and album_name == disc_title):
                    matched = True
                    track_number = album_ref.get("track_number")
                    try:
                        matched_track_number = int(track_number) if track_number not in (None, "") else matched_track_number
                    except (TypeError, ValueError):
                        pass
                    break
            if not matched:
                continue
            seen_song_uids.add(song_uid)
            title = str(getattr(song_obj, "title", "") or getattr(song_obj, "title_romanji", "") or "Untitled Song")
            sort_key = (
                matched_track_number is None,
                matched_track_number if matched_track_number is not None else 9999,
                str(getattr(song_obj, "release_date", None) or ""),
                title.casefold(),
            )
            candidate_rows.append((sort_key, (title, song_obj)))

        candidate_rows.sort(key=lambda item: item[0])
        return [entry for _, entry in candidate_rows]

    def _get_live_type_presets(self) -> dict[str, dict[str, object]]:
        """Return editable default settings for each managed live type."""
        return {
            "Concert": {
                "event_type": "Concert",
                "default_start_time": "18:00",
                "default_duration": 120,
                "rehearsal_start": "12:00",
                "rehearsal_end": "16:00",
                "tokutenkai_enabled": False,
                "tokutenkai_duration": 90,
                "tokutenkai_ticket_price": 2000,
                "tokutenkai_slot_seconds": 40,
                "tokutenkai_expected_tickets": 0,
                "notes": "Default full-unit concert setup with a four-hour rehearsal block.",
            },
            "Routine": {
                "event_type": "Routine",
                "default_start_time": "18:00",
                "default_duration": 70,
                "rehearsal_start": "",
                "rehearsal_end": "",
                "tokutenkai_enabled": True,
                "tokutenkai_duration": 90,
                "tokutenkai_ticket_price": 2000,
                "tokutenkai_slot_seconds": 40,
                "tokutenkai_expected_tickets": 90,
                "notes": "Default regular one-man live with post-live tokutenkai / cheki sessions.",
            },
            "Taiban": {
                "event_type": "Taiban",
                "default_start_time": "17:00",
                "default_duration": 30,
                "rehearsal_start": "",
                "rehearsal_end": "",
                "tokutenkai_enabled": True,
                "tokutenkai_duration": 60,
                "tokutenkai_ticket_price": 2000,
                "tokutenkai_slot_seconds": 15,
                "tokutenkai_ticket_price_secondary": 3000,
                "tokutenkai_slot_seconds_secondary": 20,
                "tokutenkai_tier_split_primary": 0.5,
                "tokutenkai_expected_tickets": 48,
                "notes": "Shared-timeslot booking with post-live tokutenkai / cheki slots typical for taiban events.",
            },
            "Festival": {
                "event_type": "Festival",
                "default_start_time": "12:00",
                "default_duration": 30,
                "rehearsal_start": "",
                "rehearsal_end": "",
                "tokutenkai_enabled": False,
                "tokutenkai_duration": 0,
                "tokutenkai_ticket_price": 0,
                "tokutenkai_slot_seconds": 0,
                "tokutenkai_expected_tickets": 0,
                "notes": "Festival appearance with short set times and promoter-managed fan flow.",
            },
        }

    def _get_player_group_aliases(self) -> set[str]:
        """Return normalized aliases for the currently managed group."""
        if not self.player_group:
            return set()
        return {
            value.casefold()
            for value in [
                self.player_group.name,
                self.player_group.name_romanji,
                self.player_group.nickname,
                self.player_group.nickname_romanji,
            ]
            if value
        }

    def _festival_group_matches_player(self, row: dict, *, aliases: Optional[set[str]] = None) -> bool:
        """Return whether a festival appearance/slot row belongs to the managed group."""
        if not self.player_group:
            return False
        aliases = aliases or self._get_player_group_aliases()
        player_group_uid = str(getattr(self.player_group, "uid", "") or "")
        if str(row.get("group_uid") or "") == player_group_uid:
            return True
        for candidate in (row.get("name"), row.get("artist_name"), row.get("title")):
            text = str(candidate or "").strip()
            if text and text.casefold() in aliases:
                return True
        return False

    def _get_available_festival_rows(self) -> list[dict]:
        """Return future-or-current festival editions relevant to the current scenario date."""
        rows: list[dict] = []
        for row in self._load_festivals_data():
            if not isinstance(row, dict):
                continue
            try:
                end_date = date.fromisoformat(str(row.get("end_date") or "").split("T")[0])
            except ValueError:
                continue
            if end_date < self.current_date:
                continue
            rows.append(row)
        rows.sort(key=lambda item: (str(item.get("start_date") or ""), str(item.get("name_romanji") or item.get("name") or "")))
        return rows

    def _get_festival_historical_rows(self, festival_row: dict) -> list[dict]:
        """Return older editions in the same festival series, newest first."""
        series = str(festival_row.get("festival_series") or "").strip()
        if not series:
            return []
        matches: list[dict] = []
        for row in self._load_festivals_data():
            if not isinstance(row, dict):
                continue
            if str(row.get("festival_series") or "").strip() != series:
                continue
            matches.append(row)
        matches.sort(key=lambda item: (str(item.get("start_date") or ""), int(item.get("edition_number") or 0)), reverse=True)
        return matches

    def _parse_live_entry_date(self, live: dict) -> Optional[date]:
        """Parse a live dict's start date."""
        raw_date = live.get("start_date")
        try:
            return date.fromisoformat(str(raw_date).split("T")[0]) if raw_date else None
        except ValueError:
            return None

    def _get_group_song_pool_for_setlists(self, group, reference_date: Optional[date]) -> list[Song]:
        """Return released visible songs suitable for auto-generated setlists."""
        if group is None:
            return []
        songs = [song for song in list(getattr(group, "songs", []) or []) if not bool(getattr(song, "hidden", False))]
        canonical_rows = [
            row
            for row in self._find_canonical_song_payloads(group)
            if not bool(row.get("hidden", False))
        ]
        disc_uid_set = {
            str(getattr(disc, "uid", "") or "")
            for disc in list(getattr(group, "discography", []) or [])
            if str(getattr(disc, "uid", "") or "")
        }
        should_prefer_canonical = bool(canonical_rows) and (
            not songs
            or len(canonical_rows) > len(songs)
            or any(str(getattr(song, "uid", "") or "") in disc_uid_set for song in songs)
        )
        if should_prefer_canonical:
            songs = [
                Song.create_from_dict(row)
                for row in canonical_rows
            ]
        released = []
        for song in songs:
            release_date = getattr(song, "release_date", None)
            if release_date is not None and reference_date is not None and release_date > reference_date:
                continue
            released.append(song)
        if not released:
            released = list(songs)
        released.sort(
            key=lambda song: (
                not bool(getattr(song, "signature_song", False)),
                -(float(getattr(song, "popularity_global", 0.0) or 0.0)),
                -(float(getattr(song, "popularity_local", 0.0) or 0.0)),
                -(float(getattr(song, "popularity", 0.0) or 0.0)),
                getattr(song, "release_date", None) or date.min,
                str(getattr(song, "title", "") or "").casefold(),
            ),
            reverse=False,
        )
        return released

    def _build_default_live_setlist(self, live_type: str, *, live_date: Optional[date], group=None, seed_text: str = "") -> list[str]:
        """Build a deterministic default setlist from the managed group's released songs."""
        group = group or self.player_group
        if group is None:
            return []
        song_pool = self._get_group_song_pool_for_setlists(group, live_date)
        if not song_pool:
            return []

        desired_count_map = {
            "Festival": 3,
            "Taiban": 4,
            "Routine": 5,
            "Concert": 7,
        }
        live_type_key = str(live_type or "Routine")
        desired_count = min(len(song_pool), desired_count_map.get(live_type_key, 5))
        if desired_count <= 0:
            return []

        seed = f"{getattr(group, 'uid', '')}|{live_type_key}|{live_date.isoformat() if live_date else ''}|{seed_text}"
        if len(song_pool) <= desired_count:
            selected = song_pool
        else:
            start_index = int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8], 16) % len(song_pool)
            rotated = song_pool[start_index:] + song_pool[:start_index]
            selected = rotated[:desired_count]

        seen: set[str] = set()
        titles: list[str] = []
        for song in selected:
            title = str(getattr(song, "title", "") or "").strip()
            if not title or title in seen:
                continue
            seen.add(title)
            titles.append(title)
        return titles

    def _normalize_live_entry(self, live: object) -> Optional[dict]:
        """Normalize a mutable live entry stored in save data."""
        if not isinstance(live, dict):
            return None

        live_type = str(live.get("live_type") or live.get("event_type") or "Routine")
        legacy_type_map = {
            "Full Live": "Concert",
            "Routine Live": "Routine",
            "Taiban Live": "Taiban",
        }
        live_type = legacy_type_map.get(live_type, live_type)
        preset = self._get_live_type_presets().get(live_type, self._get_live_type_presets()["Routine"])
        raw_groups = live.get("group") or []
        if isinstance(raw_groups, str):
            raw_groups = [raw_groups]

        duration = live.get("duration")
        try:
            duration = int(duration) if duration is not None else int(preset["default_duration"])
        except (TypeError, ValueError):
            duration = int(preset["default_duration"])

        normalized = {
            "uid": str(live.get("uid") or ""),
            "title": str(live.get("title") or ""),
            "title_romanji": str(live.get("title_romanji") or ""),
            "event_type": str(live.get("event_type") or preset["event_type"]),
            "live_type": live_type,
            "start_date": str(live.get("start_date") or ""),
            "end_date": str(live.get("end_date") or live.get("start_date") or ""),
            "start_time": str(live.get("start_time") or preset["default_start_time"]),
            "end_time": str(live.get("end_time") or ""),
            "duration": duration,
            "rehearsal_start": str(live.get("rehearsal_start") or preset["rehearsal_start"]),
            "rehearsal_end": str(live.get("rehearsal_end") or preset["rehearsal_end"]),
            "venue": live.get("venue"),
            "venue_uid": live.get("venue_uid"),
            "location": str(live.get("location") or ""),
            "description": str(live.get("description") or ""),
            "setlist": [str(song) for song in (live.get("setlist") or []) if song],
            "group": [str(name) for name in raw_groups if name],
            "group_uid": str(live.get("group_uid") or ""),
            "capacity": live.get("capacity"),
            "status": str(live.get("status") or "scheduled"),
            "attendance": live.get("attendance"),
            "ticket_price": live.get("ticket_price"),
            "performance_score": live.get("performance_score"),
            "audience_satisfaction": live.get("audience_satisfaction"),
            "expectation_score": live.get("expectation_score"),
            "novelty_score": live.get("novelty_score"),
            "broadcast_exposure": live.get("broadcast_exposure"),
            "exposure_count": live.get("exposure_count"),
            "tokutenkai_actual_tickets": live.get("tokutenkai_actual_tickets"),
            "fan_gain": live.get("fan_gain"),
            "popularity_gain": live.get("popularity_gain"),
            "recent_song_count": live.get("recent_song_count"),
            "recent_disc_count": live.get("recent_disc_count"),
            "setlist_fresh_count": live.get("setlist_fresh_count"),
            "costume_refresh_bonus": live.get("costume_refresh_bonus"),
            "member_scores": [dict(item) for item in (live.get("member_scores") or []) if isinstance(item, dict)],
            "member_deltas": [dict(item) for item in (live.get("member_deltas") or []) if isinstance(item, dict)],
            "report_generated_same_day": bool(live.get("report_generated_same_day", False)),
            "tokutenkai_enabled": bool(live.get("tokutenkai_enabled", preset.get("tokutenkai_enabled", False))),
            "tokutenkai_start": str(live.get("tokutenkai_start") or ""),
            "tokutenkai_end": str(live.get("tokutenkai_end") or ""),
            "tokutenkai_duration": int(live.get("tokutenkai_duration") or preset.get("tokutenkai_duration", 0) or 0),
            "tokutenkai_ticket_price": int(live.get("tokutenkai_ticket_price") or preset.get("tokutenkai_ticket_price", 2000) or 2000),
            "tokutenkai_slot_seconds": int(live.get("tokutenkai_slot_seconds") or preset.get("tokutenkai_slot_seconds", 40) or 40),
            "tokutenkai_expected_tickets": int(live.get("tokutenkai_expected_tickets") or preset.get("tokutenkai_expected_tickets", 0) or 0),
        }
        if not normalized["setlist"]:
            normalized["setlist"] = self._build_default_live_setlist(
                live_type,
                live_date=self._parse_live_entry_date(normalized),
                seed_text="|".join(
                    [
                        normalized.get("uid", ""),
                        normalized.get("title", ""),
                        normalized.get("venue") or "",
                    ]
                ),
            )
        if live_type == "Taiban":
            tp_taiban = self._get_live_type_presets().get("Taiban", {})
            normalized["tokutenkai_duration"] = int(tp_taiban.get("tokutenkai_duration", 60))
            normalized["tokutenkai_ticket_price"] = int(tp_taiban.get("tokutenkai_ticket_price", 2000))
            normalized["tokutenkai_slot_seconds"] = int(tp_taiban.get("tokutenkai_slot_seconds", 15))
            normalized["tokutenkai_ticket_price_secondary"] = int(tp_taiban.get("tokutenkai_ticket_price_secondary", 3000))
            normalized["tokutenkai_slot_seconds_secondary"] = int(tp_taiban.get("tokutenkai_slot_seconds_secondary", 20))
            try:
                normalized["tokutenkai_tier_split_primary"] = float(tp_taiban.get("tokutenkai_tier_split_primary", 0.5))
            except (TypeError, ValueError):
                normalized["tokutenkai_tier_split_primary"] = 0.5
        if not normalized["uid"]:
            normalized["uid"] = hashlib.sha256(
                f"{normalized['title']}|{normalized['start_date']}|{normalized['venue']}".encode("utf-8")
            ).hexdigest()[:16]
        if not normalized["end_time"]:
            normalized["end_time"] = self._compute_live_end_time(normalized["start_time"], normalized["duration"])
        if normalized["tokutenkai_enabled"]:
            if not normalized["tokutenkai_start"]:
                normalized["tokutenkai_start"] = normalized["end_time"]
            if not normalized["tokutenkai_end"]:
                normalized["tokutenkai_end"] = self._compute_end_time_from_duration(
                    normalized["tokutenkai_start"],
                    normalized["tokutenkai_duration"],
                )
        if live_type == "Taiban" and normalized["tokutenkai_enabled"]:
            start_tk = normalized["tokutenkai_start"] or normalized["end_time"]
            normalized["tokutenkai_end"] = self._compute_end_time_from_duration(
                start_tk, normalized["tokutenkai_duration"]
            )
        return normalized

    def _format_live_scheduling_notification(self, live: dict) -> str:
        """Build inbox text for a newly scheduled live."""
        when = f"{live.get('start_date') or 'TBD'} {self._format_live_slot(live)}".strip()
        venue = str(live.get("venue") or live.get("location") or "TBA").strip()
        live_type = str(live.get("live_type") or live.get("event_type") or "Live")
        setlist = [str(title) for title in (live.get("setlist") or []) if str(title).strip()]
        body = f"{live_type} booked for {when} at {venue}."
        if setlist:
            body += f" Setlist: {', '.join(setlist[:6])}."
        else:
            body += " Setlist will need review."
        return body

    def _add_live_scheduled_notification(self, live: dict, *, scheduled_on: Optional[date] = None) -> None:
        """Create an inbox item for one newly scheduled live."""
        normalized = self._normalize_live_entry(live)
        if not normalized:
            return
        title = str(normalized.get("title") or normalized.get("live_type") or "Live")
        notify_date = scheduled_on or self.current_date
        self._add_notification(
            f"Scheduled live: {title}",
            self._format_live_scheduling_notification(normalized),
            sender="Operations",
            category="schedule",
            level="normal",
            date_value=notify_date,
            dedupe_key=f"live-scheduled|{str(normalized.get('uid') or '')}|{notify_date.isoformat()}",
        )

    def _append_scheduled_live(self, live: dict, *, notify: bool = True, scheduled_on: Optional[date] = None) -> Optional[dict]:
        """Normalize, dedupe, and append one scheduled live to the save-backed schedule."""
        normalized = self._normalize_live_entry(live)
        if not normalized:
            return None
        live_uid = str(normalized.get("uid") or "")
        if live_uid and any(str((self._normalize_live_entry(existing) or {}).get("uid") or "") == live_uid for existing in self._live_schedules):
            return None
        self._live_schedules.append(normalized)
        self._daily_todos_cache.clear()
        if notify:
            self._add_live_scheduled_notification(normalized, scheduled_on=scheduled_on)
        return normalized

    def _seed_opening_live_schedule(self) -> int:
        """Copy the first four weeks of managed-group lives into the new save."""
        if not self.player_group:
            return 0
        added = 0
        aliases = self._get_player_group_aliases()
        player_group_uid = str(getattr(self.player_group, "uid", "") or "")
        horizon = self.current_date + timedelta(days=28)

        for raw_live in self._load_lives_data():
            if not isinstance(raw_live, dict):
                continue
            raw_groups = raw_live.get("group") or []
            if isinstance(raw_groups, str):
                raw_groups = [raw_groups]
            normalized_groups = {str(name).casefold() for name in raw_groups if name}
            if not aliases.intersection(normalized_groups) and str(raw_live.get("group_uid") or "") != player_group_uid:
                continue
            live_date = self._parse_live_entry_date(raw_live)
            if live_date is None or live_date < self.current_date or live_date > horizon:
                continue
            if str(raw_live.get("status") or "") == "played":
                continue
            if self._append_scheduled_live(dict(raw_live), notify=True, scheduled_on=self.current_date):
                added += 1

        added += self._generate_fallback_opening_lives(horizon=horizon)
        return added

    def _estimate_startup_live_target_count(self) -> int:
        """Return how many booked lives a fresh save should roughly open with."""
        tier = str(getattr(self.player_group, "tier", "") or "").upper()
        if tier in {"S", "A"}:
            return 8
        if tier in {"B", "C"}:
            return 6
        if tier in {"D", "E"}:
            return 4
        return 3

    def _pick_startup_live_venue(self, desired_capacity: int) -> tuple[str, Optional[str], str, Optional[int]]:
        """Pick a venue close to the desired attendance scale."""
        venues = self._load_venues_data()
        candidates = [row for row in venues if isinstance(row, dict) and row.get("name") and row.get("capacity")]
        if not candidates:
            return "TBA venue", None, "", None
        candidates.sort(key=lambda row: abs(int(row.get("capacity") or 0) - desired_capacity))
        venue = candidates[0]
        return (
            str(venue.get("name") or "TBA venue"),
            venue.get("uid"),
            str(venue.get("location") or ""),
            int(venue.get("capacity") or 0) or None,
        )

    def _build_fallback_startup_live(self, live_date: date, live_type: str, index: int) -> dict[str, Any]:
        """Create one generated opening-period live."""
        group_name = str(getattr(self.player_group, "name", "") or getattr(self.player_group, "name_romanji", "") or "Managed Group")
        group_names = [value for value in [getattr(self.player_group, "name", ""), getattr(self.player_group, "name_romanji", "")] if value]
        presets = self._get_live_type_presets()
        preset = presets.get(live_type, presets["Routine"])
        fans = max(0, int(getattr(self.player_group, "fans", 0) or 0))
        desired_capacity = max(120, min(2400, int(max(fans, 800) * 0.2)))
        venue_name, venue_uid, location, capacity = self._pick_startup_live_venue(desired_capacity)
        start_time = str(preset["default_start_time"])
        duration = int(preset["default_duration"])
        end_time = self._compute_live_end_time(start_time, duration)
        rehearsal_start = str(preset.get("rehearsal_start") or "")
        rehearsal_end = str(preset.get("rehearsal_end") or "")
        seed_text = f"{group_name}|{live_type}|{live_date.isoformat()}|{index}"
        if live_type == "Taiban":
            title = f"{group_name} Circuit Live"
        elif live_type == "Concert":
            title = f"{group_name} One-Man Live"
        else:
            title = f"{group_name} Regular Live"
        live_uid = hashlib.sha256(seed_text.encode("utf-8")).hexdigest()[:16]
        return {
            "uid": live_uid,
            "title": title,
            "title_romanji": "",
            "event_type": preset["event_type"],
            "live_type": live_type,
            "start_date": live_date.isoformat(),
            "end_date": live_date.isoformat(),
            "start_time": start_time,
            "end_time": end_time,
            "duration": duration,
            "rehearsal_start": rehearsal_start,
            "rehearsal_end": rehearsal_end,
            "venue": venue_name,
            "venue_uid": venue_uid,
            "location": location,
            "description": f"Opening-period auto-booked {live_type.lower()} for {group_name}.",
            "performance_count": 1,
            "capacity": capacity,
            "attendance": None,
            "ticket_price": None,
            "poster_image_path": None,
            "setlist": self._build_default_live_setlist(live_type, live_date=live_date, group=self.player_group, seed_text=seed_text),
            "tokutenkai_enabled": bool(preset.get("tokutenkai_enabled")),
            "tokutenkai_start": self._compute_live_end_time(start_time, duration) if bool(preset.get("tokutenkai_enabled")) else "",
            "tokutenkai_end": self._compute_end_time_from_duration(
                self._compute_live_end_time(start_time, duration),
                preset.get("tokutenkai_duration", 0) or 0,
            ) if bool(preset.get("tokutenkai_enabled")) else "",
            "tokutenkai_duration": int(preset.get("tokutenkai_duration", 0) or 0),
            "tokutenkai_ticket_price": int(preset.get("tokutenkai_ticket_price", 0) or 0),
            "tokutenkai_slot_seconds": int(preset.get("tokutenkai_slot_seconds", 0) or 0),
            "tokutenkai_expected_tickets": int(preset.get("tokutenkai_expected_tickets", 0) or 0),
            "group": group_names or [group_name],
            "group_uid": str(getattr(self.player_group, "uid", "") or ""),
            "status": "scheduled",
        }

    def _generate_fallback_opening_lives(self, *, horizon: date) -> int:
        """Generate a starter schedule when the imported calendar is too sparse."""
        if not self.player_group:
            return 0
        target_count = self._estimate_startup_live_target_count()
        existing = self._get_saved_managed_group_lives()
        if len(existing) >= target_count:
            return 0

        taken_dates = {
            live_date
            for live in existing
            for live_date in [self._parse_live_entry_date(live)]
            if live_date is not None
        }
        candidates: list[date] = []
        walk = self.current_date
        while walk <= horizon:
            if walk not in taken_dates and walk.weekday() in {2, 4, 5, 6}:
                candidates.append(walk)
            walk += timedelta(days=1)

        tier = str(getattr(self.player_group, "tier", "") or "").upper()
        if tier in {"S", "A"}:
            default_type = "Taiban"
        elif tier in {"B", "C"}:
            default_type = "Routine"
        else:
            default_type = "Routine"

        added = 0
        needed = max(0, target_count - len(existing))
        for index, live_date in enumerate(candidates[:needed]):
            live_type = default_type
            if default_type == "Routine" and live_date.weekday() in {5, 6} and tier in {"A", "B", "C"}:
                live_type = "Taiban"
            live = self._build_fallback_startup_live(live_date, live_type, index)
            if self._append_scheduled_live(live, notify=True, scheduled_on=self.current_date):
                added += 1
        return added

    def _get_saved_managed_group_live_results(self) -> list[dict]:
        """Return played save-backed live result entries that belong to the managed group."""
        aliases = self._get_player_group_aliases()
        player_group_uid = str(getattr(self.player_group, "uid", "") or "")
        if not aliases:
            return []

        matches: list[dict] = []
        for raw_live in self._live_results:
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            normalized = {str(name).casefold() for name in live.get("group", []) if name}
            if aliases.intersection(normalized) or str(live.get("group_uid") or "") == player_group_uid:
                matches.append(live)
        return matches

    def _get_saved_managed_group_lives(self) -> list[dict]:
        """Return save-backed live entries that belong to the managed group."""
        aliases = self._get_player_group_aliases()
        player_group_uid = str(getattr(self.player_group, "uid", "") or "")
        if not aliases:
            return []

        matches: list[dict] = []
        for raw_live in self._live_schedules:
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            normalized = {str(name).casefold() for name in live.get("group", []) if name}
            if aliases.intersection(normalized) or str(live.get("group_uid") or "") == player_group_uid:
                matches.append(live)
        return matches

    def _minutes_to_hhmm(self, total_minutes: int) -> str:
        """Convert minutes from midnight into HH:MM text."""
        hours = max(0, total_minutes) // 60
        minutes = max(0, total_minutes) % 60
        return f"{hours:02d}:{minutes:02d}"

    def _compute_live_end_time(self, start_time: str, duration: object) -> str:
        """Return an HH:MM end time based on start + duration."""
        start_minutes, end_minutes = self._parse_time_block(start_time)
        if "-" in str(start_time or ""):
            return self._minutes_to_hhmm(end_minutes)
        try:
            duration_minutes = max(1, int(duration))
        except (TypeError, ValueError):
            duration_minutes = 60
        return self._minutes_to_hhmm(start_minutes + duration_minutes)

    def _compute_time_duration_text(self, start_time: str, end_time: str) -> str:
        """Return a human-readable duration between two HH:MM times."""
        start_minutes, _ = self._parse_time_block(start_time)
        end_minutes, _ = self._parse_time_block(end_time)
        if end_minutes <= start_minutes:
            return "Invalid"
        total = end_minutes - start_minutes
        hours = total // 60
        minutes = total % 60
        if hours and minutes:
            return f"{hours}h {minutes}m"
        if hours:
            return f"{hours}h"
        return f"{minutes}m"

    def _compute_end_time_from_duration(self, start_time: str, duration_minutes: object) -> str:
        """Return an HH:MM string from a start time plus duration minutes."""
        start_minutes, _ = self._parse_time_block(start_time)
        try:
            total_duration = max(0, int(duration_minutes))
        except (TypeError, ValueError):
            total_duration = 0
        return self._minutes_to_hhmm(start_minutes + total_duration)

    def _calculate_tokutenkai_max_tickets(
        self,
        start_time: str,
        end_time: str,
        slot_seconds: object,
        member_count: int | None = None,
        *,
        secondary_slot_seconds: object | None = None,
        tier_split_primary: float | None = None,
    ) -> int:
        """Return the max tokutenkai ticket volume the member line can cover.

        When ``secondary_slot_seconds`` and ``tier_split_primary`` are set (taiban dual-tier),
        capacity assumes two ticket classes per member: ``tier_split_primary`` of tickets use
        ``slot_seconds`` and the remainder use ``secondary_slot_seconds``. For an even 50/50
        split this is ``n`` slots at each length with ``n * (s1 + s2) <=`` window seconds.
        """
        start_minutes, _ = self._parse_time_block(start_time)
        end_minutes, _ = self._parse_time_block(end_time)
        if end_minutes <= start_minutes:
            return 0
        try:
            slot_length = max(1, int(slot_seconds))
        except (TypeError, ValueError):
            slot_length = 40
        if member_count is None:
            member_count = len(getattr(self.player_group, "members", []) or [])
        window_seconds = (end_minutes - start_minutes) * 60
        members = max(0, member_count)
        if secondary_slot_seconds is not None and tier_split_primary is not None:
            try:
                s2 = max(1, int(secondary_slot_seconds))
            except (TypeError, ValueError):
                s2 = 20
            try:
                w = float(tier_split_primary)
            except (TypeError, ValueError):
                w = 0.5
            w = min(1.0, max(0.0, w))
            if abs(w - 0.5) < 1e-9:
                pair_seconds = slot_length + s2
                n_each = window_seconds // pair_seconds
                return max(0, 2 * n_each * members)
            t1 = int(window_seconds * w) // slot_length
            t2 = int(window_seconds * (1.0 - w)) // s2
            return max(0, (t1 + t2) * members)
        total_slots_per_member = window_seconds // slot_length
        return max(0, total_slots_per_member * members)

    def _tokutenkai_taiban_dual_kwargs(self, live: dict) -> dict[str, object]:
        """Keyword args for dual-tier taiban max-ticket math, or empty dict when not applicable."""
        live_type = str(live.get("live_type") or live.get("event_type") or "")
        if live_type in {"Taiban Live"}:
            live_type = "Taiban"
        if live_type != "Taiban":
            return {}
        preset = self._get_live_type_presets().get("Taiban", {})
        sec = live.get("tokutenkai_slot_seconds_secondary")
        if sec is None:
            sec = preset.get("tokutenkai_slot_seconds_secondary")
        if sec is None:
            return {}
        try:
            sec = int(sec)
        except (TypeError, ValueError):
            return {}
        w = live.get("tokutenkai_tier_split_primary")
        if w is None:
            w = preset.get("tokutenkai_tier_split_primary", 0.5)
        try:
            w = float(w)
        except (TypeError, ValueError):
            w = 0.5
        return {"secondary_slot_seconds": sec, "tier_split_primary": w}

    def _tokutenkai_effective_ticket_price_yen(self, live: dict) -> int:
        """Blended ticket price for revenue (taiban dual-tier uses split weights)."""
        dual = self._tokutenkai_taiban_dual_kwargs(live)
        preset = self._get_live_type_presets().get("Taiban", {})
        if not dual:
            return max(0, int(live.get("tokutenkai_ticket_price") or 2000))
        try:
            p1 = max(0, int(live.get("tokutenkai_ticket_price") or preset.get("tokutenkai_ticket_price", 2000)))
        except (TypeError, ValueError):
            p1 = 2000
        try:
            p2 = max(0, int(live.get("tokutenkai_ticket_price_secondary") or preset.get("tokutenkai_ticket_price_secondary", 3000)))
        except (TypeError, ValueError):
            p2 = 3000
        rw = live.get("tokutenkai_tier_split_primary")
        if rw is None:
            rw = preset.get("tokutenkai_tier_split_primary", 0.5)
        try:
            w = float(rw)
        except (TypeError, ValueError):
            w = 0.5
        w = min(1.0, max(0.0, w))
        return int(round(p1 * w + p2 * (1.0 - w)))

    def _get_tokutenkai_window(self, live: dict) -> tuple[str, str]:
        """Return planned post-live meeting-session window."""
        live_end = str(live.get("end_time") or "") or self._compute_live_end_time(
            str(live.get("start_time") or "18:00"),
            live.get("duration"),
        )
        meeting_start = str(live.get("tokutenkai_start") or "").strip() or live_end
        meeting_end = str(live.get("tokutenkai_end") or "").strip()
        if not meeting_end:
            meeting_end = self._compute_end_time_from_duration(meeting_start, live.get("tokutenkai_duration") or 0)
        return meeting_start, meeting_end

    def _format_tokutenkai_summary(self, live: dict) -> str:
        """Format post-live meeting-session details for UI panels."""
        if not bool(live.get("tokutenkai_enabled")):
            return "None"
        start_text, end_text = self._get_tokutenkai_window(live)
        ticket_price = int(live.get("tokutenkai_ticket_price") or 2000)
        slot_seconds = int(live.get("tokutenkai_slot_seconds") or 40)
        expected_tickets = int(live.get("tokutenkai_expected_tickets") or 0)
        member_n = len(getattr(self.player_group, "members", []) or [])
        dual_kw = self._tokutenkai_taiban_dual_kwargs(live)
        max_tickets = self._calculate_tokutenkai_max_tickets(
            start_text,
            end_text,
            slot_seconds,
            member_n,
            **dual_kw,
        )
        parts = [f"{start_text}-{end_text}"]
        if dual_kw:
            tp = self._get_live_type_presets().get("Taiban", {})
            p2 = int(live.get("tokutenkai_ticket_price_secondary") or tp.get("tokutenkai_ticket_price_secondary", 3000))
            s2 = int(live.get("tokutenkai_slot_seconds_secondary") or tp.get("tokutenkai_slot_seconds_secondary", 20))
            try:
                w = float(live.get("tokutenkai_tier_split_primary") or tp.get("tokutenkai_tier_split_primary", 0.5))
            except (TypeError, ValueError):
                w = 0.5
            split_note = "50/50" if abs(w - 0.5) < 1e-9 else f"{w:.0%}/{1.0 - w:.0%}"
            parts.append(f"¥{ticket_price:,}/{slot_seconds}s & ¥{p2:,}/{s2}s ({split_note})")
        else:
            parts.append(f"¥{ticket_price:,}/ticket")
            parts.append(f"{slot_seconds}s")
        if expected_tickets:
            parts.append(f"est. {expected_tickets} tickets")
        parts.append(f"max {max_tickets} tickets")
        return " | ".join(parts)

    def _format_live_slot(self, live: dict) -> str:
        """Render a live's planned time window."""
        start_time = str(live.get("start_time") or "18:00")
        end_time = str(live.get("end_time") or "") or self._compute_live_end_time(start_time, live.get("duration"))
        return f"{start_time}-{end_time}"

    def _build_live_todos(self, live: dict) -> list[dict]:
        """Expand one live entry into schedule rows."""
        if not self.player_group:
            return []
        group_label = self.player_group.name_romanji or self.player_group.name
        title = live.get("title") or f"{group_label} {live.get('live_type', 'live')}"
        venue = live.get("venue") or "TBA venue"
        live_window = self._format_live_slot(live)
        setlist = live.get("setlist") or []
        detail_suffix = f" Setlist: {', '.join(setlist[:6])}." if setlist else ""
        todos: list[dict] = []

        rehearsal_start = str(live.get("rehearsal_start") or "").strip()
        rehearsal_end = str(live.get("rehearsal_end") or "").strip()
        if rehearsal_start:
            rehearsal_time = rehearsal_start if not rehearsal_end else f"{rehearsal_start}-{rehearsal_end}"
            todos.append(
                {
                    "time": rehearsal_time,
                    "title": f"{title} rehearsal",
                    "detail": f"Venue check and run-through at {venue}. Keep call sheets, transport, and stage marks locked in.",
                    "category": "Live",
                    "source_id": "group",
                    "source_label": group_label,
                    "source_color": self.colors["yellow"],
                }
            )

        todos.append(
            {
                "time": live_window,
                "title": title,
                "detail": f"{live.get('live_type', 'Live')} at {venue}.{detail_suffix}".strip(),
                "category": "Live",
                "source_id": "group",
                "source_label": group_label,
                "source_color": self.colors["accent"],
            }
        )
        if bool(live.get("tokutenkai_enabled")):
            meeting_start, meeting_end = self._get_tokutenkai_window(live)
            dual_kw = self._tokutenkai_taiban_dual_kwargs(live)
            if dual_kw:
                tp = self._get_live_type_presets().get("Taiban", {})
                p1 = int(live.get("tokutenkai_ticket_price") or 2000)
                p2 = int(live.get("tokutenkai_ticket_price_secondary") or tp.get("tokutenkai_ticket_price_secondary", 3000))
                s1 = int(live.get("tokutenkai_slot_seconds") or 15)
                s2 = int(live.get("tokutenkai_slot_seconds_secondary") or tp.get("tokutenkai_slot_seconds_secondary", 20))
                price_text = f"¥{p1:,}/{s1}s & ¥{p2:,}/{s2}s (taiban dual tier)"
                slot_text = f"{s1}s / {s2}s"
            else:
                price_text = f"¥{int(live.get('tokutenkai_ticket_price') or 2000):,}"
                slot_text = f"{int(live.get('tokutenkai_slot_seconds') or 40)}s"
            expected_tickets = int(live.get("tokutenkai_expected_tickets") or 0)
            expected_text = f" Expecting about {expected_tickets} tickets." if expected_tickets else ""
            todos.append(
                {
                    "time": f"{meeting_start}-{meeting_end}",
                    "title": f"{title} tokutenkai",
                    "detail": f"Post-live cheki / talk session at {venue}. {price_text} per ticket, {slot_text} each.{expected_text}".strip(),
                    "category": "Meeting",
                    "source_id": "group",
                    "source_label": group_label,
                    "source_color": self.colors["green"],
                }
            )
        return todos

    def _collect_group_song_titles(self, group) -> list[str]:
        """Return a deduped playable song-title pool from songs and disc track lists."""
        return [entry["title"] for entry in self._collect_group_song_entries(group)]

    def _format_song_popularity(self, value) -> str:
        """Render song popularity consistently for UI display."""
        try:
            if value is None or value == "":
                return "—"
            return f"{float(value):.1f}"
        except (TypeError, ValueError):
            return "—"

    def _collect_group_song_entries(self, group) -> list[dict[str, object]]:
        """Return playable song entries with title and best-known popularity."""
        titles: list[str] = []
        title_to_popularity: dict[str, object] = {}
        fallback_titles: list[str] = []
        seen: set[str] = set()
        seen_fallback: set[str] = set()
        disc_titles = {
            str(getattr(disc, "title", "") or getattr(disc, "title_romanji", "") or "").strip()
            for disc in list(getattr(group, "discography", []) or [])
            if str(getattr(disc, "title", "") or getattr(disc, "title_romanji", "") or "").strip()
        }
        for song in list(getattr(group, "songs", []) or []):
            if bool(getattr(song, "hidden", False)):
                continue
            title = str(getattr(song, "title", None) or getattr(song, "title_romanji", None) or "").strip()
            if not title:
                continue
            popularity = getattr(song, "popularity", None)
            if title not in seen_fallback:
                fallback_titles.append(title)
                seen_fallback.add(title)
            if popularity is not None and title not in title_to_popularity:
                title_to_popularity[title] = popularity
            if title in disc_titles or title in seen:
                continue
            titles.append(title)
            seen.add(title)
        for disc in list(getattr(group, "discography", []) or []):
            disc_title = str(getattr(disc, "title", "") or getattr(disc, "title_romanji", "") or "").strip()
            if disc_title and disc_title not in seen_fallback:
                fallback_titles.append(disc_title)
                seen_fallback.add(disc_title)
            for track_title in list(getattr(disc, "track_list", None) or []):
                cleaned_title = str(track_title or "").strip()
                if not cleaned_title or cleaned_title in disc_titles or cleaned_title in seen:
                    continue
                titles.append(cleaned_title)
                seen.add(cleaned_title)

        canonical_group = self._find_canonical_group_payload(group)
        canonical_titles: list[str] = []
        canonical_title_to_popularity: dict[str, object] = {}
        if isinstance(canonical_group, dict):
            canonical_disc_titles = {
                str(
                    disc.get("title")
                    or disc.get("title_romanji")
                    or ""
                ).strip()
                for disc in list(canonical_group.get("discography", []) or [])
                if isinstance(disc, dict)
                and str(disc.get("title") or disc.get("title_romanji") or "").strip()
            }
            canonical_seen: set[str] = set()
            for song in self._find_canonical_song_payloads(group):
                if bool(song.get("hidden", False)):
                    continue
                song_title = str(song.get("title") or song.get("title_romanji") or "").strip()
                if (
                    not song_title
                    or song_title in canonical_disc_titles
                    or song_title in canonical_seen
                ):
                    continue
                if song.get("popularity") is not None and song_title not in canonical_title_to_popularity:
                    canonical_title_to_popularity[song_title] = song.get("popularity")
                canonical_titles.append(song_title)
                canonical_seen.add(song_title)
            for disc in list(canonical_group.get("discography", []) or []):
                if not isinstance(disc, dict):
                    continue
                for track_title in list(disc.get("track_list", []) or []):
                    cleaned_title = str(track_title or "").strip()
                    if (
                        not cleaned_title
                        or cleaned_title in canonical_disc_titles
                        or cleaned_title in canonical_seen
                    ):
                        continue
                    canonical_titles.append(cleaned_title)
                    canonical_seen.add(cleaned_title)

        # Thin save snapshots may only carry release titles in songs[] and no discography.
        # Prefer the richer canonical song list in that case.
        if canonical_titles and (
            not titles
            or not list(getattr(group, "discography", []) or [])
            or len(canonical_titles) > len(titles)
        ):
            return [
                {"title": title, "popularity": canonical_title_to_popularity.get(title)}
                for title in canonical_titles
            ]

        if titles:
            return [
                {"title": title, "popularity": title_to_popularity.get(title)}
                for title in titles
            ]

        return [
            {"title": title, "popularity": title_to_popularity.get(title)}
            for title in fallback_titles
        ]

    def _archive_completed_lives_for_date(self, target_date: date) -> None:
        """Move scheduled managed-group lives for a closed day into past results."""
        target_key = target_date.isoformat()
        remaining: list[dict] = []
        existing_result_uids = {
            str(item.get("uid"))
            for item in self._live_results
            if isinstance(item, dict) and item.get("uid")
        }

        for raw_live in self._live_schedules:
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            if str(live.get("start_date") or "") != target_key:
                remaining.append(raw_live)
                continue

            live["status"] = "played"
            if live["uid"] not in existing_result_uids:
                if self.player_group:
                    live_result = resolve_group_live_result(self.player_group, live)
                    live.update(live_result)
                    live.update(apply_live_result_to_group(self.player_group, live_result))
                self._live_results.append(live)
                existing_result_uids.add(live["uid"])

        for raw_live in self._get_player_group_lives_for_date(target_date):
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            if str(live.get("uid") or "") in existing_result_uids:
                continue
            live["status"] = "played"
            if self.player_group:
                live_result = resolve_group_live_result(self.player_group, live)
                live.update(live_result)
                live.update(apply_live_result_to_group(self.player_group, live_result))
            self._live_results.append(live)
            existing_result_uids.add(live["uid"])

        self._live_schedules = remaining

    def _get_player_group_operational_lives_for_date(self, target_date: date) -> list[dict]:
        """Return unique managed-group live entries for a day, preferring played results."""
        by_uid: dict[str, dict] = {}
        for raw_live in self._get_player_group_lives_for_date(target_date):
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            by_uid[str(live.get("uid") or "")] = live

        for live in self._get_saved_managed_group_live_results():
            if self._parse_live_entry_date(live) != target_date:
                continue
            by_uid[str(live.get("uid") or "")] = live

        return [live for live in by_uid.values() if live]

    def _get_player_group_lives_for_date(self, target_date: date) -> list[dict]:
        """Return scheduled lives for the managed group on a specific day."""
        aliases = self._get_player_group_aliases()
        player_group_uid = str(getattr(self.player_group, "uid", "") or "")
        if not aliases:
            return []

        matches_by_uid: dict[str, dict] = {}
        for live in self._load_lives_data():
            raw_groups = live.get("group") or []
            if isinstance(raw_groups, str):
                raw_groups = [raw_groups]
            normalized = {str(name).casefold() for name in raw_groups if name}
            if not aliases.intersection(normalized) and str(live.get("group_uid") or "") != player_group_uid:
                continue

            raw_date = live.get("start_date")
            try:
                live_date = date.fromisoformat(str(raw_date).split("T")[0]) if raw_date else None
            except ValueError:
                live_date = None
            if live_date == target_date:
                normalized_live = self._normalize_live_entry(live) or live
                live_uid = str((normalized_live or {}).get("uid") or "")
                key = live_uid or f"canonical|{len(matches_by_uid)}"
                matches_by_uid[key] = normalized_live

        for live in self._get_saved_managed_group_lives():
            if self._parse_live_entry_date(live) == target_date:
                live_uid = str(live.get("uid") or "")
                key = live_uid or f"saved|{len(matches_by_uid)}"
                matches_by_uid[key] = live

        return list(matches_by_uid.values())

    def _has_group_live_on_date(self, target_date: date) -> bool:
        """Return whether the managed group has a live on the given day."""
        return bool(self._get_player_group_operational_lives_for_date(target_date))

    def _get_member_schedule_items_for_date(self, target_date: date) -> list[dict]:
        """Create member-level schedule items for the managed group's current roster."""
        if not self.player_group or not self.player_group.members:
            return []

        if not self._has_group_live_on_date(target_date):
            # Default training days are a shared group activity, so we don't duplicate
            # that as separate member schedules.
            return []

        member_items = []
        weekday_focus = [
            "conditioning",
            "vocals",
            "dance",
            "interview prep",
            "camera rehearsal",
            "live warm-up",
            "rest and recovery",
        ]

        for index, idol in enumerate(self.player_group.members[:8]):
            slot_hour = 9 + (index % 5)
            focus = weekday_focus[(target_date.weekday() + index) % len(weekday_focus)]
            member_items.append(
                {
                    "time": f"{slot_hour:02d}:00",
                    "title": f"{idol.name} schedule",
                    "detail": f"{idol.name} focuses on {focus} as part of the {self.player_group.name_romanji or self.player_group.name} daily plan.",
                    "category": "Member",
                    "source_id": f"idol:{idol.uid}",
                    "source_label": idol.name,
                    "source_color": self._get_member_calendar_color(idol, fallback_index=index),
                }
            )

        return member_items
    def create_content_area(self, parent):
        """Create the main content area for displaying idol profile."""
        content_frame = tk.Frame(parent, bg=self.colors['bg_content'])
        content_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=0, pady=0)
        
        # Configure parent to allow expansion
        parent.columnconfigure(1, weight=1)
        parent.rowconfigure(0, weight=1)
        
        # Configure content_frame itself to expand
        content_frame.columnconfigure(0, weight=1)
        content_frame.rowconfigure(0, weight=1)
        
        # Create scrollable canvas with both vertical and horizontal scrolling
        canvas = tk.Canvas(content_frame, bg=self.colors['bg_content'],
                          highlightthickness=0)
        v_scrollbar = tk.Scrollbar(content_frame, orient=tk.VERTICAL, command=canvas.yview)
        h_scrollbar = tk.Scrollbar(content_frame, orient=tk.HORIZONTAL, command=canvas.xview)
        
        # This frame will hold all the views (Groups, Idols, etc.)
        scrollable_frame = tk.Frame(canvas, bg=self.colors['bg_content'])
        
        # Configure canvas scrolling
        canvas.configure(yscrollcommand=v_scrollbar.set, xscrollcommand=h_scrollbar.set)
        
        # Create the window and store the ID
        self.content_window = canvas.create_window((0, 0), window=scrollable_frame, anchor="nw")
        
        # Update scroll region
        scrollable_frame.bind(
            "<Configure>",
            lambda e: canvas.configure(scrollregion=canvas.bbox("all"))
        )
        
        # Keep the content window aligned with the visible canvas area.
        # This lets short pages use the full vertical space while still allowing
        # longer pages to expand the scrollregion naturally.
        def sync_canvas_window(event):
            content_width = scrollable_frame.winfo_reqwidth()
            content_height = scrollable_frame.winfo_reqheight()
            canvas_width = event.width
            canvas_height = event.height

            canvas.itemconfig(
                self.content_window,
                width=max(content_width, canvas_width),
                height=max(content_height, canvas_height),
            )
        
        canvas.bind("<Configure>", sync_canvas_window)
        
        # Pack canvas and scrollbars
        v_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        h_scrollbar.pack(side=tk.BOTTOM, fill=tk.X)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # Enable mouse wheel scrolling
        self.bind_mousewheel(canvas, canvas, include_children=False)
        self.bind_mousewheel(scrollable_frame, canvas, include_children=False)
        
        # Store references
        self.content_frame = scrollable_frame
        self.content_canvas = canvas
        self.content_scrollbar = v_scrollbar
        self.content_hscrollbar = h_scrollbar
        
        # Optimized mouse wheel handler - cache widget references
        self._content_canvas_ref = canvas
        self._content_frame_ref = scrollable_frame
        
        def _on_global_mousewheel(event):
            try:
                # Get widget under mouse (optimized)
                widget_under_mouse = event.widget

                def _canvas_can_scroll_y(target) -> bool:
                    try:
                        first, last = target.yview()
                        return float(first) > 0.0 or float(last) < 1.0
                    except Exception:
                        return False

                def _scroll_main_canvas():
                    delta = 0
                    if hasattr(event, 'delta') and event.delta:
                        delta = -1 * (event.delta / 120)
                    elif hasattr(event, 'num'):
                        if event.num == 4:
                            delta = -1
                        elif event.num == 5:
                            delta = 1
                        else:
                            return
                    else:
                        return
                    canvas.yview_scroll(int(delta), "units")
                
                # Quick check: if widget is the canvas itself, scroll it
                if widget_under_mouse == canvas:
                    _scroll_main_canvas()
                    return
                
                # Check if widget is in sidebar (quick check)
                if hasattr(self, 'idol_listbox') and widget_under_mouse == self.idol_listbox:
                    return  # Let listbox handle its own scrolling
                
                # Simplified hierarchy check - only walk up if necessary
                w = widget_under_mouse
                max_depth = 40  # Deep nested cards/rows still need to reach the main content canvas.
                depth = 0
                
                while w and depth < max_depth:
                    try:
                        if isinstance(w, ttk.Treeview):
                            # Let treeviews handle their own mousewheel only when hovered.
                            return

                        # Quick checks first
                        if w == canvas or w == scrollable_frame:
                            # In content area, scroll main canvas
                            _scroll_main_canvas()
                            return
                        
                        # Check for nested canvas (group detail tables, etc.)
                        if isinstance(w, tk.Canvas) and w != canvas:
                            # Only trap wheel events for nested canvases that actually scroll.
                            # Otherwise, fall back to the main content page scroll.
                            if _canvas_can_scroll_y(w):
                                return
                        
                        w = w.master
                        depth += 1
                    except:
                        break

                # If we didn't hit a special-case widget, default to the main content scroll.
                _scroll_main_canvas()
            except:
                pass
        
        # Store the handler to avoid duplicate bindings
        if not hasattr(self, '_global_mousewheel_bound'):
            self.root.bind_all("<MouseWheel>", _on_global_mousewheel)
            self.root.bind_all("<Button-4>", _on_global_mousewheel)
            self.root.bind_all("<Button-5>", _on_global_mousewheel)
            self._global_mousewheel_bound = True
    
    def update_nav_button_color(self, btn):
        """Update navigation button color based on current view."""
        btn_text = btn.cget('text')
        if btn_text == self.current_view:
            btn.config(bg=self.colors['accent'])
        else:
            btn.config(bg=self.colors['bg_sidebar'])

    def refresh_date_display(self):
        """Update the date shown in the top bar."""
        if hasattr(self, "date_button"):
            self.date_button.config(text=self.current_date.strftime('%A, %B %d, %Y'))
        self._update_continue_button()

    def _parse_partial_birthday(self, partial_value: str):
        """Convert an MM-DD birthday string into a tuple."""
        if not partial_value or "-" not in partial_value:
            return None
        try:
            month_str, day_str = partial_value.split("-", 1)
            return int(month_str), int(day_str)
        except ValueError:
            return None

    def _read_raw_save(self) -> dict:
        """Load save JSON without normalizing (used to detect explicit shortlist / keys)."""
        try:
            return self._game_save.load_raw()
        except Exception:
            return {}

    def _configure_runtime_data_snapshot_from_payload(self, payload: Optional[dict], reload: bool = True) -> bool:
        """Point the runtime loaders at the save-owned database snapshot when available."""
        if not isinstance(payload, dict):
            return False
        self._prepare_runtime_snapshot_from_payload(payload)
        snapshot = payload.get("database_snapshot")
        if not isinstance(snapshot, dict):
            return False
        idols_payload = snapshot.get("idols")
        groups_payload = snapshot.get("groups")
        songs_payload = snapshot.get("songs")
        if not isinstance(idols_payload, list) or not isinstance(groups_payload, list):
            return False
        if not idols_payload or not groups_payload:
            return False
        shared_map = self._load_shared_attribute_map_from_payload(payload)
        configure_data_snapshot(
            idols_payload=apply_shared_attributes_to_rows(idols_payload, shared_map),
            groups_payload=groups_payload,
            songs_payload=songs_payload if isinstance(songs_payload, list) else None,
            reload=reload,
        )
        return True

    def _build_save_context(self) -> dict:
        """Describe the active startup context so scenario saves can be validated."""
        idols_path, groups_path = get_active_data_sources()
        songs_path = get_active_song_source()
        shared_attributes_path = shared_attributes_path_for_idols_path(idols_path)

        def _path_signature(path_obj) -> str:
            try:
                stat = os.stat(path_obj)
            except OSError:
                return ""
            return f"{int(stat.st_mtime_ns)}:{int(stat.st_size)}"

        return {
            "startup_date": self.startup_date,
            "idols_path": str(idols_path),
            "groups_path": str(groups_path),
            "songs_path": str(songs_path),
            "shared_attributes_path": str(shared_attributes_path) if shared_attributes_path else "",
            "idols_signature": _path_signature(idols_path),
            "groups_signature": _path_signature(groups_path),
            "songs_signature": _path_signature(songs_path),
            "shared_attributes_signature": _path_signature(shared_attributes_path) if shared_attributes_path else "",
        }

    def _load_shared_attribute_map_from_payload(self, payload: Optional[dict]) -> dict[str, dict]:
        """Load the shared scenario attribute database referenced by a save/scenario payload."""
        if not isinstance(payload, dict):
            return {}
        scenario_context = payload.get("scenario_context")
        if isinstance(scenario_context, dict):
            explicit_path = str(scenario_context.get("shared_attributes_path") or "").strip()
            if explicit_path:
                return load_shared_attribute_map(explicit_path)
            idols_path = str(scenario_context.get("idols_path") or "").strip()
            if idols_path:
                return load_shared_attribute_map(shared_attributes_path_for_idols_path(idols_path))
        context = self._build_save_context()
        default_path = str(context.get("shared_attributes_path") or "").strip()
        return load_shared_attribute_map(default_path) if default_path else {}

    @staticmethod
    def _payload_reference_date(payload: Optional[dict]) -> Optional[date]:
        """Extract the best available reference date from a save/scenario payload."""
        if not isinstance(payload, dict):
            return None
        for key in ("current_date", "game_start_date"):
            value = payload.get(key)
            if value:
                try:
                    return date.fromisoformat(str(value).split("T")[0])
                except ValueError:
                    continue
        scenario_context = payload.get("scenario_context")
        if isinstance(scenario_context, dict) and scenario_context.get("startup_date"):
            try:
                return date.fromisoformat(str(scenario_context["startup_date"]).split("T")[0])
            except ValueError:
                return None
        return None

    def _queue_applied_scenario_event_notifications(self, events: list[dict[str, Any]]) -> None:
        """Store due scenario-event notices until the inbox is ready to receive them."""
        for event in events or []:
            if not isinstance(event, dict):
                continue
            title, body = describe_applied_event(event)
            self._pending_scenario_notifications.append(
                {
                    "title": title,
                    "body": body,
                    "sender": "News",
                    "category": "news",
                    "level": "normal",
                    "date": str(event.get("effective_date") or ""),
                    "dedupe_key": f"scenario-event|{str(event.get('uid') or '')}",
                }
            )

    def _prepare_runtime_snapshot_from_payload(self, payload: Optional[dict]) -> None:
        """Normalize a scenario snapshot to the current in-game date and queue due events."""
        if not isinstance(payload, dict):
            return
        snapshot = payload.get("database_snapshot")
        if not isinstance(snapshot, dict):
            return
        idols_payload = snapshot.get("idols")
        groups_payload = snapshot.get("groups")
        if not isinstance(idols_payload, list) or not isinstance(groups_payload, list):
            return

        reference_date = self._payload_reference_date(payload)
        if reference_date is None:
            return

        runtime = payload.setdefault("scenario_runtime", {})
        if not isinstance(runtime, dict):
            runtime = {}
            payload["scenario_runtime"] = runtime

        future_events = runtime.get("future_events")
        applied_events: list[dict[str, Any]] = []
        if isinstance(future_events, list) and future_events:
            new_idols, new_groups, remaining_events, applied_events = apply_due_future_events(
                idols_payload,
                groups_payload,
                future_events,
                as_of=reference_date,
            )
            snapshot["idols"] = new_idols
            snapshot["groups"] = new_groups
            runtime["future_events"] = remaining_events
            if applied_events or remaining_events != future_events:
                self._scenario_runtime_dirty = True
        else:
            new_idols, new_groups, queued_events = build_filtered_snapshot_with_future_events(
                idols_payload,
                groups_payload,
                as_of=reference_date,
            )
            if new_idols != idols_payload or new_groups != groups_payload or queued_events:
                snapshot["idols"] = new_idols
                snapshot["groups"] = new_groups
                runtime["future_events"] = queued_events
                self._scenario_runtime_dirty = True

        queued = runtime.get("future_events")
        self._scenario_future_events = [copy.deepcopy(item) for item in queued if isinstance(item, dict)] if isinstance(queued, list) else []
        if applied_events:
            self._queue_applied_scenario_event_notifications(applied_events)

    def _apply_pending_scenario_notifications(self) -> None:
        """Flush queued scenario-event notices into the inbox after payload restore."""
        pending = list(self._pending_scenario_notifications)
        self._pending_scenario_notifications = []
        for item in pending:
            try:
                date_value = date.fromisoformat(str(item.get("date") or "").split("T")[0])
            except ValueError:
                date_value = self.current_date
            self._add_notification(
                str(item.get("title") or "Scenario update"),
                str(item.get("body") or ""),
                sender=str(item.get("sender") or "News"),
                category=str(item.get("category") or "news"),
                level=str(item.get("level") or "normal"),
                date_value=date_value,
                dedupe_key=str(item.get("dedupe_key") or ""),
            )

    def _reload_runtime_database_from_snapshot(self) -> None:
        """Reload in-memory idols/groups from the current save-owned snapshot payload."""
        if not self._configure_runtime_data_snapshot_from_payload(self._game_save_payload, reload=True):
            return
        self.idols = get_sample_idols(reload=True)
        self.group_manager = get_group_manager(reload=True, reference_date=self.current_date)

        idol_by_uid = {str(getattr(idol, "uid", "") or ""): idol for idol in self.idols}
        self.shortlisted_idols = [idol_by_uid[uid] for uid in [str(getattr(idol, "uid", "") or "") for idol in self.shortlisted_idols] if uid in idol_by_uid]
        current_uid = str(getattr(self.current_idol, "uid", "") or "")
        self.current_idol = idol_by_uid.get(current_uid) if current_uid else None

        if self.player_group and self.group_manager:
            target_uid = str(getattr(self.player_group, "uid", "") or "")
            target_name = str(getattr(self.player_group, "name", "") or "")
            replacement = None
            for group in self.group_manager.get_all_groups():
                if target_uid and str(getattr(group, "uid", "") or "") == target_uid:
                    replacement = group
                    break
                if target_name and str(getattr(group, "name", "") or "") == target_name:
                    replacement = group
            if replacement is not None:
                self._set_player_group(replacement)

    def _initialize_scenario_runtime_snapshot(self, opening_date: date) -> None:
        """Build a filtered opening-day snapshot plus queued future events from active sources."""
        idols_path, groups_path = get_active_data_sources()
        songs_path = get_active_song_source()
        try:
            with open(idols_path, "r", encoding="utf-8") as handle:
                idols_rows = json.load(handle)
            with open(groups_path, "r", encoding="utf-8") as handle:
                groups_rows = json.load(handle)
            with open(songs_path, "r", encoding="utf-8") as handle:
                songs_rows = json.load(handle)
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            return

        if not isinstance(idols_rows, list) or not isinstance(groups_rows, list):
            return
        songs_rows = songs_rows if isinstance(songs_rows, list) else []

        filtered_idols, filtered_groups, future_events = build_filtered_snapshot_with_future_events(
            idols_rows,
            groups_rows,
            as_of=opening_date,
        )
        self._scenario_future_events = [copy.deepcopy(item) for item in future_events if isinstance(item, dict)]
        self._scenario_runtime_dirty = True
        configure_data_snapshot(
            idols_payload=filtered_idols,
            groups_payload=filtered_groups,
            songs_payload=songs_rows,
            reload=True,
        )
        self.idols = get_sample_idols(reload=True)
        self.group_manager = get_group_manager(reload=True, reference_date=opening_date)

    def _save_payload_matches_active_context(self, payload: Optional[dict]) -> bool:
        """Return whether a loaded save belongs to the currently active scenario context."""
        if not isinstance(payload, dict):
            return False
        snapshot = payload.get("database_snapshot")
        if isinstance(snapshot, dict) and isinstance(snapshot.get("idols"), list) and isinstance(snapshot.get("groups"), list):
            if snapshot.get("idols") and snapshot.get("groups"):
                return True
        expected = self._build_save_context()
        scenario_context = payload.get("scenario_context")
        if not isinstance(scenario_context, dict):
            return False
        normalized_context = dict(scenario_context)
        if not normalized_context.get("shared_attributes_path"):
            inferred_path = shared_attributes_path_for_idols_path(normalized_context.get("idols_path"))
            normalized_context["shared_attributes_path"] = str(inferred_path) if inferred_path else ""
        if not normalized_context.get("shared_attributes_signature"):
            shared_path = str(normalized_context.get("shared_attributes_path") or "").strip()
            if shared_path:
                try:
                    stat = os.stat(shared_path)
                    normalized_context["shared_attributes_signature"] = f"{int(stat.st_mtime_ns)}:{int(stat.st_size)}"
                except OSError:
                    normalized_context["shared_attributes_signature"] = ""
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
            if str(normalized_context.get(key) or "") != str(expected.get(key) or ""):
                return False
        return True

    def _find_managing_group_from_payload(self, payload: Optional[dict]):
        """Resolve the managed group from save payload using uid first, then legacy name."""
        if not isinstance(payload, dict):
            return None
        manager = self.group_manager or get_group_manager(reload=True, reference_date=self.current_date)
        self.group_manager = manager
        if manager is None:
            return None

        target_uid = str(payload.get("managing_group_uid") or "").strip()
        if target_uid:
            for group in manager.get_all_groups():
                if str(getattr(group, "uid", "") or "").strip() == target_uid:
                    return group

        target_name = str(payload.get("managing_group") or "").strip()
        if target_name:
            return manager.find_group(target_name)
        return None

    def _build_database_snapshot_payload(self) -> dict:
        """Serialize the current in-memory idols/groups as the save-owned runtime database."""
        idols_payload = [idol.to_dict() for idol in self.idols]
        groups_payload = []
        songs_payload = []
        manager = self.group_manager
        if manager is not None:
            groups_payload = [group.to_dict() for group in manager.get_all_groups()]
            for group_payload in groups_payload:
                group_uid = str(group_payload.get("uid") or "").strip()
                group_name = str(group_payload.get("name") or group_payload.get("name_romanji") or "").strip()
                song_rows = []
                for song_row in group_payload.get("songs", []) or []:
                    if not isinstance(song_row, dict):
                        continue
                    row = copy.deepcopy(song_row)
                    row["group_uid"] = str(row.get("group_uid") or group_uid or "")
                    row["group_name"] = str(row.get("group_name") or group_name or "")
                    song_rows.append(row)
                group_payload["song_uids"] = [str(row.get("uid")) for row in song_rows if row.get("uid")]
                group_payload.pop("songs", None)
                songs_payload.extend(song_rows)
        return {
            "idols": idols_payload,
            "groups": groups_payload,
            "songs": songs_payload,
        }

    def _save_payload_has_database_snapshot(self) -> bool:
        """Return whether the loaded save payload already embeds a usable idols/groups snapshot."""
        snapshot = self._game_save_payload.get("database_snapshot") if isinstance(self._game_save_payload, dict) else None
        if not isinstance(snapshot, dict):
            return False
        return bool(snapshot.get("idols")) and bool(snapshot.get("groups"))

    def _reset_title_bar_default(self):
        """Reset title bar when no managed group."""
        if hasattr(self, "title_label"):
            self.title_label.config(text="IDOL PRODUCER", fg=self.colors["text_primary"], cursor="arrow", font=("Arial", 16, "bold"))
        self._update_title_hover_state(False)

    def _seed_shortlist_from_player_group_members(self):
        """Replace shortlist with current group members (deduped, roster order)."""
        self.shortlisted_idols = []
        if not self.player_group:
            self.refresh_shortlist_sidebar()
            return
        seen = set()
        for idol in self.player_group.members:
            uid = getattr(idol, "uid", None)
            if uid and uid not in seen:
                self.shortlisted_idols.append(idol)
                seen.add(uid)
        self.refresh_shortlist_sidebar()

    def _idol_shortlist_uid_set(self) -> set[str]:
        """Return shortlisted idol UIDs for visibility overrides."""
        return {str(getattr(idol, "uid", "") or "") for idol in self.shortlisted_idols if getattr(idol, "uid", None)}

    def _is_idol_publicly_visible(self, idol: Idol) -> bool:
        """Return whether an idol should appear in the normal idol browser."""
        if str(getattr(idol, "uid", "") or "") in self._idol_shortlist_uid_set():
            return True
        return bool(getattr(idol, "is_publicly_visible", lambda _d=None: True)(self.current_date))

    def _is_idol_scout_discoverable(self, idol: Idol) -> bool:
        """Return whether an idol can appear in scout-led discovery flows."""
        return bool(getattr(idol, "is_scout_discoverable", lambda _d=None: True)(self.current_date))

    def _get_public_idols(self) -> list[Idol]:
        """Visible idol pool for the normal browser and general counts."""
        return [idol for idol in self.idols if self._is_idol_publicly_visible(idol)]

    def _apply_save_game_state(self, from_disk_reload: bool = False):
        """Restore managing group, shortlist, lives, and finances from the loaded save."""
        payload = self._game_save_payload
        self.player_name = str(payload.get("player_name") or "").strip()
        lives = payload.get("lives", {})
        if isinstance(lives, dict):
            sch = lives.get("schedules")
            res = lives.get("results")
            self._live_schedules = list(sch) if isinstance(sch, list) else []
            self._live_results = list(res) if isinstance(res, list) else []
        else:
            self._live_schedules = []
            self._live_results = []

        fin = payload.get("finances")
        self._finances = fin if isinstance(fin, dict) else GameSave.default_finances()

        if from_disk_reload:
            self.shortlisted_idols = []

        self._apply_game_calendar_from_save()
        runtime = payload.get("scenario_runtime")
        if isinstance(runtime, dict) and isinstance(runtime.get("future_events"), list):
            self._scenario_future_events = [copy.deepcopy(item) for item in runtime.get("future_events", []) if isinstance(item, dict)]
        else:
            self._scenario_future_events = []

        if from_disk_reload and ("managing_group" in self._raw_game_save or "managing_group_uid" in self._raw_game_save):
            if self._raw_game_save.get("managing_group") or self._raw_game_save.get("managing_group_uid"):
                group = self._find_managing_group_from_payload(self._raw_game_save)
                if group is not None:
                    self._set_player_group(group)
                else:
                    self.player_group = None
                    self.selected_calendar_sources = set()
                    self._reset_title_bar_default()
            else:
                self.player_group = None
                self.selected_calendar_sources = set()
                self._reset_title_bar_default()
        elif not from_disk_reload:
            if payload.get("managing_group") or payload.get("managing_group_uid"):
                group = self._find_managing_group_from_payload(payload)
                if group is not None:
                    self._set_player_group(group)

        if "shortlist" in self._raw_game_save and isinstance(self._raw_game_save.get("shortlist"), list):
            uids = self._raw_game_save["shortlist"]
            id_lookup = {i.uid: i for i in self.idols if getattr(i, "uid", None)}
            self.shortlisted_idols = [id_lookup[u] for u in uids if u in id_lookup]
            self.refresh_shortlist_sidebar()
        elif from_disk_reload and self.player_group:
            self._seed_shortlist_from_player_group_members()
        self._apply_training_intensity_from_payload()
        self._apply_training_week_log_from_payload()
        self._apply_training_focus_from_payload()
        self._apply_scout_state_from_payload()
        self._apply_inbox_from_payload()
        self._apply_pending_scenario_notifications()
        self._ensure_finances_ready()
        self._seed_startup_inbox_if_needed(from_disk_reload=from_disk_reload)

    def _apply_game_calendar_from_save(self) -> None:
        """Restore current_date, game_start_date, turn_number when present in the save payload."""
        payload = self._game_save_payload
        has_turn_key = "turn_number" in payload and payload.get("turn_number") is not None
        changed = False

        if payload.get("current_date"):
            try:
                self.current_date = date.fromisoformat(str(payload["current_date"]).split("T")[0])
                changed = True
            except ValueError:
                pass
        if payload.get("game_start_date"):
            try:
                self.game_start_date = date.fromisoformat(str(payload["game_start_date"]).split("T")[0])
                changed = True
            except ValueError:
                pass
        if has_turn_key:
            try:
                self.turn_number = max(1, int(payload["turn_number"]))
                changed = True
            except (TypeError, ValueError):
                pass
        elif payload.get("current_date") and payload.get("game_start_date"):
            try:
                self.turn_number = max(1, (self.current_date - self.game_start_date).days + 1)
                changed = True
            except Exception:
                pass

        if changed:
            self.selected_calendar_date = self.current_date
            self.calendar_month_anchor = self.current_date.replace(day=1)
            self._daily_todos_cache.clear()
            self.refresh_date_display()

    def _apply_training_intensity_from_payload(self) -> None:
        """Load training intensity map from save payload (idol uid -> category -> 0–5)."""
        self._training_intensity = {}
        if "training_intensity" not in self._raw_game_save:
            return
        raw = self._game_save_payload.get("training_intensity")
        if not isinstance(raw, dict):
            return
        keys = ("sing", "dance", "physical", "target")
        for uid, cols in raw.items():
            if not isinstance(cols, dict):
                continue
            uid_s = str(uid)
            row: dict[str, int] = {}
            for k in keys:
                if k in cols:
                    try:
                        row[k] = max(0, min(5, int(cols[k])))
                    except (TypeError, ValueError):
                        row[k] = 0
                elif k == "target" and "misc" in cols:
                    try:
                        row["target"] = max(0, min(5, int(cols["misc"])))
                    except (TypeError, ValueError):
                        row["target"] = 0
                else:
                    row[k] = 0
            self._training_intensity[uid_s] = row

    def _apply_training_focus_from_payload(self) -> None:
        """Load per-idol focus skill from save (make-up, talking, model, host, variety, acting)."""
        self._training_focus_skill = {}
        if "training_focus_skill" not in self._raw_game_save:
            return
        raw = self._game_save_payload.get("training_focus_skill")
        if not isinstance(raw, dict):
            return
        opts = set(self._TRAINING_FOCUS_OPTIONS)
        for uid, val in raw.items():
            if isinstance(val, str) and val in opts:
                self._training_focus_skill[str(uid)] = val

    def _apply_training_week_log_from_payload(self) -> None:
        """Load the rolling managed-idol workload history from save."""
        if "training_week_log" not in self._raw_game_save:
            self._training_week_log = {}
            return
        self._training_week_log = normalize_training_week_log(self._game_save_payload.get("training_week_log"))

    def _apply_scout_state_from_payload(self) -> None:
        """Restore scout-company selection and held auditions from save."""
        default_uid = self._scout_companies[0].uid if self._scout_companies else ""
        self._scout_state = {
            "selected_company_uid": default_uid,
            "auditions": {},
        }
        raw = self._game_save_payload.get("scout")
        if not isinstance(raw, dict):
            return
        selected_uid = str(raw.get("selected_company_uid") or default_uid)
        if selected_uid in self._scout_company_lookup:
            self._scout_state["selected_company_uid"] = selected_uid
        auditions = raw.get("auditions")
        if isinstance(auditions, dict):
            clean_auditions: dict[str, list[dict]] = {}
            for key, rows in auditions.items():
                if not isinstance(rows, list):
                    continue
                clean_rows = [dict(row) for row in rows if isinstance(row, dict)]
                clean_auditions[str(key)] = clean_rows
            self._scout_state["auditions"] = clean_auditions

    def _apply_inbox_from_payload(self) -> None:
        """Restore saved inbox notifications."""
        self._notifications = []
        raw = self._game_save_payload.get("inbox")
        if not isinstance(raw, dict):
            return
        rows = raw.get("notifications")
        if not isinstance(rows, list):
            return
        for item in rows:
            if isinstance(item, dict):
                self._notifications.append(copy.deepcopy(item))

    def _notification_sort_key(self, item: dict[str, Any]) -> tuple:
        """Sort notifications newest-first, with stable fallback on uid."""
        created_text = str(item.get("created_at") or "").split("T")
        day_text = str(item.get("date") or created_text[0] if created_text else "")
        try:
            day_ord = date.fromisoformat(day_text.split("T")[0]).toordinal()
        except ValueError:
            day_ord = 0
        time_text = created_text[1] if len(created_text) > 1 else "00:00:00"
        time_parts = [part for part in time_text.split(":")[:3]]
        while len(time_parts) < 3:
            time_parts.append("0")
        try:
            seconds = (int(time_parts[0]) * 3600) + (int(time_parts[1]) * 60) + int(float(time_parts[2]))
        except ValueError:
            seconds = 0
        return (
            -day_ord,
            -seconds,
            str(item.get("uid") or ""),
        )

    def _sort_notifications(self) -> None:
        """Keep inbox ordering stable and useful."""
        self._notifications.sort(key=self._notification_sort_key)

    def _add_notification(
        self,
        title: str,
        body: str,
        *,
        sender: str = "Assistant",
        category: str = "general",
        level: str = "normal",
        date_value: Optional[date] = None,
        unread: bool = True,
        dedupe_key: str = "",
        requires_confirmation: bool = False,
        choice_kind: str = "",
        choice_status: str = "",
        choice_options: Optional[list[dict[str, str]]] = None,
        related_event_uid: str = "",
    ) -> dict[str, Any]:
        """Append a new inbox notification unless an existing dedupe key matches."""
        if dedupe_key:
            for item in self._notifications:
                if str(item.get("dedupe_key") or "") == dedupe_key:
                    return item
        day = date_value or self.current_date
        item = {
            "uid": str(uuid.uuid4()),
            "date": day.isoformat(),
            "created_at": f"{day.isoformat()}T09:00:00",
            "title": str(title),
            "body": str(body),
            "sender": str(sender or "Assistant"),
            "category": str(category),
            "level": str(level),
            "read": not unread,
            "dedupe_key": str(dedupe_key or ""),
            "requires_confirmation": bool(requires_confirmation),
            "choice_kind": str(choice_kind or ""),
            "choice_status": str(choice_status or ""),
            "choice_options": [dict(option) for option in (choice_options or []) if isinstance(option, dict)],
            "related_event_uid": str(related_event_uid or ""),
        }
        self._notifications.append(item)
        self._sort_notifications()
        return item

    def _notification_requires_confirmation(self, item: Optional[dict[str, Any]]) -> bool:
        """Return whether a notification should block day advancement until acknowledged."""
        if not isinstance(item, dict):
            return False
        if bool(item.get("requires_confirmation")):
            return True
        if str(item.get("choice_status") or "") == "pending":
            return True
        category = str(item.get("category") or "").casefold()
        title = str(item.get("title") or "").casefold()
        return category in {"confirmation", "decision"} or any(
            needle in title
            for needle in ("member left", "scandal revealed", "today's live schedule", "signing confirmation")
        )

    def _find_notification_by_dedupe_key(self, dedupe_key: str) -> Optional[dict[str, Any]]:
        """Return one notification by dedupe key."""
        target = str(dedupe_key or "")
        if not target:
            return None
        for item in self._notifications:
            if str(item.get("dedupe_key") or "") == target:
                return item
        return None

    def _get_blocking_notification_for_current_day(self) -> Optional[dict[str, Any]]:
        """Return the oldest unread/pending critical notification blocking day advance."""
        blocking: list[dict[str, Any]] = []
        for item in self._notifications:
            if not isinstance(item, dict):
                continue
            if not self._notification_requires_confirmation(item):
                continue
            if item.get("read") and str(item.get("choice_status") or "") != "pending":
                continue
            try:
                item_date = date.fromisoformat(str(item.get("date") or "").split("T")[0])
            except ValueError:
                item_date = self.current_date
            if item_date > self.current_date:
                continue
            blocking.append(item)
        if not blocking:
            return None
        blocking.sort(key=self._notification_sort_key)
        return blocking[0]

    def _focus_blocking_notification(self, item: Optional[dict[str, Any]]) -> bool:
        """Jump to Inbox and select one blocking notification."""
        if not isinstance(item, dict):
            return False
        self._selected_notification_uid = str(item.get("uid") or "")
        self.switch_view("Inbox", skip_history=True)
        return True

    def _acknowledge_notification(self, uid: str) -> None:
        """Confirm one notification and mark it read."""
        target = None
        for item in self._notifications:
            if str(item.get("uid") or "") == str(uid):
                target = item
                break
        created_uid = ""
        if isinstance(target, dict):
            created_uid = self._handle_notification_acknowledgement(target)
        self._mark_notification_read(uid)
        if created_uid:
            self._selected_notification_uid = created_uid
        if self.current_view == "Inbox":
            self.show_inbox_view()

    def _handle_notification_acknowledgement(self, item: dict[str, Any]) -> str:
        """Run side effects for notifications that trigger an action on confirmation."""
        dedupe_key = str(item.get("dedupe_key") or "")
        title = str(item.get("title") or "")
        if title == "Today's live schedule" or dedupe_key.startswith("daily-lives|"):
            return self._start_todays_lives()
        return ""

    def _build_live_report_notification_body(self, live: dict[str, Any]) -> str:
        """Format a compact live report body for inbox notifications."""
        member_lines = []
        for row in (live.get("member_deltas") or [])[:3]:
            if not isinstance(row, dict):
                continue
            member_lines.append(
                f"{str(row.get('name') or 'Member')}: rate {row.get('performance_rating', '—')}, fans {row.get('fan_gain', 0):+d}, morale {row.get('morale_gain', 0):+d}"
            )
        body = (
            f"{str(live.get('title') or live.get('live_type') or 'Live')} finished with performance {live.get('performance_score', '—')} "
            f"and satisfaction {live.get('audience_satisfaction', '—')}. "
            f"Attendance {live.get('attendance', 0)}, fan change {int(live.get('group_fan_gain', live.get('fan_gain', 0)) or 0):+d}."
        )
        if member_lines:
            body += " " + " | ".join(member_lines)
        return body

    def _start_todays_lives(self) -> str:
        """Resolve today's scheduled lives immediately and issue same-day live reports."""
        target_date = self.current_date
        self._archive_completed_lives_for_date(target_date)
        created_notification_uid = ""
        reported_live_uids: set[str] = set()
        todays_results = [
            live for live in self._get_saved_managed_group_live_results()
            if self._parse_live_entry_date(live) == target_date
        ]
        todays_results.sort(key=lambda item: (str(item.get("start_time") or ""), str(item.get("title") or "")))
        for live in todays_results:
            if bool(live.get("report_generated_same_day")):
                continue
            title_seed = str(live.get("title") or live.get("live_type") or "Live")
            title_prefix = "Festival report" if str(live.get("live_type") or live.get("event_type") or "") == "Festival" else "Live report"
            created = self._add_notification(
                f"{title_prefix}: {title_seed}",
                self._build_live_report_notification_body(live),
                sender="Operations",
                category="internal",
                level="normal",
                date_value=target_date,
                dedupe_key=f"live-report-start|{str(live.get('uid') or '')}|{target_date.isoformat()}",
                related_event_uid=str(live.get("uid") or ""),
            )
            live_uid = str(live.get("uid") or "")
            if live_uid:
                reported_live_uids.add(live_uid)
            if not created_notification_uid:
                created_notification_uid = str(created.get("uid") or "")
        for raw_live in self._live_results:
            if not isinstance(raw_live, dict):
                continue
            if str(raw_live.get("uid") or "") in reported_live_uids:
                raw_live["report_generated_same_day"] = True
        if created_notification_uid:
            self._persist_game_save()
        return created_notification_uid

    def _resolve_notification_choice(self, uid: str, choice_value: str) -> None:
        """Apply a user choice stored on an inbox notification."""
        target = None
        for item in self._notifications:
            if str(item.get("uid") or "") == str(uid):
                target = item
                break
        if not isinstance(target, dict):
            return
        choice_kind = str(target.get("choice_kind") or "")
        target["choice_status"] = str(choice_value or "")
        target["read"] = True
        if choice_kind == "managed_group_leave":
            target["requires_confirmation"] = False
        self._sort_notifications()
        self._persist_game_save()
        if choice_kind == "managed_group_leave":
            self._apply_scenario_future_events_for_current_date()
        if self.current_view == "Inbox":
            self.show_inbox_view()

    def _mark_notification_read(self, uid: str) -> None:
        """Mark one inbox item as read."""
        changed = False
        for item in self._notifications:
            if str(item.get("uid") or "") == str(uid):
                if not item.get("read"):
                    item["read"] = True
                    changed = True
                break
        if changed:
            self._sort_notifications()
            self._persist_game_save()

    def _mark_all_notifications_read(self) -> None:
        """Mark all inbox items as read."""
        changed = False
        for item in self._notifications:
            if not item.get("read"):
                item["read"] = True
                changed = True
        if changed:
            self._sort_notifications()
            self._persist_game_save()

    def _get_notifications_for_date(self, target_date: date) -> list[dict[str, Any]]:
        """Return notifications assigned to one in-game day."""
        target_key = target_date.isoformat()
        return [item for item in self._notifications if str(item.get("date") or "") == target_key]

    def _has_unread_notifications_for_date(self, target_date: date) -> bool:
        """Return whether the inbox still has unread items for one in-game day."""
        return any(not item.get("read") for item in self._get_notifications_for_date(target_date))

    def _get_next_unread_notification_for_date(self, target_date: date) -> Optional[dict[str, Any]]:
        """Return the next unread notification for the day, preferring current selection order."""
        todays = self._get_notifications_for_date(target_date)
        unread = [item for item in todays if not item.get("read")]
        if not unread:
            return None
        for item in unread:
            if str(item.get("uid") or "") == self._selected_notification_uid:
                return item
        return unread[0]

    def _ensure_selected_notification(self) -> Optional[dict[str, Any]]:
        """Keep inbox detail selection valid and stable."""
        if not self._notifications:
            self._selected_notification_uid = ""
            return None
        for item in self._notifications:
            if str(item.get("uid") or "") == self._selected_notification_uid:
                return item
        preferred = self._get_blocking_notification_for_current_day()
        if preferred is None:
            preferred = self._get_next_unread_notification_for_date(self.current_date)
        if preferred is None:
            preferred = self._notifications[0]
        self._selected_notification_uid = str(preferred.get("uid") or "")
        return preferred

    def _select_notification(self, uid: str) -> None:
        """Select one inbox message and refresh the inbox detail pane."""
        self._selected_notification_uid = str(uid or "")
        if self.current_view == "Inbox":
            self.show_inbox_view()

    def _update_continue_button(self) -> None:
        """Refresh the top-right primary action label."""
        if not hasattr(self, "continue_btn"):
            return
        if self._browse_mode:
            self.continue_btn.config(text="Browse", state=tk.DISABLED)
            return
        self.continue_btn.config(text="Next Day")

    def _handle_primary_continue_action(self) -> None:
        """Advance the day unless a critical inbox item or pending decision blocks it."""
        blocker = self._get_blocking_notification_for_current_day()
        if blocker is not None:
            self._focus_blocking_notification(blocker)
            return
        self.advance_turn()

    def _get_selected_scout_company(self) -> Optional[ScoutCompany]:
        """Return the currently selected scout company, if any."""
        selected_uid = str(self._scout_state.get("selected_company_uid") or "")
        return self._scout_company_lookup.get(selected_uid)

    def _set_selected_scout_company(self, company_uid: str) -> None:
        """Persist the active scout company selection."""
        if company_uid in self._scout_company_lookup:
            self._scout_state["selected_company_uid"] = company_uid

    def _scout_audition_key(self, company: ScoutCompany, target_date: Optional[date] = None) -> str:
        """Return the save key for one company's audition board on a given day."""
        day = target_date or self.current_date
        return f"{company.uid}|{day.isoformat()}"

    def _get_saved_auditions_for_company(self, company: ScoutCompany, target_date: Optional[date] = None) -> list[dict]:
        """Return held audition candidates for a scout company and day."""
        auditions = self._scout_state.get("auditions", {})
        if not isinstance(auditions, dict):
            return []
        rows = auditions.get(self._scout_audition_key(company, target_date), [])
        return [dict(row) for row in rows if isinstance(row, dict)]

    def _hold_scout_audition(self, company: ScoutCompany) -> list[dict]:
        """Generate and persist today's audition board for the selected scout company."""
        rows = generate_audition_candidates(company, self.current_date, idols=self.idols)
        auditions = self._scout_state.setdefault("auditions", {})
        if isinstance(auditions, dict):
            auditions[self._scout_audition_key(company)] = rows
        self._persist_game_save()
        return rows

    def _default_training_row_for_idol(self, idol: Idol) -> dict[str, int]:
        """Reasonable starting training balance for a managed idol."""
        return {"sing": 2, "dance": 2, "physical": 1, "target": 1}

    def _ensure_default_training_plan_for_managed_group(self) -> tuple[int, list[str]]:
        """Seed default training settings for managed idols that do not have them yet."""
        if not self.player_group:
            return 0, []
        applied = 0
        names: list[str] = []
        for idol in getattr(self.player_group, "members", []) or []:
            uid = str(getattr(idol, "uid", "") or "")
            existing = self._training_intensity.get(uid)
            has_any = isinstance(existing, dict) and any(int(existing.get(key, 0) or 0) > 0 for key in self._TRAINING_INTENSITY_KEYS)
            if not has_any:
                self._training_intensity[uid] = self._default_training_row_for_idol(idol)
                applied += 1
                names.append(idol.name)
            if uid not in self._training_focus_skill:
                self._training_focus_skill[uid] = self._TRAINING_FOCUS_DEFAULT
        return applied, names

    def _format_member_overview_notification(self) -> str:
        """Summarize the managed roster for a startup guidance message."""
        if not self.player_group:
            return "No managed group is set yet."
        members = list(getattr(self.player_group, "members", []) or [])
        member_names = ", ".join(idol.name for idol in members[:8]) if members else "No current members"
        if len(members) > 8:
            member_names += f", +{len(members) - 8} more"
        avg_age_values = [
            idol.age_on(self.current_date)
            for idol in members
            if getattr(idol, "age_on", None) and idol.age_on(self.current_date) is not None
        ]
        avg_age = f"{(sum(avg_age_values) / len(avg_age_values)):.1f}" if avg_age_values else "—"
        return (
            f"{self.player_group.name or self.player_group.name_romanji} opens with {len(members)} managed members. "
            f"Average age: {avg_age}. Current roster: {member_names}."
        )

    def _format_training_defaults_notification(self, applied: int) -> str:
        """Describe the default training plan for the managed roster."""
        if not self.player_group:
            return "No managed group is set yet."
        row = self._default_training_row_for_idol(self.player_group.members[0]) if self.player_group.members else {"sing": 2, "dance": 2, "physical": 1, "target": 1}
        return (
            f"Default training has been set for {applied} member(s): "
            f"Sing {row['sing']}, Dance {row['dance']}, Physical {row['physical']}, Target {row['target']}. "
            f"Focus skill defaults to {self._TRAINING_FOCUS_DEFAULT}. Review this in Training when ready."
        )

    def _format_upcoming_lives_notification(self) -> str:
        """Summarize pre-assigned and auto-assigned lives in the next 4 weeks."""
        if not self.player_group:
            return "No managed group is set yet."
        horizon = self.current_date + timedelta(days=28)
        rows: list[dict] = []
        for live in self._get_saved_managed_group_lives():
            live_date = self._parse_live_entry_date(live)
            if live_date is None or live_date < self.current_date or live_date > horizon:
                continue
            rows.append(live)
        rows.sort(key=lambda item: (str(item.get("start_date") or ""), str(item.get("start_time") or "")))
        if not rows:
            return "No pre-assigned or auto-assigned managed-group lives are scheduled in the next 4 weeks."
        preview = []
        for live in rows[:4]:
            when = str(live.get("start_date") or "")
            label = str(live.get("title") or live.get("live_type") or "Live")
            venue = str(live.get("venue_name") or live.get("venue") or live.get("location") or "").strip()
            if venue:
                preview.append(f"{when}: {label} at {venue}")
            else:
                preview.append(f"{when}: {label}")
        body = f"{len(rows)} managed-group live(s) are already assigned in the next 4 weeks. " + " | ".join(preview)
        if len(rows) > 4:
            body += f" | +{len(rows) - 4} more on the calendar."
        return body

    def _format_opening_room_message(self) -> str:
        """Flavor message for the start of a new managed run."""
        if not self.player_group:
            return "The office is quiet. No managed roster is set yet."
        return (
            f"The practice room feels tense but hopeful this morning. "
            f"{self.player_group.name or self.player_group.name_romanji} are waiting for direction, "
            f"and the early mood suggests they want a plan they can trust."
        )

    def _format_opening_staff_message(self) -> str:
        """Flavor + practical startup note from staff."""
        if not self.player_group:
            return "Staff briefing is waiting for a managed roster."
        return (
            f"Staff note: focus the first week on stability, punctual rehearsals, and visible small wins. "
            f"If the members feel the routine is clear, morale should settle before the first heavy stretch of lives."
        )

    def _seed_startup_inbox_if_needed(self, from_disk_reload: bool = False) -> None:
        """Create opening guidance notifications for a new or legacy save."""
        if from_disk_reload:
            return
        if not self.player_group:
            return
        raw_has_inbox = "inbox" in self._raw_game_save
        applied, _names = self._ensure_default_training_plan_for_managed_group()
        if raw_has_inbox and self._notifications:
            return

        self._add_notification(
            "Welcome to your managed roster",
            self._format_member_overview_notification(),
            sender="Assistant",
            category="guidance",
            level="high",
            date_value=self.current_date,
            dedupe_key=f"startup-roster|{getattr(self.player_group, 'uid', '')}|{self.current_date.isoformat()}",
        )
        self._add_notification(
            "Training defaults need review",
            self._format_training_defaults_notification(applied),
            sender="Assistant",
            category="guidance",
            level="high",
            date_value=self.current_date,
            dedupe_key=f"startup-training|{getattr(self.player_group, 'uid', '')}|{self.current_date.isoformat()}",
        )
        self._add_notification(
            "Upcoming lives for the next 4 weeks",
            self._format_upcoming_lives_notification(),
            sender="Assistant",
            category="guidance",
            level="high",
            date_value=self.current_date,
            dedupe_key=f"startup-lives|{getattr(self.player_group, 'uid', '')}|{self.current_date.isoformat()}",
        )
        self._add_notification(
            "Morning atmosphere in the room",
            self._format_opening_room_message(),
            sender="News",
            category="background",
            level="normal",
            date_value=self.current_date,
            dedupe_key=f"startup-room|{getattr(self.player_group, 'uid', '')}|{self.current_date.isoformat()}",
        )
        self._add_notification(
            "Staff briefing before opening week",
            self._format_opening_staff_message(),
            sender="Assistant",
            category="background",
            level="normal",
            date_value=self.current_date,
            dedupe_key=f"startup-staff|{getattr(self.player_group, 'uid', '')}|{self.current_date.isoformat()}",
        )

    def _seed_daily_inbox_for_date(self, target_date: date) -> None:
        """Generate simple unread day-of notifications for notable events."""
        if not self.player_group:
            return
        todays_lives: list[dict] = []
        for live in self._get_saved_managed_group_lives():
            live_date = self._parse_live_entry_date(live)
            if live_date == target_date:
                todays_lives.append(live)
        if todays_lives:
            todays_lives.sort(key=lambda item: (str(item.get("start_time") or ""), str(item.get("title") or "")))
            preview = []
            for live in todays_lives[:3]:
                label = str(live.get("title") or live.get("live_type") or "Live")
                start_time = str(live.get("start_time") or "")
                preview.append(f"{start_time} {label}".strip())
            body = f"You have {len(todays_lives)} managed-group live(s) today. " + " | ".join(preview)
            if len(todays_lives) > 3:
                body += f" | +{len(todays_lives) - 3} more."
            self._add_notification(
                "Today's live schedule",
                body,
                sender="Assistant",
                category="confirmation",
                level="critical",
                date_value=target_date,
                dedupe_key=f"daily-lives|{getattr(self.player_group, 'uid', '')}|{target_date.isoformat()}",
                requires_confirmation=True,
            )
        self._add_notification(
            "Producer desk memo",
            "Keep an eye on member energy, room mood, and how cleanly the day is paced. Small adjustments early usually prevent bigger problems by evening.",
            sender="Assistant",
            category="background",
            level="low",
            date_value=target_date,
            dedupe_key=f"daily-memo|{getattr(self.player_group, 'uid', '')}|{target_date.isoformat()}",
        )

    def _scenario_event_targets_managed_group(self, event: dict[str, Any]) -> bool:
        """Return whether a scenario event applies to the player's current group."""
        if not self.player_group or not isinstance(event, dict):
            return False
        group_uid = str(event.get("group_uid") or "")
        player_uid = str(getattr(self.player_group, "uid", "") or "")
        if group_uid:
            return group_uid == player_uid
        group_name = str(event.get("group_name") or "").strip()
        return bool(group_name) and group_name == str(getattr(self.player_group, "name", "") or "").strip()

    def _resolve_managed_group_leave_choices(self) -> tuple[list[dict[str, Any]], list[dict[str, Any]], bool]:
        """Gate scheduled managed-group departures behind an inbox decision."""
        if not self.player_group or not self._scenario_future_events:
            return list(self._scenario_future_events), [], False

        kept_events: list[dict[str, Any]] = []
        deferred_events: list[dict[str, Any]] = []
        changed = False
        for event in self._scenario_future_events:
            if not isinstance(event, dict):
                continue
            event_type = str(event.get("type") or "")
            effective_date = None
            try:
                effective_date = date.fromisoformat(str(event.get("effective_date") or "").split("T")[0])
            except ValueError:
                effective_date = None
            if (
                event_type != "idol_leave_group"
                or effective_date is None
                or effective_date > self.current_date
                or not self._scenario_event_targets_managed_group(event)
            ):
                kept_events.append(copy.deepcopy(event))
                continue

            idol_name = str(event.get("idol_name") or "This member").strip()
            group_name = str(event.get("group_name") or getattr(self.player_group, "name", "the group")).strip()
            dedupe_key = f"scenario-leave-choice|{str(event.get('uid') or '')}"
            existing_notice = self._find_notification_by_dedupe_key(dedupe_key)
            if existing_notice is None:
                self._add_notification(
                    f"Departure decision: {idol_name}",
                    f"{idol_name} is scheduled to leave {group_name} on {effective_date.isoformat()}. Decide whether to keep her in the group or allow the departure.",
                    sender="Management",
                    category="decision",
                    level="critical",
                    date_value=self.current_date,
                    dedupe_key=dedupe_key,
                    requires_confirmation=True,
                    choice_kind="managed_group_leave",
                    choice_status="pending",
                    choice_options=[
                        {"value": "keep", "label": "Keep in group"},
                        {"value": "let_go", "label": "Allow leave"},
                    ],
                    related_event_uid=str(event.get("uid") or ""),
                )
                changed = True
                deferred_events.append(copy.deepcopy(event))
                continue

            choice_status = str(existing_notice.get("choice_status") or "pending")
            if choice_status == "keep":
                self._add_notification(
                    f"Retention decision: {idol_name}",
                    f"You chose to keep {idol_name} in {group_name}, so the scheduled departure was cancelled.",
                    sender="Assistant",
                    category="internal",
                    level="high",
                    date_value=self.current_date,
                    dedupe_key=f"scenario-keep|{str(event.get('uid') or '')}",
                )
                changed = True
                continue
            if choice_status != "let_go":
                deferred_events.append(copy.deepcopy(event))
                continue

            kept_events.append(copy.deepcopy(event))
        return kept_events, deferred_events, changed

    def _apply_scenario_future_events_for_current_date(self) -> None:
        """Apply due scenario events to the save-owned snapshot and refresh runtime data."""
        if not self._scenario_future_events:
            return
        snapshot = self._game_save_payload.get("database_snapshot")
        if not isinstance(snapshot, dict):
            return
        idols_payload = snapshot.get("idols")
        groups_payload = snapshot.get("groups")
        if not isinstance(idols_payload, list) or not isinstance(groups_payload, list):
            return

        chosen_events, deferred_events, choice_changed = self._resolve_managed_group_leave_choices()
        new_idols, new_groups, remaining_events, applied_events = apply_due_future_events(
            idols_payload,
            groups_payload,
            chosen_events,
            as_of=self.current_date,
        )
        combined_remaining_events = [copy.deepcopy(item) for item in remaining_events if isinstance(item, dict)]
        combined_remaining_events.extend(copy.deepcopy(item) for item in deferred_events if isinstance(item, dict))
        combined_remaining_events.sort(key=lambda item: (str(item.get("effective_date") or ""), str(item.get("type") or ""), str(item.get("uid") or "")))
        if not applied_events and combined_remaining_events == self._scenario_future_events and not choice_changed:
            return

        snapshot["idols"] = new_idols
        snapshot["groups"] = new_groups
        self._scenario_future_events = combined_remaining_events
        self._game_save_payload["scenario_runtime"] = {
            "future_events": [copy.deepcopy(item) for item in self._scenario_future_events],
        }
        self._reload_runtime_database_from_snapshot()
        for event in applied_events:
            title, body = describe_applied_event(event)
            event_type = str(event.get("type") or "")
            detail = event.get("detail") if isinstance(event.get("detail"), dict) else {}
            requires_confirmation = event_type == "idol_leave_group" or (event_type == "idol_status_update" and str(detail.get("kind") or "") == "scandal")
            self._add_notification(
                title,
                body,
                sender="News",
                category="confirmation" if requires_confirmation else "news",
                level="critical" if requires_confirmation else "normal",
                date_value=self.current_date,
                dedupe_key=f"scenario-event|{str(event.get('uid') or '')}",
                requires_confirmation=requires_confirmation,
            )
        self._scenario_runtime_dirty = True

    def _seed_previous_day_reports(
        self,
        previous_date: date,
        *,
        status_updates: Optional[list[dict[str, Any]]] = None,
        finance_breakdown: Optional[dict[str, Any]] = None,
    ) -> None:
        """Create next-day internal news for yesterday's lives, status changes, and finances."""
        next_day = self.current_date

        yesterday_results = [
            live for live in self._get_saved_managed_group_live_results()
            if self._parse_live_entry_date(live) == previous_date
        ]
        for live in yesterday_results:
            if bool(live.get("report_generated_same_day")):
                continue
            title_seed = str(live.get("title") or live.get("live_type") or "Live")
            title_prefix = "Festival report" if str(live.get("live_type") or live.get("event_type") or "") == "Festival" else "Live report"
            member_lines = []
            for row in (live.get("member_deltas") or [])[:3]:
                if not isinstance(row, dict):
                    continue
                member_lines.append(
                    f"{str(row.get('name') or 'Member')}: rate {row.get('performance_rating', '—')}, fans {row.get('fan_gain', 0):+d}, morale {row.get('morale_gain', 0):+d}"
                )
            body = (
                f"Yesterday's {title_seed} finished with performance {live.get('performance_score', '—')} "
                f"and satisfaction {live.get('audience_satisfaction', '—')}. "
                f"Attendance {live.get('attendance', 0)}, fan change {int(live.get('group_fan_gain', live.get('fan_gain', 0)) or 0):+d}."
            )
            if member_lines:
                body += " " + " | ".join(member_lines)
            self._add_notification(
                f"{title_prefix}: {title_seed}",
                body,
                sender="Operations",
                category="internal",
                level="normal",
                date_value=next_day,
                dedupe_key=f"live-report|{str(live.get('uid') or '')}|{next_day.isoformat()}",
            )

        status_updates = status_updates or []
        changed_members = []
        for update in status_updates:
            if not isinstance(update, dict):
                continue
            delta = update.get("delta") or {}
            if not isinstance(delta, dict):
                continue
            if any(int(delta.get(key, 0) or 0) != 0 for key in ("condition", "morale")):
                changed_members.append(
                    f"{str(update.get('idol_name') or 'Member')}: Condition {int(delta.get('condition', 0) or 0):+d}, Morale {int(delta.get('morale', 0) or 0):+d}"
                )
        if changed_members:
            self._add_notification(
                "Member condition update",
                " | ".join(changed_members[:5]),
                sender="Management",
                category="internal",
                level="normal",
                date_value=next_day,
                dedupe_key=f"status-report|{previous_date.isoformat()}",
            )

        if finance_breakdown:
            income_total = int(finance_breakdown.get("income_total", 0) or 0)
            expense_total = int(finance_breakdown.get("expense_total", 0) or 0)
            net_total = int(finance_breakdown.get("net_total", 0) or 0)
            cash_now = int((self._finances or {}).get("cash_yen", 0) or 0)
            body = (
                f"Income ¥{income_total:,}, expenses ¥{expense_total:,}, net {net_total:+,} yen. "
                f"Cash on hand is now ¥{cash_now:,}."
            )
            self._add_notification(
                "Daily finance close",
                body,
                sender="Finance",
                category="internal",
                level="normal",
                date_value=next_day,
                dedupe_key=f"finance-close|{previous_date.isoformat()}",
            )

    def _shortlist_idol_from_scout(self, idol: Idol) -> bool:
        """Add an idol to shortlist if not already present."""
        uid = getattr(idol, "uid", None)
        if not uid:
            return False
        if any(getattr(existing, "uid", None) == uid for existing in self.shortlisted_idols):
            return False
        self.shortlisted_idols.append(idol)
        self.refresh_shortlist_sidebar()
        self._persist_game_save()
        return True

    def _sign_scout_audition_candidate(self, company: ScoutCompany, candidate_uid: str) -> Optional[Idol]:
        """Convert a held audition candidate into a runtime idol and shortlist them."""
        candidates = self._get_saved_auditions_for_company(company)
        candidate = next((row for row in candidates if str(row.get("uid")) == str(candidate_uid)), None)
        if not candidate:
            return None

        signed_uid = str(candidate.get("signed_idol_uid") or "")
        if signed_uid:
            idol = next((item for item in self.idols if getattr(item, "uid", None) == signed_uid), None)
            if idol is not None:
                self._shortlist_idol_from_scout(idol)
                return idol

        existing_idol_uid = str(candidate.get("existing_idol_uid") or "")
        if existing_idol_uid:
            idol = next((item for item in self.idols if getattr(item, "uid", None) == existing_idol_uid), None)
            if idol is None:
                return None
            candidate["signed_idol_uid"] = idol.uid
            candidate["signed_on"] = self.current_date.isoformat()
            auditions = self._scout_state.setdefault("auditions", {})
            if isinstance(auditions, dict):
                key = self._scout_audition_key(company)
                existing_rows = auditions.get(key, [])
                updated_rows: list[dict] = []
                for row in existing_rows if isinstance(existing_rows, list) else []:
                    if not isinstance(row, dict):
                        continue
                    if str(row.get("uid")) == str(candidate_uid):
                        updated_rows.append(dict(candidate))
                    else:
                        updated_rows.append(dict(row))
                auditions[key] = updated_rows
            self._shortlist_idol_from_scout(idol)
            self._add_notification(
                f"Signing confirmation: {idol.name}",
                f"{idol.name} was added to your scout shortlist. Confirm this signing before advancing the day.",
                sender="Scout Desk",
                category="confirmation",
                level="critical",
                date_value=self.current_date,
                dedupe_key=f"signing-confirm|{idol.uid}|{self.current_date.isoformat()}",
                requires_confirmation=True,
            )
            self._persist_game_save()
            return idol

        idol = audition_candidate_to_idol(candidate)
        self.idols.append(idol)
        candidate["signed_idol_uid"] = idol.uid
        candidate["signed_on"] = self.current_date.isoformat()

        auditions = self._scout_state.setdefault("auditions", {})
        if isinstance(auditions, dict):
            key = self._scout_audition_key(company)
            existing_rows = auditions.get(key, [])
            updated_rows: list[dict] = []
            for row in existing_rows if isinstance(existing_rows, list) else []:
                if not isinstance(row, dict):
                    continue
                if str(row.get("uid")) == str(candidate_uid):
                    updated_rows.append(dict(candidate))
                else:
                    updated_rows.append(dict(row))
            auditions[key] = updated_rows

        self._shortlist_idol_from_scout(idol)
        self._add_notification(
            f"Signing confirmation: {idol.name}",
            f"{idol.name} was added to your scout shortlist as a new freelancer. Confirm this signing before advancing the day.",
            sender="Scout Desk",
            category="confirmation",
            level="critical",
            date_value=self.current_date,
            dedupe_key=f"signing-confirm|{idol.uid}|{self.current_date.isoformat()}",
            requires_confirmation=True,
        )
        self._persist_game_save()
        return idol

    def _load_active_scenario_report(self) -> dict:
        """Read sibling scenario report.json when using a generated scenario snapshot."""
        idols_path, _groups_path = get_active_data_sources()
        report_path = idols_path.parent / "report.json"
        try:
            if report_path.is_file():
                with open(report_path, "r", encoding="utf-8") as handle:
                    data = json.load(handle)
                return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            pass
        return {}

    def _load_idol_info_lookup(self) -> dict[str, dict]:
        """Load optional idols_info.json so finance calculations can use scenario wages."""
        idols_path, _groups_path = get_active_data_sources()
        info_path = idols_path.parent / "idols_info.json"
        lookup: dict[str, dict] = {}
        try:
            if not info_path.is_file():
                return {}
            with open(info_path, "r", encoding="utf-8") as handle:
                payload = json.load(handle)
        except (OSError, json.JSONDecodeError, UnicodeDecodeError):
            return {}

        if not isinstance(payload, list):
            return {}
        for row in payload:
            if not isinstance(row, dict):
                continue
            uid = row.get("uid")
            if uid:
                lookup[str(uid)] = row
        return lookup

    def _get_scenario_starting_cash(self) -> int:
        """Use scenario report metadata when available, otherwise fall back to default tiers."""
        scenario_number = self._scenario_report.get("scenario_number") if isinstance(self._scenario_report, dict) else None
        try:
            return FinanceSystem.scenario_starting_cash(int(scenario_number)) if scenario_number is not None else FinanceSystem.DEFAULT_STARTING_CASH
        except (TypeError, ValueError):
            return FinanceSystem.DEFAULT_STARTING_CASH

    def _get_member_monthly_wage(self, idol: Idol) -> int:
        """Look up scenario wage for an idol; fall back to the loaded idol object."""
        uid = str(getattr(idol, "uid", "") or "")
        row = self._idol_info_lookup.get(uid, {})
        value = row.get("monthly_wage", getattr(idol, "monthly_wage", FinanceSystem.AVERAGE_MONTHLY_BASE_SALARY))
        try:
            return max(0, int(value))
        except (TypeError, ValueError):
            fallback = getattr(idol, "monthly_wage", FinanceSystem.AVERAGE_MONTHLY_BASE_SALARY)
            return max(0, int(fallback or FinanceSystem.AVERAGE_MONTHLY_BASE_SALARY))

    def _estimate_group_fans(self) -> int:
        """Prefer explicit group fan totals, then aggregate member fan counts, then use popularity fallback."""
        if not self.player_group:
            return 0
        if getattr(self.player_group, "fans", None):
            try:
                return max(0, int(self.player_group.fans))
            except (TypeError, ValueError):
                pass
        member_fans = sum(max(0, int(getattr(idol, "fan_count", 0) or 0)) for idol in self.player_group.members)
        if member_fans > 0:
            return member_fans
        popularity = getattr(self.player_group, "popularity", None)
        try:
            return max(1500, int(popularity or 0) * 500)
        except (TypeError, ValueError):
            return 1500

    def _estimate_group_popularity(self) -> int:
        """Prefer group popularity, then the average current-member popularity."""
        if not self.player_group:
            return 0
        if getattr(self.player_group, "popularity", None) is not None:
            try:
                return max(0, min(100, int(self.player_group.popularity)))
            except (TypeError, ValueError):
                pass
        values = [int(getattr(idol, "popularity", 0) or 0) for idol in self.player_group.members]
        return max(0, min(100, int(sum(values) / len(values)))) if values else 0

    def _estimate_group_x_followers(self) -> int:
        """Use member X totals as a proxy until group social accounts are modeled separately."""
        if not self.player_group:
            return 0
        total = sum(max(0, int(getattr(idol, "x_followers", 0) or 0)) for idol in self.player_group.members)
        return total

    def _build_live_finance_stats(self, target_date: date) -> dict[str, int]:
        """Estimate live-day extra revenue/cost from post-live tokutenkai sessions."""
        stats = {
            "live_count": 0,
            "tokutenkai_revenue": 0,
            "tokutenkai_cost": 0,
            "live_venue_fee_total": 0,
        }
        for raw_live in self._get_player_group_operational_lives_for_date(target_date):
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            stats["live_count"] += 1
            stats["live_venue_fee_total"] += FinanceSystem.estimate_venue_fee(live.get("capacity"))
            if not bool(live.get("tokutenkai_enabled")):
                continue
            ticket_count = live.get("tokutenkai_actual_tickets")
            if ticket_count is None:
                ticket_count = live.get("tokutenkai_expected_tickets")
            ticket_count = max(0, int(ticket_count or 0))
            ticket_price = max(0, int(self._tokutenkai_effective_ticket_price_yen(live)))
            session_cost = int(2500 + (ticket_count * 140) + (len(self.player_group.members) * 700))
            stats["tokutenkai_revenue"] += ticket_count * ticket_price
            stats["tokutenkai_cost"] += session_cost
        return stats

    def _build_daily_finance_breakdown(self, target_date: date) -> dict:
        """Compute one day of income/expense activity for the managed group."""
        members = self.player_group.members if self.player_group else []
        monthly_salary_total = sum(self._get_member_monthly_wage(idol) for idol in members)
        live_stats = self._build_live_finance_stats(target_date)
        return FinanceSystem.build_daily_breakdown(
            target_date=target_date,
            member_count=len(members),
            popularity=self._estimate_group_popularity(),
            fans=self._estimate_group_fans(),
            x_followers=self._estimate_group_x_followers(),
            monthly_salary_total=monthly_salary_total,
            live_count=live_stats["live_count"],
            tokutenkai_revenue=live_stats["tokutenkai_revenue"],
            tokutenkai_cost=live_stats["tokutenkai_cost"],
            live_venue_fee_total=live_stats["live_venue_fee_total"],
        )

    def _build_planned_finance_window(self, start_date: date, horizon_days: int = 30) -> dict[str, object]:
        """Project the next set of days using the current managed-group plan."""
        try:
            total_days = max(1, int(horizon_days))
        except (TypeError, ValueError):
            total_days = 30

        cash_now = int((self._finances or {}).get("cash_yen", 0))
        end_date = start_date + timedelta(days=total_days - 1)
        summary: dict[str, object] = {
            "start_date": start_date.isoformat(),
            "end_date": end_date.isoformat(),
            "income_total": 0,
            "expense_total": 0,
            "net_total": 0,
            "live_count": 0,
            "tokutenkai_revenue": 0,
            "tokutenkai_cost": 0,
            "live_venue_fee": 0,
            "salary_days": [],
            "upcoming_lives": [],
            "cash_end": cash_now,
        }

        cursor = start_date
        while cursor <= end_date:
            breakdown = self._build_daily_finance_breakdown(cursor)
            summary["income_total"] += int(breakdown.get("income_total", 0))
            summary["expense_total"] += int(breakdown.get("expense_total", 0))
            summary["net_total"] += int(breakdown.get("net_total", 0))
            summary["tokutenkai_revenue"] += int(breakdown.get("tokutenkai_revenue", 0))
            summary["tokutenkai_cost"] += int(breakdown.get("tokutenkai_cost", 0))
            summary["live_venue_fee"] += int(breakdown.get("live_venue_fee", 0))
            if int(breakdown.get("salaries", 0) or 0) > 0:
                salary_days = summary.get("salary_days")
                if isinstance(salary_days, list):
                    salary_days.append(cursor.isoformat())
            day_lives = self._get_player_group_operational_lives_for_date(cursor)
            summary["live_count"] += len(day_lives)
            for raw_live in day_lives:
                live = self._normalize_live_entry(raw_live)
                if live:
                    upcoming_lives = summary.get("upcoming_lives")
                    if isinstance(upcoming_lives, list):
                        upcoming_lives.append(live)
            cursor += timedelta(days=1)

        summary["cash_end"] = cash_now + int(summary["net_total"])
        return summary

    def _ensure_finances_ready(self) -> None:
        """Initialize and catch up finance history through the day before current_date."""
        if not getattr(self, "_data_loaded", False):
            return
        if not self._scenario_report:
            self._scenario_report = self._load_active_scenario_report()
        if not self._idol_info_lookup:
            self._idol_info_lookup = self._load_idol_info_lookup()

        start_cash = self._get_scenario_starting_cash()
        self._finances = FinanceSystem.normalize_finances(self._finances, start_cash)
        for day in FinanceSystem.iter_unprocessed_dates(
            self._finances.get("last_processed_date"),
            self.current_date,
            self.game_start_date,
        ):
            breakdown = self._build_daily_finance_breakdown(day)
            self._finances = FinanceSystem.apply_daily_close(self._finances, breakdown)

    def _close_financial_day(self, target_date: date) -> None:
        """Settle exactly one in-game day into the finance ledger."""
        self._ensure_finances_ready()
        last_processed = self._finances.get("last_processed_date")
        if last_processed == target_date.isoformat():
            return
        breakdown = self._build_daily_finance_breakdown(target_date)
        self._finances = FinanceSystem.apply_daily_close(self._finances, breakdown)

    def _shortlist_matches_member_set_only(self) -> bool:
        """True when shortlist is exactly the managed group's member set (order ignored)."""
        if not self.player_group:
            return len(self.shortlisted_idols) == 0
        mu = {m.uid for m in self.player_group.members if getattr(m, "uid", None)}
        su = {i.uid for i in self.shortlisted_idols if getattr(i, "uid", None)}
        return su == mu

    def _build_save_payload(self) -> dict:
        """Assemble JSON-serializable state for GameSave.write."""
        schedules_out: dict[str, list] = {}
        for date_key, rows in self._schedule_save_overrides.items():
            schedules_out[date_key] = [dict(r) for r in rows]

        mg = None
        mg_uid = None
        if self.player_group:
            mg = self.player_group.name_romanji or self.player_group.name
            mg_uid = str(getattr(self.player_group, "uid", "") or "")

        payload: dict = {
            "version": GameSave.VERSION,
            "player_name": str(self.player_name or "").strip(),
            "managing_group": mg,
            "managing_group_uid": mg_uid,
            "scenario_context": self._build_save_context(),
            "database_snapshot": self._build_database_snapshot_payload(),
            "scenario_runtime": {
                "future_events": [copy.deepcopy(item) for item in self._scenario_future_events if isinstance(item, dict)],
            },
            "current_date": self.current_date.isoformat(),
            "game_start_date": self.game_start_date.isoformat(),
            "turn_number": int(self.turn_number),
            "schedules": schedules_out,
            "lives": {
                "schedules": list(self._live_schedules),
                "results": list(self._live_results),
            },
            "finances": dict(self._finances) if self._finances else GameSave.default_finances(),
            "training_intensity": {uid: dict(cols) for uid, cols in self._training_intensity.items()},
            "training_week_log": normalize_training_week_log(self._training_week_log),
            "training_focus_skill": dict(self._training_focus_skill),
            "scout": copy.deepcopy(self._scout_state),
            "inbox": {
                "notifications": [copy.deepcopy(item) for item in self._notifications if isinstance(item, dict)],
            },
        }
        if not self._shortlist_matches_member_set_only():
            payload["shortlist"] = [i.uid for i in self.shortlisted_idols if getattr(i, "uid", None)]
        return payload

    def _persist_game_save(self) -> bool:
        """Write current game state to the active save file. Returns False if skipped or on error."""
        if not getattr(self, "_data_loaded", False):
            return False
        try:
            self._game_save.write(self._build_save_payload())
            return True
        except OSError:
            return False

    def _persist_game_save_to_path(self, path: str, *, make_active: bool = False) -> bool:
        """Write current game state to a specific save file path."""
        if not getattr(self, "_data_loaded", False):
            return False
        try:
            payload = self._build_save_payload()
            target_save = GameSave(path)
            target_save.write(payload)
        except OSError:
            return False

        if make_active:
            self._game_save = target_save
            self._raw_game_save = copy.deepcopy(payload)
            self._game_save_payload = GameSave.normalize_payload(copy.deepcopy(payload))
        return True

    def _normalize_todo_from_save(self, raw: object) -> Optional[dict]:
        """Ensure a schedule row has all fields the UI expects."""
        if not isinstance(raw, dict):
            return None
        gl = self.player_group.name_romanji or self.player_group.name if self.player_group else "Group"
        return {
            "time": str(raw.get("time") or "12:00"),
            "title": str(raw.get("title") or "Event"),
            "detail": str(raw.get("detail") or ""),
            "category": str(raw.get("category") or "Event"),
            "source_id": str(raw.get("source_id") or "group"),
            "source_label": str(raw.get("source_label") or gl),
            "source_color": str(raw.get("source_color") or self.colors["accent"]),
        }

    def _get_todos_for_date(self, target_date: date) -> list[dict]:
        """Generate or return cached daily todos for a specific date."""
        cache_key = target_date.isoformat()
        if cache_key in self._daily_todos_cache:
            return self._daily_todos_cache[cache_key]

        if cache_key in self._schedule_save_overrides:
            todos = []
            for raw in self._schedule_save_overrides[cache_key]:
                row = self._normalize_todo_from_save(raw)
                if row:
                    todos.append(row)
            todos.sort(key=lambda item: item["time"])
            self._daily_todos_cache[cache_key] = todos
            return todos

        if target_date > self.current_date:
            future_todos: list[dict] = []
            for live in self._get_player_group_lives_for_date(target_date):
                future_todos.extend(self._build_live_todos(live))
            future_todos.sort(key=lambda item: self._parse_time_block(item["time"])[0])
            self._daily_todos_cache[cache_key] = future_todos
            return future_todos

        group_label = self.player_group.name_romanji or self.player_group.name if self.player_group else "Group"
        todos: list[dict] = []

        birthday_matches = []
        tracked_idols = self.player_group.members if self.player_group else []
        for idol in tracked_idols:
            if idol.birthday and (idol.birthday.month, idol.birthday.day) == (target_date.month, target_date.day):
                birthday_matches.append(idol)
                continue

            partial = self._parse_partial_birthday(idol.birthday_partial)
            if partial and partial == (target_date.month, target_date.day):
                birthday_matches.append(idol)

        for idol in sorted(birthday_matches, key=lambda value: value.name)[:4]:
            todos.append(
                {
                    "time": "08:00",
                    "title": f"{idol.name} birthday spotlight",
                    "detail": "Schedule a celebratory post and keep a morale boost in the day's plan.",
                    "category": "Event",
                    "source_id": f"idol:{idol.uid}",
                    "source_label": idol.name,
                    "source_color": self.colors["yellow"],
                }
            )

        groups = [self.player_group] if self.player_group else []
        for group in groups:
            if group.formed_date:
                try:
                    formed = date.fromisoformat(group.formed_date)
                    if (formed.month, formed.day) == (target_date.month, target_date.day):
                        years = target_date.year - formed.year
                        milestone = f"{years} year milestone" if years > 0 else "Debut day milestone"
                        todos.append(
                            {
                                "time": "12:00",
                                "title": f"{group.name} anniversary",
                                "detail": f"{milestone}. Good day for commemorative content and a focused fan push.",
                                "category": "Anniversary",
                                "source_id": "group",
                                "source_label": group_label,
                                "source_color": self.colors["accent"],
                            }
                        )
                except ValueError:
                    pass

            visible_songs = [song for song in list(group.songs or []) if not bool(getattr(song, "hidden", False))]
            for song in visible_songs[:8]:
                release_date = getattr(song, "release_date", None)
                if release_date and (release_date.month, release_date.day) == (target_date.month, target_date.day):
                    todos.append(
                        {
                            "time": "13:00",
                            "title": f"{group.name} release anniversary",
                            "detail": f"Revisit {song.title} in socials, playlisting, or fan messaging.",
                            "category": "Music",
                            "source_id": "group",
                            "source_label": group_label,
                            "source_color": self.colors["accent"],
                        }
                    )

        for live in self._get_player_group_lives_for_date(target_date):
            todos.extend(self._build_live_todos(self._normalize_live_entry(live) or live))

        todos.extend(self._get_member_schedule_items_for_date(target_date))

        todos.sort(key=lambda item: self._parse_time_block(item["time"])[0])
        self._daily_todos_cache[cache_key] = todos
        return todos

    def _build_todo_card(self, parent, todo: dict, wraplength: int = 820):
        """Render a single todo card."""
        card = tk.Frame(
            parent,
            bg=self.colors['bg_card'],
            bd=1,
            relief=tk.FLAT,
            highlightthickness=1,
            highlightbackground=self.colors['border'],
        )
        card.pack(fill=tk.X, pady=8)

        time_label = tk.Label(
            card,
            text=todo["time"],
            bg=self.colors['accent'],
            fg=self.colors['text_primary'],
            font=('Arial', 10, 'bold'),
            width=10,
            pady=10,
        )
        time_label.pack(side=tk.LEFT, fill=tk.Y)

        detail_frame = tk.Frame(card, bg=self.colors['bg_card'])
        detail_frame.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, padx=16, pady=12)

        tk.Label(
            detail_frame,
            text=todo["title"],
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            anchor="w",
            font=('Arial', 12, 'bold'),
        ).pack(fill=tk.X)

        tk.Label(
            detail_frame,
            text=todo["detail"],
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            anchor="w",
            justify=tk.LEFT,
            wraplength=wraplength,
            font=('Arial', 10),
        ).pack(fill=tk.X, pady=(6, 4))

        tk.Label(
            detail_frame,
            text=todo["category"].upper(),
            bg=self.colors['bg_card'],
            fg=self.colors['yellow'],
            anchor="w",
            font=('Arial', 9, 'bold'),
        ).pack(fill=tk.X)

    def _build_today_status_strip(self, parent) -> None:
        """Show current managed-idol condition cards on the Today screen."""
        idols = self._get_managed_idols()
        if not idols:
            return

        section = tk.Frame(parent, bg=self.colors['bg_content'])
        section.pack(fill=tk.X, pady=(0, 18))

        tk.Label(
            section,
            text="Managed Idol Status",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 16, 'bold'),
        ).pack(anchor="w", pady=(0, 10))

        row = tk.Frame(section, bg=self.colors['bg_content'])
        row.pack(fill=tk.X)

        for idol in idols[:8]:
            status = summarize_status(idol)
            trend = self._weekly_trend_for_idol(idol)
            card = tk.Frame(
                row,
                bg=self.colors['bg_card'],
                highlightthickness=1,
                highlightbackground=self.colors['border'],
                padx=12,
                pady=10,
            )
            card.pack(side=tk.LEFT, padx=(0, 10), fill=tk.Y)
            tk.Label(card, text=idol.name, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 10, 'bold')).pack(anchor="w")
            tk.Label(card, text=str(status["condition"]).upper(), bg=self.colors['bg_card'], fg=status["condition_color"], font=('Arial', 9, 'bold')).pack(anchor="w", pady=(6, 0))
            tk.Label(card, text=str(status["availability"]), bg=self.colors['bg_card'], fg=status["availability_color"], font=('Arial', 9)).pack(anchor="w", pady=(2, 6))
            tk.Label(
                card,
                text=f"C {status['condition_value']}/{status['condition_cap']}  M {status['morale']}",
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                font=('Arial', 9),
            ).pack(anchor="w")
            tk.Label(
                card,
                text=self._weekly_trend_text(trend),
                bg=self.colors['bg_card'],
                fg=trend.get("physical", {}).get("color", self.colors["text_secondary"]),
                font=('Arial', 8),
            ).pack(anchor="w", pady=(4, 0))

    def _format_notification_delta(self, value: object) -> str:
        """Format one stat delta with a directional arrow."""
        try:
            amount = int(value or 0)
        except (TypeError, ValueError):
            amount = 0
        if amount > 0:
            return f"↑{amount}"
        if amount < 0:
            return f"↓{abs(amount)}"
        return "→0"

    def _render_notification_key_value_rows(self, parent, rows: list[tuple[str, str]]) -> None:
        """Render compact labeled rows inside the inbox detail area."""
        for label, value in rows:
            row = tk.Frame(parent, bg=parent.cget("bg"))
            row.pack(fill=tk.X, pady=(0, 6))
            tk.Label(
                row,
                text=f"{label}:",
                bg=parent.cget("bg"),
                fg=self.colors["text_primary"],
                font=("Arial", 10, "bold"),
                width=16,
                anchor="w",
            ).pack(side=tk.LEFT)
            tk.Label(
                row,
                text=value,
                bg=parent.cget("bg"),
                fg=self.colors["text_secondary"],
                font=("Arial", 10),
                justify=tk.LEFT,
                anchor="w",
                wraplength=760,
            ).pack(side=tk.LEFT, fill=tk.X, expand=True)

    def _render_notification_table(self, parent, columns: list[tuple[str, str, int, str]], rows: list[tuple]) -> None:
        """Render a read-only table for structured inbox data."""
        table_frame = tk.Frame(parent, bg=parent.cget("bg"))
        table_frame.pack(fill=tk.X, pady=(6, 0))
        keys = tuple(column[0] for column in columns)
        tree = ttk.Treeview(table_frame, columns=keys, show="headings", height=max(1, min(len(rows), 8)))
        for key, heading, width, anchor in columns:
            tree.heading(key, text=heading)
            tree.column(key, width=width, anchor=anchor, stretch=True)
        scroll = tk.Scrollbar(table_frame, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=scroll.set)
        tree.pack(side=tk.LEFT, fill=tk.X, expand=True)
        scroll.pack(side=tk.RIGHT, fill=tk.Y)
        for row in rows:
            tree.insert("", "end", values=row)
        self.root.after_idle(lambda widget=tree: self.bind_mousewheel(widget, widget))

    def _find_live_for_notification(self, item: dict[str, Any]) -> Optional[dict[str, Any]]:
        """Resolve one live payload from a notification when possible."""
        related_uid = str(item.get("related_event_uid") or "")
        dedupe_key = str(item.get("dedupe_key") or "")
        if not related_uid and dedupe_key.startswith("live-report-start|"):
            parts = dedupe_key.split("|")
            if len(parts) >= 2:
                related_uid = parts[1]
        live_sets = [
            self._get_saved_managed_group_live_results(),
            self._get_saved_managed_group_lives(),
        ]
        for collection in live_sets:
            for live in collection:
                if str(live.get("uid") or "") == related_uid:
                    return live
        return None

    def _estimate_single_live_financials(self, live: dict[str, Any]) -> dict[str, int]:
        """Estimate one live's income and expense summary for inbox reporting."""
        attendance = max(0, int(live.get("attendance") or 0))
        ticket_price = max(0, int(live.get("ticket_price") or 0))
        ticket_income = attendance * ticket_price
        tokutenkai_tickets = max(0, int(live.get("tokutenkai_actual_tickets") or live.get("tokutenkai_expected_tickets") or 0))
        tokutenkai_revenue = tokutenkai_tickets * max(0, int(self._tokutenkai_effective_ticket_price_yen(live)))
        venue_cost = int(FinanceSystem.estimate_venue_fee(live.get("capacity")))
        tokutenkai_cost = 0
        if bool(live.get("tokutenkai_enabled")) and self.player_group:
            tokutenkai_cost = int(2500 + (tokutenkai_tickets * 140) + (len(self.player_group.members) * 700))
        income_total = ticket_income + tokutenkai_revenue
        expense_total = venue_cost + tokutenkai_cost
        return {
            "ticket_income": ticket_income,
            "tokutenkai_revenue": tokutenkai_revenue,
            "venue_cost": venue_cost,
            "tokutenkai_cost": tokutenkai_cost,
            "income_total": income_total,
            "expense_total": expense_total,
            "net_total": income_total - expense_total,
        }

    def _render_live_schedule_notification(self, parent, item: dict[str, Any]) -> bool:
        """Render today's live confirmation in a structured layout."""
        if str(item.get("title") or "") != "Today's live schedule" or not self.player_group:
            return False
        target_date = self.current_date
        try:
            target_date = date.fromisoformat(str(item.get("date") or "").split("T")[0])
        except ValueError:
            pass
        todays_lives = [
            live for live in self._get_saved_managed_group_lives()
            if self._parse_live_entry_date(live) == target_date
        ]
        todays_lives.sort(key=lambda row: (str(row.get("start_time") or ""), str(row.get("title") or "")))
        if not todays_lives:
            return False

        tk.Label(parent, text=f"{len(todays_lives)} live(s) scheduled", bg=parent.cget("bg"), fg=self.colors["text_primary"], font=("Arial", 12, "bold")).pack(anchor="w", pady=(0, 10))
        for live in todays_lives:
            card = tk.Frame(parent, bg=self.colors["accent_light"], padx=12, pady=10)
            card.pack(fill=tk.X, pady=(0, 12))
            tk.Label(card, text=str(live.get("title") or live.get("live_type") or "Live"), bg=self.colors["accent_light"], fg=self.colors["text_primary"], font=("Arial", 12, "bold")).pack(anchor="w")
            rehearsal_start = str(live.get("rehearsal_start") or "").strip()
            rehearsal_end = str(live.get("rehearsal_end") or "").strip()
            rehearsal_text = "None" if not rehearsal_start else (rehearsal_start if not rehearsal_end else f"{rehearsal_start}-{rehearsal_end}")
            info_rows = [
                ("Time", f"{live.get('start_date') or '-'} {self._format_live_slot(live)}"),
                ("Venue", str(live.get("venue") or "TBA")),
                ("Rehearsal", rehearsal_text),
                ("Tokutenkai", self._format_tokutenkai_summary(live)),
            ]
            self._render_notification_key_value_rows(card, info_rows)
            tk.Label(card, text="Setlist", bg=self.colors["accent_light"], fg=self.colors["text_primary"], font=("Arial", 10, "bold")).pack(anchor="w", pady=(8, 4))
            setlist = list(live.get("setlist") or [])
            if setlist:
                for index, song_title in enumerate(setlist, start=1):
                    tk.Label(card, text=f"{index}. {song_title}", bg=self.colors["accent_light"], fg=self.colors["text_secondary"], font=("Arial", 10), anchor="w", justify=tk.LEFT).pack(fill=tk.X)
            else:
                tk.Label(card, text="No setlist recorded.", bg=self.colors["accent_light"], fg=self.colors["text_secondary"], font=("Arial", 10)).pack(anchor="w")

        tk.Label(parent, text="Members", bg=parent.cget("bg"), fg=self.colors["text_primary"], font=("Arial", 12, "bold")).pack(anchor="w", pady=(4, 6))
        member_rows = [
            (
                idol.name,
                int(getattr(idol, "condition", 90) or 90),
                int(getattr(idol, "morale", 50) or 50),
            )
            for idol in list(self.player_group.members or [])
        ]
        self._render_notification_table(
            parent,
            [
                ("member", "Member", 180, "w"),
                ("condition", "Condition", 90, "center"),
                ("morale", "Morale", 80, "center"),
            ],
            member_rows,
        )
        return True

    def _render_live_result_notification(self, parent, item: dict[str, Any]) -> bool:
        """Render a structured live result panel."""
        title_text = str(item.get("title") or "")
        if not (title_text.startswith("Live report:") or title_text.startswith("Festival report:")):
            return False
        live = self._find_live_for_notification(item)
        if not live:
            return False

        finance = self._estimate_single_live_financials(live)
        self._render_notification_key_value_rows(
            parent,
            [
                ("Live", str(live.get("title") or live.get("live_type") or "Live")),
                ("When", f"{live.get('start_date') or '-'} {self._format_live_slot(live)}"),
                ("Venue", str(live.get("venue") or "TBA")),
                ("Setlist", ", ".join(live.get("setlist") or []) or "Not set"),
                ("Score", f"{live.get('performance_score', '—')} / 100"),
                ("Audience", f"{live.get('audience_satisfaction', '—')} / 100"),
                ("Attendance", f"{int(live.get('attendance') or 0):,}"),
                ("Income", f"JPY {finance['income_total']:,}"),
                ("Expense", f"JPY {finance['expense_total']:,}"),
                ("Net", f"JPY {finance['net_total']:+,}"),
            ],
        )

        member_rows = []
        effective_ticket_price = max(0, int(self._tokutenkai_effective_ticket_price_yen(live)))
        for row in (live.get("member_deltas") or []):
            if not isinstance(row, dict):
                continue
            ticket_count = max(0, int(row.get("tokutenkai_tickets") or 0))
            member_rows.append(
                (
                    str(row.get("name") or "Member"),
                    row.get("performance_rating", "—"),
                    f"{int(row.get('condition_after', 0) or 0)} {self._format_notification_delta(row.get('condition_delta'))}",
                    f"{int(row.get('morale_after', 0) or 0)} {self._format_notification_delta(row.get('morale_delta'))}",
                    ticket_count if bool(live.get("tokutenkai_enabled")) else "-",
                    f"JPY {ticket_count * effective_ticket_price:,}" if bool(live.get("tokutenkai_enabled")) else "-",
                )
            )
        tk.Label(parent, text="Members", bg=parent.cget("bg"), fg=self.colors["text_primary"], font=("Arial", 12, "bold")).pack(anchor="w", pady=(12, 6))
        self._render_notification_table(
            parent,
            [
                ("member", "Member", 160, "w"),
                ("score", "Score", 70, "center"),
                ("condition", "Condition", 110, "center"),
                ("morale", "Morale", 110, "center"),
                ("cheki", "Cheki", 70, "center"),
                ("revenue", "Revenue", 100, "e"),
            ],
            member_rows,
        )
        return True

    def _render_notification_detail_content(self, parent, item: dict[str, Any]) -> None:
        """Render structured body content for the selected inbox item."""
        if self._render_live_schedule_notification(parent, item):
            return
        if self._render_live_result_notification(parent, item):
            return
        body_text = str(item.get("body") or "")
        for paragraph in [part.strip() for part in body_text.split("\n") if part.strip()]:
            tk.Label(
                parent,
                text=paragraph,
                bg=parent.cget("bg"),
                fg=self.colors["text_primary"],
                font=("Arial", 11),
                justify=tk.LEFT,
                wraplength=980,
            ).pack(anchor="w", fill=tk.X, pady=(0, 8))

    def _build_notification_card(self, parent, item: dict[str, Any]) -> None:
        """Render one inbox notification row for the left list."""
        level_colors = {
            "critical": self.colors["red"],
            "high": self.colors["yellow"],
            "normal": self.colors["accent_light"],
            "low": self.colors["text_secondary"],
        }
        selected = str(item.get("uid") or "") == self._selected_notification_uid
        bg = self.colors["accent_dark"] if selected else self.colors["bg_card"]
        card = tk.Frame(
            parent,
            bg=bg,
            highlightthickness=1,
            highlightbackground=level_colors.get(str(item.get("level") or "normal"), self.colors["border"]),
            padx=14,
            pady=10,
            cursor="hand2",
        )
        card.pack(fill=tk.X, pady=(0, 10))
        card.bind("<Button-1>", lambda _e, uid=str(item.get("uid") or ""): self._select_notification(uid))

        top = tk.Frame(card, bg=bg)
        top.pack(fill=tk.X)
        status_text = "Unread" if not item.get("read") else "Read"
        tk.Label(
            top,
            text=str(item.get("title") or "Notification"),
            bg=bg,
            fg=self.colors["text_primary"],
            font=("Arial", 11, "bold"),
        ).pack(side=tk.LEFT, anchor="w")
        tk.Label(
            top,
            text=f"{str(item.get('date') or '')}  |  {status_text}",
            bg=bg,
            fg=self.colors["text_secondary"],
            font=("Arial", 9),
        ).pack(side=tk.RIGHT, anchor="e")
        tk.Label(
            card,
            text=str(item.get("sender") or "Assistant").upper(),
            bg=bg,
            fg=self.colors["yellow"] if str(item.get("sender") or "") == "Assistant" else self.colors["accent_light"],
            font=("Arial", 8, "bold"),
            anchor="w",
        ).pack(fill=tk.X, pady=(6, 0))

        tk.Label(
            card,
            text=str(item.get("body") or "")[:120] + ("..." if len(str(item.get("body") or "")) > 120 else ""),
            bg=bg,
            fg=self.colors["text_secondary"],
            font=("Arial", 10),
            justify=tk.LEFT,
            wraplength=320,
        ).pack(fill=tk.X, pady=(8, 0))
        for child in card.winfo_children():
            child.bind("<Button-1>", lambda _e, uid=str(item.get("uid") or ""): self._select_notification(uid))
            for grandchild in child.winfo_children():
                grandchild.bind("<Button-1>", lambda _e, uid=str(item.get("uid") or ""): self._select_notification(uid))

    def _render_daily_agenda_section(self, parent) -> None:
        """Render the current day's agenda and status strip."""
        self.selected_calendar_date = self.current_date
        self.calendar_month_anchor = self.current_date.replace(day=1)
        self.refresh_date_display()
        frame = tk.Frame(parent, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True)
        todos = self._get_todos_for_date(self.current_date)
        unread_count = sum(1 for item in self._notifications if not item.get("read"))

        summary_strip = tk.Frame(frame, bg=self.colors['bg_content'])
        summary_strip.pack(fill=tk.X, pady=(0, 20))

        summary_cards = [
            ("Unread inbox", str(unread_count)),
            ("Today's todos", str(len(todos))),
            ("Shortlisted idols", str(len(self.shortlisted_idols))),
            ("Loaded idols", str(len(self.idols))),
            ("Tracked groups", str(len(self.group_manager.groups)) if self.group_manager else "0"),
        ]

        for title, value in summary_cards:
            card = tk.Frame(summary_strip, bg=self.colors['bg_card'], padx=16, pady=14)
            card.pack(side=tk.LEFT, padx=(0, 12))
            tk.Label(card, text=title.upper(), bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 9, 'bold')).pack(anchor="w")
            tk.Label(card, text=value, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w", pady=(6, 0))

        self._build_today_status_strip(frame)

        agenda_frame = tk.Frame(frame, bg=self.colors['bg_content'])
        agenda_frame.pack(fill=tk.BOTH, expand=True)

        tk.Label(
            agenda_frame,
            text="Daily Agenda",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 16, 'bold'),
        ).pack(anchor="w", pady=(0, 10))

        for todo in todos:
            self._build_todo_card(agenda_frame, todo)

    def show_today_view(self):
        """Legacy Today route now points to the combined inbox dashboard."""
        self.show_inbox_view()

    def _change_calendar_month(self, offset: int):
        """Move the visible calendar month backward or forward."""
        anchor = self.calendar_month_anchor
        month_index = (anchor.year * 12 + (anchor.month - 1)) + offset
        year = month_index // 12
        month = (month_index % 12) + 1
        self.calendar_month_anchor = date(year, month, 1)
        self.show_schedule_view()

    def _select_calendar_date(self, selected_date: date):
        """Select a date in the calendar view."""
        self.selected_calendar_date = selected_date
        self.calendar_month_anchor = selected_date.replace(day=1)
        self.show_schedule_view()

    def _jump_calendar_to_today(self):
        """Reset the calendar to the active in-game date."""
        self.selected_calendar_date = self.current_date
        self.calendar_month_anchor = self.current_date.replace(day=1)
        self.show_schedule_view()

    def _open_selected_calendar_day(self):
        """Open the selected calendar day as the active turn."""
        if self.selected_calendar_date > self.current_date:
            walk_date = self.current_date
            while walk_date < self.selected_calendar_date:
                self._archive_completed_lives_for_date(walk_date)
                self._apply_managed_idol_status_for_date(walk_date)
                self._close_financial_day(walk_date)
                walk_date += timedelta(days=1)
        self.current_date = self.selected_calendar_date
        self.turn_number = max(1, (self.current_date - self.game_start_date).days + 1)
        self._daily_todos_cache.clear()
        self.refresh_date_display()
        self.switch_view("Inbox", skip_history=True)

    def _bind_calendar_cell(self, widget, selected_date: date):
        """Bind click handlers to a calendar cell and its children."""
        widget.bind("<Button-1>", lambda e, d=selected_date: self._select_calendar_date(d))
        widget.bind("<Double-Button-1>", lambda e, d=selected_date: (self._select_calendar_date(d), self._open_selected_calendar_day()))
        for child in widget.winfo_children():
            self._bind_calendar_cell(child, selected_date)

    def _render_schedule_sidebar(self, parent):
        """Render the mini calendar and calendar source list."""
        sidebar = tk.Frame(parent, bg=self.colors["bg_card"], padx=14, pady=14)
        sidebar.grid(row=0, column=0, sticky="nsw", padx=(0, 18))

        tk.Label(sidebar, text=self.calendar_month_anchor.strftime("%B %Y"), bg=self.colors["bg_card"], fg=self.colors["text_primary"], font=("Arial", 16, "bold")).pack(anchor="w", pady=(0, 12))

        mini_weekdays = tk.Frame(sidebar, bg=self.colors["bg_card"])
        mini_weekdays.pack(fill=tk.X)
        for weekday_name in ["M", "T", "W", "T", "F", "S", "S"]:
            tk.Label(mini_weekdays, text=weekday_name, bg=self.colors["bg_card"], fg=self.colors["text_secondary"], width=3, font=("Arial", 9, "bold")).pack(side=tk.LEFT)

        mini_grid = tk.Frame(sidebar, bg=self.colors["bg_card"])
        mini_grid.pack(fill=tk.X, pady=(6, 14))
        for row_index, week in enumerate(calendar.Calendar(firstweekday=0).monthdayscalendar(self.calendar_month_anchor.year, self.calendar_month_anchor.month)):
            for col_index, day_number in enumerate(week):
                if day_number == 0:
                    tk.Label(mini_grid, text=" ", bg=self.colors["bg_card"], width=3).grid(row=row_index, column=col_index, padx=1, pady=1)
                    continue
                cell_date = date(self.calendar_month_anchor.year, self.calendar_month_anchor.month, day_number)
                is_selected = cell_date == self.selected_calendar_date
                is_today = cell_date == self.current_date
                tk.Button(
                    mini_grid,
                    text=str(day_number),
                    width=3,
                    relief=tk.FLAT,
                    bg=self.colors["accent"] if is_selected else (self.colors["bg_sidebar"] if is_today else self.colors["bg_card"]),
                    fg=self.colors["text_primary"],
                    activebackground=self.colors["accent"],
                    activeforeground=self.colors["text_primary"],
                    command=lambda d=cell_date: self._select_calendar_date(d),
                    cursor="hand2",
                    font=("Arial", 9, "bold" if is_selected else "normal"),
                ).grid(row=row_index, column=col_index, padx=1, pady=1)

        tk.Label(sidebar, text="My Calendars", bg=self.colors["bg_card"], fg=self.colors["text_primary"], font=("Arial", 12, "bold")).pack(anchor="w", pady=(6, 8))
        for source in self._get_calendar_sources():
            selected = source["id"] in self.selected_calendar_sources
            tk.Button(
                sidebar,
                text=("● " if selected else "○ ") + source["label"],
                bg=self.colors["bg_card"],
                fg=source["color"] if selected else self.colors["text_secondary"],
                relief=tk.FLAT,
                anchor="w",
                padx=2,
                pady=4,
                font=("Arial", 10, "bold" if source["type"] == "group" else "normal"),
                command=lambda sid=source["id"]: self._toggle_calendar_source(sid),
                cursor="hand2",
            ).pack(fill=tk.X)

    def _render_month_schedule(self, parent):
        """Render the month calendar and selected-day agenda."""
        parent.columnconfigure(0, weight=3)
        parent.columnconfigure(1, weight=2)
        calendar_panel = tk.Frame(parent, bg=self.colors['bg_card'], padx=18, pady=18)
        calendar_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 18))
        agenda_panel = tk.Frame(parent, bg=self.colors['bg_card'], padx=18, pady=18)
        agenda_panel.grid(row=0, column=1, sticky="nsew")

        month_header = tk.Frame(calendar_panel, bg=self.colors['bg_card'])
        month_header.pack(fill=tk.X, pady=(0, 16))
        tk.Button(month_header, text="<", bg=self.colors['accent'], fg=self.colors['text_primary'], relief=tk.FLAT, padx=10, pady=6, font=('Arial', 10, 'bold'), command=lambda: self._change_calendar_month(-1), cursor='hand2').pack(side=tk.LEFT)
        tk.Label(month_header, text=self.calendar_month_anchor.strftime("%B %Y"), bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(side=tk.LEFT, padx=18)
        tk.Button(month_header, text=">", bg=self.colors['accent'], fg=self.colors['text_primary'], relief=tk.FLAT, padx=10, pady=6, font=('Arial', 10, 'bold'), command=lambda: self._change_calendar_month(1), cursor='hand2').pack(side=tk.LEFT)

        weekday_header = tk.Frame(calendar_panel, bg=self.colors['bg_card'])
        weekday_header.pack(fill=tk.X, pady=(0, 8))
        for index, weekday_name in enumerate(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]):
            tk.Label(weekday_header, text=weekday_name, bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 10, 'bold'), width=12).grid(row=0, column=index, padx=3, pady=2)

        grid_frame = tk.Frame(calendar_panel, bg=self.colors['bg_card'])
        grid_frame.pack(fill=tk.BOTH, expand=True)
        month_matrix = calendar.Calendar(firstweekday=0).monthdayscalendar(self.calendar_month_anchor.year, self.calendar_month_anchor.month)
        for row_index, week in enumerate(month_matrix):
            grid_frame.rowconfigure(row_index, weight=1)
            for col_index, day_number in enumerate(week):
                grid_frame.columnconfigure(col_index, weight=1)
                if day_number == 0:
                    tk.Frame(grid_frame, bg=self.colors['bg_card_dim'], height=110, width=120).grid(row=row_index, column=col_index, sticky="nsew", padx=3, pady=3)
                    continue
                cell_date = date(self.calendar_month_anchor.year, self.calendar_month_anchor.month, day_number)
                todos = self._get_filtered_todos_for_date(cell_date)
                is_selected = cell_date == self.selected_calendar_date
                is_today = cell_date == self.current_date
                cell_bg = self.colors['accent'] if is_selected else (self.colors['bg_sidebar'] if is_today else self.colors['bg_card'])
                cell = tk.Frame(grid_frame, bg=cell_bg, padx=8, pady=8, highlightthickness=1, highlightbackground=self.colors['yellow'] if is_today else self.colors['border'])
                cell.grid(row=row_index, column=col_index, sticky="nsew", padx=3, pady=3)
                top_line = tk.Frame(cell, bg=cell_bg)
                top_line.pack(fill=tk.X)
                tk.Label(top_line, text=str(day_number), bg=cell_bg, fg=self.colors['text_primary'], font=('Arial', 12, 'bold')).pack(side=tk.LEFT)
                tk.Label(top_line, text=str(len(todos)), bg=cell_bg, fg=self.colors['text_secondary'], font=('Arial', 9, 'bold')).pack(side=tk.RIGHT)
                for preview in todos[:2]:
                    tk.Label(cell, text=f"{preview['time']} {preview['title']}", bg=cell_bg, fg=preview.get("source_color", self.colors['text_secondary']), anchor="w", justify=tk.LEFT, wraplength=130, font=('Arial', 8, 'bold')).pack(fill=tk.X, pady=(6, 0))
                if len(todos) > 2:
                    tk.Label(cell, text=f"+{len(todos) - 2} more", bg=cell_bg, fg=self.colors['yellow'], anchor="w", font=('Arial', 8, 'bold')).pack(fill=tk.X, pady=(6, 0))
                self._bind_calendar_cell(cell, cell_date)

        selected_todos = self._get_filtered_todos_for_date(self.selected_calendar_date)
        tk.Label(agenda_panel, text=self.selected_calendar_date.strftime("%A, %B %d"), bg=agenda_panel.cget("bg"), fg=self.colors['text_primary'], font=('Arial', 20, 'bold')).pack(anchor="w")
        tk.Label(agenda_panel, text=f"{len(selected_todos)} scheduled items", bg=agenda_panel.cget("bg"), fg=self.colors['text_secondary'], font=('Arial', 11)).pack(anchor="w", pady=(6, 14))
        for todo in selected_todos:
            self._build_todo_card(agenda_panel, todo, wraplength=420)

    def _paint_week_schedule_canvas(
        self,
        canvas: tk.Canvas,
        week_dates: List[date],
        canvas_width: int,
        canvas_height: int,
        time_col_width: int,
        day_col_width: int,
        header_height: int,
        hour_height: int,
        start_hour: int,
        end_hour: int,
    ) -> None:
        """Draw week grid and events for the given pixel geometry."""
        canvas.delete("all")

        for index, day_date in enumerate(week_dates):
            x0 = time_col_width + (index * day_col_width)
            x1 = x0 + day_col_width
            if day_date == self.current_date:
                canvas.create_rectangle(x0, 0, x1, canvas_height, fill=self.colors['bg_sidebar'], outline="")
            canvas.create_line(x0, 0, x0, canvas_height, fill=self.colors['border'])
            header_color = self.colors['yellow'] if day_date == self.current_date else self.colors['text_primary']
            canvas.create_text((x0 + x1) / 2, 16, text=day_date.strftime("%a"), fill=header_color, font=('Arial', 10, 'bold'))
            canvas.create_text((x0 + x1) / 2, 34, text=day_date.strftime("%d"), fill=header_color, font=('Arial', 16, 'bold'))

        canvas.create_line(canvas_width, 0, canvas_width, canvas_height, fill=self.colors['border'])
        canvas.create_line(0, header_height, canvas_width, header_height, fill=self.colors['border'])

        for hour in range(start_hour, end_hour + 1):
            y = header_height + ((hour - start_hour) * hour_height)
            if hour < end_hour:
                canvas.create_line(0, y, canvas_width, y, fill=self.colors['border'])
            if hour < end_hour:
                canvas.create_text(time_col_width - 8, y + 6, text=f"{hour:02d}:00", fill=self.colors['text_secondary'], font=('Arial', 9), anchor="ne")

        for day_index, day_date in enumerate(week_dates):
            x0 = time_col_width + (day_index * day_col_width)
            events = sorted(
                self._get_filtered_todos_for_date(day_date),
                key=lambda todo: self._parse_time_block(todo["time"])[0],
            )
            for todo in events:
                start_minutes, end_minutes = self._parse_time_block(todo["time"])
                start_y = header_height + (((start_minutes / 60) - start_hour) * hour_height)
                end_y = header_height + (((end_minutes / 60) - start_hour) * hour_height)
                start_y = max(header_height + 2, start_y + 2)
                end_y = min(canvas_height - 2, end_y - 2)
                if end_y <= start_y:
                    end_y = start_y + 24
                rect_x0 = x0 + 4
                rect_x1 = x0 + day_col_width - 4
                fill_color = todo.get("source_color", self.colors['accent'])
                canvas.create_rectangle(
                    rect_x0,
                    start_y,
                    rect_x1,
                    end_y,
                    fill=fill_color,
                    outline="",
                )
                canvas.create_text(
                    rect_x0 + 6,
                    start_y + 6,
                    text=todo["title"],
                    fill=self.colors['text_primary'],
                    font=('Arial', 8, 'bold'),
                    anchor="nw",
                    width=max(80, day_col_width - 16),
                )
                canvas.create_text(
                    rect_x0 + 6,
                    min(end_y - 10, start_y + 20),
                    text=todo["time"],
                    fill=self.colors['text_primary'],
                    font=('Arial', 7),
                    anchor="nw",
                )

    def _render_week_schedule(self, parent):
        """Render a weekly calendar view with aligned columns and time spans."""
        week_dates = self._get_week_dates(self.selected_calendar_date)
        tk.Label(
            parent,
            text=f"{week_dates[0].strftime('%B %d')} - {week_dates[-1].strftime('%B %d, %Y')}",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 18, 'bold'),
        ).pack(anchor="w", pady=(0, 12))

        grid_wrap = tk.Frame(parent, bg=self.colors['bg_card'], padx=12, pady=12)
        grid_wrap.pack(fill=tk.BOTH, expand=True)

        time_col_width = 72
        header_height = 46
        start_hour = 8
        end_hour = 21
        total_hours = end_hour - start_hour
        num_days = len(week_dates)

        canvas = tk.Canvas(
            grid_wrap,
            bg=self.colors['bg_card'],
            highlightthickness=0,
        )
        canvas.pack(fill=tk.BOTH, expand=True)

        def _apply_week_layout():
            try:
                if not canvas.winfo_exists():
                    return
            except tk.TclError:
                return

            canvas.update_idletasks()
            w = max(canvas.winfo_width(), 400)
            h = max(canvas.winfo_height(), 200)

            inner_w = max(1, w)
            inner_h = max(1, h)
            day_col_width = max(64, (inner_w - time_col_width) // num_days)
            canvas_width = time_col_width + num_days * day_col_width
            hour_height = max(28, (inner_h - header_height) // total_hours)
            canvas_height = header_height + total_hours * hour_height

            self._paint_week_schedule_canvas(
                canvas,
                week_dates,
                canvas_width,
                canvas_height,
                time_col_width,
                day_col_width,
                header_height,
                hour_height,
                start_hour,
                end_hour,
            )

        def _debounced_layout(_event=None):
            if self._resize_after_id is not None:
                try:
                    self.root.after_cancel(self._resize_after_id)
                except tk.TclError:
                    pass
                self._resize_after_id = None

            def _run():
                self._resize_after_id = None
                _apply_week_layout()

            self._resize_after_id = self.root.after(80, _run)

        canvas.bind("<Configure>", _debounced_layout)
        self.root.after_idle(_apply_week_layout)

    def show_schedule_view(self):
        """Show a calendar schedule with week/month views and source filtering."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        self.refresh_date_display()
        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True, padx=28, pady=28)

        header = tk.Frame(frame, bg=self.colors['bg_content'])
        header.pack(fill=tk.X, pady=(0, 18))

        tk.Label(
            header,
            text="CALENDAR",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 28, 'bold'),
        ).pack(side=tk.LEFT)

        tk.Button(
            header,
            text="Today",
            bg=self.colors['accent'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=12,
            pady=8,
            font=('Arial', 10, 'bold'),
            command=self._jump_calendar_to_today,
            cursor='hand2',
        ).pack(side=tk.RIGHT, padx=(8, 0))

        tk.Button(
            header,
            text="Open Selected Day",
            bg=self.colors['green'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=12,
            pady=8,
            font=('Arial', 10, 'bold'),
            command=self._open_selected_calendar_day,
            cursor='hand2',
        ).pack(side=tk.RIGHT)

        view_toggle = tk.Frame(header, bg=self.colors['bg_content'])
        view_toggle.pack(side=tk.RIGHT, padx=(0, 12))
        for mode, label in [("week", "Week View"), ("month", "Month View")]:
            tk.Button(
                view_toggle,
                text=label,
                bg=self.colors['accent'] if self.calendar_view_mode == mode else self.colors['bg_sidebar'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=lambda m=mode: self._set_calendar_view_mode(m),
                cursor='hand2',
            ).pack(side=tk.LEFT, padx=(0, 6))

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(1, weight=1)

        self._render_schedule_sidebar(body)

        main_panel = tk.Frame(body, bg=self.colors['bg_content'])
        main_panel.grid(row=0, column=1, sticky="nsew")

        if self.calendar_view_mode == "month":
            self._render_month_schedule(main_panel)
        else:
            self._render_week_schedule(main_panel)

    def advance_turn(self):
        """Advance the game by exactly one day."""
        if not self._navigating:
            self._save_current_state_to_history()

        previous_date = self.current_date
        finance_breakdown = self._build_daily_finance_breakdown(previous_date)
        self._archive_completed_lives_for_date(previous_date)
        status_updates = self._apply_managed_idol_status_for_date(previous_date)
        self._close_financial_day(previous_date)
        self.current_date += timedelta(days=1)
        self.turn_number += 1
        self._apply_scenario_future_events_for_current_date()
        self.selected_calendar_date = self.current_date
        self.calendar_month_anchor = self.current_date.replace(day=1)
        self._daily_todos_cache.clear()
        self.refresh_date_display()
        self._seed_previous_day_reports(previous_date, status_updates=status_updates, finance_breakdown=finance_breakdown)
        self._seed_daily_inbox_for_date(self.current_date)
        self.switch_view("Inbox", skip_history=True)

        if not self._navigating:
            self._save_current_state_to_history()
    
    def switch_view(self, view_name: str, skip_history: bool = False):
        """Switch to a different view.
        
        Args:
            view_name: Name of the view to switch to
            skip_history: If True, don't save this navigation to history
        """
        if self._browse_mode and view_name not in {"Idols", "Groups", "Songs"}:
            view_name = "Groups"

        # Save current state to history before switching (unless skipping)
        if not skip_history and not self._navigating:
            self._save_current_state_to_history()
        
        self.current_view = view_name
        
        # Update button colors
        for name, btn in self.nav_buttons.items():
            if name == view_name:
                btn.config(bg=self.colors['accent'])
            else:
                btn.config(bg=self.colors['bg_sidebar'])
        self._update_continue_button()
        
        # Clear the grid container reference to prevent accessing destroyed widgets
        self._idols_grid_container = None
        
        # Cancel any pending layout jobs
        if hasattr(self, '_idols_layout_job'):
            try:
                self.root.after_cancel(self._idols_layout_job)
            except:
                pass
            delattr(self, '_idols_layout_job')

        if self._resize_after_id is not None:
            try:
                self.root.after_cancel(self._resize_after_id)
            except tk.TclError:
                pass
            self._resize_after_id = None
        
        # Clear content and show appropriate view
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        # Clean up sticky headers from groups view if they exist
        if hasattr(self, '_group_header_container'):
            try:
                if self._group_header_container and self._group_header_container.winfo_exists():
                    self._group_header_container.destroy()
            except:
                pass
            delattr(self, '_group_header_container')
        
        # Force update to ensure widgets are destroyed before creating new ones
        self.root.update_idletasks()
        
        if view_name == "Today":
            self.show_today_view()
        elif view_name == "Idols":
            self.show_idols_view()
        elif view_name == "Groups":
            self.show_groups_view()
        elif view_name == "Training":
            self.show_training_view()
        elif view_name == "Schedule":
            self.show_schedule_view()
        elif view_name == "Inbox":
            self.show_inbox_view()
        elif view_name == "Lives":
            self.show_lives_view()
        elif view_name == "Songs":
            self.show_songs_view()
        elif view_name == "Making":
            self.show_making_view()
        elif view_name == "Publish":
            self.show_publish_view()
        elif view_name == "Scout":
            self.show_scout_view()
        elif view_name == "Company Info":
            self.show_company_info_view()
        elif view_name == "Finances":
            self.show_finances_view()
        else:
            self.show_placeholder_view(view_name)

    def show_placeholder_view(self, view_name: str):
        """Show a placeholder view for unimplemented features."""
        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(expand=True, fill=tk.BOTH)
        
        tk.Label(frame, text=view_name.upper(), bg=self.colors['bg_content'],
                fg=self.colors['text_primary'], font=('Arial', 24, 'bold')).pack(pady=50)
        
        tk.Label(frame, text="This feature is coming soon...", bg=self.colors['bg_content'],
                fg=self.colors['text_secondary'], font=('Arial', 14)).pack()

    _TRAINING_INTENSITY_KEYS = ("sing", "dance", "physical", "target")
    _TRAINING_FOCUS_OPTIONS = ("make-up", "talking", "model", "host", "variety", "acting")
    _TRAINING_FOCUS_DEFAULT = "talking"
    # Capacity vs sum of the four intensity sliders; per-idol logic (attributes/status) later.
    DEFAULT_TRAINING_BEAR_INDEX = 12

    def _ensure_training_intensity_row(self, idol: Idol) -> dict[str, int]:
        uid = str(getattr(idol, "uid", "") or "")
        if uid not in self._training_intensity:
            self._training_intensity[uid] = {k: 0 for k in self._TRAINING_INTENSITY_KEYS}
        row = self._training_intensity[uid]
        if "misc" in row:
            m = row.pop("misc")
            if "target" not in row:
                try:
                    row["target"] = max(0, min(5, int(m)))
                except (TypeError, ValueError):
                    row["target"] = 0
        for k in self._TRAINING_INTENSITY_KEYS:
            if k not in row:
                row[k] = 0
        return row

    def _get_training_intensity(self, idol: Idol, column: str) -> int:
        row = self._ensure_training_intensity_row(idol)
        return max(0, min(5, int(row.get(column, 0))))

    def _set_training_intensity_from_scale(self, idol: Idol, column: str, value_str: str) -> None:
        try:
            v = int(float(value_str))
        except ValueError:
            return
        v = max(0, min(5, v))
        row = self._ensure_training_intensity_row(idol)
        row[column] = v

    def _on_training_scale_with_intensive(
        self, idol: Idol, column: str, value_str: str, intensive_lbl: tk.Label
    ) -> None:
        self._set_training_intensity_from_scale(idol, column, value_str)
        intensive_lbl.config(text=self._intensive_status_for_idol(idol))

    def _get_training_focus_skill(self, idol: Idol) -> str:
        uid = str(getattr(idol, "uid", "") or "")
        v = self._training_focus_skill.get(uid, self._TRAINING_FOCUS_DEFAULT)
        if v not in self._TRAINING_FOCUS_OPTIONS:
            return self._TRAINING_FOCUS_DEFAULT
        return v

    def _set_training_focus_skill(self, idol: Idol, value: str) -> None:
        uid = str(getattr(idol, "uid", "") or "")
        if value in self._TRAINING_FOCUS_OPTIONS:
            self._training_focus_skill[uid] = value

    def _get_training_bear_index(self, idol: Idol) -> int:
        """How much training load this managed idol can handle safely."""
        return training_bear_index(idol)

    @staticmethod
    def _intensive_status_label(total_intensity: int, bear_index: int) -> str:
        """None / light / moderate / heavy from total slider sum vs bear index (thirds of capacity)."""
        if total_intensity <= 0:
            return "None"
        bear = bear_index if bear_index > 0 else IdolProfileUI.DEFAULT_TRAINING_BEAR_INDEX
        r = total_intensity / bear
        if r <= 1.0 / 3.0:
            return "light"
        if r <= 2.0 / 3.0:
            return "moderate"
        return "heavy"

    def _intensive_status_for_idol(self, idol: Idol) -> str:
        row = self._ensure_training_intensity_row(idol)
        total = sum(int(row.get(k, 0)) for k in self._TRAINING_INTENSITY_KEYS)
        return self._intensive_status_label(total, self._get_training_bear_index(idol))

    def _get_managed_idols(self) -> list[Idol]:
        """Return only the currently managed idols."""
        if not self.player_group or not getattr(self.player_group, "members", None):
            return []
        return [idol for idol in self.player_group.members if isinstance(idol, Idol)]

    def _is_idol_birthday_on(self, idol: Idol, target_date: date) -> bool:
        """Return whether target_date matches an idol's public birthday."""
        if idol.birthday and (idol.birthday.month, idol.birthday.day) == (target_date.month, target_date.day):
            return True
        partial = self._parse_partial_birthday(idol.birthday_partial)
        return bool(partial and partial == (target_date.month, target_date.day))

    def _get_managed_idol_training_load(self, idol: Idol, target_date: date) -> int:
        """Translate current sliders into one day's status load for this idol."""
        row = self._ensure_training_intensity_row(idol)
        base_load = sum(max(0, int(row.get(key, 0) or 0)) for key in self._TRAINING_INTENSITY_KEYS)
        if base_load <= 0:
            return 0
        if self._has_group_live_on_date(target_date):
            return max(0, int(round(base_load * 0.6)))
        return base_load

    def _get_group_live_minutes_for_date(self, target_date: date) -> int:
        """Return total scheduled/performed live minutes for the managed group on a day."""
        total_minutes = 0
        for raw_live in self._get_player_group_operational_lives_for_date(target_date):
            live = self._normalize_live_entry(raw_live)
            if not live:
                continue
            try:
                total_minutes += max(0, int(live.get("duration") or 0))
            except (TypeError, ValueError):
                continue
        return total_minutes

    def _weekly_trend_for_idol(self, idol: Idol) -> dict[str, Any]:
        """Return rolling last-week attribute trend data for a managed idol."""
        rows = self._training_week_log.get(str(getattr(idol, "uid", "") or ""), [])
        return summarize_weekly_attribute_trend(idol, rows)

    @staticmethod
    def _weekly_trend_text(trend: dict[str, Any]) -> str:
        physical = trend.get("physical", {})
        technical = trend.get("technical", {})
        return f"Week: Phys {physical.get('trend', 'N/A')} | Tech {technical.get('trend', 'N/A')}"

    def _apply_weekly_attribute_progression_if_due(self, target_date: date) -> list[dict[str, Any]]:
        """Apply weekly physical/technical maintenance every 7th managed day."""
        if ((target_date - self.game_start_date).days + 1) % 7 != 0:
            return []
        results: list[dict[str, Any]] = []
        for idol in self._get_managed_idols():
            rows = self._training_week_log.get(str(getattr(idol, "uid", "") or ""), [])
            results.append(
                apply_weekly_attribute_maintenance(
                    idol,
                    rows,
                    week_key=target_date.isoformat(),
                )
            )
        return results

    def _apply_managed_idol_status_for_date(self, target_date: date) -> list[dict]:
        """Close one day of condition/morale updates for managed idols only."""
        idols = self._get_managed_idols()
        if not idols:
            return []

        live_count = len(self._get_player_group_operational_lives_for_date(target_date))
        live_minutes = self._get_group_live_minutes_for_date(target_date)
        updates: list[dict] = []
        for idol in idols:
            training_row = self._ensure_training_intensity_row(idol)
            focus_skill = self._get_training_focus_skill(idol)
            updates.append(
                apply_daily_status_update(
                    idol,
                    training_load=self._get_managed_idol_training_load(idol, target_date),
                    live_count=live_count,
                    live_minutes=live_minutes,
                    birthday=self._is_idol_birthday_on(idol, target_date),
                    reference_date=target_date,
                )
            )
            record_training_day(
                self._training_week_log,
                idol,
                target_date=target_date.isoformat(),
                training_row=training_row,
                live_count=live_count,
                live_minutes=live_minutes,
                focus_skill=focus_skill,
            )
        self._apply_weekly_attribute_progression_if_due(target_date)
        return updates

    def show_training_view(self):
        """Training grid: members × categories with 0–5 training intensity sliders."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        if not getattr(self, "_data_loaded", False):
            loading_frame = tk.Frame(self.content_frame, bg=self.colors["bg_content"])
            loading_frame.pack(expand=True, fill=tk.BOTH)
            tk.Label(
                loading_frame,
                text="Loading…",
                bg=self.colors["bg_content"],
                fg=self.colors["text_primary"],
                font=("Arial", 18),
            ).pack(pady=50)
            return

        if not self.player_group or not self.player_group.members:
            frame = tk.Frame(self.content_frame, bg=self.colors["bg_content"])
            frame.pack(expand=True, fill=tk.BOTH, padx=28, pady=28)
            tk.Label(
                frame,
                text="TRAINING",
                bg=self.colors["bg_content"],
                fg=self.colors["text_primary"],
                font=("Arial", 24, "bold"),
            ).pack(anchor=tk.W)
            tk.Label(
                frame,
                text="Set a managed group from Home or a scenario save to assign member training.",
                bg=self.colors["bg_content"],
                fg=self.colors["text_secondary"],
                font=("Arial", 12),
            ).pack(anchor=tk.W, pady=(12, 0))
            return

        outer = tk.Frame(self.content_frame, bg=self.colors["bg_content"])
        outer.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)

        tk.Label(
            outer,
            text="TRAINING",
            bg=self.colors["bg_content"],
            fg=self.colors["text_primary"],
            font=("Arial", 22, "bold"),
        ).pack(anchor=tk.W, pady=(0, 6))
        tk.Label(
            outer,
            text=f"Group: {self.player_group.name_romanji or self.player_group.name}",
            bg=self.colors["bg_content"],
            fg=self.colors["text_secondary"],
            font=("Arial", 11),
        ).pack(anchor=tk.W, pady=(0, 4))
        tk.Label(
            outer,
            text="Sliders set training intensity (0 = off, 5 = maximum) for Sing, Dance, Physical, and Target. "
            "Focus picks one specialty (make-up, talking, model, host, variety, acting). "
            "Intensive compares the sum of those sliders to each idol's current bear capacity from stamina, fitness, determination, and current condition. "
            "A full 4-hour training day costs about 10 condition, while a standard 2-hour live costs 40 condition before stamina reduction. "
            "Each stamina point removes 1/40 of that live cost, so stamina 20 makes a standard live cost 20 condition. "
            "A light training block equals one 4-hour session, medium counts 1.5x, heavy counts 2x, and 30 live minutes count like one light block. "
            f"Weekly upkeep aims for about {PHYSICAL_WEEKLY_MAINTENANCE_BLOCKS:.1f} physical and {TECHNICAL_WEEKLY_MAINTENANCE_BLOCKS:.1f} technical light-equivalent blocks. "
            "Mental and appearance stats do not decay here; they only improve through target-focus special training.",
            bg=self.colors["bg_content"],
            fg=self.colors["text_secondary"],
            font=("Arial", 10),
            wraplength=920,
            justify=tk.LEFT,
        ).pack(anchor=tk.W, pady=(0, 12))

        wrap = tk.Frame(outer, bg=self.colors["bg_content"])
        wrap.pack(fill=tk.BOTH, expand=True)

        canvas = tk.Canvas(wrap, bg=self.colors["bg_card"], highlightthickness=1, highlightbackground=self.colors["border"])
        vsb = tk.Scrollbar(wrap, orient=tk.VERTICAL, command=canvas.yview)
        table_host = tk.Frame(canvas, bg=self.colors["bg_card"])
        win_id = canvas.create_window((0, 0), window=table_host, anchor="nw")

        def _on_table_configure(_event=None):
            canvas.configure(scrollregion=canvas.bbox("all"))

        def _on_canvas_cfg(event):
            canvas.itemconfig(win_id, width=event.width)

        table_host.bind("<Configure>", _on_table_configure)
        canvas.bind("<Configure>", _on_canvas_cfg)
        canvas.configure(yscrollcommand=vsb.set)

        intensity_cols = ("sing", "dance", "physical", "target")
        headers = ("Member", "Sing", "Dance", "Physical", "Target", "Focus", "Intensive")

        for c in range(7):
            table_host.columnconfigure(c, weight=1, minsize=88)
        header_bg = self.colors["accent"]
        for col_idx, title in enumerate(headers):
            tk.Label(
                table_host,
                text=title,
                bg=header_bg,
                fg=self.colors["text_primary"],
                font=("Arial", 11, "bold"),
                padx=8,
                pady=10,
                anchor=tk.CENTER,
            ).grid(row=0, column=col_idx, sticky="nsew")

        for row_idx, idol in enumerate(self.player_group.members, start=1):
            status = summarize_status(idol)
            trend = self._weekly_trend_for_idol(idol)
            name_cell = tk.Frame(table_host, bg=self.colors["bg_card"])
            name_cell.grid(row=row_idx, column=0, sticky="nsew", padx=4, pady=6)
            tk.Label(
                name_cell,
                text=idol.name,
                bg=self.colors["bg_card"],
                fg=self.colors["text_primary"],
                font=("Arial", 11, "bold"),
                anchor=tk.W,
            ).pack(fill=tk.X)
            tk.Label(
                name_cell,
                text=f"{status['condition']} | {status['availability']}",
                bg=self.colors["bg_card"],
                fg=status["condition_color"],
                font=("Arial", 9, "bold"),
                anchor=tk.W,
            ).pack(fill=tk.X, pady=(2, 0))
            tk.Label(
                name_cell,
                text=f"C {status['condition_value']}/{status['condition_cap']}  M {status['morale']}  Bear {status['bear_index']}",
                bg=self.colors["bg_card"],
                fg=self.colors["text_secondary"],
                font=("Arial", 8),
                anchor=tk.W,
            ).pack(fill=tk.X, pady=(2, 0))
            tk.Label(
                name_cell,
                text=self._weekly_trend_text(trend),
                bg=self.colors["bg_card"],
                fg=trend.get("technical", {}).get("color", self.colors["text_secondary"]),
                font=("Arial", 8),
                anchor=tk.W,
            ).pack(fill=tk.X, pady=(2, 0))

            intensive_cell = tk.Frame(table_host, bg=self.colors["bg_card"])
            intensive_cell.grid(row=row_idx, column=6, sticky="nsew", padx=6, pady=4)
            intensive_cell.grid_columnconfigure(0, weight=1)
            intensive_cell.grid_rowconfigure(0, weight=1)
            intensive_cell.grid_rowconfigure(1, weight=0)
            intensive_cell.grid_rowconfigure(2, weight=1)
            intensive_lbl = tk.Label(
                intensive_cell,
                text=self._intensive_status_for_idol(idol),
                bg=self.colors["bg_card"],
                fg=self.colors["text_primary"],
                font=("Arial", 10),
                anchor=tk.CENTER,
            )
            intensive_lbl.grid(row=1, column=0)
            tk.Label(
                intensive_cell,
                text=f"Bear {status['bear_index']}",
                bg=self.colors["bg_card"],
                fg=self.colors["text_secondary"],
                font=("Arial", 8),
                anchor=tk.CENTER,
            ).grid(row=2, column=0, pady=(4, 0))

            for col_idx, col_key in enumerate(intensity_cols, start=1):
                cell = tk.Frame(table_host, bg=self.colors["bg_card"])
                cell.grid(row=row_idx, column=col_idx, sticky="nsew", padx=6, pady=4)
                cell.grid_columnconfigure(0, weight=1)
                cell.grid_rowconfigure(0, weight=1)
                cell.grid_rowconfigure(1, weight=0)
                cell.grid_rowconfigure(2, weight=1)
                initial = self._get_training_intensity(idol, col_key)
                var = tk.DoubleVar(value=float(initial))
                sc = tk.Scale(
                    cell,
                    variable=var,
                    from_=0,
                    to=5,
                    orient=tk.HORIZONTAL,
                    resolution=1,
                    showvalue=True,
                    length=140,
                    sliderlength=18,
                    bg=self.colors["bg_card"],
                    fg=self.colors["text_primary"],
                    troughcolor=self.colors["bg_sidebar"],
                    highlightthickness=0,
                    font=("Arial", 9),
                    label="",
                    command=lambda v, i=idol, ck=col_key, lbl=intensive_lbl: self._on_training_scale_with_intensive(
                        i, ck, v, lbl
                    ),
                )
                sc.grid(row=1, column=0, sticky="ew")

            focus_cell = tk.Frame(table_host, bg=self.colors["bg_card"])
            focus_cell.grid(row=row_idx, column=5, sticky="nsew", padx=6, pady=4)
            focus_cell.grid_columnconfigure(0, weight=1)
            focus_cell.grid_rowconfigure(0, weight=1)
            focus_cell.grid_rowconfigure(1, weight=0)
            focus_cell.grid_rowconfigure(2, weight=1)
            focus_var = tk.StringVar(value=self._get_training_focus_skill(idol))
            combo = ttk.Combobox(
                focus_cell,
                textvariable=focus_var,
                values=self._TRAINING_FOCUS_OPTIONS,
                state="readonly",
                width=12,
                font=("Arial", 10),
            )
            combo.grid(row=1, column=0, sticky="ew")

            def _on_focus_change(_event=None, i=idol, var_ref=focus_var):
                val = var_ref.get()
                self._set_training_focus_skill(i, val)

            combo.bind("<<ComboboxSelected>>", _on_focus_change)

        vsb.pack(side=tk.RIGHT, fill=tk.Y)
        canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)

        def _wheel_training(event):
            if event.delta:
                canvas.yview_scroll(int(-event.delta / 120), "units")
            elif getattr(event, "num", None) == 4:
                canvas.yview_scroll(-1, "units")
            elif getattr(event, "num", None) == 5:
                canvas.yview_scroll(1, "units")

        for w in (canvas, table_host, wrap):
            w.bind("<MouseWheel>", _wheel_training)
            w.bind("<Button-4>", _wheel_training)
            w.bind("<Button-5>", _wheel_training)
    
    def show_inbox_view(self):
        """Show unread/read notifications alongside the current day's agenda."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        self.selected_calendar_date = self.current_date
        self.calendar_month_anchor = self.current_date.replace(day=1)
        self.refresh_date_display()
        self._sort_notifications()

        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True, padx=28, pady=28)

        header = tk.Frame(frame, bg=self.colors['bg_content'])
        header.pack(fill=tk.X, pady=(0, 20))

        tk.Label(
            header,
            text="INBOX",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 28, 'bold'),
        ).pack(anchor="w")

        if self.player_group:
            tk.Label(
                header,
                text=f"Producer Group: {self.player_group.name or self.player_group.name_romanji}",
                bg=self.colors['bg_content'],
                fg=self.colors['yellow'],
                font=('Arial', 14, 'bold'),
            ).pack(anchor="w", pady=(6, 0))

        tk.Label(
            header,
            text=self.current_date.strftime('%A, %B %d, %Y'),
            bg=self.colors['bg_content'],
            fg=self.colors['text_secondary'],
            font=('Arial', 13),
        ).pack(anchor="w", pady=(6, 0))
        self._update_continue_button()

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(0, weight=1)
        body.columnconfigure(1, weight=3)
        body.rowconfigure(0, weight=1)

        selected_item = self._ensure_selected_notification()

        inbox_panel = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        inbox_panel.grid(row=0, column=0, sticky="nsew", padx=(0, 20))
        detail_panel = tk.Frame(body, bg=self.colors['bg_card'], padx=20, pady=20)
        detail_panel.grid(row=0, column=1, sticky="nsew")

        tk.Label(
            inbox_panel,
            text="Messages",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 16, 'bold'),
        ).pack(anchor="w", pady=(0, 12))

        if not self._notifications:
            tk.Label(
                inbox_panel,
                text="No inbox messages are waiting right now.",
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                font=('Arial', 11),
            ).pack(anchor="w")
        else:
            for item in self._notifications:
                self._build_notification_card(inbox_panel, item)

        tk.Label(
            detail_panel,
            text="Message",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 16, 'bold'),
        ).pack(anchor="w", pady=(0, 12))
        if selected_item is None:
            tk.Label(
                detail_panel,
                text="Select a notification from the list.",
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                font=('Arial', 12),
            ).pack(anchor="w")
        else:
            if self._notification_requires_confirmation(selected_item):
                badge_text = "Decision Required" if str(selected_item.get("choice_status") or "") == "pending" else "Confirmation Required"
                tk.Label(
                    detail_panel,
                    text=badge_text,
                    bg=self.colors['red'],
                    fg=self.colors['text_primary'],
                    font=('Arial', 10, 'bold'),
                    padx=10,
                    pady=4,
                ).pack(anchor="w", pady=(0, 10))
            tk.Label(
                detail_panel,
                text=str(selected_item.get("title") or "Notification"),
                bg=self.colors['bg_card'],
                fg=self.colors['text_primary'],
                font=('Arial', 20, 'bold'),
                justify=tk.LEFT,
                wraplength=980,
            ).pack(anchor="w")
            tk.Label(
                detail_panel,
                text=f"{str(selected_item.get('sender') or 'Assistant')} | {str(selected_item.get('date') or '')} | {str(selected_item.get('category') or 'general').title()} | {'Unread' if not selected_item.get('read') else 'Read'}",
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                font=('Arial', 10),
            ).pack(anchor="w", pady=(6, 14))
            self._render_notification_detail_content(detail_panel, selected_item)
            choice_status = str(selected_item.get("choice_status") or "")
            if choice_status == "pending":
                choice_row = tk.Frame(detail_panel, bg=self.colors['bg_card'])
                choice_row.pack(anchor="w", pady=(18, 0))
                for option in selected_item.get("choice_options", []) or []:
                    if not isinstance(option, dict):
                        continue
                    tk.Button(
                        choice_row,
                        text=str(option.get("label") or option.get("value") or "Choose"),
                        bg=self.colors['accent'],
                        fg=self.colors['text_primary'],
                        relief=tk.FLAT,
                        padx=14,
                        pady=8,
                        font=('Arial', 10, 'bold'),
                        command=lambda uid=str(selected_item.get("uid") or ""), value=str(option.get("value") or ""): self._resolve_notification_choice(uid, value),
                        cursor='hand2',
                    ).pack(side=tk.LEFT, padx=(0, 10))
            elif self._notification_requires_confirmation(selected_item) and not selected_item.get("read"):
                button_label = "Live Start" if str(selected_item.get("title") or "") == "Today's live schedule" else "Confirm and Clear"
                tk.Button(
                    detail_panel,
                    text=button_label,
                    bg=self.colors['accent'],
                    fg=self.colors['text_primary'],
                    relief=tk.FLAT,
                    padx=14,
                    pady=8,
                    font=('Arial', 10, 'bold'),
                    command=lambda uid=str(selected_item.get("uid") or ""): self._acknowledge_notification(uid),
                    cursor='hand2',
                ).pack(anchor="w", pady=(18, 0))
    
    def show_lives_view(self, tab: Optional[str] = None):
        """Show the managed live planner with new/scheduled/past tabs."""
        if tab:
            self._lives_tab = tab

        for widget in self.content_frame.winfo_children():
            widget.destroy()

        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True, padx=24, pady=24)

        tk.Label(
            frame,
            text="LIVES",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 24, 'bold'),
        ).pack(anchor="w")

        subtitle = self.player_group.name if self.player_group else "No managed group selected"
        tk.Label(
            frame,
            text=f"Managed Group: {subtitle}",
            bg=self.colors['bg_content'],
            fg=self.colors['text_secondary'],
            font=('Arial', 11),
        ).pack(anchor="w", pady=(6, 16))

        if not getattr(self, "_data_loaded", False):
            tk.Label(
                frame,
                text="Loading live planner...",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        if not self.player_group:
            tk.Label(
                frame,
                text="Select a managed group to start scheduling lives.",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        tabs = tk.Frame(frame, bg=self.colors['bg_content'])
        tabs.pack(fill=tk.X, pady=(0, 16))
        for key, label in [("new", "New Live"), ("scheduled", "Scheduled"), ("past", "Past"), ("festival", "Festival")]:
            tk.Button(
                tabs,
                text=label,
                bg=self.colors['accent'] if self._lives_tab == key else self.colors['bg_sidebar'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=14,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=lambda tab_key=key: self.show_lives_view(tab_key),
                cursor='hand2',
            ).pack(side=tk.LEFT, padx=(0, 8))

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)

        if self._lives_tab == "festival":
            available = self._get_available_festival_rows()
            aliases = self._get_player_group_aliases()

            toolbar = tk.Frame(body, bg=self.colors['bg_content'])
            toolbar.pack(fill=tk.X, pady=(0, 12))
            tk.Label(
                toolbar,
                text=f"{len(available)} available festival editions from {self.current_date.isoformat()} onward",
                bg=self.colors['bg_content'],
                fg=self.colors['text_secondary'],
                font=('Arial', 10, 'bold'),
            ).pack(side=tk.LEFT)

            shell = tk.Frame(body, bg=self.colors['bg_content'])
            shell.pack(fill=tk.BOTH, expand=True)
            shell.columnconfigure(0, weight=1)
            shell.columnconfigure(1, weight=2)

            left = tk.Frame(shell, bg=self.colors['bg_card'], padx=16, pady=16)
            left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
            right = tk.Frame(shell, bg=self.colors['bg_card'], padx=16, pady=16)
            right.grid(row=0, column=1, sticky="nsew")

            tk.Label(
                left,
                text="Available Festivals",
                bg=self.colors['bg_card'],
                fg=self.colors['text_primary'],
                font=('Arial', 16, 'bold'),
            ).pack(anchor="w")

            columns = ("date", "festival", "managed")
            tree = ttk.Treeview(left, columns=columns, show="headings", height=18)
            for key, heading, width in [
                ("date", "Dates", 150),
                ("festival", "Festival", 220),
                ("managed", "Managed Group", 110),
            ]:
                tree.heading(key, text=heading)
                tree.column(key, width=width, anchor="w")
            y_scroll = tk.Scrollbar(left, orient=tk.VERTICAL, command=tree.yview)
            tree.configure(yscrollcommand=y_scroll.set)
            tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=(12, 0))
            y_scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=(12, 0))

            right.columnconfigure(0, weight=1)
            tk.Label(
                right,
                text="Festival Detail",
                bg=self.colors['bg_card'],
                fg=self.colors['text_primary'],
                font=('Arial', 16, 'bold'),
            ).grid(row=0, column=0, sticky="w")

            detail_var = tk.StringVar(value="Select a festival edition to inspect managed-group attendance and historical slot assignments.")
            tk.Label(
                right,
                textvariable=detail_var,
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                justify=tk.LEFT,
                anchor="nw",
                wraplength=760,
                font=('Arial', 10),
            ).grid(row=1, column=0, sticky="ew", pady=(8, 14))

            current_box = tk.Frame(right, bg=self.colors['accent_light'], padx=12, pady=10)
            current_box.grid(row=2, column=0, sticky="ew")
            current_box.columnconfigure(0, weight=1)
            tk.Label(
                current_box,
                text="Managed Group Attendance",
                bg=self.colors['accent_light'],
                fg=self.colors['text_primary'],
                font=('Arial', 12, 'bold'),
            ).grid(row=0, column=0, sticky="w")
            current_text = tk.Text(
                current_box,
                height=10,
                wrap=tk.WORD,
                bg=self.colors['bg_card'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                font=('Consolas', 10),
            )
            current_text.grid(row=1, column=0, sticky="ew", pady=(8, 0))
            current_text.configure(state=tk.DISABLED)

            history_shell = tk.Frame(right, bg=self.colors['bg_card'])
            history_shell.grid(row=3, column=0, sticky="ew", pady=(14, 10))
            history_shell.columnconfigure(0, weight=1)
            tk.Label(
                history_shell,
                text="Historical Year Links",
                bg=self.colors['bg_card'],
                fg=self.colors['text_primary'],
                font=('Arial', 12, 'bold'),
            ).grid(row=0, column=0, sticky="w")
            history_links = tk.Frame(history_shell, bg=self.colors['bg_card'])
            history_links.grid(row=1, column=0, sticky="w", pady=(8, 0))

            others_box = tk.Frame(right, bg=self.colors['bg_card'])
            others_box.grid(row=4, column=0, sticky="nsew", pady=(4, 0))
            right.rowconfigure(4, weight=1)
            tk.Label(
                others_box,
                text="Other Group Attendance",
                bg=self.colors['bg_card'],
                fg=self.colors['text_primary'],
                font=('Arial', 12, 'bold'),
            ).pack(anchor="w")
            others_tree = ttk.Treeview(
                others_box,
                columns=("date", "time", "stage", "group"),
                show="headings",
                height=16,
            )
            for key, heading, width in [
                ("date", "Date", 100),
                ("time", "Time", 90),
                ("stage", "Stage", 170),
                ("group", "Group", 240),
            ]:
                others_tree.heading(key, text=heading)
                others_tree.column(key, width=width, anchor="w")
            others_scroll = tk.Scrollbar(others_box, orient=tk.VERTICAL, command=others_tree.yview)
            others_tree.configure(yscrollcommand=others_scroll.set)
            others_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=(8, 0))
            others_scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=(8, 0))

            festival_rows_by_item: dict[str, dict] = {}
            for row in available:
                managed_present = "Yes" if any(self._festival_group_matches_player(item, aliases=aliases) for item in iter_festival_slots(row)) else "No"
                item_id = tree.insert(
                    "",
                    "end",
                    values=(
                        f"{row.get('start_date')} -> {row.get('end_date')}",
                        row.get("name_romanji") or row.get("name") or "Festival",
                        managed_present,
                    ),
                )
                festival_rows_by_item[item_id] = row

            def _set_text(widget: tk.Text, lines: list[str]) -> None:
                widget.configure(state=tk.NORMAL)
                widget.delete("1.0", tk.END)
                widget.insert("1.0", "\n".join(lines))
                widget.configure(state=tk.DISABLED)

            def _load_festival_detail(festival_row: dict) -> None:
                festival_name = str(festival_row.get("name_romanji") or festival_row.get("name") or "Festival")
                series = str(festival_row.get("festival_series") or "")
                slots = [slot for slot in iter_festival_slots(festival_row) if isinstance(slot, dict)]
                managed_slots = [slot for slot in slots if self._festival_group_matches_player(slot, aliases=aliases)]
                other_slots = [slot for slot in slots if slot not in managed_slots]
                managed_slots.sort(key=lambda item: (str(item.get("date") or ""), str(item.get("start_time") or "")))
                other_slots.sort(key=lambda item: (str(item.get("date") or ""), str(item.get("start_time") or ""), str(item.get("artist_name") or "")), reverse=True)

                detail_var.set(
                    "\n".join(
                        [
                            festival_name,
                            f"Series: {series or 'Festival'}",
                            f"When: {festival_row.get('start_date')} -> {festival_row.get('end_date')}",
                            f"Location: {festival_row.get('location') or 'TBA'}",
                            f"Managed group appearances: {len(managed_slots)}",
                            f"Other listed slots: {len(other_slots)}",
                        ]
                    )
                )

                managed_lines = []
                if managed_slots:
                    for slot in managed_slots:
                        managed_lines.append(
                            f"{slot.get('date')}  {str(slot.get('start_time') or '')[:5]}-{str(slot.get('end_time') or '')[:5]}  {slot.get('stage') or 'Stage TBA'}"
                        )
                        managed_lines.append(f"  {slot.get('artist_name') or slot.get('title') or 'Managed group'}")
                else:
                    managed_lines.append("No managed-group slot assignment found in the imported festival record.")
                _set_text(current_text, managed_lines)

                for item in others_tree.get_children():
                    others_tree.delete(item)
                for slot in other_slots:
                    others_tree.insert(
                        "",
                        "end",
                        values=(
                            slot.get("date") or "",
                            f"{str(slot.get('start_time') or '')[:5]}-{str(slot.get('end_time') or '')[:5]}",
                            slot.get("stage") or "",
                            slot.get("artist_name") or slot.get("title") or "",
                        ),
                    )

                for child in history_links.winfo_children():
                    child.destroy()
                for historical in self._get_festival_historical_rows(festival_row):
                    hist_name = str(historical.get("name_romanji") or historical.get("name") or "")
                    tk.Button(
                        history_links,
                        text=hist_name,
                        bg=self.colors['bg_sidebar'],
                        fg=self.colors['text_primary'],
                        relief=tk.FLAT,
                        padx=10,
                        pady=6,
                        font=('Arial', 9, 'bold'),
                        command=lambda row=historical: _load_festival_detail(row),
                        cursor='hand2',
                    ).pack(side=tk.LEFT, padx=(0, 8), pady=(0, 4))

            def _on_festival_select(_event=None):
                selected = tree.selection()
                if not selected:
                    return
                festival_row = festival_rows_by_item.get(selected[0])
                if festival_row:
                    _load_festival_detail(festival_row)

            tree.bind("<<TreeviewSelect>>", _on_festival_select)
            if available:
                first = tree.get_children()
                if first:
                    tree.selection_set(first[0])
                    _on_festival_select()
            return

        if self._lives_tab == "scheduled":
            entries = []
            for live in self._get_saved_managed_group_lives():
                live_date = self._parse_live_entry_date(live)
                if live_date and live_date >= self.current_date and str(live.get("status") or "") != "played":
                    entries.append(live)
            entries.sort(key=lambda item: (item.get("start_date") or "", item.get("start_time") or ""))

            toolbar = tk.Frame(body, bg=self.colors['bg_content'])
            toolbar.pack(fill=tk.X, pady=(0, 12))
            tk.Label(
                toolbar,
                text=f"{len(entries)} upcoming lives",
                bg=self.colors['bg_content'],
                fg=self.colors['text_secondary'],
                font=('Arial', 10, 'bold'),
            ).pack(side=tk.LEFT)

            table_frame = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
            table_frame.pack(fill=tk.BOTH, expand=True)
            columns = ("date", "time", "type", "venue", "setlist")
            tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=14)
            for key, heading, width in [
                ("date", "Date", 110),
                ("time", "Time", 120),
                ("type", "Type", 110),
                ("venue", "Venue", 220),
                ("setlist", "Setlist", 90),
            ]:
                tree.heading(key, text=heading)
                tree.column(key, width=width, anchor="w")
            y_scroll = tk.Scrollbar(table_frame, orient=tk.VERTICAL, command=tree.yview)
            tree.configure(yscrollcommand=y_scroll.set)
            tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            y_scroll.pack(side=tk.RIGHT, fill=tk.Y)

            detail_var = tk.StringVar(value="Select a scheduled live to inspect its timing and setlist.")
            details = tk.Label(
                body,
                textvariable=detail_var,
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                justify=tk.LEFT,
                anchor="nw",
                padx=16,
                pady=14,
                font=('Arial', 10),
            )
            details.pack(fill=tk.X, pady=(12, 0))

            row_lookup: dict[str, dict] = {}
            for live in entries:
                item_id = tree.insert(
                    "",
                    "end",
                    values=(
                        live.get("start_date") or "TBD",
                        self._format_live_slot(live),
                        live.get("live_type") or live.get("event_type") or "Live",
                        live.get("venue") or "TBA",
                        len(live.get("setlist") or []),
                    ),
                )
                row_lookup[item_id] = live

            def _refresh_scheduled_detail(_event=None):
                selected = tree.selection()
                if not selected:
                    detail_var.set("Select a scheduled live to inspect its timing and setlist.")
                    return
                live = row_lookup[selected[0]]
                rehearsal_start = str(live.get("rehearsal_start") or "").strip()
                rehearsal_end = str(live.get("rehearsal_end") or "").strip()
                rehearsal_text = "None"
                if rehearsal_start:
                    rehearsal_text = rehearsal_start if not rehearsal_end else f"{rehearsal_start}-{rehearsal_end}"
                setlist = live.get("setlist") or []
                tokutenkai_text = self._format_tokutenkai_summary(live)
                detail_var.set(
                    "\n".join(
                        [
                            f"{live.get('title') or 'Untitled live'}",
                            f"Type: {live.get('live_type') or live.get('event_type')}",
                            f"When: {live.get('start_date')} {self._format_live_slot(live)}",
                            f"Rehearsal: {rehearsal_text}",
                            f"Tokutenkai: {tokutenkai_text}",
                            f"Venue: {live.get('venue') or 'TBA'}",
                            f"Setlist: {', '.join(setlist) if setlist else 'Not set'}",
                        ]
                    )
                )

            def _cancel_selected_live():
                selected = tree.selection()
                if not selected:
                    messagebox.showinfo("Scheduled live", "Select a scheduled live first.")
                    return
                live = row_lookup[selected[0]]
                self._live_schedules = [
                    raw for raw in self._live_schedules
                    if str((self._normalize_live_entry(raw) or {}).get("uid")) != str(live.get("uid"))
                ]
                self._daily_todos_cache.clear()
                self._persist_game_save()
                self.show_lives_view("scheduled")

            tk.Button(
                toolbar,
                text="Cancel Selected",
                bg=self.colors['red'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=_cancel_selected_live,
                cursor='hand2',
            ).pack(side=tk.RIGHT)
            tree.bind("<<TreeviewSelect>>", _refresh_scheduled_detail)
            return

        if self._lives_tab == "past":
            past_by_uid: dict[str, dict] = {}
            for raw_live in self._live_results:
                live = self._normalize_live_entry(raw_live)
                if live:
                    past_by_uid[str(live.get("uid"))] = live
            for live in self._get_saved_managed_group_lives():
                live_date = self._parse_live_entry_date(live)
                if live_date and live_date < self.current_date:
                    past_by_uid[str(live.get("uid"))] = live

            entries = sorted(
                past_by_uid.values(),
                key=lambda item: (item.get("start_date") or "", item.get("start_time") or ""),
                reverse=True,
            )

            tk.Label(
                body,
                text=f"{len(entries)} completed lives",
                bg=self.colors['bg_content'],
                fg=self.colors['text_secondary'],
                font=('Arial', 10, 'bold'),
            ).pack(anchor="w", pady=(0, 12))

            table_frame = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
            table_frame.pack(fill=tk.BOTH, expand=True)
            columns = ("date", "time", "type", "venue", "status")
            tree = ttk.Treeview(table_frame, columns=columns, show="headings", height=16)
            for key, heading, width in [
                ("date", "Date", 110),
                ("time", "Time", 120),
                ("type", "Type", 110),
                ("venue", "Venue", 220),
                ("status", "Status", 90),
            ]:
                tree.heading(key, text=heading)
                tree.column(key, width=width, anchor="w")
            y_scroll = tk.Scrollbar(table_frame, orient=tk.VERTICAL, command=tree.yview)
            tree.configure(yscrollcommand=y_scroll.set)
            tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            y_scroll.pack(side=tk.RIGHT, fill=tk.Y)

            detail_var = tk.StringVar(value="Past lives move here automatically after their day closes.")
            details = tk.Label(
                body,
                textvariable=detail_var,
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                justify=tk.LEFT,
                anchor="nw",
                padx=16,
                pady=14,
                font=('Arial', 10),
            )
            details.pack(fill=tk.X, pady=(12, 0))

            row_lookup: dict[str, dict] = {}
            for live in entries:
                item_id = tree.insert(
                    "",
                    "end",
                    values=(
                        live.get("start_date") or "TBD",
                        self._format_live_slot(live),
                        live.get("live_type") or live.get("event_type") or "Live",
                        live.get("venue") or "TBA",
                        live.get("status") or "played",
                    ),
                )
                row_lookup[item_id] = live

            def _refresh_past_detail(_event=None):
                selected = tree.selection()
                if not selected:
                    detail_var.set("Past lives move here automatically after their day closes.")
                    return
                live = row_lookup[selected[0]]
                setlist = live.get("setlist") or []
                tokutenkai_text = self._format_tokutenkai_summary(live)
                detail_var.set(
                    "\n".join(
                        [
                            f"{live.get('title') or 'Untitled live'}",
                            f"When: {live.get('start_date')} {self._format_live_slot(live)}",
                            f"Venue: {live.get('venue') or 'TBA'}",
                            f"Status: {live.get('status') or 'played'}",
                            f"Performance: {live.get('performance_score') or 'n/a'} / 100",
                            f"Audience satisfaction: {live.get('audience_satisfaction') or 'n/a'} / 100",
                            f"Expectation: {live.get('expectation_score') or 'n/a'} / 100",
                            f"Novelty boost: {live.get('novelty_score') or 0} (songs {int(live.get('recent_song_count') or 0)}, releases {int(live.get('recent_disc_count') or 0)}, fresh setlist {int(live.get('setlist_fresh_count') or 0)}, costume {live.get('costume_refresh_bonus') or 0})",
                            f"Attendance: {live.get('attendance') if live.get('attendance') is not None else 'n/a'}",
                            f"Broadcast exposure: {int(live.get('broadcast_exposure') or 0):,}",
                            f"Total exposure: {int(live.get('exposure_count') or 0):,}",
                            f"Fan change: {int(live.get('fan_gain') or 0):+,}",
                            f"Tokutenkai: {tokutenkai_text}",
                            f"Tokutenkai actual tickets: {int(live.get('tokutenkai_actual_tickets') or 0):,}",
                            f"Setlist: {', '.join(setlist) if setlist else 'Not set'}",
                        ]
                    )
                )

            tree.bind("<<TreeviewSelect>>", _refresh_past_detail)
            return

        presets = self._get_live_type_presets()
        venues = self._load_venues_data()
        venue_by_name = {str(venue.get("name")): venue for venue in venues if venue.get("name")}
        group_name = self.player_group.name_romanji or self.player_group.name

        state = dict(self._new_live_form_state)
        state.setdefault("date", self.current_date.isoformat())
        state.setdefault("setlist", [])

        form = tk.Frame(body, bg=self.colors['bg_content'])
        form.pack(fill=tk.BOTH, expand=True)
        form.columnconfigure(0, weight=2)
        form.columnconfigure(1, weight=1)

        left = tk.Frame(form, bg=self.colors['bg_card'], padx=18, pady=18)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        right = tk.Frame(form, bg=self.colors['bg_card'], padx=18, pady=18)
        right.grid(row=0, column=1, sticky="nsew")

        type_var = tk.StringVar(value=str(state.get("live_type") or "Concert"))
        title_var = tk.StringVar(value=str(state.get("title") or ""))
        date_var = tk.StringVar(value=str(state.get("date") or self.current_date.isoformat()))
        start_var = tk.StringVar(value=str(state.get("start_time") or "18:00"))
        end_var = tk.StringVar(value=str(state.get("end_time") or "20:00"))
        rehearsal_start_var = tk.StringVar(value=str(state.get("rehearsal_start") or "12:00"))
        rehearsal_end_var = tk.StringVar(value=str(state.get("rehearsal_end") or "16:00"))
        venue_var = tk.StringVar(value=str(state.get("venue_name") or ""))
        custom_song_var = tk.StringVar(value="")
        summary_var = tk.StringVar()
        live_duration_var = tk.StringVar(value="2h")
        rehearsal_duration_var = tk.StringVar(value="4h")
        tokutenkai_enabled_var = tk.BooleanVar(value=bool(state.get("tokutenkai_enabled")))
        tokutenkai_start_var = tk.StringVar(value=str(state.get("tokutenkai_start") or state.get("end_time") or "20:00"))
        tokutenkai_end_var = tk.StringVar(value=str(state.get("tokutenkai_end") or state.get("end_time") or "20:00"))
        tokutenkai_price_var = tk.StringVar(value=str(state.get("tokutenkai_ticket_price") or 2000))
        tokutenkai_slot_var = tk.StringVar(value=str(state.get("tokutenkai_slot_seconds") or 40))
        tokutenkai_expected_var = tk.StringVar(value=str(state.get("tokutenkai_expected_tickets") or 0))
        tokutenkai_duration_var = tk.StringVar(value="")
        tokutenkai_capacity_var = tk.StringVar(value="")

        tk.Label(left, text="Build New Live", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).grid(row=0, column=0, columnspan=4, sticky="w")

        def _label(parent, text, row, col):
            tk.Label(parent, text=text, bg=parent.cget("bg"), fg=self.colors['text_secondary'], font=('Arial', 10, 'bold')).grid(row=row, column=col, sticky="w", pady=(14, 4))

        _label(left, "Type", 1, 0)
        type_combo = ttk.Combobox(left, textvariable=type_var, values=list(presets.keys()), state="readonly", width=18)
        type_combo.grid(row=2, column=0, sticky="ew", padx=(0, 10))
        _label(left, "Date", 1, 1)
        tk.Entry(left, textvariable=date_var, font=('Arial', 10)).grid(row=2, column=1, sticky="ew", padx=(0, 10))
        _label(left, "Live Start", 1, 2)
        tk.Entry(left, textvariable=start_var, font=('Arial', 10)).grid(row=2, column=2, sticky="ew", padx=(0, 10))
        _label(left, "Live End", 1, 3)
        tk.Entry(left, textvariable=end_var, font=('Arial', 10)).grid(row=2, column=3, sticky="ew")

        _label(left, "Title", 3, 0)
        tk.Entry(left, textvariable=title_var, font=('Arial', 10)).grid(row=4, column=0, columnspan=2, sticky="ew", padx=(0, 10))
        _label(left, "Rehearsal Start", 3, 2)
        rehearsal_start_entry = tk.Entry(left, textvariable=rehearsal_start_var, font=('Arial', 10))
        rehearsal_start_entry.grid(row=4, column=2, sticky="ew", padx=(0, 10))
        _label(left, "Rehearsal End", 3, 3)
        rehearsal_end_entry = tk.Entry(left, textvariable=rehearsal_end_var, font=('Arial', 10))
        rehearsal_end_entry.grid(row=4, column=3, sticky="ew")
        tk.Label(
            left,
            textvariable=live_duration_var,
            bg=self.colors['bg_card'],
            fg=self.colors['yellow'],
            anchor="w",
            font=('Arial', 10, 'bold'),
        ).grid(row=3, column=2, columnspan=2, sticky="e", pady=(6, 0))
        tk.Label(
            left,
            textvariable=rehearsal_duration_var,
            bg=self.colors['bg_card'],
            fg=self.colors['yellow'],
            anchor="w",
            font=('Arial', 10, 'bold'),
        ).grid(row=5, column=2, columnspan=2, sticky="e", pady=(6, 0))

        _label(left, "Venue", 5, 0)
        venue_combo = ttk.Combobox(left, textvariable=venue_var, values=sorted(venue_by_name.keys()), width=42)
        venue_combo.grid(row=6, column=0, columnspan=4, sticky="ew")
        venue_info_var = tk.StringVar(value="Select a venue to view location and capacity.")
        tk.Label(
            left,
            textvariable=venue_info_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            justify=tk.LEFT,
            anchor="w",
            font=('Arial', 10),
        ).grid(row=7, column=0, columnspan=4, sticky="ew", pady=(8, 0))

        tokutenkai_card = tk.Frame(left, bg=self.colors['accent_light'], padx=12, pady=10)
        tokutenkai_card.grid(row=8, column=0, columnspan=4, sticky="ew", pady=(16, 0))
        tokutenkai_card.columnconfigure(1, weight=1)
        tokutenkai_card.columnconfigure(3, weight=1)
        tk.Checkbutton(
            tokutenkai_card,
            text="Post-live tokutenkai / cheki",
            variable=tokutenkai_enabled_var,
            bg=self.colors['accent_light'],
            fg=self.colors['text_primary'],
            activebackground=self.colors['accent_light'],
            activeforeground=self.colors['text_primary'],
            selectcolor=self.colors['bg_sidebar'],
            font=('Arial', 10, 'bold'),
            command=lambda: _refresh_summary(),
        ).grid(row=0, column=0, columnspan=4, sticky="w")
        tk.Label(tokutenkai_card, text="Tokutenkai Start", bg=self.colors['accent_light'], fg=self.colors['text_primary'], font=('Arial', 9, 'bold')).grid(row=1, column=0, sticky="w", pady=(10, 4))
        tk.Entry(tokutenkai_card, textvariable=tokutenkai_start_var, font=('Arial', 10), width=10).grid(row=2, column=0, sticky="ew", padx=(0, 10))
        tk.Label(tokutenkai_card, text="Tokutenkai End", bg=self.colors['accent_light'], fg=self.colors['text_primary'], font=('Arial', 9, 'bold')).grid(row=1, column=1, sticky="w", pady=(10, 4))
        tk.Entry(tokutenkai_card, textvariable=tokutenkai_end_var, font=('Arial', 10), width=10).grid(row=2, column=1, sticky="ew", padx=(0, 10))
        tk.Label(tokutenkai_card, text="Ticket Price", bg=self.colors['accent_light'], fg=self.colors['text_primary'], font=('Arial', 9, 'bold')).grid(row=1, column=2, sticky="w", pady=(10, 4))
        tk.Entry(tokutenkai_card, textvariable=tokutenkai_price_var, font=('Arial', 10), width=10).grid(row=2, column=2, sticky="ew", padx=(0, 10))
        tk.Label(tokutenkai_card, text="Talk Slot (sec)", bg=self.colors['accent_light'], fg=self.colors['text_primary'], font=('Arial', 9, 'bold')).grid(row=1, column=3, sticky="w", pady=(10, 4))
        tk.Entry(tokutenkai_card, textvariable=tokutenkai_slot_var, font=('Arial', 10), width=10).grid(row=2, column=3, sticky="ew")
        tk.Label(tokutenkai_card, text="Expected Tickets", bg=self.colors['accent_light'], fg=self.colors['text_primary'], font=('Arial', 9, 'bold')).grid(row=3, column=0, sticky="w", pady=(10, 4))
        tk.Entry(tokutenkai_card, textvariable=tokutenkai_expected_var, font=('Arial', 10), width=10).grid(row=4, column=0, sticky="ew", padx=(0, 10))
        tk.Label(tokutenkai_card, textvariable=tokutenkai_capacity_var, bg=self.colors['accent_light'], fg=self.colors['text_primary'], anchor="w", justify=tk.LEFT, font=('Arial', 9, 'bold')).grid(row=4, column=1, columnspan=2, sticky="w")
        tk.Label(tokutenkai_card, textvariable=tokutenkai_duration_var, bg=self.colors['accent_light'], fg=self.colors['text_primary'], anchor="e", justify=tk.RIGHT, font=('Arial', 9, 'bold')).grid(row=4, column=3, sticky="e")

        left.columnconfigure(0, weight=1)
        left.columnconfigure(1, weight=1)
        left.columnconfigure(2, weight=1)
        left.columnconfigure(3, weight=1)

        song_frame = tk.Frame(left, bg=self.colors['bg_card'])
        song_frame.grid(row=9, column=0, columnspan=4, sticky="nsew", pady=(18, 0))
        song_frame.columnconfigure(0, weight=1)
        song_frame.columnconfigure(2, weight=1)
        left.rowconfigure(9, weight=1)

        tk.Label(song_frame, text="Group Songs", bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 10, 'bold')).grid(row=0, column=0, sticky="w")
        tk.Label(song_frame, text="Setlist", bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 10, 'bold')).grid(row=0, column=2, sticky="w")

        available_entries = self._collect_group_song_entries(self.player_group)
        popularity_by_title = {
            str(entry.get("title") or ""): self._format_song_popularity(entry.get("popularity"))
            for entry in available_entries
            if str(entry.get("title") or "")
        }
        available_box = ttk.Treeview(
            song_frame,
            columns=("popularity",),
            show="tree headings",
            height=12,
            selectmode="extended",
        )
        selected_box = ttk.Treeview(
            song_frame,
            columns=("popularity",),
            show="tree headings",
            height=12,
            selectmode="extended",
        )
        for tree_widget in (available_box, selected_box):
            tree_widget.heading("#0", text="Title")
            tree_widget.column("#0", width=280, minwidth=220, stretch=True, anchor="w")
            tree_widget.heading("popularity", text="Popularity")
            tree_widget.column("popularity", width=90, minwidth=80, stretch=False, anchor="center")
        for entry in available_entries:
            song_title = str(entry.get("title") or "").strip()
            if not song_title:
                continue
            available_box.insert("", tk.END, text=song_title, values=(popularity_by_title.get(song_title, self._format_song_popularity(None)),))
        for song_title in state.get("setlist", []):
            selected_box.insert("", tk.END, text=song_title, values=(popularity_by_title.get(song_title, self._format_song_popularity(None)),))
        available_box.grid(row=1, column=0, sticky="nsew")
        selected_box.grid(row=1, column=2, sticky="nsew")
        song_frame.rowconfigure(1, weight=1)

        actions = tk.Frame(song_frame, bg=self.colors['bg_card'])
        actions.grid(row=1, column=1, padx=12)

        def _selected_tree_titles(tree_widget) -> list[str]:
            return [str(tree_widget.item(item_id, "text") or "") for item_id in tree_widget.get_children()]

        def _insert_selected_song(song_title: str):
            existing = _selected_tree_titles(selected_box)
            if song_title not in existing:
                selected_box.insert("", tk.END, text=song_title, values=(popularity_by_title.get(song_title, self._format_song_popularity(None)),))

        def _add_selected_songs():
            for item_id in available_box.selection():
                song_title = str(available_box.item(item_id, "text") or "").strip()
                if song_title:
                    _insert_selected_song(song_title)
            _refresh_summary()

        def _remove_selected_songs():
            for item_id in selected_box.selection():
                selected_box.delete(item_id)
            _refresh_summary()

        def _add_custom_song():
            song_title = custom_song_var.get().strip()
            if not song_title:
                return
            _insert_selected_song(song_title)
            custom_song_var.set("")
            _refresh_summary()

        tk.Button(actions, text="Add ->", bg=self.colors['accent'], fg=self.colors['text_primary'], relief=tk.FLAT, padx=10, pady=6, command=_add_selected_songs, cursor='hand2').pack(fill=tk.X, pady=(10, 6))
        tk.Button(actions, text="<- Remove", bg=self.colors['bg_sidebar'], fg=self.colors['text_primary'], relief=tk.FLAT, padx=10, pady=6, command=_remove_selected_songs, cursor='hand2').pack(fill=tk.X)

        custom_row = tk.Frame(left, bg=self.colors['bg_card'])
        custom_row.grid(row=10, column=0, columnspan=4, sticky="ew", pady=(12, 0))
        tk.Entry(custom_row, textvariable=custom_song_var, font=('Arial', 10)).pack(side=tk.LEFT, fill=tk.X, expand=True, padx=(0, 10))
        tk.Button(custom_row, text="Add Custom Song", bg=self.colors['bg_sidebar'], fg=self.colors['text_primary'], relief=tk.FLAT, padx=10, pady=6, command=_add_custom_song, cursor='hand2').pack(side=tk.RIGHT)

        tk.Label(right, text="Live Summary", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w")
        tk.Label(right, textvariable=summary_var, bg=self.colors['bg_card'], fg=self.colors['text_secondary'], justify=tk.LEFT, anchor="nw", font=('Arial', 10)).pack(fill=tk.X, pady=(12, 0))

        def _suggest_title() -> str:
            venue_name = venue_var.get().strip()
            date_text = date_var.get().strip()
            live_type = type_var.get().strip()
            venue_part = f" @ {venue_name}" if venue_name else ""
            date_part = f" {date_text}" if date_text else ""
            return f"{group_name} {live_type}{venue_part}{date_part}".strip()

        def _apply_type_defaults(_event=None):
            preset = presets.get(type_var.get(), presets["Routine"])
            start_var.set(str(preset["default_start_time"]))
            default_live_end = self._compute_live_end_time(str(preset["default_start_time"]), preset["default_duration"])
            end_var.set(default_live_end)
            rehearsal_start_var.set(str(preset["rehearsal_start"]))
            rehearsal_end_var.set(str(preset["rehearsal_end"]))
            tokutenkai_enabled_var.set(bool(preset.get("tokutenkai_enabled")))
            tokutenkai_start_var.set(default_live_end)
            tokutenkai_end_var.set(
                self._compute_end_time_from_duration(default_live_end, preset.get("tokutenkai_duration", 0) or 0)
                if preset.get("tokutenkai_enabled")
                else default_live_end
            )
            tokutenkai_price_var.set(str(preset.get("tokutenkai_ticket_price", 2000)))
            tokutenkai_slot_var.set(str(preset.get("tokutenkai_slot_seconds", 40)))
            tokutenkai_expected_var.set(str(preset.get("tokutenkai_expected_tickets", 0)))
            if not title_var.get().strip():
                title_var.set(_suggest_title())
            _refresh_summary()

        def _refresh_summary(*_args):
            venue = venue_by_name.get(venue_var.get().strip(), {})
            setlist = _selected_tree_titles(selected_box)
            rehearsal_text = "None"
            if rehearsal_start_var.get().strip():
                rehearsal_text = rehearsal_start_var.get().strip()
                if rehearsal_end_var.get().strip():
                    rehearsal_text = f"{rehearsal_text}-{rehearsal_end_var.get().strip()}"
            if venue:
                venue_info_var.set(
                    f"Location: {venue.get('location') or 'Not set'}    Capacity: {venue.get('capacity') or 'Unknown'}"
                )
            elif venue_var.get().strip():
                venue_info_var.set("Venue not found in database. Capacity unavailable.")
            else:
                venue_info_var.set("Select a venue to view location and capacity.")
            live_duration_var.set(f"Live Duration: {self._compute_time_duration_text(start_var.get().strip() or '18:00', end_var.get().strip() or '20:00')}")
            if rehearsal_start_var.get().strip() and rehearsal_end_var.get().strip():
                rehearsal_duration_var.set(
                    f"Rehearsal Duration: {self._compute_time_duration_text(rehearsal_start_var.get().strip(), rehearsal_end_var.get().strip())}"
                )
            else:
                rehearsal_duration_var.set("Rehearsal Duration: None")
            try:
                tokutenkai_price = max(0, int(tokutenkai_price_var.get().strip() or "0"))
            except ValueError:
                tokutenkai_price = 0
            try:
                tokutenkai_slot = max(1, int(tokutenkai_slot_var.get().strip() or "40"))
            except ValueError:
                tokutenkai_slot = 40
            try:
                tokutenkai_expected = max(0, int(tokutenkai_expected_var.get().strip() or "0"))
            except ValueError:
                tokutenkai_expected = 0
            preset = presets.get(type_var.get(), presets["Routine"])
            member_count = len(getattr(self.player_group, "members", []) or [])
            tokutenkai_start = tokutenkai_start_var.get().strip() or end_var.get().strip() or self._compute_live_end_time(start_var.get().strip() or "18:00", preset["default_duration"])
            tokutenkai_end = tokutenkai_end_var.get().strip()
            if tokutenkai_enabled_var.get() and not tokutenkai_end:
                tokutenkai_end = self._compute_end_time_from_duration(tokutenkai_start, preset.get("tokutenkai_duration", 0) or 0)
            dual_max_kw: dict[str, object] = {}
            if type_var.get() == "Taiban":
                dual_max_kw = {
                    "secondary_slot_seconds": int(preset.get("tokutenkai_slot_seconds_secondary", 20)),
                    "tier_split_primary": float(preset.get("tokutenkai_tier_split_primary", 0.5)),
                }
            max_tickets = self._calculate_tokutenkai_max_tickets(
                tokutenkai_start, tokutenkai_end, tokutenkai_slot, member_count, **dual_max_kw
            )
            tokutenkai_duration_var.set(
                f"Tokutenkai: {self._compute_time_duration_text(tokutenkai_start, tokutenkai_end)}"
                if tokutenkai_enabled_var.get() and max_tickets >= 0 and tokutenkai_end
                else "Tokutenkai: None"
            )
            tokutenkai_capacity_var.set(
                f"Members: {member_count} | Max tickets: {max_tickets}"
                if tokutenkai_enabled_var.get()
                else "Members: - | Max tickets: -"
            )
            if tokutenkai_enabled_var.get():
                if type_var.get() == "Taiban":
                    p2 = int(preset.get("tokutenkai_ticket_price_secondary", 3000))
                    s2 = int(preset.get("tokutenkai_slot_seconds_secondary", 20))
                    tokutenkai_summary = (
                        f"{tokutenkai_start}-{tokutenkai_end} | ¥{tokutenkai_price:,}/{tokutenkai_slot}s & ¥{p2:,}/{s2}s (50/50) | "
                        f"est. {tokutenkai_expected} tickets | max {max_tickets}"
                    )
                else:
                    tokutenkai_summary = (
                        f"{tokutenkai_start}-{tokutenkai_end} | ¥{tokutenkai_price:,}/ticket | {tokutenkai_slot}s each | "
                        f"est. {tokutenkai_expected} tickets | max {max_tickets}"
                    )
            else:
                tokutenkai_summary = "None"
            summary_var.set(
                "\n".join(
                    [
                        f"Type: {type_var.get()}",
                        f"Date: {date_var.get().strip() or 'TBD'}",
                        f"Live slot: {start_var.get().strip() or '18:00'}-{end_var.get().strip() or '20:00'}",
                        f"Live duration: {self._compute_time_duration_text(start_var.get().strip() or '18:00', end_var.get().strip() or '20:00')}",
                        f"Rehearsal: {rehearsal_text}",
                        f"Rehearsal duration: {self._compute_time_duration_text(rehearsal_start_var.get().strip(), rehearsal_end_var.get().strip()) if rehearsal_start_var.get().strip() and rehearsal_end_var.get().strip() else 'None'}",
                        f"Tokutenkai: {tokutenkai_summary}",
                        f"Venue: {venue_var.get().strip() or 'TBA'}",
                        f"Location: {venue.get('location') or 'Not set'}",
                        f"Capacity: {venue.get('capacity') or 'Unknown'}",
                        f"Setlist songs: {len(setlist)}",
                        f"Preset note: {preset['notes']}",
                    ]
                )
            )

        def _schedule_live():
            live_date_text = date_var.get().strip()
            try:
                live_date = date.fromisoformat(live_date_text)
            except ValueError:
                messagebox.showerror("New live", "Date must use YYYY-MM-DD.")
                return

            start_minutes, _ = self._parse_time_block(start_var.get().strip())
            end_minutes, _ = self._parse_time_block(end_var.get().strip())
            if end_minutes <= start_minutes:
                messagebox.showerror("New live", "Live end time must be later than live start time.")
                return
            duration_minutes = end_minutes - start_minutes

            rehearsal_start_text = rehearsal_start_var.get().strip()
            rehearsal_end_text = rehearsal_end_var.get().strip()
            if bool(rehearsal_start_text) != bool(rehearsal_end_text):
                messagebox.showerror("New live", "Enter both rehearsal start and rehearsal end, or leave both blank.")
                return
            if rehearsal_start_text and rehearsal_end_text:
                rehearsal_start_minutes, _ = self._parse_time_block(rehearsal_start_text)
                rehearsal_end_minutes, _ = self._parse_time_block(rehearsal_end_text)
                if rehearsal_end_minutes <= rehearsal_start_minutes:
                    messagebox.showerror("New live", "Rehearsal end time must be later than rehearsal start time.")
                    return

            venue_name = venue_var.get().strip()
            venue_info = venue_by_name.get(venue_name, {})
            title = title_var.get().strip() or _suggest_title()
            group_names = [name for name in [self.player_group.name, self.player_group.name_romanji] if name]
            setlist = _selected_tree_titles(selected_box)
            tokutenkai_enabled = bool(tokutenkai_enabled_var.get())
            try:
                tokutenkai_ticket_price = max(0, int(tokutenkai_price_var.get().strip() or "0"))
            except ValueError:
                messagebox.showerror("New live", "Tokutenkai ticket price must be a whole number.")
                return
            try:
                tokutenkai_slot_seconds = max(1, int(tokutenkai_slot_var.get().strip() or "40"))
            except ValueError:
                messagebox.showerror("New live", "Tokutenkai talk slot must be a whole number of seconds.")
                return
            try:
                tokutenkai_expected_tickets = max(0, int(tokutenkai_expected_var.get().strip() or "0"))
            except ValueError:
                messagebox.showerror("New live", "Expected tokutenkai tickets must be a whole number.")
                return
            tokutenkai_start = tokutenkai_start_var.get().strip() if tokutenkai_enabled else ""
            tokutenkai_end = tokutenkai_end_var.get().strip() if tokutenkai_enabled else ""
            tokutenkai_duration = 0
            max_tokutenkai_tickets = 0
            if tokutenkai_enabled:
                if not tokutenkai_start:
                    tokutenkai_start = end_var.get().strip() or self._compute_live_end_time(start_var.get().strip(), duration_minutes)
                if not tokutenkai_end:
                    tokutenkai_end = self._compute_end_time_from_duration(
                        tokutenkai_start,
                        presets[type_var.get()].get("tokutenkai_duration", 0) or 0,
                    )
                tokutenkai_start_minutes, _ = self._parse_time_block(tokutenkai_start)
                tokutenkai_end_minutes, _ = self._parse_time_block(tokutenkai_end)
                if tokutenkai_end_minutes <= tokutenkai_start_minutes:
                    messagebox.showerror("New live", "Tokutenkai end time must be later than tokutenkai start time.")
                    return
                tokutenkai_duration = tokutenkai_end_minutes - tokutenkai_start_minutes
                dual_schedule_kw: dict[str, object] = {}
                if type_var.get() == "Taiban":
                    tp = presets.get("Taiban", {})
                    dual_schedule_kw = {
                        "secondary_slot_seconds": int(tp.get("tokutenkai_slot_seconds_secondary", 20)),
                        "tier_split_primary": float(tp.get("tokutenkai_tier_split_primary", 0.5)),
                    }
                max_tokutenkai_tickets = self._calculate_tokutenkai_max_tickets(
                    tokutenkai_start,
                    tokutenkai_end,
                    tokutenkai_slot_seconds,
                    len(getattr(self.player_group, "members", []) or []),
                    **dual_schedule_kw,
                )
                if tokutenkai_expected_tickets > max_tokutenkai_tickets:
                    messagebox.showerror(
                        "New live",
                        f"Expected tokutenkai tickets ({tokutenkai_expected_tickets}) cannot exceed max capacity ({max_tokutenkai_tickets}).",
                    )
                    return
            live_uid_seed = f"{title}|{live_date.isoformat()}|{venue_name}|{type_var.get()}|{len(self._live_schedules)}"
            live_uid = hashlib.sha256(live_uid_seed.encode("utf-8")).hexdigest()[:16]
            live = {
                "uid": live_uid,
                "title": title,
                "title_romanji": "",
                "event_type": presets[type_var.get()]["event_type"],
                "live_type": type_var.get(),
                "start_date": live_date.isoformat(),
                "end_date": live_date.isoformat(),
                "start_time": start_var.get().strip() or str(presets[type_var.get()]["default_start_time"]),
                "end_time": end_var.get().strip(),
                "duration": duration_minutes,
                "rehearsal_start": rehearsal_start_text,
                "rehearsal_end": rehearsal_end_text,
                "venue": venue_name or None,
                "venue_uid": venue_info.get("uid"),
                "location": venue_info.get("location", ""),
                "description": f"Managed {type_var.get().lower()} for {group_name}.",
                "performance_count": 1,
                "capacity": venue_info.get("capacity"),
                "attendance": None,
                "ticket_price": None,
                "poster_image_path": None,
                "setlist": setlist,
                "tokutenkai_enabled": tokutenkai_enabled,
                "tokutenkai_start": tokutenkai_start,
                "tokutenkai_end": tokutenkai_end,
                "tokutenkai_duration": tokutenkai_duration,
                "tokutenkai_ticket_price": tokutenkai_ticket_price,
                "tokutenkai_slot_seconds": tokutenkai_slot_seconds,
                "tokutenkai_expected_tickets": tokutenkai_expected_tickets,
                "group": group_names,
                "status": "scheduled",
            }
            if type_var.get() == "Taiban":
                tp = presets.get("Taiban", {})
                live["tokutenkai_ticket_price_secondary"] = int(tp.get("tokutenkai_ticket_price_secondary", 3000))
                live["tokutenkai_slot_seconds_secondary"] = int(tp.get("tokutenkai_slot_seconds_secondary", 20))
                live["tokutenkai_tier_split_primary"] = float(tp.get("tokutenkai_tier_split_primary", 0.5))
            self._append_scheduled_live(live, notify=True, scheduled_on=self.current_date)
            self._new_live_form_state = {
                "live_type": type_var.get(),
                "title": "",
                "date": live_date.isoformat(),
                "start_time": str(presets[type_var.get()]["default_start_time"]),
                "end_time": self._compute_live_end_time(str(presets[type_var.get()]["default_start_time"]), presets[type_var.get()]["default_duration"]),
                "rehearsal_start": str(presets[type_var.get()]["rehearsal_start"]),
                "rehearsal_end": str(presets[type_var.get()]["rehearsal_end"]),
                "venue_name": venue_name,
                "setlist": [],
                "tokutenkai_enabled": bool(presets[type_var.get()].get("tokutenkai_enabled")),
                "tokutenkai_start": self._compute_live_end_time(str(presets[type_var.get()]["default_start_time"]), presets[type_var.get()]["default_duration"]),
                "tokutenkai_end": self._compute_end_time_from_duration(
                    self._compute_live_end_time(str(presets[type_var.get()]["default_start_time"]), presets[type_var.get()]["default_duration"]),
                    presets[type_var.get()].get("tokutenkai_duration", 0) or 0,
                ) if presets[type_var.get()].get("tokutenkai_enabled") else self._compute_live_end_time(str(presets[type_var.get()]["default_start_time"]), presets[type_var.get()]["default_duration"]),
                "tokutenkai_ticket_price": int(presets[type_var.get()].get("tokutenkai_ticket_price", 2000)),
                "tokutenkai_slot_seconds": int(presets[type_var.get()].get("tokutenkai_slot_seconds", 40)),
                "tokutenkai_expected_tickets": int(presets[type_var.get()].get("tokutenkai_expected_tickets", 0)),
            }
            if type_var.get() == "Taiban":
                tp = presets.get("Taiban", {})
                self._new_live_form_state["tokutenkai_ticket_price_secondary"] = int(tp.get("tokutenkai_ticket_price_secondary", 3000))
                self._new_live_form_state["tokutenkai_slot_seconds_secondary"] = int(tp.get("tokutenkai_slot_seconds_secondary", 20))
                self._new_live_form_state["tokutenkai_tier_split_primary"] = float(tp.get("tokutenkai_tier_split_primary", 0.5))
            self._persist_game_save()
            self.show_lives_view("scheduled")

        tk.Button(
            right,
            text="Schedule Live",
            bg=self.colors['green'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=14,
            pady=10,
            font=('Arial', 11, 'bold'),
            command=_schedule_live,
            cursor='hand2',
        ).pack(anchor="w", pady=(18, 0))

        for var in [type_var, title_var, date_var, start_var, end_var, rehearsal_start_var, rehearsal_end_var, venue_var, tokutenkai_start_var, tokutenkai_end_var, tokutenkai_price_var, tokutenkai_slot_var, tokutenkai_expected_var]:
            var.trace_add("write", _refresh_summary)
        type_combo.bind("<<ComboboxSelected>>", _apply_type_defaults)
        venue_combo.bind("<<ComboboxSelected>>", _refresh_summary)

        if not title_var.get().strip():
            title_var.set(_suggest_title())
        _refresh_summary()
    
    def show_songs_view(self, group=None, tab: Optional[str] = None, song=None, disc=None):
        """Show songs workspace for a selected group."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        if group is None:
            group = self.player_group
        if group is not None:
            self._songs_view_state["group_uid"] = str(getattr(group, "uid", "") or "")
        if tab:
            self._songs_view_state["tab"] = tab
        if song is not None:
            self._songs_view_state["song_uid"] = str(getattr(song, "uid", "") or "")
        if disc is not None:
            self._songs_view_state["disc_uid"] = str(getattr(disc, "uid", "") or "")
        active_tab = str(self._songs_view_state.get("tab") or "group_songs")
        if active_tab == "song":
            active_tab = "group_songs"
            self._songs_view_state["tab"] = "group_songs"

        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True, padx=24, pady=24)

        tk.Label(
            frame,
            text="SONGS",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 24, 'bold'),
        ).pack(anchor="w")

        subtitle = group.name if group is not None else (self.player_group.name if self.player_group else "No group selected")
        tk.Label(
            frame,
            text=f"Group: {subtitle}",
            bg=self.colors['bg_content'],
            fg=self.colors['text_secondary'],
            font=('Arial', 11),
        ).pack(anchor="w", pady=(6, 16))

        if not getattr(self, "_data_loaded", False):
            tk.Label(
                frame,
                text="Loading song catalog...",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        if group is None:
            tk.Label(
                frame,
                text="Select a group to review songs and releases.",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        discs = sorted(
            list(self._get_group_discography_for_display(group) if hasattr(self, "_get_group_discography_for_display") else (group.discography or [])),
            key=lambda disc_obj: (
                getattr(disc_obj, "release_date", None) is None,
                getattr(disc_obj, "release_date", None) or date.max,
                (getattr(disc_obj, "title", "") or "").casefold(),
            ),
        )
        songs = [song_obj for song_obj in list(group.songs or []) if not bool(getattr(song_obj, "hidden", False))]
        canonical_rows = [
            row
            for row in self._find_canonical_song_payloads(group)
            if not bool(row.get("hidden", False))
        ]
        disc_uid_set = {
            str(getattr(disc_obj, "uid", "") or "")
            for disc_obj in discs
            if str(getattr(disc_obj, "uid", "") or "")
        }
        should_prefer_canonical = bool(canonical_rows) and (
            not songs
            or len(canonical_rows) > len(songs)
            or any(str(getattr(song_obj, "uid", "") or "") in disc_uid_set for song_obj in songs)
        )
        if should_prefer_canonical:
            songs = [Song.create_from_dict(row) for row in canonical_rows]

        tab_row = tk.Frame(frame, bg=self.colors['bg_content'])
        tab_row.pack(fill=tk.X, pady=(0, 14))
        for key, label in [("group_songs", "Songs"), ("disc", "Discography")]:
            tk.Button(
                tab_row,
                text=label,
                command=lambda current=key: self.show_songs_view(group=group, tab=current),
                bg=self.colors['accent'] if active_tab == key else self.colors['bg_card'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=14,
                pady=8,
                font=('Arial', 10, 'bold'),
                cursor='hand2',
            ).pack(side=tk.LEFT, padx=(0, 8))

        if active_tab == "disc":
            self._render_song_disc_tab(frame, group, songs, discs)
            return
        released_songs = [song_obj for song_obj in songs if getattr(song_obj, "release_date", None) and song_obj.release_date <= self.current_date]
        making_songs = [
            song_obj for song_obj in songs
            if getattr(song_obj, "release_date", None) is None or getattr(song_obj, "release_date", None) > self.current_date
        ]

        summary = tk.Frame(frame, bg=self.colors['bg_content'])
        summary.pack(fill=tk.X, pady=(0, 16))
        for title, value in [
            ("Songs", f"{len(released_songs)} released"),
            ("Released", f"{len(released_songs)} available"),
            ("In Making", f"{len(making_songs)} underway"),
            ("Discography", f"{len(discs)} releases"),
        ]:
            card = tk.Frame(summary, bg=self.colors['bg_card'], padx=16, pady=14)
            card.pack(side=tk.LEFT, padx=(0, 12))
            tk.Label(card, text=title.upper(), bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 9, 'bold')).pack(anchor="w")
            tk.Label(card, text=value, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w", pady=(6, 0))

        if not songs and not discs:
            tk.Label(
                frame,
                text="No songs or releases are loaded for this managed group yet.",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 16),
            ).pack(pady=32)
            return

        def _song_title(song_obj) -> str:
            return getattr(song_obj, "title", "") or getattr(song_obj, "title_romanji", "") or "Untitled Song"

        def _song_duration(song_obj) -> str:
            duration_seconds = getattr(song_obj, "duration", None)
            try:
                total_seconds = int(duration_seconds) if duration_seconds is not None else 0
            except (TypeError, ValueError):
                total_seconds = 0
            if total_seconds <= 0:
                return "-"
            minutes, seconds = divmod(total_seconds, 60)
            return f"{minutes}:{seconds:02d}"

        def _song_release_label(song_obj) -> str:
            albums = getattr(song_obj, "albums", None)
            if isinstance(albums, list):
                for album_ref in albums:
                    if not isinstance(album_ref, dict):
                        continue
                    album_name = str(album_ref.get("name") or "").strip()
                    if album_name:
                        return album_name
            if getattr(song_obj, "disc_uid", None):
                matching = next((disc_obj for disc_obj in discs if getattr(disc_obj, "uid", None) == song_obj.disc_uid), None)
                if matching is not None:
                    return getattr(matching, "title", "") or "Disc release"
            return "Standalone / Unknown"

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(0, weight=3)
        body.columnconfigure(1, weight=2)
        body.rowconfigure(0, weight=1)

        left = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        right = tk.Frame(body, bg=self.colors['bg_content'])
        right.grid(row=0, column=1, sticky="nsew")
        right.columnconfigure(0, weight=1)
        right.rowconfigure(0, weight=1)
        right.rowconfigure(1, weight=1)

        tk.Label(left, text="Songs", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        tk.Label(
            left,
            text="Released songs for the managed group. Select a row for a quick preview.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            wraplength=760,
        ).pack(anchor="w", pady=(4, 12))

        table_frame = tk.Frame(left, bg=self.colors['bg_card'])
        table_frame.pack(fill=tk.BOTH, expand=True)
        columns = ("popularity", "release", "duration", "genre", "version", "release_type", "setlists")
        tree = ttk.Treeview(table_frame, columns=columns, show="tree headings", height=16)
        for key, heading, width in [
            ("popularity", "Popularity", 90),
            ("release", "Release Date", 110),
            ("duration", "Duration", 90),
            ("genre", "Genre", 120),
            ("version", "Version", 120),
            ("release_type", "Release", 160),
            ("setlists", "Releases", 90),
        ]:
            tree.heading(key, text=heading)
            tree.column(key, width=width, anchor="w")
        tree["displaycolumns"] = columns
        tree.column("#0", width=260, minwidth=220, stretch=True, anchor="w")
        tree.heading("#0", text="Title")
        y_scroll = tk.Scrollbar(table_frame, orient=tk.VERTICAL, command=tree.yview)
        tree.configure(yscrollcommand=y_scroll.set)
        tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        y_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        detail_var = tk.StringVar(value="Select a song to preview credits, release info, and linked releases.")
        tk.Label(
            left,
            textvariable=detail_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            justify=tk.LEFT,
            anchor="nw",
            font=('Arial', 10),
            wraplength=760,
        ).pack(fill=tk.X, pady=(12, 0))

        sorted_songs = sorted(
            released_songs,
            key=lambda song_obj: (
                getattr(song_obj, "release_date", None) is None,
                getattr(song_obj, "release_date", None) or date.max,
                _song_title(song_obj).casefold(),
            ),
        )
        row_lookup: dict[str, object] = {}
        for song_obj in sorted_songs:
            release_date = getattr(song_obj, "release_date", None)
            item_id = tree.insert(
                "",
                "end",
                text=_song_title(song_obj),
                values=(
                    self._format_song_popularity(getattr(song_obj, "popularity", None)),
                    release_date.isoformat() if release_date else "-",
                    _song_duration(song_obj),
                    getattr(song_obj, "genre", "") or "-",
                    getattr(song_obj, "version", "") or "-",
                    _song_release_label(song_obj),
                    len(getattr(song_obj, "albums", None) or []),
                ),
            )
            row_lookup[item_id] = song_obj

        def _refresh_song_detail(_event=None):
            selected = tree.selection()
            if not selected:
                detail_var.set("Select a song to preview credits, release info, and linked releases.")
                return
            song_obj = row_lookup[selected[0]]
            release_lines = []
            for album_ref in list(getattr(song_obj, "albums", None) or [])[:8]:
                if not isinstance(album_ref, dict):
                    continue
                album_name = str(album_ref.get("name") or "").strip() or "Unknown release"
                track_number = album_ref.get("track_number")
                if track_number in (None, ""):
                    release_lines.append(f"- {album_name}")
                else:
                    release_lines.append(f"- {album_name} (Track {track_number})")
            if not release_lines:
                release_lines.append("- No linked releases recorded")
            detail_var.set(
                "\n".join(
                    [
                        _song_title(song_obj),
                        f"Popularity: {self._format_song_popularity(getattr(song_obj, 'popularity', None))}",
                        f"Romaji: {getattr(song_obj, 'title_romanji', '') or '-'}",
                        f"Release date: {getattr(song_obj, 'release_date', None).isoformat() if getattr(song_obj, 'release_date', None) else '-'}",
                        f"Duration: {_song_duration(song_obj)}",
                        f"Genre: {getattr(song_obj, 'genre', '') or '-'}",
                        f"Composer: {getattr(song_obj, 'composer', '') or '-'}",
                        f"Lyricist: {getattr(song_obj, 'lyricist', '') or '-'}",
                        f"Arrangement: {getattr(song_obj, 'arrangement', '') or '-'}",
                        f"Release bucket: {_song_release_label(song_obj)}",
                        f"Description: {getattr(song_obj, 'description', '') or '-'}",
                        "Linked releases:",
                        *release_lines,
                    ]
                )
            )

        tree.bind("<<TreeviewSelect>>", _refresh_song_detail)

        top_right = tk.Frame(right, bg=self.colors['bg_card'], padx=16, pady=16)
        top_right.grid(row=0, column=0, sticky="nsew", pady=(0, 12))
        bottom_right = tk.Frame(right, bg=self.colors['bg_card'], padx=16, pady=16)
        bottom_right.grid(row=1, column=0, sticky="nsew")

        tk.Label(top_right, text="Discography", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        tk.Label(
            top_right,
            text="Singles and albums. Select a release for a quick summary, or double-click to open the full discography view.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            wraplength=420,
        ).pack(anchor="w", pady=(4, 12))

        disc_table_frame = tk.Frame(top_right, bg=self.colors['bg_card'])
        disc_table_frame.pack(fill=tk.BOTH, expand=True)
        disc_tree = ttk.Treeview(disc_table_frame, columns=("release", "type", "tracks"), show="tree headings", height=8)
        for key, heading, width in [
            ("release", "Release Date", 100),
            ("type", "Type", 90),
            ("tracks", "Tracks", 60),
        ]:
            disc_tree.heading(key, text=heading)
            disc_tree.column(key, width=width, anchor="w")
        disc_tree.column("#0", width=220, minwidth=180, stretch=True, anchor="w")
        disc_tree.heading("#0", text="Title")
        disc_scroll = tk.Scrollbar(disc_table_frame, orient=tk.VERTICAL, command=disc_tree.yview)
        disc_tree.configure(yscrollcommand=disc_scroll.set)
        disc_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        disc_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        disc_detail_var = tk.StringVar(value="Select a release to inspect track count and notes.")
        tk.Label(
            top_right,
            textvariable=disc_detail_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            justify=tk.LEFT,
            anchor="nw",
            font=('Arial', 10),
            wraplength=420,
        ).pack(fill=tk.X, pady=(12, 0))
        disc_row_lookup: dict[str, object] = {}
        for disc_obj in discs:
            disc_title = getattr(disc_obj, "title", "") or "Untitled Release"
            disc_date = getattr(disc_obj, "release_date", None)
            disc_track_entries = self._resolve_disc_track_entries(group, songs, disc_obj)
            item_id = disc_tree.insert(
                "",
                "end",
                text=disc_title,
                values=(
                    disc_date.isoformat() if disc_date else "-",
                    getattr(disc_obj, "disc_type", "") or "-",
                    len(disc_track_entries),
                ),
            )
            disc_row_lookup[item_id] = disc_obj

        def _refresh_disc_preview(_event=None):
            selected = disc_tree.selection()
            if not selected:
                disc_detail_var.set("Select a release to inspect track count and notes.")
                return
            disc_obj = disc_row_lookup[selected[0]]
            track_entries = self._resolve_disc_track_entries(group, songs, disc_obj)
            track_titles = [title for title, _song_obj in track_entries]
            preview = ", ".join(track_titles[:5]) if track_titles else "No track list loaded"
            disc_detail_var.set(
                "\n".join(
                    [
                        getattr(disc_obj, "title", "") or "Untitled Release",
                        f"Type: {getattr(disc_obj, 'disc_type', '') or '-'}",
                        f"Release date: {getattr(disc_obj, 'release_date', None).isoformat() if getattr(disc_obj, 'release_date', None) else '-'}",
                        f"Catalog number: {getattr(disc_obj, 'catalog_number', '') or '-'}",
                        f"Tracks: {len(track_entries)}",
                        f"Track preview: {preview}",
                    ]
                )
            )

        disc_tree.bind("<<TreeviewSelect>>", _refresh_disc_preview)
        disc_tree.bind("<Double-1>", lambda _event=None: self.show_songs_view(group=group, tab="disc", disc=disc_row_lookup[disc_tree.selection()[0]]) if disc_tree.selection() else None)

        tk.Label(bottom_right, text="Songs In Making", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        tk.Label(
            bottom_right,
            text="Upcoming or unreleased songs. Select a row for a quick summary, or double-click to open song information.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            wraplength=420,
        ).pack(anchor="w", pady=(4, 12))

        making_table_frame = tk.Frame(bottom_right, bg=self.colors['bg_card'])
        making_table_frame.pack(fill=tk.BOTH, expand=True)
        making_tree = ttk.Treeview(making_table_frame, columns=("target", "popularity", "version"), show="tree headings", height=8)
        for key, heading, width in [
            ("target", "Target Date", 100),
            ("popularity", "Popularity", 80),
            ("version", "Version", 120),
        ]:
            making_tree.heading(key, text=heading)
            making_tree.column(key, width=width, anchor="w")
        making_tree.column("#0", width=200, minwidth=170, stretch=True, anchor="w")
        making_tree.heading("#0", text="Title")
        making_scroll = tk.Scrollbar(making_table_frame, orient=tk.VERTICAL, command=making_tree.yview)
        making_tree.configure(yscrollcommand=making_scroll.set)
        making_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        making_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        making_detail_var = tk.StringVar(value="Select a song in making to review its target release and metadata.")
        tk.Label(
            bottom_right,
            textvariable=making_detail_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            justify=tk.LEFT,
            anchor="nw",
            font=('Arial', 10),
            wraplength=420,
        ).pack(fill=tk.X, pady=(12, 0))
        making_row_lookup: dict[str, object] = {}
        sorted_making = sorted(
            making_songs,
            key=lambda song_obj: (
                getattr(song_obj, "release_date", None) is None,
                getattr(song_obj, "release_date", None) or date.max,
                _song_title(song_obj).casefold(),
            ),
        )
        for song_obj in sorted_making:
            release_date = getattr(song_obj, "release_date", None)
            item_id = making_tree.insert(
                "",
                "end",
                text=_song_title(song_obj),
                values=(
                    release_date.isoformat() if release_date else "TBD",
                    self._format_song_popularity(getattr(song_obj, "popularity", None)),
                    getattr(song_obj, "version", "") or "-",
                ),
            )
            making_row_lookup[item_id] = song_obj

        def _refresh_making_preview(_event=None):
            selected = making_tree.selection()
            if not selected:
                making_detail_var.set("Select a song in making to review its target release and metadata.")
                return
            song_obj = making_row_lookup[selected[0]]
            release_links = ", ".join(
                str(item.get("name") or "Unknown release")
                for item in (getattr(song_obj, "albums", None) or [])
                if isinstance(item, dict)
            ) or "-"
            making_detail_var.set(
                "\n".join(
                    [
                        _song_title(song_obj),
                        f"Target release date: {getattr(song_obj, 'release_date', None).isoformat() if getattr(song_obj, 'release_date', None) else 'TBD'}",
                        f"Popularity: {self._format_song_popularity(getattr(song_obj, 'popularity', None))}",
                        f"Genre: {getattr(song_obj, 'genre', '') or '-'}",
                        f"Version: {getattr(song_obj, 'version', '') or '-'}",
                        f"Release links: {release_links}",
                        f"Description: {getattr(song_obj, 'description', '') or '-'}",
                    ]
                )
            )

        making_tree.bind("<<TreeviewSelect>>", _refresh_making_preview)

        first_song_items = tree.get_children()
        if first_song_items:
            tree.selection_set(first_song_items[0])
            _refresh_song_detail()

        first_disc_items = disc_tree.get_children()
        if first_disc_items:
            disc_tree.selection_set(first_disc_items[0])
            _refresh_disc_preview()

        first_making_items = making_tree.get_children()
        if first_making_items:
            making_tree.selection_set(first_making_items[0])
            _refresh_making_preview()

        self.root.after_idle(lambda: self.bind_mousewheel(tree, tree))
        self.root.after_idle(lambda: self.bind_mousewheel(disc_tree, disc_tree))
        self.root.after_idle(lambda: self.bind_mousewheel(making_tree, making_tree))

    def _render_song_disc_tab(self, frame, group, songs, discs):
        """Render the Disc tab for the Songs workspace."""
        if not discs:
            tk.Label(frame, text="No discography loaded for this group yet.", bg=self.colors['bg_content'], fg=self.colors['text_primary'], font=('Arial', 16)).pack(pady=32)
            return

        selected_uid = str(self._songs_view_state.get("disc_uid") or "")
        selected_disc = next((disc_obj for disc_obj in discs if str(getattr(disc_obj, "uid", "") or "") == selected_uid), None) or discs[0]
        self._songs_view_state["disc_uid"] = str(getattr(selected_disc, "uid", "") or "")

        def _song_title(song_obj) -> str:
            return getattr(song_obj, "title", "") or getattr(song_obj, "title_romanji", "") or "Untitled Song"

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(0, weight=2)
        body.columnconfigure(1, weight=3)

        left = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        right = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        right.grid(row=0, column=1, sticky="nsew")

        tk.Label(left, text="Discography", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        tk.Label(
            left,
            text="Singles and albums for the group. Select a release to inspect it on the right.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
        ).pack(anchor="w", pady=(4, 10))

        disc_table_frame = tk.Frame(left, bg=self.colors['bg_card'])
        disc_table_frame.pack(fill=tk.BOTH, expand=True)
        disc_tree = ttk.Treeview(disc_table_frame, columns=("release", "type", "tracks"), show="tree headings", height=18)
        for key, heading, width in [
            ("release", "Release Date", 110),
            ("type", "Type", 110),
            ("tracks", "Tracks", 70),
        ]:
            disc_tree.heading(key, text=heading)
            disc_tree.column(key, width=width, anchor="w")
        disc_tree.column("#0", width=260, minwidth=220, stretch=True, anchor="w")
        disc_tree.heading("#0", text="Title")
        disc_scroll = tk.Scrollbar(disc_table_frame, orient=tk.VERTICAL, command=disc_tree.yview)
        disc_tree.configure(yscrollcommand=disc_scroll.set)
        disc_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        disc_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        disc_row_lookup: dict[str, object] = {}
        selected_item_id = ""
        for disc_obj in discs:
            disc_title = getattr(disc_obj, "title", "") or "Untitled Release"
            disc_date = getattr(disc_obj, "release_date", None)
            disc_track_entries = self._resolve_disc_track_entries(group, songs, disc_obj)
            item_id = disc_tree.insert(
                "",
                "end",
                text=disc_title,
                values=(
                    disc_date.isoformat() if disc_date else "-",
                    getattr(disc_obj, "disc_type", "") or "-",
                    len(disc_track_entries),
                ),
            )
            disc_row_lookup[item_id] = disc_obj
            if getattr(disc_obj, "uid", None) == getattr(selected_disc, "uid", None):
                selected_item_id = item_id

        detail_title_var = tk.StringVar()
        detail_lines_var = tk.StringVar()
        tk.Label(right, textvariable=detail_title_var, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w")
        tk.Label(
            right,
            textvariable=detail_lines_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            anchor="nw",
            wraplength=620,
        ).pack(anchor="w", fill=tk.X, pady=(6, 0))

        tk.Label(right, text="Tracks", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 14, 'bold')).pack(anchor="w", pady=(16, 8))
        track_list = tk.Listbox(right, font=('Arial', 10), height=18)
        track_list.pack(fill=tk.BOTH, expand=True)
        track_song_map: list[object | None] = []

        def _refresh_disc_detail(_event=None):
            selected = disc_tree.selection()
            if not selected:
                return
            disc_obj = disc_row_lookup[selected[0]]
            self._songs_view_state["disc_uid"] = str(getattr(disc_obj, "uid", "") or "")
            detail_title_var.set(getattr(disc_obj, "title", "") or "Untitled Release")
            track_entries = self._resolve_disc_track_entries(group, songs, disc_obj)
            detail_lines_var.set(
                "\n".join(
                    [
                        f"Type: {getattr(disc_obj, 'disc_type', '') or '-'}",
                        f"Release date: {getattr(disc_obj, 'release_date', None).isoformat() if getattr(disc_obj, 'release_date', None) else '-'}",
                        f"Catalog number: {getattr(disc_obj, 'catalog_number', '') or '-'}",
                        f"Publisher: {getattr(disc_obj, 'publisher', None) or '-'}",
                        f"Tracks: {len(track_entries)}",
                        f"Description: {getattr(disc_obj, 'description', '') or '-'}",
                    ]
                )
            )
            track_list.delete(0, tk.END)
            track_song_map.clear()
            for track_title, matched_song in track_entries:
                track_list.insert(tk.END, track_title)
                track_song_map.append(matched_song)

        disc_tree.bind("<<TreeviewSelect>>", _refresh_disc_detail)

        if selected_item_id:
            disc_tree.selection_set(selected_item_id)
            _refresh_disc_detail()

        self.root.after_idle(lambda: self.bind_mousewheel(disc_tree, disc_tree))
        self.root.after_idle(lambda: self.bind_mousewheel(track_list))

    def _render_song_detail_tab(self, frame, group, songs, discs):
        """Render the Song tab for the Songs workspace."""
        if not songs:
            tk.Label(frame, text="No songs loaded for this group yet.", bg=self.colors['bg_content'], fg=self.colors['text_primary'], font=('Arial', 16)).pack(pady=32)
            return

        def _song_title(song_obj) -> str:
            return getattr(song_obj, "title", "") or getattr(song_obj, "title_romanji", "") or "Untitled Song"

        def _song_duration(song_obj) -> str:
            duration_seconds = getattr(song_obj, "duration", None)
            try:
                total_seconds = int(duration_seconds) if duration_seconds is not None else 0
            except (TypeError, ValueError):
                total_seconds = 0
            if total_seconds <= 0:
                return "—"
            minutes, seconds = divmod(total_seconds, 60)
            return f"{minutes}:{seconds:02d}"

        selected_uid = str(self._songs_view_state.get("song_uid") or "")
        sorted_songs = sorted(
            songs,
            key=lambda song_obj: (
                getattr(song_obj, "release_date", None) is None,
                getattr(song_obj, "release_date", None) or date.max,
                _song_title(song_obj).casefold(),
            ),
        )
        selected_song = next((song for song in sorted_songs if str(getattr(song, "uid", "") or "") == selected_uid), None) or sorted_songs[0]
        self._songs_view_state["song_uid"] = str(getattr(selected_song, "uid", "") or "")

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(0, weight=2)
        body.columnconfigure(1, weight=3)

        left = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        right = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        right.grid(row=0, column=1, sticky="nsew")

        tk.Label(left, text="Songs", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        song_list = tk.Listbox(left, font=('Arial', 10), height=18)
        song_list.pack(fill=tk.BOTH, expand=True, pady=(10, 0))
        selected_index = 0
        for idx, song in enumerate(sorted_songs):
            song_list.insert(tk.END, _song_title(song))
            if getattr(song, "uid", None) == getattr(selected_song, "uid", None):
                selected_index = idx
        song_list.selection_set(selected_index)
        song_list.see(selected_index)
        song_list.bind("<<ListboxSelect>>", lambda _event=None: self.show_songs_view(group=group, tab="song", song=sorted_songs[song_list.curselection()[0]]) if song_list.curselection() else None)

        tk.Label(right, text=_song_title(selected_song), bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w")
        tk.Label(right, text=f"Popularity: {self._format_song_popularity(getattr(selected_song, 'popularity', None))}", bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 10)).pack(anchor="w", pady=(6, 0))
        for line in [
            f"Romaji: {getattr(selected_song, 'title_romanji', '') or '—'}",
            f"Release date: {getattr(selected_song, 'release_date', None).isoformat() if getattr(selected_song, 'release_date', None) else '—'}",
            f"Duration: {_song_duration(selected_song)}",
            f"Genre: {getattr(selected_song, 'genre', '') or '—'}",
            f"Composer: {getattr(selected_song, 'composer', '') or '—'}",
            f"Lyricist: {getattr(selected_song, 'lyricist', '') or '—'}",
            f"Arrangement: {getattr(selected_song, 'arrangement', '') or '—'}",
            f"Version: {getattr(selected_song, 'version', '') or '—'}",
        ]:
            tk.Label(right, text=line, bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 10)).pack(anchor="w", pady=(6, 0))

        tk.Label(right, text="Linked Releases", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 14, 'bold')).pack(anchor="w", pady=(16, 8))
        for album_ref in list(getattr(selected_song, "albums", None) or []):
            if not isinstance(album_ref, dict):
                continue
            release_name = str(album_ref.get("name") or "").strip() or "Unknown release"
            release_line = release_name
            if album_ref.get("track_number") not in (None, ""):
                release_line += f" (Track {album_ref.get('track_number')})"
            link = tk.Label(right, text=release_line, bg=self.colors['bg_card'], fg=self.colors['accent_light'], cursor='hand2', font=('Arial', 10, 'underline'))
            link.pack(anchor="w", pady=(2, 0))
            matching_disc = next((disc for disc in discs if getattr(disc, "uid", None) == album_ref.get("disc_uid")), None)
            link.bind("<Button-1>", lambda _event=None, disc_obj=matching_disc: self.show_songs_view(group=group, tab="disc", disc=disc_obj) if disc_obj is not None else None)
        tk.Label(right, text=f"Description: {getattr(selected_song, 'description', '') or '—'}", bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 10), wraplength=700, justify=tk.LEFT).pack(anchor="w", pady=(16, 0))

        self.root.after_idle(lambda: self.bind_mousewheel(song_list))

    def show_making_view(self):
        """Show making view."""
        self.show_placeholder_view("Making")
    
    def show_publish_view(self):
        """Show publish view."""
        self.show_placeholder_view("Publish")
    
    def show_scout_view(self):
        """Show scout view."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True, padx=24, pady=24)

        tk.Label(
            frame,
            text="SCOUT",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 24, 'bold'),
        ).pack(anchor="w")

        subtitle = self.player_group.name if self.player_group else "No managed group selected"
        tk.Label(
            frame,
            text=f"Managed Group: {subtitle}",
            bg=self.colors['bg_content'],
            fg=self.colors['text_secondary'],
            font=('Arial', 11),
        ).pack(anchor="w", pady=(6, 16))

        if not getattr(self, "_data_loaded", False):
            tk.Label(
                frame,
                text="Loading scout desk...",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        if not self.player_group:
            tk.Label(
                frame,
                text="Select a managed group to use scout firms and auditions.",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        selected_company = self._get_selected_scout_company()
        if selected_company is None and self._scout_companies:
            selected_company = self._scout_companies[0]
            self._set_selected_scout_company(selected_company.uid)
        if selected_company is None:
            tk.Label(
                frame,
                text="No scout companies are configured.",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        summary = tk.Frame(frame, bg=self.colors['bg_content'])
        summary.pack(fill=tk.X, pady=(0, 16))
        city_count = len({company.city for company in self._scout_companies})
        held_auditions = len(self._get_saved_auditions_for_company(selected_company))
        summary_cards = [
            ("Scout Firms", f"{len(self._scout_companies)} active"),
            ("Cities Covered", str(city_count)),
            ("Selected Level", f"Lv{selected_company.level}"),
            ("Today's Audition Pool", f"{held_auditions} applicants"),
        ]
        for title, value in summary_cards:
            card = tk.Frame(summary, bg=self.colors['bg_card'], padx=16, pady=14)
            card.pack(side=tk.LEFT, padx=(0, 12))
            tk.Label(card, text=title.upper(), bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 9, 'bold')).pack(anchor="w")
            tk.Label(card, text=value, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w", pady=(6, 0))

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(0, weight=2)
        body.columnconfigure(1, weight=3)
        body.rowconfigure(0, weight=1)

        left = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        right = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        right.grid(row=0, column=1, sticky="nsew")

        tk.Label(left, text="Scout Firms", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        tk.Label(
            left,
            text="Hyper scout agencies sort local freelancers, transfer leads, and auditions by territory and profile.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            wraplength=360,
        ).pack(anchor="w", pady=(4, 12))

        company_table = tk.Frame(left, bg=self.colors['bg_card'])
        company_table.pack(fill=tk.BOTH, expand=True)
        company_tree = ttk.Treeview(company_table, columns=("city", "level", "fee"), show="tree headings", height=14)
        for key, heading, width in [
            ("city", "City", 110),
            ("level", "Level", 70),
            ("fee", "Fee", 110),
        ]:
            company_tree.heading(key, text=heading)
            company_tree.column(key, width=width, anchor="w")
        company_tree["displaycolumns"] = ("city", "level", "fee")
        company_tree.column("#0", width=180, minwidth=160, stretch=True, anchor="w")
        company_tree.heading("#0", text="Company")
        company_scroll = tk.Scrollbar(company_table, orient=tk.VERTICAL, command=company_tree.yview)
        company_tree.configure(yscrollcommand=company_scroll.set)
        company_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        company_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        company_row_lookup: dict[str, ScoutCompany] = {}
        selected_item_id = None
        for company in self._scout_companies:
            item_id = company_tree.insert(
                "",
                "end",
                text=company.name,
                values=(company.city, f"Lv{company.level}", f"¥{company.service_fee_yen:,}"),
            )
            company_row_lookup[item_id] = company
            if company.uid == selected_company.uid:
                selected_item_id = item_id
        if selected_item_id:
            company_tree.selection_set(selected_item_id)
            company_tree.focus(selected_item_id)

        company_detail_var = tk.StringVar(
            value="\n".join(
                [
                    selected_company.name,
                    f"Base: {selected_company.city}",
                    f"Level: {selected_company.level}",
                    f"Retainer: ¥{selected_company.service_fee_yen:,}",
                    f"Specialty: {selected_company.specialty}",
                    f"Focus: {selected_company.focus_note}",
                ]
            )
        )
        tk.Label(
            left,
            textvariable=company_detail_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            justify=tk.LEFT,
            anchor="nw",
            font=('Arial', 10),
            wraplength=360,
        ).pack(fill=tk.X, pady=(12, 0))

        def _select_company(_event=None):
            selection = company_tree.selection()
            if not selection:
                return
            company = company_row_lookup.get(selection[0])
            if company is None:
                return
            company_detail_var.set(
                "\n".join(
                    [
                        company.name,
                        f"Base: {company.city}",
                        f"Level: {company.level}",
                        f"Retainer: ¥{company.service_fee_yen:,}",
                        f"Specialty: {company.specialty}",
                        f"Focus: {company.focus_note}",
                    ]
                )
            )
            if company.uid != (self._get_selected_scout_company().uid if self._get_selected_scout_company() else ""):
                self._set_selected_scout_company(company.uid)
                self._persist_game_save()
                self.show_scout_view()

        company_tree.bind("<<TreeviewSelect>>", _select_company)

        top_bar = tk.Frame(right, bg=self.colors['bg_card'])
        top_bar.pack(fill=tk.X)
        tk.Label(right, text="Scout Desk", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        tk.Label(
            right,
            text=f"{selected_company.name} focuses on {selected_company.city} and profiles suited to level {selected_company.level}.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            wraplength=720,
        ).pack(anchor="w", pady=(4, 12))

        for key, label in [("freelancer", "Freelancers"), ("transfer", "Transfer Targets"), ("audition", "Auditions")]:
            tk.Button(
                top_bar,
                text=label,
                bg=self.colors['accent'] if self._scout_tab == key else self.colors['bg_sidebar'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=lambda tab_key=key: (setattr(self, "_scout_tab", tab_key), self.show_scout_view()),
                cursor='hand2',
            ).pack(side=tk.LEFT, padx=(0, 8), pady=(0, 12))

        content = tk.Frame(right, bg=self.colors['bg_card'])
        content.pack(fill=tk.BOTH, expand=True)

        if self._scout_tab in {"freelancer", "transfer"}:
            target_type = "freelancer" if self._scout_tab == "freelancer" else "transfer"
            target_rows = recommend_idols(
                self.idols,
                self.player_group.name,
                selected_company,
                target_type=target_type,
                current_date=self.current_date,
                limit=18,
            )
            table = tk.Frame(content, bg=self.colors['bg_card'])
            table.pack(fill=tk.BOTH, expand=True)
            result_tree = ttk.Treeview(
                table,
                columns=("profile", "birthplace", "groups", "reason"),
                show="tree headings",
                height=16,
            )
            for key, heading, width in [
                ("profile", "Profile", 80),
                ("birthplace", "Birthplace", 170),
                ("groups", "Current Groups", 200),
                ("reason", "Scout Read", 210),
            ]:
                result_tree.heading(key, text=heading)
                result_tree.column(key, width=width, anchor="w")
            result_tree["displaycolumns"] = ("profile", "birthplace", "groups", "reason")
            result_tree.column("#0", width=200, minwidth=180, stretch=True, anchor="w")
            result_tree.heading("#0", text="Idol")
            result_scroll = tk.Scrollbar(table, orient=tk.VERTICAL, command=result_tree.yview)
            result_tree.configure(yscrollcommand=result_scroll.set)
            result_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            result_scroll.pack(side=tk.RIGHT, fill=tk.Y)

            detail_var = tk.StringVar(value="Select a scout lead to review fit, profile, and shortlist status.")
            detail = tk.Label(
                content,
                textvariable=detail_var,
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                justify=tk.LEFT,
                anchor="nw",
                font=('Arial', 10),
                wraplength=720,
            )
            detail.pack(fill=tk.X, pady=(12, 0))

            result_lookup: dict[str, dict] = {}
            for row in target_rows:
                idol = row["idol"]
                current_groups = row["current_groups"] or []
                item_id = result_tree.insert(
                    "",
                    "end",
                    text=idol.name,
                    values=(
                        row["profile_score"],
                        idol.birthplace or "—",
                        ", ".join(current_groups) if current_groups else "Independent",
                        row["reason"],
                    ),
                )
                result_lookup[item_id] = row

            def _refresh_target_detail(_event=None):
                selection = result_tree.selection()
                if not selection:
                    detail_var.set("Select a scout lead to review fit, profile, and shortlist status.")
                    return
                row = result_lookup[selection[0]]
                idol = row["idol"]
                shortlisted = any(getattr(existing, "uid", None) == getattr(idol, "uid", None) for existing in self.shortlisted_idols)
                detail_var.set(
                    "\n".join(
                        [
                            idol.name,
                            f"Profile score: {row['profile_score']}/100",
                            f"Overall ability: {idol.ability}",
                            f"Birthplace: {idol.birthplace or '—'}",
                            f"Current groups: {', '.join(row['current_groups']) if row['current_groups'] else 'Independent'}",
                            f"Popularity: {idol.popularity} | Fans: {idol.fan_count:,} | X: {max(idol.x_followers_count, idol.x_followers):,}",
                            f"Scout read: {row['reason']}",
                            f"Shortlist: {'Already tracked' if shortlisted else 'Not yet shortlisted'}",
                        ]
                    )
                )

            def _shortlist_selected_target():
                selection = result_tree.selection()
                if not selection:
                    messagebox.showinfo("Scout", "Select a scout lead first.")
                    return
                idol = result_lookup[selection[0]]["idol"]
                added = self._shortlist_idol_from_scout(idol)
                if added:
                    messagebox.showinfo("Scout", f"{idol.name} was added to the shortlist.")
                else:
                    messagebox.showinfo("Scout", f"{idol.name} is already on the shortlist.")
                _refresh_target_detail()

            actions = tk.Frame(content, bg=self.colors['bg_card'])
            actions.pack(fill=tk.X, pady=(12, 0))
            tk.Button(
                actions,
                text="Shortlist Selected",
                bg=self.colors['green'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=_shortlist_selected_target,
                cursor='hand2',
            ).pack(side=tk.LEFT)
            tk.Button(
                actions,
                text="Refresh Board",
                bg=self.colors['bg_sidebar'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=self.show_scout_view,
                cursor='hand2',
            ).pack(side=tk.LEFT, padx=(8, 0))

            result_tree.bind("<<TreeviewSelect>>", _refresh_target_detail)

        else:
            auditions = self._get_saved_auditions_for_company(selected_company)
            toolbar = tk.Frame(content, bg=self.colors['bg_card'])
            toolbar.pack(fill=tk.X, pady=(0, 12))
            tk.Button(
                toolbar,
                text="Hold Audition Today",
                bg=self.colors['green'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=lambda: (self._hold_scout_audition(selected_company), self.show_scout_view()),
                cursor='hand2',
            ).pack(side=tk.LEFT)
            tk.Label(
                toolbar,
                text=f"Today's board keys off {selected_company.city} and level {selected_company.level} profile targets.",
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                font=('Arial', 10),
            ).pack(side=tk.LEFT, padx=(12, 0))

            table = tk.Frame(content, bg=self.colors['bg_card'])
            table.pack(fill=tk.BOTH, expand=True)
            audition_tree = ttk.Treeview(
                table,
                columns=("age", "birthplace", "profile", "background", "status"),
                show="tree headings",
                height=16,
            )
            for key, heading, width in [
                ("age", "Age", 60),
                ("birthplace", "Birthplace", 170),
                ("profile", "Profile", 80),
                ("background", "Background", 190),
                ("status", "Status", 120),
            ]:
                audition_tree.heading(key, text=heading)
                audition_tree.column(key, width=width, anchor="w")
            audition_tree["displaycolumns"] = ("age", "birthplace", "profile", "background", "status")
            audition_tree.column("#0", width=180, minwidth=170, stretch=True, anchor="w")
            audition_tree.heading("#0", text="Applicant")
            audition_scroll = tk.Scrollbar(table, orient=tk.VERTICAL, command=audition_tree.yview)
            audition_tree.configure(yscrollcommand=audition_scroll.set)
            audition_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
            audition_scroll.pack(side=tk.RIGHT, fill=tk.Y)

            detail_var = tk.StringVar(
                value="Hold today's audition to generate applications from indie idols and non-agency hopefuls."
                if not auditions else
                "Select an applicant to review fit and sign them into the shortlist."
            )
            detail = tk.Label(
                content,
                textvariable=detail_var,
                bg=self.colors['bg_card'],
                fg=self.colors['text_secondary'],
                justify=tk.LEFT,
                anchor="nw",
                font=('Arial', 10),
                wraplength=720,
            )
            detail.pack(fill=tk.X, pady=(12, 0))

            audition_lookup: dict[str, dict] = {}
            for row in auditions:
                status = "Signed" if row.get("signed_idol_uid") else "Available"
                item_id = audition_tree.insert(
                    "",
                    "end",
                    text=str(row.get("name") or "Unknown"),
                    values=(
                        row.get("age") or "—",
                        row.get("birthplace") or "—",
                        row.get("profile_score") or "—",
                        row.get("background") or "—",
                        status,
                    ),
                )
                audition_lookup[item_id] = row

            def _refresh_audition_detail(_event=None):
                selection = audition_tree.selection()
                if not selection:
                    detail_var.set(
                        "Hold today's audition to generate applications from indie idols and non-agency hopefuls."
                        if not auditions else
                        "Select an applicant to review fit and sign them into the shortlist."
                    )
                    return
                row = audition_lookup[selection[0]]
                signed = bool(row.get("signed_idol_uid"))
                detail_var.set(
                    "\n".join(
                        [
                            str(row.get("name") or "Unknown"),
                            f"Romaji: {row.get('romaji') or '—'}",
                            f"Age: {row.get('age') or '—'} | Height: {row.get('height') or '—'} cm",
                            f"Birthplace: {row.get('birthplace') or '—'}",
                            f"Background: {row.get('background') or '—'}",
                            f"Scout note: {row.get('note') or '—'}",
                            f"Profile score: {row.get('profile_score') or '—'} | Popularity seed: {row.get('popularity') or 0}",
                            f"Status: {'Signed to shortlist' if signed else 'Unsigned applicant'}",
                        ]
                    )
                )

            def _sign_selected_applicant():
                selection = audition_tree.selection()
                if not selection:
                    messagebox.showinfo("Scout", "Select an audition applicant first.")
                    return
                row = audition_lookup[selection[0]]
                if row.get("signed_idol_uid"):
                    idol = next((item for item in self.idols if getattr(item, "uid", None) == row.get("signed_idol_uid")), None)
                    if idol is not None:
                        self._shortlist_idol_from_scout(idol)
                    messagebox.showinfo("Scout", f"{row.get('name') or 'This applicant'} has already been signed.")
                    self.show_scout_view()
                    return
                idol = self._sign_scout_audition_candidate(selected_company, str(row.get("uid") or ""))
                if idol is None:
                    messagebox.showerror("Scout", "Could not sign that applicant.")
                    return
                messagebox.showinfo("Scout", f"{idol.name} joined your scout shortlist as a new freelancer.")
                self.show_scout_view()

            actions = tk.Frame(content, bg=self.colors['bg_card'])
            actions.pack(fill=tk.X, pady=(12, 0))
            tk.Button(
                actions,
                text="Sign Selected",
                bg=self.colors['accent'],
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                padx=12,
                pady=8,
                font=('Arial', 10, 'bold'),
                command=_sign_selected_applicant,
                cursor='hand2',
            ).pack(side=tk.LEFT)

            audition_tree.bind("<<TreeviewSelect>>", _refresh_audition_detail)

        self.root.after_idle(lambda: self.bind_mousewheel(company_tree, company_tree))
        if self._scout_tab in {"freelancer", "transfer"}:
            self.root.after_idle(lambda: self.bind_mousewheel(result_tree, result_tree))
        else:
            self.root.after_idle(lambda: self.bind_mousewheel(audition_tree, audition_tree))
    
    def show_company_info_view(self):
        """Show company info view."""
        self.show_placeholder_view("Company Info")
    
    def show_finances_view(self):
        """Show finance dashboard with historical cash flow and planned-month outlook."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        frame.pack(fill=tk.BOTH, expand=True, padx=24, pady=24)

        if not getattr(self, "_data_loaded", False):
            tk.Label(
                frame,
                text="Loading finances...",
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 18),
            ).pack(pady=40)
            return

        self._ensure_finances_ready()
        fin = FinanceSystem.normalize_finances(self._finances, self._get_scenario_starting_cash())
        ledger = list(fin.get("ledger", []))
        recent_30 = ledger[-30:]
        recent_7 = ledger[-7:]
        avg_daily_net = int(sum(int(row.get("net_total", 0)) for row in recent_30) / len(recent_30)) if recent_30 else 0
        projected_30 = int(fin.get("cash_yen", 0)) + (avg_daily_net * 30)
        last_entry = ledger[-1] if ledger else None
        members = self.player_group.members if self.player_group else []
        monthly_salary_total = sum(self._get_member_monthly_wage(idol) for idol in members)
        planned_30 = self._build_planned_finance_window(self.current_date, 30)
        upcoming_lives = planned_30.get("upcoming_lives", []) if isinstance(planned_30.get("upcoming_lives"), list) else []
        next_live = upcoming_lives[0] if upcoming_lives else None

        tk.Label(
            frame,
            text="FINANCES",
            bg=self.colors['bg_content'],
            fg=self.colors['text_primary'],
            font=('Arial', 24, 'bold'),
        ).pack(anchor="w")

        subtitle = self.player_group.name if self.player_group else "No managed group selected"
        tk.Label(
            frame,
            text=f"Managed Group: {subtitle}",
            bg=self.colors['bg_content'],
            fg=self.colors['text_secondary'],
            font=('Arial', 11),
        ).pack(anchor="w", pady=(6, 16))

        summary = tk.Frame(frame, bg=self.colors['bg_content'])
        summary.pack(fill=tk.X, pady=(0, 16))
        summary_cards = [
            ("Cash", f"JPY {int(fin.get('cash_yen', 0)):,}"),
            ("30-Day Projection", f"JPY {projected_30:,}"),
            ("Planned 30-Day Cash", f"JPY {int(planned_30.get('cash_end', int(fin.get('cash_yen', 0)))):,}"),
            ("Upcoming Lives", str(int(planned_30.get("live_count", 0)))),
            ("7-Day Net", f"JPY {sum(int(row.get('net_total', 0)) for row in recent_7):,}"),
            ("Monthly Salaries", f"JPY {monthly_salary_total:,}"),
        ]
        for title, value in summary_cards:
            card = tk.Frame(summary, bg=self.colors['bg_card'], padx=16, pady=14)
            card.pack(side=tk.LEFT, padx=(0, 12))
            tk.Label(card, text=title.upper(), bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 9, 'bold')).pack(anchor="w")
            tk.Label(card, text=value, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 18, 'bold')).pack(anchor="w", pady=(6, 0))

        body = tk.Frame(frame, bg=self.colors['bg_content'])
        body.pack(fill=tk.BOTH, expand=True)
        body.columnconfigure(0, weight=1)
        body.columnconfigure(1, weight=1)

        left = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        left.grid(row=0, column=0, sticky="nsew", padx=(0, 12))
        right = tk.Frame(body, bg=self.colors['bg_card'], padx=16, pady=16)
        right.grid(row=0, column=1, sticky="nsew")

        tk.Label(left, text="Cash Flow", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        if last_entry:
            lines = [
                f"Last closed day: {last_entry.get('date')}",
                f"Tier: {str(last_entry.get('tier', 'low')).upper()}",
                f"Income: JPY {int(last_entry.get('income_total', 0)):,}",
                f"Expenses: JPY {int(last_entry.get('expense_total', 0)):,}",
                f"Net: JPY {int(last_entry.get('net_total', 0)):,}",
                f"Avg daily net (30d): JPY {avg_daily_net:,}",
            ]
        else:
            lines = [
                "No ledger entries yet.",
                "Advance the day to settle revenue and expenses.",
                f"Starting cash: JPY {int(fin.get('cash_yen', 0)):,}",
            ]
        for line in lines:
            tk.Label(left, text=line, bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 11), anchor='w').pack(fill=tk.X, pady=(10, 0))

        tk.Label(right, text="Planned Next 30 Days", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        planned_lines = [
            ("Window", f"{planned_30.get('start_date')} to {planned_30.get('end_date')}"),
            ("Scheduled live count", str(int(planned_30.get("live_count", 0)))),
            ("Planned income", f"JPY {int(planned_30.get('income_total', 0)):,}"),
            ("Planned expenses", f"JPY {int(planned_30.get('expense_total', 0)):,}"),
            ("Planned net", f"JPY {int(planned_30.get('net_total', 0)):,}"),
            ("Venue fees", f"JPY {int(planned_30.get('live_venue_fee', 0)):,}"),
            ("Tokutenkai gross", f"JPY {int(planned_30.get('tokutenkai_revenue', 0)):,}"),
            ("Tokutenkai ops", f"JPY {int(planned_30.get('tokutenkai_cost', 0)):,}"),
            (
                "Salary hits",
                ", ".join(planned_30.get("salary_days", [])[:2])
                if isinstance(planned_30.get("salary_days"), list) and planned_30.get("salary_days")
                else "None in window",
            ),
            (
                "Next live",
                f"{next_live.get('start_date')}  {next_live.get('title')}"
                if isinstance(next_live, dict)
                else "No scheduled live in window",
            ),
        ]
        for label_text, value in planned_lines:
            row = tk.Frame(right, bg=self.colors['bg_card'])
            row.pack(fill=tk.X, pady=(10, 0))
            tk.Label(row, text=label_text, bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 11)).pack(side=tk.LEFT)
            tk.Label(row, text=value, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 11, 'bold')).pack(side=tk.RIGHT)

        recurring_card = tk.Frame(frame, bg=self.colors['bg_card'], padx=16, pady=16)
        recurring_card.pack(fill=tk.X, pady=(16, 0))
        tk.Label(recurring_card, text="Recurring Costs", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")
        recurring = [
            ("Member salaries / month", monthly_salary_total),
            ("Staff + office / day", (last_entry or {}).get("staff", 0) + (last_entry or {}).get("office", 0)),
            ("Promotion / day", (last_entry or {}).get("promotion", 0)),
            ("Live ops / last day", (last_entry or {}).get("live_ops_cost", (last_entry or {}).get("live_cost", 0))),
            ("Venue fees / last day", (last_entry or {}).get("live_venue_fee", 0)),
            ("Tokutenkai ops / last day", (last_entry or {}).get("tokutenkai_cost", 0)),
            ("Tokutenkai idol share / last day", (last_entry or {}).get("tokutenkai_idol_share", 0)),
        ]
        for label_text, amount in recurring:
            row = tk.Frame(recurring_card, bg=self.colors['bg_card'])
            row.pack(fill=tk.X, pady=(10, 0))
            tk.Label(row, text=label_text, bg=self.colors['bg_card'], fg=self.colors['text_secondary'], font=('Arial', 11)).pack(side=tk.LEFT)
            tk.Label(row, text=f"JPY {int(amount):,}", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 11, 'bold')).pack(side=tk.RIGHT)

        ledger_card = tk.Frame(frame, bg=self.colors['bg_card'], padx=16, pady=16)
        ledger_card.pack(fill=tk.BOTH, expand=True, pady=(16, 0))
        tk.Label(ledger_card, text="Recent Ledger", bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 16, 'bold')).pack(anchor="w")

        ledger_canvas = tk.Canvas(ledger_card, bg=self.colors['bg_card'], highlightthickness=0, height=260)
        ledger_scroll = tk.Scrollbar(ledger_card, orient=tk.VERTICAL, command=ledger_canvas.yview)
        ledger_host = tk.Frame(ledger_canvas, bg=self.colors['bg_card'])
        ledger_window = ledger_canvas.create_window((0, 0), window=ledger_host, anchor="nw")

        def _ledger_region(_event=None):
            bbox = ledger_canvas.bbox("all")
            ledger_canvas.configure(scrollregion=bbox or (0, 0, 0, 0))

        def _ledger_width(event):
            ledger_canvas.itemconfigure(ledger_window, width=event.width)

        ledger_host.bind("<Configure>", _ledger_region)
        ledger_canvas.bind("<Configure>", _ledger_width)
        ledger_canvas.configure(yscrollcommand=ledger_scroll.set)
        ledger_canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True, pady=(10, 0))
        ledger_scroll.pack(side=tk.RIGHT, fill=tk.Y, pady=(10, 0))
        self.bind_mousewheel(ledger_canvas, ledger_canvas)
        self.bind_mousewheel(ledger_host, ledger_canvas)

        header = tk.Frame(ledger_host, bg=self.colors['accent_light'])
        header.pack(fill=tk.X, pady=(0, 6))
        for text, width in [("Date", 14), ("Income", 14), ("Expenses", 14), ("Net", 14), ("Top Driver", 28)]:
            tk.Label(header, text=text, bg=self.colors['accent_light'], fg=self.colors['text_primary'], font=('Arial', 9, 'bold'), width=width, anchor='w', padx=6, pady=6).pack(side=tk.LEFT)

        for row in reversed(ledger[-20:]):
            item = tk.Frame(ledger_host, bg=self.colors['bg_card'])
            item.pack(fill=tk.X, pady=1)
            driver = max(
                [
                    ("Digital", int(row.get("digital_sales", 0))),
                    ("Fan meetings", int(row.get("fan_meetings", 0))),
                    ("Tokutenkai", int(row.get("tokutenkai_revenue", 0))),
                    ("Goods", int(row.get("goods", 0))),
                    ("Media", int(row.get("media", 0))),
                    ("Lives", int(row.get("live_tickets", 0)) + int(row.get("live_goods", 0))),
                ],
                key=lambda pair: pair[1],
            )[0]
            values = [
                row.get("date", "-"),
                f"JPY {int(row.get('income_total', 0)):,}",
                f"JPY {int(row.get('expense_total', 0)):,}",
                f"JPY {int(row.get('net_total', 0)):,}",
                driver,
            ]
            for value, width in zip(values, [14, 14, 14, 14, 28]):
                tk.Label(item, text=value, bg=self.colors['bg_card'], fg=self.colors['text_primary'], font=('Arial', 9), width=width, anchor='w', padx=6, pady=6).pack(side=tk.LEFT)

    def show_startup_screen(self):
        """Render the opening launcher flow before entering the main management UI."""
        self._browse_mode = False
        self._apply_navigation_mode()
        self._set_startup_navigation_enabled(False)
        for widget in self.content_frame.winfo_children():
            widget.destroy()

        outer = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        outer.pack(fill=tk.BOTH, expand=True, padx=36, pady=36)

        hero = tk.Frame(outer, bg=self.colors['bg_card'], padx=28, pady=28)
        hero.pack(fill=tk.X)
        tk.Label(
            hero,
            text="IDOL PRODUCER",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 28, 'bold'),
        ).pack(anchor="w")
        tk.Label(
            hero,
            text="Choose how to enter the world: start a fresh scenario, load a save, or browse the database first.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 12),
            wraplength=920,
            justify=tk.LEFT,
        ).pack(anchor="w", pady=(8, 0))

        if self._startup_screen == "new_game":
            self._show_new_game_startup_screen(outer)
            return

        actions = tk.Frame(outer, bg=self.colors['bg_content'])
        actions.pack(fill=tk.X, pady=(24, 16))
        buttons_enabled = self._data_loaded
        action_button_bg = self.colors['accent']
        for label, command in [
            ("New Game", self._open_new_game_startup_screen),
            ("Load", self._startup_load_game),
            ("Browse", self._startup_browse_database),
        ]:
            btn = tk.Button(
                actions,
                text=label,
                bg=action_button_bg,
                fg=self.colors['text_primary'],
                relief=tk.FLAT,
                width=14,
                padx=28,
                pady=18,
                font=('Arial', 14, 'bold'),
                command=command,
                cursor='hand2',
                state=tk.NORMAL if buttons_enabled else tk.DISABLED,
                disabledforeground=self.colors['text_secondary'],
            )
            btn.pack(side=tk.LEFT, padx=(0, 16))

        status_frame = tk.Frame(outer, bg=self.colors['bg_card'], padx=24, pady=20)
        status_frame.pack(fill=tk.X)
        tk.Label(
            status_frame,
            text="Status",
            bg=status_frame['bg'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10, 'bold'),
        ).pack(anchor="w")
        if not self._data_loaded:
            tk.Label(
                status_frame,
                text="Loading database...",
                bg=status_frame['bg'],
                fg=self.colors['text_primary'],
                font=('Arial', 16, 'bold'),
            ).pack(anchor="w", pady=(8, 0))
        tk.Label(
            status_frame,
            text=self._startup_status,
            bg=status_frame['bg'],
            fg=self.colors['text_primary'],
            font=('Arial', 12),
            justify=tk.LEFT,
            wraplength=900,
        ).pack(anchor="w", pady=(6, 0))

    def _show_new_game_startup_screen(self, parent):
        """Render the dedicated new-game page."""
        card = tk.Frame(parent, bg=self.colors['bg_card'], padx=28, pady=28)
        card.pack(fill=tk.BOTH, expand=True, pady=(24, 0))

        tk.Label(
            card,
            text="NEW GAME",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 24, 'bold'),
        ).pack(anchor="w")
        tk.Label(
            card,
            text="Set your producer name, confirm the available scenario, and choose a playable group from the scenario 6 opening snapshot.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 11),
            wraplength=980,
            justify=tk.LEFT,
        ).pack(anchor="w", pady=(6, 18))

        name_row = tk.Frame(card, bg=self.colors['bg_card'])
        name_row.pack(fill=tk.X, pady=(0, 16))
        tk.Label(
            name_row,
            text="Producer Name",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 11, 'bold'),
        ).pack(anchor="w")
        self.player_name_var = tk.StringVar(value=self.player_name or "")
        tk.Entry(
            name_row,
            textvariable=self.player_name_var,
            bg=self.colors['bg_main'],
            fg=self.colors['text_primary'],
            insertbackground=self.colors['text_primary'],
            relief=tk.FLAT,
            font=('Arial', 12),
        ).pack(fill=tk.X, pady=(8, 0), ipady=8)

        scenario_row = tk.Frame(card, bg=self.colors['bg_card'])
        scenario_row.pack(fill=tk.X, pady=(0, 18))
        tk.Label(
            scenario_row,
            text="Scenario",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 11, 'bold'),
        ).pack(anchor="w")
        scenario_text = "Scenario 6: Latest Snapshot"
        if self._startup_scenario_date is not None:
            scenario_text += f"  |  Opening Date: {self._startup_scenario_date.isoformat()}"
        tk.Button(
            scenario_row,
            text=scenario_text + "  (Available)",
            bg=self.colors['accent'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=16,
            pady=10,
            font=('Arial', 11, 'bold'),
            state=tk.DISABLED,
            disabledforeground=self.colors['text_primary'],
        ).pack(anchor="w", pady=(8, 0))

        groups_frame = tk.Frame(card, bg=self.colors['bg_card'])
        groups_frame.pack(fill=tk.BOTH, expand=True)
        groups_frame.columnconfigure(0, weight=1)
        groups_frame.rowconfigure(1, weight=1)

        tk.Label(
            groups_frame,
            text="Managed Group",
            bg=self.colors['bg_card'],
            fg=self.colors['text_primary'],
            font=('Arial', 11, 'bold'),
        ).grid(row=0, column=0, sticky="w")
        tk.Label(
            groups_frame,
            text="Playable roster list loaded from the scenario 6 snapshot with scenario tier data. Recommended starts are pinned on top: =LOVE, iLiFE!, 高嶺のなでしこ, アキシブproject.",
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 9),
            justify=tk.LEFT,
            wraplength=960,
        ).grid(row=0, column=1, sticky="e")

        table = tk.Frame(groups_frame, bg=self.colors['bg_card'])
        table.grid(row=1, column=0, columnspan=2, sticky="nsew", pady=(10, 0))
        group_tree = ttk.Treeview(
            table,
            columns=("tier", "members", "formed", "popularity"),
            show="tree headings",
            height=18,
        )
        for key, heading, width in [
            ("tier", "Tier", 70),
            ("members", "Members", 90),
            ("formed", "Formed", 110),
            ("popularity", "Popularity", 100),
        ]:
            group_tree.heading(key, text=heading)
            group_tree.column(key, width=width, anchor="w")
        group_tree["displaycolumns"] = ("tier", "members", "formed", "popularity")
        group_tree.column("#0", width=340, minwidth=260, stretch=True, anchor="w")
        group_tree.heading("#0", text="Group")
        group_scroll = tk.Scrollbar(table, orient=tk.VERTICAL, command=group_tree.yview)
        group_tree.configure(yscrollcommand=group_scroll.set)
        group_tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        group_scroll.pack(side=tk.RIGHT, fill=tk.Y)

        group_lookup: dict[str, dict[str, Any]] = {}
        selected_item_id = None
        for row in self._startup_group_rows:
            item_id = group_tree.insert(
                "",
                "end",
                text=str(row.get("name") or "Unknown Group"),
                values=(
                    str(row.get("tier") or "—"),
                    str(row.get("member_count") or 0),
                    str(row.get("formed_date") or "—"),
                    str(row.get("popularity") if row.get("popularity") is not None else "—"),
                ),
            )
            group_lookup[item_id] = row
            if str(row.get("uid") or "") == self._startup_selected_group_uid:
                selected_item_id = item_id
        if selected_item_id:
            group_tree.selection_set(selected_item_id)
            group_tree.focus(selected_item_id)

        detail_var = tk.StringVar(
            value="Scenario data is still loading..." if not self._data_loaded else "Select a group to preview its current opening-day roster."
        )
        tk.Label(
            card,
            textvariable=detail_var,
            bg=self.colors['bg_card'],
            fg=self.colors['text_secondary'],
            font=('Arial', 10),
            justify=tk.LEFT,
            anchor="w",
            wraplength=980,
        ).pack(fill=tk.X, pady=(14, 0))

        def _refresh_group_detail(_event=None):
            selection = group_tree.selection()
            if not selection:
                detail_var.set("Select a group to preview its current opening-day roster.")
                return
            row = group_lookup.get(selection[0], {})
            self._startup_selected_group_uid = str(row.get("uid") or "")
            member_names = row.get("member_names", []) if isinstance(row.get("member_names"), list) else []
            members = ", ".join(member_names[:10])
            if members and len(member_names) > 10:
                members += f", +{len(member_names) - 10} more"
            detail_var.set(
                "\n".join(
                    [
                        str(row.get("name") or "Unknown Group"),
                        f"Tier: {row.get('tier') or '—'}",
                        f"Current members at opening: {row.get('member_count') or 0}",
                        f"Formed: {row.get('formed_date') or '—'} | Popularity: {row.get('popularity') if row.get('popularity') is not None else '—'}",
                        f"Roster: {members or 'No members found in the opening snapshot.'}",
                    ]
                )
            )

        group_tree.bind("<<TreeviewSelect>>", _refresh_group_detail)
        self.root.after_idle(lambda: self.bind_mousewheel(group_tree, group_tree))

        actions = tk.Frame(card, bg=self.colors['bg_card'])
        actions.pack(fill=tk.X, pady=(18, 0))
        tk.Button(
            actions,
            text="Back",
            bg=self.colors['bg_sidebar'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=18,
            pady=10,
            font=('Arial', 11, 'bold'),
            command=self._return_to_startup_home,
            cursor='hand2',
        ).pack(side=tk.LEFT)
        tk.Button(
            actions,
            text="Start Scenario",
            bg=self.colors['green'],
            fg=self.colors['text_primary'],
            relief=tk.FLAT,
            padx=18,
            pady=10,
            font=('Arial', 11, 'bold'),
            command=self._startup_begin_new_game,
            cursor='hand2',
        ).pack(side=tk.LEFT, padx=(12, 0))

    def _open_new_game_startup_screen(self):
        """Open the new-game setup screen."""
        self._startup_screen = "new_game"
        if self._data_loaded:
            self._startup_status = f"Scenario data ready. {len(self._startup_group_rows)} playable groups loaded for selection."
        self.show_startup_screen()

    def _return_to_startup_home(self):
        """Return from the new-game screen to the home launcher."""
        self._startup_screen = "home"
        self.show_startup_screen()

    def _rebuild_startup_group_rows(self) -> None:
        """Build the playable group selection rows for the default scenario."""
        tier_lookup = self._load_startup_group_tier_lookup()
        report_lookup = self._load_startup_group_report_lookup()
        recommended_order = {
            "=love": 0,
            "ilife!": 1,
            "iLiFE!".casefold(): 1,
            "高嶺のなでしこ".casefold(): 2,
            "アキシブproject".casefold(): 3,
        }
        tier_rank = {"S": 0, "A": 1, "B": 2, "C": 3, "D": 4, "E": 5, "F": 6}
        rows: list[dict[str, Any]] = []
        manager = self.group_manager
        if manager is None:
            self._startup_group_rows = rows
            self._startup_selected_group_uid = ""
            return
        for group in manager.groups.values():
            if not self._is_group_playable_start(group):
                continue
            override = self._startup_group_override_policy(group)
            if override.get("available") is False:
                continue
            members = list(getattr(group, "members", []) or [])
            if not members:
                continue
            group_uid = str(getattr(group, "uid", "") or "")
            group_name = str(group.name or group.name_romanji or "")
            group_name_romanji = str(group.name_romanji or "")
            report_row = (
                report_lookup.get(group_uid)
                or report_lookup.get(group_uid.casefold())
                or report_lookup.get(group_name)
                or report_lookup.get(group_name.casefold())
                or report_lookup.get(group_name_romanji)
                or report_lookup.get(group_name_romanji.casefold())
            )
            if report_lookup and report_row is None:
                continue
            tier = (
                tier_lookup.get(group_uid)
                or tier_lookup.get(group_uid.casefold())
                or tier_lookup.get(group_name)
                or tier_lookup.get(group_name.casefold())
                or tier_lookup.get(group_name_romanji)
                or tier_lookup.get(group_name_romanji.casefold())
                or self._infer_startup_group_tier(group, report_row)
            )
            setattr(group, "tier", tier)
            recommended_index = None
            for candidate in (group_name, group_name_romanji):
                key = str(candidate or "").casefold()
                if key in recommended_order:
                    recommended_index = recommended_order[key]
                    break
            rows.append(
                {
                    "uid": group_uid,
                    "name": group_name,
                    "group": group,
                    "member_count": len(members),
                    "formed_date": getattr(group, "formed_date", None),
                    "popularity": getattr(group, "popularity", None),
                    "member_names": [idol.name for idol in members],
                    "tier": tier,
                    "recommended_index": recommended_index,
                }
            )
        rows.sort(
            key=lambda item: (
                0 if item.get("recommended_index") is not None else 1,
                int(item.get("recommended_index")) if item.get("recommended_index") is not None else 999,
                tier_rank.get(str(item.get("tier") or "").upper(), 999),
                -(int(item["popularity"]) if item.get("popularity") not in (None, "") else -1),
                str(item.get("name") or "").casefold(),
            )
        )
        self._startup_group_rows = rows
        selected_uid = self._startup_selected_group_uid
        if not rows:
            self._startup_selected_group_uid = ""
        elif not selected_uid or all(str(row.get("uid") or "") != selected_uid for row in rows):
            self._startup_selected_group_uid = str(rows[0].get("uid") or "")

    def _startup_begin_new_game(self):
        """Start a fresh scenario using the selected startup options."""
        if not self._data_loaded:
            messagebox.showinfo("New Game", "The scenario snapshot is still loading. Please wait a moment.")
            return
        if hasattr(self, "player_name_var"):
            self.player_name = str(self.player_name_var.get() or "").strip()
        if not self.player_name:
            messagebox.showinfo("New Game", "Please enter a producer name before starting.")
            return
        selected_row = next(
            (row for row in self._startup_group_rows if str(row.get("uid") or "") == self._startup_selected_group_uid),
            None,
        )
        if selected_row is None:
            messagebox.showinfo("New Game", "Please choose a managed group first.")
            return

        opening_date = self._startup_scenario_date or date.today()
        self.current_date = opening_date
        self.game_start_date = opening_date
        self.selected_calendar_date = opening_date
        self.calendar_month_anchor = opening_date.replace(day=1)
        self.turn_number = 1
        self.startup_group = str(selected_row.get("name") or "")
        self.startup_view = "Inbox"
        self.startup_date = opening_date.isoformat()
        self.player_group = None
        self.current_idol = None
        self.shortlisted_idols = []
        self._daily_todos_cache.clear()
        self._schedule_save_overrides = {}
        self._live_schedules = []
        self._live_results = []
        self._finances = {}
        self._notifications = []
        self._selected_notification_uid = ""
        self._training_intensity = {}
        self._training_week_log = {}
        self._training_focus_skill = {}
        self._scout_state = {
            "selected_company_uid": self._scout_companies[0].uid if self._scout_companies else "",
            "auditions": {},
        }
        self._scenario_future_events = []
        self._pending_scenario_notifications = []
        self._initialize_scenario_runtime_snapshot(opening_date)
        selected_group = None
        if self.group_manager is not None:
            for group in self.group_manager.get_all_groups():
                if str(getattr(group, "uid", "") or "") == str(selected_row.get("uid") or ""):
                    selected_group = group
                    break
            if selected_group is None:
                selected_group = self.group_manager.find_group(str(selected_row.get("name") or ""))
        if selected_group is None:
            selected_group = selected_row["group"]
        self._set_player_group(selected_group)
        self._seed_opening_live_schedule()
        self._seed_startup_inbox_if_needed()
        self._seed_daily_inbox_for_date(self.current_date)
        self._startup_game_started = True
        self._startup_enabled = False
        self._browse_mode = False
        self._apply_navigation_mode()
        self._set_startup_navigation_enabled(True)
        self._persist_game_save()
        self._raw_game_save = self._read_raw_save()
        self._game_save_payload = GameSave.normalize_payload(self._raw_game_save)
        self.switch_view("Inbox", skip_history=True)

    def _startup_load_game(self):
        """Open a save file from the startup launcher and enter the main UI."""
        selected_path = self._prompt_for_game_save_path()
        if not selected_path:
            return
        self._load_game_from_path(selected_path)

    def _startup_browse_database(self):
        """Enter the browser without selecting a managed group."""
        if not self._data_loaded:
            messagebox.showinfo("Browse", "The database is still loading. Please wait a moment.")
            return
        if self._startup_scenario_date is not None:
            self.current_date = self._startup_scenario_date
            self.selected_calendar_date = self.current_date
            self.calendar_month_anchor = self.current_date.replace(day=1)
            self.group_manager = get_group_manager(reload=True, reference_date=self.current_date)
        self.player_group = None
        self.shortlisted_idols = []
        self.refresh_shortlist_sidebar()
        self._reset_title_bar_default()
        self._startup_enabled = False
        self._startup_game_started = True
        self._browse_mode = True
        self.current_view = "Groups"
        self._apply_navigation_mode()
        self._set_startup_navigation_enabled(True)
        self.switch_view("Groups", skip_history=True)

    def show_loading_screen(self):
        """Show loading screen while data is being loaded."""
        # Clear existing content
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        # Create loading frame
        loading_frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        loading_frame.pack(expand=True, fill=tk.BOTH)
        
        tk.Label(loading_frame, text="Loading Idol Producer...", 
                bg=self.colors['bg_content'],
                fg=self.colors['text_primary'],
                font=('Arial', 24, 'bold')).pack(pady=50)
        
        tk.Label(loading_frame, text="Please wait while we load the database...", 
                bg=self.colors['bg_content'],
                fg=self.colors['text_secondary'],
                font=('Arial', 14)).pack(pady=10)
        
        # Loading indicator
        self.loading_label = tk.Label(loading_frame, text="●", 
                bg=self.colors['bg_content'],
                fg=self.colors['accent'],
                font=('Arial', 20))
        self.loading_label.pack(pady=20)
        
        # Animate loading indicator
        self._animate_loading()
    
    def _animate_loading(self):
        """Animate loading indicator."""
        if not self._data_loaded:
            dots = ["●", "●●", "●●●", "●●", "●"]
            if not hasattr(self, '_loading_dot_index'):
                self._loading_dot_index = 0
            self._loading_dot_index = (self._loading_dot_index + 1) % len(dots)
            if hasattr(self, 'loading_label') and self.loading_label.winfo_exists():
                self.loading_label.config(text=dots[self._loading_dot_index])
                self.call_after(500, self._animate_loading)
    
    def load_data_async(self):
        """Load data asynchronously to avoid freezing the UI."""
        import threading
        import queue
        
        # Use a queue to pass data from background thread to main thread
        data_queue = queue.Queue()
        
        def load_data():
            """Load data in background thread."""
            try:
                if self._debug:
                    print("[DEBUG] Loading idols and groups...")
                idols = get_sample_idols()
                
                if self._debug:
                    print(f"[DEBUG] Loaded {len(idols)} idols")
                
                # Put data in queue for main thread to process
                data_queue.put(('success', idols))
            except Exception as e:
                if self._debug:
                    print(f"[DEBUG] Error loading data: {e}")
                    import traceback
                    traceback.print_exc()
                data_queue.put(('error', str(e)))
        
        def check_queue():
            """Check for data from background thread and update UI."""
            try:
                status, data = data_queue.get_nowait()
                if status == 'success':
                    self._on_data_loaded(data)
                else:
                    # Show error message
                    self._show_error_message(data)
            except queue.Empty:
                # No data yet, check again later
                self.call_after(100, check_queue)
        
        # Start loading in background thread
        thread = threading.Thread(target=load_data, daemon=True)
        thread.start()
        
        # Start checking for data
        self.call_after(100, check_queue)
    
    def _show_error_message(self, error_msg: str):
        """Show error message in UI."""
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        
        error_frame = tk.Frame(self.content_frame, bg=self.colors['bg_content'])
        error_frame.pack(expand=True, fill=tk.BOTH)
        
        tk.Label(error_frame, text="Error Loading Data", 
                bg=self.colors['bg_content'],
                fg=self.colors['red'],
                font=('Arial', 20, 'bold')).pack(pady=20)
        
        tk.Label(error_frame, text=error_msg, 
                bg=self.colors['bg_content'],
                fg=self.colors['text_secondary'],
                font=('Arial', 12), wraplength=600).pack(pady=10)
    
    def _on_data_loaded(self, idols: List[Idol]):
        """Called when data loading is complete."""
        try:
            if self._debug:
                print(f"[DEBUG] _on_data_loaded called with {len(idols)} idols")
            self.idols = idols
            reference_date = self._startup_scenario_date if self._startup_enabled else self.current_date
            self.group_manager = get_group_manager(reference_date=reference_date)
            self._scenario_report = self._load_active_scenario_report()
            self._idol_info_lookup = self._load_idol_info_lookup()
            self._data_loaded = True
            
            if self._debug:
                print(f"[DEBUG] Updating UI with {len(self.idols)} idols...")

            if self._startup_enabled and not self._startup_game_started:
                self._rebuild_startup_group_rows()
                self._startup_status = f"Scenario data ready. {len(self._startup_group_rows)} playable groups loaded for Scenario 6."
                self.refresh_shortlist_sidebar()
                self.show_startup_screen()
                return

            self._apply_save_game_state()
            self.refresh_shortlist_sidebar()
            if not self._save_payload_has_database_snapshot():
                self._persist_game_save()
                self._raw_game_save = self._read_raw_save()
                self._game_save_payload = GameSave.normalize_payload(self._raw_game_save)
            elif self._scenario_runtime_dirty:
                self._persist_game_save()
                self._scenario_runtime_dirty = False
            self.call_after(50, self._show_today_view_after_load)
            
        except Exception as e:
            import traceback
            traceback.print_exc()
    
    def _show_today_view_after_load(self):
        """Show the daily dashboard after data is loaded."""
        try:
            if self._debug:
                print("[DEBUG] _show_today_view_after_load called")
            if not self.player_group and self.startup_group:
                manager = self.group_manager or get_group_manager()
                group = manager.find_group(self.startup_group) if manager else None
                if group is not None:
                    self._set_player_group(group)
                    self._seed_startup_inbox_if_needed()
                    self._seed_daily_inbox_for_date(self.current_date)
                    self._persist_game_save()
                    if self.startup_view == "Groups":
                        self.current_view = "Groups"
                        self.show_group_detail_page(group)
                        return
                    self._current_group = group
            elif self.player_group and self.startup_view == "Groups":
                self.current_view = "Groups"
                self.show_group_detail_page(self.player_group)
                return

            if self.player_group:
                before_count = len(self._notifications)
                self._seed_daily_inbox_for_date(self.current_date)
                if len(self._notifications) != before_count:
                    self._persist_game_save()

            if self.startup_view == "Idols":
                self.show_idols_view()
            elif self.startup_view == "Groups":
                self.show_groups_view()
            elif self.startup_view == "Schedule":
                self.show_schedule_view()
            else:
                self.show_today_view()
            if self._debug:
                print(f"[DEBUG] startup view {self.startup_view} completed")
        except Exception as e:
            if self._debug:
                print(f"[DEBUG] Error in show_today_view: {e}")
                import traceback
                traceback.print_exc()
    
    def _save_current_state_to_history(self):
        """Save current navigation state to history."""
        # Don't save if we're in the middle of programmatic navigation
        if self._navigating:
            return
        state = self._build_navigation_state()

        # Compare lightweight state signatures instead of whole Idol/Group dataclasses.
        # Deep dataclass equality can walk large rosters/histories and stall navigation.
        if not self.nav_history_back or self._navigation_state_signature(self.nav_history_back[-1]) != self._navigation_state_signature(state):
            self.nav_history_back.append(state)
            # Clear forward history when navigating to new page
            self.nav_history_forward.clear()
            # Limit history size
            if len(self.nav_history_back) > 50:
                self.nav_history_back.pop(0)
            
            # Update buttons
            self._update_nav_buttons()

    def _build_navigation_state(self) -> dict:
        """Capture the current page as a restorable navigation waypoint."""
        idol = self.current_idol if self.current_view == "Idols" else None
        group = getattr(self, '_current_group', None) if self.current_view == "Groups" else None
        songs_state = copy.deepcopy(self._songs_view_state) if self.current_view == "Songs" else {}
        return {
            'view': self.current_view,
            'idol': idol,
            'group': group,
            'date': self.current_date,
            'selected_calendar_date': self.selected_calendar_date,
            'turn_number': self.turn_number,
            'songs_state': songs_state,
        }

    def _resolve_group_from_state(self, state: dict):
        """Resolve a group object from a saved navigation state."""
        group = state.get('group')
        if group is not None:
            return group

        songs_state = state.get('songs_state') or {}
        target_uid = str(songs_state.get("group_uid") or "")
        if not target_uid:
            return self.player_group

        manager = self.group_manager
        if manager is None:
            return self.player_group
        for candidate in manager.get_all_groups():
            if str(getattr(candidate, "uid", "") or "") == target_uid:
                return candidate
        return self.player_group

    def _update_nav_buttons(self):
        """Update back/forward button states."""
        if self.back_btn:
            # Back button enabled if there's at least one previous state
            if len(self.nav_history_back) > 1:
                self.back_btn.config(state=tk.NORMAL)
            else:
                self.back_btn.config(state=tk.DISABLED)
        
        if self.forward_btn:
            # Forward button enabled if there's forward history
            if self.nav_history_forward:
                self.forward_btn.config(state=tk.NORMAL)
            else:
                self.forward_btn.config(state=tk.DISABLED)

    def _set_startup_navigation_enabled(self, enabled: bool) -> None:
        """Enable or disable normal in-game navigation during the startup launcher."""
        button_state = tk.NORMAL if enabled else tk.DISABLED
        for btn in getattr(self, "nav_buttons", {}).values():
            try:
                btn.config(state=button_state)
            except Exception:
                pass
        for widget_name in ("date_button", "continue_btn"):
            widget = getattr(self, widget_name, None)
            if widget is not None:
                try:
                    widget.config(state=button_state)
                except Exception:
                    pass
    
    def navigate_back(self):
        """Navigate back in history."""
        # Need at least 2 states: current + at least one previous
        if len(self.nav_history_back) <= 1:
            return

        # Save current state to forward history
        current_state = self._build_navigation_state()
        self.nav_history_forward.append(current_state)
        
        # Remove current state and get previous state
        self.nav_history_back.pop()  # Remove current state
        prev_state = self.nav_history_back[-1]  # Get previous state (now last in list)
        
        # Navigate to previous state
        self._navigating = True
        self._restore_state(prev_state)
        self._navigating = False
        
        # Update buttons
        self._update_nav_buttons()
    
    def navigate_forward(self):
        """Navigate forward in history."""
        if not self.nav_history_forward:
            return

        # Get next state and make it the new current state on the back stack.
        # Pushing the old current state here can leave the restored page missing
        # from back history, which causes the next Back click to skip a page.
        next_state = self.nav_history_forward.pop()
        if not self.nav_history_back or self._navigation_state_signature(self.nav_history_back[-1]) != self._navigation_state_signature(next_state):
            self.nav_history_back.append(next_state)
        
        # Navigate to next state
        self._navigating = True
        self._restore_state(next_state)
        self._navigating = False
        
        # Update buttons
        self._update_nav_buttons()

    def _navigation_state_signature(self, state: dict) -> tuple:
        """Return a cheap, stable signature for history dedupe checks."""
        idol = state.get('idol')
        group = state.get('group')
        songs_state = state.get('songs_state') or {}
        return (
            state.get('view'),
            getattr(idol, 'uid', None) or getattr(idol, 'name', None),
            getattr(group, 'uid', None) or getattr(group, 'name', None),
            state.get('date'),
            state.get('selected_calendar_date'),
            state.get('turn_number'),
            songs_state.get("group_uid"),
            songs_state.get("tab"),
            songs_state.get("song_uid"),
            songs_state.get("disc_uid"),
        )

    def _restore_state(self, state: dict):
        """Restore a navigation state."""
        view = state.get('view', 'Today')
        idol = state.get('idol')
        group = state.get('group')
        songs_state = copy.deepcopy(state.get('songs_state') or {})
        self.current_date = state.get('date', self.current_date)
        self.selected_calendar_date = state.get('selected_calendar_date', self.current_date)
        self.turn_number = state.get('turn_number', self.turn_number)
        self.calendar_month_anchor = self.selected_calendar_date.replace(day=1)
        self.refresh_date_display()
        
        # Update view
        self.current_view = view
        for name, btn in self.nav_buttons.items():
            if name == view:
                btn.config(bg=self.colors['accent'])
            else:
                btn.config(bg=self.colors['bg_sidebar'])
        
        # Clear content
        for widget in self.content_frame.winfo_children():
            widget.destroy()
        self.root.update_idletasks()
        
        # Restore appropriate view
        if idol:
            self.current_idol = idol
            # Use skip_landing to go directly to profile
            # Set view to Idols if it's not already
            if self.current_view != "Idols":
                self.current_view = "Idols"
            self._show_idol_profile(idol)
        elif view == "Songs":
            target_group = self._resolve_group_from_state(state)
            self._songs_view_state = songs_state or {
                "group_uid": str(getattr(target_group, "uid", "") or ""),
                "tab": "group_songs",
                "song_uid": "",
                "disc_uid": "",
            }
            self.show_songs_view(group=target_group, tab=str(self._songs_view_state.get("tab") or "group_songs"))
        elif group:
            self._current_group = group
            # Set view to Groups if it's not already
            if self.current_view != "Groups":
                self.current_view = "Groups"
            self.show_group_detail_page(group)
        else:
            # Just show the view
            if view == "Idols":
                self.show_idols_view()
            elif view == "Groups":
                self.show_groups_view()
            elif view == "Today":
                self.show_today_view()
            else:
                self.switch_view(view, skip_history=True)


def main(debug: bool = False, startup_group: Optional[str] = None, startup_view: Optional[str] = None, startup_date: Optional[str] = None):
    """Main entry point.
    
    Args:
        debug: If True, enable debug mode with verbose logging
    """
    root = tk.Tk()
    
    # Ensure window appears on top and is visible
    root.lift()
    root.attributes('-topmost', True)
    root.after_idle(lambda: root.attributes('-topmost', False))
    
    print("Creating UI...")
    
    # Create UI (this should be fast - no data loading)
    app = IdolProfileUI(root, debug=debug, startup_group=startup_group, startup_view=startup_view, startup_date=startup_date)
    
    # Force multiple updates to ensure UI is fully rendered and responsive
    root.update_idletasks()
    root.update()
    root.update_idletasks()
    
    # Ensure window is visible and not minimized
    root.state('normal')
    root.deiconify()  # Show window if it was iconified
    
    # Bring to front one more time after initialization
    root.lift()
    root.focus_force()
    
    # Final update to ensure everything is visible
    root.update_idletasks()
    
    # Get window geometry for debugging (only if debug mode)
    if debug:
        try:
            geometry = root.geometry()
            print(f"[DEBUG] Window geometry: {geometry}")
            print(f"[DEBUG] Window state: {root.state()}")
        except:
            pass
    
    if debug:
        print("[DEBUG] UI is ready. Starting main loop...")
        print("[DEBUG] Data will load in the background...")
    
    # Remove unnecessary update calls before mainloop
    root.mainloop()


if __name__ == "__main__":
    main()


