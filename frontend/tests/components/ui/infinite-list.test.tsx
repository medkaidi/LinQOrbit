import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { InfiniteList, type InfiniteListProps } from "@/components/ui/infinite-list";

function renderList(props: Partial<InfiniteListProps<string>> = {}) {
  const fetchNextPage = vi.fn();
  render(
    <InfiniteList
      items={["alpha", "beta"]}
      keyExtractor={(item) => item}
      renderItem={(item) => <li>{item}</li>}
      hasNextPage
      isFetchingNextPage={false}
      fetchNextPage={fetchNextPage}
      {...props}
    />,
  );
  return { fetchNextPage };
}

describe("InfiniteList", () => {
  it("renders each item through renderItem inside a list", () => {
    renderList();

    expect(screen.getByText("alpha")).toBeInTheDocument();
    expect(screen.getByText("beta")).toBeInTheDocument();
    expect(screen.getByRole("list")).toBeInTheDocument();
  });

  it("fetches the next page through the accessible load-more fallback", () => {
    const { fetchNextPage } = renderList();

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));

    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("disables load-more and shows progress while the next page fetches", () => {
    renderList({ isFetchingNextPage: true });

    expect(screen.getByText("Loading more…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Load more" })).toBeDisabled();
  });

  it("hides load-more on the last page", () => {
    renderList({ hasNextPage: false });

    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
    expect(screen.queryByText("Loading more…")).not.toBeInTheDocument();
  });

  it("shows the empty message when there is nothing to render", () => {
    renderList({ items: [], empty: <p>Nothing here</p> });

    expect(screen.getByText("Nothing here")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("stays silent while the first page is still loading", () => {
    renderList({ items: [], loading: true, empty: <p>Nothing here</p> });

    expect(screen.queryByText("Nothing here")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });

  it("stays silent without an empty message on an empty list", () => {
    renderList({ items: [] });

    expect(screen.queryByRole("list")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).not.toBeInTheDocument();
  });
});
