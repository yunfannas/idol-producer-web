import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const START_ISO = "2025-07-05";
const END_ISO = "2026-01-04";
const REPORT_PATH = path.join(ROOT, "support", "reports", "equal-love_media_sim_2025-07-05_to_2026-01-04.md");

const SCENARIO_STARTING_CASH = 20_000_000;
const AVERAGE_MONTHLY_BASE_SALARY_YEN = 240_000;
const LETTER_SALARY_MULTIPLIER = { S: 1.6, A: 1.45, B: 1.3, C: 1.15, D: 1.0, E: 0.3333333333, F: 0.0 };

const EXTRA_ADMIN_DAILY = 98_000;
const EXTRA_ADVERTISING_DAILY = 52_000;

const MEDIA_REVENUE_BASE = {
  tv: 46_000,
  radio: 17_000,
  books: 19_500,
  online: 15_000,
  live_events: 38_500,
};

const MEDIA_FAN_BASE = {
  tv: 120,
  radio: 35,
  books: 28,
  online: 32,
  live_events: 85,
};

const EVENT_TRAVEL_BASE = {
  tv: 22_000,
  radio: 8_000,
  books: 6_000,
  online: 3_000,
  live_events: 20_000,
};

const EVENT_MAKING_BASE = {
  tv: 8_000,
  radio: 2_000,
  books: 6_000,
  online: 5_000,
  live_events: 24_000,
};

const EVENT_AD_BASE = {
  tv: 15_000,
  radio: 4_000,
  books: 7_000,
  online: 6_000,
  live_events: 18_000,
};

const CD_NET_PER_UNIT_YEN = 500;
const MV_SPEND_PER_TRACK_YEN = 1_000_000;
const KNOWN_CD_RELEASE_UNIT_OVERRIDES = {
  "=LOVE::ラブソングに襲われる": 330_000,
};

function readJson(relPath) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, relPath), "utf8"));
}

function isoDate(value) {
  return String(value ?? "").slice(0, 10);
}

function addDays(iso, days) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function yen(value) {
  return `JPY ${Math.round(value).toLocaleString("en-US")}`;
}

