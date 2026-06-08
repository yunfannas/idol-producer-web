import fs from "node:fs";
const url = "https://takanenonadeshiko.jp/events/event/avam-presents%e3%80%8e-debutante-vol-9-%e3%80%8f/";
const res = await fetch(url, { headers: { "user-agent": "test" } });
const html = await res.text();
fs.writeFileSync("tmp/takanen-event-sample.html", html, "utf8");
console.log("len", html.length);
for (const pat of ["entry-content", "eo-event", "会場", "venue", "location", "Zepp", "▼"]) {
  console.log(pat, html.includes(pat));
}
