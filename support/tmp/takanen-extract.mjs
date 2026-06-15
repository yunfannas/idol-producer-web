import fs from "node:fs";
const h = fs.readFileSync("tmp/takanen-event-sample.html", "utf8");
const m = h.match(/class="entry-content[^"]*"[^>]*>([\s\S]{0,4000})/i);
console.log(m ? m[1] : "no match");
const idx = h.indexOf("▼会場");
console.log("\n--- around 会場 ---");
console.log(h.slice(idx - 50, idx + 300));
