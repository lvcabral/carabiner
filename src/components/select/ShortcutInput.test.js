import { describe, it, expect } from "vitest";
import { shortcutFromEvent } from "./ShortcutInput";

const key = (code, mods = {}) => ({ code, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...mods });

describe("shortcutFromEvent", () => {
  it("ignores modifiers pressed alone", () => {
    expect(shortcutFromEvent(key("ShiftLeft", { shiftKey: true }))).toBeNull();
    expect(shortcutFromEvent(key("ControlLeft", { ctrlKey: true, shiftKey: true }))).toBeNull();
    expect(shortcutFromEvent(key("MetaRight", { metaKey: true }))).toBeNull();
  });

  it("combines modifiers with the physical key", () => {
    expect(shortcutFromEvent(key("KeyD", { ctrlKey: true, shiftKey: true }))).toBe("Ctrl+Shift+D");
    expect(shortcutFromEvent(key("KeyA", { altKey: true }))).toBe("Alt+A");
    expect(shortcutFromEvent(key("Digit1", { shiftKey: true }))).toBe("Shift+1");
    expect(shortcutFromEvent(key("ArrowUp", { metaKey: true }))).toBe("Meta+Up");
    expect(shortcutFromEvent(key("F12"))).toBe("F12");
  });

  it("clears on Backspace/Delete without modifiers", () => {
    expect(shortcutFromEvent(key("Backspace"))).toBe("");
    expect(shortcutFromEvent(key("Delete"))).toBe("");
    expect(shortcutFromEvent(key("Backspace", { ctrlKey: true }))).toBe("Ctrl+Backspace");
  });

  it("ignores unsupported keys", () => {
    expect(shortcutFromEvent(key("IntlBackslash", { ctrlKey: true }))).toBeNull();
    expect(shortcutFromEvent(key(""))).toBeNull();
  });
});
