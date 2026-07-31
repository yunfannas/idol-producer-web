/**
 * Sweep scenario_6 (and matching main catalog) discography rows:
 * - Fill empty track lists from songs.json (disc_uid / album-name / slash-title / date)
 * - Merge Apple/type variants (A/B/C-Type, 初回盤TYPE-*) into shared_track_list + edition_track_lists
 * - Never invent song rows; missing tracks stay title placeholders when slash-matched only
 *
 * Order: recommended (startup_allowlist.recommended_count) → rest of playable allowlist → other s6 groups
 *
 * Usage:
 *   node support/scripts/sweepScenario6Discography.mjs --dry-run
 *   node support/scripts/sweepScenario6Discography.mjs --phase recommended
 *   node support/scripts/sweepScenario6Discography.mjs --phase playable
 *   node support/scripts/sweepScenario6Discography.mjs --phase other
 *   node support/scripts/sweepScenario6Discography.mjs --phase all
 *   node support/scripts/sweepScenario6Discography.mjs --group "iLiFE!"
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const mainGroupsPath = path.join(root, "public/data/groups.json");
const s6GroupsPath = path.join(root, "public/data/scenarios/scenario_6/groups.json");
const songsPath = path.join(root, "public/data/songs.json");
const allowlistPath = path.join(root, "public/data/scenarios/scenario_6/startup_allowlist.json");

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const phaseIdx = args.indexOf("--phase");
const phase = phaseIdx >= 0 ? String(args[phaseIdx + 1] || "all") : "all";
const groupIdx = args.indexOf("--group");
const groupFilter = groupIdx >= 0 ? String(args[groupIdx + 1] || "").trim() : "";

function nfkc(s) {
  return String(s ?? "").normalize("NFKC");
}

function normalizeKey(s) {
  return nfkc(s)
    .replace(/[！]/g, "!")
    .replace(/[☆★]/g, "☆")
    .replace(/[’']/g, "'")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function compactKey(s) {
  return normalizeKey(s).replace(/[\s☆・．.。、,!！？?～~―\-－_/／()（）「」『』[\]【】"'`]/g, "");
}

/** Strip Apple packaging / type-variant suffixes so Type A/B/C collapse to one release. */
function baseReleaseKey(name) {
  let s = nfkc(name);
  s = s.replace(/\s*[-–—]\s*(Single|EP|Album|Mini Album|Best Album|Digital Single)\s*$/i, "");
  s = s.replace(/\s*[\(（][^）)]*(TYPE|Type|タイプ)[-‐\s]?[A-Z0-9]+[^）)]*[\)）]\s*/gi, " ");
  s = s.replace(/\s*[\(（]\s*[A-E]\s*[\)）]\s*/gi, " ");
  s = s.replace(/\s+[ABCDE]-?Types?\b/gi, " ");
  s = s.replace(/\s+(初回盤|通常盤|限定盤|期間限定盤)\b/gi, " ");
  s = s.replace(/\s*(Special Edition|Deluxe Edition)\s*/gi, " ");
  s = s.replace(/\s+/g, " ").trim();
  return normalizeKey(s);
}

function extractEditionLabel(albumName) {
  const s = nfkc(albumName);
  const typeParen = s.match(/[\(（]([^）)]*(?:TYPE|Type|タイプ)[-‐\s]?([A-Z0-9]+)[^）)]*)[\)）]/i);
  if (typeParen) {
    const letter = String(typeParen[2] || "").toUpperCase();
    return letter ? `TYPE-${letter}` : typeParen[1].trim();
  }
  const typeBare = s.match(/\bTYPE[-‐\s]?([A-Z0-9]+)\b/i);
  if (typeBare) return `TYPE-${String(typeBare[1]).toUpperCase()}`;
  const abc = s.match(/\b([ABCDE])-?Type\b/i);
  if (abc) return `${String(abc[1]).toUpperCase()}-Type`;
  const parenLetter = s.match(/[\(（]\s*([A-E])\s*[\)）]/i);
  if (parenLetter) return `${String(parenLetter[1]).toUpperCase()}-Type`;
  return null;
}

