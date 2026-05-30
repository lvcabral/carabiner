# Installation Guide

This guide will help you install and set up Carabiner on your system.

## Download

Carabiner is available for macOS, Windows, and Linux. Download the latest installer from the [releases page](https://github.com/lvcabral/carabiner/releases).

## System Requirements

- **Operating System**: macOS 10.14+, Windows 10+, or Linux (Ubuntu 18.04+)
- **Capture Devices**: Video capture device (USB capture card, webcam, etc.)
- **Streaming Devices**: Roku, Android-based devices (Fire TV, Google TV, Android TV), Apple TV

## Setup Prerequisites

### For All Devices

1. **Video Capture Device**: Connect your capture card to the streaming device and your computer
2. **Camera/Microphone Access**: Grant permission when prompted on first launch

### For Roku Devices

1. **Developer Mode**: Enable Developer Mode on your Roku device
   - See the [official Roku guide](https://developer.roku.com/docs/developer-program/getting-started/developer-setup.md)
2. **Enable ECP**: The External Control Protocol (ECP) is used to control Roku devices, and
   recent OS versions requires enabling ECP in settings, these are steps to enable ECP:
   - Press the **Home** button on your Roku remote.
   - Go to **Settings > System > Advanced system settings**.
   - Select **Control by mobile apps**.
   - Set it to **Enabled** or **Permissive**.

### For Android Devices (Fire TV, Google TV, Android TV)

1. **ADB Debugging**: Enable ADB debugging on your device
   - See the [Android debugging guide](https://developer.android.com/studio/command-line/adb)
2. **ADB Tools**: Install Android Platform Tools
   - Follow the instructions in the [Android setup guide](./setup-android-firetv.md) to install ADB and connect your device
   - Configure the ADB path in Carabiner settings
3. **Device Authorization**: Accept the connection prompt when first connecting

### For Apple TV

1. **pyatv Setup**: Install `pyatv` for Apple TV control
   - Follow the Setup instructions in the [Apple TV guide](./setup-apple-tv.md) to install `pyatv` and pair with your Apple TV device
   - Configure the `pyatv` path in Carabiner settings
2. **Allow AirPlay Access**: Ensure AirPlay is enabled on your Apple TV for control to work properly:
   - Go to `Settings` > `AirPlay & Apple Home`
   - Expand `Allow Access` and pick `Anyone on the Same Network`

## Installation Steps

### macOS

1. Download the `.dmg` file from the releases page
2. Open the downloaded file
3. Drag Carabiner to your Applications folder
4. Launch Carabiner from Applications
5. Allow the app to run if prompted by macOS security settings

### Windows

1. Download the `.exe` installer from the releases page
2. Run the installer as administrator if needed
3. Follow the installation wizard
4. Launch Carabiner from the Start Menu or Desktop shortcut
5. Allow the app through Windows Defender if prompted

### Linux

1. Download the appropriate package for your distribution (`.deb` or `.rpm`)
2. Install using your package manager:
   - **Ubuntu/Debian**: `sudo dpkg -i carabiner_*.deb`
   - **Red Hat/Fedora**: `sudo rpm -i carabiner_*.rpm`
3. Launch Carabiner from your applications menu

## Important Security Notes

- **⚠️ Platform Security**: On Windows and Linux, you may need to approve the app in your security settings. Only macOS builds are currently code-signed.
- **🔒 macOS Network Access**: Allow Local Network access, when prompted, or configure it in `System Settings > Privacy & Security > Local Network` for device control to work properly.

## Getting Help

If you encounter installation issues:

1. Check the [Issues page](https://github.com/lvcabral/carabiner/issues) for known problems
2. Create a new issue with:
   - Your operating system and version
   - Error messages (if any)
   - Steps you've tried

## Next Steps

After successful installation, see the [Usage Guide](./usage-guide.md) to learn how to configure and use Carabiner, or view the [Screenshots](./screenshots.md) to see the application interface.
