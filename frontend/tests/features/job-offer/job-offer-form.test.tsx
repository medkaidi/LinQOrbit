import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { JobOfferForm } from "@/features/job-offer/job-offer-form";
import type { Company, JobOffer } from "@/types/recruiter";

const pushMock = vi.hoisted(() => vi.fn());
const createMutateMock = vi.hoisted(() => vi.fn());
const updateMutateMock = vi.hoisted(() => vi.fn());

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
}));

vi.mock("@/hooks/use-candidate-profile", () => ({
  useReferenceSkills: () => ({
    data: [{ id: "s1", name: "React" }],
    isLoading: false,
    isError: false,
  }),
  useReferenceLanguages: () => ({
    data: [{ id: "l1", name: "English" }],
    isLoading: false,
    isError: false,
  }),
  useReferenceDegrees: () => ({
    data: [
      { id: "d1", label: "Bachelor's degree" },
      { id: "d2", label: "Master's degree" },
    ],
    isLoading: false,
    isError: false,
  }),
  useReferenceStudyFields: () => ({
    data: [{ id: "f1", label: "Computer Science" }],
    isLoading: false,
    isError: false,
  }),
}));

vi.mock("@/hooks/use-job-offers", () => ({
  useContractTypes: () => ({
    data: [{ id: "c1", label: "Permanent" }],
    isLoading: false,
    isError: false,
  }),
  useEmploymentTypes: () => ({
    data: [{ id: "e1", label: "Full-time" }],
    isLoading: false,
    isError: false,
  }),
  useWorkModes: () => ({
    data: [{ id: "w1", label: "Remote" }],
    isLoading: false,
    isError: false,
  }),
  useCreateJobOffer: () => ({ mutate: createMutateMock, isPending: false, error: null }),
  useUpdateJobOffer: () => ({ mutate: updateMutateMock, isPending: false, error: null }),
}));

const companies: Company[] = [
  { id: "co1", name: "Nimbus Labs", description: null, isOwner: true },
];

function renderForm() {
  return render(<JobOfferForm mode="create" companies={companies} />);
}

