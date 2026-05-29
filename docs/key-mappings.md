# Control Keyboard Mappings

This document provides an overview of the key mappings defined in `ecpKeysMap`, `adbKeysMap` and `atvKeysMap` at the file [render.js](../public/render.js).

For Apple TV setup and pairing instructions see the [Apple TV setup guide](./setup-apple-tv.md).

## Key Mappings Table

| Key Combination          | ECP Key Code  | ADB Key Code | ATV Command  |
|--------------------------|---------------|--------------|--------------|
| ArrowUp                  | up            | 19           | up           |
| ArrowDown                | down          | 20           | down         |
| ArrowLeft                | left          | 21           | left         |
| ArrowRight               | right         | 22           | right        |
| Enter                    | select        | 66           | select       |
| Escape                   | back          | 4            | menu         |
| Delete                   | back          | 4            | menu         |
| Home                     | home          | 3            | home         |
| Shift+Escape             | home          | 3            | home         |
| Control+Escape           | home          | 3            | home         |
| Backspace                | instantreplay | 67           | N/A          |
| End                      | play          | 85           | play_pause   |
| PageUp                   | rev           | 89           | volume_up    |
| PageDown                 | fwd           | 90           | volume_down  |
| Insert                   | info          | 1            | top_menu     |
| Control+KeyA             | a             | N/A          | N/A          |
| Control+KeyZ             | b             | N/A          | N/A          |
| F10                      | volumemute    | 164          | N/A          |
| Command+Backspace (Mac)  | backspace     | 67           | N/A          |
| Command+Enter (Mac)      | play          | 85           | play_pause   |
| Command+ArrowLeft (Mac)  | rev           | 89           | previous     |
| Command+ArrowRight (Mac) | fwd           | 90           | next         |
| Command+Digit8 (Mac)     | info          | 1            | N/A          |
| Control+Backspace (Win)  | backspace     | 67           | N/A          |
| Control+Enter (Win)      | play          | 85           | play_pause   |
| Control+ArrowLeft (Win)  | rev           | 89           | previous     |
| Control+ArrowRight (Win) | fwd           | 90           | next         |
| Control+Digit8 (Win)     | info          | 1            | N/A          |

**Notes:**
- ECP also handles literal keyboard characters (letters, numbers, printable chars) sent as `lit_<char>` — ADB and ATV do not.
- **PageUp / PageDown** map to Rewind/Forward on Roku and Android, but to **Volume Up / Volume Down** on Apple TV.
- **Command/Control + ArrowLeft/Right** maps to Rewind/Forward on Roku and Android, but to **Previous / Next** on Apple TV.
- N/A means the key has no mapping for that protocol and will be ignored.
