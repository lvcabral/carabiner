/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";

// Small "enter a new name" dialog used by the Devices tab. It owns the text being
// edited; the parent only says whether it is shown and what to do with the confirmed name.
// With a `defaultName` (the name the device reports), the field may be left empty to go back
// to it: the placeholder shows it and onConfirm receives "".
function RenameModal({ show, title, initialValue = "", defaultName = "", onConfirm, onHide }) {
  const [value, setValue] = useState(initialValue);

  // Start from the current name each time the dialog opens (empty when it's just the default).
  useEffect(() => {
    if (show) setValue(defaultName && initialValue === defaultName ? "" : initialValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const canConfirm = !!value.trim() || !!defaultName;
  const confirm = () => {
    if (canConfirm) onConfirm(value.trim());
  };

  return (
    <Modal show={show} onHide={onHide} centered size="sm">
      <Modal.Header closeButton>
        <Modal.Title style={{ fontSize: "1rem" }}>{title}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Form
          onSubmit={(e) => {
            e.preventDefault();
            confirm();
          }}
        >
          <Form.Control
            size="sm"
            type="text"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={defaultName || "Enter new name"}
            aria-label="Name"
          />
          {defaultName && (
            <Form.Text className="text-muted" style={{ fontSize: "0.72rem" }}>
              Leave empty to use the device's own name.
            </Form.Text>
          )}
        </Form>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" onClick={confirm} disabled={!canConfirm}>
          Rename
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default RenameModal;
