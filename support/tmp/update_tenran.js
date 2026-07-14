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

const GROUP_NAME = 'テンシンランマン';
const GROUP_NAME_ROMANJI = 'Tenshinranman';
const GROUP_UID = '44OG44Oz44K344Oz44Op44Oz44Oe44Oz';

const members = [
  {
    name: '琴音うな',
    uid: '7dff5868-8cdd-4084-bdf3-febfa8e16d6a',
    start_date: '2025-04-25',
    color: 'Yellow',
    color_code: '0xffff00',
    color_label: '黄',
    color_hex: '#ffff00',
  },
  {
    name: '小倉あずき',
    uid: 'cfd9ec40-5872-45ec-87bb-942cf1fb831a',
    start_date: '2025-04-27',
    color: 'Purple',
    color_code: '0x800080',
    color_label: '紫',
    color_hex: '#800080',
  },
  {
    name: '味園そら',
    uid: 'af153998-7078-4dd3-b3cf-cbcd9a723ca4',
    start_date: '2025-04-29',
    color: 'Blue',
    color_code: '0x0000ff',
    color_label: '青',
    color_hex: '#0000ff',
  },
  {
    name: '織田こゆん',
    uid: '6ba6f91f-870d-47fa-9c6a-1659205fa3ba',
    start_date: '2025-05-01',
    color: 'Green',
    color_code: '0x008000',
    color_label: '緑',
    color_hex: '#008000',
  },
  {
    name: '海老原てん',
    uid: '6445ef44-1628-419b-9def-6c8048f2be2c',
    start_date: '2025-05-03',
    color: 'White',
    color_code: '0xffffff',
    color_label: '白',
    color_hex: '#ffffff',
  },
  {
    name: '大須かのん',
    uid: '668dfc7d-ba0a-4534-b201-5c2060689f05',
    start_date: '2025-11-12',
    color: 'Red',
    color_code: '0xff0000',
    color_label: '赤',
    color_hex: '#ff0000',
  },
  {
    name: '豊田もも',
    uid: '17367f34-b7e7-434b-b08d-6410fbf49aba',
    start_date: '2025-11-13',
    color: 'Pink',
    color_code: '0xffc0cb',
    color_label: 'ピンク',
    color_hex: '#ffc0cb',
  },
];

