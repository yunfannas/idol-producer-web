const SAVES_KEY = "ikonoijoy-best10-saves-v2";
const SAVES_KEY_LEGACY = "ikonoijoy-best10-saves-v1";
const LAST_NAME_KEY = "ikonoijoy-best10-last-name";
const LAST_GROUP_KEY = "ikonoijoy-best10-last-group";
const CUSTOM_SONGS_KEY = "ikonoijoy-best10-custom-songs-v1";
const GAME_WEB_URL = "https://yunfannas.github.io/idol-producer-web/";
const CUSTOM_SONG_VALUE = "__custom__";
const RANK_COUNT = 10;
const GROUP_ORDER = ["=LOVE", "≠ME", "≒JOY"];

let assetVersion = "";
let customSongsDb = { version: 1, updated_at: null, entries: [] };
/** @type {{ version: number, groups?: string[], saves: { name: string, file?: string, saved_at?: string }[] }} */
let onlineSaveIndex = { version: 1, saves: [] };
/** @type {{ group: string, charts: Record<string, string[]> }} */
let state = { group: "", charts: {} };
/** @type {string[]} */
let knownGroupNames = [...GROUP_ORDER];

function versionedAssetUrl(src) {
  if (!src || typeof src !== "string") return src;
  if (/^(data:|blob:)/i.test(src)) return src;
  const sep = src.includes("?") ? "&" : "?";
  return assetVersion ? `${src}${sep}v=${encodeURIComponent(assetVersion)}` : src;
}

function emptyCustomSongsDb() {
  return {
    version: 1,
    updated_at: null,
    note: "User-submitted custom song titles for IKONOIJOY best-10. Confirm and merge into songs.json later.",
    entries: [],
  };
}

function normalizeCustomSongsDb(raw) {
  const db = emptyCustomSongsDb();
  if (!raw || typeof raw !== "object") return db;
  db.version = Number(raw.version) || 1;
  db.updated_at = raw.updated_at || null;
  if (typeof raw.note === "string") db.note = raw.note;
  const seen = new Set();
  for (const row of Array.isArray(raw.entries) ? raw.entries : []) {
    const groupName = String(row?.group_name || "").trim();
    const title = String(row?.title || "").trim();
    if (!groupName || !title) continue;
    const key = `${groupName}\0${title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    db.entries.push({
      group_name: groupName,
      group_uid: row.group_uid || null,
      title,
      added_at: row.added_at || null,
      added_by: row.added_by || null,
    });
  }
  return db;
}

function readLocalCustomSongs() {
  try {
    return normalizeCustomSongsDb(JSON.parse(localStorage.getItem(CUSTOM_SONGS_KEY) || "null"));
  } catch {
    return emptyCustomSongsDb();
  }
}

function writeLocalCustomSongs(db) {
  localStorage.setItem(CUSTOM_SONGS_KEY, JSON.stringify(db));
}

function mergeCustomSongsDb(base, extra) {
  const out = normalizeCustomSongsDb(base);
  const seen = new Set(out.entries.map((e) => `${e.group_name}\0${e.title}`.toLowerCase()));
  for (const row of normalizeCustomSongsDb(extra).entries) {
    const key = `${row.group_name}\0${row.title}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.entries.push(row);
  }
  out.updated_at =
    out.entries.reduce((max, e) => {
      const t = e.added_at || "";
      return t > max ? t : max;
    }, out.updated_at || "") || out.updated_at;
  return out;
}

async function loadCustomSongsDb() {
  let fileDb = emptyCustomSongsDb();
  try {
    const res = await fetch("./custom_songs.json", { cache: "no-store" });
    if (res.ok) fileDb = normalizeCustomSongsDb(await res.json());
  } catch {
    /* empty */
  }
  return mergeCustomSongsDb(fileDb, readLocalCustomSongs());
}

function currentOwnerName() {
  return (document.getElementById("saveName")?.value || "").trim();
}

function safeFileStem(name) {
  const base = (name || "ikonoijoy-best10").trim() || "ikonoijoy-best10";
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80);
}

function setStatus(msg, kind = "") {
  const el = document.getElementById("saveStatus");
  if (!el) return;
  el.textContent = msg;
  el.dataset.kind = kind;
  if (msg) {
    clearTimeout(setStatus._t);
    setStatus._t = setTimeout(() => {
      if (el.textContent === msg) {
        el.textContent = "";
        el.dataset.kind = "";
      }
    }, 2800);
  }
}

function readAllSaves() {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (raw) return JSON.parse(raw) || {};
    // One-time migrate from v1 (single-group ranks per name).
    const legacy = JSON.parse(localStorage.getItem(SAVES_KEY_LEGACY) || "null");
    if (legacy && typeof legacy === "object") {
      const migrated = {};
      for (const [name, row] of Object.entries(legacy)) {
        const normalized = normalizeImportedSave({ name, ...row });
        if (normalized) {
          migrated[name] = {
            saved_at: normalized.saved_at,
            group: normalized.group,
            charts: normalized.charts,
          };
        }
      }
      writeAllSaves(migrated);
      return migrated;
    }
    return {};
  } catch {
    return {};
  }
}

