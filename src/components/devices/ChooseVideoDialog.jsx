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
import {
  ConfirmBar,
  Dot,
  ExternalLink,
  IconButton,
  PencilIcon,
  RefreshButton,
  SourceIcon,
  TrashIcon,
  currentTheme,
} from "./ui";
import { isLocalHost, isMissingRce, rceStatusText } from "./devicesModel";

const RCE_DOCS_URL = "https://developer.roku.com/dev/docs/rce";
const SIMULATOR_RELEASES_URL = "https://github.com/lvcabral/brs-desktop/releases";

// Inline rename for a Cloud Emulator account (the dialog can't open a second modal either).
// Enter saves, Escape cancels without closing the dialog. onSave resolves to { ok, message? }.
function RenameBar({ initialValue, onSave, onCancel }) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    if (saving) return;
    if (!value.trim()) {
      setError("Enter a name for the account.");
      return;
    }
    setSaving(true);
    const res = await onSave(value.trim());
    setSaving(false);
    if (!res?.ok) setError(res?.message || "Couldn't rename the account.");
  };
  return (
    <>
      <div className="pick-inline align-items-center">
        <Form.Control
          size="sm"
          aria-label="Account name"
          value={value}
          autoFocus
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") {
              e.stopPropagation(); // cancel the rename, not the whole dialog
              onCancel();
            }
          }}
        />
        <Button size="sm" variant="primary" onClick={save} disabled={saving || !value.trim()}>
          Save
        </Button>
        <Button size="sm" variant="link" onClick={onCancel}>
          Cancel
        </Button>
      </div>
      {error && <div className="pick-error">{error}</div>}
    </>
  );
}

function PickRow({ entry, checked, onToggle, detail, live, onRemove, confirming, onConfirmRemove, onCancelRemove }) {
  return (
    <div className="pick-item">
      <div className="pick-row">
        <label className="pick-main">
          <input type="checkbox" checked={checked} onChange={(e) => onToggle(entry.id, e.target.checked)} />
          <span className="grow">
            <div>
              <SourceIcon kind={entry.kind} />
              {entry.name}
            </div>
            {detail && <div className="sub">{detail}</div>}
          </span>
        </label>
        {live !== undefined && <Dot live={live} />}
        {onRemove && (
          <IconButton label={`Remove ${entry.name}`} title="Remove" danger className="ms-1" onClick={() => onRemove(entry)}>
            <TrashIcon />
          </IconButton>
        )}
      </div>
      {confirming && (
        <ConfirmBar
          message={`Remove ${entry.name}? You'd have to add it again.`}
          onConfirm={onConfirmRemove}
          onCancel={onCancelRemove}
        />
      )}
    </div>
  );
}

// Which groups are collapsed is a per-computer convenience, so plain localStorage is enough.
const COLLAPSED_KEY = "carabiner.chooseVideo.collapsed";
const loadCollapsed = () => {
  try {
    return new Set(JSON.parse(localStorage.getItem(COLLAPSED_KEY) || "[]"));
  } catch {
    return new Set();
  }
};
const saveCollapsed = (set) => {
  try {
    localStorage.setItem(COLLAPSED_KEY, JSON.stringify([...set]));
  } catch {
    // not persisted; still works for this session
  }
};

function Chevron({ open }) {
  return (
    <svg
      className={`group-chevron${open ? " open" : ""}`}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden="true"
    >
      <path d="M6 3l5 5-5 5" />
    </svg>
  );
}

// A collapsible group: the chevron + title toggle it; `actions` stay clickable on the right.
function PickGroup({ id, title, meta, metaTitle, actions, collapsed, onToggle, children }) {
  const open = !collapsed;
  return (
    <div>
      <div className="pick-group">
        <button
          type="button"
          className="group-toggle"
          aria-expanded={open}
          aria-controls={`group-${id}`}
          onClick={() => onToggle(id)}
        >
          <Chevron open={open} />
          <span className="title">{title}</span>
        </button>
        {meta && (
          <span className="sub" title={metaTitle}>
            {meta}
          </span>
        )}
        <span className="spacer" />
        {actions}
      </div>
      {/* Always rendered (hidden when collapsed) so aria-controls points at a real element. */}
      <div id={`group-${id}`} hidden={!open}>
        {children}
      </div>
    </div>
  );
}

const countOf = (list) => `${list.filter((e) => e.chosen).length} of ${list.length}`;

