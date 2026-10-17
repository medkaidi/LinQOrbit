"use client";

import { useState } from "react";

import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Icon } from "@/components/ui/icon";
import { UploadButton } from "@/components/ui/upload-button";
import {
  ITEM_CLASSES,
  RemoveButton,
  SECTION_ICONS,
  ViewSection,
} from "@/features/candidate/profile-shared";
import {
  useCandidateCvs,
  useDeleteCv,
  useDownloadCv,
  useSetCurrentCv,
  useUploadCv,
} from "@/hooks/use-candidate-cvs";
import { getApiErrorMessage } from "@/lib/utils/api-error";
import { cn } from "@/lib/utils/cn";
import { formatFileSize, formatShortDate, plural } from "@/lib/utils/format";
import type { CvAttachment } from "@/types/candidate";

/**
 * CV du candidat sur /profile : les dépôts sont conservés (remplacer un CV =
 * en déposer un nouveau, qui devient courant), le courant est badgé, chaque
 * fichier se télécharge ou se supprime (confirmation). La normalisation du
 * profil et l'import de CV (brief IA, /profile/edit) restent des flux distincts.
 */
export function CvSection() {
  const { data, isError, refetch } = useCandidateCvs();
  const upload = useUploadCv();
  const setCurrent = useSetCurrentCv();
  const remove = useDeleteCv();
  const download = useDownloadCv();
  const [pendingDelete, setPendingDelete] = useState<CvAttachment | null>(null);

  const attachments = data ?? [];
  const actionError = upload.error ?? setCurrent.error ?? remove.error ?? download.error;

  return (
    <ViewSection
      id="cv"
      title="CV"
      icon={SECTION_ICONS.cv}
      count={attachments.length > 0 ? plural(attachments.length, "file") : undefined}
    >
      {isError && !data ? (
        <div className="flex flex-col items-start gap-3">
          <p className="text-body-sm font-body-sm text-text-secondary">
            Your CV files could not be loaded.
          </p>
          <Button variant="outline-sm" type="button" onClick={() => void refetch()}>
            Retry
          </Button>
        </div>
      ) : !data ? (
        <p className="text-body-sm font-body-sm text-text-tertiary">Loading CV files…</p>
      ) : attachments.length === 0 ? (
        <div className="flex flex-col items-start gap-4">
          <p className="text-body-sm font-body-sm text-text-secondary max-w-3xl">
            No CV uploaded yet. Your current CV is the one attached to your applications.
          </p>
          <UploadButton
            label="Upload CV"
            tone="secondary"
            accept=".pdf,application/pdf"
            busy={upload.isPending}
            onSelect={(file) => upload.mutate(file)}
          />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-3">
            {attachments.map((attachment) => (
              <li
                key={attachment.id}
                className={cn(ITEM_CLASSES, "flex flex-wrap items-center gap-x-4 gap-y-3")}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <Icon
                    name="description"
                    className="text-[18px] text-text-tertiary shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-label-md text-label-md text-text-primary">
                        {attachment.originalName}
                      </p>
                      {attachment.current ? <Badge tone="success">Current</Badge> : null}
                    </div>
                    <p className="mt-0.5 text-body-sm font-body-sm text-text-secondary">
                      {formatFileSize(attachment.sizeBytes)} · Added{" "}
                      {formatShortDate(attachment.createdAt)}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!attachment.current ? (
                    <Button
                      variant="outline-sm"
                      type="button"
                      busy={setCurrent.isPending && setCurrent.variables === attachment.id}
                      onClick={() => setCurrent.mutate(attachment.id)}
                    >
                      Set as current
                    </Button>
                  ) : null}
                  <Button
                    variant="outline-sm"
                    type="button"
                    busy={download.isPending && download.variables?.attachmentId === attachment.id}
                    onClick={() =>
                      download.mutate({
                        attachmentId: attachment.id,
                        fileName: attachment.originalName,
                      })
                    }
                  >
                    Download
                  </Button>
                  <RemoveButton onClick={() => setPendingDelete(attachment)} />
                </div>
              </li>
            ))}
          </ul>
          <div className="flex">
            <UploadButton
              label="Upload CV"
              tone="secondary"
              accept=".pdf,application/pdf"
              busy={upload.isPending}
              onSelect={(file) => upload.mutate(file)}
            />
          </div>
        </div>
      )}

      {actionError ? (
        <div className="mt-4">
          <Alert variant="error" title="Something went wrong">
            {getApiErrorMessage(actionError)}
          </Alert>
        </div>
      ) : null}

      {pendingDelete ? (
        <ConfirmDialog
          title="Delete this CV?"
          message={`"${pendingDelete.originalName}" will be permanently deleted. This cannot be undone.`}
          confirmLabel="Delete"
          tone="danger"
          icon="delete"
          busy={remove.isPending}
          onConfirm={() =>
            remove.mutate(pendingDelete.id, {
              onSettled: () => setPendingDelete(null),
            })
          }
          onCancel={() => setPendingDelete(null)}
        />
      ) : null}
    </ViewSection>
  );
}
