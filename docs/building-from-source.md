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
- **`npm run forge`**: Run the Electron app (requires a prior `build`)
- **`npm run debug`**: Build and run with `ELECTRON_IS_DEV=1` for development logging
- **`npm run test`**: Run React component tests
- **`npm run make`**: Create a platform-specific installer for the current OS (output: `out/make/`)
- **`npm run make:mac`**: Create a universal macOS DMG (Intel + Apple Silicon)
- **`npm run make:all`**: Create installers for macOS (universal), Windows (x64), and Linux (x64)
- **`npm run publish`**: Build and publish a draft release to GitHub

## Creating Installers

### For Your Current Platform

To create a platform-specific installer for your current operating system:

```console
npm run make
```

The installer will be created in the `./out/make` directory.

### macOS Universal Binary

```console
npm run make:mac
```

Produces a single DMG that runs natively on both Intel and Apple Silicon Macs.

> **macOS notarization** requires the `APPLE_ID`, `APPLE_PASSWORD`, and `APPLE_TEAM_ID` environment variables to be set before running `make:mac` or `publish`.

### All Platforms

```console
npm run make:all
```

Builds installers sequentially for macOS (universal DMG), Windows (x64), and Linux (x64).

## Project Structure

```console
carabiner/
├── public/                      # Electron main process and display window files
│   ├── main.js                  # Main Electron process — window management and IPC routing
│   ├── preload.js               # contextBridge — exposes electronAPI to both renderers
│   ├── display.html             # Display window HTML (loaded by displayWindow)
│   ├── render.js                # Display window renderer — video, keyboard, recording, scripts
│   ├── menu.js                  # macOS menu bar, system tray, and right-click context menu
│   ├── settings.js              # Load/save settings.json from userData
│   ├── adb.js                   # Android/Fire TV/Google TV control via ADB
│   ├── appletv.js               # Apple TV control via atvremote (pyatv)
│   ├── mcp-server.js            # Embedded MCP server (localhost) — HTTP/SSE transports
│   ├── mcp-tools.js             # MCP tool/resource/prompt registration
│   └── updater.js               # GitHub Releases version check
├── src/                         # React frontend source (settings panel)
│   ├── App.js                   # Root component — tab layout
│   ├── index.js                 # React entry point
│   └── components/              # One component per settings tab
│       ├── GeneralSection.js    # Capture device picker and device link
│       ├── DisplaySection.js    # Border, transparency, window options
│       ├── ControlSection.js    # Add/remove Roku, Android, and Apple TV devices
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
