/**
 * Ensure all HEROINES ALBUM 2025 tracks exist and are playable (Apple preview URLs).
 *
 *   node support/scripts/makeHeroinesAlbum2025Playable.mjs
 *   node support/scripts/makeHeroinesAlbum2025Playable.mjs --dry-run
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const dryRun = process.argv.includes("--dry-run");
const ALBUM = "HEROINES ALBUM 2025";
const ALBUM_DATE = "2025-02-01";

/** @type {{title:string, group:string, role:'exclusive'|'shared', track?:number}[]} */
const TRACKS = [
  { title: "パラレルワールド", group: "i-COL", role: "exclusive" },
  { title: "アイドルライフエクストラパック", group: "iLiFE!", role: "exclusive" },
  { title: "新宇宙世紀アイドルちゃん", group: "アキシブproject", role: "exclusive" },
  { title: "アンチディストピア", group: "AdamLilith", role: "exclusive" },
  { title: "ナイモノネダリ", group: "ガガピエロ", role: "exclusive" },
  { title: "メシア", group: "GILTY × GILTY", role: "exclusive" },
  { title: "Sparkle", group: "ZUTTOMOTTO", role: "exclusive" },
  { title: "唯いchu無二のヒロイン", group: "chuLa", role: "exclusive" },
  { title: "ショートケーカーズ", group: "Ill", role: "exclusive" },
  { title: "きゅるりんパーク", group: "天使にはなれない", role: "exclusive" },
  { title: "人ニ、非ズ", group: "TENRIN", role: "exclusive" },
  { title: "君とたこやきLOVE恋め", group: "ナナコロビヤオキ", role: "exclusive" },
  { title: "はなまるフュージョン", group: "のんふぃく！", role: "exclusive" },
  { title: "もういっちょ!", group: "パラディーク", role: "exclusive" },
  { title: "軽いノリのイルカ", group: "ポンコツコンポ", role: "exclusive" },
  { title: "流星トワイライト", group: "パラレルサイダー", role: "exclusive" },
  { title: "はにトラ!?", group: "夜光性アミューズ", role: "exclusive" },
  { title: "ドラドラバスターズ", group: "LADYBABY", role: "exclusive" },
  { title: "パラリラダンス", group: "i-COL", role: "shared", track: 2 },
  { title: "アイドルライフブースターパック", group: "iLiFE!", role: "shared", track: 3 },
  { title: "アキシブウェイ", group: "アキシブproject", role: "shared", track: 4 },
  { title: "Mariage", group: "AdamLilith", role: "shared", track: 5 },
  { title: "ジェラ", group: "Ill", role: "shared", track: 6 },
  { title: "ノックアウト!", group: "ガガピエロ", role: "shared", track: 7 },
  { title: "GILTY", group: "GILTY × GILTY", role: "shared", track: 8 },
  { title: "アンソクチ", group: "ZUTTOMOTTO", role: "shared", track: 9 },
  { title: "トキメキCherry", group: "chuLa", role: "shared", track: 10 },
  { title: "DREAMS ON THE RUN", group: "天使にはなれない", role: "shared", track: 11 },
  { title: "ANARCHY", group: "TENRIN", role: "shared", track: 12 },
  { title: "七転八起", group: "ナナコロビヤオキ", role: "shared", track: 13 },
  { title: "ノーテンキ超キュートガール", group: "のんふぃく！", role: "shared", track: 14 },
  { title: "ちゅ♡ちゅ♡ちゅ♡ぱにぱっ♡", group: "パラディーク", role: "shared", track: 15 },
  { title: "パラレルサイダー", group: "パラレルサイダー", role: "shared", track: 16 },
  { title: "サイコオフトン", group: "ポンコツコンポ", role: "shared", track: 17 },
  { title: "デジタルタトゥー", group: "夜光性アミューズ", role: "shared", track: 18 },
  { title: "ジャパサマ", group: "LADYBABY", role: "shared", track: 19 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function nfkc(s) {
  return String(s ?? "").normalize("NFKC");
}

function compact(s) {
  return nfkc(s)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function cleanAppleUrl(url) {
  if (!url) return null;
  try {
    const u = new URL(url);
    u.searchParams.delete("uo");
    return u.toString();
  } catch {
    return String(url).trim() || null;
  }
}

async function itunesLookup(trackId) {
  const res = await fetch(`https://itunes.apple.com/lookup?id=${encodeURIComponent(trackId)}&country=jp`);
  if (!res.ok) throw new Error(`lookup ${res.status}`);
  const data = await res.json();
  return data.results?.find((r) => r.wrapperType === "track") ?? data.results?.[0] ?? null;
}

async function itunesSearchSong(title, artist) {
  const term = `${title} ${artist}`.trim();
  const url = `https://itunes.apple.com/search?term=${encodeURIComponent(term)}&country=jp&media=music&entity=song&limit=12`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`search ${res.status}`);
  const data = await res.json();
  const wantT = compact(title);
  const wantA = compact(artist);
  let best = null;
  let bestScore = 0;
  for (const row of data.results || []) {
    const t = compact(row.trackName);
    const a = compact(row.artistName);
    let score = 0;
    if (t === wantT) score += 100;
    else if (t.includes(wantT) || wantT.includes(t)) score += 70;
    else continue;
    if (a === wantA) score += 50;
    else if (a.includes(wantA) || wantA.includes(a)) score += 30;
    // Prefer non-instrumental
    if (/instrumental|オフボーカル|カラオケ/i.test(row.trackName || "")) score -= 40;
    if (score > bestScore) {
      bestScore = score;
      best = row;
    }
  }
  return bestScore >= 100 ? best : null;
}

function ensureAlbumRef(song, trackNumber) {
  if (!Array.isArray(song.albums)) song.albums = [];
  const exists = song.albums.some((a) => String(a?.name || "").includes("HEROINES ALBUM 2025"));
  if (!exists) {
    song.albums.push({
      disc_uid: null,
      name: ALBUM,
      track_number: trackNumber ?? (song.role === "exclusive" ? 1 : null),
    });
  }
}

function newSongRow(group, title) {
  return {
    uid: crypto.randomUUID(),
    group_uid: group.uid,
    group_name: group.name,
    title,
    title_romanji: "",
    release_date: ALBUM_DATE,
    genre: "J-Pop",
    duration: null,
    lyrics: "",
    composer: "",
    lyricist: "",
    arrangement: "",
    description: "",
    spotify_url: null,
    youtube_url: null,
    albums: [{ disc_uid: null, name: ALBUM, track_number: 1 }],
    version: "",
    disc_uid: null,
    popularity: 2,
    signature_song: false,
    popularity_local: 2,
    popularity_global: null,
    source_confidence: "heroines_album_2025",
    notes: `HEROINES ALBUM 2025 exclusive/shared track for ${group.name}`,
    _apple_track_ids: [],
  };
}

function findSong(songs, group, title) {
  const exact = songs.find(
    (s) => String(s.title) === title && (String(s.group_uid) === String(group.uid) || String(s.group_name) === group.name),
  );
  if (exact) return exact;
  // CAL&RES alias for 天使にはなれない shared catalog rows
  if (group.name === "天使にはなれない") {
    return songs.find((s) => String(s.title) === title && String(s.group_name) === "CAL&RES") || null;
  }
  return null;
}

async function enrichFromItunes(song, groupName, title) {
  let track = null;
  const ids = Array.isArray(song._apple_track_ids) ? song._apple_track_ids.map(Number).filter(Boolean) : [];
  for (const id of ids) {
    try {
      track = await itunesLookup(id);
      await sleep(120);
      if (track?.previewUrl) break;
    } catch {
      /* continue */
    }
  }
  if (!track?.previewUrl) {
    track = await itunesSearchSong(title, groupName);
    await sleep(200);
  }
  // Try alternate group labels
  if (!track?.previewUrl && groupName === "GILTY × GILTY") {
    track = await itunesSearchSong(title, "GILTY×GILTY");
    await sleep(200);
  }
  if (!track?.previewUrl && groupName === "天使にはなれない") {
    track = await itunesSearchSong(title, "CAL&RES");
    await sleep(200);
  }
  if (!track) return { ok: false, reason: "not_found" };

  const trackId = Number(track.trackId);
  if (!Array.isArray(song._apple_track_ids)) song._apple_track_ids = [];
  if (trackId && !song._apple_track_ids.map(Number).includes(trackId)) {
    song._apple_track_ids.unshift(trackId);
  }
  if (track.previewUrl) song.apple_preview_url = track.previewUrl;
  if (track.trackViewUrl) song.apple_music_url = cleanAppleUrl(track.trackViewUrl);
  if (track.trackTimeMillis && !song.duration) song.duration = Math.round(track.trackTimeMillis / 1000);
  const note = `Apple trackId ${trackId}; ${song.apple_music_url || ""}`;
  if (!song.notes) song.notes = note;
  else if (!String(song.notes).includes(String(trackId))) song.notes = `${song.notes}; ${note}`;
  return { ok: Boolean(song.apple_preview_url), trackId, collection: track.collectionName };
}

function ensureSongUid(group, songUid) {
  if (!Array.isArray(group.song_uids)) group.song_uids = [];
  if (!group.song_uids.includes(songUid)) group.song_uids.push(songUid);
}

function ensureDiscography(group, trackTitlesForEdition) {
  if (!Array.isArray(group.discography)) group.discography = [];
  let disc = group.discography.find((d) => String(d.title || "").includes("HEROINES ALBUM 2025"));
  if (!disc) {
    disc = {
      uid: crypto.randomUUID(),
      title: `${ALBUM} (${group.name} ver.)`,
      title_romanji: "HEROINES ALBUM 2025",
      disc_type: "Album",
      release_date: ALBUM_DATE,
      publisher: "CROSS SIDE MUSIC",
      publisher_uid: null,
      catalog_number: "",
      description: "HEROINES compilation album (group edition).",
      track_list: trackTitlesForEdition,
      track_song_uids: [],
      duration: null,
      cover_image_path: null,
    };
    group.discography.push(disc);
  }
  return disc;
}

async function main() {
  const mainSongsPath = path.join(root, "public/data/songs.json");
  const s6SongsPath = path.join(root, "public/data/scenarios/scenario_6/songs.json");
  const mainGroupsPath = path.join(root, "public/data/groups.json");
  const s6GroupsPath = path.join(root, "public/data/scenarios/scenario_6/groups.json");

  const songs = JSON.parse(fs.readFileSync(mainSongsPath, "utf8"));
  const s6Songs = JSON.parse(fs.readFileSync(s6SongsPath, "utf8"));
  const groups = JSON.parse(fs.readFileSync(mainGroupsPath, "utf8"));
  const s6Groups = JSON.parse(fs.readFileSync(s6GroupsPath, "utf8"));
  const byName = new Map(groups.map((g) => [g.name, g]));

  const sharedTitles = TRACKS.filter((t) => t.role === "shared").map((t) => t.title);
  const report = [];

  for (const spec of TRACKS) {
    const group = byName.get(spec.group);
    if (!group) {
      report.push({ title: spec.title, group: spec.group, status: "missing_group" });
      continue;
    }
    let song = findSong(songs, group, spec.title);
    let created = false;
    if (!song) {
      song = newSongRow(group, spec.title);
      songs.push(song);
      created = true;
    }
    const trackNo = spec.role === "exclusive" ? 1 : spec.track ?? null;
    ensureAlbumRef(song, trackNo);
    const enrich = await enrichFromItunes(song, group.name, spec.title);
    ensureSongUid(group, song.uid);

    // discography edition track list: exclusive first + shared
    const editionTracks = [spec.role === "exclusive" ? spec.title : null, ...sharedTitles].filter(Boolean);
    // Only attach full disc when processing exclusive (one disc per group edition)
    if (spec.role === "exclusive") {
      const disc = ensureDiscography(group, [spec.title, ...sharedTitles]);
      // rebuild track_song_uids from titles
      const uids = [];
      for (const title of disc.track_list) {
        const ownerGroupName =
          TRACKS.find((t) => t.title === title && t.role === "exclusive" && t.group === group.name)?.group ||
          TRACKS.find((t) => t.title === title && t.role === "shared")?.group ||
          group.name;
        const owner = byName.get(ownerGroupName) || group;
        const row = findSong(songs, owner, title) || songs.find((s) => s.title === title && s.group_name === owner.name);
        uids.push(row?.uid || null);
      }
      disc.track_song_uids = uids;
    }

    // mirror song into s6 by uid
    const s6Idx = s6Songs.findIndex((s) => s.uid === song.uid);
    if (s6Idx >= 0) s6Songs[s6Idx] = structuredClone(song);
    else s6Songs.push(structuredClone(song));

    const s6g = s6Groups.find((g) => g.uid === group.uid || g.name === group.name);
    if (s6g) {
      ensureSongUid(s6g, song.uid);
      if (spec.role === "exclusive") {
        const disc = ensureDiscography(s6g, [spec.title, ...sharedTitles]);
        disc.track_list = [spec.title, ...sharedTitles];
        disc.track_song_uids = disc.track_list.map((title) => {
          const ownerName =
            TRACKS.find((t) => t.title === title && t.role === "exclusive" && t.group === group.name)?.group ||
            TRACKS.find((t) => t.title === title && t.role === "shared")?.group ||
            group.name;
          const owner = byName.get(ownerName) || group;
          const row = findSong(songs, owner, title);
          return row?.uid || null;
        });
      }
    }

    report.push({
      title: spec.title,
      group: group.name,
      role: spec.role,
      created,
      playable: Boolean(song.apple_preview_url),
      apple: song.apple_music_url || null,
      enrich,
    });
    console.log(
      `${created ? "NEW" : "UPD"} ${group.name} / ${spec.title} → preview=${Boolean(song.apple_preview_url)} ${enrich.collection || enrich.reason || ""}`,
    );
  }

  if (!dryRun) {
    fs.writeFileSync(mainSongsPath, `${JSON.stringify(songs, null, 2)}\n`);
    fs.writeFileSync(s6SongsPath, `${JSON.stringify(s6Songs, null, 2)}\n`);
    fs.writeFileSync(mainGroupsPath, `${JSON.stringify(groups, null, 2)}\n`);
    fs.writeFileSync(s6GroupsPath, `${JSON.stringify(s6Groups, null, 2)}\n`);
  }

  const playable = report.filter((r) => r.playable).length;
  const created = report.filter((r) => r.created).length;
  const missing = report.filter((r) => !r.playable);
  console.log(`\nDone: ${report.length} tracks, created=${created}, playable=${playable}, missing_preview=${missing.length}`);
  if (missing.length) {
    console.log("Missing preview:");
    for (const m of missing) console.log(`  - ${m.group} / ${m.title} (${m.enrich?.reason || "?"})`);
  }
  fs.writeFileSync(
    path.join(root, "support/tmp/heroines_album_2025_playable_report.json"),
    `${JSON.stringify(report, null, 2)}\n`,
  );
  console.log(dryRun ? "Dry run — no write" : "Wrote songs + groups (main & scenario_6)");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
