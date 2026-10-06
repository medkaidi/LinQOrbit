import { countryOptions } from "@/config/countries";
import type {
  LabelReference,
  LanguageReference,
  ParsedCv,
  SkillReference,
} from "@/types/candidate";
import type {
  AboutValues,
  DiplomaValues,
  ExperienceValues,
  LanguageValues,
  LinkValues,
  SkillValues,
} from "@/lib/validations/candidate.schemas";
import { CEFR_LEVELS, LINK_TYPES } from "@/lib/validations/candidate.schemas";

export type CvImportRefs = {
  skills: SkillReference[];
  languages: LanguageReference[];
  degrees: LabelReference[];
  studyFields: LabelReference[];
};

/** Une ligne du CV qui ne peut pas être importée, avec le motif affiché. */
export type CvImportSkip = {
  label: string;
  reason: string;
};

/** Motif d'une compétence absente du catalogue : candidate à un mapping manuel. */
export const SKILL_NOT_IN_LIST = "Not in your skill list";

export type CvImportPlan = {
  about: { title: string | null; summary: string | null };
  experiences: ExperienceValues[];
  diplomas: DiplomaValues[];
  skills: SkillValues[];
  languages: LanguageValues[];
  links: LinkValues[];
  skipped: CvImportSkip[];
};

const MONTH = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Le CV donne "YYYY-MM" ; le formulaire attend une date ISO complète. */
const toIsoDate = (month: string | null): string => {
  if (!month) {
    return "";
  }
  if (ISO_DATE.test(month)) {
    return month;
  }
  return MONTH.test(month) ? `${month}-01` : "";
};

const countryByLabel = new Map(countryOptions.map((option) => [option.label.toLowerCase(), option.value]));
const countryCodes = new Set(countryOptions.map((option) => option.value));

/** Le CV écrit un nom de pays ("France") ; le formulaire stocke l'ISO alpha-2. */
const resolveCountry = (name: string | null): string => {
  if (!name) {
    return "";
  }
  const trimmed = name.trim();
  const asCode = trimmed.toUpperCase();
  if (countryCodes.has(asCode)) {
    return asCode;
  }
  return countryByLabel.get(trimmed.toLowerCase()) ?? "";
};

const LINK_HOST_TYPES: [string, (typeof LINK_TYPES)[number]][] = [
  ["github.com", "github"],
  ["gitlab.com", "gitlab"],
  ["stackoverflow.com", "stack_overflow"],
  ["stackexchange.com", "stack_overflow"],
  ["linkedin.com", "linkedin"],
  ["x.com", "x"],
  ["twitter.com", "x"],
  ["youtube.com", "youtube"],
  ["dribbble.com", "dribbble"],
  ["behance.net", "behance"],
];

const inferLinkType = (url: string): LinkValues["linkType"] => {
  const lower = url.toLowerCase();
  const match = LINK_HOST_TYPES.find(([domain]) => lower.includes(domain));
  return match ? match[1] : "website";
};

const findByLowerName = (items: { id: string; name: string }[], target: string | null | undefined): string => {
  if (!target) {
    return "";
  }
  const wanted = target.trim().toLowerCase();
  return items.find((item) => item.name.trim().toLowerCase() === wanted)?.id ?? "";
};

const findByLowerLabel = (items: { id: string; label: string }[], target: string | null | undefined): string => {
  if (!target) {
    return "";
  }
  const wanted = target.trim().toLowerCase();
  return items.find((item) => item.label.trim().toLowerCase() === wanted)?.id ?? "";
};

const isCefrLevel = (level: string | null): level is (typeof CEFR_LEVELS)[number] =>
  level !== null && (CEFR_LEVELS as readonly string[]).includes(level);

/**
 * Convertit un CV analysé en valeurs de formulaire, en résolvant les libellés
 * de l'IA contre les listes de référence (compétences, langues, diplômes,
 * domaines d'étude, pays). Ce qui ne peut pas être résolu est écarté et
 * listé dans `skipped` — jamais de valeur inventée. Une compétence ou une
 * langue résolue mais sans niveau dans le CV est importée au niveau le plus
 * bas (1 / A1) : l'utilisateur l'ajuste ensuite.
 */
