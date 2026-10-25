"use client";

import Link from "next/link";
import { useState } from "react";
import type { ReactNode } from "react";

import {
  Breadcrumb,
  BreadcrumbCurrent,
  BreadcrumbLink,
  BreadcrumbSeparator,
  LINK_ACCENT_CLASS,
  PageHeader,
} from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button, ButtonLink, CtaLink } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { InfiniteList } from "@/components/ui/infinite-list";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { MUTED_PILL_CLASS } from "@/components/ui/pill";
import {
  companyInitials,
  expiryCountdown,
  locationLabel,
  publicJobPath,
  relativeTimeLabel,
  salaryLabel,
  seniorityLabel,
  workModeIcon,
} from "@/features/job-offer/job-offer-shared";
import {
  FilterSelect,
  OFFER_SEARCH_MAX_LENGTH,
  ResetFiltersButton,
  SENIORITY_FILTER_OPTIONS,
  vocabularyOptions,
} from "@/features/job-offer/offer-filter-controls";
import { countryOptions } from "@/config/countries";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useHeaderSearch } from "@/hooks/use-header-search";
import {
  useContractTypes,
  useEmploymentTypes,
  useWorkModes,
} from "@/hooks/use-job-offers";
import { useInfinitePublicJobs } from "@/hooks/use-public-jobs";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { HeaderSearchRole } from "@/stores/header-search-store";
import type { PublicJobFilters, PublicJobListItem, PublicJobSort } from "@/types/public-job";
import type { SeniorityValue } from "@/types/recruiter";

/** Rôle du champ de recherche du header sur le board : titre ou société de l'offre. */
const BOARD_SEARCH_ROLE: HeaderSearchRole = {
  id: "job-board",
  label: "Search jobs",
  placeholder: "Search by job title or company",
  maxLength: OFFER_SEARCH_MAX_LENGTH,
};

const SORT_OPTIONS: { value: PublicJobSort; label: string }[] = [
  { value: "recent", label: "Most recent" },
  { value: "expiringSoon", label: "Expiring soon" },
];

/** Sélections brutes de la toolbar : "" = « All » (aucun filtre). */
type BoardSelection = {
  workModeId: string;
  contractTypeId: string;
  employmentTypeId: string;
  seniority: "" | SeniorityValue;
  country: string;
};

const NO_SELECTION: BoardSelection = {
  workModeId: "",
  contractTypeId: "",
  employmentTypeId: "",
  seniority: "",
  country: "",
};

/**
 * État de la toolbar → filtres d'API : une sélection vide n'est jamais
 * envoyée, et le tri par défaut (« recent ») non plus.
 */
function toPublicJobFilters(
  search: string,
  selection: BoardSelection,
  sort: PublicJobSort,
): PublicJobFilters {
  const q = search.trim();
  return {
    ...(q ? { q } : {}),
    ...(selection.workModeId ? { workModeId: selection.workModeId } : {}),
    ...(selection.contractTypeId ? { contractTypeId: selection.contractTypeId } : {}),
    ...(selection.employmentTypeId ? { employmentTypeId: selection.employmentTypeId } : {}),
    ...(selection.seniority ? { seniority: selection.seniority } : {}),
    ...(selection.country ? { country: selection.country } : {}),
    ...(sort !== "recent" ? { sort } : {}),
  };
}

/** Tuile bleue (accent secondaire) : sur un board tout est publié, la couleur porte l'identité, pas un statut. */
const TILE_CLASS = "bg-blue-surface text-blue-deep";

/**
 * Pill de compétence uniforme (neutre) : le board n'hiérarchise pas les
 * compétences — la carte les expose toutes (T-76, transparence candidat).
 */
const META_LINE_ITEM = "inline-flex items-center gap-1.5";
const META_LINE_ICON = "text-[16px] text-text-tertiary";

