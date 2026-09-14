import type { GameSavePayload } from "../../save/gameSaveSchema";
import { songCatalogDisplayLabel } from "../../data/songCatalog";
import type { LiveResultPayload } from "../livePerformanceWeb";
import type { ManagedSongStatusRow } from "../songStatusSystem";
import type { MemberRuntimeState, SongWorkProfile, ThemeTag, TrackBState } from "./types";
import { applyConditionCost, clamp, conditionPenalty, ensureTrackB, isoDatePart, num, recoverCondition, syncCondition, THEME_DIMENSIONS } from "./runtimeState";

type Segment = "public" | "otaku" | "core";
type AudienceState = { activation: number; immersion: number; participation: number; impression: number };
const SEGMENTS: Segment[] = ["public", "otaku", "core"];

function fit(x: number): number { return clamp(1 + .06 * x, .55, 1.15); }
function oneSidedGap(gap: number): number { return gap <= 0 ? 1 : clamp(1 - .08 * gap, .6, 1); }
function performerCountFactor(n: number): number { return n >= 10 ? .8 : n >= 8 ? .85 : n >= 6 ? .92 : n === 4 ? 1 : n === 3 ? 1.08 : n === 2 ? 1.18 : 1.35; }

function resolveSetlistSongs(live: Record<string, unknown>, songs: Record<string, unknown>[], groupUid: string): Record<string, unknown>[] {
  const labels = Array.isArray(live.setlist) ? live.setlist.map(String) : [];
  const byLabel = new Map(songs.filter((s) => String(s.group_uid ?? "") === groupUid).map((s) => [songCatalogDisplayLabel(s), s]));
  const selected = labels.map((label) => byLabel.get(label)).filter((song): song is Record<string, unknown> => Boolean(song));
  return selected.length ? selected : songs.filter((s) => String(s.group_uid ?? "") === groupUid).slice(0, 6);
}

function assignLeads(members: MemberRuntimeState[], profile: SongWorkProfile): { singers: Set<string>; dancers: Set<string>; center: string | null } {
  const singers = new Set([...members].sort((a, b) => b.attributes.pitch + b.attributes.breath - a.attributes.pitch - a.attributes.breath).slice(0, profile.sing_lead_count).map((m) => m.idol_uid));
  const dancers = new Set([...members].sort((a, b) => b.attributes.agility + b.attributes.rhythm - a.attributes.agility - a.attributes.rhythm).slice(0, profile.dance_lead_count).map((m) => m.idol_uid));
  const center = [...members].sort((a, b) => b.attributes.stage_presence - a.attributes.stage_presence)[0]?.idol_uid ?? null;
  return { singers, dancers, center };
}

function attendanceFromLayers(fans: TrackBState["fans"], liveType: string, capacity: number): { attendance: number; publicA: number; otakuA: number; coreA: number; externalPublic: number } {
  const t = liveType.toLowerCase();
  const rates = t === "concert" ? [.012, .12, .48] : t === "festival" ? [.018, .08, .28] : [.01, .1, .38];
  let p = fans.public * rates[0]!, o = fans.otaku * rates[1]!, c = fans.core * rates[2]!;
  let external = 0;
  if (["festival", "taiban", "joint"].includes(t)) external = (p + o + c) * (t === "festival" ? 1.8 : .55);
  const raw = p + o + c + external; const attendance = capacity > 0 ? Math.min(capacity, Math.max(20, Math.round(raw))) : Math.max(80, Math.round(raw));
  const scale = raw > 0 ? attendance / raw : 1;
  return { attendance, publicA: p * scale, otakuA: o * scale, coreA: c * scale, externalPublic: external * scale };
}

function liveFunction(profile: SongWorkProfile): { activation: number; immersion: number; participation: number } {
  const bpm = profile.bpm ?? 120;
  let activation = clamp(50 + (bpm - 120) * .25, 35, 70); let immersion = 50; let participation = 50;
  if (profile.themes.some((t) => ["sadness", "loneliness", "nostalgia", "anxiety", "dreamy"].includes(t))) { immersion += 10; activation -= 5; }
  if (profile.themes.some((t) => ["joy", "challenge", "empowerment", "cool"].includes(t))) { activation += 8; participation += 5; }
  return { activation: clamp(activation, 20, 80), immersion: clamp(immersion, 20, 80), participation: clamp(participation, 20, 80) };
}

