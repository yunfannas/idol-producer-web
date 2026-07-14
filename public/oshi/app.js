const SAVES_KEY = "heroines-oshi-saves-v1";
const LAST_NAME_KEY = "heroines-oshi-last-name";
const CUSTOM_SONGS_KEY = "heroines-oshi-custom-songs-v1";
const GAME_WEB_URL = "https://yunfannas.github.io/idol-producer-web/";

/** Working custom-song DB (file + localStorage pending adds). */
let customSongsDb = { version: 1, updated_at: null, entries: [] };

function contrastInk(hex) {
  if (!hex || !hex.startsWith("#") || hex.length < 7) return "#fff6fb";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luma = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luma > 0.72 ? "#1a0612" : "#fff6fb";
}

function formatRomanji(value) {
  if (!value) return "";
  return String(value).replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function optionLabel(member) {
  return member.color ? `${member.name}（${member.color}）` : member.name;
}

function groupsFromData(data) {
  if (Array.isArray(data.groups) && data.groups.length) return data.groups;
  return (data.sheets || []).flatMap((sheet) => sheet.groups || []);
}

function makeImg(src, className, alt, opts = {}) {
  const img = document.createElement("img");
  img.className = className;
  img.alt = alt || "";
  img.loading = opts.loading || "lazy";
  img.decoding = opts.decoding || "async";
  img.referrerPolicy = "no-referrer";
  if (opts.width) img.width = opts.width;
  if (opts.height) img.height = opts.height;
  if (src) {
    img.src = src;
    img.addEventListener(
      "error",
      () => {
        img.replaceWith(makePh(className, alt));
      },
      { once: true },
    );
  }
  return img;
}

function makePh(className, label) {
  const ph = document.createElement("div");
  ph.className = `${className} ph`;
  ph.setAttribute("aria-hidden", "true");
  ph.textContent = [...(label || "?")][0] || "?";
  return ph;
}

const CUSTOM_SONG_VALUE = "__custom__";

function emptyCustomSongsDb() {
  return {
    version: 1,
    updated_at: null,
    note: "User-submitted custom 推し曲 titles. Confirm and merge into public/data/songs.json later.",
    entries: [],
  };
}

function normalizeCustomSongsDb(raw) {
  const db = emptyCustomSongsDb();
  if (!raw || typeof raw !== "object") return db;
  db.version = Number(raw.version) || 1;
  db.updated_at = raw.updated_at || null;
  if (typeof raw.note === "string") db.note = raw.note;
  const entries = Array.isArray(raw.entries) ? raw.entries : [];
  const seen = new Set();
  for (const row of entries) {
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
  out.updated_at = out.entries.reduce((max, e) => {
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
    /* start empty */
  }
  return mergeCustomSongsDb(fileDb, readLocalCustomSongs());
}

function customTitlesForGroup(group) {
  const name = group?.name || "";
  const uid = group?.uid || "";
  return customSongsDb.entries
    .filter((e) => e.group_name === name || (uid && e.group_uid === uid))
    .map((e) => e.title);
}

function songsForGroupSelect(group) {
  const catalog = [...(group.songs || [])];
  const seen = new Set(catalog.map((s) => String(s.title || "").trim()).filter(Boolean));
  const out = catalog.map((s) => ({ title: s.title, source: "catalog", uid: s.uid || null }));
  for (const title of customTitlesForGroup(group)) {
    if (!title || seen.has(title)) continue;
    seen.add(title);
    out.push({ title, source: "custom", uid: null });
  }
  return out;
}

function persistCustomSong(group, title) {
  const clean = String(title || "").trim();
  if (!clean || !group?.name) return null;
  const inCatalog = (group.songs || []).some((s) => String(s.title || "").trim() === clean);
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

function fillSelect(select, blankLabel, emptyLabel, items, getValue, getLabel, setDataset) {
  select.replaceChildren();
  const blank = document.createElement("option");
  blank.value = "";
  blank.textContent = items.length ? blankLabel : emptyLabel;
  select.appendChild(blank);
  for (const item of items) {
    const opt = document.createElement("option");
    opt.value = getValue(item);
    opt.textContent = getLabel(item);
    if (setDataset) setDataset(opt, item);
    select.appendChild(opt);
  }
  select.value = "";
}

function addCustomSongOption(select) {
  const opt = document.createElement("option");
  opt.value = CUSTOM_SONG_VALUE;
  opt.textContent = "Custom";
  // Keep Custom next to 未選択 (not at the bottom of the song list)
  if (select.options.length > 0) {
    select.options[0].after(opt);
  } else {
    select.appendChild(opt);
  }
}

function fillSongSelect(songSelect, group) {
  const songs = songsForGroupSelect(group);
  fillSelect(
    songSelect,
    "未選択",
    "曲未登録",
    songs,
    (s) => s.title,
    (s) => (s.source === "custom" ? `${s.title} · custom` : s.title),
    (opt, s) => {
      if (s.source === "custom") opt.dataset.customSong = "1";
    },
  );
  addCustomSongOption(songSelect);
  return songs;
}

function readableMemberStyle(hex) {
  // Member color only on the closed select background; name stays black unless bg is dark.
  const ink = contrastInk(hex);
  return {
    color: ink === "#1a0612" ? "#121317" : "#fff6fb",
    background: hex || "#fff",
  };
}

function songValueFromRow(tr) {
  const songSelect = tr.querySelector(".song-select");
  const songCustom = tr.querySelector(".song-custom");
  if (!songSelect) return "";
  if (songSelect.value === CUSTOM_SONG_VALUE) {
    const typed = (songCustom?.value || "").trim();
    if (typed) return typed;
    return (tr.dataset.customSong || "").trim();
  }
  return songSelect.value || "";
}

function setCustomSongVisible(songCustom, visible) {
  if (!songCustom) return;
  songCustom.hidden = !visible;
  const shell = songCustom.parentElement;
  shell?.classList.toggle("is-custom", visible);
  const saveBtn = shell?.querySelector(".btn-song-save");
  if (saveBtn) saveBtn.hidden = !visible;
  if (!visible) return;
  songCustom.focus();
}

function applySongPick(songSelect, songCustom, song) {
  if (!songSelect || !songCustom) return;
  const titles = [...songSelect.options]
    .map((o) => o.value)
    .filter((v) => v && v !== CUSTOM_SONG_VALUE);
  if (song && titles.includes(song)) {
    songSelect.value = song;
    songCustom.value = "";
    setCustomSongVisible(songCustom, false);
  } else if (song) {
    songSelect.value = CUSTOM_SONG_VALUE;
    songCustom.value = song;
    setCustomSongVisible(songCustom, true);
  } else {
    songSelect.value = "";
    songCustom.value = "";
    setCustomSongVisible(songCustom, false);
  }
}

function readAllSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVES_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeAllSaves(saves) {
  localStorage.setItem(SAVES_KEY, JSON.stringify(saves));
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

function collectPicks() {
  const picks = {};
  document.querySelectorAll("tr[data-group]").forEach((tr) => {
    const group = tr.dataset.group;
    const songSelect = tr.querySelector(".song-select");
    const songCustom = tr.querySelector(".song-custom");
    const song = songValueFromRow(tr);
    picks[group] = {
      member: tr.querySelector(".member-select")?.value || "",
      song,
      // Keep explicit custom flag so reload restores Custom even if title matched a catalog song later
      songCustom: songSelect?.value === CUSTOM_SONG_VALUE,
      customSong: songSelect?.value === CUSTOM_SONG_VALUE ? (songCustom?.value || "").trim() || song : "",
    };
  });
  return picks;
}

function applyPicks(picks) {
  if (!picks) return;
  document.querySelectorAll("tr[data-group]").forEach((tr) => {
    const group = tr.dataset.group;
    const saved = picks[group] || {};
    const memberSelect = tr.querySelector(".member-select");
    const songSelect = tr.querySelector(".song-select");
    const songCustom = tr.querySelector(".song-custom");
    if (memberSelect) {
      memberSelect.value = saved.member || "";
      memberSelect.dispatchEvent(new Event("change"));
    }
    const songTitle =
      saved.songCustom && (saved.customSong || saved.song)
        ? saved.customSong || saved.song
        : saved.song || "";
    if (saved.songCustom && songTitle) {
      // Force custom path even if title coincides with a catalog option
      if (songSelect && songCustom) {
        songSelect.value = CUSTOM_SONG_VALUE;
        songCustom.value = songTitle;
        tr.dataset.customSong = songTitle;
        setCustomSongVisible(songCustom, true);
      }
    } else {
      applySongPick(songSelect, songCustom, songTitle);
      if (songTitle) tr.dataset.customSong = "";
    }
  });
}

function currentOwnerName() {
  return (document.getElementById("saveName")?.value || "").trim();
}

function safeFileStem(name) {
  const base = (name || "oshi-chart").trim() || "oshi-chart";
  return base.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_").slice(0, 80);
}

function render(data, picks = null) {
  const root = document.getElementById("sheets");
  root.innerHTML = "";

  const section = document.createElement("section");
  section.className = "sheet active";

  const table = document.createElement("table");
  table.className = "chart";
  table.id = "oshiChart";
  table.innerHTML = `
    <thead>
      <tr>
        <th scope="col">グループ</th>
        <th scope="col">推しメン</th>
        <th scope="col">推し曲</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  groupsFromData(data).forEach((group) => {
    const tr = document.createElement("tr");
    tr.dataset.group = group.name;

    const groupTd = document.createElement("td");
    groupTd.className = "group-cell";
    const groupRow = document.createElement("div");
    groupRow.className = "group-identity";
    if (group.logo_url) {
      groupRow.appendChild(makeImg(group.logo_url, "group-logo", group.name));
    } else {
      groupRow.appendChild(makePh("group-logo", group.name));
    }
    const groupText = document.createElement("div");
    groupText.className = "group-text";
    const romanji = formatRomanji(group.name_romanji);
    groupText.innerHTML = `
      <p class="group-name">${group.name}</p>
      ${romanji ? `<p class="group-romanji">${romanji}</p>` : ""}
    `;
    groupRow.appendChild(groupText);
    groupTd.appendChild(groupRow);

    const memberTd = document.createElement("td");
    memberTd.className = "pick-cell member-cell";
    const memberShell = document.createElement("div");
    memberShell.className = "pick-shell";

    const portraitSlot = document.createElement("div");
    portraitSlot.className = "member-portrait-slot";
    portraitSlot.appendChild(makePh("member-portrait", "?"));

    const memberSelect = document.createElement("select");
    memberSelect.className = "pick-select member-select";
    memberSelect.setAttribute("aria-label", `${group.name} 推しメン`);
    fillSelect(
      memberSelect,
      "未選択",
      "メンバー未登録",
      group.members || [],
      (m) => m.name,
      optionLabel,
      (opt, m) => {
        opt.dataset.colorHex = m.color_hex || "#eceff1";
        if (m.portrait_url) opt.dataset.portraitUrl = m.portrait_url;
      },
    );

    const paintMemberClosed = () => {
      const selected = memberSelect.selectedOptions[0];
      const name = memberSelect.value;
      portraitSlot.replaceChildren();
      if (!name) {
        portraitSlot.appendChild(makePh("member-portrait", "?"));
        memberSelect.style.color = "";
        memberSelect.style.backgroundColor = "";
        memberShell.classList.remove("has-pick");
        return;
      }
      const hex = selected?.dataset.colorHex || "#eceff1";
      const portraitUrl = selected?.dataset.portraitUrl || "";
      if (portraitUrl) {
        portraitSlot.appendChild(
          makeImg(portraitUrl, "member-portrait", name, {
            width: 144,
            height: 144,
            loading: "eager",
            decoding: "sync",
          }),
        );
      } else {
        portraitSlot.appendChild(makePh("member-portrait", name));
      }
      const style = readableMemberStyle(hex);
      // Closed: tint background with member color; name black (or white on dark bg).
      memberSelect.style.color = style.color;
      memberSelect.style.backgroundColor = style.background;
      memberShell.classList.add("has-pick");
    };

    const paintMemberOpen = () => {
      // While the pull-down is open / focused, keep readable black text on white.
      memberSelect.style.color = "#121317";
      memberSelect.style.backgroundColor = "#fff";
    };

    memberSelect.addEventListener("change", paintMemberClosed);
    memberSelect.addEventListener("focus", paintMemberOpen);
    memberSelect.addEventListener("blur", paintMemberClosed);
    memberShell.append(portraitSlot, memberSelect);
    memberTd.appendChild(memberShell);
    memberTd.addEventListener("click", (ev) => {
      if (ev.target === memberSelect) return;
      memberSelect.focus();
      memberSelect.showPicker?.();
    });

    const songTd = document.createElement("td");
    songTd.className = "pick-cell song-cell";
    const songShell = document.createElement("div");
    songShell.className = "song-shell";

    const songSelect = document.createElement("select");
    songSelect.className = "pick-select song-select";
    songSelect.setAttribute("aria-label", `${group.name} 推し曲`);
    fillSongSelect(songSelect, group);

    const songCustom = document.createElement("input");
    songCustom.type = "text";
    songCustom.className = "song-custom";
    songCustom.hidden = true;
    songCustom.setAttribute("aria-label", `${group.name} カスタム推し曲`);
    songCustom.placeholder = "Custom title";
    songCustom.autocomplete = "off";

    const songSaveBtn = document.createElement("button");
    songSaveBtn.type = "button";
    songSaveBtn.className = "btn-song-save";
    songSaveBtn.hidden = true;
    songSaveBtn.title = "Save custom song to database";
    songSaveBtn.setAttribute("aria-label", `Save custom song for ${group.name}`);
    songSaveBtn.textContent = "✓";

    songSelect.addEventListener("change", () => {
      const isCustom = songSelect.value === CUSTOM_SONG_VALUE;
      setCustomSongVisible(songCustom, isCustom);
      songSaveBtn.hidden = !isCustom;
      if (!isCustom) {
        songCustom.value = "";
        delete tr.dataset.customSong;
      }
    });
    songCustom.addEventListener("input", () => {
      tr.dataset.customSong = songCustom.value;
    });
    songCustom.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        ev.preventDefault();
        songSaveBtn.click();
      }
    });
    songSaveBtn.addEventListener("click", () => {
      const title = (songCustom.value || "").trim();
      if (!title) {
        setStatus("Enter a custom song title first", "err");
        songCustom.focus();
        return;
      }
      const result = persistCustomSong(group, title);
      if (!result) return;
      const prev = songSelect.value;
      fillSongSelect(songSelect, group);
      // Prefer the saved title as a normal pull-down option
      if ([...songSelect.options].some((o) => o.value === result.title)) {
        songSelect.value = result.title;
        songCustom.value = "";
        delete tr.dataset.customSong;
        setCustomSongVisible(songCustom, false);
        songSaveBtn.hidden = true;
      } else {
        songSelect.value = prev || CUSTOM_SONG_VALUE;
      }
      if (result.added) downloadCustomSongsDb();
      if (result.catalog) {
        setStatus(`“${result.title}” is already in the catalog list`, "ok");
      } else if (result.added) {
        setStatus(
          `Saved “${result.title}” to custom_songs.json — drop into public/oshi/ to share`,
          "ok",
        );
      } else {
        setStatus(`“${result.title}” already in custom song DB`, "ok");
      }
    });

    songShell.append(songCustom, songSaveBtn, songSelect);
    songTd.appendChild(songShell);
    tr.append(groupTd, memberTd, songTd);
    tbody.appendChild(tr);
  });

  section.appendChild(table);
  root.appendChild(section);

  if (picks) applyPicks(picks);
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
    img.src = src;
  });
}

function wrapTextLines(ctx, text, maxWidth, maxLines = 3) {
  const chars = [...String(text || "")];
  if (!chars.length) return [""];
  const lines = [];
  let cur = "";
  let truncated = false;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
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
    while (last.length && ctx.measureText(`${last}…`).width > maxWidth) last = [...last].slice(0, -1).join("");
    lines[lines.length - 1] = `${last}…`;
  }
  return lines.length ? lines : [""];
}

function drawWrappedCentered(ctx, text, cx, topY, maxWidth, lineH, maxLines = 3) {
  const lines = wrapTextLines(ctx, text, maxWidth, maxLines);
  ctx.textAlign = "center";
  lines.forEach((line, i) => {
    ctx.fillText(line, cx, topY + i * lineH);
  });
  ctx.textAlign = "left";
  return lines.length;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png"));
}

async function blobToUint8Array(blob) {
  const buf = await blob.arrayBuffer();
  return new Uint8Array(buf);
}

/** Store-only ZIP (PNGs are already compressed). */
function createZipStore(files) {
  const enc = new TextEncoder();
  const u16 = (n) => {
    const b = new Uint8Array(2);
    new DataView(b.buffer).setUint16(0, n, true);
    return b;
  };
  const u32 = (n) => {
    const b = new Uint8Array(4);
    new DataView(b.buffer).setUint32(0, n >>> 0, true);
    return b;
  };
  const crcTable = (() => {
    const t = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
      let c = i;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[i] = c >>> 0;
    }
    return t;
  })();
  const crc32 = (data) => {
    let c = 0xffffffff;
    for (let i = 0; i < data.length; i++) c = crcTable[(c ^ data[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const parts = [];
  const central = [];
  let offset = 0;
  for (const file of files) {
    const nameBytes = enc.encode(file.name);
    const data = file.data;
    const crc = crc32(data);
    const local = [
      u32(0x04034b50),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      nameBytes,
      data,
    ];
    const localSize = 30 + nameBytes.length + data.length;
    central.push(
      u32(0x02014b50),
      u16(20),
      u16(20),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(crc),
      u32(data.length),
      u32(data.length),
      u16(nameBytes.length),
      u16(0),
      u16(0),
      u16(0),
      u16(0),
      u32(0),
      u32(offset),
      nameBytes,
    );
    for (const p of local) parts.push(p);
    offset += localSize;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const p of central) {
    parts.push(p);
    centralSize += p.length;
  }
  parts.push(
    u32(0x06054b50),
    u16(0),
    u16(0),
    u16(files.length),
    u16(files.length),
    u32(centralSize),
    u32(centralStart),
    u16(0),
  );
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function drawCreditBar(ctx, width, height, creditH, brandLogo, padX = 20) {
  const cy = height - creditH;
  ctx.fillStyle = "rgba(18,19,23,0.04)";
  ctx.fillRect(0, cy, width, creditH);
  ctx.globalAlpha = 0.75;
  ctx.fillStyle = "#5c6470";
  ctx.font = '500 11px "Zen Kaku Gothic New", sans-serif';
  const powered = `Powered by Idol Producer  ·  ${GAME_WEB_URL}`;
  const designed = "Designed by Yunfannas";
  const baseline = cy + creditH / 2 + 4;
  if (brandLogo) {
    const logoH = 24;
    const logoW = (brandLogo.width / brandLogo.height) * logoH;
    ctx.drawImage(brandLogo, padX, cy + (creditH - logoH) / 2, logoW, logoH);
    ctx.fillText(powered, padX + logoW + 8, baseline);
  } else {
    ctx.fillText(`${powered}  ·  ${designed}`, padX, baseline);
    ctx.globalAlpha = 1;
    return;
  }
  ctx.fillText(designed, width - padX - ctx.measureText(designed).width, baseline);
  ctx.globalAlpha = 1;
}

async function renderSheetTable(groups, picks, brandLogo, opts = {}) {
  const {
    width = 900,
    rowH = 108,
    colLogo = 118,
    colMember = 320,
  } = opts;

  // No page title — only the table + bottom footage (credit bar), like the original charts.
  const padX = 10;
  const padTop = 10;
  const headerH = 32;
  const creditH = 40;
  const tableW = width - padX * 2;
  const colSong = tableW - colLogo - colMember;
  const height = padTop + headerH + groups.length * rowH + creditH + 8;

  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  const hx = padX;
  const hy = padTop;

  // Outer table border (original chart style)
  ctx.strokeStyle = "#121317";
  ctx.lineWidth = 2;
  ctx.strokeRect(hx + 0.5, hy + 0.5, tableW - 1, headerH + groups.length * rowH - 1);

  ctx.fillStyle = "#121317";
  ctx.fillRect(hx, hy, tableW, headerH);
  ctx.fillStyle = "#ffffff";
  ctx.font = '700 14px "Zen Kaku Gothic New", sans-serif';
  ctx.fillText("グループ", hx + 12, hy + 21);
  ctx.fillText("推しメン", hx + colLogo + 12, hy + 21);
  ctx.fillText("推し曲", hx + colLogo + colMember + 12, hy + 21);

  ctx.strokeStyle = "rgba(255,255,255,0.4)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(hx + colLogo, hy + 4);
  ctx.lineTo(hx + colLogo, hy + headerH - 4);
  ctx.moveTo(hx + colLogo + colMember, hy + 4);
  ctx.lineTo(hx + colLogo + colMember, hy + headerH - 4);
  ctx.stroke();

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const y = hy + headerH + i * rowH;

    ctx.strokeStyle = "#121317";
    ctx.lineWidth = 1.25;
    ctx.strokeRect(hx + 0.5, y + 0.5, tableW - 1, rowH - 1);
    ctx.beginPath();
    ctx.moveTo(hx + colLogo, y);
    ctx.lineTo(hx + colLogo, y + rowH);
    ctx.moveTo(hx + colLogo + colMember, y);
    ctx.lineTo(hx + colLogo + colMember, y + rowH);
    ctx.stroke();

    const pick = picks[group.name] || {};
    const member = (group.members || []).find((m) => m.name === pick.member);
    const logo = await loadImage(group.logo_url);
    const portrait = await loadImage(member?.portrait_url);

    // Icon-only group cell (no name text), matching original logo tiles
    const iconSize = Math.min(colLogo - 16, rowH - 16);
    const iconX = hx + (colLogo - iconSize) / 2;
    const iconY = y + (rowH - iconSize) / 2;
    if (logo) {
      ctx.drawImage(logo, iconX, iconY, iconSize, iconSize);
    } else {
      ctx.fillStyle = "#eceff3";
      ctx.fillRect(iconX, iconY, iconSize, iconSize);
    }

    // Member portrait fills row height (matches group icon scale)
    const portraitPad = 8;
    const portraitSize = rowH - portraitPad * 2;
    if (portrait) {
      drawRoundedCover(
        ctx,
        portrait,
        hx + colLogo + portraitPad,
        y + portraitPad,
        portraitSize,
        portraitSize,
        12,
      );
    }

    // Name only — no member color text in the 4 sheet exports
    const memberLabel = member?.name || "—";
    const hex = member?.color_hex || "#eceff3";
    const ink = contrastInk(hex);
    const textColor = ink === "#1a0612" ? "#121317" : "#fff6fb";
    const nameChipH = Math.round(portraitSize * 0.52);
    const nameFont = Math.round(nameChipH * 0.55);
    const mx = hx + colLogo + (portrait ? portraitPad + portraitSize + 14 : 16);
    const my = y + (rowH - nameChipH) / 2;
    ctx.font = `700 ${nameFont}px "Zen Kaku Gothic New", sans-serif`;
    const mw = Math.min(
      ctx.measureText(memberLabel).width + 20,
      colMember - (portrait ? portraitPad + portraitSize + 28 : 32),
    );
    roundRect(ctx, mx, my, Math.max(mw, 40), nameChipH, 10);
    ctx.fillStyle = member ? hex : "#f3f4f6";
    ctx.fill();
    ctx.fillStyle = member ? textColor : "#5c6470";
    ctx.fillText(memberLabel, mx + 10, my + nameChipH * 0.68);

    ctx.fillStyle = "#121317";
    ctx.font = '500 16px "Zen Kaku Gothic New", sans-serif';
    const song = pick.song || "—";
    const songMax = colSong - 24;
    const songLines = wrapTextLines(ctx, song, songMax, 2);
    const songTop = y + rowH / 2 - ((songLines.length - 1) * 18) / 2 + 5;
    songLines.forEach((line, li) => {
      ctx.fillText(line, hx + colLogo + colMember + 14, songTop + li * 18);
    });
  }

  drawCreditBar(ctx, width, height, creditH, brandLogo, padX + 4);
  return canvasToPngBlob(canvas);
}

async function renderFullList(groups, picks, brandLogo, owner) {
  const rowH = 58;
  const padX = 28;
  const padTop = 100;
  const creditH = 48;
  const width = 980;
  const height = padTop + groups.length * rowH + creditH + 16;
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext("2d");
  ctx.scale(2, 2);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  ctx.fillStyle = "#e91e8c";
  ctx.font = '700 40px "Bebas Neue", "Zen Kaku Gothic New", sans-serif';
  ctx.fillText("HEROINES", padX, 44);
  ctx.fillStyle = "#121317";
  ctx.font = '700 26px "Shippori Mincho", serif';
  ctx.fillText("推しチャート", padX, 78);
  if (owner) {
    ctx.fillStyle = "#5c6470";
    ctx.font = '500 16px "Zen Kaku Gothic New", sans-serif';
    ctx.fillText(owner, padX + 200, 74);
  }

  ctx.strokeStyle = "rgba(18,19,23,0.12)";
  ctx.beginPath();
  ctx.moveTo(padX, 90);
  ctx.lineTo(width - padX, 90);
  ctx.stroke();

  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    const y = padTop + i * rowH;
    const pick = picks[group.name] || {};
    const member = (group.members || []).find((m) => m.name === pick.member);
    const logo = await loadImage(group.logo_url);
    const portrait = await loadImage(member?.portrait_url);

    if (i % 2 === 0) {
      ctx.fillStyle = "rgba(18,19,23,0.03)";
      ctx.fillRect(padX - 6, y - 4, width - padX * 2 + 12, rowH - 2);
    }

    const gColW = 160;
    if (logo) {
      ctx.drawImage(logo, padX, y + 6, 36, 36);
    } else {
      ctx.fillStyle = "#eceff3";
      ctx.fillRect(padX, y + 6, 36, 36);
    }
    ctx.fillStyle = "#121317";
    ctx.font = '600 10px "Zen Kaku Gothic New", sans-serif';
    const nameLines = wrapTextLines(ctx, group.name, gColW - 48, 3);
    nameLines.forEach((line, li) => {
      ctx.fillText(line, padX + 44, y + 18 + li * 11);
    });

    if (portrait) {
      drawRoundedCover(ctx, portrait, padX + gColW, y + 8, 40, 40, 10);
    }

    const memberLabel = member
      ? member.color
        ? `${member.name}（${member.color}）`
        : member.name
      : "—";
    const hex = member?.color_hex || "#eceff3";
    const ink = contrastInk(hex);
    const textColor = ink === "#1a0612" ? "#121317" : "#fff6fb";
    const mx = padX + gColW + (portrait ? 52 : 8);
    ctx.font = '700 14px "Zen Kaku Gothic New", sans-serif';
    const mw = Math.min(ctx.measureText(memberLabel).width + 14, 280);
    roundRect(ctx, mx, y + 14, Math.max(mw, 28), 28, 8);
    ctx.fillStyle = member ? hex : "#f3f4f6";
    ctx.fill();
    ctx.fillStyle = member ? textColor : "#5c6470";
    ctx.fillText(memberLabel, mx + 7, y + 33);

    ctx.fillStyle = "#121317";
    ctx.font = '500 14px "Zen Kaku Gothic New", sans-serif';
    const song = pick.song || "—";
    const songLines = wrapTextLines(ctx, song, 300, 2);
    songLines.forEach((line, li) => {
      ctx.fillText(line, 620, y + 28 + li * 15);
    });
  }

  drawCreditBar(ctx, width, height, creditH, brandLogo, padX);
  return canvasToPngBlob(canvas);
}

async function prepareExport(data) {
  const owner = currentOwnerName();
  const groups = groupsFromData(data);
  const picks = collectPicks();
  const brandLogo = await loadImage("../idol-producer-logo.png");
  const sheets = [[], [], [], []];
  groups.forEach((g, i) => sheets[Math.min(3, Math.floor(i / 7))].push(g));
  return { owner, groups, picks, brandLogo, sheets };
}

const SHEET_RENDER_OPTS = {
  width: 900,
  rowH: 110,
  colLogo: 120,
  colMember: 320,
};

async function renderExportPng(prepared, which) {
  const { owner, groups, picks, brandLogo, sheets } = prepared;
  if (which === "full") {
    return {
      blob: await renderFullList(groups, picks, brandLogo, owner),
      filenamePart: "00-full-list",
      label: "full list",
    };
  }
  const idx = Number(which) - 1;
  if (idx < 0 || idx > 3) throw new Error(`unknown export: ${which}`);
  return {
    blob: await renderSheetTable(sheets[idx], picks, brandLogo, SHEET_RENDER_OPTS),
    filenamePart: `0${idx + 1}-sheet-${idx + 1}`,
    label: `sheet ${idx + 1}`,
  };
}

async function exportChartZip(data) {
  const prepared = await prepareExport(data);
  const parts = ["full", "1", "2", "3", "4"];
  const files = [];
  for (const which of parts) {
    const { blob, filenamePart } = await renderExportPng(prepared, which);
    files.push({
      name: `${filenamePart}.png`,
      data: await blobToUint8Array(blob),
    });
  }
  const zipBytes = createZipStore(files);
  return new Blob([zipBytes], { type: "application/zip" });
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draw image into dest rect with object-fit: cover (no stretch/distortion). */
function drawImageCover(ctx, img, dx, dy, dw, dh) {
  const sw = img.naturalWidth || img.width;
  const sh = img.naturalHeight || img.height;
  if (!sw || !sh || !dw || !dh) return;
  const scale = Math.max(dw / sw, dh / sh);
  const cw = dw / scale;
  const ch = dh / scale;
  const sx = (sw - cw) / 2;
  const sy = (sh - ch) / 2;
  ctx.drawImage(img, sx, sy, cw, ch, dx, dy, dw, dh);
}

function drawRoundedCover(ctx, img, x, y, w, h, r) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();
  drawImageCover(ctx, img, x, y, w, h);
  ctx.restore();
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildNamedSaveRecord(name, picks) {
  return {
    name,
    saved_at: new Date().toISOString(),
    picks,
  };
}

function saveNamedRecord(name, record) {
  const all = readAllSaves();
  all[name] = {
    saved_at: record.saved_at || new Date().toISOString(),
    picks: record.picks || {},
  };
  writeAllSaves(all);
  localStorage.setItem(LAST_NAME_KEY, name);
}

function normalizeImportedSave(raw) {
  if (!raw || typeof raw !== "object") return null;
  const name = String(raw.name || "").trim();
  const picks = raw.picks;
  if (!name || !picks || typeof picks !== "object") return null;
  return {
    name,
    saved_at: raw.saved_at || new Date().toISOString(),
    picks,
  };
}

const data = await fetch("./data.json").then((r) => r.json());
customSongsDb = await loadCustomSongsDb();

const nameInput = document.getElementById("saveName");
const lastName = localStorage.getItem(LAST_NAME_KEY) || "";
if (lastName) nameInput.value = lastName;

// Don't auto-load until Name is Confirmed — start blank unless confirmed below.
render(data, null);

async function confirmOwnerName() {
  const name = currentOwnerName();
  if (!name) {
    setStatus("Enter a Name first", "err");
    nameInput.focus();
    return;
  }
  localStorage.setItem(LAST_NAME_KEY, name);
  const all = readAllSaves();
  let record = all[name];
  if (!record?.picks) {
    try {
      const res = await fetch(`./saves/${encodeURIComponent(name)}.json`, { cache: "no-store" });
      if (res.ok) {
        record = await res.json();
        if (record?.picks) {
          all[name] = {
            saved_at: record.saved_at || new Date().toISOString(),
            picks: record.picks,
          };
          writeAllSaves(all);
        }
      }
    } catch {
      /* no file backup */
    }
  }
  if (record?.picks) {
    applyPicks(record.picks);
    setStatus(`Loaded “${name}”`, "ok");
  } else {
    setStatus(`No saved chart for “${name}” — pick and Save`, "ok");
  }
}

document.getElementById("clearAll").addEventListener("click", () => {
  render(data, null);
  setStatus("Cleared", "ok");
});

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
  saveNamedRecord(name, buildNamedSaveRecord(name, collectPicks()));
  setStatus(`Saved “${name}” on this site`, "ok");
});

document.getElementById("exportSaveJson").addEventListener("click", () => {
  const name = currentOwnerName();
  if (!name) {
    setStatus("Enter a Name first", "err");
    nameInput.focus();
    return;
  }
  const record = buildNamedSaveRecord(name, collectPicks());
  saveNamedRecord(name, record);
  downloadBlob(
    new Blob([JSON.stringify(record, null, 2) + "\n"], { type: "application/json" }),
    `${safeFileStem(name)}-heroines-oshi-save.json`,
  );
  setStatus(`Exported “${name}” save JSON`, "ok");
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
    applyPicks(record.picks);
    setStatus(`Imported “${record.name}” from JSON`, "ok");
  } catch (err) {
    console.error(err);
    setStatus("Could not import save JSON", "err");
  } finally {
    ev.target.value = "";
  }
});

document.getElementById("saveToFile").addEventListener("click", async () => {
  const btn = document.getElementById("saveToFile");
  const prev = btn.textContent;
  btn.disabled = true;
  btn.textContent = "Saving…";
  try {
    const blob = await exportChartZip(data);
    if (!blob) throw new Error("export failed");
    const stem = safeFileStem(currentOwnerName() || "oshi-chart");
    downloadBlob(blob, `${stem}-heroines-oshi.zip`);
    setStatus("ZIP downloaded (5 images)", "ok");
  } catch (err) {
    console.error(err);
    setStatus("Could not create ZIP", "err");
  } finally {
    btn.disabled = false;
    btn.textContent = prev;
  }
});

document.querySelectorAll("[data-export]").forEach((btn) => {
  btn.addEventListener("click", async () => {
    const which = btn.getAttribute("data-export");
    const prev = btn.textContent;
    btn.disabled = true;
    btn.textContent = "…";
    try {
      const prepared = await prepareExport(data);
      const { blob, filenamePart, label } = await renderExportPng(prepared, which);
      if (!blob) throw new Error("export failed");
      const stem = safeFileStem(currentOwnerName() || "oshi-chart");
      downloadBlob(blob, `${stem}-${filenamePart}.png`);
      setStatus(`Saved ${label} PNG`, "ok");
    } catch (err) {
      console.error(err);
      setStatus("Could not save PNG", "err");
    } finally {
      btn.disabled = false;
      btn.textContent = prev;
    }
  });
});
