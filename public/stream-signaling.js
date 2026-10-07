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
const WebSocket = require("ws");

const SIM_DEFAULT_PORT = 8090;
const RCE_DEFAULT_API = "https://api.rce.roku.com/api/v1";
const KEY_REQUEST_TIMEOUT = 4000;
const API_REQUEST_TIMEOUT = 10000;
const RCE_KEEPALIVE_MS = 25000; // Janus sessions time out at 60s
const RCE_NEGOTIATION_TIMEOUT = 20000;
const RCE_PENDING_POLL_MS = 5000;
const RCE_PENDING_POLL_LIMIT = 36;
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
      if (msg.type === "candidates-complete") return; // trickle end marker is Janus-only
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


// ---- WebRTC stream URL (WHEP) ------------------------------------------------------------
// A stream URL the user entered by hand is treated as a WHEP endpoint (RFC 9725): unlike the
// other sources, the viewer makes the offer. The window is asked for a complete (non-trickle)
// offer, which is POSTed as application/sdp; the SDP answer comes back in the response body and
// the session resource (Location header) is DELETEd when the viewer stops.
function startWhep(source, emit) {
  let cancelled = false;
  let resourceUrl = null;
  const fail = (message, noRetry = false) => {
    if (!cancelled) emit({ type: "failure", message, noRetry });
  };
  const deleteSession = () => {
    if (resourceUrl) fetch(resourceUrl, { method: "DELETE", signal: AbortSignal.timeout(4000) }).catch(() => {});
    resourceUrl = null;
  };
  emit({ type: "request-offer", iceServers: [] });

  return {
    async send(msg) {
      if (msg.type !== "local-offer" || cancelled) return;
      try {
        const res = await fetch(source.url, {
          method: "POST",
          headers: { "Content-Type": "application/sdp", Accept: "application/sdp" },
          body: msg.sdp?.sdp || "",
          signal: AbortSignal.timeout(API_REQUEST_TIMEOUT),
        });
        if (!res.ok) {
          // A client error (bad URL, auth, unsupported) won't fix itself; only timeouts/rate limits can.
          const permanent = res.status >= 400 && res.status < 500 && res.status !== 408 && res.status !== 429;
          return fail(`Stream server refused the connection (HTTP ${res.status})`, permanent);
        }
        const location = res.headers.get("location");
        if (location) resourceUrl = new URL(location, source.url).toString();
        const sdp = await res.text();
        // Stopped while the POST was in flight: the server session exists now, so end it.
        if (cancelled) return deleteSession();
        emit({ type: "answer", sdp: { type: "answer", sdp } });
      } catch (err) {
        fail(err.name === "TimeoutError" ? "Timed out contacting the stream server" : err.cause?.message || err.message);
      }
    },
    close() {
      cancelled = true;
      deleteSession();
    },
  };
}


// ---- Roku Cloud Emulator -----------------------------------------------------------------
// The management API (bearer PAT) resolves a device to its live Janus stream details, then the
// Janus streaming plugin negotiates over a WebSocket that needs an Authorization header on the
// handshake (which only a Node client can set). Details change on every device restart, so they
// are re-resolved each time a session starts (the window's retry loop restarts the session).
const pick = (obj, snake, camel) => obj?.[snake] ?? obj?.[camel];

function rceApiBase(source) {
  return (source.apiUrl || RCE_DEFAULT_API).replace(/\/+$/, "");
}

