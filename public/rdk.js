/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
const http = require("http");

// Track every connected RDK target so multiple Display windows can each drive a
// different Xumo/RDK box at the same time. Keyed by "host:port" → {host,port,token}.
const connectedTargets = new Map();
let rpcSeq = 0;

function targetKey(host, port) {
  return `${host}:${port || 9998}`;
}

function jsonRpc(method, params = {}, options = {}) {
  const targetHost = options.host;
  const targetPort = options.port ?? 9998;
  const targetToken = options.token ?? "";
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!targetHost) {
    return Promise.reject(new Error("RDK host is not configured."));
  }
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({
      jsonrpc: "2.0",
      id: ++rpcSeq,
      method,
      params,
    });
    const headers = {
      "Content-Type": "application/json",
      "Content-Length": Buffer.byteLength(body),
    };
    if (targetToken) {
      headers["Authorization"] = `Bearer ${targetToken}`;
    }
    const req = http.request(
      {
        host: targetHost,
        port: targetPort,
        path: "/jsonrpc",
        method: "POST",
        headers,
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            reject(new Error(`HTTP ${res.statusCode}: ${data || res.statusMessage}`));
            return;
          }
          try {
            const parsed = data ? JSON.parse(data) : {};
            if (parsed.error) {
              reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
              return;
            }
            resolve(parsed.result);
          } catch (err) {
            reject(new Error(`Invalid JSON-RPC response: ${err.message}`));
          }
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error(`Timed out after ${timeoutMs}ms`));
    });
    req.on("error", (err) => reject(err));
    req.write(body);
    req.end();
  });
}

function connectRDK(rdkHost, rdkPort, rdkToken) {
  if (typeof rdkHost !== "string" || rdkHost === "") {
    console.error("RDK host not provided.");
    return false;
  }
  const port = Number(rdkPort) || 9998;
  const token = typeof rdkToken === "string" ? rdkToken : "";
  connectedTargets.set(targetKey(rdkHost, port), { host: rdkHost, port, token });
  console.log(`RDK configured for ${rdkHost}:${port}`);
  jsonRpc("Controller.1.status", {}, { host: rdkHost, port, token }).catch((err) => {
    console.warn(`RDK reachability check failed for ${rdkHost}:${port}: ${err.message}`);
  });
  return true;
}

// Disconnect a specific target; with no argument, forget every target.
function disconnectRDK(rdkHost, rdkPort) {
  if (rdkHost) {
    connectedTargets.delete(targetKey(rdkHost, Number(rdkPort) || 9998));
    console.log(`Disconnected from RDK ${rdkHost}`);
  } else {
    connectedTargets.clear();
    console.log("Disconnected from RDK");
  }
  return false;
}

function isRDKConnected(rdkHost, rdkPort) {
  if (rdkHost) return connectedTargets.has(targetKey(rdkHost, Number(rdkPort) || 9998));
  return connectedTargets.size > 0;
}

// Resolve a target descriptor ({host,port,token}) to use for a send call,
// preferring the connection registry so the caller can pass a partial {host,port}.
function resolveTarget(target = {}) {
  const key = targetKey(target.host, target.port);
  const stored = connectedTargets.get(key);
  return stored || (target.host ? { host: target.host, port: target.port || 9998, token: target.token || "" } : null);
}

