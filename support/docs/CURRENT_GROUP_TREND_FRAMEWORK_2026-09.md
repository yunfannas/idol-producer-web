# Current Group Trend Framework — 2026-09

Evaluation date: **2026-09-09**. This document defines a forward-looking `trend` field for the current-market idol-group table.

`trend` is **not** part of the current Overall tier calculation. It records directional evidence for the next ~6–18 months relative to roughly one year earlier.

## Allowed values

- `↑↑` — strong upward trajectory
- `↑` — upward trajectory
- `-` — broadly stable / no sufficiently strong directional evidence
- `↓` — downward trajectory
- `↓↓` — strong downward trajectory
- `STOP` — announced group termination / disbandment / end of activities. In UI render this **red**. `STOP` overrides directional arrows.

## Upward evidence

Use `↑` or `↑↑` when there is clear forward evidence such as:

- announced or recently completed H2-2026 / 2027 own-live venue(s) materially larger than the comparable product about one year earlier;
- a move from ordinary live-house/hall routing into repeat Zepp / PIT / arena / stadium scale;
- major debut or clear major-label upgrade imminent, where this is structurally meaningful for Music/Brand;
- repeated sell-outs at higher normal ticket prices that establish a new paid-demand ceiling;
- clear upward TIF / festival placement when consistent with broader market evidence.

`↑↑` requires a large structural jump rather than ordinary healthy growth.

## Downward evidence

Use `↓` or `↓↓` when there is clear evidence such as:

- current peak own-live venue / paid-demand ceiling is materially below the comparable peak one year earlier;
- loss of TIF Main/HOT or comparable upper booking treatment, when this reflects a broader position decline rather than scheduling noise;
- shrinking tour routing, repeated downgrade in venue scale, or obvious weakening in normal-price sell-through;
- loss of major-release continuity / external exposure together with weaker live demand.

Do not mark downward from a single weak event if the broader 12-month business is stable.

## STOP rule

Groups that have officially announced an end of group activities receive `STOP` regardless of whether the final tour is commercially strong. They remain rated at the current historical snapshot if still active on 2026-09-09, but their forward trend is not `↑`/`↓`.

Examples: わーすた and 超ときめき♡宣伝部.

## Seed labels confirmed in this calibration pass

| Group | Trend | Rationale |
|---|:---:|---|
| =LOVE | **↑↑** | 2026 Yokohama Stadium / stadium-scale growth followed by official 2027-01 two-day Tokyo Dome announcement. This is a structural venue-scale jump, not merely incremental growth. |
| iLiFE! | **↑↑** | 2026-08 K-Arena Yokohama one-man completed after earlier hall/Zepp-scale products; the jump in own-live ceiling and monetization is very large. |
| のんふぃく！ | **↑** | 2026 Makuhari Messe Event Hall anniversary product plus Kanadevia Hall new-lineup own live materially exceed the group's prior regular own-live scale. |
| 高嶺のなでしこ | **↓** | Current live ceiling and TIF placement have weakened relative to the prior peak period; treat as downward unless later 2026/27 routing reverses this. Do not lower current Overall solely from this trend flag. |
| わーすた | **STOP** | Officially announced that the group will end with its 2026 winter last live / last tour. |
| 超ときめき♡宣伝部 | **STOP** | Officially announced end of group activities around spring 2027. |

## Additional likely trend candidates to verify during canonical-table reconciliation

- Jams Collection — likely `↑` if the announced five-city Zepp tour materially exceeds its comparable 2025 own-live route and sell-through supports the step-up.
- きゅるりんってしてみて — likely `↑↑` candidate because an official K-Arena Yokohama one-man has been announced as its largest-ever capacity; verify timing and comparable prior-year peak before freezing.
- fav me — likely `↑` if current Toyosu PIT / member-birthday Zepp products are followed by a larger own-live route rather than agency-event appearances only.
- 僕が見たかった青空 — likely `↑` or `-` depending whether late-2026/2027 routing clearly exceeds the 2026 spring tour / Kawaguchiko Stellar Theater scale.

## Source ledger for seed examples

- =LOVE 2027 Tokyo Dome two-day announcement: https://equal-love.jp/schedule/detail/11617 and https://equal-love.jp/schedule/detail/11618
- =LOVE 2026 Yokohama Stadium tour final: https://equal-love.jp/schedule/detail/10932
- iLiFE! 2026 K-Arena Yokohama one-man: https://heroines.jp/news/public/_/2glt30y2t9f2aa94.html
- のんふぃく！ 2026 Makuhari Messe Event Hall anniversary: https://heroines.jp/news/public/_/atde4dubpjyubfee.html
- のんふぃく！ 2026 Kanadevia Hall new-lineup live: https://heroines.jp/news/public/_/zs6rvoevr5d51pde.html
- わーすた end-of-activities announcement: https://wa-suta.world/ko/news/detail.php?id=1132467
- 超ときめき♡宣伝部 spring-2027 activity-end announcement: https://toki-sen.com/contents/1088152
- きゅるりんってしてみて K-Arena announcement (candidate, not yet frozen): https://www.kyurushite.com/information/

## Implementation note

Add `trend` as a separate field alongside `Live / Music / Brand / Overall` in the future canonical current-market table. Trend should also be retained in machine-readable gameplay/research data where useful, but **must not be used as an arithmetic modifier to current Overall**.
