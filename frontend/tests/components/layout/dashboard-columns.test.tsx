import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardColumns } from "@/components/layout/dashboard-columns";

function renderColumns() {
  return render(
    <DashboardColumns
      figures={
        <>
          <p>First figure</p>
          <p>Second figure</p>
        </>
      }
      actions={<p>An action</p>}
    />,
  );
}

describe("DashboardColumns", () => {
  it("puts the figures in the wide left column and the actions in the narrow right one", () => {
    renderColumns();

    expect(screen.getByText("First figure").parentElement).toHaveClass("lg:col-span-7");
    expect(screen.getByText("An action").parentElement).toHaveClass("lg:col-span-5");
  });

  it("reads figures before actions in the document, left to right", () => {
    renderColumns();

    const figure = screen.getByText("First figure");
    const action = screen.getByText("An action");
    expect(figure.compareDocumentPosition(action) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("brings the actions first below lg, and back to the right from lg", () => {
    renderColumns();

    expect(screen.getByText("An action").parentElement).toHaveClass("order-first", "lg:order-none");
    expect(screen.getByText("First figure").parentElement).not.toHaveClass("order-first");
  });

  it("keeps the children of a column in the order given", () => {
    renderColumns();

    const first = screen.getByText("First figure");
    const second = screen.getByText("Second figure");
    expect(first.parentElement).toBe(second.parentElement);
    expect(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