function discHasTrackPayload(d) {
  const tl = Array.isArray(d.track_list) ? d.track_list.filter((x) => String(x ?? "").trim()) : [];
  const sh = Array.isArray(d.shared_track_list) ? d.shared_track_list.filter((x) => String(x ?? "").trim()) : [];
  const eds = Array.isArray(d.edition_track_lists) ? d.edition_track_lists : [];
  const edN = eds.reduce((n, e) => n + (Array.isArray(e?.track_list) ? e.track_list.filter((x) => String(x ?? "").trim()).length : 0), 0);
  return tl.length + sh.length + edN > 0;
}

function songTitle(song) {
  return String(song.title ?? song.title_romanji ?? "").trim();
}

function buildSongIndexes(songs, group) {
  const gid = String(group.uid ?? "").trim();
  const listed = new Set((group.song_uids || []).map(String));
  const groupSongs = songs.filter((s) => {
    const uid = String(s.uid ?? "").trim();
    return (gid && String(s.group_uid ?? "").trim() === gid) || (uid && listed.has(uid));
  });
  const byUid = new Map(groupSongs.map((s) => [String(s.uid), s]));
  const byTitle = new Map();
  const byCompact = new Map();
  for (const s of groupSongs) {
    const t = songTitle(s);
    if (!t) continue;
    const nk = normalizeKey(t);
    const ck = compactKey(t);
    if (nk && !byTitle.has(nk)) byTitle.set(nk, s);
    if (ck && !byCompact.has(ck)) byCompact.set(ck, s);
    const rk = normalizeKey(String(s.title_romanji ?? ""));
    if (rk && !byTitle.has(rk)) byTitle.set(rk, s);
  }
  return { groupSongs, byUid, byTitle, byCompact };
}

function matchSongByTitle(title, idx) {
  const nk = normalizeKey(title);
  const ck = compactKey(title);
  if (nk && idx.byTitle.has(nk)) return idx.byTitle.get(nk);
  if (ck && idx.byCompact.has(ck)) return idx.byCompact.get(ck);
  if (ck) {
    for (const [k, s] of idx.byCompact) {
      if (k.startsWith(ck) || ck.startsWith(k)) return s;
    }
  }
  return null;
}

/**
 * Collect per-edition ordered track refs for a disc from song album links.
 * @returns {Map<string, Array<{uid:string|null, title:string, trackNumber:number|null}>>}
 */
function collectEditionTracks(disc, idx) {
  const discUid = String(disc.uid ?? "").trim();
  const discBase = baseReleaseKey(disc.title ?? disc.title_romanji ?? "");
  const discRomanjiBase = baseReleaseKey(disc.title_romanji ?? "");
  /** @type {Map<string, Map<string, {uid:string|null, title:string, trackNumber:number|null}>>} */
  const editions = new Map();

  function addToEdition(editionKey, song, trackNumber) {
    const title = songTitle(song);
    if (!title) return;
    const uid = String(song.uid ?? "").trim() || null;
    if (!editions.has(editionKey)) editions.set(editionKey, new Map());
    const bag = editions.get(editionKey);
    const key = uid || `t:${normalizeKey(title)}`;
    const prev = bag.get(key);
    const tn =
      trackNumber != null && Number.isFinite(Number(trackNumber)) ? Number(trackNumber) : null;
    if (!prev) bag.set(key, { uid, title, trackNumber: tn });
    else if (prev.trackNumber == null && tn != null) prev.trackNumber = tn;
  }

  for (const song of idx.groupSongs) {
    const rootDu = String(song.disc_uid ?? "").trim();
    const albums = Array.isArray(song.albums) ? song.albums : [];
    let matched = false;

    if (discUid && rootDu === discUid && !albums.length) {
      addToEdition("_flat", song, null);
      matched = true;
    }

    for (const raw of albums) {
      if (!raw || typeof raw !== "object") continue;
      const a = /** @type {Record<string, unknown>} */ (raw);
      const aUid = String(a.disc_uid ?? "").trim();
      const aName = String(a.name ?? "").trim();
      const aBase = baseReleaseKey(aName);
      const byUid = Boolean(discUid && aUid && aUid === discUid);
      const byName =
        Boolean(discBase) &&
        Boolean(aBase) &&
        (aBase === discBase ||
          (discRomanjiBase && aBase === discRomanjiBase) ||
          aBase.includes(discBase) ||
          discBase.includes(aBase));
      if (!byUid && !byName) continue;
      matched = true;
      const ed = extractEditionLabel(aName) || "_shared";
      addToEdition(ed, song, a.track_number);
    }

    if (!matched && discUid && rootDu === discUid) {
      addToEdition("_flat", song, null);
    }
  }

  // Slash-title double A-side fallback when still empty
  if (![...editions.values()].some((m) => m.size)) {
    const parts = String(disc.title ?? "")
      .split(/\s*\/\s*/)
      .map((x) => x.trim())
      .filter(Boolean);
    if (parts.length >= 2) {
      for (const part of parts) {
        const song = matchSongByTitle(part, idx);
        if (song) addToEdition("_flat", song, null);
        else {
          // placeholder title only
          if (!editions.has("_flat")) editions.set("_flat", new Map());
          const bag = editions.get("_flat");
          const key = `t:${normalizeKey(part)}`;
          if (!bag.has(key)) bag.set(key, { uid: null, title: part, trackNumber: null });
        }
      }
    }
  }

  /** @type {Map<string, Array<{uid:string|null, title:string, trackNumber:number|null}>>} */
  const ordered = new Map();
  for (const [ed, bag] of editions) {
    const rows = [...bag.values()].sort((a, b) => {
      const an = a.trackNumber == null ? 9999 : a.trackNumber;
      const bn = b.trackNumber == null ? 9999 : b.trackNumber;
      if (an !== bn) return an - bn;
      return a.title.localeCompare(b.title, "ja");
    });
    ordered.set(ed, rows);
  }
  return ordered;
}

