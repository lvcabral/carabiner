// settings.js only touches Electron when it loads/saves the file, so its pure helpers import directly.
import { migrateSettings, makePair } from "../../public/settings";
import { normalizeRceAccounts } from "../../public/rce-accounts";
import {
  controlTypeOf,
  controlValueOf,
  isChosen,
  userControls,
  videoEntries,
} from "../components/devices/devicesModel";

// A settings.json as written by 2.3 (pairs model): one Display window per capture card, the
// device catalog with every 2.x control type, and the legacy single-window keys 2.2 left behind.
const settings23 = () => ({
  display: { deviceId: "capA", visible: true, showInDock: true, autoUpdate: true, singleWindowMode: true },
  border: {},
  displayWindow: { x: 10, y: 20, width: 500, height: 290 },
  control: {
    deviceId: "192.168.1.10|ecp",
    adbPath: "/usr/local/bin/adb",
    atvremotePath: "/usr/local/bin/atvremote",
    deviceList: [
      { id: "192.168.1.10|ecp", ipAddress: "192.168.1.10", alias: "", linked: "capA", type: "Roku" },
      { id: "192.168.1.11|adb", ipAddress: "192.168.1.11", alias: "Fire", linked: "", type: "Fire TV" },
      { id: "AA:BB:CC:DD:EE:FF|atv", ipAddress: "AA:BB:CC:DD:EE:FF", alias: "Den", linked: "", type: "Apple TV" },
      { id: "192.168.1.12:9998|rdk", ipAddress: "192.168.1.12", alias: "Xumo", linked: "", type: "Xumo Stream Box", port: 9998, token: "" },
      { id: "192.168.1.13|ecp", ipAddress: "192.168.1.13", type: "Roku" }, // added before aliases existed
    ],
  },
  files: { screenshotPath: "", recordingPath: "" },
  scripts: [{ id: "s1", name: "Home", steps: [{ key: "home", delay: 0 }] }],
  mcp: { enabled: true, port: 7734, token: "" },
  pairs: [
    {
      id: "capA",
      captureDeviceId: "capA",
      controlDeviceId: "192.168.1.10|ecp",
      visible: true,
      bounds: { x: 10, y: 20, width: 500, height: 290 },
      border: { width: "2px", style: "solid", color: "#ff0000" },
      transparency: 0.2,
      resolution: "480px|270px",
      captureWidth: 1920,
      captureHeight: 1080,
      alwaysOnTop: false,
      audioEnabled: true,
      overlayImagePath: "/tmp/ref.png",
      overlayOpacity: 0.5,
    },
    { id: "capB", captureDeviceId: "capB", controlDeviceId: "192.168.1.11|adb", visible: false },
  ],
  activePairId: "capA",
});

describe("settings from 2.x", () => {
  test("2.3 windows keep their settings, control links and Enabled state", () => {
    const original = settings23();
    const settings = migrateSettings(settings23());
    expect(settings.pairs).toHaveLength(2);
    expect(settings.pairs[0]).toMatchObject(original.pairs[0]);
    expect(settings.pairs[0].controlMode).toBeUndefined();
    expect(settings.pairs[1]).toMatchObject({ id: "capB", controlDeviceId: "192.168.1.11|adb", visible: false });
    expect(settings.activePairId).toBe("capA");
    // Everything else, including the legacy single-window keys a downgrade still reads, is untouched.
    for (const key of ["display", "border", "displayWindow", "control", "files", "scripts", "mcp"]) {
      expect(settings[key]).toEqual(original[key]);
    }
  });

  test("first launch on 2.x settings changes nothing that needs saving", () => {
    const settings = migrateSettings(settings23());
    const before = JSON.stringify(settings);
    expect(normalizeRceAccounts(settings, { unseal: (t) => t, newId: () => "acct-1" })).toBe(false);
    // The only addition is the empty accounts list loadSettings' defaults provide anyway.
    expect(settings.rce).toEqual({ accounts: [] });
    delete settings.rce;
    expect(JSON.stringify(settings)).toBe(before);
  });

  test("every 2.x capture card and control device shows on the Video and Control tabs", () => {
    const settings = migrateSettings(settings23());
    const entries = videoEntries({
      captureDevices: [{ deviceId: "capA", label: "usb video (534d:2109)" }, { deviceId: "capB", label: "Cam Link 4K" }],
      streamSources: settings.streams?.sources,
      hiddenCaptureIds: settings.video?.hiddenCaptureIds,
    });
    expect(entries.map((e) => [e.id, e.chosen])).toEqual([
      ["capA", true],
      ["capB", true],
    ]);
    const controls = userControls(settings.control.deviceList);
    expect(controls.map((d) => [d.id, isChosen(d), controlTypeOf(d).key])).toEqual([
      ["192.168.1.10|ecp", true, "roku"],
      ["192.168.1.11|adb", true, "firetv"],
      ["AA:BB:CC:DD:EE:FF|atv", true, "appletv"],
      ["192.168.1.12:9998|rdk", true, "xumo"],
      ["192.168.1.13|ecp", true, "roku"],
    ]);
    // Each window's Control select shows the device it was linked to in 2.x.
    expect(settings.pairs.map(controlValueOf)).toEqual(["192.168.1.10|ecp", "192.168.1.11|adb"]);
  });

  test("pre-2.2 single-window settings become one window with the same control", () => {
    const legacy = settings23();
    delete legacy.pairs;
    delete legacy.activePairId;
    const settings = migrateSettings(legacy);
    expect(settings.pairs).toHaveLength(1);
    expect(settings.pairs[0]).toMatchObject({
      id: "capA",
      captureDeviceId: "capA",
      controlDeviceId: "192.168.1.10|ecp",
      visible: true,
      bounds: { x: 10, y: 20, width: 500, height: 290 },
    });
    expect(settings.activePairId).toBe("capA");
  });

  test("pre-2.2 settings without control.deviceId fall back to the device linked to the card", () => {
    const legacy = settings23();
    delete legacy.pairs;
    delete legacy.control.deviceId;
    expect(migrateSettings(legacy).pairs[0].controlDeviceId).toBe("192.168.1.10|ecp");
  });
});

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
