import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { SkillsTable } from "@/features/admin/normalized/normalized-skills-table";

describe("SkillsTable", () => {
  it("renders the given headers and the view-specific cells between Skill and Evidence", () => {
    render(
      <SkillsTable
        columns={["Skill", "Level", "Evidence", "Origin"]}
        minWidthClass="min-w-[540px]"
        rows={[
          {
            skill: {
              name: "Java",
              category: "programming_language",
              origin: "declared",
              evidence: [{ source: "experiences", index: 0 }],
            },
            cells: <td>4/5</td>,
          },
        ]}
      />,
    );

    expect(screen.getByRole("table")).toHaveClass("min-w-[540px]");
    expect(screen.getAllByRole("columnheader").map((header) => header.textContent)).toEqual([
      "Skill",
      "Level",
      "Evidence",
      "Origin",
    ]);
    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent("Java");
    expect(cells[1]).toHaveTextContent("4/5");
  });

  it("tolerates a v1 skill with every field absent", () => {
    render(
      <SkillsTable
        columns={["Skill", "Evidence", "Origin"]}
        minWidthClass="min-w-0"
        rows={[{ skill: {}, cells: null }]}
      />,
    );

    const cells = within(screen.getAllByRole("row")[1]).getAllByRole("cell");
    expect(cells[0]).toHaveTextContent("Unnamed skill");
    expect(cells[1]).toHaveTextContent("—");
    expect(cells[2]).toHaveTextContent("—");
  });

  it("renders an empty body without rows", () => {
    render(<SkillsTable columns={["Skill"]} minWidthClass="min-w-0" rows={[]} />);
    expect(screen.getAllByRole("row")).toHaveLength(1);
  });
});
