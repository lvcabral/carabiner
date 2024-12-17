import React from "react";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";

function Resolution({ value, onChange }) {
  const resolutionOptions = [
    {
      value: "480px|270px",
      label: "480 x 270",
    },
    {
      value: "640px|360px",
      label: "640 x 360",
    },
    {
      value: "800px|450px",
      label: "800 x 450",
    },
    {
      value: "1024px|576px",
      label: "1024 x 576",
    },
    {
      value: "1280px|720px",
      label: "1280 x 720",
    },
    {
      value: "1920px|1080px",
      label: "1920 x 1080",
    },
  ];

  return (
    <Card.Text as="div">
      <Form.Group controlId="formVideoResolution">
        <Form.Label>Resolution</Form.Label>
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
