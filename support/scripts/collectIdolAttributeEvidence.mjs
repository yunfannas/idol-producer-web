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
const careerContextPath = args['career-context'] || 'support/data/idol-career-context.json';

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function readJsonIfExists(file) {
  try { return await readJson(file); }
  catch (err) {
    if (err?.code === 'ENOENT') return null;
    throw err;
  }
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

function scoreCandidate(result, terms, config) {
  const text = `${result.title || ''}\n${result.description || ''}`;
  const matches = (terms || []).filter(term => text.includes(term));
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
    headers: { Accept: 'application/json', 'X-Subscription-Token': apiKey },
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

async function runQuery(member, spec, config, phase) {
  const query = fillTemplate(spec.query, member);
  let results = [];
  let error = null;
  try { results = await search(query, config); }
  catch (err) { error = String(err?.message || err); }
  const ranked = results
    .map(r => scoreCandidate(r, spec.terms || [], config))
    .sort((a, b) => b.relevance_score - a.relevance_score);
  return {
    phase,
    query_group: spec.id || spec.domain,
    covers: spec.covers || [spec.domain].filter(Boolean),
    query,
    error,
    results: ranked,
  };
}

function buildDomainTerms(config) {
  const terms = new Map();
  for (const broad of config.broadQueries || []) {
    for (const domain of broad.covers || []) {
      if (!terms.has(domain)) terms.set(domain, new Set());
      for (const term of broad.terms || []) terms.get(domain).add(term);
    }
  }
  for (const targeted of config.targetedQueries || []) {
    if (!terms.has(targeted.domain)) terms.set(targeted.domain, new Set());
  }
  return terms;
}

function coverageFromEvidence(evidence, config) {
  const domainTerms = buildDomainTerms(config);
  const coverage = {};
  for (const domain of domainTerms.keys()) coverage[domain] = 0;
  for (const item of evidence) {
    for (const result of item.results || []) {
      const text = `${result.title || ''}\n${result.description || ''}`;
      for (const [domain, terms] of domainTerms.entries()) {
        if ([...terms].some(term => text.includes(term))) coverage[domain] += 1;
      }
    }
  }
  return coverage;
}

function chooseFollowups(coverage, config, tier) {
  const maxFollowups = Number(config.maxFollowupsByTier?.[tier] ?? config.maxFollowupsByTier?.C ?? 1);
  const threshold = Number(config.coverageThreshold ?? 1);
  if (maxFollowups <= 0) return [];
  return (config.targetedQueries || [])
    .map(spec => ({ spec, score: Number(coverage[spec.domain] || 0) }))
    .filter(({ score }) => score < threshold)
    .sort((a, b) => a.score - b.score || a.spec.domain.localeCompare(b.spec.domain))
    .slice(0, maxFollowups)
    .map(x => x.spec);
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

async function loadCareerContext() {
  const data = await readJsonIfExists(careerContextPath);
  if (!data) return new Map();
  return new Map((data.members || []).filter(x => x?.uid).map(x => [String(x.uid), x]));
}

async function collectMember(member, config, careerByUid) {
  const tier = String(member.tier || 'C').replace(/[+-]/g, '').toUpperCase();
  const evidence = [];
  const careerContext = member.uid ? careerByUid.get(String(member.uid)) : null;

  const broad = (config.broadQueries || []).slice(0, Number(config.broadQueryCount || 3));
  for (const spec of broad) evidence.push(await runQuery(member, spec, config, 'broad'));

  const initialCoverage = coverageFromEvidence(evidence, config);
  const followups = chooseFollowups(initialCoverage, config, tier);
  for (const spec of followups) evidence.push(await runQuery(member, spec, config, 'targeted'));
  const finalCoverage = coverageFromEvidence(evidence, config);

  return {
    schema: config.output?.schema || 'idol_attribute_evidence_candidates_v2',
    collected_at: new Date().toISOString(),
    member: {
      uid: member.uid || null,
      name: member.name,
      group: member.group || '',
      tier: member.tier || 'C',
      age: member.age ?? null,
      height_cm: member.height_cm ?? null,
      career_months: member.career_months ?? null,
      prior_group_months: member.prior_group_months ?? careerContext?.prior_group_months ?? null,
      career_history: member.career_history ?? careerContext?.career_history ?? [],
      training_background: member.training_background ?? null,
    },
    search_summary: {
      broad_queries: broad.length,
      targeted_queries: followups.length,
      total_queries: broad.length + followups.length,
      initial_coverage: initialCoverage,
      final_coverage: finalCoverage,
    },
    evidence,
  };
}

async function main() {
  const [config, members, careerByUid] = await Promise.all([
    readJson(configPath),
    loadMembers(),
    loadCareerContext(),
  ]);
  const outputDir = args.out || config.output?.defaultDir || 'support/data/idol-attribute-evidence';
  await fs.mkdir(outputDir, { recursive: true });

  for (const member of members) {
    const record = await collectMember(member, config, careerByUid);
    const filename = `${slugify(member.group)}__${slugify(member.name)}.json`;
    const outputPath = path.join(outputDir, filename);
    await fs.writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, 'utf8');
    console.log(`${outputPath} (${record.search_summary.total_queries} searches, ${record.member.career_history.length} career segments)`);
  }
}

main().catch(err => {
  console.error(err);
  process.exitCode = 1;
});
