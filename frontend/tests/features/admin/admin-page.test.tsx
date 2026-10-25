import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    listUsers: vi.fn(),
    listSkillSuggestions: vi.fn(),
    updateUserStatus: vi.fn(),
  };
});

vi.mock("@/components/navigation/user-menu", () => ({
  UserMenu: () => <div data-testid="user-menu" />,
}));

import {
  listSkillSuggestions,
  listUsers,
  updateUserStatus,
} from "@/lib/api/admin.api";
import { AdminHeader } from "@/components/layout/admin-header";
import { AdminView } from "@/features/admin/admin-page";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import { useHeaderSearchStore } from "@/stores/header-search-store";
import type { AuthUser } from "@/types/auth";
import type { AdminUser, AdminUserPage } from "@/types/admin";

const mockedListUsers = vi.mocked(listUsers);
const mockedListSkillSuggestions = vi.mocked(listSkillSuggestions);
const mockedUpdateUserStatus = vi.mocked(updateUserStatus);

const adminAccount: AdminUser = {
  id: "admin-1",
  email: "admin@linqorbit.local",
  firstName: "Platform",
  lastName: "Admin",
  status: "ACTIVE",
  roles: [ROLE.ADMIN],
  hasCandidateProfile: false,
  hasRecruiterProfile: false,
};

const candidateAccount: AdminUser = {
  id: "user-2",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "ACTIVE",
  roles: [],
  hasCandidateProfile: true,
  hasRecruiterProfile: false,
};

/** Enveloppe paginée du backend (D34) — une seule page dans les tests. */
function usersPage(items: AdminUser[], overrides: Partial<AdminUserPage> = {}): AdminUserPage {
  return { items, page: 0, size: 20, total: items.length, ...overrides };
}

const sessionUser: AuthUser = {
  ...adminAccount,
  sex: "female",
  phone: null,
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
};

function renderAdminView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminHeader />
      <AdminView />
    </QueryClientProvider>,
  );
}

