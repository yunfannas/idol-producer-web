const base = "https://takanenonadeshiko.jp";
const cats = ["live", "media", "birthday", "other", "release"];

async function crawlCategory(slug) {
  const urls = new Set();
  for (let page = 1; page <= 20; page++) {
    const path = page === 1 ? `/events/category/${slug}/` : `/events/category/${slug}/page/${page}/`;
    const res = await fetch(`${base}${path}`, { headers: { "user-agent": "Mozilla/5.0" } });
    if (!res.ok) break;
    const html = await res.text();
    const found = [...html.matchAll(/href=\"(https:\/\/takanenonadeshiko\.jp\/events\/event\/[^\"#?]+)/g)].map((m) => m[1]);
    if (!found.length) break;
    const before = urls.size;
    for (const u of found) urls.add(u);
    if (urls.size === before) break;
    await new Promise((r) => setTimeout(r, 200));
  }
  return [...urls];
}

async function crawlNewsEventLinks() {
  const urls = new Set();
  for (let page = 1; page <= 10; page++) {
    const res = await fetch(`${base}/wp-json/wp/v2/posts?per_page=100&page=${page}&after=2025-06-01T00:00:00&orderby=date&order=desc`, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!res.ok) break;
    const posts = await res.json();
    if (!Array.isArray(posts) || !posts.length) break;
    for (const p of posts) {
      const link = String(p.link ?? "");
      const content = String(p.content?.rendered ?? p.excerpt?.rendered ?? "");
      const title = String(p.title?.rendered ?? "");
      const blob = `${title}\n${content}`;
      for (const m of blob.matchAll(/https:\/\/takanenonadeshiko\.jp\/events\/event\/[^"'<\s]+/g)) urls.add(m[0].replace(/\/$/, "/"));
      for (const m of blob.matchAll(/\/events\/event\/[^\"'<\s]+/g)) urls.add(`${base}${m[0].startsWith("/") ? "" : "/"}${m[0]}`);
      if (/出演決定|スケジュール|ライブ|フェス|公演/.test(blob) && link) {
        // keep news without event link for manual review
      }
    }
    if (posts.length < 100) break;
  }
  return [...urls];
}

const all = new Set();
for (const cat of cats) {
  const u = await crawlCategory(cat);
  console.log(cat, u.length);
  u.forEach((x) => all.add(x));
}
const news = await crawlNewsEventLinks();
console.log("news links", news.length);
news.forEach((x) => all.add(x));

console.log("total unique", all.size);
for (const u of [...all].sort()) console.log(u);