function buildMergedPayload(editionMap) {
  const keys = [...editionMap.keys()].filter((k) => (editionMap.get(k) || []).length);
  if (!keys.length) return null;

  const typed = keys.filter((k) => k !== "_flat" && k !== "_shared");
  const hasTyped = typed.length >= 2 || (typed.length >= 1 && keys.includes("_shared"));

  if (!hasTyped) {
    // Single flat listing (merge _flat + _shared + lone type into track_list)
    const rows = [];
    const seen = new Set();
    for (const k of keys) {
      for (const row of editionMap.get(k) || []) {
        const id = row.uid || `t:${normalizeKey(row.title)}`;
        if (seen.has(id)) continue;
        seen.add(id);
        rows.push(row);
      }
    }
    return {
      track_list: rows.map((r) => r.title),
      track_song_uids: rows.map((r) => r.uid || ""),
      shared_track_list: undefined,
      shared_track_song_uids: undefined,
      edition_track_lists: undefined,
    };
  }

  // Merge type variants: intersection = shared; per-type remainder = edition exclusives
  const typeKeys = typed.length ? typed : keys.filter((k) => k !== "_flat");
  const sets = typeKeys.map((k) => {
    const ids = new Set((editionMap.get(k) || []).map((r) => r.uid || `t:${normalizeKey(r.title)}`));
    return ids;
  });
  let sharedIds = new Set(sets[0]);
  for (const s of sets.slice(1)) {
    sharedIds = new Set([...sharedIds].filter((id) => s.has(id)));
  }

  // Prefer order from the largest edition
  const primaryKey = typeKeys
    .slice()
    .sort((a, b) => (editionMap.get(b)?.length || 0) - (editionMap.get(a)?.length || 0))[0];
  const primaryRows = editionMap.get(primaryKey) || [];
  const sharedRows = primaryRows.filter((r) => sharedIds.has(r.uid || `t:${normalizeKey(r.title)}`));

  // Also include _shared edition tracks as shared if present
  for (const row of editionMap.get("_shared") || []) {
    const id = row.uid || `t:${normalizeKey(row.title)}`;
    if (![...sharedRows].some((r) => (r.uid || `t:${normalizeKey(r.title)}`) === id)) {
      sharedRows.push(row);
      sharedIds.add(id);
    }
  }

  const edition_track_lists = [];
  for (const k of typeKeys.sort((a, b) => a.localeCompare(b, "en"))) {
    const exclusives = (editionMap.get(k) || []).filter(
      (r) => !sharedIds.has(r.uid || `t:${normalizeKey(r.title)}`),
    );
    if (!exclusives.length) continue; // skip empty type variants (fully shared)
    edition_track_lists.push({
      label: k,
      track_list: exclusives.map((r) => r.title),
    });
  }

  // If no exclusives survived, fall back to flat shared-only list
  if (!edition_track_lists.length) {
    return {
      track_list: sharedRows.map((r) => r.title),
      track_song_uids: sharedRows.map((r) => r.uid || ""),
      shared_track_list: undefined,
      shared_track_song_uids: undefined,
      edition_track_lists: undefined,
    };
  }

  return {
    track_list: undefined,
    track_song_uids: undefined,
    shared_track_list: sharedRows.map((r) => r.title),
    shared_track_song_uids: sharedRows.map((r) => r.uid || ""),
    edition_track_lists,
  };
}

