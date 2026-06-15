const res = await fetch("https://takanenonadeshiko.jp/wp-json/wp/v2/types", {
  headers: { "user-agent": "Mozilla/5.0" },
});
const types = await res.json();
for (const [k, v] of Object.entries(types)) {
  if (/event|live|schedule/i.test(k) || /event|live|スケ/i.test(String(v.name))) {
    console.log(k, v.slug, v.rest_base, v.has_archive);
  }
}
console.log("keys", Object.keys(types));

// category pagination
for (const cat of ["live", "media", "birthday", "other"]) {
  const url = `https://takanenonadeshiko.jp/events/category/${cat}/page/2/`;
  const r = await fetch(url, { headers: { "user-agent": "Mozilla/5.0" } });
  const html = await r.text();
  const links = [...new Set([...html.matchAll(/href=\"(https:\/\/takanenonadeshiko\.jp\/events\/event\/[^\"]+)\"/g)].map((m) => m[1]))];
  console.log(cat, "page2", r.status, links.length, links.slice(0, 3));
}

// news posts search
const news = await fetch("https://takanenonadeshiko.jp/wp-json/wp/v2/posts?per_page=100&page=1&after=2025-06-01T00:00:00", {
  headers: { "user-agent": "Mozilla/5.0" },
});
console.log("posts", news.status, (await news.json()).length);
