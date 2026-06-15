/**
 * Applies アキシブproject wiki/MB-aligned disc+song rows.
 * Prefers the shared workflow: paste the same payloads into
 * `public/data/groups_update.json` + `songs_update.json` and run
 * `npm run data:merge-catalog` (see docs/skills/idol-database-refresh/SKILL.md).
 * This script uses a one-group text splice for low diff noise on groups.json.
 *
 * Run: node scripts/patchAkishibuDiscographyNode.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const groupsPath = path.join(root, "public", "data", "groups.json");
const songsPath = path.join(root, "public", "data", "songs.json");

const groupUid = "44Ki44Kt44K344OWcHJvamVjdA";

const NEW_SONGS_BLOCK = `
  {
    "uid": "8656e516-ec9e-42db-9576-88cc65ef51fa",
    "group_uid": "44Ki44Kt44K344OWcHJvamVjdA",
    "group_name": "アキシブproject",
    "title": "Everyday!",
    "title_romanji": "",
    "release_date": "2016-08-09",
    "genre": "J-Pop",
    "duration": null,
    "lyrics": "",
    "composer": "",
    "lyricist": "",
    "arrangement": "",
    "description": "",
    "spotify_url": null,
    "youtube_url": null,
    "albums": [
      {
        "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
        "name": "Summer☆Summer / セツナツリ (Type B)",
        "track_number": 3
      }
    ],
    "version": "",
    "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
    "popularity": 2.0,
    "signature_song": false,
    "popularity_local": 2.0,
    "popularity_global": null,
    "source_confidence": "jpop_wiki_musicbrainz",
    "notes": "Coupling listed on Summer☆Summer / セツナツリ Type B (MusicBrainz). https://musicbrainz.org/release/5414dad9-a915-40e6-ac67-b87a59ba065f"
  },
  {
    "uid": "930db458-f2c8-41d6-9d0e-75f3a6e8df83",
    "group_uid": "44Ki44Kt44K344OWcHJvamVjdA",
    "group_name": "アキシブproject",
    "title": "Fighting Stars",
    "title_romanji": "",
    "release_date": "2016-08-09",
    "genre": "J-Pop",
    "duration": null,
    "lyrics": "",
    "composer": "",
    "lyricist": "",
    "arrangement": "",
    "description": "",
    "spotify_url": null,
    "youtube_url": null,
    "albums": [
      {
        "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
        "name": "Summer☆Summer / セツナツリ (Type C)",
        "track_number": 3
      }
    ],
    "version": "",
    "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
    "popularity": 2.0,
    "signature_song": false,
    "popularity_local": 2.0,
    "popularity_global": null,
    "source_confidence": "jpop_wiki_musicbrainz",
    "notes": "Coupling listed on Summer☆Summer / セツナツリ Type C (MusicBrainz). https://musicbrainz.org/release/82b841e8-e957-40f1-92d7-632d27dab639"
  },
  {
    "uid": "90ae1303-714c-4e66-a4be-9e2cae93b907",
    "group_uid": "44Ki44Kt44K344OWcHJvamVjdA",
    "group_name": "アキシブproject",
    "title": "Dream in a sea",
    "title_romanji": "",
    "release_date": "2016-08-09",
    "genre": "J-Pop",
    "duration": null,
    "lyrics": "",
    "composer": "",
    "lyricist": "",
    "arrangement": "",
    "description": "",
    "spotify_url": null,
    "youtube_url": null,
    "albums": [
      {
        "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
        "name": "Summer☆Summer / セツナツリ (Type D)",
        "track_number": 3
      }
    ],
    "version": "",
    "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
    "popularity": 2.0,
    "signature_song": false,
    "popularity_local": 2.0,
    "popularity_global": null,
    "source_confidence": "jpop_wiki_musicbrainz",
    "notes": "Coupling listed on Summer☆Summer / セツナツリ Type D (MusicBrainz). https://musicbrainz.org/release/76980a22-c98e-40c7-9c21-0a1fa8862cea"
  },
  {
    "uid": "1db13f39-9cf2-4420-937d-14a22dda0a14",
    "group_uid": "44Ki44Kt44K344OWcHJvamVjdA",
    "group_name": "アキシブproject",
    "title": "Creaction",
    "title_romanji": "Creaction",
    "release_date": "2016-08-09",
    "genre": "J-Pop",
    "duration": null,
    "lyrics": "",
    "composer": "",
    "lyricist": "",
    "arrangement": "",
    "description": "",
    "spotify_url": null,
    "youtube_url": null,
    "albums": [
      {
        "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
        "name": "Summer☆Summer / セツナツリ (Type E)",
        "track_number": 3
      }
    ],
    "version": "",
    "disc_uid": "b6b770ea-d5c7-47e2-9328-55e185aabff0",
    "popularity": 2.0,
    "signature_song": false,
    "popularity_local": 2.0,
    "popularity_global": null,
    "source_confidence": "jpop_wiki_musicbrainz",
    "notes": "Type E coupling on Summer☆Summer / セツナツリ (MusicBrainz). Distinct from Creaction (2019 ver.) on AKISHIBU THE BEST."
  },
  {
    "uid": "ae950598-5083-48e4-a2fa-99da9cdc3ecb",
    "group_uid": "44Ki44Kt44K344OWcHJvamVjdA",
    "group_name": "アキシブproject",
    "title": "Message to ID (Yuechi from Akishibu project)",
    "title_romanji": "",
    "release_date": "2017-08-30",
    "genre": "J-Pop",
    "duration": null,
    "lyrics": "",
    "composer": "",
    "lyricist": "",
    "arrangement": "",
    "description": "",
    "spotify_url": null,
    "youtube_url": null,
    "albums": [
      {
        "disc_uid": "5de335af-4a4d-40b8-8347-cb29493269b4",
        "name": "アバンチュっ！ / ナツラブ (Type B)",
        "track_number": 3
      }
    ],
    "version": "",
    "disc_uid": "5de335af-4a4d-40b8-8347-cb29493269b4",
    "popularity": 2.0,
    "signature_song": false,
    "popularity_local": 2.0,
    "popularity_global": null,
    "source_confidence": "jpop_wiki_musicbrainz",
    "notes": "Type B exclusive track listed on https://jpop.fandom.com/wiki/Abanchu!_/_Natsu_Love"
  },
  {
    "uid": "755d4131-83ca-4387-8bf4-2aa145211f23",
    "group_uid": "44Ki44Kt44K344OWcHJvamVjdA",
    "group_name": "アキシブproject",
    "title": "PEACE",
    "title_romanji": "",
    "release_date": "2017-08-30",
    "genre": "J-Pop",
    "duration": null,
    "lyrics": "",
    "composer": "",
    "lyricist": "",
    "arrangement": "",
    "description": "",
    "spotify_url": null,
    "youtube_url": null,
    "albums": [
      {
        "disc_uid": "5de335af-4a4d-40b8-8347-cb29493269b4",
        "name": "アバンチュっ！ / ナツラブ (Type C)",
        "track_number": 3
      }
    ],
    "version": "",
    "disc_uid": "5de335af-4a4d-40b8-8347-cb29493269b4",
    "popularity": 2.0,
    "signature_song": false,
    "popularity_local": 2.0,
    "popularity_global": null,
    "source_confidence": "jpop_wiki_musicbrainz",
    "notes": "Type C exclusive track listed on https://jpop.fandom.com/wiki/Abanchu!_/_Natsu_Love"
  },
`;

/** @param {unknown} groups */
function patchAkishibuGroup(groups) {
  const g = groups.find((x) => x && x.uid === groupUid);
  if (!g) throw new Error("Akishibu group missing");

  g.song_uids = [...(g.song_uids ?? [])];
  const add = [
    "8656e516-ec9e-42db-9576-88cc65ef51fa",
    "930db458-f2c8-41d6-9d0e-75f3a6e8df83",
    "90ae1303-714c-4e66-a4be-9e2cae93b907",
    "1db13f39-9cf2-4420-937d-14a22dda0a14",
    "ae950598-5083-48e4-a2fa-99da9cdc3ecb",
    "755d4131-83ca-4387-8bf4-2aa145211f23",
  ];
  for (const uid of add) {
    if (!g.song_uids.includes(uid)) g.song_uids.push(uid);
  }

  const row = /** @param {string} uid */ (uid) =>
    g.discography.find((d) => d.uid === uid);

  const dBest = row("8857fca1-c8d5-4c6e-891f-a95c16938247");
  if (!dBest) throw new Error("AKISHIBU THE BEST missing");
  delete dBest.track_list;
  dBest.shared_track_list = [
    "アキシブウェイ",
    "Candid Love",
    "New World",
    "Restart",
    "Summer☆Summer",
    "セツナツリ",
    "アバンチュっ!",
    "ナツラブ",
    "Hola! Hola! Summer",
    "ユメハナビ",
    "Be yourself",
    "Next Gate",
    "キライだ。",
    "Creaction (2019 ver.)",
    "WHITE (LIVE ver.)",
    "真夏のセレナーデ (LIVE ver.)",
  ];
  dBest.edition_track_lists = [
    {
      label: "Limited Edition DVD",
      track_list: ['Akishibu project "ALL ONEMAN LIVE DIGEST"'],
    },
  ];
  dBest.track_song_uids = [
    "f340fa8d-6305-410c-ad86-f4726cf93573",
    "720921c4-a3c9-4f29-8ef0-4fc4fc80f34d",
    "b39e38da-4d24-48f9-92e6-fc117f3df6d5",
    "50059980-a741-4f21-8ae6-55a2aae5689f",
    "c3e640e0-8522-47fd-9071-8c2e68b111b7",
    "bc8dbc71-3750-48dc-b4ff-182b2f15047e",
    "6dd4301a-795a-4caf-9c02-9981e9d5363c",
    "79af2b24-cfb3-49e8-8d66-2d2c7beb2cc9",
    "992cb743-c5e4-4a49-8e5f-1a0c55e89987",
    "3f4e3946-9c42-49a9-bb55-4ce5c06c84e3",
    "0bff0f17-56d6-434a-8611-dbb193d20bac",
    "a3e79185-ac50-4897-8b12-6af2549f8548",
    "11cba1bd-7673-4ba4-bd8d-91f3d1a051b4",
    "6575b72a-6558-43f3-b775-f07760db2e06",
    "a3c7ca04-3d60-4bba-9b98-5ea107a8da16",
    "c2ca0088-591e-459d-a0ff-76ffb71a4c00",
  ];

  const dMidi = row("53154494-a8e0-4a6f-b6f7-b607c77a33d0");
  if (!dMidi) throw new Error("Midaregami missing");
  delete dMidi.track_list;
  delete dMidi.track_song_uids;
  dMidi.shared_track_list = [
    "Eternal Blue ~キミと僕と空と海の物語~",
    "ガチ恋レボリューション",
    "真夏のセレナーデ",
    "アキシブウェイ",
    "flower×flower",
    "虹の色",
  ];
  dMidi.edition_track_lists = [
    { label: "Type A CD", track_list: ["WAY TO DREAM", "乱れ髪ファイティングガール"] },
    { label: "Type B CD", track_list: ["Candid Love", "乱れ髪ファイティングガール"] },
    {
      label: "Type C CD",
      track_list: ["LOVE&PARADISE", "乱れ髪ファイティングガール"],
    },
  ];

  const dNw = row("d9e08991-23fa-4166-8df4-81f4134a7b67");
  if (!dNw) throw new Error("NEW WORLD missing");
  delete dNw.track_list;
  dNw.title_romanji = "NEW WORLD";
  dNw.disc_type = "Mini Album";
  dNw.shared_track_list = [
    "one",
    "Change The World",
    "Restart",
    "Answer",
    "輝きライセンス; Kagayaki License",
    "Dream in a sea",
    "New World",
  ];
  dNw.edition_track_lists = [
    { label: "Type A CD", track_list: ["空の彼方; Sora no Kanata"] },
    { label: "Type B CD", track_list: ["RIVAL"] },
    { label: "Type C CD", track_list: ["Dear Best Friend"] },
  ];
  dNw.track_song_uids = [];

  const dSum = row("b6b770ea-d5c7-47e2-9328-55e185aabff0");
  if (!dSum) throw new Error("Summer single missing");
  delete dSum.track_list;
  delete dSum.track_song_uids;
  dSum.shared_track_list = ["Summer☆Summer", "セツナツリ"];
  dSum.edition_track_lists = [
    {
      label: "Type A CD",
      track_list: ["Summer☆Summer (Off Vocal Ver.)", "セツナツリ (Off Vocal Ver.)"],
    },
    { label: "Type B CD", track_list: ["Everyday!"] },
    { label: "Type C CD", track_list: ["Fighting Stars"] },
    { label: "Type D CD", track_list: ["Dream in a sea"] },
    { label: "Type E CD", track_list: ["Creaction"] },
  ];

  const dAb = row("5de335af-4a4d-40b8-8347-cb29493269b4");
  if (!dAb) throw new Error("Abanchu missing");
  delete dAb.track_list;
  delete dAb.track_song_uids;
  dAb.shared_track_list = ["アバンチュっ!", "ナツラブ"];
  dAb.edition_track_lists = [
    {
      label: "Type A CD",
      track_list: ["アバンチュっ! (instrumental)", "ナツラブ (instrumental)"],
    },
    {
      label: "Type B CD",
      track_list: ["Message to ID (Yuechi from Akishibu project)"],
    },
    { label: "Type C CD", track_list: ["PEACE"] },
  ];

  const dHola = row("ae59c728-630e-4086-97ce-9a4ab889d449");
  if (!dHola) throw new Error("Hola missing");
  delete dHola.track_list;
  delete dHola.track_song_uids;
  dHola.shared_track_list = ["Hola! Hola! Summer", "ユメハナビ"];
  dHola.edition_track_lists = [
    {
      label: "Regular / Limited Edition A CD",
      track_list: ["Hola! Hola! Summer (instrumental)", "ユメハナビ (instrumental)"],
    },
    { label: "Limited Edition B CD", track_list: ["Acting Girl"] },
    { label: "Limited Edition C CD", track_list: ["AKISHIBU SHIP"] },
  ];

  const dTf = row("63e41e76-0e17-40c0-bdc4-d89f1c94f262");
  if (!dTf) throw new Error("First Summer missing");
  delete dTf.shared_track_list;
  delete dTf.edition_track_lists;
  delete dTf.track_song_uids;
  dTf.track_list = [
    "The First Summer",
    "夏のかけら",
    "観測史上",
    "The First Summer (Instrumental)",
    "夏のかけら (Instrumental)",
    "観測史上 (Instrumental)",
  ];
}

