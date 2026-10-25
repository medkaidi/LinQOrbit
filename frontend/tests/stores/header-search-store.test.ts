import { beforeEach, describe, expect, it } from "vitest";

import { useHeaderSearchStore, type HeaderSearchRole } from "@/stores/header-search-store";

const board: HeaderSearchRole = { id: "board", label: "Search jobs", placeholder: "Board" };
const other: HeaderSearchRole = { id: "other", label: "Search other", placeholder: "Other" };

describe("header search store", () => {
  beforeEach(() => {
    useHeaderSearchStore.setState({ role: null, query: "" });
  });

  it("starts without a role and an empty query", () => {
    expect(useHeaderSearchStore.getState()).toMatchObject({ role: null, query: "" });
  });

  it("registering a role starts from an empty query, never the previous page text", () => {
    useHeaderSearchStore.getState().register(board);
    useHeaderSearchStore.getState().setQuery("devops");

    useHeaderSearchStore.getState().register(other);

    expect(useHeaderSearchStore.getState()).toMatchObject({ role: other, query: "" });
  });

  it("unregistering the current role clears the role and the query", () => {
    useHeaderSearchStore.getState().register(board);
    useHeaderSearchStore.getState().setQuery("devops");

    useHeaderSearchStore.getState().unregister("board");

    expect(useHeaderSearchStore.getState()).toMatchObject({ role: null, query: "" });
  });

  it("a page that was already replaced cannot unregister its successor", () => {
    useHeaderSearchStore.getState().register(board);
    useHeaderSearchStore.getState().register(other);
    useHeaderSearchStore.getState().setQuery("kept");

    useHeaderSearchStore.getState().unregister("board");

    expect(useHeaderSearchStore.getState()).toMatchObject({ role: other, query: "kept" });
  });
});
