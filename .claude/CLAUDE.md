# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This App Does

Carabiner is an Electron desktop app for streaming device development and QA. It shows live video from a capture card (HDMI capture device) in a floating overlay window, while letting users control Roku devices via ECP (HTTP) or Android/Fire TV/Google TV devices via ADB. Primary users are developers testing streaming apps without a physical TV.

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
| Control | `ControlSection` | Add/remove Roku and Android streaming devices |
| Overlay | `OverlaySection` | Load reference image for UI comparison |
| Files | `FilesSection` | Default save paths for screenshots/recordings |
| About | `AboutSection` | Version, links |

The React app communicates with the main process via `window.electronAPI` (exposed by `preload.js` via `contextBridge`).

### Supporting Modules (`public/`)

| File | Role |
|------|------|
| `preload.js` | `contextBridge` — exposes `electronAPI` (send, invoke, onMessageReceived, etc.) to both renderers |
| `settings.js` | Load/save `settings.json` from `app.getPath("userData")` |
| `adb.js` | Wraps `adb connect/disconnect/shell input keyevent` via `child_process.exec` |
| `menu.js` | macOS menu bar, system tray (Win/macOS), right-click context menu on display window |
| `updater.js` | Polls GitHub Releases API; shows dialog if newer version found |

### IPC Message Types (`shared-window-channel`)

Key message types handled in `main.js`:
- `set-capture-devices` — updates tray menu with available capture cards
- `set-video-stream` — starts capture stream on display window (forwarded only if display is visible)
- `set-transparency`, `set-resolution`, `set-border-*` — visual settings
- `set-control-list` / `set-control-selected` — streaming device CRUD + ADB connect/disconnect
- `send-adb-key` / `send-adb-text` — forwarded to `adb.js`

### Device Control Protocols

- **Roku (ECP)**: HTTP POST to `http://<ip>:8060/keypress|keydown|keyup/<key>`. Sent directly from the display window renderer via `fetch`.
- **Android/Fire TV/Google TV (ADB)**: `adb shell input keyevent <code>` or `adb shell input text <text>`. Routed through main process → `adb.js`.

The device ID string format that encodes both is `"<ip>|ecp"` or `"<ip>|adb"`.
