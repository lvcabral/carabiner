/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2025 Marcelo Lv Cabral. All Rights Reserved.
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

const { electronAPI } = window;

function App() {
  const [streamingDevices, setStreamingDevices] = useState([]);
  const onDeletedDeviceRef = useRef(null);

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
        <h1 className="header" style={{ textAlign: "center" }}>
          <img src={logo} alt="Carabiner Logo" height="65px" width="65px" />
        </h1>
        <h1 className="header" style={{ textAlign: "center" }}>
          Carabiner
        </h1>
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
