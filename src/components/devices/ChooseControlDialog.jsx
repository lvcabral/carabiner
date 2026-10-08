/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useRef, useState } from "react";
import Modal from "react-bootstrap/Modal";
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import Alert from "react-bootstrap/Alert";
import { ConfirmBar, Dot, ExternalLink, IconButton, TrashIcon, currentTheme } from "./ui";
import {
  CONTROL_TYPES,
  RDK_DEFAULT_PORT,
  addManualDevice,
  controlAddress,
  controlName,
  controlsByType,
  controlTypeOf,
  isChosen,
} from "./devicesModel";

const { electronAPI } = window;

// Setup notes per device type, as on the old Control tab (the tool paths now live on General).
function TypeHint({ typeKey, repoUrl }) {
  const guide = (doc) => <ExternalLink url={`${repoUrl}/blob/main/docs/${doc}.md`}>Setup Guide ↗</ExternalLink>;
  const note = (children) => (
    <Alert variant="warning" className="mt-2 mb-0 p-1" style={{ fontSize: "0.72rem" }}>
      {children}
    </Alert>
  );
  if (typeKey === "roku") {
    return note(
      <>
        <strong>Roku users:</strong> To enable ECP (External Control Protocol), follow these steps on your device:
        <ol className="mb-0 mt-1 ps-3">
          <li>
            Go to <strong>Settings &gt; System &gt; Advanced system settings</strong>.
          </li>
          <li>
            Select <strong>Control by mobile apps</strong>.
          </li>
          <li>
            Set to <strong>Enabled</strong> or <strong>Permissive</strong>.
          </li>
        </ol>
      </>,
    );
  }
  if (typeKey === "firetv" || typeKey === "googletv") {
    return note(
      <>
        <strong>Fire TV / Google TV users:</strong> Enable Developer options and ADB debugging on the device:
        <ol className="mb-0 mt-1 ps-3">
          <li>
            Go to <strong>Settings &gt; My Fire TV / About</strong> (or the device's About screen).
          </li>
          <li>
            Tap the build number 7 times to unlock <strong>Developer options</strong>.
          </li>
          <li>
            Enable <strong>ADB debugging</strong> and <strong>Apps from Unknown Sources</strong>.
          </li>
          <li>
            Install the <code>adb</code> binary on this machine and set its path on the General tab.
          </li>
        </ol>
        {guide("setup-android-firetv")}
      </>,
    );
  }
  if (typeKey === "appletv") {
    return note(
      <>
        <strong>Apple TV users:</strong> Requirements for `atvremote` (pyatv) control:
        <ol className="mb-0 mt-1 ps-3">
          <li>
            Install Python 3 and the <code>pyatv</code> package (provides the <code>atvremote</code> CLI).
          </li>
          <li>
            Pair with the Apple TV using <code>atvremote pair --protocol companion</code> and save the credentials.
          </li>
          <li>
            Enter the device's UUID, MAC address, or IP above and set the <code>atvremote</code> path on the General
            tab.
          </li>
        </ol>
        {guide("setup-apple-tv")}
      </>,
    );
  }
  return note(
    <>
      <strong>Xumo (Beta):</strong> RDK control is experimental. Retail Stream Boxes do not expose the Thunder JSON-RPC
      port on the LAN — you need a developer-enabled device with port 9998 reachable from this machine. Reach out to
      Comcast/Xumo partner support for access.
    </>,
  );
}

// Checkbox that also shows the "some checked" (indeterminate) state.
function SelectAll({ checked, indeterminate, onChange, label }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);
  return (
    <label className="pick-row pick-select-all">
      <input ref={ref} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="grow">{label}</span>
    </label>
  );
}

