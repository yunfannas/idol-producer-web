const base = "https://takanenonadeshiko.jp";
const queries = [
  "/live-tour-bouquet-of-9-flowers/",
  "/bouquet-of-9-flowers/",
  "/tour/",
  "/live/",
  "/news/",
  "/category/news/",
];

for (const q of queries) {
  const res = await fetch(base + q.replace(/^\//, ""), { redirect: "follow", headers: { "user-agent": "Mozilla/5.0" } });
  console.log(res.status, res.url, "len", (await res.text()).length);
}

// search pages API
const pages = await fetch(`${base}/wp-json/wp/v2/pages?per_page=100&search=tour`);
const pdata = await pages.json();
console.log("\npages with tour:", Array.isArray(pdata) ? pdata.map((p) => ({ title: p.title?.rendered, link: p.link })) : pdata);

const pages2 = await fetch(`${base}/wp-json/wp/v2/pages?per_page=100&search=Live`);
const pdata2 = await pages2.json();
console.log("\npages with Live:", Array.isArray(pdata2) ? pdata2.map((p) => ({ title: p.title?.rendered, link: p.link })).slice(0, 15) : pdata2);
