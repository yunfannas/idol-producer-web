async function fullDump(id, max = 60) {
  const p = await (await fetch(`https://takanenonadeshiko.jp/wp-json/wp/v2/posts/${id}`)).json();
  console.log(`\n=== ${id}: ${p.title?.rendered?.replace(/<[^>]+>/g, "")} ===`);
  const lines = p.content.rendered
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  for (const l of lines.slice(0, max)) console.log(l.slice(0, 160));
}

await fullDump(4257, 80);

const ps = await (
  await fetch(
    "https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=" +
      encodeURIComponent("東名阪ツアー") +
      "&per_page=20",
  )
).json();
console.log("\n== 東名阪 ==");
for (const p of ps) {
  console.log(p.id, p.date.slice(0, 10), p.title.rendered.replace(/<[^>]+>/g, "").slice(0, 90));
}

const ps2 = await (
  await fetch(
    "https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=" +
      encodeURIComponent("年末大感謝祭") +
      "&per_page=30",
  )
).json();
console.log("\n== 年末 ==");
for (const p of ps2) {
  const t = p.title.rendered.replace(/<[^>]+>/g, "");
  if (/2025/.test(t) && !/2024|Cute for life/.test(t)) {
    console.log(p.id, p.date.slice(0, 10), t.slice(0, 95));
  }
}
