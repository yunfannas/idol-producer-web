import fs from 'fs';

const idolsPath = 'public/data/idols.json';
const oshiPath = 'public/oshi/data.json';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

const idols = readJson(idolsPath);
const idol = idols.find((entry) => entry.name === '熊ノ実にも');
if (!idol) {
  throw new Error('熊ノ実にも not found in idols.json');
}

const nanakoroHistory = (idol.group_history || []).find((entry) => entry.group_name === 'ナナコロビヤオキ');
if (!nanakoroHistory) {
  throw new Error('ナナコロビヤオキ history row not found for 熊ノ実にも');
}

nanakoroHistory.member_color = 'Orange';
nanakoroHistory.member_color_code = '0xffa500';
writeJson(idolsPath, idols);

const oshi = readJson(oshiPath);
const group = (oshi.groups || []).find((entry) => entry.name === 'ナナコロビヤオキ');
if (!group) {
  throw new Error('ナナコロビヤオキ not found in oshi data');
}

const member = (group.members || []).find((entry) => entry.name === '熊ノ実にも');
if (!member) {
  throw new Error('熊ノ実にも not found in oshi group members');
}

member.color = 'オレンジ';
member.color_hex = '#fb8c00';
writeJson(oshiPath, oshi);
