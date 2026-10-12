import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { TagInput, type TagInputProps } from "@/components/ui/tag-input";

const OPTIONS: TagInputProps["options"] = [
  { value: "d1", label: "Bachelor's degree" },
  { value: "d2", label: "Master's degree" },
  { value: "d3", label: "Doctorate" },
];

function Harness({
  initial = [],
  onValueChange,
  ...rest
}: { initial?: string[] } & Partial<Omit<TagInputProps, "label" | "options" | "value">>) {
  const [value, setValue] = useState<string[]>(initial);
  return (
    <TagInput
      label="Degrees"
      options={OPTIONS}
      value={value}
      onValueChange={(next) => {
        setValue(next);
        onValueChange?.(next);
      }}
      {...rest}
    />
  );
}

function input() {
  return screen.getByRole("combobox", { name: "Degrees" });
}

describe("TagInput", () => {
  it("filters suggestions as the user types", () => {
    render(<Harness />);

    fireEvent.focus(input());
    expect(screen.getAllByRole("option")).toHaveLength(3);

    fireEvent.change(input(), { target: { value: "mast" } });

    expect(screen.getByRole("option", { name: /Master's degree/ })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Bachelor/ })).not.toBeInTheDocument();
  });

  it("adds the highlighted suggestion on Enter and clears the query", () => {
    render(<Harness />);

    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "mast" } });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(screen.getByRole("button", { name: "Remove Master's degree" })).toBeInTheDocument();
    expect(input()).toHaveValue("");
    expect(screen.getByRole("option", { name: /Doctorate/ })).toBeInTheDocument();
  });

  it("adds a suggestion on click", () => {
    render(<Harness />);

    fireEvent.focus(input());
    fireEvent.click(screen.getByRole("option", { name: /Doctorate/ }));

    expect(screen.getByRole("button", { name: "Remove Doctorate" })).toBeInTheDocument();
  });

  it("never offers an already selected value again", () => {
    render(<Harness initial={["d2"]} />);

    fireEvent.focus(input());
    fireEvent.change(input(), { target: { value: "mast" } });

    expect(screen.getByText("No match")).toBeInTheDocument();
  });

  it("removes a chip via its Remove button", () => {
    const onValueChange = vi.fn();
    render(<Harness initial={["d1", "d2"]} onValueChange={onValueChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Remove Master's degree" }));

    expect(onValueChange).toHaveBeenCalledWith(["d1"]);
    expect(screen.queryByRole("button", { name: "Remove Master's degree" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove Bachelor's degree" })).toBeInTheDocument();
  });

  it("removes the last chip on Backspace in the empty input", () => {
    const onValueChange = vi.fn();
    render(<Harness initial={["d1", "d3"]} onValueChange={onValueChange} />);

    fireEvent.keyDown(input(), { key: "Backspace" });

    expect(onValueChange).toHaveBeenCalledWith(["d1"]);
  });

  it("moves the highlight with the arrow keys and adds on Enter", () => {
    render(<Harness />);

    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "ArrowDown" });
    fireEvent.keyDown(input(), { key: "Enter" });

    expect(screen.getByRole("button", { name: "Remove Master's degree" })).toBeInTheDocument();
  });

  it("closes the list on Escape", () => {
    render(<Harness />);

    fireEvent.focus(input());
    expect(input()).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(input(), { key: "Escape" });

    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("closes the list on Tab", () => {
    render(<Harness />);

    fireEvent.focus(input());
    fireEvent.keyDown(input(), { key: "Tab" });

    expect(input()).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the error message and marks the field invalid", () => {
    render(<Harness error="Pick a degree" />);

    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Pick a degree")).toBeInTheDocument();
  });

  it("keeps chips and input inert when disabled", () => {
    render(<Harness initial={["d1"]} disabled />);

    expect(input()).toBeDisabled();
    expect(screen.getByRole("button", { name: "Remove Bachelor's degree" })).toBeDisabled();
  });
});
