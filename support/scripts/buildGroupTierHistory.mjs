#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const GROUPS_PATH = 'public/data/scenarios/scenario_6/groups.json';
const S6_TIERS_PATH = 'public/data/scenarios/scenario_6/group_tiers.json';
const OVERRIDES_PATH = 'support/config/group-tier-history-overrides.json';
const OUT_PATH = 'support/data/group-tier-history.json';

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function asDate(value) {
  if (!value) return null;
  const d = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function baseSlot({ scenario, scenarioDate, formedDate, s6Tier }) {
  if (formedDate && scenarioDate && formedDate > scenarioDate) {
    return {
      tier: null,
      status: 'not_active',
      confidence: 'derived',
      source: 'formed_date',
    };
  }
  if (scenario === 'S6' && s6Tier) {
    if (String(s6Tier).toUpperCase() === 'I') {
      return {
        tier: 'I',
        status: 'inactive',
        confidence: 'scenario_data',
        source: S6_TIERS_PATH,
      };
    }
    return {
      tier: s6Tier,
      status: 'active',
      confidence: 'scenario_data',
      source: S6_TIERS_PATH,
    };
  }
  return {
    tier: null,
    status: 'unknown',
    confidence: 'unknown',
    source: null,
  };
}

function mergeSlot(base, override) {
  if (!override) return base;
  return {
    ...base,
    ...override,
    source: override.source || OVERRIDES_PATH,
  };
}

async function main() {
  const [groups, s6Tiers, config] = await Promise.all([
    readJson(GROUPS_PATH),
    readJson(S6_TIERS_PATH),
    readJson(OVERRIDES_PATH),
  ]);

  if (!Array.isArray(groups)) throw new Error(`${GROUPS_PATH} must be an array`);
  if (!Array.isArray(s6Tiers)) throw new Error(`${S6_TIERS_PATH} must be an array`);

  const s6ByUid = new Map(s6Tiers.map(row => [String(row.uid), row.letter_tier || null]));
  const scenarios = config.scenarios || {};
  const overrides = config.overrides || {};

  const rows = groups
    .filter(g => g && g.uid)
    .map(g => {
      const uid = String(g.uid);
      const formedDate = asDate(g.formed_date || g.formedDate);
      const tier_history = {};

      for (const [scenario, meta] of Object.entries(scenarios)) {
        const scenarioDate = asDate(meta.opening_date);
        const base = baseSlot({
          scenario,
          scenarioDate,
          formedDate,
          s6Tier: s6ByUid.get(uid) || null,
        });
        tier_history[scenario] = mergeSlot(base, overrides[uid]?.[scenario]);
      }

      return {
        uid,
        name: g.name || overrides[uid]?.group_name || '',
        name_romanji: g.name_romanji || g.romaji || null,
        formed_date: g.formed_date || g.formedDate || null,
        tier_history,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(
    OUT_PATH,
    `${JSON.stringify({
      schema: 'group_tier_history_v1',
      generated_at: new Date().toISOString(),
      scenarios,
      rows,
    }, null, 2)}\n`,
    'utf8',
  );

  const counts = {};
  for (const scenario of Object.keys(scenarios)) {
    counts[scenario] = { active: 0, inactive: 0, not_active: 0, unknown: 0 };
    for (const row of rows) {
      const status = row.tier_history[scenario]?.status || 'unknown';
      counts[scenario][status] = (counts[scenario][status] || 0) + 1;
    }
  }
  console.log(`Wrote ${rows.length} group histories to ${OUT_PATH}`);
  console.log(JSON.stringify(counts, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
