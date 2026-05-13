/**
 * Playable-group helpers for scenario snapshot (browse UI + new-game picker).
 */

export const BROWSE_PIN_KEYS = ["=love", "ilife!", "アキシブ", "akishibu", "高嶺"];

/**
 * These `uid`s exist for idol `group_history` / catalog joins only — not real roster rows
 * for the browse or management group directory (see `group_tiers.json` / idolsdiagram slugs).
 */
export const GROUP_UIDS_HIDDEN_FROM_LISTING: ReadonlySet<string> = new Set([
  "QkFCWU1PTlNURVI",
  "QkFCWU1FVEFM",
  "TEUgU1NFUkFGSU0",
  "SVoqT05F",
  /** K-pop group — hidden from browse / directory lists. */
  "QmlsbGxpZQ",
]);

/** Current roster size: prefer `member_uids` length, else numeric `member_count`. */
export function currentGroupRosterCount(g: Record<string, unknown>): number {
  const u = g.member_uids;
  if (Array.isArray(u)) return u.map((x) => String(x ?? "").trim()).filter(Boolean).length;
  const mc = g.member_count;
  if (typeof mc === "number" && Number.isFinite(mc)) return mc;
  return 0;
}

/** Browse / management / new-game lists: hide history-only slugs and 0–1 member rows. */
export function groupsForDirectoryListing(groups: Record<string, unknown>[]): Record<string, unknown>[] {
  return groups.filter((g) => {
    const uid = String((g as { uid?: unknown }).uid ?? "").trim();
    if (!uid || GROUP_UIDS_HIDDEN_FROM_LISTING.has(uid)) return false;
    return currentGroupRosterCount(g) > 1;
  });
}

/** New-game picker and any “playable roster” use same visibility as the group directory. */
export function playableGroups(groups: Record<string, unknown>[]): Record<string, unknown>[] {
  return groupsForDirectoryListing(groups);
}

export function browseGroupRank(g: Record<string, unknown>): number {
  const blob = `${String(g.name ?? "")} ${String(g.name_romanji ?? "")}`.toLowerCase();
  for (let i = 0; i < BROWSE_PIN_KEYS.length; i++) {
    if (blob.includes(BROWSE_PIN_KEYS[i])) return i;
  }
  const mc = Array.isArray(g.member_uids) ? g.member_uids.length : 0;
  return 50 - Math.min(mc, 50);
}
