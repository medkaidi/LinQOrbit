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

const skillOptions = [
  { value: "java", label: "Java" },
  { value: "javascript", label: "JavaScript" },
  { value: "python", label: "Python" },
];

function getSearchField() {
  return screen.getByRole("combobox", { name: "Skill" });
}

describe("Select (searchable)", () => {
  it("renders a text input instead of a button", () => {
    render(<Select label="Skill" options={skillOptions} placeholder="Type to search" searchable />);

    const input = getSearchField();
    expect(input.tagName).toBe("INPUT");
    expect(input).toHaveAttribute("placeholder", "Type to search");
    expect(input).toHaveAttribute("aria-autocomplete", "list");
  });

  it("filters the options as the user types, then selects one", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        label="Skill"
        options={skillOptions}
        value=""
        searchable
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(getSearchField());
    fireEvent.change(getSearchField(), { target: { value: "java" } });

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Java",
      "JavaScript",
    ]);

    fireEvent.click(screen.getByRole("option", { name: "JavaScript" }));
    expect(onValueChange).toHaveBeenCalledWith("javascript");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("shows a no-match row when nothing fits the filter", () => {
    render(<Select label="Skill" options={skillOptions} value="" searchable />);

    fireEvent.click(getSearchField());
    fireEvent.change(getSearchField(), { target: { value: "zzz" } });

    expect(screen.getByRole("option", { name: "No match" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "No match" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("keeps the selected label while the list is closed and restores it on Escape", () => {
    render(<Select label="Skill" options={skillOptions} value="python" searchable />);

    expect(getSearchField()).toHaveValue("Python");

    fireEvent.click(getSearchField());
    expect(getSearchField()).toHaveValue("");

    fireEvent.keyDown(getSearchField(), { key: "Escape" });
    expect(getSearchField()).toHaveValue("Python");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("opens filtered on the first keystroke when the field is closed", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        label="Skill"
        options={skillOptions}
        value=""
        searchable
        onValueChange={onValueChange}
      />,
    );

    fireEvent.keyDown(getSearchField(), { key: "j" });

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Java",
      "JavaScript",
    ]);

    fireEvent.keyDown(getSearchField(), { key: "ArrowDown" });
    fireEvent.keyDown(getSearchField(), { key: "Enter" });
    expect(onValueChange).toHaveBeenCalledWith("javascript");
  });

  it("selects the highlighted option with Enter", () => {
    const onValueChange = vi.fn();
    render(
      <Select
        label="Skill"
        options={skillOptions}
        value=""
        searchable
        onValueChange={onValueChange}
      />,
    );

    fireEvent.click(getSearchField());
    fireEvent.change(getSearchField(), { target: { value: "pyth" } });
    fireEvent.keyDown(getSearchField(), { key: "Enter" });

    expect(onValueChange).toHaveBeenCalledWith("python");
  });

  it("never submits a surrounding form on Enter", () => {
    const onSubmit = vi.fn((event: { preventDefault: () => void }) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <Select label="Skill" options={skillOptions} value="" searchable />
      </form>,
    );

    const input = getSearchField();
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("marks the field invalid when it carries an error", () => {
    render(<Select label="Skill" options={skillOptions} searchable error="Pick a skill" />);

    expect(getSearchField()).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Pick a skill")).toBeInTheDocument();
  });
});
