export const MEMBER_ROLE_DEFINITIONS = {
  leader: {
    label: "Leader",
    attributeBias: {
      mental: { determination: 0.7, teamwork: 0.9, talking: 0.35 },
      hidden: { professionalism: 0.6, loyalty: 0.35 },
    },
  },
  center: {
    label: "Center",
    attributeBias: {
      appearance: { cute: 0.75, pretty: 0.75 },
      technical: { grace: 0.35, rhythm: 0.25 },
      mental: { talking: 0.25 },
    },
  },
  lead_singer: {
    label: "Lead Singer",
    attributeBias: {
      technical: { pitch: 0.9, tone: 0.9, breath: 0.8, power: 0.55, rhythm: 0.2 },
      mental: { determination: 0.35 },
    },
  },
  lead_dancer: {
    label: "Lead Dancer",
    attributeBias: {
      physical: { agility: 0.75, stamina: 0.55, natural_fitness: 0.45 },
      technical: { rhythm: 0.95, grace: 0.8, power: 0.45 },
      mental: { determination: 0.25 },
    },
  },
  host: {
    label: "Host",
    attributeBias: {
      mental: { talking: 0.95, humor: 0.6, clever: 0.55, teamwork: 0.25 },
    },
  },
  content: {
    label: "Content",
    attributeBias: {
      appearance: { cute: 0.2, pretty: 0.2 },
      mental: { talking: 0.8, humor: 0.7, clever: 0.45, fashion: 0.2 },
      hidden: { professionalism: 0.2, ambition: 0.3 },
    },
  },
  streaming: {
    label: "Streaming",
    attributeBias: {
      mental: { talking: 0.85, humor: 0.45, clever: 0.35, teamwork: 0.25 },
      hidden: { professionalism: 0.25, ambition: 0.25 },
    },
  },
  style: {
    label: "Style",
    attributeBias: {
      appearance: { cute: 0.8, pretty: 0.8 },
      mental: { fashion: 0.95, talking: 0.25 },
    },
  },
  call_leader: {
    label: "Call Leader",
    attributeBias: {
      physical: { stamina: 0.25 },
      technical: { power: 0.4, rhythm: 0.25 },
      mental: { talking: 0.85, humor: 0.35, determination: 0.5 },
    },
  },
} as const;

export type MemberRoleKey = keyof typeof MEMBER_ROLE_DEFINITIONS;

export interface MemberRoleAssignment {
  key: string;
  focus: number;
  label?: string;
}

type MemberRoleMapInput = Record<string, unknown>;

const MEMBER_ROLE_ALIASES: Record<string, string> = {
  performance_center: "center",
  performance_centre: "center",
  ace: "center",
  main_vocal: "lead_singer",
  lead_vocal: "lead_singer",
  vocal: "lead_singer",
  main_dancer: "lead_dancer",
  dance_lead: "lead_dancer",
  visual: "style",
  fashion_lead: "style",
  style_lead: "style",
  fashion_face: "style",
  model: "style",
  mc: "host",
  talk_lead: "host",
  variety: "host",
  content_lead: "content",
  youtuber: "content",
  youtube: "content",
  x: "content",
  twitter: "content",
  instagram: "content",
  tiktok: "content",
  influencer: "content",
  social_media: "content",
  social_media_lead: "content",
  social: "content",
  snser: "content",
  sns: "content",
  sns_lead: "content",
  content_creator: "content",
  creator: "content",
  video_creator: "content",
  livestream: "streaming",
  streaming: "streaming",
  streamer: "streaming",
  showroom: "streaming",
  tiktok_live: "streaming",
  instagram_live: "streaming",
  youtube_live: "streaming",
  aori: "call_leader",
  audience_hype: "call_leader",
  hype: "call_leader",
  hype_lead: "call_leader",
  sub_leader: "leader",
  second_leader: "leader",
  "2nd_leader": "leader",
  deputy_leader: "leader",
  vice_leader: "leader",
  "3rdleader": "leader",
  "thirdleader": "leader",
  third_leader: "leader",
  "3rd_leader": "leader",
  "煽り": "call_leader",
  "あおり": "call_leader",
  "コールリーダー": "call_leader",
  "mc担当": "host",
  "トーク担当": "host",
  "ユーチューバー": "content",
  "動画担当": "content",
  "コンテンツ担当": "content",
  "sns担当": "content",
  "sns更新担当": "content",
  "x担当": "content",
  "instagram担当": "content",
  "tiktok担当": "content",
  "配信担当": "streaming",
  "showroom担当": "streaming",
  "tiktok live担当": "streaming",
  "instagram live担当": "streaming",
  "youtube live担当": "streaming",
  "配信/SNS担当": "streaming",
  "ファッション担当": "style",
  "モデル担当": "style",
  "副リーダー": "leader",
  "3番手リーダー": "leader",
};

