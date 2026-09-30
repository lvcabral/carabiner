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
const STREAM_KIND_LABELS = { rce: "RCE", sim: "Simulator" };

const isStreamDeviceId = (id) => typeof id === "string" && id.startsWith(STREAM_PREFIX);
const streamDeviceId = (source) => STREAM_PREFIX + source.id;
const streamKindLabel = (type) => STREAM_KIND_LABELS[type] || "Stream";
// "<name> (RCE)" — how a stream is named in menus and window titles (its control is built in
// and shares the name, so no "→ control" suffix).
const streamLabel = ({ label, streamType }) => `${label} (${streamKindLabel(streamType)})`;

module.exports = { STREAM_PREFIX, isStreamDeviceId, streamDeviceId, streamKindLabel, streamLabel };
