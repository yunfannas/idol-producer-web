import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { isCommercialPromoEvent, isVirtualLiveEvent } from "./timetreeEventParse.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const dataRoot = path.join(repoRoot, "public", "data");
const groupsPath = path.join(dataRoot, "groups.json");
const rawRoot = path.join(dataRoot, "timetree");
const officialRoot = path.join(dataRoot, "official_schedules");
const outputRoot = path.join(dataRoot, "managed-live-schedules");
const outputGroupsRoot = path.join(outputRoot, "groups");

const TEMPLATE_DEFAULTS = {
  type_1: { live_type: "Concert", event_type: "Concert", start_time: "18:00", duration_minutes: 150, tokutenkai_enabled: false, tokutenkai_duration_minutes: 0 },
  type_2: { live_type: "Roaming", event_type: "Concert", start_time: "18:00", duration_minutes: 130, tokutenkai_enabled: false, tokutenkai_duration_minutes: 0 },
  type_3: { live_type: "Festival", event_type: "Festival", start_time: "12:00", duration_minutes: 30, tokutenkai_enabled: false, tokutenkai_duration_minutes: 0 },
  type_4: { live_type: "Taiban", event_type: "Taiban", start_time: "18:30", duration_minutes: 30, tokutenkai_enabled: true, tokutenkai_duration_minutes: 60 },
  type_5: { live_type: "Joint", event_type: "Joint", start_time: "18:00", duration_minutes: 45, tokutenkai_enabled: true, tokutenkai_duration_minutes: 60 },
  type_6: { live_type: "OneMan", event_type: "Concert", start_time: "18:00", duration_minutes: 95, tokutenkai_enabled: true, tokutenkai_duration_minutes: 90 },
  type_7: { live_type: "Routine", event_type: "Routine", start_time: "19:00", duration_minutes: 80, tokutenkai_enabled: true, tokutenkai_duration_minutes: 75 },
  type_8: { live_type: "Tokutenkai", event_type: "Tokutenkai", start_time: "14:00", duration_minutes: 90, tokutenkai_enabled: true, tokutenkai_duration_minutes: 90 },
};

