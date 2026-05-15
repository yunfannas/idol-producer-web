/**
 * Port of idol_producer/live_performance_system.py for JSON group/idol rows
 * in web saves (resolve live → apply fans/popularity/morale).
 */

import { isSongHiddenFromDisplay } from "../data/songDisplayPolicy";
import { normalizePersistedAttributes } from "./idolAttributes";
import { sha256BytesUtf8 } from "./sha256sync";
import { ensureIdolSimulationDefaults } from "./idolStatusSystem";

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function avgFloat(...values: number[]): number {
  const v = values.filter((x) => Number.isFinite(x));
  if (!v.length) return 0;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

function hexDigestUtf8(message: string): string {
  const b = sha256BytesUtf8(message);
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export function deterministicNoise(seed: string): number {
  const digest = hexDigestUtf8(seed);
  const raw = parseInt(digest.slice(0, 8), 16) / 0xffffffff;
  return raw * 2 - 1;
}

function parseIsoDate(value: unknown): string | null {
  const text = String(value ?? "").split("T")[0].trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function parseBirthdayParts(iso: unknown): { y: number; m: number; d: number } | null {
  const s = parseIsoDate(iso);
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return null;
  return { y, m, d };
}

function ageAtReference(birth: { y: number; m: number; d: number }, refIso: string): number {
  const ref = parseBirthdayParts(refIso);
  if (!ref) return 0;
  let years = ref.y - birth.y;
  if (ref.m < birth.m || (ref.m === birth.m && ref.d < birth.d)) years -= 1;
  return Math.max(0, years);
}

function idolAgeOn(idol: Record<string, unknown>, refIso: string): number | null {
  const stored = idol.age;
  if (typeof stored === "number" && Number.isFinite(stored)) return stored;
  const birth = parseBirthdayParts(idol.birthday);
  if (!birth) return null;
  return ageAtReference(birth, refIso);
}

function idolTenureYears(idol: Record<string, unknown>, refIso: string): number {
  const stored = idol.scenario_tenure_years;
  if (stored != null && stored !== "") {
    const t = Number(stored);
    if (Number.isFinite(t)) return Math.max(0, t);
  }
  const age = idolAgeOn(idol, refIso);
  if (age == null) return 1.0;
  return clamp(Math.max(0.5, age - 15.0), 0.5, 16.0);
}

function maturityDriveBonus(idol: Record<string, unknown>, refIso: string): number {
  const age = idolAgeOn(idol, refIso);
  const tenureYears = idolTenureYears(idol, refIso);
  let ageBonus = 0;
  if (age != null) ageBonus = Math.max(0, age - 20.0) * 0.1;
  const tenureBonus = Math.min(1.2, Math.max(0, tenureYears - 2.0) * 0.12);
  return clamp(ageBonus + tenureBonus, 0, 2.0);
}

function salesAgeBonus(idol: Record<string, unknown>, refIso: string): number {
  const age = idolAgeOn(idol, refIso);
  if (age == null) return 0;
  const distance = Math.abs(age - 20.0);
  let bonus = 0.55 - distance * 0.1;
  if (age < 17) bonus -= 0.1;
  else if (age >= 25) bonus -= Math.min(0.25, (age - 24.0) * 0.05);
  return clamp(bonus, -0.4, 0.6);
}

function salesTenureAdjustment(idol: Record<string, unknown>, refIso: string): number {
  const tenureYears = idolTenureYears(idol, refIso);
  const earlyBonus = Math.min(0.28, tenureYears * 0.05);
  let veteranPenalty = 0;
  if (tenureYears > 8.0) veteranPenalty = Math.min(0.55, (tenureYears - 8.0) * 0.08);
  return clamp(earlyBonus - veteranPenalty, -0.55, 0.3);
}

function groupIdentityKeys(group: Record<string, unknown>): Set<string> {
  const keys = new Set<string>();
  for (const value of [group.uid, group.name, group.name_romanji, group.nickname]) {
    const text = String(value ?? "").trim().toLowerCase();
    if (text) keys.add(text);
  }
  return keys;
}

function isAkishibuGroup(group: Record<string, unknown> | null): boolean {
  if (!group) return false;
  for (const key of groupIdentityKeys(group)) {
    if (key.includes("akishibu") || key.includes("アキシブ")) return true;
  }
  return false;
}

function akishibuRoleBias(group: Record<string, unknown> | null, idol: Record<string, unknown>): {
  performance: number;
  sales: number;
} {
  if (!isAkishibuGroup(group)) return { performance: 0, sales: 0 };
  const names = new Set(
    [idol.uid, idol.name, idol.romaji].map((x) => String(x ?? "").trim().toLowerCase()).filter(Boolean),
  );
  let performance = 0;
  let sales = 0;
  for (const n of names) {
    if (n.includes("茉井良菜") || n.includes("matsui rana")) {
      performance += 0.4;
      sales += 0.06;
    }
    if (n.includes("古賀みれい") || n.includes("koga mirei")) {
      sales += 0.24;
      performance += 0.04;
    }
  }
  return { performance, sales };
}

function memberLiveComponentScores(idol: Record<string, unknown>, refIso: string): {
  vocal: number;
  dance: number;
  stage: number;
  teamwork: number;
} {
  const a = normalizePersistedAttributes(idol.attributes);
  const maturity = maturityDriveBonus(idol, refIso);
  const tech = a.technical;
  const phys = a.physical;
  const ment = a.mental;
  const app = a.appearance;
  const prof = a.hidden?.professionalism ?? 12;
  const effDet = ment.determination + maturity;
  const effProf = prof + maturity;

  const vocal = avgFloat(tech.pitch, tech.tone, tech.breath, tech.power);
  const dance = avgFloat(phys.agility, phys.stamina, tech.rhythm, tech.grace, tech.power);
  const stage = avgFloat(app.cute, app.pretty, ment.talking, ment.humor, tech.grace);
  const teamwork = avgFloat(ment.teamwork, effDet, ment.clever, effProf);
  return { vocal, dance, stage, teamwork };
}

function memberStatusMultiplier(idol: Record<string, unknown>): number {
  const condition = num(idol.condition, 90);
  const morale = num(idol.morale, 70);
  let mult = 1.0;
  mult += (condition - 70) / 200.0;
  mult += (morale - 50) / 250.0;
  return clamp(mult, 0.5, 1.18);
}

function memberMoodScore(idol: Record<string, unknown>): number {
  const condition = num(idol.condition, 90);
  const morale = num(idol.morale, 70);
  return clamp(condition * 0.58 + morale * 0.42, 0, 100);
}

function memberConditionScore(idol: Record<string, unknown>): number {
  return clamp(num(idol.condition, 90), 0, 100);
}

function memberFatigueScore(idol: Record<string, unknown>): number {
  return clamp(100 - num(idol.condition, 90), 0, 100);
}

function idolLiveReadinessScore(idol: Record<string, unknown>, liveType: string, refIso: string): number {
  const comp = memberLiveComponentScores(idol, refIso);
  const typeKey = String(liveType || "Routine");
  let base: number;
  if (typeKey === "Concert") {
    base = comp.vocal * 0.33 + comp.dance * 0.27 + comp.stage * 0.22 + comp.teamwork * 0.18;
  } else if (typeKey === "Festival") {
    base = comp.stage * 0.36 + comp.dance * 0.24 + comp.vocal * 0.22 + comp.teamwork * 0.18;
  } else if (typeKey === "Taiban") {
    base = comp.stage * 0.34 + comp.dance * 0.28 + comp.vocal * 0.2 + comp.teamwork * 0.18;
  } else {
    base = comp.vocal * 0.28 + comp.dance * 0.24 + comp.stage * 0.28 + comp.teamwork * 0.2;
  }
  let score = (base / 20.0) * 100.0;
  score *= memberStatusMultiplier(idol);
  return clamp(score, 20, 100);
}

function memberTokutenkaiSalesScore(
  idol: Record<string, unknown>,
  live: Record<string, unknown>,
  group: Record<string, unknown> | null,
  refIso: string,
): number {
  const comp = memberLiveComponentScores(idol, refIso);
  const a = normalizePersistedAttributes(idol.attributes);
  const ment = a.mental;
  const app = a.appearance;
  const prof = a.hidden?.professionalism ?? 12;
  const maturity = maturityDriveBonus(idol, refIso);
  const ageB = salesAgeBonus(idol, refIso);
  const tenureAdj = salesTenureAdjustment(idol, refIso);
  const roleBias = akishibuRoleBias(group, idol);

  const charm = avgFloat(app.cute, app.pretty, ment.talking, ment.humor, ment.fashion);
  const reliability = avgFloat(prof + maturity, ment.determination + maturity, ment.teamwork);
  const fc = Math.max(10, num(idol.fan_count, 0));
  const popularitySignal = avgFloat(
    num(idol.popularity, 0),
    Math.min(20.0, Math.log10(fc) * 4.8),
  );

  let score = 5.9;
  score += ((charm - 10.0) / 10.0) * 0.95;
  score += ((comp.stage - 10.0) / 10.0) * 0.45;
  score += ((reliability - 10.0) / 10.0) * 0.38;
  score += ((popularitySignal - 10.0) / 10.0) * 0.55;
  score += ageB;
  score += tenureAdj;
  score += roleBias.sales;
  score += deterministicNoise(`tokuten:${live.uid}|${live.start_date}|${idol.uid}`) * 0.22;
  return clamp(score, 3.8, 9.9);
}

function idolLivePerformanceRating(
  idol: Record<string, unknown>,
  liveType: string,
  live: Record<string, unknown>,
  group: Record<string, unknown> | null,
  refIso: string,
): Record<string, number> {
  const comp = memberLiveComponentScores(idol, refIso);
  const readiness = idolLiveReadinessScore(idol, liveType, refIso);
  const moodScore = memberMoodScore(idol);
  const conditionScore = memberConditionScore(idol);
  const fatigueScore = memberFatigueScore(idol);
  const statusMult = memberStatusMultiplier(idol);
  const attributeStrength = avgFloat(comp.vocal, comp.dance, comp.stage, comp.teamwork);
  const maturity = maturityDriveBonus(idol, refIso);
  const roleBias = akishibuRoleBias(group, idol);

  const typeKey = String(liveType || "Routine");
  let fitStrength: number;
  if (typeKey === "Concert") fitStrength = comp.vocal;
  else if (typeKey === "Festival") fitStrength = comp.stage;
  else if (typeKey === "Taiban") fitStrength = avgFloat(comp.stage, comp.dance);
  else fitStrength = avgFloat(comp.vocal, comp.stage);

  let rating = 6.0;
  rating += ((attributeStrength - 10.0) / 10.0) * 1.05;
  rating += ((moodScore - 70.0) / 30.0) * 0.75;
  rating += ((fitStrength - 10.0) / 10.0) * 0.35;
  rating += ((readiness - 55.0) / 45.0) * 0.4;
  rating += (statusMult - 1.0) * 0.35;
  rating += ((conditionScore - 75.0) / 25.0) * 0.32;
  rating -= (fatigueScore / 100.0) * 0.85;
  rating += Math.min(0.18, maturity * 0.06);
  rating += roleBias.performance;
  rating += deterministicNoise(`member:${live.uid}|${live.start_date}|${idol.uid}`) * 0.34;
  rating = clamp(rating, 3.8, 9.9);

  return {
    rating,
    readiness,
    mood_score: moodScore,
    condition_score: conditionScore,
    fatigue_score: fatigueScore,
    attribute_strength: attributeStrength,
    type_fit_strength: fitStrength,
    tokutenkai_sales_score: memberTokutenkaiSalesScore(idol, live, group, refIso),
    maturity_bonus: maturity,
  };
}

export function collectRecentReleaseSignalFromSnapshot(
  songs: Record<string, unknown>[],
  groupUid: string,
  liveDateIso: string,
  live: Record<string, unknown>,
): {
  novelty_score: number;
  recent_song_count: number;
  recent_disc_count: number;
  setlist_fresh_count: number;
  costume_refresh_bonus: number;
} {
  const liveDate = parseIsoDate(liveDateIso);
  if (!liveDate) {
    return { novelty_score: 0, recent_song_count: 0, recent_disc_count: 0, setlist_fresh_count: 0, costume_refresh_bonus: 0 };
  }

  const liveT = Date.parse(liveDate + "T12:00:00Z");
  const recentTitles = new Set<string>();
  let recentSongCount = 0;

  for (const song of songs) {
    if (!song || typeof song !== "object") continue;
    const s = song as Record<string, unknown>;
    if (String(s.group_uid ?? "") !== String(groupUid)) continue;
    if (s.hidden === true) continue;
    if (isSongHiddenFromDisplay(s)) continue;
    const rd = parseIsoDate(s.release_date);
    if (!rd) continue;
    const delta = Math.round((liveT - Date.parse(rd + "T12:00:00Z")) / 86400000);
    if (delta >= 0 && delta <= 60) {
      recentSongCount += 1;
      const title = String(s.title ?? s.title_romanji ?? "").trim();
      if (title) recentTitles.add(title);
    }
  }

  let recentDiscCount = 0;
  // group row discography passed separately — caller merges via group snapshot

  const setlistRaw = live.setlist;
  const setlist = new Set<string>();
  if (Array.isArray(setlistRaw)) {
    for (const t of setlistRaw) {
      const x = String(t).trim();
      if (x) setlist.add(x);
    }
  }
  let setlistFreshCount = 0;
  for (const title of setlist) {
    if (recentTitles.has(title)) setlistFreshCount += 1;
  }

  let costumeRefreshBonus = 0;
  if (live.costume_refresh === true) costumeRefreshBonus += 3.0;
  costumeRefreshBonus += clamp(num(live.costume_refresh_level, 0), 0, 4);
  if (recentDiscCount > 0) costumeRefreshBonus += 1.0;

  const noveltyScore = Math.min(
    12.0,
    Math.min(recentSongCount, 3) * 1.5 +
      Math.min(setlistFreshCount, 2) * 1.5 +
      Math.min(recentDiscCount, 2) * 1.0 +
      costumeRefreshBonus +
      (live.new_song_showcase === true ? 2.0 : 0.0),
  );

  return {
    novelty_score: Math.round(noveltyScore * 100) / 100,
    recent_song_count: recentSongCount,
    recent_disc_count: recentDiscCount,
    setlist_fresh_count: setlistFreshCount,
    costume_refresh_bonus: Math.round(costumeRefreshBonus * 100) / 100,
  };
}

function mergeDiscographySignal(
  group: Record<string, unknown>,
  live: Record<string, unknown>,
  liveDateIso: string,
  base: ReturnType<typeof collectRecentReleaseSignalFromSnapshot>,
): ReturnType<typeof collectRecentReleaseSignalFromSnapshot> {
  const liveDate = parseIsoDate(liveDateIso);
  if (!liveDate) return base;
  const liveT = Date.parse(liveDate + "T12:00:00Z");
  const discs = group.discography;
  let recentDiscCount = base.recent_disc_count;
  if (Array.isArray(discs)) {
    for (const disc of discs) {
      if (!disc || typeof disc !== "object") continue;
      const d = disc as Record<string, unknown>;
      const rd = parseIsoDate(d.release_date);
      if (!rd) continue;
      const delta = Math.round((liveT - Date.parse(rd + "T12:00:00Z")) / 86400000);
      if (delta >= 0 && delta <= 120) recentDiscCount += 1;
    }
  }

  let costumeRefreshBonus = 0;
  if (live.costume_refresh === true) costumeRefreshBonus += 3.0;
  costumeRefreshBonus += clamp(num(live.costume_refresh_level, 0), 0, 4);
  if (recentDiscCount > 0) costumeRefreshBonus += 1.0;

  const noveltyScore = Math.min(
    12.0,
    Math.min(base.recent_song_count, 3) * 1.5 +
      Math.min(base.setlist_fresh_count, 2) * 1.5 +
      Math.min(recentDiscCount, 2) * 1.0 +
      costumeRefreshBonus +
      (live.new_song_showcase === true ? 2.0 : 0.0),
  );

  return {
    novelty_score: Math.round(noveltyScore * 100) / 100,
    recent_song_count: base.recent_song_count,
    recent_disc_count: recentDiscCount,
    setlist_fresh_count: base.setlist_fresh_count,
    costume_refresh_bonus: Math.round(costumeRefreshBonus * 100) / 100,
  };
}

function estimateGroupFans(group: Record<string, unknown>, members: Record<string, unknown>[]): number {
  const direct = Math.max(0, num(group.fans, 0));
  let memberTotal = 0;
  for (const m of members) memberTotal += Math.max(0, num(m.fan_count, 0));
  return Math.max(direct, memberTotal, 0);
}

function estimateGroupXFollowers(members: Record<string, unknown>[]): number {
  let s = 0;
  for (const m of members) s += Math.max(0, num(m.x_followers, 0));
  return s;
}

function expectationScore(
  group: Record<string, unknown>,
  members: Record<string, unknown>[],
  liveType: string,
  profileStrength: number,
  noveltyScore: number,
): number {
  const groupFans = estimateGroupFans(group, members);
  const xFollowers = estimateGroupXFollowers(members);
  const fanScale = Math.min(18.0, Math.log10(groupFans + 10.0) * 4.1);
  const socialScale = Math.min(12.0, Math.log10(xFollowers + 10.0) * 2.6);
  const typeBonus: Record<string, number> = {
    Festival: 12.0,
    Concert: 8.0,
    Routine: 4.0,
    Taiban: 2.0,
  };
  const tb = typeBonus[String(liveType || "Routine")] ?? 3.0;
  const score = profileStrength * 0.56 + fanScale + socialScale + tb + noveltyScore * 0.45;
  return clamp(score, 18, 96);
}

export interface LiveResultPayload extends Record<string, unknown> {
  performance_score: number;
  audience_satisfaction: number;
  expectation_score: number;
  novelty_score: number;
  attendance: number;
  broadcast_exposure: number;
  exposure_count: number;
  tokutenkai_actual_tickets: number;
  fan_gain: number;
  popularity_gain: number;
  member_scores: Record<string, unknown>[];
}

export function resolveGroupLiveResultWeb(
  group: Record<string, unknown>,
  members: Record<string, unknown>[],
  songs: Record<string, unknown>[],
  live: Record<string, unknown>,
): LiveResultPayload {
  const liveType = String(live.live_type ?? live.event_type ?? "Routine");
  const refIso =
    parseIsoDate(live.start_date) ?? (String(live.start_date ?? "").split("T")[0] || "2020-01-01");

  const memberScores: Record<string, unknown>[] = [];
  for (const idol of members) {
    const ratingInfo = idolLivePerformanceRating(idol, liveType, live, group, refIso);
    memberScores.push({
      uid: idol.uid,
      name: idol.name,
      score: ratingInfo.readiness,
      rating: Math.round(ratingInfo.rating * 100) / 100,
      mood_score: Math.round(ratingInfo.mood_score * 100) / 100,
      condition_score: Math.round(ratingInfo.condition_score * 100) / 100,
      fatigue_score: Math.round(ratingInfo.fatigue_score * 100) / 100,
      attribute_strength: Math.round(ratingInfo.attribute_strength * 100) / 100,
      type_fit_strength: Math.round(ratingInfo.type_fit_strength * 100) / 100,
      tokutenkai_sales_score: Math.round(ratingInfo.tokutenkai_sales_score * 100) / 100,
      maturity_bonus: Math.round(ratingInfo.maturity_bonus * 100) / 100,
    });
  }

  const rosterScore =
    memberScores.length > 0
      ? avgFloat(...memberScores.map((r) => num(r.score, 45)))
      : 45.0;

  const synergy =
    members.length > 0
      ? avgFloat(
          ...members.map((m) => memberLiveComponentScores(m, refIso).teamwork),
        )
      : 10.0;
  const synergyBonus = clamp((synergy - 10.0) * 0.8, -4, 6);
  const noise = deterministicNoise(`${live.uid}|${live.start_date}|${group.uid}`) * 2.4;
  const performanceScore = clamp(rosterScore + synergyBonus + noise, 25, 100);

  const basePopularity = num(group.popularity, 0);
  const memberPopularity = avgFloat(...members.map((m) => num(m.popularity, 0)));
  const profileStrength = Math.max(basePopularity, memberPopularity);

  const gUid = String(group.uid ?? "");
  let freshness = collectRecentReleaseSignalFromSnapshot(songs, gUid, refIso, live);
  freshness = mergeDiscographySignal(group, live, refIso, freshness);
  const noveltyScore = freshness.novelty_score;

  const expectation = expectationScore(group, members, liveType, profileStrength, noveltyScore);

  const expectedTickets = Math.max(0, Math.trunc(num(live.tokutenkai_expected_tickets, 0)));
  const capacity = Math.max(0, Math.trunc(num(live.capacity, 0)));
  let attendance = 0;
  let broadcastExposure = 0;

  if (capacity > 0) {
    const demandAnchor = clamp(
      (profileStrength / 100.0) * 0.8 + (performanceScore / 100.0) * 0.42 + (noveltyScore / 100.0) * 0.15,
      0.12,
      1.0,
    );
    attendance = Math.max(20, Math.round(capacity * demandAnchor));
    attendance = Math.min(capacity, attendance);
  } else if (liveType === "Festival") {
    const groupFans = estimateGroupFans(group, members);
    const xFollowers = estimateGroupXFollowers(members);
    attendance = Math.max(
      800,
      Math.round(
        900 + groupFans * 0.015 + xFollowers * 0.0025 + profileStrength * 18.0 + noveltyScore * 22.0,
      ),
    );
    broadcastExposure = Math.max(
      500,
      Math.round(attendance * (0.55 + profileStrength / 180.0 + noveltyScore / 25.0)),
    );
  } else {
    attendance = expectedTickets;
  }

  const audienceSatisfaction = clamp(
    performanceScore * 0.74 + profileStrength * 0.16 + noveltyScore * 1.1 + deterministicNoise(`audi:${live.uid}`) * 3.0,
    20,
    100,
  );

  let tokutenkaiFactor = clamp(0.6 + (audienceSatisfaction / 100.0) * 0.7, 0.45, 1.25);
  const lineupSalesStrength = avgFloat(
    ...memberScores.map((r) => num(r.tokutenkai_sales_score, 6.0)),
  );
  const topSellerStrength = Math.max(
    ...memberScores.map((r) => num(r.tokutenkai_sales_score, 6.0)),
    6.0,
  );
  tokutenkaiFactor += ((lineupSalesStrength - 6.0) / 3.2) * 0.14;
  tokutenkaiFactor += ((topSellerStrength - 6.4) / 3.0) * 0.07;
  tokutenkaiFactor = clamp(tokutenkaiFactor, 0.42, 1.38);
  let actualTickets = Math.round(expectedTickets * tokutenkaiFactor);
  if (expectedTickets > 0) actualTickets = Math.max(1, actualTickets);

  const exposurePool = attendance + broadcastExposure;
  const baseDiscovery: Record<string, number> = {
    Festival: 0.015,
    Concert: 0.012,
    Routine: 0.018,
    Taiban: 0.022,
  };
  const expectationGap = audienceSatisfaction - expectation;
  let conversionRate =
    (baseDiscovery[liveType] ?? 0.016) + expectationGap / 60.0 + noveltyScore / 180.0;
  if (liveType === "Festival") conversionRate = clamp(conversionRate, -0.18, 0.28);
  else conversionRate = clamp(conversionRate, -0.1, 0.22);
  const fanGain = Math.round(exposurePool * conversionRate);

  let popularityGain = 0;
  if (expectationGap >= 18 || audienceSatisfaction >= 82) popularityGain = 2;
  else if (expectationGap >= 6 || audienceSatisfaction >= 68) popularityGain = 1;
  else if (expectationGap <= -18 || audienceSatisfaction < 38) popularityGain = -2;
  else if (expectationGap <= -8 || audienceSatisfaction < 42) popularityGain = -1;

  return {
    performance_score: Math.round(performanceScore * 100) / 100,
    audience_satisfaction: Math.round(audienceSatisfaction * 100) / 100,
    expectation_score: Math.round(expectation * 100) / 100,
    novelty_score: Math.round(noveltyScore * 100) / 100,
    attendance,
    broadcast_exposure: broadcastExposure,
    exposure_count: exposurePool,
    tokutenkai_actual_tickets: Math.max(0, actualTickets),
    fan_gain: fanGain,
    popularity_gain: popularityGain,
    member_scores: memberScores,
    recent_song_count: freshness.recent_song_count,
    recent_disc_count: freshness.recent_disc_count,
    setlist_fresh_count: freshness.setlist_fresh_count,
    costume_refresh_bonus: freshness.costume_refresh_bonus,
    lineup_tokutenkai_sales_strength: Math.round(lineupSalesStrength * 100) / 100,
    top_tokutenkai_sales_strength: Math.round(topSellerStrength * 100) / 100,
  };
}

/** Apply live result to group + member rows (mutates). Skips Python-only performance history hooks. */
export function applyLiveResultToSnapshot(
  group: Record<string, unknown>,
  members: Record<string, unknown>[],
  liveResult: LiveResultPayload,
): Record<string, unknown> {
  const fanGain = Math.trunc(num(liveResult.fan_gain, 0));
  const popularityGain = Math.trunc(num(liveResult.popularity_gain, 0));
  const performanceScore = num(liveResult.performance_score, 50);
  const satisfaction = num(liveResult.audience_satisfaction, 50);

  group.fans = Math.max(0, num(group.fans, 0) + fanGain);
  group.popularity = clamp(num(group.popularity, 0) + popularityGain, 0, 100);

  const scoreByUid = new Map<string, number>();
  const salesByUid = new Map<string, number>();
  const ratingByUid = new Map<string, number>();
  for (const item of liveResult.member_scores) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const u = String(row.uid ?? "");
    if (!u) continue;
    scoreByUid.set(u, num(row.score, 50));
    salesByUid.set(u, num(row.tokutenkai_sales_score, 6.0));
    const rt = row.rating;
    if (typeof rt === "number" && Number.isFinite(rt)) ratingByUid.set(u, rt);
  }

  const totalTokutenkaiTickets = Math.max(0, Math.trunc(num(liveResult.tokutenkai_actual_tickets, 0)));

  let groupMoraleGain = 0;
  if (performanceScore >= 86 || satisfaction >= 84) groupMoraleGain = 3;
  else if (performanceScore >= 74 || satisfaction >= 72) groupMoraleGain = 2;
  else if (performanceScore >= 62 || satisfaction >= 60) groupMoraleGain = 1;
  else if (performanceScore < 42 || satisfaction < 40) groupMoraleGain = -2;
  else if (performanceScore < 52 || satisfaction < 50) groupMoraleGain = -1;

  type WeightRow = { idol: Record<string, unknown>; weight: number };
  const memberWeights: WeightRow[] = [];
  let totalWeight = 0;
  for (const idol of members) {
    ensureIdolSimulationDefaults(idol);
    const uid = String(idol.uid ?? "");
    const memberScore = scoreByUid.get(uid) ?? performanceScore;
    const weight =
      fanGain >= 0 ? Math.max(0.25, memberScore / 100.0) : Math.max(0.25, (120.0 - memberScore) / 100.0);
    memberWeights.push({ idol, weight });
    totalWeight += weight;
  }

  const tokutenkaiAlloc = new Map<string, number>();
  if (totalTokutenkaiTickets > 0 && members.length > 0) {
    const salesWeights: { uid: string; w: number }[] = [];
    let totalSalesW = 0;
    for (const idol of members) {
      const uid = String(idol.uid ?? "");
      const sw = Math.max(0.1, salesByUid.get(uid) ?? 6.0);
      salesWeights.push({ uid, w: sw });
      totalSalesW += sw;
    }
    const fractional: { frac: number; uid: string }[] = [];
    let assigned = 0;
    for (const { uid, w } of salesWeights) {
      const exact = totalSalesW > 0 ? (totalTokutenkaiTickets * w) / totalSalesW : 0;
      const base = Math.floor(exact);
      tokutenkaiAlloc.set(uid, base);
      assigned += base;
      fractional.push({ frac: exact - base, uid });
    }
    fractional.sort((a, b) => b.frac - a.frac);
    const need = Math.max(0, totalTokutenkaiTickets - assigned);
    for (let i = 0; i < need; i++) {
      const uid = fractional[i]?.uid;
      if (!uid) break;
      tokutenkaiAlloc.set(uid, (tokutenkaiAlloc.get(uid) ?? 0) + 1);
    }
  }

  const appliedMembers: Record<string, unknown>[] = [];
  memberWeights.forEach(({ idol, weight }, index) => {
    ensureIdolSimulationDefaults(idol);
    const uid = String(idol.uid ?? "");
    const name = String(idol.name ?? "").trim() || "Member";
    const beforeCondition = Math.round(num(idol.condition, 90));
    const beforeMorale = Math.round(num(idol.morale, 70));
    const share = totalWeight > 0 ? weight / totalWeight : 1 / Math.max(1, memberWeights.length);
    let memberFanGain = Math.round(fanGain * share);
    if (fanGain > 0 && memberFanGain <= 0) memberFanGain = index === 0 ? 1 : 0;
    else if (fanGain < 0 && memberFanGain >= 0) memberFanGain = index === 0 ? -1 : 0;

    idol.fan_count = Math.max(0, num(idol.fan_count, 0) + memberFanGain);

    let memberPopDelta = 0;
    const ms = scoreByUid.get(uid) ?? performanceScore;
    if (satisfaction >= 84 && ms >= performanceScore) memberPopDelta = 1;
    else if (satisfaction < 40 && ms < 45) memberPopDelta = -1;
    idol.popularity = clamp(num(idol.popularity, 0) + memberPopDelta, 0, 100);

    let memberMoraleDelta = groupMoraleGain;
    if (ms >= performanceScore + 6) memberMoraleDelta += 1;
    else if (ms <= performanceScore - 8 && memberMoraleDelta > 0) memberMoraleDelta -= 1;

    idol.morale = clamp(num(idol.morale, 70) + memberMoraleDelta, 0, 100);

    const lr = ratingByUid.get(uid);
    const performance_rating =
      lr != null && Number.isFinite(lr)
        ? Math.round(lr * 100) / 100
        : Math.round((ms / 10.0) * 100) / 100;
    const afterCondition = Math.round(num(idol.condition, 90));
    const afterMorale = Math.round(num(idol.morale, 70));

    appliedMembers.push({
      uid,
      name,
      performance_rating,
      performance_score: Math.round(ms * 100) / 100,
      fan_gain: memberFanGain,
      popularity_gain: memberPopDelta,
      morale_gain: memberMoraleDelta,
      morale_delta: memberMoraleDelta,
      condition_before: beforeCondition,
      condition_after: afterCondition,
      condition_delta: afterCondition - beforeCondition,
      morale_before: beforeMorale,
      morale_after: afterMorale,
      tokutenkai_tickets: tokutenkaiAlloc.get(uid) ?? 0,
    });
  });

  return {
    group_fan_gain: fanGain,
    group_popularity_gain: popularityGain,
    group_morale_gain: groupMoraleGain,
    member_deltas: appliedMembers,
  };
}

export function estimateTokutenkaiRevenueYen(actualTickets: number): number {
  if (actualTickets <= 0) return 0;
  return Math.round(actualTickets * 2800);
}
