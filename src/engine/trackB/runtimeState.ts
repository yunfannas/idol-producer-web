import { normalizePersistedAttributes } from "../idolAttributes";
import type { GameSavePayload } from "../../save/gameSaveSchema";
import { getLetterTierFromGroup, getPrimaryGroup } from "../../save/gameSaveSchema";
import { financeAudienceProfileForGroup } from "../financeSystem";
import type { LetterTier } from "../types";
import { toBaseTier } from "../types";
import type { ActiveIssue, AttributesV2, GroupStrategyState, MemberRuntimeState, SongWorkProfile, StaffPackageState, TrackBState, TraitDomain, VisibleAttributeV2 } from "./types";

export function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : fallback;
}
export function isoDatePart(value: unknown): string { return String(value ?? "").split("T")[0] || "2020-01-01"; }
export function weekdayUtc(iso: string): number { return new Date(`${isoDatePart(iso)}T12:00:00Z`).getUTCDay(); }
export function isSundayUtc(iso: string): boolean { return weekdayUtc(iso) === 0; }
export function monthKey(iso: string): string { return isoDatePart(iso).slice(0, 7); }
export function clampStat(n: number): number { return clamp(Math.round(n), 0, 20); }

export function mapLegacyAttributesToV2(idol: Record<string, unknown>): AttributesV2 {
  const a = normalizePersistedAttributes(idol.attributes);
  const e = idol.attributes_v2 && typeof idol.attributes_v2 === "object" ? idol.attributes_v2 as Record<string, unknown> : {};
  return {
    agility: clampStat(num(e.agility, a.physical.agility)), natural_fitness: clampStat(num(e.natural_fitness, a.physical.natural_fitness)), stamina: clampStat(num(e.stamina, a.physical.stamina)),
    cute: clampStat(num(e.cute, a.appearance.cute)), pretty: clampStat(num(e.pretty, a.appearance.pretty)),
    pitch: clampStat(num(e.pitch, a.technical.pitch)), tone: clampStat(num(e.tone, a.technical.tone)), breath: clampStat(num(e.breath, a.technical.breath)),
    rhythm: clampStat(num(e.rhythm, a.technical.rhythm)), power: clampStat(num(e.power, a.technical.power)), stage_presence: clampStat(num(e.stage_presence, a.technical.stage_presence)),
    wit: clampStat(num(e.wit, a.mental.wit)), humor: clampStat(num(e.humor, a.mental.humor)), talking: clampStat(num(e.talking, a.mental.talking)),
    teamwork: clampStat(num(e.teamwork, a.mental.teamwork)), fashion: clampStat(num(e.fashion, a.mental.fashion)), creativity: clampStat(num(e.creativity, a.mental.creativity)),
  };
}

export function staminaLoadMultiplier(stamina: number): number {
  if (stamina >= 20) return 0.68; if (stamina >= 19) return 0.72; if (stamina >= 18) return 0.76;
  if (stamina >= 17) return 0.81; if (stamina >= 16) return 0.87; if (stamina >= 15) return 0.93;
  if (stamina >= 14) return 1; if (stamina >= 12) return 1.16; return 1.3;
}

/** Locked curve with depletion, not a second fatigue state. */
export function conditionCostAmplifier(condition: number): number {
  const depletion = 100 - clamp(condition, 0, 100);
  return 0.62 + 0.0025 * depletion + 0.75 / (1 + Math.exp(-(depletion - 67) / 10));
}

export function conditionPenalty(condition: number): number {
  const c = clamp(condition, 0, 100);
  if (c >= 80) return 0;
  if (c >= 70) return (80 - c) * 0.02;
  if (c >= 60) return 0.2 + (70 - c) * 0.03;
  if (c >= 50) return 0.5 + (60 - c) * 0.05;
  return 1 + (50 - c) * 0.12;
}

export function applyConditionCost(member: MemberRuntimeState, baseLoad: number): void {
  const cost = Math.max(0, baseLoad) * staminaLoadMultiplier(member.attributes.stamina) * conditionCostAmplifier(member.condition);
  member.condition = clamp(member.condition - cost, 0, 100);
  member.weekly_condition_sum += member.condition;
  member.weekly_condition_min = Math.min(member.weekly_condition_min, member.condition);
  member.weekly_samples += 1;
}

