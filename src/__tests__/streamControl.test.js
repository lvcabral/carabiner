// Keys for a stream's built-in control are sent from main (public/stream-signaling.js).
import { sendControlKey } from "../../public/stream-signaling";
import { dropDuplicateSimulators, simulatorKey } from "../../public/stream-utils";
import { simulatorKey as uiSimulatorKey } from "../components/devices/devicesModel";

test("main keeps one simulator per address, however it was added", () => {
  // Enter then Add while the probe ran, by hand after detection (127.0.0.1 = localhost), or a
  // default port: only the first one at an address is kept.
  const sources = [
    { id: "sim-a", type: "sim", host: "localhost", port: 8090 },
    { id: "sim-b", type: "sim", host: "127.0.0.1", port: 8090 },
    { id: "sim-c", type: "sim", host: "LOCALHOST" },
    { id: "sim-d", type: "sim", host: "localhost", port: 8091 },
    { id: "sim-e", type: "sim", host: "10.0.0.2", port: 8090 },
    { id: "rce-1", type: "rce" },
  ];
  expect(dropDuplicateSimulators(sources).map((s) => s.id)).toEqual(["sim-a", "sim-d", "sim-e", "rce-1"]);
  // The settings window's copy of the rule (for its error message) matches main's.
  for (const src of sources.slice(0, 5)) expect(uiSimulatorKey(src)).toBe(simulatorKey(src));
});

describe("stream URL built-in control (Same host as stream)", () => {
  const posted = [];
  beforeEach(() => {
    posted.length = 0;
    vi.stubGlobal("fetch", async (url, opts) => {
      posted.push([url, opts.method]);
      return { ok: true, status: 200 };
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  test("sends ECP to the stream URL's host, including a hostname", async () => {
    await sendControlKey({ id: "w1", type: "webrtc", url: "http://mediamtx.local:8889/cam/whep" }, "select");
    await sendControlKey({ id: "w2", type: "webrtc", url: "https://localhost/whep" }, "up", 0);
    await sendControlKey({ id: "w3", type: "webrtc", url: "http://192.168.1.60:8889/whep" }, "lit_%41", 100);
    expect(posted).toEqual([
      ["http://mediamtx.local:8060/keypress/select", "POST"],
      ["http://localhost:8060/keydown/up", "POST"],
      ["http://192.168.1.60:8060/keyup/lit_%41", "POST"],
    ]);
  });
});
