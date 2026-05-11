# Scout System Design

## Purpose

The scout system gives the player a structured way to discover new talent outside the current group roster. It supports three distinct acquisition channels:

- `Freelancer recommendations`: idols with no current group
- `Transfer recommendations`: idols currently active elsewhere but plausible to approach
- `Audition events`: open applications from indie idols and non-agency hopefuls

The first implementation is designed as a playable scouting desk inside the UI, with persistence in the save file and room for deeper negotiation, costs, and outcomes later.

## Scout Companies

Scout companies are third-party talent search firms. Each company has:

- `uid`
- `name`
- `city`
- `level`
- `specialty`
- `focus_note`
- `service_fee_yen`

### Seeded company distribution

- `Tokyo`: 10 companies
  - `Lv1 x4`
  - `Lv2 x3`
  - `Lv3 x2`
  - `Lv4 x1`
- `Osaka`: 4 companies
  - `Lv1 x1`
  - `Lv2 x1`
  - `Lv3 x1`
  - `Lv4 x1`
- `Nagoya`: 2 companies
  - `Lv1 x1`
  - `Lv3 x1`
- `Fukuoka`: 1 company, `Lv1`
- `Sapporo`: 1 company, `Lv1`
- `Sendai`: 1 company, `Lv1`
- `Hiroshima`: 1 company, `Lv1`
- `Niigata`: 1 company, `Lv1`

Total seeded scout companies: `21`.

## Geographic Matching

Scout companies are region-sensitive. They primarily surface idols whose birthplace text matches the company’s city or regional aliases.

Examples:

- `Tokyo`: Tokyo, Tokyo-to, Kanto
- `Osaka`: Osaka, Kansai
- `Nagoya`: Nagoya, Aichi, Chubu
- `Fukuoka`: Fukuoka, Kyushu
- `Sapporo`: Sapporo, Hokkaido
- `Sendai`: Sendai, Miyagi, Tohoku
- `Hiroshima`: Hiroshima, Chugoku
- `Niigata`: Niigata

Local matching does not hard-filter candidates. It adds scoring weight so local agencies feel distinct without becoming empty in low-data cases.

## Level Design

Scout company level controls the expected profile range of idols they focus on.

- `Lv1`: local, entry-level, school circuit, low-profile talent
- `Lv2`: regional indie pipeline, stronger live-house talent
- `Lv3`: major indie ecosystem, recognizable candidates
- `Lv4`: premium introductions, higher-profile idols

Higher-level firms should recommend idols with stronger combinations of:

- popularity
- fan count
- X followers
- overall ability

This is represented by a derived `profile_score` from `0-100`.

## Recommendation Channels

### Freelancer recommendations

Freelancer recommendations search the loaded idol database for idols with:

- no current group membership
- profile bands that roughly match the scout company level
- extra preference for birthplace alignment with the company city

Use case:

- finding unsigned indie idols
- discovering inactive or solo talent for shortlist review

### Transfer recommendations

Transfer recommendations search the loaded idol database for idols with:

- at least one current group
- acceptable profile fit for the scout company level
- optional boost from low morale or high jadedness to simulate move openness
- extra preference for birthplace alignment with the company city

Use case:

- finding idols whose current situation may make them approach-worthy
- surfacing stronger names through higher-level firms

This is a recommendation layer only. It does not yet model negotiation, agency permission, or transfer fees.

## Audition Events

Auditions are an explicit event-driven path rather than pure database search.

When the player chooses `Hold Audition Today` for a scout company:

- the system generates a stable board of candidates for that company and day
- candidates may represent:
  - local indie idols
  - former trainees
  - dancers
  - cover singers
  - open-call non-agency applicants
- results are persisted to save state so the board remains consistent after refresh or reload

### Audition candidate fields

Each audition candidate stores:

- `uid`
- `name`
- `romaji`
- `birthplace`
- `age`
- `birthday`
- `height`
- `background`
- `note`
- `source_company_uid`
- `source_company_name`
- `popularity`
- `fan_count`
- `x_followers`
- `profile_score`
- `attributes`

### Signing flow

When the player signs an audition applicant:

- the candidate is converted into a runtime `Idol`
- the new idol is appended to the in-memory idol roster
- the idol is added to the shortlist
- the candidate row records `signed_idol_uid` and `signed_on`

This is intentionally lightweight for now. It allows auditions to produce real playable characters before contract and agency systems are fully modeled.

## Save Data

Scout state is stored in save payloads under:

```json
"scout": {
  "selected_company_uid": "...",
  "auditions": {
    "<company_uid>|<YYYY-MM-DD>": [ ... candidate rows ... ]
  }
}
```

This allows:

- remembering the currently selected scout company
- keeping audition boards stable across reloads
- preserving signed audition outcomes

## Current UI

The first-pass `Scout` view contains:

- a scout-company table
- company detail text
- three desk tabs:
  - `Freelancers`
  - `Transfer Targets`
  - `Auditions`
- shortlist action for recommendation targets
- hold/sign actions for audition boards

## Design Intent

The scout system is meant to create different flavors of recruitment:

- `Lv1 local firms` feel broad, affordable, and raw
- `Lv4 firms` feel expensive and selective
- `Freelancers` are the easiest to approach
- `Transfers` create aspiration and roster-poaching tension
- `Auditions` let the player shape brand-new idols

This also gives city identity real gameplay value. A Tokyo scout office should not feel like a Fukuoka or Sendai office, even before a full world simulation exists.

## Planned Extensions

Natural next steps:

- charge scout company fees through the finance system
- add negotiation states for transfer leads
- make auditions occupy calendar time
- add acceptance/rejection logic based on group reputation and finances
- attach agencies to transfer leads and require approvals
- create scout staff with skill modifiers
- add local preference bias from player group base city
- track signed idols as `freelancer`, `transfer`, or `audition` origin
