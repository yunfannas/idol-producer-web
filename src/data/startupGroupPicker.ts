/**
 * New-game group ordering (desktop `main_ui._rebuild_startup_group_rows` — subset).
 * When `group_tiers.json` is present on the loaded scenario, use its `sort_key`;
 * otherwise fall back to `compareGroupsTierBestFansDesc`.
 */

import type { GroupTierRow } from "./scenarioTypes";
import { compareGroupsTierBestFansDesc } from "../engine/financeSystem";

export function groupTierRowMap(rows: GroupTierRow[] | undefined): Map<string, GroupTierRow> {
  const m = new Map<string, GroupTierRow>();
  if (!rows?.length) return m;
  for (const r of rows) {
    const u = String(r.uid ?? "").trim();
    if (u) m.set(u, r);
  }
  return m;
}

export function compareStartupGroupRows(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
  tierMap: Map<string, GroupTierRow>,
): number {
  const ua = String(a.uid ?? "").trim();
  const ub = String(b.uid ?? "").trim();
  const ra = tierMap.get(ua);
  const rb = tierMap.get(ub);
  if (tierMap.size > 0 && ra && rb) {
    if (ra.sort_key !== rb.sort_key) return ra.sort_key - rb.sort_key;
    return ua.localeCompare(ub);
  }
  return compareGroupsTierBestFansDesc(a, b);
}

export function sortGroupsForStartupPick(
  playable: Record<string, unknown>[],
  tierMap: Map<string, GroupTierRow>,
): Record<string, unknown>[] {
  return [...playable].sort((a, b) => compareStartupGroupRows(a, b, tierMap));
}
