/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// Pure state helpers for the Video and Control tabs: no React, no IPC, so they are unit tested directly.
//
// The catalog here never holds stream sources' built-in controls (`managedBy`): App drops them
// on the way in with userControls(), and main keeps them whatever list it's sent back.
//
// Settings compatibility: "chosen" is stored as an optional `chosen: false` on stream sources and
// control devices (absent = chosen) plus `settings.video.hiddenCaptureIds` for capture cards, so
// settings from older builds show everything, as they did before.
import { streamControlId, streamDeviceId } from "../pairLabel";

export const CONTROL_TYPES = [
  { key: "roku", label: "Roku", type: "Roku", proto: "ecp" },
  { key: "firetv", label: "Fire TV", type: "Fire TV", proto: "adb" },
  { key: "googletv", label: "Google TV", type: "Google TV", proto: "adb" },
  { key: "appletv", label: "Apple TV", type: "Apple TV", proto: "atv" },
  { key: "xumo", label: "Xumo", type: "Xumo Stream Box", proto: "rdk" },
];
export const RDK_DEFAULT_PORT = 9998;

export const isChosen = (entry) => entry?.chosen !== false;
const setChosen = (entry, chosen) => {
  const { chosen: _drop, ...rest } = entry;
  return chosen ? rest : { ...rest, chosen: false };
};

// ----- control devices ---------------------------------------------------------------------

const protoOf = (device) => String(device?.id || "").split("|")[1] || "";
export const controlTypeOf = (device) =>
  CONTROL_TYPES.find((t) => t.type === device?.type) ||
  CONTROL_TYPES.find((t) => t.proto === protoOf(device)) ||
  CONTROL_TYPES[0];

// Stream sources' built-in controls share main's catalog but are never shown as devices, so App
// drops them once when the catalog arrives (main re-adds them to any list it's sent).
export const userControls = (deviceList = []) => deviceList.filter((d) => !d.managedBy);

// Address shown for a device: "<ip>", or "<ip>:<port>" for an RDK box.
export const controlAddress = (device) => (device.port ? `${device.ipAddress}:${device.port}` : device.ipAddress);

// The devices of `list` grouped by type, in CONTROL_TYPES order, empty types left out:
// [{ type, devices }].
export const controlsByType = (list) =>
  CONTROL_TYPES.map((type) => ({ type, devices: list.filter((d) => controlTypeOf(d).key === type.key) })).filter(
    (group) => group.devices.length > 0,
  );

// The same protocol at the same address is the same device, whether it was scanned or typed in
// (an RDK box also needs its port, since that is part of its id). The protocol is part of the key
// because an address can change hands: a Roku found at an IP a Fire TV used to have is a new device.
const addressKey = (device) => {
  const proto = protoOf(device);
  const ip = String(device?.ipAddress || "").trim().toLowerCase();
  return `${proto}:${proto === "rdk" ? `${ip}:${Number(device.port) || RDK_DEFAULT_PORT}` : ip}`;
};

export const controlName = (device) => device?.alias || `${controlTypeOf(device).label} ${device?.ipAddress || ""}`.trim();

const IPV4 = /^(25[0-5]|2[0-4]\d|[01]?\d?\d)(\.(25[0-5]|2[0-4]\d|[01]?\d?\d)){3}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAC = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
export const isValidPort = (value) => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 && n <= 65535;
};

// Add a device typed in by hand (chosen). Returns { deviceList, device } for a new device,
// { duplicate } when that address is already known (the caller checks it instead), or { error }.
export function addManualDevice(deviceList, { typeKey, address, name = "", port, token = "" }) {
  const type = CONTROL_TYPES.find((t) => t.key === typeKey);
  if (!type) return { error: "Choose a device type." };
  const addr = String(address || "").trim();
  if (type.proto === "atv") {
    if (!UUID.test(addr) && !MAC.test(addr) && !IPV4.test(addr)) {
      return { error: "Enter the Apple TV's IP address, MAC address or device ID." };
    }
  } else if (!IPV4.test(addr)) {
    return { error: "Enter an IP address, like 192.168.1.40." };
  }
  const rdkPort = type.proto === "rdk" ? Number(port || RDK_DEFAULT_PORT) : undefined;
  if (type.proto === "rdk" && !isValidPort(rdkPort)) return { error: "The port has to be 1–65535." };

  const candidate = { id: `${addr}|${type.proto}`, ipAddress: addr, ...(rdkPort ? { port: rdkPort } : {}) };
  const duplicate = deviceList.find((d) => addressKey(d) === addressKey(candidate));
  if (duplicate) return { duplicate };

  const device = {
    id: type.proto === "rdk" ? `${addr}:${rdkPort}|rdk` : candidate.id,
    ipAddress: addr,
    alias: String(name).trim() || `${type.label} ${addr}`,
    linked: "",
    type: type.type,
    ...(type.proto === "rdk" ? { port: rdkPort, token: String(token).trim() } : {}),
  };
  return { deviceList: [...deviceList, device], device };
}

