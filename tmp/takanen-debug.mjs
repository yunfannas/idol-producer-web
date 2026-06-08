import {
  dateInRange,
  parseTakanenEventPageHtml,
  uniqueEventUrlsFromSitemap,
} from "../scripts/takanenOfficialScheduleParse.mjs";

const sitemapUrl = "https://takanenonadeshiko.jp/wp-sitemap-posts-event-1.xml";
const startYm = "2025-07";
const endYm = "2026-05";

const sitemapRes = await fetch(sitemapUrl, {
  headers: { "user-agent": "idol-producer-web/0.1" },
});
const urls = uniqueEventUrlsFromSitemap(await sitemapRes.text());
console.log("unique URLs:", urls.length);

for (const url of urls) {
  await new Promise((r) => setTimeout(r, 150));
  const res = await fetch(url, {
    headers: { "user-agent": "idol-producer-web/0.1" },
  });
  const html = await res.text();
  const row = parseTakanenEventPageHtml(html, url);
  const inRange = row.date && dateInRange(row.date, startYm, endYm);
  console.log(
    [inRange ? "IN" : "OUT", row.date ?? "NO_DATE", row.type, row.venue ?? "-", row.event?.slice(0, 50)].join("\t"),
  );
}
