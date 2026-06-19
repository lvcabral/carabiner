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
const SsdpClient = require("@lvcabral/node-ssdp").Client;

const ECP_PORT = 8060;

// Pull the text content of a single XML tag out of a Roku device-info response.
function getXmlTag(xml, tag) {
  const match = xml.match(new RegExp(`<${tag}>([^<]*)</${tag}>`, "i"));
  return match ? match[1].trim() : "";
}

// Strip the word "Roku" from a device name so it reads well as an alias.
function buildAlias(name) {
  return name.replace(/\broku\b/gi, "").replace(/\s{2,}/g, " ").trim();
}

// Fetch http://<ip>:8060/query/device-info and derive a friendly name + alias.
// Resolves to a device record even on failure (falling back to the IP).
function fetchDeviceInfo(ipAddress, timeoutMs = 2000) {
  return new Promise((resolve) => {
    const fallback = () => {
      const name = `Roku ${ipAddress}`;
      resolve({ ipAddress, name, alias: buildAlias(name), model: "" });
    };
    const req = http.request(
      {
        host: ipAddress,
        port: ECP_PORT,
        path: "/query/device-info",
        method: "GET",
        timeout: timeoutMs,
      },
      (res) => {
        let data = "";
        res.setEncoding("utf8");
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          if (res.statusCode < 200 || res.statusCode >= 300) {
            fallback();
            return;
          }
          const userName = getXmlTag(data, "user-device-name");
          const friendlyName = getXmlTag(data, "friendly-device-name");
          const model = getXmlTag(data, "friendly-model-name") || getXmlTag(data, "model-name");
          const name = userName || friendlyName || model || `Roku ${ipAddress}`;
          resolve({ ipAddress, name, alias: buildAlias(name), model });
        });
      }
    );
    req.on("timeout", () => req.destroy(new Error("timeout")));
    req.on("error", fallback);
    req.end();
  });
}

// Discover Roku devices on the LAN via SSDP (search target "roku:ecp").
// Always resolves to an array; never rejects.
function discoverRokuDevices(timeoutMs = 3000) {
  return new Promise((resolve) => {
    const found = new Map(); // ipAddress -> true (dedupe by IP)
    let client;
    try {
      // explicitSocketBind binds each socket to its interface IP instead of
      // 0.0.0.0, so multicast search/replies use the correct adapter. Without
      // it, Windows hosts with multiple adapters (VPN/Hyper-V/WSL/etc.) only
      // discover devices on the default-route interface.
      client = new SsdpClient({ explicitSocketBind: true });
    } catch (err) {
      console.warn(`SSDP client init failed: ${err.message}`);
      resolve([]);
      return;
    }

    client.on("response", (headers, statusCode, rinfo) => {
      const ip = rinfo && rinfo.address;
      if (ip && !found.has(ip)) {
        found.set(ip, true);
      }
    });

    try {
      client.search("roku:ecp");
    } catch (err) {
      console.warn(`SSDP search failed: ${err.message}`);
      try {
        client.stop();
      } catch {}
      resolve([]);
      return;
    }

    setTimeout(async () => {
      try {
        client.stop();
      } catch {}
      try {
        const devices = await Promise.all([...found.keys()].map((ip) => fetchDeviceInfo(ip)));
        resolve(devices);
      } catch (err) {
        console.warn(`SSDP enrichment failed: ${err.message}`);
        resolve([]);
      }
    }, timeoutMs);
  });
}

module.exports = {
  discoverRokuDevices,
};