function signed(value) {
  const n = Math.round(value);
  return `${n >= 0 ? "+" : ""}${n.toLocaleString("en-US")}`;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function int(value) {
  return Math.trunc(Number(value) || 0);
}

function tierMultiplier(popularity, fans, xFollowers) {
  const score = popularity + fans / 2000 + xFollowers / 5000;
  if (score >= 90) return { tierName: "high", tierMult: 3.0 };
  if (score >= 45) return { tierName: "mid", tierMult: 1.8 };
  return { tierName: "low", tierMult: 1.0 };
}

function buildDailyBreakdown({ targetDateIso, memberCount, popularity, fans, xFollowers, monthlySalaryTotal }) {
  const { tierName, tierMult } = tierMultiplier(popularity, fans, xFollowers);
  const digitalSales = int((2500 + fans * 0.1 + xFollowers * 0.02 + popularity * 180) * tierMult);
  const fanMeetings = int((1800 + fans * 0.08 + popularity * 120) * tierMult);
  const goods = int((1500 + fans * 0.12 + memberCount * 1800) * tierMult);
  const media = int((800 + popularity * 90) * Math.max(0.8, tierMult - 0.15));
  const staff = int(22_000 + memberCount * 7_500);
  const office = int(12_000 + Math.max(0, memberCount - 4) * 1_800);
  const promotion = int((7_500 + popularity * 140) * (tierName === "low" ? 1.0 : tierName === "mid" ? 1.25 : 1.6));
  const salaries = Number(targetDateIso.slice(8, 10)) === 1 ? monthlySalaryTotal : 0;
  return {
    digitalSales,
    fanMeetings,
    goods,
    media,
    staff,
    office,
    promotion,
    salaries,
  };
}

function normalizeKey(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/\s+/g, "")
    .replace(/[・･·•"'`’]/g, "");
}

function textOfEvent(event) {
  return [event.event, event.event_raw, event.site_category, event.type, event.venue, event.venue_hint]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" ");
}

function classifyMediaTab(event) {
  const type = String(event.type ?? "").trim().toLocaleLowerCase();
  const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");

  if (type === "concert" || type === "festival" || type === "guestlive") return null;
  if (/\btour\b|premium tour|anniversary tour|concert|festival|ワンマン|ツアー|ライブ|コンサート/.test(raw)) return null;
  if (type === "tvshow") return "tv";
  if (/\bonline\b|showroom|youtube live|instagram live|line live|配信|オンライン|webサイン|ネットサイン/.test(raw)) return "online";
  if (
    type === "offlineevent" ||
    type === "meet" ||
    /撮影会|握手会|特典会|お渡し会|お話し会|始球式|スポーツ|試合|登壇|リリースイベント|発売記念/.test(raw)
  ) {
    return "live_events";
  }
  if (/\bradio\b|radiko|ラジオ|放送|podcast|ポッドキャスト/.test(raw)) return "radio";
  if (/\bbook\b|magazine|photo\s*book|photobook|newspaper|calendar|brody|bubka|entame|雑誌|写真集|フォトブック|新聞|ムック|週刊|月刊|書籍|ブック|連載/.test(raw)) {
    return "books";
  }
  return "tv";
}

function isCdBonusEvent(event, tab) {
  const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
  if (tab !== "live_events" && tab !== "online") return false;
  return /握手会|サイン会|オンラインサイン|ネットサイン|お話し会|トーク会|お渡し会|撮影会|ツーショット|2ショット|発売記念/.test(raw);
}

function estimateCdBonusSalesNetYen(tab, state, participantCount, coverage, prestige) {
  const fans = Math.max(0, state.fans);
  const popularity = Math.max(0, state.popularity);
  const participantFactor = participantCount > 0 ? clamp(0.58 + participantCount * 0.08, 0.62, 1.2) : 1.0;
  const onlineFactor = tab === "online" ? 0.82 : 1.0;
  const baseUnits = 24 + fans * 0.00012 + popularity * 0.55;
  const units = Math.round(baseUnits * coverage * prestige * participantFactor * onlineFactor);
  return Math.max(0, units * 1500);
}

function normalizeTitleForReleaseMatch(value) {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[『』「」【】]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .toLocaleLowerCase();
}

function isCdReleaseLaunchEvent(event) {
  const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
  return /発売日/.test(raw) && /シングル|album|アルバム/.test(raw);
}

function matchingReleaseForEvent(event, group) {
  const releases = Array.isArray(group.discography) ? group.discography : [];
  const eventTitle = normalizeTitleForReleaseMatch(event.event ?? event.event_raw ?? "");
  const eventDate = isoDate(event.date);
  for (const release of releases) {
    const releaseTitle = normalizeTitleForReleaseMatch(release.title ?? "");
    if (!releaseTitle) continue;
    if (!eventTitle.includes(releaseTitle)) continue;
    if (isoDate(release.release_date) && isoDate(release.release_date) !== eventDate) continue;
    return release;
  }
  return null;
}

function releaseTrackCount(release) {
  const trackSongUids = Array.isArray(release.track_song_uids)
    ? release.track_song_uids.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const trackList = Array.isArray(release.track_list)
    ? release.track_list.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  return Math.max(trackSongUids.length, trackList.length, 1);
}

function estimateCdReleaseUnits(group, release) {
  const overrideKey = `${String(group.name ?? "").trim()}::${String(release.title ?? "").trim()}`;
  if (KNOWN_CD_RELEASE_UNIT_OVERRIDES[overrideKey] != null) return KNOWN_CD_RELEASE_UNIT_OVERRIDES[overrideKey];
  const fans = Math.max(0, Number(group.fans ?? 0) || 0);
  const popularity = Math.max(0, Number(group.popularity ?? 0) || 0);
  return Math.max(5_000, Math.round(fans * 0.42 + popularity * 1_500));
}

function memberCoverageMultiplier(event, groupName, aliases) {
  const members = Array.isArray(event.members)
    ? event.members.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  if (!members.length) return 1.0;
  const normalizedGroupNames = new Set([groupName, ...aliases].map(normalizeKey));
  const filtered = members.filter((member) => !normalizedGroupNames.has(normalizeKey(member)));
  if (!filtered.length) return 1.0;
  if (filtered.length >= 6) return 0.92;
  if (filtered.length >= 3) return 0.82;
  if (filtered.length === 2) return 0.72;
  return 0.6;
}

function prestigeMultiplier(tab, event) {
  const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
  if (tab === "tv") {
    if (/cdtv|fns|music fair|ミュージックステーション|mステ|venue101|うたコン|ラヴィット/.test(raw)) return 1.45;
    if (/フジテレビ|tbs|テレビ朝日|日本テレビ|nhk|tokyo mx|bsフジ|lemino/.test(raw)) return 1.22;
    return 1.0;
  }
  if (tab === "radio") {
    if (/ニッポン放送|文化放送|mbs|tokyo fm|j-wave|fm/.test(raw)) return 1.2;
    return 1.0;
  }
  if (tab === "books") {
    if (/美人百花|myojo|brody|bubka|anan|cover|表紙/.test(raw)) return 1.18;
    return 1.0;
  }
  if (tab === "online") {
    if (/オンラインサイン|発売記念|showroom/.test(raw)) return 1.14;
    return 1.0;
  }
  if (/始球式|発売記念|撮影会|ツーショット/.test(raw)) return 1.32;
  if (/お話し会|お渡し会|特典会/.test(raw)) return 1.18;
  return 1.05;
}

function scaleMultiplier(popularity, fans) {
  return clamp(0.8 + popularity / 200 + Math.log10(Math.max(1000, fans)) * 0.08, 1.0, 1.5);
}

function tierMediaMultiplier(letterTier) {
  return (
    {
      F: 0.8,
      E: 0.88,
      D: 0.96,
      C: 1.06,
      B: 1.18,
      "B+": 1.28,
      A: 1.4,
      S: 1.55,
    }[letterTier] ?? 1.0
  );
}

function resolveMediaEvent(event, state, groupMeta) {
  if (isCdReleaseLaunchEvent(event)) {
    const release = matchingReleaseForEvent(event, groupMeta.groupRow);
    if (!release) return null;
    const units = estimateCdReleaseUnits(groupMeta.groupRow, release);
    const releaseRevenue = units * CD_NET_PER_UNIT_YEN;
    const releaseMvCost = releaseTrackCount(release) * MV_SPEND_PER_TRACK_YEN;
    return {
      tab: "release",
      revenue: releaseRevenue,
      fanGain: 0,
      popularityGain: 0,
      expense: releaseMvCost,
      travel: 0,
      making: releaseMvCost,
      advertising: 0,
      cdReleaseCount: 1,
      cdReleaseUnits: units,
      cdReleaseRevenue: releaseRevenue,
      cdReleaseMvCost: releaseMvCost,
    };
  }
  const tab = classifyMediaTab(event);
  if (!tab) return null;
  const coverage = memberCoverageMultiplier(event, groupMeta.groupName, groupMeta.aliases);
  const prestige = prestigeMultiplier(tab, event);
  const scale = scaleMultiplier(state.popularity, state.fans);
  const tierMult = tierMediaMultiplier(groupMeta.letterTier);
  const freshnessPenalty = clamp(1 - (state.recentByTab[tab] ?? 0) * 0.015, 0.82, 1.0);

  let revenue = Math.round(MEDIA_REVENUE_BASE[tab] * tierMult * scale * coverage * prestige * freshnessPenalty);
  const fanGainRaw = MEDIA_FAN_BASE[tab] * (0.92 + state.popularity / 180 + Math.log10(Math.max(1000, state.fans)) * 0.03);
  const fanGain = Math.round(fanGainRaw * coverage * prestige * freshnessPenalty);
  const popularityGain = clamp(fanGain / 14_000 + (prestige - 1) * 0.06 + (tab === "tv" ? 0.012 : 0), 0.004, 0.085);

  let travel = Math.round(EVENT_TRAVEL_BASE[tab] * (0.9 + coverage * 0.35) * prestige);
  let making = Math.round(EVENT_MAKING_BASE[tab] * (0.9 + coverage * 0.25) * Math.max(1, prestige - 0.05));
  let advertising = Math.round(EVENT_AD_BASE[tab] * prestige);
  const expense = travel + making + advertising;

  return {
    tab,
    revenue,
    fanGain,
    popularityGain,
    expense,
    travel,
    making,
    advertising,
    cdReleaseCount: 0,
    cdReleaseUnits: 0,
    cdReleaseRevenue: 0,
    cdReleaseMvCost: 0,
  };
}

function buildWeeklyRows(history) {
  const rows = [];
  let cursor = 0;
  while (cursor < history.length) {
    const slice = history.slice(cursor, cursor + 7);
    const start = slice[0].date;
    const end = slice[slice.length - 1].date;
    const cashStart = slice[0].cashStart;
    const cashEnd = slice[slice.length - 1].cashEnd;
    const net = slice.reduce((sum, row) => sum + row.net, 0);
    const fans = slice[slice.length - 1].fansEnd;
    const fanDelta = slice[slice.length - 1].fansEnd - slice[0].fansStart;
    const popularity = slice[slice.length - 1].popularityEnd;
    const mediaRevenue = slice.reduce((sum, row) => sum + row.mediaRevenue, 0);
    const mediaExpense = slice.reduce((sum, row) => sum + row.mediaExpense, 0);
    const cdReleaseRevenue = slice.reduce((sum, row) => sum + row.cdReleaseRevenue, 0);
    const cdReleaseMvCost = slice.reduce((sum, row) => sum + row.cdReleaseMvCost, 0);
    const cdReleaseUnits = slice.reduce((sum, row) => sum + row.cdReleaseUnits, 0);
    const eventsByTab = { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 };
    for (const row of slice) {
      for (const [tab, count] of Object.entries(row.eventsByTab)) eventsByTab[tab] += count;
    }
    rows.push({ start, end, cashStart, cashEnd, net, fans, fanDelta, popularity, mediaRevenue, mediaExpense, cdReleaseRevenue, cdReleaseMvCost, cdReleaseUnits, eventsByTab });
    cursor += 7;
  }
  return rows;
}

const groups = readJson("public/data/scenarios/scenario_6/groups.json");
const schedule = readJson("public/data/official_schedules/equal-love-2025-07-2026-05.json");
const group = groups.find((row) => String(row.name ?? "").trim() === "=LOVE");
if (!group) throw new Error("Could not find =LOVE in scenario_6 groups.json");

const xFollowers = Number(group.x_followers ?? 0) || 0;
const memberCount = Number(group.member_count ?? (Array.isArray(group.member_uids) ? group.member_uids.length : 10)) || 10;
const letterTier = String(group.letter_tier ?? "A").trim().toUpperCase();
const monthlySalaryTotal = Math.round(memberCount * AVERAGE_MONTHLY_BASE_SALARY_YEN * (LETTER_SALARY_MULTIPLIER[letterTier] ?? 1.0));

const aliases = ["Equal Love", "＝LOVE", "=LOVE", "イコラブ"];
const mediaEvents = schedule.events
  .filter((event) => isoDate(event.date) >= START_ISO && isoDate(event.date) <= END_ISO)
  .map((event) => ({ ...event, tab: classifyMediaTab(event) }))
  .filter((event) => event.tab);

const eventsByDate = new Map();
for (const event of mediaEvents) {
  const date = isoDate(event.date);
  const list = eventsByDate.get(date) ?? [];
  list.push(event);
  eventsByDate.set(date, list);
}

const state = {
  cash: SCENARIO_STARTING_CASH,
  fans: Number(group.fans ?? 0) || 0,
  popularity: Number(group.popularity ?? 0) || 0,
  recentByTab: { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 },
};

const history = [];
const totals = {
  baseIncome: 0,
  baseExpense: 0,
  removedPassiveMedia: 0,
  extraAdmin: 0,
  extraAdvertising: 0,
  mediaRevenue: 0,
  mediaExpense: 0,
  cdReleaseRevenue: 0,
  cdReleaseMvCost: 0,
  cdReleaseUnits: 0,
  cdReleaseCount: 0,
  travel: 0,
  making: 0,
  advertising: 0,
  fans: 0,
  events: { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 },
};

for (let date = START_ISO; date <= END_ISO; date = addDays(date, 1)) {
  const cashStart = state.cash;
  const fansStart = state.fans;
  const base = buildDailyBreakdown({
    targetDateIso: date,
    memberCount,
    popularity: state.popularity,
    fans: state.fans,
    xFollowers,
    monthlySalaryTotal,
  });

  const baseIncome = base.digitalSales + base.fanMeetings + base.goods;
  const baseExpense = base.staff + base.office + base.promotion + base.salaries;

  let mediaRevenue = 0;
  let mediaExpense = 0;
  let fanGain = 0;
  let popularityGain = 0;
  let cdReleaseRevenue = 0;
  let cdReleaseMvCost = 0;
  let cdReleaseUnits = 0;
  const eventsToday = eventsByDate.get(date) ?? [];
  const eventsByTab = { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 };

  for (const event of eventsToday) {
    const resolution = resolveMediaEvent(event, state, {
      groupName: String(group.name ?? "=LOVE"),
      groupRow: group,
      aliases,
      letterTier,
    });
    if (!resolution) continue;
    mediaRevenue += resolution.revenue;
    mediaExpense += resolution.expense;
    fanGain += resolution.fanGain;
    popularityGain += resolution.popularityGain;
    if (resolution.tab in eventsByTab) eventsByTab[resolution.tab] += 1;
    totals.travel += resolution.travel;
    totals.making += resolution.making;
    totals.advertising += resolution.advertising;
    totals.cdReleaseRevenue += resolution.cdReleaseRevenue;
    totals.cdReleaseMvCost += resolution.cdReleaseMvCost;
    totals.cdReleaseUnits += resolution.cdReleaseUnits;
    totals.cdReleaseCount += resolution.cdReleaseCount;
    cdReleaseRevenue += resolution.cdReleaseRevenue;
    cdReleaseMvCost += resolution.cdReleaseMvCost;
    cdReleaseUnits += resolution.cdReleaseUnits;
  }

  const extraAdmin = EXTRA_ADMIN_DAILY;
  const extraAdvertising = EXTRA_ADVERTISING_DAILY;
  const net = baseIncome + mediaRevenue - baseExpense - extraAdmin - extraAdvertising - mediaExpense;

  state.cash += net;
  state.fans = Math.max(0, Math.round(state.fans + fanGain));
  state.popularity = clamp(state.popularity + popularityGain, 0, 100);

  for (const key of Object.keys(state.recentByTab)) {
    state.recentByTab[key] = Math.max(0, (state.recentByTab[key] ?? 0) - 0.35);
  }
  for (const [tab, count] of Object.entries(eventsByTab)) {
    state.recentByTab[tab] = (state.recentByTab[tab] ?? 0) + count;
  }

  totals.baseIncome += baseIncome;
  totals.baseExpense += baseExpense;
  totals.removedPassiveMedia += base.media;
  totals.extraAdmin += extraAdmin;
  totals.extraAdvertising += extraAdvertising;
  totals.mediaRevenue += mediaRevenue;
  totals.mediaExpense += mediaExpense;
  totals.fans += fanGain;
  for (const [tab, count] of Object.entries(eventsByTab)) totals.events[tab] += count;

  history.push({
    date,
    cashStart,
    cashEnd: state.cash,
    fansStart,
    fansEnd: state.fans,
    popularityEnd: state.popularity,
    net,
    mediaRevenue,
    mediaExpense,
    fanGain,
    eventsByTab,
    cdReleaseRevenue,
    cdReleaseMvCost,
    cdReleaseUnits,
  });
}

const weeklyRows = buildWeeklyRows(history);

const report = [];
report.push("# =LOVE Media-Model Simulation");
report.push("");
report.push(`Window: ${START_ISO} to ${END_ISO} (6 months from Scenario 6 start)`);
report.push("");
report.push("This is a media-layer projection, not a full concert/live simulation.");
report.push("");
report.push("Assumptions:");
report.push("- Start from Scenario 6 opening cash and =LOVE group stats.");
report.push("- Keep the current daily finance model for digital sales, fan meetings, goods, staff, office, promotion, and monthly salaries.");
report.push("- Remove the current flat passive media income and replace it with event-driven media income/fan growth.");
report.push("- Add extra =LOVE-scale operating costs for administration and advertising every day.");
report.push("- Add per-event travel, making, and advertising costs.");
report.push("- CD-bonus meetings do not add separate ticket revenue; those customers are already counted inside CD sales.");
report.push(`- CD net revenue uses ${yen(CD_NET_PER_UNIT_YEN)} per sold copy.`);
report.push(`- Each track on a released CD is assumed to carry ${yen(MV_SPEND_PER_TRACK_YEN)} of MV spending.`);
report.push("- Exclude true concerts/festivals/guest lives from this pass so the result isolates media economics.");
report.push("");
report.push("## Event Mix");
report.push("");
report.push(`- TV: ${totals.events.tv}`);
report.push(`- Radio: ${totals.events.radio}`);
report.push(`- Books: ${totals.events.books}`);
report.push(`- Online: ${totals.events.online}`);
report.push(`- Live events: ${totals.events.live_events}`);
report.push(`- Total modeled media events: ${Object.values(totals.events).reduce((sum, value) => sum + value, 0)}`);
report.push("");
report.push("## Totals");
report.push("");
report.push(`- Starting cash: ${yen(SCENARIO_STARTING_CASH)}`);
report.push(`- Ending cash: ${yen(state.cash)}`);
report.push(`- Net change: ${signed(state.cash - SCENARIO_STARTING_CASH).replace("+", "+JPY ").replace("-", "-JPY ")}`);
report.push(`- Starting fans: ${Math.round(Number(group.fans ?? 0)).toLocaleString("en-US")}`);
report.push(`- Ending fans: ${Math.round(state.fans).toLocaleString("en-US")}`);
report.push(`- Fan change: ${signed(state.fans - Number(group.fans ?? 0))}`);
report.push(`- Starting popularity: ${Number(group.popularity ?? 0)}`);
report.push(`- Ending popularity: ${state.popularity.toFixed(2)}`);
report.push("");
report.push("### Cash Flow Breakdown");
report.push("");
report.push(`- Base income kept from current model: ${yen(totals.baseIncome)}`);
report.push(`- Base expense kept from current model: ${yen(totals.baseExpense)}`);
report.push(`- Flat passive media removed: ${yen(totals.removedPassiveMedia)}`);
report.push(`- Event-driven media revenue added: ${yen(totals.mediaRevenue)}`);
report.push(`- CD release revenue inside media revenue: ${yen(totals.cdReleaseRevenue)} from ${Math.round(totals.cdReleaseUnits).toLocaleString("en-US")} units`);
report.push(`- Extra daily administration: ${yen(totals.extraAdmin)}`);
report.push(`- Extra daily advertising: ${yen(totals.extraAdvertising)}`);
report.push(`- Event-driven media expense: ${yen(totals.mediaExpense)}`);
report.push(`- Travel inside media expense: ${yen(totals.travel)}`);
report.push(`- Making inside media expense: ${yen(totals.making)}`);
report.push(`- Release MV spending inside making: ${yen(totals.cdReleaseMvCost)} across ${totals.cdReleaseCount} CD release(s)`);
report.push(`- Event advertising inside media expense: ${yen(totals.advertising)}`);
report.push("");
report.push("## Weekly Snapshots");
report.push("");
report.push("| Week | Cash End | Week Net | Fans End | Fan Δ | Popularity | TV | Radio | Books | Online | Live events | Media Revenue | Media Expense |");
report.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
for (const row of weeklyRows) {
  report.push(
    `| ${row.start} to ${row.end} | ${yen(row.cashEnd)} | ${signed(row.net)} | ${Math.round(row.fans).toLocaleString("en-US")} | ${signed(row.fanDelta)} | ${row.popularity.toFixed(2)} | ${row.eventsByTab.tv} | ${row.eventsByTab.radio} | ${row.eventsByTab.books} | ${row.eventsByTab.online} | ${row.eventsByTab.live_events} | ${yen(row.mediaRevenue)} | ${yen(row.mediaExpense)} |`,
  );
}
report.push("");
report.push("### CD Release Weeks");
report.push("");
report.push("| Week | CD Units | CD Revenue | MV Cost |");
report.push("| --- | ---: | ---: | ---: |");
for (const row of weeklyRows.filter((entry) => entry.cdReleaseUnits > 0 || entry.cdReleaseRevenue > 0 || entry.cdReleaseMvCost > 0)) {
  report.push(`| ${row.start} to ${row.end} | ${Math.round(row.cdReleaseUnits).toLocaleString("en-US")} | ${yen(row.cdReleaseRevenue)} | ${yen(row.cdReleaseMvCost)} |`);
}
report.push("");
report.push("## Read");
report.push("");
if (state.cash >= SCENARIO_STARTING_CASH) {
  report.push("- Under this first-pass media model, =LOVE stays profitable over the 6-month window even after heavier media-side operations costs.");
} else {
  report.push("- Under this first-pass media model, =LOVE runs below opening cash over the 6-month window, which suggests the extra media-side cost assumptions are too harsh or event payoffs are too weak.");
}
report.push("- This pass should be treated as a media-balance probe. It does not yet include live-tour revenue/cost resolution from the official schedule, so it is intentionally conservative on big-event upside.");
report.push("- The clean next step is to run the same script for iLiFE! and 高嶺のなでしこ, then tune the 3 biggest knobs only: event revenue base, fixed daily admin burden, and live-event merchandise/making cost.");
report.push("");

fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
fs.writeFileSync(REPORT_PATH, report.join("\n"), "utf8");

console.log(`Wrote ${REPORT_PATH}`);
console.log(JSON.stringify({
  startCash: SCENARIO_STARTING_CASH,
  endCash: state.cash,
  cashDelta: state.cash - SCENARIO_STARTING_CASH,
  startFans: Number(group.fans ?? 0) || 0,
  endFans: state.fans,
  fanDelta: state.fans - (Number(group.fans ?? 0) || 0),
  startPopularity: Number(group.popularity ?? 0) || 0,
  endPopularity: state.popularity,
  events: totals.events,
  mediaRevenue: totals.mediaRevenue,
  mediaExpense: totals.mediaExpense,
  cdReleaseRevenue: totals.cdReleaseRevenue,
  cdReleaseMvCost: totals.cdReleaseMvCost,
  cdReleaseUnits: totals.cdReleaseUnits,
  cdReleaseCount: totals.cdReleaseCount,
  extraAdmin: totals.extraAdmin,
  extraAdvertising: totals.extraAdvertising,
}, null, 2));
