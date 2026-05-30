<p align="center">
  <img src="images/carabiner-icon.png" height="125px" alt="Carabiner logo" />
  <br><br>
  <a href="https://github.com/lvcabral/carabiner/releases/tag/1.3.2"><img src="https://img.shields.io/badge/Version-1.3.2-blue.svg" alt="Version 1.3.2" /></a>
  <img src="https://img.shields.io/badge/Build-Passing-green.svg" alt="Build Passing" />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/license-MIT-brightgreen?style=flat-square" alt="License MIT" /></a>
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20MacOS%20%7C%20Windows-blue?style=flat-square" alt="Platform Linux | MacOS | Windows" />
</p>

# Carabiner

**Carabiner** is a powerful video capture and remote control application designed for streaming device development and testing. It provides seamless control of Roku, Android-based streaming devices (Fire TV, Google TV, Android TV), and Apple TV through an intuitive floating window interface.

<p align="center">
  <img src="https://img.shields.io/badge/Roku-662D91?style=for-the-badge&logo=roku&logoColor=white" alt="Roku" height="40px" />
  <img src="https://img.shields.io/badge/Fire%20TV-FF9900?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyByb2xlPSJpbWciIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48dGl0bGU+QW1hem9uIEZpcmUgVFY8L3RpdGxlPjxwYXRoIGQ9Ik0yMC4xOTYgMTUuMTJjLjI2NS4zMzctLjI5NCAxLjczLS41NDIgMi4zNTMtLjA3Ny4xOS4wODUuMjY2LjI1Ny4xMjMgMS4xMDYtLjkyNiAxLjM5LTIuODY3IDEuMTY2LTMuMTQ5LS4yMjYtLjI3Ny0yLjE2LS41MTYtMy4zNDEuMzE0LS4xODMuMTI3LS4xNTEuMzA0LjA1LjI3OS42NjUtLjA4IDIuMTQ3LS4yNTcgMi40MS4wOG0tLjg1OC45ODFjLTIuMDY0IDEuNTIzLTUuMDU2IDIuMzMzLTcuNjMyIDIuMzMzLTMuNjExIDAtNi44NjItMS4zMzQtOS4zMjItMy41NTUtLjE5NC0uMTc2LS4wMi0uNDE0LjIxLS4yOCAyLjY1NSAxLjU0NSA1LjkzOSAyLjQ3NyA5LjMyOCAyLjQ3NyAyLjI4NyAwIDQuODAzLS40NzYgNy4xMTUtMS40NTguMzQ4LS4xNDcuNjQyLjIzMS4zLjQ4M20yLjAzNC0zLjE1NWEuMzg4LjM4OCAwIDAgMS0uMjAxLS4wNGMtLjA0MS0uMDI2LS4wODctLjEtLjEzMy0uMjI1bC0xLjczNC00LjM1NWExLjc5IDEuNzkgMCAwIDAtLjA0Ni0uMTE3LjI2Ni4yNjYgMCAwIDEtLjAyMy0uMTA4YzAtLjA4NC4wNDktLjEyOC4xNDYtLjEyOGguNThjLjA5OCAwIC4xNjUuMDE0LjIwNS4wNC4wNC4wMjYuMDgyLjEwMi4xMjcuMjI2bDEuMzQ0IDMuODIzIDEuMzQzLTMuODIzYy4wNDYtLjEyNC4wODktLjIuMTI4LS4yMjZhLjQwMi40MDIgMCAwIDEgLjIwNS0uMDRoLjU0Yy4xIDAgLjE0OC4wNDQuMTQ4LjEyOGEuMy4zIDAgMCAxLS4wMjUuMTA4Yy0uMDE2LjA0LS4wMzIuMDc4LS4wNDQuMTE3bC0xLjcyNyA0LjM1NWMtLjA0NS4xMjQtLjA5LjE5OS0uMTMyLjIyNWEuMzg4LjM4OCAwIDAgMS0uMjAxLjA0em0tMy42NDQuMDY4Yy0uOTI5IDAtMS4zOTItLjQ2My0xLjM5Mi0xLjM5MlY4LjczOWgtLjcwNmMtLjEzIDAtLjE5Ny0uMDY2LS4xOTctLjE5NnYtLjI0NmEuMjIuMjIgMCAwIDEgLjA0NS0uMTQ3Yy4wMy0uMDMxLjA4Ni0uMDU1LjE3MS0uMDY3bC43MTctLjA5LjEyNy0xLjIxNWMuMDEzLS4xMy4wODItLjE5Ni4yMDctLjE5NmguNDFjLjEzIDAgLjE5Ni4wNjYuMTk2LjE5NnYxLjE5NmgxLjI3NmMuMTMgMCAuMTk1LjA2NS4xOTUuMTk3di4zNzJjMCAuMTMtLjA2NC4xOTYtLjE5NS4xOTZoLTEuMjc2djIuODM0YzAgLjI0My4wNTUuNDExLjE2Mi41MS4xMDguMDk4LjI5My4xNDcuNTU1LjE0Ny4xMjQgMCAuMjc3LS4wMTYuNDYtLjA0OS4wOTktLjAyLjE2NC0uMDMuMTk3LS4wMy4wNTIgMCAuMDg4LjAxNC4xMDguMDQ0LjAyLjAzLjAyOS4wNzcuMDI5LjE0MnYuMjY2YS4zNjYuMzY2IDAgMCAxLS4wNC4xOWMtLjAyNi4wNDMtLjA3OC4wNzgtLjE1Ny4xMDNhMy4wMTggMy4wMTggMCAwIDEtLjg5Mi4xMThtLTQuNjY1LTIuOTc2Yy4wMDYtLjA1Mi4wMTEtLjEzNy4wMTEtLjI1NSAwLS4zOTktLjA5NC0uNjk4LS4yOC0uOTAxLS4xODYtLjIwNC0uNDYtLjMwNi0uODE4LS4zMDYtLjQxMiAwLS43MzIuMTIzLS45NjIuMzY5LS4yMjguMjQ1LS4zNi42MS0uMzkyIDEuMDkzem0tLjk0MiAzLjA3Yy0uODAzIDAtMS40MTEtLjIyMi0xLjgyNC0uNjY3LS40MTItLjQ0NC0uNjE2LTEuMTAyLS42MTYtMS45NzIgMC0uODMuMjA0LTEuNDc1LjYxNi0xLjkzNy40MTMtLjQ2Ljk4OC0uNjkxIDEuNzI4LS42OTEuNjIgMCAxLjA5OC4xNzYgMS40MzIuNTI0LjMzMi4zNTEuNS44NDYuNSAxLjQ4NyAwIC4yMS0uMDE3LjQyMi0uMDUuNjM4LS4wMTQuMDc3LS4wMzQuMTMtLjA2NC4xNTYtLjAyOS4wMjctLjA3Ny4wNC0uMTQyLjA0aC0zLjA4Yy4wMTMuNTYzLjE1NC45NzcuNDE4IDEuMjQ1LjI2NS4yNjguNjc0LjQwMyAxLjIzLjQwMy4xOTYgMCAuMzg1LS4wMTQuNTY0LS4wNGE1LjA0IDUuMDQgMCAwIDAgLjY4Mi0uMTY2bC4xMTctLjAzNWEuMjg0LjI4NCAwIDAgMSAuMDktLjAxNmMuMDg1IDAgLjEyNS4wNi4xMjUuMTc3di4yNzZjMCAuMDg1LS4wMTIuMTQ0LS4wMzcuMThhLjQ0MS40NDEgMCAwIDEtLjE2Ny4xMTQgMy4zOCAzLjM4IDAgMCAxLS43MDEuMjA1IDQuMjM2IDQuMjM2IDAgMCAxLS44Mi4wNzltLTUuNDI0LS4xNDdjLS4xMyAwLS4xOTUtLjA2Ni0uMTk1LS4xOTd2LTQuNThjMC0uMTMuMDY0LS4xOTUuMTk1LS4xOTVoLjQzMmMuMDY0IDAgLjExNi4wMTIuMTUzLjAzOS4wMzYuMDI1LjA2LjA3Ni4wNzIuMTQ2bC4wNy41NWMuMTc2LS4xOS4zNDMtLjM0LjQ5OS0uNDUyYTEuNzI1IDEuNzI1IDAgMCAxIDEuMDItLjMyM2MuMDc5IDAgLjE1OC4wMDMuMjM1LjAxLjExMi4wMTQuMTY4LjA3Mi4xNjguMTc2di41M2MwIC4xMTctLjA1OC4xNzctLjE3OC4xNzctLjA1OCAwLS4xMTQtLjAwNC0uMTctLjAxYTEuNjM4IDEuNjM4IDAgMCAwLS4xOC0uMDFjLS41MjQgMC0uOTczLjE1Ny0xLjM0Ni40N3YzLjQ3MmMwIC4xMzEtLjA2Ni4xOTctLjE5NS4xOTd6bS0yLjI0OSAwYy0uMTMgMC0uMTk2LS4wNjYtLjE5Ni0uMTk3di00LjU4YzAtLjEzLjA2Ni0uMTk1LjE5Ni0uMTk1aC41NzljLjEzIDAgLjE5NS4wNjQuMTk1LjE5NXY0LjU4YzAgLjEzMS0uMDY1LjE5Ny0uMTk1LjE5N3ptLjI5NS01Ljg1NmMtLjE5IDAtLjMzOS0uMDU0LS40NDctLjE2YS41ODEuNTgxIDAgMCAxLS4xNjEtLjQyOGMwLS4xNzYuMDU0LS4zMTguMTYtLjQyNi4xMS0uMTA5LjI1Ny0uMTYzLjQ0OC0uMTYzLjE4OSAwIC4zMzcuMDU0LjQ0Ni4xNjMuMTA3LjEwOC4xNi4yNS4xNi40MjZhLjU4MS41ODEgMCAwIDEtLjE2LjQyNy42MDguNjA4IDAgMCAxLS40NDYuMTYxbS0zLjYyNSA1Ljg1NmMtLjEzMiAwLS4xOTctLjA2Ni0uMTk3LS4xOTd2LTQuMDFILjE5NWMtLjEzIDAtLjE5NS0uMDY2LS4xOTUtLjE5N3YtLjI0NWMwLS4wNjUuMDE0LS4xMTQuMDQzLS4xNDcuMDMtLjAzMy4wODgtLjA1NS4xNzMtLjA3bC43MDUtLjA4N3YtLjgwNGMwLTEuMDkxLjUyMy0xLjYzOCAxLjU3LTEuNjM4LjI0OCAwIC41MS4wMzYuNzg0LjEwOS4wNzIuMDE5LjEyMi4wNDcuMTUyLjA4OC4wMjkuMDM4LjA0NC4xMDcuMDQ0LjIwNXYuMjU1YzAgLjEyNC0uMDQ4LjE4Ni0uMTQ4LjE4Ni0uMDU4IDAtLjE0LS4wMS0uMjQ4LS4wMjktLjExLS4wMi0uMjMtLjAzLS4zNjktLjAzLS4zIDAtLjUxLjA1Ny0uNjMzLjE3Mi0uMTIxLjExNS0uMTgxLjMwMy0uMTgxLjU2NHYuOTAzaDEuMzI0Yy4xMzEgMCAuMTk3LjA2NC4xOTcuMTk1di4zNzNjMCAuMTMtLjA2Ni4xOTctLjE5Ny4xOTdIMS44OTJ2NC4wMWMwIC4xMzEtLjA2NS4xOTctLjE5Ni4xOTdaIi8+PC9zdmc+&logoColor=white" alt="Fire TV" height="40px" />
  <img src="https://img.shields.io/badge/Google%20TV-4285F4?style=for-the-badge&logo=googleTV&logoColor=white" alt="Google TV" height="40px" />
  <img src="https://img.shields.io/badge/Android%20TV-3DDC84?style=for-the-badge&logo=android&logoColor=black" alt="Android TV" height="40px" />
  <img src="https://img.shields.io/badge/Apple%20TV-1c1c1e?style=for-the-badge&logo=apple&logoColor=white" alt="Apple TV" height="40px" />
