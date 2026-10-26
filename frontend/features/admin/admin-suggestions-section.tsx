"use client";

import { useState } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  ITEM_CARD_CLASS,
  MUTED_TEXT_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { RetryButton } from "@/features/admin/retry-button";
import { SuggestionReviewDialog } from "@/features/admin/suggestion-review-dialog";
import { useRejectSkillSuggestion, useSkillSuggestions } from "@/hooks/use-admin";
import type { AdminSkillSuggestion } from "@/types/admin";

function SuggestionsSection() {
  const { data, isLoading, isError, refetch } = useSkillSuggestions();
  const rejectMutation = useRejectSkillSuggestion();
  const [reviewing, setReviewing] = useState<AdminSkillSuggestion | null>(null);
  const [rejectTarget, setRejectTarget] = useState<AdminSkillSuggestion | null>(null);

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Skill suggestions</h2>
        {data && (
          <span className={`${MUTED_TEXT_CLASS} shrink-0`}>{data.length} pending</span>
        )}
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-3">
        {rejectMutation.isError && (
          <Alert variant="error" title="Unable to reject the suggestion">
            The suggestion is still in the queue.{" "}
            <RetryButton
              onRetry={() => rejectMutation.reset()}
              label="Dismiss"
            />
          </Alert>
        )}
        {isLoading && <p className={MUTED_TEXT_CLASS}>Loading suggestions…</p>}
        {isError && (
          <Alert variant="error" title="Unable to load suggestions">
            <RetryButton onRetry={() => void refetch()} label="Try again" />
          </Alert>
        )}
        {data && data.length === 0 && (
          <p className={MUTED_TEXT_CLASS}>
            No suggestions yet — proposed skills appear here for review.
          </p>
        )}
        {data && data.length > 0 ? (
          // Une vraie liste : les lignes sont des `li` dans un `ul`, jamais des `li` orphelins
          // dans un `div` (la sémantique de liste se perd sinon).
          <ul className="list-none flex flex-col gap-3">
            {data.map((suggestion) => {
              const author = [
                suggestion.candidateFirstName,
                suggestion.candidateLastName
              ]
                .filter(Boolean)
                .join(" ");
              // Un seul rejet à la fois : seule la ligne concernée est occupée, les autres attendent.
              const rejecting =
                rejectMutation.isPending && rejectMutation.variables === suggestion.id;
              return (
                <li
                  key={suggestion.id}
                  className={`${ITEM_CARD_CLASS} flex flex-wrap items-center justify-between gap-4`}
                >
                  <div className="min-w-0">
                    <p className="text-body-md font-body-md text-text-primary font-semibold truncate">
                      {suggestion.name}
                    </p>
                    <p className={`${MUTED_TEXT_CLASS} truncate`}>
                      by {author || "Unknown candidate"}
                      {suggestion.candidateEmail
                        ? ` · ${suggestion.candidateEmail}`
                        : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className={`${MUTED_TEXT_CLASS}`}>
                      {suggestion.createdAt.slice(0, 10)}
                    </span>
                    <Button
                      variant="outline-sm"
                      disabled={rejectMutation.isPending}
                      onClick={() => setReviewing(suggestion)}
                    >
                      Review
                    </Button>
                    <Button
                      variant="outline-sm"
                      busy={rejecting}
                      disabled={rejectMutation.isPending}
                      onClick={() => setRejectTarget(suggestion)}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
      {reviewing && (
        <SuggestionReviewDialog
          suggestion={reviewing}
          onClose={() => setReviewing(null)}
        />
      )}
      {rejectTarget && (
        <ConfirmDialog
          title="Reject this suggestion?"
          message="The candidate is not notified and the skill stays out of the catalog."
          confirmLabel="Reject"
          tone="danger"
          icon="delete"
          busy={rejectMutation.isPending}
          onConfirm={() =>
            rejectMutation.mutate(rejectTarget.id, {
              onSettled: () => setRejectTarget(null),
            })
          }
          onCancel={() => setRejectTarget(null)}
        />
      )}
    </section>
  );
}

/** File de modération des compétences proposées par les candidats (T-111, D97) : page dédiée de la console. */
export function AdminSuggestionsView() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/admin">Administration</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Skill suggestions</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Skill suggestions"
      />
      <SuggestionsSection />
    </div>
  );
}