export function planCvImport(cv: ParsedCv, refs: Partial<CvImportRefs> = {}): CvImportPlan {
  const skills = refs.skills ?? [];
  const languages = refs.languages ?? [];
  const degrees = refs.degrees ?? [];
  const studyFields = refs.studyFields ?? [];
  const skipped: CvImportSkip[] = [];

  const planSkills: SkillValues[] = [];
  const seenSkillIds = new Set<string>();
  for (const skill of cv.skills) {
    const skillId = findByLowerName(skills, skill.name);
    if (!skillId) {
      skipped.push({ label: skill.name, reason: SKILL_NOT_IN_LIST });
      continue;
    }
    if (seenSkillIds.has(skillId)) {
      continue;
    }
    seenSkillIds.add(skillId);
    planSkills.push({
      skillId,
      level: skill.level ?? 1,
      yearsExperience: skill.yearsExperience == null ? "" : String(skill.yearsExperience),
    });
  }

  const planLanguages: LanguageValues[] = [];
  const seenLanguageIds = new Set<string>();
  for (const language of cv.languages) {
    const languageId = findByLowerName(languages, language.name);
    if (!languageId) {
      skipped.push({ label: language.name, reason: "Not in your language list" });
      continue;
    }
    if (seenLanguageIds.has(languageId)) {
      continue;
    }
    seenLanguageIds.add(languageId);
    planLanguages.push({ languageId, level: isCefrLevel(language.level) ? language.level : "A1" });
  }

  const planExperiences: ExperienceValues[] = [];
  for (const experience of cv.experiences) {
    const startDate = toIsoDate(experience.startDate);
    if (!experience.positionTitle?.trim() || !experience.companyName?.trim() || !startDate) {
      skipped.push({
        label: experience.positionTitle?.trim() || experience.companyName?.trim() || "Experience",
        reason: "Missing title, company or start date",
      });
      continue;
    }
    planExperiences.push({
      positionTitle: experience.positionTitle.trim(),
      companyName: experience.companyName.trim(),
      companyCountry: resolveCountry(experience.companyCountry),
      startDate,
      endDate: toIsoDate(experience.endDate),
      description: experience.description?.trim() ?? "",
    });
  }

  const planDiplomas: DiplomaValues[] = [];
  for (const diploma of cv.diplomas) {
    const startDate = toIsoDate(diploma.startDate);
    if (!diploma.title?.trim() || !diploma.institution?.trim() || !startDate) {
      skipped.push({
        label: diploma.title?.trim() || diploma.institution?.trim() || "Diploma",
        reason: "Missing title, institution or start date",
      });
      continue;
    }
    planDiplomas.push({
      title: diploma.title.trim(),
      institution: diploma.institution.trim(),
      institutionCountry: resolveCountry(diploma.institutionCountry),
      degreeId: findByLowerLabel(degrees, diploma.degreeLabel),
      studyFieldId: findByLowerLabel(studyFields, diploma.studyFieldLabel),
      startDate,
      endDate: toIsoDate(diploma.endDate),
    });
  }

  const planLinks: LinkValues[] = [];
  const seenUrls = new Set<string>();
  for (const link of cv.links) {
    const url = link.url.trim();
    if (!/^https?:\/\/\S+$/.test(url)) {
      skipped.push({ label: link.label?.trim() || url, reason: "Invalid URL" });
      continue;
    }
    if (seenUrls.has(url)) {
      continue;
    }
    seenUrls.add(url);
    const label = link.label?.trim() || url.replace(/^https?:\/\//, "").split("/")[0];
    planLinks.push({
      label,
      url,
      linkType: inferLinkType(url),
      issuer: "",
      issuedAt: "",
    });
  }

  return {
    about: { title: cv.title, summary: cv.summary },
    experiences: planExperiences,
    diplomas: planDiplomas,
    skills: planSkills,
    languages: planLanguages,
    links: planLinks,
    skipped,
  };
}

/**
 * Mapping manuel des compétences hors catalogue : le nom du CV devient le nom
 * du catalogue choisi, pour que `planCvImport` le résolve par son libellé
 * canonique. Aucun mapping -> le CV est retourné tel quel.
 */
export function applySkillMappings(
  cv: ParsedCv,
  mappings: Record<string, string>,
  skills: SkillReference[],
): ParsedCv {
  const active = Object.entries(mappings).filter(([, skillId]) => skillId !== "");
  if (active.length === 0) {
    return cv;
  }
  const nameById = new Map(skills.map((skill) => [skill.id, skill.name]));
  const rename = new Map(
    active
      .map(([label, skillId]) => [label, nameById.get(skillId)] as const)
      .filter((entry): entry is [string, string] => entry[1] !== undefined),
  );
  if (rename.size === 0) {
    return cv;
  }
  return {
    ...cv,
    skills: cv.skills.map((skill) => {
      const target = rename.get(skill.name);
      return target && target !== skill.name ? { ...skill, name: target } : skill;
    }),
  };
}

/**
 * Application au formulaire : la valeur du CV remplace celle du profil,
 * mais un champ absent du CV conserve sa valeur actuelle.
 */
export function applyCvToAbout(defaults: AboutValues, plan: CvImportPlan): AboutValues {
  return {
    ...defaults,
    title: plan.about.title?.trim() || defaults.title,
    bio: plan.about.summary?.trim() || defaults.bio,
  };
}

/** Une liste du CV vide laisse la liste actuelle intacte. */
export const applyCvToExperiences = (defaults: ExperienceValues[], plan: CvImportPlan): ExperienceValues[] =>
  plan.experiences.length > 0 ? plan.experiences : defaults;

export const applyCvToDiplomas = (defaults: DiplomaValues[], plan: CvImportPlan): DiplomaValues[] =>
  plan.diplomas.length > 0 ? plan.diplomas : defaults;

export const applyCvToSkills = (defaults: SkillValues[], plan: CvImportPlan): SkillValues[] =>
  plan.skills.length > 0 ? plan.skills : defaults;

export const applyCvToLanguages = (defaults: LanguageValues[], plan: CvImportPlan): LanguageValues[] =>
  plan.languages.length > 0 ? plan.languages : defaults;

export const applyCvToLinks = (defaults: LinkValues[], plan: CvImportPlan): LinkValues[] =>
  plan.links.length > 0 ? plan.links : defaults;
