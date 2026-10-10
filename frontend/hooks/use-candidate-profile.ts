"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getProfile,
  getReferenceDegrees,
  getReferenceLanguages,
  getReferenceSkills,
  getReferenceStudyFields,
  parseCv,
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

export const PROFILE_KEY = ["candidate", "profile"] as const;
const REFERENCE_STALE_TIME = 5 * 60_000;

export function useCandidateProfile() {
  return useQuery({
    queryKey: PROFILE_KEY,
    queryFn: getProfile,
    staleTime: 30_000,
  });
}

function useInvalidateProfile() {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: PROFILE_KEY });
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
    queryKey: ["candidate", "reference", "skills"],
    queryFn: getReferenceSkills,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReferenceLanguages() {
  return useQuery({
    queryKey: ["candidate", "reference", "languages"],
    queryFn: getReferenceLanguages,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReferenceDegrees() {
  return useQuery({
    queryKey: ["candidate", "reference", "degrees"],
    queryFn: getReferenceDegrees,
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useReferenceStudyFields() {
  return useQuery({
    queryKey: ["candidate", "reference", "study-fields"],
    queryFn: getReferenceStudyFields,
    staleTime: REFERENCE_STALE_TIME,
  });
}
