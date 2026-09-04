#!/usr/bin/env node
/**
 * Build collector-ready member context from the canonical catalog.
 *
 * Usage:
 *   node support/scripts/buildMemberAttributeInput.mjs \
 *     --group "アキシブproject" \
 *     --idols public/data/scenarios/scenario_6/idols.json \
 *     --groups public/data/scenarios/scenario_6/groups.json \
 *     --reference-date 2025-07-05 \
 *     --out support/data/member-attribute-input.json
 *
 * `career_months` is elapsed professional time with overlapping memberships
 * merged. `prior_group_months` only counts completed, dated memberships before
 * the selected group's active stint. Null/null aliases are deliberately ignored;
 * an end-dated row with an unknown start is retained as prior-group context but
 * never contributes invented career months.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

const MONTH_DAYS = 30.4375;

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

function usage() {
  return [
    'Use --group NAME_OR_UID --reference-date YYYY-MM-DD.',
    'Optional: --idols PATH --groups PATH --member NAME_OR_UID --performance-evidence PATH --out PATH.',
    'Without --out, JSON is printed to stdout and no file is written.',
  ].join('\n');
}

function isIsoDay(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDay(value) {
  return isIsoDay(value) ? value : null;
}

function dayNumber(iso) {
  return Date.parse(`${iso}T00:00:00Z`) / 86_400_000;
}

function monthCount(days) {
  return Math.round((days / MONTH_DAYS) * 10) / 10;
}

function groupMatches(entry, group) {
  const entryUid = String(entry?.group_uid ?? '').trim();
  const groupUid = String(group?.uid ?? '').trim();
  if (entryUid && groupUid) return entryUid === groupUid;
  return String(entry?.group_name ?? '').trim() === String(group?.name ?? '').trim();
}

function datedSegment(entry, referenceDate) {
  const start = isoDay(entry?.start_date);
  if (!start || start > referenceDate) return null;
  const rawEnd = entry?.end_date;
  if (rawEnd != null && rawEnd !== '' && !isIsoDay(rawEnd)) return null;
  const end = rawEnd ? rawEnd : referenceDate;
  const cappedEnd = end < referenceDate ? end : referenceDate;
  if (cappedEnd <= start) return null;
  return { start, end: cappedEnd, rawEnd: rawEnd || null };
}

function mergeDays(segments) {
  const ordered = [...segments]
    .map(({ start, end }) => ({ start: dayNumber(start), end: dayNumber(end) }))
    .sort((a, b) => a.start - b.start || a.end - b.end);
  let days = 0;
  let merged = null;
  for (const next of ordered) {
    if (!merged || next.start > merged.end) {
      if (merged) days += merged.end - merged.start;
      merged = { ...next };
    } else if (next.end > merged.end) {
      merged.end = next.end;
    }
  }
  if (merged) days += merged.end - merged.start;
  return days;
}

function ageOn(birthday, referenceDate, fallback) {
  if (!isIsoDay(birthday)) return Number.isFinite(Number(fallback)) ? Number(fallback) : null;
  const [birthYear, birthMonth, birthDay] = birthday.split('-').map(Number);
  const [year, month, day] = referenceDate.split('-').map(Number);
  return year - birthYear - (month < birthMonth || (month === birthMonth && day < birthDay) ? 1 : 0);
}

function historyLabel(entry, segment) {
  const name = String(entry.group_name ?? entry.group_uid ?? 'Unknown group').trim();
  const end = entry.end_date || 'present';
  return `${name} (${segment.start}–${end})`;
}

function groupIdentity(entry) {
  const uid = String(entry?.group_uid ?? '').trim();
  if (uid) return `uid:${uid.toLowerCase()}`;
  return `name:${String(entry?.group_name ?? '').trim().toLowerCase()}`;
}

function incompleteHistoryLabel(entry) {
  const name = String(entry.group_name ?? entry.group_uid ?? 'Unknown group').trim();
  return `${name} (start unknown–${entry.end_date})`;
}

function performanceFactsFor(memberUid, allFacts) {
  return allFacts
    .filter((fact) => String(fact?.member_uid ?? '') === String(memberUid ?? ''))
    .filter((fact) => fact?.domain === 'vocal' || fact?.domain === 'dance')
    .map((fact) => ({
      domain: fact.domain,
      song_uid: typeof fact.song_uid === 'string' ? fact.song_uid : null,
      song_title: typeof fact.song_title === 'string' ? fact.song_title : null,
      song_vocal_difficulty: Number.isFinite(Number(fact.song_vocal_difficulty))
        ? Number(fact.song_vocal_difficulty)
        : null,
      assigned_vocal_difficulty: Number.isFinite(Number(fact.assigned_vocal_difficulty))
        ? Number(fact.assigned_vocal_difficulty)
        : null,
      completion: typeof fact.completion === 'string' ? fact.completion : null,
      evidence_class: typeof fact.evidence_class === 'string' ? fact.evidence_class : null,
      note: typeof fact.note === 'string' ? fact.note : null,
    }));
}

function buildMember(idol, targetGroup, referenceDate, allPerformanceFacts = []) {
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  const allDated = history
    .map((entry) => ({ entry, segment: datedSegment(entry, referenceDate) }))
    .filter(({ segment }) => segment);
  const activeTarget = allDated
    // A member who leaves after the reference date was still active at that date.
    .filter(({ entry }) => groupMatches(entry, targetGroup)
      && (!entry.end_date || entry.end_date >= referenceDate))
    .sort((a, b) => b.segment.start.localeCompare(a.segment.start))[0];
  if (!activeTarget) return null;

  const currentStart = activeTarget.segment.start;
  const priorRows = allDated
    .filter(({ entry, segment }) => {
      if (groupMatches(entry, targetGroup)) return false;
      return Boolean(entry.end_date) && segment.end <= currentStart;
    });
  const priorGroups = priorRows
    .map(({ entry, segment }) => ({
      group_name: String(entry.group_name ?? '').trim() || null,
      group_uid: String(entry.group_uid ?? '').trim() || null,
      start_date: segment.start,
      end_date: segment.end,
      months: monthCount(dayNumber(segment.end) - dayNumber(segment.start)),
    }))
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const incompleteGroupKeys = new Set();
  const incompletePriorGroups = history
    .filter((entry) => {
      if (groupMatches(entry, targetGroup)) return false;
      const start = isoDay(entry.start_date);
      const end = isoDay(entry.end_date);
      return !start && Boolean(end) && end <= currentStart;
    })
    .map((entry) => ({
      group_name: String(entry.group_name ?? '').trim() || null,
      group_uid: String(entry.group_uid ?? '').trim() || null,
      start_date: null,
      end_date: isoDay(entry.end_date),
      date_status: 'start_unknown',
    }))
    .filter((entry) => {
      const key = groupIdentity(entry);
      if (incompleteGroupKeys.has(key)) return false;
      incompleteGroupKeys.add(key);
      return true;
    })
    .sort((a, b) => a.end_date.localeCompare(b.end_date));
  const priorDays = mergeDays(priorGroups.map((entry) => ({ start: entry.start_date, end: entry.end_date })));
  const allDays = mergeDays(allDated.map(({ segment }) => segment));
  const height = Number(idol.height_cm ?? idol.height);
  const careerSummary = [
    ...incompletePriorGroups.map(incompleteHistoryLabel),
    ...allDated
      .sort((a, b) => a.segment.start.localeCompare(b.segment.start))
      .map(({ entry, segment }) => historyLabel(entry, segment)),
  ].join('; ');

  return {
    uid: idol.uid || null,
    name: idol.name || '',
    group: targetGroup.name || '',
    tier: targetGroup.letter_tier || 'C',
    age: ageOn(idol.birthday, referenceDate, idol.age),
    height_cm: Number.isFinite(height) ? height : null,
    career_months: monthCount(allDays),
    prior_group_months: monthCount(priorDays),
    current_group_start_date: currentStart,
    current_group_months: monthCount(dayNumber(referenceDate) - dayNumber(currentStart)),
    career_reference_date: referenceDate,
    prior_groups: priorGroups,
    incomplete_prior_groups: incompletePriorGroups,
    career_summary: careerSummary,
    // Facts deliberately carry performance observations, never target attributes.
    performance_evidence: performanceFactsFor(idol.uid, allPerformanceFacts),
    training_background: null,
  };
}

async function readJson(file) {
  return JSON.parse(await fs.readFile(file, 'utf8'));
}

async function main() {
  const args = parseArgs(process.argv);
  const groupArg = String(args.group || '').trim();
  const referenceDate = String(args['reference-date'] || '').trim();
  if (!groupArg || !isIsoDay(referenceDate)) throw new Error(usage());

  const idolsPath = args.idols || 'public/data/idols.json';
  const groupsPath = args.groups || 'public/data/groups.json';
  const performanceEvidencePath = args['performance-evidence'] || 'support/data/member-performance-evidence.json';
  const [idols, groups, performanceEvidenceDocument] = await Promise.all([
    readJson(idolsPath),
    readJson(groupsPath),
    readJson(performanceEvidencePath),
  ]);
  const allPerformanceFacts = Array.isArray(performanceEvidenceDocument?.evidence)
    ? performanceEvidenceDocument.evidence
    : [];
  const targetGroup = groups.find((group) => String(group.uid ?? '') === groupArg || String(group.name ?? '') === groupArg);
  if (!targetGroup) throw new Error(`No group found for ${JSON.stringify(groupArg)} in ${groupsPath}`);

  const memberArg = String(args.member || '').trim();
  const selected = idols.filter((idol) => {
    if (memberArg && String(idol.uid ?? '') !== memberArg && String(idol.name ?? '') !== memberArg) return false;
    return buildMember(idol, targetGroup, referenceDate, allPerformanceFacts) != null;
  });
  if (memberArg && selected.length === 0) {
    throw new Error(`No active ${targetGroup.name} member matched ${JSON.stringify(memberArg)} at ${referenceDate}`);
  }

  const output = selected
    .map((idol) => buildMember(idol, targetGroup, referenceDate, allPerformanceFacts))
    .filter(Boolean)
    .sort((a, b) => String(a.name).localeCompare(String(b.name), 'ja'));
  const json = `${JSON.stringify(output, null, 2)}\n`;
  if (args.out) {
    await fs.mkdir(path.dirname(args.out), { recursive: true });
    await fs.writeFile(args.out, json, 'utf8');
    console.log(`${args.out} (${output.length} members)`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exitCode = 1;
});
