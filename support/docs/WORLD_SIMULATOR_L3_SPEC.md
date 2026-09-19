# World Simulator L3 boundary

**Status:** authoritative for `agent/l3-world-simulator`
**Effective:** 2026-09-18
**Runtime owner:** `idol-producer-web`
**Data owner:** `idol-data-lab`

## 1. Scope

World Simulator is a viewer and review surface for dated L3 monthly world
state. It is not the legacy game bootstrap, the L3 calculation engine, or an
alternative database.

The simulator may read only the exported bundle at
`public/data/l3-world-viewer/`. That bundle must be generated in
`idol-data-lab` from canonical L1 facts and reviewed L2 conclusions. The Web
repository renders the bundle and may submit review patches; it does not
recalculate or repair upstream facts.

## 2. Layer ownership

| Layer | Owner | World Simulator use |
| --- | --- | --- |
| L1 facts | `idol-data-lab/l1/` | dated identities, memberships, works, releases, events and sourced claims |
| L2 research | reviewed `idol-data-lab` L2 packets | attributes, palettes, tier and other reusable interpretations |
| L3 world | `idol-data-lab/data/l3-world/` | immutable monthly projections and viewer export |
| L4 save | game runtime | out of scope for this viewer |

L3 may use a versioned deterministic fallback only after an input audit has
reported the missing L1/L2 field. The fallback and its provenance must remain
visible in the exported snapshot.

## 3. Forbidden inputs

World Simulator and the L3 engines that feed it must not read runtime inputs
from:

- Web compatibility catalogs such as `public/data/groups.json`,
  `public/data/idols.json`, `public/data/songs.json` or scenario exports;
- `legacy/`, archived Web databases, migration snapshots or scratch files;
- the current online game save/bootstrap state;
- browser-side joins against legacy catalogs.

Historical migration provenance may be reported as lineage, but a migration
or legacy file cannot be a direct simulation input. A missing canonical fact
is an L1 audit issue; a missing interpretation is an L2 audit issue.

## 4. Viewer bundle contract

`manifest.json` must include:

```json
{
  "schema_version": "l3-world-viewer-bundle/v1",
  "data_contract": {
    "contract_version": "l3-viewer-input/v1",
    "direct_input_layers": ["L1", "L2"],
    "legacy_runtime_inputs": false,
    "web_legacy_catalogs": false
  }
}
```

The viewer and Pages build fail closed when this contract is absent or false.
The bundle must continue to expose snapshot provenance, fallback flags, audit
readiness and the source revision needed to reproduce it.

Member-state rows include dated roster/role facts, effective-experience
lineage, 17 current attributes plus ceilings, derived ability/radar values and
the ten-colour Member Developed Palette. These are L3 outputs; the Web viewer
does not regenerate or rebalance them.

## 5. Deployment boundary

- GitHub Pages tracks `agent/l3-world-simulator`, not `main`.
- The Pages artifact contains only `world-sim/` and
  `data/l3-world-viewer/`.
- The root Pages URL redirects to `world-sim/`.
- `main` remains the online legacy game branch until an explicit cutover.
- A World Simulator change is tested and reviewed on the L3 branch before any
  future merge or switch.

## 6. Superseded guidance

`WORLD_GENERATION_RULES.md` describes the legacy main-game bootstrap and may
remain useful during compatibility work. It is not an authority for L3 data
routing. In particular, its `group_history`, whole-world mutable snapshot and
legacy fan backfill instructions must not be imported into World Simulator.

`idol-producer-portable-system-spec.md` remains a gameplay/formula reference.
It cannot override L1 facts, reviewed L2 conclusions, the layered database
ownership rules or this input boundary.

## 7. Promotion gate

Before a bundle is published:

1. L3 input audit is ready and has no open P0 item for the exported window.
2. Every direct engine input is rooted in L1 or reviewed L2.
3. Generated monthly files validate against their schemas.
4. Bundle manifest declares the contract in section 4.
5. The Pages allowlist build succeeds and the viewer smoke test loads every
   exported endpoint.
