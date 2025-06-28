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
import SelectResolution from "./select/Resolution";
import SelectFilter from "./select/Filter";
import { notifyCaptureChange } from "./GeneralSection";

const { electronAPI } = window;

function AppearanceSection() {
  const [borderWidth, setBorderWidth] = useState("0.1px");
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("#662D91");
  const [resolution, setResolution] = useState("1280|720");
  const [filter, setFilter] = useState("none");

  useEffect(() => {
    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
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
    });
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

export default AppearanceSection;