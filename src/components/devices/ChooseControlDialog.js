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
import { Dot, currentTheme } from "./ui";
import {
  CONTROL_TYPES,
  RDK_DEFAULT_PORT,
  addManualDevice,
  controlName,
  controlTypeOf,
  isChosen,
  userControls,
} from "./devicesModel";

const { electronAPI } = window;

// Setup notes per device type, as on the old Control tab (the tool paths now live on General).
function TypeHint({ typeKey, repoUrl }) {
  const guide = (doc) => (
    <a
      href={`#${doc}`}
      onClick={(e) => {
        e.preventDefault();
        electronAPI.openExternal(`${repoUrl}/blob/main/docs/${doc}.md`);
      }}
    >
      Setup Guide ↗
    </a>
  );
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

// "Choose control devices" checklist. Opening it scans the network. Every change applies right
// away: checking a device shows it on the Devices page, and devices added by hand are checked.
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

function ChooseControlDialog({
  show,
  deviceList,
  online,
  onHide,
  onToggle,
  onSetAll,
  onDeviceListChange,
  onScan,
  toast,
}) {
  const [scanning, setScanning] = useState(false);
  const [lastFound, setLastFound] = useState(null); // ids found or reachable in the latest scan
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
    const found = await onScan();
    setLastFound(found);
    setScanning(false);
  };

  useEffect(() => {
    if (!show) return;
    setError("");
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
    const needsTool =
      (controlTypeOf(res.device).proto === "adb" && !paths.adb) ||
      (controlTypeOf(res.device).proto === "atv" && !paths.atv);
    toast(
      needsTool
        ? `Added ${controlName(res.device)}. Set its tool path on the General tab.`
        : `Added ${controlName(res.device)}.`,
    );
  };

  const testRdk = async () => {
    setRdkTest("Testing…");
    const r = await electronAPI.invoke("test-rdk-connection", {
      host: address.trim(),
      port: Number(rdkPort),
      token: rdkToken.trim(),
    });
    setRdkTest(r?.success ? "Connected ✓" : `Failed: ${r?.error || "no response"}`);
  };

  const devices = CONTROL_TYPES.flatMap((t) => userControls(deviceList).filter((d) => controlTypeOf(d).key === t.key));
  const checkedCount = devices.filter(isChosen).length;

  const detailFor = (d) => {
    const addr = d.port ? `${d.ipAddress}:${d.port}` : d.ipAddress;
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
            Checked devices show on the Devices page.
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
            <label className="pick-row" key={d.id}>
              <input
                type="checkbox"
                checked={isChosen(d)}
                onChange={(e) => onToggle(d.id, e.target.checked)}
                aria-label={controlName(d)}
              />
              <span className="grow">
                <div>{controlName(d)}</div>
                <div className="sub">{detailFor(d)}</div>
              </span>
              <span className="type">{controlTypeOf(d).label}</span>
              <Dot live={online[d.id] === true} />
            </label>
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
