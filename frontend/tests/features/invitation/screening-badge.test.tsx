import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { isScreeningInProgress, ScreeningBadge } from "@/features/invitation/screening-badge";

const useRetryScreeningMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-invitations", () => ({
  useRetryScreening: useRetryScreeningMock,
}));

function retryMutation(overrides: Record<string, unknown> = {}) {
  return { mutate: vi.fn(), isPending: false, error: null, ...overrides };
}

describe("isScreeningInProgress", () => {
  it.each([
    ["pending", true],
    ["running", true],
    ["done", false],
    ["failed", false],
    ["none", false],
  ] as const)("%s → %s", (status, expected) => {
    expect(isScreeningInProgress({ status, candidateCount: null })).toBe(expected);
  });

  it("is false without any search", () => {
    expect(isScreeningInProgress(null)).toBe(false);
    expect(isScreeningInProgress(undefined)).toBe(false);
  });
});

describe("ScreeningBadge", () => {
  beforeEach(() => {
    useRetryScreeningMock.mockReset();
    useRetryScreeningMock.mockReturnValue(retryMutation());
  });

  it.each([[null], [undefined], [{ status: "none" as const, candidateCount: null }]])(
    "renders nothing without a search (%j)",
    (screening) => {
      const { container } = render(<ScreeningBadge offerId="o1" screening={screening} />);

      expect(container).toBeEmptyDOMElement();
    },
  );

  it.each(["pending", "running"] as const)("shows the search in progress while %s", (status) => {
    render(<ScreeningBadge offerId="o1" screening={{ status, candidateCount: null }} />);

    expect(screen.getByText("Searching candidates…")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View candidates/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry search/ })).not.toBeInTheDocument();
  });

  it("shows the count and links to the list of the offer when candidates were found", () => {
    render(<ScreeningBadge offerId="o1" screening={{ status: "done", candidateCount: 10 }} />);

    expect(screen.getByText("10 candidates found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /View candidates/ })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/suggestions",
    );
    expect(screen.queryByRole("button", { name: /Retry search/ })).not.toBeInTheDocument();
  });

  it("pulses the dot only while the search runs; the result keeps a still orange dot", () => {
    const searching = render(<ScreeningBadge offerId="o1" screening={{ status: "running", candidateCount: null }} />);
    const searchingPill = screen.getByText("Searching candidates…");
    expect(searchingPill).toHaveClass("bg-orange-subtle", "text-orange-deep");
    expect(searchingPill.firstElementChild).toHaveClass("animate-pulse", "motion-reduce:animate-none");
    searching.unmount();

    render(<ScreeningBadge offerId="o1" screening={{ status: "done", candidateCount: 10 }} />);
    const foundPill = screen.getByText("10 candidates found");
    expect(foundPill).toHaveClass("bg-orange-subtle", "text-orange-deep");
    expect(foundPill.firstElementChild).toHaveClass("bg-orange-deep");
    expect(foundPill.firstElementChild).not.toHaveClass("animate-pulse");
  });

  it("keeps the empty and failed results neutral, without any dot", () => {
    const empty = render(<ScreeningBadge offerId="o1" screening={{ status: "done", candidateCount: 0 }} />);
    expect(screen.getByText("No candidates found")).not.toHaveClass("bg-orange-subtle");
    empty.unmount();
    render(<ScreeningBadge offerId="o1" screening={{ status: "failed", candidateCount: null }} />);
    expect(screen.getByText("Search failed")).not.toHaveClass("bg-orange-subtle");
  });

  it("uses the singular for a single candidate", () => {
    render(<ScreeningBadge offerId="o1" screening={{ status: "done", candidateCount: 1 }} />);

    expect(screen.getByText("1 candidate found")).toBeInTheDocument();
  });

  it("hides the button when no candidate was found: an empty result is not a failure", () => {
    render(<ScreeningBadge offerId="o1" screening={{ status: "done", candidateCount: 0 }} />);

    expect(screen.getByText("No candidates found")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View candidates/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Retry search/ })).not.toBeInTheDocument();
  });

  it("treats a finished search without a count as an empty result", () => {
    render(<ScreeningBadge offerId="o1" screening={{ status: "done", candidateCount: null }} />);

    expect(screen.getByText("No candidates found")).toBeInTheDocument();
  });

  it("offers a retry only after a failure, and runs it on click", () => {
    const mutate = vi.fn();
    useRetryScreeningMock.mockReturnValue(retryMutation({ mutate }));

    render(<ScreeningBadge offerId="o1" screening={{ status: "failed", candidateCount: null }} />);

    expect(screen.getByText("Search failed")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /View candidates/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Retry search/ }));
    expect(mutate).toHaveBeenCalledTimes(1);
    expect(useRetryScreeningMock).toHaveBeenCalledWith("o1");
  });

  it("busies the retry button while it runs", () => {
    useRetryScreeningMock.mockReturnValue(retryMutation({ isPending: true }));

    render(<ScreeningBadge offerId="o1" screening={{ status: "failed", candidateCount: null }} />);

    expect(screen.getByRole("button", { name: /Retry search/ })).toBeDisabled();
  });

  it("shows the refusal of a retry (e.g. 403 for a plain member) next to the button", () => {
    useRetryScreeningMock.mockReturnValue(
      retryMutation({
        error: { isAxiosError: true, response: { data: { detail: "You cannot manage this offer." } } },
      }),
    );

    render(<ScreeningBadge offerId="o1" screening={{ status: "failed", candidateCount: null }} />);

    expect(screen.getByRole("alert")).toHaveTextContent("You cannot manage this offer.");
  });
});
