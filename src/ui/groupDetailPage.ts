/**
 * Group roster profile (ported from desktop `idol_producer/ui/group_ui.py` `show_group_detail_page`).
 */

import { resolveGroupLetterTier } from "../engine/financeSystem";
import {
  activeGroupMembershipsAtReference,
  romajiFromRow,
} from "./idolRowMeta";
import { htmlEsc } from "./htmlEsc";
import { attrQuotedUrl, avatarPlaceholderDataUrl, groupPicturePublicSrc } from "./portraitUrl";
import {
  buildDiscBuckets,
  parseCatalogIsoToTime,
  songsForDisplaySorted,
} from "../data/songDisplayPolicy";

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

function joinDateInCurrentGroup(
  idol: Record<string, unknown>,
  groupUid: string,
  groupName: string,
): string {
  const hist = idol.group_history;
  if (!Array.isArray(hist)) return "—";
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const uid = String(e.group_uid ?? "").trim();
    const gn = String(e.group_name ?? "").trim();
    if (uid === groupUid || gn === groupName) {
      const sd = typeof e.start_date === "string" ? e.start_date.trim().split("T")[0] : "";
      return /^\d{4}-\d{2}-\d{2}$/.test(sd) ? sd : "—";
    }
  }
  return "—";
}

function memberColorInCurrentGroup(
  idol: Record<string, unknown>,
  groupUid: string,
  groupName: string,
): string {
  const hist = idol.group_history;
  if (!Array.isArray(hist)) {
    return typeof idol.member_color === "string" && idol.member_color.trim()
      ? String(idol.member_color).trim()
      : "—";
  }
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const uid = String(e.group_uid ?? "").trim();
    const gn = String(e.group_name ?? "").trim();
    if (uid === groupUid || gn === groupName) {
      const c = typeof e.member_color === "string" ? e.member_color.trim() : "";
      return c || "—";
    }
  }
  return typeof idol.member_color === "string" && idol.member_color.trim()
    ? String(idol.member_color).trim()
    : "—";
}

function otherActiveGroupsLabel(
  idol: Record<string, unknown>,
  groupUid: string,
  referenceIso: string | undefined,
  groups: Record<string, unknown>[],
): string {
  const mems = activeGroupMembershipsAtReference(idol, referenceIso, groups);
  const names = mems
    .filter((m) => m.uid !== groupUid)
    .map((m) => m.name.trim())
    .filter(Boolean);
  return names.length ? names.join(", ") : "—";
}

function pickGroupHeroPicturePaths(g: Record<string, unknown>): { heroRaw: string | null; logoRaw: string | null } {
  const pics = Array.isArray(g.pictures)
    ? (g.pictures as unknown[]).filter((x): x is string => typeof x === "string" && x.trim() !== "")
    : [];
  let logo: string | null = null;
  let hero: string | null = null;
  for (const p of pics) {
    const pl = p.toLowerCase();
    if (pl.includes("logo")) logo = p.trim();
    else if (!hero) hero = p.trim();
  }
  if (!hero && pics[0]) hero = pics[0]!.trim();
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
  return visible
    .map((d) => {
      const t = String(d.title ?? d.title_romanji ?? "—").trim() || "—";
      const typ = String(d.disc_type ?? "").trim() || "—";
      const rel =
        typeof d.release_date === "string" && d.release_date.trim()
          ? d.release_date.trim().split("T")[0]
          : "—";
      const tl = Array.isArray(d.track_list) ? d.track_list.length : 0;
      const tn = Array.isArray(d.track_song_uids) ? d.track_song_uids.length : 0;
      const tc = Math.max(tl, tn);
      return `<tr><td>${htmlEsc(t)}</td><td>${htmlEsc(typ)}</td><td class="num">${htmlEsc(rel)}</td><td class="num">${tc.toLocaleString("ja-JP")}</td></tr>`;
    })
    .join("");
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
}

