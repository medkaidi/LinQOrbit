import { act, renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/query-keys";
import { useDecideRecruiterApplication } from "@/hooks/use-recruiter-applications";
import { decideRecruiterApplication } from "@/lib/api/application.api";

vi.mock("@/lib/api/application.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/application.api")>();
  return {
    ...actual,
    decideRecruiterApplication: vi.fn(),
  };
});

const decideMock = vi.mocked(decideRecruiterApplication);

function wrapperWith(client: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

function invalidatedKeys(invalidate: { mock: { calls: unknown[][] } }) {
  return invalidate.mock.calls.map((call) => (call[0] as { queryKey: unknown }).queryKey);
}

beforeEach(() => {
  decideMock.mockReset();
});

describe("useDecideRecruiterApplication", () => {
  it("re-reads the lists of the offer, the detail and the recruiter dashboard after a decision", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    decideMock.mockResolvedValue(undefined);

    const { result } = renderHook(() => useDecideRecruiterApplication("o1", "a1"), {
      wrapper: wrapperWith(client),
    });
    await act(async () => {
      await result.current.mutateAsync("accepted");
    });

    expect(decideMock).toHaveBeenCalledWith("o1", "a1", "accepted");
    expect(invalidatedKeys(invalidate)).toEqual([
      queryKeys.recruiterApplications.offer("o1"),
      queryKeys.recruiterApplications.detail("o1", "a1"),
      queryKeys.jobOffers.dashboard,
    ]);
  });

  it("leaves every family alone when the decision is refused with something else than a conflict", async () => {
    const client = new QueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    decideMock.mockRejectedValue(new Error("boom"));

    const { result } = renderHook(() => useDecideRecruiterApplication("o1", "a1"), {
      wrapper: wrapperWith(client),
    });
    await act(async () => {
      await result.current.mutateAsync("rejected").catch(() => undefined);
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
