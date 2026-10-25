import { fireEvent, render, screen } from "@testing-library/react";
import { AxiosError } from "axios";
import { describe, expect, it, vi } from "vitest";

import { LoadError } from "@/components/ui/load-error";

function apiError(detail: string): AxiosError {
  const error = new AxiosError("Request failed");
  error.response = { data: { detail }, status: 500, statusText: "", headers: {}, config: {} as never };
  return error;
}

describe("LoadError", () => {
  it("shows the title, the API message and a Retry button", () => {
    render(<LoadError title="Could not load your activity" error={apiError("Database down")} onRetry={vi.fn()} />);

    const alert = screen.getByRole("status");
    expect(alert).toHaveTextContent("Could not load your activity");
    expect(alert).toHaveTextContent("Database down");
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("calls onRetry once per click on Retry", () => {
    const onRetry = vi.fn();
    render(<LoadError title="Could not load" error={apiError("x")} onRetry={onRetry} />);

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("falls back to a generic message when the error is not an API error", () => {
    render(<LoadError title="Could not load" error={undefined} onRetry={vi.fn()} />);

    expect(screen.getByRole("status")).toHaveTextContent("Something went wrong. Please try again.");
  });
});
