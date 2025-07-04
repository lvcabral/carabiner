/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useState, useEffect } from "react";
import { Container, Form, Row, Col, Card, Button } from "react-bootstrap";

const { electronAPI } = window;

function FilesSection() {
  const [screenshotPath, setScreenshotPath] = useState("");
  const [recordingPath, setRecordingPath] = useState("");
  const [isMacOS, setIsMacOS] = useState(false);

  useEffect(() => {
    // Detect platform
    const platform = navigator.platform || navigator.userAgent;
    setIsMacOS(platform.toLowerCase().includes("mac"));

    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.files && settings.files.screenshotPath) {
        setScreenshotPath(settings.files.screenshotPath);
      }
      if (settings.files && settings.files.recordingPath) {
        setRecordingPath(settings.files.recordingPath);
      }
    });
  }, []);

  const handleSelectScreenshotPath = async () => {
    const path = await electronAPI.invoke("select-screenshot-path");
    if (path) {
      setScreenshotPath(path);
      electronAPI.send("save-screenshot-path", path);
    }
  };

  const handleSelectRecordingPath = async () => {
    const path = await electronAPI.invoke("select-recording-path");
    if (path) {
      setRecordingPath(path);
      electronAPI.send("save-recording-path", path);
    }
  };

  const handleResetScreenshotPath = () => {
    setScreenshotPath("");
    electronAPI.send("save-screenshot-path", "");
  };

  const handleResetRecordingPath = () => {
    setRecordingPath("");
    electronAPI.send("save-recording-path", "");
  };

  // OS-specific folder names
  const defaultVideoFolder = isMacOS ? "Movies" : "Videos";

  return (
    <Container fluid className="p-2">
      <Card>
        <Card.Body>
          <h6>Default Save Locations</h6>

          {/* Screenshot Path */}
          <Form.Group controlId="formScreenshotPath" className="form-group-spacing mt-3">
            <Form.Label>Screenshot Path</Form.Label>
            <Row>
              <Col className="d-flex align-items-center flex-grow-1">
                <Form.Control
                  type="text"
                  readOnly
                  value={screenshotPath || "Default (Pictures)"}
                  placeholder="Default (Pictures)"
                />
              </Col>
              <Col xs="auto" className="d-flex align-items-center">
                <Button
                  title="Select Screenshot Path"
                  variant="primary"
                  onClick={handleSelectScreenshotPath}
                  className="me-2"
                >
                  ⋯
                </Button>
                <Button
                  title="Reset to Default"
                  variant="outline-secondary"
                  onClick={handleResetScreenshotPath}
                  disabled={!screenshotPath}
                >
                  ↺
                </Button>
              </Col>
            </Row>
            <Form.Text className="text-muted">
              If no path is set, screenshots will be saved to the Pictures folder.
            </Form.Text>
          </Form.Group>

          {/* Recording Path */}
          <Form.Group controlId="formRecordingPath" className="form-group-spacing mt-3">
            <Form.Label>Video Recording Path</Form.Label>
            <Row>
              <Col className="d-flex align-items-center flex-grow-1">
                <Form.Control
                  type="text"
                  readOnly
                  value={recordingPath || `Default (${defaultVideoFolder})`}
                  placeholder={`Default (${defaultVideoFolder})`}
                />
              </Col>
              <Col xs="auto" className="d-flex align-items-center">
                <Button
                  title="Select Recording Path"
                  variant="primary"
                  onClick={handleSelectRecordingPath}
                  className="me-2"
                >
                  ⋯
                </Button>
                <Button
                  title="Reset to Default"
                  variant="outline-secondary"
                  onClick={handleResetRecordingPath}
                  disabled={!recordingPath}
                >
                  ↺
                </Button>
              </Col>
            </Row>
            <Form.Text className="text-muted">
              If no path is set, recordings will be saved to the {defaultVideoFolder} folder.
            </Form.Text>
          </Form.Group>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default FilesSection;