function writeAllSaves(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function emptyRanks() {
  return Array(RANK_COUNT).fill("");
}

function normalizeRanks(raw) {
  const ranks = Array.isArray(raw)
    ? raw.map((x) => canonicalSongTitle(String(x || "").trim()) || String(x || "").trim()).slice(0, RANK_COUNT)
    : emptyRanks();
  while (ranks.length < RANK_COUNT) ranks.push("");
  return ranks.slice(0, RANK_COUNT);
}

/** Ensure every known group has a 10-slot chart array (empty strings if unset). */
function ensureChartContainers(charts, groupNames = knownGroupNames) {
  /** @type {Record<string, string[]>} */
  const out = {};
  const names = [...groupNames];
  for (const name of Object.keys(charts || {})) {
    if (name && !names.includes(name)) names.push(name);
  }
  for (const name of names) {
    if (!name) continue;
    out[name] = normalizeRanks(charts?.[name]);
  }
  return out;
}

function chartHasPicks(charts) {
  return Object.values(charts || {}).some((ranks) => Array.isArray(ranks) && ranks.some(Boolean));
}

async function fetchOnlineSave(name) {
  const clean = String(name || "").trim();
  if (!clean) return null;
  const candidates = [];
  const fromIndex = onlineSaveIndex?.saves?.find(
    (row) => String(row?.name || "").trim().toLowerCase() === clean.toLowerCase(),
  );
  if (fromIndex?.file) candidates.push(`./saves/${fromIndex.file}`);
  const stem = safeFileStem(clean);
  candidates.push(`./saves/${stem}.json`);
  if (encodeURIComponent(clean) !== stem) {
    candidates.push(`./saves/${encodeURIComponent(clean)}.json`);
  }
  const seen = new Set();
  for (const url of candidates) {
    if (!url || seen.has(url)) continue;
    seen.add(url);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const record = normalizeImportedSave(await res.json());
      if (record) return record;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function loadOnlineSaveIndex() {
  try {
    const res = await fetch("./saves/index.json", { cache: "no-store" });
    if (!res.ok) return { version: 1, saves: [] };
    const raw = await res.json();
    return {
      version: Number(raw?.version) || 1,
      groups: Array.isArray(raw?.groups) ? raw.groups : [...GROUP_ORDER],
      saves: Array.isArray(raw?.saves) ? raw.saves : [],
    };
  } catch {
    return { version: 1, saves: [] };
  }
}

function refreshSaveNameSuggestions() {
  const list = document.getElementById("saveNameSuggestions");
  if (!list) return;
  const names = new Set();
  for (const row of onlineSaveIndex?.saves || []) {
    const n = String(row?.name || "").trim();
    if (n) names.add(n);
  }
  for (const n of Object.keys(readAllSaves())) {
    if (n) names.add(n);
  }
  list.replaceChildren();
  for (const name of [...names].sort((a, b) => a.localeCompare(b, "en"))) {
    const opt = document.createElement("option");
    opt.value = name;
    list.appendChild(opt);
  }
}

/** Prefer local filled group charts; fill gaps from the online file. */
function mergeSaveRecords(local, online) {
  if (!local && !online) return null;
  const name = local?.name || online?.name || "";
  if (!name) return null;
  const charts = ensureChartContainers({
    ...(online?.charts || {}),
    ...(local?.charts || {}),
  });
  for (const groupName of Object.keys(charts)) {
    const loc = local?.charts?.[groupName];
    const on = online?.charts?.[groupName];
    if (loc?.some(Boolean)) charts[groupName] = normalizeRanks(loc);
    else if (on?.some(Boolean)) charts[groupName] = normalizeRanks(on);
    else charts[groupName] = normalizeRanks(loc || on || emptyRanks());
  }
  return {
    name,
    saved_at: local?.saved_at || online?.saved_at || new Date().toISOString(),
    group: local?.group || online?.group || "",
    charts,
  };
}

function onlineSavePayload(name, record) {
  const charts = ensureChartContainers(record?.charts || {});
  return {
    name,
    saved_at: record?.saved_at || new Date().toISOString(),
    group: record?.group || Object.keys(charts)[0] || "",
    charts,
  };
}

function ranksForGroup(groupName) {
  const key = groupName || state.group;
  if (!key) return emptyRanks();
  if (!state.charts[key]) state.charts[key] = emptyRanks();
  return state.charts[key];
}

function setRanksForGroup(groupName, ranks) {
  if (!groupName) return;
  state.charts[groupName] = normalizeRanks(ranks);
}

function currentRanks() {
  return ranksForGroup(state.group);
}

function activeGroup(data) {
  return (data.groups || []).find((g) => g.name === state.group) || data.groups?.[0] || null;
}

function customTitlesForGroup(group) {
  const name = group?.name || "";
  const uid = group?.uid || "";
  return customSongsDb.entries
    .filter((e) => e.group_name === name || (uid && e.group_uid === uid))
    .map((e) => e.title);
}

/** Collapse live / concert / alt takes to the original catalog title. */
function canonicalSongTitle(title) {
  let t = String(title || "").trim();
  if (!t) return "";
  t = t.replace(/\(Opening version\)\s*/gi, "").trim();
  let prev = null;
  while (prev !== t) {
    prev = t;
    t = t
      .replace(/\s*[(\uFF08][\s\S]*$/u, "")
      .replace(/\s*\[\s*=LOVE[\s\S]*$/iu, "")
      .replace(/\s+-\s+From\s+THE\s+FIRST\s+TAKE\s*$/i, "")
      .replace(/\s+-\s+Instrumental\s*$/i, "")
      .replace(/\s+-\s+Off\s+Vocal\s*$/i, "")
      .trim();
  }
  t = t.replace(/\s+/g, " ").replace(/^[\s\-–—]+|[\s\-–—]+$/g, "");
  // Catalog inconsistency: "手遅れ caution" vs "手遅れcaution"
  t = t.replace(/(?<=[\u3040-\u30ff\u3400-\u9fff])\s+(?=[A-Za-z0-9])/gu, "");
  t = t.replace(/(?<=[A-Za-z0-9])\s+(?=[\u3040-\u30ff\u3400-\u9fff])/gu, "");
  return t;
}

function songsForGroup(group) {
  // Trust data.json order (oldest → newest, A-side then couplings). Customs last.
  /** @type {{ title: string, source: string, uid: string | null }[]} */
  const catalog = [];
  const seen = new Set();

  for (const s of group?.songs || []) {
    const canonical = canonicalSongTitle(s.title);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    catalog.push({
      title: canonical,
      source: "catalog",
      uid: s.uid || null,
    });
  }

  /** @type {{ title: string, source: string, uid: string | null }[]} */
  const customs = [];
  for (const title of customTitlesForGroup(group)) {
    const canonical = canonicalSongTitle(title);
    if (!canonical) continue;
    const key = canonical.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    customs.push({ title: canonical, source: "custom", uid: null });
  }

  return [...catalog, ...customs];
}

function persistCustomSong(group, title) {
  const clean = canonicalSongTitle(title) || String(title || "").trim();
  if (!clean || !group?.name) return null;
  const inCatalog = songsForGroup(group).some((s) => s.title === clean && s.source === "catalog");
  if (inCatalog) return { title: clean, added: false, catalog: true };
  const key = `${group.name}\0${clean}`.toLowerCase();
  const exists = customSongsDb.entries.some(
    (e) => `${e.group_name}\0${e.title}`.toLowerCase() === key,
  );
  if (exists) return { title: clean, added: false };
  const row = {
    group_name: group.name,
    group_uid: group.uid || null,
    title: clean,
    added_at: new Date().toISOString(),
    added_by: currentOwnerName() || null,
  };
  customSongsDb.entries.push(row);
  customSongsDb.updated_at = row.added_at;
  writeLocalCustomSongs(customSongsDb);
  return { title: clean, added: true, row };
}

function downloadCustomSongsDb() {
  const payload = {
    ...customSongsDb,
    updated_at: customSongsDb.updated_at || new Date().toISOString(),
  };
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" }),
    "custom_songs.json",
  );
}

function applyTheme(group) {
  const themeId = group?.theme?.id || "equal-love";
  document.body.dataset.theme = themeId;
  const hashtag = document.getElementById("chartHashtag");
  const groupRomanji = document.getElementById("chartGroupRomanji");
  const producer = document.getElementById("chartProducer");
  const footerLogo = document.getElementById("chartFooterLogo");
  if (hashtag) hashtag.textContent = group?.theme?.hashtag || "";
  if (groupRomanji) {
    groupRomanji.textContent = group?.name_romanji || group?.name || "";
  }
  if (producer) producer.textContent = group?.theme?.producer || "Produced by Rino Sashihara";
  const logoUrl = group?.logo_url ? versionedAssetUrl(group.logo_url) : "";
  if (footerLogo) {
    if (logoUrl) {
      footerLogo.src = logoUrl;
      footerLogo.alt = group.name || "";
      footerLogo.hidden = false;
    } else {
      footerLogo.removeAttribute("src");
      footerLogo.alt = "";
      footerLogo.hidden = true;
    }
  }
}

function spawnPetals() {
  const root = document.getElementById("petals");
  if (!root) return;
  root.replaceChildren();
  for (let i = 0; i < 18; i++) {
    const p = document.createElement("span");
    p.className = "petal";
    p.style.left = `${Math.random() * 100}%`;
    p.style.top = `${-10 - Math.random() * 40}%`;
    p.style.animationDuration = `${10 + Math.random() * 14}s`;
    p.style.animationDelay = `${-Math.random() * 12}s`;
    p.style.opacity = String(0.18 + Math.random() * 0.28);
    p.style.width = `${10 + Math.random() * 10}px`;
    p.style.height = `${12 + Math.random() * 12}px`;
    root.appendChild(p);
  }
}

function renderGroupTabs(data) {
  const tabs = document.getElementById("groupTabs");
  tabs.replaceChildren();
  for (const group of data.groups || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "group-tab";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", group.name === state.group ? "true" : "false");
    btn.setAttribute("aria-label", group.name);
    btn.title = group.name;
    btn.dataset.group = group.name;
    if (group.logo_url) {
      const img = document.createElement("img");
      img.src = versionedAssetUrl(group.logo_url);
      img.alt = "";
      img.loading = "lazy";
      btn.appendChild(img);
    } else {
      const label = document.createElement("span");
      label.textContent = group.name;
      btn.appendChild(label);
    }
    btn.addEventListener("click", () => {
      if (state.group === group.name) return;
      const leaving = state.group;
      syncStateFromDom();
      // Autosave leaving group's picks under the current Name (if any).
      if (currentOwnerName()) {
        persistCurrentNameCharts(leaving);
      }
      state.group = group.name;
      localStorage.setItem(LAST_GROUP_KEY, group.name);
      applyTheme(group);
      renderGroupTabs(data);
      renderRankSlots(data);
      renderPreview();
      setStatus(`Switched to ${group.name}`, "ok");
    });
    tabs.appendChild(btn);
  }
}

function songMatchesQuery(title, query) {
  if (!query) return true;
  return String(title || "").toLowerCase().includes(query.toLowerCase());
}

function fillRankSelect(select, group, query, currentValue) {
  const songs = songsForGroup(group).filter((s) => songMatchesQuery(s.title, query));
  const catalog = songs.filter((s) => s.source !== "custom");
  const customs = songs.filter((s) => s.source === "custom");
  select.replaceChildren();

  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = songs.length || !query ? "未選択" : "該当なし";
  select.appendChild(blank);

  for (const song of catalog) {
    const opt = document.createElement("option");
    opt.value = song.title;
    opt.textContent = song.title;
    select.appendChild(opt);
  }

  if (customs.length) {
    const sep = document.createElement("option");
    sep.disabled = true;
    sep.value = "";
    sep.textContent = "── Custom ──";
    select.appendChild(sep);
    for (const song of customs) {
      const opt = document.createElement("option");
      opt.value = song.title;
      opt.textContent = `${song.title} ·`;
      opt.dataset.custom = "1";
      select.appendChild(opt);
    }
  }

  const customOpt = document.createElement("option");
  customOpt.value = CUSTOM_SONG_VALUE;
  customOpt.textContent = "＋ Custom…";
  select.appendChild(customOpt);

  if (currentValue === CUSTOM_SONG_VALUE) {
    select.value = CUSTOM_SONG_VALUE;
  } else if (currentValue && [...select.options].some((o) => o.value === currentValue && !o.disabled)) {
    select.value = currentValue;
  } else if (currentValue) {
    // Keep custom title even when filtered out of catalog options
    const orphan = document.createElement("option");
    orphan.value = currentValue;
    orphan.textContent = `${currentValue} ·`;
    orphan.dataset.custom = "1";
    // Insert before the "＋ Custom…" option
    select.insertBefore(orphan, customOpt);
    select.value = currentValue;
  } else {
    select.value = "";
  }
}

function rankValueFromRow(row) {
  const select = row.querySelector(".rank-select");
  const custom = row.querySelector(".custom-input");
  if (!select) return "";
  if (select.value === CUSTOM_SONG_VALUE) return (custom?.value || "").trim();
  return select.value || "";
}

function collectRanks() {
  const rows = [...document.querySelectorAll(".rank-row")];
  if (!rows.length) return [...currentRanks()];
  return rows.map((row) => rankValueFromRow(row));
}

function syncStateFromDom() {
  setRanksForGroup(state.group, collectRanks());
}

function setRowSongValue(row, title, group, query) {
  const select = row.querySelector(".rank-select");
  const custom = row.querySelector(".custom-input");
  const controls = row.querySelector(".rank-controls");
  const saveBtn = row.querySelector(".btn-song-save");
  if (!select) return;

  const catalogTitles = new Set(songsForGroup(group).map((s) => s.title));
  const clean = String(title || "").trim();
  const isCustom = Boolean(clean && !catalogTitles.has(clean));

  fillRankSelect(select, group, query, isCustom ? CUSTOM_SONG_VALUE : clean);
  if (isCustom) {
    if (custom) custom.value = clean;
    controls?.classList.add("is-custom");
    if (saveBtn) saveBtn.hidden = false;
    select.value = CUSTOM_SONG_VALUE;
  } else {
    if (custom) custom.value = "";
    controls?.classList.remove("is-custom");
    if (saveBtn) saveBtn.hidden = true;
    select.value = clean;
  }
}

function renderRankSlots(data) {
  const group = activeGroup(data);
  const root = document.getElementById("rankSlots");
  const query = document.getElementById("songSearch")?.value || "";
  root.replaceChildren();
  if (!group) return;

  for (let i = 0; i < RANK_COUNT; i++) {
    const row = document.createElement("div");
    row.className = "rank-row";
    row.dataset.rank = String(i + 1);

    const num = document.createElement("div");
    num.className = "rank-num";
    num.textContent = String(i + 1);

    const controls = document.createElement("div");
    controls.className = "rank-controls";

    const select = document.createElement("select");
    select.className = "rank-select";
    select.setAttribute("aria-label", `${i + 1}位の曲`);

    const custom = document.createElement("input");
    custom.type = "text";
    custom.className = "custom-input";
    custom.placeholder = "Custom title";
    custom.autocomplete = "off";
    custom.setAttribute("aria-label", `${i + 1}位カスタム曲名`);

    const saveBtn = document.createElement("button");
    saveBtn.type = "button";
    saveBtn.className = "btn-song-save";
    saveBtn.hidden = true;
    saveBtn.textContent = "✓";
    saveBtn.title = "Save custom song";

    const saved = currentRanks()[i] || "";
    const catalogTitles = new Set(songsForGroup(group).map((s) => s.title));
    const isCustom = saved && !catalogTitles.has(saved);
    fillRankSelect(select, group, query, isCustom ? CUSTOM_SONG_VALUE : saved);
    if (isCustom) {
      custom.value = saved;
      controls.classList.add("is-custom");
      saveBtn.hidden = false;
      select.value = CUSTOM_SONG_VALUE;
    }

    const setCustomMode = (on) => {
      controls.classList.toggle("is-custom", on);
      saveBtn.hidden = !on;
      if (!on) custom.value = "";
      else custom.focus();
    };

    // Track prior value so choosing an already-ranked song can swap places.
    let previousSong = rankValueFromRow(row) || saved;
    select.addEventListener("focus", () => {
      previousSong = rankValueFromRow(row);
    });

    select.addEventListener("change", () => {
      if (select.value === CUSTOM_SONG_VALUE) {
        setCustomMode(true);
      } else {
        setCustomMode(false);
        const title = select.value;
        if (title) {
          document.querySelectorAll(".rank-row").forEach((other) => {
            if (other === row) return;
            if (rankValueFromRow(other) !== title) return;
            // Swap: move this row's previous song into the other rank.
            setRowSongValue(other, previousSong, group, query);
          });
        }
      }
      previousSong = rankValueFromRow(row);
      syncStateFromDom();
      renderPreview();
    });

    custom.addEventListener("input", () => {
      syncStateFromDom();
      renderPreview();
    });

    custom.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        saveBtn.click();
      }
    });

    saveBtn.addEventListener("click", () => {
      const title = (custom.value || "").trim();
      if (!title) {
        setStatus("Enter a custom song title first", "err");
        custom.focus();
        return;
      }
      const result = persistCustomSong(group, title);
      if (!result) return;
      // Swap if this custom title already occupies another rank.
      document.querySelectorAll(".rank-row").forEach((other) => {
        if (other === row) return;
        if (rankValueFromRow(other) !== result.title) return;
        setRowSongValue(other, previousSong, group, query);
      });
      fillRankSelect(select, group, query, result.title);
      setCustomMode(false);
      select.value = result.title;
      previousSong = result.title;
      syncStateFromDom();
      renderPreview();
      if (result.added) downloadCustomSongsDb();
      if (result.catalog) setStatus(`“${result.title}” is already in the catalog`, "ok");
      else if (result.added) setStatus(`Saved “${result.title}” to custom_songs.json`, "ok");
      else setStatus(`“${result.title}” already in custom song DB`, "ok");
    });

    controls.append(custom, saveBtn, select);
    row.append(num, controls);
    root.appendChild(row);
  }
}

function renderPreview() {
  const ranks = collectRanks();
  const list = document.getElementById("chartRanks");
  list.replaceChildren();
  for (let i = 0; i < RANK_COUNT; i++) {
    const li = document.createElement("li");
    li.className = "chart-rank";
    const n = document.createElement("span");
    n.className = "chart-rank-n";
    n.textContent = String(i + 1);
    const box = document.createElement("div");
    box.className = "chart-rank-box";
    const left = document.createElement("span");
    left.className = "mini-heart";
    left.textContent = "Love";
    const title = document.createElement("p");
    title.className = "chart-song-title";
    const song = ranks[i] || "";
    if (song) {
      title.textContent = song;
    } else {
      title.textContent = "—";
      title.classList.add("is-empty");
    }
    const right = document.createElement("span");
    right.className = "mini-heart";
    right.textContent = "Love";
    box.append(left, title, right);
    li.append(n, box);
    list.appendChild(li);
  }
}

function buildNamedSaveRecord(name, payload) {
  const charts = ensureChartContainers(payload.charts || {});
  // Always include the active group snapshot (empty array is valid — don't use ||).
  if (payload.group) {
    const activeRanks = Array.isArray(payload.ranks) ? payload.ranks : charts[payload.group];
    charts[payload.group] = normalizeRanks(activeRanks);
  }
  return {
    name,
    saved_at: new Date().toISOString(),
    group: payload.group || "",
    charts: ensureChartContainers(charts),
  };
}

function saveNamedRecord(name, record) {
  const all = readAllSaves();
  const prev = all[name]?.charts || {};
  all[name] = {
    saved_at: record.saved_at || new Date().toISOString(),
    group: record.group || all[name]?.group || "",
    // Never drop previously saved groups when writing a partial update.
    charts: ensureChartContainers({ ...prev, ...(record.charts || {}) }),
  };
  writeAllSaves(all);
  localStorage.setItem(LAST_NAME_KEY, name);
}

/** Persist in-memory charts into the named save (used on Save and group switch). */
function persistCurrentNameCharts(preferredGroup = state.group) {
  const name = currentOwnerName();
  if (!name) return null;
  syncStateFromDom();
  const prev = readAllSaves()[name];
  const charts = {
    ...(prev?.charts || {}),
    ...state.charts,
  };
  if (preferredGroup) {
    charts[preferredGroup] = normalizeRanks(charts[preferredGroup] || currentRanks());
  }
  const record = buildNamedSaveRecord(name, {
    group: preferredGroup || state.group,
    charts,
    ranks: preferredGroup ? charts[preferredGroup] : undefined,
  });
  saveNamedRecord(name, record);
  // Keep memory aligned with what we stored.
  state.charts = ensureChartContainers(charts);
  return record;
}

function normalizeImportedSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  if (!name) return null;

  /** @type {Record<string, string[]>} */
  const charts = {};
  if (raw.charts && typeof raw.charts === "object") {
    for (const [groupName, ranks] of Object.entries(raw.charts)) {
      if (!groupName) continue;
      charts[groupName] = normalizeRanks(ranks);
    }
  }

  // Legacy v1: single group + ranks — only fill gaps, never wipe richer chart data.
  const legacyGroup = String(raw.group || "").trim();
  if (Array.isArray(raw.ranks)) {
    const ranks = normalizeRanks(raw.ranks);
    const hasLegacySongs = ranks.some(Boolean);
    if (legacyGroup) {
      const existing = charts[legacyGroup];
      if (!existing || (hasLegacySongs && !existing.some(Boolean))) {
        charts[legacyGroup] = ranks;
      }
    } else if (!Object.keys(charts).length) {
      charts[""] = ranks;
    }
  }

  if (!Object.keys(charts).length) return null;

  return {
    name,
    saved_at: raw.saved_at || new Date().toISOString(),
    group: legacyGroup || Object.keys(charts).find((g) => charts[g].some(Boolean)) || Object.keys(charts)[0] || "",
    charts: ensureChartContainers(charts),
  };
}

