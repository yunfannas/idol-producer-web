/**
 * Staff-team collective estimates for Attribute V2 (S3 audition knowledge layer).
 */

import type { AttributeV2Key } from "./attributeV2";
import {
  allAttributeV2Keys,
  attributeV2Value,
  baseSpreadFor,
  getAttributeV2Truth,
  type AttributeV2,
} from "./attributeV2";
import type { PersistedIdolAttributes } from "./idolAttributes";
import { normalizePersistedAttributes } from "./idolAttributes";
import { sha256BytesUtf8 } from "./sha256sync";

export interface StaffAttributeEstimate {
  /** Staff panel midpoint (may differ from truth). */
  estimate: number;
  low: number;
  high: number;
  /** 0–1 observation confidence; higher = tighter range. */
  confidence: number;
}

export type StaffKnowledgeRow = Partial<Record<AttributeV2Key, StaffAttributeEstimate>>;

export interface CandidateStaffKnowledge {
  idol_uid: string;
  attributes: StaffKnowledgeRow;
  /** Free-text hints from interviews / reports (not auto-synced to numbers). */
  trait_hints: string[];
  interview_count: number;
  last_interview_iso: string | null;
}

function noiseSigned(seed: string, scale: number): number {
  const bytes = sha256BytesUtf8(seed);
  const u = ((bytes[2] << 8) | bytes[3]) / 0xffff;
  return (u * 2 - 1) * scale;
}

function clampStat(n: number): number {
  return Math.max(0, Math.min(20, Math.round(n)));
}

function spreadAtConfidence(key: AttributeV2Key, confidence: number): number {
  const c = Math.max(0, Math.min(1, confidence));
  return Math.max(1, Math.round(baseSpreadFor(key) * (1.35 - c * 0.85)));
}

/** Seed staff estimates from hidden truth + observability (opening camp baseline). */
export function seedStaffKnowledgeForCandidate(
  idolUid: string,
  row: Record<string, unknown>,
  openingIso: string,
): CandidateStaffKnowledge {
  const v1 = row.attributes ? normalizePersistedAttributes(row.attributes) : undefined;
  const truth = getAttributeV2Truth(row, v1);
  const attributes: StaffKnowledgeRow = {};
  for (const key of allAttributeV2Keys()) {
    attributes[key] = estimateFromTruth(idolUid, key, truth, 0.08, openingIso);
  }
  return {
    idol_uid: idolUid,
    attributes,
    trait_hints: [],
    interview_count: 0,
    last_interview_iso: null,
  };
}

function estimateFromTruth(
  idolUid: string,
  key: AttributeV2Key,
  truth: AttributeV2,
  confidence: number,
  seedExtra: string,
): StaffAttributeEstimate {
  const trueVal = attributeV2Value(truth, key);
  const spread = spreadAtConfidence(key, confidence);
  const bias = noiseSigned(`staff|${idolUid}|${key}|${seedExtra}`, spread * 0.45);
  const estimate = clampStat(trueVal + bias);
  const half = spreadAtConfidence(key, confidence);
  return {
    estimate,
    low: clampStat(estimate - half),
    high: clampStat(estimate + half),
    confidence,
  };
}

/** Apply 45-minute interview: narrow 1–2 attributes + optional trait hint. */
export function applyInterviewKnowledgeBump(
  knowledge: CandidateStaffKnowledge,
  truth: AttributeV2,
  interviewIso: string,
): { knowledge: CandidateStaffKnowledge; focusedKeys: AttributeV2Key[]; traitHint: string | null } {
  const keys = pickInterviewFocusKeys(knowledge.idol_uid, interviewIso);
  const next: CandidateStaffKnowledge = {
    ...knowledge,
    attributes: { ...knowledge.attributes },
    trait_hints: [...(knowledge.trait_hints ?? [])],
    interview_count: (knowledge.interview_count ?? 0) + 1,
    last_interview_iso: interviewIso,
  };

  for (const key of keys) {
    const prev = next.attributes[key];
    const prevConf = prev?.confidence ?? 0.08;
    const newConf = Math.min(0.72, prevConf + 0.12);
    next.attributes[key] = estimateFromTruth(knowledge.idol_uid, key, truth, newConf, `iv|${interviewIso}|${key}`);
  }

  const traitHint = pickTraitHint(knowledge.idol_uid, truth, interviewIso);
  if (traitHint && !next.trait_hints.includes(traitHint)) {
    next.trait_hints.push(traitHint);
  }

  return { knowledge: next, focusedKeys: keys, traitHint };
}

function pickInterviewFocusKeys(idolUid: string, iso: string): AttributeV2Key[] {
  const pool: AttributeV2Key[] = ["talking", "wit", "pitch", "stage_presence", "teamwork", "humor"];
  const bytes = sha256BytesUtf8(`iv-focus|${idolUid}|${iso}`);
  const i0 = bytes[0] % pool.length;
  let i1 = bytes[1] % pool.length;
  if (i1 === i0) i1 = (i1 + 1) % pool.length;
  return [pool[i0], pool[i1]];
}

function pickTraitHint(idolUid: string, truth: AttributeV2, iso: string): string | null {
  const hints: { min: number; key: AttributeV2Key; text: string }[] = [
    { min: 14, key: "stage_presence", text: "Staff note: strong center-stage aspiration in conversation." },
    { min: 13, key: "wit", text: "Staff note: picks up choreography cues unusually fast in discussion." },
    { min: 14, key: "talking", text: "Staff note: comfortable on mic; variety-show potential." },
    { min: 13, key: "creativity", text: "Staff note: self-directed ideas about concept and styling." },
    { min: 14, key: "humor", text: "Staff note: natural comedic timing when relaxed." },
  ];
  const bytes = sha256BytesUtf8(`trait|${idolUid}|${iso}`);
  for (let attempt = 0; attempt < hints.length; attempt++) {
    const h = hints[(bytes[attempt] ?? 0) % hints.length];
    if (attributeV2Value(truth, h.key) >= h.min) return h.text;
  }
  return "Staff note: cooperative in interview; no strong trait signal yet.";
}

export function formatEstimateRange(est: StaffAttributeEstimate): string {
  if (est.low === est.high) return String(est.estimate);
  return `${est.low}–${est.high} (~${est.estimate})`;
}
