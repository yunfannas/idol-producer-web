/**
 * Launcher flow analogous to idol_producer main_ui.show_startup_screen.
 */

import type { LoadedScenario, ScenarioPreset, GroupTierRow } from "../data/scenarioTypes";
import { playableGroups } from "../data/scenarioBrowse";
import { compareStartupGroupRows, groupTierRowMap, sortGroupsForStartupPick } from "../data/startupGroupPicker";
import { inferLetterTier } from "../engine/financeSystem";
import { AUTOSAVE_SLOT, type SlotSummary } from "../persistence/saves";
import { htmlEsc } from "./htmlEsc";
import { gameManualHref, ikonoijoyBest10Href, languageOptions, oshiChartHref, t, type UiLanguage } from "./i18n";

export type OpeningScreen = "login" | "home" | "new_game" | "load_slot";

function scenarioBackground(preset: ScenarioPreset, lang: UiLanguage): string {
  if (lang === "zh-CN") {
    return String(preset.background_zh ?? preset.background_en ?? "").trim();
  }
  return String(preset.background_en ?? preset.background_zh ?? "").trim();
}

function renderScenarioInfoCard(preset: ScenarioPreset | null, lang: UiLanguage): string {
  if (!preset) return "";
  const background = scenarioBackground(preset, lang);
  const startDate = String(preset.opening_date ?? "").trim();
  return `
  <div class="fm-card-opening opening-scenario-card" aria-label="${htmlEsc(t(lang, "opening_scenario_card"))}">
    <h2 class="opening-status-h">${htmlEsc(preset.name)}</h2>
    <dl class="opening-scenario-meta">
      <div class="opening-scenario-meta-row">
        <dt>${htmlEsc(t(lang, "opening_scenario_start_date"))}</dt>
        <dd>${htmlEsc(startDate || t(lang, "common_not_set"))}</dd>
      </div>
      ${
        background
          ? `<div class="opening-scenario-meta-row opening-scenario-meta-row--stack">
        <dt>${htmlEsc(t(lang, "opening_scenario_background"))}</dt>
        <dd>${htmlEsc(background)}</dd>
      </div>`
          : ""
      }
    </dl>
  </div>`;
}

function renderLanguageSelect(lang: UiLanguage): string {
  return `<label class="opening-label opening-slot-row" for="lang-select-opening">${htmlEsc(t(lang, "language"))}</label>
    <select id="lang-select-opening" class="opening-input" style="max-width: 14rem">
      ${languageOptions()
        .map((opt) => `<option value="${opt.value}" ${opt.value === lang ? "selected" : ""}>${htmlEsc(opt.label)}</option>`)
        .join("")}
    </select>`;
}

export function renderOpeningLogin(
  dbReady: boolean,
  status: string,
  accountName: string,
  lang: UiLanguage,
  preset: ScenarioPreset | null = null,
): string {
  const disabled = dbReady && accountName.trim() ? "" : "disabled";

  return `
<section class="opening-screen" aria-label="${htmlEsc(t(lang, "opening_log_in"))}">
  <div class="opening-hero fm-card-opening">
    ${renderLanguageSelect(lang)}
    <h1 class="opening-title">${htmlEsc("IDOL PRODUCER")}</h1>
    <p class="opening-tagline">${htmlEsc(t(lang, "opening_tagline"))}</p>
  </div>

  ${renderScenarioInfoCard(preset, lang)}

  <div class="fm-card-opening producer-block">
    <label class="opening-label" for="account-name">${htmlEsc(t(lang, "opening_account_name"))}</label>
    <input type="text" id="account-name" class="opening-input" value="${htmlEsc(accountName)}" placeholder="${htmlEsc(t(lang, "opening_enter_account_name"))}" autocomplete="off" />
    <p class="opening-status-msg">${htmlEsc(t(lang, "opening_password_later"))}</p>
    <div class="opening-actions-footer">
      <button type="button" class="opening-btn opening-btn-green" id="opening-login" ${disabled}>${htmlEsc(t(lang, "opening_log_in"))}</button>
    </div>
  </div>

  <p class="opening-manual-row">
    <a class="opening-manual-link" href="${htmlEsc(gameManualHref(lang))}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "opening_game_manual"))}</a>
    <a class="opening-manual-link" href="${htmlEsc(oshiChartHref())}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "opening_oshi_chart"))}</a>
    <a class="opening-manual-link" href="${htmlEsc(ikonoijoyBest10Href())}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "opening_ikonoijoy_best10"))}</a>
  </p>

  <div class="opening-status fm-card-opening">
    <h2 class="opening-status-h">${htmlEsc(t(lang, "opening_status"))}</h2>
    <p class="opening-status-strong">${htmlEsc(dbReady ? t(lang, "opening_db_ready") : t(lang, "opening_db_loading"))}</p>
    <p class="opening-status-msg">${htmlEsc(status)}</p>
  </div>
</section>`;
}

