/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// A stream source is bound to a window like a capture card, using the pseudo device id
// "stream:<sourceId>" (main-process copy: public/stream-utils.js).
export const STREAM_PREFIX = "stream:";
export const isStreamDeviceId = (id) => typeof id === "string" && id.startsWith(STREAM_PREFIX);
export const streamDeviceId = (source) => STREAM_PREFIX + source.id;
const STREAM_KIND_LABELS = { rce: "RCE", sim: "Simulator" };

// Label for a window (pair) in the Display / Overlay / Automation window selectors.
// Capture cards read "<card> → <control>". A stream's control is built in and shares its name,
// so a stream reads "<name> (RCE)" / "<name> (Simulator)" instead.
export function pairLabel(pair, { captureDevices = [], streamSources = [], streamingDevices = [] }) {
  const stream = streamSources.find((src) => streamDeviceId(src) === pair.captureDeviceId);
  if (stream) return `${stream.name} (${STREAM_KIND_LABELS[stream.type] || "Stream"})`;
  const cap = captureDevices.find((d) => d.deviceId === pair.captureDeviceId);
  const capName = cap?.label || pair.captureDeviceId || "Capture device";
  const ctl = streamingDevices.find((d) => d.id === pair.controlDeviceId);
  return ctl ? `${capName} → ${ctl.type}: ${ctl.alias || ctl.ipAddress}` : capName;
}
