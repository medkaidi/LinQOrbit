"use client";

import Link from "next/link";

import { SEARCH_STATUS_LABELS } from "@/features/candidate/about-section";
import { LINK_TYPE_LABELS } from "@/features/candidate/links-section";
import { CEFR_LABELS } from "@/features/candidate/languages-section";
import {
  CompletenessCard,
  fullName,
  IdentityAvatar,
  InfoBox,
  ITEM_CLASSES,
  ProfileError,
  ProfileSkeleton,
  SECTION_ICONS,
  ViewSection,
} from "@/features/candidate/profile-shared";
import { useAccount } from "@/hooks/use-account";
import { useCandidateProfile } from "@/hooks/use-candidate-profile";
import { countryOptions } from "@/config/countries";
import { Icon } from "@/components/ui/icon";
import { NavPill } from "@/components/ui/nav-pill";
import { cn } from "@/lib/utils/cn";
import type {
  CandidateProfile,
  DiplomaItem,
  ExperienceItem,
  LinkItem,
  SkillItem,
} from "@/types/candidate";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const COUNTRY_LABELS = new Map(countryOptions.map((option) => [option.value, option.label]));

const SKILL_LEVEL_LABELS: Record<number, string> = {
  1: "Beginner",
  2: "Elementary",
  3: "Intermediate",
  4: "Advanced",
  5: "Expert",
};

/** Variante compacte (puces de compétences) : mêmes bordures, padding réduit. */
const CHIP_CLASSES = "rounded-2xl border border-slate-border bg-item-surface/50 px-3 py-1.5";

/** "2023-04-01" → "Apr 2023" (lecture manuelle : aucune dépendance au fuseau). */
function monthYear(isoDate: string): string {
  const [year, month] = isoDate.split("-");
  return `${MONTHS[Number(month) - 1] ?? ""} ${year}`;
}

function formatPeriod(startDate: string, endDate: string | null): string {
  return `${monthYear(startDate)} — ${endDate ? monthYear(endDate) : "Present"}`;
}

/** Durée d'une période en années + mois, arrondie au mois complet (fin = aujourd'hui si null). */
function durationLabel(startDate: string, endDate: string | null): string {
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const end = endDate?.split("-").map(Number);
  const now = new Date();
  const endYear = end?.[0] ?? now.getFullYear();
  const endMonth = end?.[1] ?? now.getMonth() + 1;
  const endDay = end?.[2] ?? now.getDate();
  let months = (endYear - startYear) * 12 + (endMonth - startMonth);
  if (endDay < startDay) months -= 1;
  if (months < 1) return "< 1 mo";
  const years = Math.floor(months / 12);
  const rest = months % 12;
  const yearsLabel = `${years} yr${years === 1 ? "" : "s"}`;
  const monthsLabel = `${rest} mo${rest === 1 ? "" : "s"}`;
  if (years === 0) return monthsLabel;
  return rest === 0 ? yearsLabel : `${yearsLabel} ${monthsLabel}`;
}

function countryLabel(code: string | null): string | null {
  if (!code) return null;
  return COUNTRY_LABELS.get(code) ?? code;
}

function plural(count: number, noun: string): string {
  const pluralForm = noun.endsWith("y") ? `${noun.slice(0, -1)}ies` : `${noun}s`;
  return `${count} ${count > 1 ? pluralForm : noun}`;
}

function linkIcon(linkType: string): string {
  if (linkType === "certification") return "verified";
  if (linkType === "website") return "language";
  if (linkType === "github" || linkType === "gitlab" || linkType === "stack_overflow") {
    return "code";
  }
  return "link";
}

function linkTypeLabel(linkType: string): string {
  const labels = LINK_TYPE_LABELS as Record<string, string | undefined>;
  return labels[linkType] ?? linkType;
}

function cefrLabel(level: string): string {
  const labels = CEFR_LABELS as Record<string, string | undefined>;
  return labels[level] ?? level;
}

/** Pastille numérotée d'un item (expérience / diplôme), plus petite que celle des titres. */
function ItemIndex({ index }: { index: number }) {
  return (
    <span className="w-7 h-7 shrink-0 rounded-full bg-canvas-white border border-slate-border text-blue-deep flex items-center justify-center text-[12px] font-semibold">
      {index}
    </span>
  );
}

