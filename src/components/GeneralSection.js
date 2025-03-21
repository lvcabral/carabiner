/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState, useRef } from "react";
import { Container, Form, Row, Col, Card } from "react-bootstrap";

import SelectCapture from "./select/Capture";
import ShortcutInput from "./select/ShortcutInput";

const { electronAPI } = window;
let captureDevice = "";
let captureResolution = "1280|720";
let currentLinked = "";

function GeneralSection({
  streamingDevices,
  onUpdateStreamingDevices,
  onDeletedDeviceRef,
}) {
  const [deviceId, setDeviceId] = useState("");
  const [shortcut, setShortcut] = useState("");
  const [launchAppAtLogin, setLaunchAppAtLogin] = useState(false);
  const [showSettingsOnStart, setShowSettingsOnStart] = useState(true);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [linkedDevice, setLinkedDevice] = useState("");

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
    window.electronAPI.onMessageReceived(
      "open-display-tab",
      handleOpenDisplayTab
    );
    window.electronAPI.onMessageReceived(
      "update-always-on-top",
      (event, value) => {
        setAlwaysOnTop(value);
      }
    );
    window.electronAPI.onMessageReceived(
      "update-capture-device",
      (event, value) => {
        captureDevice = value;
        setDeviceId(value);
        notifyCaptureChange(value);
        const linked = streamingDevicesRef.current.find(
          (device) => device.linked === value
        );
        currentLinked = linked?.id ?? "";
        setLinkedDevice(currentLinked);
        notifyControlChange("set-control-selected", currentLinked);
      }
    );

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
    const linked = streamingDevicesRef.current.find(
      (device) => device.linked === captureDevice
    );
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

  const handleAlwaysOnTopChange = (e) => {
    setAlwaysOnTop(e.target.checked);
    electronAPI.send("save-always-on-top", e.target.checked);
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
    <Container className="p-3">
      <Card>
        <Card.Body>
          <SelectCapture
            value={deviceId}
            onChange={handleCaptureDeviceChange}
          />
          <Form.Group
            controlId="formLinkedDevice"
            className="form-group-spacing mt-3"
          >
            <Form.Label>Linked Streaming Device</Form.Label>
            <Form.Control
              as="select"
              value={linkedDevice}
              onChange={handleLinkedDeviceChange}
            >
              <option value="">Select a device</option>
              {streamingDevices.map((device, index) => (
                <option key={index} value={device.id}>
                  {device.type}: {device.alias ? device.alias + " - " : ""}
                  {device.ipAddress}
                </option>
              ))}
            </Form.Control>
          </Form.Group>
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
                label="Settings at App Start"
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

export function notifyCaptureChange(videoSource, resolution) {
  if (resolution) {
    captureResolution = resolution;
  }
  const [width, height] = captureResolution
    .split("|")
    .map((dim) => parseInt(dim, 10));
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
