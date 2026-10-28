import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { MarketingHome } from "@/features/marketing/home";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock, replace: vi.fn() }),
}));

function searchField() {
  return screen.getByRole("textbox", { name: "Job title or company" });
}

function submitSearch() {
  const button = screen.getByRole("button", { name: "Search jobs" });
  const form = button.closest("form");
  expect(form).not.toBeNull();
  fireEvent.submit(form as HTMLFormElement);
}

describe("MarketingHome", () => {
  beforeEach(() => {
    pushMock.mockClear();
  });

  it("offers one single search field, for the job title or the company", () => {
    render(<MarketingHome />);

    const field = searchField();
    expect(field).toHaveAttribute("placeholder", "Job title or company");
    expect(field).toHaveAttribute("maxlength", "100");
    // Le champ « lieu » a été retiré : la recherche publique ne filtre pas par lieu.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.queryByPlaceholderText(/City|region|remote/i)).not.toBeInTheDocument();
  });

  it("leads to the public job board with the typed query", () => {
    render(<MarketingHome />);

    fireEvent.change(searchField(), { target: { value: "backend" } });
    submitSearch();

    expect(pushMock).toHaveBeenCalledWith("/jobs?q=backend");
  });

  it("encodes the query", () => {
    render(<MarketingHome />);

    fireEvent.change(searchField(), { target: { value: "c++ & java" } });
    submitSearch();

    expect(pushMock).toHaveBeenCalledWith("/jobs?q=c%2B%2B%20%26%20java");
  });

  it("trims the query", () => {
    render(<MarketingHome />);

    fireEvent.change(searchField(), { target: { value: "  devops  " } });
    submitSearch();

    expect(pushMock).toHaveBeenCalledWith("/jobs?q=devops");
  });

  it("goes to the board without a query when the search is empty or blank", () => {
    render(<MarketingHome />);

    submitSearch();
    expect(pushMock).toHaveBeenCalledWith("/jobs");

    fireEvent.change(searchField(), { target: { value: "   " } });
    submitSearch();
    expect(pushMock).toHaveBeenLastCalledWith("/jobs");
  });

  it("caps the query at 100 characters", () => {
    render(<MarketingHome />);

    fireEvent.change(searchField(), { target: { value: "a".repeat(150) } });
    submitSearch();

    expect(pushMock).toHaveBeenCalledWith(`/jobs?q=${"a".repeat(100)}`);
  });

  it("submits the form with the search button, without leaving the page", () => {
    render(<MarketingHome />);

    const button = screen.getByRole("button", { name: "Search jobs" });
    expect(button).toHaveAttribute("type", "submit");

    fireEvent.change(searchField(), { target: { value: "devops" } });
    fireEvent.click(button);

    expect(pushMock).toHaveBeenCalledWith("/jobs?q=devops");
  });
});
