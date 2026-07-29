/**
 * Immersive Live Mode — full content area under the top bar.
 * Left: setlist + time progression. Right: formation + transport controls.
 */

import { songCatalogDisplayLabel, songCatalogMatchesPick } from "../data/songCatalog";
import { songsForDisplaySorted } from "../data/songDisplayPolicy";
import {
  activeRoleAssignmentsFromHistoryEntry,
  roleAssignmentsFromHistoryEntry,
} from "../data/memberRoles";
import { isIdolOnHiatus } from "../engine/idolStatusSystem";
import { deterministicNoise } from "../engine/livePerformanceWeb";
import { managedSetlistEffect, type ManagedSongStatusRow } from "../engine/songStatusSystem";
import { getPrimaryGroup, type GameSavePayload } from "../save/gameSaveSchema";
import { htmlEsc } from "./htmlEsc";
import type { UiLanguage } from "./i18n";
import { t } from "./i18n";
import { attrQuotedUrl, avatarPlaceholderDataUrl, idolPortraitPublicSrc } from "./portraitUrl";
import {
  previewInputFromSongRow,
  songHasPreviewSource,
  type PreviewResolveInput,
} from "./songPreviewPlayer";

export type LiveModeItemKind = "song" | "mc" | "break";

export type LiveModeProgramItem = {
  id: string;
  kind: LiveModeItemKind;
  label: string;
  /** Wall-clock seconds for MC/break; songs use preview media duration when available. */
  durationSec: number;
  songUid?: string;
  songTitle?: string;
  preview?: PreviewResolveInput | null;
  hasPreview: boolean;
  /** Audience reaction bias for this slot (−18…+22), from familiarity / segment type. */
  reactionBias: number;
};

export type LiveModeMember = {
  uid: string;
  name: string;
  color: string;
  isCenter: boolean;
  x: number;
  y: number;
};

export type LiveModeReactionBand = "cold" | "warm" | "hot" | "peak";

export type LiveModeReactionSnapshot = {
  level: number;
  band: LiveModeReactionBand;
  label: string;
  pulse: string;
};

export type LiveModeSession = {
  notificationUid: string;
  dateIso: string;
  liveUid: string;
  liveTitle: string;
  venue: string;
  items: LiveModeProgramItem[];
  members: LiveModeMember[];
  currentIndex: number;
  /** playing | paused | idle */
  transport: "playing" | "paused" | "idle";
  /** Wall-clock progress within the current non-song item (or fallback for songs). */
  itemElapsedSec: number;
  itemStartedAtMs: number | null;
  /** Baseline audience energy from roster/group (0–100). */
  reactionBase: number;
  /** Whole-setlist familiarity/fatigue delta from the performance model. */
  setlistDelta: number;
  /** Smoothed audience heat shown on the reaction bar (0–100). */
  audienceHeat: number;
};

const BLOCK_DURATION_CAP_SEC = 8;
const BLOCK_DURATION_FLOOR_SEC = 3;
const SONG_FALLBACK_DURATION_SEC = 30;

function localized(lang: UiLanguage, en: string, zh: string): string {
  return lang === "zh-CN" ? zh : en;
}

function idolDisplayName(row: Record<string, unknown>): string {
  return String(row.name ?? row.name_romanji ?? row.uid ?? "—").trim() || "—";
}

function idolColor(row: Record<string, unknown>): string {
  const c = String(row.color_code ?? row.color ?? "").trim();
  return /^#[0-9a-fA-F]{3,8}$/.test(c) ? c : "#94a3b8";
}

function groupHistoryEntryForIdol(
  idol: Record<string, unknown>,
  groupUid: string,
): Record<string, unknown> | null {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const entry = raw as Record<string, unknown>;
    if (String(entry.group_uid ?? "") === groupUid) return entry;
  }
  return null;
}

