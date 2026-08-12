/**
 * Group roster profile (ported from desktop `idol_producer/ui/group_ui.py` `show_group_detail_page`).
 */

import {
  financeAudienceProfileForGroup,
  resolveGroupLetterTier,
  type AudienceDemographicMix,
  type FinanceAudienceProfile,
} from "../engine/financeSystem";
import {
  activeGroupMembershipsAtReference,
  ageLabel,
  romajiFromRow,
} from "./idolRowMeta";
import { htmlEsc } from "./htmlEsc";
import { resolveMemberColorCss } from "./memberColor";
import { attrQuotedUrl, avatarPlaceholderDataUrl, groupPicturePublicSrc } from "./portraitUrl";
import {
  discMaxTrackSlotCount,
  discUsesEditionTrackLayout,
  effectiveEditionSlices,
  effectiveSharedTracks,
  summarizeEditionTrackTotals,
} from "../data/discographyNormalize";
import {
  buildGroupDiscographyReleaseRows,
  buildDiscBuckets,
  parseCatalogIsoToTime,
  songsForDisplaySorted,
} from "../data/songDisplayPolicy";
import { t, type UiLanguage } from "./i18n";

function groupFansNum(g: Record<string, unknown>): number {
  return typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
}

function groupPopNum(g: Record<string, unknown>): number {
  return typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
}

function idolMapByUid(idols: Record<string, unknown>[]): Map<string, Record<string, unknown>> {
  const m = new Map<string, Record<string, unknown>>();
  for (const row of idols) {
    const u = String((row as { uid?: unknown }).uid ?? "").trim();
    if (u) m.set(u, row);
  }
  return m;
}

/** Display-only: "Red (Yumeiro H!L!T / iLiFE!)" → "Red". */
function normalizeMemberColorLabel(color: string): string {
  return color.replace(/\s*\([^)]*\)\s*$/u, "").trim();
}

function ilifeNameAliases(groupName: string): Set<string> {
  const n = groupName.trim();
  const set = new Set([n]);
  if (n === "iLiFE!" || n === "iLife!" || n === "iLIFE!") {
    set.add("iLiFE!");
    set.add("iLife!");
    set.add("iLIFE!");
  }
  return set;
}

