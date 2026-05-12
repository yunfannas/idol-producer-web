# Web port plan (idol-producer-web ← idol_producer desktop)

**Purpose:** Sequence work to bring the standalone **idol-producer-web** repo up toward desktop parity for the six feature areas below.  
**Assumption:** Web keeps **JSON save + scenario bundles** in the browser (or static hosting); heavy batch jobs (tier list rebuilds, idolsdiagram scrape) stay **Python offline** with artifacts shipped into `public/data/`.

---

## Decisions (locked — 2026-05-10)

| Topic | Decision |
|--------|-----------|
| **Scout eligibility** | **Retired** if `(time since last group ended) + age ≥ 30` (use calendar math + idol age on reference date). Otherwise, an idol **with no current group** = **freelancer**. Scout recommendations for the “solo” track will later use a **curated solo list** (actively performing solo idols drawn from freelancers); **v1** implements freelancer + retired rule only; **solo list** is a follow-up milestone once defined. |
| **Tier / letter ranks** | **Static only:** per scenario, ship precomputed JSON from the desktop pipeline (`build_scenario_group_tier_list.py`, `group_tier_policy.json`, scenario outputs). **No** in-browser idolsdiagram scrape or live tier recompute. |
| **Events / inbox** | **Full desktop parity target:** `requires_confirmation`, `choice_*`, and **blocking NEXT DAY** until resolved where desktop does the same. |
| **Active implementation scope** | **Scenario 6 only** for engineering (opening `2025-07-20`, data under `database/game_scenarios/scenario_6_2025-07-20/`). **Documentation** for scenarios 1–5 is carried in this plan + pointers below so later ports do not rediscover design from scratch. |

---

## References (desktop)

| Area | Primary desktop / data |
|------|-------------------------|
| New game / tiers | `ui/main_ui.py` (`_rebuild_startup_group_rows`, `_load_startup_group_tier_lookup`, playable filter), `database/group_tier_policy.json`, `database/group_tier_assignments.json`, `scripts/build_scenario_group_tier_list.py`, `database/game_scenarios/scenario_6_2025-07-20/` |
| Live schedule | `ui/main_ui.py` `_live_schedules`, `_add_live_scheduled_notification`, `_seed_opening_live_schedule`, save serialization |
| Calendar | `ui/main_ui.py` calendar views, `advance_turn`, date anchors |
| Scout | `scout_system.py`, `docs/scout_system_design.md`, `ui/main_ui.py` scout views |
| Inbox events | `ui/main_ui.py` inbox + `_add_notification`, `scenario_runtime` / `apply_due_future_events` (`scenario_runtime.py`) |
| Live results + events | `live_performance_system.py`, live resolution flows, notifications after lives |

**Web baseline (sibling repo):** `createGameSaveFromLoadedScenario`, `advanceOneDay`, training / inbox / schedule strip, `livePerformanceWeb.ts`, partial `scout` save block.

---

## Other scenarios (documentation for later ports)

Implementation work stays on **scenario 6**; the following is the **design trail** for scenarios **1–5** so web and docs stay aligned when you expand.

| # | Name | Opening (ISO) | Primary design reference |
|---|------|-----------------|---------------------------|
| 1 | Rise of AKB | 2008-12-08 | `docs/project/ROADMAP.md` — “Scenario 1”; `database/game_scenarios/scenario_definitions.json` |
| 2 | Idol Wars | 2013-04-01 | `ROADMAP.md` — “Scenario 2” |
| 3 | Sashihara's Ambition | 2017-01-01 | `ROADMAP.md` — “Scenario 3” |
| 4 | COVID Challenge | 2020-02-01 | `ROADMAP.md` — “Scenario 4” |
| 5 | Kawaii Lab | 2022-03-01 | `ROADMAP.md` — “Scenario 5” |
| **6** | Latest snapshot | **2025-07-20** | `ROADMAP.md` — “Scenario 6”; `docs/scenario6_available_groups.txt`; `database/game_scenarios/scenario_6_2025-07-20/`; preset `database/game_scenarios/test0.json` |

**When adding web support for 1–5:** For each scenario, add under `idol-producer-web/public/data/scenarios/<subdir>/` the same trio as scenario 6 (`idols.json`, `groups.json`, `songs.json`) plus **`group_tiers.json`** (static slice). Mirror `scenario_definitions.json` in a web **`scenarios.json` manifest** (id, name, opening_date, `data_subdir`). No code path is required to load 1–5 until you flip the manifest flag or wire the picker.

**Copy into web repo (optional):** Link or duplicate this file as `idol-producer-web/docs/PORT_FROM_DESKTOP.md` so the sibling repo carries the same plan.

---

## Implementation log (idol-producer-web)

| Date | Milestone | Notes |
|------|------------|--------|
| 2026-05-10 | **M1 (partial)** | Added `public/data/scenarios.json` (six rows, `data_available` flags). Shipped `group_tiers.json` for scenario 6 (generated via `scripts/build-scenario6-group-tiers.mjs` — replace with desktop `build_scenario_group_tier_list.py` when ready). `loadScenarioDatabase` loads optional `group_tiers.json`; `startupGroupPicker.ts` sorts new-game rows by `sort_key`; `buildNewGameRows` + `createGameSaveFromLoadedScenario` use static tier when present. `loadScenariosCatalog()` fetches the catalog (optional UI consumer). `npm run data:group-tiers` regenerates the static tier file. |

---

## Cross-cutting phases

