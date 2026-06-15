/** @deprecated Use: node scripts/fillCatalogRomaji.mjs --group "アキシブproject" */
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const script = path.join(path.dirname(fileURLToPath(import.meta.url)), "fillCatalogRomaji.mjs");
const r = spawnSync(process.execPath, [script, "--group", "アキシブproject", ...process.argv.slice(2)], {
  stdio: "inherit",
});
process.exit(r.status ?? 1);
