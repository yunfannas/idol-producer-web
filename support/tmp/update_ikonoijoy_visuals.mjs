import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { upsertGroupPortraitHistory } from "../scripts/groupPortraitHistory.mjs";
import { upsertGroupPictureHistory } from "../scripts/groupPictureHistory.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roots = [
  path.resolve(__dirname, "../../public/data"),
  path.resolve(__dirname, "../../../idol_producer/database"),
];

const webIdolPictureDir = path.resolve(__dirname, "../../public/data/pictures/idols");
const webGroupPictureDir = path.resolve(__dirname, "../../public/data/pictures/groups");
const desktopIdolPictureDir = path.resolve(__dirname, "../../../idol_producer/fetcher/database/picture_fandom");
const desktopGroupPictureDir = path.resolve(__dirname, "../../../idol_producer/fetcher/database/picture");

const TODAY = "2026-07-19";

const GROUPS = [
  {
    name: "=LOVE",
    uid: "PUxPVkU",
    romanji: "=LOVE",
    fileKey: "EqualLove",
    staleKeys: [],
    note: "Official profiles and current release visuals refreshed from official sources on 2026-07-19.",
    currentGroupPicture: {
      url: "https://s3-aop.plusmember.jp/prod/public/equallove/contents/banner/92cb3d0e6751a8fd272e698e867d8356.jpeg",
      filename: "EqualLove__2026-04-01_20th_single_special.jpeg",
      release_date: "2026-04-01",
      label: "20th single special-site banner",
      source: "official_homepage",
      kind: "release_banner",
    },
    members: [
      ["大谷映美里", "https://equal-love.jp/image/profile/otani_emiri.jpg"],
      ["大場花菜", "https://equal-love.jp/image/profile/oba_hana.jpg"],
      ["音嶋莉沙", "https://equal-love.jp/image/profile/otoshima_risa.jpg"],
      ["齋藤樹愛羅", "https://equal-love.jp/image/profile/saito_kiara.jpg"],
      ["佐々木舞香", "https://equal-love.jp/image/profile/sasaki_maika.jpg"],
      ["髙松瞳", "https://equal-love.jp/image/profile/takamatsu_hitomi.jpg"],
      ["瀧脇笙古", "https://equal-love.jp/image/profile/takiwaki_shoko.jpg"],
      ["野口衣織", "https://equal-love.jp/image/profile/noguchi_iori.jpg"],
      ["諸橋沙夏", "https://equal-love.jp/image/profile/morohashi_sana.jpg"],
      ["山本杏奈", "https://equal-love.jp/image/profile/yamamoto_anna.jpg"],
    ],
  },
  {
    name: "≠ME",
    uid: "4omgTUU",
    romanji: "≠ME",
    fileKey: "NotEqualMe",
    staleKeys: ["4omNPU1F"],
    note: "Official profiles and current release visuals refreshed from official sources on 2026-07-19.",
    currentGroupPicture: {
      url: "https://not-equal-me.jp/static/notequalme/official/feature/12th_single/image/ogp_vaxsjydk.png",
      filename: "NotEqualMe__2026-06-24_12th_single_ogp.png",
      release_date: "2026-06-24",
      label: "12th single special-site key visual",
      source: "official_specialsite",
      kind: "release_visual",
    },
    members: [
      ["尾木波菜", "https://not-equal-me.jp/image/profile/ogi_hana_thumb.jpg"],
      ["落合希来里", "https://not-equal-me.jp/image/profile/ochiai_kirari_thumb.jpg"],
      ["蟹沢萌子", "https://not-equal-me.jp/image/profile/kanisawa_moeko_thumb.jpg"],
      ["河口夏音", "https://not-equal-me.jp/image/profile/kawaguchi_natsune_thumb.jpg"],
      ["川中子奈月心", "https://not-equal-me.jp/image/profile/kawanago_natsumi_thumb.jpg"],
      ["櫻井もも", "https://not-equal-me.jp/image/profile/sakurai_momo_thumb.jpg"],
      ["鈴木瞳美", "https://not-equal-me.jp/image/profile/suzuki_hitomi_thumb.jpg"],
      ["谷崎早耶", "https://not-equal-me.jp/image/profile/tanizaki_saya_thumb.jpg"],
      ["冨田菜々風", "https://not-equal-me.jp/image/profile/tomita_nanaka_thumb.jpg"],
      ["永田詩央里", "https://not-equal-me.jp/image/profile/nagata_shiori_thumb.jpg"],
      ["本田珠由記", "https://not-equal-me.jp/image/profile/honda_miyuki_thumb.jpg"],
    ],
  },
  {
    name: "≒JOY",
    uid: "4omSSk9Z",
    romanji: "≒JOY",
    fileKey: "NearlyEqualJoy",
    staleKeys: [],
    note: "Official profiles and current release visuals refreshed from official sources on 2026-07-19.",
    currentGroupPicture: {
      url: "https://i.ytimg.com/vi/wO2z79qqB1Y/maxresdefault.jpg",
      filename: "NearlyEqualJoy__2026-08-05_5th_single_summer_twintail_mv.jpg",
      release_date: "2026-08-05",
      label: "5th single \"Summer Twintail\" MV thumbnail",
      source: "official_youtube",
      kind: "mv_thumbnail",
    },
    members: [
      ["逢田珠里依", "https://nearly-equal-joy.jp/image/profile/aida_jurii.jpg"],
      ["天野香乃愛", "https://nearly-equal-joy.jp/image/profile/amano_konoa.jpg"],
      ["市原愛弓", "https://nearly-equal-joy.jp/image/profile/ichihara_ayumi.jpg"],
      ["江角怜音", "https://nearly-equal-joy.jp/image/profile/esumi_renon.jpg"],
      ["大信田美月", "https://nearly-equal-joy.jp/image/profile/oshida_mitsuki.jpg"],
      ["大西葵", "https://nearly-equal-joy.jp/image/profile/onishi_aoi.jpg"],
      ["小澤愛実", "https://nearly-equal-joy.jp/image/profile/ozawa_aimi.jpg"],
      ["髙橋舞", "https://nearly-equal-joy.jp/image/profile/takahashi_mai.jpg"],
      ["藤沢莉子", "https://nearly-equal-joy.jp/image/profile/fujisawa_riko.jpg"],
      ["村山結香", "https://nearly-equal-joy.jp/image/profile/murayama_yuuka.jpg"],
      ["山田杏佳", "https://nearly-equal-joy.jp/image/profile/yamada_momoka.jpg"],
      ["山野愛月", "https://nearly-equal-joy.jp/image/profile/yamano_arisu.jpg"],
    ],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + "\n", "utf8");
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function isoDateForFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath).mtime.toISOString().slice(0, 10);
}

