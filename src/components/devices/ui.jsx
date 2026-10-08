/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useCallback, useEffect, useRef, useState } from "react";
import Button from "react-bootstrap/Button";
import OverlayTrigger from "react-bootstrap/OverlayTrigger";
import Spinner from "react-bootstrap/Spinner";
import Tooltip from "react-bootstrap/Tooltip";

export function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" />
    </svg>
  );
}

export function PencilIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M4 20h4L19 9l-4-4L4 16v4zM13.5 6.5l4 4" />
    </svg>
  );
}

export function RefreshIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
      <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" />
    </svg>
  );
}

let tooltipCount = 0;

// Small icon-only button (refresh / rename / remove) used on the tabs and in the dialogs.
// `label` is its accessible name; `title` its tooltip. The tooltip is a Bootstrap one rather than
// the native `title`, which Electron on macOS only shows after a delay and while the app is active.
export function IconButton({ label, title, onClick, danger = false, disabled = false, className = "", children }) {
  const [tooltipId] = useState(() => `icon-btn-tip-${++tooltipCount}`);
  const button = (
    <button
      type="button"
      className={`icon-btn${danger ? " danger" : ""}${className ? ` ${className}` : ""}`}
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
  if (!title) return button;
  return (
    <OverlayTrigger placement="bottom" delay={{ show: 250, hide: 0 }} overlay={<Tooltip id={tooltipId}>{title}</Tooltip>}>
      {button}
    </OverlayTrigger>
  );
}

export function RefreshButton({ label = "Refresh device status", title, refreshing, onClick }) {
  return (
    <IconButton label={label} title={title} onClick={onClick} disabled={refreshing}>
      {refreshing ? <Spinner animation="border" size="sm" /> : <RefreshIcon />}
    </IconButton>
  );
}

// Rename (when `onRename` is given) and Delete buttons at the end of a Video / Control row.
export function RowActions({ name, onRename, onDelete }) {
  return (
    <div className="device-actions">
      {onRename && (
        <IconButton label={`Rename ${name}`} title="Rename" onClick={onRename}>
          <PencilIcon />
        </IconButton>
      )}
      <IconButton label={`Delete ${name}`} title="Delete" danger onClick={onDelete}>
        <TrashIcon />
      </IconButton>
    </div>
  );
}

// Inline "are you sure" bar, used inside the dialogs (Bootstrap 5.1 can't stack a second modal).
export function ConfirmBar({ message, onConfirm, onCancel }) {
  return (
    <div className="pick-inline align-items-center" role="alert">
      <span className="flex-grow-1">{message}</span>
      <Button size="sm" variant="danger" onClick={onConfirm} autoFocus>
        Remove
      </Button>
      <Button size="sm" variant="link" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

// Kind of video source: camera for a capture card, cloud for a stream (Cloud Emulator or a
// stream URL), computer screen for the BrightScript Simulator.
const SOURCE_ICONS = {
  capture: {
    title: "Capture device",
    path: "M0 5a2 2 0 0 1 2-2h7.5a2 2 0 0 1 1.983 1.738l3.11-1.382A1 1 0 0 1 16 4.269v7.462a1 1 0 0 1-1.406.913l-3.111-1.382A2 2 0 0 1 9.5 13H2a2 2 0 0 1-2-2z",
  },
  stream: {
    title: "Stream",
    path: "M4.406 3.342A5.53 5.53 0 0 1 8 2c2.69 0 4.923 2 5.166 4.579C14.758 6.804 16 8.137 16 9.773 16 11.569 14.502 13 12.687 13H3.781C1.708 13 0 11.366 0 9.318c0-1.763 1.266-3.223 2.942-3.593.143-.863.698-1.723 1.464-2.383",
  },
  simulator: {
    title: "BrightScript Simulator",
    path: "M6 12q0 1-.25 1.5H5a.5.5 0 0 0 0 1h6a.5.5 0 0 0 0-1h-.75Q10 13 10 12h4c2 0 2-2 2-2V4c0-2-2-2-2-2H2C0 2 0 4 0 4v6c0 2 2 2 2 2z",
  },
  device: {
    title: "Device on your network",
    path: "M2.5 13.5A.5.5 0 0 1 3 13h10a.5.5 0 0 1 0 1H3a.5.5 0 0 1-.5-.5M2 2h12s2 0 2 2v6s0 2-2 2H2s-2 0-2-2V4s0-2 2-2",
  },
};
// ("device" = a control device on the LAN)
const ICON_FOR_KIND = { capture: "capture", rce: "stream", webrtc: "stream", simulator: "simulator", device: "device" };

export function SourceIcon({ kind }) {
  const { title, path } = SOURCE_ICONS[ICON_FOR_KIND[kind] || "capture"];
  return (
    <svg className="source-icon" viewBox="0 0 16 16" fill="currentColor" role="img" aria-label={title}>
      <title>{title}</title>
      <path d={path} />
    </svg>
  );
}

export function Dot({ live }) {
  return <span className={`device-dot${live ? " live" : ""}`} aria-hidden="true" />;
}

// One transient status message at a time, announced to screen readers.
export function useToast() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);
  const timer = useRef(null);
  const show = useCallback((text) => {
    setMessage(text);
    setVisible(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setVisible(false), 3000);
  }, []);
  useEffect(() => () => clearTimeout(timer.current), []);
  const node = (
    <div className={`devices-toast${visible ? " show" : ""}`} role="status" aria-live="polite">
      {message}
    </div>
  );
  return [show, node];
}

// Modals render outside the tab, so they need the app theme passed explicitly.
export const currentTheme = () => document.body.getAttribute("data-bs-theme") || "light";

// Opens a URL in the system browser (the settings window itself must not navigate away).
export function ExternalLink({ url, children }) {
  return (
    <a
      href={url}
      onClick={(e) => {
        e.preventDefault();
        window.electronAPI.openExternal(url);
      }}
    >
      {children}
    </a>
  );
}
