/**
 * Builds public/data/reference/budokan_idols_note_shin.json from the note.com list
 * (female idol / related acts at 日本武道館, 2000+).
 * Source: https://note.com/super_iguana4872/n/nf233431b536c
 *
 * Run: node scripts/build_budokan_note_reference.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const ARTICLE_EXCERPT = `
## 2000年

05/20, 21 **モーニング娘。** ※21日 2公演  
08/21 **鈴木あみ**

## 2005年

04/01 **ZONE**  
05/06, 07 モーニング娘。 ※7日 2公演  
09/24, 25 モーニング娘。 ※25日 2公演

## 2006年

10/28 モーニング娘。 ※2公演

## 2008年

11/06, 07 **Perfume**

## 2009年

08/22, 23 **AKB48G**（AKB48/SKE48/SDN48） ※23日 2公演

## 2010年

09/21 AKB48G ※じゃんけん大会

## 2011年

06/09 AKB48G ※選抜総選挙  
09/20 AKB48G ※じゃんけん大会  
09/29, 30 モーニング娘。

## 2012年

03/10 ドリームモーニング娘。（ｹﾞｽﾄ: ﾓｰﾆﾝｸﾞ娘。） ※OGﾒﾝﾊﾞｰｸﾞﾙｰﾌﾟ  
03/28 **SCANDAL**  
05/08, 09, 11, 12 Perfume  
05/18 モーニング娘。  
09/18 AKB48G ※じゃんけん大会  
10/05 **ももいろクローバーZ** ※女性限定LIVE  
11/05 ももいろクローバーZ ※男性限定LIVE  
11/06 **きゃりーぱみゅぱみゅ**  
12/22 **東京女子流** ※当時ﾒﾝﾊﾞｰ平均年齢15歳と、武道館 史上最年少

## 2013年

04/25 **SKE48**  
04/26 **NMB48**  
04/27 **HKT48** ※ﾒｼﾞｬｰﾃﾞﾋﾞｭｰから39日で武道館 史上最速  
04/27 AKB48  
04/28 AKB48G（AKB48/SKE48/NMB48/HKT48/JKT48） ※2公演  
05/21 モーニング娘。  
06/11 **SUPER☆GiRLS**（ｹﾞｽﾄ: Cheeky Parade/O.A: GEM/ﾊﾞｯｸﾀﾞﾝｻｰ: iDOL Street）  
09/09, 10 **℃-ute**（O.A: Juice=Juice/ﾊﾞｯｸﾀﾞﾝｻｰ: ﾊﾛﾌﾟﾛ研修生）  
09/13 ももいろクローバーZ ※DVD鑑賞会  
09/18 AKB48G ※じゃんけん大会  
11/28 モーニング娘。  
11/29 **Berryz工房**（ｹﾞｽﾄ: ℃-ute/ﾊﾞｯｸﾀﾞﾝｻｰ: ﾊﾛﾌﾟﾛ研修生）  
12/20 **乃木坂46**  
12/22 東京女子流

## 2014年

03/01, 02 **BABYMETAL** ※当時ﾒﾝﾊﾞｰ平均年齢14.7歳と、最年少記録 更新  
04/15 **私立恵比寿中学**  
05/06 **でんぱ組.inc**  
07/15 **スマイレージ**  
07/24, 25 **E-girls**  
08/21 **9nine**  
08/28 **チームしゃちほこ**  
09/10 ℃-ute（ｹﾞｽﾄ: Berryz工房/ﾊﾞｯｸﾀﾞﾝｻｰ: ﾊﾛﾌﾟﾛ研修生）  
09/11 Berryz工房（ｹﾞｽﾄ: ℃-ute/ﾊﾞｯｸﾀﾞﾝｻｰ: ﾊﾛﾌﾟﾛ研修生）  
09/30, 10/01 モーニング娘。'14  
11/07 ネルフェス ※ﾈﾙｹﾌﾟﾗﾝﾆﾝｸﾞ主催ﾌｪｽ/乃木坂46 出演  
11/11 ℃-ute  
12/18 **ベイビーレイズ**

## 2015年

01/17 **Silent Siren**  
02/25, 26 NMB48  
03/03 Berryz工房  
05/26 **アンジュルム(ex. スマイレージ)**  
05/27 モーニング娘。'15  
08/20 EXIT TUNE ACADEMY（歌い手, 踊り手, ﾎﾞｶﾛP 総勢45組） ※音楽ﾚｰﾍﾞﾙ EXIT TUNE主催  
09/04, 05 **初音ミク**（巡音ルカ, 鏡音リン・レン）  
09/22, 23 Perfume ※22日 主催ﾌｪｽ/23日 ﾀﾞﾝｽｺﾝﾃｽﾄ  
10/05 **アイドリング!!!**  
10/31 日テレHALLOWEEN LIVE ※日ﾃﾚ主催ﾌｪｽ 2公演/きゃりーぱみゅぱみゅ, 乃木坂46, AKB48 出演  
11/11 ℃-ute  
11/29 アンジュルム  
12/07, 08 モーニング娘。'15  
12/17, 18 乃木坂46 ※ｱﾝﾀﾞｰﾒﾝﾊﾞｰ21名  
12/20, 21 乃木坂46

## 2016年

01/12, 13 SCANDAL  
01/25 Gum Rock Fes. ※ﾛｯｸﾌｪｽ/乃木坂46, HKT48, ｻｲｻｲ 出演  
02/13 ももいろクローバーZ（O.A: Mr.ﾏﾘｯｸ）  
05/30 アンジュルム（O.A: こぶしﾌｧｸﾄﾘｰ, つばきﾌｧｸﾄﾘｰ）  
05/31 モーニング娘。'16（O.A: 同上）  
06/20 ℃-ute  
07/29 FULL CHORUS ※ｽｶﾊﾟｰ!主催ﾌｪｽ/ｱﾝｼﾞｭﾙﾑ, ｻｲｻｲ 出演  
08/19 きゃりーぱみゅぱみゅ  
08/25 **Buono!**  
08/31 チームしゃちほこ  
09/05 ℃-ute  
11/07 **Juice=Juice**  
11/08 **アップアップガールズ（仮）**（O.A: ｱｲﾄﾞﾙﾈｯｻﾝｽ）  
11/25 **i☆Ris**  
12/06-10 乃木坂46 ※6, 8日 選抜/7, 9日 ｱﾝﾀﾞｰ単独/10日 3期生お見立て会  
12/12 モーニング娘。'16

## 2017年

01/20 でんぱ組.inc  
02/10 **ClariS**  
05/06 アイドル博 ※ｻﾝｸﾚｲﾄﾞ主催 大規模特典会  
05/15 アンジュルム  
05/26 モーニング娘。'17（O.A: つばきﾌｧｸﾄﾘｰ）  
06/23 モーニング娘。'17（O.A: OCHA NORMA）  
07/28 スカパー！サマーフェス ※ｱﾝｼﾞｭﾙﾑ, こぶしﾌｧｸﾄﾘｰ, NGT48, AKB48 Team8 出演  
10/20 **有安杏果（ももいろクローバーZ）**  
10/21, 22 ももいろクローバーZ ※21日 2公演（FC学生限定/FC40歳以上限定）/22日 1公演  
11/13 SILENT SIREN  
11/20 Juice=Juice（O.A: つばきﾌｧｸﾄﾘｰ）  
11/21 モーニング娘。'17  
12/11 モーニング娘。'17（ｹﾞｽﾄ: 辻希美, 高橋愛, 道重さゆみ, 田中れいな）

## 2018年

01/03, 04 私立恵比寿中学  
01/30-02/01 ~~欅坂46~~ \\[振替\\]→**けやき坂46**  
03/16 CHiCO with HoneyWorks  
04/22 乃木坂46  
05/28 アンジュルム（O.A: こぶしﾌｧｸﾄﾘｰ, つばきﾌｧｸﾄﾘｰ）  
06/19, 20 モーニング娘。'18（O.A: \\[19日\\] こぶしﾌｧｸﾄﾘｰ/\\[20日\\] つばきﾌｧｸﾄﾘｰ）  
07/09 **鈴木愛理(ex. ℃-ute)**  
08/13 アイドル博  
09/15 **NGT48** ※CDﾘﾘｰｽ記念ｲﾍﾞﾝﾄ  
09/24 **まねきケチャ**  
10/29 Juice=Juice  
12/03, 04 乃木坂46 ※3日 4期生お見立て会  
12/10 欅坂46/けやき坂46 ※欅坂46 2期生＆けやき坂46 3期生お見立て会  
12/11-13 けやき坂46  
12/15, 16 モーニング娘。'18

## 2019年

01/06, 07 でんぱ組.inc  
05/09-11 **欅坂46**  
06/04, 05 モーニング娘。'19（ｹﾞｽﾄ: BEYOOOOONDS）  
06/17 Juice=Juice  
06/18 アンジュルム

## 2020年

10/12 Hello! Project（ﾓｰﾆﾝｸﾞ娘。'20/ｱﾝｼﾞｭﾙﾑ/Juice=Juice/つばきﾌｧｸﾄﾘｰ/BEYOOOOONDS）  
11/30 アンジュルム（O.A: ﾊﾛﾌﾟﾛ研修生'22）  
12/02 Hello! Project（ﾓｰﾆﾝｸﾞ娘。'20/ｱﾝｼﾞｭﾙﾑ/Juice=Juice/つばきﾌｧｸﾄﾘｰ/BEYOOOOONDS/ﾊﾛﾌﾟﾛ研修生）  
12/09 アンジュルム  
12/10 Juice=Juice  
12/14 **眉村ちあき**  
12/18-20 乃木坂46

## 2021年

01/10 **CY8ER**  
01/15 **STU48**  
01/16, 17 **＝LOVE**  
02/08 **ZOC**  
02/13 **PEDRO**  
10/13 鈴木愛理(ex. ℃-ute)（O.A: 小片リサ(ex. つばきﾌｧｸﾄﾘｰ)）  
10/18 **つばきファクトリー**（O.A: BEYOOOOONDS, ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ）  
11/15 アンジュルム（O.A: BEYOOOOONDS, ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ）  
11/17 AYAKARNIVAL ※佐々木彩夏主催ｱｲﾄﾞﾙﾌｪｽ  
12/09, 10 **櫻坂46(ex. 欅坂46)**  
12/13 モーニング娘。'21（O.A: BEYOOOOONDS, ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ）  
12/31 第5回 ももいろ歌合戦 ※ももｸﾛ主催ﾌｪｽ

## 2022年

02/17 **PassCode**  
03/30 **神使轟く、激情の如く。**  
04/16, 17 **虹のコンキスタドール**  
04/25 **BEYOOOOONDS**  
05/15 ももいろクローバーZ  
05/16 つばきファクトリー  
06/15 アンジュルム（O.A: OCHA NORMA）  
06/20 モーニング娘。'22（O.A: OCHA NORMA）  
08/24 花譜（VTuber）  
09/14 **26時のマスカレイド**  
10/07-09 AKB48  
10/19 きゃりーぱみゅぱみゅ  
11/29 ~~Juice=Juice~~  
11/30 アンジュルム（O.A: ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ'22）  
12/08, 09 櫻坂46  
12/10 モーニング娘。'22（O.A: OCHA NORMA）  
12/31 第6回 ももいろ歌合戦

## 2023年

02/28 Juice=Juice（O.A: OCHA NORMA）  
03/02 ＝LOVE  
03/15 **ぜんぶ君のせいだ。**  
03/30 **クマリデパート**  
05/13 **ExWHYZ(ex. EMPiRE)**  
05/15 BEYOOOOONDS（O.A: OCHA NORMA）  
05/29 Juice=Juice（O.A: OCHA NORMA）  
06/26 モーニング娘。'23（O.A: OCHA NORMA）  
06/29, 30 **≠ME**  
10/20-22 AKB48  
11/06 つばきファクトリー（O.A: OCHA NORMA）  
11/24 アンジュルム  
11/26, 27 PEDRO  
12/06 Juice=Juice

## 2024年

01/04 **ネコプラpixx.**  
01/04 **STAiNY**  
01/04 アナフェス武道館 \\[2部制\\] ※FreeK主催の対バン  
03/12 **chuLa**  
03/14 **#ババババンビ**  
03/31 ミクフェス（初音ミク, 巡音ルカ, 鏡音リン・レン, MEIKO, KAITO）  
05/18, 19 **FRUITS ZIPPER**  
05/27 モーニング娘。'24（O.A: ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ'24）  
06/10 つばきファクトリー（O.A: ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ'24）  
06/14 Juice=Juice（O.A: ﾊﾛﾌﾟﾛ研修生ﾕﾆｯﾄ'24）  
08/16 ~~Appare!~~ ※台風7号接近による影響の為、中止  
08/27-29 **日向坂46 四期生**  
09/11 **アイナ・ジ・エンド(ex. BiSH)**  
10/08 **ASP**  
10/15 **MARUKADO** ※洗足学園音楽大学の現役学生10人組ｸﾞﾙｰﾌﾟ  
11/01 **ファントムシータ**  
11/12 **Jams Collection**  
11/18 BEYOOOOONDS  
11/19 Juice=Juice（ﾊﾞｯｸﾀﾞﾝｻｰ: ﾛｰｼﾞｰｸﾛﾆｸﾙ）  
11/28 アンジュルム（O.A: ﾛｰｼﾞｰｸﾛﾆｸﾙ）  
12/31 第8回 ももいろ歌合戦 ～愛の大晦日～

## 2025年

01/29 **Appare!**  
02/01 **星街すいせい（VTuber）**  
03/31 **にっぽんワチャチャ**  
04/30 つばきファクトリー（O.A: ﾛｰｼﾞｰｸﾛﾆｸﾙ）  
05/06 玉井詩織(ももいろクローバーZ)  
06/09 BEYOOOOONDS  
06/23 Juice=Juice  
07/08 モーニング娘。'25  
07/09 **いぎなり東北産**  
08/27 **iLiFE!**  
09/03 **ano**  
10/15 **OCHA NORMA**（O.A: ﾛｰｼﾞｰｸﾛﾆｸﾙ）  
11/22, 23 NiziU  
12/04-07 AKB48  
12/19-21 乃木坂46  
12/31 第9回 ももいろ歌合戦  
12/31, 01/01 ももいろクローバーZ

## 2026年

02/24 天下一武道館（主催: 神田みつき(㈱ﾙﾐﾅｽ)/令和の虎）  
03/13 **≒JOY**  
06/05, 06 **CANDY TUNE**  
06/24 モーニング娘。'26（牧野真莉愛 卒コン）  
07/14 **山本彩(ex. NMB48)**  
08/20 **平手友梨奈(ex. 欅坂46)**  
08/25, 26 **CUTIE STREET**
`;

function parseYears(text) {
  const blocks = text.split(/\n##\s*(\d{4})年\n/);
  const out = [];
  for (let i = 1; i < blocks.length; i += 2) {
    const year = blocks[i];
    const body = blocks[i + 1] ?? "";
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    out.push({ year: Number(year), lines });
  }
  return out;
}

/** Leading date token(s) on a note line, before title / ** / ~ / 日テレ… */
function extractDateSpec(line) {
  const s = line.trimStart();
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[\d/, \-]/.test(c)) {
      i++;
      continue;
    }
    if (c === "~" || c === "*") break;
    break;
  }
  return s.slice(0, i).trim();
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

