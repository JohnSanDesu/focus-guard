// vite.config.mts
// Robust Vite + CRXJS config (avoid import attributes in config)
import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

// Resolve manifest.json path reliably (ESM-safe __dirname)
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const manifestPath = resolve(__dirname, "manifest.json");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "src/ui/start.html"),
      },
    },
  },
});
