import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { AdminHeader } from "@/components/layout/admin-header";
import { useHeaderSearchStore, type HeaderSearchRole } from "@/stores/header-search-store";

vi.mock("@/components/navigation/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

const ROLE: HeaderSearchRole = {
  id: "test-page",
  label: "Search things",
  placeholder: "Search by thing",
  maxLength: 40,
};

describe("AdminHeader", () => {
  beforeEach(() => {
    useHeaderSearchStore.setState({ role: null, query: "" });
  });

  it("hosts the user menu on the right", () => {
    const { container } = render(<AdminHeader />);

    const header = container.querySelector("header");
    expect(header).toContainElement(screen.getByTestId("user-menu"));
    expect(screen.getByTestId("user-menu").parentElement).toHaveClass("ml-auto");
  });

  it("links the mobile logo back to the admin home", () => {
    render(<AdminHeader />);

    const logo = screen.getByRole("link", { name: /administration home/i });
    expect(logo).toHaveAttribute("href", "/admin");
    // Visible seulement là où la sidenav (et son logo) est masquée.
    expect(logo).toHaveClass("lg:hidden");
  });

  it("carries nothing inert: no search field without a page role, no mode switch, no notifications", () => {
    render(<AdminHeader />);

    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Notifications" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: /view/i })).not.toBeInTheDocument();
  });

  describe("with a search role declared by the page", () => {
    beforeEach(() => {
      useHeaderSearchStore.getState().register(ROLE);
    });

    it("shows the page's own field: label, placeholder and cap", () => {
      render(<AdminHeader />);

      const field = screen.getByRole("textbox", { name: "Search things" });
      expect(field).toHaveAttribute("placeholder", "Search by thing");
      expect(field).toHaveAttribute("maxlength", "40");
    });

    it("feeds what is typed into the store, and shows the stored query", () => {
      render(<AdminHeader />);

      fireEvent.change(screen.getByRole("textbox", { name: "Search things" }), {
        target: { value: "acme" },
      });
      expect(useHeaderSearchStore.getState().query).toBe("acme");
      expect(screen.getByRole("textbox", { name: "Search things" })).toHaveValue("acme");

      act(() => useHeaderSearchStore.getState().setQuery(""));
      expect(screen.getByRole("textbox", { name: "Search things" })).toHaveValue("");
    });

    it("hides the field again when the page gives its role back", () => {
      render(<AdminHeader />);

      act(() => useHeaderSearchStore.getState().unregister(ROLE.id));

      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    it("keeps the field visible below md, with no shortcut hint, next to the user menu", () => {
      const { container } = render(<AdminHeader />);

      const field = screen.getByRole("textbox", { name: "Search things" });
      // Visible à toutes les largeurs : la recherche ne disparaît pas sur mobile.
      expect(field.parentElement).not.toHaveClass("hidden");
      expect(field.parentElement?.parentElement).not.toHaveClass("hidden");
      expect(screen.queryByText("⌘K")).not.toBeInTheDocument();
      expect(container.querySelector("header")).toContainElement(screen.getByTestId("user-menu"));
    });
  });

  it("starts after the full sidenav, or after the icon rail once collapsed", () => {
    const { container, rerender } = render(<AdminHeader collapsed={false} />);
    const header = container.querySelector("header");
    expect(header).toHaveClass("lg:left-64");

    rerender(<AdminHeader collapsed />);
    expect(header).toHaveClass("lg:left-20");
    expect(header).not.toHaveClass("lg:left-64");
  });

  it("stays fixed under the drawer layer, like the dashboard header", () => {
    const { container } = render(<AdminHeader />);

    expect(container.querySelector("header")).toHaveClass("fixed", "top-0", "h-16", "z-40");
  });
});
