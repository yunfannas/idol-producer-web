# Group Tier Evaluation Standard

**Authoritative current standard.** This document supersedes earlier versions and earlier provisional C/C+/B- wording in this repository or discussion notes.

Reference implementation target: Scenario 6 (`opening_date = 2025-07-05`).

This document defines how idol-group market Tier should be evaluated in `idol-producer-web`.

## 1. Player-facing rule

Players should normally see only the final group Tier:

`S / S- / A+ / A / A- / B+ / B / B- / C+ / C / C- / D+ / D / D- / E+ / E / E-`

There is no F tier. `+` and `-` represent the upper and lower portions of the same main tier.

The three underlying market dimensions are hidden from the player. They exist to make Tier assignment and later simulation consistent.

## 2. Hidden market dimensions

Overall Tier is derived from three hidden market dimensions:

### Brand

Measures current group-level recognition and market position.

Evidence can include:
- general-public / idol-fan recognition
- durable media and advertising presence
- festival billing and industry position
- SNS reach only when it has become durable group recognition
- historical brand equity that still matters in the current market

Brand is not the same as fan count. Legacy groups can retain stronger Brand than current Live.

### Live

Measures repeatable **paid** live drawing power.

Prefer:
- normal-price one-man attendance
- repeatable attendance, not nominal venue capacity
- tour scale and repeatability
- ability to draw outside Tokyo / the home region
- whether large venues are normal, repeatable, or one-off commemorative projects

Do not equate venue capacity with actual market power.

Discounted/free tickets, agency package events, commemorative one-offs, and heavily subsidized large venues must be discounted when judging Live.

A useful lower boundary remains:
- `C-`: top live-idol / major-entry competitive zone; approximately TIF Main/HOT STAGE-level market strength when supported by other evidence
- `D+`: strong professional live-idol below that threshold

### Sales

Measures repeatable music-product sales power when comparable sales exist.

Evidence can include:
- first-week and cumulative physical sales
- release frequency
- Oricon / Billboard Japan chart performance
- repeatability of the release-event sales cycle

Sales may be `null` / `N/A` when a group has no meaningful comparable disc business.

Do not penalize a group simply for lacking national physical releases. Benefit-event-driven sales are legitimate idol commercial power and should be counted as such.

## 3. Overall is not an arithmetic average

Do not calculate Overall as a fixed arithmetic average of Brand / Live / Sales.

Use all three dimensions as a market profile and judge whether the group has actually crossed a structural boundary.

Principles:
- one unusually high dimension cannot drag two clearly weaker dimensions upward without limit
- `N/A` Sales does not impose an automatic ceiling if Brand and Live genuinely justify a higher Tier
- strong legacy Brand does not preserve a high Overall when current Live has fallen substantially
- one-off Budokan / arena / Zepp bookings do not override repeatable paid Live evidence
- major-label affiliation alone does not create a Tier
- `+/-` should absorb boundary cases rather than forcing unnecessary full-letter jumps

## 4. Scenario time-lock rule

Scenario evaluations are historical snapshots.

For Scenario 6, only evidence already achieved by **2025-07-05** may be used.

Do not back-propagate later achievements into the opening snapshot.

Future announced venues may be noted as trajectory evidence, but they are weaker than completed results and must not be counted as already achieved.

Examples:
- iLiFE!'s later Budokan / K-Arena results cannot make the 2025-07-05 version `B+`
- いぎなり東北産's 2025-07-09 Budokan is four days after the S6 opening date and cannot be counted as completed S6 evidence
- later 2025/2026 growth by CUTIE STREET, 夜光性アミューズ, のんふぃく！, yosugala, etc. must not be back-propagated

## 5. Revised structural meaning of C and B

The previous wording that treated C mainly as a "Zepp / strong live-idol" class was too loose and is superseded by this section.

### D: professional live-idol market

- `D-`: small but established professional group
- `D`: mature professional live-idol with a stable core fanbase
- `D+`: strong professional live-idol; can attempt meaningful one-man growth but has not yet proved stable C- market strength

2025 AKSB is the standard `D` anchor.

### C-: top live-idol / major-entry zone

`C-` is a hard and crowded boundary.

Typical traits:
- clearly above ordinary D+ paid drawing power
- competitive for top live-idol festival positions
- approaching or entering major-class distribution / promotion
- may still lack stable national Sales
- may be Live-first, Brand-first, or newly major

This is the lower edge where a group begins to compete as a major-class idol rather than merely a mature live-idol.