export function recoverCondition(member: MemberRuntimeState, hours: number, quality = 1): void {
  const nf = 0.75 + clamp(member.attributes.natural_fitness - 10, 0, 10) * 0.075;
  const minutes = Math.max(0, hours) * 60;
  member.condition = clamp(member.condition + 3 * Math.sqrt(minutes / 15) * nf * clamp(quality, 0.2, 1.5), 0, 100);
}

/** Daily sleep reset under the master Condition model. */
export function applySleepRecovery(member: MemberRuntimeState, morale: number, sleepHours = 8): void {
  const nf = 0.75 + clamp(member.attributes.natural_fitness - 10, 0, 10) * 0.075;
  const before = member.condition;
  const moraleFactor = 0.9 + 0.002 * clamp(morale, 0, 100);
  const endConditionFactor = 0.9 + 0.4 * ((100 - before) / 100) ** 2;
  member.condition = clamp(before + 22 * (Math.max(0, sleepHours) / 8) ** 0.8 * nf * moraleFactor * endConditionFactor, 0, 100);
  const morning = member.condition;
  member.fatigue_debt = Math.max(0, num(member.fatigue_debt) + Math.max(0, 70 - morning) - 1.5 * Math.max(0, morning - 70));
}

function tierGrowthFactor(tier: string): number {
  return ({ E: .94, D: 1, C: 1.06, B: 1.12, A: 1.18, S: 1.24 } as Record<string, number>)[tier.toUpperCase()] ?? 1;
}

export function applyAttributeExp(member: MemberRuntimeState, attribute: VisibleAttributeV2, hours: number, sourceFactor: number, tier: string, focus: VisibleAttributeV2 | null = null): void {
  const current = member.attributes[attribute];
  const witFactor = clamp(1 + .035 * (member.attributes.wit - 12), .75, 1.3);
  const difficulty = attribute === "tone" || attribute === "agility" ? .8 : 1;
  const levelFactor = 1 - .02 * Math.max(0, current - 10);
  const focusFactor = focus ? (focus === attribute ? 1.45 : 1) : 1.05;
  const issue = ["pitch", "tone", "breath", "rhythm"].includes(attribute) ? member.vocal_issue : ["agility", "stamina", "power"].includes(attribute) ? member.physical_issue : null;
  const issueFactor = !issue ? 1 : issue.severity === "mild" ? .8 : issue.severity === "moderate" ? .55 : .25;
  const gain = Math.max(0, hours) * sourceFactor * difficulty * focusFactor * witFactor * tierGrowthFactor(tier) * levelFactor * issueFactor;
  const next = clamp(num(member.attribute_exp[attribute]) + gain, -100, 200);
  if (next >= 100 && current < 20) {
    member.attributes[attribute] = current + 1;
    member.attribute_exp[attribute] = 0;
  } else {
    member.attribute_exp[attribute] = next;
  }
}

export function applyTraitExp(member: MemberRuntimeState, trait: TraitDomain, amount: number): void {
  member.trait_xp[trait] = Math.max(0, num(member.trait_xp[trait]) + Math.max(0, amount));
}

export function derivedWorkRate(member: MemberRuntimeState): number {
  return clamp(0.65 + member.confidence / 250 + member.condition / 250, 0.25, 1.35);
}

export function syncCondition(idol: Record<string, unknown>, member: MemberRuntimeState): void {
  idol.condition = Math.round(member.condition);
  idol.confidence = Math.round(member.confidence);
  idol.attributes_v2 = member.attributes;
  if (member.vocal_issue) idol.vocal_issue = member.vocal_issue; else delete idol.vocal_issue;
  if (member.physical_issue) idol.physical_issue = member.physical_issue; else delete idol.physical_issue;
  delete idol.vocal_fatigue;
  delete idol.physical_fatigue;
}

export function defaultStaffPackage(tier: string): StaffPackageState {
  const key = tier.toUpperCase();
  const managerCount = ({ E: 1, D: 2, C: 2, B: 3, A: 4, S: 5 } as Record<string, number>)[key] ?? 2;
  return { team_tier: key, manager_count: managerCount, vocal_coach_count: 1, dance_coach_count: 1, dedicated_pr: ["C", "B", "A", "S"].includes(key), manager_ap_used_week: 0, coach_ap_used_week: { vocal: 0, dance: 0 }, coach_rp: { vocal: 0, dance: 0 } };
}

export function usableManagerAp(staff: StaffPackageState, activeIdolCount: number): number {
  return Math.max(0, staff.manager_count * 80 - Math.max(0, activeIdolCount) * 4);
}

