import { defineConfig } from "vite";

// Relative base works for GitHub project Pages without hard-coding the repo name.
export default defineConfig({
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
