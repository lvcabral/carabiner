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

import Container from "react-bootstrap/Container";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import GeneralSection from "./components/GeneralSection";
import AppearanceSection from "./components/AppearanceSection";
import ControlSection from "./components/ControlSection";
import OverlaySection from "./components/OverlaySection";
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
    <Container className="p-3 custom-container">
      <Container className="p-3 bg-light rounded-3">
        <h1 className="header" style={{ textAlign: "center" }}>
          <img src={logo} alt="Carabiner Logo" height="65px" width="65px" />
        </h1>
        <h1 className="header" style={{ textAlign: "center" }}>
          Carabiner
        </h1>
        <Tabs
          defaultActiveKey="display"
          id="settings-tabs"
          className="custom-tabs"
        >
          <Tab eventKey="display" title="General">
            <div className="tab-content-container">
              <GeneralSection
                streamingDevices={streamingDevices}
                onUpdateStreamingDevices={handleUpdateStreamingDevices}
                onDeletedDeviceRef={onDeletedDeviceRef}
              />
            </div>
          </Tab>
          <Tab eventKey="border" title="Appearance">
            <div className="tab-content-container">
              <AppearanceSection />
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
          <Tab eventKey="about" title="About">
            <div className="tab-content-container">
              <AboutSection />
            </div>
          </Tab>
        </Tabs>
      </Container>
    </Container>
  );
}

export default App;
