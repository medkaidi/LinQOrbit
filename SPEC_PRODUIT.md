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
| Profil recruteur & entreprise | §22, §6 modèle D4 | `recruiter/`, `company/` (vides) | `features/recruiter`, `features/company` (vides) | ❌ À venir |
| Offres d'emploi | §3-4, §9 | `joboffer/` (vide) | `features/job-offer` (vide) | ❌ À venir |
| **Normalisation offre** | §9 | (réutilise `candidate/`) | — | ❌ À venir (D4) |
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
- **`recruiters`** : table créée (V1) **vide, sans entité JPA** — viendra avec le profil recruteur (§6).

### 3.2 Identité candidat (§10.1 du CDC)

Champs disponibles : nom, prénom, email, téléphone, sexe, pays d'origine, ville/pays actuels.
- ⚠️ **Gap mineur** : « certaines informations peuvent être masquées dans certaines vues » (§10.1) — jamais abordé. À traiter avec les vues recruteur (masquage contact avant entretien, par ex.).
- ⚠️ Asymétrie actuelle : l'identité affichée sur `/profile` vient de `GET /auth/me`, le profil pro de `GET /candidates/me/profile` — deux API, normal mais à garder en tête.

---

## 4. Normalisation du profil candidat

> **Seul domaine normalisation aujourd'hui implémenté.** Détail exhaustif ci-dessous ; le volet offre reprendra la même machine (§6.3).

### 4.1 Cycle de vie complet

```
PUT …/section ×7          → 204, AUCUNE normalisation, heartbeat updated_at
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

### 4.3 Format canonique v1 (`schemaVersion="1"`)

CamelCase, dates `YYYY-MM`, CEFR, niveaux 1–5, **rien inventé**, jamais d'UUID :

```
schemaVersion, title, summary, yearsOfExperience
experiences[] : positionTitle, companyName, companyCountry, startDate, endDate, description
diplomas[]    : title, institution, institutionCountry, degreeLabel, studyFieldLabel, dates
skills[]      : name, level (1–5), yearsExperience
languages[]   : name, level (CEFR)
links[]       : label, url
```

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

6 sections (`/profile/edit`) : **Personal Information** (title, bio, yearsOfExperience, searchStatus + identité compte), **Experience**, **Education**, **Skills** (catalogue 226 + niveau 1–5 + années), **Languages** (47 + CEFR), **Links & certifications** (11 types dont `CERTIFICATION` + issuer/issued_at).
- `target_position` : colonne backend + API, **sortie de l'UI** (décision actée).
- **Save** : `PUT /auth/me` + `PUT …/about` en `Promise.allSettled` (About fusionné).
- **CV import** : `POST …/cv` → aperçu → Apply remplit les 6 sections (`keepDefaultValues`) ; **rien persisté côté serveur**.
- Jauge de complétion : 6 sections (titre + bio comptés comme About).

### 5.2 Écarts vs profil candidat du CDC (§10-16)

| Prévu (CDC) | État | Décision |
|---|---|---|
| §11 **Type de contrat recherché**, **mobilité** | Absents | **Retenus au scope** (D2) |
| §11 Disponibilité (date, préavis), pays acceptés | Seul `search_status` (3 valeurs) ; placeholder UI « Goals & criteria » | Pays à trancher avec l'UI |
| §11 Domaine, niveau professionnel / séniorité | Seul `title` + `targetPosition` (mort UI) | À étendre avec D2 |
| §12 Compétences : catégorie, dernière utilisation, projets associés, **sources** | Catégorie en DB, absente du contenu normalisé ; reste absent | Catégorie en schema v2 |
| §13 Expériences : technologies, projets, domaine, compétences mobilisées | Seul `description` libre | Enjeu matching — v2 |
| §14 **Projets** | Absent | **Étude préalable** (D3) — transverse, pas seulement IT |
| §15 Certifications dédiées | Via `candidate_links` | Simplification assumée (D6) |
| §16 Langues : déclaré vs évalué + contexte | Un seul niveau CEFR | « Évalué » = matching futur |
| §17 Auto-évaluation (IA vs candidat + commentaire) | Proxy : `candidate_skills.level` | Dépend du matching (§11) |

---

## 6. Offres d'emploi et entreprise

### 6.1 Modèle relationnel cible (D4 — décidé, non implémenté)

```
users ──▶ recruiters (table existante, vide)
             │
             ├─ crée une company → owner (company_members ou is_owner)
             └─ affecté à une company (appartendance)
                          │
                          ▼
              job_offer (recruiter_id → gestion, company_id → appartenance)
                          │            [relation tertiaire]
              validation par le recruteur
                          ▼
              normalisation de l'offre → fiche offre
                          ▼
              matching : fiche offre ↔ fiches candidats
