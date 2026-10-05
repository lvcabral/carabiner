import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The settings UI is loaded by Electron from build/index.html via file://,
// so assets must use relative paths. public/ also holds the Electron main
// process and Display window files, which Vite copies to build/ as-is.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: { outDir: "build", emptyOutDir: true },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/setupTests.js",
  },
});
