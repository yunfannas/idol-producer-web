#!/usr/bin/env node
/**
 * Build machine-readable game database index for agents and tooling.
 *
 * Usage:
 *   node support/scripts/buildGameDatabaseIndex.mjs
 *   node support/scripts/buildGameDatabaseIndex.mjs --stdout
 *
 * Output: support/docs/generated/game_database_index.json
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const outDir = path.join(root, "support/docs/generated");
const outPath = path.join(outDir, "game_database_index.json");
const stdoutOnly = process.argv.includes("--stdout");

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(root, rel), "utf8"));
}

function isoDay(v) {
  return typeof v === "string" && v ? v.slice(0, 10) : "";
}

function parseScenario6Doc(text) {
  /** @type {Map<string, {tier: string, members: number, songs: number}>} */
  const out = new Map();
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\d+\.\s*(.+?)\s*\|\s*tier=(\S+)\s*\|\s*members=(\d+)\s*\|\s*songs=(\d+)/);
    if (!m) continue;
    out.set(m[1].trim(), { tier: m[2], members: Number(m[3]), songs: Number(m[4]) });
  }
  return out;
}

function groupAliases(group) {
  return [group.name, group.name_romanji, group.nickname, group.nickname_romanji]
    .filter((v) => typeof v === "string" && v.trim())
    .map((v) => v.trim());
}

function activeMembersOn(idols, group, date) {
  const names = new Set();
  for (const idol of idols) {
    for (const h of idol.group_history || []) {
      const start = isoDay(h.start_date);
      const end = isoDay(h.end_date ?? h.leave_date);
      if (!start || start > date) continue;
      if (end && end < date) continue;
      const match =
        (h.group_uid && h.group_uid === group.uid) ||
        h.group_name === group.name ||
        h.group_name === group.name_romanji;
      if (!match) continue;
      const name = typeof idol.name === "string" ? idol.name.trim() : "";
      if (name) names.add(name);
    }
  }
  return names.size;
}

const preset = readJson("public/data/scenarios/presets/scenario6.json");
const openingDate = preset.opening_date;
const mainGroups = readJson("public/data/groups.json");
const mainIdols = readJson("public/data/idols.json");
const mainSongs = readJson("public/data/songs.json");
const scenarioGroups = readJson("public/data/scenarios/scenario_6/groups.json");
const scenarioIdols = readJson("public/data/scenarios/scenario_6/idols.json");
const allowlist = readJson("public/data/scenarios/scenario_6/startup_allowlist.json");
const groupTiers = readJson("public/data/scenarios/scenario_6/group_tiers.json");
const docPath = path.join(root, "support/docs/scenario6_available_groups.txt");
const docExpected = fs.existsSync(docPath)
  ? parseScenario6Doc(fs.readFileSync(docPath, "utf8"))
  : new Map();

const tierByUid = new Map(groupTiers.map((r) => [r.uid, r]));
const mainByName = new Map();
const mainByUid = new Map();
for (const g of mainGroups) {
  mainByUid.set(g.uid, g);
  for (const alias of groupAliases(g)) {
    if (!mainByName.has(alias)) mainByName.set(alias, g);
  }
}

const scenarioByName = new Map(scenarioGroups.map((g) => [g.name, g]));

/** @type {object[]} */
const allowlistEntries = [];
for (const name of allowlist.names_in_order || []) {
  const group = scenarioByName.get(name) || mainByName.get(name);
  const doc = docExpected.get(name);
  const tierRow = group ? tierByUid.get(group.uid) : null;
  allowlistEntries.push({
    name,
    uid: group?.uid ?? null,
    name_romanji: group?.name_romanji ?? null,
    tier: tierRow?.letter_tier ?? doc?.tier ?? null,
    fans: tierRow?.fans ?? group?.fans ?? null,
    main_member_count: group?.member_count ?? null,
    opening_member_count: group ? activeMembersOn(scenarioIdols, group, openingDate) : doc?.members ?? null,
    song_uids_count: Array.isArray(group?.song_uids) ? group.song_uids.length : doc?.songs ?? null,
  });
}

/** Compact lookup: primary name → uid (main catalog). */
const main_group_lookup = {};
for (const g of mainGroups) {
  main_group_lookup[g.name] = {
    uid: g.uid,
    name_romanji: g.name_romanji ?? null,
    member_count: g.member_count ?? null,
    fans: g.fans ?? null,
  };
}

const tierCounts = {};
for (const row of groupTiers) {
  tierCounts[row.letter_tier] = (tierCounts[row.letter_tier] || 0) + 1;
}

