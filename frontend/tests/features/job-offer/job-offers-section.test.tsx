import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { META_CHIP_ACCENT_CLASS } from "@/components/ui/pill";
import { JobOffersSection } from "@/features/job-offer/job-offers-section";
import type { Company, JobOfferListItem } from "@/types/recruiter";

function classesOf(value: string) {
  return value.split(" ");
}

const useInfiniteJobOffersMock = vi.hoisted(() => vi.fn());
const useJobOfferTransitionMock = vi.hoisted(() => vi.fn());
const useDeleteJobOfferMock = vi.hoisted(() => vi.fn());
const useDuplicateJobOfferMock = vi.hoisted(() => vi.fn());
const useContractTypesMock = vi.hoisted(() => vi.fn());
const useEmploymentTypesMock = vi.hoisted(() => vi.fn());
const useWorkModesMock = vi.hoisted(() => vi.fn());
const useOfferNormalizationStreamMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-normalization-stream", () => ({
  useOfferNormalizationStream: useOfferNormalizationStreamMock,
}));

vi.mock("@/hooks/use-job-offers", () => ({
  useInfiniteJobOffers: useInfiniteJobOffersMock,
  useJobOfferTransition: useJobOfferTransitionMock,
  useDeleteJobOffer: useDeleteJobOfferMock,
  useDuplicateJobOffer: useDuplicateJobOfferMock,
  useContractTypes: useContractTypesMock,
  useEmploymentTypes: useEmploymentTypesMock,
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
    employmentTypeId: "et1",
    workModeId: "wm1",
    expiresAt: null,
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    hasUnvalidatedChanges: false,
    normalizationInProgress: false,
    normalizationFailed: false,
    analysisOutdated: false,
    readyToPublish: true,
    applicationCount: 0,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
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

/** Ouvre le menu overflow ⋯ de la ligne et retourne le menu. */
function openActionsMenu() {
  fireEvent.click(screen.getByRole("button", { name: "More actions" }));
  return screen.getByRole("menu", { name: "More actions" });
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
    useEmploymentTypesMock.mockReturnValue({
      data: [{ id: "et1", label: "Full-time" }],
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
    expect(screen.getAllByText("Full-time")).toHaveLength(2);
    // Lieu et mode de travail sont des chips distinctes (fin du « Hybrid · FR »).
    expect(screen.getAllByText("FR")).toHaveLength(2);
    expect(screen.getAllByText("Hybrid")).toHaveLength(2);
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

  it("renders the work mode and the location as separate chips", () => {
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

    expect(screen.getByText("Paris, FR")).toBeInTheDocument();
    expect(screen.getByText("Lyon, FR")).toBeInTheDocument();
    expect(screen.getByText("Hybrid")).toBeInTheDocument();
    expect(screen.getByText("Remote")).toBeInTheDocument();
  });

  it("shows the number of candidates and omits the chip when there is none", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer({ id: "o1", applicationCount: 3 }),
        draftOffer({ id: "o2", applicationCount: 1 }),
        draftOffer({ id: "o3", applicationCount: 0 }),
      ]),
    );

    render(<JobOffersSection companies={companies} />);

    const candidates = screen.getByText("3 candidates");
    expect(candidates).toBeInTheDocument();
    // Même outline que les autres chips méta, thème orange.
    expect(candidates).toHaveClass(...classesOf(META_CHIP_ACCENT_CLASS));
    expect(screen.getByText("1 candidate")).toBeInTheDocument();
    // Sans candidature visible, aucun chip : l'absence porte déjà l'information.
    expect(screen.queryByText("0 candidates")).not.toBeInTheDocument();
  });

  it("flags a draft that cannot be published yet", () => {
    renderOffers([draftOffer({ readyToPublish: false })]);

    expect(screen.getByText("Not ready to publish")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("shows no readiness chip once the draft is complete", () => {
    renderOffers([draftOffer({ readyToPublish: true })]);

    expect(screen.queryByText("Not ready to publish")).not.toBeInTheDocument();
  });

  it("shows Updated only when the offer changed after creation", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer({ updatedAt: "2026-02-01T00:00:00Z" }),
        draftOffer({ id: "o2", title: "Data Engineer" }),
      ]),
    );

    render(<JobOffersSection companies={companies} />);

    expect(screen.getAllByText(/^Updated /)).toHaveLength(1);
  });

  it("counts down the expiry of a published offer", () => {
    const today = new Date();
    const inTenDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);
    const iso = `${inTenDays.getFullYear()}-${String(inTenDays.getMonth() + 1).padStart(2, "0")}-${String(inTenDays.getDate()).padStart(2, "0")}`;
    renderOffers([draftOffer({ status: "published", expiresAt: iso })]);

    expect(screen.getByText("Expires in 10 days")).toBeInTheDocument();
  });

  it("does not count down on a draft or an expired offer", () => {
    const today = new Date();
    const inTenDays = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 10);
    const iso = `${inTenDays.getFullYear()}-${String(inTenDays.getMonth() + 1).padStart(2, "0")}-${String(inTenDays.getDate()).padStart(2, "0")}`;
    renderOffers([
      draftOffer({ expiresAt: iso }),
      draftOffer({ id: "o2", title: "Data Engineer", status: "published", expiresAt: "2020-01-01" }),
    ]);

    expect(screen.queryByText(/^Expires /)).not.toBeInTheDocument();
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
    // busy doit suivre isPending, sinon Publish et le kebab tournent à l'infini.
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
    expect(screen.getByRole("button", { name: "More actions" })).not.toHaveAttribute("aria-busy");
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
    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
  });

  it("shows the kebab spinner while a menu action is pending", () => {
    // Busy ciblé : une duplication en cours ne fait pas tourner l'action primaire.
    useDuplicateJobOfferMock.mockReturnValue(mutation({ variables: "o1", isPending: true }));
    renderOffers([draftOffer()]);

    expect(screen.getByRole("button", { name: "More actions" })).toHaveAttribute(
      "aria-busy",
      "true",
    );
    expect(screen.getByRole("button", { name: "Validate" })).not.toHaveAttribute("aria-busy");
  });

  it("only offers Close on a published offer", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ id: "o2", status: "published" })]),
    );

    render(<JobOffersSection companies={companies} />);

    const menu = openActionsMenu();
    expect(within(menu).getByRole("menuitem", { name: "Close" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Validate" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("groups the draft secondary actions behind the overflow menu", () => {
    renderOffers([draftOffer()]);

    const menu = openActionsMenu();

    expect(within(menu).getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Close" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("menuitem", { name: "Preview" })).not.toBeInTheDocument();
  });

  it("groups the validated secondary actions behind the overflow menu", () => {
    renderOffers([draftOffer({ status: "validated" })]);

    const menu = openActionsMenu();

    expect(within(menu).getByRole("menuitem", { name: "Preview" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Duplicate" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Close" })).toBeInTheDocument();
    // Visibles : la primaire (Publish) et Edit — le reste est derrière le ⋯.
    expect(screen.getByRole("button", { name: "Publish" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toBeInTheDocument();
  });

  it("closes the overflow menu on Escape and returns focus to its trigger", () => {
    renderOffers([draftOffer()]);
    const trigger = screen.getByRole("button", { name: "More actions" });

    fireEvent.click(trigger);
    expect(screen.getByRole("menu", { name: "More actions" })).toBeInTheDocument();

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
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

  it("links the applications of published and closed offers", () => {
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer({ id: "o1", status: "published" }),
        draftOffer({ id: "o2", title: "Data Engineer", status: "closed" }),
      ]),
    );

    render(<JobOffersSection companies={companies} />);

    const links = screen.getAllByRole("link", { name: /Applications/ });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/recruiter/offers/o1/applications",
      "/recruiter/offers/o2/applications",
    ]);
  });

  it("deletes a draft only after confirmation", () => {
    const remove = mutation();
    useDeleteJobOfferMock.mockReturnValue(remove);
    useInfiniteJobOffersMock.mockReturnValue(infiniteResult([draftOffer()]));

    render(<JobOffersSection companies={companies} />);
    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Delete" }));

    const dialog = screen.getByRole("dialog", { name: "Delete this draft offer?" });
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(remove.mutate).not.toHaveBeenCalled();

    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Delete" }));
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

    expect(within(openActionsMenu()).getByRole("menuitem", { name: "Preview" })).toHaveAttribute(
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
    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Duplicate" }));

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

    return render(<JobOffersSection companies={companies} />);
  }

  // --- D64 : flux SSE de normalisation, un par offre (re)validée depuis la liste ---

  it("opens no normalization stream for offers the user did not validate here", () => {
    useOfferNormalizationStreamMock.mockClear();
    renderOffers([
      draftOffer({ id: "o1", status: "validated", normalizationInProgress: true }),
      draftOffer({ id: "o2", status: "published", normalizationInProgress: true }),
    ]);

    expect(useOfferNormalizationStreamMock).not.toHaveBeenCalled();
  });

  it("follows the analysis of an offer once validated from the list, and only that one", () => {
    useOfferNormalizationStreamMock.mockClear();
    const transition = mutation({
      mutate: vi.fn((_variables, options) => {
        options?.onSuccess?.();
        options?.onSettled?.();
      }),
    });
    useJobOfferTransitionMock.mockReturnValue(transition);
    const view = renderOffers([draftOffer({ id: "o1" }), draftOffer({ id: "o2", title: "Data Engineer" })]);

    fireEvent.click(screen.getAllByRole("button", { name: "Validate" })[0]);
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Validate" }));

    // La liste relue montre l'analyse en cours : un flux pour o1, aucun pour o2.
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([
        draftOffer({ id: "o1", status: "validated", normalizationInProgress: true }),
        draftOffer({ id: "o2", title: "Data Engineer", normalizationInProgress: true }),
      ]),
    );
    view.rerender(<JobOffersSection companies={companies} />);

    expect(useOfferNormalizationStreamMock).toHaveBeenLastCalledWith("o1", true);
    expect(useOfferNormalizationStreamMock.mock.calls.every(([offerId]) => offerId === "o1")).toBe(true);

    // Analyse terminée : le flux de o1 est désactivé.
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ id: "o1", status: "validated" }), draftOffer({ id: "o2" })]),
    );
    view.rerender(<JobOffersSection companies={companies} />);
    expect(useOfferNormalizationStreamMock).toHaveBeenLastCalledWith("o1", false);
  });

  it("follows the analysis of a published offer refreshed through revalidate", () => {
    useOfferNormalizationStreamMock.mockClear();
    useJobOfferTransitionMock.mockReturnValue(
      mutation({
        mutate: vi.fn((_variables, options) => {
          options?.onSuccess?.();
          options?.onSettled?.();
        }),
      }),
    );
    const view = renderOffers([draftOffer({ status: "published", analysisOutdated: true })]);

    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Validate again" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Validate again" }));
    useInfiniteJobOffersMock.mockReturnValue(
      infiniteResult([draftOffer({ status: "published", analysisOutdated: true, normalizationInProgress: true })]),
    );
    view.rerender(<JobOffersSection companies={companies} />);

    expect(useOfferNormalizationStreamMock).toHaveBeenLastCalledWith("o1", true);
  });

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

    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Validate again" }));

    expect(
      screen.getByText("We could not finish analyzing this offer. You can try again."),
    ).toBeInTheDocument();

    // Même garde que Validate en draft : confirmation avant la mutation (D13).
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Validate" }),
    );

    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "validate" },
      expect.anything(),
    );
  });

  it("offers a Validate again action on unvalidated changes", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    renderOffers([draftOffer({ status: "validated", hasUnvalidatedChanges: true })]);

    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Validate again" }));

    expect(
      screen.getByText("You've made changes to this offer. Validate again to refresh its analysis."),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Validate" }),
    );

    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "validate" },
      expect.anything(),
    );
  });

  it("hides Validate again while the analysis is in progress", () => {
    renderOffers([
      draftOffer({
        status: "validated",
        hasUnvalidatedChanges: true,
        normalizationInProgress: true,
      }),
    ]);

    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(
      within(openActionsMenu()).queryByRole("menuitem", { name: "Validate again" }),
    ).not.toBeInTheDocument();
  });

  it("does not offer Validate again when the analysis is healthy", () => {
    renderOffers([draftOffer({ status: "validated" })]);

    expect(
      within(openActionsMenu()).queryByRole("menuitem", { name: "Validate again" }),
    ).not.toBeInTheDocument();
  });

  // --- D63 : analyse obsolète -------------------------------------------------

  it("flags an outdated analysis and offers Validate again without any change", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    renderOffers([draftOffer({ status: "validated", analysisOutdated: true })]);

    expect(screen.getByText("Analysis outdated")).toBeInTheDocument();
    expect(screen.queryByText("Unvalidated changes")).not.toBeInTheDocument();

    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Validate again" }));

    expect(
      screen.getByText(
        "This offer's analysis was made with an earlier version of our analysis. Validate again to refresh it.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Validate" }),
    );

    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "validate" },
      expect.anything(),
    );
  });

  it("flags an outdated analysis on a draft, whose Validate stays the primary action", () => {
    renderOffers([draftOffer({ analysisOutdated: true })]);

    expect(screen.getByText("Analysis outdated")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeEnabled();
  });

  it("prefers Analysis outdated over Unvalidated changes, and Analysis failed over both", () => {
    renderOffers([
      draftOffer({ id: "o1", status: "validated", analysisOutdated: true, hasUnvalidatedChanges: true }),
      draftOffer({
        id: "o2",
        status: "validated",
        normalizationFailed: true,
        analysisOutdated: true,
        hasUnvalidatedChanges: true,
      }),
    ]);

    expect(screen.getAllByText("Analysis outdated")).toHaveLength(1);
    expect(screen.getAllByText("Analysis failed")).toHaveLength(1);
    expect(screen.queryByText("Unvalidated changes")).not.toBeInTheDocument();
  });

  it("hides the outdated badge and Validate again while the analysis is in progress", () => {
    renderOffers([
      draftOffer({ status: "validated", analysisOutdated: true, normalizationInProgress: true }),
    ]);

    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(screen.queryByText("Analysis outdated")).not.toBeInTheDocument();
    expect(
      within(openActionsMenu()).queryByRole("menuitem", { name: "Validate again" }),
    ).not.toBeInTheDocument();
  });

  // --- D63 : rafraîchissement d'une offre PUBLISHED, sans changement de statut --

  it("flags an outdated published offer and refreshes it through revalidate after confirmation", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    renderOffers([draftOffer({ status: "published", analysisOutdated: true })]);

    expect(screen.getByText("Analysis outdated")).toBeInTheDocument();

    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Validate again" }));

    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Refresh this offer's analysis?")).toBeInTheDocument();
    expect(
      within(dialog).getByText(
        "This offer's analysis was made with an earlier version of our analysis. Validate again to refresh it.",
      ),
    ).toBeInTheDocument();
    expect(transition.mutate).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Validate again" }));

    // /revalidate, jamais /validate : l'offre reste publiée.
    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "revalidate" },
      expect.anything(),
    );
  });

  it("offers Validate again on a published offer whose last analysis failed", () => {
    const transition = mutation();
    useJobOfferTransitionMock.mockReturnValue(transition);
    renderOffers([draftOffer({ status: "published", normalizationFailed: true })]);

    expect(screen.getByText("Analysis failed")).toBeInTheDocument();
    fireEvent.click(within(openActionsMenu()).getByRole("menuitem", { name: "Validate again" }));
    expect(
      screen.getByText("We could not finish analyzing this offer. You can try again."),
    ).toBeInTheDocument();
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: "Validate again" }),
    );

    expect(transition.mutate).toHaveBeenCalledWith(
      { offerId: "o1", action: "revalidate" },
      expect.anything(),
    );
  });

  it("shows neither badge nor Validate again on an up-to-date published offer", () => {
    renderOffers([draftOffer({ status: "published" })]);

    expect(screen.queryByText("Analysis outdated")).not.toBeInTheDocument();
    expect(screen.queryByText("Analysis failed")).not.toBeInTheDocument();
    expect(
      within(openActionsMenu()).queryByRole("menuitem", { name: "Validate again" }),
    ).not.toBeInTheDocument();
  });

  it("hides Validate again on a published offer while its analysis is running", () => {
    renderOffers([
      draftOffer({ status: "published", analysisOutdated: true, normalizationInProgress: true }),
    ]);

    expect(screen.getByText("Analyzing…")).toBeInTheDocument();
    expect(screen.queryByText("Analysis outdated")).not.toBeInTheDocument();
    expect(
      within(openActionsMenu()).queryByRole("menuitem", { name: "Validate again" }),
    ).not.toBeInTheDocument();
  });

  it("never flags a closed offer as outdated, which has no action left", () => {
    renderOffers([draftOffer({ status: "closed", analysisOutdated: true })]);

    expect(screen.queryByText("Analysis outdated")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More actions" })).not.toBeInTheDocument();
  });
});
