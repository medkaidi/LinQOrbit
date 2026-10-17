import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PasswordField } from "@/components/ui/password-field";

describe("PasswordField", () => {
  it("starts masked and toggles visibility both ways", () => {
    render(<PasswordField label="Password" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("type", "password");

    fireEvent.click(screen.getByRole("button", { name: "Show password" }));
    expect(input).toHaveAttribute("type", "text");

    fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
    expect(input).toHaveAttribute("type", "password");
  });

  it("never submits a form from the toggle", () => {
    render(<PasswordField label="Password" />);
    expect(screen.getByRole("button", { name: "Show password" })).toHaveAttribute("type", "button");
  });

  it("forwards input props and shows the error", () => {
    render(<PasswordField label="Password" name="password" error="Too short" defaultValue="abc" />);

    const input = screen.getByLabelText("Password");
    expect(input).toHaveAttribute("name", "password");
    expect(input).toHaveValue("abc");
    expect(screen.getByText("Too short")).toBeInTheDocument();
  });
});
