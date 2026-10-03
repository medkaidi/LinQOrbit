"use client";

import Link from "next/link";

import { AboutSection } from "@/features/candidate/about-section";
import { DiplomasSection } from "@/features/candidate/diplomas-section";
import { ExperiencesSection } from "@/features/candidate/experiences-section";
import { LanguagesSection } from "@/features/candidate/languages-section";
import { LinksSection } from "@/features/candidate/links-section";
import { SkillsSection } from "@/features/candidate/skills-section";
import {
  CompletenessCard,
  ProfileError,
  ProfileSkeleton,
} from "@/features/candidate/profile-shared";
import { useCandidateProfile } from "@/hooks/use-candidate-profile";
import { Icon } from "@/components/ui/icon";

function Header() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link
          href="/profile"
          className="inline-flex items-center gap-1 text-body-sm font-body-sm text-text-secondary hover:text-orange-deep transition-colors"
        >
          <Icon name="arrow_back" className="text-[16px]" />
          Back to profile
        </Link>
        <h1 className="mt-1 font-headline-lg text-headline-lg-mobile lg:text-headline-lg text-text-primary font-bold tracking-tight">
          Edit profile
        </h1>
        <p className="mt-1 text-body-md font-body-md text-text-secondary">
          Your professional profile. Every section saves on its own.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Coming soon"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-subtle border border-primary-fixed-dim text-orange-deep font-bold text-xs cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="upload_file" className="text-[16px]" />
          Upload CV
        </button>
        <button
          type="button"
          disabled
          aria-disabled="true"
          title="Coming soon"
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-orange-subtle border border-primary-fixed-dim text-orange-deep font-bold text-xs cursor-not-allowed disabled:opacity-60"
        >
          <Icon name="add_a_photo" className="text-[16px]" />
          Add photo
        </button>
      </div>
    </div>
  );
}

export function ProfileEdit() {
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

      <AboutSection about={data.about} />
      <ExperiencesSection experiences={data.experiences} />
      <DiplomasSection diplomas={data.diplomas} />
      <SkillsSection skills={data.skills} />
      <LanguagesSection languages={data.languages} />
      <LinksSection links={data.links} />
    </div>
  );
}
