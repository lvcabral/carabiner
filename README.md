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
  <img src="https://img.shields.io/badge/Fire%20TV-FF9900?style=for-the-badge&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgeG1sbnM6dj0iaHR0cHM6Ly92ZWN0YS5pby9uYW5vIj48cGF0aCBkPSJNMjAuMTk2IDE1LjEyYy4yNjUuMzM3LS4yOTQgMS43My0uNTQyIDIuMzUzLS4wNzcuMTkuMDg1LjI2Ni4yNTcuMTIzIDEuMTA2LS45MjYgMS4zOS0yLjg2NyAxLjE2Ni0zLjE0OS0uMjI2LS4yNzctMi4xNi0uNTE2LTMuMzQxLjMxNC0uMTgzLjEyNy0uMTUxLjMwNC4wNS4yNzkuNjY1LS4wOCAyLjE0Ny0uMjU3IDIuNDEuMDhtLS44NTguOTgxYy0yLjA2NCAxLjUyMy01LjA1NiAyLjMzMy03LjYzMiAyLjMzMy0zLjYxMSAwLTYuODYyLTEuMzM0LTkuMzIyLTMuNTU1LS4xOTQtLjE3Ni0uMDItLjQxNC4yMS0uMjggMi42NTUgMS41NDUgNS45MzkgMi40NzcgOS4zMjggMi40NzcgMi4yODcgMCA0LjgwMy0uNDc2IDcuMTE1LTEuNDU4LjM0OC0uMTQ3LjY0Mi4yMzEuMy40ODNtMi4wMzQtMy4xNTVhLjM4OC4zODggMCAwIDEtLjIwMS0uMDRjLS4wNDEtLjAyNi0uMDg3LS4xLS4xMzMtLjIyNWwtMS43MzQtNC4zNTVhMS43OSAxLjc5IDAgMCAwLS4wNDYtLjExNy4yNjYuMjY2IDAgMCAxLS4wMjMtLjEwOGMwLS4wODQuMDQ5LS4xMjguMTQ2LS4xMjhoLjU4Yy4wOTggMCAuMTY1LjAxNC4yMDUuMDRzLjA4Mi4xMDIuMTI3LjIyNmwxLjM0NCAzLjgyMyAxLjM0My0zLjgyM2MuMDQ2LS4xMjQuMDg5LS4yLjEyOC0uMjI2YS40MDIuNDAyIDAgMCAxIC4yMDUtLjA0aC41NGMuMSAwIC4xNDguMDQ0LjE0OC4xMjhhLjMuMyAwIDAgMS0uMDI1LjEwOGwtLjA0NC4xMTctMS43MjcgNC4zNTVjLS4wNDUuMTI0LS4wOS4xOTktLjEzMi4yMjVhLjM4OC4zODggMCAwIDEtLjIwMS4wNHptLTMuNjQ0LjA2OGMtLjkyOSAwLTEuMzkyLS40NjMtMS4zOTItMS4zOTJWOC43MzloLS43MDZjLS4xMyAwLS4xOTctLjA2Ni0uMTk3LS4xOTZ2LS4yNDZhLjIyLjIyIDAgMCAxIC4wNDUtLjE0N2MuMDMtLjAzMS4wODYtLjA1NS4xNzEtLjA2N2wuNzE3LS4wOS4xMjctMS4yMTVjLjAxMy0uMTMuMDgyLS4xOTYuMjA3LS4xOTZoLjQxYy4xMyAwIC4xOTYuMDY2LjE5Ni4xOTZ2MS4xOTZoMS4yNzZhLjE3LjE3IDAgMCAxIC4xOTUuMTk3di4zNzJhLjE3LjE3IDAgMCAxLS4xOTUuMTk2aC0xLjI3NnYyLjgzNGMwIC4yNDMuMDU1LjQxMS4xNjIuNTFzLjI5My4xNDcuNTU1LjE0N2MuMTI0IDAgLjI3Ny0uMDE2LjQ2LS4wNDlsLjE5Ny0uMDNjLjA1MiAwIC4wODguMDE0LjEwOC4wNDRzLjAyOS4wNzcuMDI5LjE0MnYuMjY2YS4zNjYuMzY2IDAgMCAxLS4wNC4xOWMtLjAyNi4wNDMtLjA3OC4wNzgtLjE1Ny4xMDNhMy4wMTggMy4wMTggMCAwIDEtLjg5Mi4xMThtLTQuNjY1LTIuOTc2Yy4wMDYtLjA1Mi4wMTEtLjEzNy4wMTEtLjI1NSAwLS4zOTktLjA5NC0uNjk4LS4yOC0uOTAxcy0uNDYtLjMwNi0uODE4LS4zMDZjLS40MTIgMC0uNzMyLjEyMy0uOTYyLjM2OXMtLjM2LjYxLS4zOTIgMS4wOTN6bS0uOTQyIDMuMDdjLS44MDMgMC0xLjQxMS0uMjIyLTEuODI0LS42NjdzLS42MTYtMS4xMDItLjYxNi0xLjk3MmMwLS44My4yMDQtMS40NzUuNjE2LTEuOTM3cy45ODgtLjY5MSAxLjcyOC0uNjkxYy42MiAwIDEuMDk4LjE3NiAxLjQzMi41MjRzLjUuODQ2LjUgMS40ODdjMCAuMjEtLjAxNy40MjItLjA1LjYzOC0uMDE0LjA3Ny0uMDM0LjEzLS4wNjQuMTU2cy0uMDc3LjA0LS4xNDIuMDRoLTMuMDhjLjAxMy41NjMuMTU0Ljk3Ny40MTggMS4yNDVzLjY3NC40MDMgMS4yMy40MDNhMy45MyAzLjkzIDAgMCAwIC41NjQtLjA0IDUuMDQgNS4wNCAwIDAgMCAuNjgyLS4xNjZsLjExNy0uMDM1YS4yODQuMjg0IDAgMCAxIC4wOS0uMDE2Yy4wODUgMCAuMTI1LjA2LjEyNS4xNzd2LjI3NmMwIC4wODUtLjAxMi4xNDQtLjAzNy4xOGEuNDQxLjQ0MSAwIDAgMS0uMTY3LjExNCAzLjM4IDMuMzggMCAwIDEtLjcwMS4yMDUgNC4yMzYgNC4yMzYgMCAwIDEtLjgyLjA3OW0tNS40MjQtLjE0N2MtLjEzIDAtLjE5NS0uMDY2LS4xOTUtLjE5N3YtNC41OGEuMTcuMTcgMCAwIDEgLjE5NS0uMTk1aC40MzJjLjA2NCAwIC4xMTYuMDEyLjE1My4wMzlzLjA2LjA3Ni4wNzIuMTQ2bC4wNy41NWMuMTc2LS4xOS4zNDMtLjM0LjQ5OS0uNDUyYTEuNzI1IDEuNzI1IDAgMCAxIDEuMDItLjMyM2wuMjM1LjAxYy4xMTIuMDE0LjE2OC4wNzIuMTY4LjE3NnYuNTNjMCAuMTE3LS4wNTguMTc3LS4xNzguMTc3LS4wNTggMC0uMTE0LS4wMDQtLjE3LS4wMWExLjYzOCAxLjYzOCAwIDAgMC0uMTgtLjAxYy0uNTI0IDAtLjk3My4xNTctMS4zNDYuNDd2My40NzJjMCAuMTMxLS4wNjYuMTk3LS4xOTUuMTk3em0tMi4yNDkgMGMtLjEzIDAtLjE5Ni0uMDY2LS4xOTYtLjE5N3YtNC41OGEuMTcuMTcgMCAwIDEgLjE5Ni0uMTk1aC41NzlhLjE3LjE3IDAgMCAxIC4xOTUuMTk1djQuNThjMCAuMTMxLS4wNjUuMTk3LS4xOTUuMTk3em0uMjk1LTUuODU2Yy0uMTkgMC0uMzM5LS4wNTQtLjQ0Ny0uMTZhLjU4MS41ODEgMCAwIDEtLjE2MS0uNDI4YzAtLjE3Ni4wNTQtLjMxOC4xNi0uNDI2cy4yNTctLjE2My40NDgtLjE2My4zMzcuMDU0LjQ0Ni4xNjMuMTYuMjUuMTYuNDI2YS41ODEuNTgxIDAgMCAxLS4xNi40MjcuNjA4LjYwOCAwIDAgMS0uNDQ2LjE2MW0tMy42MjUgNS44NTZjLS4xMzIgMC0uMTk3LS4wNjYtLjE5Ny0uMTk3di00LjAxSC4xOTVjLS4xMyAwLS4xOTUtLjA2Ni0uMTk1LS4xOTd2LS4yNDVjMC0uMDY1LjAxNC0uMTE0LjA0My0uMTQ3cy4wODgtLjA1NS4xNzMtLjA3bC43MDUtLjA4N3YtLjgwNGMwLTEuMDkxLjUyMy0xLjYzOCAxLjU3LTEuNjM4YTMuMDUgMy4wNSAwIDAgMSAuNzg0LjEwOWMuMDcyLjAxOS4xMjIuMDQ3LjE1Mi4wODhzLjA0NC4xMDcuMDQ0LjIwNXYuMjU1YzAgLjEyNC0uMDQ4LjE4Ni0uMTQ4LjE4Ni0uMDU4IDAtLjE0LS4wMS0uMjQ4LS4wMjlhMi4wNSAyLjA1IDAgMCAwLS4zNjktLjAzYy0uMyAwLS41MS4wNTctLjYzMy4xNzJzLS4xODEuMzAzLS4xODEuNTY0di45MDNoMS4zMjRhLjE3LjE3IDAgMCAxIC4xOTcuMTk1di4zNzNjMCAuMTMtLjA2Ni4xOTctLjE5Ny4xOTdIMS44OTJ2NC4wMWMwIC4xMzEtLjA2NS4xOTctLjE5Ni4xOTd6Ii8+PC9zdmc+&logoColor=white" alt="Fire TV" height="40px" />
  <img src="https://img.shields.io/badge/Google%20TV-4285F4?style=for-the-badge&logo=googleTV&logoColor=white" alt="Google TV" height="40px" />
  <img src="https://img.shields.io/badge/Android%20TV-3DDC84?style=for-the-badge&logo=android&logoColor=black" alt="Android TV" height="40px" />
  <img src="https://img.shields.io/badge/Apple%20TV-1c1c1e?style=for-the-badge&logo=appletv&logoColor=white" alt="Apple TV" height="40px" />
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