/** Période d'un item : pilule blanche bordée de gris, vert quand le poste est en cours. */
function PeriodBadge({
  startDate,
  endDate,
  withDuration = false,
}: {
  startDate: string;
  endDate: string | null;
  withDuration?: boolean;
}) {
  const current = endDate === null;
  const period = formatPeriod(startDate, endDate);
  const label = withDuration ? `${period} (${durationLabel(startDate, endDate)})` : period;
  return (
    <span
      className={cn(
        "shrink-0 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold",
        current
          ? "border-success-border bg-success-surface text-success-text"
          : "border-slate-border bg-canvas-white text-text-secondary",
      )}
    >
      {label}
    </span>
  );
}

function EmptyState({ message, cta }: { message: string; cta: string }) {
  return (
    <div className="flex flex-col items-start gap-4">
      <p className="text-body-sm font-body-sm text-text-secondary max-w-3xl">{message}</p>
      <NavPill icon="add" label={cta} href="/profile/edit" />
    </div>
  );
}

/** URL affichée dans une pill de lien : sans protocole ni slash final. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "");
}

/**
 * Lien du profil (GitHub, LinkedIn…) en « input simulé » : label hors
 * conteneur, pill cliquable si le lien existe, sinon pill « Not provided »
 * non cliquable — la structure de la colonne reste visible.
 */
function LinkInfoBox({ linkType, links }: { linkType: string; links: LinkItem[] }) {
  const link = links.find((item) => item.linkType === linkType) ?? null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-label-md text-label-md text-text-secondary">
        {linkTypeLabel(linkType)}
      </span>
      <div className="flex h-11 items-center gap-2 rounded-full border border-slate-border bg-item-surface/50 px-4">
        {link ? (
          <>
            <Icon
              name={linkIcon(linkType)}
              className="text-[16px] text-text-tertiary shrink-0"
            />
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer noopener"
              className="truncate text-body-md font-body-md text-text-primary hover:text-orange-deep transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
            >
              {displayUrl(link.url)}
            </a>
            <Icon name="arrow_outward" className="ml-auto text-[14px] text-text-tertiary shrink-0" />
          </>
        ) : (
          <p className="truncate text-body-md font-body-md text-text-primary">Not provided</p>
        )}
      </div>
    </div>
  );
}

function AboutSection({
  about,
  links,
}: {
  about: CandidateProfile["about"];
  links: LinkItem[];
}) {
  const { account } = useAccount();
  const statusLabels = SEARCH_STATUS_LABELS as Record<string, string | undefined>;
  const statusLabel = about.searchStatus ? statusLabels[about.searchStatus] : null;
  const position = about.title?.trim() || "Not provided";
  const currentLocation =
    (account
      ? [account.currentCity.trim(), countryLabel(account.currentCountry)]
      : []
    )
      .filter(Boolean)
      .join(", ") || "Not provided";

  return (
    <ViewSection
      id="about"
      title="Personal Information"
      icon={SECTION_ICONS.about}
    >
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-4">
          <div className="flex items-center gap-4 lg:col-start-1 lg:row-start-1">
            {account ? <IdentityAvatar account={account} /> : null}
            <div className="min-w-0">
              {account ? (
                <p className="truncate font-headline-md text-headline-md text-text-primary font-bold tracking-tight">
                  {fullName(account)}
                </p>
              ) : null}
              <p
                className={cn(
                  "truncate text-body-sm font-body-sm text-text-secondary",
                  account && "mt-1",
                )}
              >
                {position}
              </p>
            </div>
          </div>
          {account ? (
            <div className="lg:col-start-1 lg:row-start-2">
              <InfoBox label="Email" value={account.email} />
            </div>
          ) : null}
          {account ? (
            <div className="lg:col-start-1 lg:row-start-3">
              <InfoBox label="Phone" value={account.phone?.trim() || "Not provided"} />
            </div>
          ) : null}
          {account ? (
            <div className="lg:col-start-1 lg:row-start-4">
              <InfoBox label="Current location" value={currentLocation} />
            </div>
          ) : null}
          <div className="lg:col-start-2 lg:row-start-2">
            <InfoBox label="Search status" value={statusLabel ?? "Not provided"} />
          </div>
          <div className="lg:col-start-2 lg:row-start-3">
            <LinkInfoBox linkType="github" links={links} />
          </div>
          <div className="lg:col-start-2 lg:row-start-4">
            <LinkInfoBox linkType="linkedin" links={links} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <h3 className="font-label-md text-label-md text-text-secondary">About you</h3>
          {about.bio?.trim() ? (
            <div className="rounded-lg border border-slate-border bg-item-surface/50 px-4 py-3">
              <p className="text-body-md font-body-md text-text-primary leading-relaxed whitespace-pre-line">
                {about.bio}
              </p>
            </div>
          ) : (
            <EmptyState
              message="Your headline and summary are not written yet."
              cta="Write your about"
            />
          )}
        </div>
      </div>
    </ViewSection>
  );
}

