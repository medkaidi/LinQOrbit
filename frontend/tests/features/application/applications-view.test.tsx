import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";

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

  it("renders each application with status, answers and the withdraw action only when submitted", async () => {
    listMock.mockResolvedValue([
      buildApplication(),
      buildApplication({ id: "app-2", status: "withdrawn" }),
    ]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("2 applications")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Withdrawn")).toBeInTheDocument();
    expect(screen.getAllByText("Why this role?")).toHaveLength(2);
    expect(screen.getAllByText("I love APIs")).toHaveLength(2);
    expect(screen.getAllByText("Remote")).toHaveLength(2);
    expect(screen.getAllByText("CV: ada-lovelace-cv.pdf")).toHaveLength(2);
    expect(screen.getAllByRole("button", { name: "Withdraw" })).toHaveLength(1);
  });

  it("offers to continue a draft (no CV yet) and never to withdraw it", async () => {
    listMock.mockResolvedValue([buildApplication({ id: "draft-1", status: "draft", cv: null, answers: [] })]);

    renderWithQueryClient(<ApplicationsView />);

    expect(await screen.findByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("No CV yet")).toBeInTheDocument();
    expect(screen.getByText(/^Started /)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Continue application" })).toHaveAttribute(
      "href",
      "/jobs/abcdefghijkl-backend-engineer/apply",
    );
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
});
