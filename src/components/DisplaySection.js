/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState, useRef } from "react";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";
import SelectBorderWidth from "./select/BorderWidth";
import SelectBorderStyle from "./select/BorderStyle";
import SelectResolution, { resolutionOptions } from "./select/Resolution";
import { notifyCaptureChange } from "./GeneralSection";

const { electronAPI } = window;

// Convert resolution options to display size format, filtered by monitor size
const getDisplaySizeOptions = (maxWidth, maxHeight) => {
  return resolutionOptions
    .filter((option) => {
      const [width, height] = option.value.split("|").map(Number);
      return width <= maxWidth && height <= maxHeight;
    })
    .map((option) => {
      const [width, height] = option.value.split("|");
      return { value: `${width}x${height}`, label: option.label };
    });
};

const getPredefinedSizes = (maxWidth, maxHeight) => {
  return resolutionOptions
    .filter((option) => {
      const [width, height] = option.value.split("|").map(Number);
      return width <= maxWidth && height <= maxHeight;
    })
    .map((option) => {
      const [width, height] = option.value.split("|");
      return `${width}x${height}`;
    });
};

function DisplaySection({ pairs = [], activePairId = "", onPairsChange, streamingDevices = [] }) {
  const isMacOS = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
  const [selectedPairId, setSelectedPairId] = useState(activePairId);
  const [displaySize, setDisplaySize] = useState("custom");
  const [showKeystrokes, setShowKeystrokes] = useState(false);
  const [allowSleep, setAllowSleep] = useState(true);
  const [captureDevices, setCaptureDevices] = useState([]);
  const [mainDisplaySize, setMainDisplaySize] = useState({ width: 1920, height: 1080 });

  // Only visible windows can be edited (you can't see appearance changes on a hidden one).
  const visiblePairs = pairs.filter((p) => p.visible !== false);

  // Label for the "Editing Window" selector: capture card name + linked control (if any).
  const pairLabel = (pair) => {
    const cap = captureDevices.find((d) => d.deviceId === pair.captureDeviceId);
    const capName = cap?.label || pair.captureDeviceId || "Capture device";
    const ctl = streamingDevices.find((d) => d.id === pair.controlDeviceId);
    return ctl ? `${capName} → ${ctl.type}: ${ctl.alias || ctl.ipAddress}` : capName;
  };

  // The pair whose appearance is being edited (defaults to / follows the active window).
  const selectedPair =
    visiblePairs.find((p) => p.id === selectedPairId) ||
    visiblePairs.find((p) => p.id === activePairId) ||
    visiblePairs[0] ||
    null;
  const pairId = selectedPair?.id;
  const hasWindow = visiblePairs.length > 0;

  const borderWidth = selectedPair?.border?.width || "0.1px";
  const borderStyle = selectedPair?.border?.style || "solid";
  const borderColor = selectedPair?.border?.color || "#662D91";
  const resolution = `${selectedPair?.captureWidth || 1280}|${selectedPair?.captureHeight || 720}`;
  const transparency = selectedPair?.transparency || 0;
  const alwaysOnTop = selectedPair?.alwaysOnTop !== false;
  const audioEnabled = selectedPair?.audioEnabled === true;

  // Follow the active window when the user focuses a different Display window.
  useEffect(() => {
    if (activePairId) setSelectedPairId(activePairId);
  }, [activePairId]);

  // Load global settings + the largest monitor size once.
  useEffect(() => {
    const loadData = async () => {
      try {
        const [displayInfo, settings] = await Promise.all([
          electronAPI.invoke("get-largest-display-size"),
          electronAPI.invoke("load-settings"),
        ]);
        setMainDisplaySize(displayInfo);
        const devices = await electronAPI.invoke("get-capture-devices");
        if (Array.isArray(devices) && devices.length > 0) setCaptureDevices(devices);
        if (settings.display && settings.display.showKeystrokes !== undefined) {
          setShowKeystrokes(settings.display.showKeystrokes);
        }
        if (settings.display && settings.display.allowSleep !== undefined) {
          setAllowSleep(settings.display.allowSleep);
        }
      } catch (error) {
        console.warn("Failed to load display size or settings:", error);
      }
    };
    loadData();
  }, []);

  // Reflect the selected window's saved bounds in the Display Size dropdown.
  useEffect(() => {
    const bounds = selectedPair?.bounds;
    if (bounds && bounds.width && bounds.height) {
      const windowSize = `${bounds.width}x${bounds.height}`;
      const predefinedSizes = getPredefinedSizes(mainDisplaySize.width, mainDisplaySize.height);
      setDisplaySize(predefinedSizes.includes(windowSize) ? windowSize : "custom");
    }
  }, [selectedPair, mainDisplaySize.width, mainDisplaySize.height]);

  // A live resize of the selected window switches the dropdown to a matching preset / Custom.
  // Registered once (empty deps) and reads the latest values via refs — re-running this
  // effect would call removeListener, which is channel-wide and would also evict the
  // capture-device dropdown's listener on the same "shared-window-channel".
  const mainDisplaySizeRef = useRef(mainDisplaySize);
  const selectedPairIdRef = useRef(selectedPairId);
  useEffect(() => {
    mainDisplaySizeRef.current = mainDisplaySize;
  }, [mainDisplaySize]);
  useEffect(() => {
    selectedPairIdRef.current = selectedPairId;
  }, [selectedPairId]);

  useEffect(() => {
    const handleSharedChannel = (_, message) => {
      if (message.type === "window-resized" && message.payload?.pairId === selectedPairIdRef.current) {
        const { width, height } = message.payload;
        const windowSize = `${width}x${height}`;
        const size = mainDisplaySizeRef.current;
        const predefinedSizes = getPredefinedSizes(size.width, size.height);
        setDisplaySize(predefinedSizes.includes(windowSize) ? windowSize : "custom");
      } else if (message.type === "set-capture-devices") {
        // The General tab enumerates capture devices and broadcasts them; use the list
        // here to label the "Editing Window" selector with friendly device names.
        let devices = [];
        if (Array.isArray(message.payload)) devices = message.payload;
        else if (typeof message.payload === "string") {
          try {
            devices = JSON.parse(message.payload);
          } catch {
            devices = [];
          }
        }
        if (devices.length > 0) setCaptureDevices(devices);
      }
    };
    window.electronAPI.onMessageReceived("shared-window-channel", handleSharedChannel);
    // No cleanup: the settings tabs stay mounted, and removeListener would be
    // channel-wide (it maps to removeAllListeners), evicting other components' listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ----- helpers that mutate the selected pair -----
  const patchSelectedPair = (patch) => {
    if (!pairId) return;
    onPairsChange?.(pairs.map((p) => (p.id === pairId ? { ...p, ...patch } : p)));
  };

  const sendShared = (type, payload) => {
    electronAPI.sendSync("shared-window-channel", { type, payload, pairId });
  };

  const handleWidthChange = (event) => {
    patchSelectedPair({ border: { ...selectedPair.border, width: event.target.value } });
    sendShared("set-border-width", event.target.value);
  };

  const handleStyleChange = (event) => {
    patchSelectedPair({ border: { ...selectedPair.border, style: event.target.value } });
    sendShared("set-border-style", event.target.value);
  };

  const handleColorChange = (event) => {
    patchSelectedPair({ border: { ...selectedPair.border, color: event.target.value } });
    sendShared("set-border-color", event.target.value);
  };

  const handleAlwaysOnTopChange = (e) => {
    patchSelectedPair({ alwaysOnTop: e.target.checked });
    electronAPI.send("save-always-on-top", e.target.checked, pairId);
  };

  const handleAudioEnabledChange = (e) => {
    patchSelectedPair({ audioEnabled: e.target.checked });
    electronAPI.send("save-audio-enabled", e.target.checked, pairId);
  };

  const handleShowKeystrokesChange = (e) => {
    setShowKeystrokes(e.target.checked);
    electronAPI.sendSync("shared-window-channel", {
      type: "set-show-keystrokes",
      payload: e.target.checked,
    });
  };

  const handleAllowSleepChange = (e) => {
    setAllowSleep(e.target.checked);
    electronAPI.sendSync("shared-window-channel", {
      type: "set-allow-sleep",
      payload: e.target.checked,
    });
  };

  const handleResolutionChange = (e) => {
    const [width, height] = e.target.value.split("|").map((n) => parseInt(n, 10));
    patchSelectedPair({ captureWidth: width, captureHeight: height });
    notifyCaptureChange({
      pairId,
      deviceId: selectedPair?.captureDeviceId,
      captureWidth: width,
      captureHeight: height,
      showDisplayWindow: true,
    });
  };

  const handleTransparencyChange = (e) => {
    const transparencyValue = parseInt(e.target.value);
    patchSelectedPair({ transparency: transparencyValue });
    sendShared("set-transparency", transparencyValue);
  };

  const handleDisplaySizeChange = (e) => {
    const size = e.target.value;
    setDisplaySize(size);
    if (size !== "custom") {
      const [width, height] = size.split("x").map(Number);
      sendShared("set-display-size", { width, height });
    }
  };

  return (
    <div className="p-2" style={{ fontSize: "0.85rem" }}>
      <Card>
        <Card.Body className="p-2">
          {!hasWindow && (
            <Alert variant="secondary" className="py-2 mb-2" style={{ fontSize: "0.8rem" }}>
              No capture device is enabled. Enable one in the <strong>General</strong> tab to configure its window.
            </Alert>
          )}
          <fieldset
            disabled={!hasWindow}
            style={{ opacity: hasWindow ? 1 : 0.5, border: 0, margin: 0, padding: 0, minWidth: 0 }}
          >
            {hasWindow && (
            <Form.Group className="mb-2">
              <Form.Label>Display Window</Form.Label>
              <Form.Control
                as="select"
                size="sm"
                value={selectedPair?.id || ""}
                onChange={(e) => setSelectedPairId(e.target.value)}
              >
                {visiblePairs.map((pair) => (
                  <option key={pair.id} value={pair.id}>
                    {pairLabel(pair)}
                  </option>
                ))}
              </Form.Control>
            </Form.Group> )}
          <Row>
            <Col>
              <SelectBorderWidth size="sm" value={borderWidth} onChange={handleWidthChange} />
            </Col>
            <Col>
              <SelectBorderStyle size="sm" value={borderStyle} onChange={handleStyleChange} />
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Border Color</Form.Label>
                <Form.Control
                  type="color"
                  size="sm"
                  id="video-border-color"
                  value={borderColor}
                  onChange={handleColorChange}
                />
              </Form.Group>
            </Col>
          </Row>
          <hr className="my-2" />
          <Row>
            <Col>
              <SelectResolution size="sm" value={resolution} onChange={handleResolutionChange} />
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Display Size</Form.Label>
                <Form.Control as="select" size="sm" value={displaySize} onChange={handleDisplaySizeChange}>
                  {getDisplaySizeOptions(mainDisplaySize.width, mainDisplaySize.height).map(
                    (option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    )
                  )}
                  <option value="custom">Custom</option>
                </Form.Control>
              </Form.Group>
            </Col>
          </Row>
          <Row className="mt-1">
            <Col>
              <div className="d-flex align-items-end gap-4">
                <div style={{ flex: "0 0 48%" }}>
                  <Form.Group>
                    <Form.Label>Transparency ({transparency}%)</Form.Label>
                    <Form.Range
                      min="0"
                      max="90"
                      step="10"
                      value={transparency}
                      onChange={handleTransparencyChange}
                    />
                  </Form.Group>
                </div>
                <div>
                  <Form.Check
                    type="checkbox"
                    label="Always on Top"
                    checked={alwaysOnTop}
                    onChange={handleAlwaysOnTopChange}
                    className="text-nowrap"
                  />
                  <Form.Check
                    type="checkbox"
                    label="Enable Audio"
                    checked={audioEnabled}
                    onChange={handleAudioEnabledChange}
                    className="text-nowrap mt-2"
                  />
                  <Form.Check
                    type="checkbox"
                    label="Show Key Presses"
                    checked={showKeystrokes}
                    onChange={handleShowKeystrokesChange}
                    className="text-nowrap mt-2"
                  />
                  {isMacOS && (
                    <Form.Check
                      type="checkbox"
                      label="Allow Sleep on Screen Lock"
                      checked={allowSleep}
                      onChange={handleAllowSleepChange}
                      className="text-nowrap mt-2"
                    />
                  )}
                </div>
              </div>
            </Col>
          </Row>
          </fieldset>
        </Card.Body>
      </Card>
    </div>
  );
}

export default DisplaySection;
