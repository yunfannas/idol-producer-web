const queries = [
  "Bouquet",
  "ブーケ",
  "たかねこフェスVol.5",
  "年末大感謝祭2025",
  "SEOUL",
  "ソウルワンマン",
  "3rd ANNIVERSARY",
  "幕張",
  "ツアー 公演",
  "公演日程",
];

for (const s of queries) {
  const url = `https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=${encodeURIComponent(s)}&per_page=15&after=2024-01-01T00:00:00`;
  const ps = await (await fetch(url)).json();
  console.log(`\n== ${s} == (${Array.isArray(ps) ? ps.length : ps.message})`);
  if (!Array.isArray(ps)) continue;
  for (const p of ps.slice(0, 6)) {
    console.log(
      p.date?.slice(0, 10),
      p.title?.rendered?.replace(/<[^>]+>/g, "").slice(0, 95),
    );
  }
}