async function rceGet(source, path) {
  const res = await fetch(rceApiBase(source) + path, {
    headers: { Authorization: `Bearer ${source.token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(API_REQUEST_TIMEOUT),
  });
  if (res.status === 401 || res.status === 403) throw new Error("Cloud Emulator token was rejected");
  if (!res.ok) throw new Error(`Cloud Emulator API error (HTTP ${res.status})`);
  return res.json();
}

async function listRceDevices(source) {
  if (!source?.token) throw new Error("Enter your Cloud Emulator access token first");
  const devices = await rceGet(source, "/devices?items=0");
  // An unexpected body must not read as "no devices": callers drop devices missing from the list.
  if (!Array.isArray(devices)) throw new Error("Unexpected response from the Cloud Emulator API");
  return devices.map((d) => ({
    id: d.id,
    name: d.name || `Device ${d.id}`,
    status: d.status,
    deviceType: pick(d, "device_type", "deviceType"),
  }));
}

class RceNotRunning extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

async function resolveRceStream(source) {
  const devices = await rceGet(source, "/devices?items=0");
  const device = (Array.isArray(devices) ? devices : []).find((d) => String(d.id) === String(source.deviceId));
  if (!device) throw new Error(`Cloud Emulator device ${source.deviceId} was not found`);
  const name = device.name || `Device ${device.id}`;
  if (device.status !== "running") throw new RceNotRunning(`Device '${name}' is not running`, device.status);
  const rd = pick(device, "running_device", "runningDevice");
  const streamId = pick(rd, "janus_id", "janusId");
  const url = pick(rd, "janus_websocket_url", "janusWebsocketUrl");
  // janus id 0 is a valid stream id, so check for null/undefined rather than falsiness
  if (!url || streamId === undefined || streamId === null) {
    throw new RceNotRunning(`Device '${name}' must be running and expose a video stream`, device.status);
  }
  return {
    name,
    url,
    streamId,
    pin: pick(rd, "janus_pin", "janusPin") || undefined,
    janusToken: pick(rd, "janus_token", "janusToken") || undefined,
    iceServers: pick(rd, "janus_ice_servers", "janusIceServers") || [],
  };
}

function startRce(source, emit) {
  let cancelled = false;
  let failed = false;
  let established = false;
  let ws = null;
  let keepalive = null;
  let sessionId;
  let handleId;
  let transactions = 0;
  let janusToken;
  const pending = new Map();

  const fail = (message, noRetry = false) => {
    if (failed || cancelled) return;
    failed = true;
    teardown();
    emit({ type: "failure", message, noRetry });
  };

  const rejectAll = (err) => {
    for (const p of pending.values()) p.reject(err);
    pending.clear();
  };

  function teardown() {
    if (keepalive) clearInterval(keepalive);
    keepalive = null;
    if (ws) {
      const sock = ws;
      ws = null;
      try {
        if (sessionId !== undefined && sock.readyState === WebSocket.OPEN) {
          sock.send(JSON.stringify(withTxn({ janus: "destroy", session_id: sessionId })));
        }
        sock.removeAllListeners();
        sock.on("error", () => {});
        if (sock.readyState === WebSocket.CONNECTING) sock.terminate();
        else sock.close();
      } catch {
        // discarded anyway
      }
    }
    rejectAll(new Error("Janus session stopped"));
    sessionId = undefined;
    handleId = undefined;
  }

  const withTxn = (req) => ({
    ...req,
    transaction: `rce-video-${++transactions}`,
    ...(janusToken !== undefined ? { apisecret: janusToken } : {}),
  });

  const request = (req) =>
    new Promise((resolve, reject) => {
      if (!ws) return reject(new Error("Janus session is not connected"));
      const msg = withTxn(req);
      pending.set(msg.transaction, { resolve, reject });
      ws.send(JSON.stringify(msg));
    });

  const onMessage = (raw) => {
    let msg;
    try {
      msg = JSON.parse(raw.toString());
    } catch {
      return;
    }
    if (msg.janus === "ack") return; // real response follows as success/event with same transaction
    if (msg.janus === "success" || msg.janus === "event") {
      const p = pending.get(msg.transaction);
      if (!p) return;
      pending.delete(msg.transaction);
      const pluginErr = msg.plugindata?.data?.error;
      if (pluginErr !== undefined) {
        p.reject(new Error(`Janus plugin error${msg.plugindata.data.error_code ? ` (code ${msg.plugindata.data.error_code})` : ""}: ${pluginErr}`));
      } else {
        p.resolve(msg);
      }
    } else if (msg.janus === "error") {
      const text = `Janus error${msg.error?.code !== undefined ? ` (code ${msg.error.code})` : ""}: ${msg.error?.reason || "unknown error"}`;
      const p = pending.get(msg.transaction);
      if (p) {
        pending.delete(msg.transaction);
        p.reject(new Error(text));
      } else if (established) {
        emit({ type: "closed" });
      }
    } else if (msg.janus === "hangup" && established) {
      emit({ type: "closed" });
    }
  };

  async function run() {
    let stream;
    for (let polls = 0; ; polls++) {
      try {
        stream = await resolveRceStream(source);
        break;
      } catch (err) {
        if (cancelled) return;
        if (err instanceof RceNotRunning && err.status === "pending" && polls < RCE_PENDING_POLL_LIMIT) {
          emit({ type: "status", message: "Waiting for the Cloud Emulator device to start…" });
          await new Promise((r) => setTimeout(r, RCE_PENDING_POLL_MS));
          if (cancelled) return;
          continue;
        }
        return fail(err.message, err instanceof RceNotRunning || /token was rejected/.test(err.message));
      }
    }
    janusToken = stream.janusToken;
    const negotiation = setTimeout(
      () => fail("Timed out negotiating the Cloud Emulator stream"),
      RCE_NEGOTIATION_TIMEOUT
    );
    try {
      ws = new WebSocket(stream.url, "janus-protocol", {
        headers: { Authorization: `Bearer ${source.token}` },
        handshakeTimeout: CONNECT_TIMEOUT,
      });
      const sock = ws;
      await new Promise((resolve, reject) => {
        sock.once("open", resolve);
        sock.once("error", (e) => reject(new Error(`Failed to connect to the Janus WebSocket: ${e.message}`)));
      });
      sock.removeAllListeners("error");
      sock.on("error", (e) => {
        if (established) emit({ type: "closed" });
        else fail(`Janus WebSocket error: ${e.message}`);
      });
      sock.on("message", onMessage);
      sock.on("close", () => {
        if (cancelled || failed || ws !== sock) return;
        const err = new Error("The Janus WebSocket closed unexpectedly");
        rejectAll(err);
        if (established) emit({ type: "closed" });
        else fail(err.message);
      });

      const created = await request({ janus: "create" });
      sessionId = created.data?.id;
      keepalive = setInterval(() => {
        if (ws && sessionId !== undefined) ws.send(JSON.stringify(withTxn({ janus: "keepalive", session_id: sessionId })));
      }, RCE_KEEPALIVE_MS);
      const attached = await request({ janus: "attach", session_id: sessionId, plugin: "janus.plugin.streaming" });
      handleId = attached.data?.id;
      const watched = await request({
        janus: "message",
        session_id: sessionId,
        handle_id: handleId,
        body: { request: "watch", id: stream.streamId, ...(stream.pin ? { pin: stream.pin } : {}) },
      });
      if (!watched.jsep?.sdp) throw new Error("Janus did not return an SDP offer");
      established = true;
      clearTimeout(negotiation);
      emit({ type: "offer", sdp: watched.jsep, iceServers: stream.iceServers });
    } catch (err) {
      clearTimeout(negotiation);
      if (!cancelled) fail(err.message);
    }
  }
  run();

  return {
    send(msg) {
      if (!ws || sessionId === undefined) return;
      const base = { session_id: sessionId, handle_id: handleId };
      if (msg.type === "answer") {
        request({ janus: "message", ...base, body: { request: "start" }, jsep: msg.sdp }).catch((e) =>
          fail(e.message)
        );
      } else if (msg.type === "candidate") {
        ws.send(JSON.stringify(withTxn({ janus: "trickle", ...base, candidate: msg.candidate })));
      } else if (msg.type === "candidates-complete") {
        ws.send(JSON.stringify(withTxn({ janus: "trickle", ...base, candidate: { completed: true } })));
      }
    },
    close() {
      cancelled = true;
      teardown();
    },
  };
}


// ---- Control (ECP) for stream sources ----------------------------------------------------
// A stream source doubles as its own control device. The BrightScript Simulator exposes plain
// ECP on its `ecpPort`; a Cloud Emulator device only accepts keys through its authenticated
// Device API (`POST {instance}/api/v0/input/keypress|keydown|keyup/{key}` with the same bearer
// token used for the stream). The instance base URL changes per run, so it is cached briefly
// and re-resolved when a request fails.
const INSTANCE_CACHE_MS = 60000;
const instanceCache = new Map(); // source id -> { base, at }

async function resolveRceInstanceBase(source) {
  const cached = instanceCache.get(source.id);
  if (cached && Date.now() - cached.at < INSTANCE_CACHE_MS) return cached.base;
  const devices = await rceGet(source, "/devices?items=0");
  const device = (Array.isArray(devices) ? devices : []).find((d) => String(d.id) === String(source.deviceId));
  if (!device) throw new Error(`Cloud Emulator device ${source.deviceId} was not found`);
  const name = device.name || `Device ${device.id}`;
  if (device.status !== "running") throw new Error(`Device '${name}' is not running`);
  const rd = pick(device, "running_device", "runningDevice");
  const uuid = pick(rd, "instance_uuid", "instanceUuid");
  const base = (pick(rd, "instance_api_url", "instanceApiUrl") ||
    (uuid ? `https://device.rce.roku.com/instance/${uuid}` : "")).replace(/\/+$/, "");
  if (!base) throw new Error(`Device '${name}' does not expose a Device API URL`);
  instanceCache.set(source.id, { base, at: Date.now() });
  return base;
}

async function postKey(url, headers) {
  // Bounded so an unreachable host can't leave every key press hanging on the OS TCP timeout.
  const res = await fetch(url, { method: "POST", headers, signal: AbortSignal.timeout(KEY_REQUEST_TIMEOUT) });
  if (res.status === 401 || res.status === 403) throw Object.assign(new Error("Cloud Emulator token was rejected"), { auth: true });
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
}

// Canonical remote key names, a snapshot of roku-deploy's RemoteKey (v4). The Cloud Emulator's
// key-input route rejects a wrong-case key with a 422, while the raw ECP proxy accepts any case.
// (The lowercase names the Display window sends are the ecpKeysMap values in render.js.)
const REMOTE_KEY_BY_LOWER = new Map(
  [
    "Back", "Backspace", "ChannelDown", "ChannelUp", "Down", "Enter", "FindRemote", "Fwd", "Guide",
    "Home", "Info", "InputAV1", "InputHDMI1", "InputHDMI2", "InputHDMI3", "InputHDMI4", "InputTuner",
    "InstantReplay", "Left", "Play", "Power", "PowerOff", "PowerOn", "Rev", "Right", "Search",
    "Select", "Up", "VolumeDown", "VolumeMute", "VolumeUp",
  ].map((k) => [k.toLowerCase(), k])
);

// The canonical name of a key for the key-input route (`Lit_<char>` for literals), or null when
// the key isn't one the route is known to accept.
function canonicalRemoteKey(key) {
  if (/^lit_./i.test(key)) return `Lit_${key.slice(4)}`;
  return REMOTE_KEY_BY_LOWER.get(key.toLowerCase()) ?? null;
}

// The Display window sends literal characters URL-encoded (`lit_%41`); the Cloud Emulator URL is
// built from the raw key, which is encoded exactly once.
function decodeKey(key) {
  try {
    return decodeURIComponent(key);
  } catch {
    return key;
  }
}

// Same approach as roku-deploy for a Cloud Emulator: the instance API's key-input route with the
// canonical key name. Keys that aren't canonical go straight to the authenticated raw ECP port
// proxy (no wasted rejected request), and so does a key the input route rejects with a 4xx.
async function sendRceKey(base, headers, command, rawKey) {
  const post = (path, key) => postKey(`${base}/api/v0/${path}/${command}/${encodeURIComponent(key)}`, headers);
  const canonical = canonicalRemoteKey(rawKey);
  if (canonical) {
    try {
      return await post("input", canonical);
    } catch (err) {
      // Auth, timeouts, 5xx and network errors aren't about this key: let the caller handle them.
      if (!(err.status >= 400 && err.status < 500)) throw err;
    }
  }
  await post("ports/8060/http", rawKey);
}

// Send one ECP key. `mod`: -1 = keypress, 0 = keydown, 1 = keyup (same as the Display window).
async function sendControlKey(source, key, mod = -1) {
  const command = mod === -1 ? "keypress" : mod === 0 ? "keydown" : "keyup";
  if (source?.type === "sim") {
    // A plain ECP server takes the Display window's wire form (lowercase, URL-encoded) as is.
    await postKey(`http://${source.host}:${Number(source.ecpPort) || 8060}/${command}/${key}`);
    return;
  }
  if (source?.type === "webrtc") {
    // "Same host as stream": plain ECP on the stream URL's host (an IP or a hostname).
    const host = new URL(source.url).hostname;
    await postKey(`http://${host}:8060/${command}/${key}`);
    return;
  }
  if (source?.type !== "rce") throw new Error("Unsupported stream source type");
  // The instance API sits behind a service mesh that reads the bearer token from X-Authorization
  // (the standard Authorization header is reserved for the emulated device's own digest auth).
  const headers = { "X-Authorization": `Bearer ${source.token}` };
  const rawKey = decodeKey(key);
  for (let attempt = 0; ; attempt++) {
    try {
      const base = await resolveRceInstanceBase(source);
      await sendRceKey(base, headers, command, rawKey);
      return;
    } catch (err) {
      // Only a URL that looks stale (gone, or unreachable) is worth looking up again; a timeout,
      // a 5xx or a rejected token says nothing about the cached URL.
      const staleUrl = err.status === 404 || err.status === 410 || (!err.status && !err.auth && err.name !== "TimeoutError");
      if (staleUrl) instanceCache.delete(source.id);
      // A rejected token won't get better; anything else gets one retry.
      if (err.auth || attempt > 0) throw err;
    }
  }
}

const STARTERS = {
  sim: startSimulator,
  rce: startRce,
  webrtc: startWhep,
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

// Reachability check (simulator detection and ECP port probe on the Video tab).
async function testSource(source) {
  if (source?.type === "rce") {
    try {
      await resolveRceStream(source);
      return { ok: true, message: "Connected" };
    } catch (err) {
      // A device that is stopped/pending still proves the token and device are valid.
      return err instanceof RceNotRunning
        ? { ok: true, message: `${err.message} (status: ${err.status})` }
        : { ok: false, message: err.message };
    }
  }
  if (source?.type !== "sim") return { ok: false, message: "Unsupported source type" };
  const { host, port } = simBase(source);
  try {
    const res = await fetch(`http://${host}:${port}/config`, { signal: AbortSignal.timeout(4000) });
    return { ok: true, message: "Connected", config: await res.json() };
  } catch (err) {
    if (err.name === "TimeoutError") return { ok: false, message: "Connection timed out" };
    if (err instanceof SyntaxError) return { ok: false, message: "Not a BrightScript Simulator remote screen" };
    return { ok: false, message: err.cause?.message || err.message };
  }
}

function stopAll() {
  for (const id of [...sessions.keys()]) stopSession(id);
}

module.exports = { sendControlKey, listRceDevices, startSession, stopSession, relayFromWindow, testSource, stopAll };
