import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  LINK_ACCENT_CLASS,
  PageHeader,
} from "@/components/layout/page-header";

const breadcrumb = (
  <Breadcrumb>
    <BreadcrumbLink href="/dashboard">Candidate space</BreadcrumbLink>
    <BreadcrumbSeparator />
    <BreadcrumbCurrent>My applications</BreadcrumbCurrent>
  </Breadcrumb>
);

describe("PageHeader", () => {
  it("renders the breadcrumb and a single h1", () => {
    render(<PageHeader breadcrumb={breadcrumb} title="My applications" />);

    const nav = screen.getByRole("navigation", { name: "Breadcrumb" });
    expect(nav).toHaveTextContent("Candidate space/My applications");
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("My applications");
  });

  it("gives breadcrumb links the shared accent and hides the separator", () => {
    render(<PageHeader breadcrumb={breadcrumb} title="Title" />);

    const link = screen.getByRole("link", { name: "Candidate space" });
    expect(link).toHaveAttribute("href", "/dashboard");
    for (const name of LINK_ACCENT_CLASS.split(" ")) {
      expect(link).toHaveClass(name);
    }
    expect(screen.getByText("/")).toHaveAttribute("aria-hidden", "true");
  });

  it("omits subtitle and action when absent", () => {
    const { container } = render(<PageHeader breadcrumb={breadcrumb} title="Title" />);
    expect(container.querySelector("p")).toBeNull();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders the subtitle, the action and extra children", () => {
    render(
      <PageHeader
        as="header"
        breadcrumb={breadcrumb}
        title="Title"
        subtitle="Every section saves on its own."
        action={<button type="button">New offer</button>}
      >
        <span>ada@example.com</span>
      </PageHeader>,
    );

    expect(screen.getByRole("banner")).toBeInTheDocument();
    expect(screen.getByText("Every section saves on its own.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "New offer" })).toBeInTheDocument();
    expect(screen.getByText("ada@example.com")).toBeInTheDocument();
  });
});