function noteWithRefresh(existing, addition) {
  const base = typeof existing === "string" ? existing.trim() : "";
  if (!base) return addition;
  if (base.includes(addition)) return base;
  return `${base} ${addition}`;
}

function sanitizeExt(url) {
  const clean = url.split("?")[0].split("#")[0];
  const ext = path.extname(clean).toLowerCase();
  return ext || ".jpg";
}

async function downloadTo(url, destinations) {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to download ${url}: ${res.status}`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  for (const destination of destinations) {
    fs.writeFileSync(destination, buffer);
  }
}

function prependLegacyPortraitHistory(idol, group, relPath, legacyDate) {
  if (!relPath) return;
  upsertGroupPortraitHistory(
    idol,
    { groupName: group.name, groupUid: group.uid, groupRomanji: group.romanji },
    {
      path: relPath,
      effective_date: legacyDate,
      label: "legacy local portrait",
      source: "local_archive",
      note: "Pre-refresh portrait retained as prior history entry.",
    },
  );
}

function cleanupStalePortraitKeys(idol, staleKeys) {
  if (!Array.isArray(staleKeys) || !staleKeys.length) return;
  if (idol.group_portrait_paths && typeof idol.group_portrait_paths === "object") {
    for (const key of staleKeys) {
      delete idol.group_portrait_paths[key];
    }
  }
  if (idol.group_portrait_history && typeof idol.group_portrait_history === "object") {
    for (const key of staleKeys) {
      delete idol.group_portrait_history[key];
    }
  }
}

function prependLegacyGroupPicture(groupRow, relPath, legacyDate) {
  if (!relPath) return;
  upsertGroupPictureHistory(groupRow, {
    path: relPath,
    effective_date: legacyDate,
    label: "legacy local group visual",
    source: "local_archive",
    kind: "group_photo",
    note: "Pre-refresh group visual retained as prior history entry.",
  });
}

function removeHistoryEntriesByPath(entries, badPaths) {
  if (!Array.isArray(entries)) return [];
  const blocked = new Set((badPaths || []).filter(Boolean));
  return entries.filter((entry) => !blocked.has(entry?.path));
}

function removeLegacyAliasForCurrent(entries, currentPath) {
  if (!Array.isArray(entries)) return [];
  return entries.filter(
    (entry) => !(entry?.path === currentPath && entry?.label === "legacy local group visual"),
  );
}

function mergeDuplicateHistoryByPath(entries) {
  if (!Array.isArray(entries)) return [];
  const byPath = new Map();
  for (const entry of entries) {
    if (!entry || typeof entry !== "object" || !entry.path) continue;
    const existing = byPath.get(entry.path);
    if (!existing) {
      byPath.set(entry.path, { ...entry });
      continue;
    }
    byPath.set(entry.path, {
      ...existing,
      ...entry,
      timestamp: existing.timestamp ?? entry.timestamp ?? null,
      effective_date: existing.effective_date ?? entry.effective_date ?? null,
      release_date: existing.release_date ?? entry.release_date ?? null,
      label: existing.label ?? entry.label ?? null,
      note: existing.note ?? entry.note ?? null,
      source: existing.source ?? entry.source ?? null,
      kind: existing.kind ?? entry.kind ?? null,
    });
  }
  return Array.from(byPath.values()).sort((a, b) => {
    const aDate = a.effective_date ?? a.release_date ?? a.timestamp ?? "";
    const bDate = b.effective_date ?? b.release_date ?? b.timestamp ?? "";
    const dateCmp = String(bDate).localeCompare(String(aDate));
    if (dateCmp) return dateCmp;
    return String(b.path).localeCompare(String(a.path));
  });
}

function forceCurrentGroupPicture(groupRow, currentRelPath) {
  if (!groupRow || !currentRelPath) return;
  const nextPictures = [currentRelPath];
  for (const item of groupRow.pictures || []) {
    if (typeof item !== "string" || !item.trim() || item === currentRelPath) continue;
    nextPictures.push(item);
  }
  groupRow.pictures = nextPictures;
}

async function downloadCurrentAssets() {
  ensureDir(webIdolPictureDir);
  ensureDir(webGroupPictureDir);
  ensureDir(desktopIdolPictureDir);
  ensureDir(desktopGroupPictureDir);

  const downloads = [];
  for (const group of GROUPS) {
    for (const [memberName, url] of group.members) {
      const ext = sanitizeExt(url);
      const filename = `${memberName}__${group.fileKey}_${TODAY}_official_profile${ext}`;
      downloads.push({
        kind: "idol",
        group: group.name,
        memberName,
        url,
        relPath: `fetcher\\database\\picture_fandom\\${filename}`,
        publicPath: path.join(webIdolPictureDir, filename),
        desktopPath: path.join(desktopIdolPictureDir, filename),
      });
    }
    downloads.push({
      kind: "group",
      group: group.name,
      url: group.currentGroupPicture.url,
      relPath: `picture/${group.currentGroupPicture.filename}`,
      publicPath: path.join(webGroupPictureDir, group.currentGroupPicture.filename),
      desktopPath: path.join(desktopGroupPictureDir, group.currentGroupPicture.filename),
    });
  }

  for (const item of downloads) {
    await downloadTo(item.url, [item.publicPath, item.desktopPath]);
  }
  return downloads;
}

function patchRoot(root, downloads) {
  const groupsPath = path.join(root, "groups.json");
  const idolsPath = path.join(root, "idols.json");

  if (!fs.existsSync(groupsPath) || !fs.existsSync(idolsPath)) {
    return;
  }

  const groups = readJson(groupsPath);
  const idols = readJson(idolsPath);

  for (const group of GROUPS) {
    const groupRow = groups.find((row) => row.name === group.name || row.uid === group.uid);
    if (!groupRow) throw new Error(`Missing group ${group.name} in ${groupsPath}`);

    groupRow.notes = noteWithRefresh(groupRow.notes, group.note);

    const currentGroupDownload = downloads.find((item) => item.kind === "group" && item.group === group.name);
    if (!currentGroupDownload) throw new Error(`Missing group download for ${group.name}`);
    const legacyGroupPath = typeof groupRow.pictures?.[0] === "string" ? groupRow.pictures[0] : null;
    let legacyGroupDate = null;
    if (legacyGroupPath && legacyGroupPath !== currentGroupDownload.relPath) {
      const legacyBase = legacyGroupPath.replace(/\\/g, "/").split("/").pop();
      const legacyFile = legacyBase ? path.join(webGroupPictureDir, legacyBase) : null;
      legacyGroupDate = legacyFile ? isoDateForFile(legacyFile) : null;
      prependLegacyGroupPicture(groupRow, legacyGroupPath, legacyGroupDate);
    }

    upsertGroupPictureHistory(groupRow, {
      path: currentGroupDownload.relPath,
      effective_date: TODAY,
      release_date: group.currentGroupPicture.release_date,
      label: group.currentGroupPicture.label,
      source: group.currentGroupPicture.source,
      kind: group.currentGroupPicture.kind,
      note: "Official current group visual captured on 2026-07-19.",
    });
    groupRow.picture_history = removeLegacyAliasForCurrent(groupRow.picture_history, currentGroupDownload.relPath);
    groupRow.picture_history = mergeDuplicateHistoryByPath(groupRow.picture_history);
    forceCurrentGroupPicture(groupRow, currentGroupDownload.relPath);

    for (const [memberName] of group.members) {
      const idol = idols.find((row) => row.name === memberName);
      if (!idol) throw new Error(`Missing idol ${memberName} in ${idolsPath}`);

      cleanupStalePortraitKeys(idol, group.staleKeys);

      const currentPortrait = downloads.find(
        (item) => item.kind === "idol" && item.group === group.name && item.memberName === memberName,
      );
      if (!currentPortrait) throw new Error(`Missing portrait download for ${memberName} (${group.name})`);

      let legacyPath = typeof idol.portrait_photo_path === "string" && idol.portrait_photo_path.trim() ? idol.portrait_photo_path : null;
      const canonicalLegacyFilename = `${memberName}_portrait.jpg`;
      const canonicalLegacyFile = path.join(webIdolPictureDir, canonicalLegacyFilename);
      if (fs.existsSync(canonicalLegacyFile)) {
        legacyPath = `fetcher\\database\\picture_fandom\\${canonicalLegacyFilename}`;
      }
      if (legacyPath && legacyPath !== currentPortrait.relPath) {
        const legacyBase = legacyPath.replace(/\\/g, "/").split("/").pop();
        const legacyFile = legacyBase ? path.join(webIdolPictureDir, legacyBase) : null;
        const legacyDate = legacyFile ? isoDateForFile(legacyFile) : null;
        prependLegacyPortraitHistory(idol, group, legacyPath, legacyDate);
      }

      upsertGroupPortraitHistory(
        idol,
        { groupName: group.name, groupUid: group.uid, groupRomanji: group.romanji },
        {
          path: currentPortrait.relPath,
          effective_date: TODAY,
          label: "official profile portrait",
          source: "official_profile",
          note: "Official current member profile portrait captured on 2026-07-19.",
        },
      );

      idol.portrait_photo_path = currentPortrait.relPath;
      if (!idol.group_portrait_paths || typeof idol.group_portrait_paths !== "object") {
        idol.group_portrait_paths = {};
      }
      idol.group_portrait_paths[group.name] = currentPortrait.relPath;
      idol.group_portrait_paths[group.uid] = currentPortrait.relPath;
      idol.group_portrait_paths[group.romanji] = currentPortrait.relPath;
      if (legacyPath && !legacyPath.includes("????")) {
        for (const key of [group.name, group.uid, group.romanji]) {
          if (Array.isArray(idol.group_portrait_history?.[key])) {
            idol.group_portrait_history[key] = removeHistoryEntriesByPath(idol.group_portrait_history[key], [
              "fetcher\\database\\picture_fandom\\????_portrait.jpg",
            ]);
          }
        }
      }
      for (const key of [group.name, group.uid, group.romanji]) {
        if (Array.isArray(idol.group_portrait_history?.[key])) {
          idol.group_portrait_history[key] = mergeDuplicateHistoryByPath(idol.group_portrait_history[key]);
        }
      }
      cleanupStalePortraitKeys(idol, group.staleKeys);
    }
  }

  writeJson(groupsPath, groups);
  writeJson(idolsPath, idols);
}

async function main() {
  const downloads = await downloadCurrentAssets();
  for (const root of roots) {
    patchRoot(root, downloads);
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
