# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Carabiner is an Electron desktop app for streaming device development and QA. It shows live video from capture cards (HDMI capture devices) in floating overlay windows, while letting users control Roku devices via ECP (HTTP), Android/Fire TV/Google TV devices via ADB, Apple TV via `atvremote` (pyatv), or Xumo Stream Box / RDK devices via the RDK Services JSON-RPC API (`org.rdk.RDKShell`). Primary users are developers testing streaming apps without a physical TV.

The app supports **multiple capture+control "pairs" simultaneously** — one floating Display window per capture device, each linked to its own control device (issue #74). It is also **single-instance**: only one Carabiner process runs at a time.

## Workflow

Always create a new git branch before starting work on any new feature or fix. Never work directly on `main`.

## Commands

```bash
# Development workflow — must build React before running Electron
npm run build       # Compile React app to build/
npm run forge       # Start Electron (loads from build/, requires build first)
npm run debug       # build + run with ELECTRON_IS_DEV=1

# Testing
npm test            # Run React component tests (react-scripts test)

# Packaging / releasing
npm run make        # Create installer for current platform (output: out/make/)
npm run make:mac    # Universal macOS DMG
npm run publish     # build + electron-forge publish to GitHub Releases
```

**macOS notarization** requires env vars: `APPLE_ID`, `APPLE_PASSWORD`, `APPLE_TEAM_ID`.

## Architecture

The app has two separate renderer processes — one React, one plain HTML/JS — coordinated by the Electron main process.

### Main Process (`public/main.js`)

Manages the settings window plus a registry of Display windows. All persistent state flows through here:

- **`mainWindow`**: Settings panel. Loads `build/index.html` (the compiled React app). Hides on close instead of quitting. Module-scoped.
- **Display windows**: One frameless, transparent, `alwaysOnTop` window **per pair**, loading `public/display.html?pairId=<id>`. Tracked in a registry:
  - `pairWindows` — `Map<pairId, BrowserWindow>`
  - `pairState` — `Map<pairId, { controlDeviceId, controlIp, controlType }>` (per-pair control connection target)
  - `senderToPair` — `Map<webContents.id, pairId>` (reverse lookup so renderer→main messages route to the right pair)
  - `activePairId` — the pair targeted by menus/MCP by default; updated on window `focus` via `setActivePair()`
  - `recordingPairs` — `Set<pairId>` currently recording video (recording is per-window)

  Closing a Display window no longer quits the app; it just hides/disables that pair. Lifecycle helpers: `openPair`/`closePair`/`togglePairVisibility`/`setCaptureWindowEnabled`/`setCaptureWindowVisible`/`reconcilePairs`/`connectPairControl`/`disconnectPairControl`. `createDisplayWindow(pair)` is parameterized per pair (bounds/border/resolution/always-on-top all per pair).

- **Single-instance lock**: `app.requestSingleInstanceLock()` near the top of `main.js`; a second launch quits and the running instance surfaces the active Display window (or the Settings window if none is enabled) via the `second-instance` handler.

IPC routing: the main process listens on `shared-window-channel` (synchronous `sendSync`) and routes each message to the correct pair — via an explicit `arg.pairId` (from the settings UI) or `senderToPair.get(event.sender.id)` (from a Display renderer), falling back to the active pair. It also handles side effects (saving settings, rebuilding menus via `rebuildMenus()`, per-pair ADB/ATV/RDK connect/disconnect) based on `arg.type`.

### Settings Model & Migration (`public/settings.js`)

`settings.pairs[]` holds one entry **per capture device** (the General tab is a grid of capture cards). Each pair: `{ id, captureDeviceId, controlDeviceId, visible, bounds, border, transparency, resolution, captureWidth, captureHeight, alwaysOnTop, audioEnabled }`. `pair.id === captureDeviceId` for pairs created in this model; `pair.visible` is the **"Enabled"** flag (whether a window exists for that capture device). `settings.activePairId` tracks the default target. App-wide flags stay under `settings.display` (`showInDock`, `autoUpdate`, `showKeystrokes`, `darkMode`, `shortcut`, `launchAppAtLogin`, `showSettingsOnStart`, `allowSleep`); the device catalog stays in `settings.control.deviceList[]` + `adbPath`/`atvremotePath`. `migrateSettings()` (idempotent, called from `loadSettings()`) converts the legacy single-window config into one pair, drops orphan pairs without a capture device, and seeds nothing on a fresh install (the grid is populated from enumerated capture devices instead).

### Display Window (`public/display.html` + `public/render.js`)

Pure vanilla JS — no React. Each Display window is its **own renderer process**, so module-level state (`controlIp`/`controlType`, `videoState`, `mediaRecorder`/`isRecording`, script state, etc.) is naturally per-window. On load it reads its `pairId` from the query string (`myPairId`), then loads its own pair config from settings (control device, capture device, border, transparency, audio) and **self-starts** its stream from `pair.captureDeviceId` so it streams on launch without depending on the settings window. Manages:
- `getUserMedia` for the capture card video stream (per window)
- Device monitoring via `navigator.mediaDevices.addEventListener("devicechange")` with a 3-second debounce for reconnect recovery
- Keyboard → ECP/ADB/ATV/RDK key translation (`ecpKeysMap`, `adbKeysMap`, `atvKeysMap`, `rdkKeysMap`); ECP is sent directly via `fetch`, the others go through main (which routes to the pair's control target)
- Screenshot capture (canvas), video recording (`MediaRecorder`) — each window records to its own file
- Overlay image rendering

Renderer→main messages are routed by `event.sender` (no need to tag pairId). Video state machine: `stopped → starting → loading → playing`. Recovery attempts are tracked in `deviceRecoveryAttempts` (max 3). `ensureMyConstraints()` lets a window (re)start its stream on show even if it launched hidden.

### Settings Panel (`src/`)

React 17 app using React Bootstrap tabs. `App.js` is the root; each tab is a component in `src/components/`:

| Tab label | Component | Purpose |
|-----------|-----------|---------|
| General | `GeneralSection` | Grid of capture devices (one row each): link a control device + an **Enabled** toggle per capture card (each enabled card = one Display window). Enumerates capture devices via `navigator.mediaDevices`. Plus app-wide flags (shortcut, dock/menu-bar, launch at login, dark mode, etc.) |
| Display | `DisplaySection` | Per-window appearance with an **Editing Window** selector (lists visible windows, follows the active one): border, transparency, capture resolution, display size, always-on-top, audio. Dimmed with a message when no window is enabled |
| Control | `ControlSection` | Add/remove Roku, Android, Apple TV, and Xumo (RDK) streaming devices |
| Overlay | `OverlaySection` | Load reference image for UI comparison |
| Files | `FilesSection` | Default save paths for screenshots/recordings |
| Automation | `AutomationSection` | **Run-on-Window** selector + script recording/playback filtered to that window's control protocol; recording disabled when the window has no linked control |
| MCP | `MCPSection` | Enable/configure the embedded MCP server (port, auth token) + usage instructions |
| About | `AboutSection` | Version, links |

`App.js` holds `pairs`/`activePairId` state, loads them from settings, passes them to the General/Display/Automation tabs, persists edits via `set-pairs`, and listens for `pairs-updated`/`active-pair-changed` from main. The React app communicates with the main process via `window.electronAPI` (exposed by `preload.js` via `contextBridge`).

### Supporting Modules (`public/`)

| File | Role |
|------|------|
| `preload.js` | `contextBridge` — exposes `electronAPI` (send, invoke, onMessageReceived, etc.) to both renderers |
| `settings.js` | Load/save `settings.json` from `app.getPath("userData")`; `migrateSettings`/`makePair`/`newPairId` for the `pairs[]` model |
| `adb.js` | Wraps `adb -s <serial> shell input ...` via `child_process.exec`. **Multi-target**: tracks connected serials so multiple windows can drive different Android devices at once (`connectADB`/`disconnectADB(serial)`/`isADBConnected`/`sendADBKey(key, serial)`/`sendADBText`) |
| `appletv.js` | Wraps `atvremote --id <deviceId>` (pyatv) via `child_process.spawn`. **Multi-target**: tracks connected device ids (`sendATVKey(key, deviceId)` etc.) |
| `rdk.js` | Talks JSON-RPC over HTTP to RDK Services' `org.rdk.RDKShell` plugin (`injectKey`, `launchApplication`). **Multi-target**: connections keyed by `host:port`; send/launch take a `{host,port,token}` target. Exposes `connectRDK`/`disconnectRDK`/`isRDKConnected`/`testRDKConnection`/`sendRDKKey`/`sendRDKText`/`launchRDKApp` |
| `menu.js` | macOS app menu, system tray (Win/macOS), right-click context menu. **Display Windows** submenu (per capture device: **Enabled** + **Visible** checkboxes) in the menu bar and macOS View menu; **Linked Device** submenu (relink the active window's control); a disabled **"Active Window: …"** indicator; window-specific items are disabled when no window is active; per-window titles in the macOS Window menu. `setWindowActions()` wires the submenu to main. Also the Automation scripts submenu and "Check for Updates…" |
| `updater.js` | Polls GitHub Releases API; shows dialog if newer version found |
| `mcp-server.js` | Embedded MCP server (localhost `127.0.0.1` only). Exposes `startMcpServer(ctx)`/`stopMcpServer()`; serves Streamable HTTP at `/mcp` and legacy SSE at `/sse` via Node's built-in `http`. Optional Bearer-token auth. The `@modelcontextprotocol/sdk` ships a CJS build, so it is `require`d directly. |
| `mcp-tools.js` | MCP tool/resource/prompt registration (`registerAll(server, ctx)`) — thin wrappers over `ctx`. Holds the semantic→native key map (ecp/adb/atv/rdk) used by `send_key`, and registers the RDK-only `launch_app` tool. |

### IPC Message Types (`shared-window-channel`)

Each message resolves a target pair (`arg.pairId` from the settings UI, else `senderToPair` from a Display renderer, else the active pair) and is applied/forwarded to that pair's window. Key types handled in `main.js`:
- `set-capture-devices` — caches the global capture-card list (reported by the General tab's enumeration and any Display window) and refreshes menus (de-duped)
- `set-video-stream` — starts the target pair's capture stream and stores its `captureDeviceId`/`captureWidth`/`captureHeight`
- `set-transparency`, `set-resolution`, `set-border-*`, `set-display-size` — per-pair visual settings
- `set-control-list` (global device catalog; unbinds pairs whose device was deleted) / `set-control-selected` (per-pair control select + connect/disconnect)
- `send-adb-key`/`send-adb-text`, `send-atv-key`/`send-atv-text`, `send-rdk-key`/`send-rdk-text` — routed to the sending pair's control target in `adb.js`/`appletv.js`/`rdk.js`
- `set-adb-path` / `set-atv-path` — update paths to the `adb` and `atvremote` binaries (global)
- `set-audio-enabled` — toggles audio in the target pair's window
- `set-show-keystrokes` — toggles the on-screen key indicator overlay (global)
- `set-allow-sleep` — toggles the `powerMonitor`-based auto-pause (global; see Allow Mac to Sleep)

Multi-window pair management (separate `ipcMain` channels): `set-pairs` (React → main, full array → `reconcilePairs`), `toggle-pair-visibility`, `set-active-pair`, `get-pairs`, `get-capture-devices` (cached list for late-mounting renderers). Main → React: `pairs-updated`, `active-pair-changed`.

Separate `ipcMain.on`/`ipcMain.handle` channels (outside `shared-window-channel`) handle:
- Script recording lifecycle: `start-script-recording`, `stop-script-recording`, `save-script`, `run-script`, `stop-script`, `script-playback-started`, `script-playback-done`
- Script management: `get-scripts`, `update-script-name`, `update-script-steps`, `delete-script`
- File dialogs: `save-screenshot-dialog`, `save-video-dialog`, `select-adb-path`, `select-atv-path`, `load-image`, `load-image-by-path`
- RDK (Xumo): `test-rdk-connection` (reachability/auth check from the Control tab's Test button), `launch-rdk-app` (RDKShell `launchApplication`)
- Settings persistence: `save-shortcut`, `save-launch-app-at-login`, `save-dark-mode`, etc. (global); `save-always-on-top` / `save-audio-enabled` take an optional `pairId` and apply per pair
- Recording state: `recording-state-changed` resolves the sending window and updates `recordingPairs` (video recording is per-window — each Display window records its own stream/file)
- MCP server: `save-mcp-config` / `get-mcp-status` (start/stop the server live, persist `settings.mcp`), `save-video-direct` (non-dialog recording save used by MCP). The main↔display renderer RPC for MCP uses `mcp-rpc-request` (main → display: `{requestId, action, params}`) and `mcp-rpc-response` (display → main: `{requestId, result|error}`); `action` is one of `capture-screenshot`, `send-key`, `send-text`, `start-recording`, `stop-recording`.

### MCP Server

`settings.mcp = { enabled, port, token }`. When enabled (toggle in the MCP tab → `MCPSection.js`), `main.js` starts `mcp-server.js` after the windows are created and stops it on `before-quit`. Tool handlers never import main directly — they call a `ctx` object built in `main.js` that reuses the existing internals (`switchControlDevice`, `startScriptPlayback`, ADB/ATV/RDK send fns, `launchRDKApp`, `settings`, menu refreshers) and the `callDisplay(action, params, pairId)` RPC helper for renderer-side work (canvas screenshot, `MediaRecorder`, key/text sending).

**Multi-window targeting**: device/window tools (`send_key`, `send_text`, `take_screenshot`, `start_recording`, `stop_recording`, `launch_app`, `run_script`, `get_current_device`, `show_display`/`hide_display`/`toggle_fullscreen`/`toggle_on_top`) accept an optional **`deviceId`** to target a specific window; they default to the **active** window. `callDisplay` resolves the deviceId → pairId and routes the RPC to that window. A `list_windows` tool enumerates the open pairs. The `launch_app` tool is RDK-only. `run_script` blocks by storing a resolver keyed by script id and settling it in the existing `script-playback-done` handler. See `docs/mcp-server.md` for the full reference.

### Device Control Protocols

- **Roku (ECP)**: HTTP POST to `http://<ip>:8060/keypress|keydown|keyup/<key>`. Sent directly from the display window renderer via `fetch`.
- **Android/Fire TV/Google TV (ADB)**: `adb shell input keyevent <code>` or `adb shell input text <text>`. Routed through main process → `adb.js`.
- **Apple TV (ATV)**: `atvremote --id <deviceId> --protocol mrp <key>` or `atvremote --id <deviceId> text_append=<text>`. Routed through main process → `appletv.js`. Requires `atvremote` binary from the [pyatv](https://pyatv.dev/) package.
- **Xumo Stream Box (RDK)** *(experimental)*: HTTP JSON-RPC to RDK Services' `org.rdk.RDKShell.1.injectKey` (Linux input keycodes) / `.launchApplication`. Routed through main process → `rdk.js`. Connection is configured per-device (`host`, `port` default `9998`, optional Bearer `token`) rather than via a CLI binary; text input is sent character-by-character as injected keys.

The device ID string format encodes protocol: `"<ip>|ecp"`, `"<ip>|adb"`, `"<uuid-or-mac>|atv"`, or `"<host:port>|rdk"`. The ADB/ATV/RDK modules are **multi-target** (keyed by serial / device id / `host:port`), so different Display windows can drive different devices of the same protocol concurrently; each pair's control target lives in `pairState`. ECP is stateless (per-request `fetch` from the renderer).

### Automation / Script System

- **Recording**: `render.js` intercepts key events during recording and logs steps (key, delay, device type). When stopped, sends the step array to main via `save-script`.
- **Window scoping**: script recording and playback target a specific Display window (the Automation tab's **Run-on-Window** selector sets the active pair; `run-script` and `start-script-recording` default to the active pair, and `run-script`/`ctx.runScript` accept an optional pairId). Script recording is single-active. The Automation tab filters the script list to the selected window's control protocol and disables recording when the window has no linked control device.
- **Playback**: all playback is routed through main's `run-script` handler (including menu/tray quick-launch), which tracks `isScriptPlaying`, sends `script-playback-started` to `mainWindow` (so the Automation tab flips ▶ to ■), and forwards `play-script` with `{id, steps, controlType}` to the target window's `render.js`; `playScript()` replays each step with its recorded delay. Cancellable via `stop-script`; completion is reported via `script-playback-done`.
- **Storage**: scripts are saved in `settings.scripts[]` (persisted to `settings.json`). CRUD is handled by dedicated `ipcMain` channels (`get-scripts`, `update-script-name`, `update-script-steps`, `delete-script`).
- **Menu integration**: `menu.js` builds a "Run Script" submenu and a "Stop Script" item in the app/tray/context menus. `updateScriptRecordingMenuItems(disableStart, isRecording, isPlaying)` keeps them in sync: "Run Script" is disabled while recording or playing, and "Stop Script" is enabled only while playing.
- **Status indicators**: the display window shows top-left overlay indicators that share one anchor and reflow horizontally in activation order — red (video recording), blue (script recording), green ▶ (script playback). Managed by `toggleIndicator()` in `render.js`.

### Show Keystrokes Overlay

When `showKeystrokes` is enabled (`set-show-keystrokes` IPC message or `display.showKeystrokes` setting), `render.js` calls `displayKeyIndicator()` to show a brief on-screen label for each key press — useful during live presentations or screen recordings.

### Allow Mac to Sleep

Live audio capture/playback (and the playing `<video>`) make macOS hold `PreventUserIdleSystemSleep` (via `coreaudiod`) and a Chromium "Video Wake Lock" (`NoDisplaySleepAssertion`), which keep the machine awake while Carabiner streams. The app can't suppress those assertions directly — the only way to release them is to stop capturing. This is macOS-only: the toggle is hidden on Windows/Linux (`DisplaySection.js`) and the watcher only starts when `isMacOS`. When `display.allowSleep` is enabled (default; toggle in the Display tab → `set-allow-sleep`), `main.js` registers a `powerMonitor` watcher that pauses capture on `lock-screen` and resumes it on `unlock-screen`. The behavior is intentionally limited to lock/unlock — a deterministic "user walked away / came back" signal — so passively watching the stream never pauses it; the trade-off is that the Mac only sleeps once the screen is locked, not on plain inactivity. Pause/resume reuse the display window's existing `stopVideoStream()`/`renderDisplay()` via the dedicated `auto-suspend`/`auto-resume` IPC messages (kept separate from `window-hide`/`window-show`). The watcher is started/stopped live when the toggle changes and torn down on `before-quit`. In debug builds (`ELECTRON_IS_DEV=1`) it logs `[allow-sleep]` lines on start and on each lock/unlock.