async function testRDKConnection({ host: testHost, port: testPort, token: testToken } = {}) {
  try {
    const result = await jsonRpc(
      "Controller.1.status",
      {},
      { host: testHost, port: testPort, token: testToken, timeoutMs: 4000 }
    );
    return { success: true, result };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

function sendRDKKey(keyCode, modifiers = [], target) {
  const resolved = resolveTarget(target);
  if (!resolved) {
    console.error("Cannot send RDK key — not connected.", { target });
    return;
  }
  const code = parseInt(keyCode, 10);
  if (Number.isNaN(code)) {
    console.error(`Invalid RDK key code: ${keyCode}`);
    return;
  }
  jsonRpc("org.rdk.RDKShell.1.injectKey", { keyCode: code, modifiers }, resolved).catch((err) => {
    console.error(`RDK injectKey failed for ${code}: ${err.message}`);
  });
}

async function sendRDKText(text, target) {
  const resolved = resolveTarget(target);
  if (!resolved || typeof text !== "string" || text.length === 0) {
    return;
  }
  for (const char of text) {
    const mapping = textCharToInjectKey(char);
    if (!mapping) continue;
    try {
      await jsonRpc(
        "org.rdk.RDKShell.1.injectKey",
        { keyCode: mapping.keyCode, modifiers: mapping.modifiers },
        resolved
      );
    } catch (err) {
      console.error(`RDK text inject failed for '${char}': ${err.message}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

function launchRDKApp(client, uri, target) {
  const resolved = resolveTarget(target);
  if (!resolved) {
    return Promise.reject(new Error("RDK is not connected."));
  }
  if (!client) {
    return Promise.reject(new Error("client is required."));
  }
  const params = { client };
  if (uri) params.uri = uri;
  return jsonRpc("org.rdk.RDKShell.1.launchApplication", params, resolved);
}

// Linux input event code reference for the printable ASCII range.
// Letters use code 30..56 (KEY_A..KEY_M, KEY_N..KEY_Z); digits 2..11 (KEY_1..KEY_0); space 57.
function textCharToInjectKey(char) {
  if (char === " ") return { keyCode: 57, modifiers: [] };
  if (/^[a-z]$/.test(char)) {
    return { keyCode: LETTER_CODES[char], modifiers: [] };
  }
  if (/^[A-Z]$/.test(char)) {
    return { keyCode: LETTER_CODES[char.toLowerCase()], modifiers: ["shift"] };
  }
  if (/^[0-9]$/.test(char)) {
    if (char === "0") return { keyCode: 11, modifiers: [] };
    return { keyCode: 1 + parseInt(char, 10), modifiers: [] };
  }
  const punct = PUNCT_CODES[char];
  if (punct) return punct;
  return null;
}

const LETTER_CODES = {
  a: 30, b: 48, c: 46, d: 32, e: 18, f: 33, g: 34, h: 35, i: 23, j: 36,
  k: 37, l: 38, m: 50, n: 49, o: 24, p: 25, q: 16, r: 19, s: 31, t: 20,
  u: 22, v: 47, w: 17, x: 45, y: 21, z: 44,
};

const PUNCT_CODES = {
  "-": { keyCode: 12, modifiers: [] },
  "_": { keyCode: 12, modifiers: ["shift"] },
  "=": { keyCode: 13, modifiers: [] },
  "+": { keyCode: 13, modifiers: ["shift"] },
  "[": { keyCode: 26, modifiers: [] },
  "{": { keyCode: 26, modifiers: ["shift"] },
  "]": { keyCode: 27, modifiers: [] },
  "}": { keyCode: 27, modifiers: ["shift"] },
  "\\": { keyCode: 43, modifiers: [] },
  "|": { keyCode: 43, modifiers: ["shift"] },
  ";": { keyCode: 39, modifiers: [] },
  ":": { keyCode: 39, modifiers: ["shift"] },
  "'": { keyCode: 40, modifiers: [] },
  "\"": { keyCode: 40, modifiers: ["shift"] },
  ",": { keyCode: 51, modifiers: [] },
  "<": { keyCode: 51, modifiers: ["shift"] },
  ".": { keyCode: 52, modifiers: [] },
  ">": { keyCode: 52, modifiers: ["shift"] },
  "/": { keyCode: 53, modifiers: [] },
  "?": { keyCode: 53, modifiers: ["shift"] },
  "`": { keyCode: 41, modifiers: [] },
  "~": { keyCode: 41, modifiers: ["shift"] },
  "!": { keyCode: 2, modifiers: ["shift"] },
  "@": { keyCode: 3, modifiers: ["shift"] },
  "#": { keyCode: 4, modifiers: ["shift"] },
  "$": { keyCode: 5, modifiers: ["shift"] },
  "%": { keyCode: 6, modifiers: ["shift"] },
  "^": { keyCode: 7, modifiers: ["shift"] },
  "&": { keyCode: 8, modifiers: ["shift"] },
  "*": { keyCode: 9, modifiers: ["shift"] },
  "(": { keyCode: 10, modifiers: ["shift"] },
  ")": { keyCode: 11, modifiers: ["shift"] },
};

module.exports = {
  connectRDK,
  disconnectRDK,
  testRDKConnection,
  sendRDKKey,
  sendRDKText,
  launchRDKApp,
};
