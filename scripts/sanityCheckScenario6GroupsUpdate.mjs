/**
 * Pre-merge sanity check for scenario_6 groups_update.json.
 * Usage: node scripts/sanityCheckScenario6GroupsUpdate.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const scenarioDir = path.join(root, "public/data/scenarios/scenario_6");
const EXCLUDE = "アキシブproject";
const AKISHIBU_UID = "44Ki44Kt44K344OWcHJvamVjdA";

const allow = JSON.parse(fs.readFileSync(path.join(scenarioDir, "startup_allowlist.json"), "utf8"));
const scenario = JSON.parse(fs.readFileSync(path.join(scenarioDir, "groups.json"), "utf8"));
const update = JSON.parse(fs.readFileSync(path.join(scenarioDir, "groups_update.json"), "utf8"));
const patches = update.groups ?? [];

const expectedNames = new Set((allow.names_in_order ?? []).filter((n) => n !== EXCLUDE));
const patchNames = new Set(patches.map((p) => p.name));
const patchUids = new Set(patches.map((p) => p.uid));

const scenIx = new Map(scenario.map((g, i) => [g.uid, i]));
const akishibuInPatch = patches.some((p) => p.name === EXCLUDE || p.uid === AKISHIBU_UID);

const missingExpected = [...expectedNames].filter((n) => !patchNames.has(n));
const extraPatch = [...patchNames].filter((n) => !expectedNames.has(n));
const unknownUid = patches.filter((p) => !scenIx.has(p.uid)).map((p) => p.name);

let songUidGain = 0;
let memberGain = 0;
for (const p of patches) {
  const before = scenario[scenIx.get(p.uid)];
  if (!before) continue;
  const su0 = Array.isArray(before.song_uids) ? before.song_uids.length : 0;
  const su1 = Array.isArray(p.song_uids) ? p.song_uids.length : 0;
  if (su1 > su0) songUidGain += 1;
  const mc0 = Number(before.member_count ?? 0);
  const mc1 = Number(p.member_count ?? 0);
  if (mc1 !== mc0) memberGain += 1;
}

const ok =
  !akishibuInPatch &&
  missingExpected.length === 0 &&
  unknownUid.length === 0 &&
  patches.length === expectedNames.size;

console.log(
  JSON.stringify(
    {
      ok,
      patch_rows: patches.length,
      expected_allowlist_rows: expectedNames.size,
      akishibu_in_patch: akishibuInPatch,
      missing_from_patch: missingExpected,
      extra_patch_names: extraPatch,
      unknown_scenario_uid: unknownUid,
      groups_gaining_song_uids: songUidGain,
      groups_with_member_count_change: memberGain,
    },
    null,
    2,
  ),
);

if (!ok) process.exit(1);
