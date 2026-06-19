# MCP Server

Carabiner can expose its device-control, automation, and capture features to AI assistants through
an embedded [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) server. This turns
Carabiner into an **AI-native QA tool**: an agent (Claude Code, Claude Desktop, Cursor, etc.) can
navigate a Roku / Fire TV / Apple TV / Xumo Stream Box (RDK) app, capture screenshots, run
automation scripts, and validate UI state without a human in the loop.

The server runs inside Carabiner's main process and **binds only to `127.0.0.1`** — it is never
exposed to the network.

## Enabling the server

1. Open **Settings → MCP**.
2. Toggle **Enable**.
3. Optionally change the **Port** (default `7734`) and set an **Auth Token**.
   - The port and token are only editable while the server is stopped.
4. The status line shows `Running — connect MCP clients to http://localhost:7734/mcp` when active.

The server starts and stops live with the toggle (no app restart needed) and its enabled state is
persisted in `settings.json`, so it comes back automatically on the next launch.

## Transports

Two transports are served simultaneously:

| Endpoint | Transport | Use with |
|----------|-----------|----------|
| `http://localhost:<port>/mcp` | Streamable HTTP (recommended) | Claude Code, modern MCP clients |
| `http://localhost:<port>/sse` | HTTP + SSE (legacy) | Older Claude Desktop / Cursor builds |

## Authentication

By default (empty token) the server accepts any local connection. If you set an **Auth Token**,
every request must include it as a Bearer header:

```
Authorization: Bearer <your-token>
```

Requests without the matching header receive `401 Unauthorized`.

## Connecting from Claude Code

Add an `.mcp.json` file to your project (or use `claude mcp add`):

```json
{
  "mcpServers": {
    "carabiner": {
      "type": "http",
      "url": "http://localhost:7734/mcp"
    }
  }
}
```

If you configured an auth token, add a header:

```json
{
  "mcpServers": {
    "carabiner": {
      "type": "http",
      "url": "http://localhost:7734/mcp",
      "headers": { "Authorization": "Bearer your-token" }
    }
  }
}
```

For a client that only supports SSE, use `"url": "http://localhost:7734/sse"` and drop the `type`
field.

## Tool reference

