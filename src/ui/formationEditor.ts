/**
 * Formation editor — typical layouts as flexible startpoints.
 * Apply a preset to seed positions, then drag freely on stage.
 * #0 = center, then outward. Temporary layouts when members are unavailable.
 */

import {
  choreographicDocToSongStartingFormation,
  parseChoreographicCompat,
  songStartingFormationToChoreographicDoc,
  type ChoreographicCompatDocument,
} from "../data/choreographicCompat";
import {
  applyTypicalPreset,
  applyVideoMarksToFormation,
  assignIdolToSlot,
  buildDefaultManagedFormation,
  centerIdolUidsFromFormation,
  clearFormationSlots,
  formationSlotsFor,
  formationSlotsWithCenter,
  orderByScoreWithNoise,
  placedFormationPositions,
  resizeFormationSlots,
  resolveCenterMode,
  resolveLayoutKind,
  resolveTypicalPreset,
  setIdolStagePosition,
  snapVideoMarksToSlots,
  suggestTemporaryFormation,
  swapFormationMembers,
  toggleFormationCenterIdol,
  typicalFormationPresets,
  type SongStartingFormation,
} from "../data/songStartingFormation";
import {
  activeRoleAssignmentsFromHistoryEntry,
  roleAssignmentsFromHistoryEntry,
} from "../data/memberRoles";
import { getAbilityRaw, normalizePersistedAttributes } from "../engine/idolAttributes";
import { htmlEsc } from "./htmlEsc";
import type { UiLanguage } from "./i18n";
import { attrQuotedUrl, avatarPlaceholderDataUrl, idolPortraitPublicSrc } from "./portraitUrl";

export type FormationEditorMember = {
  uid: string;
  name: string;
  color: string;
  idol?: Record<string, unknown>;
  unavailable?: boolean;
};

export type FormationEditorState = {
  songUid: string;
  songTitle: string;
  groupUid: string | null;
  asOfDate: string | null;
  members: FormationEditorMember[];
  /** Full roster including unavailable (for banners / restore). */
  allMembers: FormationEditorMember[];
  formation: SongStartingFormation;
  selectedIdolUid: string | null;
  mode: "manual" | "video";
  videoObjectUrl: string | null;
  videoSourceLabel: string;
  /** Dance-practice clips are often mirrored (左右反転) for learning — flip X on apply. */
  videoMirrorX: boolean;
  statusMessage: string;
  familiarity: number | null;
};

export type FormationEditorCallbacks = {
  onChange: (state: FormationEditorState) => void;
  onSave: (formation: SongStartingFormation) => void;
  onClose?: () => void;
};

function localized(lang: UiLanguage, en: string, zh: string): string {
  return lang === "zh-CN" ? zh : en;
}

function memberIsCenterRole(
  member: FormationEditorMember,
  groupUid: string | null | undefined,
  asOf: string | null | undefined,
): boolean {
  if (!member.idol || !groupUid) return false;
  const hist = Array.isArray(member.idol.group_history) ? member.idol.group_history : [];
  const entry = hist.find((raw) => {
    if (!raw || typeof raw !== "object") return false;
    return String((raw as Record<string, unknown>).group_uid ?? "") === groupUid;
  }) as Record<string, unknown> | undefined;
  if (!entry) return false;
  const asOfDate = String(asOf ?? "").trim();
  const roles = asOfDate
    ? activeRoleAssignmentsFromHistoryEntry(entry, asOfDate).length
      ? activeRoleAssignmentsFromHistoryEntry(entry, asOfDate)
      : roleAssignmentsFromHistoryEntry(entry)
    : roleAssignmentsFromHistoryEntry(entry);
  return roles.some((r) => r.key === "center" || r.key === "performance_center");
}

/** Soft placement score: ability (+ light popularity), with a center-role nudge — not a hard lock. */
function memberFormationScore(
  member: FormationEditorMember,
  groupUid: string | null | undefined,
  asOf: string | null | undefined,
): number {
  let score = 55;
  if (member.idol) {
    score = getAbilityRaw(normalizePersistedAttributes(member.idol.attributes));
    const popularity = Number(member.idol.popularity ?? 0) || 0;
    score += Math.min(16, popularity * 0.12);
  }
  if (memberIsCenterRole(member, groupUid, asOf)) score += 12;
  return score;
}

/** Higher score → usually better center-outward slots; noise keeps defaults from being fixed. */
function orderMembersForDefaultFormation(
  members: FormationEditorMember[],
  groupUid: string | null | undefined,
  asOf: string | null | undefined,
): FormationEditorMember[] {
  return orderByScoreWithNoise(members, (m) => memberFormationScore(m, groupUid, asOf), {
    noiseRatio: 0.32,
  });
}

function formationNeedsManagedDefault(formation: SongStartingFormation | null | undefined): boolean {
  if (!formation) return true;
  const hasPeople = formation.slotIdolUids.some(Boolean) || Boolean(formation.positions?.length);
  if (hasPeople) return false;
  // Empty authored slots with no free positions → seed managed default.
  return true;
}

function layoutKindOf(formation: SongStartingFormation) {
  return formation.layoutKind
    ? resolveLayoutKind(formation.layoutKind)
    : resolveTypicalPreset(formation.memberCount, formation.presetId).kind;
}

/** Keep choreography in sync; prefer existing free positions over rigid slot rebuild.
 * Multi-set Choreographic docs on `formation.choreography` are preserved.
 */
function withSyncedPositions(
  formation: SongStartingFormation,
  opts?: { forceFromSlots?: boolean },
): SongStartingFormation {
  const slots = formationSlotsFor(formation);
  let positions: Array<{ idolUid: string; x: number; y: number }>;
  if (opts?.forceFromSlots) {
    positions = formation.slotIdolUids
      .map((uid, i) => {
        if (!uid) return null;
        const s = slots[i];
        return s ? { idolUid: uid, x: s.x, y: s.y } : null;
      })
      .filter((p): p is { idolUid: string; x: number; y: number } => Boolean(p));
  } else {
    const existing = new Map(placedFormationPositions(formation).map((p) => [p.idolUid, p]));
    positions = [];
    formation.slotIdolUids.forEach((uid, i) => {
      if (!uid) return;
      const prev = existing.get(uid);
      const s = slots[i];
      positions.push({
        idolUid: uid,
        x: prev?.x ?? s?.x ?? 50,
        y: prev?.y ?? s?.y ?? 50,
      });
    });
  }

  const base = { ...formation, positions };
  const choreography = songStartingFormationToChoreographicDoc(base, {
    title: formation.songUid,
    members: formation.slotIdolUids
      .filter((uid): uid is string => !!uid)
      .map((uid) => ({ uid, name: uid, color: "#94a3b8" })),
  });
  // If we already had a multi-set doc, keep full timeline (helper preserves it).
  return {
    ...base,
    choreography,
    updatedAt: new Date().toISOString(),
  };
}

