import React from "react";
import Form from "react-bootstrap/Form";
import Card from "react-bootstrap/Card";

const { electronAPI } = window;

function Filter() {
  const filters = [
    {
      value: "none",
      label: "None",
    },
    {
      value: "opacity(75%)",
      label: "75% Opacity",
    },
    {
      value: "opacity(50%)",
      label: "50% Opacity",
    },
    {
      value: "opacity(25%)",
      label: "25% Opacity",
    },
  ];

  const handleChange = (e) => {
    let filter = e.target.value;
    const style = {};
    style.filter = filter;
    style["-webkit-filter"] = `-webkit-${filter}`;
    electronAPI.sendSync("shared-window-channel", {
      type: "set-video-filter",
      payload: style,
    });
  };

  return (
    <Card.Text as="div">
      <Form.Group controlId="formVideoFilter">
        <Form.Label>Transparency</Form.Label>
        <Form.Control as="select" onChange={handleChange}>
          {filters.map((filter) => (
            <option key={filter.value} value={filter.value}>
              {filter.label}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
    </Card.Text>
  );
}

export default Filter;
