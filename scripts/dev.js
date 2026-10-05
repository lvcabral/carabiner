// Dev loop: rebuilds build/ with `vite build --watch` whenever src/ changes and launches
// Electron against it. After each rebuild the settings window is reloaded, display.html/render.js
// edits reload the Display windows (both via messages over Electron's IPC channel, handled by
// startDevReload() in main.js), and other public/*.js edits restart Electron. Output is a normal
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
  app = spawn(electron, ["."], { cwd: root, stdio: ["inherit", "inherit", "inherit", "ipc"], env });
  app.on("exit", async (code) => {
    if (restarting) {
      restarting = false;
      return launchElectron();
    }
    await watcher?.close();
    process.exit(code ?? 0);
  });
}

function sendToElectron(msg) {
  if (app?.connected && !restarting) app.send(msg);
}

async function main() {
  // Vite is ESM-only; vite.config.mjs is picked up from the project root as usual.
  const { build } = await import("vite");
  watcher = await build({
    root,
    build: {
      watch: {},
      // Skip minification so incremental rebuilds stay fast, and keep build/ in place between
      // rebuilds so a reload never sees an empty folder.
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
      // END fires once every output file is written, so the reload never sees a partial build
      if (!app) launchElectron();
      else sendToElectron("reload-settings");
    }
    event.result?.close?.();
  });
}

// display.html/render.js are renderer files that can be reloaded in place; any other
// public/*.js runs in main (or preload) and needs an Electron restart. On Windows fs.watch also
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
let reloadTimer;
let restartTimer;
fs.watch(publicDir, (_, filename) => {
  const isRenderer = rendererFiles.includes(filename);
  if (!filename || (!isRenderer && !filename.endsWith(".js"))) return;
  const mtime = mtimeOf(filename);
  if (mtime === mtimes.get(filename)) return;
  mtimes.set(filename, mtime);
  if (isRenderer) {
    clearTimeout(reloadTimer);
    reloadTimer = setTimeout(() => sendToElectron("reload-display"), 300);
    return;
  }
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