export function createFormationEditorState(opts: {
  songUid: string;
  songTitle?: string;
  groupUid?: string | null;
  asOfDate?: string | null;
  members: FormationEditorMember[];
  allMembers?: FormationEditorMember[];
  formation?: SongStartingFormation | null;
  familiarity?: number | null;
}): FormationEditorState {
  const available = opts.members.filter((m) => !m.unavailable);
  const allMembers = opts.allMembers ?? opts.members;
  const memberCount = Math.max(1, available.length);
  const unavailableUids = allMembers.filter((m) => m.unavailable).map((m) => m.uid);

  let formation: SongStartingFormation;
  if (formationNeedsManagedDefault(opts.formation)) {
    const ordered = orderMembersForDefaultFormation(available, opts.groupUid, opts.asOfDate);
    formation = buildDefaultManagedFormation({
      songUid: opts.songUid,
      groupUid: opts.groupUid,
      memberUids: ordered.map((m) => m.uid),
      source: "default_center",
    });
  } else {
    const base = opts.formation!;
    formation = resizeFormationSlots(base, Math.max(base.memberCount, memberCount));
    formation = {
      ...formation,
      songUid: opts.songUid,
      groupUid: opts.groupUid ?? formation.groupUid,
      centerMode: resolveCenterMode(formation.centerMode),
    };

    // Prefer restoring full lineup when everyone is available again.
    if (
      unavailableUids.length === 0 &&
      formation.fullSlotIdolUids?.length &&
      formation.isTemporary
    ) {
      formation = {
        ...formation,
        memberCount: formation.fullSlotIdolUids.length,
        slotIdolUids: [...formation.fullSlotIdolUids],
        isTemporary: false,
        unavailableIdolUids: [],
        notes: null,
      };
      formation = resizeFormationSlots(formation, formation.memberCount);
    }

    if (unavailableUids.length > 0 || formation.memberCount !== memberCount) {
      formation = suggestTemporaryFormation(formation, available.map((m) => m.uid), {
        presetId: formation.presetId,
      });
    } else {
      formation = resizeFormationSlots(formation, memberCount);
      if (!formation.presetId || !formation.positions?.length) {
        formation = applyTypicalPreset(formation, resolveTypicalPreset(memberCount, formation.presetId).id);
      }
    }
  }

  // Temporary lineup when some members are unavailable on a freshly seeded default.
  if (unavailableUids.length > 0 && formation.memberCount !== memberCount) {
    formation = suggestTemporaryFormation(formation, available.map((m) => m.uid), {
      presetId: formation.presetId,
    });
  }

  // If only continuous positions, assign nearest template slots once (keep free coords).
  if (formation.slotIdolUids.every((uid) => !uid) && formation.positions?.length) {
    let next = clearFormationSlots(formation);
    const used = new Set<number>();
    const slots = formationSlotsWithCenter(
      memberCount,
      resolveCenterMode(next.centerMode),
      next.rowCount,
      layoutKindOf(next),
    );
    const kept: Array<{ idolUid: string; x: number; y: number }> = [];
    for (const p of formation.positions) {
      if (!available.some((m) => m.uid === p.idolUid)) continue;
      let best = -1;
      let bestD = Infinity;
      for (let i = 0; i < slots.length; i++) {
        if (used.has(i)) continue;
        const s = slots[i]!;
        const d = (s.x - p.x) ** 2 + (s.y - p.y) ** 2;
        if (d < bestD) {
          bestD = d;
          best = i;
        }
      }
      if (best < 0) continue;
      used.add(best);
      next = { ...assignIdolToSlot(next, best, p.idolUid), positions: next.positions };
      kept.push({ idolUid: p.idolUid, x: p.x, y: p.y });
    }
    formation = { ...next, positions: kept };
  }

  formation = withSyncedPositions(formation);
  return {
    songUid: opts.songUid,
    songTitle: opts.songTitle ?? opts.songUid,
    groupUid: opts.groupUid ?? null,
    asOfDate: opts.asOfDate ?? null,
    members: available,
    allMembers,
    formation,
    selectedIdolUid: null,
    mode: "manual",
    videoObjectUrl: null,
    videoSourceLabel: "",
    videoMirrorX: true,
    statusMessage: unavailableUids.length
      ? `Temporary formation suggested (${unavailableUids.length} unavailable).`
      : "",
    familiarity: opts.familiarity ?? null,
  };
}

function memberByUid(state: FormationEditorState, uid: string | null): FormationEditorMember | null {
  if (!uid) return null;
  return state.members.find((m) => m.uid === uid) ?? state.allMembers.find((m) => m.uid === uid) ?? null;
}

function unplaced(state: FormationEditorState): FormationEditorMember[] {
  const placed = new Set(state.formation.slotIdolUids.filter(Boolean));
  return state.members.filter((m) => !placed.has(m.uid));
}

function renderIdolChip(
  member: FormationEditorMember,
  opts: {
    selected?: boolean;
    asOfDate?: string | null;
    isCenter?: boolean;
    slotIndex?: number | null;
    /** Bench chips use HTML5 drag; stage chips use pointer drag so dblclick can toggle C. */
    draggable?: boolean;
  },
): string {
  const ph = attrQuotedUrl(avatarPlaceholderDataUrl(member.name));
  const portrait =
    member.idol != null ? idolPortraitPublicSrc(member.idol, opts.asOfDate ?? null) : null;
  const img = portrait
    ? `<img class="formation-editor-face-img" src="${htmlEsc(portrait)}" alt="" data-fallback="${ph}" />`
    : `<span class="formation-editor-face-initial">${htmlEsc(member.name.slice(0, 1))}</span>`;
  const slotAttr = opts.slotIndex == null ? "" : ` data-formation-slot="${opts.slotIndex}"`;
  const num =
    opts.slotIndex == null
      ? ""
      : `<span class="formation-editor-pos-num">${htmlEsc(String(opts.slotIndex))}</span>`;
  const canDrag = opts.draggable !== false;
  return `<button type="button" class="formation-editor-idol${opts.selected ? " is-selected" : ""}${opts.isCenter ? " is-center" : ""}" data-formation-idol="${htmlEsc(member.uid)}"${slotAttr} draggable="${canDrag ? "true" : "false"}" style="--idol-color:${htmlEsc(member.color)}" title="${htmlEsc(`${member.name}${opts.slotIndex == null ? "" : ` · #${opts.slotIndex}`}`)}">
    <span class="formation-editor-face">${img}</span>
    <span class="formation-editor-idol-name">${htmlEsc(member.name)}</span>
    ${num}
    ${opts.isCenter ? `<span class="formation-editor-center-badge">C</span>` : ""}
  </button>`;
}

