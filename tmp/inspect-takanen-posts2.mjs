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
  for (const l of lines.slice(0, 35)) console.log(l.slice(0, 160));
}

for (const id of [4158, 4094, 3905, 3924]) await dump(id);

const ps = await (
  await fetch(
    "https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=" +
      encodeURIComponent("Live Tour -Bouquet") +
      "&per_page=50",
  )
).json();
console.log("\n=== Bouquet posts ===");
for (const p of ps) {
  const t = p.title.rendered.replace(/<[^>]+>/g, "");
  if (/決定|スケジュール|公演|開催/.test(t) && !/くじ|スタンプ|引換|詳細|記念|撮影|サイン|当日|更新|申請/.test(t)) {
    console.log(p.id, p.date.slice(0, 10), t.slice(0, 100));
  }
}

const ps2 = await (
  await fetch(
    "https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=" +
      encodeURIComponent("年末大感謝祭 2025") +
      "&per_page=20",
  )
).json();
console.log("\n=== End year ===");
for (const p of ps2.slice(0, 8)) console.log(p.id, p.date.slice(0, 10), p.title.rendered.replace(/<[^>]+>/g, "").slice(0, 100));
