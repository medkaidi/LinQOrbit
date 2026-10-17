import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

import { ApplyView } from "@/features/application/apply-view";
import { getApplicationContext } from "@/lib/api/application.api";
import { listCvs } from "@/lib/api/candidate.api";
import { buildApplicationContext, buildCvAttachment } from "@/tests/helpers/application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock("@/lib/api/application.api", () => ({
  getApplicationContext: vi.fn(),
  submitApplication: vi.fn(),
  listMyApplications: vi.fn(),
  withdrawApplication: vi.fn(),
}));

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, listCvs: vi.fn() };
});

const getContextMock = vi.mocked(getApplicationContext);
const listCvsMock = vi.mocked(listCvs);

describe("ApplyView", () => {
  beforeEach(() => {
    getContextMock.mockReset();
    listCvsMock.mockReset();
    listCvsMock.mockResolvedValue([buildCvAttachment()]);
  });

  it("rejects a malformed job param without calling the API", () => {
    renderWithQueryClient(<ApplyView jobParam="nope" />);

    expect(screen.getByRole("heading", { name: "Job not found" })).toBeInTheDocument();
    expect(getContextMock).not.toHaveBeenCalled();
  });

  it("shows the not-found state when the offer is no longer available", async () => {
    getContextMock.mockRejectedValue(new Error("404"));

    renderWithQueryClient(<ApplyView jobParam="abcdefghijkl-backend-engineer" />);

    expect(await screen.findByRole("heading", { name: "Job not found" })).toBeInTheDocument();
  });

  it("switches to the already-applied state when the candidate has an application", async () => {
    getContextMock.mockResolvedValue(
      buildApplicationContext({
        existingApplication: {
          id: "app-1",
          status: "submitted",
          createdAt: "2026-10-10T09:30:00",
        },
      }),
    );

    renderWithQueryClient(<ApplyView jobParam="abcdefghijkl-backend-engineer" />);

    expect(await screen.findByText(/You have already applied to this job offer/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View my applications" })).toHaveAttribute(
      "href",
      "/applications",
    );
    expect(screen.queryByRole("button", { name: "Submit application" })).not.toBeInTheDocument();
  });

  it("renders the application form with the offer and its questions", async () => {
    getContextMock.mockResolvedValue(buildApplicationContext());

    renderWithQueryClient(<ApplyView jobParam="abcdefghijkl-backend-engineer" />);

    expect(
      await screen.findByRole("heading", { name: "Backend Engineer" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nimbus Labs")).toBeInTheDocument();
    expect(screen.getByLabelText("Why this role? *")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit application" })).toBeInTheDocument();
  });
});
