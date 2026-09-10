# Current Idol Group Boundary & Scope Ledger — 2026-09 R4

Evaluation snapshots:
- **S6:** 2025-07-05 historical snapshot
- **Current:** 2026-09-09

This revision tightens the provisional C- gate for the current calibration pass. The purpose of this pass is relative calibration only; a later research phase will record each own live individually and recompute trailing-12-month ticket gross and attendance more precisely.

## Conservative C- gate for the provisional pass

For an ordinary Japanese live-idol route, current Overall C- should be granted conservatively.

A group may clear C- through either:

1. **TIF Main/HOT floor** — a regular independent current-period TIF Main/HOT appearance that qualifies under the existing floor rule; or
2. **Clearly stronger own-live business than NANIMONO** — trailing-12-month own-live ticket gross, total paid attendance, and representative/average attendance must together show a materially stronger business than the NANIMONO D+ anchor.

If neither condition is met, keep the group at **D+**, even if it has one O-EAST / Zepp / LINE CUBE peak.

Important interpretation:
- Venue name alone is insufficient.
- A sold-out but heavily discounted show is weaker evidence than the same attendance at normal pricing.
- Low-price attendance still matters because merchandise / benefit-event opportunity scales with actual attendance, but the primary Live calibration remains trailing-12-month attributable own-live ticket gross.
- Total attendance and average / representative attendance are secondary checks.
- Do not add an extra arbitrary low-price multiplier on top of gross; low prices are already reflected in ticket gross. Ticket mix remains context when exact gross is unavailable.

## Revised candidate decisions under the tighter gate

| Group | S6 Overall | Current Overall | s6_delta | Derived S6 trend | Current trend | Status | R4 decision |
|---|:---:|:---:|:---:|:---:|:---:|---|---|
| Mirror,Mirror | D+ | **D+** | 0 | **-** | **↑** | ranked_current boundary | Downgrade from provisional C-. 2026 O-EAST full-house evidence is meaningful, but one O-EAST peak does not yet establish trailing-12-month own-live business clearly above NANIMONO. Keep D+ until annual gross / repeatability is recovered. |
| Palette Parade | D+ | **D+** | 0 | **-** | **↑** | ranked_current boundary | Downgrade from provisional C-. O-EAST + LINE CUBE show rapid venue growth, but ordinary ticket prices are low and actual paid density / annual gross is unresolved. No automatic C- from venue ceiling. |
| AsIs | D | **D+** | +1 | **↑** | **↑↑** | ranked_current boundary | Downgrade from provisional C-. 2026-09 Zepp DiverCity is a strong growth signal, but without reliable turnout / gross it is not yet enough to prove a business clearly above NANIMONO. Keep D+ with strong upward trend. |
| SITUASION | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Unchanged. Low-price touring and club-scale commercial density remain D+. |
| ジエメイ | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Unchanged. Scene/regional visibility is stronger than verified own-live business. |
| Quubi | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Unchanged. Very broad touring, but ordinary pricing and club-scale venues keep annual commercial density around D+. |
| KAMAITACI | D / D+ | **D+** | +1 / 0 | **↑** | **-** | ranked_current boundary | Unchanged. Festival exposure exceeds independent paid draw. |
| キングサリ | D+ | **D+** | 0 | **-** | **↑** | ranked_current boundary | Resolve earlier D+/C- ambiguity conservatively to D+ until clean own-live business clearly exceeds NANIMONO. |
| Axelight | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Unchanged. |

## Re-audit implication for previously promoted C- candidates

The same gate must now be applied to every non-TIF-floor C- candidate found in R1-R3. In particular, do **not** automatically retain C- merely because a group has one of the following:

- O-EAST sold out;
- LIQUIDROOM / EX THEATER / Zepp one-man;
- a larger hall booked with substantial cheap / trial inventory;
- strong alternative-idol scene recognition.

For these routes, retain C- only when the available evidence already demonstrates own-live business materially stronger than NANIMONO, or when another accepted ecosystem-specific floor is explicitly justified.

Priority re-audit set:
- CYNHN
- THE ORCHESTRA TOKYO
- Ringwanderung
- 衛星とカラテア
- 手羽先センセーション
- fishbowl
- TENRIN
- iON!
- アンスリューム

Groups with a valid current TIF Main/HOT floor are unaffected by this specific tightening unless the TIF appearance itself was special/collaboration-only rather than a regular independent slot.

## Tier / trend separation

A group can remain D+ while having `↑` or `↑↑` trend. Trend expresses direction, not current achievement.

Examples after R4:
- AsIs: **D+ / ↑↑**
- Palette Parade: **D+ / ↑**
- Mirror,Mirror: **D+ / ↑**

This is intentional and avoids prematurely converting future growth into current tier.

## Next research protocol

For every remaining candidate, evaluate **S6 and 2026-09 together** and store:
- S6 Live / Music / Brand / Overall
- Current Live / Music / Brand / Overall
- `s6_delta`
- derived `s6_trend`
- current forward trend
- scope/status flags
- TIF Main/HOT qualification
- rough trailing-12-month own-live ticket gross
- rough total paid attendance
- representative / average attendance
- strongest repeatable paid-live evidence

In the later detailed pass, each individual own live will be recorded and the 12-month aggregates recomputed from event-level data.
