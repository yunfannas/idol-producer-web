const base = "https://takanenonadeshiko.jp";

async function countPosts(after) {
  let n = 0;
  let pages = 0;
  for (let page = 1; page <= 30; page += 1) {
    const url = `${base}/wp-json/wp/v2/posts?per_page=100&page=${page}&after=${encodeURIComponent(after)}&orderby=date&order=desc`;
    const ps = await (await fetch(url)).json();
    if (!Array.isArray(ps) || !ps.length) break;
    n += ps.length;
    pages = page;
    if (ps.length < 100) break;
  }
  return { n, pages };
}

console.log("since 2024-01", await countPosts("2024-01-01T00:00:00"));
console.log("since 2022-08", await countPosts("2022-08-01T00:00:00"));
console.log("all (no after)", await countPosts("1970-01-01T00:00:00"));

const sm = await (await fetch(`${base}/wp-sitemap-posts-post-1.xml`)).text();
const locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
console.log("post sitemap", locs.length, locs[0], locs.at(-1));