function normalizeStrategyLookupName(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

interface GroupStrategyProfile {
  archetype: string;
  core: string;
  presetId: string;
  values: Array<{ label: string; value: number }>;
  eventMix: string;
  benefitPolicy: string;
  restPolicy: string;
  exposurePolicy: string;
  staffSignal: string;
  memberSignal: string;
  fanSignal: string;
  risk: string;
}

const GROUP_STRATEGY_PROFILES: Record<string, GroupStrategyProfile> = {
  "=love": {
    archetype: "Mature fixed-roster IP sustain",
    core: "Protect accumulated member/IP value; monetize efficiently through releases, signing, media, goods and concerts.",
    presetId: "mature_ip_sustain",
    values: [
      { label: "Live frequency", value: 2 },
      { label: "Online benefit", value: 5 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 0 },
      { label: "Media / IP", value: 5 },
      { label: "Production", value: 4 },
      { label: "Rest protection", value: 4 },
      { label: "Roster renewal", value: 1 },
    ],
    eventMix: "Major release and concert",
    benefitPolicy: "Online signing",
    restPolicy: "Protected weekly",
    exposurePolicy: "Stable member value",
    staffSignal: "Strong cash efficiency if release/signing/goods calendar is healthy; watch large production and venue commitments.",
    memberSignal: "Members can support major activity if recovery and individual work are protected; avoid treating stable roster as replaceable.",
    fanSignal: "Fans value stable member attachment, high-quality releases, concerts and transparent graduation handling.",
    risk: "Overloading a fixed roster or damaging accumulated member/IP trust.",
  },
  "nogizaka46": {
    archetype: "Generational roster renewal",
    core: "Maintain institutional continuity through auditions, generation integration, selection balance and graduation handling.",
    presetId: "generational_renewal",
    values: [
      { label: "Live frequency", value: 2 },
      { label: "Online benefit", value: 4 },
      { label: "Shooting / handshake", value: 3 },
      { label: "Post-live tokutenkai", value: 0 },
      { label: "Media / IP", value: 5 },
      { label: "Production", value: 5 },
      { label: "Rest protection", value: 3 },
      { label: "Roster renewal", value: 5 },
    ],
    eventMix: "Major release and concert",
    benefitPolicy: "Online and release events",
    restPolicy: "Protected weekly",
    exposurePolicy: "Generation integration",
    staffSignal: "Succession planning, selection balance and brand continuity matter more than small-event volume.",
    memberSignal: "Senior/new generation balance is sensitive; too-fast pushes or too-slow integration both create morale risk.",
    fanSignal: "Fans expect institutional continuity but react strongly to selection, center and graduation handling.",
    risk: "Failed succession, fan split between generations, or brand dilution.",
  },
  "乃木坂46": {
    archetype: "Generational roster renewal",
    core: "Maintain institutional continuity through auditions, generation integration, selection balance and graduation handling.",
    presetId: "generational_renewal",
    values: [
      { label: "Live frequency", value: 2 },
      { label: "Online benefit", value: 4 },
      { label: "Shooting / handshake", value: 3 },
      { label: "Post-live tokutenkai", value: 0 },
      { label: "Media / IP", value: 5 },
      { label: "Production", value: 5 },
      { label: "Rest protection", value: 3 },
      { label: "Roster renewal", value: 5 },
    ],
    eventMix: "Major release and concert",
    benefitPolicy: "Online and release events",
    restPolicy: "Protected weekly",
    exposurePolicy: "Generation integration",
    staffSignal: "Succession planning, selection balance and brand continuity matter more than small-event volume.",
    memberSignal: "Senior/new generation balance is sensitive; too-fast pushes or too-slow integration both create morale risk.",
    fanSignal: "Fans expect institutional continuity but react strongly to selection, center and graduation handling.",
    risk: "Failed succession, fan split between generations, or brand dilution.",
  },
  "ilife!": {
    archetype: "High-frequency core-fan monetization",
    core: "Convert momentum into repeat attendance and benefit revenue while managing overextension.",
    presetId: "high_frequency_growth",
    values: [
      { label: "Live frequency", value: 5 },
      { label: "Online benefit", value: 2 },
      { label: "Shooting / handshake", value: 3 },
      { label: "Post-live tokutenkai", value: 5 },
      { label: "Media / IP", value: 3 },
      { label: "Production", value: 3 },
      { label: "Rest protection", value: 1 },
      { label: "Roster renewal", value: 1 },
    ],
    eventMix: "Taiban heavy",
    benefitPolicy: "Post-live tokutenkai heavy",
    restPolicy: "Member discretion",
    exposurePolicy: "Ace plus rotation",
    staffSignal: "Cash and fan-contact opportunities rise quickly, but staff load and event conflicts become severe.",
    memberSignal: "Members may accept the push while momentum is strong, but fatigue and absence risk compound sharply.",
    fanSignal: "Fans want frequent lives and post-live tokutenkai chances; demand may exceed member service capacity.",
    risk: "Overextension, illness/absence spiral, turnover, and internal ecosystem crowding.",
  },
  "takamine no nadeshiko": {
    archetype: "Awareness-to-core-fandom conversion",
    core: "Turn music/content recognition into repeat attendance, oshi attachment and spending.",
    presetId: "awareness_conversion_push",
    values: [
      { label: "Live frequency", value: 3 },
      { label: "Online benefit", value: 3 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 0 },
      { label: "Media / IP", value: 4 },
      { label: "Production", value: 4 },
      { label: "Rest protection", value: 3 },
      { label: "Roster renewal", value: 1 },
    ],
    eventMix: "Balanced live/media",
    benefitPolicy: "Online and release conversion",
    restPolicy: "Protected weekly",
    exposurePolicy: "New member and member identity",
    staffSignal: "Awareness is valuable but conversion leaks if online/physical benefit access, merch and repeat-live pathways are weak.",
    memberSignal: "Members need more identity-building chances, not just song/content reach; avoid hollow exposure.",
    fanSignal: "Casual listeners know songs, while core fans ask for clearer ways to attach to members and spend.",
    risk: "High awareness without durable repeat attendance, oshi attachment and spending.",
  },
  "高嶺のなでしこ": {
    archetype: "Awareness-to-core-fandom conversion",
    core: "Turn music/content recognition into repeat attendance, oshi attachment and spending.",
    presetId: "awareness_conversion_push",
    values: [
      { label: "Live frequency", value: 3 },
      { label: "Online benefit", value: 3 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 0 },
      { label: "Media / IP", value: 4 },
      { label: "Production", value: 4 },
      { label: "Rest protection", value: 3 },
      { label: "Roster renewal", value: 1 },
    ],
    eventMix: "Balanced live/media",
    benefitPolicy: "Online and release conversion",
    restPolicy: "Protected weekly",
    exposurePolicy: "New member and member identity",
    staffSignal: "Awareness is valuable but conversion leaks if online/physical benefit access, merch and repeat-live pathways are weak.",
    memberSignal: "Members need more identity-building chances, not just song/content reach; avoid hollow exposure.",
    fanSignal: "Casual listeners know songs, while core fans ask for clearer ways to attach to members and spend.",
    risk: "High awareness without durable repeat attendance, oshi attachment and spending.",
  },
  "akishibu project": {
    archetype: "Veteran rebuild",
    core: "Restore lost mature member equity, stabilize fan trust and rebuild live/benefit demand.",
    presetId: "veteran_rebuild",
    values: [
      { label: "Live frequency", value: 4 },
      { label: "Online benefit", value: 1 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 4 },
      { label: "Media / IP", value: 2 },
      { label: "Production", value: 2 },
      { label: "Rest protection", value: 2 },
      { label: "Roster renewal", value: 2 },
    ],
    eventMix: "Balanced taiban routine",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Protected weekly",
    exposurePolicy: "New member nurture",
    staffSignal: "Short-term cash needs live/post-live tokutenkai activity, but rebuilding mature member-specific demand takes months.",
    memberSignal: "Veterans need recognition; newer members need staged exposure and protection from weak early queues.",
    fanSignal: "Fans retain history attachment but do not automatically transfer oshi equity to replacements.",
    risk: "Decline spiral from lost member equity, weak new-member queues and league/event underperformance.",
  },
  "jams collection": {
    archetype: "Direct-monetization strong underground",
    core: "Use live attendance, merch, benefit sessions and birthday events to support ambitious activity.",
    presetId: "direct_monetization_underground",
    values: [
      { label: "Live frequency", value: 4 },
      { label: "Online benefit", value: 2 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 4 },
      { label: "Media / IP", value: 2 },
      { label: "Production", value: 3 },
      { label: "Rest protection", value: 2 },
      { label: "Roster renewal", value: 1 },
    ],
    eventMix: "Live merch birthday",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Protected weekly",
    exposurePolicy: "Ace plus rotation",
    staffSignal: "Direct fan economy can fund ambition even when CD sales are not a strong proxy.",
    memberSignal: "Members gain from strong live identity, but post-milestone roster shocks need recovery and trust handling.",
    fanSignal: "Core fans respond to lives, merch, post-live tokutenkai and birthday events more than mass viral reach.",
    risk: "Mistaking weak CD sales for weak business, or mishandling post-milestone roster changes.",
  },
  "jamscollection": {
    archetype: "Direct-monetization strong underground",
    core: "Use live attendance, merch, benefit sessions and birthday events to support ambitious activity.",
    presetId: "direct_monetization_underground",
    values: [
      { label: "Live frequency", value: 4 },
      { label: "Online benefit", value: 2 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 4 },
      { label: "Media / IP", value: 2 },
      { label: "Production", value: 3 },
      { label: "Rest protection", value: 2 },
      { label: "Roster renewal", value: 1 },
    ],
    eventMix: "Live merch birthday",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Protected weekly",
    exposurePolicy: "Ace plus rotation",
    staffSignal: "Direct fan economy can fund ambition even when CD sales are not a strong proxy.",
    memberSignal: "Members gain from strong live identity, but post-milestone roster shocks need recovery and trust handling.",
    fanSignal: "Core fans respond to lives, merch, post-live tokutenkai and birthday events more than mass viral reach.",
    risk: "Mistaking weak CD sales for weak business, or mishandling post-milestone roster changes.",
  },
  "kirameki unforent": {
    archetype: "Emotional reboot and narrative recruitment",
    core: "Rebuild belief through member recruitment story, producer trust, recovery and identity.",
    presetId: "emotional_reboot",
    values: [
      { label: "Live frequency", value: 3 },
      { label: "Online benefit", value: 1 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 3 },
      { label: "Media / IP", value: 2 },
      { label: "Production", value: 2 },
      { label: "Rest protection", value: 4 },
      { label: "Roster renewal", value: 3 },
    ],
    eventMix: "Small live rebuild",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Strict recovery",
    exposurePolicy: "Narrative casting",
    staffSignal: "The reboot story can attract attention, but professionalism and operational discipline must support it.",
    memberSignal: "Members with prior careers need belief, safety and clear role promises; avoid chaotic overpush.",
    fanSignal: "Fans can buy into the revival narrative if management feels sincere and stable.",
    risk: "Trust collapse from producer overreach, unclear boundaries or another failed reboot.",
  },
  "kirameki☆unforent": {
    archetype: "Emotional reboot and narrative recruitment",
    core: "Rebuild belief through member recruitment story, producer trust, recovery and identity.",
    presetId: "emotional_reboot",
    values: [
      { label: "Live frequency", value: 3 },
      { label: "Online benefit", value: 1 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 3 },
      { label: "Media / IP", value: 2 },
      { label: "Production", value: 2 },
      { label: "Rest protection", value: 4 },
      { label: "Roster renewal", value: 3 },
    ],
    eventMix: "Small live rebuild",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Strict recovery",
    exposurePolicy: "Narrative casting",
    staffSignal: "The reboot story can attract attention, but professionalism and operational discipline must support it.",
    memberSignal: "Members with prior careers need belief, safety and clear role promises; avoid chaotic overpush.",
    fanSignal: "Fans can buy into the revival narrative if management feels sincere and stable.",
    risk: "Trust collapse from producer overreach, unclear boundaries or another failed reboot.",
  },
  "煌めき☆アンフォレント": {
    archetype: "Emotional reboot and narrative recruitment",
    core: "Rebuild belief through member recruitment story, producer trust, recovery and identity.",
    presetId: "emotional_reboot",
    values: [
      { label: "Live frequency", value: 3 },
      { label: "Online benefit", value: 1 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 3 },
      { label: "Media / IP", value: 2 },
      { label: "Production", value: 2 },
      { label: "Rest protection", value: 4 },
      { label: "Roster renewal", value: 3 },
    ],
    eventMix: "Small live rebuild",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Strict recovery",
    exposurePolicy: "Narrative casting",
    staffSignal: "The reboot story can attract attention, but professionalism and operational discipline must support it.",
    memberSignal: "Members with prior careers need belief, safety and clear role promises; avoid chaotic overpush.",
    fanSignal: "Fans can buy into the revival narrative if management feels sincere and stable.",
    risk: "Trust collapse from producer overreach, unclear boundaries or another failed reboot.",
  },
};

function strategyForGroup(g: Record<string, unknown>): GroupStrategyProfile {
  const names = [g.name, g.name_romanji, g.group_name, g.title];
  for (const raw of names) {
    const name = normalizeStrategyLookupName(raw);
    if (!name) continue;
    if (GROUP_STRATEGY_PROFILES[name]) return GROUP_STRATEGY_PROFILES[name];
    const compact = name.replace(/[_\s]/g, "");
    if (GROUP_STRATEGY_PROFILES[compact]) return GROUP_STRATEGY_PROFILES[compact];
  }
  const tier = resolveGroupLetterTier(g);
  if (tier === "S" || tier === "A") {
    return {
      archetype: "Major visibility sustain",
      core: "Use selective concerts, release events, media and brand work while protecting member schedules.",
      presetId: "tier_major_default",
      values: [
        { label: "Live frequency", value: 2 },
        { label: "Online benefit", value: 4 },
        { label: "Shooting / handshake", value: 3 },
        { label: "Post-live tokutenkai", value: 0 },
        { label: "Media / IP", value: 5 },
        { label: "Production", value: 4 },
        { label: "Rest protection", value: 3 },
        { label: "Roster renewal", value: tier === "S" ? 4 : 2 },
      ],
      eventMix: "Major release and concert",
      benefitPolicy: "Online and release events",
      restPolicy: "Protected weekly",
      exposurePolicy: "Media and member-value balance",
      staffSignal: "Large-scale revenue depends on release timing, production quality and brand work.",
      memberSignal: "Members need recovery around media, release and tour blocks.",
      fanSignal: "Fans expect polish, visibility and clear member attachment.",
      risk: "High fixed commitments without enough release or media conversion.",
    };
  }
  if (tier === "B" || tier === "C") {
    return {
      archetype: "Balanced growth and direct monetization",
      core: "Blend live attendance, content awareness, goods and benefit access without exhausting the roster.",
      presetId: "tier_balanced_growth",
      values: [
        { label: "Live frequency", value: 4 },
        { label: "Online benefit", value: 2 },
        { label: "Shooting / handshake", value: 2 },
        { label: "Post-live tokutenkai", value: 3 },
        { label: "Media / IP", value: 3 },
        { label: "Production", value: 3 },
        { label: "Rest protection", value: 2 },
        { label: "Roster renewal", value: 1 },
      ],
      eventMix: "Balanced live/media",
      benefitPolicy: "Post-live tokutenkai standard",
      restPolicy: "Protected weekly",
      exposurePolicy: "Ace plus rotation",
      staffSignal: "Direct fan spending can support growth, but venue and staff load must stay controlled.",
      memberSignal: "Members benefit from momentum if recovery is respected.",
      fanSignal: "Fans want repeated chances to attend, meet members and see visible progress.",
      risk: "Confusing activity volume with durable fan conversion.",
    };
  }
  return {
    archetype: "Small-group rebuild",
    core: "Build trust through repeatable lives, member storytelling and controlled benefit access.",
    presetId: "tier_rebuild_default",
    values: [
      { label: "Live frequency", value: 3 },
      { label: "Online benefit", value: 1 },
      { label: "Shooting / handshake", value: 2 },
      { label: "Post-live tokutenkai", value: 3 },
      { label: "Media / IP", value: 1 },
      { label: "Production", value: 2 },
      { label: "Rest protection", value: 3 },
      { label: "Roster renewal", value: 2 },
    ],
    eventMix: "Small live rebuild",
    benefitPolicy: "Post-live tokutenkai standard",
    restPolicy: "Strict recovery",
    exposurePolicy: "Member story focus",
    staffSignal: "Cash needs discipline; small overreach can damage trust quickly.",
    memberSignal: "Members need clear roles, fair queues and recovery.",
    fanSignal: "Fans respond to sincerity, reliable activity and visible member access.",
    risk: "Losing trust through chaotic booking or weak member development.",
  };
}

function weightedAudiencePct(profile: FinanceAudienceProfile, key: keyof AudienceDemographicMix): number {
  const total = Math.max(1, profile.publicFans + profile.otakuFans + profile.coreFans);
  return (
    profile.publicFans * profile.publicDemographics[key] +
    profile.otakuFans * profile.otakuDemographics[key] +
    profile.coreFans * profile.coreDemographics[key]
  ) / total;
}

function renderFanDemographicsBars(profile: FinanceAudienceProfile): string {
  const male = Math.round(weightedAudiencePct(profile, "malePct"));
  const female = Math.max(0, 100 - male);
  const rows = [
    { label: "Youth <=22", pct: weightedAudiencePct(profile, "youthPct") },
    { label: "Young adult 23-34", pct: weightedAudiencePct(profile, "youngAdultPct") },
    { label: "Middle aged+ >=35", pct: weightedAudiencePct(profile, "middlePlusPct") },
  ];
  return `
    <div class="group-demo-bars">
      ${rows
        .map((row) => {
          const pct = Math.max(0, Math.min(100, Math.round(row.pct)));
          return `<div class="group-demo-row">
            <div class="group-demo-label"><span>${htmlEsc(row.label)}</span><strong>${pct}%</strong></div>
            <div class="group-demo-track" aria-label="${htmlEsc(`${row.label}: ${pct}%`)}">
              <div class="group-demo-fill" style="width:${pct}%">
                <span class="group-demo-male" style="width:${male}%"></span>
                <span class="group-demo-female" style="width:${female}%"></span>
              </div>
            </div>
          </div>`;
        })
        .join("")}
      <div class="group-demo-legend">
        <span><i class="group-demo-dot group-demo-dot-male"></i>Male ${male}%</span>
        <span><i class="group-demo-dot group-demo-dot-female"></i>Female ${female}%</span>
      </div>
    </div>`;
}

function renderStrategyValueBars(profile: GroupStrategyProfile): string {
  return `<div class="group-strategy-bars">${profile.values
    .map((row) => {
      const value = Math.max(0, Math.min(5, Math.round(row.value)));
      return `<div class="group-strategy-row">
        <div class="group-strategy-label"><span>${htmlEsc(row.label)}</span><strong>${value}/5</strong></div>
        <div class="group-strategy-meter"><span style="width:${value * 20}%"></span></div>
      </div>`;
    })
    .join("")}</div>`;
}

function historyMatchesGroup(e: Record<string, unknown>, groupUid: string, groupName: string): boolean {
  const uid = String(e.group_uid ?? "").trim();
  const gn = String(e.group_name ?? "").trim();
  if (uid && groupUid && uid === groupUid) return true;
  return ilifeNameAliases(groupName).has(gn) || gn === groupName;
}

function joinDateInCurrentGroup(
  idol: Record<string, unknown>,
  groupUid: string,
  groupName: string,
): string {
  const hist = idol.group_history;
  if (!Array.isArray(hist)) return "—";
  let best: string | null = null;
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (!historyMatchesGroup(e, groupUid, groupName)) continue;
    const sd = typeof e.start_date === "string" ? e.start_date.trim().split("T")[0] : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(sd)) continue;
    const end = e.end_date == null || e.end_date === "" ? null : String(e.end_date).split("T")[0];
    // Prefer open-ended tenure; else earliest start among matches.
    if (!end) return sd;
    if (!best || sd < best) best = sd;
  }
  return best ?? "—";
}

