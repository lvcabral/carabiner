/*---------------------------------------------------------------------------------------------
 *  Carabiner - Simple Screen Capture and Remote Control App for Streaming Devices
 *
 *  Repository: https://github.com/lvcabral/carabiner
 *
 *  Copyright (c) 2024-2026 Marcelo Lv Cabral. All Rights Reserved.
 *
 *  Licensed under the MIT License. See LICENSE in the repository root for license information.
 *--------------------------------------------------------------------------------------------*/
import React, { useState, useEffect } from "react";
import "./App.css";
import logo from "./carabiner-icon.png";

import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import VideoSection from "./components/VideoSection";
import ControlSection from "./components/ControlSection";
import DevicesDialogs from "./components/devices/DevicesDialogs";
import useDevices from "./components/devices/useDevices";
import GeneralSection from "./components/GeneralSection";
import DisplaySection from "./components/DisplaySection";
import OverlaySection from "./components/OverlaySection";
import FilesSection from "./components/FilesSection";
import AboutSection from "./components/AboutSection";
import AutomationSection from "./components/AutomationSection";
import MCPSection from "./components/MCPSection";

const { electronAPI } = window;

function App() {
  const [streamingDevices, setStreamingDevices] = useState([]);
  const [streamSources, setStreamSources] = useState([]);
  const [rceAccounts, setRceAccounts] = useState([]);
  const [pairs, setPairs] = useState([]);
  const [activePairId, setActivePairId] = useState("");
  const [singleWindowMode, setSingleWindowMode] = useState(true);

  useEffect(() => {
    electronAPI.onMessageReceived("rce-accounts-updated", (event, accounts) => {
      if (Array.isArray(accounts)) setRceAccounts(accounts);
    });
    electronAPI.onMessageReceived("single-window-mode-changed", (event, single) => {
      setSingleWindowMode(!!single);
    });
    electronAPI.onMessageReceived("update-control-device", (event, data) => {
      if (data?.deviceList) {
        setStreamingDevices(data.deviceList);
      }
    });
    electronAPI.onMessageReceived("stream-sources-updated", (event, sources) => {
      if (Array.isArray(sources)) {
        setStreamSources(sources);
      }
    });
    electronAPI.onMessageReceived("pairs-updated", (event, updated) => {
      if (Array.isArray(updated)) {
        setPairs(updated);
      }
    });
    electronAPI.onMessageReceived("active-pair-changed", (event, id) => {
      if (id) {
        setActivePairId(id);
      }
    });
  }, []);

  useEffect(() => {
    // Load initial settings from main process
    electronAPI.invoke("load-settings").then((settings) => {
      if (settings.control && settings.control.deviceList) {
        handleUpdateStreamingDevices(settings.control.deviceList);
      }
      if (Array.isArray(settings.streams?.sources)) {
        setStreamSources(settings.streams.sources);
      }
      if (Array.isArray(settings.rce?.accounts)) {
        setRceAccounts(settings.rce.accounts);
      }
      if (settings.display?.singleWindowMode !== undefined) {
        setSingleWindowMode(settings.display.singleWindowMode);
      }
      if (Array.isArray(settings.pairs)) {
        setPairs(settings.pairs);
      }
      if (settings.activePairId) {
        setActivePairId(settings.activePairId);
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

  // Persist the WebRTC stream-source catalog. Main drops pairs bound to removed sources and
  // echoes pairs-updated.
  const handleUpdateStreamSources = (sources) => {
    setStreamSources(sources);
    electronAPI.sendSync("shared-window-channel", {
      type: "set-stream-sources",
      payload: sources,
    });
  };

  // Main collapses to the active window and rebuilds menus, then echoes pairs-updated.
  const handleSingleWindowModeChange = (single) => {
    setSingleWindowMode(single);
    electronAPI.send("set-single-window-mode", single);
  };

  // Persist the full pairs array to the main process, which reconciles the live
  // Display windows (open/close/connect) and echoes back a normalized list.
  const handlePairsChange = (newPairs) => {
    setPairs(newPairs);
    electronAPI.send("set-pairs", newPairs);
  };

  // Shared by the Video and Control tabs and their dialogs (one instance, see useDevices).
  const devices = useDevices({
    pairs,
    onPairsChange: handlePairsChange,
    streamingDevices,
    onUpdateStreamingDevices: handleUpdateStreamingDevices,
    streamSources,
    onUpdateStreamSources: handleUpdateStreamSources,
    rceAccounts,
    singleWindowMode,
    onSingleWindowModeChange: handleSingleWindowModeChange,
  });

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
              <GeneralSection />
            </div>
          </Tab>
          <Tab eventKey="video" title="Video">
            <div className="tab-content-container">
              <VideoSection devices={devices} />
            </div>
          </Tab>
          <Tab eventKey="control" title="Control">
            <div className="tab-content-container">
              <ControlSection devices={devices} />
            </div>
          </Tab>
          <Tab eventKey="border" title="Display">
            <div className="tab-content-container">
              <DisplaySection
                pairs={pairs}
                activePairId={activePairId}
                onPairsChange={handlePairsChange}
                streamingDevices={streamingDevices}
                streamSources={streamSources}
              />
            </div>
          </Tab>
          <Tab eventKey="automation" title="Automation">
            <div className="tab-content-container">
              <AutomationSection
                pairs={pairs}
                activePairId={activePairId}
                streamingDevices={streamingDevices}
                streamSources={streamSources}
              />
            </div>
          </Tab>
          <Tab eventKey="mcp" title="MCP">
            <div className="tab-content-container">
              <MCPSection />
            </div>
          </Tab>
          <Tab eventKey="overlay" title="Overlay">
            <div className="tab-content-container">
              <OverlaySection
                pairs={pairs}
                activePairId={activePairId}
                onPairsChange={handlePairsChange}
                streamingDevices={streamingDevices}
                streamSources={streamSources}
              />
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
        <DevicesDialogs devices={devices} />
      </div>
    </div>
  );
}

export default App;