export function renderGroupDetailPage(
  g: Record<string, unknown>,
  contextLabel: string,
  ctx: GroupDetailPageCtx,
): string {
  const name = String(g.name ?? g.name_romanji ?? "—");
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
    ? `<p class="content-muted group-detail-wiki"><a href="${attrQuotedUrl(wikiUrl)}" target="_blank" rel="noopener noreferrer">${htmlEsc("Wiki")}</a></p>`
    : "";

  const agencies = Array.isArray(g.agencies)
    ? (g.agencies as unknown[]).map((a) => String(a).trim()).filter(Boolean).join(", ")
    : "";
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
    refShort && /^\d{4}-\d{2}-\d{2}$/.test(refShort) ? ` (as of ${refShort})` : "";

  const teamSongs = songsForDisplaySorted(ctx.songs).filter((s) => String(s.group_uid ?? "") === gid);
  const songCount = teamSongs.length;
  const discCount = Array.isArray(g.discography) ? g.discography.length : buildDiscBuckets(teamSongs).length;

  const songsBtn = gid
    ? `<button type="button" class="group-detail-fact-link" data-open-songs-for-group="${encodeURIComponent(gid)}">${htmlEsc(
        `Songs: ${songCount.toLocaleString("ja-JP")}`,
      )}</button>`
    : htmlEsc(`Songs: ${songCount.toLocaleString("ja-JP")}`);

  const subtitleBits = [romanji ? romanji : "", nick ? `Nickname: ${nick}` : "", nickR ? nickR : ""].filter(Boolean);
  const subtitle = subtitleBits.length ? `<p class="content-muted group-detail-sub">${htmlEsc(subtitleBits.join(" | "))}</p>` : "";

  const byUid = idolMapByUid(ctx.idols);
  const refIsoU = ctx.referenceIso ?? undefined;

  const currentRows = memberUids
    .map((uid, i) => {
      const idol = byUid.get(uid);
      const stage = memberNames[i] ?? "";
      const displayName = idol
        ? `${stage || String(idol.name ?? "—")}${romajiFromRow(idol) ? ` (${romajiFromRow(idol)})` : ""}`
        : stage || uid.slice(0, 8);
      const color = idol ? memberColorInCurrentGroup(idol, gid, name) : "—";
      const join = idol ? joinDateInCurrentGroup(idol, gid, name) : "—";
      const other = idol ? otherActiveGroupsLabel(idol, gid, refIsoU, ctx.groups) : "—";
      const colorCell =
        /^#[0-9A-Fa-f]{3,8}$/.test(color.trim())
          ? `<span class="group-member-color-chip" style="background:${color.trim()}" title="${htmlEsc(color)}"></span> ${htmlEsc(color)}`
          : htmlEsc(color);
      const nameCell = idol
        ? `<button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(displayName)}</button>`
        : htmlEsc(displayName);
      return `<tr><td>${nameCell}</td><td>${colorCell}</td><td class="num">${htmlEsc(join)}</td><td>${htmlEsc(other)}</td></tr>`;
    })
    .join("");

  const currentTable =
    memberUids.length > 0
      ? `<div class="table-scroll"><table class="fm-table group-detail-roster-table">
      <thead><tr><th>${htmlEsc("Name in group")}</th><th>${htmlEsc("Color")}</th><th>${htmlEsc("Join")}</th><th>${htmlEsc("Other groups")}</th></tr></thead>
      <tbody>${currentRows}</tbody></table></div>`
      : `<p class="content-muted">${htmlEsc("No current member UIDs in snapshot.")}</p>`;

  let pastBlock = "";
  if (pastUids.length) {
    const prow = pastUids
      .map((uid, i) => {
        const idol = byUid.get(uid);
        const label = pastNames[i] ?? (idol ? String(idol.name ?? "—") : uid.slice(0, 8));
        const cell = idol
          ? `<button type="button" class="idol-detail-group-link" data-idol-detail="${htmlEsc(uid)}">${htmlEsc(label)}</button>`
          : htmlEsc(label);
        return `<tr><td>${cell}</td></tr>`;
      })
      .join("");
    pastBlock = `<details class="group-detail-past"><summary class="group-detail-past-sum">${htmlEsc(
      `Past members (${pastUids.length.toLocaleString("ja-JP")})`,
    )}</summary><div class="table-scroll"><table class="fm-table"><tbody>${prow}</tbody></table></div></details>`;
  }

  const discFromJson = renderDiscographyRowsFromGroupJson(g, ctx.referenceIso);
  const discBody = discFromJson || renderDiscographyRowsFromSongBuckets(teamSongs);

  return `
<section class="content-panel group-detail-view" aria-label="${htmlEsc(name)}">
  <header class="idol-detail-toolbar">
    <button type="button" class="fm-btn fm-btn-accent" id="btn-group-detail-back">${htmlEsc("← Groups")}</button>
    <span class="content-muted idol-detail-ref">${htmlEsc(contextLabel)}</span>
  </header>
  <div class="fm-card group-detail-head">
    <div class="group-detail-hero-cols">
      <div class="group-detail-hero-left">${heroHtml}</div>
      <div class="group-detail-hero-main">
        <h2 class="content-h2">${htmlEsc(name)}</h2>
        ${subtitle}
        <p class="group-detail-facts-row content-muted">
          <span>${htmlEsc(`Members: ${memberUids.length.toLocaleString("ja-JP")}`)}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${htmlEsc(`Past: ${pastUids.length.toLocaleString("ja-JP")}`)}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${htmlEsc(`Discography: ${discCount.toLocaleString("ja-JP")}`)}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${songsBtn}</span>
          <span class="group-detail-fact-sep">|</span>
          <span>${htmlEsc(`Formed: ${formed}`)}</span>
        </p>
        <dl class="basic-dl group-detail-meta-dl">
          <div><dt>${htmlEsc("Tier")}</dt><dd>${htmlEsc(tier)}</dd></div>
          <div><dt>${htmlEsc("Fans")}</dt><dd>${fans.toLocaleString("ja-JP")}</dd></div>
          <div><dt>${htmlEsc("Popularity")}</dt><dd>${String(pop)}</dd></div>
          <div><dt>${htmlEsc("Agencies")}</dt><dd>${htmlEsc(agencies || "—")}</dd></div>
          <div><dt>${htmlEsc("Union")}</dt><dd>${htmlEsc(union)}</dd></div>
        </dl>
        ${wikiBlock}
        ${desc}
      </div>
    </div>
  </div>

  <div class="fm-card group-detail-section">
    <div class="group-detail-section-head">${htmlEsc("IDOLS")}</div>
    <div class="group-detail-section-body">
      ${currentTable}
      ${pastBlock}
    </div>
  </div>

  <div class="fm-card group-detail-section">
    <div class="group-detail-section-head">${htmlEsc("DISCOGRAPHY")}${htmlEsc(refNote)}</div>
    <div class="group-detail-section-body">
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc("Title")}</th><th>${htmlEsc("Type")}</th><th>${htmlEsc("Release")}</th><th>${htmlEsc("Tracks")}</th></tr></thead>
          <tbody>${discBody}</tbody>
        </table>
      </div>
    </div>
  </div>

  <div class="fm-card group-detail-section">
    <div class="group-detail-section-head">${htmlEsc("LIVES")}${htmlEsc(refNote)}</div>
    <div class="group-detail-section-body">
      <div class="table-scroll">
        <table class="fm-table">
          <thead><tr><th>${htmlEsc("Date")}</th><th>${htmlEsc("Title")}</th><th>${htmlEsc("Venue")}</th><th>${htmlEsc("Type")}</th></tr></thead>
          <tbody>${renderLivesRows(ctx.lives, name, ctx.referenceIso)}</tbody>
        </table>
      </div>
    </div>
  </div>
</section>`;
}
