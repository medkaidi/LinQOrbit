"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getProfile,
  getVisibilityConsent,
  getReferenceDegrees,
  getReferenceLanguages,
  getReferenceSkills,
  getReferenceStudyFields,
  parseCv,
  setVisibilityConsent,
  suggestSkills,
  updateAbout,
  updateDiplomas,
  updateExperiences,
  updateLanguages,
  updateLinks,
  updateProjects,
  updateSkills,
  validateProfile,
} from "@/lib/api/candidate.api";
import type {
  AboutValues,
  DiplomasValues,
  ExperiencesValues,
  LanguagesValues,
  LinksValues,
  ProjectsValues,
  SkillsValues,
} from "@/lib/validations/candidate.schemas";
import { queryKeys } from "@/hooks/query-keys";

const REFERENCE_STALE_TIME = 5 * 60_000;

export function useCandidateProfile() {
  return useQuery({
    queryKey: queryKeys.candidate.profile,
    queryFn: getProfile,
    staleTime: 30_000,
  });
}

/** Consentement à la visibilité recruteur (T-102, D86) : opt-in, absent par défaut. */
export function useVisibilityConsent() {
  return useQuery({
    queryKey: queryKeys.candidate.visibility,
    queryFn: getVisibilityConsent,
  });
}

/**
 * Accord / retrait du consentement. Le serveur répond avec l'état enregistré :
 * il remplace le cache sans relecture. Ce n'est pas une modification du profil
 * (aucune invalidation du profil, donc aucun faux « changements non validés »).
 */
export function useSetVisibilityConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (consent: boolean) => setVisibilityConsent(consent),
    onSuccess: (state) => queryClient.setQueryData(queryKeys.candidate.visibility, state),
  });
}

function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.candidate.profile });
}

export function useUpdateAbout() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: AboutValues) => updateAbout(values),
    onSuccess: invalidateProfile,
  });
}

export function useUpdateExperiences() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: ExperiencesValues) => updateExperiences(values),
    onSuccess: invalidateProfile,
  });
}

export function useUpdateProjects() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: ProjectsValues) => updateProjects(values),
    onSuccess: invalidateProfile,
  });
}

export function useUpdateDiplomas() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: DiplomasValues) => updateDiplomas(values),
    onSuccess: invalidateProfile,
  });
}

export function useUpdateSkills() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: SkillsValues) => updateSkills(values),
    onSuccess: invalidateProfile,
  });
}

export function useUpdateLanguages() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: LanguagesValues) => updateLanguages(values),
    onSuccess: invalidateProfile,
  });
}

export function useUpdateLinks() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: (values: LinksValues) => updateLinks(values),
    onSuccess: invalidateProfile,
  });
}

/** Validation explicite du profil : lance le job de normalisation puis rafraîchit le profil. */
export function useValidateProfile() {
  const invalidateProfile = useInvalidateProfile();
  return useMutation({
    mutationFn: validateProfile,
    onSuccess: invalidateProfile,
  });
}

/** Analyse d'un CV : upload vers le backend puis extraction structurée par l'IA. */
export function useParseCv() {
  return useMutation({
    mutationFn: (file: File) => parseCv(file),
  });
}

/** Compétences hors catalogue envoyées en revue manuelle (aucune invalidation : le profil ne change pas). */
export function useSuggestSkills() {
  return useMutation({
    mutationFn: (names: string[]) => suggestSkills(names),
  });
}

export function useReferenceSkills() {
  return useQuery({
    queryKey: queryKeys.candidate.referenceSkills,
    queryFn: getReferenceSkills,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReferenceLanguages() {
  return useQuery({
    queryKey: queryKeys.candidate.referenceLanguages,
    queryFn: getReferenceLanguages,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReferenceDegrees() {
  return useQuery({
    queryKey: queryKeys.candidate.referenceDegrees,
    queryFn: getReferenceDegrees,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReferenceStudyFields() {
  return useQuery({
    queryKey: queryKeys.candidate.referenceStudyFields,
    queryFn: getReferenceStudyFields,
    staleTime: REFERENCE_STALE_TIME,
  });
}
