import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FaqExplorer } from "@/features/marketing/faq-explorer";

const faqs = [
  { icon: "hub", question: "How does matching work?", answer: "One engine compares sheets." },
  { icon: "smart_toy", question: "Are agents involved?", answer: "Agents normalize profiles." },
];

function search(value: string) {
  fireEvent.change(screen.getByRole("textbox", { name: "Search frequently asked questions" }), {
    target: { value },
  });
}

describe("FaqExplorer", () => {
  it("lists every question without a query", () => {
    render(<FaqExplorer faqs={faqs} />);
    expect(screen.getByText("How does matching work?")).toBeInTheDocument();
    expect(screen.getByText("Are agents involved?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("filters on question and answer, case-insensitive and trimmed", () => {
    render(<FaqExplorer faqs={faqs} />);

    search("  MATCHING ");
    expect(screen.getByText("How does matching work?")).toBeInTheDocument();
    expect(screen.queryByText("Are agents involved?")).not.toBeInTheDocument();

    search("normalize");
    expect(screen.getByText("Are agents involved?")).toBeInTheDocument();
    expect(screen.queryByText("How does matching work?")).not.toBeInTheDocument();
  });

  it("treats a blank query as no query", () => {
    render(<FaqExplorer faqs={faqs} />);
    search("   ");
    expect(screen.getByText("How does matching work?")).toBeInTheDocument();
    expect(screen.getByText("Are agents involved?")).toBeInTheDocument();
  });

  it("hides every question on no match and clears back to the full list", () => {
    render(<FaqExplorer faqs={faqs} />);

    search("pricing");
    expect(screen.queryByText("How does matching work?")).not.toBeInTheDocument();
    expect(screen.queryByText("Are agents involved?")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByRole("textbox", { name: "Search frequently asked questions" })).toHaveValue("");
    expect(screen.getByText("How does matching work?")).toBeInTheDocument();
  });
});
