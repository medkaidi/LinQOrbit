import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SegmentedControl } from "@/components/ui/segmented-control";

const options = [
  { value: "a", label: "Alpha" },
  { value: "b", label: "Beta" },
];

describe("SegmentedControl", () => {
  it("reports the active option via aria-pressed inside the labelled group", () => {
    render(<SegmentedControl label="Demo" value="b" options={options} />);

    expect(screen.getByRole("group", { name: "Demo" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Alpha" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.getByRole("button", { name: "Beta" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("emits the picked value on click", () => {
    const onChange = vi.fn();
    render(<SegmentedControl label="Demo" value="a" options={options} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("b");
  });

  it("ignores clicks on a disabled option", () => {
    const onChange = vi.fn();
    render(
      <SegmentedControl
        label="Demo"
        value="a"
        options={[
          { value: "a", label: "Alpha" },
          { value: "b", label: "Beta", disabled: true },
        ]}
        onChange={onChange}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Beta" }));

    expect(screen.getByRole("button", { name: "Beta" })).toBeDisabled();
    expect(onChange).not.toHaveBeenCalled();
  });
});
