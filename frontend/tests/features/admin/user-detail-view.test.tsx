import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const replaceMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/admin/users/user-2",
}));

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getUserDetail: vi.fn(),
    getAdminUserProfile: vi.fn(),
    getUserNormalizedProfile: vi.fn(),
    updateUserStatus: vi.fn(),
  };
});

import {
  getAdminUserProfile,
  getUserDetail,
  getUserNormalizedProfile,
  updateUserStatus,
} from "@/lib/api/admin.api";
import { UserDetailView } from "@/features/admin/user-detail-view";
import { SHEET_HALF_PAD } from "@/features/admin/normalized/normalized-shared";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";
import type { AdminNormalizedProfile, AdminUserDetail } from "@/types/admin";
import type { CandidateProfile } from "@/types/candidate";
import type { NormalizedCandidateProfile } from "@/types/normalized";

const mockedGetUserDetail = vi.mocked(getUserDetail);
const mockedGetAdminUserProfile = vi.mocked(getAdminUserProfile);
const mockedGetUserNormalizedProfile = vi.mocked(getUserNormalizedProfile);
const mockedUpdateUserStatus = vi.mocked(updateUserStatus);

const sessionUser: AuthUser = {
  id: "admin-1",
  email: "admin@linqorbit.local",
  firstName: "Platform",
  lastName: "Admin",
  roles: [ROLE.ADMIN],
  sex: null,
  phone: null,
  homeCountry: null,
  currentCity: null,
  currentCountry: null,
};

const account: AdminUserDetail = {
  id: "user-2",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "ACTIVE",
  roles: [],
  phone: "+33 6 00 00 00 00",
  sex: "female",
  homeCountry: "FR",
  currentCity: "Paris",
  currentCountry: "FR",
  createdAt: "2026-09-01T10:00:00",
  hasCandidateProfile: true,
  hasRecruiterProfile: false,
};

const normalized: AdminNormalizedProfile<NormalizedCandidateProfile> = {
  profileId: "profile-1",
  version: 2,
  schemaVersion: "2.0",
  validatedAt: "2026-10-10T12:00:00",
  jobStatus: "done",
  content: { title: "Mathematician", skills: [{ name: "Java" }] },
};

/** Profil candidat vide : sections en état vide, sans CTA d'édition côté admin. */
const emptyProfile: CandidateProfile = {
  about: {
    title: null,
    targetPosition: null,
    bio: null,
    yearsOfExperience: null,
    searchStatus: null,
  },
  experiences: [],
  projects: [],
  diplomas: [],
  skills: [],
  languages: [],
  links: [],
  completionPercentage: 0,
  hasUnvalidatedChanges: false,
  normalizationFailed: false,
  normalizationInProgress: false,
  analysisOutdated: false,
};

const profileWithExperience: CandidateProfile = {
  ...emptyProfile,
  experiences: [
    {
      id: "xp-1",
      positionTitle: "Staff Engineer",
      description: "Led the platform team.",
      startDate: "2022-01-01",
      endDate: null,
      companyName: "Acme Corp",
      companyCountry: "FR",
    },
  ],
  completionPercentage: 45,
};

function axiosErrorWithStatus(status: number): Error {
  const error = new Error(`Request failed with status code ${status}`);
  Object.assign(error, { isAxiosError: true, response: { status } });
  return error;
}

function renderUserDetail(userId = "user-2") {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <UserDetailView userId={userId} />
    </QueryClientProvider>,
  );
}

