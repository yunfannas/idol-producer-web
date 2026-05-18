/**
 * Surgical patch for Morning Musume catalog row in public/data/groups.json.
 * Run: node scripts/patchMorningMusumeCatalog.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, "..", "public", "data", "groups.json");

const uid = "44Oi44O844OL44Oz44Kw5aiY44CC";

const raw = fs.readFileSync(p, "utf8");
const j = JSON.parse(raw);
const g = j.find((x) => x && x.uid === uid);
if (!g) {
  console.error(`Group ${uid} not found`);
  process.exit(1);
}

Object.assign(g, {
  name: "モーニング娘。'25",
  formed_date: "1997-09-07",
  agencies: ["UP-FRONT PROMOTION"],
  union: "Hello! Project",
  notes:
    "Added from idolsdiagram.com popularity list on 2026-04-01 because popularity >= 10 or followers >= 2000. Hello! Project Wiki page confirmed on 2026-04-08. formed_date aligned to documented 1997-09-07 (ASAYAN finalist lineup). Union/agency filled for H!P context; roster and disc track tables still incomplete in this export.",
});

fs.writeFileSync(p, `${JSON.stringify(j, null, 2)}\n`, "utf8");
console.log("patched Morning Musume in", p);
