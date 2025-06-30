/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useEffect, useState } from "react";
import { Container, Row, Col } from "react-bootstrap";

function AboutSection() {
  const [version, setVersion] = useState("");
  const [copyright, setCopyright] = useState("");
  const [repository, setRepository] = useState("");

  useEffect(() => {
    window.electronAPI.getPackageInfo().then((packageInfo) => {
      setVersion(packageInfo.version);
      setCopyright(packageInfo.copyright);
      setRepository(packageInfo.repository.url);
    });
    window.electronAPI.onMessageReceived("open-about-tab", handleOpenAboutTab);

    return () => {
      window.electronAPI.removeListener("open-about-tab", handleOpenAboutTab);
    };
  }, []);

  const handleOpenAboutTab = () => {
    // Logic to switch to the About tab
    const aboutTab = document.getElementById("settings-tabs-tab-about");
    if (aboutTab) {
      aboutTab.click();
    }
  };

  const handleLinkClick = (event) => {
    event.preventDefault();
    const url = event.currentTarget.href;
    window.electronAPI.openExternal(url);
  };

  return (
    <Container className="text-center mt-2">
      <Row>
        <Col>
          <p>
            <a
              href={`${repository}/releases`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              style={{ textDecoration: "none" }}
            >
              Version {version}
            </a>
          </p>
          <p>{copyright}</p>
          <p>
            <a
              href={repository}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              style={{ textDecoration: "none" }}
            >
              GitHub Repository
            </a>
          </p>
          <p>
            <a
              href="https://paypal.me/lvcabral"
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              style={{ textDecoration: "none" }}
            >
              Enjoying the app? Buy me a Coffee ☕
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
