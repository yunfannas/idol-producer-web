# Group Tier Evaluation Standard

**Authoritative current standard.** This document supersedes earlier provisional Tier wording, the old standalone `Sales` dimension, and earlier low-volume sales thresholds.

Reference implementation target: historical scenarios such as Scenario 6 (`opening_date = 2025-07-05`) plus later current-market calibration snapshots.

## 1. Player-facing rule

Players normally see only final group Tier:

`S / S- / A+ / A / A- / B+ / B / B- / C+ / C / C- / D+ / D / D- / E+ / E / E-`

There is no F tier. The three hidden market dimensions are:

`Brand / Live / Music`

Overall is a structural market judgment, not an arithmetic average.

## 2. Brand

Brand measures current **group-level market position and recognition**.

Primary evidence:
- industry position and promoter treatment
- major festival placement / repeated high-level bookings
- television, advertising, magazines, fashion, acting and other external work
- durable general-public recognition outside the group's core fanbase
- current historical brand equity when it still affects treatment and recognition

### Brand exclusions

Streaming statistics are **not** a Brand input in this model. Spotify monthly listeners, song streams and viral-song counts belong to Music. They must not be used to mechanically raise Brand.

SNS follower counts are also not a standalone Brand score. They may provide context, but the question is whether recognition has translated into durable public/industry position.

Agency resources are not Brand by themselves. A strong agency can create opportunities without the group having already converted those opportunities into market position.

## 3. Live

Live measures repeatable **paid** drawing power.

Prefer:
- normal-price one-man attendance
- repeatable attendance rather than nominal venue capacity
- tour scale and ability to reproduce draw outside Tokyo/home region
- completed results rather than announced future venues

Discount:
- free / very cheap tickets
- heavily subsidized seats
- agency package events
- commemorative one-offs
- venue bookings unsupported by attendance evidence

Useful lower boundary:
- `C-`: top live-idol / major-entry competitive zone
- `D+`: strong professional live-idol below that boundary

`B-` normally requires repeatable large-market paid draw, roughly 5,000+ scale or a clearly equivalent national pattern, not one isolated arena/Budokan attempt.

## 4. Music

Music replaces the former standalone Sales dimension.

Music measures **repeatable market consumption of the group's recorded music**, regardless of whether that consumption is primarily physical or streaming.

Internal subcomponents:
- `Physical`: rolling 52-week comparable physical CD/album sales
- `Streaming`: rolling 52-week streaming consumption, or the best stable proxy available

The player does not need to see these subcomponents.

### 4.1 Physical

Use total comparable physical sales achieved during the 52 weeks immediately preceding the evaluation date.

Prefer Billboard Japan / SoundScan when available; use Oricon when necessary. Count benefit-event, multi-version, talk/signing/handshake-driven sales normally: they are legitimate idol commercial power and are not arbitrarily discounted.

Working physical anchors:

| Physical Tier | Rolling 52-week comparable physical sales |
|---|---:|
| A+ | 1,000,000+ |
| A | 600,000–999,999 |
| A- | 400,000–599,999 |
| B+ | 300,000–399,999 |
| B | 200,000–299,999 |
| B- | 120,000–199,999 |
| **C+** | **80,000–119,999** |
| **C** | **40,000–79,999** |
| **C-** | **20,000–39,999** |
| D+ | 10,000–19,999 |
| D | 4,000–9,999 |
| D- | 1–3,999 |
| N/A | no meaningful comparable physical business |

Calibration anchors:
- 高嶺のなでしこ: roughly 80k+ -> Physical C+ lower edge
- 可憐なアイボリー: roughly 30k-class -> Physical C-
- Jams Collection: roughly 20k-class -> Physical C-

### 4.2 Streaming

Preferred evidence, in order:
1. rolling 52-week all-platform on-demand streaming totals from Oricon/Billboard or equivalent audited sources
2. repeated Oricon/Billboard streaming-chart results plus documented song-level totals
3. Spotify/current-platform artist and track data as a proxy when cross-platform totals are unavailable

Do not use Oricon's combined-chart `300 streams = 1 single point` as a direct game-market equivalence. That formula is designed for chart aggregation, not for measuring idol-market commercial structure.

Spotify monthly listeners are a **fallback reach proxy only**, not literal annual streams. Artist-ID splits/renames must be checked before use; duplicate artist pages must not be naively summed.

When hard 52-week streaming totals are unavailable, use this empirical monthly-listener proxy scale for current Japanese female-idol calibration:

| Streaming Tier proxy | Spotify monthly listeners |
|---|---:|
| A+ | 1.2m+ |
| A | 0.8m–1.2m |
| A- | 0.6m–0.8m |
| B+ | 0.4m–0.6m |
| B | 0.25m–0.4m |
| B- | 0.15m–0.25m |
| C+ | 0.10m–0.15m |
| C | 0.05m–0.10m |
| C- | 0.02m–0.05m |
| D+ | 0.007m–0.02m |
| D | 0.002m–0.007m |
| D- | <0.002m |

These are fallback calibration bands, not claims that listeners and streams are equivalent. Hard cross-platform consumption evidence overrides the proxy.

Current calibration examples around 2026-09 include approximately: きゅるりんってしてみて 212k monthly listeners (B- proxy), AVAM 84k (C proxy), and 高嶺のなでしこ 74k (C proxy). This illustrates why streaming must be separated from Brand and why groups with similar Overall can have different Music routes.

### 4.3 Combining Physical and Streaming into Music

Do **not** simply add CD units to streams and do not take an arithmetic mean of tier labels.

Use a dominant-channel rule with cross-channel confirmation:

