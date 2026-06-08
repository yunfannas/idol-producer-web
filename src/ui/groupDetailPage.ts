/**
 * Group roster profile (ported from desktop `idol_producer/ui/group_ui.py` `show_group_detail_page`).
 */

import { resolveGroupLetterTier } from "../engine/financeSystem";
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
  const color = idol ? memberColorInCurrentGroup(idol, gid, groupName) : "—";
  const colorTrim = color.trim();
  const join = idol ? joinDateInCurrentGroup(idol, gid, groupName) : "—";
  const age = idol ? ageLabel(idol, refIso) : "—";
  const groupsCol = idol ? allGroupsMembershipHtml(idol, refIso, groups) : htmlEsc("—");
  const colorCss = resolveMemberColorCss(colorTrim, idol?.member_color_code);
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
  const mergedDiscRows = buildGroupDiscographyReleaseRows(g, ctx.referenceIso, ctx.sharedReleases ?? []);
  const discCount = mergedDiscRows.length || buildDiscBuckets(teamSongs).length;

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
  <div class="fm-card group-detail-head">
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
          <div><dt>${htmlEsc(t(lang, "group_tier"))}</dt><dd>${htmlEsc(tier)}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_fans"))}</dt><dd>${fans.toLocaleString("ja-JP")}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_popularity"))}</dt><dd>${String(pop)}</dd></div>
          <div><dt>${htmlEsc("Agencies")}</dt><dd>${htmlEsc(agencies || "—")}</dd></div>
          <div><dt>${htmlEsc("Producers")}</dt><dd>${htmlEsc(producers || "—")}</dd></div>
          <div><dt>${htmlEsc(t(lang, "group_union"))}</dt><dd>${htmlEsc(union)}</dd></div>
        </dl>
        ${wikiBlock}
        ${desc}
      </div>
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
</section>`;
}