const releases = [
  {
    uid: '6de58cfd-12d1-436b-a512-4d09a96836e3',
    title: '天真',
    title_romanji: 'Tenshin',
    disc_type: 'Digital EP',
    release_date: '2025-05-16',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: null,
    catalog_number: '',
    description: '',
    track_list: [
      'でらでらデラックス (DeraDeraDeluxe)',
      'キミノヒトミニLOVE (Kimi no hitomi ni LOVE)',
      'StarFall',
      '限界プレイス (Genkai Place)',
      'チャーキーパーキーチャーム (Chaakipaakichaamu)',
    ],
    duration: null,
    cover_image_path: 'picture/天真_cover.webp',
  },
  {
    uid: 'f8568bd1-baad-4325-ba35-d2f6dab63f14',
    title: '爛漫',
    title_romanji: 'Ranman',
    disc_type: 'Digital Single',
    release_date: '2025-05-23',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: null,
    catalog_number: '',
    description: '',
    track_list: [
      'どえりゃNagoya!! (Doerya Nagoya!!)',
      'ハッピーストレージ (Happy Storage)',
      'Cinder',
    ],
    duration: null,
    cover_image_path: 'picture/爛漫_cover.webp',
  },
  {
    uid: '67a5971a-a2c5-4175-b5e4-97605e982aba',
    title: '恋のそら模様',
    title_romanji: 'Koi no Sora Moyou',
    disc_type: 'Digital Solo Single',
    release_date: '2025-12-25',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: null,
    catalog_number: '',
    description: '味園そら solo digital single',
    track_list: [],
    duration: null,
    cover_image_path: null,
  },
  {
    uid: '586b9884-0321-486c-85fe-d521d9d0a4ba',
    title: 'ときめきはストロボ',
    title_romanji: 'Tokimeki wa Strobe',
    disc_type: 'Digital Solo Single',
    release_date: '2026-05-02',
    publisher: 'CROSS SIDE MUSIC',
    publisher_uid: null,
    catalog_number: '',
    description: '海老原てん solo digital single',
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

function upsertHistory(idol, groupName, patch) {
  const history = Array.isArray(idol.group_history) ? idol.group_history : [];
  let row = history.find((item) => item.group_name === groupName && (patch.group_uid ? item.group_uid === patch.group_uid : true));
  if (!row) {
    row = { group_name: groupName };
    history.push(row);
  }
  Object.assign(row, patch, { group_name: groupName });
  idol.group_history = history;
}

function ensureSongRows(songs) {
  for (const release of releases) {
    let row = songs.find(
      (item) =>
        item.group_name === GROUP_NAME &&
        (item.uid === release.uid || (item.title === release.title && item.release_date === release.release_date))
    );
    if (!row) {
      row = {
        ...release,
        group_uid: GROUP_UID,
        group_name: GROUP_NAME,
        albums: [{ disc_uid: null, name: '', track_number: null }],
        disc_uid: null,
      };
      songs.push(row);
    } else {
      Object.assign(row, release, {
        group_uid: GROUP_UID,
        group_name: GROUP_NAME,
        albums: Array.isArray(row.albums) && row.albums.length ? row.albums : [{ disc_uid: null, name: '', track_number: null }],
      });
      if (!('disc_uid' in row)) {
        row.disc_uid = null;
      }
    }
  }
}

function patchGroup(group, songs) {
  group.member_names = members.map((member) => member.name);
  group.member_uids = members.map((member) => member.uid);
  group.member_count = members.length;

  const discography = Array.isArray(group.discography) ? group.discography : [];
  for (const release of releases) {
    const existing = discography.find(
      (item) => item.uid === release.uid || (item.title === release.title && item.release_date === release.release_date)
    );
    if (existing) {
      Object.assign(existing, release);
    } else {
      discography.push({ ...release });
    }
  }
  discography.sort(
    (a, b) =>
      String(a.release_date || '').localeCompare(String(b.release_date || '')) ||
      String(a.title || '').localeCompare(String(b.title || ''))
  );
  group.discography = discography;
  group.disc_uids = discography.map((item) => item.uid);

  const songRows = songs
    .filter((item) => item.group_name === GROUP_NAME)
    .sort(
      (a, b) =>
        String(a.release_date || '').localeCompare(String(b.release_date || '')) ||
        String(a.title || '').localeCompare(String(b.title || ''))
    );
  group.song_uids = songRows.map((item) => item.uid);
}

function patchIdols(idols) {
  for (const member of members) {
    const idol = idols.find((item) => item.uid === member.uid || item.name === member.name);
    if (!idol) {
      continue;
    }

    upsertHistory(idol, GROUP_NAME, {
      start_date: member.start_date,
      end_date: null,
      member_name: member.name,
      member_color: member.color,
      member_color_code: member.color_code,
      group_uid: GROUP_UID,
    });

    upsertHistory(idol, GROUP_NAME_ROMANJI, {
      start_date: null,
      end_date: null,
      member_name: member.name,
      member_color: member.color,
      member_color_code: member.color_code,
    });
  }
}

function patchOshi() {
  if (!fs.existsSync(oshiPath)) {
    return;
  }

  const oshi = readJson(oshiPath);
  const songs = readJson(path.resolve(__dirname, '../../public/data/songs.json'));
  const oshiGroup = (oshi.groups || []).find((item) => item.name === GROUP_NAME);
  if (!oshiGroup) {
    return;
  }

  oshiGroup.members = members.map((member) => ({
    uid: member.uid,
    name: member.name,
    color: member.color_label,
    color_hex: member.color_hex,
    portrait_url: `../data/pictures/idols/${encodeURIComponent(member.name)}_portrait.jpg`,
  }));

  const songRows = songs
    .filter((item) => item.group_name === GROUP_NAME)
    .sort(
      (a, b) =>
        String(a.release_date || '').localeCompare(String(b.release_date || '')) ||
        String(a.title || '').localeCompare(String(b.title || ''))
    );
  oshiGroup.songs = songRows.map((item) => ({
    uid: item.uid,
    title: item.title,
    popularity: item.popularity ?? null,
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

    ensureSongRows(songs);

    const group = groups.find((item) => item.name === GROUP_NAME);
    if (!group) {
      throw new Error(`Group ${GROUP_NAME} not found in ${groupsPath}`);
    }

    patchGroup(group, songs);
    patchIdols(idols);

    writeJson(groupsPath, groups);
    writeJson(idolsPath, idols);
    writeJson(songsPath, songs);
  }

  patchOshi();
}

main();