function applyPayload(disc, payload) {
  if (!payload) return false;
  let changed = false;
  if (payload.shared_track_list) {
    if (JSON.stringify(disc.shared_track_list || null) !== JSON.stringify(payload.shared_track_list)) {
      disc.shared_track_list = payload.shared_track_list;
      changed = true;
    }
    if (
      JSON.stringify(disc.shared_track_song_uids || null) !==
      JSON.stringify(payload.shared_track_song_uids)
    ) {
      disc.shared_track_song_uids = payload.shared_track_song_uids;
      changed = true;
    }
    if (
      JSON.stringify(disc.edition_track_lists || null) !== JSON.stringify(payload.edition_track_lists)
    ) {
      disc.edition_track_lists = payload.edition_track_lists;
      changed = true;
    }
    if (disc.track_list != null) {
      delete disc.track_list;
      changed = true;
    }
    if (disc.track_song_uids != null) {
      delete disc.track_song_uids;
      changed = true;
    }
  } else if (payload.track_list) {
    if (JSON.stringify(disc.track_list || null) !== JSON.stringify(payload.track_list)) {
      disc.track_list = payload.track_list;
      changed = true;
    }
    if (JSON.stringify(disc.track_song_uids || null) !== JSON.stringify(payload.track_song_uids)) {
      disc.track_song_uids = payload.track_song_uids;
      changed = true;
    }
    if (disc.shared_track_list != null) {
      delete disc.shared_track_list;
      changed = true;
    }
    if (disc.shared_track_song_uids != null) {
      delete disc.shared_track_song_uids;
      changed = true;
    }
    if (disc.edition_track_lists != null) {
      delete disc.edition_track_lists;
      changed = true;
    }
  }
  return changed;
}

/** Re-merge already-filled discs that still look like unmerged type variants via song albums. */
function shouldRemerge(disc, editionMap) {
  const typed = [...editionMap.keys()].filter((k) => k !== "_flat" && k !== "_shared");
  if (typed.length < 2) return false;
  // Already using edition layout with exclusives — ok
  if (Array.isArray(disc.edition_track_lists) && disc.edition_track_lists.length) return false;
  // Has typed album sources but flat/empty storage — merge
  return true;
}

function processGroup(group, songs) {
  const discs = Array.isArray(group.discography) ? group.discography : [];
  if (!discs.length) return { filled: 0, merged: 0, skipped: 0 };
  const idx = buildSongIndexes(songs, group);
  let filled = 0;
  let merged = 0;
  let skipped = 0;

  for (const disc of discs) {
    if (!disc || typeof disc !== "object") continue;
    const editionMap = collectEditionTracks(disc, idx);
    const empty = !discHasTrackPayload(disc);
    const remerge = shouldRemerge(disc, editionMap);
    if (!empty && !remerge) {
      skipped += 1;
      continue;
    }
    const payload = buildMergedPayload(editionMap);
    if (!payload) {
      skipped += 1;
      continue;
    }
    if (applyPayload(disc, payload)) {
      if (payload.edition_track_lists?.length) merged += 1;
      else filled += 1;
    } else skipped += 1;
  }
  return { filled, merged, skipped };
}

function findGroup(groups, nameOrUid) {
  const q = String(nameOrUid).trim();
  return (
    groups.find((g) => String(g.uid ?? "") === q) ||
    groups.find((g) => String(g.name ?? "") === q) ||
    groups.find((g) => String(g.name_romanji ?? "") === q) ||
    null
  );
}

