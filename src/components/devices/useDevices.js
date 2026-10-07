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
import { useToast } from "./ui";
import { streamDeviceId } from "../pairLabel";
import {
  applyControlSelection,
  applyVideoSelection,
  controlName,
  controlPatch,
  hostOf,
  isChosen,
  isMissingRce,
  mergeScanResults,
  removeControlDevice,
  renameControl,
  setPairFor,
  userControls,
  validateStreamUrl,
  videoEntries,
} from "./devicesModel";

const { electronAPI } = window;

// State and actions shared by the Video and Control tabs (VideoSection / ControlSection) and the
// dialogs they open (DevicesDialogs). App calls this once, so capture-device enumeration, the IPC
// listeners and the startup refresh run once, and either tab can open the other's dialog (e.g.
// a Video row's "Choose more devices…"). A video source's pair (settings.pairs) holds its Active
// flag (pair.visible) and its control link.
export default function useDevices({
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
      body: "It leaves the Video tab and its window closes. You can check it again in Choose video.",
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
      body: `It leaves the Control tab${users.length ? ` and ${users.join(", ")} will have no control` : ""}. You can check it again in Choose devices.`,
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


  return {
    // data
    pairs,
    streamingDevices,
    streamSources,
    rceAccounts,
    singleWindowMode,
    entries,
    chosenEntries,
    chosenControls,
    online,
    refreshing,
    accountOf,
    pairFor,
    entryName,
    // dialogs and messages
    showVideo,
    setShowVideo,
    showControl,
    setShowControl,
    rename,
    setRename,
    confirm,
    setConfirm,
    toast,
    toastNode,
    // video
    handleRefresh,
    handleActive,
    handleControlChoice,
    handleDeleteVideo,
    setVideoChosen,
    handleAddStream,
    handleTestSimulator,
    handleAddSimulator,
    handleRemoveStream,
    handleAddAccount,
    handleRefreshAccount,
    handleRemoveAccount,
    onSingleWindowModeChange,
    onUpdateStreamingDevices,
    // control
    handleToggleControl,
    handleSetAllControls,
    handleRemoveControl,
    handleDeleteControl,
    handleScan,
    handleRename,
  };
}
