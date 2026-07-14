import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roots = [
  path.resolve(__dirname, '../../public/data'),
  path.resolve(__dirname, '../../../idol_producer/database'),
];

const oshiPath = path.resolve(__dirname, '../../public/oshi/data.json');

const GROUP_NAME = 'パラレルサイダー';
const GROUP_UID = '44OR44Op44Os44Or44K144Kk44OA44O8';
const AIRI_UID = 'b869b751-6cba-4369-aa9f-738dcba7b388';
const MOCO_UID = 'd3bf4d5b-cb45-48da-bcd3-cb7ef6f9d4f4';
const NATSUKI_UID = '58d3ab95-4f9d-4fab-9214-7ccdb7610c6e';
const NARRATIVE_DISC_UID = '14909035-9a33-46e6-a072-8e43faf4c1e6';

const currentMembers = [
  { name: '小熊まな香', uid: '49c29171-7208-43a5-a46e-5027f22c9220', colorLabel: '水色', colorHex: '#a3e0ff' },
  { name: '小坂みおん', uid: 'fa2e9768-6b00-468a-be74-6d6535d98ba9', colorLabel: '紫', colorHex: '#800080' },
  { name: '葉月みつは', uid: '93b80c0e-5df8-440d-9045-79cc1d2b5baa', colorLabel: 'ミント', colorHex: '#98ff98' },
  { name: '彩音ゆの', uid: '7a72fc17-7379-4115-9b77-e2d0c4355bcb', colorLabel: '白', colorHex: '#ffffff' },
  { name: '宇佐美あこ', uid: '87f42c82-e076-4799-808d-19d6a597bc4f', colorLabel: 'ピンク', colorHex: '#ffc0cb' },
  { name: '瀬川なつき', uid: NATSUKI_UID, colorLabel: '青', colorHex: '#0000ff' },
];

const pastMembersToEnsure = [
  { name: '宝城あいり', uid: AIRI_UID },
  { name: '宮奈もこ', uid: MOCO_UID },
];