const PRESETS: Record<string, Partial<GroupStrategyState>> = {
  mature_ip_sustain: { live_frequency: 2, online_benefit_emphasis: 4, shooting_handshake_emphasis: 3, post_live_tokutenkai_emphasis: 2, media_ip_emphasis: 4, viral_music_content: 3, production_investment: 4, rest_protection: 3, roster_renewal_system: 1, member_exposure_policy: "stable_member_value" },
  high_frequency_growth: { live_frequency: 5, online_benefit_emphasis: 2, shooting_handshake_emphasis: 2, post_live_tokutenkai_emphasis: 5, media_ip_emphasis: 2, viral_music_content: 3, production_investment: 3, rest_protection: 1, roster_renewal_system: 2, member_exposure_policy: "balanced" },
  awareness_conversion_push: { live_frequency: 3, online_benefit_emphasis: 3, shooting_handshake_emphasis: 2, post_live_tokutenkai_emphasis: 3, media_ip_emphasis: 3, viral_music_content: 5, production_investment: 3, rest_protection: 2, roster_renewal_system: 2, member_exposure_policy: "new_member_nurture" },
  veteran_rebuild: { live_frequency: 4, online_benefit_emphasis: 2, shooting_handshake_emphasis: 2, post_live_tokutenkai_emphasis: 4, media_ip_emphasis: 2, viral_music_content: 2, production_investment: 2, rest_protection: 3, roster_renewal_system: 2, member_exposure_policy: "ace_plus_rotation" },
};
export function strategyPresetForGroup(group: Record<string, unknown> | null): string {
  const b = `${group?.name ?? ""} ${group?.name_romanji ?? ""}`.toLowerCase();
  if (b.includes("=love") || b.includes("イコールラブ")) return "mature_ip_sustain";
  if (b.includes("nadeshiko") || b.includes("なでしこ")) return "awareness_conversion_push";
  if (b.includes("akishibu") || b.includes("アキシブ")) return "veteran_rebuild";
  return "high_frequency_growth";
}
export function buildStrategy(presetId: string, month: string): GroupStrategyState {
  const p = PRESETS[presetId] ?? PRESETS.veteran_rebuild!;
  return { preset_id: presetId, visible_month: month, locked: true, live_frequency: p.live_frequency ?? 3, online_benefit_emphasis: p.online_benefit_emphasis ?? 3, shooting_handshake_emphasis: p.shooting_handshake_emphasis ?? 2, post_live_tokutenkai_emphasis: p.post_live_tokutenkai_emphasis ?? 3, media_ip_emphasis: p.media_ip_emphasis ?? 2, viral_music_content: p.viral_music_content ?? 2, production_investment: p.production_investment ?? 3, rest_protection: p.rest_protection ?? 2, roster_renewal_system: p.roster_renewal_system ?? 2, member_exposure_policy: p.member_exposure_policy ?? "balanced" };
}

/**
 * L3 song research is intentionally outside this branch. Until that export
 * exists, every catalog item receives the same neutral game treatment: D12/D12,
 * no lead requirement, ordinary appeal, and no theme/formation/BPM/range claim.
 */
export function deriveSongProfile(song: Record<string, unknown>): SongWorkProfile {
  return { song_uid: String(song.uid ?? ""), themes: [], appeal: 50, vocal_difficulty: 12, dance_difficulty: 12, sing_lead_count: 0, dance_lead_count: 0, vocal_lead_requirement: 14, dance_lead_requirement: 14, bpm: null, vocal_range: null, formation: null, provenance: "default" };
}

function legacyCondition(old: unknown, idol: Record<string, unknown>): number {
  const row = old && typeof old === "object" ? old as Record<string, unknown> : {};
  if (Number.isFinite(Number(row.condition))) return clamp(Number(row.condition), 0, 100);
  if (Number.isFinite(Number(row.vocal_fatigue)) || Number.isFinite(Number(row.physical_fatigue))) return clamp(100 - 0.5 * (num(row.vocal_fatigue) + num(row.physical_fatigue)), 0, 100);
  return clamp(num(idol.condition, 90), 0, 100);
}

function normalizeIssue(raw: unknown, fallbackDate: string): ActiveIssue | null {
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const severity = row.severity;
  if (severity !== "mild" && severity !== "moderate" && severity !== "severe") return null;
  return {
    severity,
    started_on: isoDatePart(row.started_on ?? fallbackDate),
    recovery_days: Math.max(0, Math.trunc(num(row.recovery_days))),
  };
}

/** Normalize v2 saves written by earlier development snapshots without
 * changing their gameplay history. This is deliberately a data repair, not
 * another schema branch. */
