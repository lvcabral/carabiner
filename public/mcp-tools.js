/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/

/**
 * MCP tool / resource / prompt registration for Carabiner.
 *
 * Every handler is a thin wrapper over the `ctx` object provided by `main.js`, which in turn
 * reuses the same internal functions already used by the IPC layer (device control, scripts,
 * screenshots, recording). No device/control logic is duplicated here.
 */
const { z } = require("zod");

/**
 * Friendly, protocol-agnostic key names mapped to each protocol's native key.
 * Mirrors the per-protocol maps in `render.js`. A `null` value means the key is not available
 * for that protocol. Callers may also pass a raw protocol-native key (e.g. an ADB keycode or a
 * Roku ECP command such as "search") which is forwarded as-is.
 */
const SEMANTIC_KEYS = {
  up: { ecp: "up", adb: "19", atv: "up", rdk: "103" },
  down: { ecp: "down", adb: "20", atv: "down", rdk: "108" },
  left: { ecp: "left", adb: "21", atv: "left", rdk: "105" },
  right: { ecp: "right", adb: "22", atv: "right", rdk: "106" },
  select: { ecp: "select", adb: "66", atv: "select", rdk: "28" },
  ok: { ecp: "select", adb: "66", atv: "select", rdk: "28" },
  back: { ecp: "back", adb: "4", atv: "menu", rdk: "158" },
  home: { ecp: "home", adb: "3", atv: "home", rdk: "102" },
  play: { ecp: "play", adb: "85", atv: "play_pause", rdk: "164" },
  pause: { ecp: "play", adb: "85", atv: "play_pause", rdk: "164" },
  rewind: { ecp: "rev", adb: "89", atv: "previous", rdk: "168" },
  forward: { ecp: "fwd", adb: "90", atv: "next", rdk: "208" },
  replay: { ecp: "instantreplay", adb: null, atv: null, rdk: null },
  info: { ecp: "info", adb: null, atv: "top_menu", rdk: "139" },
  options: { ecp: "info", adb: null, atv: "top_menu", rdk: "139" },
  volume_mute: { ecp: "volumemute", adb: "164", atv: null, rdk: "113" },
  volume_up: { ecp: null, adb: "24", atv: "volume_up", rdk: "115" },
  volume_down: { ecp: null, adb: "25", atv: "volume_down", rdk: "114" },
};

const SEMANTIC_KEY_NAMES = Object.keys(SEMANTIC_KEYS);

// A single "press" maps to a different `mod` value per protocol (see render.js sendKey).
function modForProtocol(type) {
  return type === "ecp" ? -1 : 0;
}

/**
 * Translate a requested key into the native key + mod for the active protocol.
 * Returns { key, mod } or throws a descriptive Error.
 */
function resolveKey(requestedKey, type) {
  if (!type) {
    throw new Error("No control device selected. Use select_device first.");
  }
  const mod = modForProtocol(type);
  const semantic = SEMANTIC_KEYS[requestedKey.toLowerCase()];
  if (semantic) {
    const native = semantic[type];
    if (!native) {
      throw new Error(`Key "${requestedKey}" is not supported on ${type.toUpperCase()} devices.`);
    }
    return { key: native, mod };
  }
  // Fall back to treating the input as a raw protocol-native key.
  return { key: requestedKey, mod };
}

// ----------------------------- response helpers -----------------------------

function textResult(value) {
  const text = typeof value === "string" ? value : JSON.stringify(value, null, 2);
  return { content: [{ type: "text", text }] };
}

function errorResult(error) {
  const message = error instanceof Error ? error.message : String(error);
  return { content: [{ type: "text", text: `Error: ${message}` }], isError: true };
}

// Wrap an async handler so thrown errors become MCP error results instead of transport failures.
function handler(fn) {
  return async (args, extra) => {
    try {
      return await fn(args, extra);
    } catch (error) {
      return errorResult(error);
    }
  };
}

// ----------------------------- registration -----------------------------

function registerAll(server, ctx) {
  registerDeviceTools(server, ctx);
  registerCaptureTools(server, ctx);
  registerScriptTools(server, ctx);
  registerDisplayTools(server, ctx);
  registerStateTools(server, ctx);
  registerResources(server, ctx);
  registerPrompts(server, ctx);
}

