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
import { resolveGroupLetterTier, sortGroupsForDirectory } from "../engine/financeSystem";
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
const SONG_BROWSE_PRIMARY_LIMIT = 400;
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
    const g = String((s as { group_uid?: unknown }).group_uid ?? "").trim();
    if (!g) continue;
    m.set(g, (m.get(g) ?? 0) + 1);
  }
  return m;
}

function songReleaseTime(row: Record<string, unknown>): number {
  const d = row.release_date;
  if (typeof d === "string" && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return new Date(`${d}T12:00:00Z`).getTime();
  }
  return 0;
}

function sortSongsReleaseDesc(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...rows].sort((a, b) => songReleaseTime(b) - songReleaseTime(a));
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

function renderGroupDetailPage(g: Record<string, unknown>, contextLabel: string): string {
  const name = String(g.name ?? g.name_romanji ?? "—");
  const romanji = String(g.name_romanji ?? "");
  const tier = resolveGroupLetterTier(g);
  const fans = groupFansNum(g);
  const pop = groupPopNum(g);
  const formed = typeof g.formed_date === "string" ? g.formed_date : "—";
  const mc = Array.isArray(g.member_uids) ? g.member_uids.length : 0;
  const wikiUrl =
    typeof g.wiki_url === "string" && g.wiki_url.trim().startsWith("http") ? g.wiki_url.trim() : "";
  const wikiBlock = wikiUrl
    ? `<p class="content-muted"><a href="${attrQuotedUrl(wikiUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc("Wiki")}</a></p>`
    : "";
  const rawDesc = typeof g.description === "string" ? g.description.trim() : "";
  const desc =
    rawDesc.length > 0
      ? `<p class="group-detail-desc">${htmlEsc(rawDesc.slice(0, 480))}${rawDesc.length > 480 ? "…" : ""}</p>`
      : "";

  return `
<section class="content-panel group-detail-view" aria-label="${htmlEsc(name)}">
  <header class="idol-detail-toolbar">
    <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc("← Groups")}</button>
    <span class="content-muted idol-detail-ref">${htmlEsc(contextLabel)}</span>
  </header>
  <div class="fm-card group-detail-head">
    <h2 class="content-h2">${htmlEsc(name)}</h2>
    ${romanji ? `<p class="content-muted">${htmlEsc(romanji)}</p>` : ""}
    <dl class="basic-dl group-detail-dl">
      <div><dt>${htmlEsc("Tier")}</dt><dd>${htmlEsc(tier)}</dd></div>
      <div><dt>${htmlEsc("Fans")}</dt><dd>${fans.toLocaleString("ja-JP")}</dd></div>
      <div><dt>${htmlEsc("Popularity")}</dt><dd>${String(pop)}</dd></div>
      <div><dt>${htmlEsc("Members")}</dt><dd>${mc}</dd></div>
      <div><dt>${htmlEsc("Formed")}</dt><dd>${htmlEsc(formed)}</dd></div>
    </dl>
    ${wikiBlock}
    ${desc}
  </div>
</section>`;
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

function renderInbox(save: GameSavePayload): string {
  const rows = [...save.inbox.notifications].reverse();
  if (!rows.length) {
    return `<section class="content-panel"><p class="content-muted">No messages in inbox.</p></section>`;
  }
  const cards = rows
    .map((n) => {
      const unread = !n.read ? `<span class="badge-unread" aria-hidden="true">●</span> ` : "";
      const snippet = htmlEsc(n.body.length > 420 ? `${n.body.slice(0, 420)}…` : n.body);
      return `
      <article class="fm-card inbox-card ${n.read ? "is-read" : "is-unread"}" role="article">
        <header class="fm-card-head">
          ${unread}<span class="inbox-title">${htmlEsc(n.title)}</span>
          <time class="inbox-meta" datetime="${htmlEsc(n.date)}">${htmlEsc(n.date)} · ${htmlEsc(n.sender)}</time>
        </header>
        <div class="inbox-body">${snippet.replaceAll("\n", "<br />")}</div>
      </article>`;
    })
    .join("");
  return `<section class="content-panel inbox-view"><h2 class="content-h2">Inbox</h2><div class="card-stack">${cards}</div></section>`;
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

function songRowsHtml(rows: Record<string, unknown>[], cols: "pair" | "full"): string {
  return rows
    .map((row) => {
      const title = typeof row.title === "string" ? row.title : String(row.uid ?? "—");
      const romanji = typeof row.title_romanji === "string" ? row.title_romanji : "";
      const rel = typeof row.release_date === "string" ? row.release_date : "—";
      const gname = typeof row.group_name === "string" ? row.group_name : "";
      const dtype = typeof row.disc_type === "string" ? row.disc_type : "";
      if (cols === "pair") {
        return `<tr><td>${htmlEsc(title)}</td><td>${htmlEsc(romanji)}</td><td>${htmlEsc(rel)}</td><td>${htmlEsc(dtype)}</td></tr>`;
      }
      return `<tr><td>${htmlEsc(title)}</td><td>${htmlEsc(romanji)}</td><td>${htmlEsc(rel)}</td><td>${htmlEsc(dtype)}</td><td>${htmlEsc(gname)}</td></tr>`;
    })
    .join("");
}

interface SongsRenderOpts {
  subtitle?: string;
  managedGroupUid?: string | null;
  managedGroupLabel?: string;
}

/** Management: default tracks for `group_uid` only; expandable full catalog capped. Browse: chronological slice of all songs capped. */
function renderSongsList(allSongs: Record<string, unknown>[], opts?: SongsRenderOpts): string {
  if (!allSongs.length) return renderPlaceholder("Songs", "No songs in <code>songs.json</code>.");

  const chronological = sortSongsReleaseDesc(allSongs);

  const managedUid =
    opts?.managedGroupUid && String(opts.managedGroupUid).trim() ? String(opts.managedGroupUid).trim() : null;
  const sub = opts?.subtitle ? `<p class="content-muted">${htmlEsc(opts.subtitle)}</p>` : "";

  if (managedUid) {
    const teamSongs = chronological.filter((row) => String(row.group_uid ?? "") === managedUid);
    const teamRows = songRowsHtml(teamSongs, "pair");
    const label = opts?.managedGroupLabel?.trim()
      ? opts.managedGroupLabel.trim()
      : `managed group (${managedUid.slice(0, 8)}…)`;
    const expl = `<p class="content-muted">${htmlEsc(
      `Showing ${teamSongs.length.toLocaleString()} release row(s) for ${label} by \`group_uid\`.`,
    )}</p>`;

    const expSlice = chronological.slice(0, SONG_EXPAND_ALL_LIMIT);
    const expRows = songRowsHtml(expSlice, "full");
    const truncated =
      chronological.length > SONG_EXPAND_ALL_LIMIT
        ? `<p class="content-muted">${htmlEsc(
            `Catalog preview limited to ${SONG_EXPAND_ALL_LIMIT} newest rows (of ${chronological.length.toLocaleString()}).`,
          )}</p>`
        : "";

    return `
    <section class="content-panel songs-view">
      <h2 class="content-h2">Songs</h2>
      ${sub}
      ${expl}
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>Title</th><th>Romanji</th><th>Release</th><th>Type</th></tr></thead>
          <tbody>${teamRows || `<tr><td colspan="4" class="content-muted">No rows with this group UID in snapshot.</td></tr>`}</tbody>
        </table>
      </div>
      <details class="fm-card songs-expand">
        <summary class="content-h3 songs-expand-sum">Full song catalog (${chronological.length.toLocaleString()})</summary>
        ${truncated}
        <div class="table-scroll">
          <table class="fm-table">
            <thead><tr><th>Title</th><th>Romanji</th><th>Release</th><th>Type</th><th>Group</th></tr></thead>
            <tbody>${expRows || `<tr><td colspan="5" class="content-muted">—</td></tr>`}</tbody>
          </table>
        </div>
      </details>
    </section>`;
  }

  const slice = chronological.slice(0, SONG_BROWSE_PRIMARY_LIMIT);
  const browseRows = songRowsHtml(slice, "full");
  const more =
    chronological.length > SONG_BROWSE_PRIMARY_LIMIT
      ? `<p class="content-muted">${htmlEsc(
          `Showing ${SONG_BROWSE_PRIMARY_LIMIT} newest of ${chronological.length.toLocaleString()} rows.`,
        )}</p>`
      : "";

  return `
    <section class="content-panel songs-view">
      <h2 class="content-h2">Songs</h2>
      ${sub}
      <p class="content-muted">${htmlEsc(`Sorted newest release first · ${slice.length.toLocaleString()} rows shown.`)}</p>
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>Title</th><th>Romanji</th><th>Release</th><th>Type</th><th>Group</th></tr></thead>
          <tbody>${browseRows}</tbody>
        </table>
      </div>
      ${more}
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
      <p class="content-muted">${htmlEsc("Songs = rows in snapshot songs.json with matching group_uid. Tier inferred when letter_tier missing.")}</p>
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

function renderSchedule(save: GameSavePayload | null): string {
  const d =
    save?.current_date ?? save?.game_start_date ?? save?.scenario_context?.startup_date ?? "—";
  return `
    <section class="content-panel schedule-view">
      <h2 class="content-h2">Schedule</h2>
      <p class="content-lead">Calendar date cursor: <strong>${htmlEsc(String(d))}</strong>.</p>
      <section class="fm-card schedule-teaser">
        <h3 class="content-h3">Time model</h3>
        <p class="content-muted">Progress with <strong>NEXT DAY</strong> in the top bar. Each day runs one <code>build_daily_breakdown</code> close; autopilot routine live on rolling day index 3 (mod 7).</p>
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
  },
): string {
  const { browseMode, browseData, save, view, idolDetailUid, groupDetailUid, idolListLayout } = ctx;

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
        });
      default:
        return renderPlaceholder(String(view));
    }
  }

  if (!save) return renderPlaceholder("", "No save loaded.");

  switch (view) {
    case "Inbox":
      return renderInbox(save);
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
        if (grow) return renderGroupDetailPage(grow, "Management roster");
        return `
            <section class="content-panel">
              <p class="content-muted">${htmlEsc(`Group '${gUid}' not in save snapshot.`)}</p>
              <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc("← Groups")}</button>
            </section>`;
      }
      return renderGroupsManaged(save);
    }
    case "Schedule":
      return renderSchedule(save);
    case "Songs": {
      const grp = getPrimaryGroup(save);
      const gLabel =
        typeof grp?.name_romanji === "string"
          ? grp.name_romanji
          : typeof grp?.name === "string"
            ? grp.name
            : undefined;
      return renderSongsList(save.database_snapshot.songs, {
        subtitle: save.scenario_context?.startup_date
          ? `Opening ${save.scenario_context.startup_date}`
          : undefined,
        managedGroupUid: save.managing_group_uid,
        managedGroupLabel: gLabel,
      });
    }
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
  });

  const cashPill = finances
    ? `<div class="fm-cash-pill" title="Cash on hand"><span class="fm-cash-label">¥</span>${finances.cash_yen.toLocaleString("ja-JP")}</div>`
    : `<div class="fm-cash-pill content-muted" title="Browse">Browse</div>`;

  const nextDayBtn = browseMode
    ? `<button type="button" class="fm-btn fm-btn-continue" id="btn-next-day" disabled title="Not in browse mode">${htmlEsc("NEXT DAY")}</button>`
    : `<button type="button" class="fm-btn fm-btn-continue" id="btn-next-day">${htmlEsc("NEXT DAY")}</button>`;

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
