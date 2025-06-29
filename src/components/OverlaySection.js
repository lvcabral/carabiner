/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useState, useEffect } from "react";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import ListGroup from "react-bootstrap/ListGroup";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";
import Alert from "react-bootstrap/Alert";

const { electronAPI } = window;

function OverlaySection() {
  const [imagePath, setImagePath] = useState("");
  const [opacity, setOpacity] = useState("0");
  const [recentFiles, setRecentFiles] = useState([]);
  const [showAlert, setShowAlert] = useState(false);
  const [alertMessage, setAlertMessage] = useState("");
  const [selectedFileIndex, setSelectedFileIndex] = useState(-1);

  // Load recent files on component mount
  useEffect(() => {
    loadRecentFiles();
  }, []);

  const loadRecentFiles = async () => {
    try {
      const settings = await electronAPI.invoke("load-settings");
      if (settings.overlay && settings.overlay.recentFiles) {
        setRecentFiles(settings.overlay.recentFiles);
      }
      // Load current image path and opacity from settings
      if (settings.overlay && settings.overlay.imagePath) {
        setImagePath(settings.overlay.imagePath);
        // Also load the image into the overlay on startup
        const imageLoaded = await electronAPI.invoke(
          "load-image-by-path",
          settings.overlay.imagePath
        );
        if (!imageLoaded) {
          // If image failed to load, clear the path
          setImagePath("");
          electronAPI.send("save-overlay-image-path", "");
        }
      }
      if (settings.overlay && settings.overlay.opacity !== undefined) {
        setOpacity(settings.overlay.opacity.toString());
        // Also apply the opacity to the overlay on startup
        electronAPI.sendSync("shared-window-channel", {
          type: "set-overlay-opacity",
          payload: settings.overlay.opacity.toString(),
        });
      }
    } catch (error) {
      console.error("Error loading recent files:", error);
    }
  };

  const saveRecentFiles = async (files) => {
    try {
      electronAPI.send("save-overlay-recent-files", files);
      setRecentFiles(files);
    } catch (error) {
      console.error("Error saving recent files:", error);
    }
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
    // Reset selection if the selected file was removed
    if (selectedFileIndex >= newRecentFiles.length) {
      setSelectedFileIndex(-1);
    }
  };

  const showAlertMessage = (message) => {
    setAlertMessage(message);
    setShowAlert(true);
    setTimeout(() => setShowAlert(false), 3000);
  };

  const handleLoadImage = () => {
    electronAPI.loadImage().then((path) => {
      if (path) {
        setImagePath(path);
        addToRecentFiles(path);
        // Save image path to settings
        electronAPI.send("save-overlay-image-path", path);
      }
    });
  };

  const handleOpenRecentFile = async (filePath) => {
    try {
      // Check if file exists by trying to read it
      const fileExists = await electronAPI.invoke("check-file-exists", filePath);

      if (fileExists) {
        setImagePath(filePath);
        // Move file to top of recent list
        addToRecentFiles(filePath);
        // Save image path to settings
        electronAPI.send("save-overlay-image-path", filePath);
        // Load the image in the overlay using the same method as the file dialog
        const imageData = await electronAPI.invoke("load-image-by-path", filePath);
        if (imageData) {
          showAlertMessage("Image loaded successfully!");
          setSelectedFileIndex(0); // Select the moved file at top
          // Scroll to top since the file is now at index 0
          setTimeout(() => scrollToTop(), 0);
        }
      } else {
        // File doesn't exist, ask user if they want to remove it
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
      // Scroll to the selected item if it's off-screen
      setTimeout(() => scrollToSelectedItem(newIndex), 0);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      const currentIndex = selectedFileIndex < 0 ? 0 : selectedFileIndex;
      const newIndex = Math.max(currentIndex - 1, 0);
      setSelectedFileIndex(newIndex);
      // Scroll to the selected item if it's off-screen
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
      // Use scrollIntoView for more reliable scrolling behavior
      listItem.scrollIntoView({
        behavior: "smooth",
        block: "nearest", // Only scroll if the item is not fully visible
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

  const getDisplayPath = (filePath) => {
    const fileName = filePath.split(/[\\/]/).pop() || filePath;

    // If path is too long, show beginning and end with ellipsis in the middle
    if (filePath.length > 50) {
      const maxLength = 47; // Account for "..." (3 chars)
      const fileNameLength = fileName.length;
      const pathWithoutFileName = filePath.substring(0, filePath.length - fileNameLength);

      // Calculate how much space we have for the path part
      const availableForPath = maxLength - fileNameLength - 3; // 3 for "..."

      if (availableForPath > 0 && pathWithoutFileName.length > availableForPath) {
        // Show beginning of path + "..." + filename
        const pathStart = pathWithoutFileName.substring(0, availableForPath);
        return pathStart + "..." + fileName;
      } else if (availableForPath <= 0) {
        // If filename itself is too long or takes up most space, just show "..." + filename
        return "..." + fileName;
      }
    }
    return filePath;
  };

  const handleOpacityChange = (event) => {
    setOpacity(event.target.value);
    electronAPI.sendSync("shared-window-channel", {
      type: "set-overlay-opacity",
      payload: event.target.value,
    });
    // Save opacity to settings
    electronAPI.send("save-overlay-opacity", event.target.value);
  };

  const handleClearImage = () => {
    setImagePath("");
    // Save empty image path to settings
    electronAPI.send("save-overlay-image-path", "");
    // Send message to clear the overlay image
    electronAPI.sendSync("shared-window-channel", {
      type: "clear-overlay-image",
      payload: null,
    });
    showAlertMessage("Image cleared from overlay.");
  };

  return (
    <Container className="p-2">
      {showAlert && (
        <Alert variant="info" dismissible onClose={() => setShowAlert(false)}>
          {alertMessage}
        </Alert>
      )}
      <Card>
        <Card.Body>
          <Form.Group controlId="formImagePath">
            <Form.Label>Image Path</Form.Label>
            <Row className="align-items-center">
              <Col>
                <Form.Control type="text" readOnly value={imagePath} />
              </Col>
              <Col xs="auto">
                <Button
                  variant="primary"
                  onClick={handleLoadImage}
                  className="me-2"
                  title="Load Image"
                >
                  ⋯
                </Button>
                <Button
                  variant="outline-secondary"
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

      {recentFiles.length > 0 && (
        <Card className="mt-3">
          <Card.Body className="pb-2">
            <Row className="align-items-center mb-2">
              <Col>
                <Card.Title className="mb-0">Recent Images</Card.Title>
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
                // Auto-select first item if none selected
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
                    style={{ cursor: "pointer", border: "none" }}
                    onClick={() => handleFileSelect(index)}
                    title={filePath}
                    data-list-index={index}
                  >
                    <span className="text-truncate d-block">{getDisplayPath(filePath)}</span>
                  </ListGroup.Item>
                ))}
              </ListGroup>
            </div>
          </Card.Body>
        </Card>
      )}
    </Container>
  );
}

export default OverlaySection;
