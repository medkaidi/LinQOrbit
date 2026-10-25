import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { NextStepsCard, type NextStep } from "@/components/ui/next-steps-card";

const steps: NextStep[] = [
  { id: "a", icon: "mail", title: "Answer 2 invitations", detail: "Recruiters invited you.", href: "/applications" },
  { id: "b", icon: "edit_note", title: "Finish 1 draft", detail: "Submit before it closes.", href: "/applications" },
  { id: "c", icon: "work", title: "Browse open offers", detail: "37 offers open.", href: "/jobs" },
];

function region() {
  return screen.getByRole("region", { name: "Next steps" });
}

describe("NextStepsCard", () => {
  it("renders each step as a link to its destination, with title and detail", () => {
    render(<NextStepsCard steps={steps} state="ready" />);

    const link = within(region()).getByRole("link", { name: /Browse open offers/ });
    expect(link).toHaveAttribute("href", "/jobs");
    expect(within(link).getByText("37 offers open.")).toBeInTheDocument();
    expect(within(region()).getAllByRole("link")).toHaveLength(3);
  });

  it("carries the vertical spacing on each row, so the separator never touches the text", () => {
    render(<NextStepsCard steps={steps} state="ready" />);

    const rows = within(region()).getAllByRole("listitem");
    expect(rows).toHaveLength(3);
    for (const row of rows) {
      expect(row).toHaveClass("py-4", "first:pt-0", "last:pb-0");
    }
  });

  it("never lets the link cancel the row spacing (first:/last: on an only child hits every row)", () => {
    render(<NextStepsCard steps={steps} state="ready" />);

    for (const link of within(region()).getAllByRole("link")) {
      expect(link.className).not.toMatch(/(^|\s)(first|last|only):/);
      expect(link.className).not.toMatch(/(^|\s)p[ty]-/);
    }
  });

  it("separates the rows with a divider drawn by the list", () => {
    render(<NextStepsCard steps={steps} state="ready" />);

    expect(within(region()).getByRole("list")).toHaveClass("divide-y", "divide-slate-border");
  });

  it("is titled \"Next steps\" by default, or by the title given", () => {
    const { rerender } = render(<NextStepsCard steps={steps} state="ready" />);
    expect(within(region()).getByRole("heading", { name: "Next steps" })).toBeInTheDocument();

    rerender(<NextStepsCard steps={steps} state="ready" title="Needs your attention" />);
    const titled = screen.getByRole("region", { name: "Needs your attention" });
    expect(within(titled).getByRole("heading", { name: "Needs your attention" })).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: "Next steps" })).not.toBeInTheDocument();
  });

  it("shows the default all-set message when ready without any step", () => {
    render(<NextStepsCard steps={[]} state="ready" />);

    expect(within(region()).getByText(/nothing needs your attention right now/)).toBeInTheDocument();
    expect(within(region()).queryByRole("list")).not.toBeInTheDocument();
  });

  it("shows the default failure message, or the one given", () => {
    const { rerender } = render(<NextStepsCard steps={[]} state="failed" />);
    expect(within(region()).getByText("Some of your information could not be loaded.")).toBeInTheDocument();

    rerender(<NextStepsCard steps={[]} state="failed" failedMessage="Your hiring status could not be loaded." />);
    expect(within(region()).getByText("Your hiring status could not be loaded.")).toBeInTheDocument();
  });

  it("shows a loading indicator, and neither message, while loading", () => {
    render(<NextStepsCard steps={[]} state="loading" />);

    expect(within(region()).getByText("Loading…")).toBeInTheDocument();
    expect(within(region()).queryByText(/could not be loaded|all set/)).not.toBeInTheDocument();
  });

  it("keeps showing the steps already known when another source fails or loads", () => {
    const { rerender } = render(<NextStepsCard steps={steps} state="failed" />);
    expect(within(region()).getAllByRole("link")).toHaveLength(3);
    expect(within(region()).queryByText("Some of your information could not be loaded.")).not.toBeInTheDocument();

    rerender(<NextStepsCard steps={steps} state="loading" />);
    expect(within(region()).queryByText("Loading…")).not.toBeInTheDocument();
  });
});