// Reusable schema fragment: optionally target a specific window/pair by its control device id.
const targetDeviceId = z
  .string()
  .optional()
  .describe("Optional control device id to target a specific window; defaults to the active window.");

function registerDeviceTools(server, ctx) {
  server.registerTool(
    "list_devices",
    {
      title: "List control devices",
      description:
        "Return all configured control devices with their protocol (ecp/adb/atv/rdk) and connection status.",
    },
    handler(async () => textResult(ctx.listDevices()))
  );

  server.registerTool(
    "list_windows",
    {
      title: "List display windows",
      description:
        "Return the open Display windows (capture+control pairs): pairId, capture label, control " +
        "device id, visibility, and which one is active. Use a window's controlDeviceId as the " +
        "optional 'deviceId' on other tools to target that window.",
    },
    handler(async () => textResult(ctx.listWindows()))
  );

  server.registerTool(
    "select_device",
    {
      title: "Select control device",
      description:
        "Switch the active control device by its id (formats: '<ip>|ecp', '<ip>|adb', '<uuid-or-mac>|atv', '<host:port>|rdk').",
      inputSchema: {
        deviceId: z.string().describe("Device id in '<address>|<protocol>' form."),
      },
    },
    handler(async ({ deviceId }) => textResult(await ctx.selectDevice(deviceId)))
  );

  server.registerTool(
    "get_current_device",
    {
      title: "Get current device",
      description: "Return protocol, address, and connection state of the active control device.",
      inputSchema: { deviceId: targetDeviceId },
    },
    handler(async ({ deviceId }) => textResult(ctx.getCurrentDevice(deviceId)))
  );

  server.registerTool(
    "send_key",
    {
      title: "Send key",
      description:
        "Send a single keypress to the current device. Accepts a friendly name (" +
        SEMANTIC_KEY_NAMES.join(", ") +
        ") or a raw protocol-native key (ECP command, ADB keycode, or ATV command).",
      inputSchema: {
        key: z.string().describe("Friendly key name or raw protocol-native key."),
        deviceId: targetDeviceId,
      },
    },
    handler(async ({ key, deviceId }) => {
      const current = ctx.getCurrentDevice(deviceId);
      const { key: nativeKey, mod } = resolveKey(key, current.type);
      await ctx.sendKey(nativeKey, mod, deviceId);
      return textResult({ sent: key, nativeKey, protocol: current.type });
    })
  );

  server.registerTool(
    "send_text",
    {
      title: "Send text",
      description: "Type a text string on the current device.",
      inputSchema: {
        text: z.string().describe("Text to type."),
        deviceId: targetDeviceId,
      },
    },
    handler(async ({ text, deviceId }) => {
      await ctx.sendText(text, deviceId);
      return textResult({ sent: text });
    })
  );

  server.registerTool(
    "launch_app",
    {
      title: "Launch app",
      description:
        "Launch an application on the current device. RDK (Xumo) only — uses RDKShell.launchApplication.",
      inputSchema: {
        client: z.string().describe("Application client name (e.g. 'Netflix', 'Cobalt', 'HtmlApp')."),
        uri: z.string().optional().describe("Optional URI/deep-link payload to pass to the app."),
        deviceId: targetDeviceId,
      },
    },
    handler(async ({ client, uri, deviceId }) => textResult(await ctx.launchApp({ client, uri, deviceId })))
  );
}