function ExperienceSection({ experiences }: { experiences: ExperienceItem[] }) {
  return (
    <ViewSection
      id="experiences"
      title="Experience"
      icon={SECTION_ICONS.experiences}
      count={experiences.length > 0 ? plural(experiences.length, "entry") : undefined}
    >
      {experiences.length === 0 ? (
        <EmptyState
          message="No experience added yet. Recruiters look at this section first."
          cta="Add experience"
        />
      ) : (
        <ol className="flex flex-col gap-3">
          {experiences.map((item, index) => {
            const country = countryLabel(item.companyCountry);
            return (
              <li key={item.id} className={ITEM_CLASSES}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <ItemIndex index={index + 1} />
                    <div className="min-w-0">
                      <h3 className="font-label-md text-label-md text-text-primary">
                        {item.positionTitle}
                      </h3>
                      <p className="mt-0.5 text-body-sm font-body-sm text-text-secondary">
                        {item.companyName}
                        {country ? ` · ${country}` : ""}
                      </p>
                    </div>
                  </div>
                  <PeriodBadge startDate={item.startDate} endDate={item.endDate} withDuration />
                </div>
                {item.description ? (
                  <p className="mt-2 text-body-sm font-body-sm text-text-secondary leading-relaxed whitespace-pre-line">
                    {item.description}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </ViewSection>
  );
}

function EducationSection({ diplomas }: { diplomas: DiplomaItem[] }) {
  return (
    <ViewSection
      id="education"
      title="Education"
      icon={SECTION_ICONS.education}
      count={diplomas.length > 0 ? plural(diplomas.length, "diploma") : undefined}
    >
      {diplomas.length === 0 ? (
        <EmptyState message="No diploma added yet." cta="Add education" />
      ) : (
        <div className="flex flex-col gap-3">
          {diplomas.map((item, index) => {
            const country = countryLabel(item.institutionCountry);
            const detail = [item.degreeLabel, item.studyFieldLabel].filter(Boolean).join(" · ");
            return (
              <article key={item.id} className={ITEM_CLASSES}>
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
                  <div className="flex items-center gap-3 min-w-0">
                    <ItemIndex index={index + 1} />
                    <div className="min-w-0">
                      <h3 className="font-label-md text-label-md text-text-primary">
                        {item.title}
                      </h3>
                      <p className="mt-0.5 text-body-sm font-body-sm text-text-secondary">
                        {item.institution}
                        {country ? ` · ${country}` : ""}
                      </p>
                      {detail ? (
                        <p className="mt-0.5 text-body-sm font-body-sm text-text-tertiary">
                          {detail}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  <PeriodBadge startDate={item.startDate} endDate={item.endDate} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </ViewSection>
  );
}

function SkillsSection({ skills }: { skills: SkillItem[] }) {
  return (
    <ViewSection
      id="skills"
      title="Skills"
      icon={SECTION_ICONS.skills}
      count={skills.length > 0 ? plural(skills.length, "skill") : undefined}
    >
      {skills.length === 0 ? (
        <EmptyState message="No skill added yet." cta="Add skills" />
      ) : (
        <ul className="flex flex-wrap gap-2">
          {skills.map((skill) => (
            <li key={skill.skillId} className={cn(CHIP_CLASSES, "flex items-center gap-2")}>
              <span className="font-label-md text-label-md text-text-primary">{skill.name}</span>
              <span className="text-body-sm font-body-sm text-text-secondary">
                {SKILL_LEVEL_LABELS[skill.level] ?? `Level ${skill.level}`}
              </span>
              {skill.yearsExperience != null ? (
                <span className="text-body-sm font-body-sm text-text-tertiary">
                  {plural(skill.yearsExperience, "year")}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ViewSection>
  );
}

function LanguagesSection({ languages }: { languages: CandidateProfile["languages"] }) {
  return (
    <ViewSection
      id="languages"
      title="Languages"
      icon={SECTION_ICONS.languages}
      count={languages.length > 0 ? plural(languages.length, "language") : undefined}
    >
      {languages.length === 0 ? (
        <EmptyState message="No language added yet." cta="Add language" />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {languages.map((language) => (
            <li
              key={language.languageId}
              className={cn(ITEM_CLASSES, "flex items-center justify-between gap-3")}
            >
              <span className="font-label-md text-label-md text-text-primary">
                {language.name}
              </span>
              <span className="text-body-sm font-body-sm text-text-secondary">
                {cefrLabel(language.level)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </ViewSection>
  );
}

function LinksSection({ links }: { links: LinkItem[] }) {
  return (
    <ViewSection
      id="links"
      title="Links & certifications"
      icon={SECTION_ICONS.links}
      count={links.length > 0 ? plural(links.length, "link") : undefined}
    >
      {links.length === 0 ? (
        <EmptyState message="No link or certification added yet." cta="Add a link" />
      ) : (
        <ul className="flex flex-col gap-3">
          {links.map((link) => (
            <li key={link.id} className={ITEM_CLASSES}>
              <div className="flex items-center gap-2 min-w-0">
                <Icon
                  name={linkIcon(link.linkType)}
                  className="text-[16px] text-text-tertiary shrink-0"
                />
                <a
                  href={link.url}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="font-label-md text-label-md text-text-primary hover:text-orange-deep transition-colors truncate focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-deep"
                >
                  {link.label}
                </a>
                <span aria-hidden="true" className="text-body-sm font-body-sm text-text-tertiary">
                  ·
                </span>
                <span className="text-body-sm font-body-sm text-text-tertiary truncate">
                  {linkTypeLabel(link.linkType)}
                </span>
                <Icon name="arrow_outward" className="text-[14px] text-text-tertiary shrink-0" />
              </div>
              {link.linkType === "certification" && (link.issuer || link.issuedAt) ? (
                <p className="mt-1 text-body-sm font-body-sm text-text-secondary">
                  {[link.issuer, link.issuedAt ? monthYear(link.issuedAt) : null]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </ViewSection>
  );
}

function GoalsSection() {
  return (
    <ViewSection
      id="goals"
      title="Goals & criteria"
      icon={SECTION_ICONS.goals}
    >
      <p className="text-body-sm font-body-sm text-text-secondary max-w-3xl">
        Contract types, salary range, rhythm &amp; presence and geographic scope — coming soon.
      </p>
    </ViewSection>
  );
}

function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-border">
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
          <span className="text-text-primary font-semibold">My professional profile</span>
        </nav>
        <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          My professional profile
        </h1>
      </div>
      <NavPill icon="edit" label="Edit profile" href="/profile/edit" />
    </div>
  );
}

export function ProfileView() {
  const { data, isLoading, isError, refetch } = useCandidateProfile();

  if (isError && !data) {
    return (
      <div className="w-full flex flex-col gap-6">
        <Header />
        <ProfileError onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex flex-col gap-6">
        <Header />
        {isLoading ? <ProfileSkeleton /> : null}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <Header />
      <CompletenessCard profile={data} />

      <AboutSection about={data.about} links={data.links} />
      <ExperienceSection experiences={data.experiences} />
      <EducationSection diplomas={data.diplomas} />
      <SkillsSection skills={data.skills} />
      <LanguagesSection languages={data.languages} />
      <LinksSection links={data.links} />
      <GoalsSection />
    </div>
  );
}
