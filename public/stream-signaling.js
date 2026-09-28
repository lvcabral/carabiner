/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
// WebRTC stream signaling, run in the main process so credentials never reach the renderer and
// so the WebSocket handshake carries no browser `Origin` header (the BrightScript Simulator
// rejects a mismatched Origin, e.g. from file://).
//
// Every source type is "offerer-first": the remote end sends an SDP offer and the Display
// window answers. A session relays that exchange to the window over `stream-signal` messages:
//   main -> window: { type: "offer"|"candidate"|"failure"|"closed", ... }
//   window -> main: `stream-signal-answer` / `stream-signal-candidate` (see main.js)
const http = require("http");
const WebSocket = require("ws");

const SIM_DEFAULT_PORT = 8090;
const CONNECT_TIMEOUT = 10000;

// pairId -> { close() , send(msg) }
const sessions = new Map();

function simBase(source) {
  const port = Number(source.port) || SIM_DEFAULT_PORT;
  return { host: source.host, port };
}

// BrightScript Simulator: custom JSON protocol on ws://host:port/rtc-session (no auth).
function startSimulator(source, emit) {
  const { host, port } = simBase(source);
  const ws = new WebSocket(`ws://${host}:${port}/rtc-session`, { handshakeTimeout: CONNECT_TIMEOUT });
  let closedByUs = false;
  let failed = false;

  const fail = (message, noRetry = false) => {
    if (failed) return;
    failed = true;
    emit({ type: "failure", message, noRetry });
  };

  ws.on("message", (data) => {
    let msg;
    try {
      msg = JSON.parse(data.toString());
    } catch {
      return;
    }
    if (msg.type === "offer") {
      emit({ type: "offer", sdp: msg.sdp, iceServers: [] });
    } else if (msg.type === "candidate") {
      emit({ type: "candidate", candidate: msg.candidate });
    } else if (msg.type === "busy") {
      fail(`Simulator is busy (max ${msg.maxViewers ?? "?"} viewers)`, true);
    }
  });
  ws.on("error", (err) => fail(err.message));
  ws.on("close", (code) => {
    if (closedByUs) return;
    if (code === 4000) fail("Simulator is busy", true);
    else if (failed) return;
    else emit({ type: "closed" });
  });

  return {
    send(msg) {
      if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    close() {
      closedByUs = true;
      try {
        ws.close();
      } catch {
        // already closed
      }
    },
  };
}

const STARTERS = {
  sim: startSimulator,
};

function stopSession(pairId) {
  const session = sessions.get(pairId);
  if (session) {
    session.close();
    sessions.delete(pairId);
  }
}

// Start (or restart) the signaling session for a window. `emit(message)` delivers to that window.
function startSession(pairId, source, emit) {
  stopSession(pairId);
  const start = STARTERS[source?.type];
  if (!start) {
    emit({ type: "failure", message: `Unsupported stream source type: ${source?.type}`, noRetry: true });
    return;
  }
  sessions.set(pairId, start(source, emit));
}

// Relay a window's answer / ICE candidate to the remote end.
function relayFromWindow(pairId, msg) {
  sessions.get(pairId)?.send(msg);
}

// Reachability check used by the Streams tab "Test" button.
function testSource(source) {
  return new Promise((resolve) => {
    if (source?.type !== "sim") return resolve({ ok: false, message: "Unsupported source type" });
    const { host, port } = simBase(source);
    const req = http.get({ host, port, path: "/config", timeout: 4000 }, (res) => {
      let body = "";
      res.on("data", (c) => (body += c));
      res.on("end", () => {
        try {
          const cfg = JSON.parse(body);
          resolve({ ok: true, message: "Connected", config: cfg });
        } catch {
          resolve({ ok: false, message: "Not a BrightScript Simulator remote screen" });
        }
      });
    });
    req.on("timeout", () => {
      req.destroy();
      resolve({ ok: false, message: "Connection timed out" });
    });
    req.on("error", (err) => resolve({ ok: false, message: err.message }));
  });
}

function stopAll() {
  for (const id of [...sessions.keys()]) stopSession(id);
}

module.exports = { startSession, stopSession, relayFromWindow, testSource, stopAll, SIM_DEFAULT_PORT };
