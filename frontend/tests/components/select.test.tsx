import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { Select } from "@/components/ui/select";

const options = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "other", label: "Other" },
];

function getTrigger() {
  return screen.getByRole("combobox", { name: "Sex" });
}

describe("Select", () => {
  it("shows the placeholder when there is no value", () => {
    render(<Select label="Sex" options={options} placeholder="Select one" />);

    expect(getTrigger()).toHaveTextContent("Select one");
  });

  it("opens the listbox and selects an option on click", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        label="Sex"
        options={options}
        placeholder="Select one"
        value=""
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(getTrigger());
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    expect(getTrigger()).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(screen.getByRole("option", { name: "Female" }));
    expect(onValueChange).toHaveBeenCalledWith("female");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("closes on Escape without changing the value", () => {
    const onValueChange = vi.fn();
    render(<Select label="Sex" options={options} value="" onValueChange={onValueChange} />);

    fireEvent.click(getTrigger());
    fireEvent.keyDown(getTrigger(), { key: "Escape" });

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("opens with ArrowDown and selects the highlighted option with Enter", () => {
    const onValueChange = vi.fn();
    render(<Select label="Sex" options={options} value="" onValueChange={onValueChange} />);

    fireEvent.keyDown(getTrigger(), { key: "ArrowDown" });
    expect(screen.getByRole("listbox")).toBeInTheDocument();

    fireEvent.keyDown(getTrigger(), { key: "ArrowDown" });
    fireEvent.keyDown(getTrigger(), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("female");
  });

  it("jumps to an option with typeahead", () => {
    const onValueChange = vi.fn();
    render(<Select label="Sex" options={options} value="" onValueChange={onValueChange} />);

    fireEvent.click(getTrigger());
    fireEvent.keyDown(getTrigger(), { key: "o" });
    fireEvent.keyDown(getTrigger(), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("other");
  });

  it("marks the current value as selected", () => {
    render(<Select label="Sex" options={options} value="other" placeholder="Select one" />);

    expect(getTrigger()).toHaveTextContent("Other");
    fireEvent.click(getTrigger());
    expect(screen.getByRole("option", { name: "Other" })).toHaveAttribute("aria-selected", "true");
  });

  it("renders the error state", () => {
    render(<Select label="Sex" options={options} error="Please select an option" />);

    expect(screen.getByText("Please select an option")).toBeInTheDocument();
    expect(getTrigger()).toHaveAttribute("aria-invalid", "true");
  });
});
