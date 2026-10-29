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
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHeaderSearch } from "@/hooks/use-header-search";
import { useScreeningStream } from "@/hooks/use-invitations";
import { useOfferNormalizationStream } from "@/hooks/use-normalization-stream";
import { SECTION_HEADER_CLASS, SECTION_TITLE_CLASS } from "@/components/ui/section";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { HeaderSearchRole } from "@/stores/header-search-store";
import type { Company, JobOfferListItem } from "@/types/recruiter";
import { CopyPublicLinkButton } from "@/features/job-offer/copy-public-link-button";
import { isScreeningInProgress, ScreeningBadge } from "@/features/invitation/screening-badge";
import { JobOfferCard } from "@/features/job-offer/job-offer-card";
import {
  EXPIRY_FILTER_OPTIONS,
  FilterSelect,
  NO_OFFER_FILTERS,
  OFFER_SEARCH_MAX_LENGTH,
  ResetFiltersButton,
  SENIORITY_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  toJobOfferFilters,
  vocabularyOptions,
  type OfferFilterState,
} from "@/features/job-offer/offer-filter-controls";
import {
  canRefreshOfferAnalysis,
  isOfferExpired,
  OFFER_INCOMPLETE_TOOLTIP,
  OFFER_TRANSITION_CONFIRM,
  PUBLIC_JOB_BASE_PATH,
  publicJobPath,
  validateConfirmMessage,
  type ConfirmedTransition,
  type OfferTransition,
} from "@/features/job-offer/job-offer-shared";

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
  const canRevalidate = canRefreshOfferAnalysis(offer);
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
      <MenuItem
        key="preview"
        icon="visibility"
        href={`/recruiter/offers/${offer.id}/preview`}
        onClick={() => setMenuOpen(false)}
      >
        Preview
      </MenuItem>,
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
          {/* Les deux contrôles « public » pointent sur la vitrine **sans
              compte** (`/public/jobs`) — pas sur la fiche `/jobs/[job]` du
              board authentifié, qui se rend dans le shell dashboard
              (sidebar visible). Le recruteur doit voir ce que voit un
              visiteur, et le lien copié doit s'ouvrir sans compte. */}
          <CopyPublicLinkButton
            publicId={offer.publicId}
            slug={offer.slug}
            basePath={PUBLIC_JOB_BASE_PATH}
          />
          <ButtonLink
            href={publicJobPath(offer.publicId, offer.slug, PUBLIC_JOB_BASE_PATH)}
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
      screeningBadge={
        offer.status === "published" && !isOfferExpired(offer) ? (
          <ScreeningBadge offerId={offer.id} screening={offer.screening} />
        ) : null
      }
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

/**
 * Suit en SSE (T-101) la recherche de candidats d'une offre que l'utilisateur
 * vient de publier : sans rendu, il relit la liste et le détail à chaque
 * transition tant que la recherche est en cours.
 */
function OfferScreeningWatcher({ offerId, active }: { offerId: string; active: boolean }) {
  useScreeningStream(offerId, active);
  return null;
}

/** Rôle du champ de recherche du header sur la liste recruteur : titre de l'offre. */
const OFFERS_SEARCH_ROLE: HeaderSearchRole = {
  id: "recruiter-offers",
  label: "Search offers",
  placeholder: "Search by job title",
  maxLength: OFFER_SEARCH_MAX_LENGTH,
};

/** Dialogue de confirmation ouvert au-dessus de la liste — un seul état pour les deux modales. */
type OfferDialog =
  | { kind: "transition"; offer: JobOfferListItem; action: ConfirmedTransition }
  | { kind: "delete"; offer: JobOfferListItem };

/**
 * Liste des offres des companies du recruteur (D12–D13) : un seul état de
 * mutation partagé par les actions, erreurs en `Alert` sans perdre la liste.
 */
