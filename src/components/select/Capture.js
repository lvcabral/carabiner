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
import Card from "react-bootstrap/Card";
import Alert from "react-bootstrap/Alert";

const { electronAPI } = window;

const Capture = ({ value, onChange }) => {
  const [errorOccurred, setErrorOccurred] = useState(false);
  const [captureDevices, setCaptureDevices] = useState([
    { deviceId: "loading", label: "Loading..." },
  ]);

  useEffect(() => {
    electronAPI.onMessageReceived("shared-window-channel", (_, message) => {
      if (message.type === "set-capture-devices") {
        try {
          // Safely parse the JSON payload
          let devices = [];
          if (message.payload && typeof message.payload === "string") {
            devices = JSON.parse(message.payload);
          } else if (Array.isArray(message.payload)) {
            devices = message.payload;
          }

          // Validate that devices is an array and has valid structure
          if (!Array.isArray(devices)) {
            console.error("[Carabiner] Invalid devices data: not an array");
            setErrorOccurred(true);
            return;
          }

          // Filter out invalid devices and ensure required properties exist
          const validDevices = devices.filter(
            (device) => device?.deviceId && typeof device.deviceId === "string"
          );

          if (validDevices.length === 0) {
            console.warn("[Carabiner] No valid capture devices found");
            setCaptureDevices([]);
            setErrorOccurred(true);
            return;
          }

          setCaptureDevices(validDevices);

          electronAPI
            .invoke("load-settings")
            .then((settings) => {
              let selectedDeviceId = null;

              // Check if the saved device ID exists in available devices
              if (settings?.display?.deviceId) {
                const savedDeviceExists = validDevices.find(
                  (device) => device.deviceId === settings.display.deviceId
                );
                if (savedDeviceExists) {
                  selectedDeviceId = settings.display.deviceId;
                }
              }

              // If saved device doesn't exist or no saved device, use first available
              if (!selectedDeviceId && validDevices.length > 0) {
                selectedDeviceId = validDevices[0].deviceId;
                console.debug(
                  "[Carabiner] Previous capture device not found, falling back to first available device"
                );
              }

              if (selectedDeviceId) {
                onChange({ target: { value: selectedDeviceId } });
              }
            })
            .catch((error) => {
              console.error("[Carabiner] Error loading settings:", error);
              // Fallback to first device if settings can't be loaded
              if (validDevices.length > 0) {
                onChange({ target: { value: validDevices[0].deviceId } });
              }
            });
        } catch (error) {
          console.error("[Carabiner] Error parsing capture devices:", error);
          setErrorOccurred(true);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div style={{ position: "relative" }}>
      {errorOccurred ? (
        <Alert
          variant="danger"
          onClose={() => setErrorOccurred(false)}
          dismissible
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
          <Alert.Heading>An error occurred!</Alert.Heading>
          <p>
            Either you have not allowed access to your webcam or your browser does not support the{" "}
            <a
              href="https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API"
              target="_blank"
              rel="noopener noreferrer"
            >
              WebRTC API
            </a>
            .
          </p>
        </Alert>
      ) : null}

      <Card.Text as="div">
        <Form.Group controlId="formCameraSource">
          <Form.Label>Capture Device</Form.Label>
          <Form.Control as="select" value={value} onChange={onChange}>
            {captureDevices.map((device) => (
              <option key={device.deviceId} value={device.deviceId}>
                {device.label}
              </option>
            ))}
          </Form.Control>
        </Form.Group>
      </Card.Text>
    </div>
  );
};

export default Capture;