describe("UserDetailView", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAuthStore.getState().clearAuth();
    useAuthStore.getState().setAuth({ token: "jwt-token", user: sessionUser });
    mockedGetAdminUserProfile.mockResolvedValue(emptyProfile);
  });

  afterEach(() => {
    window.history.replaceState({}, "", "/");
  });

  it("shows the full account identity with role badges and no hash", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    renderUserDetail();

    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    // Email : en-tête de page + section Personal Information (profil candidat).
    expect(screen.getAllByText("ada@example.com").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Active")).toHaveLength(1);
    expect(screen.getByText("Candidate")).toBeInTheDocument();

    // Breadcrumb à trois niveaux : Administration / Accounts / {nom}.
    const breadcrumb = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(within(breadcrumb).getByRole("link", { name: "Administration" })).toHaveAttribute(
      "href",
      "/admin",
    );
    expect(within(breadcrumb).getByRole("link", { name: "Accounts" })).toHaveAttribute(
      "href",
      "/admin/accounts",
    );
    expect(within(breadcrumb).getByText("Ada Lovelace")).toBeInTheDocument();

    const accountDetails = screen
      .getByRole("heading", { name: "Account details" })
      .closest("section");
    expect(accountDetails).not.toBeNull();
    const card = accountDetails as HTMLElement;
    expect(within(card).getByText("+33 6 00 00 00 00")).toBeInTheDocument();
    expect(within(card).getByText("Female")).toBeInTheDocument();
    // Codes ISO → libellés lisibles (Home country + Current location).
    expect(within(card).getByText("France")).toBeInTheDocument();
    expect(within(card).getByText("Paris, France")).toBeInTheDocument();
    expect(within(card).getByText("2026-09-01")).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/password/i);
  });

  it("deactivates the account through the API", async () => {
    mockedGetUserDetail
      .mockResolvedValueOnce(account)
      .mockResolvedValueOnce({ ...account, status: "INACTIVE" });
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);
    mockedUpdateUserStatus.mockResolvedValue(undefined);

    renderUserDetail();

    fireEvent.click(await screen.findByRole("button", { name: "Deactivate" }));

    await waitFor(() =>
      expect(mockedUpdateUserStatus).toHaveBeenCalledWith("user-2", "INACTIVE"),
    );
  });

  it("refuses to toggle the current session's own account", async () => {
    mockedGetUserDetail.mockResolvedValue({
      ...account,
      id: sessionUser.id,
      email: sessionUser.email,
    });
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    renderUserDetail(sessionUser.id);

    await screen.findByRole("heading", { name: "Ada Lovelace" });
    // Bascule remontée dans l'en-tête : ligne du compte courant sans action.
    expect(screen.getByText("Your account")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("opens the normalized sheet drawer from the CTA card", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    const { container } = renderUserDetail();

    expect(
      await screen.findByRole("heading", { name: "Normalized sheet" }),
    ).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("Schema")).toBeInTheDocument();
    expect(screen.getByText("2.0")).toBeInTheDocument();
    // Le rendu complet vit dans le drawer, pas inline.
    expect(screen.queryByText("Mathematician")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open sheet" }));

    expect(
      await screen.findByRole("dialog", { name: "Normalized sheet" }),
    ).toBeInTheDocument();
    expect(await screen.findByText("Mathematician")).toBeInTheDocument();
    // Drawer ouvert : la source se réduit (jamais recouverte) mais reste
    // une section par ligne — jamais de grille 2 colonnes.
    expect(container.querySelector('[class*="@2xl:grid-cols-2"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass(SHEET_HALF_PAD);
    expect(replaceMock).toHaveBeenCalledWith("/admin/users/user-2?sheet=open", {
      scroll: false,
    });
  });

  it("reopens the drawer from the ?sheet=open deep link", async () => {
    window.history.replaceState({}, "", "/admin/users/user-2?sheet=open");
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    const { container } = renderUserDetail();

    const dialog = await screen.findByRole("dialog", { name: "Normalized sheet" });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("v2")).toBeInTheDocument();
    expect(container.querySelector('[class*="@2xl:grid-cols-2"]')).toBeNull();
    expect(container.firstElementChild).toHaveClass(SHEET_HALF_PAD);
  });

  it("explains a never-validated profile without offering a retry", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockRejectedValue(axiosErrorWithStatus(404));

    renderUserDetail();

    expect(
      await screen.findByText(/No normalized profile has been produced yet/),
    ).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
  });

  it("surfaces a normalized load error with a retry", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockRejectedValue(new Error("boom"));

    renderUserDetail();

    expect(
      await screen.findByText("Unable to load the normalized profile"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("mentions the absence of a candidate profile", async () => {
    mockedGetUserDetail.mockResolvedValue({ ...account, hasCandidateProfile: false });

    renderUserDetail();

    expect(
      await screen.findByText(/has no candidate profile/),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Professional profile" }),
    ).not.toBeInTheDocument();
  });

  it("renders the candidate professional profile in read-only mode", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetAdminUserProfile.mockResolvedValue(profileWithExperience);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    const { container } = renderUserDetail();

    expect(
      await screen.findByRole("heading", { name: "Professional profile" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Read-only — the candidate's own profile view."),
    ).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Experience" })).toBeInTheDocument();
    // Drawer fermé : pile pleine largeur, pas de grille compacte ni de réduction.
    expect(container.querySelector('[class*="@2xl:grid-cols-2"]')).toBeNull();
    expect(container.firstElementChild).not.toHaveClass(SHEET_HALF_PAD);
    // CTA remonté juste au-dessus de « Personal Information ».
    const ctaHeading = screen.getByRole("heading", { name: "Normalized sheet" });
    const personalInfo = screen.getByRole("heading", { name: "Personal Information" });
    expect(
      personalInfo.compareDocumentPosition(ctaHeading) & Node.DOCUMENT_POSITION_PRECEDING,
    ).toBeTruthy();
    expect(screen.getByText("Staff Engineer")).toBeInTheDocument();
    // Nom d'entreprise partagé avec le pays dans le même paragraphe (" · France").
    expect(screen.getByText(/Acme Corp/)).toBeInTheDocument();
    expect(screen.getByText("Led the platform team.")).toBeInTheDocument();
    // Jamais de lien vers l'édition du profil candidat depuis la console.
    expect(screen.queryByRole("link", { name: "Add experience" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Edit profile" })).not.toBeInTheDocument();
  });

  it("shows empty sections without edit CTAs when the profile has no content", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetAdminUserProfile.mockResolvedValue(emptyProfile);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    renderUserDetail();

    expect(await screen.findByText(/No experience added yet/)).toBeInTheDocument();
    expect(screen.getByText(/No skill added yet/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add experience" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Add skills" })).not.toBeInTheDocument();
  });

  it("surfaces a professional profile load error with a retry", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetAdminUserProfile.mockRejectedValue(new Error("boom"));
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    renderUserDetail();

    expect(
      await screen.findByText("Unable to load the professional profile"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("shows an error with a retry when the account fails to load", async () => {
    mockedGetUserDetail.mockRejectedValue(new Error("boom"));

    renderUserDetail();

    expect(await screen.findByText("Unable to load the account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
