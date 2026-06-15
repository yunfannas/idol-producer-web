/**
 * Merge manual agent hints into poster OCR review JSON (maps auto_* → agent_* for summary).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const p = path.join(root, "support/docs/reference/timetree_poster_ocr/akishibu-poster-ocr-review.json");

/** @type {Record<string, { agent_suggested_venue: string | null, agent_confidence: string, agent_notes: string }>} */
const hints = {
  "2025-07-06|超natsuzome2025": {
    agent_suggested_venue: "幕張海浜公園 イベントブロック特設会場",
    agent_confidence: "high",
    agent_notes: "Outdoor @ Makuhari Seaside Park event block; OPEN 09:00 START 10:00",
  },
  "2025-07-07|単独定期-カラーチェンジ公演-": {
    agent_suggested_venue: "SHIBUYA DIVE",
    agent_confidence: "high",
    agent_notes: "OCR: 2025.07.07 @ SHIBUYA DIVE",
  },
  "2025-07-19|関ケ原歌姫合戦2025": {
    agent_suggested_venue: "桃配運動公園",
    agent_confidence: "high",
    agent_notes: "1673-11 Nogami, Sekigahara, Gifu; outdoor, capacity 1500",
  },
  "2025-07-27|heroines summer": {
    agent_suggested_venue: "東武動物公園 イベントステージ HOLA!",
    agent_confidence: "high",
    agent_notes: "東武動物公園 イベントステージ HOLA! capacity 1308; DAY1 7/26 DAY2 7/27 OPEN 10:00 START 11:00",
  },
  "2025-07-30|sweet summer 2025": {
    agent_suggested_venue: "渋谷（複数会場フェス）",
    agent_confidence: "high",
    agent_notes: "Circuit: WWW X, Veats SHIBUYA, SHIBUYA VIDENT",
  },
  "2025-08-03|tokyo idol festival": {
    agent_suggested_venue: "お台場臨海公園（TIF 複数ステージ）",
    agent_confidence: "medium",
    agent_notes: "Note: 浮き島ステージ, DOLL FACTORY; festival-wide",
  },
  "2025-09-07|平沢かえ生誕祭2025": {
    agent_suggested_venue: "SHIBUYA DIVE",
    agent_confidence: "high",
    agent_notes: "Birthday solo (生誕祭); poster 2025-09-07 @ SHIBUYA DIVE",
  },
  "2025-08-13|neo kassen 2025": {
    agent_suggested_venue: "渋谷（複数会場フェス）",
    agent_confidence: "high",
    agent_notes: "Festival across Shibuya halls (O-EAST, O-WEST, O-nest, O-Crest, clubasia, WOMB, etc.) — not a single venue",
  },
  "2025-08-17|idolead": {
    agent_suggested_venue: "白金高輪SELENE b2",
    agent_confidence: "high",
    agent_notes: "IDOLEAD 2025-08-17 @ 白金高輪SELENE b2 (not 2026 キネマ倶楽部 edition)",
  },
  "2025-08-31|単独公演-夏感謝祭sp-": {
    agent_suggested_venue: "SHIBUYA VIDENT",
    agent_confidence: "high",
    agent_notes: "OCR: @SHIBUYA VIDENT 2025-08-31 開場15:30",
  },
  "2025-10-11|kabukilling circuit!! 2025": {
    agent_suggested_venue: "KABUKICHO TOWER STAGE（他3ステージ併用）",
    agent_confidence: "high",
    agent_notes: "Note+OCR: KABUKICHO TOWER STAGE, JAM17, Zirco, 東急歌舞伎町タワー",
  },
  "2026-05-05|歌舞伎町up gate↑↑2026": {
    agent_suggested_venue: "新宿（複数会場フェス）",
    agent_confidence: "high",
    agent_notes: "Festival circuit: Zepp Shinjuku, APEXIA, 新宿LOFT, SHINJUKU WALLY, 新宿MARZ, Zirco TOKYO, etc.",
  },
};

const data = JSON.parse(fs.readFileSync(p, "utf8"));
for (const r of data.reviews) {
  const h = hints[r.match_key];
  if (h) Object.assign(r, h);
  else if (r.auto_venue && !r.agent_suggested_venue) {
    r.agent_suggested_venue = r.auto_venue;
    r.agent_confidence = r.auto_confidence ?? null;
    r.agent_notes = r.extracted?.catalog_venues?.length
      ? `Auto: catalog ${r.extracted.catalog_venues.map((v) => v.name).join(", ")}`
      : "";
  }
}
fs.writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);

let md = "# Akishibu poster OCR — review summary\n\n";
md += "Edit **`reviewer_venue`** in [`akishibu-poster-ocr-review.json`](./akishibu-poster-ocr-review.json). ";
md += "Full detail + images: [`akishibu-poster-ocr-review.md`](./akishibu-poster-ocr-review.md).\n\n";
md += "| Date | Event | Type | Auto / agent venue | Conf. | Catalog |\n";
md += "|------|-------|------|-------------------|-------|--------|\n";
for (const r of data.reviews) {
  const cats = r.extracted?.catalog_venues?.map((v) => v.name).join(", ") || "—";
  const esc = (s) => String(s ?? "—").replace(/\|/g, "\\|");
  const venue = r.agent_suggested_venue ?? r.auto_venue;
  const conf = r.agent_confidence ?? r.auto_confidence;
  md += `| ${esc(r.date)} | ${esc(r.event)} | ${esc(r.type)} | ${esc(venue)} | ${esc(conf)} | ${esc(cats)} |\n`;
}
fs.writeFileSync(path.join(root, "support/docs/reference/timetree_poster_ocr/akishibu-poster-ocr-SUMMARY.md"), md);
console.log("Updated", p);