describe("AdminView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useHeaderSearchStore.setState({ role: null, query: "" });
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth({ token: "jwt-token", user: sessionUser });
  });

  it("is the Accounts page: its breadcrumb goes back to the Administration overview", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    renderAdminView();

    expect(screen.getByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(within(breadcrumb).getByText("Accounts")).toBeInTheDocument();
    await screen.findByText("Platform Admin");
  });

  it("no longer carries the skill suggestions: they have their own page", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));

    renderAdminView();

    await screen.findByText("Platform Admin");
    expect(screen.queryByRole("heading", { name: "Skill suggestions" })).not.toBeInTheDocument();
    expect(mockedListSkillSuggestions).not.toHaveBeenCalled();
  });

  it("lists accounts with status, role badge and marks the current one", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount, candidateAccount]));

    renderAdminView();

    expect(await screen.findByText("Platform Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@linqorbit.local")).toBeInTheDocument();
    // Pastilles de statut des lignes (le filtre a aussi un segment « Active »).
    expect(within(screen.getByRole("list")).getAllByText("Active")).toHaveLength(2);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    // Chips de capacités issues des flags du payload.
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.queryByText("Recruiter")).not.toBeInTheDocument();
    // Avatar d'initiales du compte affiché.
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByText("Your account")).toBeInTheDocument();
    // Le compte courant n'a pas de bascule : une seule action, sur l'autre compte.
    expect(screen.getAllByRole("button", { name: "Deactivate" })).toHaveLength(1);
  });

  it("deactivates an account through the API and reflects the new status", async () => {
    mockedListUsers
      .mockResolvedValueOnce(usersPage([adminAccount, candidateAccount]))
      .mockResolvedValueOnce(
        usersPage([adminAccount, { ...candidateAccount, status: "INACTIVE" }]),
      );
    mockedUpdateUserStatus.mockResolvedValue(undefined);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() =>
      expect(mockedUpdateUserStatus).toHaveBeenCalledWith("user-2", "INACTIVE"),
    );
    expect(await screen.findByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("keeps the busy state on the clicked row only", async () => {
    const otherAccount: AdminUser = {
      ...candidateAccount,
      id: "user-3",
      email: "grace@example.com",
      firstName: "Grace",
      lastName: "Hopper",
    };
    mockedListUsers.mockResolvedValue(usersPage([adminAccount, candidateAccount, otherAccount]));
    let resolveUpdate!: () => void;
    mockedUpdateUserStatus.mockReturnValue(
      new Promise((resolve) => {
        resolveUpdate = () => resolve(undefined);
      }),
    );

    renderAdminView();

    const buttons = await screen.findAllByRole("button", { name: "Deactivate" });
    fireEvent.click(buttons[0]);

    await waitFor(() => expect(buttons[0]).toHaveAttribute("aria-busy", "true"));
    expect(buttons[1]).not.toHaveAttribute("aria-busy");

    resolveUpdate();
    await waitFor(() => expect(buttons[0]).not.toHaveAttribute("aria-busy"));
  });

  it("shows a loading state while the first accounts page loads", async () => {
    mockedListUsers.mockReturnValue(new Promise(() => {}));

    renderAdminView();

    expect(await screen.findByText("Loading accounts…")).toBeInTheDocument();
  });

  it("searches accounts from the header field, not from a field of the page", async () => {
    mockedListUsers.mockResolvedValue(usersPage([candidateAccount]));

    renderAdminView();
    await screen.findByText("Ada Lovelace");

    const field = screen.getByRole("textbox", { name: "Search accounts" });
    expect(field.closest("header")).not.toBeNull();
    expect(field).toHaveAttribute("placeholder", "Search by name or email");
    expect(field).toHaveAttribute("maxlength", "100");
    // Le header porte l'unique champ de recherche ; la page n'a plus que ses deux filtres.
    expect(screen.getAllByRole("textbox")).toHaveLength(1);
    expect(screen.getByRole("group", { name: "Filter accounts by status" })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: "Filter accounts by capability" })).toBeInTheDocument();
  });

  it("gives the header search back when the page is left", async () => {
    mockedListUsers.mockResolvedValue(usersPage([candidateAccount]));

    const { unmount } = renderAdminView();
    await screen.findByText("Ada Lovelace");
    expect(useHeaderSearchStore.getState().role?.id).toBe("admin-accounts");

    unmount();

    expect(useHeaderSearchStore.getState().role).toBeNull();
  });

  it("searches accounts with a debounced query", async () => {
    mockedListUsers.mockResolvedValue(usersPage([candidateAccount]));

    renderAdminView();
    await screen.findByText("Ada Lovelace");

    // 1ʳᵉ requête : page seule, aucune clé de filtre.
    expect(mockedListUsers).toHaveBeenCalledWith({ page: 0 }, expect.anything());

    fireEvent.change(screen.getByRole("textbox", { name: "Search accounts" }), {
      target: { value: " ada " },
    });

    await waitFor(() =>
      expect(mockedListUsers).toHaveBeenCalledWith(
        expect.objectContaining({ q: "ada", page: 0 }),
        expect.anything(),
      ),
    );
  });

  it("clears the search back to the unfiltered list", async () => {
    // Réponses dépendantes du filtre : la recherche restreint la liste.
    mockedListUsers.mockImplementation(async (params = {}) =>
      params.q
        ? usersPage([candidateAccount])
        : usersPage([adminAccount, candidateAccount]),
    );

    renderAdminView();
    await screen.findByText("Platform Admin");

    const searchBox = screen.getByRole("textbox", { name: "Search accounts" });
    fireEvent.change(searchBox, { target: { value: "ada" } });

    await waitFor(() =>
      expect(mockedListUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ q: "ada" }),
        expect.anything(),
      ),
    );
    await waitFor(() =>
      expect(screen.queryByText("Platform Admin")).not.toBeInTheDocument(),
    );

    fireEvent.change(searchBox, { target: { value: "" } });

    // Champ vide ⇒ retour à la liste non filtrée (la clé TanStack sans filtre
    // est déjà en cache — aucun appel supplémentaire n'est nécessaire).
    expect(await screen.findByText("Platform Admin")).toBeInTheDocument();
  });

  it("filters accounts by status and capability, combined", async () => {
    mockedListUsers.mockResolvedValue(usersPage([candidateAccount]));

    renderAdminView();
    await screen.findByText("Ada Lovelace");

    const statusGroup = screen.getByRole("group", { name: "Filter accounts by status" });
    fireEvent.click(within(statusGroup).getByRole("button", { name: "Inactive" }));

    await waitFor(() =>
      expect(mockedListUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "inactive" }),
        expect.anything(),
      ),
    );

    const capabilityGroup = screen.getByRole("group", {
      name: "Filter accounts by capability",
    });
    fireEvent.click(within(capabilityGroup).getByRole("button", { name: "Recruiters" }));

    await waitFor(() =>
      expect(mockedListUsers).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "inactive", capability: "recruiter" }),
        expect.anything(),
      ),
    );
  });

  it("shows a filter-aware empty state", async () => {
    mockedListUsers.mockResolvedValue(usersPage([]));

    renderAdminView();
    await screen.findByText("No accounts.");

    fireEvent.click(
      within(screen.getByRole("group", { name: "Filter accounts by status" })).getByRole(
        "button",
        { name: "Inactive" },
      ),
    );

    expect(await screen.findByText("No accounts match these filters.")).toBeInTheDocument();
  });

  it("shows an error with a retry when accounts fail to load", async () => {
    mockedListUsers.mockRejectedValue(new Error("boom"));

    renderAdminView();

    expect(await screen.findByText("Unable to load accounts")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("surfaces a failed status update without dropping the list", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount, candidateAccount]));
    mockedUpdateUserStatus.mockRejectedValue(new Error("boom"));

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText("Unable to update the status")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

});
