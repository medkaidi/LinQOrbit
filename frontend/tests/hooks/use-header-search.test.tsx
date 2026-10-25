import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";

import { useHeaderSearch } from "@/hooks/use-header-search";
import { useHeaderSearchStore, type HeaderSearchRole } from "@/stores/header-search-store";

const board: HeaderSearchRole = { id: "board", label: "Search jobs", placeholder: "Board" };
const other: HeaderSearchRole = { id: "other", label: "Search other", placeholder: "Other" };

describe("useHeaderSearch", () => {
  beforeEach(() => {
    useHeaderSearchStore.setState({ role: null, query: "" });
  });

  it("declares the role while mounted and releases it on unmount", () => {
    const { unmount } = renderHook(() => useHeaderSearch(board));

    expect(useHeaderSearchStore.getState().role).toBe(board);

    unmount();

    expect(useHeaderSearchStore.getState().role).toBeNull();
  });

  it("returns what is typed in the header, and lets the page clear it", () => {
    const { result } = renderHook(() => useHeaderSearch(board));
    expect(result.current[0]).toBe("");

    act(() => useHeaderSearchStore.getState().setQuery("devops"));
    expect(result.current[0]).toBe("devops");

    act(() => result.current[1](""));
    expect(result.current[0]).toBe("");
    expect(useHeaderSearchStore.getState().query).toBe("");
  });

  it("does not leak another page text into this one", () => {
    useHeaderSearchStore.setState({ role: other, query: "foreign" });

    const { result } = renderHook(() => useHeaderSearch(board));

    // L'enregistrement remplace le rôle et repart d'une saisie vide.
    expect(result.current[0]).toBe("");
  });
});
