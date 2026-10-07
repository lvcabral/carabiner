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
import Button from "react-bootstrap/Button";
import Form from "react-bootstrap/Form";
import RenameModal from "./RenameModal";
import ChooseVideoDialog from "./devices/ChooseVideoDialog";
import ChooseControlDialog from "./devices/ChooseControlDialog";
import Spinner from "react-bootstrap/Spinner";
import { Dot, PencilIcon, RefreshIcon, SourceIcon, TrashIcon, useToast } from "./devices/ui";
import { streamDeviceId } from "./pairLabel";
import ConfirmModal from "./devices/ConfirmModal";
import {
  CONTROL_TYPES,
  applyControlSelection,
  applyVideoSelection,
  controlName,
  controlPatch,
  controlTypeOf,
  controlValueOf,
  defaultControlName,
  hostOf,
  isChosen,
  isMissingRce,
  mergeScanResults,
  rceStatusText,
  removeControlDevice,
  renameControl,
  setPairFor,
  userControls,
  validateStreamUrl,
  videoEntries,
} from "./devices/devicesModel";

const { electronAPI } = window;

const isLocalHost = (host) => ["localhost", "127.0.0.1"].includes(host);

// Why a Cloud Emulator / Simulator source needs no separate control device.
const streamControlNote = (entry) =>
  `Carabiner sends key presses to the ${entry.kind === "rce" ? "Cloud Emulator" : "Simulator"} over the same connection as its video, so control comes with it.`;

