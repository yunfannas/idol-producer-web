const r = await fetch("https://takanenonadeshiko.jp/schedule/", {
  headers: { "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
});
const html = await r.text();
console.log("status", r.status, "len", html.length);
console.log("has calendar refs", /eventorganiser|fullcal|eo-fullcalendar|fc-view/i.test(html));
const ajax = html.match(/admin-ajax\.php[^"']*/i)?.[0];
console.log("ajax ref", ajax?.slice(0, 160));
const calDiv = html.match(/id="[^"]*calendar[^"]*"[^>]*>/i)?.[0];
console.log("cal div", calDiv);

const ajaxUrl =
  "https://takanenonadeshiko.jp/wp-admin/admin-ajax.php?action=eventorganiser-fullcal&start=2025-07-01&end=2026-08-01";
for (const ua of [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  "idol-producer-web/0.1",
  "curl/8.0",
]) {
  const ar = await fetch(ajaxUrl, {
    headers: { "user-agent": ua, referer: "https://takanenonadeshiko.jp/schedule/" },
  });
  console.log("ajax", ua.slice(0, 30), "->", ar.status, (await ar.text()).slice(0, 80));
}
