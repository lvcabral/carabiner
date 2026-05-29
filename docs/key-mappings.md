# Control Keyboard Mappings

This document provides an overview of the key mappings defined in `ecpKeysMap`, `adbKeysMap` and `atvKeysMap` at the file [render.js](../public/render.js).

- For Google TV and Fire TV setup instructions see the [Android / Fire TV setup guide](./setup-android-firetv.md).
- For Apple TV setup and pairing instructions see the [Apple TV setup guide](./setup-apple-tv.md).

## Key Mappings Table

| Key Combination          | ECP Key Code  | ADB Key Code | ATV Command  | Device Control           |
|--------------------------|---------------|--------------|--------------|--------------------------|
| ArrowUp                  | up            | 19           | up           | D-Pad Up                 |
| ArrowDown                | down          | 20           | down         | D-Pad Down               |
| ArrowLeft                | left          | 21           | left         | D-Pad Left               |
| ArrowRight               | right         | 22           | right        | D-Pad Right              |
| Enter                    | select        | 66           | select       | OK/Select Button         |
| Escape                   | back          | 4            | menu         | Back Button              |
| Delete                   | back          | 4            | menu         | Back Button              |
| Home                     | home          | 3            | home         | Home Button              |
| Shift+Escape             | home          | 3            | home         | Home Button              |
| Control+Escape           | home          | 3            | home         | Home Button              |
| Backspace                | instantreplay | 67           | N/A          | Backspace Action         |
| End                      | play          | 85           | play_pause   | Play/Pause Button        |
| PageUp                   | rev           | 89           | volume_up    | Rewind / Vol Up ²        |
| PageDown                 | fwd           | 90           | volume_down  | Forward / Vol Down ²     |
| Insert                   | info          | 1            | top_menu     | Info/Menu Button         |
| Control+KeyA             | a             | N/A          | N/A          | Game Remote A Button     |
| Control+KeyZ             | b             | N/A          | N/A          | Game Remote B Button     |
| F10                      | volumemute    | 164          | N/A          | Volume Mute Button       |
| Command+Backspace (Mac)  | backspace     | 67           | N/A          | Backspace Action         |
| Command+Enter (Mac)      | play          | 85           | play_pause   | Play/Pause Button        |
| Command+ArrowLeft (Mac)  | rev           | 89           | previous     | Rewind / Previous ²      |
| Command+ArrowRight (Mac) | fwd           | 90           | next         | Forward / Next ²         |
| Command+Digit8 (Mac)     | info          | 1            | N/A          | Info/Menu Button         |
| Control+Backspace (Win)  | backspace     | 67           | N/A          | Backspace Action         |
| Control+Enter (Win)      | play          | 85           | play_pause   | Play/Pause Button        |
| Control+ArrowLeft (Win)  | rev           | 89           | previous     | Rewind / Previous ²      |
| Control+ArrowRight (Win) | fwd           | 90           | next         | Forward / Next ²         |
| Control+Digit8 (Win)     | info          | 1            | N/A          | Info/Menu Button         |

**Notes:**

- ECP and ADB also handles literal keyboard characters (letters, numbers, printable chars) — ATV does not.
- ² The Device Control action differs by protocol: the first label applies to ECP/ADB, the second to ATV.
- N/A means the key has no mapping for that protocol and will be ignored.
