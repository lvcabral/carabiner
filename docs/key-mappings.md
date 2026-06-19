# Control Keyboard Mappings

This document provides an overview of the key mappings defined in `ecpKeysMap`, `adbKeysMap`, `atvKeysMap` and `rdkKeysMap` at the file [render.js](../public/render.js).

- For Google TV and Fire TV setup instructions see the [Android / Fire TV setup guide](./setup-android-firetv.md).
- For Apple TV setup and pairing instructions see the [Apple TV setup guide](./setup-apple-tv.md).
- RDK key codes are Linux input event codes injected via `org.rdk.RDKShell` (Xumo Stream Box / RDK devices, experimental).

## Key Mappings Table

| Key Combination          | ECP Key Code  | ADB Key Code | ATV Command  | RDK Key Code | Device Control           |
|--------------------------|---------------|--------------|--------------|--------------|--------------------------|
| ArrowUp                  | up            | 19           | up           | 103          | D-Pad Up                 |
| ArrowDown                | down          | 20           | down         | 108          | D-Pad Down               |
| ArrowLeft                | left          | 21           | left         | 105          | D-Pad Left               |
| ArrowRight               | right         | 22           | right        | 106          | D-Pad Right              |
| Enter                    | select        | 66           | select       | 28           | OK/Select Button         |
| Escape                   | back          | 4            | menu         | 158          | Back Button              |
| Delete                   | back          | 4            | menu         | 158          | Back Button              |
| Home                     | home          | 3            | home         | 102          | Home Button              |
| Shift+Escape             | home          | 3            | home         | 102          | Home Button              |
| Control+Escape           | home          | 3            | home         | 102          | Home Button              |
| Backspace                | instantreplay | 67           | N/A          | 14           | Backspace Action ³       |
| End                      | play          | 85           | play_pause   | 164          | Play/Pause Button        |
| PageUp                   | rev           | 89           | volume_up    | 168          | Rewind / Vol Up ²        |
| PageDown                 | fwd           | 90           | volume_down  | 208          | Forward / Vol Down ²     |
| Insert                   | info          | 1            | top_menu     | 139          | Info/Menu Button         |
| Control+KeyA             | a             | N/A          | N/A          | N/A          | Game Remote A Button     |
| Control+KeyZ             | b             | N/A          | N/A          | N/A          | Game Remote B Button     |
| F10                      | volumemute    | 164          | N/A          | 113          | Volume Mute Button       |
| Command+Backspace (Mac)  | backspace     | 67           | N/A          | N/A          | Backspace Action         |
| Command+Enter (Mac)      | play          | 85           | play_pause   | 164          | Play/Pause Button        |
| Command+ArrowLeft (Mac)  | rev           | 89           | previous     | 168          | Rewind / Previous ²      |
| Command+ArrowRight (Mac) | fwd           | 90           | next         | 208          | Forward / Next ²         |
| Command+Digit8 (Mac)     | info          | 1            | N/A          | N/A          | Info/Menu Button         |
| Control+Backspace (Win)  | backspace     | 67           | N/A          | N/A          | Backspace Action         |
| Control+Enter (Win)      | play          | 85           | play_pause   | 164          | Play/Pause Button        |
| Control+ArrowLeft (Win)  | rev           | 89           | previous     | 168          | Rewind / Previous ²      |
| Control+ArrowRight (Win) | fwd           | 90           | next         | 208          | Forward / Next ²         |
| Control+Digit8 (Win)     | info          | 1            | N/A          | N/A          | Info/Menu Button         |

**Notes:**

- Carabiner also handles literal keyboard characters (letters, numbers, printable chars). On RDK, digit keys `0`–`9` map to their input keycodes (`11` for `0`, `2`–`10` for `1`–`9`).
- ² The Device Control action differs by protocol: the first label applies to ECP/ADB/RDK, the second to ATV.
- ³ On RDK the plain `Backspace` key maps to keycode `14` (Backspace); the `Cmd/Ctrl+Backspace` combos have no RDK mapping.
- N/A means the key has no mapping for that protocol and will be ignored.
