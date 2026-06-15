import {
  fetchTakanenNewsScheduleRows,
  parseTakanenNewsPost,
} from "../scripts/takanenOfficialScheduleParse.mjs";

const rows = await fetchTakanenNewsScheduleRows(
  "https://takanenonadeshiko.jp",
  "2025-07",
  "2026-07",
);
console.log("news rows in range:", rows.length);
for (const r of rows.sort((a, b) => `${a.date}`.localeCompare(`${b.date}`))) {
  console.log(r.date, r.type, (r.venue ?? "-").slice(0, 30), r.event?.slice(0, 55));
}

const album = await (
  await fetch("https://takanenonadeshiko.jp/wp-json/wp/v2/posts/4419")
).json();
console.log("\nalbum post rows:", parseTakanenNewsPost(album).length);
