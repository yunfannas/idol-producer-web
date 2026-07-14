import fs from 'fs';

const groupsPath = 'public/data/groups.json';
const idolsPath = 'public/data/idols.json';
const oshiPath = 'public/oshi/data.json';
const songsPath = 'public/data/songs.json';

const GROUP_NAME = 'CAL&RES';
const FORMER_NAME = '天使にはなれない';

const currentMembers = [
  {
    name: '夢羽るる',
    uid: 'bbbf6d91-fc63-4331-b314-ae0899c1581c',
    member_color: 'Yellow',
    member_color_code: '0xffff00',
    color_ja: '黄',
    color_hex: '#ffff00',
    start_date: '2022-07-04',
    romaji: 'Yumeha Ruru',
    hiragana: 'ゆめはるる',
    wiki_url: 'https://jpop.fandom.com/wiki/Yumeha_Ruru',
  },
  {
    name: '来夢ねお',
    uid: '4a5ab837-43a4-413a-bbe8-d7173401a088',
    member_color: 'Blue',
    member_color_code: '0x0000ff',
    color_ja: '青',
    color_hex: '#0000ff',
    start_date: '2024-08-21',
    romaji: 'Lime Neo',
    hiragana: 'らいむねお',
    wiki_url: 'https://jpop.fandom.com/wiki/Lime_Neo',
  },
  {
    name: '九条あすな',
    uid: '6b582779-013a-4d5a-aff9-5dbce3b54fda',
    member_color: 'Red',
    member_color_code: '0xff0000',
    color_ja: '赤',
    color_hex: '#ff0000',
    start_date: '2025-04-25',
    romaji: 'Kujo Asuna',
    hiragana: 'くじょうあすな',
    wiki_url: 'https://jpop.fandom.com/wiki/Kujo_Asuna',
  },
  {
    name: '明日実まあや',
    uid: '64bc50f9-bd2f-47a7-99e2-b39e0318924e',
    member_color: 'Orange',
    member_color_code: '0xffa500',
    color_ja: 'オレンジ',
    color_hex: '#ffa500',
    start_date: '2025-04-26',
    romaji: 'Asumi Maaya',
    hiragana: 'あすみまあや',
    wiki_url: 'https://jpop.fandom.com/wiki/Asumi_Maaya',
  },
];

const annin = {
  name: '杏仁みる',
  uid: '4cad7e1f-ca74-4088-9211-42fac3cda306',
  end_date: '2026-06-17',
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function ensureArrayUnique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function updateGroup(groups, songs) {
  const group = groups.find((entry) => entry.name === GROUP_NAME);
  if (!group) throw new Error('CAL&RES group not found');

  group.member_names = currentMembers.map((member) => member.name);
  group.member_uids = currentMembers.map((member) => member.uid);
  group.member_count = currentMembers.length;

  group.past_member_names = ensureArrayUnique([...(group.past_member_names || []), annin.name]);
  group.past_member_uids = ensureArrayUnique([...(group.past_member_uids || []), annin.uid]);
  group.past_member_count = group.past_member_names.length;

  group.wiki_url = 'https://jpop.fandom.com/wiki/CAL%26RES';
  group.name_romanji = 'CAL&RES';
  group.formed_date = '2021-08-16';

  const legacySongs = songs
    .filter((song) => song.group_name === FORMER_NAME)
    .slice()
    .sort((a, b) => {
      const ta = a.albums?.[0]?.track_number ?? 999;
      const tb = b.albums?.[0]?.track_number ?? 999;
      return ta - tb || a.title.localeCompare(b.title, 'ja');
    });
  group.song_uids = legacySongs.map((song) => song.uid);

  return { group, legacySongs };
}

function updateIdols(idols) {
  for (const member of currentMembers) {
    const idol = idols.find((entry) => entry.uid === member.uid || entry.name === member.name);
    if (!idol) continue;
    idol.romaji = member.romaji;
    idol.hiragana = member.hiragana;
    idol.wiki_url = member.wiki_url;
    idol.portrait_photo_path = `fetcher\\database\\picture_fandom\\${member.name}_portrait.jpg`;

    const history = idol.group_history || [];
    const row = history.find((entry) => entry.group_name === GROUP_NAME);
    if (row) {
      row.start_date = member.start_date;
      row.end_date = null;
      row.member_name = member.name;
      row.member_color = member.member_color;
      row.member_color_code = member.member_color_code;
      row.group_uid = 'Q0FMJlJFUw';
    }
    idol.group_history = history;
  }

  const anninIdol = idols.find((entry) => entry.uid === annin.uid || entry.name === annin.name);
  if (anninIdol) {
    const groupRow = (anninIdol.group_history || []).find((entry) => entry.group_name === GROUP_NAME);
    if (groupRow) {
      groupRow.end_date = annin.end_date;
      groupRow.member_name = annin.name;
      groupRow.member_color = 'White';
      groupRow.member_color_code = '0xffffff';
      groupRow.group_uid = 'Q0FMJlJFUw';
    }
    const heroinesRow = (anninIdol.group_history || []).find((entry) => entry.group_name === 'HEROINES');
    if (heroinesRow) {
      heroinesRow.end_date = annin.end_date;
    }
  }
}

function updateOshi(oshi, legacySongs) {
  const group = (oshi.groups || []).find((entry) => entry.name === GROUP_NAME);
  if (!group) throw new Error('CAL&RES oshi group not found');

  group.members = currentMembers.map((member) => ({
    uid: member.uid,
    name: member.name,
    color: member.color_ja,
    color_hex: member.color_hex,
    portrait_url: `../data/pictures/idols/${encodeURIComponent(member.name)}_portrait.jpg`,
  }));

  group.songs = legacySongs.map((song) => ({
    uid: song.uid,
    title: song.title,
    popularity: song.popularity ?? null,
  }));
}

const groups = readJson(groupsPath);
const idols = readJson(idolsPath);
const songs = readJson(songsPath);
const oshi = readJson(oshiPath);

const { legacySongs } = updateGroup(groups, songs);
updateIdols(idols);
updateOshi(oshi, legacySongs);

writeJson(groupsPath, groups);
writeJson(idolsPath, idols);
writeJson(oshiPath, oshi);
