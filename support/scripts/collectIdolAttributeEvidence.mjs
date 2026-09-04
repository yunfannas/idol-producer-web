#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

const args = parseArgs(process.argv);
const configPath = args.config || 'support/config/idol-attribute-search.json';

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

function slugify(value) {
  return String(value || 'idol')
    .normalize('NFKC')
    .replace(/[\\/:*?\"<>|\s]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 120);
}

function fillTemplate(template, member) {
  return template
    .replaceAll('{name}', member.name || '')
    .replaceAll('{group}', member.group || '');
}

function domainOf(url) {
  try { return new URL(url).hostname.toLowerCase(); }
  catch { return ''; }
}

function classifySource(result, config) {
  const domain = domainOf(result.url);
  const haystack = `${result.title || ''} ${result.description || ''} ${domain}`.toLowerCase();
  if ((config.sourceClassification?.professionalMediaDomains || []).some(d => domain === d || domain.endsWith(`.${d}`))) {
    return 'professional_media';
  }
  if ((config.sourceClassification?.officialHints || []).some(x => haystack.includes(String(x).toLowerCase()))) {
    return 'official_profile';
  }
  if ((config.sourceClassification?.lowTrustDomains || []).some(x => domain.includes(String(x).toLowerCase()))) {
    return 'single_fan_source';
  }
  return 'unclassified';
}

function scoreCandidate(result, group, config) {
  const text = `${result.title || ''}\n${result.description || ''}`;
  const matches = (group.terms || []).filter(term => text.includes(term));
  const sourceClass = classifySource(result, config);
  const sourceRank = (config.sourcePriority || []).indexOf(sourceClass);
  const authorityBonus = sourceRank >= 0 ? Math.max(0, 7 - sourceRank) : 0;
  return {
    ...result,
    source_class: sourceClass,
    matched_terms: matches,
    relevance_score: matches.length * 3 + authorityBonus,
  };
}

async function braveSearch(query, providerConfig) {
  const apiKey = process.env[providerConfig.apiKeyEnv || 'BRAVE_SEARCH_API_KEY'];
  if (!apiKey) throw new Error(`Missing ${providerConfig.apiKeyEnv || 'BRAVE_SEARCH_API_KEY'}`);
  const url = new URL(providerConfig.endpoint);
  url.searchParams.set('q', query);
  url.searchParams.set('count', String(providerConfig.count || 10));
  if (providerConfig.country) url.searchParams.set('country', providerConfig.country);
  if (providerConfig.searchLang) url.searchParams.set('search_lang', providerConfig.searchLang);
  if (providerConfig.freshness) url.searchParams.set('freshness', providerConfig.freshness);

  const res = await fetch(url, {
    headers: {
      Accept: 'application/json',
      'X-Subscription-Token': apiKey,
    },
  });
  if (!res.ok) throw new Error(`Brave search ${res.status}: ${await res.text()}`);
  const json = await res.json();
  return (json.web?.results || []).map(item => ({
    title: item.title || '',
    url: item.url || '',
    description: item.description || '',
    age: item.age || null,
  }));
}

async function search(query, config) {
  const provider = config.provider?.default || 'brave';
  if (provider === 'brave') return braveSearch(query, config.provider.brave || {});
  throw new Error(`Unsupported provider: ${provider}`);
}

function selectQueries(config, tier) {
  const maxQueries = Number(config.budgetsByTier?.[tier] ?? config.budgetsByTier?.C ?? 9);
  const groups = [...(config.queryGroups || [])]
    .filter(group => (group.queries || []).length > 0)
    .sort((a, b) => (b.priority || 0) - (a.priority || 0));

  const selected = [];

  // Coverage pass: first query from as many semantic groups as the budget allows.
  for (const group of groups) {
    if (selected.length >= maxQueries) break;
    selected.push({ group, template: group.queries[0] });
  }

  // Depth pass: spend remaining budget on each group's secondary queries,
  // preserving configured priority without starving an entire domain.
  let depth = 1;
  while (selected.length < maxQueries) {
    let added = false;
    for (const group of groups) {
      const template = group.queries?.[depth];
      if (!template) continue;
      selected.push({ group, template });
      added = true;
      if (selected.length >= maxQueries) break;
    }
    if (!added) break;
    depth += 1;
  }

  return selected;
}

async function loadMembers() {
  if (args.member) {
    return [{
      name: args.member,
      group: args.group || '',
      tier: String(args.tier || 'C').toUpperCase(),
      uid: args.uid || null,
      age: args.age ? Number(args.age) : null,
      height_cm: args.height ? Number(args.height) : null,
      career_months: args['career-months'] ? Number(args['career-months']) : null,
      prior_group_months: args['prior-group-months'] ? Number(args['prior-group-months']) : null,
      training_background: args.training || null,
    }];
  }
  if (!args.input) throw new Error('Use --member NAME [--group GROUP --tier B] or --input members.json');
  const data = await readJson(args.input);
  return Array.isArray(data) ? data : data.members;
}

async function collectMember(member, config) {
  const tier = String(member.tier || 'C').replace(/[+-]/g, '').toUpperCase();
  const selected = selectQueries(config, tier);
  const evidence = [];

  for (const { group, template } of selected) {
    const query = fillTemplate(template, member);
    let results = [];
    let error = null;
    try {
      results = await search(query, config);
    } catch (err) {
      error = String(err?.message || err);
    }
    const ranked = results
      .map(r => scoreCandidate(r, group, config))
      .sort((a, b) => b.relevance_score - a.relevance_score);

    evidence.push({
      query_group: group.id,
      query,
      error,
      results: ranked,
    });
  }

  return {
    schema: config.output?.schema || 'idol_attribute_evidence_candidates_v1',
    collected_at: new Date().toISOString(),
    member: {
      uid: member.uid || null,
      name: member.name,
      group: member.group || '',
      tier: member.tier || 'C',
      age: member.age ?? null,
      height_cm: member.height_cm ?? null,
      career_months: member.career_months ?? null,
      prior_group_months: member.prior_group_months ?? null,
      training_background: member.training_background ?? null,
    },
    evidence,
  };
}

async function main() {
  const config = await readJson(configPath);
  const members = await loadMembers();
  const outputDir = args.out || config.output?.defaultDir || 'support/data/idol-attribute-evidence';
  await fs.mkdir(outputDir, { recursive: true });

  for (const member of members) {
    const record = await collectMember(member, config);
    const filename = `${slugify(member.group)}__${slugify(member.name)}.json`;
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    console.log(outputPath);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
