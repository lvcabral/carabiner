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

// Export the resolution options for reuse
export const resolutionOptions = [
  {
    value: "854|480",
    label: "854 x 480 (wvga)",
  },
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

function Resolution({ value, onChange }) {
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
