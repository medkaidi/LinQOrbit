import { describe, expect, it } from "vitest";

import {
  closingSoonLabel,
  dateLabel,
  DECISION_ORDER,
  decisionsLabel,
  invitedLabel,
  liveOffersLabel,
  nextSteps,
  totalDecisionCount,
  totalOfferCount,
} from "@/features/recruiter/dashboard-shared";
import { buildAttentionOffer, buildRecruiterDashboard } from "@/tests/helpers/recruiter-dashboard-fixtures";

describe("band labels", () => {
  it("counts every offer status in the total", () => {
    expect(totalOfferCount({ draft: 1, validated: 2, published: 3, closed: 4 })).toBe(10);
    expect(totalOfferCount({ draft: 0, validated: 0, published: 0, closed: 0 })).toBe(0);
  });

  it("describes what still blocks publication, with the right plural", () => {
    expect(liveOffersLabel({ draft: 1, validated: 2, published: 0, closed: 0 })).toBe("1 draft · 2 validated");
    expect(liveOffersLabel({ draft: 0, validated: 0, published: 0, closed: 0 })).toBe("0 drafts · 0 validated");
  });

  it("lists the decisions already taken", () => {
    expect(decisionsLabel({ toReview: 5, accepted: 3, rejected: 2 })).toBe("3 accepted · 2 rejected");
  });

  it("tells whether any invitation was sent", () => {
    expect(invitedLabel({ toInvite: 2, invited: 4, searchesFailed: 0 })).toBe("4 invited so far");
    expect(invitedLabel({ toInvite: 2, invited: 0, searchesFailed: 0 })).toBe("No invitation sent yet");
  });

  it("formats a civil date without shifting it across time zones", () => {
    expect(dateLabel("2026-11-03")).toBe("Nov 3, 2026");
    expect(dateLabel("2026-01-01")).toBe("Jan 1, 2026");
    expect(dateLabel("not a date")).toBeNull();
    expect(dateLabel("")).toBeNull();
  });

  it("names the nearest deadline, or says there is none", () => {
    expect(closingSoonLabel({ count: 2, nextExpiry: "2026-11-03" })).toBe("Next on Nov 3, 2026");
    expect(closingSoonLabel({ count: 0, nextExpiry: null })).toBe("None in the next 30 days");
  });
});

describe("nextSteps", () => {
  it("only suggests creating the first offer when there is none", () => {
    const steps = nextSteps(buildRecruiterDashboard());

    expect(steps).toHaveLength(1);
    expect(steps[0]).toMatchObject({ id: "first-offer", href: "/recruiter/offers/new" });
  });

  it("suggests nothing when offers exist and nothing is pending", () => {
    const steps = nextSteps(buildRecruiterDashboard({ offers: { draft: 0, validated: 0, published: 2, closed: 1 } }));

    expect(steps).toEqual([]);
  });

  it("orders the steps from the most to the least urgent and links the review to the offer", () => {
    const steps = nextSteps(
      buildRecruiterDashboard({
        offers: { draft: 2, validated: 1, published: 4, closed: 0 },
        applications: { toReview: 5, accepted: 0, rejected: 0 },
        candidates: { toInvite: 3, invited: 0, searchesFailed: 1 },
        closingSoon: { count: 2, nextExpiry: "2026-11-03" },
        attention: [
          buildAttentionOffer({ id: "quiet", toReview: 0 }),
          buildAttentionOffer({ id: "busy", toReview: 5 }),
        ],
      }),
    );

    expect(steps.map((step) => step.id)).toEqual([
      "review",
      "failed-searches",
      "invite",
      "publish",
      "drafts",
      "closing-soon",
    ]);
    expect(steps[0]).toMatchObject({
      title: "Review 5 applications",
      href: "/recruiter/offers/busy/applications",
    });
    expect(steps[1].title).toBe("Retry 1 failed candidate search");
    expect(steps[2].title).toBe("Invite 3 suggested candidates");
    expect(steps[3].title).toBe("Publish 1 validated offer");
    expect(steps[4].title).toBe("Finish 2 drafts");
    expect(steps[5]).toMatchObject({ title: "2 offers closing soon", detail: "Next on Nov 3, 2026" });
  });

  it("falls back on the offer list when the offers to review are not in the attention list", () => {
    const steps = nextSteps(
      buildRecruiterDashboard({
        offers: { draft: 0, validated: 0, published: 1, closed: 0 },
        applications: { toReview: 1, accepted: 0, rejected: 0 },
      }),
    );

    expect(steps[0]).toMatchObject({ id: "review", href: "/recruiter", title: "Review 1 application" });
  });

  it("never proposes an analysis step: the data is not aggregated", () => {
    const steps = nextSteps(
      buildRecruiterDashboard({ offers: { draft: 1, validated: 1, published: 1, closed: 1 } }),
    );

    expect(steps.some((step) => /analysis|outdated/i.test(step.title))).toBe(false);
  });
});

describe("decisions on applications", () => {
  it("lists the three decisions, each backed by a counter of the payload", () => {
    expect([...DECISION_ORDER]).toEqual(["toReview", "accepted", "rejected"]);
  });

  it("adds every decision to the total", () => {
    expect(totalDecisionCount({ toReview: 7, accepted: 3, rejected: 1 })).toBe(11);
    expect(totalDecisionCount({ toReview: 0, accepted: 0, rejected: 0 })).toBe(0);
  });
});
