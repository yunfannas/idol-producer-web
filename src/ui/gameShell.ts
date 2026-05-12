/**
 * Desktop-style layout (Football Manager / idol_producer main_ui.py colors & structure).
 */

import type { LoadedScenario } from "../data/scenarioTypes";
import type { WebPreviewBundle } from "../types";
import type { GameSavePayload } from "../save/gameSaveSchema";
import { getActiveFinances, getPrimaryGroup } from "../save/gameSaveSchema";
import type { PersistedIdolAttributes } from "../engine/idolAttributes";
import {
  getAbility,
  getWorkbookRadarDimensions,
  normalizePersistedAttributes,
} from "../engine/idolAttributes";
import { resolveGroupLetterTier, sortGroupsForDirectory, addCalendarDays } from "../engine/financeSystem";
import {
  AUTOPILOT_LIVE_WEEKDAY_INDEX,
  getBlockingNotificationForSave,
} from "../engine/gameEngine";
import { formatLiveSlotLine } from "../engine/liveScheduleWeb";
import { attrQuotedUrl, avatarPlaceholderDataUrl, idolPortraitPublicSrc } from "./portraitUrl";
import {
  activeGroupMembershipsAtReference,
  activeGroupsAtReference,
  ageLabel,
  displayReferenceIso,
  groupNamesByUid,
  lookupGroupUidByName,
  romajiFromRow,
} from "./idolRowMeta";
import { htmlEsc } from "./htmlEsc";
import { notificationRequiresAck } from "../save/inbox";
import { renderGroupDetailPage } from "./groupDetailPage";
import {
  isSongHiddenFromDisplay,
  songPopularityNum,
  songsForDisplaySorted,
  buildDiscBuckets,
  primaryDiscLabel,
  splitSongsReleasedVsMaking,
  type DiscBucket,
} from "../data/songDisplayPolicy";
import {
  defaultAutopilotTrainingIntensity,
  safeTrainingRow,
  trainingLoadFromRow,
  trainingBearIndex,
} from "../engine/idolStatusSystem";

const FOCUS_SKILL_OPTIONS = ["", "talking", "host", "variety", "acting", "make-up", "model"] as const;

function calendarDaysBetween(earlierIso: string, laterIso: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(earlierIso) || !/^\d{4}-\d{2}-\d{2}$/.test(laterIso)) return 0;
  const a = new Date(`${earlierIso}T12:00:00Z`).getTime();
  const b = new Date(`${laterIso}T12:00:00Z`).getTime();
  return Math.round((b - a) / 86400000);
}

function startOfUtcMonthIso(isoYmd: string): string {
  const s = String(isoYmd).split("T")[0].trim();
  const m = /^(\d{4})-(\d{2})/.exec(s);
  if (!m) return "2000-01-01";
  return `${m[1]}-${m[2]}-01`;
}

function daysInUtcMonth(year: number, month1to12: number): number {
  return new Date(Date.UTC(year, month1to12, 0)).getUTCDate();
}

function formatMonthYearTitleUtc(firstOfMonthIso: string): string {
  const y = parseInt(firstOfMonthIso.slice(0, 4), 10);
  const m1 = parseInt(firstOfMonthIso.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m1)) return firstOfMonthIso;
  const d = new Date(Date.UTC(y, m1 - 1, 1));
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
}

function buildScheduleMonthCalendarHtml(
  firstOfMonthIso: string,
  ctx: {
    gameStart: string;
    cur: string;
    nextIso: string;
    schedules: Record<string, unknown>[];
    results: Record<string, unknown>[];
  },
): string {
  const y = parseInt(firstOfMonthIso.slice(0, 4), 10);
  const m1 = parseInt(firstOfMonthIso.slice(5, 7), 10);
  if (!Number.isFinite(y) || !Number.isFinite(m1) || m1 < 1 || m1 > 12) {
    return `<p class="content-muted">Invalid month.</p>`;
  }
  const dim = daysInUtcMonth(y, m1);
  const firstDow = new Date(Date.UTC(y, m1 - 1, 1)).getUTCDay();

  const scheduleByDate = new Map<string, Record<string, unknown>[]>();
  for (const s of ctx.schedules) {
    const d = String(s.start_date ?? "").split("T")[0];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) continue;
    if (!scheduleByDate.has(d)) scheduleByDate.set(d, []);
    scheduleByDate.get(d)!.push(s);
  }
  const resultDates = new Set<string>();
  for (const r of ctx.results) {
    const d = String(r.date ?? r.start_date ?? "").split("T")[0];
    if (/^\d{4}-\d{2}-\d{2}$/.test(d)) resultDates.add(d);
  }

  const gs = /^\d{4}-\d{2}-\d{2}$/.test(ctx.gameStart) ? ctx.gameStart : "2020-01-01";
  const dowLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const head = dowLabels.map((lab) => `<div class="schedule-cal-dow">${htmlEsc(lab)}</div>`).join("");

  const cells: string[] = [];
  for (let i = 0; i < firstDow; i++) {
    cells.push(`<div class="schedule-cal-cell schedule-cal-cell--pad" aria-hidden="true"></div>`);
  }
  for (let day = 1; day <= dim; day++) {
    const iso = `${String(y).padStart(4, "0")}-${String(m1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const offset = calendarDaysBetween(gs, iso);
    const autop = offset >= 0 && offset % 7 === AUTOPILOT_LIVE_WEEKDAY_INDEX;
    const booked = scheduleByDate.has(iso);
    const played = resultDates.has(iso);
    const isNext = iso === ctx.nextIso;
    const isClosed = iso <= ctx.cur;
    const cls = [
      "schedule-cal-cell",
      isClosed ? "is-past" : "",
      isNext ? "is-next-day" : "",
      autop ? "has-autopilot" : "",
      booked ? "has-booking" : "",
      played ? "has-result" : "",
    ]
      .filter(Boolean)
      .join(" ");

    const extras = scheduleByDate.get(iso) ?? [];
    const tip: string[] = [];
    if (isClosed) tip.push("Day closed in save");
    if (isNext) tip.push("Next simulation day");
    if (autop) tip.push("Autopilot live weekday");
    if (booked) {
      for (const ex of extras.slice(0, 2)) {
        const vn = String((ex as Record<string, unknown>).venue ?? "").trim();
        const tt = String((ex as Record<string, unknown>).title ?? (ex as Record<string, unknown>).live_type ?? "Live");
        tip.push(vn ? `${tt} @ ${vn}` : tt);
      }
      if (extras.length > 2) tip.push(`+${extras.length - 2} more`);
    }
    if (played) tip.push("Has played live result");
    const title = tip.join(" · ") || iso;

    cells.push(`<div class="${cls}" title="${htmlEsc(title)}">
      <span class="schedule-cal-daynum">${day}</span>
      <span class="schedule-cal-dots" aria-hidden="true">
        ${autop ? `<span class="schedule-cal-dot schedule-cal-dot--auto"></span>` : ""}
        ${booked ? `<span class="schedule-cal-dot schedule-cal-dot--book"></span>` : ""}
        ${played ? `<span class="schedule-cal-dot schedule-cal-dot--done"></span>` : ""}
      </span>
    </div>`);
  }

  const padTail = (7 - ((firstDow + dim) % 7)) % 7;
  for (let i = 0; i < padTail; i++) {
    cells.push(`<div class="schedule-cal-cell schedule-cal-cell--pad" aria-hidden="true"></div>`);
  }

  const legend = `<ul class="schedule-cal-legend">
    <li><span class="schedule-cal-dot schedule-cal-dot--auto"></span> ${htmlEsc("Autopilot live day (offset % 7)")}</li>
    <li><span class="schedule-cal-dot schedule-cal-dot--book"></span> ${htmlEsc("Booked live in save")}</li>
    <li><span class="schedule-cal-dot schedule-cal-dot--done"></span> ${htmlEsc("Played result logged")}</li>
    <li class="schedule-cal-legend-outline">${htmlEsc("Outline = next simulation day")}</li>
  </ul>`;

  const monthTitle = formatMonthYearTitleUtc(firstOfMonthIso);

  return `<div class="schedule-cal" data-sched-cal-root="${htmlEsc(firstOfMonthIso)}">
    <div class="schedule-cal-toolbar">
      <button type="button" class="fm-btn" data-sched-cal-delta="-1" aria-label="Previous month">${htmlEsc("←")}</button>
      <h3 class="schedule-cal-month-title content-h3">${htmlEsc(monthTitle)}</h3>
      <button type="button" class="fm-btn" data-sched-cal-delta="1" aria-label="Next month">${htmlEsc("→")}</button>
      <button type="button" class="fm-btn fm-btn-accent schedule-cal-today" data-sched-cal-today="1">${htmlEsc("This month")}</button>
    </div>
    <div class="schedule-cal-grid" role="grid" aria-label="Month calendar">${head}${cells.join("")}</div>
    ${legend}
  </div>`;
}

/** Primary Songs workspace tabs (matches `public/ref/main_ui.py` show_songs_view). */
export type SongsWorkspaceTab = "group_songs" | "disc";

/** Full management nav (browse mode restricts to Idol / Groups / Songs like desktop `_browse_mode`). */
export const MANAGEMENT_NAV_ITEMS = [
  "Inbox",
  "Idols",
  "Groups",
  "Training",
  "Schedule",
  "Lives",
  "Songs",
  "Making",
  "Publish",
  "Scout",
  "Finances",
] as const;

export const BROWSE_NAV_ITEMS = ["Idols", "Groups", "Songs"] as const;

export type DesktopNavId = (typeof MANAGEMENT_NAV_ITEMS)[number] | (typeof BROWSE_NAV_ITEMS)[number];

export function isManagementNav(s: string): s is (typeof MANAGEMENT_NAV_ITEMS)[number] {
  return (MANAGEMENT_NAV_ITEMS as readonly string[]).includes(s);
}

export function isBrowseNav(s: string): s is (typeof BROWSE_NAV_ITEMS)[number] {
  return (BROWSE_NAV_ITEMS as readonly string[]).includes(s);
}

export function isDesktopNavId(s: string): s is DesktopNavId {
  return isManagementNav(s) || isBrowseNav(s);
}

/** Browse / expandable catalog caps (scenario JSON can list tens of thousands of songs). */
const SONG_EXPAND_ALL_LIMIT = 500;

function xFollowersNum(row: Record<string, unknown>): number {
  const v = row.x_followers;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (v == null || v === "") return Number.NEGATIVE_INFINITY;
  const n = Number(v);
  return Number.isFinite(n) ? n : Number.NEGATIVE_INFINITY;
}

function sortIdolsByXFollowersDesc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => xFollowersNum(b) - xFollowersNum(a));
}

function xFollowersLabel(row: Record<string, unknown>): string {
  const v = row.x_followers;
  if (typeof v === "number" && Number.isFinite(v)) return v.toLocaleString("ja-JP");
  if (v == null || v === "") return "—";
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("ja-JP") : "—";
}

function heightCmLabel(row: Record<string, unknown>): string {
  const h = row.height;
  if (typeof h === "number" && Number.isFinite(h)) return String(Math.round(h));
  return "—";
}

function buildSongCountByGroupUid(songs: Record<string, unknown>[] | undefined): Map<string, number> {
  const m = new Map<string, number>();
  if (!Array.isArray(songs)) return m;
  for (const s of songs) {
    if (isSongHiddenFromDisplay(s as Record<string, unknown>)) continue;
    const g = String((s as { group_uid?: unknown }).group_uid ?? "").trim();
    if (!g) continue;
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function formatLongDate(iso: string | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "—";
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function shortlistRows(save: GameSavePayload): { uid: string; label: string }[] {
  const idols = save.database_snapshot.idols;
  const byUid = new Map<string, Record<string, unknown>>();
  for (const row of idols) {
    const uid = row && typeof row === "object" && "uid" in row ? String((row as { uid?: string }).uid) : "";
    if (uid) byUid.set(uid, row as Record<string, unknown>);
  }
  return save.shortlist.map((uid) => {
    const row = byUid.get(uid);
    const name =
      row && typeof row.name === "string"
        ? row.name
        : row && typeof row.romaji === "string"
          ? row.romaji
          : uid.slice(0, 8) + "…";
    return { uid, label: name };
  });
}

function renderPlaceholder(view: string, blurb?: string): string {
  const text =
    blurb ??
    `This screen mirrors the desktop <strong>${htmlEsc(view)}</strong> tab. Gameplay will be ported step by step.`;
  return `<section class="content-panel" aria-label="${htmlEsc(view)}"><p class="content-lead">${text}</p></section>`;
}

function attrsFromRow(row: Record<string, unknown>): PersistedIdolAttributes {
  return row.attributes ? normalizePersistedAttributes(row.attributes) : normalizePersistedAttributes(undefined);
}

function attrBarClass(v: number): string {
  if (v >= 15) return "is-high";
  if (v >= 10) return "is-mid";
  return "is-low";
}

function attrStatRow(key: string, v: number): string {
  const pct = Math.max(0, Math.min(100, (v / 20) * 100));
  const label = key.replace(/_/g, " ");
  return `<div class="attr-dl-row"><dt>${htmlEsc(label)}</dt><dd class="attr-dd-bar"><span class="attr-bar-track" aria-hidden="true"><span class="attr-bar-fill ${attrBarClass(v)}" style="width:${pct.toFixed(1)}%"></span></span><span class="attr-bar-val">${v}</span></dd></div>`;
}

/** Public X profile URL from `x_url`, or built from `x_account` / `x_handle`. */
function idolXProfileUrl(row: Record<string, unknown>): string | undefined {
  const raw = row.x_url;
  if (typeof raw === "string") {
    const u = raw.trim();
    if (/^https?:\/\//i.test(u)) return u;
  }
  const acctRaw =
    (typeof row.x_account === "string" && row.x_account.trim()) ||
    (typeof row.x_handle === "string" && row.x_handle.trim());
  if (!acctRaw) return undefined;
  const acct = acctRaw.replace(/^@+/, "").trim();
  if (!acct) return undefined;
  return `https://x.com/${encodeURIComponent(acct)}`;
}

