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

## Time-snapshot rule

Trend must be evaluated **from the selected historical/current snapshot**, not carried across dates.

Example: `=LOVE` is `↑↑` at **Scenario 6 opening (2025-07-05)** because the later 2026 stadium-scale expansion is a major structural jump from the 2025 baseline. At the **current 2026-09 snapshot**, `=LOVE` is only `↑`: it has already reached MUFG Stadium / National Stadium-scale live products in 2026, so the announced 2027 Tokyo Dome two-day run is continued top-tier expansion rather than another two-level jump.

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
| =LOVE | **↑** | At the current 2026-09 snapshot the group has already reached National Stadium / stadium-scale live products. The announced 2027-01 two-day Tokyo Dome run is still upward, but not a second two-level jump from the current baseline. Scenario 6 uses a separate historical trend and remains `↑↑`. |
| iLiFE! | **↑↑** | 2026-08 K-Arena Yokohama one-man completed after earlier hall/Zepp-scale products; the jump in own-live ceiling and monetization is very large. |
| のんふぃく！ | **↑** | 2026 Makuhari Messe Event Hall anniversary product plus Kanadevia Hall new-lineup own live materially exceed the group's prior regular own-live scale. |
| きゅるりんってしてみて | **↑↑** | 2026-05 Makuhari Event Hall 2DAYS was already a large paid product at ¥8,800 general, and the official site has announced a 2026-11 K-Arena Yokohama one-man explicitly as the group's largest-ever capacity. This is a clear structural step-up. |
| Jams Collection | **-** | The announced five-city Zepp tour broadens repeatability, but does not materially exceed the group's historical ceiling after its 2024 Nippon Budokan one-man. Current Zepp-scale normalization is healthy expansion, not a sufficient structural jump for `↑`. |
| 高嶺のなでしこ | **↓** | Current live ceiling and TIF placement have weakened relative to the prior peak period; treat as downward unless later 2026/27 routing reverses this. Do not lower current Overall solely from this trend flag. |
| わーすた | **STOP** | Officially announced that the group will end with its 2026 winter last live / last tour. |
| 超ときめき♡宣伝部 | **STOP** | Officially announced end of group activities around spring 2027. |

## Additional likely trend candidates to verify during canonical-table reconciliation

- fav me — likely `↑` if current Toyosu PIT / member-birthday Zepp products are followed by a larger own-live route rather than agency-event appearances only.
- 僕が見たかった青空 — likely `↑` or `-` depending whether late-2026/2027 routing clearly exceeds the 2026 spring tour / Kawaguchiko Stellar Theater scale.
- GANG PARADE / ExWHYZ — if their already-announced end-of-activities dates remain active at the evaluation snapshot, use `STOP` rather than a directional arrow.

## Source ledger for seed examples

- =LOVE 2027 Tokyo Dome two-day announcement: https://equal-love.jp/schedule/detail/11617 and https://equal-love.jp/schedule/detail/11618
- =LOVE 2026 stadium-scale live context: https://equal-love.jp/schedule/
- iLiFE! 2026 K-Arena Yokohama one-man: https://heroines.jp/news/public/_/2glt30y2t9f2aa94.html
- のんふぃく！ 2026 Makuhari Messe Event Hall anniversary: https://heroines.jp/news/public/_/atde4dubpjyubfee.html
- のんふぃく！ 2026 Kanadevia Hall new-lineup live: https://heroines.jp/news/public/_/zs6rvoevr5d51pde.html
- Jams Collection 2026 Zepp Nagoya tour pricing / five-city Zepp route context: https://jamscollection.jp/news/public/_/ge0h6lies7u4eto8.html
- きゅるりんってしてみて largest-ever K-Arena announcement: https://www.kyurushite.com/information/
- きゅるりんってしてみて 2026-05 Makuhari Event Hall 2DAYS pricing: https://www.kyurushite.com/event/704/
- わーすた end-of-activities announcement: https://wa-suta.world/ko/news/detail.php?id=1132467
- 超ときめき♡宣伝部 spring-2027 activity-end announcement: https://toki-sen.com/contents/1088152

## Implementation note

Add `trend` as a separate field alongside `Live / Music / Brand / Overall` in the future canonical current-market table. Trend should also be retained in machine-readable gameplay/research data where useful, but **must not be used as an arithmetic modifier to current Overall**.
