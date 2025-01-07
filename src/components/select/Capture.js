import React, { useState, useEffect } from "react";
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
        setCaptureDevices(JSON.parse(message.payload));
        electronAPI.invoke("load-settings").then((settings) => {
          if (settings.display && settings.display.deviceId) {
            onChange({ target: { value: settings.display.deviceId } });
          } else if(message.payload?.length) {
            onChange({ target: { value: message.payload[0].deviceId } });
          }
        });
      }
    });
  }, []);

  return (
    <div>
      {errorOccurred ? (
        <Alert
          variant="danger"
          onClose={() => setErrorOccurred(false)}
          dismissible
        >
          <Alert.Heading>An error occurred!</Alert.Heading>
          <p>
            Either you have not allowed access to your webcam or your browser
            does not support the{" "}
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
