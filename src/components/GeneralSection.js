/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState, useRef } from "react";
import { Container, Form, Row, Col, Card } from "react-bootstrap";

import ShortcutInput from "./select/ShortcutInput";

const { electronAPI } = window;

function GeneralSection({ streamingDevices, onDeletedDeviceRef, pairs = [], onPairsChange }) {
  const [captureDevices, setCaptureDevices] = useState([]);
  const [shortcut, setShortcut] = useState("");
  const [launchAppAtLogin, setLaunchAppAtLogin] = useState(false);
  const [showSettingsOnStart, setShowSettingsOnStart] = useState(true);
  const [showInDock, setShowInDock] = useState(true); // macOS dock/menubar setting
  const [darkMode, setDarkMode] = useState(false);
  const [checkForUpdates, setCheckForUpdates] = useState(true);

  const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const isWindows = navigator.platform.toUpperCase().indexOf("WIN") >= 0;

  // Keep latest pairs reachable from long-lived listener callbacks.
  const pairsRef = useRef(pairs);
  useEffect(() => {
    pairsRef.current = pairs;
  }, [pairs]);

  useEffect(() => {
    onDeletedDeviceRef.current = (deviceId) => {
      // A control device was deleted; clear it from any pair that referenced it.
      const next = pairsRef.current.map((p) =>
        p.controlDeviceId === deviceId ? { ...p, controlDeviceId: "" } : p
      );
      if (next.some((p, i) => p.controlDeviceId !== pairsRef.current[i].controlDeviceId)) {
        onPairsChange?.(next);
      }
    };
  }, [onDeletedDeviceRef, onPairsChange]);

  useEffect(() => {
    // Load global (non per-window) settings.
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.display?.shortcut) setShortcut(settings.display.shortcut);
      if (settings.display?.launchAppAtLogin !== undefined)
        setLaunchAppAtLogin(settings.display.launchAppAtLogin);
      if (settings.display?.showSettingsOnStart !== undefined)
        setShowSettingsOnStart(settings.display.showSettingsOnStart);
      if (settings.display?.showInDock !== undefined) setShowInDock(settings.display.showInDock);
      if (settings.display?.autoUpdate !== undefined) setCheckForUpdates(settings.display.autoUpdate);
      if (settings.display?.darkMode !== undefined) {
        setDarkMode(settings.display.darkMode);
        document.body.setAttribute("data-bs-theme", settings.display.darkMode ? "dark" : "light");
      } else {
        const prefersDarkMode =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        setDarkMode(prefersDarkMode);
        document.body.setAttribute("data-bs-theme", prefersDarkMode ? "dark" : "light");
        electronAPI.send("save-dark-mode", prefersDarkMode);
      }
    });

    // Enumerate capture devices directly in the settings window so the grid works even
    // when no Display window is open (e.g. a fresh install with nothing made visible yet).
    // Labels are only exposed after a getUserMedia grant, so unlock them once if missing.
    const enumerate = async () => {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let vids = devices.filter((d) => d.kind === "videoinput");
        if (vids.length > 0 && vids.some((d) => !d.label)) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach((t) => t.stop());
            devices = await navigator.mediaDevices.enumerateDevices();
            vids = devices.filter((d) => d.kind === "videoinput");
          } catch {
            /* permission denied — fall back to unlabeled devices */
          }
        }
        const list = vids.map((d) => ({
          deviceId: d.deviceId,
          label: d.label || "Capture Device",
        }));
        setCaptureDevices(list);
        // Cache in main so the tray's capture submenu stays in sync.
        electronAPI.sendSync("shared-window-channel", {
          type: "set-capture-devices",
          payload: JSON.stringify(list),
        });
      } catch (error) {
        console.warn("Failed to enumerate capture devices:", error);
      }
    };
    enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);

    window.electronAPI.onMessageReceived("open-display-tab", handleOpenDisplayTab);
    // Tray "capture device" submenu makes that device's window visible.
    window.electronAPI.onMessageReceived("update-capture-device", (event, value) => {
      if (value) setPairForDevice(value, { visible: true });
    });

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
      window.electronAPI.removeListener("open-display-tab");
      window.electronAPI.removeListener("update-capture-device");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleOpenDisplayTab = () => {
    const displayTab = document.getElementById("settings-tabs-tab-display");
    if (displayTab) displayTab.click();
  };

  // ----- capture-device grid editing (one pair per capture device) -----
  const pairForDevice = (deviceId) =>
    pairs.find((p) => p.captureDeviceId === deviceId) || null;

  // Create/update the pair bound to a capture device, then persist. set-pairs →
  // reconcilePairs in main opens/closes/connects the window, so no extra messages
  // are needed here. Pairs that end up hidden AND unlinked are dropped.
  const setPairForDevice = (deviceId, patch) => {
    const list = pairsRef.current;
    const existing = list.find((p) => p.captureDeviceId === deviceId);
    let next;
    if (existing) {
      next = list.map((p) => (p.captureDeviceId === deviceId ? { ...p, ...patch } : p));
    } else {
      next = [
        ...list,
        { id: deviceId, captureDeviceId: deviceId, controlDeviceId: "", visible: false, ...patch },
      ];
    }
    next = next.filter((p) => p.visible !== false || (p.controlDeviceId && p.controlDeviceId !== ""));
    onPairsChange?.(next);
  };

  const handleShortcutChange = (value) => {
    setShortcut(value);
    electronAPI.send("save-shortcut", value);
  };
  const handleLaunchAppAtLoginChange = (e) => {
    setLaunchAppAtLogin(e.target.checked);
    electronAPI.send("save-launch-app-at-login", e.target.checked);
  };
  const handleShowSettingsOnStartChange = (e) => {
    setShowSettingsOnStart(e.target.checked);
    electronAPI.send("save-show-settings-on-start", e.target.checked);
  };
  const handleDarkModeChange = (e) => {
    setDarkMode(e.target.checked);
    document.body.setAttribute("data-bs-theme", e.target.checked ? "dark" : "light");
    electronAPI.send("save-dark-mode", e.target.checked);
  };
  const handleCheckForUpdatesChange = (e) => {
    setCheckForUpdates(e.target.checked);
    electronAPI.send("save-check-for-updates", e.target.checked);
  };

  return (
    <Container fluid className="p-2" style={{ fontSize: "0.85rem" }}>
      <Card>
        <Card.Body className="p-2">
          {/* Column headers for the capture-device grid below. */}
          <Row className="g-2 mb-1 px-2 text-muted fw-semibold" style={{ fontSize: "0.72rem" }}>
            <Col xs={6}>Capture Device</Col>
            <Col xs={5}>Control Device</Col>
            <Col xs={1} className="text-end p-0">
              Enabled
            </Col>
          </Row>
          {captureDevices.length === 0 ? (
            <p className="text-muted small mb-0">No capture devices detected.</p>
          ) : (
            <div className="script-list-scroll" style={{ maxHeight: "30vh", overflowY: "auto" }}>
              {captureDevices.map((device, index) => {
                const pair = pairForDevice(device.deviceId);
                return (
                  <Row
                    key={device.deviceId}
                    className="script-header-row border rounded align-items-center g-2 mb-1 mx-0 py-1"
                    style={{ fontSize: "0.78rem" }}
                  >
                    <Col xs={6} className="text-truncate" title={device.label}>
                      {device.label || `Device ${index + 1}`}
                    </Col>
                    <Col xs={5}>
                      <Form.Control
                        as="select"
                        size="sm"
                        style={{ fontSize: "0.75rem" }}
                        value={pair?.controlDeviceId || ""}
                        onChange={(e) =>
                          setPairForDevice(device.deviceId, { controlDeviceId: e.target.value })
                        }
                      >
                        <option value="">No control device</option>
                        {streamingDevices.map((d, i) => (
                          <option key={i} value={d.id}>
                            {d.type}: {d.alias ? d.alias + " - " : ""}
                            {d.ipAddress}
                          </option>
                        ))}
                      </Form.Control>
                    </Col>
                    <Col xs={1} className="d-flex justify-content-end p-0 pe-2">
                      <Form.Check
                        type="checkbox"
                        aria-label="Enabled"
                        checked={pair?.visible === true}
                        onChange={(e) =>
                          setPairForDevice(device.deviceId, { visible: e.target.checked })
                        }
                      />
                    </Col>
                  </Row>
                );
              })}
            </div>
          )}
          <hr className="mt-3" />
          <Row className="mt-2">
            <Col xs={7}>
              <ShortcutInput value={shortcut} onChange={handleShortcutChange} />
              {(isMacOS || isWindows) && (
                <Form.Group className="mt-3">
                  <Form.Label>App Icon Mode</Form.Label>
                  <div className="d-flex">
                    <Form.Check
                      type="radio"
                      label={isMacOS ? "Dock" : "Taskbar"}
                      name="displayMode"
                      checked={showInDock}
                      onChange={() => {
                        setShowInDock(true);
                        electronAPI.send("save-show-in-dock", true);
                      }}
                      inline
                    />
                    <Form.Check
                      type="radio"
                      label={isMacOS ? "Menu Bar" : "System Tray"}
                      name="displayMode"
                      checked={!showInDock}
                      onChange={() => {
                        setShowInDock(false);
                        electronAPI.send("save-show-in-dock", false);
                      }}
                      inline
                      className="ms-4"
                    />
                  </div>
                </Form.Group>
              )}
            </Col>
            <Col xs={5} className="d-flex flex-column align-items-start">
              <Form.Check
                type="checkbox"
                label="Launch at Login"
                checked={launchAppAtLogin}
                onChange={handleLaunchAppAtLoginChange}
              />
              <Form.Check
                type="checkbox"
                label="Settings at App Start"
                checked={showSettingsOnStart}
                onChange={handleShowSettingsOnStartChange}
              />
              <Form.Check
                type="checkbox"
                label="Dark Mode"
                checked={darkMode}
                onChange={handleDarkModeChange}
              />
              <Form.Check
                type="checkbox"
                label="Check for Updates"
                checked={checkForUpdates}
                onChange={handleCheckForUpdatesChange}
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}

// Start/refresh the capture stream for a specific pair's Display window (used by the
// Display tab when changing capture resolution).
export function notifyCaptureChange({
  pairId,
  deviceId,
  captureWidth,
  captureHeight,
  showDisplayWindow = false,
}) {
  const constraints = {
    video: {
      deviceId: { exact: deviceId },
      width: captureWidth || 1280,
      height: captureHeight || 720,
    },
    showDisplayWindow,
  };
  electronAPI.sendSync("shared-window-channel", {
    type: "set-video-stream",
    payload: constraints,
    pairId,
  });
}

export default GeneralSection;
