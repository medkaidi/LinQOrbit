import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import { AdminSidebar } from "@/components/layout/admin-sidebar";

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

  it("renders the user menu in the footer", () => {
    render(<AdminSidebar />);

    expect(screen.getByTestId("user-menu")).toBeInTheDocument();
  });
});
