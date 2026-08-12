# Japanese Idol Industry Research Notes

## Purpose and evidence standard

These notes summarize working research for the simulation and balancing of `idol-producer-web`. They focus on the modern Japanese female-idol ecosystem, especially the relationship among management, members, and fans; group growth and decline; live/benefit-session economics; member workload; and production costs.

This is a **research and design document, not an audited industry report**. Public facts, first-hand observations, anecdotal statements, and modeling assumptions should remain distinguishable. For future additions, use the following evidence labels where useful:

- **Direct statement** — a member, producer, or management statement.
- **Public fact** — an announcement, sales figure, schedule, venue, roster change, etc.
- **Observation** — repeated fan-side or field observation.
- **Interpretation** — a causal or strategic reading of the facts.
- **Model assumption** — a number chosen for simulation when real financial data are unavailable.

## 1. Six-tier group scale used by the game

The game already uses six broad tiers. They should represent overall organizational/market scale rather than force every group into the same business model.

| Tier | Working definition | Typical characteristics |
|---|---|---|
| S | Phenomenon | National cultural impact, enormous fanbase, top venues, mass media and exceptional revenue |
| A | Large major | Major-label/IP-scale organization, arena/stadium capability, very large physical/merchandise economy |
| B | Super-strong underground / mid-major | Budokan/arena-capable, exceptionally strong core monetization or medium major-label scale |
| C | Strong underground / quasi-major | Zepp/hall scale, major debut possible, strong but not dominant scene presence |
| D | Professional underground | Sustainable professional organization with staff, lessons, regular releases and live/benefit revenue |
| E | Small underground | Low fixed-cost operation, often part-time members, small core fanbase and benefit-session dependence |

The same tier can contain very different economic models. A group may have stronger CD sales but weaker core-fan conversion; another may have modest mass-market reach but extraordinary live and benefit-session monetization.

For Scenario 6, beginning **2025-07-05**, current working anchors include:

- `=LOVE`: A
- `iLiFE!`: B
- `Takamine no Nadeshiko`: C
- `Akishibu project`: D at the scenario period, after having briefly reached approximately C in its stronger era

S should remain rare. Current large successful groups should not automatically occupy S; the tier needs room for true national phenomena such as peak-era AKB48/Sakamichi-scale impact.

## 2. Recommended-group archetypes for Scenario 6

The recommended groups are more useful when each presents a different management problem rather than a simple easy/normal/hard ladder.

### =LOVE — sustain a mature major-scale success

The =LOVE / ≠ME / ≒JOY system demonstrates a long-term, relatively stable growth model. Important features include rejection of an AKB-style internal selection system, documentary/backstage storytelling that makes member growth visible, strong producer/media leverage, relatively patient development, and high monetization efficiency once the fanbase matured.

By the mid-2020s the system's CD economy became extremely strong. Earlier periods were already capable of sustaining the operation even before the later explosive growth. The management challenge at A tier is therefore not basic survival: it is maintaining a large IP, handling member aging and eventual graduation, balancing individual work with group activity, and renewing the organization without destroying accumulated fan relationships.

The system also illustrates that high revenue does not require maximum live frequency. Physical releases, online signing, merchandise, major concerts, and media work can generate high revenue per member-hour.

### iLiFE! — convert explosive growth into a sustainable organization

`iLiFE!` represents the upper end of the HEROINES live/benefit-session model. Demand can exceed benefit-session capacity, and venue ambitions can move rapidly from Budokan toward arena scale.

The strategic risk is organizational overextension. HEROINES groups are observed to have very high live frequency and long benefit sessions. Some members also hold concurrent assignments. The ecosystem has recruited many young and inexperienced members, while turnover among minors has been a recurring concern. Fans also worry about rapid creation of many groups competing for similar customer segments and internal resources.

A central design question is therefore not merely "how to grow" but "how much growth can the member organization safely process?"

### Takamine no Nadeshiko — convert awareness into core fandom

