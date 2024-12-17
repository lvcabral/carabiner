import React, { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";

import SelectResolution from "./select/Resolution";
import SelectDevice from "./Display";
import Transparency from "./Transparency";

const { electronAPI } = window;

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

function DisplaySection() {
  const [resolution, setResolution] = useState("480px|270px");

  useEffect(() => {
    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.display && settings.display.resolution) {
        setResolution(settings.display.resolution);
        notifyResolutionChange(settings.display.resolution);
      }
    });
  }, []);

  useEffect(() => {
    // Save settings to main process
    const displaySettings = { resolution };
    electronAPI.send("save-display-settings", displaySettings);
  }, [resolution]);

  const handleResolutionChange = (e) => {
    setResolution(e.target.value);
    notifyResolutionChange(e.target.value);
  };

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
          <SelectDevice />
          <SelectResolution
            resolutions={resolutionOptions}
            value={resolution}
            onChange={handleResolutionChange}
          />
          <Transparency />
        </Card.Body>
      </Card>
    </Container>
  );
}

function notifyResolutionChange(size) {
  const [width, height] = size.split("|");
  electronAPI.sendSync("shared-window-channel", {
    type: "set-resolution",
    payload: { width, height },
  });
}

export default DisplaySection;
