import {
  addManualDevice,
  applyControlSelection,
  applyVideoSelection,
  controlPatch,
  controlValueOf,
  defaultControlName,
  isChosen,
  renameControl,
  mergeScanResults,
  resetPairingsFor,
  setPairFor,
  splitCaptureLabel,
  userControls,
  validateStreamUrl,
  videoEntries,
} from "./devicesModel";

const roku = (ip, extra = {}) => ({ id: `${ip}|ecp`, ipAddress: ip, alias: `Roku ${ip}`, linked: "", type: "Roku", ...extra });

describe("existing settings (no chosen flags yet)", () => {
  const captureDevices = [{ deviceId: "usb", label: "usb video (534d:2109)" }];
  const streamSources = [
    { id: "rce-1", type: "rce", name: "Set Top Box", deviceId: 7, accountId: "a1" },
    { id: "sim-1", type: "sim", name: "Simulator", host: "localhost", port: 8090 },
  ];
  test("every capture device and stream shows as chosen", () => {
    const entries = videoEntries({ captureDevices, streamSources });
    expect(entries.map((e) => [e.id, e.kind, e.chosen])).toEqual([
      ["usb", "capture", true],
      ["stream:rce-1", "rce", true],
      ["stream:sim-1", "simulator", true],
    ]);
  });
  test("every control device shows as chosen; stream-managed controls are never listed", () => {
    const list = [roku("192.168.1.41"), { id: "10.0.0.2|adb", ipAddress: "10.0.0.2", type: "Fire TV" }, { id: "streamctl:rce-1|ecp", managedBy: "rce-1" }];
    expect(userControls(list).filter(isChosen).map((d) => d.id)).toEqual(["192.168.1.41|ecp", "10.0.0.2|adb"]);
  });
});

describe("dedupe by address", () => {
  test("a scan that finds a known address updates that entry instead of adding one", () => {
    const list = [{ ...roku("192.168.1.43"), alias: "" }];
    const res = mergeScanResults(list, [{ ipAddress: "192.168.1.43", name: "Bench 3" }, { ipAddress: "192.168.1.44", name: "Bench 4" }]);
    expect(res.deviceList).toHaveLength(2);
    expect(res.deviceList[0]).toMatchObject({ id: "192.168.1.43|ecp", alias: "Bench 3" });
    expect(res.deviceList[1]).toMatchObject({ id: "192.168.1.44|ecp", chosen: false });
    expect(res.addedCount).toBe(1);
    expect([...res.foundIds]).toEqual(["192.168.1.43|ecp", "192.168.1.44|ecp"]);
  });

  test("a device that was never renamed follows its reported name; a renamed one keeps its name", () => {
    const list = [
      { ...roku("192.168.1.41"), alias: "Old Name", deviceName: "Old Name" },
      { ...roku("192.168.1.42"), alias: "My Bench", deviceName: "Old Name" },
    ];
    const res = mergeScanResults(list, [{ ipAddress: "192.168.1.41", name: "Ultra" }, { ipAddress: "192.168.1.42", name: "Stick" }]);
    expect(res.deviceList.map((d) => [d.alias, d.deviceName])).toEqual([
      ["Ultra", "Ultra"],
      ["My Bench", "Stick"],
    ]);
  });

  test("clearing a rename goes back to the device's own name", () => {
    const d = { ...roku("192.168.1.41"), alias: "My Bench", deviceName: "Ultra" };
    expect(renameControl(d, "").alias).toBe("Ultra");
    expect(renameControl(d, "Desk").alias).toBe("Desk");
    expect(defaultControlName(roku("10.0.0.1"))).toBeNull(); // typed in by hand, no reported name
  });

  test("a scan matches a manually added device at the same address (no discovered/manual distinction)", () => {
    const list = [{ id: "192.168.1.50|adb", ipAddress: "192.168.1.50", alias: "Shield", type: "Google TV" }];
    const res = mergeScanResults(list, [{ ipAddress: "192.168.1.50", name: "Something" }]);
    expect(res.deviceList).toEqual([{ ...list[0], deviceName: "Something" }]);
    expect(res.addedCount).toBe(0);
  });

  test("adding an address by hand that already exists returns the existing entry", () => {
    const list = [roku("192.168.1.41")];
    expect(addManualDevice(list, { typeKey: "firetv", address: "192.168.1.41" }).duplicate.id).toBe("192.168.1.41|ecp");
  });

  test("a new manual device gets a default name and is chosen", () => {
    const res = addManualDevice([], { typeKey: "roku", address: "10.20.4.17" });
    expect(res.device).toMatchObject({ id: "10.20.4.17|ecp", alias: "Roku 10.20.4.17", type: "Roku" });
    expect(isChosen(res.device)).toBe(true);
  });

  test("RDK boxes on the same IP but different ports are different devices", () => {
    const list = [{ id: "10.0.0.9:9998|rdk", ipAddress: "10.0.0.9", port: 9998, type: "Xumo Stream Box" }];
    expect(addManualDevice(list, { typeKey: "xumo", address: "10.0.0.9", port: "9998" }).duplicate).toBeTruthy();
    expect(addManualDevice(list, { typeKey: "xumo", address: "10.0.0.9", port: "9999" }).device.id).toBe("10.0.0.9:9999|rdk");
  });

  test("validation errors", () => {
    expect(addManualDevice([], { typeKey: "roku", address: "not an ip" }).error).toBeTruthy();
    expect(addManualDevice([], { typeKey: "appletv", address: "aa:bb:cc:dd:ee:ff" }).device).toBeTruthy();
    expect(addManualDevice([], { typeKey: "xumo", address: "10.0.0.9", port: "70000" }).error).toBeTruthy();
  });
});

