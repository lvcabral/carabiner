import React from "react";
import { Container, Row, Col } from "react-bootstrap";

function AboutSection() {
  return (
    <Container className="text-center mt-4">
      <Row>
        <Col>
          <p>Version 0.1.0</p>
          <p>&copy; 2024 Marcelo Lv Cabral</p>
          <p>
            <a href="https://github.com/lvcabral/carabiner" target="_blank" rel="noopener noreferrer">
              GitHub Repository
            </a>
          </p>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <img src="images/codefest-2024.webp" alt="Codefest 2024" className="img-fluid" style={{ width: "70%", height: "auto" }} />
        </Col>
        <Col>
          <img src="images/network-streaming.png" alt="Network Streaming" className="img-fluid" style={{ width: "70%", height: "auto" }} />
        </Col>
      </Row>
    </Container>
  );
}

export default AboutSection;