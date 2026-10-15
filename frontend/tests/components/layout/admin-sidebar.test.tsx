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
  UserMenu: ({ compact = false }: { compact?: boolean }) => (
    <div data-testid="user-menu" data-compact={String(compact)} />
  ),
}));

describe("AdminSidebar", () => {
  beforeEach(() => {
    pathnameMock.mockReturnValue("/admin");
    useAdminSidebarStore.setState({ collapsed: false });
    window.localStorage.removeItem(ADMIN_SIDEBAR_STORAGE_KEY);
  });

  it("links Accounts & suggestions to /admin and marks it active there", () => {
    render(<AdminSidebar />);

    const accounts = screen.getByRole("link", { name: /accounts & suggestions/i });
    expect(accounts).toHaveAttribute("href", "/admin");
    expect(accounts).toHaveAttribute("aria-current", "page");
  });

  it("links Offers to /admin/offers and marks it active on its routes", () => {
    pathnameMock.mockReturnValue("/admin/offers");

    render(<AdminSidebar />);

    const offers = screen.getByRole("link", { name: /^offers$/i });
    expect(offers).toHaveAttribute("href", "/admin/offers");
    expect(offers).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /accounts & suggestions/i })).not.toHaveAttribute(
      "aria-current",
      "page",
    );
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

  it("renders the user menu in the footer", () => {
    render(<AdminSidebar />);

    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
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
    expect(screen.getByRole("link", { name: "Accounts & suggestions" })).toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toHaveAttribute("data-compact", "true");
    const aside = screen.getByRole("complementary");
    expect(aside).toHaveClass("lg:w-20");
    expect(screen.getByRole("button", { name: "Expand sidebar" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    fireEvent.click(screen.getByRole("button", { name: "Expand sidebar" }));

    expect(screen.getByText("Offers")).toBeInTheDocument();
    expect(screen.getByTestId("user-menu")).toHaveAttribute("data-compact", "false");
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
