"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { AboutSection } from "@/features/candidate/about-section";
import { CvImportDialog, type CvImportDialogStatus } from "@/features/candidate/cv-import-dialog";
import { CvUploadChoiceDialog } from "@/features/candidate/cv-upload-choice-dialog";
import { planCvImport } from "@/features/candidate/cv-parsing";
import { DiplomasSection } from "@/features/candidate/diplomas-section";
import { ExperiencesSection } from "@/features/candidate/experiences-section";
import { LanguagesSection } from "@/features/candidate/languages-section";
import { LinksSection } from "@/features/candidate/links-section";
import { ProjectsSection } from "@/features/candidate/projects-section";
import { SkillsSection } from "@/features/candidate/skills-section";
import { ValidateProfileBanner } from "@/features/candidate/validate-profile-banner";
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
import { useUploadCv } from "@/hooks/use-candidate-cvs";
import type { ParsedCv } from "@/types/candidate";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { UploadButton } from "@/components/ui/upload-button";

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
        <Button variant="soft" type="button" disabled aria-disabled="true" title="Coming soon">
          <Icon name="add_a_photo" className="text-[16px]" />
          Add photo
        </Button>
      </div>
    </div>
  );
}

export function ProfileEdit() {
  const { data, isLoading, isError, refetch } = useCandidateProfile();
  const parseCv = useParseCv();
  const uploadCv = useUploadCv();
  const referenceSkills = useReferenceSkills();
  const referenceLanguages = useReferenceLanguages();
  const referenceDegrees = useReferenceDegrees();
  const referenceStudyFields = useReferenceStudyFields();

  const [preview, setPreview] = useState<ParsedCv | null>(null);
  const [cvImport, setCvImport] = useState<ParsedCv | null>(null);
  /** PDF sélectionné, en attente du choix « déposer ou analyser » (D73). */
  const [pendingCv, setPendingCv] = useState<File | null>(null);
  /** Dernier PDF déposé sans analyse, pour confirmer sur place. */
  const [savedCvName, setSavedCvName] = useState<string | null>(null);

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
    parseCv.reset();
    uploadCv.reset();
    setSavedCvName(null);
    setPendingCv(file);
  };

  const onSaveOnly = () => {
    if (!pendingCv) {
      return;
    }
    uploadCv.mutate(pendingCv, {
      onSuccess: (attachment) => {
        setSavedCvName(attachment.originalName);
        setPendingCv(null);
      },
    });
  };

  const onAnalyze = () => {
    if (!pendingCv) {
      return;
    }
    const file = pendingCv;
    setPendingCv(null);
    // Le PDF devient le CV courant même si l'analyse échoue (D73).
    uploadCv.mutate(file);
    parseCv.mutate(file, {
      onSuccess: (parsed) => setPreview(parsed),
    });
  };

  const onCancelChoice = () => {
    uploadCv.reset();
    setPendingCv(null);
  };

  const onApply = (imported: ParsedCv) => {
    setCvImport(imported);
    setPreview(null);
    parseCv.reset();
  };

  const onDiscard = () => {
    setPreview(null);
    parseCv.reset();
  };

  // La fenêtre s'ouvre dès l'analyse, reste bloquée jusqu'au résultat.
  const dialogStatus: CvImportDialogStatus | null = parseCv.isPending
    ? "parsing"
    : parseCv.isError
      ? "error"
      : preview
        ? plan
          ? "ready"
          : "parsing"
        : null;

  const uploadAction = (
    <UploadButton
      label="Upload CV"
      accept=".pdf,application/pdf"
      onSelect={onSelectFile}
    />
  );

  const importDialog = dialogStatus ? (
    <CvImportDialog
      status={dialogStatus}
      statusLabel={
        parseCv.isPending || !preview ? "Parsing in progress…" : "Loading reference lists…"
      }
      cv={preview}
      plan={plan}
      skillOptions={referenceSkills.data ?? []}
      refsReady={refsReady}
      errorMessage={parseCv.isError ? getApiErrorMessage(parseCv.error) : null}
      onApply={onApply}
      onClose={onDiscard}
    />
  ) : null;

  const choiceDialog = pendingCv ? (
    <CvUploadChoiceDialog
      fileName={pendingCv.name}
      busy={uploadCv.isPending}
      error={uploadCv.isError ? getApiErrorMessage(uploadCv.error) : null}
      onSaveOnly={onSaveOnly}
      onAnalyze={onAnalyze}
      onCancel={onCancelChoice}
    />
  ) : null;

  const savedCvAlert = savedCvName ? (
    <Alert
      variant="success"
      title="CV saved"
      action={
        <Button variant="outline-sm" type="button" onClick={() => setSavedCvName(null)}>
          Dismiss
        </Button>
      }
    >
      {savedCvName} is now your current CV.{" "}
      <Link href="/profile#cv" className="font-semibold text-orange-deep hover:underline">
        View your CVs
      </Link>
    </Alert>
  ) : null;

  // Un échec du dépôt pendant l'analyse ne bloque pas l'import du profil.
  const saveErrorAlert =
    uploadCv.isError && !pendingCv ? (
      <Alert variant="error" title="This CV could not be saved">
        {getApiErrorMessage(uploadCv.error)} Your profile import can still continue.
      </Alert>
    ) : null;

  const uploadOverlays = (
    <>
      {choiceDialog}
      {savedCvAlert}
      {saveErrorAlert}
    </>
  );

  if (isError && !data) {
    return (
      <div className="w-full flex flex-col gap-6">
        <Header uploadAction={uploadAction} />
        {importDialog}
        {uploadOverlays}
        <ProfileError onRetry={() => void refetch()} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="w-full flex flex-col gap-6">
        <Header uploadAction={uploadAction} />
        {importDialog}
        {uploadOverlays}
        {isLoading ? <ProfileSkeleton /> : null}
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-6">
      <Header uploadAction={uploadAction} />

      {importDialog}
      {uploadOverlays}

      <ValidateProfileBanner profile={data} />

      <CompletenessCard profile={data} />

      <AboutSection about={data.about} cvImport={cvImport} />
      <ExperiencesSection experiences={data.experiences} cvImport={cvImport} />
      <ProjectsSection projects={data.projects} />
      <DiplomasSection diplomas={data.diplomas} cvImport={cvImport} />
      <SkillsSection skills={data.skills} cvImport={cvImport} />
      <LanguagesSection languages={data.languages} cvImport={cvImport} />
      <LinksSection links={data.links} cvImport={cvImport} />
    </div>
  );
}
