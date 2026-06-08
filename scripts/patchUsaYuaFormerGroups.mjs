import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

const files = [
  path.join(root, "public/data/idols.json"),
  path.join(root, "public/data/scenarios/scenario_6/idols.json"),
];

const USA_YUA_UID = "85dcb295-c757-4cb8-8b9e-f9b63bcfb518";
const NARUKAMI_UID = "6bO044Or56We";

const patchedHistory = [
  {
    group_name: "\u30c8\u30a6\u30ab\u30bb\u30a4\u30bb\u30a4",
    group_uid: null,
    start_date: "2021-09-01",
    end_date: "2022-01-31",
    member_color: null,
    member_color_code: null,
  },
  {
    group_name: "mistress",
    group_uid: null,
    start_date: "2022-12-01",
    end_date: "2024-09-30",
    member_color: null,
    member_color_code: null,
  },
  {
    group_name: "\u9cf4\u30eb\u795e",
    group_uid: NARUKAMI_UID,
    start_date: "2024-11-01",
    end_date: null,
    member_color: null,
    member_color_code: null,
  },
];

for (const file of files) {
  const idols = JSON.parse(fs.readFileSync(file, "utf8"));
  const idol = idols.find((entry) => entry.uid === USA_YUA_UID);

  if (!idol) {
    throw new Error(`Could not find Usa Yua in ${file}`);
  }

  idol.group_history = patchedHistory;

  fs.writeFileSync(file, `${JSON.stringify(idols, null, 2)}\n`, "utf8");
  console.log(`Patched ${path.relative(root, file)}`);
}