function orderedTargets(s6Groups, allowlist) {
  const names = allowlist.names_in_order || [];
  const recN = Number(allowlist.recommended_count) || 0;
  const recommended = names.slice(0, recN);
  const playableRest = names.slice(recN);
  const named = new Set(names);
  const other = s6Groups
    .filter((g) => !named.has(g.name) && !named.has(g.name_romanji))
    .map((g) => g.name)
    .filter(Boolean);

  if (groupFilter) return [{ phase: "filter", names: [groupFilter] }];
  if (phase === "recommended") return [{ phase: "recommended", names: recommended }];
  if (phase === "playable")
    return [
      { phase: "recommended", names: recommended },
      { phase: "playable", names: playableRest },
    ];
  if (phase === "other") return [{ phase: "other", names: other }];
  return [
    { phase: "recommended", names: recommended },
    { phase: "playable", names: playableRest },
    { phase: "other", names: other },
  ];
}

function main() {
  const allowlist = JSON.parse(fs.readFileSync(allowlistPath, "utf8"));
  const songs = JSON.parse(fs.readFileSync(songsPath, "utf8"));
  const mainGroups = JSON.parse(fs.readFileSync(mainGroupsPath, "utf8"));
  const s6Groups = JSON.parse(fs.readFileSync(s6GroupsPath, "utf8"));
  const mainByUid = new Map(mainGroups.map((g) => [String(g.uid), g]));

  const summary = [];
  let totalFilled = 0;
  let totalMerged = 0;
  let groupsTouched = 0;

  for (const batch of orderedTargets(s6Groups, allowlist)) {
    console.log(`\n=== phase: ${batch.phase} (${batch.names.length} groups) ===`);
    for (const name of batch.names) {
      const s6 = findGroup(s6Groups, name);
      if (!s6) {
        console.log(`  ! missing in scenario_6: ${name}`);
        continue;
      }
      const before = JSON.stringify(s6.discography || null);
      const stats = processGroup(s6, songs);
      const after = JSON.stringify(s6.discography || null);
      const changed = before !== after;

      // Mirror onto main only when s6 gained track payload (never clobber richer main with empties).
      const main = mainByUid.get(String(s6.uid));
      if (changed && main) {
        const mainDiscByUid = new Map(
          (Array.isArray(main.discography) ? main.discography : [])
            .filter((d) => d && d.uid)
            .map((d) => [String(d.uid), d]),
        );
        for (const disc of s6.discography || []) {
          if (!disc?.uid) continue;
          const md = mainDiscByUid.get(String(disc.uid));
          if (!md) {
            if (!Array.isArray(main.discography)) main.discography = [];
            main.discography.push(structuredClone(disc));
            continue;
          }
          const s6Has = discHasTrackPayload(disc);
          const mainHas = discHasTrackPayload(md);
          if (s6Has && (!mainHas || JSON.stringify(md) !== JSON.stringify(disc))) {
            Object.assign(md, structuredClone(disc));
          }
        }
      }

      if (changed) {
        groupsTouched += 1;
        totalFilled += stats.filled;
        totalMerged += stats.merged;
        summary.push({
          phase: batch.phase,
          name: s6.name,
          filled: stats.filled,
          merged: stats.merged,
          discs: (s6.discography || []).length,
        });
        console.log(
          `  ✓ ${s6.name}: filled=${stats.filled} merged-variants=${stats.merged} discs=${(s6.discography || []).length}`,
        );
      } else {
        console.log(`  · ${s6.name}: no change (skipped=${stats.skipped})`);
      }
    }
  }

  console.log(`\nTouched groups: ${groupsTouched}; filled discs≈${totalFilled}; variant-merges≈${totalMerged}`);
  if (dryRun) {
    console.log("Dry run — not writing files.");
    return;
  }
  fs.writeFileSync(s6GroupsPath, `${JSON.stringify(s6Groups, null, 2)}\n`, "utf8");
  fs.writeFileSync(mainGroupsPath, `${JSON.stringify(mainGroups, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(root, s6GroupsPath)}`);
  console.log(`Wrote ${path.relative(root, mainGroupsPath)}`);
}

main();
