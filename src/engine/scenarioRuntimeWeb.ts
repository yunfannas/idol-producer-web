import { addNotification } from "../save/inbox";
import type { GameSavePayload } from "../save/gameSaveSchema";

function parseIsoDate(value: unknown): string | null {
  const text = String(value ?? "").split("T")[0].trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : null;
}

function compareIsoDate(a: string, b: string): number {
  return a.localeCompare(b);
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
          futureEvents.push(buildEvent("idol_leave_group", endDate, { idolRow, entry }));
          joinEntry.end_date = null;
        }
        futureEvents.push(buildEvent("idol_join_group", startDate, { idolRow, entry: joinEntry }));
        continue;
      }

      filterEntryTimeline(entry, idolRow, asOf, futureEvents);
      if (endDate && compareIsoDate(endDate, asOf) > 0) {
        futureEvents.push(buildEvent("idol_leave_group", endDate, { idolRow, entry }));
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

export function applyScenarioEventsForDate(save: GameSavePayload, targetIso: string): void {
  const queue = Array.isArray(save.scenario_runtime.future_events) ? save.scenario_runtime.future_events : [];
  if (!queue.length) return;
  const applied = applyDueFutureEvents(
    save.database_snapshot.idols,
    save.database_snapshot.groups,
    queue,
    targetIso,
  );
  save.database_snapshot.idols = applied.idols;
  save.database_snapshot.groups = applied.groups;
  save.scenario_runtime.future_events = applied.pending;
  for (const event of applied.applied) {
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
      requiresConfirmation: desc.title.startsWith("Member left") || desc.title.startsWith("Scandal revealed"),
    });
  }
}
