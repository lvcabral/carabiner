import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The settings UI talks to main through window.electronAPI (preload). Stub it before App loads.
const settings = {
  display: { singleWindowMode: true, darkMode: false },
  control: { deviceList: [{ id: "192.168.1.43|ecp", ipAddress: "192.168.1.43", alias: "Bench 3", linked: "", type: "Roku" }] },
  streams: { sources: [] },
  rce: { accounts: [] },
  video: { hiddenCaptureIds: [] },
  pairs: [{ id: "usb", captureDeviceId: "usb", controlDeviceId: "192.168.1.43|ecp", visible: true }],
  activePairId: "usb",
  scripts: [],
  files: {},
  mcp: {},
};
// Plain functions that record their calls, so tests can check what was sent to main.
const calls = [];
const record = (kind) => (...args) => {
  calls.push([kind, ...args]);
  return kind === "sendSync" ? true : undefined;
};
const invoke = async (channel, ...args) => {
  calls.push(["invoke", channel, ...args]);
  if (channel === "load-settings") return settings;
  if (channel === "discover-roku-devices") return { success: true, devices: [] };
  if (channel === "check-control-devices") return { "192.168.1.43|ecp": true };
  if (channel === "get-pairs") return { pairs: settings.pairs, activePairId: "usb" };
  if (channel === "get-scripts") return [];
  if (channel === "get-mcp-status") return { running: false, port: 7734 };
  if (channel === "get-capture-devices") return [];
  if (channel === "get-largest-display-size") return { width: 1920, height: 1080 };
  // A slow probe, so a second Add can arrive while the first is still waiting on it.
  if (channel === "test-stream-source") return new Promise((r) => setTimeout(() => r({ ok: true, config: { ecpPort: 8060 } }), 50));
  if (channel === "rce-rename-account") return { ok: true, account: { id: args[0].accountId, label: args[0].label } };
  if (channel === "get-package-info") return { version: "0.0.0", repository: { url: "" } };
  return null;
};
window.electronAPI = {
  invoke,
  send: record("send"),
  sendSync: record("sendSync"),
  onMessageReceived: () => {},
  removeListener: () => {},
  getPackageInfo: async () => ({ version: "0.0.0", repository: { url: "https://github.com/lvcabral/carabiner" } }),
  openExternal: record("openExternal"),
  log: () => {},
};
const sent = (kind, channel) => calls.some(([k, c]) => k === kind && c === channel);
Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    enumerateDevices: async () => [{ kind: "videoinput", deviceId: "usb", label: "usb video (534d:2109)" }],
    getUserMedia: async () => ({ getTracks: () => [] }),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
});
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));

// Components read window.electronAPI when they load, so App is imported after the stub above.
let App;
beforeAll(async () => {
  App = (await import("./App")).default;
});

// General opens first; switch to another tab.
const renderTab = (name) => {
  render(<App />);
  userEvent.click(screen.getByRole("tab", { name }));
};
const panel = (name) => screen.getByRole("tabpanel", { name });

test("General, Video, Control; Video lists the chosen sources and Control the chosen devices", async () => {
  render(<App />);
  const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
  expect(tabs.slice(0, 3)).toEqual(["General", "Video", "Control"]);
  expect(tabs).not.toContain("Devices");
  expect(tabs).not.toContain("Streams");
  userEvent.click(screen.getByRole("tab", { name: "Video" }));
  const video = panel("Video");
  expect(await within(video).findByText("usb video")).toBeInTheDocument();
  expect(within(video).getByLabelText("Control for usb video")).toHaveValue("192.168.1.43|ecp");
  expect(within(video).queryByText("Bench 3")).not.toBeInTheDocument(); // only as a Control option
  userEvent.click(screen.getByRole("tab", { name: "Control" }));
  const control = panel("Control");
  expect(await within(control).findByText("Controls usb video")).toBeInTheDocument();
  expect(within(control).getByText("Bench 3")).toBeInTheDocument();
  expect(within(control).queryByLabelText("Control for usb video")).not.toBeInTheDocument();
});

test("a Simulator's built-in control shows on its Video row, not on the Control tab", async () => {
  const sim = { id: "sim-1", type: "sim", name: "Desk Sim", host: "localhost", port: 8090, controlId: "streamctl:sim-1|ecp" };
  settings.streams.sources = [sim];
  settings.control.deviceList.push({ id: "streamctl:sim-1|ecp", ipAddress: "localhost:8060", alias: "Desk Sim", type: "Roku", managedBy: "sim-1" });
  try {
    renderTab("Video");
    const video = panel("Video");
    expect(await within(video).findByText("Desk Sim")).toBeInTheDocument();
    expect(within(video).getByText("Included with the stream")).toBeInTheDocument();
    userEvent.click(screen.getByRole("tab", { name: "Control" }));
    const control = panel("Control");
    expect(await within(control).findByText("Bench 3")).toBeInTheDocument();
    expect(within(control).queryByText("Desk Sim")).not.toBeInTheDocument();
    expect(within(control).queryByText("Comes with its video")).not.toBeInTheDocument();
  } finally {
    settings.streams.sources = [];
    settings.control.deviceList.pop();
  }
});