Takamine no Nadeshiko is a useful counterexample to the assumption that viral reach automatically produces a powerful idol business. The group gained enormous awareness through HoneyWorks-related material and viral covers such as `Kawaikute Gomen`, followed by further successful content. It also received major live opportunities, festival appearances and media exposure.

However, fan-side criticism has repeatedly focused on weak immediate fan-conversion mechanisms: historically limited post-live benefit opportunities, merchandise delays, costume investment, dependence on the HoneyWorks music pipeline, and perceived reluctance to make large venue investments. The group frequently shared events with groups such as FRUITS ZIPPER, Jams Collection and iLiFE!, yet its core fanbase did not appear to expand in proportion to its content reach.

This produces a particularly useful simulation problem:

**How does management convert a person who knows the song into a person who supports the group, attends repeatedly, develops a member relationship, and spends?**

### Akishibu project — rebuild a declining veteran organization

Akishibu project is a different archetype: a veteran brand with accumulated history, a sustainable but no longer dominant core business, and a need for renewal.

The group has generally operated with roughly six to seven members rather than relying on a permanently large roster. Recent observed benefit-session utilization is approximately:

`0.80 / 0.70 / 0.65 / 0.65 / 0.50 / 0.50 / 0.50`

Average utilization is therefore about **61%**. Previously graduated members Mirei and Kae were observed around **0.90** and **0.65** respectively. Newer replacements are around **0.50**. The important point is not roster shrinkage but the loss of mature member-specific fan equity: headcount can be replaced immediately; accumulated fan relationships cannot.

AKSB also participates in the HEROINES ecosystem. Some package events are internal league events. The group was around third place in May 2025 but subsequently declined and ultimately suffered relegation by the end of the 2025–26 season. This makes league performance a natural scenario pressure and provides a real-world reference failure path.

AKSB can therefore function as the game's **rebuild / fallen-veteran** scenario: stabilize, avoid/reverse league decline, develop replacement members, restore mobilization, and eventually return from D toward C.

## 3. Other important case studies

### Jams Collection

Jams Collection demonstrates how a group with comparatively weak major-label CD sales can nevertheless support ambitious live activity through a strong underground-idol business model. The group did not require a mass-market viral hit to reach Budokan-scale ambition. Live attendance, merchandise, benefit sessions, birthday events and other direct fan monetization can compensate for relatively low CD volume.

Its post-Budokan period, including the departure of multiple members, is useful for studying how management preserves a brand and schedules new activity after a major milestone and roster shock.

For simulation purposes, Jams is a reminder that **CD sales alone are a poor proxy for organizational health**.

### Kirameki Unforent / Kirafore

Kirafore is useful for studying repeated rebooting, producer personality, member recruitment and the boundary between fan culture and professional management. Producer Henagi is unusually public on social media and openly identifies with idol-fan culture. This can create both strengths and professionalism risks.

The 2020-era disruption involved conflict between management and member(s) and was followed by a large-scale roster breakdown. Later, the group was revived again.

Kirafore 3.0 is especially valuable because the revival story was publicly explained in unusually personal detail. It was **not a conventional audition**. The seven-member construction drew from very different career states:

- Shiori: former AKB member, with production/member experience in a local group.
- MOB: previously booked for WACK-style/other large-stage ambitions and looking for another breakthrough.
- Suzu: already under Henagi's umbrella and among those with the longest relationship with him.
- Koori: discovered through an incidental encounter in a cafe context.
- Nana / Mimi: had prior idol experience but had moved into ordinary working life, including childcare/nursing-type careers, while retaining idol ambitions.
- Yui: the eventual red/center member, selected from another group under the same umbrella, with consequences for that group's continuation.

The emotional power of the reboot is important for game design. A producer can rebuild not only by optimizing numbers but by persuading people with prior careers, disappointments and alternative lives to believe in a group again.

