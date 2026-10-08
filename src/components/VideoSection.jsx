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
import { Dot, RefreshButton, RowActions, SourceIcon } from "./devices/ui";
import { hasLockedControl } from "./pairLabel";
import {
  controlAddress,
  controlName,
  controlsByType,
  controlValueOf,
  hostOf,
  isLocalHost,
  rceStatusText,
} from "./devices/devicesModel";


// Why a Cloud Emulator / Simulator source needs no separate control device.
const streamControlNote = (entry) =>
  `Carabiner sends key presses to the ${entry.kind === "rce" ? "Cloud Emulator" : "Simulator"} over the same connection as its video, so control comes with it.`;

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
    if (entry.source && hasLockedControl(entry.source.type)) {
      return (
        <span className="text-muted" title={streamControlNote(entry)}>
          Included with the stream
        </span>
      );
    }
    const host = entry.kind === "webrtc" ? hostOf(entry.source.url) : "";
    const value = controlValueOf(pairFor(entry.id), entry.source);
    return (
      <Form.Control as="select" size="sm" aria-label={`Control for ${entry.name}`} value={value} onChange={(e) => handleControlChoice(entry, e.target.value)}>
        <option value="none">No control</option>
        {host && <option value="host">Same host as stream ({host})</option>}
        {controlsByType(chosenControls).map(({ type, devices }) => (
          <optgroup key={type.key} label={type.label}>
            {devices.map((d) => (
              <option key={d.id} value={d.id}>
                {controlName(d)} ({controlAddress(d)})
              </option>
            ))}
          </optgroup>
        ))}
        <optgroup label="More">
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
          <RefreshButton
            title="Refresh Cloud Emulator devices, status and reachability"
            refreshing={refreshing}
            onClick={handleRefresh}
          />
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
                <RowActions
                  name={entry.name}
                  onRename={
                    entry.kind !== "capture"
                      ? () => setRename({ kind: "stream", id: entry.id, name: entry.name, defaultName: entry.source?.deviceName || "" })
                      : undefined
                  }
                  onDelete={() => handleDeleteVideo(entry)}
                />
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}

export default VideoSection;