function renderAttributePanels(a: PersistedIdolAttributes): string {
  const row = (
    keys: [string, number][],
    label: string,
  ) =>
    `<div class="attr-block"><span class="attr-block-label">${htmlEsc(label)}</span><dl class="attr-dl">${keys
      .map(([k, v]) => attrStatRow(k, v))
      .join("")}</dl></div>`;

  const p = a.physical;
  const ap = a.appearance;
  const t = a.technical;
  const m = a.mental;

  return `
    <div class="attr-panels">
      ${row(
        [
          ["strength", p.strength],
          ["agility", p.agility],
          ["natural_fitness", p.natural_fitness],
          ["stamina", p.stamina],
        ],
        "Physical",
      )}
      ${row(
        [
          ["cute", ap.cute],
          ["pretty", ap.pretty],
        ],
        "Appearance",
      )}
      ${row(
        [
          ["pitch", t.pitch],
          ["tone", t.tone],
          ["breath", t.breath],
          ["rhythm", t.rhythm],
          ["power", t.power],
          ["grace", t.grace],
        ],
        "Technical",
      )}
      ${row(
        [
          ["clever", m.clever],
          ["humor", m.humor],
          ["talking", m.talking],
          ["determination", m.determination],
          ["teamwork", m.teamwork],
          ["fashion", m.fashion],
        ],
        "Mental",
      )}
    </div>`;
}

function radarToneClass(v: number): string {
  const r = Math.round(v);
  if (r >= 15) return "attr-tone-high";
  if (r >= 10) return "attr-tone-mid";
  return "attr-tone-low";
}

function fmtHistoryDateCell(v: unknown): string {
  if (typeof v === "string" && v.trim()) return v.trim().split("T")[0];
  if (v == null || v === "") return "—";
  return String(v);
}

function refDayString(refIso: string | undefined): string | undefined {
  if (!refIso || typeof refIso !== "string") return undefined;
  const s = refIso.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : undefined;
}

function historyIsoDay(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const s = v.trim().split("T")[0];
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

/** When JSON marks a future join/leave as not yet confirmed, suppress the date cell. */
function historyDateDetermined(entry: Record<string, unknown>, role: "start" | "end"): boolean {
  const keys =
    role === "start"
      ? (["start_date_determined", "start_determined", "join_date_determined"] as const)
      : (["end_date_determined", "end_determined", "leave_date_determined"] as const);
  for (const k of keys) {
    if (k in entry) return (entry as Record<string, unknown>)[k] !== false;
  }
  return true;
}

/**
 * Group history date cell vs scenario reference: past/present shows ISO day; future shows day + (planned)
 * only when the date is treated as determined. Otherwise blank (no placeholder date).
 */
function fmtHistoryDateDisplay(
  v: unknown,
  refIso: string | undefined,
  entry: Record<string, unknown>,
  role: "start" | "end",
): string {
  if (v == null || v === "") return "—";

  const day = historyIsoDay(v);
  const ref = refDayString(refIso);
  if (!day) return fmtHistoryDateCell(v);

  if (!ref) return day;

  const dMs = new Date(`${day}T12:00:00Z`).getTime();
  const rMs = new Date(`${ref}T12:00:00Z`).getTime();
  if (dMs > rMs) {
    if (!historyDateDetermined(entry, role)) return "";
    return `${day} (planned)`;
  }
  return day;
}

/** Five-axis workbook radar (desktop `idol_ui._create_attribute_radar` geometry, SVG). */
function renderRadarSvg(a: PersistedIdolAttributes): string {
  const dims = getWorkbookRadarDimensions(a);
  const n = dims.length;
  const cx = 100;
  const cy = 100;
  const rMax = 74;
  const rLabel = 86;
  const valOutset = 4;
  const start = -Math.PI / 2;
  const step = (2 * Math.PI) / n;

  const axisLines: string[] = [];
  const labelEls: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = start + i * step;
    const xe = cx + rMax * Math.cos(ang);
    const ye = cy + rMax * Math.sin(ang);
    axisLines.push(`<line x1="${cx}" y1="${cy}" x2="${xe.toFixed(2)}" y2="${ye.toFixed(2)}" class="idol-radar-axis"/>`);
    const xl = cx + rLabel * Math.cos(ang);
    const yl = cy + rLabel * Math.sin(ang);
    const ta = Math.abs(xl - cx) < 8 ? "middle" : xl < cx ? "end" : "start";
    const dy = yl < cy - 4 ? "0.3em" : yl > cy + 4 ? "-0.3em" : "0.25em";
    labelEls.push(
      `<text x="${xl.toFixed(1)}" y="${yl.toFixed(1)}" class="idol-radar-lbl" text-anchor="${ta}" dominant-baseline="middle" dy="${dy}">${htmlEsc(dims[i].key)}</text>`,
    );
  }

  const rings = [0.25, 0.5, 0.75, 1.0]
    .map((ratio) => {
      const pts: string[] = [];
      for (let i = 0; i < n; i++) {
        const ang = start + i * step;
        const r = rMax * ratio;
        pts.push(`${(cx + r * Math.cos(ang)).toFixed(2)},${(cy + r * Math.sin(ang)).toFixed(2)}`);
      }
      return `<polygon points="${pts.join(" ")}" class="idol-radar-ring"/>`;
    })
    .join("");

  const polyPts: string[] = [];
  const valueEls: string[] = [];
  for (let i = 0; i < n; i++) {
    const ang = start + i * step;
    const v = Math.max(0, Math.min(20, dims[i].value));
    const rad = (v / 20) * rMax;
    const x = cx + rad * Math.cos(ang);
    const y = cy + rad * Math.sin(ang);
    polyPts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
    const xv = cx + (rad + valOutset) * Math.cos(ang);
    const yv = cy + (rad + valOutset) * Math.sin(ang);
    valueEls.push(
      `<text x="${xv.toFixed(1)}" y="${yv.toFixed(1)}" class="idol-radar-val ${radarToneClass(v)}" text-anchor="middle" dominant-baseline="middle">${htmlEsc(v.toFixed(1))}</text>`,
    );
  }

  return `<figure class="idol-radar-figure idol-radar-figure-detail">
  <svg class="idol-radar-svg idol-radar-svg-detail" viewBox="-10 -10 220 220" overflow="visible" role="img" aria-label="Five-axis attribute radar">
    ${rings}
    ${axisLines.join("")}
    <polygon points="${polyPts.join(" ")}" class="idol-radar-poly"/>
    ${valueEls.join("")}
    ${labelEls.join("")}
  </svg>
</figure>`;
}

function renderGroupHistoryTable(
  row: Record<string, unknown>,
  uidToName: Map<string, string>,
  groupsSnapshot: Record<string, unknown>[],
  referenceIso: string | undefined,
): string {
  const hist = row.group_history;
  if (!Array.isArray(hist) || !hist.length) {
    return `<p class="content-muted">No group history in snapshot.</p>`;
  }
  const tbody = hist
    .filter((x): x is Record<string, unknown> => Boolean(x && typeof x === "object"))
    .map((e) => {
      const gname = String(e.group_name ?? "").trim();
      let guid = String(e.group_uid ?? "").trim();
      const label =
        gname ||
        (guid ? (uidToName.get(guid) ?? `${guid.slice(0, 10)}…`) : "—");
      if (!guid && label !== "—") guid = lookupGroupUidByName(groupsSnapshot, label) ?? "";
      const groupCell = guid
        ? `<button type="button" class="idol-history-group-link" data-group-detail="${htmlEsc(guid)}">${htmlEsc(label)}</button>`
        : htmlEsc(label);
      const col = typeof e.member_color === "string" && e.member_color ? e.member_color : "—";
      const mn = typeof e.member_name === "string" && e.member_name ? e.member_name : "—";
      const startDisp = fmtHistoryDateDisplay(e.start_date, referenceIso, e, "start");
      const endDisp = fmtHistoryDateDisplay(e.end_date, referenceIso, e, "end");
      return `<tr><td>${groupCell}</td><td>${startDisp ? htmlEsc(startDisp) : ""}</td><td>${endDisp ? htmlEsc(endDisp) : ""}</td><td>${htmlEsc(col)}</td><td>${htmlEsc(mn)}</td></tr>`;
    })
    .join("");
  return `
    <div class="table-scroll idol-history-scroll">
      <table class="fm-table">
        <thead><tr><th>Group</th><th>Start</th><th>End</th><th>Color</th><th>Stage name</th></tr></thead>
        <tbody>${tbody}</tbody>
      </table>
    </div>`;
}

