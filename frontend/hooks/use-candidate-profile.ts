"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  getProfile,
  getReferenceDegrees,
  getReferenceLanguages,
  getReferenceSkills,
  getReferenceStudyFields,
  parseCv,
  updateAbout,
  updateDiplomas,
  updateExperiences,
  updateLanguages,
  updateLinks,
  updateSkills,
} from "@/lib/api/candidate.api";
import type {
  AboutValues,
  DiplomasValues,
  ExperiencesValues,
  LanguagesValues,
  LinksValues,
  SkillsValues,
} from "@/lib/validations/candidate.schemas";

const PROFILE_KEY = ["candidate", "profile"] as const;
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

/** Analyse d'un CV : upload vers le backend puis extraction structurée par l'IA. */
export function useParseCv() {
  return useMutation({
    mutationFn: (file: File) => parseCv(file),
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