// "Choose control devices" checklist. Opening it scans the network. Every change applies right
// away: checking a device shows it on the Control tab, and devices added by hand are checked.
function ChooseControlDialog({
  show,
  deviceList,
  online,
  onHide,
  onToggle,
  onSetAll,
  onRemove,
  onDeviceListChange,
  onScan,
  toast,
}) {
  const [scanning, setScanning] = useState(false);
  const [lastFound, setLastFound] = useState(null); // ids found or reachable in the latest scan
  const [scanError, setScanError] = useState("");
  const [confirmId, setConfirmId] = useState(""); // device awaiting "Remove?"
  const [typeKey, setTypeKey] = useState("roku");
  const [address, setAddress] = useState("");
  const [name, setName] = useState("");
  const [rdkPort, setRdkPort] = useState(String(RDK_DEFAULT_PORT));
  const [rdkToken, setRdkToken] = useState("");
  const [rdkTest, setRdkTest] = useState("");
  const [error, setError] = useState("");
  const [showAdd, setShowAdd] = useState(false); // "Add by hand" form, opened on demand
  const [paths, setPaths] = useState({ adb: "", atv: "" });
  const [repoUrl, setRepoUrl] = useState("");

  const scan = async () => {
    setScanning(true);
    const { found, error: failed } = await onScan();
    setLastFound(found);
    setScanError(failed);
    setScanning(false);
  };

  useEffect(() => {
    if (!show) return;
    setError("");
    setConfirmId("");
    setShowAdd(false);
    setLastFound(null);
    electronAPI
      .invoke("load-settings")
      .then((s) => setPaths({ adb: s.control?.adbPath || "", atv: s.control?.atvremotePath || "" }));
    electronAPI.getPackageInfo().then((info) => setRepoUrl(info?.repository?.url || ""));
    scan();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);

  const isXumo = typeKey === "xumo";

  const handleAdd = () => {
    // These are driven through a command-line tool, which has to be set up first.
    const proto = CONTROL_TYPES.find((t) => t.key === typeKey)?.proto;
    if (proto === "adb" && !paths.adb) {
      setError("Set the ADB tool path on the General tab before adding this device.");
      return;
    }
    if (proto === "atv" && !paths.atv) {
      setError("Set the atvremote tool path on the General tab before adding this device.");
      return;
    }
    const res = addManualDevice(deviceList, { typeKey, address, name, port: rdkPort, token: rdkToken });
    if (res.error) {
      setError(res.error);
      return;
    }
    setError("");
    if (res.duplicate) {
      if (!isChosen(res.duplicate)) onToggle(res.duplicate.id, true);
      toast(`${controlName(res.duplicate)} is already in the list. Checked it.`);
      return;
    }
    onDeviceListChange(res.deviceList);
    setAddress("");
    setName("");
    setRdkToken("");
    setRdkTest("");
    toast(`Added ${controlName(res.device)}.`);
  };

  const testRdk = async () => {
    // Same address/port checks as adding it.
    const check = addManualDevice([], { typeKey: "xumo", address, port: rdkPort });
    if (check.error) {
      setRdkTest(check.error);
      return;
    }
    setRdkTest("Testing…");
    const r = await electronAPI.invoke("test-rdk-connection", {
      host: address.trim(),
      port: Number(rdkPort),
      token: rdkToken.trim(),
    });
    setRdkTest(r?.success ? "Connected ✓" : `Failed: ${r?.error || "no response"}`);
  };

  const devices = controlsByType(deviceList).flatMap((group) => group.devices);
  const checkedCount = devices.filter(isChosen).length;

  const detailFor = (d) => {
    const addr = controlAddress(d);
    if (!scanning && lastFound && !lastFound.has(d.id)) return `${addr}, not found in this scan`;
    return addr;
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      scrollable
      data-bs-theme={currentTheme()}
      aria-labelledby="choose-control-title"
    >
      <Modal.Header closeButton>
        <div>
          <Modal.Title id="choose-control-title" style={{ fontSize: "1.05rem" }}>
            Choose control devices
          </Modal.Title>
          <div className="text-muted" style={{ fontSize: "0.78rem" }}>
            Checked devices show on the Control tab.
          </div>
        </div>
      </Modal.Header>
      <Modal.Body style={{ fontSize: "0.85rem", paddingTop: 0 }}>
        <div className="pick-group">
          <span className="title">Devices</span>
          {scanning ? (
            <span className="sub d-inline-flex align-items-center gap-1">
              <Spinner animation="border" size="sm" /> Scanning your network
            </span>
          ) : scanError ? (
            <span className="sub text-danger" role="alert" title={scanError}>
              Roku scan failed: {scanError}
            </span>
          ) : (
            <span className="sub">Scan finished</span>
          )}
          <span className="spacer" />
          {!showAdd && (
            <Button
              size="sm"
              variant="link"
              className="p-0 me-3"
              onClick={() => setShowAdd(true)}
              title="For devices a scan can't see"
            >
              Add by hand
            </Button>
          )}
          <Button size="sm" variant="link" className="p-0" onClick={scan} disabled={scanning}>
            Scan again
          </Button>
        </div>
        {showAdd && (
          <div className="mb-2">
            <div className="pick-box">
              <div className="pick-inline">
                <Form.Control
                  as="select"
                  size="sm"
                  aria-label="Device type"
                  value={typeKey}
                  onChange={(e) => {
                    setTypeKey(e.target.value);
                    setRdkTest("");
                  }}
                >
                  {CONTROL_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </Form.Control>
                <Form.Control
                  size="sm"
                  placeholder={typeKey === "appletv" ? "IP, MAC or device ID" : "IP address"}
                  aria-label="Address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAdd()}
                />
                <Form.Control
                  size="sm"
                  placeholder="Name (optional)"
                  aria-label="Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ flex: "0 1 130px" }}
                />
                <Button size="sm" variant="outline-secondary" onClick={handleAdd}>
                  Add
                </Button>
                <Button size="sm" variant="link" onClick={() => setShowAdd(false)}>
                  Close
                </Button>
              </div>
              {isXumo && (
                <div className="pick-inline">
                  <Form.Control
                    size="sm"
                    placeholder="Port"
                    aria-label="RDK port"
                    value={rdkPort}
                    onChange={(e) => setRdkPort(e.target.value)}
                    style={{ flex: "0 1 80px" }}
                  />
                  <Form.Control
                    size="sm"
                    placeholder="Bearer token (optional)"
                    aria-label="RDK bearer token"
                    value={rdkToken}
                    onChange={(e) => setRdkToken(e.target.value)}
                  />
                  <Button size="sm" variant="outline-secondary" onClick={testRdk}>
                    Test
                  </Button>
                  {rdkTest && (
                    <span className="align-self-center" style={{ fontSize: "0.75rem" }}>
                      {rdkTest}
                    </span>
                  )}
                </div>
              )}
              {error && <div className="pick-error">{error}</div>}
            </div>
            <TypeHint typeKey={typeKey} repoUrl={repoUrl} />
          </div>
        )}
        <div className="pick-box">
          {devices.length === 0 && <div className="pick-none">Nothing yet. Scan again, or add one by hand.</div>}
          {devices.length > 1 && (
            <SelectAll
              checked={checkedCount === devices.length}
              indeterminate={checkedCount > 0 && checkedCount < devices.length}
              onChange={onSetAll}
              label={`Select all (${checkedCount} of ${devices.length})`}
            />
          )}
          {devices.map((d) => (
            <div className="pick-item" key={d.id}>
              <div className="pick-row">
                <label className="pick-main">
                  <input type="checkbox" checked={isChosen(d)} onChange={(e) => onToggle(d.id, e.target.checked)} />
                  <span className="grow">
                    <div>{controlName(d)}</div>
                    <div className="sub">{detailFor(d)}</div>
                  </span>
                </label>
                <span className="type">{controlTypeOf(d).label}</span>
                <Dot live={online[d.id] === true} />
                <IconButton label={`Remove ${controlName(d)}`} title="Remove" danger className="ms-1" onClick={() => setConfirmId(d.id)}>
                  <TrashIcon />
                </IconButton>
              </div>
              {confirmId === d.id && (
                <ConfirmBar
                  message={`Remove ${controlName(d)} from Carabiner? A scan may find it again if it's on your network.`}
                  onConfirm={() => {
                    setConfirmId("");
                    onRemove(d);
                  }}
                  onCancel={() => setConfirmId("")}
                />
              )}
            </div>
          ))}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="primary" onClick={onHide}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ChooseControlDialog;
