import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import {
  deleteCv,
  downloadCv,
  listCvs,
  setCurrentCv,
  uploadCv,
} from "@/lib/api/candidate.api";
import type { CvAttachment } from "@/types/candidate";
import { CvSection } from "@/features/candidate/cv-section";

vi.mock("@/lib/api/candidate.api", () => ({
  listCvs: vi.fn(),
  uploadCv: vi.fn(),
  setCurrentCv: vi.fn(),
  deleteCv: vi.fn(),
  downloadCv: vi.fn(),
}));

const mockedListCvs = vi.mocked(listCvs);
const mockedUploadCv = vi.mocked(uploadCv);
const mockedSetCurrentCv = vi.mocked(setCurrentCv);
const mockedDeleteCv = vi.mocked(deleteCv);
const mockedDownloadCv = vi.mocked(downloadCv);

const currentCv: CvAttachment = {
  id: "a1",
  originalName: "cv-2026.pdf",
  mimeType: "application/pdf",
  sizeBytes: 240_000,
  sha256: "a".repeat(64),
  createdAt: "2026-10-10T09:00:00",
  current: true,
};

const otherCv: CvAttachment = {
  id: "a2",
  originalName: "cv-old.pdf",
  mimeType: "application/pdf",
  sizeBytes: 180_000,
  sha256: "b".repeat(64),
  createdAt: "2026-09-01T09:00:00",
  current: false,
};

function renderSection() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <CvSection />
    </QueryClientProvider>,
  );
}

describe("CvSection", () => {
  beforeEach(() => {
    mockedListCvs.mockReset();
    mockedUploadCv.mockReset();
    mockedSetCurrentCv.mockReset();
    mockedDeleteCv.mockReset();
    mockedDownloadCv.mockReset();
  });

  it("shows the empty state when no CV is stored", async () => {
    mockedListCvs.mockResolvedValue([]);

    renderSection();

    expect(
      await screen.findByText(
        "No CV uploaded yet. Your current CV is the one attached to your applications.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Upload CV" })).toBeInTheDocument();
  });

  it("lists the CVs, badges the current one and offers the switch on the others", async () => {
    mockedListCvs.mockResolvedValue([currentCv, otherCv]);

    renderSection();

    expect(await screen.findByText("cv-2026.pdf")).toBeInTheDocument();
    expect(screen.getByText("cv-old.pdf")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
    expect(screen.getByText("2 files")).toBeInTheDocument();
    // Une seule bascule : le CV courant n'en a pas.
    expect(screen.getByRole("button", { name: "Set as current" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Download" })).toHaveLength(2);
  });

  it("uploads a picked PDF and refreshes the list", async () => {
    const uploaded: CvAttachment = {
      id: "a3",
      originalName: "brand-new.pdf",
      mimeType: "application/pdf",
      sizeBytes: 300_000,
      sha256: "c".repeat(64),
      createdAt: "2026-10-16T09:00:00",
      current: true,
    };
    mockedListCvs.mockResolvedValueOnce([]).mockResolvedValueOnce([uploaded]);
    mockedUploadCv.mockResolvedValue(uploaded);

    const { container } = renderSection();

    await screen.findByRole("button", { name: "Upload CV" });
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(["%PDF-1.4"], "brand-new.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => expect(mockedUploadCv).toHaveBeenCalledWith(file));
    expect(await screen.findByText("brand-new.pdf")).toBeInTheDocument();
  });

  it("switches the current CV through the backend and moves the badge", async () => {
    const switched = [
      { ...currentCv, current: false },
      { ...otherCv, current: true },
    ];
    mockedListCvs.mockResolvedValueOnce([currentCv, otherCv]).mockResolvedValueOnce(switched);
    mockedSetCurrentCv.mockResolvedValue(undefined);

    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Set as current" }));

    await waitFor(() => expect(mockedSetCurrentCv).toHaveBeenCalledWith("a2"));
    await waitFor(() =>
      expect(screen.getByText("cv-old.pdf").closest("li")).toHaveTextContent("Current"),
    );
  });

  it("deletes a CV only after the confirmation dialog", async () => {
    mockedListCvs.mockResolvedValueOnce([currentCv, otherCv]).mockResolvedValueOnce([otherCv]);
    mockedDeleteCv.mockResolvedValue(undefined);

    renderSection();

    fireEvent.click((await screen.findAllByRole("button", { name: "Remove" }))[0]);

    expect(screen.getByText("Delete this CV?")).toBeInTheDocument();
    expect(
      screen.getByText('"cv-2026.pdf" will be permanently deleted. This cannot be undone.'),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(mockedDeleteCv).toHaveBeenCalledWith("a1"));
    await waitFor(() => expect(screen.queryByText("Delete this CV?")).not.toBeInTheDocument());
    await waitFor(() => expect(screen.queryByText("cv-2026.pdf")).not.toBeInTheDocument());
  });

  it("downloads the CV file by id and name", async () => {
    mockedListCvs.mockResolvedValue([currentCv]);
    mockedDownloadCv.mockResolvedValue(undefined);

    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Download" }));

    await waitFor(() =>
      expect(mockedDownloadCv).toHaveBeenCalledWith("a1", "cv-2026.pdf"),
    );
  });

  it("shows the backend detail when an action fails", async () => {
    mockedListCvs.mockResolvedValue([currentCv, otherCv]);
    mockedSetCurrentCv.mockRejectedValue(
      Object.assign(new Error("request failed"), {
        isAxiosError: true,
        response: { data: { detail: "No attachment matches this identifier for your account." } },
      }),
    );

    renderSection();

    fireEvent.click(await screen.findByRole("button", { name: "Set as current" }));

    expect(
      await screen.findByText("No attachment matches this identifier for your account."),
    ).toBeInTheDocument();
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });
});
