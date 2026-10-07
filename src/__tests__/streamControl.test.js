// Keys for a stream's built-in control are sent from main (public/stream-signaling.js).
import { sendControlKey } from "../../public/stream-signaling";

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