function asObject(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function normalizeRoleKey(raw: unknown): string {
  const normalized = String(raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/[ -]+/g, "_");
  return MEMBER_ROLE_ALIASES[normalized] ?? normalized;
}

function normalizeRoleFocus(raw: unknown, fallback = 1): number {
  const value =
    typeof raw === "number" && Number.isFinite(raw)
      ? raw
      : typeof raw === "string" && raw.trim() !== "" && Number.isFinite(Number(raw))
        ? Number(raw)
        : fallback;

  if (value <= 1) return Math.max(0, Math.min(1, value));
  if (value <= 5) return Math.max(0, Math.min(1, value / 5));
  if (value <= 100) return Math.max(0, Math.min(1, value / 100));
  return 1;
}

function pushRoleAssignment(
  out: MemberRoleAssignment[],
  seen: Map<string, number>,
  keyRaw: unknown,
  focusRaw: unknown,
  labelRaw?: unknown,
): void {
  const key = normalizeRoleKey(keyRaw);
  if (!key) return;
  const focus = normalizeRoleFocus(focusRaw);
  const label = typeof labelRaw === "string" && labelRaw.trim() ? labelRaw.trim() : undefined;
  const existingIndex = seen.get(key);
  if (existingIndex == null) {
    seen.set(key, out.length);
    out.push({ key, focus, label });
    return;
  }
  const prev = out[existingIndex];
  if (focus > prev.focus) prev.focus = focus;
  if (!prev.label && label) prev.label = label;
}

/**
 * Flexible role authoring for `group_history` entries:
 * - `roles: ["leader", "mc"]`
 * - `roles: { leader: 1, mc: 0.55 }`
 * - `roles: [{ key: "leader", focus: 1 }, { key: "mc", focus: 0.55 }]`
 */
export function normalizeMemberRoleAssignments(raw: unknown): MemberRoleAssignment[] {
  const out: MemberRoleAssignment[] = [];
  const seen = new Map<string, number>();

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (typeof item === "string") {
        pushRoleAssignment(out, seen, item, 1);
        continue;
      }
      const obj = asObject(item);
      if (!obj) continue;
      pushRoleAssignment(out, seen, obj.key ?? obj.role ?? obj.id, obj.focus ?? obj.weight ?? obj.scale, obj.label ?? obj.name);
    }
    return out.sort((a, b) => b.focus - a.focus || a.key.localeCompare(b.key));
  }

  const obj = asObject(raw);
  if (!obj) return out;
  for (const [key, value] of Object.entries(obj as MemberRoleMapInput)) {
    if (key === "key" || key === "role" || key === "focus" || key === "weight" || key === "scale" || key === "label") {
      continue;
    }
    pushRoleAssignment(out, seen, key, value);
  }
  return out.sort((a, b) => b.focus - a.focus || a.key.localeCompare(b.key));
}

export function roleAssignmentsFromHistoryEntry(entry: Record<string, unknown>): MemberRoleAssignment[] {
  return normalizeMemberRoleAssignments(entry.roles ?? entry.member_roles ?? entry.role_assignments);
}

/** Prefer `role_history` windows when present; otherwise fall back to current `roles`. */
export function activeRoleAssignmentsFromHistoryEntry(
  entry: Record<string, unknown>,
  asOf?: string,
): MemberRoleAssignment[] {
  const day = String(asOf ?? "").split("T")[0];
  const history = Array.isArray(entry.role_history) ? entry.role_history : null;
  if (history && history.length && /^\d{4}-\d{2}-\d{2}$/.test(day)) {
    const active: MemberRoleAssignment[] = [];
    for (const raw of history) {
      if (!raw || typeof raw !== "object") continue;
      const row = raw as Record<string, unknown>;
      const key = String(row.key ?? row.role ?? "").trim();
      if (!key) continue;
      const start = String(row.start_date ?? "").split("T")[0];
      const end = String(row.end_date ?? "").split("T")[0];
      if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && start > day) continue;
      if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && end <= day) continue;
      const focus = Number(row.focus ?? 1) || 1;
      active.push({ key, focus, label: typeof row.label === "string" ? row.label : undefined });
    }
    if (active.length) {
      return active.sort((a, b) => b.focus - a.focus || a.key.localeCompare(b.key));
    }
    // Explicit empty history window → no roles at this date.
    return [];
  }
  return roleAssignmentsFromHistoryEntry(entry);
}

export function memberRoleLabel(key: string, fallbackLabel?: string): string {
  const normalized = normalizeRoleKey(key);
  if (fallbackLabel && fallbackLabel.trim()) return fallbackLabel.trim();
  const known = MEMBER_ROLE_DEFINITIONS[normalized as MemberRoleKey];
  if (known) return known.label;
  return normalized
    .split("_")
    .filter(Boolean)
    .map((part) => part[0]!.toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatRoleFocusPercent(focus: number): string {
  return `${Math.round(Math.max(0, Math.min(1, focus)) * 100)}%`;
}

export function memberRolesSummary(assignments: MemberRoleAssignment[]): string {
  if (!assignments.length) return "-";
  return assignments
    .map((role) => `${memberRoleLabel(role.key, role.label)} ${formatRoleFocusPercent(role.focus)}`)
    .join(", ");
}
