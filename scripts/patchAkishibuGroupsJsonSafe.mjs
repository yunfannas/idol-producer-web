/**
 * Surgical edits to アキシブproject in public/data/groups.json only.
 * Writes to a temp file, validates JSON, then replaces — avoids truncation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const target = path.join(root, "public/data/groups.json");
const tmp = `${target}.tmp`;

let src = fs.readFileSync(target, "utf8");
const before = JSON.parse(src);
const beforeLen = before.length;

const nl = /\r\n/.test(src) ? "\r\n" : "\n";

const orphanLine = `${nl}      "26b1f47c-a535-422b-bf98-1bc3134242ec",`;
if (src.includes(orphanLine)) {
  src = src.replace(orphanLine, "");
} else if (src.includes("26b1f47c-a535-422b-bf98-1bc3134242ec")) {
  console.warn("orphan uid present but line pattern did not match — skipped");
}

const trackOld = `${nl}          "Creaction (2019 ver.)",${nl}          "WHITE (LIVE ver.)",${nl}          "真夏のセレナーデ (LIVE ver.)",`;
const trackNew = `${nl}          "Creaction",${nl}          "WHITE",${nl}          "真夏のセレナーデ",`;
if (src.includes(trackOld)) {
  src = src.replace(trackOld, trackNew);
}

const after = JSON.parse(src);
if (after.length !== beforeLen) {
  throw new Error(`group count changed ${beforeLen} -> ${after.length}`);
}

const g = after.find((row) => row.name === "アキシブproject");
if (!g) throw new Error("アキシブproject row missing");
if (g.song_uids.includes("26b1f47c-a535-422b-bf98-1bc3134242ec")) {
  throw new Error("orphan song_uid still on group row");
}
const best = g.discography?.find((d) => d.title === "AKISHIBU THE BEST");
if (!best?.track_list?.includes("WHITE") || best.track_list.includes("WHITE (LIVE ver.)")) {
  throw new Error("AKISHIBU THE BEST track_list not updated as expected");
}

fs.writeFileSync(tmp, src, "utf8");
JSON.parse(fs.readFileSync(tmp, "utf8"));
fs.renameSync(tmp, target);

console.log(`groups.json OK · ${after.length} groups · アキシブ song_uids ${g.song_uids.length}`);
