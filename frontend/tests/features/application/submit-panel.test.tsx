import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

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
const ensureDraftMock = vi.fn<() => Promise<string>>();

function draftContext(cvAttachmentId: string | null = CV_ID) {
  return buildApplicationContext({
    existingApplication: { id: APPLICATION_ID, status: "draft", cvAttachmentId, createdAt: "2026-10-17T10:00:00" },
    step: "matching",
    canSubmit: true,
  });
}

async function renderPanel(context = draftContext()) {
  renderWithQueryClient(<SubmitPanel context={context} applicationId={APPLICATION_ID} ensureDraft={ensureDraftMock} />);
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
    ensureDraftMock.mockReset();
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
    renderWithQueryClient(<SubmitPanel context={draftContext(null)} applicationId={APPLICATION_ID} ensureDraft={ensureDraftMock} />);

    expect(await screen.findByText("A CV is required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "go to your profile" })).toHaveAttribute("href", "/profile/edit");
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });

  it("blocks submission while the assessment review has unsaved changes", async () => {
    renderWithQueryClient(
      <SubmitPanel
        context={draftContext()}
        applicationId={APPLICATION_ID}
        ensureDraft={ensureDraftMock}
        assessmentDirty
      />,
    );

    expect(await screen.findByText("Unsaved assessment changes")).toBeInTheDocument();
    expect(screen.getByText(/Save or discard your changes/)).toBeInTheDocument();
    const button = screen.getByRole("button", { name: "Submit application" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-describedby", "assessment-dirty-message");
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
  it("creates the draft first when the offer had none yet, then submits it", async () => {
    ensureDraftMock.mockResolvedValue(APPLICATION_ID);
    submitMock.mockResolvedValue(buildApplication());
    const context = buildApplicationContext({ questions: [], existingApplication: null, step: "matching", canSubmit: true });
    renderWithQueryClient(<SubmitPanel context={context} applicationId={null} ensureDraft={ensureDraftMock} />);
    const button = await screen.findByRole("button", { name: "Submit application" });
    await waitFor(() => expect(button).toBeEnabled());
    // Rien à abandonner tant qu'aucun brouillon n'existe.
    expect(screen.queryByRole("button", { name: "Discard application" })).not.toBeInTheDocument();

    fireEvent.click(button);

    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(APPLICATION_ID, { cvAttachmentId: CV_ID }));
    expect(ensureDraftMock).toHaveBeenCalledTimes(1);
  });

  it("never submits when the draft cannot be created", async () => {
    ensureDraftMock.mockRejectedValue(
      Object.assign(new Error("closed"), {
        isAxiosError: true,
        response: { status: 404, data: { detail: "This job offer is no longer available." } },
      }),
    );
    const context = buildApplicationContext({ questions: [], existingApplication: null, step: "matching", canSubmit: true });
    renderWithQueryClient(<SubmitPanel context={context} applicationId={null} ensureDraft={ensureDraftMock} />);
    const button = await screen.findByRole("button", { name: "Submit application" });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    expect(await screen.findByText("This job offer is no longer available.")).toBeInTheDocument();
    expect(submitMock).not.toHaveBeenCalled();
  });

  it("waits for the CVs before allowing the submission", () => {
    listCvsMock.mockReturnValue(new Promise(() => {}));
    renderWithQueryClient(<SubmitPanel context={draftContext()} applicationId={APPLICATION_ID} ensureDraft={ensureDraftMock} />);

    expect(screen.getByText("Loading your CVs…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit application" })).toBeDisabled();
  });

  it("tells when the CVs cannot be loaded", async () => {
    listCvsMock.mockRejectedValue(new Error("network"));
    // Sans les nouvelles tentatives par défaut (≈ 7 s) : seul l'état d'erreur compte ici.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <SubmitPanel context={draftContext()} applicationId={APPLICATION_ID} ensureDraft={ensureDraftMock} />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Could not load your CVs")).toBeInTheDocument();
  });

  it("preselects the current CV, else the first one, when the draft has none", async () => {
    listCvsMock.mockResolvedValue([
      buildCvAttachment({ id: OTHER_CV_ID, originalName: "older-cv.pdf", current: false }),
      buildCvAttachment(),
    ]);
    submitMock.mockResolvedValue(buildApplication());
    const context = buildApplicationContext({
      existingApplication: { id: APPLICATION_ID, status: "draft", cvAttachmentId: null, createdAt: "2026-10-17T10:00:00" },
      currentCvAttachmentId: null,
      step: "matching",
      canSubmit: true,
    });
    renderWithQueryClient(<SubmitPanel context={context} applicationId={APPLICATION_ID} ensureDraft={ensureDraftMock} />);
    const button = await screen.findByRole("button", { name: "Submit application" });
    await waitFor(() => expect(button).toBeEnabled());

    fireEvent.click(button);

    // Le CV marqué courant, même s'il n'est pas le premier de la liste.
    await waitFor(() => expect(submitMock).toHaveBeenCalledWith(APPLICATION_ID, { cvAttachmentId: CV_ID }));
  });

  it("closes the confirmation and shows the server detail when the discard fails", async () => {
    discardMock.mockRejectedValue(
      Object.assign(new Error("closed"), {
        isAxiosError: true,
        response: { status: 409, data: { detail: "You have already applied to this job offer." } },
      }),
    );
    await renderPanel();

    fireEvent.click(screen.getByRole("button", { name: "Discard application" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Discard" }));

    expect(await screen.findByText("Could not discard your application")).toBeInTheDocument();
    expect(screen.getByText("You have already applied to this job offer.")).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("locks Discard while the application is being sent", async () => {
    submitMock.mockReturnValue(new Promise(() => {}));
    const button = await renderPanel();

    fireEvent.click(button);

    await waitFor(() => expect(screen.getByRole("button", { name: "Discard application" })).toBeDisabled());
  });
});