MOB has reportedly described her monthly income shortly after the reboot as approximately **¥240,000**. Treat this as a useful **direct-statement income anchor**, but the exact composition (base guarantee, appearance pay, cheki back, merchandise share, etc.) is unknown. Because the group was still rebuilding and benefit-session demand was not yet high, it is unlikely that the full ¥240k came primarily from cheki commissions.

Kirafore management has also emphasized **mandatory/protected off-days**, which is significant because an idol's day without a live is not necessarily an off-day: lessons, rehearsal, SNS and streaming can still occupy it.

## 4. Underground-idol business model

A practical definition of the underground-idol economy is not simply "not major-label." Its core loop is often:

**live acquisition/retention -> immediate benefit session -> member-specific relationship -> repeat attendance**

Physical CDs may be secondary or absent for small groups. For many groups the post-live benefit session is the primary direct monetization mechanism.

### Live types have different economic purposes

Do not model all lives as one average event.

- **Package / taiban event**: low production burden, customer acquisition and frequent benefit-session monetization.
- **Regular self-produced show**: core-fan retention and group identity.
- **Birthday/special member show**: member-specific monetization and relationship reinforcement.
- **One-man concert**: prestige, fan consolidation, member motivation, milestone value and future acquisition; it does not need to maximize same-day profit.

A useful observed mix for the HEROINES/AKSB context is roughly **60% package events**, which usually do not require dedicated rehearsal, with the remainder consisting of one-man, regular, birthday and other special shows that require more preparation.

## 5. Benefit-session capacity and utilization

Benefit sessions should be modeled as constrained service capacity.

A member with 100% utilization has a full queue for the available session; 50% means substantial idle capacity. This metric is more useful than raw follower count for short-term underground-idol economics.

For current AKSB observations:

- top member: ~0.80
- next: ~0.70
- two members: ~0.65
- three members: ~0.50
- group average: ~0.61

This is not a crisis distribution. It is relatively balanced: there is no single 0.95 member carrying several 0.1 members. The main issue is that the total demand pool is smaller than during stronger periods and mature high-utilization members have been replaced by newcomers around 0.5.

### Portable member equity

Member popularity should not belong entirely to the group. A veteran can take a meaningful part of her fan relationship capital to a new group. This is especially important when a high-utilization member graduates and later becomes popular elsewhere.

Simulation implication:

`member graduates -> roster slot replaced != revenue capacity restored`

A replacement member may restore headcount immediately but requires time, exposure, performance development and fan interaction to rebuild utilization.

## 6. Preliminary cheki economics

Exact contracts are private, so these are **model assumptions**, not industry facts.

A useful current working price is **¥2,000 per signed cheki/benefit transaction** for a professional underground group.

Approximate direct costs per transaction:

- Instax/cheki film: roughly **¥120–150** in a bulk/realistic purchasing model.
- Member cheki-back: **¥100** is a conservative working assumption for a professional agency group with other compensation. Larger commissions may be appropriate for very small groups with little/no base guarantee.
- Payment/ticket/consumables: additional small variable cost.

Thus most of the ¥2,000 transaction is available to cover staff, member compensation, venues/studios, transport, music, costumes, administration and profit. It must not be treated as net profit.

### Throughput

Earlier theoretical estimates of 120–150 transactions/member-hour are probably too aggressive once conversation, signing, photography, transitions and queue handling are included. A provisional simulation baseline of around **75–90 transactions per fully utilized member-hour** is safer until better field data are collected.

Using 90/hour, current AKSB utilization sum `4.30`, 18 benefit sessions/month and ¥2,000/transaction gives:

`4.30 × 90 × 18 × ¥2,000 ≈ ¥13.9M monthly benefit-session GMV`

This is a **shadow-model estimate**, not a claim about AKSB's actual accounts.

At ¥100 cheki-back, member incentive income from cheki alone would be roughly ¥80k–130k/month across utilization levels of 0.5–0.8, before other compensation.

## 7. Small-group economics versus professional underground groups

