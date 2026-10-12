"use client";

import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import {
  useContractTypes,
  useDeleteJobOffer,
  useDuplicateJobOffer,
  useJobOffers,
  useJobOfferTransition,
  useWorkModes,
} from "@/hooks/use-job-offers";
import { getJobOfferErrorMessage } from "@/lib/api/job-offer.api";
import type { Company, JobOffer, JobOfferStatusValue } from "@/types/recruiter";
import {
  isOfferReadyToPublish,
  locationLabel,
  OFFER_INCOMPLETE_TOOLTIP,
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
  salaryLabel,
  SENIORITY_LABELS,
  STATUS_LABELS,
} from "@/features/job-offer/job-offer-shared";

// Pilule outline-sm habillant un lien (jamais de <button> dans un <a>).
const EDIT_LINK_CLASS =
  "group inline-flex items-center justify-center gap-2 h-8 px-4 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle text-text-primary font-bold text-xs transition-[background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

/** Carte d'une offre du listing — spécifique à ce composant (OFFER_ITEM_CARD reste partagé formulaire/companies). */
const OFFER_ROW_CARD =
  "bg-canvas-white rounded-2xl border border-slate-border p-4 shadow-sm";

const STATUS_PILL_TONES: Record<JobOfferStatusValue, { pill: string; dot: string }> = {
  draft: { pill: "bg-canvas-subtle text-text-secondary", dot: "bg-text-tertiary" },
  validated: { pill: "bg-orange-subtle text-orange-deep", dot: "bg-orange-vibrant" },
  published: { pill: "bg-success-surface text-success-text", dot: "bg-tertiary" },
  closed: { pill: "bg-slate-surface text-text-secondary", dot: "bg-slate-border" },
};

/** Pastille de statut à point coloré — inspirée du template offers_listing. */
function StatusPill({ status }: { status: JobOfferStatusValue }) {
  const tone = STATUS_PILL_TONES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full font-label-caps text-label-caps uppercase tracking-wider font-bold shrink-0 ${tone.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${tone.dot}`} />
      {STATUS_LABELS[status]}
    </span>
  );
}

/** Date relative courte (« 3 days ago ») — le dashboard est rendu côté serveur nul (AuthGate), pas d'hydratation à craindre. */
function createdAgo(iso: string): string | null {
  const created = new Date(iso).getTime();
  if (Number.isNaN(created)) {
    return null;
  }
  const elapsedMinutes = Math.round((created - Date.now()) / 60_000);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  if (Math.abs(elapsedMinutes) < 60) {
    return rtf.format(elapsedMinutes, "minute");
  }
  const hours = Math.round(elapsedMinutes / 60);
  if (Math.abs(hours) < 24) {
    return rtf.format(hours, "hour");
  }
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) {
    return rtf.format(days, "day");
  }
  const months = Math.round(days / 30);
  if (Math.abs(months) < 12) {
    return rtf.format(months, "month");
  }
  return rtf.format(Math.round(months / 12), "year");
}

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
  offer: JobOffer;
  busy: boolean;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ready = isOfferReadyToPublish(offer);
  const blocked = ready ? undefined : OFFER_INCOMPLETE_TOOLTIP;
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {offer.status === "draft" && (
        <>
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={EDIT_LINK_CLASS}>
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
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={EDIT_LINK_CLASS}>
            Edit
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
            className={EDIT_LINK_CLASS}
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
  offer: JobOffer;
  companyName: string | null;
  contractTypeLabel: string | null;
  workModeLabel: string | null;
  busy: boolean;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const location = locationLabel(offer.city, offer.country);
  const salary = salaryLabel(
    offer.salaryMin,
    offer.salaryMax,
    offer.salaryCurrency,
    offer.salaryPeriod,
  );
  const seniority = offer.seniority ? SENIORITY_LABELS[offer.seniority] : null;
  const created = createdAgo(offer.createdAt);
  const place = workModeLabel ? [workModeLabel, location].filter(Boolean).join(" · ") : location;

  const meta: ReactNode[] = [];
  if (seniority) {
    meta.push(<span key="seniority">{seniority}</span>);
  }
  if (place) {
    meta.push(
      <span key="location" className="flex items-center gap-1">
        <Icon
          name={workModeLabel?.toLowerCase() === "remote" ? "public" : "location_on"}
          className="text-[16px] text-text-tertiary"
        />
        {place}
      </span>,
    );
  }
  if (contractTypeLabel) {
    meta.push(
      <span key="contract" className="flex items-center gap-1">
        <Icon name="badge" className="text-[16px] text-text-tertiary" />
        {contractTypeLabel}
      </span>,
    );
  }
  if (salary) {
    meta.push(
      <span key="salary" className="font-semibold text-text-primary">
        {salary}
      </span>,
    );
  }

  return (
    <li
      className={`${OFFER_ROW_CARD} group/offer flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
        offer.status === "draft" ? "opacity-80 hover:opacity-100" : ""
      }`}
    >
      <div className="flex items-start gap-4 min-w-0 flex-1">
        <div
          className={`w-12 h-12 mt-0.5 rounded-xl flex items-center justify-center shrink-0 ${
            offer.status === "draft" || offer.status === "closed"
              ? "bg-canvas-subtle text-text-secondary"
              : "bg-orange-subtle text-orange-deep"
          }`}
        >
          <Icon name="work" className="text-[24px]" />
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {companyName ? (
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container text-text-primary font-label-caps text-label-caps uppercase shrink-0">
                {companyName}
              </span>
            ) : null}
            <StatusPill status={offer.status} />
            {offer.hasUnvalidatedChanges && offer.status === "validated" ? (
              <Badge>Unvalidated changes</Badge>
            ) : null}
            {created ? (
              <span className="font-body-sm text-body-sm text-text-tertiary">
                Created {created}
              </span>
            ) : null}
          </div>
          <h3 className="font-headline-sm text-headline-sm text-text-primary group-hover/offer:text-orange-deep transition-colors truncate">
            {offer.title}
          </h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-body-sm text-body-sm text-text-secondary">
            {meta.flatMap((part, index) =>
              index === 0
                ? [part]
                : [
                    <span key={`sep-${index}`} className="text-text-tertiary">
                      •
                    </span>,
                    part,
                  ],
            )}
          </div>
        </div>
      </div>
      <OfferActions
        offer={offer}
        busy={busy}
        onTransition={onTransition}
        onDuplicate={onDuplicate}
        onDelete={onDelete}
      />
    </li>
  );
}

/**
 * Liste des offres des companies du recruteur (D12–D13) : un seul état de
 * mutation partagé par les actions, erreurs en `Alert` sans perdre la liste.
 */
export function JobOffersSection({ companies }: { companies: Company[] }) {
  const offers = useJobOffers();
  const transition = useJobOfferTransition();
  const remove = useDeleteJobOffer();
  const duplicate = useDuplicateJobOffer();
  const contractTypes = useContractTypes();
  const workModes = useWorkModes();
  const [deleteTarget, setDeleteTarget] = useState<JobOffer | null>(null);
  const [confirmTransition, setConfirmTransition] = useState<{
    offer: JobOffer;
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

  const list = offers.data ?? [];

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
        {list.length === 0 ? (
          <p className="text-body-md font-body-md text-text-secondary">
            No offers yet. Create your first job offer to start matching candidates.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {list.map((offer) => (
              <OfferRow
                key={offer.id}
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
            ))}
          </ul>
        )}
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