function isoFromYmd(y, m, d) {
  return `${y}-${pad2(m)}-${pad2(d)}`;
}

function daysInMonth(y, m) {
  return new Date(y, m, 0).getDate();
}

/**
 * Expand note date header to ISO dates (anchor = 年 section).
 * Handles: 05/20, 21 · 09/30, 10/01 · 12/04-07 · 01/30-02/01 · 12/31, 01/01
 */
function expandDateSpecToIso(dateSpec, anchorYear) {
  if (!dateSpec) return [];
  const pieces = dateSpec.split(",").map((p) => p.trim()).filter(Boolean);
  /** @type {string[]} */
  const out = [];
  let lastFull = null;

  const pushYmd = (y, m, d) => {
    if (m < 1 || m > 12 || d < 1 || d > daysInMonth(y, m)) return;
    const iso = isoFromYmd(y, m, d);
    if (out[out.length - 1] !== iso) out.push(iso);
  };

  for (const p of pieces) {
    const cross = /^(\d{1,2})\/(\d{1,2})-(\d{1,2})\/(\d{1,2})$/.exec(p);
    if (cross) {
      const m1 = +cross[1];
      const d1 = +cross[2];
      const m2 = +cross[3];
      const d2 = +cross[4];
      const y0 = anchorYear;
      const start = new Date(y0, m1 - 1, d1);
      const end = new Date(y0, m2 - 1, d2);
      if (end < start) end.setFullYear(y0 + 1);
      const endT = end.getTime();
      for (let cur = start.getTime(); cur <= endT; cur += 864e5) {
        const dt = new Date(cur);
        pushYmd(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
      }
      lastFull = { m: m2, d: d2 };
      continue;
    }

    const rangeSame = /^(\d{1,2})\/(\d{1,2})-(\d{1,2})$/.exec(p);
    if (rangeSame) {
      const month = +rangeSame[1];
      const d1 = +rangeSame[2];
      const d2 = +rangeSame[3];
      let y = anchorYear;
      if (lastFull && month < lastFull.m && lastFull.m >= 11) y = anchorYear + 1;
      for (let d = d1; d <= d2; d++) pushYmd(y, month, d);
      lastFull = { m: month, d: d2 };
      continue;
    }

    const single = /^(\d{1,2})\/(\d{1,2})$/.exec(p);
    if (single) {
      let m = +single[1];
      const d = +single[2];
      let y = anchorYear;
      if (lastFull && m === 1 && lastFull.m === 12) y = anchorYear + 1;
      pushYmd(y, m, d);
      lastFull = { m, d };
      continue;
    }

    const dayOnly = /^(\d{1,2})$/.exec(p);
    if (dayOnly && lastFull) {
      const d = +dayOnly[1];
      pushYmd(anchorYear, lastFull.m, d);
      lastFull = { m: lastFull.m, d };
      continue;
    }
  }
  return [...new Set(out)];
}

function enrichScheduleLines(scheduleByYear) {
  return scheduleByYear.map(({ year, lines }) => ({
    year,
    entries: lines.map((line) => {
      const dates_note = extractDateSpec(line);
      const dates_iso = expandDateSpecToIso(dates_note, year);
      return { line, dates_note: dates_note || null, dates_iso };
    }),
  }));
}

function lineMatchesName(line, name_note, stem) {
  const plain = line.replace(/\*\*/g, "");
  return plain.includes(name_note) || (stem.length >= 2 && plain.includes(stem));
}

function appearancesForPrincipal(scheduleByYear, name_note) {
  const stem = name_note.replace(/\([^)]*\)/g, "").replace(/（[^）]*）/g, "").trim();
  /** @type {Array<{ calendar_year: number; dates_note: string | null; dates_iso: string[]; line: string }>} */
  const appearances = [];
  for (const { year, entries } of scheduleByYear) {
    for (const ent of entries) {
      if (!lineMatchesName(ent.line, name_note, stem)) continue;
      appearances.push({
        calendar_year: year,
        dates_note: ent.dates_note,
        dates_iso: ent.dates_iso,
        line: ent.line.replace(/\*\*/g, "").trim(),
      });
    }
  }
  return appearances;
}

