const url = "https://takanenonadeshiko.jp/events/event/avam-presents%e3%80%8e-debutante-vol-9-%e3%80%8f/";
const res = await fetch(url, { headers: { "user-agent": "test" } });
const html = await res.text();
const contentMatch = html.match(/class="entry-content[\s\S]*?>([\s\S]*?)<\/div>\s*<\/div>\s*<\/article>/i);
console.log("contentMatch:", !!contentMatch);
if (contentMatch) {
  const text = contentMatch[1].replace(/<[^>]+>/g, "\n").replace(/\s+/g, " ");
  console.log(text.slice(0, 800));
}
console.log("\n--- eo-venue ---");
console.log(html.match(/eo-venue[^>]*>([\s\S]*?)<\//i)?.[1]?.slice(0,200));
console.log("\n--- venue meta ---");
console.log(html.match(/itemprop="location"[\s\S]{0,500}/i)?.[0]);
