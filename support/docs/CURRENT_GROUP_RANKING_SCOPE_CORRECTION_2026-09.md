# Current Idol Ranking Scope Correction — 2026-09

Evaluation date: **2026-09-09**.

This note corrects the candidate-universe treatment in `CURRENT_GROUP_CANDIDATE_UNIVERSE_AUDIT_2026-09_R3.md`.

## Ranking scope vs game tier scope

The public/current-market idol-group ranking and the game's internal tier database use different inclusion scopes.

### Current-market ranking

Exclude voice-actor artist units and voice-actor idol units whose primary real-world identity belongs to the seiyuu-artist market rather than the conventional female-idol market, even when they operate under their own independent group identity.

Therefore the following are **not ranking participants**:

- `i☆Ris`
- `TrySail`
- `22/7`
- `DIALOGUE+` (same route; exclude from the canonical current idol ranking unless later explicitly reclassified)

They must not increase the count of C- or above groups in the canonical current-market ranking table.

### Game tier database

If a group exists in the game database / scenario universe, evaluate it with the **same normal tier system** (`Live / Music / Brand -> Overall`) so that gameplay values remain comparable across groups.

Thus the ratings researched in R3 remain usable as game-data working ratings even though the groups are excluded from the real-world current ranking:

| Group | Live | Music | Brand | Overall | Ranking participation |
|---|:---:|:---:|:---:|:---:|---|
| i☆Ris | B- / B | C+ | B | **B-** | Excluded |
| TrySail | B | C+ / B- | B | **B** | Excluded |
| DIALOGUE+ | C+ | C | C+ | **C+** | Excluded |
| 22/7 | C | C+ | C+ | **C+** | Excluded |

These ratings are not deleted; they are reclassified from ranking candidates to game-reference ratings.

## IP-project exclusion

Franchise-cast groups such as Love Live! school-idol units remain outside both the canonical current-idol ranking candidate audit and the ordinary real-group candidate universe unless the game explicitly models them for a special purpose. Their live activity is tied primarily to a fictional IP/cast project rather than a conventional real-world idol group career.

## Operational rule

When auditing future omissions, first classify the act into one of three buckets:

1. **Conventional real-world female idol group** -> eligible for current ranking and normal game tier evaluation.
2. **Independent seiyuu / voice-actor artist unit** -> exclude from current ranking, but retain/evaluate normally if represented in game data.
3. **Franchise/IP cast unit** -> exclude from current ranking; do not add to the ordinary real-group universe by default.

This correction supersedes the R3 statements that marked i☆Ris, TrySail, DIALOGUE+ and 22/7 as `ADD` entries for the canonical current-market ranking universe.
