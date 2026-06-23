/**
 * Probe TimeTree public calendar slugs (HTTP title check).
 *
 * Usage:
 *   node support/scripts/timetree_probe_slugs.mjs [slug ...]
 *   node support/scripts/timetree_probe_slugs.mjs --roster-missing
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..", "..");
const rosterPath = path.join(root, "public", "data", "reference", "timetree_heroines_roster.json");

async function probe(slug) {
  const url = `https://timetreeapp.com/public_calendars/${slug}`;
  try {
    const res = await fetch(url, {
      headers: { "user-agent": "idol-producer-web/0.1 (slug probe)" },
      redirect: "follow",
    });
    const html = await res.text();
    const title = (html.match(/<title>([^<]+)<\/title>/i) ?? [])[1]?.trim() ?? "";
    const ok = res.ok && !/not found|404/i.test(title) && title.length > 3;
    return { slug, ok, status: res.status, title };
  } catch (err) {
    return { slug, ok: false, error: String(err) };
  }
}

const argv = process.argv.slice(2);
/** @type {string[]} */
let slugs = argv.filter((a) => !a.startsWith("--"));

if (argv.includes("--roster-missing")) {
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  slugs = (roster.groups ?? []).filter((g) => !g.slug).map((g) => String(g.group_name));
  console.error("Roster entries without slug (manual discovery needed):");
  for (const name of slugs) console.error(`  - ${name}`);
  process.exit(0);
}

if (!slugs.length) {
  const roster = JSON.parse(fs.readFileSync(rosterPath, "utf8"));
  slugs = (roster.groups ?? []).filter((g) => g.slug).map((g) => String(g.slug));
}

const results = await Promise.all(slugs.map(probe));
for (const row of results) {
  if (row.ok) console.log(`OK  ${row.slug}\t${row.title}`);
  else console.log(`FAIL ${row.slug}\t${row.title ?? row.error ?? row.status}`);
}
