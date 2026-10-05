import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return {
    ...actual,
    getReferenceSkills: vi.fn(),
    updateSkills: vi.fn(),
  };
});

import { SkillsSection } from "@/features/candidate/skills-section";
import { getReferenceSkills, updateSkills } from "@/lib/api/candidate.api";
import type { SkillItem } from "@/types/candidate";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

const mockedGetReferenceSkills = vi.mocked(getReferenceSkills);
const mockedUpdateSkills = vi.mocked(updateSkills);

const JAVA = "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c";
const COMMUNICATION = "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3d";

const reference = [
  { id: JAVA, name: "Java", skillType: "hard" },
  { id: COMMUNICATION, name: "Communication", skillType: "soft" },
];

const existingSkill: SkillItem = {
  skillId: JAVA,
  name: "Java",
  skillType: "hard",
  level: 4,
  yearsExperience: 7,
};

function renderSection(skills: SkillItem[] = []) {
  return renderWithQueryClient(<SkillsSection skills={skills} />);
}

async function whenReferenceIsReady(expectedRows: number) {
  await waitFor(() => expect(mockedGetReferenceSkills).toHaveBeenCalled());
  await waitFor(() => {
    const triggers = screen.getAllByRole("combobox", { name: "Skill" });
    expect(triggers).toHaveLength(expectedRows);
    triggers.forEach((trigger) => expect(trigger).toBeEnabled());
  });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

describe("SkillsSection", () => {
  beforeEach(() => {
    mockedGetReferenceSkills.mockReset();
    mockedGetReferenceSkills.mockResolvedValue(reference);
    mockedUpdateSkills.mockReset();
    mockedUpdateSkills.mockResolvedValue(undefined);
  });

  it("starts with an empty state and adds a row on demand", async () => {
    renderSection();

    expect(
      screen.getByText("No skill added yet. Start with what you use every day."),
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    expect(screen.getByText("Skill 1")).toBeInTheDocument();

    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[0]);
    expect(
      screen.getByText("No skill added yet. Start with what you use every day."),
    ).toBeInTheDocument();
  });

  it("refuses to save a row without a skill or a level", async () => {
    renderSection();
    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));
    save();

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Skill" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
    expect(mockedUpdateSkills).not.toHaveBeenCalled();
  });

  it("does not offer a skill that another row already uses", async () => {
    renderSection([existingSkill]);
    await whenReferenceIsReady(1);

    fireEvent.click(screen.getByRole("button", { name: "Add skill" }));

    const triggers = screen.getAllByRole("combobox", { name: "Skill" });
    fireEvent.click(triggers[1]);

    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual([
      "Communication",
    ]);
  });

  it("saves the rows as they are, with years kept as typed", async () => {
    renderSection([existingSkill]);
    await whenReferenceIsReady(1);

    fireEvent.change(screen.getByLabelText("Years"), { target: { value: "8" } });
    save();

    expect(await screen.findByText("Section saved")).toBeInTheDocument();
    expect(screen.getByText("Your skills are live on your profile.")).toBeInTheDocument();
    expect(mockedUpdateSkills).toHaveBeenCalledWith({
      items: [{ skillId: JAVA, level: 4, yearsExperience: "8" }],
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });
});
