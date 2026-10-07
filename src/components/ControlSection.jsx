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
import Spinner from "react-bootstrap/Spinner";
import { Dot, PencilIcon, RefreshIcon, SourceIcon, TrashIcon } from "./devices/ui";
import { CONTROL_TYPES, controlName, controlTypeOf, defaultControlName } from "./devices/devicesModel";

// Why a Cloud Emulator / Simulator source needs no separate control device.
export const streamControlNote = (entry) =>
  `Carabiner sends key presses to the ${entry.kind === "rce" ? "Cloud Emulator" : "Simulator"} over the same connection as its video, so control comes with it.`;

// The Control tab: what you send remote presses to. The chosen control devices grouped by type
// (Cloud Emulator / Simulator controls come with their video), managed through the Choose
// devices dialog. State and actions come from useDevices().
function ControlSection({ devices }) {
  const {
    pairs,
    chosenEntries,
    chosenControls,
    builtIn,
    online,
    refreshing,
    handleRefresh,
    accountOf,
    entryName,
    handleDeleteControl,
    setRename,
    setShowControl,
  } = devices;

  return (
    <div className="p-2" style={{ fontSize: "0.85rem" }}>
      <section aria-labelledby="control-heading">
        <div className="devices-bar">
          <h2 id="control-heading">Control</h2>
          <span className="hint">What you send remote presses to</span>
          <span className="spacer" />
          <button
            type="button"
            className="icon-btn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-label="Refresh device status"
            title="Check which control devices are reachable, and refresh Cloud Emulator status"
          >
            {refreshing ? <Spinner animation="border" size="sm" /> : <RefreshIcon />}
          </button>
          <Button size="sm" variant="primary" onClick={() => setShowControl(true)}>
            Choose devices
          </Button>
        </div>
        <div className="devices-list">
          {chosenControls.length === 0 && builtIn.length === 0 && (
            <div className="device-empty">No control devices chosen. Choose devices to scan your network or enter one by hand.</div>
          )}
          {CONTROL_TYPES.map((t) => {
            const list = chosenControls.filter((d) => controlTypeOf(d).key === t.key);
            // Cloud Emulator and simulator controls are Rokus too (ECP); they come with their video.
            const builtInHere = t.key === "roku" ? builtIn : [];
            if (!list.length && !builtInHere.length) return null;
            return [
              <div className="device-typehead" key={`h-${t.key}`}>
                {t.label}
              </div>,
              ...list.map((d) => {
                const users = pairs
                  .filter((p) => p.controlDeviceId === d.id && chosenEntries.some((e) => e.id === p.captureDeviceId))
                  .map((p) => entryName(p.captureDeviceId));
                const reachable = online[d.id];
                return (
                  <div className="device-row control" key={d.id}>
                    <div style={{ minWidth: 0 }}>
                      <div className="device-name" title={controlName(d)}>
                        <SourceIcon kind="device" />
                        {controlName(d)}
                      </div>
                      <div className="device-sub">
                        <Dot live={reachable === true} />
                        <span className="text">
                          {d.port ? `${d.ipAddress}:${d.port}` : d.ipAddress}
                          {reachable === false ? ", not reachable" : ""}
                        </span>
                      </div>
                    </div>
                    <span className="device-used">{users.length ? `Controls ${users.join(", ")}` : ""}</span>
                    <div className="device-actions">
                      <button type="button" className="icon-btn" aria-label={`Rename ${controlName(d)}`} title="Rename" onClick={() => setRename({ kind: "control", id: d.id, name: d.alias || "", defaultName: defaultControlName(d) || "" })}>
                        <PencilIcon />
                      </button>
                      <button type="button" className="icon-btn danger" aria-label={`Delete ${controlName(d)}`} title="Delete" onClick={() => handleDeleteControl(d)}>
                        <TrashIcon />
                      </button>
                    </div>
                  </div>
                );
              }),
              ...builtInHere.map((entry) => {
                const account = entry.kind === "rce" ? accountOf(entry.source.accountId) : null;
                return (
                  <div className="device-row control" key={`b-${entry.id}`}>
                    <div style={{ minWidth: 0 }}>
                      <div className="device-name" title={entry.name}>
                        <SourceIcon kind={entry.kind} />
                        {entry.name}
                      </div>
                      <div className="device-sub">
                        <Dot live={entry.kind === "simulator" || entry.source.status === "running"} />
                        <span className="text">{entry.kind === "rce" ? "Cloud Emulator" : "Simulator"}</span>
                        {account && <span className="acct-tag">{account.label}</span>}
                      </div>
                    </div>
                    <span className="device-used" title={`${streamControlNote(entry)} Remove it from Video to remove it here.`}>
                      Comes with its video
                    </span>
                    <span />
                  </div>
                );
              }),
            ];
          })}
        </div>
      </section>
    </div>
  );
}

export default ControlSection;
