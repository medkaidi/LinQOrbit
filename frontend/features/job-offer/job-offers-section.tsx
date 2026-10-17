"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
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
  useEmploymentTypes,
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
  publicJobPath,
} from "@/features/job-offer/job-offer-shared";

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

function validateConfirmMessage(offer: JobOfferListItem): string {
  if (offer.normalizationFailed) {
    return "We could not finish analyzing this offer. You can try again.";
  }
  if (offer.hasUnvalidatedChanges) {
    return "You've made changes to this offer. Validate again to refresh its analysis.";
  }
  return TRANSITION_CONFIRM.validate.message;
}

/** Mutation en cours sur une ligne (busy ciblé : primaire = transition, kebab = tout le reste). */
type OfferAction = "transition" | "duplicate" | "delete";

const MENU_CLASS =
  "absolute right-0 top-full mt-2 w-48 rounded-2xl bg-canvas-white border border-slate-border shadow-md p-2 z-50 origin-top-right transition-[opacity,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] starting:opacity-0 starting:scale-95 motion-reduce:transition-none";
const MENU_ITEM_CLASS =
  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-body-md font-body-md text-text-primary hover:bg-canvas-subtle transition-colors cursor-pointer";
const MENU_ITEM_DANGER_CLASS =
  "w-full flex items-center gap-3 px-3 py-2 rounded-xl text-body-md font-body-md text-danger hover:bg-canvas-subtle transition-colors cursor-pointer";
const MENU_ITEM_ICON = "text-[18px] text-text-secondary";

/**
 * Actions d'une offre : une action primaire contextuelle (prochain pas du
 * cycle de vie) + Edit visibles, le reste dans un menu overflow (⋯) —
 * destructif en fin de menu après séparateur. Pattern du `UserMenu`.
 */
