#!/usr/bin/env node
/**
 * Generate V2 idol attributes from evidence, rather than a member-name score table.
 *
 * Input layers:
 *   1. collector-ready member context (tier / career / prior groups)
 *   2. search-evidence bundles
 *   3. score-free, structured performance observations
 *
 * It writes only when --out is supplied. This makes calibration runs safe to inspect
 * before they replace a generated artifact.
 *
 * Usage:
 *   node support/scripts/generateIdolAttributesFromEvidence.mjs \
 *     --input support/data/member-attribute-input-pilot3.json \
 *     --evidence-dir support/data/idol-attribute-evidence \
 *     --performance-evidence support/data/member-performance-evidence.json \
 *     --group "アキシブproject" --verify
 */
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const TIER_BASE = { S: 17, A: 16, B: 16, C: 15, D: 15, E: 14 };
const VOCAL_CLAIM_TERMS = ['歌うま', '歌が上手', '歌唱力', '歌姫', '生歌', 'ボーカル', '安定感'];
const DANCE_TERMS = ['ダンスが上手', 'ダンス歴', '振付', 'チア', 'バレエ', 'キレ'];
const STAGE_TERMS = ['ステージ映え', '目を引く', '圧倒', '存在感', '表現力'];
const MODEL_TERMS = ['モデル', '雑誌', 'ランウェイ', 'nicola', 'ブランド'];
const TALK_TERMS = ['MC', '司会', '進行', 'トーク力', 'ムードメーカー'];
const HUMOR_TERMS = ['面白い', 'お笑い', 'ボケ', 'ツッコミ'];
const LEADER_TERMS = ['リーダー', 'キャプテン', 'まとめ役'];
const EFFORT_TERMS = ['努力家', '負けず嫌い', '真面目'];
const CENTER_TERMS = ['センター', 'center', 'エース', '顔'];
const NOTED_TERMS = ['注目', '話題', 'バズ', '大反響', 'ソロ曲'];
const VOCAL_ROLE_TERMS = ['歌担', '歌唱担当', 'ボーカル担当', 'メインボーカル', '主唱'];

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (next == null || next.startsWith('--')) out[key] = true;
    else {
      out[key] = next;
      i += 1;
    }
  }
  return out;
}

function numberOr(value, fallback = 0) {
  return Number.isFinite(Number(value)) ? Number(value) : fallback;
}

function clamp(value) {
  return Math.max(0, Math.min(20, Math.round(value)));
}

function stableOffset(uid, label) {
  const digest = crypto.createHash('sha256').update(`${uid}:${label}`, 'utf8').digest();
  return (digest[0] % 3) - 1;
}

function includesAny(text, terms) {
  return terms.some((term) => text.includes(term));
}

function memberScopedText(item, memberName) {
  const title = String(item?.title || '');
  const description = String(item?.description || '');
  const needle = String(memberName || '').toLowerCase();
  const lowerDescription = description.toLowerCase();
  const index = lowerDescription.indexOf(needle);
  // Many result snippets concatenate bios for an entire group. Attribute evidence
  // must come from the member's local passage, not a neighbouring member's bio.
  if (index >= 0) return description.slice(Math.max(0, index - 240), index + 900).toLowerCase();
  return title.toLowerCase();
}

function distinctMemberResults(bundle, member) {
  const seen = new Set();
  const memberName = String(member.name || '').toLowerCase();
  const rows = [];
  for (const evidence of bundle?.evidence || []) {
    for (const result of evidence?.results || []) {
      const fullText = `${result?.title || ''}\n${result?.description || ''}`.toLowerCase();
      // Search-result snippets that never mention the member are common false positives.
      if (!memberName || !fullText.includes(memberName)) continue;
      const text = memberScopedText(result, memberName);
      const identity = String(result.url || `${result.title || ''}\n${result.description || ''}`).trim();
      if (!identity || seen.has(identity)) continue;
      seen.add(identity);
      rows.push({
        text,
        source_class: String(result.source_class || 'unclassified'),
        relevance: numberOr(result.relevance_score),
        title: String(result.title || ''),
      });
    }
  }
  return rows;
}

function directMentionCount(results, terms) {
  return results.filter((row) => row.relevance > 0 && includesAny(row.text, terms)).length;
}

