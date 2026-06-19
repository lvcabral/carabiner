# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Carabiner is an Electron desktop app for streaming device development and QA. It shows live video from a capture card (HDMI capture device) in a floating overlay window, while letting users control Roku devices via ECP (HTTP), Android/Fire TV/Google TV devices via ADB, or Apple TV via `atvremote` (pyatv). Primary users are developers testing streaming apps without a physical TV.

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

Creates and manages two `BrowserWindow` instances. All persistent state flows through here:

- **`mainWindow`**: Settings panel. Loads `build/index.html` (the compiled React app). Hides on close instead of quitting.
- **`displayWindow`**: Floating capture view. Loads `public/display.html`. Frameless, transparent, `alwaysOnTop`. Quitting this window quits the app.

IPC routing: the main process listens on `shared-window-channel` (synchronous `sendSync`) and forwards messages to the appropriate window. It also handles side effects (saving settings, rebuilding tray menus, ADB connect/disconnect) based on `arg.type`.

### Display Window (`public/display.html` + `public/render.js`)

Pure vanilla JS — no React. Manages:
- `getUserMedia` for the capture card video stream
- Device monitoring via `navigator.mediaDevices.addEventListener("devicechange")` with a 3-second debounce for reconnect recovery
- Keyboard → ECP/ADB key translation (`ecpKeysMap`, `adbKeysMap`)
- Screenshot capture (canvas), video recording (`MediaRecorder`)
- Overlay image rendering

Video state machine: `stopped → starting → loading → playing`. Recovery attempts are tracked in `deviceRecoveryAttempts` (max 3).

### Settings Panel (`src/`)

React 17 app using React Bootstrap tabs. `App.js` is the root; each tab is a component in `src/components/`:

| Tab label | Component | Purpose |
|-----------|-----------|---------|
| General | `GeneralSection` | Capture device picker + link to streaming device |
| Display | `DisplaySection` | Border, transparency, window options |
| Control | `ControlSection` | Add/remove Roku, Android, and Apple TV streaming devices |
| Overlay | `OverlaySection` | Load reference image for UI comparison |
| Files | `FilesSection` | Default save paths for screenshots/recordings |
| Automation | `AutomationSection` | Script recording, playback management, and step editing |
| MCP | `MCPSection` | Enable/configure the embedded MCP server (port, auth token) + usage instructions |
| About | `AboutSection` | Version, links |

The React app communicates with the main process via `window.electronAPI` (exposed by `preload.js` via `contextBridge`).

### Supporting Modules (`public/`)

| File | Role |
|------|------|
| `preload.js` | `contextBridge` — exposes `electronAPI` (send, invoke, onMessageReceived, etc.) to both renderers |
| `settings.js` | Load/save `settings.json` from `app.getPath("userData")` |
| `adb.js` | Wraps `adb connect/disconnect/shell input keyevent` via `child_process.exec` |
| `appletv.js` | Wraps `atvremote` CLI (pyatv) for Apple TV key sending and text input via `child_process.spawn` |
| `menu.js` | macOS menu bar, system tray (Win/macOS), right-click context menu; includes Control Device quick-switch submenu and Automation scripts submenu |
| `updater.js` | Polls GitHub Releases API; shows dialog if newer version found |
| `mcp-server.js` | Embedded MCP server (localhost `127.0.0.1` only). Exposes `startMcpServer(ctx)`/`stopMcpServer()`; serves Streamable HTTP at `/mcp` and legacy SSE at `/sse` via Node's built-in `http`. Optional Bearer-token auth. The `@modelcontextprotocol/sdk` ships a CJS build, so it is `require`d directly. |
| `mcp-tools.js` | MCP tool/resource/prompt registration (`registerAll(server, ctx)`) — thin wrappers over `ctx`. Holds the semantic→native key map used by `send_key`. |

### IPC Message Types (`shared-window-channel`)

Key message types handled in `main.js`:
- `set-capture-devices` — updates tray menu with available capture cards
- `set-video-stream` — starts capture stream on display window (forwarded only if display is visible)
- `set-transparency`, `set-resolution`, `set-border-*`, `set-display-size` — visual settings
- `set-control-list` / `set-control-selected` — streaming device CRUD + ADB/ATV connect/disconnect
- `send-adb-key` / `send-adb-text` — forwarded to `adb.js`
- `send-atv-key` / `send-atv-text` — forwarded to `appletv.js`
- `set-adb-path` / `set-atv-path` — update paths to the `adb` and `atvremote` binaries
- `set-audio-enabled` — toggles audio in the display window
- `set-show-keystrokes` — toggles the on-screen key indicator overlay
- `set-allow-sleep` — toggles the `powerMonitor`-based auto-pause that lets the machine sleep (see Allow Mac to Sleep)

