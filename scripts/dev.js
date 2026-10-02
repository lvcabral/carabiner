// Dev loop: rebuilds build/ with `vite build --watch` whenever src/ changes and launches
// Electron against it. main.js reloads the settings window on each rebuild and the Display windows
// on display.html/render.js edits; other public/*.js edits restart Electron. Output is a normal
// file:// build, so capture device IDs/permissions match the packaged app.
const { spawn } = require("child_process");
const fs = require("fs");
const path = require("path");
const electron = require("electron");

const root = path.join(__dirname, "..");
const publicDir = path.join(root, "public");

let app;
let restarting = false;
let watcher;

function launchElectron() {
  const env = { ...process.env, ELECTRON_IS_DEV: "1" };
  // VS Code's terminal sets this, which makes Electron run as plain Node
  delete env.ELECTRON_RUN_AS_NODE;
  app = spawn(electron, ["."], { cwd: root, stdio: "inherit", env });
  app.on("exit", async (code) => {
    if (restarting) {
      restarting = false;
      return launchElectron();
    }
    await watcher?.close();
    process.exit(code ?? 0);
  });
}

async function main() {
  // Vite is ESM-only; vite.config.js is picked up from the project root as usual.
  const { build } = await import("vite");
  watcher = await build({
    root,
    build: {
      watch: {},
      // Skip minification so incremental rebuilds stay fast, and keep build/ in place between
      // rebuilds: main watches it to reload the settings window.
      minify: false,
      emptyOutDir: false,
    },
  });
  let started = 0;
  watcher.on("event", (event) => {
    if (event.code === "START") started = Date.now();
    else if (event.code === "ERROR") console.error(event.error);
    else if (event.code === "END") {
      console.log(`[dev] build/ updated in ${Date.now() - started}ms`);
      if (!app) launchElectron();
    }
    event.result?.close?.();
  });
}

// Main-process files can't be hot-swapped: restart Electron. display.html/render.js are
// renderer files that main reloads in place, so they're skipped here. On Windows fs.watch also
// fires when a file is merely read (Electron loading it), so only a changed mtime counts.
const rendererFiles = ["display.html", "render.js"];
const mtimeOf = (file) => {
  try {
    return fs.statSync(path.join(publicDir, file)).mtimeMs;
  } catch {
    return 0;
  }
};
const mtimes = new Map(fs.readdirSync(publicDir).map((file) => [file, mtimeOf(file)]));
let restartTimer;
fs.watch(publicDir, (_, filename) => {
  if (!filename || !filename.endsWith(".js") || rendererFiles.includes(filename)) return;
  const mtime = mtimeOf(filename);
  if (mtime === mtimes.get(filename)) return;
  mtimes.set(filename, mtime);
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    if (!app || restarting) return;
    console.log(`[dev] ${filename} changed, restarting Electron`);
    restarting = true;
    app.kill();
  }, 300);
});

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
