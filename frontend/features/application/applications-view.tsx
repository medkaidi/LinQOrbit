"use client";

import { useState } from "react";
import Link from "next/link";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  LINK_ACCENT_CLASS,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  ApplicationStatusPill,
  answerValueLabel,
  appliedOnLabel,
} from "@/features/application/application-shared";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { companyInitials } from "@/features/job-offer/job-offer-shared";
import { useMyApplications, useWithdrawApplication } from "@/hooks/use-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils/cn";
import type { ApplicationResponse } from "@/types/application";

function Header() {
  return (
    <PageHeader
      breadcrumb={
        <Breadcrumb>
          <BreadcrumbLink href="/dashboard">Candidate space</BreadcrumbLink>
          <BreadcrumbSeparator />
          <BreadcrumbCurrent>My applications</BreadcrumbCurrent>
        </Breadcrumb>
      }
      title="My applications"
    />
  );
}

/** Monogramme de la société, replié sur l'initiale du titre si le nom manque. */
function companyMark(application: ApplicationResponse): string {
  return (
    companyInitials(application.job.companyName ?? "") ||
    application.job.title.trim().charAt(0).toUpperCase() ||
    "?"
  );
}

function ApplicationCard({
  application,
  onWithdraw,
}: {
  application: ApplicationResponse;
  onWithdraw: (applicationId: string) => void;
}) {
  const [showAnswers, setShowAnswers] = useState(false);
  const appliedOn = appliedOnLabel(application.createdAt);
  const isDraft = application.status === "draft";
  const jobPath = `/jobs/${application.job.publicId}-${application.job.slug}`;
  const answersCount = application.answers.length;
  const answersLabel = answersCount === 1 ? "1 answer" : `${answersCount} answers`;
  const answersPanelId = `answers-${application.id}`;
  const metaItems = [
    appliedOn ? `${isDraft ? "Started" : "Applied"} ${appliedOn}` : null,
    application.cv
      ? `CV: ${application.cv.originalName ?? "No longer available"}`
      : "No CV yet",
    answersLabel,
  ].filter((item): item is string => item !== null);

  return (
    <li className="rounded-2xl border border-slate-border bg-canvas-white p-5">
      <div className="flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-surface text-body-md font-bold text-blue-deep"
        >
          {companyMark(application)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <Link
                href={jobPath}
                className={cn(
                  LINK_ACCENT_CLASS,
                  "font-headline-md text-headline-md text-text-primary font-bold tracking-tight",
                )}
              >
                {application.job.title}
              </Link>
              {application.job.companyName ? (
                <p className="font-label-md text-label-md text-primary uppercase font-bold">
                  {application.job.companyName}
                </p>
              ) : null}
            </div>
            <ApplicationStatusPill status={application.status} />
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 font-body-sm text-body-sm text-text-tertiary">
        {metaItems.map((item, index) => (
          <span key={item} className="flex items-center gap-2">
            {index > 0 ? <span aria-hidden="true">·</span> : null}
            <span>{item}</span>
          </span>
        ))}
      </div>

      {answersCount > 0 ? (
        <div className="mt-3">
          <Button
            type="button"
            variant="outline-sm"
            aria-expanded={showAnswers}
            aria-controls={answersPanelId}
            onClick={() => setShowAnswers((open) => !open)}
          >
            {showAnswers ? "Hide answers" : `View answers (${answersCount})`}
          </Button>
          {showAnswers ? (
            <dl
              id={answersPanelId}
              className="mt-3 flex flex-col gap-2 rounded-2xl border border-slate-border bg-item-surface/50 p-4"
            >
              {application.answers.map((answer) => (
                <div key={answer.questionId}>
                  <dt className="font-label-md text-label-md text-text-secondary">{answer.label}</dt>
                  <dd className="text-body-md font-body-md text-text-primary break-words whitespace-pre-wrap">
                    {answerValueLabel(answer)}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      ) : null}

      {isDraft || application.status === "submitted" ? (
        <div className="mt-4 border-t border-slate-border pt-4 flex justify-end">
          {isDraft ? (
            <ButtonLink variant="outline-sm" href={`${jobPath}/apply`}>
              Continue application
            </ButtonLink>
          ) : (
            <CtaButton tone="danger" icon="undo" onClick={() => onWithdraw(application.id)}>
              Withdraw
            </CtaButton>
          )}
        </div>
      ) : null}
    </li>
  );
}

/**
 * Liste des candidatures du candidat (`/applications`, D48, D59, D70) : cartes
 * compactes (barre de statut, monogramme, méta sur une ligne), réponses toutes
 * accessibles derrière un disclosure ; un brouillon propose « Continue
 * application » (retour au parcours), le retrait (confirmation `danger`) reste
 * réservé aux candidatures `submitted` — une candidature retirée ou arbitrée
 * n'expose plus l'action. Aucune note de matching ni pipeline fictif.
 */
export function ApplicationsView() {
  const applications = useMyApplications();
  const withdraw = useWithdrawApplication();
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  const items = applications.data ?? [];
  const withdrawError = withdraw.error ? getApiErrorMessage(withdraw.error) : null;

  return (
    <div className="flex flex-col gap-6">
      <Header />

      <section className={SECTION_CARD_CLASS}>
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Your applications</h2>
          {applications.data ? (
            <span className={MUTED_TEXT_CLASS}>
              {items.length === 1 ? "1 application" : `${items.length} applications`}
            </span>
          ) : null}
        </header>
        <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
          {applications.isLoading ? (
            <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
              <Spinner />
              Loading…
            </span>
          ) : null}

          {applications.isError ? (
            <Alert variant="error" title="Could not load your applications">
              Reload the page to try again.
            </Alert>
          ) : null}

          {withdrawError ? (
            <Alert variant="error" title="Withdrawal failed">
              {withdrawError}
            </Alert>
          ) : null}

          {applications.data && items.length === 0 ? (
            <p className={MUTED_TEXT_CLASS}>
              You have not applied to any job offer yet.
            </p>
          ) : null}

          {items.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {items.map((application) => (
                <ApplicationCard
                  key={application.id}
                  application={application}
                  onWithdraw={setWithdrawingId}
                />
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      {withdrawingId ? (
        <ConfirmDialog
          title="Withdraw this application?"
          message="You will not be able to apply to this job offer again."
          confirmLabel="Withdraw"
          tone="danger"
          icon="undo"
          busy={withdraw.isPending}
          onConfirm={() =>
            withdraw.mutate(withdrawingId, {
              onSuccess: () => setWithdrawingId(null),
              onError: () => setWithdrawingId(null),
            })
          }
          onCancel={() => setWithdrawingId(null)}
        />
      ) : null}
    </div>
  );
}
