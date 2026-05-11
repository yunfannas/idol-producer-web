/**
 * Playable-group helpers for scenario snapshot (browse UI + new-game picker).
 */

export const BROWSE_PIN_KEYS = ["=love", "ilife!", "アキシブ", "akishibu", "高嶺"];

export function playableGroups(groups: Record<string, unknown>[]): Record<string, unknown>[] {
  return groups.filter((g) => {
    const u = g.member_uids;
    return Array.isArray(u) && u.length > 0;
  });
}

export function browseGroupRank(g: Record<string, unknown>): number {
  const blob = `${String(g.name ?? "")} ${String(g.name_romanji ?? "")}`.toLowerCase();
  for (let i = 0; i < BROWSE_PIN_KEYS.length; i++) {
    if (blob.includes(BROWSE_PIN_KEYS[i])) return i;
  }
  const mc = Array.isArray(g.member_uids) ? g.member_uids.length : 0;
  return 50 - Math.min(mc, 50);
}