export function renderOpeningHome(
  presetHint: ScenarioPreset | null,
  dbReady: boolean,
  status: string,
  canResume: boolean,
  slot: number,
  _occupiedSlots: number[],
  slotSummaries: SlotSummary[],
  lang: UiLanguage,
): string {
  const slotSummaryMap = new Map(slotSummaries.map((row) => [row.slot, row.label] as const));
  const disabled = dbReady ? "" : "disabled";

  return `
<section class="opening-screen" aria-label="${htmlEsc(t(lang, "shell_home"))}">
  <div class="opening-hero fm-card-opening">
    ${renderLanguageSelect(lang)}
    <h1 class="opening-title">${htmlEsc("IDOL PRODUCER")}</h1>
    <p class="opening-tagline">${htmlEsc(t(lang, "opening_tagline"))}</p>
  </div>

  ${renderScenarioInfoCard(presetHint, lang)}

  <div class="opening-actions">
    ${canResume ? `<button type="button" class="opening-btn opening-btn-green" id="opening-resume">${htmlEsc(t(lang, "opening_resume"))}</button>` : ""}
    <button type="button" class="opening-btn opening-btn-primary" id="opening-new-game" ${disabled}>${htmlEsc(t(lang, "opening_new_game"))}</button>
    <button type="button" class="opening-btn opening-btn-primary" id="opening-load-slot" ${disabled}>${htmlEsc(t(lang, "opening_load"))}</button>
    <button type="button" class="opening-btn opening-btn-primary" id="opening-browse" ${disabled}>${htmlEsc(t(lang, "opening_browse"))}</button>
  </div>

  <p class="opening-manual-row">
    <a class="opening-manual-link" href="${htmlEsc(gameManualHref(lang))}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "opening_game_manual"))}</a>
    <a class="opening-manual-link" href="${htmlEsc(oshiChartHref())}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "opening_oshi_chart"))}</a>
    <a class="opening-manual-link" href="${htmlEsc(ikonoijoyBest10Href())}" target="_blank" rel="noopener noreferrer">${htmlEsc(t(lang, "opening_ikonoijoy_best10"))}</a>
  </p>

  <div class="opening-status fm-card-opening">
    <h2 class="opening-status-h">${htmlEsc(t(lang, "opening_status"))}</h2>
    <p class="opening-status-strong">${htmlEsc(dbReady ? t(lang, "opening_db_ready") : t(lang, "opening_db_loading"))}</p>
    <p class="opening-status-msg">${htmlEsc(status)}</p>
    <label class="opening-label opening-slot-row" for="opening-slot-select">${htmlEsc(t(lang, "opening_load_slot"))}</label>
    <select id="opening-slot-select" class="opening-input" style="max-width: 14rem">
      ${Array.from({ length: AUTOSAVE_SLOT + 1 }, (_, s) => {
        const detail = slotSummaryMap.get(s);
        const label = detail ? detail : s === AUTOSAVE_SLOT ? t(lang, "opening_autosave") : `${t(lang, "shell_slot")} ${s}`;
        return `<option value="${s}" ${s === slot ? "selected" : ""}>${htmlEsc(label)}</option>`;
      }).join("")}
    </select>
  </div>
</section>`;
}

export interface NewGameRow {
  uid: string;
  name: string;
  nameRomanji?: string;
  tier: string;
  memberCount: number;
  formed: string;
  popularity: string;
  /** True for the first `recommended_count` allowlist names that matched (pinned to top of the table). */
  recommended?: boolean;
}

function rowFromGroup(g: Record<string, unknown>, tierMap: Map<string, GroupTierRow>, recommended: boolean): NewGameRow | null {
  const uid = String(g.uid ?? "");
  if (!uid.length) return null;
  const name = String(g.name ?? g.name_romanji ?? "-");
  const nameRomanji = String(g.name_romanji ?? "") || undefined;
  const mc = Array.isArray(g.member_uids) ? g.member_uids.length : 0;
  const formed = typeof g.formed_date === "string" ? g.formed_date : "-";
  const popNum = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fansNum = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const staticT =
    tierMap.get(uid);
  const tier =
    staticT && typeof staticT.letter_tier === "string" && /^[SABCDEF]$/i.test(staticT.letter_tier.trim())
      ? String(staticT.letter_tier).trim().toUpperCase()
      : typeof g.letter_tier === "string" && g.letter_tier.trim()
        ? String(g.letter_tier)
        : inferLetterTier(popNum, fansNum, 0);
  return {
    uid,
    name,
    nameRomanji,
    tier,
    memberCount: mc,
    formed,
    popularity: g.popularity != null ? String(g.popularity) : "-",
    recommended: recommended || undefined,
  };
}

