// settings.js only touches Electron when it loads/saves the file, so its pure helpers import directly.
import { migrateSettings, makePair } from "../../public/settings";

describe("settings compatibility", () => {
  test("pairs keep their control link, and a stream's control mode survives normalization", () => {
    const settings = {
      streams: { sources: [{ id: "webrtc-1", type: "webrtc", name: "Cam", url: "http://10.0.0.5:8889/whep" }] },
      pairs: [
        { id: "cap1", captureDeviceId: "cap1", controlDeviceId: "192.168.1.43|ecp", visible: true },
        { id: "stream:webrtc-1", captureDeviceId: "stream:webrtc-1", controlDeviceId: "10.0.0.5|ecp", controlMode: "host", visible: false },
      ],
    };
    migrateSettings(settings);
    expect(settings.pairs.map((p) => [p.id, p.controlDeviceId, p.controlMode, p.visible])).toEqual([
      ["cap1", "192.168.1.43|ecp", undefined, true],
      ["stream:webrtc-1", "10.0.0.5|ecp", "host", false],
    ]);
  });

  test("unknown control modes are dropped rather than passed through", () => {
    expect(makePair({ id: "x", captureDeviceId: "x", controlMode: "bogus" }).controlMode).toBeUndefined();
  });

  test("new optional fields survive a load/save round trip untouched", () => {
    const settings = {
      rce: { accounts: [{ id: "a1", label: "Default", token: "enc:t", tail: "abcd" }] },
      video: { hiddenCaptureIds: ["obs"] },
      control: { deviceList: [{ id: "1.2.3.4|ecp", ipAddress: "1.2.3.4", alias: "Bench", type: "Roku", chosen: false }] },
      streams: { sources: [{ id: "rce-1", type: "rce", deviceId: 5, token: "enc:t", accountId: "a1", chosen: false }] },
      pairs: [],
    };
    const before = JSON.parse(JSON.stringify(settings));
    migrateSettings(settings);
    expect(settings.rce).toEqual(before.rce);
    expect(settings.video).toEqual(before.video);
    expect(settings.control).toEqual(before.control);
    expect(settings.streams).toEqual(before.streams);
  });
});
