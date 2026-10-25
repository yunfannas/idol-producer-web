# Chronicle 2013 Prologue — Events, Tokutenkai, Merchandise, SNS & External Reviews
Status: design baseline / implementation plan (2026-10-24)
Scope: 2013, introductory D− to D-tier underground idol group. This document records decisions; it does not claim that all 2013 idol groups used identical rules.

## 1. Event and external-work opportunities

Use the existing Live evaluation/settlement for performances, and the existing external-work settlement for non-performing appearances. These opportunities are low-frequency, probabilistic invitations per group rather than guaranteed monthly activities.

| Invitation | Settlement | Prologue rule | Notes |
| --- | --- | --- | --- |
| University festival / 学園祭 | Live | Low-frequency eligible | Small-stage or local invitation; not automatic headline slot |
| Corporate year-end party / 忘年会 | Live | Low-frequency eligible | Primarily guaranteed appearance fee, little public exposure |
| Corporate summer party / 夏祭り | Live | Low-frequency eligible | May reach employees, families, or general public |
| Shopping-street promotion / 商店街宣伝 | External work | Low-frequency eligible | Promotion rather than performance |
| One-day shop manager / 一日店長 | External work | Low-frequency eligible | Retail/fan interaction rather than Live |

Invitation probability should be conditioned on season, locality, group tier/brand, organizer budget, and staff/agency connections. Tier is not a hard gate: personal relationships can enable outlier opportunities. Staff may recommend or accept according to existing automation; player can intervene. Do not introduce a new commercial-performance economic subsystem. Explicitly preserve cost, guaranteed fee, audience composition, visibility and permit-for-tokutenkai as existing Live contract/settlement parameters when supported.

## 2. Tokutenkai and merchandise availability

### 2.1 Agreed catalogue
| Item | Price | Regular live | One-man | TIF | Accounting |
| --- | ---: | :---: | :---: | :---: | --- |
| Unsigned 2-shot Cheki | ¥1,000 | yes | yes | yes | Member service |
| Signed / short-comment 2-shot Cheki | ¥1,500 | yes | yes | yes | Member service |
| Pre-shot solo Cheki / ランチェキ | ¥500 | no | yes | yes | Prepared inventory |
| Bromide / 生写真 | ¥500 | no | yes | yes | Prepared inventory |
| Group / 囲み Cheki | ¥2,000–3,000 | no | no | yes | Simultaneous multiple-member service |
| Group photo (collective printed photograph) | ¥500 tentative | no | default | TBD | Prepared inventory |
| Uchiwa / 団扇 | ¥500 tentative | no | default | TBD | Prepared inventory |
| Towel / タオル | ¥1,500 tentative | no | default | TBD | Prepared inventory |

The three One-man commemorative goods are DEFAULT offerings at One-man, with quantity/stock decisions. TIF availability for those three is not settled; leave configurable/TBD rather than infer yes. No other product types in the prologue. Do not introduce smartphone 写メ, short-video products, 宿題チェキ, shirts, acrylic stands, badges or penlights until later chapter design.

