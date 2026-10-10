import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getProfile,
  getReferenceDegrees,
  getReferenceLanguages,
  getReferenceSkills,
  getReferenceStudyFields,
  parseCv,
  updateAbout,
  updateDiplomas,
  updateExperiences,
  updateLanguages,
  updateLinks,
  updateProjects,
  updateSkills,
  validateProfile,
} from "@/lib/api/candidate.api";

vi.mock("@/lib/api/axios", () => ({
  api: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

import { api } from "@/lib/api/axios";

const mockedGet = vi.mocked(api.get);
const mockedPut = vi.mocked(api.put);
const mockedPost = vi.mocked(api.post);

describe("candidate.api", () => {
  beforeEach(() => {
    mockedGet.mockReset();
    mockedPut.mockReset();
    mockedPost.mockReset();
  });

  it("reads the profile once, without ever creating it", async () => {
    const profile = {
      about: { title: null },
      experiences: [],
      completionPercentage: 0,
      hasUnvalidatedChanges: false,
      normalizationFailed: false,
      normalizationInProgress: false,
    };
    mockedGet.mockResolvedValue({ data: profile });

    const result = await getProfile();

    expect(mockedGet).toHaveBeenCalledWith("/api/v1/candidates/me/profile");
    expect(mockedPut).not.toHaveBeenCalled();
    expect(result).toEqual(profile);
  });

  it("replaces the about section and sends an empty bio as null", async () => {
    await updateAbout({
      title: "Backend Engineer",
      bio: "",
      yearsOfExperience: 5,
      searchStatus: "open_to_work",
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/about", {
      title: "Backend Engineer",
      bio: null,
      yearsOfExperience: 5,
      searchStatus: "open_to_work",
    });
  });

  it("sends the whole experience list with empties as null", async () => {
    await updateExperiences({
      items: [
        {
          positionTitle: "Backend Engineer",
          companyName: "Acme",
          companyCountry: "",
          startDate: "2023-04-01",
          endDate: "",
          description: "",
        },
        {
          positionTitle: "Intern",
          companyName: "Acme",
          companyCountry: "FR",
          startDate: "2022-01-01",
          endDate: "2022-06-30",
          description: "Shipped features.",
        },
      ],
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/experiences", [
      {
        positionTitle: "Backend Engineer",
        companyName: "Acme",
        companyCountry: null,
        startDate: "2023-04-01",
        endDate: null,
        description: null,
      },
      {
        positionTitle: "Intern",
        companyName: "Acme",
        companyCountry: "FR",
        startDate: "2022-01-01",
        endDate: "2022-06-30",
        description: "Shipped features.",
      },
    ]);
  });

  it("sends the whole project list with empties as null", async () => {
    await updateProjects({
      items: [
        {
          name: "Portfolio",
          role: "",
          startDate: "2023-01-01",
          endDate: "",
          description: "",
          technologies: "Next.js, TypeScript",
        },
        {
          name: "Bot Discord",
          role: "Author",
          startDate: "2024-01-01",
          endDate: "2024-06-01",
          description: "Moderation bot.",
          technologies: "",
        },
      ],
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/projects", [
      {
        name: "Portfolio",
        role: null,
        startDate: "2023-01-01",
        endDate: null,
        description: null,
        technologies: "Next.js, TypeScript",
      },
      {
        name: "Bot Discord",
        role: "Author",
        startDate: "2024-01-01",
        endDate: "2024-06-01",
        description: "Moderation bot.",
        technologies: null,
      },
    ]);
  });

  it("keeps degree and study field references when they are empty", async () => {
    await updateDiplomas({
      items: [
        {
          title: "BSc Computer Science",
          institution: "Sorbonne",
          institutionCountry: "",
          degreeId: "",
          studyFieldId: "",
          startDate: "2018-09-01",
          endDate: "2021-06-30",
        },
        {
          title: "MSc Computer Science",
          institution: "Sorbonne",
          institutionCountry: "FR",
          degreeId: "7d9e0f1a-2b3c-4d5e-8f6a-1b2c3d4e5f60",
          studyFieldId: "7d9e0f1a-2b3c-4d5e-8f6a-1b2c3d4e5f61",
          startDate: "2021-09-01",
          endDate: "",
        },
      ],
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/diplomas", [
      {
        title: "BSc Computer Science",
        institution: "Sorbonne",
        institutionCountry: null,
        degreeId: null,
        studyFieldId: null,
        startDate: "2018-09-01",
        endDate: "2021-06-30",
      },
      {
        title: "MSc Computer Science",
        institution: "Sorbonne",
        institutionCountry: "FR",
        degreeId: "7d9e0f1a-2b3c-4d5e-8f6a-1b2c3d4e5f60",
        studyFieldId: "7d9e0f1a-2b3c-4d5e-8f6a-1b2c3d4e5f61",
        startDate: "2021-09-01",
        endDate: null,
      },
    ]);
  });

  it("converts skill years of experience to a number, or null when empty", async () => {
    const skillId = "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c";

    await updateSkills({
      items: [
        { skillId, level: 4, yearsExperience: "7" },
        { skillId: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3d", level: 2, yearsExperience: "" },
      ],
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/skills", [
      { skillId, level: 4, yearsExperience: 7 },
      { skillId: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3d", level: 2, yearsExperience: null },
    ]);
  });

  it("sends languages unchanged", async () => {
    await updateLanguages({
      items: [{ languageId: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c", level: "C1" }],
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/languages", [
      { languageId: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c", level: "C1" },
    ]);
  });

  it("keeps issuer and issue date only for certifications", async () => {
    await updateLinks({
      items: [
        {
          label: "AWS Solutions Architect",
          url: "https://aws.amazon.com/certification/",
          linkType: "certification",
          issuer: "AWS",
          issuedAt: "2024-05-01",
        },
        {
          label: "GitHub",
          url: "https://github.com/ada",
          linkType: "github",
          issuer: "AWS",
          issuedAt: "2024-05-01",
        },
      ],
    });

    expect(mockedPut).toHaveBeenCalledWith("/api/v1/candidates/me/profile/links", [
      {
        label: "AWS Solutions Architect",
        url: "https://aws.amazon.com/certification/",
        linkType: "certification",
        issuer: "AWS",
        issuedAt: "2024-05-01",
      },
      {
        label: "GitHub",
        url: "https://github.com/ada",
        linkType: "github",
        issuer: null,
        issuedAt: null,
      },
    ]);
  });

  it("fetches the four predefined lists from the reference endpoints", async () => {
    mockedGet.mockResolvedValue({ data: [] });

    await getReferenceSkills();
    await getReferenceLanguages();
    await getReferenceDegrees();
    await getReferenceStudyFields();

    expect(mockedGet.mock.calls.map((call) => call[0])).toEqual([
      "/api/v1/candidates/reference/skills",
      "/api/v1/candidates/reference/languages",
      "/api/v1/candidates/reference/degrees",
      "/api/v1/candidates/reference/study-fields",
    ]);
  });

  it("triggers the normalization job on explicit validation", async () => {
    mockedPost.mockResolvedValue({ data: undefined });

    await validateProfile();

    expect(mockedPost).toHaveBeenCalledWith("/api/v1/candidates/me/profile/validate");
    expect(mockedPut).not.toHaveBeenCalled();
    expect(mockedGet).not.toHaveBeenCalled();
  });

  it("uploads the CV as multipart form data and returns the parsed structure", async () => {
    const parsed = {
      title: "Backend Engineer",
      summary: null,
      experiences: [],
      diplomas: [],
      skills: [],
      languages: [],
      links: [],
    };
    mockedPost.mockResolvedValue({ data: parsed });
    const file = new File(["%PDF-1.4"], "cv.pdf", { type: "application/pdf" });

    const result = await parseCv(file);

    expect(mockedPost).toHaveBeenCalledTimes(1);
    const [url, body] = mockedPost.mock.calls[0];
    expect(url).toBe("/api/v1/candidates/me/profile/cv");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
    expect(result).toEqual(parsed);
  });
});