### C: stable major-class middle tier

`C` should usually mean the group has become a **stable major-class act**, even if it is not literally signed to a traditional major label.

Typical traits:
- sustained national distribution or equivalent commercial reach
- repeated visible Oricon / Billboard performance when physical releases exist
- stable paid live drawing beyond ordinary live-idol scale
- at least two dimensions solidly around C, with no obvious D-level market weakness

A group that merely booked one large venue is not C.

### C+: strong major / pre-large-idol tier

`C+` is intentionally rare.

Typical traits:
- strong and repeatable major-class commercial presence
- multiple dimensions around C+ or better
- clear national strength beyond the ordinary top-live-idol zone
- can repeatedly support large halls / major tours or equivalent market scale

Long-term major activity and visible chart performance are normal here, but legal major-label status is not mandatory if the actual market scale is equivalent.

### B-: entry to the large-idol market

`B-` is not merely "a stronger C+". It marks entry into a genuinely larger market structure.

Expected profile:
- roughly 5000+ paid live scale becomes repeatable evidence or an equivalent large-market pattern
- national, not merely regional or Tokyo-only, drawing power
- strong durable Brand outside the narrow live-idol circle
- major-class Sales are routine, not occasional
- results are repeatable across at least a meaningful period, not one commemorative event

Useful hard heuristic:
- normally at least **two dimensions should be B- or better**, and the third should not be below C+
- `B / C / C+` should normally remain `C+`
- `B- / C / C+` should normally remain `C+`
- `B- / B- / C+` can support `B-`

### B and above

`B` and above are genuine large-idol market tiers.

They should not be assigned merely because a group is famous inside the idol scene, has one arena date, or has strong benefit-driven sales without comparable Brand/Live scale.

## 6. Confirmed / reviewed anchors

These are the current anchors and replace earlier provisional classifications.

| Group | Brand | Live | Sales | Overall | Notes |
|---|---|---|---|---|---|
| 高嶺のなでしこ | B- | C | C+ | **C+** | Strong Brand/Sales, but Live remains the limiting dimension; later 2025 Makuhari result must not be back-propagated |
| Jams Collection | C | C+ | C-~C | **C** | Strong Live-first profile; S6 should not be C+ merely from Zepp-scale ambition; ~20k-class sales do not support C+ |
| Appare! | C | C+ | C | **C** | Budokan is meaningful but not enough to make C+ without stronger repeatable cross-dimensional market scale |
| いぎなり東北産 | C+ | C | C-/N.A. | **C** | S6 opening is before 2025-07-09 Budokan and later major debut; do not back-propagate |
| NEO JAPONISM | C | C- | C- | **C-** | 2025 roster reboot; historical C-level footprint cannot be inherited fully by current Live |
| yosugala | C- | C | D+/N.A. | **C-** | Live-first; S6 Sales not yet major-class |
| タイトル未定 | C- | C- | C- | **C-** | Strong Hokkaido concentration; national scale lower than local strength |
| AVAM | C- | C- | N.A./D+ | **C-** | Lower C- anchor: paid Live trajectory + durable song/SNS recognition |
| 可憐なアイボリー | C- | C- | C-~C | **C-** | Long-running TP/HoneyWorks resource support but limited market growth |
| 夜光性アミューズ | C- | C- | N.A. | **C-** | Strong top-live-idol boundary case; use only opening-date evidence for S6 |
| のんふぃく！ | C- | C- | N.A. | **C-** | Same C- boundary logic as above |
| MyDearDarlin' | D+ | D+ | N.A. | **D+** | Large projects alone do not prove C- |
| UtaGe! | D+ | D+ | N.A. | **D+** | Strong D+ under tightened standard |
| NANIMONO | D+ | D+ | N.A. | **D+** | Strong D+ under tightened standard |
| シンデレラ宣言！ | D+ | D+ | N.A. | **D+** | Strong D+ under tightened standard |
| Sweet Alley | D+ | D+ | N.A. | **D+** | TIF participation / anniversary one-man do not by themselves justify C- |
| アキシブproject | D / D+ Brand | D | N.A./weak | **D** | Standard D anchor for 2025-07-05 |

## 7. AKSB historical calibration

AKSB is useful for understanding D+ / C- transitions and decline.

