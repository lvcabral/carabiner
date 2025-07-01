# Building from Source

This guide will help you set up a development environment and build Carabiner from source code.

## Prerequisites

Ensure you have the following installed on your system:

- **Node.js**: v18.0 or higher
- **Git**: For cloning the repository
- **Platform-specific tools**:
  - **macOS**: Xcode Command Line Tools
  - **Windows**: Visual Studio Build Tools or Visual Studio Community
  - **Linux**: Standard development tools (`build-essential` on Ubuntu/Debian)

## Development Setup

### 1. Clone the Repository

```shell
git clone https://github.com/lvcabral/carabiner.git
cd carabiner
```

### 2. Install Dependencies

```shell
npm install
```

This will install all required Node.js dependencies including Electron, React, and build tools.

### 3. Build and Run the Application

```shell
npm run build
npm run forge
```

The first command builds the React frontend, and the second starts the Electron application in development mode.

## Development Commands

### Core Commands

- **`npm run build`**: Build the React application for production
- **`npm run forge`**: Run the Electron app in development mode
- **`npm run make`**: Create platform-specific installers
- **`npm run publish`**: Publish the application as a draft release on GitHub

## Creating Installers

### For Your Current Platform

To create a platform-specific installer for your current operating system:

```shell
npm run make
```

The installer will be created in the `./out/make` directory.

## Project Structure

```shell
carabiner/
├── public/             # Electron main process files
│   ├── main.js         # Main Electron process
│   ├── preload.js      # Bridge script between main and renderer processes
│   ├── render.js       # Display window renderer
│   ├── menu.js         # Application menus
│   ├── settings.js     # Settings management
│   ├── adb.js          # Android Debug Bridge integration
│   └── updater.js      # Auto-updater functionality
├── src/                # React frontend source
│   ├── App.js          # Main React application
│   ├── index.js        # React entry point
│   └── components/     # React components
├── docs/               # Documentation
├── images/             # Application icons and images
├── build/              # Built React application
├── out/                # Built Electron application
├── forge.config.js     # Electron Forge configuration
└── package.json        # Project configuration
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
- **[Android ADB](https://developer.android.com/tools/adb)**: For Android device control

## Next Steps

After setting up your development environment:

- Review the [usage guide](./usage-guide.md) to understand the application
- Check the [keyboard mappings](./key-mappings.md) for control reference
- View the [screenshots](./screenshots.md) to see the application interface
- Explore the codebase to understand the architecture
- Consider contributing improvements or new features
