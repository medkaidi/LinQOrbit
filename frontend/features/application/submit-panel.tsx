"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { Alert } from "@/components/ui/alert";
import { Button, CtaButton } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Select } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import {
  MUTED_TEXT_CLASS,
  SECTION_CARD_CLASS,
  SECTION_HEADER_CLASS,
  SECTION_TITLE_CLASS,
} from "@/components/ui/section";
import { useCandidateCvs } from "@/hooks/use-candidate-cvs";
import { useDiscardApplication, useSubmitApplication } from "@/hooks/use-applications";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import type { ApplicationContext } from "@/types/application";

/**
 * Transmission du brouillon (D59) : CV à épingler (celui du brouillon, sinon
 * le courant, pré-sélectionné), envoi — possible à tout moment une fois les
 * obligatoires répondues, matching ou pas — et abandon du brouillon
 * (`ConfirmDialog` danger). Le détail serveur est affiché tel quel.
 */
export function SubmitPanel({
  context,
  applicationId,
  ensureDraft,
  assessmentDirty = false,
}: {
  context: ApplicationContext;
  /** Brouillon du couple ; null pour une offre sans question tant qu'aucun geste ne l'a créé. */
  applicationId: string | null;
  /** Crée le brouillon au besoin et renvoie son id. */
  ensureDraft: () => Promise<string>;
  /** Revue candidat modifiée mais non sauvegardée : la transmission reste bloquée. */
  assessmentDirty?: boolean;
}) {
  const router = useRouter();
  const publicId = context.job.publicId;
  const cvs = useCandidateCvs();
  const submit = useSubmitApplication(publicId);
  const discard = useDiscardApplication(publicId);
  const [cvId, setCvId] = useState("");
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  // Une opération à la fois : pas d'abandon pendant l'envoi, ni l'inverse.
  const busy = submit.isPending || discard.isPending;

  const hasCvs = (cvs.data?.length ?? 0) > 0;
  const cvOptions = (cvs.data ?? []).map((cv) => ({
    value: cv.id,
    label: cv.current ? `${cv.originalName} (current)` : cv.originalName,
  }));
  // CV effectif : choix utilisateur, sinon celui du brouillon, sinon le courant, sinon le premier.
  const effectiveCvId =
    cvId !== ""
      ? cvId
      : (context.existingApplication?.cvAttachmentId ??
        context.currentCvAttachmentId ??
        cvs.data?.find((cv) => cv.current)?.id ??
        cvs.data?.[0]?.id ??
        "");

  const handleSubmit = () =>
    submit.mutate(
      {
        applicationId,
        ensureDraft,
        body: effectiveCvId !== "" ? { cvAttachmentId: effectiveCvId } : {},
      },
      { onSuccess: () => router.push("/applications") },
    );

  return (
    <section className={SECTION_CARD_CLASS} aria-label="Submit your application">
      <header className={SECTION_HEADER_CLASS}>
        <h2 className={SECTION_TITLE_CLASS}>Submit</h2>
      </header>
      <div className="px-6 pt-5 pb-6 flex flex-col items-start gap-4">
        <p className={MUTED_TEXT_CLASS}>
          Running the match is optional: you can send your application now. Once sent, your answers
          can no longer be changed.
        </p>

        {cvs.isLoading ? (
          <span className="flex items-center gap-2 text-body-sm font-body-sm text-text-secondary">
            <Spinner />
            Loading your CVs…
          </span>
        ) : null}
        {cvs.isError ? (
          <Alert variant="error" title="Could not load your CVs">
            Reload the page to try again.
          </Alert>
        ) : null}
        {!cvs.isLoading && !cvs.isError && !hasCvs ? (
          <Alert variant="error" title="A CV is required">
            Add a CV to your profile before sending your application —{" "}
            <Link href="/profile/edit" className="underline hover:text-orange-deep">
              go to your profile
            </Link>
            .
          </Alert>
        ) : null}
        {hasCvs ? (
          <div className="w-full max-w-md">
            <Select
              label="CV to attach"
              options={cvOptions}
              placeholder="Select a CV"
              value={effectiveCvId}
              onValueChange={setCvId}
            />
          </div>
        ) : null}

        {assessmentDirty ? (
          <div id="assessment-dirty-message">
            <Alert variant="info" title="Unsaved assessment changes">
              Save or discard your changes in “Your assessment” before submitting.
            </Alert>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <CtaButton
            type="button"
            icon="send"
            busy={submit.isPending}
            disabled={cvs.isLoading || !hasCvs || discard.isPending || assessmentDirty}
            aria-describedby={assessmentDirty ? "assessment-dirty-message" : undefined}
            onClick={handleSubmit}
          >
            Submit application
          </CtaButton>
          {applicationId ? (
            <Button variant="outline-sm" type="button" disabled={busy} onClick={() => setConfirmDiscard(true)}>
              Discard application
            </Button>
          ) : null}
        </div>

        {submit.error ? (
          <Alert variant="error" title="Submission failed">
            {getApiErrorMessage(submit.error)}
          </Alert>
        ) : null}
        {discard.error ? (
          <Alert variant="error" title="Could not discard your application">
            {getApiErrorMessage(discard.error)}
          </Alert>
        ) : null}
      </div>

      {confirmDiscard && applicationId ? (
        <ConfirmDialog
          title="Discard this application?"
          message="Your answers to the recruiter's questions will be deleted. You can start a new application for this offer later."
          confirmLabel="Discard"
          tone="danger"
          icon="delete"
          busy={discard.isPending}
          onCancel={() => setConfirmDiscard(false)}
          onConfirm={() =>
            discard.mutate(applicationId, { onSettled: () => setConfirmDiscard(false) })
          }
        />
      ) : null}
    </section>
  );
}