test("Choose video lists Cloud Emulator accounts before Simulators, and an account can be renamed", async () => {
  settings.rce.accounts = [{ id: "a1", label: "Default", tail: "c3f9" }];
  try {
    renderTab("Video");
    await within(panel("Video")).findByText("usb video");
    userEvent.click(screen.getByRole("button", { name: "Choose video" }));
    const dialog = await screen.findByRole("dialog");
    const groups = within(dialog)
      .getAllByRole("button", { expanded: true })
      .map((b) => b.textContent);
    expect(groups).toEqual(["This computer", "Default", "BrightScript Simulators", "Stream URLs"]);
    // Account actions are the same icon buttons as on the Video tab (named for screen readers, no text).
    for (const action of ["Refresh", "Rename", "Remove"]) {
      const button = within(dialog).getByRole("button", { name: `${action} Default` });
      expect(button).toHaveClass("icon-btn");
      expect(button).toHaveTextContent("");
      expect(button.querySelector("svg")).not.toBeNull();
    }

    // Escape cancels the rename without closing the dialog.
    userEvent.click(within(dialog).getByRole("button", { name: "Rename Default" }));
    userEvent.type(within(dialog).getByLabelText("Account name"), "{esc}");
    expect(within(dialog).queryByLabelText("Account name")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    userEvent.click(within(dialog).getByRole("button", { name: "Rename Default" }));
    const input = within(dialog).getByLabelText("Account name");
    expect(input).toHaveValue("Default");
    userEvent.clear(input);
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    userEvent.type(input, "Staging{enter}");
    await waitFor(() => expect(within(dialog).queryByLabelText("Account name")).not.toBeInTheDocument());
    expect(calls).toContainEqual(["invoke", "rce-rename-account", { accountId: "a1", label: "Staging" }]);
  } finally {
    settings.rce.accounts = [];
  }
});

test("a stream URL defaults to its own Same host control, even with a hostname", async () => {
  renderTab("Video");
  await within(panel("Video")).findByText("usb video");
  userEvent.click(screen.getByRole("button", { name: "Choose video" }));
  const dialog = await screen.findByRole("dialog");
  userEvent.type(within(dialog).getByLabelText("Stream URL"), "http://mediamtx.local:8889/cam/whep");
  userEvent.type(within(dialog).getByLabelText("Stream name"), "Cam");
  userEvent.click(within(dialog).getAllByRole("button", { name: "Add" }).pop());
  const pairsSent = calls.filter(([k, c]) => k === "send" && c === "set-pairs");
  const pair = pairsSent[pairsSent.length - 1][2].find((p) => p.captureDeviceId.startsWith("stream:webrtc-"));
  const sourceId = pair.captureDeviceId.slice("stream:".length);
  expect(pair.controlDeviceId).toBe(`streamctl:${sourceId}|ecp`); // its built-in control, not "mediamtx.local|ecp"
  expect(pair.controlMode).toBeUndefined();
  userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  const select = within(panel("Video")).getByLabelText("Control for Cam");
  expect(select).toHaveValue("host");
  expect(within(select).getByRole("option", { name: "Same host as stream (mediamtx.local)" })).toBeInTheDocument();
});

test("pressing Enter and then Add while a simulator is being checked adds it once", async () => {
  renderTab("Video");
  await within(panel("Video")).findByText("usb video");
  userEvent.click(screen.getByRole("button", { name: "Choose video" }));
  const dialog = await screen.findByRole("dialog");
  userEvent.type(within(dialog).getByLabelText("Simulator host"), "192.168.1.70{enter}");
  userEvent.click(within(dialog).getAllByRole("button", { name: "Add" })[0]);
  await within(dialog).findByText("192.168.1.70:8090");
  await new Promise((r) => setTimeout(r, 120)); // both probes have settled
  const sent = calls.filter(([k, , msg]) => k === "sendSync" && msg?.type === "set-stream-sources");
  const simsSent = sent.map(([, , msg]) => msg.payload.filter((src) => src.type === "sim" && src.host === "192.168.1.70").length);
  expect(Math.max(...simsSent)).toBe(1);
  expect(within(dialog).getAllByText("192.168.1.70:8090")).toHaveLength(1);
});

test("Choose more devices… on a Video row opens Choose control devices", async () => {
  renderTab("Video");
  const select = await within(panel("Video")).findByLabelText("Control for usb video");
  userEvent.selectOptions(select, "__choose");
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).getByText("Choose control devices")).toBeInTheDocument();
  expect(select).toHaveValue("192.168.1.43|ecp"); // the link didn't change
});

