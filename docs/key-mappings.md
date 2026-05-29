# Control Keyboard Mappings

This document provides an overview of the key mappings defined in `ecpKeysMap`, `adbKeysMap` and `atvKeysMap` at the file [render.js](../public/render.js).

## Roku ECP and ADB (Fire TV / Google TV)

The following table lists the key mappings for Roku ECP (External Control Protocol) and ADB (Android Debug Bridge):

| Key Combination          | ECP Key Code  | ADB Key Code | Device Control       |
|--------------------------|---------------|--------------|----------------------|
| ArrowUp                  | up            | 19           | D-Pad Up             |
| ArrowDown                | down          | 20           | D-Pad Down           |
| ArrowLeft                | left          | 21           | D-Pad Left           |
| ArrowRight               | right         | 22           | D-Pad Right          |
| Enter                    | select        | 66           | OK/Select Button     |
| Escape or Delete         | back          | 4            | Back Button          |
| Home                     | home          | 3            | Home Button          |
| Shift+Escape             | home          | 3            | Home Button          |
| Control+Escape           | home          | 3            | Home Button          |
| Backspace                | instantreplay | 67           | Backspace Action     |
| End                      | play          | 85           | Play/Pause Button    |
| PageUp                   | rev           | 89           | Rewind Button        |
| PageDown                 | fwd           | 90           | Forward Button       |
| Insert                   | info          | 1            | Info/Menu Button     |
| Control+KeyA             | a             | N/A          | Game Remote A Button |
| Control+KeyZ             | b             | N/A          | Game Remote B Button |
| F10                      | volumemute    | 164          | Volume Mute Button   |
| Command+Backspace (Mac)  | backspace     | 67           | Backspace Action     |
| Command+Enter (Mac)      | play          | 85           | Play/Pause Button    |
| Command+ArrowLeft (Mac)  | rev           | 89           | Rewind Button        |
| Command+ArrowRight (Mac) | fwd           | 90           | Forward Button       |
| Command+Digit8 (Mac)     | info          | 1            | Info/Menu Button     |
| Control+Backspace (Win)  | backspace     | 67           | Backspace Action     |
| Control+Enter (Win)      | play          | 85           | Play/Pause Button    |
| Control+ArrowLeft (Win)  | rev           | 89           | Rewind Button        |
| Control+ArrowRight (Win) | fwd           | 90           | Forward Button       |
| Control+Digit8 (Win)     | info          | 1            | Info/Menu Button     |

**Note**: The code also handles literal keyboard characters (letters, numbers and printable chars) for Roku ECP.

---

## Apple TV (pyatv / atvremote)

The following table lists the key mappings for Apple TV devices controlled via [pyatv](https://pyatv.dev/). See the [Apple TV setup guide](./setup-apple-tv.md) for installation and pairing instructions.

| Key Combination          | pyatv Command | Apple TV Action     |
|--------------------------|---------------|---------------------|
| ArrowUp                  | up            | D-Pad Up            |
| ArrowDown                | down          | D-Pad Down          |
| ArrowLeft                | left          | D-Pad Left          |
| ArrowRight               | right         | D-Pad Right         |
| Enter                    | select        | OK / Select         |
| Escape                   | menu          | Back / Menu         |
| Delete                   | menu          | Back / Menu         |
| Home                     | home          | Home Screen         |
| Shift+Escape             | home          | Home Screen         |
| Control+Escape           | home          | Home Screen         |
| End                      | play_pause    | Play / Pause        |
| PageUp                   | volume_up     | Volume Up           |
| PageDown                 | volume_down   | Volume Down         |
| Insert                   | top_menu      | Top Menu            |
| Command+Enter (Mac)      | play_pause    | Play / Pause        |
| Command+ArrowLeft (Mac)  | previous      | Previous            |
| Command+ArrowRight (Mac) | next          | Next                |
| Control+Enter (Win)      | play_pause    | Play / Pause        |
| Control+ArrowLeft (Win)  | previous      | Previous            |
| Control+ArrowRight (Win) | next          | Next                |
