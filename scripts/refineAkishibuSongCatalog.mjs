/**
 * Applies refined アキシブproject song titles, variant labels, and solo attribution in
 * public/data/songs.json; syncs BEST album track_list + drops orphan song_uid from
 * public/data/groups.json. Writes whole songs.json parse/serialize — expect a broad diff once.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const songsPath = path.join(root, "public/data/songs.json");

// groups.json: surgical splice + validate (never stringify the whole array)
execFileSync(process.execPath, [path.join(root, "scripts/patchAkishibuGroupsJsonSafe.mjs")], {
  stdio: "inherit",
});

const songs = JSON.parse(fs.readFileSync(songsPath, "utf8"));

const edits = [
  [
    "a3c7ca04-3d60-4bba-9b98-5ea107a8da16",
    {
      title: "WHITE",
      title_romanji: "WHITE",
      title_variant: "LIVE ver.",
      title_listed: "WHITE (LIVE ver.)",
    },
  ],
  [
    "c2ca0088-591e-459d-a0ff-76ffb71a4c00",
    {
      title: "真夏のセレナーデ",
      title_romanji: "",
      title_variant: "LIVE ver.",
      title_listed: "真夏のセレナーデ (LIVE ver.)",
    },
  ],
  [
    "6575b72a-6558-43f3-b775-f07760db2e06",
    {
      title: "Creaction",
      title_romanji: "Creaction",
      title_variant: "2019 ver.",
      title_listed: "Creaction (2019 ver.)",
    },
  ],
  [
    "88255528-41de-4ec0-81ef-f4416686965e",
    {
      title: "つよくてニューゲーム+",
      title_romanji: "",
      solo_track: true,
      solo_member_uid: "f58e36c6-38e3-49d7-9253-2225dc16f3d2",
      solo_member_name: "茉井良菜",
      title_listed: "つよくてニューゲーム+ (茉井良菜)",
    },
  ],
  [
    "1f29fd12-83d9-42d9-b1c4-3fc35d32f8be",
    {
      title: "ときめきらいど!",
      title_romanji: "",
      solo_track: true,
      solo_member_uid: "f58e36c6-38e3-49d7-9253-2225dc16f3d2",
      solo_member_name: "茉井良菜",
      title_listed: "ときめきらいど! (茉井良菜)",
    },
  ],
  [
    "8bb84512-65ec-43df-81f4-7a33773d8922",
    {
      title: "PureMagic",
      title_romanji: "",
      solo_track: true,
      solo_member_uid: "45484495-8792-48db-bab0-560ee4107464",
      solo_member_name: "清見るん",
      title_listed: "PureMagic (清見るん)",
    },
  ],
  [
    "9ad5b1b3-0fd0-48f3-b760-0ed94391da4b",
    {
      title: "ニャンダフルステージ",
      title_romanji: "",
      solo_track: true,
      solo_member_uid: "45484495-8792-48db-bab0-560ee4107464",
      solo_member_name: "清見るん",
      title_listed: "ニャンダフルステージ (清見るん)",
    },
  ],
  [
    "8ca7cb73-e41f-47c8-8f6a-da0f326b2ae3",
    {
      solo_track: true,
      solo_member_uid: "3dfb8264-e501-45a7-a373-b3255445674e",
      solo_member_name: "古賀みれい",
    },
  ],
  [
    "697f1045-525c-4b1a-ac73-715f090c195c",
    {
      solo_track: true,
      solo_member_uid: "3dfb8264-e501-45a7-a373-b3255445674e",
      solo_member_name: "古賀みれい",
    },
  ],
];

const ids = new Set(edits.map(([u]) => u));
let applied = 0;
for (const row of songs) {
  const uid = String(row.uid ?? "");
  if (!ids.has(uid)) continue;
  const patchEntry = edits.find(([id]) => id === uid);
  if (!patchEntry) continue;
  Object.assign(row, patchEntry[1]);
  applied += 1;
}

if (applied !== edits.length) {
  console.error(`Expected ${edits.length} song rows patched, got ${applied}`);
  process.exit(1);
}

fs.writeFileSync(songsPath, `${JSON.stringify(songs, null, 2)}\n`);
JSON.parse(fs.readFileSync(songsPath, "utf8"));
console.log(`OK · ${applied} songs · groups best-of trio synced · orphan removed`);
