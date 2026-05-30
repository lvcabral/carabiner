/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useState, useEffect, useRef } from "react";
import { Button, Form, Badge, Alert } from "react-bootstrap";

const { electronAPI } = window;

// Friendly names for known key codes
const KEY_LABELS = {
  // ECP (Roku) keys
  up: "Arrow Up",
  down: "Arrow Down",
  left: "Arrow Left",
  right: "Arrow Right",
  select: "Select",
  back: "Back",
  home: "Home",
  play: "Play/Pause",
  fwd: "Fast Forward",
  rev: "Rewind",
  info: "Info",
  instantreplay: "Instant Replay",
  volumemute: "Mute",
  volumeup: "Volume Up",
  volumedown: "Volume Down",
  a: "A Button",
  b: "B Button",
  backspace: "Backspace",
  // ADB (Android) keycodes
  19: "Arrow Up",
  20: "Arrow Down",
  21: "Arrow Left",
  22: "Arrow Right",
  66: "Select/Enter",
  4: "Back",
  3: "Home",
  85: "Play/Pause",
  89: "Rewind",
  90: "Fast Forward",
  1: "Info",
  67: "Backspace",
  62: "Space",
  164: "Mute",
  29: "A Button",
  54: "B Button",
};

function getKeyLabel(key) {
  if (!key) return "Unknown";
  // ECP literal character: lit_A, lit_%20, etc.
  if (key.startsWith("lit_")) {
    try {
      return `Literal: ${decodeURIComponent(key.slice(4))}`;
    } catch {
      return `Literal: ${key.slice(4)}`;
    }
  }
  return KEY_LABELS[key] || key;
}

function getModLabel(mod) {
  if (mod === 0) return "Down";
  if (mod === 100) return "Up";
  return "Press";
}

