import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  discardApplication,
  getApplicationContext,
  listMyApplications,
  saveApplicationDraft,
  submitApplication,
  withdrawApplication,
} from "@/lib/api/application.api";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

import { api } from "@/lib/api/axios";

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
});
