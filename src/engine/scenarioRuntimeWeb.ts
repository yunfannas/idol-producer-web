import { addNotification } from "../save/inbox";
import type { GameSavePayload } from "../save/gameSaveSchema";
import { getPrimaryGroup } from "../save/gameSaveSchema";
import {
  applyCareerKeepForLeaveEvent,
  applyCareerReleaseForLeaveEvent,
  careerLeaveDecisionForEvent,
} from "./careerDecision";
import {
  applyScandalHandlingChoice,
  applyPostSuspensionLeaveChoice,
  autoApplyHistoricalScandalHandling,
  buildScandalChoiceOptions,
  buildScandalEvalContext,
  entryHasScandalBeforeLeave,
  evaluateScandalHandlingOptions,
  inferPostSuspensionLeaveHandling,
  findScandalHandlingForEvent,
  scandalScoreFromDetail,
  type ScandalAction,
} from "./scandalHandling";
import { primaryAgencyName } from "./agencyProfile";
import {
  adjustGroupReputation,
  hasProperSendoffLive,
  isCoreMember,
  reputationDeltaForDeparture,
} from "./reputationModel";

/**
 * Move group reputation when a member actually leaves.
 * A proper sendoff (special live near the leave) lifts brand; a core member
 * walking out with no recognition — or a scandal exit — pulls it down.
 */
function applyDepartureReputation(
  save: GameSavePayload,
  event: Record<string, unknown>,
  leaveDay: string,
  scandalLinked: boolean,
  isGraduation: boolean,
): void {
  const group = getPrimaryGroup(save);
  if (!group) return;
  const idolUid = String(event.idol_uid ?? "").trim();
  const idols = save.database_snapshot.idols as Record<string, unknown>[];
  const idol = idols.find((row) => String(row.uid ?? "") === idolUid) ?? null;

  const groupUid = String(group.uid ?? "").trim();
  let hasLeaderRole = false;
  if (idol) {
    const history = Array.isArray(idol.group_history) ? (idol.group_history as Record<string, unknown>[]) : [];
    const stint = history.find((h) => String(h.group_uid ?? "").trim() === groupUid);
    const roles = Array.isArray(stint?.roles) ? (stint!.roles as Record<string, unknown>[]) : [];
    hasLeaderRole = roles.some((r) => {
      const key = String(r.key ?? "").toLowerCase();
      return key === "leader" || key === "captain" || key === "center";
    });
  }

  const schedules = Array.isArray(save.lives?.schedules)
    ? (save.lives.schedules as Record<string, unknown>[])
    : [];
  const recognized = !scandalLinked && hasProperSendoffLive(schedules, leaveDay);
  const core = isCoreMember(group, idol, idols, hasLeaderRole);

  const delta = reputationDeltaForDeparture({ isCore: core, recognized, isGraduation });
  const reason = recognized
    ? `departure:sendoff${core ? ":core" : ""}`
    : scandalLinked
      ? `departure:scandal${core ? ":core" : ""}`
      : `departure:unrecognized${core ? ":core" : ""}`;
  adjustGroupReputation(group as Record<string, unknown>, delta, reason, leaveDay);
}