function OfferActions({
  offer,
  busyAction,
  onTransition,
  onDuplicate,
  onDelete,
}: {
  offer: JobOfferListItem;
  busyAction: OfferAction | null;
  onTransition: (action: "validate" | "publish" | "close") => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ready = offer.readyToPublish;
  const blocked = ready ? undefined : OFFER_INCOMPLETE_TOOLTIP;
  const canRevalidate =
    !offer.normalizationInProgress && (offer.normalizationFailed || offer.hasUnvalidatedChanges);
  const [menuOpen, setMenuOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!menuOpen) {
      return;
    }
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [menuOpen]);

  const runMenuItem = (action: () => void) => {
    setMenuOpen(false);
    action();
  };

  const duplicateItem = (
    <button
      key="duplicate"
      type="button"
      role="menuitem"
      className={MENU_ITEM_CLASS}
      onClick={() => runMenuItem(onDuplicate)}
    >
      <Icon name="content_copy" className={MENU_ITEM_ICON} />
      Duplicate
    </button>
  );
  const separatorItem = (
    <div key="separator" className="my-1 h-px bg-slate-border" role="separator" />
  );
  const closeItem = (
    <button
      key="close"
      type="button"
      role="menuitem"
      className={MENU_ITEM_CLASS}
      onClick={() => runMenuItem(() => onTransition("close"))}
    >
      <Icon name="close" className={MENU_ITEM_ICON} />
      Close
    </button>
  );

  const menuItems: ReactNode[] = [];
  if (offer.status === "draft") {
    menuItems.push(
      duplicateItem,
      separatorItem,
      <button
        key="delete"
        type="button"
        role="menuitem"
        className={MENU_ITEM_DANGER_CLASS}
        onClick={() => runMenuItem(onDelete)}
      >
        <Icon name="delete" className="text-[18px]" />
        Delete
      </button>,
    );
  } else if (offer.status === "validated") {
    menuItems.push(
      <Link
        key="preview"
        href={`/recruiter/offers/${offer.id}/preview`}
        role="menuitem"
        className={MENU_ITEM_CLASS}
        onClick={() => setMenuOpen(false)}
      >
        <Icon name="visibility" className={MENU_ITEM_ICON} />
        Preview
      </Link>,
      ...(canRevalidate
        ? [
            <button
              key="revalidate"
              type="button"
              role="menuitem"
              className={MENU_ITEM_CLASS}
              onClick={() => runMenuItem(() => onTransition("validate"))}
            >
              <Icon name="check_circle" className={MENU_ITEM_ICON} />
              Validate again
            </button>,
          ]
        : []),
      duplicateItem,
      separatorItem,
      closeItem,
    );
  } else if (offer.status === "published") {
    menuItems.push(duplicateItem, separatorItem, closeItem);
  }

  return (
    <div ref={containerRef} className="relative flex flex-wrap items-center gap-2 shrink-0">
      {offer.status === "draft" && (
        <>
          <CtaButton
            icon="check_circle"
            busy={busyAction === "transition"}
            disabled={!ready}
            title={blocked}
            onClick={() => onTransition("validate")}
          >
            Validate
          </CtaButton>
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={OFFER_LINK_PILL_CLASS}>
            Edit
          </Link>
        </>
      )}
      {offer.status === "validated" && (
        <>
          <CtaButton
            icon="publish"
            busy={busyAction === "transition"}
            disabled={!ready}
            title={blocked}
            onClick={() => onTransition("publish")}
          >
            Publish
          </CtaButton>
          <Link href={`/recruiter/offers/${offer.id}/edit`} className={OFFER_LINK_PILL_CLASS}>
            Edit
          </Link>
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
        </>
      )}
      {menuItems.length > 0 ? (
        <>
          <Button
            ref={triggerRef}
            variant="icon-sm"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="More actions"
            busy={busyAction !== null}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {busyAction === null ? <Icon name="more_vert" className="text-[20px]" /> : null}
          </Button>
          {menuOpen ? (
            <div role="menu" aria-label="More actions" className={MENU_CLASS}>
              {menuItems}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

function OfferRow({
  offer,
  companyName,
  contractTypeLabel,
  employmentTypeLabel,
  workModeLabel,
  busyAction,
  onTransition,
  onDuplicate,
  onDelete,
}: {
  offer: JobOfferListItem;
  companyName: string | null;
  contractTypeLabel: string | null;
  employmentTypeLabel: string | null;
  workModeLabel: string | null;
  busyAction: OfferAction | null;
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
      employmentTypeLabel={employmentTypeLabel}
      salaryMin={offer.salaryMin}
      salaryMax={offer.salaryMax}
      salaryCurrency={offer.salaryCurrency}
      salaryPeriod={offer.salaryPeriod}
      expired={isOfferExpired(offer)}
      normalization={
        offer.normalizationInProgress ? "progress" : offer.normalizationFailed ? "failed" : null
      }
      unvalidatedChanges={offer.hasUnvalidatedChanges}
      readyToPublish={offer.readyToPublish}
      createdAt={offer.createdAt}
      updatedAt={offer.updatedAt}
      expiresAt={offer.expiresAt}
      actions={
        <OfferActions
          offer={offer}
          busyAction={busyAction}
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
  const employmentTypes = useEmploymentTypes();
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
  const employmentLabels = new Map(
    (employmentTypes.data ?? []).map((option) => [option.id, option.label] as const),
  );
  const workModeLabels = new Map(
    (workModes.data ?? []).map((option) => [option.id, option.label] as const),
  );
  // variables persiste après coup en TanStack Query v5 : busy uniquement pendant isPending.
  const pendingTransitionId = transition.isPending ? transition.variables?.offerId ?? null : null;
  const pendingRemoveId = remove.isPending ? remove.variables ?? null : null;
  const pendingDuplicateId = duplicate.isPending ? duplicate.variables ?? null : null;
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
              employmentTypeLabel={
                offer.employmentTypeId
                  ? employmentLabels.get(offer.employmentTypeId) ?? null
                  : null
              }
              workModeLabel={
                offer.workModeId ? workModeLabels.get(offer.workModeId) ?? null : null
              }
              busyAction={
                pendingTransitionId === offer.id
                  ? "transition"
                  : pendingRemoveId === offer.id
                    ? "delete"
                    : pendingDuplicateId === offer.id
                      ? "duplicate"
                      : null
              }
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
            message={
              confirmTransition.action === "validate"
                ? validateConfirmMessage(confirmTransition.offer)
                : TRANSITION_CONFIRM[confirmTransition.action].message
            }
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