function pastNamesSummary(row: Record<string, unknown>): string {
  const pn = row.past_names;
  if (!pn || typeof pn !== "object") return "—";
  const entries = Object.entries(pn as Record<string, unknown>)
    .map(([k, v]) => `${k}${v != null && String(v) ? ` (${String(v)})` : ""}`)
    .filter(Boolean);
  return entries.length ? entries.join(" · ") : "—";
}

/** Single-idol profile (mirrors desktop `IdolUIMixin._show_idol_profile`). */
function renderIdolDetailPage(
  row: Record<string, unknown>,
  groupsSnapshot: Record<string, unknown>[],
  referenceIso: string | undefined,
): string {
  const name = typeof row.name === "string" ? row.name : "—";
  const romaji = romajiFromRow(row);
  const nick = typeof row.nickname === "string" ? row.nickname.trim() : "";
  const hiragana = typeof row.hiragana === "string" ? row.hiragana.trim() : "";
  const attrs = attrsFromRow(row);
  const attrPanels = renderAttributePanels(attrs);

  const initial = [...(name.trim() || "?")][0] ?? "?";
  const portraitSrc = idolPortraitPublicSrc(row);
  const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
  const portraitBig = portraitSrc
    ? `<img class="idol-detail-portrait" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" width="220" height="220" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
    : `<div class="idol-detail-portrait-ph" aria-hidden="true">${htmlEsc(initial)}</div>`;

  const age = htmlEsc(ageLabel(row, referenceIso));
  const xLbl = htmlEsc(xFollowersLabel(row));
  const memberships = activeGroupMembershipsAtReference(row, referenceIso, groupsSnapshot);
  const currentGroupsHtml =
    memberships.length > 0
      ? memberships
          .map((m) =>
            m.uid
              ? `<button type="button" class="idol-detail-group-link" data-group-detail="${htmlEsc(m.uid)}">${htmlEsc(m.name)}</button>`
              : htmlEsc(m.name),
          )
          .join(", ")
      : htmlEsc("—");

  const secLine = [
    romaji ? htmlEsc(romaji) : "",
    nick ? `${htmlEsc("Nickname")}: ${htmlEsc(nick)}` : "",
    hiragana ? htmlEsc(hiragana) : "",
  ]
    .filter(Boolean)
    .join(" | ");

  const facts: string[] = [];
  facts.push(`${htmlEsc("Age")} ${age}`);
  const tenure = row.scenario_tenure_years;
  if (typeof tenure === "number" && Number.isFinite(tenure)) {
    facts.push(`${htmlEsc("Tenure")} ${htmlEsc(`${tenure.toFixed(1)}y`)}`);
  }
  const h = row.height;
  if (typeof h === "number" && Number.isFinite(h)) facts.push(htmlEsc(`${Math.round(h)} cm`));
  const bp = typeof row.birthplace === "string" && row.birthplace.trim() ? row.birthplace.trim() : "";
  if (bp) facts.push(htmlEsc(bp));

  const uidToName = groupNamesByUid(groupsSnapshot);
  const birthdayDisplay =
    typeof row.birthday === "string" && row.birthday.trim()
      ? htmlEsc(row.birthday.trim().split("T")[0])
      : typeof row.birthday_partial === "string" && row.birthday_partial.trim()
        ? htmlEsc(row.birthday_partial.trim())
        : "—";
  const langs = Array.isArray(row.languages) ? row.languages.map((x) => String(x)).join(", ") : "";

  const xa = typeof row.x_account === "string" ? row.x_account.trim() : "";
  const xh = typeof row.x_handle === "string" ? row.x_handle.trim() : "";
  let xHandle = "—";
  if (xa) xHandle = `@${xa.replace(/^@/, "")}`;
  else if (xh) xHandle = xh.startsWith("@") ? xh : `@${xh}`;

  const wikiUrl =
    typeof row.wiki_url === "string" && row.wiki_url.trim().startsWith("http") ? row.wiki_url.trim() : "";
  const xProfileUrl = idolXProfileUrl(row);
  const xFollowersDisp = xFollowersLabel(row);

  const xHandleLink =
    xProfileUrl && xHandle !== "—"
      ? `<a class="idol-detail-x-strip-a" href="${attrQuotedUrl(xProfileUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc(xHandle)}</a>`
      : xHandle !== "—"
        ? `<span class="idol-detail-x-strip-plain">${htmlEsc(xHandle)}</span>`
        : "";

  const wikiPart = wikiUrl
    ? `<a class="idol-detail-wiki-inline" href="${attrQuotedUrl(wikiUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc("Wiki")}</a>`
    : "";

  const ablPart = `<span class="idol-detail-inline-frame idol-detail-abl-frame">${htmlEsc("ABL")} <strong>${getAbility(attrs)}</strong></span>`;

  const xPart = `<span class="idol-detail-inline-frame idol-detail-x-frame">
      <span class="idol-detail-x-prefix">${htmlEsc("X")}</span>
      ${xHandleLink}
      <span class="idol-detail-x-followers">${htmlEsc(xFollowersDisp)}</span>
    </span>`;

  const linksInline = `<div class="idol-detail-links-inline">${wikiPart}${ablPart}${xPart}</div>`;

  return `
<section class="content-panel idol-detail-view" aria-label="${htmlEsc(name)}">
  <header class="idol-detail-toolbar">
    <button type="button" class="fm-btn fm-btn-accent" id="btn-idol-detail-back">← Idol list</button>
  </header>

  <div class="idol-detail-head fm-card idol-detail-head-grid">
    <div class="idol-detail-portrait-wrap">${portraitBig}</div>
    <div class="idol-detail-head-main">
      <h2 class="idol-detail-name">${htmlEsc(name)}</h2>
      ${secLine ? `<p class="idol-detail-sub">${secLine}</p>` : ""}
      <p class="idol-detail-facts">${facts.join(` ${htmlEsc("•")} `)}</p>
      <p class="idol-detail-current-groups"><strong>${htmlEsc("Group")}:</strong> ${currentGroupsHtml}</p>
      ${linksInline}
    </div>
    <aside class="idol-detail-radar-aside" aria-label="Radar">
      ${renderRadarSvg(attrs)}
    </aside>
  </div>

  <section class="fm-card idol-detail-block">
    <h3 class="content-h3 idol-detail-h">${htmlEsc("Attributes")}</h3>
    <div class="idol-detail-attrs">${attrPanels}</div>
  </section>

  <section class="fm-card idol-detail-block">
    <h3 class="content-h3 idol-detail-h">${htmlEsc("Basic information")}</h3>
    <dl class="basic-dl">
      <div><dt>${htmlEsc("Birthday")}</dt><dd>${birthdayDisplay}</dd></div>
      <div><dt>${htmlEsc("Birthplace")}</dt><dd>${bp ? htmlEsc(bp) : "—"}</dd></div>
      <div><dt>${htmlEsc("Languages")}</dt><dd>${langs ? htmlEsc(langs) : htmlEsc("Japanese")}</dd></div>
      <div><dt>${htmlEsc("Past names")}</dt><dd>${htmlEsc(pastNamesSummary(row))}</dd></div>
      <div><dt>${htmlEsc("X handle")}</dt><dd>${htmlEsc(xHandle)}</dd></div>
      <div><dt>${htmlEsc("X followers")}</dt><dd>${xLbl}</dd></div>
    </dl>
  </section>

  <section class="fm-card idol-detail-block">
    <h3 class="content-h3 idol-detail-h">${htmlEsc("Group history")}</h3>
    ${renderGroupHistoryTable(row, uidToName, groupsSnapshot, referenceIso)}
  </section>
</section>`;
}

function renderInbox(save: GameSavePayload, selectedUid: string | null): string {
  const rows = [...save.inbox.notifications].reverse();
  if (!rows.length) {
    return `<section class="content-panel"><p class="content-muted">No messages in inbox.</p></section>`;
  }
  const sel = selectedUid && rows.some((r) => r.uid === selectedUid) ? selectedUid : null;
  const selected = sel ? rows.find((r) => r.uid === sel) ?? null : null;

  const markAllDisabled = rows.every((r) => r.read || notificationRequiresAck(r));

  const list = rows
    .map((n) => {
      const unread = !n.read ? `<span class="badge-unread" aria-hidden="true">●</span> ` : "";
      const active = n.uid === sel ? " is-active" : "";
      return `<button type="button" class="inbox-row-btn fm-card${active}" data-inbox-uid="${htmlEsc(n.uid)}">
        <span class="inbox-row-title">${unread}<span>${htmlEsc(n.title)}</span></span>
        <span class="inbox-row-meta">${htmlEsc(n.date)} · ${htmlEsc(n.sender)}</span>
      </button>`;
    })
    .join("");

  const detail = selected
    ? (() => {
        const isLiveSchedule =
          selected.title === "Today's live schedule" ||
          String(selected.dedupe_key ?? "").startsWith("daily-lives|");
        const primaryBtn = isLiveSchedule
          ? `<button type="button" class="fm-btn fm-btn-accent" data-inbox-live-start="${htmlEsc(selected.uid)}" ${selected.read ? "disabled" : ""}>${htmlEsc("Live Start")}</button>`
          : `<button type="button" class="fm-btn fm-btn-accent" data-inbox-mark-read="${htmlEsc(selected.uid)}" ${selected.read ? "disabled" : ""}>${htmlEsc("Mark read")}</button>`;
        return `<article class="fm-card inbox-detail-card" aria-label="Message detail">
        <header class="fm-card-head">
          <h3 class="content-h3 inbox-detail-h">${htmlEsc(selected.title)}</h3>
          <p class="inbox-detail-meta"><time datetime="${htmlEsc(selected.date)}">${htmlEsc(selected.date)}</time> · ${htmlEsc(selected.sender)} · ${htmlEsc(selected.category)}</p>
        </header>
        <div class="inbox-detail-body">${htmlEsc(selected.body).replaceAll("\n", "<br />")}</div>
        ${
          selected.requires_confirmation
            ? `<p class="inbox-flag" role="note"><strong>Confirmation required</strong> — ${isLiveSchedule ? "Use Live Start to run the live and clear this blocker." : "Acknowledge when you have decided (full choice parity is still in progress)."}</p>`
            : ""
        }
        <div class="inbox-detail-actions">
          ${primaryBtn}
        </div>
      </article>`;
      })()
    : `<p class="content-muted">Select a message.</p>`;

  return `<section class="content-panel inbox-view">
    <div class="inbox-toolbar">
      <h2 class="content-h2 inbox-h2">Inbox</h2>
      <button type="button" class="fm-btn" id="btn-inbox-mark-all" ${markAllDisabled ? "disabled" : ""}>${htmlEsc("Mark all read")}</button>
    </div>
    <div class="inbox-split">
      <div class="inbox-list-col fm-card" role="navigation" aria-label="Messages">${list}</div>
      <div class="inbox-detail-col">${detail}</div>
    </div>
  </section>`;
}

