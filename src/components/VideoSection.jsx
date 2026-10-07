/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import Spinner from "react-bootstrap/Spinner";
import { Dot, PencilIcon, RefreshIcon, SourceIcon, TrashIcon } from "./devices/ui";
import { CONTROL_TYPES, controlName, controlTypeOf, controlValueOf, hostOf, rceStatusText } from "./devices/devicesModel";
import { streamControlNote } from "./ControlSection";

const isLocalHost = (host) => ["localhost", "127.0.0.1"].includes(host);

// The Video tab: what you watch. The chosen video sources, each with its control link and Active
// switch, managed through the Choose video dialog. State and actions come from useDevices().
function VideoSection({ devices }) {
  const {
    singleWindowMode,
    onSingleWindowModeChange,
    chosenEntries,
    chosenControls,
    refreshing,
    handleRefresh,
    accountOf,
    pairFor,
    handleActive,
    handleControlChoice,
    handleDeleteVideo,
    setRename,
    setShowVideo,
  } = devices;

  const statusLine = (entry) => {
    if (entry.kind === "rce") {
      const account = accountOf(entry.source.accountId);
      return (
        <>
          <Dot live={entry.source.status === "running"} />
          <span className="text">{rceStatusText(entry.source.status)}</span>
          {account && <span className="acct-tag">{account.label}</span>}
        </>
      );
    }
    if (entry.kind === "simulator") {
      const { host, port } = entry.source;
      return (
        <>
          <Dot live />
          <span className="text">{isLocalHost(host) ? "running on this computer" : `${host}:${port}`}</span>
        </>
      );
    }
    if (entry.kind === "webrtc") {
      return (
        <>
          <Dot live />
          <span className="text">{entry.source.url}</span>
        </>
      );
    }
    return <span className="text">{entry.hardwareId || "capture device"}</span>;
  };


  const controlCell = (entry) => {
    if (entry.kind === "rce" || entry.kind === "simulator") {
      return (
        <span className="text-muted" title={streamControlNote(entry)}>
          Included with the stream
        </span>
      );
    }
    const host = entry.kind === "webrtc" ? hostOf(entry.source.url) : "";
    const value = controlValueOf(pairFor(entry.id));
    return (
      <Form.Control as="select" size="sm" aria-label={`Control for ${entry.name}`} value={value} onChange={(e) => handleControlChoice(entry, e.target.value)}>
        <option value="none">No control</option>
        {host && <option value="host">Same host as stream ({host})</option>}
        <option value="viewer" disabled>
          Switch in viewer (coming soon)
        </option>
        {CONTROL_TYPES.map((t) => {
          const list = chosenControls.filter((d) => controlTypeOf(d).key === t.key);
          return list.length ? (
            <optgroup key={t.key} label={t.label}>
              {list.map((d) => (
                <option key={d.id} value={d.id}>
                  {controlName(d)} ({d.port ? `${d.ipAddress}:${d.port}` : d.ipAddress})
                </option>
              ))}
            </optgroup>
          ) : null;
        })}
        <optgroup label="More">
          <option value="__detect" disabled>
            Find which device this is… (coming soon)
          </option>
          <option value="__choose">Choose more devices…</option>
        </optgroup>
      </Form.Control>
    );
  };


  return (
    <div className="p-2" style={{ fontSize: "0.85rem" }}>
      <section aria-labelledby="video-heading">
        <div className="devices-bar">
          <h2 id="video-heading">Video</h2>
          <span className="hint">What you watch</span>
          <span className="spacer" />
          {/* Single-window mode: turning one source on turns the others off. */}
          <Form.Check
            type="checkbox"
            id="multiple-windows"
            label="Allow multiple active"
            checked={!singleWindowMode}
            onChange={(e) => onSingleWindowModeChange?.(!e.target.checked)}
            className="mb-0 me-2"
            style={{ fontSize: "0.78rem" }}
            title="Show each active source in its own window. When off, turning one on turns the others off."
          />
          <button
            type="button"
            className="icon-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh device status"
            title="Refresh Cloud Emulator devices, status and reachability"
          >
            {refreshing ? <Spinner animation="border" size="sm" /> : <RefreshIcon />}
          </button>
          <Button size="sm" variant="primary" onClick={() => setShowVideo(true)}>
            Choose video
          </Button>
        </div>
        <div className="devices-list">
          {chosenEntries.length === 0 && (
            <div className="device-empty">Nothing chosen. Choose video to pick from your accounts and this computer.</div>
          )}
          {chosenEntries.map((entry) => {
            const pair = pairFor(entry.id);
            return (
              <div className="device-row" key={entry.id}>
                <div style={{ minWidth: 0 }}>
                  <div className="device-name" title={entry.name}>
                    <SourceIcon kind={entry.kind} />
                    {entry.name}
                  </div>
                  <div className="device-sub">{statusLine(entry)}</div>
                </div>
                <div>{controlCell(entry)}</div>
                <Form.Check
                  type="switch"
                  id={`active-${entry.id}`}
                  aria-label={`Active: ${entry.name}`}
                  checked={pair?.visible === true}
                  onChange={(e) => handleActive(entry, e.target.checked)}
                  className="mb-0"
                />
                <div className="device-actions">
                  {entry.kind !== "capture" && (
                    <button type="button" className="icon-btn" aria-label={`Rename ${entry.name}`} title="Rename" onClick={() => setRename({ kind: "stream", id: entry.id, name: entry.name, defaultName: entry.source?.deviceName || "" })}>
                      <PencilIcon />
                    </button>
                  )}
                  <button type="button" className="icon-btn danger" aria-label={`Delete ${entry.name}`} title="Delete" onClick={() => handleDeleteVideo(entry)}>
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default VideoSection;
