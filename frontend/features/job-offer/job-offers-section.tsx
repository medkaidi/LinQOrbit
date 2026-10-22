"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";

import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { InfiniteList } from "@/components/ui/infinite-list";
import { MenuItem, MenuPanel, MenuSeparator } from "@/components/ui/menu";
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
import { useOfferNormalizationStream } from "@/hooks/use-normalization-stream";
import { SECTION_HEADER_CLASS, SECTION_TITLE_CLASS } from "@/components/ui/section";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { Company, JobOfferListItem } from "@/types/recruiter";
import { CopyPublicLinkButton } from "@/features/job-offer/copy-public-link-button";
import { JobOfferCard } from "@/features/job-offer/job-offer-card";
import {
  isOfferExpired,
  OFFER_INCOMPLETE_TOOLTIP,
  publicJobPath,
} from "@/features/job-offer/job-offer-shared";

/** Transition du cycle de vie demandée depuis une ligne (close part sans confirmation). */
type OfferTransition = "validate" | "revalidate" | "publish" | "close";
/** Transitions confirmées par un dialogue. */
type ConfirmedTransition = Exclude<OfferTransition, "close">;

/** Contenu de la confirmation selon l'action (validate / revalidate / publish). */
const TRANSITION_CONFIRM: Record<
  ConfirmedTransition,
  { title: string; message: string; confirmLabel: string; icon: string }
> = {
  validate: {
    title: "Validate this offer?",
    message: "This marks the offer as reviewed and ready to publish. You can still edit it afterwards.",
    confirmLabel: "Validate",
    icon: "check_circle",
  },
  revalidate: {
    title: "Refresh this offer's analysis?",
    message:
      "The offer stays published and visible on the job board while its analysis is refreshed in the background.",
    confirmLabel: "Validate again",
    icon: "check_circle",
  },
  publish: {
    title: "Publish this offer?",
    message: "The offer will become publicly visible on the job board.",
    confirmLabel: "Publish",
    icon: "publish",
  },
};

/** Message de confirmation d'une (re)validation : la raison de la relance prime sur le texte générique. */
function validateConfirmMessage(offer: JobOfferListItem, action: "validate" | "revalidate"): string {
  if (offer.normalizationFailed) {
    return "We could not finish analyzing this offer. You can try again.";
  }
  if (offer.analysisOutdated) {
    return "This offer's analysis was made with an earlier version of our analysis. Validate again to refresh it.";
  }
  if (offer.hasUnvalidatedChanges) {
    return "You've made changes to this offer. Validate again to refresh its analysis.";
  }
  return TRANSITION_CONFIRM[action].message;
}

