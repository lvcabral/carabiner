# Control Keyboard Mappings

This document provides an overview of the key mappings defined in `ecpKeysMap` and `adbKeysMap` at the file [render.js](../public/render.js).

## Key Mappings Table

The following table lists the key mappings for both Roku ECP (External Control Protocol) and ADB (Android Debug Bridge):

| Key Combination         | ECP Key Code  | ADB Key Code | Device Control       |
|-------------------------|---------------|--------------|----------------------|
| ArrowUp                 | up            | 19           | D-Pad Up             |
| ArrowDown               | down          | 20           | D-Pad Down           |
| ArrowLeft               | left          | 21           | D-Pad Left           |
| ArrowRight              | right         | 22           | D-Pad Right          |
| Enter                   | select        | 66           | OK/Select Button     |
| Escape or Delete        | back          | 4            | Back Button          |
| Delete                  | back          | 4            | Back Button          |
| Home                    | home          | 3            | Home Button          |
| Shift+Escape            | home          | 3            | Home Button          |
| Control+Escape          | home          | 3            | Home Button          |
| Backspace               | instantreplay | 67           | Backspace Action     |
| End                     | play          | 85           | Play/Pause Button    |
| PageDown                | rev           | 89           | Rewind Button        |
| PageUp                  | fwd           | 90           | Forward Button       |
| Insert                  | info          | 1            | Info/Menu Button     |
| Control+KeyA            | a             | N/A          | Game Remote A Button |
| Control+KeyZ            | b             | N/A          | Game Remote B Button |
| F10                     | volumemute    | 164          | Volume Mute Button   |
| Command+Backspace (Mac) | backspace     | 67           | Backspace Action     |
| Command+Enter (Mac)     | play          | 85           | Play/Pause Button    |
| Command+ArrowLeft (Mac) | rev           | 89           | Rewind Button        |
| Command+ArrowRight (Mac)| fwd           | 90           | Forward Button       |
| Command+Digit8 (Mac)    | info          | 1            | Info/Menu Button     |
| Control+Backspace (Win) | backspace     | 67           | Backspace Action     |
| Control+Enter (Win)     | play          | 85           | Play/Pause Button    |
| Control+ArrowLeft (Win) | rev           | 89           | Rewind Button        |
| Control+ArrowRight (Win)| fwd           | 90           | Forward Button       |
| Control+Digit8 (Win)    | info          | 1            | Info/Menu Button     |

**Note**: The code also handles literal keyboard characters (letters, numbers and printable chars).