function careerContext(member) {
  const careerMonths = numberOr(member.career_months);
  const prior = numberOr(member.prior_group_months);
  const currentGroup = numberOr(member.current_group_months, careerMonths);
  const incomplete = Array.isArray(member.incomplete_prior_groups) && member.incomplete_prior_groups.length > 0;
  return {
    current_group_months: currentGroup,
    // `career_months` is the de-duplicated total emitted by the builder; prior
    // months are a subset, so adding them again would double-count a career.
    known_months: Math.max(careerMonths, currentGroup + prior),
    has_incomplete_prior_group: incomplete,
  };
}

function successfulVocalFacts(facts) {
  return facts.filter((fact) => {
    if (fact?.domain !== 'vocal') return false;
    const song = numberOr(fact.song_vocal_difficulty, -1);
    const part = numberOr(fact.assigned_vocal_difficulty, -1);
    const completedWell = String(fact.completion || '').toLowerCase() === 'well';
    return completedWell && part >= song + 2;
  });
}

function referenceFactsFor(member, allFacts) {
  return allFacts.filter((fact) => String(fact?.member_uid ?? '') === String(member.uid ?? ''));
}

function dedupeFacts(facts) {
  const seen = new Set();
  return facts.filter((fact) => {
    const key = [fact?.member_uid, fact?.domain, fact?.song_uid, fact?.assigned_vocal_difficulty, fact?.completion].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function parseIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function groupRepertoireProfile(member, songs) {
  const referenceDate = parseIsoDay(member.career_reference_date);
  const currentStart = parseIsoDay(member.current_group_start_date);
  if (!referenceDate || !currentStart || !Array.isArray(songs)) {
    return { song_count: 0, mean_vocal_difficulty: null, mean_dance_difficulty: null, mean_reception: null, supports_baseline: false };
  }
  const relevant = songs.filter((song) => {
    const release = parseIsoDay(song?.release_date);
    return song?.group_name === member.group && release && release >= currentStart && release <= referenceDate
      && Number.isFinite(Number(song.vocal_difficulty)) && Number.isFinite(Number(song.dance_difficulty));
  });
  const meanOf = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  const reception = relevant
    .map((song) => Number.isFinite(Number(song.popularity_local)) ? Number(song.popularity_local) : numberOr(song.popularity, NaN))
    .filter(Number.isFinite);
  const meanVocal = meanOf(relevant.map((song) => Number(song.vocal_difficulty)));
  const meanDance = meanOf(relevant.map((song) => Number(song.dance_difficulty)));
  const meanReception = meanOf(reception);
  return {
    song_count: relevant.length,
    mean_vocal_difficulty: meanVocal == null ? null : +meanVocal.toFixed(2),
    mean_dance_difficulty: meanDance == null ? null : +meanDance.toFixed(2),
    mean_reception: meanReception == null ? null : +meanReception.toFixed(2),
    // Group repertoire never proves an individual's ceiling. It establishes only
    // that a sufficiently tenured participant has a normal professional floor.
    supports_baseline: relevant.length >= 3
      && (meanVocal >= 13.5 || meanDance >= 14)
      && meanReception != null && meanReception >= 2,
  };
}

function applyDPerformanceCenter(attrs, target, uid) {
  const low = Math.floor(target);
  const high = Math.ceil(target);
  attrs.performance.pitch = low;
  attrs.performance.tone = high;
  attrs.performance.breath = low;
  attrs.performance.rhythm = high;
  // Integer stats cannot express 14.5 per idol. Alternate two equally plausible
  // dance shapes so the cohort converges to its intended centre without clones.
  if (stableOffset(uid, 'd-tier-dance-shape') >= 0) {
    attrs.performance.power = low;
    attrs.performance.stage_presence = high;
  } else {
    attrs.performance.power = high;
    attrs.performance.stage_presence = low;
  }
}

function attributesFor(member, bundle, facts, repertoire) {
  const uid = String(member.uid || `${member.group}:${member.name}`);
  const base = TIER_BASE[String(member.tier || 'C').toUpperCase()] ?? TIER_BASE.C;
  const age = Number.isFinite(Number(member.age)) ? Number(member.age) : null;
  const height = Number.isFinite(Number(member.height_cm)) ? Number(member.height_cm) : null;
  const career = careerContext(member);
  const results = distinctMemberResults(bundle, member);
  const signals = {
    vocal_claims: directMentionCount(results, VOCAL_CLAIM_TERMS),
    dance_claims: directMentionCount(results, DANCE_TERMS),
    stage_claims: directMentionCount(results, STAGE_TERMS),
    model_claims: directMentionCount(results, MODEL_TERMS),
    talk_claims: directMentionCount(results, TALK_TERMS),
    humor_claims: directMentionCount(results, HUMOR_TERMS),
    leader_claims: directMentionCount(results, LEADER_TERMS),
    effort_claims: directMentionCount(results, EFFORT_TERMS),
    center_claims: directMentionCount(results, CENTER_TERMS),
    noted_claims: directMentionCount(results, NOTED_TERMS),
    vocal_role_claims: directMentionCount(results, VOCAL_ROLE_TERMS),
  };

  const professionalFloor = career.known_months >= 96 ? 16
    : career.known_months >= 24 ? 15
      : career.known_months >= 6 || career.has_incomplete_prior_group ? 14
        : 13;
  const ageCute = age != null && age <= 16 ? 1 : 0;
  const agePretty = age != null && age >= 26 ? 1 : age != null && age >= 22 ? 0.5 : 0;
  const heightPretty = height != null && height >= 165 ? 1 : height != null && height >= 159 ? 0.5 : 0;
  const heightCute = height != null && height < 153 ? 0.5 : 0;

  const attrs = {
    physical: {
      agility: clamp(base + stableOffset(uid, 'agility')),
      natural_fitness: clamp(base + stableOffset(uid, 'natural_fitness')),
      stamina: clamp(Math.max(base + stableOffset(uid, 'stamina'), professionalFloor)),
    },
    appearance: {
      cute: clamp(base + ageCute + heightCute + stableOffset(uid, 'cute')),
      pretty: clamp(base + agePretty + heightPretty + stableOffset(uid, 'pretty')),
    },
    performance: {
      pitch: clamp(base + stableOffset(uid, 'pitch')),
      tone: clamp(base + stableOffset(uid, 'tone')),
      breath: clamp(Math.max(base + stableOffset(uid, 'breath'), professionalFloor)),
      rhythm: clamp(Math.max(base + stableOffset(uid, 'rhythm'), professionalFloor)),
      power: clamp(base + stableOffset(uid, 'power')),
      stage_presence: clamp(Math.max(base + stableOffset(uid, 'stage_presence'), professionalFloor)),
    },
    mental: {
      wit: clamp(base + stableOffset(uid, 'wit')),
      humor: clamp(base + stableOffset(uid, 'humor')),
      talking: clamp(Math.max(base + stableOffset(uid, 'talking'), professionalFloor)),
      teamwork: clamp(Math.max(base + stableOffset(uid, 'teamwork'), professionalFloor)),
      fashion: clamp(base + agePretty + heightPretty + stableOffset(uid, 'fashion')),
      creativity: clamp(base + stableOffset(uid, 'creativity')),
    },
    hidden: {
      professionalism: clamp(Math.max(base, professionalFloor) + (signals.effort_claims ? 1 : 0)),
      ambition: clamp(base + (signals.effort_claims ? 1 : 0)),
      sensitivity: clamp(base + stableOffset(uid, 'sensitivity')),
    },
  };

  const isDTier = String(member.tier || '').toUpperCase() === 'D';
  const hasLongCurrentTenure = career.current_group_months >= 12;
  const groupSupportsShorterTenure = career.current_group_months >= 6 && repertoire.supports_baseline;
  if (isDTier && (hasLongCurrentTenure || groupSupportsShorterTenure)) {
    const publicFocus = signals.center_claims > 0 || signals.noted_claims > 0;
    applyDPerformanceCenter(attrs, publicFocus ? 15.5 : 14.5, uid);
  }

  if (signals.dance_claims) {
    attrs.physical.agility = clamp(attrs.physical.agility + 1);
    attrs.performance.rhythm = clamp(attrs.performance.rhythm + 1);
    attrs.performance.power = clamp(attrs.performance.power + 1);
  }
  if (signals.stage_claims) {
    // A single explicit performance description can support 17–18, never 19–20.
    attrs.performance.stage_presence = Math.min(18, clamp(attrs.performance.stage_presence + 1));
  }
  if (signals.model_claims) {
    attrs.appearance.pretty = clamp(attrs.appearance.pretty + 1);
    attrs.mental.fashion = clamp(attrs.mental.fashion + 2);
  }
  if (signals.talk_claims) attrs.mental.talking = clamp(attrs.mental.talking + 1);
  if (signals.humor_claims) {
    attrs.mental.humor = clamp(attrs.mental.humor + 1);
    attrs.mental.wit = clamp(attrs.mental.wit + 1);
  }
  if (signals.leader_claims) {
    attrs.mental.teamwork = clamp(Math.max(attrs.mental.teamwork, professionalFloor) + 1);
    attrs.mental.talking = clamp(Math.max(attrs.mental.talking, professionalFloor) + 1);
  }

  const successfulParts = successfulVocalFacts(facts);
  const repeatedVocalFloor = signals.vocal_claims >= 5 ? 18 : signals.vocal_claims >= 3 ? 17 : 0;
  if (repeatedVocalFloor) {
    for (const stat of ['pitch', 'tone', 'breath', 'rhythm']) {
      attrs.performance[stat] = Math.max(attrs.performance[stat], repeatedVocalFloor);
    }
  }
  if (successfulParts.length) {
    // The fact determines a domain floor. It does not carry a member score.
    const floor = Math.min(20, Math.max(...successfulParts.map((fact) => numberOr(fact.assigned_vocal_difficulty) + 1)));
    for (const stat of ['pitch', 'tone', 'breath', 'rhythm']) {
      attrs.performance[stat] = Math.max(attrs.performance[stat], floor);
    }
  }
  if ((signals.vocal_claims || signals.vocal_role_claims) && !repeatedVocalFloor) {
    attrs.performance.pitch = clamp(attrs.performance.pitch + 1);
    attrs.performance.tone = clamp(attrs.performance.tone + 1);
    // A direct "歌うま"-class claim is differentiated from merely enjoying singing.
    attrs.performance.breath = clamp(attrs.performance.breath + (successfulParts.length ? 2 : 1));
  }

  const traits = {
    singer: Math.min(400, 40 + successfulParts.length * 40 + (signals.vocal_claims + signals.vocal_role_claims) * 40),
    dancer: Math.min(400, 40 + signals.dance_claims * 60),
    model: Math.min(400, 40 + signals.model_claims * 70),
    comedy: Math.min(400, 40 + signals.humor_claims * 60),
  };
  return { attrs, traits, signals, successfulParts, professionalFloor, career, repertoire };
}

function scoreOf(attrs) {
  const physical = attrs.physical;
  const appearance = attrs.appearance;
  const performance = attrs.performance;
  const mental = attrs.mental;
  const radar = {
    PHY: +((physical.agility + physical.natural_fitness + physical.stamina) / 3).toFixed(2),
    APP: +(((Math.max(appearance.cute, appearance.pretty) + Math.min(appearance.cute, appearance.pretty) / 4) / 5) * 4).toFixed(2),
    SNG: +((performance.pitch + performance.tone + performance.breath + performance.rhythm) / 4).toFixed(2),
    DAN: +((performance.rhythm + performance.power + performance.stage_presence) / 3).toFixed(2),
    MEN: +((mental.wit + mental.humor + mental.talking + mental.teamwork + mental.fashion + mental.creativity) / 6).toFixed(2),
  };
  const raw =
    ((physical.agility + physical.natural_fitness + physical.stamina) / 12) * 3
    + Math.max(appearance.cute, appearance.pretty) + Math.min(appearance.cute, appearance.pretty) / 4
    + (performance.pitch + performance.tone + performance.breath + performance.rhythm + performance.power + performance.stage_presence) / 3
    + (mental.wit + mental.humor + mental.talking + mental.teamwork + mental.fashion + mental.creativity) / 6;
  return { radar, ability_raw: +raw.toFixed(3), ability: Math.floor(raw) };
}

function auditFor(member, derived) {
  const highConfidence = derived.successfulParts.map((fact) =>
    `${fact.song_title || 'performance'}: completed vocal part ${fact.assigned_vocal_difficulty} vs song average ${fact.song_vocal_difficulty}`);
  if (derived.signals.vocal_claims) highConfidence.push('direct member-specific vocal-performance claim in search evidence');
  const procedural = [`professional-basics floor=${derived.professionalFloor}`];
  if (derived.repertoire.song_count) {
    procedural.push(`current-group repertoire: n=${derived.repertoire.song_count}, vocal=${derived.repertoire.mean_vocal_difficulty}, dance=${derived.repertoire.mean_dance_difficulty}, reception=${derived.repertoire.mean_reception}`);
  }
  if (derived.career.has_incomplete_prior_group) procedural.push('incomplete prior group retained without inventing duration');
  return {
    evidence_summary: {
      high_confidence: highConfidence,
      medium_confidence: [],
      procedural_only: procedural,
    },
    constraints_applied: {
      ranges: derived.successfulParts.length ? ['successful harder-than-song-average vocal part raises the singing cluster floor'] : [],
      ranks: [],
      floors: derived.successfulParts.length
        ? [`SNG >= ${Math.max(...derived.successfulParts.map((fact) => numberOr(fact.assigned_vocal_difficulty) + 1))} from verified part completion`]
        : [],
      biases: Object.entries(derived.signals)
        .filter(([, count]) => count > 0)
        .map(([signal, count]) => `${signal}=${count}`),
    },
    career_context_used: [
      `known professional months=${derived.career.known_months}`,
      ...(derived.repertoire.supports_baseline ? ['current-group repertoire supports a normal D-tier performance baseline'] : []),
      ...(derived.career.has_incomplete_prior_group ? ['prior-group experience exists but duration is unknown'] : []),
    ],
  };
}

async function main() {
  const args = parseArgs(process.argv);
  const inputPath = String(args.input || 'support/data/member-attribute-input-pilot3.json');
  const evidenceDir = String(args['evidence-dir'] || 'support/data/idol-attribute-evidence');
  const factsPath = String(args['performance-evidence'] || 'support/data/member-performance-evidence.json');
  const songsPath = String(args.songs || 'public/data/scenarios/scenario_6/songs.json');
  const groupFilter = String(args.group || '').trim();
  const [members, factDocument, evidenceFiles, songs] = await Promise.all([
    fs.readFile(inputPath, 'utf8').then(JSON.parse),
    fs.readFile(factsPath, 'utf8').then(JSON.parse),
    fs.readdir(evidenceDir),
    fs.readFile(songsPath, 'utf8').then(JSON.parse).catch((error) => {
      if (error?.code === 'ENOENT') return [];
      throw error;
    }),
  ]);
  const bundles = await Promise.all(
    evidenceFiles.filter((file) => file.endsWith('.json')).map(async (file) => {
      const raw = await fs.readFile(path.join(evidenceDir, file), 'utf8');
      return JSON.parse(raw);
    }),
  );
  const bundleByUid = new Map(bundles.map((bundle) => [String(bundle?.member?.uid ?? ''), bundle]));
  const allFacts = Array.isArray(factDocument?.evidence) ? factDocument.evidence : [];
  const generated = members
    .filter((member) => !groupFilter || member.group === groupFilter)
    .map((member) => {
      const bundle = bundleByUid.get(String(member.uid ?? '')) || { member, evidence: [] };
      const facts = dedupeFacts([
        ...referenceFactsFor(member, allFacts),
        ...(Array.isArray(member.performance_evidence) ? member.performance_evidence : []),
      ]);
      const derived = attributesFor(member, bundle, facts, groupRepertoireProfile(member, songs));
      const scored = scoreOf(derived.attrs);
      return {
        schema: 'idol_attribute_generation_v2',
        member: {
          uid: member.uid || null,
          name: member.name,
          group: member.group,
          tier: member.tier,
        },
        attributes: derived.attrs,
        traits: derived.traits,
        performance_evidence_used: derived.successfulParts,
        ...scored,
        ...auditFor(member, derived),
      };
    })
    .sort((a, b) => String(a.member.name).localeCompare(String(b.member.name), 'ja'));

  if (args.verify) {
    for (const row of generated) {
      const facts = row.performance_evidence_used;
      if (!facts.length) continue;
      const expectedFloor = Math.max(...facts.map((fact) => numberOr(fact.assigned_vocal_difficulty) + 1));
      if (row.radar.SNG < expectedFloor) {
        throw new Error(`${row.member.name}: SNG ${row.radar.SNG} violated evidence floor ${expectedFloor}`);
      }
    }
  }

  const report = {
    schema: 'idol_attribute_generation_batch_v2',
    input: { inputPath, evidenceDir, factsPath, songsPath, groupFilter: groupFilter || null },
    note: 'Derived from evidence facts and generic rules; no member-name score table or Ability target is used.',
    members: generated,
  };
  if (args.out) {
    const outPath = String(args.out);
    await fs.mkdir(path.dirname(outPath), { recursive: true });
    await fs.writeFile(outPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
    console.log(`wrote ${generated.length} members to ${outPath}`);
  } else {
    for (const row of generated) {
      console.log(`${row.member.group} :: ${row.member.name} :: SNG ${row.radar.SNG.toFixed(2)} :: Ability ${row.ability}`);
    }
  }
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
