# Usage Guide

This guide will help you get started with Carabiner and make the most of its features.

## Getting Started

After installing Carabiner, launch the application to access the settings window. Configure your preferences in the various tabs, then minimize or close the settings window to start using the floating display window(s). Carabiner runs as a **single instance** — launching it again brings the running instance forward (the active window, or the settings window when none is enabled).

Carabiner supports **multiple video sources at once**: each capture card or WebRTC stream you enable opens its own floating Display window, linked to its own streaming device. If no capture device is enabled (or none is connected), the settings window always opens at launch so you can configure one.

## Device Setup

Everything device-related lives on the **Devices** tab, in two lists: **Video** (what you watch) and **Control** (what you send remote presses to). Each list has a checklist dialog — **Choose video** and **Choose devices** — where Carabiner shows what it found and you check what you want. Changes apply right away; close the dialog with **Done**.

### 1. Choose Control Devices

1. On the **Devices** tab, click **Choose devices**. Carabiner scans your network for Roku devices and checks which known devices are reachable (green dot).
2. Check the devices you want. **Select all** checks or unchecks them all; **Scan again** repeats the scan.
3. For a device a scan can't find (Fire TV, Google TV, Apple TV, Xumo, or a Roku on another network), click **Add by hand**, pick the **type**, enter its address and an optional name, and click **Add**:
   - **Roku**, **Fire TV**, **Google TV** and **Xumo** use an IP address; **Apple TV** also accepts a UUID or MAC address.
   - **Fire TV / Google TV** need the `adb` tool path, and **Apple TV** the `atvremote` path, set on the **General** tab first.
   - For **Xumo (RDK)** *(experimental)* also set the JSON-RPC **port** (default `9998`) and an optional **token**; **Test** checks the connection.
   - The setup notes for the selected type are shown below the form.
4. Checked devices appear in the **Control** list on the Devices tab. Use **✎** to rename one (leave the name empty to go back to the name the device reports) and the trash icon to remove it from the list (it stays in *Choose devices*, unchecked). To delete a device for good — for example a mistyped address — use **Remove** next to it in *Choose devices*.

> [!NOTE]
> **Roku users — enable ECP first:** Carabiner communicates with Roku devices via the External Control Protocol (ECP). Before adding a Roku device, make sure ECP is enabled:
>
> 1. Press the **Home** button on your Roku remote.
> 2. Go to **Settings > System > Advanced system settings**.
> 3. Select **Control by mobile apps**.
> 4. Set to **Enabled** or **Permissive**.

### 2. Choose Video

Click **Choose video** on the Devices tab. Its groups can be collapsed with the chevron next to each name:

