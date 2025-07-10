/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
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
      // Only include options that fit within the monitor dimensions
      return width <= maxWidth && height <= maxHeight;
    })
    .map((option) => {
      const [width, height] = option.value.split("|");
      return {
        value: `${width}x${height}`,
        label: option.label,
      };
    });
};

// Get list of predefined sizes for validation, filtered by monitor size
const getPredefinedSizes = (maxWidth, maxHeight) => {
  return resolutionOptions
    .filter((option) => {
      const [width, height] = option.value.split("|").map(Number);
      // Only include options that fit within the monitor dimensions
      return width <= maxWidth && height <= maxHeight;
    })
    .map((option) => {
      const [width, height] = option.value.split("|");
      return `${width}x${height}`;
    });
};

function DisplaySection() {
  const [borderWidth, setBorderWidth] = useState("0.1px");
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("#662D91");
  const [resolution, setResolution] = useState("1280|720");
  const [displaySize, setDisplaySize] = useState("custom"); // Default fallback
  const [transparency, setTransparency] = useState(0);
  const [alwaysOnTop, setAlwaysOnTop] = useState(true);
  const [mainDisplaySize, setMainDisplaySize] = useState({
    width: 1920,
    height: 1080,
  }); // Default fallback - largest monitor size

  // Load initial data once
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load largest display size and settings in parallel
        const [displayInfo, settings] = await Promise.all([
          electronAPI.invoke("get-largest-display-size"),
          electronAPI.invoke("load-settings"),
        ]);

        // Set largest display size
        setMainDisplaySize(displayInfo);

        // Load all settings
        if (settings.border && settings.border.width) {
          setBorderWidth(settings.border.width);
          notifyBorderChange("set-border-width", settings.border.width);
        }
        if (settings.border && settings.border.style) {
          setBorderStyle(settings.border.style);
          notifyBorderChange("set-border-style", settings.border.style);
        }
        if (settings.border && settings.border.color) {
          setBorderColor(settings.border.color);
          notifyBorderChange("set-border-color", settings.border.color);
        }
        if (settings.display && settings.display.captureWidth) {
          const captureResolution = `${settings.display.captureWidth}|${settings.display.captureHeight}`;
          setResolution(captureResolution);
        }
        if (settings.display && settings.display.transparency !== undefined) {
          setTransparency(settings.display.transparency);
          notifyTransparencyChange(settings.display.transparency);
        }
        if (settings.display && settings.display.alwaysOnTop !== undefined) {
          setAlwaysOnTop(settings.display.alwaysOnTop);
        }

        // Set display size based on current window size and filtered predefined options
        if (
          settings.displayWindow &&
          settings.displayWindow.width &&
          settings.displayWindow.height
        ) {
          const windowSize = `${settings.displayWindow.width}x${settings.displayWindow.height}`;
          const predefinedSizes = getPredefinedSizes(displayInfo.width, displayInfo.height);
          if (predefinedSizes.includes(windowSize)) {
            setDisplaySize(windowSize);
          } else {
            setDisplaySize("custom");
          }
        }
      } catch (error) {
        console.warn("Failed to load largest display size or settings:", error);
        // Keep default fallback values
      }
    };

    loadData();
  }, []); // Only run once on mount

  // Set up event listeners with current mainDisplaySize values
  useEffect(() => {
    // Listen for window resize events to automatically set to "Custom"
    const handleWindowResize = (_, message) => {
      if (message.type === "window-resized") {
        const { width, height } = message.payload;
        const windowSize = `${width}x${height}`;
        const predefinedSizes = getPredefinedSizes(mainDisplaySize.width, mainDisplaySize.height);

        if (predefinedSizes.includes(windowSize)) {
          setDisplaySize(windowSize);
        } else {
          setDisplaySize("custom");
        }
      }
    };

    const handleAlwaysOnTopUpdate = (event, value) => {
      setAlwaysOnTop(value);
    };

    window.electronAPI.onMessageReceived("shared-window-channel", handleWindowResize);
    window.electronAPI.onMessageReceived("update-always-on-top", handleAlwaysOnTopUpdate);

    return () => {
      // Cleanup listeners if needed
      try {
        window.electronAPI.removeListener("shared-window-channel");
        window.electronAPI.removeListener("update-always-on-top");
      } catch (error) {
        console.warn("Error cleaning up event listeners:", error);
      }
    };
  }, [mainDisplaySize.height, mainDisplaySize.width]); // Re-run when mainDisplaySize changes

  const handleWidthChange = (event) => {
    setBorderWidth(event.target.value);
    notifyBorderChange("set-border-width", event.target.value);
  };

  const handleStyleChange = (event) => {
    setBorderStyle(event.target.value);
    notifyBorderChange("set-border-style", event.target.value);
  };

  const handleColorChange = (event) => {
    setBorderColor(event.target.value);
    notifyBorderChange("set-border-color", event.target.value);
  };

  const handleAlwaysOnTopChange = (e) => {
    setAlwaysOnTop(e.target.checked);
    electronAPI.send("save-always-on-top", e.target.checked);
  };

  const handleResolutionChange = (e) => {
    const captureResolution = e.target.value;
    setResolution(captureResolution);
    notifyCaptureChange(null, captureResolution);
  };

  const handleTransparencyChange = (e) => {
    const transparencyValue = parseInt(e.target.value);
    setTransparency(transparencyValue);
    notifyTransparencyChange(transparencyValue);
  };

  const handleDisplaySizeChange = (e) => {
    const size = e.target.value;
    setDisplaySize(size);

    // Only apply predefined sizes, ignore "custom" selection
    if (size !== "custom") {
      const [width, height] = size.split("x").map(Number);
      notifyDisplaySizeChange(width, height);
    }
    // Note: Custom selection just shows in dropdown, no window resize happens
  };

  return (
    <div className="p-3">
      <Card>
        <Card.Body>
          <h6>Display Border</h6>
          <Row>
            <Col>
              <SelectBorderWidth value={borderWidth} onChange={handleWidthChange} />
            </Col>
            <Col>
              <SelectBorderStyle value={borderStyle} onChange={handleStyleChange} />
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Color</Form.Label>
                <Form.Control
                  type="color"
                  id="video-border-color"
                  value={borderColor}
                  defaultValue={borderColor}
                  onChange={handleColorChange}
                />
              </Form.Group>
            </Col>
          </Row>
          <hr className="mt-3" />
          <Row className="mt-2">
            <Col>
              <SelectResolution value={resolution} onChange={handleResolutionChange} />
            </Col>
            <Col>
              <Form.Group>
                <Form.Label>Display Size</Form.Label>
                <Form.Control as="select" value={displaySize} onChange={handleDisplaySizeChange}>
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
          <Row className="mt-2">
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
                </div>
              </div>
            </Col>
          </Row>
        </Card.Body>
      </Card>
    </div>
  );
}

function notifyBorderChange(type, payload) {
  electronAPI.sendSync("shared-window-channel", {
    type: type,
    payload: payload,
  });
}

function notifyTransparencyChange(transparencyValue) {
  electronAPI.sendSync("shared-window-channel", {
    type: "set-transparency",
    payload: transparencyValue,
  });
}

function notifyDisplaySizeChange(width, height) {
  electronAPI.sendSync("shared-window-channel", {
    type: "set-display-size",
    payload: { width, height },
  });
  // Note: Window dimensions are automatically saved by the existing close event handler
}

export default DisplaySection;