function stateFunctionDemand(state: AudienceState, fn: ReturnType<typeof liveFunction>): number {
  // Audience state becomes demand: a low activation audience wants energy,
  // while an already activated audience benefits less from another energy push.
  const need = [100 - state.activation, 100 - state.immersion, 100 - state.participation];
  const supply = [fn.activation, fn.immersion, fn.participation];
  const alignment = need.reduce((sum, value, index) => sum + ((value - 50) / 50) * ((supply[index]! - 50) / 50), 0) / need.length;
  return clamp(1 + alignment * .12, .88, 1.12);
}

function transitionAudienceState(state: AudienceState, fn: ReturnType<typeof liveFunction>, performance: number): void {
  const response = clamp(.22 + (performance - 1) * .16, .16, .3);
  state.activation = clamp(state.activation + (fn.activation - 50) * response, 0, 100);
  state.immersion = clamp(state.immersion + (fn.immersion - 50) * response, 0, 100);
  state.participation = clamp(state.participation + (fn.participation - 50) * response, 0, 100);
}

function songScale(value: unknown, fallback: number): number {
  const raw = num(value, fallback);
  return raw >= 0 && raw <= 5 ? clamp(20 + raw * 16, 0, 100) : clamp(raw, 0, 100);
}

function expectedImpressionBySegment(tb: TrackBState, group: Record<string, unknown>, live: Record<string, unknown>, setlistLength: number): Record<Segment, number> {
  const type = String(live.live_type ?? live.event_type ?? "routine").toLowerCase();
  const eventFactor = type === "festival" ? .88 : ["concert", "oneman", "one-man"].includes(type) ? 1.12 : ["taiban", "joint"].includes(type) ? .96 : 1;
  const fans = tb.fans.public + tb.fans.otaku + tb.fans.core;
  const fanReputation = clamp((Math.log10(fans + 10) - 2) / 3, 0, 1);
  const declaredReputation = songScale(group.popularity ?? group.reputation, fanReputation * 100);
  const capacity = Math.max(0, num(live.capacity));
  const scaleFactor = 1 + clamp((Math.log10(capacity + 10) - 2) / 4, 0, 1) * .1;
  const ticketPrice = Math.max(0, num(live.ticket_price));
  const priceFactor = 1 + clamp(ticketPrice / 8000, 0, 1) * .08;
  const recent = tb.week_events.slice(-4);
  const recentSatisfaction = recent.length ? recent.reduce((sum, row) => sum + row.live_satisfaction, 0) / recent.length : 50;
  const recentFactor = clamp(.92 + recentSatisfaction / 625, .95, 1.08);
  const reputationFactor = .92 + declaredReputation / 1250;
  const perSong = (8 + Math.log10(fans + 10) * 1.5) * eventFactor * scaleFactor * priceFactor * recentFactor * reputationFactor;
  return { public: perSong * setlistLength * .92, otaku: perSong * setlistLength, core: perSong * setlistLength * 1.08 };
}

function satisfactionFromImpression(impression: number, expected: number): number {
  const ratio = impression / Math.max(1, expected);
  // Bounded smooth curve; target Impression is 50 satisfaction.
  return clamp(50 + 78 * Math.tanh((ratio - 1) * 1.5), 0, 100);
}

function teamThemeExecution(tb: TrackBState, members: MemberRuntimeState[], themes: ThemeTag[], segment: Segment): number {
  if (!themes.length) return 1;
  const segmentWorld = segment === "public" ? 1 : segment === "otaku" ? .55 : .12;
  const scores = themes.map((theme) => {
    const skill = members.reduce((sum, member) => sum + (member.theme_skill[theme] ?? 0) + (member.attributes.stage_presence - 10) * .35 + (member.attributes.wit - 10) * .12 + (member.attributes.teamwork - 10) * .08, 0) / Math.max(1, members.length);
    const world = THEME_DIMENSIONS.season.includes(theme) ? 50 : tb.world_themes[theme]?.score ?? 40;
    return (skill / 100) * (1 + ((world - 40) / 100) * segmentWorld);
  });
  const raw = scores.reduce((a, b) => a + b, 0) / scores.length;
  const dilution = themes.length > 3 ? 1 - (themes.length - 3) * .08 : 1;
  return clamp(.5 + raw * .95 * dilution, .5, 2);
}

