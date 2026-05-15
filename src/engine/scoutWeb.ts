import { normalizePersistedAttributes } from "./idolAttributes";
import { sha256BytesUtf8 } from "./sha256sync";

export interface ScoutCompany {
  uid: string;
  name: string;
  city: string;
  level: number;
  specialty: string;
  focus_note: string;
  service_fee_yen: number;
}

export interface ScoutLeadRow {
  idol_uid: string;
  score: number;
  profile_score: number;
  current_groups: string[];
  reason: string;
  local_match: boolean;
}

export interface ScoutAuditionRow extends Record<string, unknown> {
  uid: string;
  name: string;
  romaji: string;
  birthplace: string;
  age: number;
  birthday: string;
  height: number;
  background: string;
  note: string;
  source_company_uid: string;
  source_company_name: string;
  popularity: number;
  fan_count: number;
  x_followers: number;
  profile_score: number;
  attributes: Record<string, unknown>;
  signed_idol_uid?: string;
}

const CITY_ALIASES: Record<string, string[]> = {
  Tokyo: ["tokyo", "東京", "東京都", "kanto", "関東"],
  Osaka: ["osaka", "大阪", "大阪府", "kansai", "関西"],
  Nagoya: ["nagoya", "名古屋", "愛知", "aichi", "中部"],
  Fukuoka: ["fukuoka", "福岡", "九州"],
  Sapporo: ["sapporo", "札幌", "北海道"],
  Sendai: ["sendai", "仙台", "宮城", "東北"],
  Hiroshima: ["hiroshima", "広島", "中国地方"],
  Niigata: ["niigata", "新潟"],
};

const CITY_NAME_JA: Record<string, string> = {
  Tokyo: "東京",
  Osaka: "大阪",
  Nagoya: "名古屋",
  Fukuoka: "福岡",
  Sapporo: "札幌",
  Sendai: "仙台",
  Hiroshima: "広島",
  Niigata: "新潟",
};

function num(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value);
  return fallback;
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function noise01(seed: string): number {
  const bytes = sha256BytesUtf8(seed);
  const value = ((bytes[0] << 24) | (bytes[1] << 16) | (bytes[2] << 8) | bytes[3]) >>> 0;
  return value / 0xffffffff;
}

function pickFrom<T>(seed: string, rows: readonly T[]): T {
  const idx = Math.floor(noise01(seed) * rows.length) % rows.length;
  return rows[idx] as T;
}

function normText(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function stableHash01(seed: string): number {
  return noise01(`scout-hash|${seed}`);
}

function cityMatchesText(city: string, text: string): boolean {
  const norm = normText(text);
  return CITY_ALIASES[city]?.some((alias) => norm.includes(alias.toLowerCase())) ?? false;
}

function idolFollowers(idol: Record<string, unknown>): number {
  return Math.max(0, num(idol.x_followers, 0));
}

function idolAbilityScore(idol: Record<string, unknown>): number {
  const attrs = normalizePersistedAttributes(idol.attributes);
  const values = [
    ...Object.values(attrs.physical),
    ...Object.values(attrs.appearance),
    ...Object.values(attrs.technical),
    ...Object.values(attrs.mental),
  ];
  const avg = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  return clamp(Math.round((avg / 20) * 100), 0, 100);
}

function idolProfileScore(idol: Record<string, unknown>): number {
  const popularity = clamp(num(idol.popularity, 0), 0, 100);
  const fans = Math.max(0, num(idol.fan_count, 0));
  const followers = Math.max(0, idolFollowers(idol));
  const ability = idolAbilityScore(idol);
  const followerScore = Math.min(24, Math.log10(followers + 10) * 7);
  const fanScore = Math.min(18, Math.log10(fans + 10) * 6);
  const abilityScore = Math.min(16, ability / 4);
  return clamp(Math.round(popularity * 0.58 + followerScore + fanScore + abilityScore), 0, 100);
}

function activeGroupsForDate(idol: Record<string, unknown>, currentIso: string): string[] {
  const out: string[] = [];
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const raw of history) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    const start = String(entry.start_date ?? "").split("T")[0];
    const end = String(entry.end_date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || start > currentIso) continue;
    if (/^\d{4}-\d{2}-\d{2}$/.test(end) && currentIso >= end) continue;
    const name = String(entry.group_name ?? "").trim();
    if (name) out.push(name);
  }
  return [...new Set(out)];
}