Separate `ipcMain.on`/`ipcMain.handle` channels (outside `shared-window-channel`) handle:
- Script recording lifecycle: `start-script-recording`, `stop-script-recording`, `save-script`, `run-script`, `stop-script`, `script-playback-started`, `script-playback-done`
- Script management: `get-scripts`, `update-script-name`, `update-script-steps`, `delete-script`
- File dialogs: `save-screenshot-dialog`, `save-video-dialog`, `select-adb-path`, `select-atv-path`, `load-image`, `load-image-by-path`
- Settings persistence: `save-shortcut`, `save-launch-app-at-login`, `save-always-on-top`, `save-dark-mode`, etc.
- MCP server: `save-mcp-config` / `get-mcp-status` (start/stop the server live, persist `settings.mcp`), `save-video-direct` (non-dialog recording save used by MCP). The main↔display renderer RPC for MCP uses `mcp-rpc-request` (main → display: `{requestId, action, params}`) and `mcp-rpc-response` (display → main: `{requestId, result|error}`); `action` is one of `capture-screenshot`, `send-key`, `send-text`, `start-recording`, `stop-recording`.

### MCP Server

`settings.mcp = { enabled, port, token }`. When enabled (toggle in the MCP tab → `MCPSection.js`), `main.js` starts `mcp-server.js` after the windows are created and stops it on `before-quit`. Tool handlers never import main directly — they call a `ctx` object built in `main.js` that reuses the existing internals (`switchControlDevice`, `startScriptPlayback`, ADB/ATV send fns, `settings`, menu refreshers) and the `callDisplay()` RPC helper for renderer-side work (canvas screenshot, `MediaRecorder`, key/text sending). `run_script` blocks by storing a resolver keyed by script id and settling it in the existing `script-playback-done` handler. See `docs/mcp-server.md` for the full tool/resource/prompt reference and agent usage.

### Device Control Protocols

- **Roku (ECP)**: HTTP POST to `http://<ip>:8060/keypress|keydown|keyup/<key>`. Sent directly from the display window renderer via `fetch`.
- **Android/Fire TV/Google TV (ADB)**: `adb shell input keyevent <code>` or `adb shell input text <text>`. Routed through main process → `adb.js`.
- **Apple TV (ATV)**: `atvremote --id <deviceId> --protocol mrp <key>` or `atvremote --id <deviceId> text_append=<text>`. Routed through main process → `appletv.js`. Requires `atvremote` binary from the [pyatv](https://pyatv.dev/) package.

The device ID string format encodes protocol: `"<ip>|ecp"`, `"<ip>|adb"`, or `"<uuid-or-mac>|atv"`.

### Automation / Script System

- **Recording**: `render.js` intercepts key events during recording and logs steps (key, delay, device type). When stopped, sends the step array to main via `save-script`.
- **Playback**: all playback is routed through main's `run-script` handler (including menu/tray quick-launch), which tracks `isScriptPlaying`, sends `script-playback-started` to `mainWindow` (so the Automation tab flips ▶ to ■), and forwards `play-script` with `{id, steps, controlType}` to `render.js`; `playScript()` replays each step with its recorded delay. Cancellable via `stop-script`; completion is reported via `script-playback-done`.
- **Storage**: scripts are saved in `settings.scripts[]` (persisted to `settings.json`). CRUD is handled by dedicated `ipcMain` channels (`get-scripts`, `update-script-name`, `update-script-steps`, `delete-script`).
- **Menu integration**: `menu.js` builds a "Run Script" submenu and a "Stop Script" item in the app/tray/context menus. `updateScriptRecordingMenuItems(disableStart, isRecording, isPlaying)` keeps them in sync: "Run Script" is disabled while recording or playing, and "Stop Script" is enabled only while playing.
- **Status indicators**: the display window shows top-left overlay indicators that share one anchor and reflow horizontally in activation order — red (video recording), blue (script recording), green ▶ (script playback). Managed by `toggleIndicator()` in `render.js`.

### Show Keystrokes Overlay

When `showKeystrokes` is enabled (`set-show-keystrokes` IPC message or `display.showKeystrokes` setting), `render.js` calls `displayKeyIndicator()` to show a brief on-screen label for each key press — useful during live presentations or screen recordings.

### Allow Mac to Sleep

Live audio capture/playback (and the playing `<video>`) make macOS hold `PreventUserIdleSystemSleep` (via `coreaudiod`) and a Chromium "Video Wake Lock" (`NoDisplaySleepAssertion`), which keep the machine awake while Carabiner streams. The app can't suppress those assertions directly — the only way to release them is to stop capturing. This is macOS-only: the toggle is hidden on Windows/Linux (`DisplaySection.js`) and the watcher only starts when `isMacOS`. When `display.allowSleep` is enabled (default; toggle in the Display tab → `set-allow-sleep`), `main.js` registers a `powerMonitor` watcher that pauses capture on `lock-screen` and resumes it on `unlock-screen`. The behavior is intentionally limited to lock/unlock — a deterministic "user walked away / came back" signal — so passively watching the stream never pauses it; the trade-off is that the Mac only sleeps once the screen is locked, not on plain inactivity. Pause/resume reuse the display window's existing `stopVideoStream()`/`renderDisplay()` via the dedicated `auto-suspend`/`auto-resume` IPC messages (kept separate from `window-hide`/`window-show`). The watcher is started/stopped live when the toggle changes and torn down on `before-quit`. In debug builds (`ELECTRON_IS_DEV=1`) it logs `[allow-sleep]` lines on start and on each lock/unlock.
