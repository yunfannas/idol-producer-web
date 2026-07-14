import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roots = [
  path.resolve(__dirname, '../../public/data'),
  path.resolve(__dirname, '../../../idol_producer/database'),
];

const webPictureDir = path.resolve(__dirname, '../../public/data/pictures/idols');
const desktopPictureDir = path.resolve(__dirname, '../../../idol_producer/fetcher/database/picture_fandom');
const oshiPath = path.resolve(__dirname, '../../public/oshi/data.json');

const GROUP_NAME = 'MEGAFON';
const GROUP_UID = 'TUVHQUZPTg';
const REN_UID = '98b403bf-5f64-4ba7-a714-90e4fe842d50';

const currentMembers = [
  { name: '小晴のか', uid: 'c0ebee02-589a-4741-8c09-6785625d0e2c', colorLabel: 'オレンジ', colorHex: '#ffa500' },
  { name: '星野あみ', uid: '91431844-e2b3-4d16-a119-ee792e3c8d92', colorLabel: '赤', colorHex: '#ff0000' },
  { name: '明音いろは', uid: '4137617f-21fa-48f0-8f22-46ca0c0f7352', colorLabel: '青', colorHex: '#0000ff' },
  { name: '羽雲ろこ', uid: 'e5a678c9-6448-4c69-9b27-5e2345b7d1b5', colorLabel: '水色', colorHex: '#87ceeb' },
  { name: '日陽きい', uid: '9e0f8916-375b-40a4-842b-cf6b2fbd3c7d', colorLabel: '黄', colorHex: '#ffff00' },
  { name: '宮代ゆき', uid: '2571d33a-51e8-4ca9-b577-a602318af81f', colorLabel: '白', colorHex: '#ffffff' },
];

const memberDates = {
  '好実れん': '2025-04-06',
  '小晴のか': '2025-04-07',
  '星野あみ': '2025-04-08',
  '明音いろは': '2025-04-09',
  '羽雲ろこ': '2025-04-10',
  '日陽きい': '2025-04-11',
  '宮代ゆき': '2025-04-12',
};

const memberColors = {
  '好実れん': ['Strongest Pink', '0xffc0cb'],
  '小晴のか': ['Mischievous Orange', '0xffa500'],
  '星野あみ': ['Powerful Red', '0xff0000'],
  '明音いろは': ['Blue', '0x0000ff'],
  '羽雲ろこ': ['Crybaby Sky Blue', '0x87ceeb'],
  '日陽きい': ['Hungry Yellow', '0xffff00'],
  '宮代ゆき': ['Considerate White', '0xffffff'],
};

const newDisc = {
  uid: 'b052f2b8-67b2-4d9a-abf6-7fd063f5670f',
  title: '本命スイートデイズ',
  title_romanji: 'Honmei Sweet Days',
  disc_type: 'Digital Single',
  release_date: '2026-04-25',
  publisher: 'CROSS SIDE MUSIC',
  publisher_uid: null,
  catalog_number: '',
  description: '',
  track_list: ['本命スイートデイズ'],
  duration: null,
  cover_image_path: null,
};

const portraits = [
  {
    filename: '好実れん_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/d/d8/Konomi_Ren_May_2026_1.jpg/revision/latest/scale-to-width-down/267?cb=20260508140630',
  },
  {
    filename: '小晴のか_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/7/73/KoharuNoka-May2026-1.jpg/revision/latest/scale-to-width-down/267?cb=20260512140707',
  },
  {
    filename: '星野あみ_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/c/c0/Hoshino_Ami_May_2026_1.jpg/revision/latest/scale-to-width-down/320?cb=20260510121305',
  },
  {
    filename: '明音いろは_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/b/b9/Ramune_Iroha_May_2026_1.jpg/revision/latest/scale-to-width-down/267?cb=20260506130916',
  },
  {
    filename: '羽雲ろこ_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/3/3e/Wakumo_Roko_May_2026_1.jpg/revision/latest/scale-to-width-down/267?cb=20260507115726',
  },
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
  pastNames.add('好実れん');
  pastUids.add(REN_UID);
  group.past_member_names = Array.from(pastNames);
  group.past_member_uids = Array.from(pastUids);
  group.past_member_count = group.past_member_names.length;

  const discography = Array.isArray(group.discography) ? group.discography : [];
  const existingDisc = discography.find(
    (item) => item.uid === newDisc.uid || (item.title_romanji === newDisc.title_romanji && item.release_date === newDisc.release_date)
  );
  if (existingDisc) {
    Object.assign(existingDisc, newDisc);
  } else {
    discography.push({ ...newDisc });
  }
  discography.sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || '')) || String(a.title || '').localeCompare(String(b.title || '')));
  group.discography = discography;
  group.disc_uids = discography.map((item) => item.uid);

  const songRows = songs
    .filter((row) => row.group_name === GROUP_NAME)
    .sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || '')) || String(a.title || '').localeCompare(String(b.title || '')));
  group.song_uids = songRows.map((row) => row.uid);
}

