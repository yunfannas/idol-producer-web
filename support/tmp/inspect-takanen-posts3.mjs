async function dump(id) {
  const p = await (await fetch(`https://takanenonadeshiko.jp/wp-json/wp/v2/posts/${id}`)).json();
  console.log(`\n=== ${id}: ${p.title?.rendered?.replace(/<[^>]+>/g, "")} ===`);
  const lines = p.content.rendered
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of lines) {
    if (/\d{4}年|\d{1,2}月\d{1,2}日|日付|日程|会場|公演/.test(l)) console.log(" ", l.slice(0, 140));
  }
}

await dump(4257);

const searches = ["年末大感謝祭 2025", "東名阪ツアー 2025", "Spring Ride", "LIVE TOUR 2026", "Bouquet of 9 Flowers –"];
for (const q of searches) {
  const ps = await (
    await fetch(
      `https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=${encodeURIComponent(q)}&per_page=15`,
    )
  ).json();
  console.log(`\n== search: ${q} ==`);
  for (const p of ps.slice(0, 8)) {
    const t = p.title.rendered.replace(/<[^>]+>/g, "");
    if (!/詳細|当日|返金|くじ|スタンプ|引換|更新|申請|キャンペーン|記念.*撮影|記念.*サイン/.test(t)) {
      console.log(p.id, p.date.slice(0, 10), t.slice(0, 95));
    }
  }
}