Pre-shot Cheki and bromides are prepared products (sales do not consume an idol's one-to-one on-site service slot). Unsold prepared stock persists; calculate production cost and cash tied up in stock. Group Cheki only at TIF, occupying participating members concurrently. For any venue/contract that does not permit an after-show tokutenkai, respect that restriction rather than forcing sales.

### 2.2 Timing and satisfaction
- Unsigned 2-shot Cheki: 20-second **base** on-site service.
- Signed/short-comment 2-shot Cheki: 30-second **base** on-site service.
- Short queues can extend interaction time to increase satisfaction, while longer queues revert toward base to preserve throughput.
- A preliminary, **unfrozen** tuning schedule: empty queue +15 sec; short +10 sec; moderate +5 sec; long +0 sec. Prefer checking projected wait and remaining event time rather than raw queue length only.
- Extension has diminishing returns; waiting/unfinished-queue penalties and service-time opportunity cost remain. Staff handles normal pacing automatically.
- Do not accidentally treat product price or printed-item sale as additional member-service minutes.
- For group Cheki, pricing and duration beyond the restriction to TIF remain subject to calibration.

## 3. 2013 SNS operating baseline

The group starts with official Twitter and YouTube; every member starts with personal Twitter and personal Blog. Only a minority of members may have their own YouTube based on background/traits. Accounts can exist before the group debut.

Keep operation lightweight and staff/member-automated, with optional player choice of weekly emphasis and major campaign investment. Twitter focuses on brief promotion/interaction; Blog offers longer thoughts and personal relationship building; video production has additional resource costs. In later chapters Blog loses regular prominence gradually (2017–2018 transition, after 2019 mostly significant posts, later often inactive); do not force a sudden universal sunset.

On a **weekly** basis only, store/display per-account follower/subscriber/reader count, net change, and average views/reads. These are correlated with existing Core/Otaku/Public audiences and content quality; account followers are not a separate disjoint fan population and overlap across accounts. Average views are approximate reach × content quality, with platform modifiers. No individual post simulation, comments, likes, virality feed, per-post histories, or external model calls needed in the prologue.

## 4. Curated external commentary in Live reports

### 4.1 Purpose
1. World simulation / atmosphere: players see reactions from outside the management interface.
2. Diegetic/implicit feedback: players infer performance and decisions from partial, subjective audience commentary.

**Evaluation is upstream; commentary never drives the evaluation.** Start with existing Live settlement: Performance, Impression, Satisfaction, expected-vs-observed results, member/song highlights, tokutenkai experience and history/deltas when available. Generate fact-grounded opinions, then natural Japanese, then curated selection. Commentary has no additional direct effect on fan counts, brand or satisfaction; avoid double counting.

### 4.2 Sources and triggers
Only three source categories: **Otaku**, **Public**, **Media**. A report can contain only one or two; NEVER require all three. Otaku can be a regular or a first-time viewer as internal perspective, but don't expose extra source categories. Media is rare and event/newsworthiness-dependent; no guaranteed press coverage.

Curated comments can appear in reports for: debut stage, larger multi-act event, recurring/theater performances, One-man, TIF. Ordinary small multi-act shows do not require a commentary section; noteworthy exceptional reactions may be optional. Audience mix and media presence gate sources. Do not force a positive/negative split or a fixed number of comments; prioritize meaningful distinct observations.

### 4.3 Runtime architecture (pure procedural; no Agent/LLM)
1. **Evidence extraction:** deterministic snapshots from Live results, with evidence IDs, sign/magnitude, context and historical comparison.
2. **Opinion selection:** pick what each eligible source might notice; allow subjective weighting, uncertainty and occasionally two related claims. Do not fabricate absent factual events.
3. **Japanese surface realization:** curated offline library of natural Japanese utterance structures, speech acts (surprise, comparison, praise, caveat, memorable moment, return intent), slang and source-specific registers. Vary *syntax and focus*, not adjectives alone. Media tone is measured; Public tends to broad first impressions; Otaku often notices musical details/MC/tokutenkai.
4. **Editorial selection:** diversify evidence dimensions and source styles, penalize near duplicates and recently repeated themes, select informative comments rather than merely the strongest praise.

Store final rendered comments with Live report, source category, underlying evidence IDs, language style/template version and seed; re-opening historical reports must not regenerate text. Use deterministic per-event PRNG to keep save/replay/test stable. Don't reveal evidence IDs or internal ratings in player-facing comments. Evaluate historical deltas for recurring performances: a recently improved flaw is more newsworthy than another identical complaint.

### 4.4 Quality and guardrails
- No raw score-to-sentence mapping such as `performance >= 80 => パフォーマンスが良かった`.
- No invented artist names, songs, wrong dates, queue incidents or media interviews.
- No unnatural uniform Japanese or forced full-report recaps in a single tweet.
- A comment may disagree with overall scores because an observer focuses on one dimension, but every concrete observation must be traceable to a settlement signal.
- For development only, LLMs may help author and review a **static, curated** expression library; the shipped game must not require runtime AI/network/agent.
- Prototype with ~15–20 comment dimensions, 4–6 opinion acts per dimension and 3–5 vetted realizations per act, then validate naturalness empirically rather than treating those counts as requirements.

## 5. Implementation plan and acceptance criteria

### Phase 0 — Existing system audit
Identify the current Live settlement, tokutenkai slots/queue timers, merchandise stock, weekly simulation, reporting and save schema. Preserve the authoritative L1/L2/L3 game data and existing fan-population economy. Add migration-safe schema changes only where needed.

### Phase 1 — Opportunity taxonomy (small)
Map 学園祭/忘年会/夏祭り to Live, and 商店街宣伝/一日店長 to external work. Configure low-frequency eligibility/seasonality and automatic Staff disposition. Test that neither opportunity changes settlement type or grants duplicate earnings.

### Phase 2 — Product data + queue pacing
Data-drive the eight catalog entries and context gates above. Implement 20s/30s Cheki base and configurable short-queue extension. Ensure time accounting, TIF-only group Cheki, prepared inventory costs, One-man default group photo/uchiwa/towel, and unsold-stock rollover. Test regular Live vs One-man vs TIF item visibility, no unsupported late-era goods, and service-time throughput.

### Phase 3 — Weekly SNS aggregation
Ensure accounts exist with historical defaults and optional personal YouTube. Compute followers/net change/average reach once a week without individual post entities. Confirm follower overlap does not inflate core fans and Blog lifecycle can evolve by chapter.

### Phase 4 — Evaluation-driven review engine
Build pure functions: `extractEvidence(liveResult, history)`, `selectOpinions(evidence, audience, seed)`, `realizeJapanese(opinions, library, seed)`, `curateComments(candidates, history)`. Use typed IDs and deterministic seed; persist output on event settlement. Implement source eligibility/gates and topic cooldown. First integration in debut, recurring shows, bigger multi-act events, One-man and TIF.

### Phase 5 — Validation and balancing
Run deterministic scenario tests across bad/good/mixed performances, sparse/busy queues, repeat regular shows, one-man and TIF; stress-test ~100 events / 300–500 selected comments. Check factual grounding, Japanese naturalness, source variation, repetition, save/load determinism, avoidance of any duplicate business effect and player ability to infer high-level performance from comments. Document tuned price/queue/availability parameters rather than silently changing baseline.

## 6. Decision boundary / open balance points

Frozen: event types and settlement routes; low-frequency invitation model; product catalog and context restrictions; ¥500 pre-shot Cheki and bromides; ¥1,000/20s unsigned and ¥1,500/30s signed Cheki; weekly SNS; three commentary categories; evaluation-first, offline procedural generation; report trigger classes.

Not yet frozen: 囲み Cheki exact price within ¥2,000–3,000 and service duration; final prices of group photo, uchiwa and towel; their TIF offering; short-queue time extension thresholds and satisfaction curve; actual event invitation frequency, payment and product demand/production costs; commentary length quotas and wording-library size.

Avoid implementing new high-tier merchandise or treating late-era idol practices as common to all 2013 D−/D groups.