export function buildDefaultScoutCompanies(): ScoutCompany[] {
  const plan: Array<[string, number[]]> = [
    ["Tokyo", [1, 1, 1, 1, 2, 2, 2, 3, 3, 4]],
    ["Osaka", [1, 2, 3, 4]],
    ["Nagoya", [1, 3]],
    ["Fukuoka", [1]],
    ["Sapporo", [1]],
    ["Sendai", [1]],
    ["Hiroshima", [1]],
    ["Niigata", [1]],
  ];
  const levelLabels: Record<number, [string, string, number]> = {
    1: ["Local street teams and school circuits.", "Entry-level freelancers and raw audition hopefuls.", 80_000],
    2: ["Regional live-house and trainee pipeline.", "Indie idols and promising transfer-ready names.", 140_000],
    3: ["Major indie ecosystem and higher-visibility talent.", "Recognizable local acts and stronger transfer targets.", 240_000],
    4: ["Premium network with headline-ready introductions.", "High-profile idols and premium-market auditions.", 420_000],
  };
  const prefixes: Record<string, string> = {
    Tokyo: "Hyper Scout",
    Osaka: "Kansai Hyper Scout",
    Nagoya: "Chubu Hyper Scout",
    Fukuoka: "Kyushu Hyper Scout",
    Sapporo: "North Hyper Scout",
    Sendai: "Tohoku Hyper Scout",
    Hiroshima: "Setouchi Hyper Scout",
    Niigata: "Snowline Hyper Scout",
  };
  const companies: ScoutCompany[] = [];
  for (const [city, levels] of plan) {
    levels.forEach((level, idx) => {
      const [specialty, focusNote, fee] = levelLabels[level]!;
      companies.push({
        uid: `scout-${city.toLowerCase()}-${level}-${idx + 1}`,
        name: `${prefixes[city]} ${idx + 1}`,
        city,
        level,
        specialty,
        focus_note: focusNote,
        service_fee_yen: fee,
      });
    });
  }
  return companies;
}

function hometownAffinityScore(city: string, idol: Record<string, unknown>): number {
  return cityMatchesText(city, String(idol.birthplace ?? "")) ? 100 : 0;
}

function companyAssignmentScore(company: ScoutCompany, idol: Record<string, unknown>): number {
  const local = hometownAffinityScore(company.city, idol);
  const profile = idolProfileScore(idol);
  const followerBand = Math.min(12, Math.floor(idolFollowers(idol) / 15_000));
  const stableBias = stableHash01(`${company.uid}|${String(idol.uid ?? "")}`) * 10;
  return local + profile * 0.18 + followerBand + stableBias - company.level * 0.5;
}

function preferredFreelancerCompanyUid(idol: Record<string, unknown>, companies: ScoutCompany[]): string | null {
  let bestUid: string | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;
  for (const company of companies) {
    const score = companyAssignmentScore(company, idol);
    if (score > bestScore) {
      bestScore = score;
      bestUid = company.uid;
    }
  }
  return bestUid;
}

