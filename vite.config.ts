import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig(({ command, mode }) => ({
  plugins: [react()],
  base: command === "build" || mode === "production" ? "/echlub-demo/" : "/",
  build: {
    outDir: "docs",
    emptyOutDir: true,
  },
  server: { port: 4173 },
  preview: { port: 4173 },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: [
      "src/validation/browserLoad.test.ts",
      "src/validation/r3BrowserSmoke.test.ts",
    ],
    setupFiles: ["src/validation/vitest.setup.ts"],
    fileParallelism: false,
  },
}));