function memberColorInCurrentGroup(
  idol: Record<string, unknown>,
  groupUid: string,
  groupName: string,
): { label: string; code: unknown } {
  const hist = idol.group_history;
  const fallback = (): { label: string; code: unknown } => {
    const raw =
      typeof idol.member_color === "string" && idol.member_color.trim()
        ? String(idol.member_color).trim()
        : "—";
    const label = raw === "—" ? raw : normalizeMemberColorLabel(raw) || "—";
    return { label, code: idol.member_color_code };
  };
  if (!Array.isArray(hist)) return fallback();

  type Cand = { color: string; code: unknown; open: boolean; start: string };
  const cands: Cand[] = [];
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    if (!historyMatchesGroup(e, groupUid, groupName)) continue;
    const c = typeof e.member_color === "string" ? e.member_color.trim() : "";
    if (!c) continue;
    const start = typeof e.start_date === "string" ? e.start_date.trim().split("T")[0] : "";
    const end = e.end_date == null || e.end_date === "" ? null : String(e.end_date).split("T")[0];
    cands.push({ color: c, code: e.member_color_code, open: !end, start });
  }
  if (!cands.length) return fallback();
  cands.sort((a, b) => {
    if (a.open !== b.open) return a.open ? -1 : 1;
    return b.start.localeCompare(a.start);
  });
  return {
    label: normalizeMemberColorLabel(cands[0].color) || "—",
    code: cands[0].code,
  };
}