A small E-tier group may survive at average benefit utilization around **0.2** because its cost structure is radically different.

Possible characteristics:

- members remain students or hold outside jobs;
- little or no fixed monthly guarantee;
- larger revenue-share/cheki-back component;
- producer/manager performs several roles;
- temporary/event staff rather than a large permanent team;
- hourly studio rental;
- infrequent costumes, MVs and new songs;
- limited travel;
- no major-label release infrastructure.

A D-tier professional underground group may instead support members with meaningful monthly compensation, regular lessons, professional management, continuing music/costume investment and a more reliable schedule.

The E/D boundary should therefore not be a pure popularity threshold. A useful conceptual threshold is:

**Can recurring fan economics sustainably support professional member and staff operations?**

## 8. Member contracts, school and outside life

Do not equate "professional idol" with "full-time employee with no outside commitments." Members of professional groups may attend high school or university. Contract structure, idol workload and external commitments are separate dimensions.

Suggested game dimensions:

- **Primary occupation**: student / idol / employee / freelance / other
- **Idol commitment**: casual / part-time / high / primary
- **Contract type**: per-event / revenue share / minimum guarantee + commission / salary-like guarantee / agency talent contract
- **External load**: school, university, outside employment, family obligations

A university student can simultaneously have a professional agency relationship and a high idol workload.

## 9. Workload is not the same as live count

A normal underground group may have around **13 live dates/month**, while HEROINES groups can be closer to **18**. The latter is roughly 38% more live dates, but raw event count still understates or misstates actual workload.

A package event may require no dedicated rehearsal, while a one-man, regular show or birthday performance can require substantial rehearsal. Conversely, even a short package live can fragment an entire day because of travel, preparation, waiting, benefit sessions and late-night SNS work.

Kae's publicly reported daily schedule while attending university is a useful qualitative example: on live days she could attend classes in the morning, begin preparation in the afternoon, perform and hold benefit sessions in the evening, then return home and still edit/post SNS material or broadcast late at night. On non-live days, lessons were common.

This suggests four separate time concepts:

1. **Official work hours** — live, benefit session, lesson, rehearsal, shooting, recording.
2. **Career-maintenance hours** — SNS, streaming, photo/video editing, announcements, self-practice.
3. **Schedule occupancy / fragmentation** — time that becomes unusable even when not formally working.
4. **External life load** — school, university, other work and family.

The game should calculate fatigue and career sustainability from total life load and recovery, not simply number of performances.

## 10. Protected off-days and the always-on problem

For idols, **no scheduled live is not the same as OFF**. Even an empty calendar date may contain lessons, rehearsal, SNS obligations, streaming or self-promotion.

This creates a competitive problem: if one member rests while others continue posting and broadcasting, she may fear losing engagement. Individually rational behavior can therefore lead every member to remain permanently "on."

A management policy of protected/mandatory OFF days can solve this coordination problem.

Possible simulation policies:

- SNS: free / recommended daily / required daily
- Rest: member discretion / minimum protected OFF days per month

On a protected OFF day, official schedule, mandatory lesson, mandatory SNS and mandatory streaming should be disabled. Members may still post voluntarily, but they should not be penalized for resting.

The producer trades short-term revenue and impressions for recovery, trust, retention and lower health risk.

## 11. HEROINES workload and sick-leave hypothesis

A repeated fan-side observation is that HEROINES appears to have an unusually high rate of illness-related absence. This should currently be labeled **Observation / Hypothesis**, not established causation.

Possible mechanism:

`high live frequency + long benefit sessions + SNS/streaming + school/young members + concurrent assignments -> insufficient recovery -> illness/absence -> remaining-member load -> further recovery pressure`

The game should therefore avoid a purely linear fatigue penalty. A more realistic model is a nonlinear **availability risk**: moderate fatigue has limited effect, but above a threshold the probability of illness, voice problems, injury, absence, mental stress and eventual graduation rises sharply.

