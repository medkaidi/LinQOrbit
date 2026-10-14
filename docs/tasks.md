# LinQOrbit — Tâches en cours

> Tableau de tâches vivant, tous domaines confondus (backend / frontend /
> ai-service). Règle : une tâche livrée passe en « Livré » le jour même ;
> les dettes liées sont bouclées dans `TECH_DEBT.md` (date + commit).
> Les décisions produit vivent dans `SPEC_PRODUIT.md` (§14).
>
> Ce fichier remplace l'ancien `plan-admin-console.md` (plan D33 figé —
> conservé dans l'historique git).

## En cours / à faire

> **Chantier « fiche conforme » validé le 2026-10-14** (utilisateur) :
> extraction maximale des deux côtés, poids 1-5 partout, langues
> déclarées + inférées, certifications aussi sur l'offre, minYears
> déductible même sur skill déclaré, versionnement par fiche confirmé.
> Livré le 2026-10-14 (T-13→T-19, phases P1→P7) — voir D35/D36 (SPEC §14.7)
> et la table Livré ci-dessous.

| ID | Zone | Tâche | Dette | État |
|---|---|---|---|---|
| T-13 | ai-service | **P1 — Schéma offre v1 → v2** (`schemas/job_offer.py`) : input restauré (`JobOfferSkillInput.weight`, `required_exp_year`, `degree_labels`, `study_field_labels` + null-coercion) ; output : `SCHEMA_VERSION="2"`, `OfferSkillRequirement.weight` (1-5, toujours présent) + `min_years_source`, `NormalizedResponsibility.weight` (1-5, toujours inféré), `required_years` + `required_years_source`, `required_degrees[]`/`required_study_fields[]` (`{label, source}`), `certifications[]` (minées, pas d'invention), `JobOfferLanguageRequirement.origin`, docstrings | TD-033 | Livré |
| T-14 | ai-service | **P2 — Prompt offre v2** (`graphs/job_offer_normalize_agent.py`) : règles poids (déclaré verbatim / inféré = centralité du poste, 5=pivot 1-2=mention), minYears déductible sur skills déclarés sans years (source `inferred`), requiredYears total uniquement (déclaré jamais écrasé), degrees/studyFields déclarés + minés, certifications nommées explicitement, langues origin, example enrichi, "2" | TD-034 | Livré |
| T-15 | ai-service | **P3 — Tests offre v2** : `test_job_offer_schemas`, `test_job_offer_normalize`, `test_job_offer_agent`, `test_job_offer_routes` | — | Livré |
| T-16 | backend | **P4 — Miroirs Java** : `JobOfferNormalizationService.SCHEMA_VERSION="2"`, `NormalizationService.SCHEMA_VERSION="3"`, `buildForOffer` + degrees/studyFields (repos déjà injectés) ; tests | — | Livré |
| T-17 | ai-service | **P5 — Candidat v2 → v3** (`schemas/normalize.py` + `graphs/normalize_agent.py`) : `SCHEMA_VERSION="3"` ; `NormalizedLanguage {name, level, origin, evidence}` ; `NormalizedDiploma`/`NormalizedCertification` + `origin`+`evidence` (créables quand un texte nomme explicitement le credential, sinon interdit) ; evidence `source:"bio"` (index null) sur skills/langues/diplômes/certifications ; prompt : langues/diplômes/certifications minés depuis bio/expériences/projets, expériences/projets/links jamais créés ; tests candidat | — | Livré |
| T-18 | frontend | **P6 — Vues** : `types/normalized.ts` (poids, sources, exigences, certifications offre, langues candidat) ; `normalized-offer-view.tsx` (weight, required experience, education, certifications, badges origin) ; vue candidat (badges origin langues/diplômes/certifications) ; tests | — | Livré |
| T-19 | docs | **P7 — SPEC** : D35 (fiche offre v2), D36 (candidat v3), note §6.2 (fin « ni minés ni persistés »), §4.3 (languages/diplomas/certifications enrichis), règle matching `declared`=filtre dur / `inferred`=advisory ; tasks Livré ; TECH_DEBT TD-033/TD-036 reformulées | TD-033, TD-036 | Livré |

### Règles produit actées (validées 2026-10-14)

- **Poids** : échelle unique 1-5 sur `requiredSkills`, `preferredSkills`,
  `responsibilities`. Déclaré (skill stocké) = verbatim, jamais recalculé.
  Inféré ou absent = le LLM comprend le poste et assigne un poids logique
  (5 = pivot nommé dans le titre / dossier d'une responsabilité mandatory ;
  1-2 = mention accessoire). `weight` toujours présent dans la fiche offre.
- **minYears** : déclaré jamais écrasé ; sur skill déclaré sans years ET sur
  skill inféré, déductible depuis un énoncé explicite → `minYearsSource:
  "inferred"`.
- **requiredYears/Degrees/StudyFields** : déclaré = pass-through ; inféré =
  miné depuis la description (énoncés clairs et totaux uniquement) ;
  provenance obligatoire. Règle matching : declared = filtre dur,
  inferred = advisory.
- **Certifications offre** : entrées `certifications[]` minées depuis la
  description quand le recruteur les nomme explicitement (pas d'invention).
- **Langues (candidat + offre)** : les deux catégories — saisies (declared)
  et extraites d'un texte (inferred) ; `required` + niveau CEFR ; pas de poids.
- **Credentials candidat** : diplôme/certification nommé dans un texte →
  entrée créée (`origin: inferred` + preuve) ; détail non dit jamais complété.
- **Evidence candidat** : `source` ∈ bio|experience|project|diploma|
  certification ; index 0-based (null uniquement pour `bio`).
- **Versionnement** : par fiche (`normalized_profile.schema_version` +
  `schemaVersion` dans le JSON) ; offres 1→2, candidats 2→3 ; constantes
  miroir Java bumpées ; vieilles fiches régénérées à la prochaine validation.

### Audit extraction — détail (T-12, demande produit 2026-10-14)

Demande : le LLM doit extraire **toute information utile cachée dans les textes**
(bio, expériences, projets, description d'offre) — years par skill, skills
absents des cases cochées, pondération déduite de l'importance dans le contexte.

**Candidat v2 — conforme (rien à faire) :**
- `skills[].yearsExperience` = somme des périodes non-chevauchantes des
  `evidence` items, calculée par le LLM, sinon null
  (`normalize_agent.py` PROMPT_RULES + `NormalizedSkill.yearsExperience`).
- Minage complet : bio → title/summary/seniority ; descriptions expériences
  et projets → `domain`/`responsibilities`/`technologies`/`achievements` ;
  skills inférés avec `evidence` index 0-based ; catégorie taxonomique ;
  discipline déclaré/inféré/null sur chaque valeur dérivée.
- Diplomas : `degreeLabel`/`studyFieldLabel` normalisés contre le référentiel
  DB (buildForProfile envoie degrees + studyFields).

**Candidat v2 — manque :**
- G1 : langues **non minées** — prompt interdit de créer `languages[]` hors
  section déclarée ; « fluent English » dans la bio/expérience est perdu.
  → T-16 (origin + evidence sur les langues).
- G2 : certifications/diplômes inférés depuis les textes = **non, assumé** :
  un credential est vérifiable, en inventer une est une fausse preuve ; la
  mention « AWS certified » va dans le skills index (evidence expérience).
- G3 : dernière utilisation d'une compétence (CDC §12) : **reportée au
  matching** — les dates des `evidence` permettent de la recalculer.

**Offre v1 — manques (vers v2) :**
- O1 : `weight` (colonne DB NOT NULL, saisi au formulaire 1-5) jamais reporté
  → déclaré = verbatim ; inféré = centralité dans les textes (pivot d'une
  responsabilité mandatory > mention accessoire), null sinon. → T-13/T-14.
- O2 : `requiredExpYear`/`degreeLabels`/`studyFieldLabels` jetés (T-10) →
  restaurés + inférables depuis la prose (`"must hold a Master's"`, `"at
  least 5 years of experience"`) **uniquement énoncés clairs et totaux** (pas
  « 5 years with Kubernetes »), avec `*Source`. Règle matcher : declared =
  filtre dur, inferred = advisory. Les labels déclarés viennent déjà du
  catalogue DB (`job-offer-preview.tsx` mappe `degreeIds` → labels) :
  verbatim = déjà canonique, **zéro changement backend / buildForOffer**.
- O3 : prompt/example/schemaVersion → T-14. `has_content` : rien à changer.

## Backlog (basse sévérité, sans date)

TD-024 (DTO liste sans description), TD-025 (index `job_offer(status, created_at)`),
TD-026 (helpers label dupliqués service/snapshot), TD-030 (mapping article +
`SENIORITY_LABELS` ×3), TD-031 (code mort frontend), TD-034 (prompt offre
redondant avec le schéma), TD-036 (validation schéma offre laxiste).

## Décisions

- **2026-10-14 — Duplication pipelines IA assumée** : la normalisation offre
  et candidat dans `ai-service` gardent chacune leurs fichiers, constantes et
  prompts — modification indépendante des deux fonctionnalités. Jamais de
  fusion en base commune (rejet de la recommandation d'extraction).
- **2026-10-14 — Pagination : infinite scroll (D34)** : `size` toujours
  décidé par le backend (défaut 20, clamp 50) ; le frontend n'envoie aucun
  paramètre de taille et lit l'enveloppe `{items,page,size,total}`.
  Offset (pas de cursor) tant que le volume ne l'exige pas.

## Livré

| Date | Contenu | Réf |
|---|---|---|
| 2026-10-14 | **Chantier « fiche conforme » T-13→T-19 (P1→P7)** : offre schema v1→v2 (`SCHEMA_VERSION="2"`) — poids 1-5 sur skills et responsibilities, `min_years_source`, `required_years`(+source), `required_degrees`/`required_study_fields` (`{label,source}`), `certifications[]`, `origin` langues, input restauré (weight/requiredExpYear/degreeLabels/studyFieldLabels) + null-coercion camelCase ; prompt + example v2 enrichis ; candidat schema v2→v3 (`SCHEMA_VERSION="3"`) — `NormalizedLanguage/Diploma/Certification` avec `origin`+`evidence`, preuve `source:"bio"` (index null), minage des credentials/langues nommés dans les textes (expériences/projets/links interdits) ; backend : `buildForOffer` + degrees/studyFields, constantes `SCHEMA_VERSION` 2/3 ; frontend : types miroirs enrichis, vues admin avec poids/provenance/exigences/certifications (badges Declared/Inferred) ; suites vertes : **331 backend / 125 ai-service / 469 frontend + lint + build** ; SPEC : D35/D36 (§14.7), §4.3 v3, §6.2, §16 | D35, D36 ; TD-033 résolue (b5645ee), TD-036 reformulée |
| 2026-10-14 | Optimisations offres T-01→T-11 : `listMine` paginée `@Transactional(readOnly=true)` + enveloppe `{items,page,size,total}` (défaut 20, clamp 50) côté backend **et** admin ; `<InfiniteList>` réutilisable (IntersectionObserver maison + fallback a11y) branché sur les listes admin et recruteur ; bulk delete `@Modifying` sur les 4 repos offre ; `countByIdIn` dans `validateVocabularies` (1 COUNT/groupe) ; badges statut offre et lignes normalisées dédupliqués (sources uniques) ; champs morts retirés du payload offre ai-service (`weight`, `requiredExpYear`, `degreeLabels`, `studyFieldLabels` — `has_content` + docstring ajustés, schema v1 inchangé) ; timeout/retries LLM explicites (`LLM_TIMEOUT_SECONDS` 120 s, `LLM_MAX_RETRIES` 2) | D34 ; TD-020→TD-023, TD-027→TD-029, TD-035 (code livré — statut réel dans TECH_DEBT.md ; TD-033 de ce chantier était en fait une dette créée ici, résolue en D35/b5645ee) |
| 2026-10-13 | Console admin D33 : chrome `(admin)` + `AdminSidebar`, fiche détail compte, liste globale offres (filtre + pagination), détail offre format public, fiches normalisées friendly | SPEC §14.5 (D33) |
