import React from "react";
import "./App.css";
import logo from "./carabiner-icon.png";

import Container from "react-bootstrap/Container";
import Tabs from "react-bootstrap/Tabs";
import Tab from "react-bootstrap/Tab";

import DisplaySection from "./components/DisplaySection";
import BorderSection from "./components/BorderSection";
import ControlSection from "./components/ControlSection";
import OverlaySection from "./components/OverlaySection";

function SettingsScreen() {
  return (
    <Tabs defaultActiveKey="display" id="settings-tabs" className="custom-tabs">
      <Tab eventKey="display" title="Display">
        <div className="tab-content-container">
          <DisplaySection />
        </div>
      </Tab>
      <Tab eventKey="border" title="Border">
        <div className="tab-content-container">
          <BorderSection />
        </div>
      </Tab>
      <Tab eventKey="control" title="Control">
        <div className="tab-content-container">
          <ControlSection />
        </div>
      </Tab>
      <Tab eventKey="overlay" title="Overlay">
        <div className="tab-content-container">
          <OverlaySection />
        </div>
      </Tab>
    </Tabs>
  );
}

function App() {
  return (
    <Container className="p-3 custom-container">
      <Container className="p-3 bg-light rounded-3">
        <h1 className="header" style={{ textAlign: "center" }}>
          <img
            src={logo}
            alt="Carabiner Logo"
            height="65px"
            width="65px"
          />
        </h1>
        <h1 className="header" style={{ textAlign: "center" }}>
          Carabiner
        </h1>
        <SettingsScreen />
      </Container>
    </Container>
  );
}

export default App;
