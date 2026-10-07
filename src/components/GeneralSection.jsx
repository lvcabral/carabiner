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
import { Container, Form, Row, Col, Card, Button } from "react-bootstrap";

import ShortcutInput from "./select/ShortcutInput";
import { ExternalLink } from "./devices/ui";

const { electronAPI } = window;

// App-wide options. Video sources and control devices live on the Video and Control tabs.
function GeneralSection() {
  const [shortcut, setShortcut] = useState("");
  const [launchAppAtLogin, setLaunchAppAtLogin] = useState(false);
  const [showSettingsOnStart, setShowSettingsOnStart] = useState(true);
  const [showInDock, setShowInDock] = useState(true); // macOS dock/menubar setting
  const [darkMode, setDarkMode] = useState(false);
  const [checkForUpdates, setCheckForUpdates] = useState(true);
  const [adbPath, setAdbPath] = useState("");
  const [atvremotePath, setAtvremotePath] = useState("");
  const [repoUrl, setRepoUrl] = useState("");

  const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const isWindows = navigator.platform.toUpperCase().indexOf("WIN") >= 0;

  useEffect(() => {
    electronAPI.getPackageInfo().then((info) => setRepoUrl(info?.repository?.url || ""));
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.display?.shortcut) setShortcut(settings.display.shortcut);
      if (settings.display?.launchAppAtLogin !== undefined)
        setLaunchAppAtLogin(settings.display.launchAppAtLogin);
      if (settings.display?.showSettingsOnStart !== undefined)
        setShowSettingsOnStart(settings.display.showSettingsOnStart);
      if (settings.display?.showInDock !== undefined) setShowInDock(settings.display.showInDock);
      if (settings.display?.autoUpdate !== undefined) setCheckForUpdates(settings.display.autoUpdate);
      if (settings.control?.adbPath) setAdbPath(settings.control.adbPath);
      if (settings.control?.atvremotePath) setAtvremotePath(settings.control.atvremotePath);
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
  }, []);

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

  // Tool paths for Android (adb) and Apple TV (atvremote) control devices.
  const notifyControlChange = (type, payload) => electronAPI.sendSync("shared-window-channel", { type, payload });
  const handleAdbPathChange = (value) => {
    setAdbPath(value);
    notifyControlChange("set-adb-path", value);
  };
  const handleAtvPathChange = (value) => {
    setAtvremotePath(value);
    notifyControlChange("set-atv-path", value);
  };
  const handleSelectAdbPath = async () => {
    const path = await electronAPI.invoke("select-adb-path", adbPath);
    if (path) handleAdbPathChange(path);
  };
  const handleSelectAtvPath = async () => {
    const path = await electronAPI.invoke("select-atv-path", atvremotePath);
    if (path) handleAtvPathChange(path);
  };

  // Link to a setup guide in the repository's docs folder, shown under a tool path.
  const setupGuide = (doc, label) =>
    repoUrl && (
      <Form.Text className="d-block" style={{ fontSize: "0.75rem" }}>
        <ExternalLink url={`${repoUrl}/blob/main/docs/${doc}.md`}>{label} ↗</ExternalLink>
      </Form.Text>
    );

  return (
    <Container fluid className="p-2" style={{ fontSize: "0.85rem" }}>
      <Card>
        <Card.Body className="p-2">
          <Row>
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
          <hr className="mt-3" />
          <Form.Group controlId="formAdbPath" className="form-group-spacing">
            <Form.Label>ADB Tool Path (Fire TV and Google TV control)</Form.Label>
            <Row>
              <Col className="d-flex align-items-center flex-grow-1">
                <Form.Control
                  size="sm"
                  type="text"
                  value={adbPath}
                  onChange={(e) => handleAdbPathChange(e.target.value)}
                  placeholder="Paste or select path to adb binary"
                />
              </Col>
              <Col xs="auto" className="d-flex align-items-center">
                <Button size="sm" title="Select ADB Path" aria-label="Select ADB path" variant="primary" onClick={handleSelectAdbPath}>
                  &#x2026;
                </Button>
              </Col>
            </Row>
            {setupGuide("setup-android-firetv", "Android TV, Fire TV and Google TV setup guide")}
          </Form.Group>
          <Form.Group controlId="formAtvremotePath" className="form-group-spacing mb-0">
            <Form.Label>atvremote Tool Path (Apple TV control)</Form.Label>
            <Row>
              <Col className="d-flex align-items-center flex-grow-1">
                <Form.Control
                  size="sm"
                  type="text"
                  value={atvremotePath}
                  onChange={(e) => handleAtvPathChange(e.target.value)}
                  placeholder="Paste or select path to atvremote binary"
                />
              </Col>
              <Col xs="auto" className="d-flex align-items-center">
                <Button size="sm" title="Select atvremote Path" aria-label="Select atvremote path" variant="primary" onClick={handleSelectAtvPath}>
                  &#x2026;
                </Button>
              </Col>
            </Row>
            {setupGuide("setup-apple-tv", "Apple TV setup guide")}
          </Form.Group>
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
