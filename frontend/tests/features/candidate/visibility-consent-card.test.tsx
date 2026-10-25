import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AxiosError, type AxiosResponse } from "axios";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { VisibilityConsentCard } from "@/features/candidate/visibility-consent-card";
import { queryKeys } from "@/hooks/query-keys";
import { getVisibilityConsent, setVisibilityConsent } from "@/lib/api/candidate.api";

vi.mock("@/lib/api/candidate.api", () => ({
  getVisibilityConsent: vi.fn(),
  setVisibilityConsent: vi.fn(),
}));

const getMock = vi.mocked(getVisibilityConsent);
const setMock = vi.mocked(setVisibilityConsent);

function httpError(status: number, detail: string) {
  return new AxiosError("failed", "ERR_BAD_REQUEST", undefined, undefined, {
    status,
    data: { detail },
  } as AxiosResponse);
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const view = render(
    <QueryClientProvider client={client}>
      <VisibilityConsentCard />
    </QueryClientProvider>,
  );
  return { client, ...view };
}

describe("VisibilityConsentCard", () => {
  beforeEach(() => {
    getMock.mockReset();
    setMock.mockReset();
    getMock.mockResolvedValue({ consented: false, consentedAt: null });
  });

  it("is unchecked by default and says who sees what, what stays private and how to withdraw", async () => {
    renderCard();

    const checkbox = await screen.findByRole("checkbox", {
      name: "Let recruiters view my full profile and invite me to apply",
    });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByRole("heading", { name: "Visibility to recruiters" })).toBeInTheDocument();
    expect(screen.getByText(/including your name/)).toBeInTheDocument();
    expect(screen.getByText(/cannot see your email address or phone number/)).toBeInTheDocument();
    expect(screen.getByText(/withdraw at any time/)).toBeInTheDocument();
    expect(screen.getByText(/never suggested to recruiters/)).toBeInTheDocument();
    expect(screen.queryByText(/Shared since/)).not.toBeInTheDocument();
    expect(setMock).not.toHaveBeenCalled();
  });

  it("grants the consent when ticked and shows the date recorded by the server", async () => {
    setMock.mockResolvedValue({ consented: true, consentedAt: "2026-10-24T10:00:00" });

    renderCard();

    fireEvent.click(await screen.findByRole("checkbox"));

    await waitFor(() => expect(setMock).toHaveBeenCalledWith(true));
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    expect(screen.getByText("Shared since Oct 24, 2026")).toBeInTheDocument();
  });

  it("withdraws the consent when unticked", async () => {
    getMock.mockResolvedValue({ consented: true, consentedAt: "2026-10-24T10:00:00" });
    setMock.mockResolvedValue({ consented: false, consentedAt: null });

    renderCard();

    const checkbox = await screen.findByRole("checkbox");
    await waitFor(() => expect(checkbox).toBeChecked());
    fireEvent.click(checkbox);

    await waitFor(() => expect(setMock).toHaveBeenCalledWith(false));
    await waitFor(() => expect(screen.getByRole("checkbox")).not.toBeChecked());
    expect(screen.queryByText(/Shared since/)).not.toBeInTheDocument();
  });

  it("disables the checkbox while saving, so a double click cannot send twice", async () => {
    setMock.mockReturnValue(new Promise(() => {}));

    renderCard();

    fireEvent.click(await screen.findByRole("checkbox"));

    await waitFor(() => expect(screen.getByRole("checkbox")).toBeDisabled());
    expect(setMock).toHaveBeenCalledTimes(1);
  });

  it("keeps the previous state and shows the server message when saving fails", async () => {
    setMock.mockRejectedValue(
      httpError(409, "Add some information to your profile before sharing it with recruiters."),
    );

    renderCard();

    fireEvent.click(await screen.findByRole("checkbox"));

    expect(
      await screen.findByText("Add some information to your profile before sharing it with recruiters."),
    ).toBeInTheDocument();
    expect(screen.getByText("Could not save your choice")).toBeInTheDocument();
    expect(screen.getByRole("checkbox")).not.toBeChecked();
  });

  it("does not touch the profile cache: the consent is not a profile modification", async () => {
    setMock.mockResolvedValue({ consented: true, consentedAt: "2026-10-24T10:00:00" });
    const { client } = renderCard();
    const invalidate = vi.spyOn(client, "invalidateQueries");

    fireEvent.click(await screen.findByRole("checkbox"));

    await waitFor(() => expect(setMock).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole("checkbox")).toBeChecked());
    expect(invalidate).not.toHaveBeenCalled();
    expect(client.getQueryData(queryKeys.candidate.visibility)).toEqual({
      consented: true,
      consentedAt: "2026-10-24T10:00:00",
    });
  });

  it("offers a retry when the setting cannot be loaded, and hides the checkbox meanwhile", async () => {
    getMock.mockRejectedValueOnce(httpError(500, "boom"));

    renderCard();

    expect(await screen.findByText("Could not load your visibility setting")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("checkbox")).not.toBeChecked();
  });

  it("shows a loading state first", () => {
    getMock.mockReturnValue(new Promise(() => {}));

    renderCard();

    expect(screen.getByText("Loading…")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });
});
