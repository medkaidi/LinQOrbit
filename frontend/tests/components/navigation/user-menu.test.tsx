import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { UserMenu } from "@/components/navigation/user-menu";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import { useAuthStore } from "@/stores/auth-store";
import { useViewModeStore } from "@/stores/view-mode-store";
import type { AuthUser } from "@/types/auth";

const pushMock = vi.hoisted(() => vi.fn());
const useRecruiterProfileMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => "/dashboard",
}));

vi.mock("@/hooks/use-recruiter", () => ({
  useRecruiterProfile: useRecruiterProfileMock,
}));

const user: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: "+1 555 000 0000",
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  roles: [],
};

function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Account menu" }));
}

describe("UserMenu", () => {
  beforeEach(() => {
    pushMock.mockClear();
    useAuthStore.getState().setAuth({ token: "jwt-token", user });
    useViewModeStore.setState({ mode: "candidate" });
    useRecruiterProfileMock.mockReturnValue({
      profile: { id: "r1", headline: "Talent Lead at Nimbus Labs", bio: null },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
  });

  it("shows the display name, email and initials on the trigger", () => {
    renderWithQueryClient(<UserMenu />);

    expect(screen.getByText("Ada L.")).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("opens the menu with profile, change-password and logout actions", () => {
    renderWithQueryClient(<UserMenu />);

    openMenu();

    const accountLink = screen.getByRole("menuitem", { name: "My Account" });
    const passwordLink = screen.getByRole("menuitem", { name: "Change password" });
    expect(accountLink).toHaveAttribute("href", "/account");
    expect(passwordLink).toHaveAttribute("href", "/change-password");
    expect(screen.getByRole("menuitem", { name: "Log out" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Account menu" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("closes the menu on Escape", () => {
    renderWithQueryClient(<UserMenu />);

    openMenu();
    expect(screen.getByRole("menu", { name: "Account menu" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("returns focus to the trigger on Escape", () => {
    renderWithQueryClient(<UserMenu />);

    openMenu();
    const trigger = screen.getByRole("button", { name: "Account menu" });
    screen.getByRole("menuitem", { name: "My Account" }).focus();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(trigger).toHaveFocus();
  });

  it("closes the menu when clicking outside", () => {
    renderWithQueryClient(<UserMenu />);

    openMenu();
    fireEvent.mouseDown(document.body);

    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("clears the session and navigates to login on logout", async () => {
    renderWithQueryClient(<UserMenu />);

    openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Log out" }));

    await waitFor(() => expect(useAuthStore.getState().token).toBeNull());
    expect(pushMock).toHaveBeenCalledWith("/login");
    expect(screen.queryByRole("menu", { name: "Account menu" })).not.toBeInTheDocument();
  });

  it("hides the recruiter entry in candidate mode", () => {
    renderWithQueryClient(<UserMenu />);

    openMenu();

    expect(screen.queryByRole("menuitem", { name: "Recruiter settings" })).not.toBeInTheDocument();
    expect(screen.queryByText("Talent Lead at Nimbus Labs")).not.toBeInTheDocument();
  });

  it("shows the headline instead of the email on the trigger in recruiter mode", () => {
    useViewModeStore.setState({ mode: "recruiter" });
    renderWithQueryClient(<UserMenu />);

    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(within(trigger).getByText("Talent Lead at Nimbus Labs")).toBeInTheDocument();
    expect(within(trigger).queryByText("ada@example.com")).not.toBeInTheDocument();

    openMenu();

    expect(screen.getByRole("menuitem", { name: "Recruiter settings" })).toHaveAttribute(
      "href",
      "/recruiter/settings",
    );
  });

  it("falls back to the email on the trigger when the headline is empty", () => {
    useRecruiterProfileMock.mockReturnValue({
      profile: { id: "r1", headline: null, bio: null },
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn(),
    });
    useViewModeStore.setState({ mode: "recruiter" });
    renderWithQueryClient(<UserMenu />);

    const trigger = screen.getByRole("button", { name: "Account menu" });
    expect(within(trigger).getByText("ada@example.com")).toBeInTheDocument();
    expect(within(trigger).queryByText("Talent Lead at Nimbus Labs")).not.toBeInTheDocument();
  });

  it("requests the recruiter profile only in recruiter mode", () => {
    renderWithQueryClient(<UserMenu />);
    expect(useRecruiterProfileMock).toHaveBeenCalledWith({ enabled: false });

    useRecruiterProfileMock.mockClear();
    useViewModeStore.setState({ mode: "recruiter" });
    renderWithQueryClient(<UserMenu />);
    expect(useRecruiterProfileMock).toHaveBeenCalledWith({ enabled: true });
  });
});
