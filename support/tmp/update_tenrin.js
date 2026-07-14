import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const roots = [
  path.resolve(__dirname, '../../public/data'),
  path.resolve(__dirname, '../../../idol_producer/database'),
];

const desktopPictureDir = path.resolve(__dirname, '../../../idol_producer/fetcher/database/picture_fandom');
const webPictureDir = path.resolve(__dirname, '../../public/data/pictures/idols');
const oshiPath = path.resolve(__dirname, '../../public/oshi/data.json');

const TENRIN_UID = 'VEVOUklO';
const PUBLISHER_UID = '25d949d9-09ba-46b1-8a8c-844d402a4efd';

const currentMembers = [
  { name: 'のもあちゃちゃ', uid: '52311409-c4f5-4de1-950b-cc18afd1698d', colorLabel: '赤', colorHex: '#ff0000' },
  { name: '白洲あやん', uid: 'bfcaec9e-eb04-4d51-ba11-99cbf2511c2d', colorLabel: '白', colorHex: '#ffffff' },
  { name: '七瀬にこ', uid: '163b40d8-699f-4236-b579-c244ff8e6f9b', colorLabel: '紫', colorHex: '#800080' },
  { name: '蓮花うらら', uid: '1ae94901-0ab4-41d1-a3f8-70218ce9d8d6', colorLabel: 'ピンク', colorHex: '#ffc0cb' },
  { name: '霞あげは', uid: 'fb71c955-3afd-4a4e-a6dc-4a7c9e76f4a8', colorLabel: '青', colorHex: '#0000ff' },
  { name: '甘音ゆあ', uid: '1666ef5f-d042-4f91-bcda-18628ecd453d', colorLabel: '黄', colorHex: '#ffff00' },
  { name: '刻乃なう', uid: 'c6740f57-6323-42d5-98c3-ab61ff31e639', colorLabel: '水色', colorHex: '#add8e6' },
  { name: '音瀬歩兎', uid: '28034a04-57a1-4da4-a526-637b54cc8135', colorLabel: '緑', colorHex: '#008000' },
];

const portraits = [
  {
    filename: '甘音ゆあ_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/7/74/Amane_Yua_May_2026_1.jpg/revision/latest/scale-to-width-down/267?cb=20260508104232',
  },
  {
    filename: '刻乃なう_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/b/b4/Tokino_Nau_May_2026_1.jpg/revision/latest/scale-to-width-down/267?cb=20260509104036',
  },
  {
    filename: '音瀬歩兎_portrait.jpg',
    url: 'https://static.wikia.nocookie.net/jpop/images/4/46/Otose_Alto_May_2026_1.jpg/revision/latest/scale-to-width-down/267?cb=20260510115908',
  },
];

