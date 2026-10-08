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
import { Dot, RefreshButton, RowActions, SourceIcon } from "./devices/ui";
import { controlAddress, controlName, controlsByType, defaultControlName } from "./devices/devicesModel";

// The Control tab: what you send remote presses to. The chosen control devices grouped by type,
// managed through the Choose devices dialog. Cloud Emulator / Simulator control is built into
// the video source, so it isn't listed here. State and actions come from useDevices().
function ControlSection({ devices }) {
  const {
    pairs,
    chosenEntries,
    chosenControls,
    online,
    refreshing,
    handleRefresh,
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
          <RefreshButton title="Check which control devices are reachable" refreshing={refreshing} onClick={handleRefresh} />
          <Button size="sm" variant="primary" onClick={() => setShowControl(true)}>
            Choose devices
          </Button>
        </div>
        <div className="devices-list">
          {chosenControls.length === 0 && (
            <div className="device-empty">No control devices chosen. Choose devices to scan your network or enter one by hand.</div>
          )}
          {controlsByType(chosenControls).map(({ type, devices }) => [
            <div className="device-typehead" key={`h-${type.key}`}>
              {type.label}
            </div>,
            ...devices.map((d) => {
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
                        {controlAddress(d)}
                        {reachable === false ? ", not reachable" : ""}
                      </span>
                    </div>
                  </div>
                  <span className="device-used">{users.length ? `Controls ${users.join(", ")}` : ""}</span>
                  <RowActions
                    name={controlName(d)}
                    onRename={() => setRename({ kind: "control", id: d.id, name: d.alias || "", defaultName: defaultControlName(d) || "" })}
                    onDelete={() => handleDeleteControl(d)}
                  />
                </div>
              );
            }),
          ])}
        </div>
      </section>
    </div>
  );
}

export default ControlSection;