// Name to show for a device, and the name it falls back to when a rename is cleared (null when
// the device reports none). `deviceName` is the name the device itself reports (Roku's
// user-device-name); `alias` is what's shown, and equals deviceName until the user renames it.
export const defaultControlName = (device) => device?.deviceName || null;
export const renameControl = (device, name) => ({ ...device, alias: name || device.deviceName || device.alias });

// A BrightScript Simulator answers Roku discovery too (reporting its app name as the device
// name), but its control is built into its video source, so it's never a control device.
const SIMULATOR_DEVICE_NAME = "brightscript simulator";
export const isSimulatorName = (name) => String(name || "").trim().toLowerCase() === SIMULATOR_DEVICE_NAME;

// Fold a network scan (Roku SSDP results: [{ ipAddress, name }]) into the catalog. A found
// address that is already known updates that entry instead of adding another one; a device
// that was never renamed follows the name it reports. BrightScript Simulators are skipped, and
// entries an earlier scan saved for one are dropped. Returns { deviceList, foundIds, addedCount }.
export function mergeScanResults(deviceList, found = []) {
  let list = deviceList.filter((d) => !isSimulatorName(d.deviceName));
  const foundIds = new Set();
  let addedCount = 0;
  for (const hit of found) {
    const ip = String(hit.ipAddress || "").trim();
    if (!ip || isSimulatorName(hit.name)) continue;
    // Roku discovery only finds Rokus, so only an ECP entry at that address can be the same device.
    const key = addressKey({ id: `${ip}|ecp`, ipAddress: ip });
    const idx = list.findIndex((d) => addressKey(d) === key);
    if (idx >= 0) {
      const existing = list[idx];
      if (hit.name && existing.deviceName !== hit.name) {
        const followName = !existing.alias || existing.alias === existing.deviceName;
        list[idx] = { ...existing, deviceName: hit.name, ...(followName ? { alias: hit.name } : {}) };
      }
      foundIds.add(existing.id);
      continue;
    }
    const name = hit.name || `Roku ${ip}`;
    const device = { id: `${ip}|ecp`, ipAddress: ip, alias: name, ...(hit.name ? { deviceName: hit.name } : {}), linked: "", type: "Roku", chosen: false };
    list = [...list, device];
    foundIds.add(device.id);
    addedCount++;
  }
  return { deviceList: list, foundIds, addedCount };
}

// Unlink every pair whose control is one of `ids`. Returns { pairs, affected } where affected is
// the list of pairs that changed.
export function resetPairingsFor(pairs = [], ids = []) {
  const gone = new Set(ids);
  const affected = [];
  const next = pairs.map((p) => {
    if (!p.controlDeviceId || !gone.has(p.controlDeviceId)) return p;
    affected.push(p);
    const { controlMode, ...rest } = p;
    return { ...rest, controlDeviceId: "" };
  });
  return { pairs: next, affected };
}

// Remove a control device for good (not just uncheck it), unlinking the sources it controlled.
export function removeControlDevice(deviceList, id, pairs) {
  return { deviceList: deviceList.filter((d) => d.id !== id), ...resetPairingsFor(pairs, [id]) };
}

// Make `chosenIds` the chosen control devices; pairs linked to a device that is no longer chosen
// are reset to no control.
export function applyControlSelection(deviceList, chosenIds, pairs) {
  const next = deviceList.map((d) => setChosen(d, chosenIds.has(d.id)));
  const unchosen = next.filter((d) => !isChosen(d)).map((d) => d.id);
  return { deviceList: next, ...resetPairingsFor(pairs, unchosen) };
}

// ----- video sources -----------------------------------------------------------------------

const STREAM_KIND = { sim: "simulator", rce: "rce", webrtc: "webrtc" };

export const isLocalHost = (host) => ["localhost", "127.0.0.1"].includes(String(host || "").toLowerCase());
// One key per simulator address (localhost and 127.0.0.1 are one host). Same rule as main's
// simulatorKey in public/stream-utils.js, which drops any duplicate that gets through.
export const simulatorKey = ({ host, port }) =>
  `${isLocalHost(host) ? "localhost" : String(host || "").toLowerCase()}:${Number(port) || 8090}`;

// A Cloud Emulator device no longer on its account's listing is kept with this status (so its
// window settings survive) until the user removes it. Same value as RCE_MISSING in
// public/rce-accounts.js.
export const RCE_MISSING = "missing";
export const isMissingRce = (source) => source?.type === "rce" && source.status === RCE_MISSING;
// What to show for a Cloud Emulator device's status.
export const rceStatusText = (status) =>
  status === RCE_MISSING ? "no longer on this account" : status || "Cloud Emulator";

