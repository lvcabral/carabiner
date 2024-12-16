import React from "react";
import "./App.css";
import logo from "./carabiner-icon.png";

import Container from "react-bootstrap/Container";
import Form from "react-bootstrap/Form";

import CamSection from "./components/CamSection";
import BorderSection from "./components/BorderSection";

function SettingsScreen() {
  return (
    <Form>
      <CamSection />
      <BorderSection />
    </Form>
  );
}

function App() {
  return (
    <Container className="p-3">
      <Container className="p-5 mb-4 bg-light rounded-3">
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
