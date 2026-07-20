function normalizeText(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function portraitEntryDate(entry) {
  return (
    normalizeText(entry.timestamp) ??
    normalizeText(entry.effective_date) ??
    normalizeText(entry.release_date) ??
    normalizeText(entry.start_date) ??
    normalizeText(entry.date) ??
    ""
  );
}

function portraitEntryPath(entry) {
  return normalizeText(entry.path) ?? normalizeText(entry.portrait_photo_path);
}

function comparePortraitEntries(a, b) {
  const dateCmp = portraitEntryDate(b).localeCompare(portraitEntryDate(a));
  if (dateCmp) return dateCmp;
  return String(portraitEntryPath(b) ?? "").localeCompare(String(portraitEntryPath(a) ?? ""));
}

export function sortPortraitHistory(entries) {
  return [...entries].sort(comparePortraitEntries);
}

export function upsertGroupPortraitHistory(
  idol,
  { groupName, groupUid = null, groupRomanji = null },
  { path, portrait_photo_path = null, timestamp = null, effective_date = null, release_date = null, label = null, note = null, source = null },
) {
  if (!idol || typeof idol !== "object") {
    throw new Error("idol row is required");
  }

  const normalizedPath = normalizeText(path ?? portrait_photo_path);
  if (!normalizedPath) {
    throw new Error("portrait history entry requires a path");
  }

  const keys = [groupName, groupUid, groupRomanji].map(normalizeText).filter(Boolean);
  if (!keys.length) {
    throw new Error("at least one group key is required");
  }

  if (!idol.group_portrait_history || typeof idol.group_portrait_history !== "object") {
    idol.group_portrait_history = {};
  }
  if (!idol.group_portrait_paths || typeof idol.group_portrait_paths !== "object") {
    idol.group_portrait_paths = {};
  }

  const nextEntry = {
    path: normalizedPath,
    timestamp: normalizeText(timestamp),
    effective_date: normalizeText(effective_date),
    release_date: normalizeText(release_date),
    label: normalizeText(label),
    note: normalizeText(note),
    source: normalizeText(source),
  };

  for (const key of keys) {
    const current = Array.isArray(idol.group_portrait_history[key]) ? idol.group_portrait_history[key] : [];
    const deduped = current.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const samePath = portraitEntryPath(entry) === normalizedPath;
      const sameTimestamp = portraitEntryDate(entry) === portraitEntryDate(nextEntry);
      return !(samePath && sameTimestamp);
    });
    deduped.push(nextEntry);
    const sorted = sortPortraitHistory(deduped);
    idol.group_portrait_history[key] = sorted;
    idol.group_portrait_paths[key] = portraitEntryPath(sorted[0]);
  }

  return idol;
}