- 2016 H2: **D+** — `Summer☆Summer` sales plus tour activity established a stronger professional base
- 2018 late to 2019-08: **C-** — major debut period, stronger commercial visibility, TIF HOT STAGE-level position
- 2019 H2 to pre-pandemic: **D+** — second major single did not produce clear further sales growth; C- was not sustained
- post-pandemic restart in 2022 onward: **D** — large one-man scale could no longer be sustained
- 2025-07-05 S6: **D**

Historical peak does not preserve current Tier.

## 8. Reviewed B- and above anchors for the 2025-07-05 market

This list is for calibration of the upper market and should replace earlier provisional B-level lists.

### S
- 乃木坂46 — **S**

### S-
- 櫻坂46 — **S-**
- 日向坂46 — **S-**

### A+
- ももいろクローバーZ — **A+**
- AKB48 — **A+** (`Brand S- / Live A / Sales A+`)

### A
- =LOVE — **A** (`A / A / A`)
- FRUITS ZIPPER — **A**

### B+
- 超ときめき♡宣伝部 — **B+**

### B
- iLiFE! — **B** (`B / B / B-`; 2025-07-05 snapshot, not 2026 B+)
- CUTIE STREET — **B**
- CANDY TUNE — **B**
- ≠ME — **B**
- 私立恵比寿中学 — **B**
- モーニング娘。'25 — **B**
- SKE48 — **B**
- NMB48 — **B**

### B-
- HKT48 — **B-**

K-pop / K-pop-style audition acts such as NiziU are outside the intended normal Japanese-idol calibration and should not be used as anchors here. Other cross-market acts should be explicitly marked as special rather than silently mixed into the baseline.

## 9. Hello! Project calibration around the C/B boundary

The current working anchors are:

- モーニング娘。'25 — **B**
- アンジュルム — **C+**
- Juice=Juice — **C+**
- つばきファクトリー — **C**
- BEYOOOOONDS — **C**
- OCHA NORMA — **C**
- ロージークロニクル — **C-**

This is useful because Hello! Project demonstrates that **long-term major status by itself does not imply B-**. Stable major activity is normal in C/C+, while B- requires a clearly larger and more repeatable market base.

## 10. Agency resources are not Tier

Agency strength, booking access, launch budget, and ecosystem support are inputs, not market Tier.

Examples:
- a TP-backed group can receive Zepp / tour resources while still being D or D+
- a LIVE PLANET group can survive for years at D/E scale without growing into C
- free or subsidized O-EAST/Zepp projects do not automatically raise Live

Agency/network effects should be simulated separately from market outcome.

## 11. Special-case handling

Some acts are not directly comparable to standard Japanese female-idol market structure.

Examples:
- mixed-gender groups
- metal / overseas-heavy groups such as Broken By The Scream
- creator / YouTube-led groups
- K-pop / K-pop-style groups
- groups whose headline venue is highly event-driven and not representative of normal attendance

For these groups:
- still provide Brand / Live / Sales where useful
- add a short internal note explaining why direct comparison is imperfect
- do not use an unusual overseas crowd, festival audience, or event capacity as domestic paid drawing power

Perfume / BABYMETAL-style acts may be excluded from this Tier system entirely when their business model is too far outside the intended idol-management simulation.

## 12. What must NOT be separate Tier dimensions

Do not add these directly to Overall Tier:
- agency power
- member singing/dancing ability
- song quality
- choreography quality
- media exposure as a standalone score
- SNS followers as a standalone score

These are causes, inputs, or observations. Their market outcomes should eventually appear through Brand, Live, or Sales.

The existing fan-layer system remains separate. Tier is only a market-status summary.

## 13. Recommended data shape

Internal group data can use fields conceptually equivalent to:

```json
{
  "market_tier": "C+",
  "market_brand": "B-",
  "market_live": "C",
  "market_sales": "C+",
  "market_tier_note": "Optional internal note for unusual evidence or special cases."
}
```

`market_sales` may be `null` when no meaningful comparable sales evidence exists.

Only `market_tier` should normally be exposed to the player UI.

## 14. Calibration workflow

When reviewing a scenario group:
1. lock the evaluation date
2. collect already-achieved Brand / paid-Live / Sales evidence
3. discount one-off, free, subsidized, agency-packaged, or future events
4. assign the three hidden dimensions independently
5. determine Overall from the structural market boundary, not from arithmetic average
6. add a special note for roster reboot, regional concentration, overseas route, unusual ticketing, or missing Sales
7. expose only final Tier to the player

Any older provisional C/C+/B- judgments that conflict with this document should be treated as obsolete and recalibrated before use.