function registerCaptureTools(server, ctx) {
  server.registerTool(
    "list_capture_devices",
    {
      title: "List capture devices",
      description: "List available HDMI capture cards / video input devices.",
    },
    handler(async () => textResult(ctx.listCaptureDevices()))
  );

  server.registerTool(
    "select_capture_device",
    {
      title: "Select capture device",
      description: "Switch the active capture source by its deviceId.",
      inputSchema: {
        deviceId: z.string().describe("Capture device id (deviceId from list_capture_devices)."),
      },
    },
    handler(async ({ deviceId }) => textResult(await ctx.selectCaptureDevice(deviceId)))
  );

  server.registerTool(
    "take_screenshot",
    {
      title: "Take screenshot",
      description:
        "Capture the current frame. Returns the image to the caller and (unless save=false) also " +
        "saves a PNG to the configured screenshots folder.",
      inputSchema: {
        save: z
          .boolean()
          .optional()
          .describe("Whether to also save the PNG to disk (default true)."),
        deviceId: targetDeviceId,
      },
    },
    handler(async ({ save, deviceId }) => {
      const shot = await ctx.takeScreenshot({ save: save !== false, deviceId });
      return {
        content: [
          { type: "image", data: shot.base64, mimeType: shot.mimeType },
          {
            type: "text",
            text: shot.filePath ? `Saved to ${shot.filePath}` : "Captured (not saved to disk).",
          },
        ],
      };
    })
  );

  server.registerTool(
    "start_recording",
    {
      title: "Start recording",
      description: "Begin video recording of the current capture stream.",
      inputSchema: {
        filename_prefix: z
          .string()
          .optional()
          .describe("Optional filename prefix for the saved recording."),
        deviceId: targetDeviceId,
      },
    },
    handler(async ({ filename_prefix, deviceId }) => {
      await ctx.startRecording({ filenamePrefix: filename_prefix, deviceId });
      return textResult({ recording: true });
    })
  );

  server.registerTool(
    "stop_recording",
    {
      title: "Stop recording",
      description: "Stop recording, save the file, and return the saved file path.",
      inputSchema: { deviceId: targetDeviceId },
    },
    handler(async ({ deviceId }) => textResult(await ctx.stopRecording({ deviceId })))
  );
}

function registerScriptTools(server, ctx) {
  server.registerTool(
    "list_scripts",
    {
      title: "List scripts",
      description: "Return all saved automation scripts (id, name, controlType, step count).",
    },
    handler(async () => textResult(ctx.listScripts()))
  );

  server.registerTool(
    "run_script",
    {
      title: "Run script",
      description: "Execute a saved script by id. Blocks until the script completes or is cancelled.",
      inputSchema: {
        scriptId: z.string().describe("Id of the script to run."),
        deviceId: targetDeviceId,
      },
    },
    handler(async ({ scriptId, deviceId }) => textResult(await ctx.runScript(scriptId, deviceId)))
  );

  server.registerTool(
    "stop_script",
    {
      title: "Stop script",
      description: "Cancel the currently running script.",
    },
    handler(async () => textResult(ctx.stopScript()))
  );

  server.registerTool(
    "create_script",
    {
      title: "Create script",
      description:
        "Create a script programmatically. Each step has a key, an optional mod " +
        "(-1 keypress/keydown, 0 keypress, 100 keyup), and a delay in ms before the step.",
      inputSchema: {
        name: z.string().optional().describe("Optional script name."),
        controlType: z.enum(["ecp", "adb", "atv", "rdk"]).describe("Target protocol for the steps."),
        steps: z
          .array(
            z.object({
              key: z.string(),
              mod: z.number().optional(),
              delay: z.number().optional(),
            })
          )
          .describe("Ordered list of steps to replay."),
      },
    },
    handler(async ({ name, controlType, steps }) =>
      textResult(ctx.createScript({ name, controlType, steps }))
    )
  );

  server.registerTool(
    "delete_script",
    {
      title: "Delete script",
      description: "Remove a saved script by id.",
      inputSchema: {
        scriptId: z.string().describe("Id of the script to delete."),
      },
    },
    handler(async ({ scriptId }) => textResult(ctx.deleteScript(scriptId)))
  );
}

function registerDisplayTools(server, ctx) {
  server.registerTool(
    "show_display",
    {
      title: "Show display",
      description: "Make a floating display window visible (defaults to the active window).",
      inputSchema: { deviceId: targetDeviceId },
    },
    handler(async ({ deviceId }) => textResult(ctx.showDisplay({ deviceId })))
  );

  server.registerTool(
    "hide_display",
    {
      title: "Hide display",
      description: "Hide a floating display window (defaults to the active window).",
      inputSchema: { deviceId: targetDeviceId },
    },
    handler(async ({ deviceId }) => textResult(ctx.hideDisplay({ deviceId })))
  );

  server.registerTool(
    "toggle_fullscreen",
    {
      title: "Toggle fullscreen",
      description: "Toggle fullscreen mode of a display window (defaults to the active window).",
      inputSchema: { deviceId: targetDeviceId },
    },
    handler(async ({ deviceId }) => textResult(ctx.toggleFullscreen({ deviceId })))
  );

  server.registerTool(
    "toggle_on_top",
    {
      title: "Toggle always on top",
      description: "Toggle always-on-top mode of a display window (defaults to the active window).",
      inputSchema: { deviceId: targetDeviceId },
    },
    handler(async ({ deviceId }) => textResult(ctx.toggleOnTop({ deviceId })))
  );
}

