import { defineConfig } from "vite";

// Test-only component harness build; never part of the production dist.
export default defineConfig({
  root: "component-harness",
  build: {
    outDir: "../dist-harness",
    emptyOutDir: true,
    rollupOptions: { input: "component-harness/harness.html" },
  },
  preview: { port: 4174, strictPort: true },
});
