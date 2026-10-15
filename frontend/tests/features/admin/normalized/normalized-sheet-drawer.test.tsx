import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("@/lib/api/admin.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/admin.api")>();
  return {
    ...actual,
    getUserDetail: vi.fn(),
    getUserNormalizedProfile: vi.fn(),
    getUserNormalizedProfileVersions: vi.fn(),
  };
});

import {
  getUserDetail,
  getUserNormalizedProfile,
} from "@/lib/api/admin.api";
import { NormalizedSheetDrawer } from "@/features/admin/normalized/normalized-sheet-drawer";
import { SHEET_HALF_WIDTH } from "@/features/admin/normalized/normalized-shared";
import type { AdminNormalizedProfile, AdminUserDetail } from "@/types/admin";
import type { NormalizedCandidateProfile } from "@/types/normalized";

const mockedGetUserDetail = vi.mocked(getUserDetail);
const mockedGetUserNormalizedProfile = vi.mocked(getUserNormalizedProfile);

const account: AdminUserDetail = {
  id: "user-2",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  status: "ACTIVE",
  roles: [],
  phone: null,
  sex: null,
  homeCountry: null,
  currentCity: null,
  currentCountry: null,
  createdAt: "2026-09-01T10:00:00",
  hasCandidateProfile: true,
  hasRecruiterProfile: false,
};

const currentProfile: AdminNormalizedProfile<NormalizedCandidateProfile> = {
  profileId: "np-3",
  version: 3,
  schemaVersion: "2.0",
  validatedAt: "2026-10-12T12:00:00",
  jobStatus: "done",
  content: { title: "Senior Mathematician" },
};

function renderDrawer(onClose = vi.fn()) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <NormalizedSheetDrawer
        kind="user"
        id="user-2"
        entityLabel="Ada Lovelace"
        onClose={onClose}
      />
    </QueryClientProvider>,
  );
  return { ...result, onClose };
}

describe("NormalizedSheetDrawer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders a dialog titled after the sheet with the entity name and the full content", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(currentProfile);

    renderDrawer();

    const dialog = await screen.findByRole("dialog", { name: "Normalized sheet" });
    expect(dialog).toBeInTheDocument();
    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument();
    expect(await screen.findByText("Senior Mathematician")).toBeInTheDocument();
    // Rien n'est retiré de l'ancienne page dédiée.
    expect(screen.getByRole("button", { name: "Copy JSON" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "History" })).toBeInTheDocument();
  });

  it("closes on Escape and on the close button", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(currentProfile);

    const { onClose } = renderDrawer();
    await screen.findByRole("dialog", { name: "Normalized sheet" });

    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("sizes the panel to half the content area outside the sidenav", async () => {
    mockedGetUserDetail.mockResolvedValue(account);
    mockedGetUserNormalizedProfile.mockResolvedValue(currentProfile);

    renderDrawer();

    const dialog = await screen.findByRole("dialog", { name: "Normalized sheet" });
    // 50 % du contenu hors sidenav (var --sidenav-w posée sur <html> par
    // AdminShell), plancher 560 px — plus de borne fixe en px dans le ui/.
    expect(dialog).toHaveClass(SHEET_HALF_WIDTH);
    expect(dialog).toHaveClass("lg:rounded-l-2xl");
    expect(dialog).not.toHaveClass("lg:w-[50vw]");
    expect(dialog).not.toHaveClass("lg:max-w-[840px]");
  });

  it("surfaces a detail load error inside the drawer", async () => {
    mockedGetUserDetail.mockRejectedValue(new Error("boom"));

    renderDrawer();

    expect(await screen.findByText("Unable to load the element")).toBeInTheDocument();
  });
});
