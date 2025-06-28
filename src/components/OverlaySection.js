/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useState } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";

const { electronAPI } = window;

function OverlaySection() {
  const [imagePath, setImagePath] = useState("");
  const [opacity, setOpacity] = useState("0");

  const handleLoadImage = () => {
    electronAPI.loadImage().then((path) => {
      setImagePath(path);
    });
  };

  const handleOpacityChange = (event) => {
    setOpacity(event.target.value);
    electronAPI.sendSync("shared-window-channel", {
      type: "set-overlay-opacity",
      payload: event.target.value,
    });
  };

  return (
    <Container className="p-2">
      <Card>
        <Card.Body>
          <Form.Group controlId="formImagePath">
            <Form.Label>Image Path</Form.Label>
            <Form.Control type="text" readOnly value={imagePath} />
            <Button variant="primary" onClick={handleLoadImage} className="mt-2">
              Load Image
            </Button>
          </Form.Group>
          <Form.Group controlId="formOpacity" className="mt-2">
            <Form.Label>Opacity ({Math.round(opacity * 100)}%)</Form.Label>
            <Form.Range
              min="0"
              max="1"
              step="0.01"
              value={opacity}
              onChange={handleOpacityChange}
            />
          </Form.Group>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default OverlaySection;
