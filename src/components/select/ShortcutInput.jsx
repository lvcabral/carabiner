/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useState, useEffect } from "react";
import { Form } from "react-bootstrap";

const NAMED_KEYS = {
  ArrowUp: "Up",
  ArrowDown: "Down",
  ArrowLeft: "Left",
  ArrowRight: "Right",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
  Backquote: "`",
};
const PLAIN_KEYS = new Set([
  "Space",
  "Tab",
  "Enter",
  "Escape",
  "Backspace",
  "Delete",
  "Insert",
  "Home",
  "End",
  "PageUp",
  "PageDown",
]);

// Electron accelerator key for a keydown's physical key (e.code, so Shift/Option don't
// turn "1" into "!" or "a" into "å"), or null for modifiers and unsupported keys.
function acceleratorKey(code) {
  let m;
  if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
  if ((m = /^Digit(\d)$/.exec(code))) return m[1];
  if ((m = /^Numpad(\d)$/.exec(code))) return `num${m[1]}`;
  if (/^F([1-9]|1\d|2[0-4])$/.test(code)) return code;
  if (NAMED_KEYS[code]) return NAMED_KEYS[code];
  if (PLAIN_KEYS.has(code)) return code;
  return null;
}

// The accelerator for a keydown event: null while only modifiers are held (a modifier
// alone is not a valid accelerator), "" to clear (Backspace/Delete with no modifier).
export function shortcutFromEvent(e) {
  const modifiers = [];
  if (e.ctrlKey) modifiers.push("Ctrl");
  if (e.shiftKey) modifiers.push("Shift");
  if (e.altKey) modifiers.push("Alt");
  if (e.metaKey) modifiers.push("Meta");
  const key = acceleratorKey(e.code);
  if (!key) return null;
  if (modifiers.length === 0 && (key === "Backspace" || key === "Delete")) return "";
  return [...modifiers, key].join("+");
}

function ShortcutInput({ value, onChange }) {
  const [shortcut, setShortcut] = useState(value);

  useEffect(() => {
    setShortcut(value);
  }, [value]);

  const handleKeyDown = (e) => {
    e.preventDefault();
    const combination = shortcutFromEvent(e);
    if (combination === null) return;
    setShortcut(combination);
    onChange(combination);
  };

  return (
    <Form.Group controlId="formShortcut">
      <Form.Label>Toggle Display Shortcut</Form.Label>
      <Form.Control
        type="text"
        value={shortcut}
        style={{ fontSize: "0.85rem", width: "70%" }}
        onKeyDown={handleKeyDown}
        placeholder="No shortcut set"
        title="Press a key combination; Backspace or Delete clears it"
        readOnly
      />
    </Form.Group>
  );
}

export default ShortcutInput;