- **This computer** — capture cards and cameras Carabiner detects. Check the ones you want to use.
- **BrightScript Simulators** — a [BrightScript Simulator](https://github.com/lvcabral/brs-desktop) running on this computer with its *remote screen* (WebRTC) enabled shows up automatically. For one on another computer, enter its **host**, **port** (default `8090`) and an optional name; **Test** checks it's reachable and **Add** adds it.
- **[Roku Cloud Emulator](https://developer.roku.com/dev/docs/rce) accounts** — click **Add Cloud Emulator account**, paste a personal access token from the Roku Cloud Emulator portal, give it an optional label, and click **Add account**. All of the account's devices are listed (unchecked) with their running status; check the ones you want. You can add several accounts; each shows as its own group with **Refresh** and **Remove** (removing an account removes its devices and deletes its token). *Advanced* lets you override the management API URL. Tokens are encrypted with your operating system's keychain and are never exposed to the app's windows; only their last 4 characters are shown.
- **Stream URLs** — any **WebRTC (WHEP)** stream: enter its `http(s)` URL and an optional name, then click **Add**.

Checked sources appear in the **Video** list on the Devices tab, each with an icon for its kind (camera, cloud, or computer screen), its status, a **Control** picker, and an **Active** switch. The ↻ button refreshes Cloud Emulator status, simulator detection and device reachability. A stream window shows a *Connecting to stream...* animation while it loads and reconnects automatically if the stream drops.

> [!NOTE]
> **macOS Keychain password prompt:** Carabiner stores the Roku Cloud Emulator access token encrypted with your operating system's secure storage (on macOS, the *Carabiner Safe Storage* item in your Keychain). macOS may therefore ask for your **login (Keychain) password** to let Carabiner read or save that item — this typically happens the first time after installing or upgrading to a new version, because macOS asks again for each new build of the app. Enter your password and choose **Always Allow** so you aren't asked again. If you click *Deny*, the token can't be read or saved and the Cloud Emulator stream won't connect; remove and re-add the account in **Choose video** and allow access. On Windows the token is protected with your user account (no prompt). On Linux a keyring service (GNOME Keyring or KWallet) must be running and unlocked, otherwise Carabiner asks for your permission before storing the token unencrypted (if you decline, the account isn't saved). BrightScript Simulator sources have no credentials and are not affected.

> [!TIP]
> **Control comes with Cloud Emulator and Simulator streams:** Carabiner sends key presses to them over the same connection as their video, so there is nothing to link — their *Control* shows **Included with the stream**, they appear in the Control list's Roku group as **Comes with its video**, and the *Linked Device* menu item is disabled for their windows. Keys, text, screenshots and automation scripts work right away. For a **Cloud Emulator** the keys are sent to the emulated device's ECP through the Cloud Emulator's authenticated instance API (the same way the [roku-deploy](https://github.com/rokucommunity/roku-deploy) tooling does) using the same access token as the stream, so no developer-mode ECP setup is needed on the emulated device; for the **BrightScript Simulator** they are sent to its ECP port (make sure ECP is enabled in the simulator). A **Stream URL** has no control of its own: by default it sends ECP to the stream's host (**Same host as stream**), or you can link any control device.

### 3. Link Control and Activate

For each capture card or Stream URL in the **Video** list, pick a device in its **Control** picker (the chosen control devices, grouped by type; **Choose more devices…** opens the Control dialog). Then turn on its **Active** switch to open its floating Display window.

**Allow multiple active** (in the Video header) sets the window mode:

- **Off** (default, Single Window) — one floating Display window at a time. Activating another source switches that window to it. Best for testing one device at a time.
- **On** (Multiple Windows) — each active source gets its own floating window, so you can watch and control several devices side by side. (Using the same capture card for two windows isn't supported; some cards only allow a single stream.)

The trash icon on a Video row removes the source from the list (it stays in *Choose video*, unchecked).

Per-window appearance (border, transparency, capture resolution, display size, always-on-top, audio) is configured in the **Display** tab using its **Editing Window** selector, which follows the window you last focused. You can also switch/enable windows from the menu bar / macOS **View** menu (see [Managing Windows](#managing-windows)).

## Control Features

### Keyboard Navigation

When a display window is focused, use your keyboard to control the device linked to that window:

- **Arrow Keys**: Navigate menus
- **Enter/Return**: Select items
- **Backspace**: Go back
- **Space**: Play/pause
- **Ctrl+V** (Cmd+V on Mac): Paste clipboard text

See the complete [keyboard control mappings](./key-mappings.md) for advanced controls.

### Managing Windows

You manage windows from the **menu bar / system tray** menu, the macOS **View** menu, and the right-click context menu. What appears depends on the window mode (**Allow multiple active** on the Devices tab); only sources and control devices checked on the Devices tab are listed:

- **Single Window mode** — the capture devices and WebRTC streams are listed **directly on the menu** for quick switching: pick one to switch the single window to it (and its linked control). Streams appear as `<name> (RCE)` or `<name> (Simulator)`; capture cards as `<card> → <linked control>`.
- **Multiple Windows mode** — a **Display Windows** submenu with, per capture device:
  - **Enabled** — open or close that capture device's window (same as its **Active** switch on the Devices tab).
  - **Visible** — show or hide an enabled window without closing it. This is how you bring back a window you previously hid (via the global shortcut or the Close Window command).

Other tips:

- The **global shortcut** (set in the General tab) shows/hides **all** display windows together.
- In **Multiple Windows** mode, the **active window** (the one menu/recording/script actions target) is whichever Display window you last focused. A disabled **"Active Window: …"** item at the top of the app/tray menus shows which window that is; window-specific actions are disabled when no window is enabled. This indicator is hidden in **Single Window** mode, where there is only one window.
- The menus include a **Linked Device** submenu to relink the active window's control device on the fly. Its title shows the currently linked control device; it is disabled for Cloud Emulator and Simulator windows, whose control comes with the stream.
- On macOS, the **Window** menu lists each Display window by its capture card + linked control name (streams by `<name> (RCE|Simulator)`).
- Each window can optionally be a **Regular Window** (title bar, native border, resizable) — see [Display Customization](#display-customization).

#### Automatic capture pausing & reconnection

- **WebRTC streams behave the same way.** A stream window shows a *Connecting to stream...* animation (inside the display border) while it connects, disconnects when the window isn't visible, and reconnects automatically if the stream drops.
- **Capture stops when a window isn't visible.** A Display window only holds its capture device while it's actually on screen. Hiding, minimizing, moving it to another Space, fully covering it with another window, or locking the computer releases the capture device — so the macOS camera/recording indicator turns off and the device is freed (letting the Mac sleep). Capture resumes automatically when the window becomes visible again.
- **Automatic reconnection after sleep.** When your computer wakes and a capture device (e.g. on a monitor's USB hub) takes a few seconds to come back, the window shows a **"reconnecting"** overlay and keeps retrying for about 30 seconds until the device is ready, then resumes streaming on its own. The "no capture device" image only appears if the device never returns.

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

Record your streaming device sessions (in MP4/WebM) for documentation, tutorials, or debugging. Recording is **per window** — each Display window records its own stream to its own file, so you can record several devices at the same time. The menu/keyboard actions apply to the **active** (last focused) window.

**Starting a Recording:**

- **Menu Method**: Go to File → Start Recording (acts on the active window)
- **Keyboard Shortcut**: `Ctrl+Shift+R` (Windows/Linux) or `Cmd+Shift+R` (macOS) — records the focused window
- **Recording Indicator**: A red pulsing indicator shows in each window that is recording
- To record an additional window, focus it and start again — the previous recording keeps running

**Stopping a Recording:**

- **Menu Method**: Go to File → Stop Recording (stops the active window's recording)
- **Keyboard Shortcut**: `Ctrl+Shift+S` (Windows/Linux) or `Cmd+Shift+S` (macOS)
- **Save Location**: Choose save location through system dialog when prompted
- Hiding or closing a recording window stops and saves its recording automatically

**Recording Features:**

- **High Quality**: Records at 2.5 Mbps for crisp video quality (WebRTC streams record at 720p or 1080p, following the window's *Recording Resolution*, at 3.5 / 6 Mbps; the recording keeps a fixed size even if the stream's own quality changes mid-recording)
- **Multiple Formats**: Records in MP4 (H.264) or WebM (VP9/VP8) — choose your preference under **Files → Video Recording Format** (default MP4; if the preferred format isn't supported, Carabiner falls back to the other one). The save dialog only offers the format the recording actually uses, so the file extension always matches its content
- **Visual Indicator**: Red pulsing indicator shows when recording is active
- **Auto-Naming**: Files are automatically named with timestamp (e.g., `carabiner-recording-2025-07-01-143052.mp4`)
- **Smart Saving**: Choose save location through system dialog
- **Interactive Save Notifications**: Click the toast notification after saving to open the containing folder

> **💡 Tip**: Recordings capture what you see in the display window, perfect for creating tutorials or documenting app behavior! After saving, click the toast notification to quickly navigate to your saved file.

### Automation Scripts

The **Automation** tab lets you record key sequences (with the exact timing between keypresses) and replay them on demand. This is useful for repetitive test flows — navigating to a menu, resetting app state, launching a specific screen — that you would otherwise repeat manually every session.

Scripts run on a chosen window. The **Run on Window** selector at the top of the tab picks which Display window recording/playback targets (only enabled windows appear). The script list is **filtered to that window's control protocol** (ECP/ADB/ATV/RDK), and recording is disabled if the selected window has no linked control device.

**Recording a script:**

1. Open the **Automation** tab in settings and choose the target window in **Run on Window**.
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

Load reference images for design comparison. The overlay is **per window** — each Display window has its own overlay image and opacity:

1. Open the **Overlay** tab in settings
2. Pick the target window with the **Display Window** selector at the top (it follows the window you last focused)
3. Load an image file to overlay on that window's video
4. Adjust opacity as needed
5. Perfect for achieving pixel-perfect UI designs
6. A shared list of recent images is available for quick access across all windows

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

3. **Video Recording Format**:
   - Choose **MP4 (H.264)** (default, best compatibility) or **WebM (VP9/VP8)** in the *Video Recording Format* dropdown
   - The choice applies to new recordings and is remembered between sessions
   - Screenshots are saved as PNG or JPEG depending on the extension you pick in the save dialog

4. **Path Management**:
   - Both paths are optional - leaving them empty uses system defaults
   - Custom paths are remembered between application sessions
   - Folders must be accessible and writable for successful saves

> **💡 Tip**: Setting custom default save locations helps organize your captures and ensures they're saved exactly where you want them, eliminating the need to navigate to your preferred folder every time!

## Configuration Options

### Display Customization

These settings are **per window** — pick the window to edit with the **Editing Window** selector at the top of the **Display** tab (it defaults to the active window):

- **Transparency**: Adjust window transparency (0-90%)
- **Borders**: Add decorative borders to the display (not available for a regular window)
- **Regular Window**: Show the window like a normal application window — with a title bar and native border, resizable — instead of the default frameless overlay. Toggling it re-opens the window; the border settings don't apply to a regular window. New windows open 820 pixels wide (16:9) by default
- **Always on Top**: Keep the display window above all others
- **Display Size**: Choose from preset resolutions or use custom sizing
- **Capture Resolution / Audio**: Configure the capture resolution and toggle audio capture for that window (for a WebRTC stream the setting becomes **Recording Resolution**, limited to 720p/1080p, and audio simply un-mutes the stream)

### System Integration

- **Global Shortcut**: Set a hotkey for quick show/hide of all display windows
- **Launch on Login**: Start Carabiner automatically with your system
- **Settings at Start**: Control whether settings window opens on launch
- **Closing the last window (Windows/Linux)**: with the tray icon option off, closing the settings window when no Display window is open quits Carabiner, since nothing would be left to bring it back. With the tray icon on, the app keeps running and the tray restores the windows.

### Android Device Configuration

For Android-based devices (Fire TV, Google TV), configure the ADB path in settings:

1. On the **General** tab, set the path to your **ADB** executable under *ADB Tool Path*
2. Ensure ADB / Wi-Fi debugging is enabled on your device
3. On the **Devices** tab, click **Choose devices** → **Add by hand**, pick **Fire TV** or **Google TV**, enter the IP address and click **Add**
4. Accept the authorization prompt on the device when connecting for the first time

See the [Android / Fire TV setup guide](./setup-android-firetv.md) for detailed instructions.

### Apple TV Configuration

For Apple TV devices, install **pyatv** and pair once before adding the device:

1. Install `atvremote` via pipx — see the [Apple TV setup guide](./setup-apple-tv.md)
2. On the **General** tab, set the **atvremote Tool Path**
3. On the **Devices** tab, click **Choose devices** → **Add by hand** and pick **Apple TV**
4. Enter the Apple TV's **Device ID** (UUID, MAC address or IP) and click **Add**

See the [Apple TV setup guide](./setup-apple-tv.md) for detailed instructions on installing `pyatv` and pairing your Apple TV.

### Xumo Stream Box (RDK) Configuration *(experimental)*

Xumo Stream Box and other RDK-based devices are controlled directly over the RDK Services JSON-RPC API (`org.rdk.RDKShell`) — no extra tool binary is required:

1. On the **Devices** tab, click **Choose devices** → **Add by hand** and choose **Xumo** as the device type
2. Enter the device's **IP address** and the JSON-RPC **port** (default `9998`)
3. If the device requires authentication, enter the Bearer **token**
4. Click **Test** to verify the endpoint is reachable, then **Add** to add the device

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
