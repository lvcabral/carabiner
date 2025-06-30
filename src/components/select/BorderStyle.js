/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";

function BorderStyle({ value, onChange }) {
  const borderStyles = [
    {
      value: "solid",
      label: "Solid",
    },
    {
      value: "dashed",
      label: "Dashed",
    },
    {
      value: "dotted",
      label: "Dotted",
    },
    {
      value: "double",
      label: "Double",
    },
    {
      value: "groove",
      label: "Groove",
    },
    {
      value: "ridge",
      label: "Ridge",
    },
    {
      value: "inset",
      label: "Inset",
    },
    {
      value: "outset",
      label: "Outset",
    },
  ];

  return (
    <Card.Text as="div">
      <Form.Group controlId="formVideoBorderStyle">
        <Form.Label>Style</Form.Label>
        <Form.Control as="select" value={value} onChange={onChange}>
          {borderStyles.map((borderStyle) => (
            <option key={borderStyle.value} value={borderStyle.value}>
              {borderStyle.label}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
    </Card.Text>
  );
}

export default BorderStyle;
