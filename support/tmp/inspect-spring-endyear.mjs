async function lines(id) {
  const p = await (await fetch(`https://takanenonadeshiko.jp/wp-json/wp/v2/posts/${id}`)).json();
  console.log(`\n=== ${id}: ${p.title?.rendered?.replace(/<[^>]+>/g, "")} ===`);
  return p.content.rendered
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "\n")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
}

const spring = await lines(3375);
for (const l of spring.slice(0, 25)) console.log(l.slice(0, 160));

const ps = await (
  await fetch(
    "https://takanenonadeshiko.jp/wp-json/wp/v2/posts?search=" +
      encodeURIComponent("年末大感謝祭") +
      "&per_page=50&after=2025-10-01",
  )
).json();
console.log("\n== 年末 posts after Oct 2025 ==");
for (const p of ps) {
  const t = p.title.rendered.replace(/<[^>]+>/g, "");
  if (/2025/.test(t) && !/返金|Cute for life|2024/.test(t)) {
    console.log(p.id, p.date.slice(0, 10), t.slice(0, 100));
  }
}

// try find main endyear announcement
for (const id of [4789, 4700, 4650, 4600, 4550]) {
  try {
    const p = await (await fetch(`https://takanenonadeshiko.jp/wp-json/wp/v2/posts/${id}`)).json();
    if (p.code) continue;
    const t = p.title.rendered.replace(/<[^>]+>/g, "");
    if (/年末大感謝祭/.test(t)) console.log("found", id, t.slice(0, 90));
  } catch {}
}