function AutomationSection() {
  const [scripts, setScripts] = useState([]);
  const [isRecording, setIsRecording] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [editingNameId, setEditingNameId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editedSteps, setEditedSteps] = useState([]);
  const [playingId, setPlayingId] = useState(null);
  const isPlaying = playingId !== null;
  const nameInputRef = useRef(null);

  useEffect(() => {
    electronAPI.invoke("get-scripts").then((data) => {
      setScripts(data || []);
    });

    const handleSharedChannel = (_, message) => {
      if (message.type === "scripts-updated") {
        setScripts(message.payload || []);
      }
    };
    electronAPI.onMessageReceived("shared-window-channel", handleSharedChannel);

    const handleRecordingState = (_, recording) => {
      setIsRecording(recording);
    };
    electronAPI.onMessageReceived("script-recording-state-changed", handleRecordingState);

    const handlePlaybackDone = (_, scriptId) => {
      setPlayingId((prev) => (prev === scriptId ? null : prev));
    };
    electronAPI.onMessageReceived("script-playback-done", handlePlaybackDone);
  }, []);

  useEffect(() => {
    if (editingNameId && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [editingNameId]);

  const handleStartRecording = () => {
    electronAPI.send("start-script-recording");
  };

  const handleStopRecording = () => {
    electronAPI.send("stop-script-recording");
  };

  const handlePlay = (script) => {
    if (isRecording || playingId) return;
    setPlayingId(script.id);
    electronAPI.send("run-script", script.id);
  };

  const handleStop = () => {
    setPlayingId(null);
    electronAPI.send("stop-script");
  };

  const handleRename = (script) => {
    setEditingNameId(script.id);
    setEditingName(script.name);
  };

  const handleSaveRename = () => {
    if (!editingName.trim()) return;
    electronAPI.send("update-script-name", { id: editingNameId, name: editingName.trim() });
    setEditingNameId(null);
    setEditingName("");
  };

  const handleCancelRename = () => {
    setEditingNameId(null);
    setEditingName("");
  };

  const handleDelete = (scriptId) => {
    if (expandedId === scriptId) setExpandedId(null);
    electronAPI.send("delete-script", scriptId);
  };

  const handleEditSteps = (script) => {
    if (expandedId === script.id) {
      setExpandedId(null);
      setEditedSteps([]);
    } else {
      setExpandedId(script.id);
      setEditedSteps(script.steps.map((s) => ({ ...s })));
    }
  };

  const handleSaveSteps = () => {
    electronAPI.send("update-script-steps", { id: expandedId, steps: editedSteps });
    setExpandedId(null);
    setEditedSteps([]);
  };

  const handleCancelSteps = () => {
    setExpandedId(null);
    setEditedSteps([]);
  };

  const handleStepDelayChange = (index, value) => {
    const updated = [...editedSteps];
    updated[index] = { ...updated[index], delay: Math.max(0, Math.min(5000, parseInt(value) || 0)) };
    setEditedSteps(updated);
  };

  const handleStepDelete = (index) => {
    setEditedSteps(editedSteps.filter((_, i) => i !== index));
  };

  const handleStepMoveUp = (index) => {
    if (index === 0) return;
    const updated = [...editedSteps];
    [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
    setEditedSteps(updated);
  };

  const handleStepMoveDown = (index) => {
    if (index === editedSteps.length - 1) return;
    const updated = [...editedSteps];
    [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
    setEditedSteps(updated);
  };

  return (
    <div className="p-2">
      {/* Recording status banner */}
      {isRecording && (
        <Alert variant="danger" className="d-flex align-items-center py-2 mb-2" style={{ fontSize: "0.8rem" }}>
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              backgroundColor: "#ff4444",
              marginRight: 8,
              animation: "pulse 1s infinite",
            }}
          />
          <strong>Recording…</strong>&nbsp;Press Cmd+Shift+Z (Mac) / Ctrl+Shift+Z (Win/Linux) to stop.
        </Alert>
      )}

      {/* Controls */}
      <div className="d-flex gap-2 mb-2">
        <Button
          size="sm"
          variant="danger"
          disabled={isRecording || isPlaying}
          onClick={handleStartRecording}
          title="Start Recording (Cmd+Shift+A on Mac / Ctrl+Shift+A on Win/Linux)"
        >
          ● Start Recording
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!isRecording}
          onClick={handleStopRecording}
          title="Stop Recording (Cmd+Shift+Z on Mac / Ctrl+Shift+Z on Win/Linux)"
        >
          ■ Stop Recording
        </Button>
      </div>

      {/* Script list */}
      {scripts.length === 0 ? (
        <p className="text-muted" style={{ fontSize: "0.85rem" }}>
          No scripts recorded yet. Press <strong>Start Recording</strong>, perform actions on your device, then press <strong>Stop Recording</strong>.
        </p>
      ) : (
        <div className="script-list-scroll" style={{ maxHeight: "calc(100vh - 230px)", overflowY: "scroll" }}>
          {scripts.map((script) => (
            <div key={script.id} className="mb-2 border rounded" style={{ overflow: "hidden" }}>
              {/* Script header row */}
              <div className="d-flex align-items-center p-2 gap-2 script-header-row">
                {/* Name or rename input */}
                {editingNameId === script.id ? (
                  <div className="d-flex align-items-center gap-1 flex-grow-1">
                    <Form.Control
                      ref={nameInputRef}
                      size="sm"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename();
                        if (e.key === "Escape") handleCancelRename();
                      }}
                      style={{ maxWidth: 200, fontSize: "0.8rem" }}
                    />
                    <Button size="sm" variant="primary" style={{ fontSize: "0.75rem", padding: "2px 6px" }} onClick={handleSaveRename}>
                      Save
                    </Button>
                    <Button size="sm" variant="outline-secondary" style={{ fontSize: "0.75rem", padding: "2px 6px" }} onClick={handleCancelRename}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <span className="flex-grow-1 fw-semibold" style={{ fontSize: "0.85rem" }}>
                    {script.name}
                  </span>
                )}

                {/* Badges */}
                <Badge bg="secondary" style={{ fontSize: "0.7rem" }}>
                  {script.steps?.length ?? 0} steps
                </Badge>
                <Badge
                  bg=""
                  style={{
                    fontSize: "0.7rem",
                    backgroundColor:
                      script.controlType === "ecp" ? "#662D91" :
                      script.controlType === "adb" ? "#3DDC84" :
                      script.controlType === "atv" ? "#1c1c1e" : "#6c757d",
                    color: script.controlType === "adb" ? "#000" : "#fff",
                  }}
                >
                  {script.controlType?.toUpperCase() || "?"}
                </Badge>

                {/* Action buttons */}
                <div className="d-flex gap-1">
                  {playingId === script.id ? (
                    <Button
                      size="sm"
                      variant="warning"
                      onClick={handleStop}
                      title="Stop script"
                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                    >
                      ■
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline-primary"
                      disabled={isRecording || isPlaying}
                      onClick={() => handlePlay(script)}
                      title="Play script"
                      style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                    >
                      ▶
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline-primary"
                    onClick={() => handleRename(script)}
                    title="Rename script"
                    style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                  >
                    ✎
                  </Button>
                  <Button
                    size="sm"
                    variant={expandedId === script.id ? "primary" : "outline-primary"}
                    onClick={() => handleEditSteps(script)}
                    title="Edit steps"
                    style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                  >
                    ≡
                  </Button>
                  <Button
                    size="sm"
                    variant="outline-danger"
                    onClick={() => handleDelete(script.id)}
                    title="Delete script"
                    style={{ fontSize: "0.75rem", padding: "2px 6px" }}
                  >
                    🗑
                  </Button>
                </div>
              </div>

              {/* Step editor (expanded) */}
              {expandedId === script.id && (
                <div className="p-2" style={{ borderTop: "1px solid #dee2e6" }}>
                  {editedSteps.length === 0 ? (
                    <p className="text-muted mb-2" style={{ fontSize: "0.8rem" }}>No steps.</p>
                  ) : (
                    <table style={{ width: "100%", fontSize: "0.78rem", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #dee2e6" }}>
                          <th style={{ padding: "3px 4px", width: 28 }}>#</th>
                          <th style={{ padding: "3px 4px" }}>Key</th>
                          <th style={{ padding: "3px 4px", width: 55 }}>Type</th>
                          <th style={{ padding: "3px 4px", width: 90 }}>Delay (ms)</th>
                          <th style={{ padding: "3px 4px", width: 80 }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {editedSteps.map((step, idx) => (
                          <tr key={idx} style={{ borderBottom: "1px solid #f0f0f0" }}>
                            <td style={{ padding: "3px 4px", color: "#6c757d" }}>{idx + 1}</td>
                            <td style={{ padding: "3px 4px" }}>{getKeyLabel(step.key)}</td>
                            <td style={{ padding: "3px 4px" }}>
                              <Badge bg="light" text="dark" style={{ fontSize: "0.7rem" }}>
                                {getModLabel(step.mod)}
                              </Badge>
                            </td>
                            <td style={{ padding: "3px 4px" }}>
                              <Form.Control
                                type="number"
                                size="sm"
                                min={0}
                                max={5000}
                                value={step.delay}
                                onChange={(e) => handleStepDelayChange(idx, e.target.value)}
                                style={{ fontSize: "0.75rem", padding: "1px 4px", height: "auto" }}
                              />
                            </td>
                            <td style={{ padding: "3px 4px" }}>
                              <div className="d-flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  disabled={idx === 0}
                                  onClick={() => handleStepMoveUp(idx)}
                                  style={{ fontSize: "0.65rem", padding: "1px 4px" }}
                                  title="Move up"
                                >
                                  ↑
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-secondary"
                                  disabled={idx === editedSteps.length - 1}
                                  onClick={() => handleStepMoveDown(idx)}
                                  style={{ fontSize: "0.65rem", padding: "1px 4px" }}
                                  title="Move down"
                                >
                                  ↓
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline-danger"
                                  onClick={() => handleStepDelete(idx)}
                                  style={{ fontSize: "0.65rem", padding: "1px 4px" }}
                                  title="Remove step"
                                >
                                  ✕
                                </Button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  <div className="d-flex gap-2 mt-2">
                    <Button size="sm" variant="primary" style={{ fontSize: "0.75rem" }} onClick={handleSaveSteps}>
                      Save Changes
                    </Button>
                    <Button size="sm" variant="outline-secondary" style={{ fontSize: "0.75rem" }} onClick={handleCancelSteps}>
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.3; }
        }
      `}</style>
    </div>
  );
}

export default AutomationSection;
