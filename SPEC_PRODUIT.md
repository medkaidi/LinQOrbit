# LinQOrbit — Spécification produit

> **Document de référence pour le développement.** Combine : (1) le cahier des charges d'origine (fiche technique complète de la plateforme), (2) le rapport d'audit de cohérence (2026-10), (3) les décisions d'équipe actées. Ce fichier est le cahier des charges vivant de LinQOrbit ; il ne remplace pas les `AGENTS.md` (conventions de code), il les complète sur le plan fonctionnel et d'architecture produit.
>
> Structure : chaque domaine fonctionnel du cahier des charges est traité avec son **état** (conçu / décidé / implémenté / gap), ses **décisions**, et ses **prochaines étapes**. Le détail d'implémentation de la normalisation du profil candidat (seul domaine aujourd'hui bâti) est volontairement approfondi §4.

---

## Table des matières

1. [Vision et principes fondamentaux](#1-vision-et-principes-fondamentaux)
2. [Vue d'ensemble des domaines](#2-vue-ensemble-des-domaines)
3. [Comptes, rôles et identité](#3-comptes-rôles-et-identité)
4. [Normalisation du profil candidat](#4-normalisation-du-profil-candidat)
5. [Profil candidat (sections éditables)](#5-profil-candidat)
6. [Offres d'emploi et entreprise](#6-offres-demploi-et-entreprise)
7. [Critères de recrutement](#7-critères-de-recrutement)
8. [Moteur de matching](#8-moteur-de-matching)
9. [Analyse IA de l'offre](#9-analyse-ia-de-loffre)
10. [Questions de présélection et agent IA](#10-questions-de-présélection-et-agent-ia)
11. [Transparence, auto-évaluation, clarification](#11-transparence-auto-évaluation-clarification)
12. [Vue recruteur et candidatures](#12-vue-recruteur-et-candidatures)
13. [Architecture IA](#13-architecture-ia)
14. [Décisions d'équipe (registre)](#14-décisions-dequipe-registre)
15. [Modèle de données](#15-modèle-de-données)
16. [État actuel et écarts priorisés](#16-état-actuel-et-écarts-priorisés)
17. [Phasage](#17-phasage)
18. [Conventions et pièges de développement](#18-conventions-et-pièges-de-développement)

---

## 1. Vision et principes fondamentaux

### 1.1 Objectif

Plateforme SaaS de recrutement qui structure, analyse et met en relation offres et profils candidats via des LLM pré-entraînés. Approche : **normalisation** des offres et profils → **analyse sémantique** → **évaluation transparente** de la correspondance → collecte d'informations complémentaires avant entretien → interaction candidat / recruteur / IA.

**L'IA fournit des observations ; la décision finale reste au recruteur.**

### 1.2 Les quatre principes non négociables

| Principe | Conséquence design |
|---|---|
| **L'IA n'est pas le décideur** | Jamais « Ce candidat est bon, recrutez-le ». Toujours des éléments vérifiables : « Java : détecté », « Expérience Java : 5 ans déclarés », « Correspondance Java : 95 % ». |
| **Transparence** | Le candidat voit comment son profil a été interprété : critères évalués, correspondances, comparaison avec son auto-évaluation, signalement d'une mal-interprétation, ajout d'explications. |
| **Fiche normalisée = langage commun** | Toute recherche et mise en relation repose sur le **même moteur** de comparaison entre fiches normalisées. La fiche est le **cœur technique** du produit, pas une étape intermédiaire. |
| **Modèle ouvert, cadre structuré** | Taxonomie guidée (`known_category` + `other`) plutôt qu'une liste fermée ; le système peut sortir de la taxonomie et enregistrer les nouveaux types rencontrés. |

### 1.3 Le principe du moteur unique

```
                 ┌── Candidat → Offres     (recherche par le candidat)
                 │
Fiches           ├── Offre → Candidats     (propositions au recruteur)
normalisées ─────┤
                 └── Offre ↔ Candidat      (évaluation détaillée)
                          ↓
                       Matching
```

Un seul moteur, trois usages — pas d'algorithme différent par écran.

---

## 2. Vue d'ensemble des domaines

| Domaine | Concept CDC | Package backend | Package frontend | État |
|---|---|---|---|---|
| Comptes & auth | §26 Phase 1 | `auth/`, `user/`, `admin/` | `features/auth`, `features/admin` | ✅ Implémenté |
| Profil candidat (sections) | §10-16 | `candidate/` | `features/candidate` | ✅ Implémenté (6 sections) |
| **Normalisation profil** | §2.3, §10 | `candidate/` (worker, service, client) | bandeau | ✅ **Implémenté** (détail §4) |
| Import de CV | §10 (extraction IA) | `candidate/` (CvParseService) | `features/candidate/cv-*` | ✅ Implémenté (aperçu, non persisté) |
| Suggestions de compétences | — | `candidate/` + `admin/` | `features/admin` | ✅ Implémenté |
| Profil recruteur & entreprise | §22, §6 modèle D4 | `recruiter/`, `company/` | `features/recruiter`, `lib/api/{recruiter,company}.api.ts` | ✅ **Implémenté** (D10–D11 : backend + FE onboarding D16 + chrome D18) |
| Offres d'emploi | §3-4, §9 | `joboffer/` | `features/job-offer` | ✅ **Implémenté** (D12–D14 : CRUD + cycle de vie backend, FE offres/éditeur, complétude D21, duplication D20) |
| **Normalisation offre** | §9 | `joboffer/` (worker dédié à `source_type`) | — | 🏗 En cours (D15) |
| Critères (obligatoires/souhaitables) | §5-6 | `joboffer/` ou `matching/` | — | ❌ À venir |
| **Moteur de matching** | §3, §18-19 | `matching/` (vide) | `features/matching` (vide) | ❌ À venir |
| Analyse IA de l'offre | §8 | `joboffer/` + ai-service | — | ❌ À venir |
| Questions de présélection | §7 | `application/` (vide) | — | ❌ À venir |
| Agent IA de questions | §20-21 | `application/` + ai-service | — | ❌ À venir |
| Transparence / clarification | §2.2, §27 | `matching/` | `features/matching` | ❌ À venir (D1) |
| Vue recruteur | §22 | `recruiter/` | `features/recruiter` | ❌ À venir |
| Candidatures (ATS) | §23 | `application/` | `features/application` | ❌ À venir |

---

## 3. Comptes, rôles et identité

### 3.1 Modèle (implémenté)

- **Deux couches de rôles** : les rôles (`user_roles`, capacité `ADMIN(1)`) disent ce qu'un compte **peut faire** ; l'identité (candidat / recruteur) vit dans `candidates` / `recruiters` (cumul natif : un utilisateur peut être les deux). Jamais de `USER.type`, jamais de PERMISSIONS.
- Auth stateless JWT ; profil candidat lié par PK partagée `candidates.id ≡ users.id`.
- **`recruiters`** : table créée (V1) **vide, sans entité JPA** — profil recruteur livré en Phase 1 (D10 : `headline`, `bio`, ligne créée par `POST /recruiters/me`, `isRecruiter` exposé par `GET /auth/me`). Toujours **aucun rôle `RECRUITER` dans `user_roles`** (cohérent avec le candidat).

### 3.2 Identité candidat (§10.1 du CDC)

Champs disponibles : nom, prénom, email, téléphone, sexe, pays d'origine, ville/pays actuels.
- ⚠️ **Gap mineur** : « certaines informations peuvent être masquées dans certaines vues » (§10.1) — jamais abordé. À traiter avec les vues recruteur (masquage contact avant entretien, par ex.).
- ⚠️ Asymétrie actuelle : l'identité affichée sur `/profile` vient de `GET /auth/me`, le profil pro de `GET /candidates/me/profile` — deux API, normal mais à garder en tête.

---

## 4. Normalisation du profil candidat

> **Seul domaine normalisation aujourd'hui implémenté.** Détail exhaustif ci-dessous ; le volet offre reprendra la même machine (§6.3).

### 4.1 Cycle de vie complet

```
PUT …/section ×8          → 204, AUCUNE normalisation, heartbeat updated_at
        │
        ▼  dirty-flag = true
GET …/profile             → hasUnvalidatedChanges = true
        │
        ▼  clic « Validate profile » (seul déclencheur — Q1)
POST …/profile/validate   → lock pessimiste (findByIdForUpdate)
                             → dirty-check ; no-op si propre (sauf relance FAILED)
                             → version = max+1 ; jobs PENDING → SUPERSEDED
                             → INSERT normalized_profile (content NULL) + association + job PENDING
                             → ProfileValidatedEvent (après commit)
        │
        ▼  [AFTER_COMMIT] dispatch → normalizationExecutor (pool dédié, queue 256)
executeJob                → claim CAS PENDING→RUNNING (tx courte, TransactionTemplate)
                             → snapshot getProfile + contexte référentiel
                             → POST {ai}/profile/normalize   (hors tx, timeout read 120 s)
                             → setContent + casDone RUNNING→DONE (une tx)
        │
        ├─ échec → attempts+1 ; casRetry RUNNING→PENDING ; one-shot à +60 s
        │           (délai constant, max 3 exécutions : initiale + 2 retries)
        │           └ attempts ≥ 3 → casFail RUNNING→FAILED (terminal)
        │
        ▼
GET …/profile             → normalizationInProgress=true (PENDING|RUNNING)
                             ou normalizationFailed=true (FAILED ; message générique)
        │
        ▼  job DONE
GET …/profile             → bandeau masqué ; fiche = version courante (content NOT NULL)
```

**Règle d'or : Save ≠ Validate.** Une sauvegarde ne lance jamais de normalisation ; seule la validation explicite du profil le fait. **Pas de polling** (zéro `@Scheduled`) ; le seul scan est le **recovery au boot** : `RUNNING` > 10 min → replanifié ; `PENDING` dû → exécuté ; `PENDING` futur → planifié.

### 4.2 Machine à états du job

`PENDING → RUNNING → DONE` (succès) ; `RUNNING → PENDING → …` (retry) ; `RUNNING → FAILED` (terminal après 3 échecs) ; `PENDING → SUPERSEDED` (re-validation). Toutes les transitions = **CAS** `WHERE status = :expected` (multi-instances sûr). `SUPERSEDED` inéxécutable (claim exige `PENDING`).

### 4.3 Format canonique v2 (`schemaVersion="2"`)

CamelCase, dates `YYYY-MM`, CEFR, niveaux 1–5, **rien inventé**, jamais d'UUID (les `evidence` d'un skill référencent les sections par **index 0-based**) :

```
schemaVersion ("2"), title, summary, yearsOfExperience, seniority (nullable : junior|mid|senior|lead|principal),
targetRole, searchStatus, location (currentCity, currentCountry)
experiences[]     : positionTitle, companyName, companyCountry, startDate, endDate, description (verbatim),
                    domain, responsibilities[], technologies[], achievements[]
projects[]        : name, role, startDate, endDate, description, technologies, context
                    (personal|academic|open_source|professional|volunteer|other)
diplomas[]        : title, institution, institutionCountry, degreeLabel, studyFieldLabel, dates
certifications[]  : name, issuer, issuedAt  (extraite des liens CERTIFICATION)
languages[]       : name, level (CEFR)
links[]           : label, url, linkType, issuedAt  (liens non-certificats)
skills[]          : name, category (taxonomie §7.2), level (1–5), levelSource (declared|inferred|null),
                    yearsExperience, origin (declared|inferred), evidence[] : {source, index}
```

Règles du modèle de preuve : le **niveau déclaré n'est jamais recalculé** ; `yearsExperience` = somme des périodes non-chevauchantes des `evidence` ; discipline déclarée / inférée / null ; `evidence.index` = position 0-based dans le tableau source (expériences, projets…). Extraction **maximale** : le system prompt IA réécrit tous les textes (bio, descriptions expériences/projets) pour en tirer titre, rôle, séniorité, technologies, réalisations — le texte source reste verbatim en plus de la version structurée.

Stocké en `normalized_profile.content` (JSONB). **Aucun endpoint ne l'expose** (Q7 — provisoire, à réévaluer au matching, D5).

### 4.4 Points de vigilance techniques

- Erreurs IA = logs + `normalization_job.error` (500 chars), **jamais côté utilisateur**.
- Read timeout IA libère le thread mais n'annule pas le calcul FastAPI (socket fermée, réponse perdue).
- `SUPERSEDED` ne touche que les `PENDING` : un job `RUNNING` antérieur se termine de son côté (double job possible, coût LLM borné).
- Le recovery d'un `RUNNING` périmé consomme une tentative.
- Délai de retry **constant** (60 s), malgré le mot « backoff » dans le Javadoc.
- Backups : `hasFailedLatestJob` / `hasInProgressLatestJob` = dérivés du dernier job à chaque GET (pas de colonne stockée).

---

## 5. Profil candidat

### 5.1 Sections éditables (implémenté)

7 sections (`/profile/edit`) : **Personal Information** (title, bio, yearsOfExperience, searchStatus + identité compte), **Experience**, **Projects**, **Education**, **Skills** (catalogue 226 + niveau 1–5 + années), **Languages** (47 + CEFR), **Links & certifications** (11 types dont `CERTIFICATION` + issuer/issued_at).
- Section **Projects** (D3 levée, modèle autonome) : Nom, Rôle, Période, Description, Technologies en **texte libre** (liste libre côté saisie ; la canonicalisation est un travail de la fiche v2 côté IA). `PUT …/profile/projects` remplace la liste entière et régénère les UUIDs.
- `target_position` : colonne backend + API, **sortie de l'UI** (décision actée).
- **Save** : `PUT /auth/me` + `PUT …/about` en `Promise.allSettled` (About fusionné).
- **CV import** : `POST …/cv` → aperçu → Apply remplit les sections hors Projects (`keepDefaultValues`) ; **rien persisté côté serveur**.
- Jauge de complétion : 7 sections (titre + bio comptés comme About, tous les autres blocs vides = 2/7).

### 5.2 Écarts vs profil candidat du CDC (§10-16)

| Prévu (CDC) | État | Décision |
|---|---|---|
| §11 **Type de contrat recherché**, **mobilité** | Absents | **Retenus au scope** (D2) |
| §11 Disponibilité (date, préavis), pays acceptés | Seul `search_status` (3 valeurs) ; placeholder UI « Goals & criteria » | Pays à trancher avec l'UI |
| §11 Domaine, niveau professionnel / séniorité | `title` + `seniority` (inféré par IA, nullable) | `targetPosition` toujours mort UI ; D2 ouvre contrat/mobilité |
| §12 Compétences : catégorie, dernière utilisation, projets associés, **sources** | **Category, levelSource, origin, yearsExperience, evidence** en schema v2 | ✅ Livré |
| §13 Expériences : technologies, projets, domaine, compétences mobilisées | `domain`, `responsibilities[]`, `technologies[]`, `achievements[]` + description verbatim en v2 | ✅ Livré (v2) |
| §14 **Projets** | Section Projects (7ᵉ) + contenu `projects[]` en v2 | ✅ Livré (D3 levée — D7/D8) |
| §15 Certifications dédiées | Via `candidate_links` + table `certifications[]` (issuer/issuedAt) en v2 | Simplification assumée (D6) |
| §16 Langues : déclaré vs évalué + contexte | Un seul niveau CEFR | « Évalué » = matching futur |
| §17 Auto-évaluation (IA vs candidat + commentaire) | Proxy : `candidate_skills.level` | Dépend du matching (§11) |

---

## 6. Offres d'emploi et entreprise

### 6.1 Modèle relationnel cible (D4 + D10–D15 — décidé, en implémentation)

```
users ──▶ recruiters (V1, enrichie : headline, bio — D10)
             │
             ├─ crée une company → owner (company_members — D11)
             └─ affecté à une company (appartendance)
                          │
                          ▼
               job_offer (recruiter_id → gestion, company_id → appartenance)
                          │            [relation tertiaire]
               validation par le recruteur (D13 : DRAFT → VALIDATED → PUBLISHED)
                          ▼
               normalisation de l'offre → fiche offre
                          ▼
               matching : fiche offre ↔ fiches candidats
```

- Une offre est **gérée par un recruteur** et **appartient à une company**.
- La validation de l'offre par le recruteur **déclenche sa normalisation** — même machine à états que le profil candidat (shared PK `job_id ≡ normalized_profile_id`, réutilisation de `normalization_job` + `source_type`, D15).
- L'association de la fiche à sa source : **table dédiée `normalized_profile_job_offer`** (le profil est candidat XOR offre, D15) — `normalized_profile_candidate` reste inchangée.

### 6.2 Fiche offre normalisée (§3 + §9 du CDC)

Représente l'offre **au-delà du texte libre** :

| Bloc | Contenu |
|---|---|
| Informations générales | Titre, intitulés alternatifs, domaine, sous-domaine, type de contrat, temps de travail, niveau, localisation, mode de travail, pays acceptés, mobilité, fourchette salariale (facultatif), langues + niveau requis |
| Contexte (§4) | Présentation poste, entreprise, équipe, responsabilités, objectifs, environnement technique, outils — chaque responsabilité normalisée avec `importance: mandatory\|optional` |
| Critères | Obligatoires et souhaitables (§7), chacun avec poids |
| Questions | Questions de présélection (§10) |
| Autres | Critères détectés par l'IA |

**Symétrie exigée** avec la fiche candidat pour permettre la comparaison : compétences, niveau, langues, localisation, mobilité, contrat.

Le recruteur peut **Modifier → Valider → Publier** ; la fiche validée devient la référence de matching.

### 6.3 Analyse IA de l'offre (§8 du CDC — à venir)

Avant publication, le modèle analyse le texte et signale (sans décider) **11 familles d'anomalies** : qualité rédactionnelle, informations manquantes, exigences excessives, incohérence titre/contenu, incohérences internes, mélange obligatoire/souhaitable, critères invérifiables, critères trop vagues, critères potentiellement discriminatoires, contradictions sémantiques, suggestions d'amélioration.

Taxonomie ouverte (`known_category` + `other`, §25) : `writing_quality`, `missing_information`, `internal_inconsistency`, `title_description_mismatch`, `excessive_requirements`, `vague_requirement`, `mandatory_preferred_conflict`, `unrealistic_experience`, `potentially_sensitive_requirement`, `verifiability_issue`, `semantic_inconsistency`, `other`.

Format de sortie par anomalie : `{category, severity, description, evidence, suggestion, confidence}`. Le recruteur garde la décision finale.

---

## 7. Critères de recrutement

> **Partie centrale du système** (§5-6 du CDC) — le matching s'appuie dessus. Modèle à concevoir avec les offres.

### 7.1 Deux catégories, pondérées séparément

| Catégorie | Règle | Exemple |
|---|---|---|
| **Obligatoires** | Nécessaires ; total 100 % | Java 30 %, Spring Boot 25 %, Expérience 25 %, SQL 20 % |
| **Souhaitables** | Avantage, non indispensables ; total 100 % | React 40 %, AWS 30 %, Docker 20 %, Kafka 10 % |

Résultat : « Obligatoires : 92 % / Souhaitables : 68 % ». **Un candidat ne compense pas une faiblesse sur un obligatoire avec des souhaitables.**

### 7.2 Structure détaillée d'un critère

```json
{
  "name": "Java",
  "category": "technical_skill",
  "importance": "mandatory",
  "weight": 30,
  "required_level": "advanced",
  "minimum_experience": 3,
  "evidence_required": true
}
```

Plus : contexte éventuel, synonymes, informations complémentaires.
**Catégories** (cadre initial, non fermé) : technical_skill, programming_language, framework, library, tool, methodology, business_domain, experience, education, certification, language, location, availability, mobility, soft_skill, responsibility, regulatory_knowledge, **other**.

---

## 8. Moteur de matching

> **Le cœur du produit** (§3, §18-19 du CDC) — entièrement à concevoir. Trois usages du même moteur.

### 8.1 Combinaison attendue (§18)

```
Offre ──┐       ├── Règles métier (critères pondérés, niveaux requis)
        ├───────┼── Matching exact (compétences, langues, localisation…)
Candidat┘       ├── Similarité sémantique (embeddings : « PostgreSQL » ↔ « bases de données relationnelles »)
                └── Informations disponibles (distinction cruciale : absent ≠ non possédé)
                       ↓
                 Score par critère
```

**Jamais** « LLM → ce candidat vaut 87 % ». Les calculs et pondérations sont **côté backend** ; le LLM comprend le texte.

### 8.2 Résultat structuré (§19)

- Scores par critère, séparés obligatoires / souhaitables, avec correspondances identifiées.
- Catégorie **« Informations insuffisantes »** : distingue « le candidat ne possède pas cette compétence » de « aucune information suffisante n'a été trouvée ». **Distinction très importante** (§19).
- Présentation côté candidat (§3) : « Java Full Stack — Correspondance élevée. Obligatoire : 94 %. Souhaitable : 72 % ».

### 8.3 Trois usages

| Usage | Flux | Acteur |
|---|---|---|
| Candidat → Offres | Fiche candidat → matching → offres correspondantes | Candidat recherche |
| Offre → Candidats | Fiche offre → matching → candidats correspondants | Recruteur reçoit des propositions |
| Offre ↔ Candidat | Évaluation détaillée → transparence → clarification (§11) | Les deux |

---

## 9. Analyse IA de l'offre

Voir §6.3. Statut : **non implémenté** (0 route, 0 schéma dans `ai-service/`). Viendra avec les offres (Phase 1).

---

## 10. Questions de présélection et agent IA

### 10.1 Questions du recruteur (§7 — à venir)

Chaque question : texte, type de réponse, obligatoire/optionnelle, critère associé, ordre. Types : texte libre, oui/non, choix unique, choix multiple, nombre, date, expérience, langue, localisation, autre.
- **Question obligatoire** : le candidat doit y répondre pour soumettre sa candidature — règle du recruteur, jamais de l'IA.

### 10.2 Agent IA de questions (§20-21 — à venir)

Une fois offre + profil normalisés, l'IA génère des **questions contextualisées** (optionnelles, toujours) pour réduire les zones d'incertitude :

```
Profil + Offre + Critères + Infos manquantes + Réponses précédentes
        ↓
« Vous indiquez 5 ans de Java. Dans quels projets avez-vous utilisé Spring Boot ? »
        ↓
Réponse → analyse → extraction structurée (compétences, expériences, contexte,
technologies, responsabilités, nouvelles infos, contradictions, points à clarifier)
        ↓
Enrichissement → éventuellement réévaluation
```

Ce n'est **pas un quiz** : l'objectif est de combler les incertitudes, pas de tester.

---

## 11. Transparence, auto-évaluation, clarification

### 11.1 Transparence (§2.2 — dépend du matching)

Le candidat doit pouvoir : consulter les critères évalués et correspondances, comparer l'évaluation IA avec sa propre évaluation, **signaler une mal-interprétation**, **ajouter une explication**. → **À implémenter avec le matching** (aucun code aujourd'hui ; Q7 à réévaluer pour exposer la fiche).

### 11.2 Auto-évaluation (§17 — indépendante de la clarification)

Le candidat évalue **sa propre perception** par critère : « Évaluation IA : 70 % / Auto-évaluation : 85 % ». **Ne modifie jamais** le score IA. Proxy actuel : `candidate_skills.level` 1–5 (globale, pas par critère d'offre).

### 11.3 Clarification & réévaluation (§27, D1 — cible)

**Déclenchement** : après le matching initial, sur les critères à correspondance faible/partielle, info insuffisante, ambiguïté, absence, interprétation potentiellement incorrecte.

**Cycle** :

```
Évaluation initiale (score par critère)
        ↓
Le candidat prend connaissance (affichage « comment mon profil a été évalué »)
        ↓
Pour chaque critère : correcte / partiellement correcte / incorrecte / incomplète
        + explication ou information complémentaire
        ↓   (ex. « AWS 35 % → j'ai utilisé AWS 18 mois, EC2/S3/RDS, projet X »)
Question de clarification ciblée générée (optionnelle)
        ↓
Réponse du candidat → analyse → réévaluation ciblée sur le(s) critère(s)
        ↓
confirmée / augmentée / diminuée / inchangé / nouvelle clarification nécessaire
        ↓
Historique conservé (traçabilité) : éval initiale → motif → réponse → rééval
```

**Principes** (§27) :
- Le candidat **ne saisit jamais** une nouvelle valeur (pas de « AWS = 80 % » de sa main). Il fournit des informations ; **le système réévalue**.
- La réévaluation porte **prioritairement** sur les critères concernés, pas sur tout le profil.
- La réévaluation peut confirmer, augmenter ou diminuer — **pas de garantie d'amélioration**.
- **Distinction stricte** : auto-évaluation (perception, indépendante) ≠ clarification (nouvelle évaluation IA).
- **Traçabilité** : le recruteur doit voir qu'une évaluation a été révisée suite à une clarification.
- Le recruteur peut aussi marquer un critère de son côté.

### 11.4 Évolution : Dynamic Candidate Assessment (§27 fin)

Le système identifie progressivement les zones d'incertitude et pose **les questions les plus informatives** (pas un grand nombre). Les questions restent soumises aux règles des questions IA (optionnelles, jamais une condition obligatoire cachée).

---

## 12. Vue recruteur et candidatures

### 12.1 Vue recruteur (§22 — à venir)

Liste de candidats avec : score obligatoires, score souhaitables, score candidat, localisation, langues, expérience, nb questions recruteur répondues, nb questions IA répondues, informations importantes détectées.
- **Le système ne supprime jamais automatiquement un candidat** ; tous restent accessibles.

### 12.2 Candidatures / ATS (§23 — à venir, peut fonctionner sans IA)

```
Offre créée → Candidature reçue → Présélection → Questions → Évaluation → Entretien → Décision
```

---

## 13. Architecture IA

### 13.1 Modèle (§24 — partiellement implémenté)

```
                    ┌───────────────────┐
                    │ LLM pré-entraîné │
                    └─────────┬─────────┘
             ┌────────────────┼────────────────┐
             ↓                ↓                ↓
        Extraction        Analyse          Génération
        structurée       d'offre          questions
             │
             ↓
       JSON structuré (structured outputs Pydantic)
             │
             ↓
       Validation backend (Spring, Bean Validation)
             │
             ↓
       Règles métier (backend : dirty-flag, versioning, CAS, pondérations)
             │
             ↓
       Matching / Embeddings (à venir)
```

- **Backend** : validation, calculs, pondérations, règles métier, droits, persistance, traçabilité. ✅ (normalisation) / ❌ (matching, calculs de scores)
- **LLM** : comprendre, extraire, normaliser, reformuler, identifier incohérences, générer questions, analyser réponses. ✅ (extraction CV, normalisation) / ❌ (le reste)

### 13.2 Implémentation actuelle (`ai-service/`)

- **Gemini `gemini-3.1-flash-lite`** via LangChain/LangGraph, structured output Pydantic, instance unique cachée, LangSmith, garde-fous (limite d'appels, un tour de réparation).
- **3 routes** : `GET /health`, `POST /cv/parse`, `POST /profile/normalize`. Prompts interdisant l'invention.
- **0** matching, **0** embeddings, **0** offre, **0** questions, **0** analyse d'offre. `langchain-openai` déclaré mais jamais importé (dépendance morte — nettoyer ou garder pour les embeddings futurs).
- Embeddings (§18) : prévus pour la similarité sémantique, **pas encore de choix technique** (pas d'index vectoriel, pas de bibliothèque installée).

---

## 14. Décisions d'équipe (registre)

### 14.1 Normalisation profil candidat (11 initiales + push)

| # | Décision |
|---|---|
| Q1 | Déclencheur = `POST …/profile/validate` ; les 7 PUT sections ne déclenchent rien. |
| Q2/Q9 | 5 statuts job ; re-validation → nouveau couple ; ancien PENDING → SUPERSEDED ; RUNNING se termine. |
| Q3 | Seule `normalized_profile` porte le contenu. |
| Q4 | Shared PK `job_id ≡ normalized_profile_id`. |
| Q5 | Version courante = dernière version `content IS NOT NULL`, dérivée. |
| Q6 | Format canonique v1 camelCase, `schemaVersion="1"`, dates `YYYY-MM`, CEFR, 1–5, rien inventé, pas d'UUID. |
| Q7 | **Pas de `GET …/normalized`** (provisoire — D5). |
| Q8 | Dirty-flag : `updated_at` vs `max(validated_at)`, dérivé au GET. |
| Q11 | Lock pessimiste `findByIdForUpdate`. |
| — | Relance FAILED acceptée sans changement ; no-op si `!dirty && latest != FAILED`. |
| — | **Push async** : événement après commit → executor dédié ; retries one-shot scheduler dédié (+60 s constant, 3 exécutions max) ; recovery au boot (3 classes) ; timeouts IA 5 s/120 s ; bandeau 4 états GET-driven ; erreurs IA jamais côté user. |

### 14.2 Décisions produit (audit + clarifications, 2026-10)

| # | Décision | Portée |
|---|---|---|
| **D1** | **La validation/clarification de la fiche se passe au matching** : à la validation du profil, la fiche est générée en arrière-plan, **référence immédiate, sans écran de révision**. Transparence + clarification = fonctions du matching (§11.3), quand le moteur d'évaluation existera. | Valide l'implémentation actuelle ; conditionne le matching. |
| **D2** | **Ajouts retenus au profil candidat** : **type de contrat recherché**, **mobilité**. | §5.2, schema v1 ou v2. |
| **D3** | ~~**Projets : étude préalable obligatoire**~~ → **levée le 2026-10-10** : implémentée comme 7ᵉ section + contenu v2 (voir D7/D8). | §5.1. |
| **D4** | **Normalisation d'offre avec le profil recruteur** : recruteur crée company (owner) ou y est affecté ; offre = `recruiter_id` + `company_id` ; validation de l'offre → normalisation → fiche → matching. | §6.1. |
| **D5** | **Q7 à réévaluer au matching** : l'affichage « comment mon profil a été évalué » nécessitera de lire la fiche — décider alors de la forme du endpoint. | §4.3, §11.1. |
| **D6** | **Certifications** via `candidate_links` (simplification assumée : pas d'expiration/vérification/rattachement compétence). | §5.2. |
| **D7** | **Modèle Projets = section autonome** (miroir Experiences, aucun FK) : le `PUT …/profile/projects` remplace la liste entière et régénère les UUIDs. Champs v1 minimaux + texte libre : Nom, Rôle, Période, Description, Technologies en texte libre (liste libre à la saisie ; canonicalisation = travail de la fiche v2 côté IA). | §5.1. |
| **D8** | **Périmètre = extraction maximale** : le system prompt IA réécrit tous les textes (bio, descriptions expériences/projets) pour en tirer titre, rôle, séniorité, technologies, réalisations — différenciateur produit. | §4.3. |
| **D9** | **Modèle de preuve v2** : `skills[]` index `{name, category, level, levelSource, yearsExperience, origin, evidence:[{source, index}]}` — niveau déclaré jamais recalculé, `yearsExperience` = somme des périodes non-chevauchantes des evidence, evidence = index 0-based (zéro identifiant), discipline déclarée/inférée/null. | §4.3. |

### 14.3 Phase 1 — Entreprise, recruteur, offre (2026-10-11)

| # | Décision | Portée |
|---|---|---|
| **D10** | **Identité recruteur = ligne `recruiters` enrichie** (`headline VARCHAR(100)`, `bio TEXT`), créée par `POST /api/v1/recruiters/me` (self-serve, action explicite — jamais sur GET). **Aucun rôle ajouté à `user_roles`** (cohérence : le candidat n'en a pas non plus ; `user_roles` reste capacité-only) ; `GET /auth/me` ajoute `isRecruiter`. Sécurité : `.authenticated()` + vérification service (404 sans ligne). Identité nominative (nom, photo, e-mail) reste sur `users`. **Photos/pièces jointes = table `attachments` à venir (scope projet, hors V11).** | §3.1, §6.1. |
| **D11** | **Company** : `companies(id, name, description NULL)` + `company_members(company_id, recruiter_id, is_owner)` (PK composite, multi-appartenance). Création = tout recruteur (devient `is_owner`); `PUT /companies/{id}` réservé à l'owner. | §6.1. |
| **D12** | **Permissions offre (rôle coarse uniquement)** : membre de la company = lecture + création (le créateur devient gestionnaire via `job_offers.recruiter_id`) ; **owner ou gestionnaire** = édition / validate / publish / close / delete. Aucune permission fine. | §6.1. |
| **D13** | **Cycle de vie offre : `DRAFT → VALIDATED → PUBLISHED → CLOSED`, validate ≠ publish.** `POST …/validate` = acte explicite qui déclenche la normalisation (miroir « Validate profile », D4) ; `POST …/publish` (exige `VALIDATED`) = publication, `published_at` ; `POST …/close` (depuis `VALIDATED` ou `PUBLISHED`) ; publication **planifiable** = évolution future (colonne déjà présente). Édition autorisée en `DRAFT`/`VALIDATED` (dirty-flag `hasUnvalidatedChanges` = `updated_at` vs `max(validated_at)`, miroir candidat — re-validation → nouvelle version de fiche) ; `PUBLISHED`/`CLOSED` = lecture seule ; `DELETE` = `DRAFT` seul. | §6.1, §6.2. |
| **D14** | **Vocabulaires d'offre = tables de référence** `contract_type` / `employment_type` (full-time / part-time) / `work_mode` (remote / hybrid / on-site), shape `(id, label UNIQUE)` miroir `degrees`, seed en migration dédiée, endpoints `/job-offers/reference/*`. Enums Java SMALLINT (pas de table) uniquement pour `status`, `seniority` (**junior/mid/senior/lead/principal = mêmes valeurs que le schema v2 IA**, symétrie matching), `requirement_type`, `salary_period`. `salary_type` (brut/net) **supprimé**. Localisation = `city VARCHAR(255)` + `country VARCHAR(2)` ISO, miroir `users` (pas de table geo). `published_at` conservée à côté de `validated_at` (les deux notions sont distinctes, D13). | §6.2, §15.3. |
| **D15** | **Normalisation d'offre : même machine que le profil candidat** — `normalized_profile` + association `normalized_profile_job_offer` (profil = candidat **XOR** offre) + colonne `source_type` (`CANDIDATE`/`OFFER`) sur `normalization_job` : chaque worker ne réclame que son type (zéro course au claim, zéro refactor du worker candidat ; recovery / retries / executor réutilisés à l'identique). La `description` étant HTML sanitisé depuis D19, le worker **strip le HTML via jsoup** avant l'extraction IA (texte brut pour le LLM). | §6.1, §4. |
| **D16** | **Onboarding recruteur** : la bascule « Candidate \| Recruiter » change de layout et affiche un overlay « Switching to recruiter workspace… » pendant `GET /recruiters/me` ; 404 (pas recruteur) → **création auto du profil** (`POST /me`, l'information/consentement étant porté par le modal de bascule D17 — aucun écran d'essai intermédiaire) → recruteur sans company → page de setup ; sinon → espace offres. Un 409 (profil créé entre-temps) est absorbé par une invalidation → refetch. | §6.1, frontend. |
| **D17** | **Bascule de profil = modal de confirmation** : depuis le profil candidat, clic sur « Recruteur » ouvre un modal (message d'essai + bouton « Switch to recruiter », source unique partagée) **sans naviguer** ; confirmation → `/recruiter` (le workspace y crée le profil si 404), annulation/Échap → rester. Le retour Recruiter → Candidate navigue directement. Primitif unique `components/ui/dialog.tsx` (portal sur `document.body`, immunité aux ancêtres `backdrop-blur`/`transform`, Échap, verrou scroll, `dismissable`) réutilisé par la modale admin de revue — une seule implémentation de shell modal dans l'app. | §6.1, frontend. |
| **D18** | **Mode profil = source de vérité UI du chrome** : `stores/view-mode-store.ts` (Zustand persisté, clé `linqorbit.viewMode`, défaut `candidate`, état UI pur sans rôle backend) lu par `useViewMode`, qui **force `recruiter` dès que la route est `/recruiter*`** (deep link sûr ; jamais l'inverse — le clic « Candidate » passe par le modal D17 puis la route suit). Chrome adaptatif en mode recruteur : **sidenav minimale** (Overview `/dashboard`, Offers `/recruiter`, Settings `/recruiter/settings` — sans Profile ni sections placeholders, Administration/télémétrie inchangées), **cartes dashboard `RECRUITER_STATS`** fictifs (mêmes titres de carte, même titre « Welcome back… »), **menu user enrichi** (headline du profil recruteur sous l'email via `useRecruiterProfile({ enabled: mode === "recruiter" })` + menuitem « Recruiter settings » → `/recruiter/settings`, visible uniquement en mode recruteur). La section « Recruiter profile » passe en **lecture par défaut** (miroir `CompaniesSection` : bouton `Edit` → formulaire RHF → `Save`/`Discard`). | frontend. |
| **D19** | **Description d'offre = HTML riche sanitisé** : éditeur Tiptap (`components/ui/rich-text-editor.tsx` — Bold/Italic/Underline, H2/H3, listes, Lien http(s), `immediatelyRender: false`) branché via `Controller` sur `description` ; le HTML **sanitisé au vol** (DOMPurify, profile `html`) dans la couche API (`lib/utils/sanitize-html.ts` + `htmlOrNull` : vide/`<p></p>` → `null`) — la base ne stocke jamais de HTML cru. Limite métier 20 000 caractères (FE `optionalText(20000)` + BE `@Size(max = 20000)` sur `description TEXT`, migration V14). Le worker de normalisation (D15, à venir) **strip le HTML via jsoup** avant extraction IA. | §15.3, frontend. |
| **D20** | **Duplication d'offre** : `POST …/{offerId}/duplicate` (membre de la company, tous statuts) — copie le contenu en une nouvelle offre **DRAFT** attribuée au duplicateur : titre suffixé « (copy) » (base tronquée pour tenir dans le VARCHAR(255)), `publicId` régénéré, slug recalculé, `expiresAt`/`validatedAt`/`publishedAt` à null ; enfants (skills/languages/degrees/studyFields) recopiés à l'identique (`copyChildren`, inserts seules, aucune revalidation vocabulaire — les FK viennent de la base). **Sans ConfirmDialog** (non destructif, brouillon supprimable d'un clic) ; après succès, navigation vers l'édition de la copie. | §6.1. |
| **D21** | **Complétude obligatoire d'une offre** : description (HTML strippé non vide), `country`, `employmentTypeId` et **≥ 1 skill** requis à la **création comme à l'édition** (miroir BE `@NotBlank`/`@NotNull`/`@Size(min = 1)` + FE `refineJobOffer` — jamais d'offre incomplète, retrofit naturel des brouillons legacy ; ville facultative). Boutons Validate/Publish `disabled` + `title` sur offre incomplète (`isOfferReadyToPublish`, filet côté liste) ; erreur racine `skills` affichée sous la liste du formulaire. | §6.1, frontend. |

---

## 15. Modèle de données

### 15.1 Existant (migrations V1–V10)

**Comptes** : `users` (identité + géo + `updated_at` heartbeat), `candidates` (title, bio, years_of_experience, search_status, target_position), `recruiters` (vide), `user_roles`.
**Profil** : `professional_experiences` (dont FK morte `job_position_id`), `candidate_projects` (V10 — Nom, Rôle, Période, Description, Technologies libre), `diplomas`, `candidate_skills` (level 1–5, years_experience), `candidate_languages` (CEFR), `candidate_links` (dont `CERTIFICATION`).
**Références** : `skills` (226, 10 catégories libres), `languages` (47), `degrees` (6), `study_fields` (24), `job_positions` (vide, sans entité).
**Suggestions** : `skill_suggestions` (pas de workflow persistant — résolution = suppression du groupe).
**Normalisation (V9)** :

| Table | Colonnes clés |
|---|---|
| `normalized_profile` | PK dédiée, `version`, `schema_version`, `content JSONB` nullable, `validated_at` |
| `normalized_profile_candidate` | PK composite (`normalized_profile_id`, `candidate_id`) — extension offres anticipée en commentaire |
| `normalization_job` | Shared PK (`job_id ≡ normalized_profile_id`, la PK porte la FK), `status VARCHAR(12)`, `attempts`, `next_attempt_at`, `error VARCHAR(500)`, `started_at`, `completed_at` |

### 15.2 Dette / faiblesses (audit)

- Enums **sans `CHECK`** en BD ; pas de `ON DELETE` sur `normalized_profile_candidate`/`normalization_job` (suppression candidat = violation FK) ; double heartbeat `updated_at` (`touchUpdatedAt` + `@UpdateTimestamp`) ; `job_positions` morte ; `langchain-openai` mort ; `skills.category` = VARCHAR libre (pas de table FK).

### 15.3 Phase 1 — concevoir / migrer (V11+)

**Décidé (D10–D15), à livrer en 5 migrations** :

| Migration | Contenu |
|---|---|
| ✅ V11 | `recruiters` + `headline`, `bio` ; `companies` ; `company_members` |
| ✅ V12 | `contract_type` / `employment_type` / `work_mode` + seeds |
| ✅ V13 | `job_offer` (+ `company_id`, `recruiter_id`, `status`, `seniority`, `city`/`country`, `validated_at`/`published_at`, salary) ; `job_offer_skills` (requirement_type, weight, years_experience) ; `job_offer_languages` (level CEFR, is_required) ; `job_offer_degrees` ; `job_offer_study_fields` |
| ✅ V14 | `job_offer.description` → `TEXT` (description riche Tiptap, D19 — limite métier 20 000 en `@Size`) |
| ✅ V15 | `job_offer.public_id` (VARCHAR(12) UNIQUE, immuable) + `slug` (VARCHAR(120), dérivé du titre) — URL publique `/jobs/{publicId}-{slug}`, lookup par `public_id` seul |
| V16 | `normalization_job` + `source_type` ; `normalized_profile_job_offer` |

**Reste à concevoir (phases suivantes)** : `offer_questions` (+ réponses candidat), `matching_results` (scores par critère, catégorie « info insuffisante »), `clarifications` (historique évaluation → clarification → rééval), `attachments` (photos / pièces jointes), embeddings (choix technique à trancher).

---

## 16. État actuel et écarts priorisés

### 16.1 Livré et testé

- Comptes, auth, admin, rôles ; profil candidat **7 sections** + import CV + suggestions ; **normalisation du profil candidat complète** (push async, dirty-flag, versioning, retries, recovery, bandeau) ; service IA extraction + normalisation (**schema v2** : Projets, séniorité, catégories, modèle de preuve, certifications, location) ; **Phase 1 backend étapes 1a–1d** : identité recruteur (D10), companies + membership (D11), vocabulaires d'offre (D14), **offres d'emploi CRUD + cycle de vie** (D12–D13 : validate ≠ publish, permissions coarse, dirty-flag) ; **Phase 1 frontend étape 2** : espace recruteur (`/recruiter`) avec onboarding D16 (overlay « Switching… », création auto du profil sur 404, création company), réglages (`/recruiter/settings`), éditeur d'offres (`/recruiter/offers/new`, `/recruiter/offers/[offerId]/edit`, description **HTML riche Tiptap sanitisé**, D19), liste des offres avec actions par statut (validate/publish/close/delete), bascule Candidate ↔ Recruiter branchée sur la route avec **modal de confirmation avant bascule** (D17) et primitif `Dialog` portalisé partagé ; **chrome adaptatif au mode profil** (D18 : sidenav recruteur minimale, cartes dashboard `RECRUITER_STATS`, entrée « Recruiter settings » + headline dans le menu user, section « Recruiter profile » en lecture/édition).
- **286 tests backend / 76 ai-service / 404 frontend au vert.**

### 16.2 Écarts (audit 2026-10)

| # | Écart | Nature | Priorité | Décision |
|---|---|---|---|---|
| 1 | Contenu normalisé ≈ 50 % du §10-17 (séniorité, dispo, mobilité, technologies absents) | Écart réel (chaîne profil → fiche) | ~~importante~~ → **partiellement résolu** (v2 : séniorité, catégories, technologies, réalisations, certifications, location ; mobilité/contrat restent D2) | D2 ouvre ; schemaVersion gère |
| 2 | Section Projets absente | Oubli réel (CDC : « importante ») | ~~importante~~ → **✅ résolu** | D3 levée (D7/D8) |
| 3 | Contrat / mobilité / pays acceptés absents | Écart réel (placeholder UI) | **importante** | D2 (contrat + mobilité) |
| 4 | Normalisation offre : 0 % | Volontaire (roadmap) | importante | D4 |
| 5 | Fiche jamais lue ni exposée | Décision Q7 | mineure → importante au matching | D5 |
| 6 | Champs IA acceptés puis jetés (`targetPosition`, `searchStatus`) | Fuite de conception | mineure | prochain toucher schéma |
| 7 | Certifications simplifiées | Non actée | mineure | D6 |
| 8 | Langues : déclaré/évalué/contexte | Dépend matching | mineure | reporté |
| 9 | Jobs simultanés possibles (RUNNING non superseded) | Documenté | mineure | — |
| 10 | Backoff constant / recovery = tentative | Doc | mineure | — |
| 11 | Dette : tables mortes, enums sans CHECK, ON DELETE, double heartbeat, dépendance morte | Dette | mineure | nettoyage |
| 12 | Identité masquable (§10.1) jamais abordée | Oubli de décision | mineure | profil recruteur |
| — | Workflow save/validate, async, architecture IA §24, 11 décisions | **Conforme** | aucune | — |
| — | Matching, critères, questions, clarification, transparence, vue recruteur, ATS, analyse offre | Reportés Phase 1+ | aucune action dans ce chantier | D1 |

### 16.3 Checklist de suivi — Phase 1 (rubrique entreprise / recruteur / offre)

> Règle de vie : une tâche terminée est **conservée et cochée** — rien ne se supprime ; seules les cases avancent. Mise à jour à chaque étape livrée.

**Backend (étapes 1a–1d)** — ✅ livré, 274 tests

- ✅ 1a — identité recruteur `recruiters` + headline/bio (D10, auto-création sur 404) — V11
- ✅ 1b — `companies` + `company_members` owner (D11) — V11
- ✅ 1c — vocabulaires d'offre `contract_type` / `employment_type` / `work_mode` (D14) — V12
- ✅ 1d — offre CRUD + cycle de vie `DRAFT→VALIDATED→PUBLISHED→CLOSED`, validate ≠ publish, dirty-flag, permissions coarse (D12–D13) — V13
- ✅ D19 backend — `job_offer.description` → `TEXT`, `@Size(max = 20000)` — V14

**Frontend (étape 2 + passes UX)** — ✅ livré, 384 tests

- ✅ Étape 2 — espace `/recruiter` (liste offres + actions par statut), `/recruiter/settings` (company + profil recruteur), éditeur d'offres `/recruiter/offers/new` + `/[offerId]/edit`
- ✅ D16 — onboarding recruteur (overlay « Switching… », auto-création du profil sur 404, setup company si besoin)
- ✅ D17 — modal de bascule Candidate↔Recruiter + primitif `Dialog` portalisé partagé
- ✅ D18 — chrome adaptatif (sidenav recruteur minimale, cartes `RECRUITER_STATS`, user-menu headline + « Recruiter settings »)
- ✅ Passes UX — page `/recruiter` = offres seules ; sidenav refactorisée (constantes partagées, `px-3`) ; formulaire offre (Add en bas de liste, `CtaButton tone="secondary"`, TagInput Degrees/Fields of study) ; user-menu nom+headline avec fallback email
- ✅ D19 frontend — `RichTextEditor` Tiptap + `sanitizeHtml` (DOMPurify, couche API) + styles `.job-offer-description`
- ✅ Padding éditeur — `px-4 py-3` miroir Textarea (texte non collé au bord, dernière ligne hors de la zone de courbure des coins)
- ✅ Boutons de formulaire — Discard/Cancel à gauche, Save changes/CTA à droite (pattern unifié avec `section-card` et aperçu d'import CV)
- ✅ Toolbar éditeur — Underline ajouté (Bold/Italic/Underline, H2/H3, listes, Lien)

**Correctifs pré-commit (audit fin de phase)** — ✅ livrés

- ✅ BE-1 — `hasUnvalidatedChanges` faux positif après publish/close (flag limité à DRAFT/VALIDATED)
- ✅ BE-2 — `weight` manquant non rejeté : `@NotNull` sur `JobOfferSkillRequest` + `@Valid` en cascade sur les listes `skills`/`languages` (Create/Update)
- ✅ BE-3 — doublons `skillId`/`languageId` dédupliqués côté serveur (`replaceChildren`, LinkedHashMap)
- ✅ FE-1 — erreur « Pick a level » affichée deux fois (paragraph redondant retiré du formulaire)
- ✅ FE-2 — `yearsExperience`/`requiredExpYear` bornés 0-60 côté schéma (61-99 acceptés avant)
- ✅ FE-3 — unicité skills/langues dans le schéma (miroir `withUniqueReferences` du profil candidat)
- ✅ FE-4 — `<button>` imbriqué dans `<a>` (Edit → lien habillé `outline-sm`, New offer → `NavPill`)
- ✅ FE-5 — édition d'offre : fetch `companies` inutile + écran blanc silencieux supprimés
- ✅ Docs — checklist §16.3

**Lot V15 — URL publique d'offre** — ✅ livré

- ✅ Migration V15 — `public_id VARCHAR(12) UNIQUE` immuable + `slug VARCHAR(120)` dérivé du titre ; aucun index additionnel (le UNIQUE couvre le lookup ; `(status, published_at)` viendra avec la liste publique)
- ✅ Backend — `GET /api/v1/jobs/{publicId}` en `permitAll` (`PublicJobResponse` sans recruiterId/statut/dirty-flag, labels résolus) ; 404 sûr sur inconnu/non publié/clôturé/expiré ; slug NFD sans diacritiques, régénéré à l'édition, `publicId` jamais modifié
- ✅ Frontend — page publique `app/(public)/jobs/[job]` (segment unique `{publicId}-{slug}`, split sur le premier tiret, états loading/404, description HTML sanitisé rendue avec styles `.job-offer-description`)
- ✅ URL publique côté recruteur — `publicId`/`slug` exposés par `JobOfferResponse` ; dans la liste `/recruiter`, les offres publiées affichent deux boutons lecture seule : **Copy link** (URL absolue dans le presse-papiers, retour « Copied » 2 s) et **View public page** (nouvel onglet vers `/jobs/{publicId}-{slug}`)

**Lots session offres (validations, confirmations, duplication, URL publique)** — ✅ livrés

- ✅ Complétude obligatoire (D21 : description, country, employment type, ≥ 1 skill — création + édition, Validate/Publish désactivés + infobulle sur offre incomplète)
- ✅ Confirmations : `ConfirmDialog` réutilisable (jamais `window.confirm`) — Delete (`danger`), Validate et Publish (`primary`, `busy` bloquant) ; Close reste direct
- ✅ Spinner infini : `busy` suit `isPending` (plus les `variables` persistées TanStack Query v5)
- ✅ Duplication (D20 : `POST …/duplicate` → 201, copie DRAFT « (copy) », navigation vers l'édition)
- ✅ URL publique : chemin `/api/v1/jobs/{publicId}` verrouillé par test (404 fantôme corrigé)

**Lot query keys + split hooks** — ✅ livré (sans changement de comportement)

- ✅ `hooks/query-keys.ts` — registre unique `queryKeys.<domain>…` (clés statiques `as const`, clés paramétrées en fabrique, familles invalidables par clé racine) ; aucun littéral `queryKey: [...]` ni constante de clé exportée hors du registre
- ✅ Migration des 5 hooks (`use-account`, `use-admin`, `use-candidate-profile`, `use-job-offers`, `use-recruiter`) + `public-job-view.tsx`
- ✅ Split `hooks/use-companies.ts` (`useCompanies`/`useCreateCompany`/`useUpdateCompany` sortis du god-hook `use-recruiter.ts`) ; imports mis à jour (workspace, companies-section, company-setup, job-offer-new)
- ✅ Règle ajoutée à `frontend/AGENTS.md` (registre + placement `hooks/`)

**Reste à faire (rubrique)**

- ✅ Commit de la rubrique (0712af6 — offres : complétude, duplication, confirmations, fix URL publique)
- ⬜ Normalisation d'offre (V16, D15 : `source_type`, worker dédié, **strip HTML via jsoup** avant extraction IA)
- ⬜ Analyse IA — 11 familles d'anomalies avant publication
- ⬜ Matching — moteur critères pondérés + similarité sémantique
- ⬜ Transparence & clarification — vue d'évaluation, clarification, réévaluation

---

## 17. Phasage

| Phase | Contenu | État |
|---|---|---|
| **0 — Profil candidat** | Comptes, 7 sections (dont **Projects**), import CV, **normalisation profil v2** (push, dirty-flag, bandeau, modèle de preuve) | ✅ **Livré** |
| **0+ — Extensions profil** | Contrat recherché + mobilité (D2) | Décision prête |
| **1 — Entreprise / recruteur / offre** | Company (owner/membre), identité recruteur (D10), CRUD offre + cycle de vie (D13), validation → **normalisation offre** (D4/D15) | 🏗 **Backend 1a–1d + FE étape 2 livrés (D10–D14, D16–D19)** ; reste : normalisation offre (V15/D15), analyse IA, matching |
| **1 — Analyse IA offre** | 11 familles d'anomalies avant publication (§6.3, §9) | À venir |
| **1 — Matching** | Moteur unique : critères pondérés (§7), score par critère, similarité sémantique (embeddings), « info insuffisante » (§19) | À venir |
| **1 — Transparence & clarification** | Vue d'évaluation, auto-évaluation (§11.2), clarification & réévaluation (§11.3, D1), historique, Q7 (D5) | À venir |
| **1 — Questions & recruteur** | Questions présélection, agent IA (§10), vue recruteur (§12.1), ATS basique (§12.2) | À venir |
| **2** | Matching avancé, embeddings, historique évaluations, statistiques, recherche sémantique | Plus tard |
| **3** | Freelance, intelligence du marché, analyses agrégées, API externe | Plus tard |

---

## 18. Conventions et pièges de développement

Voir `backend/AGENTS.md` et `frontend/AGENTS.md` pour le détail ; les plus critiques :

**Backend** : `./mvnw clean test` toujours avec `clean` ; Spring 7/Boot 4, Jackson `tools.jackson` ; DTOs = records ; erreurs IA = logs + colonne, jamais côté user ; Javadoc français.
**Worker** : jamais d'`@Transactional` auto-invoqué ; MDC `correlationId` = jobId ; `@MockitoBean(name=…, type=…)` pour les 2 beans executor ; jobs amorcés en SQL dans les tests worker.
**Frontend** : UI en anglais ; tests en miroir dans `tests/` ; `cn()` = join simple ; attente = prop `busy`.
**IA** : `uv run` depuis `ai-service/` ; prompts interdisant l'invention ; **`schemaVersion` = contrat de compatibilité** — toute extension du contenu = bump de version, jamais de migration silencieuse.
**Transverse** : une feature n'est pas finie sans ses tests ; pas de sur-ingénierie (Kafka interdit V0, pas d'hexagonal, pas d'abstraction fictive) ; les packages roadmap (`matching/`, `joboffer/`, …) naissent avec leur première classe.

---

*Créé le 2026-10-09 à partir du cahier des charges d'origine + audit de cohérence + décisions de l'équipe. Document vivant : nouvelle décision → §14 ; écart résolu → §16 ; phase livrée → §17 ; nouveau domaine → §2.*