describe("JobOfferForm", () => {
  beforeEach(() => {
    pushMock.mockClear();
    createMutateMock.mockClear();
    updateMutateMock.mockClear();
  });

  it("renders the skills section with the Add skill button under the list", () => {
    renderForm();

    const addSkill = screen.getByRole("button", { name: "Add skill" });
    expect(addSkill.closest("header")).toBeNull();
    expect(
      screen.getByText(/No skills yet/).compareDocumentPosition(addSkill) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("adds and removes skill rows from the bottom button", () => {
    renderForm();

    const addSkill = screen.getByRole("button", { name: "Add skill" });
    fireEvent.click(addSkill);
    fireEvent.click(addSkill);

    expect(screen.getAllByRole("combobox", { name: "Skill" })).toHaveLength(2);

    const removeButtons = screen.getAllByRole("button", { name: "Remove" });
    fireEvent.click(removeButtons[1]);

    expect(screen.getAllByRole("combobox", { name: "Skill" })).toHaveLength(1);
  });

  it("adds language rows from the bottom button", () => {
    renderForm();

    fireEvent.click(screen.getByRole("button", { name: "Add language" }));

    expect(screen.getByRole("combobox", { name: "Language" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Required" })).toBeInTheDocument();
  });

  it("offers degrees as a tag input without row buttons", () => {
    renderForm();

    expect(screen.queryByRole("button", { name: "Add degree" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add field of study" })).not.toBeInTheDocument();

    const degrees = screen.getByRole("combobox", { name: "Degrees" });
    fireEvent.focus(degrees);
    fireEvent.change(degrees, { target: { value: "Master" } });
    fireEvent.keyDown(degrees, { key: "Enter" });

    expect(screen.getByRole("button", { name: "Remove Master's degree" })).toBeInTheDocument();
  });

  it("removes a degree chip", () => {
    renderForm();

    const degrees = screen.getByRole("combobox", { name: "Degrees" });
    fireEvent.focus(degrees);
    fireEvent.click(screen.getByRole("option", { name: /Bachelor/ }));
    fireEvent.click(screen.getByRole("button", { name: "Remove Bachelor's degree" }));

    expect(screen.queryByRole("button", { name: "Remove Bachelor's degree" })).not.toBeInTheDocument();
  });

  it("adds a field of study chip via the suggestion list", () => {
    renderForm();

    const fields = screen.getByRole("combobox", { name: "Fields of study" });
    fireEvent.focus(fields);
    fireEvent.click(screen.getByRole("option", { name: /Computer Science/ }));

    expect(
      screen.getByRole("button", { name: "Remove Computer Science" }),
    ).toBeInTheDocument();
  });

  it("renders the description as a rich text zone", () => {
    renderForm();

    expect(screen.getByText("Description")).toBeInTheDocument();
    expect(screen.getByRole("toolbar", { name: "Text formatting" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Description" })).toBeInTheDocument();
  });

  it("adds a screening question and clears its options when the type stops being a choice", () => {
    renderForm();

    expect(screen.getByText(/No screening questions yet/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add question" }));

    expect(screen.getByRole("textbox", { name: "Question 1" })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Required" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Add option" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Single choice" }));
    fireEvent.click(screen.getByRole("button", { name: "Add option" }));
    fireEvent.change(screen.getByRole("textbox", { name: "Option 1" }), {
      target: { value: "Remote" },
    });

    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Text answer" }));
    expect(screen.queryByRole("textbox", { name: "Option 1" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Type" }));
    fireEvent.click(screen.getByRole("option", { name: "Single choice" }));
    expect(screen.queryByRole("textbox", { name: "Option 1" })).not.toBeInTheDocument();
  });

  it("moves a screening question down with the reorder buttons", () => {
    renderForm();

    const addQuestion = screen.getByRole("button", { name: "Add question" });
    fireEvent.click(addQuestion);
    fireEvent.click(addQuestion);
    fireEvent.change(screen.getByRole("textbox", { name: "Question 1" }), {
      target: { value: "First?" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: "Question 2" }), {
      target: { value: "Second?" },
    });

    fireEvent.click(screen.getAllByRole("button", { name: "Move question down" })[0]);

    expect(screen.getByRole("textbox", { name: "Question 1" })).toHaveValue("Second?");
    expect(screen.getByRole("textbox", { name: "Question 2" })).toHaveValue("First?");
  });

  it("renders the submit CTA", () => {
    renderForm();

    expect(screen.getByRole("button", { name: "Create offer" })).toBeInTheDocument();
  });

  it("shows a single level error when submitting a language without a level", async () => {
    // companyId doit être un UUID valide pour que le schéma de base passe
    // (sinon Zod saute les superRefine, dont « Pick a level »).
    render(
      <JobOfferForm
        mode="create"
        companies={[{ id: "33333333-3333-4333-8333-333333333333", name: "Nimbus Labs", description: null, isOwner: true }]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Backend Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add language" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Language" }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));

    fireEvent.click(screen.getByRole("button", { name: "Create offer" }));

    await waitFor(() => {
      expect(screen.getByRole("combobox", { name: "Level" })).toHaveAttribute(
        "aria-invalid",
        "true",
      );
    });
    // Le placeholder « Pick a level » vit dans le trigger ; l'erreur est le seul
    // autre nœud portant ce texte — régression : elle s'affichait deux fois.
    const errorNodes = screen
      .getAllByText("Pick a level")
      .filter((node) => node.tagName === "P");
    expect(errorNodes).toHaveLength(1);
  });

  it("shows the skills root error when submitting without any skill", async () => {
    render(
      <JobOfferForm
        mode="create"
        companies={[
          {
            id: "33333333-3333-4333-8333-333333333333",
            name: "Nimbus Labs",
            description: null,
            isOwner: true,
          },
        ]}
      />,
    );

    fireEvent.change(screen.getByRole("textbox", { name: "Title" }), {
      target: { value: "Backend Engineer" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create offer" }));

    await waitFor(() => {
      expect(screen.getByText("Add at least one skill")).toBeInTheDocument();
    });
  });

  describe("Max AI questions", () => {
    const COMPANY_ID = "33333333-3333-4333-8333-333333333333";

    function editableOffer(overrides: Partial<JobOffer> = {}): JobOffer {
      return {
        id: "o1",
        companyId: COMPANY_ID,
        recruiterId: "r1",
        status: "draft",
        title: "Backend Engineer",
        publicId: "abcdefghijkl",
        slug: "backend-engineer",
        description: "<p>Build APIs.</p>",
        seniority: null,
        requiredExpYear: null,
        city: null,
        country: "FR",
        contractTypeId: null,
        employmentTypeId: "e0000000-0000-4000-8000-0000000000e1",
        workModeId: null,
        validatedAt: null,
        publishedAt: null,
        expiresAt: null,
        salaryMin: null,
        salaryMax: null,
        salaryCurrency: null,
        salaryPeriod: null,
        hasUnvalidatedChanges: false,
        normalizationInProgress: false,
        normalizationFailed: false,
        analysisOutdated: false,
        skills: [
          {
            skillId: "a0000000-0000-4000-8000-000000000001",
            name: "Java",
            requirementType: "mandatory",
            weight: 3,
            yearsExperience: null,
          },
        ],
        languages: [],
        degreeIds: [],
        studyFieldIds: [],
        questions: [],
        maxClarificationQuestions: 5,
        createdAt: "2026-01-01T00:00:00Z",
        updatedAt: "2026-01-01T00:00:00Z",
        ...overrides,
      };
    }

    const capField = () => screen.getByRole("textbox", { name: /Max AI questions/ });

    it("defaults to 3 on a new offer", () => {
      renderForm();

      expect(capField()).toHaveValue("3");
    });

    it("loads the cap of the edited offer", () => {
      render(<JobOfferForm mode="edit" offer={editableOffer()} companies={companies} />);

      expect(capField()).toHaveValue("5");
    });

    it("sends the edited cap with the update", async () => {
      render(<JobOfferForm mode="edit" offer={editableOffer()} companies={companies} />);

      fireEvent.change(capField(), { target: { value: "7" } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(updateMutateMock).toHaveBeenCalled());
      expect(updateMutateMock.mock.calls[0][0]).toEqual({
        offerId: "o1",
        values: expect.objectContaining({ maxClarificationQuestions: "7" }),
      });
    });

    it("sends 0 to disable the AI questions", async () => {
      render(<JobOfferForm mode="edit" offer={editableOffer()} companies={companies} />);

      fireEvent.change(capField(), { target: { value: "0" } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      await waitFor(() => expect(updateMutateMock).toHaveBeenCalled());
      expect(updateMutateMock.mock.calls[0][0].values.maxClarificationQuestions).toBe("0");
    });

    it.each([
      ["11", "Max AI questions must be at most 10"],
      ["-1", "Max AI questions must be at least 0"],
      ["2.5", "Max AI questions must be a whole number"],
    ])("rejects %s with the backend message", async (value, message) => {
      render(<JobOfferForm mode="edit" offer={editableOffer()} companies={companies} />);

      fireEvent.change(capField(), { target: { value } });
      fireEvent.click(screen.getByRole("button", { name: "Save changes" }));

      expect(await screen.findByText(message)).toBeInTheDocument();
      expect(capField()).toHaveAttribute("aria-invalid", "true");
      expect(updateMutateMock).not.toHaveBeenCalled();
    });
  });
});
