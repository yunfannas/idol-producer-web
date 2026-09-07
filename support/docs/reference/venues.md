# Venue database conventions

`public/data/venues.json` and `src/engine/data/venues.json` are the runtime venue catalogs.  
`support/docs/reference/venues_capacity.csv` is the curated capacity/type metadata source used by `applyVenueMetadata.mjs`.

## Capacity convention

`capacity` is a **gameplay capacity**, not a claim that every real event at the venue can sell exactly that many tickets.

- Prefer the normal idol/live configuration when a venue has several layouts.
- Live houses: normally use standing capacity.
- Seated halls/theaters: normally use the ordinary concert seat count.
- Arenas/stadiums: use a representative concert configuration rather than blindly using the architectural maximum when stage layout removes a large number of seats.
- Temporary outdoor festival sites: use a representative audience scale for the event area/stage; these values are intentionally approximate.
- Round small/mid venues to roughly 50 people and large venues to roughly 100 people (or coarser for arena/stadium scale). Exact one-person precision is not useful to gameplay.

The main purpose is to preserve meaningful progression such as roughly:

`200 -> 300/400 -> 500/600 -> 800/1000 -> 1300/1500 -> 2000/2500/3000 -> hall -> arena -> dome`

Do not overwrite a useful gameplay configuration with a larger building maximum without checking the actual concert layout.

## `venue_type`

Use the physical/event-space archetype, not the event type.

| venue_type | Use for |
| --- | --- |
| `Live House` | purpose-built or commonly used standing live venue |
| `Club` | nightclub/club whose main floor is used for lives |
| `Hall` | conventional concert/civic/event hall |
| `Theater` | fixed theatrical/auditorium-style venue |
| `Event Space` | mall, rental room, exhibition/event room, multipurpose non-live venue |
| `Convention Hall` | convention/exhibition complex hall |
| `Arena` | indoor arena-scale venue |
| `Stadium` | stadium/dome-scale venue |
| `Outdoor Stage` | identifiable outdoor stage or plaza stage |
| `Festival Site` | large temporary or multi-stage outdoor festival area |
| `Studio` | studio used for fan events / small performances |
| `Cinema` | cinema/auditorium used for screenings or fan events |

`setting` remains only `indoor` / `outdoor` and is separate from `venue_type`.

## TimeTree import policy

TimeTree strings are noisy. The catalog should contain actual venues (plus deliberate festival-site containers), not every scraped location string.

Canonicalize spelling variants and common mistakes before creating a new row. Examples:

- `Veath SHIBUYA`, `渋谷Veats`, `ビーツ・シブヤ` -> `Veats SHIBUYA`
- `WOBM LIVE` -> `WOMB`
- `Kanadivia Hall` -> `Kanadevia Hall`
- `duo MUSIC EXCANGE`, `SHIBUYA DUO` -> `duo MUSIC EXCHANGE`
- ViBlue spelling variants -> `ViblueEBISU`
- `大阪城野音` -> `大阪城音楽堂`

Do **not** create venue rows for placeholders/parser artifacts such as `都内`, `未定`, `会場後日告知`, URLs, bare dates/numbers, or generic strings such as `新宿2会場` / `渋谷4会場`.

`support/scripts/timetreeVenueDb.mjs` owns future-import alias/rejection behavior.  
`support/scripts/cleanupVenueCatalog.mjs` safely migrates existing aliases by remapping `venue_uid` references before removing duplicate/parser rows.

## Maintenance workflow

```bash
# Apply curated capacity/type metadata to both runtime catalogs
node support/scripts/applyVenueMetadata.mjs

# Review alias/parser cleanup without writing
npm run data:venues-cleanup

# After reviewing the report, migrate references and clean catalogs
npm run data:venues-cleanup-write
```

When adding a new real venue seen in TimeTree, add or verify its rounded capacity, city, indoor/outdoor setting and `venue_type` in `venues_capacity.csv` rather than leaving the default auto-created `500` value.
