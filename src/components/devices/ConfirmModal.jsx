/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import { currentTheme } from "./ui";

// Confirmation for a delete on the Video or Control tab. `request` is { title, body, confirmLabel, onConfirm }
// or null (hidden).
function ConfirmModal({ request, onHide }) {
  return (
    <Modal show={!!request} onHide={onHide} centered size="sm" data-bs-theme={currentTheme()} aria-labelledby="confirm-title">
      <Modal.Header closeButton>
        <Modal.Title id="confirm-title" style={{ fontSize: "1rem" }}>
          {request?.title}
        </Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ fontSize: "0.85rem" }}>{request?.body}</Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="secondary" onClick={onHide}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="danger"
          autoFocus
          onClick={() => {
            request?.onConfirm();
            onHide();
          }}
        >
          {request?.confirmLabel || "Delete"}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ConfirmModal;
