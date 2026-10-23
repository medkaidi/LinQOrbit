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
| Import de CV | §10 (extraction IA) | `candidate/` (CvParseService) | `features/candidate/cv-*` | ✅ Implémenté (aperçu ; le PDF est aussi déposé comme CV courant, ou déposé seul sans analyse — D73) |
| Suggestions de compétences | — | `candidate/` + `admin/` | `features/admin` | ✅ Implémenté |
| Profil recruteur & entreprise | §22, §6 modèle D4 | `recruiter/`, `company/` | `features/recruiter`, `lib/api/{recruiter,company}.api.ts` | ✅ **Implémenté** (D10–D11 : backend + FE onboarding D16 + chrome D18) |
| Offres d'emploi | §3-4, §9 | `joboffer/` | `features/job-offer` | ✅ **Implémenté** (D12–D14 : CRUD + cycle de vie backend, FE offres/éditeur, complétude D21, duplication D20) |
| **Normalisation offre** | §9 | `joboffer/` (worker unique branchant sur `source_type`) | `features/job-offer` (badges Analyzing… / Analysis failed + relance) | ✅ **Livré** (D22–D29 : fiche v1, V16–V17, signaux GET, relance FE) |
| Critères (obligatoires/souhaitables) | §5-6 | `matching/` (`MatchingCriteriaBuilder` — grille extraite de la fiche offre) | — | ✅ **Livré** (D58 : cinq sections, poids fiche / 1) |
| **Moteur de matching** | §3, §18-19 | `matching/` (service, worker async, client IA, barème) | `features/matching` | ✅ **Livré** (T-61, D58 — politique `education-2` (D61 + D67/D68) / barème `weighted-1`) |
| Analyse IA de l'offre | §8 | `joboffer/` + ai-service | — | ❌ À venir |
| Questions de présélection | §7 | `joboffer/` (CRUD) + `application/` (réponses en brouillon) | `features/job-offer`, `features/application` | ✅ **Livré** (D47, D59) |
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

> **Deux domaines normalisation implémentés** (profil candidat détaillé ci-dessous ; offre = même machine, §6.3/§9).

### 4.1 Cycle de vie complet

```
PUT …/section ×8          → 204, AUCUNE normalisation, heartbeat updated_at
        │
        ▼  dirty-flag = true
GET …/profile             → hasUnvalidatedChanges = true
        │
        ▼  clic « Validate profile » (seul déclencheur — Q1)
POST …/profile/validate   → lock pessimiste (findByIdForUpdate)
                             → dirty-check ; relance si dirty || analysisOutdated (hors PENDING/RUNNING) || FAILED ; no-op sinon
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

### 4.3 Format canonique v3 (`schemaVersion="3"`)

CamelCase, dates `YYYY-MM`, CEFR, niveaux 1–5, **rien inventé**, jamais d'UUID (les `evidence` d'un skill référencent les sections par **index 0-based** ; `source:"bio"` est le seul cas où `index` est null) :

```
schemaVersion ("3"), title, summary, yearsOfExperience, seniority (nullable : junior|mid|senior|lead|principal),
targetRole, searchStatus, location (currentCity, currentCountry)
experiences[]     : positionTitle, companyName, companyCountry, startDate, endDate, description (verbatim),
                    domain, responsibilities[], technologies[], achievements[]
projects[]        : name, role, startDate, endDate, description, technologies, context
                    (personal|academic|open_source|professional|volunteer|other)