function renderTraining(save: GameSavePayload): string {
  const grp = getPrimaryGroup(save);
  const memberUidsRaw = Array.isArray(grp?.member_uids)
    ? (grp!.member_uids as unknown[]).map((x) => String(x))
    : [...save.shortlist];
  const idols = save.database_snapshot.idols;
  const ref =
    save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? undefined;

  const groupUidStr = String(grp?.uid ?? "").trim();
  const groupNames = new Set(
    [String(grp?.name ?? "").trim(), String(grp?.name_romanji ?? "").trim()].filter(Boolean),
  );

  /** Sort key: membership `start_date` in this group (earlier join first). */
  const joinDateMsInGroup = (row: Record<string, unknown>): number => {
    const hist = row.group_history;
    if (!Array.isArray(hist)) return Number.POSITIVE_INFINITY;
    for (const raw of hist) {
      if (!raw || typeof raw !== "object") continue;
      const e = raw as Record<string, unknown>;
      const uid = String(e.group_uid ?? "").trim();
      const gn = String(e.group_name ?? "").trim();
      if (uid === groupUidStr || (gn && groupNames.has(gn))) {
        const sd = typeof e.start_date === "string" ? e.start_date.trim().split("T")[0] : "";
        if (/^\d{4}-\d{2}-\d{2}$/.test(sd)) return new Date(`${sd}T12:00:00Z`).getTime();
        return Number.POSITIVE_INFINITY;
      }
    }
    return Number.POSITIVE_INFINITY;
  };

  const memberUids = [...memberUidsRaw].sort((a, b) => {
    const ra = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === a) as Record<string, unknown> | undefined;
    const rb = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === b) as Record<string, unknown> | undefined;
    if (!ra) return 1;
    if (!rb) return -1;
    const da = joinDateMsInGroup(ra);
    const db = joinDateMsInGroup(rb);
    if (da !== db) return da - db;
    return a.localeCompare(b);
  });

  const cards = memberUids
    .map((uid) => {
      const row = idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uid);
      if (!row || typeof row !== "object") return "";
      const r = row as Record<string, unknown>;
      const name = typeof r.name === "string" ? r.name : uid.slice(0, 8);
      const romaji = romajiFromRow(r);
      if (!save.training_intensity[uid]) {
        save.training_intensity[uid] = { ...defaultAutopilotTrainingIntensity() };
      }
      if (save.training_focus_skill[uid] == null || save.training_focus_skill[uid] === undefined) {
        save.training_focus_skill[uid] = "talking";
      }
      const intensity = safeTrainingRow(save.training_intensity[uid]);
      const load = trainingLoadFromRow(intensity);
      const bear = trainingBearIndex(r);
      const over = Math.max(0, load - bear);
      const focus = String(save.training_focus_skill[uid] ?? "");

      const slider = (field: keyof typeof intensity, label: string) => {
        const v = intensity[field];
        return `<label class="training-slider"><span class="training-slider-l">${htmlEsc(label)}</span>
          <input type="range" min="0" max="5" step="1" value="${v}" data-training-slider data-idol-uid="${htmlEsc(uid)}" data-field="${field}" aria-valuemin="0" aria-valuemax="5" />
          <span class="training-slider-v" data-training-val="${htmlEsc(uid)}-${field}">${v}</span></label>`;
      };

      const focusOpts = FOCUS_SKILL_OPTIONS.map((opt) => {
        const lab = opt === "" ? "— (none)" : opt;
        return `<option value="${htmlEsc(opt)}" ${focus === opt ? "selected" : ""}>${htmlEsc(lab)}</option>`;
      }).join("");

      const cond = typeof r.condition === "number" ? r.condition : Number(r.condition ?? 0) || 0;
      const mor = typeof r.morale === "number" ? r.morale : Number(r.morale ?? 0) || 0;

      const nameLine = romaji
        ? `<h3 class="content-h3 training-member-title"><span class="training-name-ja">${htmlEsc(name)}</span><span class="training-name-ro">${htmlEsc(romaji)}</span></h3>`
        : `<h3 class="content-h3 training-member-title"><span class="training-name-ja">${htmlEsc(name)}</span></h3>`;

      return `<article class="fm-card training-member-card" data-training-card="${htmlEsc(uid)}">
        <header class="training-member-head">
          <div class="training-member-nameblock">
            ${nameLine}
          </div>
          <div class="training-member-stats">
            <span title="Condition">C ${htmlEsc(String(cond))}</span>
            <span title="Morale">M ${htmlEsc(String(mor))}</span>
          </div>
        </header>
        <p class="content-muted training-bear-line" data-training-bear="${htmlEsc(uid)}">${htmlEsc(`Training load ${load}/20 · bear index ${bear}`)}${over > 0 ? htmlEsc(` · overwork +${over} vs bear`) : ""}</p>
        <div class="training-sliders">
          ${slider("sing", "Sing")}
          ${slider("dance", "Dance")}
          ${slider("physical", "Physical")}
          ${slider("target", "Target / misc")}
          <label class="training-slider training-focus-slider-row">
            <span class="training-slider-l">${htmlEsc("Special focus")}</span>
            <select class="fm-select training-focus-select" data-training-focus data-idol-uid="${htmlEsc(uid)}" aria-label="${htmlEsc("Special focus (weekly bonus track)")}">${focusOpts}</select>
            <span class="training-slider-v" aria-hidden="true"> </span>
          </label>
        </div>
      </article>`;
    })
    .filter(Boolean)
    .join("");

  return `<section class="content-panel training-view">
    <h2 class="content-h2">Training</h2>
    <p class="content-muted">Daily sliders (0–5 each) for <strong>${htmlEsc(String(grp?.name_romanji ?? grp?.name ?? "group"))}</strong>. Sum caps at 20 and feeds <code>advanceOneDay</code> with the same condition/morale rules as the desktop save loop. Reference date: ${htmlEsc(String(ref ?? "—"))}.</p>
    <div class="training-grid">${cards || `<p class="content-muted">No roster members.</p>`}</div>
  </section>`;
}

function renderFinances(save: GameSavePayload): string {
  const f = getActiveFinances(save);
  const ledger = [...f.ledger].slice(-20).reverse();
  const head = `
    <div class="stat-row" role="group" aria-label="Cash">
      <div class="stat-block"><span class="stat-label">Cash (JPY)</span><span class="stat-value">¥${f.cash_yen.toLocaleString("ja-JP")}</span></div>
      <div class="stat-block"><span class="stat-label">Last close</span><span class="stat-value stat-value-sm">${htmlEsc(f.last_processed_date ?? "—")}</span></div>
    </div>`;
  const tableRows = ledger
    .map(
      (row) =>
        `<tr><td>${htmlEsc(row.date)}</td><td class="num">${row.net_total.toLocaleString("ja-JP")}</td><td>${htmlEsc(row.tier)}</td><td class="num muted">${row.income_total.toLocaleString("ja-JP")}</td><td class="num muted">${row.expense_total.toLocaleString("ja-JP")}</td></tr>`,
    )
    .join("");
  return `
    <section class="content-panel finances-view">
      <h2 class="content-h2">Finances</h2>
      ${head}
      <div class="table-panel">
        <h3 class="content-h3">Daily ledger (recent)</h3>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Date</th><th>Net ¥</th><th>Tier</th><th>Income</th><th>Expense</th></tr></thead>
            <tbody>${tableRows || `<tr><td colspan="5" class="content-muted">No ledger rows yet.</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </section>`;
}

/** All idols · portrait · age / romaji / X / groups on reference date · open detail on click. */
function renderIdolsList(
  idols: Record<string, unknown>[],
  referenceIso: string | undefined,
  headline: string,
  layout: "cards" | "list",
  note?: string,
): string {
  if (!idols.length) return renderPlaceholder("Idols", "No idols in database snapshot.");

  const sorted = sortIdolsByXFollowersDesc(idols);
  const rows = sorted.filter((row) => typeof row.uid === "string" && row.uid.trim());

  const portraitThumbHtml = (row: Record<string, unknown>, name: string) => {
    const initial = [...(name.trim() || "?")][0] ?? "?";
    const portraitSrc = idolPortraitPublicSrc(row);
    const phData = attrQuotedUrl(avatarPlaceholderDataUrl(name));
    return portraitSrc
      ? `<img class="idol-thumb" src="${attrQuotedUrl(portraitSrc)}" data-fallback="${phData}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" />`
      : `<span class="idol-thumb-ph" aria-hidden="true">${htmlEsc(initial)}</span>`;
  };

  const cards = rows
    .map((row) => {
      const name = typeof row.name === "string" ? row.name : "—";
      const uid = (row.uid as string).trim();
      const romaji = romajiFromRow(row);
      const attrs = attrsFromRow(row);
      const age = ageLabel(row, referenceIso);
      const grps = activeGroupsAtReference(row, referenceIso);
      const grpTxt = grps.length ? grps.join(", ") : "—";
      const portraitInner = portraitThumbHtml(row, name);

      return `
      <button type="button" class="fm-card idol-card-tile idol-card-with-photo idol-card-compact" data-idol-detail="${htmlEsc(uid)}">
        <span class="idol-card-face" aria-hidden="true">${portraitInner}</span>
        <span class="idol-card-stack">
          <span class="idol-card-row1">
            <span class="idol-card-name">${htmlEsc(name)}</span>
            ${romaji ? `<span class="idol-card-romaji">${htmlEsc(romaji)}</span>` : ""}
          </span>
          <span class="idol-card-row2">${htmlEsc(`Age ${age}`)} · ${htmlEsc("X")} ${htmlEsc(xFollowersLabel(row))} · ${htmlEsc("ABL")} ${getAbility(attrs)}</span>
          <span class="idol-card-row3"><strong>${htmlEsc("Group")}:</strong> ${htmlEsc(grpTxt)}</span>
        </span>
      </button>`;
    })
    .join("");

  const tableRows = rows
    .map((row) => {
      const name = typeof row.name === "string" ? row.name : "—";
      const uid = (row.uid as string).trim();
      const romaji = romajiFromRow(row);
      const attrs = attrsFromRow(row);
      const age = ageLabel(row, referenceIso);
      const grps = activeGroupsAtReference(row, referenceIso);
      const grpTxt = grps.length ? grps.join(", ") : "—";
      const ph = portraitThumbHtml(row, name);
      return `<tr class="idol-list-table-row" data-idol-detail="${htmlEsc(uid)}" tabindex="0" role="button">
        <td class="idol-list-photo">${ph}</td>
        <td>${htmlEsc(name)}</td>
        <td>${romaji ? htmlEsc(romaji) : "—"}</td>
        <td>${htmlEsc(age)}</td>
        <td class="num">${htmlEsc(heightCmLabel(row))}</td>
        <td class="num">${getAbility(attrs)}</td>
        <td class="num">${htmlEsc(xFollowersLabel(row))}</td>
        <td>${htmlEsc(grpTxt)}</td>
      </tr>`;
    })
    .join("");

  const noteHtml = note ? `<p class="content-muted">${note}</p>` : "";
  const sortNote = `<p class="content-muted">${htmlEsc(
    "Order: X followers (high → low). Portraits: public/data/pictures/idols/ (basename of portrait_photo_path).",
  )}</p>`;

  const toolbar = `<div class="idol-list-toolbar" role="toolbar" aria-label="Idol list layout">
    <span class="idol-list-toolbar-label">${htmlEsc("View")}</span>
    <button type="button" class="fm-btn idol-list-mode-btn ${layout === "cards" ? "is-active" : ""}" data-idol-layout="cards">${htmlEsc("Cards")}</button>
    <button type="button" class="fm-btn idol-list-mode-btn ${layout === "list" ? "is-active" : ""}" data-idol-layout="list">${htmlEsc("List")}</button>
  </div>`;

  const body =
    layout === "cards"
      ? `<div class="idol-grid idol-grid--cards">${cards}</div>`
      : `<div class="table-scroll">
      <table class="fm-table idol-list-table">
        <thead>
          <tr>
            <th></th>
            <th>${htmlEsc("Name")}</th>
            <th>${htmlEsc("Romaji")}</th>
            <th>${htmlEsc("Age")}</th>
            <th>${htmlEsc("Height cm")}</th>
            <th>${htmlEsc("ABL")}</th>
            <th>${htmlEsc("X followers")}</th>
            <th>${htmlEsc("Current group(s)")}</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;

  return `
    <section class="content-panel idols-view">
      <h2 class="content-h2">${htmlEsc(headline)}</h2>
      <p class="content-muted">${htmlEsc(`${sorted.length.toLocaleString()} idols · reference ${referenceIso ?? "—"}`)}.</p>
      ${noteHtml}
      ${toolbar}
      ${sortNote}
      ${body}
    </section>`;
}

