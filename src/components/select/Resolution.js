import React from "react";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";

function Resolution({ value, onChange }) {
  const resolutionOptions = [
    {
      value: "1280|720",
      label: "1280 x 720 (hd)",
    },
    {
      value: "1920|1080",
      label: "1920 x 1080 (fhd)",
    },
    {
      value: "2560|1440",
      label: "2560 x 1440 (qhd)",
    },
    {
      value: "3840|2160",
      label: "3840 x 2160 (uhd)",
    },
  ];

  return (
    <Card.Text as="div">
      <Form.Group controlId="formVideoResolution">
        <Form.Label>Capture Resolution</Form.Label>
        <Form.Control as="select" value={value} onChange={onChange}>
          {resolutionOptions.map((resolution) => (
            <option key={resolution.value} value={resolution.value}>
              {resolution.label}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
    </Card.Text>
  );
}

export default Resolution;
