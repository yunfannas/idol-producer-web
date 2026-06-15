/**
 * One-off: merge legacy 2-column CSV into 4-column venues_capacity.csv
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { guessCity, guessSetting } from "./venues_capacity_csv.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const src = path.join(root, "support/docs/reference/venues_capacity.csv");

const text = fs.readFileSync(src, "utf8").replace(/^\uFEFF/, "");
const lines = text.trim().split(/\r?\n/);

const overrides = new Map([
  ["白金高輪SELENE b2", { capacity: 700, setting: "indoor", city: "Tokyo" }],
  ["桃配運動公園", { capacity: 1500, setting: "outdoor", city: "Gifu" }],
]);

/** @type {Map<string, { name: string, capacity: number | "", setting: string, city: string }>} */
const out = new Map();

for (let i = 1; i < lines.length; i++) {
  const parts = lines[i].split(",");
  const name = parts[0]?.trim();
  if (!name) continue;
  let canonical = name;
  if (/白金高輪/.test(name) && /SELENE/i.test(name)) canonical = "白金高輪SELENE b2";

  const capRaw = parts[1]?.trim() ?? "";
  const o = overrides.get(canonical) ?? {};
  const cap = o.capacity ?? (capRaw ? Number(capRaw) : "");
  const setting = o.setting ?? guessSetting(canonical);
  const city = o.city ?? guessCity(canonical);
  out.set(canonical, { name: canonical, capacity: cap, setting, city });
}

if (!out.has("桃配運動公園")) {
  out.set("桃配運動公園", { name: "桃配運動公園", capacity: 1500, setting: "outdoor", city: "Gifu" });
}

const esc = (v) => {
  const s = String(v ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

const rows = [...out.values()].sort((a, b) => a.name.localeCompare(b.name, "ja"));
let csv = "name,capacity,setting,city\r\n";
for (const r of rows) {
  csv += `${esc(r.name)},${esc(r.capacity)},${esc(r.setting)},${esc(r.city)}\r\n`;
}
fs.writeFileSync(src, `\uFEFF${csv}`);
console.log(`Wrote ${rows.length} rows to ${src}`);