// "Choose video" checklist. Every change applies right away: checking a box shows the source on
// the Video tab, and accounts, stream URLs and simulators are saved as they are added.
function ChooseVideoDialog({
  show,
  entries,
  accounts,
  onHide,
  onToggle,
  onAddAccount,
  onRefreshAccount,
  onRenameAccount,
  onRemoveAccount,
  onAddStream,
  onAddSimulator,
  onTestSimulator,
  onRemoveStream,
  toast,
}) {
  const [confirmId, setConfirmId] = useState(""); // entry or account id awaiting "Remove?"
  const [renamingId, setRenamingId] = useState(""); // account being renamed
  const [acctForm, setAcctForm] = useState(false);
  const [token, setToken] = useState("");
  const [label, setLabel] = useState("");
  const [apiUrl, setApiUrl] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [acctError, setAcctError] = useState("");
  const [loadingAcct, setLoadingAcct] = useState(false);
  const [refreshing, setRefreshing] = useState("");
  const [url, setUrl] = useState("");
  const [urlName, setUrlName] = useState("");
  const [urlError, setUrlError] = useState("");
  const [simHost, setSimHost] = useState("");
  const [simPort, setSimPort] = useState("8090");
  const [simName, setSimName] = useState("");
  const [simError, setSimError] = useState("");
  const [simTest, setSimTest] = useState(null); // { ok, message } from the Test button
  const tokenRef = useRef(null);
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const toggleGroup = (id) =>
    setCollapsed((c) => {
      const next = new Set(c);
      next.has(id) ? next.delete(id) : next.add(id);
      saveCollapsed(next);
      return next;
    });
  const groupProps = (id) => ({ id, collapsed: collapsed.has(id), onToggle: toggleGroup });

  useEffect(() => {
    if (!show) return;
    setConfirmId("");
    setRenamingId("");
    setAcctForm(false);
    setSimError("");
    setSimTest(null);
    setAcctError("");
    setUrlError("");
  }, [show]);

  const rowProps = (e) => ({
    entry: e,
    checked: e.chosen,
    onToggle,
    confirming: confirmId === e.id,
    onConfirmRemove: () => {
      setConfirmId("");
      onRemoveStream(e);
    },
    onCancelRemove: () => setConfirmId(""),
  });
  const askRemove = (e) => setConfirmId(e.id);

  const captures = entries.filter((e) => e.kind === "capture");
  const simulators = entries.filter((e) => e.kind === "simulator");
  const streams = entries.filter((e) => e.kind === "webrtc");

  const simulatorDetail = (e) =>
    isLocalHost(e.source.host) ? "On this computer" : `${e.source.host}:${e.source.port}`;

  const handleAddAccount = async () => {
    if (loadingAcct) return; // Enter pressed again while adding
    if (!token.trim()) {
      setAcctError("Paste a personal access token.");
      tokenRef.current?.focus();
      return;
    }
    setAcctError("");
    setLoadingAcct(true);
    const res = await onAddAccount({ token: token.trim(), label: label.trim(), apiUrl: apiUrl.trim() });
    setLoadingAcct(false);
    if (!res?.ok) {
      setAcctError(res?.message || "Couldn't load the account's devices.");
      return;
    }
    setToken("");
    setLabel("");
    setApiUrl("");
    setAcctForm(false);
    toast(
      `${res.account.label}: ${res.deviceCount} device${res.deviceCount === 1 ? "" : "s"}. Check the ones you want.`,
    );
  };

  const handleRefresh = async (account) => {
    setRefreshing(account.id);
    const res = await onRefreshAccount(account.id);
    setRefreshing("");
    if (res?.errors?.[account.id]) toast(`${account.label}: ${res.errors[account.id]}`);
  };

  const handleAddStream = () => {
    const id = onAddStream({ url: url.trim(), name: urlName.trim() }, setUrlError);
    if (!id) return;
    setUrl("");
    setUrlName("");
    setUrlError("");
  };

  const handleAddSimulator = async () => {
    setSimTest(null);
    const id = await onAddSimulator({ host: simHost.trim(), port: simPort.trim(), name: simName.trim() }, setSimError);
    if (!id) return;
    setSimHost("");
    setSimPort("8090");
    setSimName("");
  };

  const handleTestSimulator = async () => {
    setSimError("");
    setSimTest({ ok: true, message: "Testing…" });
    setSimTest(await onTestSimulator({ host: simHost.trim(), port: simPort.trim() }));
  };

  return (
    <Modal
      show={show}
      onHide={onHide}
      centered
      scrollable
      data-bs-theme={currentTheme()}
      aria-labelledby="choose-video-title"
    >
      <Modal.Header closeButton>
        <div>
          <Modal.Title id="choose-video-title" style={{ fontSize: "1.05rem" }}>
            Choose video
          </Modal.Title>
          <div className="text-muted" style={{ fontSize: "0.78rem" }}>
            Checked items show on the Video tab.
          </div>
        </div>
      </Modal.Header>
      <Modal.Body style={{ fontSize: "0.85rem", paddingTop: 0 }}>
        <PickGroup
          {...groupProps("local")}
          title="This computer"
          meta={captures.length ? countOf(captures) : ""}
          metaTitle="Capture devices checked"
        >
          <div className="pick-box">
            {captures.length === 0 && <div className="pick-none">No capture devices found.</div>}
            {captures.map((e) => (
              <PickRow key={e.id} {...rowProps(e)} detail={e.hardwareId || "capture device"} />
            ))}
          </div>
        </PickGroup>

        {accounts.map((account) => {
          const devices = entries.filter((e) => e.kind === "rce" && e.source.accountId === account.id);
          return (
            <PickGroup
              key={account.id}
              {...groupProps(account.id)}
              title={account.label}
              meta={
                <>
                  <span className="acct-tag me-1">RCE</span>
                  {account.tail && `••••${account.tail}`}
                  {devices.length > 0 && <span className="ms-2">{countOf(devices)}</span>}
                </>
              }
              metaTitle={`Roku Cloud Emulator account${account.tail ? `, token ending ${account.tail}` : ""}`}
              actions={
                <>
                  <RefreshButton
                    label={`Refresh ${account.label}`}
                    title="Refresh devices and status"
                    refreshing={refreshing === account.id}
                    onClick={() => handleRefresh(account)}
                  />
                  <IconButton
                    label={`Rename ${account.label}`}
                    title="Rename"
                    onClick={() => {
                      if (collapsed.has(account.id)) toggleGroup(account.id);
                      setConfirmId("");
                      setRenamingId(account.id);
                    }}
                  >
                    <PencilIcon />
                  </IconButton>
                  <IconButton
                    label={`Remove ${account.label}`}
                    title="Remove account"
                    danger
                    onClick={() => {
                      if (collapsed.has(account.id)) toggleGroup(account.id);
                      setRenamingId("");
                      setConfirmId(account.id);
                    }}
                  >
                    <TrashIcon />
                  </IconButton>
                </>
              }
            >
              <div className="pick-box">
                {renamingId === account.id && (
                  <RenameBar
                    initialValue={account.label}
                    onSave={async (label) => {
                      const res = await onRenameAccount(account, label);
                      if (res?.ok) setRenamingId("");
                      return res;
                    }}
                    onCancel={() => setRenamingId("")}
                  />
                )}
                {confirmId === account.id && (
                  <ConfirmBar
                    message={`Remove ${account.label} and its ${devices.length} device${devices.length === 1 ? "" : "s"} from Carabiner? The token is deleted too.`}
                    onConfirm={() => {
                      setConfirmId("");
                      onRemoveAccount(account);
                    }}
                    onCancel={() => setConfirmId("")}
                  />
                )}
                {devices.length === 0 && <div className="pick-none">No devices on this account.</div>}
                {devices.map((e) => (
                  <PickRow
                    key={e.id}
                    {...rowProps(e)}
                    detail={e.source.status ? rceStatusText(e.source.status) : ""}
                    live={e.source.status === "running"}
                    // Devices still on the account are managed by it; one that left can be removed.
                    onRemove={isMissingRce(e.source) ? askRemove : undefined}
                  />
                ))}
              </div>
            </PickGroup>
          );
        })}

        {acctForm ? (
          <>
            <div className="pick-group">
              <span className="title">New Cloud Emulator account</span>
            </div>
            <div className="pick-box pick-form">
              <Form.Group controlId="rce-token">
                <Form.Label>Personal access token</Form.Label>
                <Form.Control
                  ref={tokenRef}
                  size="sm"
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAccount()}
                  autoFocus
                />
                <Form.Text>
                  Create one in the <ExternalLink url={RCE_DOCS_URL}>Roku Cloud Emulator</ExternalLink> portal.
                </Form.Text>
              </Form.Group>
              <Form.Group controlId="rce-label">
                <Form.Label>Label (optional)</Form.Label>
                <Form.Control
                  size="sm"
                  placeholder="e.g. Staging"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddAccount()}
                />
              </Form.Group>
              {showAdvanced && (
                <Form.Group controlId="rce-api-url">
                  <Form.Label>Management API URL</Form.Label>
                  <Form.Control
                    size="sm"
                    placeholder="https://api.rce.roku.com/api/v1"
                    value={apiUrl}
                    onChange={(e) => setApiUrl(e.target.value)}
                  />
                </Form.Group>
              )}
              {acctError && (
                <div className="text-danger" role="alert">
                  {acctError}
                </div>
              )}
              <div className="pick-form-actions">
                <Button size="sm" variant="link" className="p-0 me-auto" onClick={() => setShowAdvanced(!showAdvanced)}>
                  {showAdvanced ? "Hide advanced" : "Advanced"}
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setAcctForm(false)}>
                  Cancel
                </Button>
                <Button size="sm" variant="primary" onClick={handleAddAccount} disabled={loadingAcct}>
                  {loadingAcct ? (
                    <>
                      <Spinner animation="border" size="sm" /> Adding…
                    </>
                  ) : (
                    "Add account"
                  )}
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="pick-group">
            <Button size="sm" variant="outline-secondary" onClick={() => setAcctForm(true)}>
              Add Cloud Emulator account
            </Button>
          </div>
        )}

        <PickGroup
          {...groupProps("simulators")}
          title="BrightScript Simulators"
          meta={simulators.length ? countOf(simulators) : ""}
          metaTitle="Simulators checked"
        >
          <div className="pick-box">
            {simulators.map((e) => (
              <PickRow key={e.id} {...rowProps(e)} detail={simulatorDetail(e)} onRemove={askRemove} />
            ))}
            <div className="pick-inline">
              <Form.Control
                size="sm"
                placeholder="Host or IP address"
                aria-label="Simulator host"
                value={simHost}
                onChange={(e) => setSimHost(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSimulator()}
              />
              <Form.Control
                size="sm"
                placeholder="Port"
                aria-label="Simulator port"
                value={simPort}
                onChange={(e) => setSimPort(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSimulator()}
                style={{ flex: "0 1 80px" }}
              />
              <Form.Control
                size="sm"
                placeholder="Name (optional)"
                aria-label="Simulator name"
                value={simName}
                onChange={(e) => setSimName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddSimulator()}
                style={{ flex: "0 1 130px" }}
              />
              <Button size="sm" variant="outline-secondary" onClick={handleTestSimulator}>
                Test
              </Button>
              <Button size="sm" variant="outline-secondary" onClick={handleAddSimulator}>
                Add
              </Button>
            </div>
            {simError && <div className="pick-error">{simError}</div>}
            {simTest && (
              <div className={simTest.ok ? "pick-hint" : "pick-error"} role="status">
                {simTest.message}
              </div>
            )}
            <div className="pick-hint">
              Run the <ExternalLink url={SIMULATOR_RELEASES_URL}>BrightScript Simulator</ExternalLink> and enable its
              remote screen (WebRTC), then enter its host and port. One running on this computer shows up here
              automatically.
            </div>
          </div>
        </PickGroup>

        <PickGroup
          {...groupProps("streams")}
          title="Stream URLs"
          meta={streams.length ? countOf(streams) : ""}
          metaTitle="WebRTC streams (WHEP) you add by URL"
        >
          <div className="pick-box">
            {streams.map((e) => (
              <PickRow key={e.id} {...rowProps(e)} detail={e.source.url} onRemove={askRemove} />
            ))}
            <div className="pick-inline">
              <Form.Control
                size="sm"
                placeholder="http://192.168.1.60:8889/stream/whep"
                aria-label="Stream URL"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddStream()}
              />
              <Form.Control
                size="sm"
                placeholder="Name (optional)"
                aria-label="Stream name"
                value={urlName}
                onChange={(e) => setUrlName(e.target.value)}
                style={{ flex: "0 1 140px" }}
              />
              <Button size="sm" variant="outline-secondary" onClick={handleAddStream}>
                Add
              </Button>
            </div>
            {urlError && <div className="pick-error">{urlError}</div>}
          </div>
        </PickGroup>
      </Modal.Body>
      <Modal.Footer>
        <Button size="sm" variant="primary" onClick={onHide}>
          Done
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

export default ChooseVideoDialog;