export function recommendScoutLeads(params: {
  idols: Record<string, unknown>[];
  managedGroupName: string;
  company: ScoutCompany;
  targetType: "freelancer" | "transfer";
  currentIso: string;
  limit?: number;
  companies?: ScoutCompany[];
}): ScoutLeadRow[] {
  const { idols, managedGroupName, company, targetType, currentIso, limit = 18, companies } = params;
  const playerNorm = normText(managedGroupName);
  const rows: ScoutLeadRow[] = [];
  const assignmentPool = companies?.length ? companies : [company];
  for (const idol of idols) {
    if (!idol || typeof idol !== "object") continue;
    const allCurrentGroups = activeGroupsForDate(idol, currentIso);
    const inManagedGroup = allCurrentGroups.some((name) => normText(name) === playerNorm);
    const currentGroups = allCurrentGroups.filter((name) => normText(name) !== playerNorm);
    if (targetType === "freelancer" && (inManagedGroup || currentGroups.length > 0)) continue;
    if (targetType === "transfer" && currentGroups.length === 0) continue;
    if (targetType === "freelancer") {
      const assignedCompanyUid = preferredFreelancerCompanyUid(idol, assignmentPool);
      if (assignedCompanyUid !== company.uid) continue;
    }
    const profile = idolProfileScore(idol);
    const localityBonus = cityMatchesText(company.city, String(idol.birthplace ?? "")) ? 15 : 0;
    const availabilityBonus =
      targetType === "freelancer"
        ? 18
        : clamp(Math.round((55 - num(idol.morale, 70)) / 3) + Math.round(num(idol.jadedness, 0) / 4), 0, 20);
    const score = profile + localityBonus + availabilityBonus + Math.min(12, Math.floor(idolFollowers(idol) / 15_000));
    const reasonParts = [targetType === "freelancer" ? "Freelancer" : "Transfer"];
    if (localityBonus) reasonParts.push(`${CITY_NAME_JA[company.city] ?? company.city} area fit`);
    if (targetType === "transfer" && availabilityBonus >= 8) reasonParts.push("open to a move");
    if (targetType === "freelancer" && idolFollowers(idol) >= 10_000) reasonParts.push("already drawing attention");
    rows.push({
      idol_uid: String(idol.uid ?? ""),
      score,
      profile_score: profile,
      current_groups: currentGroups,
      reason: reasonParts.join(", "),
      local_match: localityBonus > 0,
    });
  }
  rows.sort((a, b) => b.score - a.score || b.profile_score - a.profile_score || a.idol_uid.localeCompare(b.idol_uid));
  return rows.slice(0, limit);
}

export function buildAuditionStorageKey(companyUid: string, currentIso: string): string {
  return `${companyUid}|${currentIso}`;
}

