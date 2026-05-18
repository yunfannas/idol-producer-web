/**
 * Fixes the trailing catalog row for petit pas! (プティパ) in groups.json:
 * — final member order aligned to Jpop wiki (Kokoro, Nozomi, Suzu)
 * — member_uids parallel (only Hinata Suzu is in local idols.json)
 * — stray past_member_uids sentinel removed
 * — empty track_list on two singles filled with title + instrumental
 *
 * Run: node scripts/patchLastGroupPetitpas.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "public", "data", "groups.json");

const uid = "44OX44OG44Kj44OR";
const suzuUid = "6dcf364f-dbef-4ca9-8012-902b4ef3a6aa";

const j = JSON.parse(fs.readFileSync(p, "utf8"));
const i = j.findIndex((g) => g && g.uid === uid);
if (i < 0) {
  console.error("petit pas not found");
  process.exit(1);
}
if (i !== j.length - 1) {
  console.warn("Expected petit pas to be last index; got", i, "of", j.length);
}

const g = j[i];
g.member_names = ["篠崎こころ", "真中のぞみ", "日向すず"];
g.member_uids = ["", "", suzuUid];
g.member_count = 3;
g.past_member_uids = (g.past_member_uids || []).filter(Boolean);

for (const d of g.discography || []) {
  const t = String(d.title ?? "");
  if (t === "Re:START" && (!d.track_list || d.track_list.length === 0)) {
    d.track_list = ["Re:START", "Re:START -Instrumental-"];
  }
  if (t === "BORDER" && (!d.track_list || d.track_list.length === 0)) {
    d.track_list = ["BORDER", "BORDER -Instrumental-"];
  }
}

fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
console.log("patched", g.name, uid, "at index", i);
