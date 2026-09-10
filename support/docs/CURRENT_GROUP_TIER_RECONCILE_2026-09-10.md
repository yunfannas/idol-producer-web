# Current Group Tier Reconcile — 2026-09-10

Canonical reconciliation overlay for the current Japanese female-idol market tier work. This document resolves conflicts among the old 50-group table, the 65-group C- master, automated reruns, candidate-universe audits, and the final manual calibration decisions from 2026-09-09/10.

## Snapshot rule

- Current tier cutoff: **2026-08-31**.
- Trailing-52-week Live window: **2025-09-01 through 2026-08-31**.
- Events after 2026-08-31 may affect `current_trend`, but do not contribute current attendance/gross/tier.
- Final manual calibration decisions override intermediate automated rerun/master documents when they conflict.

## Authoritative C / C- working boundary

### Overall C

1. fav me
2. 高嶺のなでしこ
3. RAIN TREE
4. AVAM
5. yosugala
6. GANG PARADE
7. のんふぃく！
8. つばきファクトリー
9. OCHA NORMA

### Overall C- — ordered working band

1. Jams Collection
2. 夜光性アミューズ
3. 虹のコンキスタドール
4. Merry BAD TUNE.
5. TENRIN
6. Appare!
7. ドラマチックレコード
8. iON!
9. NGT48
10. わーすた
11. ZOCX
12. INUWASI
13. Devil ANTHEM.
14. NEO JAPONISM
15. UtaGe!
16. MORE STAR

### Boundary anchors

- **Jams Collection = C- head**
- **MORE STAR = C- floor**, calibrated as `Live D+ / Music C / Brand C -> Overall C-`.

## Explicit supersessions of intermediate files

- 高嶺のなでしこ is **Live C / Music C+ / Brand C+ -> Overall C**, not C+.
- Jams Collection is **C-**, not C.
- のんふぃく！ is **C**, not C-.
- NGT48 is **C-**, not C.
- AVAM is **C**, not C-.
- RAIN TREE is **C**.
- yosugala is **C**.
- 虹のコンキスタドール is **C-**, not C.
- わーすた is **C-**, not C.
- INUWASI remains **C-**, below ZOCX in the current ordered band.
- Merry BAD TUNE. remains **C-** with **Music D+**.

The older `CURRENT_GROUP_CMINUS_ABOVE_MASTER_2026-09.md`, `CURRENT_GROUP_TIER_TABLE_2026-09.md`, and `CURRENT_GROUP_TIER_RERUN_DPLUS_BMINUS_2026-09.md` are not authoritative without this overlay.

## D / D+ calibration correction

The earlier statement that every normal IDORISE O-EAST appearance automatically forces **Overall D+** is superseded.

Current interpretation:

- **AKSB = typical D anchor**; D-scale own-live gross is roughly ¥5-10m/year order of magnitude.
- **MEGAFON = D / D+ boundary reference.** Its early O-EAST placement supports approximately **Brand D+**, but if Live and Music remain D, Overall may remain D.
- A normal IDORISE O-EAST booking is therefore a strong **Brand / scene-position D+ floor**, not by itself an Overall floor.
- Placement/treatment matters: early O-EAST is weaker evidence than middle/late O-EAST treatment.
- Explicit newcomer / special-mechanism stages remain excluded.
- In the 2026 O-EAST residual set, groups demonstrably stronger overall than MEGAFON are retained at **D+**; MEGAFON itself may remain **D**.

### O-EAST residuals retained D+

- Palette Parade
- かすみ草とステラ
- LumiUnion
- Sweet Alley
- ハルニシオン
- カラフルスクリーム
- なみだ色の消しごむ
- #ババババンビ

RAIN TREE is already **C**. ukka is inactive at cutoff. RE-GE / フルコース are explicit newcomer-stage exceptions.

## D+ structural anchors

- **NANIMONO = `Live C- / Music D+ / Brand D -> Overall D+`**. It is the Live-heavy D+ example and does not receive nonexistent O-EAST credit.
- **MORE STAR = `Live D+ / Music C / Brand C -> Overall C-`**. It is the lower C- structural anchor.
- Therefore Overall D+ is intentionally heterogeneous: Live can range from D to C- when Music/Brand structure compensates appropriately.

The rebuilt D+ universe and provisional three-axis scores are maintained in:

`support/docs/CURRENT_GROUP_DPLUS_REBUILD_2026-09-10.md`

That table begins with 51 evidence-backed / boundary rows and must be expanded from the full current group universe rather than capped to the old C- candidate pool.

## Precedence

For current-market C/C- boundary work and D/D+ interpretation, this file is authoritative. For D+ membership/scoring, use `CURRENT_GROUP_DPLUS_REBUILD_2026-09-10.md` together with later direct group-level evidence.
