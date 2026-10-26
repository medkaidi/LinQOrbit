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

  it("aligns the option labels with the compact trigger", () => {
    render(<Select label="Sort by" options={options} value="female" compact />);

    fireEvent.click(screen.getByRole("combobox", { name: "Sort by" }));

    // Le menu compact garde la taille du titre (text-xs), pas celle du sélecteur standard.
    expect(screen.getByRole("option", { name: "Female" })).toHaveClass("text-xs");
    expect(screen.getByRole("option", { name: "Female" })).not.toHaveClass("text-body-md");
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

describe("Select (compact menu width)", () => {
  const long = [
    { value: "", label: "All" },
    { value: "x", label: "A very long option label that a short trigger would cut" },
  ];

  it("lets the compact menu grow with its longest option, never below the trigger", () => {
    render(<Select label="Filter" options={long} value="" compact />);

    fireEvent.click(screen.getByRole("combobox", { name: "Filter" }));

    const list = screen.getByRole("listbox");
    expect(list).toHaveClass("min-w-full", "w-max");
    expect(list).not.toHaveClass("w-full");
  });

  it("keeps the standard menu exactly as wide as its trigger", () => {
    render(<Select label="Filter" options={long} value="" />);

    fireEvent.click(screen.getByRole("combobox", { name: "Filter" }));

    const list = screen.getByRole("listbox");
    expect(list).toHaveClass("w-full");
    expect(list).not.toHaveClass("w-max");
  });

  it("opens a compact menu towards the left when the trigger is near the right edge", () => {
    const { container } = render(<Select label="Filter" options={long} value="" compact />);
    const root = container.firstElementChild as HTMLElement;
    vi.spyOn(root, "getBoundingClientRect").mockReturnValue({
      left: window.innerWidth - 100,
      top: 0,
      bottom: 36,
      right: window.innerWidth,
      width: 100,
      height: 36,
      x: window.innerWidth - 100,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("combobox", { name: "Filter" }));

    expect(screen.getByRole("listbox")).toHaveClass("right-0");
  });

  /** Place à droite du déclencheur : la fenêtre moins sa position gauche, via un rect simulé. */
  function renderWithRoomOnTheRight(room: number) {
    const { container } = render(<Select label="Filter" options={long} value="" compact />);
    const left = window.innerWidth - room;
    vi.spyOn(container.firstElementChild as HTMLElement, "getBoundingClientRect").mockReturnValue({
      left,
      top: 0,
      bottom: 36,
      right: left + 100,
      width: 100,
      height: 36,
      x: left,
      y: 0,
      toJSON: () => ({}),
    });
    fireEvent.click(screen.getByRole("combobox", { name: "Filter" }));
    return screen.getByRole("listbox");
  }

  it("opens towards the left when the room on the right is between 320 and 384 px", () => {
    // Le menu peut atteindre 24 rem (384 px) : 350 px de place ne suffisent pas, il déborderait.
    expect(renderWithRoomOnTheRight(350)).toHaveClass("right-0");
  });

  it("opens towards the left one pixel short of the widest menu", () => {
    expect(renderWithRoomOnTheRight(383)).toHaveClass("right-0");
  });

  it("opens from the left edge when the room on the right equals the widest menu", () => {
    expect(renderWithRoomOnTheRight(384)).not.toHaveClass("right-0");
  });

  it("keeps the widest menu within 24 rem and the screen, in the class the alignment relies on", () => {
    const list = renderWithRoomOnTheRight(350);

    expect(list.className).toContain("max-w-[min(24rem,calc(100vw-2rem))]");
  });

  it("does not flip a trigger to the right on a phone where the menu still fits", () => {
    const original = window.innerWidth;
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 375 });
    try {
      // Menu plafonné à 375 − 32 = 343 px ; 359 px de place suffisent.
      expect(renderWithRoomOnTheRight(359)).not.toHaveClass("right-0");
    } finally {
      Object.defineProperty(window, "innerWidth", { configurable: true, value: original });
    }
  });

  it("opens from the left edge of the trigger when there is room", () => {
    const { container } = render(<Select label="Filter" options={long} value="" compact />);
    vi.spyOn(container.firstElementChild as HTMLElement, "getBoundingClientRect").mockReturnValue({
      left: 0,
      top: 0,
      bottom: 36,
      right: 100,
      width: 100,
      height: 36,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.click(screen.getByRole("combobox", { name: "Filter" }));

    expect(screen.getByRole("listbox")).not.toHaveClass("right-0");
  });

  it("shows the full selected label as a tooltip on the trigger", () => {
    render(<Select label="Filter" options={long} value="x" compact />);

    expect(screen.getByRole("combobox", { name: "Filter" })).toHaveAttribute(
      "title",
      long[1].label,
    );
  });

  it("has no tooltip while nothing is selected", () => {
    render(<Select label="Filter" options={long} value="nope" compact />);

    expect(screen.getByRole("combobox", { name: "Filter" })).not.toHaveAttribute("title");
  });
});
