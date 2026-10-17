"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  deleteCv,
  downloadCv,
  listCvs,
  setCurrentCv,
  uploadCv,
} from "@/lib/api/candidate.api";
import { queryKeys } from "@/hooks/query-keys";

const CVS_STALE_TIME = 30_000;

/** CV déposés du candidat (liste, dépôt, bascule du courant, suppression, téléchargement). */
export function useCandidateCvs() {
  return useQuery({
    queryKey: queryKeys.candidate.cvs,
    queryFn: listCvs,
    staleTime: CVS_STALE_TIME,
  });
}

function useInvalidateCvs() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.candidate.cvs });
}

/** Dépôt d'un CV : le nouveau fichier devient le CV courant côté backend. */
export function useUploadCv() {
  const invalidate = useInvalidateCvs();
  return useMutation({
    mutationFn: (file: File) => uploadCv(file),
    onSuccess: invalidate,
  });
}

export function useSetCurrentCv() {
  const invalidate = useInvalidateCvs();
  return useMutation({
    mutationFn: (attachmentId: string) => setCurrentCv(attachmentId),
    onSuccess: invalidate,
  });
}

export function useDeleteCv() {
  const invalidate = useInvalidateCvs();
  return useMutation({
    mutationFn: (attachmentId: string) => deleteCv(attachmentId),
    onSuccess: invalidate,
  });
}

/** Téléchargement : aucune invalidation, le serveur ne change pas. */
export function useDownloadCv() {
  return useMutation({
    mutationFn: ({ attachmentId, fileName }: { attachmentId: string; fileName: string }) =>
      downloadCv(attachmentId, fileName),
  });
}