export function renderFormationEditor(
  state: FormationEditorState,
  lang: UiLanguage,
  opts?: { showClose?: boolean; allowVideo?: boolean },
): string {
  const allowVideo = opts?.allowVideo !== false;
  const editorMode = allowVideo ? state.mode : "manual";
  const centerMode = resolveCenterMode(state.formation.centerMode);
  const preset = resolveTypicalPreset(state.formation.memberCount, state.formation.presetId);
  const kind = layoutKindOf(state.formation);
  const slots = formationSlotsWithCenter(
    state.formation.memberCount,
    centerMode,
    state.formation.rowCount,
    kind,
  );
  const posByUid = new Map(placedFormationPositions(state.formation).map((p) => [p.idolUid, p]));
  const showGhosts = Boolean(state.selectedIdolUid);
  const centerUids = new Set(centerIdolUidsFromFormation(state.formation));
  const unavailable = state.allMembers.filter((m) => m.unavailable);

  const stageSlots = slots
    .map((slot, i) => {
      const uid = state.formation.slotIdolUids[i] ?? null;
      const member = memberByUid(state, uid);
      const free = uid ? posByUid.get(uid) : null;
      const x = free?.x ?? slot.x;
      const y = free?.y ?? slot.y;
      const centerClass = slot.isCenter ? " is-center-slot" : "";
      const ghostClass = !member && showGhosts ? " is-drop-target" : !member ? " is-empty-slot" : "";
      const body = member
        ? renderIdolChip(member, {
            selected: state.selectedIdolUid === member.uid,
            asOfDate: state.asOfDate,
            isCenter: centerUids.has(member.uid),
            slotIndex: i,
            draggable: false,
          })
        : `<button type="button" class="formation-editor-slot-ghost" data-formation-slot="${i}" data-drop-slot="${i}" title="${htmlEsc(
            `#${i}${slot.isCenter ? " · C" : ""}`,
          )}">
            <span class="formation-editor-slot-ghost-ring${slot.isCenter ? " is-center" : ""}"></span>
            <span class="formation-editor-slot-ghost-label">${i}</span>
          </button>`;
      return `<div class="formation-editor-slot is-free${centerClass}${ghostClass}" style="left:${x}%;top:${y}%" data-formation-slot-wrap="${i}" data-formation-free-slot="${i}">${body}</div>`;
    })
    .join("");

  const bench = unplaced(state);
  const benchHtml = bench.length
    ? bench
        .map((m) =>
          renderIdolChip(m, {
            selected: state.selectedIdolUid === m.uid,
            asOfDate: state.asOfDate,
            draggable: true,
          }),
        )
        .join("")
    : `<p class="formation-editor-muted">${htmlEsc(localized(lang, "All available members placed", "可出勤成员已全部入位"))}</p>`;

  const presetButtons = typicalFormationPresets(state.formation.memberCount)
    .map(
      (p) =>
        `<button type="button" class="fm-btn fm-btn-xs${p.id === preset.id ? " fm-btn-accent" : ""}" data-formation-action="preset-${htmlEsc(p.id)}">${htmlEsc(
          lang === "zh-CN" ? p.labelZh : p.labelEn,
        )}</button>`,
    )
    .join("");

  const fam =
    state.familiarity == null
      ? ""
      : `<span class="formation-editor-fam">${htmlEsc(
          lang === "zh-CN" ? `熟练度 ${Math.round(state.familiarity)}` : `Familiarity ${Math.round(state.familiarity)}`,
        )}</span>`;

  const tempBanner = state.formation.isTemporary
    ? `<p class="formation-editor-temp-banner">${htmlEsc(
        localized(
          lang,
          `Temporary lineup — ${unavailable.length} member(s) on hiatus/suspension. Slots match available roster only.`,
          `临时阵型：${unavailable.length} 人休假/停工中。站位数等于当前可出勤人数。`,
        ),
      )}</p>`
    : "";

  const closeBtn =
    opts?.showClose === false
      ? ""
      : `<button type="button" class="fm-btn" data-formation-action="close">${htmlEsc(localized(lang, "Close", "关闭"))}</button>`;

  const marks = state.formation.videoMarks ?? [];
  const marksHtml = marks
    .map((m) => {
      const member = memberByUid(state, m.idolUid);
      const label = member?.name?.slice(0, 1) ?? "?";
      return `<span class="formation-editor-mark" style="left:${m.x}%;top:${m.y}%" title="${htmlEsc(member?.name ?? m.idolUid)}">${htmlEsc(label)}</span>`;
    })
    .join("");

  const videoPanel =
    !allowVideo || editorMode !== "video"
      ? ""
      : `<div class="formation-editor-video-panel">
          <p class="formation-editor-video-ideal">${htmlEsc(
            localized(
              lang,
              "Ideal source: official dance practice (固定机位 · 全员入画). Example: Takane no Nadeshiko「可愛くてごめん」dance practice. Pause on the opening hold, select a member, click their feet/center on the frame.",
              "理想来源：官方舞蹈练习室视频（固定机位、全员入画）。例：高嶺のなでしこ「可愛くてごめん」练习室。暂停在开场站位，选中成员后点击画面中的站位。",
            ),
          )} <a class="formation-editor-video-example" href="https://www.youtube.com/watch?v=oB12TDu4dVE" target="_blank" rel="noopener noreferrer">${htmlEsc(
            localized(lang, "Example video", "示例视频"),
          )}</a></p>
          <div class="formation-editor-video-toolbar">
            <label class="fm-btn formation-editor-file-btn">${htmlEsc(localized(lang, "Load video file", "加载视频文件"))}
              <input type="file" accept="video/*" data-formation-action="load-video-file" hidden />
            </label>
            <input type="url" class="formation-editor-url" data-formation-video-url placeholder="${htmlEsc(
              localized(lang, "Or direct MP4 URL…", "或直接 MP4 链接…"),
            )}" />
            <button type="button" class="fm-btn" data-formation-action="load-video-url">${htmlEsc(localized(lang, "Load URL", "加载链接"))}</button>
            <button type="button" class="fm-btn${state.videoMirrorX ? " fm-btn-accent" : ""}" data-formation-action="toggle-mirror">${htmlEsc(
              localized(lang, "Mirror X (practice)", "左右反转（练习室）"),
            )}</button>
            <button type="button" class="fm-btn" data-formation-action="clear-marks">${htmlEsc(localized(lang, "Clear marks", "清除标记"))}</button>
            <button type="button" class="fm-btn fm-btn-accent" data-formation-action="apply-video-marks">${htmlEsc(
              localized(lang, "Apply marks → stage", "应用标记 → 舞台"),
            )}</button>
            <button type="button" class="fm-btn" data-formation-action="snap-video-marks">${htmlEsc(
              localized(lang, "Snap to start layout", "吸附到起点队形"),
            )}</button>
          </div>
          <div class="formation-editor-video-wrap${state.videoObjectUrl ? "" : " is-empty"}" data-formation-video-wrap>
            ${
              state.videoObjectUrl
                ? `<video class="formation-editor-video" data-formation-video src="${htmlEsc(state.videoObjectUrl)}" controls playsinline></video>
                   <div class="formation-editor-marks" data-formation-marks>${marksHtml}</div>`
                : `<p class="formation-editor-video-empty">${htmlEsc(
                    localized(
                      lang,
                      state.videoSourceLabel || "Load a dance-practice MP4 (YouTube pages need a downloaded file / direct URL).",
                      state.videoSourceLabel || "加载练习室 MP4（YouTube 页面需先下载文件或使用直链）。",
                    ),
                  )}</p>`
            }
          </div>
          <p class="formation-editor-hint">${htmlEsc(
            localized(
              lang,
              `${marks.length} mark(s). Mirror X is on by default — many official practice videos are 左右反転 for learning.`,
              `已标记 ${marks.length} 人。默认开启左右反转——很多官方练习室为方便学习做了镜像。`,
            ),
          )}</p>
        </div>`;

  const modeTabs = allowVideo
    ? `<div class="formation-editor-mode" role="tablist">
          <button type="button" class="fm-btn${editorMode === "manual" ? " fm-btn-accent" : ""}" data-formation-action="mode-manual">${htmlEsc(localized(lang, "Manual", "手动"))}</button>
          <button type="button" class="fm-btn${editorMode === "video" ? " fm-btn-accent" : ""}" data-formation-action="mode-video">${htmlEsc(localized(lang, "From video", "从视频"))}</button>
        </div>`
    : "";

  const choreoJobBtn = allowVideo
    ? `<button type="button" class="fm-btn" data-formation-action="export-choreo-job">${htmlEsc(
        localized(lang, "Export choreo job", "导出编排任务"),
      )}</button>`
    : "";

  return `<div class="formation-editor${opts?.showClose === false ? " is-embedded" : ""}" data-formation-editor>
    <header class="formation-editor-header">
      <div>
        <p class="formation-editor-eyebrow">${htmlEsc(localized(lang, "Layout startpoint · free adjust", "队形起点 · 可自由微调"))}</p>
        <h2 class="formation-editor-title">${htmlEsc(state.songTitle)} ${fam}</h2>
        <p class="formation-editor-meta">${htmlEsc(
          (() => {
            const centers = [...centerUids]
              .map((uid) => memberByUid(state, uid)?.name ?? uid)
              .filter(Boolean);
            const centerLabel = centers.length
              ? centers.map((n) => `C:${n}`).join(" · ")
              : localized(lang, "no C", "无中心");
            return `${state.formation.memberCount} · ${centerLabel} · ${lang === "zh-CN" ? preset.labelZh : preset.labelEn}`;
          })(),
        )}</p>
      </div>
      <div class="formation-editor-header-controls">
        ${modeTabs}
      </div>
    </header>
    ${tempBanner}

    <div class="formation-editor-body">
      <section class="formation-editor-stage-panel">
        ${videoPanel}
        <div class="formation-editor-stage is-free-stage${showGhosts ? " is-placing" : ""}${editorMode === "video" ? " is-video-preview" : ""}" data-formation-stage>
          <div class="formation-editor-stage-glow" aria-hidden="true"></div>
          <div class="formation-editor-audience" aria-hidden="true">${htmlEsc(localized(lang, "AUDIENCE", "观众席"))}</div>
          <div class="formation-editor-upstage" aria-hidden="true">${htmlEsc(localized(lang, "UPSTAGE", "舞台后方"))}</div>
          <div class="formation-editor-formation is-free-stage">${stageSlots}</div>
        </div>
      </section>

      <section class="formation-editor-dock">
        <div class="formation-editor-dock-tools">
          <div class="formation-editor-preset-mode" role="group" aria-label="${htmlEsc(localized(lang, "Starting layouts", "起点队形"))}">
            <span class="formation-editor-control-label">${htmlEsc(localized(lang, "Start layout", "起点队形"))}</span>
            ${presetButtons}
          </div>
          <div class="formation-editor-center-mode" role="group" aria-label="${htmlEsc(localized(lang, "Center", "中心"))}">
            <span class="formation-editor-control-label">${htmlEsc(localized(lang, "Center", "中心"))}</span>
            <span class="formation-editor-hint" style="margin:0">${htmlEsc(
              localized(
                lang,
                "Double-click to set/unset C (0 allowed; max grows with roster)",
                "双击设置/取消中心（可为 0；上限随人数增加）",
              ),
            )}</span>
          </div>
          <div class="formation-editor-stage-actions">
            <button type="button" class="fm-btn" data-formation-action="auto-fill">${htmlEsc(localized(lang, "Auto-fill", "自动填入"))}</button>
            <button type="button" class="fm-btn" data-formation-action="clear-slots">${htmlEsc(localized(lang, "Clear", "清空"))}</button>
          </div>
        </div>

        <div class="formation-editor-dock-bench">
          <h3 class="formation-editor-side-title">${htmlEsc(localized(lang, "Bench", "待命"))}</h3>
          <div class="formation-editor-bench">${benchHtml}</div>
          <p class="formation-editor-hint">${htmlEsc(
            editorMode === "video"
              ? showGhosts
                ? localized(lang, "Selected — click their position on the video frame (feet / torso center).", "已选中 — 在视频画面点击其站位（脚位/身体中心）。")
                : localized(lang, "Select a member, pause on the opening formation, then click the video.", "选中成员，暂停在开场站位，再点击视频。")
              : showGhosts
                ? localized(
                    lang,
                    "Drop onto a slot or member (swap), or click the stage to place freely. Double-click a member to set/unset C.",
                    "拖到站位或成员（互换），或点击舞台自由落点。双击成员设置/取消中心。",
                  )
                : localized(
                    lang,
                    "Layouts are startpoints — drag to fine-tune, or drag onto another member to swap (# and C). Double-click to set/unset C.",
                    "队形只是起点，拖动可微调，拖到另一成员可互换站位/#与C。双击设置/取消中心。",
                  ),
          )}</p>
        </div>

        <div class="formation-editor-dock-footer">
          <p class="formation-editor-status">${htmlEsc(state.statusMessage)}</p>
          <div class="formation-editor-footer">
            <label class="fm-btn formation-editor-file-btn">${htmlEsc(localized(lang, "Import JSON", "导入 JSON"))}
              <input type="file" accept="application/json,.json" data-formation-action="import-json" hidden />
            </label>
            <button type="button" class="fm-btn" data-formation-action="export-choreo">${htmlEsc(localized(lang, "Export", "导出"))}</button>
            ${choreoJobBtn}
            ${closeBtn}
            <button type="button" class="fm-btn fm-btn-accent" data-formation-action="save">${htmlEsc(localized(lang, "Save formation", "保存站位"))}</button>
          </div>
        </div>
      </section>
    </div>
  </div>`;
}

function revokeVideoUrl(state: FormationEditorState): void {
  if (state.videoObjectUrl?.startsWith("blob:")) {
    try {
      URL.revokeObjectURL(state.videoObjectUrl);
    } catch {
      /* ignore */
    }
  }
}

function placeInSlot(state: FormationEditorState, slotIndex: number, idolUid: string | null): FormationEditorState {
  const formation = withSyncedPositions(
    assignIdolToSlot({ ...state.formation, source: "manual" }, slotIndex, idolUid),
  );
  return {
    ...state,
    formation,
    selectedIdolUid: null,
    statusMessage: idolUid
      ? `Placed ${memberByUid(state, idolUid)?.name ?? idolUid} as #${slotIndex}.`
      : `Cleared #${slotIndex}.`,
  };
}

