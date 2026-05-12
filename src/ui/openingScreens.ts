/**
 * Launcher flow analogous to idol_producer main_ui.show_startup_screen.
 */

import type { LoadedScenario, ScenarioPreset } from "../data/scenarioTypes";
import { playableGroups } from "../data/scenarioBrowse";
import { groupTierRowMap, sortGroupsForStartupPick } from "../data/startupGroupPicker";
import { inferLetterTier } from "../engine/financeSystem";
import { htmlEsc } from "./htmlEsc";

export type OpeningScreen = "home" | "new_game" | "load_slot";

export function renderOpeningHome(
  presetHint: ScenarioPreset | null,
  dbReady: boolean,
  status: string,
  canResume: boolean,
  slot: number,
  occupiedSlots: number[],
): string {
  const hint = presetHint
    ? `Default scenario preset: <strong>${htmlEsc(presetHint.name)}</strong> (opening ${htmlEsc(presetHint.opening_date)}).`
    : "";

  const disabled = dbReady ? "" : "disabled";

  return `
<section class="opening-screen" aria-label="Launcher">
  <div class="opening-hero fm-card-opening">
    <h1 class="opening-title">${htmlEsc("IDOL PRODUCER")}</h1>
    <p class="opening-tagline">${htmlEsc("Choose how to enter the world: start a fresh scenario, load browser save slots, or browse the database first.")}</p>
    ${hint ? `<p class="opening-preset">${hint}</p>` : ""}
  </div>

  <div class="opening-actions">
    ${canResume ? `<button type="button" class="opening-btn opening-btn-green" id="opening-resume">Resume</button>` : ""}
    <button type="button" class="opening-btn opening-btn-primary" id="opening-new-game" ${disabled}>New Game</button>
    <button type="button" class="opening-btn opening-btn-primary" id="opening-load-slot" ${disabled}>Load</button>
    <button type="button" class="opening-btn opening-btn-primary" id="opening-browse" ${disabled}>Browse</button>
  </div>

  <div class="opening-status fm-card-opening">
    <h2 class="opening-status-h">Status</h2>
    <p class="opening-status-strong">${dbReady ? "Database ready." : "Loading scenario database files…"}</p>
    <p class="opening-status-msg">${htmlEsc(status)}</p>
    <label class="opening-label opening-slot-row" for="opening-slot-select">Load slot</label>
    <select id="opening-slot-select" class="opening-input" style="max-width: 14rem">
      ${Array.from({ length: 10 }, (_, s) => {
        const occ = occupiedSlots.includes(s) ? " — saved" : "";
        return `<option value="${s}" ${s === slot ? "selected" : ""}>Slot ${s}${occ}</option>`;
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
}

/** Playable groups for the new-game picker (tier `sort_key` when `group_tiers.json` shipped). */
export function buildNewGameRows(loaded: LoadedScenario): NewGameRow[] {
  const tierMap = groupTierRowMap(loaded.group_tiers);
  const raw = sortGroupsForStartupPick(playableGroups(loaded.groups), tierMap);
  return raw.map((g) => {
    const uid = String(g.uid ?? "");
    const name = String(g.name ?? g.name_romanji ?? "—");
    const nameRomanji = String(g.name_romanji ?? "") || undefined;
    const mc = Array.isArray(g.member_uids) ? g.member_uids.length : 0;
    const formed = typeof g.formed_date === "string" ? g.formed_date : "—";
    const popNum = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
    const fansNum = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
    const staticT = uid ? tierMap.get(uid) : undefined;
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
      popularity: g.popularity != null ? String(g.popularity) : "—",
    };
  }).filter((r) => r.uid.length > 0);
}

export function renderNewGameScreen(rows: NewGameRow[], preset: ScenarioPreset, playerNameDefault: string): string {
  const tableRows = rows
    .map(
      (r) => `
    <tr data-group-uid="${htmlEsc(r.uid)}" class="group-picker-row">
      <td>${htmlEsc(r.name)}</td>
      <td>${htmlEsc(r.nameRomanji ?? "—")}</td>
      <td>${htmlEsc(r.tier)}</td>
      <td>${r.memberCount}</td>
      <td>${htmlEsc(r.formed)}</td>
      <td>${htmlEsc(r.popularity)}</td>
    </tr>`,
    )
    .join("");

  return `
<section class="opening-screen opening-new-game" aria-label="New game">
  <div class="opening-hero fm-card-opening">
    <h1 class="opening-title">${htmlEsc("NEW GAME")}</h1>
    <p class="opening-tagline">${htmlEsc(`Confirm producer name and choose your managed group. Scenario ${preset.scenario_number} · ${preset.name}`)}.</p>
  </div>

  <div class="fm-card-opening producer-block">
    <label class="opening-label" for="producer-name">Producer Name</label>
    <input type="text" id="producer-name" class="opening-input" value="${htmlEsc(playerNameDefault)}" placeholder="Your name" autocomplete="off" />
  </div>

  <div class="fm-card-opening opening-table-wrap">
    <h2 class="opening-table-h">${htmlEsc("Managed group")}</h2>
    <p class="content-muted">${htmlEsc("Playable roster list from the snapshot. Click a row to select.")}</p>
    <div class="table-scroll">
      <table class="fm-table group-pick-table" id="group-pick-table">
        <thead>
          <tr><th>Group</th><th>Romanji</th><th>Tier</th><th>Members</th><th>Formed</th><th>Pop</th></tr>
        </thead>
        <tbody>${tableRows || `<tr><td colspan="6" class="content-muted">No rows</td></tr>`}</tbody>
      </table>
    </div>
  </div>

  <div class="opening-actions-footer">
    <button type="button" class="opening-btn" id="new-game-back">Back</button>
    <button type="button" class="opening-btn opening-btn-green" id="new-game-start" disabled>${htmlEsc("Start scenario")}</button>
  </div>
</section>`;
}
