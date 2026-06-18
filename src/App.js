/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useState, useEffect, useRef } from "react";
import "./App.css";
import logo from "./carabiner-icon.png";

import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import GeneralSection from "./components/GeneralSection";
import DisplaySection from "./components/DisplaySection";
import ControlSection from "./components/ControlSection";
import OverlaySection from "./components/OverlaySection";
import FilesSection from "./components/FilesSection";
import AboutSection from "./components/AboutSection";
import AutomationSection from "./components/AutomationSection";
import MCPSection from "./components/MCPSection";

const { electronAPI } = window;

function App() {
  const [streamingDevices, setStreamingDevices] = useState([]);
  const onDeletedDeviceRef = useRef(null);

  useEffect(() => {
    electronAPI.onMessageReceived("update-control-device", (event, data) => {
      if (data?.deviceList) {
        setStreamingDevices(data.deviceList);
      }
    });
  }, []);

  useEffect(() => {
    // Load initial settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.control && settings.control.deviceList) {
        handleUpdateStreamingDevices(settings.control.deviceList);
      }
      // Apply initial dark mode theme
      if (settings.display && settings.display.darkMode !== undefined) {
        document.body.setAttribute("data-bs-theme", settings.display.darkMode ? "dark" : "light");
      } else {
        // First time launch - detect system color scheme preference
        const prefersDarkMode =
          window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
        // Apply the detected theme immediately
        document.body.setAttribute("data-bs-theme", prefersDarkMode ? "dark" : "light");
      }
    });
  }, []);

  const handleUpdateStreamingDevices = (devices) => {
    setStreamingDevices(devices);
    console.log("Updating streaming devices", devices.length);
    electronAPI.sendSync("shared-window-channel", {
      type: "set-control-list",
      payload: devices,
    });
  };

  const handleDeletedDevice = (deviceId) => {
    if (onDeletedDeviceRef.current) {
      onDeletedDeviceRef.current(deviceId);
    }
  };

  return (
    <div className="p-3 custom-container">
      <div className="p-3 bg-light rounded-3">
        <div className="d-flex align-items-center justify-content-center mb-2">
          <img src={logo} alt="Carabiner Logo" height="50px" width="50px" />
          <h1 className="header ms-2 mb-0">Carabiner</h1>
        </div>
        <Tabs defaultActiveKey="display" id="settings-tabs" className="custom-tabs">
          <Tab eventKey="display" title="General">
            <div className="tab-content-container">
              <GeneralSection
                streamingDevices={streamingDevices}
                onUpdateStreamingDevices={handleUpdateStreamingDevices}
                onDeletedDeviceRef={onDeletedDeviceRef}
              />
            </div>
          </Tab>
          <Tab eventKey="border" title="Display">
            <div className="tab-content-container">
              <DisplaySection />
            </div>
          </Tab>
          <Tab eventKey="control" title="Control">
            <div className="tab-content-container">
              <ControlSection
                streamingDevices={streamingDevices}
                onUpdateStreamingDevices={handleUpdateStreamingDevices}
                onDeletedDevice={handleDeletedDevice}
              />
            </div>
          </Tab>
          <Tab eventKey="automation" title="Automation">
            <div className="tab-content-container">
              <AutomationSection />
            </div>
          </Tab>
          <Tab eventKey="mcp" title="MCP">
            <div className="tab-content-container">
              <MCPSection />
            </div>
          </Tab>
          <Tab eventKey="overlay" title="Overlay">
            <div className="tab-content-container">
              <OverlaySection />
            </div>
          </Tab>
          <Tab eventKey="files" title="Files">
            <div className="tab-content-container">
              <FilesSection />
            </div>
          </Tab>
          <Tab eventKey="about" title="About">
            <div className="tab-content-container">
              <AboutSection />
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