const newDiscs = [
  {
    uid: 'cb2c6738-717e-4208-bf22-e50274ecf946',
    title: '人ニ、非ズ',
    title_romanji: 'Hito ni, Arazu',
    disc_type: 'Digital Single',
    release_date: '2025-03-12',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: 'be984d5d-71a1-4271-b3c9-1cfe7a6ae2bd',
    title: 'Past Shapes',
    title_romanji: '',
    disc_type: 'Album',
    release_date: '2026-02-21',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: '8af6822b-966d-487f-b09e-087883c90e38',
    title: 'SAVE YOU',
    title_romanji: '',
    disc_type: 'Digital Single',
    release_date: '2026-05-25',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '霞あげは solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: '5f8e2dac-a0a0-4925-87e1-7dc1d45dfe37',
    title: 'どりぃむちゃちゃらんど',
    title_romanji: 'Dream Chacha Land',
    disc_type: 'Digital Single',
    release_date: '2026-05-25',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: 'のもあちゃちゃ solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: '71173086-13ca-4141-83d8-eb0d962de2db',
    title: 'SnowTears',
    title_romanji: '',
    disc_type: 'Digital Single',
    release_date: '2026-05-25',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '蓮花うらら solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: '0a04112f-c629-462b-9bc0-9ee266805df5',
    title: 'Grudge',
    title_romanji: '',
    disc_type: 'Digital Single',
    release_date: '2026-05-26',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '雅なぎ solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: 'b4e1cd46-b9de-43ca-9ebe-1a1607f05380',
    title: 'ニコニコLouder',
    title_romanji: 'Nico Nico Louder',
    disc_type: 'Digital Single',
    release_date: '2026-05-26',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '七瀬にこ solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: '1b46fdc6-772d-4c97-885d-ee34c9d278d4',
    title: '発見! やんだ! ぱんだ!',
    title_romanji: 'Hakken! Yanda! Panda!',
    disc_type: 'Digital Single',
    release_date: '2026-05-26',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: PUBLISHER_UID,
    catalog_number: '',
    description: '白洲あやん solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureHistoryEntry(idol, entry) {
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  let target = history.find((item) => item.group_name === entry.group_name && (item.group_uid || null) === (entry.group_uid || null));
  if (!target) {
    target = history.find((item) => item.group_name === entry.group_name && !item.group_uid);
  }
  if (!target) {
    target = { group_name: entry.group_name };
    history.push(target);
    idol.group_history = history;
  }
  Object.assign(target, entry);
  let nextHistory = history.filter(
    (item, index) =>
      history.findIndex(
        (cand) => cand.group_name === item.group_name && (cand.group_uid || '') === (item.group_uid || '')
      ) === index
  );
  if (entry.group_uid) {
    nextHistory = nextHistory.filter((item) => !(item.group_name === entry.group_name && !item.group_uid));
  }
  idol.group_history = nextHistory;
}

function ensureSongRows(songs) {
  for (const disc of newDiscs) {
    let existing = songs.find(
      (row) => row.group_name === 'TENRIN' && row.release_date === disc.release_date && (row.title === disc.title || row.title_romanji === disc.title_romanji)
    );
    if (!existing) {
      existing = { ...disc, group_uid: TENRIN_UID, group_name: 'TENRIN', albums: [{ disc_uid: null, name: '', track_number: null }], disc_uid: null };
      songs.push(existing);
    } else {
      Object.assign(existing, disc, {
        group_uid: TENRIN_UID,
        group_name: 'TENRIN',
        albums: Array.isArray(existing.albums) && existing.albums.length ? existing.albums : [{ disc_uid: null, name: '', track_number: null }],
      });
      if (!('disc_uid' in existing)) existing.disc_uid = null;
    }
  }
}

function patchGroup(group, songs) {
  group.member_names = currentMembers.map((member) => member.name);
  group.member_uids = currentMembers.map((member) => member.uid);
  group.member_count = currentMembers.length;

  const discography = Array.isArray(group.discography) ? group.discography : [];
  for (const disc of newDiscs) {
    const existing = discography.find((item) => item.uid === disc.uid || (item.title === disc.title && item.release_date === disc.release_date));
    if (existing) {
      Object.assign(existing, disc);
    } else {
      discography.push({ ...disc });
    }
  }
  discography.sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || '')) || String(a.title || '').localeCompare(String(b.title || '')));
  group.discography = discography;
  group.disc_uids = discography.map((item) => item.uid);

  const songRows = songs
    .filter((row) => row.group_name === 'TENRIN')
    .sort((a, b) => String(a.release_date || '').localeCompare(String(b.release_date || '')) || String(a.title || '').localeCompare(String(b.title || '')));
  group.song_uids = songRows.map((row) => row.uid);
}

