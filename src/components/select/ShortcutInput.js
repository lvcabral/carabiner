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

function ShortcutInput({ value, onChange }) {
  const [shortcut, setShortcut] = useState(value);

  useEffect(() => {
    setShortcut(value);
  }, [value]);

  const handleKeyDown = (e) => {
    e.preventDefault();
    const keys = [];
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.shiftKey) keys.push("Shift");
    if (e.altKey) keys.push("Alt");
    if (e.metaKey) keys.push("Meta");
    if (e.key && !["Control", "Shift", "Alt", "Meta"].includes(e.key)) {
      keys.push(e.key);
    }
    const shortcutCombination = keys.join("+");
    setShortcut(shortcutCombination);
    onChange(shortcutCombination);
  };

  return (
    <Form.Group controlId="formShortcut">
      <Form.Label>Toggle Display Shortcut</Form.Label>
      <Form.Control
        type="text"
        value={shortcut}
        onKeyDown={handleKeyDown}
        placeholder="No shortcut set"
        readOnly
      />
    </Form.Group>
  );
}

export default ShortcutInput;