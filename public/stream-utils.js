/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// Shared by the main-process modules (main.js, menu.js, settings.js). A stream source is bound to
// a pair like a capture card, using the pseudo device id "stream:<sourceId>". The settings UI
// (src/components/pairLabel.js) and the Display window (render.js) keep their own copy of these
// few lines because they can't require() this file.
const STREAM_PREFIX = "stream:";
const STREAM_KIND_LABELS = { rce: "RCE", sim: "Simulator", webrtc: "WebRTC" };
const SIM_DEFAULT_PORT = 8090;

const isStreamDeviceId = (id) => typeof id === "string" && id.startsWith(STREAM_PREFIX);
const streamDeviceId = (source) => STREAM_PREFIX + source.id;
const streamKindLabel = (type) => STREAM_KIND_LABELS[type] || "Stream";
// "<name> (RCE)" — how a stream is named in menus and window titles (its control is built in
// and shares the name, so no "→ control" suffix).
const streamLabel = ({ label, streamType }) => `${label} (${streamKindLabel(streamType)})`;

// Simulator and Cloud Emulator streams carry their own control, so their pair is locked to it. A
// WebRTC stream URL's built-in control ("Same host as stream") is only a default.
const hasLockedControl = (type) => type === "sim" || type === "rce";

// Host of a stream URL ("" for a malformed one).
const urlHost = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

const isLocalHost = (host) => ["localhost", "127.0.0.1"].includes(String(host || "").toLowerCase());
// One key per simulator address: localhost and 127.0.0.1 are the same host, and the port defaults.
const simulatorKey = (src) =>
  `${isLocalHost(src.host) ? "localhost" : String(src.host || "").toLowerCase()}:${Number(src.port) || SIM_DEFAULT_PORT}`;
// Keep the first of several simulator sources at the same address (added by hand twice, or by
// hand and by detection), so no path can create a duplicate.
function dropDuplicateSimulators(sources) {
  const seen = new Set();
  return sources.filter((src) => {
    if (src.type !== "sim") return true;
    const key = simulatorKey(src);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// A source as renderers (and MCP) may see it: never its token.
const publicSource = ({ token, ...rest }) => ({ ...rest, hasToken: !!token });

module.exports = {
  STREAM_PREFIX,
  SIM_DEFAULT_PORT,
  isStreamDeviceId,
  streamDeviceId,
  streamKindLabel,
  streamLabel,
  hasLockedControl,
  urlHost,
  simulatorKey,
  dropDuplicateSimulators,
  publicSource,
};