const index = {
  schema_version: 1,
  generated_at: new Date().toISOString(),
  repo: "idol-producer-web",
  docs: {
    master_index: "support/docs/GAME_DATABASE_INDEX.md",
    game_logic: "support/docs/reference/game_logic_model.md",
    web_port_plan: "support/docs/WEB_GAME_PLAN.md",
    database_refresh: "support/docs/database_updates/database_refresh_playbook.md",
    scenario6_playable: "support/docs/scenario6_available_groups.txt",
  },
  databases: {
    main: {
      label: "Living catalog (today)",
      paths: {
        groups: "public/data/groups.json",
        idols: "public/data/idols.json",
        songs: "public/data/songs.json",
        groups_staging: "public/data/groups_update.json",
        songs_staging: "public/data/songs_update.json",
      },
      counts: {
        groups: mainGroups.length,
        idols: mainIdols.length,
        songs: mainSongs.length,
        idols_with_portrait: mainIdols.filter((i) => i.portrait_photo_path).length,
        idols_with_birthday: mainIdols.filter((i) => i.birthday).length,
        idols_with_group_history: mainIdols.filter((i) => Array.isArray(i.group_history) && i.group_history.length).length,
      },
    },
    scenario_6: {
      label: "Time-locked snapshot",
      opening_date: openingDate,
      preset: "public/data/scenarios/presets/scenario6.json",
      paths: {
        groups: "public/data/scenarios/scenario_6/groups.json",
        idols: "public/data/scenarios/scenario_6/idols.json",
        songs: "public/data/scenarios/scenario_6/songs.json",
        group_tiers: "public/data/scenarios/scenario_6/group_tiers.json",
        startup_allowlist: "public/data/scenarios/scenario_6/startup_allowlist.json",
        groups_update: "public/data/scenarios/scenario_6/groups_update.json",
      },
      counts: {
        groups: scenarioGroups.length,
        idols: scenarioIdols.length,
        allowlist: (allowlist.names_in_order || []).length,
        tier_counts: tierCounts,
      },
    },
  },
  integrity: {
    checker: "node support/scripts/checkMainScenarioDbIntegrity.mjs",
    skill: ".cursor/skills/scenario-db-integrity/SKILL.md",
    canaries_at_opening: {
      "=LOVE": 10,
      "iLiFE!": 9,
      "高嶺のなでしこ": 10,
      "アキシブproject": 8,
    },
    rule: "Scenario rosters match dated group_history @ opening_date — NOT main catalog member_uids.",
  },
  query_hints: {
    find_group_by_name: "grep name in groups.json OR use main_group_lookup below",
    find_idol_by_uid: "grep uid in idols.json",
    find_songs_for_group: "filter songs.json by group_uid OR read group.song_uids",
    scenario_playable_only: "startup_allowlist.json names_in_order (86 groups)",
  },
  allowlist: allowlistEntries,
  main_group_lookup,
  reference_data: [
    "public/data/reference/agencies.json",
    "public/data/reference/group_reputation.json",
    "public/data/reference/group_agency_overrides.json",
    "public/data/reference/scandal_handlings.json",
    "public/data/reference/career_decisions.json",
    "public/data/reference/heroines_league.json",
    "public/data/reference/idol_group_rankings_2025_mapped.json",
    "public/data/group_tier_policy.json",
    "public/data/group_union.json",
    "public/data/shared_releases.json",
    "public/data/venues.json",
    "public/data/live_events_catalog.json",
    "public/data/festival_series.json",
    "public/data/member_role_attribute_model.json",
    "public/data/song_popularity_tier_rules.json",
    "public/data/song_starting_formations.json",
  ],
  schedule_data: {
    timetree: "public/data/timetree/*.json",
    official_schedules: "public/data/official_schedules/*.json",
    managed_live_schedules: "public/data/managed-live-schedules/groups/*.json",
    timetree_slugs: "public/data/reference/timetree_group_slugs.json",
  },
  agent_skills: {
    scenario_db_integrity: ".cursor/skills/scenario-db-integrity/SKILL.md",
    idol_portraits: ".cursor/skills/idol-portraits/SKILL.md",
    idol_scandal_history: ".cursor/skills/idol-scandal-history/SKILL.md",
    timetree_schedule: ".cursor/skills/timetree-group-schedule/SKILL.md",
    game_logic_balance: ".cursor/skills/game-logic-balance/SKILL.md",
    idol_database_refresh: "support/docs/skills/idol-database-refresh/SKILL.md",
    apple_music_songs: "support/docs/skills/apple-music-song-update/SKILL.md",
  },
  scripts_by_task: {
    integrity_check: ["support/scripts/checkMainScenarioDbIntegrity.mjs"],
    scenario_roster_rebuild: ["support/scripts/refreshScenario6GroupMembers.mjs", "support/scripts/cleanupScenario6IdolPollution.mjs"],
    catalog_merge: ["support/scripts/mergeCatalogUpdates.mjs", "support/scripts/mergeScenario6GroupsUpdate.mjs"],
    tier_work: ["support/scripts/build-scenario6-group-tiers.mjs", "support/scripts/reinterpolate-scenario6-tiers.mjs", "support/scripts/reevaluateScenario6TiersWithX.mjs"],
    schedule_scrape: ["support/scripts/timetree_public_calendar_scrape.mjs", "support/scripts/official_schedule_scrape.mjs", "support/scripts/buildManagedLiveScheduleDb.mjs"],
    portraits: ["support/docs/skills/idol-portraits/SKILL.md"],
    songs_apple_music: ["support/docs/skills/apple-music-song-update/SKILL.md"],
  },
};

const json = JSON.stringify(index, null, 2);
if (stdoutOnly) {
  process.stdout.write(json);
} else {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outPath, json + "\n", "utf8");
  console.log(`Wrote ${outPath}`);
  console.log(`  main groups: ${mainGroups.length}, scenario allowlist: ${allowlistEntries.length}`);
}
