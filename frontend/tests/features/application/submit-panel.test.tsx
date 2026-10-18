import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

import { SubmitPanel } from "@/features/application/submit-panel";
import { discardApplication, submitApplication } from "@/lib/api/application.api";
import { listCvs } from "@/lib/api/candidate.api";
import {
  buildApplication,
  buildApplicationContext,
  buildCvAttachment,
  CV_ID,
} from "@/tests/helpers/application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/lib/api/application.api", () => ({
  getApplicationContext: vi.fn(),
  saveApplicationDraft: vi.fn(),
  submitApplication: vi.fn(),
  discardApplication: vi.fn(),
  listMyApplications: vi.fn(),
  withdrawApplication: vi.fn(),
}));

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, listCvs: vi.fn() };
});

const submitMock = vi.mocked(submitApplication);
const discardMock = vi.mocked(discardApplication);
const listCvsMock = vi.mocked(listCvs);
const APPLICATION_ID = "99999999-9999-4999-8999-999999999999";
const OTHER_CV_ID = "22222222-2222-4222-8222-222222222222";

function draftContext(cvAttachmentId: string | null = CV_ID) {
  return buildApplicationContext({
    existingApplication: { id: APPLICATION_ID, status: "draft", cvAttachmentId, createdAt: "2026-10-17T10:00:00" },
    step: "matching",
    canSubmit: true,
  });
}

async function renderPanel(context = draftContext()) {
  renderWithQueryClient(<SubmitPanel context={context} applicationId={APPLICATION_ID} />);
  const button = await screen.findByRole("button", { name: "Submit application" });
  await waitFor(() => expect(button).toBeEnabled());
  return button;
}

describe("SubmitPanel", () => {
  beforeEach(() => {
    submitMock.mockReset();
    discardMock.mockReset();
    listCvsMock.mockReset();
    pushMock.mockClear();
    listCvsMock.mockResolvedValue([buildCvAttachment()]);
  });

  it("submits with the draft CV and redirects to My applications", async () => {
    submitMock.mockResolvedValue(buildApplication());
    const button = await renderPanel();

    fireEvent.click(button);

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(APPLICATION_ID, { cvAttachmentId: CV_ID }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/applications"));
  });

  it("submits the CV picked by the candidate", async () => {
    listCvsMock.mockResolvedValue([
      buildCvAttachment(),
      buildCvAttachment({ id: OTHER_CV_ID, originalName: "older-cv.pdf", current: false }),
    ]);
    submitMock.mockResolvedValue(buildApplication());
    const button = await renderPanel(draftContext(null));

    fireEvent.click(screen.getByRole("combobox", { name: "CV to attach" }));
    fireEvent.click(screen.getByRole("option", { name: "older-cv.pdf" }));
    fireEvent.click(button);

    await waitFor(() =>
      expect(submitMock).toHaveBeenCalledWith(APPLICATION_ID, { cvAttachmentId: OTHER_CV_ID }),
    );
  });

  it("requires a CV before the application can be submitted", async () => {
    listCvsMock.mockResolvedValue([]);
    renderWithQueryClient(<SubmitPanel context={draftContext(null)} applicationId={APPLICATION_ID} />);

    expect(await screen.findByText("A CV is required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "go to your profile" })).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });

  it("shows the server detail when the submission is rejected", async () => {
    submitMock.mockRejectedValue(
      Object.assign(new Error("closed"), {
        isAxiosError: true,
        response: { status: 404, data: { detail: "This job offer is no longer available." } },
      }),
    );
    const button = await renderPanel();

    fireEvent.click(button);

    expect(await screen.findByText("Submission failed")).toBeInTheDocument();
    expect(screen.getByText("This job offer is no longer available.")).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("discards the draft only after confirmation", async () => {
    discardMock.mockResolvedValue(undefined);
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Discard application" }));
    const dialog = screen.getByRole("dialog", { name: "Discard this application?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(discardMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard application" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(discardMock).toHaveBeenCalledWith(APPLICATION_ID));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
