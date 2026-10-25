import { describe, expect, it } from "vitest";

import {
  attentionSteps,
  decisionsLabel,
  identitiesLabel,
  liveOffersLabel,
  moderationLabel,
  moderationTotal,
  newThisWeekLabel,
  PROCESSING_QUEUES,
  processingSummary,
  totalAccountCount,
  totalProcessingFailures,
} from "@/features/admin/dashboard-shared";
import { buildAdminDashboard } from "@/tests/helpers/admin-dashboard-fixtures";

describe("band labels", () => {
  it("counts every account status in the total, identities excluded (they overlap)", () => {
    const { accounts } = buildAdminDashboard({
      accounts: {
        active: 5,
        inactive: 2,
        suspended: 1,
        candidates: 6,
        recruiters: 4,
        admins: 1,
        newLast7Days: 3,
      },
    });

    expect(totalAccountCount(accounts)).toBe(8);
  });

  it("writes the freshness of a card as a signed count", () => {
    expect(newThisWeekLabel(3)).toBe("+3 this week");
    expect(newThisWeekLabel(0)).toBe("+0 this week");
  });

  it("lists both identities with the right plural, zero included", () => {
    const accounts = buildAdminDashboard().accounts;

    expect(identitiesLabel({ ...accounts, candidates: 1, recruiters: 3 })).toBe("1 candidate · 3 recruiters");
    expect(identitiesLabel(accounts)).toBe("0 candidates · 0 recruiters");
  });

  it("describes the offer stock and what is still a draft", () => {
    expect(liveOffersLabel({ draft: 1, validated: 2, published: 3, closed: 4 })).toBe("10 in total · 1 draft");
    expect(liveOffersLabel({ draft: 0, validated: 0, published: 0, closed: 0 })).toBe("0 in total · 0 drafts");
  });

  it("lists the decisions already taken", () => {
    const applications = buildAdminDashboard().applications;

    expect(decisionsLabel({ ...applications, accepted: 3, rejected: 2 })).toBe("3 accepted · 2 rejected");
  });
});

describe("moderation", () => {
  it("adds both queues the admin can act on", () => {
    expect(moderationTotal({ skillSuggestions: 4, reportsAwaitingMyReview: 2, reportsTotal: 9 })).toBe(6);
    // Le total des signalements n'entre jamais dans « à modérer » : seuls ceux que cet admin peut relire.
    expect(moderationTotal({ skillSuggestions: 0, reportsAwaitingMyReview: 0, reportsTotal: 9 })).toBe(0);
  });

  it("labels each queue with the right plural", () => {
    expect(moderationLabel({ skillSuggestions: 1, reportsAwaitingMyReview: 2, reportsTotal: 5 })).toBe(
      "1 suggestion · 2 AI reports",
    );
    expect(moderationLabel({ skillSuggestions: 0, reportsAwaitingMyReview: 0, reportsTotal: 0 })).toBe(
      "0 suggestions · 0 AI reports",
    );
  });
});

describe("attentionSteps", () => {
  it("proposes nothing when both queues are empty", () => {
    expect(attentionSteps({ skillSuggestions: 0, reportsAwaitingMyReview: 0, reportsTotal: 12 })).toEqual([]);
  });

  it("puts the skill suggestions first, then the AI reports, each linking to its queue", () => {
    const steps = attentionSteps({ skillSuggestions: 3, reportsAwaitingMyReview: 1, reportsTotal: 4 });

    expect(steps.map((step) => step.id)).toEqual(["skill-suggestions", "ai-reports"]);
    expect(steps[0]).toMatchObject({ title: "Review 3 skill suggestions", href: "/admin/suggestions" });
    expect(steps[1]).toMatchObject({ title: "Review 1 AI report", href: "/admin/reports" });
  });

  it("only proposes the queue that has something in it", () => {
    expect(
      attentionSteps({ skillSuggestions: 0, reportsAwaitingMyReview: 2, reportsTotal: 2 }).map((s) => s.id),
    ).toEqual(["ai-reports"]);
    expect(
      attentionSteps({ skillSuggestions: 1, reportsAwaitingMyReview: 0, reportsTotal: 2 }).map((s) => s.id),
    ).toEqual(["skill-suggestions"]);
  });
});

describe("processing failures", () => {
  const none = buildAdminDashboard().processingFailures;

  it("lists the five queues, each backed by a counter of the payload", () => {
    expect(PROCESSING_QUEUES.map((queue) => queue.key)).toEqual(Object.keys(none));
  });

  it("adds every queue to the total", () => {
    const failures = { candidateAnalyses: 1, offerAnalyses: 2, embeddings: 3, screenings: 4, matchings: 5 };

    expect(totalProcessingFailures(failures)).toBe(15);
    expect(totalProcessingFailures(none)).toBe(0);
  });

  it("says nothing failed at zero, and the count otherwise", () => {
    expect(processingSummary(none)).toBe("None failed");
    expect(processingSummary({ ...none, embeddings: 1 })).toBe("1 failed");
    expect(processingSummary({ ...none, embeddings: 2, matchings: 3 })).toBe("5 failed");
  });
});
