import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getUserDetail: vi.fn(),
    getUserNormalizedProfile: vi.fn(),
    updateUserStatus: vi.fn(),
  };
});

import {
  getUserDetail,
  getUserNormalizedProfile,
  updateUserStatus,
} from "@/lib/api/admin.api";
import { UserDetailView } from "@/features/admin/user-detail-view";
import { ROLE } from "@/lib/utils/roles";
import { useAuthStore } from "@/stores/auth-store";
import type { AuthUser } from "@/types/auth";
import type { AdminNormalizedProfile, AdminUserDetail } from "@/types/admin";
import type { NormalizedCandidateProfile } from "@/types/normalized";

const mockedGetUserDetail = vi.mocked(getUserDetail);
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
  });

  it("shows the full account identity with role badges and no hash", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    renderUserDetail();

    expect(await screen.findByRole("heading", { name: "Ada Lovelace" })).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
    expect(screen.getAllByText("Active")).toHaveLength(1);
    expect(screen.getByText("Candidate")).toBeInTheDocument();
    expect(screen.getByText("+33 6 00 00 00 00")).toBeInTheDocument();
    expect(screen.getByText("female")).toBeInTheDocument();
    expect(screen.getByText("FR")).toBeInTheDocument();
    expect(screen.getByText("Paris, FR")).toBeInTheDocument();
    expect(screen.getByText("2026-09-01")).toBeInTheDocument();
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
    expect(screen.getByText(/This is your own account/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Deactivate" })).not.toBeInTheDocument();
  });

  it("renders the normalized candidate sheet when it exists", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(normalized);

    renderUserDetail();

    expect(await screen.findByText("Mathematician")).toBeInTheDocument();
    expect(screen.getByText("v2")).toBeInTheDocument();
    expect(screen.getByText("schema 2.0")).toBeInTheDocument();
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
  });

  it("shows an error with a retry when the account fails to load", async () => {
    mockedGetUserDetail.mockRejectedValue(new Error("boom"));

    renderUserDetail();

    expect(await screen.findByText("Unable to load the account")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });
});