const narrativeTrackOrder = [
  'Narrative',
  'パラレルサイダー',
  '流星トワイライト',
  'グラデーション',
  'フェイクフェイス',
  '青い鳥の在り処',
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function upsertHistory(idol, patch) {
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  let row = history.find((item) => item.group_name === patch.group_name);
  if (!row) {
    row = { group_name: patch.group_name };
    history.push(row);
  }
  Object.assign(row, patch);
  idol.group_history = history;
}

function patchGroup(group, songs) {
  group.member_names = currentMembers.map((member) => member.name);
  group.member_uids = currentMembers.map((member) => member.uid);
  group.member_count = currentMembers.length;

  const pastNames = new Set(group.past_member_names || []);
  const pastUids = new Set(group.past_member_uids || []);
  for (const member of pastMembersToEnsure) {
    pastNames.add(member.name);
    pastUids.add(member.uid);
  }
  group.past_member_names = Array.from(pastNames);
  group.past_member_uids = Array.from(pastUids);
  group.past_member_count = group.past_member_names.length;

  const narrativeDisc = (group.discography || []).find((disc) => disc.uid === NARRATIVE_DISC_UID);
  if (narrativeDisc) {
    narrativeDisc.title = 'Narrative';
    narrativeDisc.title_romanji = 'Narrative';
    narrativeDisc.disc_type = 'EP';
    narrativeDisc.release_date = '2025-12-25';
    narrativeDisc.track_list = narrativeTrackOrder.slice();
    narrativeDisc.track_song_uids = narrativeTrackOrder
      .map((title) => songs.find((song) => song.group_name === GROUP_NAME && song.title === title)?.uid)
      .filter(Boolean);
  }
}

function patchIdols(idols) {
  const airi = idols.find((idol) => idol.uid === AIRI_UID || idol.name === '宝城あいり');
  if (airi) {
    upsertHistory(airi, {
      group_name: GROUP_NAME,
      start_date: '2025-06-27',
      end_date: '2026-04-06',
      member_name: '宝城あいり',
      member_color: 'Yellow',
      member_color_code: '0xffff00',
      group_uid: GROUP_UID,
    });
  }

  const moco = idols.find((idol) => idol.uid === MOCO_UID || idol.name === '宮奈もこ');
  if (moco) {
    upsertHistory(moco, {
      group_name: GROUP_NAME,
      start_date: '2025-06-25',
      end_date: '2026-06-28',
      member_name: '宮奈もこ',
      member_color: 'Red',
      member_color_code: '0xff0000',
      group_uid: GROUP_UID,
    });
    upsertHistory(moco, {
      group_name: 'HEROINES',
      start_date: null,
      end_date: '2026-06-28',
      member_color: null,
      member_color_code: null,
    });
  }

  const natsuki = idols.find((idol) => idol.uid === NATSUKI_UID || idol.name === '瀬川なつき');
  if (natsuki) {
    upsertHistory(natsuki, {
      group_name: GROUP_NAME,
      start_date: '2026-06-16',
      end_date: null,
      member_name: '瀬川なつき',
      member_color: 'Blue',
      member_color_code: '0x0000ff',
      group_uid: GROUP_UID,
    });
    upsertHistory(natsuki, {
      group_name: 'HEROINES',
      start_date: null,
      end_date: null,
      member_color: null,
      member_color_code: null,
    });
  }
}

function patchSongs(songs) {
  for (const song of songs) {
    if (song.group_name !== GROUP_NAME) continue;

    if (Array.isArray(song.albums)) {
      for (const album of song.albums) {
        if (album.name === 'Narrative - EP') {
          album.name = 'Narrative';
          album.disc_uid = NARRATIVE_DISC_UID;
        }
      }
    }

    const onNarrative = Array.isArray(song.albums) && song.albums.some((album) => album.name === 'Narrative');
    if (onNarrative) {
      song.disc_uid = NARRATIVE_DISC_UID;
      if (song.title === 'パラレルサイダー') {
        song.release_date = '2022-12-02';
      } else if (narrativeTrackOrder.includes(song.title)) {
        song.release_date = '2025-12-25';
      }
    }
  }
}

function patchOshi() {
  if (!fs.existsSync(oshiPath)) return;
  const oshi = readJson(oshiPath);
  const songs = readJson(path.resolve(__dirname, '../../public/data/songs.json'));
  const oshiGroup = (oshi.groups || []).find((item) => item.name === GROUP_NAME);
  if (!oshiGroup) return;

  oshiGroup.members = currentMembers.map((member) => ({
    uid: member.uid,
    name: member.name,
    color: member.colorLabel,
    color_hex: member.colorHex,
    portrait_url: `../data/pictures/idols/${encodeURIComponent(member.name)}_portrait.jpg`,
  }));

  const songRows = songs
    .filter((row) => row.group_name === GROUP_NAME)
    .sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || '')) || String(a.title || '').localeCompare(String(b.title || '')));
  oshiGroup.songs = songRows.map((row) => ({
    uid: row.uid,
    title: row.title,
    popularity: row.popularity ?? null,
  }));

  oshi.generated_at = new Date().toISOString().slice(0, 19);
  writeJson(oshiPath, oshi);
}

function main() {
  for (const root of roots) {
    const groupsPath = path.join(root, 'groups.json');
    const idolsPath = path.join(root, 'idols.json');
    const songsPath = path.join(root, 'songs.json');

    if (!fs.existsSync(groupsPath) || !fs.existsSync(idolsPath) || !fs.existsSync(songsPath)) {
      continue;
    }

    const groups = readJson(groupsPath);
    const idols = readJson(idolsPath);
    const songs = readJson(songsPath);

    const group = groups.find((item) => item.name === GROUP_NAME);
    if (!group) {
      throw new Error(`Group ${GROUP_NAME} not found in ${groupsPath}`);
    }

    patchSongs(songs);
    patchGroup(group, songs);
    patchIdols(idols);

    writeJson(groupsPath, groups);
    writeJson(idolsPath, idols);
    writeJson(songsPath, songs);
  }

  patchOshi();
}

main();
