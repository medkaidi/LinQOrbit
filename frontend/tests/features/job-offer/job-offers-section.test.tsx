import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { JobOffersSection } from "@/features/job-offer/job-offers-section";
import type { Company, JobOffer } from "@/types/recruiter";

const useJobOffersMock = vi.hoisted(() => vi.fn());
const useJobOfferTransitionMock = vi.hoisted(() => vi.fn());
const useDeleteJobOfferMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-job-offers", () => ({
  useJobOffers: useJobOffersMock,
  useJobOfferTransition: useJobOfferTransitionMock,
  useDeleteJobOffer: useDeleteJobOfferMock,
}));

const companies: Company[] = [
  { id: "c1", name: "Acme Inc.", description: null, isOwner: true },
];

function draftOffer(overrides: Partial<JobOffer> = {}): JobOffer {
  return {
    id: "o1",
    companyId: "c1",
    recruiterId: "r1",
    title: "Backend Engineer",
    publicId: "abcdefghijkl",
    slug: "backend-engineer",
    description: null,
    status: "draft",
    seniority: null,
    requiredExpYear: null,
    city: null,
    country: null,
    contractTypeId: null,
    employmentTypeId: null,
    workModeId: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    validatedAt: null,
    publishedAt: null,
    expiresAt: null,
    hasUnvalidatedChanges: false,
    skills: [],
    languages: [],
    degreeIds: [],
    studyFieldIds: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

function mutation(data: Partial<ReturnType<typeof useJobOfferTransitionMock>> = {}) {
  return {
    mutate: vi.fn(),
    variables: undefined,
    error: null,
    isPending: false,
    reset: vi.fn(),
    ...data,
  };
}

describe("JobOffersSection", () => {
  beforeEach(() => {
    useJobOffersMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    useJobOfferTransitionMock.mockReturnValue(mutation());
    useDeleteJobOfferMock.mockReturnValue(mutation());
  });

  it("shows the loading state", () => {
    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Loading offers…")).toBeInTheDocument();
  });

  it("surfaces a load error with a retry that refetches", () => {
    const refetch = vi.fn();
    useJobOffersMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    });

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Could not load offers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("explains the empty state", () => {
    useJobOffersMock.mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText(/No offers yet/)).toBeInTheDocument();
  });

  it("renders offers with company name and status label", () => {
    useJobOffersMock.mockReturnValue({
      data: [
        draftOffer(),
        draftOffer({ id: "o2", title: "Data Engineer", status: "published" }),
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Inc.")).toHaveLength(2);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("validates a draft offer through the transition mutation", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    useJobOffersMock.mockReturnValue({
      data: [draftOffer()],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    expect(transition.mutate).toHaveBeenCalledWith({ offerId: "o1", action: "validate" });
  });

  it("only offers Close on a published offer", () => {
    useJobOffersMock.mockReturnValue({
      data: [draftOffer({ id: "o2", status: "published" })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("copies the absolute public URL of a published offer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    useJobOffersMock.mockReturnValue({
      data: [draftOffer({ status: "published" })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/abcdefghijkl-backend-engineer"),
    );
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
  });

  it("links the public page of a published offer in a new tab", () => {
    useJobOffersMock.mockReturnValue({
      data: [draftOffer({ status: "published" })],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);

    const link = screen.getByRole("link", { name: /view public page/i });
    expect(link).toHaveAttribute("href", "/jobs/abcdefghijkl-backend-engineer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows no public link controls on a draft offer", () => {
    useJobOffersMock.mockReturnValue({
      data: [draftOffer()],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);

    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view public page/i })).not.toBeInTheDocument();
  });

  it("deletes a draft only after confirmation", () => {
    const remove = mutation();
    useDeleteJobOfferMock.mockReturnValue(remove);
    useJobOffersMock.mockReturnValue({
      data: [draftOffer()],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(remove.mutate).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    expect(remove.mutate).toHaveBeenCalledWith("o1");
    confirmSpy.mockRestore();
  });

  it("shows a mutation error without dropping the list", () => {
    useJobOfferTransitionMock.mockReturnValue(
      mutation({ error: new Error("Invalid transition") }),
    );
    useJobOffersMock.mockReturnValue({
      data: [draftOffer()],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Action failed")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
  });
});
