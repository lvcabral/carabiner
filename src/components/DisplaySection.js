import React, { useEffect, useState } from "react";
import Container from "react-bootstrap/Container";
import Card from "react-bootstrap/Card";

import SelectResolution from "./select/Resolution";
import SelectCapture from "./select/Capture";
import SelectFilter from "./select/Filter";

const { electronAPI } = window;

function DisplaySection() {
  const [resolution, setResolution] = useState("480px|270px");
  const [filter, setFilter] = useState("none");

  useEffect(() => {
    // Load settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.display && settings.display.resolution) {
        setResolution(settings.display.resolution);
        notifyResolutionChange(settings.display.resolution);
      }
      if (settings.display && settings.display.filter) {
        setFilter(settings.display.filter);
        notifyFilterChange(settings.display.filter);
      }
    });
  }, []);

  const handleResolutionChange = (e) => {
    setResolution(e.target.value);
    notifyResolutionChange(e.target.value);
  };

  const handleChangeFilter = (e) => {
    setFilter(e.target.value);
    notifyFilterChange(e.target.value);
  };

  return (
    <Container className="p-3">
      <Card>
        <Card.Body>
          <SelectCapture />
          <SelectResolution
            value={resolution}
            onChange={handleResolutionChange}
          />
          <SelectFilter
            value={filter}
            onChange={handleChangeFilter}
          />
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

function notifyFilterChange(filter) {
  const style = {};
  style.filter = filter;
  style["-webkit-filter"] = `-webkit-${filter}`;
  electronAPI.sendSync("shared-window-channel", {
    type: "set-transparency",
    payload: style,
  });
}

export default DisplaySection;
