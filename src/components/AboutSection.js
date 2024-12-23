/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";

function AboutSection() {
  const [version, setVersion] = useState("");

  useEffect(() => {
    window.electronAPI.getVersion().then((version) => {
      setVersion(version);
    });
  }, []);

  const handleLinkClick = (event) => {
    event.preventDefault();
    const url = event.currentTarget.href;
    window.electronAPI.openExternal(url);
  };

  return (
    <Container className="text-center mt-4">
      <Row>
        <Col>
          <p>Version {version}</p>
          <p>&copy; 2024 Marcelo Lv Cabral</p>
          <p>
            <a
              href="https://github.com/lvcabral/carabiner"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
            >
              GitHub Repository
            </a>
          </p>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <img
            src="images/codefest-2024.webp"
            alt="Winner of Codefest 2024"
            title="Winner of Paramount Network Streaming Codefest 2024"
            className="img-fluid"
            style={{ width: "30%", height: "auto" }}
          />
        </Col>
      </Row>
    </Container>
  );
}

export default AboutSection;
