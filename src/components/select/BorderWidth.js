import React from "react";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";

function BorderWidth({ value, onChange }) {
  const borderWidths = [
    {
      value: "0.1px",
      label: "None",
    },
    {
      value: "thin",
      label: "Thin",
    },
    {
      value: "medium",
      label: "Medium",
    },
    {
      value: "thick",
      label: "Thick",
    },
  ];

  return (
    <Card.Text as="div">
      <Form.Group controlId="formVideoBorderWidth">
        <Form.Label>Width</Form.Label>
        <Form.Control as="select" value={value} onChange={onChange}>
          {borderWidths.map((borderWidth) => (
            <option key={borderWidth.value} value={borderWidth.value}>
              {borderWidth.label}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
    </Card.Text>
  );
}

export default BorderWidth;
