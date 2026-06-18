/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import { useEffect, useState } from "react";
import { Container, Form, Row, Col, Card } from "react-bootstrap";

const { electronAPI } = window;

const DOCS_URL = "https://github.com/lvcabral/carabiner/blob/main/docs/mcp-server.md";

function MCPSection() {
  const [enabled, setEnabled] = useState(false);
  const [port, setPort] = useState(7734);
  const [token, setToken] = useState("");
  const [status, setStatus] = useState({ running: false });

  useEffect(() => {
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.mcp) {
        setEnabled(settings.mcp.enabled ?? false);
        setPort(settings.mcp.port ?? 7734);
        setToken(settings.mcp.token ?? "");
      }
    });
    electronAPI.invoke("get-mcp-status").then(setStatus);
  }, []);

  const saveConfig = (overrides = {}) => {
    const config = { enabled, port, token, ...overrides };
    electronAPI.invoke("save-mcp-config", config).then((result) => {
      if (result) {
        setStatus(result);
      }
    });
  };

  const handleEnabledChange = (e) => {
    const value = e.target.checked;
    setEnabled(value);
    saveConfig({ enabled: value });
  };

  const handleLinkClick = (event) => {
    event.preventDefault();
    electronAPI.openExternal(event.currentTarget.href);
  };

  return (
    <Container fluid className="p-2">
      <Card>
        <Card.Body>
          <Form.Group>
            <div className="d-flex justify-content-between align-items-center">
              <Form.Label className="mb-0">MCP Server</Form.Label>
              <Form.Check
                type="switch"
                id="mcp-enabled-switch"
                label="Enable"
                checked={enabled}
                onChange={handleEnabledChange}
              />
            </div>
            <Form.Text className="text-muted" style={{ fontSize: "0.8rem" }}>
              Let AI assistants control Carabiner via the Model Context Protocol (binds to localhost
              only).
            </Form.Text>
          </Form.Group>
          <Row className="mt-2">
            <Col xs={4}>
              <Form.Label>Port</Form.Label>
              <Form.Control
                type="number"
                value={port}
                disabled={enabled}
                onChange={(e) => setPort(parseInt(e.target.value, 10) || 7734)}
                onBlur={() => saveConfig()}
              />
            </Col>
            <Col xs={8}>
              <Form.Label>Auth Token (optional)</Form.Label>
              <Form.Control
                type="password"
                value={token}
                disabled={enabled}
                placeholder="Leave empty to disable authentication"
                onChange={(e) => setToken(e.target.value)}
                onBlur={() => saveConfig()}
              />
            </Col>
          </Row>
          <Form.Text className="text-muted mt-2 d-block">
            {status.running
              ? `Running — connect MCP clients to http://localhost:${status.port}/mcp`
              : "Stopped"}
          </Form.Text>
        </Card.Body>
      </Card>

      <Card className="mt-2">
        <Card.Body style={{ fontSize: "0.8rem" }}>
          <Card.Title as="h6" style={{ fontSize: "0.85rem" }}>
            Using the MCP Server
          </Card.Title>
          <p className="mb-2 text-muted">
            Enable the server above, then point an MCP client (Claude Code, Cursor, …) at it.
          </p>
          <p className="mb-1 text-muted">
            The AI agent can then select devices, send keys, take screenshots, run automation
            scripts, and validate UI state — and you can schedule recurring QA runs externally.
          </p>
          <p className="mb-0">
            <a
              href={DOCS_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={handleLinkClick}
              style={{ textDecoration: "none" }}
            > 📖 Read the full MCP Server documentation on GitHub
            </a>
          </p>
        </Card.Body>
      </Card>
    </Container>
  );
}

export default MCPSection;
