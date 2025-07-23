/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState, useRef } from "react";
import { Container, Form, Row, Col, Card } from "react-bootstrap";

import SelectCapture from "./select/Capture";
import ShortcutInput from "./select/ShortcutInput";

const { electronAPI } = window;
let captureDevice = "";
let captureResolution = "1280|720";
let currentLinked = "";

function GeneralSection({ streamingDevices, onUpdateStreamingDevices, onDeletedDeviceRef }) {
  const [deviceId, setDeviceId] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [launchAppAtLogin, setLaunchAppAtLogin] = useState(false);
  const [showSettingsOnStart, setShowSettingsOnStart] = useState(true);
  const [linkedDevice, setLinkedDevice] = useState("");
  const [audioEnabled, setAudioEnabled] = useState(false);
  const [showInDock, setShowInDock] = useState(true); // macOS dock/menubar setting
  const [darkMode, setDarkMode] = useState(false);
  const [checkForUpdates, setCheckForUpdates] = useState(true);

  const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const isWindows = navigator.platform.toUpperCase().indexOf("WIN") >= 0;

  const streamingDevicesRef = useRef(streamingDevices);

  useEffect(() => {
    streamingDevicesRef.current = streamingDevices;
  }, [streamingDevices]);

  useEffect(() => {
    onDeletedDeviceRef.current = (deviceId) => {
      if (currentLinked === deviceId) {
        setLinkedDevice("");
      }
    };
  }, [onDeletedDeviceRef]);

  useEffect(() => {
    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.display && settings.display.captureWidth) {
        captureResolution = `${settings.display.captureWidth}|${settings.display.captureHeight}`;
      }
      if (settings.display && settings.display.shortcut) {
        setShortcut(settings.display.shortcut);
      }
      if (settings.display && settings.display.launchAppAtLogin !== undefined) {
        setLaunchAppAtLogin(settings.display.launchAppAtLogin);
      }
      if (settings.display && settings.display.showSettingsOnStart !== undefined) {
        setShowSettingsOnStart(settings.display.showSettingsOnStart);
      }
      if (settings.display && settings.display.audioEnabled !== undefined) {
        setAudioEnabled(settings.display.audioEnabled);
      }
      if (settings.display && settings.display.showInDock !== undefined) {
        setShowInDock(settings.display.showInDock);
      }
      if (settings.display && settings.display.autoUpdate !== undefined) {
        setCheckForUpdates(settings.display.autoUpdate);
      }
      if (settings.display && settings.display.darkMode !== undefined) {
        setDarkMode(settings.display.darkMode);
        // Apply dark mode to document
        document.body.setAttribute("data-bs-theme", settings.display.darkMode ? "dark" : "light");
      } else {
        // First time launch - detect system color scheme preference
        const prefersDarkMode =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        setDarkMode(prefersDarkMode);
        // Apply the detected theme immediately
        document.body.setAttribute("data-bs-theme", prefersDarkMode ? "dark" : "light");
        // Save the detected preference
        electronAPI.send("save-dark-mode", prefersDarkMode);
      }
    });

    window.electronAPI.onMessageReceived("open-display-tab", handleOpenDisplayTab);
    window.electronAPI.onMessageReceived("update-always-on-top", (event, value) => {
      // This message is now handled by DisplaySection
    });
    window.electronAPI.onMessageReceived("update-capture-device", (event, value) => {
      captureDevice = value;
      setDeviceId(value);
      notifyCaptureChange(value);
      const linked = streamingDevicesRef.current.find((device) => device.linked === value);
      currentLinked = linked?.id ?? "";
      setLinkedDevice(currentLinked);
      notifyControlChange("set-control-selected", currentLinked);
    });

    return () => {
      window.electronAPI.removeListener("open-display-tab");
      window.electronAPI.removeListener("update-always-on-top");
      window.electronAPI.removeListener("update-capture-device");
    };
  }, []);

  const handleOpenDisplayTab = () => {
    // Logic to switch to the About tab
    const aboutTab = document.getElementById("settings-tabs-tab-display");
    if (aboutTab) {
      aboutTab.click();
    }
  };

  const handleCaptureDeviceChange = (e) => {
    captureDevice = e.target.value;
    setDeviceId(captureDevice);
    notifyCaptureChange(captureDevice);
    const linked = streamingDevicesRef.current.find((device) => device.linked === captureDevice);
    currentLinked = linked?.id ?? "";
    setLinkedDevice(currentLinked);
    notifyControlChange("set-control-selected", currentLinked);
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

  const handleAudioEnabledChange = (e) => {
    setAudioEnabled(e.target.checked);
    // Notify the render process
    electronAPI.sendSync("shared-window-channel", {
      type: "set-audio-enabled",
      payload: e.target.checked,
    });
    // Save to settings
    electronAPI.send("save-audio-enabled", e.target.checked);
  };

  const handleDarkModeChange = (e) => {
    setDarkMode(e.target.checked);
    // Apply dark mode to document immediately
    document.body.setAttribute("data-bs-theme", e.target.checked ? "dark" : "light");
    // Save to settings
    electronAPI.send("save-dark-mode", e.target.checked);
  };

  const handleCheckForUpdatesChange = (e) => {
    setCheckForUpdates(e.target.checked);
    // Save to settings
    electronAPI.send("save-check-for-updates", e.target.checked);
  };

  const handleLinkedDeviceChange = (e) => {
    currentLinked = e.target.value;
    setLinkedDevice(currentLinked);
    notifyControlChange("set-control-selected", currentLinked);
    // Update the linked device for the current capture device
    const updatedDevices = streamingDevices.map((device) => {
      if (device.id === currentLinked) {
        return { ...device, linked: captureDevice };
      } else if (device.linked === captureDevice) {
        return { ...device, linked: "" };
      }
      return device;
    });
    onUpdateStreamingDevices(updatedDevices);
  };

  return (
    <Container fluid className="p-2">
      <Card>
        <Card.Body>
          <SelectCapture value={deviceId} onChange={handleCaptureDeviceChange} />
          <Form.Group controlId="formLinkedDevice" className="form-group-spacing mt-2">
            <Form.Label>Linked Streaming Device</Form.Label>
            <Form.Control as="select" value={linkedDevice} onChange={handleLinkedDeviceChange}>
              <option value="">Select a device</option>
              {streamingDevices.map((device, index) => (
                <option key={index} value={device.id}>
                  {device.type}: {device.alias ? device.alias + " - " : ""}
                  {device.ipAddress}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
          <Row className="mt-2">
            <Col xs={7}>
              <ShortcutInput value={shortcut} onChange={handleShortcutChange} />
              {isMacOS && (
                <Form.Group className="mt-3">
                  <Form.Label>App Icon Mode</Form.Label>
                  <div className="d-flex">
                    <Form.Check
                      type="radio"
                      label="Dock"
                      name="displayMode"
                      value="dock"
                      checked={showInDock}
                      onChange={() => {
                        setShowInDock(true);
                        electronAPI.send("save-show-in-dock", true);
                      }}
                      inline
                    />
                    <Form.Check
                      type="radio"
                      label="Menu Bar"
                      name="displayMode"
                      value="menubar"
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
              {isWindows && (
                <Form.Group className="mt-3">
                  <Form.Label>App Icon Mode</Form.Label>
                  <div className="d-flex">
                    <Form.Check
                      type="radio"
                      label="Taskbar"
                      name="displayMode"
                      value="taskbar"
                      checked={showInDock}
                      onChange={() => {
                        setShowInDock(true);
                        electronAPI.send("save-show-in-dock", true);
                      }}
                      inline
                    />
                    <Form.Check
                      type="radio"
                      label="System Tray"
                      name="displayMode"
                      value="tray"
                      checked={!showInDock}
                      onChange={() => {
                        setShowInDock(false);
                        electronAPI.send("save-show-in-dock", false);
                      }}
                      inline
                      className="ms-3"
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
                label="Enable Audio"
                checked={audioEnabled}
                onChange={handleAudioEnabledChange}
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

export function notifyCaptureChange(videoSource, resolution) {
  if (resolution) {
    captureResolution = resolution;
  }
  const [width, height] = captureResolution.split("|").map((dim) => parseInt(dim, 10));
  const constraints = {
    video: {
      deviceId: {
        exact: videoSource ?? captureDevice,
      },
      width: width ?? 1280,
      height: height ?? 720,
    },
  };
  electronAPI.sendSync("shared-window-channel", {
    type: "set-video-stream",
    payload: constraints,
  });
}

function notifyControlChange(type, payload) {
  electronAPI.sendSync("shared-window-channel", {
    type: type,
    payload: payload,
  });
}

export default GeneralSection;
