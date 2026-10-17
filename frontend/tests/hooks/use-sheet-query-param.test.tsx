import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useSheetQueryParam } from "@/hooks/use-sheet-query-param";

const replaceMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/admin/users/user-2",
}));

function setSearch(search: string) {
  window.history.replaceState(null, "", `/admin/users/user-2${search}`);
}

describe("useSheetQueryParam", () => {
  beforeEach(() => {
    replaceMock.mockReset();
  });

  afterEach(() => {
    setSearch("");
  });

  it("starts closed without the param, open with ?sheet=open", () => {
    setSearch("");
    expect(renderHook(() => useSheetQueryParam()).result.current[0]).toBe(false);

    setSearch("?sheet=open");
    expect(renderHook(() => useSheetQueryParam()).result.current[0]).toBe(true);
  });

  it("ignores any other value of the param", () => {
    setSearch("?sheet=closed");
    expect(renderHook(() => useSheetQueryParam()).result.current[0]).toBe(false);
  });

  it("opens through router.replace without scrolling, keeping other params", () => {
    setSearch("?tab=profile");
    const { result } = renderHook(() => useSheetQueryParam());

    act(() => result.current[1](true));

    expect(result.current[0]).toBe(true);
    expect(replaceMock).toHaveBeenCalledWith("/admin/users/user-2?tab=profile&sheet=open", {
      scroll: false,
    });
  });

  it("closes by removing the param — bare pathname when nothing is left", () => {
    setSearch("?sheet=open");
    const { result } = renderHook(() => useSheetQueryParam());

    act(() => result.current[1](false));

    expect(result.current[0]).toBe(false);
    expect(replaceMock).toHaveBeenCalledWith("/admin/users/user-2", { scroll: false });
  });
});
