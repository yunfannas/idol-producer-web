# Idol Producer Web — game port plan

This document aligns the **Vite + TypeScript** web game (`idol-producer-web`) with the desktop **Python + Tkinter** game in `idol_producer/`. The owner maintains **content JSON**; this file tracks **feature phases**, **source-of-truth code paths** for ports, and **persistence**.

## North star

1. **Autopilot-first:** time progression, finance, automatically assigned training and lives so the group “runs” without deep player input.
2. **Progressive agency:** unlock player control in a fixed order (training customization → schedule lives → songs → contracts → scout/audition → disc publish → variety/fashion/TV, etc.).
3. **Hosting:** static deploy (e.g. GitHub Pages) now; **minimal API later** (cloud saves, manifests, optional leaderboards)—design persistence so swapping in an API is additive.

## Desktop references (local paths)

Selected modules are also mirrored under **`public/ref/`** for in-repo reading while porting; treat **`idol_producer/`** as canonical if the copies drift.

| Topic | Primary location (`idol_producer/`) | Mirror in repo (`public/ref/`) |
|--------|--------------------------------------|--------------------------------|
| Save schema, version | `game_save.py` | `game_save.py` |
| Idol attribute buckets (port of visible/hidden stats) | `idol_attributes.py` | `idol_attributes.py` |
| Scenario future events | `scenario_runtime.py` | `scenario_runtime.py` |
| Scout desk (save `scout` block) | `scout_system.py` | `scout_system.py` |
| Finance / daily close | `database/finance/finance_system.py` | `finance/finance_system.py` |
| Finance data | `database/finance/group_finance.json` (TS copy: `src/engine/data/group_finance.json`) | `finance/group_finance.json` |
| Live results | `live_performance_system.py` (`resolve_group_live_result`, `apply_live_result_to_group`) | `live_performance_system.py` |
| Training / status | `idol_status_system.py` | `idol_status_system.py` |
| UI (reference only — not portable) | `ui/main_ui.py` | `main_ui.py` |
| Web preview export | `scripts/export_web_preview_bundle.py` | `scripts/export_web_preview_bundle.py` |

## Phased delivery

### Phase 0 — Foundations (current direction)

- Engine layers: **data** (JSON + validation) → **rules** → **commands** → **state** → **HTML UI**.
- **Persistence:** multiple local save slots (**10**); each slot stores a **`GameSave`-shaped JSON (v11)** matching `idol_producer/game_save.py` (not the old thin web wrapper). Legacy v1 web saves are migrated on load. Uses `localStorage` (v2 key) with read fallback for v1 keys.
- **UI shell:** semantic HTML/CSS that mirrors desktop `setup_ui()` / palette (`main_ui.py` sidebar + top bar + darker content wells); placeholders for tabs not yet ported.
- **Porting strategy:** lift **equations and data** from Python; replace Tk with semantic HTML/CSS; validate loads with schemas (e.g. Zod) in a later pass.

### Phase 1 — Autopilot MVP (in progress)

**Goal:** One playable loop: **time passes**, **finance updates**, **autopilot assigns training + live**, visible **activity log / ledger**.

**Implemented / targeted ports:**

- `FinanceSystem.build_daily_breakdown` + `apply_daily_close` + `normalize_finances` → `src/engine/financeSystem.ts`
- Constants loaded from copied `group_finance.json` (same file as desktop).
- **Weekly tick:** run **7 daily closes** with autopilot rules (e.g. **one routine live per week** on a fixed weekday, small **venue fee** on live days)—expand to match desktop cadence later.
- Optional bundle fields later: `group_letter_tier` to avoid inferring tier from popularity/fans only.

**Explicitly after MVP**

- Full `live_performance_system` fidelity (member-level ratings, handshake tickets, fan gains) wired into the same calendar.
- `idol_status_system` training fatigue and weekly logs matching desktop.

### Phase 2 — Player agency (order of release)

1. Training customization (steer autopilot or per-member intensity).
2. Schedule lives (calendar, conflicts, stamina).
3. Make songs / setlist relevance to live results.
4. Contract negotiation.
5. Scout & audition (roster changes).
6. Disc publish / distribution.
7. Variety, fashion, TV (schedule + payouts + reputation).

Each phase should ship with **save compatibility** or a **migration bump** (`schemaVersion`).

### Phase 3 — Content pipeline

- You regenerate bundles from `idol_producer` (export scripts) or hand-edit JSON.
- Web validates **bundle version** and fails with a clear error if outdated.
- Optional later: API-served bundles (no redeploy).

### Phase 4 — Minimal API (later)

| Capability | Sketch |
|------------|--------|
| Cloud save | `GET/PUT` save blob by user/session |
| Remote content | `GET /manifest` + versioned bundle URLs |
| Leaderboards | `POST` score + server validation (if rules move server-side) |

Client remains **offline-first** until API exists.

## Testing strategy

- **Unit tests** (Vitest): finance breakdowns, deterministic tick, migrations—golden numbers cross-checked with Python or spreadsheet rows.
- **Manual:** save slots, full week cashflow, ledger cap (`LEDGER_LIMIT`-style behavior).

## Open decisions

- **Calendar:** align web `opening_date` with desktop scenario starts; handle month boundaries for payroll (already day-of-month in daily close).
- **Letter tier:** when missing from JSON, inference vs required field in export (recommended long-term: export **letter tier** from desktop DB).

---

*Last updated: generated with the first finance/tick port from `idol_producer`.*
