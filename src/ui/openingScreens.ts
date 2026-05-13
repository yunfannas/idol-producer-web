/**
 * Launcher flow analogous to idol_producer main_ui.show_startup_screen.
 */

import type { LoadedScenario, ScenarioPreset, GroupTierRow } from "../data/scenarioTypes";
import { playableGroups } from "../data/scenarioBrowse";
import { compareStartupGroupRows, groupTierRowMap, sortGroupsForStartupPick } from "../data/startupGroupPicker";
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
  /** True for the first `recommended_count` allowlist names that matched (pinned to top of the table). */
  recommended?: boolean;
}

function rowFromGroup(g: Record<string, unknown>, tierMap: Map<string, GroupTierRow>, recommended: boolean): NewGameRow | null {
  const uid = String(g.uid ?? "");
  if (!uid.length) return null;
  const name = String(g.name ?? g.name_romanji ?? "—");
  const nameRomanji = String(g.name_romanji ?? "") || undefined;
  const mc = Array.isArray(g.member_uids) ? g.member_uids.length : 0;
  const formed = typeof g.formed_date === "string" ? g.formed_date : "—";
  const popNum = typeof g.popularity === "number" ? g.popularity : Number(g.popularity ?? 0) || 0;
  const fansNum = typeof g.fans === "number" ? g.fans : Number(g.fans ?? 0) || 0;
  const staticT = tierMap.get(uid);
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
    pairs = [...head, ...tail.map((t) => ({ g: t.g, recommended: false }))];
  } else if (loaded.preset.scenario_number === 6) {
    // Scenario 6 new game is curated-only (docs/scenario6_available_groups.txt → startup_allowlist.json); never show the full roster.
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
  preset: ScenarioPreset,
  playerNameDefault: string,
  scenario6CuratedPicker?: boolean,
): string {
  const s6 = scenario6CuratedPicker === true;
  const hasRec = rows.some((r) => r.recommended);
  const recCount = rows.filter((r) => r.recommended).length;
  const recTopHint =
    recCount === 1
      ? "The first shortlist name stays at the top (★); the rest follow, sorted by tier, fans, popularity."
      : `The first ${recCount} shortlist names stay at the top (★); the rest follow, sorted by tier, fans, popularity.`;
  const noRows = rows.length === 0;
  const tableHint = s6 && noRows
    ? "Scenario 6 lists only groups from docs/scenario6_available_groups.txt (synced to startup_allowlist.json). None matched yet — run npm run data:scenario6-startup-allowlist, ship the JSON beside group_tiers.json, and align Japanese names in groups.json (2+ current members)."
    : s6 && !noRows
      ? hasRec
        ? `Only groups from docs/scenario6_available_groups.txt appear here. ${recTopHint}`
        : "Only groups from docs/scenario6_available_groups.txt appear here (sorted by tier, fans, popularity)."
      : hasRec
        ? `Only groups from the scenario shortlist are shown. ${recTopHint}`
        : "Playable roster list from the snapshot (sorted by tier, fans, popularity). Click a row to select.";
  const tableRows = rows
    .map(
      (r) => `
    <tr data-group-uid="${htmlEsc(r.uid)}" class="group-picker-row${r.recommended ? " group-picker-row--recommended" : ""}">
      <td>${r.recommended ? `<span class="opening-rec-mark" title="${htmlEsc("Recommended")}">★</span>` : ""}${htmlEsc(r.name)}</td>
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
    <p class="content-muted">${htmlEsc(tableHint)}</p>
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
