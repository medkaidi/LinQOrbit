import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";

import { AdminShell, AdminSidebar } from "@/components/layout/admin-sidebar";
import {
  ADMIN_SIDEBAR_STORAGE_KEY,
  useAdminSidebarStore,
} from "@/stores/admin-sidebar-store";

const pathnameMock = vi.hoisted(() => vi.fn(() => "/admin"));

vi.mock("next/navigation", () => ({
  usePathname: () => pathnameMock(),
}));

vi.mock("@/components/navigation/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

describe("AdminSidebar", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/admin");
    useAdminSidebarStore.setState({ collapsed: false });
    window.localStorage.removeItem(ADMIN_SIDEBAR_STORAGE_KEY);
  });

  it("links Overview to /admin and marks it active only on the exact route", () => {
    render(<AdminSidebar />);

    const overview = screen.getByRole("link", { name: /^overview$/i });
    expect(overview).toHaveAttribute("href", "/admin");
    expect(overview).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^accounts$/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links Accounts to /admin/accounts and keeps Overview inactive there", () => {
    pathnameMock.mockReturnValue("/admin/accounts");

    render(<AdminSidebar />);

    const accounts = screen.getByRole("link", { name: /^accounts$/i });
    expect(accounts).toHaveAttribute("href", "/admin/accounts");
    expect(accounts).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^overview$/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("keeps Overview inactive on the other admin routes", () => {
    pathnameMock.mockReturnValue("/admin/reports/abc");

    render(<AdminSidebar />);

    expect(screen.getByRole("link", { name: /^overview$/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: /ai reports/i })).toHaveAttribute("aria-current", "page");
  });

  it("links Offers to /admin/offers and marks it active on its routes", () => {
    pathnameMock.mockReturnValue("/admin/offers");

    render(<AdminSidebar />);

    const offers = screen.getByRole("link", { name: /^offers$/i });
    expect(offers).toHaveAttribute("href", "/admin/offers");
    expect(offers).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^accounts$/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  it("links Skill suggestions to its own page, active there only", () => {
    pathnameMock.mockReturnValue("/admin/suggestions");

    render(<AdminSidebar />);

    const suggestions = screen.getByRole("link", { name: "Skill suggestions" });
    expect(suggestions).toHaveAttribute("href", "/admin/suggestions");
    expect(suggestions).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^accounts$/i })).not.toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /^overview$/i })).not.toHaveAttribute("aria-current", "page");
  });

  it("keeps Skill suggestions inactive on the accounts page", () => {
    pathnameMock.mockReturnValue("/admin/accounts");

    render(<AdminSidebar />);

    expect(screen.getByRole("link", { name: "Skill suggestions" })).not.toHaveAttribute("aria-current", "page");
  });

  it("links Back to dashboard to /dashboard and never marks it active", () => {
    pathnameMock.mockReturnValue("/dashboard");

    render(<AdminSidebar />);

    const back = screen.getByRole("link", { name: /back to dashboard/i });
    expect(back).toHaveAttribute("href", "/dashboard");
    expect(back).not.toHaveAttribute("aria-current", "page");
  });

  it("links the logo back to the admin home", () => {
    render(<AdminSidebar />);

    const logoLink = screen.getByRole("link", { name: /administration home/i });
    expect(logoLink).toHaveAttribute("href", "/admin");
  });

  it("keeps the collapse toggle at the top, next to the logo container", () => {
    render(<AdminSidebar />);

    const toggle = screen.getByRole("button", { name: "Collapse sidebar" });
    const logoLink = screen.getByRole("link", { name: /administration home/i });
    // Même conteneur d'en-tête, logo d'abord puis toggle (compact, pas w-full).
    expect(toggle.parentElement).toBe(logoLink.parentElement);
    expect(logoLink.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle).not.toHaveClass("w-full");
  });

  it("no longer hosts the user menu (it lives in the top bar)", () => {
    render(<AdminSidebar />);

    expect(screen.queryByTestId("user-menu")).not.toBeInTheDocument();
  });

  it("collapses to an icon rail, then restores the labels on expand", () => {
    render(<AdminSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    // Rail : labels masqués, liens nommés par aria-label + tooltip, largeur réduite.
    expect(screen.queryByText("Offers")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Offers" })).toHaveAttribute(
      "title",
      "Offers",
    );
    expect(screen.getByRole("link", { name: "Accounts" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Overview" })).toBeInTheDocument();
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("lg:w-20");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(screen.getByText("Offers")).toBeInTheDocument();
    expect(aside).toHaveClass("lg:w-64");
  });

  it("persists the collapsed preference across the store", () => {
    render(<AdminSidebar />);

    fireEvent.click(screen.getByRole("button", { name: "Collapse sidebar" }));

    expect(useAdminSidebarStore.getState().collapsed).toBe(true);
    expect(window.localStorage.getItem(ADMIN_SIDEBAR_STORAGE_KEY)).toContain(
      '"collapsed":true',
    );
  });
});

describe("AdminShell", () => {
  beforeEach(() => {
    useAdminSidebarStore.setState({ collapsed: false });
  });

  it("follows the sidebar state with the main padding", () => {
    const { container } = render(
      <AdminShell>
        <p>page content</p>
      </AdminShell>,
    );

    const main = container.querySelector("main");
    expect(main).toHaveClass("lg:pl-64");
    expect(screen.getByText("page content")).toBeInTheDocument();

    act(() => {
      useAdminSidebarStore.getState().toggle();
    });

    expect(main).toHaveClass("lg:pl-20");
  });

  it("renders the top bar with the user menu and clears it below with pt-16", () => {
    const { container } = render(
      <AdminShell>
        <p>page content</p>
      </AdminShell>,
    );

    const header = container.querySelector("header");
    expect(header).toContainElement(screen.getByTestId("user-menu"));
    expect(container.querySelector("main")).toHaveClass("pt-16");
  });

  it("makes the top bar follow the sidebar state", () => {
    const { container } = render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    const header = container.querySelector("header");
    expect(header).toHaveClass("lg:left-64");

    act(() => {
      useAdminSidebarStore.getState().toggle();
    });

    expect(header).toHaveClass("lg:left-20");
  });

  it("exposes the sidebar width as --sidenav-w on <html>", () => {
    const root = document.documentElement;
    // Défaut (dépliée) : la var doit être posée même avant tout toggle.
    useAdminSidebarStore.setState({ collapsed: true });
    render(
      <AdminShell>
        <p>content</p>
      </AdminShell>,
    );
    expect(root.style.getPropertyValue("--sidenav-w")).toBe("5rem");

    act(() => {
      useAdminSidebarStore.getState().toggle();
    });
    expect(root.style.getPropertyValue("--sidenav-w")).toBe("16rem");
  });
});
