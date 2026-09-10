# Current Idol Group Boundary & Scope Ledger — 2026-09 R3

Evaluation snapshots:
- **S6:** 2025-07-05 historical snapshot
- **Current:** 2026-09-09

This supplements the existing boundary/scope ledger. It formalizes a derived `s6_delta` / `s6_trend` convention and adds another regional / alternative candidate pass.

## Derived S6 trend convention

For groups that have both S6 and current ratings, store an explicit `s6_delta` measured on the ordered Overall scale and derive a baseline trend from it:

- `+2 steps or more` -> `↑↑`
- `+1 step` -> `↑`
- `0` -> `-`
- `-1 step` -> `↓`
- `-2 steps or more` -> `↓↓`

This is the default derivation. It may be overridden only when structural evidence clearly differs from the simple Overall delta (for example, a group remains in the same Overall band but its Live ceiling jumps dramatically, or a STOP event dominates the forward signal). Current trend remains separately forward-looking from 2026-09 toward H2-2026 / 2027.

## Pass-3 dual-snapshot results

| Group | S6 Overall | Current Overall | s6_delta | Derived S6 trend | Current trend | Scope / status | Key interpretation |
|---|:---:|:---:|:---:|:---:|:---:|---|---|
| AsIs | D | **C- provisional** | +2 | **↑↑** | **↑↑** | ranked_current / provisional | S6 was still early national-tour scale. By 2026-09 the group reached Zepp DiverCity tour final; S ticket ¥10k sold out before show. Final attendance still needed before fully freezing C-. |
| Palette Parade | D+ | **C- provisional** | +1 | **↑** | **↑** | ranked_current / provisional | 2026 completed O-EAST and 2026-09-08 LINE CUBE SHIBUYA 5th anniversary, but ordinary ticket around ¥2k and pre-show 500-person outreach indicate monetization may still be near the boundary. |
| SITUASION | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Strong scene/music reputation but low-price touring; 2025 Zepp Shinjuku and later multi-city tour used cheap tickets, so repeatable paid Live remains D+ scale. |
| ジエメイ | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Nagoya/regional scene strength and healthy festival position, but no clean normal-price C- own-live business was recovered. |
| Mirror,Mirror | D+ | **C-** | +1 | **↑** | **↑** | ranked_current | 2025 LIQUIDROOM anniversary followed by 2026 O-EAST own one-man; clear one-step growth into C-. |
| アンスリューム | C- | **C-** | 0 | **-** | **-** | ranked_current | O-EAST / Zepp DiverCity own-live ceiling exists, but heavy cheap-ticket expansion means no reason to promote above C-. |
| Quubi | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | 2026 Japan Tour spans 18 cities / 19 shows, but ordinary shows are ¥2.5k and final is SHIBUYA CLUB QUATTRO at ¥3.5k. Excellent breadth, still D+ commercial density. |
| KAMAITACI | D / D+ | **D+** | +1 / 0 | **↑** | **-** | ranked_current boundary | Debuted 2025-03-30. By S6 had a clubasia one-man; current own products remain O-Crest/O-nest/clubasia scale, so still D+ despite broader festival exposure. |
| キングサリ | D+ | **D+ / C- boundary** | 0 / +1 | **↑ provisional** | **↑** | ranked_current boundary | Growth signal remains stronger than final tier evidence. Keep outside main C- table until clean current own-live sell-through is recovered. |
| Axelight | D+ | **D+** | 0 | **-** | **-** | ranked_current boundary | Alternative/regional route remains club-scale; no completed normal-price C- product found in this pass. |

## Current implications

- `AsIs` is now the strongest unresolved promotion candidate in this set. If 2026-09-09 Zepp DiverCity turnout is strong, promote from `C- provisional` to locked `C-`.
- `Palette Parade` remains a true boundary case rather than an automatic C- despite LINE CUBE SHIBUYA, because ordinary ticket price and outreach strategy suggest venue scale may exceed paid-density scale.
- `Quubi` is a useful D+ anchor: very broad national touring does not by itself imply C- when venue size and ticket gross remain club-scale.
- `KAMAITACI` is not a C- candidate yet. Festival exposure is much stronger than independent paid draw.
- `SITUASION` and `ジエメイ` stay D+; both are examples where scene visibility is stronger than paid own-live business.

## Source notes added in this pass

- Quubi 2026 Japan Tour: 18 cities / 19 shows, ordinary ¥2,500, final SHIBUYA CLUB QUATTRO ¥3,500: https://quubi.fanpla.jp/news/detail/73827
- Quubi current ticket pages: https://quubi.fanpla.jp/live_information/detail/34367
- KAMAITACI official event archive: 2025-06-25 clubasia one-man; 2026 birthday / own events remain O-Crest / O-nest / clubasia scale: https://kamaitaci.jp/event/
- KAMAITACI group profile / debut 2025-03-30: https://kamaitaci.jp/
- Palette Parade 2026-09-08 LINE CUBE SHIBUYA official pre-show guidance: https://paletteparade-idol.com/news/121599/
- Palette Parade 500-person outreach challenge before the LINE CUBE show: https://paletteparade-idol.com/news/120288/
- AsIs 2026-09-09 Zepp DiverCity listing: https://www.zepp.co.jp/hall/divercity/

## Next pass

1. Recover post-show attendance / sell-through for AsIs 2026-09-09 Zepp DiverCity and Palette Parade 2026-09-08 LINE CUBE SHIBUYA.
2. Continue remaining regional / alternative / major-agency sweep.
3. Rebuild the master C- or above table once all newly promoted candidates are locked.
4. Preserve all D+ boundary rows and `scope_excluded_current_rank` rows in the unified research ledger even when they do not appear in the public ranking.