</p>

## Why Carabiner?

Perfect for developers and QA engineers who need to test streaming applications using capture cards and keyboard controls, eliminating the need for physical TV sets or remote controls. Whether you're developing apps, testing UI designs, or performing quality assurance, Carabiner streamlines your workflow by bringing your streaming devices directly to your desktop.

## Features

### Core Functionality

- **Multi-Device Support**: Control Roku, Android-based devices (Fire TV, Google TV, Android TV) and Apple TV
- **Real-time Video Capture**: View your streaming device output directly on your computer
- **Video Recording**: Record streaming device sessions in MP4/WebM format for documentation and testing
- **Keyboard Control**: Use your computer keyboard to navigate and control devices
- **Text Pasting**: Paste clipboard content directly to streaming devices
- **Screenshot Capture**: Save or copy screenshots with one click
- **Automation Scripts**: Record key sequences with precise timing and replay them on demand

### Additional Features

- **Overlay Images**: Load reference images for pixel-perfect UI comparison with opacity control
- **Customizable Display**: Adjust transparency, borders, dimensions and toggle always-on-top behavior
- **Global Shortcut**: Quick show/hide the display window from anywhere with a keyboard shortcut
- **Audio Capture**: Toggle audio capture for testing audio features (TTS, Audio tracks)
- **Auto-Launch**: Start with your system for seamless workflow
- **Resolution Control**: Configure capture device resolution
- **Dark Mode Support**: Allows to switch the settings interface to dark mode
- **Default Save Locations**: Configure custom default folders for screenshots and recordings in the Files tab
- **Interactive Notifications**: Click toast notifications to open saved file locations instantly

