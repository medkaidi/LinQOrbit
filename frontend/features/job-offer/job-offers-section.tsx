"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { InfiniteList } from "@/components/ui/infinite-list";
import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import {
  useContractTypes,
  useDeleteJobOffer,
  useDuplicateJobOffer,
  useInfiniteJobOffers,
  useJobOfferTransition,
  useWorkModes,
} from "@/hooks/use-job-offers";
import { getJobOfferErrorMessage } from "@/lib/api/job-offer.api";
import type { Company, JobOfferListItem } from "@/types/recruiter";
import { JobOfferCard, OFFER_LINK_PILL_CLASS } from "@/features/job-offer/job-offer-card";
import {
  isOfferExpired,
  OFFER_INCOMPLETE_TOOLTIP,
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
} from "@/features/job-offer/job-offer-shared";

/** URL publique (V15) : segment unique `{publicId}-{slug}`. */
function publicJobPath(publicId: string, slug: string): string {
  return `/jobs/${publicId}-${slug}`;
}

/** Copie l'URL publique absolue dans le presse-papiers, avec retour visuel « Copied » (2 s). */
function CopyPublicLinkButton({ publicId, slug }: { publicId: string; slug: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      variant="outline-sm"
      aria-label={copied ? "Link copied" : "Copy link"}
      onClick={() => {
        const url = new URL(publicJobPath(publicId, slug), window.location.origin).toString();
        void navigator.clipboard.writeText(url).then(() => setCopied(true));
      }}
    >
      <Icon name={copied ? "check" : "content_copy"} className="text-[14px]" />
      {copied ? "Copied" : "Copy link"}
    </Button>
  );
}

/** Contenu de la confirmation selon l'action (validate / publish). */
const TRANSITION_CONFIRM: Record<
  "validate" | "publish",
  { title: string; message: string; confirmLabel: string; icon: string }
> = {
  validate: {
    title: "Validate this offer?",
    message: "This marks the offer as reviewed and ready to publish. You can still edit it afterwards.",
    confirmLabel: "Validate",
    icon: "check_circle",
  },
  publish: {
    title: "Publish this offer?",
    message: "The offer will become publicly visible on the job board.",
    confirmLabel: "Publish",
    icon: "publish",
  },
};

function OfferActions({
  offer,
  busy,
  onTransition,
  onDuplicate,
  onDelete,
}: {
  offer: JobOfferListItem;
  busy: boolean;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ready = offer.readyToPublish;
  const blocked = ready ? undefined : OFFER_INCOMPLETE_TOOLTIP;
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {offer.status === "draft" && (
        <>
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={OFFER_LINK_PILL_CLASS}>
            Edit
          </Link>
          <CtaButton
            icon="check_circle"
            busy={busy}
            disabled={!ready}
            title={blocked}
            onClick={() => onTransition("validate")}
          >
            Validate
          </CtaButton>
          <CtaButton tone="secondary" icon="content_copy" busy={busy} onClick={onDuplicate}>
            Duplicate
          </CtaButton>
          <CtaButton tone="danger" icon="delete" busy={busy} onClick={() => onDelete()}>
            Delete
          </CtaButton>
        </>
      )}
      {offer.status === "validated" && (
        <>
          {offer.normalizationFailed && (
            <Button variant="outline-sm" busy={busy} onClick={() => onTransition("validate")}>
              Validate again
            </Button>
          )}
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={OFFER_LINK_PILL_CLASS}>
            Edit
          </Link>
          <Link href={`/recruiter/offers/${offer.id}/preview`} className={OFFER_LINK_PILL_CLASS}>
            Preview
          </Link>
          <CtaButton
            icon="publish"
            busy={busy}
            disabled={!ready}
            title={blocked}
            onClick={() => onTransition("publish")}
          >
            Publish
          </CtaButton>
          <CtaButton tone="secondary" icon="content_copy" busy={busy} onClick={onDuplicate}>
            Duplicate
          </CtaButton>
          <CtaButton tone="neutral" icon="close" busy={busy} onClick={() => onTransition("close")}>
            Close
          </CtaButton>
        </>
      )}
      {offer.status === "published" && (
        <>
          <CopyPublicLinkButton publicId={offer.publicId} slug={offer.slug} />
          <Link
            href={publicJobPath(offer.publicId, offer.slug)}
            className={OFFER_LINK_PILL_CLASS}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="open_in_new" className="text-[14px]" />
            View public page
          </Link>
          <CtaButton tone="secondary" icon="content_copy" busy={busy} onClick={onDuplicate}>
            Duplicate
          </CtaButton>
          <CtaButton tone="neutral" icon="close" busy={busy} onClick={() => onTransition("close")}>
            Close
          </CtaButton>
        </>
      )}
    </div>
  );
}