function issuePenalty(member: MemberRuntimeState, kind: "vocal" | "physical"): number {
  const issue = kind === "vocal" ? member.vocal_issue : member.physical_issue;
  return !issue ? 0 : issue.severity === "mild" ? .6 : issue.severity === "moderate" ? 1.8 : 3.6;
}

function maybeIssue(member: MemberRuntimeState, vocalWork: number, danceWork: number, seed: string, date: string): void {
  const low = Math.max(0, 45 - member.condition) / 45;
  const roll = (Math.abs([...seed].reduce((n, c) => ((n * 31) ^ c.charCodeAt(0)) | 0, 7)) % 1000) / 1000;
  const tryIssue = (kind: "vocal" | "physical", work: number) => {
    const current = kind === "vocal" ? member.vocal_issue : member.physical_issue;
    if (low * work < 1.2 || roll > Math.min(.18, low * work * .025)) return;
    const severity = current?.severity === "mild" ? "moderate" : current?.severity === "moderate" ? "severe" : "mild";
    if (kind === "vocal") member.vocal_issue = { severity, started_on: date, recovery_days: 0 }; else member.physical_issue = { severity, started_on: date, recovery_days: 0 };
  };
  tryIssue("vocal", vocalWork); tryIssue("physical", danceWork);
}

function tokutenkaiCapacity(live: Record<string, unknown>, memberCount: number): number {
  if (live.tokutenkai_enabled !== true) return 0;
  const configured = Math.max(0, Math.trunc(num(live.tokutenkai_capacity_tickets)));
  if (configured > 0) return configured;
  const duration = clamp(Math.trunc(num(live.tokutenkai_duration, 60)), 1, 70);
  const slotSeconds = Math.max(0, Math.trunc(num(live.tokutenkai_slot_seconds)));
  return slotSeconds > 0 ? Math.floor((duration * 60) / slotSeconds) * memberCount : Number.MAX_SAFE_INTEGER;
}

function tokutenkaiPurchaseCoefficients(continuousLimit: number): { core: number; otaku: number; public: number } {
  // Design baseline: Core attendance converts to a purchase by default, with
  // 80% buying L and 20% buying 2L. Otaku/Public remain lower-propensity.
  if (continuousLimit <= 1) return { core: 1.2, otaku: .65, public: .12 };
  if (continuousLimit === 2) return { core: 1.2, otaku: .48, public: .07 };
  if (continuousLimit === 3) return { core: 1.2, otaku: .38, public: .05 };
  if (continuousLimit === 4) return { core: 1.2, otaku: .31, public: .035 };
  return { core: 1.2, otaku: .27, public: .035 };
}

