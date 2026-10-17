import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";

import { JobOfferPreview } from "@/features/job-offer/job-offer-preview";
import type { JobOffer } from "@/types/recruiter";

const pushMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

const useJobOfferMock = vi.hoisted(() => vi.fn());
const useContractTypesMock = vi.hoisted(() => vi.fn());
const useEmploymentTypesMock = vi.hoisted(() => vi.fn());
const useWorkModesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-job-offers", () => ({
  useJobOffer: useJobOfferMock,
  useContractTypes: useContractTypesMock,
  useEmploymentTypes: useEmploymentTypesMock,
  useWorkModes: useWorkModesMock,
}));

const useCompaniesMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-companies", () => ({
  useCompanies: useCompaniesMock,
}));

const useReferenceDegreesMock = vi.hoisted(() => vi.fn());
const useReferenceStudyFieldsMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-candidate-profile", () => ({
  useReferenceDegrees: useReferenceDegreesMock,
  useReferenceStudyFields: useReferenceStudyFieldsMock,
}));

function validatedOffer(): JobOffer {
  return {
    id: "o1",
    companyId: "c1",
    recruiterId: "r1",
    title: "Backend Engineer",
    publicId: "abcdefghijkl",
    slug: "backend-engineer",
    description: "<p>Build APIs.</p>",
    status: "validated",
    seniority: "mid",
    requiredExpYear: null,
    city: "Paris",
    country: "FR",
    contractTypeId: "ct1",
    employmentTypeId: "et1",
    workModeId: "wm1",
    salaryMin: null,
    salaryMax: null,
    salaryCurrency: null,
    salaryPeriod: null,
    validatedAt: null,
    publishedAt: null,
    expiresAt: null,
    hasUnvalidatedChanges: false,
    normalizationInProgress: false,
    normalizationFailed: false,
    skills: [
      {
        skillId: "s1",
        name: "Java",
        requirementType: "mandatory",
        weight: 3,
        yearsExperience: null,
      },
    ],
    languages: [],
    degreeIds: ["d1"],
    studyFieldIds: [],
    questions: [],
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  };
}

function mockReferences() {
  useCompaniesMock.mockReturnValue({
    data: [{ id: "c1", name: "Acme Inc.", description: null, isOwner: true }],
    isLoading: false,
    isError: false,
  });
  useContractTypesMock.mockReturnValue({
    data: [{ id: "ct1", label: "Permanent" }],
    isLoading: false,
    isError: false,
  });
  useEmploymentTypesMock.mockReturnValue({
    data: [{ id: "et1", label: "Full-time" }],
    isLoading: false,
    isError: false,
  });
  useWorkModesMock.mockReturnValue({
    data: [{ id: "wm1", label: "Hybrid" }],
    isLoading: false,
    isError: false,
  });
  useReferenceDegreesMock.mockReturnValue({
    data: [{ id: "d1", label: "Bachelor's degree" }],
    isLoading: false,
    isError: false,
  });
  useReferenceStudyFieldsMock.mockReturnValue({ data: [], isLoading: false, isError: false });
}

describe("JobOfferPreview", () => {
  it("renders the not-public banner with the resolved article", () => {
    useJobOfferMock.mockReturnValue({
      data: validatedOffer(),
      isLoading: false,
      isError: false,
    });
    mockReferences();

    render(<JobOfferPreview offerId="o1" />);

    expect(screen.getByText("Not public yet")).toBeInTheDocument();
    expect(
      screen.getByText("This is how the offer will look once published."),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Backend Engineer" })).toBeInTheDocument();
    const hero = screen.getByRole("region", { name: "Job overview" });
    expect(within(hero).getByText("Acme Inc.")).toBeInTheDocument();
    expect(within(hero).getByText("Mid")).toBeInTheDocument();
    expect(within(hero).getByText("Paris, FR")).toBeInTheDocument();
    expect(within(hero).getByText("Permanent")).toBeInTheDocument();
    expect(within(hero).getByText("Full-time")).toBeInTheDocument();
    expect(within(hero).getByText("Hybrid")).toBeInTheDocument();
    expect(screen.getByText("Build APIs.")).toBeInTheDocument();
    expect(screen.getByText("Java")).toBeInTheDocument();
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();
    expect(screen.queryByText("Screening questions")).not.toBeInTheDocument();
    // La prévisualisation ne porte jamais les actions de la fiche publique (T-73).
    expect(screen.queryByRole("link", { name: "Apply for this job" })).not.toBeInTheDocument();
    expect(
      screen.queryByRole("region", { name: "More from this company" }),
    ).not.toBeInTheDocument();
  });

  it("renders the recruiter-only screening questions with type labels and preferred options", () => {
    useJobOfferMock.mockReturnValue({
      data: {
        ...validatedOffer(),
        questions: [
          {
            id: "q1",
            label: "Where do you want to work?",
            type: "single_choice",
            isRequired: true,
            sortOrder: 0,
            options: [
              { id: "op1", label: "Remote", sortOrder: 0, preferred: true },
              { id: "op2", label: "On-site", sortOrder: 1, preferred: false },
            ],
          },
          {
            id: "q2",
            label: "Years with Java?",
            type: "number",
            isRequired: false,
            sortOrder: 1,
            options: [],
          },
        ],
      },
      isLoading: false,
      isError: false,
    });
    mockReferences();

    render(<JobOfferPreview offerId="o1" />);

    expect(screen.getByRole("heading", { name: "Screening questions" })).toBeInTheDocument();
    expect(screen.getByText("Where do you want to work?")).toBeInTheDocument();
    expect(screen.getByText("Single choice")).toBeInTheDocument();
    expect(screen.getAllByText("Required")).toHaveLength(1);
    expect(screen.getByText("Remote (preferred) · On-site")).toBeInTheDocument();
    expect(screen.getByText("Years with Java?")).toBeInTheDocument();
    expect(screen.getByText("Number")).toBeInTheDocument();
  });

  it("shows the loading state", () => {
    useJobOfferMock.mockReturnValue({ data: undefined, isLoading: true, isError: false });

    render(<JobOfferPreview offerId="o1" />);

    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("surfaces a load error with a back action", () => {
    useJobOfferMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
    });

    render(<JobOfferPreview offerId="o1" />);

    expect(screen.getByText("Could not load the offer")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Back to offers" }));
    expect(pushMock).toHaveBeenCalledWith("/recruiter");
  });
});