function extractBoldNames(text) {
  const set = new Set();
  for (const m of text.matchAll(/\*\*([^*]+)\*\*/g)) {
    const n = m[1].replace(/\\+/g, "").trim();
    if (n) set.add(n);
  }
  return [...set];
}

/** Extra principals that appear without ** in the excerpt (solo / units / labels). */
const MANUAL_NAMES = [
  "モーニング娘。", // legacy line variations
  "ドリームモーニング娘。",
  "AKB48G",
  "AKB48",
  "Perfume",
  "でんぱ組.inc",
  "東京女子流",
  "℃-ute",
  "Berryz工房",
  "ももいろクローバーZ",
  "乃木坂46",
  "チームしゃちほこ",
  "アンジュルム",
  "Juice=Juice",
  "Silent Siren",
  "きゃりーぱみゅぱみゅ",
  "CHiCO with HoneyWorks",
  "Hello! Project",
  "欅坂46",
  "けやき坂46",
  "櫻坂46",
  "つばきファクトリー",
  "花譜（VTuber）",
  "PEDRO",
  "NMB48",
  "SKE48",
  "HKT48",
  "NGT48",
  "日向坂46",
  "日向坂46 四期生",
  "NiziU",
  "玉井詩織(ももいろクローバーZ)",
  "アナフェス武道館",
  "第5回 ももいろ歌合戦",
  "第6回 ももいろ歌合戦",
  "第8回 ももいろ歌合戦 ～愛の大晦日～",
  "第9回 ももいろ歌合戦",
  "ミクフェス（初音ミク, 巡音ルカ, 鏡音リン・レン, MEIKO, KAITO）",
  "ネルフェス",
  "日テレHALLOWEEN LIVE",
  "EXIT TUNE ACADEMY",
  "Gum Rock Fes.",
  "FULL CHORUS",
  "アイドル博",
  "スカパー！サマーフェス",
  "AYAKARNIVAL",
  "天下一武道館（主催: 神田みつき(㈱ﾙﾐﾅｽ)/令和の虎）",
];