describe("pairing reset on delete or uncheck", () => {
  const pairs = [
    { id: "usb", captureDeviceId: "usb", controlDeviceId: "192.168.1.43|ecp", visible: true },
    { id: "c920", captureDeviceId: "c920", controlDeviceId: "192.168.1.41|ecp", visible: false },
    { id: "stream:w", captureDeviceId: "stream:w", controlDeviceId: "10.0.0.5|ecp", controlMode: "host", visible: true },
  ];
  test("resetPairingsFor unlinks and reports only the affected pairs", () => {
    const { pairs: next, affected } = resetPairingsFor(pairs, ["192.168.1.43|ecp"]);
    expect(affected.map((p) => p.id)).toEqual(["usb"]);
    expect(next[0].controlDeviceId).toBe("");
    expect(next[1]).toBe(pairs[1]);
  });

  test("unchecking a device resets its pairings", () => {
    const list = [roku("192.168.1.41"), roku("192.168.1.43")];
    const res = applyControlSelection(list, new Set(["192.168.1.41|ecp"]), pairs);
    expect(res.deviceList.map((d) => isChosen(d))).toEqual([true, false]);
    expect(res.affected.map((p) => p.id)).toEqual(["usb"]);
    expect(res.pairs.find((p) => p.id === "stream:w").controlMode).toBe("host");
  });
});

describe("video selection", () => {
  const captureDevices = [{ deviceId: "usb", label: "usb video" }, { deviceId: "obs", label: "OBS Virtual Camera" }];
  const streamSources = [
    { id: "rce-1", type: "rce", name: "A" },
    { id: "rce-2", type: "rce", name: "B", chosen: false },
  ];
  const pairs = [{ id: "usb", captureDeviceId: "usb", controlDeviceId: "", visible: true }];

  test("sets chosen flags and hidden captures, and deactivates unchecked sources", () => {
    const entries = videoEntries({ captureDevices, streamSources });
    const chosen = new Set(["obs", "stream:rce-1", "stream:rce-2"]);
    const res = applyVideoSelection({ entries, streamSources, hiddenCaptureIds: [], pairs }, chosen);
    expect(res.hiddenCaptureIds).toEqual(["usb"]);
    expect(res.streamSources.map(isChosen)).toEqual([true, true]);
    expect(res.streamSources[1].chosen).toBeUndefined(); // chosen is stored by omission
    expect(res.pairs[0].visible).toBe(false);
  });

  test("hidden ids of capture cards that aren't plugged in are kept", () => {
    const entries = videoEntries({ captureDevices, streamSources });
    const res = applyVideoSelection({ entries, streamSources, hiddenCaptureIds: ["unplugged"], pairs }, new Set(["usb", "obs"]));
    expect(res.hiddenCaptureIds).toEqual(["unplugged"]);
  });
});

describe("control choice and pairs", () => {
  test("same host / viewer / device / none", () => {
    expect(controlPatch("host", { host: "10.0.0.5" })).toEqual({ controlDeviceId: "10.0.0.5|ecp", controlMode: "host" });
    expect(controlPatch("192.168.1.41|ecp")).toEqual({ controlDeviceId: "192.168.1.41|ecp", controlMode: undefined });
    expect(controlPatch("none").controlDeviceId).toBe("");
    expect(controlValueOf({ controlDeviceId: "10.0.0.5|ecp", controlMode: "host" })).toBe("host");
    expect(controlValueOf(null)).toBe("none");
  });

  test("single-window mode: activating one source deactivates the others", () => {
    const pairs = [{ id: "a", captureDeviceId: "a", controlDeviceId: "x|ecp", visible: true }];
    const next = setPairFor(pairs, "b", { visible: true }, { singleWindowMode: true });
    expect(next.map((p) => [p.id, p.visible])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  test("a hidden, unlinked pair is dropped, but a hidden pair with a control mode is kept", () => {
    expect(setPairFor([], "a", { visible: false })).toEqual([]);
    expect(setPairFor([], "w", controlPatch("host", { host: "h" }))).toHaveLength(1);
  });
});

test("stream URL validation and capture labels", () => {
  expect(validateStreamUrl("http://192.168.1.60:8889/cam/whep")).toBeNull();
  expect(validateStreamUrl("ftp://x")).toBeTruthy();
  expect(validateStreamUrl("wss://x/y")).toMatch(/WebSocket/);
  expect(splitCaptureLabel("usb video (534d:2109)")).toEqual({ name: "usb video", hardwareId: "534d:2109" });
  expect(splitCaptureLabel("OBS Virtual Camera")).toEqual({ name: "OBS Virtual Camera", hardwareId: "" });
});
