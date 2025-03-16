/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useState, useEffect, useRef } from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

const { electronAPI } = window;

function ControlSection({
  streamingDevices,
  onUpdateStreamingDevices,
  onDeletedDevice,
}) {
  const [ipAddress, setIpAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [deviceType, setDeviceType] = useState("roku");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [adbPath, setAdbPath] = useState("");
  const ipAddressRef = useRef(null);

  useEffect(() => {
    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.control && settings.control.adbPath) {
        setAdbPath(settings.control.adbPath);
      }
    });
  }, []);

  const handleAddDevice = () => {
    if (ipAddress && deviceType) {
      const protocol = deviceType === "roku" ? "ecp" : "adb";
      let type = "";
      if (deviceType === "roku") {
        type = "Roku";
      } else if (deviceType === "firetv") {
        type = "Fire TV";
      } else if (deviceType === "googletv") {
        type = "Google TV";
      }
      const newDevice = {
        id: `${ipAddress}|${protocol}`,
        ipAddress: ipAddress,
        alias: alias.trim(),
        linked: "",
        type: type,
      };
      const newDeviceList = [...streamingDevices, newDevice];
      onUpdateStreamingDevices(newDeviceList);
      setIpAddress("");
      setAlias("");
      setSelectedDevice(newDevice.id);
      ipAddressRef.current.focus();
    }
  };

  const handleDeviceSelect = (e) => {
    setSelectedDevice(e.target.value);
  };

  const handleDeleteDevice = () => {
    onDeletedDevice(selectedDevice);
    const newDeviceList = streamingDevices.filter(
      (device) => device.id !== selectedDevice
    );
    onUpdateStreamingDevices(newDeviceList);
    setSelectedDevice("");
  };

  const handleSelectAdbPath = async () => {
    const path = await electronAPI.invoke("select-adb-path");
    if (path) {
      setAdbPath(path);
      notifyControlChange("set-adb-path", path);
    }
  };

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
          <Form>
            <Form.Group
              controlId="formIpAddress"
              className="form-group-spacing"
            >
              <Row>
                <Col>
                  <Form.Control
                    type="text"
                    placeholder="Enter IP address"
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    ref={ipAddressRef}
                  />
                </Col>
                <Col>
                  <Form.Control
                    type="text"
                    placeholder="Enter Alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </Col>
              </Row>
            </Form.Group>
            <Form.Group
              controlId="formDeviceType"
              className="form-group-spacing"
            >
              <Row>
                <Col xs="auto" className="d-flex align-items-center">
                  <Form.Check
                    type="radio"
                    label="Roku"
                    name="deviceType"
                    value="roku"
                    checked={deviceType === "roku"}
                    onChange={(e) => setDeviceType(e.target.value)}
                  />
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Form.Check
                    type="radio"
                    label="Fire TV"
                    name="deviceType"
                    value="firetv"
                    checked={deviceType === "firetv"}
                    onChange={(e) => setDeviceType(e.target.value)}
                    disabled={!adbPath}
                  />
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Form.Check
                    type="radio"
                    label="Google TV"
                    name="deviceType"
                    value="googletv"
                    checked={deviceType === "googletv"}
                    onChange={(e) => setDeviceType(e.target.value)}
                    disabled={!adbPath}
                  />
                </Col>
                <Col xs="auto" className="d-flex align-items-center ml-auto">
                  <Button
                    title="Add Device"
                    variant="primary"
                    onClick={handleAddDevice}
                  >
                    &#x271A;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
            <Form.Group
              controlId="formDeviceList"
              className="form-group-spacing"
            >
              <Form.Label>Streaming Device List</Form.Label>
              <Row>
                <Col className="d-flex align-items-center flex-grow-1">
                  <Form.Control
                    as="select"
                    value={selectedDevice}
                    onChange={handleDeviceSelect}
                  >
                    <option value="">Select a device to delete</option>
                    {streamingDevices.map((device, index) => (
                      <option key={index} value={device.id}>
                        {device.type}:{" "}
                        {device.alias ? device.alias + " - " : ""}
                        {device.ipAddress}
                      </option>
                    ))}
                  </Form.Control>
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Button
                    title="Delete Device"
                    variant="primary"
                    onClick={handleDeleteDevice}
                  >
                    &#x232B;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
            <Form.Group controlId="formAdbPath" className="form-group-spacing">
              <Form.Label>ADB Tool Path</Form.Label>
              <Row>
                <Col className="d-flex align-items-center flex-grow-1">
                  <Form.Control type="text" readOnly value={adbPath} />
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Button
                    title="Select ADB Path"
                    variant="primary"
                    onClick={handleSelectAdbPath}
                  >
                    &#x2026;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

function notifyControlChange(type, payload) {
  electronAPI.sendSync("shared-window-channel", {
    type: type,
    payload: payload,
  });
}

export default ControlSection;
