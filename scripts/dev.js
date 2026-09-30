// Dev loop: rebuilds build/ with webpack watch whenever src/ changes, and launches Electron
// against it (main reloads the settings window on each rebuild). Output is a normal
// file:// build, so capture device IDs/permissions match the packaged app.
process.env.BABEL_ENV = "production";
process.env.NODE_ENV = "production";
require("react-scripts/config/env");

const { spawn } = require("child_process");
const fs = require("fs-extra");
const webpack = require("webpack");
const electron = require("electron");
const paths = require("react-scripts/config/paths");
const configFactory = require("react-scripts/config/webpack.config");

const config = configFactory("production");
// Skip minification so incremental rebuilds stay fast; clear stale hashed bundles only
config.optimization.minimize = false;
config.output.clean = { keep: (asset) => !asset.startsWith("static/") };

// Same as react-scripts build: everything in public/ except the HTML template
fs.copySync(paths.appPublic, paths.appBuild, {
  dereference: true,
  filter: (file) => file !== paths.appHtml,
});

let app;
const watcher = webpack(config).watch({}, (err, stats) => {
  if (err) return console.error(err);
  if (stats.hasErrors()) {
    return console.error(stats.toString({ all: false, errors: true, colors: true }));
  }
  console.log(`[dev] build/ updated in ${stats.endTime - stats.startTime}ms`);
  if (!app) launchElectron();
});

function launchElectron() {
  const env = { ...process.env, ELECTRON_IS_DEV: "1" };
  // VS Code's terminal sets this, which makes Electron run as plain Node
  delete env.ELECTRON_RUN_AS_NODE;
  app = spawn(electron, ["."], { stdio: "inherit", env });
  app.on("exit", (code) => watcher.close(() => process.exit(code ?? 0)));
}