function isCenterMember(idol: Record<string, unknown>, groupUid: string, asOf: string): boolean {
  const entry = groupHistoryEntryForIdol(idol, groupUid);
  if (!entry) return false;
  const roles =
    activeRoleAssignmentsFromHistoryEntry(entry, asOf).length > 0
      ? activeRoleAssignmentsFromHistoryEntry(entry, asOf)
      : roleAssignmentsFromHistoryEntry(entry);
  return roles.some((r) => r.key === "center" || r.key === "performance_center");
}

/** Classic trapezoid stage slots: front row fewer, center near bottom-middle. */
export function formationSlots(count: number): Array<{ x: number; y: number }> {
  const n = Math.max(0, count);
  if (n === 0) return [];
  if (n === 1) return [{ x: 50, y: 62 }];
  if (n === 2) return [{ x: 38, y: 58 }, { x: 62, y: 58 }];
  if (n === 3) return [{ x: 28, y: 42 }, { x: 50, y: 64 }, { x: 72, y: 42 }];
  if (n === 4) return [{ x: 22, y: 40 }, { x: 40, y: 62 }, { x: 60, y: 62 }, { x: 78, y: 40 }];
  if (n === 5) {
    return [
      { x: 18, y: 34 },
      { x: 36, y: 34 },
      { x: 50, y: 66 },
      { x: 64, y: 34 },
      { x: 82, y: 34 },
    ];
  }
  if (n === 6) {
    return [
      { x: 16, y: 32 },
      { x: 34, y: 32 },
      { x: 52, y: 32 },
      { x: 32, y: 64 },
      { x: 50, y: 64 },
      { x: 68, y: 64 },
    ];
  }
  // 7+: back row ceil(n/2), front floor(n/2) with center bias
  const front = Math.floor(n / 2);
  const back = n - front;
  const slots: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < back; i++) {
    const t = back === 1 ? 0.5 : i / (back - 1);
    slots.push({ x: 12 + t * 76, y: 30 });
  }
  for (let i = 0; i < front; i++) {
    const t = front === 1 ? 0.5 : i / (front - 1);
    slots.push({ x: 22 + t * 56, y: 66 });
  }
  return slots;
}

function orderMembersForFormation(
  idols: Record<string, unknown>[],
  groupUid: string,
  asOf: string,
): Record<string, unknown>[] {
  const scored = idols.map((idol, index) => {
    const center = isCenterMember(idol, groupUid, asOf);
    return { idol, center, index };
  });
  scored.sort((a, b) => Number(b.center) - Number(a.center) || a.index - b.index);
  // Place center at front-middle slot: for odd layouts slot algorithm puts center-ish last in front.
  // Reorder so center is assigned the front-most center-looking slot by putting them mid-array for n=5 etc.
  if (scored.length >= 3) {
    const centerIdx = scored.findIndex((s) => s.center);
    if (centerIdx >= 0) {
      const [center] = scored.splice(centerIdx, 1);
      const insertAt = Math.floor(scored.length / 2);
      scored.splice(insertAt, 0, center);
    }
  }
  return scored.map((s) => s.idol);
}

function findSongByTitle(
  songs: Record<string, unknown>[],
  title: string,
): Record<string, unknown> | null {
  const pick = String(title ?? "").trim();
  if (!pick) return null;
  return songs.find((row) => songCatalogMatchesPick(pick, row)) ?? null;
}

