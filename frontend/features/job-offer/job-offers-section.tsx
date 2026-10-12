"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, CtaButton } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { NavPill } from "@/components/ui/nav-pill";
import { Spinner } from "@/components/ui/spinner";
import {
  useDeleteJobOffer,
  useJobOffers,
  useJobOfferTransition,
} from "@/hooks/use-job-offers";
import { getJobOfferErrorMessage } from "@/lib/api/job-offer.api";
import type { Company, JobOffer, JobOfferStatusValue } from "@/types/recruiter";
import {
  locationLabel,
  OFFER_ITEM_CARD,
  OFFER_MUTED,
  OFFER_SECTION_HEADER,
  OFFER_SECTION_TITLE,
  salaryLabel,
  SENIORITY_LABELS,
  STATUS_LABELS,
} from "@/features/job-offer/job-offer-shared";

// Pilule outline-sm habillant un lien (jamais de <button> dans un <a>).
const EDIT_LINK_CLASS =
  "group inline-flex items-center justify-center gap-2 h-8 px-4 rounded-full bg-surface-container-lowest shadow-sm hover:bg-canvas-subtle text-text-primary font-bold text-xs transition-[background-color] duration-150 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep";

function statusBadgeTone(status: JobOfferStatusValue): "neutral" | "success" {
  return status === "published" ? "success" : "neutral";
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

function OfferActions({
  offer,
  busy,
  onTransition,
  onDelete,
}: {
  offer: JobOffer;
  busy: boolean;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 shrink-0">
      {offer.status === "draft" && (
        <>
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={EDIT_LINK_CLASS}>
            Edit
          </Link>
          <CtaButton icon="check_circle" busy={busy} onClick={() => onTransition("validate")}>
            Validate
          </CtaButton>
          <CtaButton tone="danger" icon="delete" busy={busy} onClick={onDelete}>
            Delete
          </CtaButton>
        </>
      )}
      {offer.status === "validated" && (
        <>
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={EDIT_LINK_CLASS}>
            Edit
          </Link>
          <CtaButton icon="publish" busy={busy} onClick={() => onTransition("publish")}>
            Publish
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
  busy,
  onTransition,
  onDelete,
}: {
  offer: JobOffer;
  companyName: string | null;
  busy: boolean;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDelete: () => void;
}) {
  const meta = [
    offer.seniority ? SENIORITY_LABELS[offer.seniority] : null,
    locationLabel(offer.city, offer.country),
    salaryLabel(offer.salaryMin, offer.salaryMax, offer.salaryCurrency, offer.salaryPeriod),
  ].filter(Boolean);

  return (
    <li className={`${OFFER_ITEM_CARD} flex flex-wrap items-start justify-between gap-4`}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-body-md font-body-md text-text-primary font-semibold truncate">
            {offer.title}
          </p>
          <Badge tone={statusBadgeTone(offer.status)}>{STATUS_LABELS[offer.status]}</Badge>
          {offer.hasUnvalidatedChanges && offer.status === "validated" && (
            <Badge>Unvalidated changes</Badge>
          )}
        </div>
        <p className={`${OFFER_MUTED} truncate`}>
          {[companyName, ...meta].filter(Boolean).join(" · ")}
        </p>
      </div>
      <OfferActions offer={offer} busy={busy} onTransition={onTransition} onDelete={onDelete} />
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

  const companyNames = new Map(companies.map((company) => [company.id, company.name]));
  const pendingId = transition.variables?.offerId ?? remove.variables ?? null;
  const error = transition.error ?? remove.error;

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
                busy={pendingId === offer.id}
                onTransition={(action) => transition.mutate({ offerId: offer.id, action })}
                onDelete={() => {
                  if (window.confirm("Delete this draft offer? This cannot be undone.")) {
                    remove.mutate(offer.id);
                  }
                }}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