diplomas[]        : title, institution, institutionCountry, degreeLabel, studyFieldLabel, dates,
                    origin (declared|inferred), evidence[]   (D36 : un diplôme nommé dans un texte → entrée créée,
                    origin "inferred" + preuve ; un détail non dit n'est jamais complété)
certifications[]  : name, issuer, issuedAt, origin, evidence[]  (extraite des liens CERTIFICATION ET des textes
                    quand un credential est nommé explicitement — jamais inventée)
languages[]       : name, level (CEFR), origin (declared|inferred), evidence[]  (D36 : « fluent English » dans
                    la bio ou une expérience devient une entrée inferred avec preuve ; pas de poids)
links[]           : label, url, linkType, issuedAt  (liens non-certificats — jamais créés par l'IA)
skills[]          : name, category (taxonomie §7.2), level (1–5), levelSource (declared|inferred|null),
                    yearsExperience, origin (declared|inferred), evidence[] : {source, index}
                    (source ∈ bio|experience|project|diploma|certification)
```

Règles du modèle de preuve : le **niveau déclaré n'est jamais recalculé** ; `yearsExperience` = somme des périodes non-chevauchantes des `evidence` ; discipline déclarée / inférée / null ; `evidence.index` = position 0-based dans le tableau source (expériences, projets…), null uniquement pour `bio`. Extraction **maximale** : le system prompt IA réécrit tous les textes (bio, descriptions expériences/projets) pour en tirer titre, rôle, séniorité, technologies, réalisations, langues et credentials nommés — le texte source reste verbatim en plus de la version structurée. Expériences, projets et links **restent interdits** au minage (une expérience inventée est une fausse preuve).

Stocké en `normalized_profile.content` (JSONB). **Aucun endpoint ne l'expose** (Q7 — provisoire, provisoirement lu par la console admin D33 en pass-through, à réévaluer au matching, D5).

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
- **CV import** : `POST …/cv` → aperçu → Apply remplit les sections hors Projects (`keepDefaultValues`) ; depuis D73 le PDF est aussi déposé comme CV courant (`POST …/me/attachments`) et le candidat peut choisir un **dépôt simple sans analyse**.
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

### 6.1 Modèle relationnel cible (D4 + D10–D15 — livré, V11–V17)

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

> **Fiche v1 (D22) livrée, enrichie en v2 (D35, 2026-10-14)** : poids 1-5 sur chaque critère skill **et** chaque responsabilité, `required_years` + `required_degrees`/`required_study_fields` avec provenance (`declared` = pass-through des champs/labels saisis, `inferred` = miné depuis les textes — énoncés totaux uniquement), `certifications[]` minées quand nommées explicitement, `origin` sur les langues. `degree_labels`/`study_field_labels`/`requiredExpYear`/`weight` du snapshot sont désormais consommés et persistés dans la fiche. **Reste hors v2** : sous-domaine, pays acceptés, mobilité, questions de présélection. Règle matching actée : `declared` = filtre dur, `inferred` = advisory.

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
Candidat┘       ├── Comparaison sémantique (LLM : « PostgreSQL » ↔ « bases de données relationnelles »)
                └── Informations disponibles (distinction cruciale : absent ≠ non possédé)
                       ↓
                 Score par critère
```

**Jamais** « LLM → ce candidat vaut 87 % ». Les calculs et pondérations sont **côté backend** ; le LLM comprend le texte. Les **embeddings** ne sont pas un axe de score (révisé par D31) : ils ne servent qu'au **retrieval amont** (§8.4).

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

### 8.4 Screening sémantique — retrieval en amont du matching

> **Évolution du matching (2026-10-12, D30–D32)** — pas un remplacement : un étage de **réduction de l'espace de recherche** exécuté avant §8.1–8.3.

#### 8.4.1 Position dans le pipeline

```
Offre validée (fiche v1)
      ↓
embedding de l'offre (§8.4.5)
      ↓
recherche de similarité pgvector (§8.4.7)
      ↓
Top N candidats présélectionnés
      ↓
Matching détaillé (§8.1–8.3)
      ↓
Ranking final (basé sur les résultats du matching)
```

`N = 20` n'est qu'un exemple initial, valeur **expérimentale** (§8.4.8). Trois questions distinctes : le retrieval répond « qui semble sémantiquement pertinent pour cette offre ? », le matching « dans quelle mesure chacun y correspond-il, et pourquoi ? », le ranking « dans quel ordre les présenter ? ». La chaîne cible est **Semantic Retrieval → Detailed Matching → Ranking**, jamais « Embedding Similarity → Final Score ».

#### 8.4.2 Rôle et limites

Le screening **réduit l'espace de recherche uniquement** — il ne décide ni ne score (D31). Exemple canonique : un candidat à similarité vectorielle 0.91 qui ne possède **pas** une compétence obligatoire doit rester derrière un candidat à 0.84 qui les possède toutes. Le matching détaillé reste la source de décision et du ranking, avec tous ses axes déjà prévus (§7, §8.2 : scores par critère, obligatoires/souhaitables, forces, lacunes, justification, « info insuffisante », questions générées, réponses candidat, recalcul).

**Condition de fiabilité** : si un bon candidat n'entre pas dans le Top N, le matching ne peut jamais le récupérer ensuite → le screening se juge sur le **rappel**, pas sur la précision (§8.4.8).

#### 8.4.3 Sources : profils normalisés des deux côtés

Les embeddings sont construits à partir de `NORMALIZED_PROFILE` des deux côtés (`source_type` CANDIDATE/OFFER, D26) — jamais du JSON brut des formulaires. Les structures JSON offre et candidat **diffèrent volontairement** : l'offre décrit des obligations (compétences obligatoires/souhaitables, responsabilités, séniorité, langues, localisation, contrat, contexte technique…) ; le candidat décrit des acquis (compétences, expériences, projets, formations, certifications, langues, responsabilités exercées, contexte technique…). C'est le matching qui reste responsable de la comparaison sémantique fine entre les deux.

**Population éligible** : seuls les candidats dont la normalisation est validée sont visibles au screening ; un profil non normalisé est invisible tant que le pipeline §4 n'a pas tourné.

#### 8.4.4 Représentation JSON → texte

`normalized_profile.content` est du JSONB ; la recherche vectorielle attend du texte. La représentation textuelle doit être **fidèle, structurée, sans invention** (elle ne doit rien ajouter qui n'existe pas dans le JSON). Deux familles à étudier :

| Option | Pour | Contre |
|---|---|---|
| Rendu **déterministe** (backend sérialise le JSON en texte ordonné) | Gratuit, testable, reproductible (même profil → même texte → même vecteur), zéro hallucination | Formulation moins naturelle |
| Reformulation **LLM** | Texte plus fluide | Coût, latence, omission/hallucination de compétences, représentation instable → embeddings non reproductibles |

Critères de choix : omission d'informations importantes, hallucination, coût/latence, stabilité/testabilité de la représentation. **Décision ouverte** — la solution retenue sera documentée ici avant implémentation.

#### 8.4.5 Génération des embeddings

Service d'embedding **externe**, étude préalable comparant : gratuité/quota gratuit, taille du modèle, dimension du vecteur, qualité de la recherche sémantique, **multilingue** (profils et offres mixtes FR/EN), stabilité de l'API, rate-limits, confidentialité des données, conditions d'utilisation, portabilité vers un autre modèle. **Même modèle, même espace vectoriel** pour les profils candidats et les profils d'offre ; la dimension est une **conséquence du modèle**, jamais choisie avant lui.

#### 8.4.6 Persistance : PostgreSQL + pgvector

- Extension **pgvector** à activer sur l'instance PostgreSQL (migration `CREATE EXTENSION IF NOT EXISTS vector`, image/docker adaptée).
- **Table dédiée `PROFILE_EMBEDDING`** (D32 — séparée de `normalized_profile` : régénérer un embedding ne doit jamais modifier ni perdre le profil normalisé) : `normalized_profile_id`, modèle utilisé, embedding, date de génération, version/stratégie de représentation. Shape exacte = open point (définie après le choix du modèle).
- **Index vectoriels seulement si le volume le justifie** — un scan séquentiel suffit au prototype ; type d'index (HNSW/IVFFlat…), métrique de distance (cosine/l2…) et paramètres = open points.

#### 8.4.7 Screening

Flux : offre validée (fiche v1 disponible) → embedding de l'offre → requête de similarité pgvector sur les embeddings candidats → **Top N** → matching détaillé §8.1–8.3 → ranking final basé sur les résultats du matching (jamais sur la similarité brute, D31).

#### 8.4.8 Mesure de la qualité du Top N

Le N et la stratégie de retrieval se règlent sur **des mesures, pas des suppositions**. Condition : le Top N doit contenir les candidats que le matching classerait en tête. Protocole à définir avant implémentation — piste : exécuter le matching complet sur un échantillon de candidats (hors screening) et mesurer à quelle fréquence son top K est inclus dans le Top N vectoriel (rappel proxy). Tant que le rappel n'est pas mesuré et satisfaisant, le screening n'est pas activé.

#### 8.4.9 Indépendance du matching

Le matching v1 **doit fonctionner sans pgvector** : il reçoit un ensemble de candidats (fourni directement par l'appelant) et produit ses résultats. Le screening est ensuite un **plug de retrieval interchangeable** en amont :

```
Version initiale :  Offre → Candidats (ensemble fourni) → Matching → Ranking
Version screening : Offre → Retrieval pgvector (Top N) → Matching → Ranking
```

Cela permet de développer et valider le matching indépendamment de la qualité du système de recherche vectorielle.

#### 8.4.10 Déclencheurs de génération

En miroir de l'architecture de normalisation (§4, §6.1) : génération de l'embedding au moment de la **validation** du profil candidat (validate) et de la **validation** de l'offre (validate, D13), à la création ou à la mise à jour du `PROFILE_EMBEDDING` correspondant ; **backfill** des profils et offres déjà validés à la mise en production ; régénération globale sur changement de modèle ou de stratégie de représentation (d'où le versionnement, §8.4.6).

#### 8.4.11 Ordre d'implémentation

1. Finaliser le matching détaillé (§8.1–8.3) — sans aucune dépendance retrieval.
2. Valider ses résultats sur des cas réels / représentatifs.
3. Étudier modèles et APIs d'embedding (§8.4.5) → choisir un modèle provisoire pour le prototype.
4. Ajouter pgvector à PostgreSQL + migration `PROFILE_EMBEDDING` (§8.4.6).
5. Implémenter la représentation JSON → texte (§8.4.4, solution tranchée et documentée avant).
6. Générer et stocker les embeddings (candidats + offres, backfill §8.4.10).
7. Implémenter la recherche pgvector (§8.4.7) et l'intégrer en amont du matching.
8. Mesurer la qualité du Top N (§8.4.8) → ajuster N et stratégie de retrieval.
9. Exécuter le matching détaillé sur le Top N → produire le ranking final.

#### 8.4.12 Points à ne pas figer prématurément

Fournisseur et modèle d'embedding · dimension du vecteur · méthode JSON → texte (LLM ou déterministe) · valeur de N · type d'index vectoriel · métrique de distance · stratégie de régénération · politique de versionnement des embeddings · recherche hybride (lexical + vectoriel) si le rappel pur vectoriel s'avère insuffisant.

Priorité aux mesures réelles plutôt qu'aux suppositions : construire l'architecture mesurable d'abord, choisir les paramètres techniques ensuite.

---

## 9. Analyse IA de l'offre

Voir §6.3. Statut : **livré côté normalisation** (fiche offre v1 : `POST /job-offer/normalize`, snapshot Spring, worker unique, signaux GET — D22–D29). Reste : les **11 familles d'anomalies** avant publication (analyse IA, 0 route).

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

Le candidat voit, pour chaque critère du résultat final, **son score 0–100** — jamais les poids, le score de section, la justification IA ni la fiche normalisée brute (Q7 maintenue, D58 (11)). Il peut **contester un item** : score propre 0–100 + commentaire, sans recalcul ni modification du score IA ; la contestation est **figée à la transmission** (D54 révisée par D62). Le recruteur voit les deux valeurs quand la candidature référence ce matching.

Le **signalement d'une évaluation IA** par le recruteur est un mécanisme interne distinct, par critère, rattaché au `matching_result_id` exact et sans effet sur le score (D66) — il ne remplace pas la contestation candidat et n'est jamais visible du candidat.

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

**État livré et distinction des mécanismes (2026-10-19)** : la génération des questions est autonome (D53) ; la **contestation candidat** est terminale, par item, sans recalcul (D54 révisée par D62). Le **marquage générique d'un critère par le recruteur** reste reporté au MVP. En revanche, le **signalement d'une évaluation IA** — bouton par item, motif + commentaire, rattaché au `matching_result_id` exact, interne et sans effet sur le score — est acté **hors T-66** (D66) : c'est un retour qualité, pas une réévaluation, et il n'est jamais visible du candidat.

### 11.4 Évolution : Dynamic Candidate Assessment (§27 fin)

Le système identifie progressivement les zones d'incertitude et pose **les questions les plus informatives** (pas un grand nombre). Les questions restent soumises aux règles des questions IA (optionnelles, jamais une condition obligatoire cachée).

---

## 12. Vue recruteur et candidatures

### 12.1 Vue recruteur (§22 — T-66, détail T-90)

**Liste des candidatures d'une offre**, par défaut sur `SUBMITTED` (les brouillons restent invisibles) ; onglets/filtre `ACCEPTED` et `REJECTED` ; `WITHDRAWN` reste en base pour les statistiques mais n'est pas affiché. Filtre de statut, `Sort by` et direction de tri tiennent sur **une seule ligne** (le `Select` compact partage la hauteur des contrôles segmentés) : le filtre de statut reste à gauche, le **bloc de tri est aligné à droite** de la ligne. Tri par date de candidature croissante par défaut (`submitted_at` immuable, V24 — jamais `created_at`/`updated_at`), puis tri ascendant/descendant par **score de section** (`requiredSkills`, `preferredSkills`, `languages`, `experience`, `education`) et par **contestations candidat**.

**Représentation des scores** : chaque carte est composée en **quatre zones** — identité, cinq scores, contestations, action — et affiche les **cinq scores de section** sous forme de **lignes compactes** (label, barre courte bleue avec la valeur **en pourcentage** — « 75 % », le signe `%` restant neutre). La zone des scores **hiverne sur son contenu** : la colonne est bornée (elle ne s'étire pas sur toute la largeur de la carte) et les lignes gardent une **colonne de valeurs alignées** — le libellé a une largeur fixe, la barre courte et la valeur ne dérivent pas avec la largeur de la carte ; l'espace libre est **réparti uniformément entre les zones** de la carte (aucun vide privilégié, ni entre le nom et les scores, ni avant le bouton d'action). La valeur porte en plus un **code de lecture** vert ≥ 70, orange 40–69, gris < 40 : c'est une aide au scan, jamais un verdict — le chiffre reste la source de vérité, il n'y a **pas de note globale, pas de radar et pas de décision automatique**. Section absente = « Not evaluated », jamais `0` ; la section choisie pour le tri est mise en évidence. L'identité affiche le nom et l'**intitulé du poste actuel du candidat** (`Candidate.title`), masqué s'il est absent, jamais l'email ni le téléphone. Candidature directe sans matching = « No AI assessment ». Le **panneau contestations** de la carte n'est rendu que si une évaluation IA existe ; sans matching, « No AI assessment » suffit. Il affiche le **nombre réel** de critères contestés et leur **écart moyen réel** sur une même ligne — orange pâle quand il y a des contestations, **gris neutre** sinon, `No contests` quand l'évaluation existe sans contestation — jamais d'agrégat IA vs candidat ni de preuve inventée. L'action est un **lien-bouton** « View application » (forme outline) : c'est un **changement de page**, pas une action sur la candidature (jamais Accept/Reject sur la carte).

**Tri « contestations »** : nombre de critères contestés (primaire), puis écart moyen absolu entre score propre et score IA (secondaire), puis date de candidature ; aucun feedback = dernier. Le panneau dédié montre le compteur (`3 contested`) et l'écart moyen (`18 pts`) sur une ligne, avec le résumé accessible « 3 contested · avg gap 18 pts ». C'est un signal de désaccord, jamais un score de qualité candidat.

**Latest-only (T-98)** : la liste, le détail et le tri ne lisent que les contestations du **dernier résultat terminé** du matching — jamais celles d'un ancien résultat, même encore épinglé par un signalement. Les lignes anciennes restent en base (traçabilité) mais ne sont **jamais fusionnées, comptées ni exposées** ; une réévaluation remplace donc la lecture des contestations sans en supprimer aucune. Le candidat suit la même règle (indicateur `contested` du dernier résultat).

**Détail d'une candidature** : réponses aux questions recruteur (`preferred` inclus), paires Q/R IA, **justification IA par critère** (jamais par section : le score de section est une moyenne pondérée), contestations candidat, CV épinglé en streaming authentifié. Le recruteur peut **accepter** ou **rejeter** manuellement — décision terminale, sans recalcul IA. L'application référence le matching et le CV **épinglés** à la transmission ; une candidature directe peut avoir `matching_id = NULL`.

**Structure du détail** (refonte T-90, sur la maquette `frontend/template/application_details.html`) : en-tête de page (fil d'Ariane à trois niveaux, **monogramme `rounded-full` + nom du candidat en h1**, l'**intitulé du poste actuel** du candidat (`Candidate.title`, masqué s'il est absent) **juste en dessous** et aligné sur le bloc d'identité, sous-titre « Application for {offre} · {société} », **lien outline « Back to applications »** — un changement de page, donc un lien et non un CTA) ; **barre de décision collante** (`sticky` sous le header du shell) portant la pastille de statut, la date de candidature et les deux actions `Accept` / `Reject` (`CtaButton` orange / rouge, `ConfirmDialog`, décision terminale) — la collante existe parce que la décision est terminale et doit rester atteignable sur une page longue. Sans `canDecide` (droits D12) ou sur une candidature déjà décidée, **aucun bouton** n'est rendu et la barre **explique pourquoi** (deux messages distincts : « déjà décidée, sans recalcul IA » / « seul l'owner de la company ou le recruteur créateur de l'offre peut décider »). Le corps est une **grille 8/4 ≥ `xl`** : à gauche le récit (évaluation IA par section puis par critère, questions recruteur, clarifications IA), à droite les **documents et signaux** — **carte CV** (nom du fichier, taille réelle, **CTA bleu de téléchargement** ; l'orange reste réservé à la décision) puis le **panneau des contestations** ; sous `xl` la grille s'empile dans l'ordre du DOM. L'évaluation IA affiche pour chaque section son **score en pourcentage** (pastille teintée par bande) et pour chaque critère son score, une **barre bleue** et la justification IA ; le critère **contesté** est signalé par une pastille « Contested » (croisement `criterion.key` ↔ `contest.criterionKey`) pour qu'on le lise sans croiser avec le panneau des contestations. Le panneau des contestations compare **note IA / note du candidat / écart** et affiche l'**écart moyen** (calculé par le serveur, comme sur la carte de liste) ainsi que l'argumentaire du candidat (sous le libellé « Candidate's argument ») ; il est **orange quand le candidat conteste, gris sinon**, et n'existe **que si une évaluation IA est attachée**. Les scores suivent le code de lecture de la carte (barres bleues, valeur verte ≥ 70 / orange 40–69 / gris < 40, unité « % » neutre) : **ni note globale, ni radar, ni moyenne pondérée, ni note propre du candidat** (la note du candidat est un désaccord, pas une qualité). Les clarification IA portent la **raison de la question** (« Why the AI asked this ») puis un **libellé « Answer »** suivi de la réponse du candidat — la mention d'état (`Answered` / `Open` / `Skipped`) accompagne la réponse, elle ne qualifie plus la question.

**Écarté de la maquette faute de donnée réelle** (aucune invention) : « Match Global » et « Certitude » (note globale), radar et « Score Moyen Pondéré », « Profil Vérifié », « Audit Actif », identifiant candidat lisible, partage et historique d'audit, sélecteur d'étapes du pipeline, note interne, « Demander complément », shortlist, « Valider pour entretien technique », aperçu du CV, coordonnées du candidat (email, téléphone, liens — **explicitement interdites** par la règle d'identité ci-dessus), localisation / disponibilité / salaire du candidat, verdicts IA sur les réponses et pièces jointes de contestation, et arbitrage de contestation (« valider le score candidat », « maintenir le score IA », « ajuster manuellement ») : l'évaluation est **épinglée**, le serveur refuse tout recalcul — le recruteur arbitre en acceptant ou rejetant la candidature.

**Droits (D12)** : tout membre de la company lit la liste, le détail et le CV épinglé ; seuls l'**owner** de la company ou le **recruteur créateur de l'offre** peuvent accepter ou rejeter. Le serveur expose `canDecide` dans le détail et refuse toute autre décision (403).

**Le système ne supprime jamais automatiquement un candidat** ; tous restent accessibles. Le signalement interne d'une évaluation IA (D66) vit dans le détail, par critère.

**Signalement interne d'une évaluation IA (D66, T-86)** : sous le score de chaque critère de l'évaluation IA, une action secondaire **« Report »** ouvre un dialogue : **motif** (score incorrect, preuve erronée, profil mal compris, exigence mal comprise, autre) puis **commentaire**. Le commentaire est **facultatif**, sauf pour le motif **« autre »** — seul motif qui ne dit rien par lui-même, il y est donc **obligatoire** (le serveur le refuse sans ; un `CHECK` en base le garantit). Le dialogue annonce que le signalement est **définitif** (il ne peut être ni modifié ni retiré) et qu'il **ne change pas le score**, n'est **jamais visible du candidat** et ne déclenche **aucune réévaluation**. Le critère est désigné par sa **clé dans le résultat affiché** — le client la recopie, **le serveur la résout** dans le JSON du résultat épinglé (une clé inconnue est refusée) : le signalement est donc **rattaché au résultat exact** que le recruteur a sous les yeux. Un signalement est **refusé en 409 tant qu'une analyse est en vol** (dernier job `PENDING`/`RUNNING`) : épingler un résultat encore changeant produirait un dossier faux ; la course résiduelle (nouveau job créé juste après le contrôle) est documentée dans `TECH_DEBT.md` (TD-067). Un critère déjà signalé par le lecteur **garde exactement la même carte** que les autres (aucun rail, aucun fond teinté : le signalement est un retour qualité marginal, pas un état de recrutement) et perd son action (le signalement est unique par auteur et par critère) ; son **signalement est relu dans un encart très discret en pied de carte** (ligne orange « Reported · motif · date », commentaire éventuel, fond pâle et rayon réduit), c'est la consultation par l'auteur, et l'en-tête de section affiche **`⚑ N reported`** — la **somme des signalements de l'auteur dans cette section de la même candidature** (jamais un agrégat inter-candidatures : un compteur global serait sémantiquement faux et un risque d'ancrage pour le recruteur). Le détail n'expose que **les signalements de son auteur** ; la **console d'administration** (`/admin/reports`, rôle ADMIN) en liste l'ensemble — auteur, offre, company, candidat, critère (libellé et section relus dans le résultat épinglé), motif, commentaire et date — avec une action **« View »** vers le **dossier** `/admin/reports/{id}` : signalement, liens vers l'offre et le compte candidat, critère relu dans **le résultat épinglé** (score, score de section, exigence, justification IA ; clé disparue → état « Unresolved » sans note), contestation du candidat (note IA, note propre, écart, argumentaire, écart moyen serveur) et évaluation complète **en lecture seule**. Aucun de ces écrans n'agit sur le score ni sur la décision.

**Revue admin du signalement (D75–D79, T-92→T-99)** : la liste `/admin/reports` devient une grille de cartes de dossier (contexte / scores réels / commentaire + `View`) et le dossier restyle ses **deux premières cartes** — le contexte du signalement, puis le critère relu dans le résultat épinglé (score, score de section, exigence, justification, **modèle**) avec un **vrai lien « Verify on candidate profile »** ; la carte 2 ne fabrique ni extrait de CV, ni confiance, ni pondération, ni note recruteur. Les cartes « Candidate contestation » et « Full AI assessment » restent inchangées. Sous le dossier, une **revue interne multi-admin** permet à chaque admin de donner **un seul avis final** (`Upheld` / `Not upheld`) avec une note et, si le signalement est confirmé, un score et une justification corrigés. La revue est **totalement aveugle** : aucun compteur, aucun avis d'autrui, même après enregistrement ; l'admin ne voit que son propre avis, en lecture seule. La liste `/admin/reports` affiche, sur chaque carte, le **statut de revue de l'admin courant** (`Pending` / `Upheld` / `Not upheld`) avant d'ouvrir le dossier (T-99) : ce statut est personnel, lu en un seul lot, et ne révèle ni l'existence ni le verdict d'un avis d'un autre admin. L'auteur du signalement ne peut pas reviewer son propre signalement, et un avis ne peut plus être modifié. Le serveur expose `canReview` (faux pour l'auteur, faux après un premier avis) : l'UI masque le formulaire et **explique** le cas « auto-review » au lieu d'afficher un bouton condamné. Un **409** (avis déjà déposé dans un autre onglet) déclenche une relecture du dossier : l'avis enregistré remplace le formulaire, l'erreur n'est pas conservée. Les avis sont conservés en base pour une future exploitation qualité / dataset ; **aucun export ni anonymisation n'est promis maintenant**. Détail : §14.18.

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

- **Gemini `gemini-3.1-flash-lite`** (D74 : 3.8 Flash écarté, quota free tier 20 req/j) via LangChain/LangGraph, structured output Pydantic, instance unique cachée, LangSmith, garde-fous (limite d'appels, un tour de réparation).
- **4 routes** : `GET /health`, `POST /cv/parse`, `POST /profile/normalize`, `POST /job-offer/normalize`. Prompts interdisant l'invention.
- **0** matching, **0** embeddings, **0** questions, **0** analyse d'offre (11 familles d'anomalies). `langchain-openai` déclaré mais jamais importé (dépendance morte — nettoyer ou garder pour les embeddings futurs).
- Embeddings (§8.4) : prévus pour le **screening / retrieval amont du matching** (D30–D31), **pas encore de choix technique** (fournisseur, modèle, dimension, pgvector : open points §8.4.12).

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
| — | Relance `FAILED` ou `analysisOutdated` acceptée sans changement ; no-op si `!dirty && !outdated && !failed`, avec `outdated = analysisOutdated && latest ∉ {PENDING, RUNNING}` ; seul `dirty` supersède une analyse en cours. |
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
| **D13** | **Cycle de vie offre : `DRAFT → VALIDATED → PUBLISHED → CLOSED`, validate ≠ publish.** `POST …/validate` = acte explicite qui déclenche la normalisation (miroir « Validate profile », D4) ; `POST …/publish` (exige `VALIDATED`) = publication, `published_at` ; `POST …/close` (depuis `VALIDATED` ou `PUBLISHED`) ; publication **planifiable** = évolution future (colonne déjà présente). Édition autorisée en `DRAFT`/`VALIDATED` (dirty-flag `hasUnvalidatedChanges` = `updated_at` vs `max(validated_at)`, miroir candidat — re-validation → nouvelle version de fiche) ; `PUBLISHED`/`CLOSED` = lecture seule — le rafraîchissement d'analyse d'une offre `PUBLISHED` (`POST …/revalidate`, D63) **n'est pas une édition de contenu** : ni statut, ni dates, ni contenu de l'offre ne changent (une nouvelle fiche normalisée peut être créée) ; `DELETE` = `DRAFT` seul. | §6.1, §6.2. |
| **D14** | **Vocabulaires d'offre = tables de référence** `contract_type` / `employment_type` (full-time / part-time) / `work_mode` (remote / hybrid / on-site), shape `(id, label UNIQUE)` miroir `degrees`, seed en migration dédiée, endpoints `/job-offers/reference/*`. Enums Java SMALLINT (pas de table) uniquement pour `status`, `seniority` (**junior/mid/senior/lead/principal = mêmes valeurs que le schema v2 IA**, symétrie matching), `requirement_type`, `salary_period`. `salary_type` (brut/net) **supprimé**. Localisation = `city VARCHAR(255)` + `country VARCHAR(2)` ISO, miroir `users` (pas de table geo). `published_at` conservée à côté de `validated_at` (les deux notions sont distinctes, D13). | §6.2, §15.3. |
| **D15** | **Normalisation d'offre : même machine que le profil candidat** — `normalized_profile` + association `normalized_profile_job_offer` (profil = candidat **XOR** offre) + colonne `source_type` (`CANDIDATE`/`OFFER`) sur `normalization_job` — ~~chaque worker ne réclame que son type~~ **révisée par D27 : worker unique branchant sur `source_type` après le claim** (le claim est par `jobId`, pas besoin de workers par type ; recovery / retries / executor réutilisés à l'identique). La `description` étant HTML sanitisé depuis D19, le worker **strip le HTML via jsoup** avant l'extraction IA (texte brut pour le LLM). | §6.1, §4. |
| **D16** | **Onboarding recruteur** : la bascule « Candidate \| Recruiter » change de layout et affiche un overlay « Switching to recruiter workspace… » pendant `GET /recruiters/me` ; 404 (pas recruteur) → **création auto du profil** (`POST /me`, l'information/consentement étant porté par le modal de bascule D17 — aucun écran d'essai intermédiaire) → recruteur sans company → page de setup ; sinon → espace offres. Un 409 (profil créé entre-temps) est absorbé par une invalidation → refetch. | §6.1, frontend. |
| **D17** | **Bascule de profil = modal de confirmation** : depuis le profil candidat, clic sur « Recruteur » ouvre un modal (message d'essai + bouton « Switch to recruiter », source unique partagée) **sans naviguer** ; confirmation → `/recruiter` (le workspace y crée le profil si 404), annulation/Échap → rester. Le retour Recruiter → Candidate navigue directement. Primitif unique `components/ui/dialog.tsx` (portal sur `document.body`, immunité aux ancêtres `backdrop-blur`/`transform`, Échap, verrou scroll, `dismissable`) réutilisé par la modale admin de revue — une seule implémentation de shell modal dans l'app. | §6.1, frontend. |
| **D18** | **Mode profil = source de vérité UI du chrome** : `stores/view-mode-store.ts` (Zustand persisté, clé `linqorbit.viewMode`, défaut `candidate`, état UI pur sans rôle backend — **préférence par utilisateur** : `byUser[userId]` enregistrée à chaque `setMode` sous le compte connecté, restaurée au login par `restoreForUser` via `use-auth.ts` — logout/relogin retrouve le mode choisi, un autre compte sur le même navigateur repart en candidat ; l'ancien format global v0 migre vers une map vide, valeur non attribuable abandonnée) lu par `useViewMode`, qui **force `recruiter` dès que la route est `/recruiter*`** (deep link sûr ; jamais l'inverse — le clic « Candidate » passe par le modal D17 puis la route suit). Chrome adaptatif en mode recruteur : **sidenav minimale** (Overview `/dashboard`, Offers `/recruiter`, Settings `/recruiter/settings` — sans Profile ni sections placeholders, Administration/télémétrie inchangées), **cartes dashboard `RECRUITER_STATS`** fictifs (mêmes titres de carte, même titre « Welcome back… »), **menu user enrichi** (headline du profil recruteur sous l'email via `useRecruiterProfile({ enabled: mode === "recruiter" })` + menuitem « Recruiter settings » → `/recruiter/settings`, visible uniquement en mode recruteur). La section « Recruiter profile » passe en **lecture par défaut** (miroir `CompaniesSection` : bouton `Edit` → formulaire RHF → `Save`/`Discard`). | frontend. |
| **D19** | **Description d'offre = HTML riche sanitisé** : éditeur Tiptap (`components/ui/rich-text-editor.tsx` — Bold/Italic/Underline, H2/H3, listes, Lien http(s), `immediatelyRender: false`) branché via `Controller` sur `description` ; le HTML **sanitisé au vol** (DOMPurify, profile `html`) dans la couche API (`lib/utils/sanitize-html.ts` + `htmlOrNull` : vide/`<p></p>` → `null`) — la base ne stocke jamais de HTML cru. Limite métier 20 000 caractères (FE `optionalText(20000)` + BE `@Size(max = 20000)` sur `description TEXT`, migration V14). Le worker de normalisation (D15, à venir) **strip le HTML via jsoup** avant extraction IA. | §15.3, frontend. |
| **D20** | **Duplication d'offre** : `POST …/{offerId}/duplicate` (membre de la company, tous statuts) — copie le contenu en une nouvelle offre **DRAFT** attribuée au duplicateur : titre suffixé « (copy) » (base tronquée pour tenir dans le VARCHAR(255)), `publicId` régénéré, slug recalculé, `expiresAt`/`validatedAt`/`publishedAt` à null ; enfants (skills/languages/degrees/studyFields) recopiés à l'identique (`copyChildren`, inserts seules, aucune revalidation vocabulaire — les FK viennent de la base). **Sans ConfirmDialog** (non destructif, brouillon supprimable d'un clic) ; après succès, navigation vers l'édition de la copie. | §6.1. |
| **D21** | **Complétude obligatoire d'une offre** : description (HTML strippé non vide), `country`, `employmentTypeId` et **≥ 1 skill** requis à la **création comme à l'édition** (miroir BE `@NotBlank`/`@NotNull`/`@Size(min = 1)` + FE `refineJobOffer` — jamais d'offre incomplète, retrofit naturel des brouillons legacy ; ville facultative). Boutons Validate/Publish `disabled` + `title` sur offre incomplète (`isOfferReadyToPublish`, filet côté liste) ; erreur racine `skills` affichée sous la liste du formulaire. | §6.1, frontend. |
| **D22** | **Fiche offre = deux groupes de skills** : `requiredSkills[]` (obligatoires) + `preferredSkills[]` (nice-to-have) partageant le même item `{name, category, level, levelSource, minYears, origin, evidence}` (primitives partagées avec le candidat : même taxonomie, même échelle 1–5, mêmes preuves par index). Tout est un skill ; poids et scores par groupe = chantier matching. | §6.2, §7. |
| **D23** | **`responsibilities[]` avec `importance: mandatory\|optional`** (§6.2) : chaque responsabilité minée porte son caractère central ou secondaire, avec `domain` et `technologies[]`. | §6.2. |
| **D24** | **Enums fermés miroir V12** : `contractType` permanent\|fixed_term\|freelance\|internship\|apprenticeship\|volunteer · `workTime` full_time\|part_time · `workMode` remote\|hybrid\|on_site (labels seedés, canonical snake_case côté IA). | §6.2. |
| **D25** | **Versionnage indépendant** : fiche offre `schemaVersion="1"` (le « 2 » candidat reflète son historique, pas une cible). | §18. |
| **D26** | **`normalization_job.source_type` SMALLINT** (`CANDIDATE(1)`/`OFFER(2)`, enum + converter) + table `normalized_profile_job_offer` (XOR candidat/offre, miroir `normalized_profile_candidate`) — V16. | §6.1, §15.3. |
| **D27** | **Worker unique** branchant sur `source_type` après le claim (snapshot et client IA dédiés par source ; claim/retries/recovery/DONE partagés). Pas de duplication, pas de compétition au claim, recovery unifié. | §4, §6.1. |
| **D28** | **Extraction profonde miroir candidat** : `requirementType` déclaré jamais reclassé (mandatory→required, preferred→preferred) ; seuls les skills inférés sont classés required/preferred d'après la formulation ; `evidence → responsibilities[index]` ou `[]` ; description HTML strippée via jsoup côté worker ; `validate` ne touche plus `updatedAt` (la validation n'est pas une édition — sinon dirty-flag faussé et doublon de version au double-clic). | §4.3, §6.2. |
| **D29** | **Statut des jobs en SMALLINT** (V17 : 1 = PENDING, 2 = RUNNING, 3 = DONE, 4 = FAILED, 5 = SUPERSEDED, enum + converter) — alignement de convention avec le reste du codebase, pas une optimisation (gain ~6 octets/ligne sur une table à faible volumétrie). | §4, §15.3. |

### 14.4 Screening sémantique / retrieval (2026-10-12)

| # | Décision | Portée |
|---|---|---|
| **D30** | **Chaîne Semantic Retrieval → Detailed Matching → Ranking** : le screening vectoriel (Top N, §8.4.7) s'exécute **en amont** du matching détaillé pour réduire l'espace de recherche ; il ne remplace ni ne pèse dans le matching. Le matching v1 est conçu **sans dépendre** du retrieval (ensemble de candidats fourni directement, §8.4.9). **Même modèle d'embedding / même espace vectoriel** pour les profils candidats et les profils d'offre. Les choix techniques (fournisseur, modèle, dimension, N, index, méthode JSON → texte) restent ouverts (§8.4.12). | §8.4. |
| **D31** | **Embeddings = signal de retrieval, jamais composante de score** : le ranking final repose sur les résultats du matching détaillé (§8.2), pas sur la similarité vectorielle. Révise le diagramme §8.1 (la « similarité sémantique » n'est plus un axe de calcul du score — l'axe sémantique reste porté par le LLM) et le phasage §17. | §8.1, §8.4.2. |
| **D32** | **Embeddings hors `normalized_profile`** : table dédiée `PROFILE_EMBEDDING` (profil, modèle, vecteur, date de génération, version/stratégie de représentation) — régénérer un embedding ou changer de modèle ne doit ni modifier ni perdre le profil normalisé. Shape exacte définie après le choix du modèle (§8.4.6) ; `CREATE EXTENSION vector` en migration dédiée. | §8.4.6, §15.3. |

### 14.5 Console admin (2026-10-13)

| # | Décision | Portée |
|---|---|---|
| **D33** | **Console admin = route group `(admin)` + `AdminSidebar`** : chrome séparé du dashboard (`app/(admin)/admin/layout.tsx` enveloppé `AuthGate` + `AdminSidebar` ; l'item **Administration du `DashboardSidebar` est conservé comme point d'entrée** (visible si `isAdmin`, lien `/admin`) — le chrome dédié (`AdminSidebar`, pas de top bar — la vue rend déjà breadcrumb + h1) ne prend le relais qu'une fois dans le route group). 5 endpoints `/api/v1/admin` (fiche détail compte, fiche normalisée candidat, liste globale offres filtrable par statut avec pagination, détail offre en format public sans gate published/expirée, fiche normalisée offre). **Contenu normalisé = pass-through `JsonNode`** backend + types TS miroirs (`types/normalized.ts`, tous optionnels — le contenu est produit par un LLM, la console tolère tout champ absent) rendu en **vues friendly** (jamais de JSON brut ; `content=null` → message selon `jobStatus`) ; enveloppe affichée (version, schemaVersion, validatedAt, jobStatus). Champs compte = ceux saisis par l'utilisateur — **jamais passwordHash**. Validation sans édition = no-op ; édition puis validation = version N+1 append-only (règles existantes, inchangées). | §3, §4, frontend. |

### 14.6 Pagination & infinite scroll (2026-10-14)

| # | Décision | Portée |
|---|---|---|
| **D34** | **Taille de page toujours décidée par le backend ; infinite scroll côté frontend.** `size` devient un paramètre **optionnel** sur `GET /api/v1/job-offers/mine` et `GET /api/v1/admin/job-offers` : le backend applique le défaut **20** et un clamp **[1..50]** (100 retiré), et renvoie la valeur effective dans l'enveloppe `{items, page, size, total}` — le frontend n'envoie jamais size, il lit la réponse. Les listes offres (admin + recruteur) passent en **infinite scroll** via un composant maison réutilisable `<InfiniteList>` (`components/ui/`, présentational, child injectable par `renderItem`, IntersectionObserver sans dépendance, fallback a11y « Load more ») piloté par `useInfiniteQuery` (TanStack) ; `signal` annulable + `staleTime` 30 s. Pagination **offset** (motif `Page` Spring existant) tant que le volume ne justifie pas un cursor keyset. | §3, §4, backend joboffer + admin, `docs/tasks.md`. |

### 14.7 Fiche conforme — extraction maximale (2026-10-14)

| # | Décision | Portée |
|---|---|---|
| **D35** | **Fiche offre v2 : poids 1-5 partout, exigences éducatives et certifications minées, provenance obligatoire.** `SCHEMA_VERSION="2"` (offre, versionnée indépendamment du candidat). Poids : échelle unique 1-5 sur `requiredSkills`/`preferredSkills` (`OfferSkillRequirement.weight`, toujours présent) et `responsibilities` (`NormalizedResponsibility.weight`, toujours miné — le snapshot n'a aucune responsabilité stockée) ; déclaré = verbatim du champ saisi, jamais recalculé ; inféré/absent = centralité du poste lue dans les textes (5 = pivot, 1-2 = mention accessoire). `minYears` déclaré jamais écrasé, déductible (`minYearsSource:"inferred"`) sur skill déclaré sans years ET sur skill inféré, seulement depuis un énoncé explicite. `required_years` total (déclaré = pass-through de `requiredExpYear`, jamais écrasé ; inféré = énoncé total uniquement, jamais « 5 years with Kubernetes ») + `required_degrees[]`/`required_study_fields[]` = `{label, source}` (labels du catalogue DB = déclarés/canoniques, minés = advisory). `certifications[]` minées quand nommées explicitement, jamais inventées. `origin` obligatoire sur les langues (`required` + CEFR, pas de poids). Snapshot enrichi de `degreeLabels`/`studyFieldLabels` via `buildForOffer` (repos déjà injectés). ~~Règle matching actée : `declared` = filtre dur, `inferred` = advisory~~ **révisée par D58 : une exigence inférée compte comme une déclarée** — le matcher lira `schemaVersion` et régénérera les vieilles fiches à la prochaine validation. | §6.2, §7, ai-service job_offer, backend miroirs, console admin. |
| **D36** | **Fiche candidat v3 : langues, diplômes et certifications deviennent minables avec provenance.** `SCHEMA_VERSION="3"`. `NormalizedLanguage {name, level CEFR, origin, evidence}` (pas de poids) ; `NormalizedDiploma`/`NormalizedCertification` + `origin` + `evidence` : un credential **nommé explicitement** dans un texte (bio, expérience, projet) crée une entrée `origin:"inferred"` avec preuve ; un détail non dit (« étudié l'informatique à la Sorbonne » ≠ diplôme) n'est jamais complété. Preuves : `source ∈ bio|experience|project|diploma|certification`, index 0-based, **null uniquement pour `bio`**. Expériences, projets et links **restent interdits** au minage. Vieilles fiches `schemaVersion:"2"` régénérées à la prochaine validation (le stockage est par fiche, pas global). | §4.3, ai-service normalize, console admin. |

### 14.8 Redesign des fiches normalisées (2026-10-14)

| # | Décision | Portée |
|---|---|---|
| **D37** | **Fiches normalisées : vues redesignées, une page dédiée par fiche, historique des versions.** Les vues friendly (`normalized-candidate-view`, `normalized-offer-view`) sont refondées sur l'inspiration `template/normalized_profile.html` — **maquette = inspiration visuelle uniquement** : chrome dashboard et widgets sans donnée réelle coupés (confiance, checksum, entropie, O*NET/ESCO, compensation, affinité matching, viewer JSON, toggle) ; grille 8/4 (corpus lettré A–G + rail de widgets réels : provenance declared/inferred, couverture des sections) — **retours UI 2026-10-17 : la grille 8/4 est remplacée — sections numérotées pleine largeur, widgets Provenance/Couverture en rangée basse deux colonnes égales (`md:`, empilés en dessous)** ; `SpecGrid` (cellules label mono + valeur, **cellules vides supprimées** — « — » réservé aux tableaux de données), titres « Profile overview »/« Offer overview », lettres fixées (`A. title` en un seul nœud de texte). Chaque fiche vit sur une **page dédiée** (`/admin/users/{userId}/sheet`, `/admin/offers/{offerId}/sheet` — route = `page.tsx`, jamais un fichier « sheet.tsx »), **pas inline ni modal** : bandeau d'identité réel (profileId tronqué, `v{n}`, schema, validatedAt, statut job) + actions **Copy JSON** (libellé « Copied » 2 s) / **Download JSON** (`normalized-profile-v{n}.json`) / **History** ; le JSON copié/téléchargé est le contenu de la **version affichée**. Historique : `GET …/normalized-profile/versions` (liste triée version desc, 404 miroirs) + panneau History sur la page dédiée (lignes `v · schema · date · statut`, sélection = affichage de cette version avec badge « Viewing v2 — current is v3 » + « Back to current » ; **pas de diff**). Sur les pages détail (compte, offre), la section inline est remplacée par une **carte CTA** (badge statut + « Open sheet » → page dédiée ; jamais validé → message sans lien ni retry). | §4, console admin : backend endpoints versions + frontend. |
| **D38** | **Console admin : profil candidat en lecture seule + offre source au look « fiche ».** La page détail compte affiche les sections du profil professionnel du candidat **en lecture identique à la vue du candidat** : `GET /api/v1/admin/users/{userId}/profile` (même shape `CandidateProfileResponse` que `GET …/candidates/me/profile`, 404 = compte inconnu **ou** sans profil candidat — miroir exact du endpoint candidat, réutilise `CandidateService.getProfile`) et réutilisation de `ProfileSections` extraite de `profile-view.tsx` (props `account` + `readOnly` : CTA d'édition masqués, ni jauge de complétion ni bannière de validation côté admin — pas de duplication). Le détail offre remplace `PublicJobArticle`/`toPublicJobArticleModel` par une vue **source** `AdminOfferSourceView` au look de l'ancienne `normalized-offer-view` : header bits **labels résolus** (`publicJobMetaLine`, salary inclus), description HTML **déjà sanitisée en base** (D19), skills avec `weight`/`years`/`requirementType` **de la BD** (sections Required/Preferred), langues, degrees/study fields — **jamais responsibilities/benefits** (non stockés : elles n'existent que dans la fiche normalisée, page dédiée). `normalized-skill-row.tsx` supprimé (orphelin depuis le redesign D37 ; la vue source porte ses propres lignes). `PublicJobArticle` reste utilisé par la fiche publique et la prévisualisation recruteur. | §3, §4, backend `AdminApi`/`AdminService`, frontend admin + candidate. |

### 14.9 Drawer de comparaison (2026-10-14)

| # | Décision | Portée |
|---|---|---|
| **D39** | **Fiches normalisées : drawer de comparaison non-modal, remplace les pages dédiées `…/sheet` (D37).** La fiche s'ouvre dans un **drawer latéral droit** depuis les **deux** pages détail (compte + offre) — remplacement total : les routes `…/sheet/page.tsx` et `normalized-sheet-view.tsx` sont supprimées (une seule façon de faire ; le corps `normalized-sheet-body.tsx` conserve **toutes** les opérations de l'ancienne page : Copy/Download JSON de la version affichée, History lazy, sélection de version, badge « Viewing v2 — current is v3 », « Back to current »). **Non-modal assumé** : portail, `role="dialog"` sans `aria-modal`, pas de backdrop ni de scroll-lock — la source derrière reste visible, scrollable et cliquable, **c'est la comparaison** ; Esc ferme, focus au montage + retour au déclencheur ; fermeture nettoie le paramètre via `router.replace` (pas d'entrée d'historique — Back quitte la page comme avant). **Deep-link `?sheet=open`** : refresh et lien partagé restaurent le drawer (état initial lu dans l'URL). Largeur **50 % du viewport bornée [560 px, 840 px]** sous `lg:` (`lg:w-[50vw] lg:min-w-[560px] lg:max-w-[840px]`), plein écran sous `lg` ; slide-in 180 ms (`@keyframes drawer-in`, soumis à la règle globale `prefers-reduced-motion`). Deux scrolls (source + drawer) explicitement acceptés — « tout visible sans scroll » refusé. CTA « Open sheet » = `CtaButton tone="secondary"` (bleu) sur les deux pages détail. **Source compactée pour la comparaison** : `ProfileSections` accepte `compact` (sections empilées dans une grille 2 colonnes en **container query** `@container` + `@2xl:grid-cols-2`, `items-start` ; `AboutSection` repli 1 colonne — les placements `lg:col-start-*` cassent à mi-largeur ; `/profile` inchangé, défaut `compact=false`) et `AdminOfferSourceView` passe en grille 2 colonnes (méta + description full-width) ; **racines des 2 pages détail** portent `lg:pr-[clamp(560px,50vw,840px)]` quand le drawer est ouvert (le contenu ne passe jamais dessous, fermé = pleine largeur). **Retours UI 2026-10-15** : CTA remonté en haut de page (candidat = entre l'en-tête et « Personal Information », offre = entre le h1 et la ligne company) ; arrondis `rounded-md` (6 px) sur `SpecGrid` et items — 2 crans sous la maquette, décision assumée — valeurs longues en `wrap` (`break-words`, pas de `truncate`) ; sections **numérotées** (`SectionBlock` pastille `ItemIndex` `w-7 h-7` fond blanc + chiffre `blue-deep`, titre nu, `tone`/point coloré supprimés) ; Copy/Download JSON en `CtaButton tone="neutral"` (unification CTA plateforme). | Console admin frontend (drawer, hook `use-sheet-query-param`, suppression routes dédiées, CTA), `ProfileSections`/`AdminOfferSourceView` compact. |
| **D40** | **Sidenav admin repliable (rail icônes).** `AdminSidebar` bascule entre rubriques étendues (`lg:w-64`) et **rail icônes** (`lg:w-20`) via un toggle compact **en haut à droite du conteneur logo** (`aria-label`/`title` « Collapse/Expand sidebar », chevron ; conteneur logo `rounded-xl px-2.5 py-2` sans bordure — distinct des nav links `rounded-full` bordés ; Logo + Wordmark `h-5`) ; en rail : labels des liens masqués (`aria-label` + `title` conservés), Wordmark masqué (logo seul), `UserMenu` en variante `compact` (bloc nom/email masqué, déclencheur `aria-label` inchangé). Padding du `main` suivi par `AdminShell` (client, enveloppé par le layout `(admin)` sous les gates) : `lg:pl-64` ↔ `lg:pl-20`. État persisté Zustand `stores/admin-sidebar-store.ts` (clé `linqorbit.adminSidebar`) — la préférence survit aux navigations. | Console admin frontend (chrome). |

### 14.10 Retours UI v3 — cartes partagées, comptes paginés, liste allégée (2026-10-15)

| # | Décision | Portée |
|---|---|---|
| **D41** | **Liste des offres du recruteur : payload léger, description uniquement au détail.** `GET /api/v1/job-offers/mine` sert `JobOfferListItem` — ni description, ni skills/langues/diplômes/domaines, ni chargement des catalogues par page (performance) ; le détail (`GET …/job-offers/{id}`, create, duplicate) reste complet. L'ancien gate d'UI `isOfferReadyToPublish(offer)` (qui lisait la description côté liste) devient `readyToPublish` **calculé serveur** (`description` présente, pays, employment type, ≥ 1 skill — même règle qu'avant) ; le front n'affiche plus que ce booléen (tooltip inchangé). `JobOfferPage.items` passe sur `JobOfferListItem` côté TS. | §6, backend joboffer (`JobOfferService.listMine`), frontend job-offer. |
| **D42** | **Carte d'offre unique partagée recruteur/admin.** Extraction de `features/job-offer/job-offer-card.tsx` (présentation pure pilotée par props : tuile, pill company, status pill à point, badges Expired/Analyzing…/Analysis failed/Unvalidated changes, « Created … », méta séniorité·lieu·mode·contrat·salaire, slot `actions` ; `OFFER_LINK_PILL_CLASS` exportée) ; `AdminJobOfferListItem` enrichi des mêmes signaux (séniorité, ville/pays, `contractTypeId`/`workModeId`, salaire, `hasUnvalidatedChanges`) pour que la console admin rende la **même carte** en lecture seule (D33/D38 : un unique CTA « View », aucun mutate), `normalizationJobStatus` mappé progress/failed, labels du vocabulaire résolus via `useContractTypes`/`useWorkModes` (endpoints de référence authentifiés — accessibles admin). | Console admin + recruteur (frontend), backend `AdminService.listJobOffers`. |
| **D43** | **Comptes admin : pagination D34 + signature de capacités.** `GET /api/v1/admin/users` renvoie l'enveloppe `{items, page, size, total}` (`AdminUserPageResponse` ; tri nom existant conservé, `PageSizes` comme D34 — le front n'envoie jamais la taille) et chaque compte porte `hasCandidateProfile`/`hasRecruiterProfile` (résolus par 2 requêtes batch `findByUserIdIn`, jamais N+1 — jamais de duplication d'identité : la capacité reste dans `candidates`/`recruiters`). Côté front : `useInfiniteAdminUsers` (même clé `admin.users`, invalidation après changement de statut conservée) + `InfiniteList` ; cartes enrichies (avatar initiales, pastille statut à point, badges Admin + chips Candidate/Recruiter) — console en lecture seule, bascule Activate/Deactivate inchangée. | Console admin (backend + frontend), §10. |

### 14.11 Retours UI v4 — recherche/filtres comptes, cohérence statut, polish (2026-10-15)

| # | Décision | Portée |
|---|---|---|
| **D44** | **Comptes admin — recherche + filtres (statut, capacité).** `GET /api/v1/admin/users` accepte `q` (prénom/nom/email, LIKE insensible à la casse, `trim` seulement), `status` (`active|inactive` insensible à la casse → `UserStatus` ; toute autre valeur → 400 « Unsupported status ») et `capability` (`candidate|recruiter` — **existence de profil** dans `candidates`/`recruiters` via EXISTS, jamais un rôle ; autre valeur → 400 « Unsupported capability filter »), combinables, une seule requête. Côté front : toolbar `AccountsSection` (recherche debouncée 300 ms + `SegmentedControl` statut + capacité), clé TanStack `admin.usersPage(filters)` (préfixe `admin.users` conservé pour l'invalidation des mutations), `placeholderData` sur changement de filtre, état vide filtré (« No accounts match these filters. »). | Console admin (backend + frontend), §10. |
| **D45** | **Console admin — cohérence et polish (retours UI v4).** *(1)* En-tête offres : breadcrumb conservé, une ligne h1 « Job offers » portant le **total global d'enregistrements** (`total` de l'enveloppe — jamais la taille de page) + filtre statut à droite ; la section n'est qu'une liste. *(2)* **Pastille de statut unique** : `OfferStatusPill` exportée de `job-offer-card.tsx` et adoptée par le détail offre (fin de `ADMIN_OFFER_STATUS_TONES`/`admin-offer-status.ts` ; `validated` redevient orange, cohérent avec la liste). *(3)* Carte sans company → libellé muted « No company ». *(4)* Busy **ciblé par ligne** (la ligne cliquée seule, via `variables.userId`), spinner uniforme des chargements (comptes/offres). *(5)* **Rejet de suggestion confirmé** par `ConfirmDialog` (danger, busy, fermeture sur settle). *(6)* Détail compte : bascule Activate/Deactivate **dans l'en-tête à côté des badges** (« Your account » sans action pour la ligne courante), breadcrumb à trois niveaux « Administration / Accounts / {nom} », pays lisibles (`countryLabel` partagé, map privée de `profile-view` supprimée) et `sex` labellisé (Male/Female/Other). Dates laissées en ISO côté admin (cohérent, « Created X ago » reste le motif de la carte). | Console admin (frontend), §10. |

### 14.12 Matching, candidatures, clarifications & embeddings (2026-10-16)

Conception validée après revue détaillée du brouillon utilisateur (schéma, intégrité, cycle de vie) — livraison par lots T-57→T-67, puis T-84→T-86 pour la clôture recruteur, **T-92→T-98 pour la revue admin (V26/V27)**, migrations **additives uniquement** (V18–V27 livrées, V28 planifiée ; V1–V17 et les données existantes intouchées, aucun reset).

| # | Décision | Portée |
|---|---|---|
| **D46** | **Pièces jointes (attachments) & CV.** `attachment(id, candidate_id → candidates ON DELETE CASCADE, original_name, mime_type, size_bytes > 0 CHECK, sha256, storage_path, created_at)` — propriétaire **candidat** (retraçable), `UNIQUE(candidate_id, id)` (cible de FK composite) ; stockage **disque local** (volume Docker, racine configurable, chemin relatif `candidates/{candidatId}/{attachmentId}`, **anciens CV conservés** — changer de CV ne fait que bouger le pointeur) ; endpoints sous `/api/v1/candidates/**` (déjà `authenticated`) : upload multipart (limites taille/mime), liste, téléchargement **streamé authentifié** (propriété vérifiée en service), changement de CV courant via **UPDATE bulk JPQL** (jamais via l'entité — piège `@UpdateTimestamp` de `Candidate`). `candidates.current_cv_attachment_id` : pointeur du CV courant, **FK simple** nullable `ON DELETE SET NULL` (le cycle candidates ↔ attachment interdit la composite — un `SET NULL` composite nullifierait aussi `id` ; déjà tranché). **CV obligatoire pour candidater** : `application.cv_attachment_id NOT NULL` épinglé par FK composite `(candidate_id, cv_attachment_id) → attachment(candidate_id, id) NO ACTION` (D49) — le CV soumis est protégé, un CV d'un autre candidat est impossible ; anciens CV toujours téléchargeables par leur propriétaire. | §2, §10, backend `attachment` (V18). |
| **D47** | **Questions du recruteur.** `job_offer_question(id, job_offer_id FK CASCADE — miroir `job_offer_skill`, label, question_type SMALLINT 1–5 CHECK, is_required, sort_order ≥ 0, created_at/updated_at ; UNIQUE(job_offer_id, id))` + `job_offer_question_option(id, question_id FK CASCADE, label, sort_order ≥ 0, preferred BOOL DEFAULT FALSE ; UNIQUE(question_id, id))`. Types : 1 TEXTE, 2 CHOIX_UNIQUE, 3 CHOIX_MULTIPLE, 4 OUI_NON, 5 NOMBRE — **5 types au MVP** ; les autres types du §10.1 sont documentés comme mappés (expérience → NOMBRE, langue → CHOIX_UNIQUE) ou reportés (date, localisation, autre), et le « critère associé » (§10.1) est **reporté** (colonne nullable plus tard, sans dette). `preferred` = **information recruteur seule** (« a choisi / n'a pas choisi le preferred »), aucun poids ni scoring. CRUD recruteur sous `job-offers` ; **éditables uniquement en DRAFT/VALIDATED, figées dès PUBLISHED/CLOSED** (même garde que le contenu d'offre — `JobOfferApi` l.78–85, 409) ; republication après expiration = statut seul, **aucune modification** ; duplication copie questions + options ; les questions ne sont **pas** incluses dans le snapshot de la fiche normalisée d'offre. | §10.1, backend `joboffer` (V19), formulaire d'offre. |
| **D48** | *(Immuabilité révisée par D59 : réponses remplaçables en brouillon, figées à la transmission.)* **Réponses de candidature : colonnes normalisées + chaîne FK composites (pas de JSONB).** Le **stockage** est éclaté (le JSON reste la forme des DTO API, jamais du stockage) : `application_answer(id, application_id, question_id, job_offer_id, answer_text, answer_number, answer_boolean, created_at)` — `CHECK num_nonnulls(answer_text, answer_number, answer_boolean) ≤ 1`, **pas d'`updated_at`** (réponses **immuables** — snapshot de soumission) ; choix simple/multiple → table fille `application_answer_option(application_answer_id, question_id, option_id)`, PK composite. Chaîne **inviolable en base** : `answer_option(question_id, option_id) → option(question_id, id)` ; `answer_option(application_answer_id, question_id) → answer(id, question_id)` ; `answer(job_offer_id, question_id) → question(job_offer_id, id)` ; `answer(job_offer_id, application_id) → application(job_offer_id, id)` → l'option soumise appartient par construction à la question, elle-même à l'offre de la candidature (un `optionId` d'une autre offre est impossible à insérer — la garantie que JSONB ne pouvait pas offrir). Cardinalité QCS = 1 / QCM ≥ 1 : **contrôlée en service** (la base ne lit pas `question_type`). Lecture : reconstruction `[{questionId, type, value}]` — TEXTE → `answer_text`, NOMBRE → `answer_number`, OUI_NON → `answer_boolean`, QCS → `{optionId, label, preferred}`, QCM → liste. Insertion **par étages** (`saveAndFlush` : application → réponses → sélections ; contraintes IMMEDIATE — l'ordre Hibernate n'est pas garanti entre types d'entités) + tests d'intégration PostgreSQL obligatoires. | §10.1, backend `application` (V20). |
| **D49** | *(Statuts, brouillon et fermeture du matching révisés par D59.)* **Candidature.** `application(id, candidate_id, job_offer_id, cv_attachment_id NOT NULL, matching_id NULL, status SMALLINT 1–4 CHECK, created_at, updated_at)` ; `UNIQUE(candidate_id, job_offer_id)` (**une candidature par couple**), `UNIQUE(job_offer_id, id)` (cible FK), `IX(job_offer_id, created_at)` (liste recruteur). FK composites : CV (D46) ; `(candidate_id, job_offer_id, matching_id) → matching(candidate_id, job_offer_id, id)` NO ACTION, nullable (MATCH SIMPLE) — **rempli par le serveur uniquement** à la soumission : le dernier matching du couple pour la fiche normalisée courante, jamais depuis le client ; il distingue « candidature avec évaluation » (version de fiche évaluée pinnée) de « candidature directe ». Statuts : SUBMITTED(1) → WITHDRAWN(2, retrait candidat, **terminal au MVP** — l'`UNIQUE` interdit la repostulation, à rouvrir plus tard si besoin) / ACCEPTED(3) / REJECTED(4) (décisions recruteur). Soumission = transaction **atomique** (toutes les questions obligatoires répondues — §10.1 ; CV courant présent sinon 409) ; pas de brouillon prévu → pas d'`applied_at` (`created_at` suffit). **Révisé par D65** : `application.submitted_at` immuable, posé au passage `DRAFT → SUBMITTED` (V24) ; `created_at` reste la création du brouillon et `updated_at` change encore sur les décisions, donc aucun des deux ne peut servir au tri de la vue recruteur. **L'accès candidat au matching est fermé dès qu'une candidature existe pour le couple** (y compris en consultation) ; le moteur reste utilisable côté recruteur. | §2, §10, backend `application` (V20), `SecurityConfig`. |
| **D50** | **Matching : identité versionnée par la fiche candidat.** `matching(id, candidate_id, job_offer_id, candidate_normalized_profile_id, assessment_finished_at NULL, created_at, updated_at)` : l'identité = **le couple + la version de fiche normalisée du candidat** — `UNIQUE(candidate_id, job_offer_id, candidate_normalized_profile_id)` + `UNIQUE(candidate_id, job_offer_id, id)` (cible de `application.matching_id`) + `IX(job_offer_id)`. Règle : fiche **inchangée** → on **reprend** le matching (score, réponses, clarifications — le candidat continue où il s'est arrêté) ; fiche **régénérée** → aucun matching pour la nouvelle identité → **matching recréé de zéro** (l'ancien reste en base, tracé, jamais repris). Préconditions service : fiche candidat `content IS NOT NULL`, offre PUBLISHED. `assessment_finished_at` : fin d'évaluation (plus de question possible — agent à sec, plafond atteint ou arrêt candidat), **condition de la contestation** (D54). | §8, §11.3, backend `matching` (V21). |
| **D51** | **Résultats versionnés + analyse asynchrone.** `matching_result(id, matching_id, version ≥ 1, schema_version VARCHAR(8) DEFAULT '1', result JSONB NULL, job_offer_normalized_profile_id, clarification_id NULL, created_at)` : `UNIQUE(matching_id, version)` (`created_at` ne trie pas de façon fiable des inserts même-seconde), `UNIQUE(matching_id, id)` (cible FK), `UNIQUE(clarification_id)` (une réponse → au plus une réévaluation), FK composite `(matching_id, clarification_id) → clarification(matching_id, id)` (D52). `result NULL` = **en cours ou échec** (miroir de `normalized_profile.content`) ; `schema_version` = contrat de compatibilité du JSON de score (comme les fiches normalisées). Chaque résultat enregistre **ses inputs** : fiche offre utilisée (`job_offer_normalized_profile_id` — utile si l'offre est republiée après expiration) ; la fiche candidat est portée par l'identité du matching (D50). Nouveau résultat = `version = max + 1` **sous verrou pessimiste** de la ligne `matching`. Analyse **asynchrone**, miroir exact de la normalisation : `matching_job` (shared PK `job_id ≡ matching_result_id` — la PK porte la FK, statuts, `attempts`, `next_attempt_at`, `error`, `started_at`, `completed_at`, `IX(status, next_attempt_at)`) — claim CAS, 2 retries, recovery au boot, événement après commit, MDC `correlationId` = jobId, pool dédié miroir `NormalizationExecutorConfig`. **Scores critères pondérés calculés backend** (l'appel IA `/matching/analyze` comprend/évalue le texte, le backend applique les poids — §7) ; le moteur ne dépend pas de pgvector (§8.4.9). | §7, §8, §11.3, backend `matching` (V21), ai-service. |
| **D52** | *(Implémentée par T-62, V22, 2026-10-18 : colonnes bornées `question VARCHAR(500)`, `answer VARCHAR(3000)`, `rationale VARCHAR(700)` au lieu de TEXT ; réponse **et** skip créent chacun une réévaluation (version + 1, `clarification_id` = la réponse, NULL pour un skip) ; le worker rejoue les évaluations précédentes sans poids et toutes les clarifications fermées dans l'ordre d'ajout, puis demande la question suivante — résultat, DONE et question OPEN suivante **ou** `assessment_finished_at` en une seule transaction.)* **Clarifications — Dynamic Candidate Assessment.** `clarification(id, matching_id, matching_result_id, question TEXT NOT NULL, answer TEXT NULL, rationale TEXT NULL, status SMALLINT 1–3 CHECK, created_at, answered_at NULL)` : `UNIQUE(matching_id, id)` (cible du `clarification_id` de résultat) ; FK composite `(matching_id, matching_result_id) → matching_result(matching_id, id)` ; **index partiel `UNIQUE(matching_id) WHERE status = 1`** (une seule clarification OPEN par matching). Statuts : OPEN(1) / ANSWERED(2) / SKIPPED(3) — le statut est **requis** (§10.2/§11.4 : questions toujours optionnelles ; `answer NULL` seul ne distinguerait pas « pas encore répondu » de « refusé »). Plafond **par matching** : `job_offer.max_clarification_questions INTEGER NOT NULL DEFAULT 3` (`CHECK 0–10`, V22). Deux options candidat : « **passer cette question** » → SKIPPED — **consomme un cran du plafond** (la génération IA a eu lieu) et l'agent peut reposer une question sur une autre lacune ; « **terminer l'évaluation** » → la clarification ouverte passe SKIPPED + `matching.assessment_finished_at` posé — idem quand l'agent n'a plus de question ou plafond atteint. Chaîne croisée = historique §11.3 exact par construction : `clarification.matching_result_id` = quel résultat a motivé la question ; `matching_result.clarification_id` = quelle réponse a déclenché la réévaluation. `rationale` = pourquoi la question (lacune identifiée ou question d'entretien préliminaire), affichable candidat et recruteur. | §10.2, §11.3/§11.4, backend `matching` (V22), ai-service (clarify/reeval). |
| **D53** | **Agent IA « recruteur chevronné » — révise §11.3.** Les questions IA ne sont **pas motivées par un feedback candidat** : l'agent analyse de façon autonome les deux fiches normalisées (candidat + offre), **repère les lacunes** et génère les questions les plus informatives. Mandat élargi : l'agent joue le rôle d'un **recruteur expérimenté** en entretien préliminaire — il pose les questions qu'un tel recruteur aurait posées (lacunes du parcours, points faibles, zones d'ombre), le recruteur récupère **des réponses aux questions qu'il aurait posées avant même l'entretien**, et le candidat peut **se défendre / s'expliquer** sur les points manquants ou faibles de son parcours avant d'être « attaqué ». Le diagramme §11.3 (feedback candidat → génération de question) est **révisé par cette décision** : la génération est une analyse IA indépendante ; la contestation du candidat est un mécanisme **séparé et terminal** (D54). Textes §11.3/§11.4 ajustés à la livraison (T-67). | §10.2, §11.3, §11.4, ai-service (mandat agent). |
| **D54** | *(Condition « aucune candidature » révisée par D59 : aucune candidature **transmise**. « Immuable » révisé par **D62** : modifiable jusqu'à la transmission, figée ensuite, `updated_at`.)* **Contestation candidat.** `matching_criterion_feedback(id, matching_id, matching_result_id, criterion_key, self_value 0–100 CHECK, comment TEXT NULL, created_at)` : `UNIQUE(matching_result_id, criterion_key)` (un feedback par item), FK composite `(matching_id, matching_result_id) → matching_result(matching_id, id)` NO ACTION ; `criterion_key` = clé **stable** des items du `result` (schéma figé au lot L4). Permise uniquement sur le **résultat final** : `assessment_finished_at NOT NULL` + aucune clarification OPEN + aucun job d'analyse en cours + **aucune candidature** pour le couple (l'accès matching est de toute façon fermé après postulation — D49) ; rattachée au dernier `matching_result`. **Immuable** (pas d'`updated_at`) ; **aucun recalcul IA ni modification des scores** — sinon la boucle clarification s'ouvrirait à l'infini et contredirait §11.2 ; c'est une argumentation par item (valeur propre en %, même échelle 0–100 que les scores, + commentaire), consultée par le recruteur quand la candidature référence ce matching. Le **marquage d'un critère par le recruteur** (§11.3) est **reporté** au MVP. | §11.2, §11.3, backend `matching` (V23), vue recruteur. |
| **D55** | **Embeddings : conservation multi-modèle + screening par version courante.** `CREATE EXTENSION IF NOT EXISTS vector` (**V28** — V24 réservé à T-66, V25 à T-86, **V26 à la revue admin** et **V27 aux triggers append-only T-98**) + `profile_embedding(id, normalized_profile_id FK NO ACTION, embedding vector(1536), model_name, model_version, strategy_version, created_at)` : `UNIQUE(normalized_profile_id, model_name, model_version, strategy_version)`. Les anciens embeddings sont **conservés** (rien n'est supprimé) ; au screening on ne joint que la **dernière fiche normalisée avec contenu de chaque candidat** + le **modèle/stratégie actifs** (constantes de config) — un vecteur d'une fiche périmée ou d'un autre modèle n'est jamais sélectionnable **par construction**. Modèle : `gemini-embedding-2`, **1536 dims** (MRL), **choix provisoire** — spike au lot (dimensions réelles + quotas free tier, repli `gemini-embedding-001` ; backfill throttlé si besoin) ; génération **via ai-service** (le backend n'appelle jamais Google directement), déclenchée à la validation de fiche. Index vectoriel **différé** (§8.4.6 : scan séquentiel tant que le volume ne le justifie pas). L'embedding sert uniquement au **retrieval amont** — le moteur de matching n'en dépend pas (§8.4.9). | §8.4 (D30–D32), backend + ai-service (V28). |
| **D56** | **Intégrité & suppression (transverse).** **FK composites** là où elles protègent des données **écrites par le client** (chaîne des réponses D48, CV épinglé + couple candidature↔matching D49, chaîne clarification↔résultat D51–D52) ; FK simples + contrôle service pour les liaisons écrites uniquement par le système. **Ordre d'insertion** : flush par étages (`saveAndFlush`, contraintes IMMEDIATE — échec immédiat à l'étage fautif) ; l'ordre Hibernate n'étant pas garanti entre types d'entités, **tout lot touchant ces chaînes exige un test d'intégration PostgreSQL réel** (règle racine). **Suppression** : brouillons/possessions = `ON DELETE CASCADE` (`attachment`, `job_offer_question`, `option` — miroir V3/V13) ; **enregistrements** (`application`, `matching`, `matching_result`, `clarification`, `matching_criterion_feedback`, `matching_criterion_report`, `matching_criterion_report_review`) = `NO ACTION` — aucune cascade silencieuse sur l'historique ; pointeur CV = `SET NULL` (D46). **Conventions** des nouvelles tables : singulier, préfixes `pk_/fk_/uq_/ck_/ix_`, `candidate_id`/`attachment_id`/`sort_order`/`question_type`/`created_at` (jamais `candidat_id`/`attachement_id`/`position`/`uploaded_at`). Migrations **additives uniquement** — V1–V17 et les données existantes **intouchées, aucun reset**. | §15, V18–V27 livrées (V28 planifiée), backend `AGENTS.md`. |
| **D57** | **Ops & sécurité.** Conteneur PostgreSQL recréé (T-57) avec une **image locale `linqorbit-postgres:17-pgvector`** : `FROM postgres:17` (Debian 13 trixie — la base exacte d'origine, glibc 2.41) + `vector.so`/scripts pgvector **0.8.7** copiés depuis `pgvector/pgvector:pg17` ; l'image officielle pgvector est basée bookworm (glibc 2.36) → **collation mismatch** avec la base créée en 2.41 (REINDEX/`REFRESH COLLATION` évités — sémantique des tris inchangée) ; même volume/PGDATA, aucune donnée déplacée ; `CREATE EXTENSION` portée par V28. `SecurityConfig` : `/api/v1/applications/**` et `/api/v1/matchings/**` → `authenticated` (le catch-all `.anyRequest().permitAll()` l.50 rend toute nouvelle racine **publique par défaut** — TD-037 ; règle des matchers explicites documentée dans `backend/AGENTS.md`). `ddl-auto: validate` (types exacts — un type JSONB/SMALLINT mal mappé doit échouer au boot). | infra, backend `config`, TD-037. |

### 14.13 Parcours de candidature & moteur de matching (2026-10-17)

Passe doc du lot T-61 (processus T-56 : décisions figées avant la première ligne de code). Maquettes de référence : `frontend/template/matching_screen_upper_drawer_{off,on}.html` — **inspiration uniquement**, rien sans donnée réelle (« Top 2 % », latence, recruteur nommé, gains « +2 % » par réponse sont écartés).

| # | Décision | Portée |
|---|---|---|
| **D58** | **Moteur de matching : la fiche offre est la référence, score par critère produit par le LLM, calcul backend, contexte rejoué.** *(1) Référence* — la fiche offre v2 est la grille : le backend en extrait les critères et la fiche candidat v3 est évaluée **contre elle, critère par critère** ; un critère présent chez le candidat est évalué de 0 à 100 ; un critère **absent de la fiche candidat vaut 0**. Une fiche ne montre que ce que le candidat possède : « absent » n'est jamais une absence prouvée, c'est une information manquante que les clarifications (T-62) peuvent lever — la distinction §8.2 est portée par la boucle de clarification, pas par un statut à part. *(2) Critères et sections* — clés stables `criterion_key` (contrat D54 : `skill:<slug>`, `language:<slug>`, `experience:total`, `education:requirement` (un **seul** critère pour toute la formation depuis D67 — dimension niveau de diplôme/credential et dimension domaine d'étude, valeurs d'une même dimension = alternatives ; remplace `degree:<slug>` et `study-field:<slug>`, les matchings déjà calculés gardent leurs anciennes clés), `certification:<slug>` ; slug ASCII minuscule, collision → suffixe `-2`), répartis en **cinq sections jamais mélangées** : compétences obligatoires (`requiredSkills`), compétences souhaitables (`preferredSkills`), langues, expérience, formation (diplômes, domaines d'étude, certifications). L'agent ne peut ni inventer ni omettre un critère : le backend refuse une réponse dont les clés ne couvrent pas exactement la liste envoyée (échec du job → retry). *(3) Déclaré = inféré* — **révise D35** : l'agent de normalisation n'infère rien sans texte qui le dit, une exigence inférée est donc réelle (le recruteur ne l'a simplement pas saisie) ; elle compte exactement comme une exigence déclarée. *(4) Poids* — compétences : le `weight` 1-5 de la fiche offre (toujours présent, schéma v2) ; tous les autres critères, langues comprises : **1**. *(5) Contrat IA* — `POST /matching/analyze` (D51 fait foi sur la mention `/ai/matching/analyze`) : par critère, `score` entier 0-100 et justification courte (preuves = index dans la fiche candidat) ; le LLM est le seul composant qui lit le texte et produit du calculable **hors formation** — notée en code depuis `education-2` (D68) —, il **ne calcule ni poids ni agrégat**. Consignes de précision obligatoires dans le prompt, notamment l'**expérience pertinente** : seules comptent les années d'expérience relevant du domaine et du rôle de l'offre, calculées sur les périodes concernées sans double compte des chevauchements — jamais `yearsOfExperience` (carrière totale) tel quel (11 ans dans l'informatique dont 3 en développement = 3 ans pour un poste de développeur). *(6) Calcul backend* — score de chaque section = **moyenne pondérée** de ses critères (absents à 0) ; aucune compensation entre sections (§7.1) ; aucun signal ni éviction (§12.1). *(7) Politique provisoire versionnée* — consignes de comparaison génériques isolées dans un module ai-service (`policyVersion`), barème isolé côté backend (`scoringVersion`) ; la politique définitive de l'utilisateur remplacera ces deux modules sans toucher au reste ; chaque `matching_result.result` enregistre les deux versions (`schema_version` = forme du JSON, D51). *(8) Contexte rejoué* — ai-service **sans état** (aucun checkpointer LangGraph, aucune persistance — règle V0) ; à chaque appel le backend envoie **tout** : les deux fiches, les critères, le dernier résultat avec ses scores et toutes les questions déjà posées avec leurs réponses ; en clarification (T-62), l'agent **rectifie ses scores** à partir des réponses et chaque rectification est une nouvelle version de résultat (D51) ; `matching_id` = `thread_id` **en métadonnée LangSmith seulement**. *(9) Plafond des questions IA* — `job_offer.max_clarification_questions` (D52) ; **le backend compte** les questions posées (passées comprises) et n'en demande plus au plafond — l'agent reçoit le nombre restant mais n'est jamais le seul garde-fou. *(10) Garde de schéma* — fiche candidat `schemaVersion` ≠ « 3 » ou offre ≠ « 2 » → 409 « revalider la fiche » ; versions centralisées et état `analysisOutdated` dérivé par **D63**. *(11) Ce que voit chacun — D5 tranché, révise §8.2 et §11.1* — le **candidat** voit toutes les sections et, dans chacune, le **score de chaque critère**, rien d'autre : ni poids, ni origine déclaré/inféré, ni score de section, ni justification ; la fiche normalisée brute reste non exposée (**Q7 maintenue**). Le **recruteur** (T-66) voit en plus les scores de section pondérés, les poids et les justifications. *(12) Suivi* — analyse asynchrone `matching_job` (D51, miroir `NormalizationWorker`) ; ~~frontend GET-driven~~ **révisé par D60 : push SSE**. | §7, §8, §11.1, ai-service `matching`, backend `matching` (V21), frontend `features/matching`. |
| **D59** | **Candidature en brouillon et parcours guidé — révise D48, D49, D54.** *(1) Statuts* — `DRAFT(1)`, `SUBMITTED(2)`, `WITHDRAWN(3)`, `ACCEPTED(4)`, `REJECTED(5)` : renumérotation **à coût nul** (table `application` vide, vérifié en base le 2026-10-17) et **dernière** — dès qu'une ligne existe, un code est figé ; aucune logique ne compare les codes. *(2) Parcours* — la page `/jobs/[job]/apply` devient le parcours : **questions du recruteur** (toutes sur un écran — fixes et indépendantes) → **matching facultatif** → clarifications IA **une par une** (T-62, D52 : chaque question dépend des réponses précédentes) → arbitrage par critère, score propre + commentaire (T-63, D54) → **transmission**. Seules les questions **obligatoires** du recruteur bloquent (§10.1, vérifiées serveur) ; ensuite la transmission directe reste possible à tout moment (`matching_id` NULL = candidature directe, D49). *(3) Brouillon* — la candidature naît en `DRAFT` à l'enregistrement des réponses ; une seule par couple quel que soit le statut (`UNIQUE` inchangé) ; réponses **remplaçables en DRAFT** (insertion par étages D48 conservée), **immuables dès la transmission** ; brouillons **invisibles du recruteur** (T-66). *(4) CV* — le CV courant est **renseigné dès la création** du brouillon, modifiable tant que `DRAFT`, **figé à la transmission** ; sans CV, le candidat peut répondre aux questions mais la transmission exige un CV (409 actuel) — `cv_attachment_id` nullable **en DRAFT uniquement** (CHECK). *(5) Abandon* — « Discard application » (`ConfirmDialog`) supprime le brouillon et ses réponses (cascade existante) — ce n'est pas encore un enregistrement ; le matching, rattaché au couple et à la version de fiche, est conservé et repris si le candidat recommence ; aucune expiration automatique (pas de tâche planifiée) ; offre fermée ou expirée pendant un brouillon : brouillon lisible, transmission en 409 (« This job offer is no longer available. ») ; le retrait reste réservé aux candidatures transmises. *(6) Étape calculée, jamais stockée* — le serveur dérive l'étape à chaque lecture du contexte de candidature : `RECRUITER_QUESTIONS` (pas de brouillon ou obligatoire manquante ; offre sans aucune question → directement `MATCHING`) → `MATCHING` (obligatoires répondues) → `SUBMITTED`, plus un booléen `canSubmit` et l'objet **`assessment`** (`matched`, `assessmentOpen`, `assessmentFinished`, `contested` — matching courant tant que la candidature n'est pas transmise, matching rattaché ensuite). **Le serveur expose 3 étapes** ; les **4 étapes visuelles** (Recruiter questions, AI clarifications, Candidate review, Summary & apply) sont dérivées côté frontend de l'étape et de `assessment` — ~~`CLARIFICATIONS` / `REVIEW` côté serveur~~ abandonnés à la livraison T-62/T-63 (2026-10-18). Un statut par étape est **refusé** : deux sources de vérité, et désynchronisation garantie — une revalidation du profil change la fiche, D50 recrée le matching de zéro et l'étape réelle recule, alors que les réponses au recruteur, rattachées à la candidature, restent. *(7) Accès au matching* — ouvert tant que la candidature est en `DRAFT` (obligatoires répondues), **fermé dès `SUBMITTED`** (révise D49 « dès qu'une candidature existe ») ; `matching_id` posé par le serveur **à la transmission** (dernier matching du couple pour la fiche courante) ; la contestation D54 exige « aucune candidature **transmise** ». La transmission reste possible **à tout moment côté API** (l'UI la masque pendant une évaluation ouverte, D69), y compris pendant une analyse : une analyse encore en vol peut alors insérer une clarification OPEN **après** la transmission — elle reste inatteignable (accès matching fermé, 409) et sans effet sur l'étape (`SUBMITTED`, l'indicateur marque les clarifications **Done si l'évaluation est close, sinon Skipped** — D69) ; nettoyage éventuel : TD-063. | §10.1, §12.2, backend `application` + `matching` (V21), frontend `features/application`. |
| **D60** | **Suivi du matching en push SSE (révise D58 (12)) — matching seulement.** Le candidat ne clique plus « Refresh » : `GET /api/v1/matchings/offer/{publicId}/events` (`text/event-stream`, `SseEmitter`) pousse un événement `status` `{matchingId, status}` à l'abonnement (statut courant — aucune course entre lecture et abonnement) puis à chaque transition **commitée** du job (`running`, `pending` au retry, `done`, `failed`), publiée par `MatchingWorker` **après** sa transaction et sans jamais faire échouer le job ; un statut terminal ferme le flux. **L'événement est un signal, le GET reste la source de vérité** : à réception, le frontend invalide le matching courant et relit le résultat par `GET /matchings/offer/{publicId}`. **Jeton en en-tête, jamais en URL** : `EventSource` ne sait pas envoyer `Authorization` et `RequestLoggingFilter` journalise la query string → le frontend ouvre le flux par `fetch` + `ReadableStream` (parseur SSE maison, aucune dépendance ; seule exception à l'instance axios unique, axios ne streamant pas côté navigateur), `Accept: text/event-stream, application/problem+json` pour que les refus 404/409 restent lisibles. Abonnement : l'emitter est **inscrit avant** la relecture du statut en base (aucune transition perdue entre lecture et abonnement) ; le worker ne publie que les transitions **réellement appliquées** (CAS = 1). Timeout serveur 120 s : flux clos proprement (aucune erreur levée), le frontend le rouvre tant que l'analyse continue ; sur coupure réseau ou erreur serveur il relit le matching puis reprend (≤ 5 essais à 1 s), sur refus 4xx il s'arrête, au démontage il annule. **Limite assumée** : registre des connexions en mémoire (`MatchingStatusBroadcaster`) — mono-instance tant qu'il n'y a pas de broker (Kafka/Redis interdits V0) ; un événement perdu est rattrapé par la reconnexion, qui renvoie le statut courant. Bandeau de validation du profil et badges d'offre **inchangés** à la livraison T-83 (GET-driven). **Révisé par D64** : le même modèle signal + GET est étendu aux bandeaux de normalisation candidat/offre ; D60 reste la référence pour le matching. | §8, backend `matching` (broadcaster, worker, API), frontend `lib/api/matching.api.ts`, `hooks/use-matching.ts`, `features/matching`. |
| **D61** | **Barème `skills-3` + rationale interne + règle de preuve (T-62, remplace la politique provisoire `generic-1` pour les compétences).** *(Remplacée par D67/D68 pour la formation — critère conjoint, noté en code depuis `education-2` ; les bandes skills sont inchangées.)* *(Version courante **`skills-3`** (2026-10-19). Les bandes ci-dessous sont celles de `skills-1`, **inchangées** ; seules deux versions ont précisé leur application. `skills-2` (2026-10-19) : un niveau présent sur la fiche candidat est une mesure connue même si l'offre n'en fixe aucune et qu'aucun usage n'est prouvé — bande « niveau connu » ; « mention seule » seulement si le niveau est inconnu. `skills-3` (2026-10-19) : (1) une **clarification répondue prouve l'usage** (→ 60) — une réponse qui n'énonce aucun niveau ne prouve pas de niveau ; (2) une **technologie voisine prouvée par l'usage n'est jamais notée 0** — le skill exact peut être absent de la fiche, la bande 40–50 s'applique. L'agent de matching est échantillonné à **température 0.0** (les autres agents gardent le défaut du fournisseur). Jeu d'essai réel versionné (TD-058) : sous `skills-2`, 3 passages le 2026-10-18 (UTC 23:50, 23:50, 23:51, `gemini-3.1-flash-lite`, température par défaut) : **7/9, 7/9, 8/9** — Redis (cas 8) **85 à chaque passage**, cas 9 (réponse de clarification, attendu 60) **100 à chaque passage**, cas 5 (voisine MySQL, attendu 40–50) **0 deux fois sur trois** ; sorties datées dans `ai-service/scripts/golden/results/` ; sous **`skills-3` à température 0.0** : 3 premières tentatives (2026-10-19) avortées sans score (cas 5 noté > 0 sans preuve, `StructuredOutputValidationError` non rattrapée → 500) ; après le tour de réparation des sorties rejetées par le schéma, **3 passages complets le 2026-10-19 (UTC 00:51:15, 00:51:58, 00:52:10, `gemini-3.1-flash-lite`, température 0.0) : 9/9, 9/9, 9/9** (`matching-golden-20261019T005115571812Z.json`, `…005158787142Z.json`, `…005210187678Z.json`) — cas 5 → 40 (preuve `skill[4]`, MySQL), cas 8 Redis → 85, cas 9 → 60 (preuve `clarification[0]`). À chaque passage, le premier appel du tour 1 est rejeté par le schéma (une évaluation) et le tour de réparation le rattrape : le 9/9 dépend de ce tour — **3 × 9/9 atteint**. Règle de preuve aussi contrôlée côté backend (`MatchingScoring` rejette score 0 avec preuve et score > 0 sans preuve → retry). Côté ai-service, une sortie **rejetée par le schéma** (score > 0 sans preuve, plusieurs sorties structurées) a droit au **tour de réparation unique** (erreurs exactes, sans rejouer le message invalide) ; toujours rejetée → **502** `no_output`, jamais 500. Le script du jeu d'essai écrit un rapport daté pour chaque passage, `ERROR` compris. Aucun changement de `POLICY_VERSION` pour ce comportement.)* Compétence `skill:<slug>` : absente → 0 sans preuve ; attente chiffrée — niveau (écart candidat − attendu : ≥ 0 → 100, −1 → 75, −2 → 50, ≤ −3 → 25) et/ou années (ratio : ≥ 1 → 100, [0,66 ; 1[ → 80, [0,33 ; 0,66[ → 55, < 0,33 → 30), **minimum** des deux quand les deux s'appliquent, une mesure absente d'un côté est ignorée, attente de 0 année = pas d'exigence ; aucune table applicable → niveau connu (5 : 100, 4 : 85, 3 : 70, 2 : 55, 1 : 40), usage prouvé sans niveau → 60, mention seule → 35 ; synonymes = le skill ; techno voisine de même famille prouvée par un usage → 40–50 au plus (Java ≠ JavaScript, C# ≠ C++) ; jamais de déduction depuis l'intitulé, la société, la séniorité ou la durée de carrière. Langues / expérience : règles génériques conservées (la formation est le critère conjoint noté en code, D67/D68). **Rationale** : interne (recruteur T-66 et QA, **jamais le candidat**), 1–2 phrases factuelles en anglais nommant la contrainte décisive. **Preuve** : score 0 ⇒ aucune, score > 0 ⇒ au moins une ; pointeur 0-based dans la fiche candidat (`bio` sans index) ou dans les clarifications de la requête (`source: "clarification"`, réponse `answered` uniquement). Textes de prompt fixés à l'identique (`matching_policy.py`, `matching_agent.py`, `matching_clarify_agent.py`). Les résultats antérieurs incohérents avec la règle de preuve ne sont pas rejoués à l'agent. | §7, §11.3, ai-service `matching_*`, backend `MatchingWorker`. |
| **D62** | **Contestation modifiable jusqu'à la transmission — révise D54 (T-63).** `matching_criterion_feedback` gagne `updated_at` ; `PUT /matchings/offer/{publicId}/feedback` = **remplacement complet** (items absents supprimés, liste vide = tout effacer, `created_at` conservé), `self_value` 0–100 obligatoire, commentaire texte ≤ 2 000 caractères (trimé, vide → absent), clé dupliquée ou inconnue du dernier résultat → 400. Préconditions 409 : évaluation close, aucune clarification OPEN, aucun job PENDING/RUNNING, aucune candidature du couple hors DRAFT (WITHDRAWN compris) — **figée dès la transmission**. **Aucun recalcul** : jamais de modification du résultat, des scores, des sections ni de la moyenne ; le recruteur verra les deux (T-66). Rattachée au **dernier** résultat avec contenu ; une fiche candidat régénérée crée un nouveau matching (D50) → contestation vide, rien n'est transféré. Pas de pièce jointe, pas d'historique des éditions. | §11.2, backend `matching` (V23), frontend « Your assessment ». |

### 14.14 Clôture recruteur, versions de schéma et signalement IA (2026-10-19)

Décisions prises après l'audit de la fiche obsolète et le cadrage de la vue recruteur. **T-66 ne dépend plus de T-65** : le screening pgvector reste un lot séparé ; T-66 dépend de T-63 (livré). T-84 et T-85 sont des préalables de robustesse, T-86 suit T-66.

| # | Décision | Portée |
|---|---|---|
| **D63** | **Version de schéma : une source backend, deux versions distinctes.** Une classe unique `NormalizedProfileSchemaVersions` porte `CANDIDATE = "3"` et `OFFER = "2"` ; `NormalizationService`, `JobOfferNormalizationService`, `MatchingService` et le worker de normalisation la consomment — fin des constantes dupliquées. Les deux versions ne sont **jamais comparées entre elles** : chaque fiche est comparée à **sa** version attendue. La fiche de référence est la dernière `normalized_profile` avec `content IS NOT NULL` ; son `schema_version` différent de la constante courante produit `analysisOutdated = true` sur `GET …/profile` et le détail/liste d'offre. La validation relance si `dirty || (analysisOutdated && latest ∉ {PENDING, RUNNING}) || failed` : le bouton/badge « Validate again » apparaît même sans modification du profil, hors analyse déjà en cours ; seul `dirty` déclenche une nouvelle version pendant une analyse en cours (PENDING supersédé, RUNNING se termine). Le 409 du matching reste le filet de sécurité. **Offre `PUBLISHED`** (complément T-84, 2026-10-19) : `POST /api/v1/job-offers/{offerId}/revalidate` (owner ou créateur, `PUBLISHED` uniquement, 409 sinon) rafraîchit l'analyse **sans changer le cycle de vie** — ni `status`, ni `publishedAt`, ni `validatedAt`, ni `updatedAt` — en réutilisant la même normalisation que `validate` ; le dirty-flag n'y compte pas (D13 : `publish` pose `updated_at` après la validation, l'offre serait sinon toujours « sale »), seuls `analysisOutdated` et `failed` relancent, no-op 204 sinon (fiche à jour, analyse en cours). `DRAFT`/`VALIDATED` restent sur `POST …/validate`. Sur la **carte de liste** : badge « Analysis outdated » sur draft, validated et published — jamais closed ; action « Validate » primaire sur draft, « Validate again » dans le menu ⋯ sur une offre validée (obsolète, en échec ou modifiée) et sur une offre publiée (obsolète ou en échec) (`revalidate` sur published) ; la preview/détail est suivie par T-87. Invariant : une offre `PUBLISHED` possède une fiche de référence (créée à `validate`). Son absence (legacy/corruption) n'est ni `analysisOutdated` ni `failed` : `/revalidate` est un no-op 204 ; état non réparable par l'endpoint actuel — suivi T-88. Le worker vérifie d'abord le `schema_version` de la ligne `normalized_profile` stockée (posé à la validation ; différent de la version courante → échec avant tout appel IA), puis le `schemaVersion` du JSON IA, **avant toute écriture de `content`** : absent ou différent → job en échec/retry, aucune ligne incohérente. Pas de migration. Le service IA garde ses constantes (frontière de langage) ; le backend est la source de vérité et refuse toute réponse divergente. | §4, §8, §12, backend `candidate` + `joboffer` + `matching`, frontend bandeaux ; **T-84**. |
| **D64** | **SSE de normalisation — extension de D60 aux bandeaux candidat/offre.** `GET /api/v1/candidates/me/profile/normalization/events` et `GET /api/v1/job-offers/{offerId}/normalization/events` (`text/event-stream`, `SseEmitter`) poussent un **signal** `{status}` ; le GET reste la source de vérité et le frontend invalide/relit à réception. Statut courant envoyé à l'abonnement, transitions publiées **après commit** (PENDING, RUNNING, DONE, FAILED ; SUPERSEDED provoque une relecture), statut terminal → fermeture, timeout 120 s + reconnexion. Jeton en en-tête via `fetch` + `ReadableStream`, jamais `EventSource`. Le flux est ouvert **par ressource** (profil candidat, offre) et seulement pendant `normalizationInProgress` ; sur la liste d'offres, ne pas ouvrir un flux par carte sans nécessité — un flux agrégé utilisateur pourra venir plus tard. Registre en mémoire, mono-instance, même limite assumée que D60 ; une publication SSE ne fait jamais échouer le job. | §4, backend `candidate` + `joboffer`, frontend hooks ; **T-85**. |
| **D65** | **Vue recruteur T-66 — V24, statuts, tris et représentation.** `application.submitted_at` immuable, posé au passage `DRAFT → SUBMITTED` (V24, backfill des lignes non-brouillon, index `(job_offer_id, status, submitted_at, id)`) ; `created_at` reste la création du brouillon et `updated_at` bouge aux décisions. Liste par défaut `SUBMITTED`, onglets/filtre `ACCEPTED`/`REJECTED`, `WITHDRAWN` conservé en base pour les statistiques mais invisible ; brouillons invisibles. Tri date de candidature croissante par défaut, puis **score de section** asc/desc (nulls last) et **contestations** : nombre de critères contestés, puis écart moyen absolu, puis date. La carte affiche les **cinq scores de section** en lignes compactes, barres horizontales **bleues** + valeur colorée par bande (vert ≥ 70, orange 40–69, gris < 40) — aide au scan, jamais de note globale, de radar ou de décision automatique ; section absente = « Not evaluated », candidature directe = « No AI assessment ». L'identité expose aussi l'**intitulé du poste actuel** (`Candidate.title`, masqué si absent) ; filtre + tri tiennent sur une ligne et le panneau contestations est orange pâle / **gris neutre** avec compteur et écart moyen sur une ligne. Le détail montre les réponses recruteur (`preferred`), les paires Q/R IA, la **justification IA par critère** (le score de section est une moyenne pondérée, sans rationale de section), les contestations, le CV épinglé en streaming authentifié. `ACCEPTED`/`REJECTED` sont des décisions **manuelles, recruteur uniquement, terminales**, sans recalcul IA ; l'application utilise le matching et le CV **épinglés** à la transmission (`matching_id` peut être NULL). T-66 dépend de T-63, pas de T-65 ; T-64 (embeddings) passe en **V28** (V26 attribué à la revue admin et V27 aux triggers append-only T-98 le 2026-10-23). | §11.1, §12.1, backend `application` + `matching`, frontend recruteur ; **T-66**. |
| **D66** | **Signalement interne d'une évaluation IA — hors T-66.** Bouton **par critère** dans le détail recruteur : motif (score incorrect, preuve erronée, profil mal compris, exigence mal comprise, autre) + commentaire, rattaché au **`matching_result_id` exact** et à la `criterion_key`. Table dédiée `matching_criterion_report` (V25) avec auteur, `created_at`, unicité par résultat/critère/auteur, FK NO ACTION. **Aucun effet sur le score, aucune réévaluation, aucune visibilité candidat** ; consultation par l'auteur et l'équipe interne/QA. C'est un retour qualité pour améliorer le service, distinct du marquage recruteur générique (§11.3, toujours reporté) et de la contestation candidat (D62). **Livré (T-86, 2026-10-22)** : le **résultat affiché est résolu par le serveur** (le client n'envoie que la clé du critère, relue dans le JSON du résultat épinglé — 400 si la clé n'y est pas) ; le **signalement est immuable** (pas d'`updated_at`, pas d'édition : unicité en base, doublon → 409, et le dialogue l'annonce) ; le **commentaire est obligatoire pour le seul motif « autre »** (seul motif qui ne dit rien par lui-même) et facultatif ailleurs, contrôlé côté serveur **et** par un `CHECK` en base ; le détail n'expose que les signalements **de son auteur** ; la **console d'administration** en liste les signalements (auteur, offre, company, candidat, critère résolu dans le résultat épinglé, motif, commentaire, date) sous le rôle ADMIN. **Révision UI (2026-10-22)** : le critère signalé **garde la carte standard** (aucun rail, aucun fond teinté) ; le seul ajout est un **encart de relecture très discret en pied** (ligne orange `Reported · motif · date`, fond pâle, rayon réduit, pas de pastille), et l'en-tête de section affiche `⚑ N reported` (somme des signalements de l'auteur dans la section, même candidature ; l'agrégat inter-candidatures est écarté : sémantiquement faux et risque d'ancrage). Le **dossier admin** `GET /api/v1/admin/criterion-reports/{id}` relit le résultat épinglé et expose le critère (score, score de section, exigence, justification, `resolved`), l'évaluation complète, les contestations et `averageGap` ; page `/admin/reports/{id}`. | §11.3, §12.1, backend `matching`, frontend recruteur ; **T-86**, après T-66. |

### 14.15 Formation : critère conjoint, barème `education-1` puis formation notée en code `education-2` (2026-10-20)

| # | Décision | Portée |
|---|---|---|
| **D67** | **Formation = un seul critère `education:requirement`, barème déterministe `education-1`.** *(Implémentation révisée par D68 ; les bandes et le critère joint restent la référence.)* Le backend (`MatchingCriteriaBuilder.addEducation`) remplace les critères séparés `degree:<slug>` / `study-field:<slug>` par **un** critère `education:requirement` (label « Education », poids 1, section `education`) dont l'attente liste jusqu'à trois parties jointes par « ; » — « Degree level (one of, or above): … », « Credential (one of): … » (« Professional certificate », jamais un niveau), « Field of study (one of): … » — labels dédupliqués (casse, espaces), aucune partie → aucun critère ; les certifications restent des critères `certification:<slug>` séparés. Côté IA (`POLICY_VERSION = "education-1"`, bandes skills/langues/expérience inchangées) : seuls les diplômes **obtenus** comptent (`endDate` non nulle), chaque diplôme est noté sur les dimensions demandées et le **meilleur** est retenu (jamais de moyenne ni de mélange de deux diplômes) ; niveau requis = le plus bas listé : atteint ou dépassé → 100, un niveau en dessous → 65, deux → 35, trois ou plus → 0, niveau inconnu → 50 ; Professional certificate = credential (100 s'il est détenu et listé, 0 sinon, jamais un niveau) ; domaine exact → 100, proche → 75, inconnu → 50, éloigné → 25 ; note du diplôme = **minimum** des dimensions demandées ; aucun diplôme obtenu → 0 sans preuve ; preuve = le diplôme retenu (`diploma`, index) ; jamais d'inférence depuis le titre, la séniorité, la bio, les certifications ou l'expérience. Aucun schéma, aucune migration, aucun backfill, aucun changement de `weighted-1`, des DTOs, des endpoints ni du frontend. Golden set éducation versionné (`ai-service/scripts/golden/matching_education_cases.json`, 10 scénarios, runner `matching_golden_set.py education`). Jeu d'essai réel (2026-10-20, `gemini-3.1-flash-lite`, température 0.0, `education-1`) : **non atteint**. Skills (`matching-golden-skills-20261020T182657906726Z.json`, `…182717567973Z.json`, `…182741735839Z.json`) : **6/9, 6/9, 6/9** — régression des bandes skills pourtant inchangées : cas 1 (niveau −1) 50 au lieu de 75, cas 2 (niveau −2) 25 au lieu de 50 (l'écart est bien calculé, la valeur de bande est décalée d'un cran), cas 8 (Redis niveau 4, offre muette) 100 au lieu de 85. Éducation (`matching-golden-education-20261020T183031630635Z.json`) : **7/10** — cas 4 (Associate, deux niveaux sous Master) 65 au lieu de 35 (compté « one level below »), cas 5 (Master, domaine éloigné) 65 au lieu de 25 (plafond du domaine non appliqué), cas 10 (Professional certificate face à un niveau Master) 25 au lieu de 0 ; les passages 2 et 3 (`…183125922052Z.json`, `…183307852853Z.json`) se sont arrêtés sur une indisponibilité du fournisseur (503 UNAVAILABLE) aux scénarios 6 et 3, après avoir reproduit les échecs 4 et 5 pour le second. Aucune attente modifiée ; pas de passage supplémentaire. | §7, §19, backend `matching`, ai-service `matching_policy` + golden set. |
| **D68** | **Formation notée en code (`education-2`), certifications restaurées.** `education-1` (bandes éducation dans le prompt, D67) n'a **jamais été validée ni commitée** : le bloc chiffré dégradait l'application des bandes skills par `gemini-3.1-flash-lite` (skills 6/9 aux 3 passages) et le modèle appliquait mal les bandes éducation (7/10) ; un contrôle à `HEAD` (`skills-3`, worktree propre, 2026-10-20) donnait 9/9 — la régression venait bien du bloc éducation, pas du fournisseur. Décision : **(1)** le backend envoie l'exigence structurée avec le critère conjoint (`MatchingEducation` → `education: {degreeLevels, credentials, fields}` sur `education:requirement`, `null` partout ailleurs, certifications comprises) ; **(2)** le service IA note `education:requirement` **en code** (`score_education`, bandes D67 inchangées : diplômes obtenus seuls (`endDate` non vide), niveau requis = le plus bas listé (rangs `DEGREE_RANKS`), atteint ou dépassé 100, −1 → 65, −2 → 35, −3 et plus → 0, label de diplôme absent ou inconnu → 50, niveau exigé non reconnu → 50 ; « Professional certificate » = credential (100 détenu et listé, 0 sinon, jamais un niveau, un diplôme supérieur ne le remplace jamais ; niveau et credential = alternatives d'une même dimension, la meilleure compte) ; domaine exact (casse, apostrophes, espaces, ponctuation normalisés) 100, même famille (`FIELD_FAMILIES` : computing, finance, management) 75, absent 50, éloigné ou non reconnu 25 ; note d'un diplôme = minimum des dimensions demandées ; meilleur diplôme, puis rang, puis `endDate` la plus récente, puis premier index ; preuve = le diplôme retenu, aucune à 0 ; données malformées = absentes, jamais d'exception ; justification factuelle en anglais nommant la contrainte décisive) — ce critère n'est **jamais envoyé au modèle ni réparé** : le modèle ne voit que les autres critères et leurs évaluations précédentes, sans critère restant aucun agent n'est construit, la couverture fusionnée est vérifiée sur toute la requête ; **(3)** `POLICY_RULES` ne contient plus aucune règle de formation, les blocs Skills, Languages et Experience sont **mot pour mot** ceux de `skills-3`, et un bloc **Certifications** complet restaure la règle perdue par `education-1` (même certification ou vrai synonyme 100, proche 40–50 jamais une correspondance pleine, autre ou aucune 0 sans preuve, une clarification répondue est une déclaration valide mais ne promeut jamais une certification proche, un diplôme ne remplace jamais une certification) ; **(4)** la formation ne se clarifie plus : le worker retire le critère et son évaluation de la requête de clarification (sans autre critère, l'évaluation se clôt sans appel IA) et le prompt de clarification n'en parle plus. Aucune migration, aucun DTO public, aucun frontend, `weighted-1` inchangé. Golden sets (2026-10-20, `gemini-3.1-flash-lite`, température 0.0, `education-2`) : **skills 9/9 ×3** (`matching-golden-skills-20261020T205830675790Z.json`, `…205842164859Z.json`, `…205857186920Z.json`), **éducation 10/10 ×3, déterministe, sans appel au modèle** (`matching-golden-education-20261020T205811776934Z.json`, `…205813882598Z.json`, `…205816546954Z.json`), **certifications 3/3 ×3** (`matching-golden-certifications-20261020T205922243889Z.json`, `…205947597264Z.json`, `…210015859659Z.json` — 100, 50, 0). **Test-first du 2026-10-20 (scénario 4 : certification déclarée par une clarification répondue)** : **4/4 ×3** (`matching-golden-certifications-20261020T212521881811Z.json`, `…213246475557Z.json`, `…213320703457Z.json`) — le bloc Certifications reste volontairement ambigu (« only source » de la fiche vs clarification répondue comme déclaration valide) ; le modèle a suivi la clarification, l'ambiguïté est documentée et couverte par le scénario (TD-065). Le schéma refuse par ailleurs une valeur de dimension vide et un critère `education:requirement` hors section `education` (422, jamais un score silencieux). | §7, §19, backend `matching`, ai-service `matching_policy` + `matching_analyze` + golden sets. |

### 14.16 Refonte du parcours de candidature — évaluation ouverte et clarification centrale (2026-10-20)

Décision d'écran après la livraison T-62/T-63 : l'évaluation IA devient le contenu principal tant qu'elle est ouverte ; la transmission n'est plus proposée avant sa clôture. **Aucune migration, aucun nouvel endpoint, aucune nouvelle garde 409** — les préconditions serveur existantes (D59) restent seules juges. **D70** compacte par ailleurs la liste « My applications » sans nouvelle donnée ni fonctionnalité.

| # | Décision | Portée |
|---|---|---|
| **D69** | **Le parcours suit l'évaluation ouverte (`assessmentOpen`) ; la transmission attend côté UI.** *(1) Contexte* — `ApplicationAssessmentView` gagne `assessmentOpen = matched && assessmentFinishedAt == null` : faux sans matching, faux pour une candidature transmise sans matching rattaché ; le frontend en porte le miroir. *(2) Sans matching* — « AI clarifications » et « Candidate review » sont **Not required** dans un brouillon (**Skipped** reste réservé à une candidature transmise sans ces étapes), « Summary & apply » est **courante** : le matching reste facultatif (D59) et l'absence de matching n'est pas une évaluation à faire. *(3) Évaluation ouverte* — `ApplyView` masque `SubmitPanel` et `AnswersRecap` et affiche `AssessmentFocus` dans la colonne principale : chargement pendant `pending`/`running`, échec de l'analyse (relance dans `MatchingPanel`, qui ne garde que les scores), puis `ClarificationPanel` (question ouverte ou clôture à demander). `AssessmentReview` n'apparaît qu'une fois l'évaluation close, avant la transmission. *(4) Relance* — `useStartMatching` relit le contexte du parcours : lancer le match bascule immédiatement vers l'évaluation ouverte. *(5) Portée* — **gating UI seulement** : la transmission directe reste possible par l'API, les gardes serveur existantes (préconditions, CV, offre) restent seules juges ; une candidature transmise dont l'évaluation est encore ouverte marque ses clarifications **Skipped** — Done seulement si l'évaluation est effectivement close. | §10.1, §11.3, backend `application`, frontend `features/application` + `features/matching`. |
| **D70** | **« My applications » — cartes compactes, réponses repliables, aucune donnée fictive.** La liste `/applications` remplace la carte à réponses dépliées par une carte compacte : bordure simple (même bordure que les cartes d'offres), monogramme société, titre-lien + société, `ApplicationStatusPill`, méta sur une ligne (date `Applied`/`Started`, CV, nombre de réponses) ; les réponses passent derrière « View answers (n) » / « Hide answers » (`aria-expanded`, `aria-controls` vers `answers-{id}`) et **toutes restent accessibles** ; pied d'actions inchangé (brouillon « Continue application », `submitted` retrait avec `ConfirmDialog`, aucun autre statut). **Aucune nouvelle donnée, requête, pagination, filtre ni tri ; aucun score de matching, pipeline ou brief IA** (éléments de maquette hors domaine, exclus). | §10.1, frontend `features/application/applications-view.tsx`. |
| **D71** | **Lisibilité du matching et états sans matching (UI).** *(1)* Sans matching, « AI clarifications » et « Candidate review » sont **Not required** dans un brouillon ; **Skipped** reste réservé à une candidature transmise sans ces étapes. *(2)* Le panneau « Your match » garde la grille desktop **7/5** et le rail sticky ; ses CTA « Run the match » / « Run the match again » passent en `CtaButton tone="secondary"` (bleu), le Submit restant orange. *(3)* Sous `lg`, le panneau remonte juste après le stepper, avant le contenu principal. *(4)* La validation du profil n'affiche plus de confirmation verte « Profile validated » : l'état « Analysis in progress » est affiché directement ; le message 409 d'une offre non prête devient « This offer isn't ready for matching yet. Please try again later. » | §10.1, frontend `features/application`, `features/matching`, `features/candidate` ; backend `MatchingService`. |
| **D72** | **Finition de la clarification et de la revue candidat (UI, 2026-10-21).** *(1) Clarification* — le backend expose `questionNumber` (rang 1-based des questions déjà posées, passages inclus) ; l'UI affiche `Question N` et `Up to M more questions` (jamais `N sur total`), la question mise en avant, l'encart « Why this question » **seulement si `rationale` est non nul** ; le CTA devient `Send answer` et le texte précise qu'un passage consomme un cran. *(2) Revue* — lignes compactes avec badges `AI`/`You`, compteur de critères sans poids ; `Add your score` / `Edit your score` ouvre un éditeur numérique + pas-à-pas + curseur (vide = non contesté, jamais prérempli avec la note IA ; une contestation sauvegardée rouvre préremplie ; `Clear score` retire la contestation, `Cancel` sur un éditeur vide restaure la dernière valeur sauvée), commentaire affiché seulement avec un score, barre sticky `Discard changes` / `Save your view` (bleu). *(3) Garde-fou* — `Submit` reste dans `SubmitPanel` (il possède le CV et la mutation) et est désactivé tant que la revue est dirty, avec `Unsaved assessment changes` et `aria-describedby` ; `Save`/`Discard` restent dans la revue. Le garde-fou est purement UI : aucun endpoint ni garde serveur nouveau ; `Submit` reste possible par l'API (D69). | §11.2–§11.3, backend `matching` (`questionNumber`), frontend `features/matching` + `features/application`. |
| **D73** | **Import de CV — le candidat choisit ce qu'il en fait (UI, 2026-10-21).** *(1) Choix* — sur `/profile/edit`, après la sélection d'un PDF, `CvUploadChoiceDialog` propose deux chemins explicites : **Save the file only** (dépôt simple — le PDF devient le CV courant, **aucune analyse**, aucune section modifiée) et **Analyze and update** (extraction IA → aperçu → application aux sections). *(2) Persistance* — les **deux** chemins déposent le PDF et en font le CV courant : l'analyse ne laisse plus le fichier hors des CV du candidat ; si le dépôt échoue alors que l'analyse est déjà lancée, l'import du profil suit son cours et l'échec du dépôt est signalé à part. *(3) Portée* — **UI seule** : rien de nouveau côté backend (`POST …/me/profile/cv` sans persistance et `POST …/me/attachments` existants) ; `/profile` garde son dépôt direct ; annuler la boîte ne dépose ni n'analyse rien. | §10, frontend `features/candidate` (`profile-edit.tsx`, `cv-upload-choice-dialog.tsx`). |

### 14.17 Modèle Gemini : 3.8 Flash écarté (quota 20/j), 3.1 Flash-Lite maintenu — 2026-10-21

Le free tier de Google AI Studio expose plusieurs modèles gratuits : `gemini-3.8-flash`, `gemini-3.6-flash`, `gemini-3.5-flash-lite` et `gemini-3.1-flash-lite` ; `gemini-4-argon` et `gemini-3.1-pro-preview` sont payants. Le modèle du ai-service reste un levier de configuration unique (`LLM_MODEL`), sans changement de code, de prompt ni de contrat. Le test du 2026-10-21 a montré que le choix ne se limite pas à la disponibilité : le quota journalier du free tier est **par modèle**, et les modèles Flash récents sont plafonnés à **20 requêtes/jour**.

| # | Décision | Portée |
|---|---|---|
| **D74** | **Modèle du ai-service : `gemini-3.1-flash-lite` maintenu ; `gemini-3.8-flash` écarté pour son quota free tier de 20 requêtes/jour.** *(1) Contexte* — le 3.1 Flash-Lite renvoyait des `503 UNAVAILABLE` récurrents ; le 3.8 Flash a été testé comme remplacement gratuit. *(2) Test 3.8 Flash* — qualité conforme : skills **9/9 ×3**, certifications **4/4 ×3** (100 / 45–50 / 0 / 100), éducation **10/10** (déterministe), rapports datés `matching-golden-skills-20261021T113209306922Z.json`, `…113320025113Z.json`, `…113431062959Z.json`, `matching-golden-certifications-20261021T113243219163Z.json`, `…113355451723Z.json`, `…113510548565Z.json`, `matching-golden-education-20261021T113248789512Z.json` dans `ai-service/scripts/golden/results/` ; `POST /matching/analyze` et `/matching/clarify` en 200, log `model=gemini-3.8-flash`, température 0.0 respectée. Mais le free tier plafonne ce modèle à **20 requêtes/jour/projet** : les six passages de golden sets ont épuisé le quota, et les analyses réelles suivantes ont échoué en **429 RESOURCE_EXHAUSTED** (renvoyé 500 par le service), avec un retry annoncé à ~19 h. *(3) Autres candidats* — `gemini-3.5-flash-lite` répond mais le SDK avertit qu'il **ignore `temperature`** (échantillonnage fixe) : incompatible avec la température 0.0 exigée par le matching ; `gemini-3.6-flash` n'apporte pas de quota garanti supérieur et n'a pas été retenu. *(4) Décision* — rester sur `gemini-3.1-flash-lite`, qui respecte la température 0.0 et dont le quota free tier a déjà absorbé les golden sets de référence (D68 : skills 9/9 ×3, certifications 4/4 ×3, éducation 10/10 le 2026-10-20) ; le risque de 503 transitoire demeure. *(5) Suite* — une **chaîne de repli** (3.8 Flash en primaire pour son absence de 503, 3.1 Flash-Lite en secondaire sur 429/503, ou l'inverse) est le remède de fond ; elle demande un changement de code et une décision séparée. Le free tier reste sans garantie de disponibilité et Google utilise son contenu pour améliorer ses produits (consentement explicite ou tier payant pour des CV réels). | §13.2, ai-service `core/config.py`, `.env.example`, golden sets. |

### 14.18 Console admin — dossier de signalement, revue multi-admin et provenance du modèle (2026-10-22)

Cette passe restyle la liste et les **deux premières cartes** du dossier de signalement, puis ajoute une **couche de revue interne multi-admin** pour collecter des avis indépendants et, à terme, des corrections exploitables pour la qualité du matching. Règle d'or inchangée : **aucun recalcul, aucune réévaluation, aucune notification, aucune visibilité candidat ou recruteur** — le signalement et le résultat épinglé restent immuables. La revue prend **V26** ; la clôture T-98 ajoute **V27** (triggers append-only), et les embeddings T-64 passent **V28**. **État : livrée le 2026-10-23 après audit de clôture (T-98).**

| # | Décision | Portée |
|---|---|---|
| **D75** | **Liste admin des signalements — cartes de dossier, scores réels, aucune donnée inventée.** La liste `/admin/reports` abandonne la rangée plate pour des **cartes individuelles** sur le canvas, en grille **5/3/4** ≥ `lg` (contexte / scores / commentaire + action) et empilée sur mobile. **Contexte (5)** : libellé du critère, section et clé, **motif** en pastille, offre + company, candidat, auteur, date. **Scores (3)** : **score du critère et score de section**, résolus par le serveur dans le **résultat épinglé** via `MatchingResultReader` ; critère non résolu → `null` (« Not resolved »), jamais `0` ; aucun indice de confiance, seuil, poids ou note globale. **Commentaire + action (4)** : commentaire réel ou « No comment. », lien `View` vers le dossier. `PageHeader` et son titre « AI reports » restent inchangés. **Seuls ajouts de payload** : `score` et `sectionScore` sur `AdminCriterionReportResponse` (et le type frontend), sans requête supplémentaire ni dénormalisation ; **aucun** compteur, onglet, recherche, filtre, tri, export, priorité, SLA, statut ou métrique. **Extension T-99** : chaque ligne porte aussi `myReviewVerdict` — le verdict de l'admin courant (`upheld` / `notUpheld`), `null` signifiant « Pending » —, lu en un seul lot ; la liste reste sans avis tiers, sans compteur et sans statut global. Loading/erreur/vide/infinite scroll, tokens, rayons et bordures existants conservés ; aucun rail de sévérité. | §12.1, backend `AdminService`/DTO liste, frontend `admin-reports-section.tsx` ; **T-92/T-93**. |
| **D76** | **Dossier admin — seules les cartes 1–2 sont restylées ; la carte 2 remplace l'extrait de CV par un vrai lien candidat.** Sur `/admin/reports/{id}`, `ReportCard` et `CriterionCard` reprennent l'anatomie de `signalement_details.html` (inspiration visuelle uniquement) ; **`Candidate contestation` et `Full AI assessment` restent inchangées**. `PageHeader` garde le **titre du critère** ; la carte 1 ne le répète pas en h1. **Carte 1** : motif, date, auteur, candidat, offre/company, commentaire réel, liens « View offer » / « View candidate » — aucun faux identifiant de dossier, priorité, SLA, statut d'arbitrage ou métrique. **Carte 2** : score du critère, score de section, exigence, justification IA, **nom du modèle** en méta discrète ; troisième colonne = **lien réel « Verify on candidate profile »** vers `/admin/users/{candidateUserId}` (ou « Candidate profile unavailable » si l'identifiant manque). **Aucun extrait de CV inventé**, aucune confiance, pondération, note revendiquée par le recruteur, cible ou seuil. Critère non résolu → aucune note inventée. Aucune action d'arbitrage ni d'édition. | §12.1, frontend `admin-report-detail-view.tsx` ; **T-94/T-95**. |
| **D77** | **Revue interne multi-admin — totale aveugle, un seul avis final par admin, auto-review interdite.** Table **append-only** `matching_criterion_report_review` (**V26**) : `id`, `report_id` FK `matching_criterion_report` NO ACTION, `reviewer_user_id` FK `users` NO ACTION, `verdict` SMALLINT `1 = UPHELD` / `2 = NOT_UPHELD` (CHECK ; valeurs API `upheld` / `notUpheld`), `note` ≤ 2 000 nullable, `corrected_score` 0–100 nullable (CHECK), `corrected_rationale` ≤ 2 000 nullable, `created_at`, **`UNIQUE(report_id, reviewer_user_id)`**, index de lecture par reviewer. **Tous les avis sont conservés** ; aucun update/delete, pas d'`updated_at`. **Un seul avis par admin et par signalement** ; l'auteur du signalement ne peut pas reviewer son propre signalement (409). **Aveugle total** : le dossier ne renvoie que **`myReview`** (`{id, verdict, note, correctedScore, correctedRationale, createdAt}`, ou `null`), jamais la liste des avis, jamais un compteur, jamais l'existence d'avis d'autrui — ni dans le dossier ni après enregistrement. La liste `/admin/reports` expose **`myReviewVerdict`** (`upheld` / `notUpheld` / `null`) pour l'admin courant seulement, chargé en un lot (`reviewerUserId` + `reportId IN (...)`) : elle affiche `Pending` / `Upheld` / `Not upheld` sans jamais révéler l'existence ou le contenu d'un avis tiers. Après validation, l'admin voit **son avis uniquement**, en lecture seule ; l'avis est **final**, sans édition. La confirmation finale récapitule verdict et correction avant envoi. Les autres avis restent exploitables côté base/dataset, mais aucune UI admin standard ne les expose ; un futur outil de data steward, séparé, pourra le faire. `supersedes_review_id` (révision explicite) est **réservé pour plus tard**, non implémenté. `POST /api/v1/admin/criterion-reports/{id}/reviews` (rôle ADMIN, 201) et `myReview` dans `GET …/{id}` ; 404 signalement, 409 doublon/auto-review. **La revue ne modifie ni le signalement ni le résultat, ne recalcule aucun score et ne notifie personne.** **Le dossier et la liste deviennent personnels** : les clés TanStack incluent l'admin courant — `["admin","criterion-reports",reportId,adminId]` pour le dossier et `["admin","criterion-reports","page",adminId]` pour la liste — ou le cache admin est vidé au logout ; sans quoi le `myReview` / `myReviewVerdict` d'un compte pourrait survivre à un changement de session. Après une revue (ou un 409), le dossier et la liste de **l'admin courant** sont invalidés, jamais la liste d'un autre admin. **Append-only garanti aussi par la base (V27)** : triggers `UPDATE`/`DELETE`/`TRUNCATE` sur les deux tables de signalement, en plus de l'absence d'endpoint de modification. | §11.3, §12.1, backend `admin` + `matching`, frontend admin ; **T-96/T-97/T-99**. |
| **D78** | **Correction attendue et dataset — pas de moyenne, pas d'export maintenant, anonymisation non promise.** `UPHELD` signifie **le signalement est valide, le score IA doit être corrigé** ; `NOT_UPHELD` signifie **le score IA est maintenu**. `correctedScore` et `correctedRationale` ne sont acceptés que pour un avis `UPHELD` (400 sinon) et restent **facultatifs séparément** : la review est **training-ready seulement quand les deux sont présents** ; une correction partielle est conservée mais signalée incomplète, jamais complétée d'office. **Aucune moyenne** entre admins ni entre corrections : les avis bruts et leur auteur restent la vérité. **Aucun export, endpoint, job ou UI de dataset n'est livré maintenant** ; la collecte commence, l'exploitation viendra plus tard. L'usage futur pour la qualité / l'entraînement est une **possibilité**, pas une promesse : aucune anonymisation n'est annoncée tant qu'un pipeline de dé-identification et une base légale n'existent pas. Aucun avis n'est visible du candidat ou du recruteur, et aucun n'affecte une décision. | §11.3, backend `admin`, SPEC §15.3 ; **T-96**. |
| **D79** | **Provenance du modèle — nom capturé maintenant, version de prompt reportée.** Le service IA expose `modelName` (camelCase) dans `MatchingAnalysis`, **modèle réellement appelé** ; `null` quand l'analyse est **100 % déterministe** (formation seule). Le backend l'écrit dans le JSON de `matching_result` (`modelName`), à côté de `policyVersion`/`scoringVersion`, et le dossier admin l'expose dans le contexte du critère. **Aucune migration** : le résultat épinglé reste la source. Le schéma de résultat matching et le schéma de réponse matching passent à **`2`** (champ additif ; les résultats `1` restent lisibles avec `modelName = null`). Dans la carte 2, affichage discret `Model: …` ou « Model not recorded ». La **version de prompt** (ou un hash) est **reportée** à une version future — jamais le texte complet ; tant qu'elle manque, la provenance n'est pas complète et la SPEC le documente. | §13.2, ai-service `schemas/matching.py` + `matching_analyze.py`, backend `MatchingScoring`/admin ; **T-94**. |

#### Durcissements de clôture T-98 (2026-10-23)

L'audit de clôture a figé les invariants suivants, chacun couvert par un test de régression ou d'intégration PostgreSQL :

- **Latest-only** : contestations, compteurs, écart moyen, tri et indicateur candidat ne lisent que le **dernier résultat terminé**. Les anciennes lignes ne sont ni supprimées ni relues ; un signalement continue de pointer le résultat exact qu'il vise.
- **Signalement pendant une analyse** : `POST …/criterion-reports` répond **409** tant que le dernier job du matching est `PENDING`/`RUNNING`. La course résiduelle (job créé juste après le contrôle) est assumée et tracée **TD-067**.
- **Worker de matching** : la transition CAS `PENDING/RUNNING → DONE` est la **porte d'entrée** ; une exécution perdante n'écrit aucun résultat et ne planifie aucun retry. L'écriture du résultat est en plus gardée par `result IS NULL` — un résultat terminé n'est **jamais** écrasé.
- **Contrat IA** : `schemaVersion` ∈ {`1`,`2`} et `policyVersion` ∈ {`generic-1`,`skills-3`,`education-2`} sont validés ; seul `modelName` reste libre. Un score **explicitement `0`** est légitime ; un score absent, non entier ou hors bornes est rejeté et déclenche le retry/la réparation.
- **Append-only** : V27 ajoute les triggers `UPDATE`/`DELETE`/`TRUNCATE` sur `matching_criterion_report` et `matching_criterion_report_review`. Les tests d'intégration désactivent ces triggers uniquement pour préparer leurs fixtures et les réactivent ensuite.
- **UI de revue** : `canReview` décide le formulaire (auto-review expliquée, jamais un bouton condamné), un **409** relit le dossier, et la couche SSE est partagée entre matching et normalisation (`lib/api/status-stream.ts` + `hooks/use-status-stream.ts`) sans changement de contrat public.
- **Golden results** : seuls les derniers rapports **PASS/FAIL** utiles par fixture sont conservés (`ai-service/scripts/golden/results/README.md`) ; les rapports redondants et les anciens formats ont été retirés.

---

## 15. Modèle de données

### 15.1 Existant (migrations V1–V10)

**Comptes** : `users` (identité + géo + `updated_at` heartbeat), `candidates` (title, bio, years_of_experience, search_status, target_position), `recruiters` (vide), `user_roles`.
**Profil** : `professional_experiences` (dont FK `job_position_id` vers le référentiel de titres — remplissage IA à venir), `candidate_projects` (V10 — Nom, Rôle, Période, Description, Technologies libre), `diplomas`, `candidate_skills` (level 1–5, years_experience), `candidate_languages` (CEFR), `candidate_links` (dont `CERTIFICATION`).
**Références** : `skills` (226, 10 catégories libres), `languages` (47), `degrees` (6), `study_fields` (24), `job_positions` (référentiel de titres officiels — vide en attente de l'alimentation IA, cf. D15/normalisation).
**Suggestions** : `skill_suggestions` (pas de workflow persistant — résolution = suppression du groupe).
**Normalisation (V9)** :

| Table | Colonnes clés |
|---|---|
| `normalized_profile` | PK dédiée, `version`, `schema_version`, `content JSONB` nullable, `validated_at` |
| `normalized_profile_candidate` | PK composite (`normalized_profile_id`, `candidate_id`) — extension offres anticipée en commentaire |
| `normalization_job` | Shared PK (`job_id ≡ normalized_profile_id`, la PK porte la FK), `status SMALLINT` 1–5 (V17/D29 : PENDING/RUNNING/DONE/FAILED/SUPERSEDED), `source_type SMALLINT` (V16/D26), `attempts`, `next_attempt_at`, `error VARCHAR(500)`, `started_at`, `completed_at` |

### 15.2 Dette / faiblesses (audit)

- Enums **sans `CHECK`** en BD ; pas de `ON DELETE` sur `normalized_profile_candidate`/`normalization_job` (suppression candidat = violation FK) ; double heartbeat `updated_at` (`touchUpdatedAt` + `@UpdateTimestamp`) ; `langchain-openai` mort ; `skills.category` = VARCHAR libre (pas de table FK).

### 15.3 Phase 1 — concevoir / migrer (V11+)

**Décidé (D10–D15), livré en 7 migrations (V11–V17)** :

| Migration | Contenu |
|---|---|
| ✅ V11 | `recruiters` + `headline`, `bio` ; `companies` ; `company_members` |
| ✅ V12 | `contract_type` / `employment_type` / `work_mode` + seeds |
| ✅ V13 | `job_offer` (+ `company_id`, `recruiter_id`, `status`, `seniority`, `city`/`country`, `validated_at`/`published_at`, salary) ; `job_offer_skills` (requirement_type, weight, years_experience) ; `job_offer_languages` (level CEFR, is_required) ; `job_offer_degrees` ; `job_offer_study_fields` |
| ✅ V14 | `job_offer.description` → `TEXT` (description riche Tiptap, D19 — limite métier 20 000 en `@Size`) |
| ✅ V15 | `job_offer.public_id` (VARCHAR(12) UNIQUE, immuable) + `slug` (VARCHAR(120), dérivé du titre) — URL publique `/jobs/{publicId}-{slug}`, lookup par `public_id` seul |
| ✅ V16 | `normalization_job.source_type` SMALLINT (1 = CANDIDATE, backfill ; 2 = OFFER) + index `(status, source_type, next_attempt_at)` ; `normalized_profile_job_offer` (+ index `job_offer_id`) |
| ✅ V17 | `normalization_job.status` VARCHAR(12) → SMALLINT (1 = PENDING, 2 = RUNNING, 3 = DONE, 4 = FAILED, 5 = SUPERSEDED — D29) |

**Conçu (D46–D57, 2026-10-16 ; complété D63–D66, 2026-10-19, puis D75–D79, 2026-10-22) — livraison par lots T-57→T-67, T-84→T-86 puis T-92→T-98, migrations additives uniquement** :

| Migration | Contenu |
|---|---|
| ✅ V18 | `attachment` + `candidates.current_cv_attachment_id` — CV local, propriétaire candidat, pointeur SET NULL, CV épinglé par candidature (FK composite) — D46 — **livrée (T-58, 2026-10-16)** |
| ✅ V19 | `job_offer_question` / `job_offer_question_option` — 5 types SMALLINT, `preferred` info seule, figées à la publication — D47 — **livrée (T-59, 2026-10-16)** |
| ✅ V20 | `application` / `application_answer` / `application_answer_option` — statuts 1–4, une candidature par couple, réponses normalisées + chaîne FK composites inviolable — D48–D49 — **livrée (T-60, 2026-10-17)** : `application.matching_id` posée **sans contrainte** (la table `matching` naît en V21), `ALTER TABLE … ADD CONSTRAINT` livré avec V21/T-61 (écart §16.2 ligne 14) |
| ✅ V21 | `matching` / `matching_result` / `matching_job` — identité (candidat, offre, version de fiche candidat), résultats versionnés, analyse async (miroir `normalization_job`) — D50–D51 ; `application` : FK composite `matching_id`, statuts renumérotés `DRAFT(1)…REJECTED(5)`, CV nullable en DRAFT seulement — D59 — **livrée (T-61, 2026-10-17)** |
| ✅ V22 | `clarification` + `job_offer.max_clarification_questions` — OPEN/ANSWERED/SKIPPED, une seule OPEN (index partiel), plafond par matching — D52 |
| ✅ V23 | `matching_criterion_feedback` — contestation du résultat final, modifiable jusqu'à la transmission (`updated_at`) — D54 révisée par D62 |
| ✅ V24 | `application.submitted_at` immuable, backfill des candidatures non-brouillon, index `(job_offer_id, status, submitted_at, id)` — tri de la vue recruteur — D65 — **livrée (T-66, 2026-10-21)** : backfill `created_at`, `CHECK` brouillon ⇔ `NULL`, trigger d'immuabilité, IT PostgreSQL réel |
| ✅ V25 | `matching_criterion_report` — signalement interne par critère, rattaché au `matching_result_id` exact, aucun recalcul — D66 — **livrée (T-86, 2026-10-22)** : unicité (résultat, critère, auteur), `CHECK` motif 1–5, `CHECK` « autre ⇒ commentaire non blanc », FK NO ACTION, index de lecture par résultat et par auteur |
| ✅ V26 | `matching_criterion_report_review` — revue interne multi-admin append-only, un avis final par admin et par signalement, correction attendue facultative — D77/D78 — **livrée (T-96, 2026-10-23)** : unicité `(report_id, reviewer_user_id)`, CHECK verdict/score/correction, index par reviewer |
| ✅ V27 | Triggers append-only `UPDATE`/`DELETE`/`TRUNCATE` sur `matching_criterion_report` et `matching_criterion_report_review` — D77, P2-6 — **livrée (T-98, 2026-10-23)** : aucune modification ni suppression directe en base, en complément de l'absence d'endpoint |
| ⬜ V28 | `CREATE EXTENSION vector` + `profile_embedding` — conservation multi-modèle, screening par jointure sur la fiche courante — D55 — **T-64** (renuméroté depuis V27 après l'attribution de V27 aux triggers append-only le 2026-10-23) |

Détail des colonnes, contraintes et index : §14.12, §14.14 et §14.18.

---

## 16. État actuel et écarts priorisés

### 16.1 Livré et testé

- Comptes, auth, admin, rôles ; profil candidat **7 sections** + import CV (**choix « déposer » / « analyser » et dépôt systématique du PDF — D73, 2026-10-21**) + suggestions ; **normalisation du profil candidat complète** (push async, dirty-flag, versioning, retries, recovery, bandeau) ; service IA extraction + normalisation (**schema v3** : Projets, séniorité, catégories, modèle de preuve, certifications, location, langues/diplômes/certifications minés avec provenance — D36) ; **Phase 1 backend étapes 1a–1d** : identité recruteur (D10), companies + membership (D11), vocabulaires d'offre (D14), **offres d'emploi CRUD + cycle de vie** (D12–D13 : validate ≠ publish, permissions coarse, dirty-flag) ; **Phase 1 frontend étape 2** : espace recruteur (`/recruiter`) avec onboarding D16 (overlay « Switching… », création auto du profil sur 404, création company), réglages (`/recruiter/settings`), éditeur d'offres (`/recruiter/offers/new`, `/recruiter/offers/[offerId]/edit`, description **HTML riche Tiptap sanitisé**, D19), liste des offres avec actions par statut (validate/publish/close/delete), bascule Candidate ↔ Recruiter branchée sur la route avec **modal de confirmation avant bascule** (D17) et primitif `Dialog` portalisé partagé ; **chrome adaptatif au mode profil** (D18 : sidenav recruteur minimale, cartes dashboard `RECRUITER_STATS`, entrée « Recruiter settings » + headline dans le menu user, section « Recruiter profile » en lecture/édition) ; **chrome offer D20–D21** (duplication, complétude, badges Expired/Unvalidated, URL publique en lecture) ; **normalisation d'offre complète** (D22–D29 + **D35 schema v2** : fiche `POST /job-offer/normalize`, extraction profonde miroir candidat, golden test prompt, `CefrLevel`, V16 `source_type` + `normalized_profile_job_offer`, V17 status SMALLINT, worker unique, snapshot avec strip jsoup + référentiel langues/skills/degrees/studyFields, signaux GET, édition pendant analyse → nouvelle version, badges FE Analyzing…/Analysis failed + « Validate again » (échec **ou** modifications non validées depuis la dernière analyse — masquée pendant une analyse en vol, miroir du bandeau candidat), vues admin avec poids/provenance/exigences/certifications).
- **Redesign des fiches normalisées (D37–D38, 2026-10-14)** : vues candidat/offre refondées (grille 8/4, sections lettrées A–G, `SpecGrid`, rail de widgets réels — maquette = inspiration), **une page dédiée par fiche** (`…/sheet/page.tsx` : bandeau d'identité, Copy/Download JSON de la version affichée, panneau History avec sélection de version + badge « Viewing v2 — current is v3 »), endpoints `…/normalized-profile/versions` (list desc + 404 miroirs), carte CTA remplaçant la section inline sur les pages détail ; **profil professionnel du candidat en lecture seule** sur la page détail compte (`GET /admin/users/{userId}/profile` 404 miroir + `ProfileSections` partagé, CTA d'édition masqués) ; **offre source au look « fiche »** (`AdminOfferSourceView` remplace `PublicJobArticle` côté admin : labels résolus, HTML sanitisé, skills weight/years BD, ni responsibilities/benefits).
- **Drawer de comparaison (D39, 2026-10-14 — retours UI 2026-10-15)** : la fiche normalisée s'ouvre dans un **drawer latéral droit non-modal** depuis les deux pages détail (`role="dialog"` sans `aria-modal`, la source derrière reste scrollable/cliquable — la comparaison) ; les **pages dédiées `…/sheet` (D37) sont supprimées** (corps partagé `normalized-sheet-body`, toutes les opérations conservées : Copy/Download JSON en `CtaButton tone="neutral"`, History + sélection de version) ; deep-link `?sheet=open` (refresh/back restaurent le drawer, fermeture via `router.replace`) ; largeur 50 % bornée [560–840] sous `lg:`, plein écran mobile, slide-in 180 ms soumis à `prefers-reduced-motion` ; CTA « Open sheet » = `CtaButton tone="secondary"` (bleu), **remonté en haut de page** ; **source compactée** : `ProfileSections` prop `compact` (grille 2 colonnes en **container query** `@container` + `@2xl:grid-cols-2`, `AboutSection` repli 1 colonne) + `AdminOfferSourceView` en grille 2 colonnes (description full-width) ; **racines des 2 pages détail** : `lg:pr-[clamp(560px,50vw,840px)]` quand le drawer est ouvert ; arrondis fiche en **`rounded-md`** (SpecGrid, items, rail, history) avec valeurs longues en wrap ; sections **numérotées** (`SectionBlock` pastille `ItemIndex`, titre nu) ; **sidenav admin repliable** (D40 : rail icônes `lg:w-20` ↔ `lg:w-64`, **toggle en haut à droite du conteneur logo**, logo/wordmark `h-5`, conteneur logo `rounded-xl` sans bordure, `UserMenu` compact, padding `lg:pl-20`/`lg:pl-64` via `AdminShell`, persistance `linqorbit.adminSidebar`).
- **Candidatures candidat (D48–D49, 2026-10-17)** : V20 additive (`application` / `application_answer` / `application_answer_option` — une candidature par couple **même après retrait**, CV **épinglé** par FK composite (le CV ne peut plus être supprimé), réponses normalisées immuables, chaîne FK composites inviolable option ∈ question ∈ offre ; contrainte FK `matching_id` différée à V21 — §16.2) ; `POST /api/v1/applications` (soumission **atomique par étages** : offre PUBLISHED non expirée revérifiée, CV choisi propriétaire sinon courant sinon 409, validité de chaque réponse **avant** complétude des obligatoires, nombres bornés NUMERIC(12,2)), `GET /applications/context/{publicId}` (questions sans `preferred`), `GET /applications/mine`, `POST /applications/{id}/withdraw` (204, terminal) ; frontend : CTA « Apply for this job » sur la fiche publique, page `/jobs/[job]/apply` (sous `AuthGate` + **retour post-login** `?next=` anti-open-redirect), formulaire 5 types de questions + CV courant pré-sélectionné + détail serveur affiché tel quel, page `/applications` (statuts, réponses lecture seule, retrait confirmé) + entrée nav « My applications ».
- **Job board public (T-72, 2026-10-17)** : `GET /api/v1/jobs` paginé (`permitAll`, enveloppe D34 — `page` seule exposée, taille décidée backend) — offres PUBLISHED non expirées uniquement, tri `published_at desc`, DTO léger (labels société/vocabulaires résolus en batch, zéro N+1) ; page publique prérendue `/jobs` (cartes allégées du motif `job-offer-card`, « Load more », états chargement/vide/erreur), hook `useInfinitePublicJobs` (`queryKeys.publicJobs.list`), nav candidat « Browse offers » remplaçant le placeholder « Offers & Pipelines ».
- **Fiche publique restylée (T-73, 2026-10-17)** : `/jobs/[job]` refondue sur la maquette `offer_public_view.html` (styles globaux seuls, **zéro contenu fictif**) — en-tête d'actions (retour board + copie de lien), hero carte blanche (tuile gradient, chips méta dont salaire orange, « Posted … », échéance ≤ 30 j, CTA solide), grille 8/4 avec sections **numérotées** (description, compétences mandatory/preferred avec légende, langues avec mètre CEFR, éducation) et colonne latérale sticky (faits réels de l'offre ; « More open positions » : 3 autres offres publiées du board), barre de candidature **sticky** en bas de page ; **prévisualisation recruteur = même rendu sans CTA ni offres liées** (le miroir fiche/preview est préservé) ; différés post-MVP car sans données : match IA (T-61), carte recruteur, stats société, bouton save (tasks.md « Idées produit »).
- **Rectification T-73 (T-74, 2026-10-17)** : pages offres **intégrées au shell** — routes `/jobs` + `/jobs/[job]` en `(dashboard)` (AuthGate ; board au motif dashboard breadcrumb + h1, fiche sans double padding) ; **composants maison** : `ButtonLink` (fin de `OFFER_LINK_PILL_CLASS` sur les cartes recruteur/admin), `components/ui/menu.tsx` (`MenuPanel`/`MenuItem`/`MenuSeparator` adoptés par le kebab d'offre et le `UserMenu`, items **composés sur `Button`/`ButtonLink`** — variante `menu`, anatomie de ligne), `IndexBadge` (ex-`ItemIndex`) et `IconBadge` (ex-`SectionIcon`) ; fiche : sections en `IconBadge` orange (fin des « Section 0X »), légende Mandatory/Preferred sous les pills, « Job facts » supprimé, « More from this company » servie par l'endpoint dédié `GET /api/v1/jobs/{publicId}/related` (tableau brut, PUBLISHED non expirées de la même company, courante exclue, `published_at desc`, limite 3 décidée backend, mêmes 404 sûrs que la fiche) ; « Back to offers » en `NavPill` orange par défaut, copie de lien en `CtaButton tone="neutral"` ; états de dialogue regroupés en union `OfferDialog` (liste recruteur).
- **Job board refondu + fiche pleine largeur (T-76, 2026-10-17)** : cartes du board redessinées sur `offer_listing_for_candidates.html` — flux en **grille 2 colonnes ≥ xl**, carte `rounded-3xl` (monogramme bleu, société `label-md` majuscules + « Posted … », titre-lien, ligne méta inline icônes avec salaire en gras, **toutes les compétences en pills neutres** — aucune omise, ordre backend poids desc puis nom asc), footer filet avec échéance ≤ 30 j (orange si urgente) + « View job » + « Apply » (→ page apply ; `CtaLink` ajouté à `components/ui/button.tsx` — CTA de navigation, même anatomie que `CtaButton`) ; `GET /api/v1/jobs` expose `skills` en libellés (batch, zéro N+1 ; `/related` hérite ; ni plafond ni compteur) ; fiche `PublicJobArticle` **pleine largeur** (fin du `max-w-6xl`, états NotFound/Loading conservés `max-w-3xl`) ; le flux charge **automatiquement** la page suivante au scroll (`InfiniteList` — sentinel + repli clavier sr-only, fin du bouton « Load more » visible de T-72 ; `listClassName` ajouté au composant partagé pour la grille) ; filtres/recherche/tri de la maquette → T-77 (backlog), sidebar IA/save/télémétrie écartés (T-61 parqué, post-MVP).
- **Parcours de candidature + moteur de matching (T-61, D58–D59, 2026-10-17)** : V21 additive (`matching` identité = couple + version de fiche candidat, `matching_result` versionné sous verrou pessimiste, `matching_job` miroir de `normalization_job` ; `application` : statuts renumérotés `DRAFT(1)…REJECTED(5)`, CV nullable en brouillon seulement, FK composite `matching_id`) ; **candidature en brouillon** (`PUT /applications/draft` réponses remplaçables, `POST /applications/{id}/submit`, `DELETE /applications/{id}` abandon ; l'ancienne soumission d'un coup `POST /applications` est supprimée — une seule façon de faire), étape du parcours **calculée** par le serveur (`recruiter_questions` → `matching` → `submitted`, `canSubmit`) ; **matching** `POST /matchings` (lancement/reprise/relance après échec) + `GET /matchings/offer/{publicId}` (score de chaque critère par section, rien d'autre côté candidat), worker async + pool dédié, ai-service `POST /matching/analyze` **sans état** (contexte rejoué, `matchingId` = `thread_id` LangSmith), critères à clés stables, contrôle de couverture des clés des deux côtés, moyenne pondérée par section ; frontend : `/jobs/[job]/apply` = bandeau compact + **accordéon** (bouton à chevron en pied de carte, détail déplié vers le bas dans le flux, contenu de la page décalé), indicateur d'étapes (4 étapes Recruiter questions · AI clarifications · Candidate review · Summary & apply, 3 sans question recruteur — l'offre sans question s'ouvre sur l'étape IA, brouillon créé au premier geste ; clarifications/revue « Skipped » après une transmission directe tant que T-62/T-63 manquent), questions recruteur en brouillon (« Save and continue » / « Save and quit »), matching facultatif suivi en push SSE (D60, plus de « Refresh »), transmission (CV) et abandon confirmé ; brouillons dans « My applications » (« Continue application ») ; finition 2026-10-21 (T-89) : panneau de matching restylé — en-têtes de section `IndexBadge` + compteur de critères (anatomie de la revue), barres « tube » bleues (`bg-blue-deep` sur rail bordé), statut `Analyzing…` en pastille d'en-tête à point pulsant (messages transitoires en texte muet), valeurs `tabular-nums` et filets entre sections — purement visuel, aucune donnée ni calcul nouveau, interdits candidat D58/D65 inchangés.
- **Clarifications IA + contestation (T-62/T-63, D61–D62, 2026-10-18)** : V22 (`clarification` — une seule OPEN par index partiel, FK composites croisées avec `matching_result` ; `job_offer.max_clarification_questions` 0–10, défaut 3) et V23 (`matching_criterion_feedback`, `updated_at`) ; boucle « analyse → question → réponse/skip → réévaluation versionnée » portée par le worker durable (une transaction : résultat + DONE + question suivante ou fin), `POST …/clarifications/{id}/answer|skip` (202), `POST …/assessment/finish` (204, idempotent), `PUT …/feedback` (remplacement complet, aucun recalcul) ; `GET /matchings/offer/{publicId}` gagne `assessmentFinished`, la question ouverte (rationale candidat + budget restant) et les contestations du candidat — jamais poids, justification ni score de section ; contexte de candidature `assessment` pour l'indicateur d'étapes ; ai-service `skills-3`, `POST /matching/clarify`, preuves `clarification` vérifiées au tour de réparation ; frontend : panneau de clarification, « Your assessment », champ « Max AI questions » de l'offre ; finition 2026-10-21 (D72) : `questionNumber` et plafond honnête, rationale nullable masqué, `Send answer`, éditeur de score numérique/stepper/curseur, barre sticky Save/Discard et garde-fou Submit dirty (`Unsaved assessment changes`). Jeu d'essai Gemini réel : 8/9 sous `skills-1` (2026-10-18) ; **7/9, 7/9, 8/9** sous `skills-2` (Redis 85, cas 9 100 au lieu de 60, cas 5 voisine instable) ; sous **`skills-3` à température 0.0** (2026-10-19), après le tour de réparation des sorties rejetées par le schéma : **9/9, 9/9, 9/9** (chaque passage rattrapé une fois par ce tour) — TD-058 résolue.
- **Vue recruteur des candidatures (T-66, D65, 2026-10-21)** : **V24** additive (`application.submitted_at` backfillé depuis `created_at` pour les non-brouillons, `CHECK` brouillon ⇔ `NULL`, index `(job_offer_id, status, submitted_at, id)`, trigger d'immuabilité) ; API `/api/v1/job-offers/{offerId}/applications` — liste paginée `GET`, détail `GET /{applicationId}`, CV épinglé `GET /{applicationId}/cv`, décision `POST /{applicationId}/decision` (204, corps `accepted`/`rejected`) ; **liste par offre** : défaut `SUBMITTED`, onglets `ACCEPTED`/`REJECTED`, `WITHDRAWN` et brouillons invisibles, tri date de candidature croissante par défaut puis cinq scores de section asc/desc (nulls last) et contestations (nombre, écart moyen absolu, date ; aucun feedback dernier), **carte** en quatre zones (identité / cinq lignes de score / panneau contestations / action) — lignes compactes label + barre courte bleue + valeur colorée par bande (vert ≥ 70, orange 40–69, gris < 40), monogramme `rounded-full`, **intitulé du poste candidat** (`Candidate.title` ajouté au résumé recruteur, chargé en batch, masqué si absent), section de tri mise en évidence, « Not evaluated » sans section et « No AI assessment » sans résultat (panneau contestations masqué), panneau contestations orange/gris neutre avec compteur et écart moyen sur une ligne, **filtre + tri sur une ligne** (Select compact, dont les items du menu reprennent la taille du titre) et **lien-bouton** outline « View application » (zone des scores bornée sur son contenu) ; **détail** : réponses recruteur avec `preferred`, paires Q/R IA, justification par critère, contestations, CV en streaming authentifié, matching épinglé (`matching_id` nullable, dernier résultat terminé) ; **décisions** manuelles terminales, confirmation UI, 409 ensuite, aucun recalcul ; **D12** : tout membre lit liste/détail/CV, seul l'owner ou le créateur de l'offre décide ; frontend `/recruiter/offers/[offerId]/applications` (+ détail) et entrée « Applications » sur les offres publiées/fermées ; **IT PostgreSQL réel** : backfill/trigger, cinq tris asc/desc, contestations, droits D12, CV, créateur non-owner, décisions terminales et concurrence. Docs : SPEC §12.1/§15.3/§17, `docs/tasks.md`.
- **Détail d'une candidature recruteur — refonte (T-90, 2026-10-22)** : page `/recruiter/offers/{offerId}/applications/{applicationId}` reprise sur la maquette `frontend/template/application_details.html` (illustration, **aucune donnée inventée**) — h1 = **monogramme `rounded-full` + nom du candidat** avec l'**intitulé du poste actuel** juste en dessous (aligné sur le bloc d'identité), sous-titre offre/société, **lien outline « Back to applications »** (navigation) ; **barre de décision collante** (`sticky top-16`) = statut + date + `Accept`/`Reject` (CTA orange/rouge, `ConfirmDialog`), avec **explication** à la place des boutons quand `canDecide` est faux ou la candidature déjà décidée ; corps en **grille 8/4 ≥ xl** (récit à gauche : évaluation IA par section puis par critère, questions recruteur, clarifications ; à droite : **carte CV** (nom, taille, **CTA bleu de téléchargement**) puis le **panneau des contestations**), empilement sous `xl` dans l'ordre du DOM ; scores de section en **pastille %** teintée par bande, scores de critère en **%** + **barre bleue** + justification IA, critère contesté signalé par une pastille « Contested » ; clarifications IA = raison de la question puis **libellé « Answer »** + réponse (la mention d'état accompagne la réponse) ; panneau contestations **orange si contesté / gris sinon** (comparaison note IA / note candidat / écart + argumentaire), **masqué sans évaluation IA** ; **aucune note globale, aucun radar, aucune moyenne pondérée, aucune note propre du candidat** ; **rayons uniformisés** (un seul rayon, celui de la barre flottante, pour tous les blocs de la page ; le bloc bleu « Why the AI asked this » fait exception et gagne du padding) ; bande de lecture, unité « % », monogramme et arrondi **partagés avec la carte de liste** (`recruiter-application-shared.tsx`) ; **aucun changement backend** (`candidate.title` était déjà exposé) ; **993 frontend au vert** (117 fichiers), lint + build.
- **Compteur de candidats sur les cartes d'offres + logo du sidenav (T-91, 2026-10-22)** : la carte d'une offre (vue recruteur) affiche le **nombre de candidatures visibles** de l'offre en tête de la rangée de méta (chip « 3 candidates » **outline orange** (thème accent), absent à 0 et côté console admin) ; le compteur est **calculé par le serveur** (`JobOfferListItem.applicationCount`, un seul GROUP BY pour toute la page — jamais un COUNT par offre) et compte exactement les candidatures que le recruteur voit dans la liste de l'offre (transmises, acceptées, rejetées ; brouillons et retraits exclus). Le logo passe à `strokeScale={1.75}` **partout où il est posé** (sidenavs, header mobile, header public, pages login/signup) : les deux orbits et le noyau sont **un cran plus fins**, pour peser comme le trait du wordmark posé à droite (le `strokeScale` est un **poids relatif** — une seule valeur pour une marque unique). Tests : IT PostgreSQL (2 transmises comptées, 1 brouillon et 1 retrait exclus) + test frontend (chip et absence à 0) — **645 backend / 993 frontend au vert**, lint + build.
- **Signalement interne d'une évaluation IA par critère (T-86, D66, 2026-10-22)** : **V25** additive (`matching_criterion_report` — unicité (résultat, critère, auteur), `CHECK` motif 1–5, `CHECK` « autre ⇒ commentaire non blanc », FK NO ACTION vers `matching_result` et `users`, index par résultat et par auteur) ; API recruteur `POST /api/v1/job-offers/{offerId}/applications/{applicationId}/criterion-reports` (201 ; corps `{criterionKey, reason, comment}` — **la clé du critère est recopiée par le client, le serveur résout le résultat affiché et relit la clé dans son JSON** ; 400 clé inconnue / motif invalide / commentaire exigé / commentaire > 2 000, 409 doublon ou évaluation absente, 404 hors company / autre offre / brouillon) ; le détail expose `criterionReports` (**les signalements de son auteur seul**) ; API admin `GET /api/v1/admin/criterion-reports` (paginée, libellé et section du critère relus dans le résultat épinglé, lectures par lots — jamais une requête par ligne) + `GET /api/v1/admin/criterion-reports/{id}` (dossier : critère relu dans **le résultat épinglé**, évaluation complète, contestations, écart moyen ; 404 sûr) + pages `/admin/reports` (« AI reports », action « View ») et `/admin/reports/{id}` ; frontend : dialogue de signalement (motif, commentaire **obligatoire pour « autre »**, annonce de l'immuabilité), action « Report » par critère, **carte signalée inchangée** (aucun rail ni fond teinté ; encart de relecture orange très discret en pied — ligne `Reported · motif · date`, commentaire — et compteur `N reported` par section, somme des signalements de l'auteur dans la candidature), dossier admin en lecture seule avec cartes neutres et badge `Reported` seul. Le signalement est **immuable** (aucune édition, unicité en base) et **sans effet** : aucun recalcul, le `matching_result` reste identique. Tests : IT PostgreSQL (nominal, doublon, clé inconnue, motif invalide, commentaire, hors company, autre offre, brouillon, sans évaluation, 401, base : doublon / motif hors bornes / « autre » sans commentaire, console admin, dossier nominal / sans contestation / critère devenu introuvable / 404 / 403 / 401) + tests frontend (dialogue, action par critère, état « Reported », compteur de section, erreur 409, liste admin + navigation, dossier nominal / sans contestation / critère non résolu / 404, couche API) — **654 backend / 1018 frontend au vert**, lint + build.
- **Revue admin des signalements IA (T-92→T-99, D75–D79, 2026-10-23)** : liste `/admin/reports` en cartes 5/3/4 (contexte / scores réels résolus dans le résultat épinglé / commentaire + `View`) ; dossier restylé (contexte, critère relu avec modèle et liens réels), **revue multi-admin aveugle** (V26, un avis final par admin, auto-review 409, `canReview` serveur, `myReview` seul, clé TanStack par admin, 409 → relecture) ; **V27** triggers append-only `UPDATE`/`DELETE`/`TRUNCATE` sur les deux tables. Audit de clôture : worker matching **CAS-first** et écriture unique, **latest-only** des contestations (candidat/recruteur/admin), **409** pendant une analyse en vol (TD-067), contrat IA strict (`schemaVersion`/`policyVersion`, score `0` explicite), clarification réparée une seule fois puis 502 `no_output`, test d'upgrade V20→V21 sur PostgreSQL réel, SSE partagé, golden results élagués. **T-99** : `myReviewVerdict` personnel dans la liste (`Pending` / `Upheld` / `Not upheld`), chargé en un lot, clé TanStack de liste par admin et invalidation liste + dossier après revue/409. Aucun export ni anonymisation. Docs SPEC §12.1/§14.18/§15.3/§16.1/§17 + AGENTS + TECH_DEBT.
- **686 tests backend / 420 ai-service (+ 1 ignoré) / 1037 frontend au vert** (2026-10-23 : T-92→T-99, revue admin + audit P1/P2/P3 + statut de revue personnel ; historique : T-86 et T-91 : 654 / 413 / 1018 ; T-66 : 644 / 413 / 972 ; T-62 : 556 / 340 / 878 ; clôture T-61 : 525 / 208 / 794).

### 16.2 Écarts (audit 2026-10)

| # | Écart | Nature | Priorité | Décision |
|---|---|---|---|---|
| 1 | Contenu normalisé ≈ 50 % du §10-17 (séniorité, dispo, mobilité, technologies absents) | Écart réel (chaîne profil → fiche) | ~~importante~~ → **partiellement résolu** (v3 : séniorité, catégories, technologies, réalisations, certifications, location, langues/diplômes minés ; mobilité/contrat restent D2) | D2 ouvre ; schemaVersion gère |
| 2 | Section Projets absente | Oubli réel (CDC : « importante ») | ~~importante~~ → **✅ résolu** | D3 levée (D7/D8) |
| 3 | Contrat / mobilité / pays acceptés absents | Écart réel (placeholder UI) | **importante** | D2 (contrat + mobilité) |
| 4 | Normalisation offre : 0 % | Volontaire (roadmap) | ~~importante~~ → **✅ résolu** (D22–D29 livrés, V16–V17, signaux + relance FE) | D4 close |
| 5 | Fiche jamais lue ni exposée | Décision Q7 | mineure → importante au matching | D5 |
| 6 | Champs IA acceptés puis jetés (`targetPosition`, `searchStatus`) | Fuite de conception | mineure | prochain toucher schéma |
| 7 | Certifications simplifiées | Non actée | mineure | D6 |
| 8 | Langues : déclaré/évalué/contexte | Dépend matching | mineure → **partiellement résolu** (D36 : declared + inferred avec preuve et CEFR sur les deux fiches ; le scoring reste au matching) | D36 ; scoring reporté |
| 9 | Jobs simultanés possibles (RUNNING non superseded) | Documenté | mineure | — |
| 10 | Backoff constant / recovery = tentative | Doc | mineure | — |
| 11 | Dette : tables mortes, enums sans CHECK, ON DELETE, double heartbeat, dépendance morte | Dette | mineure | nettoyage |
| 12 | Identité masquable (§10.1) jamais abordée | Oubli de décision | mineure | profil recruteur |
| 13 | Diagramme §11.3 : le feedback candidat y déclenche la génération des questions IA | Écart spec ↔ conception | mineure | **Révisé par D53** : génération autonome (analyse de lacunes + mandat « recruteur chevronné ») ; contestation = mécanisme terminal séparé (D54/D62) ; signalement IA interne par critère (D66) ; textes §11.1/§11.3 ajustés le 2026-10-19 |
| 14 | ~~`application.matching_id` posée **sans contrainte FK** en V20~~ | ~~Écart assumé et planifié~~ | **✅ résolu (V21, T-61)** | `ALTER TABLE application ADD CONSTRAINT fk_application_matching` (FK composite couple + matching, NO ACTION, MATCH SIMPLE) ; inviolabilité vérifiée par IT PostgreSQL réel (`ApplicationIntegrationTest`, `MatchingIntegrationTest`) ; `matching_id` posé par le serveur à la transmission |
| — | Workflow save/validate, async, architecture IA §24, 11 décisions | **Conforme** | aucune | — |
| — | Matching, critères, questions, clarification, transparence, vue recruteur, ATS, analyse offre | Reportés Phase 1+ → **conception validée (2026-10-16)** | implémentation par lots T-57→T-67 puis T-84→T-86 en cours | D46–D57, D63–D66 |

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
- ✅ Normalisation d'offre (V16, D22–D28 : fiche v1 `POST /job-offer/normalize`, `source_type` SMALLINT, worker unique, snapshot Spring avec strip HTML jsoup, signaux GET `normalizationInProgress`/`normalizationFailed`, `validate` sans bump `updatedAt`)
- ⬜ Analyse IA — 11 familles d'anomalies avant publication
- ⬜ Matching — moteur critères pondérés (les embeddings ne servent qu'au retrieval amont, §8.4 / D31) — **conception validée 2026-10-16 (D46–D57), matching livré T-61, clarifications/contestation T-62/T-63 ; clôture recruteur T-84/T-85 et T-66 livrés, T-86 livré**
- ✅ **T-84** — versions de schéma centralisées, `analysisOutdated` candidat/offre, bouton de revalidation, garde du `schemaVersion` IA (D63) ; complément : `POST …/revalidate` pour les offres `PUBLISHED` sans changement de cycle de vie — 594 backend / 900 frontend au vert (2026-10-19)
- ✅ **T-85** — SSE de normalisation candidat/offre, signal + GET, publication après commit (D64) — 625 backend / 922 frontend au vert (2026-10-20)
- ✅ **T-66** — vue recruteur V24 : onglets de statut, tri section/contestations, score profile, détail par critère, CV, décisions (D65) — livré le 2026-10-21, **644 backend / 972 frontend** ; dépend de T-63, pas de T-65
- ✅ **T-90** — **détail d'une candidature refait** (T-66) : barre de décision collante, grille 8/4, scores de section et de critère en %, critère contesté signalé, panneau des contestations orange/gris — livré le 2026-10-22, **993 frontend**
- ✅ **T-86** — signalement IA par critère, V25, interne, sans recalcul (D66) — livré le 2026-10-22 : résultat résolu par le serveur, signalement immuable, commentaire obligatoire pour « autre », carte signalée inchangée + encart de rappel orange discret + compteur de section, pages `/admin/reports` et `/admin/reports/[reportId]` — **654 backend / 1018 frontend**
- ✅ **T-92→T-98 — revue admin des signalements IA (D75–D79)** : liste en cartes 5/3/4 avec score + score de section réels ; dossier cartes 1–2 restylées, modèle affiché, lien candidat réel ; revue multi-admin **V26** à l'aveugle total, un avis final par admin, auto-review interdite, `canReview` calculé serveur, correction `correctedScore`/`correctedRationale` sans moyenne ; **V27** triggers append-only sur les deux tables. Audit de clôture : latest-only des contestations, **409 pendant une analyse en vol**, CAS-first du worker, validation stricte `schemaVersion`/`policyVersion`/score, SSE partagé, golden results élagués. Aucun export ni anonymisation pour l'instant. **Livré le 2026-10-23** — **683 backend / 420 ai-service (+1 ignoré) / 1033 frontend**, ESLint/tsc/build verts. Aucun commit.
- ✅ **T-99 — statut de revue personnel dans la liste admin (2026-10-23)** : `AdminCriterionReportResponse.myReviewVerdict` expose le verdict de **l'admin courant** (`upheld` / `notUpheld` / `null` = « Pending ») sur chaque carte `/admin/reports`, chargé en **un seul lot** — jamais un avis tiers, un compteur ou un statut global. Badge `Your review` et libellés partagés avec le dossier ; clé TanStack de liste `["admin","criterion-reports","page",adminId]`, invalidation du dossier et de la liste de l'admin courant après revue/409. **Aucune migration.** **Livré le 2026-10-23** — **686 backend / 1037 frontend**, ESLint/tsc/build verts. Aucun commit.
- ⬜ Transparence & clarification — vue d'évaluation, clarification, réévaluation — **conception validée 2026-10-16 (D52–D54)** ; contestation livrée T-63, vue recruteur T-66

---

## 17. Phasage

| Phase | Contenu | État |
|---|---|---|
| **0 — Profil candidat** | Comptes, 7 sections (dont **Projects**), import CV, **normalisation profil v2** (push, dirty-flag, bandeau, modèle de preuve) | ✅ **Livré** |
| **0+ — Extensions profil** | Contrat recherché + mobilité (D2) | Décision prête |
| **1 — Entreprise / recruteur / offre** | Company (owner/membre), identité recruteur (D10), CRUD offre + cycle de vie (D13), validation → **normalisation offre** (D4/D22–D29) | ✅ **Backend + FE livrés (D10–D14, D16–D21)** + **normalisation offre livrée (V16–V17, D22–D29)** ; reste : analyse IA, matching |
| **1 — Analyse IA offre** | 11 familles d'anomalies avant publication (§6.3, §9) | À venir |
| **1 — Matching** | Moteur unique : critères pondérés (§7), score par critère, comparaison sémantique LLM, « info insuffisante » (§19) — conçu sans dépendre du retrieval (§8.4.9) | ✅ **Livré (T-61, D58)** — politique `education-2` (D61 + D67/D68), validée le 2026-10-20 (skills 9/9 ×3, éducation 10/10 ×3 déterministe, certifications 4/4 ×3 — modules `matching_policy` ai-service + `MatchingScoring` backend) ; **clôture recruteur** : T-84/T-85, **T-66 (V24) livré le 2026-10-21** et **T-86 (V25) livré le 2026-10-22** ; **revue admin T-92→T-98 livrée le 2026-10-23 (V26/V27)** puis **T-99 (statut de revue personnel)** — **686 backend / 420 ai-service (+1 ignoré) / 1037 frontend** |
| **1+ — Screening sémantique** | Retrieval amont du matching (§8.4, D30–D32) : pgvector, table `PROFILE_EMBEDDING`, représentation JSON → texte, embeddings, Top N, mesure du rappel | À venir (T-64 en **V28**, T-65) — lot séparé, non prérequis de T-66 |
| **1 — Transparence & clarification** | Vue d'évaluation, auto-évaluation (§11.2), clarification & réévaluation (§11.3, D1), historique, Q7 (D5) | ✅ **Clarifications + contestation livrées (T-62/T-63, D61–D62)** (jeu d'essai réel `skills-3` à température 0.0 : 3 × 9/9 le 2026-10-19 ; formation notée en code et jamais clarifiée depuis `education-2`, D68) ; **refonte du parcours (D69)** : évaluation ouverte centrale, transmission masquée côté UI, sans matching « Summary & apply » courante ; **644 backend / 413 ai-service (+1 ignoré) / 972 frontend au vert (2026-10-21)** — vue recruteur livrée (T-66) |
| **1 — Questions & recruteur** | Questions présélection, agent IA (§10), vue recruteur (§12.1), ATS basique (§12.2) | ✅ **Vue recruteur livrée (T-66, D65, 2026-10-21)** : statuts, tris de section, contestations, score profile, décisions, CV, rationale, permissions D12 ; **détail d'une candidature refait (T-90, 2026-10-22)** : barre de décision collante, grille 8/4, scores en %, critère contesté signalé, contestations orange/gris — **993 frontend** ; **signalement IA par critère livré (T-86, D66, 2026-10-22)** : immuable, commentaire obligatoire pour « autre », carte signalée inchangée + encart de rappel orange discret + compteur de section, console admin avec dossier en lecture seule — **654 backend / 1018 frontend** |
| **1 — Console admin** | D33 : chrome `(admin)` + `AdminSidebar`, fiche détail compte, liste globale offres (filtre + pagination), détail offre en format public, fiches normalisées friendly (candidat v2 + offre v1) ; **D75–D79 : liste/dossier des signalements IA, revue multi-admin aveugle, provenance modèle** | ✅ **Livré** — **revue admin T-92→T-98 livrée le 2026-10-23** (V26 + V27 triggers append-only), **T-99 (statut de revue personnel dans la liste)** livré le 2026-10-23, audit de clôture P1/P2/P3 soldé, **686 backend / 420 ai-service (+1 ignoré) / 1037 frontend** |
| **2** | Matching avancé, historique évaluations, statistiques | Plus tard |
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