function membershipLinksHtml(mems: { uid: string; name: string }[]): string {
  if (!mems.length) return htmlEsc("—");
  return mems
    .map((m) =>
      m.uid
        ? `<button type="button" class="idol-detail-group-link" data-group-detail="${htmlEsc(m.uid)}">${htmlEsc(m.name)}</button>`
        : htmlEsc(m.name),
    )
    .join(", ");
}

function allGroupsMembershipHtml(
  idol: Record<string, unknown>,
  referenceIso: string | undefined,
  groups: Record<string, unknown>[],
): string {
  return membershipLinksHtml(activeGroupMembershipsAtReference(idol, referenceIso, groups));
}

function rosterTheadHtml(lang: UiLanguage): string {
  return `<thead><tr><th>${htmlEsc(t(lang, "group_name"))}</th><th>${htmlEsc(t(lang, "group_romaji"))}</th><th>${htmlEsc(t(lang, "group_color"))}</th><th>${htmlEsc(t(lang, "idol_age"))}</th><th>${htmlEsc(t(lang, "group_join"))}</th><th>${htmlEsc(t(lang, "group_groups"))}</th></tr></thead>`;
}

/** One roster row for current or past members (group detail). */
function rosterMemberRowHtml(
  uid: string,
  displayJa: string,
  idol: Record<string, unknown> | undefined,
  gid: string,
  groupName: string,
  refIso: string | undefined,
  groups: Record<string, unknown>[],
): string {
  const romaji = idol ? romajiFromRow(idol) : "";
  const colorInfo = idol
    ? memberColorInCurrentGroup(idol, gid, groupName)
    : { label: "—", code: undefined };
  const color = colorInfo.label;
  const colorTrim = color.trim();
  const join = idol ? joinDateInCurrentGroup(idol, gid, groupName) : "—";
  const age = idol ? ageLabel(idol, refIso) : "—";
  const groupsCol = idol ? allGroupsMembershipHtml(idol, refIso, groups) : htmlEsc("—");
  const colorCss = resolveMemberColorCss(colorTrim, colorInfo.code);
  const colorLabelStyle = colorCss ? ` style="color:${colorCss}"` : "";
  const colorCell = colorCss
    ? `<span class="group-member-color-chip" style="background:${colorCss}" title="${htmlEsc(color)}"></span><span class="group-member-color-text"${colorLabelStyle}>${htmlEsc(color)}</span>`
    : `<span class="group-member-color-chip group-member-color-chip--default" title="${htmlEsc(color !== "—" ? color : "Default")}"></span> ${htmlEsc(color !== "—" ? color : "—")}`;
  const nameBtn = idol
    ? `<button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(displayJa)}</button>`
    : htmlEsc(displayJa);
  const nameStyle = colorCss ? ` style="color:${colorCss}"` : "";
  const nameCell = `<span class="group-roster-name-wrap"${nameStyle}>${nameBtn}</span>`;
  return `<tr><td>${nameCell}</td><td>${romaji ? htmlEsc(romaji) : htmlEsc("—")}</td><td>${colorCell}</td><td class="group-roster-stat">${htmlEsc(age)}</td><td class="group-roster-stat">${htmlEsc(join)}</td><td>${groupsCol}</td></tr>`;
}