/** Swap two placed members (position, slot #, and C), or place into an empty slot. */
function placeOrSwapIntoSlot(
  state: FormationEditorState,
  slotIndex: number,
  idolUid: string,
): FormationEditorState {
  const occupant = state.formation.slotIdolUids[slotIndex] ?? null;
  const alreadyPlaced = state.formation.slotIdolUids.includes(idolUid);
  if (occupant && occupant !== idolUid && alreadyPlaced) {
    const formation = withSyncedPositions(
      swapFormationMembers({ ...state.formation, source: "manual" }, idolUid, occupant),
    );
    const a = memberByUid(state, idolUid)?.name ?? idolUid;
    const b = memberByUid(state, occupant)?.name ?? occupant;
    return {
      ...state,
      formation,
      selectedIdolUid: null,
      statusMessage: `Swapped ${a} ↔ ${b} (position, #, C).`,
    };
  }
  return placeInSlot(state, slotIndex, idolUid);
}

function applyCenterToggle(
  state: FormationEditorState,
  lang: UiLanguage,
  uid: string,
): FormationEditorState {
  const result = toggleFormationCenterIdol(state.formation, uid);
  const name = memberByUid(state, uid)?.name ?? uid;
  if (result.blockedAtMax) {
    return {
      ...state,
      statusMessage: localized(
        lang,
        `Already ${result.centerCount} C (max ${result.maxCenters}). Unset someone first.`,
        `已有 ${result.centerCount} 个中心（最多 ${result.maxCenters}）。请先取消其他人的中心。`,
      ),
    };
  }
  if (!result.changed) return state;
  const after = centerIdolUidsFromFormation(result.formation);
  const nowOn = after.includes(uid);
  return {
    ...state,
    formation: withSyncedPositions(result.formation),
    selectedIdolUid: null,
    statusMessage: nowOn
      ? `Set ${name} as C (${after.length}/${result.maxCenters}).`
      : after.length
        ? `Unset C on ${name} (${after.length}/${result.maxCenters}).`
        : `Unset C on ${name} (no C).`,
  };
}

