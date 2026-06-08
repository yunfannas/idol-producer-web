import { parseTakanenNewsPost } from "../scripts/takanenOfficialScheduleParse.mjs";

function decodeHtmlText(s) {
  return String(s ?? "")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const r = await fetch("https://takanenonadeshiko.jp/wp-json/wp/v2/posts/4419");
const p = await r.json();
const contentHtml = p.content.rendered;
const text = decodeHtmlText(
  contentHtml
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]+>/g, "\n"),
);
console.log("has newline", text.includes("\n"));
console.log("lines after split", text.split(/\r?\n/).filter(Boolean).length);
console.log("monthday multiline", /^\d{1,2}月\d{1,2}日/m.test(text));
const rows = parseTakanenNewsPost(p);
console.log("parse rows", rows.length);