Future research can quantify this using official performance/absence announcements. Useful normalized metrics include:

- sick days per 100 member-months;
- illness absences per 100 scheduled member-appearances;
- live appearances per member-month.

The second metric is particularly useful because it controls for groups that simply schedule far more appearances.

## 12. Why high-frequency scheduling is economically tempting

When a group's benefit sessions still have unused demand capacity, adding another package live can be economically attractive. Member headcount, songs, costumes and core staff are mostly fixed; an additional event opens another monetization window.

Using the AKSB shadow model, moving from 13 to 18 similar benefit-session opportunities can add several million yen of monthly GMV without a proportional increase in fixed costs.

This explains why a management company may rationally prefer a dense schedule even if fans perceive it as excessive. The strategic question is whether the marginal revenue exceeds the long-term cost of fatigue, illness, dissatisfaction, turnover and reduced career length.

This trade-off should be visible to the player rather than encoded as "high frequency = bad management."

## 13. CD economics and different monetization regimes

The idol market contains several distinct revenue regimes.

### Small underground

- little/no CD business;
- live + benefit session is the core loop;
- low fixed costs.

### Professional/strong underground

- benefit sessions remain central;
- one-man tickets, birthday shows, goods and online sales become meaningful;
- CDs may exist but need not dominate.

### Major/IP system

- physical releases, online signing, goods, large concerts and media/IP can dominate;
- high-volume signing can be much more member-hour efficient than traditional cheki interaction.

The =LOVE system is an important example: online signing tied to CD sales can process transactions much faster than a 20-second-plus physical cheki interaction, and members can perform it seated. This contributes to very high revenue per member-hour.

Jams Collection illustrates the opposite point: relatively modest major-label CD sales do not necessarily prevent a group from financing ambitious live activity if direct fan monetization is strong.

Takamine no Nadeshiko illustrates another configuration: relatively strong content/major exposure does not automatically create equally strong core-fan monetization.

## 14. Production-cost working model

Real rates vary dramatically with creator reputation, internal networks, production ambition and bundled contracts. These are **game-balancing estimates**.

### Per-song cash production

| Item | Small underground | Professional underground | Strong/quasi-major | Large major |
|---|---:|---:|---:|---:|
| Lyrics | ¥30–80k | ¥50–150k | ¥100–300k | ¥200k+ |
| Composition/arrangement | ¥80–200k | ¥150–350k | ¥300–700k | ¥500k–1.5M+ |
| Choreography | ¥30–80k | ¥50–150k | ¥100–300k | ¥200–500k+ |
| Vocal recording | ¥30–100k | ¥80–200k | ¥150–400k | ¥300k+ |
| Mix/master | ¥30–80k | ¥50–150k | ¥100–250k | ¥200k+ |

A professional D-tier group's song + choreography + recording package can reasonably begin around **¥0.5–0.7M** as a game baseline, before MV and costume.

### MV tiers

- Performance/DIY video: ¥0–100k
- Cheap idol MV: ¥200–500k
- Professional underground: ¥500k–1.5M
- Strong idol/quasi-major: ¥2–5M
- Flagship major: ¥5–15M+
- Prestige production: ¥15–30M+

### Costumes

A useful professional custom-stage-costume range is roughly **¥100–250k per member**, with high-end work above that.

For a seven-member D-tier group, a serious refresh might therefore involve:

- several new songs;
- choreography and recording;
- one flagship MV;
- a new costume set;
- promotional photography/materials.

A total project budget around **¥4–7M** is a useful initial game benchmark. It is affordable for a healthy professional group but large enough to compete with operating profit and therefore create a meaningful producer decision.

## 15. Revenue per member-hour

A major conceptual lesson is that management should not optimize only `revenue/member`. It should care about:

**revenue / member-hour**

A high-volume online signing campaign, merchandise program or large concert can generate far more revenue per unit of member time than repeated long physical benefit sessions.

