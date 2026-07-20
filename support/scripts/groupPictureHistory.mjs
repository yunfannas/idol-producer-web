function normalizeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function entryDate(entry) {
  return (
    normalizeText(entry.timestamp) ??
    normalizeText(entry.effective_date) ??
    normalizeText(entry.release_date) ??
    normalizeText(entry.date) ??
    ""
  );
}

function entryPath(entry) {
  return normalizeText(entry.path);
}

function compareEntries(a, b) {
  const dateCmp = entryDate(b).localeCompare(entryDate(a));
  if (dateCmp) return dateCmp;
  return String(entryPath(b) ?? "").localeCompare(String(entryPath(a) ?? ""));
}

export function sortGroupPictureHistory(entries) {
  return [...entries].sort(compareEntries);
}

export function upsertGroupPictureHistory(
  group,
  { path, timestamp = null, effective_date = null, release_date = null, label = null, note = null, source = null, kind = null },
) {
  if (!group || typeof group !== "object") {
    throw new Error("group row is required");
  }

  const normalizedPath = normalizeText(path);
  if (!normalizedPath) {
    throw new Error("group picture history entry requires a path");
  }

  if (!Array.isArray(group.picture_history)) {
    group.picture_history = [];
  }
  if (!Array.isArray(group.pictures)) {
    group.pictures = [];
  }

  const nextEntry = {
    path: normalizedPath,
    timestamp: normalizeText(timestamp),
    effective_date: normalizeText(effective_date),
    release_date: normalizeText(release_date),
    label: normalizeText(label),
    note: normalizeText(note),
    source: normalizeText(source),
    kind: normalizeText(kind),
  };

  const deduped = group.picture_history.filter((entry) => {
    if (!entry || typeof entry !== "object") return false;
    const samePath = entryPath(entry) === normalizedPath;
    const sameDate = entryDate(entry) === entryDate(nextEntry);
    return !(samePath && sameDate);
  });
  deduped.push(nextEntry);
  group.picture_history = sortGroupPictureHistory(deduped);

  const byBasename = new Map();
  for (const existing of group.pictures) {
    if (typeof existing !== "string" || !existing.trim()) continue;
    const base = existing.replace(/\\/g, "/").split("/").pop()?.toLowerCase();
    if (base) byBasename.set(base, existing);
  }
  const latestPath = entryPath(group.picture_history[0]);
  if (latestPath) {
    const latestBase = latestPath.replace(/\\/g, "/").split("/").pop()?.toLowerCase();
    if (latestBase) byBasename.delete(latestBase);
    group.pictures = [latestPath, ...Array.from(byBasename.values())];
  }

  return group;
}
