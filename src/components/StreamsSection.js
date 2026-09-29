/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useState } from "react";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import Modal from "react-bootstrap/Modal";

const { electronAPI } = window;

const SIM_DEFAULT_PORT = "8090";
const TYPE_LABELS = { sim: "BrightScript Simulator", rce: "Roku Cloud Emulator" };

const describeSource = (src) =>
  src.type === "rce"
    ? `${TYPE_LABELS.rce}: ${src.name}`
    : `${TYPE_LABELS[src.type] || src.type}: ${src.name} (${src.host}${src.port ? `:${src.port}` : ""})`;

// Catalog of WebRTC stream sources. Sources are enabled and linked to a control device from the
// General tab, next to the capture cards.
function StreamsSection({ sources = [], onUpdateSources }) {
  const [type, setType] = useState("sim");
  const [name, setName] = useState("");
  const [host, setHost] = useState("");
  const [port, setPort] = useState(SIM_DEFAULT_PORT);
  const [token, setToken] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [rceDevices, setRceDevices] = useState([]);
  const [rceDeviceId, setRceDeviceId] = useState("");
  const [selected, setSelected] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [testStatus, setTestStatus] = useState("");
  const [notice, setNotice] = useState("");
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  const showError = (msg) => {
    setErrorMessage(msg);
    setTimeout(() => setErrorMessage(""), 3000);
  };

  const isValidPort = (value) => {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 && n <= 65535;
  };

  const isRce = type === "rce";

  const buildSource = () =>
    isRce
      ? {
          id: `rce-${Date.now().toString(36)}`,
          type,
          name: name.trim() || rceDevices.find((d) => String(d.id) === rceDeviceId)?.name || "Cloud Emulator",
          deviceId: Number(rceDeviceId),
          token: token.trim(),
          apiUrl: apiUrl.trim(),
        }
      : {
          id: `${type}-${Date.now().toString(36)}`,
          type,
          name: name.trim() || host.trim(),
          host: host.trim(),
          port: Number(port),
        };

  const handleLoadDevices = async () => {
    setTestStatus("Loading devices…");
    const res = await electronAPI.invoke("list-rce-devices", { token: token.trim(), apiUrl: apiUrl.trim() });
    if (res?.ok) {
      setRceDevices(res.devices);
      setRceDeviceId(res.devices[0] ? String(res.devices[0].id) : "");
      setTestStatus(res.devices.length ? "" : "No Cloud Emulator devices found.");
    } else {
      setRceDevices([]);
      setTestStatus(res?.message || "Failed to load devices");
    }
  };

  const handleAdd = async () => {
    setNotice("");
    if (isRce) {
      if (!token.trim() || !rceDeviceId) {
        showError("Enter your access token, load the devices and pick one.");
        return;
      }
      const rceSource = buildSource();
      if (sources.some((s) => s.type === "rce" && s.deviceId === rceSource.deviceId)) {
        showError("This stream source already exists.");
        return;
      }
      onUpdateSources([...sources, rceSource]);
      setNotice(`"${rceSource.name}" added. Its control is set up automatically.`);
      setName("");
      setToken("");
      setRceDevices([]);
      setRceDeviceId("");
      setTestStatus("");
      setSelected(rceSource.id);
      return;
    }
    if (!host.trim()) {
      showError("Enter the host name or IP address.");
      return;
    }
    if (!isValidPort(port)) {
      showError("Invalid port (must be 1–65535).");
      return;
    }
    const source = buildSource();
    if (sources.some((s) => s.type === source.type && s.host === source.host && s.port === source.port)) {
      showError("This stream source already exists.");
      return;
    }
    // The simulator's ECP port is reported by its remote screen; fall back to the default.
    let warning = "";
    try {
      const probe = await electronAPI.invoke("test-stream-source", source);
      if (probe?.ok && probe.config?.ecpPort) source.ecpPort = Number(probe.config.ecpPort);
      if (probe?.ok && probe.config?.ecpEnabled === false) {
        warning = " Note: ECP is disabled in the simulator, so keys will not work until you enable it.";
      } else if (!probe?.ok) {
        warning = " Note: the simulator could not be reached; the default ECP port 8060 is assumed.";
      }
    } catch {
      warning = " Note: the simulator could not be reached; the default ECP port 8060 is assumed.";
    }
    onUpdateSources([...sources, source]);
    setNotice(`"${source.name}" added. Its control is set up automatically.${warning}`);
    setName("");
    setHost("");
    setPort(SIM_DEFAULT_PORT);
    setTestStatus("");
    setSelected(source.id);
  };

  const handleRenameOpen = () => {
    const source = sources.find((s) => s.id === selected);
    if (!source) return;
    setRenameValue(source.name || "");
    setRenameOpen(true);
  };

  // Renaming a stream also renames its built-in control (main keeps them in sync).
  const handleRenameConfirm = () => {
    const newName = renameValue.trim();
    if (!newName) return;
    onUpdateSources(sources.map((s) => (s.id === selected ? { ...s, name: newName } : s)));
    setRenameOpen(false);
  };

  const handleDelete = () => {
    if (!selected) return;
    onUpdateSources(sources.filter((s) => s.id !== selected));
    setSelected("");
  };

  const handleTest = async () => {
    if (isRce ? !token.trim() || !rceDeviceId : !host.trim() || !isValidPort(port)) {
      setTestStatus("Enter a valid host and port first.");
      return;
    }
    setTestStatus("Testing…");
    try {
      const res = await electronAPI.invoke("test-stream-source", buildSource());
      setTestStatus(res?.ok ? "Connected" : res?.message || "Connection failed");
    } catch (error) {
      setTestStatus(error.message || "Connection failed");
    }
  };

  return (
    <div className="p-2" style={{ position: "relative", fontSize: "0.85rem" }}>
      <Card>
        <Card.Body className="p-2">
          <Form onSubmit={(e) => e.preventDefault()}>
            <Form.Group controlId="formStreamType" className="form-group-spacing">
              <Form.Label>Stream Source Type:</Form.Label>
              <Form.Control
                size="sm"
                as="select"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setTestStatus("");
                }}
              >
                <option value="sim">BrightScript Simulator (WebRTC)</option>
                <option value="rce">Roku Cloud Emulator (WebRTC)</option>
              </Form.Control>
            </Form.Group>
            {isRce ? (
              <>
            <Form.Group controlId="formStreamToken" className="form-group-spacing">
              <Row className="align-items-center">
                <Col>
                  <Form.Control
                    size="sm"
                    type="password"
                    autoComplete="off"
                    placeholder="Cloud Emulator access token"
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button size="sm" variant="outline-secondary" onClick={handleLoadDevices}>
                    Load devices
                  </Button>
                </Col>
              </Row>
              {rceDevices.length > 0 && (
                <Form.Control
                  size="sm"
                  as="select"
                  className="mt-2"
                  value={rceDeviceId}
                  onChange={(e) => setRceDeviceId(e.target.value)}
                >
                  {rceDevices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} ({d.status})
                    </option>
                  ))}
                </Form.Control>
              )}
              <div className="mt-1">
                <Button
                  size="sm"
                  variant="link"
                  className="p-0"
                  style={{ fontSize: "0.72rem" }}
                  onClick={() => setShowAdvanced(!showAdvanced)}
                >
                  {showAdvanced ? "Hide advanced" : "Advanced"}
                </Button>
              </div>
              {showAdvanced && (
                <Form.Control
                  size="sm"
                  type="text"
                  className="mt-1"
                  placeholder="Management API URL (default: https://api.rce.roku.com/api/v1)"
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                />
              )}
            </Form.Group>
              </>
            ) : (
              <>
            <Form.Group controlId="formStreamHost" className="form-group-spacing">
              <Row className="align-items-center">
                <Col>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Host or IP address"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                  />
                </Col>
                <Col xs={3}>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Port"
                    value={port}
                    onChange={(e) => setPort(e.target.value)}
                  />
                </Col>
              </Row>
            </Form.Group>
              </>
            )}
            <Form.Group controlId="formStreamName" className="form-group-spacing">
              <Row className="align-items-center">
                <Col>
                  <Form.Control
                    size="sm"
                    type="text"
                    placeholder="Enter Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                  />
                </Col>
                <Col xs="auto">
                  <Button size="sm" variant="outline-secondary" onClick={handleTest}>
                    Test
                  </Button>
                </Col>
                <Col xs="auto">
                  <Button size="sm" title="Add Stream Source" variant="primary" onClick={handleAdd}>
                    &#x271A;
                  </Button>
                </Col>
              </Row>
              {testStatus && (
                <div
                  style={{
                    fontSize: "0.72rem",
                    marginTop: "4px",
                    color: testStatus.startsWith("Connected") || testStatus.endsWith("…") ? "#198754" : "#b61717",
                  }}
                >
                  {testStatus}
                </div>
              )}
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
            <Form.Group controlId="formStreamList" className="form-group-spacing">
              <Form.Label>Stream Source List</Form.Label>
              <Row>
                <Col className="d-flex align-items-center flex-grow-1">
                  <Form.Control
                    size="sm"
                    as="select"
                    value={selected}
                    onChange={(e) => setSelected(e.target.value)}
                  >
                    <option value="">Select a source to rename or delete (delete also removes its control)</option>
                    {sources.map((src) => (
                      <option key={src.id} value={src.id}>
                        {describeSource(src)}
                      </option>
                    ))}
                  </Form.Control>
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Button
                    size="sm"
                    title="Rename Stream Source"
                    variant="primary"
                    className="me-1"
                    onClick={handleRenameOpen}
                    disabled={!selected}
                  >
                    &#x270E;
                  </Button>
                  <Button
                    size="sm"
                    title="Delete Stream Source"
                    variant="primary"
                    onClick={handleDelete}
                    disabled={!selected}
                  >
                    &#x232B;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
            {notice && (
              <div style={{ fontSize: "0.75rem", color: "#198754", marginBottom: "8px" }}>{notice}</div>
            )}
            <p className="text-muted small mb-0">
              Every stream comes with its own built-in control, so there is nothing to set up in the
              Control tab: keys are sent to the stream&apos;s device using the same connection details.
              Just enable the stream on the General tab. Enable the
              remote screen (WebRTC) in BrightScript Simulator first, or create a personal access token in the
              Roku Cloud Emulator portal for Cloud Emulator devices.
            </p>
          </Form>
        </Card.Body>
      </Card>
      <Modal show={renameOpen} onHide={() => setRenameOpen(false)} centered size="sm">
        <Modal.Header closeButton>
          <Modal.Title style={{ fontSize: "1rem" }}>Rename Stream Source</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form
            onSubmit={(e) => {
              e.preventDefault();
              handleRenameConfirm();
            }}
          >
            <Form.Control
              size="sm"
              type="text"
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="Enter new name"
            />
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button size="sm" variant="secondary" onClick={() => setRenameOpen(false)}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" onClick={handleRenameConfirm} disabled={!renameValue.trim()}>
            Rename
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}

export default StreamsSection;
