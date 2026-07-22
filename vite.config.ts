import { defineConfig } from "vite";

export default defineConfig(({ command, mode }) => ({
  // GitHub Pages build uses /echlub-demo/; preview must match built asset paths.
  // Dev server keeps base / so http://localhost:<port>/ loads /src/main.ts directly.
  base: command === "build" || mode === "production" ? "/echlub-demo/" : "/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  server: { port: 4173 },
  preview: { port: 4173 },
}));
