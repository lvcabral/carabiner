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
// Plain functions, not jest.fn: CRA's jest config resets mock implementations before each test.
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
  if (channel === "get-package-info") return { version: "0.0.0", repository: { url: "" } };
  return null;
};
window.electronAPI = {
  invoke,
  send: record("send"),
  sendSync: record("sendSync"),
  onMessageReceived: () => {},
  removeListener: () => {},
  getPackageInfo: async () => ({ version: "0.0.0", repository: { url: "" } }),
  openExternal: () => {},
  log: () => {},
};
const sent = (kind, channel) => calls.some(([k, c]) => k === kind && c === channel);
Object.defineProperty(navigator, "mediaDevices", {
  value: {
    enumerateDevices: async () => [{ kind: "videoinput", deviceId: "usb", label: "usb video (534d:2109)" }],
    getUserMedia: async () => ({ getTracks: () => [] }),
    addEventListener: () => {},
    removeEventListener: () => {},
  },
});
window.matchMedia = window.matchMedia || (() => ({ matches: false, addListener() {}, removeListener() {} }));

const App = require("./App").default;

// General opens first; switch to Devices.
const renderDevicesTab = () => {
  render(<App />);
  userEvent.click(screen.getByRole("tab", { name: "Devices" }));
};

test("General then Devices; Devices lists the chosen video and control devices", async () => {
  render(<App />);
  const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
  expect(tabs.slice(0, 2)).toEqual(["General", "Devices"]);
  expect(tabs).not.toContain("Streams");
  expect(tabs).not.toContain("Control");
  userEvent.click(screen.getByRole("tab", { name: "Devices" }));
  expect(await screen.findByText("usb video")).toBeInTheDocument();
  expect(screen.getByLabelText("Control for usb video")).toHaveValue("192.168.1.43|ecp");
  expect(await screen.findByText("Controls usb video")).toBeInTheDocument();
});

test("Choose video: a checkbox applies right away, Done and Escape close", async () => {
  renderDevicesTab();
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
  renderDevicesTab();
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
  expect(screen.getByLabelText("Control for usb video")).toHaveValue("none");
});

test("Choose control devices scans on open and keeps typed input when the scan finishes", async () => {
  renderDevicesTab();
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