/** Making workshop: Title, Romanji, Type, empty disc text field, Arrange / Release (no release or pop columns). */
function makingWorkshopRowsHtml(rows: Record<string, unknown>[]): string {
  return rows
    .map((row) => {
      const title = typeof row.title === "string" ? row.title : String(row.uid ?? "—");
      const romanji = typeof row.title_romanji === "string" ? row.title_romanji : "";
      const dtype = typeof row.disc_type === "string" && row.disc_type.trim() ? String(row.disc_type) : "—";
      const uid = String(row.uid ?? "").trim();
      const uidAttr = uid ? encodeURIComponent(uid) : "";
      const uidData = uidAttr ? ` data-song-uid="${uidAttr}"` : "";
      const discInput = `<input type="text" class="fm-input making-disc-input" autocomplete="off" value="" data-making-disc-input${uidData} aria-label="${htmlEsc(`Disc · ${title}`.slice(0, 120))}" />`;
      const actions = `<div class="making-track-actions">
        <button type="button" class="fm-btn making-arrange-btn" data-making-arrange${uidData}>${htmlEsc("Arrange")}</button>
        <button type="button" class="fm-btn fm-btn-accent making-release-btn" data-making-release${uidData}>${htmlEsc("Release")}</button>
      </div>`;
      return `<tr><td>${htmlEsc(title)}</td><td>${htmlEsc(romanji)}</td><td>${htmlEsc(dtype)}</td><td class="making-disc-cell">${discInput}</td><td class="making-actions-cell">${actions}</td></tr>`;
    })
    .join("");
}

function songRowsHtml(
  rows: Record<string, unknown>[],
  cols: "pair" | "full",
  rowKind: "released" | "making" = "released",
): string {
  const hideCatalogFields = rowKind === "making";
  return rows
    .map((row) => {
      const title = typeof row.title === "string" ? row.title : String(row.uid ?? "—");
      const romanji = typeof row.title_romanji === "string" ? row.title_romanji : "";
      const rel = hideCatalogFields ? "—" : typeof row.release_date === "string" ? row.release_date : "—";
      const gname = typeof row.group_name === "string" ? row.group_name : "";
      const dtype = typeof row.disc_type === "string" ? row.disc_type : "";
      const disc = primaryDiscLabel(row);
      const popCell = hideCatalogFields
        ? `<td class="num songs-making-na">${htmlEsc("—")}</td>`
        : `<td class="num">${htmlEsc(String(songPopularityNum(row)))}</td>`;
      const relCellClass = hideCatalogFields ? " songs-making-na" : "";
      const discCell = `<td class="songs-disc-cell">${htmlEsc(disc)}</td>`;
      if (cols === "pair") {
        return `<tr><td>${htmlEsc(title)}</td><td>${htmlEsc(romanji)}</td><td class="num${relCellClass}">${htmlEsc(rel)}</td><td>${htmlEsc(dtype)}</td>${discCell}${popCell}</tr>`;
      }
      return `<tr><td>${htmlEsc(title)}</td><td>${htmlEsc(romanji)}</td><td class="num${relCellClass}">${htmlEsc(rel)}</td><td>${htmlEsc(dtype)}</td>${discCell}<td>${htmlEsc(gname)}</td>${popCell}</tr>`;
    })
    .join("");
}

/** Released rows first; optional second `tbody` for future / undated tracks (desktop Making). */
function renderSongsTrackTableBodies(
  released: Record<string, unknown>[],
  making: Record<string, unknown>[],
  asOfIso: string | null,
  cols: "pair" | "full",
  emptyReleasedMsg: string,
): string {
  const ncol = cols === "pair" ? 6 : 7;
  const refShort = asOfIso ? String(asOfIso).trim().split("T")[0] : "";
  const refPretty =
    refShort && /^\d{4}-\d{2}-\d{2}$/.test(refShort) ? formatLongDate(refShort) : refShort || "—";
  const releasedRows = songRowsHtml(released, cols, "released");
  const makingRows = songRowsHtml(making, cols, "making");
  const showMaking = making.length > 0;
  const tbReleased =
    released.length > 0
      ? releasedRows
      : `<tr><td colspan="${ncol}" class="content-muted">${htmlEsc(emptyReleasedMsg)}</td></tr>`;
  const makingHeader = `<tr class="songs-making-divider"><td colspan="${ncol}" class="songs-making-label"><span class="songs-making-title">${htmlEsc("Songs")}</span><span class="songs-making-sub">${htmlEsc(
    `${making.length.toLocaleString()} track(s) with no release date or scheduled after ${refPretty}`,
  )}</span></td></tr>`;
  const tbMaking = showMaking ? `${makingHeader}${makingRows}` : "";
  return `<tbody class="songs-released-tbody">${tbReleased}</tbody>${showMaking ? `<tbody class="songs-making-tbody">${tbMaking}</tbody>` : ""}`;
}

function renderSongsGroupDropdown(groups: Record<string, unknown>[], selectedUid: string): string {
  const sorted = sortGroupsForDirectory(groups);
  const opts = sorted
    .map((g) => {
      const uid = String((g as { uid?: unknown }).uid ?? "").trim();
      if (!uid) return "";
      const name = String((g as { name?: unknown }).name ?? (g as { name_romanji?: unknown }).name_romanji ?? uid.slice(0, 10));
      const sel = uid === selectedUid ? " selected" : "";
      return `<option value="${encodeURIComponent(uid)}"${sel}>${htmlEsc(name)}</option>`;
    })
    .filter(Boolean)
    .join("");
  return `<div class="songs-toolbar fm-card-inline">
    <label class="songs-toolbar-label"><span class="songs-toolbar-text">${htmlEsc("Group")}</span>
      <select id="songs-group-select" class="fm-select songs-group-select" aria-label="Current group for songs">${opts}</select>
    </label>
  </div>`;
}

/** Making view: managed group only (no picker). */
function renderMakingManagedGroupBar(groups: Record<string, unknown>[], managedUid: string): string {
  const sorted = sortGroupsForDirectory(groups);
  const row = sorted.find((g) => String((g as { uid?: unknown }).uid ?? "").trim() === managedUid);
  const name = row
    ? String((row as { name?: unknown }).name ?? (row as { name_romanji?: unknown }).name_romanji ?? managedUid)
    : managedUid;
  const rj = row ? String((row as { name_romanji?: unknown }).name_romanji ?? "").trim() : "";
  const label = rj && rj !== name ? `${name} (${rj})` : name;
  return `<div class="songs-toolbar fm-card-inline songs-making-managed-bar" role="group" aria-label="${htmlEsc("Managed group (Making)")}">
    <span class="songs-toolbar-label"><span class="songs-toolbar-text">${htmlEsc("Group")}</span>
    <strong class="songs-making-managed-name">${htmlEsc(label)}</strong>
    <span class="content-muted songs-making-managed-note">${htmlEsc("managed")}</span></span>
  </div>`;
}

function renderSongsWorkspaceTabs(active: SongsWorkspaceTab): string {
  const songsAct = active === "group_songs" ? " is-active" : "";
  const discAct = active === "disc" ? " is-active" : "";
  const b1 = `<button type="button" class="songs-workspace-tab${songsAct}" data-songs-workspace-tab="group_songs" role="tab">${htmlEsc("Songs")}</button>`;
  const b2 = `<button type="button" class="songs-workspace-tab${discAct}" data-songs-workspace-tab="disc" role="tab">${htmlEsc("Discography")}</button>`;
  return `<div class="songs-workspace-tabs" role="tablist">${b1}${b2}</div>`;
}

function bucketEarliestRelease(songs: Record<string, unknown>[]): string {
  const dates = songs
    .map((s) => String(s.release_date ?? "").trim())
    .filter((d) => /^\d{4}-\d{2}-\d{2}/.test(d));
  if (!dates.length) return "—";
  dates.sort();
  return dates[0] ?? "—";
}

function bucketRepresentativeDiscType(songs: Record<string, unknown>[]): string {
  const t = songs.map((s) => String(s.disc_type ?? "").trim()).find(Boolean);
  return t || "—";
}

function resolveDiscographyBucketKey(buckets: DiscBucket[], selected: string | null): string {
  if (!buckets.length) return "";
  if (selected && buckets.some((b) => b.key === selected)) return selected;
  return buckets[0]!.key;
}

function renderDiscographyPanel(buckets: DiscBucket[], selectedKey: string | null): string {
  if (!buckets.length) {
    return `<p class="content-muted">${htmlEsc("No releases inferred from song rows for this group yet.")}</p>`;
  }
  const eff = resolveDiscographyBucketKey(buckets, selectedKey);
  const bucket = buckets.find((b) => b.key === eff) ?? buckets[0]!;
  const discRows = buckets
    .map((b) => {
      const sel = b.key === eff ? " is-selected" : "";
      const rel = bucketEarliestRelease(b.songs);
      const typ = bucketRepresentativeDiscType(b.songs);
      return `<tr class="songs-discography-row${sel}" data-songs-discography-key="${encodeURIComponent(b.key)}" tabindex="0" role="button">
        <td>${htmlEsc(b.label)}</td><td class="num">${htmlEsc(rel)}</td><td>${htmlEsc(typ)}</td><td class="num">${b.songs.length.toLocaleString("ja-JP")}</td>
      </tr>`;
    })
    .join("");
  const tracks = songRowsHtml(bucket.songs, "pair");
  const rel0 = bucketEarliestRelease(bucket.songs);
  const typ0 = bucketRepresentativeDiscType(bucket.songs);
  const meta = `<p class="content-muted songs-discography-meta">${htmlEsc(
    `Release: ${rel0} · Type: ${typ0} · ${bucket.songs.length.toLocaleString()} track(s)`,
  )}</p>`;
  return `
    <div class="songs-discography-layout">
      <div class="fm-card songs-discography-list">
        <h3 class="content-h3">${htmlEsc("Discography")}</h3>
        <p class="content-muted">${htmlEsc("Singles and albums from the catalog. Select a release to see tracks.")}</p>
        <div class="table-scroll">
          <table class="fm-table songs-discography-table">
            <thead><tr><th>Title</th><th>Release</th><th>Type</th><th>Tracks</th></tr></thead>
            <tbody>${discRows}</tbody>
          </table>
        </div>
      </div>
      <div class="fm-card songs-discography-tracks">
        <h3 class="content-h3">${htmlEsc(bucket.label)}</h3>
        ${meta}
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Title</th><th>Romanji</th><th>Release</th><th>Type</th><th>Disc</th><th>Pop</th></tr></thead>
            <tbody>${tracks || `<tr><td colspan="6" class="content-muted">—</td></tr>`}</tbody>
          </table>
        </div>
      </div>
    </div>`;
}

