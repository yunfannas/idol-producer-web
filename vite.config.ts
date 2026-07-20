import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Serve public/oshi/index.html for `/oshi` and `/oshi/` (Vite SPA fallback would otherwise show the main app). */
function oshiStaticIndex(): Plugin {
  return {
    name: "oshi-static-index",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url !== "/oshi" && url !== "/oshi/") {
          next();
          return;
        }
        const filePath = path.join(rootDir, "public", "oshi", "index.html");
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(fs.readFileSync(filePath));
      });
    },
  };
}

// Relative base works for GitHub project Pages without hard-coding the repo name.
export default defineConfig({
  base: "./",
  plugins: [oshiStaticIndex()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
