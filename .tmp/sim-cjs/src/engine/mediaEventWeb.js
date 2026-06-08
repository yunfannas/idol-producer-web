"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyMediaEventForGameplay = classifyMediaEventForGameplay;
exports.findManagedOfficialScheduleBundleInRuntime = findManagedOfficialScheduleBundleInRuntime;
exports.resolveManagedMediaDay = resolveManagedMediaDay;
const CD_NET_PER_UNIT_YEN = 500;
const MV_SPEND_PER_TRACK_YEN = 1_000_000;
const KNOWN_CD_RELEASE_UNIT_OVERRIDES = {
    "PUxPVkU::ラブソングに襲われる": 330_000,
};
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
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
function num(value, fallback = 0) {
    if (typeof value === "number" && Number.isFinite(value))
        return value;
    if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value)))
        return Number(value);
    return fallback;
}
function normalizeKey(value) {
    return value
        .normalize("NFKC")
        .toLocaleLowerCase()
        .replace(/\s+/g, "")
        .replace(/[・･·•"'`’]/g, "");
}
function textOfEvent(event) {
    return [
        String(event.event ?? "").trim(),
        String(event.event_raw ?? "").trim(),
        String(event.site_category ?? "").trim(),
        String(event.type ?? "").trim(),
        String(event.venue ?? "").trim(),
        String(event.venue_hint ?? "").trim(),
    ]
        .filter(Boolean)
        .join(" ");
}
function isoDay(value) {
    return String(value ?? "").split("T")[0].trim();
}
function addUtcDays(isoDate, days) {
    const base = new Date(`${isoDay(isoDate) || "2020-01-01"}T12:00:00Z`);
    base.setUTCDate(base.getUTCDate() + days);
    return base.toISOString().slice(0, 10);
}
function tierMediaMultiplier(letterTier) {
    switch (String(letterTier ?? "").trim().toUpperCase()) {
        case "S":
            return 1.55;
        case "A":
            return 1.4;
        case "B":
            return 1.18;
        case "C":
            return 1.06;
        case "D":
            return 0.96;
        case "E":
            return 0.88;
        default:
            return 0.8;
    }
}
function fixedDailyMediaAdminCost(letterTier) {
    switch (String(letterTier ?? "").trim().toUpperCase()) {
        case "S":
            return 118_000;
        case "A":
            return 98_000;
        case "B":
            return 72_000;
        case "C":
            return 40_000;
        default:
            return 0;
    }
}
function fixedDailyMediaAdvertisingCost(letterTier) {
    switch (String(letterTier ?? "").trim().toUpperCase()) {
        case "S":
            return 62_000;
        case "A":
            return 52_000;
        case "B":
            return 34_000;
        case "C":
            return 18_000;
        default:
            return 0;
    }
}
function isCdBonusEvent(event, tab) {
    const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
    if (tab !== "live_events" && tab !== "online")
        return false;
    return /握手会|サイン会|オンラインサイン|ネットサイン|お話し会|トーク会|お渡し会|撮影会|ツーショット|2ショット|発売記念/.test(raw);
}
function normalizeTitleForReleaseMatch(value) {
    return value
        .normalize("NFKC")
        .replace(/[『』「」【】]/g, "")
        .replace(/\s+/g, "")
        .trim()
        .toLocaleLowerCase();
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
function isCdReleaseLaunchEvent(event) {
    const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
    return /発売日/.test(raw) && /シングル|album|アルバム/.test(raw);
}
function matchingReleaseForEvent(event, group) {
    const releases = Array.isArray(group.discography)
        ? group.discography.filter((row) => Boolean(row && typeof row === "object"))
        : [];
    if (!releases.length)
        return null;
    const eventTitle = normalizeTitleForReleaseMatch(String(event.event ?? event.event_raw ?? ""));
    const eventDate = isoDay(event.date);
    for (const release of releases) {
        const releaseTitle = normalizeTitleForReleaseMatch(String(release.title ?? ""));
        if (!releaseTitle)
            continue;
        if (!eventTitle.includes(releaseTitle))
            continue;
        if (eventDate && isoDay(release.release_date) && isoDay(release.release_date) !== eventDate)
            continue;
        return release;
    }
    return null;
}
function estimateCdReleaseUnits(group, release) {
    const overrideKey = `${String(group.uid ?? "").trim()}::${String(release.title ?? "").trim()}`;
    if (KNOWN_CD_RELEASE_UNIT_OVERRIDES[overrideKey] != null)
        return KNOWN_CD_RELEASE_UNIT_OVERRIDES[overrideKey];
    const fans = Math.max(0, num(group.fans, 0));
    const popularity = Math.max(0, num(group.popularity, 0));
    return Math.max(5_000, Math.round(fans * 0.42 + popularity * 1_500));
}
function classifyMediaEventForGameplay(event) {
    const type = String(event.type ?? "").trim().toLocaleLowerCase();
    const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
    if (type === "concert" || type === "festival" || type === "guestlive")
        return null;
    if (/\btour\b|premium tour|anniversary tour|concert|festival|ワンマン|ツアー|ライブ|コンサート/.test(raw))
        return null;
    if (type === "tvshow")
        return "tv";
    if (/\bonline\b|showroom|youtube live|instagram live|line live|配信|オンライン|webサイン|ネットサイン/.test(raw))
        return "online";
    if (type === "offlineevent" ||
        type === "meet" ||
        /撮影会|握手会|特典会|お渡し会|お話し会|始球式|スポーツ|試合|登壇|リリースイベント|発売記念/.test(raw)) {
        return "live_events";
    }
    if (/\bradio\b|radiko|ラジオ|放送|podcast|ポッドキャスト/.test(raw))
        return "radio";
    if (/\bbook\b|magazine|photo\s*book|photobook|newspaper|calendar|brody|bubka|entame|雑誌|写真集|フォトブック|新聞|ムック|週刊|月刊|書籍|ブック|連載/.test(raw)) {
        return "books";
    }
    return "tv";
}
function bundleGroupKeys(bundle) {
    return new Set([bundle.group_name, bundle.group_key, ...(Array.isArray(bundle.aliases) ? bundle.aliases : [])]
        .map((value) => normalizeKey(String(value ?? "").trim()))
        .filter(Boolean));
}
function findManagedOfficialScheduleBundleInRuntime(bundles, group, managingGroupLabel) {
    if (!Array.isArray(bundles) || !bundles.length || !group)
        return null;
    const candidates = new Set([
        String(group.name ?? "").trim(),
        String(group.name_romanji ?? "").trim(),
        String(group.nickname ?? "").trim(),
        String(managingGroupLabel ?? "").trim(),
    ]
        .filter(Boolean)
        .map(normalizeKey));
    if (!candidates.size)
        return null;
    return bundles.find((bundle) => [...bundleGroupKeys(bundle)].some((key) => candidates.has(key))) ?? null;
}
function mediaParticipants(event, bundle, members) {
    const groupKeys = bundleGroupKeys(bundle);
    const rawMembers = Array.isArray(event.members)
        ? event.members.map((value) => String(value ?? "").trim()).filter(Boolean)
        : [];
    const participantNames = rawMembers.filter((name) => !groupKeys.has(normalizeKey(name)));
    if (!participantNames.length)
        return [];
    const participantKeys = new Set(participantNames.map(normalizeKey));
    return members
        .filter((idol) => {
        const keys = [
            String(idol.name ?? "").trim(),
            String(idol.romaji ?? "").trim(),
            String(idol.name_romanji ?? "").trim(),
        ]
            .filter(Boolean)
            .map(normalizeKey);
        return keys.some((key) => participantKeys.has(key));
    })
        .map((idol) => String(idol.uid ?? ""))
        .filter(Boolean);
}
function memberCoverageMultiplier(participantCount) {
    if (participantCount <= 0)
        return 1.0;
    if (participantCount >= 6)
        return 0.92;
    if (participantCount >= 3)
        return 0.82;
    if (participantCount === 2)
        return 0.72;
    return 0.6;
}
function effectiveParticipantUids(participantUids, rosterUids) {
    return participantUids.length ? participantUids : rosterUids;
}
function conditionCostPerEvent(tab, prestige, groupWide) {
    const base = tab === "tv"
        ? 2
        : tab === "radio"
            ? 1
            : tab === "books"
                ? 1
                : tab === "online"
                    ? 1
                    : 3;
    const prestigeCost = prestige >= 1.3 ? 1 : 0;
    const scaleCost = groupWide ? 1 : 0;
    return Math.max(1, base + prestigeCost + scaleCost);
}
function prestigeMultiplier(tab, event) {
    const raw = textOfEvent(event).toLocaleLowerCase().normalize("NFKC");
    if (tab === "tv") {
        if (/cdtv|fns|music fair|ミュージックステーション|mステ|venue101|うたコン|ラヴィット/.test(raw))
            return 1.45;
        if (/フジテレビ|tbs|テレビ朝日|日本テレビ|nhk|tokyo mx|bsフジ|lemino/.test(raw))
            return 1.22;
        return 1.0;
    }
    if (tab === "radio") {
        if (/ニッポン放送|文化放送|mbs|tokyo fm|j-wave|fm/.test(raw))
            return 1.2;
        return 1.0;
    }
    if (tab === "books") {
        if (/美人百花|myojo|brody|bubka|anan|cover|表紙/.test(raw))
            return 1.18;
        return 1.0;
    }
    if (tab === "online") {
        if (/オンラインサイン|発売記念|showroom/.test(raw))
            return 1.14;
        return 1.0;
    }
    if (/始球式|発売記念|撮影会|ツーショット/.test(raw))
        return 1.32;
    if (/お話し会|お渡し会|特典会/.test(raw))
        return 1.18;
    return 1.05;
}
function scaleMultiplier(popularity, fans) {
    return clamp(0.8 + popularity / 200 + Math.log10(Math.max(1000, fans)) * 0.08, 1.0, 1.5);
}
function recentEventCountByTab(bundle, targetIso) {
    const fromIso = addUtcDays(targetIso, -30);
    const counts = { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 };
    for (const event of bundle.events ?? []) {
        const date = isoDay(event.date);
        if (!date || date >= targetIso || date < fromIso)
            continue;
        const tab = classifyMediaEventForGameplay(event);
        if (!tab)
            continue;
        counts[tab] += 1;
    }
    return counts;
}
function distributeFanGain(totalFanGain, participantUids, rosterUids) {
    const out = {};
    if (!rosterUids.length || totalFanGain === 0)
        return out;
    const participantSet = new Set(participantUids.filter(Boolean));
    const participantList = participantSet.size ? rosterUids.filter((uid) => participantSet.has(uid)) : rosterUids;
    const participantPool = Math.round(totalFanGain * (participantSet.size ? 0.7 : 1.0));
    const backgroundPool = totalFanGain - participantPool;
    const applyEvenly = (uids, amount) => {
        if (!uids.length || amount === 0)
            return;
        const base = amount >= 0 ? Math.floor(amount / uids.length) : Math.ceil(amount / uids.length);
        let assigned = 0;
        for (const uid of uids) {
            out[uid] = (out[uid] ?? 0) + base;
            assigned += base;
        }
        let remainder = amount - assigned;
        let index = 0;
        while (remainder !== 0 && uids.length > 0) {
            const uid = uids[index % uids.length];
            out[uid] = (out[uid] ?? 0) + (remainder > 0 ? 1 : -1);
            remainder += remainder > 0 ? -1 : 1;
            index += 1;
        }
    };
    applyEvenly(participantList, participantPool);
    applyEvenly(rosterUids, backgroundPool);
    return out;
}
function resolveManagedMediaDay(bundle, targetIso, group, members, letterTier, passiveMediaBase) {
    const empty = {
        event_count: 0,
        events_by_tab: { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 },
        passive_media_replaced: passiveMediaBase,
        revenue: 0,
        expense: 0,
        fan_gain: 0,
        popularity_gain: 0,
        fixed_admin_cost: 0,
        fixed_advertising_cost: 0,
        travel_cost: 0,
        making_cost: 0,
        event_advertising_cost: 0,
        cd_release_count: 0,
        cd_release_units: 0,
        cd_release_revenue: 0,
        cd_release_mv_cost: 0,
        member_condition_changes: {},
        member_fan_changes: {},
        member_morale_changes: {},
    };
    if (!bundle || !group)
        return empty;
    const todaysEvents = (bundle.events ?? []).filter((event) => isoDay(event.date) === targetIso);
    if (!todaysEvents.length) {
        const fixedAdmin = fixedDailyMediaAdminCost(letterTier);
        const fixedAdvertising = fixedDailyMediaAdvertisingCost(letterTier);
        return {
            ...empty,
            expense: fixedAdmin + fixedAdvertising,
            fixed_admin_cost: fixedAdmin,
            fixed_advertising_cost: fixedAdvertising,
        };
    }
    const recentCounts = recentEventCountByTab(bundle, targetIso);
    const rosterUids = members.map((idol) => String(idol.uid ?? "")).filter(Boolean);
    let revenue = 0;
    let expense = 0;
    let totalFanGain = 0;
    let totalPopularityGain = 0;
    const memberConditionChanges = {};
    const memberFanChanges = {};
    const memberMoraleChanges = {};
    const eventsByTab = { tv: 0, radio: 0, books: 0, online: 0, live_events: 0 };
    let travelCost = 0;
    let makingCost = 0;
    let eventAdvertisingCost = 0;
    let cdReleaseCount = 0;
    let cdReleaseUnits = 0;
    let cdReleaseRevenue = 0;
    let cdReleaseMvCost = 0;
    for (const event of todaysEvents) {
        if (isCdReleaseLaunchEvent(event)) {
            const release = matchingReleaseForEvent(event, group);
            if (release) {
                const units = estimateCdReleaseUnits(group, release);
                const releaseRevenue = units * CD_NET_PER_UNIT_YEN;
                const releaseMvCost = releaseTrackCount(release) * MV_SPEND_PER_TRACK_YEN;
                revenue += releaseRevenue;
                expense += releaseMvCost;
                makingCost += releaseMvCost;
                cdReleaseCount += 1;
                cdReleaseUnits += units;
                cdReleaseRevenue += releaseRevenue;
                cdReleaseMvCost += releaseMvCost;
                for (const uid of rosterUids) {
                    memberConditionChanges[uid] = (memberConditionChanges[uid] ?? 0) - 2;
                }
            }
            continue;
        }
        const tab = classifyMediaEventForGameplay(event);
        if (!tab)
            continue;
        const participantUids = mediaParticipants(event, bundle, members);
        const coverage = memberCoverageMultiplier(participantUids.length);
        const prestige = prestigeMultiplier(tab, event);
        const scale = scaleMultiplier(num(group.popularity, 0), num(group.fans, 0));
        const tierMult = tierMediaMultiplier(letterTier);
        const freshnessPenalty = clamp(1 - (recentCounts[tab] ?? 0) * 0.015, 0.82, 1.0);
        let eventRevenue = Math.round(MEDIA_REVENUE_BASE[tab] * tierMult * scale * coverage * prestige * freshnessPenalty);
        const fanGainRaw = MEDIA_FAN_BASE[tab] *
            (0.92 + num(group.popularity, 0) / 180 + Math.log10(Math.max(1000, num(group.fans, 0))) * 0.03);
        const eventFanGain = Math.round(fanGainRaw * coverage * prestige * freshnessPenalty);
        const eventPopularityGain = clamp(eventFanGain / 14_000 + (prestige - 1) * 0.06 + (tab === "tv" ? 0.012 : 0), 0.004, 0.085);
        let eventTravel = Math.round(EVENT_TRAVEL_BASE[tab] * (0.9 + coverage * 0.35) * prestige);
        let eventMaking = Math.round(EVENT_MAKING_BASE[tab] * (0.9 + coverage * 0.25) * Math.max(1, prestige - 0.05));
        let eventAdvertising = Math.round(EVENT_AD_BASE[tab] * prestige);
        const distributedFans = distributeFanGain(eventFanGain, participantUids, rosterUids);
        const affectedUids = effectiveParticipantUids(participantUids, rosterUids);
        const conditionDelta = -conditionCostPerEvent(tab, prestige, affectedUids.length === rosterUids.length);
        revenue += eventRevenue;
        totalFanGain += eventFanGain;
        totalPopularityGain += eventPopularityGain;
        travelCost += eventTravel;
        makingCost += eventMaking;
        eventAdvertisingCost += eventAdvertising;
        expense += eventTravel + eventMaking + eventAdvertising;
        eventsByTab[tab] += 1;
        recentCounts[tab] += 1;
        for (const [uid, delta] of Object.entries(distributedFans)) {
            memberFanChanges[uid] = (memberFanChanges[uid] ?? 0) + delta;
        }
        for (const uid of affectedUids) {
            memberConditionChanges[uid] = (memberConditionChanges[uid] ?? 0) + conditionDelta;
        }
        for (const uid of participantUids) {
            memberMoraleChanges[uid] = (memberMoraleChanges[uid] ?? 0) + (prestige >= 1.2 ? 1 : 0);
        }
    }
    const fixedAdmin = fixedDailyMediaAdminCost(letterTier);
    const fixedAdvertising = fixedDailyMediaAdvertisingCost(letterTier);
    expense += fixedAdmin + fixedAdvertising;
    return {
        event_count: Object.values(eventsByTab).reduce((sum, value) => sum + value, 0),
        events_by_tab: eventsByTab,
        passive_media_replaced: passiveMediaBase,
        revenue,
        expense,
        fan_gain: totalFanGain,
        popularity_gain: Math.round(totalPopularityGain * 1000) / 1000,
        fixed_admin_cost: fixedAdmin,
        fixed_advertising_cost: fixedAdvertising,
        travel_cost: travelCost,
        making_cost: makingCost,
        event_advertising_cost: eventAdvertisingCost,
        cd_release_count: cdReleaseCount,
        cd_release_units: cdReleaseUnits,
        cd_release_revenue: cdReleaseRevenue,
        cd_release_mv_cost: cdReleaseMvCost,
        member_condition_changes: memberConditionChanges,
        member_fan_changes: memberFanChanges,
        member_morale_changes: memberMoraleChanges,
    };
}