1. **Contract** — JSON shapes + `GAME_SAVE_VERSION` bump; `GAME_SYSTEMS_MANUAL.md` + web `gameSaveSchema.ts`.
2. **Pure logic port** — TS modules + **Vitest** golden fixtures vs Python exports.
3. **Data pipeline** — Static per-scenario bundles; lazy load if size grows.
4. **UI** — Panels in `gameShell.ts` or `src/ui/*.ts`.
5. **Persistence** — `migrate.ts` / normalization.

---

## 1. New game: scenario 6 + static tiers

**Desktop:** Scenario drives paths and playable set; startup rows use tier lookup + ordering; tiers from policy + prebuilt lists.

**Web port strategy:**

| Step | Work |
|------|------|
| 1a | **Manifest:** `public/data/scenarios.json` — include **all six** scenarios for UX copy and future routing; **only scenario 6** `data_subdir` ships full JSON in v1. *(Preset routing stays on `public/data/scenarios/manifest.json` + `presets/*.json`.)* |
| 1b | **Static tiers (scenario 6):** `public/data/scenarios/scenario_6_2025-07-20/group_tiers.json` (subset: `uid`, `letter_tier`, `fans`, `popularity`, `sort_key`) exported from desktop build script. **No** browser-side interpolation. *Until the desktop exporter is wired, regenerate with `npm run data:group-tiers` (same heuristic as `inferLetterTier`).* |
| 1d | **Startup ordering:** Port `_rebuild_startup_group_rows` rules for scenario 6 into `startupGroupPicker.ts` / opening flow (tier rank, fans, `recommended_order` map for key groups). *Web v1: `sortGroupsForStartupPick` uses `group_tiers.sort_key` when the JSON is present.* |
| 1e | **New game:** On group pick, set managed group + `letter_tier` from **1b** + opening cash per scenario number (already partially in web `financeSystem`). *Web: `createGameSaveFromLoadedScenario` prefers `group_tiers` for the chosen group’s letter tier.* |

**Removed from scope:** former step **1c** (runtime tier inference in browser) — **not planned**; tiers remain static files per scenario.

**Exit criteria (scenario 6):** Pick group from ranked list with correct static tier → save starts with matching finance/tier hooks.

---

## 2. Live schedule system

**Desktop:** `_live_schedules`, notifications, archive on advance.

**Web:** Autopilot live only; extend per prior plan **2a–2d** (schema, CRUD, `advanceOneDay` resolves player lives, schedule notifications).

**Exit criteria:** At least one player-scheduled live per week pattern; day advance resolves into `results`.

---

## 3. Full calendar (schedule UI)

Phased: read-only month grid → edit → conflict polish (`main_ui.py` helpers).

---

## 4. Scout system (Japan agencies + eligibility rules)

**Desktop:** `scout_system.py`, `docs/scout_system_design.md`.

**Eligibility (v1 — coded rules):**

1. **Current group:** Idol has **no** active `group_history` segment on `current_date` → *no group* (candidate for freelancer path).
2. **Retired (scout-excluded):** If they **had** a prior membership with a resolved `end_date`, compute `years_since_last_end` (fractional ok). If **`age_on_reference + years_since_last_end ≥ 30`**, treat as **retired** (do not recommend). Idols **never in any group** are **not** retired by this rule (they are freelancers). *(If you intended a different composition—e.g. only count tenure after last group—adjust once and update this line.)*
3. **Freelancer:** Not retired by (2) and no current group → freelancer pool.
4. **Solo list (later):** Curated list of UIDs (or tags) for **actively performing solo** idols **subset of freelancers**; load `public/data/scout_solo_list.json` when present and add a “Solo recommendations” mode.

**Port strategy:** 4a–4e unchanged from prior plan, but **4c** implements the **retired / freelancer** predicates first; **solo list** gates a second recommendation mode once data exists.

**Exit criteria:** Scout lists companies; candidates exclude retired; freelancers appear; solo-listed filter when file present.

---

## 5. Event system → inbox (full blocking)

**Desktop:** `future_events`, `apply_due_future_events`, inbox choices, block next day.

**Web port strategy:**

| Step | Work |
|------|------|
| 5a | Document + implement `future_events[]` shape compatible with desktop. |
| 5b | `applyDueFutureEventsWeb` on day advance. |
| 5c | Full **choice UI** (`choice_options`, `choice_kind`, `choice_status`) + persistence on save. |
| 5d | **Block NEXT DAY** while any notification matches desktop “blocking” rules (mirror `main_ui` gating); expose `save.inbox` flags or queue as needed. |

**Exit criteria:** Same gating feel as desktop for scripted scenario 6 events; choices persist.

---

## 6. Live performance + generated events

Parity audit vs `live_performance_system.py`; golden tests; post-live inbox + `future_events` per desktop.

---

## Suggested sequencing (milestones)

| Milestone | Bundle | Notes |
|-----------|--------|--------|
| **M0** | Schema + save version | |
| **M1** | **1a + 1b + 1d + 1e** (scenario **6** only) | Static tiers; manifest lists all scenarios for docs |
| **M2** | **2 + 6** (schedules + live results) | |
| **M3** | **5** (full events + blocking) | |
| **M4** | **3** (calendar UI) | |
| **M5** | **4** (scout v1 + retired/freelancer) | **M5b** solo list when `scout_solo_list.json` exists |
| **M6** | Parity polish | Calendar conflicts, live formula edge cases |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| “Months + age ≥ 30” ambiguity | Lock formula in TS + doc appendix; one golden row per edge case |
| Bundle size | Scenario 6 slice + lazy load later |
| Behavior drift | Golden tests from `simulate_gameplay.py` / frozen saves |

---

*Document version: 2026-05-10 (rev 3 — M1 partial implementation + implementation log).*