```

- Une offre est **gérée par un recruteur** et **appartient à une company**.
- La validation de l'offre par le recruteur **déclenche sa normalisation** — même machine à états que le profil candidat (shared PK `job_id ≡ normalized_profile_id`, réutilisation de `normalization_job`).
- La table d'association `normalized_profile_candidate` (nom spécifique au candidat) devra être étendue ou doublée pour l'offre — à trancher à l'implémentation.

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
| **D3** | **Projets : étude préalable obligatoire** — transverse (pas seulement IT : campagnes, audits, chantiers…), taxonomie des champs universels, modèle (imbriqué vs autonome), extraction IA, consommation par matching. `schemaVersion` gère l'évolution du contenu ; seule l'entrée éditable (table+UI+API) demande une décision ferme. **Ne pas implémenter avant l'étude.** | §5.2. |
| **D4** | **Normalisation d'offre avec le profil recruteur** : recruteur crée company (owner) ou y est affecté ; offre = `recruiter_id` + `company_id` ; validation de l'offre → normalisation → fiche → matching. | §6.1. |
| **D5** | **Q7 à réévaluer au matching** : l'affichage « comment mon profil a été évalué » nécessitera de lire la fiche — décider alors de la forme du endpoint. | §4.3, §11.1. |
| **D6** | **Certifications** via `candidate_links` (simplification assumée : pas d'expiration/vérification/rattachement compétence). | §5.2. |

---

## 15. Modèle de données

### 15.1 Existant (migrations V1–V9)

**Comptes** : `users` (identité + géo + `updated_at` heartbeat), `candidates` (title, bio, years_of_experience, search_status, target_position), `recruiters` (vide), `user_roles`.
**Profil** : `professional_experiences` (dont FK morte `job_position_id`), `diplomas`, `candidate_skills` (level 1–5, years_experience), `candidate_languages` (CEFR), `candidate_links` (dont `CERTIFICATION`).
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

### 15.3 À concevoir (Phase 1)

`companies`, `company_members` (ou `is_owner`), `job_offers` (`recruiter_id` + `company_id`), `offer_criteria` (mandatory/preferred, weight, required_level, min_experience, evidence_required, category), `offer_questions` (+ réponses candidat), `matching_results` (scores par critère, catégorie « info insuffisante »), `clarifications` (historique évaluation → clarification → rééval), embeddings (choix technique à trancher).

---

## 16. État actuel et écarts priorisés

### 16.1 Livré et testé

- Comptes, auth, admin, rôles ; profil candidat 6 sections + import CV + suggestions ; **normalisation du profil candidat complète** (push async, dirty-flag, versioning, retries, recovery, bandeau) ; service IA extraction + normalisation.
- **192 tests backend / 284 frontend au vert.**

### 16.2 Écarts (audit 2026-10)

| # | Écart | Nature | Priorité | Décision |
|---|---|---|---|---|
| 1 | Contenu normalisé ≈ 50 % du §10-17 (séniorité, dispo, mobilité, technologies absents) | Écart réel (chaîne profil → fiche) | **importante** | D2 ouvre ; schemaVersion gère |
| 2 | Section Projets absente | Oubli réel (CDC : « importante ») | **importante** | D3 : étude d'abord |
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

---

## 17. Phasage

| Phase | Contenu | État |
|---|---|---|
| **0 — Profil candidat** | Comptes, 6 sections, import CV, **normalisation profil** (push, dirty-flag, bandeau) | ✅ **Livré** |
| **0+ — Extensions profil** | Contrat recherché + mobilité (D2) ; catégorie en contenu normalisé ; étude Projets (D3) | Décisions prêtes |
| **1 — Entreprise / recruteur / offre** | Company (owner/membre), recruteur, CRUD offre, validation → **normalisation offre** (D4), analyse IA offre (§9) | À venir |
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