function wrapElem(obj) {
  const core = JSON.stringify(obj, null, 2).replace(/\r?\n/g, "\r\n");
  return core.split("\r\n").map((ln) => `  ${ln}`).join("\r\n");
}

function spliceGroupsFirstEntryAkishibu() {
  const raw = fs.readFileSync(groupsPath, "utf8");
  /** @type {unknown[]} */
  const groups = JSON.parse(raw);
  if (!groups[0] || groups[0].uid !== groupUid) {
    throw new Error(
      "Expected アキシブproject as the very first catalog object (ordering anchor for text splice).",
    );
  }
  patchAkishibuGroup(groups);

  const uidIdx = raw.indexOf(`"uid": "${groupUid}"`);
  if (uidIdx < 0) throw new Error('Akishibu "uid" not found in raw groups.json.');
  const elemStart = raw.lastIndexOf("{", uidIdx);

  /** LINK START follows アキシブ in committed catalog ordering. */
  const tailRe = /\},\r?\n  \{\r?\n    "uid": "TElOSyBTVEFSVA"/;
  const tm = tailRe.exec(raw);
  if (!tm) throw new Error("Could not locate LINK START anchor after アキシブ.");

  const closeIdx = tm.index;
  const pre = raw.slice(0, elemStart);
  const tail = raw.slice(closeIdx + 1);
  const out = `${pre}${wrapElem(groups[0])}${tail}`;
  fs.writeFileSync(groupsPath, out, "utf8");
}

function spliceSongsCouplings() {
  let raw = fs.readFileSync(songsPath, "utf8");
  if (raw.includes('"uid": "8656e516-ec9e-42db-9576-88cc65ef51fa"')) {
    console.log("songs: coupling rows already present; skipping splice");
    return;
  }

  /** After ニャンダフル…; next catalog row is 幻影★ギャラクティカ (stable splice anchor). */
  const anchorRe =
    /\r?\n  \{\r?\n    "uid": "6b3628ee-d900-4217-a46d-2b1fcd687ca5",/;
  const m = anchorRe.exec(raw);
  if (!m)
    throw new Error(
      "Could not find insert anchor before 幻影★ギャラクティカ — songs.json layout changed?",
    );

  const block = NEW_SONGS_BLOCK.replace(/\r?\n/g, "\r\n");
  raw = `${raw.slice(0, m.index)}${block}${raw.slice(m.index)}`;
  fs.writeFileSync(songsPath, raw, "utf8");
}

function main() {
  spliceGroupsFirstEntryAkishibu();
  spliceSongsCouplings();

  JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  JSON.parse(fs.readFileSync(songsPath, "utf8"));
  console.log("Akishibu discography patched (groups+json.parse validate ok)");
}

main();
