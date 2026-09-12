# Current Group Tier Reconcile — 2026-09-10

Canonical reconciliation overlay for the current Japanese female-idol market tier work. This document resolves conflicts among the old fixed-size tables, automated reruns, candidate-universe audits, and the final manual calibration decisions from 2026-09-09/11.

## Canonical Current C- and above snapshot

For the finalized **2026-08-31 Current C- and above universe**, use:

`support/docs/CURRENT_GROUP_TIER_TOP50_2026-08-31.md`

The historical filename still says `TOP50`, but the canonical content is no longer capped at 50. It currently contains **51 groups** and is authoritative for the ordered list, `Overall`, `Trend`, `Live`, `Music`, and `Brand` values.

## Snapshot rule

- Current tier cutoff: **2026-08-31**.
- Trailing-52-week Live window: **2025-09-01 through 2026-08-31**.
- Events after 2026-08-31 may affect `current_trend`, but do not contribute current attendance/gross/tier.
- Final manual calibration decisions override intermediate automated rerun/master documents when they conflict.

## Current C / C- boundary

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
3. Merry BAD TUNE.
4. TENRIN
5. Appare!
6. タイトル未定
7. ドラマチックレコード
8. iON!
9. 虹のコンキスタドール
10. NGT48
11. わーすた
12. ZOCX
13. INUWASI
14. Devil ANTHEM.
15. NEO JAPONISM
16. UtaGe!
17. MORE STAR

### Boundary anchors

- **Jams Collection = C- head**.
- **MORE STAR = C- floor** in the current ordered C- universe.
- **タイトル未定 = Live C- / Music C- / Brand C -> Overall C-** and must not be excluded merely because its strongest market position is regional rather than Tokyo-centered.

## Brand calibration correction

For Current Brand, a normal current-year **TIF HOT/Main Stage** appearance is an immediate **Brand C floor**.

Historical HOT/Main does not by itself preserve Brand C if the group fails to make HOT/Main in the current year. Another current C-level Brand signal — sustained major activity, media/public reach, or equivalent industry position — is needed to hold C independently.

This is an annual certification rule for TIF stage placement, not a claim that all Brand evidence decays instantly.

## Explicit supersessions of intermediate files

The older `CURRENT_GROUP_CMINUS_ABOVE_MASTER_2026-09.md`, `CURRENT_GROUP_TIER_TABLE_2026-09.md`, and `CURRENT_GROUP_TIER_RERUN_DPLUS_BMINUS_2026-09.md` are not authoritative where they conflict with the canonical current snapshot.

Examples of superseded intermediate judgments include:

- 高嶺のなでしこ is **Overall C**, not C+.
- Jams Collection is **Overall C-**, not C.
- のんふぃく！ is **Overall C**, not C-.
- NGT48 is **Overall C-**, not C.
- AVAM is **Overall C**.
- RAIN TREE is **Overall C**.
- yosugala is **Overall C**.
- タイトル未定 is **Overall C-** and restored to the canonical current universe.
- 虹のコンキスタドール is **Overall C-**, Trend `-`.
- Merry BAD TUNE. is **Overall C-**, Trend `-`.
- ZOCX Brand is **C-**.
- CUTIE STREET Trend is `↑`.
- iLiFE! Trend is `↑`.

## D / D+ calibration correction

The earlier statement that every normal IDORISE O-EAST appearance automatically forces **Overall D+** is superseded.

Current interpretation:

- **AKSB = typical D anchor**; D-scale own-live gross is roughly ¥5-10m/year order of magnitude.
- **MEGAFON = D / D+ boundary reference.** Its early O-EAST placement supports approximately **Brand D+**, but if Live and Music remain D, Overall may remain D.
- A normal IDORISE O-EAST booking is therefore a strong **Brand / scene-position D+ floor**, not by itself an Overall floor.
- Placement/treatment matters: early O-EAST is weaker evidence than middle/late O-EAST treatment.
- Explicit newcomer / special-mechanism stages remain excluded.

## D+ structural anchors

Overall D+ remains intentionally heterogeneous. Live can range from D to C- when Music/Brand structure compensates appropriately.

The rebuilt D+ universe and provisional three-axis scores are maintained in:

`support/docs/CURRENT_GROUP_DPLUS_REBUILD_2026-09-10.md`

## Precedence

1. `CURRENT_GROUP_TIER_TOP50_2026-08-31.md` — authoritative ordered Current C- and above snapshot (currently 51 groups; filename retained for continuity).
2. This reconcile file — interpretation, supersessions, and boundary notes.
3. `CURRENT_GROUP_DPLUS_REBUILD_2026-09-10.md` — D+ membership/scoring below the C- boundary, subject to later direct group-level evidence.