### Device control
| Tool | Description |
|------|-------------|
| `list_devices` | All configured control devices with protocol and connection status |
| `select_device` | Switch the active device by id (`<ip>\|ecp`, `<ip>\|adb`, `<uuid-or-mac>\|atv`, `<host:port>\|rdk`) |
| `send_key` | Send one keypress (see [Keys](#keys)) |
| `send_text` | Type a string on the current device |
| `get_current_device` | Protocol, address, and connection state of the active device |
| `launch_app` | Launch an application by client name (and optional URI). **RDK (Xumo) only** — uses `RDKShell.launchApplication` |

### Capture & recording
| Tool | Description |
|------|-------------|
| `list_capture_devices` | Available HDMI capture cards |
| `select_capture_device` | Switch the active capture source |
| `take_screenshot` | Capture the current frame; returns a PNG image and (by default) saves it to the screenshots folder |
| `start_recording` | Begin recording (optional `filename_prefix`) |
| `stop_recording` | Stop recording, save to the recordings folder, return the file path |

### Automation scripts
| Tool | Description |
|------|-------------|
| `list_scripts` | All saved scripts (id, name, controlType, step count) |
| `run_script` | Run a script by id; **blocks until it completes or is cancelled** |
| `stop_script` | Cancel the running script |
| `create_script` | Create a script from a steps array |
| `delete_script` | Remove a script by id |

### Display & app state
| Tool | Description |
|------|-------------|
| `show_display` / `hide_display` | Show or hide the floating display window |
| `toggle_fullscreen` | Toggle fullscreen |
| `toggle_on_top` | Toggle always-on-top |
| `get_settings` | Read-only settings snapshot (auth token redacted) |
| `get_app_info` | App version, OS, and MCP server status |

### Resources
| URI | Description |
|-----|-------------|
| `carabiner://devices` | Device list + selected device |
| `carabiner://scripts` | All saved scripts |
| `carabiner://settings` | Settings snapshot (token redacted) |
| `carabiner://screenshot/latest` | Current frame as a PNG |

### Prompts
| Prompt | Description |
|--------|-------------|
| `qa_navigation_test` | Guided home → content → playback → back navigation test with screenshots |
| `record_script_from_description` | Turn a natural-language workflow into a `create_script` steps array |

### Keys

`send_key` accepts friendly, protocol-agnostic names that are translated to each device's native
key: `up`, `down`, `left`, `right`, `select`/`ok`, `back`, `home`, `play`/`pause`, `rewind`,
`forward`, `replay`, `info`/`options`, `volume_up`, `volume_down`, `volume_mute`. You may also pass
a raw protocol-native key (a Roku ECP command such as `search`, an ADB keycode, an Apple TV command,
or an RDK Linux input keycode such as `28`) and it will be forwarded as-is. Keys not available on the
active protocol return an error (e.g. `replay` is ECP-only, `volume_up`/`volume_down` are not on ECP).

## Driving QA test cases with an AI agent

Once connected, describe the test in natural language and let the agent orchestrate the tools. For
example, from Claude Code:

```
Using the carabiner MCP server: select my Roku device, go home, open Search,
type "stranger things", take a screenshot, and tell me whether results appeared.
```

The agent will chain calls such as:

```
select_device("192.168.1.50|ecp")
send_key("home")
send_key("search")        # or the raw ECP command if your app uses a custom search entry
send_text("stranger things")
take_screenshot()         # image returned to the agent for visual inspection
```

A repeatable regression can be captured once and replayed deterministically:

```
create_script({ controlType: "ecp", steps: [
  { key: "home",   mod: -1, delay: 0 },
  { key: "down",   mod: -1, delay: 800 },
  { key: "select", mod: -1, delay: 1500 },
  { key: "play",   mod: -1, delay: 2000 }
]})
run_script("<id>")        # blocks until done
take_screenshot()
```

> Step `mod` values follow Carabiner's automation format: `-1` = full keypress (ECP), `0` = press
> for ADB/ATV/RDK, `100` = key-up. `create_script` accepts a `controlType` of `ecp`, `adb`, `atv`,
> or `rdk`. `delay` is milliseconds to wait *before* the step.

## Scheduling test runs externally

Carabiner has no built-in scheduler — scheduling is handled **outside** the app by an AI agent so
you can use the full power of natural-language test definitions. The recommended pattern is Claude
Code in non-interactive mode (`claude -p`) triggered by your OS scheduler.

### 1. Write the test as a prompt

Save a reusable instruction file, e.g. `nightly-regression.md`:

```
Connect to the carabiner MCP server.
1. select_device for the Roku under test and start_recording with filename_prefix "nightly".
2. run_script "<smoke-test-id>".
3. take_screenshot after the script completes.
4. stop_recording and report the saved video path.
5. Summarize PASS/FAIL with anything unexpected you saw in the screenshots.
```

### 2. Schedule it

**macOS / Linux (cron)** — run every night at 02:00:

```cron
0 2 * * * cd /path/to/project && claude -p "$(cat nightly-regression.md)" >> ~/carabiner-nightly.log 2>&1
```

**macOS (launchd)** or **Windows (Task Scheduler)** work the same way — point the scheduled action at
`claude -p` with the prompt file. On Windows:

```bat
claude -p "%CD%\nightly-regression.md content here" >> carabiner-nightly.log 2>&1
```

> Make sure Carabiner is running with the MCP server enabled (and the capture device streaming) at
> the scheduled time — e.g. enable **Launch at Login** in Settings → General.

### 3. Or loop within Claude Code

For ad-hoc repeated runs during a test session, use Claude Code's `/loop`:

```
/loop 30m run nightly-regression.md against the carabiner MCP server
```

This re-runs the same QA task every 30 minutes without any external scheduler.

## Troubleshooting

- **`take_screenshot` / recording errors with "No active video stream"** — select a capture device
  first (the display window must be streaming). Use `select_capture_device` or pick one in the
  General tab.
- **`send_key` returns "No control device selected"** — call `select_device` first.
- **Port already in use** — change the port in the MCP Server card and reconnect your client.
- **401 Unauthorized** — your client is missing the `Authorization: Bearer <token>` header.