function registerStateTools(server, ctx) {
  server.registerTool(
    "get_settings",
    {
      title: "Get settings",
      description: "Return a read-only snapshot of the current app settings (auth token redacted).",
    },
    handler(async () => textResult(ctx.getSettingsSnapshot()))
  );

  server.registerTool(
    "get_app_info",
    {
      title: "Get app info",
      description: "Return app version, OS/platform, and MCP server status.",
    },
    handler(async () => textResult(ctx.getAppInfo()))
  );
}

function registerResources(server, ctx) {
  server.registerResource(
    "devices",
    "carabiner://devices",
    {
      title: "Devices",
      description: "Current control device list and the selected device.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            { devices: ctx.listDevices(), current: ctx.getCurrentDevice() },
            null,
            2
          ),
        },
      ],
    })
  );

  server.registerResource(
    "scripts",
    "carabiner://scripts",
    {
      title: "Scripts",
      description: "All saved automation scripts.",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        { uri: uri.href, mimeType: "application/json", text: JSON.stringify(ctx.getScripts(), null, 2) },
      ],
    })
  );

  server.registerResource(
    "settings",
    "carabiner://settings",
    {
      title: "Settings",
      description: "Full settings snapshot (auth token redacted).",
      mimeType: "application/json",
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(ctx.getSettingsSnapshot(), null, 2),
        },
      ],
    })
  );

  server.registerResource(
    "latest-screenshot",
    "carabiner://screenshot/latest",
    {
      title: "Latest screenshot",
      description: "Capture the current frame as a PNG image.",
      mimeType: "image/png",
    },
    async (uri) => {
      const shot = await ctx.takeScreenshot({ save: false });
      return {
        contents: [{ uri: uri.href, mimeType: shot.mimeType, blob: shot.base64 }],
      };
    }
  );
}

function registerPrompts(server, ctx) {
  server.registerPrompt(
    "qa_navigation_test",
    {
      title: "QA navigation test",
      description:
        "Guide a structured navigation test (home → content → playback → back) capturing a " +
        "screenshot at each step.",
      argsSchema: {
        app_name: z.string().optional().describe("Name of the app under test, if known."),
      },
    },
    ({ app_name }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              `You are running a QA navigation test on the connected streaming device${
                app_name ? ` for the "${app_name}" app` : ""
              } using the Carabiner MCP tools.\n\n` +
              "Follow these steps, calling take_screenshot after each navigation and describing " +
              "what you see before continuing:\n" +
              "1. send_key('home') and screenshot the home screen.\n" +
              "2. Navigate into a content row (send_key('down'), then 'right' a few times) and screenshot.\n" +
              "3. send_key('select') to open a content detail page and screenshot.\n" +
              "4. send_key('play') to start playback, wait ~5s, and screenshot.\n" +
              "5. send_key('back') until you return home, screenshotting the final state.\n\n" +
              "Report any unexpected UI state, errors, or navigation that did not behave as expected.",
          },
        },
      ],
    })
  );

  server.registerPrompt(
    "record_script_from_description",
    {
      title: "Record script from description",
      description:
        "Turn a natural-language workflow description into a create_script steps array for the " +
        "active protocol.",
      argsSchema: {
        description: z.string().describe("Natural-language description of the workflow to automate."),
      },
    },
    ({ description }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text:
              "Convert the following workflow description into an automation script for the " +
              "currently selected Carabiner device.\n\n" +
              `Workflow: ${description}\n\n` +
              "First call get_current_device to learn the active protocol. Then build a steps array " +
              "where each step is { key, mod, delay } (mod 0 for a press, delay in ms before the " +
              "step) using friendly key names, and call create_script with that protocol and steps. " +
              "Finally call run_script to verify it, taking screenshots to confirm the result.",
          },
        },
      ],
    })
  );
}

module.exports = { registerAll, SEMANTIC_KEYS, resolveKey };
