/**
 * Build Scenario 3 =LOVE Featured Trial micro-world under public/data/scenarios/scenario_3/.
 * Extracts historical members + Sashihara from scenario_6; generates the 103-person audition pool.
 *
 * Usage: node support/scripts/build-scenario3-equal-love-trial.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "../..");
const outDir = path.join(root, "public/data/scenarios/scenario_3");
const s6IdolsPath = path.join(root, "public/data/scenarios/scenario_6/idols.json");
const s6GroupsPath = path.join(root, "public/data/scenarios/scenario_6/groups.json");

const OPENING_DATE = "2017-04-03";
const POOL_SIZE = 103;

/** Historical =LOVE finalists — portrait type 1 (recognizable pre-debut identity). */
const HISTORICAL_FINALIST_NAMES = [
  "大谷映美里",
  "大場花菜",
  "長南舞",
  "齊藤なぎさ",
  "佐竹のん乃",
  "佐々木舞香",
  "髙松瞳",
  "瀧脇笙古",
  "諸橋沙夏",
  "山本杏奈",
  "野口衣織",
  "音嶋莉沙",
  "齋藤樹愛羅",
];

/** Additional real historical audition-related people — portrait type 2 (sourced in historical_candidates_research.json). */
const ADDITIONAL_REAL_CANDIDATE_NAMES = [
  "蒼乃爽",
];

const SASHIHARA_NAME = "指原莉乃";
const EQUAL_LOVE_GROUP_UID = "PUxPVkU";

function stableHash01(seed) {
  const hex = createHash("sha256").update(seed).digest("hex").slice(0, 8);
  return parseInt(hex, 16) / 0xffffffff;
}

function pick(seed, rows) {
  return rows[Math.floor(stableHash01(seed) * rows.length) % rows.length];
}

function ageOn(isoBirthday, refDate) {
  if (!isoBirthday || !/^\d{4}-\d{2}-\d{2}$/.test(isoBirthday)) return 18;
  const [y] = isoBirthday.split("-").map(Number);
  const refY = Number(refDate.slice(0, 4));
  return Math.max(14, Math.min(28, refY - y));
}

function slimIdol(row, extras = {}) {
  const copy = JSON.parse(JSON.stringify(row));
  delete copy.scandal_history;
  delete copy.status_history;
  return { ...copy, ...extras };
}

function makeGeneratedCandidate(index, refDate) {
  const familyNames = ["佐藤", "鈴木", "高橋", "田中", "伊藤", "渡辺", "山本", "中村", "小林", "加藤", "吉田", "山田"];
  const givenNames = ["美咲", "結衣", "陽菜", "凛", "彩花", "真央", "優奈", "さくら", "愛莉", "七海", "琴音", "遥"];
  const seed = `s3-gen|${index}`;
  const family = pick(`${seed}|f`, familyNames);
  const given = pick(`${seed}|g`, givenNames);
  const name = `${family}${given}`;
  const uid = createHash("sha256").update(`s3-candidate|${index}|${name}`).digest("hex").slice(0, 8) +
    "-" +
    createHash("md5").update(`s3|${index}`).digest("hex").slice(0, 27);
  const month = String(1 + Math.floor(stableHash01(`${seed}|m`) * 12)).padStart(2, "0");
  const day = String(1 + Math.floor(stableHash01(`${seed}|d`) * 28)).padStart(2, "0");
  const birthYear = 1995 + Math.floor(stableHash01(`${seed}|y`) * 8);
  const birthday = `${birthYear}-${month}-${day}`;
  const height = 150 + Math.floor(stableHash01(`${seed}|h`) * 18);
  return {
    uid,
    name,
    romaji: "",
    birthday,
    height,
    birthplace: pick(`${seed}|bp`, ["東京", "大阪", "愛知", "福岡", "北海道", "宮城", "広島"]),
    audition_candidate: true,
    portrait_type: "generated",
    s3_pool_index: index,
    fan_count: 0,
    x_followers: Math.floor(stableHash01(`${seed}|x`) * 800),
    popularity: 0,
    group_history: [],
    age_at_reference: ageOn(birthday, refDate),
  };
}