function normalizeV2State(save: GameSavePayload, state: TrackBState, opening: string): TrackBState {
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  for (const [uid, member] of Object.entries(state.members)) {
    const idol = idols.find((row) => String(row.uid ?? "") === uid) ?? { uid };
    member.attributes = member.attributes ?? mapLegacyAttributesToV2(idol);
    member.attribute_exp ??= {};
    member.trait_xp ??= {};
    member.trait_focus ??= null;
    member.condition = clamp(num(member.condition, num(idol.condition, 90)), 0, 100);
    member.fatigue_debt = Math.max(0, num(member.fatigue_debt));
    member.vocal_issue = normalizeIssue(member.vocal_issue, opening);
    member.physical_issue = normalizeIssue(member.physical_issue, opening);
    // Master spec retires Theme EXP/Proficiency. Preserve no active theme
    // runtime state when migrating old saves.
    member.theme_skill = {};
    member.theme_xp = {};
    member.theme_last_used = {};
    member.weekly_condition_sum = Math.max(0, num(member.weekly_condition_sum));
    member.weekly_condition_min = clamp(num(member.weekly_condition_min, member.condition), 0, 100);
    member.weekly_samples = Math.max(0, Math.trunc(num(member.weekly_samples)));
    member.weekly_exposure_impression = Math.max(0, num(member.weekly_exposure_impression));
    syncCondition(idol, member);
  }
  for (const [uid, raw] of Object.entries(state.song_familiarity ?? {})) {
    const old = raw as unknown as Record<string, unknown>;
    state.song_familiarity[uid] = {
      formation: clamp(num(old.formation, (num(old.vocal, 50) + num(old.dance, 50)) / 2), 0, 100),
      decay_debt: Math.max(0, num(old.decay_debt)),
      last_performed_on: old.last_performed_on ? isoDatePart(old.last_performed_on) : null,
    };
  }
  state.active_song_uids ??= Object.keys(state.song_familiarity).slice(0, 8);
  const legacyStaff = state.staff as unknown as Record<string, unknown>;
  state.staff = {
    ...defaultStaffPackage(String(legacyStaff.team_tier ?? getLetterTierFromGroup(getPrimaryGroup(save)) ?? "D")),
    manager_count: Math.max(1, Math.trunc(num(legacyStaff.manager_count, Array.isArray(legacyStaff.slots) ? legacyStaff.slots.length : 2))),
    vocal_coach_count: Math.max(0, Math.trunc(num(legacyStaff.vocal_coach_count, 1))),
    dance_coach_count: Math.max(0, Math.trunc(num(legacyStaff.dance_coach_count, 1))),
    dedicated_pr: legacyStaff.dedicated_pr === true || ["C", "B", "A", "S"].includes(String(legacyStaff.team_tier ?? "")),
    manager_ap_used_week: Math.max(0, num(legacyStaff.manager_ap_used_week)),
    coach_ap_used_week: { vocal: Math.max(0, num((legacyStaff.coach_ap_used_week as Record<string, unknown> | undefined)?.vocal)), dance: Math.max(0, num((legacyStaff.coach_ap_used_week as Record<string, unknown> | undefined)?.dance)) },
    coach_rp: { vocal: Math.max(0, num((legacyStaff.coach_rp as Record<string, unknown> | undefined)?.vocal)), dance: Math.max(0, num((legacyStaff.coach_rp as Record<string, unknown> | undefined)?.dance)) },
  };
  state.schema = "track_b_v3";
  return state;
}