/** Mutation en cours sur une ligne (busy ciblé : primaire = transition, kebab = tout le reste). */
type OfferAction = "transition" | "duplicate" | "delete";

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
  onTransition: (action: OfferTransition) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const ready = offer.readyToPublish;
  const blocked = ready ? undefined : OFFER_INCOMPLETE_TOOLTIP;
  const canRevalidate =
    !offer.normalizationInProgress &&
    (offer.normalizationFailed || offer.analysisOutdated || offer.hasUnvalidatedChanges);
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
    <MenuItem key="duplicate" icon="content_copy" onClick={() => runMenuItem(onDuplicate)}>
      Duplicate
    </MenuItem>
  );
  const separatorItem = <MenuSeparator key="separator" />;
  // « Validate again » : /validate tant que l'offre est éditable, /revalidate une fois publiée
  // (rafraîchissement de l'analyse sans changement de cycle de vie, D63).
  const revalidateItems = canRevalidate
    ? [
        <MenuItem
          key="revalidate"
          icon="check_circle"
          onClick={() =>
            runMenuItem(() => onTransition(offer.status === "published" ? "revalidate" : "validate"))
          }
        >
          Validate again
        </MenuItem>,
      ]
    : [];
  const closeItem = (
    <MenuItem key="close" icon="close" onClick={() => runMenuItem(() => onTransition("close"))}>
      Close
    </MenuItem>
  );

  const menuItems: ReactNode[] = [];
  if (offer.status === "draft") {
    menuItems.push(
      duplicateItem,
      separatorItem,
      <MenuItem
        key="delete"
        icon="delete"
        tone="danger"
        onClick={() => runMenuItem(onDelete)}
      >
        Delete
      </MenuItem>,
    );
  } else if (offer.status === "validated") {
    menuItems.push(
      <MenuItem
        key="preview"
        icon="visibility"
        href={`/recruiter/offers/${offer.id}/preview`}
        onClick={() => setMenuOpen(false)}
      >
        Preview
      </MenuItem>,
      ...revalidateItems,
      duplicateItem,
      separatorItem,
      closeItem,
    );
  } else if (offer.status === "published") {
    menuItems.push(...revalidateItems, duplicateItem, separatorItem, closeItem);
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
          <ButtonLink href={`/recruiter/offers/${offer.id}/edit`} variant="outline-sm">
            Edit
          </ButtonLink>
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
          <ButtonLink href={`/recruiter/offers/${offer.id}/edit`} variant="outline-sm">
            Edit
          </ButtonLink>
        </>
      )}
      {offer.status === "published" && (
        <>
          <ButtonLink
            href={`/recruiter/offers/${offer.id}/applications`}
            variant="outline-sm"
          >
            <Icon name="inbox" className="text-[14px]" />
            Applications
          </ButtonLink>
          <CopyPublicLinkButton publicId={offer.publicId} slug={offer.slug} />
          <ButtonLink
            href={publicJobPath(offer.publicId, offer.slug)}
            variant="outline-sm"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Icon name="open_in_new" className="text-[14px]" />
            View public page
          </ButtonLink>
        </>
      )}
      {offer.status === "closed" && (
        <ButtonLink href={`/recruiter/offers/${offer.id}/applications`} variant="outline-sm">
          <Icon name="inbox" className="text-[14px]" />
          Applications
        </ButtonLink>
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
            <MenuPanel label="More actions" className="w-48">
              {menuItems}
            </MenuPanel>
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
  onTransition: (action: OfferTransition) => void;
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
      analysisOutdated={offer.analysisOutdated}
      readyToPublish={offer.readyToPublish}
      applicationCount={offer.applicationCount}
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
 * Suit en SSE (D64) l'analyse d'une offre que l'utilisateur vient de (re)valider :
 * un flux par ressource, jamais un par carte — sans rendu, il relit la liste et
 * le détail de l'offre à chaque transition tant que l'analyse est en cours.
 */
function OfferNormalizationWatcher({ offerId, active }: { offerId: string; active: boolean }) {
  useOfferNormalizationStream(offerId, active);
  return null;
}

/** Dialogue de confirmation ouvert au-dessus de la liste — un seul état pour les deux modales. */
type OfferDialog =
  | { kind: "transition"; offer: JobOfferListItem; action: ConfirmedTransition }
  | { kind: "delete"; offer: JobOfferListItem };

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
  const [dialog, setDialog] = useState<OfferDialog | null>(null);
  // Offres (re)validées depuis cette liste : seules elles ouvrent un flux SSE pendant leur analyse.
  const [watchedOfferIds, setWatchedOfferIds] = useState<readonly string[]>([]);

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
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Job offers</h2>
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
        <header className={SECTION_HEADER_CLASS}>
          <h2 className={SECTION_TITLE_CLASS}>Job offers</h2>
        </header>
        <div className="px-6 pt-5 pb-6">
          <Alert variant="error" title="Could not load offers">
            <div className="flex items-center justify-between gap-3">
              <span>{getApiErrorMessage(offers.error)}</span>
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
  const watchedOffers = list.filter((offer) => watchedOfferIds.includes(offer.id));

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Job offers</h2>
        <NavPill icon="add" label="New offer" href="/recruiter/offers/new" />
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        {error ? (
          <Alert variant="error" title="Action failed">
            {getApiErrorMessage(error)}
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
                  : setDialog({ kind: "transition", offer, action })
              }
              onDuplicate={() => duplicate.mutate(offer.id)}
              onDelete={() => setDialog({ kind: "delete", offer })}
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
        {watchedOffers.map((offer) => (
          <OfferNormalizationWatcher
            key={offer.id}
            offerId={offer.id}
            active={offer.normalizationInProgress}
          />
        ))}
        {dialog?.kind === "transition" ? (
          <ConfirmDialog
            title={TRANSITION_CONFIRM[dialog.action].title}
            message={
              dialog.action === "publish"
                ? TRANSITION_CONFIRM.publish.message
                : validateConfirmMessage(dialog.offer, dialog.action)
            }
            confirmLabel={TRANSITION_CONFIRM[dialog.action].confirmLabel}
            icon={TRANSITION_CONFIRM[dialog.action].icon}
            busy={transition.isPending}
            onConfirm={() => {
              const { offer, action } = dialog;
              transition.mutate(
                { offerId: offer.id, action },
                {
                  onSuccess: () => {
                    if (action !== "publish") {
                      setWatchedOfferIds((ids) => (ids.includes(offer.id) ? ids : [...ids, offer.id]));
                    }
                  },
                  onSettled: () => setDialog(null),
                },
              );
            }}
            onCancel={() => setDialog(null)}
          />
        ) : null}
        {dialog?.kind === "delete" ? (
          <ConfirmDialog
            title="Delete this draft offer?"
            message="This cannot be undone."
            confirmLabel="Delete"
            tone="danger"
            icon="delete"
            busy={remove.isPending}
            onConfirm={() => {
              remove.mutate(dialog.offer.id, {
                onSettled: () => setDialog(null),
              });
            }}
            onCancel={() => setDialog(null)}
          />
        ) : null}
      </div>
    </section>
  );
}