function pictureBasename(raw: string): string {
  return raw.replace(/\\/g, "/").split("/").pop()?.trim().toLowerCase() ?? "";
}

function pickGroupHeroPicturePaths(g: Record<string, unknown>): { heroRaw: string | null; logoRaw: string | null } {
  const pics = Array.isArray(g.pictures)
    ? (g.pictures as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "").map((p) => p.trim())
    : [];
  const isLogo = (p: string) => /logo/i.test(pictureBasename(p));
  const isIcon = (p: string) => /icon/i.test(pictureBasename(p)) && !isLogo(p);
  const logos = pics.filter(isLogo);
  const icons = pics.filter(isIcon);
  const photos = pics.filter((p) => !isLogo(p) && !isIcon(p));

  // Prefer a real photo as hero; fall back to brand icon, then any non-logo.
  const hero = photos[0] ?? icons[0] ?? pics.find((p) => !isLogo(p)) ?? pics[0] ?? null;
  const logo = logos[0] ?? null;

  // Corner badge only on photo heroes — icon/logo heroes are already brand art.
  if (!hero || !logo || isIcon(hero) || isLogo(hero)) {
    return { heroRaw: hero, logoRaw: null };
  }
  if (pictureBasename(hero) === pictureBasename(logo)) {
    return { heroRaw: hero, logoRaw: null };
  }
  return { heroRaw: hero, logoRaw: logo };
}

