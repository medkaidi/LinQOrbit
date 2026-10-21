import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  decideRecruiterApplication,
  discardApplication,
  downloadRecruiterApplicationCv,
  getApplicationContext,
  getRecruiterApplication,
  listMyApplications,
  listRecruiterApplications,
  saveApplicationDraft,
  submitApplication,
  withdrawApplication,
} from "@/lib/api/application.api";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock("@/lib/utils/download", () => ({
  saveBlob: vi.fn(),
}));

import { api } from "@/lib/api/axios";
import { saveBlob } from "@/lib/utils/download";

const getMock = vi.mocked(api.get);
const putMock = vi.mocked(api.put);
const postMock = vi.mocked(api.post);
const deleteMock = vi.mocked(api.delete);

describe("application.api", () => {
  beforeEach(() => {
    getMock.mockReset();
    putMock.mockReset();
    postMock.mockReset();
    deleteMock.mockReset();
    vi.mocked(saveBlob).mockReset();
  });

  it("reads the journey context of an offer", async () => {
    getMock.mockResolvedValue({ data: { step: "matching" } });

    expect(await getApplicationContext("abcdefghijkl")).toEqual({ step: "matching" });
    expect(getMock).toHaveBeenCalledWith("/api/v1/applications/context/abcdefghijkl");
  });

  it("saves the draft with PUT, answers included even when empty", async () => {
    putMock.mockResolvedValue({ data: { status: "draft" } });

    await saveApplicationDraft({ jobPublicId: "abcdefghijkl", answers: [] });

    expect(putMock).toHaveBeenCalledWith("/api/v1/applications/draft", {
      jobPublicId: "abcdefghijkl",
      answers: [],
    });
  });

  it("submits a draft with or without a chosen CV", async () => {
    postMock.mockResolvedValue({ data: { status: "submitted" } });

    await submitApplication("app-1");
    expect(postMock).toHaveBeenLastCalledWith("/api/v1/applications/app-1/submit", {});

    await submitApplication("app-1", { cvAttachmentId: "cv-2" });
    expect(postMock).toHaveBeenLastCalledWith("/api/v1/applications/app-1/submit", { cvAttachmentId: "cv-2" });
  });

  it("discards a draft with DELETE, lists mine and withdraws", async () => {
    deleteMock.mockResolvedValue({ data: undefined });
    getMock.mockResolvedValue({ data: [] });
    postMock.mockResolvedValue({ data: undefined });

    await discardApplication("app-1");
    expect(deleteMock).toHaveBeenCalledWith("/api/v1/applications/app-1");
    expect(await listMyApplications()).toEqual([]);
    expect(getMock).toHaveBeenCalledWith("/api/v1/applications/mine");
    await withdrawApplication("app-1");
    expect(postMock).toHaveBeenCalledWith("/api/v1/applications/app-1/withdraw");
  });

  it("lists recruiter applications with optional filters and never sends a page size", async () => {
    getMock.mockResolvedValue({ data: { items: [], total: 0 } });

    await listRecruiterApplications("offer-1");
    expect(getMock).toHaveBeenLastCalledWith("/api/v1/job-offers/offer-1/applications", {
      params: {},
      signal: undefined,
    });

    await listRecruiterApplications("offer-1", {
      status: "accepted",
      sort: "requiredSkills",
      direction: "desc",
      page: 2,
    });
    expect(getMock).toHaveBeenLastCalledWith("/api/v1/job-offers/offer-1/applications", {
      params: { status: "accepted", sort: "requiredSkills", direction: "desc", page: 2 },
      signal: undefined,
    });
  });

  it("reads recruiter detail, downloads the pinned CV and records a decision", async () => {
    const blob = new Blob(["pdf"], { type: "application/pdf" });
    getMock.mockResolvedValue({ data: { id: "app-1" } });
    postMock.mockResolvedValue({ data: undefined });

    expect(await getRecruiterApplication("offer-1", "app-1")).toEqual({ id: "app-1" });
    expect(getMock).toHaveBeenLastCalledWith("/api/v1/job-offers/offer-1/applications/app-1");

    getMock.mockResolvedValue({ data: blob });
    await downloadRecruiterApplicationCv("offer-1", "app-1", "grace-cv.pdf");
    expect(getMock).toHaveBeenLastCalledWith(
      "/api/v1/job-offers/offer-1/applications/app-1/cv",
      { responseType: "blob" },
    );
    expect(saveBlob).toHaveBeenCalledWith(blob, "grace-cv.pdf");

    await decideRecruiterApplication("offer-1", "app-1", "rejected");
    expect(postMock).toHaveBeenCalledWith(
      "/api/v1/job-offers/offer-1/applications/app-1/decision",
      { decision: "rejected" },
    );
  });
});
