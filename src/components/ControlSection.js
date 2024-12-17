import React, { useState, useRef } from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";
import Form from "react-bootstrap/Form";
import Button from "react-bootstrap/Button";
import Row from "react-bootstrap/Row";
import Col from "react-bootstrap/Col";

function ControlSection() {
  const [ipAddress, setIpAddress] = useState("");
  const [deviceType, setDeviceType] = useState("ecp");
  const [deviceList, setDeviceList] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState("");
  const ipAddressRef = useRef(null);

  const handleAddDevice = () => {
    if (ipAddress && deviceType) {
      const type = deviceType === "ecp" ? "Roku" : "Fire TV / Google TV";
      const newDevice = { id: `${ipAddress}|${deviceType}`, ipAddress: ipAddress, type: type };
      setDeviceList([...deviceList, newDevice]);
      setIpAddress("");
      setSelectedDevice(newDevice.id);
      ipAddressRef.current.focus();
    }
  };

    const handleDeviceSelect = (e) => {
    setSelectedDevice(e.target.value);
  };

  const handleDeleteDevice = () => {
    setDeviceList(deviceList.filter(device => device.id !== selectedDevice));
    setSelectedDevice("");
  };

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
        <Form>
            <Form.Group controlId="formIpAddress" className="form-group-spacing">
              <Form.Label>IP Address</Form.Label>
              <Form.Control
                type="text"
                placeholder="Enter IP address"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
                ref={ipAddressRef}
              />
            </Form.Group>
            <Form.Group controlId="formDeviceType" className="form-group-spacing">
              <Form.Label>Device Type</Form.Label>
              <Row>
                <Col xs="auto" className="d-flex align-items-center">
                  <Form.Check
                    type="radio"
                    label="Roku"
                    name="deviceType"
                    value="ecp"
                    checked={deviceType === "ecp"}
                    onChange={(e) => setDeviceType(e.target.value)}
                  />
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Form.Check
                    type="radio"
                    label="Fire TV / Google TV"
                    name="deviceType"
                    value="adb"
                    checked={deviceType === "adb"}
                    onChange={(e) => setDeviceType(e.target.value)}
                  />
                </Col>
                <Col xs="auto" className="d-flex align-items-center ml-auto">
                  <Button title="Add Device" variant="primary" onClick={handleAddDevice}>
                    &#x271A;
                  </Button>
                </Col>

              </Row>
            </Form.Group>
            <Form.Group controlId="formDeviceList" className="form-group-spacing">
              <Form.Label>Device List</Form.Label>
              <Row>
                <Col className="d-flex align-items-center flex-grow-1">
                  <Form.Control as="select" value={selectedDevice} onChange={handleDeviceSelect}>
                    <option value="">Select a device</option>
                    {deviceList.map((device, index) => (
                      <option key={index} value={device.id}>
                        {device.ipAddress} - {device.type}
                      </option>
                    ))}
                  </Form.Control>
                </Col>
                <Col xs="auto" className="d-flex align-items-center">
                  <Button title="Delete Device" variant="primary" onClick={handleDeleteDevice}>
                    &#x232B;
                  </Button>
                </Col>
              </Row>
            </Form.Group>
          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default ControlSection;