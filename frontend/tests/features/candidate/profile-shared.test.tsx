import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
  IdentityAvatar,
  countCompletedSections,
  countryLabel,
  fullName,
} from "@/features/candidate/profile-shared";
import type { AuthUser } from "@/types/auth";
import type { CandidateProfile } from "@/types/candidate";

const account: AuthUser = {
  id: "u1",
  email: "ada@example.com",
  firstName: "ada",
  lastName: "lovelace",
  sex: null,
  phone: null,
  homeCountry: null,
  currentCity: null,
  currentCountry: null,
  roles: [],
};

const emptyProfile: CandidateProfile = {
  about: { title: null, targetPosition: null, bio: null, yearsOfExperience: null, searchStatus: null },
  experiences: [],
  projects: [],
  diplomas: [],
  skills: [],
  languages: [],
  links: [],
  completionPercentage: 0,
  hasUnvalidatedChanges: false,
  normalizationFailed: false,
  normalizationInProgress: false,
};

describe("fullName", () => {
  it("joins first and last name", () => {
    expect(fullName({ ...account, firstName: "Ada", lastName: "Lovelace" })).toBe("Ada Lovelace");
  });

  it("trims when a part is empty", () => {
    expect(fullName({ ...account, firstName: "Ada", lastName: "" })).toBe("Ada");
    expect(fullName({ ...account, firstName: "", lastName: "" })).toBe("");
  });
});

describe("countryLabel", () => {
  it("resolves an ISO code to its english label", () => {
    expect(countryLabel("FR")).toBe("France");
  });

  it("returns an unknown code as-is and null for an absent one", () => {
    expect(countryLabel("ZZ")).toBe("ZZ");
    expect(countryLabel(null)).toBeNull();
    expect(countryLabel("")).toBeNull();
  });
});

describe("IdentityAvatar initials", () => {
  it("renders upper-cased initials", () => {
    render(<IdentityAvatar account={account} />);
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the disabled camera badge on demand", () => {
    render(<IdentityAvatar account={account} withCameraBadge />);
    expect(screen.getByRole("button", { name: "Change photo" })).toBeDisabled();
  });
});

describe("countCompletedSections (mirror of CandidateService.computeCompletion)", () => {
  it("counts nothing on an empty profile", () => {
    expect(countCompletedSections(emptyProfile)).toBe(0);
  });

  it("requires both a title and a bio for About — blanks do not count", () => {
    const about = emptyProfile.about;
    expect(countCompletedSections({ ...emptyProfile, about: { ...about, title: "Engineer" } })).toBe(0);
    expect(
      countCompletedSections({ ...emptyProfile, about: { ...about, title: "Engineer", bio: "   " } }),
    ).toBe(0);
    expect(
      countCompletedSections({ ...emptyProfile, about: { ...about, title: "Engineer", bio: "Bio" } }),
    ).toBe(1);
  });

  it("counts each non-empty list section, up to 7", () => {
    const one = [{}] as never[];
    expect(
      countCompletedSections({
        ...emptyProfile,
        about: { ...emptyProfile.about, title: "Engineer", bio: "Bio" },
        experiences: one,
        projects: one,
        diplomas: one,
        skills: one,
        languages: one,
        links: one,
      }),
    ).toBe(7);
    expect(countCompletedSections({ ...emptyProfile, skills: one, links: one })).toBe(2);
  });
});
