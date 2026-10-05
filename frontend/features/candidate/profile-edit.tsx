"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AboutSection } from "@/features/candidate/about-section";
import { CvImportError, CvImportPreview, CvUploadButton } from "@/features/candidate/cv-import";
import { planCvImport } from "@/features/candidate/cv-parsing";
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
import {
  useCandidateProfile,
  useParseCv,
  useReferenceDegrees,
  useReferenceLanguages,
  useReferenceSkills,
  useReferenceStudyFields,
} from "@/hooks/use-candidate-profile";
import type { ParsedCv } from "@/types/candidate";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { Icon } from "@/components/ui/icon";

function Header({ uploadAction }: { uploadAction: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-slate-border">
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
        {uploadAction}
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
  const parseCv = useParseCv();
  const referenceSkills = useReferenceSkills();
  const referenceLanguages = useReferenceLanguages();
  const referenceDegrees = useReferenceDegrees();
  const referenceStudyFields = useReferenceStudyFields();

  const [preview, setPreview] = useState<ParsedCv | null>(null);
  const [cvImport, setCvImport] = useState<ParsedCv | null>(null);

  const refsReady =
    !referenceSkills.isLoading &&
    !referenceLanguages.isLoading &&
    !referenceDegrees.isLoading &&
    !referenceStudyFields.isLoading;

  const plan = useMemo(() => {
    if (!preview || !refsReady) {
      return null;
    }
    return planCvImport(preview, {
      skills: referenceSkills.data ?? [],
      languages: referenceLanguages.data ?? [],
      degrees: referenceDegrees.data ?? [],
      studyFields: referenceStudyFields.data ?? [],
    });
  }, [preview, refsReady, referenceSkills.data, referenceLanguages.data, referenceDegrees.data, referenceStudyFields.data]);

  const onSelectFile = (file: File) => {
    parseCv.mutate(file, {
      onSuccess: (parsed) => setPreview(parsed),
    });
  };

  const onApply = () => {
    if (!preview) {
      return;
    }
    setCvImport(preview);
    setPreview(null);
    parseCv.reset();
  };

  const onDiscard = () => {
    setPreview(null);
    parseCv.reset();
  };

  const uploadAction = <CvUploadButton isParsing={parseCv.isPending} onSelect={onSelectFile} />;

  if (isError && !data) {
    return (
      <div className="w-full flex flex-col gap-6">
        <Header uploadAction={uploadAction} />
        <ProfileError onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex flex-col gap-6">
        <Header uploadAction={uploadAction} />
        {isLoading ? <ProfileSkeleton /> : null}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <Header uploadAction={uploadAction} />

      {parseCv.isError ? <CvImportError message={getApiErrorMessage(parseCv.error)} /> : null}

      {preview && plan ? (
        <CvImportPreview
          cv={preview}
          plan={plan}
          applyDisabled={!refsReady}
          applyHint={refsReady ? null : "Loading reference lists…"}
          onApply={onApply}
          onDiscard={onDiscard}
        />
      ) : null}

      <CompletenessCard profile={data} />

      <AboutSection about={data.about} cvImport={cvImport} />
      <ExperiencesSection experiences={data.experiences} cvImport={cvImport} />
      <DiplomasSection diplomas={data.diplomas} cvImport={cvImport} />
      <SkillsSection skills={data.skills} cvImport={cvImport} />
      <LanguagesSection languages={data.languages} cvImport={cvImport} />
      <LinksSection links={data.links} cvImport={cvImport} />
    </div>
  );
}
