import { defineConfig } from "vite";

export default defineConfig(({ command }) => ({
  base: command === "build" ? "/echlub-demo/" : "/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  server: { port: 4173 },
  preview: { port: 4173 },
}));