function patchIdols(idols) {
  for (const name of Object.keys(memberDates)) {
    const idol = idols.find((row) => row.name === name);
    if (!idol) continue;
    const [member_color, member_color_code] = memberColors[name];
    const endDate = name === '好実れん' ? '2026-07-08' : null;
    upsertHistory(idol, {
      group_name: GROUP_NAME,
      start_date: memberDates[name],
      end_date: endDate,
      member_name: name,
      member_color,
      member_color_code,
      group_uid: GROUP_UID,
    });
    if (name === '好実れん') {
      upsertHistory(idol, {
        group_name: 'HEROINES',
        start_date: '2025-04-06',
        end_date: '2026-07-08',
        member_color: null,
        member_color_code: null,
      });
    }
  }
}

function ensureSong(songs) {
  let row = songs.find(
    (item) => item.group_name === GROUP_NAME && (item.uid === newDisc.uid || (item.title_romanji === 'Honmei Sweet Days' && item.release_date === '2026-04-25'))
  );
  if (!row) {
    row = {
      ...newDisc,
      group_uid: GROUP_UID,
      group_name: GROUP_NAME,
      albums: [{ disc_uid: null, name: '', track_number: null }],
      disc_uid: null,
    };
    songs.push(row);
  } else {
    Object.assign(row, newDisc, {
      group_uid: GROUP_UID,
      group_name: GROUP_NAME,
      albums: Array.isArray(row.albums) && row.albums.length ? row.albums : [{ disc_uid: null, name: '', track_number: null }],
    });
    if (!('disc_uid' in row)) row.disc_uid = null;
  }
}

function patchOshi() {
  if (!fs.existsSync(oshiPath)) return;
  const oshi = readJson(oshiPath);
  const groups = readJson(path.resolve(__dirname, '../../public/data/groups.json'));
  const songs = readJson(path.resolve(__dirname, '../../public/data/songs.json'));
  const group = groups.find((item) => item.name === GROUP_NAME);
  const oshiGroup = (oshi.groups || []).find((item) => item.name === GROUP_NAME);
  if (!group || !oshiGroup) return;

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

async function downloadPortraits() {
  fs.mkdirSync(webPictureDir, { recursive: true });
  fs.mkdirSync(desktopPictureDir, { recursive: true });
  for (const portrait of portraits) {
    const response = await fetch(portrait.url);
    if (!response.ok) {
      throw new Error(`Failed to download ${portrait.url}: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(webPictureDir, portrait.filename), buffer);
    fs.writeFileSync(path.join(desktopPictureDir, portrait.filename), buffer);
  }
}

async function main() {
  for (const root of roots) {
    const groupsPath = path.join(root, 'groups.json');
    const idolsPath = path.join(root, 'idols.json');
    const songsPath = path.join(root, 'songs.json');

    const groups = readJson(groupsPath);
    const idols = readJson(idolsPath);
    const songs = readJson(songsPath);

    ensureSong(songs);

    const group = groups.find((item) => item.name === GROUP_NAME);
    if (!group) throw new Error(`${GROUP_NAME} not found in ${groupsPath}`);
    patchGroup(group, songs);
    patchIdols(idols);

    writeJson(groupsPath, groups);
    writeJson(idolsPath, idols);
    writeJson(songsPath, songs);
  }

  await downloadPortraits();
  patchOshi();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
