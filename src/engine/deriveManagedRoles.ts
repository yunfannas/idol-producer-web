import { normalizePersistedAttributes } from "./idolAttributes";
import { getPrimaryGroup, type GameSavePayload } from "../save/gameSaveSchema";

export type RoleBenchmarkKey = "singing" | "dancing" | "teamwork" | "content" | "streaming" | "fashion";

const ROLE_AUTO_ASSIGN_PLANS: Array<{
  role: string;
  slots: number[];
  weights: Partial<Record<RoleBenchmarkKey, number>>;
}> = [
  { role: "leader", slots: [5, 3, 1], weights: { teamwork: 1 } },
  { role: "center", slots: [5, 3], weights: { singing: 0.45, dancing: 0.45, fashion: 0.1 } },
  { role: "lead_singer", slots: [5, 4, 2], weights: { singing: 1 } },
  { role: "lead_dancer", slots: [5, 4, 2], weights: { dancing: 1 } },
  { role: "host", slots: [5, 3, 2], weights: { teamwork: 0.35, content: 0.3, streaming: 0.35 } },
  { role: "content", slots: [5, 3, 2], weights: { content: 0.75, fashion: 0.25 } },
  { role: "streaming", slots: [5, 3, 2], weights: { streaming: 0.85, teamwork: 0.15 } },
  { role: "style", slots: [5, 3, 2], weights: { fashion: 1 } },
  { role: "call_leader", slots: [5, 3], weights: { teamwork: 0.55, dancing: 0.25, streaming: 0.2 } },
];

function avg(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

export function roleBenchmarkStatScore(idol: Record<string, unknown>, key: RoleBenchmarkKey): number {
  const a = normalizePersistedAttributes(idol.attributes);
  switch (key) {
    case "singing":
      return avg([a.technical.pitch, a.technical.tone, a.technical.breath, a.technical.power]);
    case "dancing":
      return avg([a.technical.rhythm, a.technical.stage_presence, a.physical.agility, a.physical.stamina]);
    case "teamwork":
      return avg([a.mental.teamwork, a.hidden?.professionalism ?? 12, a.mental.talking]);
    case "content":
      return avg([a.mental.talking, a.mental.humor, a.mental.wit]);
    case "streaming":
      return avg([a.mental.talking, a.mental.humor, a.mental.teamwork]);
    case "fashion":
      return avg([a.mental.fashion, a.appearance.cute, a.appearance.pretty]);
    default:
      return 0;
  }
}

/** Comparative jobs from current stats. Does not rewrite attributes. */
export function deriveRosterRoleAssignments(
  members: Array<{ uid: string; idol: Record<string, unknown> }>,
): Map<string, Record<string, number>> {
  const rows = members.map((member) => ({
    ...member,
    assignedCount: 0,
    roles: {} as Record<string, number>,
  }));
  for (const plan of ROLE_AUTO_ASSIGN_PLANS) {
    const ranked = rows
      .map((member) => {
        const rawScore = (Object.keys(plan.weights) as RoleBenchmarkKey[]).reduce((sum, key) => {
          const roleNeed = Number(plan.weights[key] ?? 0);
          if (roleNeed <= 0) return sum;
          return sum + roleBenchmarkStatScore(member.idol, key) * roleNeed;
        }, 0);
        return { member, score: rawScore - member.assignedCount * 1.15 };
      })
      .sort((a, b) => b.score - a.score || a.member.uid.localeCompare(b.member.uid));
    plan.slots.forEach((scale, index) => {
      const pick = ranked[index]?.member;
      if (!pick) return;
      pick.roles[plan.role] = Math.max(0, Math.min(1, scale / 5));
      pick.assignedCount += 1;
    });
  }
  return new Map(rows.map((row) => [row.uid, row.roles]));
}

/** Weekly side-track from the strongest extra skill. Sing/dance stay on the training sliders. */
export function inferTrainingFocusSkill(idol: Record<string, unknown>): string {
  const a = normalizePersistedAttributes(idol.attributes);
  const options: Array<[string, number]> = [
    ["talking", a.mental.talking],
    ["host", avg([a.mental.talking, a.mental.wit])],
    ["variety", a.mental.humor],
    ["acting", avg([a.mental.talking, a.mental.wit, a.mental.creativity])],
    ["make-up", avg([a.mental.fashion, a.appearance.pretty])],
    ["model", avg([a.mental.fashion, a.appearance.cute, a.appearance.pretty])],
  ];
  options.sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0]));
  return options[0]?.[0] ?? "talking";
}

export function writeDerivedRolesOntoEntries(
  members: Array<{ uid: string; idol: Record<string, unknown>; entry: Record<string, unknown> }>,
): void {
  const derived = deriveRosterRoleAssignments(members);
  for (const member of members) {
    const roles = derived.get(member.uid);
    if (roles && Object.keys(roles).length) member.entry.roles = roles;
    else delete member.entry.roles;
  }
}

function membershipMatchesGroup(
  entry: Record<string, unknown>,
  groupUid: string,
  groupNames: Set<string>,
): boolean {
  const uid = String(entry.group_uid ?? "").trim();
  const name = String(entry.group_name ?? "").trim();
  return uid === groupUid || Boolean(name && groupNames.has(name));
}

function membershipActiveOn(entry: Record<string, unknown>, asOf: string): boolean {
  const start = String(entry.start_date ?? "").split("T")[0];
  const end = String(entry.end_date ?? "").split("T")[0];
  if (start && /^\d{4}-\d{2}-\d{2}$/.test(start) && asOf && start > asOf) return false;
  if (end && /^\d{4}-\d{2}-\d{2}$/.test(end) && asOf && end <= asOf) return false;
  return true;
}

export function syncManagedRosterRolesFromStrengths(save: GameSavePayload, asOf = ""): void {
  const group = getPrimaryGroup(save);
  if (!group) return;
  if (!save.training_focus_skill || typeof save.training_focus_skill !== "object") {
    save.training_focus_skill = {};
  }
  const groupUid = String(group.uid ?? "").trim();
  const groupNames = new Set(
    [String(group.name ?? "").trim(), String(group.name_romanji ?? "").trim()].filter(Boolean),
  );
  const memberUids = Array.isArray(group.member_uids) && group.member_uids.length
    ? group.member_uids.map((uid) => String(uid))
    : Array.isArray(save.shortlist)
      ? save.shortlist.map((uid) => String(uid))
      : [];
  const members = [];
  for (const uid of memberUids) {
    const idol = save.database_snapshot.idols.find((row) => String((row as { uid?: unknown }).uid ?? "") === uid) as
      | Record<string, unknown>
      | undefined;
    if (!idol) continue;
    save.training_focus_skill[uid] = inferTrainingFocusSkill(idol);
    const history = Array.isArray(idol.group_history) ? idol.group_history : [];
    const matches = history.filter(
      (raw): raw is Record<string, unknown> =>
        Boolean(raw && typeof raw === "object") && membershipMatchesGroup(raw as Record<string, unknown>, groupUid, groupNames),
    );
    const active = matches.find((entry) => membershipActiveOn(entry, asOf)) ?? matches[0];
    if (!active) continue;
    members.push({ uid, idol, entry: active });
  }
  writeDerivedRolesOntoEntries(members);
}