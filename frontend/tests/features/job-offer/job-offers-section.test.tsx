import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { JobOffersSection } from "@/features/job-offer/job-offers-section";
import type { Company, JobOfferListItem } from "@/types/recruiter";

const useInfiniteJobOffersMock = vi.hoisted(() => vi.fn());
const useJobOfferTransitionMock = vi.hoisted(() => vi.fn());
const useDeleteJobOfferMock = vi.hoisted(() => vi.fn());
const useDuplicateJobOfferMock = vi.hoisted(() => vi.fn());
const useContractTypesMock = vi.hoisted(() => vi.fn());
const useWorkModesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-job-offers", () => ({
  useInfiniteJobOffers: useInfiniteJobOffersMock,
  useJobOfferTransition: useJobOfferTransitionMock,
  useDeleteJobOffer: useDeleteJobOfferMock,
  useDuplicateJobOffer: useDuplicateJobOfferMock,
  useContractTypes: useContractTypesMock,
  useWorkModes: useWorkModesMock,
}));

const companies: Company[] = [
  { id: "c1", name: "Acme Inc.", description: null, isOwner: true },
];

function draftOffer(overrides: Partial<JobOfferListItem> = {}): JobOfferListItem {
  return {
    id: "o1",
    companyId: "c1",
    status: "draft",
    title: "Backend Engineer",
    publicId: "abcdefghijkl",
    slug: "backend-engineer",
    seniority: null,
    city: null,
    country: "FR",
    contractTypeId: "ct1",
    workModeId: "wm1",
    expiresAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    hasUnvalidatedChanges: false,
    normalizationInProgress: false,
    normalizationFailed: false,
    readyToPublish: true,
    createdAt: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

/** Forme retournée par useInfiniteJobOffers (une seule page chargée). */
function infiniteResult(
  offers: JobOfferListItem[],
  overrides: {
    isLoading?: boolean;
    isError?: boolean;
    error?: Error;
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage?: ReturnType<typeof vi.fn>;
    refetch?: ReturnType<typeof vi.fn>;
    /** data reste undefined (chargement initial). */
    unloaded?: boolean;
  } = {},
) {
  const { unloaded = false, ...rest } = overrides;
  return {
    data: unloaded
      ? undefined
      : {
          pages: [{ items: offers, page: 0, size: 20, total: offers.length }],
          pageParams: [0],
        },
    isLoading: false,
    isError: false,
    hasNextPage: false,
    isFetchingNextPage: false,
    fetchNextPage: vi.fn(),
    refetch: vi.fn(),
    ...rest,
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
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([], { unloaded: true, isLoading: true }));
    useJobOfferTransitionMock.mockReturnValue(mutation());
    useDeleteJobOfferMock.mockReturnValue(mutation());
    useDuplicateJobOfferMock.mockReturnValue(mutation());
    useContractTypesMock.mockReturnValue({
      data: [{ id: "ct1", label: "Permanent" }],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useWorkModesMock.mockReturnValue({
      data: [
        { id: "wm1", label: "Hybrid" },
        { id: "wm2", label: "Remote" },
      ],
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
  });

  it("shows the loading state", () => {
    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Loading offers…")).toBeInTheDocument();
  });

  it("surfaces a load error with a retry that refetches", () => {
    const refetch = vi.fn();
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([], { isError: true, error: new Error("boom"), refetch }),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Could not load offers")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("explains the empty state", () => {
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([]));

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText(/No offers yet/)).toBeInTheDocument();
  });

  it("renders offers with company name, contract label and status label", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer(),
        draftOffer({ id: "o2", title: "Data Engineer", status: "published" }),
      ]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
    expect(screen.getAllByText("Acme Inc.")).toHaveLength(2);
    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Published")).toBeInTheDocument();
    expect(screen.getAllByText("Permanent")).toHaveLength(2);
    expect(screen.getAllByText("Hybrid · FR")).toHaveLength(2);
    expect(screen.getAllByText(/^Created /)).toHaveLength(2);
  });

  it("loads the next page through the load-more fallback", () => {
    const fetchNextPage = vi.fn();
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer()], { hasNextPage: true, fetchNextPage }),
    );

    render(<JobOffersSection companies={companies} />);

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("merges the work mode with the location", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer({ city: "Paris", country: "FR" }),
        draftOffer({
          id: "o2",
          title: "Data Engineer",
          workModeId: "wm2",
          city: "Lyon",
          country: "FR",
        }),
      ]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Hybrid · Paris, FR")).toBeInTheDocument();
    expect(screen.getByText("Remote · Lyon, FR")).toBeInTheDocument();
  });

  it("validates a draft offer only after confirmation", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer()]));

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Validate" }));

    // Pas de mutation avant confirmation (clic accidentel protégé).
    expect(transition.mutate).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog", { name: "Validate this offer?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(transition.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Validate" }));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Validate" }),
    );
    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "validate" },
      expect.anything(),
    );
  });

  it("publishes a validated offer only after confirmation", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer({ status: "validated" })]));

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));

    expect(transition.mutate).not.toHaveBeenCalled();
    expect(
      screen.getByRole("dialog", { name: "Publish this offer?" }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Publish" }),
    );
    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "publish" },
      expect.anything(),
    );
  });

  it("disables Validate on an incomplete draft with an explanatory tooltip", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ readyToPublish: false })]),
    );

    render(<JobOffersSection companies={companies} />);
    const validate = screen.getByRole("button", { name: "Validate" });

    expect(validate).toBeDisabled();
    expect(validate).toHaveAttribute(
      "title",
      "Add a description, a country, an employment type and at least one skill before publishing.",
    );
    fireEvent.click(validate);
    expect(transition.mutate).not.toHaveBeenCalled();
  });

  it("disables Publish on an incomplete validated offer", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "validated", readyToPublish: false })]),
    );

    render(<JobOffersSection companies={companies} />);
    const publish = screen.getByRole("button", { name: "Publish" });

    expect(publish).toBeDisabled();
    fireEvent.click(publish);
    expect(transition.mutate).not.toHaveBeenCalled();
  });

  it("does not keep the row busy after a transition has settled", () => {
    // Régression : variables persiste après succès en TanStack Query v5 —
    // busy doit suivre isPending, sinon Publish/Close tournent à l'infini.
    useJobOfferTransitionMock.mockReturnValue(
      mutation({
        variables: { offerId: "o1", action: "validate" },
        isPending: false,
      }),
    );
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "validated" })]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByRole("button", { name: "Publish" })).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("button", { name: "Close" })).not.toHaveAttribute("aria-busy");
    expect(screen.getByRole("button", { name: "Publish" })).not.toBeDisabled();
  });

  it("shows the row busy only while the transition is pending", () => {
    useJobOfferTransitionMock.mockReturnValue(
      mutation({
        variables: { offerId: "o1", action: "validate" },
        isPending: true,
      }),
    );
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer()]));

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByRole("button", { name: "Validate" })).toHaveAttribute("aria-busy", "true");
  });

  it("only offers Close on a published offer", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ id: "o2", status: "published" })]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("copies the absolute public URL of a published offer", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.assign(navigator, { clipboard: { writeText } });
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "published" })]),
    );

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Copy link" }));

    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/jobs/abcdefghijkl-backend-engineer"),
    );
    expect(await screen.findByRole("button", { name: "Link copied" })).toBeInTheDocument();
  });

  it("links the public page of a published offer in a new tab", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "published" })]),
    );

    render(<JobOffersSection companies={companies} />);

    const link = screen.getByRole("link", { name: /view public page/i });
    expect(link).toHaveAttribute("href", "/jobs/abcdefghijkl-backend-engineer");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("shows no public link controls on a draft offer", () => {
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer()]));

    render(<JobOffersSection companies={companies} />);

    expect(screen.queryByRole("button", { name: "Copy link" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /view public page/i })).not.toBeInTheDocument();
  });

  it("deletes a draft only after confirmation", () => {
    const remove = mutation();
    useDeleteJobOfferMock.mockReturnValue(remove);
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer()]));

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete this draft offer?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove.mutate).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));
    expect(remove.mutate).toHaveBeenCalledWith("o1", expect.anything());
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("flags an expired published offer without changing its status", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer({ id: "o1", status: "published", expiresAt: "2020-01-01" }),
        draftOffer({ id: "o2", title: "Data Engineer", status: "published", expiresAt: "2099-01-01" }),
        draftOffer({ id: "o3", title: "ML Engineer", status: "published", expiresAt: null }),
      ]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getAllByText("Expired")).toHaveLength(1);
    expect(screen.getAllByText("Published")).toHaveLength(3);
  });

  it("links the preview of a validated offer", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "validated" })]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByRole("link", { name: "Preview" })).toHaveAttribute(
      "href",
      "/recruiter/offers/o1/preview",
    );
  });

  it("duplicates an offer immediately without confirmation", () => {
    const duplicate = mutation();
    useDuplicateJobOfferMock.mockReturnValue(duplicate);
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "published" })]),
    );

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));

    expect(duplicate.mutate).toHaveBeenCalledWith("o1");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows a mutation error without dropping the list", () => {
    useJobOfferTransitionMock.mockReturnValue(
      mutation({ error: new Error("Invalid transition") }),
    );
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer()]));

    render(<JobOffersSection companies={companies} />);

    expect(screen.getByText("Action failed")).toBeInTheDocument();
    expect(screen.getByText("Backend Engineer")).toBeInTheDocument();
  });

  function renderOffers(offers: JobOfferListItem[]) {
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult(offers));

    render(<JobOffersSection companies={companies} />);
  }

  it("shows Analyzing… while the normalization is in progress", () => {
    renderOffers([draftOffer({ status: "validated", normalizationInProgress: true })]);

    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(screen.queryByText("Unvalidated changes")).not.toBeInTheDocument();
  });

  it("shows Analysis failed when the last normalization failed", () => {
    renderOffers([draftOffer({ status: "validated", normalizationFailed: true })]);

    expect(screen.getByText("Analysis failed")).toBeInTheDocument();
    expect(screen.queryByText("Unvalidated changes")).not.toBeInTheDocument();
  });

  it("prioritises Analyzing… over a failed or dirty state", () => {
    renderOffers([
      draftOffer({
        status: "validated",
        normalizationInProgress: true,
        normalizationFailed: true,
        hasUnvalidatedChanges: true,
      }),
    ]);

    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(screen.queryByText("Analysis failed")).not.toBeInTheDocument();
    expect(screen.queryByText("Unvalidated changes")).not.toBeInTheDocument();
  });

  it("shows no analysis badge once the normalization settles without changes", () => {
    renderOffers([draftOffer({ status: "validated" })]);

    expect(screen.queryByText("Analyzing…")).not.toBeInTheDocument();
    expect(screen.queryByText("Analysis failed")).not.toBeInTheDocument();
    expect(screen.queryByText("Unvalidated changes")).not.toBeInTheDocument();
  });

  it("offers a Validate again action on a failed analysis", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    renderOffers([draftOffer({ status: "validated", normalizationFailed: true })]);

    fireEvent.click(screen.getByRole("button", { name: "Validate again" }));
    // Même garde que Validate en draft : confirmation avant la mutation (D13).
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Validate" }),
    );

    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "validate" },
      expect.anything(),
    );
  });

  it("does not offer Validate again when the analysis is healthy", () => {
    renderOffers([draftOffer({ status: "validated" })]);

    expect(screen.queryByRole("button", { name: "Validate again" })).not.toBeInTheDocument();
  });
});
