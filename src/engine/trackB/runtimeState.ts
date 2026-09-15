import { normalizePersistedAttributes } from "../idolAttributes";
import { sha256BytesUtf8 } from "../sha256sync";
import type { GameSavePayload } from "../../save/gameSaveSchema";
import { getLetterTierFromGroup, getPrimaryGroup } from "../../save/gameSaveSchema";
import { financeAudienceProfileForGroup } from "../financeSystem";
import type { LetterTier } from "../types";
import { COLOR_KEYS, type ActiveIssue, type AttributesV2, type ColorVector, type GroupStrategyState, type MemberRuntimeState, type SongWorkProfile, type StaffPackageState, type ThemeTag, type TrackBState } from "./types";

export const THEME_DIMENSIONS: Record<string, ThemeTag[]> = {
  season: ["spring", "summer", "autumn", "winter"],
  relation: ["romance", "friendship", "family", "idol_fan"],
  emotion: ["joy", "sadness", "loneliness", "anxiety", "nostalgia", "anger"],
  message: ["hope", "aspiration", "self_esteem", "empowerment", "challenge", "rebellion"],
  aesthetic: ["cute", "cool", "dark", "dreamy", "elegant"],
};
export const ALL_THEMES = Object.values(THEME_DIMENSIONS).flat();
export const emptyColorVector = (): ColorVector => Object.fromEntries(COLOR_KEYS.map((color) => [color, 0])) as ColorVector;
export const normalizedColorDirection = (seed: string): ColorVector => {
  const out = emptyColorVector();
  const primary = COLOR_KEYS[Math.floor(stable01(`${seed}|primary`) * COLOR_KEYS.length)]!;
  const secondary = COLOR_KEYS[(COLOR_KEYS.indexOf(primary) + 2) % COLOR_KEYS.length]!;
  out[primary] = .65; out[secondary] = .35;
  return out;
};

export function clamp(n: number, lo: number, hi: number): number { return Math.max(lo, Math.min(hi, n)); }
export function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() && Number.isFinite(Number(v)) ? Number(v) : fallback;
}
export function isoDatePart(value: unknown): string { return String(value ?? "").split("T")[0] || "2020-01-01"; }
export function weekdayUtc(iso: string): number { return new Date(`${isoDatePart(iso)}T12:00:00Z`).getUTCDay(); }
export function isSundayUtc(iso: string): boolean { return weekdayUtc(iso) === 0; }
export function monthKey(iso: string): string { return isoDatePart(iso).slice(0, 7); }
export function clampStat(n: number): number { return clamp(Math.round(n), 0, 20); }

function stable01(seed: string): number {
  const b = sha256BytesUtf8(seed);
  return ((b[0] ?? 0) * 256 + (b[1] ?? 0)) / 65535;
}

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
  member.condition = clamp(member.condition + Math.max(0, hours) * 1.2 * nf * clamp(quality, 0.2, 1.5), 0, 100);
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

export function staffAbilityForTier(tier: string): number {
  return ({ S: 19, A: 17, B: 14, C: 11, D: 9, E: 7 } as Record<string, number>)[tier.toUpperCase()] ?? 7;
}
export function defaultStaffPackage(tier: string): StaffPackageState {
  const standard = staffAbilityForTier(tier); const junior = clamp(standard - 2, 1, 20); const senior = clamp(standard + 2, 1, 20);
  const slots = ["S", "A"].includes(tier.toUpperCase()) ? [{ grade: "senior" as const, ability: senior }, { grade: "standard" as const, ability: standard }, { grade: "standard" as const, ability: standard }, { grade: "junior" as const, ability: junior }]
    : ["B", "C"].includes(tier.toUpperCase()) ? [{ grade: "standard" as const, ability: standard }, { grade: "standard" as const, ability: standard }, { grade: "junior" as const, ability: junior }]
      : [{ grade: "standard" as const, ability: standard }, { grade: "junior" as const, ability: junior }];
  return { team_tier: tier.toUpperCase(), slots };
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
 * ordinary appeal, and no unsupported formation/BPM/range claim.
 */
export function deriveSongProfile(song: Record<string, unknown>): SongWorkProfile {
  return { song_uid: String(song.uid ?? ""), themes: [], appeal: 50, vocal_difficulty: 12, dance_difficulty: 12, bpm: null, vocal_range: null, formation: null, provenance: "default" };
}

function themeFloor(theme: ThemeTag): number {
  if (THEME_DIMENSIONS.season.includes(theme)) return 30;
  if (THEME_DIMENSIONS.relation.includes(theme)) return 15;
  if (THEME_DIMENSIONS.emotion.includes(theme) || THEME_DIMENSIONS.message.includes(theme)) return 10;
  return 0;
}
function initialThemeSkill(a: AttributesV2, theme: ThemeTag): number { return clamp(themeFloor(theme) + (a.stage_presence - 10) * 0.6 + (a.wit - 10) * 0.25 + (a.teamwork - 10) * 0.15, themeFloor(theme), 40); }
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
    member.condition = clamp(num(member.condition, num(idol.condition, 90)), 0, 100);
    member.vocal_issue = normalizeIssue(member.vocal_issue, opening);
    member.physical_issue = normalizeIssue(member.physical_issue, opening);
    member.theme_proficiency ??= {};
    member.developed_color ??= emptyColorVector();
    member.color_xp ??= emptyColorVector();
    for (const theme of ALL_THEMES) {
      member.theme_proficiency[theme] = clamp(num(member.theme_proficiency[theme], initialThemeSkill(member.attributes, theme)), themeFloor(theme), 100);
    }
    member.weekly_condition_sum = Math.max(0, num(member.weekly_condition_sum));
    member.weekly_condition_min = clamp(num(member.weekly_condition_min, member.condition), 0, 100);
    member.weekly_samples = Math.max(0, Math.trunc(num(member.weekly_samples)));
    member.weekly_exposure_impression = Math.max(0, num(member.weekly_exposure_impression));
    syncCondition(idol, member);
  }
  return state;
}