function applySave(data, record, { keepGroup = false } = {}) {
  if (!record) return;
  const previousGroup = state.group;
  state.charts = ensureChartContainers(record.charts || {});

  const groupNames = (data.groups || []).map((g) => g.name);
  if (keepGroup && previousGroup && groupNames.includes(previousGroup)) {
    state.group = previousGroup;
  } else if (record.group && groupNames.includes(record.group)) {
    state.group = record.group;
  } else if (!groupNames.includes(state.group)) {
    state.group = groupNames[0] || "";
  }

  localStorage.setItem(LAST_GROUP_KEY, state.group);
  const group = activeGroup(data);
  applyTheme(group);
  renderGroupTabs(data);
  renderRankSlots(data);
  renderPreview();
}

function loadImage(src) {
  return new Promise((resolve) => {
    if (!src) {
      resolve(null);
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = versionedAssetUrl(src);
  });
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapTextLines(ctx, text, maxWidth, maxLines = 2) {
  const chars = [...String(text || "")];
  if (!chars.length) return [""];
  const lines = [];
  let cur = "";
  let truncated = false;
  for (const ch of chars) {
    const trial = cur + ch;
    if (ctx.measureText(trial).width <= maxWidth || !cur) {
      cur = trial;
      continue;
    }
    lines.push(cur);
    cur = ch;
    if (lines.length >= maxLines) {
      truncated = true;
      cur = "";
      break;
    }
  }
  if (cur && lines.length < maxLines) lines.push(cur);
  else if (cur) truncated = true;
  if (truncated && lines.length) {
    let last = lines[lines.length - 1];
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) {
      last = [...last].slice(0, -1).join("");
    }
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.length ? lines : [""];
}

function drawHeart(ctx, x, y, size, fill) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  ctx.beginPath();
  ctx.moveTo(12, 21);
  ctx.bezierCurveTo(3, 14, 1, 8, 6, 4.5);
  ctx.bezierCurveTo(9, 2.5, 12, 4, 12, 6.5);
  ctx.bezierCurveTo(12, 4, 15, 2.5, 18, 4.5);
  ctx.bezierCurveTo(23, 8, 21, 14, 12, 21);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 5px "Zen Kaku Gothic New", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Love", 12, 12);
  ctx.restore();
}

function drawOutlinedText(ctx, text, x, y, fill, stroke) {
  ctx.lineJoin = "round";
  ctx.miterLimit = 2;
  ctx.lineWidth = 8;
  ctx.strokeStyle = stroke;
  ctx.strokeText(text, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(text, x, y);
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function renderBest10Png(data) {
  const group = activeGroup(data);
  const theme = group?.theme || {};
  const ranks = collectRanks();
  const owner = currentOwnerName();
  const logo = await loadImage(group?.logo_url);
  const brandLogo = await loadImage("../idol-producer-logo.png");

  const width = 720;
  const padX = 42;
  const headerH = 210;
  const rowH = 54;
  const footerLogoH = 44;
  const creditH = 46;
  const height = headerH + RANK_COUNT * rowH + footerLogoH + creditH + 12;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  const bg0 = theme.bg0 || "#fff8fb";
  const bg1 = theme.bg1 || "#ffe9f3";
  const accent = theme.accent || "#ff5ca8";
  const accentDeep = theme.accent_deep || "#e91e8c";
  const titleFill = theme.title_fill || accent;
  const ink = theme.ink || "#3a1630";
  const boxBorder = theme.box_border || "#2a1a22";

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, "#ffffff");
  grad.addColorStop(0.45, bg0);
  grad.addColorStop(1, "#ffffff");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Soft petal dots
  for (let i = 0; i < 40; i++) {
    const px = (i * 97) % width;
    const py = (i * 53) % height;
    ctx.beginPath();
    ctx.fillStyle = accent;
    ctx.globalAlpha = 0.08 + ((i * 17) % 10) / 100;
    ctx.ellipse(px, py, 5 + (i % 4), 7 + (i % 5), (i % 8) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Hashtag badge
  const hashtag = theme.hashtag || "";
  ctx.font = '700 18px "Zen Kaku Gothic New", sans-serif';
  const tagW = Math.max(160, ctx.measureText(hashtag).width + 28);
  const tagX = (width - tagW) / 2;
  roundRect(ctx, tagX, 28, tagW, 34, 8);
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.textAlign = "center";
  ctx.fillText(hashtag, width / 2, 51);

  // Group romaji title (replaces header logo)
  const groupRomanji = group?.name_romanji || group?.name || "IKONOIJOY";
  drawHeart(ctx, width / 2 - 150, 118, 46, accent);
  drawHeart(ctx, width / 2 + 104, 118, 46, accent);
  ctx.fillStyle = ink;
  ctx.font = '700 56px "Bebas Neue", "Zen Maru Gothic", sans-serif';
  ctx.fillText(groupRomanji, width / 2, 140);

  ctx.fillStyle = ink;
  ctx.font = '500 13px "Zen Kaku Gothic New", sans-serif';
  ctx.fillText(theme.producer || "Produced by Rino Sashihara", width / 2, 186);
  if (owner) {
    ctx.fillStyle = accentDeep;
    ctx.font = '700 13px "Zen Kaku Gothic New", sans-serif';
    ctx.fillText(owner, width / 2, 204);
  }
  ctx.textAlign = "left";

  for (let i = 0; i < RANK_COUNT; i++) {
    const y = headerH + i * rowH;
    const boxX = padX + 34;
    const boxW = width - padX * 2 - 34;
    const boxH = 42;

    ctx.fillStyle = ink;
    ctx.font = '700 22px Georgia, "Times New Roman", serif';
    ctx.textAlign = "center";
    ctx.fillText(String(i + 1), padX + 10, y + 30);
    ctx.textAlign = "left";

    ctx.fillStyle = "#ffffff";
    ctx.strokeStyle = boxBorder;
    ctx.lineWidth = 2;
    roundRect(ctx, boxX, y + 4, boxW, boxH, 4);
    ctx.fill();
    ctx.stroke();

    drawHeart(ctx, boxX + 8, y + 12, 26, accent);
    drawHeart(ctx, boxX + boxW - 34, y + 12, 26, accent);

    const song = ranks[i] || "—";
    const empty = !ranks[i];
    ctx.textAlign = "center";
    if (empty) {
      ctx.fillStyle = "#9a8a90";
      ctx.font = '500 16px "Zen Kaku Gothic New", sans-serif';
      ctx.fillText(song, boxX + boxW / 2, y + 31);
    } else {
      ctx.font = '400 20px "Mochiy Pop One", "Zen Maru Gothic", sans-serif';
      const lines = wrapTextLines(ctx, song, boxW - 90, 2);
      const lineH = 20;
      const top = y + 28 - ((lines.length - 1) * lineH) / 2;
      lines.forEach((line, li) => {
        drawOutlinedText(ctx, line, boxX + boxW / 2, top + li * lineH, titleFill, "#ffffff");
      });
    }
    ctx.textAlign = "left";
  }

  // Footer group logo — own band below ranks, above credit bar
  const logoBandTop = headerH + RANK_COUNT * rowH + 2;
  if (logo) {
    const maxW = 48;
    const maxH = 30;
    const scale = Math.min(maxW / logo.width, maxH / logo.height);
    const lw = logo.width * scale;
    const lh = logo.height * scale;
    ctx.globalAlpha = 0.92;
    ctx.drawImage(logo, (width - lw) / 2, logoBandTop + (footerLogoH - lh) / 2, lw, lh);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillStyle = accent;
    ctx.font = '700 14px "Zen Maru Gothic", sans-serif';
    ctx.textAlign = "center";
    ctx.globalAlpha = 0.8;
    ctx.fillText(group?.name || "IKONOIJOY", width / 2, logoBandTop + footerLogoH / 2 + 5);
    ctx.globalAlpha = 1;
  }

  // Credit bar
  const cy = height - creditH;
  ctx.fillStyle = "rgba(18,19,23,0.04)";
  ctx.fillRect(0, cy, width, creditH);
  ctx.fillStyle = "#5c6470";
  ctx.font = '500 11px "Zen Kaku Gothic New", sans-serif';
  ctx.textAlign = "left";
  const powered = `Powered by Idol Producer  ·  ${GAME_WEB_URL}`;
  const designed = "Designed by Yunfannas";
  const baseline = cy + creditH / 2 + 4;
  if (brandLogo) {
    const logoH = 22;
    const logoW = (brandLogo.width / brandLogo.height) * logoH;
    ctx.globalAlpha = 0.85;
    ctx.drawImage(brandLogo, 16, cy + (creditH - logoH) / 2, logoW, logoH);
    ctx.fillText(powered, 16 + logoW + 8, baseline);
    ctx.globalAlpha = 1;
  } else {
    ctx.fillText(powered, 16, baseline);
  }
  ctx.fillText(designed, width - 16 - ctx.measureText(designed).width, baseline);

  return canvasToPngBlob(canvas);
}

const data = await fetch("./data.json", { cache: "no-store" }).then((r) => r.json());
assetVersion = String(data?.generated_at || "").trim();
customSongsDb = await loadCustomSongsDb();
onlineSaveIndex = await loadOnlineSaveIndex();
knownGroupNames = [
  ...GROUP_ORDER,
  ...(data.groups || []).map((g) => g.name).filter((n) => n && !GROUP_ORDER.includes(n)),
];

const preferredGroup = localStorage.getItem(LAST_GROUP_KEY) || "";
state.group =
  (data.groups || []).find((g) => g.name === preferredGroup)?.name ||
  data.groups?.[0]?.name ||
  "";
state.charts = ensureChartContainers(state.charts);

const nameInput = document.getElementById("saveName");
const lastName = localStorage.getItem(LAST_NAME_KEY) || "";
if (lastName) nameInput.value = lastName;
refreshSaveNameSuggestions();

spawnPetals();
applyTheme(activeGroup(data));
renderGroupTabs(data);
renderRankSlots(data);
renderPreview();

// Auto-load last Name's charts (local + online gaps).
if (lastName) {
  const existing = readAllSaves()[lastName];
  const local = existing ? normalizeImportedSave({ name: lastName, ...existing }) : null;
  let record = local;
  if (!chartHasPicks(local?.charts) || Object.values(local?.charts || {}).some((r) => !r.some(Boolean))) {
    const online = await fetchOnlineSave(lastName);
    record = mergeSaveRecords(local, online) || local;
    if (record && chartHasPicks(record.charts)) {
      const all = readAllSaves();
      all[lastName] = {
        saved_at: record.saved_at,
        group: record.group,
        charts: record.charts,
      };
      writeAllSaves(all);
    }
  }
  if (record?.charts && chartHasPicks(record.charts)) {
    applySave(data, record, { keepGroup: true });
  }
}

document.getElementById("songSearch").addEventListener("input", () => {
  syncStateFromDom();
  renderRankSlots(data);
});

async function confirmOwnerName() {
  const name = currentOwnerName();
  if (!name) {
    setStatus("Enter a Name first", "err");
    nameInput.focus();
    return;
  }
  // Stash the group we're viewing before load, so we can stay on it.
  syncStateFromDom();
  const viewingGroup = state.group;
  localStorage.setItem(LAST_NAME_KEY, name);
  const all = readAllSaves();
  const local = all[name] ? normalizeImportedSave({ name, ...all[name] }) : null;
  const online = await fetchOnlineSave(name);
  let record = mergeSaveRecords(local, online) || local || online;
  if (record?.charts) {
    all[name] = {
      saved_at: record.saved_at,
      group: record.group,
      charts: ensureChartContainers(record.charts),
    };
    writeAllSaves(all);
  }
  if (record?.charts && chartHasPicks(record.charts)) {
    // Keep current tab; restore every group's saved chart into memory.
    applySave(data, record, { keepGroup: true });
    // If current tab has no picks but another group does, jump to a filled one.
    if (!currentRanks().some(Boolean)) {
      const filledGroup =
        (record.charts[viewingGroup]?.some(Boolean) && viewingGroup) ||
        Object.keys(record.charts).find((g) => record.charts[g].some(Boolean));
      if (filledGroup && filledGroup !== state.group) {
        state.group = filledGroup;
        localStorage.setItem(LAST_GROUP_KEY, filledGroup);
        applyTheme(activeGroup(data));
        renderGroupTabs(data);
        renderRankSlots(data);
        renderPreview();
      }
    }
    const filled = Object.values(record.charts).filter((ranks) => ranks.some(Boolean)).length;
    refreshSaveNameSuggestions();
    setStatus(`Loaded “${name}” (${filled} group${filled === 1 ? "" : "s"})`, "ok");
  } else {
    refreshSaveNameSuggestions();
    setStatus(`No saved chart for “${name}” — pick and Save`, "ok");
  }
}

document.getElementById("confirmName").addEventListener("click", confirmOwnerName);
nameInput.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter") {
    ev.preventDefault();
    confirmOwnerName();
  }
});

document.getElementById("saveNamed").addEventListener("click", () => {
  const name = currentOwnerName();
  if (!name) {
    setStatus("Enter a Name first", "err");
    nameInput.focus();
    return;
  }
  const record = persistCurrentNameCharts(state.group);
  refreshSaveNameSuggestions();
  const filled = Object.values(record?.charts || {}).filter((ranks) => ranks.some(Boolean)).length;
  setStatus(`Saved “${name}” locally (${filled} group${filled === 1 ? "" : "s"})`, "ok");
});

document.getElementById("exportSaveJson").addEventListener("click", () => {
  const name = currentOwnerName();
  if (!name) {
    setStatus("Enter a Name first", "err");
    nameInput.focus();
    return;
  }
  const record = persistCurrentNameCharts(state.group);
  const payload = onlineSavePayload(name, record);
  const filename = `${safeFileStem(name)}.json`;
  downloadBlob(
    new Blob([JSON.stringify(payload, null, 2) + "\n"], { type: "application/json" }),
    filename,
  );
  setStatus(`Exported ${filename} — place in public/ikonoijoy/saves/ to publish online`, "ok");
});

const importSaveFile = document.getElementById("importSaveFile");
document.getElementById("importSaveJson").addEventListener("click", () => {
  importSaveFile?.click();
});

importSaveFile?.addEventListener("change", async (ev) => {
  const file = ev.target?.files?.[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const record = normalizeImportedSave(raw);
    if (!record) throw new Error("invalid save");
    saveNamedRecord(record.name, record);
    nameInput.value = record.name;
    applySave(data, record, { keepGroup: false });
    refreshSaveNameSuggestions();
    const filled = Object.values(record.charts).filter((ranks) => ranks.some(Boolean)).length;
    setStatus(`Imported “${record.name}” (${filled} group${filled === 1 ? "" : "s"})`, "ok");
  } catch (err) {
    console.error(err);
    setStatus("Could not import save JSON", "err");
  } finally {
    ev.target.value = "";
  }
});

document.getElementById("clearAll").addEventListener("click", () => {
  setRanksForGroup(state.group, emptyRanks());
  document.getElementById("songSearch").value = "";
  renderRankSlots(data);
  renderPreview();
  setStatus(`Cleared ${state.group || "chart"}`, "ok");
});

document.getElementById("savePng").addEventListener("click", async () => {
  const btn = document.getElementById("savePng");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    syncStateFromDom();
    const blob = await renderBest10Png(data);
    if (!blob) throw new Error("export failed");
    const stem = safeFileStem(currentOwnerName() || state.group || "ikonoijoy-best10");
    const groupPart = safeFileStem(state.group || "group");
    downloadBlob(blob, `${stem}-${groupPart}-best10.png`);
    setStatus("Downloaded PNG", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Could not download PNG", "err");
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});