test("General links the Android and Apple TV setup guides under the tool paths", async () => {
  render(<App />);
  const android = await screen.findByRole("link", { name: /Android TV, Fire TV and Google TV setup guide/ });
  const apple = screen.getByRole("link", { name: /Apple TV setup guide/ });
  expect(android).toHaveAttribute("href", "https://github.com/lvcabral/carabiner/blob/main/docs/setup-android-firetv.md");
  expect(apple).toHaveAttribute("href", "https://github.com/lvcabral/carabiner/blob/main/docs/setup-apple-tv.md");
  userEvent.click(apple);
  expect(calls).toContainEqual(["openExternal", "https://github.com/lvcabral/carabiner/blob/main/docs/setup-apple-tv.md"]);
});

test("Choose video: a checkbox applies right away, Done and Escape close", async () => {
  renderTab("Video");
  await screen.findByText("usb video");
  userEvent.click(screen.getByRole("button", { name: "Choose video" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  const box = within(dialog).getByRole("checkbox");
  expect(box).toBeChecked();
  userEvent.click(box);
  await waitFor(() => expect(box).not.toBeChecked());
  expect(sent("send", "set-video-selection")).toBe(true);
  userEvent.click(within(dialog).getByRole("button", { name: "Done" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.queryByText("usb video")).not.toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Choose video" }));
  await screen.findByRole("dialog");
  userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
});

test("deleting a control device asks first; Cancel keeps it", async () => {
  renderTab("Control");
  await screen.findByText("Controls usb video");
  userEvent.click(screen.getByRole("button", { name: "Delete Bench 3" }));
  const confirm = await screen.findByRole("dialog");
  expect(within(confirm).getByText(/usb video will have no control/)).toBeInTheDocument();
  userEvent.click(within(confirm).getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByRole("button", { name: "Delete Bench 3" })).toBeInTheDocument();

  userEvent.click(screen.getByRole("button", { name: "Delete Bench 3" }));
  userEvent.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(screen.queryByText("Controls usb video")).not.toBeInTheDocument());
  userEvent.click(screen.getByRole("tab", { name: "Video" }));
  expect(within(panel("Video")).getByLabelText("Control for usb video")).toHaveValue("none");
});

test("Remove in Choose control devices deletes the device for good, after confirming", async () => {
  renderTab("Control");
  await screen.findByText("Controls usb video");
  userEvent.click(screen.getByRole("button", { name: "Choose devices" }));
  const dialog = await screen.findByRole("dialog");
  const trash = within(dialog).getByRole("button", { name: "Remove Bench 3" });
  expect(trash).toHaveClass("icon-btn"); // the same trash icon as the Control tab
  expect(trash).toHaveTextContent("");
  userEvent.click(trash);
  userEvent.click(await within(dialog).findByRole("button", { name: "Remove" }));
  const lists = calls.filter(([k, , msg]) => k === "sendSync" && msg?.type === "set-control-list");
  expect(lists[lists.length - 1][2].payload).toEqual([]);
  await waitFor(() => expect(within(dialog).queryByText("Bench 3")).not.toBeInTheDocument());
});

test("a BrightScript Simulator saved by an earlier scan is dropped when Choose devices scans", async () => {
  const sim = { id: "192.168.1.60|ecp", ipAddress: "192.168.1.60", alias: "BrightScript Simulator", deviceName: "BrightScript Simulator", linked: "", type: "Roku" };
  settings.control.deviceList.push(sim);
  try {
    renderTab("Control");
    expect(await within(panel("Control")).findByText("BrightScript Simulator")).toBeInTheDocument();
    userEvent.click(screen.getByRole("button", { name: "Choose devices" }));
    const dialog = await screen.findByRole("dialog");
    await within(dialog).findByText("Scan finished");
    await waitFor(() => expect(within(dialog).queryByText("BrightScript Simulator")).not.toBeInTheDocument());
    const lists = calls.filter(([k, , msg]) => k === "sendSync" && msg?.type === "set-control-list");
    expect(lists[lists.length - 1][2].payload.map((d) => d.id)).toEqual(["192.168.1.43|ecp"]);
  } finally {
    settings.control.deviceList.pop();
  }
});

test("Choose control devices scans on open and keeps typed input when the scan finishes", async () => {
  renderTab("Control");
  await screen.findByText("usb video");
  userEvent.click(screen.getByRole("button", { name: "Choose devices" }));
  const dialog = await screen.findByRole("dialog");
  expect(within(dialog).queryByLabelText("Address")).not.toBeInTheDocument(); // collapsed until asked for
  userEvent.click(within(dialog).getByRole("button", { name: "Add by hand" }));
  userEvent.type(within(dialog).getByLabelText("Address"), "10.20.4.17");
  await within(dialog).findByText("Scan finished");
  expect(within(dialog).getByLabelText("Address")).toHaveValue("10.20.4.17");
  expect(sent("invoke", "discover-roku-devices")).toBe(true);
});
