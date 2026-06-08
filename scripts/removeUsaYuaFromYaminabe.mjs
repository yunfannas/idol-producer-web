/**
 * Remove the unverified / incorrect YAMINABE membership for 卯莎ゆあ
 * from both the main database and the Scenario 6 snapshot.
 *
 * Verified sources:
 * - Usa Yua page lists Narukami, Toukaseisei, mistress
 * - YAMINABE (HEROINES) page lists Aisu, Colne, Amane Yua, Kurosaki Real
 *
 * Run:
 *   node scripts/removeUsaYuaFromYaminabe.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const USA_YUA_UID = "85dcb295-c757-4cb8-8b9e-f9b63bcfb518";
const YAMINABE_UID = "WUFNSU5BQkU";
const YAMINABE_NAME = "YAMINABE";

const targets = [
  {
    idolsPath: path.join(root, "public", "data", "idols.json"),
    groupsPath: path.join(root, "public", "data", "groups.json"),
    label: "main",
  },
  {
    idolsPath: path.join(root, "public", "data", "scenarios", "scenario_6", "idols.json"),
    groupsPath: path.join(root, "public", "data", "scenarios", "scenario_6", "groups.json"),
    label: "scenario6",
  },
];

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function removeYaminabeHistory(idol) {
  const hist = Array.isArray(idol.group_history) ? idol.group_history : [];
  const before = hist.length;
  idol.group_history = hist.filter((entry) => {
    const uid = typeof entry?.group_uid === "string" ? entry.group_uid.trim() : "";
    const name = typeof entry?.group_name === "string" ? entry.group_name.trim() : "";
    return uid !== YAMINABE_UID && name !== YAMINABE_NAME;
  });
  return before - idol.group_history.length;
}

function removeMemberFromGroup(group, uid) {
  const memberUids = Array.isArray(group.member_uids) ? group.member_uids.map(String) : [];
  const memberNames = Array.isArray(group.member_names) ? group.member_names.map(String) : [];
  const pairs = memberUids.map((memberUid, i) => ({ uid: memberUid, name: memberNames[i] ?? "" }));
  const kept = pairs.filter((row) => row.uid !== uid);
  group.member_uids = kept.map((row) => row.uid);
  group.member_names = kept.map((row) => row.name);
  group.member_count = kept.length;
}

for (const target of targets) {
  const idols = JSON.parse(fs.readFileSync(target.idolsPath, "utf8"));
  const groups = JSON.parse(fs.readFileSync(target.groupsPath, "utf8"));
  const idol = idols.find((row) => String(row.uid ?? "") === USA_YUA_UID);
  const group = groups.find((row) => String(row.uid ?? "") === YAMINABE_UID);
  if (!idol) throw new Error(`[${target.label}] missing 卯莎ゆあ idol row`);
  if (!group) throw new Error(`[${target.label}] missing YAMINABE group row`);
  const removedHistory = removeYaminabeHistory(idol);
  removeMemberFromGroup(group, USA_YUA_UID);
  writeJson(target.idolsPath, idols);
  writeJson(target.groupsPath, groups);
  console.log(
    JSON.stringify(
      {
        target: target.label,
        removed_history_rows: removedHistory,
        yaminabe_member_count: group.member_count,
        yaminabe_member_names: group.member_names,
      },
      null,
      2,
    ),
  );
}