## Quick Start

1. **Download** the latest installer from the [releases page](https://github.com/lvcabral/carabiner/releases)
2. **Install** and launch Carabiner (see our [Installation Guide](./docs/installation.md))
3. **Configure** your capture device in the **General** tab
4. **Add** your streaming device in the **Control** tab
5. **Link** your devices in the **General** tab and start controlling!

For detailed setup and usage instructions, see our comprehensive guides:

- **📦 [Installation Guide](./docs/installation.md)** - Complete installation and setup instructions
- **📖 [Usage Guide](./docs/usage-guide.md)** - Detailed feature documentation and tutorials
- **🔧 [Building from Source](./docs/building-from-source.md)** - Developer setup and contribution guide
- **⌨️ [Keyboard Mappings](./docs/key-mappings.md)** - Complete keyboard control reference
- **📸 [Screenshots](./docs/screenshots.md)** - Visual showcase of the application interface
- **🤖 [Android / Fire TV Setup](./docs/setup-android-firetv.md)** - ADB setup for Fire TV and Google TV
- **🍎 [Apple TV Setup](./docs/setup-apple-tv.md)** - pyatv setup and pairing for Apple TV

## Contributing

We welcome contributions to make Carabiner better! Here's how you can help:

### Ways to Contribute

- **🐛 Report Bugs**: Found an issue? [Create a bug report](https://github.com/lvcabral/carabiner/issues)
- **💡 Suggest Features**: Have an idea? [Submit a feature request](https://github.com/lvcabral/carabiner/issues)
- **🔧 Fix Issues**: Browse [open issues](https://github.com/lvcabral/carabiner/issues) and submit pull requests
- **📖 Improve Documentation**: Help improve this README or other documentation
- **💖 Support Development**: [Donate to the developer](https://paypal.me/lvcabral)

## Technology Stack

- **[JavaScript](https://developer.mozilla.org/en-US/docs/Web/JavaScript)**: Core programming language
- **[Electron Framework](https://www.electronjs.org/)**: Cross-platform desktop application framework
- **[React](https://react.dev/)**: User interface library for the settings panel
- **[Roku External Control Protocol (ECP)](https://developer.roku.com/docs/developer-program/dev-tools/external-control-api.md)**: Roku device communication
- **[Android Debug Bridge (ADB)](https://developer.android.com/tools/adb)**: Android device communication
- **[pyatv](https://pyatv.dev/)**: Apple TV device communication via Media Remote Protocol (MRP)

## Acknowledgments

This application was built with inspiration and code from several excellent open-source projects:

- **[floatcam](https://github.com/theterminalguy/floatcam)** by @theterminalguy - Primary foundation for settings interface and video display functionality
- **[FireTVRemote-Node 🔥](https://github.com/ZaneH/firetv-remote/)** by @ZaneH - Reference implementation for ADB remote control of Android devices
- **[Roku GamePad Gateway](https://github.com/lvcabral/roku-gpg)** by @lvcabral - Reference for Roku ECP API integration

## Project Background

<p align="center"><img src="./public/images/codefest-2024.webp" height="125px" alt="Code Fest" />
<img src="./public/images/network-streaming.png" height="125px" alt="Network Streaming" /></p>

**Carabiner** was created during the **Paramount Network Streaming - Code Fest 2024** and was selected as the **winning project**. The name was inspired by the essential tool used by mountain climbers – just as a carabiner connects climbers to their lifeline to reach the top, this app connects developers to their streaming devices.

## Connect with the Developer

- **Website**: [https://lvcabral.com](https://lvcabral.com)
- **Threads**: [@lvcabral](https://www.threads.net/@lvcabral)
- **Bluesky**: [@lvcabral.com](https://bsky.app/profile/lvcabral.com)
- **X/Twitter**: [@lvcabral](https://twitter.com/lvcabral)
- **Podcast**: [PODebug Podcast](http://podebug.com)
- **GitHub**: [More repositories](https://github.com/lvcabral)

## License

Copyright © 2024-2026 Marcelo Lv Cabral. All rights reserved.

Licensed under the [MIT License](LICENSE).
