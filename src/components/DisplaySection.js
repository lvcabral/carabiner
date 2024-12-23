/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Container, Form, Row, Col, Card } from "react-bootstrap";

import SelectResolution from "./select/Resolution";
import SelectCapture from "./select/Capture";
import SelectFilter from "./select/Filter";
import ShortcutInput from "./select/ShortcutInput";

const { electronAPI } = window;

function DisplaySection() {
  const [deviceId, setDeviceId] = useState("");
  const [resolution, setResolution] = useState("1280|720");
  const [filter, setFilter] = useState("none");
  const [shortcut, setShortcut] = useState("");
  const [launchAppAtLogin, setLaunchAppAtLogin] = useState(false);
  const [showSettingsOnStart, setShowSettingsOnStart] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);

  useEffect(() => {
    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.display && settings.display.captureWidth) {
          const captureResolution = `${settings.display.captureWidth}|${settings.display.captureHeight}`;
          setResolution(captureResolution);
      }
      if (settings.display && settings.display.filter) {
        setFilter(settings.display.filter);
        notifyFilterChange(settings.display.filter);
      }
      if (settings.display && settings.display.shortcut) {
        setShortcut(settings.display.shortcut);
      }
      if (settings.display && settings.display.launchAppAtLogin !== undefined) {
        setLaunchAppAtLogin(settings.display.launchAppAtLogin);
      }
      if (
        settings.display &&
        settings.display.showSettingsOnStart !== undefined
      ) {
        setShowSettingsOnStart(settings.display.showSettingsOnStart);
      }
      if (settings.display && settings.display.alwaysOnTop !== undefined) {
        setAlwaysOnTop(settings.display.alwaysOnTop);
      }
    });
  }, []);

  const handleCaptureDeviceChange = (e) => {
    setDeviceId(e.target.value);
    notifyCaptureChange(e.target.value, resolution);
  };

  const handleCaptureResolutionChange = (e) => {
    setResolution(e.target.value);
    notifyCaptureChange(deviceId, e.target.value);
  };

  const handleChangeFilter = (e) => {
    setFilter(e.target.value);
    notifyFilterChange(e.target.value);
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

  const handleAlwaysOnTopChange = (e) => {
    setAlwaysOnTop(e.target.checked);
    electronAPI.send("save-always-on-top", e.target.checked);
  };

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
          <SelectCapture
            value={deviceId}
            onChange={handleCaptureDeviceChange}
          />
          <Row>
            <Col>
              <SelectResolution
                value={resolution}
                onChange={handleCaptureResolutionChange}
              />
            </Col>
            <Col>
              <SelectFilter value={filter} onChange={handleChangeFilter} />
            </Col>
          </Row>
          <Row className="mt-3">
            <Col>
              <ShortcutInput value={shortcut} onChange={handleShortcutChange} />
            </Col>
            <Col className="d-flex flex-column align-items-start">
              <Form.Check
                type="checkbox"
                label="Launch at Login"
                checked={launchAppAtLogin}
                onChange={handleLaunchAppAtLoginChange}
              />
              <Form.Check
                type="checkbox"
                label="Settings on App Start"
                checked={showSettingsOnStart}
                onChange={handleShowSettingsOnStartChange}
              />
              <Form.Check
                type="checkbox"
                label="Always on Top"
                checked={alwaysOnTop}
                onChange={handleAlwaysOnTopChange}
              />
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </Container>
  );
}

function notifyCaptureChange(videoSource, resolution) {
  const [width, height] = resolution.split("|").map(dim => parseInt(dim, 10));
  const constraints = {
    video: {
      deviceId: {
        exact: videoSource,
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

function notifyFilterChange(filter) {
  const style = {};
  style.filter = filter;
  style["-webkit-filter"] = `-webkit-${filter}`;
  electronAPI.sendSync("shared-window-channel", {
    type: "set-transparency",
    payload: style,
  });
}

export default DisplaySection;
