/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import Form from "react-bootstrap/Form";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import SelectBorderWidth from "./select/BorderWidth";
import SelectBorderStyle from "./select/BorderStyle";
import SelectResolution, { resolutionOptions } from "./select/Resolution";
import SelectFilter from "./select/Filter";
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

function AppearanceSection() {
  const [borderWidth, setBorderWidth] = useState("0.1px");
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("#662D91");
  const [resolution, setResolution] = useState("1280|720");
  const [filter, setFilter] = useState("none");
  const [displaySize, setDisplaySize] = useState("custom"); // Default fallback
  const [mainDisplaySize, setMainDisplaySize] = useState({ width: 1920, height: 1080 }); // Default fallback

  useEffect(() => {
    const loadData = async () => {
      try {
        // Load main display size and settings in parallel
        const [displayInfo, settings] = await Promise.all([
          electronAPI.invoke("get-main-display-size"),
          electronAPI.invoke("load-settings"),
        ]);

        // Set main display size
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
        if (settings.display && settings.display.filter) {
          setFilter(settings.display.filter);
          notifyFilterChange(settings.display.filter);
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
        console.warn("Failed to load display size or settings:", error);
        // Keep default fallback values
      }
    };

    loadData();

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

    electronAPI.onMessageReceived("shared-window-channel", handleWindowResize);

    return () => {
      // Cleanup listener if needed
    };
  }, []);

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

  const handleResolutionChange = (e) => {
    const captureResolution = e.target.value;
    setResolution(captureResolution);
    notifyCaptureChange(null, captureResolution);
  };

  const handleFilterChange = (e) => {
    setFilter(e.target.value);
    notifyFilterChange(e.target.value);
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
    <Container className="p-2">
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
              <SelectFilter value={filter} onChange={handleFilterChange} />
            </Col>
          </Row>
          <Row className="mt-2">
            <Col md={6}>
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
        </Card.Body>
      </Card>
    </Container>
  );
}

function notifyBorderChange(type, payload) {
  electronAPI.sendSync("shared-window-channel", {
    type: type,
    payload: payload,
  });
}

function notifyFilterChange(filter) {
  const style = {};
  style.filter = filter;
  style["-webkit-filter"] = `-webkit-${filter}`;
  electronAPI.sendSync("shared-window-channel", {
    type: "set-transparency",
    payload: style,
  });
}

function notifyDisplaySizeChange(width, height) {
  electronAPI.sendSync("shared-window-channel", {
    type: "set-display-size",
    payload: { width, height },
  });
  // Note: Window dimensions are automatically saved by the existing close event handler
}

export default AppearanceSection;
