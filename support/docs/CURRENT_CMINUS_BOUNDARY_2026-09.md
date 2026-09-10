# Current C- Boundary Calibration — 2026-09

Working current-market calibration only. Evaluation date: 2026-09-09. This is not Scenario 6 data.

## Hard scene rule

For ordinary Japanese live-idol routes, **a regular current-year TIF HOT/Main Stage slot guarantees at least Overall C- under otherwise comparable conditions**. This is a floor, not an automatic C. Scramble winner, special collaboration, finale-only or project-only appearances do not count as the same signal.

The rule is intentionally asymmetric:
- current-year regular HOT/Main => C- floor unless the group is an exceptional non-comparable case;
- no HOT/Main does not automatically mean D+, but the group must clear C- through paid own-live business, Music/Brand strength or a different ecosystem.

## Two internal lines

### 1. C- survival line

Below this line => D+.

Reference D+ head: **NANIMONO**.

A group should normally remain C- if it has at least one structural advantage over NANIMONO, such as:
- current-year regular TIF HOT/Main;
- materially stronger normal-price repeatable own-live demand;
- 52-week attributable ticket gross in clear C- range with non-D+ median shows;
- or a clear C-level Music/Brand dimension that compensates for borderline Live.

The current lower-bound anchors are intentionally route-specific:
- **Task have Fun** = standard live-idol / legacy-route C- tail;
- **ロージークロニクル** = HP/major-route C- tail;
- **UtaGe!** = current-scene-floor C- via 2026 regular HOT/Main;
- **ラフ×ラフ** and **NANIMONO** = D+ examples immediately below the line for different reasons.

### 2. C promotion line

Above this line => C candidate; crossing it with enough supporting evidence => Overall C.

Typical profile:
- 52-week attributable own-live gross around ¥80–100m+ without being mostly low-price small-show accumulation;
- and/or multiple C-class normal-price own shows;
- plus at least one of Music or Brand at C.

## Current placement

### Overall C — lower edge

- **Jams Collection** — treat as C tail. Annual own-live business including member birthday SPs likely around the C threshold; Brand C provides second-axis support even though Music remains C-.

### C candidates — above promotion observation line

- **タイトル未定** — 2026 first hall tour; Kanamoto Hall final used ¥8.8k / ¥6.6k / ¥4.4k classes with S and B sold out and final inventory nearly exhausted. Strong C-candidate profile despite losing its 2025 HOT slot in 2026.
- **yosugala** — 2026 regular HOT Stage plus strong own-live ceiling; current annual total is lower-frequency but scene status and large-show capability are clearly above ordinary C-.
- **ばってん少女隊** — 2026 Tachikawa Stage Garden anniversary SOLD OUT at high normal prices; 2025 regular HOT but not 2026. Anniversary discount keeps it candidate rather than automatic C.
- **INUWASI** — repeated paid tours and Tokyo C-level peaks; fixed as the upper-C- Live anchor rather than promoted to C.
- **AVAM** — 2026 first regular HOT Stage guarantees C- floor; Zepp-route pricing is healthy. Needs 52w gross closure to move to C.

### Core C-

- **ドラマチックレコード** — 2026 regular HOT; provisional 52w gross around ¥45–70m. Clean standard C- sample.
- **夜光性アミューズ** — 2026 regular HOT; multi-Zepp route, but own-live gross still incomplete.
- **のんふぃく！** — 2026 regular HOT; stable C- audience/core structure.
- **NEO JAPONISM** — 2026 regular HOT; broad national route with moderate ordinary pricing.
- **FES☆TIVE** — high activity and strong scene position; low ordinary prices suppress commercial strength.
- **Devil ANTHEM.** — large peak shows but wide low-price ticket ladders; sustainable business still C-.
- **Merry BAD TUNE.** — 2026 regular HOT and own Zepp DiverCity SOLD OUT; this automatically clears the survival line, but Music/annual gross need completion before C.

### Lower C- — survival-line anchors

- **Task have Fun** — standard live-idol / legacy-route C- tail. The 2026 9-city/16-show route at normal ~¥5k pricing demonstrates repeatable paid own-live business; Brand C supports but does not create the tier.
- **ロージークロニクル** — HP/major-route C- tail. Repeated paid small/medium hall and live-house touring plus Music C sustain Overall C- despite no 2026 regular HOT.
- **UtaGe!** — current-scene-floor C-. O-EAST 1k+ sold out but cheap general tickets make monetization borderline; the 2026 regular HOT/Main slot provides the explicit scene floor.

### D+ head / immediately below survival line

- **NANIMONO** — fixed top-D+ anchor. Very high frequency and respectable annual gross, but median shows remain D+ and cheap rear/general inventory is structurally important; no recent regular HOT.
- **ラフ×ラフ** — D+. KT Zepp anniversary is a strong high-price peak, but the repeatable route falls back to smaller live-house/free-live scale. Brand C does not substitute for sustainable C- Live.

### D+

- 可憐なアイボリー
- GILTY×GILTY
- MyDearDarlin'
- シンデレラ宣言！
- なみだ色の消しごむ (provisional)
- THE ORCHESTRA TOKYO (provisional)

## TIF notes checked in this pass

- 2026 regular HOT includes at least: ドラマチックレコード, AVAM, UtaGe!, のんふぃく！, 夜光性アミューズ, yosugala, Merry BAD TUNE. and NEO JAPONISM.
- 2025 HOT but 2026 TIF without regular HOT includes: Task have Fun, ばってん少女隊, タイトル未定, ロージークロニクル.
- Current-year HOT takes precedence as a scene-status floor; prior-year HOT is supporting but not binding.

## Practical use

Research tables may store:
- `c_minus_position = lower | core | candidate`
- `tif_main_current_year = true | false`
- `tif_main_prev_year = true | false`

These are calibration metadata only. Formal game tiers remain D+, C-, C, etc.
