const probes = [
  "https://takanenonadeshiko.jp/wp-json/wp/v2/types",
  "https://takanenonadeshiko.jp/wp-json/wp/v2/events?per_page=100",
  "https://takanenonadeshiko.jp/wp-json/wp/v2/event?per_page=100",
  "https://takanenonadeshiko.jp/wp-json/o/v1/events",
  "https://takanenonadeshiko.jp/events/",
  "https://takanenonadeshiko.jp/events/2025/07/",
  "https://takanenonadeshiko.jp/events/category/live/",
  "https://takanenonadeshiko.jp/wp-admin/admin-ajax.php?action=eventorganiser-fullcal&start=2025-07-01&end=2026-08-01",
];

for (const url of probes) {
  const res = await fetch(url, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      referer: "https://takanenonadeshiko.jp/schedule/",
      "x-requested-with": "XMLHttpRequest",
    },
  });
  const text = await res.text();
  console.log("\n===", res.status, url);
  if (url.includes("admin-ajax") || url.includes("wp-json")) {
    console.log(text.slice(0, 1200));
  } else {
    const links = [...text.matchAll(/\/events\/event\/[^"']+/g)].slice(0, 5);
    console.log("event links sample:", links.map((m) => m[0]));
    console.log("len", text.length, "has fullcal", /fullcal|eventorganiser/i.test(text));
  }
}