const SOURCE_CONFIGS = [
  {
    sourceKey: "adamlilith",
    label: "AdamLilith TimeTree",
    rawFile: "adamlilith-2025-07-2026-07.json",
    groupUid: "QWRhbUxpbGl0aA",
    aliases: ["AdamLilith", "adamlilith", "アダムス", "Adamth"],
  },
  {
    sourceKey: "akishibu-project",
    label: "Akishibu TimeTree",
    rawFile: "akishibu-2025-07-2026-07.json",
    groupUid: "44Ki44Kt44K344OWcHJvamVjdA",
    aliases: ["Akishibu project", "アキシブproject", "akishibu"],
  },
  {
    sourceKey: "dress-code",
    label: "Dress Code TimeTree",
    rawFile: "dresscode-2025-07-2026-07.json",
    groupUid: "d231b9f2-f247-4cf5-8d57-35365fd73f16",
    aliases: ["ãƒ‰ãƒ¬ã‚¹ã‚³ãƒ¼ãƒ‰", "Dress Code", "Dress_Code", "dresscode", "ãƒ‰ãƒ¬ã‚³", "Dreco"],
  },
  {
    sourceKey: "ilife",
    label: "iLiFE! TimeTree",
    rawFile: "ilife_official-2025-07-2026-07.json",
    groupUid: "aUxpRkUh",
    aliases: ["iLiFE!", "ilife", "i life"],
  },
  {
    sourceKey: "ion",
    label: "iON! TimeTree",
    rawFile: "ion_heroines-2025-07-2026-07.json",
    groupUid: "d698eb6b-e82f-48f1-a2df-6cf858315ad4",
    aliases: ["iON!", "ion", "iON", "ã‚ã„ãŠã‚“"],
  },
  {
    sourceKey: "i-col",
    label: "i-COL TimeTree",
    rawFile: "i_col-2025-07-2026-07.json",
    groupUid: "aS1DT0w",
    aliases: ["i-COL", "I-COL", "icol", "i_col"],
  },
  {
    sourceKey: "last-scene",
    label: "LAST SCENE TimeTree",
    rawFile: "lastscene_official-2025-07-2026-07.json",
    groupUid: "44Op44K544OI44K344O844Oz",
    aliases: ["ãƒ©ã‚¹ãƒˆã‚·ãƒ¼ãƒ³", "LAST SCENE", "LAST_SCENE_(HEROINES)", "lastscene"],
  },
  {
    sourceKey: "megafon",
    label: "MEGAFON TimeTree",
    rawFile: "megafon_official-2025-07-2026-07.json",
    groupUid: "TUVHQUZPTg",
    aliases: ["MEGAFON", "megafon"],
  },
  {
    sourceKey: "nanakorobi-yaoki",
    label: "Nanakorobi Yaoki TimeTree",
    rawFile: "nanakoro78-2025-07-2026-07.json",
    groupUid: "055cd81a-8c78-44ad-b74b-3f45fc551f9b",
    aliases: ["ãƒŠãƒŠã‚³ãƒ­ãƒ“ãƒ¤ã‚ªã‚­", "Nanakorobi Yaoki", "Nanakorobi_Yaoki", "ãƒŠãƒŠã‚³ãƒ­", "Nanakoro", "nanakoro78"],
  },
  {
    sourceKey: "non-fiction",
    label: "Non-Fiction TimeTree",
    rawFile: "nonfic_official-2025-07-2026-07.json",
    groupUid: "44Gu44KT44G144GD44GP77yB",
    aliases: ["ã®ã‚“ãµãƒãï¼", "Non¬Fiction", "Non-Fiction", "NONFICTION", "nonfic"],
  },
  {
    sourceKey: "ponkotsu-konpo",
    label: "Ponkotsu Konpo TimeTree",
    rawFile: "ponkotsukonpo_official-2025-07-2026-07.json",
    groupUid: "44Od44Oz44Kz44OE44Kz44Oz44Od",
    aliases: ["ãƒãƒ³ã‚³ãƒ„ã‚³ãƒ³ãƒ", "Ponkotsu Konpo", "Ponkotsu_Konpo", "ponkotsukonpo"],
  },
  {
    sourceKey: "takanenonadeshiko",
    label: "Takane no Nadeshiko Official Schedule",
    rawFile: "takanenonadeshiko-2025-07-2026-07.json",
    rawDir: "official_schedules",
    groupUid: "6auY5ba644Gu44Gq44Gn44GX44GT",
    aliases: ["高嶺のなでしこ", "Takane no Nadeshiko", "Takane_no_Nadeshiko", "takaneko"],
  },
  {
    sourceKey: "tenrin",
    label: "TENRIN TimeTree",
    rawFile: "tenrin_schedule-2025-07-2026-07.json",
    groupUid: "VEVOUklO",
    aliases: ["TENRIN", "tenrin"],
  },
  {
    sourceKey: "tenshinranman",
    label: "Tenshinranman TimeTree",
    rawFile: "tenshinranman-2025-07-2026-07.json",
    groupUid: "44OG44Oz44K344Oz44Op44Oz44Oe44Oz",
    aliases: ["ãƒ†ãƒ³ã‚·ãƒ³ãƒ©ãƒ³ãƒžãƒ³", "Tenshinranman", "ãƒ†ãƒ³ãƒ©ãƒ³", "Tenran", "tenshinranman"],
  },
  {
    sourceKey: "yakousei-amuse",
    label: "Yakousei Amuse TimeTree",
    rawFile: "yoruami-2025-07-2026-07.json",
    groupUid: "5aSc5YWJ5oCn44Ki44Of44Ol44O844K6",
    aliases: ["å¤œå…‰æ€§ã‚¢ãƒŸãƒ¥ãƒ¼ã‚º", "Yakousei Amuse", "Yakousei_Amuse", "ã‚ˆã‚‹ã‚ã¿", "Yoruami", "yoruami"],
  },
  {
    sourceKey: "zuttomotto",
    label: "ZUTTOMOTTO TimeTree",
    rawFile: "zuttomoofficial-2025-07-2026-07.json",
    groupUid: "WlVUVE9NT1RUTw",
    aliases: ["ZUTTOMOTTO", "ãšã£ã¨ã‚‚", "Zuttomo", "zuttomoofficial"],
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function padTime(value) {
  const text = String(value ?? "").trim();
  const m = /^(\d{1,2}):(\d{2})$/.exec(text);
  if (!m) return "";
  return `${m[1].padStart(2, "0")}:${m[2]}`;
}

function addMinutesToHHMM(hhmm, minutes) {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
  if (!m) return hhmm;
  const total = Number(m[1]) * 60 + Number(m[2]) + minutes;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mins = String(wrapped % 60).padStart(2, "0");
  return `${hours}:${mins}`;
}

function firstMatch(text, patterns) {
  for (const pattern of patterns) {
    const match = pattern.exec(text);
    if (match) return match;
  }
  return null;
}

function parseTimeRange(note, kind) {
  const text = String(note ?? "");
  const patterns =
    kind === "tokutenkai"
      ? [
          /特典会[：:\s]*([0-2]?\d:\d{2})\s*-\s*([0-2]?\d:\d{2})/i,
          /物販[：:\s]*([0-2]?\d:\d{2})\s*-\s*([0-2]?\d:\d{2})/i,
        ]
      : [
          /LIVE[：:\s]*([0-2]?\d:\d{2})\s*-\s*([0-2]?\d:\d{2})/i,
          /出演時間[^\d]*([0-2]?\d:\d{2})\s*-\s*([0-2]?\d:\d{2})/i,
          /ライブ[：:\s]*([0-2]?\d:\d{2})\s*-\s*([0-2]?\d:\d{2})/i,
        ];
  const match = firstMatch(text, patterns);
  if (!match) return null;
  const start = padTime(match[1]);
  const end = padTime(match[2]);
  return start && end ? { start, end } : null;
}

function parseStartTime(note) {
  const text = String(note ?? "");
  const match = firstMatch(text, [
    /開演時刻\s*([0-2]?\d:\d{2})/i,
    /開演[：:\s]*([0-2]?\d:\d{2})/i,
    /START[：:\s]*([0-2]?\d:\d{2})/i,
  ]);
  return match ? padTime(match[1]) : "";
}

function inferTemplateKey(row) {
  const rawType = String(row.event_type ?? row.type ?? "").trim();
  const title = String(row.event ?? "").trim();
  if (rawType === "Festival") return "type_3";
  if (/ハニフェス|FES\b|Festival/i.test(title)) return "type_3";
  if (/2[-\s]?man|3[-\s]?man|4[-\s]?man|2man|3man|4man|joint/i.test(title)) return "type_5";
  if (/単独|定期|ワンマン|one[- ]?man/i.test(title)) return "type_6";
  if (rawType === "Taiban") return "type_4";
  if (rawType === "Birthday") return "type_8";
  if (rawType === "Concert") return "type_6";
  return "type_4";
}

function shouldKeepRawEvent(row) {
  const rawType = String(row.type ?? row.event_type ?? "").trim();
  const title = String(row.event ?? "").trim();
  const note = String(row.note ?? "");
  if (
    rawType === "Cancelled" ||
    rawType === "Media" ||
    rawType === "Meet" ||
    rawType === "Virtual" ||
    rawType === "Promo" ||
    rawType === "TvShow" ||
    rawType === "OfflineEvent" ||
    rawType === "GuestLive" ||
    rawType === "Birthday"
  )
    return false;
  if (isVirtualLiveEvent(row) || isCommercialPromoEvent(row)) return false;
  if (/ファンミーティング|ファンミ\b/i.test(title)) return false;
  if (/【TV】|テレビ|TV|ラジオ|Radio|配信|Streaming/i.test(title)) return false;
  if (rawType === "Concert" || rawType === "Festival" || rawType === "Taiban" || rawType === "Tokutenkai") return true;
  if (rawType !== "Other") return false;
  if (parseTimeRange(note, "live") || parseStartTime(note)) return true;
  if (/LIVE|特典会|単独|定期|ワンマン|対バン|festival|fes/i.test(`${title}\n${note}`)) return true;
  return Boolean(String(row.venue_uid ?? row.venue ?? row.location_name ?? "").trim());
}

function toManagedEvent(sourceKey, row) {
  const date = String(row.date ?? "").split("T")[0];
  const title = String(row.event ?? row.event_raw ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !title) return null;
  if (!shouldKeepRawEvent(row)) return null;
  const template_key = inferTemplateKey(row);
  const defaults = TEMPLATE_DEFAULTS[template_key];
  const liveWindow = parseTimeRange(row.note, "live");
  const tokutenkaiWindow = parseTimeRange(row.note, "tokutenkai");
  const startTime = liveWindow?.start || padTime(row.start_time) || parseStartTime(row.note) || defaults.start_time;
  const endTime = liveWindow?.end || addMinutesToHHMM(startTime, defaults.duration_minutes);
  const tokutenkai_enabled = Boolean(tokutenkaiWindow || defaults.tokutenkai_enabled);
  const venue = String(row.venue ?? row.location_name ?? "").trim();
  return {
    uid: `managed-${sourceKey}-${String(row.timetree_id ?? `${date}-${title}`)}`,
    source_event_id: String(row.timetree_id ?? ""),
    date,
    title,
    template_key,
    event_type: defaults.event_type,
    live_type: defaults.live_type,
    raw_type: String(row.type ?? row.event_type ?? "").trim(),
    venue,
    venue_uid: String(row.venue_uid ?? "").trim(),
    start_time: startTime,
    end_time: endTime,
    tokutenkai_enabled,
    tokutenkai_start: tokutenkai_enabled ? tokutenkaiWindow?.start || endTime : "",
    tokutenkai_end: tokutenkai_enabled
      ? tokutenkaiWindow?.end || addMinutesToHHMM(endTime, defaults.tokutenkai_duration_minutes)
      : "",
    poster_image_path: Array.isArray(row.poster_urls) ? String(row.poster_urls[0] ?? "") : "",
    source_url: String(row.timetree_url ?? "").trim(),
  };
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function main() {
  const groups = readJson(groupsPath);
  ensureDir(outputGroupsRoot);
  const sources = [];
  for (const config of SOURCE_CONFIGS) {
    const group = groups.find((row) => String(row.uid ?? "").trim() === config.groupUid);
    if (!group) {
      throw new Error(`Managed live schedule source ${config.sourceKey} could not find group ${config.groupUid} in groups.json`);
    }
    const inputRoot = config.rawDir === "official_schedules" ? officialRoot : rawRoot;
    const raw = readJson(path.join(inputRoot, config.rawFile));
    const rawEvents = Array.isArray(raw.events) ? raw.events : [];
    const events = rawEvents.map((row) => toManagedEvent(config.sourceKey, row)).filter(Boolean);
    const sortedEvents = events.sort((a, b) => {
      const da = `${a.date} ${a.start_time}`;
      const db = `${b.date} ${b.start_time}`;
      return da.localeCompare(db);
    });
    if (!sortedEvents.length) {
      console.warn(`Skipping managed live schedule source ${config.sourceKey} because it produced 0 events.`);
      continue;
    }
    const file = `groups/${config.sourceKey}.json`;
    writeJson(path.join(outputRoot, file), {
      source_key: config.sourceKey,
      label: config.label,
      event_count: sortedEvents.length,
      events: sortedEvents,
    });
    sources.push({
      source_key: config.sourceKey,
      label: config.label,
      group_uid: String(group.uid ?? ""),
      group_name: String(group.name ?? ""),
      group_name_romanji: String(group.name_romanji ?? ""),
      aliases: Array.from(
        new Set(
          [
            ...config.aliases,
            String(group.name ?? ""),
            String(group.name_romanji ?? ""),
            String(group.nickname ?? ""),
            String(group.nickname_romanji ?? ""),
          ].filter(Boolean),
        ),
      ),
      raw_file: `${config.rawDir === "official_schedules" ? "official_schedules" : "timetree"}/${config.rawFile}`,
      file,
      event_count: sortedEvents.length,
      date_start: sortedEvents[0]?.date ?? "",
      date_end: sortedEvents[sortedEvents.length - 1]?.date ?? "",
    });
  }
  writeJson(path.join(outputRoot, "manifest.json"), {
    generated_at: new Date().toISOString(),
    sources,
  });
  console.log(`Built managed live schedule database for ${sources.length} source(s).`);
}

main();
