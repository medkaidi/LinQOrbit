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
    approveSkillSuggestion: vi.fn(),
    linkSkillSuggestion: vi.fn(),
    rejectSkillSuggestion: vi.fn(),
  };
});

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return {
    ...actual,
    getReferenceSkills: vi.fn(),
  };
});

import {
  approveSkillSuggestion,
  linkSkillSuggestion,
  listSkillSuggestions,
  listUsers,
  rejectSkillSuggestion,
  updateUserStatus,
} from "@/lib/api/admin.api";
import { getReferenceSkills } from "@/lib/api/candidate.api";
import { AdminView } from "@/features/admin/admin-page";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";
import type { AdminSkillSuggestion, AdminUser, AdminUserPage } from "@/types/admin";
import type { SkillReference } from "@/types/candidate";

const mockedListUsers = vi.mocked(listUsers);
const mockedListSkillSuggestions = vi.mocked(listSkillSuggestions);
const mockedUpdateUserStatus = vi.mocked(updateUserStatus);
const mockedApproveSkillSuggestion = vi.mocked(approveSkillSuggestion);
const mockedLinkSkillSuggestion = vi.mocked(linkSkillSuggestion);
const mockedRejectSkillSuggestion = vi.mocked(rejectSkillSuggestion);
const mockedGetReferenceSkills = vi.mocked(getReferenceSkills);

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

const suggestion: AdminSkillSuggestion = {
  id: "s1",
  name: "Rust",
  candidateId: "user-2",
  candidateFirstName: "Ada",
  candidateLastName: "Lovelace",
  candidateEmail: "ada@example.com",
  createdAt: "2026-10-02T10:00:00",
};

const catalogSkill: SkillReference = {
  id: "skill-miro",
  name: "Miro",
  skillType: "tech",
  category: "Design",
};

function renderAdminView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminView />
    </QueryClientProvider>,
  );
}

describe("AdminView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth({ token: "jwt-token", user: sessionUser });
    mockedListSkillSuggestions.mockResolvedValue([]);
    mockedGetReferenceSkills.mockResolvedValue([catalogSkill]);
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

  it("shows the skill suggestions with author and date", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);

    renderAdminView();

    expect(await screen.findByText("Rust")).toBeInTheDocument();
    expect(screen.getByText(/by Ada Lovelace · ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
  });

  it("shows an empty state when there is no suggestion", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));

    renderAdminView();

    expect(await screen.findByText(/No suggestions yet/)).toBeInTheDocument();
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

  it("rejects a suggestion through the API after confirmation", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedRejectSkillSuggestion.mockResolvedValue(undefined);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this suggestion?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(mockedRejectSkillSuggestion).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not reject when the confirmation is cancelled", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this suggestion?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedRejectSkillSuggestion).not.toHaveBeenCalled();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  it("surfaces a failed rejection without dropping the list", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedRejectSkillSuggestion.mockRejectedValue(new Error("boom"));

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this suggestion?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(await screen.findByText("Unable to reject the suggestion")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  it("opens the review dialog and approves with a chosen category", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedApproveSkillSuggestion.mockResolvedValue(undefined);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    expect(
      await screen.findByRole("dialog", { name: /Review suggestion Rust/ }),
    ).toBeInTheDocument();

    const categorySelect = await screen.findByRole("combobox", { name: "Category" });
    await waitFor(() => expect(categorySelect).toBeEnabled());
    fireEvent.click(categorySelect);
    fireEvent.click(await screen.findByRole("option", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(mockedApproveSkillSuggestion).toHaveBeenCalledWith("s1", {
        category: "Design",
        skillType: "tech",
      }),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("links a suggestion to an existing catalog skill", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedLinkSkillSuggestion.mockResolvedValue(undefined);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    await screen.findByRole("dialog", { name: /Review suggestion Rust/ });

    fireEvent.click(screen.getByRole("button", { name: "Existing skill" }));
    const catalogSelect = await screen.findByRole("combobox", { name: "Catalog skill" });
    await waitFor(() => expect(catalogSelect).toBeEnabled());
    fireEvent.click(catalogSelect);
    fireEvent.click(await screen.findByRole("option", { name: "Miro — Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Link to profile" }));

    await waitFor(() =>
      expect(mockedLinkSkillSuggestion).toHaveBeenCalledWith("s1", "skill-miro"),
    );
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and shows the error when the approval fails", async () => {
    mockedListUsers.mockResolvedValue(usersPage([adminAccount]));
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedApproveSkillSuggestion.mockRejectedValue(new Error("boom"));

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Review" }));
    await screen.findByRole("dialog", { name: /Review suggestion Rust/ });
    const categorySelect = await screen.findByRole("combobox", { name: "Category" });
    await waitFor(() => expect(categorySelect).toBeEnabled());
    fireEvent.click(categorySelect);
    fireEvent.click(await screen.findByRole("option", { name: "Design" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve" }));

    expect(await screen.findByText("Unable to review the suggestion")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    await waitFor(() =>
      expect(screen.queryByText("Unable to review the suggestion")).not.toBeInTheDocument(),
    );
  });
});
