# Group Tier Evaluation Standard

**Authoritative current standard.** This document supersedes earlier provisional Tier wording and earlier Sales thresholds in this repository or discussion notes.

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

Measures repeatable physical music-product sales power using a stable rolling-window anchor.

**Authoritative Sales rule:** use the **total comparable physical sales achieved during the 12 months immediately preceding the evaluation date**.

Prefer Billboard Japan / SoundScan when available; use Oricon when Billboard totals are unavailable. Use only sales already achieved by the evaluation date. Do not back-propagate future releases.

Benefit-event-driven sales, multiple versions, handshake/talk/signing events and similar idol sales mechanisms are legitimate commercial power and must not be arbitrarily discounted.

Sales may be `null` / `N/A` when there is no meaningful comparable physical-release business. `N/A` is not a penalty.

### Sales tier anchors

The previous low-volume Sales scale is obsolete. The current C-band anchor is intentionally much higher.

| Sales Tier | Rolling 12-month comparable physical sales | Working interpretation |
|---|---:|---|
| A+ | 1,000,000+ | top national idol sales system |
| A | 600,000–999,999 | very large national sales |
| A- | 400,000–599,999 | large-major sales |
| B+ | 300,000–399,999 | strong large-idol sales |
| B | 200,000–299,999 | established large-idol sales |
| B- | 120,000–199,999 | clearly above C-class commercial scale |
| **C+** | **80,000–119,999** | strong-major lower edge; 高嶺のなでしこ at roughly 80k+ is the lower anchor |
| **C** | **40,000–79,999** | stable major-class middle sales |
| **C-** | **20,000–39,999** | major-entry / strong live-idol physical sales |
| D+ | 10,000–19,999 | meaningful but sub-C physical sales |
| D | 4,000–9,999 | small stable physical-release business |
| D- | 1–3,999 | very small physical-release business |
| N/A | no meaningful comparable physical sales | do not penalize |

These thresholds are anchors, not a substitute for checking whether the underlying totals are comparable and actually fall inside the 12-month window.

Important examples:
- 高嶺のなでしこ: roughly 80k+ in the relevant rolling window -> **Sales C+ lower edge**
- Jams Collection: roughly 20k-class -> **Sales C-**
- 可憐なアイボリー: roughly 30k-class in the current comparable window -> **Sales C-**
- a group with 120k+ rolling annual physical sales enters **Sales B-** even if its Overall Tier remains C+ because Live or Brand is weaker

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

## 5. Structural meaning of C and B

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
- rolling annual physical sales, when meaningful, are often around 20k–40k
- may still lack one strong national dimension

### C: stable major-class middle tier

`C` should usually mean the group has become a stable major-class act, even if it is not literally signed to a traditional major label.

Typical traits:
- sustained national distribution or equivalent commercial reach
- repeated visible Oricon / Billboard performance when physical releases exist
- stable paid live drawing beyond ordinary live-idol scale
- at least two dimensions solidly around C, with no obvious D-level market weakness
- rolling annual physical sales, where applicable, often around 40k–80k

A group that merely booked one large venue is not C.

### C+: strong major / pre-large-idol tier

`C+` is intentionally rare.

Typical traits:
- strong and repeatable major-class commercial presence
- multiple dimensions around C+ or better
- clear national strength beyond the ordinary top-live-idol zone
- can repeatedly support large halls / major tours or equivalent market scale
- rolling annual physical sales, where applicable, often reach roughly 80k+; 高嶺のなでしこ is the practical lower Sales anchor, not a high-end C+ Sales example

### B-: entry to the large-idol market

`B-` is not merely a stronger C+; it marks entry into a genuinely larger market structure.

Expected profile:
- roughly 5000+ paid live scale becomes repeatable evidence or an equivalent large-market pattern
- national, not merely regional or Tokyo-only, drawing power
- strong durable Brand outside the narrow live-idol circle
- major-class Sales are routine, not occasional
- results are repeatable across a meaningful period, not one commemorative event

Useful hard heuristic:
- normally at least **two dimensions should be B- or better**, and the third should not be below C+
- `B / C / C+` should normally remain `C+`
- `B- / C / C+` should normally remain `C+`
- `B- / B- / C+` can support `B-`

### B and above

`B` and above are genuine large-idol market tiers.

They should not be assigned merely because a group is famous inside the idol scene, has one arena date, or has strong benefit-driven sales without comparable Brand/Live scale.

## 6. Confirmed / reviewed S6 anchors

These are the current anchors and replace earlier provisional classifications.

