import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, type Plugin } from "vite";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

/** Serve tool HTML entries for `/oshi`, `/formation-editor`, `/choreography-player`. */
function staticToolIndexes(): Plugin {
  return {
    name: "static-tool-indexes",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const url = req.url?.split("?")[0] ?? "";
        if (url === "/oshi" || url === "/oshi/") {
          const filePath = path.join(rootDir, "public", "oshi", "index.html");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(fs.readFileSync(filePath));
          return;
        }
        if (url === "/formation-editor" || url === "/formation-editor/" || url === "/formation-editor.html") {
          const filePath = path.join(rootDir, "formation-editor.html");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(fs.readFileSync(filePath));
          return;
        }
        if (
          url === "/choreography-player" ||
          url === "/choreography-player/" ||
          url === "/choreography-player.html"
        ) {
          const filePath = path.join(rootDir, "choreography-player.html");
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.end(fs.readFileSync(filePath));
          return;
        }
        next();
      });
    },
  };
}

// Relative base works for GitHub project Pages without hard-coding the repo name.
export default defineConfig({
  base: "./",
  plugins: [staticToolIndexes()],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.join(rootDir, "index.html"),
        formationEditor: path.join(rootDir, "formation-editor.html"),
        choreographyPlayer: path.join(rootDir, "choreography-player.html"),
      },
    },
  },
});
