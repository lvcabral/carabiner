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
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

const { electronAPI } = window;

function OverlaySection({ pairs = [], activePairId = "", onPairsChange, streamingDevices = [] }) {
  const [recentFiles, setRecentFiles] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1);
  const [selectedPairId, setSelectedPairId] = useState(activePairId);
  const [captureDevices, setCaptureDevices] = useState([]);

  // The overlay is applied per window — only visible windows can show one.
  const visiblePairs = pairs.filter((p) => p.visible !== false);

  // The pair whose overlay is being edited (defaults to / follows the active window).
  const selectedPair =
    visiblePairs.find((p) => p.id === selectedPairId) ||
    visiblePairs.find((p) => p.id === activePairId) ||
    visiblePairs[0] ||
    null;
  const pairId = selectedPair?.id;
  const hasWindow = visiblePairs.length > 0;

  const imagePath = selectedPair?.overlayImagePath || "";
  const opacity = typeof selectedPair?.overlayOpacity === "number" ? selectedPair.overlayOpacity : 0;

  // Label for the "Display Window" selector: capture card name + linked control (if any).
  const pairLabel = (pair) => {
    const cap = captureDevices.find((d) => d.deviceId === pair.captureDeviceId);
    const capName = cap?.label || pair.captureDeviceId || "Capture device";
    const ctl = streamingDevices.find((d) => d.id === pair.controlDeviceId);
    return ctl ? `${capName} → ${ctl.type}: ${ctl.alias || ctl.ipAddress}` : capName;
  };

  // Follow the active window when the user focuses a different Display window.
  useEffect(() => {
    if (activePairId) setSelectedPairId(activePairId);
  }, [activePairId]);

  // Load the shared recent-files library + capture device labels on mount.
  useEffect(() => {
    const load = async () => {
      try {
        const settings = await electronAPI.invoke("load-settings");
        if (settings.overlay && settings.overlay.recentFiles) {
          setRecentFiles(settings.overlay.recentFiles);
        }
        const devices = await electronAPI.invoke("get-capture-devices");
        if (Array.isArray(devices) && devices.length > 0) setCaptureDevices(devices);
      } catch (error) {
        console.error("Error loading overlay data:", error);
      }
    };
    load();
  }, []);

  // The General tab enumerates capture devices and broadcasts them; use the list to label
  // the window selector. Registered once (no cleanup) — removeListener is channel-wide.
  useEffect(() => {
    const handleSharedChannel = (_, message) => {
      if (message.type === "set-capture-devices") {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const saveRecentFiles = (files) => {
    electronAPI.send("save-overlay-recent-files", files);
    setRecentFiles(files);
  };

  const addToRecentFiles = (filePath) => {
    if (!filePath) return;
    const newRecentFiles = [filePath, ...recentFiles.filter((f) => f !== filePath)].slice(0, 10); // Keep only 10 recent files
    saveRecentFiles(newRecentFiles);
    // Reset selection and scroll to top when a new file is added
    setSelectedFileIndex(-1);
    setTimeout(() => scrollToTop(), 0);
  };

  const removeFromRecentFiles = (filePath) => {
    const newRecentFiles = recentFiles.filter((f) => f !== filePath);
    saveRecentFiles(newRecentFiles);
    if (selectedFileIndex >= newRecentFiles.length) {
      setSelectedFileIndex(-1);
    }
  };

  const showAlertMessage = (message) => {
    setAlertMessage(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  // Persist a change to the selected window's overlay fields.
  const patchSelectedPair = (patch) => {
    if (!pairId) return;
    onPairsChange?.(pairs.map((p) => (p.id === pairId ? { ...p, ...patch } : p)));
  };

  const handleLoadImage = () => {
    if (!pairId) return;
    // Pass the target window so main applies the image to the right Display window.
    electronAPI.loadImage(pairId).then((path) => {
      if (path) {
        patchSelectedPair({ overlayImagePath: path });
        addToRecentFiles(path);
      }
    });
  };

  const handleOpenRecentFile = async (filePath) => {
    if (!pairId) return;
    try {
      const fileExists = await electronAPI.invoke("check-file-exists", filePath);
      if (fileExists) {
        patchSelectedPair({ overlayImagePath: filePath });
        // Move file to top of recent list
        addToRecentFiles(filePath);
        // Apply the image to the selected window.
        const imageData = await electronAPI.invoke("load-image-by-path", filePath, pairId);
        if (imageData) {
          showAlertMessage("Image loaded successfully!");
          setSelectedFileIndex(0); // Select the moved file at top
          setTimeout(() => scrollToTop(), 0);
        }
      } else {
        const shouldRemove = await electronAPI.invoke("show-message-box", {
          type: "question",
          buttons: ["Remove from list", "Keep in list"],
          defaultId: 0,
          title: "File Not Found",
          message: `The file "${filePath}" could not be found.`,
          detail: "Would you like to remove it from the recent files list?",
        });
        if (shouldRemove.response === 0) {
          removeFromRecentFiles(filePath);
          showAlertMessage("File removed from recent list.");
        }
      }
    } catch (error) {
      console.error("Error opening recent file:", error);
      showAlertMessage("Error opening file.");
    }
  };

  const handleDeleteFromRecent = (filePath) => {
    removeFromRecentFiles(filePath);
    showAlertMessage("File removed from recent list.");
  };

  const handleOpenSelected = () => {
    if (selectedFileIndex >= 0 && selectedFileIndex < recentFiles.length) {
      handleOpenRecentFile(recentFiles[selectedFileIndex]);
    }
  };

  const handleDeleteSelected = () => {
    if (selectedFileIndex >= 0 && selectedFileIndex < recentFiles.length) {
      handleDeleteFromRecent(recentFiles[selectedFileIndex]);
    }
  };

  const handleFileSelect = (index) => {
    setSelectedFileIndex(index);
  };

  const handleKeyDown = (event) => {
    if (recentFiles.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      const currentIndex = selectedFileIndex < 0 ? -1 : selectedFileIndex;
      const newIndex = Math.min(currentIndex + 1, recentFiles.length - 1);
      setSelectedFileIndex(newIndex);
      setTimeout(() => scrollToSelectedItem(newIndex), 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = selectedFileIndex < 0 ? 0 : selectedFileIndex;
      const newIndex = Math.max(currentIndex - 1, 0);
      setSelectedFileIndex(newIndex);
      setTimeout(() => scrollToSelectedItem(newIndex), 0);
    } else if (event.key === "Enter" && selectedFileIndex >= 0) {
      event.preventDefault();
      handleOpenRecentFile(recentFiles[selectedFileIndex]);
    }
  };

  const scrollToSelectedItem = (index) => {
    const listContainer = document.querySelector('[data-list-container="recent-files"]');
    const listItem = document.querySelector(`[data-list-index="${index}"]`);

    if (listContainer && listItem) {
      listItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest",
        inline: "nearest",
      });
    }
  };

  const scrollToTop = () => {
    const listContainer = document.querySelector('[data-list-container="recent-files"]');
    if (listContainer) {
      listContainer.scrollTop = 0;
    }
  };

  const handleOpacityChange = (event) => {
    const value = parseFloat(event.target.value);
    patchSelectedPair({ overlayOpacity: value });
    electronAPI.sendSync("shared-window-channel", {
      type: "set-overlay-opacity",
      payload: event.target.value,
      pairId,
    });
  };

  const handleClearImage = () => {
    patchSelectedPair({ overlayImagePath: "" });
    // Send message to clear the overlay image on the selected window.
    electronAPI.sendSync("shared-window-channel", {
      type: "clear-overlay-image",
      payload: null,
      pairId,
    });
    showAlertMessage("Image cleared from overlay.");
  };

  return (
    <Container fluid className="p-2" style={{ position: "relative", fontSize: "0.85rem" }}>
      {showAlert && (
        <Alert
          variant="info"
          dismissible
          onClose={() => setShowAlert(false)}
          style={{
            position: "absolute",
            top: "10px",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 1050,
            minWidth: "300px",
            maxWidth: "90%",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          }}
        >
          {alertMessage}
        </Alert>
      )}
      {!hasWindow && (
        <Alert variant="secondary" className="py-2 mb-2" style={{ fontSize: "0.8rem" }}>
          No capture device is enabled. Enable one in the <strong>General</strong> tab to apply an overlay to its window.
        </Alert>
      )}
      <fieldset
        disabled={!hasWindow}
        style={{ opacity: hasWindow ? 1 : 0.5, border: 0, margin: 0, padding: 0, minWidth: 0 }}
      >
        <Card>
          <Card.Body className="p-2">
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
              </Form.Group>
            )}
            <Form.Group controlId="formImagePath">
              <Form.Label>Image Path</Form.Label>
              <Row className="align-items-center">
                <Col>
                  <Form.Control type="text" size="sm" readOnly value={imagePath} />
                </Col>
                <Col xs="auto">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleLoadImage}
                    className="me-2"
                    title="Load Image"
                  >
                    ⋯
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={handleClearImage}
                    disabled={!imagePath}
                    title="Clear Image"
                  >
                    ×
                  </Button>
                </Col>
              </Row>
            </Form.Group>
            <Form.Group controlId="formOpacity" className="mt-2">
              <Form.Label>Opacity ({Math.round(opacity * 100)}%)</Form.Label>
              <Form.Range min="0" max="1" step="0.01" value={opacity} onChange={handleOpacityChange} />
            </Form.Group>
          </Card.Body>
        </Card>

        {recentFiles.length > 0 && (
          <Card className="mt-2">
            <Card.Body className="pb-2">
              <Row className="align-items-center mb-2">
                <Col>
                  <h6 className="mb-0">Recent Images</h6>
                </Col>
                <Col xs="auto">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={handleOpenSelected}
                    disabled={selectedFileIndex < 0}
                    className="me-2"
                  >
                    Open
                  </Button>
                  <Button
                    variant="outline-danger"
                    size="sm"
                    onClick={handleDeleteSelected}
                    disabled={selectedFileIndex < 0}
                  >
                    Delete
                  </Button>
                </Col>
              </Row>
              <div
                style={{
                  height: "120px",
                  overflowY: "auto",
                  border: "1px solid #dee2e6",
                  borderRadius: "0.375rem",
                }}
                tabIndex={0}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (selectedFileIndex < 0 && recentFiles.length > 0) {
                    setSelectedFileIndex(0);
                  }
                }}
                data-list-container="recent-files"
              >
                <ListGroup variant="flush">
                  {recentFiles.map((filePath, index) => (
                    <ListGroup.Item
                      key={index}
                      className={`px-2 py-1 ${selectedFileIndex === index ? "active" : ""}`}
                      style={{ cursor: "pointer", border: "none", fontSize: "0.8rem" }}
                      onClick={() => handleFileSelect(index)}
                      title={filePath}
                      data-list-index={index}
                    >
                      <span className="text-truncate d-block">{shortenPath(filePath, 53)}</span>
                    </ListGroup.Item>
                  ))}
                </ListGroup>
              </div>
            </Card.Body>
          </Card>
        )}
      </fieldset>
    </Container>
  );
}

// Function that shortens a path (based on code by https://stackoverflow.com/users/2149492/johnpan)
function shortenPath(bigPath, maxLen) {
    let path = bigPath;
    if (path.length > maxLen) {
        const splitter = bigPath.indexOf("/") > -1 ? "/" : "\\";
        const tokens = bigPath.split(splitter);
        const drive = bigPath.indexOf(":") > -1 ? tokens[0] : "";
        const fileName = tokens[tokens.length - 1];
        const len = drive.length + fileName.length;
        const remLen = maxLen - len - 3; // remove the current length and also space for ellipsis char and 2 slashes
        //remove first and last elements from the array
        tokens.splice(0, 1);
        tokens.splice(tokens.length - 1, 1);
        //recreate our path
        path = tokens.join(splitter);
        //rebuild the path from beginning and end
        const pathA = path.substring(0, Math.ceil(remLen / 2));
        const pathB = path.substring(path.length - Math.floor(remLen / 2));
        path = `${drive}${splitter}${pathA}…${pathB}${splitter}${fileName}`;
    }
    return path;
}

export default OverlaySection;