function patchIdols(idols) {
  const amane = idols.find((idol) => idol.uid === '1666ef5f-d042-4f91-bcda-18628ecd453d');
  if (!amane) throw new Error('Amane Yua row not found');
  ensureHistoryEntry(amane, {
    group_name: 'TENRIN',
    start_date: '2026-05-08',
    end_date: null,
    member_name: '甘音ゆあ',
    member_color: 'Yellow',
    member_color_code: '0xffff00',
    group_uid: TENRIN_UID,
  });

  const tokino = idols.find((idol) => idol.uid === 'c6740f57-6323-42d5-98c3-ab61ff31e639');
  if (!tokino) throw new Error('Tokino Now row not found');
  ensureHistoryEntry(tokino, {
    group_name: 'TENRIN',
    start_date: '2026-05-09',
    end_date: null,
    member_name: '刻乃なう',
    member_color: 'Light Blue',
    member_color_code: '0xadd8e6',
    group_uid: TENRIN_UID,
  });

  let otose = idols.find((idol) => idol.uid === '28034a04-57a1-4da4-a526-637b54cc8135' || idol.name === '音瀬歩兎');
  if (!otose) {
    otose = {
      uid: '28034a04-57a1-4da4-a526-637b54cc8135',
      name: '音瀬歩兎',
      hiragana: 'おとせあると',
      nickname: '',
      past_names: {
        '叶羽もな': 'Kanaha Mona',
      },
      birthday: null,
      age: null,
      height: 170,
      birthplace: '',
      blood_type: 'O',
      languages: ['Japanese'],
      group_history: [],
      x_followers: null,
      portrait_photo_path: 'fetcher\\database\\picture_fandom\\音瀬歩兎_portrait.jpg',
      romaji: 'Otose Alto',
      wiki_url: 'https://jpop.fandom.com/wiki/Otose_Alto',
      sources: ['jpop_wiki'],
      data_sources: ['jpop_wiki'],
    };
    idols.push(otose);
  }
  otose.portrait_photo_path = 'fetcher\\database\\picture_fandom\\音瀬歩兎_portrait.jpg';
  otose.romaji = 'Otose Alto';
  otose.hiragana = otose.hiragana || 'おとせあると';
  otose.height = otose.height ?? 170;
  otose.birthplace = otose.birthplace || '';
  otose.birthday = otose.birthday || null;
  otose.age = otose.age ?? null;
  otose.blood_type = otose.blood_type || 'O';
  otose.languages = Array.isArray(otose.languages) && otose.languages.length ? otose.languages : ['Japanese'];
  otose.past_names = otose.past_names && Object.keys(otose.past_names).length ? otose.past_names : { '叶羽もな': 'Kanaha Mona' };
  otose.wiki_url = 'https://jpop.fandom.com/wiki/Otose_Alto';
  otose.sources = ['jpop_wiki'];
  otose.data_sources = ['jpop_wiki'];
  ensureHistoryEntry(otose, {
    group_name: 'TENRIN',
    start_date: '2026-05-10',
    end_date: null,
    member_name: '音瀬歩兎',
    member_color: 'Green',
    member_color_code: '0x008000',
    group_uid: TENRIN_UID,
  });
}

function patchOshi() {
  if (!fs.existsSync(oshiPath)) return;
  const oshi = readJson(oshiPath);
  const songs = readJson(path.resolve(__dirname, '../../public/data/songs.json'));
  const oshiGroup = (oshi.groups || []).find((item) => item.name === 'TENRIN');
  if (!oshiGroup) return;

  oshiGroup.members = currentMembers.map((member) => ({
    uid: member.uid,
    name: member.name,
    color: member.colorLabel,
    color_hex: member.colorHex,
    portrait_url: `../data/pictures/idols/${encodeURIComponent(member.name)}_portrait.jpg`,
  }));

  const songRows = songs
    .filter((row) => row.group_name === 'TENRIN')
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
  for (const { filename, url } of portraits) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download ${url}: ${response.status}`);
    }
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(path.join(webPictureDir, filename), buffer);
    fs.writeFileSync(path.join(desktopPictureDir, filename), buffer);
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

    ensureSongRows(songs);

    const group = groups.find((item) => item.uid === TENRIN_UID || item.name === 'TENRIN');
    if (!group) throw new Error(`TENRIN not found in ${groupsPath}`);
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
