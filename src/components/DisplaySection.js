import React, { useState } from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";

import SelectResolution from "./select/Resolution";
import SelectDevice from "./Display";
import Transparency from "./Transparency";

const { electronAPI } = window;

const rectangleResolutionOptions = [
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

function DisplaySection() {
  const [resolutionOptions, setResolutionOptions] = useState(
    rectangleResolutionOptions
  );

  const handleResolutionChange = (e) => {
    const size = e.target.value;
    const [width, height] = size.split("|");
    electronAPI.sendSync("shared-window-channel", {
      type: "set-resolution",
      payload: { width, height },
    });
  };

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
          <SelectDevice />
          <SelectResolution
            resolutions={resolutionOptions}
            onChange={handleResolutionChange}
          />
          <Transparency />
        </Card.Body>
      </Card>
    </Container>
  );
}

export default DisplaySection;