interface SongsRenderOpts {
  subtitle?: string;
  groups: Record<string, unknown>[];
  selectedGroupUid: string;
  selectedWorkspaceTab: SongsWorkspaceTab;
  selectedDiscographyKey: string | null;
  /** Game / browse “today” for released vs future / undated (`YYYY-MM-DD`). */
  catalogReferenceIso: string | null;
  /**
   * `songs` = main Songs nav (released-only when catalog splits; in-production list under Making).
   * `making` = main Making nav (workshop table: no release/pop; disc text field; Arrange / Release).
   */
  trackSplitSurface?: "songs" | "making";
  /** When `trackSplitSurface` is `making`, lock catalog to this group (managed production). */
  managedGroupUid?: string | null;
}

/** Songs workspace: group picker, Songs | Discography tabs (desktop `main_ui.py`), tables. */
function renderSongsList(allSongs: Record<string, unknown>[], opts?: SongsRenderOpts): string {
  const surface = opts?.trackSplitSurface ?? "songs";
  const pageTitle = surface === "making" ? "Making" : "Songs";
  const managedUid = opts?.managedGroupUid?.trim() ?? "";

  if (!allSongs.length) return renderPlaceholder(pageTitle, "No songs in <code>songs.json</code>.");
  if (!opts?.groups?.length) {
    return renderPlaceholder(pageTitle, "No groups in snapshot for song directory.");
  }
  if (surface === "making" && !managedUid) {
    return renderPlaceholder(pageTitle, "No managed group on this save.");
  }

  const effectiveGid = surface === "making" && managedUid ? managedUid : String(opts.selectedGroupUid ?? "").trim();
  if (!effectiveGid) {
    return renderPlaceholder(pageTitle, "No groups in snapshot for song directory.");
  }

  const ordered = songsForDisplaySorted(allSongs);
  const gid = effectiveGid;
  const teamSongs = ordered.filter((row) => String(row.group_uid ?? "") === gid);
  const { released: releasedTeam, making: makingTeam } = splitSongsReleasedVsMaking(
    teamSongs,
    opts.catalogReferenceIso,
  );
  const buckets = buildDiscBuckets(teamSongs);
  const ws: SongsWorkspaceTab =
    surface === "making" ? "group_songs" : opts.selectedWorkspaceTab === "disc" ? "disc" : "group_songs";

  const refShort = opts.catalogReferenceIso ? String(opts.catalogReferenceIso).trim().split("T")[0] : "";
  const hasRef = Boolean(refShort && /^\d{4}-\d{2}-\d{2}$/.test(refShort));
  const catalogSplitsFuture = hasRef && makingTeam.length > 0;

  const sub = opts.subtitle ? `<p class="content-muted">${htmlEsc(opts.subtitle)}</p>` : "";
  const toolbar =
    surface === "making" && managedUid
      ? renderMakingManagedGroupBar(opts.groups, managedUid)
      : renderSongsGroupDropdown(opts.groups, gid);

  if (surface === "making") {
    const workshopRows = hasRef ? makingTeam : teamSongs;
    let workshopTbody: string;
    if (!teamSongs.length) {
      workshopTbody = `<tr><td colspan="5" class="content-muted">${htmlEsc("No tracks for this group in snapshot.")}</td></tr>`;
    } else if (hasRef && makingTeam.length === 0) {
      workshopTbody = `<tr><td colspan="5" class="content-muted">${htmlEsc(`No future or undated tracks as of ${refShort} — everything is released in the catalog for this date. Use Songs in the sidebar for the released list.`)}</td></tr>`;
    } else {
      workshopTbody = makingWorkshopRowsHtml(workshopRows);
    }

    const explMaking = `<p class="content-muted">${htmlEsc(
      !teamSongs.length
        ? "No tracks for this group in snapshot."
        : hasRef
          ? makingTeam.length > 0
            ? `${makingTeam.length.toLocaleString()} in-production track(s) (no release date or after ${refShort}) · set Disc per row, then Arrange or Release.`
            : `Reference ${refShort}: no in-production bucket for this group.`
          : `${teamSongs.length.toLocaleString()} track(s) — no reference date on save yet; showing full group list in the workshop layout.`,
    )}</p>`;

    const songsPanel = `
      ${explMaking}
      <div class="table-scroll">
        <table class="fm-table songs-making-workshop-table">
          <thead><tr><th>${htmlEsc("Title")}</th><th>${htmlEsc("Romanji")}</th><th>${htmlEsc("Type")}</th><th>${htmlEsc("Disc")}</th><th>${htmlEsc("Actions")}</th></tr></thead>
          <tbody>${workshopTbody}</tbody>
        </table>
      </div>`;

    return `
    <section class="content-panel songs-view making-track-view">
      <h2 class="content-h2">${htmlEsc(pageTitle)}</h2>
      ${sub}
      ${toolbar}
      ${songsPanel}
    </section>`;
  }

  let mainTrackBodies: string;
  if (!teamSongs.length) {
    mainTrackBodies = `<tbody><tr><td colspan="6" class="content-muted">${htmlEsc("No tracks for this group in snapshot.")}</td></tr></tbody>`;
  } else if (!catalogSplitsFuture) {
    mainTrackBodies = `<tbody>${songRowsHtml(teamSongs, "pair", "released")}</tbody>`;
  } else {
    const inner =
      releasedTeam.length > 0
        ? songRowsHtml(releasedTeam, "pair", "released")
        : `<tr><td colspan="6" class="content-muted">${htmlEsc("No tracks released as of this date — open Making in the sidebar (between Songs and Publish) for in-production tracks.")}</td></tr>`;
    mainTrackBodies = `<tbody>${inner}</tbody>`;
  }

  const workspaceTabs = renderSongsWorkspaceTabs(ws);

  const explSongs = `<p class="content-muted">${htmlEsc(
    !teamSongs.length
      ? "No tracks for this group in snapshot."
      : catalogSplitsFuture
        ? `${releasedTeam.length.toLocaleString()} released (as of ${refShort}). ${makingTeam.length.toLocaleString()} in production — open Making in the sidebar (between Songs and Publish).`
        : hasRef
          ? `${releasedTeam.length.toLocaleString()} released (as of ${refShort}) — no in-production entries.`
          : `${teamSongs.length.toLocaleString()} track(s) · popularity high → low (set a reference date to split catalog by release date).`,
  )}</p>`;
  const explDisc = `<p class="content-muted">${htmlEsc(
    `${buckets.length.toLocaleString()} release bucket(s) · derived from song rows.`,
  )}</p>`;

  const budget = SONG_EXPAND_ALL_LIMIT;
  const expReleased = releasedTeam.slice(0, budget);
  const expMaking = makingTeam.slice(0, Math.max(0, budget - expReleased.length));
  const expBodies =
    teamSongs.length === 0
      ? `<tbody><tr><td colspan="7" class="content-muted">—</td></tr></tbody>`
      : renderSongsTrackTableBodies(
          expReleased,
          expMaking,
          opts.catalogReferenceIso,
          "full",
          "No released rows in this preview window.",
        );
  const truncated =
    releasedTeam.length > expReleased.length || makingTeam.length > expMaking.length
      ? `<p class="content-muted">${htmlEsc(
          `Preview capped at ${SONG_EXPAND_ALL_LIMIT} rows (released first, then Songs / future). Full group has ${teamSongs.length.toLocaleString()} track(s).`,
        )}</p>`
      : "";

  const songsPanel = `
      ${explSongs}
      <div class="table-scroll">
        <table class="fm-table songs-main-table">
          <thead><tr><th>Title</th><th>Romanji</th><th>Release</th><th>Type</th><th>Disc</th><th>Pop</th></tr></thead>
          ${mainTrackBodies}
        </table>
      </div>
      <details class="fm-card songs-expand">
        <summary class="content-h3 songs-expand-sum">This group — all tracks (${teamSongs.length.toLocaleString()})</summary>
        ${truncated}
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Title</th><th>Romanji</th><th>Release</th><th>Type</th><th>Disc</th><th>Group</th><th>Pop</th></tr></thead>
            ${expBodies}
          </table>
        </div>
      </details>`;

  const discPanel = `${explDisc}${renderDiscographyPanel(buckets, opts.selectedDiscographyKey)}`;

  const body = ws === "disc" ? discPanel : songsPanel;

  return `
    <section class="content-panel songs-view">
      <h2 class="content-h2">${htmlEsc(pageTitle)}</h2>
      ${sub}
      ${toolbar}
      ${workspaceTabs}
      ${body}
    </section>`;
}

function groupFansNum(g: Record<string, unknown>): number {
  return typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
}

function groupPopNum(g: Record<string, unknown>): number {
  return typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
}

/** All groups sorted S→F, then descending fans (browse + management directory). */
function renderGroupsFullTable(
  groups: Record<string, unknown>[],
  subtitle: string,
  highlightUid?: string | null,
  songs?: Record<string, unknown>[] | null,
): string {
  if (!groups.length) return renderPlaceholder("Groups", "No groups in database snapshot.");

  const songCount = buildSongCountByGroupUid(songs ?? undefined);
  const sorted = sortGroupsForDirectory(groups);
  const rows = sorted
    .map((g) => {
      const name = String(g.name ?? g.name_romanji ?? "—");
      const formed = typeof g.formed_date === "string" ? g.formed_date : "—";
      const tier = resolveGroupLetterTier(g);
      const fans = groupFansNum(g);
      const pop = groupPopNum(g);
      const uid = String(g.uid ?? "");
      const memNow =
        typeof g.member_count === "number" && Number.isFinite(g.member_count)
          ? g.member_count
          : Array.isArray(g.member_uids)
            ? g.member_uids.length
            : 0;
      const past =
        typeof g.past_member_count === "number" && Number.isFinite(g.past_member_count)
          ? g.past_member_count
          : Array.isArray(g.past_member_uids)
            ? g.past_member_uids.length
            : 0;
      const memPast = `${memNow} (${past})`;
      const songN = uid ? songCount.get(uid) ?? 0 : 0;
      const rowClass = [
        "group-dir-row",
        highlightUid && uid === highlightUid ? "is-managed-row" : "",
        uid ? "" : "group-dir-row-nolink",
      ]
        .filter(Boolean)
        .join(" ");
      const rowAttr = uid ? ` data-group-detail="${htmlEsc(uid)}"` : "";
      return `<tr class="${htmlEsc(rowClass)}"${rowAttr}><td>${htmlEsc(name)}</td><td class="num">${htmlEsc(memPast)}</td><td class="num">${songN.toLocaleString("ja-JP")}</td><td class="num">${fans.toLocaleString("ja-JP")}</td><td class="num">${pop}</td><td>${htmlEsc(tier)}</td><td>${htmlEsc(formed)}</td></tr>`;
    })
    .join("");

  return `
    <section class="content-panel groups-view">
      <h2 class="content-h2">Groups</h2>
      <p class="content-muted">${htmlEsc(subtitle)}</p>
      <div class="table-scroll">
        <table class="fm-table groups-sort-table">
          <thead><tr><th>Group</th><th>Members (past)</th><th>Songs</th><th>Fans</th><th>Popularity</th><th>Tier</th><th>Formed</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <p class="content-muted">${htmlEsc("Songs = per-track rows from data/songs.json (filtered to scenario groups), by group_uid; display excludes hidden titles and sorts by popularity. Tier inferred when letter_tier missing.")}</p>
    </section>`;
}