/** Map note primary name → catalog name in groups.json (exact) */
const NAME_ALIASES_TO_CATALOG = {
  "＝LOVE": "=LOVE",
  "≠ME": "≠ME",
  "#ババババンビ": "#ババババンビ",
  "神使轟く、激情の如く。": "神使轟く、激情の如く。",
  "アイナ・ジ・エンド(ex. BiSH)": "アイナ・ジ・エンド",
  "櫻坂46(ex. 欅坂46)": "櫻坂46",
  "ExWHYZ(ex. EMPiRE)": "ExWHYZ",
  "山本彩(ex. NMB48)": "山本彩",
  "平手友梨奈(ex. 欅坂46)": "平手友梨奈",
  "鈴木愛理(ex. ℃-ute)": "鈴木愛理",
  "有安杏果（ももいろクローバーZ）": "有安杏果",
  "星街すいせい（VTuber）": "星街すいせい",
  "アンジュルム(ex. スマイレージ)": "アンジュルム",
  "日向坂46 四期生": "日向坂46",
  "Appare!": "Appare!",
};

function uniq(arr) {
  return [...new Set(arr)];
}

function main() {
  const scheduleByYearRaw = parseYears(ARTICLE_EXCERPT);
  const scheduleByYear = enrichScheduleLines(scheduleByYearRaw);
  const bold = extractBoldNames(ARTICLE_EXCERPT);
  const principals = uniq([...bold, ...MANUAL_NAMES]).sort((a, b) => a.localeCompare(b, "ja"));

  const groupsPath = path.join(root, "public", "data", "groups.json");
  const groups = JSON.parse(fs.readFileSync(groupsPath, "utf8"));
  /** @type {Map<string, { uid: string; name: string }>} */
  const byExact = new Map();
  for (const g of groups) {
    const n = String(g.name ?? "").trim();
    if (n && !byExact.has(n)) byExact.set(n, { uid: g.uid, name: g.name });
  }

  /** @type {Array<Record<string, unknown>>} */
  const entities = principals.map((name_note) => {
    const catalogTry = NAME_ALIASES_TO_CATALOG[name_note];
    let lookupName = catalogTry !== undefined ? catalogTry : name_note.replace(/^[〜～]/, "").trim();
    if (lookupName === null) lookupName = "";
    let group_uid = null;
    let group_name_catalog = null;
    if (lookupName && typeof lookupName === "string") {
      const hit = byExact.get(lookupName);
      if (hit) {
        group_uid = hit.uid;
        group_name_catalog = hit.name;
      }
    }
    const appearances = appearancesForPrincipal(scheduleByYear, name_note);
    const yearsWithMention = uniq(appearances.map((a) => a.calendar_year));
    return {
      name_note_article: name_note,
      entity_kind_hint: /\([eE][xX]\.|（[eE][xX]・|Vtuber|VTuber/.test(name_note)
        ? "solo_or_named_unit"
        : /フェス|Fes|フェスティバル|歌合戦|対バン|博|ハロウィン|武道館（主催/.test(name_note)
          ? "event_or_series"
          : "group_or_principal",
      years_mentioned: yearsWithMention,
      appearances,
      group_uid,
      group_name_catalog,
      catalogue_match_method: group_uid ? "exact_name_public_data_groups_json" : "none",
    };
  });

  const deduped = entities.filter((e) => (e.appearances && e.appearances.length > 0) || e.group_uid);

  const out = {
    schema_version: 2,
    venue: "日本武道館",
    source: {
      title: "【女性アイドル】日本武道館 公演【2000年以降】",
      url: "https://note.com/super_iguana4872/n/nf233431b536c",
      author_note: "shin",
      published_note: "2024-10-17",
      disclaimer_ja:
        "コミュニティまとめ記事。出演・日付は原文に依存。dates_iso は行頭の MM/DD 表記から機械展開した推定値（年は見出しの年を基準／年跨ぎは 12/31, 01/01 等で補正）。誤読があり得ます。group_uid は public/data/groups.json の name 完全一致でのみ付与。",
    },
    generated_at: new Date().toISOString(),
    schedule_by_year: scheduleByYear,
    entities: deduped.sort((a, b) =>
      String(a.name_note_article).localeCompare(String(b.name_note_article), "ja"),
    ),
    stats: {
      entity_rows: deduped.length,
      with_group_uid: deduped.filter((e) => e.group_uid).length,
    },
  };

  const outDir = path.join(root, "public", "data", "reference");
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, "budokan_idols_note_shin.json");
  fs.writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`, "utf8");
  console.error(`Wrote ${outPath}`);
  console.error(`Entities: ${out.stats.entity_rows}, linked uid: ${out.stats.with_group_uid}`);
}

main();
