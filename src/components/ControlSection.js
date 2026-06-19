/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useState, useEffect, useRef } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

const { electronAPI } = window;

function ControlSection({ streamingDevices, onUpdateStreamingDevices, onDeletedDevice }) {
  const [ipAddress, setIpAddress] = useState("");
  const [alias, setAlias] = useState("");
  const [deviceType, setDeviceType] = useState("roku");
  const [selectedDevice, setSelectedDevice] = useState("");
  const [adbPath, setAdbPath] = useState("");
  const [atvremotePath, setAtvremotePath] = useState("");
  const [rdkPort, setRdkPort] = useState("9998");
  const [rdkToken, setRdkToken] = useState("");
  const [rdkTestStatus, setRdkTestStatus] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const ipAddressRef = useRef(null);

  useEffect(() => {
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.control && settings.control.adbPath) {
        setAdbPath(settings.control.adbPath);
      }
      if (settings.control && settings.control.atvremotePath) {
        setAtvremotePath(settings.control.atvremotePath);
      }
    });
    electronAPI.getPackageInfo().then((info) => {
      if (info?.repository?.url) setRepoUrl(info.repository.url);
    });
  }, []);

  const isValidIpAddress = (ip) => {
    const regex =
      /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    return regex.test(ip);
  };

  const isValidAtvDeviceId = (id) => {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const macRegex = /^([0-9a-f]{2}[:-]){5}[0-9a-f]{2}$/i;
    return uuidRegex.test(id) || macRegex.test(id) || isValidIpAddress(id);
  };

  const isValidPort = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 && n <= 65535;
  };

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 3000);
  };

  const handleAddDevice = () => {
    const isAppleTVLocal = deviceType === "appletv";
    const isRDK = deviceType === "xumo";
    const isAdb = deviceType === "firetv" || deviceType === "googletv";

    if (isAdb && !adbPath) {
      showError("Set the ADB tool path below before adding this device.");
      return;
    }
    if (isAppleTVLocal && !atvremotePath) {
      showError("Set the atvremote tool path below before adding this device.");
      return;
    }

    if (isAppleTVLocal) {
      if (!isValidAtvDeviceId(ipAddress)) {
        showError("Invalid device ID (use UUID, MAC address, or IP).");
        return;
      }
    } else if (!isValidIpAddress(ipAddress)) {
      showError("Invalid IP address format.");
      return;
    }
    if (isRDK && !isValidPort(rdkPort)) {
      showError("Invalid RDK port (must be 1–65535).");
      return;
    }

    const proposedId = isRDK ? `${ipAddress}:${rdkPort}|rdk` : null;
    const dupCheck = isRDK
      ? streamingDevices.some((device) => device.id === proposedId)
      : streamingDevices.some((device) => device.ipAddress === ipAddress);
    if (dupCheck) {
      showError(isAppleTVLocal ? "Device ID already exists." : "Device already exists.");
      return;
    }

    if (ipAddress && deviceType) {
      let protocol = "ecp";
      if (deviceType === "firetv" || deviceType === "googletv") {
        protocol = "adb";
      } else if (deviceType === "appletv") {
        protocol = "atv";
      } else if (deviceType === "xumo") {
        protocol = "rdk";
      }
      let type = "";
      if (deviceType === "roku") {
        type = "Roku";
      } else if (deviceType === "firetv") {
        type = "Fire TV";
      } else if (deviceType === "googletv") {
        type = "Google TV";
      } else if (deviceType === "appletv") {
        type = "Apple TV";
      } else if (deviceType === "xumo") {
        type = "Xumo Stream Box";
      }
      const newDevice = {
        id: isRDK ? proposedId : `${ipAddress}|${protocol}`,
        ipAddress: ipAddress,
        alias: alias.trim(),
        linked: "",
        type: type,
      };
      if (isRDK) {
        newDevice.port = Number(rdkPort);
        newDevice.token = rdkToken.trim();
      }
      const newDeviceList = [...streamingDevices, newDevice];
      onUpdateStreamingDevices(newDeviceList);
      setIpAddress("");
      setAlias("");
      setRdkToken("");
      setRdkTestStatus("");
      setSelectedDevice(newDevice.id);
      setErrorMessage("");
      ipAddressRef.current.focus();
    }
  };

  const handleTestRdkConnection = async () => {
    if (!isValidIpAddress(ipAddress)) {
      setRdkTestStatus("Invalid IP address.");
      return;
    }
    if (!isValidPort(rdkPort)) {
      setRdkTestStatus("Invalid port.");
      return;
    }
    setRdkTestStatus("Testing…");
    const result = await electronAPI.invoke("test-rdk-connection", {
      host: ipAddress,
      port: Number(rdkPort),
      token: rdkToken.trim(),
    });
    if (result?.success) {
      setRdkTestStatus("Connected ✓");
    } else {
      setRdkTestStatus(`Failed: ${result?.error || "no response"}`);
    }
  };

  const handleDeviceSelect = (e) => {
    setSelectedDevice(e.target.value);
  };

  const handleDeleteDevice = () => {
    onDeletedDevice(selectedDevice);
    const newDeviceList = streamingDevices.filter((device) => device.id !== selectedDevice);
    onUpdateStreamingDevices(newDeviceList);
    setSelectedDevice("");
  };

  const handleSelectAdbPath = async () => {
    const path = await electronAPI.invoke("select-adb-path", adbPath);
    if (path) {
      setAdbPath(path);
      notifyControlChange("set-adb-path", path);
    }
  };

  const handleSelectAtvPath = async () => {
    const path = await electronAPI.invoke("select-atv-path", atvremotePath);
    if (path) {
      setAtvremotePath(path);
    }
  };

  const isAdbType = deviceType === "firetv" || deviceType === "googletv";
  const isAppleTV = deviceType === "appletv";
  const isXumo = deviceType === "xumo";

  return (
    <div className="p-2" style={{ position: "relative", fontSize: "0.85rem" }}>
      <Card>
        <Card.Body className="p-2">
          <Form>
            <Form.Group controlId="formDeviceType" className="form-group-spacing">
              <Form.Label>Select Device Type:</Form.Label>
              <Form.Control
                size="sm"
                as="select"
                value={deviceType}
                onChange={(e) => {
                  setDeviceType(e.target.value);
                  setRdkTestStatus("");
                }}
              >
                <option value="roku">Roku (ECP)</option>
                <option value="firetv">Fire TV (ADB)</option>
                <option value="googletv">Google TV (ADB)</option>
                <option value="appletv">Apple TV (atvremote)</option>
                <option value="xumo">Xumo (RDK)</option>
              </Form.Control>
            </Form.Group>
            <Form.Group controlId="formIpAddress" className="form-group-spacing">
              <Row className="align-items-center">
                <Col>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder={isAppleTV ? "Enter Device ID (UUID or MAC)" : "Enter IP address"}
                    value={ipAddress}
                    onChange={(e) => setIpAddress(e.target.value)}
                    ref={ipAddressRef}
                  />
                </Col>
                <Col>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Enter Alias"
                    value={alias}
                    onChange={(e) => setAlias(e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button size="sm" title="Add Device" variant="primary" onClick={handleAddDevice}>
                    &#x271A;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
            {errorMessage && (
              <Alert
                variant="danger"
                className="custom-alert"
                style={{
                  position: "absolute",
                  top: "10px",
                  left: "50%",
                  transform: "translateX(-50%)",
                  zIndex: 1050,
                  minWidth: "300px",
                  maxWidth: "90%",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
                }}
              >
                {errorMessage}
              </Alert>
            )}
            {isAdbType && (
              <Form.Group controlId="formAdbPath" className="form-group-spacing">
                <Form.Label>ADB Tool Path (Android based devices like Fire TV and Google TV)</Form.Label>
                <Row>
                  <Col className="d-flex align-items-center flex-grow-1">
                    <Form.Control
                      size="sm"
                      type="text"
                      value={adbPath}
                      onChange={(e) => { setAdbPath(e.target.value); notifyControlChange("set-adb-path", e.target.value); }}
                      placeholder="Paste or select path to adb binary"
                    />
                  </Col>
                  <Col xs="auto" className="d-flex align-items-center">
                    <Button size="sm" title="Select ADB Path" variant="primary" onClick={handleSelectAdbPath}>
                      &#x2026;
                    </Button>
                  </Col>
                </Row>
              </Form.Group>
            )}
            {isAppleTV && (
              <Form.Group controlId="formAtvremotePath" className="form-group-spacing">
                <Form.Label>atvremote Tool Path (Apple TV devices)</Form.Label>
                <Row>
                  <Col className="d-flex align-items-center flex-grow-1">
                    <Form.Control
                      size="sm"
                      type="text"
                      value={atvremotePath}
                      onChange={(e) => { setAtvremotePath(e.target.value); notifyControlChange("set-atv-path", e.target.value); }}
                      placeholder="Paste or select path to atvremote binary"
                    />
                  </Col>
                  <Col xs="auto" className="d-flex align-items-center">
                    <Button size="sm" title="Select atvremote Path" variant="primary" onClick={handleSelectAtvPath}>
                      &#x2026;
                    </Button>
                  </Col>
                </Row>
              </Form.Group>
            )}
            {isXumo && (
              <Form.Group controlId="formRdkConfig" className="form-group-spacing">
                <Form.Label>RDK JSON-RPC Endpoint</Form.Label>
                <Row className="align-items-center">
                  <Col xs={3}>
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="Port"
                      value={rdkPort}
                      onChange={(e) => setRdkPort(e.target.value)}
                    />
                  </Col>
                  <Col>
                    <Form.Control
                      size="sm"
                      type="text"
                      placeholder="Bearer token (optional)"
                      value={rdkToken}
                      onChange={(e) => setRdkToken(e.target.value)}
                    />
                  </Col>
                  <Col xs="auto">
                    <Button size="sm" variant="outline-secondary" onClick={handleTestRdkConnection}>
                      Test
                    </Button>
                  </Col>
                </Row>
                {rdkTestStatus && (
                  <div style={{ fontSize: "0.72rem", marginTop: "4px", color: rdkTestStatus.startsWith("Connected") ? "#198754" : "#b61717" }}>
                    {rdkTestStatus}
                  </div>
                )}
              </Form.Group>
            )}
            <Form.Group controlId="formDeviceList" className="form-group-spacing">
              <Form.Label>Streaming Device List</Form.Label>
              <Row>
                <Col className="d-flex align-items-center flex-grow-1">
                  <Form.Control size="sm" as="select" value={selectedDevice} onChange={handleDeviceSelect}>
                    <option value="">Select a device to delete</option>
                    {streamingDevices.map((device, index) => (
                      <option key={index} value={device.id}>
                        {device.type}: {device.alias ? device.alias + " - " : ""}
                        {device.ipAddress}
                        {device.port ? `:${device.port}` : ""}
                      </option>
                    ))}
                  </Form.Control>
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Button size="sm" title="Delete Device" variant="primary" onClick={handleDeleteDevice}>
                    &#x232B;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>

      {deviceType === "roku" && (
        <Alert variant="warning" className="mt-2 mb-0 p-1" style={{ fontSize: "0.72rem" }}>
          <strong>Roku users:</strong> To enable ECP (External Control Protocol), follow these steps on your device:
          <ol className="mb-0 mt-1 ps-3">
            <li>Go to <strong>Settings &gt; System &gt; Advanced system settings</strong>.</li>
            <li>Select <strong>Control by mobile apps</strong>.</li>
            <li>Set to <strong>Enabled</strong> or <strong>Permissive</strong>.</li>
          </ol>
        </Alert>
      )}

      {isAdbType && (
        <Alert variant="warning" className="mt-2 mb-0 p-1" style={{ fontSize: "0.72rem" }}>
          <strong>Fire TV / Google TV users:</strong> Enable Developer options and ADB debugging on the device:
          <ol className="mb-0 mt-1 ps-3">
            <li>Go to <strong>Settings &gt; My Fire TV / About</strong> (or the device's About screen).</li>
            <li>Tap the build number 7 times to unlock <strong>Developer options</strong>.</li>
            <li>Enable <strong>ADB debugging</strong> and <strong>Apps from Unknown Sources</strong>.</li>
            <li>Install the <code>adb</code> binary on this machine and set its path above.</li>
          </ol>
          <a
            href="#adb-setup"
            onClick={(e) => { e.preventDefault(); electronAPI.openExternal(`${repoUrl}/blob/main/docs/setup-android-firetv.md`); }}
          >
            Setup Guide ↗
          </a>
        </Alert>
      )}

      {isAppleTV && (
        <Alert variant="warning" className="mt-2 mb-0 p-1" style={{ fontSize: "0.72rem" }}>
          <strong>Apple TV users:</strong> Requirements for `atvremote` (pyatv) control:
          <ol className="mb-0 mt-1 ps-3">
            <li>Install Python 3 and the <code>pyatv</code> package (provides the <code>atvremote</code> CLI).</li>
            <li>Pair with the Apple TV using <code>atvremote pair --protocol companion</code> and save the credentials.</li>
            <li>Enter the device's UUID, MAC address, or IP above and set the <code>atvremote</code> path.</li>
          </ol>
          <a
            href="#atv-setup"
            onClick={(e) => { e.preventDefault(); electronAPI.openExternal(`${repoUrl}/blob/main/docs/setup-apple-tv.md`); }}
          >
            Setup Guide ↗
          </a>
        </Alert>
      )}

      {isXumo && (
        <Alert variant="warning" className="mt-2 mb-0 p-1" style={{ fontSize: "0.72rem" }}>
          <strong>Xumo (Beta):</strong> RDK control is experimental. Retail Stream Boxes do not expose
          the Thunder JSON-RPC port on the LAN — you need a developer-enabled device with port 9998
          reachable from this machine. Reach out to Comcast/Xumo partner support for access.
        </Alert>
      )}

    </div>
  );
}

function notifyControlChange(type, payload) {
  electronAPI.sendSync("shared-window-channel", {
    type: type,
    payload: payload,
  });
}

export default ControlSection;
