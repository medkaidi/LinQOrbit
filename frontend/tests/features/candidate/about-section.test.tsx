import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, updateAbout: vi.fn() };
});

vi.mock("@/lib/api/auth.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/auth.api")>();
  return { ...actual, me: vi.fn(), updateProfile: vi.fn() };
});

import { AboutSection } from "@/features/candidate/about-section";
import { updateAbout } from "@/lib/api/candidate.api";
import { me, updateProfile } from "@/lib/api/auth.api";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";
import type { AuthUser } from "@/types/auth";
import type { AboutSection as AboutSectionData, ParsedCv } from "@/types/candidate";

const mockedUpdateAbout = vi.mocked(updateAbout);
const mockedMe = vi.mocked(me);
const mockedUpdateProfile = vi.mocked(updateProfile);

const about: AboutSectionData = {
  title: "Backend Engineer",
  targetPosition: null,
  bio: "I build APIs that scale.",
  yearsOfExperience: 5,
  searchStatus: "open_to_work",
};

const accountUser: AuthUser = {
  id: "3f0a1b2c-0d3e-4f5a-8b6c-7d9e0f1a2b3c",
  email: "ada@example.com",
  firstName: "Ada",
  lastName: "Lovelace",
  sex: "female",
  phone: "+1 555 000 0000",
  homeCountry: "GB",
  currentCity: "Paris",
  currentCountry: "FR",
};

function renderSection(data: AboutSectionData = about, cvImport?: ParsedCv) {
  return renderWithQueryClient(<AboutSection about={data} cvImport={cvImport} />);
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

function typeTitle(value: string) {
  fireEvent.change(screen.getByLabelText("Current position"), { target: { value } });
}

describe("AboutSection", () => {
  beforeEach(() => {
    mockedUpdateAbout.mockReset();
    mockedUpdateAbout.mockResolvedValue(undefined);
    mockedMe.mockReset();
    mockedMe.mockRejectedValue(new Error("no account in this test"));
    mockedUpdateProfile.mockReset();
    mockedUpdateProfile.mockResolvedValue(accountUser);
  });

  it("keeps save and discard disabled until the form changes", () => {
    renderSection();

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeDisabled();

    typeTitle("Senior Backend Engineer");

    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Discard" })).toBeEnabled();
  });

  it("refuses to save without a search status", async () => {
    renderSection({ ...about, searchStatus: null });
    typeTitle("Senior Backend Engineer");
    save();

    expect(await screen.findByText("Please select a search status")).toBeInTheDocument();
    expect(mockedUpdateAbout).not.toHaveBeenCalled();
  });

  it("rejects more than 60 years of experience", async () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("Years of experience"), { target: { value: "99" } });
    save();

    expect(await screen.findByText("Years of experience must be 60 or fewer")).toBeInTheDocument();
    expect(mockedUpdateAbout).not.toHaveBeenCalled();
  });

  it("saves the section and confirms it", async () => {
    renderSection();
    fireEvent.change(screen.getByLabelText("About you"), {
      target: { value: "I design and ship APIs used by thousands." },
    });
    save();

    expect(await screen.findByText("Section saved")).toBeInTheDocument();
    expect(
      await screen.findByText("Your changes are live on your profile."),
    ).toBeInTheDocument();
    expect(mockedUpdateAbout).toHaveBeenCalledWith({
      title: "Backend Engineer",
      bio: "I design and ship APIs used by thousands.",
      yearsOfExperience: 5,
      searchStatus: "open_to_work",
    });

    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("reports a server failure in the section footer", async () => {
    mockedUpdateAbout.mockRejectedValueOnce(new Error("boom"));
    renderSection();
    typeTitle("Senior Backend Engineer");
    save();

    expect(await screen.findByText("Could not save this section")).toBeInTheDocument();
    expect(screen.getByText("Something went wrong. Please try again.")).toBeInTheDocument();
  });

  it("discards local edits and restores the server values", async () => {
    renderSection();
    typeTitle("Senior Backend Engineer");
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => {
      expect(screen.getByLabelText("Current position")).toHaveValue("Backend Engineer");
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(mockedUpdateAbout).not.toHaveBeenCalled();
  });

  it("never saves the account when the account is unknown", async () => {
    renderSection();
    typeTitle("Senior Backend Engineer");
    save();

    expect(await screen.findByText("Section saved")).toBeInTheDocument();
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
  });
});

describe("AboutSection with a known account", () => {
  beforeEach(() => {
    mockedUpdateAbout.mockReset();
    mockedUpdateAbout.mockResolvedValue(undefined);
    mockedMe.mockReset();
    mockedMe.mockResolvedValue(accountUser);
    mockedUpdateProfile.mockReset();
    mockedUpdateProfile.mockResolvedValue(accountUser);
  });

  it("shows the account identity with the avatar inside the section", async () => {
    renderSection();

    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Last name")).toHaveValue("Lovelace");
    expect(screen.getByLabelText("Current position")).toHaveValue("Backend Engineer");
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 555 000 0000");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByText("AL")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Change photo" })).toBeDisabled();
    expect(screen.queryByLabelText("Target position")).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Personal Information" })).toBeInTheDocument();
  });

  it("saves the account fields and the about fields in one save", async () => {
    renderSection();
    await screen.findByLabelText("First name");

    fireEvent.change(screen.getByLabelText("About you"), {
      target: { value: "I design and ship APIs used by thousands." },
    });
    save();

    expect(await screen.findByText("Section saved")).toBeInTheDocument();
    expect(mockedUpdateAbout).toHaveBeenCalledWith({
      title: "Backend Engineer",
      bio: "I design and ship APIs used by thousands.",
      yearsOfExperience: 5,
      searchStatus: "open_to_work",
    });
    expect(mockedUpdateProfile).toHaveBeenCalledWith({
      firstName: "Ada",
      lastName: "Lovelace",
      phone: "+1 555 000 0000",
      currentCity: "Paris",
      currentCountry: "FR",
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
  });

  it("refuses to save when an identity field is missing", async () => {
    renderSection();
    await screen.findByLabelText("First name");

    fireEvent.change(screen.getByLabelText("First name"), { target: { value: "" } });
    save();

    expect(await screen.findByText("First name is required")).toBeInTheDocument();
    expect(mockedUpdateAbout).not.toHaveBeenCalled();
    expect(mockedUpdateProfile).not.toHaveBeenCalled();
  });

  it("keeps the account fields when a CV import is applied", async () => {
    renderSection(about, {
      title: "Staff Engineer",
      summary: null,
      experiences: [],
      diplomas: [],
      skills: [],
      languages: [],
      links: [],
    });

    expect(await screen.findByLabelText("First name")).toHaveValue("Ada");
    expect(screen.getByLabelText("Phone")).toHaveValue("+1 555 000 0000");
    await waitFor(() => {
      expect(screen.getByLabelText("Current position")).toHaveValue("Staff Engineer");
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled();
  });
});
