# Setting Up Android / Fire TV / Google TV Control

Carabiner controls Android-based streaming devices (Fire TV, Google TV, Android TV) using **ADB** (Android Debug Bridge) over Wi-Fi.

## Requirements

- ADB installed on your Mac/Windows/Linux machine
- Your device on the same local network
- Wi-Fi ADB enabled on the device (one-time setup)

---

## 1. Install ADB

### macOS
```bash
brew install android-platform-tools
which adb   # note this path for Carabiner
```

### Windows
Download the [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools) ZIP, extract it, and note the path to `adb.exe`.

### Linux
```bash
sudo apt install adb       # Debian/Ubuntu
which adb
```

---

## 2. Enable Wi-Fi Debugging on Your Device

### Fire TV / Fire TV Stick
1. Go to **Settings → My Fire TV → Developer Options**.
2. Enable **ADB Debugging**.
3. Enable **Apps from Unknown Sources** (optional, for sideloading).
4. Note your device's IP: **Settings → My Fire TV → About → Network**.

### Google TV / Android TV
1. Go to **Settings → System → About**.
2. Press the **Build** entry 7 times to enable Developer Options.
3. Go to **Settings → System → Developer Options**.
4. Enable **USB Debugging** (required) and **ADB over network** or **Wireless debugging**.
5. Note your device's IP address from the network settings.

---

## 3. Connect via ADB

```bash
adb connect <device-ip>:5555
adb devices   # should list your device as "connected"
```

---

## 4. Configure Carabiner

1. Open the **Control** tab in Carabiner settings.
2. Click **…** next to **ADB Tool Path** and select your `adb` binary.
3. Enter the device's IP address and choose **Fire TV** or **Google TV**.
4. Click **+** to add the device.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Device shows as `offline` | Run `adb disconnect` then `adb connect <ip>:5555` |
| Connection refused | Confirm ADB over network is enabled on device; try port `5555` explicitly |
| `unauthorized` status | Accept the ADB authorization dialog on your device's screen |
| Keys not working | Make sure the device is selected in the tray Control Device menu |
