"use client";

import { useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Spinner } from "@/components/ui/spinner";
import {
  APPLICATION_ITEM,
  APPLICATION_MUTED,
  APPLICATION_SECTION,
  APPLICATION_SECTION_HEADER,
  APPLICATION_SECTION_TITLE,
  ApplicationStatusPill,
  answerValueLabel,
  appliedOnLabel,
} from "@/features/application/application-shared";
import { useMyApplications, useWithdrawApplication } from "@/hooks/use-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { ApplicationResponse } from "@/types/application";

function Header() {
  return (
    <div className="pb-6 border-b border-slate-border">
      <div className="min-w-0">
        <nav
          aria-label="Breadcrumb"
          className="flex flex-wrap items-center gap-2 text-body-sm font-body-sm text-text-secondary"
        >
          <Link
            href="/dashboard"
            className="hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
          >
            Candidate space
          </Link>
          <span aria-hidden="true" className="text-text-tertiary">
            /
          </span>
          <span className="text-text-primary font-semibold">My applications</span>
        </nav>
        <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          My applications
        </h1>
      </div>
    </div>
  );
}

function ApplicationCard({
  application,
  onWithdraw,
}: {
  application: ApplicationResponse;
  onWithdraw: (applicationId: string) => void;
}) {
  const appliedOn = appliedOnLabel(application.createdAt);
  return (
    <li className={APPLICATION_ITEM}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/jobs/${application.job.publicId}-${application.job.slug}`}
            className="font-headline-md text-headline-md text-text-primary font-bold tracking-tight hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
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

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 font-body-sm text-body-sm text-text-tertiary">
        {appliedOn ? <span>Applied {appliedOn}</span> : null}
        <span>CV: {application.cv.originalName ?? "No longer available"}</span>
      </div>

      {application.answers.length > 0 ? (
        <dl className="mt-3 pt-3 border-t border-slate-border flex flex-col gap-2">
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

      {application.status === "submitted" ? (
        <div className="mt-3 pt-3 border-t border-slate-border flex justify-end">
          <CtaButton tone="danger" icon="undo" onClick={() => onWithdraw(application.id)}>
            Withdraw
          </CtaButton>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Liste des candidatures du candidat (`/applications`, D48) : statut, CV
 * épinglé, réponses en lecture seule, retrait (Confirmation `danger`) réservé
 * aux candidatures `submitted` — une candidature retirée ou arbitrée n'expose
 * plus l'action.
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

      <section className={APPLICATION_SECTION}>
        <header className={APPLICATION_SECTION_HEADER}>
          <h2 className={APPLICATION_SECTION_TITLE}>Your applications</h2>
          {applications.data ? (
            <span className={APPLICATION_MUTED}>
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
            <p className={APPLICATION_MUTED}>
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