function PublicJobCard({ job }: { job: PublicJobListItem }) {
  const location = locationLabel(job.city, job.country);
  const seniority = seniorityLabel(job.seniority);
  const salary = salaryLabel(
    job.salaryMin,
    job.salaryMax,
    job.salaryCurrency,
    job.salaryPeriod,
  );
  const posted = job.publishedAt ? relativeTimeLabel(job.publishedAt) : null;
  const expiry = job.expiresAt ? expiryCountdown(job.expiresAt) : null;
  const jobPath = publicJobPath(job.publicId, job.slug);

  const meta: ReactNode[] = [];
  if (seniority) {
    meta.push(
      <span key="seniority" className={META_LINE_ITEM}>
        <Icon name="signal_cellular_alt" className={META_LINE_ICON} />
        {seniority}
      </span>,
    );
  }
  if (location) {
    meta.push(
      <span key="location" className={META_LINE_ITEM}>
        <Icon name="location_on" className={META_LINE_ICON} />
        {location}
      </span>,
    );
  }
  if (job.workMode) {
    meta.push(
      <span key="work-mode" className={META_LINE_ITEM}>
        <Icon name={workModeIcon(job.workMode)} className={META_LINE_ICON} />
        {job.workMode}
      </span>,
    );
  }
  if (job.contractType) {
    meta.push(
      <span key="contract" className={META_LINE_ITEM}>
        <Icon name="badge" className={META_LINE_ICON} />
        {job.contractType}
      </span>,
    );
  }
  if (job.employmentType) {
    meta.push(
      <span key="employment-type" className={META_LINE_ITEM}>
        <Icon name="schedule" className={META_LINE_ICON} />
        {job.employmentType}
      </span>,
    );
  }
  if (salary) {
    meta.push(
      <span key="salary" className={`${META_LINE_ITEM} font-semibold text-text-primary`}>
        <Icon name="payments" className={META_LINE_ICON} />
        {salary}
      </span>,
    );
  }

  return (
    <li className="rounded-3xl border border-slate-border bg-canvas-white p-6 shadow-sm transition-colors hover:border-orange-border group/job-board-card flex flex-col gap-4">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 font-label-lg text-label-lg font-bold ${TILE_CLASS}`}
          aria-hidden="true"
        >
          {job.companyName ? (
            companyInitials(job.companyName)
          ) : (
            <Icon name="work" className="text-[24px]" />
          )}
        </div>
        <div className="min-w-0">
          <p
            className={`font-label-md text-label-md uppercase tracking-wider truncate ${job.companyName ? "text-text-primary" : "text-text-tertiary"}`}
          >
            {job.companyName ?? "No company"}
          </p>
          {posted ? (
            <p className="font-body-sm text-body-sm text-text-tertiary">Posted {posted}</p>
          ) : null}
        </div>
      </div>

      <h2 className="font-headline-sm text-headline-sm text-text-primary group-hover/job-board-card:text-orange-deep transition-colors">
        <Link href={jobPath} className={LINK_ACCENT_CLASS}>
          {job.title}
        </Link>
      </h2>

      {meta.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-body-sm text-body-sm text-text-secondary">
          {meta}
        </div>
      ) : null}

      {job.skills.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className={MUTED_PILL_CLASS}>
              {skill}
            </span>
          ))}
        </div>
      ) : null}

      <div className="mt-auto pt-4 border-t border-slate-border flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        {expiry ? (
          <span
            className={`inline-flex items-center gap-1.5 font-body-sm text-body-sm ${
              expiry.urgent ? "text-orange-deep font-semibold" : "text-text-tertiary"
            }`}
          >
            <Icon name="event" className="text-[16px]" />
            {expiry.label}
          </span>
        ) : null}
        <div className="ml-auto flex items-center gap-2">
          <ButtonLink variant="outline-sm" href={jobPath}>
            View job
          </ButtonLink>
          <CtaLink icon="bolt" href={`${jobPath}/apply`}>
            Apply
          </CtaLink>
        </div>
      </div>
    </li>
  );
}

/**
 * Job board (T-72, intégré au shell dashboard en T-74, refonte cartes T-76,
 * recherche, filtres et tri T-77) : offres publiées non expirées, flux en
 * grille deux colonnes ≥ xl et chargement automatique en bas de liste
 * (`InfiniteList`) — la taille de page est décidée par le backend (D34). La
 * toolbar reste montée pendant le chargement et en cas d'erreur : sans elle,
 * un échec détruirait les filtres que l'utilisateur vient de saisir.
 */
export function PublicJobsView() {
  const [search, setSearch] = useHeaderSearch(BOARD_SEARCH_ROLE);
  const [selection, setSelection] = useState<BoardSelection>(NO_SELECTION);
  const [sort, setSort] = useState<PublicJobSort>("recent");
  const debouncedSearch = useDebouncedValue(search, 300);
  const filters = toPublicJobFilters(debouncedSearch, selection, sort);
  const query = useInfinitePublicJobs(filters);
  const workModes = useWorkModes();
  const contractTypes = useContractTypes();
  const employmentTypes = useEmploymentTypes();
  const jobs = query.data?.pages.flatMap((page) => page.items) ?? [];
  const total = query.data?.pages[0]?.total ?? 0;
  // Le tri seul n'est pas un filtre : il ne change pas le message d'état vide.
  const filtered = Object.keys(filters).some((key) => key !== "sort");
  const hasActiveControls =
    search.trim() !== "" || Object.values(selection).some(Boolean) || sort !== "recent";
  const select = (patch: Partial<BoardSelection>) =>
    setSelection((current) => ({ ...current, ...patch }));
  const resetFilters = () => {
    setSearch("");
    setSelection(NO_SELECTION);
    setSort("recent");
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        as="header"
        breadcrumb={
          <Breadcrumb>
            <BreadcrumbLink href="/dashboard">Candidate space</BreadcrumbLink>
            <BreadcrumbSeparator />
            <BreadcrumbCurrent>Browse offers</BreadcrumbCurrent>
          </Breadcrumb>
        }
        title="Open positions"
      />

      <div className="w-full flex flex-col gap-4">
        <div className="rounded-2xl border border-slate-border bg-canvas-white p-4 shadow-sm">
          {/* Une seule rangée à partir de xl : cinq filtres à parts égales, tri + Reset dans la dernière colonne à la largeur de leur contenu. */}
          <div className="grid grid-cols-1 items-end gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[repeat(5,minmax(0,1fr))_auto]">
            <FilterSelect
              stacked
              label="Work mode"
              options={vocabularyOptions(workModes.data)}
              value={selection.workModeId}
              onChange={(value) => select({ workModeId: value })}
            />
            <FilterSelect
              stacked
              label="Contract"
              options={vocabularyOptions(contractTypes.data)}
              value={selection.contractTypeId}
              onChange={(value) => select({ contractTypeId: value })}
            />
            <FilterSelect
              stacked
              label="Employment"
              options={vocabularyOptions(employmentTypes.data)}
              value={selection.employmentTypeId}
              onChange={(value) => select({ employmentTypeId: value })}
            />
            <FilterSelect
              stacked
              label="Seniority"
              options={SENIORITY_FILTER_OPTIONS}
              value={selection.seniority}
              onChange={(value) => select({ seniority: value as BoardSelection["seniority"] })}
            />
            <FilterSelect
              stacked
              label="Country"
              searchable
              options={countryOptions}
              value={selection.country}
              onChange={(value) => select({ country: value })}
            />
            <div className="flex min-w-0 items-end gap-2">
              <div className="min-w-0 flex-1">
                <Select
                  label="Sort by"
                  compact
                  options={SORT_OPTIONS}
                  value={sort}
                  onValueChange={(value) => setSort(value as PublicJobSort)}
                />
              </div>
              {hasActiveControls ? <ResetFiltersButton onClick={resetFilters} /> : null}
            </div>
          </div>
        </div>

        {query.isLoading ? (
          <div className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading jobs…
          </div>
        ) : query.isError ? (
          <Alert
            variant="error"
            title="Couldn't load offers"
            action={
              <Button variant="outline-sm" onClick={() => query.refetch()}>
                Retry
              </Button>
            }
          >
            {getApiErrorMessage(query.error)}
          </Alert>
        ) : jobs.length === 0 ? (
          <div className="rounded-2xl border border-slate-border bg-canvas-white px-6 py-12 text-center shadow-sm">
            <h2 className="font-headline-sm text-headline-sm text-text-primary">
              {filtered ? "No offers match your filters" : "No open positions right now"}
            </h2>
            <p className="mt-2 text-body-sm font-body-sm text-text-secondary">
              {filtered
                ? "Try a different search or remove some filters."
                : "Published offers will show up here as companies open roles."}
            </p>
            {filtered ? (
              <div className="mt-4 flex justify-center">
                <ResetFiltersButton onClick={resetFilters} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <p className="font-body-sm text-body-sm text-text-tertiary">
              {total} {total === 1 ? "offer" : "offers"}
            </p>
            <InfiniteList
              items={jobs}
              keyExtractor={(job) => job.publicId}
              renderItem={(job) => <PublicJobCard job={job} />}
              hasNextPage={query.hasNextPage}
              isFetchingNextPage={query.isFetchingNextPage}
              fetchNextPage={query.fetchNextPage}
              listClassName="grid grid-cols-1 gap-4 xl:grid-cols-2"
            />
          </div>
        )}
      </div>
    </div>
  );
}