export function ensureTrackB(save: GameSavePayload): TrackBState {
  const old = save.track_b as unknown as Record<string, unknown> | undefined;
  const group = getPrimaryGroup(save); const opening = isoDatePart(save.game_start_date ?? save.current_date ?? save.scenario_context.startup_date);
  if (old?.schema === "track_b_v2" && old.members && Object.keys(old.members as object).length) return normalizeV2State(save, old as unknown as TrackBState, opening);
  const letterTier = (getLetterTierFromGroup(group) || "D") as LetterTier;
  const baseTier = letterTier === "I" || letterTier === "F" ? "E" : letterTier;
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
    const theme_proficiency = Object.fromEntries(ALL_THEMES.map((theme) => [theme, initialThemeSkill(attributes, theme)]));
    members[uid] = { idol_uid: uid, attributes, condition: legacyCondition(oldMembers[uid], idol), vocal_issue: null, physical_issue: null, confidence: clamp(num(idol.morale, 70) + 5, 20, 90), personal_public: ["C","B","A","S"].includes(baseTier) ? Math.round(num(idol.x_followers) * .04) : 0, otaku_affinity: .12, core_share: memberUids.length ? fans.core / memberUids.length : 0, sell_out_rate: null, recent_live_performance: null, theme_proficiency, developed_color: emptyColorVector(), color_xp: emptyColorVector(), weekly_condition_sum: 0, weekly_condition_min: 100, weekly_samples: 0, weekly_exposure_impression: 0 };
    syncCondition(idol, members[uid]!);
  }
  const songs = (save.database_snapshot.songs as Record<string, unknown>[]).filter((s) => String(s.group_uid ?? "") === String(group?.uid ?? ""));
  const song_profiles: Record<string, SongWorkProfile> = {}; const arrangements: TrackBState["arrangements"] = {};
  songs.forEach((song, index) => { const uid = String(song.uid ?? ""); if (!uid) return; song_profiles[uid] = deriveSongProfile(song); const f = index < 12 ? 90 : num(song.popularity) >= 70 ? 80 : 45; arrangements[uid] = { formation_familiarity: f, whole_song_palette_direction: normalizedColorDirection(uid), part_palette_direction_override: {}, actual_presented_palette: emptyColorVector(), version_id: "historical" }; });
  const world_colors = Object.fromEntries(COLOR_KEYS.map((color) => [color, { raw_popularity: 40, popularity: 50, saturation: 0, momentum: 0 }])) as TrackBState["world_colors"];
  const team_palette = normalizedColorDirection(String(group?.uid ?? "team"));
  const state: TrackBState = { schema: "track_b_v2", members, fans, satisfaction: { live_week: 60, engage_week: 60, live_4w: [60], engage_4w: [60] }, strategy: buildStrategy(strategyPresetForGroup(group), monthKey(opening)), staff: defaultStaffPackage(String(letterTier)), song_profiles, arrangements, world_colors, team_palette, making: [], external_offers: [], bonds: [], week_events: [], monthly_reports: [], last_sunday_iso: null, last_month_closed: null, strategy_month_seeded: monthKey(opening) };
  save.track_b = state;
  if (group) Object.assign(group, { public_fans: fans.public, otaku_fans: fans.otaku, core_fans: fans.core, box_rate: fans.box_rate, fans: fans.public + fans.otaku + fans.core });
  return state;
}

export function settleColorMonth(tb: TrackBState, iso: string): void {
  let total = 0;
  for (const color of COLOR_KEYS) {
    const world = tb.world_colors[color];
    const drift = (stable01(`${iso}|${color}`) - .5) * 6;
    world.momentum = clamp(world.momentum * .55 + drift - world.saturation * .08, -20, 20);
    world.raw_popularity = clamp(world.raw_popularity + (40 - world.raw_popularity) * .12 + world.momentum * .25, 5, 120);
    world.saturation = clamp(world.saturation * .7 + Math.max(0, world.raw_popularity - 60) * .08, 0, 40);
    total += world.raw_popularity;
  }
  for (const color of COLOR_KEYS) tb.world_colors[color].popularity = tb.world_colors[color].raw_popularity / Math.max(1, total) * 500;
}

export function syncTrackBRoster(save: GameSavePayload): void {
  const tb = save.track_b; if (!tb) return; const group = getPrimaryGroup(save); if (!group) return;
  const wanted = new Set(Array.isArray(group.member_uids) ? group.member_uids.map(String) : []);
  for (const uid of Object.keys(tb.members)) if (!wanted.has(uid)) delete tb.members[uid];
  const remaining = Object.values(tb.members); const total = remaining.reduce((sum, m) => sum + Math.max(.01, m.core_share), 0);
  for (const m of remaining) m.core_share = tb.fans.core * Math.max(.01, m.core_share) / Math.max(1, total);
}
