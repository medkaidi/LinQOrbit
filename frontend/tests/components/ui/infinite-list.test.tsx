import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

import { InfiniteList, type InfiniteListProps } from "@/components/ui/infinite-list";

function renderList(props: Partial<InfiniteListProps<string>> = {}) {
  const fetchNextPage = vi.fn();
  const view = render(
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
  return { fetchNextPage, ...view };
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

  it("applies the provided list classes instead of the default", () => {
    renderList({ listClassName: "grid grid-cols-1 gap-4 xl:grid-cols-2" });

    const list = screen.getByRole("list");
    expect(list).toHaveClass("grid", "xl:grid-cols-2");
    expect(list).not.toHaveClass("flex", "flex-col");
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

/**
 * jsdom ne fournit pas IntersectionObserver : le composant court-circuite
 * l'observation (le repli clavier sert alors de filet). Ces tests stubent
 * l'API pour exercer le vrai chemin d'auto-chargement.
 */
class MockIntersectionObserver {
  static instances: MockIntersectionObserver[] = [];

  observe = vi.fn();
  disconnect = vi.fn();
  private callback: IntersectionObserverCallback;

  constructor(callback: IntersectionObserverCallback) {
    this.callback = callback;
    MockIntersectionObserver.instances.push(this);
  }

  trigger(isIntersecting: boolean) {
    this.callback(
      [{ isIntersecting } as IntersectionObserverEntry],
      this as unknown as IntersectionObserver,
    );
  }
}

describe("InfiniteList — sentinel automatique", () => {
  beforeEach(() => {
    MockIntersectionObserver.instances = [];
    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("fetches the next page when the sentinel becomes visible, not otherwise", () => {
    const { fetchNextPage } = renderList();

    const observer = MockIntersectionObserver.instances.at(-1)!;
    expect(observer.observe).toHaveBeenCalledOnce();

    observer.trigger(false);
    expect(fetchNextPage).not.toHaveBeenCalled();

    observer.trigger(true);
    expect(fetchNextPage).toHaveBeenCalledOnce();
  });

  it("does not observe the sentinel while a page is already loading", () => {
    renderList({ isFetchingNextPage: true });

    expect(MockIntersectionObserver.instances).toHaveLength(0);
  });

  it("disconnects the observer on unmount", () => {
    const { unmount } = renderList();
    const observer = MockIntersectionObserver.instances.at(-1)!;

    unmount();

    expect(observer.disconnect).toHaveBeenCalledOnce();
  });
});
