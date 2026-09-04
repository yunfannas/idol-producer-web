#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const IDOLS_PATH = 'public/data/scenarios/scenario_6/idols.json';
const GROUP_TIER_HISTORY_PATH = 'support/data/group-tier-history.json';
const OVERRIDES_PATH = 'support/config/idol-career-history-overrides.json';
const OUT_PATH = 'support/data/idol-career-context.json';
const OPENING_DATE = '2025-07-05';

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function normalizeDate(value) {
  if (!value) return null;
  const s = String(value).trim();
  if (!s) return null;
  const iso = /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
  return iso;
}

function normalizeSourceHistory(idol, groupUidByName) {
  const raw = Array.isArray(idol.group_history_in_group) ? idol.group_history_in_group : [];
  return raw.map(entry => ({
    group_uid: entry.group_uid || groupUidByName.get(entry.group_name) || null,
    group_name: entry.group_name || '',
    start_date: normalizeDate(entry.start_date),
    end_date: normalizeDate(entry.end_date),
    start_year: entry.start_year ?? null,
    end_year: entry.end_year ?? null,
    date_precision: normalizeDate(entry.start_date) ? 'day' : (entry.start_year ? 'year' : 'unknown'),
    member_name: entry.member_name || null,
    member_color: entry.member_color || null,
    source_type: 'scenario_idols',
  }));
}

function historyKey(h) {
  return `${h.group_uid || ''}|${h.group_name || ''}|${h.start_date || h.start_year || ''}|${h.end_date || h.end_year || ''}`;
}

function mergeHistory(source, overrides = []) {
  const out = [];
  const seen = new Set();
  for (const item of [...source, ...overrides]) {
    const key = historyKey(item);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => {
    const ay = Number(a.start_date?.slice(0, 4) || a.start_year || 9999);
    const by = Number(b.start_date?.slice(0, 4) || b.start_year || 9999);
    return ay - by || String(a.group_name).localeCompare(String(b.group_name), 'ja');
  });
}

function segmentYears(segment) {
  const start = Number(segment.start_date?.slice(0, 4) || segment.start_year || 0) || null;
  const end = Number(segment.end_date?.slice(0, 4) || segment.end_year || OPENING_DATE.slice(0, 4)) || null;
  return { start, end };
}

function overlapsScenario(segment, openingDate) {
  const year = Number(String(openingDate).slice(0, 4));
  const { start, end } = segmentYears(segment);
  if (!start) return false;
  return start <= year && (!end || end >= year);
}

function enrichTierExposure(segment, groupHistoryByUid, scenarios) {
  const history = groupHistoryByUid.get(segment.group_uid);
  const exposure = {};
  for (const [scenario, meta] of Object.entries(scenarios)) {
    if (!overlapsScenario(segment, meta.opening_date)) continue;
    const slot = history?.tier_history?.[scenario];
    exposure[scenario] = slot ? {
      tier: slot.tier ?? null,
      status: slot.status || 'unknown',
      confidence: slot.confidence || 'unknown',
    } : {
      tier: null,
      status: 'unknown',
      confidence: 'unknown',
    };
  }
  return exposure;
}

function approximateMonths(segment) {
  if (segment.start_date) {
    const start = new Date(`${segment.start_date}T00:00:00Z`);
    const endRaw = segment.end_date || OPENING_DATE;
    const end = new Date(`${endRaw}T00:00:00Z`);
    if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
      return Math.max(0, Math.round((end - start) / (1000 * 60 * 60 * 24 * 30.4375)));
    }
  }
  if (segment.start_year) {
    const endYear = segment.end_year || Number(OPENING_DATE.slice(0, 4));
    return Math.max(0, (Number(endYear) - Number(segment.start_year)) * 12);
  }
  return null;
}

async function main() {
  const [idols, groupTierHistory, overrideConfig] = await Promise.all([
    readJson(IDOLS_PATH),
    readJson(GROUP_TIER_HISTORY_PATH),
    readJson(OVERRIDES_PATH),
  ]);
  if (!Array.isArray(idols)) throw new Error(`${IDOLS_PATH} must be an array`);

  const groupRows = groupTierHistory.rows || [];
  const groupHistoryByUid = new Map(groupRows.map(row => [String(row.uid), row]));
  const groupUidByName = new Map(groupRows.map(row => [String(row.name), String(row.uid)]));
  const scenarios = groupTierHistory.scenarios || {};
  const overrides = overrideConfig.overrides || {};

  const members = idols.map(idol => {
    const source = normalizeSourceHistory(idol, groupUidByName);
    const override = overrides[idol.uid]?.career_history || [];
    const career_history = mergeHistory(source, override).map(segment => ({
      ...segment,
      approximate_months: approximateMonths(segment),
      tier_exposure: enrichTierExposure(segment, groupHistoryByUid, scenarios),
    }));
    const prior_group_months = career_history
      .filter(h => h.group_name && !source.some(s => s.group_name === h.group_name && !h.end_date && !h.end_year))
      .reduce((sum, h) => sum + (h.approximate_months || 0), 0);

    return {
      uid: idol.uid,
      name: idol.name,
      career_history,
      prior_group_months,
    };
  });

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });
  await fs.writeFile(OUT_PATH, `${JSON.stringify({
    schema: 'idol_career_context_v1',
    generated_at: new Date().toISOString(),
    opening_date: OPENING_DATE,
    members,
  }, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${members.length} idol career contexts to ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
