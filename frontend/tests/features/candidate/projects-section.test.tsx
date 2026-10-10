import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return {
    ...actual,
    updateProjects: vi.fn(),
  };
});

import { ProjectsSection } from "@/features/candidate/projects-section";
import { updateProjects } from "@/lib/api/candidate.api";
import type { ProjectItem } from "@/types/candidate";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

const mockedUpdateProjects = vi.mocked(updateProjects);

const existingProject: ProjectItem = {
  id: "p1",
  name: "Portfolio",
  role: "Author",
  startDate: "2023-01-01",
  endDate: null,
  description: "Personal site.",
  technologies: "Next.js, TypeScript",
};

function renderSection(projects: ProjectItem[] = []) {
  return renderWithQueryClient(<ProjectsSection projects={projects} />);
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("ProjectsSection", () => {
  beforeEach(() => {
    mockedUpdateProjects.mockReset();
    mockedUpdateProjects.mockResolvedValue(undefined);
  });

  it("starts with an empty state and adds a row on demand", async () => {
    renderSection();

    expect(
      screen.getByText(
        "No project added yet. Side projects, open-source work and academic builds all count.",
      ),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    expect(screen.getByText("Project 1")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(
      screen.getByText(
        "No project added yet. Side projects, open-source work and academic builds all count.",
      ),
    ).toBeInTheDocument();
  });

  it("refuses to save a row without a name or a start date", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));
    save();

    await waitFor(() => {
      expect(screen.getByLabelText("Project name")).toHaveAttribute("aria-invalid", "true");
      expect(screen.getByLabelText("Start date")).toHaveAttribute("aria-invalid", "true");
    });
    expect(mockedUpdateProjects).not.toHaveBeenCalled();
  });

  it("rejects an end date before the start date", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Add project" }));

    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Bot" } });
    fireEvent.change(screen.getByLabelText("Start date"), { target: { value: "2024-01-01" } });
    fireEvent.change(screen.getByLabelText("End date"), { target: { value: "2023-06-01" } });
    save();

    await waitFor(() => {
      expect(screen.getByLabelText("End date")).toHaveAttribute("aria-invalid", "true");
    });
    expect(mockedUpdateProjects).not.toHaveBeenCalled();
  });

  it("saves the rows as they are, keeping empty optionals as empty strings", async () => {
    renderSection([existingProject]);

    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "" } });
    save();

    expect(await screen.findByText("Section saved")).toBeInTheDocument();
    expect(screen.getByText("Your projects list is live on your profile.")).toBeInTheDocument();
    expect(mockedUpdateProjects).toHaveBeenCalledWith({
      items: [
        {
          name: "Portfolio",
          role: "",
          startDate: "2023-01-01",
          endDate: "",
          description: "Personal site.",
          technologies: "Next.js, TypeScript",
        },
      ],
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
