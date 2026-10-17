import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PublicJobLoading, PublicJobNotFound } from "@/features/job-offer/public-job-states";

describe("public job states", () => {
  it("explains every not-found cause under a single h1", () => {
    render(<PublicJobNotFound />);
    expect(screen.getByRole("heading", { level: 1, name: "Job not found" })).toBeInTheDocument();
    expect(
      screen.getByText("This job offer does not exist, is no longer published, or has expired."),
    ).toBeInTheDocument();
  });

  it("shows a loading line", () => {
    render(<PublicJobLoading />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
