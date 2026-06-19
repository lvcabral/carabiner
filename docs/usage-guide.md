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
2. Select the device **Type** from the dropdown — the fields below adapt to the type you pick:
   - **Roku (ECP)**, **Fire TV (ADB)**, **Google TV (ADB)**, **Apple TV (atvremote)**, or **Xumo (RDK)** *(experimental)*
3. Enter the device details:
   - **IP Address / Device ID**: IP for Roku, Fire TV, Google TV, and Xumo; UUID or MAC address for Apple TV
   - **Alias**: A friendly name for the device
   - For **Roku (ECP)** you can click the **🔍 search** button next to the IP field to discover devices automatically
   - For **Xumo (RDK)** also set the **RDK JSON-RPC** port (default `9998`) and an optional auth **token**; use the **Test** button to verify the connection
4. Click **+** to register the device

> [!NOTE]
> **Roku users — enable ECP first:** Carabiner communicates with Roku devices via the External Control Protocol (ECP). Before adding a Roku device, make sure ECP is enabled:
>
> 1. Press the **Home** button on your Roku remote.
> 2. Go to **Settings > System > Advanced system settings**.
> 3. Select **Control by mobile apps**.
> 4. Set to **Enabled** or **Permissive**.

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

**Interactive Save Notifications:**

- After saving a screenshot, a toast notification appears showing the filename
- **Click the toast notification** to instantly open the containing folder
- The notification includes the text "Click to open containing folder" for guidance

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
- **Interactive Save Notifications**: Click the toast notification after saving to open the containing folder

> **💡 Tip**: Recordings capture what you see in the display window, perfect for creating tutorials or documenting app behavior! After saving, click the toast notification to quickly navigate to your saved file.

### Automation Scripts

The **Automation** tab lets you record key sequences (with the exact timing between keypresses) and replay them on demand. This is useful for repetitive test flows — navigating to a menu, resetting app state, launching a specific screen — that you would otherwise repeat manually every session.

**Recording a script:**

1. Open the **Automation** tab in settings.
2. Click **Start Recording** (or press `Cmd+Shift+A` on macOS / `Ctrl+Shift+A` on Windows/Linux).
3. Switch focus to the display window and press the keys you want to record. Each keypress is captured along with the delay since the previous key. A **pulsing blue dot** appears in the top-left of the display window while recording is in progress.
4. Press **Stop Recording** (or `Cmd+Shift+Z` / `Ctrl+Shift+Z`) when done. The script is saved automatically.

**Playing back a script:**

- Click the **▶** button next to any script in the list, or
- Use the **File → Run Script** submenu (also available in the tray and right-click context menu).
- While a script runs, a **pulsing green ▶** appears in the top-left of the display window, and the **Run Script** menu is disabled so you can't start a second script over a running one.
- Stop playback by clicking the **■** button in the Automation tab, or by choosing **Stop Script** from the File menu, tray, or right-click context menu. The tab's **▶** button automatically switches to **■** whenever a script is running — even when it was started from a menu.

> **💡 Tip**: The top-left indicators share a single anchor and line up side by side — for example, recording a video (red dot) while running a script (green ▶) shows both at once.

**Editing a script:**

- **Rename**: Click the **✎** (pencil) button and type a new name.
- **Edit steps**: Click the **≡** button to expand the step editor. From there you can:
  - Change the delay before any step (in milliseconds, 0–5000).
  - Reorder steps with **↑** / **↓**.
  - Remove individual steps with **✕**.
- Click **Save Changes** to apply edits or **Cancel** to revert.
- Click **🗑** to delete a script entirely.

> **Note:** Scripts are tied to the protocol of the device that was active when they were recorded (ECP for Roku, ADB for Android, atvremote for Apple TV, RDK for Xumo). Playing a script on a device with a different protocol will show a warning toast, but playback will still proceed.

### AI Automation (MCP Server)

Carabiner can expose its device control, automation, and capture features to AI assistants through
an embedded **MCP server** (enable it in the **Settings → MCP** tab). An agent such as
Claude Code can then navigate your app, run scripts, capture screenshots, and validate UI state —
and you can schedule recurring QA runs externally. See the **[MCP Server guide](./mcp-server.md)**
for setup and examples.

### Overlay Images

Load reference images for design comparison:

1. Open **Overlay** section in settings
2. Load an image file to overlay on the video
3. Adjust opacity as needed
4. Perfect for achieving pixel-perfect UI designs
5. A list of recent images is available for quick access

### File Management

The **Files** tab in settings allows you to configure default save locations for your captured content:

#### Default Save Locations

1. **Screenshot Path Configuration**:
   - Set a custom default folder for saving screenshots
   - If no custom path is set, screenshots save to the Pictures folder
   - Use the "⋯" button to browse and select a folder
   - Use the "↺" button to reset to default location

2. **Video Recording Path Configuration**:
   - Set a custom default folder for saving video recordings
   - If no custom path is set, recordings save to the Movies folder (macOS) or Videos folder (Windows/Linux)
   - Use the "⋯" button to browse and select a folder
   - Use the "↺" button to reset to default location

3. **Path Management**:
   - Both paths are optional - leaving them empty uses system defaults
   - Custom paths are remembered between application sessions
   - Folders must be accessible and writable for successful saves

> **💡 Tip**: Setting custom default save locations helps organize your captures and ensures they're saved exactly where you want them, eliminating the need to navigate to your preferred folder every time!

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

For Android-based devices (Fire TV, Google TV), configure the ADB path in settings:

1. Open the **Control** tab
2. Set the path to your **ADB** executable under *ADB Tool Path*
3. Ensure ADB / Wi-Fi debugging is enabled on your device
4. Accept the authorization prompt on the device when connecting for the first time

See the [Android / Fire TV setup guide](./setup-android-firetv.md) for detailed instructions.

### Apple TV Configuration

For Apple TV devices, install **pyatv** and pair once before adding the device:

1. Install `atvremote` via pipx — see the [Apple TV setup guide](./setup-apple-tv.md)
2. Open the **Control** tab and set the **atvremote Tool Path**
3. Enter the Apple TV's **Device ID** (UUID or MAC address) and select **Apple TV**
4. Click **+** to add the device

See the [Apple TV setup guide](./setup-apple-tv.md) for detailed instructions on installing `pyatv` and pairing your Apple TV.

### Xumo Stream Box (RDK) Configuration *(experimental)*

Xumo Stream Box and other RDK-based devices are controlled directly over the RDK Services JSON-RPC API (`org.rdk.RDKShell`) — no extra tool binary is required:

1. Open the **Control** tab and choose **Xumo (RDK)** as the device type
2. Enter the device's **IP address** and the **RDK JSON-RPC** port (default `9998`)
3. If the device requires authentication, enter the Bearer **token**
4. Click **Test** to verify the endpoint is reachable, then **+** to add the device

> [!NOTE]
> RDK support is **experimental**. The device must have the `org.rdk.RDKShell` plugin enabled and its JSON-RPC endpoint reachable from your computer. Text input is sent as individual injected keystrokes.

## Getting Help

If you encounter issues not covered here:

1. Check the [Issues page](https://github.com/lvcabral/carabiner/issues) for known problems
2. Search existing issues or create a new one with detailed information
3. Include your OS version, device type, and steps to reproduce the issue

## Next Steps

- Explore the [keyboard control mappings](./key-mappings.md) for advanced navigation
- Check the [installation guide](./installation.md) for setup assistance
- See the [building from source guide](./building-from-source.md) for development setup
- View the [screenshots gallery](./screenshots.md) to see the application interface
