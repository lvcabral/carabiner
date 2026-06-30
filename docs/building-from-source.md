# Building from Source

This guide will help you set up a development environment and build Carabiner from source code.

## Prerequisites

Ensure you have the following installed on your system:

- **Node.js**: v18.0 or higher
- **Git**: For cloning the repository
- **Electron**: v42 (installed automatically via `npm install`)
- **Platform-specific tools**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools or Visual Studio Community
  - **Linux**: Standard development tools (`build-essential` on Ubuntu/Debian)

## Development Setup

### 1. Clone the Repository

```console
git clone https://github.com/lvcabral/carabiner.git
cd carabiner
```

### 2. Install Dependencies

```console
npm install
```

This will install all required Node.js dependencies including Electron, React, and build tools.

### 3. Build and Run the Application

```console
npm run build
npm run forge
```

The first command builds the React frontend, and the second starts the Electron application in development mode.

## Development Commands

### Core Commands

- **`npm run build`**: Build the React application for production
- **`npm run forge`**: Run the Electron app via electron-forge (requires a prior `build`)
- **`npm run electron`**: Run the Electron app directly with `electron .` (also requires a prior `build`)
- **`npm run debug`**: Build and run with `ELECTRON_IS_DEV=1` for development logging
- **`npm run test`**: Run React component tests
- **`npm run package`**: Package the app without building an installer (output: `out/`)
- **`npm run make`**: Create an installer for the current platform (output: `out/make/`)
- **`npm run make:mac:arm64`**: Create a macOS DMG for Apple Silicon (arm64)
- **`npm run make:mac:universal`**: Create a universal macOS DMG (Intel + Apple Silicon)
- **`npm run make:win`**: Create a Windows x64 installer
- **`npm run make:linux`**: Create a Linux x64 installer
- **`npm run publish`**: Build and publish a draft release to GitHub

## Creating Installers

### For Your Current Platform

To create an installer for your current operating system:

```console
npm run make
```

The installer will be created in the `./out/make` directory.

### macOS

```console
npm run make:mac:arm64      # Apple Silicon only
npm run make:mac:universal  # universal (Intel + Apple Silicon)
```

`make:mac:universal` produces a single DMG that runs natively on both Intel and Apple Silicon Macs.

> **macOS notarization** requires the `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` environment variables to be set before running the `make:mac:*` scripts or `publish`.

### Windows and Linux

```console
npm run make:win    # Windows x64 installer
npm run make:linux  # Linux x64 installer
```

> Cross-platform builds generally require building on (or with the toolchain for) the target OS.

## Project Structure

```console
carabiner/
├── public/                      # Electron main process and display window files
│   ├── main.js                  # Main process — multi-window pair registry, IPC routing, single-instance
│   ├── preload.js               # contextBridge — exposes electronAPI to both renderers
│   ├── display.html             # Display window HTML (one window per capture+control pair)
│   ├── render.js                # Display window renderer — video, keyboard, recording, scripts (per window)
│   ├── menu.js                  # macOS app menu, system tray, and right-click context menu
│   ├── settings.js              # Load/save settings.json (pairs[] model + migration)
│   ├── adb.js                   # Android/Fire TV/Google TV control via ADB (multi-target)
│   ├── appletv.js               # Apple TV control via atvremote (pyatv, multi-target)
│   ├── rdk.js                   # Xumo Stream Box / RDK control via RDKShell JSON-RPC (multi-target)
│   ├── mcp-server.js            # Embedded MCP server (localhost) — HTTP/SSE transports
│   ├── mcp-tools.js             # MCP tool/resource/prompt registration
│   └── updater.js               # GitHub Releases version check
├── src/                         # React frontend source (settings panel)
│   ├── App.js                   # Root component — tab layout
│   ├── index.js                 # React entry point
│   └── components/              # One component per settings tab
│       ├── GeneralSection.js    # Capture-device grid: link control + Enabled per window
│       ├── DisplaySection.js    # Per-window appearance (Editing Window selector)
│       ├── ControlSection.js    # Add/remove Roku, Android, Apple TV, and Xumo (RDK) devices
│       ├── AutomationSection.js # Script recording, playback, and step editing
│       ├── OverlaySection.js    # Reference image overlay with opacity control
│       ├── FilesSection.js      # Default save paths for screenshots/recordings
│       ├── MCPSection.js        # Enable/configure the embedded MCP server
│       ├── AboutSection.js      # Version info and links
│       └── select/              # Reusable form controls (capture, resolution, border, shortcut)
├── docs/                        # Documentation (build, usage, setup, MCP, key mappings)
├── images/                      # Application icons and images
├── build/                       # Built React application (generated)
├── out/                         # Built Electron application and installers (generated)
├── forge.config.js              # Electron Forge configuration
└── package.json                 # Project configuration
```

## Contributing to Development

### Setting Up for Contributions

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch**: `git checkout -b feature/your-feature-name`
4. **Make your changes** and test thoroughly
5. **Commit your changes**: `git commit -m "Add your feature"`
6. **Push to your fork**: `git push origin feature/your-feature-name`
7. **Create a Pull Request** on GitHub

### Development Best Practices

- **Test thoroughly** on your target platform
- **Follow existing code style** and patterns
- **Update documentation** for new features
- **Write descriptive commit messages**
- **Keep changes focused** - one feature per PR

## Useful Resources

### Electron Development

- **[Electron Documentation](https://www.electronjs.org/docs)**: Official Electron docs
- **[Electron Forge](https://www.electronforge.io/)**: Build toolchain used by Carabiner
- **[Security Guide](https://www.electronjs.org/docs/tutorial/security)**: Electron security best practices

### React Development

- **[React Documentation](https://react.dev/)**: Official React docs
- **[React Hooks](https://react.dev/reference/react)**: Modern React patterns used in Carabiner

### Platform APIs

- **[Roku ECP API](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md)**: For Roku device control
- **[Android ADB](https://developer.android.com/tools/adb)**: For Android/Fire TV/Google TV device control
- **[pyatv (atvremote)](https://pyatv.dev/)**: For Apple TV device control
- **[RDK Services (RDKShell)](https://rdkcentral.github.io/rdkservices/)**: For Xumo Stream Box / RDK device control (experimental)
- **[Model Context Protocol](https://modelcontextprotocol.io/)**: Protocol behind the embedded MCP server

## Next Steps

After setting up your development environment:

- Review the [usage guide](./usage-guide.md) to understand the application
- Check the [keyboard mappings](./key-mappings.md) for control reference
- Set up [Android/Fire TV](./setup-android-firetv.md) and [Apple TV](./setup-apple-tv.md) devices
- Explore the [MCP server](./mcp-server.md) for AI-driven device control and test automation
- View the [screenshots](./screenshots.md) to see the application interface
- Explore the codebase to understand the architecture
- Consider contributing improvements or new features
