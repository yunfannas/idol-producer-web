# Group Tier Evaluation Standard

Reference implementation target: Scenario 6 (`opening_date = 2025-07-05`).

This document defines how idol-group market Tier should be evaluated in `idol-producer-web`.

## 1. Player-facing rule

Players should see only the final group Tier:

`S / S- / A+ / A / A- / B+ / B / B- / C+ / C / C- / D+ / D / D- / E+ / E / E-`

There is no F tier. `+` and `-` represent the upper and lower portions of the same main tier.

The underlying evaluation dimensions are hidden from the player. They exist to make Tier assignment and later simulation consistent.

## 2. Hidden market dimensions

Overall Tier is derived from three hidden market dimensions:

### Brand

Measures current group-level recognition and market position.

Includes, as evidence:
- general public / idol-fan recognition
- media and advertising presence
- festival billing and industry position
- SNS reach only insofar as it has become durable group recognition
- historical brand equity that still matters in the current market

Brand is not the same as current fan count. A legacy group can retain a stronger brand than its present live drawing power.

### Live

Measures repeatable live drawing power.

Use repeatable attendance as the main anchor, not the nominal capacity of the largest venue ever booked.

Evidence should prefer:
- normal one-man attendance
- repeatable maximum attendance
- tour scale
- ability to draw outside Tokyo / home region
- whether large venues are normal, repeatable, or one-off commemorative events

A single Budokan or arena attempt must not automatically promote a group to the corresponding tier if normal drawing power is much lower.

A useful current boundary is that stable TIF Main/HOT STAGE-level groups are approximately around `C-` or above. Strong professional live-idols below that level are generally `D+`.

### Sales

Measures music-product sales power when meaningful comparable sales exist.

Typical evidence:
- first-week physical sales
- cumulative physical sales
- release frequency
- strength and repeatability of the release/event sales cycle

Sales may be `null` / `N/A` for groups without meaningful disc sales data. Lack of a national physical-disc business must not lower a group's Tier by itself.

Do not interpret Sales as a pure measure of casual listening. Talk events, handshake-style benefits, sign events, and other benefit-driven systems are legitimate parts of idol commercial power.

## 3. Overall Tier is not a simple average

Do not calculate Overall as a fixed arithmetic average of Brand / Live / Sales.

Use Live as the most universal market anchor, then use Brand and Sales to confirm or moderately move the group within or across a boundary.

Principles:
- one unusually high dimension should not drag two much weaker dimensions upward without limit
- a group with `N/A` Sales can still reach any Tier if Brand and Live justify it
- strong legacy Brand does not automatically preserve a high Overall Tier when current Live has fallen substantially
- one-off venue bookings do not override repeatable Live evidence
- `+/-` should be used to represent boundary cases instead of forcing unnecessary full-letter jumps

## 4. Scenario time-lock rule

Scenario evaluations are historical snapshots.

For Scenario 6, only evidence available or already achieved by **2025-07-05** may be used.

Do not back-propagate later achievements into the opening snapshot.

Examples:
- iLiFE!'s later Budokan / K-Arena performance cannot be used to make the 2025-07-05 version `B+`
- later 2025 or 2026 growth by CUTIE STREET, 夜光性アミューズ, のんふぃく！, yosugala, etc. should not be treated as already achieved on the opening date
- announced future venues may be noted as trajectory evidence, but are weaker than completed attendance

## 5. Current anchor cases

These anchors were explicitly reviewed and should be used to keep nearby groups consistent.

| Group | Brand | Live | Sales | Overall | Notes |
|---|---|---|---|---|---|
| 高嶺のなでしこ | B- | C | C+ | C+ | Stronger brand/sales than live base; later Makuhari peak must not be back-propagated |
| iLiFE! | B | B | B- | B | Scenario-6 snapshot; 2026 version can be B+ |
| =LOVE | A | A | A | A | Balanced large-major benchmark |
| AKB48 | S- | A | A+ | A+ | Legacy/national brand stronger than current live; very strong sales system |
| アキシブproject | around D / D+ brand | D | N/A or weak | D | Useful standard-D anchor for 2025-07-05 |

## 6. Practical tier interpretation

These are qualitative anchors, not rigid venue-capacity formulas.

### S
National phenomenon / top mass-market idol brand.

### A
Large national major idol act with strong large-arena scale and broad commercial presence.

### B
Clearly above the normal Zepp/live-idol ceiling; large-hall/arena-level market position or equivalent major-system strength.

### C
Top live-idol / quasi-major / mid-major zone.

Useful internal interpretation:
- `C+`: upper C; strong Zepp / multi-city / large-hall position, close to B but not there yet
- `C`: stable strong group at major live-house / Zepp / PIT class
- `C-`: clear top-live-idol threshold; approximately TIF Main/HOT STAGE-level competitive position

### D
Professional live-idol zone.

Useful internal interpretation:
- `D+`: strong professional live-idol, clearly above ordinary D but not yet stable C-
- `D`: mature professional group with a stable core fanbase; 2025 AKSB is a useful anchor
- `D-`: small but established professional group, close to E+

### E
Small live-idol zone.

Useful internal interpretation:
- `E+`: strong small group with an established base and realistic path to D-
- `E`: standard small live-idol
- `E-`: new / extremely small / unstable-base group

## 7. Boundary examples reviewed for S6-era calibration

Current discussion standard:
- 夜光性アミューズ: `C-` only if supported by evidence available at the evaluated date; later 2025/2026 results strengthen this classification but must not be back-propagated
- のんふぃく！: same treatment as above
- MyDearDarlin': `D+` under the stricter S6 threshold unless opening-date evidence clearly supports C-
- UtaGe!: `D+` under the stricter S6 threshold
- NANIMONO: `D+` under the stricter S6 threshold
- シンデレラ宣言！: `D+`
- Appare!: evaluate above ordinary D based on already-achieved large one-man results; do not infer B from a one-off large venue
- TEAM SHACHI: approximately `C` for scale around S6, despite being excluded from playable groups due to announced ending

## 8. Special-case handling

Some acts are not directly comparable to standard Japanese female-idol market structure.

Examples can include:
- mixed-gender groups
- metal / overseas-heavy groups such as Broken By The Scream
- creator / YouTube-led groups
- groups whose headline venue is highly event-driven and not representative of normal attendance

For these groups:
- still provide Brand / Live / Sales where useful
- add a short internal note explaining why direct comparison is imperfect
- avoid inventing a higher Tier solely from an unusual single metric

Perfume / BABYMETAL-style acts may be excluded from this Tier system entirely when their business model is too far outside the intended idol-management simulation.

## 9. What should NOT be separate Tier dimensions

Do not add these directly to Overall Tier:
- agency power
- member singing/dancing ability
- song quality
- choreography quality
- media exposure as a standalone score
- SNS followers as a standalone score

These are causes, inputs, or observations that should influence the fan/market simulation. Their market outcomes should eventually appear through Brand, Live, or Sales.

The existing fan-layer system remains separate from Tier. Tier is a market-status summary, not a replacement for fan segmentation.

## 10. Recommended data shape

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

## 11. Future calibration

The three hidden dimensions should eventually be grounded in actual data where possible:
- Brand: durable recognition / media / search / festival-position proxies
- Live: historical attendance and tour drawing data
- Sales: Oricon/Billboard/release-event sales data

The goal is not to remove editorial judgment entirely. The goal is to make editorial judgment consistent, time-locked, explainable, and compatible with future simulation.