function main() {
  const s6Idols = JSON.parse(fs.readFileSync(s6IdolsPath, "utf8"));
  const s6Groups = JSON.parse(fs.readFileSync(s6GroupsPath, "utf8"));
  const byName = new Map();
  for (const row of s6Idols) {
    const n = String(row.name ?? "").trim();
    if (n && !byName.has(n)) byName.set(n, row);
  }

  const sashihara = byName.get(SASHIHARA_NAME);
  if (!sashihara) throw new Error(`Missing ${SASHIHARA_NAME} in scenario_6 idols`);

  const candidates = [];
  const usedNames = new Set();

  for (const name of HISTORICAL_FINALIST_NAMES) {
    const row = byName.get(name);
    if (!row) {
      console.warn(`WARN: missing historical finalist ${name}`);
      continue;
    }
    candidates.push(
      slimIdol(row, {
        audition_candidate: true,
        portrait_type: "type1",
        historical_equal_love: true,
        s3_pool_index: candidates.length,
        age_at_reference: ageOn(String(row.birthday ?? ""), OPENING_DATE),
      }),
    );
    usedNames.add(name);
  }

  for (const name of ADDITIONAL_REAL_CANDIDATE_NAMES) {
    const row = byName.get(name);
    if (row) {
      candidates.push(
        slimIdol(row, {
          audition_candidate: true,
          portrait_type: "type2",
          historical_related: true,
          s3_pool_index: candidates.length,
          age_at_reference: ageOn(String(row.birthday ?? ""), OPENING_DATE),
        }),
      );
      usedNames.add(name);
    } else {
      const gen = makeGeneratedCandidate(candidates.length, OPENING_DATE);
      gen.name = name;
      gen.portrait_type = "type2";
      gen.historical_related = true;
      candidates.push(gen);
      usedNames.add(name);
    }
  }

  let genIdx = 0;
  while (candidates.length < POOL_SIZE) {
    const gen = makeGeneratedCandidate(candidates.length, OPENING_DATE);
    if (usedNames.has(gen.name)) {
      genIdx += 1;
      gen.name = `${gen.name}${genIdx}`;
    }
    usedNames.add(gen.name);
    candidates.push(gen);
  }

  const player = slimIdol(sashihara, {
    player_character: true,
    historical_dual_role: true,
    audition_candidate: false,
    age_at_reference: ageOn(String(sashihara.birthday ?? ""), OPENING_DATE),
  });

  const idols = [player, ...candidates];

  const eqLoveS6 = s6Groups.find((g) => String(g.uid ?? "") === EQUAL_LOVE_GROUP_UID || g.name === "=LOVE");
  if (!eqLoveS6) throw new Error("=LOVE group missing in scenario_6");

  const equalLoveProject = {
    uid: EQUAL_LOVE_GROUP_UID,
    name: "=LOVE",
    name_romanji: "=LOVE",
    nickname: "イコラブ",
    nickname_romanji: "Ikorabu",
    letter_tier: "B",
    formed_date: null,
    debut_date: "2017-08-05",
    member_count: 0,
    member_uids: [],
    member_names: [],
    producer: SASHIHARA_NAME,
    producer_uid: player.uid,
    agency: "代々木アニメーション学院",
    project_status: "audition",
    popularity: 0,
    fans: 0,
    x_followers: 0,
    song_uids: [],
    description:
      "Voice actress / idol project produced by 指原莉乃. Final audition camp begins April 2017; TIF debut target August 2017.",
  };

  const contextGroups = [
    {
      uid: "SEtUNDg",
      name: "HKT48",
      name_romanji: "HKT48",
      letter_tier: "S",
      formed_date: "2011-01-01",
      member_count: 0,
      member_uids: [],
      context_only: true,
      popularity: 85,
      fans: 500000,
    },
    {
      uid: "QUtCNDg",
      name: "AKB48",
      name_romanji: "AKB48",
      letter_tier: "S",
      formed_date: "2005-01-01",
      member_count: 0,
      member_uids: [],
      context_only: true,
      popularity: 95,
      fans: 2000000,
    },
    equalLoveProject,
  ];

  const songs = [
    {
      uid: "s3-tif-01",
      title: "言い訳Maybe",
      title_romanji: "Iiwake Maybe",
      group_uid: EQUAL_LOVE_GROUP_UID,
      cover_of: "AKB48",
      rehearsal_priority: "tif_debut",
    },
    {
      uid: "s3-tif-02",
      title: "メロンジュース",
      title_romanji: "Melon Juice",
      group_uid: EQUAL_LOVE_GROUP_UID,
      cover_of: "HKT48",
      rehearsal_priority: "tif_debut",
    },
    {
      uid: "s3-tif-03",
      title: "ガールズルール",
      title_romanji: "Girls Rule",
      group_uid: EQUAL_LOVE_GROUP_UID,
      cover_of: "Nogizaka46",
      rehearsal_priority: "tif_debut",
    },
    {
      uid: "s3-tif-04",
      title: "大声ダイヤモンド",
      title_romanji: "Ogoe Diamond",
      group_uid: EQUAL_LOVE_GROUP_UID,
      cover_of: "AKB48",
      rehearsal_priority: "tif_debut",
    },
    {
      uid: "s3-tif-05",
      title: "=LOVE",
      title_romanji: "=LOVE",
      group_uid: EQUAL_LOVE_GROUP_UID,
      rehearsal_priority: "tif_debut",
      original: true,
    },
  ];

  const futureEvents = [
    {
      uid: "s3-2017-04-07-hkt-live",
      event_type: "s3_calendar_anchor",
      effective_date: "2017-04-07",
      title: "HKT48 Spring Kanto Tour — Matsudo",
      body: "Your first live tutorial: five-song HKT48 set. Use Highlight mode to see how stage presence and fatigue read on stage.",
      category: "s3_tutorial",
      blocking: false,
    },
    {
      uid: "s3-2017-04-10-camp-w1",
      event_type: "s3_calendar_anchor",
      effective_date: "2017-04-10",
      title: "Audition Camp — Week 1 begins",
      body: "103 candidates enter vocal, dance, and cooperation trials. Staff will send daily summaries — you cannot observe every room personally.",
      category: "s3_audition",
      blocking: false,
    },
    {
      uid: "s3-2017-04-15-first-cut",
      event_type: "s3_first_cut_gate",
      effective_date: "2017-04-15",
      title: "End of Camp Week 1 — First cut",
      body: "Decide how many candidates remain. Staff recommend keeping 20–30, but the number is your call.",
      category: "s3_audition",
      blocking: true,
      requires_confirmation: true,
    },
    {
      uid: "s3-2017-04-29-selection",
      event_type: "s3_final_selection_gate",
      effective_date: "2017-04-29",
      title: "Final selection & =LOVE announcement",
      body: "Select roughly 11–14 members for the provisional =LOVE roster and announce the project.",
      category: "s3_audition",
      blocking: true,
      requires_confirmation: true,
    },
    {
      uid: "s3-2017-08-05-tif",
      event_type: "s3_tif_debut",
      effective_date: "2017-08-05",
      title: "TIF 2017 — =LOVE live debut",
      body: "Five-song set: 言い訳Maybe · メロンジュース · ガールズルール · 大声ダイヤモンド · =LOVE",
      category: "s3_debut",
      blocking: true,
      requires_confirmation: true,
    },
  ];

  const agencyMandate = {
    agency_partner: "代々木アニメーション学院",
    producer: SASHIHARA_NAME,
    project_type: "voice actress / idol project",
    target_roster: 13,
    recommended_range: [11, 14],
    live_debut_window: "summer 2017",
    commercial_debut_plan: "autumn 2017",
    core_direction: "mainstream idol + voice acting / 2D crossover",
    market_positioning: "nationwide / major-backed",
    training_priorities: ["vocal", "dance", "communication", "stage readiness"],
    budget_level: "above ordinary chika-idol startup",
    risk_tolerance: "medium",
  };

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, "idols.json"), JSON.stringify(idols, null, 2));
  fs.writeFileSync(path.join(outDir, "groups.json"), JSON.stringify(contextGroups, null, 2));
  fs.writeFileSync(path.join(outDir, "songs.json"), JSON.stringify(songs, null, 2));
  fs.writeFileSync(path.join(outDir, "future_events.json"), JSON.stringify(futureEvents, null, 2));
  fs.writeFileSync(path.join(outDir, "agency_mandate.json"), JSON.stringify(agencyMandate, null, 2));

  const meta = {
    generated_at: new Date().toISOString(),
    opening_date: OPENING_DATE,
    pool_size: POOL_SIZE,
    historical_finalists: HISTORICAL_FINALIST_NAMES.length,
    player_uid: player.uid,
    equal_love_group_uid: EQUAL_LOVE_GROUP_UID,
  };
  fs.writeFileSync(path.join(outDir, "meta.json"), JSON.stringify(meta, null, 2));

  console.log(`Wrote scenario_3: ${idols.length} idols (${candidates.length} candidates + player), ${contextGroups.length} groups`);
}

main();