export function resolveLiveTrackB(save: GameSavePayload, group: Record<string, unknown>, idols: Record<string, unknown>[], songs: Record<string, unknown>[], live: Record<string, unknown>, _managedSongStatus?: Record<string, ManagedSongStatusRow>): LiveResultPayload {
  const tb = ensureTrackB(save); const refIso = isoDatePart(live.start_date ?? live.date); const liveType = String(live.live_type ?? live.event_type ?? "Routine");
  const members = idols.map((idol) => tb.members[String(idol.uid ?? "")]).filter((m): m is MemberRuntimeState => Boolean(m));
  const setlist = resolveSetlistSongs(live, songs, String(group.uid ?? "")); const n = Math.max(1, members.length);
  const audience: Record<Segment, AudienceState> = { public: { activation: 50, immersion: 50, participation: 50, impression: 0 }, otaku: { activation: 50, immersion: 50, participation: 50, impression: 0 }, core: { activation: 50, immersion: 50, participation: 50, impression: 0 } };
  const memberScores = new Map<string, number[]>();
  const songValues: number[] = [];

  for (const [index, song] of setlist.entries()) {
    const uid = String(song.uid ?? ""); const profile = tb.song_profiles[uid] ?? { song_uid: uid, themes: [], appeal: 50, vocal_difficulty: 12, dance_difficulty: 12, sing_lead_count: 0, dance_lead_count: 0, vocal_lead_requirement: 14, dance_lead_requirement: 14, bpm: null, vocal_range: null, formation: null, provenance: "default" as const };
    const fam = tb.song_familiarity[uid] ?? { vocal: 50, dance: 50 }; const leads = assignLeads(members, profile); const values: number[] = [];
    for (const member of members) {
      const conditionLoss = conditionPenalty(member.condition); const breath = member.attributes.breath - conditionLoss - issuePenalty(member, "vocal"); const rhythm = member.attributes.rhythm - conditionLoss - issuePenalty(member, "physical"); const power = member.attributes.power - conditionLoss - issuePenalty(member, "physical");
      const vocal = (0.65 * fit(breath - profile.vocal_difficulty) + .35 * fit(rhythm - profile.vocal_difficulty)) * oneSidedGap(profile.vocal_difficulty - member.attributes.pitch) * (.94 + fam.vocal / 100 * .06) + Math.max(0, member.attributes.tone - 10) * .012;
      const dance = fit(rhythm - profile.dance_difficulty) * oneSidedGap(profile.dance_difficulty - member.attributes.agility) * (.94 + fam.dance / 100 * .06) + Math.max(0, power - 10) * .012 + (leads.dancers.has(member.idol_uid) ? .04 : 0);
      const leadPenalty = leads.singers.has(member.idol_uid) && (member.attributes.pitch + breath) / 2 < profile.vocal_lead_requirement ? .1 : 0;
      const value = clamp((.55 * vocal + .45 * dance - leadPenalty) * (.9 + member.attributes.stage_presence * .01), .2, 1.25);
      values.push(value); const prev = memberScores.get(member.idol_uid) ?? []; prev.push(value); memberScores.set(member.idol_uid, prev);
      const vocalWork = 1.3 * performerCountFactor(n) * (leads.singers.has(member.idol_uid) ? 1.1 : 1 / n);
      const danceWork = 1.2;
      applyConditionCost(member, vocalWork + danceWork); maybeIssue(member, vocalWork, danceWork, `${uid}|${member.idol_uid}|${index}`, refIso);
      for (const theme of profile.themes) { member.theme_xp[theme] = (member.theme_xp[theme] ?? 0) + 2 + value * 3; member.theme_last_used[theme] = refIso; }
    }
    const performance = values.reduce((a, b) => a + b, 0) / Math.max(1, values.length); songValues.push(performance * 100);
    const fn = liveFunction(profile);
    const popularity = songScale(song.popularity ?? song.popularity_local, 50);
    const quality = songScale(song.quality ?? song.quality_score ?? song.live_quality, profile.appeal);
    let songExposure = 0;
    for (const segment of SEGMENTS) {
      const state = audience[segment];
      // Evaluate a song against the current audience state, then transition it.
      const base = 5 + profile.appeal * .04 + popularity * .025 + quality * .015;
      const impression = base * performance * teamThemeExecution(tb, members, profile.themes, segment) * stateFunctionDemand(state, fn);
      state.impression += impression;
      transitionAudienceState(state, fn, performance);
      songExposure += impression;
    }
    const weights = members.map((member) => ({ member, weight: 1 + (leads.center === member.idol_uid ? .5 : 0) + (leads.singers.has(member.idol_uid) ? .25 : 0) + (leads.dancers.has(member.idol_uid) ? .2 : 0) }));
    const weightSum = weights.reduce((sum, row) => sum + row.weight, 0); for (const row of weights) row.member.weekly_exposure_impression += songExposure * row.weight / Math.max(1, weightSum);
    if ((index + 1) % 8 === 0) for (const member of members) recoverCondition(member, .25);
  }

  const crowd = attendanceFromLayers(tb.fans, liveType, Math.max(0, Math.trunc(num(live.capacity))),);
  const segmentAttendance: Record<Segment, number> = { public: crowd.publicA + crowd.externalPublic, otaku: crowd.otakuA, core: crowd.coreA };
  const expectedBySegment = expectedImpressionBySegment(tb, group, live, setlist.length);
  const totalAudience = SEGMENTS.reduce((sum, segment) => sum + segmentAttendance[segment], 0);
  const totalImpression = SEGMENTS.reduce((sum, segment) => sum + audience[segment].impression * segmentAttendance[segment], 0) / Math.max(1, totalAudience);
  const expectedImpression = SEGMENTS.reduce((sum, segment) => sum + expectedBySegment[segment] * segmentAttendance[segment], 0) / Math.max(1, totalAudience);
  const satisfaction = satisfactionFromImpression(totalImpression, expectedImpression);
  const tokutenkaiEnabled = live.tokutenkai_enabled === true;
  const continuousLimit = Math.max(1, Math.trunc(num(live.tokutenkai_continuous_ticket_limit, 1)));
  const purchase = tokutenkaiPurchaseCoefficients(continuousLimit);
  const coreTicketDemand = tokutenkaiEnabled ? segmentAttendance.core * continuousLimit * purchase.core : 0;
  const otakuTicketDemand = tokutenkaiEnabled ? segmentAttendance.otaku * continuousLimit * purchase.otaku : 0;
  const publicTicketDemand = tokutenkaiEnabled ? segmentAttendance.public * continuousLimit * purchase.public : 0;
  const ticketDemand = Math.max(0, Math.round(coreTicketDemand + otakuTicketDemand + publicTicketDemand));
  const actualTickets = Math.min(ticketDemand, tokutenkaiCapacity(live, members.length));
  const fulfilledPublicTickets = ticketDemand > 0 ? publicTicketDemand * actualTickets / ticketDemand : 0;
  const immediateOtaku = tokutenkaiEnabled ? Math.min(tb.fans.public, Math.round(fulfilledPublicTickets * clamp(.3 + satisfaction / 200, .25, .6))) : 0;
  tb.fans.public -= immediateOtaku; tb.fans.otaku += immediateOtaku;
  const externalDiscovery = Math.round(crowd.externalPublic * clamp((satisfaction - 40) / 300, 0, .18)); tb.fans.public += externalDiscovery;
  for (const member of members) applyConditionCost(member, actualTickets / Math.max(1, members.length) * .015);
  tb.week_events.push({ date: refIso, public_attendance: segmentAttendance.public, otaku_attendance: segmentAttendance.otaku, core_attendance: segmentAttendance.core, live_satisfaction: satisfaction, engage_satisfaction: clamp(satisfaction * .62 + 18, 0, 100), effectiveness: clamp(satisfaction / 80, .25, 1.2), public_impression: audience.public.impression, otaku_impression: audience.otaku.impression, core_impression: audience.core.impression, sns: satisfaction / 500, streaming: setlist.length / 70, media: liveType.toLowerCase() === "festival" ? .12 : 0 });
  const rows = idols.map((idol) => { const m = tb.members[String(idol.uid ?? "")]; const scores = m ? memberScores.get(m.idol_uid) ?? [.5] : [.5]; const score = scores.reduce((a, b) => a + b, 0) / scores.length; if (m) { m.recent_live_performance = score >= .8 ? "excellent" : score >= .65 ? "strong" : score >= .45 ? "steady" : "weak"; syncCondition(idol, m); } return { uid: idol.uid, name: idol.name, score: Math.round(score * 100), rating: Math.round((4.2 + score * 5.2) * 100) / 100, mood_score: num(idol.morale, 70), condition_score: m?.condition ?? 90, fatigue_score: 100 - (m?.condition ?? 90), vocal_issue: m?.vocal_issue?.severity ?? null, physical_issue: m?.physical_issue?.severity ?? null, tokutenkai_sales_score: 6, work_rate: m ? (m.condition / 100) : 1 }; });
  const performanceScore = songValues.length ? songValues.reduce((a, b) => a + b, 0) / songValues.length : 50;
  return { performance_score: Math.round(performanceScore * 100) / 100, audience_satisfaction: Math.round(satisfaction * 100) / 100, expectation_score: Math.round(expectedImpression * 100) / 100, expectation_by_segment: expectedBySegment, total_impression: Math.round(totalImpression * 100) / 100, novelty_score: 0, attendance: crowd.attendance, broadcast_exposure: Math.round(crowd.externalPublic), exposure_count: crowd.attendance, tokutenkai_actual_tickets: actualTickets, tokutenkai_capacity_tickets: tokutenkaiCapacity(live, members.length), tokutenkai_demographic_demand: ticketDemand, live_ticket_demographic_demand: crowd.attendance, fan_gain: externalDiscovery + immediateOtaku, popularity_gain: satisfaction >= 85 ? 1 : satisfaction < 38 ? -1 : 0, member_scores: rows, live_effectiveness: clamp(satisfaction / 80, .25, 1.2), fan_engage_satisfaction: clamp(satisfaction * .62 + 18, 0, 100), public_attendance: Math.round(segmentAttendance.public), otaku_attendance: Math.round(segmentAttendance.otaku), core_attendance: Math.round(segmentAttendance.core), realized_song_value: clamp(performanceScore / 100, 0, 1), kernel: "track_b_v2", song_impression: audience, immediate_tokuten_conversion: immediateOtaku };
}
