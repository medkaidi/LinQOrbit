import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { RecruiterWorkspace } from "@/features/recruiter/recruiter-workspace";
import type { Company, RecruiterProfile } from "@/types/recruiter";

const useRecruiterProfileMock = vi.hoisted(() => vi.fn());
const useCompaniesMock = vi.hoisted(() => vi.fn());
const useCreateRecruiterMock = vi.hoisted(() => vi.fn());
const useJobOffersMock = vi.hoisted(() => vi.fn());
const useJobOfferTransitionMock = vi.hoisted(() => vi.fn());
const useDeleteJobOfferMock = vi.hoisted(() => vi.fn());

vi.mock("@/hooks/use-recruiter", () => ({
  useRecruiterProfile: useRecruiterProfileMock,
  useCompanies: useCompaniesMock,
  useCreateRecruiter: useCreateRecruiterMock,
  useCreateCompany: () => ({ mutate: vi.fn(), isError: false, isPending: false, error: null }),
  useUpdateCompany: () => ({ mutate: vi.fn(), isError: false, isPending: false, error: null }),
  useUpdateRecruiter: () => ({ mutate: vi.fn(), isError: false, isPending: false, error: null, reset: vi.fn() }),
}));

vi.mock("@/hooks/use-job-offers", () => ({
  useJobOffers: useJobOffersMock,
  useJobOfferTransition: useJobOfferTransitionMock,
  useDeleteJobOffer: useDeleteJobOfferMock,
}));

const profile: RecruiterProfile = {
  id: "r1",
  headline: "Talent Lead at Acme",
  bio: null,
};

const companies: Company[] = [
  { id: "c1", name: "Acme Inc.", description: null, isOwner: true },
];

describe("RecruiterWorkspace", () => {
  beforeEach(() => {
    useCreateRecruiterMock.mockReturnValue({
      mutate: vi.fn(),
      isError: false,
      isPending: false,
      isSuccess: false,
      error: null,
    });
    useJobOffersMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });
    useJobOfferTransitionMock.mockReturnValue({ mutate: vi.fn(), variables: undefined, error: null });
    useDeleteJobOfferMock.mockReturnValue({ mutate: vi.fn(), variables: undefined, error: null });
    useRecruiterProfileMock.mockReturnValue({
      profile: null,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });
    useCompaniesMock.mockReturnValue({ data: undefined, isLoading: true, isError: false, refetch: vi.fn() });
  });

  it("shows the switching overlay while the recruiter profile loads", () => {
    render(<RecruiterWorkspace />);

    expect(screen.getByRole("status")).toHaveTextContent("Switching to recruiter workspace…");
  });

  it("shows a retryable error when the profile request fails", () => {
    const refetch = vi.fn();
    useRecruiterProfileMock.mockReturnValue({
      profile: null,
      isLoading: false,
      isError: true,
      error: new Error("boom"),
      refetch,
    });

    render(<RecruiterWorkspace />);

    expect(screen.getByText("Could not load your recruiter workspace")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(refetch).toHaveBeenCalledOnce();
  });

  it("creates the recruiter profile on 404 without an intermediate screen", () => {
    const mutate = vi.fn();
    useCreateRecruiterMock.mockReturnValue({
      mutate,
      isError: false,
      isPending: false,
      isSuccess: false,
      error: null,
    });
    useRecruiterProfileMock.mockReturnValue({
      profile: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<RecruiterWorkspace />);

    expect(mutate).toHaveBeenCalledOnce();
    expect(screen.getByRole("status")).toHaveTextContent("Switching to recruiter workspace…");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not auto-create again while the creation is pending", () => {
    const mutate = vi.fn();
    useCreateRecruiterMock.mockReturnValue({
      mutate,
      isError: false,
      isPending: true,
      isSuccess: false,
      error: null,
    });
    useRecruiterProfileMock.mockReturnValue({
      profile: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<RecruiterWorkspace />);

    expect(mutate).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("shows a retryable error when the profile creation fails", () => {
    const mutate = vi.fn();
    useCreateRecruiterMock.mockReturnValue({
      mutate,
      isError: true,
      isPending: false,
      isSuccess: false,
      error: new Error("boom"),
    });
    useRecruiterProfileMock.mockReturnValue({
      profile: null,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<RecruiterWorkspace />);

    expect(screen.getByText("Could not start your recruiter workspace")).toBeInTheDocument();
    expect(screen.queryByText(/Switching to recruiter workspace/)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(mutate).toHaveBeenCalledOnce();
  });

  it("offers the company setup when the recruiter has no company yet", () => {
    useRecruiterProfileMock.mockReturnValue({
      profile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useCompaniesMock.mockReturnValue({ data: [], isLoading: false, isError: false, refetch: vi.fn() });

    render(<RecruiterWorkspace />);

    expect(screen.getByRole("heading", { name: "Set up your company" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Job offers" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruiter profile" })).not.toBeInTheDocument();
  });

  it("renders only the job offers with a company", () => {
    useRecruiterProfileMock.mockReturnValue({
      profile,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useCompaniesMock.mockReturnValue({
      data: companies,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    render(<RecruiterWorkspace />);

    expect(screen.getByRole("heading", { name: "Job offers" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "New offer" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Companies" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Recruiter profile" })).not.toBeInTheDocument();
  });
});
