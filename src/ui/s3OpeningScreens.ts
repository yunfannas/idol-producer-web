/**
 * Scenario 3 =LOVE Featured Trial — dedicated opening / briefing screen.
 */

import type { LoadedScenario, ScenarioPreset } from "../data/scenarioTypes";
import { htmlEsc } from "./htmlEsc";
import { t, type UiLanguage } from "./i18n";

function scenarioBackground(preset: ScenarioPreset, lang: UiLanguage): string {
  if (lang === "zh-CN") {
    return String(preset.background_zh ?? preset.background_en ?? "").trim();
  }
  return String(preset.background_en ?? preset.background_zh ?? "").trim();
}

function renderMandateRows(mandate: Record<string, unknown>, lang: UiLanguage): string {
  const rows: { labelKey: string; value: string }[] = [
    { labelKey: "s3_mandate_agency", value: String(mandate.agency_partner ?? "—") },
    { labelKey: "s3_mandate_producer", value: String(mandate.producer ?? "—") },
    { labelKey: "s3_mandate_target", value: String(mandate.target_roster ?? "—") },
    {
      labelKey: "s3_mandate_range",
      value: Array.isArray(mandate.recommended_range) ? mandate.recommended_range.join("–") : "—",
    },
    { labelKey: "s3_mandate_live_debut", value: String(mandate.live_debut_window ?? "—") },
    { labelKey: "s3_mandate_commercial", value: String(mandate.commercial_debut_plan ?? "—") },
    { labelKey: "s3_mandate_direction", value: String(mandate.core_direction ?? "—") },
  ];
  return rows
    .map(
      (row) => `<div class="opening-scenario-meta-row">
        <dt>${htmlEsc(t(lang, row.labelKey))}</dt>
        <dd>${htmlEsc(row.value)}</dd>
      </div>`,
    )
    .join("");
}

function renderLanguageSelect(lang: UiLanguage): string {
  return `<label class="opening-label opening-slot-row" for="lang-select-opening">${htmlEsc(t(lang, "language"))}</label>
    <select id="lang-select-opening" class="opening-input" style="max-width: 14rem">
      <option value="en" ${lang === "en" ? "selected" : ""}>English</option>
      <option value="zh-CN" ${lang === "zh-CN" ? "selected" : ""}>简体中文</option>
    </select>`;
}

export function renderS3FeaturedTrialScreen(
  loaded: LoadedScenario,
  accountName: string,
  lang: UiLanguage,
): string {
  const preset = loaded.preset;
  const background = scenarioBackground(preset, lang);
  const mandate = loaded.agency_mandate ?? {};
  const poolSize = loaded.idols.filter((row) => Boolean((row as { audition_candidate?: unknown }).audition_candidate)).length;
  const playerName = String(preset.player_character ?? "指原莉乃");
  const openingDate = String(preset.opening_date ?? "2017-04-03");

  return `
<section class="opening-screen opening-s3-trial" aria-label="${htmlEsc(t(lang, "s3_opening_title"))}">
  <div class="opening-s3-trial-shell">
    <div class="opening-hero fm-card-opening opening-s3-hero">
      ${renderLanguageSelect(lang)}
      <p class="opening-s3-badge">${htmlEsc(t(lang, "s3_featured_trial_badge"))}</p>
      <h1 class="opening-title opening-s3-title">${htmlEsc(preset.name)}</h1>
      <p class="opening-s3-tagline">${htmlEsc(t(lang, "s3_opening_tagline"))}</p>
      <p class="opening-preset">${htmlEsc(t(lang, "opening_scenario_opening", { name: preset.name, date: openingDate }))}</p>
      ${
        background
          ? `<p class="opening-s3-background">${htmlEsc(background)}</p>`
          : ""
      }
    </div>

    <div class="fm-card-opening opening-s3-player-card">
      <h2 class="opening-status-h">${htmlEsc(t(lang, "s3_player_role_title"))}</h2>
      <p class="opening-s3-player-name">${htmlEsc(playerName)}</p>
      <ul class="opening-s3-dual-role">
        <li>${htmlEsc(t(lang, "s3_dual_schedule"))}</li>
        <li>${htmlEsc(t(lang, "s3_dual_availability"))}</li>
        <li>${htmlEsc(t(lang, "s3_dual_influence"))}</li>
      </ul>
    </div>

    <div class="fm-card-opening opening-scenario-card">
      <h2 class="opening-status-h">${htmlEsc(t(lang, "s3_mandate_title"))}</h2>
      <dl class="opening-scenario-meta">${renderMandateRows(mandate, lang)}</dl>
    </div>

    <div class="fm-card-opening opening-s3-stats">
      <h2 class="opening-status-h">${htmlEsc(t(lang, "s3_pool_title"))}</h2>
      <p>${htmlEsc(t(lang, "s3_pool_body", { count: String(poolSize) }))}</p>
      <ul class="opening-s3-milestones">
        <li>${htmlEsc(t(lang, "s3_milestone_apr7"))}</li>
        <li>${htmlEsc(t(lang, "s3_milestone_apr10"))}</li>
        <li>${htmlEsc(t(lang, "s3_milestone_apr29"))}</li>
        <li>${htmlEsc(t(lang, "s3_milestone_aug5"))}</li>
      </ul>
    </div>

    <div class="fm-card-opening producer-block">
      <label class="opening-label" for="producer-name">${htmlEsc(t(lang, "s3_producer_name_label"))}</label>
      <input type="text" id="producer-name" class="opening-input" value="${htmlEsc(accountName || playerName)}" placeholder="${htmlEsc(playerName)}" autocomplete="username" />
      <p class="opening-status-msg">${htmlEsc(t(lang, "s3_producer_name_hint"))}</p>
    </div>

    <div class="opening-actions-footer opening-s3-actions">
      <button type="button" class="opening-btn" id="s3-trial-back">${htmlEsc(t(lang, "opening_back"))}</button>
      <button type="button" class="opening-btn opening-btn-green" id="s3-trial-start">${htmlEsc(t(lang, "s3_start_trial"))}</button>
      <button type="button" class="opening-btn opening-btn-primary" id="s3-open-scenario6">${htmlEsc(t(lang, "s3_play_scenario6"))}</button>
    </div>
  </div>
</section>`;
}
