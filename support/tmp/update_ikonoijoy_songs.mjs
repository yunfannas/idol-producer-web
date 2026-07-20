import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = process.cwd();

const TARGETS = [
  {
    groupsPath: path.join(ROOT, "public/data/groups.json"),
    songsPath: path.join(ROOT, "public/data/songs.json"),
  },
  {
    groupsPath: path.join(ROOT, "../idol_producer/database/groups.json"),
    songsPath: path.join(ROOT, "../idol_producer/database/songs.json"),
  },
];

const GROUPS = {
  "4omgTUU": "≠ME",
  "4omSSk9Z": "≒JOY",
};

const NEW_SONGS = {
  "4omgTUU": [
    {
      title: "愛くださいませ",
      release_date: "2026-06-09",
      duration: 249,
      popularity: 4.5,
      albums: [
        { disc_uid: null, name: "愛くださいませ - Single", track_number: 1 },
        { disc_uid: null, name: "愛くださいませ/ここでファーストキッス - EP", track_number: 1 },
      ],
      source_confidence: "apple_music_jp_top_songs",
      notes:
        "Apple trackIds 6771653764, 6779158416; Apple Music JP top songs rank 4 and catalog listing verified on 2026-07-20.",
      _apple_track_ids: [6771653764, 6779158416],
    },
    {
      title: "ここでファーストキッス",
      release_date: "2026-06-24",
      duration: 223,
      popularity: 2.5,
      albums: [
        { disc_uid: null, name: "愛くださいませ/ここでファーストキッス - EP", track_number: 2 },
      ],
      source_confidence: "apple_music_jp_artist_catalog",
      notes:
        "Apple trackId 6779158417; Apple Music JP artist catalog listing verified on 2026-07-20.",
      _apple_track_ids: [6779158417],
    },
    {
      title: "Summer haze",
      release_date: "2026-06-24",
      duration: 262,
      popularity: 2.5,
      albums: [
        { disc_uid: null, name: "愛くださいませ/ここでファーストキッス - EP", track_number: 3 },
      ],
      source_confidence: "apple_music_jp_artist_catalog",
      notes:
        "Apple trackId 6779158418; Apple Music JP artist catalog listing verified on 2026-07-20.",
      _apple_track_ids: [6779158418],
    },
  ],
  "4omSSk9Z": [
    {
      title: "サマーツインテール",
      release_date: "2026-07-09",
      duration: 219,
      popularity: 4,
      albums: [
        { disc_uid: null, name: "サマーツインテール - Single", track_number: 1 },
      ],
      source_confidence: "apple_music_jp_top_songs",
      notes:
        "Apple trackId 6784647187; Apple Music JP top songs listing and catalog entry verified on 2026-07-20.",
      _apple_track_ids: [6784647187],
    },
  ],
};

const REMOVE_TITLES = {
  "4omSSk9Z": new Set(["Overture"]),
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`);
}

function makeSong(groupUid, groupName, payload) {
  return {
    uid: crypto.randomUUID(),
    group_uid: groupUid,
    group_name: groupName,
    title: payload.title,
    title_romanji: "",
    release_date: payload.release_date,
    genre: "J-Pop",
    duration: payload.duration,
    lyrics: "",
    composer: "",
    lyricist: "",
    arrangement: "",
    description: "",
    spotify_url: null,
    youtube_url: null,
    albums: payload.albums,
    version: "",
    disc_uid: null,
    popularity: payload.popularity,
    signature_song: false,
    popularity_local: payload.popularity,
    popularity_global: null,
    source_confidence: payload.source_confidence,
    notes: payload.notes,
    _apple_track_ids: payload._apple_track_ids,
  };
}

for (const target of TARGETS) {
  const groups = readJson(target.groupsPath);
  const songs = readJson(target.songsPath);

  for (const [groupUid, groupName] of Object.entries(GROUPS)) {
    const group = groups.find((entry) => entry.uid === groupUid);
    if (!group) {
      throw new Error(`Missing group ${groupUid} in ${target.groupsPath}`);
    }

    for (const song of songs) {
      if (song.group_uid === groupUid) {
        song.group_name = groupName;
      }
    }

    const removals = REMOVE_TITLES[groupUid];
    if (removals?.size) {
      const removedUids = new Set(
        songs
          .filter((song) => song.group_uid === groupUid && removals.has(song.title))
          .map((song) => song.uid),
      );
      if (removedUids.size) {
        for (let index = songs.length - 1; index >= 0; index -= 1) {
          if (removedUids.has(songs[index].uid)) {
            songs.splice(index, 1);
          }
        }
        group.song_uids = (group.song_uids || []).filter((uid) => !removedUids.has(uid));
      }
    }

    for (const payload of NEW_SONGS[groupUid] || []) {
      let song = songs.find(
        (entry) =>
          entry.group_uid === groupUid &&
          entry.title === payload.title &&
          entry.release_date === payload.release_date,
      );

      if (!song) {
        song = makeSong(groupUid, groupName, payload);
        songs.push(song);
      } else {
        song.group_name = groupName;
        song.duration = payload.duration;
        song.albums = payload.albums;
        song.popularity = payload.popularity;
        song.popularity_local = payload.popularity;
        song.source_confidence = payload.source_confidence;
        song.notes = payload.notes;
        song._apple_track_ids = payload._apple_track_ids;
      }

      if (!group.song_uids?.includes(song.uid)) {
        group.song_uids = [...(group.song_uids || []), song.uid];
      }
    }
  }

  writeJson(target.groupsPath, groups);
  writeJson(target.songsPath, songs);
  console.log(`Updated ${target.songsPath}`);
}
