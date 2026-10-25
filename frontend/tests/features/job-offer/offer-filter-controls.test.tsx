import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import {
  EXPIRY_FILTER_OPTIONS,
  FilterSelect,
  NO_OFFER_FILTERS,
  STATUS_FILTER_OPTIONS,
  toJobOfferFilters,
  type OfferFilterState,
} from "@/features/job-offer/offer-filter-controls";

const options = [
  { value: "a", label: "Fixed-term contract" },
  { value: "b", label: "Permanent" },
];

describe("FilterSelect", () => {
  it("offers All first, and picking it sends the empty value", () => {
    const onChange = vi.fn();
    render(<FilterSelect label="Contract" options={options} value="a" onChange={onChange} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Contract" }));
    const labels = screen.getAllByRole("option").map((option) => option.querySelector(".truncate")?.textContent);
    expect(labels).toEqual(["All", "Fixed-term contract", "Permanent"]);

    fireEvent.click(screen.getByRole("option", { name: "All" }));
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("keeps the label inline by default", () => {
    render(<FilterSelect label="Contract" options={options} value="" onChange={vi.fn()} />);

    expect(screen.getByText("Contract").parentElement).toHaveClass("flex-row");
  });

  it("stacks the label above the trigger so the value gets the whole cell", () => {
    render(<FilterSelect stacked label="Contract" options={options} value="" onChange={vi.fn()} />);

    const root = screen.getByText("Contract").parentElement;
    expect(root).toHaveClass("flex-col");
    expect(root).not.toHaveClass("flex-row");
  });

  it("lets a stacked filter share a wrapping row evenly, and keeps the inline one content-sized", () => {
    const { container, rerender } = render(
      <FilterSelect stacked label="Contract" options={options} value="" onChange={vi.fn()} />,
    );
    expect(container.firstElementChild).toHaveClass("min-w-0", "flex-1", "basis-32");

    rerender(<FilterSelect label="Contract" options={options} value="" onChange={vi.fn()} />);
    expect(container.firstElementChild).toHaveClass("min-w-0");
    expect(container.firstElementChild).not.toHaveClass("flex-1");
  });

  it("names the trigger with the full value, for values the cell still truncates", () => {
    render(<FilterSelect stacked label="Contract" options={options} value="a" onChange={vi.fn()} />);

    expect(screen.getByRole("combobox", { name: "Contract" })).toHaveAttribute(
      "title",
      "Fixed-term contract",
    );
  });
});

describe("toJobOfferFilters", () => {
  it("sends nothing when no control is active (absent)", () => {
    expect(toJobOfferFilters("", NO_OFFER_FILTERS)).toEqual({});
  });

  it("drops a blank search and trims a real one", () => {
    expect(toJobOfferFilters("   ", NO_OFFER_FILTERS)).toEqual({});
    expect(toJobOfferFilters("  acme  ", NO_OFFER_FILTERS)).toEqual({ q: "acme" });
  });

  it("keeps only the selections that are set, never an empty one", () => {
    const selected: OfferFilterState = {
      ...NO_OFFER_FILTERS,
      status: "draft",
      workModeId: "wm1",
      expiry: "expired",
    };

    expect(toJobOfferFilters("", selected)).toEqual({
      status: "draft",
      workModeId: "wm1",
      expiry: "expired",
    });
  });

  it("combines the search and every selection", () => {
    const selected: OfferFilterState = {
      status: "published",
      workModeId: "wm1",
      contractTypeId: "ct1",
      employmentTypeId: "et1",
      seniority: "lead",
      companyId: "c1",
      expiry: "expiringSoon",
    };

    expect(toJobOfferFilters("go", selected)).toEqual({ q: "go", ...selected });
  });
});

describe("filter option lists", () => {
  it("offers the four lifecycle statuses in lifecycle order", () => {
    expect(STATUS_FILTER_OPTIONS.map((option) => option.value)).toEqual([
      "draft",
      "validated",
      "published",
      "closed",
    ]);
  });

  it("offers the two deadline windows the backend understands", () => {
    expect(EXPIRY_FILTER_OPTIONS.map((option) => option.value)).toEqual(["expiringSoon", "expired"]);
  });
});
