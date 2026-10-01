import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders the settings tabs", () => {
  render(<App />);
  expect(screen.getByRole("tab", { name: "General" })).toBeInTheDocument();
});
