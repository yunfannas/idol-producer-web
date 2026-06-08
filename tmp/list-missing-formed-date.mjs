import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const groups = JSON.parse(fs.readFileSync(path.join(root, "public/data/groups.json"), "utf8"));
const missing = groups.filter((g) => g.formed_date == null || g.formed_date === "");

function esc(s) {
  return `"${String(s ?? "").replace(/"/g, '""')}"`;
}

const lines = ["group_uid,group_name,name_romanji"];
for (const g of missing) {
  lines.push([g.uid, esc(g.name), esc(g.name_romanji ?? "")].join(","));
}

const out = path.join(root, "docs/reference/groups_missing_formed_date.csv");
fs.writeFileSync(out, `${lines.join("\n")}\n`, "utf8");
console.error(`Total groups: ${groups.length}`);
console.error(`Missing formed_date: ${missing.length}`);
console.error(`Wrote ${out}`);