- same tier or 1 step apart -> Music = stronger channel
- 2–3 tier steps apart -> Music = one step below the stronger channel
- 4+ tier steps apart -> Music = two steps below the stronger channel
- if one channel is N/A and the other has hard, sustained consumption evidence -> Music may equal the available channel
- if the only available evidence is a weak proxy (for example monthly listeners without corroborating track/chart evidence), apply a one-step confidence haircut when necessary

A sufficiently strong physical-only or streaming-only act can therefore achieve a high Music tier. The system does **not** require every group to succeed in both channels.

Examples:
- 高嶺のなでしこ: Physical C+ + Streaming C -> **Music C+**
- きゅるりんってしてみて: Physical D+/C- + Streaming B- proxy -> **Music C**
- AVAM: weak/N.A. Physical + Streaming C proxy -> roughly **Music C-** unless stronger hard stream totals justify C
- Jams Collection: Physical C- + weak streaming -> **Music C-**

## 5. Overall Tier is structural, not arithmetic

Use Brand / Live / Music as a market profile.

Principles:
- one unusually high dimension cannot drag two clearly weaker dimensions upward without limit
- one weak Music channel does not matter if the combined Music result is supported through the other channel
- `N/A` physical sales are not an automatic penalty
- strong legacy Brand does not preserve a high Overall after current Live collapses
- one-off large venues do not override repeatable Live evidence
- major-label affiliation alone does not create Tier
- +/- absorbs boundary cases

For `B-`, a useful hard heuristic remains: normally at least two dimensions should be B- or better, and the third should not be below C+. `B- / C / C+` normally remains C+; `B- / B- / C+` can support B-.

## 6. Scenario time lock

Historical scenario ratings use only evidence achieved by the opening date.

For Scenario 6, the cutoff is **2025-07-05**. Later achievements may be noted as trajectory but must not be back-propagated.

Examples:
- later iLiFE! Budokan/K-Arena results cannot inflate its S6 rating
- いぎなり東北産's 2025-07-09 Budokan is after the S6 cutoff
- later growth by CUTIE STREET, 夜光性アミューズ, のんふぃく！, yosugala etc. cannot be back-propagated

## 7. Structural meaning of C and B

### D
Professional live-idol market. `D` is a mature professional group; `D+` is strong but below the C- structural boundary. 2025 AKSB is the standard D anchor.

### C-
Top live-idol / major-entry zone. Clearly above ordinary D+ market strength; may be Live-first, Music-first, or newly major.

### C
Stable major-class middle tier. Usually at least two dimensions are solidly around C with no obvious D-level structural weakness.

### C+
Strong major / pre-large-idol tier. Nationally visible and repeatable; typically multiple dimensions around C+ or a clearly compensating profile. This tier is intentionally selective.

### B-
Entry to the genuinely large-idol market. Requires repeatable large paid live scale or equivalent national strength, durable Brand, and major-class Music. It is a structural jump, not merely 'high C+'.

### B and above
Genuine large-idol market tiers. One arena booking, one viral song, or one high-benefit CD cycle is insufficient by itself.

## 8. Key calibration anchors

### S6 / 2025-07-05
- 乃木坂46 S
- 櫻坂46 S-
- 日向坂46 S-
- ももいろクローバーZ A+
- AKB48 A+
- =LOVE A
- FRUITS ZIPPER A
- 超ときめき♡宣伝部 B+
- iLiFE! B
- CUTIE STREET B
- CANDY TUNE B
- ≠ME B
- 私立恵比寿中学 B
- モーニング娘。'25 B
- SKE48 B
- NMB48 B
- HKT48 B-

Selected lower anchors:
- 高嶺のなでしこ: Overall C+; current Brand calibration should not exceed C+ merely because of TP/HoneyWorks resources
- Jams Collection: Overall C; Live-first
- Appare!: Overall C
- NEO JAPONISM: Overall C-
- 可憐なアイボリー: Overall C-
- アキシブproject: Overall D

### Current-market cross-check, 2026-09
- 高嶺のなでしこ: **Brand C+ / Live C / Music C+ -> Overall C+**
- きゅるりんってしてみて: **Brand C+ / Live C+ / Music C -> Overall C+**
- ≒JOY: **Overall B-**; repeated large paid live plus very strong 2026 physical sales crosses the B- boundary
- Jams Collection: **Overall C**; strong Live does not by itself force C+
- UtaGe!: **Overall C-** by 2026 after later paid-Live evidence
- INUWASI / ドラマチックレコード / ZOCX / Task have Fun: current C- calibration cases
- MyDearDarlin' / NANIMONO: remain D+ pending stronger repeatable normal-price C- evidence

## 9. Agency, performance and other inputs are not Tier dimensions

Do not add these as separate Overall dimensions:
- agency power
- member singing/dancing ability
- song/choreography quality
- media exposure as a separate numeric dimension
- SNS followers

They are causes, inputs or evidence. Market outcomes are summarized only through Brand, Live and Music.

## 10. Recommended internal data shape

```json
{
  "market_tier": "C+",
  "market_brand": "C+",
  "market_live": "C",
  "market_music": "C+",
  "music_physical_tier": "C+",
  "music_streaming_tier": "C",
  "music_streaming_confidence": "B",
  "market_tier_note": "Optional internal note"
}
```

Only `market_tier` should normally be exposed to players.

## 11. Review workflow

1. lock evaluation date
2. collect Brand evidence without using streaming metrics
3. collect completed paid-Live evidence and discount free/subsidized/one-off projects
4. calculate rolling-52-week Physical
5. evaluate Streaming using hard cross-platform totals when available; otherwise use the documented proxy with confidence flag
6. combine Physical + Streaming into Music using the dominant-channel rule
7. determine Overall structurally from Brand / Live / Music
8. note special cases such as regional concentration, roster reboot, unusual ticketing, overseas route or weak data quality
9. expose only final Tier to the player
