import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { ApplicationsView } from "@/features/application/applications-view";
import { listMyApplications, withdrawApplication } from "@/lib/api/application.api";
import { buildApplication } from "@/tests/helpers/application-fixtures";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

vi.mock("@/lib/api/application.api", () => ({
  getApplicationContext: vi.fn(),
  submitApplication: vi.fn(),
  listMyApplications: vi.fn(),
  withdrawApplication: vi.fn(),
}));

const listMock = vi.mocked(listMyApplications);
const withdrawMock = vi.mocked(withdrawApplication);

describe("ApplicationsView", () => {
  beforeEach(() => {
    listMock.mockReset();
    withdrawMock.mockReset();
  });

  it("shows the empty state when the candidate has no application", async () => {
    listMock.mockResolvedValue([]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("You have not applied to any job offer yet.")).toBeInTheDocument();
    expect(screen.getByText("0 applications")).toBeInTheDocument();
  });

  it("renders compact cards with status, date, CV and answer count, answers collapsed", async () => {
    listMock.mockResolvedValue([
      buildApplication(),
      buildApplication({ id: "app-2", status: "withdrawn" }),
    ]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("2 applications")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Backend Engineer" })).toHaveLength(2);
    expect(screen.getAllByText("Nimbus Labs")).toHaveLength(2);
    expect(screen.getAllByText(/^Applied /)).toHaveLength(2);
    expect(screen.getAllByText("CV: ada-lovelace-cv.pdf")).toHaveLength(2);
    expect(screen.getAllByText("2 answers")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "View answers (2)" })).toHaveLength(2);
    // Les réponses ne sont plus dépliées par défaut : la carte reste compacte.
    expect(screen.queryByText("Why this role?")).not.toBeInTheDocument();
    expect(screen.queryByText("I love APIs")).not.toBeInTheDocument();
  });

  it("keeps every answer behind an accessible disclosure", async () => {
    listMock.mockResolvedValue([buildApplication()]);

    renderWithQueryClient(<ApplicationsView />);

    const toggle = await screen.findByRole("button", { name: "View answers (2)" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(toggle).toHaveAttribute(
      "aria-controls",
      "answers-99999999-9999-4999-8999-999999999999",
    );
    expect(screen.queryByText("Why this role?")).not.toBeInTheDocument();

    fireEvent.click(toggle);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("Why this role?")).toBeInTheDocument();
    expect(screen.getByText("I love APIs")).toBeInTheDocument();
    expect(screen.getByText("Preferred setup?")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
    const panel = document.getElementById("answers-99999999-9999-4999-8999-999999999999");
    expect(panel).not.toBeNull();
    expect(within(panel as HTMLElement).getAllByRole("definition")).toHaveLength(2);

    fireEvent.click(screen.getByRole("button", { name: "Hide answers" }));

    expect(screen.queryByText("Why this role?")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View answers (2)" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("offers to continue a draft (no CV yet) without a withdraw action", async () => {
    listMock.mockResolvedValue([
      buildApplication({ id: "draft-1", status: "draft", cv: null, answers: [] }),
    ]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("No CV yet")).toBeInTheDocument();
    expect(screen.getByText("0 answers")).toBeInTheDocument();
    expect(screen.getByText(/^Started /)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue application" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer/apply",
    );
    // Sans réponse, pas de bouton de disclosure ; un brouillon ne se retire pas.
    expect(screen.queryByRole("button", { name: /View answers/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("withdraws only after the confirmation dialog is accepted", async () => {
    listMock.mockResolvedValue([buildApplication()]);
    withdrawMock.mockResolvedValue(undefined);

    renderWithQueryClient(<ApplicationsView />);

    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    expect(withdrawMock).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog", { name: "Withdraw this application?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(withdrawMock).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    const confirmed = await screen.findByRole("dialog", { name: "Withdraw this application?" });
    fireEvent.click(within(confirmed).getByRole("button", { name: "Withdraw" }));

    await waitFor(() => expect(withdrawMock).toHaveBeenCalledWith("99999999-9999-4999-8999-999999999999"));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });

  it("shows the server detail when the withdrawal is rejected", async () => {
    listMock.mockResolvedValue([buildApplication()]);
    withdrawMock.mockRejectedValue(
      Object.assign(new Error("conflict"), {
        isAxiosError: true,
        response: {
          status: 409,
          data: { detail: "This application can no longer be withdrawn." },
        },
      }),
    );

    renderWithQueryClient(<ApplicationsView />);

    fireEvent.click(await screen.findByRole("button", { name: "Withdraw" }));
    const dialog = await screen.findByRole("dialog", { name: "Withdraw this application?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Withdraw" }));

    expect(await screen.findByText("Withdrawal failed")).toBeInTheDocument();
    expect(
      screen.getByText("This application can no longer be withdrawn."),
    ).toBeInTheDocument();
  });

  it("keeps the title link but offers no row action once the application is closed", async () => {
    listMock.mockResolvedValue([
      buildApplication({ id: "app-accepted", status: "accepted" }),
      buildApplication({ id: "app-rejected", status: "rejected" }),
      buildApplication({ id: "app-withdrawn", status: "withdrawn" }),
    ]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("Accepted")).toBeInTheDocument();
    expect(screen.getByText("Rejected")).toBeInTheDocument();
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    const links = screen.getAllByRole("link", { name: "Backend Engineer" });
    expect(links).toHaveLength(3);
    expect(links[0]).toHaveAttribute("href", "/jobs/abcdefghijkl-backend-engineer");
    expect(screen.queryByRole("link", { name: "Continue application" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("never shows the mockup's matching score, pipeline or AI brief", async () => {
    listMock.mockResolvedValue([buildApplication()]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("Submitted")).toBeInTheDocument();
    expect(
      screen.queryByText(/match score|pipeline|ai brief|interview/i),
    ).not.toBeInTheDocument();
  });

  it("shows the loading state while the applications are fetched", () => {
    listMock.mockReturnValue(new Promise<never>(() => {}));

    renderWithQueryClient(<ApplicationsView />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows an error state when the list cannot be loaded", async () => {
    listMock.mockRejectedValue(new Error("network"));
    // Sans les nouvelles tentatives par défaut (≈ 7 s) : seul l'état d'erreur compte ici.
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <ApplicationsView />
      </QueryClientProvider>,
    );

    expect(await screen.findByText("Could not load your applications")).toBeInTheDocument();
  });
});
