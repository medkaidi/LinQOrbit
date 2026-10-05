import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";

vi.mock("@/lib/api/candidate.api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api/candidate.api")>();
  return { ...actual, updateAbout: vi.fn() };
});

import { AboutSection } from "@/features/candidate/about-section";
import { updateAbout, type AboutSection as AboutSectionData } from "@/lib/api/candidate.api";
import { renderWithQueryClient } from "@/tests/helpers/test-utils";

const mockedUpdateAbout = vi.mocked(updateAbout);

const about: AboutSectionData = {
  title: "Backend Engineer",
  targetPosition: null,
  bio: "I build APIs that scale.",
  yearsOfExperience: 5,
  searchStatus: "open_to_work",
};

function renderSection(data: AboutSectionData = about) {
  return renderWithQueryClient(<AboutSection about={data} />);
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

function typeTitle(value: string) {
  fireEvent.change(screen.getByLabelText("Professional title"), { target: { value } });
}

describe("AboutSection", () => {
  beforeEach(() => {
    mockedUpdateAbout.mockReset();
    mockedUpdateAbout.mockResolvedValue(undefined);
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
      expect(screen.getByLabelText("Professional title")).toHaveValue("Backend Engineer");
    });
    expect(screen.getByRole("button", { name: "Save changes" })).toBeDisabled();
    expect(mockedUpdateAbout).not.toHaveBeenCalled();
  });
});
