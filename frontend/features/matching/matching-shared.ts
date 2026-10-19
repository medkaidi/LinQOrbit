import type { MatchingSectionKey } from "@/types/matching";

/** Libellés des sections du matching (D58) — partagés par le panneau des scores et la revue candidat (T-63). */
export const MATCHING_SECTION_LABELS: Record<MatchingSectionKey, string> = {
  required_skills: "Required skills",
  preferred_skills: "Preferred skills",
  languages: "Languages",
  experience: "Experience",
  education: "Education",
};
