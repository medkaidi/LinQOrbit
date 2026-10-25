import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, screen } from "@testing-library/react";
import { DashboardHeader } from "@/components/layout/dashboard-header";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import { useAuthStore } from "@/stores/auth-store";
import { useHeaderSearchStore } from "@/stores/header-search-store";
import type { AuthUser } from "@/types/auth";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/dashboard",
}));

const user: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: null,
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  roles: [],
};

describe("DashboardHeader", () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
  });

  it("keeps the notifications control inert", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByRole("button", { name: "Notifications" })).toBeDisabled();
  });

  it("exposes an active Search jobs field", () => {
    renderWithQueryClient(<DashboardHeader />);

    const search = screen.getByLabelText("Search jobs");
    expect(search).not.toBeDisabled();
    expect(search).toHaveAttribute("placeholder", "Search jobs");
  });

  it("renders the profile mode toggle defaulting to Candidate", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByRole("group", { name: "Profile mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Candidate" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Recruiter" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("shows the signed-in user in the trigger", () => {
    renderWithQueryClient(<DashboardHeader />);

    expect(screen.getByText("Ada L.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toBeInTheDocument();
  });

  it("follows the sidebar collapse with its left offset (T-40)", () => {
    const { container } = renderWithQueryClient(<DashboardHeader collapsed />);

    const header = container.querySelector("header");
    expect(header).toHaveClass("left-0");
    expect(header).toHaveClass("lg:left-20");
    expect(header).not.toHaveClass("lg:left-64");
  });

  it("stays offset by the full sidebar when expanded", () => {
    const { container } = renderWithQueryClient(<DashboardHeader collapsed={false} />);

    const header = container.querySelector("header");
    expect(header).toHaveClass("lg:left-64");
    expect(header).not.toHaveClass("lg:left-20");
  });
});

describe("DashboardHeader search role", () => {
  beforeEach(() => {
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    useHeaderSearchStore.setState({ role: null, query: "" });
  });

  it("keeps the original field, hidden below md, when the page declares no role", () => {
    renderWithQueryClient(<DashboardHeader />);

    const search = screen.getByLabelText("Search jobs");
    expect(search.parentElement).toHaveClass("hidden", "md:block");
  });

  it("becomes the page's field once a role is declared, visible at every width", () => {
    renderWithQueryClient(<DashboardHeader />);

    act(() =>
      useHeaderSearchStore.getState().register({
        id: "board",
        label: "Search board",
        placeholder: "Search by job title or company",
        maxLength: 100,
      }),
    );

    const search = screen.getByRole("textbox", { name: "Search board" });
    expect(search).toHaveAttribute("placeholder", "Search by job title or company");
    expect(search).toHaveAttribute("maxlength", "100");
    expect(search.parentElement).not.toHaveClass("hidden");
    expect(screen.queryByLabelText("Search jobs")).not.toBeInTheDocument();
  });

  it("writes the typed text to the store and follows the page clear", () => {
    renderWithQueryClient(<DashboardHeader />);
    act(() =>
      useHeaderSearchStore
        .getState()
        .register({ id: "board", label: "Search board", placeholder: "Board" }),
    );
    const search = screen.getByRole("textbox", { name: "Search board" });

    fireEvent.change(search, { target: { value: "devops" } });
    expect(useHeaderSearchStore.getState().query).toBe("devops");
    expect(search).toHaveValue("devops");

    act(() => useHeaderSearchStore.getState().setQuery(""));
    expect(search).toHaveValue("");
  });

  it("goes back to the original field when the page releases its role", () => {
    renderWithQueryClient(<DashboardHeader />);
    act(() =>
      useHeaderSearchStore
        .getState()
        .register({ id: "board", label: "Search board", placeholder: "Board" }),
    );

    act(() => useHeaderSearchStore.getState().unregister("board"));

    expect(screen.getByLabelText("Search jobs")).toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Search board" })).not.toBeInTheDocument();
  });

  it("remounts the field on each switch, so a typed text never leaks into the inert field", () => {
    renderWithQueryClient(<DashboardHeader />);
    const role = { id: "board", label: "Search board", placeholder: "Board" };
    act(() => useHeaderSearchStore.getState().register(role));
    fireEvent.change(screen.getByRole("textbox", { name: "Search board" }), {
      target: { value: "devops" },
    });

    act(() => useHeaderSearchStore.getState().unregister("board"));

    expect(screen.getByRole("textbox", { name: "Search jobs" })).toHaveValue("");
  });
});