function parseIsoDate(value: unknown): string | null {
  const text = String(value ?? "").split("T")[0].trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function compareIsoDate(a: string, b: string): number {
  return a.localeCompare(b);
}

function addUtcDays(isoDate: string, days: number): string {
  const dt = new Date(`${isoDate}T12:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function isMondayUtc(isoDate: string): boolean {
  return new Date(`${isoDate}T12:00:00Z`).getUTCDay() === 1;
}

function deepCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function eventUid(
  eventType: string,
  effectiveDate: string,
  params: {
    idolUid?: string;
    groupUid?: string;
    groupName?: string;
    startDate?: string;
    endDate?: string;
    detailKey?: string;
  } = {},
): string {
  const seed = [
    eventType,
    effectiveDate,
    params.idolUid ?? "",
    params.groupUid ?? "",
    params.groupName ?? "",
    params.startDate ?? "",
    params.endDate ?? "",
    params.detailKey ?? "",
  ].join("|");
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return `evt-${(h >>> 0).toString(16).padStart(8, "0")}`;
}

function detailKey(detail: Record<string, unknown> | null | undefined): string {
  if (!detail) return "";
  return [
    String(detail.kind ?? ""),
    String(detail.start_date ?? ""),
    String(detail.member_color ?? ""),
    String(detail.summary_ja ?? detail.summary ?? ""),
  ].join("|");
}

function buildEvent(
  eventType: string,
  effectiveDate: string,
  params: {
    idolRow?: Record<string, unknown> | null;
    groupRow?: Record<string, unknown> | null;
    entry?: Record<string, unknown> | null;
    detail?: Record<string, unknown> | null;
    scandalBeforeLeave?: boolean;
  } = {},
): Record<string, unknown> {
  const idolUid = String(params.idolRow?.uid ?? "");
  const groupUid = String(params.groupRow?.uid ?? params.entry?.group_uid ?? "");
  const groupName = String(params.groupRow?.name ?? params.entry?.group_name ?? "");
  const startDate = String(params.entry?.start_date ?? "");
  const endDate = String(params.entry?.end_date ?? "");
  return {
    uid: eventUid(eventType, effectiveDate, {
      idolUid,
      groupUid,
      groupName,
      startDate,
      endDate,
      detailKey: detailKey(params.detail),
    }),
    type: eventType,
    effective_date: effectiveDate,
    idol_uid: idolUid,
    idol_name: String(params.idolRow?.name ?? ""),
    group_uid: groupUid,
    group_name: groupName,
    entry: params.entry ? deepCopy(params.entry) : null,
    group_row: params.groupRow ? deepCopy(params.groupRow) : null,
    detail: params.detail ? deepCopy(params.detail) : null,
    scandal_before_leave: Boolean(params.scandalBeforeLeave),
  };
}

function historyEntryMatches(existing: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  const existingGroupUid = String(existing.group_uid ?? "");
  const incomingGroupUid = String(incoming.group_uid ?? "");
  if (existingGroupUid && incomingGroupUid && existingGroupUid !== incomingGroupUid) return false;
  if (!existingGroupUid && !incomingGroupUid && String(existing.group_name ?? "") !== String(incoming.group_name ?? "")) {
    return false;
  }
  return (
    String(existing.start_date ?? "") === String(incoming.start_date ?? "") &&
    String(existing.member_name ?? "") === String(incoming.member_name ?? "")
  );
}

function statusMatches(existing: Record<string, unknown>, incoming: Record<string, unknown>): boolean {
  return (
    String(existing.kind ?? "") === String(incoming.kind ?? "") &&
    String(existing.start_date ?? "") === String(incoming.start_date ?? "") &&
    String(existing.summary_ja ?? existing.summary ?? "") ===
      String(incoming.summary_ja ?? incoming.summary ?? "")
  );
}

function groupMatches(row: Record<string, unknown>, event: Record<string, unknown>): boolean {
  const groupUid = String(event.group_uid ?? "");
  const groupName = String(event.group_name ?? "");
  return (Boolean(groupUid) && String(row.uid ?? "") === groupUid) || (Boolean(groupName) && String(row.name ?? "") === groupName);
}

function filterEntryTimeline(
  entry: Record<string, unknown>,
  idolRow: Record<string, unknown>,
  visibleAsOf: string,
  futureEvents: Record<string, unknown>[],
): void {
  const filteredStatuses: Record<string, unknown>[] = [];
  const statusHistory = Array.isArray(entry.status_history) ? entry.status_history : [];
  for (const rawStatus of statusHistory) {
    if (!rawStatus || typeof rawStatus !== "object") continue;
    const status = deepCopy(rawStatus as Record<string, unknown>);
    const statusDate = parseIsoDate(status.start_date);
    if (statusDate && compareIsoDate(statusDate, visibleAsOf) > 0) {
      if (String(status.kind ?? "") === "scandal") {
        futureEvents.push(buildEvent("idol_status_update", statusDate, { idolRow, entry, detail: status }));
      }
      continue;
    }
    filteredStatuses.push(status);
  }
  if (filteredStatuses.length) entry.status_history = filteredStatuses;
  else delete entry.status_history;

  const filteredColors: Record<string, unknown>[] = [];
  const colorHistory = Array.isArray(entry.member_color_history) ? entry.member_color_history : [];
  for (const rawChange of colorHistory) {
    if (!rawChange || typeof rawChange !== "object") continue;
    const change = deepCopy(rawChange as Record<string, unknown>);
    const changeDate = parseIsoDate(change.start_date);
    if (changeDate && compareIsoDate(changeDate, visibleAsOf) > 0) continue;
    filteredColors.push(change);
  }
  if (filteredColors.length) entry.member_color_history = filteredColors;
  else delete entry.member_color_history;
}

export function buildFilteredSnapshotWithFutureEvents(
  idolsRows: Record<string, unknown>[],
  groupsRows: Record<string, unknown>[],
  asOf: string,
): {
  idols: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  futureEvents: Record<string, unknown>[];
} {
  const filteredGroups: Record<string, unknown>[] = [];
  const filteredIdols: Record<string, unknown>[] = [];
  const futureEvents: Record<string, unknown>[] = [];

  for (const rawGroup of groupsRows) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const groupRow = deepCopy(rawGroup);
    const formedDate = parseIsoDate(groupRow.formed_date);
    const endedDate = parseIsoDate(groupRow.ended_date);
    if (formedDate && compareIsoDate(formedDate, asOf) > 0) {
      futureEvents.push(buildEvent("group_formed", formedDate, { groupRow }));
      if (endedDate && compareIsoDate(endedDate, formedDate) > 0) {
        futureEvents.push(buildEvent("group_disbanded", endedDate, { groupRow }));
      }
      continue;
    }
    if (endedDate && compareIsoDate(endedDate, asOf) > 0) {
      futureEvents.push(buildEvent("group_disbanded", endedDate, { groupRow }));
      groupRow.ended_date = null;
    }
    filteredGroups.push(groupRow);
  }

  for (const rawIdol of idolsRows) {
    if (!rawIdol || typeof rawIdol !== "object") continue;
    const idolRow = deepCopy(rawIdol);
    const filteredHistory: Record<string, unknown>[] = [];
    const history = Array.isArray(idolRow.group_history) ? idolRow.group_history : [];
    for (const rawEntry of history) {
      if (!rawEntry || typeof rawEntry !== "object") continue;
      const entry = deepCopy(rawEntry as Record<string, unknown>);
      const startDate = parseIsoDate(entry.start_date);
      const endDate = parseIsoDate(entry.end_date);

      if (startDate && compareIsoDate(startDate, asOf) > 0) {
        const joinEntry = deepCopy(entry);
        filterEntryTimeline(joinEntry, idolRow, startDate, futureEvents);
        if (endDate && compareIsoDate(endDate, startDate) > 0) {
          const scandalBefore = entryHasScandalBeforeLeave(entry, endDate, startDate);
          futureEvents.push(
            buildEvent("idol_leave_group", endDate, {
              idolRow,
              entry,
              scandalBeforeLeave: scandalBefore,
            }),
          );
          joinEntry.end_date = null;
        }
        futureEvents.push(buildEvent("idol_join_group", startDate, { idolRow, entry: joinEntry }));
        continue;
      }

      filterEntryTimeline(entry, idolRow, asOf, futureEvents);
      if (endDate && compareIsoDate(endDate, asOf) > 0) {
        // Include scandals that already happened before the scenario opening
        // (e.g. 春野莉々 suspended May 2025, leave Jul 31 with opening Jul 5).
        const scandalBefore = entryHasScandalBeforeLeave(
          rawEntry as Record<string, unknown>,
          endDate,
          parseIsoDate(entry.start_date) || "0000-01-01",
        );
        futureEvents.push(
          buildEvent("idol_leave_group", endDate, {
            idolRow,
            entry,
            scandalBeforeLeave: scandalBefore,
          }),
        );
        entry.end_date = null;
      }
      filteredHistory.push(entry);
    }
    idolRow.group_history = filteredHistory;
    filteredIdols.push(idolRow);
  }

  const deduped = new Map<string, Record<string, unknown>>();
  for (const event of futureEvents) {
    const uid = String(event.uid ?? "");
    if (uid) deduped.set(uid, event);
  }
  const events = [...deduped.values()].sort((a, b) => {
    const d = String(a.effective_date ?? "").localeCompare(String(b.effective_date ?? ""));
    if (d !== 0) return d;
    const t = String(a.type ?? "").localeCompare(String(b.type ?? ""));
    if (t !== 0) return t;
    return String(a.uid ?? "").localeCompare(String(b.uid ?? ""));
  });

  return { idols: filteredIdols, groups: filteredGroups, futureEvents: events };
}

function ensureMemberMembership(
  groupRow: Record<string, unknown>,
  idolRow: Record<string, unknown>,
  event: Record<string, unknown>,
): void {
  const idolUid = String(idolRow.uid ?? event.idol_uid ?? "");
  const displayName = String(idolRow.name ?? event.idol_name ?? "");
  const memberUids = Array.isArray(groupRow.member_uids) ? groupRow.member_uids.map((x) => String(x)) : [];
  const memberNames = Array.isArray(groupRow.member_names) ? groupRow.member_names.map((x) => String(x)) : [];
  const pastUids = Array.isArray(groupRow.past_member_uids) ? groupRow.past_member_uids.map((x) => String(x)) : [];
  const pastNames = Array.isArray(groupRow.past_member_names) ? groupRow.past_member_names.map((x) => String(x)) : [];
  const livePairs = memberUids.map((uid, i) => ({ uid, name: memberNames[i] ?? uid })).filter((row) => row.uid !== idolUid);
  const pastPairs = pastUids.map((uid, i) => ({ uid, name: pastNames[i] ?? uid })).filter((row) => row.uid !== idolUid);
  livePairs.push({ uid: idolUid, name: displayName });
  groupRow.member_uids = livePairs.map((row) => row.uid);
  groupRow.member_names = livePairs.map((row) => row.name);
  groupRow.past_member_uids = pastPairs.map((row) => row.uid);
  groupRow.past_member_names = pastPairs.map((row) => row.name);
  groupRow.member_count = livePairs.length;
  groupRow.past_member_count = pastPairs.length;
}

function ensurePastMemberMembership(
  groupRow: Record<string, unknown>,
  idolRow: Record<string, unknown>,
  event: Record<string, unknown>,
): void {
  const idolUid = String(idolRow.uid ?? event.idol_uid ?? "");
  const displayName = String(idolRow.name ?? event.idol_name ?? "");
  const memberUids = Array.isArray(groupRow.member_uids) ? groupRow.member_uids.map((x) => String(x)) : [];
  const memberNames = Array.isArray(groupRow.member_names) ? groupRow.member_names.map((x) => String(x)) : [];
  const pastUids = Array.isArray(groupRow.past_member_uids) ? groupRow.past_member_uids.map((x) => String(x)) : [];
  const pastNames = Array.isArray(groupRow.past_member_names) ? groupRow.past_member_names.map((x) => String(x)) : [];
  const livePairs = memberUids.map((uid, i) => ({ uid, name: memberNames[i] ?? uid })).filter((row) => row.uid !== idolUid);
  const pastPairs = pastUids.map((uid, i) => ({ uid, name: pastNames[i] ?? uid })).filter((row) => row.uid !== idolUid);
  pastPairs.push({ uid: idolUid, name: displayName });
  groupRow.member_uids = livePairs.map((row) => row.uid);
  groupRow.member_names = livePairs.map((row) => row.name);
  groupRow.past_member_uids = pastPairs.map((row) => row.uid);
  groupRow.past_member_names = pastPairs.map((row) => row.name);
  groupRow.member_count = livePairs.length;
  groupRow.past_member_count = pastPairs.length;
}

export function applyDueFutureEvents(
  idolsRows: Record<string, unknown>[],
  groupsRows: Record<string, unknown>[],
  futureEvents: Record<string, unknown>[],
  asOf: string,
): {
  idols: Record<string, unknown>[];
  groups: Record<string, unknown>[];
  pending: Record<string, unknown>[];
  applied: Record<string, unknown>[];
} {
  const idols = deepCopy(idolsRows);
  const groups = deepCopy(groupsRows);
  const pending: Record<string, unknown>[] = [];
  const applied: Record<string, unknown>[] = [];
  const idolsByUid = new Map(idols.map((row) => [String(row.uid ?? ""), row]));

  const sortedEvents = [...futureEvents]
    .filter((event): event is Record<string, unknown> => Boolean(event && typeof event === "object"))
    .sort((a, b) => {
      const d = String(a.effective_date ?? "").localeCompare(String(b.effective_date ?? ""));
      if (d !== 0) return d;
      return String(a.uid ?? "").localeCompare(String(b.uid ?? ""));
    });

  const findGroup = (event: Record<string, unknown>) =>
    groups.find((row) => row && typeof row === "object" && groupMatches(row, event)) ?? null;

  for (const event of sortedEvents) {
    const effectiveDate = parseIsoDate(event.effective_date);
    if (!effectiveDate || compareIsoDate(effectiveDate, asOf) > 0) {
      pending.push(deepCopy(event));
      continue;
    }
    const eventType = String(event.type ?? "");
    if (eventType === "group_formed") {
      if (!findGroup(event) && event.group_row && typeof event.group_row === "object") {
        groups.push(deepCopy(event.group_row as Record<string, unknown>));
      }
      applied.push(deepCopy(event));
      continue;
    }
    if (eventType === "group_disbanded") {
      const targetGroup = findGroup(event);
      if (targetGroup && event.group_row && typeof event.group_row === "object") {
        targetGroup.ended_date = (event.group_row as Record<string, unknown>).ended_date ?? targetGroup.ended_date;
      }
      applied.push(deepCopy(event));
      continue;
    }
    const idolUid = String(event.idol_uid ?? "");
    const idolRow = idolsByUid.get(idolUid);
    const entry = event.entry && typeof event.entry === "object" ? (event.entry as Record<string, unknown>) : null;
    if (!idolRow || !entry) {
      applied.push(deepCopy(event));
      continue;
    }
    const history = Array.isArray(idolRow.group_history)
      ? (idolRow.group_history as Record<string, unknown>[])
      : [];
    idolRow.group_history = history;

    if (eventType === "idol_join_group") {
      if (!history.some((existing) => historyEntryMatches(existing, entry))) {
        history.push(deepCopy(entry));
        history.sort((a, b) => String(a.start_date ?? "").localeCompare(String(b.start_date ?? "")));
      }
      const targetGroup = findGroup(event);
      if (targetGroup) ensureMemberMembership(targetGroup, idolRow, event);
      applied.push(deepCopy(event));
      continue;
    }
    if (eventType === "idol_status_update") {
      const detail = event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
      if (detail) {
        const targetEntry = history.find((existing) => historyEntryMatches(existing, entry));
        if (targetEntry) {
          const statusHistory = Array.isArray(targetEntry.status_history)
            ? (targetEntry.status_history as Record<string, unknown>[])
            : [];
          if (!statusHistory.some((existing) => statusMatches(existing, detail))) {
            statusHistory.push(deepCopy(detail));
            targetEntry.status_history = statusHistory;
          }
        }
      }
      applied.push(deepCopy(event));
      continue;
    }
    if (eventType === "idol_leave_group") {
      for (const existing of history) {
        if (historyEntryMatches(existing, entry)) {
          existing.end_date = entry.end_date;
          break;
        }
      }
      const targetGroup = findGroup(event);
      if (targetGroup) ensurePastMemberMembership(targetGroup, idolRow, event);
      applied.push(deepCopy(event));
      continue;
    }
    pending.push(deepCopy(event));
  }

  return { idols, groups, pending, applied };
}

export function describeAppliedEvent(event: Record<string, unknown>): { title: string; body: string } {
  const idolName = String(event.idol_name ?? "A member").trim();
  const groupName = String(event.group_name ?? "a group").trim();
  const eventType = String(event.type ?? "");
  if (eventType === "group_formed") {
    return { title: `Group formed: ${groupName}`, body: `${groupName} has officially started activities.` };
  }
  if (eventType === "group_disbanded") {
    return { title: `Group disbanded: ${groupName}`, body: `${groupName} has ended activities.` };
  }
  if (eventType === "idol_join_group") {
    return { title: `Member joined: ${idolName}`, body: `${idolName} joined ${groupName}.` };
  }
  if (eventType === "idol_leave_group") {
    return { title: `Member left: ${idolName}`, body: `${idolName} left ${groupName}.` };
  }
  if (eventType === "idol_status_update") {
    const detail = event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : {};
    const kind = String(detail.kind ?? "");
    const summary = String(detail.summary_ja ?? detail.summary ?? "").trim();
    if (kind === "scandal") {
      return { title: `Scandal revealed: ${idolName}`, body: summary || `A scandal involving ${idolName} has become public.` };
    }
    return {
      title: `Member update: ${idolName}`,
      body: summary || `A scheduled update was recorded for ${idolName} in ${groupName}.`,
    };
  }
  return { title: "Scenario update", body: `A scheduled scenario event was applied for ${groupName}.` };
}

function buildWeeklyScenarioNewsSummary(
  save: GameSavePayload,
  mondayIso: string,
): { title: string; body: string; reportData: Record<string, unknown> } | null {
  const windowStart = addUtcDays(mondayIso, -6);
  const formedRows: Array<{ date: string; group: string; groupUid: string }> = [];
  const joinRows: Array<{ date: string; idol: string; idolUid: string; group: string; groupUid: string }> = [];
  const leftRows: Array<{ date: string; idol: string; idolUid: string; group: string; groupUid: string }> = [];
  for (const rawGroup of save.database_snapshot.groups) {
    if (!rawGroup || typeof rawGroup !== "object") continue;
    const group = rawGroup as Record<string, unknown>;
    const formedDate = parseIsoDate(group.formed_date);
    if (!formedDate) continue;
    if (compareIsoDate(formedDate, windowStart) < 0 || compareIsoDate(formedDate, mondayIso) > 0) continue;
    const groupName = String(group.name ?? group.name_romanji ?? group.uid ?? "a group").trim() || "a group";
    formedRows.push({ date: formedDate, group: groupName, groupUid: String(group.uid ?? "").trim() });
  }
  for (const rawIdol of save.database_snapshot.idols) {
    if (!rawIdol || typeof rawIdol !== "object") continue;
    const idol = rawIdol as Record<string, unknown>;
    const idolName = String(idol.name ?? "Member").trim() || "Member";
    const idolUid = String(idol.uid ?? "").trim();
    const history = Array.isArray(idol.group_history) ? idol.group_history : [];
    for (const rawEntry of history) {
      if (!rawEntry || typeof rawEntry !== "object") continue;
      const entry = rawEntry as Record<string, unknown>;
      const startDate = parseIsoDate(entry.start_date);
      const endDate = parseIsoDate(entry.end_date);
      const groupName = String(entry.group_name ?? entry.group_uid ?? "a group").trim() || "a group";
      const groupUid = String(entry.group_uid ?? "").trim();
      if (startDate && compareIsoDate(startDate, windowStart) >= 0 && compareIsoDate(startDate, mondayIso) <= 0) {
        joinRows.push({ date: startDate, idol: idolName, idolUid, group: groupName, groupUid });
      }
      if (endDate && compareIsoDate(endDate, windowStart) >= 0 && compareIsoDate(endDate, mondayIso) <= 0) {
        leftRows.push({ date: endDate, idol: idolName, idolUid, group: groupName, groupUid });
      }
    }
  }
  if (!formedRows.length && !joinRows.length && !leftRows.length) return null;
  formedRows.sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group));
  joinRows.sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group) || a.idol.localeCompare(b.idol));
  leftRows.sort((a, b) => a.date.localeCompare(b.date) || a.group.localeCompare(b.group) || a.idol.localeCompare(b.idol));
  const sections: string[] = [];
  if (formedRows.length) {
    sections.push(
      `New groups:\n${formedRows.map((row) => `- ${row.date}: ${row.group} formed.`).join("\n")}`,
    );
  }
  if (joinRows.length) {
    sections.push(
      `Member joins:\n${joinRows.map((row) => `- ${row.date}: ${row.idol} joined ${row.group}.`).join("\n")}`,
    );
  }
  if (leftRows.length) {
    sections.push(
      `Member departures:\n${leftRows.map((row) => `- ${row.date}: ${row.idol} left ${row.group}.`).join("\n")}`,
    );
  }
  return {
    title: "Weekly news roundup",
    body: `News recorded from ${windowStart} to ${mondayIso}:\n\n${sections.join("\n\n")}`,
    reportData: {
      kind: "weekly_news_roundup",
      window_start: windowStart,
      window_end: mondayIso,
      formed_rows: formedRows,
      join_rows: joinRows,
      left_rows: leftRows,
    },
  };
}

function scenarioEventTargetsManagedGroup(save: GameSavePayload, event: Record<string, unknown>): boolean {
  const group = getPrimaryGroup(save);
  if (!group) return false;
  const eventUid = String(event.group_uid ?? "").trim();
  const playerUid = String(group.uid ?? "").trim();
  if (eventUid) return eventUid === playerUid;
  const eventName = String(event.group_name ?? "").trim();
  const playerName = String(group.name ?? save.managing_group ?? "").trim();
  return Boolean(eventName) && eventName === playerName;
}

function findNotificationByDedupeKey(save: GameSavePayload, dedupeKey: string) {
  return save.inbox.notifications.find((row) => row.dedupe_key === dedupeKey) ?? null;
}

/**
 * Gate scheduled managed-group departures behind an inbox decision
 * (desktop `_resolve_managed_group_leave_choices`).
 *
 * Initiation opens 5 weeks before the historical leave date; the leave
 * itself still only applies on/after that date once the player chooses.
 */
export function resolveManagedGroupLeaveChoices(
  save: GameSavePayload,
  currentIso: string,
): { chosen: Record<string, unknown>[]; deferred: Record<string, unknown>[]; changed: boolean } {
  const DEPARTURE_DECISION_LEAD_DAYS = 35; // 5 weeks
  const queue = Array.isArray(save.scenario_runtime?.future_events) ? save.scenario_runtime.future_events : [];
  if (!queue.length || !getPrimaryGroup(save)) {
    return { chosen: queue.map((row) => deepCopy(row as Record<string, unknown>)), deferred: [], changed: false };
  }

  const day = parseIsoDate(currentIso) ?? String(currentIso).split("T")[0];
  const keptEvents: Record<string, unknown>[] = [];
  const deferredEvents: Record<string, unknown>[] = [];
  const suppressedUids = new Set<string>();
  let changed = false;

  for (const raw of queue) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as Record<string, unknown>;
    const eventType = String(event.type ?? "");
    const effectiveDate = parseIsoDate(event.effective_date);
    if (eventType !== "idol_leave_group" || !effectiveDate || !scenarioEventTargetsManagedGroup(save, event)) {
      keptEvents.push(deepCopy(event));
      continue;
    }

    const postSuspendEarly = inferPostSuspensionLeaveHandling(save, event);
    const leadForOpen = Math.max(
      1,
      Number(postSuspendEarly?.followOn.decision_lead_days ?? DEPARTURE_DECISION_LEAD_DAYS) ||
        DEPARTURE_DECISION_LEAD_DAYS,
    );
    const decisionOpenDate = addUtcDays(effectiveDate, -leadForOpen);
    // Too early: leave the event untouched until the decision window.
    if (compareIsoDate(day, decisionOpenDate) < 0) {
      keptEvents.push(deepCopy(event));
      continue;
    }

    const leaveDue = compareIsoDate(effectiveDate, day) <= 0;
    const idolName = String(event.idol_name ?? "This member").trim() || "This member";
    const groupName =
      String(event.group_name ?? getPrimaryGroup(save)?.name ?? "the group").trim() || "the group";
    const eventUid = String(event.uid ?? "");
    const dedupeKey = `scenario-leave-choice|${eventUid}`;
    const career = careerLeaveDecisionForEvent(save, event);
    const entry = event.entry && typeof event.entry === "object" ? (event.entry as Record<string, unknown>) : null;
    const postSuspend = postSuspendEarly;
    const scandalLinked =
      !postSuspend &&
      (Boolean(event.scandal_before_leave) ||
        (entry ? entryHasScandalBeforeLeave(entry, effectiveDate, decisionOpenDate) : false));
    // Scandal-driven exits are owned by Scandal handling — unless this is a
    // post-indefinite-suspension leave (春野莉々), which is a major player decision.
    let negotiable = career ? Boolean(career.negotiable) : true;
    if (scandalLinked) negotiable = false;
    if (postSuspend) negotiable = true;
    const postDecisionOpen = decisionOpenDate;
    const existingNotice = findNotificationByDedupeKey(save, dedupeKey);

    if (!existingNotice) {
      if (scandalLinked && !leaveDue) {
        deferredEvents.push(deepCopy(event));
        continue;
      }
      if (scandalLinked && leaveDue) {
        keptEvents.push(deepCopy(event));
        continue;
      }
      if (postSuspend) {
        const scandalDate = postSuspend.catalog.scandal_date;
        const followNote =
          postSuspend.followOn.note ||
          postSuspend.catalog.note ||
          "She has been on indefinite suspension with no return date set.";
        const options = (postSuspend.followOn.options?.length
          ? postSuspend.followOn.options
          : [
              { value: "let_go", label: "Accept her leave (historical)" },
              { value: "keep_suspended", label: "Keep under indefinite suspension" },
              { value: "reinstate_with_penalty", label: "Reinstate with heavy penalty" },
              { value: "terminate_now", label: "Terminate now" },
            ]
        ).map((o) => ({ ...o }));
        addNotification(save, {
          title: `Suspended member decision: ${idolName}`,
          body:
            `${idolName} has been on indefinite activity suspension since ${scandalDate} after a scandal.\n` +
            `No return date was set. She intends to leave ${groupName} on ${effectiveDate} before reinstatement.\n\n` +
            `${followNote}\n\n` +
            `This is a major roster decision — historical path is accepting the leave.`,
          sender: "Management",
          category: "decision",
          level: "critical",
          isoDate: day,
          unread: true,
          requiresConfirmation: true,
          dedupeKey,
          relatedEventUid: eventUid,
          choiceKind: "managed_group_leave",
          choiceStatus: "pending",
          choiceOptions: options,
          reportData: {
            kind: "managed_group_leave",
            subtype: "post_suspension_leave",
            event_uid: eventUid,
            idol_uid: String(event.idol_uid ?? ""),
            idol_name: idolName,
            group_name: groupName,
            effective_date: effectiveDate,
            decision_open_date: postDecisionOpen,
            scandal_date: scandalDate,
            negotiable: true,
            decision_id: postSuspend.catalog.id,
            historical_action: postSuspend.followOn.historical_action ?? "let_go",
            handling_id: postSuspend.catalog.id,
          },
        });
        changed = true;
        deferredEvents.push(deepCopy(event));
        continue;
      }
      const destinationLine =
        career?.kind === "outbound_transfer" && career.destination
          ? `\nHistorical destination: ${career.destination.group_name}` +
            (career.destination.join_date ? ` on ${career.destination.join_date}` : "") +
            "."
          : "";
      const lockedLine =
        career?.kind === "graduation" || !negotiable
          ? `\n${career?.lock_reason ?? "This departure is locked and cannot be cancelled."}`
          : "";
      const body = negotiable
        ? `${idolName} is scheduled to leave ${groupName} on ${effectiveDate}. Decide whether to keep her in the group or allow the departure.${destinationLine}`
        : `${idolName} is scheduled to leave ${groupName} on ${effectiveDate}.${lockedLine}`;
      addNotification(save, {
        title: `Departure decision: ${idolName}`,
        body,
        sender: "Management",
        category: "decision",
        level: "critical",
        isoDate: day,
        unread: true,
        requiresConfirmation: true,
        dedupeKey,
        relatedEventUid: eventUid,
        choiceKind: "managed_group_leave",
        choiceStatus: "pending",
        choiceOptions: negotiable
          ? [
              { value: "keep", label: "Keep in group" },
              { value: "let_go", label: "Allow leave" },
            ]
          : [{ value: "let_go", label: "Acknowledge departure" }],
        reportData: {
          kind: "managed_group_leave",
          event_uid: eventUid,
          idol_uid: String(event.idol_uid ?? ""),
          idol_name: idolName,
          group_name: groupName,
          effective_date: effectiveDate,
          decision_open_date: decisionOpenDate,
          negotiable,
          decision_id: career?.id ?? "",
          destination_group_name: career?.destination?.group_name ?? "",
          retain_salary_bump_yen: career?.retain?.salary_bump_yen ?? 0,
        },
      });
      changed = true;
      deferredEvents.push(deepCopy(event));
      continue;
    }

    const choiceStatus = String(existingNotice.choice_status || "pending");
    const report =
      existingNotice.report_data && typeof existingNotice.report_data === "object"
        ? (existingNotice.report_data as Record<string, unknown>)
        : null;
    const isPostSuspend = String(report?.subtype ?? "") === "post_suspension_leave" || Boolean(postSuspend);

    if (isPostSuspend && ["keep_suspended", "reinstate_with_penalty", "terminate_now"].includes(choiceStatus)) {
      const applied = applyPostSuspensionLeaveChoice(save, event, choiceStatus, day);
      for (const uid of applied.suppressedUids) suppressedUids.add(uid);
      addNotification(save, {
        title: `Suspended member response: ${idolName}`,
        body: applied.summary,
        sender: "Management",
        category: "internal",
        level: "critical",
        isoDate: day,
        unread: true,
        dedupeKey: `scenario-post-suspend|${eventUid}|${choiceStatus}`,
        reportData: {
          kind: "managed_post_suspension_result",
          event_uid: eventUid,
          idol_uid: String(event.idol_uid ?? ""),
          idol_name: idolName,
          action: choiceStatus,
        },
      });
      changed = true;
      continue;
    }

    if (choiceStatus === "keep") {
      if (!negotiable) {
        // Locked leaves cannot be kept; treat as still pending until let_go.
        deferredEvents.push(deepCopy(event));
        continue;
      }
      const { def: careerKept, suppressedUids: extraSuppressed } = applyCareerKeepForLeaveEvent(save, event, day);
      for (const uid of extraSuppressed) suppressedUids.add(uid);
      if (eventUid) suppressedUids.add(eventUid);
      const bump = Number(careerKept?.retain?.salary_bump_yen ?? 0) || 0;
      addNotification(save, {
        title: `Retention decision: ${idolName}`,
        body:
          `You chose to keep ${idolName} in ${groupName}, so the scheduled departure was cancelled.` +
          (bump > 0 ? `\nSalary increased by ¥${bump.toLocaleString("ja-JP")}/month.` : "") +
          (careerKept?.destination ? `\nHistorical transfer path suppressed.` : ""),
        sender: "Assistant",
        category: "internal",
        level: "high",
        isoDate: day,
        unread: true,
        dedupeKey: `scenario-keep|${eventUid}`,
      });
      changed = true;
      continue;
    }
    if (choiceStatus !== "let_go") {
      deferredEvents.push(deepCopy(event));
      continue;
    }

    // Allowed to leave: still wait until the historical leave date.
    if (!leaveDue) {
      deferredEvents.push(deepCopy(event));
      continue;
    }

    applyCareerReleaseForLeaveEvent(save, event, day);
    applyDepartureReputation(save, event, effectiveDate, scandalLinked, career?.kind === "graduation");
    keptEvents.push(deepCopy(event));
  }

  const filterSuppressed = (rows: Record<string, unknown>[]) =>
    rows.filter((row) => !suppressedUids.has(String(row.uid ?? "")));

  return {
    chosen: filterSuppressed(keptEvents),
    deferred: filterSuppressed(deferredEvents),
    changed,
  };
}

/**
 * Gate managed-group scandal reveals behind an inbox decision.
 * Player chooses terminate / demote / keep-with-penalty (catalog-driven when known).
 */
export function resolveManagedScandalChoices(
  save: GameSavePayload,
  currentIso: string,
  queue: Record<string, unknown>[] = Array.isArray(save.scenario_runtime?.future_events)
    ? (save.scenario_runtime.future_events as Record<string, unknown>[])
    : [],
): { chosen: Record<string, unknown>[]; deferred: Record<string, unknown>[]; changed: boolean } {
  if (!queue.length) {
    return { chosen: [], deferred: [], changed: false };
  }

  const day = parseIsoDate(currentIso) ?? String(currentIso).split("T")[0];
  const keptEvents: Record<string, unknown>[] = [];
  const deferredEvents: Record<string, unknown>[] = [];
  const suppressedUids = new Set<string>();
  let changed = false;

  for (const raw of queue) {
    if (!raw || typeof raw !== "object") continue;
    const event = raw as Record<string, unknown>;
    const eventType = String(event.type ?? "");
    const effectiveDate = parseIsoDate(event.effective_date);
    const detail =
      event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
    const isScandal =
      eventType === "idol_status_update" && String(detail?.kind ?? "").toLowerCase() === "scandal";

    if (!isScandal || !effectiveDate || !scenarioEventTargetsManagedGroup(save, event)) {
      keptEvents.push(deepCopy(event));
      continue;
    }

    // Not due yet.
    if (compareIsoDate(effectiveDate, day) > 0) {
      keptEvents.push(deepCopy(event));
      continue;
    }

    const idolName = String(event.idol_name ?? "This member").trim() || "This member";
    const groupName =
      String(event.group_name ?? getPrimaryGroup(save)?.name ?? "the group").trim() || "the group";
    const eventUid = String(event.uid ?? "");
    const dedupeKey = `scenario-scandal-choice|${eventUid}`;
    const catalogRow = findScandalHandlingForEvent(event);
    const score = scandalScoreFromDetail(detail) || Number(catalogRow?.score ?? 0) || 0;
    const summary =
      String(detail?.summary_ja ?? detail?.summary ?? catalogRow?.summary_ja ?? "").trim() ||
      `A scandal involving ${idolName} has become public.`;
    const existingNotice = findNotificationByDedupeKey(save, dedupeKey);
    const evaluations = evaluateScandalHandlingOptions(event, save, day);
    const best = evaluations[0] ?? null;
    const evalCtx = buildScandalEvalContext(event, save, day);
    const agencyLabel = primaryAgencyName(getPrimaryGroup(save) as Record<string, unknown> | null);

    if (!existingNotice) {
      const options = buildScandalChoiceOptions(event, save);
      const consequenceLines = evaluations
        .map((row) => {
          const c = row.consequences;
          const hist = row.matches_history ? " [historical]" : "";
          return `• ${row.label}${hist}: utility ${row.utility.toFixed(0)} (${row.risk}) — ${c.blurb}`;
        })
        .join("\n");
      addNotification(save, {
        title: `Scandal handling: ${idolName}`,
        body:
          `${summary}\n\nScore ${score || "—"}. Reputation ${evalCtx.groupReputation}/5` +
          (agencyLabel
            ? ` · ${agencyLabel} harshness ${evalCtx.agencyHarshness}/5`
            : ` · agency harshness ${evalCtx.agencyHarshness}/5`) +
          `. Soft keeps cost more at low reputation; firm cuts fit high-harshness offices.` +
          (best ? `\nModel leans toward: ${best.label} (utility ${best.utility.toFixed(0)}).` : "") +
          (catalogRow?.historical_action
            ? `\nHistorical response: ${catalogRow.historical_action.replaceAll("_", " ")}.`
            : "") +
          (catalogRow?.note ? `\n${catalogRow.note}` : "") +
          (consequenceLines ? `\n\nEvaluation:\n${consequenceLines}` : ""),
        sender: "Management",
        category: "decision",
        level: "critical",
        isoDate: day,
        unread: true,
        requiresConfirmation: true,
        dedupeKey,
        relatedEventUid: eventUid,
        choiceKind: "managed_scandal_handling",
        choiceStatus: "pending",
        choiceOptions: options,
        reportData: {
          kind: "managed_scandal_handling",
          event_uid: eventUid,
          idol_uid: String(event.idol_uid ?? ""),
          idol_name: idolName,
          group_name: groupName,
          scandal_date: effectiveDate,
          score,
          historical_action: catalogRow?.historical_action ?? "",
          handling_id: catalogRow?.id ?? "",
          effective_date: catalogRow?.effective_date ?? "",
          recommended_action: best?.action ?? "",
          recommended_utility: best?.utility ?? 0,
          group_reputation: evalCtx.groupReputation,
          agency_harshness: evalCtx.agencyHarshness,
          agency_name: agencyLabel,
          option_evaluations: evaluations,
          consequence_previews: evaluations.map((row) => ({
            ...row.consequences,
            utility: row.utility,
            risk: row.risk,
            verdict: row.verdict,
            matches_history: row.matches_history,
            axes: row.axes,
          })),
        },
      });
      changed = true;
      deferredEvents.push(deepCopy(event));
      continue;
    }

    const choiceStatus = String(existingNotice.choice_status || "pending").trim();
    if (!choiceStatus || choiceStatus === "pending") {
      deferredEvents.push(deepCopy(event));
      continue;
    }

    // Choice made: apply the status event, then consequences.
    keptEvents.push(deepCopy(event));
    const { suppressedUids: extra, summary: actionSummary } = applyScandalHandlingChoice(
      save,
      event,
      choiceStatus as ScandalAction,
      day,
    );
    for (const uid of extra) suppressedUids.add(uid);
    addNotification(save, {
      title: `Scandal response: ${idolName}`,
      body: actionSummary,
      sender: "Management",
      category: "internal",
      level: "high",
      isoDate: day,
      unread: true,
      dedupeKey: `scenario-scandal-result|${eventUid}|${choiceStatus}`,
      reportData: {
        kind: "managed_scandal_result",
        event_uid: eventUid,
        idol_uid: String(event.idol_uid ?? ""),
        idol_name: idolName,
        action: choiceStatus,
      },
    });
    changed = true;
    existingNotice.requires_confirmation = false;
    existingNotice.read = true;
  }

  const filterSuppressed = (rows: Record<string, unknown>[]) =>
    rows.filter((row) => !suppressedUids.has(String(row.uid ?? "")));

  return {
    chosen: filterSuppressed(keptEvents),
    deferred: filterSuppressed(deferredEvents),
    changed,
  };
}

/**
 * Resolve an inbox choice (desktop `_resolve_notification_choice`).
 * Returns true when the choice was applied.
 */
export function resolveNotificationChoice(
  save: GameSavePayload,
  notificationUid: string,
  choiceValue: string,
  currentIso: string,
): boolean {
  const target = save.inbox.notifications.find((row) => row.uid === notificationUid);
  if (!target) return false;
  const choiceKind = String(target.choice_kind || "");
  const value = String(choiceValue || "").trim();
  if (!value) return false;
  if (choiceKind === "managed_group_leave" && value === "keep") {
    const report = target.report_data && typeof target.report_data === "object" ? (target.report_data as Record<string, unknown>) : null;
    if (report && report.negotiable === false) return false;
  }
  target.choice_status = value;
  target.read = true;
  if (choiceKind === "managed_group_leave" || choiceKind === "managed_scandal_handling") {
    target.requires_confirmation = false;
    applyScenarioEventsForDate(save, currentIso);
  }
  return true;
}

export function applyScenarioEventsForDate(save: GameSavePayload, targetIso: string): void {
  const queue = Array.isArray(save.scenario_runtime.future_events) ? save.scenario_runtime.future_events : [];
  if (!queue.length) return;
  const leaveGate = resolveManagedGroupLeaveChoices(save, targetIso);
  // Keep deferred leaves visible so scandal terminate_after_live can link them.
  save.scenario_runtime.future_events = [...leaveGate.chosen, ...leaveGate.deferred];
  const scandalGate = resolveManagedScandalChoices(save, targetIso, leaveGate.chosen);
  const applied = applyDueFutureEvents(
    save.database_snapshot.idols,
    save.database_snapshot.groups,
    scandalGate.chosen,
    targetIso,
  );
  save.database_snapshot.idols = applied.idols;
  save.database_snapshot.groups = applied.groups;

  // NPC / non-managed scandals that applied this day: auto historical demotions etc.
  for (const event of applied.applied) {
    if (String(event.type ?? "") !== "idol_status_update") continue;
    const detail = event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
    if (String(detail?.kind ?? "").toLowerCase() !== "scandal") continue;
    if (scenarioEventTargetsManagedGroup(save, event)) continue;
    autoApplyHistoricalScandalHandling(save, event, targetIso);
  }

  const combined = [...applied.pending, ...leaveGate.deferred, ...scandalGate.deferred];
  combined.sort((a, b) => {
    const da = String(a.effective_date ?? "");
    const db = String(b.effective_date ?? "");
    if (da !== db) return da.localeCompare(db);
    const ta = String(a.type ?? "");
    const tb = String(b.type ?? "");
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.uid ?? "").localeCompare(String(b.uid ?? ""));
  });
  const changed = leaveGate.changed || scandalGate.changed;
  if (!applied.applied.length && !changed && JSON.stringify(combined) === JSON.stringify(queue)) {
    save.scenario_runtime.future_events = combined;
    return;
  }
  save.scenario_runtime.future_events = combined;
  for (const event of applied.applied) {
    const eventType = String(event.type ?? "");
    if (eventType === "idol_leave_group" || eventType === "idol_join_group" || eventType === "group_formed") continue;
    // Managed scandal decisions already produced inbox rows; skip duplicate "Scandal revealed".
    if (eventType === "idol_status_update") {
      const detail = event.detail && typeof event.detail === "object" ? (event.detail as Record<string, unknown>) : null;
      if (String(detail?.kind ?? "").toLowerCase() === "scandal" && scenarioEventTargetsManagedGroup(save, event)) {
        continue;
      }
    }
    const desc = describeAppliedEvent(event);
    addNotification(save, {
      title: desc.title,
      body: desc.body,
      sender: "Scenario",
      category: "news",
      level: "normal",
      isoDate: targetIso,
      unread: true,
      dedupeKey: `future-event|${String(event.uid ?? "")}|${targetIso}`,
      relatedEventUid: String(event.uid ?? ""),
      requiresConfirmation: desc.title.startsWith("Scandal revealed"),
    });
  }
  if (isMondayUtc(targetIso)) {
    const summary = buildWeeklyScenarioNewsSummary(save, targetIso);
    if (summary) {
      addNotification(save, {
        title: summary.title,
        body: summary.body,
        sender: "News",
        category: "news",
        level: "normal",
        isoDate: targetIso,
        createdTime: "09:00:00",
        unread: true,
        dedupeKey: `weekly-member-left|${targetIso}`,
        reportData: summary.reportData,
      });
    }
  }
}