export const hostOf = (url) => {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
};

// Stream URLs are WHEP endpoints, which are http(s).
export function validateStreamUrl(url) {
  const value = String(url || "").trim();
  if (/^wss?:\/\//i.test(value)) return "WebSocket stream URLs aren't supported yet. Use the stream's http(s) WHEP URL.";
  if (!/^https?:\/\//i.test(value) || !hostOf(value)) return "Stream URL has to start with http:// or https://.";
  return null;
}

// "usb video (534d:2109)" → { name: "usb video", hardwareId: "534d:2109" }
export function splitCaptureLabel(label = "") {
  const m = /^(.*?)\s*\(([0-9a-f]{4}:[0-9a-f]{4})\)\s*$/i.exec(label);
  return m ? { name: m[1] || label, hardwareId: m[2] } : { name: label || "Capture device", hardwareId: "" };
}

// Every known video source as one flat list: { id, kind, name, chosen, source?, hardwareId? }.
// `id` is what a pair binds to (the capture device id, or "stream:<sourceId>").
export function videoEntries({ captureDevices = [], streamSources = [], hiddenCaptureIds = [] }) {
  const hidden = new Set(hiddenCaptureIds);
  const captures = captureDevices.map((d) => ({
    id: d.deviceId,
    kind: "capture",
    ...splitCaptureLabel(d.label),
    chosen: !hidden.has(d.deviceId),
  }));
  const streams = streamSources.map((src) => ({
    id: streamDeviceId(src),
    kind: STREAM_KIND[src.type] || "webrtc",
    name: src.name,
    chosen: isChosen(src),
    source: src,
  }));
  return [...captures, ...streams];
}

// Make `chosenIds` (entry ids) the chosen video sources. Returns the new stream sources, hidden
// capture ids and pairs (unchecked sources are deactivated).
export function applyVideoSelection({ entries, streamSources, hiddenCaptureIds = [], pairs = [] }, chosenIds) {
  const captureIds = new Set(entries.filter((e) => e.kind === "capture").map((e) => e.id));
  // Keep hidden ids of cards that aren't plugged in right now.
  const hidden = hiddenCaptureIds.filter((id) => !captureIds.has(id));
  for (const id of captureIds) if (!chosenIds.has(id)) hidden.push(id);
  const nextSources = streamSources.map((src) => setChosen(src, chosenIds.has(streamDeviceId(src))));
  const nextPairs = pairs.map((p) => (chosenIds.has(p.captureDeviceId) || p.visible === false ? p : { ...p, visible: false }));
  return { streamSources: nextSources, hiddenCaptureIds: hidden, pairs: nextPairs };
}

// ----- pairing -----------------------------------------------------------------------------

// The value a row's Control select shows for a source's pair: "host" when a WebRTC stream URL
// uses its own built-in control (ECP to the URL's host).
export function controlValueOf(pair, source = null) {
  if (!pair) return "none";
  if (source?.type === "webrtc" && pair.controlDeviceId === streamControlId(source)) return "host";
  if (pair.controlMode === "viewer") return "viewer";
  return pair.controlDeviceId || "none";
}

// Create/update the pair bound to a video source. Inactive pairs are kept, even without a linked
// control: a pair also holds its window's settings (Regular Window, border, size, audio...), which
// must survive turning it off and on again. In single-window mode enabling one hides the others.
export function setPairFor(pairs, sourceId, patch, { singleWindowMode = false, autoControl = "" } = {}) {
  const existing = pairs.find((p) => p.captureDeviceId === sourceId);
  let next = existing
    ? pairs.map((p) => (p.captureDeviceId === sourceId ? { ...p, ...patch } : p))
    : [...pairs, { id: sourceId, captureDeviceId: sourceId, controlDeviceId: autoControl, visible: false, ...patch }];
  if (singleWindowMode && patch.visible === true) {
    next = next.map((p) => (p.captureDeviceId === sourceId ? p : { ...p, visible: false }));
  }
  return next;
}

// Patch for a Control select choice: "none", "host" (a WebRTC stream URL's built-in control: ECP
// to the URL's host), "viewer", or a control device id.
export function controlPatch(value, { source = null } = {}) {
  if (value === "host") {
    // Only a WebRTC stream URL has a "same host"; anything else falls back to no control.
    return { controlDeviceId: source?.type === "webrtc" ? streamControlId(source) : "", controlMode: undefined };
  }
  if (value === "viewer") return { controlDeviceId: "", controlMode: "viewer" };
  return { controlDeviceId: value === "none" ? "" : value, controlMode: undefined };
}