function renderGroupsManaged(save: GameSavePayload): string {
  const uid = save.managing_group_uid;
  const grp = getPrimaryGroup(save);
  const label =
    typeof grp?.name_romanji === "string"
      ? grp.name_romanji
      : typeof grp?.name === "string"
        ? grp.name
        : uid?.slice(0, 12) ?? "—";
  return renderGroupsFullTable(
    save.database_snapshot.groups,
    `Letter tier order (best first), then fans (high→low). Managed: ${label}. Highlighted row = your roster.`,
    uid,
    save.database_snapshot.songs,
  );
}

/** Browse roster: all groups snapshot, tier then fans descending. */
function renderBrowseGroups(data: LoadedScenario): string {
  return renderGroupsFullTable(
    data.groups,
    `Browse · scenario ${data.preset?.name ?? "?"}. Sorted best letter tier first, then descending fans.`,
    null,
    data.songs,
  );
}

function renderSchedule(save: GameSavePayload | null, scheduleCalendarMonthStart: string | null): string {
  if (!save) {
    return `<section class="content-panel schedule-view"><p class="content-muted">No save loaded.</p></section>`;
  }
  const gameStart = save.game_start_date ?? save.scenario_context?.startup_date ?? "2020-01-01";
  const cur = save.current_date ?? gameStart;
  const turn = typeof save.turn_number === "number" ? save.turn_number : 0;
  const nextIso = addCalendarDays(cur, 1);

  const schedulesList = (save.lives?.schedules ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  const resultsList = (save.lives?.results ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  const gs = typeof gameStart === "string" && /^\d{4}-\d{2}-\d{2}$/.test(gameStart) ? gameStart : "2020-01-01";
  const anchor = scheduleCalendarMonthStart ?? startOfUtcMonthIso(nextIso);
  const calHtml = buildScheduleMonthCalendarHtml(anchor, {
    gameStart: gs,
    cur: String(cur).split("T")[0],
    nextIso,
    schedules: schedulesList,
    results: resultsList,
  });

  const weekDays = 7;
  const cells: string[] = [];
  for (let i = 0; i < weekDays; i++) {
    const iso = addCalendarDays(nextIso, i);
    const dow = new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
    const offset = calendarDaysBetween(typeof gameStart === "string" ? gameStart : "2020-01-01", iso);
    const autopilotLive = offset >= 0 && offset % 7 === AUTOPILOT_LIVE_WEEKDAY_INDEX;
    const isTodayish = iso === nextIso;
    const schedules = save.lives?.schedules;
    const extra = Array.isArray(schedules)
      ? schedules.filter((s) => {
          if (!s || typeof s !== "object") return false;
          const sd = String((s as { start_date?: unknown }).start_date ?? "").split("T")[0];
          return sd === iso;
        })
      : [];
    const extraLbl =
      extra.length > 0
        ? extra
            .map((s) => {
              const o = s as Record<string, unknown>;
              const typ = String(o.live_type ?? o.event_type ?? "Event");
              const vn = String(o.venue ?? "").trim();
              return vn ? `${typ} @ ${vn}` : typ;
            })
            .join(", ")
        : "";

    cells.push(`<div class="schedule-cell ${isTodayish ? "is-next" : ""}${autopilotLive ? " has-live" : ""}">
      <div class="schedule-cell-dow">${htmlEsc(dow)}</div>
      <div class="schedule-cell-date">${htmlEsc(iso)}</div>
      <div class="schedule-cell-body">
        ${autopilotLive ? `<span class="schedule-pill schedule-pill-live">${htmlEsc("Routine live (autopilot)")}</span>` : `<span class="schedule-pill">${htmlEsc("—")}</span>`}
        ${extraLbl ? `<div class="schedule-extra">${htmlEsc(extraLbl)}</div>` : ""}
      </div>
    </div>`);
  }

  const recentResults = [...(save.lives?.results ?? [])].slice(-5).reverse();
  const resRows = recentResults
    .map((raw) => {
      if (!raw || typeof raw !== "object") return "";
      const r = raw as Record<string, unknown>;
      const d = String(r.date ?? "").split("T")[0];
      const perf = r.performance_score != null ? String(r.performance_score) : "—";
      const aud = r.audience_satisfaction != null ? String(r.audience_satisfaction) : "—";
      const fans = r.fan_gain != null ? String(r.fan_gain) : "—";
      const att = r.attendance != null ? String(r.attendance) : "—";
      return `<tr><td>${htmlEsc(d)}</td><td class="num">${htmlEsc(perf)}</td><td class="num">${htmlEsc(aud)}</td><td class="num">${htmlEsc(fans)}</td><td class="num">${htmlEsc(att)}</td></tr>`;
    })
    .filter(Boolean)
    .join("");

  return `
    <section class="content-panel schedule-view">
      <h2 class="content-h2">Schedule</h2>
      <p class="content-lead">Last closed day: <strong>${htmlEsc(String(cur))}</strong> · Next simulation day: <strong>${htmlEsc(nextIso)}</strong> · Turn <strong>${htmlEsc(String(turn))}</strong></p>
      <section class="fm-card schedule-calendar-card">
        <h3 class="content-h3">Calendar</h3>
        <p class="content-muted">${htmlEsc("UTC month grid. Use arrows to change month; This month jumps to the month of your next simulation day.")}</p>
        ${calHtml}
      </section>
      <section class="fm-card schedule-teaser">
        <h3 class="content-h3">Upcoming week (from next day)</h3>
        <p class="content-muted">Routine lives run when the day offset from <code>game_start_date</code> satisfies <code>offset % 7 === ${AUTOPILOT_LIVE_WEEKDAY_INDEX}</code> (same rule as <code>advanceOneDay</code> in the web engine). Use <strong>NEXT DAY</strong> in the top bar to progress.</p>
        <div class="schedule-week">${cells.join("")}</div>
      </section>
      <section class="fm-card">
        <h3 class="content-h3">Recent live results</h3>
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Date</th><th>Performance</th><th>Audience</th><th>Fan Δ</th><th>Attendance</th></tr></thead>
            <tbody>${resRows || `<tr><td colspan="5" class="content-muted">No results yet.</td></tr>`}</tbody>
          </table>
        </div>
      </section>
    </section>`;
}

function renderLivesView(save: GameSavePayload): string {
  const schedules = (save.lives?.schedules ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );
  const results = (save.lives?.results ?? []).filter(
    (x): x is Record<string, unknown> => Boolean(x && typeof x === "object"),
  );

  const byDate = (a: Record<string, unknown>, b: Record<string, unknown>) => {
    const da = String(a.start_date ?? a.date ?? "").split("T")[0];
    const db = String(b.start_date ?? b.date ?? "").split("T")[0];
    return da.localeCompare(db);
  };
  const upcoming = [...schedules].sort(byDate);

  const upcomingRows = upcoming
    .map((live) => {
      const d = String(live.start_date ?? "").split("T")[0];
      const title = String(live.title ?? live.live_type ?? "—");
      const venue = String(live.venue ?? "—");
      const loc = String(live.location ?? "").trim();
      const cap = live.capacity != null ? String(live.capacity) : "—";
      const slot = formatLiveSlotLine(live);
      const typ = String(live.live_type ?? live.event_type ?? "");
      const where = loc ? `${venue} · ${loc}` : venue;
      return `<tr><td>${htmlEsc(d)}</td><td>${htmlEsc(slot)}</td><td>${htmlEsc(title)}</td><td>${htmlEsc(typ)}</td><td>${htmlEsc(where)}</td><td class="num">${htmlEsc(cap)}</td></tr>`;
    })
    .join("");

  const recent = [...results].sort(byDate).reverse().slice(0, 30);
  const resultRows = recent
    .map((live) => {
      const d = String(live.date ?? live.start_date ?? "").split("T")[0];
      const venue = String(live.venue ?? "—");
      const perf = live.performance_score != null ? String(live.performance_score) : "—";
      const title = String(live.title ?? live.live_type ?? "—");
      return `<tr><td>${htmlEsc(d)}</td><td>${htmlEsc(title)}</td><td>${htmlEsc(venue)}</td><td class="num">${htmlEsc(perf)}</td></tr>`;
    })
    .join("");

  const grp = getPrimaryGroup(save);
  const label = String(grp?.name_romanji ?? grp?.name ?? save.managing_group ?? "Managed group");

  return `<section class="content-panel lives-view">
    <h2 class="content-h2">Lives</h2>
    <p class="content-muted">${htmlEsc(
      `Managed group: ${label}. Venues match desktop booking: closest hall capacity to a fan-scale target, from the same venues.json bundled with the web build.`,
    )}</p>
    <section class="fm-card">
      <h3 class="content-h3">Scheduled</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>Date</th><th>Slot</th><th>Title</th><th>Type</th><th>Venue</th><th>Cap.</th></tr></thead>
          <tbody>${upcomingRows || `<tr><td colspan="6" class="content-muted">No scheduled lives in save.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
    <section class="fm-card">
      <h3 class="content-h3">Recent results (last 30)</h3>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>Date</th><th>Title</th><th>Venue</th><th>Perf.</th></tr></thead>
          <tbody>${resultRows || `<tr><td colspan="4" class="content-muted">No played lives yet.</td></tr>`}</tbody>
        </table>
      </div>
    </section>
  </section>`;
}

export function renderMainContent(
  ctx: {
    browseMode: boolean;
    browseData: LoadedScenario | null;
    save: GameSavePayload | null;
    view: DesktopNavId;
    idolDetailUid: string | null;
    groupDetailUid: string | null;
    idolListLayout: "cards" | "list";
    songsGroupUid: string | null;
    songsWorkspaceTab: SongsWorkspaceTab;
    songsDiscographyKey: string | null;
    inboxSelectedUid: string | null;
    /** `YYYY-MM-01` for Schedule month calendar; null = month of next simulation day. */
    scheduleCalendarMonthStart: string | null;
  },
): string {
  const {
    browseMode,
    browseData,
    save,
    view,
    idolDetailUid,
    groupDetailUid,
    idolListLayout,
    songsGroupUid,
    songsWorkspaceTab,
    songsDiscographyKey,
    inboxSelectedUid,
    scheduleCalendarMonthStart,
  } = ctx;

  if (browseMode && browseData) {
    const refIso = displayReferenceIso(null, browseData.preset?.opening_date);
    switch (view) {
      case "Idols": {
        const uidStr = idolDetailUid?.trim() ?? "";
        if (uidStr) {
          const row = browseData.idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uidStr);
          if (row) return renderIdolDetailPage(row, browseData.groups, refIso);
          return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(`Idol '${uidStr}' not in snapshot.`)}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-idol-detail-back">${htmlEsc("← Idol list")}</button>
            </section>`;
        }
        return renderIdolsList(
          browseData.idols,
          refIso,
          "Idols (browse)",
          idolListLayout,
          `${browseData.idols.length.toLocaleString()} rows in snapshot · default attributes when missing in JSON.`,
        );
      }
      case "Groups": {
        const gUid = groupDetailUid?.trim() ?? "";
        if (gUid) {
          const grow = browseData.groups.find((r) => String((r as { uid?: unknown }).uid ?? "") === gUid);
          if (grow)
            return renderGroupDetailPage(
              grow,
              browseData.preset?.name ? `Browse · ${browseData.preset.name}` : "Browse",
              {
                idols: browseData.idols,
                songs: browseData.songs,
                groups: browseData.groups,
                lives: browseData.lives ?? null,
                referenceIso: browseData.preset.opening_date ?? null,
              },
            );
          return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(`Group '${gUid}' not in snapshot.`)}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc("← Groups")}</button>
            </section>`;
        }
        return renderBrowseGroups(browseData);
      }
      case "Songs":
        return renderSongsList(browseData.songs, {
          subtitle: browseData.preset?.name ?? undefined,
          groups: browseData.groups,
          selectedGroupUid: songsGroupUid ?? "",
          selectedWorkspaceTab: songsWorkspaceTab,
          selectedDiscographyKey: songsDiscographyKey,
          catalogReferenceIso: browseData.preset?.opening_date ?? null,
          trackSplitSurface: "songs",
        });
      default:
        return renderPlaceholder(String(view));
    }
  }

  if (!save) return renderPlaceholder("", "No save loaded.");

  switch (view) {
    case "Inbox":
      return renderInbox(save, inboxSelectedUid);
    case "Finances":
      return renderFinances(save);
    case "Idols": {
      const refIso = displayReferenceIso(save, browseData?.preset?.opening_date);
      const uidStr = idolDetailUid?.trim() ?? "";
      if (uidStr) {
        const row = save.database_snapshot.idols.find((r) => String((r as { uid?: unknown }).uid ?? "") === uidStr);
        if (row) return renderIdolDetailPage(row, save.database_snapshot.groups, refIso);
        return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(`Idol '${uidStr}' not in save snapshot.`)}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-idol-detail-back">${htmlEsc("← Idol list")}</button>
            </section>`;
      }
      return renderIdolsList(
        save.database_snapshot.idols,
        refIso,
        "Idols",
        idolListLayout,
        "Attributes from save (defaults applied where missing).",
      );
    }
    case "Groups": {
      const gUid = groupDetailUid?.trim() ?? "";
      if (gUid) {
        const grow = save.database_snapshot.groups.find((r) => String((r as { uid?: unknown }).uid ?? "") === gUid);
        if (grow) return renderGroupDetailPage(grow, "Management roster", {
          idols: save.database_snapshot.idols,
          songs: save.database_snapshot.songs,
          groups: save.database_snapshot.groups,
          lives: browseData?.lives ?? null,
          referenceIso:
            save.current_date ??
            save.game_start_date ??
            save.scenario_context?.startup_date ??
            browseData?.preset.opening_date ??
            null,
        });
        return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(`Group '${gUid}' not in save snapshot.`)}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc("← Groups")}</button>
            </section>`;
      }
      return renderGroupsManaged(save);
    }
    case "Schedule":
      return renderSchedule(save, scheduleCalendarMonthStart);
    case "Lives":
      return renderLivesView(save);
    case "Training":
      return renderTraining(save);
    case "Making":
      return renderSongsList(save.database_snapshot.songs, {
        subtitle: save.scenario_context?.startup_date
          ? `Opening ${save.scenario_context.startup_date}`
          : undefined,
        groups: save.database_snapshot.groups,
        selectedGroupUid: songsGroupUid ?? "",
        selectedWorkspaceTab: "group_songs",
        selectedDiscographyKey: null,
        catalogReferenceIso:
          save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null,
        trackSplitSurface: "making",
        managedGroupUid: save.managing_group_uid ?? null,
      });
    case "Songs":
      return renderSongsList(save.database_snapshot.songs, {
        subtitle: save.scenario_context?.startup_date
          ? `Opening ${save.scenario_context.startup_date}`
          : undefined,
        groups: save.database_snapshot.groups,
        selectedGroupUid: songsGroupUid ?? "",
        selectedWorkspaceTab: songsWorkspaceTab,
        selectedDiscographyKey: songsDiscographyKey,
        catalogReferenceIso:
          save.current_date ?? save.game_start_date ?? save.scenario_context?.startup_date ?? null,
        trackSplitSurface: "songs",
      });
    default:
      return renderPlaceholder(view);
  }
}

export interface DesktopShellProps {
  browseMode: boolean;
  browseData: LoadedScenario | null;
  save: GameSavePayload | null;
  preview: WebPreviewBundle | null;
  currentView: DesktopNavId;
  /** When set and view is Idols, show profile instead of list. */
  idolDetailUid?: string | null;
  /** When set and view is Groups, show group profile instead of directory. */
  groupDetailUid?: string | null;
  /** Idols directory layout (cards vs table). */
  idolListLayout: "cards" | "list";
  /** Songs screen: selected group UID (snapshot). */
  songsGroupUid: string | null;
  /** Songs screen: `group_songs` (track list) or `disc` (discography), like desktop `main_ui.py`. */
  songsWorkspaceTab: SongsWorkspaceTab;
  /** Songs Discography tab: selected release bucket key. */
  songsDiscographyKey: string | null;
  /** Selected inbox notification uid (management mode). */
  inboxSelectedUid: string | null;
  /** Selected month for Schedule calendar (`YYYY-MM-01`); null follows next simulation day. */
  scheduleCalendarMonthStart: string | null;
  slot: number;
  occupiedSlots: number[];
}

export function renderDesktopShell(p: DesktopShellProps): string {
  const {
    browseMode,
    browseData,
    save,
    preview,
    currentView,
    idolDetailUid,
    groupDetailUid,
    idolListLayout,
    songsGroupUid,
    songsWorkspaceTab,
    songsDiscographyKey,
    inboxSelectedUid,
    scheduleCalendarMonthStart,
    slot,
    occupiedSlots,
  } = p;
  const finances = save ? getActiveFinances(save) : null;
  const grp = save ? getPrimaryGroup(save) : null;
  const displayName =
    grp && typeof grp.name === "string" ? grp.name : browseData?.preset?.name ?? preview?.group?.name ?? "—";
  const titleClickable = htmlEsc(displayName);
  const dateStr =
    save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? browseData?.preset.opening_date ?? "";
  const dateLabel = formatLongDate(dateStr || undefined);

  const navSource = browseMode ? BROWSE_NAV_ITEMS : MANAGEMENT_NAV_ITEMS;
  const navButtons = navSource
    .map((item) => {
      const active = item === currentView ? 'aria-current="page"' : "";
      const cls = item === currentView ? "nav-item is-active" : "nav-item";
      return `<li role="none"><button type="button" class="${cls}" data-nav="${htmlEsc(item)}" ${active}>${htmlEsc(item)}</button></li>`;
    })
    .join("");

  const shortlistItems = save
    ? (() => {
        const shortlist = shortlistRows(save);
        return shortlist.length
          ? shortlist.map((s) => `<li class="shortlist-entry">${htmlEsc(s.label)}</li>`).join("")
          : `<li class="shortlist-empty" role="note">No shortlisted idols yet.</li>`;
      })()
    : `<li class="shortlist-empty" role="note">Browse mode — shortlist N/A</li>`;

  const slotOpts = Array.from({ length: 10 }, (_, s) => {
    const occ = occupiedSlots.includes(s) ? " · saved" : "";
    return `<option value="${s}" ${s === slot ? "selected" : ""}>Slot ${s}${occ}</option>`;
  }).join("");

  const mainInner = renderMainContent({
    browseMode,
    browseData,
    save,
    view: currentView,
    idolDetailUid: idolDetailUid ?? null,
    groupDetailUid: groupDetailUid ?? null,
    idolListLayout,
    songsGroupUid: songsGroupUid ?? null,
    songsWorkspaceTab,
    songsDiscographyKey,
    inboxSelectedUid: inboxSelectedUid ?? null,
    scheduleCalendarMonthStart: scheduleCalendarMonthStart ?? null,
  });

  const cashPill = finances
    ? `<div class="fm-cash-pill" title="Cash on hand"><span class="fm-cash-label">¥</span>${finances.cash_yen.toLocaleString("ja-JP")}</div>`
    : `<div class="fm-cash-pill content-muted" title="Browse">Browse</div>`;

  const inboxBlock = save && !browseMode ? getBlockingNotificationForSave(save) : null;
  const nextHint = inboxBlock ? `Inbox: ${inboxBlock.title}` : "Advance one simulated day";

  const nextDayBtn = browseMode
    ? `<button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" disabled title="Not in browse mode">${htmlEsc("NEXT DAY")}</button>`
    : `<button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" title="${htmlEsc(nextHint)}">${htmlEsc("NEXT DAY")}</button>`;

  const ver = save ? String(save.version ?? "—") : browseData ? "browse" : "—";

  return `
<div class="fm-app">
  <header class="fm-top-bar" role="banner">
    <div class="fm-top-bar-left">
      <details class="fm-home-dropdown">
        <summary class="fm-btn fm-btn-accent">Home</summary>
        <div class="fm-home-menu" role="menu">
          <button type="button" class="fm-menu-action" id="btn-main-menu">Main menu</button>
          <label class="fm-menu-row">Slot <select id="slot-select" class="fm-select" aria-label="Save slot">${slotOpts}</select></label>
          <button type="button" class="fm-menu-action" id="btn-save" ${browseMode ? "disabled" : ""}>Save game</button>
          <button type="button" class="fm-menu-action" id="btn-load">Load game</button>
          <button type="button" class="fm-menu-action" id="btn-new">New game</button>
          <button type="button" class="fm-menu-action danger" id="btn-clear">Clear slot</button>
        </div>
      </details>
      <button type="button" class="fm-btn fm-btn-history" disabled title="Back" aria-label="Back" data-history="back">&lsaquo;</button>
      <button type="button" class="fm-btn fm-btn-history" disabled title="Forward" aria-label="Forward" data-history="fwd">&rsaquo;</button>
      <h1 class="fm-game-title"><span class="fm-game-title-main">IDOL PRODUCER</span><span class="fm-game-title-sub" title="Managed group">${browseMode ? htmlEsc("Browse database") : titleClickable}</span></h1>
    </div>
    <div class="fm-top-bar-center">
      <button type="button" class="fm-date-btn" id="btn-goto-schedule" data-nav="Schedule" title="Open Schedule" ${browseMode ? "" : ""}>${htmlEsc(dateLabel)}</button>
    </div>
    <div class="fm-top-bar-right">
      ${nextDayBtn}
      ${cashPill}
    </div>
  </header>

  <div class="fm-body">
    <aside class="fm-sidebar" aria-label="Main navigation">
      <nav class="fm-side-nav" aria-label="Sections">
        <ul class="fm-side-nav-list" role="list">${navButtons}</ul>
      </nav>
      <section class="fm-shortlist" aria-labelledby="shortlist-heading">
        <h2 id="shortlist-heading" class="fm-shortlist-label">Shortlist</h2>
        <ul class="fm-shortlist-ul" role="list">${shortlistItems}</ul>
      </section>
    </aside>

    <main class="fm-content" id="main-content" role="main" aria-label="${htmlEsc(currentView)}">
      <div class="fm-content-inner">
        ${mainInner}
      </div>
    </main>
  </div>

  <footer class="fm-status-bar" role="contentinfo">
    <span class="fm-status-item">${browseMode ? "Browse" : `Save v${save?.version ?? "?"}`}</span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">View: <strong>${htmlEsc(currentView)}</strong></span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">Turn: <strong>${save?.turn_number ?? 0}</strong></span>
    <span class="fm-status-sep">·</span>
    <span class="fm-status-item">${htmlEsc(typeof ver === "string" ? ver : String(ver))}</span>
  </footer>
</div>`;
}
