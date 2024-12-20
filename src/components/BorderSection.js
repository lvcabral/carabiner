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
import SelectBorderWidth from "./select/BorderWidth";
import SelectBorderStyle from "./select/BorderStyle";

const { electronAPI } = window;

function BorderSection() {
  const [borderWidth, setBorderWidth] = useState("0.1px");
  const [borderStyle, setBorderStyle] = useState("solid");
  const [borderColor, setBorderColor] = useState("#662D91");

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

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
          <SelectBorderWidth value={borderWidth} onChange={handleWidthChange} />
          <SelectBorderStyle value={borderStyle} onChange={handleStyleChange} />
          <Card.Text as="div">
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
          </Card.Text>
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

export default BorderSection;
