import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

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
    expect(screen.getByText("Acme Inc.")).toBeInTheDocument();
    expect(
      screen.getByText("Mid · Paris, FR · Permanent · Full-time · Hybrid"),
    ).toBeInTheDocument();
    expect(screen.getByText("Build APIs.")).toBeInTheDocument();
    expect(screen.getByText("Bachelor's degree")).toBeInTheDocument();
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
