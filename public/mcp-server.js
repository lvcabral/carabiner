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
 * Embedded MCP (Model Context Protocol) server for Carabiner.
 *
 * Runs inside the Electron main process and exposes Carabiner's device control, automation and
 * capture features to AI assistants. Binds only to 127.0.0.1 and supports two transports:
 *   - Streamable HTTP at POST/GET/DELETE /mcp   (recommended, modern clients)
 *   - HTTP+SSE at GET /sse + POST /messages     (legacy compatibility)
 *
 * The MCP SDK ships a CommonJS build, so it is required directly (no dynamic import needed).
 */
const http = require("http");
const { randomUUID } = require("crypto");
const log = require("electron-log");

const { McpServer } = require("@modelcontextprotocol/sdk/server/mcp.js");
const {
  StreamableHTTPServerTransport,
} = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const { SSEServerTransport } = require("@modelcontextprotocol/sdk/server/sse.js");
const { isInitializeRequest } = require("@modelcontextprotocol/sdk/types.js");

const { registerAll } = require("./mcp-tools");

const HOST = "127.0.0.1";
const SERVER_INFO = { name: "carabiner", version: "1.0.0" };

let httpServer = null;
let currentPort = null;
let activeCtx = null;
// Streamable HTTP transports keyed by mcp session id.
const streamableTransports = new Map();
// SSE transports keyed by session id.
const sseTransports = new Map();

function isRunning() {
  return httpServer !== null;
}

function getPort() {
  return currentPort;
}

function buildServer() {
  const server = new McpServer(SERVER_INFO);
  registerAll(server, activeCtx);
  return server;
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      if (!data) {
        resolve(undefined);
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(undefined);
      }
    });
    req.on("error", () => resolve(undefined));
  });
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function isAuthorized(req) {
  const token = activeCtx.getAuthToken();
  if (!token) return true; // No token configured: auth disabled.
  const header = req.headers["authorization"] || "";
  return header === `Bearer ${token}`;
}

async function handleStreamablePost(req, res, body) {
  const sessionId = req.headers["mcp-session-id"];
  let transport = sessionId ? streamableTransports.get(sessionId) : undefined;

  if (!transport) {
    if (sessionId || !isInitializeRequest(body)) {
      sendJson(res, 400, {
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: no valid session for this request." },
        id: null,
      });
      return;
    }
    // New initialization request: create a session-managed transport.
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => streamableTransports.set(id, transport),
    });
    transport.onclose = () => {
      if (transport.sessionId) streamableTransports.delete(transport.sessionId);
    };
    const server = buildServer();
    await server.connect(transport);
  }

  await transport.handleRequest(req, res, body);
}

async function handleStreamableSession(req, res) {
  const sessionId = req.headers["mcp-session-id"];
  const transport = sessionId ? streamableTransports.get(sessionId) : undefined;
  if (!transport) {
    sendJson(res, 400, {
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request: unknown or missing session id." },
      id: null,
    });
    return;
  }
  await transport.handleRequest(req, res);
}

async function handleSseConnect(req, res) {
  const transport = new SSEServerTransport("/messages", res);
  sseTransports.set(transport.sessionId, transport);
  res.on("close", () => sseTransports.delete(transport.sessionId));
  const server = buildServer();
  await server.connect(transport);
}

async function handleSseMessage(req, res, url) {
  const sessionId = url.searchParams.get("sessionId");
  const transport = sessionId ? sseTransports.get(sessionId) : undefined;
  if (!transport) {
    sendJson(res, 400, { error: "No active SSE session for the provided sessionId." });
    return;
  }
  await transport.handlePostMessage(req, res);
}

async function onRequest(req, res) {
  try {
    if (!isAuthorized(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    const url = new URL(req.url, `http://${HOST}`);
    const pathname = url.pathname;

    if (pathname === "/mcp") {
      if (req.method === "POST") {
        const body = await readJsonBody(req);
        await handleStreamablePost(req, res, body);
      } else if (req.method === "GET" || req.method === "DELETE") {
        await handleStreamableSession(req, res);
      } else {
        sendJson(res, 405, { error: "Method Not Allowed" });
      }
      return;
    }

    if (pathname === "/sse" && req.method === "GET") {
      await handleSseConnect(req, res);
      return;
    }

    if (pathname === "/messages" && req.method === "POST") {
      await handleSseMessage(req, res, url);
      return;
    }

    sendJson(res, 404, { error: "Not Found" });
  } catch (error) {
    log.error("[MCP] Request error:", error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: "Internal Server Error" });
    }
  }
}

/**
 * Start the MCP server. `ctx` provides all the internal accessors the tool handlers need.
 * Returns { running, port, error }.
 */
function startMcpServer(ctx) {
  return new Promise((resolve) => {
    if (isRunning()) {
      resolve({ running: true, port: currentPort });
      return;
    }
    activeCtx = ctx;
    const port = ctx.getSettings().mcp?.port || 7734;

    httpServer = http.createServer(onRequest);
    httpServer.on("error", (error) => {
      log.error("[MCP] Server error:", error);
      httpServer = null;
      currentPort = null;
      resolve({ running: false, port, error: error.message });
    });
    httpServer.listen(port, HOST, () => {
      currentPort = port;
      log.info(`[MCP] Server listening on http://${HOST}:${port} (/mcp and /sse)`);
      resolve({ running: true, port });
    });
  });
}

/** Stop the MCP server and close all active transports. */
async function stopMcpServer() {
  for (const transport of streamableTransports.values()) {
    try {
      await transport.close();
    } catch {
      /* ignore */
    }
  }
  streamableTransports.clear();
  for (const transport of sseTransports.values()) {
    try {
      await transport.close();
    } catch {
      /* ignore */
    }
  }
  sseTransports.clear();

  if (httpServer) {
    await new Promise((resolve) => httpServer.close(() => resolve()));
    httpServer = null;
  }
  currentPort = null;
  log.info("[MCP] Server stopped");
  return { running: false };
}

module.exports = { startMcpServer, stopMcpServer, isRunning, getPort };
