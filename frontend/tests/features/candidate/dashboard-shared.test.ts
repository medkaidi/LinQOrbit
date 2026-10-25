import { describe, expect, it } from "vitest";

import {
  draftsLabel,
  invitationsLabel,
  nextSteps,
  profileStateLabel,
  sentApplicationCount,
  totalApplicationCount,
} from "@/features/candidate/dashboard-shared";
import { buildDashboard, buildDashboardProfile } from "@/tests/helpers/dashboard-fixtures";
import type { CvAttachment } from "@/types/candidate";

const counts = { draft: 2, submitted: 3, withdrawn: 4, accepted: 5, rejected: 6 };
const cv = { id: "cv1" } as CvAttachment;

describe("application counts", () => {
  it("counts as sent what was transmitted and not withdrawn", () => {
    expect(sentApplicationCount(counts)).toBe(14);
    expect(sentApplicationCount({ draft: 9, submitted: 0, withdrawn: 9, accepted: 0, rejected: 0 })).toBe(0);
  });

  it("totals every status", () => {
    expect(totalApplicationCount(counts)).toBe(20);
    expect(totalApplicationCount(buildDashboard().applications)).toBe(0);
  });
});

describe("profileStateLabel", () => {
  it("says nothing was added on an empty profile, whatever the flags", () => {
    expect(profileStateLabel(buildDashboardProfile({ completionPercentage: 0, hasUnvalidatedChanges: true }))).toBe(
      "Nothing added yet",
    );
  });

  it("follows the server signals in priority order: analysis, failure, outdated, pending, validated", () => {
    const all = { normalizationInProgress: true, normalizationFailed: true, analysisOutdated: true, hasUnvalidatedChanges: true };
    expect(profileStateLabel(buildDashboardProfile(all))).toBe("Analysis in progress");
    expect(profileStateLabel(buildDashboardProfile({ ...all, normalizationInProgress: false }))).toBe(
      "Analysis failed",
    );
    expect(
      profileStateLabel(buildDashboardProfile({ ...all, normalizationInProgress: false, normalizationFailed: false })),
    ).toBe("Re-validation needed");
    expect(profileStateLabel(buildDashboardProfile({ hasUnvalidatedChanges: true }))).toBe("Changes to validate");
    expect(profileStateLabel(buildDashboardProfile())).toBe("Validated");
  });
});

describe("band labels", () => {
  it("pluralises drafts and says when there is none", () => {
    expect(draftsLabel(0)).toBe("No draft in progress");
    expect(draftsLabel(1)).toBe("1 draft to finish");
    expect(draftsLabel(3)).toBe("3 drafts to finish");
  });

  it("tells whether invitations are waiting", () => {
    expect(invitationsLabel(0)).toBe("None waiting");
    expect(invitationsLabel(2)).toBe("Open from recruiters");
  });
});

describe("nextSteps", () => {
  const settled = {
    profile: buildDashboardProfile(),
    dashboard: buildDashboard({ applications: { ...buildDashboard().applications, submitted: 1 }, openOffers: 5 }),
    consent: { consented: true, consentedAt: "2026-10-01T10:00:00" },
    cvs: [cv],
  };

  it("suggests nothing when everything is in order", () => {
    expect(nextSteps(settled)).toEqual([]);
  });

  it("suggests nothing from a source that is not available yet", () => {
    expect(nextSteps({})).toEqual([]);
  });

  it("asks to answer invitations, with the count and a plural", () => {
    const one = nextSteps({ ...settled, dashboard: buildDashboard({ openInvitations: 1 }) });
    expect(one[0]).toMatchObject({ id: "invitations", title: "Answer 1 invitation", href: "/applications" });
    const two = nextSteps({ ...settled, dashboard: buildDashboard({ openInvitations: 2 }) });
    expect(two[0].title).toBe("Answer 2 invitations");
  });

  it("asks to finish drafts", () => {
    const steps = nextSteps({
      ...settled,
      dashboard: buildDashboard({ applications: { ...buildDashboard().applications, draft: 2 } }),
    });
    expect(steps[0]).toMatchObject({ id: "drafts", title: "Finish 2 drafts", href: "/applications" });
  });

  it("asks to complete an incomplete profile, with its percentage", () => {
    const steps = nextSteps({ ...settled, profile: buildDashboardProfile({ completionPercentage: 43 }) });
    expect(steps).toEqual([
      expect.objectContaining({ id: "complete-profile", detail: "43% complete.", href: "/profile/edit" }),
    ]);
  });

  it("asks to validate a profile with pending changes, but not while an analysis runs", () => {
    const pending = buildDashboardProfile({ hasUnvalidatedChanges: true });
    expect(nextSteps({ ...settled, profile: pending })).toEqual([
      expect.objectContaining({ id: "validate-profile", detail: "Changes to validate", href: "/profile" }),
    ]);
    expect(
      nextSteps({ ...settled, profile: { ...pending, normalizationInProgress: true } }),
    ).toEqual([]);
  });

  it("does not ask to validate an empty profile — completing it comes first", () => {
    const steps = nextSteps({
      ...settled,
      profile: buildDashboardProfile({ completionPercentage: 0, hasUnvalidatedChanges: true }),
    });
    expect(steps.map((step) => step.id)).toEqual(["complete-profile"]);
  });

  it("asks for a CV only when the list is loaded and empty", () => {
    expect(nextSteps({ ...settled, cvs: [] }).map((step) => step.id)).toEqual(["upload-cv"]);
    expect(nextSteps({ ...settled, cvs: undefined })).toEqual([]);
  });

  it("asks for visibility consent only when the answer is known and negative", () => {
    expect(
      nextSteps({ ...settled, consent: { consented: false, consentedAt: null } }).map((step) => step.id),
    ).toEqual(["visibility"]);
    expect(nextSteps({ ...settled, consent: undefined })).toEqual([]);
  });

  it("suggests browsing offers only for a candidate with no application and offers to browse", () => {
    const none = buildDashboard({ openOffers: 7 });
    expect(nextSteps({ ...settled, dashboard: none })).toEqual([
      expect.objectContaining({ id: "browse", detail: "7 offers open right now.", href: "/jobs" }),
    ]);
    expect(nextSteps({ ...settled, dashboard: buildDashboard({ openOffers: 1 }) })[0].detail).toBe(
      "1 offer open right now.",
    );
    expect(nextSteps({ ...settled, dashboard: buildDashboard({ openOffers: 0 }) })).toEqual([]);
    const applied = buildDashboard({ openOffers: 7, applications: { ...none.applications, withdrawn: 1 } });
    expect(nextSteps({ ...settled, dashboard: applied })).toEqual([]);
  });

  it("orders the steps: invitations, drafts, profile, validation, CV, visibility", () => {
    const steps = nextSteps({
      profile: buildDashboardProfile({ completionPercentage: 50, hasUnvalidatedChanges: true }),
      dashboard: buildDashboard({
        openInvitations: 1,
        openOffers: 3,
        applications: { ...buildDashboard().applications, draft: 1 },
      }),
      consent: { consented: false, consentedAt: null },
      cvs: [],
    });
    expect(steps.map((step) => step.id)).toEqual([
      "invitations",
      "drafts",
      "complete-profile",
      "validate-profile",
      "upload-cv",
      "visibility",
    ]);
  });
});