// The Devices tab: what you watch (Video) and what you send remote presses to (Control), each
// managed through one checklist dialog. A video source's pair (settings.pairs) holds its Active
// flag (pair.visible) and its control link.
function DevicesSection({
  pairs = [],
  onPairsChange,
  streamingDevices = [],
  onUpdateStreamingDevices,
  streamSources = [],
  onUpdateStreamSources,
  rceAccounts = [],
  singleWindowMode = true,
  onSingleWindowModeChange,
}) {
  const [captureDevices, setCaptureDevices] = useState([]);
  const [hiddenCaptureIds, setHiddenCaptureIds] = useState([]);
  const [online, setOnline] = useState({});
  const [showVideo, setShowVideo] = useState(false);
  const [showControl, setShowControl] = useState(false);
  const [rename, setRename] = useState(null); // { kind: "stream" | "control", id, name }
  const [confirm, setConfirm] = useState(null); // delete confirmation (see ConfirmModal)
  const [refreshing, setRefreshing] = useState(false);
  const [toast, toastNode] = useToast();

  // Long-lived callbacks (IPC listeners, async scans, a confirmation left open while a refresh
  // lands) must act on the latest lists, never on the ones captured when they were created.
  const latest = useRef({});
  latest.current = { pairs, streamingDevices, streamSources, singleWindowMode, captureDevices, hiddenCaptureIds };

  const entries = videoEntries({ captureDevices, streamSources, hiddenCaptureIds });
  const chosenEntries = entries.filter((e) => e.chosen);
  const chosenControls = userControls(streamingDevices).filter(isChosen);
  const accountOf = (id) => rceAccounts.find((a) => a.id === id);
  const pairFor = (id) => pairs.find((p) => p.captureDeviceId === id) || null;
  const entryName = (id) => entries.find((e) => e.id === id)?.name || "A source";

  const checkReachability = async (devices) => {
    if (!devices.length) return {};
    const result = await electronAPI.invoke("check-control-devices", devices);
    setOnline((o) => ({ ...o, ...result }));
    return result;
  };

  useEffect(() => {
    electronAPI.invoke("load-settings").then((settings) => {
      setHiddenCaptureIds(settings.video?.hiddenCaptureIds || []);
      checkReachability(userControls(settings.control?.deviceList || []).filter(isChosen));
    });

    // Enumerate capture devices here so the list works even when no Display window is open.
    // Labels are only exposed after a getUserMedia grant, so unlock them once if missing.
    const enumerate = async () => {
      try {
        let devices = await navigator.mediaDevices.enumerateDevices();
        let vids = devices.filter((d) => d.kind === "videoinput");
        if (vids.length > 0 && vids.some((d) => !d.label)) {
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            stream.getTracks().forEach((t) => t.stop());
            devices = await navigator.mediaDevices.enumerateDevices();
            vids = devices.filter((d) => d.kind === "videoinput");
          } catch {
            /* permission denied — fall back to unlabeled devices */
          }
        }
        const list = vids.map((d) => ({ deviceId: d.deviceId, label: d.label || "Capture Device" }));
        setCaptureDevices(list);
        // Cache in main so the tray's capture submenu stays in sync.
        electronAPI.sendSync("shared-window-channel", { type: "set-capture-devices", payload: JSON.stringify(list) });
      } catch (error) {
        console.warn("Failed to enumerate capture devices:", error);
      }
    };
    enumerate();
    navigator.mediaDevices.addEventListener("devicechange", enumerate);

    // "Settings…" in the menus opens the first tab (General).
    electronAPI.onMessageReceived("open-display-tab", () => document.getElementById("settings-tabs-tab-display")?.click());
    // Tray "capture device" submenu makes that device's window visible.
    electronAPI.onMessageReceived("update-capture-device", (event, deviceId) => {
      if (!deviceId) return;
      const { pairs: current, singleWindowMode: single } = latest.current;
      onPairsChange?.(setPairFor(current, deviceId, { visible: true }, { singleWindowMode: single }));
    });

    // Find a simulator running on this computer and refresh Cloud Emulator device status.
    electronAPI.invoke("detect-simulator");
    electronAPI.invoke("rce-refresh-accounts");

    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", enumerate);
      electronAPI.removeListener("open-display-tab");
      electronAPI.removeListener("update-capture-device");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refresh what can change behind our back: Cloud Emulator devices and their running status,
  // a simulator started on this computer, and whether control devices are reachable.
  const handleRefresh = async () => {
    setRefreshing(true);
    const [rce] = await Promise.all([
      electronAPI.invoke("rce-refresh-accounts"),
      electronAPI.invoke("detect-simulator"),
      checkReachability(chosenControls),
    ]);
    setRefreshing(false);
    const failed = Object.keys(rce?.errors || {}).map((id) => accountOf(id)?.label || "An account");
    toast(failed.length ? `Couldn't refresh ${failed.join(", ")}.` : "Up to date.");
  };

  const updatePair = (entry, patch) => {
    const opts = { singleWindowMode, autoControl: entry.source?.controlId || "" };
    onPairsChange?.(setPairFor(latest.current.pairs, entry.id, patch, opts));
  };

  // ----- video rows -----
  const handleActive = (entry, on) => {
    if (on && isMissingRce(entry.source)) {
      toast(`${entry.name} is no longer on its Cloud Emulator account, so it can't be shown. Remove it in Choose video.`);
      return;
    }
    if (on && entry.kind === "rce" && entry.source.status && entry.source.status !== "running") {
      toast(`${entry.name} is ${entry.source.status}. Start it in the Cloud Emulator portal; Carabiner connects once it's running.`);
    }
    updatePair(entry, { visible: on });
  };

  const handleControlChoice = (entry, value) => {
    if (value === "__choose") {
      setShowControl(true);
      return;
    }
    updatePair(entry, controlPatch(value, { host: entry.kind === "webrtc" ? hostOf(entry.source.url) : "" }));
  };

  const persistHidden = (ids) => {
    setHiddenCaptureIds(ids);
    electronAPI.send("set-video-selection", { hiddenCaptureIds: ids });
  };

  // Check or uncheck one video source (Choose video checkbox, or the row's delete button).
  const setVideoChosen = (id, on) => {
    const now = latest.current;
    const all = videoEntries(now);
    const chosen = new Set(all.filter((e) => e.chosen).map((e) => e.id));
    on ? chosen.add(id) : chosen.delete(id);
    const res = applyVideoSelection({ ...now, entries: all }, chosen);
    if (JSON.stringify(res.streamSources) !== JSON.stringify(now.streamSources)) onUpdateStreamSources(res.streamSources);
    if (JSON.stringify(res.hiddenCaptureIds) !== JSON.stringify(now.hiddenCaptureIds)) persistHidden(res.hiddenCaptureIds);
    if (JSON.stringify(res.pairs) !== JSON.stringify(now.pairs)) onPairsChange?.(res.pairs);
  };

  const handleDeleteVideo = (entry) =>
    setConfirm({
      title: `Remove ${entry.name}?`,
      body: "It leaves the Devices page and its window closes. You can check it again in Choose video.",
      confirmLabel: "Remove",
      onConfirm: () => {
        setVideoChosen(entry.id, false);
        toast(`Removed ${entry.name}.`);
      },
    });

  // Streams and simulators added from the Choose video dialog are saved (and checked) right away.
  const handleAddStream = ({ url, name }, setError) => {
    const problem = validateStreamUrl(url);
    if (problem) {
      setError(problem);
      return null;
    }
    const current = latest.current.streamSources;
    if (current.some((s) => s.type === "webrtc" && s.url === url)) {
      setError("That stream is already in the list.");
      return null;
    }
    const host = hostOf(url);
    const src = { id: `webrtc-${Date.now().toString(36)}`, type: "webrtc", name: name || `Stream at ${host}`, url };
    onUpdateStreamSources([...current, src]);
    // Default control: ECP to the stream's own host.
    onPairsChange?.(setPairFor(latest.current.pairs, streamDeviceId(src), controlPatch("host", { host })));
    return streamDeviceId(src);
  };

  // Returns an error message for a simulator address, or null when it is valid.
  const simulatorProblem = (host, port) => {
    const n = Number(port);
    if (!host) return "Enter the simulator's host name or IP address.";
    if (!Number.isInteger(n) || n < 1 || n > 65535) return "The port has to be 1–65535.";
    return null;
  };

  // Test button: reach the simulator's remote screen before adding it.
  const handleTestSimulator = async ({ host, port }) => {
    const problem = simulatorProblem(host, port);
    if (problem) return { ok: false, message: problem };
    const res = await electronAPI.invoke("test-stream-source", { type: "sim", host, port: Number(port) }).catch(() => null);
    if (!res?.ok) return { ok: false, message: `Failed: ${res?.message || "no response"}` };
    if (res.config?.ecpEnabled === false) return { ok: true, message: "Connected, but ECP is disabled in the simulator" };
    return { ok: true, message: "Connected" };
  };

  const handleAddSimulator = async ({ host, port, name }, setError) => {
    const problem = simulatorProblem(host, port);
    if (problem) {
      setError(problem);
      return null;
    }
    const n = Number(port);
    if (latest.current.streamSources.some((s) => s.type === "sim" && s.host === host && Number(s.port) === n)) {
      setError("That simulator is already in the list.");
      return null;
    }
    const src = { id: `sim-${Date.now().toString(36)}`, type: "sim", name: name || `Simulator at ${host}`, host, port: n };
    // The simulator's ECP port is reported by its remote screen; fall back to the default.
    const probe = await electronAPI.invoke("test-stream-source", src).catch(() => null);
    if (probe?.ok && probe.config?.ecpPort) src.ecpPort = Number(probe.config.ecpPort);
    if (!probe?.ok) toast("The simulator could not be reached; the default ECP port 8060 is assumed.");
    else if (probe.config?.ecpEnabled === false) toast("ECP is disabled in the simulator, so keys won't work until you enable it.");
    onUpdateStreamSources([...latest.current.streamSources, src]);
    setError("");
    return streamDeviceId(src);
  };

  const handleRemoveStream = (entry) => {
    onUpdateStreamSources(latest.current.streamSources.filter((s) => streamDeviceId(s) !== entry.id));
    toast(`Removed ${entry.name}.`);
  };

  const handleAddAccount = (form) => electronAPI.invoke("rce-add-account", form);
  const handleRefreshAccount = (id) => electronAPI.invoke("rce-refresh-accounts", id);
  const handleRemoveAccount = async (account) => {
    await electronAPI.invoke("rce-remove-account", account.id);
    toast(`Removed ${account.label} and its devices.`);
  };

  // ----- control rows -----
  const noControlMessage = (affected) => {
    const names = affected.map((p) => entryName(p.captureDeviceId));
    return names.length ? `${names.join(", ")} now ${names.length > 1 ? "have" : "has"} no control.` : "";
  };

  // Apply a control-catalog change ({ deviceList, pairs, affected }) and report what lost control.
  const commitControls = (res) => {
    onUpdateStreamingDevices(res.deviceList);
    if (res.affected.length) onPairsChange?.(res.pairs);
    return res.affected;
  };

  // Check or uncheck one control device. Unchecking unlinks the sources it controlled.
  const setControlChosen = (id, on) => {
    const { streamingDevices: list, pairs: current } = latest.current;
    const chosen = new Set(userControls(list).filter(isChosen).map((d) => d.id));
    on ? chosen.add(id) : chosen.delete(id);
    return commitControls(applyControlSelection(list, chosen, current));
  };

  const handleToggleControl = (id, on) => {
    const affected = setControlChosen(id, on);
    if (affected.length) toast(noControlMessage(affected));
  };

  // "Select all" in Choose control devices: one update for the whole list.
  const handleSetAllControls = (on) => {
    const { streamingDevices: list, pairs: current } = latest.current;
    const chosen = new Set(on ? userControls(list).map((d) => d.id) : []);
    const affected = commitControls(applyControlSelection(list, chosen, current));
    if (affected.length) toast(noControlMessage(affected));
  };

  // Remove from Choose control devices: gone for good (e.g. a mistyped address).
  const handleRemoveControl = (device) => {
    const { streamingDevices: list, pairs: current } = latest.current;
    const affected = commitControls(removeControlDevice(list, device.id, current));
    toast(`Removed ${controlName(device)}. ${noControlMessage(affected)}`.trim());
  };

  const handleDeleteControl = (device) => {
    const users = pairs.filter((p) => p.controlDeviceId === device.id).map((p) => entryName(p.captureDeviceId));
    setConfirm({
      title: `Remove ${controlName(device)}?`,
      body: `It leaves the Devices page${users.length ? ` and ${users.join(", ")} will have no control` : ""}. You can check it again in Choose devices.`,
      confirmLabel: "Remove",
      onConfirm: () => {
        const affected = setControlChosen(device.id, false);
        toast(`Removed ${controlName(device)}. ${noControlMessage(affected)}`.trim());
      },
    });
  };

  // Scan: Roku discovery (SSDP) plus a reachability check of every known device. Returns
  // { found, error }: the ids found or reachable (for "not found in this scan"), and why Roku
  // discovery failed, if it did.
  const handleScan = async () => {
    const res = await electronAPI.invoke("discover-roku-devices", 3000).catch((e) => ({ success: false, error: e.message }));
    const error = res?.success ? "" : res?.error || "Roku discovery failed.";
    const merged = mergeScanResults(latest.current.streamingDevices, res?.success ? res.devices : []);
    if (merged.addedCount || merged.deviceList.some((d, i) => d !== latest.current.streamingDevices[i])) {
      onUpdateStreamingDevices(merged.deviceList);
    }
    const reach = await checkReachability(userControls(merged.deviceList));
    const found = new Set(merged.foundIds);
    Object.entries(reach).forEach(([id, ok]) => ok && found.add(id));
    merged.foundIds.forEach((id) => setOnline((o) => ({ ...o, [id]: true })));
    if (merged.addedCount) toast(`Found ${merged.addedCount} new device${merged.addedCount > 1 ? "s" : ""}.`);
    return { found, error };
  };

  // ----- rename -----
  // An empty name (only allowed when there is a default) goes back to the device's own name.
  const handleRename = (newName) => {
    if (rename.kind === "stream") {
      onUpdateStreamSources(
        streamSources.map((s) => (streamDeviceId(s) === rename.id ? { ...s, name: newName || s.deviceName || s.name } : s))
      );
    } else {
      onUpdateStreamingDevices(streamingDevices.map((d) => (d.id === rename.id ? renameControl(d, newName) : d)));
    }
    setRename(null);
  };

  // ----- render -----
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

  const builtIn = chosenEntries.filter((e) => e.kind === "rce" || e.kind === "simulator");

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

      <section aria-labelledby="control-heading">
        <div className="devices-bar">
          <h2 id="control-heading">Control</h2>
          <span className="hint">What you send remote presses to</span>
          <span className="spacer" />
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

      <ChooseVideoDialog
        show={showVideo}
        entries={entries}
        accounts={rceAccounts}
        onHide={() => setShowVideo(false)}
        onToggle={setVideoChosen}
        onAddAccount={handleAddAccount}
        onRefreshAccount={handleRefreshAccount}
        onRemoveAccount={handleRemoveAccount}
        onAddStream={handleAddStream}
        onAddSimulator={handleAddSimulator}
        onTestSimulator={handleTestSimulator}
        onRemoveStream={handleRemoveStream}
        toast={toast}
      />
      <ChooseControlDialog
        show={showControl}
        deviceList={streamingDevices}
        online={online}
        onHide={() => setShowControl(false)}
        onToggle={handleToggleControl}
        onSetAll={handleSetAllControls}
        onRemove={handleRemoveControl}
        onDeviceListChange={onUpdateStreamingDevices}
        onScan={handleScan}
        toast={toast}
      />
      <RenameModal
        show={!!rename}
        title={rename?.kind === "control" ? "Rename Device" : "Rename Stream"}
        initialValue={rename?.name || ""}
        defaultName={rename?.defaultName || ""}
        onConfirm={handleRename}
        onHide={() => setRename(null)}
      />
      <ConfirmModal request={confirm} onHide={() => setConfirm(null)} />
      {toastNode}
    </div>
  );
}

export default DevicesSection;
