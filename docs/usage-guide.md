# Usage Guide

This guide will help you get started with Carabiner and make the most of its features.

## Getting Started

After installing Carabiner, launch the application to access the settings window. Configure your preferences in the various tabs, then minimize or close the settings window to start using the floating display window.

## Device Setup

### 1. Configure Capture Device

1. Open the **General** tab in settings
2. Select your video capture device from the dropdown
3. Choose appropriate capture resolution from the **Display** tab
4. Enable audio capture if needed

### 2. Add Streaming Devices

1. Navigate to the **Control** tab
2. Enter the device details:
   - **IP Address**: Your device's network IP
   - **Alias**: A friendly name for the device
   - **Type**: Select Roku, Fire TV or Google TV
3. Click "Add Device" to register a new streaming device

### 3. Link Devices

1. Return to the **General** tab
2. Link your capture device with a streaming device
3. This enables seamless control integration

## Control Features

### Keyboard Navigation

When the floating display window is focused, use your keyboard to control the selected device:

- **Arrow Keys**: Navigate menus
- **Enter/Return**: Select items
- **Backspace**: Go back
- **Space**: Play/pause
- **Ctrl+V** (Cmd+V on Mac): Paste clipboard text

See the complete [keyboard control mappings](./key-mappings.md) for advanced controls.

### Screenshots

Capture screenshots of your streaming display:

1. Click the settings button in the top-right corner of the display window
2. Choose from the dropdown menu:
   - **Copy**: Save screenshot to clipboard
   - **Save**: Save screenshot to your specified folder
3. Alternatively, use the keyboard shortcuts:
   - `Ctrl+Shift+C` (Windows/Linux) or `Cmd+Shift+C` (macOS) to copy the screenshot to the clipboard.
   - `Ctrl+S` (Windows/Linux) or `Cmd+S` (macOS) to save the screenshot as a file.

### Video Recording

Record your streaming device sessions (in MP4/WebM) for documentation, tutorials, or debugging:

**Starting a Recording:**

- **Menu Method**: Go to File → Start Recording
- **Keyboard Shortcut**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS)
- **Recording Indicator**: A red pulsing indicator shows when recording is active

**Stopping a Recording:**

- **Menu Method**: Go to File → Stop Recording
- **Keyboard Shortcut**: `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (macOS)
- **Save Location**: Choose save location through system dialog when prompted

**Recording Features:**

- **High Quality**: Records at 2.5 Mbps for crisp video quality
- **Multiple Formats**: Supports MP4 (H.264) and WebM formats automatically
- **Visual Indicator**: Red pulsing indicator shows when recording is active
- **Auto-Naming**: Files are automatically named with timestamp (e.g., `carabiner-recording-2025-07-01-143052.mp4`)
- **Smart Saving**: Choose save location through system dialog

> **💡 Tip**: Recordings capture exactly what you see in the display window, including any overlay images. Perfect for creating tutorials or documenting app behavior!

### Overlay Images

Load reference images for design comparison:

1. Open **Overlay** section in settings
2. Load an image file to overlay on the video
3. Adjust opacity as needed
4. Perfect for achieving pixel-perfect UI designs
5. A list of recent images is available for quick access

## Configuration Options

### Display Customization

- **Transparency**: Adjust window transparency (0-90%)
- **Borders**: Add decorative borders to the display
- **Always on Top**: Keep the display window above all others
- **Display Size**: Choose from preset resolutions or use custom sizing

### System Integration

- **Global Shortcut**: Set a hotkey for quick show/hide the display window
- **Launch on Login**: Start Carabiner automatically with your system
- **Settings at Start**: Control whether settings window opens on launch

### Android Device Configuration

For Android devices, configure the ADB path in settings:

1. Open **Control** tab
2. Set the path to your ADB executable
3. Ensure ADB debugging is enabled on your device
4. Accept authorization prompts when connecting

## Troubleshooting

### Common Issues

#### Device Not Found

- **Check Network Connection**: Ensure your computer and streaming device are on the same network
- **Verify IP Address**: Confirm the device IP address is correct in settings
- **Enable Developer Mode**: For Roku devices, ensure Developer Mode is enabled
- **ADB Authorization**: For Android devices, accept the ADB authorization prompt

#### Video Not Displaying

- **Capture Device**: Verify your capture device is connected and recognized by the system
- **Device Permissions**: Grant camera/microphone access when prompted
- **Resolution Settings**: Try different capture resolutions in settings

#### Controls Not Working

- **Window Focus**: Ensure the display window is focused (clicked)
- **Device Configuration**: Verify device type (Roku/Android) is correctly set
- **Network Access**: On macOS, allow Local Network access in Privacy settings

#### Recording Issues

- **No Video Stream**: Recording requires an active video stream from your capture device
- **Storage Space**: Ensure you have sufficient disk space for recordings
- **Codec Support**: Some older systems may only support WebM format

#### Performance Issues

- **Lower Resolution**: Reduce capture device resolution in settings
- **Close Other Apps**: Free up system resources by closing unnecessary applications
- **Check CPU Usage**: Monitor system performance in Task Manager/Activity Monitor

### Getting Help

If you encounter issues not covered here:

1. Check the [Issues page](https://github.com/lvcabral/carabiner/issues) for known problems
2. Search existing issues or create a new one with detailed information
3. Include your OS version, device type, and steps to reproduce the issue

## Next Steps

- Explore the [keyboard control mappings](./key-mappings.md) for advanced navigation
- Check the [installation guide](./installation.md) for setup assistance
- See the [building from source guide](./building-from-source.md) for development setup
- View the [screenshots gallery](./screenshots.md) to see the application interface