export function ensureTrackB(save: GameSavePayload): TrackBState {
  const old = save.track_b as unknown as Record<string, unknown> | undefined;
  const group = getPrimaryGroup(save); const opening = isoDatePart(save.game_start_date ?? save.current_date ?? save.scenario_context.startup_date);
  if (old?.schema === "track_b_v2" && old.members && Object.keys(old.members as object).length) return normalizeV2State(save, old as unknown as TrackBState, opening);
  const letterTier = (getLetterTierFromGroup(group) || "D") as LetterTier; const baseTier = toBaseTier(letterTier);
  const oldFans = old?.fans && typeof old.fans === "object" ? old.fans as Record<string, unknown> : {};
  const fin = financeAudienceProfileForGroup({ groupName: group?.name, groupRomaji: group?.name_romanji, letterTier, fans: num(group?.fans) });
  const ratio = ({ S: [0.78, .16, .06], A: [.75,.18,.07], B: [.72,.2,.08], C:[.7,.21,.09], D:[.71,.22,.07], E:[.68,.23,.09] } as Record<string, number[]>)[baseTier] ?? [.71,.22,.07];
  const total = Math.max(0, num(group?.fans, fin.publicFans + fin.otakuFans + fin.coreFans));
  const fans = { public: Math.max(0, num(oldFans.public, Math.round(total * ratio[0]!))), otaku: Math.max(0, num(oldFans.otaku, Math.round(total * ratio[1]!))), core: Math.max(0, num(oldFans.core, Math.round(total * ratio[2]!))), box_rate: clamp(num(oldFans.box_rate, .2), .05, .85), momentum_po: num(oldFans.momentum_po), momentum_oc: num(oldFans.momentum_oc) };
  const memberUids = Array.isArray(group?.member_uids) ? group!.member_uids.map(String) : [];
  const idols = save.database_snapshot.idols as Record<string, unknown>[]; const oldMembers = old?.members && typeof old.members === "object" ? old.members as Record<string, unknown> : {};
  const members: Record<string, MemberRuntimeState> = {};
  for (const uid of memberUids) {
    const idol = idols.find((r) => String(r.uid ?? "") === uid) ?? { uid }; const attributes = mapLegacyAttributesToV2(idol);
    members[uid] = { idol_uid: uid, attributes, attribute_exp: {}, trait_xp: {}, trait_focus: null, condition: legacyCondition(oldMembers[uid], idol), fatigue_debt: 0, vocal_issue: null, physical_issue: null, confidence: clamp(num(idol.morale, 70) + 5, 20, 90), personal_public: ["C","B","A","S"].includes(baseTier) ? Math.round(num(idol.x_followers) * .04) : 0, otaku_affinity: .12, core_share: memberUids.length ? fans.core / memberUids.length : 0, sell_out_rate: .5, theme_skill: {}, theme_xp: {}, theme_last_used: {}, weekly_condition_sum: 0, weekly_condition_min: 100, weekly_samples: 0, weekly_exposure_impression: 0 };
    syncCondition(idol, members[uid]!);
  }
  const songs = (save.database_snapshot.songs as Record<string, unknown>[]).filter((s) => String(s.group_uid ?? "") === String(group?.uid ?? ""));
  const song_profiles: Record<string, SongWorkProfile> = {}; const song_familiarity: TrackBState["song_familiarity"] = {};
  songs.forEach((song, index) => { const uid = String(song.uid ?? ""); if (!uid) return; song_profiles[uid] = deriveSongProfile(song); const f = index < 12 ? 90 : num(song.popularity) >= 70 ? 80 : 45; song_familiarity[uid] = { formation: f, decay_debt: 0, last_performed_on: null }; });
  const world_themes = {};
  const state: TrackBState = { schema: "track_b_v3", members, fans, satisfaction: { live_week: 60, engage_week: 60, live_4w: [60], engage_4w: [60] }, strategy: buildStrategy(strategyPresetForGroup(group), monthKey(opening)), staff: defaultStaffPackage(String(letterTier)), song_profiles, song_familiarity, active_song_uids: Object.keys(song_familiarity).slice(0, 8), world_themes, making: [], external_offers: [], bonds: [], week_events: [], monthly_reports: [], last_sunday_iso: null, last_month_closed: null, strategy_month_seeded: monthKey(opening) };
  save.track_b = state;
  if (group) Object.assign(group, { public_fans: fans.public, otaku_fans: fans.otaku, core_fans: fans.core, box_rate: fans.box_rate, fans: fans.public + fans.otaku + fans.core });
  return state;
}

export function settleThemeMonth(tb: TrackBState, iso: string): void {
  // Kept as a cadence hook for old callers. Theme is read-only song metadata
  // in the master system, with no XP, proficiency, or world-trend runtime.
  void tb;
  void iso;
}

export function syncTrackBRoster(save: GameSavePayload): void {
  const tb = save.track_b; if (!tb) return; const group = getPrimaryGroup(save); if (!group) return;
  const wanted = new Set(Array.isArray(group.member_uids) ? group.member_uids.map(String) : []);
  for (const uid of Object.keys(tb.members)) if (!wanted.has(uid)) delete tb.members[uid];
  const remaining = Object.values(tb.members); const total = remaining.reduce((sum, m) => sum + Math.max(.01, m.core_share), 0);
  for (const m of remaining) m.core_share = tb.fans.core * Math.max(.01, m.core_share) / Math.max(1, total);
}