function blockDurationSec(minutes: number): number {
  const raw = Number(minutes) || 0;
  if (raw <= 0) return BLOCK_DURATION_FLOOR_SEC;
  return Math.max(BLOCK_DURATION_FLOOR_SEC, Math.min(BLOCK_DURATION_CAP_SEC, raw));
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function num(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return fallback;
}

function songReactionBias(
  statusMap: Record<string, { familiarity?: number; rotation_fatigue?: number }>,
  songUid: string | undefined,
): number {
  if (!songUid) return -4;
  const row = statusMap[songUid];
  if (!row) return -2;
  const fam = num(row.familiarity, 50);
  const fat = num(row.rotation_fatigue, 0);
  return clamp((fam - 58) / 4.2 - fat / 22, -16, 18);
}

function rosterReactionBase(members: Record<string, unknown>[], group: Record<string, unknown> | null): number {
  if (!members.length) return 48;
  const avgCondition = members.reduce((s, m) => s + num(m.condition, 90), 0) / members.length;
  const avgMorale = members.reduce((s, m) => s + num(m.morale, 70), 0) / members.length;
  const pop = num(group?.popularity, 40);
  return clamp(32 + avgCondition * 0.28 + avgMorale * 0.22 + pop * 0.18, 28, 88);
}

export function buildLiveModeProgram(
  live: Record<string, unknown>,
  songs: Record<string, unknown>[],
  statusMap: Record<string, { familiarity?: number; rotation_fatigue?: number }> = {},
): LiveModeProgramItem[] {
  const program = Array.isArray(live.program) ? live.program : [];
  const items: LiveModeProgramItem[] = [];
  if (program.length) {
    program.forEach((raw, index) => {
      if (!raw || typeof raw !== "object") return;
      const row = raw as Record<string, unknown>;
      const kindRaw = String(row.kind ?? "song").trim().toLowerCase();
      const kind: LiveModeItemKind =
        kindRaw === "mc" ? "mc" : kindRaw === "break" ? "break" : "song";
      const label = String(row.label ?? row.songTitle ?? "").trim() || `Item ${index + 1}`;
      if (kind === "song") {
        const songTitle = String(row.songTitle ?? row.label ?? "").trim();
        const song = findSongByTitle(songs, songTitle);
        const preview = song ? previewInputFromSongRow(song) : null;
        const songUid = song ? String(song.uid ?? "") : undefined;
        items.push({
          id: `p-${index}`,
          kind: "song",
          label: song ? songCatalogDisplayLabel(song) : label,
          durationSec: SONG_FALLBACK_DURATION_SEC,
          songUid,
          songTitle,
          preview,
          hasPreview: song ? songHasPreviewSource(song) : false,
          reactionBias: songReactionBias(statusMap, songUid),
        });
      } else {
        items.push({
          id: `p-${index}`,
          kind,
          label,
          durationSec: blockDurationSec(Number(row.durationMinutes ?? 0) || 0),
          hasPreview: false,
          reactionBias: kind === "mc" ? 2 : -6,
        });
      }
    });
    return items;
  }

  const setlist = Array.isArray(live.setlist) ? live.setlist : [];
  setlist.forEach((raw, index) => {
    const songTitle = String(raw ?? "").trim();
    if (!songTitle) return;
    const song = findSongByTitle(songs, songTitle);
    const preview = song ? previewInputFromSongRow(song) : null;
    const songUid = song ? String(song.uid ?? "") : undefined;
    items.push({
      id: `s-${index}`,
      kind: "song",
      label: song ? songCatalogDisplayLabel(song) : songTitle,
      durationSec: SONG_FALLBACK_DURATION_SEC,
      songUid,
      songTitle,
      preview,
      hasPreview: song ? songHasPreviewSource(song) : false,
      reactionBias: songReactionBias(statusMap, songUid),
    });
  });
  return items;
}

export function todaysManagedLives(save: GameSavePayload, dateIso: string): Record<string, unknown>[] {
  const group = getPrimaryGroup(save);
  const gid = String(group?.uid ?? "");
  if (!gid) return [];
  return (save.lives?.schedules ?? []).filter((raw): raw is Record<string, unknown> => {
    if (!raw || typeof raw !== "object") return false;
    const live = raw as Record<string, unknown>;
    const sd = String(live.start_date ?? "").split("T")[0];
    return sd === dateIso && String(live.group_uid ?? "") === gid && String(live.status ?? "") !== "played";
  });
}

export function buildLiveModeSession(opts: {
  save: GameSavePayload;
  notificationUid: string;
  dateIso: string;
  live?: Record<string, unknown> | null;
}): LiveModeSession | null {
  const { save, notificationUid, dateIso } = opts;
  const lives = todaysManagedLives(save, dateIso);
  const live = opts.live ?? lives[0] ?? null;
  if (!live) return null;

  const group = getPrimaryGroup(save);
  const gid = String(group?.uid ?? "");
  const memberUids = Array.isArray(group?.member_uids)
    ? (group!.member_uids as unknown[]).map((x) => String(x))
    : [];
  const idols = (save.database_snapshot.idols as Record<string, unknown>[]).filter((idol) => {
    const uid = String(idol.uid ?? "");
    if (!memberUids.includes(uid)) return false;
    return !isIdolOnHiatus(idol, dateIso);
  });
  const ordered = orderMembersForFormation(idols, gid, dateIso);
  const slots = formationSlots(ordered.length);
  const members: LiveModeMember[] = ordered.map((idol, i) => {
    const slot = slots[i] ?? { x: 50, y: 50 };
    return {
      uid: String(idol.uid ?? ""),
      name: idolDisplayName(idol),
      color: idolColor(idol),
      isCenter: isCenterMember(idol, gid, dateIso),
      x: slot.x,
      y: slot.y,
    };
  });

  const songs = songsForDisplaySorted(save.database_snapshot.songs).filter(
    (row) => String(row.group_uid ?? "") === gid,
  );
  const statusMap = (save.managed_song_status ?? {}) as Record<string, ManagedSongStatusRow>;
  const items = buildLiveModeProgram(live, songs, statusMap);
  if (!items.length) {
    items.push({
      id: "empty-0",
      kind: "mc",
      label: "MC",
      durationSec: BLOCK_DURATION_FLOOR_SEC,
      hasPreview: false,
      reactionBias: 1,
    });
  }

  const setlistTitles = items
    .filter((item) => item.kind === "song")
    .map((item) => item.songTitle || item.label)
    .filter(Boolean);
  const setlistEffect = managedSetlistEffect(statusMap, songs, gid, setlistTitles);
  const reactionBase = rosterReactionBase(ordered, group);
  const audienceHeat = clamp(reactionBase + setlistEffect.score_delta * 0.55, 28, 92);

  return {
    notificationUid,
    dateIso,
    liveUid: String(live.uid ?? ""),
    liveTitle: String(live.title ?? live.live_type ?? "Live"),
    venue: String(live.venue ?? ""),
    items,
    members,
    currentIndex: 0,
    transport: "idle",
    itemElapsedSec: 0,
    itemStartedAtMs: null,
    reactionBase,
    setlistDelta: setlistEffect.score_delta,
    audienceHeat,
  };
}

export function currentLiveModeItem(session: LiveModeSession): LiveModeProgramItem | null {
  return session.items[session.currentIndex] ?? null;
}

export function liveModeItemDurationSec(session: LiveModeSession, mediaDurationSec?: number | null): number {
  const item = currentLiveModeItem(session);
  if (!item) return 1;
  if (item.kind === "song") {
    const d = Number(mediaDurationSec ?? 0);
    return d > 0 && Number.isFinite(d) ? d : item.durationSec;
  }
  return item.durationSec;
}

/** Song arc: soft open → chorus lift → late peak → slight settle. */
function songProgressEnvelope(progress01: number): number {
  const p = clamp(progress01, 0, 1);
  if (p < 0.18) return 0.35 + (p / 0.18) * 0.25;
  if (p < 0.45) return 0.6 + ((p - 0.18) / 0.27) * 0.25;
  if (p < 0.78) return 0.85 + ((p - 0.45) / 0.33) * 0.2;
  return 1.05 - ((p - 0.78) / 0.22) * 0.18;
}

function reactionBandFor(level: number): LiveModeReactionBand {
  if (level >= 82) return "peak";
  if (level >= 68) return "hot";
  if (level >= 48) return "warm";
  return "cold";
}

function reactionLabel(lang: UiLanguage, band: LiveModeReactionBand): string {
  if (lang === "zh-CN") {
    if (band === "peak") return "全场沸腾";
    if (band === "hot") return "热情高涨";
    if (band === "warm") return "逐渐升温";
    return "气氛一般";
  }
  if (band === "peak") return "Arena roar";
  if (band === "hot") return "Crowd hyped";
  if (band === "warm") return "Warming up";
  return "Quiet floor";
}

function reactionPulse(lang: UiLanguage, band: LiveModeReactionBand, playing: boolean): string {
  if (!playing) return lang === "zh-CN" ? "……" : "…";
  if (lang === "zh-CN") {
    if (band === "peak") return "Wooo!! コール！";
    if (band === "hot") return "拍手！ 推！";
    if (band === "warm") return "嗯…好听";
    return "…";
  }
  if (band === "peak") return "Wooo!! Call!";
  if (band === "hot") return "Clap! Push!";
  if (band === "warm") return "Nice…";
  return "…";
}

/**
 * Instant target heat for the current program moment.
 * Uses roster baseline + setlist model delta + per-item bias + song arc.
 */
export function computeLiveModeReactionTarget(
  session: LiveModeSession,
  progress01: number,
): number {
  const item = currentLiveModeItem(session);
  const bias = item?.reactionBias ?? 0;
  const doneBoost = session.currentIndex * 1.15;
  let envelope = 0.55;
  if (item?.kind === "song") envelope = songProgressEnvelope(progress01);
  else if (item?.kind === "mc") envelope = 0.62 + progress01 * 0.12;
  else envelope = 0.42;

  const transportMul =
    session.transport === "playing" ? 1 : session.transport === "paused" ? 0.86 : 0.78;
  const wobble =
    session.transport === "playing"
      ? deterministicNoise(`${session.liveUid}|${session.currentIndex}|${Math.floor(progress01 * 20)}`) * 2.8
      : 0;

  return clamp(
    (session.reactionBase + session.setlistDelta * 0.7 + bias + doneBoost) * envelope * transportMul + wobble,
    8,
    100,
  );
}

/** Smooth audienceHeat toward target; mutates session. */
export function tickLiveModeAudienceHeat(session: LiveModeSession, progress01: number): LiveModeReactionSnapshot {
  const target = computeLiveModeReactionTarget(session, progress01);
  const blend = session.transport === "playing" ? 0.22 : 0.12;
  session.audienceHeat = clamp(session.audienceHeat * (1 - blend) + target * blend, 8, 100);
  const level = Math.round(session.audienceHeat);
  const band = reactionBandFor(level);
  return {
    level,
    band,
    label: "", // filled by caller with lang
    pulse: "",
  };
}

export function liveModeReactionSnapshot(
  session: LiveModeSession,
  lang: UiLanguage,
  progress01: number,
): LiveModeReactionSnapshot {
  const raw = tickLiveModeAudienceHeat(session, progress01);
  const band = reactionBandFor(raw.level);
  return {
    level: raw.level,
    band,
    label: reactionLabel(lang, band),
    pulse: reactionPulse(lang, band, session.transport === "playing"),
  };
}

export function updateLiveModeReactionDom(root: ParentNode, snap: LiveModeReactionSnapshot): void {
  const fill = root.querySelector<HTMLElement>("[data-live-mode-reaction-fill]");
  const label = root.querySelector<HTMLElement>("[data-live-mode-reaction-label]");
  const score = root.querySelector<HTMLElement>("[data-live-mode-reaction-score]");
  const pulse = root.querySelector<HTMLElement>("[data-live-mode-reaction-pulse]");
  const shell = root.querySelector<HTMLElement>("[data-live-mode-reaction]");
  if (fill) fill.style.width = `${snap.level}%`;
  if (label) label.textContent = snap.label;
  if (score) score.textContent = String(snap.level);
  if (pulse) pulse.textContent = snap.pulse;
  if (shell) {
    shell.dataset.band = snap.band;
    shell.setAttribute("aria-valuenow", String(snap.level));
  }
}

export function renderLiveModeView(session: LiveModeSession, lang: UiLanguage): string {
  const item = currentLiveModeItem(session);
  const total = session.items.length;
  const indexLabel = `${Math.min(session.currentIndex + 1, total)} / ${total}`;
  const kindLabel = (kind: LiveModeItemKind) =>
    kind === "song"
      ? localized(lang, "Song", "曲目")
      : kind === "mc"
        ? localized(lang, "MC", "MC")
        : localized(lang, "Break", "休息");

  const setlistRows = session.items
    .map((row, i) => {
      const state =
        i < session.currentIndex ? "is-done" : i === session.currentIndex ? "is-current" : "is-upcoming";
      const previewHint =
        row.kind === "song" && !row.hasPreview
          ? `<span class="live-mode-item-na">${htmlEsc(localized(lang, "no preview", "无试听"))}</span>`
          : "";
      return `<li class="live-mode-setlist-item ${state}" data-live-mode-index="${i}">
        <span class="live-mode-setlist-idx">${i + 1}</span>
        <span class="live-mode-setlist-kind">${htmlEsc(kindLabel(row.kind))}</span>
        <span class="live-mode-setlist-label">${htmlEsc(row.label)}</span>
        ${previewHint}
      </li>`;
    })
    .join("");

  const members = session.members
    .map((m) => {
      const ph = attrQuotedUrl(avatarPlaceholderDataUrl(m.name));
      return `<div class="live-mode-idol${m.isCenter ? " is-center" : ""}" style="left:${m.x}%;top:${m.y}%;--idol-color:${htmlEsc(m.color)}" data-live-mode-idol="${htmlEsc(m.uid)}" title="${htmlEsc(m.name)}">
        <div class="live-mode-idol-face" data-live-mode-idol-face="${htmlEsc(m.uid)}">
          <img class="live-mode-idol-img" alt="" data-fallback="${ph}" hidden />
          <span class="live-mode-idol-initial" aria-hidden="true">${htmlEsc(m.name.slice(0, 1))}</span>
        </div>
        <div class="live-mode-idol-name">${htmlEsc(m.name)}</div>
      </div>`;
    })
    .join("");

  const playLabel =
    session.transport === "playing"
      ? localized(lang, "Pause", "暂停")
      : localized(lang, "Play", "播放");
  const playGlyph = session.transport === "playing" ? "❚❚" : "▶";
  const reactionLevel = Math.round(session.audienceHeat);
  const reactionBand = reactionBandFor(reactionLevel);
  const reactionSnap: LiveModeReactionSnapshot = {
    level: reactionLevel,
    band: reactionBand,
    label: reactionLabel(lang, reactionBand),
    pulse: reactionPulse(lang, reactionBand, session.transport === "playing"),
  };

  return `<section class="live-mode" aria-label="${htmlEsc(t(lang, "live_mode_title"))}">
    <div class="live-mode-header">
      <div class="live-mode-header-main">
        <p class="live-mode-eyebrow">${htmlEsc(t(lang, "live_mode_title"))}</p>
        <h2 class="live-mode-title">${htmlEsc(session.liveTitle)}</h2>
        <p class="live-mode-meta">${htmlEsc(
          [session.venue, session.dateIso].filter(Boolean).join(" · "),
        )}</p>
      </div>
      <div class="live-mode-header-now">
        <span class="live-mode-now-label">${htmlEsc(localized(lang, "Now", "现在"))}</span>
        <strong class="live-mode-now-track">${htmlEsc(item?.label ?? "—")}</strong>
        <span class="live-mode-now-index">${htmlEsc(indexLabel)}</span>
      </div>
    </div>

    <div class="live-mode-grid">
      <aside class="live-mode-left" aria-label="${htmlEsc(t(lang, "live_mode_setlist"))}">
        <h3 class="live-mode-section-title">${htmlEsc(t(lang, "live_mode_setlist"))}</h3>
        <ol class="live-mode-setlist">${setlistRows}</ol>
        <div class="live-mode-timeline" aria-label="${htmlEsc(t(lang, "live_mode_timeline"))}">
          <div class="live-mode-timeline-top">
            <span>${htmlEsc(t(lang, "live_mode_timeline"))}</span>
            <span class="live-mode-clock" data-live-mode-clock>0:00 / 0:00</span>
          </div>
          <div class="live-mode-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">
            <div class="live-mode-progress-fill" data-live-mode-progress style="width:0%"></div>
          </div>
        </div>
      </aside>

      <section class="live-mode-right" aria-label="${htmlEsc(t(lang, "live_mode_stage"))}">
        <div class="live-mode-stage">
          <div class="live-mode-stage-glow" aria-hidden="true"></div>
          <div class="live-mode-formation">${members}</div>
        </div>
        <div
          class="live-mode-reaction"
          data-live-mode-reaction
          data-band="${htmlEsc(reactionSnap.band)}"
          role="meter"
          aria-label="${htmlEsc(t(lang, "live_mode_audience"))}"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow="${reactionSnap.level}"
        >
          <div class="live-mode-reaction-top">
            <span class="live-mode-reaction-title">${htmlEsc(t(lang, "live_mode_audience"))}</span>
            <span class="live-mode-reaction-label" data-live-mode-reaction-label>${htmlEsc(reactionSnap.label)}</span>
            <span class="live-mode-reaction-score" data-live-mode-reaction-score>${reactionSnap.level}</span>
          </div>
          <div class="live-mode-reaction-track">
            <div class="live-mode-reaction-fill" data-live-mode-reaction-fill style="width:${reactionSnap.level}%"></div>
          </div>
          <div class="live-mode-reaction-pulse" data-live-mode-reaction-pulse aria-hidden="true">${htmlEsc(reactionSnap.pulse)}</div>
        </div>
        <div class="live-mode-controls">
          <button type="button" class="fm-btn live-mode-btn" data-live-mode-action="play" title="${htmlEsc(playLabel)}" aria-label="${htmlEsc(playLabel)}">${playGlyph}</button>
          <button type="button" class="fm-btn live-mode-btn" data-live-mode-action="next" title="${htmlEsc(t(lang, "live_mode_next"))}" aria-label="${htmlEsc(t(lang, "live_mode_next"))}">⏭</button>
          <button type="button" class="fm-btn fm-btn-accent live-mode-btn live-mode-btn-end" data-live-mode-action="end" title="${htmlEsc(t(lang, "live_mode_end"))}" aria-label="${htmlEsc(t(lang, "live_mode_end"))}">${htmlEsc(t(lang, "live_mode_end"))}</button>
        </div>
      </section>
    </div>
  </section>`;
}

/** Hydrate idol portraits after paint (avoids bloating session state). */
export function hydrateLiveModePortraits(
  root: ParentNode,
  save: GameSavePayload,
): void {
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const byUid = new Map(idols.map((row) => [String(row.uid ?? ""), row] as const));
  root.querySelectorAll<HTMLElement>("[data-live-mode-idol]").forEach((el) => {
    const uid = el.getAttribute("data-live-mode-idol") ?? "";
    const idol = byUid.get(uid);
    if (!idol) return;
    const img = el.querySelector<HTMLImageElement>(".live-mode-idol-img");
    const initial = el.querySelector<HTMLElement>(".live-mode-idol-initial");
    const src = idolPortraitPublicSrc(idol, save.current_date);
    if (!img || !src) return;
    img.src = src;
    img.hidden = false;
    img.addEventListener(
      "error",
      () => {
        img.hidden = true;
        if (initial) initial.hidden = false;
      },
      { once: true },
    );
    if (initial) initial.hidden = true;
  });
}

export function formatLiveClock(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${String(r).padStart(2, "0")}`;
}

export function updateLiveModeProgressDom(
  root: ParentNode,
  currentSec: number,
  durationSec: number,
): void {
  const dur = Math.max(0.001, durationSec);
  const pct = Math.max(0, Math.min(100, (currentSec / dur) * 100));
  const fill = root.querySelector<HTMLElement>("[data-live-mode-progress]");
  const clock = root.querySelector<HTMLElement>("[data-live-mode-clock]");
  const bar = fill?.parentElement;
  if (fill) fill.style.width = `${pct}%`;
  if (bar) bar.setAttribute("aria-valuenow", String(Math.round(pct)));
  if (clock) clock.textContent = `${formatLiveClock(currentSec)} / ${formatLiveClock(dur)}`;
}
