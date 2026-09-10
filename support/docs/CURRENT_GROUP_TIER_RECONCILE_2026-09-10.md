# Current Group Tier Reconcile — 2026-09-10

Canonical reconciliation overlay for the current Japanese female-idol market tier work. This document resolves conflicts among the old 50-group table, the 65-group C- master, automated D+–B- reruns, candidate-universe audits, and the final manual calibration decisions from 2026-09-09.

## Snapshot rule

- Current tier cutoff: **2026-08-31**.
- Trailing-52-week Live window: **2025-09-01 through 2026-08-31**.
- Events after 2026-08-31 may affect `current_trend`, but do not contribute current attendance/gross/tier.
- Manual final calibration decisions override intermediate automated rerun documents when they conflict.

## Reconciled current decisions

Use `CURRENT_GROUP_CMINUS_ABOVE_MASTER_2026-09.md` as the membership baseline, with the following corrections/locks:

| Group | Live | Music | Brand | Overall | Reconciled decision |
|---|:---:|:---:|:---:|:---:|---|
| 高嶺のなでしこ | C | C+ | C+ | **C+** | Keep final manual calibration; do not restore C+ Live from intermediate rerun. |
| Jams Collection | C | C- | C | **C** | **C-tier tail anchor.** Intermediate automated C- rerun is superseded. |
| yosugala | C | C- / C | C | **C** | Promote from C- using completed pre-cutoff 2026 EX THEATER -> QUATTRO/LIQUIDROOM -> NHK Hall live structure; place above Jams in C. |
| NGT48 | C | C+ | C | **C** | Keep. Physical sales do not imply higher Live, but current evidence does not justify a C- demotion. |
| のんふぃく！ | C- | C- | C- | **C-** | Keep. Current TIF/Main + HEROINES upper-route evidence holds the C- floor; post-cutoff tour is trend only. |
| Merry BAD TUNE. | C- | D+ | C- | **C-** | Music remains fixed at D+. |
| LinQ | C- | D+ | C | **C-** | Keep directly in the lower C- band on repeatable Kyushu own-live structure + regional Brand. |

After the yosugala correction, the 65-group master distribution becomes:

- C: **11**
- C-: **26**
- C- or above total: **65**

All other master rows remain unchanged unless a later explicit manual decision supersedes them.

## Current D+ boundary — existing researched anchors

The following remain direct D+ working anchors unless promoted by separate evidence:

| Group | Working Overall | Notes |
|---|:---:|---|
| ラフ×ラフ | **D+** | Strong peak/Brand, repeatable Live remains below C-. |
| 可憐なアイボリー | **D+** | Healthy normal pricing, current tour scale below C-. |
| GILTY×GILTY | **D+** | Large peak does not yet establish repeatable C- Live. |
| NANIMONO | **D+** | High frequency but D+-scale median show / low-price expansion. |
| MyDearDarlin' | **D+** | Current ordinary paid-live business remains below C-. |
| シンデレラ宣言！ | **D+** | No sufficient independent current Live evidence for C-. |

## IDORISE!! FESTIVAL 2026 — O-EAST-derived D+ candidate pool

Method: Spotify O-EAST is treated as the IDORISE main-stage placement signal. A **normal O-EAST slot is positive D+ evidence**, but Entry alone is not an automatic final Overall rating. Placement/treatment, own-live draw, Music and Brand still need reconciliation. Explicit newcomer-stage insertions are excluded.

Official 2026 timetable cross-check leaves the following active groups outside the current C- master after subtracting groups already rated C- or above:

| Group | O-EAST placement | Working use |
|---|---|---|
| Palette Parade | 3/7 10:00 | **D+ / C- boundary**; O-EAST supports D+ floor, own-live evidence decides promotion. |
| かすみ草とステラ | 3/7 10:30 | **D+**; repeated upper-festival/O-EAST evidence, current own-live monetization still below clean C-. |
| LumiUnion | 3/7 11:00 | **D+ candidate**; main-stage placement is sufficient for investigation, but special/major-route context requires separate Live check. |
| Sweet Alley | 3/7 13:10 | **D+**; already retained in the D+ promotion queue. |
| ハルニシオン | 3/7 17:10 | **D+ candidate**; relatively strong O-EAST placement, requires own-live confirmation. |
| MEGAFON | 3/8 10:00 | **D+ candidate**; opening O-EAST slot gives floor evidence, not C- proof. |
| カラフルスクリーム | 3/8 12:05 | **D+ candidate**; O-EAST placement supports upper-scene floor; regional own-live structure needs reconciliation. |
| なみだ色の消しごむ | 3/8 12:35 | **D+** | Promote from provisional D+ wording to a clean D+ working anchor on O-EAST main-stage placement plus existing upper-scene evidence; still not enough for C-. |
| Rain Tree | 3/8 13:25 | **D+ candidate**; major-route Music/Brand may alter Overall, so do not finalize from festival placement alone. |
| #ババババンビ | 3/8 18:45 | **D+ candidate / high-priority audit**; late O-EAST placement is a strong scene signal and deserves direct current own-live re-evaluation. |

### Explicit exclusions from the O-EAST D+ derivation

- **ukka** appeared on O-EAST on 3/7 but ended activities on 2026-05-24, so it is not part of the 2026-08-31 current ranking.
- **RE-GE** (3/7) and **フルコース** (3/8) were explicitly marked `ニューカマーステージ`; the placement mechanism is special and does not establish a D+ floor.
- Every other O-EAST act in the two-day timetable is already in the reconciled C- or above master and therefore is not part of the D+ candidate pool.

## D+ pool after reconciliation

Confirmed/working D+ anchors currently tracked: **7**

- ラフ×ラフ
- 可憐なアイボリー
- GILTY×GILTY
- NANIMONO
- MyDearDarlin'
- シンデレラ宣言！
- なみだ色の消しごむ

Additional O-EAST-derived D+ candidates requiring direct Live/Music/Brand audit: **7**

- Palette Parade
- かすみ草とステラ
- LumiUnion
- Sweet Alley
- ハルニシオン
- MEGAFON
- カラフルスクリーム
- Rain Tree
- #ババババンビ

Note: the heading count above is intentionally not used as a frozen total because candidate status is not equivalent to a final D+ Overall rating. The list is the audit pool; final D+ count should only be frozen after direct checks.

## Precedence

For current-market work, use this file together with `CURRENT_GROUP_CMINUS_ABOVE_MASTER_2026-09.md`. Where they conflict, this reconcile file wins. `CURRENT_GROUP_TIER_TABLE_2026-09.md` and `CURRENT_GROUP_TIER_RERUN_DPLUS_BMINUS_2026-09.md` are historical/intermediate layers and must not override these reconciled decisions.
