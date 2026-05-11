/** Resolve display fields from raw `idols.json` rows + scenario reference date. */

export function romajiFromRow(row: Record<string, unknown>): string {
  const r =
    typeof row.romaji === "string"
      ? row.romaji
      : typeof row.romanji === "string"
        ? row.romanji
        : "";
  return r.trim();
}

export function groupNamesByUid(groups: Record<string, unknown>[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const uid = String((g as { uid?: unknown }).uid ?? "").trim();
    const n = String((g as { name?: unknown }).name ?? "").trim();
    const rj = String((g as { name_romanji?: unknown }).name_romanji ?? "").trim();
    if (uid) m.set(uid, n || rj || uid);
  }
  return m;
}

function parseIsoDay(d: unknown): string | null {
  if (typeof d !== "string") return null;
  const s = d.trim().split("T")[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  return s;
}

function refDayOrNull(refIso: string | undefined): string | null {
  return refIso && /^\d{4}-\d{2}-\d{2}$/.test(refIso) ? refIso : null;
}

/** Resolve `groups.json` row uid from display name / romanji (exact match). */
export function lookupGroupUidByName(groups: Record<string, unknown>[], displayName: string): string | undefined {
  const t = displayName.trim();
  if (!t) return undefined;
  for (const g of groups) {
    if (!g || typeof g !== "object") continue;
    const uid = String((g as { uid?: unknown }).uid ?? "").trim();
    if (!uid) continue;
    const n = String((g as { name?: unknown }).name ?? "").trim();
    const rj = String((g as { name_romanji?: unknown }).name_romanji ?? "").trim();
    if (n === t || rj === t) return uid;
  }
  return undefined;
}

export type ActiveGroupMembership = { uid: string; name: string };

/** Active memberships on `refIso` with stable group uid when resolvable from history + roster. */
export function activeGroupMembershipsAtReference(
  row: Record<string, unknown>,
  refIso: string | undefined,
  groups: Record<string, unknown>[],
): ActiveGroupMembership[] {
  const ref = refDayOrNull(refIso);
  if (!ref) return [];
  const refMs = new Date(`${ref}T12:00:00Z`).getTime();
  const hist = row.group_history;
  if (!Array.isArray(hist)) return [];
  const uidToName = groupNamesByUid(groups);
  const out: ActiveGroupMembership[] = [];
  const seen = new Set<string>();

  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const start = parseIsoDay(e.start_date);
    if (!start) continue;
    const startMs = new Date(`${start}T12:00:00Z`).getTime();
    if (refMs < startMs) continue;
    const endRaw = e.end_date;
    let active = false;
    if (endRaw == null || endRaw === "") active = true;
    else {
      const end = parseIsoDay(endRaw);
      if (end) {
        const endMs = new Date(`${end}T12:00:00Z`).getTime();
        if (refMs <= endMs) active = true;
      }
    }
    if (!active) continue;

    let uid = String(e.group_uid ?? "").trim();
    const gname = String(e.group_name ?? "").trim();
    if (!uid && gname) uid = lookupGroupUidByName(groups, gname) ?? "";
    const name = gname || (uid ? uidToName.get(uid) ?? "" : "");
    if (!name) continue;
    const dedupeKey = uid || name;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);
    out.push({ uid, name });
  }
  return out;
}

/** Memberships active on `refIso` (inclusive of start/end dates). */
export function activeGroupsAtReference(row: Record<string, unknown>, refIso: string | undefined): string[] {
  const ref = refDayOrNull(refIso);
  if (!ref) return [];
  const refMs = new Date(`${ref}T12:00:00Z`).getTime();
  const hist = row.group_history;
  if (!Array.isArray(hist)) return [];
  const out: string[] = [];
  for (const raw of hist) {
    if (!raw || typeof raw !== "object") continue;
    const e = raw as Record<string, unknown>;
    const start = parseIsoDay(e.start_date);
    if (!start) continue;
    const startMs = new Date(`${start}T12:00:00Z`).getTime();
    if (refMs < startMs) continue;
    const endRaw = e.end_date;
    if (endRaw == null || endRaw === "") {
      out.push(String(e.group_name ?? "").trim());
      continue;
    }
    const end = parseIsoDay(endRaw);
    if (!end) continue;
    const endMs = new Date(`${end}T12:00:00Z`).getTime();
    if (refMs <= endMs) out.push(String(e.group_name ?? "").trim());
  }
  return [...new Set(out.filter(Boolean))];
}

export function ageLabel(row: Record<string, unknown>, refIso: string | undefined): string {
  const staticAge = row.age;
  if (typeof staticAge === "number" && Number.isFinite(staticAge)) return String(Math.floor(staticAge));

  const ref = refDayOrNull(refIso);
  const bd = parseIsoDay(row.birthday);
  if (ref && bd) {
    const [ry, rm, rd] = ref.split("-").map(Number);
    const [by, bm, bdd] = bd.split("-").map(Number);
    let y = ry - by;
    if (rm < bm || (rm === bm && rd < bdd)) y -= 1;
    if (y >= 0 && y < 120) return String(y);
  }
  if (typeof row.birthday_partial === "string" && row.birthday_partial.trim()) {
    return `(${row.birthday_partial.trim()})`;
  }
  return "—";
}

export function displayReferenceIso(save: unknown, browseOpening: string | undefined): string | undefined {
  if (save && typeof save === "object") {
    const s = save as Record<string, unknown>;
    const cur = s.current_date;
    if (typeof cur === "string" && /^\d{4}-\d{2}-\d{2}$/.test(cur.slice(0, 10))) return cur.slice(0, 10);
    const gd = s.game_start_date;
    if (typeof gd === "string" && /^\d{4}-\d{2}-\d{2}$/.test(gd.slice(0, 10))) return gd.slice(0, 10);
    const ctx = s.scenario_context;
    if (ctx && typeof ctx === "object") {
      const su = (ctx as { startup_date?: unknown }).startup_date;
      if (typeof su === "string" && /^\d{4}-\d{2}-\d{2}$/.test(su.slice(0, 10))) return su.slice(0, 10);
    }
  }
  return browseOpening && /^\d{4}-\d{2}-\d{2}$/.test(browseOpening) ? browseOpening : undefined;
}