| Group | Brand | Live | Sales | Overall | Notes |
|---|---|---|---|---|---|
| 高嶺のなでしこ | B- | C | C+ | **C+** | Sales C+ is lower-edge C+ (~80k+), not unusually strong for the Overall tier; Live remains limiting |
| Jams Collection | C | C+ | C- | **C** | Strong Live-first profile; ~20k-class sales do not support C+ |
| Appare! | C | C+ | C | **C** | Budokan meaningful but not enough to make C+ without stronger repeatable cross-dimensional market scale |
| いぎなり東北産 | C+ | C | C-/N.A. | **C** | S6 opening is before 2025-07-09 Budokan and later major debut |
| NEO JAPONISM | C | C- | C- | **C-** | 2025 roster reboot; historical C-level footprint cannot be inherited fully by current Live |
| yosugala | C- | C | D+/N.A. | **C-** | Live-first; S6 Sales not yet major-class |
| タイトル未定 | C- | C- | C- | **C-** | Strong Hokkaido concentration; national scale lower than local strength |
| AVAM | C- | C- | N.A./D+ | **C-** | Lower C- anchor: paid Live trajectory + durable song/SNS recognition |
| 可憐なアイボリー | C- | C- | C- | **C-** | Current sales evidence is about 30k-class over a comparable annual window; resource support has not translated into C growth |
| 夜光性アミューズ | C- | C- | N.A. | **C-** | Strong top-live-idol boundary case |
| のんふぃく！ | C- | C- | N.A. | **C-** | Same C- boundary logic |
| MyDearDarlin' | D+ | D+ | N.A. | **D+** | Large projects alone do not prove C- |
| UtaGe! | D+ | D+ | N.A. | **D+** | S6 only; by 2026-08 later Live evidence supports C- |
| NANIMONO | D+ | D+ | N.A. | **D+** | Strong D+; discounted-ticket venue scale must not be overcounted |
| シンデレラ宣言！ | D+ | D+ | N.A. | **D+** | Strong D+ under tightened standard |
| Sweet Alley | D+ | D+ | N.A. | **D+** | TIF participation / anniversary one-man do not by themselves justify C- |
| アキシブproject | D / D+ Brand | D | N.A./weak | **D** | Standard D anchor for 2025-07-05 |

## 7. AKSB historical calibration

- 2016 H2: **D+** — `Summer☆Summer` sales plus tour activity established a stronger professional base
- 2018 late to 2019-08: **C-** — major debut period, stronger commercial visibility, TIF HOT STAGE-level position
- 2019 H2 to pre-pandemic: **D+** — second major single did not produce clear further sales growth; C- was not sustained
- post-pandemic restart in 2022 onward: **D** — large one-man scale could no longer be sustained
- 2025-07-05 S6: **D**

Historical peak does not preserve current Tier.

## 8. Reviewed B- and above anchors for the 2025-07-05 market

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

K-pop / K-pop-style audition acts such as NiziU are outside the intended normal Japanese-idol calibration and should not be used as anchors here.

## 9. Hello! Project calibration around the C/B boundary

Current S6-era anchors:
- モーニング娘。'25 — **B**
- アンジュルム — **C+**
- Juice=Juice — **C+**
- つばきファクトリー — **C**
- BEYOOOOONDS — **C**
- OCHA NORMA — **C**
- ロージークロニクル — **C-**

Long-term major status by itself does not imply B-. Stable major activity is normal in C/C+; B- requires a clearly larger and more repeatable market base.

## 10. 2026-08 cross-check anchors

This section is **not S6 data**. It exists only to test whether the same standard behaves sensibly at a later date.

- ≒JOY: **B-** by 2026-08; repeated large paid live evidence plus much stronger Sales moves it above the 2026 C+ field
- 高嶺のなでしこ: remains **C+**; `Brand B- / Live C / Sales C+` is still a coherent profile
- Jams Collection: remains **C** unless stronger Sales/Brand evidence emerges; strong Live alone does not force C+
- きゅるりんってしてみて: **C**; Brand and Live support C despite weak indie physical Sales
- UtaGe!: **C-** by 2026-08 after normal-price O-EAST-scale / TIF HOT-level evidence
- ドラマチックレコード: **C-** by 2026-08
- INUWASI: **C-** by 2026-08; major EP / Oricon plus strong paid live route make it a relatively solid C- case
- ZOCX: **C-** by 2026-08; Brand stronger than Sales, with normal-price Zepp-class tour evidence
- Task have Fun: **C-** by 2026-08; mature historical Brand/Sales with current lower-edge Live
- MyDearDarlin' and NANIMONO: remain **D+** pending stronger normal-price repeatable C- evidence

## 11. Agency resources are not Tier

Agency strength, booking access, launch budget, and ecosystem support are inputs, not market Tier.

Examples:
- a TP-backed group can receive Zepp / tour resources while still being D or D+
- a LIVE PLANET group can survive for years at D/E scale without growing into C
- free or subsidized O-EAST/Zepp projects do not automatically raise Live

Agency/network effects should be simulated separately from market outcome.

## 12. Special-case handling

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

## 13. What must NOT be separate Tier dimensions

Do not add these directly to Overall Tier:
- agency power
- member singing/dancing ability
- song quality
- choreography quality
- media exposure as a standalone score
- SNS followers as a standalone score

These are causes, inputs, or observations. Their market outcomes should eventually appear through Brand, Live, or Sales.

The existing fan-layer system remains separate. Tier is only a market-status summary.

## 14. Recommended data shape

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

## 15. Calibration workflow

When reviewing a scenario group:
1. lock the evaluation date
2. collect already-achieved Brand / paid-Live evidence
3. calculate comparable rolling 12-month physical Sales where available
4. discount one-off, free, subsidized, agency-packaged, or future Live events
5. assign the three hidden dimensions independently
6. determine Overall from the structural market boundary, not from arithmetic average
7. add a special note for roster reboot, regional concentration, overseas route, unusual ticketing, or missing Sales
8. expose only final Tier to the player

Any older provisional C/C+/B- judgments or older low-volume Sales thresholds that conflict with this document are obsolete and must be recalibrated before use.