/** Playable groups for the new-game picker; scenario 6 may restrict to `startup_allowlist.json` order. */
export function buildNewGameRows(loaded: LoadedScenario): NewGameRow[] {
  const tierMap = groupTierRowMap(loaded.group_tiers);
  const playable = playableGroups(loaded.groups);
  const allow = loaded.startup_allowlist;

  type Pair = { g: Record<string, unknown>; recommended: boolean };
  let pairs: Pair[];

  if (allow?.names_in_order?.length) {
    const nameOrder = allow.names_in_order;
    const recK = Math.max(0, Math.min(nameOrder.length, allow.recommended_count ?? 4));

    const byName = new Map<string, Record<string, unknown>>();
    for (const g of playable) {
      const n = String((g as { name?: unknown }).name ?? "").trim();
      if (!n || byName.has(n)) continue;
      byName.set(n, g);
    }

    const seenUid = new Set<string>();
    const matched: { g: Record<string, unknown>; name: string }[] = [];
    for (const name of nameOrder) {
      const g = byName.get(name);
      if (!g) continue;
      const uid = String(g.uid ?? "").trim();
      if (!uid || seenUid.has(uid)) continue;
      seenUid.add(uid);
      matched.push({ g, name });
    }

    const recommendedNameSet = new Set(nameOrder.slice(0, recK));
    const head: Pair[] = [];
    const tail: { g: Record<string, unknown> }[] = [];
    for (const row of matched) {
      if (recommendedNameSet.has(row.name)) head.push({ g: row.g, recommended: true });
      else tail.push({ g: row.g });
    }
    tail.sort((a, b) => compareStartupGroupRows(a.g, b.g, tierMap));
    pairs = [...head, ...tail.map((t0) => ({ g: t0.g, recommended: false }))];
  } else if (loaded.preset.scenario_number === 6) {
    pairs = [];
  } else {
    pairs = sortGroupsForStartupPick(playable, tierMap).map((g) => ({ g, recommended: false }));
  }

  const out: NewGameRow[] = [];
  for (const { g, recommended } of pairs) {
    const r = rowFromGroup(g, tierMap, recommended);
    if (r) out.push(r);
  }
  return out;
}

export function renderNewGameScreen(
  rows: NewGameRow[],
  accountName: string,
  preset: ScenarioPreset | null,
  lang: UiLanguage,
): string {
  const tableRows = rows
    .map(
      (r) => `
    <tr data-group-uid="${htmlEsc(r.uid)}" class="group-picker-row${r.recommended ? " group-picker-row--recommended" : ""}">
      <td>${r.recommended ? `<span class="opening-rec-mark" title="${htmlEsc(t(lang, "opening_recommended"))}">★</span>` : ""}${htmlEsc(r.name)}</td>
      <td>${htmlEsc(r.nameRomanji ?? "-")}</td>
      <td>${htmlEsc(r.tier)}</td>
      <td>${r.memberCount}</td>
      <td>${htmlEsc(r.formed)}</td>
      <td>${htmlEsc(r.popularity)}</td>
    </tr>`,
    )
    .join("");

  return `
<section class="opening-screen opening-new-game" aria-label="${htmlEsc(t(lang, "opening_new_game"))}">
  <div class="opening-hero fm-card-opening">
    ${renderLanguageSelect(lang)}
    <h1 class="opening-title">${htmlEsc(t(lang, "opening_new_game_title"))}</h1>
  </div>

  ${renderScenarioInfoCard(preset, lang)}

  <div class="fm-card-opening producer-block">
    <label class="opening-label" for="producer-name">${htmlEsc(t(lang, "opening_producer_account"))}</label>
    <input type="text" id="producer-name" class="opening-input" value="${htmlEsc(accountName)}" placeholder="${htmlEsc(t(lang, "opening_enter_account_name"))}" autocomplete="username" />
  </div>

  <div class="fm-card-opening opening-table-wrap">
    <h2 class="opening-table-h">${htmlEsc(t(lang, "opening_managed_group"))}</h2>
    <div class="table-scroll">
      <table class="fm-table group-pick-table" id="group-pick-table">
        <thead>
          <tr><th>${htmlEsc(t(lang, "opening_group"))}</th><th>${htmlEsc(t(lang, "opening_romaji"))}</th><th>${htmlEsc(t(lang, "opening_tier"))}</th><th>${htmlEsc(t(lang, "opening_members"))}</th><th>${htmlEsc(t(lang, "opening_formed"))}</th><th>${htmlEsc(t(lang, "opening_pop"))}</th></tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="6" class="content-muted">${htmlEsc(t(lang, "opening_no_rows"))}</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <div class="opening-actions-footer">
    <button type="button" class="opening-btn" id="new-game-back">${htmlEsc(t(lang, "opening_back"))}</button>
    <button type="button" class="opening-btn opening-btn-green" id="new-game-start" disabled>${htmlEsc(t(lang, "opening_start_scenario"))}</button>
  </div>
</section>`;
}
