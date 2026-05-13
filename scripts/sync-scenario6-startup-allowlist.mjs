/**
 * Build `public/data/scenarios/scenario_6_2025-07-20/startup_allowlist.json` from
 * `docs/scenario6_available_groups.txt` (same line shape as tier backfill).
 * Line order defines new-game picker order; first `recommended_count` names are "recommended".
 *
 * Run: node scripts/sync-scenario6-startup-allowlist.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const listPath = path.join(root, "docs", "scenario6_available_groups.txt");
const outPath = path.join(root, "public", "data", "scenarios", "scenario_6_2025-07-20", "startup_allowlist.json");

/** Same pattern as `backfill-scenario6-tiers-from-available-list.mjs` */
const LINE_RE = /^\d+\.\s*(.+?)\s*\|\s*tier\s*=\s*([SABCDEFsabcdef])\s*\|\s*members\s*=\s*\d+\s*$/;

function main() {
  const text = fs.readFileSync(listPath, "utf8");
  const names_in_order = [];
  for (const line of text.split(/\n/)) {
    const t = line.trim().replace(/\r$/, "");
    if (!t || t.startsWith("Scenario")) continue;
    const m = t.match(LINE_RE);
    if (!m) continue;
    names_in_order.push(m[1].trim());
  }
  if (names_in_order.length === 0) {
    console.error("No lines parsed from", listPath);
    process.exit(1);
  }
  const payload = {
    recommended_count: 4,
    names_in_order,
  };
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2), "utf8");
  console.log(`Wrote ${names_in_order.length} names to ${path.relative(root, outPath)}`);
}

main();
