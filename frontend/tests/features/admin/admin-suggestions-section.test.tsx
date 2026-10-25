import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    listSkillSuggestions: vi.fn(),
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
  rejectSkillSuggestion,
} from "@/lib/api/admin.api";
import { getReferenceSkills } from "@/lib/api/candidate.api";
import { AdminSuggestionsView } from "@/features/admin/admin-suggestions-section";
import type { AdminSkillSuggestion } from "@/types/admin";
import type { SkillReference } from "@/types/candidate";

const mockedListSkillSuggestions = vi.mocked(listSkillSuggestions);
const mockedApproveSkillSuggestion = vi.mocked(approveSkillSuggestion);
const mockedLinkSkillSuggestion = vi.mocked(linkSkillSuggestion);
const mockedRejectSkillSuggestion = vi.mocked(rejectSkillSuggestion);
const mockedGetReferenceSkills = vi.mocked(getReferenceSkills);

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

function renderView() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSuggestionsView />
    </QueryClientProvider>,
  );
}

describe("AdminSuggestionsView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListSkillSuggestions.mockResolvedValue([]);
    mockedGetReferenceSkills.mockResolvedValue([catalogSkill]);
  });

  it("is its own page: breadcrumb back to the Administration overview, h1 and no accounts list", async () => {
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);

    renderView();

    expect(screen.getByRole("heading", { level: 1, name: "Skill suggestions" })).toBeInTheDocument();
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Administration" })).toHaveAttribute("href", "/admin");
    expect(within(breadcrumb).getByText("Skill suggestions")).toBeInTheDocument();
    await screen.findByText("Rust");
    expect(screen.queryByRole("heading", { name: "Accounts" })).not.toBeInTheDocument();
  });

  it("shows the skill suggestions with author, date and the pending count", async () => {
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);

    renderView();

    expect(await screen.findByText("Rust")).toBeInTheDocument();
    expect(screen.getByText(/by Ada Lovelace · ada@example.com/)).toBeInTheDocument();
    expect(screen.getByText("2026-10-02")).toBeInTheDocument();
    expect(screen.getByText("1 pending")).toBeInTheDocument();
  });

  it("falls back to an unknown author when the candidate has no name or email", async () => {
    mockedListSkillSuggestions.mockResolvedValue([
      { ...suggestion, candidateFirstName: "", candidateLastName: "", candidateEmail: "" },
    ]);

    renderView();

    expect(await screen.findByText("by Unknown candidate")).toBeInTheDocument();
  });

  it("shows an empty state when there is no suggestion", async () => {
    renderView();

    expect(await screen.findByText(/No suggestions yet/)).toBeInTheDocument();
    expect(screen.getByText("0 pending")).toBeInTheDocument();
  });

  it("shows a loading state while the suggestions load", async () => {
    mockedListSkillSuggestions.mockReturnValue(new Promise(() => {}));

    renderView();

    expect(await screen.findByText("Loading suggestions…")).toBeInTheDocument();
  });

  it("shows an error with a retry that reloads the suggestions", async () => {
    mockedListSkillSuggestions.mockRejectedValueOnce(new Error("boom"));

    renderView();

    expect(await screen.findByText("Unable to load suggestions")).toBeInTheDocument();

    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    expect(await screen.findByText("Rust")).toBeInTheDocument();
  });

  it("rejects a suggestion through the API after confirmation", async () => {
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedRejectSkillSuggestion.mockResolvedValue(undefined);

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this suggestion?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    await waitFor(() => expect(mockedRejectSkillSuggestion).toHaveBeenCalledWith("s1"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("does not reject when the confirmation is cancelled", async () => {
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this suggestion?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(mockedRejectSkillSuggestion).not.toHaveBeenCalled();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  it("surfaces a failed rejection without dropping the list", async () => {
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedRejectSkillSuggestion.mockRejectedValue(new Error("boom"));

    renderView();

    fireEvent.click(await screen.findByRole("button", { name: "Reject" }));
    const dialog = await screen.findByRole("dialog", { name: "Reject this suggestion?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Reject" }));

    expect(await screen.findByText("Unable to reject the suggestion")).toBeInTheDocument();
    expect(screen.getByText("Rust")).toBeInTheDocument();
  });

  it("opens the review dialog and approves with a chosen category", async () => {
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedApproveSkillSuggestion.mockResolvedValue(undefined);

    renderView();

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
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedLinkSkillSuggestion.mockResolvedValue(undefined);

    renderView();

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
    mockedListSkillSuggestions.mockResolvedValue([suggestion]);
    mockedApproveSkillSuggestion.mockRejectedValue(new Error("boom"));

    renderView();

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