export function generateAuditionCandidates(company: ScoutCompany, currentIso: string, count = 5 + company.level * 2): ScoutAuditionRow[] {
  const surnames: Array<[string, string]> = [["佐藤", "Sato"], ["鈴木", "Suzuki"], ["高橋", "Takahashi"], ["田中", "Tanaka"], ["伊藤", "Ito"], ["渡辺", "Watanabe"], ["山本", "Yamamoto"], ["中村", "Nakamura"], ["小林", "Kobayashi"], ["加藤", "Kato"]];
  const givens: Array<[string, string]> = [["美咲", "Misaki"], ["彩花", "Ayaka"], ["結衣", "Yui"], ["七海", "Nanami"], ["遥", "Haruka"], ["真由", "Mayu"], ["玲奈", "Rena"], ["紗季", "Saki"], ["美月", "Mizuki"], ["花音", "Kanon"]];
  const backgrounds: Array<[string, string]> = [
    ["Local indie idol", "Has small live-house experience and knows fan-service basics."],
    ["Dance school standout", "Strong movement fundamentals but still raw on stage talk."],
    ["Cover singer", "Comfortable with vocal practice and short-form online clips."],
    ["College performer", "Built confidence through campus events and social media posting."],
    ["Former trainee", "Understands idol discipline and wants another chance."],
    ["Open-call applicant", "No agency ties and plenty of room to shape."],
  ];
  const cityLabel = CITY_NAME_JA[company.city] ?? company.city;
  const rows: ScoutAuditionRow[] = [];
  const currentYear = Number(currentIso.slice(0, 4)) || 2020;
  for (let index = 0; index < count; index++) {
    const seed = `${company.uid}|${currentIso}|${index}`;
    const [surnameJa, surnameRo] = pickFrom(`${seed}|s`, surnames);
    const [givenJa, givenRo] = pickFrom(`${seed}|g`, givens);
    const [background, note] = pickFrom(`${seed}|b`, backgrounds);
    const age = 15 + Math.floor(noise01(`${seed}|age`) * (company.level <= 2 ? 10 : 13));
    const height = 148 + Math.floor(noise01(`${seed}|height`) * 24);
    const month = 1 + Math.floor(noise01(`${seed}|month`) * 12);
    const day = 1 + Math.floor(noise01(`${seed}|day`) * 28);
    const popularity = Math.floor(4 + company.level * 8 + noise01(`${seed}|pop`) * (14 + company.level * 8));
    const followers = Math.floor(noise01(`${seed}|followers`) * (2_000 + company.level * 12_000));
    const fans = Math.floor(noise01(`${seed}|fans`) * (800 + company.level * 7_000));
    const attrs = {
      physical: {
        strength: 5 + company.level + Math.floor(noise01(`${seed}|ps`) * 8),
        agility: 6 + company.level + Math.floor(noise01(`${seed}|pa`) * 8),
        natural_fitness: 6 + company.level + Math.floor(noise01(`${seed}|pn`) * 8),
        stamina: 6 + company.level + Math.floor(noise01(`${seed}|pt`) * 8),
      },
      appearance: {
        cute: 7 + company.level + Math.floor(noise01(`${seed}|ac`) * 8),
        pretty: 7 + company.level + Math.floor(noise01(`${seed}|ap`) * 8),
      },
      technical: {
        pitch: 6 + company.level + Math.floor(noise01(`${seed}|tp`) * 8),
        tone: 6 + company.level + Math.floor(noise01(`${seed}|tt`) * 8),
        breath: 6 + company.level + Math.floor(noise01(`${seed}|tb`) * 8),
        rhythm: 6 + company.level + Math.floor(noise01(`${seed}|tr`) * 8),
        power: 5 + company.level + Math.floor(noise01(`${seed}|tw`) * 8),
        grace: 6 + company.level + Math.floor(noise01(`${seed}|tg`) * 8),
      },
      mental: {
        clever: 6 + company.level + Math.floor(noise01(`${seed}|mc`) * 8),
        humor: 5 + company.level + Math.floor(noise01(`${seed}|mh`) * 8),
        talking: 6 + company.level + Math.floor(noise01(`${seed}|mt`) * 8),
        determination: 7 + company.level + Math.floor(noise01(`${seed}|md`) * 8),
        teamwork: 6 + company.level + Math.floor(noise01(`${seed}|mw`) * 8),
        fashion: 5 + company.level + Math.floor(noise01(`${seed}|mf`) * 8),
      },
      hidden: {
        professionalism: 8 + company.level + Math.floor(noise01(`${seed}|hp`) * 6),
        injury_proneness: 3 + Math.floor(noise01(`${seed}|hi`) * 4),
        ambition: 8 + company.level + Math.floor(noise01(`${seed}|ha`) * 6),
        loyalty: 8 + Math.floor(noise01(`${seed}|hl`) * 6),
      },
    };
    rows.push({
      uid: `aud-${company.uid}-${currentIso}-${index}`,
      name: `${surnameJa} ${givenJa}`,
      romaji: `${surnameRo} ${givenRo}`,
      birthplace: `${cityLabel}, Japan`,
      age,
      birthday: `${currentYear - age}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      height,
      background,
      note,
      source_company_uid: company.uid,
      source_company_name: company.name,
      popularity,
      fan_count: fans,
      x_followers: followers,
      profile_score: Math.max(popularity, idolAbilityScore({ attributes: attrs })),
      attributes: attrs,
    });
  }
  return rows;
}

export function auditionCandidateToIdolRow(candidate: ScoutAuditionRow): Record<string, unknown> {
  return {
    uid: String(candidate.uid),
    name: candidate.name,
    romaji: candidate.romaji,
    birthday: candidate.birthday,
    height: candidate.height,
    birthplace: candidate.birthplace,
    popularity: candidate.popularity,
    fan_count: candidate.fan_count,
    x_followers: candidate.x_followers,
    morale: 56,
    jadedness: 8,
    health: 92,
    condition: 88,
    attributes: candidate.attributes,
    x_bio: candidate.background,
    group_history: [],
  };
}