function earliestReleaseAmongSongs(songs: Record<string, unknown>[]): string {
  const dates = songs
    .map((s) => String(s.release_date ?? "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d));
  if (!dates.length) return "—";
  dates.sort();
  return dates[0] ?? "—";
}

function discographyEditionBreakdownHtml(d: Record<string, unknown>): string {
  const shared = effectiveSharedTracks(d);
  const eds = effectiveEditionSlices(d);

  const listHtml = (lines: string[]): string =>
    lines.length === 0
      ? `<p class="content-muted">${htmlEsc("—")}</p>`
      : `<ol class="group-disc-track-ol">${lines.map((line) => `<li>${htmlEsc(line)}</li>`).join("")}</ol>`;

  const chunks: string[] = [];
  if (shared.length) {
    chunks.push(
      `<details class="group-disc-track-detail"><summary>${htmlEsc("Shared tracks (all editions)")}</summary>${listHtml(
        shared,
      )}</details>`,
    );
  }
  for (const e of eds) {
    chunks.push(
      `<details class="group-disc-track-detail"><summary>${htmlEsc(e.label)}</summary>${listHtml(e.track_list)}</details>`,
    );
  }
  return chunks.join("");
}

function renderDiscographyRowsFromGroupJson(
  g: Record<string, unknown>,
  referenceIso: string | null,
): string {
  const refT = parseCatalogIsoToTime(referenceIso);
  const rawDisc = Array.isArray(g.discography)
    ? (g.discography as unknown[]).filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    : [];
  if (!rawDisc.length) return "";
  const sorted = [...rawDisc].sort((a, b) =>
    String(a.release_date ?? "").localeCompare(String(b.release_date ?? "")),
  );
  const visible = sorted.filter((d) => {
    const rd = parseCatalogIsoToTime(String(d.release_date ?? ""));
    if (refT == null) return true;
    if (rd == null) return true;
    return rd <= refT;
  });
  if (!visible.length) {
    return `<tr><td colspan="4" class="content-muted">${htmlEsc("No releases on or before the reference date.")}</td></tr>`;
  }
  const rows = visible.flatMap((d) => {
    const t = String(d.title ?? d.title_romanji ?? "—").trim() || "—";
    const typ = String(d.disc_type ?? "").trim() || "—";
    const rel =
      typeof d.release_date === "string" && d.release_date.trim()
        ? d.release_date.trim().split("T")[0]
        : "—";
    const tc = Math.max(discMaxTrackSlotCount(d), Array.isArray(d.track_song_uids) ? d.track_song_uids.length : 0);
    const editions = summarizeEditionTrackTotals(d);
    const tcCell =
      editions.length > 0
        ? `<span class="num">${tc.toLocaleString("ja-JP")}</span><div class="content-muted group-disc-track-totals">${htmlEsc(
            editions,
          )}</div>`
        : tc.toLocaleString("ja-JP");
    const main = `<tr class="group-disc-row"><td>${htmlEsc(t)}</td><td>${htmlEsc(typ)}</td><td class="num">${htmlEsc(
      rel,
    )}</td><td class="num">${tcCell}</td></tr>`;
    if (!discUsesEditionTrackLayout(d)) return [main];
    const detail = `<tr class="group-disc-edition-row"><td colspan="4" class="group-disc-edition-cell">${discographyEditionBreakdownHtml(
      d,
    )}</td></tr>`;
    return [main, detail];
  });
  return rows.join("");
}

function renderDiscographyRowsFromSongBuckets(teamSongs: Record<string, unknown>[]): string {
  const buckets = buildDiscBuckets(teamSongs);
  if (!buckets.length) {
    return `<tr><td colspan="4" class="content-muted">${htmlEsc("No discography inferred from song rows yet.")}</td></tr>`;
  }
  return buckets
    .map((b) => {
      const rel = earliestReleaseAmongSongs(b.songs);
      const typ =
        b.songs.map((s) => String(s.disc_type ?? "").trim()).find(Boolean) || "—";
      return `<tr><td>${htmlEsc(b.label)}</td><td>${htmlEsc(typ)}</td><td class="num">${htmlEsc(rel)}</td><td class="num">${b.songs.length.toLocaleString("ja-JP")}</td></tr>`;
    })
    .join("");
}

function renderLivesRows(
  lives: Record<string, unknown>[] | null,
  groupName: string,
  referenceIso: string | null,
): string {
  const refT = parseCatalogIsoToTime(referenceIso);
  if (!lives?.length) {
    return `<tr><td colspan="4" class="content-muted">${htmlEsc("No live catalog loaded.")}</td></tr>`;
  }
  const gn = groupName.trim();
  const rows = lives.filter((lv) => {
    const gr = lv.group;
    const ok = Array.isArray(gr) && gr.some((x) => String(x) === gn);
    if (!ok) return false;
    const sd = parseCatalogIsoToTime(String(lv.start_date ?? ""));
    if (refT != null && sd != null && sd > refT) return false;
    return true;
  });
  if (!rows.length) {
    return `<tr><td colspan="4" class="content-muted">${htmlEsc("No lives for this group in the catalog (or all are after the reference date).")}</td></tr>`;
  }
  return rows
    .slice(0, 30)
    .map((lv) => {
      const d = String(lv.start_date ?? "").trim().split("T")[0] || "—";
      const title = String(lv.title ?? "—").trim() || "—";
      const venue = String(lv.venue ?? "—").trim() || "—";
      const typ = String(lv.event_type ?? "—").trim() || "—";
      return `<tr><td class="num">${htmlEsc(d)}</td><td>${htmlEsc(title)}</td><td>${htmlEsc(venue)}</td><td>${htmlEsc(typ)}</td></tr>`;
    })
    .join("");
}

export interface GroupDetailPageCtx {
  idols: Record<string, unknown>[];
  songs: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  lives: Record<string, unknown>[] | null;
  referenceIso: string | null;
  sharedReleases?: Record<string, unknown>[] | null;
  lang?: UiLanguage;
}

function renderDiscographyRowsFromReleaseRows(
  rows: { title: string; discType: string; releaseDate: string; trackCount: number }[],
): string {
  if (!rows.length) {
    return `<tr><td colspan="4" class="content-muted">${htmlEsc("No releases on or before the reference date.")}</td></tr>`;
  }
  return rows
    .map(
      (row) =>
        `<tr><td>${htmlEsc(row.title)}</td><td>${htmlEsc(row.discType)}</td><td class="num">${htmlEsc(
          row.releaseDate,
        )}</td><td class="num">${row.trackCount.toLocaleString("ja-JP")}</td></tr>`,
    )
    .join("");
}

export function renderGroupDetailPage(
  g: Record<string, unknown>,
  contextLabel: string,
  ctx: GroupDetailPageCtx,
): string {
  const name = String(g.name ?? g.name_romanji ?? "—");
  const lang = ctx.lang ?? "en";
  const romanji = String(g.name_romanji ?? "").trim();
  const nick = typeof g.nickname === "string" ? g.nickname.trim() : "";
  const nickR = typeof g.nickname_romanji === "string" ? g.nickname_romanji.trim() : "";
  const tier = resolveGroupLetterTier(g);
  const fans = groupFansNum(g);
  const pop = groupPopNum(g);
  const formed = typeof g.formed_date === "string" ? g.formed_date : "—";
  const gid = String(g.uid ?? "").trim();
  const memberUids = Array.isArray(g.member_uids)
    ? (g.member_uids as unknown[]).map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  const memberNames = Array.isArray(g.member_names)
    ? (g.member_names as unknown[]).map((n) => String(n ?? "").trim())
    : [];
  const pastUids = Array.isArray(g.past_member_uids)
    ? (g.past_member_uids as unknown[]).map((u) => String(u ?? "").trim()).filter(Boolean)
    : [];
  const pastNames = Array.isArray(g.past_member_names)
    ? (g.past_member_names as unknown[]).map((n) => String(n ?? "").trim())
    : [];
  const wikiUrl =
    typeof g.wiki_url === "string" && g.wiki_url.trim().startsWith("http") ? g.wiki_url.trim() : "";
  const wikiBlock = wikiUrl
    ? `<p class="content-muted group-detail-wiki"><a href="${attrQuotedUrl(wikiUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "common_wiki"))}</a></p>`
    : "";

  const agencies = Array.isArray(g.agencies)
    ? (g.agencies as unknown[]).map((a) => String(a).trim()).filter(Boolean).join(", ")
    : "";
  const producers =
    typeof g.producers === "string" && g.producers.trim() ? g.producers.trim() : "";
  const union = typeof g.union === "string" && g.union.trim() ? g.union.trim() : "—";

  const rawDesc = typeof g.description === "string" ? g.description.trim() : "";
  const desc =
    rawDesc.length > 0
      ? `<p class="group-detail-desc">${htmlEsc(rawDesc.slice(0, 900))}${rawDesc.length > 900 ? "…" : ""}</p>`
      : "";

  const { heroRaw, logoRaw } = pickGroupHeroPicturePaths(g);
  const heroSrc = heroRaw ? groupPicturePublicSrc(heroRaw) : undefined;
  const logoSrc = logoRaw ? groupPicturePublicSrc(logoRaw) : undefined;
  const initial = [...(name.trim() || "?")][0] ?? "?";
  const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
  const heroHtml = heroSrc
    ? `<div class="group-detail-hero-frame"><img class="group-detail-hero" src="${attrQuotedUrl(heroSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />${
        logoSrc
          ? `<img class="group-detail-logo" src="${attrQuotedUrl(logoSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
          : ""
      }</div>`
    : `<div class="group-detail-hero-ph" aria-hidden="true">${htmlEsc(initial)}</div>`;

  const refShort = ctx.referenceIso ? String(ctx.referenceIso).trim().split("T")[0] : "";
  const refNote =
    refShort && /^\d{4}-\d{2}-\d{2}$/.test(refShort) ? ` ${t(lang, "common_as_of", { date: refShort })}` : "";

  const teamSongs = songsForDisplaySorted(ctx.songs).filter((s) => String(s.group_uid ?? "") === gid);
  const songCount = teamSongs.length;
  const mergedDiscRows = buildGroupDiscographyReleaseRows(
    g,
    ctx.referenceIso,
    ctx.sharedReleases ?? [],
    songsForDisplaySorted(ctx.songs),
  );
  const discCount = mergedDiscRows.length || buildDiscBuckets(teamSongs).length;
  const audienceProfile = financeAudienceProfileForGroup({
    groupName: g.name,
    groupRomaji: g.name_romanji,
    letterTier: tier,
    fans,
  });
  const strategyProfile = strategyForGroup(g);

  const songsBtn = gid
    ? `<button type="button" class="group-detail-fact-link" data-open-songs-for-group="${encodeURIComponent(gid)}">${htmlEsc(
        t(lang, "group_songs_count", { count: songCount.toLocaleString("ja-JP") }),
      )}</button>`
    : htmlEsc(t(lang, "group_songs_count", { count: songCount.toLocaleString("ja-JP") }));

  const subtitleBits = [romanji ? romanji : "", nick ? `${t(lang, "idol_nickname")}: ${nick}` : "", nickR ? nickR : ""].filter(Boolean);
  const subtitle = subtitleBits.length ? `<p class="content-muted group-detail-sub">${htmlEsc(subtitleBits.join(" | "))}</p>` : "";

  const byUid = idolMapByUid(ctx.idols);
  const refIsoU = ctx.referenceIso ?? undefined;

  const currentRows = memberUids
    .map((uid, i) => {
      const idol = byUid.get(uid);
      const stage = memberNames[i] ?? "";
      const displayJa = idol ? stage || String(idol.name ?? "—") : stage || uid.slice(0, 8);
      return rosterMemberRowHtml(uid, displayJa, idol, gid, name, refIsoU, ctx.groups);
    })
    .join("");

  const currentTable =
    memberUids.length > 0
      ? `<div class="table-scroll"><table class="fm-table group-detail-roster-table">${rosterTheadHtml(lang)}<tbody>${currentRows}</tbody></table></div>`
      : `<p class="content-muted">${htmlEsc(t(lang, "group_no_current_members"))}</p>`;

  let pastBlock = "";
  if (pastUids.length) {
    const prow = pastUids
      .map((uid, i) => {
        const idol = byUid.get(uid);
        const displayJa =
          (pastNames[i] && String(pastNames[i]).trim()) || (idol ? String(idol.name ?? "—") : uid.slice(0, 8));
        return rosterMemberRowHtml(uid, displayJa, idol, gid, name, refIsoU, ctx.groups);
      })
      .join("");
    pastBlock = `<details class="group-detail-past"><summary class="group-detail-past-sum">${htmlEsc(
      t(lang, "group_past_members", { count: pastUids.length.toLocaleString("ja-JP") }),
    )}</summary><div class="table-scroll"><table class="fm-table group-detail-roster-table">${rosterTheadHtml(lang)}<tbody>${prow}</tbody></table></div></details>`;
  }

  const discBody =
    mergedDiscRows.length > 0
      ? renderDiscographyRowsFromReleaseRows(mergedDiscRows)
      : renderDiscographyRowsFromSongBuckets(teamSongs);

  return `
<section class="content-panel group-detail-view" aria-label="${htmlEsc(name)}">
  <header class="idol-detail-toolbar">
    <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc("← Groups")}</button>
    <span class="content-muted idol-detail-ref">${htmlEsc(contextLabel)}</span>
  </header>
  <nav class="workspace-tabs group-detail-tabs" aria-label="Group detail tabs">
    <a class="workspace-tab is-active" href="#group-detail-overview">${htmlEsc("Overview")}</a>
    <a class="workspace-tab" href="#group-detail-strategy">${htmlEsc("Strategy")}</a>
  </nav>
  <div class="fm-card group-detail-head" id="group-detail-overview">
    <div class="group-detail-hero-cols">
      <div class="group-detail-hero-left">${heroHtml}</div>
      <div class="group-detail-hero-main">
        <h2 class="content-h2">${htmlEsc(name)}</h2>
        ${subtitle}
        <p class="group-detail-facts-row content-muted">
          <span>${htmlEsc(t(lang, "group_members_count", { count: memberUids.length.toLocaleString("ja-JP") }))}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${htmlEsc(t(lang, "group_past_count", { count: pastUids.length.toLocaleString("ja-JP") }))}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${htmlEsc(t(lang, "group_discography_count", { count: discCount.toLocaleString("ja-JP") }))}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${songsBtn}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${htmlEsc(t(lang, "group_formed", { date: formed }))}</span>
        </p>
        <dl class="basic-dl group-detail-meta-dl">
          <div><dt>${htmlEsc(t(lang, "group_tier"))}</dt><dd>${htmlEsc(tier === "I" ? (lang === "zh-CN" ? "I（非活跃）" : "I (Inactive)") : tier)}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_fans"))}</dt><dd>${fans.toLocaleString("ja-JP")}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_x_followers"))}</dt><dd>${(typeof g.x_followers === "number" ? g.x_followers : Number(g.x_followers ?? 0) || 0).toLocaleString("ja-JP")}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_popularity"))}</dt><dd>${String(pop)}</dd></div>
          <div><dt>${htmlEsc(lang === "zh-CN" ? "声誉" : "Reputation")}</dt><dd>${htmlEsc(String(Math.round(Number(g.reputation ?? 0)) || "—"))}/5</dd></div>
          <div><dt>${htmlEsc("Agencies")}</dt><dd>${htmlEsc(agencies || "—")}</dd></div>
          <div><dt>${htmlEsc("Producers")}</dt><dd>${htmlEsc(producers || "—")}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_union"))}</dt><dd>${htmlEsc(union)}</dd></div>
        </dl>
        ${wikiBlock}
        ${desc}
      </div>
      <aside class="group-detail-demo-aside" aria-label="Fan demographics">
        <div class="group-detail-aside-title">${htmlEsc("Fan demographics")}</div>
        ${renderFanDemographicsBars(audienceProfile)}
        <dl class="basic-dl group-demo-layer-dl group-demo-layer-dl-compact">
          <div><dt>${htmlEsc("Public")}</dt><dd>${audienceProfile.publicFans.toLocaleString("ja-JP")}</dd></div>
          <div><dt>${htmlEsc("Otaku")}</dt><dd>${audienceProfile.otakuFans.toLocaleString("ja-JP")}</dd></div>
          <div><dt>${htmlEsc("Core")}</dt><dd>${audienceProfile.coreFans.toLocaleString("ja-JP")}</dd></div>
        </dl>
      </aside>
    </div>
  </div>

  <div class="fm-card group-detail-section">
    <div class="group-detail-section-head">${htmlEsc(t(lang, "group_section_idols"))}</div>
    <div class="group-detail-section-body">
      ${currentTable}
      ${pastBlock}
    </div>
  </div>

  <div class="fm-card group-detail-section">
    <div class="group-detail-section-head">${htmlEsc(t(lang, "group_section_discography"))}${htmlEsc(refNote)}</div>
    <div class="group-detail-section-body">
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(t(lang, "group_title"))}</th><th>${htmlEsc(t(lang, "group_type"))}</th><th>${htmlEsc(t(lang, "group_release"))}</th><th>${htmlEsc(t(lang, "group_tracks"))}</th></tr></thead>
          <tbody>${discBody}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="fm-card group-detail-section">
    <div class="group-detail-section-head">${htmlEsc(t(lang, "group_section_lives"))}${htmlEsc(refNote)}</div>
    <div class="group-detail-section-body">
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc(t(lang, "group_date"))}</th><th>${htmlEsc(t(lang, "group_title"))}</th><th>${htmlEsc(t(lang, "group_venue"))}</th><th>${htmlEsc(t(lang, "group_type"))}</th></tr></thead>
          <tbody>${renderLivesRows(ctx.lives, name, ctx.referenceIso)}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="fm-card group-detail-section" id="group-detail-strategy">
    <div class="group-detail-section-head">${htmlEsc("Strategy")}</div>
    <div class="group-detail-section-body">
      <div class="group-strategy-grid">
        <div>
          <p class="group-strategy-archetype">${htmlEsc(strategyProfile.archetype)}</p>
          <p class="content-muted group-strategy-core">${htmlEsc(strategyProfile.core)}</p>
          ${renderStrategyValueBars(strategyProfile)}
        </div>
        <div class="group-strategy-side">
          <dl class="basic-dl group-strategy-dl">
            <div><dt>${htmlEsc("Preset")}</dt><dd>${htmlEsc(strategyProfile.presetId)}</dd></div>
            <div><dt>${htmlEsc("Event mix")}</dt><dd>${htmlEsc(strategyProfile.eventMix)}</dd></div>
            <div><dt>${htmlEsc("Benefit policy")}</dt><dd>${htmlEsc(strategyProfile.benefitPolicy)}</dd></div>
            <div><dt>${htmlEsc("Rest policy")}</dt><dd>${htmlEsc(strategyProfile.restPolicy)}</dd></div>
            <div><dt>${htmlEsc("Exposure")}</dt><dd>${htmlEsc(strategyProfile.exposurePolicy)}</dd></div>
          </dl>
          <div class="group-strategy-signals">
            <p><strong>${htmlEsc("Staff")}</strong><span>${htmlEsc(strategyProfile.staffSignal)}</span></p>
            <p><strong>${htmlEsc("Members")}</strong><span>${htmlEsc(strategyProfile.memberSignal)}</span></p>
            <p><strong>${htmlEsc("Fans")}</strong><span>${htmlEsc(strategyProfile.fanSignal)}</span></p>
            <p><strong>${htmlEsc("Risk")}</strong><span>${htmlEsc(strategyProfile.risk)}</span></p>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}