function stagePercentFromEvent(stage: HTMLElement, clientX: number, clientY: number): { x: number; y: number } {
  const rect = stage.getBoundingClientRect();
  const padX = rect.width * 0.04;
  const padTop = rect.height * 0.1;
  const padBottom = rect.height * 0.12;
  const innerW = Math.max(1, rect.width - padX * 2);
  const innerH = Math.max(1, rect.height - padTop - padBottom);
  const x = ((clientX - rect.left - padX) / innerW) * 100;
  const y = ((clientY - rect.top - padTop) / innerH) * 100;
  return {
    x: Math.max(4, Math.min(96, x)),
    y: Math.max(4, Math.min(96, y)),
  };
}

function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2) + "\n"], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function bindFormationEditor(
  root: ParentNode,
  state: FormationEditorState,
  lang: UiLanguage,
  callbacks: FormationEditorCallbacks,
  opts?: { allowVideo?: boolean },
): void {
  const allowVideo = opts?.allowVideo !== false;
  root.querySelectorAll<HTMLImageElement>("img.formation-editor-face-img").forEach((img) => {
    const fb = img.dataset.fallback;
    if (!fb) return;
    img.addEventListener(
      "error",
      () => {
        if (img.src !== fb) img.src = fb;
      },
      { once: true },
    );
  });

  const emit = (next: FormationEditorState) => callbacks.onChange(next);

  root.querySelectorAll<HTMLElement>("[data-formation-action]").forEach((el) => {
    const action = el.getAttribute("data-formation-action");
    if (action === "import-json" && el instanceof HTMLInputElement) {
      el.addEventListener("change", async () => {
        const file = el.files?.[0];
        if (!file) return;
        try {
          const json = JSON.parse(await file.text()) as unknown;
          const choreo = parseChoreographicCompat(json);
          if (choreo) {
            let formation = choreographicDocToSongStartingFormation(choreo, {
              songUid: state.songUid,
              memberCount: state.members.length,
            });
            formation = suggestTemporaryFormation(formation, state.members.map((m) => m.uid));
            emit({
              ...state,
              formation: withSyncedPositions(formation),
              statusMessage: `Imported choreography (${(formation.choreography?.formations ?? []).length || 1} set(s); timeline kept).`,
            });
            return;
          }
          emit({ ...state, statusMessage: "Unrecognized JSON." });
        } catch {
          emit({ ...state, statusMessage: "Import failed." });
        }
      });
      return;
    }
    if (action === "load-video-file" && el instanceof HTMLInputElement) {
      if (!allowVideo) return;
      el.addEventListener("change", () => {
        const file = el.files?.[0];
        if (!file) return;
        if (state.videoObjectUrl?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(state.videoObjectUrl);
          } catch {
            /* ignore */
          }
        }
        const url = URL.createObjectURL(file);
        emit({
          ...state,
          mode: "video",
          videoObjectUrl: url,
          videoSourceLabel: file.name,
          statusMessage: `Loaded ${file.name}. Pause on opening formation, then mark members.`,
        });
      });
      return;
    }
    el.addEventListener("click", () => {
      const videoActions = new Set([
        "mode-video",
        "load-video-url",
        "toggle-mirror",
        "clear-marks",
        "apply-video-marks",
        "snap-video-marks",
        "export-choreo-job",
      ]);
      if (!allowVideo && action && videoActions.has(action)) return;
      if (action === "mode-manual") emit({ ...state, mode: "manual", statusMessage: "" });
      else if (action === "mode-video") {
        emit({
          ...state,
          mode: "video",
          statusMessage: "Ideal: official dance practice (fixed camera, full group). Load an MP4 to mark.",
        });
      } else if (action === "load-video-url") {
        const input = root.querySelector<HTMLInputElement>("[data-formation-video-url]");
        const raw = String(input?.value ?? "").trim();
        if (!raw) {
          emit({ ...state, statusMessage: "Paste a direct MP4 URL (YouTube watch pages will not play here)." });
          return;
        }
        if (state.videoObjectUrl?.startsWith("blob:")) {
          try {
            URL.revokeObjectURL(state.videoObjectUrl);
          } catch {
            /* ignore */
          }
        }
        emit({
          ...state,
          mode: "video",
          videoObjectUrl: raw,
          videoSourceLabel: raw,
          statusMessage: "URL loaded. If it fails to play, download the file and use Load video file.",
        });
      } else if (action === "toggle-mirror") {
        emit({
          ...state,
          videoMirrorX: !state.videoMirrorX,
          statusMessage: !state.videoMirrorX
            ? "Mirror X on — marks flip when applied (typical for 左右反転 practice videos)."
            : "Mirror X off — use camera-left as stage-left.",
        });
      } else if (action === "clear-marks") {
        emit({
          ...state,
          formation: { ...state.formation, videoMarks: [] },
          statusMessage: "Video marks cleared.",
        });
      } else if (action === "apply-video-marks") {
        const formation = withSyncedPositions(
          applyVideoMarksToFormation(state.formation, { mirrorX: state.videoMirrorX }),
        );
        emit({
          ...state,
          mode: "manual",
          formation,
          selectedIdolUid: null,
          statusMessage: `Applied ${(state.formation.videoMarks ?? []).length} video mark(s) as free stage positions.`,
        });
      } else if (action === "snap-video-marks") {
        const mirrored = {
          ...state.formation,
          videoMarks: (state.formation.videoMarks ?? []).map((m) => ({
            ...m,
            x: state.videoMirrorX ? 100 - m.x : m.x,
          })),
        };
        const formation = withSyncedPositions(snapVideoMarksToSlots(mirrored), { forceFromSlots: true });
        emit({
          ...state,
          mode: "manual",
          formation: { ...formation, videoMarks: state.formation.videoMarks },
          selectedIdolUid: null,
          statusMessage: "Snapped video marks onto the current start layout.",
        });
      } else if (action?.startsWith("preset-")) {
        const presetId = action.slice("preset-".length);
        emit({
          ...state,
          formation: withSyncedPositions(applyTypicalPreset(state.formation, presetId), {
            forceFromSlots: true,
          }),
          statusMessage: `Applied start layout ${presetId} (still freely adjustable).`,
        });
      } else if (action === "clear-slots") {
        emit({
          ...state,
          formation: withSyncedPositions(clearFormationSlots(state.formation)),
          statusMessage: "Stage cleared.",
        });
      } else if (action === "auto-fill") {
        let formation = clearFormationSlots(state.formation);
        const ordered = orderMembersForDefaultFormation(state.members, state.groupUid, state.asOfDate);
        ordered.forEach((m, i) => {
          if (i < formation.memberCount) formation = assignIdolToSlot(formation, i, m.uid);
        });
        emit({
          ...state,
          formation: withSyncedPositions(formation, { forceFromSlots: true }),
          statusMessage: localized(
            lang,
            "Auto-filled (#0 = stronger idols more often, with some randomness).",
            "已自动填入（能力高的更常靠前，但仍有随机）。",
          ),
        });
      } else if (action === "export-choreo") {
        const doc: ChoreographicCompatDocument = songStartingFormationToChoreographicDoc(state.formation, {
          title: state.songTitle,
          members: state.members,
        });
        downloadJson(`choreographic_${state.songUid.slice(0, 8)}.json`, doc);
        emit({ ...state, statusMessage: "Downloaded JSON." });
      } else if (action === "export-choreo-job") {
        const job = {
          schemaVersion: "0.1",
          jobType: "choreo_compile",
          title: state.songTitle,
          songUid: state.songUid,
          groupUid: state.groupUid,
          cameraMode: "fixed",
          mirrorX: state.videoMirrorX,
          audienceAt: "bottom",
          sampleFps: 2,
          expectedMemberCount: state.members.length,
          sourceVideo: {
            youtubeId: null,
            youtubeUrl: null,
            localPath: state.videoSourceLabel || null,
            notes: "Fill youtubeUrl / localPath after download. Prefer official dance practice.",
          },
          crew: state.members.map((m) => ({
            idolUid: m.uid,
            name: m.name,
            color: m.color,
          })),
          openingMarks: (state.formation.videoMarks ?? []).map((m) => ({
            idolUid: m.idolUid,
            x: m.x,
            y: m.y,
            frameSeconds: m.frameSeconds ?? null,
          })),
        };
        downloadJson(`choreo_job_${state.songUid.slice(0, 8)}.json`, job);
        emit({
          ...state,
          statusMessage: "Downloaded choreo job JSON (for compile_choreography.py).",
        });
      } else if (action === "save") {
        let formation = withSyncedPositions(state.formation);
        if (!formation.isTemporary) {
          formation = { ...formation, fullSlotIdolUids: [...formation.slotIdolUids] };
        }
        callbacks.onSave(formation);
      } else if (action === "close") {
        revokeVideoUrl(state);
        callbacks.onClose?.();
      }
    });
  });

  root.querySelectorAll<HTMLElement>("[data-formation-idol]").forEach((el) => {
    const onStage = Boolean(el.closest("[data-formation-stage]"));
    el.addEventListener("click", (ev) => {
      if (ev.detail > 1) return;
      // Stage members: select / C toggle handled by pointer (dblclick survives without re-render race).
      if (onStage) return;
      ev.preventDefault();
      ev.stopPropagation();
      const uid = el.getAttribute("data-formation-idol");
      emit({
        ...state,
        selectedIdolUid: state.selectedIdolUid === uid ? null : uid,
        statusMessage:
          state.selectedIdolUid === uid
            ? "Deselected."
            : `Selected ${memberByUid(state, uid)?.name ?? uid}. Drop onto a stage slot or member.`,
      });
    });
    el.addEventListener("dblclick", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      const uid = el.getAttribute("data-formation-idol");
      if (!uid) return;
      if (!onStage) {
        emit({
          ...state,
          statusMessage: localized(
            lang,
            "Place the member on stage first, then double-click to set C.",
            "请先放到舞台上，再双击设置中心。",
          ),
        });
        return;
      }
      // Stage C toggle is handled by pointer double-tap (avoids re-render race + double-fire).
    });
    el.addEventListener("dragstart", (ev) => {
      const uid = el.getAttribute("data-formation-idol");
      if (!uid || !ev.dataTransfer) return;
      // Stage idols use pointer drag so dblclick can toggle C.
      if (onStage) {
        ev.preventDefault();
        return;
      }
      ev.dataTransfer.setData("text/idol-uid", uid);
      ev.dataTransfer.effectAllowed = "move";
    });
  });

  const onSlotActivate = (slotIndex: number, idolUid: string | null) => {
    if (idolUid) emit(placeOrSwapIntoSlot(state, slotIndex, idolUid));
    else if (state.selectedIdolUid) emit(placeOrSwapIntoSlot(state, slotIndex, state.selectedIdolUid));
  };

  root.querySelectorAll<HTMLElement>("[data-formation-slot-wrap],[data-drop-slot]").forEach((el) => {
    const slotIndex = Number(el.getAttribute("data-formation-slot-wrap") ?? el.getAttribute("data-drop-slot"));
    if (!Number.isFinite(slotIndex)) return;
    el.addEventListener("dragover", (ev) => {
      ev.preventDefault();
      el.classList.add("is-drag-over");
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = "move";
    });
    el.addEventListener("dragleave", () => el.classList.remove("is-drag-over"));
    el.addEventListener("drop", (ev) => {
      ev.preventDefault();
      el.classList.remove("is-drag-over");
      const uid = ev.dataTransfer?.getData("text/idol-uid") || state.selectedIdolUid;
      if (uid) onSlotActivate(slotIndex, uid);
    });
  });

  root.querySelectorAll<HTMLElement>(".formation-editor-slot-ghost").forEach((el) => {
    el.addEventListener("click", (ev) => {
      ev.preventDefault();
      const slotIndex = Number(el.getAttribute("data-formation-slot"));
      if (!Number.isFinite(slotIndex)) return;
      if (!state.selectedIdolUid) {
        emit({ ...state, statusMessage: "Select a member on the bench first." });
        return;
      }
      onSlotActivate(slotIndex, state.selectedIdolUid);
    });
  });

  // Video frame click → mark (dance-practice extract).
  const marksLayer = root.querySelector<HTMLElement>("[data-formation-marks]");
  const videoEl = root.querySelector<HTMLVideoElement>("[data-formation-video]");
  if (marksLayer && videoEl) {
    marksLayer.addEventListener("click", (ev) => {
      ev.preventDefault();
      ev.stopPropagation();
      if (!state.selectedIdolUid) {
        emit({ ...state, statusMessage: "Select a member first, then click their spot on the frame." });
        return;
      }
      const rect = marksLayer.getBoundingClientRect();
      const rawX = ((ev.clientX - rect.left) / Math.max(1, rect.width)) * 100;
      const rawY = ((ev.clientY - rect.top) / Math.max(1, rect.height)) * 100;
      // Store in video-space; mirror is applied only on Apply / display.
      const x = Math.max(2, Math.min(98, rawX));
      const y = Math.max(2, Math.min(98, rawY));
      const uid = state.selectedIdolUid;
      const frameSeconds = Number.isFinite(videoEl.currentTime) ? videoEl.currentTime : undefined;
      const prev = (state.formation.videoMarks ?? []).filter((m) => m.idolUid !== uid);
      prev.push({ idolUid: uid, x, y, frameSeconds });
      emit({
        ...state,
        formation: { ...state.formation, videoMarks: prev },
        selectedIdolUid: null,
        statusMessage: `Marked ${memberByUid(state, uid)?.name ?? uid} at ${x.toFixed(0)},${y.toFixed(0)}${
          frameSeconds != null ? ` · t=${frameSeconds.toFixed(1)}s` : ""
        }.`,
      });
    });
  }

  // Free drag / click-to-place on stage.
  const stage = root.querySelector<HTMLElement>("[data-formation-stage]");
  if (stage) {
    stage.addEventListener("click", (ev) => {
      if (!state.selectedIdolUid) return;
      const target = ev.target as HTMLElement | null;
      if (target?.closest("[data-formation-idol], .formation-editor-slot-ghost, [data-formation-action]")) return;
      const { x, y } = stagePercentFromEvent(stage, ev.clientX, ev.clientY);
      const uid = state.selectedIdolUid;
      let formation = state.formation;
      if (!formation.slotIdolUids.includes(uid)) {
        const empty = formation.slotIdolUids.findIndex((u) => !u);
        if (empty < 0) return;
        formation = assignIdolToSlot(formation, empty, uid);
      }
      formation = withSyncedPositions(setIdolStagePosition(formation, uid, x, y));
      emit({
        ...state,
        formation,
        selectedIdolUid: null,
        statusMessage: `Moved ${memberByUid(state, uid)?.name ?? uid} freely.`,
      });
    });

    const DRAG_THRESHOLD_PX = 6;
    const DOUBLE_TAP_MS = 320;
    let lastTapUid: string | null = null;
    let lastTapAt = 0;
    let pendingSelectTimer: ReturnType<typeof setTimeout> | null = null;

    root.querySelectorAll<HTMLElement>(".formation-editor-slot.is-free [data-formation-idol]").forEach((el) => {
      el.addEventListener("pointerdown", (ev) => {
        if (ev.button !== 0) return;
        const uid = el.getAttribute("data-formation-idol");
        if (!uid) return;
        // Do not preventDefault here — that blocks click/dblclick.
        const pointerId = ev.pointerId;
        const startX = ev.clientX;
        const startY = ev.clientY;
        let dragging = false;
        const wrap = el.closest<HTMLElement>("[data-formation-slot-wrap]");

        const onMove = (mv: PointerEvent) => {
          const dx = mv.clientX - startX;
          const dy = mv.clientY - startY;
          if (!dragging) {
            if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;
            dragging = true;
            if (pendingSelectTimer) {
              clearTimeout(pendingSelectTimer);
              pendingSelectTimer = null;
            }
            el.setPointerCapture?.(pointerId);
            stage.classList.add("is-free-dragging");
            wrap?.classList.add("is-dragging");
          }
          const { x, y } = stagePercentFromEvent(stage, mv.clientX, mv.clientY);
          if (wrap) {
            wrap.style.left = `${x}%`;
            wrap.style.top = `${y}%`;
          }
          stage.querySelectorAll(".is-swap-target").forEach((n) => n.classList.remove("is-swap-target"));
          const prevVis = wrap?.style.visibility;
          if (wrap) wrap.style.visibility = "hidden";
          const under = document.elementFromPoint(mv.clientX, mv.clientY) as HTMLElement | null;
          if (wrap) wrap.style.visibility = prevVis ?? "";
          const other = under?.closest?.("[data-formation-idol]") as HTMLElement | null;
          if (other && other !== el && other.closest("[data-formation-stage]")) {
            other.classList.add("is-swap-target");
          }
        };

        const onUp = (up: PointerEvent) => {
          window.removeEventListener("pointermove", onMove);
          window.removeEventListener("pointerup", onUp);
          window.removeEventListener("pointercancel", onUp);
          stage.classList.remove("is-free-dragging");
          wrap?.classList.remove("is-dragging");
          stage.querySelectorAll(".is-swap-target").forEach((n) => n.classList.remove("is-swap-target"));

          if (dragging) {
            try {
              el.releasePointerCapture?.(pointerId);
            } catch {
              /* ignore */
            }
            const prevVis = wrap?.style.visibility;
            if (wrap) wrap.style.visibility = "hidden";
            const under = document.elementFromPoint(up.clientX, up.clientY) as HTMLElement | null;
            if (wrap) wrap.style.visibility = prevVis ?? "";
            const other = under?.closest?.("[data-formation-idol]") as HTMLElement | null;
            const otherUid = other?.getAttribute("data-formation-idol");
            if (otherUid && otherUid !== uid && other?.closest("[data-formation-stage]")) {
              const formation = withSyncedPositions(
                swapFormationMembers({ ...state.formation, source: "manual" }, uid, otherUid),
              );
              const a = memberByUid(state, uid)?.name ?? uid;
              const b = memberByUid(state, otherUid)?.name ?? otherUid;
              emit({
                ...state,
                formation,
                selectedIdolUid: null,
                statusMessage: `Swapped ${a} ↔ ${b} (position, #, C).`,
              });
              return;
            }
            const { x, y } = stagePercentFromEvent(stage, up.clientX, up.clientY);
            emit({
              ...state,
              formation: withSyncedPositions(setIdolStagePosition(state.formation, uid, x, y)),
              selectedIdolUid: null,
              statusMessage: `Adjusted ${memberByUid(state, uid)?.name ?? uid}.`,
            });
            return;
          }

          // Tap: double-tap toggles C; single-tap selects (deferred so dblclick isn't killed by re-render).
          const now = Date.now();
          if (lastTapUid === uid && now - lastTapAt <= DOUBLE_TAP_MS) {
            if (pendingSelectTimer) {
              clearTimeout(pendingSelectTimer);
              pendingSelectTimer = null;
            }
            lastTapUid = null;
            lastTapAt = 0;
            emit(applyCenterToggle(state, lang, uid));
            return;
          }
          lastTapUid = uid;
          lastTapAt = now;
          if (pendingSelectTimer) clearTimeout(pendingSelectTimer);
          pendingSelectTimer = setTimeout(() => {
            pendingSelectTimer = null;
            if (state.selectedIdolUid && state.selectedIdolUid !== uid) {
              const slotAttr = el.getAttribute("data-formation-slot");
              if (slotAttr != null) {
                emit(placeOrSwapIntoSlot(state, Number(slotAttr), state.selectedIdolUid));
                return;
              }
            }
            emit({
              ...state,
              selectedIdolUid: state.selectedIdolUid === uid ? null : uid,
              statusMessage:
                state.selectedIdolUid === uid
                  ? "Deselected."
                  : `Selected ${memberByUid(state, uid)?.name ?? uid}. Drag onto another member to swap, or double-click for C.`,
            });
          }, DOUBLE_TAP_MS);
        };

        window.addEventListener("pointermove", onMove);
        window.addEventListener("pointerup", onUp);
        window.addEventListener("pointercancel", onUp);
      });
    });
  }
}

export function formationEditorOverlayHtml(state: FormationEditorState, lang: UiLanguage): string {
  return `<div class="formation-editor-overlay" data-formation-overlay>
    ${renderFormationEditor(state, lang, { showClose: true, allowVideo: false })}
  </div>`;
}