function OfferRow({
  offer,
  companyName,
  contractTypeLabel,
  workModeLabel,
  busy,
  onTransition,
  onDuplicate,
  onDelete,
}: {
  offer: JobOfferListItem;
  companyName: string | null;
  contractTypeLabel: string | null;
  workModeLabel: string | null;
  busy: boolean;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  return (
    <JobOfferCard
      status={offer.status}
      title={offer.title}
      companyName={companyName}
      seniority={offer.seniority}
      city={offer.city}
      country={offer.country}
      workModeLabel={workModeLabel}
      contractTypeLabel={contractTypeLabel}
      salaryMin={offer.salaryMin}
      salaryMax={offer.salaryMax}
      salaryCurrency={offer.salaryCurrency}
      salaryPeriod={offer.salaryPeriod}
      expired={isOfferExpired(offer)}
      normalization={
        offer.normalizationInProgress ? "progress" : offer.normalizationFailed ? "failed" : null
      }
      unvalidatedChanges={offer.hasUnvalidatedChanges}
      createdAt={offer.createdAt}
      actions={
        <OfferActions
          offer={offer}
          busy={busy}
          onTransition={onTransition}
          onDuplicate={onDuplicate}
          onDelete={onDelete}
        />
      }
    />
  );
}

/**
 * Liste des offres des companies du recruteur (D12–D13) : un seul état de
 * mutation partagé par les actions, erreurs en `Alert` sans perdre la liste.
 */
export function JobOffersSection({ companies }: { companies: Company[] }) {
  const offers = useInfiniteJobOffers();
  const transition = useJobOfferTransition();
  const remove = useDeleteJobOffer();
  const duplicate = useDuplicateJobOffer();
  const contractTypes = useContractTypes();
  const workModes = useWorkModes();
  const [deleteTarget, setDeleteTarget] = useState<JobOfferListItem | null>(null);
  const [confirmTransition, setConfirmTransition] = useState<{
    offer: JobOfferListItem;
    action: "validate" | "publish";
  } | null>(null);

  const companyNames = new Map(companies.map((company) => [company.id, company.name]));
  const contractLabels = new Map(
    (contractTypes.data ?? []).map((option) => [option.id, option.label] as const),
  );
  const workModeLabels = new Map(
    (workModes.data ?? []).map((option) => [option.id, option.label] as const),
  );
  // variables persiste après coup en TanStack Query v5 : busy uniquement pendant isPending.
  const pendingTransitionId = transition.isPending ? transition.variables?.offerId ?? null : null;
  const pendingRemoveId = remove.isPending ? remove.variables ?? null : null;
  const pendingDuplicateId = duplicate.isPending ? duplicate.variables ?? null : null;
  const pendingId = pendingTransitionId ?? pendingRemoveId ?? pendingDuplicateId;
  const error = transition.error ?? remove.error ?? duplicate.error;

  if (offers.isLoading) {
    return (
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Job offers</h2>
        </header>
        <div className="px-6 pt-5 pb-6 flex items-center gap-2 text-body-sm text-text-secondary">
          <Spinner />
          Loading offers…
        </div>
      </section>
    );
  }

  if (offers.isError) {
    return (
      <section className="bg-canvas-white rounded-2xl shadow-sm">
        <header className={OFFER_SECTION_HEADER}>
          <h2 className={OFFER_SECTION_TITLE}>Job offers</h2>
        </header>
        <div className="px-6 pt-5 pb-6">
          <Alert variant="error" title="Could not load offers">
            <div className="flex items-center justify-between gap-3">
              <span>{getJobOfferErrorMessage(offers.error)}</span>
              <Button variant="outline-sm" onClick={() => void offers.refetch()}>
                Retry
              </Button>
            </div>
          </Alert>
        </div>
      </section>
    );
  }

  const list = offers.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={OFFER_SECTION_HEADER}>
        <h2 className={OFFER_SECTION_TITLE}>Job offers</h2>
        <NavPill icon="add" label="New offer" href="/recruiter/offers/new" />
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        {error ? (
          <Alert variant="error" title="Action failed">
            {getJobOfferErrorMessage(error)}
          </Alert>
        ) : null}
        <InfiniteList
          items={list}
          keyExtractor={(offer) => offer.id}
          renderItem={(offer) => (
            <OfferRow
              offer={offer}
              companyName={companyNames.get(offer.companyId) ?? null}
              contractTypeLabel={
                offer.contractTypeId ? contractLabels.get(offer.contractTypeId) ?? null : null
              }
              workModeLabel={
                offer.workModeId ? workModeLabels.get(offer.workModeId) ?? null : null
              }
              busy={pendingId === offer.id}
              onTransition={(action) =>
                action === "close"
                  ? transition.mutate({ offerId: offer.id, action })
                  : setConfirmTransition({ offer, action })
              }
              onDuplicate={() => duplicate.mutate(offer.id)}
              onDelete={() => setDeleteTarget(offer)}
            />
          )}
          hasNextPage={offers.hasNextPage}
          isFetchingNextPage={offers.isFetchingNextPage}
          fetchNextPage={() => void offers.fetchNextPage()}
          loading={offers.isLoading}
          empty={
            <p className="text-body-md font-body-md text-text-secondary">
              No offers yet. Create your first job offer to start matching candidates.
            </p>
          }
        />
        {confirmTransition ? (
          <ConfirmDialog
            title={TRANSITION_CONFIRM[confirmTransition.action].title}
            message={TRANSITION_CONFIRM[confirmTransition.action].message}
            confirmLabel={TRANSITION_CONFIRM[confirmTransition.action].confirmLabel}
            icon={TRANSITION_CONFIRM[confirmTransition.action].icon}
            busy={transition.isPending}
            onConfirm={() => {
              transition.mutate(
                { offerId: confirmTransition.offer.id, action: confirmTransition.action },
                { onSettled: () => setConfirmTransition(null) },
              );
            }}
            onCancel={() => setConfirmTransition(null)}
          />
        ) : null}
        {deleteTarget ? (
          <ConfirmDialog
            title="Delete this draft offer?"
            message="This cannot be undone."
            confirmLabel="Delete"
            tone="danger"
            icon="delete"
            busy={remove.isPending}
            onConfirm={() => {
              remove.mutate(deleteTarget.id, {
                onSettled: () => setDeleteTarget(null),
              });
            }}
            onCancel={() => setDeleteTarget(null)}
          />
        ) : null}
      </div>
    </section>
  );
}
