import { parseTakanenEventPageHtml } from "../scripts/takanenOfficialScheduleParse.mjs";

const startYm = "2025-07";
const endYm = "2026-07";

function inRange(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date ?? ""))) return false;
  const d = String(date).slice(0, 7);
  return d >= startYm && d <= endYm;
}

// all event URLs: sitemap + category page 1-2 for live
const bases = new Set();
for (const src of [
  "https://takanenonadeshiko.jp/wp-sitemap-posts-event-1.xml",
]) {
  const xml = await (await fetch(src)).text();
  for (const m of xml.matchAll(/<loc>([^<]+)<\/loc>/g)) {
    if (/\/events\/event\//.test(m[1])) bases.add(m[1]);
  }
}
for (let p = 1; p <= 3; p++) {
  const url = p === 1 ? "https://takanenonadeshiko.jp/events/category/live/" : `https://takanenonadeshiko.jp/events/category/live/page/${p}/`;
  const html = await (await fetch(url)).text();
  for (const m of html.matchAll(/href=\"(https:\/\/takanenonadeshiko\.jp\/events\/event\/[^\"]+)/g)) bases.add(m[1]);
}

const urls = [...new Set([...bases].map((u) => u.split("#")[0]))];
console.log("urls", urls.length);

const byDate = [];
for (const url of urls) {
  await new Promise((r) => setTimeout(r, 150));
  const html = await (await fetch(url)).text();
  const row = parseTakanenEventPageHtml(html, url);
  if (row.date && inRange(row.date)) byDate.push(row);
}
byDate.sort((a, b) => `${a.date}\t${a.event}`.localeCompare(`${b.date}\t${b.event}`));
console.log("in range", byDate.length);
for (const r of byDate) console.log(r.date, r.type, r.event.slice(0, 60));

// news posts Jul 2025 - Jul 2026
console.log("\n--- NEWS posts (出演/ライブ/フェス) ---");
let newsHits = 0;
for (let page = 1; page <= 15; page++) {
  const res = await fetch(`https://takanenonadeshiko.jp/wp-json/wp/v2/posts?per_page=100&page=${page}&after=2025-06-15T00:00:00&before=2026-08-01T00:00:00&orderby=date&order=desc`);
  const posts = await res.json();
  if (!Array.isArray(posts) || !posts.length) break;
  for (const p of posts) {
    const title = String(p.title?.rendered ?? "").replace(/<[^>]+>/g, "");
    const date = String(p.date ?? "").slice(0, 10);
    const content = String(p.content?.rendered ?? "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 200);
    if (/出演|ライブ|フェス|公演|ツアー|RELEASE|配信|ONEMAN|ワンマン|対バン|イベント/.test(`${title} ${content}`)) {
      newsHits++;
      console.log(date, title.slice(0, 80));
    }
  }
  if (posts.length < 100) break;
}
console.log("newsHits", newsHits);
