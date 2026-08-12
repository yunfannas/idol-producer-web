# Group Strategy Points Review Sheet

This is a draft strategy matrix for the sampled groups discussed in `japanese-idol-industry-research-notes.md`.

Use the CSV as the editable sheet:

- `support/docs/group-strategy-points-review.csv`
- `support/docs/group-strategy-meeting-signals-review.csv`

## Score Scale

Numeric strategy scores use `0-5`.

- `0`: not part of the normal strategy
- `1`: low / exceptional
- `2`: secondary
- `3`: normal or balanced
- `4`: strong emphasis
- `5`: central to the strategy

## Strategy Point Definitions

These are intended as producer-controllable strategy tendencies, not direct outcome sliders.

| Column | Meaning |
|---|---|
| `live_frequency` | How much the default plan relies on live appearances. |
| `online_benefit_emphasis` | Reliance on online signing, online talk, remote release-event sales or other high-throughput digital fan-contact. |
| `shooting_handshake_emphasis` | Reliance on physical release-event contact such as handshake, group/individual shooting, photo events or pre-COVID akushu-style systems. |
| `post_live_tokutenkai_emphasis` | Reliance on post-live tokutenkai / cheki / immediate fan-contact after package lives, routine shows or one-man events. |
| `media_ip_emphasis` | Reliance on media, brand/IP, television, publishing, advertising reach and large-system visibility. |
| `viral_music_content` | Reliance on songs, covers, short video, MV/content spread and algorithmic awareness. |
| `major_release_signing_efficiency` | Reliance on physical releases, online signing and high revenue per member-hour sales systems. |
| `direct_fan_relationship` | Reliance on repeat attendance, oshi attachment, birthday events, benefit queues and member-specific spending. |
| `member_storytelling` | Use of documentary, backstage growth, personal narrative, generation story or reboot story. |
| `production_investment` | Normal level of spending pressure for songs, MV, costumes, large concerts and visual quality. |
| `rest_protection` | How much the default model should protect off-days and recovery. |
| `roster_renewal_system` | Whether systematic auditions/generational renewal are central to the strategy. |
| `member_exposure_policy` | Default exposure style: stable member value, ace push, rotation, new-member nurture, generation integration, etc. |
| `default_event_mix` | The schedule generator's starting bias. |
| `default_benefit_policy` | The schedule generator's starting benefit-channel bias, such as online signing, release events, mixed conversion, or post-live tokutenkai. |
| `default_rest_policy` | The schedule generator's starting rest rule. |
| `frequency_restriction` | Plausibility limits the scheduler should enforce before finalizing a plan. |
| `staff_meeting_signal` | Preview feedback from operations/finance. |
| `member_meeting_signal` | Preview feedback from member morale/workload viewpoint. |
| `fan_survey_signal` | Preview feedback from fan demand/trust viewpoint. |
| `main_gameplay_risk` | The dominant failure mode the player should manage. |

## Draft Archetype Summary

| Group | Archetype | Core Strategy |
|---|---|---|
| `=LOVE` | Mature fixed-roster IP sustain | Protect accumulated member/IP value; monetize efficiently through releases, signing, media, goods and concerts. |
| `Nogizaka46` | Generational roster renewal | Maintain institutional continuity through auditions, generation integration, selection balance and graduation handling. |
| `iLiFE!` | High-frequency core-fan monetization | Convert momentum into repeat attendance and benefit revenue while managing overextension. |
| `Takamine no Nadeshiko` | Awareness-to-core-fandom conversion | Turn music/content recognition into repeat attendance, oshi attachment and spending. |
| `Akishibu project` | Veteran rebuild | Restore lost mature member equity, stabilize fan trust and rebuild live/benefit demand. |
| `Jams Collection` | Direct-monetization strong underground | Use live attendance, merch, benefit sessions and birthday events to support ambitious activity. |
| `Kirameki Unforent` | Emotional reboot and narrative recruitment | Rebuild belief through member recruitment story, producer trust, recovery and identity. |

## Design Note

The numeric fields should seed the default strategy and schedule planner. They should not directly set outcomes such as core fan conversion, revenue or health. Those outcomes should emerge from actions, constraints, member states and fan demand.

During normal daily gameplay, finalized strategy should be shown as read-only context. It should only become editable inside the monthly Strategy Meeting, then lock again after finalization. The monthly meeting should be entered from a blocking inbox event, similar to Today's live schedule opening Live Mode. This keeps the strategy layer from becoming a trivial daily slider exercise and makes each change feel like an organizational decision.

## Meeting Signal Sheet

`group-strategy-meeting-signals-review.csv` is a second review sheet for the proposed Strategy Meeting UI.

Each row is:

`group + preset + policy_item -> staff/member/fan attitude and comments`

Attitude values use `-3` to `+3`.

- `-3`: strongly opposed
- `-2`: opposed
- `-1`: concerned
- `0`: neutral or mixed
- `+1`: mildly supportive
- `+2`: supportive
- `+3`: strongly supportive

The intended UI behavior is:

1. At month start, a blocking Strategy Meeting inbox event appears.
2. Player clicks `Enter Meeting`.
3. The dedicated Strategy page opens on the Meeting tab.
4. Player reviews current strategy and last month's results.
5. Player drafts monthly strategy changes.
6. The meeting panel evaluates each changed policy item.
7. Staff, members and fan survey each show attitude and short reason.
8. Player adjusts or finalizes.
9. Finalization clears the blocker.
10. Strategy locks until the next monthly meeting unless a crisis opens an emergency meeting.

These rows are seed data for review. Later, attitude should be computed from the default strategy, proposed delta, current fatigue, cash, demand, member age/school load, roster stability and recent trust.