export function JobOffersSection({ companies }: { companies: Company[] }) {
  const [search, setSearch] = useHeaderSearch(OFFERS_SEARCH_ROLE);
  const [selected, setSelected] = useState<OfferFilterState>(NO_OFFER_FILTERS);
  const debouncedSearch = useDebouncedValue(search, 300);
  const filters = toJobOfferFilters(debouncedSearch, selected);
  const offers = useInfiniteJobOffers(filters);
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

  const list = offers.data?.pages.flatMap((page) => page.items) ?? [];
  const filtered = Object.keys(filters).length > 0;
  const hasActiveControls = search.trim() !== "" || Object.values(selected).some(Boolean);
  const select = (patch: Partial<OfferFilterState>) =>
    setSelected((current) => ({ ...current, ...patch }));
  const resetFilters = () => {
    setSearch("");
    setSelected(NO_OFFER_FILTERS);
  };
  const watchedOffers = list.filter((offer) => watchedOfferIds.includes(offer.id));

  return (
    <section className="bg-canvas-white rounded-2xl shadow-sm">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Job offers</h2>
        <NavPill icon="add" label="New offer" href="/recruiter/offers/new" />
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col gap-4">
        <div className="flex flex-wrap items-end gap-3">
          <FilterSelect
            stacked
            label="Status"
            options={STATUS_FILTER_OPTIONS}
            value={selected.status}
            onChange={(value) => select({ status: value as OfferFilterState["status"] })}
          />
          <FilterSelect
            stacked
            label="Work mode"
            options={vocabularyOptions(workModes.data)}
            value={selected.workModeId}
            onChange={(value) => select({ workModeId: value })}
          />
          <FilterSelect
            stacked
            label="Contract"
            options={vocabularyOptions(contractTypes.data)}
            value={selected.contractTypeId}
            onChange={(value) => select({ contractTypeId: value })}
          />
          <FilterSelect
            stacked
            label="Employment"
            options={vocabularyOptions(employmentTypes.data)}
            value={selected.employmentTypeId}
            onChange={(value) => select({ employmentTypeId: value })}
          />
          <FilterSelect
            stacked
            label="Seniority"
            options={SENIORITY_FILTER_OPTIONS}
            value={selected.seniority}
            onChange={(value) => select({ seniority: value as OfferFilterState["seniority"] })}
          />
          <FilterSelect
            stacked
            label="Deadline"
            options={EXPIRY_FILTER_OPTIONS}
            value={selected.expiry}
            onChange={(value) => select({ expiry: value as OfferFilterState["expiry"] })}
          />
          {companies.length > 1 ? (
            <FilterSelect
              stacked
              label="Company"
              options={companies.map((company) => ({ value: company.id, label: company.name }))}
              value={selected.companyId}
              onChange={(value) => select({ companyId: value })}
            />
          ) : null}
          {hasActiveControls ? (
            <div className="shrink-0">
              <ResetFiltersButton onClick={resetFilters} />
            </div>
          ) : null}
        </div>
        {error ? (
          <Alert variant="error" title="Action failed">
            {getApiErrorMessage(error)}
          </Alert>
        ) : null}
        {offers.isError ? (
          <Alert variant="error" title="Could not load offers">
            <div className="flex items-center justify-between gap-3">
              <span>{getApiErrorMessage(offers.error)}</span>
              <Button variant="outline-sm" onClick={() => void offers.refetch()}>
                Retry
              </Button>
            </div>
          </Alert>
        ) : null}
        {offers.isLoading ? (
          <div className="flex items-center gap-2 text-body-sm text-text-secondary">
            <Spinner />
            Loading offers…
          </div>
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
            offers.isError ? null : filtered ? (
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-body-md font-body-md text-text-secondary">
                  No offers match your filters.
                </p>
                <ResetFiltersButton onClick={resetFilters} />
              </div>
            ) : (
              <p className="text-body-md font-body-md text-text-secondary">
                No offers yet. Create your first job offer to start matching candidates.
              </p>
            )
          }
        />
        {watchedOffers.map((offer) => (
          <OfferNormalizationWatcher
            key={offer.id}
            offerId={offer.id}
            active={offer.normalizationInProgress}
          />
        ))}
        {watchedOffers.map((offer) => (
          <OfferScreeningWatcher
            key={`screening-${offer.id}`}
            offerId={offer.id}
            active={isScreeningInProgress(offer.screening)}
          />
        ))}
        {dialog?.kind === "transition" ? (
          <ConfirmDialog
            title={OFFER_TRANSITION_CONFIRM[dialog.action].title}
            message={
              dialog.action === "publish"
                ? OFFER_TRANSITION_CONFIRM.publish.message
                : validateConfirmMessage(dialog.offer, dialog.action)
            }
            confirmLabel={OFFER_TRANSITION_CONFIRM[dialog.action].confirmLabel}
            icon={OFFER_TRANSITION_CONFIRM[dialog.action].icon}
            busy={transition.isPending}
            onConfirm={() => {
              const { offer, action } = dialog;
              transition.mutate(
                { offerId: offer.id, action },
                {
                  onSuccess: () => {
                    // La publication lance la recherche de candidats (T-101) : suivie aussi.
                    setWatchedOfferIds((ids) => (ids.includes(offer.id) ? ids : [...ids, offer.id]));
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
