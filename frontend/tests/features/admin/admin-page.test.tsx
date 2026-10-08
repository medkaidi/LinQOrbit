import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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
import type { AdminSkillSuggestion, AdminUser } from "@/types/admin";
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
};

const candidateAccount: AdminUser = {
  id: "user-2",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "ACTIVE",
  roles: [],
};

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
    mockedListUsers.mockResolvedValue([adminAccount, candidateAccount]);

    renderAdminView();

    expect(await screen.findByText("Platform Admin")).toBeInTheDocument();
    expect(screen.getByText("admin@linqorbit.local")).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(2);
    expect(screen.getByText("Admin")).toBeInTheDocument();
    expect(screen.getByText("Your account")).toBeInTheDocument();
    // Le compte courant n'a pas de bascule : une seule action, sur l'autre compte.
    expect(screen.getAllByRole("button", { name: "Deactivate" })).toHaveLength(1);
  });

  it("deactivates an account through the API and reflects the new status", async () => {
    mockedListUsers
      .mockResolvedValueOnce([adminAccount, candidateAccount])
      .mockResolvedValueOnce([
        adminAccount,
        { ...candidateAccount, status: "INACTIVE" },
      ]);
    mockedUpdateUserStatus.mockResolvedValue(undefined);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() =>
      expect(mockedUpdateUserStatus).toHaveBeenCalledWith("user-2", "INACTIVE"),
    );
    expect(await screen.findByRole("button", { name: "Activate" })).toBeInTheDocument();
  });

  it("shows the skill suggestions with author and date", async () => {
    mockedListUsers.mockResolvedValue([adminAccount]);
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);

    renderAdminView();

    expect(await screen.findByText("Rust")).toBeInTheDocument();
    expect(screen.getByText(/by Ada Lovelace · ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
  });

  it("shows an empty state when there is no suggestion", async () => {
    mockedListUsers.mockResolvedValue([adminAccount]);

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
    mockedListUsers.mockResolvedValue([adminAccount, candidateAccount]);
    mockedUpdateUserStatus.mockRejectedValue(new Error("boom"));

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));

    expect(await screen.findByText("Unable to update the status")).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
  });

  it("rejects a suggestion through the API", async () => {
    mockedListUsers.mockResolvedValue([adminAccount]);
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedRejectSkillSuggestion.mockResolvedValue(undefined);

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    await waitFor(() => expect(mockedRejectSkillSuggestion).toHaveBeenCalledWith("s1"));
  });

  it("surfaces a failed rejection without dropping the list", async () => {
    mockedListUsers.mockResolvedValue([adminAccount]);
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedRejectSkillSuggestion.mockRejectedValue(new Error("boom"));

    renderAdminView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));

    expect(await screen.findByText("Unable to reject the suggestion")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  it("opens the review dialog and approves with a chosen category", async () => {
    mockedListUsers.mockResolvedValue([adminAccount]);
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
    mockedListUsers.mockResolvedValue([adminAccount]);
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
    mockedListUsers.mockResolvedValue([adminAccount]);
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
