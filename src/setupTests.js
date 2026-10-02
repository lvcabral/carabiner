// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import "@testing-library/jest-dom";

// Minimal stand-in for the API exposed by public/preload.js. Components read
// window.electronAPI at import time, so it must exist before they load.
window.electronAPI = {
  sendSync: vi.fn(() => ({})),
  send: vi.fn(),
  invoke: vi.fn(() => Promise.resolve({})),
  onMessageReceived: vi.fn(),
  removeListener: vi.fn(),
  getPackageInfo: vi.fn(() => Promise.resolve({ version: "0.0.0", copyright: "", repository: { url: "" } })),
  openExternal: vi.fn(),
  log: vi.fn(),
};

// jsdom has no media devices; the General tab enumerates capture cards.
Object.defineProperty(navigator, "mediaDevices", {
  configurable: true,
  value: {
    enumerateDevices: vi.fn(() => Promise.resolve([])),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  },
});