This helps explain why some major systems can generate enormous revenue while maintaining healthier live schedules, and why an underground group may appear busy every day while producing much less cash.

The game should therefore distinguish:

- financial efficiency;
- member-time efficiency;
- fan relationship depth;
- acquisition reach;
- physical/mental wear.

No single activity maximizes all five.

## 16. Management-member-fan relationship as the core simulation

The most important design conclusion from these case studies is that idol management is not merely content production. It is a three-sided system.

### Management

Controls capital allocation, schedule, recruitment, promotion, music, venues, contract structure, rest policy and organizational culture.

### Members

Supply performance, personality, fan relationships, self-promotion and career investment. They also have school, outside work, health, ambitions, alternative careers and differing tolerance for risk.

### Fans

Do more than consume songs. They form member-specific relationships, provide recurring benefit-session demand, react to management decisions, compare groups, create social proof, and may follow a member across groups.

The strongest simulation should allow all three sides to have partially conflicting incentives.

Examples:

- Management wants one more profitable event; a member needs recovery.
- A member wants to post/stream every day to defend her fan position; management may need to enforce rest.
- Fans want more benefit opportunities; a major-oriented management may prioritize media reach instead.
- Management replaces a graduate quickly; fans do not automatically transfer their attachment to the replacement.
- A viral song creates awareness; without a relationship-conversion path it may not create a durable idol business.

## 17. Suggested simulation variables derived from the research

### Group/business

- tier (S/A/B/C/D/E)
- public awareness
- core fanbase
- live mobilization
- benefit demand/utilization
- music reach
- media reach
- brand prestige/history
- cash and recurring cash flow
- production network quality/cost

### Member

- portable fan equity
- benefit utilization/demand
- performance ability
- self-investment/professionalism
- external commitments
- contract/compensation
- physical fatigue
- mental/social fatigue
- satisfaction/trust
- career alternatives
- graduation intention

### Schedule

- official work hours
- rehearsal burden
- travel/waiting
- career-maintenance hours
- schedule fragmentation
- protected OFF days
- recovery quality

### Risk

- illness/absence probability
- injury/voice risk
- burnout
- scandal/professionalism risk
- fan churn
- member turnover
- overexpansion

## 18. Design principles

1. **Do not make growth monotonic.** Veteran groups can fall from C to D; major groups can stagnate; a replacement roster can be weaker despite equal headcount.
2. **Do not equate followers or viral views with core fans.** Awareness, attendance and member-specific spending are separate conversions.
3. **Do not equate CD sales with total business health.** Underground groups can finance large live ambitions through direct fan monetization.
4. **Do not equate no-live days with rest.** Lessons, SNS and streaming can make a nominally empty day a working day.
5. **Do not equate professional idols with people who have no school/outside life.** Contract, workload and external commitment are separate.
6. **Make member relationships portable.** Graduation can remove years of accumulated fan equity.
7. **Make high-frequency scheduling economically attractive but physically risky.** The player should understand why management does it.
8. **Make production spending a real capital-allocation choice.** Cheap costumes/MVs preserve cash but can hurt excitement, morale and acquisition.
9. **Treat one-man concerts as strategic investments, not merely ticket-profit events.**
10. **Protect S tier for genuine phenomena.** Success at A/B/C should remain meaningful without forcing every campaign toward S.

## 19. Open research items

The following areas would materially improve calibration:

- real cheki-back contract examples across E/D/C-tier groups;
- member base-guarantee versus commission structures;
- staff compensation and staffing ratios;
- standardized illness/absence rates across HEROINES, Jams, Takane no Nadeshiko, symbol groups and other controls;
- historical CD sales and label economics by tier;
- one-man venue production costs and ticket-back structures;
- creator/choreographer/recording rates from actual idol projects;
- member-hour estimates for SNS/streaming and rehearsal;
- fan migration rates after member graduation or transfer;
- league/event-system effects inside large multi-group organizations.

These should be added with source/evidence labels rather than silently converted into hard-coded facts.